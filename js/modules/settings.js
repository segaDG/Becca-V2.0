/* ============================================
   BECCA V2.0 — Settings Module
   User Management, Privilege, Activity Log,
   Notifikasi, Export/Import Data
============================================ */
const SettingsModule = (() => {

  // ROLES - default + custom yang ditambah user
  const _DEFAULT_ROLES = ['superadmin','admin','operator','viewer'];
  function _getRoles() {
    const extra = Utils.ls.get('becca_custom_roles') || [];
    return [..._DEFAULT_ROLES, ...extra.filter(r=>!_DEFAULT_ROLES.includes(r))];
  }
  const FEATURES = ['dashboard','order','invoice','customer','employee','inventory','kas','ap','task','report','settings'];

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-settings');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Pengaturan</h2>
          <p>Konfigurasi sistem, user, dan hak akses</p>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="umum"      onclick="SettingsModule.switchTab('umum')">⚙️ Umum</button>
        ${Auth.isSuperAdmin() ? `
          <button class="tab-btn" data-tab="users"     onclick="SettingsModule.switchTab('users')">👥 Users</button>
          <button class="tab-btn" data-tab="privilege" onclick="SettingsModule.switchTab('privilege')">🔐 Hak Akses</button>
        ` : ''}
        <button class="tab-btn" data-tab="activity" onclick="SettingsModule.switchTab('activity')">📋 Activity Log</button>
        <button class="tab-btn" data-tab="data"     onclick="SettingsModule.switchTab('data')">🗄️ Data</button>
      </div>
      <div id="set-tab-umum"></div>
      <div id="set-tab-users"     class="hidden"></div>
      <div id="set-tab-privilege" class="hidden"></div>
      <div id="set-tab-activity"  class="hidden"></div>
      <div id="set-tab-data"      class="hidden"></div>
    `;
    switchTab('umum');
  }

  function switchTab(tab) {
    ['umum','users','privilege','activity','data'].forEach(t => {
      document.getElementById(`set-tab-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    ({umum:renderUmum, users:renderUsers, privilege:renderPrivilege, activity:renderActivity, data:renderData})[tab]?.();
  }

  /* ===================== TAB: UMUM ===================== */
  async function renderUmum() {
    const user     = Auth.currentUser();
    const settings = await DB.getSettings().catch(() => ({}));
    document.getElementById('set-tab-umum').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:var(--s5)">

        <div class="card">
          <div class="card-header"><div class="card-title">👤 Profil Akun</div></div>
          <div style="padding:var(--s5)">
            <div style="display:flex;align-items:center;gap:var(--s4);margin-bottom:var(--s5)">
              <div style="width:56px;height:56px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white;flex-shrink:0">
                ${Utils.initials?Utils.initials(user?.nama||'?'):(user?.nama||'?').substring(0,2).toUpperCase()}
              </div>
              <div>
                <div style="font-weight:700;font-size:16px">${user?.nama||'-'}</div>
                <div style="color:var(--primary-h);font-size:12px;font-weight:600">${user?.role||'-'}</div>
                <div style="color:var(--text-3);font-size:12px">${user?.username||'-'}</div>
              </div>
            </div>
            <button class="btn btn-ghost w-full" onclick="SettingsModule.openChangePasswordModal()">🔑 Ganti Password</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">🏢 Pengaturan Perusahaan</div></div>
          <div style="padding:var(--s5)">
            <form id="settings-form">
              <div class="form-group">
                <label class="form-label">Nama Perusahaan</label>
                <input name="namaPerusahaan" class="form-control" value="${settings.namaPerusahaan||'BECCA Catering'}">
              </div>
              <div class="form-group">
                <label class="form-label">Alamat</label>
                <input name="alamat" class="form-control" value="${settings.alamat||''}">
              </div>
              <div class="form-group">
                <label class="form-label">No. Telepon</label>
                <input name="telp" class="form-control" value="${settings.telp||''}">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input name="email" type="email" class="form-control" value="${settings.email||''}">
              </div>
              <button type="button" class="btn btn-primary" onclick="SettingsModule.saveGeneralSettings()">💾 Simpan</button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">ℹ️ Info Aplikasi</div></div>
          <div style="padding:var(--s4)">
            ${[['Aplikasi','BECCA v2.0'],['Versi','2.0.0'],['Database','localStorage'],['Akun','segaDG']].map(([k,v])=>`
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                <span style="color:var(--text-3)">${k}</span><span style="font-weight:500">${v}</span>
              </div>`).join('')}
          </div>
        </div>

      </div>
    `;
  }

  async function saveGeneralSettings() {
    const fd = new FormData(document.getElementById('settings-form'));
    await DB.saveSettings(Object.fromEntries(fd.entries()));
    Notify.success('Pengaturan disimpan');
  }

  /* ===================== CHANGE PASSWORD ===================== */
  function openChangePasswordModal() {
    const mid = Utils.uid(); Modal.open({ id: mid,
      title: '🔑 Ganti Password',
      body: `
        <form id="pwd-form">
          <div class="form-group">
            <label class="form-label">Password Lama <span class="req">*</span></label>
            <input name="oldPwd" type="password" class="form-control" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password Baru <span class="req">*</span></label>
            <input name="newPwd" type="password" class="form-control" required minlength="6">
          </div>
          <div class="form-group">
            <label class="form-label">Konfirmasi Password Baru <span class="req">*</span></label>
            <input name="confirmPwd" type="password" class="form-control" required>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="SettingsModule._changePassword('${mid}')">Simpan</button>
      `,
    });
    return mid;
  }

  async function _changePassword(modalId) {
    const fd = new FormData(document.getElementById('pwd-form'));
    const { oldPwd, newPwd, confirmPwd } = Object.fromEntries(fd.entries());
    if (newPwd !== confirmPwd) { Notify.warning('Password baru tidak cocok'); return; }
    if (newPwd.length < 6)    { Notify.warning('Password minimal 6 karakter'); return; }

    const user  = Auth.currentUser();
    let users   = await DB.getUsers().catch(()=>[]);
    let dbUser  = users.find(u => u.id===user.id || u.username===user.username);

    if (!dbUser) {
      dbUser = { ...(Auth._defaultUsers.find(u=>u.username===user.username)||{}) };
      if (!dbUser.username) { Notify.error('User tidak ditemukan'); return; }
    }
    if (dbUser.password !== oldPwd) { Notify.error('Password lama salah'); return; }

    dbUser.password = newPwd;
    await DB.saveUser(dbUser);
    Modal.close(modalId);
    Notify.success('Password berhasil diubah!');
    DB.logActivity({ type:'change_password', detail:'Password diubah' });
  }

  /* ===================== TAB: USER MANAGEMENT ===================== */
  async function renderUsers() {
    let users = await DB.getUsers().catch(()=>[]);
    const merged = [...users];
    Auth._defaultUsers.forEach(du => {
      if (!merged.find(u=>u.id===du.id||u.username===du.username))
        merged.push({...du,_isDefault:true});
    });
    merged.sort((a,b)=>_getRoles().indexOf(a.role)-_getRoles().indexOf(b.role));

    document.getElementById('set-tab-users').innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--s4)">
        <button class="btn btn-primary" onclick="SettingsModule.openUserModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg>
          Tambah User
        </button>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead><tr><th>#</th><th>Nama</th><th>Username</th><th>Role</th><th>Email</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${merged.map((u,i)=>`
              <tr>
                <td class="text-muted">${i+1}</td>
                <td class="font-semibold">${u.nama}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${u.username}</td>
                <td><span class="badge ${u.role==='superadmin'?'badge-danger':u.role==='admin'?'badge-warning':u.role==='operator'?'badge-info':'badge-neutral'}">${u.role}</span></td>
                <td class="text-muted text-small">${u.email||'-'}</td>
                <td><span class="badge ${u.aktif===false?'badge-danger':'badge-success'}">${u.aktif===false?'Nonaktif':'Aktif'}</span></td>
                <td class="actions">
                  <div style="display:flex;gap:4px">
                    <button class="btn-icon" onclick="SettingsModule.openUserModal('${u.id||u.username}',${!!u._isDefault})">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    ${u.username!==Auth.currentUser()?.username?`
                      <button class="btn-icon" style="color:${u.aktif===false?'var(--success)':'var(--warning)'}"
                              onclick="SettingsModule.toggleUser('${u.id||u.username}',${!!u._isDefault},${u.aktif===false})"
                              title="${u.aktif===false?'Aktifkan':'Nonaktifkan'}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          ${u.aktif===false
                            ? '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>'
                            : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
                        </svg>
                      </button>
                    `:''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function openUserModal(idOrUsername=null, isDefault=false) {
    let d = null;
    if (idOrUsername) {
      const users = await DB.getUsers().catch(()=>[]);
      d = users.find(u=>u.id===idOrUsername||u.username===idOrUsername);
      if (!d && isDefault) d = Auth._defaultUsers.find(u=>u.id===idOrUsername||u.username===idOrUsername);
    }
    d = d || { aktif:true, role:'operator' };
    const isEdit = !!idOrUsername;

    const mid = Utils.uid(); Modal.open({ id: mid,
      title: isEdit ? `Edit User: ${d.nama||''}` : 'Tambah User Baru',
      body: `
        <form id="user-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Lengkap <span class="req">*</span></label>
              <input name="nama" class="form-control" value="${d.nama||''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Username <span class="req">*</span></label>
              <input name="username" class="form-control" value="${d.username||''}" required ${isEdit?'readonly style="opacity:.7"':''}>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">${isEdit?'Password Baru (kosongkan jika tidak diubah)':'Password'} ${!isEdit?'<span class="req">*</span>':''}</label>
              <input name="password" type="password" class="form-control" ${!isEdit?'required':''} placeholder="${isEdit?'Kosongkan jika tidak diubah':'Min. 6 karakter'}">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input name="email" type="email" class="form-control" value="${d.email||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Role</label>
              <select name="role" class="form-control">
                ${_getRoles().map(r=>`<option value="${r}" ${d.role===r?'selected':''}>${r}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="aktif" class="form-control">
                <option value="true"  ${d.aktif!==false?'selected':''}>✅ Aktif</option>
                <option value="false" ${d.aktif===false?'selected':''}>🚫 Nonaktif</option>
              </select>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="SettingsModule._submitUser('${mid}','${d.id||d.username||''}',${isEdit})">
          ${isEdit?'Simpan':'Tambah User'}
        </button>
      `,
    });
    return mid;
  }

  async function _submitUser(modalId, existingId, isEdit) {
    const fd   = new FormData(document.getElementById('user-form'));
    const data = Object.fromEntries(fd.entries());
    data.aktif = data.aktif === 'true';

    if (!data.nama||!data.username) { Notify.warning('Nama dan Username wajib diisi'); return; }
    if (!isEdit && !data.password)  { Notify.warning('Password wajib diisi'); return; }
    if (data.password && data.password.length<6) { Notify.warning('Password min. 6 karakter'); return; }

    if (isEdit && !data.password) {
      const users = await DB.getUsers().catch(()=>[]);
      const old   = users.find(u=>u.id===existingId||u.username===existingId) ||
                    Auth._defaultUsers.find(u=>u.id===existingId||u.username===existingId);
      if (old) data.password = old.password;
    }
    if (isEdit) data.id = existingId||data.username;
    else if (!data.id) data.id = Utils.uid();

    try {
      await DB.saveUser(data);
      Modal.close(modalId);
      Notify.success(isEdit?'User diperbarui':'User ditambahkan');
      DB.logActivity({ type:isEdit?'edit_user':'add_user', detail:`User: ${data.username}` });
      renderUsers();
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  async function toggleUser(idOrUsername, isDefault, currentlyInactive) {
    const users = await DB.getUsers().catch(()=>[]);
    let u = users.find(u=>u.id===idOrUsername||u.username===idOrUsername);
    if (!u && isDefault) u = {...(Auth._defaultUsers.find(u=>u.id===idOrUsername||u.username===idOrUsername)||{})};
    if (!u) { Notify.error('User tidak ditemukan'); return; }
    u.aktif = currentlyInactive;
    await DB.saveUser(u);
    Notify.success(u.aktif?'User diaktifkan':'User dinonaktifkan');
    renderUsers();
  }

  /* ===================== TAB: PRIVILEGE ===================== */
  async function renderPrivilege() {
    const custom = Utils.ls.get('becca_privileges') || {};
    const privs  = {};
    _getRoles().forEach(r => { privs[r] = custom[r] || {...(Auth._defaultPrivileges[r]||{})}; });

    document.getElementById('set-tab-privilege').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s4)">
        <p style="color:var(--text-2);font-size:13px">Atur hak akses per role. Centang = akses aktif. Berlaku setelah refresh.</p>
        <div style="display:flex;gap:var(--s2)">
          <button class="btn btn-ghost btn-sm" onclick="SettingsModule.addCustomRole()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
            Role
          </button>
          <button class="btn btn-ghost btn-sm" onclick="SettingsModule.resetPrivileges()">↺ Reset Default</button>
          <button class="btn btn-primary btn-sm" onclick="SettingsModule.savePrivileges()">💾 Simpan</button>
        </div>
      </div>
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table" style="font-size:13px">
            <thead>
              <tr>
                <th>Modul</th>
                ${_getRoles().filter(r=>r!=='superadmin').map(r=>`<th style="text-align:center;min-width:110px"><div style="display:flex;align-items:center;justify-content:center;gap:4px">${r}${!['admin','operator','viewer'].includes(r)?'<span onclick="SettingsModule.deleteCustomRole(\''+r+'\')" style="cursor:pointer;color:var(--danger);font-size:12px" title="Hapus role">×</span>':''}</div></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr style="background:var(--surface2)">
                <td colspan="${_getRoles().length}" style="font-size:11px;color:var(--primary-h);font-weight:600">
                  ⭐ superadmin selalu punya akses penuh ke semua fitur
                </td>
              </tr>
              ${FEATURES.map(feat=>`
                <tr>
                  <td class="font-semibold">${_featLabel(feat)}</td>
                  ${_getRoles().filter(r=>r!=='superadmin').map(role=>{
                    const val=privs[role]?.[feat]||'';
                    const chkView = val==='view'||val==='all';
                    const chkFull = val==='all';
                    return `<td style="text-align:center;padding:6px 4px">
                      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--text-2)"
                          title="View: dapat melihat data">
                          <input type="checkbox" id="priv_${role}_${feat}_view"
                            ${chkView?'checked':''}
                            onchange="SettingsModule._onPrivChange('${role}','${feat}','view',this.checked)"
                            style="accent-color:var(--info);width:14px;height:14px;cursor:pointer">
                          <span>View</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--text-2)"
                          title="Edit: dapat edit dan hapus data">
                          <input type="checkbox" id="priv_${role}_${feat}_full"
                            ${chkFull?'checked':''}
                            onchange="SettingsModule._onPrivChange('${role}','${feat}','full',this.checked)"
                            style="accent-color:var(--primary);width:14px;height:14px;cursor:pointer">
                          <span>Edit</span>
                        </label>
                      </div>
                    </td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _featLabel(f) {
    const m = {dashboard:'📊 Dashboard',order:'📋 Order',invoice:'🧾 Invoice',customer:'👥 Customer',
               employee:'👷 Karyawan',inventory:'📦 Inventory',kas:'💰 Kas Kecil',
               ap:'💳 Account Payable',task:'✅ Task',report:'📈 Laporan',settings:'⚙️ Pengaturan'};
    return m[f]||f;
  }

  function savePrivileges() {
    const custom = {};
    _getRoles().filter(r=>r!=='superadmin').forEach(role => {
      custom[role] = {};
      FEATURES.forEach(feat => {
        const viewEl = document.getElementById('priv_'+role+'_'+feat+'_view');
        const fullEl = document.getElementById('priv_'+role+'_'+feat+'_full');
        if (fullEl?.checked)      custom[role][feat] = 'all';
        else if (viewEl?.checked) custom[role][feat] = 'view';
      });
    });
    Utils.ls.set('becca_privileges', custom);
    Notify.success('Hak akses disimpan! Refresh untuk menerapkan.');
    DB.logActivity({type:'update_privileges', detail:'Hak akses diperbarui'});
  }

  function resetPrivileges() {
    Utils.ls.del('becca_privileges');
    Notify.success('Hak akses direset ke default');
    renderPrivilege();
  }

  // Sync checkbox logic: Full implies View
  function _onPrivChange(role, feat, type, checked) {
    const viewEl = document.getElementById('priv_'+role+'_'+feat+'_view');
    const fullEl = document.getElementById('priv_'+role+'_'+feat+'_full');
    if (type==='full' && checked && viewEl)  viewEl.checked = true;
    if (type==='view' && !checked && fullEl) fullEl.checked = false;
  }

  // Add custom role modal
  function addCustomRole() {
    const mid = Utils.uid();
    const roleOpts = _getRoles().filter(r=>r!=='superadmin')
      .map(r=>`<option value="${r}">${r}</option>`).join('');
    Modal.open({ id: mid,
      title: '+ Tambah Role Baru',
      size: 'modal-sm',
      body: `<div class="form-group">
        <label class="form-label">Nama Role <span class="req">*</span></label>
        <input type="text" class="form-control" id="new-role-inp"
          placeholder="Contoh: supervisor, kasir">
        <div class="form-hint">Huruf kecil, tanpa spasi. Contoh: supervisor</div>
      </div>
      <div class="form-group">
        <label class="form-label">Salin hak akses dari role (opsional)</label>
        <select class="form-control" id="copy-from-role">
          <option value="">— Mulai kosong —</option>
          ${roleOpts}
        </select>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
               <button class="btn btn-primary" onclick="SettingsModule._saveNewRole('${mid}')">Tambah Role</button>`,
    });
    setTimeout(()=>document.getElementById('new-role-inp')?.focus(), 100);
  }

  function _saveNewRole(mid) {
    const name = (document.getElementById('new-role-inp')?.value||'').trim().toLowerCase().replace(/\s+/g,'_');
    if (!name) { Notify.warning('Nama role tidak boleh kosong'); return; }
    if (_getRoles().includes(name)) { Notify.warning('Role "'+name+'" sudah ada'); return; }
    if (!/^[a-z][a-z0-9_]*$/.test(name)) { Notify.warning('Hanya huruf kecil, angka, underscore'); return; }
    // Copy privileges from existing role if selected
    const copyFrom = document.getElementById('copy-from-role')?.value;
    const existing = Utils.ls.get('becca_privileges') || {};
    if (copyFrom && existing[copyFrom]) {
      existing[name] = {...existing[copyFrom]};
      Utils.ls.set('becca_privileges', existing);
    }
    // Save to custom roles list
    const customRoles = Utils.ls.get('becca_custom_roles') || [];
    customRoles.push(name);
    Utils.ls.set('becca_custom_roles', customRoles);
    Modal.close(mid);
    Notify.success('Role "'+name+'" ditambahkan!');
    renderPrivilege();
    DB.logActivity({type:'add_role', detail:'Role baru: '+name});
  }

  function deleteCustomRole(roleName) {
    if (_DEFAULT_ROLES.includes(roleName)) { Notify.warning('Role default tidak bisa dihapus'); return; }
    Modal.confirm({title:'Hapus Role',message:'Role "'+roleName+'" akan dihapus permanen.',danger:true,confirmText:'Hapus'}).then(ok=>{
      if (!ok) return;
      const custom = Utils.ls.get('becca_custom_roles') || [];
      Utils.ls.set('becca_custom_roles', custom.filter(r=>r!==roleName));
      const privs = Utils.ls.get('becca_privileges') || {};
      delete privs[roleName];
      Utils.ls.set('becca_privileges', privs);
      Notify.success('Role "'+roleName+'" dihapus');
      renderPrivilege();
    });
  }

  /* ===================== TAB: ACTIVITY LOG ===================== */
  async function renderActivity() {
    const logs   = await DB.getActivityLog().catch(()=>[]);
    const sorted = [...logs].sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
    const icons  = {
      login:'🔑', logout:'🚪', add_user:'➕', edit_user:'✏️',
      change_password:'🔒', update_privileges:'🔐', export_data:'📥', import_data:'📤',
      add_kas:'💰', edit_kas:'💰', delete_kas:'💰',
      add_inventory:'📦', edit_inventory:'📦', delete_inventory:'📦',
      add_item:'📦', edit_item:'📦', opname:'📦',
      add_customer:'👥', edit_customer:'👥', delete_customer:'👥',
      add_invoice:'🧾', edit_invoice:'🧾', delete_invoice:'🧾',
      add_task:'✅', edit_task:'✅', delete_task:'✅', complete_task:'✅',
      add_ap:'💳', edit_ap:'💳', employee:'👷',
    };

    // Store logs for detail modal
    window._activityLogs = sorted;

    document.getElementById('set-tab-activity').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s4)">
        <div>
          <span class="text-muted text-small">${sorted.length} aktivitas</span>
          <span class="text-muted text-small" style="margin-left:8px">· Klik baris untuk detail</span>
        </div>
        <div style="display:flex;gap:var(--s2)">
          <input type="text" class="form-control" style="width:200px;font-size:12px"
            placeholder="Cari user / aktivitas..."
            oninput="SettingsModule._filterActivityLog(this.value)">
          ${Auth.isSuperAdmin()?`<button class="btn btn-ghost btn-sm" style="color:var(--danger)"
            onclick="SettingsModule.clearActivityLog()">🗑️ Hapus Log</button>`:''}
        </div>
      </div>
      <div class="table-wrapper">
        <table class="table" id="activity-table">
          <thead><tr>
            <th style="width:32px">#</th>
            <th style="width:140px">Waktu</th>
            <th>User</th>
            <th style="width:80px">Role</th>
            <th>Aktivitas</th>
            <th>Detail</th>
          </tr></thead>
          <tbody id="activity-tbody">
            ${SettingsModule._renderActivityRows(sorted)}
          </tbody>
        </table>
      </div>
    `;
  }

  function _renderActivityRows(rows) {
    const icons = {
      login:'🔑', logout:'🚪', add_user:'➕', edit_user:'✏️',
      change_password:'🔒', update_privileges:'🔐', export_data:'📥', import_data:'📤',
      add_kas:'💰', edit_kas:'💰', delete_kas:'🗑️',
      add_inventory:'📦', edit_inventory:'📦', delete_inventory:'🗑️',
      opname:'🔢', employee:'👷', add_task:'✅', complete_task:'✅',
    };
    const typeColors = {
      login:'var(--success)', logout:'var(--text-3)',
      add_user:'var(--primary-h)', edit_user:'var(--info)',
      delete_kas:'var(--danger)', delete_inventory:'var(--danger)',
      update_privileges:'var(--warning)',
    };

    if (!rows.length) return `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada aktivitas</td></tr>`;

    return rows.slice(0,300).map((log,i) => {
      const timeStr = log.timestamp
        ? new Date(log.timestamp).toLocaleString('id-ID',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
        : (log.tgl||'-');
      const color = typeColors[log.type] || 'var(--text-2)';
      const icon  = icons[log.type] || '📝';
      const detail = (log.detail||'').length > 40 ? (log.detail||'').substring(0,40)+'…' : (log.detail||'-');

      return `<tr style="cursor:pointer;transition:background .1s"
                onmouseover="this.style.background='var(--surface2)'"
                onmouseout="this.style.background=''"
                onclick="SettingsModule.showActivityDetail(${i})">
        <td class="text-muted" style="font-size:11px">${i+1}</td>
        <td style="white-space:nowrap;font-size:11px;color:var(--text-3)">${timeStr}</td>
        <td style="font-weight:600;font-size:13px">${log.user||'-'}</td>
        <td><span class="badge badge-neutral" style="font-size:10px">${log.role||'-'}</span></td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px">
            <span>${icon}</span>
            <span class="badge" style="font-size:10px;background:${color}18;color:${color};border:1px solid ${color}30">${log.type||'-'}</span>
          </span>
        </td>
        <td class="text-muted" style="font-size:12px">${detail}</td>
      </tr>`;
    }).join('');
  }

  function _filterActivityLog(q) {
    const logs = window._activityLogs || [];
    const lower = q.toLowerCase();
    const filtered = lower
      ? logs.filter(l => (l.user||'').toLowerCase().includes(lower)
          || (l.type||'').toLowerCase().includes(lower)
          || (l.detail||'').toLowerCase().includes(lower))
      : logs;
    const tbody = document.getElementById('activity-tbody');
    if (tbody) tbody.innerHTML = SettingsModule._renderActivityRows(filtered);
  }

  function showActivityDetail(idx) {
    const logs = window._activityLogs || [];
    const log  = logs[idx];
    if (!log) return;
    const timeStr = log.timestamp
      ? new Date(log.timestamp).toLocaleString('id-ID', {
          weekday:'long', year:'numeric', month:'long', day:'numeric',
          hour:'2-digit', minute:'2-digit', second:'2-digit'
        })
      : (log.tgl||'-');

    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: '📋 Detail Aktivitas',
      size: 'modal-sm',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        ${[
          {l:'Waktu',     v: timeStr},
          {l:'User',      v: log.user||'-'},
          {l:'Role',      v: log.role||'-'},
          {l:'Tipe',      v: log.type||'-'},
          {l:'Detail',    v: log.detail||'-'},
          {l:'Tanggal',   v: log.tgl||'-'},
        ].map(f=>`
          <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="width:80px;font-size:12px;color:var(--text-3);flex-shrink:0">${f.l}</div>
            <div style="font-size:13px;font-weight:500;color:var(--text);word-break:break-all">${f.v}</div>
          </div>`).join('')}
        <div style="display:flex;gap:12px;padding:8px 0">
          <div style="width:80px;font-size:12px;color:var(--text-3);flex-shrink:0">ID</div>
          <div style="font-size:11px;color:var(--text-3);font-family:var(--font-mono)">${log.id||'-'}</div>
        </div>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  async function clearActivityLog() {
    const ok = await Modal.confirm({title:'Hapus Activity Log',message:'Semua log akan dihapus.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    await DB.clearActivityLog();
    Notify.success('Log dihapus');
    renderActivity();
  }

  /* ===================== TAB: DATA ===================== */
  function renderData() {
    const keys = ['orders','invoices','customers','kas','kas_masuk','inventory','inv_products','employees','emp_logs','ap','suppliers','tasks','settings','users','activity_log'];
    const sizes = keys.map(k=>{
      const raw = localStorage.getItem('becca_'+k);
      return {k, count:raw?JSON.parse(raw).length:0, bytes:raw?raw.length:0};
    });

    document.getElementById('set-tab-data').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s5)">
        <div class="card">
          <div class="card-header"><div class="card-title">💾 Penggunaan Storage</div></div>
          <div style="padding:var(--s4)">
            <table class="table" style="font-size:12px">
              <thead><tr><th>Collection</th><th class="num">Records</th><th class="num">Size</th></tr></thead>
              <tbody>
                ${sizes.map(s=>`<tr><td style="font-family:var(--font-mono)">${s.k}</td><td class="num">${s.count}</td><td class="num text-muted">${s.bytes>1024?(s.bytes/1024).toFixed(1)+'KB':s.bytes+'B'}</td></tr>`).join('')}
                <tr style="background:var(--surface2);font-weight:600">
                  <td>TOTAL</td>
                  <td class="num">${sizes.reduce((s,r)=>s+r.count,0)}</td>
                  <td class="num">${(sizes.reduce((s,r)=>s+r.bytes,0)/1024).toFixed(1)}KB</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">🔧 Aksi Data</div></div>
          <div style="padding:var(--s5);display:flex;flex-direction:column;gap:var(--s3)">
            <button class="btn btn-ghost w-full" onclick="SettingsModule.exportData()">📥 Export Semua Data (JSON)</button>
            <button class="btn btn-ghost w-full" onclick="document.getElementById('import-file').click()">📤 Import Data (JSON)</button>
            <input type="file" id="import-file" accept=".json" style="display:none" onchange="SettingsModule._doImport(this)">
            <div style="font-size:12px;color:var(--text-3)">Export sebagai backup. Data tersimpan di localStorage browser ini.</div>
            ${Auth.isSuperAdmin()?`
              <div style="border-top:1px solid var(--border);padding-top:var(--s3)">
                <button class="btn btn-ghost w-full" style="color:var(--danger);border-color:rgba(239,68,68,.2)" onclick="SettingsModule.clearData()">🗑️ Reset Semua Data</button>
              </div>
            `:''}
          </div>
        </div>
      </div>
    `;
  }

  function exportData() {
    const keys = ['orders','invoices','customers','kas','kas_masuk','inventory','inv_products','employees','emp_logs','ap','suppliers','tasks','settings','users','activity_log'];
    const out  = {_exportedAt:new Date().toISOString(),_version:'2.0'};
    keys.forEach(k=>{ try{out[k]=JSON.parse(localStorage.getItem('becca_'+k)||'[]');}catch{} });
    const a = Object.assign(document.createElement('a'),{
      href: URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),
      download:`becca-backup-${new Date().toISOString().split('T')[0]}.json`
    });
    a.click(); URL.revokeObjectURL(a.href);
    Notify.success('Data berhasil di-export!');
    DB.logActivity({type:'export_data',detail:'Backup JSON'});
  }

  function _doImport(input) {
    const file=input.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async(e)=>{
      try {
        const data=JSON.parse(e.target.result);
        const keys=['orders','invoices','customers','kas','kas_masuk','inventory','inv_products','employees','emp_logs','ap','suppliers','tasks','settings','users'];
        let count=0;
        keys.forEach(k=>{ if(data[k]){localStorage.setItem('becca_'+k,JSON.stringify(data[k]));count++;} });
        Notify.success(`Import berhasil! ${count} collection dipulihkan.`);
        DB.logActivity({type:'import_data',detail:`Import: ${file.name}`});
        setTimeout(()=>location.reload(),1500);
      } catch(err) { Notify.error('Import gagal',err.message); }
    };
    reader.readAsText(file); input.value='';
  }

  async function clearData() {
    const ok=await Modal.confirm({title:'⚠️ Reset Semua Data',message:'SEMUA data dihapus permanen. Tidak bisa dikembalikan!',danger:true,confirmText:'Ya, Hapus Semua'});
    if(!ok) return;
    ['orders','invoices','customers','kas','kas_masuk','inventory','inv_products','employees','emp_logs','ap','suppliers','tasks','settings','users','activity_log']
      .forEach(k=>localStorage.removeItem('becca_'+k));
    Notify.success('Semua data direset');
    setTimeout(()=>location.reload(),1500);
  }

  return {
    init, switchTab,
    saveGeneralSettings, openChangePasswordModal, _changePassword,
    renderUsers, openUserModal, _submitUser, toggleUser,
    renderPrivilege, savePrivileges, resetPrivileges, _onPrivChange, addCustomRole, _saveNewRole, deleteCustomRole,
    renderActivity, _renderActivityRows, _filterActivityLog, showActivityDetail, clearActivityLog,
    renderData, exportData, _doImport, clearData,
  };
})();
window.SettingsModule = SettingsModule;
