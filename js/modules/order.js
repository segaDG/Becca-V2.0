/* ============================================
   BECCA V2.0 — Order Module v3
   Fixes: auto invoice number, cetak button, addCol, customer ID
============================================ */
const OrderModule = (() => {
  let _data = [];
  let _cols = [];
  let _invRecs = [];
  let _search = '';
  let _filterCustomer = '';
  let _filterDate = '';

  const _defaultCols = [
    {key:'breakfast', label:'BF',     group:'s1', editable:true},
    {key:'shift1',    label:'S1',     group:'s1', editable:true},
    {key:'spare1',    label:'Sp1',    group:'s1', editable:true},
    {key:'ot1',       label:'OT1',    group:'s1', editable:true},
    {key:'snack1',    label:'Snk1',   group:'s1', editable:true},
    {key:'shift2',    label:'S2',     group:'s2', editable:true},
    {key:'spare2',    label:'Sp2',    group:'s2', editable:true},
    {key:'ot2',       label:'OT2',    group:'s2', editable:true},
    {key:'snack2',    label:'Snk2',   group:'s2', editable:true},
    {key:'shift3',    label:'S3',     group:'s3', editable:true},
    {key:'spare3',    label:'Sp3',    group:'s3', editable:true},
    {key:'ot3',       label:'OT3',    group:'s3', editable:true},
    {key:'snack3',    label:'Snk3',   group:'s3', editable:true},
    {key:'snackBerat',label:'SnkBrt', group:'sb', editable:true},
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
  function _save() { localStorage.setItem('becca_orders', JSON.stringify(_data)); }
  function _saveCols() { localStorage.setItem('becca_order_columns', JSON.stringify(_cols)); }
  function _saveInvs() { localStorage.setItem('becca_order_invoices', JSON.stringify(_invRecs)); }
  function _getCustomers() {
    try { return JSON.parse(localStorage.getItem('becca_customers')||'[]'); } catch(e) { return []; }
  }
  function _custNames() {
    return [...new Set(_data.map(o=>o.namaPerusahaan).filter(Boolean))].sort();
  }

  /* ─── AUTO GENERATE NOMOR INVOICE ─── 
     Format: CustID(3) + TglAwal(2) + TglAkhir(2) + TahunAwal(2) + BulanAwal(2)
     Contoh: NICI (id=10), 16-31 Jan 2026 => 01016312601
     Revisi pertama: 01016312601R
     Revisi kedua:   01016312601RR
  */
  function _genInvNo(custName, dari, sampai) {
    const custs = _getCustomers();
    const cust = custs.find(c => c.nama === custName);
    const cidRaw = cust && cust.customerId ? String(cust.customerId) : '0';
    // ambil angka saja dari customerId (e.g. "057A" -> 57 -> "057")
    const cidNum = parseInt(cidRaw.replace(/[^0-9]/g,'')) || 0;
    const cid = String(cidNum).padStart(3, '0');

    if (!dari || !sampai) return cid + '000000000';

    const d1 = new Date(dari);
    const d2 = new Date(sampai);
    const dd = String(d1.getDate()).padStart(2, '0');    // tgl awal
    const ss = String(d2.getDate()).padStart(2, '0');    // tgl akhir
    const yy = String(d1.getFullYear()).slice(-2);       // 2 digit tahun awal
    const bb = String(d1.getMonth() + 1).padStart(2, '0'); // bulan awal

    const base = cid + dd + ss + yy + bb;

    // cek apakah sudah ada invoice dengan nomor ini (deteksi revisi)
    const existing = _invRecs.filter(r => r.nomor && (r.nomor === base || r.nomor.startsWith(base)));
    if (existing.length === 0) return base;
    return base + 'R'.repeat(existing.length);
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
    } catch(e) {
      _cols = JSON.parse(JSON.stringify(_defaultCols));
      _invRecs = [];
    }
    _renderFull(page);
  }

  /* ─── FULL RENDER ─── */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-order');
    if (!page) return;
    const cn = _custNames();
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
        <p>Rekapitulasi order masuk · ${_data.length} record</p>
      </div>
      <div class="page-header-right" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="OrderModule.openInvoiceModal()" style="background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.35);font-size:12px">
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

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px">
      ${[
        {l:'Total Order',   v:_data.length,            c:'#6366f1', s:'entri'},
        {l:'Real Order',    v:totalReal,               c:'#10b981', s:'terkonfirmasi'},
        {l:'Estimasi',      v:_data.length-totalReal,  c:'#f59e0b', s:'perkiraan'},
        {l:'Customer',      v:[...new Set(_data.map(o=>o.namaPerusahaan))].length, c:'#ec4899', s:'perusahaan'},
        {l:'Sudah Invoice', v:totalInv,                c:'#10b981', s:'order'},
      ].map(s=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${s.c}"></div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:3px">${s.l}</div>
        <div style="font-size:20px;font-weight:900;color:${s.c};font-family:var(--font-mono)">${s.v} <span style="font-size:11px;font-weight:400;color:var(--text-3)">${s.s}</span></div>
      </div>`).join('')}
    </div>

    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
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
        <div class="hdr-wrap"><span>${c.label}</span><span class="hdr-btn" title="Edit nama kolom">✎</span></div>
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
    if (_filterDate) list = list.filter(o => o.tglOrder === _filterDate);

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
        const m = _groupMeta[col.group||'cx'] || _groupMeta.cx;
        const val = o._custom ? (o._custom[col.key] !== undefined ? o._custom[col.key] : o[col.key]) : o[col.key];
        return `<td class="ord-td" style="background:${m.bg}">
          <div class="ord-cell" ondblclick="OrderModule.startEdit('${oid}','${col.key}',this)" title="Double-klik untuk edit">${_c(val)}</div>
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
          <button onclick="OrderModule.deleteOrder('${oid}')" style="width:24px;height:24px;border-radius:4px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);cursor:pointer;color:#ef4444;font-size:11px" title="Hapus">✕</button>
        </td>
      </tr>`;
    }).join('');
  }

  /* ─── INLINE EDIT ─── */
  function startEdit(ordId, key, cell) {
    const ord = _data.find(o => o.id === ordId);
    if (!ord) return;
    if (ord.invoiced) { Notify.warning('Order sudah di-invoice, tidak bisa diedit'); return; }
    const col = _cols.find(c => c.key === key);
    const isNum = col ? col.editable : false;
    const cur = key === 'namaPerusahaan' ? (ord[key]||'') : (col && col.custom) ? ((ord._custom||{})[key]||0) : (ord[key]||0);
    const orig = cell.innerHTML;
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
        sel.onkeydown = (e) => {
          if(e.key==='Enter') sel.blur();
          if(e.key==='Escape'){cell.innerHTML=orig;cell.ondblclick=()=>startEdit(ordId,key,cell);}
        };
        return;
      }
    }
    cell.innerHTML = `<input type="${isNum?'number':'text'}" value="${cur}" min="0" style="width:100%;border:2px solid #6366f1;border-radius:3px;background:var(--surface);color:var(--text);font-size:11px;font-weight:600;text-align:${isNum?'center':'left'};padding:2px 4px;outline:none;box-sizing:border-box">`;
    const inp = cell.querySelector('input');
    inp.focus(); inp.select();
    inp.onblur = () => commit(inp.value);
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') inp.blur();
      if (e.key === 'Escape') { cell.innerHTML = orig; cell.ondblclick = () => startEdit(ordId, key, cell); }
    };
  }

  /* ─── EDIT HEADER ─── */
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
    _cols[ci].label = lbl;
    _cols[ci].group = grp;
    _saveCols();
    Modal.close();
    _renderThead();
    _renderTbody();
    Notify.success('Nama kolom diperbarui');
  }

  /* ─── KELOLA KOLOM ─── */
  function openColManager() {
    const _buildColTable = () => _cols.map((c,i)=>`
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
      </tr>`).join('');

    Modal.open({
      title: '⚙ Kelola Kolom',
      size: 'modal-lg',
      body: `
        <p style="font-size:12px;color:var(--text-3);margin-bottom:10px">Klik header kolom di tabel untuk rename cepat.</p>
        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr style="background:var(--primary-h)">
              <th style="padding:7px 10px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Key</th>
              <th style="padding:7px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Label</th>
              <th style="padding:7px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Grup</th>
              <th style="padding:7px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Editable</th>
              <th style="padding:7px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase">Hapus</th>
            </tr></thead>
            <tbody id="col-mgr-tbody">${_buildColTable()}</tbody>
          </table>
        </div>
        <div style="padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
          <div style="font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:8px">+ Tambah Kolom Baru</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <div>
              <div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Key (huruf kecil)</div>
              <input id="nc-key" placeholder="contoh: extra1"
                style="width:120px;padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;color:var(--text)">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Label (maks 10)</div>
              <input id="nc-label" placeholder="Xtra1" maxlength="10"
                style="width:90px;padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;color:var(--text)">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-3);margin-bottom:3px">Grup</div>
              <select id="nc-group"
                style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;color:var(--text)">
                ${Object.entries(_groupMeta).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
              </select>
            </div>
            <button onclick="OrderModule._addCol()"
              style="padding:6px 14px;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">+ Tambah</button>
          </div>
        </div>`,
      buttons: [
        {label:'Tutup',        class:'btn-ghost',      onclick:'Modal.close()'},
        {label:'Reset Default',class:'btn-secondary',  onclick:'OrderModule._resetCols()'},
      ]
    });
  }

  function _setColLabel(i, v)    { if(v.trim()){_cols[i].label=v.trim();_saveCols();_renderThead();} }
  function _setColGroup(i, v)    { _cols[i].group=v;_saveCols();_renderThead(); }
  function _setColEditable(i, v) { _cols[i].editable=v;_saveCols(); }

  function _removeCol(i) {
    if(!confirm(`Hapus kolom "${_cols[i].label}"?`)) return;
    _cols.splice(i,1);
    _saveCols();
    Modal.close();
    _renderFull();
    Notify.success('Kolom dihapus');
  }

  function _addCol() {
    const keyEl   = document.getElementById('nc-key');
    const lblEl   = document.getElementById('nc-label');
    const grpEl   = document.getElementById('nc-group');
    let key = (keyEl?.value||'').trim().replace(/\s+/g,'_').toLowerCase();
    const lbl = (lblEl?.value||'').trim();
    const grp = grpEl?.value || 'cx';

    if (!key || !lbl) { Notify.warning('Key dan label wajib diisi'); return; }
    if (_cols.find(c=>c.key===key)) { Notify.warning('Key sudah ada, gunakan key lain'); return; }

    _cols.push({key, label:lbl, group:grp, editable:true, custom:true});
    _saveCols();

    // Update tbody in modal without closing
    const tbody = document.getElementById('col-mgr-tbody');
    if (tbody) {
      tbody.innerHTML = _cols.map((c,i)=>`
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
        </tr>`).join('');
    }
    if (keyEl) keyEl.value = '';
    if (lblEl) lblEl.value = '';
    _renderThead();
    Notify.success(`Kolom "${lbl}" ditambahkan`);
  }

  function _resetCols() {
    if(!confirm('Reset semua kolom ke default?')) return;
    _cols = JSON.parse(JSON.stringify(_defaultCols));
    _saveCols();
    Modal.close();
    _renderFull();
    Notify.success('Kolom direset');
  }

  /* ─── DELETE ─── */
  function deleteOrder(id) {
    const o = _data.find(x=>x.id===id);
    if (!o) return;
    if (o.invoiced) { Notify.warning('Order sudah di-invoice, tidak bisa dihapus'); return; }
    if (!confirm(`Hapus order ${o.namaPerusahaan} (${o.tglOrder})?`)) return;
    _data = _data.filter(x=>x.id!==id);
    _save();
    _renderTbody();
    Notify.success('Order dihapus');
  }

  /* ─── TAMBAH ORDER ─── */
  function openModal() {
    const custs = _getCustomers();
    const co = custs.map(c=>`<option value="${c.nama}">${c.nama}</option>`).join('');
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
        {label:'Batal',        class:'btn-ghost',   onclick:'Modal.close()'},
        {label:'Simpan Order', class:'btn-primary',  onclick:'OrderModule._submitOrder()'}
      ]
    });
  }

  function _submitOrder() {
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const n = id => parseInt(document.getElementById(id)?.value)||0;
    const tgl = g('of-tgl'), cust = g('of-cust');
    if (!tgl)  { Notify.warning('Tanggal order wajib diisi'); return; }
    if (!cust) { Notify.warning('Pilih nama perusahaan'); return; }
    const now = new Date();
    const ts  = now.toISOString().slice(0,10)+' '+now.toTimeString().slice(0,8);
    const user = (typeof Auth!=='undefined'&&Auth.user)?(Auth.user.name||Auth.user.username||''):'';
    _data.push({
      id:'ord_'+Date.now(), timestamp:ts,
      pelapor:g('of-pelapor')||user, tglOrder:tgl, namaPerusahaan:cust,
      catatan:g('of-jenis'),
      breakfast:n('of-bf'),
      shift1:n('of-s1'), spare1:n('of-sp1'), ot1:n('of-ot1'), snack1:n('of-snk1'),
      shift2:n('of-s2'), spare2:n('of-sp2'), ot2:n('of-ot2'), snack2:n('of-snk2'),
      shift3:n('of-s3'), spare3:n('of-sp3'), ot3:n('of-ot3'), snack3:n('of-snk3'),
      snackBerat:n('of-snkb'),
    });
    _save();
    Modal.close();
    Notify.success('Order berhasil ditambahkan');
    _renderFull();
  }

  /* ══════════════════════════════════════════
     🧾 CETAK INVOICE
  ══════════════════════════════════════════ */
  function openInvoiceModal() {
    const custAvail = [...new Set(_data.filter(o=>!o.invoiced).map(o=>o.namaPerusahaan).filter(Boolean))].sort();
    if (!custAvail.length) { Notify.warning('Tidak ada order yang belum di-invoice'); return; }

    const today = new Date().toISOString().slice(0,10);

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
          <label class="form-label">
            Nomor Invoice
            <span style="font-size:10px;color:var(--text-3);font-weight:400"> — otomatis dari Customer ID + periode</span>
          </label>
          <input class="form-control" id="ic-nomor" value="" placeholder="Pilih customer & periode untuk generate otomatis"
            style="font-family:var(--font-mono);font-size:14px;font-weight:700;letter-spacing:.04em">
        </div>
        <div id="ic-preview" style="margin-top:12px;border:1px solid var(--border);border-radius:8px;padding:20px;min-height:80px;background:var(--surface2);color:var(--text-3);text-align:center">
          Pilih customer dan periode untuk melihat preview
        </div>
        <div style="margin-top:12px;display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
          <input type="checkbox" id="ic-add-chk" style="width:16px;height:16px;cursor:pointer;accent-color:#3B4E87"
            onchange="OrderModule._toggleAdditional(this.checked)">
          <label for="ic-add-chk" style="font-size:12px;font-weight:600;cursor:pointer;color:var(--text)">
            Additional Order
            <span style="font-size:11px;font-weight:400;color:var(--text-3);margin-left:4px">— centang untuk tambahkan section additional order yang bisa diedit</span>
          </label>
        </div>
        <div id="ic-additional" style="display:none;margin-top:8px;padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">
          <div style="font-size:11px;font-weight:700;color:#1A7340;margin-bottom:8px">✚ Additional Order Rows</div>
          <div id="ic-add-rows"></div>
          <button onclick="OrderModule._addAdditionalRow()" style="margin-top:8px;padding:5px 12px;font-size:11px;background:#1A7340;color:#fff;border:none;border-radius:5px;cursor:pointer">+ Tambah Baris</button>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:10px">
          <button class="btn btn-ghost" onclick="Modal.close()">Batal</button>
          <button class="btn btn-primary" onclick="OrderModule._printInvoice()" style="padding:8px 22px;font-size:13px">
            🖨 Cetak Invoice
          </button>
        </div>`,
      buttons: []
    });
  }

  function _previewInv() {
    const cust   = document.getElementById('ic-cust')?.value;
    const dari   = document.getElementById('ic-dari')?.value;
    const sampai = document.getElementById('ic-sampai')?.value;
    const area   = document.getElementById('ic-preview');
    if (!area) return;

    // Auto-generate nomor invoice
    const nomorEl = document.getElementById('ic-nomor');
    if (nomorEl && cust) {
      nomorEl.value = _genInvNo(cust, dari || sampai, sampai || dari);
    }

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

  function _toggleAdditional(checked) {
    const el = document.getElementById('ic-additional');
    if (el) el.style.display = checked ? 'block' : 'none';
    if (checked) {
      const rows = document.getElementById('ic-add-rows');
      if (rows && !rows.children.length) _addAdditionalRow();
    }
  }

  function _addAdditionalRow() {
    const rows = document.getElementById('ic-add-rows');
    if (!rows) return;
    const idx = rows.children.length;
    const today = new Date().toISOString().slice(0,10);
    // Build input cols from active _cols
    const colInputs = _cols.map(col => `
      <td style="padding:3px">
        <input type="number" min="0" value="0"
          data-add="${idx}" data-key="${col.key}"
          style="width:52px;padding:3px 5px;text-align:center;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:11px;font-family:var(--font-mono)">
      </td>`).join('');
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:4px';
    row.innerHTML = `<table style="width:100%;font-size:11px;border-collapse:collapse">
      <tr>
        <td style="padding:3px;font-size:10px;color:var(--text-3);width:22px">${idx+1}</td>
        <td style="padding:3px">
          <input type="date" value="${today}" data-add="${idx}" data-key="tglOrder"
            style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:11px">
        </td>
        ${colInputs}
        <td style="padding:3px">
          <button onclick="this.closest('div').remove()" style="padding:2px 7px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);border-radius:4px;color:#ef4444;cursor:pointer;font-size:10px">✕</button>
        </td>
      </tr>
    </table>`;
    rows.appendChild(row);
  }

  function _getAdditionalRows() {
    const rows = document.getElementById('ic-add-rows');
    if (!rows) return [];
    const result = [];
    rows.querySelectorAll('[data-add]').forEach(inp => {
      const idx = inp.dataset.add;
      if (!result[idx]) result[idx] = {};
      result[idx][inp.dataset.key] = inp.value;
    });
    return result.filter(Boolean);
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

    const tots = {};
    _cols.forEach(c => { tots[c.key] = list.reduce((s,o)=>s+(Number(o[c.key])||0),0); });

    _invRecs.push({nomor, customer:cust, dari, sampai, invoiceDate:invDate, orderCount:list.length, orderIds:ids, totals:tots});
    _saveInvs();

    const includeAdd = document.getElementById('ic-add-chk')?.checked || false;
    const addRows    = includeAdd ? _getAdditionalRows() : [];

    Modal.close();
    Notify.success(`Invoice ${nomor} berhasil — ${list.length} order ditandai`);
    // Defer heavy re-render agar modal close tidak lag
    setTimeout(() => _renderFull(), 50);

    _openPrintWin(nomor, cust, dari, sampai, list, tots, includeAdd, addRows);
  }

  function _openPrintWin(nomor, cust, dari, sampai, list, tots, includeAdd, addRows) {
    addRows = addRows || [];

    /* ─── Helpers ─── */
    const C  = { NAVY:'#3B4E87', NAVY_D:'#2C3B65', NAVY_M:'#4A5E99', BL:'#C9DAF8', BP:'#E8F0FE',
                 SUB:'#ACC9FE', STR:'#F4F6FC', ADD:'#EAF4EE', ADD_H:'#1A7340',
                 GRY:'#666666', GLT:'#AAAAAA', URL:'#0070C0', RED:'#FF0000' };

    const MONTHS_ID = {January:'Januari',February:'Februari',March:'Maret',April:'April',
      May:'Mei',June:'Juni',July:'Juli',August:'Agustus',September:'September',
      October:'Oktober',November:'November',December:'Desember'};

    // Parse dates
    const tgl1 = dari   ? new Date(dari)   : null;
    const tgl2 = sampai ? new Date(sampai) : null;
    const fmtD = d => d ? `${d.getDate()} ${Object.values(MONTHS_ID)[d.getMonth()]} ${d.getFullYear()}` : '--';
    const sd   = tgl1 ? tgl1.getDate()   : '--';
    const ed   = tgl2 ? tgl2.getDate()   : '--';
    const mth  = tgl1 ? Object.values(MONTHS_ID)[tgl1.getMonth()] : '';
    const yr   = tgl1 ? tgl1.getFullYear() : '';
    const periodeStr = tgl1 && tgl2 ? `${sd} – ${ed} ${mth} ${yr}` : '--';

    // Get customer info from becca_customers
    const custDB = (() => {
      try { return JSON.parse(localStorage.getItem('becca_customers')||'[]'); } catch(e){return[];}
    })();
    const custObj = custDB.find(c => c.nama === cust) || {};

    // Determine active columns (only cols with data)
    const ALL_KEYS = _cols.map(c => c.key);
    const activeCols = _cols.filter(c => {
      const total = list.reduce((s,o)=>s+(Number(o[c.key])||0),0)
                  + addRows.reduce((s,o)=>s+(Number(o[c.key])||0),0);
      return total > 0;
    });

    // Sub-totals per active col
    const mainTots = {};
    const addTots  = {};
    activeCols.forEach(c => {
      mainTots[c.key] = list.reduce((s,o)=>s+(Number(o[c.key])||0),0);
      addTots[c.key]  = addRows.reduce((s,o)=>s+(Number(o[c.key])||0),0);
    });
    const mainQty = Object.values(mainTots).reduce((a,b)=>a+b,0);
    const addQty  = Object.values(addTots).reduce((a,b)=>a+b,0);

    // Harga default 17500 — bisa override dari custObj
    // Lookup harga dari becca_customers
    const _custMap = (() => {
      try {
        const cs = JSON.parse(localStorage.getItem('becca_customers')||'[]');
        const c  = cs.find(x => x.nama === cust);
        if (!c) return null;
        return {
          breakfast:c.hargaBreakfast||17500, s1:c.hargaShift1||17500,
          spare1:c.hargaSpare1||17500,       ot1:c.hargaOT1||17500,
          snack1:c.hargaSnack1||17500,       s2:c.hargaShift2||17500,
          spare2:c.hargaSpare2||17500,       ot2:c.hargaOT2||17500,
          snack2:c.hargaSnack2||17500,       s3:c.hargaShift3||17500,
          spare3:c.hargaSpare3||17500,       ot3:c.hargaOT3||17500,
          snack3:c.hargaSnack3||17500,       snackBerat:c.hargaSnackBerat||17500,
        };
      } catch(e){ return null; }
    })();
    const _gh = key => _custMap?.[key] ?? 17500;
    const rp = n => n ? `Rp ${Number(n).toLocaleString('id')}` : '-';

    /* ─── CSS ─── */
    const css = `
      *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a2e;background:#fff}
      @page{size:A4 portrait;margin:12mm 12mm 14mm 12mm}
      @media print{
        .no-print{display:none!important}
        .page-break{page-break-after:always}
        body,*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      }

      /* ── SHARED ── */
      .doc{width:100%;max-width:210mm;margin:0 auto;padding:0}
      .page{padding:0;margin-bottom:0}
      .navy-bar{background:${C.NAVY};color:#fff;padding:5px 10px;font-weight:700;font-size:9px}
      .navy-mid{background:${C.NAVY_M};color:#fff;padding:5px 10px;font-weight:700}
      .period-row{display:flex;height:26px}
      .period-lbl{background:${C.NAVY};color:#fff;display:flex;align-items:center;justify-content:center;
        padding:0 12px;font-weight:700;font-size:9px;white-space:nowrap;min-width:72px}
      .period-val{background:${C.NAVY_M};color:#fff;display:flex;align-items:center;justify-content:center;
        flex:1;font-weight:700;font-size:12px;letter-spacing:.02em}

      /* ── HEADER COMPANY ── */
      .co-hdr{display:flex;justify-content:space-between;align-items:flex-start;
        padding-bottom:10px;border-bottom:3px solid ${C.NAVY};margin-bottom:0}
      .co-name{font-size:21px;font-weight:900;color:${C.NAVY_D};line-height:1.1;letter-spacing:-.2px}
      .co-sub{font-size:10px;color:${C.NAVY};font-style:italic;margin-top:2px}
      .co-addr{font-size:8px;color:${C.GRY};margin-top:4px;line-height:1.7}
      .co-right{text-align:right;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start}
      .doc-title{font-size:28px;font-weight:900;color:${C.NAVY};line-height:1;letter-spacing:.04em}
      .doc-num{font-size:11px;font-weight:700;color:${C.NAVY_D};margin-top:4px;
        background:${C.BP};padding:3px 8px;border-radius:3px;letter-spacing:.03em}

      /* ── BILL TO ── */
      .bill-hdr{background:${C.NAVY};color:#fff;padding:4px 10px;font-weight:700;font-size:9px;
        letter-spacing:.08em;margin-top:6px}
      .bill-body{padding:5px 10px 6px;border:1px solid #dde3f0;border-top:none;margin-bottom:6px}
      .bill-recv{font-size:8px;color:${C.GRY}}
      .bill-name{font-size:12px;font-weight:700;color:${C.NAVY_D};margin:2px 0}
      .bill-addr{font-size:8px;color:${C.GRY};line-height:1.5}

      /* ── TABLES ── */
      .tbl{width:100%;border-collapse:collapse;margin-bottom:0}
      .tbl th{background:${C.NAVY};color:#fff;padding:5px 5px;font-size:9px;font-weight:700;
        text-align:center;border:1px solid ${C.NAVY_M};white-space:nowrap}
      .tbl th.left{text-align:left;padding-left:8px}
      .tbl td{padding:4px 5px;border:1px solid #dde3f0;font-size:9px;text-align:center;
        vertical-align:middle}
      .tbl td.left{text-align:left;padding-left:8px;font-weight:600}
      .tbl td.right{text-align:right;padding-right:6px}
      .tbl td.num{font-family:Arial,sans-serif;font-weight:700}
      .tbl tr:nth-child(even) td{background:${C.BP}}
      .tbl tr.sub-tot td{background:${C.SUB};font-weight:700;font-size:9px;color:${C.NAVY_D}}
      .tbl tr.add-hdr th{background:${C.ADD_H}}
      .tbl tr.add-row td{background:#fff}
      .tbl tr.add-row:nth-child(even) td{background:${C.ADD}}

      /* ── DESCRIPTION LABEL ── */
      .desc-lbl{background:${C.BL};padding:4px 10px;font-size:9px;font-weight:700;
        border-bottom:1px solid #aac4e8;margin-bottom:0}

      /* ── INVOICE ITEMS ── */
      .inv-tbl th{background:${C.NAVY};color:#fff;padding:6px 8px;font-size:9px;font-weight:700;
        border:1px solid ${C.NAVY_M}}
      .inv-tbl td{padding:5px 8px;border:1px solid #dde3f0;font-size:9px;vertical-align:middle}
      .inv-tbl tr.stripe td{background:${C.STR}}
      .inv-tbl tr.add-sep td{background:${C.ADD};font-weight:700;color:${C.ADD_H};font-size:9px}
      .inv-tbl tr.add-item td{background:#fff}
      .inv-tbl tr.add-item:nth-child(even) td{background:${C.ADD}}

      /* ── TOTALS BOX ── */
      .tot-box{margin-top:8px;border:1px solid #dde3f0;border-radius:4px;overflow:hidden}
      .tot-row{display:flex;justify-content:space-between;padding:4px 12px;
        border-bottom:1px solid #eee;font-size:10px}
      .tot-row.total-final{background:${C.NAVY};color:#fff;font-weight:700;font-size:12px;
        padding:7px 12px;border-bottom:none}
      .tot-row.oc-hdr{background:${C.NAVY};color:#fff;font-weight:700;font-size:9px;padding:4px 12px}
      .tot-lbl{color:inherit}
      .tot-val{font-weight:700;font-family:Arial,sans-serif}

      /* ── FOOTER ── */
      .footer-bar{background:${C.NAVY};color:#fff;text-align:center;padding:8px;
        font-size:13px;font-weight:700;margin-top:12px;letter-spacing:.02em}
      .footer-sub{text-align:center;font-size:8px;color:${C.GRY};padding:4px 0 0}
      /* sign-area: full width, kiri = kota+tanggal, kanan = kotak TTD */
      .sign-area{display:flex;justify-content:space-between;align-items:flex-end;
        margin-top:18px;gap:16px}
      /* Kiri: kota & tanggal di atas garis TTD kiri */
      .sign-left-wrap{display:flex;flex-direction:column;align-items:flex-start;min-width:180px}
      .sign-place{font-size:10px;color:#333;margin-bottom:46px}
      .sign-line-l{border-top:1px solid #333;width:160px;padding-top:3px;font-size:9px;color:${C.GRY}}
      /* Kanan: TTD penerima / customer */
      .sign-box{text-align:center;min-width:160px}
      .sign-line{border-top:1px solid #333;margin-top:46px;padding-top:3px;font-size:9px}
      .sign-name{font-weight:700;font-size:10px}
      .sign-title{font-size:8px;color:${C.GRY}}
      .bank-area{display:flex;justify-content:space-between;align-items:center;margin-top:10px;
        padding:8px 14px;border:1px solid #dde3f0;border-radius:6px;font-size:8px;color:${C.GRY};
        background:#fafbff}
      .materai-box{border:1px dashed #bbb;width:86px;height:52px;display:flex;flex-shrink:0;
        align-items:center;justify-content:center;font-size:8px;color:#bbb;border-radius:4px;
        background:#f8f8f8}

      /* ── PRINT BTN ── */
      .print-btn{position:fixed;top:14px;right:16px;padding:8px 20px;background:${C.NAVY};
        color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
        box-shadow:0 4px 14px rgba(59,78,135,.45);z-index:999}
      @media print{.print-btn,.no-print{display:none!important}}
    `;

    /* ─── REKAP HTML ─── */
    const rekapTable = () => {
      // Header row 1 (group)
      const grpH = `<tr>
        <th class="left" style="width:24px">#</th>
        <th style="width:38px">DD</th>
        <th style="width:60px">BULAN</th>
        <th colspan="${activeCols.length}">ORDER</th>
        <th style="width:42px">QTY</th>
        <th style="width:80px">TOTAL</th>
      </tr>`;
      // Header row 2 (sub)
      const subH = `<tr>
        <th></th><th></th><th></th>
        ${activeCols.map(c=>`<th>${c.label}</th>`).join('')}
        <th></th><th></th>
      </tr>`;
      // Data rows
      const dataRows = list.map((o,i) => {
        const stripe = i%2===0 ? '' : 'background:'+C.BP;
        const qty = activeCols.reduce((s,c)=>s+(Number(o[c.key])||0),0);
        const tot = activeCols.reduce((s,c)=>s+(Number(o[c.key])||0)*_gh(c.key),0);
        return `<tr>
          <td style="${stripe};text-align:center;color:${C.GRY}">${i+1}</td>
          <td style="${stripe};text-align:center;font-weight:700">${o.tglOrder?o.tglOrder.slice(8):''}</td>
          <td style="${stripe};text-align:center">${mth}</td>
          ${activeCols.map(c=>`<td style="${stripe}">${Number(o[c.key])||0||'–'}</td>`).join('')}
          <td style="${stripe};font-weight:700;text-align:center">${qty||'–'}</td>
          <td style="${stripe};text-align:right;padding-right:6px">${tot?rp(tot):'–'}</td>
        </tr>`;
      }).join('');
      // Sub total
      const subRow = `<tr class="sub-tot">
        <td colspan="3" class="left">SUB TOTAL</td>
        ${activeCols.map(c=>`<td style="text-align:center">${mainTots[c.key]||'–'}</td>`).join('')}
        <td style="text-align:center">${mainQty||'–'}</td>
        <td class="right">${rp(activeCols.reduce((s,c)=>s+mainTots[c.key]*_gh(c.key),0))}</td>
      </tr>`;
      // Additional rows
      let addSection = '';
      if (includeAdd && addRows.length) {
        const addGrpH = `<tr class="add-hdr">
          <th class="left">#</th><th>DD</th><th>BULAN</th>
          ${activeCols.map(c=>`<th>${c.label}</th>`).join('')}
          <th>QTY</th><th>TOTAL</th>
        </tr>`;
        const addDataRows = addRows.map((o,i) => {
          const d = o.tglOrder ? new Date(o.tglOrder) : null;
          const dd = d ? d.getDate() : '';
          const mm = d ? Object.values(MONTHS_ID)[d.getMonth()] : '';
          const qty = activeCols.reduce((s,c)=>s+(Number(o[c.key])||0),0);
          const tot = activeCols.reduce((s,c)=>s+(Number(o[c.key])||0)*_gh(c.key),0);
          const stripe = i%2===0?'':'background:'+C.ADD;
          return `<tr class="add-row">
            <td style="${stripe};text-align:center;color:${C.GRY}">${i+1}</td>
            <td style="${stripe};text-align:center;font-weight:700">${dd}</td>
            <td style="${stripe};text-align:center">${mm}</td>
            ${activeCols.map(c=>`<td style="${stripe}">${Number(o[c.key])||0||'–'}</td>`).join('')}
            <td style="${stripe};font-weight:700;text-align:center">${qty||'–'}</td>
            <td style="${stripe};text-align:right;padding-right:6px">${tot?rp(tot):'–'}</td>
          </tr>`;
        }).join('');
        const addSubRow = `<tr class="sub-tot" style="background:${C.SUB};color:${C.ADD_H}">
          <td colspan="3" class="left">SUB TOTAL ADDITIONAL</td>
          ${activeCols.map(c=>`<td style="text-align:center">${addTots[c.key]||'–'}</td>`).join('')}
          <td style="text-align:center">${addQty||'–'}</td>
          <td class="right">${rp(activeCols.reduce((s,c)=>s+addTots[c.key]*_gh(c.key),0))}</td>
        </tr>`;
        addSection = `<tr><td colspan="${3+activeCols.length+2}" style="padding:0;background:${C.ADD_H}"></td></tr>
          ${addGrpH}${addDataRows}${addSubRow}`;
      }
      return `<table class="tbl">${grpH}${subH}${dataRows}${subRow}${addSection}</table>`;
    };

    /* ─── INVOICE HTML ─── */
    const invoiceItems = () => {
      // Main line items: one row per active shift col
      const mainLines = activeCols.map((c,i) => {
        const qty = mainTots[c.key];
        if (!qty) return '';
        const stripe = i%2===0?'':'class="stripe"';
        return `<tr ${stripe}>
          <td class="inv-tbl" style="width:24px"></td>
          <td class="left" colspan="2">${
            c.key==='s1'?'Food Catering Service Shift I — Makan Siang':
            c.key==='s2'?'Food Catering Service Shift II — Makan Sore':
            c.key==='s3'?'Food Catering Service Shift III — Makan Malam':
            c.key==='snack2'?'Food Catering Service Shift II — Takjil':
            c.key==='snack3'?'Food Catering Service Shift III — Takjil':
            c.key==='bf'?'Food Catering Service — Breakfast':
            'Food Catering Service — '+c.label
          }</td>
          <td class="right">${rp(_gh(c.key))}</td>
          <td style="text-align:center;font-weight:700">${qty}</td>
          <td style="text-align:center"></td>
          <td></td>
          <td class="right num">${rp(qty*_gh(c.key))}</td>
        </tr>`;
      }).join('');

      // Additional lines
      let addLines = '';
      if (includeAdd && addRows.length) {
        const sepRow = `<tr class="add-sep">
          <td></td>
          <td colspan="7">Additional Order</td>
        </tr>`;
        const addItemLines = activeCols.map((c,i) => {
          const qty = addTots[c.key];
          if (!qty) return '';
          const cls = i%2===0?'add-item':'add-item';
          return `<tr class="${cls}">
            <td></td>
            <td class="left" colspan="2" style="color:${C.ADD_H}">Additional Order — ${c.label}</td>
            <td class="right" style="color:${C.ADD_H}">${rp(_gh(c.key))}</td>
            <td style="text-align:center;font-weight:700;color:${C.ADD_H}">${qty}</td>
            <td style="text-align:center"></td>
            <td></td>
            <td class="right num" style="color:${C.ADD_H};font-weight:700">${rp(qty*_gh(c.key))}</td>
          </tr>`;
        }).join('');
        addLines = sepRow + addItemLines;
      }

      // Empty filler rows
      const filled = activeCols.filter(c => mainTots[c.key]>0).length
                   + (includeAdd ? activeCols.filter(c => addTots[c.key]>0).length + 1 : 0);
      const MAX = 12;
      const fillers = Array(Math.max(0, MAX - filled)).fill(0).map((_,i) => {
        const cls = (filled+i)%2===0 ? '' : 'class="stripe"';
        return `<tr ${cls}><td></td><td colspan="2"></td><td></td><td></td><td></td><td></td>
          <td style="text-align:center;color:#ddd">–</td></tr>`;
      }).join('');

      return mainLines + addLines + fillers;
    };

    const totalQty  = mainQty + (includeAdd ? addQty : 0);
    const subtotal  = activeCols.reduce((s,c)=>s+(mainTots[c.key]+(includeAdd?addTots[c.key]:0))*_gh(c.key),0);
    const pb1Rate   = 0.10;
    const pph23Rate = 0.02;
    const pb1Tax    = subtotal * pb1Rate;
    const pphTax    = subtotal * pph23Rate;
    const grandTotal = subtotal + pb1Tax - pphTax;

    /* ─── COMPANY HEADER (shared) ─── */
    const coHeader = (docTitle, docNum) => `
      <div class="co-hdr">
        <div>
          <div class="co-name">PT. BOGA PANGAN SENTOSA</div>
          <div class="co-sub">Your Best Catering Service</div>
          <div class="co-addr">
            Perumnas Bumi Telukjambe, blok PB No.1 RT.006/020 Desa Sukaluyu<br>
            Kec. Telukjambe Timur, Kab. Karawang, Jawa Barat 41361<br>
            📞 0267-8407252 &nbsp;•&nbsp; admin@pangansentosa.com &nbsp;•&nbsp; <span style="color:${C.URL}">www.pangan.co.id</span>
          </div>
        </div>
        <div class="co-right">
          <div class="doc-title">${docTitle}</div>
          <div class="doc-num">#${docNum}</div>
        </div>
      </div>`;

    /* ─── BILL TO (shared) ─── */
    const billTo = () => `
      <div class="bill-hdr">  BILL TO</div>
      <div class="bill-body">
        <div class="bill-recv">Invoice Receiving</div>
        <div class="bill-name">${cust}</div>
        <div class="bill-addr">
          ${custObj.alamat||''}${custObj.kota?'<br>'+custObj.kota:''}<br>
          ${custObj.telp||''}
        </div>
      </div>`;

    /* ─── PERIODE BAR (shared) ─── */
    const periodeBar = () => `
      <div class="period-row" style="margin-bottom:6px">
        <div class="period-lbl">PERIODE</div>
        <div class="period-val">${periodeStr}</div>
      </div>`;

    /* ─── SIGN AREA (shared) ─── */
    const signArea = () => `
      <div class="sign-area">
        <div class="sign-left-wrap">
          <div class="sign-place">Karawang, ${periodeStr}</div>
          <div class="sign-line-l">Admin / Pembuat Invoice</div>
        </div>
        <div class="sign-box">
          <div class="sign-line">
            <div class="sign-name">Manager / PIC</div>
            <div class="sign-title">${cust}</div>
          </div>
        </div>
      </div>`;

    /* ════════════════════════════════════════════
       PAGE 1 — REKAPITULASI
    ════════════════════════════════════════════ */
    const rekapPage = `
      <div class="page">
        ${coHeader('REKAPITULASI', nomor)}
        ${billTo()}
        ${periodeBar()}
        <div class="desc-lbl">DESCRIPTION : FOOD CATERING SERVICE</div>
        ${rekapTable()}
        ${signArea()}
      </div>`;

    /* ════════════════════════════════════════════
       PAGE 2 — INVOICE
    ════════════════════════════════════════════ */
    const invoicePage = `
      <div class="page-break"></div>
      <div class="page">
        ${coHeader('INVOICE', nomor)}
        ${billTo()}
        ${periodeBar()}
        <table class="tbl inv-tbl" style="margin-bottom:0">
          <thead>
            <tr>
              <th style="width:22px"></th>
              <th class="left" colspan="2">DESCRIPTION</th>
              <th style="width:88px">UNIT PRICE</th>
              <th style="width:46px">QTY</th>
              <th style="width:34px">TAXED<br>(Pb1)</th>
              <th style="width:18px"></th>
              <th style="width:88px">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceItems()}
          </tbody>
        </table>

        <!-- Totals + Comments: kiri=comments, kanan=totals box -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px;gap:16px">

          <!-- KIRI: Semua komentar -->
          <div style="font-size:8.5px;color:${C.GRY};line-height:2;flex:1">
            <div style="font-size:9px;font-weight:700;color:${C.NAVY};background:${C.BL};
              padding:3px 8px;margin-bottom:4px;border-radius:3px">OTHER COMMENTS</div>
            <div>1. Total payment due in 45 days</div>
            <div>2. Please include the invoice number on your check</div>
            <div>3. PPh a/n PT. Boga Pangan Sentosa</div>
            <div>4. NPWP : 75.260.202.9-408.000</div>
            <div>5. NPWPD : 03.0012478.03.005</div>
          </div>

          <!-- KANAN: Totals box -->
          <div style="min-width:290px;border:1px solid #dde3f0;border-radius:6px;overflow:hidden;flex-shrink:0">
            <div style="display:flex;justify-content:space-between;padding:5px 12px;
              border-bottom:2px solid ${C.NAVY};background:#fafbff">
              <span style="font-weight:700;font-size:10px;color:${C.NAVY_D}">Subtotal</span>
              <span style="font-weight:700;font-size:11px;color:${C.NAVY_D};font-family:Arial">${rp(subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 12px;
              border-bottom:1px solid #eee;font-size:9px;background:#fafbff">
              <span style="color:#555">Pb1</span>
              <span style="font-weight:600">${(pb1Rate*100).toFixed(0)}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 12px;
              border-bottom:1px solid #eee;font-size:9px;background:#fafbff">
              <span style="color:#555">Tax due (Pb1)</span>
              <span style="font-weight:600">${rp(pb1Tax)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 12px;
              border-bottom:1px solid #eee;font-size:9px;background:#fafbff">
              <span style="color:#555">PPh 23</span>
              <span style="font-weight:600">${(pph23Rate*100).toFixed(0)}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 12px;
              border-bottom:1px solid ${C.NAVY};font-size:9px;background:#fafbff">
              <span style="color:#555">Tax due (PPh 23)</span>
              <span style="font-weight:600;color:${C.RED}">- ${rp(pphTax)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:7px 12px;
              background:${C.NAVY};color:#fff">
              <span style="font-weight:700;font-size:12px;letter-spacing:.04em">TOTAL</span>
              <span style="font-weight:900;font-size:13px;font-family:Arial">${rp(grandTotal)}</span>
            </div>
          </div>

        </div>

        ${signArea()}

        <!-- Bank + footer -->
        <div class="bank-area">
          <div>
            <div style="font-weight:700;color:#333;font-size:9px;margin-bottom:2px">
              Make all checks payable to <span style="color:${C.NAVY_D}">PT. BOGA PANGAN SENTOSA</span>
            </div>
            <div>Bank Mandiri KC Karawang 17300 &nbsp;•&nbsp; No. Rekening : <strong style="color:#333">173-00-0153197-0</strong></div>
          </div>
          <div class="materai-box">MATERAI</div>
        </div>

        <div class="footer-bar">Thank You For Your Business! 🙏</div>
        <div class="footer-sub">If you have any questions, please contact &nbsp;Mr. Somat &nbsp;•&nbsp; +62 822-1033-8880 &nbsp;•&nbsp; umad@pangansentosa.com</div>
      </div>`;

    /* ─── Assemble & open window ─── */
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${nomor} — ${cust}</title>
  <style>${css}</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>
  <div class="doc">
    ${rekapPage}
    ${invoicePage}
  </div>
</body>
</html>`;

    const w = window.open('','_blank','width=900,height=780');
    w.document.write(html);
    w.document.close();
  }

  /* ─── CONTROLS ─── */
  /* ─── CONTROLS ─── */
  function setSearch(val)          { _search = (val||'').toLowerCase().trim(); _renderTbody(); }
  function setFilterCustomer(val)  { _filterCustomer = val; _renderTbody(); }
  function setFilterDate(val)      { _filterDate = val; _renderTbody(); }

  return {
    init, openModal, _submitOrder,
    openColManager, _setColLabel, _setColGroup, _setColEditable, _removeCol, _addCol, _resetCols,
    editHeader, _saveHdr,
    startEdit, deleteOrder,
    openInvoiceModal, _previewInv, _printInvoice,
    _toggleAdditional, _addAdditionalRow, _getAdditionalRows,
    setSearch, setFilterCustomer, setFilterDate,
  };
})();

window.OrderModule = OrderModule;
