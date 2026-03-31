/* ============================================
   BECCA V2.0 — App (Main Entry Point)
   Router, boot, notifications, logout
============================================ */
const App = {
  _currentPage: 'dashboard',
  _loadedModules: new Set(),

  _MODULE_MAP: {
    dashboard : 'js/modules/dashboard.js?v=20260329e',
    order     : 'js/modules/order.js?v=20260331b',
    invoice   : 'js/modules/invoice.js?v=20260331g',
    customer  : 'js/modules/customer.js?v=20260331j',
    news      : 'js/modules/news.js?v=20260330o',
    kas       : 'js/modules/kas.js?v=20260331k',
    'daily-order': 'js/modules/daily-order.js?v=20260331y',
    inventory : 'js/modules/inventory.js?v=20260331l',
    employee  : 'js/modules/employee.js?v=20260331b',
    ap        : 'js/modules/ap.js?v=20260331f',
    task      : 'js/modules/task.js?v=20260330i',
    report    : 'js/modules/report.js?v=20260326r',
    settings  : 'js/modules/settings.js?v=20260330c',
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  async _loadModule(pageId) {
    if (this._loadedModules.has(pageId)) return;
    const src = this._MODULE_MAP[pageId];
    if (!src) return;
    try {
      await this._loadScript(src);
      this._loadedModules.add(pageId);
    } catch(e) {
      console.error('[App] Failed to load module:', pageId, e);
    }
  },

  get _modules() {
    return {
      dashboard : typeof DashboardModule  !== 'undefined' ? DashboardModule  : null,
      order     : typeof OrderModule      !== 'undefined' ? OrderModule      : null,
      invoice   : typeof InvoiceModule    !== 'undefined' ? InvoiceModule    : null,
      customer  : typeof CustomerModule   !== 'undefined' ? CustomerModule   : null,
      news      : typeof NewsModule       !== 'undefined' ? NewsModule       : null,
      kas       : typeof KasModule        !== 'undefined' ? KasModule        : null,
      'daily-order': typeof DailyOrderModule !== 'undefined' ? DailyOrderModule : null,
      inventory : typeof InventoryModule  !== 'undefined' ? InventoryModule  : null,
      employee  : typeof EmployeeModule   !== 'undefined' ? EmployeeModule   : null,
      ap        : typeof APModule         !== 'undefined' ? APModule         : null,
      task      : typeof TaskModule       !== 'undefined' ? TaskModule       : null,
      report    : typeof ReportModule     !== 'undefined' ? ReportModule     : null,
      settings  : typeof SettingsModule   !== 'undefined' ? SettingsModule   : null,
    };
  },

  async boot() {
    // Handle deep link — capture ?task=ID before anything, survive login redirect
    const _urlP = new URLSearchParams(location.search);
    const _deepTask = _urlP.get('task');
    if (_deepTask) {
      sessionStorage.setItem('becca_deep_task', _deepTask);
      history.replaceState({}, '', location.pathname);
    }

    // Init Supabase DB
    DB.init().then(async () => {
      if (DB.isReady() && !localStorage.getItem('becca_migrated_v6')) {
        localStorage.setItem('becca_migrated_v6', '1');
        DB.migrateFromLocalStorage()
          .then(n => {
            if (n > 0) Notify.success('Sinkronisasi data selesai: ' + n + ' item tersync ke cloud ✓');
            // Bersihkan localStorage untuk NO_CACHE tables — data sudah ada di Supabase
            // Mencegah data lama terus di-merge dengan hasil Supabase
            ['tasks','ap','suppliers','customers','users'].forEach(t => {
              localStorage.removeItem('becca_' + t);
            });
          })
          .catch(() => {});
      }
      // Normalisasi nama customer — sekali jalan (case-insensitive match)
      if (DB.isReady() && !localStorage.getItem('becca_orders_norm_v1')) {
        localStorage.setItem('becca_orders_norm_v1', '1');
        Promise.all([DB.getCustomers(), DB.getOrders()]).then(async ([custs, orders]) => {
          const custNames = (custs||[]).map(c => c.nama).filter(Boolean);
          if (!custNames.length) return;
          let fixed = 0;
          for (const order of (orders||[])) {
            const raw = (order.namaPerusahaan||'').trim();
            if (!raw || custNames.includes(raw)) continue;
            const match = custNames.find(n => n.toLowerCase() === raw.toLowerCase());
            if (match) { order.namaPerusahaan = match; await DB.saveOrder(order); fixed++; }
          }
          if (fixed > 0) Notify.success(fixed + ' order diperbarui nama customer ✓');
        }).catch(() => {});
      }
      // Rename nama customer ke nama lengkap resmi — sekali jalan
      if (DB.isReady() && !localStorage.getItem('becca_cust_rename_v2')) {
        localStorage.setItem('becca_cust_rename_v2', '1');
        const _R = {
          'pt. nici':           'PT. NUGRAHA INDAH CITARASA INDONESIA',
          'pt. shinto kogyo':   'PT. Shinto Kogyo Indonesia',
          'pt. daiki':          'PT. DAIKI ALMUNIUM INDUSTRI IND',
          'pt. awi':            'PT. Akashi Wahana Indonesia',
          'pt. nbc':            'PT. NBC INDONESIA',
          'pt. resonac':        'PT. RESONAC MATERIALS INDONESIA',
          'pt. ssk':            'PT. Super Steel Karawang',
          'super steel karawang':'PT. Super Steel Karawang',
          'pt. aicc':           'PT. Asian Isuzu Casting Center (AICC)',
          'pt. ddmi':           'PT. Daihatsu Drivetrain Manufacturing Indonesia (DDMI)',
          'pt. iff krw':        'International Flavors & Fragrances (IFF)',
        };
        const _rename = n => _R[(n||'').trim().toLowerCase()] || n;
        Promise.all([DB.getCustomers(), DB.getOrders(), DB.getInvoices()]).then(async ([custs, orders, invs]) => {
          let c=0, o=0, i=0;
          for (const cust of (custs||[])) {
            const n = _rename(cust.nama);
            if (n !== cust.nama) { cust.nama = n; await DB.saveCustomer(cust); c++; }
          }
          for (const ord of (orders||[])) {
            const n = _rename(ord.namaPerusahaan);
            if (n !== ord.namaPerusahaan) { ord.namaPerusahaan = n; await DB.saveOrder(ord); o++; }
          }
          for (const inv of (invs||[])) {
            const n = _rename(inv.customer);
            if (n !== inv.customer) { inv.customer = n; await DB.saveInvoice(inv); i++; }
          }
          const total = c + o + i;
          if (total > 0) Notify.success(`Nama customer diperbarui: ${c} customer, ${o} order, ${i} invoice ✓`);
        }).catch(() => {});
      }
      // Selalu sync users ke Supabase settings saat boot (cross-device login)
      if (DB.isReady()) {
        await this._loadModule('settings').catch(() => {});
        if (typeof SettingsModule !== 'undefined') {
          SettingsModule._syncAuthJs().catch(() => {});
        }
      }
      // Refresh role user aktif jika berubah di DB sejak login terakhir
      // (misal: admin ganti role user dari operator → finance, user tidak perlu logout)
      const _cu = Auth.currentUser();
      if (_cu && DB.isReady()) {
        DB.getUsers().then(users => {
          const fresh = users.find(u =>
            (u.id && u.id === _cu.id) ||
            (u.username?.toLowerCase() === (_cu.username||'').toLowerCase())
          );
          if (fresh && fresh.role && fresh.role !== _cu.role) {
            Auth._user = { ..._cu, role: fresh.role };
            // Update session di tempat yang sama dengan saat login
            Utils.ls.get(Auth._SESSION_KEY)
              ? Utils.ls.set(Auth._SESSION_KEY, Auth._user)
              : sessionStorage.setItem(Auth._SESSION_KEY, JSON.stringify(Auth._user));
            App._renderHeader();
            if (typeof Sidebar !== 'undefined') Sidebar.render();
          }
        }).catch(()=>{});
      }
    }).catch(()=>{});
    if (!Auth.init()) { this._showLogin(); return; }
    this._showApp();
    this._initTheme();
    this._startPresence();
    setTimeout(() => { if (typeof DBExtensions !== "undefined") DBExtensions.init(); }, 500);
    // Force change password on first login
    if (sessionStorage.getItem('becca_must_change_pwd') === '1') {
      setTimeout(() => this._forceChangePasswordModal(), 500);
    }
  },

  _hideLoading() {
    const el = document.getElementById('app-loading');
    if (el) el.style.display = 'none';
  },

  _showLogin() {
    this._hideLoading();
    document.getElementById('app').style.display = 'none';
    document.getElementById('page-login').style.display = '';
    Auth.renderLogin();
  },

  _showApp() {
    this._hideLoading();
    document.getElementById('page-login').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    let _ov = document.getElementById('sidebar-overlay');
    if (!_ov) { _ov = document.createElement('div'); _ov.id = 'sidebar-overlay'; document.body.appendChild(_ov); }
    _ov.onclick = () => this._closeMobileSidebar();
    _ov.ontouchend = (e) => { e.preventDefault(); this._closeMobileSidebar(); };
    Sidebar.render();
    this._renderHeader();

    // Deep link: open specific task after login
    const _deepTask = sessionStorage.getItem('becca_deep_task');
    if (_deepTask) {
      sessionStorage.removeItem('becca_deep_task');
      this.navigate('task').then(() => {
        if (typeof TaskModule !== 'undefined') TaskModule.openModal(_deepTask);
      });
    } else {
      this.navigate(Utils.ls.get('lastPage') || 'dashboard');
    }

    this._handleResize();
    window.addEventListener('resize', () => this._handleResize());

    // Load non-critical scripts async — tidak block render awal
    this._loadScript('js/notifications.js?v=20260330b').catch(() => {});
    this._loadScript('js/search-fix.js?v=20260330a').catch(() => {});
    setTimeout(() => {
      if (typeof NotifCenter !== 'undefined') NotifCenter.refresh();
      if (typeof NewsModule !== 'undefined') NewsModule._updateBadge();
    }, 800);
  },

  _handleResize() {
    const s = document.getElementById('sidebar');
    if (!s) return;
    if (window.innerWidth <= 768)       { s.classList.remove('collapsed','mobile-open'); }
    else if (window.innerWidth <= 1100) { s.classList.add('collapsed'); s.classList.remove('mobile-open'); }
    else                                { s.classList.remove('collapsed','mobile-open'); }
  },

  _closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.body.classList.remove('sidebar-open');
  },

  /* User menu pakai style.display, bukan class hidden (karena hidden punya !important) */
  _showUserMenu()  { const m = document.getElementById('user-menu'); if (m) m.style.display = 'block'; },
  _hideUserMenu()  { const m = document.getElementById('user-menu'); if (m) m.style.display = 'none';  },
  _toggleUserMenu(){ const m = document.getElementById('user-menu'); if (m) m.style.display = m.style.display === 'block' ? 'none' : 'block'; },

  _renderHeader() {
    const user     = Auth.currentUser();
    const initials = Utils.initials ? Utils.initials(user?.nama||'?') : (user?.nama||'?').substring(0,2).toUpperCase();
    document.getElementById('header').innerHTML = `
      <div class="header-left">
        <button id="btn-toggle-sidebar" onclick="App._toggleSidebar()" title="Toggle Sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span class="page-title" id="header-page-title">Dashboard</span>
      </div>
      <div class="header-right">
        <!-- Online Users -->
        <div id="online-users-bar" style="display:flex;align-items:center;gap:4px;margin-right:4px"></div>

        <!-- Dark/Light Mode Toggle -->
        <button class="header-btn" id="btn-theme" onclick="App.toggleTheme()" title="Ganti Tema"
          style="position:relative">
          <svg id="icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"
            style="display:none">
            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/>
          </svg>
          <svg id="icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>
        <!-- Notifikasi -->
        <button class="header-btn" id="btn-notif" onclick="App._openNotif()" title="Notifikasi" style="position:relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span id="notif-badge" style="display:none;position:absolute;top:4px;right:4px;
            min-width:14px;height:14px;background:var(--danger);border-radius:999px;
            font-size:8px;font-weight:700;color:white;border:1.5px solid var(--surface);
            align-items:center;justify-content:center;padding:0 2px"></span>
        </button>
        <!-- Online users badge (Supabase Realtime) -->
        <div id="online-users-wrap" style="display:flex;align-items:center;gap:4px;
          font-size:10px;color:var(--text-3);padding:0 4px" title="User online">
          <span style="width:7px;height:7px;border-radius:50%;background:var(--success);
            display:inline-block;animation:pulse 2s infinite"></span>
          <span id="online-indicator" style="font-size:10px;color:var(--text-3)">...</span>
        </div>
        <!-- User Dropdown -->
        <div style="position:relative">
          <button id="btn-user" onclick="App._toggleUserMenu()" title="Akun"
                  style="display:flex;align-items:center;gap:6px;background:transparent;
                         border:1px solid var(--border);border-radius:var(--r-sm);
                         padding:4px 10px;cursor:pointer;color:var(--text-2);font-family:var(--font);"
                  onmouseover="this.style.background='var(--surface2)'"
                  onmouseout="this.style.background='transparent'">
            <div style="width:22px;height:22px;border-radius:50%;background:var(--primary);
                        display:flex;align-items:center;justify-content:center;
                        font-size:9px;font-weight:700;color:white">${initials}</div>
            <span style="font-size:12px;font-weight:500;max-width:90px;overflow:hidden;
                         text-overflow:ellipsis;white-space:nowrap">${user?.nama||''}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 width="10" height="10"><polyline points="6,9 12,15 18,9"/></svg>
          </button>
          <!-- Dropdown Menu - pakai style.display bukan class hidden -->
          <div id="user-menu" style="display:none;position:absolute;right:0;top:calc(100% + 6px);
               background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);
               box-shadow:var(--shadow-lg);min-width:200px;z-index:9999;overflow:hidden">
            <div style="padding:12px var(--s4);border-bottom:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px;color:var(--heading)">${user?.nama||''}</div>
              <div style="font-size:11px;color:var(--text-3)">${user?.role||''}</div>
            </div>
            <button class="dropdown-item" onclick="App.navigate('settings');App._hideUserMenu()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
              Pengaturan
            </button>
            <div style="border-top:1px solid var(--border);margin:4px 0"></div>
            <button class="dropdown-item" onclick="App.logout()" style="color:var(--danger)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    `;
    /* Close dropdown saat klik di luar — gunakan satu listener saja */
    if (!App._userMenuClickHandler) {
      App._userMenuClickHandler = (e) => {
        if (!e.target.closest('#btn-user') && !e.target.closest('#user-menu')) {
          App._hideUserMenu();
        }
      };
      document.addEventListener('click', App._userMenuClickHandler);
    }
  },

  _toggleSidebar() {
    const s = document.getElementById('sidebar');
    if (!s) return;
    if (window.innerWidth <= 768) {
      s.classList.toggle('mobile-open');
      document.body.classList.toggle('sidebar-open');
    } else {
      s.classList.toggle('collapsed');
    }
  },

  async _openNotif() {
    App._hideUserMenu();
    if (typeof NotifCenter !== 'undefined') await NotifCenter.showPanel();
  },

  async navigate(pageId) {
    // Flush any in-progress edits before leaving the page (saves to localStorage without validation)
    try { if (typeof InventoryModule !== 'undefined') InventoryModule.flushPendingEdit?.(); } catch(e) {}
    try { if (typeof KasModule !== 'undefined') KasModule.flushPendingEdit?.(); } catch(e) {}

    App._closeMobileSidebar();
    App._hideUserMenu();

    if (!Auth.can(pageId, 'view') && pageId !== 'dashboard') {
      Notify.warning('Akses Ditolak', 'Anda tidak punya akses ke halaman ini');
      return;
    }

    /* Sembunyikan semua page - JANGAN pakai hidden class, pakai display none */
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });

    let page = document.getElementById('page-' + pageId);
    if (!page) {
      this._renderComingSoon(pageId);
      return;
    }

    /* Tampilkan page yang dipilih */
    page.classList.add('active');

    /* Scroll ke atas */
    const content = document.getElementById('content');
    if (content) content.scrollTop = 0;

    this._currentPage = pageId;
    Sidebar.setActive(pageId);

    const titles = {
      dashboard : 'Dashboard',
      order     : 'Order Catering',
      invoice   : 'Invoice',
      customer  : 'Data Customer',
      news      : 'News & Pengumuman',
      'daily-order': 'Daily Order',
      employee  : 'Karyawan',
      inventory : 'Inventory',
      kas       : 'Kas Kecil',
      ap        : 'Account Payable',
      task      : 'Task',
      report    : 'Laporan',
      settings  : 'Pengaturan',
    };
    const titleEl = document.getElementById('header-page-title');
    if (titleEl) titleEl.textContent = titles[pageId] || pageId;

    Utils.ls.set('lastPage', pageId);

    /* Lazy-load module script jika belum dimuat */
    await this._loadModule(pageId);

    /* Init module */
    const mod = this._modules[pageId];
    if (mod && typeof mod.init === 'function') {
      try {
        await mod.init();
      } catch(err) {
        console.error('Error init ' + pageId + ':', err);
        Notify.error('Error memuat ' + pageId, err.message);
      }
    }
  },

  _renderComingSoon(pageId) {
    let page = document.getElementById('page-' + pageId);
    if (!page) {
      page = document.createElement('section');
      page.id = 'page-' + pageId;
      page.className = 'page';
      document.getElementById('content').appendChild(page);
    }
    page.innerHTML = `
      <div class="empty-state" style="height:60vh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9 9a3 3 0 015.12-2.12A3 3 0 0115 9c0 1.5-1.5 2.5-3 3v1M12 18h.01"/>
        </svg>
        <h4>Modul Segera Hadir</h4>
        <p>Modul <strong>${pageId}</strong> sedang dalam pengembangan.</p>
      </div>
    `;
    page.classList.add('active');
    Sidebar.setActive(pageId);
  },

  /* === Presence / User Online === */
  _presenceInterval: null,
  _presenceSessionId: null,

  _startPresence() {
    const user = Auth.currentUser();
    if (!user) return;
    this._presenceSessionId = Utils.uid();
    const update = () => {
      DB.updatePresence(user.id || user.username, {
        id:        user.id || user.username,
        nama:      user.nama || user.username,
        username:  user.username,
        role:      user.role,
        sessionId: this._presenceSessionId,
        page:      this._currentPage,
      });
    };
    update();
    this._presenceInterval = setInterval(update, 15000); // update every 15s
    // Render online users every 20s (store ref untuk cleanup)
    this._renderOnlineUsers();
    this._onlineUsersInterval = setInterval(() => this._renderOnlineUsers(), 20000);
  },

  async _renderOnlineUsers() {
    const bar = document.getElementById('online-users-bar');
    if (!bar) return;
    const currentUser = Auth.currentUser();
    const users = await DB.getOnlineUsers(30000).catch(() => []);
    // Color palette for avatars
    const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#ef4444'];
    const getColor = (name) => {
      let hash = 0;
      for (const c of (name||'?')) hash = hash*31 + c.charCodeAt(0);
      return COLORS[Math.abs(hash) % COLORS.length];
    };

    // Show max 5 avatars + overflow
    const MAX = 5;
    const shown = users.slice(0, MAX);
    const overflow = users.length > MAX ? users.length - MAX : 0;

    bar.innerHTML = shown.map(u => {
      const initials = (u.nama||'?').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
      const color    = getColor(u.nama);
      const isMe     = u.username === currentUser?.username;
      const page     = u.page ? ' · /'+u.page : '';
      return `<div title="${u.nama}${page}${isMe?' (Anda)':''}"
        style="width:28px;height:28px;border-radius:50%;
               background:${color};color:white;
               display:flex;align-items:center;justify-content:center;
               font-size:11px;font-weight:700;
               border:2px solid ${isMe?'white':'var(--surface)'};
               cursor:default;flex-shrink:0;
               box-shadow:0 0 0 2px ${isMe?color:'transparent'};
               transition:transform .15s;
               ${isMe?'outline:2px solid var(--primary);outline-offset:1px':''}"
        onmouseover="this.style.transform='scale(1.2)';this.style.zIndex='10'"
        onmouseout="this.style.transform='';this.style.zIndex=''"
        onclick="App._showOnlineUsersModal()">${initials}</div>`;
    }).join('');

    if (overflow > 0) {
      bar.innerHTML += `<div style="width:28px;height:28px;border-radius:50%;
        background:var(--surface3);color:var(--text-3);
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:700;border:2px solid var(--border);cursor:pointer"
        onclick="App._showOnlineUsersModal()">+${overflow}</div>`;
    }

    if (users.length > 0) {
      bar.title = users.length + ' user online';
    }
  },

  async _showOnlineUsersModal() {
    const users  = await DB.getOnlineUsers(30000).catch(() => []);
    const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#ef4444'];
    const getColor = (name) => {
      let hash = 0;
      for (const c of (name||'?')) hash = hash*31 + c.charCodeAt(0);
      return COLORS[Math.abs(hash) % COLORS.length];
    };
    const currentUser = Auth.currentUser();
    const now = Date.now();
    const mid = Utils.uid();

    const rows = users.map(u => {
      const initials = (u.nama||'?').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
      const color    = getColor(u.nama);
      const isMe     = u.username === currentUser?.username;
      const secsAgo  = Math.round((now - new Date(u.last_seen || u.lastSeen || Date.now()).getTime()) / 1000);
      const timeAgo  = secsAgo < 60 ? 'Baru saja' :
                       secsAgo < 3600 ? Math.round(secsAgo/60)+'m yang lalu' :
                       secsAgo < 86400 ? Math.round(secsAgo/3600)+'j yang lalu' :
                       Math.round(secsAgo/86400)+'h yang lalu';
      const pageLabel = {dashboard:'Dashboard',order:'Order',inventory:'Inventory',kas:'Kas Kecil',
        employee:'Karyawan',settings:'Pengaturan',ap:'Account Payable',task:'Task'}[u.page] || u.page || '-';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:38px;height:38px;border-radius:50%;background:${color};color:white;
                    display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;
                    ${isMe?'box-shadow:0 0 0 3px '+color+'40':''}">
          ${initials}
        </div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${u.nama||u.username}${isMe?' <span style="font-size:10px;color:var(--primary-h)">(Anda)</span>':''}</div>
          <div style="font-size:11px;color:var(--text-3)">${u.role||'-'} · ${pageLabel}</div>
        </div>
        <div style="text-align:right">
          <div style="display:flex;align-items:center;gap:5px;justify-content:flex-end">
            <div style="width:7px;height:7px;border-radius:50%;background:var(--success);flex-shrink:0"></div>
            <span style="font-size:11px;color:var(--success);font-weight:600">Online</span>
          </div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px">${timeAgo}</div>
        </div>
      </div>`;
    }).join('');

    Modal.open({ id: mid,
      title: '👥 User Online (' + users.length + ')',
      size: 'modal-sm',
      body: users.length
        ? `<div>${rows}</div>`
        : '<div style="text-align:center;padding:30px;color:var(--text-3)">Tidak ada user lain yang online</div>',
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  },

  /* === Theme Toggle === */
  toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const newTheme = isDark ? 'light' : 'dark';
    this._applyTheme(newTheme);
    localStorage.setItem('becca_theme', newTheme);
  },

  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const iconDark  = document.getElementById('icon-dark');
    const iconLight = document.getElementById('icon-light');
    const btnTheme  = document.getElementById('btn-theme');
    if (theme === 'light') {
      if (iconDark)  iconDark.style.display  = 'block';
      if (iconLight) iconLight.style.display = 'none';
      if (btnTheme)  btnTheme.title = 'Ganti ke Dark Mode';
    } else {
      if (iconDark)  iconDark.style.display  = 'none';
      if (iconLight) iconLight.style.display = 'block';
      if (btnTheme)  btnTheme.title = 'Ganti ke Light Mode';
    }
  },

  _initTheme() {
    // Inject light mode CSS if not already present
    if (!document.getElementById('becca-light-mode-css')) {
      const style = document.createElement('style');
      style.id = 'becca-light-mode-css';
      style.textContent = `
        [data-theme="light"] {
          --bg:          #f1f5f9;
          --surface:     #ffffff;
          --surface2:    #f8fafc;
          --surface3:    #f1f5f9;
          --border:      rgba(0,0,0,.1);
          --border2:     rgba(0,0,0,.15);
          --text:        #0f172a;
          --text-1:      #1e293b;
          --text-2:      #475569;
          --text-3:      #94a3b8;
          --heading:     #0f172a;
          --overlay:     rgba(0,0,0,.4);
          --shadow-sm:   0 1px 2px rgba(0,0,0,.08);
          --shadow-md:   0 4px 12px rgba(0,0,0,.1);
          --shadow-lg:   0 8px 24px rgba(0,0,0,.12);
          color-scheme: light;
        }
        [data-theme="light"] .sidebar {
          background: #ffffff;
          border-right: 1px solid rgba(0,0,0,.08);
        }
        [data-theme="light"] .header {
          background: #ffffff;
          border-bottom: 1px solid rgba(0,0,0,.08);
        }
        [data-theme="light"] .ks-tbl td,
        [data-theme="light"] .iv-tbl td {
          background: #ffffff;
        }
        [data-theme="light"] .ks-tbl tr.ks-view:hover td,
        [data-theme="light"] .iv-tbl tr.iv-view:hover td {
          background: #f8fafc;
        }
        [data-theme="light"] input,
        [data-theme="light"] select,
        [data-theme="light"] textarea {
          color-scheme: light;
        }
      `;
      document.head.appendChild(style);
    }
    const saved = localStorage.getItem('becca_theme') || 'dark';
    this._applyTheme(saved);
  },

  _forceChangePasswordModal() {
    const mid = Utils.uid();
    // Cannot close this modal - must change password
    Modal.open({ id: mid,
      title: '🔑 Ganti Password',
      size: 'modal-sm',
      body: `<div style="background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.3);
                          border-radius:var(--r-md);padding:12px;margin-bottom:var(--s4);font-size:13px;color:var(--warning)">
               ⚠️ Ini adalah login pertama Anda. Anda harus mengganti password sebelum melanjutkan.
             </div>
             <form id="force-pwd-form">
               <div class="form-group">
                 <label class="form-label">Password Baru <span class="req">*</span></label>
                 <input name="newPwd" type="password" class="form-control" minlength="6" required
                   placeholder="Min. 6 karakter">
               </div>
               <div class="form-group">
                 <label class="form-label">Konfirmasi Password <span class="req">*</span></label>
                 <input name="confirmPwd" type="password" class="form-control" required>
               </div>
             </form>`,
      footer: `<button class="btn btn-primary w-full" onclick="App._submitForcePassword('${mid}')">Simpan Password</button>`,
      closable: false,
    });
  },

  async _submitForcePassword(mid) {
    const form = document.getElementById('force-pwd-form');
    const fd   = new FormData(form);
    const np   = fd.get('newPwd');
    const cp   = fd.get('confirmPwd');
    if (!np || np.length < 6) { Notify.warning('Password min. 6 karakter'); return; }
    if (np !== cp) { Notify.warning('Konfirmasi password tidak sama'); return; }
    try {
      const user = Auth.currentUser();
      let users = await DB.getUsers().catch(()=>[]);
      if (!users.length) users = [...Auth._defaultUsers];
      const idx = users.findIndex(u => u.username === user.username);
      if (idx < 0) { Notify.error('User tidak ditemukan'); return; }
      users[idx].password = np;
      users[idx].mustChangePassword = false;
      await DB.saveUser(users[idx]);
      sessionStorage.removeItem('becca_must_change_pwd');
      Modal.close(mid);
      Notify.success('Password berhasil diganti! Selamat datang, '+user.nama);
      DB.logActivity({type:'change_password', detail:'Force change password: '+user.username});
    } catch(e) { Notify.error('Gagal', e.message); }
  },

  async logout() {
    App._hideUserMenu();
    const ok = await Modal.confirm({
      title       : 'Logout',
      message     : 'Yakin ingin keluar dari BECCA?',
      confirmText : 'Ya, Logout',
    });
    if (!ok) return;
    await Auth.logout();
    location.reload();
  },
};

document.addEventListener('DOMContentLoaded', () => App.boot());
window.App = App;
