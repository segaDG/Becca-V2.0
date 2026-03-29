/* ============================================
   BECCA V2.0 — Utils Extensions
   Load setelah utils.js — tambahkan metode extra
   ============================================ */

Object.assign(Utils, {

  MONTHS_SHORT: ['Jan','Feb','Mar','Apr','Mei','Jun',
                 'Jul','Agu','Sep','Okt','Nov','Des'],

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

  formatNumber(n) {
    return (parseFloat(n) || 0).toLocaleString('id-ID');
  },

  /* ── Searchable combobox ──────────────────────────────────
     initCombo(inputEl, items, { onSelect, frequency })
     items     : string[] | {label, value, ...extra}[]
     frequency : { [value]: number } — higher = shown first
     Returns { destroy() }
  ─────────────────────────────────────────────────────────── */
  initCombo(inputEl, items, { onSelect, frequency } = {}) {
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

    return {
      destroy() {
        inputEl.removeEventListener('input',   _onInput);
        inputEl.removeEventListener('focus',   _onFocus);
        inputEl.removeEventListener('blur',    _onBlur);
        inputEl.removeEventListener('keydown', _onKeyDown);
        drop.remove();
      }
    };
  },
});
