// ============================================================
//  BECCA V2.0 — Task Module (Kanban 4-Board v5)
//  To Do → In Progress → Review → Done
//  Features:
//  - Panah maju & mundur per kolom
//  - Urgent flag di In Progress (merah)
//  - Review: tombol Done tersembunyi sampai di-review pembuat
//  - Auto arsip setelah 1 hari di Done
//  - Assignee multi-select (checkbox)
//  - Card hanya terlihat pembuat & assignee
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
    _autoArsip();
  }

  /* ── Auto arsip setelah 1 hari di Done ── */
  async function _autoArsip() {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    let changed = false;
    for (const t of _tasks) {
      if (t.status === 'done' && t.doneAt) {
        if (Date.now() - new Date(t.doneAt).getTime() >= ONE_DAY) {
          t.status  = 'arsip';
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
      todo:       _tasks.filter(t => t.status==='todo' || !t.status).length,
      inprogress: _tasks.filter(t => t.status==='inprogress').length,
      review:     _tasks.filter(t => t.status==='review').length,
      done:       _tasks.filter(t => t.status==='done').length,
      arsip:      _tasks.filter(t => t.status==='arsip').length,
      late:       _tasks.filter(t => !['done','arsip'].includes(t.status) && t.deadline && t.deadline < today).length,
    };
  }

  function _badge(n, color) {
    return n > 0
      ? `<span style="background:${color||'var(--primary-h)'};color:#fff;border-radius:10px;font-size:9px;font-weight:700;padding:1px 6px;margin-left:4px">${n}</span>`
      : '';
  }

  /* ── Render Tabs ── */
  function _renderTabs() {
    const c    = _stats();
    const tabs = document.getElementById('task-tabs');
    if (!tabs) return;
    tabs.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        <button class="tab-btn ${_filter==='board'?'active':''}" onclick="TaskModule.setFilter('board')">
          🗂 Board${_badge(c.todo+c.inprogress+c.review,'var(--primary-h)')}</button>
        <button class="tab-btn ${_filter==='arsip'?'active':''}" onclick="TaskModule.setFilter('arsip')">
          📦 Arsip${_badge(c.arsip,'var(--text-3)')}</button>
        ${c.late>0?`<button class="tab-btn ${_filter==='late'?'active':''}" onclick="TaskModule.setFilter('late')"
          style="color:var(--danger)">⚠ Terlambat${_badge(c.late,'var(--danger)')}</button>`:''}
      </div>`;
  }

  function setFilter(f) { _filter=f; _renderTabs(); render(); }

  /* ── Access helpers ── */
  function _cu()          { return Auth.currentUser(); }
  function _isSA()        { return Auth.isSuperAdmin(); }
  function _canEdit(t) {
    const u = _cu();
    if (!u) return false;
    if (_isSA()) return true;
    return t.createdBy===u.username || t.createdBy===u.nama;
  }
  function _isAssignee(t) {
    const u = _cu();
    if (!u) return false;
    const mn = (u.nama||'').toLowerCase();
    const mu = (u.username||'').toLowerCase();
    // assignees bisa array (multi) atau string (lama)
    const list = Array.isArray(t.assignees) ? t.assignees
                 : t.assignee ? [t.assignee] : [];
    return list.some(a => {
      const al = (a||'').toLowerCase();
      return al===mn || al===mu || al.includes(mn) || mn.includes(al);
    });
  }
  function _canSee(t) {
    if (_isSA() || Auth.can('task','admin')) return true;
    return _canEdit(t) || _isAssignee(t);
  }
  function _assigneeDisplay(t) {
    const list = Array.isArray(t.assignees) ? t.assignees
                 : t.assignee ? [t.assignee] : [];
    return list.filter(Boolean).join(', ') || '';
  }

  /* ── Render ── */
  function render() {
    const today = new Date().toISOString().split('T')[0];
    const el    = document.getElementById('task-content');
    if (!el) return;

    let data = [..._tasks];
    if (_filter==='arsip') {
      data = data.filter(t => t.status==='arsip');
    } else if (_filter==='late') {
      data = data.filter(t => !['done','arsip'].includes(t.status) && t.deadline && t.deadline<today);
    } else {
      data = data.filter(t => t.status!=='arsip');
    }

    // Visibility: non-admin hanya lihat task miliknya
    if (!_isSA() && !Auth.can('task','admin')) {
      data = data.filter(t => _canSee(t));
    }

    // Sort: urgent → late → priority
    const pv = {high:0, medium:1, low:2};
    data.sort((a,b) => {
      if (!!b.urgent !== !!a.urgent) return b.urgent?1:-1;
      const al = a.deadline&&a.deadline<today&&a.status!=='done'?0:1;
      const bl = b.deadline&&b.deadline<today&&b.status!=='done'?0:1;
      if (al!==bl) return al-bl;
      return (pv[a.priority]||1)-(pv[b.priority]||1);
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

    if (_filter!=='board') {
      el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
        ${data.map(t=>_cardHTML(t,today)).join('')}</div>`;
      return;
    }

    // ── 4-Board Kanban ──
    const COLS = [
      {key:'todo',       label:'📋 To Do',      color:'var(--text-3)',  bg:'var(--surface2)',          bd:'var(--border)'},
      {key:'inprogress', label:'🔄 In Progress', color:'#f59e0b',        bg:'rgba(245,158,11,.05)',     bd:'rgba(245,158,11,.3)'},
      {key:'review',     label:'🔍 Review',       color:'#6366f1',        bg:'rgba(99,102,241,.05)',     bd:'rgba(99,102,241,.3)'},
      {key:'done',       label:'✅ Done',          color:'var(--success)', bg:'rgba(16,185,129,.05)',     bd:'rgba(16,185,129,.3)'},
    ];
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start">
        ${COLS.map(col => {
          const colTasks = data.filter(t =>
            col.key==='todo' ? (t.status==='todo'||!t.status) : t.status===col.key);
          return `
            <div style="background:${col.bg};border:1px solid ${col.bd};border-radius:12px;min-height:180px;overflow:hidden">
              <div style="padding:10px 14px;border-bottom:1px solid ${col.bd};display:flex;align-items:center;gap:8px;background:var(--surface)">
                <span style="font-weight:700;font-size:12px;color:${col.color}">${col.label}</span>
                <span style="margin-left:auto;background:var(--surface2);color:var(--text-3);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">${colTasks.length}</span>
              </div>
              <div style="padding:8px;display:flex;flex-direction:column;gap:8px">
                ${colTasks.length===0
                  ? `<div style="text-align:center;padding:20px 0;color:var(--text-3);font-size:11px">Kosong</div>`
                  : colTasks.map(t=>_cardHTML(t,today)).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  /* ── Card HTML ── */
  function _cardHTML(t, today) {
    const isDone    = t.status==='done';
    const isArsip   = t.status==='arsip';
    const isReview  = t.status==='review';
    const isTodo    = t.status==='todo'||!t.status;
    const isInProg  = t.status==='inprogress';
    const isLate    = t.deadline&&t.deadline<today&&!isDone&&!isArsip;
    const isUrgent  = !!t.urgent && isInProg;
    const pc        = {high:'var(--danger)',medium:'var(--warning)',low:'var(--success)'}[t.priority]||'var(--text-3)';
    const canEdit   = _canEdit(t);
    const isAssign  = _isAssignee(t);
    const isReviewed= !!t.reviewed;
    const assignDisp= _assigneeDisplay(t);

    // Warna border kiri
    const borderLeft = isUrgent ? '#ef4444'
      : isDone ? 'var(--success)'
      : isArsip ? 'var(--text-3)'
      : isReview ? '#6366f1'
      : isInProg ? '#f59e0b'
      : pc;

    // Background card — merah jika urgent
    const cardBg = isUrgent
      ? 'rgba(239,68,68,.07)'
      : 'var(--surface)';

    // Border card — merah jika urgent
    const cardBorder = isUrgent
      ? 'rgba(239,68,68,.5)'
      : isLate ? 'rgba(239,68,68,.3)' : 'var(--border)';

    // Countdown Done → Arsip
    let countdown = '';
    if (isDone && t.doneAt) {
      const rem = 24*3600*1000 - (Date.now()-new Date(t.doneAt).getTime());
      if (rem>0) {
        const h = Math.floor(rem/3600000);
        const m = Math.floor((rem%3600000)/60000);
        countdown = `<span style="font-size:9px;color:var(--text-3)">⏱ Arsip dalam ${h>0?h+'j ':''}${m}m</span>`;
      }
    }

    return `
    <div style="background:${cardBg};border:1px solid ${cardBorder};
      border-left:3px solid ${borderLeft};border-radius:8px;
      padding:10px 12px;opacity:${isArsip?'.65':'1'};cursor:pointer"
      onclick="TaskModule.openModal('${t.id}')">

      <!-- Title + badges -->
      <div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:5px;flex-wrap:wrap">
        ${isUrgent ? '<span style="font-size:10px;background:#ef4444;color:#fff;padding:1px 6px;border-radius:4px;font-weight:700;flex-shrink:0">🚨 URGENT</span>' : ''}
        <span style="font-weight:600;font-size:13px;flex:1;min-width:0;word-break:break-word;
          ${isDone||isArsip?'text-decoration:line-through;color:var(--text-3)':''}"
        >${t.judul||'Tanpa judul'}</span>
        <span class="badge ${t.priority==='high'?'badge-danger':t.priority==='low'?'badge-success':'badge-warning'}"
          style="font-size:9px;flex-shrink:0">${t.priority||'medium'}</span>
      </div>

      <!-- Badges status -->
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px">
        ${isLate ? '<span class="badge badge-danger" style="font-size:9px">Terlambat</span>' : ''}
        ${isReview&&isReviewed  ? '<span class="badge badge-success" style="font-size:9px">✓ Reviewed</span>' : ''}
        ${isReview&&!isReviewed ? '<span style="font-size:9px;background:rgba(99,102,241,.15);color:#6366f1;padding:1px 6px;border-radius:4px">Menunggu Review</span>' : ''}
      </div>

      <!-- Deskripsi -->
      ${t.deskripsi ? `<p style="font-size:11px;color:var(--text-2);margin:0 0 6px;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${t.deskripsi}</p>` : ''}

      <!-- Meta -->
      <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-3);flex-wrap:wrap;margin-bottom:8px">
        ${assignDisp ? `<span style="background:var(--surface2);padding:1px 6px;border-radius:10px">👤 ${assignDisp}</span>` : ''}
        ${t.deadline  ? `<span style="${isLate?'color:var(--danger);font-weight:700':''}">📅 ${t.deadline}</span>` : ''}
        ${t.createdBy ? `<span>by ${t.createdBy}</span>` : ''}
        ${countdown}
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:5px;flex-wrap:wrap" onclick="event.stopPropagation()">

        ${/* TO DO: maju ke In Progress */isTodo ? `
          <button class="btn btn-sm" onclick="TaskModule.moveNext('${t.id}')"
            style="background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.3);
              font-size:11px;padding:3px 10px;border-radius:6px;display:flex;align-items:center;gap:3px">
            In Progress
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        ` : ''}

        ${/* IN PROGRESS: ← kembali ke To Do */isInProg ? `
          <button class="btn btn-sm btn-ghost" onclick="TaskModule.movePrev('${t.id}')"
            style="font-size:11px;padding:3px 8px;display:flex;align-items:center;gap:3px;color:var(--text-3)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            To Do
          </button>
          <button class="btn btn-sm" onclick="TaskModule.moveNext('${t.id}')"
            style="background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.3);
              font-size:11px;padding:3px 10px;border-radius:6px;display:flex;align-items:center;gap:3px">
            Review
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          ${canEdit ? `
          <button class="btn btn-sm" onclick="TaskModule.toggleUrgent('${t.id}')"
            style="font-size:10px;padding:2px 8px;border-radius:6px;
              ${isUrgent
                ? 'background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.4)'
                : 'background:var(--surface2);color:var(--text-3);border:1px solid var(--border)'}">
            🚨 ${isUrgent?'Batalkan Urgent':'Tandai Urgent'}
          </button>` : ''}
        ` : ''}

        ${/* REVIEW: ← kembali ke In Progress (jika belum di-review) */isReview&&!isReviewed ? `
          <button class="btn btn-sm btn-ghost" onclick="TaskModule.movePrev('${t.id}')"
            style="font-size:11px;padding:3px 8px;display:flex;align-items:center;gap:3px;color:var(--text-3)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            In Progress
          </button>
        ` : ''}

        ${/* REVIEW: tombol "Tandai Reviewed" untuk PEMBUAT TASK */
          isReview&&canEdit&&!isReviewed ? `
          <button class="btn btn-sm" onclick="TaskModule.markReviewed('${t.id}')"
            style="background:#6366f1;color:#fff;font-size:11px;padding:3px 10px;border-radius:6px">
            ✓ Tandai Reviewed
          </button>
        ` : ''}

        ${/* REVIEW: tombol Done — hanya muncul setelah reviewed, untuk assignee/superadmin */
          isReview&&isReviewed&&(isAssign||_isSA()||!t.assignee) ? `
          <button class="btn btn-sm" onclick="TaskModule.moveNext('${t.id}')"
            style="background:rgba(16,185,129,.1);color:var(--success);border:1px solid rgba(16,185,129,.3);
              font-size:11px;padding:3px 10px;border-radius:6px;display:flex;align-items:center;gap:3px">
            Done
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        ` : ''}

        ${/* DONE: Arsip & Reopen */isDone&&canEdit ? `
          <button class="btn btn-sm btn-ghost" style="color:var(--primary-h);font-size:10px;padding:2px 8px"
            onclick="TaskModule.markArsip('${t.id}')">📦 Arsip</button>
          <button class="btn btn-sm btn-ghost" style="font-size:10px;padding:2px 8px"
            onclick="TaskModule.markTodo('${t.id}')">↩ Reopen</button>
        ` : ''}

        ${/* ARSIP: Restore & Hapus */isArsip&&canEdit ? `
          <button class="btn btn-sm btn-ghost" style="font-size:10px;padding:2px 8px"
            onclick="TaskModule.markTodo('${t.id}')">↩ Restore</button>
          <button class="btn btn-sm btn-ghost" style="color:var(--danger);font-size:10px;padding:2px 8px"
            onclick="TaskModule.deleteTask('${t.id}')">🗑 Hapus</button>
        ` : ''}
      </div>
    </div>`;
  }

  /* ── Move next (maju 1 langkah) ── */
  const NEXT = {todo:'inprogress', inprogress:'review', review:'done'};
  async function moveNext(id) {
    const t = _tasks.find(x=>x.id===id);
    if (!t) return;
    const nxt = NEXT[t.status||'todo'];
    if (!nxt) return;
    if (nxt==='done'&&!t.reviewed) { Notify.warning('Task belum di-review oleh pembuat task'); return; }
    t.status = nxt;
    t.urgent = false; // clear urgent saat maju
    if (nxt==='done') t.doneAt = new Date().toISOString();
    await DB.saveTask(t);
    _renderTabs(); render();
    const lbl = {inprogress:'In Progress',review:'Review',done:'Done'};
    Notify.success(`Task dipindah ke ${lbl[nxt]}!`);
  }

  /* ── Move prev (mundur 1 langkah) ── */
  const PREV = {inprogress:'todo', review:'inprogress'};
  async function movePrev(id) {
    const t = _tasks.find(x=>x.id===id);
    if (!t) return;
    const prv = PREV[t.status];
    if (!prv) return;
    // Hanya bisa mundur dari review jika belum di-review
    if (t.status==='review'&&t.reviewed) {
      Notify.warning('Task sudah di-review, tidak dapat dimundurkan'); return;
    }
    t.status   = prv;
    t.reviewed = false;
    await DB.saveTask(t);
    _renderTabs(); render();
    const lbl = {todo:'To Do', inprogress:'In Progress'};
    Notify.success(`Task dikembalikan ke ${lbl[prv]}`);
  }

  /* ── Toggle urgent ── */
  async function toggleUrgent(id) {
    const t = _tasks.find(x=>x.id===id);
    if (!t||!_canEdit(t)) { Notify.warning('Hanya pembuat task yang bisa menandai urgent'); return; }
    t.urgent = !t.urgent;
    await DB.saveTask(t);
    render();
    Notify.success(t.urgent ? '🚨 Task ditandai URGENT!' : 'Tanda urgent dihapus');
  }

  /* ── Mark reviewed ── */
  async function markReviewed(id) {
    const t = _tasks.find(x=>x.id===id);
    if (!t||!_canEdit(t)) { Notify.warning('Hanya pembuat task yang bisa me-review'); return; }
    t.reviewed = true;
    await DB.saveTask(t);
    _renderTabs(); render();
    Notify.success('Task ditandai reviewed — assignee sekarang bisa pindah ke Done!');
  }

  async function markDone(id)  { await moveNext(id); }

  async function markArsip(id) {
    const t = _tasks.find(x=>x.id===id);
    if (!t||!_canEdit(t)) { Notify.warning('Hanya pembuat task yang bisa mengarsipkan'); return; }
    t.status='arsip'; t.arsipAt=new Date().toISOString();
    await DB.saveTask(t); _renderTabs(); render(); Notify.success('Task diarsipkan');
  }

  async function markTodo(id) {
    const t = _tasks.find(x=>x.id===id);
    if (!t) return;
    t.status='todo'; t.reviewed=false; t.doneAt=null; t.arsipAt=null; t.urgent=false;
    await DB.saveTask(t); _renderTabs(); render();
  }

  async function deleteTask(id) {
    const t = _tasks.find(x=>x.id===id);
    if (!t||!_canEdit(t)) { Notify.warning('Hanya pembuat task & superadmin yang bisa menghapus'); return; }
    if (!confirm('Hapus task ini?')) return;
    await DB.deleteTask(id).catch(()=>{ _tasks=_tasks.filter(x=>x.id!==id); });
    _tasks=_tasks.filter(x=>x.id!==id);
    DB.logActivity({type:'delete_task',detail:'Task dihapus'});
    _renderTabs(); render(); Notify.success('Task dihapus');
  }

  /* ── Open modal ── */
  async function openModal(editId='') {
    const d   = editId ? (_tasks.find(t=>t.id===editId)||{}) : {};
    const mid = Utils.uid();

    if (editId&&!_canEdit(d)) {
      Notify.info('Kamu hanya bisa melihat task ini'); return;
    }

    const users  = await DB.getUsers().catch(()=>[]);
    const unique = [...new Set(users.map(u=>u.nama||u.username).filter(Boolean))].sort();

    // Current assignees (support lama & baru)
    const curAssignees = Array.isArray(d.assignees) ? d.assignees
      : d.assignee ? [d.assignee] : [];

    Modal.open({
      id: mid,
      title: editId ? 'Edit Task' : 'Task Baru',
      size: 'modal-lg',
      body: `
        <style>
          .assignee-list { display:flex;flex-direction:column;gap:4px;
            max-height:140px;overflow-y:auto;border:1px solid var(--border);
            border-radius:8px;padding:8px 10px;background:var(--surface2) }
          .assignee-item { display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer }
          .assignee-item:hover { color:var(--primary-h) }
          .assignee-item input[type=checkbox] { accent-color:var(--primary-h);width:14px;height:14px }
        </style>
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
          <div class="form-group">
            <label class="form-label">Assignee <span style="color:var(--text-3);font-weight:400;font-size:10px">(pilih satu atau lebih)</span></label>
            <div class="assignee-list" id="assignee-list">
              ${unique.map(n=>`
                <label class="assignee-item">
                  <input type="checkbox" value="${n}" ${curAssignees.includes(n)?'checked':''}>
                  ${n}
                </label>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Deadline</label>
            <input name="deadline" type="date" class="form-control" value="${d.deadline||''}">
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
  async function _submit(modalId, editId='') {
    const fd   = new FormData(document.getElementById('task-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.judul) { Notify.warning('Judul wajib diisi'); return; }

    // Kumpulkan assignees dari checkboxes
    const checked = [...document.querySelectorAll('#assignee-list input[type=checkbox]:checked')];
    data.assignees = checked.map(cb => cb.value);
    data.assignee  = data.assignees[0] || ''; // backward compat

    const u = _cu();
    if (editId) {
      const old      = _tasks.find(t=>t.id===editId)||{};
      data.createdBy = old.createdBy||'';
      data.reviewed  = old.status===data.status ? old.reviewed : false;
      data.doneAt    = data.status==='done' ? (old.doneAt||new Date().toISOString()) : null;
      data.arsipAt   = old.arsipAt||null;
      data.urgent    = old.urgent||false;
    } else {
      data.createdBy = u?.username||u?.nama||'';
      data.reviewed  = false;
      data.doneAt    = data.status==='done' ? new Date().toISOString() : null;
      data.urgent    = false;
    }

    try {
      if (editId) data.id = editId;
      const saved = await DB.saveTask(data);
      if (saved) {
        if (editId) {
          const i = _tasks.findIndex(t=>t.id===editId);
          if (i>=0) _tasks[i]=saved; else _tasks.push(saved);
        } else { _tasks.push(saved); }
      }
      Notify.success(editId?'Task berhasil diperbarui!':'Task baru ditambahkan!');
      DB.logActivity({type:editId?'edit_task':'add_task', detail:'Task: '+data.judul});
      Modal.close(modalId);
      _renderTabs(); render();
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  return {
    init, setFilter, render, openModal, _submit,
    moveNext, movePrev, markReviewed, markDone, markArsip, markTodo, deleteTask, toggleUrgent
  };
})();

window.TaskModule = TaskModule;
