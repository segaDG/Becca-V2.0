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
  let _lbPage     = 1;
  let _lbPerPage  = parseInt(localStorage.getItem('becca_lb_perPage')||'50');
  const _LB_LOCK_KEY = 'becca_lb_locked_ids';
  let _filterStatus = '';
  let _filterDept   = '';
  let _filterGrup   = '';   // '' | '5' | '12' | '19' | '26' | '__none__'
  let _selectedEmpId = null;  // for card view

  // Absensi state
  let _absensi  = [];
  let _absMonth = new Date().getMonth() + 1;
  let _absYear  = new Date().getFullYear();

  // Payroll state
  let _payroll  = [];
  let _payMonth = new Date().getMonth() + 1;
  let _payYear  = new Date().getFullYear();

  // Jadwal Shift state
  let _jadwal          = [];
  let _jadwalWeekStart = null; // computed lazily via _getMonday()
  let _jadwalFilling   = false; // guard: prevent concurrent _jadwalFillAll
  let _payGrup         = '';   // '' | '5' | '12' | '19' | '26' — payroll group filter

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
        <button class="tab-btn"        id="emp-tab-btn-absensi" data-tab="absensi" onclick="EmployeeModule.switchTab('absensi')">📅 Absensi</button>
        ${Auth.can('emp_finance','view') ? `<button class="tab-btn" id="emp-tab-btn-payroll" data-tab="payroll" onclick="EmployeeModule.switchTab('payroll')">💰 Payroll</button>` : ''}
        <button class="tab-btn"        id="emp-tab-btn-arsip"   data-tab="arsip"   onclick="EmployeeModule.switchTab('arsip')">📁 Arsip</button>
      </div>
      <div id="emp-tab-data"></div>
      <div id="emp-tab-card"    class="hidden"></div>
      <div id="emp-tab-logbook" class="hidden"></div>
      <div id="emp-tab-absensi" class="hidden"></div>
      <div id="emp-tab-payroll" class="hidden"></div>
      <div id="emp-tab-arsip"   class="hidden"></div>
    `;

    // Snapshot LS SEBELUM _get() menimpa — foto hanya ada di LS sebelum overwrite
    let _lsEmpSnap = [];
    try { _lsEmpSnap = JSON.parse(localStorage.getItem('becca_employees') || '[]'); } catch {}

    // Skeleton
    const _skelEl = document.getElementById('emp-tab-data');
    if (_skelEl && !_employees.length) _skelEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation:spin 1s linear infinite;opacity:.4"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><div style="margin-top:12px;font-size:13px">Memuat data karyawan...</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

    // Cache-first: render immediately with cached data, then background refresh
    _employees = DB.getCached('employees') || [];
    _logs      = DB.getCached('employee_logs') || [];
    _absensi   = DB.getCached('emp_absensi') || [];
    _payroll   = DB.getCached('emp_payroll') || [];
    _lbLoadLocks();
    if (_employees.length) { _logs.sort((a,b)=>((b.tanggal||b.tgl||'')).localeCompare((a.tanggal||a.tgl||''))); switchTab('data'); }

    // Background fetch fresh data
    const [freshEmp, freshLogs, freshAbs, freshPay] = await Promise.all([
      DB.getEmployees().catch(()=>[]),
      DB.getEmployeeLogs().catch(()=>[]),
      DB.getEmpAbsensi().catch(()=>[]),
      DB.getEmpPayroll().catch(()=>[]),
    ]);
    _employees = freshEmp; _logs = freshLogs; _absensi = freshAbs; _payroll = freshPay;
    _logs.sort((a,b)=>((b.tanggal||b.tgl||'')).localeCompare((a.tanggal||a.tgl||'')));
    _logs.forEach(l => _lbLocked.add(l.id));
    _lbSaveLocks();
    if (window.FaceAttendanceModule) FaceAttendanceModule.init(_employees, _absensi);
    switchTab(_activeTab || 'data');
    migratePhotosFromLS(_lsEmpSnap).catch(() => {});
  }

  /* ===================== TAB SWITCH ===================== */
  function switchTab(tab) {
    _activeTab = tab;
    ['data','card','logbook','absensi','payroll','jadwal','arsip'].forEach(t => {
      const el = document.getElementById('emp-tab-'+t);
      if (el) el.classList.toggle('hidden', t !== tab);
      const btn = document.getElementById('emp-tab-btn-'+t);
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'data')    renderData();
    if (tab === 'card')    renderCard(_selectedEmpId);
    if (tab === 'logbook') renderLogbook();
    if (tab === 'absensi') renderAbsensi();
    if (tab === 'payroll') renderPayroll();
    if (tab === 'jadwal')  renderJadwal();
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

    const missingGrup = active.filter(e => !e.grupGajian).length;

    // Apply filter
    let filtered = active;
    if (_filterStatus) filtered = filtered.filter(e=>e.status===_filterStatus);
    if (_filterDept)   filtered = filtered.filter(e=>(e.divisi||e.departemen)===_filterDept);
    if (_filterKtp==='missing') filtered = filtered.filter(e=>!e.ktpUrl);
    if (_filterFace==='missing') filtered = filtered.filter(e=>!e.faceDescriptors?.length);
    if (_filterGrup === '__none__') filtered = filtered.filter(e => !e.grupGajian);
    else if (_filterGrup) filtered = filtered.filter(e => e.grupGajian === _filterGrup);
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
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:140px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Aktif</div>
          <div style="font-size:18px;font-weight:700;color:var(--success);font-family:var(--font-mono)">${active.filter(e=>['AKTIF','ACTIVE','Active','Tetap'].includes(e.status)).length}</div>
        </div>
        ${depts.map(dept => {
          const count = active.filter(e=>(e.divisi||e.departemen)===dept).length;
          const deptEsc = dept.replace(/'/g,"\'");
          return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:120px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.08)"
            onclick="EmployeeModule.setFilter('dept','${deptEsc}')" title="Filter: ${dept}">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px">${dept}</div>
            <div style="font-size:18px;font-weight:700;color:var(--primary-h);font-family:var(--font-mono)">${count}</div>
          </div>`;
        }).join('')}
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:120px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Tanpa Divisi</div>
          <div style="font-size:18px;font-weight:700;color:var(--text-2);font-family:var(--font-mono)">${active.filter(e=>!(e.divisi||e.departemen)).length}</div>
        </div>
        ${(()=>{
          const hasKtp = active.filter(e=>e.ktpUrl).length;
          const hasFace = active.filter(e=>e.faceDescriptors?.length).length;
          const total = active.length;
          return `
          <div style="background:var(--surface);border:1px solid ${hasKtp<total?'rgba(245,158,11,.3)':'rgba(16,185,129,.3)'};border-radius:var(--r-md);padding:12px 18px;min-width:120px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.08)"
            onclick="EmployeeModule.setFilter('ktp','missing')" title="Filter: belum punya KTP">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">🪪 KTP</div>
            <div style="font-size:18px;font-weight:700;color:${hasKtp<total?'#f59e0b':'#10b981'};font-family:var(--font-mono)">${hasKtp}/${total}</div>
          </div>
          <div style="background:var(--surface);border:1px solid ${hasFace<total?'rgba(245,158,11,.3)':'rgba(99,102,241,.3)'};border-radius:var(--r-md);padding:12px 18px;min-width:120px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.08)"
            onclick="EmployeeModule.setFilter('face','missing')" title="Filter: belum daftar wajah">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">📷 Face</div>
            <div style="font-size:18px;font-weight:700;color:${hasFace<total?'#f59e0b':'#6366f1'};font-family:var(--font-mono)">${hasFace}/${total}</div>
          </div>`;
        })()}
      </div>


      ${canFinance ? `<!-- Total Gaji Card -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:var(--s3);box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Total Gaji Keseluruhan</div>
          <div style="font-size:18px;font-weight:800;color:var(--primary-h);font-family:var(--font-mono);margin-top:2px">
            ${Utils.formatRupiah(active.reduce((s,e)=>s+(e.gaji||0),0),false)}
          </div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px">${active.length} karyawan aktif</div>
        </div>
        <div style="font-size:28px;opacity:.3">💰</div>
      </div>` : ''}

<!-- Missing Grup Gajian warning -->
      ${missingGrup > 0 ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.35);border-radius:8px;margin-bottom:var(--s3)">
        <svg viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2" width="16" height="16" style="flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style="font-size:13px;color:#c2410c;font-weight:500">${missingGrup} karyawan belum memiliki Grup Gajian</span>
        ${canEdit ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto;color:#c2410c;border-color:rgba(249,115,22,.4)" onclick="EmployeeModule.setFilter('grup','__none__')">Lihat</button>` : ''}
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
        <select class="form-control" style="width:130px" onchange="EmployeeModule.setFilter('grup',this.value)">
          <option value="">Semua Grup</option>
          ${['5','12','19','26'].map(g=>`<option value="${g}" ${_filterGrup===g?'selected':''}>Tgl ${g}</option>`).join('')}
          <option value="__none__" ${_filterGrup==='__none__'?'selected':''}>⚠ Belum diisi</option>
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
              <th onclick="EmployeeModule.sortBy('grupGajian')" style="cursor:pointer">Grup Gajian${sortIcon('grupGajian')}</th>
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
                        <div style="display:flex;align-items:center;gap:5px">
                          <span style="font-weight:600">${emp.nama||''}</span>
                          ${emp.ktpUrl ? `<span title="KTP tersedia" style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.25);flex-shrink:0">🪪 KTP</span>` : ''}
                          ${emp.faceDescriptors?.length ? `<span title="Wajah terdaftar" style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(99,102,241,.12);color:#6366f1;border:1px solid rgba(99,102,241,.25);flex-shrink:0">📷 Face</span>` : ''}
                        </div>
                        ${emp.noHp ? `<div class="text-small text-muted">${emp.noHp}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="text-muted text-small">${emp.nik||emp.nip||'-'}</td>
                  <td>${emp.jabatan||'-'}</td>
                  <td><span class="badge badge-neutral">${emp.divisi||emp.departemen||'-'}</span></td>
                  <td onclick="event.stopPropagation()">${_statusDropdown(emp)}</td>
                  <td onclick="event.stopPropagation()">${emp.grupGajian
                    ? `<span style="padding:2px 8px;border-radius:4px;background:rgba(99,102,241,.12);color:var(--primary-h);border:1px solid rgba(99,102,241,.3);font-size:11px;font-weight:700">Tgl ${emp.grupGajian}</span>`
                    : `<button class="btn btn-ghost btn-sm" style="color:#c2410c;border-color:rgba(249,115,22,.4);font-size:11px;padding:2px 8px" onclick="EmployeeModule.openEmpModal('${emp.id}')">⚠ Isi</button>`}
                  </td>
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
              }).join('') : `<tr><td colspan="${8+(canFinance?2:0)+(canEdit?1:0)}">
                ${UI.empty({iconKey:'user', title:'Belum ada data karyawan', desc:'Tambah karyawan baru untuk mulai'})}
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

  let _filterKtp = '';
  let _filterFace = '';
  function setFilter(key, val) {
    if (key==='status') _filterStatus = val;
    else if (key==='dept') _filterDept = val;
    else if (key==='grup') _filterGrup = val;
    else if (key==='ktp') _filterKtp = _filterKtp===val ? '' : val;
    else if (key==='face') _filterFace = _filterFace===val ? '' : val;
    else if (key==='reset') { _filterStatus=''; _filterDept=''; _filterGrup=''; _filterKtp=''; _filterFace=''; }
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
      el.innerHTML = UI.empty({iconKey:'user', title:'Belum ada data karyawan', height:'40vh'});
      return;
    }

    // Show all cards grid
    el.innerHTML = `
      <div style="margin-bottom:var(--s3)">
        <input type="text" class="form-control" style="max-width:300px" placeholder="Cari karyawan..."
          oninput="EmployeeModule.filterCards(this.value)" id="card-search">
      </div>
      <style>
        @keyframes empCardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .emp-card-anim{animation:empCardIn .3s ease both}
      </style>
      <div id="cards-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s4)">
        ${active.map((emp,i) => _cardHTML(emp,i)).join('')}
      </div>
    `;
  }

  function filterCards(q) {
    const lower = q.toLowerCase();
    const active = _employees.filter(e=>e.status!=='Arsip');
    const filtered = lower ? active.filter(e=>(e.nama||'').toLowerCase().includes(lower)||(e.jabatan||'').toLowerCase().includes(lower)) : active;
    const grid = document.getElementById('cards-grid');
    if (grid) grid.innerHTML = filtered.map((emp,i)=>_cardHTML(emp,i)).join('');
  }

  function _cardHTML(emp, idx=0) {
    const statusColor = ['AKTIF','ACTIVE','Active','Tetap'].includes(emp.status)?'var(--success)'
      : ['Kontrak','CONTRACT','Percobaan'].includes(emp.status)?'var(--warning)'
      : ['RESIGN','Resign'].includes(emp.status)?'var(--danger)'
      : 'var(--text-3)';
    const empLogs    = _logs.filter(l=>((l.employeeId===emp.id||_nameMatch(l.nama,emp.nama))||_nameMatch(l.nama,emp.nama))).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')).slice(0,3);
    const canEdit    = Auth.can('employee','edit');
    const canFinance = Auth.can('emp_finance','view');

    const delay = Math.min(idx*40, 600);
    return `<div class="emp-card-anim" onclick="EmployeeModule.viewCard('${emp.id}')" style="cursor:pointer;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);
                         overflow:hidden;transition:all .2s;box-shadow:0 1px 4px rgba(0,0,0,.08);animation-delay:${delay}ms"
                  onmouseover="this.style.borderColor='var(--primary)';this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
                  onmouseout="this.style.borderColor='var(--border)';this.style.transform='';this.style.boxShadow='0 1px 4px rgba(0,0,0,.08)'">

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
      ${canEdit ? `<div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="EmployeeModule.openEmpModal('${emp.id}')">Edit</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="EmployeeModule.openLogModal('','${emp.id}')">+ Log</button>
        ${window.FaceAttendanceModule ? `<button class="btn btn-ghost btn-sm" style="flex:1;font-size:11px;${emp.faceDescriptors?.length?'color:var(--success)':''}" onclick="FaceAttendanceModule.openRegisterModal('${emp.id}')" title="${emp.faceDescriptors?.length?'Wajah sudah terdaftar — klik untuk update':'Belum ada data wajah'}">
          ${emp.faceDescriptors?.length ? '✅ Wajah' : '📷 Wajah'}
        </button>` : ''}
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
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
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
          ${canEdit ? `<div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="EmployeeModule.openEmpModal('${emp.id}')">Edit Data</button>
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="EmployeeModule.openLogModal('','${emp.id}')">+ Log</button>
            ${window.FaceAttendanceModule ? `<button class="btn btn-ghost btn-sm" style="width:100%;font-size:12px;${emp.faceDescriptors?.length?'border-color:rgba(34,197,94,.4);color:var(--success)':''}" onclick="FaceAttendanceModule.openRegisterModal('${emp.id}')">
              ${emp.faceDescriptors?.length ? '✅ Wajah Terdaftar — Update' : '📷 Daftarkan Wajah'}
            </button>` : ''}
          </div>` : ''}
        </div>

        <!-- Right Column: KTP + Log History -->
        <div style="display:flex;flex-direction:column;gap:var(--s4)">

        <!-- Foto KTP -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
          <div style="padding:12px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:14px;font-weight:700;color:var(--heading)">🪪 Foto KTP</div>
            ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="EmployeeModule.openEmpModal('${emp.id}')">Edit / Upload KTP</button>` : ''}
          </div>
          <div style="padding:16px;text-align:center;min-height:80px;display:flex;align-items:center;justify-content:center">
            ${emp.ktpUrl
              ? `<img src="${emp.ktpUrl}" style="max-width:100%;max-height:260px;border-radius:var(--r);object-fit:contain;cursor:zoom-in;box-shadow:var(--shadow)"
                      onclick="EmployeeModule._viewPhoto(this.src)" title="Klik untuk perbesar">`
              : `<div style="color:var(--text-3);font-size:13px">Belum ada foto KTP${canEdit ? ' · Klik "Edit / Upload KTP" untuk menambahkan' : ''}</div>`}
          </div>
        </div>

        ${canFinance ? `<!-- Log History (hanya untuk user dengan akses keuangan) -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div style="font-size:14px;font-weight:700;color:var(--heading)">Riwayat Log (${empLogs.length})</div>
            ${(()=>{
              const tH = empLogs.reduce((s,l)=>s+(l.hutang||(l.jenis==='BERHUTANG'?l.jumlah:0)||0),0);
              const tB = empLogs.reduce((s,l)=>s+(l.bayar||(l.jenis==='BAYAR HUTANG'?l.jumlah:0)||0),0);
              const sisa = Math.max(0,tH-tB);
              return `<div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap">
                <span>Total Hutang: <strong style="color:var(--danger);font-family:var(--font-mono)">${Utils.formatRupiah(tH)}</strong></span>
                <span>Total Bayar: <strong style="color:var(--success);font-family:var(--font-mono)">${Utils.formatRupiah(tB)}</strong></span>
                <span>Sisa: <strong style="color:${sisa>0?'var(--danger)':'var(--success)'};font-family:var(--font-mono)">${Utils.formatRupiah(sisa)}</strong></span>
              </div>`;
            })()}
          </div>
          ${empLogs.length ? `
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
                    const konf   = l.konfirmasi==='CONFIRMED'?'<span class="badge badge-success" style="font-size:10px">\u2713</span>':'<span class="badge badge-neutral" style="font-size:10px">\u2014</span>';
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
            </div>` : `<div style="text-align:center;padding:40px;color:var(--text-3)">Belum ada log</div>`}
        </div>` : ''}

        </div><!-- /right column -->
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
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 16px;min-width:130px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
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
        <button onclick="EmployeeModule.reArrangeLb()" title="Urutkan" style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text-3);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;white-space:nowrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M3 6h18M3 12h12M3 18h6"/></svg>Re-arrange</button>
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
    _lbPage = 1;
    renderLogbook();
  }
  function goLbPage(p) { _lbPage = Math.max(1,p); renderLogbook(); }
  function setLbPerPage(n) { _lbPerPage = n; localStorage.setItem('becca_lb_perPage',n); _lbPage = 1; renderLogbook(); }

  function _renderLogRows() {
    const BULAN_LABEL = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const filterNama  = document.getElementById('lb-filter-nama')?.value  || '';
    const filterBulan = document.getElementById('lb-filter-bulan')?.value || '';
    const filterKonf  = document.getElementById('lb-filter-konf')?.value  || '_all_';
    const from        = document.getElementById('lb-filter-from')?.value  || '';
    const to          = document.getElementById('lb-filter-to')?.value    || '';
    const canEdit     = Auth.can('employee','edit');
    const cols        = canEdit ? 8 : 7;

    let logs = [..._logs];
    if (filterNama)            logs = logs.filter(l=>l.nama===filterNama);
    if (filterBulan)           logs = logs.filter(l=>String(l.bulan)===filterBulan);
    if (filterKonf !== '_all_') logs = logs.filter(l=>l.konfirmasi===filterKonf);
    if (from) logs = logs.filter(l=>((l.tanggal||l.tgl)||'')>=from);
    if (to)   logs = logs.filter(l=>((l.tanggal||l.tgl)||'')<=to);

    if (!logs.length) return `<tr><td colspan="${cols}" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada log</td></tr>`;

    // Subtotal rows
    const subHutang = logs.reduce((s,l)=>s+(l.hutang||(l.jenis==='BERHUTANG'?l.jumlah:0)||0),0);
    const subBayar  = logs.reduce((s,l)=>s+(l.bayar||(l.jenis==='BAYAR HUTANG'?l.jumlah:0)||0),0);

    // Pagination
    const totalPg = Math.max(1, Math.ceil(logs.length / _lbPerPage));
    if (_lbPage > totalPg) _lbPage = totalPg;
    const paged = logs.slice((_lbPage-1)*_lbPerPage, _lbPage*_lbPerPage);
    const rows = paged.map((l,i) => _lbRowView(l, (_lbPage-1)*_lbPerPage+i+1)).join('');

    // Inject pagination bar after render
    setTimeout(() => {
      let pgEl = document.getElementById('lb-pagination');
      if (!pgEl) {
        pgEl = document.createElement('div'); pgEl.id = 'lb-pagination';
        pgEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;font-size:11px;color:var(--text-3);margin-top:4px';
        const tbl = document.querySelector('#emp-tab-logbook .table-wrapper');
        if (tbl) tbl.parentNode.insertBefore(pgEl, tbl.nextSibling);
      }
      pgEl.innerHTML = `
        <span>Hal ${_lbPage}/${totalPg} &middot; ${logs.length} entri</span>
        <div style="display:flex;align-items:center;gap:4px">
          <select onchange="EmployeeModule.setLbPerPage(+this.value)" style="padding:3px 6px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);font-size:11px;cursor:pointer">
            ${[20,50,100].map(n=>`<option value="${n}" ${_lbPerPage===n?'selected':''}>${n}/hal</option>`).join('')}
          </select>
          <button onclick="EmployeeModule.goLbPage(${_lbPage-1})" ${_lbPage<=1?'disabled':''} style="padding:3px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);cursor:pointer;font-size:11px">&lsaquo;</button>
          <button onclick="EmployeeModule.goLbPage(${_lbPage+1})" ${_lbPage>=totalPg?'disabled':''} style="padding:3px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);color:var(--text);cursor:pointer;font-size:11px">&rsaquo;</button>
        </div>`;
    }, 50);

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
    Modal.open({ id: mid, lazy: true,
      title: editId ? 'Edit Karyawan' : 'Tambah Karyawan',
      size: 'modal-lg',
      body: `<form id="emp-form">
        <!-- Foto Karyawan + KTP -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s4);margin-bottom:var(--s4)">
          <!-- Foto Diri -->
          <div class="form-group" style="display:flex;align-items:center;gap:12px;margin-bottom:0">
            <div id="emp-foto-preview" style="width:60px;height:60px;border-radius:50%;overflow:hidden;flex-shrink:0;
                 background:var(--surface2);border:2px dashed var(--border2);display:flex;align-items:center;justify-content:center">
              ${d.fotoUrl ? '<img src="'+d.fotoUrl+'" style="width:100%;height:100%;object-fit:cover">' : '<span style="font-size:24px">👤</span>'}
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;font-weight:600">Foto Diri</div>
              <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:4px;display:block" onclick="EmployeeModule._pickFoto()">
                📷 Pilih Foto
              </button>
              ${d.fotoUrl ? '<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);display:block" onclick="EmployeeModule._removeFoto()">✕ Hapus</button>' : ''}
              <div style="font-size:10px;color:var(--text-3)">Kamera / Galeri</div>
            </div>
          </div>
          <!-- Foto KTP -->
          <div class="form-group" style="display:flex;align-items:center;gap:12px;margin-bottom:0">
            <div id="emp-ktp-preview" style="width:100px;height:62px;border-radius:6px;overflow:hidden;flex-shrink:0;
                 background:var(--surface2);border:2px dashed var(--border2);display:flex;align-items:center;justify-content:center">
              ${d.ktpUrl ? '<img src="'+d.ktpUrl+'" style="width:100%;height:100%;object-fit:contain">' : '<span style="font-size:20px">🪪</span>'}
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;font-weight:600">Foto KTP</div>
              <button type="button" class="btn btn-ghost btn-sm" style="margin-bottom:4px;display:block" onclick="EmployeeModule._pickKtp()">
                🪪 Pilih KTP
              </button>
              ${d.ktpUrl ? '<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);display:block" onclick="EmployeeModule._removeKtp()">✕ Hapus</button>' : ''}
              <div style="font-size:10px;color:var(--text-3)">Kamera / Galeri</div>
            </div>
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
            <label class="form-label">Divisi / Departemen</label>
            <input name="departemen" class="form-control" value="${d.departemen||d.divisi||''}" list="dept-list-${mid}" autocomplete="off" placeholder="Pilih atau ketik divisi...">
            <datalist id="dept-list-${mid}">
              ${[...new Set(_employees.map(e=>e.divisi||e.departemen).filter(Boolean))].sort().map(div=>`<option value="${div}">`).join('')}
            </datalist>
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
            <label class="form-label">Grup Gajian <span class="req">*</span></label>
            <select name="grupGajian" class="form-control" style="${!d.grupGajian?'border-color:rgba(249,115,22,.6)':''}">
              <option value="">— Pilih Tanggal Gajian —</option>
              ${['5','12','19','26'].map(g=>`<option value="${g}" ${d.grupGajian===g?'selected':''}>Tanggal ${g}</option>`).join('')}
            </select>
            ${!d.grupGajian ? `<div style="font-size:11px;color:#c2410c;margin-top:3px">⚠ Wajib diisi agar tidak tertinggal saat payroll</div>` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Tgl Masuk</label>
            <input type="date" name="tglMasuk" class="form-control" value="${d.tglMasuk||''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Gaji Pokok</label>
            <input type="number" name="gajiPokok" class="form-control" value="${d.gajiPokok||0}">
          </div>
          <div class="form-group">
            <label class="form-label">No. Rekening</label>
            <input name="noRek" class="form-control" value="${d.noRek||''}">
          </div>
        </div>
        <div class="form-row">
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
    if (!data.grupGajian) { Notify.warning('Grup Gajian belum diisi untuk ' + data.nama + ' — karyawan bisa tertinggal saat payroll'); }
    data.gajiPokok = parseInt(data.gajiPokok)||0;
    if (editId) data.id = editId;

    // Satu lookup untuk foto + KTP (bukan dua kali)
    const existing = editId ? _employees.find(e => e.id === editId) : null;

    if (_tempFotoUrl && _tempFotoUrl !== '__remove__')      data.fotoUrl = _tempFotoUrl;
    else if (_tempFotoUrl === '__remove__')                 data.fotoUrl = '';
    else if (existing?.fotoUrl)                            data.fotoUrl = existing.fotoUrl;
    _tempFotoUrl = null;

    if (_tempKtpUrl && _tempKtpUrl !== '__remove__')       data.ktpUrl = _tempKtpUrl;
    else if (_tempKtpUrl === '__remove__')                 data.ktpUrl = '';
    else if (existing?.ktpUrl)                             data.ktpUrl = existing.ktpUrl;
    _tempKtpUrl = null;

    // Feedback instan: disable tombol Simpan agar tidak double-submit
    const btn = document.querySelector(`#modal-${mid} .btn-primary`);
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    try {
      const saved = await DB.saveEmployee(data);
      const idx   = _employees.findIndex(e => e.id === saved.id);
      if (idx >= 0) _employees[idx] = saved; else _employees.push(saved);

      // Tutup modal DULU — user tidak perlu nunggu re-render tabel
      Modal.close(mid);
      Notify.success(editId ? 'Data diperbarui' : 'Karyawan ditambahkan');
      renderData();
      DB.logActivity({ type: 'employee', detail: (editId ? 'Edit: ' : 'Tambah: ') + data.nama });
    } catch(e) {
      if (btn) { btn.disabled = false; btn.textContent = editId ? 'Simpan' : 'Tambah'; }
      Notify.error('Gagal', e.message);
    }
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
  let _tempKtpUrl  = null;

  // Compress foto to JPEG 256px max, ~70% quality (≈15-30KB result)
  function _compressFoto(dataUrl, maxPx, quality) {
    maxPx   = maxPx   || 256;
    quality = quality || 0.72;
    return new Promise(function(resolve) {
      const timer = setTimeout(function() { resolve(null); }, 15000);
      const img = new Image();
      img.onload = function() {
        clearTimeout(timer);
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const w = Math.round(img.width  * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function() {
        clearTimeout(timer);
        Notify.error('Gagal memproses foto');
        resolve(null);
      };
      img.src = dataUrl;
    });
  }

  function _handleFotoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10*1024*1024) { Notify.warning('Foto terlalu besar. Maks 10MB.'); return; }
    const reader = new FileReader();
    reader.onload = async function(e) {
      const compressed = await _compressFoto(e.target.result);
      if (!compressed) return;
      _tempFotoUrl = compressed;
      const prev = document.getElementById('emp-foto-preview');
      if (prev) prev.innerHTML = '<img src="'+compressed+'" style="width:100%;height:100%;object-fit:cover">';
    };
    reader.onerror = function() { Notify.error('Gagal membaca file'); };
    reader.readAsDataURL(file);
  }

  function _removeFoto() {
    _tempFotoUrl = '__remove__';
    const prev = document.getElementById('emp-foto-preview');
    if (prev) prev.innerHTML = '<span style="font-size:20px">👤</span>';
  }

  function _handleKtpUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10*1024*1024) { Notify.warning('Foto KTP terlalu besar. Maks 10MB.'); return; }
    const reader = new FileReader();
    reader.onload = async function(e) {
      const compressed = await _compressFoto(e.target.result, 700, 0.85);
      if (!compressed) return;
      _tempKtpUrl = compressed;
      const prev = document.getElementById('emp-ktp-preview');
      if (prev) prev.innerHTML = '<img src="'+compressed+'" style="width:100%;height:100%;object-fit:contain">';
    };
    reader.onerror = function() { Notify.error('Gagal membaca file KTP'); };
    reader.readAsDataURL(file);
  }

  function _removeKtp() {
    _tempKtpUrl = '__remove__';
    const prev = document.getElementById('emp-ktp-preview');
    if (prev) prev.innerHTML = '<span style="font-size:20px">🪪</span>';
  }

  /* === Migrate Photos from localStorage → Supabase === */
  // Dijalankan setiap init — hanya proses employee yang LS punya foto tapi Supabase tidak.
  // Tanpa one-time flag agar bisa recover jika Supabase foto hilang/ditimpa oleh migrasi lain.
  // Handles both fotoUrl (profil) dan ktpUrl (KTP).
  async function migratePhotosFromLS(snapshot) {
    // Bersihkan flag lama agar tidak menghalangi recovery
    localStorage.removeItem('becca_photos_migrated_v2');

    // Gunakan snapshot yang di-capture sebelum _get() menimpa localStorage
    let lsEmps = Array.isArray(snapshot) && snapshot.length ? snapshot : [];
    if (!lsEmps.length) {
      try { lsEmps = JSON.parse(localStorage.getItem('becca_employees') || '[]'); } catch {}
    }
    if (!Array.isArray(lsEmps) || !lsEmps.length) return 0;

    let migrated = 0;
    for (const lsEmp of lsEmps) {
      const dbEmp = _employees.find(e => e.id === lsEmp.id);
      if (!dbEmp) continue;

      let changed = false;

      // Migrate fotoUrl (profil) — hanya jika LS punya foto tapi Supabase tidak
      if (lsEmp.fotoUrl && lsEmp.fotoUrl.startsWith('data:') &&
          (!dbEmp.fotoUrl || !dbEmp.fotoUrl.startsWith('data:'))) {
        try {
          dbEmp.fotoUrl = await _compressFoto(lsEmp.fotoUrl, 256, 0.72);
          changed = true;
        } catch(e) { console.warn('[EMP] compress fotoUrl failed:', lsEmp.id, e.message); }
      }

      // Migrate ktpUrl (KTP) — hanya jika LS punya foto tapi Supabase tidak
      if (lsEmp.ktpUrl && lsEmp.ktpUrl.startsWith('data:') &&
          (!dbEmp.ktpUrl || !dbEmp.ktpUrl.startsWith('data:'))) {
        try {
          dbEmp.ktpUrl = await _compressFoto(lsEmp.ktpUrl, 700, 0.85);
          changed = true;
        } catch(e) { console.warn('[EMP] compress ktpUrl failed:', lsEmp.id, e.message); }
      }

      if (changed) {
        try {
          await DB.saveEmployee({...dbEmp});
          migrated++;
        } catch(e) { console.warn('[EMP] migrate photo save failed:', dbEmp.id, e.message); }
      }
    }

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
    if (_filterGrup === '__none__') filtered = filtered.filter(e => !e.grupGajian);
    else if (_filterGrup) filtered = filtered.filter(e => e.grupGajian === _filterGrup);
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
      tbody.innerHTML = `<tr><td colspan="${8+(canFinance?2:0)+(canEdit?1:0)}" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada data yang cocok</td></tr>`;
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
              ${(() => {
                const hasFace = emp.faceDescriptors?.length > 0 || (window.FaceAttendanceModule && FaceAttendanceModule.getEmpThumbs(emp.id).length > 0);
                const hasKtp  = !!(emp.ktpUrl);
                if (!hasFace && !hasKtp) return '';
                return `<div style="display:flex;gap:3px;margin-top:3px;flex-wrap:wrap">
                  ${hasFace ? `<span title="Wajah terdaftar" style="font-size:10px;padding:1px 6px;border-radius:10px;background:rgba(34,197,94,.12);color:#16a34a;border:1px solid rgba(34,197,94,.3);line-height:1.6">👤 Wajah</span>` : ''}
                  ${hasKtp  ? `<span title="KTP terupload"    style="font-size:10px;padding:1px 6px;border-radius:10px;background:rgba(99,102,241,.1);color:var(--primary-h);border:1px solid rgba(99,102,241,.25);line-height:1.6">🪪 KTP</span>` : ''}
                </div>`;
              })()}
            </div>
          </div>
        </td>
        <td class="text-muted text-small">${emp.nik||emp.nip||'-'}</td>
        <td>${emp.jabatan||'-'}</td>
        <td><span class="badge badge-neutral">${emp.divisi||emp.departemen||'-'}</span></td>
        <td onclick="event.stopPropagation()">${_statusDropdown(emp)}</td>
        <td onclick="event.stopPropagation()">${emp.grupGajian
          ? `<span style="padding:2px 8px;border-radius:4px;background:rgba(99,102,241,.12);color:var(--primary-h);border:1px solid rgba(99,102,241,.3);font-size:11px;font-weight:700">Tgl ${emp.grupGajian}</span>`
          : `<button class="btn btn-ghost btn-sm" style="color:#c2410c;border-color:rgba(249,115,22,.4);font-size:11px;padding:2px 8px" onclick="EmployeeModule.openEmpModal('${emp.id}')">⚠ Isi</button>`}
        </td>
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

  /* ============================================================
     ABSENSI HARIAN
  ============================================================ */
  const _ABS_STATUS = ['H','S','I','A','C'];
  const _ABS_LABEL  = {H:'Hadir', S:'Sakit', I:'Izin', A:'Alpha', C:'Cuti'};
  const _ABS_COLOR  = {
    H:'background:rgba(34,197,94,.15);color:#16a34a;border:1px solid rgba(34,197,94,.4)',
    S:'background:rgba(234,179,8,.15);color:#b45309;border:1px solid rgba(234,179,8,.4)',
    I:'background:rgba(59,130,246,.15);color:#2563eb;border:1px solid rgba(59,130,246,.4)',
    A:'background:rgba(239,68,68,.18);color:#dc2626;border:1px solid rgba(239,68,68,.4)',
    C:'background:rgba(139,92,246,.15);color:#7c3aed;border:1px solid rgba(139,92,246,.4)',
  };

  // Returns {start, end} as 'YYYY-MM-DD' for a grup gajian's work period
  // e.g. grupGajian='5', bulan=3, tahun=2026 → start='2026-02-05', end='2026-03-04'
  function _grupDateRange(grupGajian, bulan, tahun) {
    if (!grupGajian) {
      // Fallback: calendar month
      const daysInMonth = new Date(tahun, bulan, 0).getDate();
      return {
        start: tahun + '-' + String(bulan).padStart(2,'0') + '-01',
        end:   tahun + '-' + String(bulan).padStart(2,'0') + '-' + String(daysInMonth).padStart(2,'0'),
      };
    }
    const tgl = parseInt(grupGajian);
    let prevMonth = bulan - 1, prevYear = tahun;
    if (prevMonth === 0) { prevMonth = 12; prevYear--; }
    const start = prevYear + '-' + String(prevMonth).padStart(2,'0') + '-' + String(tgl).padStart(2,'0');
    const end   = tahun   + '-' + String(bulan).padStart(2,'0')     + '-' + String(tgl - 1).padStart(2,'0');
    return {start, end};
  }

  // Count Mon-Sat days between two 'YYYY-MM-DD' strings (inclusive)
  function _countWorkdays(startStr, endStr) {
    const cur = new Date(startStr + 'T00:00:00');
    const fin = new Date(endStr   + 'T00:00:00');
    let count = 0;
    while (cur <= fin) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate()+1); }
    return count;
  }

  function renderAbsensi() {
    const el = document.getElementById('emp-tab-absensi');
    if (!el) return;
    const ACTIVE = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const emps   = _employees.filter(e => ACTIVE.includes(e.status));
    if (!emps.length) {
      el.innerHTML = UI.empty({iconKey:'user', title:'Belum ada karyawan aktif'});
      return;
    }
    const year  = _absYear;
    const month = _absMonth;
    const daysInMonth = new Date(year, month, 0).getDate();
    const days  = Array.from({length: daysInMonth}, (_,i) => i+1);
    const DAY_SH = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
    const _now   = new Date();
    const todayY = _now.getFullYear(), todayM = _now.getMonth()+1, todayD = _now.getDate();
    const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    // Lookup: (empId or empNama) + '_' + tgl → absensi record
    const absMap = {};
    _absensi.forEach(a => {
      if (!a.tgl) return;
      const d = new Date(a.tgl + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() + 1 === month) {
        absMap[(a.empId || a.empNama) + '_' + a.tgl] = a;
      }
    });

    const canEdit = Auth.can('employee','edit');

    el.innerHTML = `
      <div class="filter-bar" style="margin-bottom:var(--s4)">
        <select class="form-control" style="width:140px" onchange="EmployeeModule._absSetMonth(this.value,'month')">
          ${MONTH_NAMES.map((m,i)=>`<option value="${i+1}" ${(i+1)===month?'selected':''}>${m}</option>`).join('')}
        </select>
        <select class="form-control" style="width:90px" onchange="EmployeeModule._absSetMonth(this.value,'year')">
          ${[year-1,year,year+1].map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}
        </select>
        <div style="margin-left:auto;display:flex;gap:var(--s2);flex-wrap:wrap">
          ${window.FaceAttendanceModule ? FaceAttendanceModule.renderToggle() : ''}
          ${FaceAttendanceModule?.isEnabled() ? `
            <button class="btn btn-primary btn-sm" onclick="FaceAttendanceModule.openKioskFullscreen()" title="Mode layar penuh untuk tablet absensi">⛶ Scan</button>
          ` : ''}
          ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="EmployeeModule._bulkAbsensi('H')" title="Tandai semua Hadir hari ini">✅ Hadir Semua</button>
          <button class="btn btn-primary btn-sm" onclick="EmployeeModule.openAbsensiModal()">+ Input</button>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--s3);font-size:12px">
        ${Object.entries(_ABS_LABEL).map(([k,v])=>`<span style="padding:2px 8px;border-radius:4px;${_ABS_COLOR[k]}">${k} = ${v}</span>`).join('')}
        ${canEdit ? '<span style="padding:2px 8px;border-radius:4px;border:1px dashed var(--border);color:var(--text-3);font-size:11px">· = kosong (klik untuk isi)</span>' : ''}
      </div>
      <div class="table-wrapper"><div class="table-scroll" style="-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain">
        <table class="table" style="font-size:12px;min-width:${160+daysInMonth*30}px">
          <thead><tr>
            <th style="min-width:130px;position:sticky;left:0;background:var(--surface);z-index:2">Karyawan</th>
            ${days.map(d=>{
              const dow    = new Date(year,month-1,d).getDay();
              const isToday = year===todayY && month===todayM && d===todayD;
              return `<th style="width:30px;text-align:center;padding:4px 2px;
                ${isToday ? 'background:rgba(99,102,241,.14);border-bottom:2px solid var(--primary)' : ''};
                ${!isToday && dow===0 ? 'color:var(--danger)' : !isToday && dow===6 ? 'color:var(--primary-h)' : ''}">
                <div style="font-size:11px;${isToday?'font-weight:800;color:var(--primary)':''}">${d}</div>
                <div style="font-size:9px;font-weight:400;${isToday?'color:var(--primary)':''}">${DAY_SH[dow]}</div>
              </th>`;
            }).join('')}
            <th style="text-align:center;color:var(--success);white-space:nowrap">H</th>
            <th style="text-align:center;color:var(--warning)">S</th>
            <th style="text-align:center;color:var(--primary-h)">I</th>
            <th style="text-align:center;color:var(--danger)">A</th>
            <th style="text-align:center;color:#7c3aed">C</th>
          </tr></thead>
          <tbody>
            ${(()=>{
              const divisiMap = {};
              emps.forEach(emp => {
                const div = emp.divisi || emp.departemen || 'Lainnya';
                if (!divisiMap[div]) divisiMap[div] = [];
                divisiMap[div].push(emp);
              });
              const colCount = 1 + daysInMonth + 5;
              return Object.keys(divisiMap).sort().map(div => {
                const rows = divisiMap[div].map(emp => {
                  const empKey = emp.id || emp.nama;
                  let cH=0,cS=0,cI=0,cA=0,cC=0;
                  const cells = days.map(d => {
                    const tgl = year+'-'+String(month).padStart(2,'0')+'-'+String(d).padStart(2,'0');
                    const rec = absMap[empKey+'_'+tgl] || absMap[emp.nama+'_'+tgl];
                    const s   = rec ? rec.status : '';
                    if(s==='H')cH++; if(s==='S')cS++; if(s==='I')cI++; if(s==='A')cA++; if(s==='C')cC++;
                    const isSun   = new Date(year,month-1,d).getDay()===0;
                    const isTodayCell = year===todayY && month===todayM && d===todayD;
                    return `<td style="text-align:center;padding:3px 1px;${isTodayCell?'background:rgba(99,102,241,.07)':isSun?'background:rgba(239,68,68,.04)':''}">
                      <span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:4px;font-size:11px;font-weight:700;text-align:center;${s?_ABS_COLOR[s]:'border:1px solid var(--border);color:var(--text-3)'};${canEdit?'cursor:pointer':''}"
                        ${canEdit?`onclick="EmployeeModule._cycleAbsensi('${emp.id}','${emp.nama.replace(/'/g,'')}','${tgl}')"`:''} title="${s?_ABS_LABEL[s]:canEdit?'Klik untuk set':''}">${s||'·'}</span>
                    </td>`;
                  }).join('');
                  return `<tr>
                    <td style="position:sticky;left:0;background:var(--surface);z-index:1;white-space:nowrap">
                      <div style="display:flex;align-items:center;gap:6px">${_empAvatar(emp,22)}<span style="font-weight:500;font-size:12px">${emp.nama}</span></div>
                    </td>
                    ${cells}
                    <td style="text-align:center;font-weight:700;color:var(--success)">${cH||''}</td>
                    <td style="text-align:center;font-weight:700;color:var(--warning)">${cS||''}</td>
                    <td style="text-align:center;font-weight:700;color:var(--primary-h)">${cI||''}</td>
                    <td style="text-align:center;font-weight:700;color:var(--danger)">${cA||''}</td>
                    <td style="text-align:center;font-weight:700;color:#7c3aed">${cC||''}</td>
                  </tr>`;
                }).join('');
                const header = `<tr>
                  <td colspan="${colCount}" style="position:sticky;left:0;background:var(--surface2);padding:5px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);border-top:1px solid var(--border)">
                    ${div} <span style="font-weight:400;opacity:.7">(${divisiMap[div].length})</span>
                  </td>
                </tr>`;
                return header + rows;
              }).join('');
            })()}
          </tbody>
        </table>
      </div></div>`;
  }

  function _absSetMonth(val, type) {
    if (type === 'month') _absMonth = parseInt(val);
    else _absYear = parseInt(val);
    renderAbsensi();
  }

  async function _cycleAbsensi(empId, empNama, tgl) {
    if (!Auth.can('employee','edit')) return;
    const existing = _absensi.find(a => (a.empId===empId || a.empNama===empNama) && a.tgl===tgl);
    const cur  = existing ? _ABS_STATUS.indexOf(existing.status) : -1;
    const next = _ABS_STATUS[cur + 1]; // undefined when at end → clear

    if (!next) {
      if (existing) {
        await DB.deleteEmpAbsensi(existing.id).catch(()=>{});
        _absensi = _absensi.filter(a => a.id !== existing.id);
      }
    } else if (existing) {
      existing.status = next;
      const saved = await DB.saveEmpAbsensi(existing).catch(()=>existing);
      const i = _absensi.findIndex(a => a.id === existing.id);
      if (i >= 0) _absensi[i] = saved;
    } else {
      const rec   = {empId, empNama, tgl, status: next, createdAt: new Date().toISOString()};
      const saved = await DB.saveEmpAbsensi(rec).catch(()=>rec);
      _absensi.push(saved);
    }
    renderAbsensi();
  }

  async function _bulkAbsensi(status) {
    if (!Auth.can('employee','edit')) return;
    const today = new Date().toISOString().split('T')[0];
    const ACTIVE = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const emps   = _employees.filter(e => ACTIVE.includes(e.status));
    for (const emp of emps) {
      const ex = _absensi.find(a => (a.empId===emp.id||a.empNama===emp.nama) && a.tgl===today);
      if (ex) {
        ex.status = status;
        const saved = await DB.saveEmpAbsensi(ex).catch(()=>ex);
        const i = _absensi.findIndex(a=>a.id===ex.id);
        if (i>=0) _absensi[i] = saved;
      } else {
        const rec   = {empId:emp.id, empNama:emp.nama, tgl:today, status, createdAt:new Date().toISOString()};
        const saved = await DB.saveEmpAbsensi(rec).catch(()=>rec);
        _absensi.push(saved);
      }
    }
    const now = new Date();
    _absMonth = now.getMonth()+1; _absYear = now.getFullYear();
    renderAbsensi();
    Notify.success('Absensi hari ini: ' + status + ' untuk ' + emps.length + ' karyawan');
  }

  // Called by FaceAttendanceModule when kiosk records attendance
  function _onFaceAbsensi(rec) {
    if (!_absensi.find(a => a.id === rec.id)) _absensi.push(rec);
    // Refresh absensi tab if currently visible
    if (_activeTab === 'absensi') {
      const d = new Date(rec.tgl + 'T00:00:00');
      _absMonth = d.getMonth() + 1; _absYear = d.getFullYear();
      renderAbsensi();
    }
  }

  function openAbsensiModal(empId, tgl) {
    const ACTIVE = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const empOpts = _employees.filter(e=>ACTIVE.includes(e.status))
      .map(e=>`<option value="${e.id}" data-nama="${e.nama.replace(/"/g,'')}" ${e.id===empId?'selected':''}>${e.nama}</option>`).join('');
    const today = tgl || new Date().toISOString().split('T')[0];
    const mid = Utils.uid();
    Modal.open({ id: mid, title: 'Input Absensi',
      body: `<form id="abs-form">
        <div class="form-group">
          <label class="form-label">Karyawan <span class="req">*</span></label>
          <select name="empId" class="form-control" required id="abs-emp-sel" onchange="EmployeeModule._absEmpChange(this)">
            <option value="">Pilih karyawan...</option>${empOpts}
          </select>
          <input type="hidden" name="empNama" id="abs-emp-nama">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tanggal</label>
            <input type="date" name="tgl" class="form-control" value="${today}">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="status" class="form-control">
              ${_ABS_STATUS.map(s=>`<option value="${s}">${s} — ${_ABS_LABEL[s]}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Keterangan</label>
          <input name="ket" class="form-control" placeholder="Opsional...">
        </div>
      </form>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
               <button class="btn btn-primary" onclick="EmployeeModule._submitAbsensi('${mid}')">Simpan</button>`,
    });
  }

  function _absEmpChange(sel) {
    const opt = sel.options[sel.selectedIndex];
    const el  = document.getElementById('abs-emp-nama');
    if (el) el.value = opt?.dataset?.nama || '';
  }

  async function _submitAbsensi(mid) {
    const fd   = new FormData(document.getElementById('abs-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.empId) { Notify.warning('Pilih karyawan'); return; }
    if (!data.tgl)   { Notify.warning('Tanggal wajib diisi'); return; }
    const emp = _employees.find(e => e.id === data.empId);
    if (emp) data.empNama = emp.nama;
    const ex = _absensi.find(a => (a.empId===data.empId||a.empNama===data.empNama) && a.tgl===data.tgl);
    if (ex) { data.id = ex.id; data.createdAt = ex.createdAt; }
    else { data.createdAt = new Date().toISOString(); }
    try {
      const saved = await DB.saveEmpAbsensi(data);
      if (ex) { const i=_absensi.findIndex(a=>a.id===saved.id); if(i>=0)_absensi[i]=saved; }
      else { _absensi.push(saved); }
      const d = new Date(data.tgl + 'T00:00:00');
      _absMonth = d.getMonth()+1; _absYear = d.getFullYear();
      renderAbsensi();
      Modal.close(mid);
      Notify.success('Absensi disimpan');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  /* ============================================================
     PAYROLL / SLIP GAJI
  ============================================================ */
  function renderPayroll() {
    const el = document.getElementById('emp-tab-payroll');
    if (!el) return;
    const canFinance = Auth.can('emp_finance','view');
    const canEdit    = Auth.can('employee','edit');
    if (!canFinance) {
      el.innerHTML = UI.empty({iconKey:'lock', title:'Akses Terbatas', desc:'Fitur payroll hanya untuk peran dengan akses keuangan'});
      return;
    }
    const year  = _payYear;
    const month = _payMonth;
    const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const monthName  = MONTH_NAMES[month-1];
    const monthPay = _payroll.filter(p => {
      if (p.bulan !== month || p.tahun !== year) return false;
      if (_payGrup) {
        const emp = _employees.find(e => e.id === p.empId);
        return (emp?.grupGajian || '') === _payGrup;
      }
      return true;
    });
    const totalGross = monthPay.reduce((s,p)=>s+(p.gajiPokok||0),0);
    const totalNet   = monthPay.reduce((s,p)=>s+(p.totalGaji||0),0);
    const lunas      = monthPay.filter(p=>p.statusPayroll==='Lunas').length;
    const grupLabel  = _payGrup ? `Tgl ${_payGrup}` : 'Semua Grup';

    el.innerHTML = `
      <div class="filter-bar" style="margin-bottom:var(--s4);flex-wrap:wrap">
        <select class="form-control" style="width:140px" onchange="EmployeeModule._paySetMonth(this.value,'month')">
          ${MONTH_NAMES.map((m,i)=>`<option value="${i+1}" ${(i+1)===month?'selected':''}>${m}</option>`).join('')}
        </select>
        <select class="form-control" style="width:90px" onchange="EmployeeModule._paySetMonth(this.value,'year')">
          ${[year-1,year,year+1].map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}
        </select>
        <select class="form-control" style="width:120px" onchange="EmployeeModule._paySetGrup(this.value)" title="Filter grup gajian">
          <option value="">Semua Grup</option>
          ${['5','12','19','26'].map(g=>`<option value="${g}" ${_payGrup===g?'selected':''}>Tgl ${g}</option>`).join('')}
        </select>
        ${canEdit?`<button class="btn btn-primary btn-sm" onclick="EmployeeModule.generatePayroll()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          Generate${_payGrup?' Tgl '+_payGrup:''}
        </button>
        <button class="btn btn-danger btn-sm" id="pay-batch-del-btn" style="display:none" onclick="EmployeeModule._deletePayrollBatch()">
          🗑 Hapus Terpilih
        </button>`:''}
        <span class="text-muted text-small" style="margin-left:auto">${grupLabel} · ${monthPay.length} karyawan · ${lunas}/${monthPay.length} lunas</span>
      </div>
      ${monthPay.length ? `
      <div style="display:flex;gap:var(--s3);flex-wrap:wrap;margin-bottom:var(--s4)">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;flex:1 1 150px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
          <div style="font-size:11px;color:var(--text-3)">Total Gaji Kotor</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--font-mono)">${Utils.formatRupiah(totalGross,false)}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;flex:1 1 150px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
          <div style="font-size:11px;color:var(--text-3)">Total Take-Home</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--font-mono);color:var(--success)">${Utils.formatRupiah(totalNet,false)}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;flex:1 1 120px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
          <div style="font-size:11px;color:var(--text-3)">Status Pembayaran</div>
          <div style="font-size:16px;font-weight:700">${lunas}/${monthPay.length} Lunas</div>
        </div>
      </div>
      <div class="table-wrapper"><div class="table-scroll" style="-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain">
        <table class="table">
          <thead><tr>
            ${canEdit?`<th style="width:28px;padding:6px 4px"><input type="checkbox" id="pay-check-all" onchange="EmployeeModule._paySelectAll(this)" style="cursor:pointer"></th>`:''}
            <th>#</th><th>Karyawan</th>
            <th class="num">Gaji Pokok</th>
            <th class="num" style="color:var(--danger)">Pot. Alpha</th>
            <th class="num" style="color:var(--danger)">Pot. Hutang</th>
            <th class="num" style="color:var(--success)">Bonus</th>
            <th class="num" style="color:var(--success)">Lembur</th>
            <th class="num" style="font-weight:700">Take-Home</th>
            <th>Periode</th>
            <th>Status</th>
            <th style="width:80px">Aksi</th>
          </tr></thead>
          <tbody>
            ${monthPay.map((p,i)=>{
              const isLunas = p.statusPayroll==='Lunas';
              const emp = _employees.find(e=>e.id===p.empId);
              const grup = emp?.grupGajian || '';
              const range = grup ? _grupDateRange(grup, p.bulan, p.tahun) : null;
              const periodeLabel = range
                ? (() => { const s=new Date(range.start+'T00:00:00'); const e2=new Date(range.end+'T00:00:00');
                    return s.getDate()+'/'+(s.getMonth()+1)+' – '+e2.getDate()+'/'+(e2.getMonth()+1); })()
                : MONTH_NAMES[p.bulan-1];
              return `<tr>
                ${canEdit?`<td style="padding:4px"><input type="checkbox" class="pay-check" data-id="${p.id}" onchange="EmployeeModule._payUpdateBatch()" style="cursor:pointer"></td>`:''}
                <td class="text-muted">${i+1}</td>
                <td style="font-weight:600">
                  <div>${p.empNama||'-'}</div>
                  ${grup?`<div style="font-size:10px;color:var(--primary-h);font-weight:600">Tgl ${grup}</div>`:''}
                </td>
                <td class="num" style="font-family:var(--font-mono)">${Utils.formatRupiah(p.gajiPokok||0,false)}</td>
                <td class="num" style="font-family:var(--font-mono);color:${(p.potonganAbsensi||0)>0?'var(--danger)':'var(--text-3)'}">${(p.potonganAbsensi||0)>0?'- '+Utils.formatRupiah(p.potonganAbsensi,false):'-'}</td>
                <td class="num" style="font-family:var(--font-mono);color:${(p.potonganHutang||0)>0?'var(--danger)':'var(--text-3)'}">${(p.potonganHutang||0)>0?'- '+Utils.formatRupiah(p.potonganHutang,false):'-'}</td>
                <td class="num" style="font-family:var(--font-mono);color:${(p.bonus||0)>0?'var(--success)':'var(--text-3)'}">${(p.bonus||0)>0?'+ '+Utils.formatRupiah(p.bonus,false):'-'}</td>
                <td class="num" style="font-family:var(--font-mono);color:${(p.lembur||0)>0?'var(--success)':'var(--text-3)'}">${(p.lembur||0)>0?'+ '+Utils.formatRupiah(p.lembur,false):'-'}</td>
                <td class="num" style="font-family:var(--font-mono);font-weight:700">${Utils.formatRupiah(p.totalGaji||0,false)}</td>
                <td style="font-size:11px;color:var(--text-3);white-space:nowrap">${periodeLabel}</td>
                <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;${isLunas?'background:rgba(34,197,94,.15);color:#16a34a':'background:rgba(234,179,8,.15);color:#b45309'}">${isLunas?'✓ Lunas':'Draft'}</span></td>
                <td>
                  <div style="display:flex;gap:3px">
                    <button class="btn-icon" title="Slip Gaji" onclick="EmployeeModule.openSlipGaji('${p.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </button>
                    ${canEdit&&!isLunas?`
                    <button class="btn-icon" title="Edit Bonus/Lembur" onclick="EmployeeModule._editPayrollRow('${p.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="btn-icon" title="Tandai Lunas" style="color:var(--success)" onclick="EmployeeModule._markPayrollLunas('${p.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M20 6L9 17l-5-5"/></svg>
                    </button>`:''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div></div>
      ` : UI.empty({iconKey:'money', title:'Belum ada data gaji', desc: canEdit ? 'Klik "Generate" untuk membuat data gaji bulan ini' : 'Belum ada data'})}
    `;
  }

  function _paySetMonth(val, type) {
    if (type === 'month') _payMonth = parseInt(val);
    else _payYear = parseInt(val);
    renderPayroll();
  }

  function _paySetGrup(val) { _payGrup = val; renderPayroll(); }

  function _paySelectAll(cb) {
    document.querySelectorAll('.pay-check').forEach(c => c.checked = cb.checked);
    _payUpdateBatch();
  }

  function _payUpdateBatch() {
    const btn   = document.getElementById('pay-batch-del-btn');
    if (!btn) return;
    const count = document.querySelectorAll('.pay-check:checked').length;
    btn.style.display = count > 0 ? 'inline-flex' : 'none';
    btn.innerHTML = count > 0
      ? `🗑 Hapus ${count} Terpilih`
      : '';
  }

  async function _deletePayrollBatch() {
    const checked = [...document.querySelectorAll('.pay-check:checked')];
    if (!checked.length) return;
    const ids     = checked.map(c => c.dataset.id);
    const hasLunas = ids.some(id => _payroll.find(p => p.id===id && p.statusPayroll==='Lunas'));
    const ok = await Modal.confirm({
      title: 'Hapus Payroll?',
      message: `Hapus <strong>${ids.length}</strong> data payroll yang dipilih?`
        + (hasLunas ? `<br><span style="color:var(--danger);font-size:12px">⚠ Termasuk data yang sudah <strong>Lunas</strong>.</span>` : ''),
      confirmText: 'Hapus',
    });
    if (!ok) return;
    for (const id of ids) {
      await DB.deleteEmpPayroll(id).catch(()=>{});
      _payroll = _payroll.filter(p => p.id !== id);
    }
    renderPayroll();
    Notify.success(ids.length + ' data payroll dihapus');
  }

  async function generatePayroll() {
    const year  = _payYear;
    const month = _payMonth;
    const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const monthName  = MONTH_NAMES[month-1];
    const ACTIVE = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    // Filter employees by active status + grup filter (if active)
    const emps = _employees.filter(e => {
      if (!ACTIVE.includes(e.status)) return false;
      if (_payGrup) return (e.grupGajian || '') === _payGrup;
      return true;
    });
    const existing = _payroll.filter(p => p.bulan===month && p.tahun===year && emps.some(e=>e.id===p.empId));
    if (existing.length) {
      const ok = await Modal.confirm({
        title: 'Tambah ke Payroll?',
        message: `Payroll ${monthName} ${year}${_payGrup?' (Tgl '+_payGrup+')':''} sudah ada (${existing.length} data). Karyawan yang belum ada akan ditambahkan.`,
        confirmText: 'Lanjutkan',
      });
      if (!ok) return;
    }
    let created = 0;
    for (const emp of emps) {
      if (existing.find(p => p.empId === emp.id)) continue;
      // Compute work period based on grup gajian
      const range      = _grupDateRange(emp.grupGajian || '', month, year);
      const hariKerja  = _countWorkdays(range.start, range.end);
      const empAbs = _absensi.filter(a => {
        if (a.empId !== emp.id && a.empNama !== emp.nama) return false;
        return a.tgl >= range.start && a.tgl <= range.end;
      });
      const hariAlpha   = empAbs.filter(a => a.status==='A').length;
      const gajiPokok   = emp.gajiPokok || emp.gaji || 0;
      const gajiPerHari = hariKerja > 0 ? Math.round(gajiPokok / hariKerja) : 0;
      const potAbsensi  = hariAlpha * gajiPerHari;
      const sisaHutang  = emp.sisaHutang || 0;
      const potHutang   = Math.min(sisaHutang, Math.floor(gajiPokok * 0.5));
      const totalGaji   = Math.max(0, gajiPokok - potAbsensi - potHutang);
      const rec = {
        empId: emp.id, empNama: emp.nama,
        bulan: month, tahun: year,
        gajiPokok, potonganAbsensi: potAbsensi, potonganHutang: potHutang,
        bonus: 0, lembur: 0, totalGaji,
        statusPayroll: 'Draft', hariKerja, hariAlpha,
        periodeStart: range.start, periodeEnd: range.end,
        createdAt: new Date().toISOString(),
      };
      try {
        const saved = await DB.saveEmpPayroll(rec);
        _payroll.push(saved);
        created++;
      } catch(e) { console.warn('[Payroll] save failed:', e.message); }
    }
    renderPayroll();
    const grupInfo = _payGrup ? ' · Tgl ' + _payGrup : '';
    Notify.success('Payroll ' + monthName + ' ' + year + grupInfo + ': ' + created + ' karyawan dibuat');
  }

  function openSlipGaji(payId) {
    const p = _payroll.find(x => x.id === payId);
    if (!p) return;
    const emp = _employees.find(e => e.id === p.empId);
    const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const monthName  = MONTH_NAMES[(p.bulan||1)-1];
    const companyName = (window._beccaSettings||{}).namaPerusahaan || (window._beccaSettings||{}).nama || 'Perusahaan';
    const mid = Utils.uid();
    Modal.open({ id: mid, title: 'Slip Gaji — ' + p.empNama, size: 'modal-md',
      body: `<div id="slip-print-${mid}" style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid var(--border);border-radius:8px">
        <div style="text-align:center;border-bottom:2px solid var(--border);padding-bottom:14px;margin-bottom:16px">
          <div style="font-size:18px;font-weight:800;color:var(--heading)">${companyName}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px;text-transform:uppercase;letter-spacing:.06em">Slip Gaji Karyawan</div>
          <div style="font-size:13px;font-weight:700;margin-top:6px">${monthName} ${p.tahun}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px">
          <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase">Nama</div><div style="font-weight:600">${p.empNama}</div></div>
          <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase">Jabatan</div><div style="font-weight:600">${emp?.jabatan||'-'}</div></div>
          <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase">Divisi</div><div style="font-weight:600">${emp?.divisi||emp?.departemen||'-'}</div></div>
          <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase">Status</div><div style="font-weight:600">${emp?.status||'-'}</div></div>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Pendapatan</div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border2)">
            <span>Gaji Pokok (${p.hariKerja||'-'} hari kerja)</span>
            <span style="font-weight:600;font-family:monospace">${Utils.formatRupiah(p.gajiPokok||0,false)}</span>
          </div>
          ${(p.bonus||0)>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border2)"><span>Bonus</span><span style="font-weight:600;font-family:monospace;color:var(--success)">${Utils.formatRupiah(p.bonus,false)}</span></div>`:''}
          ${(p.lembur||0)>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border2)"><span>Lembur</span><span style="font-weight:600;font-family:monospace;color:var(--success)">${Utils.formatRupiah(p.lembur,false)}</span></div>`:''}
        </div>
        ${((p.potonganAbsensi||0)+(p.potonganHutang||0))>0?`
        <div style="margin-bottom:10px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Potongan</div>
          ${(p.potonganAbsensi||0)>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border2)"><span>Alpha (${p.hariAlpha||0} hari)</span><span style="font-weight:600;font-family:monospace;color:var(--danger)">- ${Utils.formatRupiah(p.potonganAbsensi,false)}</span></div>`:''}
          ${(p.potonganHutang||0)>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--border2)"><span>Potongan Hutang</span><span style="font-weight:600;font-family:monospace;color:var(--danger)">- ${Utils.formatRupiah(p.potonganHutang,false)}</span></div>`:''}
        </div>`:''}
        <div style="border-top:2px solid var(--border);padding-top:12px;margin-top:4px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:14px;font-weight:700">TOTAL TAKE-HOME</span>
          <span style="font-size:20px;font-weight:800;font-family:monospace;color:var(--primary-h)">${Utils.formatRupiah(p.totalGaji||0,false)}</span>
        </div>
        <div style="margin-top:20px;padding-top:12px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;font-size:11px;color:var(--text-3)">
          <span>Diterbitkan: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</span>
          <span style="font-weight:700;color:${p.statusPayroll==='Lunas'?'var(--success)':'var(--warning)'}">${p.statusPayroll==='Lunas'?'✓ SUDAH DIBAYAR':'BELUM DIBAYAR'}</span>
        </div>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
               <button class="btn btn-primary" onclick="window.print()">🖨 Cetak</button>`,
    });
  }

  function _editPayrollRow(payId) {
    const p = _payroll.find(x => x.id === payId);
    if (!p) return;
    const mid = Utils.uid();
    Modal.open({ id: mid, title: 'Edit Payroll — ' + p.empNama,
      body: `<form id="pay-edit-form">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Bonus</label>
            <input type="number" name="bonus" class="form-control" value="${p.bonus||0}" min="0"></div>
          <div class="form-group"><label class="form-label">Lembur</label>
            <input type="number" name="lembur" class="form-control" value="${p.lembur||0}" min="0"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Potongan Absensi</label>
            <input type="number" name="potonganAbsensi" class="form-control" value="${p.potonganAbsensi||0}" min="0"></div>
          <div class="form-group"><label class="form-label">Potongan Hutang</label>
            <input type="number" name="potonganHutang" class="form-control" value="${p.potonganHutang||0}" min="0"></div>
        </div>
        <div class="form-group"><label class="form-label">Keterangan</label>
          <input name="ket" class="form-control" value="${p.ket||''}"></div>
      </form>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
               <button class="btn btn-primary" onclick="EmployeeModule._submitPayrollEdit('${mid}','${payId}')">Simpan</button>`,
    });
  }

  async function _submitPayrollEdit(mid, payId) {
    const fd = new FormData(document.getElementById('pay-edit-form'));
    const p  = _payroll.find(x => x.id === payId);
    if (!p) return;
    p.bonus           = parseInt(fd.get('bonus'))||0;
    p.lembur          = parseInt(fd.get('lembur'))||0;
    p.potonganAbsensi = parseInt(fd.get('potonganAbsensi'))||0;
    p.potonganHutang  = parseInt(fd.get('potonganHutang'))||0;
    p.ket             = fd.get('ket')||'';
    p.totalGaji = Math.max(0, (p.gajiPokok||0) - p.potonganAbsensi - p.potonganHutang + p.bonus + p.lembur);
    try {
      const saved = await DB.saveEmpPayroll(p);
      const i = _payroll.findIndex(x => x.id === payId);
      if (i >= 0) _payroll[i] = saved;
      renderPayroll();
      Modal.close(mid);
      Notify.success('Payroll diperbarui');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  async function _markPayrollLunas(payId) {
    const p = _payroll.find(x => x.id === payId);
    if (!p) return;
    const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const bulanNama  = MONTH_NAMES[(p.bulan||1)-1];
    const potHutang  = p.potonganHutang || 0;
    const ok = await Modal.confirm({
      title: 'Tandai Lunas?',
      message: `Gaji <strong>${p.empNama}</strong> sebesar <strong>${Utils.formatRupiah(p.totalGaji,false)}</strong> sudah dibayarkan?`
        + (potHutang > 0 ? `<br><span style="font-size:12px;color:var(--warning)">⚠ Potongan hutang ${Utils.formatRupiah(potHutang,false)} akan otomatis dicatat di logbook.</span>` : ''),
      confirmText: 'Ya, Lunas',
    });
    if (!ok) return;
    p.statusPayroll = 'Lunas';
    p.tglDibayar    = new Date().toISOString().split('T')[0];
    try {
      const saved = await DB.saveEmpPayroll(p);
      const i = _payroll.findIndex(x => x.id === payId);
      if (i >= 0) _payroll[i] = saved;

      // Auto-catat bayar hutang ke logbook jika ada potongan hutang
      if (potHutang > 0) {
        const logEntry = {
          employeeId:  p.empId,
          nama:        p.empNama,
          tgl:         p.tglDibayar,
          bulan:       p.bulan,
          hutang:      0,
          bayar:       potHutang,
          ket:         'Potongan gaji ' + bulanNama + ' ' + p.tahun,
          pj:          'Payroll',
          konfirmasi:  'CONFIRMED',
        };
        const savedLog = await DB.saveEmployeeLog(logEntry).catch(() => null);
        if (savedLog) {
          _logs.push(savedLog);
          _lbLocked.add(savedLog.id);
          _lbSaveLocks();
          _recalcHutang(p.empNama);
          Notify.success('Gaji ' + p.empNama + ' lunas ✓ · Bayar hutang ' + Utils.formatRupiah(potHutang,false) + ' dicatat di logbook');
        } else {
          Notify.success('Gaji ' + p.empNama + ' ditandai lunas ✓');
        }
      } else {
        Notify.success('Gaji ' + p.empNama + ' ditandai lunas ✓');
      }

      renderPayroll();
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  /* ============================================================
     JADWAL SHIFT
  ============================================================ */
  const _SHIFT_CYCLE = ['','1','2','3','Off'];
  const _SHIFT_LABEL = {'1':'Shift 1','2':'Shift 2','3':'Shift 3','Off':'Off'};
  const _SHIFT_COLOR = {
    '1':'background:rgba(59,130,246,.15);color:#2563eb;border:1px solid rgba(59,130,246,.4)',
    '2':'background:rgba(34,197,94,.15);color:#16a34a;border:1px solid rgba(34,197,94,.4)',
    '3':'background:rgba(249,115,22,.15);color:#c2410c;border:1px solid rgba(249,115,22,.4)',
    'Off':'background:rgba(148,163,184,.15);color:#64748b;border:1px solid rgba(148,163,184,.4)',
  };
  const _JDWL_DAY_NAMES = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  function _getMonday(d) {
    const dt  = new Date(d);
    const day = dt.getDay();
    dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
    dt.setHours(0,0,0,0);
    return dt;
  }

  function renderJadwal() {
    const el = document.getElementById('emp-tab-jadwal');
    if (!el) return;
    if (!_jadwalWeekStart) _jadwalWeekStart = _getMonday(new Date());
    const ACTIVE   = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const emps     = _employees.filter(e => ACTIVE.includes(e.status));
    const canEdit  = Auth.can('employee','edit');
    const weekStart = new Date(_jadwalWeekStart);
    const weekDays  = Array.from({length:7}, (_,i) => { const d=new Date(weekStart); d.setDate(weekStart.getDate()+i); return d; });
    const weekLabel = weekDays[0].toLocaleDateString('id-ID',{day:'numeric',month:'short'}) + ' – ' +
                      weekDays[6].toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
    const today = new Date().toISOString().split('T')[0];

    // Build lookup: (empId or empNama)+'_'+tgl → jadwal
    const jMap = {};
    _jadwal.forEach(j => { jMap[(j.empId||j.empNama)+'_'+j.tgl] = j; });

    el.innerHTML = `
      <div class="filter-bar" style="margin-bottom:var(--s4)">
        <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._jadwalPrevWeek()">← Sebelumnya</button>
        <span style="font-weight:600;font-size:13px;padding:0 var(--s2)">${weekLabel}</span>
        <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._jadwalNextWeek()">Berikutnya →</button>
        <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._jadwalThisWeek()">Minggu Ini</button>
        ${canEdit?`<div style="margin-left:auto;display:flex;gap:var(--s2)">
          <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._jadwalFillAll('1')" title="Isi semua Shift 1 (Senin-Sabtu)">Fill Shift 1</button>
          <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._jadwalFillAll('2')" title="Isi semua Shift 2 (Senin-Sabtu)">Fill Shift 2</button>
          <button class="btn btn-ghost btn-sm" onclick="EmployeeModule._jadwalFillAll('3')" title="Isi semua Shift 3 (Senin-Sabtu)">Fill Shift 3</button>
        </div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--s3);font-size:12px">
        ${Object.entries(_SHIFT_LABEL).map(([k,v])=>`<span style="padding:2px 10px;border-radius:4px;${_SHIFT_COLOR[k]}">${v}</span>`).join('')}
        ${canEdit?'<span style="padding:2px 10px;border-radius:4px;border:1px dashed var(--border);color:var(--text-3);font-size:11px">Klik sel untuk ganti shift</span>':''}
      </div>
      <div class="table-wrapper"><div class="table-scroll" style="-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain">
        <table class="table" style="min-width:660px">
          <thead><tr>
            <th style="min-width:120px;position:sticky;left:0;background:var(--surface);z-index:2">Karyawan</th>
            ${weekDays.map(d=>{
              const tgl    = d.toISOString().split('T')[0];
              const isSun  = d.getDay()===0;
              const isSat  = d.getDay()===6;
              const isTday = tgl===today;
              return `<th style="text-align:center;${isSun?'color:var(--danger)':isSat?'color:var(--primary-h)':''};${isTday?'background:rgba(99,102,241,.06)':''}">
                <div style="font-size:12px;${isTday?'font-weight:800;color:var(--primary-h)':''}">${_JDWL_DAY_NAMES[d.getDay()]}</div>
                <div style="font-size:11px;font-weight:${isTday?700:400};color:var(--text-3)">${d.getDate()}/${d.getMonth()+1}</div>
              </th>`;
            }).join('')}
          </tr></thead>
          <tbody>
            ${(()=>{
              // Group emps by divisi
              const divisiMap = {};
              emps.forEach(emp => {
                const div = emp.divisi || emp.departemen || 'Lainnya';
                if (!divisiMap[div]) divisiMap[div] = [];
                divisiMap[div].push(emp);
              });
              const colCount = 1 + weekDays.length;
              return Object.keys(divisiMap).sort().map(div => {
                const rows = divisiMap[div].map(emp => {
                  const isDS = ['driver','service'].some(k =>
                    (emp.divisi||emp.departemen||'').toLowerCase().includes(k) ||
                    (emp.jabatan||'').toLowerCase().includes(k));
                  const cells = weekDays.map(d=>{
                    const tgl    = d.toISOString().split('T')[0];
                    const rec    = jMap[(emp.id||emp.nama)+'_'+tgl] || jMap[emp.nama+'_'+tgl];
                    const isTday = tgl===today;
                    if (isDS) {
                      const shifts    = rec?.shifts?.length ? rec.shifts : (rec?.shift ? [rec.shift] : []);
                      const customers = rec?.customers || [];
                      const shiftLbl  = shifts.length ? shifts.map(s=>_SHIFT_LABEL[s]||('S'+s)).join(',') : '·';
                      const shiftSty  = shifts.length
                        ? (shifts.length===1 ? _SHIFT_COLOR[shifts[0]] : 'background:rgba(99,102,241,.12);color:#4338ca;border:1px solid rgba(99,102,241,.4)')
                        : 'border:1px dashed var(--border);color:var(--text-3)';
                      const custShort = customers.slice(0,2).map(c=>c.replace(/^PT\.\s*/i,'').split(' ')[0]).join(' · ');
                      return `<td style="text-align:center;padding:3px 2px;${isTday?'background:rgba(99,102,241,.04)':''}">
                        <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
                          <span style="display:inline-block;padding:2px 0;min-width:64px;border-radius:6px;font-size:11px;font-weight:700;${shiftSty};${canEdit?'cursor:pointer':''}"
                            ${canEdit?`onclick="EmployeeModule._openJadwalModal('${emp.id}','${emp.nama.replace(/'/g,"\\'")}','${tgl}')"`:''}>
                            ${shiftLbl}</span>
                          ${customers.length?`<span style="font-size:9px;color:var(--text-3);max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="${Utils.esc(customers.join(', '))}"
                            ${canEdit?`onclick="EmployeeModule._openJadwalModal('${emp.id}','${emp.nama.replace(/'/g,"\\'")}','${tgl}')"`:''}>
                            ${Utils.esc(custShort)}</span>`:''}
                        </div>
                      </td>`;
                    }
                    const shift  = rec ? (rec.shift||'') : '';
                    return `<td style="text-align:center;padding:5px 4px;${isTday?'background:rgba(99,102,241,.04)':''}">
                      <span style="display:inline-block;padding:3px 0;width:68px;border-radius:6px;font-size:12px;font-weight:700;${shift?_SHIFT_COLOR[shift]:'border:1px dashed var(--border);color:var(--text-3)'};${canEdit?'cursor:pointer':''}"
                        ${canEdit?`onclick="EmployeeModule._cycleJadwal('${emp.id}','${emp.nama.replace(/'/g,'')}','${tgl}')"`:''} title="${shift?_SHIFT_LABEL[shift]:canEdit?'Klik untuk set':''}">${shift?_SHIFT_LABEL[shift]:'·'}</span>
                    </td>`;
                  }).join('');
                  return `<tr>
                    <td style="position:sticky;left:0;background:var(--surface);z-index:1;white-space:nowrap">
                      <div style="display:flex;align-items:center;gap:6px">${_empAvatar(emp,22)}<span style="font-weight:500;font-size:12px">${emp.nama}</span></div>
                    </td>${cells}
                  </tr>`;
                }).join('');
                const header = `<tr>
                  <td colspan="${colCount}" style="position:sticky;left:0;background:var(--surface2);padding:5px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);border-top:1px solid var(--border)">
                    ${div} <span style="font-weight:400;opacity:.7">(${divisiMap[div].length})</span>
                  </td>
                </tr>`;
                return header + rows;
              }).join('');
            })()}
          </tbody>
        </table>
      </div></div>`;
  }

  async function _cycleJadwal(empId, empNama, tgl) {
    if (!Auth.can('employee','edit')) return;
    const ex  = _jadwal.find(j => (j.empId===empId||j.empNama===empNama) && j.tgl===tgl);
    const cur = _SHIFT_CYCLE.indexOf(ex ? (ex.shift||'') : '');
    const next = _SHIFT_CYCLE[(cur+1) % _SHIFT_CYCLE.length];
    if (!next) {
      if (ex) {
        await DB.deleteEmpJadwal(ex.id).catch(()=>{});
        _jadwal = _jadwal.filter(j => j.id !== ex.id);
      }
    } else if (ex) {
      ex.shift = next;
      const saved = await DB.saveEmpJadwal(ex).catch(()=>ex);
      const i = _jadwal.findIndex(j => j.id === ex.id);
      if (i >= 0) _jadwal[i] = saved;
    } else {
      const rec   = {empId, empNama, tgl, shift: next, createdAt: new Date().toISOString()};
      const saved = await DB.saveEmpJadwal(rec).catch(()=>rec);
      _jadwal.push(saved);
    }
    renderJadwal();
  }

  function _jadwalPrevWeek() { _jadwalWeekStart = new Date(_jadwalWeekStart); _jadwalWeekStart.setDate(_jadwalWeekStart.getDate()-7); renderJadwal(); }
  function _jadwalNextWeek() { _jadwalWeekStart = new Date(_jadwalWeekStart); _jadwalWeekStart.setDate(_jadwalWeekStart.getDate()+7); renderJadwal(); }
  function _jadwalThisWeek() { _jadwalWeekStart = _getMonday(new Date()); renderJadwal(); }

  async function _jadwalFillAll(shift) {
    if (!Auth.can('employee','edit')) return;
    if (_jadwalFilling) return; // prevent concurrent execution
    _jadwalFilling = true;

    const ACTIVE = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const emps   = _employees.filter(e => ACTIVE.includes(e.status));
    if (!_jadwalWeekStart) _jadwalWeekStart = _getMonday(new Date());
    const ws = new Date(_jadwalWeekStart);

    // Step 1: update _jadwal array in memory synchronously — instant UI
    const toSave = [];
    for (const emp of emps) {
      for (let i = 0; i < 6; i++) { // Mon→Sat, skip Sun
        const d = new Date(ws);
        d.setDate(ws.getDate() + i);
        const tgl = d.toISOString().split('T')[0];
        const ex  = _jadwal.find(j => (j.empId===emp.id || j.empNama===emp.nama) && j.tgl===tgl);
        if (ex) {
          ex.shift = shift;
          toSave.push({type:'update', rec: ex});
        } else {
          const rec = {id: Utils.uid(), empId: emp.id, empNama: emp.nama, tgl, shift, createdAt: new Date().toISOString()};
          _jadwal.push(rec);
          toSave.push({type:'insert', rec});
        }
      }
    }

    // Step 2: render immediately — user sees result right away
    renderJadwal();
    Notify.success('Jadwal Shift ' + shift + ' — ' + emps.length + ' karyawan ✓');

    // Step 3: persist to DB in parallel (background)
    await Promise.all(toSave.map(({rec}) => DB.saveEmpJadwal(rec).catch(()=>{}))).finally(() => {
      _jadwalFilling = false;
    });
  }

  // ── Jadwal Modal (Driver / Service multi-shift + customer) ──
  async function _openJadwalModal(empId, empNama, tgl) {
    if (!Auth.can('employee','edit')) return;
    const mid = 'jdwl-' + Utils.uid();
    const rec = _jadwal.find(j => (j.empId===empId||j.empNama===empNama) && j.tgl===tgl);
    const currentShifts = rec?.shifts?.length ? rec.shifts : (rec?.shift ? [rec.shift] : []);
    const currentCusts  = rec?.customers || [];
    const invData   = await DB.getInvoices().catch(() => []);
    const custNames = [...new Set(invData.map(i => i.customer || i.data?.customer).filter(Boolean))].sort();
    const tglFmt = new Date(tgl+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

    Modal.open({
      id: mid,
      title: `🗓 Jadwal — ${empNama}`,
      size: 'modal-md',
      body: `
        <div style="font-size:12px;color:var(--text-3);margin-bottom:14px">${tglFmt}</div>
        <div class="form-group">
          <label class="form-label">Shift (bisa lebih dari 1)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${['1','2','3','Off'].map(s=>`
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:7px 14px;border-radius:8px;border:1px solid ${currentShifts.includes(s)?'transparent':'var(--border)'};${currentShifts.includes(s)?_SHIFT_COLOR[s]:''}">
                <input type="checkbox" value="${s}" class="jm-shift" ${currentShifts.includes(s)?'checked':''}
                  onchange="EmployeeModule._jmToggleShift(this,'${s}')">
                ${_SHIFT_LABEL[s]}</label>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Customer (bisa lebih dari 1)</label>
          <input id="jm-search" class="form-control form-control-sm" placeholder="Cari customer..." style="margin-bottom:8px"
            oninput="document.querySelectorAll('.jm-cust-row').forEach(r=>r.style.display=r.dataset.name.toLowerCase().includes(this.value.toLowerCase())?'':'none')">
          <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px">
            ${custNames.map(c=>`
              <label class="jm-cust-row" data-name="${Utils.esc(c)}" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:5px 8px;border-radius:6px${currentCusts.includes(c)?';background:rgba(99,102,241,.08)':''}">
                <input type="checkbox" value="${Utils.esc(c)}" class="jm-cust" ${currentCusts.includes(c)?'checked':''}>
                <span style="font-size:12px">${Utils.esc(c)}</span>
              </label>`).join('')}
          </div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        ${rec?`<button class="btn btn-ghost" style="color:var(--danger)" onclick="EmployeeModule._deleteJadwal('${rec.id}','${mid}')">Hapus</button>`:''}
        <button class="btn btn-primary" onclick="EmployeeModule._saveJadwalModal('${empId}','${empNama.replace(/'/g,"\\'")}','${tgl}','${mid}')">Simpan</button>`,
    });
  }

  async function _saveJadwalModal(empId, empNama, tgl, mid) {
    const shifts    = [...document.querySelectorAll(`#${mid} .jm-shift:checked`)].map(e => e.value);
    const customers = [...document.querySelectorAll(`#${mid} .jm-cust:checked`)].map(e => e.value);
    const ex  = _jadwal.find(j => (j.empId===empId||j.empNama===empNama) && j.tgl===tgl);
    const rec = ex ? {...ex} : {id: Utils.uid(), empId, empNama, tgl, createdAt: new Date().toISOString()};
    rec.shift     = shifts[0] || '';
    rec.shifts    = shifts;
    rec.customers = customers;
    Modal.close(mid);
    const saved = await DB.saveEmpJadwal(rec).catch(() => rec);
    const idx = _jadwal.findIndex(j => j.id === (ex?.id || saved.id));
    if (idx >= 0) _jadwal[idx] = saved; else _jadwal.push(saved);
    renderJadwal();
  }

  async function _deleteJadwal(id, mid) {
    Modal.close(mid);
    await DB.deleteEmpJadwal(id).catch(() => {});
    _jadwal = _jadwal.filter(j => j.id !== id);
    renderJadwal();
  }

  function _jmToggleShift(el, s) {
    const label = el.closest('label');
    if (!label) return;
    if (el.checked) {
      label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;padding:7px 14px;border-radius:8px;border:1px solid transparent;' + (_SHIFT_COLOR[s] || '');
    } else {
      label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;padding:7px 14px;border-radius:8px;border:1px solid var(--border)';
    }
  }


  // ── MediaPicker: foto & KTP ─────────────────────────────
  async function _pickFoto() {
    if (typeof MediaPicker === 'undefined') {
      document.getElementById('emp-foto-input')?.click(); return;
    }
    const dataUrl = await MediaPicker.pick({ maxPx: 512, quality: 0.80 });
    if (!dataUrl) return;
    _tempFotoUrl = dataUrl;
    const prev = document.getElementById('emp-foto-preview');
    if (prev) prev.innerHTML = '<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:cover">';
  }

  async function _pickKtp() {
    if (typeof MediaPicker === 'undefined') {
      document.getElementById('emp-ktp-input')?.click(); return;
    }
    const dataUrl = await MediaPicker.pick({ maxPx: 1024, quality: 0.85 });
    if (!dataUrl) return;
    _tempKtpUrl = dataUrl;
    const prev = document.getElementById('emp-ktp-preview');
    if (prev) prev.innerHTML = '<img src="'+dataUrl+'" style="width:100%;height:80px;object-fit:cover;border-radius:4px">';
  }

  function reArrangeLb() { _logs.sort((a,b)=>((b.tanggal||b.tgl||'')).localeCompare((a.tanggal||a.tgl||''))); renderLogbook(); Notify.success('Data diurutkan berdasarkan tanggal'); }

  return {
    init, switchTab, renderData, renderCard, renderLogbook, renderArsip, _deleteEmpFromArsip, reArrangeLb,
    _handleFotoUpload, _removeFoto, _handleKtpUpload, _removeKtp, _viewPhoto, _searchEmp, _renderDataTable, changeStatus, _resetLbFilter, migratePhotosFromLS,
    _pickFoto, _pickKtp,
    _lbStartEdit, _lbCommit, _lbCancelEdit, _lbUnlock, _lbLockAll, addLogRow, _recalcHutang, recalcAllHutang, _showLogDetail, goLbPage, setLbPerPage,
    setFilter, sortBy, viewCard, filterCards,
    openEmpModal, _submitEmp, openLogModal, _submitLog, deleteLog,
    // Absensi
    renderAbsensi, _absSetMonth, _cycleAbsensi, _bulkAbsensi, openAbsensiModal, _absEmpChange, _submitAbsensi, _onFaceAbsensi,
    // Payroll
    renderPayroll, _paySetMonth, _paySetGrup, _paySelectAll, _payUpdateBatch, _deletePayrollBatch,
    generatePayroll, openSlipGaji, _editPayrollRow, _submitPayrollEdit, _markPayrollLunas,
    // Jadwal Shift
    renderJadwal, _cycleJadwal, _jadwalPrevWeek, _jadwalNextWeek, _jadwalThisWeek, _jadwalFillAll,
    _openJadwalModal, _saveJadwalModal, _deleteJadwal, _jmToggleShift,
    get _selectedEmpId() { return _selectedEmpId; },
    set _selectedEmpId(v) { _selectedEmpId = v; },
  };

})();
window.EmployeeModule = EmployeeModule;
