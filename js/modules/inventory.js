/* ============================================
   BECCA V2.0 — Employee Module
   Depends: db.js, utils.js, modal.js, notify.js
   Employee schema: { id, nama, panggilan, nik, status, divisi, jabatan,
                      gajiAwal, gaji, ktp, tglLahir, tempatLahir, agama,
                      tglJoin, lama, pendidikan, thumb, sisaHutang }
   Log schema: { id, bulan, tgl, nama, employeeId, bayar, hutang,
                 pj, ket, konfirmasi }
   ============================================ */

const EmployeeModule = (() => {
  let _employees = [];
  let _logs      = [];
  let _activeTab = 'data';
  let _filterDiv = '';
  let _filterStatus = 'ACTIVE';
  let _logFilter = { nama:'', bulan:'', jenis:'' };

  const DIVISIS    = ['Management','Service','Kitchen','Warehouse','Driver','Cleaning Service'];
  const AGAMAS     = ['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu'];
  const PENDIDIKANS= ['SD','SMP','SMA','SMK','SLTA','D3','S1'];

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-employee');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Data Karyawan</h2>
          <p>Manajemen karyawan dan log hutang/bayar</p>
        </div>
        <div class="page-header-right">
          ${Auth.can('employee','edit') ? `
            <button class="btn btn-primary" onclick="EmployeeModule.openEmpModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg>
              Karyawan Baru
            </button>
          ` : ''}
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="data"    onclick="EmployeeModule.switchTab('data')">👷 Data Karyawan</button>
        <button class="tab-btn"        data-tab="logbook" onclick="EmployeeModule.switchTab('logbook')">📒 Log Book</button>
        <button class="tab-btn"        data-tab="card"    onclick="EmployeeModule.switchTab('card')">🪪 Employee Card</button>
        <button class="tab-btn"        data-tab="arsip"   onclick="EmployeeModule.switchTab('arsip')">📦 Arsip</button>
      </div>
      <div id="emp-tab-data"   ></div>
      <div id="emp-tab-logbook" class="hidden"></div>
      <div id="emp-tab-card"    class="hidden"></div>
      <div id="emp-tab-arsip"   class="hidden"></div>
    `;

    [_employees, _logs] = await Promise.all([DB.getEmployees(), DB.getEmployeeLogs()]);
    switchTab('data');
  }

  function switchTab(tab) {
    _activeTab = tab;
    ['data','logbook','card','arsip'].forEach(t => {
      document.getElementById(`emp-tab-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    const renders = { data:renderData, logbook:renderLogbook, card:renderCard, arsip:renderArsip };
    renders[tab]?.();
  }

  /* ===================== DATA TAB ===================== */
  function renderData() {
    const active = _employees.filter(e => e.status === 'ACTIVE');
    let filtered = active;
    if (_filterDiv) filtered = filtered.filter(e => e.divisi === _filterDiv);

    const totalGaji   = Utils.sumBy(filtered, 'gaji');
    const totalHutang = Utils.sumBy(filtered, 'sisaHutang');

    document.getElementById('emp-tab-data').innerHTML = `
      <!-- Stats strip -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
          { l:'Total Karyawan Aktif', v: active.length,             c:'var(--primary-h)' },
          { l:'Total Gaji Bulanan',   v: Utils.formatRupiah(Utils.sumBy(active,'gaji'),true), c:'var(--success)' },
          { l:'Total Sisa Hutang',    v: Utils.formatRupiah(Utils.sumBy(active,'sisaHutang'),true), c:'var(--warning)' },
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:160px">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:18px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>

      <!-- Filter bar -->
      <div class="filter-bar">
        ${DIVISIS.map(d=>`
          <button class="btn btn-sm ${_filterDiv===d?'btn-primary':'btn-ghost'}"
            onclick="EmployeeModule.setDivFilter('${d}')">${d}</button>
        `).join('')}
        <button class="btn btn-sm btn-ghost" onclick="EmployeeModule.setDivFilter('')">Semua</button>
        <span class="text-muted text-small" style="margin-left:auto">${filtered.length} karyawan · Gaji: ${Utils.formatRupiah(totalGaji)}</span>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>#</th><th>Foto</th><th>Nama</th><th>Status</th><th>Divisi</th>
                <th>Jabatan</th><th class="num">Gaji</th><th class="num">Sisa Hutang</th>
                <th>NIK</th><th>No KTP</th><th>Tgl Lahir</th><th>Tempat</th>
                <th>Tgl Join</th><th>Pendidikan</th>
                ${Auth.can('employee','edit') ? '<th>Aksi</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map((e,i) => `
                <tr>
                  <td class="text-muted text-small">${i+1}</td>
                  <td>
                    ${e.thumb
                      ? `<img src="${e.thumb}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--border)">`
                      : `<div style="width:32px;height:32px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white">${Utils.initials(e.nama)}</div>`}
                  </td>
                  <td>
                    <div class="font-semibold">${e.nama}</div>
                    ${e.panggilan ? `<div class="text-small text-muted">${e.panggilan}</div>` : ''}
                  </td>
                  <td><span class="badge ${e.status==='ACTIVE'?'badge-success':'badge-neutral'}">${e.status}</span></td>
                  <td><span class="badge badge-neutral">${e.divisi||'-'}</span></td>
                  <td class="text-muted text-small">${e.jabatan||'-'}</td>
                  <td class="num">${Utils.formatRupiah(e.gaji)}</td>
                  <td class="num ${e.sisaHutang>0?'':'text-muted'}" style="color:${e.sisaHutang>0?'var(--warning)':''}">
                    ${e.sisaHutang > 0 ? Utils.formatRupiah(e.sisaHutang) : '-'}
                  </td>
                  <td class="text-small text-muted">${e.nik||'-'}</td>
                  <td class="text-small text-muted">${e.ktp||'-'}</td>
                  <td class="text-small" style="white-space:nowrap">${e.tglLahir ? Utils.formatDate(e.tglLahir,'dd/mm/yyyy') : '-'}</td>
                  <td class="text-small text-muted">${e.tempatLahir||'-'}</td>
                  <td class="text-small" style="white-space:nowrap">${e.tglJoin ? Utils.formatDate(e.tglJoin,'dd/mm/yyyy') : '-'}</td>
                  <td class="text-small text-muted">${e.pendidikan||'-'}</td>
                  ${Auth.can('employee','edit') ? `
                  <td class="actions">
                    <div style="display:flex;gap:4px">
                      <button class="btn-icon" onclick="EmployeeModule.openEmpModal('${e.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon" onclick="EmployeeModule.openLogModal(null,'${e.id}')" title="Tambah Log" style="color:var(--warning)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>
              `).join('') : `<tr><td colspan="15" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada karyawan</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function setDivFilter(div) { _filterDiv = div; renderData(); }

  /* ===================== LOG BOOK TAB ===================== */
  function renderLogbook() {
    let filtered = _logs;
    if (_logFilter.nama)  filtered = filtered.filter(l => l.nama === _logFilter.nama);
    if (_logFilter.bulan) filtered = filtered.filter(l => String(l.bulan) === String(_logFilter.bulan));
    if (_logFilter.jenis === 'hutang') filtered = filtered.filter(l => l.hutang > 0);
    if (_logFilter.jenis === 'bayar')  filtered = filtered.filter(l => l.bayar > 0);

    const totalHutang = Utils.sumBy(filtered, 'hutang');
    const totalBayar  = Utils.sumBy(filtered, 'bayar');

    const empOpts = [...new Set(_logs.map(l=>l.nama))].sort()
      .map(n=>`<option value="${n}" ${_logFilter.nama===n?'selected':''}>${n}</option>`).join('');

    document.getElementById('emp-tab-logbook').innerHTML = `
      <!-- Stats -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4)">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:150px">
          <div style="font-size:11px;color:var(--text-3)">Total Berhutang</div>
          <div style="font-size:18px;font-weight:700;color:var(--danger);font-family:var(--font-mono)">${Utils.formatRupiah(totalHutang,true)}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:150px">
          <div style="font-size:11px;color:var(--text-3)">Total Bayar</div>
          <div style="font-size:18px;font-weight:700;color:var(--success);font-family:var(--font-mono)">${Utils.formatRupiah(totalBayar,true)}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:150px">
          <div style="font-size:11px;color:var(--text-3)">Sisa</div>
          <div style="font-size:18px;font-weight:700;color:var(--warning);font-family:var(--font-mono)">${Utils.formatRupiah(totalHutang-totalBayar,true)}</div>
        </div>
      </div>

      <div class="filter-bar">
        <select class="form-control" style="width:180px" onchange="EmployeeModule.setLogFilter('nama',this.value)">
          <option value="">Semua Karyawan</option>
          ${empOpts}
        </select>
        <select class="form-control" style="width:130px" onchange="EmployeeModule.setLogFilter('bulan',this.value)">
          <option value="">Semua Bulan</option>
          ${Utils.MONTHS.map((m,i)=>`<option value="${i+1}" ${String(_logFilter.bulan)===String(i+1)?'selected':''}>${m}</option>`).join('')}
        </select>
        <select class="form-control" style="width:130px" onchange="EmployeeModule.setLogFilter('jenis',this.value)">
          <option value="">Semua Jenis</option>
          <option value="hutang" ${_logFilter.jenis==='hutang'?'selected':''}>💸 Berhutang</option>
          <option value="bayar"  ${_logFilter.jenis==='bayar' ?'selected':''}>✅ Bayar Hutang</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="EmployeeModule.resetLogFilter()">✕ Reset</button>
        ${Auth.can('employee','edit') ? `<button class="btn btn-primary btn-sm" onclick="EmployeeModule.openLogModal()" style="margin-left:auto">+ Log Baru</button>` : ''}
      </div>

      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>#</th><th>Tanggal</th><th>Nama Karyawan</th>
                <th class="num">Berhutang</th><th class="num">Bayar Hutang</th>
                <th>PJ</th><th>Keterangan</th><th>Konfirmasi</th>
                ${Auth.can('employee','edit') ? '<th>Aksi</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map((l,i) => `
                <tr>
                  <td class="text-muted text-small">${i+1}</td>
                  <td style="white-space:nowrap">${Utils.formatDate(l.tgl,'dd/mm/yyyy')}</td>
                  <td><span class="font-semibold">${l.nama}</span></td>
                  <td class="num" style="color:var(--danger)">${l.hutang > 0 ? Utils.formatRupiah(l.hutang) : '-'}</td>
                  <td class="num" style="color:var(--success)">${l.bayar > 0 ? Utils.formatRupiah(l.bayar) : '-'}</td>
                  <td class="text-small text-muted">${l.pj||'-'}</td>
                  <td class="text-small">${l.ket||'-'}</td>
                  <td>
                    <span class="badge ${l.konfirmasi==='CONFIRMED'?'badge-success':'badge-warning'}">
                      ${l.konfirmasi==='CONFIRMED'?'✓ Confirmed':'Pending'}
                    </span>
                  </td>
                  ${Auth.can('employee','edit') ? `
                  <td class="actions">
                    <button class="btn-icon" onclick="EmployeeModule.openLogModal('${l.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </td>` : ''}
                </tr>
              `).join('') : `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada log</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function setLogFilter(k, v) { _logFilter[k] = v; renderLogbook(); }
  function resetLogFilter()   { _logFilter = {}; renderLogbook(); }

  /* ===================== CARD TAB ===================== */
  function renderCard() {
    const active = _employees.filter(e => e.status === 'ACTIVE');
    document.getElementById('emp-tab-card').innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--s4)">
        <button class="btn btn-ghost" onclick="window.print()">🖨️ Print</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s4)" id="emp-cards">
        ${active.map(e => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5);display:flex;gap:var(--s4);align-items:center">
            ${e.thumb
              ? `<img src="${e.thumb}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--border2);flex-shrink:0">`
              : `<div style="width:56px;height:56px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:white;flex-shrink:0">${Utils.initials(e.nama)}</div>`}
            <div style="min-width:0">
              <div style="font-weight:700;font-size:15px;color:var(--heading);truncate">${e.nama}</div>
              <div style="font-size:12px;color:var(--text-3)">${e.jabatan||'-'} · ${e.divisi||'-'}</div>
              <div style="font-size:11px;color:var(--primary-h);margin-top:4px;font-family:var(--font-mono)">${e.nik ? `NIK: ${e.nik}` : ''}</div>
              ${e.sisaHutang > 0 ? `<div style="font-size:11px;color:var(--warning);margin-top:2px">Hutang: ${Utils.formatRupiah(e.sisaHutang)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ===================== ARSIP TAB ===================== */
  function renderArsip() {
    const arsip = _employees.filter(e => e.status !== 'ACTIVE');
    document.getElementById('emp-tab-arsip').innerHTML = `
      <div class="filter-bar">
        <button class="btn btn-sm btn-ghost" onclick="EmployeeModule._renderArsipTable('')">Semua (${arsip.length})</button>
        ${['RESIGN','FIRED'].map(s => `
          <button class="btn btn-sm btn-ghost" onclick="EmployeeModule._renderArsipTable('${s}')">${s} (${arsip.filter(e=>e.status===s).length})</button>
        `).join('')}
      </div>
      <div id="arsip-table"></div>
    `;
    _renderArsipTable('');
  }

  function _renderArsipTable(status) {
    const data = _employees.filter(e => e.status !== 'ACTIVE' && (!status || e.status === status));
    document.getElementById('arsip-table').innerHTML = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr><th>#</th><th>Foto</th><th>Nama</th><th>Status</th><th>Divisi</th><th class="num">Gaji Terakhir</th><th>Tgl Join</th>
            ${Auth.can('employee','edit') ? '<th>Aksi</th>' : ''}</tr>
          </thead>
          <tbody>
            ${data.map((e,i) => `
              <tr>
                <td>${i+1}</td>
                <td>${e.thumb ? `<img src="${e.thumb}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : `<div style="width:32px;height:32px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${Utils.initials(e.nama)}</div>`}</td>
                <td class="font-semibold">${e.nama}</td>
                <td><span class="badge ${e.status==='RESIGN'?'badge-warning':'badge-danger'}">${e.status}</span></td>
                <td class="text-muted">${e.divisi||'-'}</td>
                <td class="num">${Utils.formatRupiah(e.gaji)}</td>
                <td class="text-small">${e.tglJoin ? Utils.formatDate(e.tglJoin,'dd/mm/yyyy') : '-'}</td>
                ${Auth.can('employee','edit') ? `<td><button class="btn btn-ghost btn-sm" onclick="EmployeeModule._restoreEmployee('${e.id}')">Aktifkan</button></td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function _restoreEmployee(id) {
    const emp = _employees.find(e => e.id === id);
    if (!emp) return;
    emp.status = 'ACTIVE';
    await DB.saveEmployee(emp);
    renderArsip();
    Notify.success(`${emp.nama} dipindahkan ke karyawan aktif`);
  }

  /* ===================== EMPLOYEE MODAL ===================== */
  function openEmpModal(editId = null) {
    const existing = editId ? _employees.find(e => e.id === editId) : null;
    const d = existing || { status:'ACTIVE' };
    const mid = Modal.open({
      title: editId ? 'Edit Karyawan' : 'Karyawan Baru',
      size: 'modal-lg',
      body: `
        <form id="emp-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Lengkap <span class="req">*</span></label>
              <input name="nama" class="form-control" value="${d.nama||''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nama Panggilan</label>
              <input name="panggilan" class="form-control" value="${d.panggilan||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Divisi <span class="req">*</span></label>
              <select name="divisi" class="form-control" required>
                ${DIVISIS.map(div=>`<option value="${div}" ${d.divisi===div?'selected':''}>${div}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Jabatan</label>
              <input name="jabatan" class="form-control" value="${d.jabatan||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Status <span class="req">*</span></label>
              <select name="status" class="form-control">
                <option value="ACTIVE" ${d.status==='ACTIVE'?'selected':''}>ACTIVE</option>
                <option value="RESIGN" ${d.status==='RESIGN'?'selected':''}>RESIGN</option>
                <option value="FIRED"  ${d.status==='FIRED' ?'selected':''}>FIRED</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">NIK Internal</label>
              <input name="nik" class="form-control" value="${d.nik||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Gaji (Rp)</label>
              <input name="gaji" type="number" class="form-control" value="${d.gaji||0}">
            </div>
            <div class="form-group">
              <label class="form-label">Gaji Awal (Rp)</label>
              <input name="gajiAwal" type="number" class="form-control" value="${d.gajiAwal||0}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">No KTP</label>
              <input name="ktp" class="form-control" value="${d.ktp||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Sisa Hutang (Rp)</label>
              <input name="sisaHutang" type="number" class="form-control" value="${d.sisaHutang||0}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tgl Lahir</label>
              <input name="tglLahir" type="date" class="form-control" value="${d.tglLahir||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Tempat Lahir</label>
              <input name="tempatLahir" class="form-control" value="${d.tempatLahir||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Agama</label>
              <select name="agama" class="form-control">
                <option value="">—</option>
                ${AGAMAS.map(a=>`<option value="${a}" ${d.agama===a?'selected':''}>${a}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Pendidikan</label>
              <select name="pendidikan" class="form-control">
                <option value="">—</option>
                ${PENDIDIKANS.map(p=>`<option value="${p}" ${d.pendidikan===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tgl Bergabung</label>
              <input name="tglJoin" type="date" class="form-control" value="${d.tglJoin||''}">
            </div>
            <div class="form-group">
              <label class="form-label">URL Foto (Google Drive)</label>
              <input name="thumb" class="form-control" value="${d.thumb||''}" placeholder="https://drive.google.com/thumbnail?id=...">
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="EmployeeModule._submitEmp('${mid}','${editId||''}')">
          ${editId ? 'Simpan Perubahan' : 'Tambah Karyawan'}
        </button>
      `,
    });
    return mid;
  }

  async function _submitEmp(modalId, editId='') {
    const fd = new FormData(document.getElementById('emp-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.nama || !data.divisi) { Notify.warning('Nama dan Divisi wajib diisi'); return; }
    data.gaji      = parseInt(data.gaji)||0;
    data.gajiAwal  = parseInt(data.gajiAwal)||0;
    data.sisaHutang= parseInt(data.sisaHutang)||0;
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveEmployee(data);
      const idx = _employees.findIndex(e=>e.id===saved.id);
      if (idx>=0) _employees[idx]=saved; else _employees.unshift(saved);
      renderData();
      Modal.close(modalId);
      Notify.success(editId ? 'Data karyawan diperbarui' : 'Karyawan ditambahkan');
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  /* ===================== LOG MODAL ===================== */
  function openLogModal(editId = null, preEmployeeId = '') {
    const existing = editId ? _logs.find(l => l.id === editId) : null;
    const d = existing || { tgl: Utils.today(), konfirmasi:'', bayar:0, hutang:0 };
    const preEmp = preEmployeeId ? _employees.find(e=>e.id===preEmployeeId) : null;

    const empOpts = _employees.filter(e=>e.status==='ACTIVE')
      .map(e=>`<option value="${e.nama}" ${(d.nama||preEmp?.nama)===e.nama?'selected':''}>${e.nama}</option>`).join('');

    const mid = Modal.open({
      title: editId ? 'Edit Log' : 'Tambah Log Baru',
      body: `
        <form id="log-form">
          <div class="form-group">
            <label class="form-label">Nama Karyawan <span class="req">*</span></label>
            <select name="nama" class="form-control" required>
              <option value="">— Pilih Karyawan —</option>
              ${empOpts}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tanggal <span class="req">*</span></label>
              <input name="tgl" type="date" class="form-control" value="${d.tgl}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Bulan</label>
              <select name="bulan" class="form-control">
                ${Utils.MONTHS.map((m,i)=>`<option value="${i+1}" ${String(d.bulan)===String(i+1)?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">💸 Berhutang (Rp)</label>
              <input name="hutang" type="number" min="0" class="form-control" value="${d.hutang||0}">
            </div>
            <div class="form-group">
              <label class="form-label">✅ Bayar Hutang (Rp)</label>
              <input name="bayar" type="number" min="0" class="form-control" value="${d.bayar||0}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Keterangan</label>
            <input name="ket" class="form-control" value="${d.ket||''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">PJ</label>
              <input name="pj" class="form-control" value="${d.pj||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Konfirmasi</label>
              <select name="konfirmasi" class="form-control">
                <option value="">— Belum —</option>
                <option value="CONFIRMED" ${d.konfirmasi==='CONFIRMED'?'selected':''}>✓ CONFIRMED</option>
              </select>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="EmployeeModule._submitLog('${mid}','${editId||''}')">Simpan</button>
      `,
    });
    return mid;
  }

  async function _submitLog(modalId, editId='') {
    const fd = new FormData(document.getElementById('log-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.nama || !data.tgl) { Notify.warning('Nama dan Tanggal wajib diisi'); return; }
    data.hutang = parseInt(data.hutang)||0;
    data.bayar  = parseInt(data.bayar)||0;
    data.bulan  = parseInt(data.bulan)||0;
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveEmployeeLog(data);
      const idx = _logs.findIndex(l=>l.id===saved.id);
      if (idx>=0) _logs[idx]=saved; else _logs.unshift(saved);
      renderLogbook();
      Modal.close(modalId);
      Notify.success(editId ? 'Log diperbarui' : 'Log ditambahkan');
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  return {
    init, switchTab, setDivFilter, setLogFilter, resetLogFilter,
    openEmpModal, _submitEmp, openLogModal, _submitLog,
    _renderArsipTable, _restoreEmployee,
  };
})();

window.EmployeeModule = EmployeeModule;
