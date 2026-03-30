/* ============================================
   BECCA V2.0 — Sidebar Navigation
   ============================================ */

const Sidebar = {
  _items: [
    { id: 'dashboard',  label: 'Dashboard',       section: 'MENU UTAMA',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>` },
    { id: 'order',      label: 'Order',            section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>` },
    { id: 'invoice',    label: 'Invoice',          section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>` },
    { id: 'customer',   label: 'Customer',         section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>` },
    { id: 'news',       label: 'News',             section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2z"/><path d="M17 20v-8H7v8M7 4v4h8"/></svg>` },
    { id: 'employee',   label: 'Karyawan',         section: 'OPERASIONAL',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>` },
    { id: 'daily-order',label: 'Daily Order',       section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14l2 2 4-4"/></svg>` },
    { id: 'inventory',  label: 'Inventory',        section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>` },
    { id: 'kas',        label: 'Kas Kecil',        section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>` },
    { id: 'ap',         label: 'Account Payable',  section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>` },
    { id: 'task',       label: 'Task',             section: null,
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>` },
    { id: 'report',     label: 'Laporan',          section: 'LAPORAN',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>` },
    { id: 'settings',   label: 'Pengaturan',       section: 'SISTEM',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>` },
  ],

  // render() async: baca settings dari DB agar nama/logo perusahaan selalu terbaru
  async render() {
    const sidebar  = document.getElementById('sidebar');
    const user     = Auth.currentUser();

    // Baca dari DB (bukan Utils.ls.get) agar dapat data terbaru
    const settings = await DB.getSettings().catch(() => ({}));
    const compName = settings.namaPerusahaan || '';
    const tagline  = settings.tagline || '';
    const logoUrl  = settings.logoUrl || '';

    // ── Brand area pakai class CSS asli ──────────────────────
    let logoContent;
    if (logoUrl) {
      logoContent = `<div class="sidebar-logo" style="background:transparent;padding:0;overflow:hidden">
        <img src="${logoUrl}" style="width:32px;height:32px;object-fit:contain;display:block">
      </div>`;
    } else {
      const letter = compName ? compName.substring(0,1).toUpperCase() : 'B';
      logoContent = `<div class="sidebar-logo">${letter}</div>`;
    }

    let nameHtml;
    if (compName) {
      nameHtml = `<div class="sidebar-name" style="line-height:1.2">
        <div>${compName}</div>
        ${tagline ? `<div style="font-size:10px;font-weight:400;color:var(--text-3);overflow:hidden;text-overflow:ellipsis">${tagline}</div>` : ''}
      </div>`;
    } else {
      nameHtml = `<div class="sidebar-name">BECCA <span style="opacity:.5;font-weight:400;font-size:12px">v2.0</span></div>`;
    }

    let html = `
      <div class="sidebar-brand">
        ${logoContent}
        ${nameHtml}
      </div>
      <nav class="sidebar-nav">
    `;

    // Section label style: lebih kecil dan halus
    const sectionStyle = 'font-size:9px;font-weight:700;letter-spacing:.08em;opacity:.6;padding-left:var(--s4);';

    let lastSection = '';
    this._items.forEach(item => {
      if (!Auth.can(item.id, 'view')) return;

      if (item.section && item.section !== lastSection) {
        lastSection = item.section;
        html += `<div class="nav-section" style="${sectionStyle}">${item.section}</div>`;
      }
      html += `
        <div class="nav-item" data-page="${item.id}" onclick="App.navigate('${item.id}')">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          ${item.id === 'news' ? `<span id="news-nav-badge" style="display:none;background:#ef4444;color:#fff;border-radius:999px;font-size:9px;font-weight:700;min-width:16px;height:16px;align-items:center;justify-content:center;margin-left:auto;padding:0 4px"></span>` : ''}
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
          <div style="text-align:center;padding:4px 0 2px;font-size:9px;color:var(--text-3);opacity:.4;letter-spacing:.04em">
            Powered by <strong style="color:var(--primary-h)">BECCA</strong> System
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
