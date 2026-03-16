/* ============================================
   BECCA V2.0 — App (Main Entry Point)
   Router, boot, notifications, logout
============================================ */
const App = {
  _currentPage: 'dashboard',
  _firebaseConfig: {},

  get _modules() {
    return {
      dashboard : typeof DashboardModule  !== 'undefined' ? DashboardModule  : null,
      order     : typeof OrderModule      !== 'undefined' ? OrderModule      : null,
      invoice   : typeof InvoiceModule    !== 'undefined' ? InvoiceModule    : null,
      customer  : typeof CustomerModule   !== 'undefined' ? CustomerModule   : null,
      kas       : typeof KasModule        !== 'undefined' ? KasModule        : null,
      inventory : typeof InventoryModule  !== 'undefined' ? InventoryModule  : null,
      employee  : typeof EmployeeModule   !== 'undefined' ? EmployeeModule   : null,
      ap        : typeof APModule         !== 'undefined' ? APModule         : null,
      task      : typeof TaskModule       !== 'undefined' ? TaskModule       : null,
      report    : typeof ReportModule     !== 'undefined' ? ReportModule     : null,
      settings  : typeof SettingsModule   !== 'undefined' ? SettingsModule   : null,
    };
  },

  async boot() {
    DB.init(this._firebaseConfig);
    if (!Auth.init()) { this._showLogin(); return; }
    this._showApp();
  },

  _showLogin() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('page-login').style.display = '';
    Auth.renderLogin();
  },

  _showApp() {
    document.getElementById('page-login').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    if (!document.getElementById('sidebar-overlay')) {
      const ov = document.createElement('div');
      ov.id = 'sidebar-overlay';
      ov.onclick = () => this._closeMobileSidebar();
      document.body.appendChild(ov);
    }
    Sidebar.render();
    this._renderHeader();
    this.navigate(Utils.ls.get('becca_lastPage') || 'dashboard');
    this._handleResize();
    window.addEventListener('resize', () => this._handleResize());
    setTimeout(() => { if (typeof NotifCenter !== 'undefined') NotifCenter.refresh(); }, 800);
  },

  _handleResize() {
    const s = document.getElementById('sidebar');
    if (!s) return;
    if (window.innerWidth <= 768) { s.classList.remove('collapsed','mobile-open'); }
    else if (window.innerWidth <= 1100) { s.classList.add('collapsed'); s.classList.remove('mobile-open'); }
    else { s.classList.remove('collapsed','mobile-open'); }
  },

  _closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    document.body.classList.remove('sidebar-open');
  },

  _closeUserMenu() {
    document.getElementById('user-menu')?.classList.add('hidden');
  },

  _renderHeader() {
    const user = Auth.currentUser();
    const initials = Utils.initials ? Utils.initials(user?.nama||'?') : (user?.nama||'?').substring(0,2).toUpperCase();
    document.getElementById('header').innerHTML = `
      <div class="header-left">
        <button id="btn-toggle-sidebar" onclick="App._toggleSidebar()" title="Toggle Sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span class="page-title" id="header-page-title">Dashboard</span>
      </div>
      <div class="header-right">
        <button class="header-btn" id="btn-notif" onclick="App._openNotif()" title="Notifikasi" style="position:relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span id="notif-badge" style="display:none;position:absolute;top:4px;right:4px;min-width:14px;height:14px;
            background:var(--danger);border-radius:999px;font-size:8px;font-weight:700;color:white;
            border:1.5px solid var(--surface);align-items:center;justify-content:center;padding:0 2px"></span>
        </button>
        <div style="position:relative">
          <button id="btn-user" onclick="App._toggleUserMenu()" title="Akun"
                  style="display:flex;align-items:center;gap:6px;background:transparent;border:1px solid var(--border);
                         border-radius:var(--r-sm);padding:4px 10px;cursor:pointer;transition:all var(--t-base)"
                  onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
            <div style="width:22px;height:22px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white">${initials}</div>
            <span style="font-size:12px;font-weight:500;color:var(--text-2);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user?.nama||''}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10" style="color:var(--text-3)"><polyline points="6,9 12,15 18,9"/></svg>
          </button>
          <div id="user-menu" class="hidden"
               style="position:absolute;right:0;top:calc(100% + 6px);background:var(--surface);
                      border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);
                      min-width:200px;z-index:9999;overflow:hidden">
            <div style="padding:12px var(--s4);border-bottom:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px">${user?.nama||''}</div>
              <div style="font-size:11px;color:var(--text-3)">${user?.role||''}</div>
            </div>
            <button class="dropdown-item" onclick="App.navigate('settings');App._closeUserMenu()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Pengaturan
            </button>
            <div style="border-top:1px solid var(--border);margin:4px 0"></div>
            <button class="dropdown-item" onclick="App.logout()" style="color:var(--danger)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    `;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-user') && !e.target.closest('#user-menu')) {
        document.getElementById('user-menu')?.classList.add('hidden');
      }
    });
  },

  _toggleSidebar() {
    const s = document.getElementById('sidebar');
    if (!s) return;
    if (window.innerWidth <= 768) { s.classList.toggle('mobile-open'); document.body.classList.toggle('sidebar-open'); }
    else s.classList.toggle('collapsed');
  },

  _toggleUserMenu() { document.getElementById('user-menu')?.classList.toggle('hidden'); },

  async _openNotif() {
    this._closeUserMenu();
    if (typeof NotifCenter !== 'undefined') await NotifCenter.showPanel();
  },

  async navigate(pageId) {
    this._closeMobileSidebar(); this._closeUserMenu();
    if (!Auth.can(pageId,'view') && pageId !== 'dashboard') {
      Notify.warning('Akses Ditolak','Anda tidak punya akses ke halaman ini'); return;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    let page = document.getElementById(`page-${pageId}`);
    if (!page) { this._renderComingSoon(pageId); return; }
    page.classList.add('active');
    const content = document.getElementById('content');
    if (content) content.scrollTop = 0;
    this._currentPage = pageId;
    Sidebar.setActive(pageId);
    const titles = {dashboard:'Dashboard',order:'Order Catering',invoice:'Invoice',customer:'Data Customer',
      employee:'Karyawan',inventory:'Inventory',kas:'Kas Kecil',ap:'Account Payable',task:'Task',report:'Laporan',settings:'Pengaturan'};
    const titleEl = document.getElementById('header-page-title');
    if (titleEl) titleEl.textContent = titles[pageId] || pageId;
    Utils.ls.set('becca_lastPage', pageId);
    const mod = this._modules[pageId];
    if (mod && typeof mod.init === 'function') {
      try { await mod.init(); }
      catch(err) { console.error(`Error init ${pageId}:`, err); Notify.error(`Error memuat ${pageId}`, err.message); }
    }
  },

  _renderComingSoon(pageId) {
    let page = document.getElementById(`page-${pageId}`);
    if (!page) {
      page = document.createElement('section');
      page.id = `page-${pageId}`; page.className = 'page';
      document.getElementById('content').appendChild(page);
    }
    page.innerHTML = `<div class="empty-state" style="height:60vh">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56"><circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 015.12-2.12A3 3 0 0115 9c0 1.5-1.5 2.5-3 3v1M12 18h.01"/></svg>
      <h4>Modul Segera Hadir</h4><p>Modul <strong>${pageId}</strong> sedang dalam pengembangan.</p>
    </div>`;
    page.classList.add('active'); Sidebar.setActive(pageId);
  },

  async logout() {
    this._closeUserMenu();
    const ok = await Modal.confirm({ title:'Logout', message:'Yakin ingin keluar dari BECCA?', confirmText:'Ya, Logout' });
    if (!ok) return;
    await Auth.logout();
    location.reload();
  },
};

document.addEventListener('DOMContentLoaded', () => App.boot());
window.App = App;
