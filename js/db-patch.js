/* ============================================================
   BECCA V2.0 — DB Patch (Performance & Cleanup)
   Di-load setelah db.js, sebelum auth.js.
   Otomatis bersihkan localStorage bloat setiap halaman di-load.
   ============================================================ */

(function () {
  'use strict';

  // Keys junk yang SELALU dihapus saat load
  var JUNK_PREFIXES = ['_sc_', 'becca_becca_', 'becca_presence_'];
  var JUNK_EXACT = [
    '_iv0', '_settingsChunks', 'becca_logo',
    'becca_kas_locked_ids', 'becca_inv_locked_ids', 'becca_lb_locked_ids',
    'becca_inv_locked', 'becca_online_sessions', 'becca_activity_logs',
  ];

  // Keys besar yang isinya di-cache dari Supabase — dikosongkan jika terlalu besar
  // (DB._get() akan fetch ulang dari Supabase saat dibutuhkan)
  var BIG_CACHE_KEYS = [
    'becca_emp_logs',        // selalu flush — bisa 170KB+
  ];
  // Keys yang di-flush hanya jika melebihi threshold (bytes)
  // Max total localStorage = 5MB, so keep each key under 200KB
  var BIG_CACHE_THRESHOLD = [
    { key: 'becca_inv_activities',    limit: 200000 },
    { key: 'becca_daily_order_forms', limit: 200000 },
    { key: 'becca_employees',         limit: 200000 },
    { key: 'becca_kas',               limit: 200000 },
    { key: 'becca_ap',                limit: 200000 },
    { key: 'becca_orders',            limit: 200000 },
    { key: 'becca_invoices',          limit: 200000 },
    { key: 'becca_chat_messages',     limit: 100000 },
    { key: 'becca_inv_products',      limit: 200000 },
    { key: 'becca_backups',           limit: 10 },      // old oversized backup — always remove
    { key: 'becca_backup_latest',     limit: 500000 },
  ];

  function cleanupLocalStorage() {
    var before = _lsSize();

    // 1. Hapus junk exact keys
    JUNK_EXACT.forEach(function(k) { localStorage.removeItem(k); });

    // 2. Hapus junk prefix keys
    Object.keys(localStorage).forEach(function(k) {
      if (JUNK_PREFIXES.some(function(p) { return k.indexOf(p) === 0; })) {
        localStorage.removeItem(k);
      }
    });

    // 3a. Selalu kosongkan big-cache keys
    BIG_CACHE_KEYS.forEach(function(k) {
      if (localStorage.getItem(k)) localStorage.setItem(k, '[]');
    });

    // 3b. Kosongkan threshold-based keys hanya jika terlalu besar
    BIG_CACHE_THRESHOLD.forEach(function(entry) {
      var val = localStorage.getItem(entry.key);
      if (val && val.length > entry.limit) {
        console.log('[DB-Patch] Cleared oversized cache: ' + entry.key + ' (' + (val.length/1024).toFixed(0) + 'KB)');
        localStorage.setItem(entry.key, '[]');
      }
    });

    // 4. Strip base64 photos from employee cache (huge — photos are in Supabase)
    _stripPhotosFromCache('becca_employees', ['fotoUrl','ktpUrl','faceDescriptors']);
    _stripPhotosFromCache('becca_chat_messages', ['mediaUrl']);

    // 5. Bersihkan settings dari corrupt nested/base64 data
    _cleanSettings();
    _stripLogo();

    var after = _lsSize();
    var freed = ((before - after) / 1024).toFixed(1);
    if (parseFloat(freed) > 1) {
      console.log('[DB-Patch] Freed ' + freed + 'KB from localStorage (' + after + ' bytes remaining)');
    }
    return { freed_kb: freed, before: before, after: after };
  }

  function _stripPhotosFromCache(key, fields) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw || raw.length < 100000) return; // only strip if > 100KB
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      var changed = false;
      arr.forEach(function(item) {
        fields.forEach(function(f) {
          if (item[f] && typeof item[f] === 'string' && item[f].length > 1000) {
            delete item[f]; changed = true;
          }
        });
      });
      if (changed) localStorage.setItem(key, JSON.stringify(arr));
    } catch(e) {}
  }

  function _cleanSettings() {
    try {
      var raw = localStorage.getItem('becca_settings');
      if (!raw) return;
      var s = JSON.parse(raw);
      if (typeof s !== 'object' || Array.isArray(s)) {
        localStorage.setItem('becca_settings', '{}'); return;
      }
      var dirty = false;
      var clean = {};
      Object.keys(s).forEach(function(k) {
        if (!isNaN(k)) { dirty = true; return; }
        if (k === 'logoUrl' && typeof s[k] === 'string' && s[k].indexOf('data:') === 0) {
          dirty = true; return;
        }
        clean[k] = s[k];
      });
      if (dirty) localStorage.setItem('becca_settings', JSON.stringify(clean));
    } catch(e) { localStorage.setItem('becca_settings', '{}'); }
  }

  function _stripLogo() {
    try {
      var raw = localStorage.getItem('becca_settings');
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s && s.logoUrl && s.logoUrl.indexOf('data:') === 0) {
        delete s.logoUrl;
        localStorage.setItem('becca_settings', JSON.stringify(s));
      }
    } catch(e) {}
  }

  // Patch DB.getSettings: jangan cache logoUrl base64 ke localStorage
  function _patchGetSettings() {
    if (!window.DB || typeof window.DB.getSettings !== 'function') return;
    var _orig = window.DB.getSettings.bind(window.DB);
    window.DB.getSettings = async function() {
      var result = await _orig();
      if (result && result.logoUrl && result.logoUrl.indexOf('data:') === 0) {
        var forLS = Object.assign({}, result);
        delete forLS.logoUrl;
        try { localStorage.setItem('becca_settings', JSON.stringify(forLS)); } catch(e) {}
        return result; // tetap return lengkap (dengan logo) ke app
      }
      return result;
    };
  }

  function _lsSize() {
    try { return JSON.stringify(localStorage).length; } catch(e) { return 0; }
  }

  function _autoRun() {
    cleanupLocalStorage();
    // Patch getSettings setelah DB ready
    if (window.DB && window.DB.isReady && window.DB.isReady()) {
      _patchGetSettings();
    } else {
      var tries = 0;
      var poll = setInterval(function() {
        tries++;
        if ((window.DB && window.DB.isReady && window.DB.isReady()) || tries > 20) {
          clearInterval(poll);
          _patchGetSettings();
        }
      }, 300);
    }
  }

  // Expose ke global untuk bisa dipanggil manual dari console
  window.BECCA_Cleanup = cleanupLocalStorage;

  // Jalankan otomatis
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoRun);
  } else {
    _autoRun();
  }

})();
