/* ============================================================
   BECCA V2.0 — DB Extensions (Supabase Realtime)
   Setup realtime listeners, user online, auto-refresh modules
   ============================================================ */

const DBExtensions = (() => {
  'use strict';

  let _presenceInterval = null;
  let _initialized = false;

  /* ── Start realtime & presence ────────────────────────────── */
  async function init() {
    if (_initialized) return;
    _initialized = true;

    // Wait for DB to be ready
    await DB.init();

    if (!DB.isReady()) {
      console.log('[DBExt] Supabase not ready — realtime disabled');
      return;
    }

    _setupPresence();
    _setupRealtime();
    console.log('[DBExt] Realtime & Presence initialized ✓');
  }

  /* ── Presence: update "user online" setiap 15 detik ─────── */
  function _setupPresence() {
    const u = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
    if (!u) return;

    const updateNow = () => DB.updatePresence(u.username || u.id, {
      username:  u.username,
      nama:      u.nama,
      role:      u.role,
      sessionId: u.sessionId || sessionStorage.getItem('becca_session_id') || Utils.uid(),
    });

    updateNow();
    _presenceInterval = setInterval(updateNow, 15000);

    // Update online users badge di header
    _refreshOnlineBadge();
    setInterval(_refreshOnlineBadge, 20000);
  }

  async function _refreshOnlineBadge() {
    try {
      const online = await DB.getOnlineUsers(60000);

      // Deduplicate: 1 user = 1 entry (ambil yang last_seen paling baru)
      const seen = {};
      online.forEach(u => {
        const key = (u.username || u.id || '').toLowerCase();
        const existing = seen[key];
        const uTime = u.last_seen ? new Date(u.last_seen).getTime() : 0;
        const eTime = existing?.last_seen ? new Date(existing.last_seen).getTime() : 0;
        if (!existing || uTime > eTime) seen[key] = u;
      });
      const unique = Object.values(seen);

      // Update header badge
      const badge = document.getElementById('online-users-badge');
      if (badge) {
        badge.textContent = unique.length;
        badge.title = unique.map(u => u.nama || u.username).join(', ');
        badge.style.display = unique.length > 0 ? 'flex' : 'none';
      }

      // Update header indicator "X online"
      const indicator = document.getElementById('online-indicator');
      if (indicator) {
        indicator.textContent = unique.length + ' online';
        indicator.style.display = 'inline';
      }

      // Simpan ke window untuk dipakai modal
      window._onlineUsers = unique;
    } catch(e) {
      console.warn('[DBExt] presence error:', e.message);
    }
  }

  /* ── Realtime: auto-refresh modul saat data berubah ──────── */
  function _setupRealtime() {
    DB.setupRealtime({
      orders: ({ eventType }) => {
        _notify('order', eventType);
        if (window.App?.currentPage === 'order') {
          setTimeout(() => OrderModule?.init?.(), 300);
        }
        // Update dashboard stats
        if (window.App?.currentPage === 'dashboard') {
          setTimeout(() => DashboardModule?.init?.(), 300);
        }
      },

      invoices: ({ eventType }) => {
        _notify('invoice', eventType);
        if (window.App?.currentPage === 'invoice') {
          setTimeout(() => InvoiceModule?.init?.(), 300);
        }
      },

      tasks: ({ eventType, new: newRow }) => {
        if (window.App?.currentPage === 'task') {
          setTimeout(() => TaskModule?.render?.(), 200);
        }
        // Notif jika task di-assign ke user ini
        _checkTaskNotif(newRow, eventType);
      },

      customers: ({ eventType }) => {
        if (window.App?.currentPage === 'customer') {
          setTimeout(() => CustomerModule?.init?.(), 300);
        }
      },

      users: ({ eventType }) => {
        // User baru ditambah — refresh auth list
        console.log('[RT] Users changed:', eventType);
      },

      settings: ({ eventType }) => {
        // Settings berubah di device lain
        console.log('[RT] Settings changed:', eventType);
      },

      presence: () => {
        _refreshOnlineBadge();
      },

      activity_logs: () => {
        if (window.App?.currentPage === 'settings') {
          const tab = document.querySelector('[onclick*="activity"]');
          if (tab?.classList?.contains('active')) {
            setTimeout(() => SettingsModule?.switchTab?.('activity'), 200);
          }
        }
      },
    });
  }

  /* ── Realtime notification toast ────────────────────────── */
  function _notify(type, eventType) {
    if (eventType === 'INSERT') {
      const labels = { order:'Order baru masuk', invoice:'Invoice baru', task:'Task baru' };
      const label  = labels[type];
      if (label && typeof Notify !== 'undefined') {
        Notify.info(label + ' — ' + new Date().toLocaleTimeString('id'));
      }
    }
  }

  /* ── Cek apakah ada task baru yang di-assign ke user ini ─── */
  function _checkTaskNotif(row, eventType) {
    if (eventType !== 'INSERT' || !row) return;
    const u = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
    if (!u) return;

    let assignees = [];
    try { assignees = JSON.parse(row.assignees || '[]'); } catch {}
    if (row.assignee) assignees.push(row.assignee);

    const mn = (u.nama     || '').toLowerCase();
    const mu = (u.username || '').toLowerCase();
    const isMe = assignees.some(a => {
      const al = (a || '').toLowerCase();
      return al === mn || al === mu;
    });

    if (isMe && typeof Notify !== 'undefined') {
      Notify.warning('🎯 Task baru ditugaskan ke kamu: ' + (row.judul || ''));
    }
  }

  /* ── Stop presence ketika logout / halaman ditutup ──────── */
  function stop() {
    if (_presenceInterval) clearInterval(_presenceInterval);
    DB.unsubscribeAll();
    _initialized = false;
  }

  // Cleanup saat tab ditutup
  window.addEventListener('beforeunload', stop);

  return { init, stop };
})();

window.DBExtensions = DBExtensions;
