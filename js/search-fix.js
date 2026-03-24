/* ============================================
   BECCA V2.0 — Global Search Fix
   Fix: search bar kehilangan focus setelah ketik 1 huruf
   karena setSearch() → _render() re-render seluruh halaman

   Cara kerja:
   - Debounce 180ms sebelum _render()
   - Restore focus + cursor position setelah render
   - Works untuk semua modul: Customer, AP, Employee, dll
============================================ */

(function _installSearchFix() {
  'use strict';

  const MODULES = [
    'CustomerModule',
    'APModule',
    'EmployeeModule',
    'TaskModule',
    'ReportModule',
    'KasKecilModule',
  ];

  function _patchModule(mod) {
    if (!mod || typeof mod.setSearch !== 'function') return;
    if (mod.__searchPatched) return; // jangan patch dua kali
    const _orig = mod.setSearch.bind(mod);
    let _timer = null;

    mod.setSearch = function(val) {
      clearTimeout(_timer);
      // Simpan nilai input dan posisi cursor sebelum render
      const activeInp = document.querySelector('[data-becca-search-active]');
      const savedPos  = activeInp ? activeInp.selectionStart : (val||'').length;

      _timer = setTimeout(() => {
        _orig(val);
        // Restore focus setelah render
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const newInp = document.querySelector(
            '[data-becca-search-active], ' +
            '.page.active input[placeholder*="Cari"], ' +
            '.page.active input[placeholder*="cari"], ' +
            '.page.active input[placeholder*="Filter"], ' +
            '.page.active input[placeholder*="filter"]'
          );
          if (newInp) {
            newInp.focus();
            try { newInp.setSelectionRange(savedPos, savedPos); } catch(e) {}
          }
        }));
      }, 180);
    };

    mod.__searchPatched = true;
  }

  // Patch semua modul yang sudah ada
  MODULES.forEach(name => { if (window[name]) _patchModule(window[name]); });

  // Mark input aktif saat focus
  document.addEventListener('focus', function(e) {
    if (e.target.tagName !== 'INPUT') return;
    const ph = (e.target.placeholder || '').toLowerCase();
    if (!ph.includes('cari') && !ph.includes('search') && !ph.includes('filter')) return;
    // Clear semua mark sebelumnya
    document.querySelectorAll('[data-becca-search-active]')
      .forEach(el => el.removeAttribute('data-becca-search-active'));
    e.target.setAttribute('data-becca-search-active', '1');
  }, true);

  document.addEventListener('blur', function(e) {
    if (e.target.hasAttribute && e.target.hasAttribute('data-becca-search-active')) {
      // Jangan hapus langsung — beri waktu 300ms untuk restore focus
      setTimeout(() => {
        if (document.activeElement !== e.target) {
          e.target.removeAttribute('data-becca-search-active');
        }
      }, 300);
    }
  }, true);

  // Re-patch modul yang di-load belakangan
  MODULES.forEach(name => {
    if (window[name]) return; // sudah ada
    Object.defineProperty(window, name, {
      configurable: true,
      set(mod) {
        Object.defineProperty(window, name, { configurable: true, writable: true, value: mod });
        _patchModule(mod);
      }
    });
  });

  console.log('[BECCA] Search fix installed ✅');
})();
