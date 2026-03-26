/* ============================================
   BECCA V2.0 — Dashboard Module + Widget Editor
============================================ */
const DashboardModule = (() => {

  const DEFAULT_WIDGETS = [
    {id:'saldo_kas',    label:'Saldo Kas Kecil',   icon:'&#x1F4B0;', enabled:true,  nav:'kas'},
    {id:'total_keluar', label:'Total Keluar',       icon:'&#x1F4E4;', enabled:true,  nav:'kas'},
    {id:'total_masuk',  label:'Total Masuk',        icon:'&#x1F4E5;', enabled:true,  nav:'kas'},
    {id:'karyawan',     label:'Karyawan Aktif',     icon:'&#x1F477;', enabled:true,  nav:'employee'},
    {id:'hutang',       label:'Total Hutang',       icon:'&#x26A0;',  enabled:true,  nav:'employee'},
    {id:'barang_aktif', label:'Barang Aktif',       icon:'&#x1F4E6;', enabled:true,  nav:'inventory'},
    {id:'nilai_inv',    label:'Nilai Inventory',    icon:'&#x1F3F7;', enabled:true,  nav:'inventory'},
    {id:'total_trx',    label:'Total Transaksi',    icon:'&#x1F4CB;', enabled:true,  nav:'kas'},
    {id:'task_open',    label:'Task Aktif',         icon:'&#x2705;',  enabled:false, nav:'task'},
    {id:'invoice_belum',label:'Invoice Belum Lunas',icon:'&#x1F9FE;', enabled:false, nav:'invoice'},
    {id:'ap_belum',     label:'AP Belum Lunas',     icon:'&#x1F4B3;', enabled:false, nav:'ap'},
  ];

  const _WIDGET_KEY = 'becca_dashboard_widgets';
  function _getCfg() {
    try {
      const s = JSON.parse(localStorage.getItem(_WIDGET_KEY));
      if (Array.isArray(s)) return DEFAULT_WIDGETS.map(w => { const f=s.find(x=>x.id===w.id); return f ? {...w, enabled:f.enabled} : {...w}; });
    } catch {}
    return DEFAULT_WIDGETS.map(w => ({...w}));
  }
  function _saveCfg(c) { localStorage.setItem(_WIDGET_KEY, JSON.stringify(c.map(w=>({id:w.id,enabled:w.enabled})))); }

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-dashboard');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h2>Dashboard</h2><p>Ringkasan data BPS</p></div>
        <div class="page-header-right">
          <button class="btn btn-ghost btn-sm" onclick="DashboardModule.openWidgetEditor()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg> Edit Widget
          </button>
          <button class="btn btn-ghost btn-sm" onclick="DashboardModule.refresh()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg> Refresh
          </button>
        </div>
      </div>
      <div id="dash-content"><div style="text-align:center;padding:60px;color:var(--text-3)">Memuat...</div></div>
      <style>
        .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5);cursor:pointer;transition:all var(--t-base);position:relative;overflow:hidden;user-select:none;}
        .stat-card:hover{border-color:var(--border2);transform:translateY(-2px);box-shadow:var(--shadow-md);}
        .stat-card:hover .stat-arrow{opacity:1;}
        .stat-arrow{position:absolute;top:var(--s3);right:var(--s3);opacity:0;transition:opacity var(--t-base);color:var(--text-3);}
        .stat-icon{font-size:22px;margin-bottom:var(--s2);}
        .stat-label{font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--s1);}
        .stat-value{font-size:20px;font-weight:700;font-family:var(--font-mono);}
      </style>
    `;
    await _render();
  }

  async function refresh() { await _render(); Notify.success('Data diperbarui'); }

  // Map each widget ID to the module it needs access to
  const _WIDGET_MODULE = {
    saldo_kas:'kas', total_keluar:'kas', total_masuk:'kas', total_trx:'kas',
    karyawan:'employee', hutang:'employee',
    barang_aktif:'inventory', nilai_inv:'inventory',
    task_open:'task', invoice_belum:'invoice', ap_belum:'ap',
  };

  async function _render() {
    // Load only data user has access to
    const canKas      = Auth.can('kas','view');
    const canEmployee = Auth.can('employee','view');
    const canInventory= Auth.can('inventory','view');
    const canInvoice  = Auth.can('invoice','view');
    const canAP       = Auth.can('ap','view');
    const canTask     = Auth.can('task','view');

    // Level 3: ambil summary dari server (RPC), bukan full-fetch semua baris.
    // Setiap call hanya transfer ~1KB JSON. Fallback otomatis ke full-fetch
    // jika SQL functions belum di-deploy di Supabase.
    const [kasSumm, empSumm, invSumm, taskSumm, invoiceSumm, apSumm, _settings] = await Promise.all([
      canKas       ? DB.getKasSummary().catch(()=>null)       : Promise.resolve(null),
      canEmployee  ? DB.getEmployeeSummary().catch(()=>null)  : Promise.resolve(null),
      canInventory ? DB.getInventorySummary().catch(()=>null) : Promise.resolve(null),
      canTask      ? DB.getTasksSummary().catch(()=>null)     : Promise.resolve(null),
      canInvoice   ? DB.getInvoicesSummary().catch(()=>null)  : Promise.resolve(null),
      canAP        ? DB.getAPSummary().catch(()=>null)        : Promise.resolve(null),
      DB.getSettings().catch(()=>({})),
    ]);

    const totalMasuk    = kasSumm?.total_masuk  || 0;
    const totalKeluar   = kasSumm?.total_keluar || 0;
    const saldoAwal     = parseFloat((_settings?.saldoAwal) ?? localStorage.getItem('becca_kas_saldo_awal') ?? '0') || 0;
    const saldo         = saldoAwal + totalMasuk - totalKeluar;
    const activeEmp     = empSumm?.active_count || 0;
    const totalHutang   = empSumm?.total_hutang || 0;
    const activeItems   = invSumm?.active_items || 0;
    const totalInvValue = invSumm?.total_nilai  || 0;
    const invBelum      = invoiceSumm?.belum_lunas || 0;
    const apBelum       = apSumm?.belum_lunas      || 0;
    const taskOpen      = taskSumm?.open_count     || 0;
    const recentKas     = kasSumm?.recent    || [];
    const lowStock      = invSumm?.low_stock  || [];
    const topHutang     = empSumm?.top_hutang || [];

    const vals = {
      saldo_kas:    {v: Utils.formatRupiah(saldo),                 c: saldo>=0?'var(--success)':'var(--danger)'},
      total_keluar: {v: Utils.formatRupiah(totalKeluar),           c: 'var(--danger)'},
      total_masuk:  {v: Utils.formatRupiah(totalMasuk),            c: 'var(--success)'},
      karyawan:     {v: activeEmp+' orang',                       c: 'var(--primary-h)'},
      hutang:       {v: Utils.formatRupiah(totalHutang,true),     c: 'var(--warning)'},
      barang_aktif: {v: activeItems+' item',                      c: 'var(--info)'},
      nilai_inv:    {v: Utils.formatRupiah(totalInvValue,true),   c: 'var(--primary-h)'},
      total_trx:    {v: (kasSumm?.count||0)+' transaksi',          c: 'var(--text-2)'},
      task_open:    {v: taskOpen+' task',                         c: taskOpen>0?'var(--warning)':'var(--success)'},
      invoice_belum:{v: Utils.formatRupiah(invBelum,true),        c: 'var(--danger)'},
      ap_belum:     {v: Utils.formatRupiah(apBelum,true),         c: 'var(--danger)'},
    };

    // Filter widgets by user privilege
    const widgets = _getCfg().filter(w => {
      if (!w.enabled) return false;
      const mod = _WIDGET_MODULE[w.id];
      if (mod && !Auth.can(mod,'view')) return false;
      return true;
    });
    const arrowSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;

    document.getElementById('dash-content').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:var(--s4);margin-bottom:var(--s5)">
        ${widgets.map(w => {
          const v = vals[w.id] || {v:'-', c:'var(--text-2)'};
          return `<div class="stat-card" onclick="App.navigate('${w.nav}')">
            <div class="stat-arrow">${arrowSVG}</div>
            <div class="stat-icon">${w.icon}</div>
            <div class="stat-label">${w.label}</div>
            <div class="stat-value" style="color:${v.c}">${v.v}</div>
          </div>`;
        }).join('')}
      </div>

      <div style="display:grid;grid-template-columns:${[canKas,canInventory].filter(Boolean).length>1?'1fr 360px':'1fr'};gap:var(--s4);margin-bottom:var(--s5)">
        ${canKas ? _renderRecentKasTable(recentKas) : ''}

        ${canInventory ? _renderLowStockCard(lowStock) : ''}
      </div>

      ${canEmployee && topHutang.length ? _renderHutangTable(topHutang) : ''}
    `;
  }

  /* ===================== WIDGET EDITOR ===================== */
  function openWidgetEditor() {
    const cfg = _getCfg();
    const mid = Utils.uid(); Modal.open({ id: mid,
      title : 'Edit Widget Dashboard',
      size  : 'modal-md',
      body  : `
        <p style="color:var(--text-3);font-size:13px;margin-bottom:var(--s4)">Centang widget yang ingin ditampilkan.</p>
        <div style="display:flex;flex-direction:column;gap:var(--s2)">
          ${cfg.map(w=>`
            <label style="display:flex;align-items:center;gap:var(--s3);padding:var(--s3) var(--s4);background:var(--surface2);border-radius:var(--r-md);cursor:pointer;border:1px solid ${w.enabled?'var(--primary)':'var(--border)'};transition:border-color .2s"
                   onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='var(--surface2)'">
              <input type="checkbox" id="w_${w.id}" ${w.enabled?'checked':''} onchange="this.closest('label').style.borderColor=this.checked?'var(--primary)':'var(--border)'">
              <span style="font-size:18px">${w.icon}</span>
              <span style="font-weight:500;flex:1">${w.label}</span>
              <span style="font-size:11px;color:var(--text-3)">${w.nav}</span>
            </label>`).join('')}
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-ghost" onclick="DashboardModule._resetW('${mid}')">Reset</button>
        <button class="btn btn-primary" onclick="DashboardModule._saveW('${mid}')">Simpan</button>`,
    });
    return mid;
  }

  function _saveW(mid) {
    const cfg = _getCfg();
    cfg.forEach(w => { const cb=document.getElementById('w_'+w.id); if(cb) w.enabled=cb.checked; });
    _saveCfg(cfg);
    Modal.close(mid);
    Notify.success('Widget disimpan!');
    DB.logActivity({type:'edit_dashboard', detail:'Widget diperbarui'});
    _render();
  }

  function _resetW(mid) {
    localStorage.removeItem(_WIDGET_KEY);
    Modal.close(mid);
    Notify.success('Widget direset');
    _render();
  }

  function _renderRecentKasTable(rows) {
    const nav = "App.navigate(\'kas\')";
    let h = '<div class="card"><div class="card-header">'
      + '<div class="card-title">Transaksi Kas Terbaru</div>'
      + '<button class="btn btn-ghost btn-sm" onclick="' + nav + '">Lihat Semua</button>'
      + '</div><div class="table-scroll"><table class="table">'
      + '<thead><tr><th>Tanggal</th><th>Nama</th><th>Type</th><th class="num">Jumlah</th><th>Status</th></tr></thead><tbody>';
    if (!rows.length) {
      h += '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-3)">Belum ada data</td></tr>';
    } else {
      rows.forEach(function(r) {
        h += '<tr style="cursor:pointer" onclick="' + nav + '">'
          + '<td style="white-space:nowrap">' + (r.tgl ? Utils.formatDate(r.tgl,'dd/mm/yyyy') : '-') + '</td>'
          + '<td>' + (r.nama||'-') + '</td>'
          + '<td><span class="badge badge-neutral">' + (r.type||'-') + '</span></td>'
          + '<td class="num">' + Utils.formatRupiah(r.jumlah||0) + '</td>'
          + '<td><span class="badge ' + (r.status==='DONE'?'badge-success':'badge-warning') + '">' + (r.status||'-') + '</span></td>'
          + '</tr>';
      });
    }
    return h + '</tbody></table></div></div>';
  }

  function _renderLowStockCard(lowStock) {
    const nav = "App.navigate(\'inventory\')";
    let h = '<div class="card"><div class="card-header">'
      + '<div class="card-title">Stok Menipis</div>'
      + '<button class="btn btn-ghost btn-sm" onclick="' + nav + '">Lihat</button>'
      + '</div><div style="padding:var(--s3)">';
    if (!lowStock.length) {
      h += '<div style="text-align:center;padding:30px;color:var(--text-3)">Semua stok aman ✅</div>';
    } else {
      lowStock.slice(0,8).forEach(function(p) {
        const stok = p._stok||p.balance||0;
        h += '<div onclick="' + nav + '" style="display:flex;align-items:center;justify-content:space-between;padding:7px var(--s3);border-radius:var(--r-sm);cursor:pointer">'
          + '<div><div style="font-size:13px;font-weight:500">' + p.nama + '</div>'
          + '<div style="font-size:11px;color:var(--text-3)">' + (p.satuan||'') + '</div></div>'
          + '<span class="badge ' + (stok<=0?'badge-danger':'badge-warning') + '">' + stok + ' ' + (p.satuan||'') + '</span>'
          + '</div>';
      });
    }
    return h + '</div></div>';
  }

  function _renderHutangTable(topHutang) {
    const nav = "App.navigate(\'employee\')";
    let h = '<div class="card"><div class="card-header">'
      + '<div class="card-title">Hutang Karyawan Terbesar</div>'
      + '<button class="btn btn-ghost btn-sm" onclick="' + nav + '">Lihat</button>'
      + '</div><div class="table-scroll"><table class="table">'
      + '<thead><tr><th>#</th><th>Nama</th><th>Divisi</th><th class="num">Sisa Hutang</th></tr></thead><tbody>';
    topHutang.forEach(function(e,i) {
      h += '<tr style="cursor:pointer" onclick="' + nav + '">'
        + '<td class="text-muted">' + (i+1) + '</td>'
        + '<td class="font-semibold">' + e.nama + '</td>'
        + '<td><span class="badge badge-neutral">' + (e.divisi||'-') + '</span></td>'
        + '<td class="num" style="color:var(--warning);font-weight:600">' + Utils.formatRupiah(e.sisaHutang) + '</td>'
        + '</tr>';
    });
    return h + '</tbody></table></div></div>';
  }



  return { init, refresh, openWidgetEditor, _saveW, _resetW };
})();
window.DashboardModule = DashboardModule;
