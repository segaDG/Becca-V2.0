/* ============================================
   BECCA V2.0 — Order Module
   Fix: dropdown customer dari becca_customers,
        search tidak reset focus, format tabel benar,
        pelapor + timestamp, data dari Excel order engine
============================================ */

const OrderModule = (() => {
  let _data   = [];
  let _search = '';
  let _filterDate = '';
  let _filterCust = '';

  /* ── HELPERS ── */
  function _num(v) { return (Number(v) || 0); }
  function _fmtDate(s) {
    if (!s) return '-';
    try {
      return new Date(s).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'});
    } catch(e) { return s; }
  }
  function _fmtTs(s) {
    if (!s) return '-';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'}) + ' '
           + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
    } catch(e) { return s; }
  }
  function _getCustomers() {
    try {
      const saved = JSON.parse(localStorage.getItem('becca_customers') || '[]');
      return saved.map(c => c.nama).filter(Boolean).sort();
    } catch(e) { return []; }
  }

  /* ── INIT ── */
  async function init() {
    const page = document.getElementById('page-order');
    if (!page) return;
    try {
      const saved = localStorage.getItem('becca_orders');
      _data = saved ? JSON.parse(saved) : [];
    } catch(e) { _data = []; }
    _renderFull(page);
  }

  /* ── FULL RENDER — hanya dipanggil sekali / setelah add/edit ── */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-order');
    if (!page) return;

    const canEdit = typeof Auth !== 'undefined' ? Auth.can('order','edit') : true;
    const customers = _getCustomers();

    // Unique customers dari data untuk filter
    const custList = [...new Set(_data.map(o => o.namaPerusahaan).filter(Boolean))].sort();
    // Unique dates untuk filter
    const dateList = [...new Set(_data.map(o => o.tglOrder).filter(Boolean))].sort().reverse();

    page.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h2>Data Order Catering</h2>
        <p>Rekap orderan harian per perusahaan — ${_data.length} record</p>
      </div>
      ${canEdit ? `<div class="page-header-right">
        <button class="btn btn-primary" onclick="OrderModule.openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          Tambah Order
        </button>
      </div>` : ''}
    </div>

    <style>
      /* ── ORDER TABLE ── */
      #ord-table { width:100%; border-collapse:collapse; font-size:11px; min-width:1400px }
      .ord-th { padding:8px 10px; font-size:10px; font-weight:700; text-transform:uppercase;
                color:#fff; white-space:nowrap; background:var(--primary-h) }
      .ord-th-grp { padding:5px 10px; font-size:9px; font-weight:700; text-transform:uppercase;
                    color:#9ca3af; text-align:center; letter-spacing:.08em }
      .ord-td { padding:7px 10px; border-bottom:1px solid var(--border) }
      .num-cell { text-align:right; font-family:var(--font-mono) }
      .zero-cell { color:var(--text-3) }
    </style>

    <!-- FILTER BAR — tidak di-render ulang saat search -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">

        <!-- SEARCH — oninput hanya update tbody bukan seluruh page -->
        <div style="position:relative;flex:1;max-width:260px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"
            style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-3)">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input id="ord-search" placeholder="Cari perusahaan / pelapor..."
            value="${_search}"
            style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;
                   background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
            oninput="OrderModule.setSearch(this.value)">
        </div>

        <!-- FILTER CUSTOMER -->
        <select onchange="OrderModule.setFilterCust(this.value)"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);cursor:pointer;max-width:200px">
          <option value="">Semua Customer</option>
          ${custList.map(c=>`<option value="${c}" ${_filterCust===c?'selected':''}>${c}</option>`).join('')}
        </select>

        <!-- FILTER TANGGAL -->
        <select onchange="OrderModule.setFilterDate(this.value)"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);cursor:pointer">
          <option value="">Semua Tanggal</option>
          ${dateList.map(d=>`<option value="${d}" ${_filterDate===d?'selected':''}>${_fmtDate(d)}</option>`).join('')}
        </select>

        <span id="ord-count" style="font-size:11px;color:var(--text-3);margin-left:auto">${_data.length} order</span>
      </div>

      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table id="ord-table">
          <thead>
            <!-- GROUP HEADER -->
            <tr style="background:#1e1e2e">
              <th class="ord-th-grp" colspan="5" style="text-align:left;border-right:1px solid rgba(255,255,255,.07)">INFO ORDER</th>
              <th class="ord-th-grp" colspan="1" style="background:#1a2a1a;border-right:1px solid rgba(255,255,255,.07)">BFAST</th>
              <th class="ord-th-grp" colspan="4" style="background:#1a2f1a;border-right:1px solid rgba(255,255,255,.07)">SHIFT 1</th>
              <th class="ord-th-grp" colspan="4" style="background:#2f1a1a;border-right:1px solid rgba(255,255,255,.07)">SHIFT 2</th>
              <th class="ord-th-grp" colspan="4" style="background:#1a2a2f;border-right:1px solid rgba(255,255,255,.07)">SHIFT 3</th>
              <th class="ord-th-grp" colspan="1" style="background:#2f2a1a;border-right:1px solid rgba(255,255,255,.07)">SNACK BERAT</th>
              <th class="ord-th-grp" colspan="1">CATATAN</th>
              ${canEdit ? '<th class="ord-th-grp" colspan="1"></th>' : ''}
            </tr>
            <!-- KOLOM HEADER -->
            <tr>
              <th class="ord-th" style="width:36px;text-align:center">#</th>
              <th class="ord-th" style="min-width:160px">Nama Perusahaan</th>
              <th class="ord-th" style="width:95px;text-align:center">Tgl Order</th>
              <th class="ord-th" style="min-width:130px">Pelapor</th>
              <th class="ord-th" style="width:130px">Timestamp</th>
              <th class="ord-th" style="width:55px;text-align:right;background:rgba(16,185,129,.15)">Bfast</th>
              <th class="ord-th" style="width:55px;text-align:right">Shift 1</th>
              <th class="ord-th" style="width:55px;text-align:right">Spare 1</th>
              <th class="ord-th" style="width:50px;text-align:right">OT 1</th>
              <th class="ord-th" style="width:55px;text-align:right">Snack 1</th>
              <th class="ord-th" style="width:55px;text-align:right">Shift 2</th>
              <th class="ord-th" style="width:55px;text-align:right">Spare 2</th>
              <th class="ord-th" style="width:50px;text-align:right">OT 2</th>
              <th class="ord-th" style="width:55px;text-align:right">Snack 2</th>
              <th class="ord-th" style="width:55px;text-align:right">Shift 3</th>
              <th class="ord-th" style="width:55px;text-align:right">Spare 3</th>
              <th class="ord-th" style="width:50px;text-align:right">OT 3</th>
              <th class="ord-th" style="width:55px;text-align:right">Snack 3</th>
              <th class="ord-th" style="width:75px;text-align:right;background:rgba(245,158,11,.15)">Snack Berat</th>
              <th class="ord-th" style="min-width:140px">Catatan</th>
              ${canEdit ? '<th class="ord-th" style="width:52px"></th>' : ''}
            </tr>
          </thead>
          <tbody id="ord-tbody"></tbody>
        </table>
      </div>
    </div>`;

    _renderTbody(canEdit);
  }

  /* ── PARTIAL RENDER — hanya tbody, input tidak disentuh ── */
  function _renderTbody(canEdit) {
    if (canEdit === undefined) canEdit = typeof Auth !== 'undefined' ? Auth.can('order','edit') : true;

    let list = [..._data].sort((a,b) => {
      const da = a.tglOrder||'', db = b.tglOrder||'';
      return db.localeCompare(da);
    });

    const s = _search.toLowerCase();
    if (s) list = list.filter(o =>
      (o.namaPerusahaan||'').toLowerCase().includes(s) ||
      (o.pelapor||'').toLowerCase().includes(s));
    if (_filterCust) list = list.filter(o => o.namaPerusahaan === _filterCust);
    if (_filterDate) list = list.filter(o => o.tglOrder === _filterDate);

    const countEl = document.getElementById('ord-count');
    if (countEl) countEl.textContent = list.length + ' order';

    const tbody = document.getElementById('ord-tbody');
    if (!tbody) { _renderFull(); return; }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="21" style="text-align:center;padding:48px;color:var(--text-3)">Tidak ada data order.</td></tr>`;
      return;
    }

    const HOV = 'rgba(99,102,241,.07)';

    tbody.innerHTML = list.map((o, i) => {
      const bg = i%2===0 ? 'var(--surface)' : 'var(--surface2)';

      function td(val, extra) {
        const n = _num(val);
        const zero = n === 0;
        return `<td class="ord-td num-cell${zero?' zero-cell':''}" style="background:${bg}${extra||''}">${zero ? '-' : n}</td>`;
      }

      return `<tr
        onmouseenter="this.querySelectorAll('td').forEach(function(t){t.dataset.ori=t.style.background;t.style.background='${HOV}'})"
        onmouseleave="this.querySelectorAll('td').forEach(function(t){t.style.background=t.dataset.ori})"
      >
        <td class="ord-td" style="text-align:center;font-size:10px;color:var(--text-3);background:${bg}">${i+1}</td>
        <td class="ord-td" style="font-weight:600;font-size:12px;background:${bg}">${o.namaPerusahaan||'-'}</td>
        <td class="ord-td" style="text-align:center;font-size:11px;white-space:nowrap;background:${bg}">${_fmtDate(o.tglOrder)}</td>
        <td class="ord-td" style="font-size:11px;color:var(--text-2);background:${bg}">${o.pelapor||'-'}</td>
        <td class="ord-td" style="font-size:10px;color:var(--text-3);white-space:nowrap;background:${bg}">${_fmtTs(o.tglInput)}</td>
        ${td(o.breakfast,';background:rgba(16,185,129,.05)')}
        ${td(o.shift1)} ${td(o.spare1)} ${td(o.ot1)} ${td(o.snack1)}
        ${td(o.shift2)} ${td(o.spare2)} ${td(o.ot2)} ${td(o.snack2)}
        ${td(o.shift3)} ${td(o.spare3)} ${td(o.ot3)} ${td(o.snack3)}
        ${td(o.snackBerat,';background:rgba(245,158,11,.05)')}
        <td class="ord-td" style="font-size:10px;color:var(--text-3);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:${bg}">${o.catatan||'-'}</td>
        ${canEdit ? `<td class="ord-td" style="text-align:center;background:${bg}">
          <button onclick="OrderModule.openModal('${o.id}')"
            style="width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);display:inline-flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/>
            </svg>
          </button>
        </td>` : ''}
      </tr>`;
    }).join('');
  }

  /* ── MODAL TAMBAH/EDIT ── */
  function openModal(id) {
    const o = id ? _data.find(x=>x.id===id) : null;
    const fv = f => o?.[f] ?? '';
    const nv = f => o?.[f] || 0;
    const customers = _getCustomers();
    const today = new Date().toISOString().split('T')[0];

    const numField = (field, label, color) => `
      <div class="form-group">
        <label class="form-label" style="color:${color||'var(--text-2)'}">${label}</label>
        <input id="of-${field}" type="number" min="0" class="form-control" value="${nv(field)}"
          style="text-align:right;font-family:var(--font-mono)">
      </div>`;

    Modal.open({
      title: o ? 'Edit Order' : 'Tambah Order',
      size: 'modal-xl',
      body: `
      <style>
        .modal-xl { max-width:860px !important }
        .of-sec { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
                  color:var(--text-3);padding:10px 0 6px;border-top:1px solid var(--border);margin-top:4px }
        .of-grid4 { display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3) }
        .of-grid5 { display:grid;grid-template-columns:repeat(5,1fr);gap:var(--s3) }
      </style>

      <div class="of-sec" style="border-top:none;padding-top:0">Info Order</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--s3)">
        <div class="form-group">
          <label class="form-label">Nama Perusahaan <span style="color:var(--danger)">*</span></label>
          <select class="form-control" id="of-namaPerusahaan">
            <option value="">— Pilih Customer —</option>
            ${customers.map(c=>`<option value="${c}" ${fv('namaPerusahaan')===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tanggal Order <span style="color:var(--danger)">*</span></label>
          <input id="of-tglOrder" type="date" class="form-control" value="${fv('tglOrder')||today}">
        </div>
        <div class="form-group">
          <label class="form-label">Pelapor</label>
          <input id="of-pelapor" class="form-control" value="${fv('pelapor')}" placeholder="Nama pelapor...">
        </div>
      </div>

      <div class="of-sec">Breakfast</div>
      <div class="of-grid4">
        ${numField('breakfast','Breakfast','#f59e0b')}
        <div></div><div></div><div></div>
      </div>

      <div class="of-sec">Shift 1</div>
      <div class="of-grid4">
        ${numField('shift1','Shift 1','#6366f1')}
        ${numField('spare1','Spare 1','#6366f1')}
        ${numField('ot1','OT 1','#6366f1')}
        ${numField('snack1','Snack 1','#6366f1')}
      </div>

      <div class="of-sec">Shift 2</div>
      <div class="of-grid4">
        ${numField('shift2','Shift 2','#10b981')}
        ${numField('spare2','Spare 2','#10b981')}
        ${numField('ot2','OT 2','#10b981')}
        ${numField('snack2','Snack 2','#10b981')}
      </div>

      <div class="of-sec">Shift 3</div>
      <div class="of-grid5">
        ${numField('shift3','Shift 3','#f59e0b')}
        ${numField('spare3','Spare 3','#f59e0b')}
        ${numField('ot3','OT 3','#f59e0b')}
        ${numField('snack3','Snack 3','#f59e0b')}
        ${numField('snackBerat','Snack Berat','#ef4444')}
      </div>

      <div class="of-sec">Catatan</div>
      <div class="form-group">
        <input class="form-control" id="of-catatan" value="${fv('catatan')}" placeholder="Catatan tambahan...">
      </div>`,
      buttons: [
        {label:'Batal', class:'btn-ghost', onclick:'Modal.close()'},
        {label: o?'Simpan Perubahan':'Tambah Order', class:'btn-primary',
         onclick:`OrderModule._submit('${o?.id||''}')`}
      ]
    });
  }

  function _submit(id) {
    const g = sel => document.getElementById(sel)?.value?.trim() || '';
    const n = sel => parseInt(document.getElementById(sel)?.value) || 0;

    const nama = g('of-namaPerusahaan');
    const tgl  = g('of-tglOrder');
    if (!nama) { Notify.warning('Nama perusahaan wajib diisi'); return; }
    if (!tgl)  { Notify.warning('Tanggal order wajib diisi'); return; }

    const now = new Date().toISOString().replace('T',' ').substring(0,19);
    const currentUser = typeof Auth !== 'undefined' ? (Auth.user()?.name || Auth.user()?.username || '') : '';

    const obj = {
      id: id || Utils.uid(),
      tglOrder: tgl,
      tglInput: id ? ((_data.find(x=>x.id===id)?.tglInput) || now) : now,
      pelapor: g('of-pelapor') || currentUser,
      namaPerusahaan: nama,
      breakfast: n('of-breakfast'),
      shift1: n('of-shift1'), spare1: n('of-spare1'), ot1: n('of-ot1'), snack1: n('of-snack1'),
      shift2: n('of-shift2'), spare2: n('of-spare2'), ot2: n('of-ot2'), snack2: n('of-snack2'),
      shift3: n('of-shift3'), spare3: n('of-spare3'), ot3: n('of-ot3'), snack3: n('of-snack3'),
      snackBerat: n('of-snackBerat'),
      catatan: g('of-catatan'),
    };

    if (id) {
      const i = _data.findIndex(x=>x.id===id);
      if (i>=0) _data[i]=obj; else _data.push(obj);
    } else {
      _data.push(obj);
    }

    localStorage.setItem('becca_orders', JSON.stringify(_data));
    Modal.close();
    Notify.success(id ? 'Order diperbarui' : 'Order berhasil ditambahkan');
    _renderFull();
  }

  /* ── CONTROLS — partial update saja, search tetap fokus ── */
  function setSearch(val) {
    _search = (val||'').toLowerCase().trim();
    _renderTbody();
  }
  function setFilterDate(val) {
    _filterDate = val;
    _renderTbody();
  }
  function setFilterCust(val) {
    _filterCust = val;
    _renderTbody();
  }

  return { init, openModal, _submit, setSearch, setFilterDate, setFilterCust };
})();

window.OrderModule = OrderModule;
