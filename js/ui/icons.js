/* ============================================
   BECCA V2.0 — SVG Icon Sprite
   Sekali inject <symbol> ke DOM, pakai berulang via <use href="#i-name">.
   Mengurangi duplikasi path SVG ribuan kali → HTML lebih ringan +
   parse lebih cepat. Modul lama bisa migrasi bertahap.
============================================ */
const Icons = (() => {
  'use strict';

  // Definisi paths (stroke-based, 24x24 viewBox). Tambah baru kalau perlu.
  const PATHS = {
    search:   '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    plus:     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit:     '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash:    '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    check:    '<polyline points="20 6 9 17 4 12"/>',
    x:        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'chev-down': '<polyline points="6 9 12 15 18 9"/>',
    'chev-up':   '<polyline points="18 15 12 9 6 15"/>',
    'chev-left': '<polyline points="15 18 9 12 15 6"/>',
    'chev-right':'<polyline points="9 18 15 12 9 6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    user:     '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users:    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    home:     '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    bell:     '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    print:    '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    refresh:  '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    filter:   '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    eye:      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  };

  let _injected = false;

  function _inject() {
    if (_injected || typeof document === 'undefined') return;
    _injected = true;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
      ${Object.entries(PATHS).map(([name, body]) =>
        `<symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`
      ).join('')}
    </svg>`;
    document.body.appendChild(wrap);
  }

  /**
   * Render <svg><use href="#i-name"/></svg> markup.
   * Hemat: parse SVG cuma 1x (di sprite). Tiap <use> hanya pointer ringan.
   *
   * @param {string} name  — nama icon dari PATHS
   * @param {object} opts  — size (px), color (currentColor default), strokeWidth, title
   */
  function use(name, opts = {}) {
    if (!PATHS[name]) { console.warn('[Icons] unknown:', name); return ''; }
    _inject();
    const size = opts.size || 16;
    const stroke = opts.strokeWidth || 2;
    const color = opts.color || 'currentColor';
    const title = opts.title ? `<title>${opts.title}</title>` : '';
    return `<svg width="${size}" height="${size}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true">${title}<use href="#i-${name}"/></svg>`;
  }

  function list() { return Object.keys(PATHS); }
  function has(name) { return !!PATHS[name]; }

  // Auto-inject saat DOM ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _inject, { once: true });
    } else {
      _inject();
    }
  }

  return { use, list, has, _inject };
})();
window.Icons = Icons;
