// ============================================================
//  BECCA V2.0 — Task Module (Kanban 4-Board v2)
//  To Do → In Progress → Review → Done
//  - Panah → di bawah card To Do dan In Progress
//  - Review: tombol Done tersembunyi sampai di-review pembuat
//  - Setelah 1 hari di Done → auto arsip
//  - Edit/Delete hanya pembuat & superadmin
// ============================================================
const TaskModule = (() => {
  'use strict';

  let _tasks  = [];
  let _filter = 'board';

  /* ── Init ── */
  async function init() {
    const page = document.getElementById('page-task');
    if (!page) return;
    _tasks = await DB.getTasks().catch(() => []);
    page.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s4)">
        <div>
          <h2 class="page-title">Task</h2>
          <p class="page-sub">Manajemen tugas dan to-do list</p>
        </div>
        ${Auth.can('task','create') ? `
        <button class="btn btn-primary" onclick="TaskModule.openModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
            <path d="M12 5v14M5 12h14"/></svg>
          Tambah Task
        </button>` : ''}
      </div>
      <div id="task-tabs"></div>
      <div id="task-content"></div>
    `;
    _renderTabs();
    render();
    // Auto-arsip tasks yang sudah 1 hari di Done
    _autoArsip();
  }

  /* ── Auto arsip setelah 1 hari di Done ── */
  async function _autoArsip() {
    const now     = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    let changed   = false;
    for (const t of _tasks) {
      if (t.status === 'done' && t.doneAt) {
        if (now - new Date(t.doneAt).getTime() >= ONE_DAY) {
          t.status = 'arsip';
          t.arsipAt = new Date().toISOString();
          await DB.saveTask(t).catch(() => {});
          changed = true;
        }
      }
    }
    if (changed) { _renderTabs(); render(); }
  }

  /* ── Stats ── */
  function _stats() {
    const today = new Date().toISOString().split('T')[0];
    return {
      todo:       _tasks.filter(t => t.status === 'todo' || !t.status).length,
      inprogress: _tasks.filter(t => t.status === 'inprogress').length,
      review:     _tasks.filter(t => t.status === 'review').length,
      done:       _tasks.filter(t => t.status === 'done').length,
      arsip:      _tasks.filter(t => t.status === 'arsip').length,
      late:       _tasks.filter(t => !['done','arsip'].includes(t.status) && t.deadline && t.deadline < today).length,
    };
  }

  function _badge(n, color) {
    return n > 0 ? `<span style="background:${color||'var(--primary-h)'};color:#fff;border-radius:10px;
      font-size:9px;font-weight:700;padding:1px 6px;margin-left:4px">${n}</span>` : '';
  }

  /* ── Render Tabs ── */
  function _renderTabs() {
    const c    = _stats();
    const tabs = document.getElementById('task-tabs');
    if (!tabs) return;
    tabs.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        <button class="tab-btn ${_filter==='board'?'active':''}" onclick="TaskModule.setFilter('board')">
          🗂 Board${_badge(c.todo+c.inprogress+c.review,'var(--primary-h)')}
        </button>
        <button class="tab-btn ${_filter==='arsip'?'active':''}" onclick="TaskModule.setFilter('arsip')">
          📦 Arsip${_badge(c.arsip,'var(--text-3)')}
        </button>
        ${c.late > 0 ? `<button class="tab-btn ${_filter==='late'?'active':''}" onclick="TaskModule.setFilter('late')"
          style="color:var(--danger)">⚠ Terlambat${_badge(c.late,'var(--danger)')}</button>` : ''}
      </div>
    `;
  }

  function setFilter(f) { _filter = f; _renderTabs(); render(); }

  /* ── Access helpers ── */
  function _currentUser()  { return Auth.currentUser(); }
  function _isSuperAdmin() { return Auth.isSuperAdmin(); }
  function _canEdit(t) {
    const u = _currentUser();
    if (!u) return false;
    if (_isSuperAdmin()) return true;
    return t.createdBy === u.username || t.createdBy === u.nama;
  }
  function _isAssignee(t) {
    const u = _currentUser();
    if (!u) return false;
    const a  = (t.assignee || '').toLowerCase();
    return a === (u.nama||'').toLowerCase() || a === (u.username||'').toLowerCase();
  }
  function _canSee(t) {
    if (_isSuperAdmin() || Auth.can('task','admin')) return true;
    return _canEdit(t) || _isAssignee(t);
  }

  /* ── Render ── */
  function render() {
    const today = new Date().toISOString().split('T')[0];
    const el    = document.getElementById('task-content');
    if (!el) return;

    let data = [..._tasks];

    if (_filter === 'arsip') {
      data = data.filter(t => t.status === 'arsip');
    } else if (_filter === 'late') {
      data = data.filter(t => !['done','arsip'].includes(t.status) && t.deadline && t.deadline < today);
    } else {
      data = data.filter(t => t.status !== 'arsip');
    }

    // Non-admin: only own tasks
    if (!_isSuperAdmin() && !Auth.can('task','admin')) {
      data = data.filter(t => _canSee(t));
    }

    // Sort: late → high priority
    const pv = {high:0, medium:1, low:2};
    data.sort((a, b) => {
      const al = a.deadline && a.deadline < today && a.status !== 'done' ? 0 : 1;
      const bl = b.deadline && b.deadline < today && b.status !== 'done' ? 0 : 1;
      if (al !== bl) return al - bl;
      return (pv[a.priority]||1) - (pv[b.priority]||1);
    });

    if (!data.length) {
      el.innerHTML = `<div class="empty-state" style="height:40vh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <polyline points="9,11 12,14 22,4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <h4>Tidak ada task</h4>
        <p>${_filter==='arsip'?'Belum ada task diarsipkan':'Tambah task baru untuk memulai'}</p>
      </div>`;
      return;
    }

    // Arsip / Late → list
    if (_filter !== 'board') {
      el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
        ${data.map(t => _cardHTML(t, today)).join('')}
      </div>`;
      return;
    }

    // ── 4-Board ──
    const COLS = [
      { key:'todo',       label:'📋 To Do',       color:'var(--text-3)',        bg:'var(--surface2)',           bd:'var(--border)' },
      { key:'inprogress', label:'🔄 In Progress',  color:'#f59e0b',             bg:'rgba(245,158,11,.05)',      bd:'rgba(245,158,11,.3)' },
      { key:'review',     label:'🔍 Review',        color:'#6366f1',             bg:'rgba(99,102,241,.05)',      bd:'rgba(99,102,241,.3)' },
      { key:'done',       label:'✅ Done',           color:'var(--success)',       bg:'rgba(16,185,129,.05)',      bd:'rgba(16,185,129,.3)' },
    ];

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start">
        ${COLS.map(col => {
          const colTasks = data.filter(t =>
            col.key === 'todo'
              ? (t.status === 'todo' || !t.status)
              : t.status === col.key
          );
          return `
            <div style="background:${col.bg};border:1px solid ${col.bd};border-radius:12px;min-height:180px;overflow:hidden">
              <!-- Header -->
              <div style="padding:10px 14px;border-bottom:1px solid ${col.bd};
                display:flex;align-items:center;gap:8px;background:var(--surface)">
                <span style="font-weight:700;font-size:12px;color:${col.color}">${col.label}</span>
                <span style="margin-left:auto;background:var(--surface2);color:var(--text-3);
                  font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">${colTasks.length}</span>
              </div>
              <!-- Cards -->
              <div style="padding:8px;display:flex;flex-direction:column;gap:8px">
                ${colTasks.length === 0
                  ? `<div style="text-align:center;padding:20px 0;color:var(--text-3);font-size:11px">Kosong</div>`
                  : colTasks.map(t => _cardHTML(t, today)).join('')
                }
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  /* ── Card HTML ── */
  function _cardHTML(t, today) {
    const isDone    = t.status === 'done';
    const isArsip   = t.status === 'arsip';
    const isReview  = t.status === 'review';
    const isTodo    = t.status === 'todo' || !t.status;
    const isInProg  = t.status === 'inprogress';
    const isLate    = t.deadline && t.deadline < today && !isDone && !isArsip;
    const pc        = {high:'var(--danger)',medium:'var(--warning)',low:'var(--success)'}[t.priority] || 'var(--text-3)';
    const canEdit   = _canEdit(t);
    const isAssign  = _isAssignee(t);
    const isReviewed = !!t.reviewed;

    // Hitung sisa waktu di Done sebelum auto-arsip
    let doneCountdown = '';
    if (isDone && t.doneAt) {
      const elapsed = Date.now() - new Date(t.doneAt).getTime();
      const remaining = 24*60*60*1000 - elapsed;
      if (remaining > 0) {
        const hrs = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        doneCountdown = `<span style="font-size:9px;color:var(--text-3)">⏱ Arsip dalam ${hrs > 0 ? hrs+'j ' : ''}${mins}m</span>`;
      }
    }

    return `<div style="background:var(--surface);
      border:1px solid ${isLate?'rgba(239,68,68,.4)':'var(--border)'};
      border-left:3px solid ${isDone?'var(--success)':isArsip?'var(--text-3)':isReview?'#6366f1':isInProg?'#f59e0b':pc};
      border-radius:8px;padding:10px 12px;opacity:${isArsip?'.65':'1'}"
      style="cursor:${canEdit?'pointer':'default'}"
      onclick="TaskModule.openModal('${t.id}')">

      <!-- Title + badges -->
      <div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:5px;flex-wrap:wrap">
        <span style="font-weight:600;font-size:13px;flex:1;min-width:0;
          ${isDone||isArsip?'text-decoration:line-through;color:var(--text-3)':''}"
        >${t.judul||'Tanpa judul'}</span>
        <span class="badge ${t.priority==='high'?'badge-danger':t.priority==='low'?'badge-success':'badge-warning'}"
          style="font-size:9px;flex-shrink:0">${t.priority||'medium'}</span>
        ${isLate ? '<span class="badge badge-danger" style="font-size:9px">Terlambat</span>' : ''}
        ${isReview && isReviewed  ? '<span class="badge badge-success" style="font-size:9px">✓ Reviewed</span>' : ''}
        ${isReview && !isReviewed ? `<span class="badge" style="font-size:9px;background:rgba(99,102,241,.15);
          color:#6366f1">Menunggu Review</span>` : ''}
      </div>

      <!-- Deskripsi -->
      ${t.deskripsi ? `<p style="font-size:11px;color:var(--text-2);margin:0 0 6px;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden"
      >${t.deskripsi}</p>` : ''}

      <!-- Meta -->
      <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-3);flex-wrap:wrap;margin-bottom:8px">
        ${t.assignee  ? `<span style="background:var(--surface2);padding:1px 6px;border-radius:10px">👤 ${t.assignee}</span>` : ''}
        ${t.deadline  ? `<span style="${isLate?'color:var(--danger);font-weight:700':''}">📅 ${t.deadline}</span>` : ''}
        ${t.createdBy ? `<span>by ${t.createdBy}</span>` : ''}
        ${doneCountdown}
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:5px;flex-wrap:wrap" onclick="event.stopPropagation()">

        ${/* To Do: panah → ke In Progress */(isTodo) ? `
          <button class="btn btn-sm" onclick="TaskModule.moveNext('${t.id}')"
            style="background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.3);
              font-size:11px;padding:3px 10px;border-radius:6px;display:flex;align-items:center;gap:4px">
            In Progress
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        ` : ''}

        ${/* In Progress: panah → ke Review */(isInProg) ? `
          <button class="btn btn-sm" onclick="TaskModule.moveNext('${t.id}')"
            style="background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.3);
              font-size:11px;padding:3px 10px;border-radius:6px;display:flex;align-items:center;gap:4px">
            Review
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        ` : ''}

        ${/* Review: tombol "Sudah Review" untuk PEMBUAT TASK saja */
          (isReview && canEdit && !isReviewed) ? `
          <button class="btn btn-sm" onclick="TaskModule.markReviewed('${t.id}')"
            style="background:#6366f1;color:#fff;font-size:11px;padding:3px 10px;border-radius:6px">
            ✓ Tandai Reviewed
          </button>
        ` : ''}

        ${/* Review: tombol Done HANYA muncul setelah reviewed, dan hanya untuk assignee */
          (isReview && isReviewed && isAssign) ? `
          <button class="btn btn-sm" onclick="TaskModule.moveNext('${t.id}')"
            style="background:rgba(16,185,129,.1);color:var(--success);border:1px solid rgba(16,185,129,.3);
              font-size:11px;padding:3px 10px;border-radius:6px;display:flex;align-items:center;gap:4px">
            Done
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        ` : ''}

        ${/* Done: Arsip & Reopen (pembuat saja) */
          (isDone && canEdit) ? `
          <button class="btn btn-sm btn-ghost" style="color:var(--primary-h);font-size:10px;padding:2px 8px"
            onclick="TaskModule.markArsip('${t.id}')">📦 Arsip</button>
          <button class="btn btn-sm btn-ghost" style="font-size:10px;padding:2px 8px"
            onclick="TaskModule.markTodo('${t.id}')">↩ Reopen</button>
        ` : ''}

        ${/* Arsip: Restore & Hapus (pembuat saja) */
          (isArsip && canEdit) ? `
          <button class="btn btn-sm btn-ghost" style="font-size:10px;padding:2px 8px"
            onclick="TaskModule.markTodo('${t.id}')">↩ Restore</button>
          <button class="btn btn-sm btn-ghost" style="color:var(--danger);font-size:10px;padding:2px 8px"
            onclick="TaskModule.deleteTask('${t.id}')">🗑 Hapus</button>
        ` : ''}
      </div>
    </div>`;
  }

  /* ── Move next (hanya maju 1 langkah) ── */
  const FLOW = { todo:'inprogress', inprogress:'review', review:'done' };
  async function moveNext(id) {
    const t    = _tasks.find(x => x.id === id);
    if (!t) return;
    const next = FLOW[t.status || 'todo'];
    if (!next) return;
    // Review → Done: wajib reviewed dulu
    if (next === 'done' && !t.reviewed) {
      Notify.warning('Task belum di-review oleh pembuat task');
      return;
    }
    t.status = next;
    if (next === 'done') {
      t.doneAt = new Date().toISOString(); // catat waktu masuk Done
    }
    await DB.saveTask(t);
    _renderTabs(); render();
    const labels = {inprogress:'In Progress', review:'Review', done:'Done'};
    Notify.success(`Task dipindah ke ${labels[next]}!`);
  }

  /* ── Mark reviewed (pembuat task) ── */
  async function markReviewed(id) {
    const t = _tasks.find(x => x.id === id);
    if (!t) return;
    if (!_canEdit(t)) { Notify.warning('Hanya pembuat task yang bisa me-review'); return; }
    t.reviewed = true;
    await DB.saveTask(t);
    _renderTabs(); render();
    Notify.success('Task ditandai sudah direview — assignee sekarang bisa pindah ke Done!');
  }

  /* ── Legacy ── */
  async function markDone(id) { await moveNext(id); }

  async function markArsip(id) {
    const t = _tasks.find(x => x.id === id);
    if (!t || !_canEdit(t)) { Notify.warning('Hanya pembuat task yang bisa mengarsipkan'); return; }
    t.status = 'arsip';
    t.arsipAt = new Date().toISOString();
    await DB.saveTask(t);
    _renderTabs(); render(); Notify.success('Task diarsipkan');
  }

  async function markTodo(id) {
    const t = _tasks.find(x => x.id === id);
    if (!t) return;
    t.status   = 'todo';
    t.reviewed = false;
    t.doneAt   = null;
    t.arsipAt  = null;
    await DB.saveTask(t);
    _renderTabs(); render();
  }

  async function deleteTask(id) {
    const t = _tasks.find(x => x.id === id);
    if (!t || !_canEdit(t)) { Notify.warning('Hanya pembuat task & superadmin yang bisa menghapus'); return; }
    if (!confirm('Hapus task ini?')) return;
    await DB.deleteTask(id).catch(() => { _tasks = _tasks.filter(x => x.id !== id); });
    _tasks = _tasks.filter(x => x.id !== id);
    DB.logActivity({type:'delete_task', detail:'Task dihapus'});
    _renderTabs(); render(); Notify.success('Task dihapus');
  }

  /* ── Open modal ── */
  async function openModal(editId = '') {
    const d   = editId ? (_tasks.find(t => t.id === editId) || {}) : {};
    const mid = Utils.uid();
    // Cek akses edit
    if (editId && !_canEdit(d)) {
      // Hanya lihat — tidak bisa edit, buka read-only info
      Notify.info('Kamu hanya bisa melihat task ini');
      return;
    }
    const users  = await DB.getUsers().catch(() => []);
    const unique = [...new Set(users.map(u => u.nama||u.username).filter(Boolean))].sort();

    Modal.open({
      id: mid,
      title: editId ? 'Edit Task' : 'Task Baru',
      body: `
        <form id="task-form">
          <div class="form-group">
            <label class="form-label">Judul <span class="req">*</span></label>
            <input name="judul" class="form-control" value="${d.judul||''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Deskripsi</label>
            <input name="deskripsi" class="form-control" value="${d.deskripsi||''}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select name="priority" class="form-control">
                <option value="low"    ${d.priority==='low'   ?'selected':''}>Low</option>
                <option value="medium" ${(!d.priority||d.priority==='medium')?'selected':''}>Medium</option>
                <option value="high"   ${d.priority==='high'  ?'selected':''}>High</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-control">
                <option value="todo"       ${(!d.status||d.status==='todo')      ?'selected':''}>To Do</option>
                <option value="inprogress" ${d.status==='inprogress'             ?'selected':''}>In Progress</option>
                <option value="review"     ${d.status==='review'                 ?'selected':''}>Review</option>
                <option value="done"       ${d.status==='done'                   ?'selected':''}>Done</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
            <div class="form-group">
              <label class="form-label">Assignee</label>
              <select name="assignee" class="form-control">
                <option value="">— Pilih Assignee —</option>
                ${unique.map(n=>`<option value="${n}" ${d.assignee===n?'selected':''}>${n}</option>`).join('')}
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
        ${editId ? `<button class="btn btn-ghost" style="color:var(--danger)"
          onclick="event.stopPropagation();TaskModule.deleteTask('${editId}');Modal.close('${mid}')">
          🗑 Hapus</button>` : ''}
        <button class="btn btn-primary" onclick="TaskModule._submit('${mid}','${editId||''}')">Simpan</button>`,
    });
    return mid;
  }

  /* ── Submit ── */
  async function _submit(modalId, editId = '') {
    const fd   = new FormData(document.getElementById('task-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.judul) { Notify.warning('Judul wajib diisi'); return; }

    const u = _currentUser();
    if (editId) {
      const old        = _tasks.find(t => t.id === editId) || {};
      data.createdBy   = old.createdBy || '';
      data.reviewed    = old.status === data.status ? old.reviewed : false;
      data.doneAt      = data.status === 'done' ? (old.doneAt || new Date().toISOString()) : null;
      data.arsipAt     = old.arsipAt || null;
    } else {
      data.createdBy   = u?.username || u?.nama || '';
      data.reviewed    = false;
      data.doneAt      = data.status === 'done' ? new Date().toISOString() : null;
    }

    try {
      if (editId) data.id = editId;
      const saved = await DB.saveTask(data);
      if (saved) {
        if (editId) {
          const i = _tasks.findIndex(t => t.id === editId);
          if (i >= 0) _tasks[i] = saved; else _tasks.push(saved);
        } else {
          _tasks.push(saved);
        }
      }
      Notify.success(editId ? 'Task berhasil diperbarui!' : 'Task baru ditambahkan!');
      DB.logActivity({type:editId?'edit_task':'add_task', detail:'Task: '+data.judul});
      Modal.close(modalId);
      _renderTabs(); render();
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  return {
    init, setFilter, render, openModal, _submit,
    moveNext, markReviewed, markDone, markArsip, markTodo, deleteTask
  };
})();

window.TaskModule = TaskModule;
