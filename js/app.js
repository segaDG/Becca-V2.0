/* ============================================
   BECCA V2.0 — App (Main Entry Point)
   Router, boot, notifications, logout
============================================ */
const App = {
  _currentPage: 'dashboard',
  _loadedModules: new Set(),

  _MODULE_MAP: {
    dashboard : 'js/modules/dashboard.js?v=20260403a',
    order     : 'js/modules/order.js?v=20260403a',
    invoice   : 'js/modules/invoice.js?v=20260402b',
    customer  : 'js/modules/customer.js?v=20260331j',
    news      : 'js/modules/news.js?v=20260401a',
    kas       : 'js/modules/kas.js?v=20260403a',
    'daily-order': 'js/modules/daily-order.js?v=20260403a',
    inventory : 'js/modules/inventory.js?v=20260403b',
    employee  : 'js/modules/employee.js?v=20260401b',
    ap        : 'js/modules/ap.js?v=20260403a',
    po        : 'js/modules/po.js?v=20260402d',
    task      : 'js/modules/task.js?v=20260330i',
    delivery  : 'js/modules/delivery.js?v=20260405b',
    report    : 'js/modules/report.js?v=20260326r',
    settings  : 'js/modules/settings.js?v=20260401b',
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      // Prevent duplicate: check if script with same base path (ignoring ?v=) already loaded
      const basePath = src.split('?')[0];
      const existing = document.querySelector(`script[src^="${basePath}"]`);
      if (existing) { resolve(); return; }
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
      po        : typeof POModule         !== 'undefined' ? POModule         : null,
      task      : typeof TaskModule       !== 'undefined' ? TaskModule       : null,
      delivery  : typeof DeliveryModule   !== 'undefined' ? DeliveryModule   : null,
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
    this._loadUserColor();
    this._startPresence();
    setTimeout(() => { if (typeof DBExtensions !== "undefined") DBExtensions.init(); }, 500);
    // Update all sidebar badges after boot (inventory sync, kas belanja pasar, PO finance)
    setTimeout(() => this._updateAllBadges(), 1500);
    // Force change password on first login
    if (sessionStorage.getItem('becca_must_change_pwd') === '1') {
      setTimeout(() => this._forceChangePasswordModal(), 500);
    }
  },

  // Global badge updater — runs on boot, updates sidebar badges without loading modules
  async _updateAllBadges() {
    try {
      // Inventory sync badge (form produksi + belanja pasar pending)
      // Fetch ALL data in parallel (was: PO sequential after others)
      const [forms, invLogs, bpDocs, poDocs] = await Promise.all([
        DB.getDailyOrderForms().catch(()=>[]),
        DB.getInventory().catch(()=>[]),
        DB.getBelanjaPasar().catch(()=>[]),
        DB.getPO().catch(()=>[]),
      ]);
      const _n = v => Number(v)||0;
      // Build syncTag lookup map — O(1) instead of O(n) filter per form
      const stMap = {};
      invLogs.forEach(l => { if (l.syncTag) (stMap[l.syncTag] = stMap[l.syncTag]||[]).push(l); });

      // Pending form produksi
      const now = new Date();
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()-3);
      const cutStr = cutoff.getFullYear()+'-'+String(cutoff.getMonth()+1).padStart(2,'0')+'-'+String(cutoff.getDate()).padStart(2,'0');
      const relevant = forms.filter(f => f.tanggal >= cutStr && (f.items||[]).some(it => _n(it.estQty)>0||_n(it.aktQty)>0));
      let pendInv = relevant.filter(f => {
        const sl = stMap['do_'+(f.tanggal||'').replace(/-/g,'')+'_'+f.shift] || [];
        const si = (f.items||[]).filter(it=>_n(it.estQty)>0||_n(it.aktQty)>0);
        return sl.length < si.length;
      }).length;
      // Pending belanja pasar sync
      pendInv += bpDocs.filter(d => {
        if (d.kasStatus !== 'confirmed') return false;
        const sl = stMap['bp_'+d.id] || [];
        const si = (d.kasItems||[]).filter(it=>_n(it.aktQty)>0);
        return sl.length < si.length;
      }).length;
      // Inventory sidebar badge
      const invLink = document.querySelector('[data-page="inventory"]');
      if (invLink) {
        const old = invLink.querySelector('.sync-badge'); if (old) old.remove();
        if (pendInv > 0) {
          invLink.style.position = 'relative';
          invLink.insertAdjacentHTML('beforeend',
            `<span class="sync-badge" style="position:absolute;top:4px;right:4px;min-width:14px;height:14px;background:#ef4444;color:#fff;font-size:8px;font-weight:700;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 3px">${pendInv}</span>`);
        }
      }

      // Kas belanja pasar badge
      const pendKas = bpDocs.filter(d => d.status==='selesai' && d.kasStatus!=='confirmed').length;
      const kasLink = document.querySelector('[data-page="kas"]');
      if (kasLink) {
        const old = kasLink.querySelector('.bp-side-badge'); if (old) old.remove();
        if (pendKas > 0) {
          kasLink.style.position = 'relative';
          kasLink.insertAdjacentHTML('beforeend',
            `<span class="bp-side-badge" style="position:absolute;top:4px;right:4px;min-width:14px;height:14px;background:#ef4444;color:#fff;font-size:8px;font-weight:700;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 3px">${pendKas}</span>`);
        }
      }
      const isFinance = Auth.currentUser()?.role === 'superadmin' || Auth.currentUser()?.role === 'finance';
      const pendPO = isFinance ? poDocs.filter(d => d.pendingFinance && !d.confirmedBy).length : 0;
      const poBadge = document.getElementById('po-nav-badge');
      if (poBadge) {
        if (pendPO > 0) { poBadge.textContent = pendPO>9?'9+':String(pendPO); poBadge.style.display = 'flex'; }
        else { poBadge.style.display = 'none'; }
      }
    } catch(e) { console.warn('[Badges]', e); }
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

        <!-- Theme Color Picker -->
        <button class="header-btn" id="btn-color" onclick="App._openColorPicker()" title="Warna Tema"
          style="position:relative">
          <div style="width:16px;height:16px;border-radius:50%;background:var(--primary);border:2px solid rgba(255,255,255,.3)"></div>
        </button>
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
    try { if (typeof POModule !== 'undefined') POModule.flushPendingEdit?.(); } catch(e) {}

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
      po        : 'Purchase Order',
      task      : 'Task',
      delivery  : 'Delivery Schedule',
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

  /* === Theme Color Picker (Full UI Theme) ===
     Setiap tema punya warna untuk SEMUA CSS vars (sidebar, header, thead, content)
     di dark mode DAN light mode. _applyFullTheme() set CSS vars — bukan !important.
     ═══════════════════════════════════════════════════════════════════════════════ */
  _THEMES: [
    {id:'default', name:'Default', primary:'#6366f1', primaryH:'#818cf8',
     dark:{ bg:'#0c1020', surface:'#121830', surface2:'#1a2045', surface3:'#232a52', border:'rgba(130,145,220,.1)', border2:'rgba(130,145,220,.16)',
            sidebarBg:'#121838', sidebarBrand:'#0f1530', sidebarHover:'#1c2450', sidebarActive:'#222c5c', sidebarBorder:'rgba(130,145,220,.12)',
            sidebarText:'#c0c8e0', sidebarTextDim:'#7080a8', sidebarAccent:'#a5b4fc', sidebarSection:'rgba(165,180,252,.45)',
            headerBg:'#1a2248', headerBorder:'rgba(130,145,220,.15)', headerText:'#eef0f6', headerTextDim:'#8e99b8',
            theadBg:'#1a2248', theadText:'#b0b8d4', theadBorder:'rgba(130,145,220,.15)', theadHover:'#a5b4fc' },
     light:{ bg:'#f0f2f8', surface:'#ffffff', surface2:'#f0f1f8', surface3:'#e8eaf4', border:'rgba(99,102,241,.1)', border2:'rgba(99,102,241,.15)',
             sidebarBg:'#e4e7f8', sidebarBrand:'#dce0f5', sidebarHover:'#d0d5f0', sidebarActive:'#c4caec', sidebarBorder:'rgba(99,102,241,.12)',
             sidebarText:'#2d3258', sidebarTextDim:'#5b60a0', sidebarAccent:'#4f46e5', sidebarSection:'rgba(99,102,241,.4)',
             headerBg:'#ffffff', headerBorder:'rgba(99,102,241,.08)', headerText:'#111827', headerTextDim:'#6b7280',
             theadBg:'#e4e7f8', theadText:'#3b4070', theadBorder:'rgba(99,102,241,.1)', theadHover:'#4f46e5' }},
    {id:'ocean', name:'Ocean', primary:'#0ea5e9', primaryH:'#38bdf8',
     dark:{ bg:'#081520', surface:'#0e2030', surface2:'#153045', surface3:'#1c3a55', border:'rgba(14,165,233,.1)', border2:'rgba(14,165,233,.16)',
            sidebarBg:'#0a2035', sidebarBrand:'#081a2d', sidebarHover:'#103050', sidebarActive:'#143a60', sidebarBorder:'rgba(56,189,248,.12)',
            sidebarText:'#b0d0e8', sidebarTextDim:'#6090b8', sidebarAccent:'#38bdf8', sidebarSection:'rgba(56,189,248,.45)',
            headerBg:'#0f3050', headerBorder:'rgba(14,165,233,.15)', headerText:'#eaf4fa', headerTextDim:'#7aadcc',
            theadBg:'#0f3050', theadText:'#90c0dd', theadBorder:'rgba(14,165,233,.15)', theadHover:'#38bdf8' },
     light:{ bg:'#f0f9ff', surface:'#ffffff', surface2:'#e8f4fd', surface3:'#d4ecfa', border:'rgba(14,165,233,.1)', border2:'rgba(14,165,233,.15)',
             sidebarBg:'#e0f2fe', sidebarBrand:'#d0ecfc', sidebarHover:'#bae6fd', sidebarActive:'#a5ddfb', sidebarBorder:'rgba(14,165,233,.15)',
             sidebarText:'#0c4a6e', sidebarTextDim:'#0369a1', sidebarAccent:'#0284c7', sidebarSection:'rgba(14,165,233,.45)',
             headerBg:'#ffffff', headerBorder:'rgba(14,165,233,.08)', headerText:'#082f49', headerTextDim:'#4b8db5',
             theadBg:'#e0f2fe', theadText:'#0c4a6e', theadBorder:'rgba(14,165,233,.1)', theadHover:'#0284c7' }},
    {id:'forest', name:'Forest', primary:'#10b981', primaryH:'#34d399',
     dark:{ bg:'#061510', surface:'#0c2a1e', surface2:'#134030', surface3:'#1a5040', border:'rgba(16,185,129,.1)', border2:'rgba(16,185,129,.16)',
            sidebarBg:'#082018', sidebarBrand:'#061a12', sidebarHover:'#0e3025', sidebarActive:'#124030', sidebarBorder:'rgba(52,211,153,.12)',
            sidebarText:'#a8d8c0', sidebarTextDim:'#58a080', sidebarAccent:'#34d399', sidebarSection:'rgba(52,211,153,.45)',
            headerBg:'#0e3828', headerBorder:'rgba(16,185,129,.15)', headerText:'#e8f8f0', headerTextDim:'#70b898',
            theadBg:'#0e3828', theadText:'#88ccaa', theadBorder:'rgba(16,185,129,.15)', theadHover:'#34d399' },
     light:{ bg:'#ecfdf5', surface:'#ffffff', surface2:'#e0faf0', surface3:'#d1f5e8', border:'rgba(16,185,129,.1)', border2:'rgba(16,185,129,.15)',
             sidebarBg:'#d1fae5', sidebarBrand:'#c0f5da', sidebarHover:'#a7f3d0', sidebarActive:'#86efbc', sidebarBorder:'rgba(16,185,129,.15)',
             sidebarText:'#065f46', sidebarTextDim:'#059669', sidebarAccent:'#047857', sidebarSection:'rgba(16,185,129,.45)',
             headerBg:'#ffffff', headerBorder:'rgba(16,185,129,.08)', headerText:'#064e3b', headerTextDim:'#4a9078',
             theadBg:'#d1fae5', theadText:'#065f46', theadBorder:'rgba(16,185,129,.1)', theadHover:'#047857' }},
    {id:'sunset', name:'Sunset', primary:'#f97316', primaryH:'#fb923c',
     dark:{ bg:'#140a00', surface:'#221408', surface2:'#342010', surface3:'#453018', border:'rgba(249,115,22,.1)', border2:'rgba(249,115,22,.16)',
            sidebarBg:'#1c1208', sidebarBrand:'#160e05', sidebarHover:'#2a1e10', sidebarActive:'#352818', sidebarBorder:'rgba(251,146,60,.12)',
            sidebarText:'#d8c0a0', sidebarTextDim:'#987858', sidebarAccent:'#fb923c', sidebarSection:'rgba(251,146,60,.45)',
            headerBg:'#3a2210', headerBorder:'rgba(249,115,22,.15)', headerText:'#f8f0e8', headerTextDim:'#b89068',
            theadBg:'#3a2210', theadText:'#c8a878', theadBorder:'rgba(249,115,22,.15)', theadHover:'#fb923c' },
     light:{ bg:'#fff7ed', surface:'#ffffff', surface2:'#fff0e0', surface3:'#ffe8d0', border:'rgba(249,115,22,.1)', border2:'rgba(249,115,22,.15)',
             sidebarBg:'#ffedd5', sidebarBrand:'#ffe4c4', sidebarHover:'#fed7aa', sidebarActive:'#fdba74', sidebarBorder:'rgba(249,115,22,.15)',
             sidebarText:'#7c2d12', sidebarTextDim:'#c2410c', sidebarAccent:'#ea580c', sidebarSection:'rgba(249,115,22,.45)',
             headerBg:'#ffffff', headerBorder:'rgba(249,115,22,.08)', headerText:'#431407', headerTextDim:'#9a5e30',
             theadBg:'#ffedd5', theadText:'#7c2d12', theadBorder:'rgba(249,115,22,.1)', theadHover:'#ea580c' }},
    {id:'cherry', name:'Cherry', primary:'#f43f5e', primaryH:'#fb7185',
     dark:{ bg:'#120008', surface:'#200a14', surface2:'#30142a', surface3:'#401e3a', border:'rgba(244,63,94,.1)', border2:'rgba(244,63,94,.16)',
            sidebarBg:'#1a0810', sidebarBrand:'#14060c', sidebarHover:'#28101a', sidebarActive:'#321828', sidebarBorder:'rgba(251,113,133,.12)',
            sidebarText:'#d8a8b8', sidebarTextDim:'#985878', sidebarAccent:'#fb7185', sidebarSection:'rgba(251,113,133,.45)',
            headerBg:'#301020', headerBorder:'rgba(244,63,94,.15)', headerText:'#f8e8f0', headerTextDim:'#b86878',
            theadBg:'#301020', theadText:'#c88898', theadBorder:'rgba(244,63,94,.15)', theadHover:'#fb7185' },
     light:{ bg:'#fff1f2', surface:'#ffffff', surface2:'#ffe8ea', surface3:'#ffd8de', border:'rgba(244,63,94,.1)', border2:'rgba(244,63,94,.15)',
             sidebarBg:'#ffe4e6', sidebarBrand:'#ffd6da', sidebarHover:'#fecdd3', sidebarActive:'#fda4af', sidebarBorder:'rgba(244,63,94,.15)',
             sidebarText:'#881337', sidebarTextDim:'#be123c', sidebarAccent:'#e11d48', sidebarSection:'rgba(244,63,94,.45)',
             headerBg:'#ffffff', headerBorder:'rgba(244,63,94,.08)', headerText:'#4c0519', headerTextDim:'#9a3050',
             theadBg:'#ffe4e6', theadText:'#881337', theadBorder:'rgba(244,63,94,.1)', theadHover:'#e11d48' }},
    {id:'royal', name:'Royal', primary:'#8b5cf6', primaryH:'#a78bfa',
     dark:{ bg:'#0c0618', surface:'#150e28', surface2:'#201840', surface3:'#2a2255', border:'rgba(139,92,246,.1)', border2:'rgba(139,92,246,.16)',
            sidebarBg:'#100a22', sidebarBrand:'#0c081a', sidebarHover:'#1a1238', sidebarActive:'#221848', sidebarBorder:'rgba(167,139,250,.12)',
            sidebarText:'#c0b0e0', sidebarTextDim:'#8070a8', sidebarAccent:'#a78bfa', sidebarSection:'rgba(167,139,250,.45)',
            headerBg:'#221548', headerBorder:'rgba(139,92,246,.15)', headerText:'#f0e8ff', headerTextDim:'#9888c0',
            theadBg:'#221548', theadText:'#a898d0', theadBorder:'rgba(139,92,246,.15)', theadHover:'#a78bfa' },
     light:{ bg:'#f5f3ff', surface:'#ffffff', surface2:'#ede9fe', surface3:'#e2ddf8', border:'rgba(139,92,246,.1)', border2:'rgba(139,92,246,.15)',
             sidebarBg:'#ede9fe', sidebarBrand:'#e0daf8', sidebarHover:'#d4ccf0', sidebarActive:'#c4b5fa', sidebarBorder:'rgba(139,92,246,.15)',
             sidebarText:'#3b1f8a', sidebarTextDim:'#6d28d9', sidebarAccent:'#7c3aed', sidebarSection:'rgba(139,92,246,.45)',
             headerBg:'#ffffff', headerBorder:'rgba(139,92,246,.08)', headerText:'#1e1065', headerTextDim:'#6850a8',
             theadBg:'#ede9fe', theadText:'#3b1f8a', theadBorder:'rgba(139,92,246,.1)', theadHover:'#7c3aed' }},
    {id:'midnight', name:'Midnight', primary:'#3b82f6', primaryH:'#60a5fa',
     dark:{ bg:'#060e1a', surface:'#0d1a2d', surface2:'#142640', surface3:'#1c3456', border:'rgba(59,130,246,.1)', border2:'rgba(59,130,246,.16)',
            sidebarBg:'#081428', sidebarBrand:'#061020', sidebarHover:'#0e2040', sidebarActive:'#142a50', sidebarBorder:'rgba(96,165,250,.12)',
            sidebarText:'#a8c0e0', sidebarTextDim:'#5888b8', sidebarAccent:'#60a5fa', sidebarSection:'rgba(96,165,250,.45)',
            headerBg:'#102848', headerBorder:'rgba(59,130,246,.15)', headerText:'#e8f0fa', headerTextDim:'#6898c8',
            theadBg:'#102848', theadText:'#88b0d8', theadBorder:'rgba(59,130,246,.15)', theadHover:'#60a5fa' },
     light:{ bg:'#eff6ff', surface:'#ffffff', surface2:'#e4f0fd', surface3:'#d0e4fa', border:'rgba(59,130,246,.1)', border2:'rgba(59,130,246,.15)',
             sidebarBg:'#dbeafe', sidebarBrand:'#cce0f8', sidebarHover:'#bfdbfe', sidebarActive:'#93c5fd', sidebarBorder:'rgba(59,130,246,.15)',
             sidebarText:'#1e3a5f', sidebarTextDim:'#1d4ed8', sidebarAccent:'#2563eb', sidebarSection:'rgba(59,130,246,.45)',
             headerBg:'#ffffff', headerBorder:'rgba(59,130,246,.08)', headerText:'#0a1628', headerTextDim:'#4878a8',
             theadBg:'#dbeafe', theadText:'#1e3a5f', theadBorder:'rgba(59,130,246,.1)', theadHover:'#2563eb' }},
    {id:'coffee', name:'Coffee', primary:'#d97706', primaryH:'#fbbf24',
     dark:{ bg:'#0e0a06', surface:'#1a1410', surface2:'#281e18', surface3:'#342820', border:'rgba(217,119,6,.1)', border2:'rgba(217,119,6,.16)',
            sidebarBg:'#141008', sidebarBrand:'#100c06', sidebarHover:'#201a10', sidebarActive:'#2a2218', sidebarBorder:'rgba(251,191,36,.12)',
            sidebarText:'#d0c0a0', sidebarTextDim:'#908058', sidebarAccent:'#fbbf24', sidebarSection:'rgba(251,191,36,.45)',
            headerBg:'#2a2018', headerBorder:'rgba(217,119,6,.15)', headerText:'#f8f0e0', headerTextDim:'#a89060',
            theadBg:'#2a2018', theadText:'#c0a878', theadBorder:'rgba(217,119,6,.15)', theadHover:'#fbbf24' },
     light:{ bg:'#fffbeb', surface:'#ffffff', surface2:'#fef3c7', surface3:'#fde68a', border:'rgba(217,119,6,.1)', border2:'rgba(217,119,6,.15)',
             sidebarBg:'#fef3c7', sidebarBrand:'#fde68a', sidebarHover:'#fcd34d', sidebarActive:'#fbbf24', sidebarBorder:'rgba(217,119,6,.15)',
             sidebarText:'#78350f', sidebarTextDim:'#a16207', sidebarAccent:'#b45309', sidebarSection:'rgba(217,119,6,.45)',
             headerBg:'#ffffff', headerBorder:'rgba(217,119,6,.08)', headerText:'#451a03', headerTextDim:'#806030',
             theadBg:'#fef3c7', theadText:'#78350f', theadBorder:'rgba(217,119,6,.1)', theadHover:'#b45309' }},
  ],

  _openColorPicker() {
    const uid = Auth.currentUser()?.username || 'default';
    const current = localStorage.getItem('becca_theme_id_' + uid) || 'default';
    const mid = 'theme-pick-'+Date.now();
    Modal.open({
      id: mid, title: 'Pilih Tema Warna', size: 'modal-md',
      body: `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:8px 0">
        ${this._THEMES.map(t => `
          <button onclick="App._applyFullTheme('${t.id}');Modal.close('${mid}')"
            style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border:2px solid ${t.id===current?t.primary:'transparent'};
            border-radius:12px;background:${t.id===current?t.primary+'15':'var(--surface2)'};cursor:pointer;transition:.2s"
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px ${t.primary}30'"
            onmouseout="this.style.transform='';this.style.boxShadow=''">
            <div style="width:100%;height:36px;border-radius:8px;overflow:hidden;display:flex">
              <div style="width:30%;background:${t.dark.sidebarBg}"></div>
              <div style="flex:1;display:flex;flex-direction:column">
                <div style="height:8px;background:${t.dark.headerBg}"></div>
                <div style="flex:1;background:${t.dark.bg};display:flex;align-items:center;justify-content:center">
                  <div style="width:60%;height:4px;border-radius:2px;background:${t.primary}"></div>
                </div>
              </div>
            </div>
            <span style="font-size:10px;font-weight:700;color:${t.id===current?t.primary:'var(--text-2)'}">${t.name}</span>
          </button>
        `).join('')}
      </div>`,
      buttons: [],
    });
  },

  /* Apply theme by setting ALL CSS variables — no !important hacks.
     Reads current light/dark mode and applies the matching palette. */
  _applyFullTheme(themeId) {
    const t = this._THEMES.find(x => x.id === themeId);
    if (!t) return;

    // Build CSS that sets ALL theme vars for both dark and light modes
    const _v = (obj) => Object.entries({
      '--primary': t.primary, '--primary-h': t.primaryH, '--primary-bg': t.primary + '1a',
      '--bg': obj.bg, '--surface': obj.surface, '--surface2': obj.surface2, '--surface3': obj.surface3,
      '--border': obj.border, '--border2': obj.border2,
      '--sidebar-bg': obj.sidebarBg, '--sidebar-brand-bg': obj.sidebarBrand,
      '--sidebar-hover': obj.sidebarHover, '--sidebar-active': obj.sidebarActive,
      '--sidebar-border': obj.sidebarBorder, '--sidebar-text': obj.sidebarText,
      '--sidebar-text-dim': obj.sidebarTextDim, '--sidebar-accent': obj.sidebarAccent,
      '--sidebar-section': obj.sidebarSection,
      '--header-bg': obj.headerBg, '--header-border': obj.headerBorder,
      '--header-text': obj.headerText, '--header-text-dim': obj.headerTextDim,
      '--thead-bg': obj.theadBg, '--thead-text': obj.theadText,
      '--thead-border': obj.theadBorder, '--thead-hover': obj.theadHover,
    }).map(([k,v]) => k+':'+v).join(';');

    let css = document.getElementById('becca-theme-color-css');
    if (!css) { css = document.createElement('style'); css.id = 'becca-theme-color-css'; document.head.appendChild(css); }
    css.textContent = `
      :root,[data-theme="dark"]{ ${_v(t.dark)} }
      [data-theme="light"]{ ${_v(t.light)} }
      .btn-primary{background:${t.primary};border-color:${t.primary}}
      .btn-primary:hover{background:${t.primaryH}}
    `;

    const uid = Auth.currentUser()?.username || 'default';
    localStorage.setItem('becca_theme_id_' + uid, themeId);
    const btn = document.getElementById('btn-color');
    if (btn) btn.querySelector('div').style.background = t.primary;
    Notify.success('Tema "' + t.name + '" diterapkan');
  },

  _loadUserColor() {
    const uid = Auth.currentUser()?.username || 'default';
    const themeId = localStorage.getItem('becca_theme_id_' + uid);
    if (themeId && themeId !== 'default') this._applyFullTheme(themeId);
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
    // Inject light mode CSS — sets ALL theme vars for default light palette
    if (!document.getElementById('becca-light-mode-css')) {
      const style = document.createElement('style');
      style.id = 'becca-light-mode-css';
      style.textContent = `
        [data-theme="light"] {
          --bg:          #f0f2f8;
          --surface:     #ffffff;
          --surface2:    #f0f1f8;
          --surface3:    #e8eaf4;
          --border:      rgba(99,102,241,.1);
          --border2:     rgba(99,102,241,.15);
          --text:        #111827;
          --text-2:      #4b5563;
          --text-3:      #9ca3af;
          --heading:     #030712;
          --overlay:     rgba(0,0,0,.35);
          --shadow-sm:   0 1px 2px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.04);
          --shadow-md:   0 4px 12px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.04);
          --shadow-lg:   0 12px 40px rgba(0,0,0,.1), 0 4px 12px rgba(0,0,0,.05);
          /* Sidebar — theme-colored, darker than header */
          --sidebar-bg:       #e4e7f8;
          --sidebar-brand-bg: #dce0f5;
          --sidebar-hover:    #d0d5f0;
          --sidebar-active:   #c4caec;
          --sidebar-border:   rgba(99,102,241,.12);
          --sidebar-text:     #2d3258;
          --sidebar-text-dim: #5b60a0;
          --sidebar-accent:   #4f46e5;
          --sidebar-section:  rgba(99,102,241,.4);
          /* Header — lighter than sidebar */
          --header-bg:        #ffffff;
          --header-border:    rgba(99,102,241,.08);
          --header-text:      #111827;
          --header-text-dim:  #6b7280;
          /* Table head — senada sidebar */
          --thead-bg:         #e4e7f8;
          --thead-text:       #3b4070;
          --thead-border:     rgba(99,102,241,.1);
          --thead-hover:      #4f46e5;
          --primary-bg:       rgba(99,102,241,.08);
          color-scheme: light;
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
    clearInterval(this._presenceInterval);
    clearInterval(this._onlineUsersInterval);
    if (typeof DBExtensions !== 'undefined') DBExtensions.stop();
    await Auth.logout();
    location.reload();
  },
};

document.addEventListener('DOMContentLoaded', () => App.boot());
window.App = App;
