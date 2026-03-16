/* ============================================
   BECCA V2.0 — Dashboard Module
   Fixed: clickable stat cards, scrollable, interactive
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
        <div class="page-header-right">
          <button class="btn btn-ghost btn-sm" onclick="DashboardModule.refresh()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>
      <div id="dashboard-content">
        <div style="display:flex;align-items:center;justify-content:center;height:300px;color:var(--text-3)">
          <div style="text-align:center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                 style="margin-bottom:16px;opacity:.4;animation:spin 1s linear infinite">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            <div>Memuat data...</div>
          </div>
        </div>
      </div>
      <style>
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: var(--s5);
          cursor: pointer;
          transition: all var(--t-base);
          position: relative;
          overflow: hidden;
        }
        .stat-card:hover {
          border-color: var(--border2);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .stat-card:hover .stat-card-arrow { opacity: 1; }
        .stat-card-arrow {
          position: absolute;
          top: var(--s4);
          right: var(--s4);
          opacity: 0;
          transition: opacity var(--t-base);
          color: var(--text-3);
        }
        .stat-card-icon { font-size: 22px; margin-bottom: var(--s2); }
        .stat-card-label {
          font-size: 10px;
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: var(--s1);
          font-weight: 600;
        }
        .stat-card-value {
          font-size: 20px;
          font-weight: 700;
          font-family: var(--font-mono);
        }
        .dashboard-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          margin-bottom: var(--s5);
          overflow: hidden;
        }
        .dashboard-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--s4) var(--s5);
          border-bottom: 1px solid var(--border);
        }
        .dashboard-section-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--heading);
        }
      </style>
    `;
    await _renderDashboard();
  }

  async function refresh() {
    const btn = document.querySelector('[onclick="DashboardModule.refresh()"]');
    if (btn) {
      btn.disabled = true;
      btn.querySelector('svg').style.animation = 'spin 1s linear infinite';
    }
    await _renderDashboard();
    if (btn) {
      btn.disabled = false;
      btn.querySelector('svg').style.animation = '';
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
    const recentKas     = [...kas].sort((a, b) => (b.tgl||'').localeCompare(a.tgl||'')).slice(0, 10);
    const lowStock      = invProducts.filter(p => (p._stok || p.balance || 0) <= (p.stokMin || 0));

    document.getElementById('dashboard-content').innerHTML = `
      <!-- STAT CARDS GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:var(--s4);margin-bottom:var(--s5)">
        ${_statCard('💰', 'Saldo Kas',       Utils.formatRupiah(saldo, true),         saldo >= 0 ? 'var(--success)' : 'var(--danger)', 'kas')}
        ${_statCard('📤', 'Total Keluar',    Utils.formatRupiah(totalKeluar, true),   'var(--danger)',   'kas')}
        ${_statCard('📥', 'Total Masuk',     Utils.formatRupiah(totalMasuk, true),    'var(--success)',  'kas')}
        ${_statCard('👷', 'Karyawan Aktif',  activeEmp + ' orang',                   'var(--primary-h)','employee')}
        ${_statCard('⚠️', 'Total Hutang',   Utils.formatRupiah(totalHutang, true),   'var(--warning)',  'employee')}
        ${_statCard('📦', 'Barang Aktif',    activeItems + ' item',                  'var(--info)',     'inventory')}
        ${_statCard('🏷️', 'Nilai Inventory', Utils.formatRupiah(totalInvValue, true), 'var(--primary-h)','inventory')}
        ${_statCard('📋', 'Total Transaksi', kas.length + ' transaksi',              'var(--text-2)',   'kas')}
      </div>

      <!-- ROW: Recent Kas + Low Stock -->
      <div style="display:grid;grid-template-columns:1fr 380px;gap:var(--s4);margin-bottom:var(--s5)">

        <!-- Transaksi Kas Terbaru -->
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <div class="dashboard-section-title">📊 Transaksi Kas Terbaru</div>
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
                  <tr style="cursor:pointer" onclick="App.navigate('kas')">
                    <td style="white-space:nowrap">${Utils.formatDate ? Utils.formatDate(r.tgl,'dd/mm/yyyy') : r.tgl}</td>
                    <td>${r.nama || '-'}</td>
                    <td><span class="badge badge-neutral">${r.type || '-'}</span></td>
                    <td class="num">${Utils.formatRupiah(r.jumlah || 0)}</td>
                    <td>
                      <span class="badge ${r.status === 'DONE' ? 'badge-success' : 'badge-warning'}">
                        ${r.status || '-'}
                      </span>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="5" style="text-align:center;padding:40px;color:var(--text-3)">
                      Belum ada transaksi kas
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Stok Menipis -->
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <div class="dashboard-section-title">⚠️ Stok Menipis</div>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('inventory')">Lihat →</button>
          </div>
          <div style="padding: var(--s3)">
            ${lowStock.length === 0 ? `
              <div style="text-align:center;padding:40px 20px;color:var(--text-3)">
                <div style="font-size:24px;margin-bottom:8px">✅</div>
                <div style="font-size:13px">Semua stok aman</div>
              </div>
            ` : lowStock.slice(0, 8).map(p => `
              <div style="display:flex;align-items:center;justify-content:space-between;
                          padding:8px var(--s3);border-radius:var(--r-sm);margin-bottom:2px;
                          transition:background var(--t-fast);cursor:pointer"
                   onmouseover="this.style.background='var(--surface2)'"
                   onmouseout="this.style.background='transparent'"
                   onclick="App.navigate('inventory')">
                <div>
                  <div style="font-size:13px;font-weight:500;color:var(--heading)">${p.nama}</div>
                  <div style="font-size:11px;color:var(--text-3)">${p.satuan || ''}</div>
                </div>
                <span class="badge ${(p._stok||p.balance||0) <= 0 ? 'badge-danger' : 'badge-warning'}">
                  ${p._stok || p.balance || 0} ${p.satuan || ''}
                </span>
              </div>
            `).join('')}
            ${lowStock.length > 8 ? `
              <div style="text-align:center;padding:8px;font-size:12px;color:var(--text-3)">
                +${lowStock.length - 8} item lainnya
              </div>
            ` : ''}
          </div>
        </div>

      </div>

      <!-- Karyawan Hutang Terbesar -->
      <div class="dashboard-section">
        <div class="dashboard-section-header">
          <div class="dashboard-section-title">💸 Karyawan dengan Hutang Terbesar</div>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('employee')">Lihat Semua →</button>
        </div>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr><th>#</th><th>Nama</th><th>Divisi</th><th class="num">Sisa Hutang</th></tr>
            </thead>
            <tbody>
              ${employees
                .filter(e => e.status === 'ACTIVE' && (e.sisaHutang || 0) > 0)
                .sort((a, b) => (b.sisaHutang || 0) - (a.sisaHutang || 0))
                .slice(0, 5)
                .map((e, i) => `
                  <tr style="cursor:pointer" onclick="App.navigate('employee')">
                    <td class="text-muted text-small">${i + 1}</td>
                    <td class="font-semibold">${e.nama}</td>
                    <td><span class="badge badge-neutral">${e.divisi || '-'}</span></td>
                    <td class="num" style="color:var(--warning);font-weight:600">
                      ${Utils.formatRupiah(e.sisaHutang || 0)}
                    </td>
                  </tr>
                `).join('') || `
                  <tr>
                    <td colspan="4" style="text-align:center;padding:30px;color:var(--text-3)">
                      Tidak ada karyawan yang berhutang 🎉
                    </td>
                  </tr>
                `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _statCard(icon, label, value, color, navigateTo) {
    return `
      <div class="stat-card" onclick="App.navigate('${navigateTo}')" title="Buka ${navigateTo}">
        <div class="stat-card-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        <div class="stat-card-icon">${icon}</div>
        <div class="stat-card-label">${label}</div>
        <div class="stat-card-value" style="color:${color}">${value}</div>
      </div>
    `;
  }

  return { init, refresh };
})();

window.DashboardModule = DashboardModule;
