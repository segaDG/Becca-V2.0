/* ============================================
   BECCA V2.0 — Order Module v3
   Fitur: inline edit, kelola kolom, cetak invoice,
          anti-duplikat, search partial re-render
============================================ */

const OrderModule = (() => {
  let _data     = [];
  let _cols     = [];
  let _invRecs  = [];
  let _search   = '';
  let _filterCustomer = '';
  let _filterDate     = '';

  const _defaultCols = [
    {key:'breakfast', label:'BF',    group:'s1', editable:true},
    {key:'shift1',    label:'S1',    group:'s1', editable:true},
    {key:'spare1',    label:'Sp1',   group:'s1', editable:true},
    {key:'ot1',       label:'OT1',   group:'s1', editable:true},
    {key:'snack1',    label:'Snk1',  group:'s1', editable:true},
    {key:'shift2',    label:'S2',    group:'s2', editable:true},
    {key:'spare2',    label:'Sp2',   group:'s2', editable:true},
    {key:'ot2',       label:'OT2',   group:'s2', editable:true},
    {key:'snack2',    label:'Snk2',  group:'s2', editable:true},
    {key:'shift3',    label:'S3',    group:'s3', editable:true},
    {key:'spare3',    label:'Sp3',   group:'s3', editable:true},
    {key:'ot3',       label:'OT3',   group:'s3', editable:true},
    {key:'snack3',    label:'Snk3',  group:'s3', editable:true},
    {key:'snackBerat',label:'SnkBrt',group:'sb', editable:true},
  ];

  const _groupMeta = {
    s1: {label:'SHIFT 1',     color:'#6366f1', bg:'rgba(99,102,241,.07)'},
    s2: {label:'SHIFT 2',     color:'#10b981', bg:'rgba(16,185,129,.06)'},
    s3: {label:'SHIFT 3',     color:'#f59e0b', bg:'rgba(245,158,11,.06)'},
    sb: {label:'SNACK BERAT', color:'#ec4899', bg:'rgba(236,72,153,.06)'},
    cx: {label:'CUSTOM',      color:'#8b5cf6', bg:'rgba(139,92,246,.06)'},
  };

  /* ─── HELPERS ─── */
  function _fmtDate(s) {
    if (!s) return '-';
    try { return new Date(s).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }
    catch(e) { return s; }
  }
  function _fmtTs(s) {
    if (!s) return '-';
    try {
      const [d,t] = (s||'').split(' ');
      return new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short'}) + (t ? ' '+t.slice(0,5) : '');
    } catch(e) { return s; }
  }
  function _c(v) {
    return (v && Number(v) > 0)
      ? `<span style="font-weight:600">${v}</span>`
      : `<span style="color:var(--border2)">-</span>`;
  }
  function _jenisBadge(cat) {
    if (!cat) return '';
    return cat.toLowerCase().includes('real')
      ? `<span style="font-size:9px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);padding:1px 6px;border-radius:10px;font-weight:700">REAL</span>`
      : `<span style="font-size:9px;background:rgba(99,102,241,.12);color:#6366f1;border:1px solid rgba(99,102,241,.25);padding:1px 6px;border-radius:10px;font-weight:700">EST</span>`;
  }
  function _invBadge(o) {
    if (!o.invoiced) return '';
    return `<span style="font-size:9px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);padding:1px 5px;border-radius:10px;font-weight:700" title="${o.invoiceRef||''}">✓INV</span>`;
  }
  function _save()    { localStorage.setItem('becca_orders', JSON.stringify(_data)); }
  function _saveCols(){ localStorage.setItem('becca_order_columns', JSON.stringify(_cols)); }
  function _saveInvs(){ localStorage.setItem('becca_order_invoices', JSON.stringify(_invRecs)); }
  function _getCustomers() {
    try { return JSON.parse(localStorage.getItem('becca_customers')||'[]'); }
    catch(e) { return []; }
  }
  function _custNames() {
    return [...new Set(_data.map(o=>o.namaPerusahaan).filter(Boolean))].sort();
  }

  /* ─── INIT ─── */
  async function init() {
    const page = document.getElementById('page-order');
    if (!page) return;
    try {
      const s = localStorage.getItem('becca_orders');
      _data = s ? JSON.parse(s) : [];
      const sc = localStorage.getItem('becca_order_columns');
      _cols = sc ? JSON.parse(sc) : JSON.parse(JSON.stringify(_defaultCols));
      const si = localStorage.getItem('becca_order_invoices');
      _invRecs = si ? JSON.parse(si) : [];
      if (!_cols.length) _cols = JSON.parse(JSON.stringify(_defaultCols));
    } catch(e) { _cols = JSON.parse(JSON.stringify(_defaultCols)); _invRecs = []; }
    _renderFull(page);
  }

  /* ─── FULL RENDER ─── */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-order');
    if (!page) return;

    const cust = _getCustomers();
    const cn   = _custNames();
    const totalReal = _data.filter(o=>(o.catatan||'').toLowerCase().includes('real')).length;
    const totalInv  = _data.filter(o=>o.invoiced).length;

    page.innerHTML = `
    <style>
      .ord-th { padding:9px 8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;white-space:nowrap;text-align:center;border-right:1px solid rgba(255,255,255,.06) }
      .ord-td { padding:7px 6px;border-bottom:1px solid var(--border);font-size:11px;text-align:center;vertical-align:middle }
      .ord-cell { cursor:pointer;min-width:28px;border-radius:3px;display:inline-block;width:100% }
      .ord-cell:hover { background:rgba(99,102,241,.18)!important }
      .hdr-wrap { display:inline-flex;align-items:center;gap:3px }
      .hdr-wrap:hover .hdr-btn { opacity:1 }
      .hdr-btn { opacity:0;font-size:9px;background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:3px;padding:1px 4px;cursor:pointer;transition:.1s }
    </style>

    <div class="page-header">
      <div class="page-header-left">
        <h2>Data Orderan Catering</h2>
        <p>Rekapitulasi order masuk — 16 s/d 22 Maret 2026 · ${_data.length} record</p>
      </div>
      <div class="page-header-right" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="OrderModule.openInvoiceModal()"
          style="background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.35);font-size:12px">
          🧾 Cetak Invoice
        </button>
        <button class="btn btn-ghost" onclick="OrderModule.openColManager()" style="font-size:12px">
          ⚙ Kelola Kolom
        </button>
        <button class="btn btn-primary" onclick="OrderModule.openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          Tambah Order
        </button>
      </div>
    </div>

    <!-- STAT CARDS -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px">
      ${[
        {l:'Total Order',    v:_data.length,                                   c:'#6366f1', s:'entri'},
        {l:'Real Order',     v:totalReal,                                       c:'#10b981', s:'terkonfirmasi'},
        {l:'Estimasi',       v:_data.length-totalReal,                          c:'#f59e0b', s:'perkiraan'},
        {l:'Customer',       v:[...new Set(_data.map(o=>o.namaPerusahaan))].length, c:'#ec4899', s:'perusahaan'},
        {l:'Sudah Invoice',  v:totalInv,                                        c:'#10b981', s:'order'},
      ].map(s=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${s.c}"></div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:3px">${s.l}</div>
        <div style="font-size:20px;font-weight:900;color:${s.c};font-family:var(--font-mono)">${s.v} <span style="font-size:11px;font-weight:400;color:var(--text-3)">${s.s}</span></div>
      </div>`).join('')}
    </div>

    <!-- TABLE CARD -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <!-- TOOLBAR — tidak di-re-render saat search -->
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="position:relative;flex:1;max-width:250px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"
            style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-3)">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input id="ord-search" placeholder="Cari customer / pelapor..." value="${_search}"
            style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
            oninput="OrderModule.setSearch(this.value)">
        </div>
        <select id="ord-fcust" onchange="OrderModule.setFilterCustomer(this.value)"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);cursor:pointer;max-width:180px">
          <option value="">Semua Customer</option>
          ${cn.map(n=>`<option value="${n}" ${_filterCustomer===n?'selected':''}>${n}</option>`).join('')}
        </select>
        <input id="ord-fdate" type="date" value="${_filterDate}" onchange="OrderModule.setFilterDate(this.value)"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);cursor:pointer">
        <span id="ord-count" style="font-size:11px;color:var(--text-3);margin-left:auto"></span>
      </div>

      <!-- TABLE -->
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table id="ord-table" style="width:100%;border-collapse:collapse;font-size:11px">
          <thead id="ord-thead"></thead>
          <tbody id="ord-tbody"></tbody>
        </table>
      </div>
    </div>`;

    _renderThead();
    _renderTbody();
  }

  /* ─── THEAD ─── */
  function _renderThead() {
    const thead = document.getElementById('ord-thead');
    if (!thead) return;

    // Count per group
    const gc = {};
    _cols.forEach(c => { const g = c.group||'cx'; gc[g] = (gc[g]||0) + 1; });

    let grp = `<tr style="background:#1e1e2e">
      <th colspan="5" class="ord-th" style="background:#1e1e2e;text-align:center;font-size:9px;color:#9ca3af;letter-spacing:.1em">INPUT & ORDER</th>`;
    Object.entries(gc).forEach(([g,cnt]) => {
      const m = _groupMeta[g] || _groupMeta.cx;
      grp += `<th colspan="${cnt}" class="ord-th" style="background:#1e1e2e;color:${m.color};font-size:9px;letter-spacing:.1em">${m.label}</th>`;
    });
    grp += `<th colspan="2" class="ord-th" style="background:#1e1e2e;font-size:9px;color:#9ca3af;letter-spacing:.1em">INFO</th></tr>`;

    let col = `<tr style="background:var(--primary-h)">
      <th class="ord-th" style="width:32px">#</th>
      <th class="ord-th" style="text-align:left;min-width:110px">Timestamp</th>
      <th class="ord-th" style="text-align:left;min-width:110px">Pelapor</th>
      <th class="ord-th" style="min-width:90px">Tgl Order</th>
      <th class="ord-th" style="text-align:left;min-width:140px">Customer</th>`;

    _cols.forEach((c, ci) => {
      const m = _groupMeta[c.group||'cx'] || _groupMeta.cx;
      col += `<th class="ord-th" style="background:${m.bg};border-left:1px solid rgba(255,255,255,.06);cursor:pointer" onclick="OrderModule.editHeader(${ci})">
        <div class="hdr-wrap">
          <span>${c.label}</span>
          <span class="hdr-btn" title="Edit nama kolom">✎</span>
        </div>
      </th>`;
    });
    col += `<th class="ord-th">Jenis</th><th class="ord-th">Aksi</th></tr>`;

    thead.innerHTML = grp + col;
  }

  /* ─── TBODY ─── */
  function _renderTbody() {
    let list = [..._data].sort((a,b) => {
      const dc = (b.tglOrder||'').localeCompare(a.tglOrder||'');
      return dc !== 0 ? dc : (b.timestamp||'').localeCompare(a.timestamp||'');
    });
    if (_search) {
      const q = _search.toLowerCase();
      list = list.filter(o =>
        (o.namaPerusahaan||'').toLowerCase().includes(q) ||
        (o.pelapor||'').toLowerCase().includes(q));
    }
    if (_filterCustomer) list = list.filter(o => o.namaPerusahaan === _filterCustomer);
    if (_filterDate)     list = list.filter(o => o.tglOrder === _filterDate);

    const ct = document.getElementById('ord-count');
    if (ct) ct.textContent = list.length + ' order';

    const tbody = document.getElementById('ord-tbody');
    if (!tbody) { _renderFull(); return; }

    if (!list.length) {
      const span = 5 + _cols.length + 2;
      tbody.innerHTML = `<tr><td colspan="${span}" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data order.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((o, i) => {
      const bg  = i%2===0 ? 'var(--surface)' : 'var(--surface2)';
      const hov = o.invoiced ? 'rgba(16,185,129,.05)' : 'rgba(99,102,241,.07)';
      const oid = o.id;

      const cells = _cols.map(col => {
        const m   = _groupMeta[col.group||'cx'] || _groupMeta.cx;
        const val = o._custom ? (o._custom[col.key] !== undefined ? o._custom[col.key] : o[col.key]) : o[col.key];
        return `<td class="ord-td" style="background:${m.bg}">
          <div class="ord-cell" ondblclick="OrderModule.startEdit('${oid}','${col.key}',this)"
            title="Double-klik untuk edit">${_c(val)}</div>
        </td>`;
      }).join('');

      return `<tr data-id="${oid}"
        onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='${hov}'})"
        onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"
        style="border-bottom:1px solid var(--border)${o.invoiced?';opacity:.72':''}">
        <td class="ord-td" style="font-size:10px;color:var(--text-3);background:${bg}">${i+1}</td>
        <td class="ord-td" style="text-align:left;font-size:10px;font-family:var(--font-mono);color:var(--text-2);background:${bg};white-space:nowrap">${_fmtTs(o.timestamp)}</td>
        <td class="ord-td" style="text-align:left;font-size:10px;color:var(--text-2);background:${bg};white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">${o.pelapor||'-'}</td>
        <td class="ord-td" style="font-weight:600;font-size:10px;background:${bg};white-space:nowrap">${_fmtDate(o.tglOrder)}</td>
        <td class="ord-td" style="text-align:left;font-weight:600;background:${bg}">
          <div class="ord-cell" ondblclick="OrderModule.startEdit('${oid}','namaPerusahaan',this)" title="Double-klik untuk edit">${o.namaPerusahaan||'-'}</div>
        </td>
        ${cells}
        <td class="ord-td" style="background:${bg}">${_jenisBadge(o.catatan)} ${_invBadge(o)}</td>
        <td class="ord-td" style="background:${bg}">
          <button onclick="OrderModule.deleteOrder('${oid}')"
            style="width:24px;height:24px;border-radius:4px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);cursor:pointer;color:#ef4444;font-size:11px" title="Hapus">✕</button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ─── INLINE EDIT (double-click) ─── */
  function startEdit(ordId, key, cell) {
    const ord = _data.find(o => o.id === ordId);
    if (!ord) return;
    if (ord.invoiced) { Notify.warning('Order sudah di-invoice, tidak bisa diedit'); return; }

    const col   = _cols.find(c => c.key === key);
    const isNum = col ? col.editable : false;
    const cur   = key === 'namaPerusahaan' ? (ord[key]||'') :
                  (col && col.custom) ? ((ord._custom||{})[key]||0) : (ord[key]||0);
    const orig  = cell.innerHTML;

    const commit = (val) => {
      let v = isNum ? (parseInt(val)||0) : String(val).trim();
      if (col && col.custom) { if(!ord._custom) ord._custom={}; ord._custom[key]=v; }
      else { ord[key] = v; }
      _save();
      cell.innerHTML = isNum ? _c(v) : (v||'-');
      cell.ondblclick = () => startEdit(ordId, key, cell);
    };

    if (key === 'namaPerusahaan') {
      const custs = _getCustomers();
      if (custs.length) {
        cell.innerHTML = `<select style="width:100%;border:2px solid #6366f1;border-radius:3px;background:var(--surface);color:var(--text);font-size:11px;outline:none">
          ${custs.map(c=>`<option value="${c.nama}" ${c.nama===cur?'selected':''}>${c.nama}</option>`).join('')}
        </select>`;
        const sel = cell.querySelector('select');
        sel.focus();
        sel.onblur = () => { commit(sel.value); };
        sel.onkeydown = (e) => { if(e.key==='Enter') sel.blur(); if(e.key==='Escape'){cell.innerHTML=orig;cell.ondblclick=()=>startEdit(ordId,key,cell);} };
        return;
      }
    }

    cell.innerHTML = `<input type="${isNum?'number':'text'}" value="${cur}" min="0"
      style="width:100%;border:2px solid #6366f1;border-radius:3px;background:var(--surface);color:var(--text);font-size:11px;font-weight:600;text-align:${isNum?'center':'left'};padding:2px 4px;outline:none;box-sizing:border-box">`;
    const inp = cell.querySelector('input');
    inp.focus(); inp.select();
    inp.onblur   = () => commit(inp.value);
    inp.onkeydown = (e) => {
      if (e.key === 'Enter')  inp.blur();
      if (e.key === 'Escape') { cell.innerHTML = orig; cell.ondblclick = () => startEdit(ordId, key, cell); }
    };
  }

  /* ─── EDIT HEADER (click on column header) ─── */
  function editHeader(ci) {
    const col = _cols[ci];
    if (!col) return;
    Modal.open({
      title: 'Edit Nama Kolom',
      body: `
        <div class="form-group">
          <label class="form-label">Label Kolom <span style="font-size:10px;color:var(--text-3)">(maks 10 karakter)</span></label>
          <input class="form-control" id="hl-label" value="${col.label}" maxlength="10" style="font-size:14px;font-weight:700">
        </div>
        <div class="form-group" style="margin-top:10px">
          <label class="form-label">Grup / Warna</label>
          <select class="form-control" id="hl-group">
            ${Object.entries(_groupMeta).map(([k,v])=>`<option value="${k}" ${col.group===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>`,
      buttons: [
        {label:'Batal', class:'btn-ghost', onclick:'Modal.close()'},
        {label:'Simpan', class:'btn-primary', onclick:`OrderModule._saveHdr(${ci})`}
      ]
    });
  }
  function _saveHdr(ci) {
    const lbl = (document.getElementById('hl-label')?.value||'').trim();
    const grp = document.getElementById('hl-group')?.value;
    if (!lbl) { Notify.warning('Label tidak boleh kosong'); return; }
    _cols[ci].label = lbl; _cols[ci].group = grp;
    _saveCols(); Modal.close(); _renderThead(); _renderTbody();
    Notify.success('Nama kolom diperbarui');
  }

  /* ─── KELOLA KOLOM ─── */
  function openColManager() {
    Modal.open({
      title: '⚙ Kelola Kolom',
      size: 'modal-lg',
      body: `
        <p style="font-size:12px;color:var(--text-3);margin-bottom:10px">Klik header kolom di tabel untuk rename cepat. Di sini bisa rename, ubah grup, atau hapus kolom.</p>
        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr style="background:var(--primary-h)">
              <th style="padding:7px 10px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Key</th>
              <th style="padding:7px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Label</th>
              <th style="padding:7px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Grup</th>
              <th style="padding:7px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Editable</th>
              <th style="padding:7px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Hapus</th>
            </tr></thead>
            <tbody>
            ${_cols.map((c,i)=>`
              <tr style="border-bottom:1px solid var(--border);background:${i%2===0?'var(--surface)':'var(--surface2)'}">
                <td style="padding:6px 10px;font-family:var(--font-mono);font-size:10px;color:var(--text-3)">${c.key}</td>
                <td style="padding:5px 8px">
                  <input value="${c.label}" maxlength="10"
                    style="width:80px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);font-size:12px;color:var(--text);font-weight:600"
                    onchange="OrderModule._setColLabel(${i},this.value)">
                </td>
                <td style="padding:5px 8px">
                  <select onchange="OrderModule._setColGroup(${i},this.value)"
                    style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);font-size:11px;color:var(--text)">
                    ${Object.entries(_groupMeta).map(([k,v])=>`<option value="${k}" ${c.group===k?'selected':''}>${v.label}</option>`).join('')}
                  </select>
                </td>
                <td style="padding:5px 8px;text-align:center">
                  <input type="checkbox" ${c.editable?'checked':''} onchange="OrderModule._setColEditable(${i},this.checked)">
                </td>
                <td style="padding:5px 8px;text-align:center">
                  <button onclick="OrderModule._removeCol(${i})"
                    style="padding:3px 8px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);border-radius:5px;color:#ef4444;cursor:pointer;font-size:11px">Hapus</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div style="padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
          <div style="font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:8px">+ Tambah Kolom Baru</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <div>
              <div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Key (huruf kecil)</div>
              <input id="nc-key" placeholder="contoh: extra1" style="width:120px;padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;color:var(--text)">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Label (maks 10)</div>
              <input id="nc-label" placeholder="Xtra1" maxlength="10" style="width:90px;padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;color:var(--text)">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Grup</div>
              <select id="nc-group" style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;color:var(--text)">
                ${Object.entries(_groupMeta).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
              </select>
            </div>
            <button onclick="OrderModule._addCol()"
              style="padding:6px 14px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">+ Tambah</button>
          </div>
        </div>`,
      buttons: [
        {label:'Tutup', class:'btn-ghost', onclick:'Modal.close()'},
        {label:'Reset Default', class:'btn-secondary', onclick:'OrderModule._resetCols()'},
      ]
    });
  }

  function _setColLabel(i, v)    { if(v.trim()){_cols[i].label=v.trim();_saveCols();_renderThead();} }
  function _setColGroup(i, v)    { _cols[i].group=v;_saveCols();_renderThead(); }
  function _setColEditable(i, v) { _cols[i].editable=v;_saveCols(); }
  function _removeCol(i) {
    if(!confirm(`Hapus kolom "${_cols[i].label}"?`)) return;
    _cols.splice(i,1); _saveCols(); Modal.close(); _renderFull(); Notify.success('Kolom dihapus');
  }
  function _addCol() {
    let key   = (document.getElementById('nc-key')?.value||'').trim().replace(/\s+/g,'_').toLowerCase();
    const lbl = (document.getElementById('nc-label')?.value||'').trim();
    const grp = document.getElementById('nc-group')?.value || 'cx';
    if (!key||!lbl) { Notify.warning('Key dan label wajib diisi'); return; }
    if (_cols.find(c=>c.key===key)) { Notify.warning('Key sudah ada, gunakan key lain'); return; }
    _cols.push({key,label:lbl,group:grp,editable:true,custom:true});
    _saveCols(); Modal.close(); _renderFull(); Notify.success(`Kolom "${lbl}" ditambahkan`);
  }
  function _resetCols() {
    if(!confirm('Reset semua kolom ke default?')) return;
    _cols = JSON.parse(JSON.stringify(_defaultCols));
    _saveCols(); Modal.close(); _renderFull(); Notify.success('Kolom direset');
  }

  /* ─── DELETE ─── */
  function deleteOrder(id) {
    const o = _data.find(x=>x.id===id);
    if (!o) return;
    if (o.invoiced) { Notify.warning('Order sudah di-invoice, tidak bisa dihapus'); return; }
    if (!confirm(`Hapus order ${o.namaPerusahaan} (${o.tglOrder})?`)) return;
    _data = _data.filter(x=>x.id!==id); _save(); _renderTbody(); Notify.success('Order dihapus');
  }

  /* ─── TAMBAH ORDER (modal) ─── */
  function openModal() {
    const custs = _getCustomers();
    const co    = custs.map(c=>`<option value="${c.nama}">${c.nama}</option>`).join('');
    const today = new Date().toISOString().slice(0,10);
    const nf = (id, lbl, color='var(--text-2)') =>
      `<div class="form-group"><label class="form-label" style="color:${color}">${lbl}</label><input class="form-control" id="${id}" type="number" min="0" value="0" style="text-align:center;font-family:var(--font-mono)"></div>`;

    Modal.open({
      title: 'Tambah Order Catering',
      size: 'modal-lg',
      body: `
        <style>.of-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);padding:8px 0 4px;border-top:1px solid var(--border);margin-top:6px}</style>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
          <div class="form-group"><label class="form-label">Tanggal Order *</label><input class="form-control" id="of-tgl" type="date" value="${today}"></div>
          <div class="form-group"><label class="form-label">Jenis Orderan</label>
            <select class="form-control" id="of-jenis"><option value="real orderan">Real Orderan</option><option value="estimasi orderan">Estimasi Orderan</option></select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:var(--s3)">
          <div class="form-group"><label class="form-label">Nama Perusahaan *</label>
            <select class="form-control" id="of-cust"><option value="">— Pilih Customer —</option>${co}</select>
          </div>
          <div class="form-group"><label class="form-label">Pelapor</label><input class="form-control" id="of-pelapor" placeholder="Nama..."></div>
        </div>
        <div class="of-sec" style="color:#6366f1">☀ Breakfast & Shift 1</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
          ${nf('of-bf','Breakfast','var(--warning)')}${nf('of-s1','Shift 1','#6366f1')}${nf('of-sp1','Spare 1','#6366f1')}${nf('of-ot1','OT 1','#6366f1')}${nf('of-snk1','Snack 1','#6366f1')}
        </div>
        <div class="of-sec" style="color:#10b981">🟢 Shift 2</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${nf('of-s2','Shift 2','#10b981')}${nf('of-sp2','Spare 2','#10b981')}${nf('of-ot2','OT 2','#10b981')}${nf('of-snk2','Snack 2','#10b981')}
        </div>
        <div class="of-sec" style="color:#f59e0b">🟡 Shift 3</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${nf('of-s3','Shift 3','#f59e0b')}${nf('of-sp3','Spare 3','#f59e0b')}${nf('of-ot3','OT 3','#f59e0b')}${nf('of-snk3','Snack 3','#f59e0b')}
        </div>
        <div class="of-sec" style="color:#ec4899">🍱 Snack Berat</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${nf('of-snkb','Snack Berat','#ec4899')}
        </div>`,
      buttons: [
        {label:'Batal', class:'btn-ghost', onclick:'Modal.close()'},
        {label:'Simpan Order', class:'btn-primary', onclick:'OrderModule._submitOrder()'}
      ]
    });
  }
  function _submitOrder() {
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const n = id => parseInt(document.getElementById(id)?.value)||0;
    const tgl = g('of-tgl'), cust = g('of-cust');
    if (!tgl)  { Notify.warning('Tanggal order wajib diisi'); return; }
    if (!cust) { Notify.warning('Pilih nama perusahaan'); return; }
    const now  = new Date();
    const ts   = now.toISOString().slice(0,10)+' '+now.toTimeString().slice(0,8);
    const user = (typeof Auth!=='undefined'&&Auth.user)?(Auth.user.name||Auth.user.username||''):'';
    _data.push({
      id:'ord_'+Date.now(), timestamp:ts, pelapor:g('of-pelapor')||user,
      tglOrder:tgl, namaPerusahaan:cust, catatan:g('of-jenis'),
      breakfast:n('of-bf'),
      shift1:n('of-s1'),spare1:n('of-sp1'),ot1:n('of-ot1'),snack1:n('of-snk1'),
      shift2:n('of-s2'),spare2:n('of-sp2'),ot2:n('of-ot2'),snack2:n('of-snk2'),
      shift3:n('of-s3'),spare3:n('of-sp3'),ot3:n('of-ot3'),snack3:n('of-snk3'),
      snackBerat:n('of-snkb'),
    });
    _save(); Modal.close(); Notify.success('Order berhasil ditambahkan'); _renderFull();
  }

  /* ══════════════════════════════════════════
     🧾 CETAK INVOICE
  ══════════════════════════════════════════ */
  function openInvoiceModal() {
    const custAvail = [...new Set(_data.filter(o=>!o.invoiced).map(o=>o.namaPerusahaan).filter(Boolean))].sort();
    if (!custAvail.length) { Notify.warning('Tidak ada order yang belum di-invoice'); return; }

    const today = new Date().toISOString().slice(0,10);
    const invNo = _genInvNo();

    Modal.open({
      title: '🧾 Cetak Invoice Orderan',
      size: 'modal-xl',
      body: `
        <style>.modal-xl{max-width:900px!important}</style>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--s3)">
          <div class="form-group">
            <label class="form-label">Nama Perusahaan *</label>
            <select class="form-control" id="ic-cust" onchange="OrderModule._previewInv()">
              <option value="">— Pilih Customer —</option>
              ${custAvail.map(n=>`<option value="${n}">${n}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Dari Tanggal</label>
            <input class="form-control" type="date" id="ic-dari" value="" onchange="OrderModule._previewInv()">
          </div>
          <div class="form-group">
            <label class="form-label">Sampai Tanggal</label>
            <input class="form-control" type="date" id="ic-sampai" value="${today}" onchange="OrderModule._previewInv()">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Nomor Invoice</label>
          <input class="form-control" id="ic-nomor" value="${invNo}" placeholder="INV/2026/03/001">
        </div>
        <div id="ic-preview" style="margin-top:12px;border:1px solid var(--border);border-radius:8px;padding:20px;min-height:80px;background:var(--surface2);color:var(--text-3);text-align:center">
          Pilih customer dan periode untuk melihat preview
        </div>`,
      buttons: [
        {label:'Batal', class:'btn-ghost', onclick:'Modal.close()'},
        {label:'🖨 Cetak Invoice', class:'btn-primary', onclick:'OrderModule._printInvoice()'}
      ]
    });
  }

  function _genInvNo() {
    const d = new Date();
    return `INV/${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(_invRecs.length+1).padStart(3,'0')}`;
  }

  function _previewInv() {
    const cust   = document.getElementById('ic-cust')?.value;
    const dari   = document.getElementById('ic-dari')?.value;
    const sampai = document.getElementById('ic-sampai')?.value;
    const area   = document.getElementById('ic-preview');
    if (!area) return;

    if (!cust) {
      area.innerHTML = '<div style="color:var(--text-3);text-align:center;padding:20px">Pilih customer terlebih dahulu</div>';
      return;
    }

    let list = _data.filter(o => o.namaPerusahaan===cust && !o.invoiced);
    if (dari)   list = list.filter(o => o.tglOrder >= dari);
    if (sampai) list = list.filter(o => o.tglOrder <= sampai);
    list.sort((a,b) => a.tglOrder.localeCompare(b.tglOrder));

    if (!list.length) {
      area.innerHTML = '<div style="color:#f59e0b;text-align:center;padding:20px">⚠ Tidak ada order yang belum di-invoice untuk filter ini</div>';
      return;
    }

    const tots = {};
    _cols.forEach(c => { tots[c.key] = list.reduce((s,o)=>s+(Number(o[c.key])||0),0); });

    area.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <strong style="font-size:12px;color:var(--text)">${list.length} order — <span style="color:#6366f1">${cust}</span></strong>
        <span style="font-size:11px;color:var(--text-3)">${dari?_fmtDate(dari):'--'} s/d ${sampai?_fmtDate(sampai):'--'}</span>
      </div>
      <div style="overflow-x:auto;border-radius:6px;border:1px solid var(--border)">
        <table style="width:100%;border-collapse:collapse;font-size:10px">
          <thead>
            <tr style="background:var(--primary-h)">
              <th style="padding:6px 8px;color:#fff;font-weight:700;text-align:left">Tgl Order</th>
              ${_cols.map(c=>`<th style="padding:6px 5px;color:#fff;font-weight:700;text-align:center">${c.label}</th>`).join('')}
              <th style="padding:6px 8px;color:#fff;font-weight:700;text-align:center">Jenis</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((o,i)=>`
              <tr style="background:${i%2===0?'var(--surface)':'var(--surface2)'};border-bottom:1px solid var(--border)">
                <td style="padding:5px 8px;font-weight:600">${_fmtDate(o.tglOrder)}</td>
                ${_cols.map(c=>`<td style="padding:5px;text-align:center">${(o[c.key]||0)>0?`<b>${o[c.key]}</b>`:'<span style="color:var(--border2)">-</span>'}</td>`).join('')}
                <td style="padding:5px 8px;text-align:center">${_jenisBadge(o.catatan)}</td>
              </tr>`).join('')}
            <tr style="background:rgba(99,102,241,.1);border-top:2px solid var(--border);font-weight:700">
              <td style="padding:6px 8px;color:#6366f1">TOTAL (${list.length})</td>
              ${_cols.map(c=>`<td style="padding:6px 5px;text-align:center;color:${tots[c.key]>0?'#6366f1':'var(--text-3)'}">${tots[c.key]||'-'}</td>`).join('')}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  function _printInvoice() {
    const cust   = document.getElementById('ic-cust')?.value;
    const dari   = document.getElementById('ic-dari')?.value;
    const sampai = document.getElementById('ic-sampai')?.value;
    const nomor  = (document.getElementById('ic-nomor')?.value||'').trim();
    if (!cust)  { Notify.warning('Pilih nama perusahaan'); return; }
    if (!nomor) { Notify.warning('Nomor invoice wajib diisi'); return; }

    let list = _data.filter(o => o.namaPerusahaan===cust && !o.invoiced);
    if (dari)   list = list.filter(o => o.tglOrder >= dari);
    if (sampai) list = list.filter(o => o.tglOrder <= sampai);
    list.sort((a,b) => a.tglOrder.localeCompare(b.tglOrder));

    if (!list.length) { Notify.warning('Tidak ada order untuk di-invoice'); return; }

    // Tandai semua sebagai invoiced
    const invDate = new Date().toISOString().slice(0,10);
    const ids = list.map(o=>o.id);
    _data.forEach(o => {
      if (ids.includes(o.id)) { o.invoiced=true; o.invoiceRef=nomor; o.invoiceDate=invDate; }
    });
    _save();

    // Simpan record invoice
    const tots = {};
    _cols.forEach(c => { tots[c.key] = list.reduce((s,o)=>s+(Number(o[c.key])||0),0); });
    _invRecs.push({nomor, customer:cust, dari, sampai, invoiceDate:invDate, orderCount:list.length, orderIds:ids, totals:tots});
    _saveInvs();

    Modal.close();
    Notify.success(`Invoice ${nomor} berhasil — ${list.length} order ditandai`);
    _renderFull();

    // Buka print window
    _openPrintWin(nomor, cust, dari, sampai, list, tots);
  }

  function _openPrintWin(nomor, cust, dari, sampai, list, tots) {
    const now = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Invoice ${nomor}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a1a2e;padding:28px;max-width:900px;margin:0 auto}
  .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:16px;border-bottom:3px solid #6366f1}
  .co{font-size:20px;font-weight:900;color:#6366f1}.co-sub{font-size:11px;color:#666;margin-top:3px}
  .inv-n{font-size:17px;font-weight:800}.inv-d{font-size:11px;color:#666;margin-top:3px;text-align:right}
  .to{background:#f0f0ff;border-left:4px solid #6366f1;padding:10px 14px;margin-bottom:18px;border-radius:0 6px 6px 0}
  .to-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#888;font-weight:700}
  .to-name{font-size:15px;font-weight:700;margin-top:2px}.to-per{font-size:11px;color:#666;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:18px}
  thead tr{background:#6366f1;color:#fff}
  th{padding:7px 6px;font-size:10px;font-weight:700;text-transform:uppercase;text-align:center}
  th:first-child{text-align:left;padding-left:12px}
  td{padding:6px;border-bottom:1px solid #e8e8f0;text-align:center}
  td:first-child{text-align:left;padding-left:12px;font-weight:600}
  tr:nth-child(even) td{background:#f9f9ff}
  .tot-row td{background:#ededff;font-weight:700;color:#6366f1;border-top:2px solid #6366f1}
  .badge-r{font-size:8px;background:#d1fae5;color:#065f46;padding:1px 5px;border-radius:8px;font-weight:700}
  .badge-e{font-size:8px;background:#ede9fe;color:#5b21b6;padding:1px 5px;border-radius:8px;font-weight:700}
  .sign{display:flex;justify-content:flex-end;margin-top:24px}
  .sign-box{width:180px;text-align:center}
  .sign-line{border-top:1px solid #333;margin-top:52px;padding-top:4px;font-size:10px}
  .print-btn{position:fixed;top:16px;right:16px;padding:9px 22px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(99,102,241,.4)}
  @media print{.print-btn{display:none!important}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
<div class="top">
  <div>
    <div class="co">BOGA PANGAN SENTOSA</div>
    <div class="co-sub">Industrial Catering Service — Karawang, Jawa Barat</div>
  </div>
  <div>
    <div class="inv-n">Invoice #${nomor}</div>
    <div class="inv-d">Dicetak: ${now}</div>
  </div>
</div>
<div class="to">
  <div class="to-lbl">Tagihan Kepada</div>
  <div class="to-name">${cust}</div>
  <div class="to-per">Periode: ${dari?_fmtDate(dari):'--'} s/d ${sampai?_fmtDate(sampai):'--'}</div>
</div>
<table>
  <thead><tr>
    <th>Tgl Order</th>
    ${_cols.map(c=>`<th>${c.label}</th>`).join('')}
    <th>Jenis</th>
  </tr></thead>
  <tbody>
    ${list.map(o=>`<tr>
      <td>${_fmtDate(o.tglOrder)}</td>
      ${_cols.map(c=>`<td>${(o[c.key]||0)>0?`<b>${o[c.key]}</b>`:'-'}</td>`).join('')}
      <td>${(o.catatan||'').includes('real')?'<span class="badge-r">REAL</span>':'<span class="badge-e">EST</span>'}</td>
    </tr>`).join('')}
    <tr class="tot-row">
      <td>TOTAL (${list.length} order)</td>
      ${_cols.map(c=>`<td>${tots[c.key]||0}</td>`).join('')}
      <td></td>
    </tr>
  </tbody>
</table>
<div class="sign"><div class="sign-box"><div class="sign-line">Manager / Admin BPS</div></div></div>
</body></html>`;
    const w = window.open('','_blank','width=1000,height=720');
    w.document.write(html); w.document.close();
  }

  /* ─── CONTROLS ─── */
  function setSearch(val) {
    _search = (val||'').toLowerCase().trim();
    _renderTbody();
  }
  function setFilterCustomer(val) { _filterCustomer = val; _renderTbody(); }
  function setFilterDate(val)     { _filterDate = val; _renderTbody(); }

  return {
    init, openModal, _submitOrder,
    openColManager, _setColLabel, _setColGroup, _setColEditable, _removeCol, _addCol, _resetCols,
    editHeader, _saveHdr,
    startEdit, deleteOrder,
    openInvoiceModal, _previewInv, _printInvoice,
    setSearch, setFilterCustomer, setFilterDate,
  };
})();

window.OrderModule = OrderModule;
