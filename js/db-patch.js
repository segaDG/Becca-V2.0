/* ============================================================
   BECCA V2.0 — DB Patch (Performance & Cleanup)
   Di-load setelah db.js, sebelum auth.js
   ============================================================ */

(function () {
  'use strict';

  var JUNK_PREFIXES = ['_sc_', 'becca_becca_', 'becca_presence_'];
  var JUNK_EXACT = [
    '_iv0', '_settingsChunks', 'becca_logo',
    'becca_kas_locked_ids', 'becca_inv_locked_ids', 'becca_lb_locked_ids',
    'becca_inv_locked', 'becca_online_sessions', 'becca_activity_logs',
  ];

  function cleanupLocalStorage() {
    var before = _lsSize();
    JUNK_EXACT.forEach(function(k) { localStorage.removeItem(k); });
    Object.keys(localStorage).forEach(function(k) {
      if (JUNK_PREFIXES.some(function(p) { return k.indexOf(p) === 0; })) {
        localStorage.removeItem(k);
      }
    });
    _cleanSettings();
    _stripLogo();
    var after = _lsSize();
    var freed = ((before - after) / 1024).toFixed(1);
    if (parseFloat(freed) > 1) console.log('[DB-Patch] Freed ' + freed + 'KB from localStorage');
    return { freed_kb: freed };
  }

  function _cleanSettings() {
    try {
      var raw = localStorage.getItem('becca_settings');
      if (!raw) return;
      var s = JSON.parse(raw);
      if (typeof s !== 'object' || Array.isArray(s)) { localStorage.setItem('becca_settings', '{}'); return; }
      var dirty = false;
      var clean = {};
      Object.keys(s).forEach(function(k) {
        if (!isNaN(k)) { dirty = true; return; }
        if (k === 'logoUrl' && typeof s[k] === 'string' && s[k].indexOf('data:') === 0) { dirty = true; return; }
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

  function _patchGetSettings() {
    if (!window.DB || typeof window.DB.getSettings !== 'function') return;
    var _orig = window.DB.getSettings.bind(window.DB);
    window.DB.getSettings = async function() {
      var result = await _orig();
      if (result && result.logoUrl && result.logoUrl.indexOf('data:') === 0) {
        var forLS = Object.assign({}, result);
        delete forLS.logoUrl;
        try { localStorage.setItem('becca_settings', JSON.stringify(forLS)); } catch(e) {}
        return result;
      }
      return result;
    };
  }

  function _lsSize() {
    try { return JSON.stringify(localStorage).length; } catch(e) { return 0; }
  }

  function _autoRun() {
    cleanupLocalStorage();
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

  window.BECCA_Cleanup = cleanupLocalStorage;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoRun);
  } else {
    _autoRun();
  }

})();
