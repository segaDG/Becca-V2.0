/* ============================================
   BECCA V2.0 — Bottom Navigation (mobile only)
   Role-aware quick access bar, visible only at <768px
   Reuses icon strings from Sidebar._items to avoid duplication.
   ============================================ */

const BottomNav = {
  // Per-role primary modules (max 4 + More).
  // If a role-specific list isn't found, falls back to the role's _roleBase.
  _byRole: {
    superadmin: ['dashboard', 'daily-order', 'kas',  'inventory'],
    admin:      ['dashboard', 'daily-order', 'kas',  'inventory'],
    finance:    ['dashboard', 'kas',          'ap',  'po'],
    operator:   ['dashboard', 'daily-order', 'order','inventory'],
    viewer:     ['dashboard', 'order',        'customer', 'news'],
  },

  _getPrimaryIds(user) {
    if (!user) return this._byRole.viewer;
    const role = user.role || 'viewer';
    if (this._byRole[role]) return this._byRole[role];
    // Custom role → resolve via Auth._roleBase
    const base = (Auth._roleBase && Auth._roleBase[role]) || 'operator';
    return this._byRole[base] || this._byRole.viewer;
  },

  _findIcon(id) {
    const item = (window.Sidebar?._items || []).find(i => i.id === id);
    return item?.icon || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
  },

  _findLabel(id) {
    const labels = {
      'dashboard':'Home', 'daily-order':'Daily', 'kas':'Kas',
      'inventory':'Stok', 'order':'Order', 'invoice':'Invoice',
      'customer':'Customer', 'ap':'AP', 'po':'PO', 'news':'News',
      'employee':'Karyawan', 'task':'Task', 'menu':'Menu',
      'delivery':'Delivery', 'chat':'Chat', 'personal':'Personal',
      'report':'Laporan', 'settings':'Setting',
    };
    return labels[id] || id;
  },

  _injectStyles() {
    if (document.getElementById('bottom-nav-styles')) return;
    const s = document.createElement('style');
    s.id = 'bottom-nav-styles';
    s.textContent = `
      #bottom-nav{
        display:none;position:fixed;left:0;right:0;bottom:0;z-index:150;
        background:var(--surface);border-top:1px solid var(--border);
        box-shadow:0 -2px 12px rgba(0,0,0,0.18);
        padding-bottom:env(safe-area-inset-bottom,0px);
      }
      body.has-bottom-nav #bottom-nav{display:flex}
      #bottom-nav .bn-item{
        flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:2px;padding:8px 4px;min-height:60px;
        background:transparent;border:none;cursor:pointer;
        color:var(--text-3);font-size:10px;font-weight:600;font-family:var(--font);
        transition:color var(--t-fast);
        -webkit-tap-highlight-color:transparent;
      }
      #bottom-nav .bn-item svg{width:22px;height:22px;stroke-width:2}
      #bottom-nav .bn-item.active{color:var(--primary)}
      #bottom-nav .bn-item:active{background:var(--surface2)}
      #bottom-nav .bn-item .bn-badge{
        position:absolute;top:6px;margin-left:18px;
        background:#ef4444;color:#fff;border-radius:99px;
        font-size:9px;font-weight:700;min-width:14px;height:14px;
        display:flex;align-items:center;justify-content:center;padding:0 3px;
      }
      /* Hide on desktop */
      @media (min-width:769px){
        #bottom-nav{display:none!important}
        body.has-bottom-nav #content{padding-bottom:initial}
      }
      /* More drawer (bottom sheet) */
      #bn-more-sheet{
        position:fixed;inset:0;z-index:1100;display:none;
        background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);
      }
      #bn-more-sheet.open{display:block;animation:bnFade .2s ease}
      #bn-more-sheet .bn-sheet{
        position:absolute;left:0;right:0;bottom:0;
        background:var(--surface);border-radius:var(--r-lg) var(--r-lg) 0 0;
        padding:var(--s5) var(--s4) calc(var(--s4) + env(safe-area-inset-bottom,0px));
        max-height:75vh;overflow-y:auto;
        animation:bnSlide .25s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes bnFade{from{opacity:0}to{opacity:1}}
      @keyframes bnSlide{from{transform:translateY(100%)}to{transform:translateY(0)}}
      #bn-more-sheet .bn-sheet-handle{
        width:36px;height:4px;background:var(--border2);border-radius:2px;
        margin:0 auto var(--s4);
      }
      #bn-more-sheet .bn-sheet-title{
        font-size:11px;font-weight:700;color:var(--text-3);
        text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s3);
      }
      #bn-more-sheet .bn-grid{
        display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);
      }
      #bn-more-sheet .bn-grid-item{
        display:flex;flex-direction:column;align-items:center;gap:6px;
        padding:12px 4px;background:var(--surface2);border-radius:var(--r-md);
        cursor:pointer;border:1px solid var(--border);
        color:var(--text-2);font-size:11px;font-weight:600;text-align:center;
        transition:all var(--t-fast);
      }
      #bn-more-sheet .bn-grid-item:active{background:var(--surface3);transform:scale(0.97)}
      #bn-more-sheet .bn-grid-item svg{width:22px;height:22px;color:var(--primary)}
      #bn-more-sheet .bn-grid-item.active{
        background:var(--primary-bg);border-color:var(--primary);color:var(--primary-h);
      }
    `;
    document.head.appendChild(s);
  },

  render() {
    this._injectStyles();
    const user = Auth.currentUser?.();
    if (!user) {
      // No user — hide bottom nav entirely
      document.body.classList.remove('has-bottom-nav');
      const el = document.getElementById('bottom-nav');
      if (el) el.remove();
      return;
    }

    const primary = this._getPrimaryIds(user);
    // Filter by Auth.can — if user doesn't have view access to a primary item, skip it
    const allowed = primary.filter(id => Auth.can(id, 'view'));
    if (allowed.length < 1) {
      document.body.classList.remove('has-bottom-nav');
      const el = document.getElementById('bottom-nav');
      if (el) el.remove();
      return;
    }

    // Build item HTML — primary items + More
    const itemHtml = allowed.map(id => `
      <button class="bn-item" data-page="${id}" onclick="BottomNav._navigate('${id}')" aria-label="${this._findLabel(id)}">
        ${this._findIcon(id)}
        <span>${this._findLabel(id)}</span>
        ${id === 'news' ? '<span class="bn-badge" id="bn-badge-news" style="display:none"></span>' : ''}
        ${id === 'po'   ? '<span class="bn-badge" id="bn-badge-po"   style="display:none"></span>' : ''}
      </button>
    `).join('');

    const moreHtml = `
      <button class="bn-item" data-page="__more" onclick="BottomNav.openMore()" aria-label="Menu lainnya">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        <span>Lainnya</span>
      </button>
    `;

    let nav = document.getElementById('bottom-nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'bottom-nav';
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'Navigasi utama mobile');
      document.body.appendChild(nav);
    }
    nav.innerHTML = itemHtml + moreHtml;
    document.body.classList.add('has-bottom-nav');

    // Sync active with current page
    this.setActive(window.App?._currentPage || '');
    // Sync news badge if present
    this._syncBadges();
  },

  _navigate(pageId) {
    if (typeof App !== 'undefined' && App.navigate) {
      App.navigate(pageId);
    }
    this.setActive(pageId);
    this.closeMore();
  },

  setActive(pageId) {
    const items = document.querySelectorAll('#bottom-nav .bn-item');
    items.forEach(el => el.classList.toggle('active', el.dataset.page === pageId));
    // Also highlight in More sheet (so user sees current selection there too)
    const moreItems = document.querySelectorAll('#bn-more-sheet .bn-grid-item');
    moreItems.forEach(el => el.classList.toggle('active', el.dataset.page === pageId));
  },

  _syncBadges() {
    // News badge: count unread items
    try {
      const user = Auth.currentUser?.();
      const uid = user?.id || user?.username || 'anon';
      const items = JSON.parse(localStorage.getItem('becca_news') || '[]');
      const read  = new Set(JSON.parse(localStorage.getItem('becca_news_read_' + uid) || '[]'));
      const n = items.filter(i => !read.has(i.id)).length;
      const b = document.getElementById('bn-badge-news');
      if (b) {
        if (n > 0) { b.textContent = n > 9 ? '9+' : String(n); b.style.display = 'flex'; }
        else b.style.display = 'none';
      }
    } catch {}
    // PO badge: mirror sidebar #po-nav-badge if present
    try {
      const src = document.getElementById('po-nav-badge');
      const dst = document.getElementById('bn-badge-po');
      if (src && dst) {
        if (src.style.display === 'flex' && src.textContent) {
          dst.textContent = src.textContent;
          dst.style.display = 'flex';
        } else {
          dst.style.display = 'none';
        }
      }
    } catch {}
  },

  // === MORE SHEET ===
  openMore() {
    let sheet = document.getElementById('bn-more-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'bn-more-sheet';
      sheet.onclick = (e) => { if (e.target === sheet) BottomNav.closeMore(); };
      document.body.appendChild(sheet);
    }
    const user = Auth.currentUser?.();
    const primary = new Set(this._getPrimaryIds(user));
    // All other modules user has access to (excluded primary)
    const sidebarItems = window.Sidebar?._items || [];
    const more = sidebarItems
      .filter(it => !primary.has(it.id) && Auth.can(it.id, 'view'));

    const itemsHtml = more.map(it => `
      <button class="bn-grid-item" data-page="${it.id}" onclick="BottomNav._navigate('${it.id}')" aria-label="${it.label}">
        ${it.icon}
        <span>${it.label}</span>
      </button>
    `).join('');

    sheet.innerHTML = `
      <div class="bn-sheet" onclick="event.stopPropagation()">
        <div class="bn-sheet-handle"></div>
        <div class="bn-sheet-title">Menu Lainnya</div>
        <div class="bn-grid">
          ${itemsHtml || '<div style="grid-column:1/-1;text-align:center;color:var(--text-3);padding:var(--s4)">Tidak ada modul lain</div>'}
        </div>
      </div>
    `;
    requestAnimationFrame(() => sheet.classList.add('open'));
    // Sync active in sheet
    this.setActive(window.App?._currentPage || '');
    // Close on Escape
    this._escHandler = (e) => { if (e.key === 'Escape') this.closeMore(); };
    document.addEventListener('keydown', this._escHandler);
  },

  closeMore() {
    const sheet = document.getElementById('bn-more-sheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  },
};

window.BottomNav = BottomNav;
