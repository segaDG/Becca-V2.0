/* ============================================
   @updated: 2026-03-19T05:29:27.116Z
   BECCA V2.0 — Account Payable Module
============================================ */
const APModule = (() => {
  let _ap = [];
  let _suppliers = [];
  let _apPage = 1;
  let _apPerPage = parseInt(localStorage.getItem('becca_ap_perPage')||'50');

  async function init() {
    const page = document.getElementById('page-ap');
    // Inject hover CSS
    if (!document.getElementById('ap-hover-style')) {
      const st = document.createElement('style');
      st.id = 'ap-hover-style';
      st.textContent = '#ap-main-table tbody tr:hover{filter:brightness(1.08);cursor:pointer}';
      document.head.appendChild(st);
    }
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Account Payable</h2>
          <p>Transaksi hutang dan tagihan vendor/supplier</p>
        </div>
        <div class="page-header-right" id="ap-header-actions"></div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" id="ap-tab-btn-list"     onclick="APModule.switchTab('list')">📋 Transaksi AP</button>
        <button class="tab-btn"        id="ap-tab-btn-payment"  onclick="APModule.switchTab('payment')">💳 Vendor AP Payment</button>
        <button class="tab-btn"        id="ap-tab-btn-summary"  onclick="APModule.switchTab('summary')">📊 Summary</button>
        <button class="tab-btn"        id="ap-tab-btn-supplier" onclick="APModule.switchTab('supplier')">🏭 Supplier</button>
      </div>
      <div id="ap-tab-list"></div>
      <div id="ap-tab-payment" class="hidden"></div>
      <div id="ap-tab-summary" class="hidden"></div>
      <div id="ap-tab-supplier" class="hidden"></div>
    `;
    Promise.all([DB.getAP().catch(()=>[]), DB.getSuppliers().catch(()=>[])]).then(([ap, sup]) => {
      _ap        = ap;
      _ap.sort((a,b)=>((b.tgl_transaksi||b.tgl||'')).localeCompare((a.tgl_transaksi||a.tgl||'')));
      _suppliers = sup;
      switchTab('list');
    });
  }

  let _activeTab  = 'list';
  let _apEditId   = null;
  let _apLocked   = new Set();
  const _AP_LOCK_KEY = 'becca_ap_locked_ids';

  function switchTab(tab) {
    _activeTab = tab;
    ['list','payment','summary','supplier'].forEach(t => {
      const el  = document.getElementById('ap-tab-'+t);
      const btn = document.getElementById('ap-tab-btn-'+t);
      if (el)  el.classList.toggle('hidden', t !== tab);
      if (btn) btn.classList.toggle('active', t === tab);
    });
    const hdr = document.getElementById('ap-header-actions');
    if (hdr) {
      if (tab === 'list' && Auth.can('ap','edit')) {
        hdr.innerHTML = '<button class="btn btn-primary" onclick="APModule.openModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg> Tambah AP</button>';
      } else if (tab === 'supplier' && Auth.can('ap','edit')) {
        hdr.innerHTML = '<button class="btn btn-primary" onclick="APModule.openAddSupplierModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg> Tambah Supplier</button>';
      } else if (tab === 'payment') {
        hdr.innerHTML = '';
      } else if (tab === 'summary') {
        hdr.innerHTML = '';
      } else {
        hdr.innerHTML = '';
      }
    }
    if (tab === 'list')     { UndoRedo.setActive('ap'); render(); }
    if (tab === 'payment')  renderVAP();
    if (tab === 'summary')  renderSummaryAP();
    if (tab === 'supplier') renderSuppliers();
  }


  function render() {
    const canEdit = Auth.can('ap','edit');
    const today   = new Date().toISOString().split('T')[0];
    const BL      = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const sorted  = [..._ap].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));

    const totalHutang  = _ap.filter(r=>r.status!=='LUNAS').reduce((s,r)=>s+(r.total||0)-(r.terbayar||0),0);
    const totalLunas   = _ap.filter(r=>r.status==='LUNAS').reduce((s,r)=>s+(r.total||0),0);
    const totalTagihan = _ap.reduce((s,r)=>s+(r.total||0),0);

    // Month options
    const months = [...new Set(sorted.map(r=>r.tgl?.substring(0,7)).filter(Boolean))].sort().reverse();
    const monthOpts = months.map(m=>{
      const [y,mo]=m.split('-');
      return '<option value="'+m+'">'+BL[parseInt(mo)]+' '+y+'</option>';
    }).join('');

    // Supplier options
    const supOpts = [...new Set(sorted.map(r=>r.supplier).filter(Boolean))].sort()
      .map(s=>'<option value="'+s+'">'+s+'</option>').join('');

    // Color per supplier
    const COLORS = [
      {bg:'rgba(99,102,241,.07)',bar:'#6366f1'},
      {bg:'rgba(16,185,129,.07)',bar:'#10b981'},
      {bg:'rgba(245,158,11,.07)',bar:'#f59e0b'},
      {bg:'rgba(236,72,153,.07)',bar:'#ec4899'},
      {bg:'rgba(59,130,246,.07)',bar:'#3b82f6'},
      {bg:'rgba(239,68,68,.07)', bar:'#ef4444'},
    ];
    const supList = [...new Set(sorted.map(r=>r.supplier).filter(Boolean))].sort();
    const supColor = {};
    supList.forEach((s,i)=>{ supColor[s]=COLORS[i%COLORS.length]; });

    const el = document.getElementById('ap-tab-list');
    el.innerHTML = `
      <!-- STATS CARDS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--s3);margin-bottom:var(--s5)">
        ${[
          {l:'Sisa Hutang',    v:Utils.formatRupiah(totalHutang,true),  c:'#ef4444', ic:'⚠️', sub:_ap.filter(r=>r.status!=='LUNAS').length+' tagihan belum lunas', click:true},
          {l:'Sudah Dibayar',  v:Utils.formatRupiah(totalLunas,true),   c:'#10b981', ic:'✅', sub:_ap.filter(r=>r.status==='LUNAS').length+' transaksi lunas'},
          {l:'Total AP',       v:Utils.formatRupiah(totalTagihan,true),  c:'#6366f1', ic:'📋', sub:sorted.length+' total transaksi'},
          {l:'Supplier Aktif', v:_suppliers.length+' supplier',          c:'#f59e0b', ic:'🏭', sub:supList.length+' supplier punya tagihan'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;position:relative;overflow:hidden${s.click?';cursor:pointer':''}"${s.click?' onclick="APModule.filterBelum()"':''}>
            <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${s.c};border-radius:4px 0 0 4px"></div>
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">${s.l}</div>
            <div style="font-size:20px;font-weight:800;color:${s.c};font-family:var(--font-mono);letter-spacing:-.02em">${s.v}</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:4px">${s.sub}</div>
          </div>`).join('')}
      </div>

      <!-- FILTER BAR -->
      <div style="display:flex;gap:8px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin-bottom:var(--s4);flex-wrap:wrap">
        <span style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">🔍 Filter</span>
        <input type="date" id="ap-fil-from" class="form-control" style="width:128px;height:28px;font-size:11px" title="Dari" onchange="APModule.applyFilter()">
        <span style="font-size:11px;color:var(--text-3)">—</span>
        <input type="date" id="ap-fil-to" class="form-control" style="width:128px;height:28px;font-size:11px" title="Sampai" onchange="APModule.applyFilter()">
        <select id="ap-fil-bulan" class="form-control" style="width:110px;height:28px;font-size:11px" onchange="APModule.applyFilter()">
          <option value="">Semua Bulan</option>${monthOpts}
        </select>
        <select id="ap-fil-sup" class="form-control" style="width:150px;height:28px;font-size:11px" onchange="APModule.applyFilter()">
          <option value="">Semua Supplier</option>${supOpts}
        </select>
        <select id="ap-fil-status" class="form-control" style="width:110px;height:28px;font-size:11px" onchange="APModule.applyFilter()">
          <option value="">Semua Status</option>
          <option value="LUNAS">✅ Lunas</option>
          <option value="BELUM">⏳ Belum Bayar</option>
        </select>
        <button onclick="APModule.resetFilter()" class="filter-reset-btn" id="ap-reset-btn">↺</button>
        <button onclick="APModule.reArrangeAP()" title="Urutkan" style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text-3);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M3 6h18M3 12h12M3 18h6"/></svg>Re-arrange</button>
        <button onclick="UndoRedo.undo('ap')" title="Undo (Ctrl+Z)" style="height:30px;width:30px;min-width:30px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:13px;${UndoRedo.canUndo('ap')?'':'opacity:.3;pointer-events:none'}">↩</button>
        <button onclick="UndoRedo.redo('ap')" title="Redo (Ctrl+Shift+Z)" style="height:30px;width:30px;min-width:30px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:13px;${UndoRedo.canRedo('ap')?'':'opacity:.3;pointer-events:none'}">↪</button>
        <span id="ap-count-label" style="margin-left:auto;font-size:11px;color:var(--text-3);white-space:nowrap"></span>
      </div>
      </div>

      <!-- TABLE -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain">
          <table style="width:100%;border-collapse:collapse;min-width:900px" id="ap-main-table">
            <thead>
              <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
                <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:36px">#</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);white-space:nowrap;width:88px">Tanggal</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);min-width:130px">Supplier</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);min-width:200px">Item Description</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:70px">Qty</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:70px">Satuan</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:100px">Harga/Item</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:100px">Total</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:100px">Tgl Bayar</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:110px">Kode Aktivitas</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:82px;white-space:nowrap">Jth Tempo</th>
                <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:72px">Status</th>
                ${canEdit?'<th style="padding:10px 12px;width:56px"></th>':''}
              </tr>
            </thead>
            <tbody id="ap-tbody"><tr><td colspan="13" style="text-align:center;padding:48px;color:var(--text-3)">Memuat data...</td></tr></tbody>
          </table>
        </div>
        <!-- Footer total -->
        <div id="ap-footer-total" style="border-top:2px solid var(--border);background:var(--surface2);padding:10px 16px;display:flex;gap:var(--s5);justify-content:flex-end;font-size:12px;font-family:var(--font-mono)"></div>
      </div>
    `;

    // Initial render rows
    setTimeout(() => APModule.applyFilter(), 10);
  }


  function filterBelum() {
    const el = document.getElementById('ap-fil-status');
    if (el) { el.value = 'BELUM'; applyFilter(); }
    const tb = document.getElementById('ap-main-table');
    if (tb) tb.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function applyFilter() {
    const from   = document.getElementById('ap-fil-from')?.value  || '';
    const to     = document.getElementById('ap-fil-to')?.value    || '';
    const bulan  = document.getElementById('ap-fil-bulan')?.value || '';
    const sup    = document.getElementById('ap-fil-sup')?.value   || '';
    const status = document.getElementById('ap-fil-status')?.value|| '';

    let data = [..._ap];

    if (from)   data = data.filter(r => (r.tgl_transaksi||r.tgl||'') >= from);
    if (to)     data = data.filter(r => (r.tgl_transaksi||r.tgl||'') <= to);
    if (bulan)  data = data.filter(r => (r.tgl_transaksi||r.tgl||'').substring(0,7) === bulan);
    if (sup)    data = data.filter(r => r.supplier_id === sup || (r.vendor||'').toLowerCase().includes(sup.toLowerCase()));
    if (status) data = data.filter(r => r.status === status);

    const total = data.length;
    const totalPg = Math.max(1, Math.ceil(total / _apPerPage));
    if (_apPage > totalPg) _apPage = totalPg;
    const paged = data.slice((_apPage-1)*_apPerPage, _apPage*_apPerPage);

    const countEl = document.getElementById('ap-count');
    if (countEl) countEl.textContent = total + ' transaksi';
    const apReset = document.getElementById('ap-reset-btn');
    if (apReset) { if (from||to||bulan||sup||status) apReset.classList.add('active'); else apReset.classList.remove('active'); }

    // Pagination bar
    let pgEl = document.getElementById('ap-pagination');
    if (!pgEl) {
      pgEl = document.createElement('div'); pgEl.id = 'ap-pagination';
      pgEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-top:1px solid var(--border);font-size:11px;color:var(--text-3)';
      const tbl = document.getElementById('ap-main-table');
      if (tbl) tbl.parentNode.insertBefore(pgEl, tbl.nextSibling);
    }
    pgEl.innerHTML = `
      <span>Hal ${_apPage}/${totalPg} &middot; ${total} baris</span>
      <div style="display:flex;align-items:center;gap:4px">
        <select onchange="APModule.setApPerPage(+this.value)" style="padding:3px 6px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);font-size:11px;cursor:pointer">
          ${[20,50,100,200].map(n=>`<option value="${n}" ${_apPerPage===n?'selected':''}>${n}/hal</option>`).join('')}
        </select>
        <button onclick="APModule.goApPage(${_apPage-1})" ${_apPage<=1?'disabled':''} style="padding:3px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);cursor:pointer;font-size:11px">&#8249;</button>
        <button onclick="APModule.goApPage(${_apPage+1})" ${_apPage>=totalPg?'disabled':''} style="padding:3px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);cursor:pointer;font-size:11px">&#8250;</button>
      </div>`;

    const tbody = document.getElementById('ap-tbody');
    if (!tbody) return;

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--text-3)">Tidak ada data AP</td></tr>';
      _updateSummaryCards(data);
      return;
    }

    const canEdit = Auth.can('ap','edit');
    const tdL = 'padding:8px 16px;font-size:11px;color:var(--text-2)';
    const tdR = 'padding:8px 16px;font-size:11px;color:var(--text-3);text-align:right;font-family:var(--font-mono)';
    const tdC = 'padding:8px 16px;font-size:11px;text-align:center';

    const fmtDate = (d) => {
      if (!d) return '-';
      const p = String(d).substring(0,10).split('-');
      return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : d;
    };

    tbody.innerHTML = paged.map((r, i) => {
      const sisa = (r.status==='LUNAS'||r.status==='lunas') ? 0
                 : (r.total||0)-(r.jumlah_bayar||r.terbayar||0);
      const badgeC = r.status==='LUNAS' ? '#10b981' : '#ef4444';
      const badge  = '<span style="background:'+badgeC+'15;color:'+badgeC+';padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">'+r.status+'</span>';
      const acts = canEdit
  ? '<td style="padding:8px 16px;text-align:center"><div style="display:flex;gap:4px;justify-content:center">'
          +'<button onclick="APModule.apStartEdit(this.dataset.id)" data-id="'+r.id+'" style="padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:10px" title="Edit">✏️</button>'
          +'<button onclick="APModule._deleteAP(this.dataset.id)" data-id="'+r.id+'" style="padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:10px" title="Hapus">🗑️</button>'
    +'</div></td>'
  : '<td></td>';

      return '<tr id="ap-row-'+r.id+'" style="border-bottom:.5px solid var(--border)">'
        +'<td style="'+tdR+';width:36px">'+( i+1)+'</td>'
        +'<td style="'+tdL+';white-space:nowrap">'+fmtDate(r.tgl_transaksi||r.tgl)+'</td>'
        +'<td style="'+tdL+'">'+(r.vendor||r.supplier||r.supplier_nama||'-')+'</td>'
        +'<td style="'+tdL+'">'+(r.item||r.keterangan||'-')+'</td>'
        +'<td style="'+tdR+'">'+(r.qty ? Number(r.qty).toLocaleString('id-ID') : '-')+'</td>'
        +'<td style="'+tdL+'">'+(r.satuan||'-')+'</td>'
        +'<td style="'+tdR+'">'+((r.hargaSatuan||r.harga_satuan) ? Utils.formatRupiah(r.hargaSatuan||r.harga_satuan) : '-')+'</td>'
        +'<td style="'+tdR+';font-weight:600">'+Utils.formatRupiah(r.total)+'</td>'
        +'<td style="'+tdL+';white-space:nowrap">'+(r.tgl_bayar||'-')+'</td>'
        +'<td style="'+tdL+'">'+(r.kodeAktivitas||'-')+'</td>'
        +'<td style="'+tdC+'">'+(r.jatuhTempo||'-')+'</td>'
        +'<td style="'+tdC+'">'+badge+'</td>'
        +acts
        +'</tr>';
    }).join('');

    _updateSummaryCards(data);
  }


  function _updateSummaryCards(data) {
    const el = document.getElementById('ap-footer-total');
    if (!el) return;
    const totalAP    = data.reduce((s, r) => s + (r.total || 0), 0);
    const totalLunas = data.filter(r => r.status === 'LUNAS' || r.status === 'lunas')
                           .reduce((s, r) => s + (r.total || 0), 0);
    const totalBelum = totalAP - totalLunas;
    el.innerHTML =
      '<span style="color:var(--text-3)">Total: <b style="color:var(--heading)">' + Utils.formatRupiah(totalAP) + '</b></span>' +
      '<span style="color:#10b981">Lunas: <b>' + Utils.formatRupiah(totalLunas) + '</b></span>' +
      '<span style="color:#ef4444">Belum Lunas: <b>' + Utils.formatRupiah(totalBelum) + '</b></span>';
  }

  function resetFilter() {
    ['ap-fil-from','ap-fil-to','ap-fil-bulan','ap-fil-sup','ap-fil-status'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.value='';
    });
    _apPage = 1;
    applyFilter();
  }
  function goApPage(p) { _apPage = Math.max(1,p); applyFilter(); }
  function setApPerPage(n) { _apPerPage = n; localStorage.setItem('becca_ap_perPage',n); _apPage = 1; applyFilter(); }


  function openModal(editId = null) {
    const existing = editId ? _ap.find(r => r.id === editId) : null;
    const d = existing || { tgl: Utils.today ? Utils.today() : '', status: 'BELUM' };
    const suppOpts = _suppliers.map(s => `<option value="${s.nama}" ${d.supplier===s.nama?'selected':''}>${s.nama}</option>`).join('');
    const mid = Utils.uid(); Modal.open({ id: mid,
      title: editId ? 'Edit AP' : 'Tambah Account Payable',
      body: `
        <form id="ap-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tanggal <span class="req">*</span></label>
              <input name="tgl" type="date" class="form-control" value="${d.tgl||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Jatuh Tempo</label>
              <input name="jatuhTempo" type="date" class="form-control" value="${d.jatuhTempo||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Supplier <span class="req">*</span></label>
            <select name="supplier" class="form-control" required>
              <option value="">— Pilih Supplier —</option>
              ${suppOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Keterangan / Item</label>
            <input name="keterangan" class="form-control" placeholder="Nama barang / keterangan" value="${d.keterangan||d.ket||''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Qty</label>
              <input name="qty" type="number" min="0" class="form-control" value="${d.qty||0}"
                oninput="(function(){const q=parseFloat(this.value)||0;const h=parseFloat(document.querySelector('[name=hargaSatuan]')?.value)||0;const t=document.querySelector('[name=total]');if(t)t.value=q*h;}).call(this)">
            </div>
            <div class="form-group">
              <label class="form-label">Satuan</label>
              <input name="satuan" class="form-control" placeholder="Pcs, Kg, Ltr..." value="${d.satuan||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Harga Satuan (Rp)</label>
              <input name="hargaSatuan" type="number" min="0" class="form-control" value="${d.hargaSatuan||0}"
                oninput="(function(){const h=parseFloat(this.value)||0;const q=parseFloat(document.querySelector('[name=qty]')?.value)||0;const t=document.querySelector('[name=total]');if(t)t.value=q*h;}).call(this)">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Total (Rp)</label>
              <input name="total" type="number" min="0" class="form-control" value="${d.total||0}">
            </div>
            <div class="form-group">
              <label class="form-label">Terbayar (Rp)</label>
              <input name="terbayar" type="number" min="0" class="form-control" value="${d.terbayar||0}">
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-control">
                <option value="BELUM"   ${(d.status||'BELUM')==='BELUM'  ?'selected':''}>⏳ Belum</option>
                <option value="CICILAN" ${d.status==='CICILAN'?'selected':''}>🔸 Cicilan</option>
                <option value="LUNAS"   ${d.status==='LUNAS'  ?'selected':''}>✅ Lunas</option>
              </select>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="APModule._submit('${mid}','${editId||''}')">Simpan</button>
      `,
    });
    return mid;
  }

  function openSupplierModal(editSuppId=null) {
    const editSupp = editSuppId ? _suppliers.find(s=>s.id===editSuppId) : null;
    const mid = Utils.uid();

    function _buildSupList() {
      if (!_suppliers.length) return '<div style="text-align:center;padding:20px;color:var(--text-3)">Belum ada supplier</div>';
      return _suppliers.map(s => `
        <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:10px 12px;margin-bottom:8px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between">
            <div>
              <div style="font-weight:700;font-size:13px">${s.nama||'-'}</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:2px">
                ${s.alamat ? '<span>📍 '+s.alamat+'</span> · ' : ''}
                ${s.noHp   ? '<span>📞 '+s.noHp+'</span> · '   : ''}
                ${s.email  ? '<span>✉️ '+s.email+'</span>'      : ''}
              </div>
              ${s.bank||s.noRek ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">
                🏦 ${s.bank||''} ${s.noRek||''}
              </div>` : ''}
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" onclick="APModule.openSupplierModal('${s.id}')">Edit</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="APModule._deleteSupplier('${s.id}')">Hapus</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    Modal.open({ id: mid,
      title: editSupp ? 'Edit Supplier' : 'Kelola Supplier',
      size: 'modal-lg',
      body: editSupp ? `
        <form id="sup-edit-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Supplier <span class="req">*</span></label>
              <input name="nama" class="form-control" value="${editSupp.nama||''}" required>
            </div>
            <div class="form-group" style="max-width:120px">
              <label class="form-label">Kode Supplier</label>
              <input name="supplierCode" class="form-control" value="${editSupp.supplierCode||''}" placeholder="01, 02...">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">No. HP / Telepon</label>
              <input name="noHp" class="form-control" value="${editSupp.noHp||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Bidang / Kategori</label>
              <input name="kategori" class="form-control" value="${editSupp.kategori||''}" placeholder="Contoh: Bahan Baku, Kemasan, Jasa">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Kota</label>
              <input name="kota" class="form-control" value="${editSupp.kota||''}">
            </div>
            <div class="form-group" style="flex:2">
              <label class="form-label">Alamat</label>
              <input name="alamat" class="form-control" value="${editSupp.alamat||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Bank</label>
              <input name="bank" class="form-control" value="${editSupp.bank||''}" placeholder="BCA, Mandiri, BNI...">
            </div>
            <div class="form-group">
              <label class="form-label">No. Rekening</label>
              <input name="noRek" class="form-control" value="${editSupp.noRek||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Atas Nama Rekening</label>
              <input name="atasNama" class="form-control" value="${editSupp.atasNama||''}">
            </div>
            <div class="form-group">
              <label class="form-label">NPWP</label>
              <input name="npwp" class="form-control" value="${editSupp.npwp||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Catatan</label>
            <textarea name="catatan" class="form-control" rows="2">${editSupp.catatan||''}</textarea>
          </div>
        </form>
      ` : `
        <!-- Daftar supplier -->
        <div style="max-height:300px;overflow-y:auto;margin-bottom:var(--s4)" id="sup-list-wrap">
          ${_buildSupList()}
        </div>
        <!-- Form tambah baru -->
        <div style="border-top:1px solid var(--border);padding-top:var(--s4)">
          <div style="font-weight:600;font-size:13px;margin-bottom:var(--s3)">+ Tambah Supplier Baru</div>
          <form id="sup-add-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nama <span class="req">*</span></label>
                <input name="nama" id="new-sup-name" class="form-control" placeholder="Nama supplier" required>
              </div>
              <div class="form-group">
                <label class="form-label">No. HP</label>
                <input name="noHp" class="form-control" placeholder="08xx">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bank</label>
                <input name="bank" class="form-control" placeholder="BCA, Mandiri...">
              </div>
              <div class="form-group">
                <label class="form-label">No. Rekening</label>
                <input name="noRek" class="form-control">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Alamat</label>
              <input name="alamat" class="form-control" placeholder="Alamat supplier">
            </div>
          </form>
        </div>
      `,
      footer: editSupp ? `
        <button class="btn btn-ghost" onclick="APModule.openSupplierModal()">← Kembali</button>
        <button class="btn btn-primary" onclick="APModule._saveEditSupplier('${mid}','${editSuppId}')">Simpan</button>
      ` : `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
        <button class="btn btn-primary" onclick="APModule._addSupplierFull('${mid}')">+ Tambah Supplier</button>
      `,
    });
  }


  async function _addSupplierFull(mid) {
    const form = document.getElementById('sup-add-form');
    const fd   = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!data.nama?.trim()) { Notify.warning('Nama supplier wajib diisi'); return; }
    try {
      const saved = await DB.saveSupplier({ ...data, nama: data.nama.trim() });
      _suppliers.push(saved);
      render();
      Modal.close(mid);
      Notify.success('Supplier ditambahkan: ' + saved.nama);
      DB.logActivity({ type: 'add_supplier', detail: 'Supplier baru: ' + saved.nama });
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  async function _saveEditSupplier(mid, editId) {
    const form = document.getElementById('sup-edit-form');
    const fd   = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!data.nama?.trim()) { Notify.warning('Nama supplier wajib diisi'); return; }
    try {
      const existing = _suppliers.find(s => s.id === editId);
      if (!existing) { Notify.error('Supplier tidak ditemukan'); return; }
      const updated  = { ...existing, ...data, nama: data.nama.trim() };
      await DB.saveSupplier(updated);
      const idx = _suppliers.findIndex(s => s.id === editId);
      if (idx >= 0) _suppliers[idx] = updated;
      render();
      Modal.close(mid);
      Notify.success('Supplier diperbarui: ' + updated.nama);
      DB.logActivity({ type: 'edit_supplier', detail: 'Edit supplier: ' + updated.nama });
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  async function _addSupplier() {
    const nama = document.getElementById('new-sup-name').value.trim();
    if (!nama) return;
    const saved = await DB.saveSupplier({ nama });
    _suppliers.push(saved);
    document.getElementById('sup-list-wrap')?.insertAdjacentHTML('beforeend', `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <span>${saved.nama}</span>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="APModule._deleteSupplier('${saved.id}')">Hapus</button>
      </div>
    `);
    document.getElementById('new-sup-name').value = '';
  }

  async function _deleteAP(id) {
    const deleted = _ap.find(r => r.id === id);
    if (!deleted) return;
    _ap = _ap.filter(r => r.id !== id);
    render();
    const t = setTimeout(() => {
      DB.deleteAP(id).catch(()=>{});
      DB.logActivity({type:'delete_ap', detail:'AP dihapus: '+deleted.supplier});
    }, 5000);
    Notify.undo('AP dihapus', () => {
      clearTimeout(t);
      _ap.unshift(deleted);
      render();
      Notify.success('Undo berhasil');
    });
  }

  async function _deleteSupplier(id) {
    try {
      await DB.deleteSupplier(id);
      _suppliers = _suppliers.filter(s => s.id !== id);
      render();
      Notify.success('Supplier dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  async function _submit(modalId, editId='') {
    const fd   = new FormData(document.getElementById('ap-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.supplier) { Notify.warning('Supplier wajib diisi'); return; }
    data.total       = parseFloat(data.total)       || 0;
    data.terbayar    = parseFloat(data.terbayar)    || 0;
    data.qty         = parseFloat(data.qty)         || 0;
    data.hargaSatuan = parseFloat(data.hargaSatuan) || 0;
    // Normalize keterangan field
    if (!data.keterangan) data.keterangan = data.ket || '';
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveAP(data);
      const idx   = _ap.findIndex(r => r.id === saved.id);
      if (idx >= 0) _ap[idx] = saved; else _ap.unshift(saved);
      render();
      Modal.close(modalId);
      Notify.success(editId ? 'AP berhasil diperbarui!' : 'AP baru ditambahkan!');
      DB.logActivity({type:editId?'edit_ap':'add_ap',detail:`AP Supplier: ${data.supplier}`});
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  /* ===================== SUPPLIER PAGE ===================== */
  function renderSuppliers() {
    const el = document.getElementById('ap-tab-supplier');
    if (!el) return;

    // Stats
    const totalSup  = _suppliers.length;
    const supWithAP = _suppliers.filter(s => _ap.some(a => a.supplier===s.nama)).length;

    el.innerHTML = `
      <!-- Stats -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
          {l:'Total Supplier', v:totalSup+' supplier',       c:'var(--primary-h)'},
          {l:'Punya Tagihan',  v:supWithAP+' supplier',      c:'var(--warning)'},
          {l:'Total AP Aktif', v:_ap.filter(a=>a.status!=='LUNAS').length+' tagihan', c:'var(--danger)'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;flex:1 1 150px;min-width:0;max-width:220px">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:16px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>`).join('')}
      </div>

      <!-- Supplier Table -->
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Kode</th>
              <th>Nama Supplier</th>
              <th>Bidang</th>
              <th>No. HP</th>
              <th>Kota</th>
              <th>Bank</th>
              <th>No. Rekening</th>
              <th>Atas Nama</th>
              <th class="num">Total AP</th>
              <th class="num">Sisa Hutang</th>
              ${Auth.can('ap','edit') ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${!_suppliers.length ? `<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-3)">
              Belum ada data supplier. Klik "+ Tambah Supplier" untuk menambahkan.
            </td></tr>` :
            _suppliers.map((s,i) => {
              const apItems    = _ap.filter(a => a.supplier === s.nama);
              const totalAP    = apItems.reduce((sum,a)=>sum+(a.total||0),0);
              const totalBayar = apItems.reduce((sum,a)=>sum+(a.terbayar||0),0);
              const sisa       = totalAP - totalBayar;
              return `<tr style="cursor:pointer" onclick="APModule.showSupplierDetail('${s.id}')"
                onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                <td class="text-muted">${i+1}</td>
                <td style="font-family:var(--font-mono);font-weight:700;text-align:center">${s.supplierCode||'-'}</td>
                <td>
                  <div style="font-weight:700">${s.nama||'-'}</div>
                  ${s.alamat ? `<div style="font-size:11px;color:var(--text-3)">📍 ${s.alamat}</div>` : ''}
                </td>
                <td><span class="badge badge-neutral">${s.data?.bidang||s.kategori||'-'}</span></td>
                <td class="text-muted">${s.kontak||s.data?.hp||s.noHp||'-'}</td>
                <td class="text-muted text-small">${s.data?.kota||s.kota||'-'}</td>
                <td class="text-muted">${s.data?.bank||s.bank||'-'}</td>
        <td class="text-muted">${s.data?.no_rekening||s.noRekening||s.noRek||'-'}</td>
                <td class="text-muted">${s.data?.nama_rekening||s.atasNama||'-'}</td>
                <td class="num" style="font-family:var(--font-mono)">${totalAP>0?Utils.formatRupiah(totalAP,true):'-'}</td>
                <td class="num" style="font-family:var(--font-mono);color:${sisa>0?'var(--danger)':'var(--text-3)'}">
                  ${sisa>0?Utils.formatRupiah(sisa,true):'-'}
                </td>
                ${Auth.can('ap','edit') ? `<td onclick="event.stopPropagation()">
                  <div style="display:flex;gap:4px">
                    <button class="btn-icon" title="Edit" onclick="APModule.openEditSupplierModal('${s.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="btn-icon" title="Hapus" onclick="APModule._deleteSupplier('${s.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function showSupplierDetail(suppId) {
    const s      = _suppliers.find(x => x.id === suppId);
    if (!s) return;
    const apItems    = _ap.filter(a => a.supplier === s.nama);
    const totalAP    = apItems.reduce((sum,a)=>sum+(a.total||0),0);
    const totalBayar = apItems.reduce((sum,a)=>sum+(a.terbayar||0),0);
    const sisa       = totalAP - totalBayar;
    const mid        = Utils.uid();

    Modal.open({ id: mid,
      title: '🏭 Detail Supplier',
      size: 'modal-lg',
      body: `
        <!-- Header supplier -->
        <div style="display:flex;gap:16px;padding:14px 16px;background:var(--surface2);border-radius:var(--r-md);margin-bottom:var(--s4)">
          <div style="width:52px;height:52px;border-radius:10px;background:rgba(99,102,241,.15);
                      color:var(--primary-h);display:flex;align-items:center;justify-content:center;
                      font-size:22px;font-weight:800;flex-shrink:0">
            ${s.nama?.substring(0,1).toUpperCase()||'?'}
          </div>
          <div style="flex:1">
            <div style="font-size:18px;font-weight:700;color:var(--heading)">${s.nama}</div>
            <div style="font-size:12px;color:var(--text-3)">${s.kategori||''} ${s.alamat?'· 📍'+s.alamat:''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;color:var(--text-3)">Sisa Hutang</div>
            <div style="font-size:20px;font-weight:800;color:${sisa>0?'var(--danger)':'var(--success)'};font-family:var(--font-mono)">
              ${Utils.formatRupiah(sisa,true)}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)">
          <!-- Info supplier -->
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">Informasi Supplier</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              ${[
                {l:'No. HP',        v: s.noHp||'-'},
                {l:'Kota',          v: s.kota||'-'},
                {l:'Alamat',        v: s.alamat||'-'},
                {l:'Bank',          v: s.bank||'-'},
                {l:'No. Rekening',  v: s.noRek||'-'},
                {l:'Atas Nama',     v: s.atasNama||'-'},
                {l:'NPWP',          v: s.npwp||'-'},
                {l:'Catatan',       v: s.catatan||'-'},
              ].map(r=>`<tr>
                <td style="padding:6px 8px;color:var(--text-3);border-bottom:1px solid var(--border);width:40%">${r.l}</td>
                <td style="padding:6px 8px;font-weight:500;border-bottom:1px solid var(--border)">${r.v}</td>
              </tr>`).join('')}
            </table>
            <!-- Summary AP -->
            <div style="margin-top:var(--s3);padding:10px 12px;background:var(--surface2);border-radius:var(--r-md)">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:var(--text-3)">Total AP</span>
                <span style="font-family:var(--font-mono)">${Utils.formatRupiah(totalAP)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:var(--text-3)">Total Terbayar</span>
                <span style="font-family:var(--font-mono);color:var(--success)">${Utils.formatRupiah(totalBayar)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;border-top:1px solid var(--border);padding-top:6px;margin-top:4px">
                <span>Sisa Hutang</span>
                <span style="color:${sisa>0?'var(--danger)':'var(--success)'}">${Utils.formatRupiah(sisa)}</span>
              </div>
            </div>
          </div>

          <!-- Riwayat AP -->
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">
              Riwayat AP (${apItems.length} tagihan)
            </div>
            <div style="max-height:320px;overflow-y:auto">
              ${apItems.length ? `
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead><tr style="background:var(--surface2)">
                  <th style="padding:5px 8px;text-align:left;color:var(--text-3)">Tanggal</th>
                  <th style="padding:5px 8px;text-align:left;color:var(--text-3)">Keterangan</th>
                  <th style="padding:5px 8px;text-align:right;color:var(--text-3)">Total</th>
                  <th style="padding:5px 8px;text-align:right;color:var(--text-3)">Sisa</th>
                  <th style="padding:5px 8px;text-align:center;color:var(--text-3)">Status</th>
                </tr></thead>
                <tbody>
                  ${apItems.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')).map(a=>{
                    const sisaA = (a.status==='LUNAS'||a.status==='lunas') ? 0 : (a.total||0)-(a.terbayar||0);
                    const sc    = a.status==='LUNAS'?'badge-success':a.status==='CICILAN'?'badge-warning':'badge-danger';
                    return `<tr>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border);white-space:nowrap">${a.tgl?a.tgl.split('-').reverse().join('/'):'-'}</td>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${a.keterangan||'-'}</td>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--font-mono)">${Utils.formatRupiah(a.total||0)}</td>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--font-mono);color:${sisaA>0?'var(--danger)':'var(--success)'}">${sisaA>0?Utils.formatRupiah(sisaA):'-'}</td>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:center">
                        <span class="badge ${sc}" style="font-size:10px">${a.status||'BELUM'}</span>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>` : `<div style="text-align:center;padding:30px;color:var(--text-3)">Belum ada tagihan AP</div>`}
            </div>
          </div>
        </div>
      `,
      footer: `
        ${Auth.can('ap','edit') ? `<button class="btn btn-ghost" onclick="APModule.openEditSupplierModal('${suppId}');Modal.close('${mid}')">Edit Supplier</button>` : ''}
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
      `,
    });
  }

  function openAddSupplierModal() {
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: '+ Tambah Supplier Baru',
      size: 'modal-lg',
      body: `<form id="sup-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Supplier <span class="req">*</span></label>
            <input name="nama" class="form-control" required placeholder="Nama supplier">
          </div>
          <div class="form-group">
            <label class="form-label">Kategori / Jenis</label>
            <input name="kategori" class="form-control" placeholder="Bahan Baku, Kemasan, Jasa...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">No. HP / Telepon</label>
            <input name="noHp" class="form-control" placeholder="08xx">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input name="email" type="email" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Alamat</label>
          <input name="alamat" class="form-control" placeholder="Alamat lengkap supplier">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Bank</label>
            <input name="bank" class="form-control" placeholder="BCA, Mandiri, BNI...">
          </div>
          <div class="form-group">
            <label class="form-label">No. Rekening</label>
            <input name="noRek" class="form-control">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Atas Nama Rekening</label>
            <input name="atasNama" class="form-control">
          </div>
          <div class="form-group">
            <label class="form-label">NPWP</label>
            <input name="npwp" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="catatan" class="form-control" rows="2" placeholder="Catatan tambahan"></textarea>
        </div>
      </form>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="APModule._submitSupplier('${mid}')">Tambah Supplier</button>
      `,
    });
    setTimeout(() => document.querySelector('#sup-form input')?.focus(), 100);
  }

  function openEditSupplierModal(suppId) {
    const s   = _suppliers.find(x => x.id === suppId);
    if (!s) return;
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: 'Edit Supplier',
      size: 'modal-lg',
      body: `<form id="sup-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Supplier <span class="req">*</span></label>
            <input name="nama" class="form-control" value="${s.nama||''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Kategori / Jenis</label>
            <input name="kategori" class="form-control" value="${s.kategori||''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">No. HP / Telepon</label>
            <input name="noHp" class="form-control" value="${s.noHp||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input name="email" type="email" class="form-control" value="${s.email||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Alamat</label>
          <input name="alamat" class="form-control" value="${s.alamat||''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Bank</label>
            <input name="bank" class="form-control" value="${s.bank||''}">
          </div>
          <div class="form-group">
            <label class="form-label">No. Rekening</label>
            <input name="noRek" class="form-control" value="${s.noRek||''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Atas Nama Rekening</label>
            <input name="atasNama" class="form-control" value="${s.atasNama||''}">
          </div>
          <div class="form-group">
            <label class="form-label">NPWP</label>
            <input name="npwp" class="form-control" value="${s.npwp||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="catatan" class="form-control" rows="2">${s.catatan||''}</textarea>
        </div>
      </form>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="APModule._submitSupplier('${mid}','${suppId}')">Simpan</button>
      `,
    });
  }

  async function _submitSupplier(mid, editId='') {
    const form = document.getElementById('sup-form');
    const fd   = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!data.nama?.trim()) { Notify.warning('Nama supplier wajib diisi'); return; }
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveSupplier(data);
      const idx   = _suppliers.findIndex(s=>s.id===saved.id);
      if (idx>=0) _suppliers[idx]=saved; else _suppliers.push(saved);
      Modal.close(mid);
      Notify.success(editId ? 'Supplier diperbarui!' : 'Supplier "'+data.nama+'" ditambahkan!');
      renderSuppliers();
      DB.logActivity({type:'supplier', detail:(editId?'Edit: ':'Tambah: ')+data.nama});
    } catch(e) { Notify.error('Gagal', e.message); }
  }


  /* ===================== VAP PAYMENT PAGE ===================== */
  function renderVAP() {
    const el = document.getElementById('ap-tab-payment');
    if (!el) return;
    const BL = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const allMonths = [...new Set(_ap.map(r=>r.tgl?.substring(0,7)).filter(Boolean))].sort().reverse();
    const monthOpts = ['<option value="">Semua (Belum Lunas)</option>',
      ...allMonths.map(m=>{ const[y,mo]=m.split('-'); return '<option value="'+m+'">'+BL[parseInt(mo)]+' '+y+'</option>'; })
    ].join('');

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:10px">
          <span style="font-size:10px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em">Periode</span>
          <select id="vap-fil-bulan" class="form-control" style="width:160px;height:32px;font-size:13px;font-weight:500" onchange="APModule.applyVAPFilter()">
            ${monthOpts}
          </select>
          <select id="vap-fil-status" class="form-control" style="width:140px;height:32px;font-size:13px;font-weight:500" onchange="APModule.applyVAPFilter()">
            <option value="unpaid">Belum Lunas</option>
            <option value="all">Semua Transaksi</option>
          </select>
        </div>
        <button onclick="APModule.printVAP()" style="margin-left:auto;height:42px;padding:0 20px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);cursor:pointer;font-size:12px;font-weight:700;color:var(--text-2);display:flex;align-items:center;gap:8px;transition:all .15s" onmouseover="this.style.background='var(--primary-h)';this.style.color='white';this.style.borderColor='var(--primary-h)'" onmouseout="this.style.background='var(--surface)';this.style.color='var(--text-2)';this.style.borderColor='var(--border)'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Cetak / Print
        </button>
      </div>
      <div id="vap-content"></div>
    `;
    APModule.applyVAPFilter();
  }

  function applyVAPFilter() {
    const bulan  = document.getElementById('vap-fil-bulan')?.value  || '';
    const status = document.getElementById('vap-fil-status')?.value || 'unpaid';
    const el     = document.getElementById('vap-content');
    if (!el) return;

    const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const BL     = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const today  = new Date();
    const todayFmt = today.getDate()+' '+MONTHS[today.getMonth()]+' '+today.getFullYear();

    let data = [..._ap];
    if (bulan)  data = data.filter(r=>r.tgl?.startsWith(bulan));
    if (status==='unpaid') data = data.filter(r=>r.status!=='LUNAS');

    const supGroups = {};
    data.forEach(r=>{ if(!supGroups[r.supplier]) supGroups[r.supplier]=[]; supGroups[r.supplier].push(r); });

    const totalUnpaid = data.reduce((s,r)=>s+(r.total||0)-(r.terbayar||0),0);
    const vendorCount = Object.keys(supGroups).length;

    let periodeLabel = 'Semua Belum Lunas';
    if (bulan) { const[y,m]=bulan.split('-'); periodeLabel=BL[parseInt(m)]+' '+y; }

    // Bold color palette — each vendor gets a strong distinct color
    const COLORS = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#0284c7','#ca8a04'];

    let rowsHtml = '';
    let vIdx = 0;
    Object.entries(supGroups).forEach(([supName, items]) => {
      const sup      = _suppliers.find(s=>s.nama===supName);
      const payable  = items.reduce((s,r)=>s+(r.total||0)-(r.terbayar||0),0);
      if (payable<=0 && status==='unpaid') return;
      const C = COLORS[vIdx % COLORS.length];
      vIdx++;

      // Vendor header — bold colored banner
      rowsHtml +=
        '<tr>'
        +'<td colspan="5" style="padding:0">'
          +'<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:'+C+';color:#fff;margin-top:'+(vIdx>1?'12px':'0')+';border-radius:10px 10px 0 0">'
            +'<div style="display:flex;align-items:center;gap:12px">'
              +'<div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.2);'
                +'font-weight:900;font-size:17px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'
                +supName.trim().substring(0,1).toUpperCase()
              +'</div>'
              +'<div>'
                +'<div style="font-weight:800;font-size:15px;letter-spacing:.01em">'+supName+'</div>'
                +'<div style="font-size:11px;opacity:.75;margin-top:1px">'
                  +(sup?.bank?sup.bank+' · ':'')+(sup?.noRek||'')+(sup?.atasNama?' · '+sup.atasNama:'')
                  +(!sup?.bank&&!sup?.noRek?(sup?.kategori||'Supplier'):'')
                +'</div>'
              +'</div>'
            +'</div>'
            +'<div style="text-align:right">'
              +'<div style="font-family:var(--font-mono);font-size:20px;font-weight:900">'+Utils.formatRupiah(payable)+'</div>'
              +'<div style="font-size:10px;opacity:.7;margin-top:1px">'+items.length+' tagihan</div>'
            +'</div>'
          +'</div>'
        +'</td>'
        +'</tr>';

      // Detail header
      rowsHtml += '<tr style="background:'+C+'12;border-bottom:2px solid '+C+'30">'
        +'<td style="padding:7px 20px;font-size:9px;font-weight:800;color:'+C+';text-transform:uppercase;letter-spacing:.06em;width:35%">ITEM</td>'
        +'<td style="padding:7px 16px;font-size:9px;font-weight:800;color:'+C+';width:14%">TANGGAL</td>'
        +'<td style="padding:7px 16px;font-size:9px;font-weight:800;color:'+C+';width:16%">QTY</td>'
        +'<td style="padding:7px 16px;font-size:9px;font-weight:800;color:'+C+';text-align:right;width:17%">HARGA SAT.</td>'
        +'<td style="padding:7px 16px;font-size:9px;font-weight:800;color:'+C+';text-align:right;width:18%">TOTAL</td>'
        +'</tr>';
      // Detail rows — tinted with vendor color
      items.sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||'')).forEach((r,ri)=>{
        const rowTotal = (r.total||0);
        const tglFmt = r.tgl?r.tgl.split('-').reverse().join('/'):'-';
        const hs    = (r.hargaSatuan||r.harga_satuan) ? Utils.formatRupiah(r.hargaSatuan||r.harga_satuan) : '-';
        const stripe = ri%2 ? C+'0d' : C+'06';
        rowsHtml +=
          '<tr style="background:'+stripe+';border-bottom:1px solid '+C+'15;border-left:3px solid '+C+'">'
          +'<td style="padding:10px 20px;font-size:12px;font-weight:600;color:var(--text)">'+(r.item||r.keterangan||'-')+'</td>'
          +'<td style="padding:10px 16px;font-size:11px;color:var(--text-2)">'+tglFmt+'</td>'
          +'<td style="padding:10px 16px;font-size:11px;color:var(--text-2);font-family:var(--font-mono)">'
            +((r.qty)?Number(r.qty).toLocaleString('id',{minimumFractionDigits:(r.qty)%1?2:0})+' '+((r.satuan||'')||''):'-')
          +'</td>'
          +'<td style="padding:10px 16px;font-size:11px;color:var(--text-2);text-align:right;font-family:var(--font-mono)">'+hs+'</td>'
          +'<td style="padding:10px 16px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:800;color:'+C+';white-space:nowrap">'+Utils.formatRupiah(rowTotal)+'</td>'
          +'</tr>';
      });
    });

    // Grand total
    rowsHtml +=
      '<tr style="border-top:3px solid rgba(0,0,0,.1)">'
      +'<td colspan="4" style="padding:18px 20px">'
        +'<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-2)">Total Payable</div>'
        +'<div style="font-size:11px;color:var(--text-3);margin-top:3px">'+vendorCount+' vendor · '+data.length+' transaksi · '+periodeLabel+'</div>'
      +'</td>'
      +'<td style="padding:18px 20px;text-align:right;white-space:nowrap">'
        +'<div style="font-family:var(--font-mono);font-size:24px;font-weight:900;'
          +'background:linear-gradient(135deg,#ef4444,#dc2626);-webkit-background-clip:text;'
          +'-webkit-text-fill-color:transparent;background-clip:text">'+Utils.formatRupiah(totalUnpaid)+'</div>'
      +'</td>'
      +'</tr>';

    DB.getSettings().then(sets=>{
      const co     = (Array.isArray(sets)?sets[0]:sets)||{};
      const cName  = co.namaPerusahaan || 'BOGA PANGAN SENTOSA';
      const cAddr  = co.alamat  || 'Jl. Baladewa, Blok PB no.1, Perumnas bumi teluk jambe, RT. 006/020 Karawang Barat, Indonesia';
      const cPhone = co.telepon || '(+62)815-7818-1888';
      const cTag   = co.tagline || 'YOUR CATERING SERVICE SOLUTION';

      el.innerHTML = `
        <!-- DOCUMENT CARD -->
        <div id="vap-print-area" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">

          <!-- GRADIENT HEADER -->
          <div style="background:linear-gradient(135deg,#1e1b4b 0%,#4338ca 50%,#7c3aed 100%);padding:18px 28px;position:relative;overflow:hidden">
            <!-- decorative circles -->
            <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
            <div style="position:absolute;bottom:-60px;right:80px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.04)"></div>

            <div style="display:flex;align-items:flex-start;justify-content:space-between;position:relative">
              <!-- Company Info -->
              <div>
                <div style="font-size:22px;font-weight:900;color:white;letter-spacing:.02em;line-height:1.1">${cName}</div>
                <div style="font-size:11px;color:rgba(255,255,255,.6);letter-spacing:.12em;text-transform:uppercase;margin-top:4px;font-weight:500">${cTag}</div>
                <div style="margin-top:8px;font-size:11px;color:rgba(255,255,255,.75);line-height:1.6">${cAddr}<br>${cPhone}</div>
              </div>
              <!-- Date + Total -->
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:10px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Tanggal Cetak</div>
                <div style="font-size:16px;font-weight:800;color:white">${todayFmt}</div>
                <div style="margin-top:10px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:12px 18px;backdrop-filter:blur(8px)">
                  <div style="font-size:10px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.08em;font-weight:600">Total Unpaid</div>
                  <div style="font-family:var(--font-mono);font-size:17px;font-weight:900;color:#fbbf24;margin-top:2px;white-space:nowrap">${Utils.formatRupiah(totalUnpaid)}</div>
                </div>
              </div>
            </div>

            <!-- Doc Title Bar -->
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:space-between">
              <div style="font-size:18px;font-weight:800;color:white;letter-spacing:.06em;text-transform:uppercase">Vendor Account Payable</div>
              <div style="display:flex;gap:20px;font-size:12px;color:rgba(255,255,255,.75);font-weight:500">
                <span>${data.length} Tagihan</span>
                <span>${vendorCount} Vendor</span>
                <span>${periodeLabel}</span>
              </div>
            </div>
          </div>

          <!-- TABLE -->
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain">
            <table style="width:100%;border-collapse:collapse;min-width:680px" id="vap-table">
              <thead>
                <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
                  <th style="padding:11px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">Vendor / Supplier</th>
                  <th style="padding:11px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">Nama Bank</th>
                  <th style="padding:11px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">Bank Account Number</th>
                  <th style="padding:11px 16px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">Atas Nama</th>
                  <th style="padding:11px 16px;text-align:right;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">Total Payable</th>
                </tr>
              </thead>
              <tbody>${rowsHtml||'<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada tagihan belum lunas</td></tr>'}</tbody>
            </table>
          </div>

          <!-- FOOTER -->
          <div style="padding:14px 24px;border-top:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:4px;height:4px;border-radius:50%;background:var(--text-3)"></div>
              <span style="font-size:11px;color:var(--text-3);font-style:italic">Seluruh transaksi telah dicek kebenarannya dan dapat dipertanggung jawabkan</span>
            </div>
            <span style="font-size:11px;color:var(--text-3);font-weight:600">${todayFmt}</span>
          </div>
        </div>
      `;
    }).catch(()=>{});
  }

  function printVAP() {
    const area = document.getElementById('vap-print-area');
    if (!area) { Notify.warning('Buka tab Vendor AP Payment terlebih dahulu'); return; }
    const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const today  = new Date();
    const todayFmt = today.getDate()+' '+MONTHS[today.getMonth()]+' '+today.getFullYear();

    const printCSS = `
      @page { margin: 12mm 14mm; size: A4; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing: border-box; }
      body { margin:0; padding:0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; background: white; }
      table { width: 100%; border-collapse: collapse; }
      .vap-vendor-row td { background: #f8f7ff !important; }
      thead tr { background: #f1f0ff !important; }
      th { padding: 9px 14px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #555; border-bottom: 2px solid #e5e7eb; }
      td { vertical-align: middle; }
      .grad-header { background: linear-gradient(135deg,#1e1b4b 0%,#4338ca 50%,#7c3aed 100%) !important; color: white !important; padding: 22px 26px; }
      @media print { .no-print { display: none !important; } }
    `;

    const cloneEl  = area.cloneNode(true);
    // Remove decorative elements that won't print well
    const deco = cloneEl.querySelectorAll('[style*="position:absolute"]');
    deco.forEach(d => d.remove());

    const w = window.open('','_blank','width=900,height=700');
    if (!w) { Notify.error('Pop-up diblokir', 'Izinkan pop-up untuk mencetak'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>VAP — '+todayFmt+'</title><style>'+printCSS+'</style></head><body>');
    w.document.write(cloneEl.outerHTML);
    w.document.write('<script>setTimeout(()=>{window.print();},400);<\/script></body></html>');
    w.document.close();
  }


  /* ============= AP INLINE EDIT ============= */
  function _apKey(event) {
    const k   = event.key;
    const eid = event.target?.dataset?.eid;
    if (!eid) return;
    if (k === 'Enter')  { event.preventDefault(); APModule._apCommitAndAdd(eid); }
    if (k === 'Escape') { APModule._apCancel(eid); }
  }

  function _apLoadLocks() {
    try { _apLocked = new Set(JSON.parse(localStorage.getItem(_AP_LOCK_KEY)||'[]')); } catch { _apLocked=new Set(); }
  }
  function _apSaveLocks() { localStorage.setItem(_AP_LOCK_KEY, JSON.stringify([..._apLocked])); }

  function _apOutsideClick(e) {
    if (!_apEditId) return;
    if (document.getElementById('_val-popup')) return;
    const tr = document.getElementById('ap-row-'+_apEditId);
    if (tr && !tr.contains(e.target)) {
      // Baris baru kosong → cancel
      const row = _ap.find(r => r.id === _apEditId);
      if (row && row._isNew && !(row.keterangan||'').trim()) {
        _apCancel(_apEditId);
        return;
      }
      _apCommit(_apEditId);
    }
  }

  function apStartEdit(id) {
    if (_apLocked.has(id)) { _apLocked.delete(id); _apSaveLocks(); }
    if (_apEditId === id) return;
    if (_apEditId) _apCommit(_apEditId);
    _apEditId = id;
    const tr = document.getElementById('ap-row-'+id);
    if (!tr) return;
    const row = _ap.find(r=>r.id===id);
    if (!row) return;
    row._orig = JSON.stringify({tgl:row.tgl,supplier:row.supplier,keterangan:row.keterangan,qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,total:row.total,terbayar:row.terbayar,status:row.status,jatuhTempo:row.jatuhTempo,kodeAktivitas:row.kodeAktivitas});
    tr.outerHTML = _apRowEdit(row);
    document.getElementById('ap-row-'+id)?.querySelector('input,select')?.focus();
    setTimeout(() => document.addEventListener('click', _apOutsideClick), 50);
  }

  function _apCommitAndAdd(id) {
    if (!id) return;
    document.removeEventListener('click', _apOutsideClick);
    // Save current, then add new row
    const origEditId = _apEditId;
    _apCommit(id);
    // If commit succeeded (_apEditId is now null), add new row
    if (!_apEditId) apAddRow();
  }

  async function _apCommit(id) {
    if (!id) return;
    document.removeEventListener('click', _apOutsideClick);
    const tr = document.getElementById('ap-row-'+id);
    if (!tr) { _apEditId=null; return; }
    const row = _ap.find(r=>r.id===id);
    if (!row) { _apEditId=null; return; }
    const g = f => tr.querySelector('[data-f="'+f+'"]')?.value ?? row[f];
    const qty = parseFloat(g('qty'))||0;
    const hs  = parseFloat(g('hargaSatuan'))||0;
    const ket = (g('keterangan')||'').trim();
    const sat = (g('satuan')||'').trim();
    const kode = (g('kodeAktivitas')||'').trim();

    // Validasi field wajib
    const missing = [];
    if (!ket)   missing.push('Nama Barang');
    if (!sat)   missing.push('Jenis/Satuan');
    if (!qty)   missing.push('Jumlah');
    if (!hs)    missing.push('Harga');
    if (!kode)  missing.push('Kode Aktivitas');
    if (missing.length) {
      Notify.warning('Lengkapi field: ' + missing.join(', '));
      // Kembalikan listener agar bisa edit lagi
      setTimeout(() => document.addEventListener('click', _apOutsideClick), 50);
      return;
    }

    Object.assign(row, {
      tgl:g('tgl')||row.tgl, supplier:g('supplier')||row.supplier,
      keterangan:ket, qty, satuan:sat,
      hargaSatuan:hs, total:qty&&hs?qty*hs:(parseFloat(g('total'))||row.total||0),
      terbayar:parseFloat(g('terbayar'))||0, status:g('status')||row.status,
      jatuhTempo:g('jatuhTempo')||row.jatuhTempo,
      kodeAktivitas:kode,
    });
    const origData = row._orig ? JSON.parse(row._orig) : null;
    delete row._orig;
    delete row._isNew;
    if (origData) {
      UndoRedo.push('ap', {
        id, before: origData, after: {...row},
        save: async (data) => { const r = _ap.find(x=>x.id===id); if(r) { Object.assign(r,data); await DB.saveAP({...r}); } },
        render: () => applyFilter()
      });
    }
    _apEditId = null;
    try {
      await DB.saveAP(row);
      const logType = row._wasNew ? 'add_ap' : 'edit_ap';
      DB.logActivity({type:logType, detail:(row._wasNew?'AP baru: ':'Edit AP: ')+(row.keterangan||id), rowId:id,
        snapshot:{before:origData, after:{id,tgl:row.tgl,supplier:row.supplier,keterangan:row.keterangan,qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,total:row.total,status:row.status}}});
      if (!_apEditId) applyFilter();
      Notify.success('AP disimpan!');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  function _apCancel(id) {
    document.removeEventListener('click', _apOutsideClick);
    document.getElementById('_val-popup')?.remove();
    const row = _ap.find(r=>r.id===id);
    if (row && row._isNew && !(row.keterangan||'').trim()) {
      _apEditId = null;
      _ap = _ap.filter(r => r.id !== id);
      DB.deleteAP(id).catch(() => {});
      applyFilter();
      Notify.info('Baris baru dibatalkan');
      return;
    }
    document.removeEventListener('click', _apOutsideClick);
    _apEditId = null;
    if (row && row._orig) { const orig=JSON.parse(row._orig); Object.keys(orig).forEach(k=>{ row[k]=orig[k]; }); delete row._orig; }
    applyFilter();
  }

  function _apRowEdit(r) {
    const supOpts = _suppliers.map(s=>'<option value="'+s.nama+'" '+(r.supplier===s.nama?'selected':'')+'>'+s.nama+'</option>').join('');
    const stOpts  = ['BELUM','LUNAS'].map(s=>'<option value="'+s+'" '+(r.status===s?'selected':'')+'>'+s+'</option>').join('');
    const eid = (r.id||'').replace(/'/g,'');
    const inp = (f,v,t,ex) => '<input data-f="'+f+'" data-eid="'+eid+'" type="'+(t||'text')+'" value="'+(v===0?0:v||'')+'" '+(ex||'')+' style="width:100%;border:none;outline:none;background:transparent;padding:0 4px;font-size:12px;font-family:inherit" onkeydown="APModule._apKey(event)">';
    const p = 'padding:6px 8px;';
    return '<tr id="ap-row-'+eid+'" style="background:rgba(99,102,241,.06);outline:2px solid var(--primary);outline-offset:-1px">'
      +'<td style="'+p+'text-align:center"><div style="display:flex;gap:2px;justify-content:center">'
        +'<button onclick="event.stopPropagation();APModule._apCommit(\''+eid+'\')" style="width:20px;height:20px;border-radius:4px;border:1px solid #10b981;background:rgba(16,185,129,.1);cursor:pointer;color:#10b981;font-size:11px;display:flex;align-items:center;justify-content:center" title="Simpan">✓</button>'
        +'<button onclick="event.stopPropagation();APModule._apCancel(\''+eid+'\')" style="width:20px;height:20px;border-radius:4px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);font-size:11px;display:flex;align-items:center;justify-content:center" title="Batal">✕</button>'
      +'</div></td>'
      +'<td style="'+p+'">'+inp('tgl',r.tgl,'date')+'</td>'
      +'<td style="'+p+'"><select data-f="supplier" style="width:100%;border:none;outline:none;background:transparent;font-size:12px;padding:0 4px">'+supOpts+'</select></td>'
      +'<td style="'+p+'">'+inp('keterangan',r.keterangan||r.ket)+'</td>'
      +'<td style="'+p+'">'+inp('qty',r.qty,'number','min=0 style="text-align:right"')+'</td>'
      +'<td style="'+p+'">'+inp('satuan',r.satuan)+'</td>'
      +'<td style="'+p+'">'+inp('hargaSatuan',r.hargaSatuan,'number','min=0')+'</td>'
      +'<td style="'+p+'">'+inp('total',r.total,'number','min=0')+'</td>'
      +'<td style="'+p+'">'+inp('terbayar',r.terbayar,'number','min=0')+'</td>'
      +'<td style="'+p+'">'+inp('kodeAktivitas',r.kodeAktivitas||'')+'</td>'
      +'<td style="'+p+'">'+inp('jatuhTempo',r.jatuhTempo,'date')+'</td>'
      +'<td style="'+p+'"><select data-f="status" style="width:100%;border:none;outline:none;background:transparent;font-size:11px;font-weight:700;padding:0 4px">'+stOpts+'</select></td>'
      +'<td style="'+p+'"></td>'
      +'</tr>';
  }

  async function apAddRow() {
    if (_apEditId) _apCommit(_apEditId);
    const today = new Date().toISOString().split('T')[0];
    const newRow = { tgl:today, supplier:'', keterangan:'', qty:0, satuan:'Pcs', hargaSatuan:0, total:0, terbayar:0, status:'BELUM', jatuhTempo:'' };
    try {
      const saved = await DB.saveAP(newRow);
      _ap.unshift(saved);
      saved._isNew = true;
      applyFilter();
      setTimeout(()=>apStartEdit(saved.id), 60);
    } catch(e) { Notify.error('Gagal',e.message); }
  }


  function _fmtJt(n) {
    if (!n) return '<span style="font-family:var(--font-mono)">Rp 0</span>';
    if (n >= 1e9) return '<span style="font-family:var(--font-mono)">Rp '
      + Math.round(n/1e9).toLocaleString('id')
      + '<sup style="font-size:9px;font-weight:400;color:var(--text-3);font-family:inherit">M</sup></span>';
    if (n >= 1e6) return '<span style="font-family:var(--font-mono)">Rp '
      + Math.round(n/1e6).toLocaleString('id')
      + '<sup style="font-size:9px;font-weight:400;color:var(--text-3);font-family:inherit">jt</sup></span>';
    if (n >= 1e3) return '<span style="font-family:var(--font-mono)">Rp '
      + Math.round(n/1e3).toLocaleString('id')
      + '<sup style="font-size:9px;font-weight:400;color:var(--text-3);font-family:inherit">rb</sup></span>';
    return '<span style="font-family:var(--font-mono)">' + Utils.formatRupiah(n) + '</span>';
  }

  /* ============= AP SUMMARY PER SUPPLIER ============= */
  async function renderSummaryAP() {
    const page = document.getElementById('ap-tab-summary');
    if (!page) return;
    page.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3)">Memuat data summary...</div>';

    const raw = await DB.getAP();
    if (!Array.isArray(raw)) { page.innerHTML = '<div style="padding:40px;text-align:center;color:var(--danger)">Gagal memuat data</div>'; return; }

    // Flatten data field
    const data = raw.map(r => { const f={...r}; if(r.data&&typeof r.data==='object') Object.assign(f,r.data); return f; });

    // --- Aggregate per vendor ---
    const vendorMap = {};
    data.forEach(r => {
      const v = r.vendor || r.supplier_nama || r.keterangan?.split(' | ')[0] || 'Unknown';
      if (!vendorMap[v]) vendorMap[v] = { vendor:v, count:0, total:0, paid:0, unpaid:0, bulanData:{} };
      vendorMap[v].count++;
      vendorMap[v].total += (r.total||0);
      if (r.status==='LUNAS') vendorMap[v].paid += (r.total||0);
      else vendorMap[v].unpaid += (r.total||0);
      // Per bulan
      const bln = (r.tgl_transaksi||r.tgl||'').substring(0,7);
      if (bln) {
        vendorMap[v].bulanData[bln] = (vendorMap[v].bulanData[bln]||0) + (r.total||0);
      }
    });
    const vendors = Object.values(vendorMap).sort((a,b) => b.total - a.total);

    // --- Aggregate per bulan ---
    const bulanMap = {};
    data.forEach(r => {
      const bln = (r.tgl_transaksi||r.tgl||'').substring(0,7);
      if (!bln) return;
      if (!bulanMap[bln]) bulanMap[bln] = { bulan:bln, count:0, total:0, paid:0, vendors:new Set() };
      bulanMap[bln].count++;
      bulanMap[bln].total += (r.total||0);
      if (r.status==='LUNAS') bulanMap[bln].paid += (r.total||0);
      bulanMap[bln].vendors.add(r.vendor||'?');
    });
    const bulans = Object.values(bulanMap).sort((a,b) => a.bulan.localeCompare(b.bulan));

    // --- Grand totals ---
    const grandTotal  = data.reduce((s,r)=>s+(r.total||0),0);
    const grandPaid   = data.filter(r=>r.status==='LUNAS').reduce((s,r)=>s+(r.total||0),0);
    const grandUnpaid = grandTotal - grandPaid;
    const grandCount  = data.length;
    const lunasCnt    = data.filter(r=>r.status==='LUNAS').length;

    // Bulan names
    const MONTHS = ['','JAN','FEB','MAR','APR','MEI','JUN','JUL','AGS','SEP','OKT','NOV','DES'];
    const fmtBln = (b) => { const p=b.split('-'); return MONTHS[parseInt(p[1])]||b; };
    const fmtRp  = (v) => v>=1e9 ? (v/1e9).toFixed(1)+'M' : v>=1e6 ? (v/1e6).toFixed(1)+'jt' : v>=1e3 ? (v/1e3).toFixed(0)+'rb' : String(v);
    const fmtFull = (v) => 'Rp '+Number(v).toLocaleString('id-ID');
    const pct = (a,b) => b>0 ? Math.round(a/b*100) : 0;

    // Bar chart for vendor
    const maxV = Math.max(...vendors.map(v=>v.total), 1);
    const VENDOR_COLORS = ['#6366f1','#10b981','#f59e0b','#ec4899','#3b82f6','#ef4444','#8b5cf6'];

    page.innerHTML = `
      <!-- Summary Header Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;padding:20px;color:#fff">
          <div style="font-size:11px;opacity:.8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Total AP</div>
          <div style="font-size:22px;font-weight:800;margin:6px 0">${fmtRp(grandTotal)}</div>
          <div style="font-size:12px;opacity:.8">${grandCount} transaksi</div>
        </div>
        <div style="background:linear-gradient(135deg,#10b981,#059669);border-radius:16px;padding:20px;color:#fff">
          <div style="font-size:11px;opacity:.8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Sudah Dibayar</div>
          <div style="font-size:22px;font-weight:800;margin:6px 0">${fmtRp(grandPaid)}</div>
          <div style="font-size:12px;opacity:.8">${lunasCnt} transaksi lunas</div>
        </div>
        <div style="background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:16px;padding:20px;color:#fff">
          <div style="font-size:11px;opacity:.8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Sisa Hutang</div>
          <div style="font-size:22px;font-weight:800;margin:6px 0">${fmtRp(grandUnpaid)}</div>
          <div style="font-size:12px;opacity:.8">${grandCount-lunasCnt} belum lunas</div>
        </div>
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:16px;padding:20px;color:#fff">
          <div style="font-size:11px;opacity:.8;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Persentase Lunas</div>
          <div style="font-size:22px;font-weight:800;margin:6px 0">${pct(grandPaid,grandTotal)}%</div>
          <div style="font-size:12px;opacity:.8;background:rgba(255,255,255,.2);border-radius:20px;height:6px;margin-top:8px"><div style="background:#fff;height:6px;border-radius:20px;width:${pct(grandPaid,grandTotal)}%"></div></div>
        </div>
      </div>

      <!-- Main content 2 columns -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <!-- Per Vendor Chart -->
        <div style="background:var(--surface2);border-radius:14px;padding:20px;border:.5px solid var(--border)">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:16px">📊 AP per Vendor</div>
          ${vendors.map((v,i) => `
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <div style="font-size:12px;font-weight:600;color:var(--text)">${v.vendor}</div>
                <div style="font-size:11px;color:var(--text-3)">${v.count}x · ${fmtRp(v.total)}</div>
              </div>
              <div style="background:var(--surface3);border-radius:6px;height:8px;overflow:hidden">
                <div style="background:${VENDOR_COLORS[i%VENDOR_COLORS.length]};height:8px;border-radius:6px;width:${pct(v.total,maxV)}%;transition:width .5s"></div>
              </div>
              <div style="display:flex;gap:8px;margin-top:4px">
                <span style="font-size:10px;color:#10b981">✓ ${fmtRp(v.paid)}</span>
                ${v.unpaid>0?'<span style="font-size:10px;color:#ef4444">⚠ '+fmtRp(v.unpaid)+'</span>':''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Per Bulan Table -->
        <div style="background:var(--surface2);border-radius:14px;padding:20px;border:.5px solid var(--border)">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:16px">📅 AP per Bulan</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:6px 8px;color:var(--text-3);font-weight:600;font-size:10px;text-transform:uppercase">Bulan</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text-3);font-weight:600;font-size:10px;text-transform:uppercase">Transaksi</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text-3);font-weight:600;font-size:10px;text-transform:uppercase">Total AP</th>
                <th style="text-align:right;padding:6px 8px;color:var(--text-3);font-weight:600;font-size:10px;text-transform:uppercase">Lunas</th>
              </tr>
            </thead>
            <tbody>
              ${bulans.map(b => `
                <tr style="border-bottom:.5px solid var(--border-light)">
                  <td style="padding:8px;font-weight:600">${fmtBln(b.bulan)} ${b.bulan.split('-')[0]}</td>
                  <td style="padding:8px;text-align:right;color:var(--text-3)">${b.count}</td>
                  <td style="padding:8px;text-align:right;font-weight:600">${fmtRp(b.total)}</td>
                  <td style="padding:8px;text-align:right">
                    <div style="background:var(--surface3);border-radius:10px;height:4px;width:60px;margin-left:auto">
                      <div style="background:#10b981;height:4px;border-radius:10px;width:${pct(b.paid,b.total)}%"></div>
                    </div>
                    <div style="font-size:10px;color:var(--text-3);margin-top:2px">${pct(b.paid,b.total)}%</div>
                  </td>
                </tr>
              `).join('')}
              <tr style="border-top:2px solid var(--border);font-weight:700;background:var(--surface3)">
                <td style="padding:8px">TOTAL</td>
                <td style="padding:8px;text-align:right">${grandCount}</td>
                <td style="padding:8px;text-align:right;color:var(--primary)">${fmtRp(grandTotal)}</td>
                <td style="padding:8px;text-align:right;color:#10b981">${pct(grandPaid,grandTotal)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Detail tabel per vendor -->
      <div style="background:var(--surface2);border-radius:14px;padding:20px;border:.5px solid var(--border)">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:16px">📋 Detail AP per Vendor & Bulan</div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:600px">
            <thead>
              <tr style="background:var(--surface3);border-radius:8px">
                <th style="text-align:left;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-3)">Vendor / Supplier</th>
                <th style="text-align:right;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-3)">Transaksi</th>
                ${bulans.map(b=>'<th style="text-align:right;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-3)">'+fmtBln(b.bulan)+'</th>').join('')}
                <th style="text-align:right;padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-3)">Total</th>
              </tr>
            </thead>
            <tbody>
              ${vendors.map((v,vi) => `
                <tr style="border-bottom:.5px solid var(--border-light);cursor:pointer" 
                    onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">
                  <td style="padding:10px 12px;font-weight:600">
                    <div style="display:flex;align-items:center;gap:8px">
                      <div style="width:8px;height:8px;border-radius:50%;background:${VENDOR_COLORS[vi%VENDOR_COLORS.length]};flex-shrink:0"></div>
                      ${v.vendor}
                    </div>
                  </td>
                  <td style="padding:10px 12px;text-align:right;color:var(--text-3)">${v.count}</td>
                  ${bulans.map(b=>'<td style="padding:10px 12px;text-align:right;color:var(--text-3);font-family:var(--font-mono)">'+(v.bulanData[b.bulan]?fmtRp(v.bulanData[b.bulan]):'-')+'</td>').join('')}
                  <td style="padding:10px 12px;text-align:right;font-weight:700;color:var(--primary)">${fmtRp(v.total)}</td>
                </tr>
              `).join('')}
              <tr style="border-top:2px solid var(--border);font-weight:700;background:var(--surface3)">
                <td style="padding:10px 12px">TOTAL</td>
                <td style="padding:10px 12px;text-align:right">${grandCount}</td>
                ${bulans.map(b=>'<td style="padding:10px 12px;text-align:right;font-weight:700;color:var(--primary)">'+fmtRp(b.total)+'</td>').join('')}
                <td style="padding:10px 12px;text-align:right;font-weight:700;color:var(--primary)">${fmtRp(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }


  function reArrangeAP() { _ap.sort((a,b)=>((b.tgl_transaksi||b.tgl||'')).localeCompare((a.tgl_transaksi||a.tgl||''))); _apPage=1; applyFilter(); Notify.success('Data diurutkan berdasarkan tanggal'); }

  return { init, render, filterBelum, applyFilter, resetFilter, reArrangeAP, goApPage, setApPerPage, renderVAP, applyVAPFilter, printVAP, renderSummaryAP, _fmtJt, switchTab, renderSuppliers, showSupplierDetail, openAddSupplierModal, openEditSupplierModal, _submitSupplier, openModal, openSupplierModal, _submit, _deleteAP, _deleteSupplier, _addSupplierFull, _saveEditSupplier, apStartEdit, _apCommit, _apCommitAndAdd, _apCancel, apAddRow, _apKey };
})();
window.APModule = APModule;
