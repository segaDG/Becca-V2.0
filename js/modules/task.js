   BECCA V2.0 — Task Module
============================================ */
const TaskModule = (() => {
  let _tasks  = [];
  let _filter = 'all';

  async function init() {
    const page = document.getElementById('page-task');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Task</h2>
          <p>Manajemen tugas dan to-do list</p>
        </div>
        <div class="page-header-right">
          <button class="btn btn-primary" onclick="TaskModule.openModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Task Baru
          </button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn active" data-tf="all"       onclick="TaskModule.setFilter('all')">📋 Semua</button>
        <button class="tab-btn"        data-tf="todo"      onclick="TaskModule.setFilter('todo')">⏳ To Do</button>
        <button class="tab-btn"        data-tf="inprogress" onclick="TaskModule.setFilter('inprogress')">🔄 In Progress</button>
        <button class="tab-btn"        data-tf="done"      onclick="TaskModule.setFilter('done')">✅ Done</button>
      </div>
      <div id="task-content"></div>
    `;
    _tasks = await DB.getTasks().catch(() => []);
    render();
  }

  function setFilter(f) {
    _filter = f;
    document.querySelectorAll('[data-tf]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tf === f);
    });
    render();
  }

  function render() {
    let data = [..._tasks].sort((a,b) => {
      // Priority: high first, then by deadline
      const prio = { high:0, medium:1, low:2 };
      return (prio[a.priority]||1) - (prio[b.priority]||1);
    });

    if (_filter === 'todo')       data = data.filter(t => t.status === 'todo');
    if (_filter === 'inprogress') data = data.filter(t => t.status === 'inprogress');
    if (_filter === 'done')       data = data.filter(t => t.status === 'done');

    const today = new Date().toISOString().split('T')[0];

    document.getElementById('task-content').innerHTML = `
      <div style="display:grid;gap:var(--s3)">
        ${data.length ? data.map(t => {
          const isLate = t.deadline && t.status !== 'done' && t.deadline < today;
          const prioColor = { high:'var(--danger)', medium:'var(--warning)', low:'var(--success)' }[t.priority] || 'var(--text-3)';
          return `
            <div style="background:var(--surface);border:1px solid ${isLate?'var(--danger)':t.status==='done'?'var(--border)':'var(--border)'};
                        border-left:4px solid ${prioColor};border-radius:var(--r-lg);
                        padding:var(--s4) var(--s5);opacity:${t.status==='done'?'.6':'1'};
                        transition:all var(--t-base);cursor:pointer"
                 onclick="TaskModule.openModal('${t.id}')">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--s4)">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:var(--s2);margin-bottom:4px">
                    <span style="font-weight:600;font-size:14px;${t.status==='done'?'text-decoration:line-through;color:var(--text-3)':''}">${t.judul||'Tanpa judul'}</span>
                    <span class="badge ${t.priority==='high'?'badge-danger':t.priority==='low'?'badge-success':'badge-warning'}" style="font-size:10px">
                      ${t.priority||'medium'}
                    </span>
                  </div>
                  ${t.deskripsi ? `<p style="font-size:13px;margin-bottom:6px">${t.deskripsi}</p>` : ''}
                  <div style="display:flex;align-items:center;gap:var(--s4);font-size:12px;color:var(--text-3)">
                    ${t.assignee ? `<span>👤 ${t.assignee}</span>` : ''}
                    ${t.deadline ? `<span ${isLate?'style="color:var(--danger);font-weight:600"':''}>📅 ${Utils.formatDate ? Utils.formatDate(t.deadline,'dd/mm/yyyy') : t.deadline}${isLate?' (Terlambat!)':''}</span>` : ''}
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:var(--s2)">
                  <span class="badge ${t.status==='done'?'badge-success':t.status==='inprogress'?'badge-warning':'badge-neutral'}">
                    ${t.status==='done'?'✅ Done':t.status==='inprogress'?'🔄 In Progress':'⏳ To Do'}
                  </span>
                  <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
                    ${t.status !== 'done' ? `
                      <button class="btn btn-sm btn-ghost" onclick="TaskModule.markDone('${t.id}')">✓ Done</button>
                    ` : `
                      <button class="btn btn-sm btn-ghost" onclick="TaskModule.markTodo('${t.id}')">↺ Reopen</button>
                    `}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('') : `
          <div class="empty-state" style="height:40vh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <polyline points="9,11 12,14 22,4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            <h4>Tidak ada task</h4>
            <p>Tambah task baru untuk memulai</p>
          </div>
        `}
      </div>
    `;
  }

  async function markDone(id) {
    const t = _tasks.find(t => t.id === id);
    if (!t) return;
    t.status = 'done';
    await DB.saveTask(t);
    render();
    Notify.success('Task selesai! 🎉');
  }

  async function markTodo(id) {
    const t = _tasks.find(t => t.id === id);
    if (!t) return;
    t.status = 'todo';
    await DB.saveTask(t);
    render();
  }

  function openModal(editId = null) {
    const existing = editId ? _tasks.find(t => t.id === editId) : null;
    const d = existing || { status:'todo', priority:'medium' };
    const mid = Modal.open({
      title: editId ? 'Edit Task' : 'Task Baru',
      body: `
        <form id="task-form">
          <div class="form-group">
            <label class="form-label">Judul Task <span class="req">*</span></label>
            <input name="judul" class="form-control" value="${d.judul||''}" required placeholder="Nama task...">
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi</label>
            <input name="deskripsi" class="form-control" value="${d.deskripsi||''}" placeholder="Keterangan detail...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select name="priority" class="form-control">
                <option value="low"    ${d.priority==='low'   ?'selected':''}>🟢 Low</option>
                <option value="medium" ${(d.priority||'medium')==='medium'?'selected':''}>🟡 Medium</option>
                <option value="high"   ${d.priority==='high'  ?'selected':''}>🔴 High</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-control">
                <option value="todo"       ${(d.status||'todo')==='todo'      ?'selected':''}>⏳ To Do</option>
                <option value="inprogress" ${d.status==='inprogress'?'selected':''}>🔄 In Progress</option>
                <option value="done"       ${d.status==='done'      ?'selected':''}>✅ Done</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Assignee</label>
              <input name="assignee" class="form-control" value="${d.assignee||''}" placeholder="Nama penanggung jawab">
            </div>
            <div class="form-group">
              <label class="form-label">Deadline</label>
              <input name="deadline" type="date" class="form-control" value="${d.deadline||''}">
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="TaskModule._submit('${mid}','${editId||''}')">Simpan</button>
      `,
    });
    return mid;
  }

  async function _submit(modalId, editId='') {
    const fd   = new FormData(document.getElementById('task-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.judul) { Notify.warning('Judul task wajib diisi'); return; }
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveTask(data);
      const idx   = _tasks.findIndex(t => t.id === saved.id);
      if (idx >= 0) _tasks[idx] = saved; else _tasks.unshift(saved);
      render();
      Modal.close(modalId);
      Notify.success('Task disimpan');
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  return { init, setFilter, render, openModal, _submit, markDone, markTodo };
})();
window.TaskModule = TaskModule;
