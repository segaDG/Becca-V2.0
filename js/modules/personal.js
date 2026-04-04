/* ============================================
   BECCA V2.0 — Personal Module
   Profile, logbook, absensi, kasbon, notes, floating notes
============================================ */
console.log('[BECCA] PersonalModule v20260405a loaded');

const PersonalModule = (() => {
  'use strict';
  let _emp = null, _logs = [], _absensi = [], _payroll = [], _notes = [], _employees = [];
  let _showData = {}; // see/hide state per field
  let _floatingActive = false, _floatingNote = null;
  const _SHOW_KEY = 'becca_personal_show';

  /* ═══ HELPERS ═══ */
  function _fmtRp(v) { const n=Number(v)||0; return n?'Rp '+n.toLocaleString('id'):'-'; }
  function _fmtDate(s) { if(!s) return '-'; try{return new Date(s+'T12:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}catch{return s;} }
  function _mask(val,visible) { if(!val) return '-'; return visible ? val : '\u2022\u2022\u2022\u2022\u2022\u2022'; }
  function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function _toggleField(field) {
    _showData[field] = !_showData[field];
    localStorage.setItem(_SHOW_KEY, JSON.stringify(_showData));
    _renderProfile();
  }
  function _eyeBtn(field) {
    const show = _showData[field];
    return `<button onclick="PersonalModule._toggleField('${field}')" style="background:none;border:none;cursor:pointer;padding:2px;color:var(--text-3);font-size:11px" title="${show?'Sembunyikan':'Tampilkan'}">
      ${show?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
           :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}
    </button>`;
  }

  /* ═══ INIT ═══ */
  async function init() {
    const page = document.getElementById('page-personal');
    if (!page) return;
    try { _showData = JSON.parse(localStorage.getItem(_SHOW_KEY)||'{}'); } catch { _showData = {}; }
    page.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-3)">Memuat data personal...</div>';

    const user = Auth.currentUser();
    // Cache-first: render fast from cache, then background refresh
    const employees = DB.getCached('employees') || await DB.getEmployees().catch(()=>[]);
    _employees = employees;
    // Match user to employee: 1) explicit empId link, 2) name fallback
    const uEmpId = user?.empId;
    const uName = (user?.nama||'').toLowerCase();
    const uUsername = (user?.username||'').toLowerCase();
    _emp = (uEmpId && employees.find(e => e.id === uEmpId))
        || employees.find(e => (e.nama||'').toLowerCase() === uName)
        || employees.find(e => (e.nama||'').toLowerCase().replace(/\s+/g,'') === uUsername)
        || employees.find(e => uUsername && (e.nama||'').toLowerCase().replace(/[\s.]+/g,'').includes(uUsername))
        || null;
    const eid = _emp?.id;

    // Only fetch what's needed for this user (not all tables)
    const [logs, absensi, notes] = await Promise.all([
      eid ? DB.getEmployeeLogs().catch(()=>[]) : Promise.resolve([]),
      eid ? DB.getEmpAbsensi().catch(()=>[])   : Promise.resolve([]),
      DB.getPersonalNotes().catch(()=>[]),
    ]);
    const empName = (_emp?.nama||'').toLowerCase();
    _logs = eid ? logs.filter(l => l.employeeId===eid || (l.nama||'').toLowerCase()===empName).sort((a,b)=>((b.tanggal||b.tgl||'')).localeCompare((a.tanggal||a.tgl||''))) : [];
    _absensi = eid ? absensi.filter(a => a.empId===eid).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')) : [];
    _payroll = []; // not needed for display, kasbon computed from logs
    _notes = notes.filter(n => n.userId === user?.id || n.username === user?.username).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));

    _renderFull(page);
    _checkReminders();
  }

  /* ═══ RENDER FULL ═══ */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-personal');
    const user = Auth.currentUser();
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h2>Personal</h2><p>Data pribadi & catatan · ${user?.nama||''}</p></div>
      </div>
      <div class="tabs" style="margin-bottom:var(--s4)">
        <button class="tab-btn active" data-ptab="profile" onclick="PersonalModule.switchTab('profile')">\ud83d\udc64 Profil</button>
        <button class="tab-btn" data-ptab="notes" onclick="PersonalModule.switchTab('notes')">\ud83d\udcdd Notes</button>
      </div>
      <div id="personal-tab-profile"></div>
      <div id="personal-tab-notes" class="hidden"></div>
    `;
    _renderProfile();
  }

  function switchTab(tab) {
    document.querySelectorAll('[data-ptab]').forEach(b => b.classList.toggle('active', b.dataset.ptab===tab));
    ['profile','notes'].forEach(t => {
      const el = document.getElementById('personal-tab-'+t);
      if (el) el.classList.toggle('hidden', t!==tab);
    });
    if (tab==='notes') _renderNotes();
    if (tab==='profile') _renderProfile();
  }

  /* ═══ PROFILE TAB ═══ */
  function _renderProfile() {
    const el = document.getElementById('personal-tab-profile');
    if (!el) return;
    const user = Auth.currentUser();

    if (!_emp) {
      el.innerHTML = UI.empty({iconKey:'user', title:'Data karyawan tidak ditemukan', desc:'Akun Anda belum terhubung dengan data karyawan'});
      return;
    }
    const e = _emp;
    const s = _showData;
    // Kasbon — hitung dari logbook (support format lama: jenis+jumlah, dan baru: hutang/bayar)
    const _lh = l => Number(l.hutang) || (l.jenis==='BERHUTANG'?Number(l.jumlah):0) || 0;
    const _lb = l => Number(l.bayar)  || (l.jenis==='BAYAR HUTANG'?Number(l.jumlah):0) || 0;
    const totalHutang = _logs.reduce((sum,l) => sum + _lh(l), 0);
    const totalBayar  = _logs.reduce((sum,l) => sum + _lb(l), 0);
    const sisaHutang  = Number(e.sisaHutang) || (totalHutang - totalBayar);
    // Absensi summary
    const thisMonth = new Date().toISOString().slice(0,7);
    const absThisMonth = _absensi.filter(a => (a.tgl||'').startsWith(thisMonth));
    const hadir = absThisMonth.filter(a => a.status==='Hadir').length;
    const sakit = absThisMonth.filter(a => a.status==='Sakit').length;
    const izin = absThisMonth.filter(a => a.status==='Izin').length;
    const alpha = absThisMonth.filter(a => a.status==='Alpha').length;

    el.innerHTML = `
      <!-- Profile Card -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="display:flex;align-items:center;gap:var(--s4);padding:var(--s4);flex-wrap:wrap">
          <div style="width:64px;height:64px;border-radius:var(--r-full);background:linear-gradient(135deg,var(--primary),#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:white;flex-shrink:0">
            ${(e.nama||'?').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()}
          </div>
          <div style="flex:1;min-width:200px">
            <div style="font-size:18px;font-weight:700;color:var(--heading)">${e.nama||'-'}</div>
            <div style="font-size:13px;color:var(--text-2)">${e.jabatan||'-'} ${e.departemen?' \u00b7 '+e.departemen:''}</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px">Role: <span class="badge badge-primary">${user?.role||'-'}</span></div>
          </div>
        </div>
      </div>

      <!-- Info Cards Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        <!-- Data Pribadi -->
        <div class="card">
          <div class="card-header"><span class="card-title">Data Pribadi</span></div>
          <div style="font-size:13px">
            ${_infoRow('NIK', e.nik, 'nik')}
            ${_infoRow('No. HP', e.noHp, 'noHp')}
            ${_infoRow('Alamat', e.alamat, 'alamat')}
            ${_infoRow('Tgl Join', _fmtDate(e.tglJoin), null)}
            ${_infoRow('Status', e.status, null)}
            ${_infoRow('Grup Gajian', e.grupGajian ? 'Tgl '+e.grupGajian : '-', null)}
          </div>
        </div>

        <!-- Kasbon Summary -->
        <div class="card">
          <div class="card-header"><span class="card-title">Kasbon / Hutang</span>${_eyeBtn('hutang')}</div>
          <div style="padding:var(--s3)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);text-align:center;margin-bottom:var(--s3)">
              <div>
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:600">Total Hutang</div>
                <div style="font-size:18px;font-weight:800;color:var(--danger);font-family:var(--font-mono)">${_mask(_fmtRp(totalHutang), s.hutang)}</div>
              </div>
              <div>
                <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:600">Total Bayar</div>
                <div style="font-size:18px;font-weight:800;color:var(--success);font-family:var(--font-mono)">${_mask(_fmtRp(totalBayar), s.hutang)}</div>
              </div>
            </div>
            <div style="text-align:center;padding:var(--s2);border-top:1px solid var(--border)">
              <div style="font-size:10px;color:var(--text-3);font-weight:600">SISA HUTANG</div>
              <div style="font-size:22px;font-weight:800;color:${sisaHutang>0?'var(--danger)':'var(--success)'};font-family:var(--font-mono)">${_mask(_fmtRp(sisaHutang), s.hutang)}</div>
            </div>
          </div>
        </div>

        <!-- Absensi Bulan Ini -->
        <div class="card">
          <div class="card-header"><span class="card-title">Absensi Bulan Ini</span></div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s2);text-align:center;padding:var(--s3)">
            <div><div style="font-size:20px;font-weight:700;color:var(--success);font-family:var(--font-mono)">${hadir}</div><div style="font-size:10px;color:var(--text-3)">Hadir</div></div>
            <div><div style="font-size:20px;font-weight:700;color:var(--info);font-family:var(--font-mono)">${sakit}</div><div style="font-size:10px;color:var(--text-3)">Sakit</div></div>
            <div><div style="font-size:20px;font-weight:700;color:var(--warning);font-family:var(--font-mono)">${izin}</div><div style="font-size:10px;color:var(--text-3)">Izin</div></div>
            <div><div style="font-size:20px;font-weight:700;color:var(--danger);font-family:var(--font-mono)">${alpha}</div><div style="font-size:10px;color:var(--text-3)">Alpha</div></div>
          </div>
        </div>
      </div>

      <!-- Logbook Lengkap -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div class="card-header"><span class="card-title">Logbook</span><span style="font-size:11px;color:var(--text-3)">${_logs.length} catatan</span></div>
        <div class="table-scroll"><table class="table">
          <thead><tr>
            <th>Tanggal</th><th>Keterangan</th><th>Penanggung Jawab</th>
            <th class="num" style="color:var(--danger)">Hutang</th>
            <th class="num" style="color:var(--success)">Bayar</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            ${_logs.length ? _logs.map(l => {
              const h = _lh(l), b = _lb(l);
              const stIcon = l.status==='\u2713'||l.status==='done'?'\u2713':l.status==='\u2014'?'\u2014':l.status||'\u2014';
              return `<tr>
                <td style="white-space:nowrap;font-size:12px">${_fmtDate(l.tanggal||l.tgl)}</td>
                <td style="font-size:12px">${l.catatan||l.keterangan||'-'}</td>
                <td style="font-size:12px;color:var(--text-2)">${l.penanggungJawab||l.pj||'-'}</td>
                <td class="num" style="font-family:var(--font-mono);font-size:12px;color:${h?'var(--danger)':'var(--text-3)'}">${h?_fmtRp(h):'-'}</td>
                <td class="num" style="font-family:var(--font-mono);font-size:12px;color:${b?'var(--success)':'var(--text-3)'}">${b?_fmtRp(b):'-'}</td>
                <td style="text-align:center">${stIcon}</td>
              </tr>`; }).join('')
              : '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:var(--s4)">Belum ada logbook</td></tr>'}
          </tbody>
          ${_logs.length ? `<tfoot><tr style="font-weight:700">
            <td colspan="3" style="font-size:12px">Subtotal (${_logs.length} entri)</td>
            <td class="num" style="font-family:var(--font-mono);font-size:12px;color:var(--danger)">${_fmtRp(totalHutang)}</td>
            <td class="num" style="font-family:var(--font-mono);font-size:12px;color:var(--success)">${_fmtRp(totalBayar)}</td>
            <td></td>
          </tr></tfoot>` : ''}
        </table></div>
      </div>

      <!-- Riwayat Absensi -->
      <div class="card">
        <div class="card-header"><span class="card-title">Riwayat Absensi</span><span style="font-size:11px;color:var(--text-3)">${_absensi.length} record</span></div>
        <div class="table-scroll" style="max-height:400px;overflow-y:auto"><table class="table">
          <thead><tr><th>Tanggal</th><th>Status</th><th>Keterangan</th></tr></thead>
          <tbody>
            ${_absensi.length ? _absensi.map(a => {
              const sc = a.status==='Hadir'?'var(--success)':a.status==='Alpha'?'var(--danger)':a.status==='Sakit'?'var(--info)':'var(--warning)';
              return `<tr><td style="white-space:nowrap;font-size:12px">${_fmtDate(a.tgl)}</td><td><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:var(--r-full);background:${sc}18;color:${sc}">${a.status||'-'}</span></td><td style="font-size:12px">${a.ket||'-'}</td></tr>`;
            }).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text-3);padding:var(--s4)">Belum ada data absensi</td></tr>'}
          </tbody>
        </table></div>
      </div>
    `;
  }

  function _infoRow(label, value, field) {
    const vis = field ? _showData[field] : true;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--text-3)">${label}</span>
      <span style="font-weight:500;display:flex;align-items:center;gap:4px">${field ? _mask(value, vis) : (value||'-')} ${field ? _eyeBtn(field) : ''}</span>
    </div>`;
  }

  /* ═══ NOTES TAB — Sticky Note UI ═══ */
  const NOTE_COLORS = [
    {bg:'#fef9c3',text:'#854d0e',border:'#fde047',fold:'#facc15'}, // yellow
    {bg:'#dbeafe',text:'#1e3a5f',border:'#93c5fd',fold:'#60a5fa'}, // blue
    {bg:'#fce7f3',text:'#831843',border:'#f9a8d4',fold:'#f472b6'}, // pink
    {bg:'#d1fae5',text:'#064e3b',border:'#6ee7b7',fold:'#34d399'}, // green
    {bg:'#ede9fe',text:'#3b0764',border:'#c4b5fd',fold:'#a78bfa'}, // purple
    {bg:'#ffedd5',text:'#7c2d12',border:'#fdba74',fold:'#fb923c'}, // orange
  ];

  function _renderNotes() {
    const el = document.getElementById('personal-tab-notes');
    if (!el) return;
    el.innerHTML = `
      <style>
        @keyframes noteIn{from{opacity:0;transform:translateY(16px) rotate(-1deg)}to{opacity:1;transform:translateY(0) rotate(0)}}
        .sticky-note{animation:noteIn .3s ease both;position:relative;transition:transform .15s,box-shadow .15s}
        .sticky-note:hover{transform:translateY(-3px) rotate(0.5deg)!important;box-shadow:0 8px 24px rgba(0,0,0,.15)!important}
        .sticky-fold{position:absolute;top:0;right:0;width:0;height:0;border-style:solid}
        .note-actions{position:absolute;bottom:-40px;left:50%;transform:translateX(-50%);display:flex;gap:8px;opacity:0;transition:opacity .2s;pointer-events:none}
        .sticky-note.swiped .note-actions{opacity:1;pointer-events:all}
        .note-action-btn{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);transition:transform .15s}
        .note-action-btn:hover{transform:scale(1.15)}
      </style>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s4)">
        <span style="font-size:13px;color:var(--text-2)">${_notes.length} catatan</span>
        <div style="display:flex;gap:var(--s2)">
          <button class="btn btn-ghost btn-sm" onclick="PersonalModule.toggleFloating()">
            ${_floatingActive?'\u00d7 Tutup Floating':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> Floating'}
          </button>
          <button class="btn btn-ghost btn-sm" onclick="PersonalModule.openNoteModal(null,'todo')">+ To-Do List</button>
          <button class="btn btn-primary btn-sm" onclick="PersonalModule.openNoteModal()">+ Catatan</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--s5)">
        ${_notes.length ? _notes.map((n,i) => _noteCard(n,i)).join('') : UI.empty({iconKey:'list', title:'Belum ada catatan', desc:'Buat catatan atau to-do list baru'})}
      </div>`;
  }

  function _noteCard(n, idx=0) {
    const c = NOTE_COLORS[(n.id||'').charCodeAt(0) % NOTE_COLORS.length];
    const hasReminder = n.reminderAt && new Date(n.reminderAt) > new Date();
    const isTodo = n.type === 'todo';
    const todos = isTodo ? (n.todos || []) : [];
    const doneCount = todos.filter(t=>t.done).length;
    const delay = Math.min(idx*50, 400);

    let body = '';
    if (isTodo) {
      body = todos.slice(0,5).map(t =>
        `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
          <span style="width:14px;height:14px;border-radius:3px;border:2px solid ${c.fold};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:${c.fold}">${t.done?'\u2713':''}</span>
          <span style="font-size:12px;${t.done?'text-decoration:line-through;opacity:.5':''}">${_esc(t.text)}</span>
        </div>`
      ).join('');
      if (todos.length > 5) body += `<div style="font-size:10px;color:${c.fold};margin-top:2px">+${todos.length-5} more</div>`;
      if (todos.length) body += `<div style="font-size:10px;margin-top:4px;color:${c.fold};font-weight:600">${doneCount}/${todos.length} selesai</div>`;
    } else {
      body = `<div style="font-size:12px;max-height:80px;overflow:hidden;line-height:1.6;white-space:pre-wrap">${_esc((n.content||'').slice(0,200))}</div>`;
    }

    return `<div style="position:relative;padding-bottom:44px;animation-delay:${delay}ms">
      <div class="sticky-note" data-nid="${n.id}" onclick="PersonalModule.openNoteModal('${n.id}')"
        style="background:${c.bg};color:${c.text};border-radius:2px 2px 2px 12px;padding:16px 18px 14px;cursor:pointer;
        box-shadow:2px 3px 12px rgba(0,0,0,.1);min-height:120px;position:relative;transform:rotate(${(idx%2===0?-0.5:0.5)}deg)"
        ontouchstart="this._sy=event.touches[0].clientY" ontouchmove="PersonalModule._noteSwipe(this,event)" ontouchend="PersonalModule._noteSwipeEnd(this)">
        <div class="sticky-fold" style="border-width:0 24px 24px 0;border-color:transparent ${c.fold} transparent transparent"></div>
        <div style="font-size:15px;font-weight:700;margin-bottom:8px;padding-right:20px">${_esc(n.title)||'Tanpa judul'}</div>
        ${body}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
          ${hasReminder?`<span style="font-size:9px;font-weight:600;color:${c.fold}">\u23f0 ${new Date(n.reminderAt).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>`:`<span></span>`}
          <span style="font-size:9px;opacity:.5">${_fmtDate((n.updatedAt||n.createdAt||'').slice(0,10))}</span>
        </div>
        ${isTodo?`<div style="position:absolute;top:12px;right:28px;font-size:9px;font-weight:700;color:${c.fold}">TO-DO</div>`:''}
      </div>
      <div class="note-actions">
        <button class="note-action-btn" style="background:#ef4444;color:#fff" onclick="event.stopPropagation();PersonalModule.deleteNote('${n.id}')" title="Hapus">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
        <button class="note-action-btn" style="background:${c.fold};color:#fff" onclick="event.stopPropagation();PersonalModule.toggleFloating('${n.id}')" title="Floating">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </button>
        <button class="note-action-btn" style="background:var(--surface2);color:var(--text)" onclick="event.stopPropagation();PersonalModule._archiveNote('${n.id}')" title="Arsip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 8v13H3V8M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
        </button>
      </div>
    </div>`;
  }

  // Touch swipe down to reveal actions
  function _noteSwipe(el, e) {
    e.preventDefault(); // prevent scroll
    const dy = e.touches[0].clientY - (el._sy||0);
    if (dy > 20) { el.style.transform = `translateY(${Math.min(dy-20,50)}px)`; el.classList.add('swiped'); el._didSwipe=true; }
    else { el.style.transform = ''; el.classList.remove('swiped'); }
  }
  function _noteSwipeEnd(el) {
    el.style.transform = '';
    if (el._didSwipe) {
      // Block click that fires after swipe
      el.addEventListener('click', function block(ev){ev.stopPropagation();ev.preventDefault();el.removeEventListener('click',block,true);}, {capture:true,once:true});
      setTimeout(()=>el.classList.remove('swiped'), 4000);
      el._didSwipe = false;
    } else { el.classList.remove('swiped'); }
  }

  async function _archiveNote(noteId) {
    const n = _notes.find(x=>x.id===noteId);
    if (!n) return;
    n.archived = true; n.updatedAt = new Date().toISOString();
    await DB.savePersonalNote(n).catch(()=>{});
    _notes = _notes.filter(x=>x.id!==noteId);
    Notify.success('Catatan diarsipkan');
    _renderNotes();
  }

  /* ═══ NOTE MODAL — supports note + todo ═══ */
  function openNoteModal(noteId, forceType) {
    const existing = noteId ? _notes.find(n=>n.id===noteId) : null;
    const type = existing?.type || forceType || 'note';
    const isTodo = type === 'todo';
    const todos = existing?.todos || [];
    const mid = 'note-'+Date.now();

    const todoListHTML = isTodo ? `
      <div class="form-group"><label class="form-label">To-Do Items</label>
        <div id="note-todo-list" style="margin-bottom:var(--s2)">
          ${todos.map((t,i)=>`<div style="display:flex;align-items:center;gap:var(--s2);margin-bottom:4px" class="todo-row">
            <input type="checkbox" ${t.done?'checked':''} style="accent-color:var(--primary);width:16px;height:16px;cursor:pointer">
            <input type="text" class="form-control" value="${_esc(t.text)}" placeholder="Item..." style="flex:1;min-height:32px;padding:4px 8px;font-size:13px">
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">\u00d7</button>
          </div>`).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="PersonalModule._addTodoRow()">+ Tambah Item</button>
      </div>` : `
      <div class="form-group"><label class="form-label">Isi</label>
        <textarea id="note-content" class="form-control" rows="8" placeholder="Tulis catatan...">${existing?.content||''}</textarea>
      </div>`;

    Modal.open({ id:mid, title:existing?'Edit '+(isTodo?'To-Do':'Catatan'):(isTodo?'To-Do List Baru':'Catatan Baru'), size:'modal-lg',
      body:`
        <input type="hidden" id="note-type" value="${type}">
        <div class="form-group"><label class="form-label">Judul</label>
          <input id="note-title" class="form-control" value="${existing?.title||''}" placeholder="${isTodo?'Nama to-do list...':'Judul catatan...'}">
        </div>
        ${todoListHTML}
        <div class="form-group"><label class="form-label">Reminder (opsional)</label>
          <input id="note-reminder" type="datetime-local" class="form-control" value="${existing?.reminderAt?existing.reminderAt.slice(0,16):''}">
        </div>`,
      footer:`${existing?`<button class="btn btn-danger" onclick="PersonalModule.deleteNote('${noteId}','${mid}')">Hapus</button>`:''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="PersonalModule.saveNote('${noteId||''}','${mid}')">Simpan</button>`,
    });
  }

  function _addTodoRow() {
    const list = document.getElementById('note-todo-list');
    if (!list) return;
    list.insertAdjacentHTML('beforeend',
      `<div style="display:flex;align-items:center;gap:var(--s2);margin-bottom:4px" class="todo-row">
        <input type="checkbox" style="accent-color:var(--primary);width:16px;height:16px;cursor:pointer">
        <input type="text" class="form-control" placeholder="Item..." style="flex:1;min-height:32px;padding:4px 8px;font-size:13px">
        <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">\u00d7</button>
      </div>`);
    list.lastElementChild.querySelector('input[type="text"]').focus();
  }

  async function saveNote(noteId, modalId) {
    const user = Auth.currentUser();
    const title = (document.getElementById('note-title')?.value||'').trim();
    const type = document.getElementById('note-type')?.value || 'note';
    const isTodo = type === 'todo';
    let content = '', todos = [];
    if (isTodo) {
      document.querySelectorAll('.todo-row').forEach(row => {
        const text = row.querySelector('input[type="text"]')?.value?.trim();
        if (text) todos.push({ text, done: !!row.querySelector('input[type="checkbox"]')?.checked });
      });
      if (!title && !todos.length) { Notify.warning('Isi judul atau tambah item'); return; }
    } else {
      content = (document.getElementById('note-content')?.value||'').trim();
      if (!title && !content) { Notify.warning('Isi judul atau catatan'); return; }
    }
    const reminderAt = document.getElementById('note-reminder')?.value || '';
    const data = {
      id: noteId || Utils.uid(),
      userId: user?.id, username: user?.username,
      type, title, content, todos,
      reminderAt: reminderAt ? new Date(reminderAt).toISOString() : '',
      reminderSent: false,
      createdAt: noteId ? (_notes.find(n=>n.id===noteId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await DB.savePersonalNote(data);
      if (noteId) { const idx=_notes.findIndex(n=>n.id===noteId); if(idx>=0) _notes[idx]=data; else _notes.unshift(data); }
      else _notes.unshift(data);
      if (data.reminderAt) _scheduleReminder(data);
      Notify.success(noteId?'Diperbarui':'Disimpan');
    } catch(e) { Notify.error('Gagal: '+e.message); }
    Modal.close(modalId);
    _renderNotes();
  }

  async function deleteNote(noteId, modalId) {
    if (!confirm('Hapus catatan ini?')) return;
    try { await DB.deletePersonalNote(noteId); _notes=_notes.filter(n=>n.id!==noteId); Notify.success('Dihapus'); } catch { Notify.error('Gagal'); }
    if (modalId) Modal.close(modalId);
    _renderNotes();
  }

  /* ═══ REMINDER ═══ */
  const _reminderTimers = {}; // noteId → timerId
  function _scheduleReminder(note) {
    if (!note.reminderAt || note.reminderSent) return;
    // Clear existing timer for this note
    if (_reminderTimers[note.id]) clearTimeout(_reminderTimers[note.id]);
    const ms = new Date(note.reminderAt).getTime() - Date.now();
    if (ms <= 0) return;
    if (ms > 86400000*7) return;
    _reminderTimers[note.id] = setTimeout(async () => {
      if (typeof PushModule!=='undefined' && PushModule.sendToUser) {
        const user = Auth.currentUser();
        PushModule.sendToUser?.(user?.username, { title:'\u23f0 Reminder', body: note.title || 'Cek catatan Anda' }).catch(()=>{});
      }
      Notify.info('\u23f0 Reminder: ' + (note.title||'Catatan'));
      note.reminderSent = true;
      await DB.savePersonalNote(note).catch(()=>{});
    }, ms);
  }

  // Check reminders on init
  function _checkReminders() {
    _notes.forEach(n => { if(n.reminderAt && !n.reminderSent) _scheduleReminder(n); });
  }

  /* ═══ FLOATING STICKY NOTE ═══ */
  let _floatEditing = false;
  let _floatPos = null; // {top, left} — persist position across re-renders

  function toggleFloating(noteId) {
    if (_floatingActive && !noteId) { _hideFloating(); _floatingActive=false; _floatEditing=false; _renderNotes(); return; }
    const note = noteId ? _notes.find(n=>n.id===noteId) : _notes[0] || null;
    _floatEditing = false;
    _floatPos = null;
    _floatingActive = true;
    _floatingNote = note || {id:Utils.uid(),type:'note',title:'',content:'',todos:[],userId:Auth.currentUser()?.id,username:Auth.currentUser()?.username,createdAt:new Date().toISOString()};
    _renderFloat();
    _renderNotes();
  }

  function _floatEnterEdit() { _floatEditing = true; _renderFloat(); }
  function _floatExitEdit() { _floatEditing = false; _renderFloat(); }

  function _saveFloatPos() {
    const el = document.getElementById('floating-note');
    if (!el) return;
    // Only save if position was set (dragged at least once)
    if (el.style.top && el.style.left) _floatPos = { top:el.style.top, left:el.style.left, right:'auto', bottom:'auto' };
  }

  function _renderFloat() {
    _saveFloatPos();
    const el = document.getElementById('floating-note');
    if (el) el.remove();
    const note = _floatingNote;
    if (!note) return;
    const c = NOTE_COLORS[(note.id||'').charCodeAt(0) % NOTE_COLORS.length];
    const isTodo = note.type === 'todo';
    const todos = note.todos || [];
    const editing = _floatEditing;
    const doneCount = todos.filter(t=>t.done).length;

    const div = document.createElement('div');
    div.id = 'floating-note';
    const pos = _floatPos
      ? `top:${_floatPos.top};left:${_floatPos.left};right:${_floatPos.right};bottom:${_floatPos.bottom}`
      : 'right:24px;bottom:24px';
    div.style.cssText = `position:fixed;${pos};width:300px;min-height:180px;max-height:420px;
      background:${c.bg};color:${c.text};border-radius:2px 2px 2px 16px;
      box-shadow:4px 6px 24px rgba(0,0,0,.2);z-index:500;display:flex;flex-direction:column;overflow:hidden;
      ${editing?'resize:both;':''}
      animation:floatIn .35s cubic-bezier(.34,1.56,.64,1);
      transform-origin:bottom right`;
    // Inject animation CSS once
    if (!document.getElementById('float-anim-css')) {
      const css = document.createElement('style'); css.id='float-anim-css';
      css.textContent=`
        @keyframes floatIn{from{opacity:0;transform:scale(.8) translateY(20px) rotate(-3deg)}to{opacity:1;transform:scale(1) translateY(0) rotate(0)}}
        @keyframes floatOut{to{opacity:0;transform:scale(.85) translateY(16px) rotate(2deg)}}
        @keyframes floatSave{0%{transform:scale(1)}30%{transform:scale(1.04)}60%{transform:scale(.98)}100%{transform:scale(1)}}
        @keyframes floatSaveBtnIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        #floating-note{transition:box-shadow .2s}
        #floating-note:hover{box-shadow:6px 8px 30px rgba(0,0,0,.25)}
        .float-save-btn{animation:floatSaveBtnIn .2s ease;transition:all .15s}
        .float-save-btn:hover{transform:scale(1.05)}
      `;
      document.head.appendChild(css);
    }

    // BODY
    let body = '';
    if (isTodo) {
      body = `<div style="padding:8px 14px;flex:1;overflow-y:auto" id="float-todo-list">
        ${todos.map((t,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:3px 0">
          <input type="checkbox" ${t.done?'checked':''} onchange="PersonalModule._floatTodoToggle(${i})" style="accent-color:${c.fold};width:15px;height:15px;cursor:pointer;flex-shrink:0">
          <span style="font-size:12px;line-height:1.4;${t.done?'text-decoration:line-through;opacity:.5':''}">${_esc(t.text)}</span>
          ${editing?`<button onclick="PersonalModule._floatTodoRemove(${i})" style="background:none;border:none;color:${c.fold};cursor:pointer;font-size:13px;margin-left:auto;opacity:.5">\u00d7</button>`:''}
        </div>`).join('')}
        <div style="display:flex;gap:4px;margin-top:6px;padding-top:4px;border-top:1px dashed ${c.border}">
          <input id="float-todo-new" placeholder="Tambah item..." style="flex:1;border:none;background:transparent;color:${c.text};font-size:11px;padding:3px 0;outline:none;font-family:var(--font)"
            onkeydown="if(event.key==='Enter')PersonalModule._floatTodoAdd()">
          <button onclick="PersonalModule._floatTodoAdd()" style="background:none;border:none;color:${c.fold};cursor:pointer;font-size:14px;font-weight:700">+</button>
        </div>
        ${todos.length?`<div style="font-size:10px;color:${c.fold};font-weight:600;margin-top:4px">${doneCount}/${todos.length} selesai</div>`:''}
      </div>`;
    } else if (editing) {
      body = `<input id="floating-note-title" value="${_esc(note.title)}" placeholder="Judul..." style="border:none;background:transparent;padding:8px 14px 2px;font-size:14px;font-weight:700;color:${c.text};outline:none;font-family:var(--font)">
        <textarea id="floating-note-content" placeholder="Tulis catatan..." style="flex:1;border:none;background:transparent;padding:4px 14px 12px;font-size:12px;color:${c.text};outline:none;resize:none;font-family:var(--font);line-height:1.6">${_esc(note.content)}</textarea>`;
    } else {
      body = `<div style="padding:10px 14px;flex:1;overflow-y:auto;cursor:pointer" ondblclick="PersonalModule._floatEnterEdit()">
        <div style="font-size:14px;font-weight:700;margin-bottom:6px">${note.title||'Tanpa judul'}</div>
        <div style="font-size:12px;line-height:1.6;white-space:pre-wrap">${_esc(note.content)||'(double-click untuk edit)'}</div>
      </div>`;
    }

    // HEADER BUTTONS — Save only visible when editing/dirty
    let hBtns = '';
    if (editing) {
      hBtns = `<button class="float-save-btn" onclick="PersonalModule.saveFloatingContent()" style="background:${c.fold};color:#fff;border:none;cursor:pointer;font-size:10px;font-weight:700;padding:2px 10px;border-radius:var(--r-full)">\u2713 Simpan</button>`;
      if (!isTodo) hBtns += `<button onclick="PersonalModule._floatExitEdit()" style="background:none;border:none;cursor:pointer;color:${c.text};font-size:10px;opacity:.5">Batal</button>`;
    } else {
      if (!isTodo) hBtns = `<button onclick="PersonalModule._floatEnterEdit()" style="background:none;border:none;cursor:pointer;color:${c.fold};font-size:10px;font-weight:600;opacity:.6">\u270e</button>`;
      // Todo: Save hidden by default, shown via _floatMarkDirty()
      if (isTodo) hBtns = `<span id="float-save-wrap"></span>`;
    }

    div.innerHTML = `
      <div id="floating-note-header" style="padding:7px 12px;cursor:move;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;user-select:none;border-bottom:1px dashed ${c.border}">
        <span style="font-size:11px;font-weight:700">${isTodo?'\u2611 TO-DO':'\ud83d\udcdd Note'} ${(note.title||'').slice(0,18)}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${hBtns}
          <button onclick="PersonalModule.toggleFloating()" style="background:none;border:none;cursor:pointer;color:${c.text};font-size:14px;opacity:.4">\u00d7</button>
        </div>
      </div>
      ${body}
      <div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 18px 18px 0;border-color:transparent ${c.fold} transparent transparent"></div>
    `;
    document.body.appendChild(div);
    _makeDraggable(div, div.querySelector('#floating-note-header'));
  }

  function _hideFloating() {
    const el = document.getElementById('floating-note');
    if (el) {
      el.style.animation = 'floatOut .25s ease forwards';
      setTimeout(()=>el.remove(), 250);
    }
    _floatPos = null;
  }

  function _floatMarkDirty() {
    const wrap = document.getElementById('float-save-wrap');
    if (wrap && !wrap.innerHTML) {
      const c = NOTE_COLORS[(_floatingNote?.id||'').charCodeAt(0) % NOTE_COLORS.length];
      wrap.innerHTML = `<button class="float-save-btn" onclick="PersonalModule.saveFloatingContent()" style="background:${c.fold};color:#fff;border:none;cursor:pointer;font-size:10px;font-weight:700;padding:2px 10px;border-radius:var(--r-full)">\u2713</button>`;
    }
  }

  function _floatTodoToggle(idx) {
    if (!_floatingNote?.todos?.[idx]) return;
    _floatingNote.todos[idx].done = !_floatingNote.todos[idx].done;
    _floatMarkDirty();
    // Update checkbox in-place (no re-render = keep position)
    const checks = document.querySelectorAll('#float-todo-list input[type="checkbox"]');
    const spans = document.querySelectorAll('#float-todo-list span');
    if (checks[idx]) checks[idx].checked = _floatingNote.todos[idx].done;
    if (spans[idx]) {
      spans[idx].style.textDecoration = _floatingNote.todos[idx].done ? 'line-through' : '';
      spans[idx].style.opacity = _floatingNote.todos[idx].done ? '.5' : '1';
    }
    // Update counter
    const doneCount = _floatingNote.todos.filter(t=>t.done).length;
    const counter = document.querySelector('#float-todo-list div:last-child');
    if (counter && counter.textContent.includes('selesai')) counter.textContent = `${doneCount}/${_floatingNote.todos.length} selesai`;
  }

  function _floatTodoAdd() {
    const inp = document.getElementById('float-todo-new');
    const text = (inp?.value||'').trim();
    if (!text || !_floatingNote) return;
    if (!_floatingNote.todos) _floatingNote.todos = [];
    _floatingNote.todos.push({text, done:false});
    _floatEditing = true; // show delete buttons
    _renderFloat();
    setTimeout(()=>{document.getElementById('float-todo-new')?.focus(); _floatMarkDirty();}, 50);
  }

  function _floatTodoRemove(idx) {
    if (!_floatingNote?.todos) return;
    _floatingNote.todos.splice(idx, 1);
    _renderFloat();
  }

  async function saveFloatingContent() {
    if (!_floatingNote) return;
    const user = Auth.currentUser();
    const isTodo = _floatingNote.type === 'todo';
    let data;
    if (isTodo) {
      data = { ..._floatingNote, updatedAt: new Date().toISOString() };
    } else {
      // Read from edit fields if in edit mode, else keep existing
      const titleEl = document.getElementById('floating-note-title');
      const contentEl = document.getElementById('floating-note-content');
      const title = titleEl ? titleEl.value.trim() : _floatingNote.title;
      const content = contentEl ? contentEl.value.trim() : _floatingNote.content;
      data = {
        ..._floatingNote,
        id: _floatingNote.id || Utils.uid(),
        userId: user?.id, username: user?.username,
        type: 'note', title, content,
        updatedAt: new Date().toISOString(),
        createdAt: _floatingNote.createdAt || new Date().toISOString(),
      };
    }
    try {
      await DB.savePersonalNote(data);
      const idx = _notes.findIndex(n=>n.id===data.id);
      if (idx>=0) _notes[idx]=data; else _notes.unshift(data);
      _floatingNote = data;
      _floatEditing = false;
      _renderFloat();
      // Bounce animation on save
      const floatEl = document.getElementById('floating-note');
      if (floatEl) { floatEl.style.animation='floatSave .3s ease'; setTimeout(()=>floatEl.style.animation='',350); }
      Notify.success('Disimpan');
    } catch(e) { Notify.error('Gagal'); }
  }

  function _makeDraggable(el, handle) {
    let sx=0, sy=0;
    function _move(cx, cy) {
      el.style.top = (el.offsetTop + cy - sy) + 'px';
      el.style.left = (el.offsetLeft + cx - sx) + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
      sx=cx; sy=cy;
    }
    // Mouse
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault(); sx=e.clientX; sy=e.clientY;
      const onMove = (ev) => _move(ev.clientX, ev.clientY);
      const onUp = () => { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    // Touch
    handle.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t=e.touches[0]; sx=t.clientX; sy=t.clientY;
      const onMove = (ev) => { ev.preventDefault(); const t2=ev.touches[0]; _move(t2.clientX, t2.clientY); };
      const onEnd = () => { document.removeEventListener('touchmove',onMove); document.removeEventListener('touchend',onEnd); };
      document.addEventListener('touchmove', onMove, {passive:false});
      document.addEventListener('touchend', onEnd);
    }, {passive:false});
  }

  return {
    init, switchTab, _toggleField,
    openNoteModal, saveNote, deleteNote, _addTodoRow, _archiveNote,
    _noteSwipe, _noteSwipeEnd,
    toggleFloating, saveFloatingContent, _floatTodoToggle, _floatTodoAdd, _floatTodoRemove,
    _floatEnterEdit, _floatExitEdit,
  };
})();
window.PersonalModule = PersonalModule;
