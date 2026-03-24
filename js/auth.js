/* ============================================
   BECCA V2.0 â€” Auth Module
   Login, logout, session, privilege check,
   user management, activity log
============================================ */
const Auth = {
  _user: null,
  _SESSION_KEY: 'session',

  _defaultUsers: [
    { id: 'u1', username: 'superadmin', password: 'admin123', nama: 'Super Admin',   role: 'superadmin', email: '', aktif: true },
    { id: 'u2', username: 'admin',      password: 'admin123', nama: 'Administrator', role: 'admin',      email: '', aktif: true },
    { id: 'u3', username: 'operator',   password: 'op123',    nama: 'Operator',      role: 'operator',   email: '', aktif: true },
    { id: 'u4', username: 'viewer',     password: 'view123',  nama: 'Viewer',        role: 'viewer',     email: '', aktif: true },
  ],

  _defaultPrivileges: {
    superadmin: { all: true },
    admin:    { dashboard:'view', order:'all', invoice:'all', customer:'all', employee:'all', inventory:'all', kas:'all', ap:'all', task:'all', report:'view', settings:'all' },
    operator: { dashboard:'view', order:'all', invoice:'view', customer:'view', inventory:'all', kas:'view', task:'all', report:'view' },
    viewer:   { dashboard:'view', order:'view', invoice:'view', customer:'view', report:'view' },
  },

  /* ===================== INIT ===================== */
  init() {
    const saved = Utils.ls.get(this._SESSION_KEY);
    if (saved) { this._user = saved; return true; }
    const sess = sessionStorage.getItem(this._SESSION_KEY);
    if (sess) { try { this._user = JSON.parse(sess); return true; } catch {} }
    return false;
  },

  /* ===================== LOGIN ===================== */
  async login(username, password, remember = false) {
    let users = [];
    try { users = await DB.getUsers(); } catch(e) {}
    // Fallback: baca dari becca_auth_users yang di-sync oleh settings
    if (!users.length) {
      try {
        const synced = JSON.parse(localStorage.getItem('becca_auth_users') || '[]');
        if (synced.length) users = synced;
      } catch(e2) {}
    }
    if (!users.length) users = this._defaultUsers;

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

    if (mustChange) {
      sessionStorage.setItem('becca_must_change_pwd', '1');
    }

    try { await DB.logActivity({ type: 'login', detail: 'Login berhasil' }); } catch {}
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

  _getPrivileges(role) {
    const custom = Utils.ls.get('becca_privileges');
    if (custom && custom[role]) return custom[role];
    return this._defaultPrivileges[role] || {};
  },

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
        <div style="margin-top:var(--s6);padding:var(--s4);background:var(--surface2);border-radius:var(--r-md);border:1px solid var(--border)">
          <div class="text-small text-muted mb-1" style="font-weight:600">Demo Accounts</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s2)">
            ${[['superadmin','admin123','Super Admin'],['admin','admin123','Admin'],['operator','op123','Operator'],['viewer','view123','Viewer']]
              .map(([u,p,label]) => `
                <div onclick="Auth._fillDemo('${u}','${p}')"
                     style="padding:6px 10px;background:var(--surface3);border-radius:var(--r-sm);cursor:pointer;font-size:12px;transition:background .15s"
                     onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='var(--surface3)'">
                  <div style="font-weight:600;color:var(--heading)">${label}</div>
                  <div style="color:var(--text-3)">${u} / ${p}</div>
                </div>
              `).join('')}
          </div>
        </div>
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
