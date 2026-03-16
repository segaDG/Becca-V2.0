/* ============================================
   BECCA V2.0 — Dashboard Module + Widget Editor
============================================ */
const DashboardModule = (() => {

  const DEFAULT_WIDGETS = [
    {id:'saldo_kas',    label:'Saldo Kas',         icon:'&#x1F4B0;', enabled:true,  nav:'kas'},
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

  function _getCfg() {
    const s = Utils.ls.get('becca_dashboard_widgets');
    if (!s) return DEFAULT_WIDGETS.map(w => ({...w}));
    return DEFAULT_WIDGETS.map(w => { const f=s.find(x=>x.id===w.id); return f ? {...w, enabled:f.enabled} : {...w}; });
  }
  function _saveCfg(c) { Utils.ls.set('becca_dashboard_widgets', c); }

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-dashboard');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h2>Dashboard</h2><p>Ringkasan data BECCA</p></div>
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

  async function _render() {
    const [kas, kasMasuk, employees, invLogs, invItems, invoices, apList, tasks] = await Promise.all([
      DB.getKas().catch(()=>[]),          DB.getKasMasuk().catch(()=>[]),
      DB.getEmployees().catch(()=>[]),    DB.getInventory().catch(()=>[]),
      DB.getInventoryItems().catch(()=>[]),DB.getInvoices().catch(()=>[]),
      DB.getAP().catch(()=>[]),           DB.getTasks().catch(()=>[]),
    ]);

    const totalKeluar   = kas.reduce((s,r)=>s+(r.jumlah||0), 0);
    const totalMasuk    = kasMasuk.reduce((s,r)=>s+(r.kredit||0), 0);
    const saldo         = totalMasuk - totalKeluar;
    const activeEmp     = employees.filter(e=>e.status==='ACTIVE').length;
    const totalHutang   = employees.reduce((s,e)=>s+(e.sisaHutang||0), 0);
    const activeItems   = invItems.filter(p=>p.status==='Activated').length;
    const totalInvValue = invItems.reduce((s,p)=>s+((p.balance||0)*(p.harga||0)), 0);
    const invBelum      = invoices.filter(i=>i.status!=='LUNAS').reduce((s,i)=>s+(i.total||0), 0);
    const apBelum       = apList.filter(a=>a.status!=='LUNAS').reduce((s,a)=>s+(a.total||0), 0);
    const taskOpen      = tasks.filter(t=>t.status!=='done'&&t.status!=='arsip').length;
    const lowStock      = invItems.filter(p=>(p._stok||p.balance||0)<=(p.stokMin||0));
    const recentKas     = [...kas].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')).slice(0,10);
    const topHutang     = employees.filter(e=>e.status==='ACTIVE'&&(e.sisaHutang||0)>0)
                           .sort((a,b)=>(b.sisaHutang||0)-(a.sisaHutang||0)).slice(0,5);

    const vals = {
      saldo_kas:    {v: Utils.formatRupiah(saldo,true),           c: saldo>=0?'var(--success)':'var(--danger)'},
      total_keluar: {v: Utils.formatRupiah(totalKeluar,true),     c: 'var(--danger)'},
      total_masuk:  {v: Utils.formatRupiah(totalMasuk,true),      c: 'var(--success)'},
      karyawan:     {v: activeEmp+' orang',                       c: 'var(--primary-h)'},
      hutang:       {v: Utils.formatRupiah(totalHutang,true),     c: 'var(--warning)'},
      barang_aktif: {v: activeItems+' item',                      c: 'var(--info)'},
      nilai_inv:    {v: Utils.formatRupiah(totalInvValue,true),   c: 'var(--primary-h)'},
      total_trx:    {v: kas.length+' transaksi',                  c: 'var(--text-2)'},
      task_open:    {v: taskOpen+' task',                         c: taskOpen>0?'var(--warning)':'var(--success)'},
      invoice_belum:{v: Utils.formatRupiah(invBelum,true),        c: 'var(--danger)'},
      ap_belum:     {v: Utils.formatRupiah(apBelum,true),         c: 'var(--danger)'},
    };

    const widgets = _getCfg().filter(w=>w.enabled);
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

      <div style="display:grid;grid-template-columns:1fr 360px;gap:var(--s4);margin-bottom:var(--s5)">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Transaksi Kas Terbaru</div>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('kas')">Lihat Semua</button>
          </div>
          <div class="table-scroll">
            <table class="table">
              <thead><tr><th>Tanggal</th><th>Nama</th><th>Type</th><th class="num">Jumlah</th><th>Status</th></tr></thead>
              <tbody>
                ${recentKas.length ? recentKas.map(r=>`
                  <tr style="cursor:pointer" onclick="App.navigate('kas')">
                    <td style="white-space:nowrap">${r.tgl?Utils.formatDate(r.tgl,'dd/mm/yyyy'):'-'}</td>
                    <td>${r.nama||'-'}</td>
                    <td><span class="badge badge-neutral">${r.type||'-'}</span></td>
                    <td class="num">${Utils.formatRupiah(r.jumlah||0)}</td>
                    <td><span class="badge ${r.status==='DONE'?'badge-success':'badge-warning'}">${r.status||'-'}</span></td>
                  </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-3)">Belum ada data</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Stok Menipis</div>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('inventory')">Lihat</button>
          </div>
          <div style="padding:var(--s3)">
            ${lowStock.length===0 ? `<div style="text-align:center;padding:30px;color:var(--text-3)">Semua stok aman</div>` :
              lowStock.slice(0,8).map(p=>`
                <div onclick="App.navigate('inventory')" style="display:flex;align-items:center;justify-content:space-between;padding:7px var(--s3);border-radius:var(--r-sm);cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                  <div><div style="font-size:13px;font-weight:500">${p.nama}</div><div style="font-size:11px;color:var(--text-3)">${p.satuan||''}</div></div>
                  <span class="badge ${(p._stok||p.balance||0)<=0?'badge-danger':'badge-warning'}">${p._stok||p.balance||0} ${p.satuan||''}</span>
                </div>`).join('')}
          </div>
        </div>
      </div>

      ${topHutang.length ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Hutang Karyawan Terbesar</div>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('employee')">Lihat</button>
          </div>
          <div class="table-scroll">
            <table class="table">
              <thead><tr><th>#</th><th>Nama</th><th>Divisi</th><th class="num">Sisa Hutang</th></tr></thead>
              <tbody>
                ${topHutang.map((e,i)=>`
                  <tr style="cursor:pointer" onclick="App.navigate('employee')">
                    <td class="text-muted">${i+1}</td>
                    <td class="font-semibold">${e.nama}</td>
                    <td><span class="badge badge-neutral">${e.divisi||'-'}</span></td>
                    <td class="num" style="color:var(--warning);font-weight:600">${Utils.formatRupiah(e.sisaHutang)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
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
    Utils.ls.del('becca_dashboard_widgets');
    Modal.close(mid);
    Notify.success('Widget direset');
    _render();
  }

  return { init, refresh, openWidgetEditor, _saveW, _resetW };
})();
window.DashboardModule = DashboardModule;
