/* ============================================
   BECCA V2.0 — Sidebar Navigation
   ============================================ */

const Sidebar = {
  _items: [
    { id: 'dashboard',  label: 'Dashboard',   section: 'MENU UTAMA',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>` },
    { id: 'order',      label: 'Order',        section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>` },
    { id: 'invoice',    label: 'Invoice',      section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` },
    { id: 'customer',   label: 'Customer',     section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>` },
    { id: 'employee',   label: 'Karyawan',     section: 'OPERASIONAL',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
    { id: 'inventory',  label: 'Inventory',    section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>` },
    { id: 'kas',        label: 'Kas Kecil',    section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>` },
    { id: 'ap',         label: 'Account Payable', section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>` },
    { id: 'task',       label: 'Task',         section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>` },
    { id: 'report',     label: 'Laporan',      section: 'LAPORAN',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>` },
    { id: 'settings',   label: 'Pengaturan',   section: 'SISTEM',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>` },
  ],

  render() {
    const sidebar = document.getElementById('sidebar');
    const user = Auth.currentUser();
    let prevSection = null;
    let html = `
      <div class="sidebar-brand">
        <div class="sidebar-logo">B</div>
        <div class="sidebar-name">BECCA <span style="font-weight:300;opacity:.6">v2.0</span></div>
      </div>
      <nav class="sidebar-nav">
    `;

    this._items.forEach(item => {
      // Cek privilege
      if (!Auth.can(item.id, 'view')) return;

      if (item.section && item.section !== prevSection) {
        html += `<div class="sidebar-section">${item.section}</div>`;
        prevSection = item.section;
      }
      html += `
        <div class="nav-item" data-page="${item.id}" onclick="App.navigate('${item.id}')">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </div>
      `;
    });

    html += `</nav>`;

    if (user) {
      html += `
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar">${Utils.initials(user.nama)}</div>
            <div class="user-info">
              <div class="user-name">${user.nama}</div>
              <div class="user-role">${user.role}</div>
            </div>
          </div>
        </div>
      `;
    }

    sidebar.innerHTML = html;
  },

  setActive(pageId) {
    Utils.$$('.nav-item', document.getElementById('sidebar')).forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });
  },

  toggle() {
    document.getElementById('sidebar').classList.toggle('collapsed');
  },
};

window.Sidebar = Sidebar;
