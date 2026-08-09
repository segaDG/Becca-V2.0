/* ============================================
   BECCA V2.0 — Settings Module
   User Management, Privilege, Activity Log,
   Notifikasi, Export/Import Data
============================================ */
if (typeof window.SettingsModule !== 'undefined') { console.warn('[Settings] Already loaded, skipping'); }
else { window.SettingsModule = (() => {

  // Cache merged user list for openUserModal (avoids re-fetching from DB)
  let _usersCache = [];

  // Pending import items for AI kategori review modal
  let _pendingImportItems = null;
  let _pendingImportFile  = null;

  // ROLES - default + custom yang ditambah user
  const _DEFAULT_ROLES = ['superadmin','admin','finance','operator','viewer'];
  function _getRoles() {
    let extra = [];
    try {
      const parsed = JSON.parse(localStorage.getItem('becca_custom_roles') || '[]');
      if (Array.isArray(parsed)) extra = parsed;
    } catch {}
    return [..._DEFAULT_ROLES, ...extra.filter(r=>!_DEFAULT_ROLES.includes(r))];
  }
  const FEATURES = ['dashboard','order','invoice','customer','employee','emp_finance','inventory','kas','ap','po','task','daily-order','delivery','menu','haccp','chat','personal','report','settings','news'];

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
        <button class="tab-btn" data-tab="keamanan" onclick="SettingsModule.switchTab('keamanan')">🔐 Keamanan</button>
        ${Auth.isSuperAdmin() ? `
          <button class="tab-btn" data-tab="users"     onclick="SettingsModule.switchTab('users')">👥 Users</button>
          <button class="tab-btn" data-tab="privilege" onclick="SettingsModule.switchTab('privilege')">🔐 Hak Akses</button>
        ` : ''}
        <button class="tab-btn" data-tab="activity" onclick="SettingsModule.switchTab('activity')">📋 Activity Log</button>
        <button class="tab-btn" data-tab="data"     onclick="SettingsModule.switchTab('data')">🗄️ Data</button>
      </div>
      <div id="set-tab-umum"></div>
      <div id="set-tab-keamanan"  class="hidden"></div>
      <div id="set-tab-users"     class="hidden"></div>
      <div id="set-tab-privilege" class="hidden"></div>
      <div id="set-tab-activity"  class="hidden"></div>
      <div id="set-tab-data"      class="hidden"></div>
    `;
    switchTab('umum');
  }

  function switchTab(tab) {
    ['umum','keamanan','users','privilege','activity','data'].forEach(t => {
      document.getElementById(`set-tab-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    ({umum:renderUmum, keamanan:renderKeamanan, users:renderUsers, privilege:renderPrivilege, activity:renderActivity, data:renderData})[tab]?.();
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
          <div class="card-header">
            <div class="card-title">🔄 Sinkronisasi Akun (Multi-Device)</div>
          </div>
          <div style="padding:var(--s5)">
            <p style="font-size:12px;color:var(--text-2);margin-bottom:10px">
              Dengan GitHub Token, setiap tambah/ubah user akan <strong>otomatis</strong> update semua device.
            </p>
            <div class="form-group">
              <label class="form-label">GitHub Personal Access Token</label>
              <input class="form-control" id="gh-token-input" type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value="${JSON.parse(localStorage.getItem('becca_settings')||'{}').githubToken||''}"
                style="font-family:var(--font-mono);font-size:11px">
              <div style="font-size:10px;color:var(--text-3);margin-top:3px">
                Scope yang diperlukan: <code>repo</code>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">GitHub Repo</label>
              <input class="form-control" id="gh-repo-input" type="text"
                placeholder="username/repo-name"
                value="${JSON.parse(localStorage.getItem('becca_settings')||'{}').githubRepo||'segaDG/Becca-V2.0'}"
                style="font-family:var(--font-mono);font-size:11px">
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary" style="flex:1" onclick="SettingsModule._saveGithubToken()">
                💾 Simpan Token
              </button>
              <button class="btn btn-ghost" onclick="SettingsModule._downloadAuthJs()">
                ⬇ Manual
              </button>
            </div>
            <div id="gh-sync-status" style="margin-top:8px;font-size:11px;display:none"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">🏢 Pengaturan Perusahaan</div></div>
          <div style="padding:var(--s5)">
            <form id="settings-form">
              <!-- Logo Upload -->
              <div class="form-group">
                <label class="form-label">Logo Perusahaan</label>
                <div style="display:flex;align-items:center;gap:var(--s4);margin-bottom:4px">
                  <div id="logo-preview-wrap" style="width:64px;height:64px;border-radius:var(--r-md);
                       border:2px dashed var(--border2);display:flex;align-items:center;justify-content:center;
                       overflow:hidden;background:var(--surface2);flex-shrink:0">
                    ${settings.logoUrl
                      ? '<img src="'+settings.logoUrl+'" style="width:100%;height:100%;object-fit:contain">'
                      : '<span style="font-size:22px">🏢</span>'}
                  </div>
                  <div>
                    <label class="btn btn-ghost btn-sm" style="cursor:pointer">
                      📁 Pilih Logo
                      <input type="file" id="logo-file-input" accept="image/*" style="display:none"
                        onchange="SettingsModule._handleLogoUpload(this)">
                    </label>
                    ${settings.logoUrl ? '<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);margin-left:4px" onclick="SettingsModule._removeLogo()">✕ Hapus</button>' : ''}
                    <div class="form-hint">PNG/JPG/SVG · Max 500KB · Tampil di Sidebar</div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Nama Perusahaan</label>
                <input name="namaPerusahaan" class="form-control" value="${settings.namaPerusahaan||'BECCA Catering'}">
              </div>
              <div class="form-group">
                <label class="form-label">Tagline / Slogan</label>
                <input name="tagline" class="form-control" placeholder="Catering Professional"
                  value="${settings.tagline||''}">
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
              <div class="cf-section" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:var(--s4) 0 var(--s3);padding-bottom:var(--s2);border-bottom:1px solid var(--border)">Default Food Cost (Daily Order)</div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
                <div class="form-group"><label class="form-label">Food Cost (%)</label><input name="defaultFoodCostPct" type="number" min="0" max="100" step="0.5" class="form-control" value="${settings.defaultFoodCostPct||'54'}" style="font-family:var(--font-mono)"><div style="font-size:10px;color:var(--text-3);margin-top:2px">Default: 54%</div></div>
                <div class="form-group"><label class="form-label">Snack Cost (%)</label><input name="defaultSnackCostPct" type="number" min="0" max="100" step="0.5" class="form-control" value="${settings.defaultSnackCostPct||'70'}" style="font-family:var(--font-mono)"><div style="font-size:10px;color:var(--text-3);margin-top:2px">Default: 70%</div></div>
                <div class="form-group"><label class="form-label">Snack Berat Cost (%)</label><input name="defaultSnackBeratCostPct" type="number" min="0" max="100" step="0.5" class="form-control" value="${settings.defaultSnackBeratCostPct||'65'}" style="font-family:var(--font-mono)"><div style="font-size:10px;color:var(--text-3);margin-top:2px">Default: 65%</div></div>
              </div>
              <div class="cf-section" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:var(--s4) 0 var(--s3);padding-bottom:var(--s2);border-bottom:1px solid var(--border)">Lokasi BPS (Delivery Tracking)</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);margin-bottom:var(--s3)">
                <div class="form-group"><label class="form-label">Latitude</label><input name="bpsLat" class="form-control" type="number" step="any" value="${settings.bpsLat||''}" placeholder="-6.xxxxx"></div>
                <div class="form-group"><label class="form-label">Longitude</label><input name="bpsLng" class="form-control" type="number" step="any" value="${settings.bpsLng||''}" placeholder="107.xxxxx"></div>
              </div>
              <div class="form-group" style="margin-bottom:var(--s4)"><label class="form-label">Nama Lokasi</label><input name="bpsLocationName" class="form-control" value="${settings.bpsLocationName||'BPS Office'}"></div>
              <div class="cf-section" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:var(--s4) 0 var(--s3);padding-bottom:var(--s2);border-bottom:1px solid var(--border)">AI Integration (Google Gemini)</div>
              <div class="form-group" style="margin-bottom:var(--s4)">
                <label class="form-label">Gemini API Key</label>
                <input name="geminiApiKey" type="password" class="form-control" value="${settings.geminiApiKey||''}" placeholder="AIzaSy..." style="font-family:var(--font-mono)">
                <div style="font-size:10px;color:var(--text-3);margin-top:2px">Gratis dari <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--primary-h)">Google AI Studio</a>. Digunakan untuk AI Resep & Menu Generator.</div>
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

  /* ===================== TAB: KEAMANAN (2FA) ===================== */
  async function renderKeamanan() {
    const user = Auth.currentUser();
    const settings = await DB.getSettings().catch(() => ({}));
    // Re-fetch user fresh dari DB supaya twofa fields up-to-date
    let fresh = user;
    try {
      const all = await DB.getUsers();
      fresh = all.find(u => u.id === user.id) || user;
    } catch {}
    const enabled = fresh.twofaEnabled === true;
    const channel = fresh.twofaChannel || 'email';
    const target = channel === 'email' ? (fresh.twofaEmail || fresh.email || '-') : (fresh.twofaPhone || '-');
    const targetMasked = target !== '-' ? target.replace(/(.{2}).+(.{2})/, '$1***$2') : '-';
    const backupRemain = Array.isArray(fresh.twofaBackupCodes) ? fresh.twofaBackupCodes.length : 0;
    const trustedCount = TwoFA?.isDeviceTrusted ? (TwoFA.isDeviceTrusted(user.id) ? 1 : 0) : 0;

    document.getElementById('set-tab-keamanan').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:var(--s5)">

        <div class="card">
          <div class="card-header">
            <div class="card-title">🔐 Autentikasi 2 Langkah (2FA)</div>
          </div>
          <div style="padding:var(--s5)">
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:${enabled?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)'};border-radius:8px;margin-bottom:12px">
              <div style="width:32px;height:32px;border-radius:50%;background:${enabled?'#22c55e':'#ef4444'};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">${enabled?'✓':'✗'}</div>
              <div style="flex:1">
                <div style="font-weight:700;font-size:13px;color:${enabled?'#15803d':'#b91c1c'}">${enabled?'2FA Aktif':'2FA Tidak Aktif'}</div>
                <div style="font-size:11px;color:var(--text-2)">${enabled?`Channel: ${channel==='email'?'📧 Email':'💬 WhatsApp'} → ${Utils.esc(targetMasked)}`:'Akun Anda hanya dilindungi password'}</div>
              </div>
            </div>
            ${enabled ? `
              <div style="display:flex;gap:6px;margin-bottom:8px">
                <button class="btn btn-secondary" style="flex:1" onclick="SettingsModule.disable2FA()">🔓 Matikan 2FA</button>
                <button class="btn btn-ghost" style="flex:1" onclick="SettingsModule.regenerateBackupCodes()">🔄 Backup Code Baru</button>
              </div>
              <div style="font-size:11px;color:var(--text-3);padding:8px;background:var(--surface2);border-radius:6px;line-height:1.5">
                <div>Backup code tersisa: <strong>${backupRemain}</strong> / 10</div>
                <div>Device dipercaya 7 hari: <strong>${trustedCount}</strong></div>
                ${trustedCount ? `<button class="btn-link" style="background:transparent;border:none;color:var(--primary);cursor:pointer;font-size:11px;padding:0;text-decoration:underline" onclick="SettingsModule.revokeTrusted()">Cabut device terpercaya</button>` : ''}
              </div>
            ` : `
              <button class="btn btn-primary w-full" onclick="SettingsModule.enable2FA()">🛡️ Aktifkan 2FA</button>
              <div style="font-size:11px;color:var(--text-3);margin-top:8px;line-height:1.5">
                Recommended untuk role <strong>superadmin / admin / finance</strong>. Setelah login dengan password, sistem akan kirim OTP 6-digit ke email atau WhatsApp Anda.
              </div>
            `}
          </div>
        </div>

        ${Auth.isSuperAdmin() ? `
          <div class="card">
            <div class="card-header"><div class="card-title">⚙️ Konfigurasi Provider OTP</div></div>
            <div style="padding:var(--s5)">
              <p style="font-size:12px;color:var(--text-2);margin-bottom:14px">
                Hanya superadmin yang bisa edit. Setting ini berlaku untuk <strong>semua user</strong> yang aktifkan 2FA.
              </p>
              <div style="font-size:12px;font-weight:700;color:var(--text-1);margin-bottom:6px;display:flex;align-items:center;gap:6px">
                📧 EmailJS <span style="font-size:10px;color:var(--text-3);font-weight:400">(emailjs.com — gratis 200/bulan)</span>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:11px">Service ID</label>
                <input class="form-control" id="emailjs-service" placeholder="service_xxxxxxx" value="${Utils.esc(settings.emailjsServiceId||'')}">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:11px">Template ID</label>
                <input class="form-control" id="emailjs-template" placeholder="template_xxxxxxx" value="${Utils.esc(settings.emailjsTemplateId||'')}">
                <div style="font-size:10px;color:var(--text-3);margin-top:3px">Template harus punya variables: <code>{{to_name}}</code>, <code>{{to_email}}</code>, <code>{{otp}}</code>, <code>{{expires_in}}</code>, <code>{{app_name}}</code></div>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:11px">Public Key</label>
                <input class="form-control" id="emailjs-key" type="password" placeholder="xxxxxxxxxxxxxxx" value="${Utils.esc(settings.emailjsPublicKey||'')}">
              </div>

              <div style="font-size:12px;font-weight:700;color:var(--text-1);margin:14px 0 6px;display:flex;align-items:center;gap:6px">
                💬 Fonnte WhatsApp <span style="font-size:10px;color:var(--text-3);font-weight:400">(fonnte.com — ~Rp 100/pesan)</span>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:11px">Device Token</label>
                <input class="form-control" id="fonnte-token" type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value="${Utils.esc(settings.fonnteToken||'')}">
                <div style="font-size:10px;color:var(--text-3);margin-top:3px">Dapatkan setelah scan QR WhatsApp di dashboard Fonnte</div>
              </div>

              <button class="btn btn-primary w-full" onclick="SettingsModule.saveOTPProviderConfig()">💾 Simpan Konfigurasi</button>
            </div>
          </div>
        ` : ''}

      </div>
    `;
  }

  async function enable2FA() {
    const user = Auth.currentUser();
    if (!user) return;
    const settings = await DB.getSettings().catch(() => ({}));
    // Step 1: pilih channel + isi target
    Modal.open({
      id: '2fa-enable-1',
      title: '🛡️ Aktifkan 2FA — Pilih Channel',
      size: 'modal-sm',
      body: `
        <div style="font-size:13px;color:var(--text-2);margin-bottom:12px">Pilih cara terima kode OTP:</div>
        <div style="display:grid;gap:8px">
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid var(--border);border-radius:8px;cursor:pointer" onclick="this.querySelector('input').checked=true;document.querySelectorAll('.twofa-ch-card').forEach(c=>c.style.borderColor='var(--border)');this.style.borderColor='var(--primary)'" class="twofa-ch-card">
            <input type="radio" name="twofa-ch" value="email" checked>
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">📧 Email</div>
              <div style="font-size:11px;color:var(--text-3)">Gratis, butuh EmailJS dikonfigurasi superadmin</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:2px solid var(--border);border-radius:8px;cursor:pointer" onclick="this.querySelector('input').checked=true;document.querySelectorAll('.twofa-ch-card').forEach(c=>c.style.borderColor='var(--border)');this.style.borderColor='var(--primary)'" class="twofa-ch-card">
            <input type="radio" name="twofa-ch" value="wa">
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">💬 WhatsApp</div>
              <div style="font-size:11px;color:var(--text-3)">Lebih cepat, butuh Fonnte dikonfigurasi superadmin</div>
            </div>
          </label>
        </div>
        <div class="form-group" style="margin-top:14px">
          <label class="form-label" id="twofa-target-label">Email untuk OTP</label>
          <input class="form-control" id="twofa-target-input" placeholder="${user.email||'email@example.com'}" value="${Utils.esc(user.email||'')}">
          <div style="font-size:10px;color:var(--text-3);margin-top:3px">Untuk WhatsApp pakai format: 08xxxxxxxxxx atau +62xxxxxxxxxx</div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close('2fa-enable-1')">Batal</button>
        <button class="btn btn-primary" id="twofa-enable-next">Lanjut →</button>
      `,
      onOpen: () => {
        document.querySelectorAll('input[name="twofa-ch"]').forEach(r => {
          r.onchange = () => {
            const v = r.value;
            document.getElementById('twofa-target-label').textContent = v === 'email' ? 'Email untuk OTP' : 'Nomor WhatsApp untuk OTP';
            document.getElementById('twofa-target-input').placeholder = v === 'email' ? 'email@example.com' : '08xxxxxxxxxx';
          };
        });
        document.getElementById('twofa-enable-next').onclick = async () => {
          const ch = document.querySelector('input[name="twofa-ch"]:checked').value;
          const tgt = document.getElementById('twofa-target-input').value.trim();
          if (!tgt) { Notify.warning('Isi ' + (ch === 'email' ? 'email' : 'nomor WhatsApp')); return; }
          if (ch === 'email' && !tgt.includes('@')) { Notify.warning('Format email tidak valid'); return; }
          if (ch === 'email' && !settings.emailjsServiceId) { Notify.error('EmailJS belum dikonfigurasi superadmin'); return; }
          if (ch === 'wa' && !settings.fonnteToken) { Notify.error('Fonnte belum dikonfigurasi superadmin'); return; }
          // Step 2: kirim OTP test untuk verifikasi channel works
          const testUser = { ...user, twofaEnabled: true, twofaChannel: ch, twofaEmail: ch === 'email' ? tgt : user.email, twofaPhone: ch === 'wa' ? tgt : '' };
          Modal.close('2fa-enable-1');
          try {
            const info = await TwoFA.sendOTP(testUser);
            Modal.open({
              id: '2fa-enable-2',
              title: '🛡️ Verifikasi OTP',
              size: 'modal-sm',
              body: `
                <div style="text-align:center">
                  <div style="font-size:13px;color:var(--text-2);margin-bottom:6px">Kode OTP terkirim ke:</div>
                  <div style="font-weight:700;font-size:14px;margin-bottom:14px">${Utils.esc(info.targetMasked)}</div>
                  <input id="twofa-enable-otp" type="text" inputmode="numeric" maxlength="6" class="form-control"
                    style="text-align:center;font-size:24px;letter-spacing:6px;font-weight:700;font-family:var(--font-mono,monospace);max-width:240px;margin:0 auto" placeholder="••••••">
                  <div id="twofa-enable-err" class="form-error" style="margin-top:8px;display:none"></div>
                </div>
              `,
              footer: `
                <button class="btn btn-secondary" onclick="Modal.close('2fa-enable-2')">Batal</button>
                <button class="btn btn-primary" id="twofa-enable-confirm">Aktifkan →</button>
              `,
              onOpen: () => {
                setTimeout(() => document.getElementById('twofa-enable-otp').focus(), 80);
                document.getElementById('twofa-enable-confirm').onclick = async () => {
                  const code = document.getElementById('twofa-enable-otp').value.trim();
                  const ok = await TwoFA.verifyOTP(testUser, code);
                  if (!ok) {
                    const err = document.getElementById('twofa-enable-err');
                    err.textContent = 'Kode salah. Coba lagi.'; err.style.display = 'block';
                    return;
                  }
                  // Generate backup codes
                  const { plain, hashed } = await TwoFA.generateBackupCodes(10);
                  // Save to user
                  const fresh = (await DB.getUsers()).find(u => u.id === user.id) || user;
                  Object.assign(fresh, {
                    twofaEnabled: true,
                    twofaChannel: ch,
                    twofaEmail: ch === 'email' ? tgt : (fresh.twofaEmail || ''),
                    twofaPhone: ch === 'wa' ? tgt : (fresh.twofaPhone || ''),
                    twofaBackupCodes: hashed,
                  });
                  await DB.saveUser(fresh);
                  DB.logActivity({ type: '2fa_enabled', detail: `2FA aktif via ${ch}` });
                  Modal.close('2fa-enable-2');
                  // Show backup codes
                  _showBackupCodes(plain);
                };
              },
            });
          } catch (e) {
            Notify.error(e.message);
          }
        };
      },
    });
  }

  function _showBackupCodes(codes) {
    const text = codes.join('\n');
    Modal.open({
      id: '2fa-backup-show',
      title: '🔑 Backup Codes — SIMPAN INI!',
      size: 'modal-sm',
      closable: false,
      body: `
        <div style="font-size:12px;color:#dc2626;font-weight:700;padding:10px;background:rgba(239,68,68,.08);border-radius:6px;margin-bottom:12px;line-height:1.5">
          ⚠ Simpan kode-kode ini di tempat aman. Setiap kode hanya bisa dipakai 1x.<br>
          Pakai kalau Anda kehilangan akses ke ${codes.length} email/WhatsApp.
        </div>
        <div style="font-family:var(--font-mono,monospace);font-size:14px;padding:14px;background:var(--surface2);border-radius:8px;line-height:1.9;text-align:center;letter-spacing:1px;font-weight:700">
          ${codes.map(c => Utils.esc(c)).join('<br>')}
        </div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button class="btn btn-ghost" style="flex:1" onclick="navigator.clipboard.writeText('${text.replace(/'/g, "\\'")}').then(()=>Notify.success('Disalin ke clipboard'))">📋 Copy</button>
          <button class="btn btn-ghost" style="flex:1" onclick="(()=>{const b=new Blob(['${text}'],{type:'text/plain'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='becca-backup-codes.txt';a.click();URL.revokeObjectURL(u);Notify.success('Diunduh');})()">⬇ Download</button>
        </div>
      `,
      footer: `<button class="btn btn-primary w-full" onclick="(()=>{Modal.close('2fa-backup-show');SettingsModule.switchTab('keamanan');Notify.success('2FA aktif! Lain kali login akan minta OTP.');})()">Saya sudah simpan ✓</button>`,
    });
  }

  async function disable2FA() {
    const user = Auth.currentUser();
    Modal.confirm({
      title: 'Matikan 2FA?',
      message: 'Akun Anda akan kembali hanya terlindung password. Lanjutkan?',
      danger: true,
      okText: 'Ya, matikan',
      onConfirm: async () => {
        const fresh = (await DB.getUsers()).find(u => u.id === user.id) || user;
        fresh.twofaEnabled = false;
        delete fresh.twofaChannel;
        delete fresh.twofaBackupCodes;
        // Keep twofaEmail/twofaPhone (user might re-enable later)
        await DB.saveUser(fresh);
        TwoFA.revokeAllTrusted(user.id);
        DB.logActivity({ type: '2fa_disabled', detail: '2FA dimatikan' });
        Notify.success('2FA dimatikan');
        renderKeamanan();
      },
    });
  }

  async function regenerateBackupCodes() {
    const user = Auth.currentUser();
    Modal.confirm({
      title: 'Generate backup codes baru?',
      message: 'Kode lama akan tidak berlaku. Pastikan simpan kode baru.',
      okText: 'Generate',
      onConfirm: async () => {
        const { plain, hashed } = await TwoFA.generateBackupCodes(10);
        const fresh = (await DB.getUsers()).find(u => u.id === user.id) || user;
        fresh.twofaBackupCodes = hashed;
        await DB.saveUser(fresh);
        DB.logActivity({ type: '2fa_backup_regen', detail: 'Backup codes regenerated' });
        _showBackupCodes(plain);
      },
    });
  }

  function revokeTrusted() {
    const user = Auth.currentUser();
    TwoFA.revokeAllTrusted(user.id);
    Notify.success('Device terpercaya dicabut. Login berikutnya akan minta OTP.');
    renderKeamanan();
  }

  async function saveOTPProviderConfig() {
    if (!Auth.isSuperAdmin()) { Notify.error('Hanya superadmin'); return; }
    const existing = await DB.getSettings().catch(() => ({}));
    const data = { ...existing,
      emailjsServiceId: document.getElementById('emailjs-service').value.trim(),
      emailjsTemplateId: document.getElementById('emailjs-template').value.trim(),
      emailjsPublicKey: document.getElementById('emailjs-key').value.trim(),
      fonnteToken: document.getElementById('fonnte-token').value.trim(),
    };
    await DB.saveSettings(data);
    DB.logActivity({ type: 'otp_provider_config', detail: 'Provider OTP dikonfigurasi' });
    Notify.success('Konfigurasi OTP disimpan');
  }

  function _handleLogoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 512000) { Notify.warning('File terlalu besar. Maks 500KB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      // Preview
      const wrap = document.getElementById('logo-preview-wrap');
      if (wrap) wrap.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain">`;
      // Save via DB.saveSettings agar format konsisten
      DB.getSettings().then(existing => {
        existing.logoUrl = dataUrl;
        DB.saveSettings(existing);
      });
      // Update sidebar immediately
      Sidebar.render();
      Notify.success('Logo diperbarui!');
    };
    reader.readAsDataURL(file);
  }

  function _removeLogo() {
    DB.getSettings().then(settings => {
      delete settings.logoUrl;
      return DB.saveSettings(settings);
    }).then(() => {
      Sidebar.render();
      renderUmum();
      Notify.success('Logo dihapus');
    });
  }

  async function saveGeneralSettings() {
    const fd = new FormData(document.getElementById('settings-form'));
    const data = Object.fromEntries(fd.entries());
    // Merge ALL existing settings to prevent data loss (geminiApiKey, logoUrl, etc.)
    const existing = await DB.getSettings().catch(()=>({}));
    Utils.mergePreserve(data, existing);
    try {
      await DB.saveSettings(data);
      Sidebar.render();
      Notify.success('Pengaturan disimpan!');
    } catch(e) {
      Notify.error('Gagal menyimpan: ' + (e.message||''));
    }
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
    const oldHash = await Auth._hash(oldPwd);
    const pwMatch = Auth._isHashed(dbUser.password) ? dbUser.password === oldHash : dbUser.password === oldPwd;
    if (!pwMatch) { Notify.error('Password lama salah'); return; }

    dbUser.password = await Auth._hash(newPwd);
    await DB.saveUser(dbUser);
      _syncAuthJs();
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
    _usersCache = merged;
    // Auto-link users to employees by name match
    if (!_empListCache.length) _empListCache = await DB.getEmployees().catch(()=>[]);
    const empMap = new Map(_empListCache.map(e=>[e.nama?.toLowerCase(),e]));
    let autoLinked = 0;
    for (const u of merged) {
      if (u.empId) continue; // already linked
      const emp = empMap.get((u.nama||'').toLowerCase());
      if (emp) { u.empId = emp.id; autoLinked++; DB.saveUser(u).catch(()=>{}); }
    }
    if (autoLinked && window.BECCA_DEBUG) console.log(`[Settings] Auto-linked ${autoLinked} users to employees`);
    // For superadmin: load passwords from DB for display
    if (Auth.isSuperAdmin()) {
      const allWithPwd = await DB.getUsers().catch(()=>[]);
      merged.forEach(u => {
        const dbU = allWithPwd.find(d=>d.username===u.username);
        if (dbU?.password) u.password = dbU.password;
      });
    }
    merged.sort((a,b)=>_getRoles().indexOf(a.role)-_getRoles().indexOf(b.role));

    document.getElementById('set-tab-users').innerHTML = `
      <div style="display:flex;justify-content:flex-end;gap:var(--s2);margin-bottom:var(--s4)">
        <button class="btn btn-ghost btn-sm" onclick="SettingsModule.bulkCreateFromEmployees()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          Buat Akun dari Karyawan
        </button>
        <button class="btn btn-primary" onclick="SettingsModule.openUserModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg>
          Tambah User
        </button>
      </div>
      <div class="table-wrapper">
        <table class="table">
          <thead><tr style="background:var(--thead-bg)"><th style="padding:8px 10px;color:var(--thead-text);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid var(--thead-border)">#</th><th style="padding:8px 10px;color:var(--thead-text);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid var(--thead-border)">Nama</th><th style="padding:8px 10px;color:var(--thead-text);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid var(--thead-border)">Username</th><th style="padding:8px 10px;color:var(--thead-text);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid var(--thead-border)">Role</th><th style="padding:8px 10px;color:var(--thead-text);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid var(--thead-border)">Email</th><th style="padding:8px 10px;color:var(--thead-text);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid var(--thead-border)">Password</th><th style="padding:8px 10px;color:var(--thead-text);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid var(--thead-border)">Status</th><th style="padding:8px 10px;color:var(--thead-text);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;border-bottom:1px solid var(--thead-border)">Aksi</th></tr></thead>
          <tbody>
            ${merged.map((u,i)=>`
              <tr>
                <td class="text-muted">${i+1}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-weight:600">${u.nama}</span>
                    ${u.empId?'<span title="Terhubung dengan data karyawan" style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(34,197,94,.12);color:#16a34a;border:1px solid rgba(34,197,94,.25)">Karyawan</span>':''}
                  </div>
                  ${u.mustChangePassword?'<div style="font-size:10px;color:var(--warning)">⚠️ Harus ganti password</div>':''}
                </td>
                <td style="font-family:var(--font-mono);font-size:12px">${u.username}</td>
                <td><span class="badge ${u.role==='superadmin'?'badge-danger':u.role==='admin'?'badge-warning':u.role==='operator'?'badge-info':'badge-neutral'}">${u.role}</span></td>
                <td class="text-muted text-small">${u.email||'-'}</td>
                ${Auth.isSuperAdmin()?`<td style="font-family:var(--font-mono);font-size:11px;color:var(--text-3)">
                  <span style="color:var(--text-3);font-size:10px">${Auth._isHashed(u.password)?'🔒 Hashed':'⚠️ Plaintext'}</span>
                </td>`:''}
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
                      <button class="btn-icon" style="color:#ef4444"
                              onclick="SettingsModule.deleteUser('${u.id||u.username}')"
                              title="Hapus User">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
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

  let _empListCache = [];
  async function openUserModal(idOrUsername=null, isDefault=false) {
    let d = null;
    if (idOrUsername) {
      d = _usersCache.find(u=>u.id===idOrUsername||u.username===idOrUsername);
      if (!d) { const users = await DB.getUsers().catch(()=>[]); d = users.find(u=>u.id===idOrUsername||u.username===idOrUsername); }
      if (!d) d = Auth._defaultUsers.find(u=>u.id===idOrUsername||u.username===idOrUsername);
    }
    d = d || { aktif:true, role:'operator' };
    const isEdit = !!idOrUsername;
    // Load employees for link dropdown
    if (!_empListCache.length) _empListCache = await DB.getEmployees().catch(()=>[]);
    _empListCache = _empListCache.filter(e=>e.status!=='nonaktif'&&e.status!=='resign').sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));

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
              <input name="username" class="form-control" value="${d.username||''}" required>
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
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">No. WhatsApp</label>
              <input name="noWA" type="tel" class="form-control" value="${d.noWA||''}" placeholder="628xxxxxxxxx" style="font-family:var(--font-mono)">
              <div style="font-size:10px;color:var(--text-3);margin-top:3px">Format: 628xxx (tanpa + atau spasi)</div>
            </div>
            <div class="form-group">
              <label class="form-label">Link Karyawan</label>
              <select name="empId" class="form-control">
                <option value="">— Tidak terhubung —</option>
                ${(_empListCache||[]).map(e=>{
                  const linked = d.empId===e.id || (!d.empId && isEdit && (d.nama||'').toLowerCase()===(e.nama||'').toLowerCase());
                  return `<option value="${e.id}" ${linked?'selected':''}>${e.nama}${e.jabatan?' \u00b7 '+e.jabatan:''}</option>`;
                }).join('')}
              </select>
              <div style="font-size:10px;color:var(--text-3);margin-top:3px">Hubungkan dengan data karyawan untuk halaman Personal</div>
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

    if (isEdit) {
      const users = await DB.getUsers().catch(()=>[]);
      const old   = users.find(u=>u.id===existingId||u.username===existingId) ||
                    Auth._defaultUsers.find(u=>u.id===existingId||u.username===existingId);
      if (old) {
        Utils.mergePreserve(data, old);
        if (!data.password) data.password = old.password;
      }
      data.id = existingId||data.username;
    }
    else if (!data.id) data.id = Utils.uid();

    // Hash password if it's a new plaintext password (not already hashed)
    if (data.password && !Auth._isHashed(data.password)) {
      data.password = await Auth._hash(data.password);
    }

    try {
      await DB.saveUser(data);
      _syncAuthJs();
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
    _syncAuthJs();
    Notify.success(u.aktif?'User diaktifkan':'User dinonaktifkan');
    renderUsers();
  }

  async function deleteUser(idOrUsername) {
    const u = _usersCache.find(u=>u.id===idOrUsername||u.username===idOrUsername)
           || Auth._defaultUsers.find(u=>u.id===idOrUsername||u.username===idOrUsername);
    const nama = u?.nama || idOrUsername;
    const ok = await Modal.confirm({
      title: 'Hapus User',
      message: `Hapus user <strong>${nama}</strong>? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmText: 'Ya, Hapus',
    });
    if (!ok) return;
    try {
      await DB.deleteUser(idOrUsername);
      _usersCache = _usersCache.filter(u=>u.id!==idOrUsername&&u.username!==idOrUsername);
      _syncAuthJs();
      Notify.success('User dihapus', nama);
      renderUsers();
    } catch(e) {
      Notify.error('Gagal menghapus user', e.message);
    }
  }

  /* ===================== TAB: PRIVILEGE ===================== */
  async function renderPrivilege() {
    // Fetch settings dari Supabase — getSettings() sudah sync _privileges ke localStorage (DB = source of truth)
    try {
      const settings = await DB.getSettings();
      if (settings?._customRoles) localStorage.setItem('becca_custom_roles', JSON.stringify(settings._customRoles));
    } catch(e) { console.warn('[Settings] sync privileges:', e); }

    // Auto-deteksi role dari daftar user — pastikan semua role yang dipakai muncul di tabel
    try {
      const users = _usersCache.length ? _usersCache : await DB.getUsers().catch(()=>[]);
      const userRoles = [...new Set(users.map(u=>u.role).filter(Boolean))];
      let customRoles = [];
      try { customRoles = JSON.parse(localStorage.getItem('becca_custom_roles') || '[]'); } catch {}
      const allKnown = new Set([..._DEFAULT_ROLES, ...customRoles]);
      const newRoles = userRoles.filter(r => !allKnown.has(r));
      if (newRoles.length) {
        const merged = [...customRoles, ...newRoles];
        localStorage.setItem('becca_custom_roles', JSON.stringify(merged));
        try { await DB.saveSettings({ _customRoles: merged }); } catch {}
      }
    } catch {}

    if (Auth._bustPrivCache) Auth._bustPrivCache();
    let custom = {};
    try { custom = JSON.parse(localStorage.getItem('becca_privileges') || '{}'); } catch {}
    const privs  = {};
    _getRoles().forEach(r => {
      if (custom[r] && typeof custom[r] === 'object') {
        privs[r] = { ...custom[r] };
      } else {
        privs[r] = {...(Auth._defaultPrivileges[r]||{})};
      }
    });

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
               employee:'👷 Karyawan',emp_finance:'💰 Gaji & Hutang Karyawan',inventory:'📦 Inventory',
               kas:'💰 Kas Kecil',ap:'💳 Account Payable',po:'🛒 Purchase Order',task:'✅ Task',
               'daily-order':'📅 Daily Order',delivery:'🚚 Delivery',menu:'🍽️ Menu',haccp:'🧪 HACCP',
               chat:'💬 Chat',personal:'👤 Personal',report:'📈 Laporan',settings:'⚙️ Pengaturan',news:'📢 News'};
    return m[f]||f;
  }

  async function savePrivileges() {
    const custom = {};
    _getRoles().filter(r=>r!=='superadmin').forEach(role => {
      custom[role] = {};
      FEATURES.forEach(feat => {
        const viewEl = document.getElementById('priv_'+role+'_'+feat+'_view');
        const fullEl = document.getElementById('priv_'+role+'_'+feat+'_full');
        if (fullEl?.checked)      custom[role][feat] = 'all';
        else if (viewEl?.checked) custom[role][feat] = 'view';
        // Unchecked: explicitly deny (override default)
        else                      custom[role][feat] = 'none';
      });
    });
    // Tambah timestamp agar bisa deteksi versi terbaru
    custom._savedAt = new Date().toISOString();
    // Simpan ke localStorage DULU (immediate, anti-gagal)
    localStorage.setItem('becca_privileges', JSON.stringify(custom));
    if (Auth._bustPrivCache) Auth._bustPrivCache();
    const saveBtn = document.querySelector('[onclick="SettingsModule.savePrivileges()"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '⏳ Menyimpan...'; }
    // Simpan ke DB — retry 1x jika gagal
    let saved = false;
    for (let attempt = 0; attempt < 2 && !saved; attempt++) {
      try {
        await DB.saveSettings({ _privileges: custom });
        saved = true;
      } catch(e) {
        console.error('[Settings] savePrivileges attempt '+(attempt+1)+':', e);
        if (attempt === 1) Notify.error('Gagal menyimpan ke server: ' + (e.message||'timeout'));
      }
    }
    if (saved) {
      Notify.success('Hak akses disimpan!');
    } else {
      // DB gagal, tapi localStorage sudah tersimpan. Tandai agar sync ulang nanti
      localStorage.setItem('becca_privileges_pending', '1');
      Notify.warning('Tersimpan lokal. Akan disinkron ke server saat koneksi pulih.');
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '✅ Tersimpan!';
      saveBtn.style.background = 'var(--success)';
      setTimeout(() => { saveBtn.innerHTML = '💾 Simpan'; saveBtn.style.background = ''; }, 2500);
    }
    DB.logActivity({type:'update_privileges', detail:'Hak akses diperbarui'});
  }

  async function resetPrivileges() {
    if (!confirm('Reset semua hak akses ke default?')) return;
    localStorage.removeItem('becca_privileges');
    // Also clear from Supabase
    try { await DB.saveSettings({ _privileges: {} }); } catch {}
    if (Auth._bustPrivCache) Auth._bustPrivCache();
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

  async function _saveNewRole(mid) {
    const name = (document.getElementById('new-role-inp')?.value||'').trim().toLowerCase().replace(/\s+/g,'_');
    if (!name) { Notify.warning('Nama role tidak boleh kosong'); return; }
    if (_getRoles().includes(name)) { Notify.warning('Role "'+name+'" sudah ada'); return; }
    if (!/^[a-z][a-z0-9_]*$/.test(name)) { Notify.warning('Hanya huruf kecil, angka, underscore'); return; }
    const copyFrom = document.getElementById('copy-from-role')?.value;
    let existing = {};
    try { existing = JSON.parse(localStorage.getItem('becca_privileges') || '{}'); } catch {}
    if (copyFrom && existing[copyFrom]) {
      existing[name] = {...existing[copyFrom]};
      localStorage.setItem('becca_privileges', JSON.stringify(existing));
    }
    let customRoles = [];
    try { const _p = JSON.parse(localStorage.getItem('becca_custom_roles') || '[]'); if (Array.isArray(_p)) customRoles = _p; } catch {}
    customRoles.push(name);
    localStorage.setItem('becca_custom_roles', JSON.stringify(customRoles));
    if (Auth._bustPrivCache) Auth._bustPrivCache();
    const allPrivs = JSON.parse(localStorage.getItem('becca_privileges') || '{}');
    try {
      await DB.saveSettings({ _customRoles: customRoles, _privileges: allPrivs });
    } catch(e) { Notify.error('Gagal sync role ke server: '+(e.message||'')); }
    Modal.close(mid);
    Notify.success('Role "'+name+'" ditambahkan!');
    renderPrivilege();
    DB.logActivity({type:'add_role', detail:'Role baru: '+name});
  }

  function deleteCustomRole(roleName) {
    if (_DEFAULT_ROLES.includes(roleName)) { Notify.warning('Role default tidak bisa dihapus'); return; }
    Modal.confirm({title:'Hapus Role',message:'Role "'+roleName+'" akan dihapus permanen.',danger:true,confirmText:'Hapus'}).then(async ok=>{
      if (!ok) return;
      let custom = [];
      try { const _p = JSON.parse(localStorage.getItem('becca_custom_roles') || '[]'); if (Array.isArray(_p)) custom = _p; } catch {}
      const updatedRoles = custom.filter(r=>r!==roleName);
      localStorage.setItem('becca_custom_roles', JSON.stringify(updatedRoles));
      let privs = {};
      try { privs = JSON.parse(localStorage.getItem('becca_privileges') || '{}'); } catch {}
      delete privs[roleName];
      localStorage.setItem('becca_privileges', JSON.stringify(privs));
      if (Auth._bustPrivCache) Auth._bustPrivCache();
      try {
        await DB.saveSettings({ _customRoles: updatedRoles, _privileges: privs });
      } catch(e) { Notify.error('Gagal sync ke server: '+(e.message||'')); }
      Notify.success('Role "'+roleName+'" dihapus');
      renderPrivilege();
    });
  }

  /* ===================== TAB: ACTIVITY LOG ===================== */
  // Activity Log state (pagination + filter + lazy fetch limit)
  let _actState = { page: 1, perPage: 50, type: '', cat: '', search: '', fetchLimit: 5000 };

  // Derive kategori dari type — group teknis types ke kategori yang scanable
  function _actCategoryOf(type) {
    if (!type) return '-';
    const t = String(type).toLowerCase();
    if (t.includes('kas_masuk')) return 'Kas Masuk';
    if (t.includes('kas')) return 'Kas Kecil';
    if (t.includes('opname')) return 'Opname';
    if (t.includes('inventory') || t.startsWith('inv_') || t.startsWith('audit_inv')) return 'Inventory';
    if (t.includes('payroll') || t.includes('absensi') || t.startsWith('emp_') || t.includes('employee') || t.includes('jadwal')) return 'Karyawan';
    if (t.includes('customer')) return 'Customer';
    if (t.includes('invoice')) return 'Invoice';
    if (t.includes('order')) return 'Order';
    if (t.includes('belanja_pasar') || t.includes('anggaran') || t.includes('po_anggaran') || t === 'audit_po') return 'PO';
    if (t === 'add_ap' || t === 'edit_ap' || t === 'delete_ap' || t === 'audit_ap') return 'AP';
    if (t.includes('task')) return 'Task';
    if (t.includes('delivery')) return 'Delivery';
    if (t.includes('news')) return 'News';
    if (t.includes('menu')) return 'Menu';
    if (t.includes('chat') || t.includes('message')) return 'Chat';
    if (t.includes('login') || t.includes('logout') || t.includes('password')) return 'Auth';
    if (t.includes('user') || t.includes('role') || t.includes('privilege')) return 'User';
    if (t.includes('export') || t.includes('import') || t.includes('settings') || t.includes('backup')) return 'System';
    return 'Lainnya';
  }
  // Warna konsisten per kategori
  const _actCatColors = {
    'Kas Kecil':'#10b981', 'Kas Masuk':'#059669', 'Opname':'#0891b2',
    'Inventory':'#6366f1', 'Karyawan':'#8b5cf6', 'Customer':'#ec4899',
    'Invoice':'#f59e0b',   'Order':'#ef4444',    'PO':'#dc2626',
    'AP':'#d97706',        'Task':'#3b82f6',     'Delivery':'#06b6d4',
    'News':'#a855f7',      'Menu':'#84cc16',     'Chat':'#14b8a6',
    'Auth':'#64748b',      'User':'#0ea5e9',     'System':'#475569',
    'Lainnya':'#94a3b8',   '-':'#94a3b8',
  };

  async function renderActivity(extendLimit) {
    // Default initial load: 5000 paling baru (DB-side cap, drop 24k → 5k).
    // Tombol "Muat lebih lama" extend ke +5000 tiap klik.
    if (!extendLimit) _actState = { page: 1, perPage: 50, type: '', cat: '', search: '', fetchLimit: 5000 };
    const logs   = await DB.getActivityLogs({ limit: _actState.fetchLimit }).catch(()=>[]);
    const sorted = [...logs].sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));

    // Store logs for detail modal + refresh
    window._activityLogs = sorted;

    // Build type filter options dari unique types yg ada di logs
    const typeCounts = {};
    const catCounts = {};
    sorted.forEach(l => {
      const t = l.type || '-';
      typeCounts[t] = (typeCounts[t]||0)+1;
      const c = _actCategoryOf(t);
      catCounts[c] = (catCounts[c]||0)+1;
    });
    // Saat extend, _actState.type/cat mungkin sudah ada nilai. Pastikan opsi
    // current selection muncul di list walaupun count-nya 0 di window terbaru.
    if (_actState.type && !typeCounts[_actState.type]) typeCounts[_actState.type] = 0;
    if (_actState.cat && !catCounts[_actState.cat]) catCounts[_actState.cat] = 0;

    const _selTyp = _actState.type || '';
    const _selCat = _actState.cat || '';
    const typeOpts = Object.entries(typeCounts)
      .sort((a,b) => b[1] - a[1])
      .map(([t,c]) => `<option value="${Utils.esc(t)}"${t===_selTyp?' selected':''}>${Utils.esc(t)} (${c})</option>`)
      .join('');
    const catOpts = Object.entries(catCounts)
      .sort((a,b) => b[1] - a[1])
      .map(([c,n]) => `<option value="${Utils.esc(c)}"${c===_selCat?' selected':''}>${Utils.esc(c)} (${n})</option>`)
      .join('');

    const showLoadMore = sorted.length >= _actState.fetchLimit;
    const _selPerPage = _actState.perPage || 50;
    document.getElementById('set-tab-activity').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s4);flex-wrap:wrap;gap:var(--s3)">
        <div>
          <span class="text-muted text-small" id="act-count">${sorted.length} aktivitas</span>
          <span class="text-muted text-small" style="margin-left:8px">· Klik baris untuk detail</span>
          ${showLoadMore ? `<button class="btn btn-ghost btn-sm" style="margin-left:8px;font-size:11px"
            onclick="SettingsModule._loadMoreActivity()" title="Fetch 5000 entry lebih lama">↓ Muat lebih lama</button>` : ''}
        </div>
        <div style="display:flex;gap:var(--s2);align-items:center;flex-wrap:wrap">
          <select class="form-control" id="act-filter-cat" style="width:150px;font-size:12px"
            onchange="SettingsModule._setActCat(this.value)" title="Filter berdasarkan kategori">
            <option value=""${_selCat===''?' selected':''}>Semua kategori</option>
            ${catOpts}
          </select>
          <select class="form-control" id="act-filter-type" style="width:170px;font-size:12px"
            onchange="SettingsModule._setActType(this.value)" title="Filter berdasarkan tipe spesifik">
            <option value=""${_selTyp===''?' selected':''}>Semua tipe</option>
            ${typeOpts}
          </select>
          <input type="text" class="form-control" id="act-filter-search" style="width:180px;font-size:12px"
            placeholder="Cari user / detail..."
            value="${Utils.esc(_actState.search||'')}"
            oninput="SettingsModule._filterActivityLog(this.value)">
          <button id="act-filter-reset" class="filter-reset-btn"
            onclick="SettingsModule._resetActFilters()"
            title="Reset semua filter" aria-label="Reset filter">↺</button>
          <select class="form-control" style="width:90px;font-size:12px"
            onchange="SettingsModule._setActPerPage(+this.value)">
            <option value="25"${_selPerPage===25?' selected':''}>25/hal</option>
            <option value="50"${_selPerPage===50?' selected':''}>50/hal</option>
            <option value="100"${_selPerPage===100?' selected':''}>100/hal</option>
            <option value="200"${_selPerPage===200?' selected':''}>200/hal</option>
          </select>
          ${Auth.isSuperAdmin()?`<button class="btn btn-ghost btn-sm" style="color:var(--danger)"
            onclick="SettingsModule.clearActivityLog()">🗑️ Hapus Log</button>`:''}
        </div>
      </div>
      <div class="table-wrapper">
        <table class="table" id="activity-table">
          <thead><tr>
            <th style="width:32px">#</th>
            <th style="width:130px">Waktu</th>
            <th style="width:110px">User</th>
            <th style="width:70px">Role</th>
            <th style="width:110px">Kategori</th>
            <th style="width:140px">Tipe</th>
            <th>Detail</th>
          </tr></thead>
          <tbody id="activity-tbody"></tbody>
        </table>
      </div>
      <div id="act-pagination" style="margin-top:var(--s3);margin-bottom:48px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--s2);padding:var(--s2) 0"></div>
    `;
    _refreshActivityTable();
  }

  function _applyActFilter() {
    const logs = window._activityLogs || [];
    const lower = (_actState.search||'').toLowerCase();
    const t = _actState.type || '';
    const cat = _actState.cat || '';
    return logs.filter(l => {
      if (t && (l.type||'') !== t) return false;
      if (cat && _actCategoryOf(l.type) !== cat) return false;
      if (!lower) return true;
      const u = (l.username || l.user || '').toLowerCase();
      const ty = (l.type||'').toLowerCase();
      const d = (l.detail||'').toLowerCase();
      return u.includes(lower) || ty.includes(lower) || d.includes(lower);
    });
  }

  function _refreshActivityTable() {
    const filtered = _applyActFilter();
    const total = filtered.length;
    const perPage = Math.max(1, _actState.perPage|0);
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (_actState.page > totalPages) _actState.page = totalPages;
    if (_actState.page < 1) _actState.page = 1;
    const start = (_actState.page - 1) * perPage;
    const pageRows = filtered.slice(start, start + perPage);

    const tbody = document.getElementById('activity-tbody');
    if (tbody) tbody.innerHTML = SettingsModule._renderActivityRows(pageRows, start);

    const cnt = document.getElementById('act-count');
    if (cnt) {
      const allTotal = (window._activityLogs || []).length;
      cnt.textContent = total === allTotal
        ? `${allTotal} aktivitas`
        : `${total} dari ${allTotal} aktivitas (filtered)`;
    }

    // Toggle reset button active state (merah pulse kalau ada filter aktif)
    const resetBtn = document.getElementById('act-filter-reset');
    if (resetBtn) {
      const hasFilter = !!(_actState.type || _actState.cat || _actState.search);
      resetBtn.classList.toggle('active', hasFilter);
    }

    const pag = document.getElementById('act-pagination');
    if (pag) {
      const showFrom = total === 0 ? 0 : start + 1;
      const showTo   = Math.min(start + perPage, total);
      const btn = (label, page, disabled, primary) => `<button class="btn ${primary?'btn-primary':'btn-ghost'} btn-sm"
        style="min-width:32px;font-size:11px;padding:4px 10px${disabled?';opacity:.4;cursor:not-allowed':''}"
        ${disabled?'disabled':''} onclick="SettingsModule._setActPage(${page})">${label}</button>`;
      const numBtns = [];
      const range = 2;
      const lo = Math.max(1, _actState.page - range);
      const hi = Math.min(totalPages, _actState.page + range);
      if (lo > 1) numBtns.push(btn('1', 1, false, false));
      if (lo > 2) numBtns.push(`<span style="color:var(--text-3);font-size:11px;padding:0 4px">…</span>`);
      for (let p = lo; p <= hi; p++) numBtns.push(btn(String(p), p, false, p === _actState.page));
      if (hi < totalPages - 1) numBtns.push(`<span style="color:var(--text-3);font-size:11px;padding:0 4px">…</span>`);
      if (hi < totalPages) numBtns.push(btn(String(totalPages), totalPages, false, false));

      pag.innerHTML = `
        <div class="text-muted text-small" style="font-size:11px">
          ${total === 0 ? 'Tidak ada hasil' : `Halaman ${_actState.page} dari ${totalPages} · Menampilkan ${showFrom}–${showTo} dari ${total}`}
        </div>
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
          ${btn('« First', 1, _actState.page === 1, false)}
          ${btn('‹ Prev', _actState.page - 1, _actState.page === 1, false)}
          ${numBtns.join('')}
          ${btn('Next ›', _actState.page + 1, _actState.page === totalPages, false)}
          ${btn('Last »', totalPages, _actState.page === totalPages, false)}
        </div>`;
    }
  }

  function _renderActivityRows(rows, offset) {
    offset = offset || 0;
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

    if (!rows.length) return `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada aktivitas yang cocok</td></tr>`;

    return rows.map((log,i) => {
      const timeStr = log.timestamp
        ? new Date(log.timestamp).toLocaleString('id-ID',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
        : (log.tgl||'-');
      const color = typeColors[log.type] || 'var(--text-2)';
      const icon  = icons[log.type] || '📝';
      const detail = (log.detail||'').length > 40 ? (log.detail||'').substring(0,40)+'…' : (log.detail||'-');
      const userName = log.username || log.user || '-';

      const cat = _actCategoryOf(log.type);
      const catColor = _actCatColors[cat] || 'var(--text-2)';
      const typeSafe = (log.type||'').replace(/'/g, "\\'");
      const catSafe  = cat.replace(/'/g, "\\'");
      return `<tr style="cursor:pointer;transition:background .1s"
                onmouseover="this.style.background='var(--surface2)'"
                onmouseout="this.style.background=''"
                onclick="SettingsModule.showActivityDetail('${log.id||''}')">
        <td class="text-muted" style="font-size:11px">${offset + i + 1}</td>
        <td style="white-space:nowrap;font-size:11px;color:var(--text-3)">${timeStr}</td>
        <td style="font-weight:600;font-size:13px">${Utils.esc(userName)}</td>
        <td><span class="badge badge-neutral" style="font-size:10px">${Utils.esc(log.role||'-')}</span></td>
        <td>
          <span class="badge act-cat-pill" title="Klik untuk filter kategori '${Utils.esc(cat)}'"
            onclick="event.stopPropagation();SettingsModule._setActCat('${catSafe}');var s=document.getElementById('act-filter-cat');if(s)s.value='${catSafe}'"
            style="font-size:10px;background:${catColor}1f;color:${catColor};border:1px solid ${catColor}40;cursor:pointer;font-weight:700;transition:transform .1s,box-shadow .1s"
            onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 2px 6px '+'${catColor}40'"
            onmouseout="this.style.transform='';this.style.boxShadow=''">${Utils.esc(cat)}</span>
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px">
            <span>${icon}</span>
            <span class="badge act-type-pill" title="Klik untuk filter tipe '${Utils.esc(log.type||'-')}'"
              onclick="event.stopPropagation();SettingsModule._setActType('${typeSafe}');var s=document.getElementById('act-filter-type');if(s)s.value='${typeSafe}'"
              style="font-size:10px;background:${color}18;color:${color};border:1px solid ${color}30;cursor:pointer;transition:transform .1s,box-shadow .1s"
              onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 2px 6px '+'${color}40'"
              onmouseout="this.style.transform='';this.style.boxShadow=''">${Utils.esc(log.type||'-')}</span>
          </span>
        </td>
        <td class="text-muted" style="font-size:12px">${Utils.esc(detail)}</td>
      </tr>`;
    }).join('');
  }

  function _filterActivityLog(q) {
    _actState.search = q || '';
    _actState.page = 1;
    _refreshActivityTable();
  }
  function _setActType(t) { _actState.type = t || ''; _actState.page = 1; _refreshActivityTable(); }
  function _setActCat(c) { _actState.cat = c || ''; _actState.page = 1; _refreshActivityTable(); }
  function _setActPage(p) { _actState.page = Math.max(1, p|0); _refreshActivityTable(); }
  function _setActPerPage(n) { _actState.perPage = Math.max(1, n|0); _actState.page = 1; _refreshActivityTable(); }
  function _resetActFilters() {
    _actState.type = ''; _actState.cat = ''; _actState.search = ''; _actState.page = 1;
    const cat = document.getElementById('act-filter-cat');     if (cat) cat.value = '';
    const typ = document.getElementById('act-filter-type');    if (typ) typ.value = '';
    const src = document.getElementById('act-filter-search');  if (src) src.value = '';
    const btn = document.getElementById('act-filter-reset');
    if (btn) { btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 600); }
    _refreshActivityTable();
  }
  async function _loadMoreActivity() {
    _actState.fetchLimit = (_actState.fetchLimit || 5000) + 5000;
    Notify.info('Memuat ' + _actState.fetchLimit + ' entry...');
    await renderActivity(true);
  }

  function showActivityDetail(idOrIdx) {
    const logs = window._activityLogs || [];
    // Backward compat: idx (number) atau id (string) — sekarang pass log.id
    let log = null;
    if (typeof idOrIdx === 'number' || /^\d+$/.test(String(idOrIdx))) {
      log = logs[+idOrIdx];
    } else {
      log = logs.find(l => l.id === idOrIdx);
    }
    if (!log) return;

    const timeStr = log.timestamp
      ? new Date(log.timestamp).toLocaleString('id-ID', {
          weekday:'long', year:'numeric', month:'long', day:'numeric',
          hour:'2-digit', minute:'2-digit', second:'2-digit'
        })
      : (log.tgl||'-');

    // Parse object data from detail string
    // Format detail biasanya: "Nama/ID: value" atau JSON-like
    const objRows = _parseActivityObject(log);

    // Action label yang lebih manusiawi
    const actionLabels = {
      login:'Login ke sistem', logout:'Logout dari sistem',
      add_user:'Tambah user baru', edit_user:'Edit data user', change_password:'Ganti password',
      update_privileges:'Update hak akses',
      add_kas:'Tambah baris kas kecil', edit_kas:'Edit baris kas kecil', delete_kas:'Hapus baris kas kecil',
      add_inventory:'Tambah transaksi inventory', edit_inventory:'Edit transaksi inventory',
      delete_inventory:'Hapus transaksi inventory', opname:'Stok opname',
      add_item:'Tambah barang baru', edit_item:'Edit data barang',
      add_customer:'Tambah customer', edit_customer:'Edit customer', delete_customer:'Hapus customer',
      add_invoice:'Buat invoice', edit_invoice:'Edit invoice', delete_invoice:'Hapus invoice',
      add_task:'Tambah task', edit_task:'Edit task', complete_task:'Selesaikan task',
      archive_task:'Arsip task', delete_task:'Hapus task',
      add_ap:'Tambah AP', edit_ap:'Edit AP',
      employee:'Aksi karyawan', add_role:'Tambah role baru',
      export_data:'Export data', import_data:'Import data',
    };

    const actionLabel = actionLabels[log.type] || log.type || '-';
    const typeColors = {
      delete_kas:'var(--danger)', delete_inventory:'var(--danger)',
      delete_customer:'var(--danger)', delete_invoice:'var(--danger)', delete_task:'var(--danger)',
      add_kas:'var(--success)', add_inventory:'var(--success)', add_customer:'var(--success)',
      login:'var(--info)', update_privileges:'var(--warning)',
    };
    const typeColor = typeColors[log.type] || 'var(--primary-h)';

    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: '📋 Detail Aktivitas',
      size: 'modal-lg',
      body: `
        <!-- Header aktivitas -->
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;
                    background:var(--surface2);border-radius:var(--r-md);margin-bottom:var(--s4)">
          <div style="width:40px;height:40px;border-radius:50%;background:${typeColor}18;
                      color:${typeColor};display:flex;align-items:center;justify-content:center;
                      font-size:18px;flex-shrink:0">
            ${({login:'🔑',logout:'🚪',add_user:'➕',edit_user:'✏️',delete_kas:'🗑️',
                add_kas:'💰',edit_kas:'💰',add_inventory:'📦',edit_inventory:'📦',
                delete_inventory:'🗑️',opname:'🔢',employee:'👷',update_privileges:'🔐',
                add_task:'✅',complete_task:'✅',export_data:'📥',import_data:'📤'}[log.type]||'📝')}
          </div>
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--heading)">${actionLabel}</div>
            <div style="font-size:12px;color:var(--text-3)">${timeStr}</div>
          </div>
          <div style="margin-left:auto;text-align:right">
            <div style="font-size:12px;color:var(--text-3)">Oleh</div>
            <div style="font-weight:600;font-size:13px">${log.user||'-'}</div>
            <span class="badge badge-neutral" style="font-size:10px">${log.role||'-'}</span>
          </div>
        </div>

        <!-- Snapshot / Before-After Section -->
        ${_renderActivitySnapshot(log)}
      `,
      footer: `${_canGoToRow(log) ? `<button class="btn btn-primary" onclick="SettingsModule._goToRow('${mid}',${idx})" style="font-size:12px">Lihat Data →</button>` : ''}
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  function _canGoToRow(log) {
    const t = log.type||'';
    const rid = log.rowId || log.snapshot?.after?.id || log.data?.snapshot?.after?.id;
    if (!rid) return false;
    return t.includes('kas') || t.includes('inventory') || t.includes('ap');
  }

  async function _goToRow(modalId, idx) {
    const log = window._activityLogs?.[idx];
    if (!log) return;
    Modal.close(modalId);
    const t = log.type||'';
    const rowId = log.rowId || log.snapshot?.after?.id || log.data?.snapshot?.after?.id;
    if (!rowId) return;
    let page='', prefix='', switchTab=null;
    if (t.includes('kas'))       { page='kas'; prefix='ks-row-'; switchTab=()=>window.KasModule?.switchTab?.('transaksi'); }
    if (t.includes('inventory')) { page='inventory'; prefix='iv-row-'; switchTab=()=>window.InventoryModule?.switchTab?.('transaksi'); }
    if (t.includes('ap'))        { page='ap'; prefix='ap-row-'; switchTab=()=>window.APModule?.switchTab?.('list'); }
    if (!page) return;

    // Navigate ke halaman
    if (typeof App !== 'undefined' && App.navigate) await App.navigate(page);
    // Switch ke tab yang benar
    if (switchTab) switchTab();

    // Tunggu render selesai, lalu scroll + flash
    const _tryFind = (attempts) => {
      const el = document.getElementById(prefix + rowId);
      if (el) {
        el.scrollIntoView({ behavior:'smooth', block:'center' });
        // Inject flash CSS jika belum ada
        if (!document.getElementById('go-flash-css')) {
          const s = document.createElement('style'); s.id = 'go-flash-css';
          s.textContent = `@keyframes goFlash{0%{background:rgba(99,102,241,.35);box-shadow:0 0 0 3px #6366f1}50%{background:rgba(99,102,241,.2);box-shadow:0 0 0 2px rgba(99,102,241,.5)}100%{background:transparent;box-shadow:none}}
            .go-flash td{animation:goFlash 2.5s ease forwards!important}`;
          document.head.appendChild(s);
        }
        el.classList.add('go-flash');
        setTimeout(() => el.classList.remove('go-flash'), 3000);
      } else if (attempts > 0) {
        setTimeout(() => _tryFind(attempts - 1), 300);
      } else {
        Notify.info('Baris tidak ditemukan (mungkin di halaman pagination lain)');
      }
    };
    setTimeout(() => _tryFind(5), 300);
  }

  // Parse activity log detail string menjadi key-value rows untuk tabel Objek
  function _parseActivityObject(log) {
    const rows = [];
    const detail = log.detail || '';
    const type   = log.type   || '';

    // Common patterns dari detail string
    // "Edit: Minyak Kita @ 1 liter" → {k: 'Nama', v: 'Minyak Kita @ 1 liter'}
    // "MASUK Minyak Kita: 200" → {k: 'Tipe', v: 'MASUK'}, {k: 'Barang', v: 'Minyak Kita'}, {k: 'Jumlah', v: '200'}
    // "Opname Minyak Kita: 700→125" → {k: 'Barang', v: ...}, {k: 'Perubahan', v: ...}

    // Extract by type pattern
    if (type.includes('kas')) {
      rows.push({k: 'Modul', v: 'Kas Kecil'});
      if (detail.includes(':')) {
        const parts = detail.split(':');
        rows.push({k: 'Aksi', v: parts[0]?.trim()});
        if (parts[1]) rows.push({k: 'Keterangan', v: parts.slice(1).join(':').trim()});
      } else if (detail) {
        rows.push({k: 'Info', v: detail});
      }
    } else if (type.includes('inventory') || type === 'opname') {
      rows.push({k: 'Modul', v: 'Inventory'});
      // "MASUK Minyak Kita @ 1 liter: 200"
      const masukMatch = detail.match(/^(MASUK|KELUAR|OPNAME)\s+(.+?):\s*(.+)$/i);
      if (masukMatch) {
        rows.push({k: 'Jenis',  v: masukMatch[1]});
        rows.push({k: 'Barang', v: masukMatch[2]});
        rows.push({k: 'Jumlah', v: masukMatch[3]});
      } else if (detail.includes('→')) {
        // "Opname Minyak: 700→125"
        const opMatch = detail.match(/Opname\s+(.+?):\s*(\d+)\s*→\s*(\d+)/i);
        if (opMatch) {
          rows.push({k: 'Barang',      v: opMatch[1]});
          rows.push({k: 'Stok Lama',   v: opMatch[2]});
          rows.push({k: 'Stok Baru',   v: opMatch[3]});
          rows.push({k: 'Selisih',     v: String(parseInt(opMatch[3])-parseInt(opMatch[2]))});
        }
      } else if (detail.includes('Edit:')) {
        rows.push({k: 'Aksi',  v: 'Edit'});
        rows.push({k: 'Nama',  v: detail.replace('Edit:','').trim()});
      } else if (detail) {
        rows.push({k: 'Info', v: detail});
      }
    } else if (type.includes('customer')) {
      rows.push({k: 'Modul', v: 'Customer'});
      const m = detail.match(/^(Tambah|Edit|Hapus):\s*(.+)$/i);
      if (m) { rows.push({k:'Aksi',v:m[1]}); rows.push({k:'Nama',v:m[2]}); }
      else if (detail) rows.push({k:'Info',v:detail});
    } else if (type.includes('invoice')) {
      rows.push({k: 'Modul', v: 'Invoice'});
      if (detail) rows.push({k:'Info',v:detail});
    } else if (type.includes('task')) {
      rows.push({k: 'Modul', v: 'Task'});
      const m = detail.match(/^(Tambah|Edit|Hapus|Selesai|Arsip)\s+task:\s*(.+)$/i);
      if (m) { rows.push({k:'Aksi',v:m[1]}); rows.push({k:'Task',v:m[2]}); }
      else if (detail) rows.push({k:'Judul',v:detail});
    } else if (type === 'add_user' || type === 'edit_user') {
      rows.push({k: 'Modul', v: 'User Management'});
      const m = detail.match(/^(Tambah|Edit)\s+user:\s*(.+)$/i);
      if (m) { rows.push({k:'Aksi',v:m[1]}); rows.push({k:'Username',v:m[2]}); }
      else if (detail) rows.push({k:'Info',v:detail});
    } else if (type === 'employee') {
      rows.push({k: 'Modul', v: 'Karyawan'});
      const m = detail.match(/^(Tambah|Edit):\s*(.+)$/i);
      if (m) { rows.push({k:'Aksi',v:m[1]}); rows.push({k:'Nama',v:m[2]}); }
      else if (detail) rows.push({k:'Info',v:detail});
    } else if (type === 'update_privileges') {
      rows.push({k: 'Modul', v: 'Hak Akses'});
      rows.push({k: 'Aksi',  v: 'Update privilege matrix'});
    } else if (type === 'add_role') {
      rows.push({k: 'Modul', v: 'Hak Akses'});
      const m = detail.match(/Role baru:\s*(.+)/i);
      if (m) rows.push({k:'Role',v:m[1]});
    } else if (type === 'login' || type === 'logout') {
      rows.push({k: 'Aksi',   v: type === 'login' ? 'Masuk sistem' : 'Keluar sistem'});
      rows.push({k: 'User',   v: log.user||'-'});
      rows.push({k: 'Role',   v: log.role||'-'});
    } else {
      if (detail) rows.push({k: 'Info', v: detail});
    }

    return rows;
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
      ${typeof WeeklyDigest !== 'undefined' ? WeeklyDigest.renderSettingsCard() : ''}
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
            <div style="border-top:1px solid var(--border);padding-top:var(--s3);margin-top:var(--s2)">
              <button class="btn btn-primary w-full" onclick="SettingsModule.recoverData()" id="btn-recover">
                🔄 Recovery Data dari Device Ini
              </button>
              <div style="font-size:11px;color:var(--text-3);margin-top:6px">Pulihkan data yang hilang di server dari localStorage device ini. Aman dijalankan berkali-kali — hanya mengisi data yang kosong di server.</div>
            </div>
            <div style="font-size:12px;color:var(--text-3);margin-top:var(--s2)">Export sebagai backup. Data tersimpan di localStorage browser ini.</div>
            ${Auth.isSuperAdmin()?`
              <div style="border-top:1px solid var(--border);padding-top:var(--s3)">
                <button class="btn btn-ghost w-full" style="color:var(--danger);border-color:rgba(239,68,68,.2)" onclick="SettingsModule.clearData()">🗑️ Reset Semua Data</button>
              </div>
              <div style="border-top:1px solid var(--border);padding-top:var(--s3);margin-top:var(--s2)">
                <button class="btn btn-ghost w-full" style="color:var(--primary);border-color:rgba(99,102,241,.3)" onclick="SettingsModule.runTests()" id="btn-tests">
                  🧪 Run Tests
                </button>
                <div id="test-results" style="margin-top:8px"></div>
              </div>
            `:''}
          </div>
        </div>
      </div>
      ${Auth.isSuperAdmin() ? `
      <div class="card" style="margin-top:var(--s5);border:1px solid rgba(239,68,68,.25)">
        <div class="card-header" style="border-bottom:1px solid rgba(239,68,68,.15)">
          <div class="card-title" style="color:var(--danger)">⚠️ Data Control</div>
          <span style="font-size:11px;color:var(--text-3)">Superadmin only</span>
        </div>
        <div style="padding:var(--s5)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)">

            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s4)">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">📦 Inventory</div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s3)">
                Produk + log aktivitas inventory.
              </div>
              <button class="btn btn-ghost btn-sm w-full" style="margin-bottom:var(--s2)"
                onclick="SettingsModule.importInventoryExcel()">
                📤 Import Daftar Barang (Excel)
              </button>
              <button class="btn btn-ghost btn-sm w-full" style="margin-bottom:var(--s2)"
                onclick="SettingsModule.importActivityExcel()">
                📋 Import Activity Line (Excel)
              </button>
              <button class="btn btn-sm w-full" style="margin-bottom:var(--s2);background:rgba(239,68,68,.08);color:var(--danger);border:1px solid rgba(239,68,68,.25)"
                onclick="SettingsModule.clearInventoryData()">
                🗑️ Hapus Semua Data Inventory
              </button>
              <button class="btn btn-sm w-full"
                style="background:rgba(239,68,68,.08);color:var(--danger);border:1px solid rgba(239,68,68,.25)"
                onclick="SettingsModule.clearOpnameData()">
                🗑️ Hapus Data Stock Opname
              </button>
            </div>

            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s4)">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">💰 Kas Kecil</div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s3)">
                Semua transaksi kas kecil.
              </div>
              <div style="font-size:11px;color:var(--text-3);padding:8px;background:var(--surface);border-radius:var(--r-sm)">
                Import Excel tersedia langsung di halaman Kas Kecil.
              </div>
            </div>

            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s4)">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">🛒 Order Catering</div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s3)">
                Semua data order dan invoice catering.
              </div>
              <button class="btn btn-ghost btn-sm w-full" style="margin-bottom:var(--s2)"
                onclick="SettingsModule.importOrdersExcel()">
                📤 Import Order (Excel)
              </button>
              <button class="btn btn-ghost btn-sm w-full" style="margin-bottom:var(--s2)"
                onclick="SettingsModule.importInvoicesExcel()">
                📤 Import Invoice (Excel)
              </button>
              <button class="btn btn-sm w-full" style="margin-bottom:var(--s2);background:rgba(239,68,68,.08);color:var(--danger);border:1px solid rgba(239,68,68,.25)"
                onclick="SettingsModule.clearOrdersData()">
                🗑️ Hapus Semua Order
              </button>
              <button class="btn btn-sm w-full" style="background:rgba(239,68,68,.08);color:var(--danger);border:1px solid rgba(239,68,68,.25)"
                onclick="SettingsModule.clearInvoicesData()">
                🗑️ Hapus Semua Invoice
              </button>
            </div>

            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s4)">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px">👤 Absensi</div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:var(--s3)">
                Data absensi karyawan hari ini.
              </div>
              <button class="btn btn-sm w-full" style="background:rgba(239,68,68,.08);color:var(--danger);border:1px solid rgba(239,68,68,.25)"
                onclick="FaceAttendanceModule?.resetTodayAbsensi()">
                ⟳ Reset Absensi Hari Ini
              </button>
            </div>

          </div>
          <div style="margin-top:var(--s3);font-size:11px;color:var(--text-3)">
            ⚠️ Hapus akan menghapus permanen dari Supabase. Tidak bisa dikembalikan.
          </div>
        </div>
      </div>
      ` : ''}
    `;
  }

  async function runTests() {
    const btn = document.getElementById('btn-tests');
    const el = document.getElementById('test-results');
    if (btn) { btn.disabled = true; btn.textContent = '🧪 Running...'; }
    if (el) el.innerHTML = '<div style="color:var(--text-3);font-size:12px">Running tests...</div>';
    try {
      if (typeof BeccaTests === 'undefined') {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'js/tests.js?v=20260726d';
          s.onload = resolve;
          s.onerror = () => reject(new Error('Gagal memuat tests.js'));
          document.head.appendChild(s);
        });
      }
      const result = await BeccaTests.runAll();
      if (el) el.innerHTML = BeccaTests.getHtmlReport();
      if (result.failed === 0) Notify.success(`Tests: ${result.passed} passed, 0 failed`);
      else Notify.warning(`Tests: ${result.passed} passed, ${result.failed} failed`);
    } catch(e) {
      if (el) el.innerHTML = `<div style="color:var(--danger)">${e.message}</div>`;
      Notify.error('Test error: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🧪 Run Tests'; }
    }
  }

  async function recoverData() {
    const btn = document.getElementById('btn-recover');
    if (btn) { btn.disabled = true; btn.textContent = '🔄 Memulihkan data...'; }
    try {
      const result = await DB.recoverFromLocalStorage();
      if (result.fixed > 0) {
        const detail = Object.entries(result.report || {}).map(([t,n]) => `${t}: ${n}`).join(', ');
        Notify.success(`${result.fixed} data berhasil dipulihkan`, detail);
        // Refresh current tab
        switchTab('data');
      } else {
        Notify.info('Tidak ada data baru untuk dipulihkan dari device ini');
      }
    } catch(e) {
      Notify.error('Recovery gagal', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Recovery Data dari Device Ini'; }
    }
  }

  function exportData() {
    const keys = ['orders','invoices','customers','kas','kas_masuk','inventory','inv_products','employees','emp_logs','ap','suppliers','tasks','settings','users','activity_log'];
    const HEAVY = ['fotoUrl','ktpUrl','faceDescriptors','mediaUrl','logoUrl'];
    const out  = {_exportedAt:new Date().toISOString(),_version:'2.0'};
    keys.forEach(k=>{
      try {
        let arr = JSON.parse(localStorage.getItem('becca_'+k)||'[]');
        // Strip heavy base64 fields to keep export small
        if (Array.isArray(arr)) arr = arr.map(r => {
          const clean = {...r};
          HEAVY.forEach(f => { if (clean[f] && typeof clean[f] === 'string' && clean[f].length > 500) delete clean[f]; });
          return clean;
        });
        out[k] = arr;
      } catch{}
    });
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

  /* ============ INVENTORY: HAPUS DATA ============ */
  async function clearInventoryData() {
    if (!Auth.isSuperAdmin()) return;

    // Konfirmasi ke-1
    const ok1 = await Modal.confirm({
      title: '⚠️ Hapus Semua Data Inventory',
      message: 'Tindakan ini akan menghapus SEMUA produk dan log aktivitas inventory dari Supabase secara permanen.\n\nData TIDAK bisa dikembalikan. Lanjutkan?',
      danger: true,
      confirmText: 'Ya, Lanjutkan'
    });
    if (!ok1) return;

    // Konfirmasi ke-2
    const ok2 = await Modal.confirm({
      title: '🔴 Konfirmasi Akhir',
      message: 'YAKIN BENAR-BENAR INGIN MENGHAPUS?\n\nSemua produk inventory dan semua log aktivitas akan dihapus dari server sekarang.',
      danger: true,
      confirmText: '🗑️ Hapus Sekarang'
    });
    if (!ok2) return;

    try {
      Notify.info('Menghapus data inventory dari Supabase...');
      await DB.clearTableData('inv_products');
      await DB.clearTableData('inv_activities');
      // Juga bersihkan tabel lama jika ada
      await DB.clearTableData('inventory').catch(()=>{});
      Notify.success('Semua data inventory berhasil dihapus ✓');
      DB.logActivity({ type: 'clear_inventory', detail: 'Hapus semua data inventory (produk + log aktivitas)' });
      renderData();
    } catch(e) {
      Notify.error('Gagal menghapus', e.message);
    }
  }

  /* ============ ORDER: IMPORT EXCEL ============ */
  function importOrdersExcel() {
    if (!Auth.isSuperAdmin()) return;
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: '📤 Import Order dari Excel',
      body: `
        <p style="font-size:13px;color:var(--text-2);margin-bottom:var(--s3)">
          Upload file Excel (.xlsx/.xls) berisi data order catering.<br>
          Kolom yang dikenali: <strong>Tanggal, Customer/Perusahaan, Jenis/Catatan,
          BF, S1, Sp1, OT1, Snk1, S2, Sp2, OT2, Snk2, S3, Sp3, OT3, Snk3, SnkBrt</strong>
        </p>
        <button class="btn btn-primary w-full" onclick="SettingsModule._doImportOrdersExcel('${mid}')">
          📂 Pilih File Excel Order
        </button>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  async function _doImportOrdersExcel(mid) {
    const inp = Object.assign(document.createElement('input'), { type:'file', accept:'.xlsx,.xls', style:'display:none' });
    document.body.appendChild(inp);
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(inp);
      if (!file) return;
      Modal.close(mid);

      if (!window.XLSX) {
        Notify.info('Memuat library Excel...');
        const loaded = await new Promise(res => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = () => res(true); s.onerror = () => res(false);
          document.head.appendChild(s);
        });
        if (!loaded || !window.XLSX) { Notify.error('Gagal memuat library Excel'); return; }
      }

      Notify.info('Membaca file Excel Order...');
      let wb;
      try {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type:'array', cellDates:false });
      } catch(err) { Notify.error('File tidak bisa dibaca', err.message); return; }

      const COL_MAP = {
        tanggal:'tgl', tgl:'tgl', date:'tgl', 'tgl order':'tgl',
        customer:'cust', perusahaan:'cust', 'nama perusahaan':'cust', 'nama customer':'cust', client:'cust',
        jenis:'catatan', catatan:'catatan', keterangan:'catatan', notes:'catatan', type:'catatan',
        bf:'breakfast', breakfast:'breakfast',
        s1:'shift1', 'shift 1':'shift1', shift1:'shift1',
        sp1:'spare1', spare1:'spare1',
        ot1:'ot1',
        snk1:'snack1', snack1:'snack1', 'snack 1':'snack1',
        s2:'shift2', 'shift 2':'shift2', shift2:'shift2',
        sp2:'spare2', spare2:'spare2',
        ot2:'ot2',
        snk2:'snack2', snack2:'snack2', 'snack 2':'snack2',
        s3:'shift3', 'shift 3':'shift3', shift3:'shift3',
        sp3:'spare3', spare3:'spare3',
        ot3:'ot3',
        snk3:'snack3', snack3:'snack3', 'snack 3':'snack3',
        snkbrt:'snackBerat', 'snack berat':'snackBerat', snackberat:'snackBerat',
      };

      const orders = [];
      for (const sheetName of wb.SheetNames) {
        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (rows.length < 2) continue;

        // Cari header row
        let hdrIdx = -1, col = {};
        for (let ri = 0; ri < Math.min(rows.length, 10); ri++) {
          const tmp = {};
          rows[ri].forEach((h, i) => {
            const k = String(h||'').toLowerCase().trim().replace(/\s+/g,' ');
            const f = COL_MAP[k]; if (f && !(f in tmp)) tmp[f] = i;
          });
          if (tmp.tgl !== undefined || tmp.cust !== undefined) { hdrIdx = ri; col = tmp; break; }
        }
        if (hdrIdx < 0) continue;

        for (let ri = hdrIdx + 1; ri < rows.length; ri++) {
          const row = rows[ri];
          if (row.every(c => c === '' || c === null || c === undefined)) continue;
          const tgl  = col.tgl  !== undefined ? String(row[col.tgl]||'').trim()  : '';
          const cust = col.cust !== undefined ? String(row[col.cust]||'').trim() : '';
          if (!tgl && !cust) continue;

          const _n = k => col[k] !== undefined ? (parseInt(row[col[k]]) || 0) : 0;
          const now = new Date().toISOString();
          orders.push({
            id: 'ord_' + Utils.uid(),
            timestamp: now.slice(0,10) + ' ' + now.slice(11,19),
            pelapor: Auth.currentUser()?.username || 'import',
            tglOrder: tgl, namaPerusahaan: cust,
            catatan: col.catatan !== undefined ? String(row[col.catatan]||'').trim() : '',
            breakfast: _n('breakfast'),
            shift1: _n('shift1'), spare1: _n('spare1'), ot1: _n('ot1'), snack1: _n('snack1'),
            shift2: _n('shift2'), spare2: _n('spare2'), ot2: _n('ot2'), snack2: _n('snack2'),
            shift3: _n('shift3'), spare3: _n('spare3'), ot3: _n('ot3'), snack3: _n('snack3'),
            snackBerat: _n('snackBerat'),
          });
        }
      }

      if (!orders.length) { Notify.error('Tidak ada data order yang dibaca'); return; }
      Notify.info(`Menyimpan ${orders.length} order...`);
      let saved = 0;
      for (const o of orders) {
        try { await DB.saveOrder(o); saved++; } catch {}
      }
      // Refresh order module if loaded
      if (typeof OrderModule !== 'undefined' && OrderModule.init) {
        try { await OrderModule.init(); } catch {}
      }
      Notify.success(`Import Order selesai: ${saved} order disimpan`);
      DB.logActivity({ type:'import_orders', detail:`Import Order Excel: ${saved} dari ${file.name}` });
    };
    inp.click();
  }

  /* ============ INVOICE: IMPORT EXCEL ============ */
  function importInvoicesExcel() {
    if (!Auth.isSuperAdmin()) return;
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: '📤 Import Invoice dari Excel',
      body: `
        <p style="font-size:13px;color:var(--text-2);margin-bottom:var(--s3)">
          Upload file Excel (.xlsx/.xls) berisi data invoice / AR.<br>
          Kolom yang dikenali: <strong>No. Invoice, Customer, PO, Tgl Invoice, Tgl Bayar,
          Total, After PPh, Total Terbayar, Sisa, Status</strong>
        </p>
        <button class="btn btn-primary w-full" onclick="SettingsModule._doImportInvoicesExcel('${mid}')">
          📂 Pilih File Excel Invoice
        </button>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  async function _doImportInvoicesExcel(mid) {
    const inp = Object.assign(document.createElement('input'), { type:'file', accept:'.xlsx,.xls', style:'display:none' });
    document.body.appendChild(inp);
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(inp);
      if (!file) return;
      Modal.close(mid);

      if (!window.XLSX) {
        Notify.info('Memuat library Excel...');
        const loaded = await new Promise(res => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = () => res(true); s.onerror = () => res(false);
          document.head.appendChild(s);
        });
        if (!loaded || !window.XLSX) { Notify.error('Gagal memuat library Excel'); return; }
      }

      Notify.info('Membaca file Excel Invoice...');
      let wb;
      try {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type:'array', cellDates:false });
      } catch(err) { Notify.error('File tidak bisa dibaca', err.message); return; }

      const COL_MAP = {
        'no invoice':'invoiceNum', 'nomor invoice':'invoiceNum', 'invoice num':'invoiceNum',
        'invoice number':'invoiceNum', 'no. invoice':'invoiceNum', noinvoice:'invoiceNum',
        invoicenum:'invoiceNum', invoice:'invoiceNum',
        customer:'customer', 'nama customer':'customer', perusahaan:'customer',
        'nama perusahaan':'customer', client:'customer',
        po:'po', 'no po':'po', 'nomor po':'po',
        'tgl invoice':'tglInvoice', 'tanggal invoice':'tglInvoice', 'date invoice':'tglInvoice',
        'invoice date':'tglInvoice',
        'tgl bayar':'tglBayar', 'tanggal bayar':'tglBayar', 'jatuh tempo':'tglBayar',
        'due date':'tglBayar', duedate:'tglBayar',
        total:'total', 'total invoice':'total', 'nilai invoice':'total',
        'after pph':'afterPph', 'dpp':'afterPph', pph:'afterPph', net:'afterPph',
        'after ppn':'afterPph', afterpph:'afterPph',
        'total terbayar':'totalTerbayar', terbayar:'totalTerbayar', paid:'totalTerbayar',
        'tgl terbayar':'tglTerbayar', 'tanggal terbayar':'tglTerbayar', 'paid date':'tglTerbayar',
        sisa:'sisa', outstanding:'sisa', remaining:'sisa',
        status:'status',
      };

      // Excel date serial → YYYY-MM-DD
      const _exDate = v => {
        const n = parseFloat(v);
        if (!n || n < 1) return String(v||'').trim();
        return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().slice(0,10);
      };

      const invoices = [];
      for (const sheetName of wb.SheetNames) {
        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (rows.length < 2) continue;

        let hdrIdx = -1, col = {};
        for (let ri = 0; ri < Math.min(rows.length, 10); ri++) {
          const tmp = {};
          rows[ri].forEach((h, i) => {
            const k = String(h||'').toLowerCase().trim().replace(/\s+/g,' ');
            const f = COL_MAP[k]; if (f && !(f in tmp)) tmp[f] = i;
          });
          if (tmp.invoiceNum !== undefined || tmp.customer !== undefined) { hdrIdx = ri; col = tmp; break; }
        }
        if (hdrIdx < 0) continue;

        let no = 1;
        for (let ri = hdrIdx + 1; ri < rows.length; ri++) {
          const row = rows[ri];
          if (row.every(c => c === '' || c === null || c === undefined)) continue;
          const invoiceNum = col.invoiceNum !== undefined ? String(row[col.invoiceNum]||'').trim() : '';
          const customer   = col.customer   !== undefined ? String(row[col.customer]  ||'').trim() : '';
          if (!invoiceNum && !customer) continue;

          const _s = k => col[k] !== undefined ? String(row[col[k]]||'').trim() : '';
          const _n = k => col[k] !== undefined ? (parseFloat(String(row[col[k]]||'0').replace(/[^\d.]/g,'')) || 0) : 0;

          const total         = _n('total');
          const afterPph      = _n('afterPph') || total;
          const totalTerbayar = _n('totalTerbayar');
          const sisa          = col.sisa !== undefined ? _n('sisa') : Math.max(0, total - totalTerbayar);
          const rawStatus     = _s('status');
          const status        = rawStatus ? rawStatus : (sisa <= 0 ? 'Paid' : 'Unpaid');

          invoices.push({
            id: 'inv_' + Utils.uid(),
            no: no++,
            customerId: '',
            customer, po: _s('po'), invoiceNum,
            tglInvoice: _exDate(_s('tglInvoice') || (col.tglInvoice !== undefined ? row[col.tglInvoice] : '')),
            tglBayar:   _exDate(_s('tglBayar')   || (col.tglBayar   !== undefined ? row[col.tglBayar]   : '')),
            sisaHari: null,
            total, afterPph, totalTerbayar,
            tglTerbayar: _s('tglTerbayar'), lamaTerbayar: '',
            sisa, status,
          });
        }
      }

      if (!invoices.length) { Notify.error('Tidak ada data invoice yang dibaca'); return; }
      Notify.info(`Menyimpan ${invoices.length} invoice...`);
      let saved = 0;
      for (const inv of invoices) {
        try { await DB.saveInvoice(inv); saved++; } catch {}
      }
      Notify.success(`Import Invoice selesai: ${saved} invoice disimpan`);
      DB.logActivity({ type:'import_invoices', detail:`Import Invoice Excel: ${saved} dari ${file.name}` });
    };
    inp.click();
  }

  /* ============ ORDER & INVOICE: HAPUS DATA ============ */
  async function clearOrdersData() {
    if (!Auth.isSuperAdmin()) return;
    const ok1 = await Modal.confirm({
      title: '⚠️ Hapus Semua Order',
      message: 'Semua data order catering akan dihapus permanen dari server.\n\nTidak bisa dikembalikan. Lanjutkan?',
      danger: true, confirmText: 'Ya, Lanjutkan'
    });
    if (!ok1) return;
    const ok2 = await Modal.confirm({
      title: '🔴 Konfirmasi Akhir',
      message: 'YAKIN ingin menghapus SEMUA data order catering sekarang?',
      danger: true, confirmText: '🗑️ Hapus Sekarang'
    });
    if (!ok2) return;
    try {
      Notify.info('Menghapus data order...');
      await DB.clearTableData('orders');
      Notify.success('Semua data order berhasil dihapus ✓');
      DB.logActivity({ type:'clear_orders', detail:'Hapus semua data order catering' });
      renderData();
    } catch(e) { Notify.error('Gagal menghapus', e.message); }
  }

  async function clearInvoicesData() {
    if (!Auth.isSuperAdmin()) return;
    const ok1 = await Modal.confirm({
      title: '⚠️ Hapus Semua Invoice',
      message: 'Semua data invoice akan dihapus permanen dari server.\n\nTidak bisa dikembalikan. Lanjutkan?',
      danger: true, confirmText: 'Ya, Lanjutkan'
    });
    if (!ok1) return;
    const ok2 = await Modal.confirm({
      title: '🔴 Konfirmasi Akhir',
      message: 'YAKIN ingin menghapus SEMUA data invoice sekarang?',
      danger: true, confirmText: '🗑️ Hapus Sekarang'
    });
    if (!ok2) return;
    try {
      Notify.info('Menghapus data invoice...');
      await DB.clearTableData('invoices');
      Notify.success('Semua data invoice berhasil dihapus ✓');
      DB.logActivity({ type:'clear_invoices', detail:'Hapus semua data invoice' });
      renderData();
    } catch(e) { Notify.error('Gagal menghapus', e.message); }
  }

  /* ============ ACTIVITY LINE: IMPORT EXCEL ============ */
  function importActivityExcel() {
    if (!Auth.isSuperAdmin()) return;
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: '📋 Import Activity Line dari Excel',
      size: 'modal-md',
      body: `
        <div style="margin-bottom:var(--s4)">
          <p style="color:var(--text-2);font-size:13px;margin-bottom:var(--s3)">
            Upload file Excel (.xlsx/.xls) berisi sheet <strong>ACTIVITY LINE</strong>.<br>
            Pastikan <strong>Daftar Barang sudah diimport terlebih dahulu</strong>.
          </p>
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s3);font-size:12px;color:var(--text-3)">
            <strong>Mapping otomatis:</strong><br>
            STOCK OPNAME → Stok Awal (MASUK) · STOCK IN → Masuk<br>
            SHIFT 1/2/3 · EVENT · PENJUALAN → Keluar<br>
            RUSAK / RETUR → Keluar (ditandai khusus di Laporan Bulanan)
          </div>
        </div>
        <button class="btn btn-primary w-full" onclick="SettingsModule._doImportActivityExcel('${mid}')">
          📂 Pilih File Excel Activity Line
        </button>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  async function _doImportActivityExcel(mid) {
    const inp = Object.assign(document.createElement('input'), { type:'file', accept:'.xlsx,.xls', style:'display:none' });
    document.body.appendChild(inp);
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(inp);
      if (!file) return;
      Modal.close(mid);

      if (!window.XLSX) {
        Notify.info('Memuat library Excel...');
        const loaded = await new Promise(res => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = () => res(true); s.onerror = () => res(false);
          document.head.appendChild(s);
        });
        if (!loaded || !window.XLSX) { Notify.error('Gagal memuat library Excel'); return; }
      }

      Notify.info('Membaca Activity Line...');
      let wb;
      try {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type:'array', cellDates:false });
      } catch(err) { Notify.error('File tidak bisa dibaca', err.message); return; }

      // Find Activity Line sheet
      const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('ACTIVITY LINE')) || wb.SheetNames[1];
      if (!sheetName) { Notify.error('Sheet "ACTIVITY LINE" tidak ditemukan'); return; }

      const ws  = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

      // Find header row (contains KODE AKTIFITAS)
      let hdrIdx = -1;
      for (let ri = 0; ri < Math.min(rows.length, 15); ri++) {
        if (rows[ri].some(c => String(c||'').toUpperCase().includes('KODE AKTIFITAS'))) {
          hdrIdx = ri; break;
        }
      }
      if (hdrIdx < 0) { Notify.error('Header "KODE AKTIFITAS" tidak ditemukan'); return; }

      // Build column map — flexible matching
      const hdr = rows[hdrIdx];
      const col = {};
      hdr.forEach((h, i) => {
        const k = String(h||'').toUpperCase().trim();
        if (k === 'TANGGAL') col.tgl = i;
        else if (k === 'NAMA PRODUK' || k === 'NAMA BARANG' || k === 'PRODUK') col.nama = i;
        else if (k === 'STOCK IN'  || k === 'STOK IN')  col.stockIn  = i;
        else if (k === 'STOCK OUT' || k === 'STOK OUT') col.stockOut = i;
        else if (k.includes('PENGAMBIL')) col.pengambil = i;
        else if (k.includes('PENANGGUNG') || k === 'PJ') col.pj = i;
        else if (k.includes('KODE') && (k.includes('AKTIFITAS') || k.includes('AKTIVITAS'))) col.kode = i;
        else if (k === 'CATATAN') col.catatan = i;
        else if (k.includes('HARGA') && k.includes('SYSTEM')) col.harga = i;      // prioritas: Harga System
        else if (k.includes('HARGA') && !col.harga) col.harga = i;               // fallback: Harga Manual
        else if (k === 'HPP') col.hpp = i;
      });

      // Fixed-column fallbacks (F=5 G=6 H=7 I=8 N=13 O=14 P=15 Q=16 R=17 T=19)
      // Dipakai jika dynamic detection gagal menemukan kolom tertentu
      if (col.tgl       === undefined) col.tgl       = 5;
      if (col.nama      === undefined) col.nama      = 6;
      if (col.stockIn   === undefined) col.stockIn   = 7;
      if (col.stockOut  === undefined) col.stockOut  = 8;
      if (col.pengambil === undefined) col.pengambil = 13;
      if (col.pj        === undefined) col.pj        = 14;
      if (col.kode      === undefined) col.kode      = 15;
      if (col.catatan   === undefined) col.catatan   = 16;
      if (col.hpp       === undefined) col.hpp       = 17;
      if (col.harga     === undefined) col.harga     = 19; // Harga System (col T)

      // Load all inventory items for name matching
      Notify.info('Memuat daftar produk...');
      let allItems;
      try { allItems = await DB.getInventoryItems(); } catch { allItems = []; }
      if (!allItems.length) {
        Notify.error('Tidak ada produk inventory. Import Daftar Barang terlebih dahulu.');
        return;
      }

      // Normalize helper
      const _norm = s => String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
      const nameMap = new Map(allItems.map(it => [_norm(it.nama), it]));

      // Excel date → YYYY-MM-DD
      const _excelDate = v => {
        const n = parseFloat(v);
        if (!n || n < 1) return new Date().toISOString().slice(0,10);
        return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().slice(0,10);
      };

      const KELUAR_CODES = new Set(['SHIFT 1','SHIFT 2','SHIFT 3','SHIFT3','EVENT','PENJUALAN','TAKJIL','PENJUALAN TAKJIL']);
      const RETUR_CODES  = new Set(['RUSAK','RETUR','RETUR RUSAK','BARANG RUSAK','RUSAK RETUR']);

      const activities = [];
      const skipped    = new Set();

      for (let ri = hdrIdx + 1; ri < rows.length; ri++) {
        const row = rows[ri];
        if (row.every(c => c === '' || c === null || c === undefined)) continue;

        const kodeRaw = String(row[col.kode]||'').trim();
        if (!kodeRaw || kodeRaw.toUpperCase() === 'KODE AKTIFITAS' || kodeRaw === '#REF!') continue;
        const kode = kodeRaw.toUpperCase();

        const namaRaw = String(row[col.nama]||'').trim();
        if (!namaRaw) continue;

        const item = nameMap.get(_norm(namaRaw));
        if (!item) { skipped.add(namaRaw); continue; }

        const tgl      = _excelDate(row[col.tgl]);
        const stockIn  = parseFloat(row[col.stockIn])  || 0;
        const stockOut = parseFloat(row[col.stockOut]) || 0;
        const harga    = parseFloat(row[col.harga])    || item.hargaSatuan || 0;
        const hpp      = parseFloat(row[col.hpp])      || 0;
        const pengambil = String(row[col.pengambil]||'').trim();
        const pj        = String(row[col.pj]||'').trim();
        const catatan   = String(row[col.catatan]||'').trim();

        let jenis, jumlah, isRetur = false;

        if (kode === 'STOCK OPNAME') {
          if (stockIn <= 0) continue;
          jenis = 'MASUK'; jumlah = stockIn;
        } else if (kode === 'STOCK IN') {
          if (stockIn <= 0) continue;
          jenis = 'MASUK'; jumlah = stockIn;
        } else if (KELUAR_CODES.has(kode) || kode.startsWith('SHIFT')) {
          if (stockOut <= 0) continue;
          jenis = 'KELUAR'; jumlah = stockOut;
        } else if (RETUR_CODES.has(kode) || Array.from(RETUR_CODES).some(r => kode.includes(r))) {
          jumlah = stockOut > 0 ? stockOut : stockIn;
          if (jumlah <= 0) continue;
          jenis = 'KELUAR'; isRetur = true;
        } else {
          // Unknown code — use whichever field has data
          if (stockOut > 0)      { jenis = 'KELUAR'; jumlah = stockOut; }
          else if (stockIn > 0)  { jenis = 'MASUK';  jumlah = stockIn; }
          else continue;
        }

        activities.push({
          id: Utils.uid(),
          tgl,
          itemId: item.id,
          itemNama: item.nama,
          jenis,
          jumlah,
          stokAkhir: 0,
          harga,
          hpp,
          kodeAktivitas: kodeRaw,
          pengambil,
          penanggungJawab: pj,
          catatan,
          isRetur,
          createdBy: Auth.currentUser()?.username || 'import',
        });
      }

      if (!activities.length) {
        let msg = 'Tidak ada aktivitas yang berhasil dipetakan.';
        if (skipped.size) msg += ' Produk tidak cocok: ' + [...skipped].slice(0,5).join(', ');
        Notify.error(msg);
        return;
      }

      const total = activities.length;
      Notify.info(`Menyimpan ${total} aktivitas...`);
      let saved = 0, failed = 0;
      const BATCH = 30;
      for (let b = 0; b < activities.length; b += BATCH) {
        const batch = activities.slice(b, b + BATCH);
        await Promise.all(batch.map(a =>
          DB.saveInventoryLog(a).then(() => saved++).catch(() => failed++)
        ));
        if (b % 300 === 0 && b > 0) Notify.info(`Menyimpan... ${saved}/${total}`);
      }

      let doneMsg = `Import Activity Line selesai: ${saved} aktivitas disimpan`;
      if (skipped.size) doneMsg += ` · ${skipped.size} produk tidak cocok`;
      if (failed) doneMsg += ` · ${failed} gagal`;
      Notify.success(doneMsg);
      if (skipped.size) console.warn('[Import Activity] Produk tidak cocok:', [...skipped]);
      DB.logActivity({ type:'import_activity', detail:`Import Activity Line: ${saved} dari ${file.name}` });
    };
    inp.click();
  }

  /* ============ OPNAME: HAPUS DATA ============ */
  async function clearOpnameData() {
    if (!Auth.isSuperAdmin()) return;

    const ok1 = await Modal.confirm({
      title: '⚠️ Hapus Data Stock Opname',
      message: 'Semua catatan stock opname akan dihapus permanen dari Supabase.\n\nData tidak bisa dikembalikan. Lanjutkan?',
      danger: true,
      confirmText: 'Ya, Lanjutkan'
    });
    if (!ok1) return;

    const ok2 = await Modal.confirm({
      title: '🔴 Konfirmasi Akhir',
      message: 'YAKIN? Semua data stock opname akan dihapus dari server sekarang.',
      danger: true,
      confirmText: '🗑️ Hapus Sekarang'
    });
    if (!ok2) return;

    try {
      Notify.info('Menghapus data stock opname...');
      await DB.clearTableData('opname_logs');
      Notify.success('Data stock opname berhasil dihapus ✓');
      DB.logActivity({ type: 'clear_opname', detail: 'Hapus semua data stock opname' });
      renderData();
    } catch(e) {
      Notify.error('Gagal menghapus', e.message);
    }
  }

  /* ============ INVENTORY: IMPORT EXCEL ============ */
  function importInventoryExcel() {
    if (!Auth.isSuperAdmin()) return;

    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: '📤 Import Inventory dari Excel',
      size: 'modal-md',
      body: `
        <div style="margin-bottom:var(--s4)">
          <p style="color:var(--text-2);font-size:13px;margin-bottom:var(--s3)">
            Upload file Excel (.xlsx/.xls) berisi daftar produk inventory.<br>
            Data lama tidak dihapus — baris baru ditambahkan.
          </p>
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s3);font-size:12px;color:var(--text-3)">
            <strong>Kolom yang dikenali:</strong><br>
            Nama / Nama Barang &nbsp;|&nbsp; Satuan / Unit &nbsp;|&nbsp; Harga / Harga Satuan<br>
            Stok Min / Min Stock &nbsp;|&nbsp; Status &nbsp;|&nbsp; Kategori / Jenis
          </div>
        </div>
        <button class="btn btn-primary w-full" onclick="SettingsModule._doImportInventoryExcel('${mid}')">
          📂 Pilih File Excel
        </button>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  // Rule-based AI kategori suggester for items with empty kategori
  function _suggestKategori(nama) {
    const n = nama.toLowerCase();
    if (/ayam|daging|ikan|telur|sapi|babi|kambing|seafood|udang|cumi|kepiting|lobster|kerang|tongkol|salmon|lele|gurame|nila|sawi|kangkung|bayam|tomat|wortel|kentang|buncis|kacang panjang|buah|pisang|apel|jeruk|mangga|pepaya|sayur/.test(n)) return 'Fresh';
    if (/beras|tepung|terigu|gula|minyak|garam|kedelai|jagung|susu bubuk|santan|sagu|maizena|tapioka|kecap manis|cuka/.test(n)) return 'Sembako';
    if (/kecap|saus|saos|sambal|saus tiram|terasi|petis|tauco|royco|masako|penyedap|kaldu|lada|merica|kunyit|jahe|lengkuas|serai|kemiri|jintan|ketumbar|bumbu|rempah|msg|vetsin/.test(n)) return 'Bumbu';
    if (/air mineral|air galon|jus|sirup|soda|minuman|teh|kopi|susu cair|yakult|pocari|isotonic|drink|sprite|fanta|cola/.test(n)) return 'Minuman';
    if (/plastik|kantong|kresek|styrofoam|box karton|dus|wadah|gelas plastik|cup|sedotan|sendok plastik|garpu plastik|tissue|serbet|aluminium foil|wrap|bungkus|kemasan|toples|botol|label|stiker/.test(n)) return 'Kemasan';
    if (/pisau|wajan|teflon|panci|spatula|sutil|talenan|kompor|blender|mixer|parutan|saringan|baskom|ember|gayung|lap|serbet kain|timbangan|dispenser|rice cooker|alat|peralatan|mesin/.test(n)) return 'Peralatan';
    if (/bahan baku/.test(n)) return 'Bahan Baku';
    return 'Lain-lain';
  }

  // Kategori options list (mirrors InventoryModule KATEGORIS)
  const _IMPORT_KATEGORIS = ['Bahan Baku','Bumbu','Minuman','Kemasan','Peralatan','Sembako','Fresh','Lain-lain'];

  async function _doImportInventoryExcel(mid) {
    const inp = Object.assign(document.createElement('input'), { type:'file', accept:'.xlsx,.xls', style:'display:none' });
    document.body.appendChild(inp);
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(inp);
      if (!file) return;
      Modal.close(mid);

      // Load SheetJS
      if (!window.XLSX) {
        Notify.info('Memuat library Excel...');
        const loaded = await new Promise(res => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = () => res(true); s.onerror = () => res(false);
          document.head.appendChild(s);
        });
        if (!loaded || !window.XLSX) { Notify.error('Gagal memuat library Excel'); return; }
      }

      Notify.info('Membaca file Excel...');
      let wb;
      try {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type:'array', cellDates:false });
      } catch(err) { Notify.error('File tidak bisa dibaca', err.message); return; }

      const _normName = s => String(s).toLowerCase().replace(/\s+/g,' ').trim();

      // Kolom tetap untuk sheet DAFTAR BARANG:
      //   K (index 10) = Nama Produk
      //   L (index 11) = Kategori
      //   T (index 19) = Harga
      // Data mulai baris 11 (index 10)
      const COL_NAMA     = 10;
      const COL_KATEGORI = 11;
      const COL_HARGA    = 19;
      const DATA_START   = 10; // baris 11, 0-indexed

      const items = [];
      for (const sheetName of wb.SheetNames) {
        // Hanya proses sheet "DAFTAR BARANG"
        if (!/daftar.?barang/i.test(sheetName)) continue;

        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (rows.length <= DATA_START) continue;

        for (let ri = DATA_START; ri < rows.length; ri++) {
          const row  = rows[ri];
          const nama = String(row[COL_NAMA] ?? '').trim();
          if (!nama) continue; // kolom K kosong → skip

          const kategori = String(row[COL_KATEGORI] ?? '').trim();
          const harga    = parseFloat(String(row[COL_HARGA]  ?? '0').replace(/[^\d.]/g,'')) || 0;

          items.push({ id:Utils.uid(), nama, satuan:'Pcs', hargaSatuan:harga, stokMin:0, status:'AKTIF', kategori, keterangan:'', _stok:0, balance:0 });
        }
      }

      if (!items.length) {
        Notify.error('Tidak ada data yang dibaca', 'Pastikan kolom "Nama" atau "Nama Barang" ada di file Excel');
        return;
      }

      // Apply AI kategori suggestions for items with empty kategori
      let aiCount = 0;
      for (const it of items) {
        if (!it.kategori) {
          it.kategori    = _suggestKategori(it.nama);
          it._aiSuggested = true;
          aiCount++;
        }
      }

      if (aiCount > 0) {
        // Show review modal for AI-suggested items
        _pendingImportItems = items;
        _pendingImportFile  = file.name;
        const revId = Utils.uid();
        const aiItems = items.filter(it => it._aiSuggested);
        Modal.open({
          id: revId,
          title: `✨ Review Kategori AI`,
          body: `
            <div style="margin-bottom:var(--s3);font-size:13px;color:var(--text-muted);line-height:1.5">
              <strong>${items.length} produk</strong> siap diimpor dari <em>${file.name}</em>.<br>
              <strong style="color:var(--warning-color)">${aiCount} item</strong> tidak memiliki kategori di Excel — AI telah menyarankan kategori berdasarkan nama produk.<br>
              Periksa dan sesuaikan jika diperlukan, lalu klik <strong>Simpan Semua</strong>.
            </div>
            <div style="max-height:380px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius)">
              <table class="table" style="margin:0">
                <thead>
                  <tr>
                    <th style="width:50%">Nama Produk</th>
                    <th style="width:20%">Harga</th>
                    <th>Kategori <span style="color:var(--warning-color);font-size:11px">✦ = saran AI</span></th>
                  </tr>
                </thead>
                <tbody>
                  ${aiItems.map((it, idx) => {
                    const gIdx = items.indexOf(it);
                    return `<tr>
                      <td style="font-size:13px">
                        <span style="color:var(--warning-color);margin-right:4px">✦</span>${it.nama}
                      </td>
                      <td style="font-size:13px">${it.hargaSatuan ? 'Rp ' + Number(it.hargaSatuan).toLocaleString('id-ID') : '-'}</td>
                      <td>
                        <select data-gidx="${gIdx}" class="form-control" style="font-size:12px;padding:4px 6px;height:auto">
                          ${_IMPORT_KATEGORIS.map(k => `<option value="${k}" ${it.kategori===k?'selected':''}>${k}</option>`).join('')}
                        </select>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `,
          footer: `
            <button class="btn btn-secondary" onclick="Modal.close('${revId}')">Batal</button>
            <button class="btn btn-primary" onclick="SettingsModule._confirmKategoriReview('${revId}')">
              Simpan Semua (${items.length})
            </button>
          `
        });
      } else {
        // No AI suggestions — save directly
        await _saveImportedItems(items, file.name);
      }
    };
    inp.click();
  }

  async function _saveImportedItems(items, fileName) {
    Notify.info(`Menyimpan ${items.length} produk...`);
    // Load existing to avoid duplicate-nama 409 (inv_products_nama_key unique constraint)
    const _normN = s => String(s).toLowerCase().replace(/\s+/g,' ').trim();
    let existingMap = new Map();
    try {
      const existing = await DB.getInventoryItems();
      existing.forEach(e => existingMap.set(_normN(e.nama), e));
    } catch {}
    let saved = 0;
    for (const item of items) {
      const { _aiSuggested, ...clean } = item;
      // If a product with the same name already exists, reuse its ID → upsert updates instead of insert
      const match = existingMap.get(_normN(clean.nama));
      if (match) clean.id = match.id;
      try { await DB.saveInventoryItem(clean); saved++; } catch {}
    }
    Notify.success(`Import selesai: ${saved} produk berhasil disimpan`);
    DB.logActivity({ type:'import_inventory', detail:`Import Excel inventory: ${saved} produk dari ${fileName}` });
    renderData();
  }

  async function _confirmKategoriReview(revId) {
    if (!_pendingImportItems) { Modal.close(revId); return; }
    // Read user-edited kategori from selects
    const selects = document.querySelectorAll(`#modal-${revId} select[data-gidx]`);
    selects.forEach(sel => {
      const idx = parseInt(sel.dataset.gidx, 10);
      if (!isNaN(idx) && _pendingImportItems[idx]) {
        _pendingImportItems[idx].kategori = sel.value;
      }
    });
    const items    = _pendingImportItems;
    const fileName = _pendingImportFile || 'Excel';
    _pendingImportItems = null;
    _pendingImportFile  = null;
    Modal.close(revId);
    await _saveImportedItems(items, fileName);
  }

  async function clearData() {
    const ok=await Modal.confirm({title:'⚠️ Reset Semua Data',message:'SEMUA data dihapus permanen. Tidak bisa dikembalikan!',danger:true,confirmText:'Ya, Hapus Semua'});
    if(!ok) return;
    ['orders','invoices','customers','kas','kas_masuk','inventory','inv_products','employees','emp_logs','ap','suppliers','tasks','settings','users','activity_log']
      .forEach(k=>localStorage.removeItem('becca_'+k));
    Notify.success('Semua data direset');
    setTimeout(()=>location.reload(),1500);
  }


  // Render cuplikan visual aktivitas
  function _renderActivitySnapshot(log) {
    const type   = log.type   || '';
    const detail = log.detail || '';
    const snap   = log.snapshot || {};

    function cellStyle(color) {
      return 'padding:5px 10px;color:' + color + ';border-bottom:1px solid var(--border)';
    }

    function fmtVal(val, key) {
      if (val === null || val === undefined) return '-';
      if (val === false) return 'Tidak';
      if (val === true)  return 'Ya';
      // harga/gaji = Rupiah, jumlah/qty = angka biasa
      if (typeof val === 'number') {
        if (key.includes('harga') || key.includes('Harga') || key.includes('gaji') || key.includes('Gaji'))
          return Utils.formatRupiah(val);
        // jumlah/qty = plain number with unit if possible
        return val.toLocaleString('id-ID');
      }
      return String(val).substring(0, 80);
    }

    const FIELD_NAMES = {
      tgl:'Tanggal', nama:'Nama', type:'Type',
      jumlah:'Jumlah (Qty)', jumlahSatuan:'Satuan',
      harga:'Harga (Rp)', hargaSatuan:'Harga/Sat (Rp)', jenis:'Jenis',
      itemNama:'Barang', itemId:null,  // hide itemId
      kodeAktivitas:'Kode Aktivitas', vendor:'Vendor',
      qty:'Qty', satuan:'Satuan', status:'Status', bulan:'Bulan',
      user:'User', role:'Role', jabatan:'Jabatan', departemen:'Dept',
      gajiPokok:'Gaji Pokok (Rp)', noHp:'No. HP', catatan:'Catatan',
      pengambil:'Pengambil', penanggungJawab:'Penanggung Jawab',
      stokAkhir:null, hpp:null, _weightedAvgPrice:null,  // hide internal fields
    };

    let html = '<div style="display:flex;flex-direction:column;gap:8px">';

    // === BEFORE/AFTER DIFF (from snapshot) ===
    if (snap.before || snap.after) {
      if (snap.before && snap.after) {
        const changed = Object.entries(snap.after).filter(([k,v]) =>
          !k.startsWith('_') && k !== 'id' && k !== 'createdAt' &&
          String(snap.before[k]) !== String(v)
        ).slice(0, 10);

        if (changed.length) {
          html += '<div style="border:1px solid rgba(234,179,8,.3);border-radius:var(--r-md);overflow:hidden">';
          html += '<div style="background:rgba(234,179,8,.1);padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--warning)">⚡ Perubahan</div>';
          html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
          html += '<thead><tr>';
          html += '<td style="' + cellStyle('var(--text-3)') + ';font-size:10px;width:28%">Field</td>';
          html += '<td style="' + cellStyle('var(--danger)') + ';font-size:10px">Sebelum</td>';
          html += '<td style="' + cellStyle('var(--success)') + ';font-size:10px">Sesudah</td>';
          html += '</tr></thead><tbody>';
          changed.forEach(function(entry) {
            var k = entry[0]; var v = entry[1];
            html += '<tr>';
            html += '<td style="' + cellStyle('var(--text-3)') + '">' + (FIELD_NAMES[k]||k) + '</td>';
            html += '<td style="' + cellStyle('var(--text-2)') + ';text-decoration:line-through">' + fmtVal(snap.before[k], k) + '</td>';
            html += '<td style="' + cellStyle('var(--success)') + ';font-weight:600">' + fmtVal(v, k) + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table></div>';
        }
      }

      if (snap.after && !snap.before) {
        var dataAfter = Object.entries(snap.after)
          .filter(function(e) { 
          if (e[0].startsWith('_')) return false;
          if (['id','createdAt','itemId','stokAkhir','hpp'].includes(e[0])) return false;
          if (FIELD_NAMES[e[0]] === null) return false; // explicitly hidden
          return e[1] !== '' && e[1] !== null && e[1] !== undefined;
        })
          .slice(0, 12);
        if (dataAfter.length) {
          html += '<div style="border:1px solid rgba(34,197,94,.3);border-radius:var(--r-md);overflow:hidden">';
          html += '<div style="background:rgba(34,197,94,.1);padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--success)">✅ Data Ditambahkan</div>';
          html += '<table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>';
          dataAfter.forEach(function(e) {
            html += '<tr><td style="' + cellStyle('var(--text-3)') + ';width:35%">' + (FIELD_NAMES[e[0]]||e[0]) + '</td>';
            html += '<td style="' + cellStyle('var(--text)') + ';font-weight:500">' + fmtVal(e[1], e[0]) + '</td></tr>';
          });
          html += '</tbody></table></div>';
        }
      }

      if (snap.before && !snap.after) {
        var dataBefore = Object.entries(snap.before)
          .filter(function(e) { 
          if (e[0].startsWith('_')) return false;
          if (['id','createdAt','itemId','stokAkhir','hpp'].includes(e[0])) return false;
          if (FIELD_NAMES[e[0]] === null) return false; // explicitly hidden
          return e[1] !== '' && e[1] !== null && e[1] !== undefined;
        })
          .slice(0, 12);
        if (dataBefore.length) {
          html += '<div style="border:1px solid rgba(239,68,68,.3);border-radius:var(--r-md);overflow:hidden">';
          html += '<div style="background:rgba(239,68,68,.1);padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--danger)">🗑️ Data Dihapus</div>';
          html += '<table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>';
          dataBefore.forEach(function(e) {
            html += '<tr><td style="' + cellStyle('var(--text-3)') + ';width:35%">' + (FIELD_NAMES[e[0]]||e[0]) + '</td>';
            html += '<td style="' + cellStyle('var(--text-2)') + ';text-decoration:line-through">' + fmtVal(e[1], e[0]) + '</td></tr>';
          });
          html += '</tbody></table></div>';
        }
      }
    } else {
      // No snapshot - fallback to parsed detail
      var rows = _parseActivityObject(log);
      if (rows.length) {
        html += '<div style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden">';
        html += '<div style="background:var(--surface2);padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">📋 Ringkasan</div>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>';
        rows.forEach(function(r) {
          html += '<tr><td style="' + cellStyle('var(--text-3)') + ';width:35%">' + r.k + '</td>';
          html += '<td style="' + cellStyle('var(--text)') + ';font-weight:500">' + r.v + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
    }

    // Raw detail
    if (detail && detail.length > 3 && !detail.match(/^[a-z0-9]{10,}$/i)) {
      html += '<div style="padding:8px 10px;background:var(--surface2);border-radius:var(--r-md);font-size:11px;color:var(--text-3)">';
      html += '<span style="font-weight:600">Catatan:</span> ' + detail;
      html += '</div>';
    }

    // Metadata
    html += '<div style="display:flex;gap:16px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--text-3)">';
    html += '<span>Tipe: <strong style="color:var(--text-2)">' + type + '</strong></span>';
    html += '<span>Tgl: <strong style="color:var(--text-2)">' + (log.tgl||'-') + '</strong></span>';
    html += '<span style="font-family:var(--font-mono);font-size:10px">ID: ' + (log.id||'-').substring(0,10) + '</span>';
    html += '</div>';

    html += '</div>';
    return html;
  }





  /* ── Download auth.js dengan _defaultUsers terkini ── */
  async function _downloadAuthJs() {
    try {
      const users   = await DB.getUsers().catch(() => []);
      const authSrc = await fetch('/js/auth.js?_t=' + Date.now()).then(r => r.text());

      const entries = users.map(u => {
        const pw = u.password || u._pw || '888888';
        return '    { id: ' + JSON.stringify(u.id||'u_'+u.username) +
          ', username: ' + JSON.stringify(u.username) +
          ', password: ' + JSON.stringify(pw) +
          ', nama: '     + JSON.stringify(u.nama||u.username) +
          ', role: '     + JSON.stringify(u.role||'operator') +
          ', email: '    + JSON.stringify(u.email||'') +
          ', aktif: '    + (u.aktif!==false) + ' }';
      }).join(',\n');

      const start   = authSrc.indexOf('_defaultUsers: [');
      const end     = authSrc.indexOf('],', start) + 2;
      const newSrc  = authSrc.slice(0, start) +
        '_defaultUsers: [\n' + entries + '\n  ],' +
        authSrc.slice(end);

      const blob = new Blob([newSrc], {type:'text/javascript'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'auth.js';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);

      Notify.success('auth.js berhasil didownload — upload ke GitHub: js/auth.js');
    } catch(e) {
      Notify.error('Gagal generate auth.js: ' + e.message);
    }
  }


  /* ── Simpan GitHub Token ke becca_settings ── */
  function _saveGithubToken() {
    const token = document.getElementById('gh-token-input')?.value?.trim();
    const repo  = document.getElementById('gh-repo-input')?.value?.trim() || 'segaDG/Becca-V2.0';
    if (!token) { Notify.warning('Token tidak boleh kosong'); return; }

    const s = JSON.parse(localStorage.getItem('becca_settings') || '{}');
    s.githubToken = token;
    s.githubRepo  = repo;
    localStorage.setItem('becca_settings', JSON.stringify(s));

    Notify.success('GitHub Token tersimpan — sinkronisasi otomatis aktif!');

    // Test koneksi
    const statusEl = document.getElementById('gh-sync-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color   = 'var(--text-3)';
      statusEl.textContent   = '⏳ Mengecek koneksi ke GitHub...';
    }
    fetch('https://api.github.com/repos/' + repo + '/contents/js/auth.js', {
      headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }
    })
    .then(r => r.json())
    .then(data => {
      if (data.sha) {
        if (statusEl) { statusEl.style.color='var(--success)'; statusEl.textContent='✓ Koneksi GitHub berhasil! Auto-sync aktif.'; }
        // Langsung sync sekarang
        _syncAuthJs();
      } else {
        if (statusEl) { statusEl.style.color='var(--danger)'; statusEl.textContent='✗ ' + (data.message||'Token tidak valid atau repo tidak ditemukan'); }
      }
    })
    .catch(e => {
      if (statusEl) { statusEl.style.color='var(--danger)'; statusEl.textContent='✗ Error: ' + e.message; }
    });
  }

  /* ── Auto-sync auth.js _defaultUsers setiap user saved ── */
  async function _syncAuthJs() {
    try {
      // Ambil semua users dari DB
      const users = await DB.getUsers().catch(() => []);
      if (!users.length) return;

      // Build _defaultUsers array
      const entries = users.map(u => {
        const pw = u.password || u._pw || '888888';
        const id = u.id || ('u_' + u.username);
        return '    { id: ' + JSON.stringify(id) +
          ', username: ' + JSON.stringify(u.username) +
          ', password: ' + JSON.stringify(pw) +
          ', nama: ' + JSON.stringify(u.nama || u.username) +
          ', role: ' + JSON.stringify(u.role || 'operator') +
          ', email: ' + JSON.stringify(u.email || '') +
          ', aktif: ' + (u.aktif !== false ? 'true' : 'false') + ' }';
      }).join(',\n');

      // Fetch auth.js terbaru dari server
      const authSrc = await fetch('/js/auth.js?_t=' + Date.now()).then(r => r.text());

      // Replace _defaultUsers block
      const start = authSrc.indexOf('_defaultUsers: [');
      const end   = authSrc.indexOf('],', start) + 2;
      if (start < 0 || end < 2) return;
      const newBlock   = '_defaultUsers: [\n' + entries + '\n  ],';
      const newAuthSrc = authSrc.slice(0, start) + newBlock + authSrc.slice(end);

      // Get GitHub token dari settings (jika ada) atau dari becca_settings
      const settings = JSON.parse(localStorage.getItem('becca_settings') || '{}');
      const token    = settings.githubToken || '';

      // Selalu sync users ke Supabase settings (berfungsi sebagai fallback cross-device)
      // Settings table pasti bekerja karena tidak ada masalah schema seperti users table
      const sanitizedUsers = users.map(u => ({
        id: u.id, username: u.username,
        password: u.password || u._pw || '',
        nama: u.nama, role: u.role,
        email: u.email || '', aktif: u.aktif !== false
      }));
      localStorage.setItem('becca_auth_users', JSON.stringify(sanitizedUsers));
      DB.saveSettings({ _users: sanitizedUsers }).catch(() => {});

      if (!token) return;

      // Push ke GitHub via API
      const repo    = settings.githubRepo || 'segaDG/Becca-V2.0';
      const apiUrl  = 'https://api.github.com/repos/' + repo + '/contents/js/auth.js';
      const fileMeta = await fetch(apiUrl, {
        headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' }
      }).then(r => r.json());

      if (!fileMeta.sha) return;

      await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: 'token ' + token,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Auto-sync: update _defaultUsers',
          content: btoa(unescape(encodeURIComponent(newAuthSrc))),
          sha: fileMeta.sha
        })
      });

      if(window.BECCA_DEBUG) console.log('[BECCA] auth.js synced to GitHub (' + users.length + ' users)');
    } catch(e) {
      console.warn('[BECCA] auth.js sync failed:', e.message);
    }
  }

  async function bulkCreateFromEmployees() {
    const employees = await DB.getEmployees().catch(()=>[]);
    const active = employees.filter(e => e.status !== 'nonaktif' && e.status !== 'resign' && e.nama);
    if (!active.length) { Notify.warning('Tidak ada karyawan aktif'); return; }

    const existingUsers = await DB.getUsers().catch(()=>[]);
    const existingNames = new Set(existingUsers.map(u => (u.username||'').toLowerCase()));
    // Also include default users
    Auth._defaultUsers.forEach(u => existingNames.add((u.username||'').toLowerCase()));

    // Filter out employees who already have an account
    const toCreate = active.filter(e => {
      const uname = (e.nama||'').toLowerCase().replace(/\s+/g,'');
      return !existingNames.has(uname);
    });

    if (!toCreate.length) { Notify.info('Semua karyawan sudah memiliki akun'); return; }

    const mid = Utils.uid();
    Modal.open({ id: mid, title: 'Buat Akun dari Data Karyawan', size: 'modal-lg',
      body: `
        <div style="margin-bottom:var(--s4)">
          <div style="font-size:13px;color:var(--text-2);margin-bottom:var(--s2)">${toCreate.length} karyawan belum punya akun (dari ${active.length} karyawan aktif)</div>
          <div style="font-size:12px;color:var(--text-3)">Password default: <strong style="font-family:var(--font-mono);color:var(--heading)">888888</strong> · Role default: <strong style="color:var(--heading)">operator</strong></div>
        </div>
        <div class="table-scroll" style="max-height:400px;overflow-y:auto"><table class="table">
          <thead><tr><th><input type="checkbox" id="bulk-chk-all" checked onchange="document.querySelectorAll('.bulk-emp-chk').forEach(c=>c.checked=this.checked)"></th><th>Nama</th><th>Username</th><th>Jabatan</th><th>Role</th></tr></thead>
          <tbody>
            ${toCreate.map((e,i) => {
              const uname = (e.nama||'').toLowerCase().replace(/\s+/g,'');
              return `<tr>
                <td><input type="checkbox" class="bulk-emp-chk" data-idx="${i}" checked></td>
                <td style="font-weight:600">${e.nama}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${uname}</td>
                <td style="font-size:12px;color:var(--text-2)">${e.jabatan||'-'}</td>
                <td><select class="form-control bulk-role" data-idx="${i}" style="font-size:11px;padding:3px 6px;min-height:28px">
                  ${_getRoles().map(r=>`<option value="${r}" ${r==='operator'?'selected':''}>${r}</option>`).join('')}
                </select></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="SettingsModule._doBulkCreate('${mid}')">Buat ${toCreate.length} Akun</button>`,
    });
    // Store toCreate for _doBulkCreate
    window._bulkEmpList = toCreate;
  }

  async function _doBulkCreate(modalId) {
    const list = window._bulkEmpList || [];
    if (!list.length) return;
    let created = 0;
    for (let i = 0; i < list.length; i++) {
      const chk = document.querySelector(`.bulk-emp-chk[data-idx="${i}"]`);
      if (!chk?.checked) continue;
      const roleSel = document.querySelector(`.bulk-role[data-idx="${i}"]`);
      const e = list[i];
      const uname = (e.nama||'').toLowerCase().replace(/\s+/g,'');
      const data = {
        id: Utils.uid(),
        nama: e.nama,
        username: uname,
        password: '888888',
        role: roleSel?.value || 'operator',
        aktif: true,
        mustChangePassword: true,
        email: '',
      };
      try { await DB.saveUser(data); created++; } catch {}
    }
    delete window._bulkEmpList;
    _syncAuthJs();
    Modal.close(modalId);
    Notify.success(created + ' akun berhasil dibuat');
    DB.logActivity({ type: 'bulk_create_users', detail: created + ' akun dari karyawan' });
    renderUsers();
  }

  return {
    init, switchTab,
    saveGeneralSettings, _handleLogoUpload, _removeLogo, openChangePasswordModal, _changePassword,
    renderKeamanan, enable2FA, disable2FA, regenerateBackupCodes, revokeTrusted, saveOTPProviderConfig,
    renderUsers, openUserModal, _submitUser, toggleUser, deleteUser, bulkCreateFromEmployees, _doBulkCreate,
    renderPrivilege, savePrivileges, resetPrivileges, _onPrivChange, addCustomRole, _saveNewRole, deleteCustomRole,
    renderActivity, _renderActivityRows, _filterActivityLog, _setActType, _setActCat, _setActPage, _setActPerPage, _resetActFilters, _loadMoreActivity, showActivityDetail, _goToRow, _parseActivityObject, _renderActivitySnapshot, clearActivityLog,
    renderData, exportData, _doImport, clearData, recoverData, runTests,
    clearInventoryData, clearOpnameData, clearOrdersData, clearInvoicesData,
    importOrdersExcel, _doImportOrdersExcel, importInvoicesExcel, _doImportInvoicesExcel,
    importInventoryExcel, _doImportInventoryExcel,
    _saveImportedItems, _confirmKategoriReview,
    importActivityExcel, _doImportActivityExcel,
    _syncAuthJs, _downloadAuthJs, _saveGithubToken
  };
})(); }
