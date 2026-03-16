   BECCA V2.0 — Settings Module
============================================ */
const SettingsModule = (() => {
  async function init() {
    const page = document.getElementById('page-settings');
    const user = Auth.currentUser();
    const settings = await DB.getSettings().catch(() => ({}));

    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Pengaturan</h2>
          <p>Konfigurasi sistem BECCA</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s5)">

        <!-- Profil -->
        <div class="card">
          <div class="card-header"><div class="card-title">👤 Profil Akun</div></div>
          <div style="padding:var(--s5)">
            <div style="display:flex;align-items:center;gap:var(--s4);margin-bottom:var(--s5)">
              <div style="width:56px;height:56px;border-radius:50%;background:var(--primary);
                          display:flex;align-items:center;justify-content:center;
                          font-size:20px;font-weight:800;color:white">
                ${Utils.initials ? Utils.initials(user?.nama||'?') : (user?.nama||'?').substring(0,2).toUpperCase()}
              </div>
              <div>
                <div style="font-weight:700;font-size:16px">${user?.nama||'-'}</div>
                <div style="color:var(--text-3);font-size:13px">${user?.role||'-'} · ${user?.username||'-'}</div>
              </div>
            </div>
            <div style="font-size:13px;color:var(--text-3)">
              Untuk mengubah password, hubungi Super Admin.
            </div>
          </div>
        </div>

        <!-- Info Aplikasi -->
        <div class="card">
          <div class="card-header"><div class="card-title">ℹ️ Info Aplikasi</div></div>
          <div style="padding:var(--s5)">
            ${[
              ['Nama Aplikasi', 'BECCA v2.0'],
              ['Deskripsi', 'Catering Order & Management System'],
              ['Database', 'localStorage (offline)'],
              ['Versi', '2.0.0'],
            ].map(([k,v]) => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
                <span style="color:var(--text-3)">${k}</span>
                <span style="font-weight:500">${v}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Pengaturan Umum -->
        <div class="card">
          <div class="card-header"><div class="card-title">⚙️ Pengaturan Umum</div></div>
          <div style="padding:var(--s5)">
            <form id="settings-form">
              <div class="form-group">
                <label class="form-label">Nama Perusahaan / Catering</label>
                <input name="namaPerusahaan" class="form-control" value="${settings.namaPerusahaan||'BECCA Catering'}" placeholder="Nama catering">
              </div>
              <div class="form-group">
                <label class="form-label">Alamat</label>
                <input name="alamat" class="form-control" value="${settings.alamat||''}" placeholder="Alamat usaha">
              </div>
              <div class="form-group">
                <label class="form-label">No. Telepon</label>
                <input name="telp" class="form-control" value="${settings.telp||''}" placeholder="08xx...">
              </div>
              <button type="button" class="btn btn-primary" onclick="SettingsModule.saveSettings()">
                💾 Simpan Pengaturan
              </button>
            </form>
          </div>
        </div>

        <!-- Data Management -->
        <div class="card">
          <div class="card-header"><div class="card-title">🗄️ Manajemen Data</div></div>
          <div style="padding:var(--s5);display:flex;flex-direction:column;gap:var(--s3)">
            <button class="btn btn-ghost" onclick="SettingsModule.exportData()">
              📥 Export Semua Data (JSON)
            </button>
            <div style="font-size:12px;color:var(--text-3)">
              Export data ke file JSON untuk backup. Data tersimpan di localStorage browser ini.
            </div>
            <div style="border-top:1px solid var(--border);margin:var(--s2) 0"></div>
            ${Auth.isSuperAdmin() ? `
              <button class="btn btn-ghost" style="color:var(--danger);border-color:var(--danger-bg)"
                      onclick="SettingsModule.clearData()">
                🗑️ Reset Semua Data (Berbahaya!)
              </button>
            ` : '<div style="font-size:12px;color:var(--text-3)">Reset data hanya bisa dilakukan Super Admin.</div>'}
          </div>
        </div>

      </div>
    `;
  }

  async function saveSettings() {
    const fd   = new FormData(document.getElementById('settings-form'));
    const data = Object.fromEntries(fd.entries());
    await DB.saveSettings(data);
    Notify.success('Pengaturan disimpan');
  }

  function exportData() {
    const keys = ['orders','invoices','customers','kas','kas_masuk','inventory','inv_products',
                  'employees','emp_logs','ap','suppliers','tasks','settings'];
    const exported = {};
    keys.forEach(k => {
      try { exported[k] = JSON.parse(localStorage.getItem('becca_'+k)||'[]'); } catch {}
    });
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `becca-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Notify.success('Data berhasil di-export!');
  }

  async function clearData() {
    const ok = await Modal.confirm({
      title: '⚠️ Reset Semua Data',
      message: 'SEMUA data akan dihapus permanen dan tidak bisa dikembalikan. Yakin?',
      danger: true,
      confirmText: 'Ya, Hapus Semua'
    });
    if (!ok) return;
    const keys = ['orders','invoices','customers','kas','kas_masuk','inventory','inv_products',
                  'employees','emp_logs','ap','suppliers','tasks','settings'];
    keys.forEach(k => localStorage.removeItem('becca_'+k));
    Notify.success('Semua data direset');
    setTimeout(() => location.reload(), 1500);
  }

  return { init, saveSettings, exportData, clearData };
})();
window.SettingsModule = SettingsModule;
