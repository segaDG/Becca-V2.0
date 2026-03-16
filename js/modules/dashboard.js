/* ============================================
   BECCA V2.0 — Dashboard Module
   ============================================ */

const DashboardModule = (() => {

  async function init() {
    const page = document.getElementById('page-dashboard');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Dashboard</h2>
          <p>Ringkasan data BECCA</p>
        </div>
      </div>
      <div id="dashboard-content">
        <div style="display:flex;align-items:center;justify-content:center;height:300px;color:var(--text-3)">
          <div style="text-align:center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:16px;opacity:.4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <div>Memuat data...</div>
          </div>
        </div>
      </div>
    `;

    try {
      await _renderDashboard();
    } catch(err) {
      console.error('Dashboard error:', err);
    }
  }

  async function _renderDashboard() {
    const [kas, kasMasuk, employees, inventory, invProducts] = await Promise.all([
      DB.getKas().catch(() => []),
      DB.getKasMasuk().catch(() => []),
      DB.getEmployees().catch(() => []),
      DB.getInventory().catch(() => []),
      DB.getInventoryItems().catch(() => []),
    ]);

    const totalKeluar   = kas.reduce((s, r) => s + (r.jumlah || 0), 0);
    const totalMasuk    = kasMasuk.reduce((s, r) => s + (r.kredit || 0), 0);
    const saldo         = totalMasuk - totalKeluar;
    const activeEmp     = employees.filter(e => e.status === 'ACTIVE').length;
    const totalHutang   = employees.reduce((s, e) => s + (e.sisaHutang || 0), 0);
    const activeItems   = invProducts.filter(p => p.status === 'Activated').length;
    const totalInvValue = invProducts.reduce((s, p) => s + ((p.balance || 0) * (p.harga || 0)), 0);

    // Recent kas (last 10)
    const recentKas = [...kas].sort((a, b) => b.tgl.localeCompare(a.tgl)).slice(0, 10);

    document.getElementById('dashboard-content').innerHTML = `
      <!-- STAT CARDS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--s4);margin-bottom:var(--s6)">
        ${_statCard('💰', 'Saldo Kas', Utils.formatRupiah(saldo, true), saldo >= 0 ? 'var(--success)' : 'var(--danger)')}
        ${_statCard('📤', 'Total Keluar', Utils.formatRupiah(totalKeluar, true), 'var(--danger)')}
        ${_statCard('📥', 'Total Masuk', Utils.formatRupiah(totalMasuk, true), 'var(--success)')}
        ${_statCard('👷', 'Karyawan Aktif', activeEmp + ' orang', 'var(--primary-h)')}
        ${_statCard('⚠️', 'Total Hutang', Utils.formatRupiah(totalHutang, true), 'var(--warning)')}
        ${_statCard('📦', 'Barang Aktif', activeItems + ' item', 'var(--info)')}
        ${_statCard('🏷️', 'Nilai Inventory', Utils.formatRupiah(totalInvValue, true), 'var(--primary-h)')}
        ${_statCard('📋', 'Total Transaksi', kas.length + ' transaksi', 'var(--text-2)')}
      </div>

      <!-- RECENT TRANSACTIONS -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Transaksi Kas Terbaru</div>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('kas')">Lihat Semua →</button>
        </div>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Tanggal</th><th>Nama</th><th>Type</th>
                <th class="num">Jumlah</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${recentKas.length ? recentKas.map(r => `
                <tr>
                  <td style="white-space:nowrap">${Utils.formatDate(r.tgl, 'dd/mm/yyyy')}</td>
                  <td>${r.nama}</td>
                  <td><span class="badge badge-neutral">${r.type}</span></td>
                  <td class="num">${Utils.formatRupiah(r.jumlah)}</td>
                  <td><span class="badge ${r.status === 'DONE' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
                </tr>
              `).join('') : `
                <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-3)">
                  Belum ada transaksi kas
                </td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _statCard(icon, label, value, color) {
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
        <div style="font-size:24px;margin-bottom:8px">${icon}</div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">${label}</div>
        <div style="font-size:20px;font-weight:700;color:${color};font-family:var(--font-mono)">${value}</div>
      </div>
    `;
  }

  return { init };
})();

window.DashboardModule = DashboardModule;
