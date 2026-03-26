/* ============================================
   BECCA V2.0 — Report Module
============================================ */
const ReportModule = (() => {
  async function init() {
    const page = document.getElementById('page-report');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Laporan</h2>
          <p>Ringkasan laporan operasional BPS</p>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="kas"      onclick="ReportModule.switchTab('kas')">💰 Laporan Kas</button>
        <button class="tab-btn"        data-tab="order"    onclick="ReportModule.switchTab('order')">📋 Laporan Order</button>
        <button class="tab-btn"        data-tab="karyawan" onclick="ReportModule.switchTab('karyawan')">👷 Laporan Karyawan</button>
      </div>
      <div id="rpt-kas"></div>
      <div id="rpt-order"    class="hidden"></div>
      <div id="rpt-karyawan" class="hidden"></div>
    `;
    switchTab('kas');
  }

  function switchTab(tab) {
    ['kas','order','karyawan'].forEach(t => {
      document.getElementById(`rpt-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    const renders = { kas: renderKas, order: renderOrder, karyawan: renderKaryawan };
    renders[tab]?.();
  }

  async function renderKas() {
    const [kas, _cfg] = await Promise.all([DB.getKas().catch(()=>[]), DB.getSettings().catch(()=>({}))]);

    // Masuk: kas rows type="Kas" (import Excel / entry manual di tabel utama)
    const totalMasuk  = kas.filter(r=>r.type==='Kas').reduce((s,r) => s+(r.jumlah||0), 0);
    // Keluar: semua kas rows kecuali type="Kas"
    const totalKeluar = kas.filter(r=>r.type!=='Kas').reduce((s,r) => s+(r.jumlah||0), 0);
    // Saldo Awal: ambil dari Supabase settings (sync semua device), fallback localStorage
    const saldoAwal = parseFloat((_cfg && _cfg.saldoAwal) ?? localStorage.getItem('becca_kas_saldo_awal') ?? '0') || 0;
    const saldo = saldoAwal + totalMasuk - totalKeluar;

    // Pengeluaran per kategori — exclude type="Kas" (itu masuk, bukan keluar)
    const byType = {};
    kas.filter(r=>r.type!=='Kas').forEach(r => { byType[r.type] = (byType[r.type]||0) + (r.jumlah||0); });
    const typeRows = Object.entries(byType).sort((a,b) => b[1]-a[1]);

    document.getElementById('rpt-kas').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s4);margin-bottom:var(--s5)">
        ${[
          { l:'Saldo Kas Kecil', v: Utils.formatRupiah(saldo),   c: saldo>=0?'var(--success)':'var(--danger)' },
          { l:'Total Masuk',  v: Utils.formatRupiah(totalMasuk), c:'var(--success)' },
          { l:'Total Keluar', v: Utils.formatRupiah(totalKeluar),c:'var(--danger)' },
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;text-transform:uppercase">${s.l}</div>
            <div style="font-size:20px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Pengeluaran per Kategori</div></div>
        <table class="table">
          <thead><tr><th>Kategori</th><th class="num">Total</th><th class="num">%</th></tr></thead>
          <tbody>
            ${typeRows.map(([t,v]) => `
              <tr>
                <td>${t}</td>
                <td class="num">${Utils.formatRupiah(v)}</td>
                <td class="num text-muted">${totalKeluar>0?Math.round(v/totalKeluar*100):0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderOrder() {
    const orders = await DB.getOrders().catch(() => []);
    const total  = orders.length;
    const real   = orders.filter(o => (o.jenis === 'real orderan' || (o.catatan||'').toLowerCase().includes('real'))).length;
    const est    = orders.filter(o => !(o.jenis === 'real orderan' || (o.catatan||'').toLowerCase().includes('real'))).length;
    const totalPax = orders.reduce((s,o) => s+(parseInt(o.shift1)||0)+(parseInt(o.shift2)||0)+(parseInt(o.shift3)||0), 0);

    document.getElementById('rpt-order').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--s4);margin-bottom:var(--s5)">
        ${[
          { l:'Total Order',     v: total + ' order',          c:'var(--primary-h)' },
          { l:'Real Orderan',    v: real  + ' order',          c:'var(--success)' },
          { l:'Estimasi',        v: est   + ' order',          c:'var(--warning)' },
          { l:'Total Pax',       v: totalPax.toLocaleString('id') + ' pax', c:'var(--info)' },
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;text-transform:uppercase">${s.l}</div>
            <div style="font-size:22px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function renderKaryawan() {
    const employees = await DB.getEmployees().catch(() => []);
    const ACTIVE_STATS = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const active = employees.filter(e => ACTIVE_STATS.includes(e.status));
    const totalGaji   = active.reduce((s,e) => s+(e.gaji||e.gajiPokok||0), 0);
    const totalHutang = active.reduce((s,e) => s+(e.sisaHutang||e.hutang||0), 0);
    const byDiv = {};
    active.forEach(e => { const d=e.divisi||e.departemen||'Lainnya'; byDiv[d]=(byDiv[d]||0)+1; });

    const canFinance = Auth.can('emp_finance', 'view');
    document.getElementById('rpt-karyawan').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--s4);margin-bottom:var(--s5)">
        ${[
          { l:'Karyawan Aktif',   v: active.length + ' orang',        c:'var(--primary-h)', show: true },
          { l:'Total Gaji/Bulan', v: Utils.formatRupiah(totalGaji),   c:'var(--success)',   show: canFinance },
          { l:'Total Hutang',     v: Utils.formatRupiah(totalHutang), c:'var(--warning)',   show: canFinance },
        ].filter(s => s.show).map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;text-transform:uppercase">${s.l}</div>
            <div style="font-size:22px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Karyawan per Divisi</div></div>
        <table class="table">
          <thead><tr><th>Divisi</th><th class="num">Jumlah</th></tr></thead>
          <tbody>
            ${Object.entries(byDiv).sort((a,b)=>b[1]-a[1]).map(([d,n]) => `
              <tr><td>${d}</td><td class="num">${n} orang</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return { init, switchTab };
})();
window.ReportModule = ReportModule;
