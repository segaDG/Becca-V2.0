/* ============================================
   BECCA V2.0 — Employee Module
   Karyawan data, logbook, employee card
============================================ */
const EmployeeModule = (() => {

  let _employees = [];
  let _logs      = [];
  let _activeTab = 'data';
  let _sortField = 'nama';
  let _sortDir   = 'asc';
  let _searchQ    = '';
  let _lbEditId   = null;   // logbook row sedang diedit
  let _lbLocked   = new Set(); // id yang terkunci
  const _LB_LOCK_KEY = 'becca_lb_locked_ids';
  let _filterStatus = '';
  let _filterDept   = '';
  let _selectedEmpId = null;  // for card view

  const _EMP_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6'];
  function _empColor(nama) {
    let h = 0;
    for (const c of (nama||'?')) h = h*31 + c.charCodeAt(0);
    return _EMP_COLORS[Math.abs(h) % _EMP_COLORS.length];
  }
  function _empAvatar(emp, size) {
    const sz = size || 32;
    const initials = (emp.nama||'?').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
    const color = _empColor(emp.nama);
    // Google Drive foto tidak bisa diakses langsung (CORS block) - gunakan inisial
    const _rawFoto = emp.fotoUrl || emp.thumb || emp.foto || emp.photo || '';
    const photoUrl = (_rawFoto && _rawFoto.startsWith('data:')) ? _rawFoto : '';
    if (photoUrl) {
      const eid = (emp.id||'').replace(/'/g,'');
      return '<img src="'+photoUrl+'" style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;object-fit:cover;cursor:zoom-in"'
        +' onclick="event.stopPropagation();EmployeeModule._viewPhoto(this.src)" title="Klik untuk perbesar">';
    }
    return '<div style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+color+';color:white;display:flex;align-items:center;justify-content:center;font-size:'+(sz*0.35)+'px;font-weight:700;flex-shrink:0">'+initials+'</div>';
  }

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-employee');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h2>Karyawan</h2><p>Data dan logbook karyawan</p></div>
        <div class="page-header-right">
          ${Auth.can('employee','edit') ? `
            <button class="btn btn-primary" onclick="EmployeeModule.openEmpModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg>
              Tambah Karyawan
            </button>` : ''}
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" id="emp-tab-btn-data"    data-tab="data"    onclick="EmployeeModule.switchTab('data')">👥 Data Karyawan</button>
        <button class="tab-btn"        id="emp-tab-btn-card"    data-tab="card"    onclick="EmployeeModule.switchTab('card')">🪪 Employee Card</button>
        ${Auth.can('emp_finance','view') ? `<button class="tab-btn" id="emp-tab-btn-logbook" data-tab="logbook" onclick="EmployeeModule.switchTab('logbook')">📋 Logbook</button>` : ''}
        <button class="tab-btn"        id="emp-tab-btn-arsip"   data-tab="arsip"   onclick="EmployeeModule.switchTab('arsip')">📁 Arsip</button>
      </div>
      <div id="emp-tab-data"></div>
      <div id="emp-tab-card"    class="hidden"></div>
      <div id="emp-tab-logbook" class="hidden"></div>
      <div id="emp-tab-arsip"   class="hidden"></div>
    `;

    // Snapshot LS SEBELUM _get() menimpa — foto hanya ada di LS sebelum overwrite
    let _lsEmpSnap = [];
    try { _lsEmpSnap = JSON.parse(localStorage.getItem('becca_employees') || '[]'); } catch {}

    // Skeleton
    const _skelEl = document.getElementById('emp-tab-data');
    if (_skelEl && !_employees.length) _skelEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation:spin 1s linear infinite;opacity:.4"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><div style="margin-top:12px;font-size:13px">Memuat data karyawan...</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

    [_employees, _logs] = await Promise.all([
      DB.getEmployees().catch(()=>[]),
      DB.getEmployeeLogs().catch(()=>[]),
    ]);
    _lbLoadLocks();
    // Auto-lock semua rows yang sudah ada saat init (setelah reload)
    _logs.forEach(l => _lbLocked.add(l.id));
    _lbSaveLocks();
    switchTab('data');
    // One-time: migrate photos from localStorage to Supabase (runs in background)
    migratePhotosFromLS(_lsEmpSnap).catch(() => {});
  }

  /* ===================== TAB SWITCH ===================== */
  function switchTab(tab) {
    _activeTab = tab;
    ['data','card','logbook','arsip'].forEach(t => {
      const el = document.getElementById('emp-tab-'+t);
      if (el) el.classList.toggle('hidden', t !== tab);
      const btn = document.getElementById('emp-tab-btn-'+t);
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'data')    renderData();
    if (tab === 'card')    renderCard(_selectedEmpId);
    if (tab === 'logbook') renderLogbook();
    if (tab === 'arsip')   renderArsip();
  }

  /* ===================== RENDER DATA ===================== */
  function renderData() {
    // Data karyawan = hanya yang aktif; Arsip = RESIGN/Fired/dll
    const ACTIVE_STATS = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const active   = _employees.filter(e => ACTIVE_STATS.includes(e.status));
    const depts    = [...new Set(active.map(e=>e.divisi||e.departemen).filter(Boolean))].sort();
    const canEdit    = Auth.can('employee','edit');
    const canFinance = Auth.can('emp_finance','view');

    // Apply filter
    let filtered = active;
    if (_filterStatus) filtered = filtered.filter(e=>e.status===_filterStatus);
    if (_filterDept)   filtered = filtered.filter(e=>(e.divisi||e.departemen)===_filterDept);
    if (_searchQ) {
      const q = _searchQ.toLowerCase();
      filtered = filtered.filter(e =>
        (e.nama||'').toLowerCase().includes(q) ||
        (e.nik||e.nip||'').toLowerCase().includes(q) ||
        (e.jabatan||'').toLowerCase().includes(q) ||
        (e.divisi||e.departemen||'').toLowerCase().includes(q) ||
        (e.panggilan||'').toLowerCase().includes(q)
      );
    }

    // Apply sort
    const _NUM_FIELDS = ['sisaHutang','gaji','gajiPokok','gajiAwal'];
    filtered = [...filtered].sort((a,b) => {
      // Handle field aliases
      const getVal = (e) => {
        if (_sortField==='departemen') return e.divisi||e.departemen||'';
        if (_sortField==='nip') return e.nik||e.nip||'';
        if (_sortField==='tglMasuk') return e.tglJoin||e.tglMasuk||'';
        if (_sortField==='gajiPokok') return e.gaji||e.gajiPokok||0;
        return e[_sortField]??'';
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (_NUM_FIELDS.includes(_sortField)) {
        const na = parseFloat(va)||0, nb = parseFloat(vb)||0;
        return _sortDir==='asc' ? na-nb : nb-na;
      }
      const sa = va.toString().toLowerCase();
      const sb = vb.toString().toLowerCase();
      return _sortDir==='asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    const sortIcon = (field) => _sortField===field
      ? (_sortDir==='asc' ? ' ↑' : ' ↓') : ' ⇅';

    document.getElementById('emp-tab-data').innerHTML = `
      <!-- Stats cards: Aktif + per Departemen -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:140px">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Aktif</div>
          <div style="font-size:18px;font-weight:700;color:var(--success);font-family:var(--font-mono)">${active.filter(e=>['AKTIF','ACTIVE','Active','Tetap'].includes(e.status)).length}</div>
        </div>
        ${depts.map(dept => {
          const count = active.filter(e=>(e.divisi||e.departemen)===dept).length;
          const deptEsc = dept.replace(/'/g,"\'");
          return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:120px;cursor:pointer"
            onclick="EmployeeModule.setFilter('dept','${deptEsc}')" title="Filter: ${dept}">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px">${dept}</div>
            <div style="font-size:18px;font-weight:700;color:var(--primary-h);font-family:var(--font-mono)">${count}</div>
          </div>`;
        }).join('')}
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:120px">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Tanpa Divisi</div>
          <div style="font-size:18px;font-weight:700;color:var(--text-2);font-family:var(--font-mono)">${active.filter(e=>!(e.divisi||e.departemen)).length}</div>
        </div>
      </div>


      ${canFinance ? `<!-- Total Gaji Card -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:var(--s3)">
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Total Gaji Keseluruhan</div>
          <div style="font-size:18px;font-weight:800;color:var(--primary-h);font-family:var(--font-mono);margin-top:2px">
            ${Utils.formatRupiah(active.reduce((s,e)=>s+(e.gaji||0),0),false)}
          </div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px">${active.length} karyawan aktif</div>
        </div>
        <div style="font-size:28px;opacity:.3">💰</div>
      </div>` : ''}

<!-- Filter & Sort -->
      <div class="filter-bar" style="margin-bottom:var(--s3)">
        <input type="text" class="form-control" id="emp-search-bar" style="width:200px"
          placeholder="🔍 Cari nama, jabatan, NIK..."
          oninput="EmployeeModule._searchEmp(this.value)">

        <select class="form-control" style="width:160px" onchange="EmployeeModule.setFilter('dept',this.value)">
          <option value="">Semua Departemen</option>
          ${depts.map(d=>`<option value="${d}" ${_filterDept===d?'selected':''}>${d}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="EmployeeModule.setFilter('reset')" title="Reset filter">↺</button>
        <span class="text-muted text-small" style="margin-left:auto">${filtered.length} karyawan</span>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table">
            <thead><tr>
              <th style="width:36px">#</th>
              <th onclick="EmployeeModule.sortBy('nama')" style="cursor:pointer">Nama${sortIcon('nama')}</th>
              <th onclick="EmployeeModule.sortBy('nik')"  style="cursor:pointer">NIK${sortIcon('nik')}</th>
              <th onclick="EmployeeModule.sortBy('jabatan')" style="cursor:pointer">Jabatan${sortIcon('jabatan')}</th>
              <th onclick="EmployeeModule.sortBy('divisi')" style="cursor:pointer">Divisi${sortIcon('divisi')}</th>
              <th onclick="EmployeeModule.sortBy('status')" style="cursor:pointer">Status${sortIcon('status')}</th>
              <th onclick="EmployeeModule.sortBy('tglJoin')" style="cursor:pointer">Tgl Join${sortIcon('tglJoin')}</th>
              ${canFinance ? `<th onclick="EmployeeModule.sortBy('gaji')" style="cursor:pointer">Gaji${sortIcon('gaji')}</th>` : ''}
              ${canFinance ? `<th onclick="EmployeeModule.sortBy('sisaHutang')" style="cursor:pointer">Hutang${sortIcon('sisaHutang')}</th>` : ''}
              ${canEdit ? '<th style="width:80px">Aksi</th>' : ''}
            </tr></thead>
            <tbody>
              ${filtered.length ? filtered.map((emp, i) => {
                // avatar handled by _empAvatar helper
                const _ACTIVE_STATUSES = ['AKTIF','ACTIVE','Active','Tetap'];
                const _WARN_STATUSES   = ['Kontrak','CONTRACT','Percobaan'];
                const _DANGER_STATUSES = ['RESIGN','Resign','Nonaktif'];
                const statusColor = _ACTIVE_STATUSES.includes(emp.status)?'badge-success'
                  : _WARN_STATUSES.includes(emp.status)?'badge-warning'
                  : _DANGER_STATUSES.includes(emp.status)?'badge-danger'
                  : 'badge-neutral';
                const logCount = _logs.filter(l=>((l.employeeId===emp.id||_nameMatch(l.nama,emp.nama))||_nameMatch(l.nama,emp.nama))).length;
                return `<tr style="cursor:pointer" onclick="EmployeeModule.viewCard('${emp.id}')"
                          onmouseover="this.style.background='var(--surface2)'"
                          onmouseout="this.style.background=''">
                  <td class="text-muted text-small">${i+1}</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      ${_empAvatar(emp, 32)}
                      <div>
                        <div style="font-weight:600">${emp.nama||''}</div>
                        ${emp.noHp ? `<div class="text-small text-muted">${emp.noHp}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="text-muted text-small">${emp.nik||emp.nip||'-'}</td>
                  <td>${emp.jabatan||'-'}</td>
                  <td><span class="badge badge-neutral">${emp.divisi||emp.departemen||'-'}</span></td>
                  <td onclick="event.stopPropagation()">${_statusDropdown(emp)}</td>
                  <td class="text-small text-muted">${_fmtTgl(emp.tglJoin||emp.tgl_join||emp.tglMasuk)}</td>
                  ${canFinance ? `<td class="text-small" style="font-family:var(--font-mono)">${emp.gaji?Utils.formatRupiah(emp.gaji,false):'-'}</td>` : ''}
                  ${canFinance ? `<td class="text-small" style="font-family:var(--font-mono);color:${(emp.sisaHutang||0)>0?'var(--warning)':'var(--text-3)'}">${emp.sisaHutang?Utils.formatRupiah(emp.sisaHutang,false):'-'}</td>` : ''}
                  ${canEdit ? `<td onclick="event.stopPropagation()">
                    <div style="display:flex;gap:4px">
                      <button class="btn-icon" title="Edit" onclick="EmployeeModule.openEmpModal('${emp.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                      </button>
                      <button class="btn-icon" title="Log (${logCount})" onclick="EmployeeModule.openLogModal('',('${emp.id}'))"
                        style="${logCount?'color:var(--primary-h)':''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>`;
              }).join('') : `<tr><td colspan="${7+(canFinance?2:0)+(canEdit?1:0)}" style="text-align:center;padding:40px;color:var(--text-3)">
                Belum ada data karyawan
              </td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _searchEmp(q) {
    _searchQ = q || '';
    // Render filtered tbody only, tidak re-render seluruh page
    _renderDataTable();
  }

  function setFilter(key, val) {
    if (key==='status') _filterStatus = val;
    else if (key==='dept') _filterDept = val;
    else if (key==='reset') { _filterStatus=''; _filterDept=''; }
    renderData();
  }

  function sortBy(field) {
    if (_sortField===field) _sortDir = _sortDir==='asc'?'desc':'asc';
    else { _sortField=field; _sortDir='asc'; }
    renderData();
  }

  function viewCard(empId) {
    _selectedEmpId = empId;
    switchTab('card');
  }

  /* ===================== RENDER CARD ===================== */
  function renderCard(empId) {
    const el = document.getElementById('emp-tab-card');
    const CARD_ACTIVE = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian','aktif'];
    const active = _employees.filter(e=>CARD_ACTIVE.includes(e.status));

    if (empId) {
      const emp = _employees.find(e=>e.id===empId);
      if (emp) {
        _renderSingleCard(el, emp);
        return;
      }
    }

    if (!active.length) {
      el.innerHTML = '<div class="empty-state" style="height:40vh"><h4>Belum ada data karyawan</h4></div>';
      return;
    }

    // Show all cards grid
    el.innerHTML = `
      <div style="margin-bottom:var(--s3)">
        <input type="text" class="form-control" style="max-width:300px" placeholder="Cari karyawan..."
          oninput="EmployeeModule.filterCards(this.value)" id="card-search">
      </div>
      <div id="cards-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s4)">
        ${active.map(emp => _cardHTML(emp)).join('')}
      </div>
    `;
  }

  function filterCards(q) {
    const lower = q.toLowerCase();
    const active = _employees.filter(e=>e.status!=='Arsip');
    const filtered = lower ? active.filter(e=>(e.nama||'').toLowerCase().includes(lower)||(e.jabatan||'').toLowerCase().includes(lower)) : active;
    const grid = document.getElementById('cards-grid');
    if (grid) grid.innerHTML = filtered.map(emp=>_cardHTML(emp)).join('');
  }

  function _cardHTML(emp) {
    const statusColor = ['AKTIF','ACTIVE','Active','Tetap'].includes(emp.status)?'var(--success)'
      : ['Kontrak','CONTRACT','Percobaan'].includes(emp.status)?'var(--warning)'
      : ['RESIGN','Resign'].includes(emp.status)?'var(--danger)'
      : 'var(--text-3)';
    const empLogs    = _logs.filter(l=>((l.employeeId===emp.id||_nameMatch(l.nama,emp.nama))||_nameMatch(l.nama,emp.nama))).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')).slice(0,3);
    const canEdit    = Auth.can('employee','edit');
    const canFinance = Auth.can('emp_finance','view');

    return `<div onclick="EmployeeModule.viewCard('${emp.id}')" style="cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);
                         overflow:hidden;transition:all .2s;"
                  onmouseover="this.style.borderColor='var(--primary)';this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
                  onmouseout="this.style.borderColor='var(--border)';this.style.transform='';this.style.boxShadow=''">

      <!-- Card Header -->
      <div style="background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.1));padding:20px;
                  display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border)">
        ${_empAvatar(emp, 52)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:15px;color:var(--heading);margin-bottom:2px">${emp.nama||''}</div>
          <div style="font-size:12px;color:var(--text-3)">${emp.jabatan||''} ${emp.departemen?'· '+emp.departemen:''}</div>
          <div style="margin-top:4px">
            <span style="font-size:10px;padding:2px 7px;border-radius:3px;font-weight:600;
              background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}30">${emp.status||'-'}</span>
          </div>
        </div>
      </div>

      <!-- Card Body -->
      <div style="padding:14px 16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          ${[
            {l:'NIK',        v:emp.nik||emp.nip||'-'},
            {l:'No. HP',     v:emp.noHp||'-'},
            {l:'Tgl Join',   v:_fmtTgl(emp.tglJoin||emp.tgl_join||emp.tglMasuk)},
            ...(canFinance ? [
              {l:'Gaji',       v:emp.gaji?Utils.formatRupiah(emp.gaji):(emp.gajiPokok?Utils.formatRupiah(emp.gajiPokok):'-')},
              {l:'Sisa Hutang',v:emp.sisaHutang?Utils.formatRupiah(emp.sisaHutang):'-'},
            ] : []),
          ].map(f=>`<div>
            <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em">${f.l}</div>
            <div style="font-size:12px;font-weight:500;color:var(--text)">${f.v}</div>
          </div>`).join('')}
        </div>

        <!-- Recent Logs -->
        ${empLogs.length ? `
          <div style="border-top:1px solid var(--border);padding-top:10px">
            <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Log Terbaru</div>
            ${empLogs.map(l=>`
              <div style="font-size:11px;color:var(--text-2);padding:3px 0;border-bottom:1px solid rgba(var(--border),0.5)">
                <span style="color:var(--text-3)">${l.tgl||''}</span> · ${l.keterangan||l.ket||l.catatan||'-'}
              </div>`).join('')}
          </div>` : ''}
      </div>

      <!-- Card Footer -->
      ${canEdit ? `<div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="EmployeeModule.openEmpModal('${emp.id}')">Edit</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="EmployeeModule.openLogModal('','${emp.id}')">+ Log</button>
      </div>` : ''}
    </div>`;
  }

  function _renderSingleCard(el, emp) {
    const empLogs = _logs.filter(l=>((l.employeeId===emp.id||_nameMatch(l.nama,emp.nama))||_nameMatch(l.nama,emp.nama))).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const canEdit    = Auth.can('employee','edit');
    const canFinance = Auth.can('emp_finance','view');
    const statusColor = ['AKTIF','ACTIVE','Active','Tetap'].includes(emp.status)?'var(--success)'
      : ['Kontrak','CONTRACT','Percobaan'].includes(emp.status)?'var(--warning)'
      : ['RESIGN','Resign'].includes(emp.status)?'var(--danger)'
      : 'var(--text-3)';

    el.innerHTML = `
      <div style="margin-bottom:var(--s3)">
        <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._selectedEmpId=null;EmployeeModule.renderCard()">
          ← Semua Karyawan
        </button>
      </div>
      <div style="display:grid;grid-template-columns:320px 1fr;gap:var(--s5);align-items:start">
        <!-- Profile Card -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
          <div style="background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.15));
                      padding:30px 20px;text-align:center;border-bottom:1px solid var(--border)">
            <div style="margin:0 auto 12px;display:flex;justify-content:center">
              ${_empAvatar(emp, 72)}
            </div>
            <div style="font-size:18px;font-weight:700;color:var(--heading)">${emp.nama||''}</div>
            <div style="font-size:13px;color:var(--text-3);margin-top:4px">${emp.jabatan||''}</div>
            <div style="margin-top:8px">
              <span style="font-size:11px;padding:3px 10px;border-radius:4px;font-weight:600;
                background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}30">
                ${emp.status||'-'}
              </span>
            </div>
          </div>
          <div style="padding:16px">
            ${[
              {l:'NIK',         v:emp.nik||emp.nip||'-'},
              {l:'Panggilan',   v:emp.panggilan||'-'},
              {l:'Divisi',      v:emp.divisi||emp.departemen||'-'},
              {l:'Jabatan',     v:emp.jabatan||'-'},
              {l:'No. HP',      v:emp.noHp||'-'},
              {l:'Tgl Lahir',   v:emp.tglLahir||'-'},
              {l:'Tempat Lahir',v:emp.tempatLahir||'-'},
              {l:'Agama',       v:emp.agama||'-'},
              {l:'Pendidikan',  v:emp.pendidikan||'-'},
              {l:'Tgl Join',    v:emp.tglJoin||emp.tglMasuk||'-'},
              ...(canFinance ? [
                {l:'Gaji',        v:emp.gaji?Utils.formatRupiah(emp.gaji):(emp.gajiPokok?Utils.formatRupiah(emp.gajiPokok):'-')},
                {l:'Gaji Awal',   v:emp.gajiAwal?Utils.formatRupiah(emp.gajiAwal):'-'},
                {l:'Sisa Hutang', v:emp.sisaHutang?Utils.formatRupiah(emp.sisaHutang):'-'},
              ] : []),
              {l:'No. Rekening',v:emp.noRek||'-'},
              {l:'KTP',         v:emp.ktp||'-'},
            ].map(f=>`
              <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:12px;color:var(--text-3)">${f.l}</span>
                <span style="font-size:12px;font-weight:500;color:var(--text);text-align:right;max-width:180px">${f.v}</span>
              </div>`).join('')}
          </div>
          ${canEdit ? `<div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="EmployeeModule.openEmpModal('${emp.id}')">Edit Data</button>
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="EmployeeModule.openLogModal('','${emp.id}')">+ Log</button>
          </div>` : ''}
        </div>

        <!-- Log History -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div style="font-size:14px;font-weight:700;color:var(--heading)">Riwayat Log (${empLogs.length})</div>
            ${canFinance ? (()=>{
              const tH = empLogs.reduce((s,l)=>s+(l.hutang||(l.jenis==='BERHUTANG'?l.jumlah:0)||0),0);
              const tB = empLogs.reduce((s,l)=>s+(l.bayar||(l.jenis==='BAYAR HUTANG'?l.jumlah:0)||0),0);
              const sisa = Math.max(0,tH-tB);
              return `<div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap">
                <span>Total Hutang: <strong style="color:var(--danger);font-family:var(--font-mono)">${Utils.formatRupiah(tH)}</strong></span>
                <span>Total Bayar: <strong style="color:var(--success);font-family:var(--font-mono)">${Utils.formatRupiah(tB)}</strong></span>
                <span>Sisa: <strong style="color:${sisa>0?'var(--danger)':'var(--success)'};font-family:var(--font-mono)">${Utils.formatRupiah(sisa)}</strong></span>
              </div>`;
            })() : ''}
          </div>
          ${canFinance && empLogs.length ? `
            <div class="table-scroll">
              <table class="table" style="font-size:13px">
                <thead><tr>
                  <th>Tanggal</th><th>Keterangan</th><th class="num" style="color:var(--danger)">Hutang</th><th class="num" style="color:var(--success)">Bayar</th><th style="text-align:center">Status</th>
                </tr></thead>
                <tbody>
                  ${empLogs.map(l=>{
                    const hutang = l.hutang||(l.jenis==='BERHUTANG'?l.jumlah:0)||0;
                    const bayar  = l.bayar ||(l.jenis==='BAYAR HUTANG'?l.jumlah:0)||0;
                    const tglFmt = (l.tgl||l.tanggal||'').slice(8,10)+'-'+(l.tgl||l.tanggal||'').slice(5,7)+'-'+(l.tgl||l.tanggal||'').slice(0,4);
                    const konf   = l.konfirmasi==='CONFIRMED'?'<span class="badge badge-success" style="font-size:10px">✓</span>':'<span class="badge badge-neutral" style="font-size:10px">—</span>';
                    return `<tr>
                      <td style="white-space:nowrap;color:var(--text-2)">${tglFmt||'-'}</td>
                      <td>${l.keterangan||l.ket||l.catatan||'-'}</td>
                      <td class="num" style="font-family:var(--font-mono);color:${hutang>0?'var(--danger)':'var(--text-3)'};font-weight:${hutang>0?600:400}">${hutang>0?Utils.formatRupiah(hutang):'-'}</td>
                      <td class="num" style="font-family:var(--font-mono);color:${bayar>0?'var(--success)':'var(--text-3)'};font-weight:${bayar>0?600:400}">${bayar>0?Utils.formatRupiah(bayar):'-'}</td>
                      <td style="text-align:center">${konf}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>` : (canFinance ? `<div style="text-align:center;padding:40px;color:var(--text-3)">Belum ada log</div>` : `<div style="text-align:center;padding:40px;color:var(--text-3)">—</div>`)}
        </div>
      </div>
    `;
  }

  /* ===================== RENDER LOGBOOK ===================== */
  function renderLogbook() {
    if (!Auth.can('emp_finance','view')) {
      const el = document.getElementById('emp-tab-logbook');
      if (el) el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-3)">Anda tidak memiliki akses ke logbook karyawan.</div>';
      return;
    }
    // Logbook data: hutang/pinjaman/cicilan karyawan
    // Fields: tgl, nama, bulan, hutang, bayar, ket, pj, konfirmasi
    const allNamas  = [...new Set(_logs.map(l=>l.nama).filter(Boolean))].sort();
    const allBulans = [...new Set(_logs.map(l=>l.bulan).filter(b=>b))].sort((a,b)=>a-b);
    const BULAN_LABEL = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};

    const totalHutang = _logs.reduce((s,l)=>s+(l.hutang||(l.jenis==='BERHUTANG'?l.jumlah:0)||0), 0);
    const totalBayar  = _logs.reduce((s,l)=>s+(l.bayar||(l.jenis==='BAYAR HUTANG'?l.jumlah:0)||0), 0);
    const saldo       = totalHutang - totalBayar;

    document.getElementById('emp-tab-logbook').innerHTML = `
      <!-- Summary Cards -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
   {l:'Sisa Hutang',   v:Utils.formatRupiah(saldo,false),        c:saldo>0?'var(--danger)':'var(--success)'},
          {l:'Total Records', v:_logs.length+' entri',                 c:'var(--text-2)'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 16px;min-width:130px">
            <div style="font-size:10px;color:var(--text-3);margin-bottom:2px">${s.l}</div>
            <div class="lb-summary-card" style="font-size:15px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>`).join('')}
      </div>

      <!-- Filter bar -->
      <div class="filter-bar" style="margin-bottom:var(--s3)">
        <select class="form-control" style="width:180px" id="lb-filter-nama"
          onchange="EmployeeModule.renderLogbook()">
          <option value="">Semua Karyawan</option>
          ${allNamas.map(n=>`<option value="${n}">${n}</option>`).join('')}
        </select>
        <select class="form-control" style="width:110px" id="lb-filter-bulan"
          onchange="EmployeeModule.renderLogbook()">
          <option value="">Semua Bulan</option>
          ${allBulans.map(b=>`<option value="${b}">${BULAN_LABEL[b]||b}</option>`).join('')}
        </select>
        <select class="form-control" style="width:130px" id="lb-filter-konf"
          onchange="EmployeeModule.renderLogbook()">
          <option value="">Semua Status</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="">Belum Konfirmasi</option>
        </select>
        <input type="date" class="form-control" style="width:140px" id="lb-filter-from"
          onchange="EmployeeModule.renderLogbook()">
        <input type="date" class="form-control" style="width:140px" id="lb-filter-to"
          onchange="EmployeeModule.renderLogbook()">
        <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._resetLbFilter()" title="Reset">↺</button>
        <span style="margin-left:auto;font-size:12px;color:var(--text-3)" id="lb-count-label"></span>
        ${Auth.can('employee','edit') ? `
          <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._lbLockAll()" title="Kunci semua baris">🔒 Kunci Semua</button>
          <button class="btn btn-primary btn-sm" onclick="EmployeeModule.addLogRow()">+ Tambah Log</button>` : ''}
      </div>

      <!-- Table -->
      <div class="table-wrapper"><div class="table-scroll">
        <table class="table" style="font-size:12px">
          <thead><tr>
            <th style="width:100px">Tanggal</th>
            <th>Nama Karyawan</th>
            <th>Keterangan</th>
            <th>Penanggung Jawab</th>
            <th class="num" style="color:var(--danger)">Hutang</th>
            <th class="num" style="color:var(--success)">Bayar</th>
            <th style="width:100px;text-align:center">Status</th>
            ${Auth.can('employee','edit')?'<th style="width:70px">Aksi</th>':''}
          </tr></thead>
          <tbody id="lb-tbody">${_renderLogRows()}</tbody>
        </table>
      </div></div>
    `;

    // Update count label
    setTimeout(() => {
      const tbody = document.getElementById('lb-tbody');
      if (tbody) {
        const rows = tbody.querySelectorAll('tr').length;
        const lbl  = document.getElementById('lb-count-label');
        if (lbl) lbl.textContent = rows + ' entri';
      }
    }, 50);
  }

  function _resetLbFilter() {
    ['lb-filter-nama','lb-filter-bulan','lb-filter-konf','lb-filter-from','lb-filter-to']
      .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    renderLogbook();
  }

  function _renderLogRows() {
    const BULAN_LABEL = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const filterNama  = document.getElementById('lb-filter-nama')?.value  || '';
    const filterBulan = document.getElementById('lb-filter-bulan')?.value || '';
    const filterKonf  = document.getElementById('lb-filter-konf')?.value  || '_all_';
    const from        = document.getElementById('lb-filter-from')?.value  || '';
    const to          = document.getElementById('lb-filter-to')?.value    || '';
    const canEdit     = Auth.can('employee','edit');
    const cols        = canEdit ? 8 : 7;

    let logs = [..._logs].sort((a,b)=>((b.tanggal||b.tgl||'')).localeCompare((a.tanggal||a.tgl||'')));
    if (filterNama)            logs = logs.filter(l=>l.nama===filterNama);
    if (filterBulan)           logs = logs.filter(l=>String(l.bulan)===filterBulan);
    if (filterKonf !== '_all_') logs = logs.filter(l=>l.konfirmasi===filterKonf);
    if (from) logs = logs.filter(l=>((l.tanggal||l.tgl)||'')>=from);
    if (to)   logs = logs.filter(l=>((l.tanggal||l.tgl)||'')<=to);

    if (!logs.length) return `<tr><td colspan="${cols}" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada log</td></tr>`;

    // Subtotal rows
    const subHutang = logs.reduce((s,l)=>s+(l.hutang||(l.jenis==='BERHUTANG'?l.jumlah:0)||0),0);
    const subBayar  = logs.reduce((s,l)=>s+(l.bayar||(l.jenis==='BAYAR HUTANG'?l.jumlah:0)||0),0);

    const rows = logs.map((l,i) => _lbRowView(l, i+1)).join('');

    // Footer subtotal
    const footer = `<tr style="background:var(--surface2);font-weight:700;border-top:2px solid var(--border2)">
      <td colspan="4" style="font-size:12px;color:var(--text-2)">Subtotal (${logs.length} entri)</td>
      <td class="num" style="font-family:var(--font-mono);color:var(--danger)">${Utils.formatRupiah(subHutang)}</td>
      <td class="num" style="font-family:var(--font-mono);color:var(--success)">${Utils.formatRupiah(subBayar)}</td>
      <td colspan="${canEdit?2:1}"></td>
    </tr>`;

    return rows + footer;
  }

  /* ===================== RENDER ARSIP ===================== */
  function renderArsip() {
    const ACTIVE_STATUSES = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const arsip = _employees.filter(e=>!ACTIVE_STATUSES.includes(e.status));
    document.getElementById('emp-tab-arsip').innerHTML = `
      <div class="table-wrapper"><div class="table-scroll">
        <table class="table">
          <thead><tr><th>#</th><th>Nama</th><th>NIK</th><th>Jabatan</th><th>Divisi</th><th>Status</th>
            ${Auth.can('employee','edit')?'<th>Aksi</th>':''}
          </tr></thead>
          <tbody>
            ${arsip.length ? arsip.map((emp,i)=>`<tr style="cursor:pointer" onclick="EmployeeModule.viewCard('${emp.id}')">
              <td class="text-muted">${i+1}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  ${_empAvatar(emp,28)}
                  <span style="font-weight:600">${emp.nama}</span>
                </div>
              </td>
              <td class="text-muted">${emp.nik||emp.nip||'-'}</td>
              <td>${emp.jabatan||'-'}</td>
              <td><span class="badge badge-neutral">${emp.divisi||emp.departemen||'-'}</span></td>
              <td onclick="event.stopPropagation()">${_statusDropdown(emp)}</td>
              ${Auth.can('employee','edit')?`<td onclick="event.stopPropagation()">
                <div style="display:flex;gap:4px;align-items:center">
                  <button class="btn btn-ghost btn-sm" onclick="EmployeeModule.openEmpModal('${emp.id}')">Edit</button>
                  <button class="btn btn-primary btn-sm" onclick="EmployeeModule.changeStatus('${emp.id}','ACTIVE')"
                    title="Kembalikan ke aktif">↩ Aktifkan</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--danger)"
                    onclick="EmployeeModule._deleteEmpFromArsip('${emp.id}')" title="Hapus permanen">🗑</button>
                </div>
              </td>`:''}
            </tr>`).join('')
            : `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada karyawan arsip / resign</td></tr>`}
          </tbody>
        </table>
      </div></div>
    `;
  }

  async function _deleteEmpFromArsip(id) {
    const emp = _employees.find(e=>e.id===id);
    if (!emp) return;
    const ok = await Modal.confirm({
      title: 'Hapus Karyawan?',
      message: `Data <strong>${emp.nama}</strong> akan dihapus permanen dari sistem dan tidak bisa dikembalikan.`,
      danger: true,
      confirmText: 'Hapus Permanen'
    });
    if (!ok) return;
    try {
      await DB.deleteEmployee(id);
      _employees = _employees.filter(e=>e.id!==id);
      renderArsip();
      Notify.success('Karyawan dihapus');
      DB.logActivity({type:'delete_employee', detail:'Karyawan dihapus: '+emp.nama});
    } catch(e) { Notify.error('Gagal hapus', e.message); }
  }

  /* ===================== MODAL: KARYAWAN ===================== */
  function openEmpModal(editId = null) {
    const emp = editId ? _employees.find(e=>e.id===editId) : {};
    const d   = emp || {};
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: editId ? 'Edit Karyawan' : 'Tambah Karyawan',
      size: 'modal-lg',
      body: `<form id="emp-form">
        <!-- Foto Karyawan -->
        <div class="form-group" style="display:flex;align-items:center;gap:var(--s4);margin-bottom:var(--s4)">
          <div id="emp-foto-preview" style="width:60px;height:60px;border-radius:50%;overflow:hidden;flex-shrink:0;
               background:var(--surface2);border:2px dashed var(--border2);display:flex;align-items:center;justify-content:center">
            ${d.fotoUrl ? '<img src="'+d.fotoUrl+'" style="width:100%;height:100%;object-fit:cover">' : '<span style="font-size:24px">👤</span>'}
          </div>
          <div>
            <label class="btn btn-ghost btn-sm" style="cursor:pointer;margin-bottom:4px">
              📷 Pilih Foto
              <input type="file" id="emp-foto-input" accept="image/*" style="display:none"
                onchange="EmployeeModule._handleFotoUpload(this)">
            </label>
            ${d.fotoUrl ? '<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="EmployeeModule._removeFoto()">✕ Hapus</button>' : ''}
            <div style="font-size:10px;color:var(--text-3)">PNG/JPG · Max 1MB</div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Lengkap <span class="req">*</span></label>
            <input name="nama" class="form-control" value="${d.nama||''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">NIP</label>
            <input name="nip" class="form-control" value="${d.nip||''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Jabatan</label>
            <input name="jabatan" class="form-control" value="${d.jabatan||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Departemen</label>
            <input name="departemen" class="form-control" value="${d.departemen||''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">No. HP</label>
            <input name="noHp" class="form-control" value="${d.noHp||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="status" class="form-control">
              ${['Tetap','Kontrak','Percobaan','Harian','Arsip'].map(s=>`<option value="${s}" ${d.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tgl Masuk</label>
            <input type="date" name="tglMasuk" class="form-control" value="${d.tglMasuk||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Gaji Pokok</label>
            <input type="number" name="gajiPokok" class="form-control" value="${d.gajiPokok||0}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">No. Rekening</label>
            <input name="noRek" class="form-control" value="${d.noRek||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Tgl Keluar</label>
            <input type="date" name="tglKeluar" class="form-control" value="${d.tglKeluar||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Alamat</label>
          <input name="alamat" class="form-control" value="${d.alamat||''}">
        </div>
      </form>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
               <button class="btn btn-primary" onclick="EmployeeModule._submitEmp('${mid}','${editId||''}')">
                 ${editId ? 'Simpan' : 'Tambah'}
               </button>`,
    });
  }

  async function _submitEmp(mid, editId='') {
    const fd   = new FormData(document.getElementById('emp-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.nama) { Notify.warning('Nama wajib diisi'); return; }
    data.gajiPokok = parseInt(data.gajiPokok)||0;
    if (editId) data.id = editId;
    // Handle foto upload
    if (_tempFotoUrl && _tempFotoUrl !== '__remove__') {
      data.fotoUrl = _tempFotoUrl;
    } else if (_tempFotoUrl === '__remove__') {
      data.fotoUrl = '';
    } else if (editId) {
      // Preserve existing foto
      const existing = _employees.find(e=>e.id===editId);
      if (existing?.fotoUrl) data.fotoUrl = existing.fotoUrl;
    }
    _tempFotoUrl = null;
    try {
      const saved = await DB.saveEmployee(data);
      const idx   = _employees.findIndex(e=>e.id===saved.id);
      if (idx>=0) _employees[idx]=saved; else _employees.push(saved);
      renderData();
      Modal.close(mid);
      Notify.success(editId?'Data diperbarui':'Karyawan ditambahkan');
      DB.logActivity({type:'employee', detail:(editId?'Edit: ':'Tambah: ')+data.nama});
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  /* ===================== MODAL: LOG ===================== */
  function openLogModal(editId='', preEmpId='') {
    const log  = editId ? _logs.find(l=>l.id===editId) : {};
    const d    = log || {};
    const empOpts = _employees.filter(e=>e.status!=='Arsip')
      .map(e=>`<option value="${e.id}" ${(d.employeeId||preEmpId)===e.id?'selected':''}>${e.nama}</option>`).join('');
    const mid  = Utils.uid();
    Modal.open({ id: mid,
      title: editId ? 'Edit Log' : 'Tambah Log',
      body: `<form id="log-form">
        <div class="form-group">
          <label class="form-label">Karyawan <span class="req">*</span></label>
          <select name="employeeId" class="form-control" required>
            <option value="">Pilih karyawan...</option>${empOpts}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tanggal</label>
            <input type="date" name="tgl" class="form-control" value="${d.tgl||new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Tipe</label>
            <select name="type" class="form-control">
              ${['Absensi','Lembur','SP','Cuti','Izin','Sakit','Prestasi','Pelatihan','Mutasi','Lain-lain'].map(t=>`<option value="${t}" ${d.type===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="catatan" class="form-control" rows="3">${d.catatan||''}</textarea>
        </div>
      </form>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
               <button class="btn btn-primary" onclick="EmployeeModule._submitLog('${mid}','${editId||''}')">Simpan</button>`,
    });
  }

  async function _submitLog(mid, editId='') {
    const fd   = new FormData(document.getElementById('log-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.employeeId) { Notify.warning('Pilih karyawan'); return; }
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveEmployeeLog(data);
      const idx   = _logs.findIndex(l=>l.id===saved.id);
      if (idx>=0) _logs[idx]=saved; else _logs.unshift(saved);
      if (_activeTab==='logbook') renderLogbook();
      if (_activeTab==='card')    renderCard(_selectedEmpId);
      Modal.close(mid);
      Notify.success('Log disimpan');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  async function deleteLog(id) {
    const ok = await Modal.confirm({title:'Hapus Log',message:'Log ini akan dihapus.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    try {
      await DB.deleteEmployeeLog(id);
      _logs = _logs.filter(l=>l.id!==id);
      renderLogbook();
      Notify.success('Log dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  function _viewPhoto(src) {
    if (!src) return;
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: 'Foto Karyawan',
      size: 'modal-sm',
      body: `<div style="text-align:center;padding:var(--s4)">
        <img src="${src}" style="max-width:100%;max-height:70vh;border-radius:var(--r-lg);box-shadow:var(--shadow-lg)">
        </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  /* === Foto Handler === */
  let _tempFotoUrl = null;

  // Compress foto to JPEG 256px max, ~70% quality (≈15-30KB result)
  function _compressFoto(dataUrl, maxPx, quality) {
    maxPx   = maxPx   || 256;
    quality = quality || 0.72;
    return new Promise(function(resolve) {
      const img = new Image();
      img.onload = function() {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function() { resolve(dataUrl); }; // fallback: original
      img.src = dataUrl;
    });
  }

  function _handleFotoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) { Notify.warning('Foto terlalu besar. Maks 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = async function(e) {
      const compressed = await _compressFoto(e.target.result);
      _tempFotoUrl = compressed;
      const prev = document.getElementById('emp-foto-preview');
      if (prev) prev.innerHTML = '<img src="'+compressed+'" style="width:100%;height:100%;object-fit:cover">';
    };
    reader.readAsDataURL(file);
  }

  function _removeFoto() {
    _tempFotoUrl = '__remove__';
    const prev = document.getElementById('emp-foto-preview');
    if (prev) prev.innerHTML = '<span style="font-size:20px">👤</span>';
  }

  /* === Migrate Photos from localStorage → Supabase === */
  async function migratePhotosFromLS(snapshot) {
    const FLAG = 'becca_photos_migrated_v2'; // v2: fix — snapshot diambil sebelum _get() overwrite LS
    if (localStorage.getItem(FLAG)) return 0;
    // Gunakan snapshot yang di-capture sebelum _get() — fallback ke LS langsung jika tidak ada
    let lsEmps = Array.isArray(snapshot) && snapshot.length ? snapshot : [];
    if (!lsEmps.length) {
      try { lsEmps = JSON.parse(localStorage.getItem('becca_employees') || '[]'); } catch {}
    }
    if (!Array.isArray(lsEmps) || !lsEmps.length) { localStorage.setItem(FLAG,'1'); return 0; }

    let migrated = 0;
    for (const lsEmp of lsEmps) {
      if (!lsEmp.fotoUrl || !lsEmp.fotoUrl.startsWith('data:')) continue;
      const dbEmp = _employees.find(e => e.id === lsEmp.id);
      if (!dbEmp) continue;
      if (dbEmp.fotoUrl && dbEmp.fotoUrl.startsWith('data:')) continue; // already synced
      try {
        const compressed = await _compressFoto(lsEmp.fotoUrl);
        dbEmp.fotoUrl = compressed;
        await DB.saveEmployee({...dbEmp});
        migrated++;
      } catch(e) { console.warn('[EMP] migrate foto failed:', lsEmp.id, e.message); }
    }
    localStorage.setItem(FLAG, '1');
    if (migrated > 0) {
      Notify.success(migrated + ' foto karyawan berhasil disinkronisasi ke cloud ✓');
      if (_activeTab === 'data' || _activeTab === 'card') renderData();
    }
    return migrated;
  }

  /* === Quick Status Change === */
  async function changeStatus(empId, newStatus) {
    const emp = _employees.find(e=>e.id===empId);
    if (!emp) return;
    const oldStatus = emp.status;
    emp.status = newStatus;
    try {
      await DB.saveEmployee(emp);
      const idx = _employees.findIndex(e=>e.id===empId);
      if (idx>=0) _employees[idx]=emp;
      Notify.success('Status '+emp.nama+' → '+newStatus);
      DB.logActivity({type:'employee', detail:'Status: '+emp.nama+' '+oldStatus+'→'+newStatus});
      // Re-render tab saat ini
      if (_activeTab==='data')  renderData();
      if (_activeTab==='arsip') renderArsip();
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  const _STATUS_COLORS = {
    'ACTIVE':    {bg:'rgba(34,197,94,.15)',  color:'#16a34a', border:'rgba(34,197,94,.4)'},
    'Active':    {bg:'rgba(34,197,94,.15)',  color:'#16a34a', border:'rgba(34,197,94,.4)'},
    'Tetap':     {bg:'rgba(59,130,246,.15)', color:'#2563eb', border:'rgba(59,130,246,.4)'},
    'Kontrak':   {bg:'rgba(99,102,241,.15)', color:'#6366f1', border:'rgba(99,102,241,.4)'},
    'Percobaan': {bg:'rgba(180,140,100,.15)',color:'#92713a', border:'rgba(180,140,100,.4)'},
    'Harian':    {bg:'rgba(148,163,184,.15)',color:'#64748b', border:'rgba(148,163,184,.4)'},
    'RESIGN':    {bg:'rgba(234,179,8,.15)',  color:'#b45309', border:'rgba(234,179,8,.4)'},
    'Fired':     {bg:'rgba(239,68,68,.15)',  color:'#dc2626', border:'rgba(239,68,68,.4)'},
    'Arsip':     {bg:'rgba(100,116,139,.12)',color:'#64748b', border:'rgba(100,116,139,.3)'},
  };

  function _statusDropdown(emp) {
    const ALL_STATUSES = ['ACTIVE','Tetap','Kontrak','Percobaan','Harian','RESIGN','Fired','Arsip'];
    const id    = (emp.id||'').replace(/['"]/g,'');
    const clr   = _STATUS_COLORS[emp.status] || {bg:'var(--surface2)',color:'var(--text-2)',border:'var(--border)'};
    const opts  = ALL_STATUSES.map(s=>`<option value="${s}" ${emp.status===s?'selected':''}>${s}</option>`).join('');
    return `<select
      style="font-size:11px;padding:2px 6px;height:auto;min-width:90px;border-radius:4px;
             background:${clr.bg};color:${clr.color};border:1px solid ${clr.border};
             font-weight:600;cursor:pointer;outline:none"
      onchange="event.stopPropagation();EmployeeModule.changeStatus('${id}',this.value)"
      onclick="event.stopPropagation()">${opts}</select>`;
  }


  /* === Logbook Lock System === */
  function _lbLoadLocks() {
    try {
      const saved = JSON.parse(localStorage.getItem(_LB_LOCK_KEY) || '[]');
      _lbLocked   = new Set(saved);
    } catch { _lbLocked = new Set(); }
  }

  function _lbSaveLocks() {
    localStorage.setItem(_LB_LOCK_KEY, JSON.stringify([..._lbLocked]));
  }

  function _lbLockAll() {
    _logs.forEach(l => _lbLocked.add(l.id));
    _lbSaveLocks();
    renderLogbook();
  }

  function _lbUnlock(id) {
    _lbLocked.delete(id);
    _lbSaveLocks();
    // Re-render row sebagai editable
    _lbStartEdit(id);
  }

  function _lbStartEdit(id) {
    if (_lbLocked.has(id)) return;
    if (_lbEditId === id) return;
    if (_lbEditId) _lbCommit(_lbEditId);
    _lbEditId = id;
    const tr = document.getElementById('lb-row-'+id);
    if (!tr) return;
    const log = _logs.find(l=>l.id===id);
    if (!log) return;
    const tbody = tr.closest('tbody');
    const allTrs = Array.from(tbody?.querySelectorAll('tr[id^="lb-row-"]')||[]);
    const rowNum = allTrs.indexOf(tr)+1;
    tr.outerHTML = _lbRowEdit(log, rowNum);
    // Focus first input
    const newTr = document.getElementById('lb-row-'+id);
    newTr?.querySelector('input,select')?.focus();
  }

  function _lbCommit(id) {
    if (!id) return;
    const tr = document.getElementById('lb-row-'+id);
    if (!tr) { _lbEditId = null; return; }
    const log = _logs.find(l=>l.id===id);
    if (!log) { _lbEditId = null; return; }

    // Read values from DOM
    const get = (name) => tr.querySelector('[data-f="'+name+'"]')?.value ?? log[name];
    const tgl       = get('tgl') || log.tgl;
    const nama      = get('nama') || log.nama;
    const bulan     = parseInt(get('bulan')) || log.bulan;
    const hutang    = parseFloat(get('hutang')) || 0;
    const bayar     = parseFloat(get('bayar'))  || 0;
    const ket       = get('ket')  ?? log.ket;
    const pj        = get('pj')   ?? log.pj;
    const konfirmasi= get('konfirmasi') || log.konfirmasi;

    Object.assign(log, {tgl, nama, bulan, hutang, bayar, ket, pj, konfirmasi});
    _lbEditId = null;

    DB.saveEmployeeLog(log).then(() => {
      _lbLocked.add(id);
      _lbSaveLocks();
      // Update sisaHutang karyawan berdasarkan semua log mereka
      _recalcHutang(log.nama);
      const tbody = tr.closest('tbody');
      const allTrs = Array.from(tbody?.querySelectorAll('tr')||[]);
      const rowNum = allTrs.indexOf(tr)+1;
      tr.outerHTML = _lbRowView(log, rowNum);
      // Refresh summary cards
      _refreshLbSummary();
    }).catch(e => Notify.error('Gagal simpan log', e.message));
  }

  function _lbRowView(l, rowNum) {
    const BULAN_LABEL = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const isLocked  = _lbLocked.has(l.id);
        const hutang   = l.hutang || (l.jenis==='BERHUTANG'?l.jumlah:0) || 0;
        const bayar    = l.bayar  || (l.jenis==='BAYAR HUTANG'?l.jumlah:0) || 0;
    const _tglRaw   = l.tanggal || l.tgl;
    const tglFmt    = _tglRaw ? _tglRaw.slice(8,10)+'-'+_tglRaw.slice(5,7)+'-'+_tglRaw.slice(0,4) : '-';
    const konfBadge = l.konfirmasi==='CONFIRMED'
      ? '<span class="badge badge-success" style="font-size:10px">✓</span>'
      : '<span class="badge badge-neutral" style="font-size:10px">—</span>';
    const lockIcon  = isLocked
      ? '<span style="color:var(--text-3);font-size:12px" title="Terkunci - klik untuk edit">🔒</span>'
      : '<span style="color:var(--primary-h);font-size:12px" title="Klik untuk edit">✎</span>';
    const canEdit   = Auth.can('employee','edit');
    return `<tr id="lb-row-${l.id}" data-id="${l.id}"
      style="cursor:pointer"
      onclick="${isLocked?`EmployeeModule._showLogDetail('${l.id}')`:`EmployeeModule._lbStartEdit('${l.id}')`}">
      <td style="white-space:nowrap;color:var(--text-2)">${tglFmt}</td>
      <td style="font-weight:600">${l.nama||'-'}</td>
      <td style="color:var(--text-2)">${l.keterangan||l.ket||'-'}</td>
      <td style="color:var(--text-3);font-size:11px">${l.pj||'-'}</td>
      <td class="num" style="font-family:var(--font-mono);color:${hutang>0?'var(--danger)':'var(--text-3)'};font-weight:${hutang>0?600:400}">${hutang>0?Utils.formatRupiah(hutang):'-'}</td>
      <td class="num" style="font-family:var(--font-mono);color:${bayar>0?'var(--success)':'var(--text-3)'};font-weight:${bayar>0?600:400}">${bayar>0?Utils.formatRupiah(bayar):'-'}</td>
      <td style="text-align:center">${konfBadge}</td>
      ${canEdit?`<td>
        <div style="display:flex;gap:3px;align-items:center">
          ${lockIcon}
          <button class="btn-icon" title="Hapus" onclick="event.stopPropagation();EmployeeModule.deleteLog('${l.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </td>`:''}
    </tr>`;
  }

  function _lbRowEdit(l, rowNum) {
    const MONTHS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
    const BULAN_LABEL = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const allNamas = [...new Set(_employees.map(e=>e.nama).filter(Boolean))].sort();
    const namaOpts = allNamas.map(n=>`<option value="${n}" ${l.nama===n?'selected':''}>${n}</option>`).join('');
    const bulanOpts = MONTHS.map(m=>`<option value="${m}" ${String(l.bulan)===m?'selected':''}>${BULAN_LABEL[m]}</option>`).join('');
    const inp = (field, val, type='text', extra='') =>
      `<input data-f="${field}" type="${type}" value="${val||''}" ${extra}
        style="width:100%;border:none;outline:none;background:transparent;padding:0 4px;font-size:12px;font-family:inherit"
        onkeydown="if(event.key==='Enter'){event.preventDefault();EmployeeModule._lbCommit('${l.id}');}
                   if(event.key==='Escape'){EmployeeModule._lbCancelEdit('${l.id}');}">`;
    return `<tr id="lb-row-${l.id}" data-id="${l.id}"
      style="background:rgba(99,102,241,.06);outline:1px solid var(--primary);outline-offset:-1px">
      <td>${inp('tgl', l.tgl||'', 'date')}</td>
      <td>
        <select data-f="nama" style="width:100%;border:none;outline:none;background:transparent;padding:0 4px;font-size:12px">
          <option value="${l.nama||''}">${l.nama||'Pilih...'}</option>
          ${namaOpts}
        </select>
      </td>
      <td>${inp('ket', l.ket||l.catatan||'')}</td>
      <td>${inp('pj', l.pj||'')}</td>
      <td>${inp('hutang', l.hutang||0, 'number', 'min="0"')}</td>
      <td>${inp('bayar', l.bayar||0, 'number', 'min="0"')}</td>
      <td>
        <select data-f="konfirmasi" style="width:100%;border:none;outline:none;background:transparent;padding:0 4px;font-size:11px">
          <option value="CONFIRMED" ${l.konfirmasi==='CONFIRMED'?'selected':''}>✓ Konfirmasi</option>
          <option value="" ${!l.konfirmasi?'selected':''}>Pending</option>
        </select>
      </td>
      <td>
        <div style="display:flex;gap:3px">
          <button class="btn-icon" title="Simpan (Enter)" onclick="event.stopPropagation();EmployeeModule._lbCommit('${l.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
          <button class="btn-icon" title="Batal (Esc)" onclick="event.stopPropagation();EmployeeModule._lbCancelEdit('${l.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }

  function _lbCancelEdit(id) {
    _lbEditId = null;
    const log = _logs.find(l=>l.id===id);
    if (!log) return;
    const tr = document.getElementById('lb-row-'+id);
    if (!tr) return;
    const tbody = tr.closest('tbody');
    const allTrs = Array.from(tbody?.querySelectorAll('tr')||[]);
    const rowNum = allTrs.indexOf(tr)+1;
    tr.outerHTML = _lbRowView(log, rowNum);
  }

  async function addLogRow() {
    // Tambah baris baru di atas tabel (langsung editable)
    if (_lbEditId) _lbCommit(_lbEditId);
    const today = new Date().toISOString().split('T')[0];
    const nowBulan = new Date().getMonth() + 1;
    const newLog = {
      tgl: today, nama: '', bulan: nowBulan,
      hutang: 0, bayar: 0, ket: '', pj: '', konfirmasi: '',
    };
    try {
      const saved = await DB.saveEmployeeLog(newLog);
      _logs.unshift(saved);
      // Jangan lock baris baru
      _lbEditId = null;
      renderLogbook();
      // Auto-edit baris pertama
      setTimeout(() => _lbStartEdit(saved.id), 50);
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  function _renderDataTable() {
    // Re-filter dan update hanya tbody table + stats cards
    const ACTIVE_STATS  = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    let active          = _employees.filter(e => ACTIVE_STATS.includes(e.status));
    const depts         = [...new Set(active.map(e=>e.divisi||e.departemen).filter(Boolean))].sort();
    if (_searchQ) { const q=_searchQ.toLowerCase(); active=active.filter(e=>(e.nama||'').toLowerCase().includes(q)||(e.jabatan||'').toLowerCase().includes(q)||(e.nik||'').toLowerCase().includes(q)||(e.divisi||'').toLowerCase().includes(q)); }

    let filtered = active;
    if (_filterStatus) filtered = filtered.filter(e=>e.status===_filterStatus);
    if (_filterDept)   filtered = filtered.filter(e=>(e.divisi||e.departemen)===_filterDept);
    if (_searchQ) {
      const q = _searchQ.toLowerCase();
      filtered = filtered.filter(e =>
        (e.nama||'').toLowerCase().includes(q) ||
        (e.nik||e.nip||'').toLowerCase().includes(q) ||
        (e.jabatan||'').toLowerCase().includes(q) ||
        (e.divisi||e.departemen||'').toLowerCase().includes(q) ||
        (e.panggilan||'').toLowerCase().includes(q)
      );
    }
    const _NUM_FIELDS2 = ['sisaHutang','gaji','gajiPokok','gajiAwal'];
    filtered = [...filtered].sort((a,b) => {
      const getVal = (e) => {
        if (_sortField==='departemen') return e.divisi||e.departemen||'';
        if (_sortField==='nip') return e.nik||e.nip||'';
        if (_sortField==='tglMasuk') return e.tglJoin||e.tglMasuk||'';
        if (_sortField==='gajiPokok') return e.gaji||e.gajiPokok||0;
        return e[_sortField]??'';
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (_NUM_FIELDS2.includes(_sortField)) {
        const na = parseFloat(va)||0, nb = parseFloat(vb)||0;
        return _sortDir==='asc' ? na-nb : nb-na;
      }
      const sa = va.toString().toLowerCase();
      const sb = vb.toString().toLowerCase();
      return _sortDir==='asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    const canEdit    = Auth.can('employee','edit');
    const canFinance = Auth.can('emp_finance','view');
    const tbody      = document.querySelector('#emp-tab-data tbody');
    const countLbl = document.querySelector('#emp-tab-data .text-muted.text-small[style*="margin-left:auto"]');
    if (countLbl) countLbl.textContent = filtered.length + ' karyawan';

    if (!tbody) { renderData(); return; }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="${7+(canFinance?2:0)+(canEdit?1:0)}" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada data yang cocok</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((emp, i) => {
      const _ACTIVE_STATUSES = ['AKTIF','ACTIVE','Active','Tetap'];
      const _WARN_STATUSES   = ['Kontrak','CONTRACT','Percobaan'];
      const _DANGER_STATUSES = ['RESIGN','Resign','Nonaktif'];
      const statusColor = _ACTIVE_STATUSES.includes(emp.status)?'badge-success'
        : _WARN_STATUSES.includes(emp.status)?'badge-warning'
        : _DANGER_STATUSES.includes(emp.status)?'badge-danger'
        : 'badge-neutral';
      return `<tr style="cursor:pointer" onclick="EmployeeModule.viewCard('${emp.id}')"
                  onmouseover="this.style.background='var(--surface2)'"
                  onmouseout="this.style.background=''">
        <td class="text-muted text-small">${i+1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            ${_empAvatar(emp, 32)}
            <div>
              <div style="font-weight:600">${emp.nama||''}</div>
              ${emp.noHp ? `<div class="text-small text-muted">${emp.noHp}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="text-muted text-small">${emp.nik||emp.nip||'-'}</td>
        <td>${emp.jabatan||'-'}</td>
        <td><span class="badge badge-neutral">${emp.divisi||emp.departemen||'-'}</span></td>
        <td onclick="event.stopPropagation()">${_statusDropdown(emp)}</td>
        <td class="text-small text-muted">${_fmtTgl(emp.tglJoin||emp.tgl_join||emp.tglMasuk)}</td>
        ${canFinance ? `<td class="text-small" style="font-family:var(--font-mono)">${emp.gaji?Utils.formatRupiah(emp.gaji,false):'-'}</td>` : ''}
        ${canFinance ? `<td class="text-small" style="font-family:var(--font-mono);color:${(emp.sisaHutang||0)>0?'var(--warning)':'var(--text-3)'}">${emp.sisaHutang?Utils.formatRupiah(emp.sisaHutang,false):'-'}</td>` : ''}
        ${canEdit ? `<td onclick="event.stopPropagation()">
          <div style="display:flex;gap:4px">
            <button class="btn-icon" title="Edit" onclick="EmployeeModule.openEmpModal('${emp.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
            </button>
          </div>
        </td>` : ''}
      </tr>`;
    }).join('');

    // Restore search bar value dan focus
    const searchBar = document.getElementById('emp-search-bar');
    if (searchBar && document.activeElement !== searchBar) {
      searchBar.value = _searchQ;
    }
  }


  /* === Recalc Hutang Karyawan === */
  function _recalcHutang(namaKaryawan) {
    // Hitung dari EXACT match nama saja
    const logsForEmp  = _logs.filter(l => l.nama === namaKaryawan);
    const totalHutang = logsForEmp.reduce((s,l)=>s+(l.hutang||(l.jenis==='BERHUTANG'?l.jumlah:0)||0), 0);
    const totalBayar  = logsForEmp.reduce((s,l)=>s+(l.bayar||(l.jenis==='BAYAR HUTANG'?l.jumlah:0)||0),  0);
    const sisa        = Math.max(0, totalHutang - totalBayar);
    const emp = _employees.find(e=>e.nama===namaKaryawan);
    if (!emp) return;
    if (emp.sisaHutang === sisa) return; // tidak ada perubahan
    emp.sisaHutang = sisa;
    DB.saveEmployee(emp).catch(()=>{});
    // Update UI jika sedang di tab data
    if (_activeTab === 'data') _renderDataTable();
  }

  // Recalc semua karyawan sekaligus (bulk fix)
  async function recalcAllHutang() {
    let fixed = 0;
    const empNames = new Set(_employees.map(e=>e.nama));
    // Hanya proses nama yang exact match di employee list
    const names = [...new Set(_logs.map(l=>l.nama).filter(n=>n&&empNames.has(n)))];
    for (const nama of names) {
      const logsForEmp  = _logs.filter(l=>l.nama===nama);
      const totalH = logsForEmp.reduce((s,l)=>s+(l.hutang||0),0);
      const totalB = logsForEmp.reduce((s,l)=>s+(l.bayar||0),0);
      const sisa   = Math.max(0,totalH-totalB);
      const emp    = _employees.find(e=>e.nama===nama);
      if (emp && emp.sisaHutang !== sisa) {
        emp.sisaHutang = sisa;
        await DB.saveEmployee(emp).catch(()=>{});
        fixed++;
      }
    }
    if (fixed>0) { Notify.success('Hutang diperbarui: '+fixed+' karyawan'); }
    return fixed;
  }

  function _refreshLbSummary() {
    // Update summary cards di atas logbook tanpa re-render seluruh halaman
    const totalH = _logs.reduce((s,l)=>s+(l.hutang||0),0);
    const totalB = _logs.reduce((s,l)=>s+(l.bayar||0),0);
    const saldo  = totalH - totalB;
    const cards  = document.querySelectorAll('#emp-tab-logbook .lb-summary-card');
    if (cards.length >= 3) {
      cards[0].textContent = Utils.formatRupiah(totalH,false);
      cards[1].textContent = Utils.formatRupiah(totalB,false);
      cards[2].textContent = Utils.formatRupiah(saldo,false);
    }
  }


  /* === Log Detail Modal (klik baris logbook) === */
  function _showLogDetail(logId) {
    const log  = _logs.find(l => l.id === logId);
    if (!log) return;
    const emp  = _employees.find(e => e.nama === log.nama);
    const BULAN_LABEL = {1:'Januari',2:'Februari',3:'Maret',4:'April',5:'Mei',6:'Juni',
      7:'Juli',8:'Agustus',9:'September',10:'Oktober',11:'November',12:'Desember'};
    const mid  = Utils.uid();
    const canEdit = Auth.can('employee','edit');

    // Summary hutang karyawan ini dari semua log
    const empLogs   = _logs.filter(l => l.nama === log.nama);
    const totalH    = empLogs.reduce((s,l)=>s+(l.hutang||0),0);
    const totalB    = empLogs.reduce((s,l)=>s+(l.bayar||0),0);
    const sisaH     = Math.max(0, totalH - totalB);
    const tglFmt    = log.tgl ? log.tgl.split('-').reverse().join('/') : '-';

    Modal.open({ id: mid,
      title: '📋 Detail Logbook',
      size: 'modal-lg',
      body: `
        <!-- Header: info karyawan + foto -->
        <div style="display:flex;align-items:center;gap:16px;padding:14px 16px;
                    background:var(--surface2);border-radius:var(--r-md);margin-bottom:var(--s4)">
          ${emp ? _empAvatar(emp, 52) :
            '<div style="width:52px;height:52px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:22px">👤</div>'}
          <div style="flex:1">
            <div style="font-size:17px;font-weight:700;color:var(--heading)">${log.nama||'-'}</div>
            ${emp ? `<div style="font-size:12px;color:var(--text-3)">${emp.jabatan||''} ${emp.divisi||emp.departemen?'· '+(emp.divisi||emp.departemen):''}</div>` : ''}
            ${emp ? `<div style="margin-top:4px">${_statusDropdown(emp)}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;color:var(--text-3)">Sisa Hutang</div>
            <div style="font-size:20px;font-weight:800;color:${sisaH>0?'var(--warning)':'var(--success)'};font-family:var(--font-mono)">
              ${Utils.formatRupiah(sisaH,false)}
            </div>
            <div style="font-size:10px;color:var(--text-3)">${empLogs.length} entri log</div>
          </div>
        </div>

        <!-- 2 kolom: Detail entri kiri, Info karyawan kanan -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)">

          <!-- Kiri: Detail entri ini -->
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">Detail Entri</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              ${[
                {l:'Tanggal',         v: tglFmt},
                {l:'Bulan',           v: BULAN_LABEL[log.bulan]||log.bulan||'-'},
                {l:'Keterangan',      v: log.ket||log.catatan||'-'},
                {l:'Penanggung Jawab',v: log.pj||'-'},
                {l:'Hutang',          v: (log.hutang||0)>0 ? '<span style="color:var(--danger);font-weight:700">'+Utils.formatRupiah(log.hutang)+'</span>' : '-'},
                {l:'Bayar',           v: (log.bayar||0)>0  ? '<span style="color:var(--success);font-weight:700">'+Utils.formatRupiah(log.bayar)+'</span>'  : '-'},
                {l:'Status',          v: log.konfirmasi==='CONFIRMED'
                  ? '<span class="badge badge-success">✓ Konfirmasi</span>'
                  : '<span class="badge badge-neutral">Pending</span>'},
              ].map(r=>`
                <tr>
                  <td style="padding:7px 8px;color:var(--text-3);border-bottom:1px solid var(--border);width:45%">${r.l}</td>
                  <td style="padding:7px 8px;border-bottom:1px solid var(--border)">${r.v}</td>
                </tr>`).join('')}
            </table>
            <!-- Hutang summary -->
            <div style="margin-top:var(--s3);padding:10px 12px;background:var(--surface2);border-radius:var(--r-md)">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:var(--text-3)">Total Hutang</span>
                <span style="color:var(--danger);font-weight:600">${Utils.formatRupiah(totalH)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:var(--text-3)">Total Bayar</span>
                <span style="color:var(--success);font-weight:600">${Utils.formatRupiah(totalB)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;border-top:1px solid var(--border);padding-top:6px;margin-top:4px">
                <span>Sisa Hutang</span>
                <span style="color:${sisaH>0?'var(--warning)':'var(--success)'}">${Utils.formatRupiah(sisaH)}</span>
              </div>
            </div>
          </div>

          <!-- Kanan: Info karyawan lengkap -->
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">Info Karyawan</div>
            ${emp ? `<table style="width:100%;border-collapse:collapse;font-size:13px">
              ${[
                {l:'NIK',         v: emp.nik||emp.nip||'-'},
                {l:'Jabatan',     v: emp.jabatan||'-'},
                {l:'Divisi',      v: emp.divisi||emp.departemen||'-'},
                {l:'No. HP',      v: emp.noHp||'-'},
                {l:'Tgl Join',    v: emp.tglJoin||emp.tglMasuk||'-'},
                {l:'Gaji',        v: emp.gaji ? Utils.formatRupiah(emp.gaji) : '-'},
                {l:'Status',      v: emp.status||'-'},
              ].map(r=>`
                <tr>
                  <td style="padding:7px 8px;color:var(--text-3);border-bottom:1px solid var(--border);width:45%">${r.l}</td>
                  <td style="padding:7px 8px;font-weight:500;border-bottom:1px solid var(--border)">${r.v}</td>
                </tr>`).join('')}
            </table>
            <div style="margin-top:var(--s3);display:flex;gap:var(--s2)">
              <button class="btn btn-ghost btn-sm" onclick="Modal.close('${mid}');EmployeeModule.viewCard('${emp.id}')">
                🪪 Lihat Employee Card
              </button>
              ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="EmployeeModule._lbUnlock('${logId}');Modal.close('${mid}')">
                ✎ Edit Entri Ini
              </button>` : ''}
            </div>` : `<div style="text-align:center;padding:30px;color:var(--text-3)">
              Data karyawan tidak ditemukan
            </div>`}
          </div>
        </div>

        <!-- Riwayat log terbaru karyawan ini -->
        ${empLogs.length > 1 ? `
        <div style="margin-top:var(--s4);border-top:1px solid var(--border);padding-top:var(--s4)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">
            Riwayat Log ${log.nama} (${empLogs.length} entri)
          </div>
          <div style="max-height:180px;overflow-y:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:var(--surface2)">
                <th style="padding:5px 8px;text-align:left;color:var(--text-3)">Tgl</th>
                <th style="padding:5px 8px;text-align:left;color:var(--text-3)">Keterangan</th>
                <th style="padding:5px 8px;text-align:right;color:var(--danger)">Hutang</th>
                <th style="padding:5px 8px;text-align:right;color:var(--success)">Bayar</th>
              </tr></thead>
              <tbody>
                ${empLogs.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')).map(ll=>`
                  <tr style="background:${ll.id===logId?'rgba(99,102,241,.08)':''}">
                    <td style="padding:5px 8px;border-bottom:1px solid var(--border);white-space:nowrap">${ll.tgl?ll.tgl.split('-').reverse().join('/'):'-'}</td>
                    <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${ll.ket||'-'}</td>
                    <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--font-mono);color:var(--danger)">${(ll.hutang||0)>0?Utils.formatRupiah(ll.hutang):'-'}</td>
                    <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--font-mono);color:var(--success)">${(ll.bayar||0)>0?Utils.formatRupiah(ll.bayar):'-'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }


  // Helper: match nama karyawan (logbook fallback)
  function _nameMatch(a, b) {
    if (!a || !b) return false;
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  function _fmtTgl(d) {
    if (!d) return '-';
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3]+'-'+m[2]+'-'+m[1] : String(d);
  }

  return {
    init, switchTab, renderData, renderCard, renderLogbook, renderArsip, _deleteEmpFromArsip,
    _handleFotoUpload, _removeFoto, _viewPhoto, _searchEmp, _renderDataTable, changeStatus, _resetLbFilter, migratePhotosFromLS,
    _lbStartEdit, _lbCommit, _lbCancelEdit, _lbUnlock, _lbLockAll, addLogRow, _recalcHutang, recalcAllHutang, _showLogDetail,
    setFilter, sortBy, viewCard, filterCards,
    openEmpModal, _submitEmp, openLogModal, _submitLog, deleteLog,
    get _selectedEmpId() { return _selectedEmpId; },
    set _selectedEmpId(v) { _selectedEmpId = v; },
  };

})();
window.EmployeeModule = EmployeeModule;
