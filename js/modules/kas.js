/* ============================================
   BECCA V2.0 — Kas Kecil Module
   Spreadsheet: click row to edit inline
   AI type suggestion from nama field
============================================ */
if(window.BECCA_DEBUG) console.log('[BECCA] KasModule v20260327d loaded');
const KasModule = (() => {
  let _kas        = [];
  let _masuk      = [];
  let _saldoAwal  = 0;  // Saldo awal kas, bisa di-edit user
  let _bulkSelected = new Set();

  async function _loadSaldoAwal() {
    try {
      const cfg = await DB.getSettings().catch(()=>({}));
      if (cfg && cfg.saldoAwal !== undefined && cfg.saldoAwal !== null) {
        const v = parseFloat(cfg.saldoAwal) || 0;
        localStorage.setItem('becca_kas_saldo_awal', String(v));
        return v;
      }
    } catch {}
    return parseFloat(localStorage.getItem('becca_kas_saldo_awal')||'0') || 0;
  }
  function _saveSaldoAwal(v) {
    localStorage.setItem('becca_kas_saldo_awal', String(v));
    _saldoAwal = v;
    DB.saveSettings({ saldoAwal: v }).catch(()=>{});
  }
  let _activeTab = 'transaksi';
  let _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'' };
  let _page    = 1;
  let _perPage = parseInt(localStorage.getItem('becca_kas_perPage') || '50');
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
    _saldoAwal = await _loadSaldoAwal();
    try { _kasLocked = new Set(JSON.parse(localStorage.getItem(_KAS_LOCK_KEY)||'[]')); } catch { _kasLocked = new Set(); }
    _editingId = null;
    _pendingChanges = {};
    UndoRedo.setActive('kas');

    // Progressive loading — fast first page, background load rest
    const cachedKas   = DB.getCached('kas');
    const cachedMasuk = DB.getCached('kas_masuk');
    if (cachedKas)   { _kas = cachedKas; _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); }
    if (cachedMasuk) _masuk = cachedMasuk;

    switchTab('transaksi');
    _injectStyles();

    if (!cachedKas || !cachedMasuk) {
      // Fast: fetch first page (50 rows) for instant render
      if (!cachedKas) {
        const first = await DB.getPage('kas', { page:1, perPage:100, orderBy:'created_at', ascending:false });
        if (first.data.length) { _kas = first.data; _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); renderTransaksi(); }
      }
      // Background: load full dataset
      const [freshKas, freshMasuk] = await Promise.all([
        cachedKas   ? Promise.resolve(cachedKas)   : DB.getKas(),
        cachedMasuk ? Promise.resolve(cachedMasuk) : DB.getKasMasuk(),
      ]);
      _kas   = freshKas;
      _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
      _masuk = freshMasuk;
      if (_activeTab === 'transaksi') renderTransaksi();
      else switchTab(_activeTab);
    }
    // Update belanja pasar badge on init (without switching tab)
    _updateBPBadge();
  }

  async function _updateBPBadge() {
    let bpDocs = [];
    try { bpDocs = await DB.getBelanjaPasar(); } catch {}
    const pending = bpDocs.filter(d => d.status === 'selesai' && d.kasStatus !== 'confirmed').length;
    // Tab badge
    const tabBtn = document.querySelector('[data-tab="belanjaPasar"]');
    if (tabBtn) {
      const old = tabBtn.querySelector('.bp-kas-badge');
      if (old) old.remove();
      if (pending > 0) tabBtn.insertAdjacentHTML('beforeend',
        `<span class="bp-kas-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;background:#ef4444;color:#fff;border-radius:99px;font-size:9px;font-weight:700;margin-left:6px;padding:0 4px">${pending}</span>`);
    }
    // Sidebar badge
    const sideLink = document.querySelector('[data-page="kas"]');
    if (sideLink) {
      const old = sideLink.querySelector('.bp-side-badge');
      if (old) old.remove();
      if (pending > 0) {
        sideLink.style.position = 'relative';
        sideLink.insertAdjacentHTML('beforeend',
          `<span class="bp-side-badge" style="position:absolute;top:4px;right:4px;min-width:14px;height:14px;background:#ef4444;color:#fff;font-size:8px;font-weight:700;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 3px">${pending}</span>`);
      }
    }
  }

  function _injectStyles() {
    if (document.getElementById('kas-ss-style')) return;
    const s = document.createElement('style');
    s.id = 'kas-ss-style';
    s.textContent = `
      .ks-tbl{width:100%;border-collapse:collapse;font-size:13px;}
      .ks-tbl th{background:var(--thead-bg);color:var(--thead-text);font-size:10px;text-transform:uppercase;
        letter-spacing:.05em;padding:7px 8px;border:1px solid var(--border);white-space:nowrap;
        position:sticky;top:0;z-index:2;}
      .ks-tbl td{border:1px solid var(--border);padding:0;height:32px;background:var(--surface);vertical-align:middle;}
      .ks-tbl td .ks-cell{display:flex;align-items:center;padding:0 8px;height:32px;cursor:cell;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;}
      .ks-tbl tr.ks-view:hover td{background:rgba(99,102,241,.1);cursor:pointer;}
      .ks-tbl tr.ks-editing td{background:rgba(99,102,241,.06)!important;outline:1px solid var(--primary);outline-offset:-1px;}
      .ks-inp{width:100%;height:100%;border:none;outline:none;padding:0 6px;background:transparent;
        color:var(--text);font-size:13px;font-family:var(--font);box-sizing:border-box;min-height:32px;}
      .ks-inp:focus{background:rgba(99,102,241,.08)}
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
      .ks-tbl tr.ks-row-kas td{background:rgba(59,130,246,.10)!important;}
      .ks-tbl tr.ks-row-kas:hover td{background:rgba(59,130,246,.20)!important;}
      .ks-tbl tr.ks-row-done td{background:rgba(30,40,30,.55)!important;color:rgba(220,255,220,.85)!important;}
      .ks-tbl tr.ks-row-done:hover td{background:rgba(30,50,30,.70)!important;}
      .ks-tbl tr.ks-row-done .badge{background:#16a34a!important;color:#fff!important;font-weight:700!important;}
      .ks-tbl tr.ks-row-done .ks-cell{color:rgba(220,255,220,.85)!important;}
      .ks-tbl tr.ks-row-tbc td{background:rgba(245,158,11,.10)!important;}
      .ks-tbl tr.ks-row-tbc:hover td{background:rgba(245,158,11,.20)!important;}
      .ks-tbl tr.ks-row-tbc .badge-warning{background:#d97706!important;color:#fff!important;font-weight:700!important;}
      .ks-tbl tr.ks-row-bp td{background:rgba(8,145,178,.06)!important;}
      .ks-tbl tr.ks-row-bp:hover td{background:rgba(8,145,178,.12)!important;}
      .ks-tbl tr.ks-row-bp td:first-child{border-left:3px solid #0891b2!important;}
    `;
    document.head.appendChild(s);
    // Auto-select text on focus for edit inputs
    document.addEventListener('focusin', e => {
      if (e.target.matches('.ks-inp,.iv-inp,[data-eid] input,[data-eid] select')) {
        setTimeout(() => { if (e.target.select) e.target.select(); }, 0);
      }
    });
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
      <div id="kas-bp-dash"></div>
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
      ? `<button class="btn btn-ghost btn-sm" onclick="KasModule.importExcel()" title="Import data dari file Excel (.xlsx)">Import Excel</button>
         <button class="btn btn-ghost btn-sm" onclick="KasModule.exportCSV()">Export CSV</button>`
      : '';
    // BP dashboard visibility follows transaksi tab
    const bpEl = document.getElementById('kas-bp-dash');
    if (bpEl) bpEl.style.display = tab==='transaksi' ? '' : 'none';
    if (tab==='transaksi') { UndoRedo.setActive('kas'); _renderBPDashboard(); renderTransaksi(); _renderBalanceCards(); }
    else if (tab==='summary')  renderSummary();
    else if (tab==='monthly')  renderMonthly();
    else if (tab==='cashflow') renderCashflow();
  }

  /* ===================== RENDER TRANSAKSI ===================== */
  function reArrange() {
    // Sort source array _kas by date descending (persists across renders)
    _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    renderTransaksi();
    Notify.success('Data diurutkan berdasarkan tanggal');
  }

  function renderTransaksi() {
    const canEdit = Auth.can('kas','edit');
    const filtered = _applyFilter(_kas); // preserves _kas order, no auto-sort
    const total    = filtered.length;
    const paged    = filtered.slice((_page-1)*_perPage, _page*_perPage);
    const totalPg  = Math.ceil(total/_perPage);
    const sum      = filtered.reduce((s,r)=>s+(r.jumlah||0),0);
    const bulanOpts= [...new Set(_kas.map(r=>r.bulan).filter(Boolean))].sort();

    document.getElementById('kas-tab-transaksi').innerHTML = `
      <div style="margin-bottom:var(--s4)" id="kas-strip-wrap">${_summaryStrip(filtered)}<div id="kas-balance-cards" style="margin-top:var(--s3)"></div></div>
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
        <button id="kas-reset-btn" onclick="KasModule.resetFilter()" title="Reset Filter" class="filter-reset-btn">↺</button>
        <button onclick="UndoRedo.undo('kas')" title="Undo (Ctrl+Z)"
          style="height:34px;width:34px;min-width:34px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:14px;transition:all .15s;${UndoRedo.canUndo('kas')?'':'opacity:.3;pointer-events:none'}"
          onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">↩</button>
        <button onclick="UndoRedo.redo('kas')" title="Redo (Ctrl+Shift+Z)"
          style="height:34px;width:34px;min-width:34px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:14px;transition:all .15s;${UndoRedo.canRedo('kas')?'':'opacity:.3;pointer-events:none'}"
          onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">↪</button>
        <button onclick="KasModule.reArrange()" title="Urutkan berdasarkan tanggal"
          style="height:34px;padding:0 10px;border-radius:var(--r-sm);
                 border:1px solid var(--border2);background:transparent;
                 cursor:pointer;display:flex;align-items:center;gap:4px;
                 color:var(--text-2);font-size:11px;font-weight:600;transition:all .15s;white-space:nowrap"
          onmouseover="this.style.background='rgba(99,102,241,.1)';this.style.color='var(--primary)';this.style.borderColor='var(--primary)'"
          onmouseout="this.style.background='transparent';this.style.color='var(--text-2)';this.style.borderColor='var(--border2)'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 6h18M3 12h12M3 18h6"/></svg>
          Re-arrange
        </button>
        <span class="text-muted text-small" style="margin-left:auto">${total} baris</span>
      </div>


      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;min-height:24px">
        <div id="kas-saldo-bar" style="font-size:12px;color:var(--text-3)"></div>
        <div id="kas-balance-bar" style="text-align:right"></div>
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="ks-tbl" id="kas-grid" data-grid-select>
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
            ${canEdit ? `<th style="width:28px;padding:0;text-align:center"><input type="checkbox" title="Pilih semua" onchange="KasModule._bulkToggleAll(this.checked)" style="cursor:pointer"></th>` : ''}
          </tr></thead>
          <tbody id="kas-tbody">
            ${paged.map((r,i)=>_rowView(r,(_page-1)*_perPage+i+1,canEdit)).join('')}
          </tbody>
        </table>
      </div>
      ${UI.pagination({ page:_page, totalPages:totalPg, total, perPage:_perPage, onPage:'KasModule.goPage', onPerPage:'KasModule.setPerPage', label:'baris' })}
    `;
    _renderBalanceCards();
    if (window.GridSelect) {
      GridSelect.onFill('kas-grid', _onGridFill);
      GridSelect.onPaste('kas-grid', _onGridPaste);
    }
    // Toggle reset button animation — double rAF to ensure browser painted inactive state first
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const rb = document.getElementById('kas-reset-btn');
      if (rb) { if (_filter.dateFrom||_filter.dateTo||_filter.bulan||_filter.type||_filter.status) rb.classList.add('active'); else rb.classList.remove('active'); }
    }));
  }

  /* ---- VIEW ROW ---- */
  function _rowView(r, rowNum, canEdit) {
    const sc = r.status==='DONE'?'badge-success':r.status==='TBC'?'badge-warning':'badge-neutral';
    const isBP = !!r.bpDocId;
    const rowColorClass = isBP ? 'ks-row-bp' : r.type==='Kas' ? 'ks-row-kas' : r.status==='DONE' ? 'ks-row-done' : r.status==='TBC' ? 'ks-row-tbc' : '';
    const ksOnDbl = !_kasLocked.has(r.id) ? `KasModule.startEdit('${r.id}',event.target.closest('td')?.dataset?.field)` : '';
    return `<tr class="ks-view ${rowColorClass}" id="ks-row-${r.id}" data-id="${r.id}" style="${_kasLocked.has(r.id)?'opacity:.75':''};cursor:pointer" ondblclick="${ksOnDbl}">
      <td style="width:28px">
        <div class="ks-cell" style="justify-content:center;font-size:11px;color:var(--text-3)">
          ${_kasLocked.has(r.id)?'<span style="opacity:.4">'+rowNum+'</span>':rowNum}
        </div>
      </td>
      <td data-field="ks-tgl-${r.id}" style="white-space:nowrap"><div class="ks-cell">${r.tgl ? r.tgl.split('-').reverse().join('-') : ''}</div></td>
      <td data-field="ks-nama-${r.id}"><div class="ks-cell">${r.nama||''}${isBP?'<span style="font-size:8px;background:rgba(8,145,178,.15);color:#0891b2;padding:1px 4px;border-radius:3px;margin-left:4px;font-weight:700;vertical-align:middle">PASAR</span>':''}</div></td>
      <td data-field="ks-type-${r.id}"><div class="ks-cell"><span class="badge badge-neutral" style="font-size:10px">${r.type||''}</span></div></td>
      <td data-field="ks-vendor-${r.id}"><div class="ks-cell">${r.vendor||''}</div></td>
      <td data-field="ks-qty-${r.id}" class="ks-num"><div class="ks-cell">${(r.qty||0)%1===0?(r.qty||0):parseFloat((r.qty||0).toFixed(2))}</div></td>
      <td data-field="ks-sat-${r.id}"><div class="ks-cell">${r.satuan||''}</div></td>
      <td data-field="ks-harga-${r.id}" class="ks-num"><div class="ks-cell">${Utils.formatRupiah(r.hargaSatuan||0)}</div></td>
      <td data-field="ks-jumlah-${r.id}" class="ks-num"><div class="ks-cell"><strong>${Utils.formatRupiah(r.jumlah||0)}</strong></div></td>
      <td data-field="ks-penerima-${r.id}"><div class="ks-cell">${r.penerima||''}</div></td>
      <td data-field="ks-status-${r.id}"><div class="ks-cell"><span class="badge ${sc}" style="font-size:10px">${r.status||''}</span></div></td>
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
      </td>`:''}
      ${canEdit?`<td style="width:28px;padding:0;text-align:center" onclick="event.stopPropagation()">
        <input type="checkbox" class="ks-bulk-chk" data-id="${r.id}" ${_bulkSelected.has(r.id)?'checked':''}
          onchange="KasModule._bulkToggle('${r.id}',this.checked)" style="cursor:pointer">
      </td>`:''}\n    </tr>`;
  }

  /* ---- EDIT ROW ---- */
  function _rowEdit(r, rowNum, canEdit) {
    const typeOpts   = TYPES.map(t=>`<option value="${t}" ${r.type===t?'selected':''}>${t}</option>`).join('');
    const statusOpts = ['-','DONE','TBC'].map(s=>`<option value="${s==='-'?'':s}" ${(r.status||'')===(s==='-'?'':s)?'selected':''}>${s}</option>`).join('');
    const bulanOpts  = MONTHS.map(m=>`<option value="${m}" ${r.bulan===m?'selected':''}>${m}</option>`).join('');
    return `<tr class="ks-editing" id="ks-row-${r.id}" data-id="${r.id}" onclick="event.stopPropagation()">
      <td><div class="ks-cell" style="justify-content:center;color:var(--primary-h);font-size:11px">${rowNum}</div></td>
      <td><input class="ks-inp" type="date" value="${r.tgl||''}" id="ks-tgl-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><input class="ks-inp" type="text" value="${(r.nama||'').replace(/"/g,'&quot;')}" placeholder="Nama/keterangan"
            id="ks-nama-${r.id}" autocomplete="off"
            oninput="KasModule._onNamaInput('${r.id}',this.value)"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><select class="ks-sel" id="ks-type-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')">${typeOpts}</select></td>
      <td><input class="ks-inp" type="text" value="${(r.vendor||'').replace(/"/g,'&quot;')}" placeholder="Vendor"
            id="ks-vendor-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" step="1" value="${r.qty||0}"
            id="ks-qty-${r.id}" oninput="KasModule._calcTotal('${r.id}')" style="text-align:right"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><input class="ks-inp" type="text" value="${r.satuan||''}" list="ks-sat-lst" id="ks-sat-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')">
          <datalist id="ks-sat-lst">${SATUANS.map(s=>`<option value="${s}">`).join('')}</datalist></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" value="${r.hargaSatuan||0}"
            id="ks-harga-${r.id}" oninput="KasModule._calcTotal('${r.id}')" style="text-align:right"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" value="${r.jumlah||0}"
            id="ks-jumlah-${r.id}" style="text-align:right;font-weight:700"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><input class="ks-inp" type="text" value="${(r.penerima||'').replace(/"/g,'&quot;')}" placeholder="Penerima"
            id="ks-penerima-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><select class="ks-sel" id="ks-status-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')">${statusOpts}</select></td>
      ${canEdit?`<td><button class="ks-del-btn" style="color:var(--success);border:1px solid var(--success)"
          onclick="event.stopPropagation();KasModule.commitEdit('${r.id}')" title="Simpan">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <polyline points="20,6 9,17 4,12"/>
          </svg></button></td>`:''}
      ${canEdit?'<td style="width:28px"></td>':''}
    </tr>`;
  }

  /* ---- AI: nama input → suggest type + autocomplete dropdown ---- */
  let _acIdx = -1; // active suggestion index

  function _onNamaInput(id, val) {
    // AI type suggestion
    const suggested = _suggestType(val);
    if (suggested) {
      const sel = document.getElementById('ks-type-'+id);
      if (sel) sel.value = suggested;
    }
    // Autocomplete dropdown
    _showNamaSuggestions(id, val);
  }

  function _showNamaSuggestions(id, val) {
    const inp = document.getElementById('ks-nama-'+id);
    if (!inp) return;
    // Remove existing dropdown
    document.getElementById('ks-ac-drop')?.remove();
    _acIdx = -1;
    if (!val || val.length < 1) return;

    const q = val.toLowerCase();
    // Collect unique names from _kas, sorted by frequency
    const freq = {};
    _kas.forEach(r => { if (r.nama) freq[r.nama] = (freq[r.nama]||0)+1; });
    const matches = Object.keys(freq)
      .filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .sort((a,b) => freq[b]-freq[a])
      .slice(0, 8);
    if (!matches.length) return;

    const rect = inp.getBoundingClientRect();
    const drop = document.createElement('div');
    drop.id = 'ks-ac-drop';
    drop.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.bottom+2}px;width:${Math.max(rect.width,200)}px;
      background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:8px;
      box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:9999;max-height:200px;overflow-y:auto;padding:4px 0`;
    drop.innerHTML = matches.map((n,i) => {
      // Highlight matching part
      const idx = n.toLowerCase().indexOf(q);
      const before = n.slice(0, idx);
      const match = n.slice(idx, idx+q.length);
      const after = n.slice(idx+q.length);
      return `<div class="ks-ac-item" data-idx="${i}" data-val="${n.replace(/"/g,'&quot;')}"
        style="padding:6px 12px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .1s"
        onmousedown="KasModule._selectNamaSuggestion('${id}',this.dataset.val)"
        onmouseenter="this.style.background='rgba(99,102,241,.08)'"
        onmouseleave="this.style.background=''">
        <span style="flex:1">${before}<strong style="color:var(--primary)">${match}</strong>${after}</span>
        <span style="font-size:9px;color:var(--text-3)">${freq[n]}x</span>
      </div>`;
    }).join('');
    document.body.appendChild(drop);

    // Close on blur (delayed to allow mousedown on suggestion)
    inp._acBlur = () => setTimeout(() => drop.remove(), 150);
    inp.addEventListener('blur', inp._acBlur, {once:true});
  }

  function _highlightAc(items) {
    items.forEach((it,i) => { it.style.background = i===_acIdx ? 'rgba(99,102,241,.1)' : ''; });
    if (_acIdx >= 0 && items[_acIdx]) items[_acIdx].scrollIntoView({block:'nearest'});
  }

  function _selectNamaSuggestion(id, val) {
    const inp = document.getElementById('ks-nama-'+id);
    if (inp) { inp.value = val; inp.dispatchEvent(new Event('input')); }
    document.getElementById('ks-ac-drop')?.remove();
    // Also trigger type suggestion
    const suggested = _suggestType(val);
    if (suggested) { const sel = document.getElementById('ks-type-'+id); if (sel) sel.value = suggested; }
    // Also fill vendor if known
    const prevRow = _kas.find(r => r.nama === val && r.vendor);
    if (prevRow) { const v = document.getElementById('ks-vendor-'+id); if (v && !v.value) v.value = prevRow.vendor; }
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
  async function _handleOutsideClick(e) {
    if (!_editingId) return;
    if (document.getElementById('_val-popup')) return;
    if (e.target.closest('.notify-popup,.notify-container')) return;
    const editingRow = document.getElementById('ks-row-'+_editingId);
    if (editingRow && !editingRow.contains(e.target)) {
      const id = _editingId;
      document.removeEventListener('click', _handleOutsideClick);
      // Baris baru kosong → cancel, bukan commit
      const row = _kas.find(r => r.id === id);
      if (row && row._isNew && !(row.nama||'').trim()) {
        cancelEdit(id);
        return;
      }
      const ok = await _doCommit(id, true); // skipValidation — bisa exit kapanpun
      if (ok) _editingId = null;
    }
  }

  async function startEdit(id, focusField) {
    if (_editingId === id) return;
    if (_kasLocked.has(id)) {
      // Row terkunci - tidak bisa edit langsung, perlu unlock via # icon
      return;
    }

    // FIX: Remove old listener FIRST before committing
    document.removeEventListener('click', _handleOutsideClick);

    // Commit previous tanpa validasi
    if (_editingId) {
      const prevId = _editingId;
      _editingId = null;
      await _doCommit(prevId, true);
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
      document.getElementById(focusField || 'ks-nama-'+id)?.focus();
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

  async function _doCommit(id, skipValidation = false) {
    const row = _kas.find(r=>r.id===id);
    if (!row) return true;
    const origStr = row._original || '{}';
    const vals = _readRowFromDOM(id);

    if (!skipValidation) {
      const _failV = (msg) => {
        Notify.popup(msg);
        _editingId = id;
        setTimeout(() => document.addEventListener('click', _handleOutsideClick), 50);
      };
      if (!vals.nama || !vals.nama.trim())            { _failV('Nama / Keterangan wajib diisi'); return false; }
      if (!vals.qty || vals.qty <= 0)                 { _failV('Qty wajib diisi dan harus lebih dari 0'); return false; }
      if (!vals.satuan || !vals.satuan.trim())        { _failV('Satuan wajib diisi'); return false; }
      if (!vals.hargaSatuan || vals.hargaSatuan <= 0) { _failV('Harga Satuan wajib diisi'); return false; }
      if (!vals.penerima || !vals.penerima.trim())    { _failV('Penerima wajib diisi'); return false; }
    }

    Object.assign(row, vals);
    const wasNew = row._isNew;
    // Change detection - skip save if nothing changed
    const newStr = JSON.stringify({tgl:row.tgl,nama:row.nama,type:row.type,vendor:row.vendor,
      qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,jumlah:row.jumlah,
      penerima:row.penerima,status:row.status,bulan:row.bulan});
    delete row._original;
    delete row._isNew;
    const hasChanged = origStr !== newStr;

    const trEl = document.getElementById('ks-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('kas-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
      trEl.outerHTML = _rowView(row, rowNum, true);
    }
    if (!hasChanged) return true;  // Nothing changed - skip save+log

    // Track undo
    try { const origData = JSON.parse(origStr);
    UndoRedo.push('kas', {
      id, before: origData, after: {...row, _original:undefined, _isNew:undefined},
      save: async (data) => { const r = _kas.find(x=>x.id===id); if(r) { Object.assign(r,data); await DB.saveKas({...r}); } },
      render: () => renderTransaksi()
    }); } catch(e){}

    // AWAIT save — mencegah race condition saat switch tab
    try {
      await DB.saveKas(row);
      const logType = wasNew ? 'add_kas' : 'edit_kas';
      const logDetail = wasNew ? 'Baris baru: '+(row.nama||id) : 'Edit: '+(row.nama||id);
      const _after = {id,nama:row.nama,type:row.type,jumlah:row.jumlah,vendor:row.vendor,tgl:row.tgl,status:row.status,qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,penerima:row.penerima};
      const _before = wasNew ? null : (()=>{ try{return JSON.parse(origStr)}catch{return null} })();
      DB.logActivity({type:logType, detail:logDetail, rowId:id, snapshot:{before:_before, after:_after}});
      const newTr = document.getElementById('ks-row-'+id);
      if (newTr) { newTr.classList.add('ks-saved'); setTimeout(()=>newTr.classList.remove('ks-saved'),500); }
    } catch(e) { Notify.error('Gagal simpan', e.message); }
    return true;
  }

  async function commitEdit(id) {
    if (_editingId !== id) return;
    document.removeEventListener('click', _handleOutsideClick);
    const ok = await _doCommit(id, true); // skipValidation — bisa exit kapanpun
    if (ok) _editingId = null;
  }

  // Enter: save current row + open new row immediately
  async function commitAndAddRow(id) {
    if (_editingId !== id) return;
    document.removeEventListener('click', _handleOutsideClick);
    const ok = await _doCommit(id, true); // skipValidation
    if (ok) { _editingId = null; addRow(); }
  }

  // Esc: discard changes + close edit
  // Jika baris baru (dari Enter) dan belum diisi → hapus baris tersebut
  function cancelEdit(id) {
    if (_editingId !== id) return;
    document.removeEventListener('click', _handleOutsideClick);
    document.getElementById('_val-popup')?.remove();
    const row = _kas.find(r => r.id === id);
    // Check DOM value too (row.nama may be stale)
    const domNama = document.getElementById('ks-nama-'+id)?.value || '';
    if (row && row._isNew && !domNama.trim() && !(row.nama||'').trim()) {
      _editingId = null;
      _kas = _kas.filter(r => r.id !== id);
      DB.deleteKas(id).catch(() => {});
      renderTransaksi();
      Notify.info('Baris baru dibatalkan');
      return;
    }

    if (row?._original) {
      try { Object.assign(row, JSON.parse(row._original)); } catch {}
    }
    _editingId = null;
    const trEl = document.getElementById('ks-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('kas-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
      trEl.outerHTML = _rowView(row, rowNum, true);
    }
  }

  function _rowKeyDown(e, id) {
    const acDrop = document.getElementById('ks-ac-drop');
    if (acDrop) {
      // Dropdown active — handle navigation here, prevent all propagation
      const items = acDrop.querySelectorAll('.ks-ac-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        _acIdx = Math.min(_acIdx + 1, items.length - 1);
        _highlightAc(items);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        _acIdx = Math.max(_acIdx - 1, -1);
        _highlightAc(items);
        return;
      }
      if (e.key === 'Enter' && _acIdx >= 0 && items[_acIdx]) {
        e.preventDefault(); e.stopPropagation();
        _selectNamaSuggestion(id, items[_acIdx].dataset.val);
        return;
      }
      if (e.key === 'Tab' && _acIdx >= 0 && items[_acIdx]) {
        e.preventDefault(); e.stopPropagation();
        _selectNamaSuggestion(id, items[_acIdx].dataset.val);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); acDrop.remove(); return; }
    }
    if (e.key === 'Enter')       { e.preventDefault(); commitAndAddRow(id); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(id); }
  }

  /* ===================== ADD / DELETE ===================== */
  function unlockKasRow(id) {
    _kasLocked.delete(id);
    localStorage.setItem(_KAS_LOCK_KEY, JSON.stringify([..._kasLocked]));
    startEdit(id);
  }

  async function addRow() {
    if (_editingId) {
      document.removeEventListener('click', _handleOutsideClick);
      const prevId = _editingId;
      _editingId = null;
      await _doCommit(prevId, true); // skipValidation
    }
    const today = new Date().toISOString().split('T')[0];
    const mo    = parseInt(today.split('-')[1]) - 1;
    const newRow = {
      tgl:today, nama:'', type:'', vendor:'',
      qty:1, satuan:'Pcs', hargaSatuan:0, jumlah:0,
      penerima:'', status:'', bulan:MONTHS[mo],
    };
    try {
      const saved = await DB.saveKas(newRow);
      saved._isNew = true;
      _kas.unshift(saved);
      _page = 1;
      renderTransaksi();
      setTimeout(()=>startEdit(saved.id), 80);
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  /* ── Bulk Delete ── */
  function _bulkToggle(id, checked) {
    if (checked) _bulkSelected.add(id); else _bulkSelected.delete(id);
    _renderBulkBar();
  }
  function _bulkToggleAll(checked) {
    document.querySelectorAll('.ks-bulk-chk').forEach(c => { if (checked) _bulkSelected.add(c.dataset.id); else _bulkSelected.delete(c.dataset.id); c.checked = checked; });
    _renderBulkBar();
  }
  function _renderBulkBar() {
    let bar = document.getElementById('ks-bulk-bar');
    if (_bulkSelected.size === 0) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'ks-bulk-bar';
      bar.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:500;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:8px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.25);';
      document.body.appendChild(bar);
    }
    bar.innerHTML = `
      <span style="font-size:13px;font-weight:600;color:var(--text)">${_bulkSelected.size} dipilih</span>
      <button onclick="KasModule._bulkDelete()" style="padding:6px 16px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:12px;font-weight:600;cursor:pointer">🗑 Hapus</button>
      <button onclick="KasModule._bulkClear()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;cursor:pointer">Batal</button>`;
  }
  function _bulkClear() {
    _bulkSelected.clear();
    document.querySelectorAll('.ks-bulk-chk').forEach(c => c.checked = false);
    const hdr = document.querySelector('#kas-grid thead input[type="checkbox"]');
    if (hdr) hdr.checked = false;
    _renderBulkBar();
  }
  async function _bulkDelete() {
    const count = _bulkSelected.size;
    const ok = await Modal.confirm({ title:'Hapus Bulk', message:`Hapus <strong>${count}</strong> baris kas secara permanen?`, danger:true, confirmText:`Hapus ${count} Baris` });
    if (!ok) return;
    const ids = [..._bulkSelected];
    let deleted = 0;
    for (const id of ids) { try { await DB.deleteKas(id); _kas = _kas.filter(r=>r.id!==id); deleted++; } catch {} }
    _bulkSelected.clear();
    const bar = document.getElementById('ks-bulk-bar'); if (bar) bar.remove();
    renderTransaksi();
    Notify.success(`${deleted} baris dihapus`);
    DB.logActivity({type:'bulk_delete_kas', detail:`${deleted} baris dihapus`});
  }

  async function deleteRow(id) {
    if (_editingId===id) { document.removeEventListener('click',_handleOutsideClick); _editingId=null; }
    const deleted = _kas.find(r=>r.id===id);
    if (!deleted) return;
    _kas = _kas.filter(r=>r.id!==id);
    UndoRedo.push('kas', {
      id, before: deleted, after: null,
      save: async (data) => { if(data) { _kas.push(data); _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); await DB.saveKas({...data}); } else { _kas=_kas.filter(r=>r.id!==id); await DB.deleteKas(id); } },
      render: () => renderTransaksi()
    });
    renderTransaksi();
    const t = setTimeout(() => {
      DB.deleteKas(id).catch(()=>{});
      DB.logActivity({type:'delete_kas', detail:'Baris dihapus'});
    }, 5000);
    Notify.undo('Baris dihapus', () => {
      clearTimeout(t);
      _kas.push(deleted);
      _kas.sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||''));
      renderTransaksi();
      Notify.success('Undo berhasil');
    });
  }

  /* ===================== FILTER & PAGE ===================== */
  function _applyFilter(data) {
    return data.filter(r=>{
      if (_filter.bulan   && r.bulan !==_filter.bulan)   return false;
      if (_filter.type    && r.type  !==_filter.type)    return false;
      if (_filter.status) {
        if (_filter.status==='-') { if (r.status) return false; }
        else if (r.status!==_filter.status) return false;
      }
      if (_filter.dateFrom && r.tgl  < _filter.dateFrom) return false;
      if (_filter.dateTo  && r.tgl   > _filter.dateTo)   return false;
      return true;
    });
  }
  function setFilter(k,v){ if(_editingId)commitEdit(_editingId); _filter[k]=v; _page=1; renderTransaksi(); }
  function resetFilter() {
    const btn = document.getElementById('kas-reset-btn');
    if (btn) { btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 600); }
    if(_editingId)commitEdit(_editingId); _filter={}; _page=1; renderTransaksi();
  }
  function goPage(p)      { if(_editingId)commitEdit(_editingId); _page=p; renderTransaksi(); }
  function setPerPage(n)  { _perPage=n; localStorage.setItem('becca_kas_perPage',n); _page=1; renderTransaksi(); }

  /* ===================== SUMMARY STRIP ===================== */
  function _summaryStrip(data) {
    const keluar = data.filter(r=>r.type!=='Kas');
    const done   = keluar.filter(r=>r.status==='DONE');
    const tbc    = keluar.filter(r=>r.status==='TBC');
    const noSt   = keluar.filter(r=>!r.status);
    const _card = (icon, label, value, color, accent, onclick='') => {
      return `<div ${onclick?`onclick="${onclick}"`:''}  class="ks-strip-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s3) var(--s4);min-width:0;transition:all .2s;position:relative;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);${onclick?'cursor:pointer':''}"
        onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='var(--shadow-sm)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent}"></div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:12px">${icon}</span>
          <span style="font-size:10px;color:var(--text-2);font-weight:600">${label}</span>
        </div>
        <div style="font-size:14px;font-weight:800;color:${color};font-family:var(--font-mono);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value}</div>
      </div>`;
    };
    const masuk = data.filter(r=>r.type==='Kas');
    return `<style>.ks-cards{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--s2);width:100%;align-items:stretch}@media(max-width:1100px){.ks-cards{grid-template-columns:repeat(3,1fr)}}@media(max-width:600px){.ks-cards{grid-template-columns:repeat(2,1fr)}}</style>
    <div class="ks-cards">
      ${_card('\ud83d\udce4','Total Keluar', Utils.formatRupiah(keluar.reduce((s,r)=>s+(r.jumlah||0),0)), 'var(--danger)', '#ef4444')}
      ${_card('\u2705','Confirmed',    Utils.formatRupiah(done.reduce((s,r)=>s+(r.jumlah||0),0)),   'var(--success)', '#22c55e')}
      ${_card('\u23f3','TBC',          Utils.formatRupiah(tbc.reduce((s,r)=>s+(r.jumlah||0),0)),    'var(--warning)', '#f59e0b', "KasModule.filterByStatus('TBC')")}
      ${_card('\u2753','Belum Diisi',  noSt.length+' baris',                                        'var(--text-2)', '#64748b', "KasModule.filterByStatus('-')")}
      ${_card('\ud83d\udcb0','Kas Masuk',   Utils.formatRupiah(masuk.reduce((s,r)=>s+(r.jumlah||0),0)),  'var(--success)', '#10b981', "KasModule.filterKasMasukType()")}
    </div>`;
  }

  /* ===================== EXPORT CSV ===================== */
  /* ===================== IMPORT EXCEL ===================== */
  function importExcel() {
    const inp = Object.assign(document.createElement('input'), { type:'file', accept:'.xlsx,.xls', style:'display:none' });
    document.body.appendChild(inp);
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(inp);
      if (!file) return;

      // ── 1. Load SheetJS dari CDN yang reliable ────────────────
      if (!window.XLSX) {
        Notify.info('Memuat library Excel...');
        const CDNS = [
          'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
          'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
        ];
        let loaded = false;
        for (const src of CDNS) {
          loaded = await new Promise(res => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => res(true);
            s.onerror = () => res(false);
            document.head.appendChild(s);
          });
          if (loaded && window.XLSX) break;
        }
        if (!window.XLSX) { Notify.error('Gagal memuat library Excel. Cek koneksi internet.'); return; }
      }

      // ── 2. Parse file Excel ───────────────────────────────────
      Notify.info('Membaca file Excel...');
      let wb;
      try {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type:'array', cellDates:false });
      } catch(e) { Notify.error('File tidak bisa dibaca', e.message); return; }

      // ── 3. Mapping nama kolom Excel → field BECCA ─────────────
      const COL_MAP = {
        // tanggal
        tanggal:'tgl', tgl:'tgl', date:'tgl',
        // nama / keterangan
        nama:'nama', keterangan:'nama', ket:'nama', description:'nama',
        nama_barang:'nama', namabarang:'nama',
        // type
        type:'type', tipe:'type',
        // vendor
        vendor:'vendor',
        // qty
        qty:'qty', jumlah_qty:'qty',
        // satuan
        satuan:'satuan', sat:'satuan', unit:'satuan',
        // harga satuan
        harga:'hargaSatuan', harga_satuan:'hargaSatuan', hargasatuan:'hargaSatuan',
        hargasat:'hargaSatuan', price:'hargaSatuan',
        // jumlah total (debit = pengeluaran)
        jumlah:'jumlah', total:'jumlah', amount:'jumlah', debit:'jumlah',
        // kredit = uang masuk
        kredit:'kredit',
        // penerima
        penerima:'penerima', pic:'penerima',
        nama_penerima:'penerima', namapenerima:'penerima',
        // status
        status:'status',
      };
      const _parseDate = (v) => {
        if (!v && v !== 0) return '';
        // Jika instanceof Date (fallback): pakai local methods karena SheetJS bisa pakai local constructor
        if (v instanceof Date) {
          if (isNaN(v.getTime())) return '';
          const y=v.getFullYear(), m=String(v.getMonth()+1).padStart(2,'0'), d=String(v.getDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        const s = String(v).trim();
        // Format DD/MM/YYYY atau DD-MM-YYYY
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
          const p=s.split(/[\/\-]/);
          // Deteksi otomatis: jika bagian pertama > 12, pasti DD (bukan MM)
          const [a,b,c]=p;
          const dd=parseInt(a),mm=parseInt(b);
          if(dd>12) return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`; // DD/MM/YYYY
          if(mm>12) return `${c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`; // MM/DD/YYYY
          return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`; // default DD/MM/YYYY
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // Excel serial number — dengan cellDates:false semua dates masuk sini sebagai float
        // Formula: (serial - 25569) * 86400000 = ms since Unix epoch (UTC midnight)
        // getTime() → new Date(UTC midnight) → local getFullYear/Month/Date
        // Untuk UTC+7: UTC midnight March 26 = local March 26 07:00 → getDate()=26 ✓
        const num = parseFloat(s);
        if (!isNaN(num) && num > 40000) {
          const serial = Math.floor(num); // floor() strip time component (e.g. 46107.5 → 46107)
          const ms = (serial - 25569) * 86400000;
          const y=new Date(ms).getUTCFullYear();
          const mo=String(new Date(ms).getUTCMonth()+1).padStart(2,'0');
          const d=String(new Date(ms).getUTCDate()).padStart(2,'0');
          return `${y}-${mo}-${d}`;
        }
        return '';
      };
      const _parseNum = (v) => {
        if (v===undefined||v===null||v==='') return 0;
        if (typeof v==='number') return v;
        // Bisa berupa scientific notation: "1.3653161E7"
        const n = parseFloat(String(v).replace(/[^\d.eE\-\+]/g,''));
        return isNaN(n) ? 0 : n;
      };
      const _parseStatus = (v) => {
        const s = String(v||'').trim();
        if (s === '✔' || s.toLowerCase() === 'done' || s.toLowerCase() === 'selesai') return 'DONE';
        if (s.toUpperCase() === 'TBC') return 'TBC';
        return '';
      };
      const _mapHeader = (row) => {
        const map={};
        row.forEach((cell,ci)=>{
          const k=String(cell).toLowerCase().trim().replace(/[\s\/]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
          const k2=String(cell).toLowerCase().trim().replace(/[\s\/]+/g,'');
          const field=COL_MAP[k]||COL_MAP[k2]||COL_MAP[String(cell).toLowerCase().trim()];
          if(field && !(field in map)) map[field]=ci;
        });
        return map;
      };

      // ── 4. Parse semua sheet → newRows (synchronous, cepat) ───
      const newRows = [];
      const newMasuk = [];
      for (const sheetName of wb.SheetNames) {
        const bulanRaw = sheetName.trim().split(/\s+/)[0] || sheetName;
        const bulan    = _normalizeBulan(bulanRaw) || 'Jan';
        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (rows.length < 2) continue;
        // Cari baris header (header bisa ada di baris mana saja, cek sampai baris 25)
        let hdrIdx=-1, colIdx={};
        for (let ri=0; ri<Math.min(rows.length,25); ri++) {
          const map = _mapHeader(rows[ri]);
          if (map.tgl!==undefined && Object.keys(map).length >= 2) { hdrIdx=ri; colIdx=map; break; }
        }
        if (hdrIdx<0) { console.warn('[KasImport] Sheet "'+sheetName+'" header tidak dikenali, dilewati'); continue; }
        // Merge sub-header row (e.g. KREDIT/DEBIT di baris setelah header utama)
        const subRow = rows[hdrIdx+1] || [];
        const subMap = _mapHeader(subRow);
        for (const [field, ci] of Object.entries(subMap)) {
          if (!(field in colIdx)) colIdx[field] = ci;
        }
        const dataStart = (subMap.kredit!==undefined || subMap.jumlah!==undefined) && subMap.tgl===undefined
          ? hdrIdx+2 : hdrIdx+1;

        let _lastTgl = ''; // carry-forward tanggal untuk baris yang kolom tgl-nya kosong
        for (let ri=dataStart; ri<rows.length; ri++) {
          const row = rows[ri];
          if (row.every(c=>c===''||c===null||c===undefined)) continue;
          const rawTgl = colIdx.tgl!==undefined ? row[colIdx.tgl] : '';
          const parsedTgl = _parseDate(rawTgl);
          if (parsedTgl) _lastTgl = parsedTgl;
          const tgl = parsedTgl || _lastTgl;
          // Debug: log 3 baris pertama per sheet agar bisa diagnosa date parsing
          if (ri < dataStart+3 && window.BECCA_DEBUG) console.log('[KasImport] row', ri, 'rawTgl=', rawTgl, 'typeof=', typeof rawTgl, 'parsedTgl=', parsedTgl, 'tgl=', tgl);
          if (!tgl) continue;
          const nama = String(row[colIdx.nama]??'').trim();
          if (!nama || nama.toUpperCase()==='ADMINISTRATOR' || nama.toUpperCase().startsWith('TOTAL')) continue;

          const typeRaw    = String(row[colIdx.type]??'').trim();
          const vendor     = String(row[colIdx.vendor]??'').trim();
          const penerima   = String(row[colIdx.penerima]??'').trim();
          const status     = _parseStatus(colIdx.status!==undefined ? row[colIdx.status] : '');
          // Cek kolom KREDIT (O) — jika ada nilai → ini baris kas masuk
          const kreditVal  = _parseNum(colIdx.kredit!==undefined ? row[colIdx.kredit] : 0);
          if (kreditVal > 0) {
            // Baris kas masuk → simpan ke kas table sebagai type="Kas" agar tampil di tabel utama
            newRows.push({ id:Utils.uid(), tgl, nama, type:'Kas', vendor:'', qty:1, satuan:'Kali', hargaSatuan:kreditVal, jumlah:kreditVal, penerima, status, bulan });
          } else {
            // Baris pengeluaran normal: jumlah = QTY × HARGA SATUAN
            const qty        = _parseNum(colIdx.qty!==undefined ? row[colIdx.qty] : 1)||1;
            const hargaSatuan= _parseNum(colIdx.hargaSatuan!==undefined ? row[colIdx.hargaSatuan] : 0);
            const jumlah     = qty * hargaSatuan;
            if (!jumlah && !nama) continue; // skip baris kosong
            const satuanRaw  = String(row[colIdx.satuan]??'').trim();
            const typeNorm   = TYPES.find(t=>t.toLowerCase()===typeRaw.toLowerCase())||typeRaw||_suggestType(nama)||'';
            const satuanNorm = SATUANS.find(s=>s.toLowerCase()===satuanRaw.toLowerCase())||satuanRaw||'Pcs';
            newRows.push({ id:Utils.uid(), tgl, nama, type:typeNorm, vendor, qty, satuan:satuanNorm, hargaSatuan, jumlah, penerima, status, bulan });
          }
        }
      }

      if (!newRows.length) {
        Notify.error('Tidak ada data yang berhasil dibaca', 'Pastikan header kolom ada di baris pertama: Tanggal, Nama/Keterangan, Type, Vendor, Qty, Satuan, Jumlah, dll');
        return;
      }

      // ── 5. Deduplication — skip baris yang sudah ada ─────────────────────
      // Key: tgl|nama|jumlah (case-insensitive) — cukup untuk deteksi duplikat
      const existingKeys = new Set(
        _kas.map(r => `${r.tgl}|${(r.nama||'').toLowerCase().trim()}|${r.jumlah}`)
      );
      const existingMasukKeys = new Set(
        _masuk.map(r => `${r.tgl}|${(r.keterangan||r.ket||'').toLowerCase().trim()}|${r.kredit}`)
      );
      const dedupedRows  = newRows.filter(r => {
        const k = `${r.tgl}|${(r.nama||'').toLowerCase().trim()}|${r.jumlah}`;
        return !existingKeys.has(k);
      });
      const dedupedMasuk = newMasuk.filter(r => {
        const k = `${r.tgl}|${(r.keterangan||'').toLowerCase().trim()}|${r.kredit}`;
        return !existingMasukKeys.has(k);
      });
      const skippedCount = newRows.length - dedupedRows.length;

      if (!dedupedRows.length) {
        Notify.info(`Semua ${newRows.length} baris sudah ada — tidak ada data baru yang diimport`);
        return;
      }

      // ── 6. Langsung masukkan ke _kas + tampilkan ────────────────
      _kas.unshift(...dedupedRows);
      _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'' };
      _page   = 1;
      renderTransaksi();
      const skipMsg = skippedCount > 0 ? ` (${skippedCount} duplikat dilewati)` : '';
      Notify.success(`${dedupedRows.length} baris diimport${skipMsg} — menyimpan ke cloud...`);

      // ── 7. Sync ke Supabase di background (paralel, max 10 sekaligus) ────
      const CHUNK = 10;
      let saved = 0;
      for (let i=0; i<dedupedRows.length; i+=CHUNK) {
        const batch = dedupedRows.slice(i, i+CHUNK);
        await Promise.allSettled(batch.map(r => DB.saveKas(r).then(()=>saved++)));
      }
      DB.logActivity({ type:'import_kas', detail:`Import Excel: ${dedupedRows.length} baris (${skippedCount} duplikat dilewati)` });
      if(window.BECCA_DEBUG) console.log('[KasImport] Sync Supabase selesai:', saved, '/', dedupedRows.length);
    };
    inp.click();
  }

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
    // Gunakan _kas in-memory (bukan localStorage yang bisa corrupt/kosong untuk dataset besar)
    // Exclude type="Kas" (kas masuk) dari summary pengeluaran
    const kasRaw = _kas.filter(r => r.type !== 'Kas');
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
    if (!bulan.length) { el.innerHTML=UI.empty({iconKey:'money', title:'Tidak ada data', desc:'Belum ada transaksi pada periode ini'}); return; }
    const typeMap={};
    kasRaw.forEach(r=>{ const t=r.type||'Lain-lain'; typeMap[t]=(typeMap[t]||0)+(r.jumlah||0); });
    const allTypes=Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
    const fmtS = n => n ? Utils.formatRupiah(n) : '<span style="color:var(--text-3)">—</span>';
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
    const saldoAwal  = _saldoAwal;
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
            <div style="font-size:24px;font-weight:800;color:var(--danger);font-family:var(--font-mono)">${Utils.formatRupiah(grand)}</div>
          </div>
        </div>

        <!-- Summary Cards -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;
                    border:1px solid var(--border);border-top:none;border-radius:0;overflow:hidden">
          ${[
            {l:'Saldo Awal',  v:Utils.formatRupiah(saldoAwal),  c:'var(--primary-h)'},
            {l:'Confirmed',   v:Utils.formatRupiah(grandDone),  c:'var(--success)'},
            {l:'TBC / Pending',v:Utils.formatRupiah(grandTBC),  c:'var(--warning)'},
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
    // Kas masuk = rows type="Kas" dari _kas
    _kas.filter(r=>r.type==='Kas').forEach(r=>{mD[r.tgl]=(mD[r.tgl]||0)+(r.jumlah||0);});
    // Kas keluar = semua rows type≠"Kas" yang status DONE
    _kas.filter(r=>r.type!=='Kas'&&r.status==='DONE').forEach(r=>{kD[r.tgl]=(kD[r.tgl]||0)+r.jumlah;});
    const dates=[...new Set([...Object.keys(mD),...Object.keys(kD)])].sort();
    let bal=0;
    const rows=dates.map(tgl=>{const m=mD[tgl]||0,k=kD[tgl]||0;bal+=m-k;return{tgl,m,k,bal};});
    const tM=rows.reduce((s,r)=>s+r.m,0),tK=rows.reduce((s,r)=>s+r.k,0),net=tM-tK;
    document.getElementById('kas-tab-cashflow').innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-bottom:var(--s5)">
        ${[{l:'Kas Masuk',v:Utils.formatRupiah(tM),c:'var(--success)'},{l:'Kas Keluar',v:Utils.formatRupiah(tK),c:'var(--danger)'},{l:net>=0?'Surplus':'Defisit',v:Utils.formatRupiah(Math.abs(net)),c:net>=0?'var(--success)':'var(--danger)'}]
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
      // Kas masuk = kas rows type="Kas" (import Excel / entry manual di tabel utama)
      const totalMasuk  = _kas.filter(r=>r.type==='Kas').reduce((s,r) => s + (r.jumlah||0), 0);

      // Kas keluar = semua kas kecuali type="Kas"
      const totalKeluar = _kas.filter(r=>r.type!=='Kas').reduce((s,r) => s + (r.jumlah||0), 0);

      // Balance = Saldo Awal + Kas Masuk - Total Keluar
      const saldoAwal = _saldoAwal;
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
      // Simpan balance ke localStorage agar dashboard bisa mirror nilai ini secara langsung
      localStorage.setItem('becca_kas_balance', String(balance));

      // Inject Balance bar kanan atas
      const balanceBarEl = document.getElementById('kas-balance-bar');
      if (balanceBarEl) {
        const balColor = balance >= 0 ? 'var(--success)' : 'var(--danger)';
        const balLabel = balance >= 0 ? 'Surplus' : 'Defisit';
        balanceBarEl.innerHTML =
          '<span style="font-size:11px;color:var(--text-3)">Balance &nbsp;</span>'
          + '<span style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:'+balColor+'">'
          + Utils.formatRupiah(Math.abs(balance))+'</span>'
          + '&nbsp;<span style="font-size:11px;color:'+balColor+'">'+balLabel+'</span>';
      }
      // Inject Saldo Awal bar kiri atas (editable hanya Superadmin)
      const saldoBarEl = document.getElementById('kas-saldo-bar');
      if (saldoBarEl) {
        const sa = _saldoAwal;
        const canEditSaldo = Auth.isSuperAdmin();
        saldoBarEl.innerHTML =
          '<span style="color:var(--text-3);font-size:12px">Saldo Awal &nbsp;</span>'
          + '<span id="kas-saldo-val" style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:var(--primary-h);'
          + (canEditSaldo ? 'cursor:pointer;border-bottom:1px dashed rgba(99,102,241,.4);padding-bottom:1px' : '')
          + '"'
          + (canEditSaldo ? ' title="Klik untuk edit saldo awal" onclick="KasModule.editSaldoAwal()"' : '')
          + '>' + Utils.formatRupiah(sa) + '</span>'
          + (canEditSaldo ? ' <span style="font-size:10px;color:var(--text-3);cursor:pointer" onclick="KasModule.editSaldoAwal()" title="Edit">✎</span>' : '');
      }
      
      // Kas Masuk card sudah di _summaryStrip, container dipakai untuk info lain jika perlu
      container.innerHTML = '';
    } catch(e) {
      console.error('Balance cards error:', e);
    }
  }

  /* ===================== STATUS FILTER ===================== */
  function filterByStatus(status) {
    _activeTab = 'transaksi';
    document.querySelectorAll('.kas-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab==='transaksi'));
    document.querySelectorAll('[id^="kas-tab-"]').forEach(el => el.style.display = el.id==='kas-tab-transaksi' ? '' : 'none');
    _filter = { bulan:'', type:'', status, dateFrom:'', dateTo:'' };
    _page = 1;
    renderTransaksi();
  }

  /* ===================== KAS MASUK FILTER ===================== */
  function filterKasMasukType() {
    // Switch ke tab Transaksi dan filter by type=Kas
    _activeTab = 'transaksi';
    document.querySelectorAll('.kas-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab==='transaksi'));
    document.querySelectorAll('[id^="kas-tab-"]').forEach(el => el.style.display = el.id==='kas-tab-transaksi' ? '' : 'none');
    _filter = { bulan:'', type:'Kas', status:'', dateFrom:'', dateTo:'' };
    _page = 1;
    renderTransaksi();
    // Sync dropdown jika ada
    const typeEl = document.getElementById('kas-filter-type');
    if (typeEl) typeEl.value = 'Kas';
  }

  /* ===================== KAS MASUK MODAL ===================== */
  async function openKasMasukModal() {
    const masukData = await DB.getKasMasuk().catch(()=>[]);
    // Sort by date desc
    const sorted = [...masukData].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const mid = Utils.uid();
    
    function _renderMasukTable(rows) {
      if (!rows.length) return UI.empty({iconKey:'chart', title:'Tidak ada data pada periode ini'});
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
      tableEl.innerHTML = UI.empty({iconKey:'chart', title:'Tidak ada data pada periode ini'});
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
    if (!Auth.isSuperAdmin()) { Notify.error('Hanya Superadmin yang dapat mengubah Saldo Awal'); return; }
    const current = _saldoAwal;
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
  // Force-save current edit without validation (called by navigate() before page switch)
  function flushPendingEdit() {
    if (!_editingId) return;
    const id = _editingId;
    document.removeEventListener('click', _handleOutsideClick);
    _editingId = null;
    _doCommit(id, true); // skipValidation = true
  }

  /* ── FILL-DRAG CALLBACK (via GridSelect) ── */
  const _KAS_COL_MAP = ['','tgl','nama','type','vendor','qty','satuan','hargaSatuan','jumlah','penerima','status'];
  function _onGridFill(tblId, colIdx, srcRow, targetRows, val) {
    const tbl = document.getElementById(tblId);
    if (!tbl) return;
    const tbody = tbl.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.children);
    const key = _KAS_COL_MAP[colIdx];
    if (!key) return;
    const isNum = key==='qty'||key==='hargaSatuan'||key==='jumlah';
    let parsed = isNum ? parseFloat(String(val).replace(/[Rp\s\u00a0.]/g,'').replace(',','.'))||0 : val;
    // Konversi tanggal display (DD-MM-YYYY) → DB format (YYYY-MM-DD)
    if (key==='tgl' && /^\d{2}-\d{2}-\d{4}$/.test(parsed)) {
      const p = parsed.split('-'); parsed = p[2]+'-'+p[1]+'-'+p[0];
    }
    let saved = 0;
    targetRows.forEach(ri => {
      const tr = rows[ri];
      const id = tr?.dataset?.id;
      const row = id ? _kas.find(r=>r.id===id) : null;
      if (!row || _kasLocked.has(id)) return;
      row[key] = parsed;
      if (key==='qty'||key==='hargaSatuan') row.jumlah = (row.qty||0)*(row.hargaSatuan||0);
      DB.saveKas({...row}).catch(()=>{});
      saved++;
    });
    if (saved) { Notify.success(saved+' baris diperbarui'); renderTransaksi(); }
  }

  function _onGridPaste(tblId, startRow, startCol, pasteRows) {
    const tbl = document.getElementById(tblId);
    if (!tbl) return;
    const tbody = tbl.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.children);
    let saved = 0;
    pasteRows.forEach((cols, ri) => {
      const tr = rows[startRow + ri];
      const id = tr?.dataset?.id;
      const row = id ? _kas.find(r=>r.id===id) : null;
      if (!row || _kasLocked.has(id)) return;
      cols.forEach((val, ci) => {
        const key = _KAS_COL_MAP[startCol + ci];
        if (!key) return;
        const isNum = key==='qty'||key==='hargaSatuan'||key==='jumlah';
        let v = isNum ? parseFloat(String(val).replace(/[Rp\s\u00a0.]/g,'').replace(',','.'))||0 : val;
        if (key==='tgl' && /^\d{2}-\d{2}-\d{4}$/.test(v)) { const p=v.split('-'); v=p[2]+'-'+p[1]+'-'+p[0]; }
        row[key] = v;
      });
      row.jumlah = (row.qty||0)*(row.hargaSatuan||0);
      DB.saveKas({...row}).catch(()=>{});
      saved++;
    });
    if (saved) { Notify.success(saved+' baris di-paste'); renderTransaksi(); }
  }

  /* ===================== BELANJA PASAR DASHBOARD (inside transaksi) ===================== */
  let _bpDocs = [];
  let _bpLoaded = false;

  // Fetch fresh from DB (call on init + after confirm/delete, NOT on every renderTransaksi)
  async function _refreshBPData() {
    try { _bpDocs = await DB.getBelanjaPasar(); } catch { _bpDocs = []; }
    _bpLoaded = true;
    _updateBPBadge();
  }

  // Render cards from cached _bpDocs (sync, no DB call)
  function _renderBPDashboard() {
    const el = document.getElementById('kas-bp-dash');
    if (!el) return;
    if (!_bpLoaded) { _refreshBPData().then(() => _renderBPDashboard()); return; }
    const docs = _bpDocs.filter(d => d.status === 'selesai').sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    if (!docs.length) { el.innerHTML = ''; return; }

    const isAdmin = Auth.currentUser()?.role === 'superadmin' || Auth.currentUser()?.role === 'admin';
    const cards = docs.map(d => {
      const isConfirmed = d.kasStatus === 'confirmed';
      const itemCount = (d.kasItems||d.items||[]).filter(it=>it.item||it.totalQty).length;
      const statusColor = isConfirmed ? '#10b981' : '#f59e0b';
      const statusText = isConfirmed ? 'Terkonfirmasi' : 'Belum Konfirmasi';
      const statusBg = isConfirmed ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)';
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;
        border:1px solid ${isConfirmed?'rgba(16,185,129,.3)':'rgba(245,158,11,.3)'};
        border-radius:8px;background:${statusBg};min-width:90px;position:relative;cursor:pointer;transition:.15s"
        onclick="KasModule.openBPDetail('${d.id}')"
        onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
        <span style="font-size:9px;font-weight:700;color:var(--text-3)">🛒 ${d.periode||'-'}</span>
        <span style="font-size:9px;font-weight:700;color:${statusColor}">${statusText}</span>
        <span style="font-size:8px;color:var(--text-3)">${itemCount} items</span>
        ${isAdmin ? `<button onclick="event.stopPropagation();KasModule.deleteBPKas('${d.id}')" title="Hapus"
          style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:99px;border:none;background:#ef4444;color:#fff;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700">×</button>` : ''}
      </div>`;
    }).join('');

    const pendingCount = docs.filter(d => d.kasStatus !== 'confirmed').length;
    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid rgba(8,145,178,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#0891b2;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          🛒 Belanja Pasar
          ${pendingCount>0?`<span style="background:#f59e0b;color:#fff;font-size:9px;padding:1px 6px;border-radius:10px;font-weight:700">${pendingCount} belum konfirmasi</span>`:''}
        </div>
        <div style="display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">${cards}</div>
      </div>`;
  }

  async function openBPDetail(docId) {
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) return;
    const isConfirmed = doc.kasStatus === 'confirmed';
    const rp = n => n ? 'Rp '+Math.round(Number(n)).toLocaleString('id') : '-';

    // Init kasItems
    let items;
    if (doc.kasItems?.length) {
      const srcItems = (doc.items||[]).filter(it=>it.item);
      items = doc.kasItems.map(ki => {
        const src = srcItems.find(s => (s.item||'').toLowerCase().trim() === (ki.item||'').toLowerCase().trim());
        if (!ki.estHarga && src) ki.estHarga = src.harga||0;
        if (!ki.aktHarga && src) ki.aktHarga = src.harga||0;
        return ki;
      });
    } else {
      items = (doc.items||[]).filter(it=>it.item).map(it => ({
        item: it.item, satuan: it.satuan||'', estQty: it.totalQty||0, estHarga: it.harga||0,
        aktQty: it.totalQty||0, aktHarga: it.harga||0, aktTotal: (it.totalQty||0)*(it.harga||0)
      }));
    }
    const aktGrandTotal = items.reduce((s,it) => s+(Number(it.aktQty)||0)*(Number(it.aktHarga)||0), 0);

    const mid = 'bp-kas-'+Utils.uid();
    window._bpKasMid = mid;
    Modal.open({
      id: mid,
      title: '🛒 Belanja Pasar — '+doc.periode,
      size: 'modal-xl',
      body: `<style>.modal-xl{max-width:900px!important}</style>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <div><span style="font-size:11px;color:var(--text-3)">Oleh: ${doc.namaPetugas||'-'}</span>
            ${(doc.selectedForms||[]).length ? `<div style="font-size:9px;color:var(--text-3)">Form: ${(doc.selectedForms||[]).map(sf => sf.tanggal?.slice(5)+' '+({S1:'S1',S2:'S2&3'}[sf.shift]||sf.shift)).join(', ')}</div>` : ''}
          </div>
          ${isConfirmed ? `<span style="font-size:10px;background:rgba(16,185,129,.12);color:#10b981;padding:2px 8px;border-radius:10px;font-weight:700">✓ oleh ${doc.kasConfirmedBy||'-'}</span>` : ''}
        </div>
        <div style="overflow-x:auto;max-height:55vh;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:linear-gradient(135deg,#059669,#10b981);color:#fff">
            <th style="padding:8px 6px;font-size:9px;width:25px;font-weight:700">#</th>
            <th style="padding:8px 6px;font-size:9px;text-align:left;font-weight:700">ITEM</th>
            <th style="padding:8px 6px;font-size:9px;text-align:right;width:55px;font-weight:700;color:rgba(255,255,255,.6)">EST QTY</th>
            <th style="padding:8px 6px;font-size:9px;width:40px;font-weight:700;color:rgba(255,255,255,.6)">SAT</th>
            <th style="padding:8px 6px;font-size:9px;text-align:right;width:80px;font-weight:700;color:rgba(255,255,255,.6)">EST HARGA</th>
            <th style="padding:8px 6px;font-size:9px;text-align:right;width:70px;font-weight:700;color:#34d399">AKT QTY</th>
            <th style="padding:8px 6px;font-size:9px;text-align:right;width:95px;font-weight:700;color:#34d399">AKT HARGA</th>
            <th style="padding:8px 6px;font-size:9px;text-align:right;width:100px;font-weight:700;background:rgba(5,150,105,.3);color:#fff">TOTAL</th>
          </tr></thead><tbody>${items.map((it,i) => {
            const aktT = (Number(it.aktQty)||0)*(Number(it.aktHarga)||0);
            const estH = Number(it.estHarga)||Number(it.harga)||0;
            return `<tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(5,150,105,.03)':''}">
              <td style="padding:10px 6px;text-align:center;color:var(--text-3);font-size:10px">${i+1}</td>
              <td style="padding:10px 6px;font-weight:600">${it.item}</td>
              <td style="padding:10px 6px;text-align:right;font-family:var(--font-mono);color:#64748b;background:rgba(100,116,139,.04)">${it.estQty||'-'}</td>
              <td style="padding:10px 6px;color:#64748b;background:rgba(100,116,139,.04)">${it.satuan}</td>
              <td style="padding:10px 6px;text-align:right;font-family:var(--font-mono);color:#64748b;background:rgba(100,116,139,.04)">${estH?rp(estH):'-'}</td>
              <td style="padding:6px 4px;text-align:right">${isConfirmed
                ? `<span style="font-family:var(--font-mono);font-weight:600;color:#059669">${it.aktQty}</span>`
                : `<input type="number" min="0" step="0.5" value="${it.aktQty||0}" data-doc="${doc.id}" data-idx="${i}" data-field="aktQty"
                    onchange="KasModule._bpCellChange('${doc.id}',${i})"
                    style="width:65px;border:1px solid var(--border);border-radius:4px;padding:4px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)" onfocus="this.select()">`}</td>
              <td style="padding:6px 4px;text-align:right">${isConfirmed
                ? `<span style="font-family:var(--font-mono);font-weight:600">${rp(it.aktHarga)}</span>`
                : `<input type="text" value="${rp(it.aktHarga||0)}" data-doc="${doc.id}" data-idx="${i}" data-field="aktHarga"
                    onfocus="this.value=this.dataset.raw||${it.aktHarga||0};this.type='number';this.select()"
                    onblur="this.dataset.raw=this.value;this.type='text';this.value='Rp '+Number(this.dataset.raw||0).toLocaleString('id');KasModule._bpCellChange('${doc.id}',${i})"
                    style="width:90px;border:1px solid var(--border);border-radius:4px;padding:4px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)">`}</td>
              <td style="padding:10px 6px;text-align:right;font-family:var(--font-mono);font-weight:800;color:#059669;background:rgba(5,150,105,.06)" id="bp-kas-total-${doc.id}-${i}">${aktT?rp(aktT):'-'}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot><tr style="background:linear-gradient(135deg,#059669,#10b981);color:#fff">
            <td colspan="5"></td><td colspan="2" style="padding:10px;text-align:right;font-weight:800;font-size:13px">Grand Total</td>
            <td style="padding:10px;text-align:right;font-family:var(--font-mono);font-weight:900;font-size:15px" id="bp-kas-grand-${doc.id}">${rp(aktGrandTotal)}</td>
          </tr></tfoot></table>
        </div>`,
      footer: isConfirmed ? '' : `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
        <button class="btn btn-primary" onclick="KasModule.confirmBelanjaPasar('${doc.id}')" style="background:#059669;border-color:#059669">Konfirmasi</button>`,
    });
  }

  function _bpCellChange(docId, idx) {
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) return;
    if (!doc.kasItems?.length) {
      doc.kasItems = (doc.items||[]).filter(it=>it.item).map(it => ({
        item: it.item, satuan: it.satuan||'', estQty: it.totalQty||0, estHarga: it.harga||0, aktQty: it.totalQty||0, aktHarga: it.harga||0, aktTotal: (it.totalQty||0)*(it.harga||0)
      }));
    }
    const it = doc.kasItems[idx]; if (!it) return;
    const qtyInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${idx}"][data-field="aktQty"]`);
    const hrgInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${idx}"][data-field="aktHarga"]`);
    if (qtyInp) it.aktQty = parseFloat(qtyInp.value)||0;
    if (hrgInp) it.aktHarga = parseFloat(hrgInp.dataset.raw||(()=>{const s=hrgInp.value.replace(/[Rp\s]/g,'');return /^\d+\.\d{3}/.test(s)?s.replace(/\./g,''):s})()||0)||0;
    it.aktTotal = it.aktQty * it.aktHarga;
    const rp = n => n?'Rp '+Math.round(Number(n)).toLocaleString('id'):'-';
    const tEl = document.getElementById(`bp-kas-total-${docId}-${idx}`);
    if (tEl) tEl.textContent = rp(it.aktTotal);
    const gEl = document.getElementById(`bp-kas-grand-${docId}`);
    if (gEl) gEl.textContent = rp(doc.kasItems.reduce((s,i)=>s+(Number(i.aktQty)||0)*(Number(i.aktHarga)||0),0));
    DB.saveBelanjaPasar(doc).catch(()=>{});
  }

  async function confirmBelanjaPasar(docId) {
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) return;
    if (doc.kasStatus === 'confirmed') { Notify.info('Sudah dikonfirmasi'); return; }
    const cu = Auth.currentUser();
    const ok = await Modal.confirm({
      title: 'Konfirmasi Belanja Pasar',
      message: `<p>Data <strong>AKT QTY</strong> dan <strong>AKT Harga</strong> sudah benar?</p>
        <p style="margin-top:8px;color:#f59e0b;font-weight:600">⚠ Data akan masuk ke transaksi kas kecil dan diteruskan ke Inventory.</p>`,
      confirmText: 'Ya, Konfirmasi',
    });
    if (!ok) return;
    if (!doc.kasItems?.length) {
      doc.kasItems = (doc.items||[]).filter(it=>it.item).map(it => ({
        item: it.item, satuan: it.satuan||'', estQty: it.totalQty||0, estHarga: it.harga||0, aktQty: it.totalQty||0, aktHarga: it.harga||0, aktTotal: (it.totalQty||0)*(it.harga||0)
      }));
    }
    // Read latest DOM values
    doc.kasItems.forEach((it, i) => {
      const qtyInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${i}"][data-field="aktQty"]`);
      const hrgInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${i}"][data-field="aktHarga"]`);
      if (qtyInp) it.aktQty = parseFloat(qtyInp.value)||0;
      if (hrgInp) it.aktHarga = parseFloat(hrgInp.dataset.raw||(()=>{const s=hrgInp.value.replace(/[Rp\s]/g,'');return /^\d+\.\d{3}/.test(s)?s.replace(/\./g,''):s})()||0)||0;
      it.aktTotal = it.aktQty * it.aktHarga;
    });
    doc.kasStatus = 'confirmed';
    doc.kasConfirmedAt = new Date().toISOString();
    doc.kasConfirmedBy = cu?.nama || cu?.username || '-';
    try {
      await DB.saveBelanjaPasar(doc);
      // Auto-insert kas kecil rows for each item with aktQty > 0
      const today = new Date().toISOString().slice(0,10);
      let inserted = 0;
      for (const it of doc.kasItems) {
        if (!it.aktQty || !it.aktHarga) continue;
        const row = {
          tgl: today, nama: it.item, type: 'Belanja Pasar',
          vendor: 'Pasar', qty: it.aktQty, satuan: it.satuan||'',
          hargaSatuan: it.aktHarga, jumlah: it.aktTotal,
          penerima: doc.namaPetugas||'-', status: 'DONE',
          bpDocId: doc.id, // link back to belanja pasar
        };
        try { await DB.saveKas(row); _kas.unshift(row); inserted++; } catch {}
      }
      if (window._bpKasMid) Modal.close(window._bpKasMid);
      Notify.success(`Dikonfirmasi + ${inserted} item masuk kas kecil`);
      _renderBPDashboard();
      renderTransaksi();
      DB.logActivity({type:'confirm_belanja_pasar', detail:`Konfirmasi ${doc.periode}: ${inserted} item → kas kecil`});
    } catch(e) { Notify.error('Gagal: '+(e.message||'')); }
  }

  async function deleteBPKas(docId) {
    const role = Auth.currentUser()?.role;
    if (role !== 'superadmin' && role !== 'admin') { Notify.warning('Hanya Admin/Superadmin'); return; }
    if (!_bpDocs.length) { try { _bpDocs = await DB.getBelanjaPasar(); } catch {} }
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) { Notify.warning('Data tidak ditemukan'); return; }
    const linkedKas = _kas.filter(r => r.bpDocId === docId);
    const ok = await Modal.confirm({
      title: 'Hapus Belanja Pasar dari Kas',
      message: `<p>Hapus <strong>🛒 ${doc.periode||'-'}</strong> dari kas kecil?</p>
        ${linkedKas.length ? `<p style="margin-top:8px;color:#ef4444;font-weight:600">⚠ ${linkedKas.length} baris transaksi kas terkait juga akan dihapus.</p>` : ''}
        <p style="margin-top:8px">Card akan hilang dari kas. Form belanja pasar dikembalikan ke status draft di PO.</p>`,
      danger: true, confirmText: 'Hapus dari Kas',
    });
    if (!ok) return;
    // Delete linked kas rows
    for (const r of linkedKas) {
      try { await DB.deleteKas(r.id); _kas = _kas.filter(k=>k.id!==r.id); } catch {}
    }
    // Reset ALL status — return to draft so it disappears from kas dashboard
    doc.status = 'draft';
    doc.kasStatus = null; doc.kasConfirmedAt = null; doc.kasConfirmedBy = null; doc.kasItems = null;
    doc.invSyncStatus = null; doc.invSyncedAt = null; doc.invSyncedBy = null;
    try { await DB.saveBelanjaPasar(doc); } catch {}
    // Remove from local cache
    _bpDocs = _bpDocs.filter(d => d.id !== docId || d.status !== 'selesai');
    Notify.success('Belanja pasar dihapus dari kas');
    _renderBPDashboard();
    renderTransaksi();
    _updateBPBadge();
  }

  return { init, switchTab, setFilter, resetFilter, goPage, setPerPage, addRow, startEdit, commitEdit, commitAndAddRow, cancelEdit, _rowKeyDown, unlockKasRow, _onNamaInput, _selectNamaSuggestion, _calcTotal, deleteRow, _bulkToggle, _bulkToggleAll, _bulkDelete, _bulkClear, reArrange, renderSummary, renderMonthlyTable, importExcel, exportCSV, _renderBalanceCards, openKasMasukModal, _filterKasMasuk, filterKasMasukType, filterByStatus, editSaldoAwal, _saveSaldoAwalModal, flushPendingEdit, openBPDetail, confirmBelanjaPasar, _bpCellChange, deleteBPKas };
})();
window.KasModule = KasModule;
