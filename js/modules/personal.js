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
    const [employees, logs, absensi, payroll, notes] = await Promise.all([
      DB.getEmployees().catch(()=>[]),
      DB.getEmployeeLogs().catch(()=>[]),
      DB.getEmpAbsensi().catch(()=>[]),
      DB.getEmpPayroll().catch(()=>[]),
      DB.getPersonalNotes().catch(()=>[]),
    ]);
    _employees = employees;
    // Match current user to employee by name (case-insensitive)
    _emp = employees.find(e => (e.nama||'').toLowerCase() === (user?.nama||'').toLowerCase()) || null;
    const eid = _emp?.id;
    _logs = eid ? logs.filter(l => l.employeeId===eid || (l.nama||'').toLowerCase()===(user?.nama||'').toLowerCase()).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')) : [];
    _absensi = eid ? absensi.filter(a => a.empId===eid).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')) : [];
    _payroll = eid ? payroll.filter(p => p.empId===eid).sort((a,b)=>((b.tahun||'')+'-'+(b.bulan||'')).localeCompare((a.tahun||'')+'-'+(a.bulan||''))) : [];
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
    // Kasbon
    const kasbon = _payroll.reduce((sum,p) => sum + (Number(p.potonganHutang)||0), 0);
    const sisaHutang = Number(e.sisaHutang)||0;
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

        <!-- Kasbon -->
        <div class="card">
          <div class="card-header"><span class="card-title">Kasbon / Hutang</span></div>
          <div style="text-align:center;padding:var(--s4)">
            <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;font-weight:600;margin-bottom:4px">Sisa Hutang</div>
            <div style="font-size:28px;font-weight:800;color:${sisaHutang>0?'var(--danger)':'var(--success)'};font-family:var(--font-mono)">${_mask(_fmtRp(sisaHutang), s.hutang)} ${_eyeBtn('hutang')}</div>
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

      <!-- Logbook -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div class="card-header"><span class="card-title">Logbook Terakhir</span><span style="font-size:11px;color:var(--text-3)">${_logs.length} catatan</span></div>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>Tanggal</th><th>Catatan</th></tr></thead>
          <tbody>
            ${_logs.slice(0,10).map(l => `<tr><td style="white-space:nowrap">${_fmtDate(l.tgl)}</td><td>${l.catatan||l.keterangan||'-'}</td></tr>`).join('')
              || '<tr><td colspan="2" style="text-align:center;color:var(--text-3);padding:var(--s4)">Belum ada logbook</td></tr>'}
          </tbody>
        </table></div>
      </div>

      <!-- Riwayat Absensi -->
      <div class="card">
        <div class="card-header"><span class="card-title">Riwayat Absensi</span><span style="font-size:11px;color:var(--text-3)">${_absensi.length} record</span></div>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>Tanggal</th><th>Status</th><th>Keterangan</th></tr></thead>
          <tbody>
            ${_absensi.slice(0,20).map(a => {
              const sc = a.status==='Hadir'?'var(--success)':a.status==='Alpha'?'var(--danger)':a.status==='Sakit'?'var(--info)':'var(--warning)';
              return `<tr><td style="white-space:nowrap">${_fmtDate(a.tgl)}</td><td><span style="font-size:11px;font-weight:600;color:${sc}">${a.status||'-'}</span></td><td>${a.ket||'-'}</td></tr>`;
            }).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-3);padding:var(--s4)">Belum ada data absensi</td></tr>'}
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
          <span style="font-size:12px;${t.done?'text-decoration:line-through;opacity:.5':''}">${t.text}</span>
        </div>`
      ).join('');
      if (todos.length > 5) body += `<div style="font-size:10px;color:${c.fold};margin-top:2px">+${todos.length-5} more</div>`;
      if (todos.length) body += `<div style="font-size:10px;margin-top:4px;color:${c.fold};font-weight:600">${doneCount}/${todos.length} selesai</div>`;
    } else {
      body = `<div style="font-size:12px;max-height:80px;overflow:hidden;line-height:1.6;white-space:pre-wrap">${(n.content||'').slice(0,200)}</div>`;
    }

    return `<div style="position:relative;padding-bottom:44px;animation-delay:${delay}ms">
      <div class="sticky-note" data-nid="${n.id}" onclick="PersonalModule.openNoteModal('${n.id}')"
        style="background:${c.bg};color:${c.text};border-radius:2px 2px 2px 12px;padding:16px 18px 14px;cursor:pointer;
        box-shadow:2px 3px 12px rgba(0,0,0,.1);min-height:120px;position:relative;transform:rotate(${(idx%2===0?-0.5:0.5)}deg)"
        ontouchstart="this._sy=event.touches[0].clientY" ontouchmove="PersonalModule._noteSwipe(this,event)" ontouchend="PersonalModule._noteSwipeEnd(this)">
        <div class="sticky-fold" style="border-width:0 24px 24px 0;border-color:transparent ${c.fold} transparent transparent"></div>
        <div style="font-size:15px;font-weight:700;margin-bottom:8px;padding-right:20px">${n.title||'Tanpa judul'}</div>
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
    const dy = e.touches[0].clientY - (el._sy||0);
    if (dy > 20) { el.style.transform = `translateY(${Math.min(dy-20,50)}px)`; el.classList.add('swiped'); }
    else { el.style.transform = ''; el.classList.remove('swiped'); }
  }
  function _noteSwipeEnd(el) {
    const wasSwiped = el.classList.contains('swiped');
    el.style.transform = '';
    if (!wasSwiped) el.classList.remove('swiped');
    // Auto-hide actions after 3s
    if (wasSwiped) setTimeout(()=>el.classList.remove('swiped'), 3000);
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
            <input type="text" class="form-control" value="${t.text||''}" placeholder="Item..." style="flex:1;min-height:32px;padding:4px 8px;font-size:13px">
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
  function toggleFloating(noteId) {
    if (_floatingActive && !noteId) { _hideFloating(); _floatingActive=false; _renderNotes(); return; }
    const note = noteId ? _notes.find(n=>n.id===noteId) : _notes[0] || null;
    _hideFloating();
    _floatingActive = true;
    _showFloating(note);
    _renderNotes();
  }

  function _showFloating(note) {
    if (document.getElementById('floating-note')) document.getElementById('floating-note').remove();
    const c = NOTE_COLORS[note ? (note.id||'').charCodeAt(0) % NOTE_COLORS.length : 0];
    const isTodo = note?.type === 'todo';
    const todos = note?.todos || [];
    const div = document.createElement('div');
    div.id = 'floating-note';
    div.style.cssText = `position:fixed;right:24px;bottom:24px;width:300px;min-height:200px;max-height:420px;
      background:${c.bg};color:${c.text};border-radius:2px 2px 2px 16px;
      box-shadow:4px 6px 20px rgba(0,0,0,.18);z-index:500;display:flex;flex-direction:column;resize:both;overflow:hidden`;

    const todoHTML = isTodo ? todos.map((t,i) =>
      `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
        <input type="checkbox" ${t.done?'checked':''} onchange="PersonalModule._floatTodoToggle(${i})" style="accent-color:${c.fold};width:15px;height:15px;cursor:pointer;flex-shrink:0">
        <span style="font-size:12px;line-height:1.4;${t.done?'text-decoration:line-through;opacity:.5':''}">${t.text}</span>
      </div>`).join('') + `<div style="display:flex;gap:4px;margin-top:4px">
        <input id="float-todo-new" placeholder="Tambah item..." style="flex:1;border:none;border-bottom:1px dashed ${c.fold};background:transparent;color:${c.text};font-size:11px;padding:3px 0;outline:none;font-family:var(--font)"
          onkeydown="if(event.key==='Enter')PersonalModule._floatTodoAdd()">
        <button onclick="PersonalModule._floatTodoAdd()" style="background:none;border:none;color:${c.fold};cursor:pointer;font-size:14px;font-weight:700">+</button>
      </div>` : '';

    div.innerHTML = `
      <div id="floating-note-header" style="padding:8px 12px;cursor:move;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;user-select:none;border-bottom:1px dashed ${c.border}">
        <span style="font-size:11px;font-weight:700">${isTodo?'TO-DO':'\ud83d\udcdd'} ${(note?.title||'Quick Notes').slice(0,25)}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="PersonalModule.saveFloatingContent()" style="background:none;border:none;cursor:pointer;color:${c.fold};font-size:10px;font-weight:700">Simpan</button>
          <button onclick="PersonalModule.toggleFloating()" style="background:none;border:none;cursor:pointer;color:${c.text};font-size:15px;opacity:.5">\u00d7</button>
        </div>
      </div>
      ${!isTodo ? `
        <input id="floating-note-title" value="${note?.title||''}" placeholder="Judul..." style="border:none;background:transparent;padding:8px 12px 2px;font-size:14px;font-weight:700;color:${c.text};outline:none;font-family:var(--font)">
        <textarea id="floating-note-content" placeholder="Tulis catatan..." style="flex:1;border:none;background:transparent;padding:4px 12px 12px;font-size:12px;color:${c.text};outline:none;resize:none;font-family:var(--font);line-height:1.6">${note?.content||''}</textarea>
      ` : `<div style="padding:8px 12px;flex:1;overflow-y:auto" id="float-todo-list">${todoHTML}</div>`}
      <div style="position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 20px 20px 0;border-color:transparent ${c.fold} transparent transparent"></div>
    `;
    document.body.appendChild(div);
    _floatingNote = note;
    _makeDraggable(div, div.querySelector('#floating-note-header'));
  }

  function _hideFloating() {
    const el = document.getElementById('floating-note');
    if (el) el.remove();
  }

  function _floatTodoToggle(idx) {
    if (!_floatingNote?.todos?.[idx]) return;
    _floatingNote.todos[idx].done = !_floatingNote.todos[idx].done;
    _showFloating(_floatingNote); // re-render
  }

  function _floatTodoAdd() {
    const inp = document.getElementById('float-todo-new');
    const text = (inp?.value||'').trim();
    if (!text || !_floatingNote) return;
    if (!_floatingNote.todos) _floatingNote.todos = [];
    _floatingNote.todos.push({text, done:false});
    _showFloating(_floatingNote);
  }

  async function saveFloatingContent() {
    if (!_floatingNote) return;
    const user = Auth.currentUser();
    const isTodo = _floatingNote.type === 'todo';
    let data;
    if (isTodo) {
      data = { ..._floatingNote, updatedAt: new Date().toISOString() };
    } else {
      const title = (document.getElementById('floating-note-title')?.value||'').trim();
      const content = (document.getElementById('floating-note-content')?.value||'').trim();
      if (!title && !content) return;
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
      Notify.success('Disimpan');
    } catch(e) { Notify.error('Gagal'); }
  }

  function _makeDraggable(el, handle) {
    let x=0, y=0, startX=0, startY=0;
    handle.onmousedown = (e) => {
      e.preventDefault();
      startX=e.clientX; startY=e.clientY;
      document.onmousemove = (ev) => {
        x = startX - ev.clientX; y = startY - ev.clientY;
        startX = ev.clientX; startY = ev.clientY;
        el.style.top = (el.offsetTop - y) + 'px';
        el.style.left = (el.offsetLeft - x) + 'px';
        el.style.right = 'auto'; el.style.bottom = 'auto';
      };
      document.onmouseup = () => { document.onmousemove=null; document.onmouseup=null; };
    };
  }

  return {
    init, switchTab, _toggleField,
    openNoteModal, saveNote, deleteNote, _addTodoRow, _archiveNote,
    _noteSwipe, _noteSwipeEnd,
    toggleFloating, saveFloatingContent, _floatTodoToggle, _floatTodoAdd,
  };
})();
window.PersonalModule = PersonalModule;
