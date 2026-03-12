/* ============================================
   BECCA V2.0 — App (Main Entry Point)
   Router, boot sequence, global state
   ============================================ */

const App = {
  _currentPage: 'dashboard',

  /* === Konfigurasi Firebase — ISI DENGAN CONFIG KAMU === */
  _firebaseConfig: {
    // apiKey: "YOUR_API_KEY",
    // authDomain: "YOUR_PROJECT.firebaseapp.com",
    // projectId: "YOUR_PROJECT_ID",
    // storageBucket: "YOUR_PROJECT.appspot.com",
    // messagingSenderId: "YOUR_SENDER_ID",
    // appId: "YOUR_APP_ID",
  },

  /* === Module registry === */
  _modules: {
    dashboard : DashboardModule,
    order     : OrderModule,
    kas       : KasModule,        // ← BARU
    inventory : InventoryModule,  // ← BARU
    employee  : EmployeeModule,   // ← BARU
    // invoice   : InvoiceModule,
    // customer  : CustomerModule,
    // ap        : APModule,
    // task      : TaskModule,
    // report    : ReportModule,
    // settings  : SettingsModule,
  },

  /* === Boot Sequence === */
  async boot() {
    // 1. Init DB
    DB.init(this._firebaseConfig);

    // 2. Cek session
    const loggedIn = Auth.init();
    if (!loggedIn) {
      this._showLogin();
      return;
    }

    // 3. Render App Shell
    this._showApp();
  },

  _showLogin() {
    Utils.hide(document.getElementById('app'));
    Utils.show(document.getElementById('page-login'));
    Auth.renderLogin();
  },

  _showApp() {
    Utils.hide(document.getElementById('page-login'));
    Utils.show(document.getElementById('app'));

    // Render sidebar
    Sidebar.render();

    // Render header
    this._renderHeader();

    // Navigate ke halaman default
    const lastPage = Utils.ls.get('becca_lastPage') || 'dashboard';
    this.navigate(lastPage);
  },

  _renderHeader() {
    document.getElementById('header').innerHTML = `
      <div class="header-left">
        <button id="btn-toggle-sidebar" onclick="Sidebar.toggle()" title="Toggle Sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div>
          <span class="page-title" id="header-page-title">Dashboard</span>
        </div>
      </div>
      <div class="header-right">
        <button class="header-btn" id="btn-notif" title="Notifikasi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span class="notif-badge" id="notif-badge" style="display:none"></span>
        </button>
        <div class="dropdown">
          <button class="header-btn" id="btn-user" onclick="App._toggleUserMenu()" title="Akun">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
          <div class="dropdown-menu hidden" id="user-menu">
            <div style="padding:10px var(--s4);border-bottom:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px">${Auth.currentUser()?.nama}</div>
              <div style="font-size:11px;color:var(--text-3)">${Auth.currentUser()?.role}</div>
            </div>
            <button class="dropdown-item" onclick="App.navigate('settings')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Pengaturan
            </button>
            <div class="dropdown-sep"></div>
            <button class="dropdown-item danger" onclick="App.logout()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    `;

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-user') && !e.target.closest('#user-menu')) {
        document.getElementById('user-menu')?.classList.add('hidden');
      }
    });
  },

  _toggleUserMenu() {
    document.getElementById('user-menu')?.classList.toggle('hidden');
  },

  /* === Navigation === */
  async navigate(pageId) {
    if (!Auth.can(pageId, 'view') && pageId !== 'dashboard') {
      Notify.warning('Akses Ditolak', 'Anda tidak punya akses ke halaman ini');
      return;
    }

    // Sembunyikan semua page, tampilkan yang aktif
    Utils.$$('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(`page-${pageId}`);
    if (!page) {
      this._renderComingSoon(pageId);
      return;
    }
    page.classList.add('active');

    // Update sidebar & header
    this._currentPage = pageId;
    Sidebar.setActive(pageId);

    const titles = {
      dashboard : 'Dashboard',
      order     : 'Order Catering',
      invoice   : 'Invoice',
      customer  : 'Data Customer',
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

    Utils.ls.set('becca_lastPage', pageId);

    // Init module
    const mod = this._modules[pageId];
    if (mod && typeof mod.init === 'function') {
      try {
        await mod.init();
      } catch (err) {
        console.error(`Error init ${pageId}:`, err);
        Notify.error(`Error memuat ${pageId}`, err.message);
      }
    }
  },

  _renderComingSoon(pageId) {
    let page = document.getElementById(`page-${pageId}`);
    if (!page) {
      page = document.createElement('section');
      page.id = `page-${pageId}`;
      page.className = 'page';
      document.getElementById('content').appendChild(page);
    }
    page.innerHTML = `
      <div class="empty-state" style="height:60vh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M9 9a3 3 0 015.12-2.12A3 3 0 0115 9c0 1.5-1.5 2.5-3 3v1M12 18h.01"/>
        </svg>
        <h4>Modul Segera Hadir</h4>
        <p>Modul <strong>${pageId}</strong> sedang dalam pengembangan</p>
      </div>
    `;
    page.classList.add('active');
    Sidebar.setActive(pageId);
  },

  /* === Logout === */
  async logout() {
    const ok = await Modal.confirm({
      title: 'Logout',
      message: 'Yakin ingin keluar dari BECCA?',
      confirmText: 'Ya, Logout',
    });
    if (!ok) return;
    await Auth.logout();
    location.reload();
  },
};

/* === BOOT === */
document.addEventListener('DOMContentLoaded', () => App.boot());

window.App = App;
