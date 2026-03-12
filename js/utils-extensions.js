/* ============================================
   BECCA V2.0 — Utils Extensions
   Tambahkan ke utils.js atau load setelah utils.js
   ============================================ */

Object.assign(Utils, {

  MONTHS: ['Januari','Februari','Maret','April','Mei','Juni',
           'Juli','Agustus','September','Oktober','November','Desember'],

  // Group array of objects by key
  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = item[key] ?? '__other';
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  },

  // Sum a numeric key from array
  sumBy(arr, key) {
    return arr.reduce((s, item) => s + (parseFloat(item[key]) || 0), 0);
  },

  // Initials from name
  initials(nama = '') {
    return nama.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('');
  },

  // Today as yyyy-mm-dd
  today() {
    return new Date().toISOString().split('T')[0];
  },

  // Format date (string yyyy-mm-dd or Date object)
  formatDate(d, fmt = 'dd/mm/yyyy') {
    if (!d) return '-';
    const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
    if (isNaN(dt)) return d;
    const dd  = String(dt.getDate()).padStart(2,'0');
    const mm  = String(dt.getMonth()+1).padStart(2,'0');
    const yyyy= dt.getFullYear();
    const mmm = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][dt.getMonth()];
    if (fmt==='dd mmm yyyy') return `${dd} ${mmm} ${yyyy}`;
    if (fmt==='dd/mm/yyyy')  return `${dd}/${mm}/${yyyy}`;
    if (fmt==='yyyy-mm-dd')  return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  },

  // Format Rupiah
  formatRupiah(n, compact = false) {
    n = parseFloat(n) || 0;
    if (compact) {
      if (Math.abs(n) >= 1e9) return 'Rp ' + (n/1e9).toFixed(1).replace('.0','') + 'M';
      if (Math.abs(n) >= 1e6) return 'Rp ' + (n/1e6).toFixed(1).replace('.0','') + 'jt';
      if (Math.abs(n) >= 1e3) return 'Rp ' + (n/1e3).toFixed(0) + 'rb';
      return 'Rp ' + n.toLocaleString('id-ID');
    }
    return 'Rp ' + n.toLocaleString('id-ID');
  },

  // Generate UID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  },

  // DOM helpers
  $(sel, ctx = document) { return ctx.querySelector(sel); },
  $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; },

  // localStorage helpers
  ls: {
    get(key) { try { return JSON.parse(localStorage.getItem('becca_'+key)); } catch { return null; } },
    set(key, val) { localStorage.setItem('becca_'+key, JSON.stringify(val)); },
    del(key) { localStorage.removeItem('becca_'+key); },
  },
});
