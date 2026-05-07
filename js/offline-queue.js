/* ============================================
   BECCA V2.0 — Offline Queue
   Wraps DB.save*/delete* methods so offline writes are queued in
   localStorage and auto-flushed when network returns.
   - Optimistic: caller gets immediate response (data with id)
   - Dedup: same (fn, rowId) → keep last write only (last-write-wins)
   - Banner UI: shows pending count, hides when queue empty + online
   - Auto-flush on 'online' event + on app boot
============================================ */
const OfflineQueue = (() => {

  const KEY = 'becca_offline_queue';

  // Whitelist DB methods to wrap. Read methods (getXxx) NOT wrapped — they
  // already fall back to localStorage cache via DB.getCached().
  const SAVE_FNS = [
    'saveKas','saveKasMasuk','saveAP','saveSupplier',
    'saveInventoryLog','saveInventoryItem','saveOpnameLog',
    'saveEmployee','saveEmpAbsensi','saveEmpPayroll','saveEmpJadwal','saveEmpLog',
    'saveInvoice','saveOrder','saveCustomer','saveCustomerProfile','saveCustomerNote',
    'saveDailyOrderForm','savePO','saveBelanjaPasar',
    'saveTask','saveTaskComment',
    'saveSettings','saveMenu','saveMenuKomponen','saveDelivery','saveNews',
    'saveChatRoom','saveChatMessage',
    'savePushSubscription',
  ];
  const DELETE_FNS = [
    'deleteKas','deleteKasMasuk','deleteAP','deleteSupplier',
    'deleteInventoryLog','deleteInventoryItem','deleteOpnameLog',
    'deleteEmployee','deleteEmpAbsensi','deleteEmpPayroll','deleteEmpJadwal',
    'deleteInvoice','deleteOrder','deleteCustomer','deleteCustomerNote',
    'deleteDailyOrderForm','deletePO','deleteBelanjaPasar',
    'deleteTask','deleteTaskComment',
    'deleteMenu','deleteMenuKomponen','deleteDelivery','deleteNews',
    'deleteChatRoom','deleteChatMessage',
  ];

  let _queue = [];
  let _origs = {};       // {fnName: originalFunction}
  let _flushing = false;
  let _bannerEl = null;

  /* ─── PERSISTENCE ─── */
  function _load() {
    try { _queue = JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { _queue = []; }
    if (!Array.isArray(_queue)) _queue = [];
  }

  function _persist() {
    try { localStorage.setItem(KEY, JSON.stringify(_queue)); }
    catch (e) {
      // Quota exceeded — drop oldest 25% to make room
      console.warn('[OfflineQueue] localStorage full, trimming queue');
      _queue = _queue.slice(Math.floor(_queue.length * 0.25));
      try { localStorage.setItem(KEY, JSON.stringify(_queue)); } catch {}
    }
  }

  /* ─── ENQUEUE ─── */
  function _enqueue(fn, args) {
    const rowId = args?.[0]?.id || (typeof args?.[0] === 'string' ? args[0] : null);
    // Dedup: same (fn, rowId) → keep latest only (last-write-wins)
    if (rowId) {
      _queue = _queue.filter(q => !(q.fn === fn && q.rowId === rowId));
    }
    _queue.push({
      id:    'q_' + Date.now() + Math.random().toString(36).slice(2, 6),
      fn,
      args,
      rowId,
      ts:    Date.now(),
    });
    _persist();
    _updateBanner();
  }

  /* ─── WRAP DB METHODS ─── */
  function _isNetworkErr(e) {
    if (!e) return false;
    if (!navigator.onLine) return true;
    const m = (e.message || e.toString() || '').toLowerCase();
    return m.includes('failed to fetch')
        || m.includes('network')
        || m.includes('timeout')
        || m.includes('econnreset')
        || m.includes('connection');
  }

  function _wrap(fnName) {
    if (typeof DB === 'undefined' || typeof DB[fnName] !== 'function') return;
    if (DB[fnName]._oqWrapped) return;
    const orig = DB[fnName].bind(DB);
    _origs[fnName] = orig;
    const wrapped = async function(...args) {
      // OFFLINE → enqueue, return optimistic data
      if (!navigator.onLine) {
        const data = args[0];
        if (data && typeof data === 'object' && !data.id && typeof Utils !== 'undefined' && Utils.uid) {
          data.id = Utils.uid();
        }
        if (data && typeof data === 'object') {
          data._offlinePending = true;
        }
        _enqueue(fnName, args);
        if (typeof Notify !== 'undefined' && Notify.info) {
          // Throttle toast: max 1 per 3s
          const now = Date.now();
          if (!OfflineQueue._lastToast || now - OfflineQueue._lastToast > 3000) {
            OfflineQueue._lastToast = now;
            Notify.info('Tersimpan offline — akan auto-sync saat online');
          }
        }
        return data;
      }
      // ONLINE → try original; if network error, enqueue
      try {
        return await orig(...args);
      } catch (e) {
        if (_isNetworkErr(e)) {
          _enqueue(fnName, args);
          if (typeof Notify !== 'undefined' && Notify.warning) {
            Notify.warning('Network error — antrian offline');
          }
          return args[0];
        }
        throw e; // permission / validation / dll → re-throw
      }
    };
    wrapped._oqWrapped = true;
    DB[fnName] = wrapped;
  }

  function _wrapAll() {
    SAVE_FNS.forEach(_wrap);
    DELETE_FNS.forEach(_wrap);
  }

  /* ─── FLUSH ─── */
  async function flush() {
    if (_flushing) return;
    if (!navigator.onLine || !_queue.length) {
      _updateBanner();
      return;
    }
    _flushing = true;
    const total = _queue.length;
    let done = 0, failed = 0;
    _updateBanner();

    while (_queue.length > 0 && navigator.onLine) {
      const job = _queue[0];
      const orig = _origs[job.fn];
      if (!orig) {
        // Function not wrapped or removed — discard
        _queue.shift();
        _persist();
        continue;
      }
      try {
        await orig(...(job.args || []));
        _queue.shift();
        _persist();
        done++;
        _updateBanner('Sync ' + done + '/' + total + '...');
      } catch (e) {
        if (_isNetworkErr(e)) break; // stop, retry on next online event
        // Permanent error — log + discard
        console.warn('[OfflineQueue] permanent fail, drop:', job.fn, e?.message);
        _queue.shift();
        _persist();
        failed++;
      }
    }
    _flushing = false;
    _updateBanner();

    if (done > 0 && typeof Notify !== 'undefined' && Notify.success) {
      Notify.success(`Sinkronisasi selesai: ${done} perubahan${failed?` (${failed} gagal)`:''}`);
    }
  }

  /* ─── BANNER UI ─── */
  function _injectBannerCss() {
    if (document.getElementById('oq-banner-css')) return;
    const s = document.createElement('style');
    s.id = 'oq-banner-css';
    s.textContent = `
      #oq-banner{position:fixed;top:0;left:0;right:0;z-index:8000;
        padding:8px 14px;font-size:12px;font-weight:600;
        display:flex;align-items:center;justify-content:center;gap:8px;
        transform:translateY(-100%);transition:transform .25s ease;
        box-shadow:0 2px 8px rgba(0,0,0,.12)}
      #oq-banner.show{transform:translateY(0)}
      #oq-banner.offline{background:#fbbf24;color:#451a03}
      #oq-banner.syncing{background:#6366f1;color:#fff}
      #oq-banner.pending{background:#f59e0b;color:#451a03}
      #oq-banner .oq-spin{display:inline-block;width:12px;height:12px;
        border:2px solid currentColor;border-right-color:transparent;
        border-radius:50%;animation:oq-spin .7s linear infinite}
      @keyframes oq-spin{to{transform:rotate(360deg)}}
      body.oq-banner-shown{padding-top:36px;transition:padding-top .25s ease}
    `;
    document.head.appendChild(s);
  }

  function _updateBanner(syncMsg) {
    if (!document.body) return;
    _injectBannerCss();
    if (!_bannerEl) {
      _bannerEl = document.createElement('div');
      _bannerEl.id = 'oq-banner';
      _bannerEl.setAttribute('role', 'status');
      _bannerEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(_bannerEl);
    }
    const offline = !navigator.onLine;
    const pendingCt = _queue.length;
    let show = false;
    let cls = '';
    let html = '';
    if (syncMsg) {
      show = true; cls = 'syncing';
      html = `<span class="oq-spin"></span> ${syncMsg}`;
    } else if (offline && pendingCt) {
      show = true; cls = 'offline';
      html = `⚠ Offline — ${pendingCt} perubahan tertunda, akan auto-sync saat online`;
    } else if (offline) {
      show = true; cls = 'offline';
      html = '⚠ Offline — perubahan akan tersimpan lokal & sync saat online';
    } else if (pendingCt) {
      show = true; cls = 'pending';
      html = `<span class="oq-spin"></span> Menyinkronkan ${pendingCt} perubahan...`;
      // Auto-flush in case missed
      if (!_flushing) setTimeout(flush, 100);
    }
    _bannerEl.className = show ? `show ${cls}` : '';
    _bannerEl.innerHTML = html;
    document.body.classList.toggle('oq-banner-shown', show);
  }

  /* ─── PUBLIC API ─── */
  function pendingCount() { return _queue.length; }
  function clearPending() {
    _queue = [];
    _persist();
    _updateBanner();
  }
  function getQueue() { return _queue.slice(); }

  /* ─── INIT ─── */
  function init() {
    _load();
    if (typeof DB === 'undefined') {
      // DB not loaded yet — retry shortly
      setTimeout(init, 200);
      return;
    }
    _wrapAll();
    window.addEventListener('online',  () => { _updateBanner(); flush(); });
    window.addEventListener('offline', () => _updateBanner());
    // Initial: show banner state + try flush
    setTimeout(() => { _updateBanner(); if (navigator.onLine && _queue.length) flush(); }, 500);
  }

  return { init, flush, pendingCount, clearPending, getQueue };
})();
window.OfflineQueue = OfflineQueue;

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => OfflineQueue.init());
} else {
  OfflineQueue.init();
}
