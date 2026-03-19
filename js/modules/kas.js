/* ============================================
   BECCA V2.0 — Kas Kecil Module
   Spreadsheet: click row to edit inline
   AI type suggestion from nama field
============================================ */
const KasModule = (() => {
  let _kas        = [];
  let _masuk      = [];
  let _saldoAwal  = 0;  // Saldo awal kas, bisa di-edit user

  function _loadSaldoAwal()  { return parseFloat(localStorage.getItem('becca_kas_saldo_awal')||'0') || 0; }
  function _saveSaldoAwal(v) { localStorage.setItem('becca_kas_saldo_awal', String(v)); _saldoAwal = v; }
  let _activeTab = 'transaksi';
  let _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'' };
  let _page   = 1;
  const _perPage = 100;
  let _editingId  = null;
  let _kasLocked  = new Set();
  const _KAS_LOCK_KEY = 'becca_kas_locked_ids';
  let _pendingChanges = {};

  const TYPES = ['Raw Food','Sayuran','Buah segar','Raw Materials','Minuman','Snack',
    'Kasbon','Gaji','Bensin','Maintenance','OP.Expense','B.Logistik',
    'Listrik PLN','PDAM','Pulsa','Pajak','Kas','Lain-lain'];
  const SATUANS = ['Kg','Pcs','Bks','Box','Btl','Kli','Prsi','Gbng','Ikt','Lbr',
    'Pack','Bag','Ltr','Unit','Rim','Rol','Sak','Dus'];
  const MONTHS  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

  /* ===================== AI TYPE SUGGESTION ===================== */
  const TYPE_RULES = [
    {keys:['gaji','salary','upah','thr'],             type:'Gaji'},
    {keys:['kasbon','pinjam','piutang','hutang'],      type:'Kasbon'},
    {keys:['bensin','solar','bbm','pertamax','pertalite','fuel'],type:'Bensin'},
    {keys:['listrik','pln','kwh'],                     type:'Listrik PLN'},
    {keys:['pdam','air','water'],                      type:'PDAM'},
    {keys:['pulsa','kuota','internet','telp','hp'],    type:'Pulsa'},
    {keys:['pajak','tax','bpjs','iuran'],              type:'Pajak'},
    {keys:['ayam','daging','ikan','sapi','udang','telur'],type:'Raw Food'},
    {keys:['sayur','kangkung','bayam','wortel','kubis','brokoli','sawi'],type:'Sayuran'},
    {keys:['buah','apel','jeruk','pisang','mangga','melon'],type:'Buah segar'},
    {keys:['minyak','tepung','gula','garam','kecap','saos','bumbu'],type:'Raw Materials'},
    {keys:['air mineral','teh','kopi','jus','minuman','sirup'],type:'Minuman'},
    {keys:['snack','keripik','biskuit','kue','roti','camilan'],type:'Snack'},
    {keys:['servis','service','perbaikan','repair','maintenance','ac','mesin'],type:'Maintenance'},
    {keys:['transport','angkut','kurir','ongkir','logistik'],type:'B.Logistik'},
    {keys:['biaya','operasional','atk','alat','tulis','kantor'],type:'OP.Expense'},
    {keys:['kas','transfer','bank','dana','gopay','ovo'],type:'Kas'},
    {keys:['dp','seragam','seragam','uniform'],        type:'OP.Expense'},
  ];

  function _suggestType(nama) {
    if (!nama) return null;
    const lower = nama.toLowerCase();
    for (const rule of TYPE_RULES) {
      if (rule.keys.some(k => lower.includes(k))) return rule.type;
    }
    return null;
  }

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-kas');
    page.innerHTML = _renderShell();
    [_kas, _masuk] = await Promise.all([DB.getKas(), DB.getKasMasuk()]);
    _saldoAwal = _loadSaldoAwal();
    // Load locks + auto-lock semua rows existing saat init
    try { _kasLocked = new Set(JSON.parse(localStorage.getItem(_KAS_LOCK_KEY)||'[]')); } catch { _kasLocked = new Set(); }
    _kas.forEach(r => _kasLocked.add(r.id));
    localStorage.setItem(_KAS_LOCK_KEY, JSON.stringify([..._kasLocked]));
    _editingId = null;
    _pendingChanges = {};
    switchTab('transaksi');
    _injectStyles();
  }

  function _injectStyles() {
    if (document.getElementById('kas-ss-style')) return;
    const s = document.createElement('style');
    s.id = 'kas-ss-style';
    s.textContent = `
      .ks-tbl{width:100%;border-collapse:collapse;font-size:13px;}
      .ks-tbl th{background:var(--surface2);color:var(--text-3);font-size:10px;text-transform:uppercase;
        letter-spacing:.05em;padding:7px 8px;border:1px solid var(--border);white-space:nowrap;
        position:sticky;top:0;z-index:2;}
      .ks-tbl td{border:1px solid var(--border);padding:0;height:32px;background:var(--surface);vertical-align:middle;}
      .ks-tbl td .ks-cell{display:flex;align-items:center;padding:0 8px;height:32px;cursor:cell;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;}
      .ks-tbl tr.ks-view:hover td{background:rgba(99,102,241,.1);cursor:pointer;}
      .ks-tbl tr.ks-editing td{background:rgba(99,102,241,.06)!important;outline:1px solid var(--primary);outline-offset:-1px;}
      .ks-inp{width:100%;height:100%;border:none;outline:none;padding:0 6px;background:transparent;
        color:var(--text);font-size:13px;font-family:var(--font);box-sizing:border-box;min-height:32px;}
      .ks-sel{width:100%;height:32px;border:none;outline:none;padding:0 4px;background:var(--surface3);
        color:var(--text);font-size:12px;font-family:var(--font);cursor:pointer;}
      .ks-num{text-align:right;font-family:var(--font-mono);}
      .ks-num .ks-cell{justify-content:flex-end;}
      .ks-add-row{width:100%;padding:8px 12px;border:none;background:var(--surface2);color:var(--text-3);
        cursor:pointer;font-size:12px;text-align:left;border-top:1px solid var(--border);
        display:flex;align-items:center;gap:6px;transition:background .15s;}
      .ks-add-row:hover{background:var(--surface3);color:var(--primary-h);}
      .ks-del-btn{width:26px;height:26px;border:none;background:transparent;cursor:pointer;color:var(--text-3);
        border-radius:4px;display:flex;align-items:center;justify-content:center;margin:auto;transition:all .15s;}
      .ks-del-btn:hover{background:rgba(239,68,68,.15);color:var(--danger);}
      .ks-saved{animation:ksSv .5s ease;}
      @keyframes ksSv{0%{background:rgba(34,197,94,.25)}100%{background:transparent}}
      .ks-ai-badge{font-size:9px;background:rgba(99,102,241,.2);color:var(--primary-h);
        border-radius:3px;padding:1px 4px;margin-left:4px;vertical-align:middle;}
    `;
    document.head.appendChild(s);
  }

  function _renderShell() {
    return `
      <div class="page-header">
        <div class="page-header-left"><h2>Kas Kecil</h2><p>Manajemen kas dan pengeluaran</p></div>
        <div class="page-header-right"><span id="kas-hdr-btn"></span></div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="transaksi" onclick="KasModule.switchTab('transaksi')">Transaksi</button>
        <button class="tab-btn" data-tab="summary"   onclick="KasModule.switchTab('summary')">Summary</button>
        <button class="tab-btn" data-tab="monthly"   onclick="KasModule.switchTab('monthly')">Monthly Report</button>
        <button class="tab-btn" data-tab="cashflow"  onclick="KasModule.switchTab('cashflow')">Cash Flow</button>
      </div>
      <div id="kas-tab-transaksi"></div>
      <div id="kas-tab-summary"  style="display:none"></div>
      <div id="kas-tab-monthly"  style="display:none"></div>
      <div id="kas-tab-cashflow" style="display:none"></div>
    `;
  }

  function switchTab(tab) {
    _activeTab = tab;
    ['transaksi','summary','monthly','cashflow'].forEach(t => {
      const el = document.getElementById('kas-tab-'+t);
      if (el) el.style.display = t===tab?'':'none';
      document.querySelector('[data-tab="'+t+'"]')?.classList.toggle('active', t===tab);
    });
    const hdr = document.getElementById('kas-hdr-btn');
    if (hdr) hdr.innerHTML = tab==='transaksi' && Auth.can('kas','edit')
      ? `<button class="btn btn-ghost btn-sm" onclick="KasModule.exportCSV()">Export CSV</button>`
      : '';
    if (tab==='transaksi') { renderTransaksi(); _renderBalanceCards(); }
    else if (tab==='summary')  renderSummary();
    else if (tab==='monthly')  renderMonthly();
    else if (tab==='cashflow') renderCashflow();
  }

  /* ===================== RENDER TRANSAKSI ===================== */
  function renderTransaksi() {
    const canEdit = Auth.can('kas','edit');
    const filtered = _applyFilter(_kas).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const total    = filtered.length;
    const paged    = filtered.slice((_page-1)*_perPage, _page*_perPage);
    const totalPg  = Math.ceil(total/_perPage);
    const sum      = filtered.reduce((s,r)=>s+(r.jumlah||0),0);
    const bulanOpts= [...new Set(_kas.map(r=>r.bulan).filter(Boolean))].sort();

    document.getElementById('kas-tab-transaksi').innerHTML = `
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap" id="kas-strip-wrap">${_summaryStrip(filtered)}<div id="kas-balance-cards" style="display:contents"></div></div>
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
          <option value="-"    ${_filter.status==='-'   ?'selected':''}>- (Kosong)</option>
        </select>
        <button onclick="KasModule.resetFilter()" title="Reset Filter"
          style="height:34px;width:34px;min-width:34px;border-radius:var(--r-sm);
                 border:1px solid var(--border2);background:transparent;
                 cursor:pointer;display:flex;align-items:center;justify-content:center;
                 color:var(--text-2);font-size:18px;transition:all .15s;"
          onmouseover="this.style.background='var(--surface2)';this.style.color='var(--text)'"
          onmouseout="this.style.background='transparent';this.style.color='var(--text-2)'">↺</button>
        <span class="text-muted text-small" style="margin-left:auto">${total} baris · ${Utils.formatRupiah(sum)}</span>
      </div>


      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;min-height:24px">
        <div id="kas-saldo-bar" style="font-size:12px;color:var(--text-3)"></div>
        <div id="kas-balance-bar" style="text-align:right"></div>
      </div>
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="ks-tbl" id="kas-grid">
          <thead><tr>
            <th style="width:32px;padding:0;text-align:center">
              ${canEdit
                ? `<button title="Tambah Baris Baru" onclick="KasModule.addRow()"
                    style="width:26px;height:26px;border-radius:6px;
                           background:rgba(99,102,241,.25);
                           border:1.5px solid rgba(99,102,241,.5);
                           cursor:pointer;color:var(--primary-h);
                           font-size:15px;font-weight:900;line-height:1;
                           display:flex;align-items:center;justify-content:center;
                           transition:all .15s;margin:auto;"
                    onmouseover="this.style.background='var(--primary)';this.style.color='white';this.style.borderColor='var(--primary)'"
                    onmouseout="this.style.background='rgba(99,102,241,.25)';this.style.color='var(--primary-h)';this.style.borderColor='rgba(99,102,241,.5)'">+</button>`
                : '<span style=\"color:var(--text-3);font-size:11px\">#</span>'}
            </th>
            <th style="width:108px">Tanggal</th>
            <th style="min-width:180px">Nama / Keterangan</th>
            <th style="width:130px">Type <span class="ks-ai-badge">AI</span></th>
            <th style="width:110px">Vendor</th>
            <th style="width:55px" class="ks-num">Qty</th>
            <th style="width:55px">Sat</th>
            <th style="width:105px" class="ks-num">Harga/Sat</th>
            <th style="width:115px" class="ks-num">Total (Rp)</th>
            <th style="width:100px">Penerima</th>
            <th style="width:75px">Status</th>
            ${canEdit ? '<th style="width:32px"></th>' : ''}
          </tr></thead>
          <tbody id="kas-tbody">
            ${paged.map((r,i)=>_rowView(r,(_page-1)*_perPage+i+1,canEdit)).join('')}
          </tbody>
        </table>
      </div>
      ${totalPg > 1 ? `
        <div class="pagination" style="margin-top:var(--s3)">
          <span class="pagination-info">Hal ${_page}/${totalPg} · ${total} baris</span>
          <div class="pagination-controls">
            <button class="page-btn" onclick="KasModule.goPage(${_page-1})" ${_page<=1?'disabled':''}>‹</button>
            ${Array.from({length:Math.min(totalPg,7)},(_,i)=>{
              const p=_page<=4?i+1:_page+i-3;
              return p>=1&&p<=totalPg?`<button class="page-btn ${p===_page?'active':''}" onclick="KasModule.goPage(${p})">${p}</button>`:'';
            }).join('')}
            <button class="page-btn" onclick="KasModule.goPage(${_page+1})" ${_page>=totalPg?'disabled':''}>›</button>
          </div>
        </div>` : ''}
    `;
    // Refresh balance cards setelah render
    _renderBalanceCards();
  }

  /* ---- VIEW ROW ---- */
  function _rowView(r, rowNum, canEdit) {
    const sc = r.status==='DONE'?'badge-success':r.status==='TBC'?'badge-warning':'badge-neutral';
    const rowBg = r.status==='DONE'
      ? 'style="background:rgba(0,0,0,.25)"'
      : r.status==='TBC'
      ? 'style="background:rgba(99,102,241,.04)"'
      : '';
    const ksOnClick = _kasLocked.has(r.id) ? 'void(0)' : 'KasModule.startEdit(\'' + r.id + '\''+')';
    return `<tr class="ks-view" id="ks-row-${r.id}" data-id="${r.id}" ${rowBg} style="${_kasLocked.has(r.id)?'opacity:.75':''}" onclick="${ksOnClick}">
      <td style="width:28px">
        <div class="ks-cell" style="justify-content:center;font-size:11px;color:var(--text-3)">
          ${_kasLocked.has(r.id)?'<span style="opacity:.4">'+rowNum+'</span>':rowNum}
        </div>
      </td>
      <td style="white-space:nowrap"><div class="ks-cell">${r.tgl||''}</div></td>
      <td><div class="ks-cell">${r.nama||''}</div></td>
      <td><div class="ks-cell"><span class="badge badge-neutral" style="font-size:10px">${r.type||''}</span></div></td>
      <td><div class="ks-cell">${r.vendor||''}</div></td>
      <td class="ks-num"><div class="ks-cell">${r.qty||0}</div></td>
      <td><div class="ks-cell">${r.satuan||''}</div></td>
      <td class="ks-num"><div class="ks-cell">${Utils.formatRupiah(r.hargaSatuan||0)}</div></td>
      <td class="ks-num"><div class="ks-cell"><strong>${Utils.formatRupiah(r.jumlah||0)}</strong></div></td>
      <td><div class="ks-cell">${r.penerima||''}</div></td>
      <td><div class="ks-cell"><span class="badge ${sc}" style="font-size:10px">${r.status||''}</span></div></td>
      ${canEdit?`<td>
        <div style='display:flex;gap:2px;align-items:center'>
          ${_kasLocked.has(r.id)?
            `<button onclick='event.stopPropagation();KasModule.unlockKasRow("${r.id}")'
              title='Buka kunci untuk edit'
              style='width:22px;height:22px;border-radius:4px;border:1px solid rgba(99,102,241,.4);background:rgba(99,102,241,.1);cursor:pointer;color:var(--primary-h);font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0'
              onmouseover='this.style.background="var(--primary)";this.style.color="white"'
              onmouseout='this.style.background="rgba(99,102,241,.1)";this.style.color="var(--primary-h)"'>🔓</button>`
            :`<button onclick='event.stopPropagation();KasModule.startEdit("${r.id}")'
              title='Edit' style='width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0'
              onmouseover='this.style.background="var(--surface2)"' onmouseout='this.style.background="transparent"'>✎</button>`}
          <button class='ks-del-btn' onclick='event.stopPropagation();KasModule.deleteRow("${r.id}")' title='Hapus'>
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' width='12' height='12'><polyline points='3,6 5,6 21,6'/><path d='M19 6l-1 14H6L5 6'/></svg>
          </button>
        </div>
      </td>`:''}\n    </tr>`;
  }

  /* ---- EDIT ROW ---- */
  function _rowEdit(r, rowNum, canEdit) {
    const typeOpts   = TYPES.map(t=>`<option value="${t}" ${r.type===t?'selected':''}>${t}</option>`).join('');
    const statusOpts = ['-','DONE','TBC'].map(s=>`<option value="${s==='-'?'':s}" ${(r.status||'')===(s==='-'?'':s)?'selected':''}>${s}</option>`).join('');
    const bulanOpts  = MONTHS.map(m=>`<option value="${m}" ${r.bulan===m?'selected':''}>${m}</option>`).join('');
    return `<tr class="ks-editing" id="ks-row-${r.id}" data-id="${r.id}" onclick="event.stopPropagation()">
      <td><div class="ks-cell" style="justify-content:center;color:var(--primary-h);font-size:11px">${rowNum}</div></td>
      <td><input class="ks-inp" type="date" value="${r.tgl||''}" id="ks-tgl-${r.id}"></td>
      <td><input class="ks-inp" type="text" value="${(r.nama||'').replace(/"/g,'&quot;')}" placeholder="Nama/keterangan"
            id="ks-nama-${r.id}"
            oninput="KasModule._onNamaInput('${r.id}',this.value)"
            onkeydown="if(event.key==='Enter')KasModule.commitEdit('${r.id}')"></td>
      <td><select class="ks-sel" id="ks-type-${r.id}">${typeOpts}</select></td>
      <td><input class="ks-inp" type="text" value="${(r.vendor||'').replace(/"/g,'&quot;')}" placeholder="Vendor" id="ks-vendor-${r.id}"></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" step="0.01" value="${r.qty||0}"
            id="ks-qty-${r.id}" oninput="KasModule._calcTotal('${r.id}')" style="text-align:right"></td>
      <td><input class="ks-inp" type="text" value="${r.satuan||''}" list="ks-sat-lst" id="ks-sat-${r.id}">
          <datalist id="ks-sat-lst">${SATUANS.map(s=>`<option value="${s}">`).join('')}</datalist></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" value="${r.hargaSatuan||0}"
            id="ks-harga-${r.id}" oninput="KasModule._calcTotal('${r.id}')" style="text-align:right"></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" value="${r.jumlah||0}"
            id="ks-jumlah-${r.id}" style="text-align:right;font-weight:700"
            onkeydown="if(event.key==='Enter')KasModule.commitEdit('${r.id}')"></td>
      <td><input class="ks-inp" type="text" value="${(r.penerima||'').replace(/"/g,'&quot;')}" placeholder="Penerima" id="ks-penerima-${r.id}"></td>
      <td><select class="ks-sel" id="ks-status-${r.id}">${statusOpts}</select></td>
      ${canEdit?`<td><button class="ks-del-btn" style="color:var(--success);border:1px solid var(--success)"
          onclick="event.stopPropagation();KasModule.commitEdit('${r.id}')" title="Simpan">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <polyline points="20,6 9,17 4,12"/>
          </svg></button></td>`:''}
    </tr>`;
  }

  /* ---- AI: nama input → suggest type ---- */
  function _onNamaInput(id, val) {
    const suggested = _suggestType(val);
    if (suggested) {
      const sel = document.getElementById('ks-type-'+id);
      if (sel) sel.value = suggested;
    }
  }

  /* ---- CALC TOTAL ---- */
  function _calcTotal(id) {
    const qty   = parseFloat(document.getElementById('ks-qty-'+id)?.value)   || 0;
    const harga = parseFloat(document.getElementById('ks-harga-'+id)?.value) || 0;
    const el    = document.getElementById('ks-jumlah-'+id);
    if (el && qty > 0 && harga > 0) el.value = Math.round(qty * harga);
  }

  /* ===================== EDIT LOGIC ===================== */
  // FIX: use a single named function for outside click so removeEventListener works
  function _handleOutsideClick(e) {
    if (!_editingId) return;
    const editingRow = document.getElementById('ks-row-'+_editingId);
    if (editingRow && !editingRow.contains(e.target)) {
      commitEdit(_editingId);
    }
  }

  function startEdit(id) {
    if (_editingId === id) return;
    if (_kasLocked.has(id)) {
      // Row terkunci - tidak bisa edit langsung, perlu unlock via # icon
      return;
    }

    // FIX: Remove old listener FIRST before committing
    document.removeEventListener('click', _handleOutsideClick);

    // Commit previous if any
    if (_editingId) {
      const prevId = _editingId;
      _editingId = null;
      _doCommit(prevId);
    }

    _editingId = id;
    const row  = _kas.find(r=>r.id===id);
    const trEl = document.getElementById('ks-row-'+id);
    if (!row || !trEl) { _editingId = null; return; }
    row._original = JSON.stringify({tgl:row.tgl,nama:row.nama,type:row.type,vendor:row.vendor,
      qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,jumlah:row.jumlah,
      penerima:row.penerima,status:row.status,bulan:row.bulan});

    const tbody   = document.getElementById('kas-tbody');
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const rowNum  = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
    trEl.outerHTML = _rowEdit(row, rowNum, true);

    // Focus first text input
    setTimeout(() => {
      document.getElementById('ks-nama-'+id)?.focus();
      // Attach outside click AFTER render
      document.addEventListener('click', _handleOutsideClick);
    }, 50);
  }

  function _readRowFromDOM(id) {
    const get = (suffix) => document.getElementById('ks-'+suffix+'-'+id);
    return {
      tgl:         get('tgl')?.value         || '',
      nama:        get('nama')?.value        || '',
      type:        get('type')?.value        || '',
      vendor:      get('vendor')?.value      || '',
      qty:         parseFloat(get('qty')?.value)    || 0,
      satuan:      get('sat')?.value         || '',
      hargaSatuan: parseFloat(get('harga')?.value)  || 0,
      jumlah:      parseFloat(get('jumlah')?.value) || 0,
      penerima:    get('penerima')?.value    || '',
      status:      get('status')?.value      || '',
    };
  }

  function _doCommit(id) {
    const row = _kas.find(r=>r.id===id);
    if (!row) return;
    const origStr = row._original || '{}';
    const vals = _readRowFromDOM(id);
    Object.assign(row, vals);
    // Change detection - skip save if nothing changed
    const newStr = JSON.stringify({tgl:row.tgl,nama:row.nama,type:row.type,vendor:row.vendor,
      qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,jumlah:row.jumlah,
      penerima:row.penerima,status:row.status,bulan:row.bulan});
    delete row._original;
    const hasChanged = origStr !== newStr;

    const trEl = document.getElementById('ks-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('kas-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
      trEl.outerHTML = _rowView(row, rowNum, true);
    }
    if (!hasChanged) return;  // Nothing changed - skip save+log

    // Save to DB async
    DB.saveKas(row).then(() => {
      _kasLocked.add(id); localStorage.setItem(_KAS_LOCK_KEY, JSON.stringify([..._kasLocked]));
      DB.logActivity({type:'edit_kas', detail:'Edit: '+(row.nama||id), snapshot:{after:{nama:row.nama,type:row.type,jumlah:row.jumlah,vendor:row.vendor,tgl:row.tgl,status:row.status}}});
      const newTr = document.getElementById('ks-row-'+id);
      if (newTr) { newTr.classList.add('ks-saved'); setTimeout(()=>newTr.classList.remove('ks-saved'),500); }
    }).catch(e => Notify.error('Gagal simpan', e.message));
  }

  async function commitEdit(id) {
    if (_editingId !== id) return;
    document.removeEventListener('click', _handleOutsideClick);
    _editingId = null;
    _doCommit(id);
  }

  /* ===================== ADD / DELETE ===================== */
  function unlockKasRow(id) {
    _kasLocked.delete(id);
    localStorage.setItem(_KAS_LOCK_KEY, JSON.stringify([..._kasLocked]));
    startEdit(id);
  }

  async function addRow() {
    if (_editingId) await commitEdit(_editingId);
    const today = new Date().toISOString().split('T')[0];
    const mo    = parseInt(today.split('-')[1]) - 1;
    const newRow = {
      tgl:today, nama:'', type:'', vendor:'',
      qty:1, satuan:'Pcs', hargaSatuan:0, jumlah:0,
      penerima:'', status:'', bulan:MONTHS[mo],
    };
    try {
      const saved = await DB.saveKas(newRow);
      _kas.unshift(saved);
      DB.logActivity({type:'add_kas', detail:'Baris baru', snapshot:{after:{tgl:saved.tgl,nama:saved.nama||'Baris baru'}}});
      renderTransaksi();
      setTimeout(()=>startEdit(saved.id), 80);
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  async function deleteRow(id) {
    if (_editingId===id) { document.removeEventListener('click',_handleOutsideClick); _editingId=null; }
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
  function setFilter(k,v){ if(_editingId)commitEdit(_editingId); _filter[k]=v; _page=1; renderTransaksi(); }
  function resetFilter()  { if(_editingId)commitEdit(_editingId); _filter={}; _page=1; renderTransaksi(); }
  function goPage(p)      { if(_editingId)commitEdit(_editingId); _page=p; renderTransaksi(); }

  /* ===================== SUMMARY STRIP ===================== */
  function _summaryStrip(data) {
    const done=data.filter(r=>r.status==='DONE'), tbc=data.filter(r=>r.status==='TBC');
    return [
      {l:'Total Keluar',v:Utils.formatRupiah(data.reduce((s,r)=>s+(r.jumlah||0),0),true),c:'var(--danger)'},
      {l:'Confirmed',   v:Utils.formatRupiah(done.reduce((s,r)=>s+(r.jumlah||0),0),true),c:'var(--success)'},
      {l:'TBC',         v:Utils.formatRupiah(tbc.reduce((s,r) =>s+(r.jumlah||0),0),true),c:'var(--warning)'},
      {l:'Total Baris', v:data.length+' baris', c:'var(--primary-h)'},
    ].map(c=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:140px">
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
    const a=Object.assign(document.createElement('a'),{
      href:URL.createObjectURL(new Blob([[hdr.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8;'})),
      download:`kas-kecil-${new Date().toISOString().split('T')[0]}.csv`
    });
    a.click(); URL.revokeObjectURL(a.href);
    Notify.success('CSV di-export');
  }

  /* ===================== SUMMARY TAB ===================== */
  function renderSummary() {
    const el = document.getElementById('kas-tab-summary');
    if (!el) return;
    const kasRaw = JSON.parse(localStorage.getItem('becca_kas')||'[]');
    const NORM = {'Jan':'Januari','Febuari':'Februari','Feb':'Februari','Mar':'Maret','Apr':'April','Mei':'Mei','Jun':'Juni','Jul':'Juli','Ags':'Agustus','Sep':'September','Okt':'Oktober','Nov':'November','Des':'Desember'};
    const ORDER = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#8b5cf6','#06b6d4','#84cc16','#f97316'];
    const SHORT = {Januari:'Jan',Februari:'Feb',Maret:'Mar',April:'Apr',Mei:'Mei',Juni:'Jun',Juli:'Jul',Agustus:'Ags',September:'Sep',Oktober:'Okt',November:'Nov',Desember:'Des'};
    const nd = {};
    kasRaw.forEach(r => {
      const b = NORM[r.bulan||'']||r.bulan||''; if(!b) return;
      const t = r.type||'Lain-lain';
      if(!nd[b]) nd[b]={};
      nd[b][t]=(nd[b][t]||0)+(r.jumlah||0);
    });
    const bulan = ORDER.filter(b=>nd[b]);
    if (!bulan.length) { el.innerHTML='<div style="padding:40px;text-align:center;color:var(--text-3)">Tidak ada data</div>'; return; }
    const typeMap={};
    kasRaw.forEach(r=>{ const t=r.type||'Lain-lain'; typeMap[t]=(typeMap[t]||0)+(r.jumlah||0); });
    const allTypes=Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
    const fmtS=n=>{
      if(!n) return '<span style="color:var(--text-3)">—</span>';
      if(n>=1e9) return 'Rp '+Math.round(n/1e9).toLocaleString('id')+'<sup style="font-size:10px;color:var(--text-3)">M</sup>';
      if(n>=1e6) return 'Rp '+Math.round(n/1e6).toLocaleString('id')+'<sup style="font-size:10px;color:var(--text-3)">jt</sup>';
      if(n>=1e3) return 'Rp '+Math.round(n/1e3).toLocaleString('id')+'<sup style="font-size:10px;color:var(--text-3)">rb</sup>';
      return 'Rp '+n;
    };
    const badge=(curr,prev)=>{ if(prev===null||!prev) return ''; const p=Math.round((curr-prev)/prev*100); return '<span style="font-size:10px;font-weight:700;color:'+(p>=0?'#ef4444':'#10b981')+';margin-left:4px">'+(p>=0?'▲':'▼')+Math.abs(p)+'%</span>'; };
    // Cards
    const cards = bulan.map((b,i)=>{ const total=Object.values(nd[b]).reduce((s,v)=>s+v,0); const prev=i>0?Object.values(nd[bulan[i-1]]).reduce((s,v)=>s+v,0):0; const rows=kasRaw.filter(r=>(NORM[r.bulan||'']||r.bulan)===b).length; const p=prev?Math.round((total-prev)/prev*100):null; const clr=COLORS[i%COLORS.length]; return '<div style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;width:4px;height:100%;background:'+clr+'"></div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div style="font-size:20px;font-weight:900;color:'+clr+'">'+(SHORT[b]||b)+'</div>'+(p!==null?'<div style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+(p>=0?'rgba(239,68,68,.1)':'rgba(16,185,129,.1)')+';color:'+(p>=0?'#ef4444':'#10b981')+'">'+(p>=0?'▲':'▼')+Math.abs(p)+'% vs '+SHORT[bulan[i-1]]+'</div>':'<div style="font-size:11px;color:var(--text-3);padding:2px 8px;border-radius:20px;background:var(--surface2)">Base Month</div>')+'</div><div style="font-family:var(--font-mono);font-size:22px;font-weight:900;color:var(--heading)">'+fmtS(total)+'</div><div style="font-size:11px;color:var(--text-3);margin-top:4px">'+rows.toLocaleString('id')+' transaksi</div></div>'; }).join('');
    // Table
    const tblRows = allTypes.map((type,ti)=>{ const clr=COLORS[ti%COLORS.length]; const vals=bulan.map(b=>nd[b]?.[type]||0); if(vals.every(v=>v===0)) return ''; const maxV=Math.max(...vals,1); const cells=bulan.map((b,i)=>{ const v=nd[b]?.[type]||0, prev=i>0?(nd[bulan[i-1]]?.[type]||0):null; const bw=Math.round(v/maxV*100); return '<td style="padding:8px 10px;vertical-align:middle;min-width:140px">'+(v?'<div style="font-family:var(--font-mono);font-size:12px;font-weight:700;white-space:nowrap">'+fmtS(v)+badge(v,prev)+'</div><div style="height:5px;background:var(--surface2);border-radius:3px;margin-top:4px;overflow:hidden"><div style="width:'+bw+'%;height:100%;background:'+clr+';border-radius:3px"></div></div>':'<span style="color:var(--text-3);font-size:12px">—</span>')+'</td>'; }).join(''); return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 12px;position:sticky;left:0;background:var(--surface);z-index:1;min-width:130px"><div style="display:flex;align-items:center;gap:7px"><div style="width:10px;height:10px;border-radius:3px;background:'+clr+';flex-shrink:0"></div><span style="font-size:12px;font-weight:600">'+type+'</span></div></td>'+cells+'</tr>'; }).join('');
    const totalCells=bulan.map((b,i)=>{ const t=Object.values(nd[b]).reduce((s,v)=>s+v,0); const p=i>0?Object.values(nd[bulan[i-1]]).reduce((s,v)=>s+v,0):null; return '<td style="padding:10px;font-family:var(--font-mono);font-size:13px;font-weight:800;white-space:nowrap">'+fmtS(t)+badge(t,p)+'</td>'; }).join('');
    const mHeaders=bulan.map((b,i)=>'<th style="padding:10px;text-align:left;font-size:11px;font-weight:800;color:'+COLORS[i%COLORS.length]+';white-space:nowrap;min-width:140px;border-bottom:2px solid '+COLORS[i%COLORS.length]+'">'+b+'</th>').join('');
    // Analysis
    const totals=bulan.map(b=>Object.values(nd[b]).reduce((s,v)=>s+v,0));
    const trend=totals.length>1?totals[totals.length-1]-totals[0]:0;
    const trendPct=totals[0]?Math.round(trend/totals[0]*100):0;
    const topType=allTypes[0], topVal=typeMap[topType]||0;
    const topPct=Math.round(topVal/totals.reduce((s,v)=>s+v,0)*100);
    const topGrowth=allTypes.reduce((b,t)=>{ if(bulan.length<2) return b; const v1=nd[bulan[0]]?.[t]||0,v2=nd[bulan[bulan.length-1]]?.[t]||0; const p=v1?Math.round((v2-v1)/v1*100):-999; return p>b.p?{t,p}:b; },{t:'',p:-999});
    const topDrop=allTypes.reduce((b,t)=>{ if(bulan.length<2) return b; const v1=nd[bulan[0]]?.[t]||0,v2=nd[bulan[bulan.length-1]]?.[t]||0; const p=v1?Math.round((v2-v1)/v1*100):999; return p<b.p?{t,p}:b; },{t:'',p:999});
    const anomalies=allTypes.filter(t=>{ for(let i=1;i<bulan.length;i++){ const v0=nd[bulan[i-1]]?.[t]||0,v1=nd[bulan[i]]?.[t]||0; if(v0>0&&v1/v0>1.5) return true; } return false; });
    const analyses=[
      {icon:'📊',color:'#6366f1',title:'Tren Pengeluaran',desc:trend<0?'Pengeluaran turun '+Math.abs(trendPct)+'% dari '+SHORT[bulan[0]]+' ke '+SHORT[bulan[bulan.length-1]]+' ('+fmtS(Math.abs(trend))+'). Efisiensi operasional membaik.':trend>0?'Pengeluaran naik '+Math.abs(trendPct)+'% dari '+SHORT[bulan[0]]+' ke '+SHORT[bulan[bulan.length-1]]+'. Perlu monitoring lebih lanjut.':'Pengeluaran stabil antar bulan.'},
      {icon:'🏆',color:'#f59e0b',title:'Kategori Terbesar',desc:topType+' mendominasi '+topPct+'% total pengeluaran ('+fmtS(topVal)+'). Fokus efisiensi pada kategori ini akan berdampak paling besar.'},
      topGrowth.t&&topGrowth.p>20?{icon:'⚠️',color:'#ef4444',title:'Kenaikan Signifikan',desc:topGrowth.t+' naik '+topGrowth.p+'% dari '+SHORT[bulan[0]]+' ke '+SHORT[bulan[bulan.length-1]]+'. Perlu investigasi penyebab kenaikan.'}:null,
      topDrop.t&&topDrop.p<-20?{icon:'✅',color:'#10b981',title:'Penghematan Terbesar',desc:topDrop.t+' turun '+Math.abs(topDrop.p)+'% — penghematan berhasil atau aktivitas berkurang.'}:null,
      anomalies.length?{icon:'🔍',color:'#8b5cf6',title:'Anomali Terdeteksi',desc:'Kategori '+anomalies.slice(0,3).join(', ')+' naik >50% antar bulan. Validasi data atau cek penyebab lonjakan.'}:null,
      {icon:'💡',color:'#06b6d4',title:'Rekomendasi',desc:bulan.length===3&&totals[2]<totals[0]*0.5?SHORT[bulan[2]]+' masih berjalan — proyeksi bulanan ~'+fmtS(Math.round(totals[2]/new Date().getDate()*30))+'. Pantau agar tidak melebihi rata-rata historis.':'Pertahankan pola pengeluaran efisien. Review kategori non-operasional untuk potensi penghematan.'}
    ].filter(Boolean);
    const analysisHtml=analyses.map(a=>'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start"><div style="font-size:20px;flex-shrink:0">'+a.icon+'</div><div><div style="font-size:12px;font-weight:800;color:'+a.color+';margin-bottom:3px">'+a.title+'</div><div style="font-size:12px;color:var(--text-2);line-height:1.6">'+a.desc+'</div></div></div>').join('');
    el.innerHTML='<div style="display:flex;gap:var(--s3);margin-bottom:var(--s4)">'+cards+'</div>'
      +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:var(--s4)"><div style="padding:14px 18px;border-bottom:1px solid var(--border)"><div style="font-size:14px;font-weight:800;color:var(--heading)">Perbandingan per Kategori</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">'+bulan.join(' · ')+' — ▲▼ delta vs bulan sebelumnya</div></div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--surface2)"><th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);position:sticky;left:0;background:var(--surface2);z-index:2;min-width:130px">Kategori</th>'+mHeaders+'</tr></thead><tbody>'+tblRows+'<tr style="background:var(--surface2);border-top:2px solid var(--border)"><td style="padding:10px 12px;font-size:12px;font-weight:800;position:sticky;left:0;background:var(--surface2);z-index:1">TOTAL</td>'+totalCells+'</tr></tbody></table></div></div>'
      +'<div><div style="font-size:13px;font-weight:800;color:var(--heading);margin-bottom:var(--s3)">🤖 Analisa & Rekomendasi</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s3)">'+analysisHtml+'</div></div>';
  }
  function renderMonthly() {
    // Normalize dan deduplicate bulan
    const rawBulans = _kas.map(r=>_normalizeBulan(r.bulan)).filter(Boolean);
    const opts = [...new Set(rawBulans)].sort((a,b)=>(_BULAN_IDX[a]||99)-(_BULAN_IDX[b]||99));
    const sel=opts[opts.length-1]||'';
    document.getElementById('kas-tab-monthly').innerHTML=`
      <div class="filter-bar" style="margin-bottom:var(--s5)">
        <select class="form-control" style="width:160px" onchange="KasModule.renderMonthlyTable(this.value)">
          ${opts.map(b=>`<option value="${b}" ${b===sel?'selected':''}>${_bulanLabel(b)}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="window.print()">Print / PDF</button>
      </div>
      <div id="monthly-table-wrap"></div>`;
    renderMonthlyTable(sel);
  }

  function renderMonthlyTable(bulan) {
    const rows   = _kas.filter(r => _normalizeBulan(r.bulan) === bulan);
    const byType = {};
    rows.forEach(r => {
      const t = r.type || 'Lain-lain';
      if (!byType[t]) byType[t] = [];
      byType[t].push(r);
    });
    const grand      = rows.reduce((s,r) => s+( r.jumlah||0), 0);
    const grandDone  = rows.filter(r=>r.status==='DONE').reduce((s,r)=>s+(r.jumlah||0),0);
    const grandTBC   = rows.filter(r=>r.status==='TBC').reduce((s,r)=>s+(r.jumlah||0),0);
    const saldoAwal  = _loadSaldoAwal();
    const bulanLabel = _bulanLabel(bulan);

    const typesSorted = Object.entries(byType)
      .map(([type, items]) => ({type, items, total: items.reduce((s,r)=>s+(r.jumlah||0),0)}))
      .sort((a,b) => b.total - a.total);

    document.getElementById('monthly-table-wrap').innerHTML = `
      <!-- Print Header -->
      <div id="monthly-report" style="font-family:var(--font)">

        <!-- Title Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:16px 20px;background:var(--surface);border:1px solid var(--border);
                    border-radius:var(--r-lg) var(--r-lg) 0 0;border-bottom:none">
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:2px">Laporan Kas Kecil</div>
            <div style="font-size:22px;font-weight:700;color:var(--heading)">${bulanLabel}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text-3)">Total Pengeluaran</div>
            <div style="font-size:24px;font-weight:800;color:var(--danger);font-family:var(--font-mono)">${Utils.formatRupiah(grand,true)}</div>
          </div>
        </div>

        <!-- Summary Cards -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;
                    border:1px solid var(--border);border-top:none;border-radius:0;overflow:hidden">
          ${[
            {l:'Saldo Awal',  v:Utils.formatRupiah(saldoAwal,true),  c:'var(--primary-h)'},
            {l:'Confirmed',   v:Utils.formatRupiah(grandDone,true),  c:'var(--success)'},
            {l:'TBC / Pending',v:Utils.formatRupiah(grandTBC,true),  c:'var(--warning)'},
            {l:'Kategori',    v:Object.keys(byType).length+' jenis', c:'var(--text-2)'},
          ].map((s,i) => `
            <div style="padding:12px 16px;background:var(--surface);
                        ${i>0?'border-left:1px solid var(--border)':''}">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:3px">${s.l}</div>
              <div style="font-size:16px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
            </div>`).join('')}
        </div>

        <!-- Detail per Kategori -->
        <div style="border:1px solid var(--border);border-top:none;border-radius:0 0 var(--r-lg) var(--r-lg);overflow:hidden">
          ${typesSorted.map(({type, items, total}, tIdx) => {
            const done = items.filter(r=>r.status==='DONE').reduce((s,r)=>s+(r.jumlah||0),0);
            const pct  = grand > 0 ? Math.round(total/grand*100) : 0;
            return `
            <div style="${tIdx>0?'border-top:1px solid var(--border)':''}">
              <!-- Type Header -->
              <div style="display:flex;align-items:center;justify-content:space-between;
                          padding:10px 16px;background:var(--surface2)">
                <div style="display:flex;align-items:center;gap:10px">
                  <span style="font-size:13px;font-weight:700;color:var(--heading)">${type}</span>
                  <span style="font-size:11px;color:var(--text-3)">${items.length} transaksi</span>
                  <!-- Progress bar -->
                  <div style="width:80px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:2px"></div>
                  </div>
                  <span style="font-size:10px;color:var(--text-3)">${pct}%</span>
                </div>
                <div style="text-align:right">
                  <div style="font-size:14px;font-weight:700;color:var(--danger);font-family:var(--font-mono)">${Utils.formatRupiah(total)}</div>
                  ${done < total ? `<div style="font-size:10px;color:var(--text-3)">Confirmed: ${Utils.formatRupiah(done)}</div>` : ''}
                </div>
              </div>

              <!-- Rows Table -->
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                  <thead>
                    <tr style="background:var(--surface3)">
                      <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap;width:90px">Tanggal</th>
                      <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase">Nama / Keterangan</th>
                      <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Vendor</th>
                      <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Qty × Sat</th>
                      <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Harga/Sat</th>
                      <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Total</th>
                      <th style="padding:6px 12px;text-align:center;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;width:65px">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||'')).map((r,i) => `
                      <tr style="${i%2===0?'background:var(--surface)':'background:var(--surface2)'}${r.status==='DONE'?';opacity:.75':''}">
                        <td style="padding:7px 12px;color:var(--text-2);white-space:nowrap">${r.tgl?r.tgl.split('-').reverse().join('-'):'-'}</td>
                        <td style="padding:7px 12px">
                          <div style="font-weight:500;color:var(--text)">${r.nama||'-'}</div>
                          ${r.penerima?`<div style="font-size:10px;color:var(--text-3)">→ ${r.penerima}</div>`:''}
                        </td>
                        <td style="padding:7px 12px;color:var(--text-3)">${r.vendor||'-'}</td>
                        <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);color:var(--text-2)">${r.qty||1} ${r.satuan||''}</td>
                        <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);color:var(--text-3)">${Utils.formatRupiah(r.hargaSatuan||0)}</td>
                        <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--text)">${Utils.formatRupiah(r.jumlah||0)}</td>
                        <td style="padding:7px 12px;text-align:center">
                          <span style="font-size:10px;padding:2px 6px;border-radius:3px;font-weight:600;
                            background:${r.status==='DONE'?'rgba(34,197,94,.15)':'rgba(234,179,8,.15)'};
                            color:${r.status==='DONE'?'var(--success)':'var(--warning)'}">
                            ${r.status||'-'}
                          </span>
                        </td>
                      </tr>`).join('')}
                    <!-- Subtotal row -->
                    <tr style="background:var(--surface3);border-top:1px solid var(--border)">
                      <td colspan="5" style="padding:7px 12px;font-weight:700;color:var(--text-2);font-size:11px">
                        Subtotal ${type}
                      </td>
                      <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--danger)">${Utils.formatRupiah(total)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>`;
          }).join('')}

          <!-- Grand Total Footer -->
          <div style="display:flex;justify-content:space-between;align-items:center;
                      padding:14px 20px;background:var(--surface);border-top:2px solid var(--border2)">
            <div style="font-size:13px;font-weight:700;color:var(--heading)">GRAND TOTAL — ${bulanLabel}</div>
            <div style="font-family:var(--font-mono);font-size:20px;font-weight:800;color:var(--danger)">${Utils.formatRupiah(grand)}</div>
          </div>
        </div>
      </div>
    `;
  }


  /* ===================== CASH FLOW ===================== */
  function renderCashflow() {
    const mD={},kD={};
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
        <tbody>${rows.map(r=>{const n=r.m-r.k;return`<tr><td style="white-space:nowrap">${Utils.formatDate(r.tgl,'dd mmm yyyy')}</td><td class="num" style="color:var(--success)">${r.m?Utils.formatRupiah(r.m):'-'}</td><td class="num" style="color:var(--danger)">${r.k?Utils.formatRupiah(r.k):'-'}</td><td class="num" style="color:${n>=0?'var(--success)':'var(--danger)'};font-weight:600">${n?Utils.formatRupiah(Math.abs(n)):'-'}</td><td class="num"><strong style="color:${r.bal>=0?'var(--text)':'var(--danger)'}">${Utils.formatRupiah(r.bal)}</strong></td></tr>`;}).join('')}</tbody>
      </table></div></div>`;
  }

  /* ===================== BALANCE CARDS ===================== */
  const _AI_SVG_KAS = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <defs><linearGradient id="kasAI" x1="0" y1="0" x2="20" y2="20">
      <stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient></defs>
    <circle cx="10" cy="10" r="9" fill="url(#kasAI)" opacity=".15"/>
    <path d="M10 4v2M10 14v2M4 10h2M14 10h2M5.6 5.6l1.1 1.1M13.3 13.3l1.1 1.1M5.6 14.4l1.1-1.1M13.3 6.7l1.1-1.1" 
          stroke="url(#kasAI)" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="10" cy="10" r="2.5" fill="url(#kasAI)"/>
  </svg>`;

  async function _renderBalanceCards() {
    const container = document.getElementById('kas-balance-cards');
    if (!container) return;
    container.innerHTML = ''; // clear dulu
    
    try {
      // Kas masuk dari DB
      const masukData = await DB.getKasMasuk().catch(()=>[]);
      const totalMasuk  = masukData.reduce((s,r) => s + (r.kredit||0), 0);
      
      // Kas keluar (confirmed/DONE only)
      const totalKeluar = _kas.filter(r=>r.status==='DONE').reduce((s,r) => s + (r.jumlah||0), 0);
      const totalAllKeluar = _kas.reduce((s,r) => s + (r.jumlah||0), 0); // incl TBC

      // Balance = Saldo Awal + Kas Masuk - Kas Keluar (DONE)
      const saldoAwal = _loadSaldoAwal();
      const balance   = saldoAwal + totalMasuk - totalKeluar;
      const balanceColor = balance >= 0 ? 'var(--success)' : 'var(--danger)';
      
      const cards = [
        {
          label: 'Kas Masuk',
          value: Utils.formatRupiah(totalMasuk),
          color: 'var(--success)',
          prefix: '',
        },
      ];
      // Inject Balance bar kanan atas
      const balanceBarEl = document.getElementById('kas-balance-bar');
      if (balanceBarEl) {
        const balSign  = balance >= 0 ? '' : '- ';
        const balColor = balance >= 0 ? 'var(--success)' : 'var(--danger)';
        const balLabel = balance >= 0 ? 'Surplus' : 'Defisit';
        balanceBarEl.innerHTML =
          '<span style="font-size:12px;color:var(--text-3)">Balance &nbsp;</span>'
          + '<span style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:'+balColor+'">'
          + balSign+Utils.formatRupiah(Math.abs(balance))+'</span>'
          + '&nbsp;<span style="font-size:11px;color:'+balColor+'">'+balLabel+'</span>';
      }
      // Inject Saldo Awal bar kiri atas (editable)
      const saldoBarEl = document.getElementById('kas-saldo-bar');
      if (saldoBarEl) {
        const sa = _loadSaldoAwal();
        saldoBarEl.innerHTML =
          '<span style="color:var(--text-3);font-size:12px">Saldo Awal &nbsp;</span>'
          + '<span id="kas-saldo-val" style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:var(--primary-h);cursor:pointer;border-bottom:1px dashed rgba(99,102,241,.4);padding-bottom:1px"'
          + ' title="Klik untuk edit saldo awal" onclick="KasModule.editSaldoAwal()">'
          + Utils.formatRupiah(sa)+'</span>'
          + ' <span style="font-size:10px;color:var(--text-3);cursor:pointer" onclick="KasModule.editSaldoAwal()" title="Edit">✎</span>';
      }
      
      // Render Kas Masuk card - clickable, buka modal filter
      container.innerHTML = cards.map(c =>
        '<div onclick="KasModule.openKasMasukModal()" '
        + 'style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);'
        + 'padding:12px 18px;min-width:140px;cursor:pointer;transition:all .15s" '
        + 'onmouseover="this.style.outline=\'2px solid var(--primary)\'" '
        + 'onmouseout="this.style.outline=\'\'">'
        + '<div style="font-size:11px;color:var(--text-3);margin-bottom:4px">'+c.label+' <span style="font-size:9px;opacity:.6">▼</span></div>'
        + '<div style="font-size:18px;font-weight:700;color:'+c.color+';font-family:var(--font-mono)">'+(c.prefix||'')+c.value+'</div>'
        + '</div>'
      ).join('');
    } catch(e) {
      console.error('Balance cards error:', e);
    }
  }

  /* ===================== KAS MASUK MODAL ===================== */
  async function openKasMasukModal() {
    const masukData = await DB.getKasMasuk().catch(()=>[]);
    // Sort by date desc
    const sorted = [...masukData].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const mid = Utils.uid();
    
    function _renderMasukTable(rows) {
      if (!rows.length) return '<div style="text-align:center;padding:30px;color:var(--text-3)">Tidak ada data pada periode ini</div>';
      const total = rows.reduce((s,r)=>s+(r.kredit||0),0);
      return '<div class="table-scroll"><table class="table" style="font-size:12px">'
        + '<thead><tr><th>Tanggal</th><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>'
        + '<tbody>'
        + rows.map(r =>
            '<tr><td style="white-space:nowrap">'+(r.tgl||'-')+'</td>'
            + '<td>'+(r.keterangan||r.ket||r.nama||'Kas Masuk / Setoran')+'</td>'
            + '<td class="num" style="font-family:var(--font-mono)">'+Utils.formatRupiah(r.kredit||0)+'</td></tr>'
          ).join('')
        + '<tr style="background:var(--surface2);font-weight:700">'
        + '<td colspan="2">TOTAL</td>'
        + '<td class="num" style="font-family:var(--font-mono);color:var(--success)">'+Utils.formatRupiah(total)+'</td></tr>'
        + '</tbody></table></div>';
    }

    Modal.open({ id: mid,
      title: 'Kas Masuk',
      size: 'modal-md',
      body: '<div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);align-items:flex-end">'
        + '<div class="form-group" style="margin:0;flex:1">'
        + '<label class="form-label">Dari Tanggal</label>'
        + '<input type="date" class="form-control" id="km-from" placeholder="Dari tanggal">'
        + '</div>'
        + '<div class="form-group" style="margin:0;flex:1">'
        + '<label class="form-label">Sampai Tanggal</label>'
        + '<input type="date" class="form-control" id="km-to" placeholder="Sampai tanggal">'
        + '</div>'
        + '<button class="btn btn-primary btn-sm" onclick="KasModule._filterKasMasuk()">Tampilkan</button>'
        + '<button class="btn btn-ghost btn-sm" onclick="KasModule._filterKasMasuk(true)">Semua</button>'
        + '</div>'
        + '<div id="km-table">' + _renderMasukTable(sorted) + '</div>',
      footer: '<button class="btn btn-ghost" onclick="Modal.close(\'' + mid + '\')" >Tutup</button>',
    });

    // Simpan data untuk filter
    window._kasMasukAll = sorted;
    window._kasMasukMid = mid;
  }

  function _filterKasMasuk(showAll) {
    const data   = window._kasMasukAll || [];
    const from   = document.getElementById('km-from')?.value;
    const to     = document.getElementById('km-to')?.value;
    let filtered = data;
    if (!showAll) {
      if (from) filtered = filtered.filter(r=>(r.tgl||'')>=from);
      if (to)   filtered = filtered.filter(r=>(r.tgl||'')<=to);
    }
    const tableEl = document.getElementById('km-table');
    if (!tableEl) return;
    if (!filtered.length) {
      tableEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)">Tidak ada data pada periode ini</div>';
      return;
    }
    const total = filtered.reduce((s,r)=>s+(r.kredit||0),0);
    tableEl.innerHTML = '<div class="table-scroll"><table class="table" style="font-size:12px">'
      + '<thead><tr><th>Tanggal</th><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>'
      + '<tbody>'
      + filtered.map(r =>
          '<tr><td style="white-space:nowrap">'+(r.tgl||'-')+'</td>'
          + '<td>'+(r.keterangan||r.ket||'-')+'</td>'
          + '<td class="num" style="font-family:var(--font-mono)">'+Utils.formatRupiah(r.kredit||0)+'</td></tr>'
        ).join('')
      + '<tr style="background:var(--surface2);font-weight:700">'
      + '<td colspan="2">TOTAL ('+filtered.length+' transaksi)</td>'
      + '<td class="num" style="font-family:var(--font-mono);color:var(--success)">'+Utils.formatRupiah(total)+'</td></tr>'
      + '</tbody></table></div>';
  }

  /* ===================== EDIT SALDO AWAL ===================== */
  function editSaldoAwal() {
    const current = _loadSaldoAwal();
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: 'Edit Saldo Awal Kas',
      size: 'modal-sm',
      body: `<div class="form-group">
        <label class="form-label">Saldo Awal (Rp)</label>
        <input type="number" min="0" class="form-control" id="saldo-awal-inp" value="${current}" placeholder="0">
        <div class="form-hint">Saldo awal mempengaruhi Balance. Klik Simpan atau tekan Enter.</div>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
               <button class="btn btn-primary" onclick="KasModule._saveSaldoAwalModal('${mid}')">Simpan</button>`,
    });
    setTimeout(() => {
      const inp = document.getElementById('saldo-awal-inp');
      if (inp) { inp.focus(); inp.select(); }
    }, 100);
  }

  function _saveSaldoAwalModal(mid) {
    const val = parseFloat(document.getElementById('saldo-awal-inp')?.value) || 0;
    _saveSaldoAwal(val);
    Modal.close(mid);
    // Refresh balance bar
    _renderBalanceCards();
    Notify.success('Saldo awal disimpan: '+Utils.formatRupiah(val));
  }

  /* ===================== MONTH HELPERS ===================== */
  const _BULAN_FULL = {
    'Jan':'Januari','Feb':'Februari','Mar':'Maret','Apr':'April',
    'Mei':'Mei','Jun':'Juni','Jul':'Juli','Ags':'Agustus',
    'Sep':'September','Okt':'Oktober','Nov':'November','Des':'Desember'
  };
  const _BULAN_IDX = {
    'Jan':1,'Feb':2,'Mar':3,'Apr':4,'Mei':5,'Jun':6,
    'Jul':7,'Ags':8,'Sep':9,'Okt':10,'Nov':11,'Des':12
  };
  // Normalize semua variasi penulisan bulan ke kode pendek (3 huruf)
  const _BULAN_NORMALIZE = {
    'januari':'Jan','january':'Jan','jan':'Jan',
    'februari':'Feb','february':'Feb','feb':'Feb','febuari':'Feb','februri':'Feb',
    'maret':'Mar','march':'Mar','mar':'Mar',
    'april':'Apr','apr':'Apr',
    'mei':'Mei','may':'Mei',
    'juni':'Jun','june':'Jun','jun':'Jun',
    'juli':'Jul','july':'Jul','jul':'Jul',
    'agustus':'Ags','august':'Ags','ags':'Ags','aug':'Ags',
    'september':'Sep','sept':'Sep','sep':'Sep',
    'oktober':'Okt','october':'Okt','okt':'Okt','oct':'Okt',
    'november':'Nov','nov':'Nov',
    'desember':'Des','december':'Des','des':'Des','dec':'Des',
  };

  function _normalizeBulan(b) {
    if (!b) return '';
    const lower = b.toLowerCase().trim();
    return _BULAN_NORMALIZE[lower] || b;
  }

  function _bulanLabel(bulan) {
    // Return "Januari 2026" from bulan="Jan" using tgl data
    const full = _BULAN_FULL[bulan] || bulan;
    // Find year from actual data
    const monthIdx = _BULAN_IDX[bulan];
    const yearFromData = _kas
      .filter(r => r.bulan === bulan && r.tgl)
      .map(r => parseInt((r.tgl||'').split('-')[0]))
      .filter(y => y > 2000)
      .sort()[0];
    const year = yearFromData || new Date().getFullYear();
    return full + ' ' + year;
  }
  return { init, switchTab, setFilter, resetFilter, goPage, addRow, startEdit, commitEdit, unlockKasRow, _onNamaInput, _calcTotal, deleteRow, renderSummary, renderMonthlyTable, exportCSV, _renderBalanceCards, openKasMasukModal, _filterKasMasuk, editSaldoAwal, _saveSaldoAwalModal };
})();
window.KasModule = KasModule;
