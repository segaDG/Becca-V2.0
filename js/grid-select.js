/**
 * BECCA Grid Select — Google Sheets-like cell range selection with SUM
 * Attaches to tables with [data-grid-select] attribute.
 * Usage: add data-grid-select to any <table> element.
 * Numeric cells are auto-detected and summed in a floating status bar.
 */
(function() {
  const STYLE_ID = 'becca-grid-select-css';
  let _sel = null; // {tbl, startTd, startRow, startCol, cells:[]}
  let _bar = null; // floating status bar element

  function _injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .gs-selected{background:rgba(99,102,241,.12)!important;outline:1px solid rgba(99,102,241,.5);outline-offset:-1px}
      .gs-bar{position:fixed;bottom:16px;right:16px;background:var(--surface,#fff);border:1px solid var(--border,#ddd);
        border-radius:10px;padding:8px 14px;box-shadow:0 4px 20px rgba(0,0,0,.15);z-index:999;
        display:flex;align-items:center;gap:14px;font-size:12px;font-family:var(--font,Arial);
        animation:gsIn .2s ease}
      @keyframes gsIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      .gs-bar-item{display:flex;flex-direction:column;align-items:center;gap:1px}
      .gs-bar-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3,#999)}
      .gs-bar-val{font-size:14px;font-weight:800;font-family:var(--font-mono,monospace);color:var(--primary,#6366f1)}
    `;
    document.head.appendChild(s);
  }

  function _parseNum(txt) {
    if (!txt) return NaN;
    // Strip Rp, spaces, dots (thousand sep), replace comma with dot
    const clean = txt.replace(/[Rp\s.]/g,'').replace(',','.').trim();
    return parseFloat(clean);
  }

  function _getCellRC(td) {
    const tr = td.closest('tr');
    if (!tr) return null;
    const tbody = tr.closest('tbody');
    if (!tbody) return null;
    const rows = Array.from(tbody.children);
    const row = rows.indexOf(tr);
    const col = Array.from(tr.children).indexOf(td);
    return {row, col};
  }

  function _getCellsInRange(tbl, r1, c1, r2, c2) {
    const tbody = tbl.querySelector('tbody');
    if (!tbody) return [];
    const rows = Array.from(tbody.children);
    const minR = Math.min(r1,r2), maxR = Math.max(r1,r2);
    const minC = Math.min(c1,c2), maxC = Math.max(c1,c2);
    const cells = [];
    for (let r = minR; r <= maxR; r++) {
      if (!rows[r]) continue;
      const tds = Array.from(rows[r].children);
      for (let c = minC; c <= maxC; c++) {
        if (tds[c]) cells.push(tds[c]);
      }
    }
    return cells;
  }

  function _clearSelection() {
    document.querySelectorAll('.gs-selected').forEach(el => el.classList.remove('gs-selected'));
    if (_bar) { _bar.remove(); _bar = null; }
    _sel = null;
  }

  function _showBar(cells) {
    if (_bar) { _bar.remove(); _bar = null; }
    const nums = [];
    cells.forEach(td => {
      const txt = (td.innerText || td.textContent || '').trim();
      const n = _parseNum(txt);
      if (!isNaN(n) && n !== 0) nums.push(n);
    });
    if (nums.length === 0 && cells.length <= 1) return;

    _bar = document.createElement('div');
    _bar.className = 'gs-bar';

    const count = cells.length;
    const numCount = nums.length;
    let html = `<div class="gs-bar-item"><span class="gs-bar-label">Sel</span><span class="gs-bar-val" style="color:var(--text,#333)">${count}</span></div>`;

    if (numCount > 0) {
      const sum = nums.reduce((a,b) => a+b, 0);
      const avg = sum / numCount;
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const fmt = n => 'Rp '+Math.round(n).toLocaleString('id');
      html += `
        <div style="width:1px;height:24px;background:var(--border,#ddd)"></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Sum</span><span class="gs-bar-val">${fmt(sum)}</span></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Avg</span><span class="gs-bar-val" style="font-size:12px;color:var(--text-2,#666)">${fmt(avg)}</span></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Min</span><span class="gs-bar-val" style="font-size:12px;color:#10b981">${fmt(min)}</span></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Max</span><span class="gs-bar-val" style="font-size:12px;color:#ef4444">${fmt(max)}</span></div>
        <div class="gs-bar-item"><span class="gs-bar-label">Count</span><span class="gs-bar-val" style="font-size:12px;color:var(--text-2,#666)">${numCount}</span></div>`;
    }

    _bar.innerHTML = html;
    document.body.appendChild(_bar);
  }

  function _onMouseDown(e) {
    const td = e.target.closest('td');
    if (!td) return;
    const tbl = td.closest('table[data-grid-select]');
    if (!tbl) return;
    // Don't interfere with editing rows or inputs
    if (td.closest('.ks-editing,.iv-editing') || e.target.closest('input,select,button,.ks-fill-handle')) return;

    const rc = _getCellRC(td);
    if (!rc) return;

    _clearSelection();
    td.classList.add('gs-selected');
    _sel = { tbl, startRow: rc.row, startCol: rc.col, cells: [td] };

    document.addEventListener('mousemove', _onMouseMove);
    document.addEventListener('mouseup', _onMouseUp);
    e.preventDefault();
  }

  function _onMouseMove(e) {
    if (!_sel) return;
    const td = e.target.closest('td');
    if (!td || td.closest('table') !== _sel.tbl) return;
    const rc = _getCellRC(td);
    if (!rc) return;

    // Clear previous highlight
    _sel.tbl.querySelectorAll('.gs-selected').forEach(el => el.classList.remove('gs-selected'));

    const cells = _getCellsInRange(_sel.tbl, _sel.startRow, _sel.startCol, rc.row, rc.col);
    cells.forEach(c => c.classList.add('gs-selected'));
    _sel.cells = cells;
  }

  function _onMouseUp() {
    document.removeEventListener('mousemove', _onMouseMove);
    document.removeEventListener('mouseup', _onMouseUp);
    if (_sel && _sel.cells.length > 0) {
      _showBar(_sel.cells);
    }
  }

  // Clear on click outside table
  document.addEventListener('click', e => {
    if (_sel && !e.target.closest('table[data-grid-select]') && !e.target.closest('.gs-bar')) {
      _clearSelection();
    }
  });

  // Clear on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _sel) _clearSelection();
  });

  // Init: attach mousedown to document (delegation)
  _injectCSS();
  document.addEventListener('mousedown', _onMouseDown);
})();
