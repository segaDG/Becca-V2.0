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

  /* ── Presence: hanya refresh badge online — update presence sudah di App._startPresence ─── */
  function _setupPresence() {
    // App._startPresence() sudah handle presence update (15s) dan online users render (20s)
    // DBExtensions hanya setup realtime badge refresh via Supabase subscription
    _refreshOnlineBadge();
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
  // Debounce: prevent multiple rapid reinits when several rows change at once
  const _rtTimers = {};
  function _rtDebounce(key, fn, ms = 500) {
    clearTimeout(_rtTimers[key]);
    _rtTimers[key] = setTimeout(fn, ms);
  }

  function _setupRealtime() {
    DB.setupRealtime({
      orders: ({ eventType }) => {
        _notify('order', eventType);
        if (window.App?._currentPage === 'order') {
          _rtDebounce('order', () => OrderModule?.init?.());
        }
        if (window.App?._currentPage === 'dashboard') {
          _rtDebounce('dash', () => DashboardModule?.init?.());
        }
      },

      invoices: ({ eventType }) => {
        _notify('invoice', eventType);
        if (window.App?._currentPage === 'invoice') {
          _rtDebounce('invoice', () => InvoiceModule?.init?.());
        }
      },

      tasks: ({ eventType, new: newRow }) => {
        if (window.App?._currentPage === 'task') {
          _rtDebounce('task', () => TaskModule?.render?.());
        }
        _checkTaskNotif(newRow, eventType);
      },

      customers: ({ eventType }) => {
        if (window.App?._currentPage === 'customer') {
          _rtDebounce('customer', () => CustomerModule?.init?.());
        }
      },

      users: ({ eventType }) => {
        // User baru ditambah — refresh auth list
        console.log('[RT] Users changed:', eventType);
      },

      settings: ({ eventType }) => {
        // Settings berubah di device lain — sync privileges + customRoles
        _rtDebounce('settings', async () => {
          try {
            const s = await DB.getSettings();
            if (s?._privileges) { if (Auth._bustPrivCache) Auth._bustPrivCache(); }
          } catch {}
          // Refresh settings tab if open
          if (window.App?._currentPage === 'settings') SettingsModule?.renderPrivilege?.();
        });
      },

      presence: () => {
        _refreshOnlineBadge();
      },

      emp_absensi: ({ eventType, new: newRow }) => {
        if (eventType === 'INSERT' && newRow && window.FaceAttendanceModule) {
          FaceAttendanceModule._fsHandleRemote(newRow);
        }
        // Refresh on ALL events (INSERT, UPDATE, DELETE) for cross-device sync
        if (window.App?._currentPage === 'employee' && window.EmployeeModule) {
          _rtDebounce('emp_absensi', () => EmployeeModule.renderAbsensi?.());
        }
      },

      activity_logs: () => {
        if (window.App?._currentPage === 'settings') {
          _rtDebounce('activity', () => {
            const tab = document.querySelector('[onclick*="activity"]');
            if (tab?.classList?.contains('active')) SettingsModule?.switchTab?.('activity');
          });
        }
      },

      // ── Key tables for cross-device sync ──
      // For modules with inline editing (kas, inventory, ap, daily-order, po):
      // Only re-init if user is NOT currently on that page (cross-device sync).
      // If user IS on the page, their local state is already up-to-date from their own save.
      // This prevents realtime from destroying edit state / causing full page refresh.
      inv_activities: () => {
        if (window.App?._currentPage !== 'inventory') return;
        _rtDebounce('inv', () => { if (!window.InventoryModule?._invEditId) InventoryModule?.init?.(); }, 2000);
      },
      ap: () => {
        if (window.App?._currentPage !== 'ap') return;
        _rtDebounce('ap', () => { if (!window.APModule?._apEditId) APModule?.init?.(); }, 2000);
      },
      kas: () => {
        // Skip re-init when user is on kas page — their local state is fresh
        // Only useful for cross-device sync (user on DIFFERENT page)
        if (window.App?._currentPage === 'kas') return;
      },
      daily_order_forms: () => {
        if (window.App?._currentPage !== 'daily-order') return;
        _rtDebounce('do', () => DailyOrderModule?.init?.(), 2000);
      },
      news: () => {
        if (window.App?._currentPage === 'news') _rtDebounce('news', () => NewsModule?.init?.(), 2000);
      },
      po_anggaran: () => {
        if (window.App?._currentPage === 'po') return; // PO has inline edit
      },
      employees: () => {
        if (window.App?._currentPage !== 'employee') return;
        _rtDebounce('employee', () => EmployeeModule?.init?.(), 2000);
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

    // Push notification ke semua assignee
    if (eventType === 'INSERT' && typeof PushModule !== 'undefined') {
      assignees.forEach(name => {
        PushModule.sendToUser(name, {
          title: '🎯 Task Baru',
          body:  row.judul || row.title || 'Ada task baru untukmu',
          data:  { taskId: row.id || '', type: 'task_new' },
        }).catch(() => {});
      });
    }
  }

  /* ── Stop presence ketika logout / halaman ditutup ──────── */
  function stop() {
    if (_presenceInterval) clearInterval(_presenceInterval);
    // Clear all debounced realtime timers
    Object.values(_rtTimers).forEach(t => clearTimeout(t));
    Object.keys(_rtTimers).forEach(k => delete _rtTimers[k]);
    DB.unsubscribeAll();
    _initialized = false;
  }

  // Cleanup saat tab ditutup
  window.addEventListener('beforeunload', stop);

  return { init, stop };
})();

window.DBExtensions = DBExtensions;
