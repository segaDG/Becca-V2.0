// BECCA Settings Header Patch
// Include ini di index.html setelah settings.js
// <script src="js/settings-patch.js"></script>

(function() {
  'use strict';
  
  function fixSettingsHeader() {
    var page = document.getElementById('page-settings');
    if (!page) return;
    var thead = page.querySelector('table thead tr');
    if (!thead || thead.dataset.beccaPatched) return;
    
    // Apply background dan style ke semua th
    thead.setAttribute('style', 'background:var(--primary-h)');
    Array.from(thead.querySelectorAll('th')).forEach(function(th) {
      th.setAttribute('style',
        'background:var(--primary-h);color:#fff;padding:8px 10px;' +
        'font-weight:700;font-size:11px;text-transform:uppercase;' +
        'letter-spacing:.05em;white-space:nowrap;' +
        'border-bottom:2px solid rgba(255,255,255,.1)');
      // Rename Status → Password
      if (th.textContent.trim() === 'Status') th.textContent = 'Password';
    });
    thead.dataset.beccaPatched = '1';
  }

  // Hook SettingsModule setelah semua script selesai load
  window.addEventListener('load', function() {
    if (!window.SettingsModule) return;
    
    var origSwitch = SettingsModule.switchTab;
    SettingsModule.switchTab = function(tab) {
      if (origSwitch) origSwitch.apply(this, arguments);
      if (tab === 'users') setTimeout(fixSettingsHeader, 40);
    };
    
    var origInit = SettingsModule.init;
    SettingsModule.init = function() {
      if (origInit) origInit.apply(this, arguments);
      setTimeout(fixSettingsHeader, 40);
    };
    
    // Observer untuk catch setiap re-render
    var obs = new MutationObserver(fixSettingsHeader);
    var pg = document.getElementById('page-settings');
    if (pg) obs.observe(pg, {childList: true, subtree: false});
    
    setTimeout(fixSettingsHeader, 200);
  });
})();
