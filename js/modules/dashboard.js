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

  // Baca array dari localStorage (synchronous, tidak tunggu network)
  function _lsArr(k) { try { return JSON.parse(localStorage.getItem('becca_'+k)||'[]'); } catch { return []; } }
  function _lsSettings() {
    try {
      const r = JSON.parse(localStorage.getItem('becca_settings')||'{}');
      return Array.isArray(r) ? (r[0]||{}) : r;
    } catch { return {}; }
  }

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
        .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5);cursor:pointer;transition:all .2s;position:relative;overflow:hidden;user-select:none;box-shadow:0 1px 4px rgba(0,0,0,.06)}
        .stat-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.25)}
        .stat-card:hover .stat-arrow{opacity:1;transform:translateX(0)}
        .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:var(--r-lg) var(--r-lg) 0 0}
        .stat-card.sc-green::before{background:linear-gradient(90deg,#10b981,#34d399)}
        .stat-card.sc-red::before{background:linear-gradient(90deg,#ef4444,#f87171)}
        .stat-card.sc-blue::before{background:linear-gradient(90deg,#3b82f6,#60a5fa)}
        .stat-card.sc-purple::before{background:linear-gradient(90deg,#6366f1,#818cf8)}
        .stat-card.sc-amber::before{background:linear-gradient(90deg,#f59e0b,#fbbf24)}
        .stat-card.sc-cyan::before{background:linear-gradient(90deg,#06b6d4,#22d3ee)}
        .stat-arrow{position:absolute;top:var(--s4);right:var(--s4);opacity:0;transform:translateX(-4px);transition:all .2s;color:var(--text-3)}
        .stat-icon-wrap{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:var(--s3)}
        .sc-green .stat-icon-wrap{background:rgba(16,185,129,.12)}
        .sc-red .stat-icon-wrap{background:rgba(239,68,68,.12)}
        .sc-blue .stat-icon-wrap{background:rgba(59,130,246,.12)}
        .sc-purple .stat-icon-wrap{background:rgba(99,102,241,.12)}
        .sc-amber .stat-icon-wrap{background:rgba(245,158,11,.12)}
        .sc-cyan .stat-icon-wrap{background:rgba(6,182,212,.12)}
        .stat-label{font-size:11px;color:var(--text-2);font-weight:500;margin-bottom:4px}
        .stat-value{font-size:22px;font-weight:800;font-family:var(--font-mono);letter-spacing:-.01em}
      </style>
    `;
    await _render();
  }

  async function refresh() { await _render(); Notify.success('Data diperbarui'); }

  // Map each widget ID to the module it needs access to
  const _WIDGET_MODULE = {
    saldo_kas:'kas', total_keluar:'kas', total_masuk:'kas', total_trx:'kas',
    karyawan:'employee', hutang:'emp_finance',
    barang_aktif:'inventory', nilai_inv:'inventory',
    task_open:'task', invoice_belum:'invoice', ap_belum:'ap',
  };

  async function _render() {
    const canKas        = Auth.can('kas','view');
    const canEmployee   = Auth.can('employee','view');
    const canEmpFinance = Auth.can('emp_finance','view');
    const canInventory  = Auth.can('inventory','view');
    const canInvoice    = Auth.can('invoice','view');
    const canAP         = Auth.can('ap','view');
    const canTask       = Auth.can('task','view');
    const perms = {canKas, canEmployee, canEmpFinance, canInventory, canInvoice, canAP, canTask};

    // Data karyawan dibutuhkan untuk employee list ATAU hutang/finance
    const needEmp = canEmployee || canEmpFinance;

    // Phase 1 — tampil SEKETIKA dari memCache atau localStorage (tidak tunggu network)
    const kas      = canKas   ? (DB.getCached('kas')          || _lsArr('kas'))         : [];
    const employees= needEmp  ? (DB.getCached('employees')    || _lsArr('employees'))   : [];
    const invItems = canInventory ? (DB.getCached('inv_products') || _lsArr('inv_products')): [];
    const invoices = canInvoice   ? (DB.getCached('invoices')     || _lsArr('invoices'))    : [];
    const apList   = canAP        ? (DB.getCached('ap')           || _lsArr('ap'))          : [];
    const tasks    = canTask      ? (DB.getCached('tasks')        || _lsArr('tasks'))       : [];
    const settings = DB.getCached('settings') || _lsSettings();

    _renderData(kas, employees, invItems, invoices, apList, tasks, settings, perms);

    // Phase 2 — background fetch jika ada yang belum ada di memCache
    const needFetch =
      (canKas     && !DB.getCached('kas'))        ||
      (needEmp    && !DB.getCached('employees'))  ||
      (canInventory && !DB.getCached('inv_products'));

    if (needFetch) {
      Promise.all([
        canKas        ? DB.getKas().catch(()=>null)            : null,
        needEmp       ? DB.getEmployees().catch(()=>null)      : null,
        canInventory  ? DB.getInventoryItems().catch(()=>null) : null,
        canInvoice    ? DB.getInvoices().catch(()=>null)       : null,
        canAP         ? DB.getAP().catch(()=>null)             : null,
        canTask       ? DB.getTasks().catch(()=>null)          : null,
        null, // settings already cached — no need to re-fetch
      ]).then(([fKas, fEmp, fInv, fInv2, fAP, fTasks, fSet]) => {
        if (!document.getElementById('dash-content')) return; // user navigated away
        _renderData(
          fKas  ?? kas,    fEmp   ?? employees, fInv ?? invItems,
          fInv2 ?? invoices, fAP ?? apList,    fTasks ?? tasks,
          fSet  ?? settings, perms
        );
      }).catch(()=>{});
    }
  }

  function _renderData(kas, employees, invItems, invoices, apList, tasks, _settings, {canKas, canEmployee, canEmpFinance, canInventory, canInvoice, canAP, canTask}) {
    const _ACTIVE_EMP = ['AKTIF','ACTIVE','aktif','active','Aktif','Tetap','Kontrak','Percobaan','Harian'];
    const _ACTIVE_INV = ['AKTIF','ACTIVE','aktif','active','Aktif','Activated'];

    const totalMasuk  = kas.filter(k=>k.type==='Kas').reduce((s,k)=>s+(+k.jumlah||0),0);
    const totalKeluar = kas.filter(k=>k.type!=='Kas').reduce((s,k)=>s+(+k.jumlah||0),0);
    const saldoAwal   = parseFloat((_settings?.saldoAwal) ?? localStorage.getItem('becca_kas_saldo_awal') ?? '0') || 0;
    // Mirror nilai balance langsung dari kas.js jika tersedia (paling akurat)
    const _savedBal   = parseFloat(localStorage.getItem('becca_kas_balance'));
    const saldo       = !isNaN(_savedBal) ? _savedBal : (saldoAwal + totalMasuk - totalKeluar);

    const activeEmpList = employees.filter(e=>_ACTIVE_EMP.includes(e.status));
    const activeEmp     = activeEmpList.length;
    const totalHutang   = activeEmpList.reduce((s,e)=>s+(+(e.sisaHutang??e.hutang)||0),0);
    const topHutang     = [...activeEmpList]
                            .filter(e=>(+(e.sisaHutang??e.hutang)||0)>0)
                            .sort((a,b)=>(+(b.sisaHutang??b.hutang)||0)-(+(a.sisaHutang??a.hutang)||0))
                            .slice(0,5);

    const activeInvList = invItems.filter(p=>_ACTIVE_INV.includes(p.status));
    const activeItems   = activeInvList.length;
    const totalInvValue = activeInvList.reduce((s,p)=>s+(+(p.balance||p._stok)||0)*(+(p.harga||p.hargaSatuan)||0),0);
    const lowStock      = invItems.filter(p=>(+(p.balance||p._stok)||0)<=(+(p.stokMin)||0)).slice(0,8);

    const invBelum  = invoices.filter(i=>i.status!=='LUNAS').reduce((s,i)=>s+(+i.total||0),0);
    const apBelum   = apList.filter(a=>a.status!=='LUNAS').reduce((s,a)=>s+(+a.total||0),0);
    const taskOpen  = tasks.filter(t=>t.status!=='done'&&t.status!=='arsip').length;
    const recentKas = [...kas]
                        .sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')||String(b.id).localeCompare(String(a.id)))
                        .slice(0,10);

    // Number formatting consistency: SEMUA stat card pakai full format
    // (Rp 1.234.567) untuk akurasi compare. Compact format (Rp 1,2jt) hanya
    // dipakai di tooltip/inline secondary metrics yg space-constrained.
    const vals = {
      saldo_kas:    {v: Utils.formatRupiah(saldo),               c: saldo>=0?'var(--success)':'var(--danger)'},
      total_keluar: {v: Utils.formatRupiah(totalKeluar),         c: 'var(--danger)'},
      total_masuk:  {v: Utils.formatRupiah(totalMasuk),          c: 'var(--success)'},
      karyawan:     {v: activeEmp+' orang',                      c: 'var(--primary-h)'},
      hutang:       {v: Utils.formatRupiah(totalHutang),         c: 'var(--warning)'},
      barang_aktif: {v: activeItems+' item',                     c: 'var(--info)'},
      nilai_inv:    {v: Utils.formatRupiah(totalInvValue),       c: 'var(--primary-h)'},
      total_trx:    {v: kas.length+' transaksi',                  c: 'var(--text-2)'},
      task_open:    {v: taskOpen+' task',                        c: taskOpen>0?'var(--warning)':'var(--success)'},
      invoice_belum:{v: Utils.formatRupiah(invBelum),            c: 'var(--danger)'},
      ap_belum:     {v: Utils.formatRupiah(apBelum),             c: 'var(--danger)'},
    };

    const widgets = _getCfg().filter(w => {
      if (!w.enabled) return false;
      const mod = _WIDGET_MODULE[w.id];
      if (mod && !Auth.can(mod,'view')) return false;
      return true;
    });
    const arrowSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    // Color class per widget
    const _wColor = {saldo_kas:'sc-green',total_keluar:'sc-red',total_masuk:'sc-green',karyawan:'sc-purple',hutang:'sc-amber',barang_aktif:'sc-blue',nilai_inv:'sc-cyan',total_trx:'sc-purple',task_open:'sc-amber',invoice_belum:'sc-red',ap_belum:'sc-red'};

    const el = document.getElementById('dash-content');
    if (!el) return;
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--s4);margin-bottom:var(--s6)">
        ${widgets.map(w => {
          const v = vals[w.id] || {v:'-', c:'var(--text-2)'};
          const cc = _wColor[w.id] || 'sc-purple';
          return `<div class="stat-card ${cc}" onclick="App.navigate('${w.nav}')">
            <div class="stat-arrow">${arrowSVG}</div>
            <div class="stat-icon-wrap">${w.icon}</div>
            <div class="stat-label">${w.label}</div>
            <div class="stat-value" style="color:${v.c}">${v.v}</div>
          </div>`;
        }).join('')}
      </div>

      ${canKas ? _renderKasChart(kas) : ''}

      <div class="dash-grid${[canKas,canInventory].filter(Boolean).length>1?' dash-grid-2col':''}">
        ${canKas ? _renderRecentKasTable(recentKas) : ''}
        ${canInventory ? _renderLowStockCard(lowStock) : ''}
      </div>

      ${canInvoice && invoices?.length ? _renderCustomerGrowth(invoices) : ''}

      ${canEmpFinance && topHutang.length ? _renderHutangTable(topHutang) : ''}
    `;
  }

  /* ─────────────────────────────────────────────────────────────
     CUSTOMER GROWTH — bandingkan customer aktif bulan ini vs lalu
     Aktif = punya invoice ≤60 hari. New = first invoice bulan ini.
     Churn = aktif di periode 60-120 hari lalu tapi tidak di 60 hari terakhir.
     ───────────────────────────────────────────────────────────── */
  function _renderCustomerGrowth(invoices) {
    const _invDate = (i) => i.tglInvoice || i.tgl_invoice || i.periodeAkhir || i.tgl || i.created_at || '';
    const today = new Date(); today.setHours(0,0,0,0);
    const ms60  = 60 * 86400000;
    const refNow  = today.getTime();
    const refLast = refNow - 30 * 86400000; // titik referensi "1 bulan lalu"

    // Group by customer
    const map = {}; // {nama: {first, last, count}}
    invoices.forEach(inv => {
      const nama = (inv.customer || inv.customerNama || '').trim();
      if (!nama) return;
      const t = new Date(_invDate(inv)).getTime();
      if (!Number.isFinite(t)) return;
      if (!map[nama]) map[nama] = { nama, first: t, last: t, count: 1 };
      else {
        if (t < map[nama].first) map[nama].first = t;
        if (t > map[nama].last)  map[nama].last  = t;
        map[nama].count++;
      }
    });
    const all = Object.values(map);
    if (!all.length) return '';

    // Active now: last invoice within last 60 days
    const activeNow  = all.filter(c => refNow  - c.last <= ms60);
    const activeLast = all.filter(c => refLast - c.last <= ms60 && c.first <= refLast);
    const delta = activeNow.length - activeLast.length;

    // New this month: first invoice in current month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const newThisMonth = all
      .filter(c => c.first >= startOfMonth)
      .sort((a, b) => b.first - a.first)
      .slice(0, 5);

    // Churn: was active in 60-120d window, but not in last 60d
    const churned = all
      .filter(c => refNow - c.last > ms60 && refNow - c.last <= 2 * ms60)
      .sort((a, b) => a.last - b.last) // most recently churned first (smallest last → longer ago, switch?)
      .slice(0, 5);

    const topByLtv = all
      .map(c => ({ ...c, ltv: invoices.filter(i => (i.customer||'').trim() === c.nama).reduce((s,i) => s + (+i.total||0), 0) }))
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, 3);

    const deltaColor = delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : '#6b7280';
    const deltaIcon  = delta > 0 ? '▲' : delta < 0 ? '▼' : '•';
    const deltaText  = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0';

    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5);margin-top:var(--s4);box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(99,102,241,.12);display:flex;align-items:center;justify-content:center;font-size:18px">👥</div>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text)">Customer Growth</div>
              <div style="font-size:11px;color:var(--text-3)">Aktif = punya invoice ≤60 hari</div>
            </div>
          </div>
          <button onclick="App.navigate('customer')" style="padding:5px 10px;font-size:11px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text-3);cursor:pointer">Lihat semua →</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:14px">
          <div style="padding:12px;border-radius:8px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.18)">
            <div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Aktif Bulan Ini</div>
            <div style="font-size:24px;font-weight:800;color:var(--primary);font-family:var(--font-mono)">${activeNow.length}</div>
          </div>
          <div style="padding:12px;border-radius:8px;background:${delta>=0?'rgba(16,185,129,.06)':'rgba(239,68,68,.06)'};border:1px solid ${delta>=0?'rgba(16,185,129,.18)':'rgba(239,68,68,.18)'}">
            <div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">vs Bulan Lalu</div>
            <div style="font-size:24px;font-weight:800;color:${deltaColor};font-family:var(--font-mono)">${deltaIcon} ${deltaText}</div>
          </div>
          <div style="padding:12px;border-radius:8px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.18)">
            <div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Customer Baru</div>
            <div style="font-size:24px;font-weight:800;color:#16a34a;font-family:var(--font-mono)">${newThisMonth.length}</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:2px">bulan ini</div>
          </div>
          <div style="padding:12px;border-radius:8px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.18)">
            <div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Churn Risk</div>
            <div style="font-size:24px;font-weight:800;color:#d97706;font-family:var(--font-mono)">${churned.length}</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:2px">>60 hari no order</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:6px;display:flex;align-items:center;gap:5px">▲ Customer Baru</div>
            ${newThisMonth.length ? newThisMonth.map(c => `
              <div style="padding:6px 10px;background:rgba(34,197,94,.05);border-left:2px solid #22c55e;border-radius:4px;margin-bottom:4px;font-size:12px">
                <div style="font-weight:600;color:var(--text)">${Utils.esc?Utils.esc(c.nama):c.nama}</div>
                <div style="font-size:10px;color:var(--text-3)">${new Date(c.first).toLocaleDateString('id-ID',{day:'2-digit',month:'short'})} · ${c.count} invoice</div>
              </div>`).join('') : `<div style="font-size:11px;color:var(--text-3);padding:8px;text-align:center;background:var(--surface2);border-radius:5px">Belum ada customer baru bulan ini</div>`}
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:6px;display:flex;align-items:center;gap:5px">▼ Churn Risk</div>
            ${churned.length ? churned.map(c => {
              const days = Math.floor((refNow - c.last) / 86400000);
              return `<div style="padding:6px 10px;background:rgba(245,158,11,.05);border-left:2px solid #f59e0b;border-radius:4px;margin-bottom:4px;font-size:12px">
                <div style="font-weight:600;color:var(--text)">${Utils.esc?Utils.esc(c.nama):c.nama}</div>
                <div style="font-size:10px;color:var(--text-3)">Terakhir order ${days} hari lalu · ${c.count} invoice all-time</div>
              </div>`;
            }).join('') : `<div style="font-size:11px;color:var(--text-3);padding:8px;text-align:center;background:var(--surface2);border-radius:5px">Tidak ada customer berisiko churn</div>`}
          </div>
        </div>

        ${topByLtv.length ? `
          <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border)">
            <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">🏆 Top by Revenue (LTV)</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${topByLtv.map((c, i) => `
                <div style="padding:6px 10px;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.08));border:1px solid rgba(99,102,241,.2);border-radius:6px;font-size:11px">
                  <span style="font-weight:700;color:var(--primary)">#${i+1}</span>
                  <span style="font-weight:600;color:var(--text);margin:0 6px">${Utils.esc?Utils.esc(c.nama):c.nama}</span>
                  <span style="color:var(--text-3);font-family:var(--font-mono)">${Utils.formatRupiah(c.ltv, true)}</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
      </div>`;
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

  function _renderKasChart(kasData) {
    if (!kasData || !kasData.length) return '';
    const MONTHS = Utils.MONTHS_SHORT || ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const NORM = {'Jan':'Jan','Febuari':'Feb','Feb':'Feb','Mar':'Mar','Apr':'Apr','Mei':'Mei','Jun':'Jun','Jul':'Jul','Ags':'Ags','Sep':'Sep','Okt':'Okt','Nov':'Nov','Des':'Des',
      'Januari':'Jan','Februari':'Feb','Maret':'Mar','April':'Apr','Juni':'Jun','Juli':'Jul','Agustus':'Ags','September':'Sep','Oktober':'Okt','November':'Nov','Desember':'Des'};
    const monthly = {};
    MONTHS.forEach(m => { monthly[m] = { keluar:0, masuk:0 }; });
    kasData.forEach(r => {
      const b = NORM[r.bulan||''] || '';
      if (!b || !monthly[b]) return;
      if (r.type === 'Kas') monthly[b].masuk += (r.jumlah||0);
      else monthly[b].keluar += (r.jumlah||0);
    });
    const maxVal = Math.max(...Object.values(monthly).map(m => Math.max(m.keluar, m.masuk)), 1);
    const bars = MONTHS.map(m => {
      const d = monthly[m];
      const hK = Math.round(d.keluar / maxVal * 120);
      const hM = Math.round(d.masuk / maxVal * 120);
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:28px">
        <div style="height:120px;display:flex;align-items:flex-end;gap:2px">
          <div style="width:12px;height:${hK}px;background:#ef4444;border-radius:3px 3px 0 0;transition:height .3s" title="Keluar: ${Utils.formatRupiah(d.keluar)}"></div>
          <div style="width:12px;height:${hM}px;background:#10b981;border-radius:3px 3px 0 0;transition:height .3s" title="Masuk: ${Utils.formatRupiah(d.masuk)}"></div>
        </div>
        <span style="font-size:9px;color:var(--text-3);font-weight:600">${m}</span>
      </div>`;
    }).join('');
    return `<div class="card" style="margin-bottom:var(--s4)">
      <div class="card-header"><div class="card-title">Kas Bulanan</div>
        <div style="display:flex;gap:12px;font-size:10px;color:var(--text-3)">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#ef4444;margin-right:3px"></span>Keluar</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#10b981;margin-right:3px"></span>Masuk</span>
        </div>
      </div>
      <div style="padding:var(--s4);display:flex;gap:4px;align-items:flex-end;overflow-x:auto">${bars}</div>
    </div>`;
  }

  function _renderRecentKasTable(rows) {
    const nav = "App.navigate(\'kas\')";
    let h = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:rgba(239,68,68,.1);display:flex;align-items:center;justify-content:center;font-size:15px">💰</div>'
      + '<div style="font-size:14px;font-weight:700">Transaksi Kas Terbaru</div></div>'
      + '<button class="btn btn-ghost btn-sm" onclick="' + nav + '">Lihat Semua →</button>'
      + '</div><div class="table-scroll"><table class="table">'
      + '<thead><tr><th>Tanggal</th><th>Nama</th><th>Type</th><th class="num">Jumlah</th><th>Status</th></tr></thead><tbody>';
    if (!rows.length) {
      h += '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada data</td></tr>';
    } else {
      rows.forEach(function(r) {
        h += '<tr style="cursor:pointer" onclick="' + nav + '">'
          + '<td style="white-space:nowrap">' + (r.tgl ? Utils.formatDate(r.tgl,'dd/mm/yyyy') : '-') + '</td>'
          + '<td style="font-weight:600">' + (r.nama||'-') + '</td>'
          + '<td><span class="badge badge-neutral">' + (r.type||'-') + '</span></td>'
          + '<td class="num" style="font-weight:700">' + Utils.formatRupiah(r.jumlah||0) + '</td>'
          + '<td><span class="badge ' + (r.status==='DONE'?'badge-success':'badge-warning') + '">' + (r.status||'-') + '</span></td>'
          + '</tr>';
      });
    }
    return h + '</tbody></table></div></div>';
  }

  function _renderLowStockCard(lowStock) {
    const nav = "App.navigate(\'inventory\')";
    // Auto-PO Suggestion: hitung saran qty & total estimasi nilai
    // Formula: target restock = max(stokMin × 2, stokMin + 7 days safety stock)
    //          suggested qty = target - currentStok (clamp to >= ceil(stokMin))
    const suggestions = lowStock.map(p => {
      const stok = +(p._stok||p.balance||0);
      const min  = +(p.stokMin||0);
      const harga = +(p.harga||p.hargaSatuan||p._weightedAvgPrice||p._hargaTerbaru||0);
      // Default safety multiplier: 2× minimum (bisa di-tune nanti per item)
      const target = Math.max(min * 2, min + Math.ceil(min * 0.5));
      const suggested = Math.max(Math.ceil(min), target - stok);
      return { ...p, _stok: stok, _min: min, _harga: harga, _suggested: suggested, _estCost: suggested * harga };
    });
    const totalEstCost = suggestions.reduce((s, x) => s + (x._estCost || 0), 0);
    const totalQty = suggestions.reduce((s, x) => s + (x._suggested || 0), 0);

    let h = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:rgba(245,158,11,.1);display:flex;align-items:center;justify-content:center;font-size:15px">🛒</div>'
      + '<div><div style="font-size:14px;font-weight:700">Stok Menipis · Saran PO</div>'
      + '<div style="font-size:11px;color:var(--text-3)">' + lowStock.length + ' item perlu di-restock'
      + (totalQty > 0 ? ' · estimasi <strong style="color:var(--warning)">' + Utils.formatRupiah(totalEstCost) + '</strong>' : '')
      + '</div></div></div>'
      + '<button class="btn btn-ghost btn-sm" onclick="' + nav + '">Lihat →</button>'
      + '</div><div style="padding:8px 12px">';
    if (!suggestions.length) {
      h += '<div style="text-align:center;padding:30px;color:var(--success);font-weight:600">Semua stok aman ✅</div>';
    } else {
      suggestions.slice(0,8).forEach(function(p,i) {
        const stok = p._stok;
        h += '<div onclick="' + nav + '" style="display:flex;align-items:center;justify-content:space-between;padding:10px 8px;border-radius:8px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s;gap:8px" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'">'
          + '<div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">'
          + '<span style="font-size:10px;color:var(--text-3);font-weight:700;width:20px;flex-shrink:0">' + (i+1) + '</span>'
          + '<div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + p.nama + '">' + p.nama + '</div>'
          + '<div style="font-size:10px;color:var(--text-3)">Stok: <strong style="color:' + (stok<=0?'#ef4444':'#f59e0b') + '">' + stok + '</strong> · Min: ' + p._min + ' ' + (p.satuan||'') + '</div></div></div>'
          + '<div style="text-align:right;flex-shrink:0">'
          + '<div style="font-size:11px;font-weight:700;color:var(--primary);font-family:var(--font-mono)">+' + p._suggested + ' ' + (p.satuan||'') + '</div>'
          + (p._estCost > 0 ? '<div style="font-size:9px;color:var(--text-3);font-family:var(--font-mono)">~' + Utils.formatRupiah(p._estCost, true) + '</div>' : '')
          + '</div>'
          + '</div>';
      });
    }
    return h + '</div></div>';
  }

  function _renderHutangTable(topHutang) {
    const nav = "App.navigate(\'employee\')";
    let h = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-top:var(--s5);box-shadow:0 1px 4px rgba(0,0,0,.08)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:8px;background:rgba(245,158,11,.1);display:flex;align-items:center;justify-content:center;font-size:15px">💳</div>'
      + '<div style="font-size:14px;font-weight:700">Hutang Karyawan Terbesar</div></div>'
      + '<button class="btn btn-ghost btn-sm" onclick="' + nav + '">Lihat →</button>'
      + '</div><div class="table-scroll"><table class="table">'
      + '<thead><tr><th>#</th><th>Nama</th><th>Divisi</th><th class="num">Sisa Hutang</th></tr></thead><tbody>';
    topHutang.forEach(function(e,i) {
      h += '<tr style="cursor:pointer" onclick="' + nav + '">'
        + '<td class="text-muted">' + (i+1) + '</td>'
        + '<td style="font-weight:700">' + e.nama + '</td>'
        + '<td><span class="badge badge-neutral">' + (e.divisi||'-') + '</span></td>'
        + '<td class="num" style="color:var(--warning);font-weight:700;font-family:var(--font-mono)">' + Utils.formatRupiah(e.sisaHutang) + '</td>'
        + '</tr>';
    });
    return h + '</tbody></table></div></div>';
  }



  return { init, refresh, openWidgetEditor, _saveW, _resetW };
})();
window.DashboardModule = DashboardModule;
