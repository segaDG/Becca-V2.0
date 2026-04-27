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

  let _tasks      = [];
  let _filter     = 'board';
  let _submitting = false;  // guard against double-submit
  let _tMedia     = [];     // form media state

  /* ── Image helpers (same pattern as news) ── */
  const _imgKey  = uid => 'becca_media_' + uid;
  function _imgSave(ownerId, id, data) {
    try {
      const k = _imgKey(ownerId);
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      s[id] = data;
      localStorage.setItem(k, JSON.stringify(s));
    } catch {}
  }
  function _imgLoad(ownerId, id) {
    try { return JSON.parse(localStorage.getItem(_imgKey(ownerId)) || '{}')[id] || null; }
    catch { return null; }
  }
  function _scaleImg(file, maxPx) {
    return new Promise(res => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }
  function _renderTMediaList() {
    const el = document.getElementById('task-media-list');
    if (!el) return;
    el.innerHTML = _tMedia.map((m, i) => `
      <div style="position:relative;width:64px;height:64px;flex-shrink:0">
        <img src="${m.thumb}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
        <button onclick="TaskModule._tRemoveImg(${i})"
          style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;
                 background:#ef4444;color:#fff;border:none;font-size:11px;line-height:1;cursor:pointer;
                 display:flex;align-items:center;justify-content:center">×</button>
      </div>`).join('');
  }
  async function _tAddImages() {
    if (_tMedia.length >= 5) { Notify.warning('Maksimal 5 gambar'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.onchange = async () => {
      const files = [...input.files].slice(0, 5 - _tMedia.length);
      for (const f of files) {
        const thumb = await _scaleImg(f, 200);
        const full  = await _scaleImg(f, 1024);
        if (!thumb) continue;
        const id = Utils.uid();
        const cu = _cu();
        const ownerId = cu?.id || cu?.username || 'anon';
        _tMedia.push({ type: 'image', id, ownerId, name: f.name, thumb, full });
        _imgSave(ownerId, id, full);
      }
      _renderTMediaList();
    };
    input.click();
  }
  function _tRemoveImg(idx) {
    _tMedia.splice(idx, 1);
    _renderTMediaList();
  }
  function _openTaskImg(taskId, imgIdx) {
    const t = _tasks.find(x => x.id === taskId);
    const m = (t?.media || [])[imgIdx];
    if (!m) return;
    const src = _imgLoad(m.ownerId, m.id) || m.full || m.thumb;
    if (!src) { Notify.warning('Foto tidak tersedia'); return; }
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: m.name || 'Foto Lampiran',
      size: 'modal-xl',
      body: `<div id="timg-${mid}" style="background:#000;border-radius:8px;min-height:120px;display:flex;align-items:center;justify-content:center"></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
    const img = new Image();
    img.style.cssText = 'max-width:100%;max-height:85vh;object-fit:contain;display:block;margin:auto;border-radius:4px';
    img.onload = () => { const el = document.getElementById('timg-' + mid); if (el) { el.style.minHeight=''; el.appendChild(img); } };
    img.src = src;
  }

  /* ── Init ── */
  async function init() {
    const page = document.getElementById('page-task');
    if (!page) return;
    // Cleanup stale drag listeners from previous session
    document.removeEventListener('dragover', _trackGhost);
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

  /* ── Manual order per kolom (drag & drop) ── */
  const ORDER_KEY = 'becca_task_order';

  function _getOrder() {
    try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '{}'); }
    catch(e) { return {}; }
  }

  function _saveOrder(colKey, ids) {
    const o = _getOrder();
    o[colKey] = ids;
    localStorage.setItem(ORDER_KEY, JSON.stringify(o));
  }

  function _applyOrder(tasks, colKey) {
    const order = _getOrder()[colKey];
    if (!order || !order.length) return tasks;
    const map = {};
    tasks.forEach(t => map[t.id] = t);
    const sorted = order.map(id => map[id]).filter(Boolean);
    // Tambahkan task baru yang belum ada di order
    tasks.forEach(t => { if (!order.includes(t.id)) sorted.push(t); });
    return sorted;
  }

  /* ── Stats — hanya task yang relevan untuk user saat ini ── */
  function _stats() {
    const today = new Date().toISOString().split('T')[0];
    const mine  = _tasks.filter(_canSee); // SA = semua, lainnya = pembuat + assignee
    return {
      todo:       mine.filter(t => t.status==='todo' || !t.status).length,
      inprogress: mine.filter(t => t.status==='inprogress').length,
      review:     mine.filter(t => t.status==='review').length,
      done:       mine.filter(t => t.status==='done').length,
      arsip:      mine.filter(t => t.status==='arsip').length,
      late:       mine.filter(t => !['done','arsip'].includes(t.status) && t.deadline && t.deadline < today).length,
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
    if (_isSA()) return true;  // hanya superadmin lihat semua
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

    // Visibility: hanya superadmin lihat semua, lainnya hanya task miliknya
    if (!_isSA()) {
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

    // Inject drag-over CSS once
    if (!document.getElementById('task-dnd-style')) {
      const st = document.createElement('style');
      st.id = 'task-dnd-style';
      st.textContent =
        '.task-col-body.drag-over{background:rgba(99,102,241,.08)!important;outline:2px dashed rgba(99,102,241,.6);outline-offset:-4px;border-radius:8px}' +
        '.task-col-body.drag-over-valid{background:rgba(99,102,241,.08)!important;outline:2px dashed #6366f1;outline-offset:-4px;border-radius:8px}' +
        '.task-col-body.drag-over-invalid{background:rgba(239,68,68,.05)!important;outline:2px dashed rgba(239,68,68,.5);outline-offset:-4px;border-radius:8px}' +
        '[draggable=true]{user-select:none}' +
        '[draggable=true]:active{cursor:grabbing!important}' +
        '#task-drag-ghost{pointer-events:none!important}';
      document.head.appendChild(st);
    }

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
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
        padding-bottom:6px;margin-bottom:-6px">
        <div style="display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));
          gap:12px;align-items:start">
        ${COLS.map(col => {
          const colTasksRaw = data.filter(t =>
            col.key==='todo' ? (t.status==='todo'||!t.status) : t.status===col.key);
          const colTasks = _applyOrder(colTasksRaw, col.key);
          return `
            <div style="background:${col.bg};border:1px solid ${col.bd};border-radius:12px;min-height:180px;overflow:hidden">
              <div style="padding:10px 14px;border-bottom:1px solid ${col.bd};display:flex;align-items:center;gap:8px;background:var(--surface)">
                <span style="font-weight:700;font-size:12px;color:${col.color}">${col.label}</span>
                <span style="margin-left:auto;background:var(--surface2);color:var(--text-3);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">${colTasks.length}</span>
              </div>
              <div class="task-col-body" data-col="${col.key}"
                style="padding:8px;display:flex;flex-direction:column;gap:8px;min-height:60px;transition:background .15s"
                ondragover="TaskModule._onColDragOver(event,'${col.key}')"
                ondragleave="TaskModule._onColDragLeave(event,'${col.key}')"
                ondrop="TaskModule._onDrop(event,'${col.key}')">
                ${colTasks.length===0
                  ? `<div class="task-col-empty" style="text-align:center;padding:20px 0;color:var(--text-3);font-size:11px">Kosong</div>`
                  : colTasks.map((t,idx)=>_cardHTML(t,today,col.key,idx)).join('')}
              </div>
            </div>`;
        }).join('')}
        </div>
      </div>`;
  }

  /* ── Format tanggal DD-MM-YYYY ── */
  function _fmtDate(d) {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }

  /* ══════════════════════════════════════════════════════
     DRAG & DROP — smooth animation + cross-board (1 step)
     ══════════════════════════════════════════════════════ */
  const FLOW_ORDER = ['todo','inprogress','review','done'];
  let _dragId   = '';
  let _dragCol  = '';
  let _dragEl   = null;
  let _ghostEl  = null;
  let _overCard = null;   // card yang sedang di-hover
  let _overCol  = null;   // kolom yang sedang di-hover

  function _onDragStart(event, taskId, colKey) {
    _dragId  = taskId;
    _dragCol = colKey;
    _dragEl  = event.currentTarget;

    // Ghost element — card clone yang mengikuti cursor
    _ghostEl = _dragEl.cloneNode(true);
    _ghostEl.id = 'task-drag-ghost';
    _ghostEl.style.cssText = [
      'position:fixed','pointer-events:none','z-index:9999',
      'width:' + _dragEl.offsetWidth + 'px',
      'opacity:.85','transform:rotate(2deg) scale(1.03)',
      'box-shadow:0 12px 32px rgba(0,0,0,.2)',
      'transition:transform .1s','border-radius:8px',
    ].join(';');
    document.body.appendChild(_ghostEl);

    // Custom drag image — transparent
    const blank = document.createElement('div');
    blank.style.cssText = 'position:fixed;top:-9999px';
    document.body.appendChild(blank);
    event.dataTransfer.setDragImage(blank, 0, 0);
    setTimeout(() => blank.remove(), 0);

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);

    // Fade original card
    requestAnimationFrame(() => {
      _dragEl.style.opacity = '.25';
      _dragEl.style.transform = 'scale(.97)';
    });

    // Mouse move untuk posisi ghost
    document.addEventListener('dragover', _trackGhost);
  }

  function _trackGhost(e) {
    if (!_ghostEl) return;
    _ghostEl.style.left = (e.clientX - 20) + 'px';
    _ghostEl.style.top  = (e.clientY - 30) + 'px';
  }

  function _onDragEnd(event) {
    // Cleanup ghost
    if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }
    document.removeEventListener('dragover', _trackGhost);

    // Restore original card
    if (_dragEl) {
      _dragEl.style.opacity  = '';
      _dragEl.style.transform = '';
      _dragEl = null;
    }

    // Clear all placeholder/highlights
    document.querySelectorAll('.task-drag-placeholder').forEach(el => el.remove());
    document.querySelectorAll('.task-col-body').forEach(el => {
      el.classList.remove('drag-over','drag-over-valid','drag-over-invalid');
    });
    document.querySelectorAll('[data-task-id]').forEach(el => {
      el.style.transform = '';
      el.style.marginTop = '';
      el.style.marginBottom = '';
    });

    _overCard = null;
    _overCol  = null;
  }

  function _onColDragOver(event, targetCol) {
    event.preventDefault();

    // Cek apakah pindah kolom valid (max 1 langkah)
    const srcIdx = FLOW_ORDER.indexOf(_dragCol);
    const tgtIdx = FLOW_ORDER.indexOf(targetCol);
    const isValid = _dragId && (
      targetCol === _dragCol ||          // reorder dalam kolom
      Math.abs(tgtIdx - srcIdx) === 1    // 1 langkah saja
    );

    event.dataTransfer.dropEffect = isValid ? 'move' : 'none';

    const container = event.currentTarget;
    container.classList.toggle('drag-over-valid',   isValid && targetCol !== _dragCol);
    container.classList.toggle('drag-over-invalid', !isValid && targetCol !== _dragCol);
    container.classList.toggle('drag-over',          targetCol === _dragCol);

    if (!isValid) return;

    // Animasi push card: geser card di sekitar posisi drop
    const cards  = [...container.querySelectorAll('[data-task-id]')];
    const dropY  = event.clientY;
    let insertIdx = cards.length;

    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      const mid  = rect.top + rect.height / 2;
      if (dropY < mid) { insertIdx = i; break; }
    }

    // Reset semua card transform dulu
    cards.forEach((c, i) => {
      if (c.dataset.taskId === _dragId) return;
      const shift = 44; // px
      if (i >= insertIdx) {
        c.style.transform  = 'translateY(' + shift + 'px)';
        c.style.transition = 'transform .15s ease';
      } else {
        c.style.transform  = '';
        c.style.transition = 'transform .15s ease';
      }
    });

    _overCol = targetCol;
  }

  function _onColDragLeave(event, targetCol) {
    const rt = event.relatedTarget;
    const container = event.currentTarget;
    if (container.contains(rt)) return;

    container.classList.remove('drag-over','drag-over-valid','drag-over-invalid');

    // Reset card transforms
    container.querySelectorAll('[data-task-id]').forEach(el => {
      el.style.transform  = '';
      el.style.transition = '';
    });
  }

  function _onDrop(event, targetCol) {
    event.preventDefault();
    const container = event.currentTarget;
    container.classList.remove('drag-over','drag-over-valid','drag-over-invalid');

    if (!_dragId) return;

    // Validasi: max 1 langkah
    const srcIdx = FLOW_ORDER.indexOf(_dragCol);
    const tgtIdx = FLOW_ORDER.indexOf(targetCol);
    if (Math.abs(tgtIdx - srcIdx) > 1) {
      Notify.warning('Task hanya bisa dipindah 1 langkah sekaligus');
      // Reset transforms
      container.querySelectorAll('[data-task-id]').forEach(el => {
        el.style.transform = ''; el.style.transition = '';
      });
      return;
    }

    // Cari posisi insert
    const cards   = [...container.querySelectorAll('[data-task-id]')];
    const dropY   = event.clientY;
    let insertIdx = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (dropY < rect.top + rect.height / 2) { insertIdx = i; break; }
    }

    // Update status jika pindah kolom
    if (targetCol !== _dragCol) {
      const t = _tasks.find(x => x.id === _dragId);
      if (t) {
        // Cek validasi review → done harus sudah reviewed
        if (targetCol === 'done' && !t.reviewed) {
          Notify.warning('Task belum di-review oleh pembuat task');
          container.querySelectorAll('[data-task-id]').forEach(el => {
            el.style.transform = ''; el.style.transition = '';
          });
          return;
        }
        t.status = targetCol;
        t.urgent = false;
        if (targetCol === 'done') t.doneAt = new Date().toISOString();
        DB.saveTask(t).catch(() => {});
        const lbl = {todo:'To Do',inprogress:'In Progress',review:'Review',done:'Done'};
        Notify.success('Task dipindah ke ' + lbl[targetCol] + '!');
      }
    }

    // Update order
    const colTasksRaw = _tasks.filter(t =>
      targetCol === 'todo' ? (t.status === 'todo' || !t.status) : t.status === targetCol
    );
    // Setelah status update, filter ulang
    const updatedTasks = _tasks.filter(t =>
      targetCol === 'todo' ? (t.status === 'todo' || !t.status) : t.status === targetCol
    );
    const ordered = _applyOrder(updatedTasks, targetCol);
    let ids = ordered.map(t => t.id).filter(id => id !== _dragId);
    ids.splice(insertIdx, 0, _dragId);
    _saveOrder(targetCol, ids);

    // Jika pindah kolom, hapus dari order kolom asal
    if (targetCol !== _dragCol) {
      const srcOrder = (_getOrder()[_dragCol] || []).filter(id => id !== _dragId);
      _saveOrder(_dragCol, srcOrder);
    }

    _dragId  = '';
    _dragCol = '';

    // Smooth render
    setTimeout(() => render(), 80);
  }

  /* ── Card HTML ── */
  function _cardHTML(t, today, colKey='', cardIdx=0) {
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
    <div draggable="true"
      data-task-id="${t.id}"
      data-col="${colKey}"
      ondragstart="TaskModule._onDragStart(event,'${t.id}','${colKey}')"
      ondragend="TaskModule._onDragEnd(event)"
      style="background:${cardBg};border:1px solid ${cardBorder};
        border-left:3px solid ${borderLeft};border-radius:8px;
        padding:10px 12px;opacity:${isArsip?'.65':'1'};cursor:grab;
        transition:box-shadow .15s,transform .15s,opacity .15s;box-shadow:0 1px 4px rgba(0,0,0,.08)"
      onmouseenter="this.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'"
      onmouseleave="this.style.boxShadow='0 1px 4px rgba(0,0,0,.08)'"
      onclick="TaskModule.openModal('${t.id}')">
      <div style="display:flex;justify-content:flex-end;margin-bottom:1px;opacity:.2;font-size:12px;cursor:grab;letter-spacing:2px"
        title="Drag untuk ubah urutan">⠿⠿</div>

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

      <!-- Foto lampiran -->
      ${(()=>{
        const imgs = (t.media||[]).filter(m=>m.type==='image');
        if (!imgs.length) return '';
        const shown = imgs.slice(0,3);
        const rest  = imgs.length - 3;
        return `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px" onclick="event.stopPropagation()">
          ${shown.map((m, mi)=>{
            const src = _imgLoad(m.ownerId, m.id) || m.full || m.thumb || '';
            return src ? `<img src="${src}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;cursor:zoom-in;border:1px solid var(--border)"
              onclick="TaskModule._openTaskImg('${t.id}',${mi})">` : '';
          }).join('')}
          ${rest > 0 ? `<div style="width:48px;height:48px;background:var(--surface2);border-radius:4px;
            display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-3)">+${rest}</div>` : ''}
        </div>`;
      })()}

      <!-- Meta -->
      <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-3);flex-wrap:wrap;margin-bottom:8px">
        ${assignDisp ? `<span style="background:var(--surface2);padding:1px 6px;border-radius:10px">👤 ${assignDisp}</span>` : ''}
        ${t.deadline  ? `<span style="${isLate?'color:var(--danger);font-weight:700':''}">📅 ${_fmtDate(t.deadline)}</span>` : ''}
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

        <button onclick="event.stopPropagation();TaskModule.shareWA('${t.id}')"
          title="Kirim via WhatsApp"
          style="margin-left:auto;background:#25d366;color:#fff;border:none;border-radius:6px;
                 padding:3px 9px;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:4px;flex-shrink:0">
          ${_WA_SVG} WA
        </button>
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

    if (editId && !_canEdit(d)) {
      // Assignee: tampilkan read-only view
      const assignDisp = _assigneeDisplay(d);
      const pc = {high:'var(--danger)',medium:'var(--warning)',low:'var(--success)'}[d.priority]||'var(--text-3)';
      const viewId = Utils.uid();
      Modal.open({
        id: viewId,
        title: 'Detail Task',
        body: `
          <div style="display:flex;flex-direction:column;gap:12px">
            <div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:2px">Judul</div>
              <div style="font-weight:700;font-size:15px">${d.judul||'-'}</div>
            </div>
            ${d.deskripsi ? `<div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:2px">Deskripsi</div>
              <div style="font-size:13px">${d.deskripsi}</div>
            </div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Priority</div>
                <span style="font-size:12px;font-weight:600;color:${pc}">${d.priority||'medium'}</span>
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Status</div>
                <span style="font-size:12px;font-weight:600">${d.status||'todo'}</span>
              </div>
            </div>
            ${assignDisp ? `<div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Assignee</div>
              <div style="font-size:13px">👤 ${assignDisp}</div>
            </div>` : ''}
            ${d.deadline ? `<div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Deadline</div>
              <div style="font-size:13px">📅 ${_fmtDate(d.deadline)}</div>
            </div>` : ''}
            ${d.createdBy ? `<div>
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Dibuat oleh</div>
              <div style="font-size:13px">${d.createdBy}</div>
            </div>` : ''}
              ${(()=>{
              const imgs = (d.media||[]).filter(m=>m.type==='image');
              if (!imgs.length) return '';
              return `<div>
                <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">Lampiran Foto</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                  ${imgs.map((m, idx) => {
                    const src = _imgLoad(m.ownerId, m.id) || m.full || m.thumb || '';
                    return src ? `<img src="${src}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;cursor:zoom-in;border:1px solid var(--border)"
                      onclick="TaskModule._openTaskImg('${editId}',${idx})">` : '';
                  }).join('')}
                </div>
              </div>`;
            })()}
          </div>`,
        footer: `
          <button class="btn btn-ghost" onclick="Modal.close('${viewId}')">Tutup</button>
          <button onclick="TaskModule.shareWA('${editId}')"
            style="background:#25d366;color:#fff;border:none;border-radius:8px;padding:7px 16px;
                   cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;font-weight:600">
            ${_WA_SVG.replace('width="12" height="12"','width="14" height="14"')} Kirim via WhatsApp
          </button>`,
      });
      return;
    }

    const users  = await DB.getUsers().catch(()=>[]);
    const unique = [...new Set(users.map(u=>u.nama||u.username).filter(Boolean))].sort();

    // Current assignees (support lama & baru)
    const curAssignees = Array.isArray(d.assignees) ? d.assignees
      : d.assignee ? [d.assignee] : [];

    // Reset form media state; pre-fill from existing task
    _tMedia = (d.media || []).filter(m => m.type === 'image').map(m => ({...m}));

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
          <div class="form-group">
            <label class="form-label">Lampiran Foto
              <span style="font-size:10px;color:var(--text-3);font-weight:400"> maks 5 gambar</span>
            </label>
            <div id="task-media-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
              ${_tMedia.map((m,i) => `
                <div style="position:relative;width:64px;height:64px;flex-shrink:0">
                  <img src="${m.thumb}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
                  <button onclick="TaskModule._tRemoveImg(${i})"
                    style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;
                           background:#ef4444;color:#fff;border:none;font-size:11px;cursor:pointer;
                           display:flex;align-items:center;justify-content:center">×</button>
                </div>`).join('')}
            </div>
            <button type="button" onclick="TaskModule._tAddImages()"
              style="border:1.5px dashed var(--border);background:var(--surface2);color:var(--text-2);
                     border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;
                     display:flex;align-items:center;gap:6px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Tambah Foto
            </button>
          </div>
        </form>`,
      footer: `
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <button onclick="Modal.close('${mid}')"
            style="padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
                   border:1px solid var(--border);background:var(--surface);color:var(--text)">Batal</button>
          ${editId ? `
            <button onclick="event.stopPropagation();TaskModule.deleteTask('${editId}');Modal.close('${mid}')"
              style="padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
                     border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.1);color:#ef4444">
              🗑 Hapus</button>
            <button onclick="TaskModule.shareWA('${editId}')"
              style="padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
                     border:none;background:#25d366;color:#fff;display:flex;align-items:center;gap:5px">
              ${_WA_SVG.replace('width="12" height="12"','width="13" height="13"')} WA
            </button>` : ''}
          <button onclick="TaskModule._submit('${mid}','${editId||''}')"
            style="margin-left:auto;padding:8px 24px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;
                   border:none;background:var(--primary);color:#fff">Simpan</button>
        </div>`,
    });
    return mid;
  }

  /* ── Submit ── */
  async function _submit(modalId, editId='') {
    if (_submitting) return;
    _submitting = true;
    const fd   = new FormData(document.getElementById('task-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.judul) { _submitting = false; Notify.warning('Judul wajib diisi'); return; }

    // Kumpulkan assignees dari checkboxes
    const checked = [...document.querySelectorAll('#assignee-list input[type=checkbox]:checked')];
    data.assignees = checked.map(cb => cb.value);
    data.assignee  = data.assignees[0] || ''; // backward compat

    // Lampirkan foto (hanya simpan thumb ke DB; full sudah di per-user LS)
    data.media = _tMedia.map(m => ({ type:'image', id:m.id, ownerId:m.ownerId, name:m.name, thumb:m.thumb, full:m.full }));

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
        } else {
          // Dedup guard: only push if this ID isn't already in _tasks
          // (prevents double-card if init() ran while save was in-flight)
          if (!_tasks.find(t => t.id === saved.id)) _tasks.push(saved);
        }
      }
      Notify.success(editId?'Task berhasil diperbarui!':'Task baru ditambahkan!');
      DB.logActivity({type:editId?'edit_task':'add_task', detail:'Task: '+data.judul});

      // Push notification ke semua assignee saat task baru dibuat
      if (!editId && data.assignees?.length && typeof PushModule !== 'undefined') {
        const senderName = data.createdBy || 'Tim';
        data.assignees.forEach(name => {
          PushModule.sendToUser(name, {
            title: '📋 Task Baru: ' + (data.judul || ''),
            body:  'Ditugaskan oleh ' + senderName,
            data:  { type: 'task', taskId: (saved||data).id },
          }).catch(() => {});
        });
      }

      _tMedia = []; // reset form media
      Modal.close(modalId);
      _renderTabs(); render();
    } catch(err) { Notify.error('Gagal', err.message); }
    finally { _submitting = false; }
  }

  /* ── WhatsApp Share ── */
  const _WA_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495.001 12.05.001c3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.867-2.031-.967-.272-.099-.47-.148-.669.15-.198.297-.768.967-.941 1.165-.173.198-.345.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.298-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;

  function _shareUrl(t) {
    const base = location.href.startsWith('file:')
      ? 'https://segaDG.github.io/Becca-V2.0/'
      : (location.origin + location.pathname.replace(/[^/]*$/, ''));
    const enc = encodeURIComponent;
    return base + 'share.html'
      + '?id='   + enc(t.id || '')
      + '&t='    + enc(t.judul || '')
      + '&s='    + enc(t.status || 'todo')
      + '&p='    + enc(t.priority || 'medium')
      + '&a='    + enc(_assigneeDisplay(t))
      + '&d='    + enc(t.deadline || '');
  }

  function _waText(t) {
    const STATUS_LBL = { todo:'To Do', inprogress:'In Progress', review:'Review', done:'Done', arsip:'Arsip' };
    const PRIO_LBL   = { high:'🔴 High', medium:'🟡 Medium', low:'🟢 Low' };
    const assignDisp = _assigneeDisplay(t);
    const lines = [
      '📋 *Task BPS World*',
      '',
      '*' + (t.judul || 'Tanpa judul') + '*',
      '🔗 ' + _shareUrl(t),
      '',
    ];
    if (t.deskripsi) lines.push(t.deskripsi, '');
    lines.push('Status   : ' + (STATUS_LBL[t.status] || 'To Do'));
    lines.push('Priority : ' + (PRIO_LBL[t.priority] || 'Medium'));
    if (assignDisp)  lines.push('Assignee : ' + assignDisp);
    if (t.deadline)  lines.push('Deadline : ' + _fmtDate(t.deadline));
    if (t.createdBy) lines.push('Dibuat oleh: ' + t.createdBy);
    return lines.join('\n');
  }

  async function shareWA(id) {
    const t = _tasks.find(x => x.id === id);
    if (!t) return;
    const msg = encodeURIComponent(_waText(t));

    // Try to find single assignee's noWA for direct link
    const assignees = Array.isArray(t.assignees) ? t.assignees : (t.assignee ? [t.assignee] : []);
    let phone = null;
    if (assignees.length === 1) {
      try {
        const users = await DB.getUsers();
        const name = assignees[0];
        const u = users.find(x =>
          x.nama === name || x.username === name ||
          (x.nama||'').toLowerCase() === (name||'').toLowerCase()
        );
        if (u?.noWA) phone = u.noWA.replace(/\D/g, '');
      } catch {}
    }

    const url = phone
      ? `https://wa.me/${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  }

  return {
    init, setFilter, render, openModal, _submit, shareWA,
    moveNext, movePrev, markReviewed, markDone, markArsip, markTodo, deleteTask, toggleUrgent,
    _onDragStart, _onDragEnd, _onColDragOver, _onColDragLeave, _onDrop,
    _tAddImages, _tRemoveImg, _openTaskImg,
  };
})();

window.TaskModule = TaskModule;
