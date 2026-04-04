/* ============================================
   BECCA V2.0 — Chat Module
   WhatsApp-style realtime chat with media
============================================ */
console.log('[BECCA] ChatModule v20260404a loaded');

const ChatModule = (() => {
  'use strict';
  let _rooms = [], _messages = [], _users = [];
  let _activeRoom = null, _realtimeSetup = false;

  function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _me() { return Auth.currentUser(); }
  function _initials(name) { return (name||'?').split(' ').slice(0,2).map(w=>(w[0]||'')).join('').toUpperCase(); }
  function _timeAgo(ts) {
    if (!ts) return '';
    const d = new Date(ts), now = new Date(), diff = (now-d)/1000;
    if (diff < 60) return 'baru saja';
    if (diff < 3600) return Math.floor(diff/60) + 'm';
    if (diff < 86400) return Math.floor(diff/3600) + 'j';
    return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'});
  }
  function _fullTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  }

  const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#ef4444'];
  function _userColor(name) { let h=0; for(const c of(name||'?')) h=h*31+c.charCodeAt(0); return COLORS[Math.abs(h)%COLORS.length]; }

  /* ═══ INIT ═══ */
  async function init() {
    const page = document.getElementById('page-chat');
    if (!page) return;
    page.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-3)">Memuat chat...</div>';
    const [rooms, users] = await Promise.all([
      DB.getChatRooms().catch(()=>[]),
      DB.getUsers().catch(()=>[]),
    ]);
    _rooms = rooms.sort((a,b)=>(b.lastMessageAt||b.createdAt||'').localeCompare(a.lastMessageAt||a.createdAt||''));
    _users = [...users];
    Auth._defaultUsers.forEach(u => { if (!_users.find(x=>x.username===u.username)) _users.push(u); });
    _users = _users.filter(u=>u.aktif!==false);
    _setupRealtime();
    _render(page);
  }

  function _setupRealtime() {
    if (_realtimeSetup) return;
    _realtimeSetup = true;
    DB.onRealtimeChange('chat_messages', (payload) => {
      if (payload.eventType === 'INSERT') {
        const msg = payload.new?.data ? (typeof payload.new.data==='string'?JSON.parse(payload.new.data):payload.new.data) : payload.new;
        if (msg && _activeRoom && msg.roomId === _activeRoom.id) {
          _messages.push(msg);
          _renderMessages();
          _scrollBottom();
        }
        // Update room last message
        const room = _rooms.find(r=>r.id===msg?.roomId);
        if (room) { room.lastMessage=msg.text||'[Media]'; room.lastMessageAt=msg.createdAt; room.lastSender=msg.senderName; }
        _renderRoomList();
        // Push notification if not current room
        if (msg.senderId !== _me()?.id && (!_activeRoom || msg.roomId !== _activeRoom.id)) {
          Notify.info(msg.senderName+': '+(msg.text||'[Media]').slice(0,50));
        }
      }
    });
  }

  /* ═══ RENDER ═══ */
  function _render(page) {
    if (!page) page = document.getElementById('page-chat');
    const me = _me();
    page.innerHTML = `
      <style>
        .chat-layout{display:grid;grid-template-columns:320px 1fr;height:calc(100vh - 120px);gap:0;border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow-sm)}
        .chat-sidebar{background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
        .chat-main{display:flex;flex-direction:column;background:var(--bg);overflow:hidden}
        .chat-room-item{display:flex;align-items:center;gap:var(--s3);padding:var(--s3) var(--s4);cursor:pointer;transition:background .15s;border-bottom:1px solid var(--border)}
        .chat-room-item:hover{background:var(--surface2)}
        .chat-room-item.active{background:var(--primary-bg);border-left:3px solid var(--primary)}
        .msg-bubble{max-width:70%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;position:relative;animation:msgIn .2s ease}
        .msg-mine{background:var(--primary);color:white;border-bottom-right-radius:4px;margin-left:auto}
        .msg-other{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:4px}
        @keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:768px){.chat-layout{grid-template-columns:1fr}}
      </style>
      <div class="chat-layout">
        <div class="chat-sidebar">
          <div style="padding:var(--s3) var(--s4);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:var(--s2)">
            <input type="text" class="form-control" placeholder="Cari chat..." style="flex:1;min-height:32px;font-size:12px" oninput="ChatModule._searchRooms(this.value)">
            <button class="btn btn-primary btn-sm" onclick="ChatModule.newChat()" title="Chat Baru">+</button>
          </div>
          <div id="chat-room-list" style="flex:1;overflow-y:auto"></div>
        </div>
        <div class="chat-main" id="chat-main-area">
          <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-3)">
            <div style="text-align:center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="opacity:.3;margin-bottom:var(--s3)"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              <div style="font-size:14px;font-weight:600">Pilih percakapan</div>
              <div style="font-size:12px;margin-top:4px">atau buat chat baru</div>
            </div>
          </div>
        </div>
      </div>
    `;
    _renderRoomList();
  }

  function _renderRoomList() {
    const el = document.getElementById('chat-room-list');
    if (!el) return;
    const me = _me();
    el.innerHTML = _rooms.map(r => {
      const isGroup = r.type === 'group';
      const otherUser = !isGroup ? _users.find(u=>u.id===(r.members||[]).find(m=>m!==me?.id)) : null;
      const name = isGroup ? r.name : (otherUser?.nama || 'Unknown');
      const color = _userColor(name);
      const active = _activeRoom?.id === r.id;
      const unread = r.lastSender && r.lastSender !== me?.nama;
      return `<div class="chat-room-item ${active?'active':''}" onclick="ChatModule.openRoom('${r.id}')">
        <div style="width:40px;height:40px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${isGroup?r.name?.charAt(0)||'G':_initials(name)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;font-weight:${unread?'700':'500'};color:var(--heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(name)}</span>
            <span style="font-size:10px;color:var(--text-3);flex-shrink:0">${_timeAgo(r.lastMessageAt)}</span>
          </div>
          <div style="font-size:11px;color:${unread?'var(--text)':'var(--text-3)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${unread?'font-weight:600':''}">${_esc(r.lastMessage||'Belum ada pesan')}</div>
        </div>
      </div>`;
    }).join('') || '<div style="text-align:center;padding:var(--s6);color:var(--text-3);font-size:12px">Belum ada chat</div>';
  }

  /* ═══ OPEN ROOM ═══ */
  async function openRoom(roomId) {
    _activeRoom = _rooms.find(r=>r.id===roomId);
    if (!_activeRoom) return;
    _renderRoomList();
    // Load messages for this room
    const allMsgs = DB.getCached('chat_messages') || await DB.getChatMessages().catch(()=>[]);
    _messages = allMsgs.filter(m=>m.roomId===roomId).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
    _renderChatArea();
  }

  function _renderChatArea() {
    const el = document.getElementById('chat-main-area');
    if (!el || !_activeRoom) return;
    const me = _me();
    const isGroup = _activeRoom.type === 'group';
    const otherUser = !isGroup ? _users.find(u=>u.id===(_activeRoom.members||[]).find(m=>m!==me?.id)) : null;
    const roomName = isGroup ? _activeRoom.name : (otherUser?.nama||'Chat');

    el.innerHTML = `
      <!-- Header -->
      <div style="padding:var(--s3) var(--s4);border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:var(--s3);flex-shrink:0">
        <div style="width:36px;height:36px;border-radius:50%;background:${_userColor(roomName)};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${isGroup?(_activeRoom.name?.charAt(0)||'G'):_initials(roomName)}</div>
        <div style="flex:1"><div style="font-size:14px;font-weight:600;color:var(--heading)">${_esc(roomName)}</div>
        ${isGroup?`<div style="font-size:10px;color:var(--text-3)">${(_activeRoom.members||[]).length} anggota</div>`:''}</div>
      </div>
      <!-- Messages -->
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:var(--s4);display:flex;flex-direction:column;gap:var(--s2)">
        ${_renderMessages(true)}
      </div>
      <!-- Input -->
      <div style="padding:var(--s3) var(--s4);border-top:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:var(--s2);flex-shrink:0">
        <label style="cursor:pointer;color:var(--text-3);display:flex;align-items:center" title="Kirim foto/video">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          <input type="file" accept="image/*,video/*" style="display:none" onchange="ChatModule._sendMedia(this.files[0])">
        </label>
        <input type="text" id="chat-input" class="form-control" placeholder="Ketik pesan..." style="flex:1;min-height:36px;font-size:13px"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ChatModule.sendMessage()}">
        <button class="btn btn-primary btn-sm" onclick="ChatModule.sendMessage()" style="min-height:36px;padding:0 16px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    `;
    _scrollBottom();
  }

  function _renderMessages(returnHtml) {
    const me = _me();
    let lastDate = '';
    const html = _messages.map(m => {
      const isMine = m.senderId === me?.id || m.senderUsername === me?.username;
      const msgDate = (m.createdAt||'').slice(0,10);
      let dateSep = '';
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const d = new Date(msgDate+'T12:00:00');
        const label = msgDate === new Date().toISOString().slice(0,10) ? 'Hari Ini' : d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
        dateSep = `<div style="text-align:center;padding:var(--s2) 0"><span style="font-size:10px;padding:2px 12px;border-radius:var(--r-full);background:var(--surface2);color:var(--text-3)">${label}</span></div>`;
      }
      let content = '';
      if (m.type === 'image') {
        content = `<img src="${m.mediaUrl}" style="max-width:240px;border-radius:8px;cursor:pointer;display:block" onclick="window.open('${m.mediaUrl}','_blank')" loading="lazy">
          ${m.text?`<div style="margin-top:4px">${_esc(m.text)}</div>`:''}`;
      } else if (m.type === 'video') {
        content = `<video src="${m.mediaUrl}" controls style="max-width:240px;border-radius:8px;display:block" preload="none"></video>
          ${m.text?`<div style="margin-top:4px">${_esc(m.text)}</div>`:''}`;
      } else {
        content = `<div style="white-space:pre-wrap">${_esc(m.text)}</div>`;
      }
      return dateSep + `<div style="display:flex;flex-direction:column;${isMine?'align-items:flex-end':'align-items:flex-start'}">
        ${!isMine&&_activeRoom?.type==='group'?`<span style="font-size:10px;font-weight:600;color:${_userColor(m.senderName)};margin-bottom:1px;padding-left:4px">${_esc(m.senderName)}</span>`:''}
        <div class="msg-bubble ${isMine?'msg-mine':'msg-other'}">
          ${content}
          <div style="font-size:9px;${isMine?'color:rgba(255,255,255,.6)':'color:var(--text-3)'};text-align:right;margin-top:2px">${_fullTime(m.createdAt)}</div>
        </div>
        ${m.type==='image'||m.type==='video'?`<a href="${m.mediaUrl}" download style="font-size:10px;color:var(--primary-h);margin-top:2px">\u2b07 Download</a>`:''}
      </div>`;
    }).join('');
    if (returnHtml) return html || '<div style="text-align:center;color:var(--text-3);padding:var(--s8);font-size:12px">Belum ada pesan. Mulai percakapan!</div>';
    const el = document.getElementById('chat-messages');
    if (el) el.innerHTML = html || '<div style="text-align:center;color:var(--text-3);padding:var(--s8);font-size:12px">Belum ada pesan</div>';
  }

  function _scrollBottom() {
    setTimeout(()=>{ const el=document.getElementById('chat-messages'); if(el) el.scrollTop=el.scrollHeight; },50);
  }

  /* ═══ SEND MESSAGE ═══ */
  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = (input?.value||'').trim();
    if (!text || !_activeRoom) return;
    input.value = '';
    const me = _me();
    const msg = {
      id: Utils.uid(),
      roomId: _activeRoom.id,
      senderId: me?.id,
      senderUsername: me?.username,
      senderName: me?.nama || me?.username,
      type: 'text',
      text,
      createdAt: new Date().toISOString(),
    };
    _messages.push(msg);
    _renderMessages();
    _scrollBottom();
    // Update room
    _activeRoom.lastMessage = text.slice(0,100);
    _activeRoom.lastMessageAt = msg.createdAt;
    _activeRoom.lastSender = msg.senderName;
    await Promise.all([
      DB.saveChatMessage(msg).catch(()=>{}),
      DB.saveChatRoom(_activeRoom).catch(()=>{}),
    ]);
  }

  /* ═══ SEND MEDIA ═══ */
  async function _sendMedia(file) {
    if (!file || !_activeRoom) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) { Notify.warning('Hanya foto dan video yang didukung'); return; }
    // Size check
    if (file.size > 10*1024*1024) { Notify.warning('Ukuran maksimal 10MB'); return; }
    Notify.info('Mengirim ' + (isImage?'foto':'video') + '...');
    try {
      // Compress image
      let dataUrl;
      if (isImage) {
        dataUrl = await _compressImage(file, 800, 0.7);
      } else {
        dataUrl = await _fileToDataUrl(file);
      }
      const me = _me();
      const msg = {
        id: Utils.uid(),
        roomId: _activeRoom.id,
        senderId: me?.id,
        senderUsername: me?.username,
        senderName: me?.nama || me?.username,
        type: isImage ? 'image' : 'video',
        mediaUrl: dataUrl,
        text: '',
        createdAt: new Date().toISOString(),
      };
      _messages.push(msg);
      _renderMessages();
      _scrollBottom();
      _activeRoom.lastMessage = isImage ? '[Foto]' : '[Video]';
      _activeRoom.lastMessageAt = msg.createdAt;
      _activeRoom.lastSender = msg.senderName;
      await Promise.all([
        DB.saveChatMessage(msg).catch(()=>{}),
        DB.saveChatRoom(_activeRoom).catch(()=>{}),
      ]);
      Notify.success((isImage?'Foto':'Video') + ' terkirim');
    } catch(e) { Notify.error('Gagal kirim media: '+e.message); }
  }

  function _compressImage(file, maxW, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w=img.width, h=img.height;
        if (w > maxW) { h = h*(maxW/w); w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  function _fileToDataUrl(file) {
    return new Promise((resolve,reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ═══ NEW CHAT ═══ */
  function newChat() {
    const me = _me();
    const mid = 'new-chat-'+Date.now();
    const otherUsers = _users.filter(u=>u.id!==me?.id&&u.username!==me?.username);
    Modal.open({id:mid, title:'Chat Baru', size:'modal-md',
      body:`
        <div class="tabs" style="margin-bottom:var(--s3)">
          <button class="tab-btn active" onclick="document.getElementById('nc-dm').classList.remove('hidden');document.getElementById('nc-grp').classList.add('hidden');this.classList.add('active');this.nextElementSibling.classList.remove('active')">Direct Message</button>
          <button class="tab-btn" onclick="document.getElementById('nc-grp').classList.remove('hidden');document.getElementById('nc-dm').classList.add('hidden');this.classList.add('active');this.previousElementSibling.classList.remove('active')">Grup</button>
        </div>
        <div id="nc-dm">
          <input type="text" class="form-control" placeholder="Cari user..." style="margin-bottom:var(--s2)" oninput="ChatModule._filterNewChat(this.value)">
          <div id="nc-user-list" style="max-height:300px;overflow-y:auto">
            ${otherUsers.map(u=>`<div class="chat-room-item nc-user-item" data-name="${(u.nama||'').toLowerCase()}" onclick="ChatModule._startDM('${u.id}','${mid}')">
              <div style="width:36px;height:36px;border-radius:50%;background:${_userColor(u.nama)};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${_initials(u.nama)}</div>
              <div><div style="font-size:13px;font-weight:600">${_esc(u.nama)}</div><div style="font-size:10px;color:var(--text-3)">${u.role||''}</div></div>
            </div>`).join('')}
          </div>
        </div>
        <div id="nc-grp" class="hidden">
          <div class="form-group"><label class="form-label">Nama Grup</label><input id="nc-grp-name" class="form-control" placeholder="Nama grup..."></div>
          <div class="form-group"><label class="form-label">Anggota</label>
            <div id="nc-grp-members" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s2)">
              ${otherUsers.map(u=>`<label class="form-check" style="padding:4px 0"><input type="checkbox" value="${u.id}" data-nama="${u.nama}"> <span class="form-check-label">${_esc(u.nama)}</span></label>`).join('')}
            </div>
          </div>
          <button class="btn btn-primary" onclick="ChatModule._createGroup('${mid}')">Buat Grup</button>
        </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  function _filterNewChat(q) {
    const l=q.toLowerCase();
    document.querySelectorAll('.nc-user-item').forEach(el=>{el.style.display=el.dataset.name.includes(l)?'':'none';});
  }

  async function _startDM(userId, modalId) {
    const me = _me();
    // Check if DM room already exists
    let room = _rooms.find(r=>r.type==='dm'&&(r.members||[]).includes(me?.id)&&(r.members||[]).includes(userId));
    if (!room) {
      room = { id:Utils.uid(), type:'dm', members:[me?.id, userId], createdAt:new Date().toISOString(), lastMessage:'', lastMessageAt:'' };
      await DB.saveChatRoom(room).catch(()=>{});
      _rooms.unshift(room);
    }
    Modal.close(modalId);
    openRoom(room.id);
  }

  async function _createGroup(modalId) {
    const name = (document.getElementById('nc-grp-name')?.value||'').trim();
    if (!name) { Notify.warning('Nama grup wajib diisi'); return; }
    const checks = document.querySelectorAll('#nc-grp-members input:checked');
    const members = [_me()?.id, ...[...checks].map(c=>c.value)];
    if (members.length < 2) { Notify.warning('Pilih minimal 1 anggota'); return; }
    const room = { id:Utils.uid(), type:'group', name, members, createdAt:new Date().toISOString(), lastMessage:'', lastMessageAt:'' };
    await DB.saveChatRoom(room).catch(()=>{});
    _rooms.unshift(room);
    Modal.close(modalId);
    openRoom(room.id);
    Notify.success('Grup "'+name+'" dibuat');
  }

  function _searchRooms(q) {
    const l=q.toLowerCase();
    document.querySelectorAll('.chat-room-item').forEach(el=>{
      const text = el.textContent.toLowerCase();
      el.style.display = text.includes(l)?'':'none';
    });
  }

  return {
    init, openRoom, sendMessage, _sendMedia, newChat,
    _filterNewChat, _startDM, _createGroup, _searchRooms,
  };
})();
window.ChatModule = ChatModule;
