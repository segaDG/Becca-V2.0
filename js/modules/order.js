/* ============================================
   BECCA V2.0 — Order Module v3
   Fixes: auto invoice number, cetak button, addCol, customer ID
============================================ */
const OrderModule = (() => {
  let _data = [];
  let _cols = [];
  let _search = '';
  let _filterCustomer = '';
  let _filterDate = '';
  let _page    = 1;
  let _perPage = parseInt(localStorage.getItem('becca_ord_perPage') || '50');

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
    if (v === null || v === undefined || v === '') return `<span style="color:var(--border2)">-</span>`;
    return Number(v) > 0
      ? `<span style="font-weight:600">${v}</span>`
      : `${v}`;
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
  function _getCustomers() {
    try { return JSON.parse(localStorage.getItem('becca_customers')||'[]'); } catch(e) { return []; }
  }
  function _custNames() {
    return [...new Set(_data.map(o=>o.namaPerusahaan).filter(Boolean))].sort();
  }

  /* ─── INIT ─── */
  async function init() {
    const page = document.getElementById('page-order');
    if (!page) return;
    try {
      // Columns & invoice-refs are UI config — always from localStorage (device-specific)
      const sc = localStorage.getItem('becca_order_columns');
      _cols = sc ? JSON.parse(sc) : JSON.parse(JSON.stringify(_defaultCols));
      if (!_cols.length) _cols = JSON.parse(JSON.stringify(_defaultCols));
      // Migration: remove duplicate sb-group cols — keep only built-in snackBerat
      const _defaultKeys = new Set(_defaultCols.map(c => c.key));
      const _hadDup = _cols.some(c => c.group === 'sb' && !_defaultKeys.has(c.key));
      if (_hadDup) { _cols = _cols.filter(c => !(c.group === 'sb' && !_defaultKeys.has(c.key))); _saveCols(); }
      // Orders: prefer Supabase (cross-device) → fall back to localStorage
      const dbOrders = await DB.getOrders();
      if (dbOrders.length > 0) {
        _data = dbOrders;
        localStorage.setItem('becca_orders', JSON.stringify(_data));
      } else {
        const s = localStorage.getItem('becca_orders');
        _data = s ? JSON.parse(s) : [];
      }

      // Pre-cache customers so order form dropdown works on any device
      DB.getCustomers().then(custs => {
        if (custs.length) localStorage.setItem('becca_customers', JSON.stringify(custs));
      }).catch(() => {});
    } catch(e) {
      console.warn('[Order] init error:', e);
      const s = localStorage.getItem('becca_orders');
      _data = s ? JSON.parse(s) : [];
      _cols = JSON.parse(JSON.stringify(_defaultCols));
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
        <button class="btn btn-ghost" onclick="OrderModule.openColManager()" style="font-size:12px">
          ⚙ Kelola Kolom
        </button>
        <button class="btn btn-primary" onclick="OrderModule.openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          Tambah Order
        </button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px">
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
      <div id="ord-pagination"></div>
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

    const total   = list.length;
    const totalPg = Math.max(1, Math.ceil(total / _perPage));
    if (_page > totalPg) _page = totalPg;
    const paged   = list.slice((_page - 1) * _perPage, _page * _perPage);

    const ct = document.getElementById('ord-count');
    if (ct) ct.textContent = total + ' order';

    const tbody = document.getElementById('ord-tbody');
    if (!tbody) { _renderFull(); return; }

    if (!paged.length) {
      const span = 5 + _cols.length + 2;
      tbody.innerHTML = `<tr><td colspan="${span}" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data order.</td></tr>`;
    } else {
      tbody.innerHTML = paged.map((o, i) => {
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
        <td class="ord-td" style="font-size:10px;color:var(--text-3);background:${bg}">${(_page-1)*_perPage+i+1}</td>
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

    const pg = document.getElementById('ord-pagination');
    if (pg) pg.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;font-size:12px;color:var(--text-3);border-top:1px solid var(--border)">
        <span>Hal ${_page}/${totalPg} · ${total} order</span>
        <div style="display:flex;gap:4px;align-items:center">
          <select onchange="OrderModule.setPerPage(+this.value)"
            style="padding:3px 6px;border:1px solid var(--border);border-radius:5px;
                   background:var(--surface2);color:var(--text);font-size:11px;cursor:pointer">
            ${[20,50,100].map(n=>`<option value="${n}" ${_perPage===n?'selected':''}>${n}/hal</option>`).join('')}
          </select>
          <button class="btn btn-sm" onclick="OrderModule.goPage(1)" ${_page===1?'disabled':''}>«</button>
          <button class="btn btn-sm" onclick="OrderModule.goPage(${_page-1})" ${_page===1?'disabled':''}>‹</button>
          <button class="btn btn-sm" onclick="OrderModule.goPage(${_page+1})" ${_page===totalPg?'disabled':''}>›</button>
          <button class="btn btn-sm" onclick="OrderModule.goPage(${totalPg})" ${_page===totalPg?'disabled':''}>»</button>
        </div>
      </div>`;
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
      DB.saveOrder({...ord}).catch(e => console.warn('[Order] saveOrder edit:', e));
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
  async function deleteOrder(id) {
    const o = _data.find(x=>x.id===id);
    if (!o) return;
    if (o.invoiced) { Notify.warning('Order sudah di-invoice, tidak bisa dihapus'); return; }
    const ok = await Modal.confirm({
      title: 'Hapus Order',
      message: `Hapus order <strong>${o.namaPerusahaan}</strong> (${o.tglOrder})?`,
      confirmText: 'Hapus',
      danger: true,
    });
    if (!ok) return;
    _data = _data.filter(x=>x.id!==id);
    _save();
    DB.deleteOrder(id).catch(e => console.warn('[Order] deleteOrder:', e));
    _renderTbody();
    Notify.success('Order dihapus');
  }

  /* ─── TAMBAH ORDER ─── */
  function openModal() {
    const mid   = Utils.uid();
    const today    = new Date().toISOString().slice(0,10);
    const cu       = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
    const pelapor  = cu?.nama || cu?.username || cu?.name || '';
    // number field helper
    const nf = (id, lbl, color='var(--text-2)') =>
      `<div class="form-group" style="min-width:0">
        <label class="form-label" style="color:${color};font-size:11px">${lbl}</label>
        <input class="form-control of-num" id="${id}" type="number" min="0" value="0"
          style="text-align:center;font-family:var(--font-mono);padding:6px 4px"
          oninput="OrderModule._ofCheck('${mid}')"
          onfocus="if(this.value==='0')this.value=''"
          onblur="if(this.value==='')this.value='0'">
      </div>`;

    Modal.open({
      id: mid,
      title: 'Tambah Order Catering',
      size: 'modal-lg',
      body: `
        <style>
          .of-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
            color:var(--text-3);padding:8px 0 4px;border-top:1px solid var(--border);margin-top:6px}
          .of-row2{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)}
          .of-row-cust{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)}
          .of-nums{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
          @media(max-width:540px){
            .of-row2,.of-row-cust{grid-template-columns:1fr}
            .of-nums{grid-template-columns:repeat(3,1fr)}
          }
        </style>
        <div class="of-row2">
          <div class="form-group"><label class="form-label">Tanggal Order *</label>
            <input class="form-control" id="of-tgl" type="date" value="${today}">
          </div>
          <div class="form-group"><label class="form-label">Jenis Orderan</label>
            <select class="form-control" id="of-jenis">
              <option value="real orderan">Real Orderan</option>
              <option value="estimasi orderan">Estimasi Orderan</option>
            </select>
          </div>
        </div>
        <div class="of-row-cust">
          <div class="form-group" style="position:relative">
            <label class="form-label">Nama Perusahaan <span style="color:#ef4444">*</span></label>
            <input id="of-cust-inp-${mid}" class="form-control" type="text"
              placeholder="— Pilih Customer —" autocomplete="off"
              style="font-size:14px;padding:9px 10px"
              oninput="OrderModule._ofCustFilter('${mid}')"
              onfocus="OrderModule._ofCustShow('${mid}')"
              onblur="setTimeout(()=>OrderModule._ofCustHide('${mid}'),160)">
            <input type="hidden" id="of-cust">
            <div id="of-cust-dd-${mid}" style="display:none;position:absolute;left:0;right:0;top:100%;
              z-index:9999;background:var(--surface);border:1px solid var(--border);
              border-radius:var(--radius);max-height:200px;overflow-y:auto;
              box-shadow:0 8px 24px rgba(0,0,0,.15)"></div>
          </div>
          <div class="form-group"><label class="form-label">Pelapor</label>
            <input class="form-control" id="of-pelapor" value="${pelapor}" readonly
              style="background:var(--surface2);color:var(--text-2);cursor:default">
          </div>
        </div>
        <div class="of-sec" style="color:#6366f1">☀ Breakfast & Shift 1</div>
        <div class="of-nums">
          ${nf('of-bf','Breakfast','var(--warning)')}${nf('of-s1','Shift 1','#6366f1')}${nf('of-sp1','Spare 1','#6366f1')}${nf('of-ot1','OT 1','#6366f1')}${nf('of-snk1','Snack 1','#6366f1')}
        </div>
        <div class="of-sec" style="color:#10b981">🟢 Shift 2</div>
        <div class="of-nums">
          ${nf('of-s2','Shift 2','#10b981')}${nf('of-sp2','Spare 2','#10b981')}${nf('of-ot2','OT 2','#10b981')}${nf('of-snk2','Snack 2','#10b981')}
        </div>
        <div class="of-sec" style="color:#f59e0b">🟡 Shift 3</div>
        <div class="of-nums">
          ${nf('of-s3','Shift 3','#f59e0b')}${nf('of-sp3','Spare 3','#f59e0b')}${nf('of-ot3','OT 3','#f59e0b')}${nf('of-snk3','Snack 3','#f59e0b')}
        </div>
        <div class="of-sec" style="color:#ec4899">🍱 Snack Berat</div>
        <div class="of-nums">
          ${nf('of-snkb','Snack Berat','#ec4899')}
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button id="of-save-${mid}" class="btn btn-primary" disabled
          style="opacity:.45;cursor:not-allowed"
          onclick="OrderModule._submitOrder('${mid}')">Simpan Order</button>`,
    });
  }

  // Searchable customer autocomplete helpers
  function _ofCustFilter(mid) {
    const inp = document.getElementById('of-cust-inp-' + mid);
    const dd  = document.getElementById('of-cust-dd-' + mid);
    const hid = document.getElementById('of-cust');
    if (!inp || !dd) return;
    if (hid) hid.value = '';
    _ofCheck(mid);
    const q = inp.value.toLowerCase();
    const custs = _getCustomers();
    const filtered = q ? custs.filter(c => c.nama.toLowerCase().includes(q) || (c.namaShort||'').toLowerCase().includes(q)) : custs;
    dd.innerHTML = filtered.length
      ? filtered.map(c => {
          const safe = c.nama.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
          const short = c.namaShort || '';
          return `<div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px"
            onmousedown="OrderModule._ofCustSelect('${mid}','${safe}')"
            onmouseover="this.style.background='var(--surface2)'"
            onmouseout="this.style.background=''">
            ${short ? `<span style="font-size:12px;font-weight:700;color:var(--primary);min-width:50px">${short}</span>` : ''}
            <span style="font-size:12px;color:var(--text)">${c.nama}</span>
          </div>`;
        }).join('')
      : `<div style="padding:9px 12px;color:var(--text-3);font-size:14px">Tidak ada hasil</div>`;
    dd.style.display = 'block';
  }

  function _ofCustShow(mid) {
    _ofCustFilter(mid);
  }

  function _ofCustHide(mid) {
    const dd  = document.getElementById('of-cust-dd-' + mid);
    const inp = document.getElementById('of-cust-inp-' + mid);
    const hid = document.getElementById('of-cust');
    if (dd) dd.style.display = 'none';
    // If typed text doesn't match any customer exactly, clear value
    if (inp && hid) {
      const custs = _getCustomers();
      if (!custs.some(c => c.nama === inp.value)) {
        inp.value = '';
        hid.value = '';
        _ofCheck(mid);
      }
    }
  }

  function _ofCustSelect(mid, val) {
    const inp = document.getElementById('of-cust-inp-' + mid);
    const hid = document.getElementById('of-cust');
    const dd  = document.getElementById('of-cust-dd-' + mid);
    if (inp) inp.value = val;
    if (hid) hid.value = val;
    if (dd)  dd.style.display = 'none';
    _ofCheck(mid);
  }

  // Cek apakah tombol Simpan boleh aktif
  function _ofCheck(mid) {
    const btn  = document.getElementById('of-save-' + mid);
    if (!btn) return;
    const cust = document.getElementById('of-cust')?.value || '';
    const hasQty = [...document.querySelectorAll('.of-num')].some(el => parseInt(el.value, 10) > 0);
    const ok = !!cust && hasQty;
    btn.disabled = !ok;
    btn.style.opacity  = ok ? '1'   : '.45';
    btn.style.cursor   = ok ? 'pointer' : 'not-allowed';
  }

  function _submitOrder(mid) {
    const g = id => document.getElementById(id)?.value?.trim()||'';
    const n = id => parseInt(document.getElementById(id)?.value, 10)||0;
    const tgl = g('of-tgl'), cust = g('of-cust');
    if (!tgl)  { Notify.warning('Tanggal order wajib diisi'); return; }
    if (!cust) { Notify.warning('Pilih nama perusahaan'); return; }
    window._ordFormMid = mid; // simpan untuk Modal.close di _saveOrder
    const now = new Date();
    const ts  = now.toISOString().slice(0,10)+' '+now.toTimeString().slice(0,8);
    const newOrder = {
      id:'ord_'+Date.now(), timestamp:ts,
      pelapor:g('of-pelapor'), tglOrder:tgl, namaPerusahaan:cust,
      catatan:g('of-jenis') || 'real orderan',
      breakfast:n('of-bf'),
      shift1:n('of-s1'), spare1:n('of-sp1'), ot1:n('of-ot1'), snack1:n('of-snk1'),
      shift2:n('of-s2'), spare2:n('of-sp2'), ot2:n('of-ot2'), snack2:n('of-snk2'),
      shift3:n('of-s3'), spare3:n('of-sp3'), ot3:n('of-ot3'), snack3:n('of-snk3'),
      snackBerat:n('of-snkb'),
    };

    // Cek duplikat: tanggal + customer sama
    const existing = _data.find(o => o.tglOrder === tgl && o.namaPerusahaan === cust);
    if (existing) {
      _showDuplicateConfirm(existing, newOrder);
      return;
    }
    _saveOrder(newOrder, null);
  }

  function _orderSummaryHtml(o, label, color) {
    const row = (lbl, val, hi) => val
      ? `<tr style="${hi?'background:rgba(99,102,241,.07)':''}">
           <td style="padding:3px 8px;font-size:11px;color:var(--text-3);white-space:nowrap">${lbl}</td>
           <td style="padding:3px 8px;font-size:12px;font-weight:600;font-family:var(--font-mono);text-align:right">${val}</td>
         </tr>` : '';
    const fields = [
      ['Breakfast',   o.breakfast],
      ['Shift 1',     o.shift1],   ['Spare 1', o.spare1],   ['OT 1',  o.ot1],   ['Snack 1', o.snack1],
      ['Shift 2',     o.shift2],   ['Spare 2', o.spare2],   ['OT 2',  o.ot2],   ['Snack 2', o.snack2],
      ['Shift 3',     o.shift3],   ['Spare 3', o.spare3],   ['OT 3',  o.ot3],   ['Snack 3', o.snack3],
      ['Snack Berat', o.snackBerat],
    ];
    const rows = fields.filter(([,v]) => v > 0).map(([l,v]) => row(l, v)).join('');
    return `
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                    color:${color};margin-bottom:6px;padding:4px 8px;background:${color}18;border-radius:6px">${label}</div>
        <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">
          ${o.tglOrder} · ${o.catatan||'—'} · Pelapor: ${o.pelapor||'—'}
        </div>
        ${rows ? `<table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:8px;overflow:hidden">${rows}</table>`
               : `<div style="padding:12px;text-align:center;font-size:12px;color:var(--text-3);background:var(--surface2);border-radius:8px">Semua nilai 0</div>`}
      </div>`;
  }

  function _showDuplicateConfirm(existing, newOrder) {
    const mid = 'ord-dup-' + Date.now();
    Modal.open({
      id: mid,
      title: '⚠ Order Sudah Ada — Perbarui?',
      size: 'modal-lg',
      body: `
        <div style="padding:10px 0 14px;font-size:13px;color:var(--text-2)">
          Order <strong>${newOrder.namaPerusahaan}</strong> tanggal <strong>${newOrder.tglOrder}</strong>
          sudah ada. Apakah Anda ingin memperbarui dengan data baru?
        </div>
        <div style="display:flex;gap:16px;align-items:flex-start">
          ${_orderSummaryHtml(existing, '📋 Order Lama', '#6b7280')}
          <div style="display:flex;align-items:center;padding-top:28px;color:var(--text-3);font-size:18px">→</div>
          ${_orderSummaryHtml(newOrder,  '✏ Order Baru', '#6366f1')}
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="OrderModule._confirmUpdate('${existing.id}','${mid}')">Ya, Perbarui Order</button>`,
    });
    // Simpan newOrder ke buffer sementara
    window._ordPendingNew = newOrder;
  }

  function _confirmUpdate(existingId, modalId) {
    const newOrder = window._ordPendingNew;
    if (!newOrder) return;
    delete window._ordPendingNew;
    Modal.close(modalId);
    if (window._ordFormMid) { Modal.close(window._ordFormMid); delete window._ordFormMid; }
    _saveOrder(newOrder, existingId);
  }

  function _saveOrder(newOrder, replaceId) {
    if (replaceId) {
      newOrder.id = replaceId;
      const i = _data.findIndex(o => o.id === replaceId);
      if (i >= 0) _data[i] = newOrder; else _data.push(newOrder);
      Notify.success('Order diperbarui', newOrder.namaPerusahaan);
    } else {
      _data.push(newOrder);
      Notify.success('Order berhasil ditambahkan');
    }
    if (window._ordFormMid) { Modal.close(window._ordFormMid); delete window._ordFormMid; }
    _save();
    DB.saveOrder({...newOrder}).catch(e => console.warn('[Order] saveOrder:', e));
    _renderFull();
  }

  /* ─── REFRESH / CONTROLS ─── */
  // Reload _data dari localStorage (dipanggil saat modul lain mengubah becca_orders)
  function refreshFromStorage() {
    try {
      const s = localStorage.getItem('becca_orders');
      _data = s ? JSON.parse(s) : [];
    } catch(e) {}
    _renderTbody();
  }

  /* ─── CONTROLS ─── */
  function setSearch(val)          { _search = (val||'').toLowerCase().trim(); _page = 1; _renderTbody(); }
  function setFilterCustomer(val)  { _filterCustomer = val; _page = 1; _renderTbody(); }
  function setFilterDate(val)      { _filterDate = val; _page = 1; _renderTbody(); }
  function goPage(p)               { _page = p; _renderTbody(); }
  function setPerPage(n)           { _perPage = n; localStorage.setItem('becca_ord_perPage', n); _page = 1; _renderTbody(); }

  return {
    init, openModal, _submitOrder, _ofCheck, _confirmUpdate,
    _ofCustFilter, _ofCustShow, _ofCustHide, _ofCustSelect,
    openColManager, _setColLabel, _setColGroup, _setColEditable, _removeCol, _addCol, _resetCols,
    editHeader, _saveHdr,
    startEdit, deleteOrder,
    setSearch, setFilterCustomer, setFilterDate,
    goPage, setPerPage,
    refreshFromStorage,
  };
})();

window.OrderModule = OrderModule;
