/* ============================================
   BECCA V2.0 — Account Payable Module
============================================ */
const APModule = (() => {
  let _ap = [];
  let _suppliers = [];

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
    if (tab === 'list')     render();
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
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s5)">
        ${[
          {l:'Sisa Hutang',    v:Utils.formatRupiah(totalHutang,true),  c:'#ef4444', ic:'⚠️', sub:_ap.filter(r=>r.status!=='LUNAS').length+' tagihan belum lunas'},
          {l:'Sudah Dibayar',  v:Utils.formatRupiah(totalLunas,true),   c:'#10b981', ic:'✅', sub:_ap.filter(r=>r.status==='LUNAS').length+' transaksi lunas'},
          {l:'Total AP',       v:Utils.formatRupiah(totalTagihan,true),  c:'#6366f1', ic:'📋', sub:sorted.length+' total transaksi'},
          {l:'Supplier Aktif', v:_suppliers.length+' supplier',          c:'#f59e0b', ic:'🏭', sub:supList.length+' supplier punya tagihan'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 20px;position:relative;overflow:hidden">
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
        <button onclick="APModule.resetFilter()" style="height:28px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:transparent;cursor:pointer;font-size:11px;color:var(--text-3);white-space:nowrap">↺ Reset</button>
        <span id="ap-count-label" style="margin-left:auto;font-size:11px;color:var(--text-3);white-space:nowrap"></span>
      </div>
      </div>

      <!-- TABLE -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:900px" id="ap-main-table">
            <thead>
              <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
                <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:36px">#</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);white-space:nowrap;width:88px">Tanggal</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);min-width:130px">Supplier</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);min-width:160px">Keterangan</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:70px">Qty</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:50px">Sat</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:90px">Harga/Sat</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:100px">Total</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:100px">Terbayar</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);width:90px">Sisa</th>
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


  function applyFilter() {
    const from   = document.getElementById('ap-fil-from')?.value   || '';
    const to     = document.getElementById('ap-fil-to')?.value     || '';
    const bulan  = document.getElementById('ap-fil-bulan')?.value  || '';
    const sup    = document.getElementById('ap-fil-sup')?.value    || '';
    const status = document.getElementById('ap-fil-status')?.value || '';
    const today  = new Date().toISOString().split('T')[0];
    const canEdit = Auth.can('ap','edit');

    const COLORS = [
      {bg:'rgba(99,102,241,.07)',bar:'#6366f1'},{bg:'rgba(16,185,129,.07)',bar:'#10b981'},
      {bg:'rgba(245,158,11,.07)',bar:'#f59e0b'},{bg:'rgba(236,72,153,.07)',bar:'#ec4899'},
      {bg:'rgba(59,130,246,.07)',bar:'#3b82f6'},{bg:'rgba(239,68,68,.07)', bar:'#ef4444'},
    ];
    const supList = [...new Set(_ap.map(r=>r.supplier).filter(Boolean))].sort();
    const supColor = {};
    supList.forEach((s,i)=>{ supColor[s]=COLORS[i%COLORS.length]; });

    let data = [..._ap].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    if (from)   data = data.filter(r=>(r.tgl||'')>=from);
    if (to)     data = data.filter(r=>(r.tgl||'')<=to);
    if (bulan)  data = data.filter(r=>r.tgl?.startsWith(bulan));
    if (sup)    data = data.filter(r=>r.supplier===sup);
    if (status) data = data.filter(r=>r.status===status);

    const tbody = document.getElementById('ap-tbody');
    const footEl = document.getElementById('ap-footer-total');
    const countEl = document.getElementById('ap-count-label');
    if (countEl) countEl.textContent = data.length+' transaksi';
    if (!tbody) return;

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data yang cocok</td></tr>';
      if (footEl) footEl.innerHTML = '';
      return;
    }

    tbody.innerHTML = data.map((r,i) => {
      const sisa   = (r.total||0)-(r.terbayar||0);
      const late   = r.jatuhTempo && r.status!=='LUNAS' && r.jatuhTempo<today;
      const cl     = supColor[r.supplier] || COLORS[0];
      const sc     = r.status==='LUNAS'?'#10b981':'#ef4444';
      const scBg   = r.status==='LUNAS'?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)';
      const scTxt  = r.status==='LUNAS'?'LUNAS':'BELUM';
      const tglFmt = r.tgl?r.tgl.split('-').reverse().join('/'):'-';
      const jtFmt  = r.jatuhTempo?r.jatuhTempo.split('-').reverse().join('/'):'-';
      const rowBg  = late ? 'rgba(239,68,68,0.04)' : (i%2===1?'var(--surface2)':'transparent');
      const hoverBg = 'rgba(99,102,241,.06)';
      const p = 'padding:9px 10px;';
      const acts = canEdit
        ? '<td style="'+p+'width:56px"><div style="display:flex;gap:2px;justify-content:center">'
          +'<button onclick="event.stopPropagation();APModule.openModal(\''+r.id+'\');" title="Edit" style="width:24px;height:24px;border-radius:5px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);display:flex;align-items:center;justify-content:center;font-size:10px">'
          +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>'
          +'</button>'
          +'<button onclick="event.stopPropagation();APModule._deleteAP(\''+r.id+'\');" title="Hapus" style="width:24px;height:24px;border-radius:5px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);display:flex;align-items:center;justify-content:center">'
          +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg>'
          +'</button>'
          +'</div></td>'
        : '';

      return '<tr id="ap-row-'+r.id+'" onclick="APModule.apStartEdit(\''+r.id+'\');" data-bg="'+rowBg+'" style="cursor:pointer;background:'+rowBg+';border-bottom:1px solid var(--border);border-left:3px solid '+cl.bar+'" onmouseover="this.style.background=\'rgba(99,102,241,.08)\'" onmouseout="this.style.background=this.dataset.bg">'
        +'<td style="'+p+'text-align:center;font-size:11px;color:var(--text-3);width:36px">'+(i+1)+'</td>'
        +'<td style="'+p+'font-size:12px;color:var(--text-2);white-space:nowrap;width:88px">'+tglFmt+'</td>'
        +'<td style="'+p+'min-width:130px"><div style="font-weight:700;font-size:12px;color:var(--heading)">'+( r.supplier||'-')+'</div>'
          +'<div style="font-size:10px;font-weight:600;color:'+cl.bar+';background:'+cl.bg+';display:inline-block;padding:1px 6px;border-radius:3px;margin-top:2px">'
          +(supList.indexOf(r.supplier)+1 > 0 ? 'V'+(supList.indexOf(r.supplier)+1).toString().padStart(2,'0') : '')+'</div></td>'
        +'<td style="'+p+'font-size:12px;min-width:160px;max-width:200px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(r.keterangan||r.ket||'')+'">'+(r.keterangan||r.ket||'-')+'</div></td>'
        +'<td style="'+p+'text-align:right;font-size:12px;font-family:var(--font-mono);width:70px">'+(r.qty?Number(r.qty).toLocaleString('id',{minimumFractionDigits:r.qty%1?2:0}):'-')+'</td>'
        +'<td style="'+p+'font-size:11px;color:var(--text-3);width:50px">'+(r.satuan||'-')+'</td>'
        +'<td style="'+p+'text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text-3);width:90px">'+(r.hargaSatuan?Utils.formatRupiah(r.hargaSatuan):'-')+'</td>'
        +'<td style="'+p+'text-align:right;font-family:var(--font-mono);font-weight:700;font-size:12px;width:100px">'+Utils.formatRupiah(r.total||0)+'</td>'
        +'<td style="'+p+'text-align:right;font-family:var(--font-mono);font-size:12px;color:#10b981;width:100px">'+Utils.formatRupiah(r.terbayar||0)+'</td>'
        +'<td style="'+p+'text-align:right;font-family:var(--font-mono);font-size:12px;color:'+(sisa>0?'#ef4444':'var(--text-3)')+';font-weight:'+(sisa>0?700:400)+';width:90px">'+Utils.formatRupiah(sisa)+'</td>'
        +'<td style="'+p+'font-size:11px;color:'+(late?'#ef4444':'var(--text-3)')+';white-space:nowrap;width:82px">'+(late?'⚠️ ':'')+jtFmt+'</td>'
        +'<td style="'+p+'text-align:center;width:72px"><span style="font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;background:'+scBg+';color:'+sc+';border:1px solid '+sc+'44">'+scTxt+'</span></td>'
        +acts
        +'</tr>';
    }).join('');

    // Footer total
    const gt  = data.reduce((s,r)=>s+(r.total||0),0);
    const gb  = data.reduce((s,r)=>s+(r.terbayar||0),0);
    const gs  = gt-gb;
    if (footEl) footEl.innerHTML =
      '<span style="color:var(--text-3);font-size:11px">'+data.length+' transaksi</span>'
      +'<span style="margin-left:auto;color:var(--text-2)">Total: <strong>'+Utils.formatRupiah(gt)+'</strong></span>'
      +'<span style="color:#10b981">Dibayar: <strong>'+Utils.formatRupiah(gb)+'</strong></span>'
      +'<span style="color:#ef4444">Sisa: <strong>'+Utils.formatRupiah(gs)+'</strong></span>';
  }


  function resetFilter() {
    ['ap-fil-from','ap-fil-to','ap-fil-bulan','ap-fil-sup','ap-fil-status'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.value='';
    });
    applyFilter();
  }


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
            <div class="form-group">
              <label class="form-label">No. HP / Telepon</label>
              <input name="noHp" class="form-control" value="${editSupp.noHp||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input name="email" type="email" class="form-control" value="${editSupp.email||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Kategori / Jenis</label>
              <input name="kategori" class="form-control" value="${editSupp.kategori||''}" placeholder="Contoh: Bahan Baku, Kemasan, Jasa">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Alamat</label>
            <input name="alamat" class="form-control" value="${editSupp.alamat||''}">
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


  async function _addSupplier() {
    const nama = document.getElementById('new-sup-name').value.trim();
    if (!nama) return;
    const saved = await DB.saveSupplier({ nama });
    _suppliers.push(saved);
    document.getElementById('sup-list-wrap').innerHTML += `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <span>${saved.nama}</span>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="APModule._deleteSupplier('${saved.id}')">Hapus</button>
      </div>
    `;
    document.getElementById('new-sup-name').value = '';
  }

  async function _deleteAP(id) {
    const ok = await Utils.confirm({title:'Hapus AP?', msg:'Yakin hapus transaksi ini?', danger:true});
    if (!ok) return;
    try {
      await DB.delete('ap', id);
      _ap = _ap.filter(r => r.id !== id);
      render();
      Notify.success('AP dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  async function _deleteSupplier(id) {
    await DB.delete('suppliers', id);
    _suppliers = _suppliers.filter(s => s.id !== id);
    render();
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
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:150px">
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
              <th>Nama Supplier</th>
              <th>Kategori / Bidang</th>
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
            ${!_suppliers.length ? `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-3)">
              Belum ada data supplier. Klik "+ Tambah Supplier" untuk menambahkan.
            </td></tr>` :
            _suppliers.map((s,i) => {
              const apItems    = _ap.filter(a => a.supplier === s.nama);
              const totalAP    = apItems.reduce((sum,a)=>sum+(a.total||0),0);
              const totalBayar = apItems.reduce((sum,a)=>sum+(a.terbayar||0),0);
              const sisa       = Math.max(0, totalAP - totalBayar);
              return `<tr style="cursor:pointer" onclick="APModule.showSupplierDetail('${s.id}')"
                onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                <td class="text-muted">${i+1}</td>
                <td>
                  <div style="font-weight:700">${s.nama||'-'}</div>
                  ${s.alamat ? `<div style="font-size:11px;color:var(--text-3)">📍 ${s.alamat}</div>` : ''}
                </td>
                <td><span class="badge badge-neutral">${s.kategori||'-'}</span></td>
                <td class="text-muted">${s.noHp||'-'}</td>
                <td class="text-muted text-small">${s.kota||'-'}</td>
                <td class="text-muted">${s.bank||'-'}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${s.noRek||'-'}</td>
                <td class="text-muted">${s.atasNama||'-'}</td>
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
    const sisa       = Math.max(0, totalAP - totalBayar);
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
                    const sisaA = Math.max(0,(a.total||0)-(a.terbayar||0));
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

    // Palette: per vendor distinct color
    const PALETTE = [
      {grad:'135deg,#667eea,#764ba2', acc:'#667eea', lt:'rgba(102,126,234,.06)', border:'rgba(102,126,234,.2)'},
      {grad:'135deg,#11998e,#38ef7d', acc:'#11998e', lt:'rgba(17,153,142,.06)', border:'rgba(17,153,142,.2)'},
      {grad:'135deg,#f7971e,#ffd200', acc:'#d97706', lt:'rgba(217,119,6,.06)', border:'rgba(217,119,6,.2)'},
      {grad:'135deg,#e96c6c,#f7797d', acc:'#e96c6c', lt:'rgba(233,108,108,.06)', border:'rgba(233,108,108,.2)'},
      {grad:'135deg,#4facfe,#00f2fe', acc:'#3b82f6', lt:'rgba(59,130,246,.06)', border:'rgba(59,130,246,.2)'},
      {grad:'135deg,#a18cd1,#fbc2eb', acc:'#8b5cf6', lt:'rgba(139,92,246,.06)', border:'rgba(139,92,246,.2)'},
    ];

    let rowsHtml = '';
    let vendorIdx = 0;
    Object.entries(supGroups).forEach(([supName, items]) => {
      const sup      = _suppliers.find(s=>s.nama===supName);
      const payable  = items.reduce((s,r)=>s+(r.total||0)-(r.terbayar||0),0);
      if (payable<=0 && status==='unpaid') return;
      const P = PALETTE[vendorIdx % PALETTE.length];
      vendorIdx++;

      // Vendor header row
      rowsHtml +=
        '<tr class="vap-vendor-row" style="border-bottom:1px solid '+P.border+'">'
        +'<td style="padding:14px 16px;width:44%">'
          +'<div style="display:flex;align-items:center;gap:12px">'
            +'<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient('+P.grad+');'
              +'color:white;font-weight:900;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;'
              +'box-shadow:0 4px 12px rgba(0,0,0,.15)">'
              +supName.trim().substring(0,1).toUpperCase()
            +'</div>'
            +'<div>'
              +'<div style="font-weight:800;font-size:14px;color:var(--heading)">'+supName+'</div>'
              +'<div style="font-size:11px;color:'+P.acc+';font-weight:600;margin-top:1px">'+(sup?.kategori||'Supplier')+'</div>'
            +'</div>'
          +'</div>'
        +'</td>'
        +'<td style="padding:14px 16px;font-weight:700;font-size:13px;width:12%">'+(sup?.bank||'—')+'</td>'
        +'<td style="padding:14px 16px;font-family:var(--font-mono);font-size:12px;letter-spacing:.04em;width:22%">'+(sup?.noRek||'—')+'</td>'
        +'<td style="padding:14px 16px;font-size:13px;width:14%">'+(sup?.atasNama||'—')+'</td>'
        +'<td style="padding:14px 16px;text-align:right;white-space:nowrap;width:10%">'
          +'<div style="font-family:var(--font-mono);font-size:17px;font-weight:900;color:'+P.acc+'">'+Utils.formatRupiah(payable)+'</div>'
          +'<div style="font-size:10px;color:var(--text-3);margin-top:2px;font-weight:500">'+items.length+' tagihan</div>'
        +'</td>'
        +'</tr>';

      // Detail rows
      items.sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||'')).forEach(r=>{
        const sisa   = (r.total||0)-(r.terbayar||0);
        const tglFmt = r.tgl?r.tgl.split('-').reverse().join('/'):'-';
        const hs     = r.hargaSatuan ? Utils.formatRupiah(r.hargaSatuan) : '-';
        rowsHtml +=
          '<tr style="background:'+P.lt+';border-bottom:1px solid '+P.border+'40">'
          +'<td style="padding:8px 16px 8px 68px;font-size:12px;color:var(--text-2);font-style:italic">'
            +(r.keterangan||r.ket||'-')
          +'</td>'
          +'<td style="padding:8px 16px;font-size:11px;color:var(--text-3)">'+tglFmt+'</td>'
          +'<td style="padding:8px 16px;font-size:11px;color:var(--text-3);font-family:var(--font-mono)">'
            +(r.qty?Number(r.qty).toLocaleString('id',{minimumFractionDigits:r.qty%1?2:0})+' '+(r.satuan||''):'-')
          +'</td>'
          +'<td style="padding:8px 16px;font-size:11px;color:var(--text-3);text-align:right;font-family:var(--font-mono)">'+hs+'</td>'
          +'<td style="padding:8px 16px;text-align:right;font-family:var(--font-mono);font-size:12px;'
            +'font-weight:700;color:'+P.acc+';white-space:nowrap">'+Utils.formatRupiah(sisa)+'</td>'
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
          <div style="overflow-x:auto">
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
    if (k === 'Enter')  { event.preventDefault(); APModule._apCommit(eid); }
    if (k === 'Escape') { APModule._apCancel(eid); }
  }

  function _apLoadLocks() {
    try { _apLocked = new Set(JSON.parse(localStorage.getItem(_AP_LOCK_KEY)||'[]')); } catch { _apLocked=new Set(); }
  }
  function _apSaveLocks() { localStorage.setItem(_AP_LOCK_KEY, JSON.stringify([..._apLocked])); }

  function apStartEdit(id) {
    if (_apLocked.has(id)) { _apLocked.delete(id); _apSaveLocks(); }
    if (_apEditId === id) return;
    if (_apEditId) _apCommit(_apEditId);
    _apEditId = id;
    const tr = document.getElementById('ap-row-'+id);
    if (!tr) return;
    const row = _ap.find(r=>r.id===id);
    if (!row) return;
    row._orig = JSON.stringify({tgl:row.tgl,supplier:row.supplier,keterangan:row.keterangan,qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,total:row.total,terbayar:row.terbayar,status:row.status,jatuhTempo:row.jatuhTempo});
    tr.outerHTML = _apRowEdit(row);
    document.getElementById('ap-row-'+id)?.querySelector('input,select')?.focus();
  }

  function _apCommit(id) {
    if (!id) return;
    const tr = document.getElementById('ap-row-'+id);
    if (!tr) { _apEditId=null; return; }
    const row = _ap.find(r=>r.id===id);
    if (!row) { _apEditId=null; return; }
    const g = f => tr.querySelector('[data-f="'+f+'"]')?.value ?? row[f];
    const qty = parseFloat(g('qty'))||0;
    const hs  = parseFloat(g('hargaSatuan'))||0;
    Object.assign(row, {
      tgl:g('tgl')||row.tgl, supplier:g('supplier')||row.supplier,
      keterangan:g('keterangan')||row.keterangan, qty, satuan:g('satuan')||row.satuan,
      hargaSatuan:hs, total:qty&&hs?qty*hs:(parseFloat(g('total'))||row.total||0),
      terbayar:parseFloat(g('terbayar'))||0, status:g('status')||row.status,
      jatuhTempo:g('jatuhTempo')||row.jatuhTempo,
    });
    const orig = row._orig; delete row._orig;
    _apEditId = null;
    DB.saveAP(row).then(()=>{ _apLocked.add(id); _apSaveLocks(); applyFilter(); Notify.success('AP disimpan!'); }).catch(e=>Notify.error('Gagal',e.message));
  }

  function _apCancel(id) {
    _apEditId = null;
    const row = _ap.find(r=>r.id===id);
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
        +'<button onclick="event.stopPropagation();APModule._apCommit(\"'+eid+'\")" style="width:20px;height:20px;border-radius:4px;border:1px solid #10b981;background:rgba(16,185,129,.1);cursor:pointer;color:#10b981;font-size:11px;display:flex;align-items:center;justify-content:center" title="Simpan">✓</button>'
        +'<button onclick="event.stopPropagation();APModule._apCancel(\"'+eid+'\")" style="width:20px;height:20px;border-radius:4px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);font-size:11px;display:flex;align-items:center;justify-content:center" title="Batal">✕</button>'
      +'</div></td>'
      +'<td style="'+p+'">'+inp('tgl',r.tgl,'date')+'</td>'
      +'<td style="'+p+'"><select data-f="supplier" style="width:100%;border:none;outline:none;background:transparent;font-size:12px;padding:0 4px">'+supOpts+'</select></td>'
      +'<td style="'+p+'">'+inp('keterangan',r.keterangan||r.ket)+'</td>'
      +'<td style="'+p+'">'+inp('qty',r.qty,'number','min=0 style="text-align:right"')+'</td>'
      +'<td style="'+p+'">'+inp('satuan',r.satuan)+'</td>'
      +'<td style="'+p+'">'+inp('hargaSatuan',r.hargaSatuan,'number','min=0')+'</td>'
      +'<td style="'+p+'">'+inp('total',r.total,'number','min=0')+'</td>'
      +'<td style="'+p+'">'+inp('terbayar',r.terbayar,'number','min=0')+'</td>'
      +'<td style="'+p+'"></td>'
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
  function renderSummaryAP() {
    const el = document.getElementById('ap-tab-summary');
    if (!el) return;

    const MONTHS_ORDER = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const BL = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const NORM = {'Jan':'Januari','Febuari':'Februari','Feb':'Februari','Mar':'Maret','Apr':'April','Ags':'Agustus','Sep':'September','Okt':'Oktober','Des':'Desember'};

    // All AP months
    const allMonths = [...new Set(_ap.map(r=>r.tgl?.substring(0,7)).filter(Boolean))].sort();
    const monthLabels = allMonths.map(m=>{ const[y,mo]=m.split('-'); return BL[parseInt(mo)]+'\''+(y.slice(2)); });

    // Per-supplier stats
    const supMap = {};
    _ap.forEach(r => {
      if (!r.supplier) return;
      if (!supMap[r.supplier]) supMap[r.supplier] = {
        nama: r.supplier, totalAll:0, terbayarAll:0,
        lunas:0, belum:0, cicilan:0, total:0,
        byMonth: {},
      };
      const s    = supMap[r.supplier];
      const sisa = (r.total||0)-(r.terbayar||0);
      s.totalAll    += r.total||0;
      s.terbayarAll += r.terbayar||0;
      s.total++;
      if (r.status==='LUNAS')   s.lunas++;
      else if (r.status==='CICILAN') s.cicilan++;
      else s.belum++;
      // Monthly breakdown
      const mo = r.tgl?.substring(0,7)||'';
      if (!s.byMonth[mo]) s.byMonth[mo] = {total:0, terbayar:0};
      s.byMonth[mo].total    += r.total||0;
      s.byMonth[mo].terbayar += r.terbayar||0;
    });

    const supList = Object.values(supMap).sort((a,b)=>b.totalAll-a.totalAll);
    const grandTotal    = supList.reduce((s,x)=>s+x.totalAll,0);
    const grandTerbayar = supList.reduce((s,x)=>s+x.terbayarAll,0);
    const grandSisa     = grandTotal - grandTerbayar;

    // Stats cards
    const statsHtml = [
      {l:'Total AP',      v:Utils.formatRupiah(grandTotal,true),    c:'#6366f1', sub:_ap.length+' transaksi'},
      {l:'Sudah Dibayar', v:Utils.formatRupiah(grandTerbayar,true), c:'#10b981', sub:_ap.filter(r=>r.status==='LUNAS').length+' lunas'},
      {l:'Sisa Hutang',   v:Utils.formatRupiah(grandSisa,true),     c:'#ef4444', sub:_ap.filter(r=>r.status!=='LUNAS').length+' belum lunas'},
      {l:'Supplier',      v:supList.length+' supplier',              c:'#f59e0b', sub:allMonths.length+' bulan data'},
    ].map(s=>
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden">'
      +'<div style="position:absolute;top:0;left:0;width:4px;height:100%;background:'+s.c+'"></div>'
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px">'+s.l+'</div>'
      +'<div style="font-size:20px;font-weight:800;color:'+s.c+';font-family:var(--font-mono)">'+s.v+'</div>'
      +'<div style="font-size:10px;color:var(--text-3);margin-top:3px">'+s.sub+'</div>'
      +'</div>'
    ).join('');

    // Table rows per supplier
    const PALETTE = ['#6366f1','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#8b5cf6','#06b6d4','#84cc16','#f97316'];
    const rowsHtml = supList.map((s, idx) => {
      const sup  = _suppliers.find(x=>x.nama===s.nama);
      const sisa = s.totalAll - s.terbayarAll;
      const pct  = s.totalAll ? Math.round(s.terbayarAll/s.totalAll*100) : 0;
      const clr  = PALETTE[idx % PALETTE.length];
      // Monthly cells
      const moCells = allMonths.map(m=>{
        const d = s.byMonth[m];
        if (!d || !d.total) return '<td style="padding:10px 12px;text-align:right;color:var(--text-3);font-size:11px">—</td>';
        const s2 = d.total - d.terbayar;
        return '<td style="padding:10px 12px;text-align:right">'
          +'<div style="font-family:var(--font-mono);font-size:12px;font-weight:600">'+Utils.formatRupiah(d.total,true)+'</div>'
          +(s2>0?'<div style="font-size:10px;color:#ef4444">-'+Utils.formatRupiah(s2,true)+'</div>':'<div style="font-size:10px;color:#10b981">✓ Lunas</div>')
          +'</td>';
      }).join('');

      return '<tr style="border-bottom:1px solid var(--border);transition:background .1s">'
        // Supplier name
        +'<td style="padding:10px 14px;min-width:180px;position:sticky;left:0;background:var(--surface);z-index:1">'
          +'<div style="display:flex;align-items:center;gap:8px">'
            +'<div style="width:28px;height:28px;border-radius:7px;background:'+clr+';color:white;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+s.nama.substring(0,1)+'</div>'
            +'<div>'
              +'<div style="font-weight:700;font-size:12px;color:var(--heading)">'+s.nama+'</div>'
              +(sup?.kategori?'<div style="font-size:10px;color:'+clr+';font-weight:600">'+sup.kategori+'</div>':'')
            +'</div>'
          +'</div>'
        +'</td>'
        // Total
        +'<td style="padding:10px 12px;text-align:right;white-space:nowrap">'
          +'<div style="font-family:var(--font-mono);font-weight:700;font-size:13px">'+Utils.formatRupiah(s.totalAll,true)+'</div>'
          +'<div style="font-size:10px;color:var(--text-3)">'+s.total+' trx</div>'
        +'</td>'
        // Dibayar
        +'<td style="padding:10px 12px;text-align:right;white-space:nowrap">'
          +'<div style="font-family:var(--font-mono);font-size:12px;color:#10b981">'+Utils.formatRupiah(s.terbayarAll,true)+'</div>'
        +'</td>'
        // Sisa
        +'<td style="padding:10px 12px;text-align:right;white-space:nowrap">'
          +'<div style="font-size:12px;font-weight:700;color:'+(sisa>0?'#ef4444':'var(--text-3)')+'">'+_fmtJt(sisa)+'</div>'
        +'</td>'
        // Progress bar
        +'<td style="padding:10px 14px;min-width:100px">'
          +'<div style="display:flex;align-items:center;gap:6px">'
            +'<div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">'
              +'<div style="width:'+pct+'%;height:100%;background:'+clr+';border-radius:3px"></div>'
            +'</div>'
            +'<span style="font-size:10px;font-weight:700;color:'+clr+';width:28px;flex-shrink:0">'+pct+'%</span>'
          +'</div>'
        +'</td>'
        // Status pills
        +'<td style="padding:10px 12px;white-space:nowrap">'
          +(s.lunas?'<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.3)">✓ '+s.lunas+'</span> ':'')
          +(s.belum?'<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.3)">⏳ '+s.belum+'</span> ':'')
          +(s.cicilan?'<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(245,158,11,.1);color:#d97706;border:1px solid rgba(245,158,11,.3)">🔸 '+s.cicilan+'</span>':'')
        +'</td>'
        // Monthly breakdown
        +moCells
        +'</tr>';
    }).join('');

    // Grand total row
    const grandMonthCells = allMonths.map(m=>{
      const mTotal = _ap.filter(r=>r.tgl?.startsWith(m)).reduce((s,r)=>s+(r.total||0),0);
      const mBayar = _ap.filter(r=>r.tgl?.startsWith(m)).reduce((s,r)=>s+(r.terbayar||0),0);
      return '<td style="padding:10px 12px;text-align:right;background:var(--surface2)">'
        +(mTotal?'<div style="font-family:var(--font-mono);font-size:12px;font-weight:800">'+Utils.formatRupiah(mTotal,true)+'</div>':'<div style="color:var(--text-3)">—</div>')
        +'</td>';
    }).join('');

    const moHeaders = allMonths.map(m=>{
      const[y,mo]=m.split('-');
      return '<th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);white-space:nowrap">'+BL[parseInt(mo)]+'\''+(y.slice(2))+'</th>';
    }).join('');

    el.innerHTML = `
      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s4);min-width:0">
        ${statsHtml}
      </div>

      <!-- Summary Table -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <!-- Title bar -->
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:14px;font-weight:800;color:var(--heading)">Summary Transaksi per Supplier</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">${supList.length} supplier · ${_ap.length} total transaksi · ${allMonths.length} bulan</div>
          </div>
          <div style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:4px">
            <span style="opacity:.5">← scroll horizontal →</span>
          </div>
        </div>
        <div style="overflow-x:auto;width:100%">
          <table style="width:100%;border-collapse:collapse;table-layout:auto">
            <thead>
              <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
                <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);min-width:180px;position:sticky;left:0;background:var(--surface2);z-index:2">Supplier</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Total AP</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Dibayar</th>
                <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Sisa</th>
                <th style="padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);min-width:120px">Lunas %</th>
                <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Status</th>
                ${moHeaders}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <!-- Grand total -->
              <tr style="background:var(--surface2);border-top:2px solid var(--border);font-weight:800">
                <td style="padding:12px 14px;font-size:12px;font-weight:800;color:var(--text-2);position:sticky;left:0;background:var(--surface2);z-index:1">GRAND TOTAL</td>
                <td style="padding:12px 12px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:800">${Utils.formatRupiah(grandTotal)}</td>
                <td style="padding:12px 12px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#10b981">${Utils.formatRupiah(grandTerbayar)}</td>
                <td style="padding:12px 12px;text-align:right;font-family:var(--font-mono);font-size:13px;color:#ef4444;font-weight:800">${Utils.formatRupiah(grandSisa)}</td>
                <td style="padding:12px 14px"></td>
                <td style="padding:12px 12px"></td>
                ${grandMonthCells}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }


  return { init, render, applyFilter, resetFilter, renderVAP, applyVAPFilter, printVAP, renderSummaryAP, _fmtJt, switchTab, renderSuppliers, showSupplierDetail, openAddSupplierModal, openEditSupplierModal, _submitSupplier, openModal, openSupplierModal, _submit, _deleteAP, _deleteSupplier, apStartEdit, _apCommit, _apCancel, apAddRow, _apKey };
})();
window.APModule = APModule;
