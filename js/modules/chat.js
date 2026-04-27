/* ============================================
   BECCA V2.0 — Chat Module
   Realtime messaging, photo/video, task sharing
   Privacy: rooms only visible to participants
============================================ */
if(window.BECCA_DEBUG) console.log('[BECCA] ChatModule v20260409b loaded');

const ChatModule = (() => {
  'use strict';
  let _rooms = [], _messages = [], _users = [], _activeRoom = null, _rtSetup = false;
  let _dmLock = false;
  const _msgIds = new Set();

  function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _me() { return Auth.currentUser(); }
  function _initials(n) { return (n||'?').split(' ').slice(0,2).map(w=>(w[0]||'')).join('').toUpperCase(); }
  function _timeAgo(ts) { if(!ts) return ''; const s=(Date.now()-new Date(ts))/1000; if(s<60) return 'baru'; if(s<3600) return Math.floor(s/60)+'m'; if(s<86400) return Math.floor(s/3600)+'j'; return new Date(ts).toLocaleDateString('id-ID',{day:'2-digit',month:'short'}); }
  function _hm(ts) { if(!ts) return ''; return new Date(ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }
  const CL = ['#6366f1','#8b5cf6','#ec4899','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#ef4444'];
  function _uc(n) { let h=0; for(const c of(n||'?')) h=h*31+c.charCodeAt(0); return CL[Math.abs(h)%CL.length]; }

  function _mob() { return window.innerWidth <= 768; }

  function _isMember(room) {
    const me = _me(); if (!me) return false;
    const m = Array.isArray(room.members) ? room.members : [];
    const mu = Array.isArray(room.memberUsernames) ? room.memberUsernames : [];
    if (!m.length && !mu.length) return false;
    return m.includes(me.id) || mu.includes(me.username);
  }

  /* ═══ INIT ═══ */
  async function init() {
    const page = document.getElementById('page-chat');
    if (!page) return;
    page.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-3)">Memuat chat...</div>';
    const [rooms, users] = await Promise.all([DB.getChatRooms().catch(()=>[]), DB.getUsers().catch(()=>[])]);
    const allRooms = rooms.sort((a,b)=>(b.lastMessageAt||b.createdAt||'').localeCompare(a.lastMessageAt||a.createdAt||''));
    _rooms = allRooms.filter(r => _isMember(r));
    _users = [...users]; Auth._defaultUsers.forEach(u=>{ if(!_users.find(x=>x.username===u.username)) _users.push(u); });
    _users = _users.filter(u=>u.aktif!==false);
    _setupRT();
    _render(page);
  }

  function _setupRT() {
    if (_rtSetup) return; _rtSetup = true;
    DB.onRealtimeChange('chat_messages', (pl) => {
      // Only handle INSERT — ignore UPDATE/DELETE to prevent DOM corruption
      if (pl.eventType !== 'INSERT') return;
      const raw = pl.new; if (!raw) return;
      const msg = raw.data ? (typeof raw.data==='string'?JSON.parse(raw.data):raw.data) : raw;
      if (!msg || _msgIds.has(msg.id)) return;
      _msgIds.add(msg.id);
      // Update room sidebar
      const room = _rooms.find(r=>r.id===msg.roomId);
      if (room) { room.lastMessage=msg.text||'[Media]'; room.lastMessageAt=msg.createdAt; room.lastSender=msg.senderName; _renderRoomList(); }
      // Append to active room
      if (_activeRoom && msg.roomId === _activeRoom.id) {
        _messages.push(msg);
        _appendMsg(msg);
      }
      // Toast if not current room
      const me = _me();
      if (me && msg.senderId!==me.id && (!_activeRoom||msg.roomId!==_activeRoom.id)) {
        Notify.info((msg.senderName||'')+ ': '+(msg.text||'[Media]').slice(0,50));
      }
    });
  }

  /* ═══ RENDER ═══ */
  function _render(page) {
    if (!page) page = document.getElementById('page-chat');
    page.innerHTML = `
      <style>
        .cht-lay{display:grid;grid-template-columns:300px 1fr;height:calc(100vh - 120px);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow-sm)}
        .cht-side{background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
        .cht-main{display:flex;flex-direction:column;background:var(--bg);overflow:hidden}
        .cht-ri{display:flex;align-items:center;gap:var(--s3);padding:10px var(--s4);cursor:pointer;transition:background .1s;border-bottom:1px solid var(--border)}
        .cht-ri:hover{background:var(--surface2)}.cht-ri.act{background:var(--primary-bg)}
        .msg-b{max-width:70%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.5;animation:mi .15s ease}
        .msg-m{background:var(--primary);color:white;border-bottom-right-radius:4px;margin-left:auto}
        .msg-o{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:4px}
        .task-card-chat{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;min-width:180px;max-width:280px;cursor:pointer}
        .task-card-chat:hover{border-color:var(--primary)}
        @keyframes mi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:768px){
          .cht-lay{grid-template-columns:1fr;height:calc(100vh - 60px);height:calc(100dvh - 60px);border:none;border-radius:0;box-shadow:none}
          .cht-side.cht-hide{display:none}.cht-main.cht-hide{display:none}
          .msg-b{max-width:85%}
          .task-card-chat{min-width:160px;max-width:240px}
        }
      </style>
      <div class="cht-lay">
        <div class="cht-side ${_mob()&&_activeRoom?'cht-hide':''}">
          <div style="padding:var(--s3);border-bottom:1px solid var(--border);display:flex;gap:var(--s2)">
            <input type="text" class="form-control" placeholder="Cari..." style="flex:1;min-height:32px;font-size:12px" oninput="ChatModule._search(this.value)">
            <button class="btn btn-primary btn-sm" onclick="ChatModule.newChat()">+</button>
          </div>
          <div id="cht-rooms" style="flex:1;overflow-y:auto"></div>
        </div>
        <div class="cht-main ${_mob()&&!_activeRoom?'cht-hide':''}" id="cht-area">
          <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-3);text-align:center;padding:var(--s6)">
            <div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="opacity:.3;margin-bottom:var(--s2)"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <div style="font-size:13px;font-weight:600">Pilih percakapan</div></div>
          </div>
        </div>
      </div>`;
    _renderRoomList();
  }

  function _findOther(r, me) {
    if (r.type==='group') return null;
    const otherId = (r.members||[]).find(m=>m!==me?.id);
    let other = _users.find(u=>u.id===otherId);
    if (!other && r.memberUsernames) {
      const otherUn = r.memberUsernames.find(u=>u!==me?.username);
      if (otherUn) other = _users.find(u=>u.username===otherUn);
    }
    if (!other && r.lastSender) other = _users.find(u=>u.nama===r.lastSender);
    return other;
  }

  function _renderRoomList() {
    const el = document.getElementById('cht-rooms'); if (!el) return;
    const me = _me();
    el.innerHTML = _rooms.map(r => {
      const isG = r.type==='group';
      const other = _findOther(r, me);
      const nm = isG ? r.name : (other?.nama||r.lastSender||'Unknown');
      const act = _activeRoom?.id===r.id;
      return `<div class="cht-ri ${act?'act':''}" onclick="ChatModule.openRoom('${r.id}')">
        <div style="width:38px;height:38px;border-radius:50%;background:${_uc(nm)};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${isG?(r.name?.charAt(0)||'G'):_initials(nm)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between"><span style="font-size:13px;font-weight:600;color:var(--heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(nm)}</span>
          <span style="font-size:10px;color:var(--text-3);flex-shrink:0">${_timeAgo(r.lastMessageAt)}</span></div>
          <div style="font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(r.lastMessage||'')}</div>
        </div>
      </div>`;
    }).join('') || '<div style="text-align:center;padding:var(--s6);color:var(--text-3);font-size:12px">Belum ada chat</div>';
  }

  /* ═══ OPEN ROOM ═══ */
  async function openRoom(roomId) {
    _activeRoom = _rooms.find(r=>r.id===roomId); if (!_activeRoom) return;
    // Mobile: switch panels
    if (_mob()) {
      const side = document.querySelector('.cht-side');
      const main = document.querySelector('.cht-main');
      if (side) side.classList.add('cht-hide');
      if (main) main.classList.remove('cht-hide');
    }
    _renderRoomList();
    _messages = await DB.getChatMessagesByRoom(roomId, 50).catch(()=>[]);
    _messages.forEach(m=>_msgIds.add(m.id));
    _renderChat();
    try { const lr=JSON.parse(localStorage.getItem('becca_chat_lastread')||'{}'); lr[roomId]=new Date().toISOString(); localStorage.setItem('becca_chat_lastread',JSON.stringify(lr)); } catch{}
    if (typeof App!=='undefined'&&App._checkChatUnread) App._checkChatUnread();
  }

  function _renderChat() {
    const el = document.getElementById('cht-area'); if (!el||!_activeRoom) return;
    const me = _me(), r = _activeRoom;
    const isG = r.type==='group';
    const other = _findOther(r, me);
    const nm = isG ? r.name : (other?.nama||r.lastSender||'Chat');
    el.innerHTML = `
      <div style="padding:10px var(--s4);border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:var(--s3);flex-shrink:0">
        <button class="btn-icon" style="display:${_mob()?'flex':'none'}" id="cht-back" onclick="ChatModule._back()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
        <div style="width:34px;height:34px;border-radius:50%;background:${_uc(nm)};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${isG?(r.name?.charAt(0)||'G'):_initials(nm)}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--heading)">${_esc(nm)}</div></div>
        <button onclick="ChatModule._shareTask()" title="Kirim Task" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.07);cursor:pointer;color:var(--primary);display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
        </button>
        <button onclick="ChatModule.deleteRoom('${r.id}')" title="Hapus Chat" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);cursor:pointer;color:#ef4444;display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
      <div id="cht-msgs" style="flex:1;overflow-y:auto;padding:var(--s3);display:flex;flex-direction:column;gap:4px"></div>
      <div style="padding:var(--s2) var(--s3);border-top:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:var(--s2);flex-shrink:0">
        <label style="cursor:pointer;color:var(--text-3);display:flex" title="Foto/Video">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <input type="file" accept="image/*,video/*" style="display:none" onchange="ChatModule._media(this.files[0])">
        </label>
        <input type="text" id="cht-inp" class="form-control" placeholder="Ketik pesan..." style="flex:1;min-height:34px;font-size:13px" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ChatModule.send()}">
        <button class="btn btn-primary" onclick="ChatModule.send()" style="min-height:34px;padding:0 14px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>`;
    const cont = document.getElementById('cht-msgs');
    if (cont) { let lastD=''; _messages.forEach(m=>{ _appendMsg(m,cont,lastD); lastD=(m.createdAt||'').slice(0,10); }); }
    _scrollEnd();
  }

  /* ═══ APPEND single message ═══ */
  function _appendMsg(m, cont, prevDate) {
    if (!cont) cont = document.getElementById('cht-msgs');
    if (!cont) return;
    const me = _me(), isMine = m.senderId===me?.id||m.senderUsername===me?.username;
    const d = (m.createdAt||'').slice(0,10);
    if (d !== prevDate && d) {
      const today = new Date().toISOString().slice(0,10);
      const label = d===today?'Hari Ini':new Date(d+'T12:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long'});
      cont.insertAdjacentHTML('beforeend',`<div style="text-align:center;padding:2px 0"><span style="font-size:10px;padding:2px 10px;border-radius:var(--r-full);background:var(--surface2);color:var(--text-3)">${label}</span></div>`);
    }
    let content = '';
    if (m.type==='task') {
      const t = m.taskData || {};
      const prioCol = t.priority==='high'?'var(--danger)':t.priority==='medium'?'var(--warning)':'var(--text-3)';
      content = `<div class="task-card-chat" onclick="if(window.TaskModule){App.navigate('task');setTimeout(()=>TaskModule.openModal&&TaskModule.openModal('${t.id}'),300)}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="color:var(--primary);flex-shrink:0"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
          <span style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--primary);font-weight:700">Task</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--heading);margin-bottom:4px">${_esc(t.title||t.judul||'')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${t.status?`<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:var(--surface);border:1px solid var(--border)">${_esc(t.status)}</span>`:''}
          ${t.priority?`<span style="font-size:10px;padding:1px 6px;border-radius:4px;color:${prioCol};background:${prioCol}15;border:1px solid ${prioCol}30">${_esc(t.priority)}</span>`:''}
          ${t.assignee?`<span style="font-size:10px;color:var(--text-3)">${_esc(t.assignee)}</span>`:''}
        </div>
      </div>`;
    } else if (m.type==='image') {
      content = `<img src="${m.mediaUrl}" style="max-width:220px;border-radius:8px;cursor:pointer;display:block" onclick="window.open(this.src,'_blank')" loading="lazy">${m.text?`<div style="margin-top:3px">${_esc(m.text)}</div>`:''}`;
    } else if (m.type==='video') {
      content = `<video src="${m.mediaUrl}" controls preload="none" style="max-width:220px;border-radius:8px;display:block"></video>`;
    } else {
      content = `<div style="white-space:pre-wrap">${_esc(m.text)}</div>`;
    }
    const dl = (m.type==='image'||m.type==='video')?`<a href="${m.mediaUrl}" download style="font-size:10px;color:var(--primary-h);margin-top:1px;display:block">\u2b07 Download</a>`:'';
    cont.insertAdjacentHTML('beforeend',`<div style="display:flex;flex-direction:column;${isMine?'align-items:flex-end':'align-items:flex-start'}">
      ${!isMine&&_activeRoom?.type==='group'?`<span style="font-size:9px;font-weight:600;color:${_uc(m.senderName)};padding-left:4px">${_esc(m.senderName||'')}</span>`:''}
      <div class="msg-b ${isMine?'msg-m':'msg-o'}">${content}<div style="font-size:9px;${isMine?'color:rgba(255,255,255,.5)':'color:var(--text-3)'};text-align:right;margin-top:1px">${_hm(m.createdAt)}</div></div>${dl}
    </div>`);
    _scrollEnd();
  }

  function _scrollEnd() { setTimeout(()=>{ const el=document.getElementById('cht-msgs'); if(el) el.scrollTop=el.scrollHeight; },30); }
  function _back() {
    _activeRoom=null;
    if (_mob()) {
      const side = document.querySelector('.cht-side');
      const main = document.querySelector('.cht-main');
      if (side) side.classList.remove('cht-hide');
      if (main) main.classList.add('cht-hide');
      _renderRoomList();
    } else {
      _render();
    }
  }

  /* ═══ SEND TEXT ═══ */
  async function send() {
    const inp=document.getElementById('cht-inp'); const text=(inp?.value||'').trim();
    if (!text||!_activeRoom) return; inp.value='';
    const me=_me(), msg = { id:Utils.uid(), roomId:_activeRoom.id, senderId:me?.id, senderUsername:me?.username, senderName:me?.nama||'', type:'text', text, createdAt:new Date().toISOString() };
    _msgIds.add(msg.id); _messages.push(msg); _appendMsg(msg);
    _activeRoom.lastMessage=text.slice(0,80); _activeRoom.lastMessageAt=msg.createdAt; _activeRoom.lastSender=msg.senderName;
    _renderRoomList();
    // Save in background — don't block UI
    DB.saveChatMessage(msg).catch(e => console.warn('[Chat] save msg:', e));
    DB.saveChatRoom(_activeRoom).catch(e => console.warn('[Chat] save room:', e));
    _notifyMembers(_activeRoom, me?.nama||'', text);
  }

  /* ═══ SEND MEDIA ═══ */
  async function _media(file) {
    if (!file||!_activeRoom) return;
    const isImg=file.type.startsWith('image/'), isVid=file.type.startsWith('video/');
    if (!isImg&&!isVid) { Notify.warning('Hanya foto & video'); return; }
    if (isVid&&file.size>5*1024*1024) { Notify.warning('Video maks 5MB'); return; }
    if (isImg&&file.size>10*1024*1024) { Notify.warning('Foto maks 10MB'); return; }
    Notify.info('Mengirim...');
    try {
      let url;
      if (isImg) {
        url = await new Promise((res) => {
          const img=new Image(); const objUrl=URL.createObjectURL(file);
          img.onload=()=>{ const c=document.createElement('canvas'); let w=img.width,h=img.height;
            if(w>600){h=h*(600/w);w=600;} c.width=w;c.height=h; c.getContext('2d').drawImage(img,0,0,w,h);
            URL.revokeObjectURL(objUrl); res(c.toDataURL('image/jpeg',0.6)); };
          img.onerror=()=>{ URL.revokeObjectURL(objUrl); res(null); };
          img.src=objUrl;
        });
        if (!url) { Notify.error('Gagal memproses foto'); return; }
      } else {
        url = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
      }
      const me=_me(), msg = { id:Utils.uid(), roomId:_activeRoom.id, senderId:me?.id, senderUsername:me?.username, senderName:me?.nama||'', type:isImg?'image':'video', mediaUrl:url, text:'', createdAt:new Date().toISOString() };
      _msgIds.add(msg.id); _messages.push(msg); _appendMsg(msg);
      _activeRoom.lastMessage=isImg?'[Foto]':'[Video]'; _activeRoom.lastMessageAt=msg.createdAt; _activeRoom.lastSender=msg.senderName;
      _renderRoomList();
      DB.saveChatMessage(msg).catch(e => console.warn('[Chat] save msg:', e));
      DB.saveChatRoom(_activeRoom).catch(e => console.warn('[Chat] save room:', e));
      _notifyMembers(_activeRoom, me?.nama||'', isImg?'Mengirim foto':'Mengirim video');
      Notify.success('Terkirim');
    } catch(e) { Notify.error('Gagal: '+e.message); }
  }

  /* ═══ PUSH NOTIFICATION ═══ */
  async function _notifyMembers(room, senderName, preview) {
    if (!window.PushModule || !room) return;
    const me = _me(); if (!me) return;
    const memberUnames = (room.memberUsernames || []).filter(u => u && u !== me.username);
    if (!memberUnames.length) return;
    const isGroup = room.type === 'group';
    const title = isGroup ? `${senderName} di ${room.name||'Grup'}` : senderName;
    memberUnames.forEach(uname => {
      PushModule.sendToUser(uname, { title, body: preview.slice(0,100), data: { type: 'chat', roomId: room.id } }).catch(()=>{});
    });
  }

  /* ═══ SHARE TASK ═══ */
  async function _shareTask() {
    if (!_activeRoom) return;
    const tasks = await DB.getTasks().catch(()=>[]);
    if (!tasks.length) { Notify.info('Belum ada task'); return; }
    const mid = 'share-task-'+Date.now();
    const sorted = [...tasks].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    Modal.open({id:mid, title:'Kirim Task', size:'modal-md',
      body:`<input class="form-control" placeholder="Cari task..." style="margin-bottom:var(--s2)" oninput="ChatModule._filtTask(this.value)">
      <div id="st-list" style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
        ${sorted.map(t=>{
          const prioCol = t.priority==='high'?'var(--danger)':t.priority==='medium'?'var(--warning)':'var(--text-3)';
          return `<div class="cht-ri st-item" data-n="${_esc((t.title||t.judul||'').toLowerCase())}" onclick="ChatModule._sendTask('${t.id}','${mid}')" style="border-radius:var(--r-sm);border:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(t.title||t.judul||'')}</div>
            <div style="display:flex;gap:6px;margin-top:3px;flex-wrap:wrap">
              ${t.status?`<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:var(--surface);border:1px solid var(--border)">${_esc(t.status)}</span>`:''}
              ${t.priority?`<span style="font-size:10px;padding:1px 6px;border-radius:4px;color:${prioCol};background:${prioCol}15;border:1px solid ${prioCol}30">${_esc(t.priority)}</span>`:''}
              ${t.assignee?`<span style="font-size:10px;color:var(--text-3)">${_esc(t.assignee)}</span>`:''}
            </div>
          </div>
        </div>`;}).join('')}
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  function _filtTask(q) {
    const l = q.toLowerCase();
    document.querySelectorAll('.st-item').forEach(el=>{el.style.display=(el.dataset.n||'').includes(l)?'':'none';});
  }

  async function _sendTask(taskId, mid) {
    const tasks = await DB.getTasks().catch(()=>[]);
    const task = tasks.find(t=>t.id===taskId);
    if (!task||!_activeRoom) return;
    Modal.close(mid);
    const me = _me();
    const msg = {
      id: Utils.uid(), roomId: _activeRoom.id, senderId: me?.id, senderUsername: me?.username, senderName: me?.nama||'',
      type: 'task', text: '[Task] '+(task.title||task.judul||''),
      taskData: { id:task.id, title:task.title||task.judul, status:task.status, priority:task.priority, assignee:task.assignee||task.assignedTo },
      createdAt: new Date().toISOString()
    };
    _msgIds.add(msg.id); _messages.push(msg); _appendMsg(msg);
    _activeRoom.lastMessage='[Task] '+(task.title||task.judul||'').slice(0,60); _activeRoom.lastMessageAt=msg.createdAt; _activeRoom.lastSender=msg.senderName;
    _renderRoomList();
    DB.saveChatMessage(msg).catch(e => console.warn('[Chat] save msg:', e));
    DB.saveChatRoom(_activeRoom).catch(e => console.warn('[Chat] save room:', e));
    _notifyMembers(_activeRoom, me?.nama||'', '[Task] '+(task.title||task.judul||''));
    Notify.success('Task dikirim');
  }

  /* ═══ NEW CHAT ═══ */
  function newChat() {
    const me=_me(), mid='nc-'+Date.now();
    const others=_users.filter(u=>u.id!==me?.id&&u.username!==me?.username);
    Modal.open({id:mid, title:'Chat Baru', size:'modal-md',
      body:`<div class="tabs" style="margin-bottom:var(--s3)">
        <button class="tab-btn active" onclick="document.getElementById('nc-dm').classList.remove('hidden');document.getElementById('nc-grp').classList.add('hidden');this.classList.add('active');this.nextElementSibling.classList.remove('active')">Direct</button>
        <button class="tab-btn" onclick="document.getElementById('nc-grp').classList.remove('hidden');document.getElementById('nc-dm').classList.add('hidden');this.classList.add('active');this.previousElementSibling.classList.remove('active')">Grup</button>
      </div>
      <div id="nc-dm">
        <input class="form-control" placeholder="Cari user..." style="margin-bottom:var(--s2)" oninput="ChatModule._filt(this.value)">
        <div id="nc-list" style="max-height:280px;overflow-y:auto">
          ${others.map(u=>`<div class="cht-ri nc-u" data-n="${(u.nama||'').toLowerCase()}" onclick="ChatModule._dm('${u.id}','${u.username}','${mid}')">
            <div style="width:34px;height:34px;border-radius:50%;background:${_uc(u.nama)};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${_initials(u.nama)}</div>
            <div><div style="font-size:13px;font-weight:600">${_esc(u.nama)}</div><div style="font-size:10px;color:var(--text-3)">${u.role||''}</div></div>
          </div>`).join('')}
        </div>
      </div>
      <div id="nc-grp" class="hidden">
        <div class="form-group"><label class="form-label">Nama Grup</label><input id="nc-gn" class="form-control" placeholder="Nama grup..."></div>
        <div class="form-group"><label class="form-label">Anggota</label>
          <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s2)">
            ${others.map(u=>`<label class="form-check" style="padding:3px 0"><input type="checkbox" value="${u.id}" data-uname="${u.username||''}"><span class="form-check-label">${_esc(u.nama)}</span></label>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary" onclick="ChatModule._grp('${mid}')">Buat Grup</button>
      </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  function _filt(q) { const l=q.toLowerCase(); document.querySelectorAll('.nc-u').forEach(el=>{el.style.display=el.dataset.n.includes(l)?'':'none';}); }

  async function _dm(uid,uname,mid) {
    if (_dmLock) return; _dmLock = true;
    try {
      const me=_me();
      let room=_rooms.find(r=>{
        if(r.type!=='dm') return false;
        const m=r.members||[]; const mu=r.memberUsernames||[];
        return (m.includes(me?.id) || mu.includes(me?.username)) && (m.includes(uid) || mu.includes(uname));
      });
      if (!room) {
        room={id:Utils.uid(),type:'dm',members:[me?.id,uid],memberUsernames:[me?.username,uname],createdAt:new Date().toISOString(),lastMessage:'',lastMessageAt:''};
        await DB.saveChatRoom(room).catch(()=>{}); _rooms.unshift(room);
      } else if (!room.memberUsernames) {
        room.memberUsernames=[me?.username,uname];
        DB.saveChatRoom(room).catch(()=>{});
      }
      Modal.close(mid); openRoom(room.id);
    } finally { _dmLock = false; }
  }

  async function _grp(mid) {
    const me=_me(), name=(document.getElementById('nc-gn')?.value||'').trim();
    if (!name) { Notify.warning('Nama grup wajib'); return; }
    const checks=[...document.querySelectorAll('#nc-grp input:checked')];
    if (!checks.length) { Notify.warning('Pilih anggota'); return; }
    const members=[me?.id,...checks.map(c=>c.value)];
    const memberUsernames = [me?.username, ...checks.map(c=>c.dataset.uname).filter(Boolean)];
    const room={id:Utils.uid(),type:'group',name,members,memberUsernames,createdAt:new Date().toISOString(),lastMessage:'',lastMessageAt:''};
    await DB.saveChatRoom(room).catch(()=>{}); _rooms.unshift(room);
    Modal.close(mid); openRoom(room.id); Notify.success('Grup dibuat');
  }

  function _search(q) { const l=q.toLowerCase(); document.querySelectorAll('.cht-ri').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(l)?'':'none';}); }

  async function deleteRoom(roomId) {
    const r = _rooms.find(x=>x.id===roomId);
    if (!r) return;
    const me = _me();
    const other = _findOther(r, me);
    const nm = r.type==='group' ? r.name : (other?.nama||r.lastSender||'Chat');
    const ok = await Modal.confirm({
      title: 'Hapus Chat',
      message: `Hapus chat dengan <strong>${_esc(nm)}</strong>?<br><span style="font-size:12px;color:var(--text-3)">Semua pesan akan dihapus permanen.</span>`,
      danger: true, confirmText: 'Hapus Chat',
    });
    if (!ok) return;
    try {
      await DB.deleteChatMessagesByRoom(roomId);
      await DB.deleteChatRoom(roomId);
    } catch(e) { console.warn('deleteRoom:', e); }
    _rooms = _rooms.filter(x=>x.id!==roomId);
    _activeRoom = null; _messages = []; _msgIds.clear();
    _render();
    Notify.success('Chat dihapus');
  }

  return { init, openRoom, send, _media, newChat, _filt, _dm, _grp, _search, _back, deleteRoom, _shareTask, _filtTask, _sendTask };
})();
window.ChatModule = ChatModule;
