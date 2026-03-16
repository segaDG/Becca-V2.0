/* ============================================
   BECCA V2.0 — Kas Kecil Module
   Spreadsheet-style: click row to edit inline
   Only 1 row editable at a time (no browser crash)
============================================ */
const KasModule = (() => {
  let _kas  = [];
  let _masuk= [];
  let _activeTab = 'transaksi';
  let _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'' };
  let _page   = 1;
  const _perPage = 100;
  let _editingId  = null; // currently editing row id

  const TYPES = ['Raw Food','Sayuran','Buah segar','Raw Materials','Minuman','Snack',
    'Kasbon','Gaji','Bensin','Maintenance','OP.Expense','B.Logistik',
    'Listrik PLN','PDAM','Pulsa','Pajak','Kas','Lain-lain'];
  const SATUANS = ['Kg','Pcs','Bks','Box','Btl','Kli','Prsi','Gbng','Ikt','Lbr',
    'Pack','Bag','Ltr','Unit','Rim','Rol','Sak','Dus'];
  const MONTHS  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-kas');
    page.innerHTML = _renderShell();
    [_kas, _masuk] = await Promise.all([DB.getKas(), DB.getKasMasuk()]);
    switchTab('transaksi');
    _injectStyles();
  }

  function _injectStyles() {
    if (document.getElementById('kas-ss-style')) return;
    const s = document.createElement('style');
    s.id = 'kas-ss-style';
    s.textContent = `
      .ks-tbl { width:100%; border-collapse:collapse; font-size:13px; }
      .ks-tbl th {
        background:var(--surface2); color:var(--text-3); font-size:10px;
        text-transform:uppercase; letter-spacing:.05em; padding:7px 8px;
        border:1px solid var(--border); white-space:nowrap;
        position:sticky; top:0; z-index:2;
      }
      .ks-tbl td {
        border:1px solid var(--border); padding:0; height:32px;
        background:var(--surface); vertical-align:middle;
      }
      .ks-tbl td .ks-cell {
        display:flex; align-items:center; padding:0 8px;
        height:32px; cursor:cell; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis; max-width:200px;
      }
      .ks-tbl tr.ks-view:hover td { background:var(--surface2); cursor:pointer; }
      .ks-tbl tr.ks-editing td { background:rgba(99,102,241,.06)!important; outline:1px solid var(--primary); outline-offset:-1px; }
      .ks-inp {
        width:100%; height:100%; border:none; outline:none; padding:0 6px;
        background:transparent; color:var(--text); font-size:13px;
        font-family:var(--font); box-sizing:border-box; min-height:32px;
      }
      .ks-sel {
        width:100%; height:32px; border:none; outline:none; padding:0 4px;
        background:var(--surface3); color:var(--text); font-size:12px;
        font-family:var(--font); cursor:pointer;
      }
      .ks-num { text-align:right; font-family:var(--font-mono); }
      .ks-num .ks-inp, .ks-num .ks-cell { justify-content:flex-end; text-align:right; }
      .ks-add-row {
        width:100%; padding:8px 12px; border:none; background:var(--surface2);
        color:var(--text-3); cursor:pointer; font-size:12px; text-align:left;
        border-top:1px solid var(--border); display:flex; align-items:center; gap:6px;
        transition:background .15s;
      }
      .ks-add-row:hover { background:var(--surface3); color:var(--primary-h); }
      .ks-del-btn {
        width:26px; height:26px; border:none; background:transparent; cursor:pointer;
        color:var(--text-3); border-radius:4px; display:flex; align-items:center;
        justify-content:center; margin:auto; transition:all .15s;
      }
      .ks-del-btn:hover { background:rgba(239,68,68,.15); color:var(--danger); }
      .ks-saved { animation: ksSave .5s ease; }
      @keyframes ksSave { 0%{background:rgba(34,197,94,.25)} 100%{background:transparent} }
      .ks-hint { font-size:11px; color:var(--text-3); padding:4px 8px; font-style:italic; }
    `;
    document.head.appendChild(s);
  }

  function _renderShell() {
    return `
      <div class="page-header">
        <div class="page-header-left"><h2>Kas Kecil</h2><p>Klik baris untuk edit langsung</p></div>
        <div class="page-header-right">
          <span id="kas-header-btn"></span>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="transaksi" onclick="KasModule.switchTab('transaksi')">Transaksi</button>
        <button class="tab-btn" data-tab="summary"    onclick="KasModule.switchTab('summary')">Summary</button>
        <button class="tab-btn" data-tab="monthly"    onclick="KasModule.switchTab('monthly')">Monthly Report</button>
        <button class="tab-btn" data-tab="cashflow"   onclick="KasModule.switchTab('cashflow')">Cash Flow</button>
      </div>
      <div id="kas-tab-transaksi"></div>
      <div id="kas-tab-summary"   style="display:none"></div>
      <div id="kas-tab-monthly"   style="display:none"></div>
      <div id="kas-tab-cashflow"  style="display:none"></div>
    `;
  }

  function switchTab(tab) {
    _activeTab = tab;
    ['transaksi','summary','monthly','cashflow'].forEach(t => {
      const el = document.getElementById('kas-tab-'+t);
      if (el) el.style.display = t===tab?'':'none';
      document.querySelector('[data-tab="'+t+'"]')?.classList.toggle('active', t===tab);
    });
    const hdr = document.getElementById('kas-header-btn');
    if (hdr) hdr.innerHTML = tab==='transaksi' && Auth.can('kas','edit')
      ? `<button class="btn btn-ghost btn-sm" onclick="KasModule.exportCSV()">Export CSV</button>` : '';
    if (tab==='transaksi') renderTransaksi();
    else if (tab==='summary')  renderSummary();
    else if (tab==='monthly')  renderMonthly();
    else if (tab==='cashflow') renderCashflow();
  }

  /* ===================== RENDER TRANSAKSI (SPREADSHEET) ===================== */
  function renderTransaksi() {
    const canEdit = Auth.can('kas','edit');
    const filtered = _applyFilter(_kas).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const total    = filtered.length;
    const paged    = filtered.slice((_page-1)*_perPage, _page*_perPage);
    const totalPages = Math.ceil(total/_perPage);
    const sumJumlah = filtered.reduce((s,r)=>s+(r.jumlah||0),0);
    const bulanOpts = [...new Set(_kas.map(r=>r.bulan).filter(Boolean))].sort();

    document.getElementById('kas-tab-transaksi').innerHTML = `
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${_summaryStrip(filtered)}
      </div>
      <div class="filter-bar" style="margin-bottom:var(--s3)">
        <input type="date" class="form-control" value="${_filter.dateFrom}" onchange="KasModule.setFilter('dateFrom',this.value)" style="width:140px">
        <input type="date" class="form-control" value="${_filter.dateTo}"   onchange="KasModule.setFilter('dateTo',this.value)"   style="width:140px">
        <select class="form-control" onchange="KasModule.setFilter('bulan',this.value)" style="width:130px">
          <option value="">Semua Bulan</option>
          ${bulanOpts.map(b=>`<option value="${b}" ${_filter.bulan===b?'selected':''}>${b}</option>`).join('')}
        </select>
        <select class="form-control" onchange="KasModule.setFilter('type',this.value)" style="width:150px">
          <option value="">Semua Type</option>
          ${TYPES.map(t=>`<option value="${t}" ${_filter.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <select class="form-control" onchange="KasModule.setFilter('status',this.value)" style="width:120px">
          <option value="">Semua Status</option>
          <option value="DONE" ${_filter.status==='DONE'?'selected':''}>DONE</option>
          <option value="TBC"  ${_filter.status==='TBC' ?'selected':''}>TBC</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="KasModule.resetFilter()">↺ Reset</button>
        <span class="text-muted text-small" style="margin-left:auto">${total} baris · ${Utils.formatRupiah(sumJumlah)}</span>
      </div>
      ${canEdit ? `<div class="ks-hint">💡 Klik baris untuk edit langsung. Tekan Enter atau klik baris lain untuk simpan.</div>` : ''}
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="ks-tbl" id="kas-grid">
          <thead><tr>
            <th style="width:32px">#</th>
            <th style="width:108px">Tanggal</th>
            <th style="min-width:180px">Nama / Keterangan</th>
            <th style="width:130px">Type</th>
            <th style="width:110px">Vendor</th>
            <th style="width:55px" class="ks-num">Qty</th>
            <th style="width:55px">Sat</th>
            <th style="width:105px" class="ks-num">Harga/Sat</th>
            <th style="width:115px" class="ks-num">Total (Rp)</th>
            <th style="width:100px">Penerima</th>
            <th style="width:75px">Status</th>
            <th style="width:65px">Bulan</th>
            ${canEdit ? '<th style="width:32px"></th>' : ''}
          </tr></thead>
          <tbody id="kas-tbody">
            ${paged.map((r,i)=>_rowView(r, (_page-1)*_perPage+i+1, canEdit)).join('')}
          </tbody>
        </table>
        ${canEdit ? `
          <button class="ks-add-row" onclick="KasModule.addRow()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
            + Baris Baru
          </button>` : ''}
      </div>
      ${totalPages > 1 ? `
        <div class="pagination" style="margin-top:var(--s3)">
          <span class="pagination-info">Hal ${_page}/${totalPages} · ${total} baris</span>
          <div class="pagination-controls">
            <button class="page-btn" onclick="KasModule.goPage(${_page-1})" ${_page<=1?'disabled':''}>‹</button>
            ${Array.from({length:Math.min(totalPages,7)},(_,i)=>{
              const p=_page<=4?i+1:_page+i-3;
              return p>=1&&p<=totalPages?`<button class="page-btn ${p===_page?'active':''}" onclick="KasModule.goPage(${p})">${p}</button>`:'';
            }).join('')}
            <button class="page-btn" onclick="KasModule.goPage(${_page+1})" ${_page>=totalPages?'disabled':''}>›</button>
          </div>
        </div>` : ''}
    `;
  }

  /* ---- ROW: VIEW MODE (read-only, lightweight) ---- */
  function _rowView(r, rowNum, canEdit) {
    const statusCls = r.status==='DONE' ? 'badge-success' : 'badge-warning';
    return `<tr class="ks-view" id="ks-row-${r.id}" data-id="${r.id}"
              ${canEdit ? `onclick="KasModule.startEdit('${r.id}')"` : ''}>
      <td><div class="ks-cell" style="justify-content:center;color:var(--text-3);font-size:11px">${rowNum}</div></td>
      <td><div class="ks-cell">${r.tgl||''}</div></td>
      <td><div class="ks-cell">${r.nama||''}</div></td>
      <td><div class="ks-cell"><span class="badge badge-neutral" style="font-size:10px">${r.type||''}</span></div></td>
      <td><div class="ks-cell">${r.vendor||''}</div></td>
      <td class="ks-num"><div class="ks-cell">${r.qty||0}</div></td>
      <td><div class="ks-cell">${r.satuan||''}</div></td>
      <td class="ks-num"><div class="ks-cell">${Utils.formatRupiah(r.hargaSatuan||0)}</div></td>
      <td class="ks-num"><div class="ks-cell"><strong>${Utils.formatRupiah(r.jumlah||0)}</strong></div></td>
      <td><div class="ks-cell">${r.penerima||''}</div></td>
      <td><div class="ks-cell"><span class="badge ${statusCls}" style="font-size:10px">${r.status||''}</span></div></td>
      <td><div class="ks-cell">${r.bulan||''}</div></td>
      ${canEdit ? `<td><button class="ks-del-btn" onclick="event.stopPropagation();KasModule.deleteRow('${r.id}')" title="Hapus">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
          <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
        </svg></button></td>` : ''}
    </tr>`;
  }

  /* ---- ROW: EDIT MODE (inline inputs, only for 1 row at a time) ---- */
  function _rowEdit(r, rowNum, canEdit) {
    const typeOpts   = TYPES.map(t=>`<option value="${t}" ${r.type===t?'selected':''}>${t}</option>`).join('');
    const statusOpts = ['DONE','TBC'].map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('');
    const bulanOpts  = MONTHS.map(m=>`<option value="${m}" ${r.bulan===m?'selected':''}>${m}</option>`).join('');
    return `<tr class="ks-editing" id="ks-row-${r.id}" data-id="${r.id}">
      <td><div class="ks-cell" style="justify-content:center;color:var(--primary-h);font-size:11px">${rowNum}</div></td>
      <td><input class="ks-inp" type="date" value="${r.tgl||''}" onchange="KasModule._setField('${r.id}','tgl',this.value)"></td>
      <td><input class="ks-inp" type="text" value="${(r.nama||'').replace(/"/g,'&quot;')}" placeholder="Nama/keterangan"
            oninput="KasModule._setField('${r.id}','nama',this.value)"
            onkeydown="if(event.key==='Enter')KasModule.commitEdit('${r.id}')"></td>
      <td><select class="ks-sel" onchange="KasModule._setField('${r.id}','type',this.value)">${typeOpts}</select></td>
      <td><input class="ks-inp" type="text" value="${(r.vendor||'').replace(/"/g,'&quot;')}" placeholder="Vendor"
            oninput="KasModule._setField('${r.id}','vendor',this.value)"></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" step="0.01" value="${r.qty||0}"
            oninput="KasModule._setAndCalc('${r.id}','qty',this.value)"
            style="text-align:right"></td>
      <td><input class="ks-inp" type="text" value="${r.satuan||''}" list="ks-sat-lst" placeholder="Sat"
            oninput="KasModule._setField('${r.id}','satuan',this.value)">
          <datalist id="ks-sat-lst">${SATUANS.map(s=>`<option value="${s}">`).join('')}</datalist>
      </td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" value="${r.hargaSatuan||0}"
            oninput="KasModule._setAndCalc('${r.id}','hargaSatuan',this.value)"
            style="text-align:right"></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" value="${r.jumlah||0}"
            id="ks-jumlah-${r.id}" style="text-align:right;font-weight:700"
            oninput="KasModule._setField('${r.id}','jumlah',parseFloat(this.value)||0)"
            onkeydown="if(event.key==='Enter')KasModule.commitEdit('${r.id}')"></td>
      <td><input class="ks-inp" type="text" value="${(r.penerima||'').replace(/"/g,'&quot;')}" placeholder="Penerima"
            oninput="KasModule._setField('${r.id}','penerima',this.value)"></td>
      <td><select class="ks-sel" onchange="KasModule._setField('${r.id}','status',this.value)">${statusOpts}</select></td>
      <td><select class="ks-sel" onchange="KasModule._setField('${r.id}','bulan',this.value)">${bulanOpts}</select></td>
      ${canEdit ? `<td>
        <button class="ks-del-btn" style="color:var(--success);border:1px solid var(--success)"
          onclick="KasModule.commitEdit('${r.id}')" title="Simpan (Enter)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
        </button></td>` : ''}
    </tr>`;
  }

  /* ===================== EDIT LOGIC ===================== */
  function startEdit(id) {
    if (_editingId === id) return;
    // Save previous if any
    if (_editingId) commitEdit(_editingId);
    _editingId = id;

    const row   = _kas.find(r=>r.id===id);
    const trEl  = document.getElementById('ks-row-'+id);
    if (!row || !trEl) return;

    // Get row number from current position in tbody
    const tbody    = document.getElementById('kas-tbody');
    const allRows  = Array.from(tbody.querySelectorAll('tr'));
    const rowNum   = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
    const canEdit  = Auth.can('kas','edit');

    trEl.outerHTML = _rowEdit(row, rowNum, canEdit);

    // Click outside to commit
    setTimeout(() => {
      document.addEventListener('click', _outsideClickHandler);
    }, 100);
  }

  function _outsideClickHandler(e) {
    if (!_editingId) { document.removeEventListener('click', _outsideClickHandler); return; }
    const editingRow = document.getElementById('ks-row-'+_editingId);
    if (editingRow && !editingRow.contains(e.target)) {
      commitEdit(_editingId);
      document.removeEventListener('click', _outsideClickHandler);
    }
  }

  // Temp storage for unsaved changes
  let _pendingChanges = {};
  function _setField(id, field, value) {
    if (!_pendingChanges[id]) _pendingChanges[id] = {};
    _pendingChanges[id][field] = value;
  }
  function _setAndCalc(id, field, value) {
    _setField(id, field, parseFloat(value)||0);
    // Auto-calc jumlah
    const row = _kas.find(r=>r.id===id);
    if (!row) return;
    const pending = _pendingChanges[id] || {};
    const qty     = parseFloat(field==='qty'?value:(pending.qty??row.qty)) || 0;
    const harga   = parseFloat(field==='hargaSatuan'?value:(pending.hargaSatuan??row.hargaSatuan)) || 0;
    const newTotal = Math.round(qty * harga);
    if (newTotal > 0) {
      _setField(id, 'jumlah', newTotal);
      const jumlahEl = document.getElementById('ks-jumlah-'+id);
      if (jumlahEl) jumlahEl.value = newTotal;
    }
  }

  async function commitEdit(id) {
    if (_editingId !== id) return;
    _editingId = null;

    const row     = _kas.find(r=>r.id===id);
    const changes = _pendingChanges[id] || {};
    delete _pendingChanges[id];
    if (!row) return;

    // Apply changes
    Object.assign(row, changes);

    // Switch back to view mode
    const trEl = document.getElementById('ks-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('kas-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
      trEl.outerHTML = _rowView(row, rowNum, true);
    }

    // Save to DB
    try {
      await DB.saveKas(row);
      DB.logActivity({type:'edit_kas', detail:`Edit: ${row.nama||id}`});
      // Flash saved
      const newTr = document.getElementById('ks-row-'+id);
      if (newTr) { newTr.classList.add('ks-saved'); setTimeout(()=>newTr.classList.remove('ks-saved'),500); }
    } catch(e) { Notify.error('Gagal simpan', e.message); }
  }

  /* ===================== ADD / DELETE ROW ===================== */
  async function addRow() {
    // Commit any pending edit first
    if (_editingId) await commitEdit(_editingId);
    const today = new Date().toISOString().split('T')[0];
    const mo    = parseInt(today.split('-')[1]) - 1;
    const newRow = {
      tgl:today, nama:'', type:TYPES[0], vendor:'',
      qty:1, satuan:'Pcs', hargaSatuan:0, jumlah:0,
      penerima:'', status:'TBC', bulan:MONTHS[mo],
    };
    try {
      const saved = await DB.saveKas(newRow);
      _kas.unshift(saved);
      DB.logActivity({type:'add_kas', detail:'Baris baru'});
      renderTransaksi();
      // Auto-start edit on new row
      setTimeout(()=>startEdit(saved.id), 80);
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  async function deleteRow(id) {
    if (_editingId===id) { _editingId=null; delete _pendingChanges[id]; }
    const ok = await Modal.confirm({title:'Hapus Baris',message:'Baris ini akan dihapus permanen.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    const mid = Utils.uid();
    try {
      await DB.deleteKas(id);
      _kas = _kas.filter(r=>r.id!==id);
      DB.logActivity({type:'delete_kas', detail:'Baris dihapus'});
      renderTransaksi();
      Notify.success('Baris dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  /* ===================== FILTER & PAGE ===================== */
  function _applyFilter(data) {
    return data.filter(r=>{
      if (_filter.bulan   && r.bulan !==_filter.bulan)   return false;
      if (_filter.type    && r.type  !==_filter.type)    return false;
      if (_filter.status  && r.status!==_filter.status)  return false;
      if (_filter.dateFrom && r.tgl  < _filter.dateFrom) return false;
      if (_filter.dateTo  && r.tgl   > _filter.dateTo)   return false;
      return true;
    });
  }
  function setFilter(k,v){ _filter[k]=v; _page=1; _editingId=null; renderTransaksi(); }
  function resetFilter()  { _filter={}; _page=1; _editingId=null; renderTransaksi(); }
  function goPage(p)      { if(_editingId) commitEdit(_editingId); _page=p; renderTransaksi(); }

  /* ===================== SUMMARY STRIP ===================== */
  function _summaryStrip(data) {
    const done=data.filter(r=>r.status==='DONE');
    const tbc =data.filter(r=>r.status==='TBC');
    return [
      {l:'Total Keluar', v:Utils.formatRupiah(data.reduce((s,r)=>s+(r.jumlah||0),0),true), c:'var(--danger)'},
      {l:'Confirmed',    v:Utils.formatRupiah(done.reduce((s,r)=>s+(r.jumlah||0),0),true), c:'var(--success)'},
      {l:'TBC',          v:Utils.formatRupiah(tbc.reduce((s,r)=>s+(r.jumlah||0),0),true),  c:'var(--warning)'},
      {l:'Total Baris',  v:data.length+' baris', c:'var(--primary-h)'},
    ].map(c=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:140px">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${c.l}</div>
        <div style="font-size:18px;font-weight:700;color:${c.c};font-family:var(--font-mono)">${c.v}</div>
      </div>`).join('');
  }

  /* ===================== EXPORT CSV ===================== */
  function exportCSV() {
    const data=_applyFilter(_kas).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const hdr=['Tanggal','Nama','Type','Vendor','Qty','Satuan','Harga/Sat','Total','Penerima','Status','Bulan'];
    const rows=data.map(r=>[r.tgl,r.nama,r.type,r.vendor,r.qty,r.satuan,r.hargaSatuan,r.jumlah,r.penerima,r.status,r.bulan]
      .map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const csv=[hdr.join(','),...rows].join('\n');
    const a=Object.assign(document.createElement('a'),{
      href:URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),
      download:`kas-kecil-${new Date().toISOString().split('T')[0]}.csv`
    });
    a.click(); URL.revokeObjectURL(a.href);
    Notify.success('CSV berhasil di-export');
  }

  /* ===================== SUMMARY TAB ===================== */
  function renderSummary() {
    const byType  = Utils.groupBy(_kas,'type');
    const byBulan = Utils.groupBy(_kas,'bulan');
    const typeRows= Object.entries(byType).map(([type,rows])=>({type,total:Utils.sumBy(rows,'jumlah'),count:rows.length})).sort((a,b)=>b.total-a.total);
    const grand   = typeRows.reduce((s,r)=>s+r.total,0);
    document.getElementById('kas-tab-summary').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s5)">
        <div class="card"><div class="card-header"><div class="card-title">Per Kategori</div></div>
          <table class="table"><thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">Baris</th><th class="num">%</th></tr></thead>
          <tbody>${typeRows.map(r=>`<tr>
            <td><span class="badge badge-neutral">${r.type}</span></td>
            <td class="num">${Utils.formatRupiah(r.total)}</td>
            <td class="num text-muted">${r.count}</td>
            <td class="num"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
              <div style="width:50px;height:4px;background:var(--border);border-radius:2px">
                <div style="width:${Math.round(r.total/grand*100)}%;height:100%;background:var(--primary);border-radius:2px"></div>
              </div><span class="text-small">${Math.round(r.total/grand*100)}%</span>
            </div></td></tr>`).join('')}
            <tr style="background:var(--surface2)"><td><strong>TOTAL</strong></td><td class="num"><strong>${Utils.formatRupiah(grand)}</strong></td><td class="num text-muted">${_kas.length}</td><td class="num">100%</td></tr>
          </tbody></table>
        </div>
        <div class="card"><div class="card-header"><div class="card-title">Per Bulan</div></div>
          <table class="table"><thead><tr><th>Bulan</th><th class="num">Total</th><th class="num">Baris</th></tr></thead>
          <tbody>${Object.keys(byBulan).sort().map(b=>{const rows=byBulan[b];return`<tr><td><strong>${b}</strong></td><td class="num">${Utils.formatRupiah(Utils.sumBy(rows,'jumlah'))}</td><td class="num text-muted">${rows.length}</td></tr>`;}).join('')}</tbody>
        </table></div>
      </div>`;
  }

  /* ===================== MONTHLY REPORT ===================== */
  function renderMonthly() {
    const opts=[...new Set(_kas.map(r=>r.bulan).filter(Boolean))].sort();
    const sel=opts[opts.length-1]||'';
    document.getElementById('kas-tab-monthly').innerHTML=`
      <div class="filter-bar" style="margin-bottom:var(--s5)">
        <select class="form-control" style="width:160px" onchange="KasModule.renderMonthlyTable(this.value)">
          ${opts.map(b=>`<option value="${b}" ${b===sel?'selected':''}>${b}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="window.print()">Print / PDF</button>
      </div>
      <div id="monthly-table-wrap"></div>`;
    renderMonthlyTable(sel);
  }

  function renderMonthlyTable(bulan) {
    const rows=_kas.filter(r=>r.bulan===bulan);
    const byType=Utils.groupBy(rows,'type');
    const grand=Utils.sumBy(rows,'jumlah');
    document.getElementById('monthly-table-wrap').innerHTML=`
      <div class="card">
        <div class="card-header"><div class="card-title">Laporan Kas Kecil — ${bulan}</div>
          <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--danger)">${Utils.formatRupiah(grand)}</div>
        </div>
        ${Object.entries(byType).sort((a,b)=>Utils.sumBy(b[1],'jumlah')-Utils.sumBy(a[1],'jumlah')).map(([type,items])=>`
          <div style="margin-bottom:var(--s4)">
            <div class="section-title" style="display:flex;justify-content:space-between">
              <span>${type}</span><span style="font-family:var(--font-mono)">${Utils.formatRupiah(Utils.sumBy(items,'jumlah'))}</span>
            </div>
            <table class="table" style="font-size:12px">
              <thead><tr><th>Tgl</th><th>Nama</th><th>Vendor</th><th class="num">Qty</th><th>Sat</th><th class="num">Harga</th><th class="num">Total</th><th>Status</th></tr></thead>
              <tbody>${items.map(r=>`<tr>
                <td style="white-space:nowrap">${Utils.formatDate(r.tgl,'dd/mm/yyyy')}</td>
                <td>${r.nama}</td><td class="text-muted">${r.vendor||'-'}</td>
                <td class="num">${r.qty||0}</td><td class="text-muted">${r.satuan||''}</td>
                <td class="num">${Utils.formatRupiah(r.hargaSatuan)}</td>
                <td class="num"><strong>${Utils.formatRupiah(r.jumlah)}</strong></td>
                <td><span class="badge ${r.status==='DONE'?'badge-success':'badge-warning'}">${r.status}</span></td>
              </tr>`).join('')}</tbody>
            </table>
          </div>`).join('')}
      </div>`;
  }

  /* ===================== CASH FLOW ===================== */
  function renderCashflow() {
    const mD={}, kD={};
    _masuk.forEach(r=>{mD[r.tgl]=(mD[r.tgl]||0)+r.kredit;});
    _kas.filter(r=>r.status==='DONE').forEach(r=>{kD[r.tgl]=(kD[r.tgl]||0)+r.jumlah;});
    const dates=[...new Set([...Object.keys(mD),...Object.keys(kD)])].sort();
    let bal=0;
    const rows=dates.map(tgl=>{const m=mD[tgl]||0,k=kD[tgl]||0;bal+=m-k;return{tgl,m,k,bal};});
    const tM=rows.reduce((s,r)=>s+r.m,0),tK=rows.reduce((s,r)=>s+r.k,0),net=tM-tK;
    document.getElementById('kas-tab-cashflow').innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-bottom:var(--s5)">
        ${[{l:'Kas Masuk',v:Utils.formatRupiah(tM,true),c:'var(--success)'},{l:'Kas Keluar',v:Utils.formatRupiah(tK,true),c:'var(--danger)'},{l:net>=0?'Surplus':'Defisit',v:Utils.formatRupiah(Math.abs(net),true),c:net>=0?'var(--success)':'var(--danger)'}]
          .map(s=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:20px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>`).join('')}
      </div>
      <div class="table-wrapper"><div class="table-scroll"><table class="table">
        <thead><tr><th>Tanggal</th><th class="num" style="color:var(--success)">Kas Masuk</th><th class="num" style="color:var(--danger)">Kas Keluar</th><th class="num">Net</th><th class="num">Balance</th></tr></thead>
        <tbody>${rows.map(r=>{const n=r.m-r.k;return`<tr>
          <td style="white-space:nowrap">${Utils.formatDate(r.tgl,'dd mmm yyyy')}</td>
          <td class="num" style="color:var(--success)">${r.m?Utils.formatRupiah(r.m):'-'}</td>
          <td class="num" style="color:var(--danger)">${r.k?Utils.formatRupiah(r.k):'-'}</td>
          <td class="num" style="color:${n>=0?'var(--success)':'var(--danger)'};font-weight:600">${n?Utils.formatRupiah(Math.abs(n)):'-'}</td>
          <td class="num"><strong style="color:${r.bal>=0?'var(--text)':'var(--danger)'}">${Utils.formatRupiah(r.bal)}</strong></td>
        </tr>`;}).join('')}</tbody>
      </table></div></div>`;
  }

  return { init, switchTab, setFilter, resetFilter, goPage, addRow, startEdit, commitEdit, _setField, _setAndCalc, deleteRow, renderMonthlyTable, exportCSV };
})();
window.KasModule = KasModule;
