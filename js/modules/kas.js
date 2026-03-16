/* ============================================
   BECCA V2.0 — Kas Kecil Module
   Spreadsheet-style inline editing
============================================ */
const KasModule = (() => {
  let _kas  = [];
  let _masuk= [];
  let _activeTab = 'transaksi';
  let _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'' };
  let _page = 1;
  const _perPage = 100;
  let _editingCell = null; // {rowId, field}

  const TYPES = ['Raw Food','Sayuran','Buah segar','Raw Materials','Minuman','Snack',
    'Kasbon','Gaji','Bensin','Maintenance','OP.Expense','B.Logistik',
    'Listrik PLN','PDAM','Pulsa','Pajak','Kas','Lain-lain'];
  const SATUANS = ['Kg','Pcs','Bks','Box','Btl','Kli','Prsi','Gbng','Ikt','Lbr',
    'Pack','Bag','Ltr','Unit','Rim','Rol','Sak','Dus'];

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-kas');
    page.innerHTML = _renderShell();
    [_kas, _masuk] = await Promise.all([DB.getKas(), DB.getKasMasuk()]);
    switchTab('transaksi');
    _injectStyles();
  }

  function _injectStyles() {
    if (document.getElementById('kas-spreadsheet-style')) return;
    const style = document.createElement('style');
    style.id = 'kas-spreadsheet-style';
    style.textContent = `
      .ks-table { width:100%; border-collapse:collapse; font-size:13px; }
      .ks-table th {
        background:var(--surface2); color:var(--text-3); font-size:10px;
        text-transform:uppercase; letter-spacing:.05em; padding:7px 8px;
        border:1px solid var(--border); white-space:nowrap; position:sticky; top:0; z-index:2;
      }
      .ks-table td {
        border:1px solid var(--border); padding:0; height:34px;
        background:var(--surface); vertical-align:middle; position:relative;
      }
      .ks-table tr:hover td { background:var(--surface2); }
      .ks-table tr.editing-row td { background:rgba(99,102,241,.05); }
      .ks-cell {
        display:flex; align-items:center; width:100%; height:100%;
        padding:0 8px; cursor:cell; box-sizing:border-box;
        min-height:34px; color:var(--text);
      }
      .ks-cell:hover { background:rgba(99,102,241,.08); }
      .ks-input {
        width:100%; height:100%; border:none; outline:none; padding:0 8px;
        background:transparent; color:var(--text); font-size:13px; font-family:var(--font);
        box-sizing:border-box; min-height:34px;
      }
      .ks-select {
        width:100%; height:100%; border:none; outline:none; padding:0 6px;
        background:var(--surface3); color:var(--text); font-size:12px; font-family:var(--font);
        cursor:pointer;
      }
      .ks-table td.editing {
        outline:2px solid var(--primary); outline-offset:-2px;
        background:var(--surface) !important; z-index:3;
      }
      .ks-table td.num { text-align:right; }
      .ks-table td.num .ks-cell { justify-content:flex-end; font-family:var(--font-mono); }
      .ks-table td.num .ks-input { text-align:right; font-family:var(--font-mono); }
      .ks-add-row {
        width:100%; padding:7px; border:none; background:var(--surface2);
        color:var(--text-3); cursor:pointer; text-align:left; font-size:12px;
        border-top:1px solid var(--border); display:flex; align-items:center; gap:6px;
        transition:background var(--t-base);
      }
      .ks-add-row:hover { background:var(--surface3); color:var(--primary-h); }
      .ks-row-num { color:var(--text-3); font-size:11px; text-align:center; width:32px; user-select:none; }
      .ks-del-btn {
        width:24px; height:24px; border:none; background:transparent; cursor:pointer;
        color:var(--text-3); border-radius:4px; display:flex; align-items:center;
        justify-content:center; flex-shrink:0; transition:all .15s;
      }
      .ks-del-btn:hover { background:rgba(239,68,68,.15); color:var(--danger); }
      .ks-saved { animation: ksSave .6s ease; }
      @keyframes ksSave { 0%{background:rgba(34,197,94,.2)} 100%{background:transparent} }
    `;
    document.head.appendChild(style);
  }

  function _renderShell() {
    return `
      <div class="page-header">
        <div class="page-header-left"><h2>Kas Kecil</h2><p>Manajemen kas operasional harian</p></div>
        <div class="page-header-right" id="kas-header-actions"></div>
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
      if (el) el.style.display = t===tab ? '' : 'none';
      document.querySelector('[data-tab="'+t+'"]')?.classList.toggle('active', t===tab);
    });
    const hdr = document.getElementById('kas-header-actions');
    if (hdr) hdr.innerHTML = tab==='transaksi' && Auth.can('kas','edit') ? `
      <button class="btn btn-ghost btn-sm" onclick="KasModule.exportCSV()">Export CSV</button>` : '';
    if (tab==='transaksi') renderTransaksi();
    else if (tab==='summary')  renderSummary();
    else if (tab==='monthly')  renderMonthly();
    else if (tab==='cashflow') renderCashflow();
  }

  /* ===================== SPREADSHEET RENDER ===================== */
  function renderTransaksi() {
    const canEdit = Auth.can('kas','edit');
    const filtered = _applyFilter(_kas).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const total = filtered.length;
    const paged = filtered.slice((_page-1)*_perPage, _page*_perPage);
    const sumJumlah = filtered.reduce((s,r)=>s+(r.jumlah||0),0);
    const bulanOpts = [...new Set(_kas.map(r=>r.bulan).filter(Boolean))].sort();

    document.getElementById('kas-tab-transaksi').innerHTML = `
      <!-- Summary strip -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${_summaryStrip(filtered)}
      </div>
      <!-- Filter Bar -->
      <div class="filter-bar" style="margin-bottom:var(--s3)">
        <input type="date" class="form-control" value="${_filter.dateFrom}" onchange="KasModule.setFilter('dateFrom',this.value)" style="width:140px" placeholder="Dari">
        <input type="date" class="form-control" value="${_filter.dateTo}"   onchange="KasModule.setFilter('dateTo',this.value)"   style="width:140px" placeholder="Sampai">
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
      <!-- Spreadsheet Table -->
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="ks-table" id="kas-grid">
          <thead>
            <tr>
              <th style="width:32px">#</th>
              <th style="width:110px">Tanggal</th>
              <th style="min-width:180px">Nama / Keterangan</th>
              <th style="width:140px">Type</th>
              <th style="width:120px">Vendor</th>
              <th style="width:60px" class="num">Qty</th>
              <th style="width:60px">Sat</th>
              <th style="width:110px" class="num">Harga/Sat</th>
              <th style="width:120px" class="num">Total (Rp)</th>
              <th style="width:100px">Penerima</th>
              <th style="width:80px">Status</th>
              <th style="width:80px">Bulan</th>
              ${canEdit ? '<th style="width:32px"></th>' : ''}
            </tr>
          </thead>
          <tbody id="kas-tbody">
            ${paged.map((r,i)=>_renderRow(r, (_page-1)*_perPage+i+1, canEdit)).join('')}
          </tbody>
        </table>
        ${canEdit ? `
        <button class="ks-add-row" onclick="KasModule.addRow()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          + Baris Baru
        </button>` : ''}
      </div>
      <!-- Pagination -->
      ${total > _perPage ? `
      <div class="pagination" style="margin-top:var(--s3)">
        <span class="pagination-info">Halaman ${_page} dari ${Math.ceil(total/_perPage)} · ${total} baris</span>
        <div class="pagination-controls">
          <button class="page-btn" onclick="KasModule.goPage(${_page-1})" ${_page<=1?'disabled':''}>‹</button>
          <button class="page-btn" onclick="KasModule.goPage(${_page+1})" ${_page>=Math.ceil(total/_perPage)?'disabled':''}>›</button>
        </div>
      </div>` : ''}
    `;
  }

  function _renderRow(r, rowNum, canEdit) {
    const typeOpts = TYPES.map(t=>`<option value="${t}" ${r.type===t?'selected':''}>${t}</option>`).join('');
    const satOpts  = SATUANS.map(s=>`<option value="${s}" ${r.satuan===s?'selected':''}>${s}</option>`).join('');
    const statusOpts = ['DONE','TBC'].map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('');
    const bulanOpts  = (Utils.MONTHS||['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'])
      .map(m=>`<option value="${m}" ${r.bulan===m?'selected':''}>${m}</option>`).join('');

    if (!canEdit) {
      return `<tr data-id="${r.id}">
        <td class="ks-row-num"><div class="ks-cell" style="justify-content:center">${rowNum}</div></td>
        <td><div class="ks-cell">${r.tgl||''}</div></td>
        <td><div class="ks-cell">${r.nama||''}</div></td>
        <td><div class="ks-cell"><span class="badge badge-neutral">${r.type||''}</span></div></td>
        <td><div class="ks-cell">${r.vendor||''}</div></td>
        <td class="num"><div class="ks-cell">${r.qty||0}</div></td>
        <td><div class="ks-cell">${r.satuan||''}</div></td>
        <td class="num"><div class="ks-cell">${Utils.formatRupiah(r.hargaSatuan||0)}</div></td>
        <td class="num"><div class="ks-cell"><strong>${Utils.formatRupiah(r.jumlah||0)}</strong></div></td>
        <td><div class="ks-cell">${r.penerima||''}</div></td>
        <td><div class="ks-cell"><span class="badge ${r.status==='DONE'?'badge-success':'badge-warning'}">${r.status||''}</span></div></td>
        <td><div class="ks-cell">${r.bulan||''}</div></td>
      </tr>`;
    }

    return `<tr data-id="${r.id}" id="ks-row-${r.id}">
      <td class="ks-row-num"><div class="ks-cell" style="justify-content:center;color:var(--text-3);font-size:11px">${rowNum}</div></td>
      <td title="Klik untuk edit tanggal">
        <input class="ks-input" type="date" value="${r.tgl||''}"
          onchange="KasModule.saveCell('${r.id}','tgl',this.value)"
          style="padding:0 6px">
      </td>
      <td>
        <input class="ks-input" type="text" value="${(r.nama||'').replace(/"/g,'&quot;')}"
          placeholder="Nama / keterangan"
          onblur="KasModule.saveCell('${r.id}','nama',this.value)"
          onkeydown="if(event.key==='Enter'||event.key==='Tab'){KasModule.saveCell('${r.id}','nama',this.value);}">
      </td>
      <td>
        <select class="ks-select" onchange="KasModule.saveCell('${r.id}','type',this.value)">
          ${typeOpts}
        </select>
      </td>
      <td>
        <input class="ks-input" type="text" value="${(r.vendor||'').replace(/"/g,'&quot;')}"
          placeholder="Vendor"
          onblur="KasModule.saveCell('${r.id}','vendor',this.value)"
          onkeydown="if(event.key==='Enter'||event.key==='Tab')KasModule.saveCell('${r.id}','vendor',this.value)">
      </td>
      <td class="num">
        <input class="ks-input" type="number" min="0" step="0.01" value="${r.qty||0}"
          onblur="KasModule.saveCellCalc('${r.id}','qty',this.value)"
          onkeydown="if(event.key==='Enter')this.blur()" style="text-align:right">
      </td>
      <td>
        <input class="ks-input" type="text" value="${r.satuan||''}" list="ks-sat-list"
          placeholder="Sat"
          onblur="KasModule.saveCell('${r.id}','satuan',this.value)"
          onkeydown="if(event.key==='Enter')this.blur()">
        <datalist id="ks-sat-list">${SATUANS.map(s=>`<option value="${s}">`).join('')}</datalist>
      </td>
      <td class="num">
        <input class="ks-input" type="number" min="0" value="${r.hargaSatuan||0}"
          onblur="KasModule.saveCellCalc('${r.id}','hargaSatuan',this.value)"
          onkeydown="if(event.key==='Enter')this.blur()" style="text-align:right">
      </td>
      <td class="num">
        <input class="ks-input" type="number" min="0" value="${r.jumlah||0}"
          id="ks-jumlah-${r.id}"
          onblur="KasModule.saveCell('${r.id}','jumlah',parseFloat(this.value)||0)"
          onkeydown="if(event.key==='Enter')this.blur()" style="text-align:right;font-weight:700">
      </td>
      <td>
        <input class="ks-input" type="text" value="${(r.penerima||'').replace(/"/g,'&quot;')}"
          placeholder="Penerima"
          onblur="KasModule.saveCell('${r.id}','penerima',this.value)"
          onkeydown="if(event.key==='Enter')this.blur()">
      </td>
      <td>
        <select class="ks-select" onchange="KasModule.saveCell('${r.id}','status',this.value)"
          style="color:${r.status==='DONE'?'var(--success)':'var(--warning)'}">
          ${statusOpts}
        </select>
      </td>
      <td>
        <select class="ks-select" onchange="KasModule.saveCell('${r.id}','bulan',this.value)">
          ${bulanOpts}
        </select>
      </td>
      <td>
        <button class="ks-del-btn" onclick="KasModule.deleteRow('${r.id}')" title="Hapus baris">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </td>
    </tr>`;
  }

  /* ===================== CELL SAVE ===================== */
  async function saveCell(id, field, value) {
    const row = _kas.find(r=>r.id===id);
    if (!row) return;
    const oldVal = row[field];
    if (String(oldVal) === String(value)) return; // no change
    row[field] = value;
    try {
      await DB.saveKas(row);
      DB.logActivity({type:'edit_kas', detail:`Edit ${field}: ${row.nama||id}`});
      _flashRow(id);
    } catch(e) {
      Notify.error('Gagal simpan', e.message);
      row[field] = oldVal;
    }
  }

  async function saveCellCalc(id, field, value) {
    const row = _kas.find(r=>r.id===id);
    if (!row) return;
    row[field] = parseFloat(value) || 0;
    // Auto-calc total
    const newJumlah = Math.round((row.qty||0) * (row.hargaSatuan||0));
    if (newJumlah > 0) {
      row.jumlah = newJumlah;
      const jumlahInput = document.getElementById('ks-jumlah-'+id);
      if (jumlahInput) jumlahInput.value = newJumlah;
    }
    try {
      await DB.saveKas(row);
      DB.logActivity({type:'edit_kas', detail:`Edit ${field}: ${row.nama||id}`});
      _flashRow(id);
    } catch(e) {
      Notify.error('Gagal simpan', e.message);
    }
  }

  function _flashRow(id) {
    const row = document.getElementById('ks-row-'+id);
    if (!row) return;
    row.classList.remove('ks-saved');
    void row.offsetWidth;
    row.classList.add('ks-saved');
  }

  /* ===================== ADD ROW ===================== */
  async function addRow() {
    const today = new Date().toISOString().split('T')[0];
    const mo = parseInt(today.split('-')[1]) - 1;
    const MONTHS = Utils.MONTHS || ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const newRow = {
      tgl: today, nama:'', type: TYPES[0], vendor:'',
      qty:1, satuan:'Pcs', hargaSatuan:0, jumlah:0,
      penerima:'', status:'TBC', bulan: MONTHS[mo],
    };
    try {
      const saved = await DB.saveKas(newRow);
      _kas.unshift(saved);
      DB.logActivity({type:'add_kas', detail:'Baris baru ditambahkan'});
      renderTransaksi();
      // Focus first input of new row
      setTimeout(() => {
        const tbody = document.getElementById('kas-tbody');
        if (tbody) { const inp = tbody.querySelector('input[type="text"]'); inp?.focus(); }
      }, 100);
    } catch(e) { Notify.error('Gagal tambah baris', e.message); }
  }

  async function deleteRow(id) {
    const ok = await Modal.confirm({title:'Hapus Baris',message:'Baris ini akan dihapus permanen.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    const mid2 = Utils.uid();
    try {
      await DB.deleteKas(id);
      _kas = _kas.filter(r=>r.id!==id);
      DB.logActivity({type:'delete_kas', detail:'Baris dihapus'});
      renderTransaksi();
      Notify.success('Baris dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  /* ===================== FILTER & PAGINATION ===================== */
  function _applyFilter(data) {
    return data.filter(r => {
      if (_filter.bulan   && r.bulan  !== _filter.bulan)   return false;
      if (_filter.type    && r.type   !== _filter.type)    return false;
      if (_filter.status  && r.status !== _filter.status)  return false;
      if (_filter.dateFrom && r.tgl   <  _filter.dateFrom) return false;
      if (_filter.dateTo  && r.tgl    >  _filter.dateTo)   return false;
      return true;
    });
  }
  function setFilter(key, val) { _filter[key]=val; _page=1; renderTransaksi(); }
  function resetFilter()       { _filter={}; _page=1; renderTransaksi(); }
  function goPage(p)           { _page=p; renderTransaksi(); }

  /* ===================== SUMMARY STRIP ===================== */
  function _summaryStrip(data) {
    const done = data.filter(r=>r.status==='DONE');
    const tbc  = data.filter(r=>r.status==='TBC');
    return [
      {label:'Total Keluar',  val:Utils.formatRupiah(data.reduce((s,r)=>s+(r.jumlah||0),0),true), c:'var(--danger)'},
      {label:'Confirmed',     val:Utils.formatRupiah(done.reduce((s,r)=>s+(r.jumlah||0),0),true), c:'var(--success)'},
      {label:'TBC',           val:Utils.formatRupiah(tbc.reduce((s,r)=>s+(r.jumlah||0),0),true),  c:'var(--warning)'},
      {label:'Total Baris',   val:data.length+' baris', c:'var(--primary-h)'},
    ].map(c=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:140px">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${c.label}</div>
        <div style="font-size:18px;font-weight:700;color:${c.c};font-family:var(--font-mono)">${c.val}</div>
      </div>`).join('');
  }

  /* ===================== EXPORT CSV ===================== */
  function exportCSV() {
    const data = _applyFilter(_kas).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const headers = ['Tanggal','Nama','Type','Vendor','Qty','Satuan','Harga/Sat','Total','Penerima','Status','Bulan'];
    const rows = data.map(r=>[
      r.tgl, r.nama, r.type, r.vendor, r.qty, r.satuan,
      r.hargaSatuan, r.jumlah, r.penerima, r.status, r.bulan
    ].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `kas-kecil-${new Date().toISOString().split('T')[0]}.csv`
    });
    a.click(); URL.revokeObjectURL(a.href);
    Notify.success('CSV berhasil di-export');
  }

  /* ===================== SUMMARY TAB ===================== */
  function renderSummary() {
    const byType  = Utils.groupBy(_kas, 'type');
    const byBulan = Utils.groupBy(_kas, 'bulan');
    const bulanKeys = Object.keys(byBulan).sort();
    const typeRows = Object.entries(byType)
      .map(([type,rows])=>({type, total:Utils.sumBy(rows,'jumlah'), count:rows.length}))
      .sort((a,b)=>b.total-a.total);
    const grandTotal = typeRows.reduce((s,r)=>s+r.total,0);
    document.getElementById('kas-tab-summary').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s5)">
        <div class="card">
          <div class="card-header"><div class="card-title">Per Kategori</div></div>
          <table class="table"><thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">Baris</th><th class="num">%</th></tr></thead>
          <tbody>${typeRows.map(r=>`<tr>
            <td><span class="badge badge-neutral">${r.type}</span></td>
            <td class="num">${Utils.formatRupiah(r.total)}</td>
            <td class="num text-muted">${r.count}</td>
            <td class="num"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
              <div style="width:50px;height:4px;background:var(--border);border-radius:2px">
                <div style="width:${Math.round(r.total/grandTotal*100)}%;height:100%;background:var(--primary);border-radius:2px"></div>
              </div>
              <span class="text-small">${Math.round(r.total/grandTotal*100)}%</span>
            </div></td>
          </tr>`).join('')}
          <tr style="background:var(--surface2)"><td><strong>TOTAL</strong></td><td class="num"><strong>${Utils.formatRupiah(grandTotal)}</strong></td><td class="num text-muted">${_kas.length}</td><td class="num">100%</td></tr>
          </tbody></table>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Per Bulan</div></div>
          <table class="table"><thead><tr><th>Bulan</th><th class="num">Total</th><th class="num">Baris</th></tr></thead>
          <tbody>${bulanKeys.map(b=>{const rows=byBulan[b];return`<tr><td><strong>${b}</strong></td><td class="num">${Utils.formatRupiah(Utils.sumBy(rows,'jumlah'))}</td><td class="num text-muted">${rows.length}</td></tr>`;}).join('')}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ===================== MONTHLY REPORT ===================== */
  function renderMonthly() {
    const bulanOpts = [...new Set(_kas.map(r=>r.bulan).filter(Boolean))].sort();
    const sel = bulanOpts[bulanOpts.length-1]||'';
    document.getElementById('kas-tab-monthly').innerHTML = `
      <div class="filter-bar" style="margin-bottom:var(--s5)">
        <select class="form-control" id="monthly-bulan-sel" style="width:160px" onchange="KasModule.renderMonthlyTable(this.value)">
          ${bulanOpts.map(b=>`<option value="${b}" ${b===sel?'selected':''}>${b}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="window.print()">Print / PDF</button>
      </div>
      <div id="monthly-table-wrap"></div>`;
    renderMonthlyTable(sel);
  }

  function renderMonthlyTable(bulan) {
    const rows = _kas.filter(r=>r.bulan===bulan);
    const byType = Utils.groupBy(rows,'type');
    const grandTotal = Utils.sumBy(rows,'jumlah');
    document.getElementById('monthly-table-wrap').innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Laporan Kas Kecil — ${bulan}</div>
          <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--danger)">${Utils.formatRupiah(grandTotal)}</div>
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

  /* ===================== CASH FLOW TAB ===================== */
  function renderCashflow() {
    const masukByDate={}, keluarByDate={};
    _masuk.forEach(r=>{ masukByDate[r.tgl]=(masukByDate[r.tgl]||0)+r.kredit; });
    _kas.filter(r=>r.status==='DONE').forEach(r=>{ keluarByDate[r.tgl]=(keluarByDate[r.tgl]||0)+r.jumlah; });
    const allDates=[...new Set([...Object.keys(masukByDate),...Object.keys(keluarByDate)])].sort();
    let balance=0;
    const rows=allDates.map(tgl=>{
      const masuk=masukByDate[tgl]||0, keluar=keluarByDate[tgl]||0;
      balance+=masuk-keluar;
      return {tgl,masuk,keluar,balance};
    });
    const tM=Utils.sumBy(rows,'masuk'), tK=Utils.sumBy(rows,'keluar'), net=tM-tK;
    document.getElementById('kas-tab-cashflow').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-bottom:var(--s5)">
        ${[{l:'Kas Masuk',v:Utils.formatRupiah(tM,true),c:'var(--success)'},{l:'Kas Keluar',v:Utils.formatRupiah(tK,true),c:'var(--danger)'},{l:net>=0?'Surplus':'Defisit',v:Utils.formatRupiah(Math.abs(net),true),c:net>=0?'var(--success)':'var(--danger)'}].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:20px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>`).join('')}
      </div>
      <div class="table-wrapper"><div class="table-scroll"><table class="table">
        <thead><tr><th>Tanggal</th><th class="num" style="color:var(--success)">Kas Masuk</th><th class="num" style="color:var(--danger)">Kas Keluar</th><th class="num">Net</th><th class="num">Balance</th></tr></thead>
        <tbody>${rows.map(r=>{const net2=r.masuk-r.keluar;return`<tr>
          <td style="white-space:nowrap">${Utils.formatDate(r.tgl,'dd mmm yyyy')}</td>
          <td class="num" style="color:var(--success)">${r.masuk?Utils.formatRupiah(r.masuk):'-'}</td>
          <td class="num" style="color:var(--danger)">${r.keluar?Utils.formatRupiah(r.keluar):'-'}</td>
          <td class="num" style="color:${net2>=0?'var(--success)':'var(--danger)'};font-weight:600">${net2?Utils.formatRupiah(Math.abs(net2)):'-'}</td>
          <td class="num"><strong style="color:${r.balance>=0?'var(--text)':'var(--danger)'}">${Utils.formatRupiah(r.balance)}</strong></td>
        </tr>`;}).join('')}</tbody>
      </table></div></div>`;
  }

  return { init, switchTab, setFilter, resetFilter, goPage, addRow, saveCell, saveCellCalc, deleteRow, renderMonthlyTable, exportCSV };
})();
window.KasModule = KasModule;
