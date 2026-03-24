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
});
