/* ============================================
   BECCA V2.0 — Task Module
   + Badge per status, + Arsip, + Activity log
============================================ */
const TaskModule = (() => {
  let _tasks  = [];
  let _filter = 'all';

  async function init() {
    _tasks = await DB.getTasks().catch(()=>[]);
    const page = document.getElementById('page-task');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h2>Task</h2><p>Manajemen tugas dan to-do list</p></div>
        <div class="page-header-right">
          <button class="btn btn-primary" onclick="TaskModule.openModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Task Baru
          </button>
        </div>
      </div>
      <div class="tabs" id="task-tabs"></div>
      <div id="task-content"></div>
    `;
    _renderTabs();
    render();
  }

  function _counts() {
    const today = new Date().toISOString().split('T')[0];
    const active = _tasks.filter(t => t.status !== 'done' && t.status !== 'arsip');
    return {
      all:        active.length,
      todo:       active.filter(t => t.status === 'todo' || !t.status).length,
      inprogress: active.filter(t => t.status === 'inprogress').length,
      done:       _tasks.filter(t => t.status === 'done').length,
      arsip:      _tasks.filter(t => t.status === 'arsip').length,
      late:       active.filter(t => t.deadline && t.deadline < today).length,
    };
  }

  function _badge(n, color) {
    if (!n) return '';
    return `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;background:${color||'var(--primary)'};border-radius:999px;font-size:10px;font-weight:700;color:white;padding:0 4px;margin-left:4px">${n}</span>`;
  }

  function _renderTabs() {
    const c = _counts();
    const tabs = document.getElementById('task-tabs');
    if (!tabs) return;
    tabs.innerHTML = `
      <button class="tab-btn ${_filter==='all'?'active':''}"        onclick="TaskModule.setFilter('all')">Semua${_badge(c.all)}</button>
      <button class="tab-btn ${_filter==='todo'?'active':''}"       onclick="TaskModule.setFilter('todo')">To Do${_badge(c.todo,'var(--text-3)')}</button>
      <button class="tab-btn ${_filter==='inprogress'?'active':''}" onclick="TaskModule.setFilter('inprogress')">In Progress${_badge(c.inprogress,'var(--warning)')}</button>
      <button class="tab-btn ${_filter==='done'?'active':''}"       onclick="TaskModule.setFilter('done')">Selesai${_badge(c.done,'var(--success)')}</button>
      <button class="tab-btn ${_filter==='arsip'?'active':''}"      onclick="TaskModule.setFilter('arsip')">Arsip${_badge(c.arsip,'var(--text-3)')}</button>
      ${c.late > 0 ? `<button class="tab-btn ${_filter==='late'?'active':''}" onclick="TaskModule.setFilter('late')" style="color:var(--danger)">Terlambat${_badge(c.late,'var(--danger)')}</button>` : ''}
    `;
  }

  function setFilter(f) { _filter = f; _renderTabs(); render(); }

  function render() {
    const today = new Date().toISOString().split('T')[0];
    let data = [..._tasks];
    if      (_filter==='all')        data = data.filter(t => t.status!=='done' && t.status!=='arsip');
    else if (_filter==='todo')       data = data.filter(t => t.status==='todo' || !t.status);
    else if (_filter==='inprogress') data = data.filter(t => t.status==='inprogress');
    else if (_filter==='done')       data = data.filter(t => t.status==='done');
    else if (_filter==='arsip')      data = data.filter(t => t.status==='arsip');
    else if (_filter==='late')       data = data.filter(t => t.status!=='done' && t.status!=='arsip' && t.deadline && t.deadline < today);

    // Assignee filter: non-admin/superadmin hanya lihat task miliknya
    const user = Auth.currentUser();
    const isAdmin = user && (user.role==='superadmin'||user.role==='admin');
    if (!isAdmin && user) {
      const myNama     = (user.nama||'').toLowerCase();
      const myUsername = (user.username||'').toLowerCase();
      data = data.filter(t => {
        if (!t.assignee) return false;
        const a = t.assignee.toLowerCase();
        // Match: assignee === nama, assignee contains nama, or nama contains assignee
        return a===myNama || a===myUsername ||
               a.includes(myNama) || myNama.includes(a) ||
               a.includes(myUsername) || myUsername.includes(a) ||
               t.creator===user.username; // creator juga bisa lihat
      });
    }

    data.sort((a,b) => {
      const aLate = a.deadline && a.deadline < today ? 0 : 1;
      const bLate = b.deadline && b.deadline < today ? 0 : 1;
      if (aLate !== bLate) return aLate - bLate;
      const p = {high:0, medium:1, low:2};
      return (p[a.priority]||1) - (p[b.priority]||1);
    });

    const el = document.getElementById('task-content');
    if (!el) return;

    if (!data.length) {
      el.innerHTML = `<div class="empty-state" style="height:40vh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <polyline points="9,11 12,14 22,4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <h4>Tidak ada task</h4>
        <p>${_filter==='arsip' ? 'Belum ada task diarsipkan' : 'Tambah task baru untuk memulai'}</p>
      </div>`;
      return;
    }

    el.innerHTML = `<div style="display:grid;gap:var(--s3)">${data.map(t => {
      const isLate  = t.deadline && t.status!=='done' && t.deadline < today;
      const isDone  = t.status === 'done';
      const isArsip = t.status === 'arsip';
      const pc = {high:'var(--danger)', medium:'var(--warning)', low:'var(--success)'}[t.priority] || 'var(--text-3)';
      const sb = isDone  ? '<span class="badge badge-success">Done</span>' :
                 isArsip ? '<span class="badge badge-neutral">Arsip</span>' :
                 t.status==='inprogress' ? '<span class="badge badge-warning">In Progress</span>' :
                 '<span class="badge badge-neutral">To Do</span>';

      return `<div style="background:var(--surface);border:1px solid ${isLate?'rgba(239,68,68,.4)':'var(--border)'};border-left:4px solid ${isDone?'var(--success)':isArsip?'var(--text-3)':pc};border-radius:var(--r-lg);padding:var(--s4) var(--s5);opacity:${isArsip?'.6':'1'}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--s4)">
          <div style="flex:1;cursor:pointer" onclick="TaskModule.openModal('${t.id}')">
            <div style="display:flex;align-items:center;gap:var(--s2);margin-bottom:4px;flex-wrap:wrap">
              <span style="font-weight:600;font-size:14px;${isDone||isArsip?'text-decoration:line-through;color:var(--text-3)':''}">${t.judul||'Tanpa judul'}</span>
              <span class="badge ${t.priority==='high'?'badge-danger':t.priority==='low'?'badge-success':'badge-warning'}" style="font-size:10px">${t.priority||'medium'}</span>
              ${isLate ? '<span class="badge badge-danger" style="font-size:10px">Terlambat</span>' : ''}
            </div>
            ${t.deskripsi ? `<p style="font-size:13px;margin-bottom:6px;color:var(--text-2)">${t.deskripsi}</p>` : ''}
            <div style="display:flex;gap:var(--s4);font-size:12px;color:var(--text-3);flex-wrap:wrap">
              ${t.assignee ? `<span>${t.assignee}</span>` : ''}
              ${t.deadline ? `<span style="${isLate?'color:var(--danger);font-weight:600':''}">${t.deadline}</span>` : ''}
              ${sb}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--s2);flex-shrink:0">
            ${!isDone && !isArsip ? `<button class="btn btn-sm btn-ghost" style="color:var(--success)" onclick="TaskModule.markDone('${t.id}')">Done</button>` : ''}
            ${isDone ? `<button class="btn btn-sm btn-ghost" style="color:var(--primary-h)" onclick="TaskModule.markArsip('${t.id}')">Arsip</button><button class="btn btn-sm btn-ghost" onclick="TaskModule.markTodo('${t.id}')">Reopen</button>` : ''}
            ${isArsip ? `<button class="btn btn-sm btn-ghost" onclick="TaskModule.markTodo('${t.id}')">Restore</button><button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="TaskModule.deleteTask('${t.id}')">Hapus</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  async function markDone(id) {
    const t = _tasks.find(x => x.id===id); if (!t) return;
    t.status = 'done'; await DB.saveTask(t);
    DB.logActivity({type:'complete_task', detail:'Task selesai: '+t.judul});
    _renderTabs(); render(); Notify.success('Task selesai!');
  }
  async function markArsip(id) {
    const t = _tasks.find(x => x.id===id); if (!t) return;
    t.status = 'arsip'; await DB.saveTask(t);
    DB.logActivity({type:'archive_task', detail:'Task diarsip: '+t.judul});
    _renderTabs(); render(); Notify.success('Dipindahkan ke arsip');
  }
  async function markTodo(id) {
    const t = _tasks.find(x => x.id===id); if (!t) return;
    t.status = 'todo'; await DB.saveTask(t);
    _renderTabs(); render();
  }
  async function deleteTask(id) {
    const ok = await Modal.confirm({title:'Hapus Task', message:'Task akan dihapus permanen.', danger:true, confirmText:'Hapus'});
    if (!ok) return;
    await DB.deleteTask(id);
    _tasks = _tasks.filter(t => t.id !== id);
    DB.logActivity({type:'delete_task', detail:'Task dihapus'});
    _renderTabs(); render(); Notify.success('Task dihapus');
  }

  async function openModal(editId=null) {
    const existing = editId ? _tasks.find(t => t.id===editId) : null;
    const d = existing || {status:'todo', priority:'medium'};
    const isEdit = !!editId;
    const mid = Utils.uid(); Modal.open({ id: mid,
      title: isEdit ? 'Edit Task' : 'Task Baru',
      body: `<form id="task-form">
        <div class="form-group">
          <label class="form-label">Judul <span class="req">*</span></label>
          <input name="judul" class="form-control" value="${d.judul||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Deskripsi</label>
          <input name="deskripsi" class="form-control" value="${d.deskripsi||''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select name="priority" class="form-control">
              <option value="low"    ${d.priority==='low'?'selected':''}>Low</option>
              <option value="medium" ${(d.priority||'medium')==='medium'?'selected':''}>Medium</option>
              <option value="high"   ${d.priority==='high'?'selected':''}>High</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="status" class="form-control">
              <option value="todo"       ${(d.status||'todo')==='todo'?'selected':''}>To Do</option>
              <option value="inprogress" ${d.status==='inprogress'?'selected':''}>In Progress</option>
              <option value="done"       ${d.status==='done'?'selected':''}>Done</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Assignee</label>
            <select name="assignee" class="form-control" id="task-assignee-sel">
              <option value="">— Pilih Assignee —</option>
              ${await (async()=>{
                const users = await DB.getUsers().catch(()=>[]);
                const emps  = await DB.getEmployees().catch(()=>[]);
                const unique = [...new Set(users.map(u=>u.nama||u.username).filter(Boolean))].sort();
                return unique.map(n=>`<option value="${n}" ${d.assignee===n?'selected':''}>${n}</option>`).join('');
              })()}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Deadline</label>
            <input name="deadline" type="date" class="form-control" value="${d.deadline||''}">
          </div>
        </div>
      </form>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="TaskModule._submit('${mid}','${editId||''}')">Simpan</button>`,
    });
    return mid;
  }

  async function _submit(modalId, editId='') {
    const fd = new FormData(document.getElementById('task-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.judul) { Notify.warning('Judul wajib diisi'); return; }
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveTask(data);
      const idx = _tasks.findIndex(t => t.id===saved.id);
      if (idx>=0) _tasks[idx]=saved; else _tasks.unshift(saved);
      Notify.success(editId ? 'Task berhasil diperbarui!' : 'Task baru ditambahkan!');
      DB.logActivity({type:editId?'edit_task':'add_task', detail:'Task: '+data.judul});
      Modal.close(modalId);
      Notify.success('Task disimpan');
      _renderTabs(); render();
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  return { init, setFilter, render, openModal, _submit, markDone, markArsip, markTodo, deleteTask };
})();
window.TaskModule = TaskModule;
