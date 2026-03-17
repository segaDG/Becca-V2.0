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
    if (emp.fotoUrl) {
      return '<img src="'+emp.fotoUrl+'" style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;object-fit:cover">';
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
        <button class="tab-btn"        id="emp-tab-btn-logbook" data-tab="logbook" onclick="EmployeeModule.switchTab('logbook')">📋 Logbook</button>
        <button class="tab-btn"        id="emp-tab-btn-arsip"   data-tab="arsip"   onclick="EmployeeModule.switchTab('arsip')">📁 Arsip</button>
      </div>
      <div id="emp-tab-data"></div>
      <div id="emp-tab-card"    class="hidden"></div>
      <div id="emp-tab-logbook" class="hidden"></div>
      <div id="emp-tab-arsip"   class="hidden"></div>
    `;

    [_employees, _logs] = await Promise.all([
      DB.getEmployees().catch(()=>[]),
      DB.getEmployeeLogs().catch(()=>[]),
    ]);
    switchTab('data');
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
    const ARSIP_STATUS = ['Arsip','RESIGN','Inactive','INACTIVE','Keluar','keluar'];
    const active   = _employees.filter(e => !ARSIP_STATUS.includes(e.status));
    const depts    = [...new Set(active.map(e=>e.departemen).filter(Boolean))].sort();
    const canEdit  = Auth.can('employee','edit');

    // Apply filter
    let filtered = active;
    if (_filterStatus) filtered = filtered.filter(e=>e.status===_filterStatus);
    if (_filterDept)   filtered = filtered.filter(e=>e.departemen===_filterDept);

    // Apply sort
    filtered = [...filtered].sort((a,b) => {
      const va = (a[_sortField]||'').toString().toLowerCase();
      const vb = (b[_sortField]||'').toString().toLowerCase();
      return _sortDir==='asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const sortIcon = (field) => _sortField===field
      ? (_sortDir==='asc' ? ' ↑' : ' ↓') : ' ⇅';

    document.getElementById('emp-tab-data').innerHTML = `
      <!-- Stats -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
          {l:'Total Aktif', v:active.length,                                        c:'var(--primary-h)'},
          {l:'Aktif/Tetap', v:active.filter(e=>['Tetap','ACTIVE','Active'].includes(e.status)).length, c:'var(--success)'},
          {l:'Kontrak',     v:active.filter(e=>['Kontrak','CONTRACT','Kontrak'].includes(e.status)).length, c:'var(--warning)'},
          {l:'Departemen',  v:depts.length+' dept',                                 c:'var(--text-2)'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:140px">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:18px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>`).join('')}
      </div>

      <!-- Filter & Sort -->
      <div class="filter-bar" style="margin-bottom:var(--s3)">
        <select class="form-control" style="width:150px" onchange="EmployeeModule.setFilter('status',this.value)">
          <option value="">Semua Status</option>
          ${['Tetap','Kontrak','Percobaan','Harian'].map(s=>`<option value="${s}" ${_filterStatus===s?'selected':''}>${s}</option>`).join('')}
        </select>
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
              <th onclick="EmployeeModule.sortBy('nip')"  style="cursor:pointer">NIP${sortIcon('nip')}</th>
              <th onclick="EmployeeModule.sortBy('jabatan')" style="cursor:pointer">Jabatan${sortIcon('jabatan')}</th>
              <th onclick="EmployeeModule.sortBy('departemen')" style="cursor:pointer">Departemen${sortIcon('departemen')}</th>
              <th onclick="EmployeeModule.sortBy('status')" style="cursor:pointer">Status${sortIcon('status')}</th>
              <th onclick="EmployeeModule.sortBy('tglMasuk')" style="cursor:pointer">Tgl Masuk${sortIcon('tglMasuk')}</th>
              ${canEdit ? '<th style="width:80px">Aksi</th>' : ''}
            </tr></thead>
            <tbody>
              ${filtered.length ? filtered.map((emp, i) => {
                // avatar handled by _empAvatar helper
                const _ACTIVE_STATUSES = ['Tetap','ACTIVE','Active'];
                const _WARN_STATUSES   = ['Kontrak','CONTRACT','Percobaan'];
                const _DANGER_STATUSES = ['RESIGN','Resign','Nonaktif'];
                const statusColor = _ACTIVE_STATUSES.includes(emp.status)?'badge-success'
                  : _WARN_STATUSES.includes(emp.status)?'badge-warning'
                  : _DANGER_STATUSES.includes(emp.status)?'badge-danger'
                  : 'badge-neutral';
                const logCount = _logs.filter(l=>l.employeeId===emp.id).length;
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
                  <td class="text-muted text-small">${emp.nip||'-'}</td>
                  <td>${emp.jabatan||'-'}</td>
                  <td><span class="badge badge-neutral">${emp.departemen||'-'}</span></td>
                  <td><span class="badge ${statusColor}">${emp.status||'-'}</span></td>
                  <td class="text-small text-muted">${emp.tglMasuk||'-'}</td>
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
              }).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-3)">
                Belum ada data karyawan
              </td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
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
    const active = _employees.filter(e=>e.status!=='Arsip');

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
    const statusColor = ['Tetap','ACTIVE','Active'].includes(emp.status)?'var(--success)'
      : ['Kontrak','CONTRACT','Percobaan'].includes(emp.status)?'var(--warning)'
      : ['RESIGN','Resign'].includes(emp.status)?'var(--danger)'
      : 'var(--text-3)';
    const empLogs = _logs.filter(l=>l.employeeId===emp.id).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')).slice(0,3);
    const canEdit = Auth.can('employee','edit');

    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);
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
            {l:'NIP',        v:emp.nip||'-'},
            {l:'No. HP',     v:emp.noHp||'-'},
            {l:'Tgl Masuk',  v:emp.tglMasuk||'-'},
            {l:'Gaji Pokok', v:emp.gajiPokok?Utils.formatRupiah(emp.gajiPokok):'-'},
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
                <span style="color:var(--text-3)">${l.tgl||''}</span> · ${l.catatan||l.type||'-'}
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
    const empLogs = _logs.filter(l=>l.employeeId===emp.id).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const canEdit = Auth.can('employee','edit');
    const statusColor = ['Tetap','ACTIVE','Active'].includes(emp.status)?'var(--success)'
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
              {l:'NIP',         v:emp.nip||'-'},
              {l:'Departemen',  v:emp.departemen||'-'},
              {l:'No. HP',      v:emp.noHp||'-'},
              {l:'Alamat',      v:emp.alamat||'-'},
              {l:'Tgl Masuk',   v:emp.tglMasuk||'-'},
              {l:'Gaji Pokok',  v:emp.gajiPokok?Utils.formatRupiah(emp.gajiPokok):'-'},
              {l:'No. Rekening',v:emp.noRek||'-'},
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
          <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:14px;font-weight:700;color:var(--heading)">Riwayat Log (${empLogs.length})</div>
          </div>
          ${empLogs.length ? `
            <div class="table-scroll">
              <table class="table" style="font-size:13px">
                <thead><tr>
                  <th>Tanggal</th><th>Tipe</th><th>Catatan</th>
                  ${canEdit?'<th style="width:32px"></th>':''}
                </tr></thead>
                <tbody>
                  ${empLogs.map(l=>`<tr>
                    <td style="white-space:nowrap">${l.tgl||'-'}</td>
                    <td><span class="badge badge-neutral" style="font-size:10px">${l.type||'-'}</span></td>
                    <td>${l.catatan||'-'}</td>
                    ${canEdit?`<td><button class="btn-icon" onclick="EmployeeModule.openLogModal('${l.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                    </button></td>` : ''}
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : `<div style="text-align:center;padding:40px;color:var(--text-3)">Belum ada log</div>`}
        </div>
      </div>
    `;
  }

  /* ===================== RENDER LOGBOOK ===================== */
  function renderLogbook() {
    const empOpts = _employees.filter(e=>e.status!=='Arsip')
      .map(e=>`<option value="${e.id}">${e.nama}</option>`).join('');

    document.getElementById('emp-tab-logbook').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s4)">
        <div style="display:flex;gap:var(--s2)">
          <select class="form-control" style="width:180px" id="lb-filter-emp"
            onchange="EmployeeModule.renderLogbook()">
            <option value="">Semua Karyawan</option>
            ${empOpts}
          </select>
          <input type="date" class="form-control" style="width:140px" id="lb-filter-from"
            onchange="EmployeeModule.renderLogbook()">
          <input type="date" class="form-control" style="width:140px" id="lb-filter-to"
            onchange="EmployeeModule.renderLogbook()">
        </div>
        ${Auth.can('employee','edit') ? `
          <button class="btn btn-primary btn-sm" onclick="EmployeeModule.openLogModal()">+ Tambah Log</button>` : ''}
      </div>
      <div class="table-wrapper"><div class="table-scroll">
        <table class="table">
          <thead><tr><th>Tanggal</th><th>Karyawan</th><th>Tipe</th><th>Catatan</th>
            ${Auth.can('employee','edit')?'<th>Aksi</th>':''}
          </tr></thead>
          <tbody id="lb-tbody">${_renderLogRows()}</tbody>
        </table>
      </div></div>
    `;
  }

  function _renderLogRows() {
    const empFilter = document.getElementById('lb-filter-emp')?.value || '';
    const from      = document.getElementById('lb-filter-from')?.value || '';
    const to        = document.getElementById('lb-filter-to')?.value || '';
    const canEdit   = Auth.can('employee','edit');

    let logs = [..._logs].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    if (empFilter) logs = logs.filter(l=>l.employeeId===empFilter);
    if (from)      logs = logs.filter(l=>(l.tgl||'')>=from);
    if (to)        logs = logs.filter(l=>(l.tgl||'')<=to);

    if (!logs.length) return `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada log</td></tr>`;

    return logs.map(l => {
      const emp = _employees.find(e=>e.id===l.employeeId);
      return `<tr>
        <td style="white-space:nowrap">${l.tgl||'-'}</td>
        <td>${emp?.nama||l.employeeId||'-'}</td>
        <td><span class="badge badge-neutral" style="font-size:10px">${l.type||'-'}</span></td>
        <td>${l.catatan||'-'}</td>
        ${canEdit?`<td><div style="display:flex;gap:4px">
          <button class="btn-icon" title="Edit" onclick="EmployeeModule.openLogModal('${l.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
          </button>
          <button class="btn-icon" title="Hapus" onclick="EmployeeModule.deleteLog('${l.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div></td>`:''}
      </tr>`;
    }).join('');
  }

  /* ===================== RENDER ARSIP ===================== */
  function renderArsip() {
    const arsip = _employees.filter(e=>['Arsip','RESIGN','Resign','Inactive','INACTIVE'].includes(e.status));
    document.getElementById('emp-tab-arsip').innerHTML = `
      <div class="table-wrapper"><div class="table-scroll">
        <table class="table">
          <thead><tr><th>Nama</th><th>NIP</th><th>Jabatan</th><th>Departemen</th><th>Tgl Keluar</th>
            ${Auth.can('employee','edit')?'<th>Aksi</th>':''}
          </tr></thead>
          <tbody>
            ${arsip.length ? arsip.map(emp=>`<tr>
              <td>${emp.nama}</td>
              <td class="text-muted">${emp.nip||'-'}</td>
              <td>${emp.jabatan||'-'}</td>
              <td>${emp.departemen||'-'}</td>
              <td class="text-muted">${emp.tglKeluar||'-'}</td>
              ${Auth.can('employee','edit')?`<td>
                <button class="btn btn-ghost btn-sm" onclick="EmployeeModule.openEmpModal('${emp.id}')">Edit</button>
              </td>`:''}
            </tr>`).join('')
            : `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada karyawan arsip</td></tr>`}
          </tbody>
        </table>
      </div></div>
    `;
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

  /* === Foto Handler === */
  let _tempFotoUrl = null;

  function _handleFotoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 1024*1024) { Notify.warning('Foto terlalu besar. Maks 1MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      _tempFotoUrl = e.target.result;
      const prev = document.getElementById('emp-foto-preview');
      if (prev) prev.innerHTML = '<img src="'+_tempFotoUrl+'" style="width:100%;height:100%;object-fit:cover">';
    };
    reader.readAsDataURL(file);
  }

  function _removeFoto() {
    _tempFotoUrl = '__remove__';
    const prev = document.getElementById('emp-foto-preview');
    if (prev) prev.innerHTML = '<span style="font-size:20px">👤</span>';
  }


  return {
    init, switchTab, renderData, renderCard, renderLogbook, renderArsip,
    _handleFotoUpload, _removeFoto,
    setFilter, sortBy, viewCard, filterCards,
    openEmpModal, _submitEmp, openLogModal, _submitLog, deleteLog,
    get _selectedEmpId() { return _selectedEmpId; },
    set _selectedEmpId(v) { _selectedEmpId = v; },
  };

})();
window.EmployeeModule = EmployeeModule;
