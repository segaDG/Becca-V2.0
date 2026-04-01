/**
 * BECCA Grid Select + Fill Drag + Copy/Paste
 * Google Sheets-like: block select, SUM bar, fill drag, Ctrl+C/V, right-click menu.
 * Attaches to tables with [data-grid-select] attribute.
 */
const GridSelect = (() => {
  let _sel = null;   // {tbl, startRow, startCol, endRow, endCol, cells:[]}
  let _bar = null;
  let _fill = null;
  let _ctx = null;   // context menu element
  let _copied = null; // {rows:[[text,...]], startCol, numCols, numRows}
  const _fillCbs = {};  // tableId → fn(tblId, col, srcRow, targetRows[], val)
  const _pasteCbs = {}; // tableId → fn(tblId, startRow, startCol, rows[][])

  function _css() {
    if (document.getElementById('gs-css')) return;
    const s = document.createElement('style'); s.id = 'gs-css';
    s.textContent = `
      .gs-sel{background:rgba(99,102,241,.12)!important;outline:1px solid rgba(99,102,241,.5);outline-offset:-1px}
      .gs-copied{outline:2px dashed rgba(99,102,241,.6)!important;outline-offset:-2px}
      .gs-handle{position:absolute;right:-4px;bottom:-4px;width:8px;height:8px;background:var(--primary,#6366f1);
        border:1px solid #fff;cursor:crosshair;z-index:5;border-radius:1px}
      .gs-fill{background:rgba(99,102,241,.12)!important}
      .gs-bar{position:fixed;bottom:16px;right:16px;background:var(--surface,#fff);border:1px solid var(--border,#ddd);
        border-radius:10px;padding:8px 14px;box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:999;
        display:flex;align-items:center;gap:14px;font-size:12px;animation:gsIn .15s ease}
      @keyframes gsIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .gs-bar-item{display:flex;flex-direction:column;align-items:center;gap:1px}
      .gs-bar-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3,#999)}
      .gs-bar-val{font-size:14px;font-weight:800;font-family:var(--font-mono,monospace);color:var(--primary,#6366f1)}
      .gs-ctx{position:fixed;background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:8px;
        padding:4px 0;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:9999;min-width:140px;font-size:12px}
      .gs-ctx-item{padding:6px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--text,#333)}
      .gs-ctx-item:hover{background:rgba(99,102,241,.08)}
      .gs-ctx-item kbd{font-size:10px;color:var(--text-3,#999);margin-left:auto;font-family:var(--font-mono,monospace)}
      /* Filter reset button — icon rotates when filter active */
      .filter-reset-btn{width:30px;height:30px;min-width:30px;border-radius:6px;border:1px solid var(--border2,#ddd);
        background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
        color:var(--text-3,#aaa);font-size:14px;transition:transform 1.2s cubic-bezier(.4,0,.2,1),background .6s,color .6s,border-color .6s,box-shadow .6s;
        padding:0;line-height:1}
      .filter-reset-btn:hover{background:var(--surface2,#f5f5f5);color:var(--text,#333)}
      .filter-reset-btn.active{background:#ef4444;color:#fff;border-color:#ef4444;
        transform:rotate(-180deg);box-shadow:0 2px 10px rgba(239,68,68,.35);
        animation:filterGlow 2s ease infinite}
      .filter-reset-btn.active:hover{background:#dc2626;box-shadow:0 2px 14px rgba(239,68,68,.5)}
      @keyframes filterGlow{0%,100%{box-shadow:0 2px 10px rgba(239,68,68,.35)}50%{box-shadow:0 3px 16px rgba(239,68,68,.55)}}
    `;
    document.head.appendChild(s);
  }

  function _num(txt) {
    if (!txt) return NaN;
    return parseFloat(txt.replace(/[Rp\s\u00a0.]/g,'').replace(',','.').trim());
  }
  function _rc(td) {
    const tr = td?.closest('tr'), tbody = tr?.closest('tbody');
    if (!tr || !tbody) return null;
    return { row: Array.from(tbody.children).indexOf(tr), col: Array.from(tr.children).indexOf(td) };
  }
  function _range(tbl, r1, c1, r2, c2) {
    const tbody = tbl?.querySelector('tbody'); if (!tbody) return [];
    const rows = Array.from(tbody.children), out = [];
    for (let r = Math.min(r1,r2); r <= Math.max(r1,r2); r++) {
      if (!rows[r]) continue;
      const tds = Array.from(rows[r].children);
      for (let c = Math.min(c1,c2); c <= Math.max(c1,c2); c++) if (tds[c]) out.push(tds[c]);
    }
    return out;
  }
  function _clear() {
    document.querySelectorAll('.gs-sel,.gs-fill,.gs-copied').forEach(el => {
      el.classList.remove('gs-sel','gs-fill','gs-copied'); el.querySelector('.gs-handle')?.remove();
    });
    if (_bar) { _bar.remove(); _bar = null; }
    _hideCtx();
    _sel = null;
  }

  // ── SUM BAR ──
  function _showBar(cells) {
    if (_bar) { _bar.remove(); _bar = null; }
    const nums = [];
    cells.forEach(td => { const n = _num((td.innerText||'').trim()); if (!isNaN(n) && n !== 0) nums.push(n); });
    if (!nums.length && cells.length <= 1) return;
    const fmt = n => 'Rp '+Math.round(n).toLocaleString('id');
    let h = `<div class="gs-bar-item"><span class="gs-bar-label">Sel</span><span class="gs-bar-val" style="color:var(--text,#333)">${cells.length}</span></div>`;
    if (nums.length) {
      const sum = nums.reduce((a,b)=>a+b,0), avg = sum/nums.length;
      h += `<div style="width:1px;height:24px;background:var(--border,#ddd)"></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Sum</span><span class="gs-bar-val">${fmt(sum)}</span></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Avg</span><span class="gs-bar-val" style="font-size:12px;color:var(--text-2,#666)">${fmt(avg)}</span></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Min</span><span class="gs-bar-val" style="font-size:12px;color:#10b981">${fmt(Math.min(...nums))}</span></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Max</span><span class="gs-bar-val" style="font-size:12px;color:#ef4444">${fmt(Math.max(...nums))}</span></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Count</span><span class="gs-bar-val" style="font-size:12px;color:var(--text-2,#666)">${nums.length}</span></div>`;
    }
    _bar = document.createElement('div'); _bar.className = 'gs-bar'; _bar.innerHTML = h;
    document.body.appendChild(_bar);
  }

  // ── BLOCK SELECT ──
  function _onDown(e) {
    if (e.target.closest('.gs-handle')) return;
    const td = e.target.closest('td');
    if (!td) return;
    const tbl = td.closest('table[data-grid-select]');
    if (!tbl) return;
    if (td.closest('.ks-editing,.iv-editing,.po-editing') || e.target.closest('input,select,button')) return;
    const pos = _rc(td); if (!pos) return;
    _clear();
    td.classList.add('gs-sel'); td.style.position = 'relative';
    const h = document.createElement('div'); h.className = 'gs-handle';
    h.addEventListener('mousedown', _fillStart); td.appendChild(h);
    _sel = { tbl, startRow: pos.row, startCol: pos.col, endRow: pos.row, endCol: pos.col, cells: [td] };
    document.addEventListener('mousemove', _onMove);
    document.addEventListener('mouseup', _onUp);
    e.preventDefault();
  }
  function _onMove(e) {
    if (!_sel) return;
    const td = e.target.closest('td');
    if (!td || td.closest('table') !== _sel.tbl) return;
    const pos = _rc(td); if (!pos) return;
    _sel.tbl.querySelectorAll('.gs-sel').forEach(el => { el.classList.remove('gs-sel'); el.querySelector('.gs-handle')?.remove(); });
    const cells = _range(_sel.tbl, _sel.startRow, _sel.startCol, pos.row, pos.col);
    cells.forEach(c => c.classList.add('gs-sel'));
    _sel.cells = cells; _sel.endRow = pos.row; _sel.endCol = pos.col;
  }
  function _onUp() {
    document.removeEventListener('mousemove', _onMove);
    document.removeEventListener('mouseup', _onUp);
    if (_sel && _sel.cells.length > 0) _showBar(_sel.cells);
  }

  // ── FILL DRAG ──
  function _fillStart(e) {
    e.preventDefault(); e.stopPropagation();
    const td = e.target.closest('td'), tbl = td?.closest('table[data-grid-select]'), pos = _rc(td);
    if (!td || !tbl || !pos) return;
    _fill = { tbl, srcRow: pos.row, srcCol: pos.col, value: (td.innerText||'').trim(), targets: [] };
    document.addEventListener('mousemove', _fillMove);
    document.addEventListener('mouseup', _fillEnd);
  }
  function _fillMove(e) {
    if (!_fill) return;
    _fill.tbl.querySelectorAll('.gs-fill').forEach(el => el.classList.remove('gs-fill'));
    _fill.targets = [];
    const rows = Array.from(_fill.tbl.querySelector('tbody')?.children || []);
    const mouseY = e.clientY;
    const srcRect = rows[_fill.srcRow]?.getBoundingClientRect();
    if (!srcRect) return;
    const goDown = mouseY > srcRect.bottom;
    if (goDown) {
      for (let i = _fill.srcRow + 1; i < rows.length; i++) {
        if (rows[i].getBoundingClientRect().top > mouseY) break;
        const td = rows[i].children[_fill.srcCol];
        if (td) { td.classList.add('gs-fill'); _fill.targets.push({ td, rowIdx: i }); }
      }
    } else {
      for (let i = _fill.srcRow - 1; i >= 0; i--) {
        if (rows[i].getBoundingClientRect().bottom < mouseY) break;
        const td = rows[i].children[_fill.srcCol];
        if (td) { td.classList.add('gs-fill'); _fill.targets.push({ td, rowIdx: i }); }
      }
    }
  }
  function _fillEnd() {
    document.removeEventListener('mousemove', _fillMove);
    document.removeEventListener('mouseup', _fillEnd);
    if (!_fill || !_fill.targets.length) { _fill = null; return; }
    const cb = _fillCbs[_fill.tbl.id];
    // Auto-convert displayed date DD-MM-YYYY → YYYY-MM-DD for DB
    let fillVal = _fill.value;
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(fillVal)) {
      const p = fillVal.split(/[-/]/); fillVal = p[2]+'-'+p[1]+'-'+p[0];
    }
    if (cb) cb(_fill.tbl.id, _fill.srcCol, _fill.srcRow, _fill.targets.map(t => t.rowIdx), fillVal);
    _fill.tbl.querySelectorAll('.gs-fill,.gs-sel').forEach(el => { el.classList.remove('gs-fill','gs-sel'); el.querySelector('.gs-handle')?.remove(); });
    _fill = null;
  }

  // ── COPY (Ctrl+C) ──
  function _doCopy() {
    if (!_sel || !_sel.cells.length) return;
    const tbl = _sel.tbl, tbody = tbl.querySelector('tbody');
    if (!tbody) return;
    const r1 = Math.min(_sel.startRow, _sel.endRow), r2 = Math.max(_sel.startRow, _sel.endRow);
    const c1 = Math.min(_sel.startCol, _sel.endCol), c2 = Math.max(_sel.startCol, _sel.endCol);
    const rows = Array.from(tbody.children);
    const data = [];
    for (let r = r1; r <= r2; r++) {
      const tds = rows[r] ? Array.from(rows[r].children) : [];
      const row = [];
      for (let c = c1; c <= c2; c++) row.push((tds[c]?.innerText || '').trim());
      data.push(row);
    }
    _copied = { rows: data, startCol: c1, numCols: c2-c1+1, numRows: r2-r1+1 };
    // Copy to system clipboard as TSV
    const tsv = data.map(r => r.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).catch(() => {});
    // Visual: dashed outline on copied cells
    document.querySelectorAll('.gs-copied').forEach(el => el.classList.remove('gs-copied'));
    _sel.cells.forEach(c => c.classList.add('gs-copied'));
    if (window.Notify) Notify.info('Copied ' + _sel.cells.length + ' sel');
  }

  // ── PASTE (Ctrl+V) ──
  async function _doPaste() {
    if (!_sel || !_sel.tbl) return;
    const tbl = _sel.tbl, tbody = tbl.querySelector('tbody');
    if (!tbody) return;
    // Read from clipboard
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { return; }
    if (!text.trim()) return;
    // Auto-convert pasted dates DD-MM-YYYY or DD/MM/YYYY → YYYY-MM-DD
    const _normDate = v => /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(v) ? (p=>p[2]+'-'+p[1]+'-'+p[0])(v.split(/[-/]/)) : v;
    const pasteRows = text.split('\n').map(line => line.split('\t').map(_normDate));
    const startR = Math.min(_sel.startRow, _sel.endRow);
    const startC = Math.min(_sel.startCol, _sel.endCol);
    const cb = _pasteCbs[tbl.id];
    if (cb) {
      cb(tbl.id, startR, startC, pasteRows);
    }
    _clear();
  }

  // ── CONTEXT MENU ──
  function _hideCtx() { if (_ctx) { _ctx.remove(); _ctx = null; } }
  function _showCtx(x, y) {
    _hideCtx();
    _ctx = document.createElement('div'); _ctx.className = 'gs-ctx';
    const hasClip = !!(_copied || true); // always show paste
    _ctx.innerHTML = `
      <div class="gs-ctx-item" data-act="copy">Copy <kbd>Ctrl+C</kbd></div>
      <div class="gs-ctx-item" data-act="paste">Paste <kbd>Ctrl+V</kbd></div>
    `;
    _ctx.style.left = x + 'px'; _ctx.style.top = y + 'px';
    _ctx.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'copy') _doCopy();
      if (act === 'paste') _doPaste();
      _hideCtx();
    });
    document.body.appendChild(_ctx);
  }

  // ── KEYBOARD & EVENTS ──
  document.addEventListener('keydown', e => {
    if ((e.target.tagName||'').toLowerCase() === 'textarea') return;
    if (e.key === 'Escape') { _clear(); return; }
    const meta = e.metaKey || e.ctrlKey;
    if (!meta || !_sel) return;
    if (e.key === 'c') { e.preventDefault(); _doCopy(); }
    if (e.key === 'v') { e.preventDefault(); _doPaste(); }
  });

  document.addEventListener('contextmenu', e => {
    if (!_sel || !_sel.cells.length) return;
    const td = e.target.closest('td');
    if (!td || !td.classList.contains('gs-sel')) return;
    e.preventDefault();
    _showCtx(e.clientX, e.clientY);
  });

  document.addEventListener('click', e => {
    _hideCtx();
    if (_sel && !e.target.closest('table[data-grid-select],.gs-bar,.gs-ctx')) _clear();
  });
  _css();
  document.addEventListener('mousedown', _onDown);

  function onFill(id, fn) { _fillCbs[id] = fn; }
  function onPaste(id, fn) { _pasteCbs[id] = fn; }
  return { onFill, onPaste, clear: _clear };
})();
window.GridSelect = GridSelect;
