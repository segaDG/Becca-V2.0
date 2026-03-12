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
          <p>Ringkasan operasional hari ini</p>
        </div>
        <div class="page-header-right">
          <span class="text-muted text-small">${Utils.formatDate(new Date(), 'dd mmm yyyy')}</span>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid-4" style="margin-bottom:var(--s6)">
        <div class="stat-card purple">
          <div class="stat-icon purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>
          </div>
          <div class="stat-value" id="dash-total-order">-</div>
          <div class="stat-label">Total Order Bulan Ini</div>
          <div class="stat-sub" id="dash-order-today">- order hari ini</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
          </div>
          <div class="stat-value" id="dash-total-invoice">-</div>
          <div class="stat-label">Total Nilai Invoice</div>
          <div class="stat-sub" id="dash-invoice-count">- invoice</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div class="stat-value" id="dash-paid">-</div>
          <div class="stat-label">Sudah Terbayar</div>
          <div class="stat-sub" id="dash-paid-count">- invoice lunas</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div class="stat-value" id="dash-overdue">-</div>
          <div class="stat-label">Jatuh Tempo</div>
          <div class="stat-sub" id="dash-overdue-count">- belum lunas</div>
        </div>
      </div>

      <!-- Recent Orders Table -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>
            Order Terbaru
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('order')">Lihat Semua</button>
        </div>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Tanggal</th><th>Customer</th><th>Diinput</th>
                <th class="num">Total Porsi</th><th>Revisi</th><th>Tipe</th>
              </tr>
            </thead>
            <tbody id="dash-recent-orders">
              <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3)">Memuat data...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await loadData();
  }

  async function loadData() {
    try {
      const [orders, invoices] = await Promise.all([DB.getOrders(), DB.getInvoices()]);

      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const today = Utils.today();

      const monthOrders = orders.filter(o => o.tanggal?.startsWith(thisMonth));
      const todayOrders = orders.filter(o => o.tanggal === today);

      const totalInvoice = invoices.reduce((s,i) => s + (Number(i.grandTotal)||0), 0);
      const paid = invoices.filter(i => i.status === 'paid');
      const paidTotal = paid.reduce((s,i) => s + (Number(i.grandTotal)||0), 0);
      const overdue = invoices.filter(i => i.status !== 'paid' && i.jatuhTempo && new Date(i.jatuhTempo) < now);
      const overdueTotal = overdue.reduce((s,i) => s + (Number(i.grandTotal) - Number(i.terbayar||0)), 0);

      // Update stat cards
      document.getElementById('dash-total-order').textContent = monthOrders.length;
      document.getElementById('dash-order-today').textContent = `${todayOrders.length} order hari ini`;
      document.getElementById('dash-total-invoice').textContent = Utils.formatRupiah(totalInvoice, true);
      document.getElementById('dash-invoice-count').textContent = `${invoices.length} invoice`;
      document.getElementById('dash-paid').textContent = Utils.formatRupiah(paidTotal, true);
      document.getElementById('dash-paid-count').textContent = `${paid.length} invoice lunas`;
      document.getElementById('dash-overdue').textContent = Utils.formatRupiah(overdueTotal, true);
      document.getElementById('dash-overdue-count').textContent = `${overdue.length} belum lunas`;

      // Recent orders table
      const recent = orders.slice(0, 10);
      document.getElementById('dash-recent-orders').innerHTML = recent.length
        ? recent.map(o => `
          <tr>
            <td>${Utils.formatDate(o.tanggal, 'dd mmm yyyy')}</td>
            <td><span class="font-semibold">${o.customerNama||'-'}</span></td>
            <td class="text-muted text-small">${o.createdBy||'-'}</td>
            <td class="num"><strong>${o.totalPorsi||0}</strong></td>
            <td><span class="badge badge-neutral">${o.revisi||0}</span></td>
            <td><span class="badge ${o.tipe==='real'?'badge-success':'badge-info'}">${o.tipe==='real'?'Real':'Estimasi'}</span></td>
          </tr>
        `).join('')
        : `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada data order</td></tr>`;

    } catch (err) {
      console.error(err);
    }
  }

  return { init };
})();

window.DashboardModule = DashboardModule;
