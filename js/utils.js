/* ============================================
   BECCA V2.0 — Utils
   Helper functions (includes utils-extensions)
   ============================================ */

const Utils = {

  MONTHS: ['Januari','Februari','Maret','April','Mei','Juni',
           'Juli','Agustus','September','Oktober','November','Desember'],

  // Parse number — handles Indonesian format "3.000" = 3000, "1.500,5" = 1500.5
  parseNum(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    let s = String(v).replace(/[Rp\s\u00a0]/g, '');
    // Indonesian: dots as thousand sep, comma as decimal → "1.000.500,5"
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    // Indonesian without decimal: "3.000" "50.000"
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    // Comma as decimal only: "1500,5"
    else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');
    return parseFloat(s) || 0;
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
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  },

  // Format Date
  formatDate(d, fmt = 'dd/mm/yyyy') {
    if (!d) return '-';
    const dt = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
    if (isNaN(dt)) return d;
    const dd   = String(dt.getDate()).padStart(2, '0');
    const mm   = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const mmm  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][dt.getMonth()];
    if (fmt === 'dd mmm yyyy') return `${dd} ${mmm} ${yyyy}`;
    if (fmt === 'dd/mm/yyyy')  return `${dd}/${mm}/${yyyy}`;
    if (fmt === 'yyyy-mm-dd')  return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  },

  // Today as yyyy-mm-dd
  today() {
    return new Date().toISOString().split('T')[0];
  },

  // Generate UID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // Initials from name
  initials(nama = '') {
    return nama.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  },

  // Group array by key
  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const k = item[key] ?? '__other';
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  },

  // Sum a numeric key
  sumBy(arr, key) {
    return arr.reduce((s, item) => s + (parseFloat(item[key]) || 0), 0);
  },

  // DOM helpers
  $(sel, ctx = document) { return ctx.querySelector(sel); },
  $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; },

  show(el) { if (el) el.style.display = ''; },
  hide(el) { if (el) el.style.display = 'none'; },

  // localStorage helpers
  ls: {
    get(key)      { try { return JSON.parse(localStorage.getItem('becca_' + key)); } catch { return null; } },
    set(key, val) { localStorage.setItem('becca_' + key, JSON.stringify(val)); },
    del(key)      { localStorage.removeItem('becca_' + key); },
  },

  // Number format
  formatNumber(n) {
    return (parseFloat(n) || 0).toLocaleString('id-ID');
  },

  // Debounce
  debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  // Deep clone
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // HTML escape
  esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  },

  /** Sanitize string input — strip HTML tags, trim whitespace */
  sanitize(s) {
    if (typeof s !== 'string') return s;
    return s.replace(/<[^>]*>/g, '').trim();
  },

  /** Sanitize all string fields in an object */
  sanitizeObj(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    Object.keys(obj).forEach(k => {
      if (typeof obj[k] === 'string' && k !== 'password' && k !== 'fotoUrl' && k !== 'ktpUrl' && k !== 'mediaUrl' && k !== 'logoUrl') {
        obj[k] = Utils.sanitize(obj[k]);
      }
    });
    return obj;
  },

  /** Merge existing record fields into data — prevents data loss on form edit.
   *  Only copies keys from `existing` that are NOT already in `data`. */
  mergePreserve(data, existing) {
    if (!existing || typeof existing !== 'object') return data;
    Object.keys(existing).forEach(k => { if (!(k in data)) data[k] = existing[k]; });
    return data;
  },

  /** URL state helper — sync filter/page state with URL query params.
   *
   *  Pattern di module:
   *    init() {
   *      const restored = Utils.urlState.read('kas', ['bulan','type','status']);
   *      Object.assign(_filter, restored);
   *    }
   *    setFilter(k,v) {
   *      _filter[k] = v;
   *      Utils.urlState.write('kas', _filter);
   *    }
   *
   *  URL format: ?<ns>_<key>=<value> (e.g. ?kas_bulan=Apr&kas_type=Gaji)
   *  history.replaceState() — tidak nambah history entry, jadi back button tetap normal.
   */
  urlState: {
    read(namespace, whitelist) {
      const out = {};
      try {
        const params = new URLSearchParams(location.search);
        const prefix = namespace + '_';
        const list = Array.isArray(whitelist) ? whitelist : null;
        params.forEach((v, k) => {
          if (!k.startsWith(prefix)) return;
          const key = k.slice(prefix.length);
          if (list && !list.includes(key)) return;
          if (v !== '') out[key] = v;
        });
      } catch {}
      return out;
    },
    write(namespace, state) {
      try {
        // Skip if user navigated away from this module's page (avoid clobbering)
        if (typeof App !== 'undefined' && App._currentPage && App._currentPage !== namespace) return;
        const params = new URLSearchParams(location.search);
        const prefix = namespace + '_';
        [...params.keys()].forEach(k => { if (k.startsWith(prefix)) params.delete(k); });
        if (state && typeof state === 'object') {
          Object.entries(state).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '') return;
            params.set(prefix + k, String(v));
          });
        }
        const qs = params.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      } catch {}
    },
    clear(namespace) {
      try {
        const params = new URLSearchParams(location.search);
        const prefix = namespace + '_';
        [...params.keys()].forEach(k => { if (k.startsWith(prefix)) params.delete(k); });
        const qs = params.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      } catch {}
    },
  },

  /** Generate skeleton-loader HTML untuk tbody — N rows × M cols with shimmer animation.
   *  Pattern: <tr><td><div class="skeleton skeleton-text"></div></td>...</tr> × N
   *  Width tiap cell variabel agar terlihat lebih natural (bukan grid kaku).
   *
   *  Pakai: tbody.innerHTML = Utils.skeletonRows(11, 8);
   *  CSS .skeleton sudah ada di components.css.
   */
  skeletonRows(cols, rows) {
    const numCols = parseInt(cols) || 5;
    const numRows = parseInt(rows) || 8;
    const widths = ['80%','60%','45%','70%','55%','65%','50%','75%','40%','85%']; // variasi natural
    let html = '';
    for (let r = 0; r < numRows; r++) {
      html += '<tr>';
      for (let c = 0; c < numCols; c++) {
        const w = widths[(r + c) % widths.length];
        html += `<td><div class="skeleton skeleton-text" style="width:${w};height:12px"></div></td>`;
      }
      html += '</tr>';
    }
    return html;
  },

  /** Skeleton card placeholder — untuk dashboard summary cards saat loading. */
  skeletonCard(opts = {}) {
    const w = opts.width || '100%';
    const h = opts.height || '60px';
    return `<div class="skeleton" style="width:${w};height:${h};border-radius:var(--r-md);margin-bottom:var(--s2)"></div>`;
  },

  /** Normalize Indonesian phone → format wa.me-compatible (628xxx).
   *  Input: "08123456789", "0812-3456-7890", "+628123456789", "8123456789"
   *  Output: "628123456789" (no +, no spaces, no dashes)
   *  Returns empty string if input doesn't look like a phone.
   */
  normalizePhone(input) {
    if (!input) return '';
    let s = String(input).replace(/[^\d+]/g, '');
    if (!s) return '';
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('62')) return s;
    if (s.startsWith('0')) return '62' + s.slice(1);
    if (s.startsWith('8')) return '62' + s; // local format without leading zero
    return s;
  },

  /** Open WhatsApp with pre-filled message via wa.me deeplink.
   *  Pattern: https://wa.me/<phone>?text=<encoded-message>
   *  - phone: any Indonesian format (auto-normalized)
   *  - message: plain text, will be URL-encoded
   *  If phone empty/invalid, opens wa.me/?text=... (user picks contact in WA).
   *  Returns true if window.open succeeded.
   */
  waShare(phone, message) {
    const num = Utils.normalizePhone(phone);
    const text = encodeURIComponent(String(message || ''));
    const url = num
      ? `https://wa.me/${num}?text=${text}`
      : `https://wa.me/?text=${text}`;
    try {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      return !!w;
    } catch { return false; }
  },

  /**
   * Relative time string in Indonesian.
   * timeAgo('2026-05-07T08:00:00Z') → "5 menit lalu" / "2 jam lalu" / dst
   */
  timeAgo(ts) {
    if (!ts) return '';
    const t = new Date(ts).getTime();
    if (!Number.isFinite(t)) return '';
    const diff = Math.max(0, (Date.now() - t) / 1000);
    if (diff < 30)      return 'baru saja';
    if (diff < 60)      return Math.floor(diff) + ' detik lalu';
    if (diff < 3600)    return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400)   return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 604800)  return Math.floor(diff / 86400) + ' hari lalu';
    if (diff < 2592000) return Math.floor(diff / 604800) + ' minggu lalu';
    return new Date(ts).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'});
  },
};

window.Utils = Utils;
