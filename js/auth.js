/* ============================================
   BECCA V2.0 â€” Auth Module
   Login, logout, session, privilege check,
   user management, activity log
============================================ */
const Auth = {
  _user: null,
  _SESSION_KEY: 'session',

  // Default users — NO passwords (login only works via Supabase-stored users)
  _defaultUsers: [
    { id: 'u1', username: 'superadmin', nama: 'Super Admin',   role: 'superadmin', email: '', aktif: true },
    { id: 'u2', username: 'admin',      nama: 'Administrator', role: 'admin',      email: '', aktif: true },
    { id: 'u3', username: 'operator',   nama: 'Operator',      role: 'operator',   email: '', aktif: true },
    { id: 'u4', username: 'viewer',     nama: 'Viewer',        role: 'viewer',     email: '', aktif: true },
  ],

  _defaultPrivileges: {
    superadmin: { all: true },
    admin:    { dashboard:'view', order:'all', invoice:'all', customer:'all', employee:'all', emp_finance:'all', inventory:'all', kas:'all', ap:'all', po:'all', task:'all', 'daily-order':'all', delivery:'all', menu:'all', chat:'all', personal:'all', report:'view', settings:'all', news:'all' },
    finance:  { dashboard:'view', kas:'all', ap:'view', po:'view', employee:'view', emp_finance:'all', chat:'all', personal:'all', report:'view', news:'view' },
    operator: { dashboard:'view', order:'all', invoice:'view', customer:'view', inventory:'all', kas:'view', ap:'view', po:'all', task:'all', 'daily-order':'all', delivery:'all', chat:'all', personal:'all', report:'view', news:'view' },
    viewer:   { dashboard:'view', order:'view', invoice:'view', customer:'view', chat:'all', personal:'all', report:'view', news:'view' },
  },

  _SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes

  /* ===================== INIT ===================== */
  init() {
    const saved = Utils.ls.get(this._SESSION_KEY);
    if (saved) { this._user = saved; }
    if (!this._user) {
      const sess = sessionStorage.getItem(this._SESSION_KEY);
      if (sess) { try { this._user = JSON.parse(sess); } catch {} }
    }
    if (!this._user) return false;
    // Check session timeout
    const lastActive = parseInt(localStorage.getItem('becca_last_active') || '0');
    if (lastActive && (Date.now() - lastActive) > this._SESSION_TIMEOUT) {
      console.log('[Auth] Session expired (idle > 30 min)');
      this._user = null;
      Utils.ls.del(this._SESSION_KEY);
      sessionStorage.removeItem(this._SESSION_KEY);
      localStorage.removeItem('becca_last_active');
      return false;
    }
    this._trackActivity();
    return true;
  },

  _trackActivity() {
    // Update last active on user interaction
    const update = () => { localStorage.setItem('becca_last_active', String(Date.now())); };
    update();
    ['click','keydown','touchstart'].forEach(e => document.addEventListener(e, update, { passive:true, once:false }));
  },

  /* ===================== LOGIN ===================== */
  async login(username, password, remember = false) {
    let users = [];
    try {
      const raw = await DB.getUsers();
      // Filter skeleton rows (Supabase rows tanpa data JSONB) — tidak punya username yang valid
      users = raw.filter(u => u && u.username);
    } catch(e) {}
    // Fallback: baca dari becca_auth_users yang di-sync oleh settings
    if (!users.length) {
      try {
        const synced = JSON.parse(localStorage.getItem('becca_auth_users') || '[]');
        if (synced.length) users = synced;
      } catch(e2) {}
    }
    // Fallback: baca dari Supabase settings._users (cross-device, reliable)
    if (!users.length) {
      try {
        const cfg = await DB.getSettings();
        if (Array.isArray(cfg._users) && cfg._users.length) users = cfg._users;
      } catch(e3) {}
    }
    if (!users.length) throw new Error('Tidak dapat terhubung ke server. Pastikan koneksi internet aktif.');

    const user = users.find(u =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password === password &&
      u.aktif !== false
    );
    if (!user) throw new Error('Username atau password salah, atau akun tidak aktif');

    this._user = { ...user };
    const mustChange = user.mustChangePassword === true;
    delete this._user.password;

    if (remember) {
      Utils.ls.set(this._SESSION_KEY, this._user);
    } else {
      sessionStorage.setItem(this._SESSION_KEY, JSON.stringify(this._user));
    }
    localStorage.setItem('becca_last_active', String(Date.now()));
    this._trackActivity();

    if (mustChange) {
      sessionStorage.setItem('becca_must_change_pwd', '1');
    }

    try { await DB.logActivity({ type: 'login', detail: 'Login berhasil' }); } catch {}

    // Daftarkan push token di background (tidak block login)
    setTimeout(async () => {
      if (!window.PushModule) { console.warn('[Push] PushModule belum loaded'); return; }
      try {
        const token = await PushModule.requestAndRegister(this._user);
        console.log('[Push] Token:', token ? 'OK ('+token.slice(0,20)+'...)' : 'GAGAL / ditolak');
      } catch(e) { console.error('[Push] Register error:', e); }
    }, 3000);

    return this._user;
  },

  /* ===================== LOGOUT ===================== */
  async logout() {
    try { await DB.logActivity({ type: 'logout', detail: 'Logout' }); } catch {}
    this._user = null;
    Utils.ls.del(this._SESSION_KEY);
    sessionStorage.removeItem(this._SESSION_KEY);
  },

  /* ===================== CURRENT USER ===================== */
  currentUser() {
    if (this._user) return this._user;
    const sess = sessionStorage.getItem(this._SESSION_KEY);
    if (sess) { try { this._user = JSON.parse(sess); } catch {} }
    return this._user;
  },

  isLoggedIn()   { return !!this.currentUser(); },
  isSuperAdmin() { return this.currentUser()?.role === 'superadmin'; },

  /* ===================== PRIVILEGE CHECK ===================== */
  can(feature, action = 'view') {
    const user = this.currentUser();
    if (!user) return false;
    const priv = this._getPrivileges(user.role);
    if (priv.all) return true;
    const p = priv[feature];
    if (!p) return false;
    if (p === 'all') return true;
    if (p === 'view' && action === 'view') return true;
    return false;
  },

  _privCache: null,
  _privCacheTs: 0,

  _getPrivileges(role) {
    const now = Date.now();
    // Cache privileges for 30s — avoid parsing localStorage on every .can() call
    if (!this._privCache || now - this._privCacheTs > 30000) {
      try { this._privCache = JSON.parse(localStorage.getItem('becca_privileges') || 'null'); } catch {}
      this._privCacheTs = now;
    }
    const defaults = this._defaultPrivileges[role] || this._defaultPrivileges['operator'];
    const custom = this._privCache;
    if (custom && custom[role] && Object.keys(custom[role]).length > 0) {
      return { ...defaults, ...custom[role] };
    }
    return defaults;
  },

  // Call after saving privileges to bust cache immediately
  _bustPrivCache() { this._privCache = null; this._privCacheTs = 0; },

  /* ===================== RENDER LOGIN ===================== */
  renderLogin() {
    const el = document.getElementById('page-login');
    el.innerHTML = `
      <div class="login-card">
        <div class="login-brand">
          <div class="login-logo">B</div>
          <div>
            <div class="login-title">BECCA</div>
            <div class="login-sub">Catering Order System v2.0</div>
          </div>
        </div>
        <form id="login-form" novalidate>
          <div class="form-group">
            <label class="form-label">Username</label>
            <div class="input-group">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input name="username" class="form-control" placeholder="Masukkan username" autocomplete="username" autofocus>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="input-group">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input name="password" type="password" class="form-control" placeholder="Masukkan password" autocomplete="current-password">
            </div>
          </div>
          <label class="form-check" style="margin-bottom:var(--s4)">
            <input type="checkbox" name="remember">
            <span class="form-check-label text-muted text-small">Ingat saya</span>
          </label>
          <button type="submit" class="btn btn-primary w-full btn-lg" id="login-btn">Masuk ke BECCA</button>
          <div id="login-error" class="form-error mt-1" style="text-align:center;display:none"></div>
        </form>
      </div>
    `;
    document.getElementById('login-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = document.getElementById('login-btn');
      const errEl = document.getElementById('login-error');
      btn.disabled = true; btn.textContent = 'Memproses...'; errEl.style.display = 'none';
      try {
        await Auth.login(fd.get('username'), fd.get('password'), !!fd.get('remember'));
        App.boot();
      } catch(err) {
        errEl.textContent = err.message; errEl.style.display = 'block';
      } finally {
        btn.disabled = false; btn.textContent = 'Masuk ke BECCA';
      }
    };
  },

  _fillDemo(u, p) {
    document.querySelector('[name=username]').value = u;
    document.querySelector('[name=password]').value = p;
  },
};
window.Auth = Auth;
