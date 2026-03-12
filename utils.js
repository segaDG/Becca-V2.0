/* ============================================
   BECCA V2.0 — Utils
   Helper functions used across all modules
   ============================================ */

const Utils = {

  /* === FORMAT === */
  formatRupiah(n, compact = false) {
    const num = Number(n) || 0;
    if (compact && num >= 1_000_000) return 'Rp ' + (num/1_000_000).toFixed(1) + 'jt';
    if (compact && num >= 1_000)     return 'Rp ' + (num/1_000).toFixed(0) + 'rb';
    return 'Rp ' + num.toLocaleString('id-ID');
  },

  formatDate(d, format = 'dd/mm/yyyy') {
    if (!d) return '-';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return '-';
    const dd   = String(dt.getDate()).padStart(2,'0');
    const mm   = String(dt.getMonth()+1).padStart(2,'0');
    const yyyy = dt.getFullYear();
    const mon  = this.MONTHS[dt.getMonth()];
    if (format === 'dd mmm yyyy') return `${dd} ${mon} ${yyyy}`;
    if (format === 'yyyy-mm-dd')  return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  },

  formatDateInput(d) {
    // untuk value input[type=date] → yyyy-mm-dd
    return this.formatDate(d, 'yyyy-mm-dd');
  },

  today() {
    return this.formatDate(new Date(), 'yyyy-mm-dd');
  },

  /* === ID & STRINGS === */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  },

  initials(name = '') {
    return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
  },

  slugify(str) {
    return str.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  },

  /* === CONSTANTS === */
  MONTHS: ['Januari','Februari','Maret','April','Mei','Juni',
           'Juli','Agustus','September','Oktober','November','Desember'],

  MONTHS_SHORT: ['Jan','Feb','Mar','Apr','Mei','Jun',
                 'Jul','Agu','Sep','Okt','Nov','Des'],

  /* === DOM HELPERS === */
  $: (sel, ctx = document) => ctx.querySelector(sel),
  $$: (sel, ctx = document) => [...ctx.querySelectorAll(sel)],

  show(el) { if (el) el.classList.remove('hidden'); },
  hide(el) { if (el) el.classList.add('hidden'); },
  toggle(el, show) {
    if (el) el.classList.toggle('hidden', show === undefined ? undefined : !show);
  },

  setHTML(sel, html) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el) el.innerHTML = html;
  },

  /* === FORM HELPERS === */
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
    // rules: { fieldName: { required: true, label: 'Nama' } }
    const errors = {};
    Object.entries(rules).forEach(([field, rule]) => {
      if (rule.required && !data[field]) {
        errors[field] = `${rule.label || field} wajib diisi`;
      }
    });
    return errors; // {} = valid
  },

  /* === MISC === */
  debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  clone(obj) { return JSON.parse(JSON.stringify(obj)); },

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  // Group array by key
  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = typeof key === 'function' ? key(item) : item[key];
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  },

  // Sort array
  sortBy(arr, key, dir = 'asc') {
    return [...arr].sort((a,b) => {
      const va = a[key]; const vb = b[key];
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });
  },

  // Number formatting
  parseRupiah(str) {
    return parseInt(String(str).replace(/\D/g,'')) || 0;
  },

  sumBy(arr, key) {
    return arr.reduce((s, i) => s + (Number(i[key]) || 0), 0);
  },

  // localStorage helpers
  ls: {
    get(k, def = null) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k)    { localStorage.removeItem(k); },
  },
};

window.Utils = Utils;
