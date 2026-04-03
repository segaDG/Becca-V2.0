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

  /* ═══ NOTES TAB ═══ */
  function _renderNotes() {
    const el = document.getElementById('personal-tab-notes');
    if (!el) return;
    const user = Auth.currentUser();

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s4)">
        <span style="font-size:13px;color:var(--text-2)">${_notes.length} catatan</span>
        <div style="display:flex;gap:var(--s2)">
          <button class="btn btn-ghost btn-sm" onclick="PersonalModule.toggleFloating()" id="floating-toggle">
            ${_floatingActive?'\u00d7 Tutup Floating':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> Floating Notes'}
          </button>
          <button class="btn btn-primary btn-sm" onclick="PersonalModule.openNoteModal()">+ Catatan Baru</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s3)">
        ${_notes.length ? _notes.map(n => _noteCard(n)).join('') : UI.empty({iconKey:'list', title:'Belum ada catatan', desc:'Klik "+ Catatan Baru" untuk mulai'})}
      </div>
    `;
  }

  function _noteCard(n) {
    const hasReminder = n.reminderAt && new Date(n.reminderAt) > new Date();
    const reminderLabel = hasReminder ? `<span style="font-size:9px;color:var(--warning);font-weight:600">\u23f0 ${new Date(n.reminderAt).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>` : '';
    const colors = ['rgba(99,102,241,.08)','rgba(16,185,129,.08)','rgba(245,158,11,.08)','rgba(236,72,153,.08)','rgba(59,130,246,.08)'];
    const bg = colors[(n.id||'').charCodeAt(0) % colors.length];
    return `<div onclick="PersonalModule.openNoteModal('${n.id}')" style="background:${bg};border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s4);cursor:pointer;transition:all .2s;box-shadow:0 1px 4px rgba(0,0,0,.06)"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
      onmouseout="this.style.transform='';this.style.boxShadow='0 1px 4px rgba(0,0,0,.06)'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s2)">
        <div style="font-size:14px;font-weight:700;color:var(--heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${n.title||'Tanpa judul'}</div>
        ${reminderLabel}
      </div>
      <div style="font-size:12px;color:var(--text-2);max-height:60px;overflow:hidden;line-height:1.5;white-space:pre-wrap">${(n.content||'').slice(0,150)}${(n.content||'').length>150?'...':''}</div>
      <div style="font-size:10px;color:var(--text-3);margin-top:var(--s2)">${_fmtDate((n.updatedAt||n.createdAt||'').slice(0,10))}</div>
    </div>`;
  }

  /* ═══ NOTE MODAL ═══ */
  function openNoteModal(noteId) {
    const existing = noteId ? _notes.find(n=>n.id===noteId) : null;
    const mid = 'note-'+Date.now();
    Modal.open({ id:mid, title:existing?'Edit Catatan':'Catatan Baru', size:'modal-lg',
      body:`
        <div class="form-group"><label class="form-label">Judul</label>
          <input id="note-title" class="form-control" value="${existing?.title||''}" placeholder="Judul catatan...">
        </div>
        <div class="form-group"><label class="form-label">Isi</label>
          <textarea id="note-content" class="form-control" rows="8" placeholder="Tulis catatan...">${existing?.content||''}</textarea>
        </div>
        <div class="form-group"><label class="form-label">Reminder (opsional)</label>
          <input id="note-reminder" type="datetime-local" class="form-control" value="${existing?.reminderAt?existing.reminderAt.slice(0,16):''}">
          <div style="font-size:10px;color:var(--text-3);margin-top:2px">Akan dikirim push notification saat waktunya tiba</div>
        </div>`,
      footer:`${existing?`<button class="btn btn-danger" onclick="PersonalModule.deleteNote('${noteId}','${mid}')">Hapus</button>`:''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="PersonalModule.saveNote('${noteId||''}','${mid}')">Simpan</button>`,
    });
  }

  async function saveNote(noteId, modalId) {
    const user = Auth.currentUser();
    const title = (document.getElementById('note-title')?.value||'').trim();
    const content = (document.getElementById('note-content')?.value||'').trim();
    const reminderAt = document.getElementById('note-reminder')?.value || '';
    if (!title && !content) { Notify.warning('Isi judul atau catatan'); return; }

    const data = {
      id: noteId || Utils.uid(),
      userId: user?.id, username: user?.username,
      title, content,
      reminderAt: reminderAt ? new Date(reminderAt).toISOString() : '',
      reminderSent: false,
      createdAt: noteId ? (_notes.find(n=>n.id===noteId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await DB.savePersonalNote(data);
      if (noteId) { const idx=_notes.findIndex(n=>n.id===noteId); if(idx>=0) _notes[idx]=data; else _notes.unshift(data); }
      else _notes.unshift(data);
      // Schedule reminder check
      if (data.reminderAt) _scheduleReminder(data);
      Notify.success(noteId?'Catatan diperbarui':'Catatan disimpan');
    } catch(e) { Notify.error('Gagal: '+e.message); }
    Modal.close(modalId);
    _renderNotes();
  }

  async function deleteNote(noteId, modalId) {
    if (!confirm('Hapus catatan ini?')) return;
    try { await DB.deletePersonalNote(noteId); _notes=_notes.filter(n=>n.id!==noteId); Notify.success('Catatan dihapus'); } catch { Notify.error('Gagal'); }
    Modal.close(modalId);
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

  /* ═══ FLOATING NOTES ═══ */
  function toggleFloating() {
    _floatingActive = !_floatingActive;
    if (_floatingActive) _showFloating();
    else _hideFloating();
    _renderNotes();
  }

  function _showFloating() {
    if (document.getElementById('floating-note')) return;
    const lastNote = _notes[0];
    const div = document.createElement('div');
    div.id = 'floating-note';
    div.style.cssText = 'position:fixed;right:24px;bottom:24px;width:320px;max-height:400px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);z-index:500;display:flex;flex-direction:column;resize:both;overflow:hidden';
    div.innerHTML = `
      <div id="floating-note-header" style="padding:8px 12px;background:var(--surface2);border-bottom:1px solid var(--border);cursor:move;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;user-select:none">
        <span style="font-size:12px;font-weight:700;color:var(--heading)">\ud83d\udcdd Quick Notes</span>
        <div style="display:flex;gap:4px">
          <button onclick="PersonalModule.saveFloatingContent()" style="background:none;border:none;cursor:pointer;color:var(--success);font-size:11px;font-weight:600">Simpan</button>
          <button onclick="PersonalModule.toggleFloating()" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:16px">\u00d7</button>
        </div>
      </div>
      <input id="floating-note-title" value="${lastNote?.title||''}" placeholder="Judul..." style="border:none;background:transparent;padding:8px 12px;font-size:13px;font-weight:600;color:var(--heading);outline:none;font-family:var(--font)">
      <textarea id="floating-note-content" placeholder="Tulis catatan..." style="flex:1;border:none;background:transparent;padding:4px 12px 12px;font-size:12px;color:var(--text);outline:none;resize:none;font-family:var(--font);line-height:1.6">${lastNote?.content||''}</textarea>
    `;
    document.body.appendChild(div);
    _floatingNote = lastNote;
    // Make draggable
    _makeDraggable(div, div.querySelector('#floating-note-header'));
  }

  function _hideFloating() {
    const el = document.getElementById('floating-note');
    if (el) el.remove();
  }

  async function saveFloatingContent() {
    const title = (document.getElementById('floating-note-title')?.value||'').trim();
    const content = (document.getElementById('floating-note-content')?.value||'').trim();
    if (!title && !content) return;
    const user = Auth.currentUser();
    const data = {
      id: _floatingNote?.id || Utils.uid(),
      userId: user?.id, username: user?.username,
      title, content,
      reminderAt: _floatingNote?.reminderAt || '',
      reminderSent: _floatingNote?.reminderSent || false,
      createdAt: _floatingNote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await DB.savePersonalNote(data);
      const idx = _notes.findIndex(n=>n.id===data.id);
      if (idx>=0) _notes[idx]=data; else _notes.unshift(data);
      _floatingNote = data;
      Notify.success('Catatan disimpan');
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
    openNoteModal, saveNote, deleteNote,
    toggleFloating, saveFloatingContent,
  };
})();
window.PersonalModule = PersonalModule;
