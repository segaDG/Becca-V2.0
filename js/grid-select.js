/**
 * BECCA Grid Select + Fill Drag
 * Google Sheets-like cell range selection with SUM + drag-copy fill handle.
 * Attaches to tables with [data-grid-select] attribute.
 */
const GridSelect = (() => {
  let _sel = null;   // {tbl, startRow, startCol, cells:[]}
  let _bar = null;
  let _fill = null;  // {tbl, srcTd, srcRow, srcCol, value, targets:[]}
  const _fillCbs = {}; // tableId → callback(tableId, colIdx, srcRowIdx, targetRowIndices, value)

  function _injectCSS() {
    if (document.getElementById('gs-css')) return;
    const s = document.createElement('style'); s.id = 'gs-css';
    s.textContent = `
      .gs-sel{background:rgba(99,102,241,.12)!important;outline:1px solid rgba(99,102,241,.5);outline-offset:-1px}
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
    const tbody = tbl?.querySelector('tbody');
    if (!tbody) return [];
    const rows = Array.from(tbody.children), out = [];
    for (let r = Math.min(r1,r2); r <= Math.max(r1,r2); r++) {
      if (!rows[r]) continue;
      const tds = Array.from(rows[r].children);
      for (let c = Math.min(c1,c2); c <= Math.max(c1,c2); c++) if (tds[c]) out.push(tds[c]);
    }
    return out;
  }

  function _clear() {
    document.querySelectorAll('.gs-sel,.gs-fill').forEach(el => {
      el.classList.remove('gs-sel','gs-fill');
      el.querySelector('.gs-handle')?.remove();
    });
    if (_bar) { _bar.remove(); _bar = null; }
    _sel = null;
  }

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
    if (e.target.closest('.gs-handle')) return; // let fill handle do its thing
    const td = e.target.closest('td');
    if (!td) return;
    const tbl = td.closest('table[data-grid-select]');
    if (!tbl) return;
    if (td.closest('.ks-editing,.iv-editing') || e.target.closest('input,select,button')) return;
    const pos = _rc(td);
    if (!pos) return;

    _clear();
    td.classList.add('gs-sel');
    td.style.position = 'relative';
    // Add fill handle
    const h = document.createElement('div'); h.className = 'gs-handle';
    h.addEventListener('mousedown', _fillStart);
    td.appendChild(h);
    _sel = { tbl, startRow: pos.row, startCol: pos.col, cells: [td] };

    document.addEventListener('mousemove', _onMove);
    document.addEventListener('mouseup', _onUp);
    e.preventDefault();
  }

  function _onMove(e) {
    if (!_sel) return;
    const td = e.target.closest('td');
    if (!td || td.closest('table') !== _sel.tbl) return;
    const pos = _rc(td);
    if (!pos) return;
    _sel.tbl.querySelectorAll('.gs-sel').forEach(el => { el.classList.remove('gs-sel'); el.querySelector('.gs-handle')?.remove(); });
    const cells = _range(_sel.tbl, _sel.startRow, _sel.startCol, pos.row, pos.col);
    cells.forEach(c => c.classList.add('gs-sel'));
    _sel.cells = cells;
  }

  function _onUp() {
    document.removeEventListener('mousemove', _onMove);
    document.removeEventListener('mouseup', _onUp);
    if (_sel && _sel.cells.length > 0) _showBar(_sel.cells);
  }

  // ── FILL DRAG ──
  function _fillStart(e) {
    e.preventDefault(); e.stopPropagation();
    const td = e.target.closest('td');
    const tbl = td?.closest('table[data-grid-select]');
    const pos = _rc(td);
    if (!td || !tbl || !pos) return;
    _fill = { tbl, srcTd: td, srcRow: pos.row, srcCol: pos.col, value: (td.innerText||'').trim(), targets: [] };
    document.addEventListener('mousemove', _fillMove);
    document.addEventListener('mouseup', _fillEnd);
  }

  function _fillMove(e) {
    if (!_fill) return;
    _fill.tbl.querySelectorAll('.gs-fill').forEach(el => el.classList.remove('gs-fill'));
    _fill.targets = [];
    const tbody = _fill.tbl.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.children);
    const mouseY = e.clientY;
    for (let i = _fill.srcRow + 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.getBoundingClientRect().top > mouseY) break;
      const td = r.children[_fill.srcCol];
      if (td) { td.classList.add('gs-fill'); _fill.targets.push({ td, rowIdx: i }); }
    }
  }

  function _fillEnd() {
    document.removeEventListener('mousemove', _fillMove);
    document.removeEventListener('mouseup', _fillEnd);
    if (!_fill || !_fill.targets.length) { _fill = null; return; }

    const tblId = _fill.tbl.id;
    const cb = _fillCbs[tblId];
    if (cb) {
      // Module callback handles data update + re-render
      cb(tblId, _fill.srcCol, _fill.srcRow, _fill.targets.map(t => t.rowIdx), _fill.value);
    }
    // Clear UI
    _fill.tbl.querySelectorAll('.gs-fill,.gs-sel').forEach(el => {
      el.classList.remove('gs-fill','gs-sel'); el.querySelector('.gs-handle')?.remove();
    });
    _fill = null;
  }

  // Register fill callback: fn(tableId, colIdx, srcRowIdx, targetRowIndices[], srcValue)
  function onFill(tableId, fn) { _fillCbs[tableId] = fn; }

  // ── GLOBAL LISTENERS ──
  document.addEventListener('click', e => {
    if (_sel && !e.target.closest('table[data-grid-select],.gs-bar')) _clear();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _sel) _clear(); });
  _injectCSS();
  document.addEventListener('mousedown', _onDown);

  return { onFill, clear: _clear };
})();
window.GridSelect = GridSelect;
