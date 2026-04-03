/* ============================================
   BECCA V2.0 — Utils Extensions
   Load setelah utils.js — tambahkan metode extra
   ============================================ */

Object.assign(Utils, {

  MONTHS_SHORT: ['Jan','Feb','Mar','Apr','Mei','Jun',
                 'Jul','Ags','Sep','Okt','Nov','Des'],

  formatDateInput(d) {
    return Utils.formatDate(d, 'yyyy-mm-dd');
  },

  slugify(str) {
    return String(str).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  },

  toggle(el, show) {
    if (el) el.classList.toggle('hidden', show === undefined ? undefined : !show);
  },

  setHTML(sel, html) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el) el.innerHTML = html;
  },

  getFormData(formEl) {
    const data = {};
    const fd = new FormData(formEl);
    fd.forEach((v, k) => { data[k] = v; });
    return data;
  },

  fillForm(formEl, data) {
    Object.entries(data).forEach(([k, v]) => {
      const el = formEl.querySelector(`[name="${k}"]`);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v ?? '';
    });
  },

  validate(data, rules) {
    const errors = {};
    Object.entries(rules).forEach(([field, rule]) => {
      if (rule.required && !data[field]) {
        errors[field] = `${rule.label || field} wajib diisi`;
      }
    });
    return errors;
  },

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  sortBy(arr, key, dir = 'asc') {
    return [...arr].sort((a, b) => {
      const va = a[key]; const vb = b[key];
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });
  },

  parseRupiah(str) {
    return parseInt(String(str).replace(/\D/g, '')) || 0;
  },

  /* ── Searchable combobox ──────────────────────────────────
     initCombo(inputEl, items, { onSelect, frequency })
     items     : string[] | {label, value, ...extra}[]
     frequency : { [value]: number } — higher = shown first
     Returns { destroy() }
  ─────────────────────────────────────────────────────────── */
  initCombo(inputEl, items, { onSelect, frequency } = {}) {
    // Destroy previous combo on same input to prevent DOM leak
    if (inputEl._comboHandle) { inputEl._comboHandle.destroy(); inputEl._comboHandle = null; }

    const norm    = arr => arr.map(i => typeof i === 'string' ? { label: i, value: i } : i);
    const entries = norm(items);
    const freq    = frequency || {};

    const drop = document.createElement('div');
    drop.className = 'becca-combo-drop';
    drop.style.cssText = 'position:fixed;z-index:99999;' +
      'background:var(--surface3,#2d3748);' +
      'border:1.5px solid var(--primary,#6366f1);border-radius:10px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.55);' +
      'overflow-y:auto;display:none;padding:4px';
    document.body.appendChild(drop);

    let activeIdx = 0;

    function _matches(q) {
      const lq = q.toLowerCase();
      const ms = entries.filter(e => e.label.toLowerCase().includes(lq));
      // Sort: starts-with first, then by frequency desc, then alphabetical
      ms.sort((a, b) => {
        const as = a.label.toLowerCase().startsWith(lq);
        const bs = b.label.toLowerCase().startsWith(lq);
        if (as !== bs) return as ? -1 : 1;
        const fd = (freq[b.value] || 0) - (freq[a.value] || 0);
        if (fd !== 0) return fd;
        return a.label.localeCompare(b.label);
      });
      return ms;
    }

    function _hl(q, text) {
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return text.replace(re, '<mark style="background:rgba(99,102,241,.45);color:#c7d2fe;font-weight:700;border-radius:2px;padding:0 1px">$1</mark>');
    }

    function _pos() {
      const r      = inputEl.getBoundingClientRect();
      const vh     = window.innerHeight;
      const gap    = 6;
      const w      = Math.max(r.width, 200);
      const maxH   = 240;
      const spBelow = Math.max(0, vh - r.bottom - gap);
      const spAbove = Math.max(0, r.top - gap);
      drop.style.left  = Math.min(r.left, Math.max(0, window.innerWidth - w - 8)) + 'px';
      drop.style.width = w + 'px';
      if (spBelow >= 100 || spBelow >= spAbove) {
        // Go below
        drop.style.maxHeight = Math.min(maxH, spBelow) + 'px';
        drop.style.top       = (r.bottom + gap) + 'px';
      } else {
        // Flip above — limit height to available space above
        const availH = Math.min(maxH, spAbove);
        drop.style.maxHeight = availH + 'px';
        drop.style.top       = (r.top - gap - Math.min(drop.offsetHeight || availH, availH)) + 'px';
      }
    }

    function _render(q) {
      const ms = _matches(q);
      if (!ms.length || !q.trim()) { _hide(); return; }
      activeIdx = 0;
      drop.innerHTML = ms.map((m, i) =>
        `<div class="bcc-i" data-i="${i}" style="padding:6px 10px;cursor:pointer;border-radius:6px;` +
        `font-size:11px;font-weight:600;line-height:1.4;` +
        `color:${i === 0 ? '#a5b4fc' : 'var(--text,#e2e8f0)'};` +
        `background:${i === 0 ? 'rgba(99,102,241,.22)' : 'transparent'}">${_hl(q.trim(), m.label)}` +
        (freq[m.value] > 1 ? `<span style="float:right;font-size:10px;font-weight:400;color:var(--text-3,#64748b);margin-left:8px">${freq[m.value]}×</span>` : '') +
        `</div>`
      ).join('');
      drop.style.visibility = 'hidden';
      drop.style.display    = 'block';
      _pos();
      drop.style.visibility = '';
      drop.querySelectorAll('.bcc-i').forEach(el => {
        el.addEventListener('mouseenter', () => { activeIdx = +el.dataset.i; _upd(); });
        el.addEventListener('mousedown',  e  => { e.preventDefault(); _pick(ms, +el.dataset.i); });
      });
    }

    function _upd() {
      drop.querySelectorAll('.bcc-i').forEach((el, i) => {
        el.style.background = i === activeIdx ? 'rgba(99,102,241,.22)' : '';
        el.style.color      = i === activeIdx ? '#a5b4fc' : 'var(--text,#e2e8f0)';
      });
    }

    function _pick(ms, idx) {
      const m = ms[idx]; if (!m) return;
      inputEl.value = m.label;
      _hide();
      if (onSelect) onSelect(m);
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function _hide() { drop.style.display = 'none'; activeIdx = 0; }

    function _onInput()  { _render(inputEl.value); }
    function _onFocus()  { if (inputEl.value.trim()) _render(inputEl.value); }
    function _onBlur()   { setTimeout(_hide, 160); }
    function _onKeyDown(e) {
      if (drop.style.display === 'none') return;
      const ms = _matches(inputEl.value);
      const n  = drop.querySelectorAll('.bcc-i').length;
      if (e.key === 'ArrowDown')  { e.preventDefault(); activeIdx = Math.min(activeIdx+1, n-1); _upd(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx-1, 0); _upd(); }
      else if (e.key === 'Enter') { if (ms[activeIdx]) { e.preventDefault(); e.stopPropagation(); _pick(ms, activeIdx); } }
      else if (e.key === 'Tab')   { if (ms[activeIdx]) _pick(ms, activeIdx); }
      else if (e.key === 'Escape') { e.preventDefault(); _hide(); }
    }

    inputEl.setAttribute('autocomplete', 'off');
    inputEl.addEventListener('input',   _onInput);
    inputEl.addEventListener('focus',   _onFocus);
    inputEl.addEventListener('blur',    _onBlur);
    inputEl.addEventListener('keydown', _onKeyDown);

    const handle = {
      destroy() {
        inputEl.removeEventListener('input',   _onInput);
        inputEl.removeEventListener('focus',   _onFocus);
        inputEl.removeEventListener('blur',    _onBlur);
        inputEl.removeEventListener('keydown', _onKeyDown);
        drop.remove();
        if (inputEl._comboHandle === handle) inputEl._comboHandle = null;
      }
    };
    inputEl._comboHandle = handle;
    return handle;
  },
});

/* ============================================
   BECCA V2.0 — Shared UI Helpers
   Reusable render functions for consistency
   ============================================ */
const UI = {
  /* ── Empty State ─────────────────────────────
     UI.empty({ icon, title, desc, action })
     icon:   SVG string (optional, defaults to generic box)
     title:  heading text
     desc:   description text
     action: { label, onclick, cls } (optional button)
  ──────────────────────────────────────────── */
  _emptyIcons: {
    box:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    list:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    search:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    money:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    order:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
    user:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    cart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
    check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    lock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    chart:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    news:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2z"/></svg>',
  },

  empty(opts = {}) {
    const icon = opts.icon || this._emptyIcons[opts.iconKey] || this._emptyIcons.box;
    const h = opts.height || '';
    const action = opts.action
      ? `<button class="btn ${opts.action.cls || 'btn-ghost btn-sm'}" onclick="${opts.action.onclick}" style="margin-top:var(--s3)">${opts.action.label}</button>`
      : '';
    return `<div class="empty-state"${h ? ` style="min-height:${h}"` : ''}>
      <div class="empty-icon">${icon}</div>
      <h4>${opts.title || 'Belum ada data'}</h4>
      ${opts.desc ? `<p>${opts.desc}</p>` : ''}
      ${action}
    </div>`;
  },

  /* ── Pagination ──────────────────────────────
     UI.pagination({ page, totalPages, total, perPage, perPageOptions, onPage, onPerPage })
     onPage:    JS expression string (receives page number), e.g. "Module.goPage"
     onPerPage: JS expression string (receives perPage number), e.g. "Module.setPerPage"
  ──────────────────────────────────────────── */
  pagination({ page, totalPages, total, perPage, perPageOptions, onPage, onPerPage, label }) {
    const tp = Math.max(1, totalPages || 1);
    const p  = Math.max(1, Math.min(page, tp));
    const opts = perPageOptions || [20, 50, 100];
    const lbl = label || 'baris';

    // Page numbers to show (max 5 centered around current)
    const pages = [];
    let start = Math.max(1, p - 2);
    let end   = Math.min(tp, start + 4);
    start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);

    return `<div class="pagination">
      <span class="pagination-info">Hal ${p}/${tp} · ${(total||0).toLocaleString('id')} ${lbl}</span>
      <div class="pagination-controls">
        <select class="per-page-select" onchange="${onPerPage}(+this.value)">
          ${opts.map(n => `<option value="${n}" ${perPage===n?'selected':''}>${n}/${lbl}</option>`).join('')}
        </select>
        <button class="page-btn page-nav" onclick="${onPage}(1)" ${p<=1?'disabled':''}>&laquo;</button>
        <button class="page-btn page-nav" onclick="${onPage}(${p-1})" ${p<=1?'disabled':''}>&lsaquo;</button>
        ${pages.map(n => `<button class="page-btn ${n===p?'active':''}" onclick="${onPage}(${n})">${n}</button>`).join('')}
        <button class="page-btn page-nav" onclick="${onPage}(${p+1})" ${p>=tp?'disabled':''}>&rsaquo;</button>
        <button class="page-btn page-nav" onclick="${onPage}(${tp})" ${p>=tp?'disabled':''}>&raquo;</button>
      </div>
    </div>`;
  },
};
window.UI = UI;
