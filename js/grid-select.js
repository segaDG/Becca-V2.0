/**
 * BECCA Grid Select + Fill Drag + Copy/Paste
 * Google Sheets-like: block select, SUM bar, fill drag, Ctrl+C/V, arrow nav, right-click menu.
 * Auto-attaches to any <table> inside #content area (opt-out via data-no-grid-select).
 * Explicit data-grid-select attribute juga didukung (backward compat untuk modal).
 */
const GridSelect = (() => {
  let _sel = null;   // {tbl, startRow, startCol, endRow, endCol, cells:[]}
  let _bar = null;
  let _fill = null;
  let _ctx = null;   // context menu element
  let _copied = null; // {rows:[[text,...]], startCol, numCols, numRows}
  const _fillCbs = {};  // tableId → fn(tblId, col, srcRow, targetRows[], val)
  const _pasteCbs = {}; // tableId → fn(tblId, startRow, startCol, rows[][])
  const _clearCbs = {}; // tableId → fn(tblId, rowIdx, colIdx) — Delete/Backspace handler

  function _css() {
    if (document.getElementById('gs-css')) return;
    const s = document.createElement('style'); s.id = 'gs-css';
    s.textContent = `
      .gs-sel{background:rgba(99,102,241,.12)!important;outline:1px solid rgba(99,102,241,.5);outline-offset:-1px}
      .gs-copied{outline:2px dashed rgba(99,102,241,.6)!important;outline-offset:-2px}
      .gs-handle{position:absolute;right:-5px;bottom:-5px;width:11px;height:11px;background:var(--primary,#6366f1);
        border:1.5px solid #fff;cursor:crosshair;z-index:5;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,.25);
        transition:transform .12s ease,box-shadow .12s ease}
      .gs-handle::before{content:"";position:absolute;inset:-6px;cursor:crosshair}
      .gs-handle:hover{transform:scale(1.35);box-shadow:0 2px 6px rgba(99,102,241,.45)}
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
        color:var(--text-3,#aaa);font-size:16px;font-weight:700;
        transition:background .3s,color .3s,border-color .3s,box-shadow .3s;
        padding:0;line-height:1}
      .filter-reset-btn:hover{background:var(--surface2,#f5f5f5);color:var(--text,#333)}
      .filter-reset-btn.active{background:#ef4444;color:#fff;border-color:#ef4444;
        box-shadow:0 2px 10px rgba(239,68,68,.35);
        animation:filterPulse 1.5s ease infinite}
      .filter-reset-btn.active:hover{background:#dc2626;box-shadow:0 2px 14px rgba(239,68,68,.5);animation:none}
      .filter-reset-btn.spinning{animation:filterSpin .6s ease}
      @keyframes filterPulse{0%,100%{box-shadow:0 2px 10px rgba(239,68,68,.35);transform:scale(1)}50%{box-shadow:0 3px 16px rgba(239,68,68,.55);transform:scale(1.08)}}
      @keyframes filterSpin{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}}
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

  // Tentukan apakah suatu table eligible untuk grid-select.
  // Auto-attach: tabel di dalam #content yang BUKAN di modal/sidebar/popup.
  // Opt-out: tabel dengan attribute data-no-grid-select.
  // Backward compat: data-grid-select tetap force-enable (untuk modal/popup yg seharusnya pakai).
  function _eligibleTable(tbl) {
    if (!tbl) return false;
    if (tbl.hasAttribute('data-no-grid-select')) return false;
    if (tbl.hasAttribute('data-grid-select')) return true;
    if (!tbl.closest('#content, .content')) return false;
    if (tbl.closest('.modal-overlay, #modal-root, .sidebar, .gs-bar, .gs-ctx, .notify-popup, header')) return false;
    // Skip kalau bukan data table (no tbody or 0 rows)
    if (!tbl.querySelector('tbody tr')) return false;
    return true;
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
    if (cells.length <= 1) return; // Don't show for single cell
    const nums = [];
    cells.forEach(td => { const n = _num((td.textContent||'').trim()); if (!isNaN(n) && n !== 0) nums.push(n); });
    if (!nums.length) return;
    // Detect if values look like currency (>= 1000 or cell text contains "Rp")
    const isCurrency = cells.some(td => (td.textContent||'').includes('Rp')) || nums.some(n => Math.abs(n) >= 1000);
    const fmt = n => isCurrency ? 'Rp '+Math.round(n).toLocaleString('id') : (n === Math.floor(n) ? String(n) : n.toFixed(2));
    const sum = nums.reduce((a,b)=>a+b,0), avg = sum/nums.length;
    let h = `<div class="gs-bar-item"><span class="gs-bar-label">Sel</span><span class="gs-bar-val" style="color:var(--text,#333)">${cells.length}</span></div>
      <div style="width:1px;height:24px;background:var(--border,#ddd)"></div>
      <div class="gs-bar-item"><span class="gs-bar-label">Sum</span><span class="gs-bar-val">${fmt(sum)}</span></div>
      <div class="gs-bar-item"><span class="gs-bar-label">Avg</span><span class="gs-bar-val" style="font-size:12px;color:var(--text-2,#666)">${fmt(avg)}</span></div>
      <div class="gs-bar-item"><span class="gs-bar-label">Min</span><span class="gs-bar-val" style="font-size:12px;color:#10b981">${fmt(Math.min(...nums))}</span></div>
      <div class="gs-bar-item"><span class="gs-bar-label">Max</span><span class="gs-bar-val" style="font-size:12px;color:#ef4444">${fmt(Math.max(...nums))}</span></div>
      <div class="gs-bar-item"><span class="gs-bar-label">Count</span><span class="gs-bar-val" style="font-size:12px;color:var(--text-2,#666)">${nums.length}</span></div>`;
    _bar = document.createElement('div'); _bar.className = 'gs-bar'; _bar.innerHTML = h;
    document.body.appendChild(_bar);
  }

  // ── BLOCK SELECT ──
  // Defer activation: simpan state pending sampai mouse benar-benar bergerak.
  // Tanpa ini, e.preventDefault() di mousedown bisa mengganggu click handler
  // di TR (mis. activity log row → showActivityDetail) — user kehilangan fitur klik baris.
  let _pending = null;
  const DRAG_THRESHOLD = 4; // px

  function _onDown(e) {
    if (e.target.closest('.gs-handle')) return;
    if (e.button !== 0) return; // hanya left-click
    const td = e.target.closest('td');
    if (!td) return;
    const tbl = td.closest('table');
    if (!_eligibleTable(tbl)) return;
    if (td.closest('.ks-editing,.iv-editing,.po-editing,.di-editing,.ap-editing') || e.target.closest('input,select,button,textarea,a[href],label,[contenteditable]')) return;
    const pos = _rc(td); if (!pos) return;
    // Set pending — belum activate selection sampai user benar-benar drag
    _pending = { td, tbl, pos, x: e.clientX, y: e.clientY };
    document.addEventListener('mousemove', _pendingMove);
    document.addEventListener('mouseup', _pendingUp);
  }

  function _pendingMove(e) {
    if (!_pending) return;
    const dx = e.clientX - _pending.x, dy = e.clientY - _pending.y;
    if (dx*dx + dy*dy < DRAG_THRESHOLD*DRAG_THRESHOLD) return;
    // Drag detected → activate selection
    const { td, tbl, pos } = _pending;
    _pending = null;
    document.removeEventListener('mousemove', _pendingMove);
    document.removeEventListener('mouseup', _pendingUp);
    _clear();
    td.classList.add('gs-sel'); td.style.position = 'relative';
    const h = document.createElement('div'); h.className = 'gs-handle';
    h.title = 'Geser ke atas/bawah untuk copy nilai ke baris lain';
    h.addEventListener('mousedown', _fillStart); td.appendChild(h);
    _sel = { tbl, startRow: pos.row, startCol: pos.col, endRow: pos.row, endCol: pos.col, cells: [td] };
    document.addEventListener('mousemove', _onMoveThrottled);
    document.addEventListener('mouseup', _onUp);
    _onMove(e); // immediately extend to current mouse position
  }

  function _pendingUp() {
    // No drag — biarkan click event normal fire ke row's onclick. Tidak ada selection.
    document.removeEventListener('mousemove', _pendingMove);
    document.removeEventListener('mouseup', _pendingUp);
    _pending = null;
  }
  let _selRaf = 0;
  function _onMoveThrottled(e) {
    if (_selRaf) return;
    _selRaf = requestAnimationFrame(() => { _onMove(e); _selRaf = 0; });
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
    document.removeEventListener('mousemove', _onMoveThrottled);
    document.removeEventListener('mouseup', _onUp);
    if (_sel && _sel.cells.length > 0) _showBar(_sel.cells);
  }

  // ── FILL DRAG ──
  let _fillRaf = 0;
  function _fillStart(e) {
    e.preventDefault(); e.stopPropagation();
    const td = e.target.closest('td'), tbl = td?.closest('table'), pos = _rc(td);
    if (!td || !tbl || !pos || !_eligibleTable(tbl)) return;
    _fill = { tbl, srcRow: pos.row, srcCol: pos.col, value: (td.textContent||'').trim(), targets: [] };
    document.addEventListener('mousemove', _fillMoveThrottled);
    document.addEventListener('mouseup', _fillEnd);
  }
  function _fillMoveThrottled(e) {
    if (_fillRaf) return;
    _fillRaf = requestAnimationFrame(() => { _fillMove(e); _fillRaf = 0; });
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
    document.removeEventListener('mousemove', _fillMoveThrottled);
    document.removeEventListener('mouseup', _fillEnd);
    if (!_fill || !_fill.targets.length) { _fill = null; return; }
    const cb = _fillCbs[_fill.tbl.id];
    const tbl = _fill.tbl;
    const srcCol = _fill.srcCol, srcRow = _fill.srcRow;
    const targets = _fill.targets.map(t => t.rowIdx);
    // Auto-convert displayed date DD-MM-YYYY → YYYY-MM-DD for DB
    let fillVal = _fill.value;
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(fillVal)) {
      const p = fillVal.split(/[-/]/); fillVal = p[2]+'-'+p[1]+'-'+p[0];
    }
    // Clear fill highlight UI immediately
    tbl.querySelectorAll('.gs-fill,.gs-sel').forEach(el => { el.classList.remove('gs-fill','gs-sel'); el.querySelector('.gs-handle')?.remove(); });
    _fill = null;
    if (!cb) return;
    // Konfirmasi sebelum apply — supaya tidak salah klik/drag
    const direction = targets[0] > srcRow ? 'di bawah' : 'di atas';
    const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const valDisplay = fillVal === '' || fillVal == null
      ? '<em style="color:var(--text-3)">(kosong)</em>'
      : `<strong>${esc(String(fillVal).slice(0, 60))}</strong>`;
    const msg = `Copy ${valDisplay} ke <strong>${targets.length}</strong> baris ${direction}?`;
    const apply = () => cb(tbl.id, srcCol, srcRow, targets, fillVal);
    if (typeof Modal !== 'undefined' && Modal.confirm) {
      Modal.confirm({ title: 'Konfirmasi Copy', message: msg, confirmText: 'Ya, Copy' })
        .then(ok => { if (ok) apply(); });
    } else {
      apply();
    }
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
      for (let c = c1; c <= c2; c++) row.push((tds[c]?.textContent || '').trim());
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
  // Helper untuk re-render selection (dipakai arrow nav)
  function _redrawSelection() {
    if (!_sel) return;
    const tbl = _sel.tbl;
    tbl.querySelectorAll('.gs-sel').forEach(el => {
      el.classList.remove('gs-sel');
      el.querySelector('.gs-handle')?.remove();
    });
    const cells = _range(tbl, _sel.startRow, _sel.startCol, _sel.endRow, _sel.endCol);
    cells.forEach(c => c.classList.add('gs-sel'));
    _sel.cells = cells;
    // Re-add fill handle untuk anchor cell (kalau single cell)
    if (cells.length === 1) {
      const td = cells[0];
      td.style.position = 'relative';
      const h = document.createElement('div');
      h.className = 'gs-handle';
      h.title = 'Geser ke atas/bawah untuk copy nilai ke baris lain';
      h.addEventListener('mousedown', _fillStart);
      td.appendChild(h);
    }
    // Update sum bar
    if (cells.length > 1) _showBar(cells);
    else if (_bar) { _bar.remove(); _bar = null; }
    // Scroll anchor cell into view
    const anchor = cells[cells.length - 1] || cells[0];
    anchor?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName||'').toLowerCase();
    if (tag === 'textarea') return;
    if (e.key === 'Escape') { _clear(); return; }
    // Delete/Backspace: clear isi cell yg ter-select (cell mode, bukan saat edit input)
    if ((e.key === 'Delete' || e.key === 'Backspace') && _sel && _sel.cells.length) {
      // Skip kalau target adalah input/select/textarea/contenteditable (browser default)
      if (tag === 'input' || tag === 'select' || tag === 'button' || e.target.isContentEditable) return;
      e.preventDefault();
      _doClear();
      return;
    }
    // Enter atau F2: masuk edit mode di cell ter-select (Excel-like).
    // Dispatch synthetic dblclick — modul yang punya ondblclick (kas, inventory, po,
    // daily-order) akan auto-trigger edit. Modul tanpa ondblclick → no-op.
    if (_sel && _sel.cells.length === 1 && (e.key === 'Enter' || e.key === 'F2')) {
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable) return;
      e.preventDefault();
      const td = _sel.cells[0];
      _clear(); // release selection — user akan langsung masuk input editor
      td.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
      return;
    }
    // Arrow navigation (Excel-like): pindah cell pakai panah, Shift+Arrow extend selection
    if (_sel && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      if (tag === 'input' || tag === 'select' || tag === 'button' || e.target.isContentEditable) return;
      e.preventDefault();
      const tbody = _sel.tbl.querySelector('tbody');
      if (!tbody) return;
      const rowCount = tbody.children.length;
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.shiftKey) {
        // Extend: update endRow/endCol only
        const newR = Math.max(0, Math.min(rowCount - 1, _sel.endRow + dr));
        const colCount = tbody.children[newR]?.children.length || 1;
        const newC = Math.max(0, Math.min(colCount - 1, _sel.endCol + dc));
        _sel.endRow = newR; _sel.endCol = newC;
      } else {
        // Move single cell: update both start+end
        const newR = Math.max(0, Math.min(rowCount - 1, _sel.startRow + dr));
        const colCount = tbody.children[newR]?.children.length || 1;
        const newC = Math.max(0, Math.min(colCount - 1, _sel.startCol + dc));
        _sel.startRow = newR; _sel.startCol = newC;
        _sel.endRow   = newR; _sel.endCol   = newC;
      }
      _redrawSelection();
      return;
    }
    const meta = e.metaKey || e.ctrlKey;
    if (!meta || !_sel) return;
    if (e.key === 'c') { e.preventDefault(); _doCopy(); }
    if (e.key === 'v') { e.preventDefault(); _doPaste(); }
    // Ctrl+A: select all cells dalam tbody (handy untuk total seluruh kolom)
    if (e.key === 'a') {
      e.preventDefault();
      const tbody = _sel.tbl.querySelector('tbody');
      if (!tbody) return;
      const rowCount = tbody.children.length;
      const colCount = tbody.children[0]?.children.length || 1;
      _sel.startRow = 0; _sel.startCol = 0;
      _sel.endRow   = rowCount - 1; _sel.endCol = colCount - 1;
      _redrawSelection();
    }
  });

  function _doClear() {
    if (!_sel || !_sel.cells.length) return;
    const cb = _clearCbs[_sel.tbl.id];
    if (!cb) return;
    const r1 = Math.min(_sel.startRow, _sel.endRow);
    const r2 = Math.max(_sel.startRow, _sel.endRow);
    const c1 = Math.min(_sel.startCol, _sel.endCol);
    const c2 = Math.max(_sel.startCol, _sel.endCol);
    const cellCount = (r2 - r1 + 1) * (c2 - c1 + 1);

    const apply = () => {
      const tblId = _sel.tbl.id;
      const cells = [];
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) cells.push({ row: r, col: c });
      }
      _clear();
      cells.forEach(({ row, col }) => { try { cb(tblId, row, col); } catch (e) { console.warn('[gs] clear cb err:', e); } });
    };

    // Konfirmasi kalau >1 cell, supaya tidak salah hapus banyak
    if (cellCount > 1 && typeof Modal !== 'undefined' && Modal.confirm) {
      Modal.confirm({
        title: 'Hapus Isi Cell',
        message: `Hapus isi <strong>${cellCount}</strong> cell terpilih?`,
        confirmText: 'Ya, Hapus',
        danger: true,
      }).then(ok => { if (ok) apply(); });
    } else {
      apply();
    }
  }

  document.addEventListener('contextmenu', e => {
    if (!_sel || !_sel.cells.length) return;
    const td = e.target.closest('td');
    if (!td || !td.classList.contains('gs-sel')) return;
    e.preventDefault();
    _showCtx(e.clientX, e.clientY);
  });

  document.addEventListener('click', e => {
    _hideCtx();
    if (_sel && !e.target.closest('table,.gs-bar,.gs-ctx')) _clear();
  });
  _css();
  document.addEventListener('mousedown', _onDown);

  function onFill(id, fn)  { _fillCbs[id]  = fn; }
  function onPaste(id, fn) { _pasteCbs[id] = fn; }
  function onClear(id, fn) { _clearCbs[id] = fn; }
  return { onFill, onPaste, onClear, clear: _clear };
})();
window.GridSelect = GridSelect;
