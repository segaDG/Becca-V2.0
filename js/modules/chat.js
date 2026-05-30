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
  let _onlineSet = new Set();   // usernames currently online
  let _presenceTimer = null;
  let _unreadDivAt = '';        // timestamp lastread saat buka room → garis "Pesan baru"
  let _replyTo = null;          // pesan yang sedang dibalas { id, name, preview, type }
  let _loadingMore = false, _allLoaded = false;  // load-more state
  let _typingChannel = null, _typingTimer = null, _typingClearTimer = null;
  let _typingUsers = {};        // { username: timestamp } yang sedang mengetik
  const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🙏'];
  const _msgIds = new Set();

  function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  // Escape lalu ubah URL jadi link yang bisa diklik (text message only)
  function _linkify(s) {
    const esc = _esc(s);
    return esc.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const clean = url.replace(/[.,;:!?)]+$/, '');
      const trail = url.slice(clean.length);
      return `<a href="${clean}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;word-break:break-all">${clean}</a>${trail}`;
    });
  }
  // Jumlah pesan belum dibaca per room (pakai lastread + lastMessageAt + lastSender)
  function _unread(room) {
    try {
      const me = _me(); if (!me || !room.lastMessageAt) return 0;
      if (room.lastSender === me.nama || room.lastSender === me.username) return 0;
      const lr = (JSON.parse(localStorage.getItem('becca_chat_lastread')||'{}'))[room.id] || '';
      return room.lastMessageAt > lr ? 1 : 0;
    } catch { return 0; }
  }
  function _isOnline(user) {
    if (!user) return false;
    return _onlineSet.has((user.username||'').toLowerCase()) || _onlineSet.has(user.username);
  }
  async function _refreshPresence() {
    try {
      const online = await DB.getOnlineUsers(90000); // online = aktif 90 detik terakhir
      const me = _me();
      _onlineSet = new Set();
      (online||[]).forEach(u => {
        const un = u.username || u.id;
        if (un && un !== me?.username) { _onlineSet.add(un); _onlineSet.add(String(un).toLowerCase()); }
      });
      _renderRoomList();
      _updateHeaderPresence();
    } catch {}
  }
  function _updateHeaderPresence() {
    const dot = document.getElementById('cht-hdr-presence');
    if (!dot || !_activeRoom || _activeRoom.type==='group') return;
    const other = _findOther(_activeRoom, _me());
    const on = _isOnline(other);
    dot.style.display = on ? 'block' : 'none';
    const st = document.getElementById('cht-hdr-status');
    if (st) { st.textContent = on ? 'online' : ''; st.style.color = on ? '#22c55e' : 'var(--text-3)'; }
  }
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
    // Presence: fetch sekarang + refresh tiap 30 detik selama di halaman chat
    _refreshPresence();
    if (_presenceTimer) clearInterval(_presenceTimer);
    _presenceTimer = setInterval(() => {
      if (window.App?._currentPage !== 'chat') { clearInterval(_presenceTimer); _presenceTimer = null; return; }
      _refreshPresence();
    }, 30000);
  }

  function _setupRT() {
    if (_rtSetup) return; _rtSetup = true;
    DB.onRealtimeChange('chat_messages', (pl) => {
      // UPDATE → reaction/edit pesan: update in-place tanpa corrupt DOM
      if (pl.eventType === 'UPDATE') {
        const raw = pl.new; if (!raw) return;
        const upd = raw.data ? (typeof raw.data==='string'?JSON.parse(raw.data):raw.data) : raw;
        if (!upd || !upd.id) return;
        const idx = _messages.findIndex(x=>x.id===upd.id);
        if (idx>=0 && _activeRoom && upd.roomId===_activeRoom.id) {
          _messages[idx] = { ..._messages[idx], ...upd };
          _rerenderMsg(_messages[idx]);
        }
        return;
      }
      if (pl.eventType === 'DELETE') {
        const oldId = pl.old?.id;
        if (oldId) { _messages = _messages.filter(m=>m.id!==oldId); _msgIds.delete(oldId); document.querySelector(`.cht-msg-wrap[data-mid="${oldId}"]`)?.remove(); }
        return;
      }
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
        // Saya sedang buka room ini → otomatis tandai sebagai dibaca
        const me0 = _me();
        if (me0 && msg.senderId !== me0.id && msg.senderUsername !== me0.username) _markRead(_activeRoom);
      }
      // Toast if not current room
      const me = _me();
      if (me && msg.senderId!==me.id && (!_activeRoom||msg.roomId!==_activeRoom.id)) {
        Notify.info((msg.senderName||'')+ ': '+(msg.text||'[Media]').slice(0,50));
      }
    });
    // Realtime chat_rooms → deteksi lawan bicara sudah baca (read receipt)
    DB.onRealtimeChange('chat_rooms', (pl) => {
      if (pl.eventType === 'DELETE') return;
      const raw = pl.new; if (!raw) return;
      const room = raw.data ? (typeof raw.data==='string'?JSON.parse(raw.data):raw.data) : raw;
      if (!room || !room.id) return;
      const local = _rooms.find(r=>r.id===room.id);
      if (local && room.reads) local.reads = { ...(local.reads||{}), ...room.reads };
      if (_activeRoom && _activeRoom.id === room.id) {
        if (room.reads) _activeRoom.reads = { ...(_activeRoom.reads||{}), ...room.reads };
        _updateReadTicks();
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
        .msg-b{padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.5;animation:mi .15s ease;word-break:break-word;overflow-wrap:anywhere;min-width:48px;max-width:100%}
        .msg-m{background:var(--primary);color:white;border-bottom-right-radius:4px}
        .msg-o{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:4px}
        .task-card-chat{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;min-width:180px;max-width:280px;cursor:pointer}
        .task-card-chat:hover{border-color:var(--primary)}
        @keyframes mi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .cht-msg-wrap{position:relative;max-width:75%;display:flex;flex-direction:column;min-width:0}
        .cht-msg-wrap.mine{align-self:flex-end;align-items:flex-end}
        .cht-msg-wrap.other{align-self:flex-start;align-items:flex-start}
        @media(max-width:768px){.cht-msg-wrap{max-width:85%}}
        .cht-msg-menu{position:absolute;top:8px;opacity:0;transition:opacity .12s;border:none;background:var(--surface2);color:var(--text-3);cursor:pointer;font-size:14px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.12);z-index:2}
        .cht-msg-wrap.mine .cht-msg-menu{right:calc(100% + 4px)}
        .cht-msg-wrap.other .cht-msg-menu{left:calc(100% + 4px)}
        .cht-msg-wrap:hover .cht-msg-menu{opacity:.95}
        .cht-msg-menu:hover{background:var(--primary);color:#fff}
        #cht-inp{font-family:inherit}
        .cht-msg-flash{animation:chtFlash 1.4s ease}
        @keyframes chtFlash{0%,100%{background:transparent}30%,60%{background:rgba(99,102,241,.18)}}
        .cht-ctx{position:fixed;z-index:9500;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.25);padding:4px;min-width:150px}
        .cht-ctx button{display:flex;align-items:center;gap:8px;width:100%;border:none;background:transparent;padding:8px 10px;border-radius:6px;cursor:pointer;font-size:12.5px;color:var(--text);text-align:left}
        .cht-ctx button:hover{background:var(--surface2)}
        .cht-ctx .cht-react-row{display:flex;gap:2px;padding:4px;border-bottom:1px solid var(--border);margin-bottom:4px}
        .cht-ctx .cht-react-row span{cursor:pointer;font-size:18px;padding:3px 5px;border-radius:6px;transition:transform .1s}
        .cht-ctx .cht-react-row span:hover{transform:scale(1.25);background:var(--surface2)}
        .cht-typing{font-size:11px;color:var(--text-3);font-style:italic;padding:2px 14px;min-height:16px}
        .cht-typing-dot{display:inline-block;animation:chtTyping 1.2s infinite}
        @keyframes chtTyping{0%,60%,100%{opacity:.3}30%{opacity:1}}
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
      const unread = _unread(r);
      const online = !isG && _isOnline(other);
      return `<div class="cht-ri ${act?'act':''}" onclick="ChatModule.openRoom('${r.id}')">
        <div style="position:relative;flex-shrink:0">
          <div style="width:38px;height:38px;border-radius:50%;background:${_uc(nm)};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${isG?(r.name?.charAt(0)||'G'):_initials(nm)}</div>
          ${online?`<span style="position:absolute;bottom:0;right:0;width:11px;height:11px;border-radius:50%;background:#22c55e;border:2px solid var(--surface)"></span>`:''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span style="font-size:13px;font-weight:${unread?700:600};color:var(--heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(nm)}</span>
          <span style="font-size:10px;color:${unread?'var(--primary)':'var(--text-3)'};flex-shrink:0;font-weight:${unread?700:400}">${_timeAgo(r.lastMessageAt)}</span></div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <span style="font-size:11px;color:${unread?'var(--text-2)':'var(--text-3)'};font-weight:${unread?600:400};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${_esc(r.lastMessage||'')}</span>
            ${unread?`<span style="flex-shrink:0;min-width:18px;height:18px;border-radius:9px;background:var(--primary);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px">●</span>`:''}
          </div>
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
    // Capture lastread SEBELUM di-update — untuk garis pemisah "Pesan baru"
    let prevRead = '';
    try { prevRead = (JSON.parse(localStorage.getItem('becca_chat_lastread')||'{}'))[roomId] || ''; } catch {}
    _unreadDivAt = prevRead;
    _allLoaded = false; _loadingMore = false; _replyTo = null;
    _messages = await DB.getChatMessagesByRoom(roomId, 50).catch(()=>[]);
    _msgIds.clear();
    _messages.forEach(m=>_msgIds.add(m.id));
    _renderChat();
    try { const lr=JSON.parse(localStorage.getItem('becca_chat_lastread')||'{}'); lr[roomId]=new Date().toISOString(); localStorage.setItem('becca_chat_lastread',JSON.stringify(lr)); } catch{}
    // Read receipt: tandai bahwa SAYA sudah baca room ini (per-user di room.reads)
    _markRead(_activeRoom);
    if (typeof App!=='undefined'&&App._checkChatUnread) App._checkChatUnread();
  }

  // Tulis timestamp "saya sudah baca" ke room.reads[username] dan save (debounced)
  let _markReadTimer = null;
  function _markRead(room) {
    if (!room) return;
    const me = _me(); if (!me?.username) return;
    room.reads = room.reads || {};
    room.reads[me.username] = new Date().toISOString();
    clearTimeout(_markReadTimer);
    _markReadTimer = setTimeout(() => { DB.saveChatRoom(room).catch(()=>{}); }, 400);
  }

  // ✓ = terkirim, ✓✓ = sudah dibaca lawan (DM: other; grup: semua member lain)
  function _readMark(createdAt) {
    if (!_activeRoom) return { mark: '✓', read: false };
    const me = _me();
    const reads = _activeRoom.reads || {};
    const others = (_activeRoom.memberUsernames||[]).filter(u => u && u !== me?.username);
    if (!others.length) return { mark: '✓', read: false };
    const allRead = others.every(u => reads[u] && reads[u] >= createdAt);
    return { mark: allRead ? '✓✓' : '✓', read: allRead };
  }
  // Update semua tick di pesan sendiri (dipanggil saat room.reads berubah via realtime)
  function _updateReadTicks() {
    document.querySelectorAll('.cht-tick').forEach(el => {
      const { mark, read } = _readMark(el.dataset.ts || '');
      el.textContent = mark;
      el.style.color = read ? '#38bdf8' : 'rgba(255,255,255,.5)';
    });
  }

  function _renderChat() {
    const el = document.getElementById('cht-area'); if (!el||!_activeRoom) return;
    const me = _me(), r = _activeRoom;
    const isG = r.type==='group';
    const other = _findOther(r, me);
    const nm = isG ? r.name : (other?.nama||r.lastSender||'Chat');
    const otherOnline = !isG && _isOnline(other);
    el.innerHTML = `
      <div style="padding:10px var(--s4);border-bottom:1px solid var(--border);background:var(--surface);display:flex;align-items:center;gap:var(--s3);flex-shrink:0">
        <button class="btn-icon" style="display:${_mob()?'flex':'none'}" id="cht-back" onclick="ChatModule._back()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
        <div style="position:relative">
          <div style="width:34px;height:34px;border-radius:50%;background:${_uc(nm)};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${isG?(r.name?.charAt(0)||'G'):_initials(nm)}</div>
          <span id="cht-hdr-presence" style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#22c55e;border:2px solid var(--surface);display:${otherOnline?'block':'none'}"></span>
        </div>
        <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--heading)">${_esc(nm)}</div>${!isG?`<div style="font-size:10px;color:${otherOnline?'#22c55e':'var(--text-3)'}" id="cht-hdr-status">${otherOnline?'online':''}</div>`:''}</div>
        <button onclick="ChatModule._toggleSearch()" title="Cari di percakapan" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;color:var(--text-2);display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <button onclick="ChatModule._shareTask()" title="Kirim Task" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.07);cursor:pointer;color:var(--primary);display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>
        </button>
        <button onclick="ChatModule.deleteRoom('${r.id}')" title="Hapus Chat" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.07);cursor:pointer;color:#ef4444;display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
      <div id="cht-search-bar" style="display:none;align-items:center;gap:6px;padding:6px var(--s3);border-bottom:1px solid var(--border);background:var(--surface2);flex-shrink:0">
        <input id="cht-search-inp" class="form-control" placeholder="Cari pesan..." style="flex:1;min-height:30px;font-size:12px" oninput="ChatModule._searchConv(this.value)">
        <span id="cht-search-count" style="font-size:11px;color:var(--text-3)"></span>
        <button onclick="ChatModule._toggleSearch()" style="border:none;background:transparent;cursor:pointer;color:var(--text-3);font-size:15px">✕</button>
      </div>
      <div id="cht-pin-bar" style="display:none;align-items:center;gap:8px;padding:6px var(--s3);border-bottom:1px solid var(--border);background:rgba(99,102,241,.05);flex-shrink:0"></div>
      <div style="flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column">
        <div id="cht-msgs" style="flex:1;overflow-y:auto;overflow-x:hidden;padding:var(--s3);display:flex;flex-direction:column;gap:4px"></div>
        <button id="cht-scroll-btn" onclick="ChatModule._scrollEnd(true)" style="display:none;position:absolute;bottom:12px;right:14px;width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18);align-items:center;justify-content:center;z-index:5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
          <span id="cht-scroll-badge" style="display:none;position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;background:var(--primary);color:#fff;font-size:9px;font-weight:700;align-items:center;justify-content:center;padding:0 4px"></span>
        </button>
      </div>
      <div id="cht-typing" class="cht-typing" style="flex-shrink:0"></div>
      <div id="cht-reply-bar" style="display:none;align-items:center;gap:6px;padding:6px var(--s3);border-top:1px solid var(--border);background:var(--surface2);flex-shrink:0"></div>
      <div style="padding:var(--s2) var(--s3);border-top:1px solid var(--border);background:var(--surface);display:flex;align-items:flex-end;gap:var(--s2);flex-shrink:0;position:relative">
        <label style="cursor:pointer;color:var(--text-3);display:flex;padding-bottom:8px" title="Foto/Video">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <input type="file" accept="image/*,video/*" style="display:none" onchange="ChatModule._media(this.files[0])">
        </label>
        <div id="cht-mention-pop" style="display:none;position:absolute;bottom:100%;left:40px;right:40px;max-height:180px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 -4px 20px rgba(0,0,0,.18);margin-bottom:4px;z-index:20"></div>
        <textarea id="cht-inp" class="form-control" placeholder="Ketik pesan..." rows="1" style="flex:1;min-height:34px;max-height:120px;font-size:13px;resize:none;line-height:1.4;padding-top:8px;padding-bottom:8px;overflow-y:auto"
          oninput="ChatModule._composerInput(this)"
          onkeydown="ChatModule._composerKey(event)"></textarea>
        <button class="btn btn-primary" id="cht-send-btn" onclick="ChatModule.send()" disabled style="min-height:34px;padding:0 14px;opacity:.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>`;
    const cont = document.getElementById('cht-msgs');
    if (cont) {
      let lastD=''; _messages.forEach(m=>{ _appendMsg(m,cont,lastD); lastD=(m.createdAt||'').slice(0,10); });
      cont.onscroll = _onMsgScroll;
    }
    _renderReplyBar();
    _renderPinBar();
    _renderTyping();
    _setupTypingChannel();
    _scrollEnd();
  }

  // Composer: auto-grow textarea + enable/disable send button + typing + mention
  function _composerInput(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    const btn = document.getElementById('cht-send-btn');
    if (btn) {
      const has = !!ta.value.trim();
      btn.disabled = !has;
      btn.style.opacity = has ? '1' : '.5';
    }
    _sendTyping();
    _checkMention(ta);
  }

  // Enter kirim (kecuali lagi pilih mention) / Shift+Enter newline
  function _composerKey(event) {
    const pop = document.getElementById('cht-mention-pop');
    const popOpen = pop && pop.style.display !== 'none';
    if (event.key === 'Escape' && popOpen) { pop.style.display='none'; event.preventDefault(); return; }
    if (event.key === 'Enter' && !event.shiftKey) {
      if (popOpen) {
        // pilih item mention pertama
        const first = pop.querySelector('[data-uname]');
        if (first) { event.preventDefault(); _pickMention(first.dataset.uname, first.dataset.nama); return; }
      }
      event.preventDefault(); send();
    }
  }

  /* ═══ MENTION AUTOCOMPLETE (grup) ═══ */
  function _checkMention(ta) {
    const pop = document.getElementById('cht-mention-pop');
    if (!pop || _activeRoom?.type !== 'group') { if(pop) pop.style.display='none'; return; }
    const val = ta.value, pos = ta.selectionStart;
    const before = val.slice(0, pos);
    const match = before.match(/@([a-zA-Z0-9_.]*)$/);
    if (!match) { pop.style.display='none'; return; }
    const q = match[1].toLowerCase();
    const me = _me();
    const cands = _users.filter(u => u.username && u.username!==me?.username
      && (_activeRoom.memberUsernames||[]).includes(u.username)
      && ((u.nama||'').toLowerCase().includes(q) || (u.username||'').toLowerCase().includes(q)));
    if (!cands.length) { pop.style.display='none'; return; }
    pop.style.display='block';
    pop.innerHTML = cands.slice(0,6).map(u=>`
      <div data-uname="${u.username}" data-nama="${_esc(u.nama||u.username)}" onclick="ChatModule._pickMention('${u.username}','${_esc(u.nama||u.username)}')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <div style="width:26px;height:26px;border-radius:50%;background:${_uc(u.nama)};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${_initials(u.nama)}</div>
        <div style="font-size:12px;font-weight:600">${_esc(u.nama||u.username)}</div>
      </div>`).join('');
  }
  function _pickMention(uname, nama) {
    const ta = document.getElementById('cht-inp'); if (!ta) return;
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos).replace(/@([a-zA-Z0-9_.]*)$/, '@'+uname+' ');
    const after = ta.value.slice(pos);
    ta.value = before + after;
    ta.focus();
    ta.selectionStart = ta.selectionEnd = before.length;
    document.getElementById('cht-mention-pop').style.display='none';
    _composerInput(ta);
  }

  /* ═══ TYPING INDICATOR (Supabase broadcast, ephemeral) ═══ */
  async function _setupTypingChannel() {
    if (!_activeRoom) return;
    const roomId = _activeRoom.id;
    // Teardown channel lama
    if (_typingChannel) { try { _typingChannel.unsubscribe(); } catch{} _typingChannel = null; }
    _typingUsers = {};
    try {
      const sb = await DB.getClient(); if (!sb) return;
      if (!_activeRoom || _activeRoom.id !== roomId) return; // room berubah saat await
      _typingChannel = sb.channel('typing:'+roomId, { config:{ broadcast:{ self:false } } });
      _typingChannel.on('broadcast', { event:'typing' }, (p) => {
        const u = p.payload?.user; if (!u) return;
        _typingUsers[u] = Date.now();
        _renderTyping();
      });
      _typingChannel.subscribe();
    } catch {}
  }
  function _sendTyping() {
    if (!_typingChannel) return;
    const me = _me(); if (!me?.nama) return;
    clearTimeout(_typingTimer);
    _typingTimer = setTimeout(() => {
      try { _typingChannel.send({ type:'broadcast', event:'typing', payload:{ user: me.nama } }); } catch {}
    }, 150);
  }
  function _renderTyping() {
    const el = document.getElementById('cht-typing'); if (!el) return;
    const now = Date.now();
    const active = Object.keys(_typingUsers).filter(u => now - _typingUsers[u] < 4000);
    if (!active.length) { el.innerHTML=''; clearTimeout(_typingClearTimer); return; }
    const label = active.length===1 ? `${_esc(active[0])} sedang mengetik` : `${active.length} orang sedang mengetik`;
    el.innerHTML = `${label}<span class="cht-typing-dot">.</span><span class="cht-typing-dot" style="animation-delay:.2s">.</span><span class="cht-typing-dot" style="animation-delay:.4s">.</span>`;
    clearTimeout(_typingClearTimer);
    _typingClearTimer = setTimeout(_renderTyping, 1500);
  }

  /* ═══ SEARCH DALAM PERCAKAPAN ═══ */
  function _toggleSearch() {
    const bar = document.getElementById('cht-search-bar'); if (!bar) return;
    const show = bar.style.display === 'none' || !bar.style.display;
    bar.style.display = show ? 'flex' : 'none';
    if (show) { setTimeout(()=>document.getElementById('cht-search-inp')?.focus(),50); }
    else { _searchConv(''); document.getElementById('cht-search-inp').value=''; }
  }
  function _searchConv(q) {
    const l = (q||'').toLowerCase().trim();
    const wraps = document.querySelectorAll('.cht-msg-wrap');
    let count = 0;
    wraps.forEach(w => {
      const m = _messages.find(x=>x.id===w.dataset.mid);
      const txt = (m?.text||'').toLowerCase();
      const hit = l && txt.includes(l);
      w.style.outline = hit ? '2px solid var(--primary)' : '';
      w.style.borderRadius = hit ? '8px' : '';
      if (hit) count++;
    });
    const cnt = document.getElementById('cht-search-count');
    if (cnt) cnt.textContent = l ? `${count} hasil` : '';
    if (l && count) {
      // scroll ke hasil terakhir (terbaru)
      const hits = [...wraps].filter(w => { const m=_messages.find(x=>x.id===w.dataset.mid); return m&&(m.text||'').toLowerCase().includes(l); });
      hits[hits.length-1]?.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  }

  // Tampilkan tombol scroll-to-bottom saat user scroll ke atas
  let _newWhileScrolled = 0;
  function _onMsgScroll() {
    const el = document.getElementById('cht-msgs');
    const btn = document.getElementById('cht-scroll-btn');
    if (!el || !btn) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      btn.style.display = 'none';
      _newWhileScrolled = 0;
      const badge = document.getElementById('cht-scroll-badge'); if (badge) badge.style.display='none';
    } else {
      btn.style.display = 'flex';
    }
    // Load-more: scroll mendekati atas → ambil pesan lebih lama
    if (el.scrollTop < 60 && !_loadingMore && !_allLoaded) _loadMore();
  }

  async function _loadMore() {
    if (_loadingMore || _allLoaded || !_activeRoom || !_messages.length) return;
    _loadingMore = true;
    const cont = document.getElementById('cht-msgs');
    const oldest = _messages[0]?.createdAt;
    const prevH = cont ? cont.scrollHeight : 0;
    const loader = document.createElement('div');
    loader.id='cht-loadmore'; loader.style.cssText='text-align:center;padding:8px;font-size:11px;color:var(--text-3)';
    loader.textContent='Memuat pesan lama...';
    cont?.prepend(loader);
    try {
      const older = await DB.getChatMessagesByRoom(_activeRoom.id, 30, oldest).catch(()=>[]);
      const fresh = older.filter(m => !_msgIds.has(m.id));
      loader.remove();
      if (!fresh.length) { _allLoaded = true; _loadingMore = false; return; }
      fresh.forEach(m=>_msgIds.add(m.id));
      _messages = [...fresh, ..._messages];
      // Prepend ke DOM (urutan lama → baru), tanpa date divider rumit
      const html = fresh.map(m => _msgBubble(m)).join('');
      cont?.insertAdjacentHTML('afterbegin', html);
      // Pertahankan posisi scroll (supaya tidak loncat)
      if (cont) cont.scrollTop = cont.scrollHeight - prevH;
    } catch {} finally { _loadingMore = false; }
  }

  // Highlight @mention dalam teks (setelah linkify). @username → chip
  function _renderText(text) {
    let html = _linkify(text);
    const me = _me();
    html = html.replace(/@([a-zA-Z0-9_.]+)/g, (full, uname) => {
      const u = _users.find(x => (x.username||'').toLowerCase() === uname.toLowerCase());
      if (!u) return full;
      const isMe = me && u.username === me.username;
      return `<span style="color:${isMe?'#fbbf24':'#a5b4fc'};font-weight:600;background:rgba(99,102,241,.12);padding:0 3px;border-radius:3px">@${_esc(u.nama||uname)}</span>`;
    });
    return html;
  }

  // Render reaction chips dari m.reactions = { '👍':[user...], ... }
  function _reactionChips(m, isMine) {
    const r = m.reactions || {};
    const keys = Object.keys(r).filter(k => (r[k]||[]).length);
    if (!keys.length) return '';
    const me = _me();
    return `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px;${isMine?'justify-content:flex-end':''}">${
      keys.map(emoji => {
        const users = r[emoji] || [];
        const mine = me && users.includes(me.username);
        return `<span onclick="event.stopPropagation();ChatModule._react('${m.id}','${emoji}')" title="${users.map(u=>_esc(u)).join(', ')}" style="cursor:pointer;font-size:11px;padding:1px 6px;border-radius:10px;background:${mine?'rgba(99,102,241,.18)':'var(--surface2)'};border:1px solid ${mine?'var(--primary)':'var(--border)'};display:inline-flex;align-items:center;gap:2px">${emoji} <span style="font-size:10px;color:var(--text-2)">${users.length}</span></span>`;
      }).join('')
    }</div>`;
  }

  // Quote/reply preview di dalam bubble (klik → scroll ke pesan asli)
  function _replyQuote(m) {
    if (!m.replyTo) return '';
    const rt = m.replyTo;
    return `<div onclick="event.stopPropagation();ChatModule._gotoMsg('${rt.id}')" style="cursor:pointer;border-left:3px solid currentColor;opacity:.85;padding:3px 8px;margin-bottom:4px;border-radius:4px;background:rgba(0,0,0,.06);font-size:11px">
      <div style="font-weight:700;font-size:10px;opacity:.9">${_esc(rt.name||'')}</div>
      <div style="opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${_esc(rt.preview||'')}</div>
    </div>`;
  }

  // Builder konten + bubble lengkap satu pesan (dipakai append & re-render)
  function _msgBubble(m, isMine) {
    if (typeof isMine !== 'boolean') { const me=_me(); isMine = m.senderId===me?.id||m.senderUsername===me?.username; }
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
      content = `<img src="${m.mediaUrl}" style="max-width:220px;border-radius:8px;cursor:pointer;display:block" onclick="window.open(this.src,'_blank')" loading="lazy">${m.text?`<div style="margin-top:3px">${_renderText(m.text)}</div>`:''}`;
    } else if (m.type==='video') {
      content = `<video src="${m.mediaUrl}" controls preload="none" style="max-width:220px;border-radius:8px;display:block"></video>`;
    } else {
      content = `<div style="white-space:pre-wrap;word-break:break-word">${_renderText(m.text)}</div>`;
    }
    const dlInside = (m.type==='image'||m.type==='video')?`<a href="${m.mediaUrl}" download style="font-size:10px;color:${isMine?'rgba(255,255,255,.85)':'var(--primary-h)'};margin-top:3px;display:inline-block;text-decoration:none">⬇ Download</a>`:'';
    const edited = m.editedAt ? `<span style="opacity:.7;font-style:italic;margin-right:3px">diedit</span>` : '';
    const menuBtn = `<button class="cht-msg-menu" title="Opsi" onclick="event.stopPropagation();ChatModule._msgMenu('${m.id}',this)">⋯</button>`;
    const tick = isMine && m.type!=='task' ? (()=>{const rm=_readMark(m.createdAt);return `<span class="cht-tick" id="cht-tick-${m.id}" data-ts="${m.createdAt}" style="font-size:10px;letter-spacing:-1px;color:${rm.read?'#38bdf8':'rgba(255,255,255,.5)'}">${rm.mark}</span>`;})() : '';
    return `<div class="cht-msg-wrap ${isMine?'mine':'other'}" data-mid="${m.id}">
      ${!isMine&&_activeRoom?.type==='group'?`<span style="font-size:9px;font-weight:600;color:${_uc(m.senderName)};padding-left:4px;margin-bottom:1px">${_esc(m.senderName||'')}</span>`:''}
      ${menuBtn}
      <div class="msg-b ${isMine?'msg-m':'msg-o'}">${_replyQuote(m)}${content}${dlInside}<div style="font-size:9px;${isMine?'color:rgba(255,255,255,.55)':'color:var(--text-3)'};text-align:right;margin-top:2px;display:flex;align-items:center;justify-content:flex-end;gap:3px">${edited}<span>${_hm(m.createdAt)}</span>${tick}</div></div>
      ${_reactionChips(m, isMine)}
    </div>`;
  }

  // Re-render satu pesan di tempat (untuk reaction/edit via realtime UPDATE)
  function _rerenderMsg(m) {
    const wrap = document.querySelector(`.cht-msg-wrap[data-mid="${m.id}"]`);
    if (!wrap) return;
    const me = _me(), isMine = m.senderId===me?.id||m.senderUsername===me?.username;
    wrap.outerHTML = _msgBubble(m, isMine);
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
    // Garis pemisah "Pesan baru" — sebelum pesan pertama (dari orang lain) yang lebih baru dari lastread
    if (_unreadDivAt && m.createdAt > _unreadDivAt && !(m.senderId===_me()?.id||m.senderUsername===_me()?.username)) {
      cont.insertAdjacentHTML('beforeend',`<div id="cht-unread-div" style="text-align:center;padding:6px 0;display:flex;align-items:center;gap:8px"><span style="flex:1;height:1px;background:var(--danger);opacity:.4"></span><span style="font-size:10px;color:var(--danger);font-weight:700;letter-spacing:.04em">PESAN BARU</span><span style="flex:1;height:1px;background:var(--danger);opacity:.4"></span></div>`);
      _unreadDivAt = ''; // hanya sekali
    }
    cont.insertAdjacentHTML('beforeend', _msgBubble(m, isMine));
    // Pesan masuk saat user scroll ke atas \u2192 jangan paksa scroll, tambah badge
    const el = document.getElementById('cht-msgs');
    if (el) {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom || isMine) _scrollEnd();
      else {
        _newWhileScrolled++;
        const btn = document.getElementById('cht-scroll-btn');
        const badge = document.getElementById('cht-scroll-badge');
        if (btn) btn.style.display = 'flex';
        if (badge) { badge.textContent = _newWhileScrolled > 9 ? '9+' : String(_newWhileScrolled); badge.style.display = 'flex'; }
      }
    }
  }

  function _scrollEnd(force) {
    setTimeout(()=>{
      const el=document.getElementById('cht-msgs'); if(!el) return;
      el.scrollTop=el.scrollHeight;
      if (force) {
        _newWhileScrolled = 0;
        const btn=document.getElementById('cht-scroll-btn'); if(btn) btn.style.display='none';
        const badge=document.getElementById('cht-scroll-badge'); if(badge) badge.style.display='none';
      }
    },30);
  }

  async function _deleteMsg(mid) {
    const ok = await Modal.confirm({ title:'Hapus Pesan', message:'Pesan ini akan dihapus untuk semua orang.', danger:true, confirmText:'Hapus' });
    if (!ok) return;
    try { await DB.deleteChatMessage(mid); } catch(e) { Notify.error('Gagal hapus: '+e.message); return; }
    _messages = _messages.filter(m=>m.id!==mid);
    _msgIds.delete(mid);
    document.querySelector(`.cht-msg-wrap[data-mid="${mid}"]`)?.remove();
    Notify.success('Pesan dihapus');
  }

  /* ═══ MESSAGE CONTEXT MENU ═══ */
  function _closeCtx() { document.querySelector('.cht-ctx')?.remove(); document.removeEventListener('click', _closeCtx); }
  function _msgMenu(mid, btn) {
    _closeCtx();
    const m = _messages.find(x=>x.id===mid); if (!m) return;
    const me = _me(), isMine = m.senderId===me?.id||m.senderUsername===me?.username;
    const canText = m.type==='text';
    const menu = document.createElement('div');
    menu.className = 'cht-ctx';
    menu.innerHTML = `
      <div class="cht-react-row">
        ${REACTION_EMOJIS.map(e=>`<span onclick="ChatModule._react('${mid}','${e}');ChatModule._closeCtx()">${e}</span>`).join('')}
      </div>
      <button onclick="ChatModule._setReply('${mid}');ChatModule._closeCtx()">↩️ Balas</button>
      ${canText?`<button onclick="ChatModule._copyMsg('${mid}');ChatModule._closeCtx()">📋 Salin teks</button>`:''}
      <button onclick="ChatModule._pinMsg('${mid}');ChatModule._closeCtx()">📌 ${_activeRoom?.pinnedMsg?.id===mid?'Lepas pin':'Pin pesan'}</button>
      ${isMine&&canText?`<button onclick="ChatModule._editMsg('${mid}');ChatModule._closeCtx()">✏️ Edit</button>`:''}
      ${isMine?`<button onclick="ChatModule._deleteMsg('${mid}');ChatModule._closeCtx()" style="color:#ef4444">🗑️ Hapus</button>`:''}
    `;
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect();
    let top = r.bottom + 4, left = r.left;
    const mw = 160, mh = menu.offsetHeight || 220;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    if (top + mh > window.innerHeight - 8) top = r.top - mh - 4;
    menu.style.top = Math.max(8, top) + 'px';
    menu.style.left = Math.max(8, left) + 'px';
    setTimeout(()=>document.addEventListener('click', _closeCtx), 0);
  }

  async function _react(mid, emoji) {
    const m = _messages.find(x=>x.id===mid); if (!m) return;
    const me = _me(); if (!me?.username) return;
    m.reactions = m.reactions || {};
    const arr = m.reactions[emoji] = m.reactions[emoji] || [];
    const i = arr.indexOf(me.username);
    if (i>=0) arr.splice(i,1); else arr.push(me.username);
    if (!arr.length) delete m.reactions[emoji];
    _rerenderMsg(m);
    DB.saveChatMessage(m).catch(()=>{});
  }

  function _gotoMsg(mid) {
    const el = document.querySelector(`.cht-msg-wrap[data-mid="${mid}"]`);
    if (!el) { Notify.info('Pesan tidak di layar (mungkin perlu scroll/load lebih lama)'); return; }
    el.scrollIntoView({ behavior:'smooth', block:'center' });
    el.classList.remove('cht-msg-flash'); void el.offsetWidth; el.classList.add('cht-msg-flash');
  }

  /* ═══ REPLY ═══ */
  function _setReply(mid) {
    const m = _messages.find(x=>x.id===mid); if (!m) return;
    const preview = m.type==='text' ? m.text : m.type==='task' ? '[Task] '+(m.taskData?.title||'') : m.type==='image' ? '[Foto]' : '[Video]';
    _replyTo = { id:m.id, name:m.senderName||'', preview:preview.slice(0,120), type:m.type };
    _renderReplyBar();
    document.getElementById('cht-inp')?.focus();
  }
  function _cancelReply() { _replyTo = null; _renderReplyBar(); }
  function _renderReplyBar() {
    const bar = document.getElementById('cht-reply-bar');
    if (!bar) return;
    if (!_replyTo) { bar.style.display='none'; bar.innerHTML=''; return; }
    bar.style.display='flex';
    bar.innerHTML = `
      <div style="flex:1;min-width:0;border-left:3px solid var(--primary);padding-left:8px">
        <div style="font-size:11px;font-weight:700;color:var(--primary)">Membalas ${_esc(_replyTo.name)}</div>
        <div style="font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(_replyTo.preview)}</div>
      </div>
      <button onclick="ChatModule._cancelReply()" style="border:none;background:transparent;cursor:pointer;color:var(--text-3);font-size:16px;padding:0 4px">✕</button>`;
  }

  /* ═══ EDIT ═══ */
  async function _editMsg(mid) {
    const m = _messages.find(x=>x.id===mid); if (!m || m.type!=='text') return;
    const me = _me(); if (m.senderId!==me?.id && m.senderUsername!==me?.username) return;
    const val = await new Promise(res=>{
      const eid='edit-msg-'+Date.now();
      Modal.open({ id:eid, title:'Edit Pesan', size:'modal-sm',
        body:`<textarea id="${eid}-ta" class="form-control" rows="3" style="resize:vertical">${_esc(m.text)}</textarea>`,
        footer:`<button class="btn btn-ghost" onclick="Modal.close('${eid}');window.__editResolve&&window.__editResolve(null)">Batal</button><button class="btn btn-primary" onclick="window.__editResolve&&window.__editResolve(document.getElementById('${eid}-ta').value);Modal.close('${eid}')">Simpan</button>`,
        onOpen:()=>{ window.__editResolve=res; setTimeout(()=>document.getElementById(eid+'-ta')?.focus(),60); },
      });
    });
    window.__editResolve = null;
    if (val==null) return;
    const t = val.trim(); if (!t || t===m.text) return;
    m.text = t; m.editedAt = new Date().toISOString();
    _rerenderMsg(m);
    DB.saveChatMessage(m).catch(()=>{});
    if (_activeRoom?.lastSender && _messages[_messages.length-1]?.id===mid) {
      _activeRoom.lastMessage = t.slice(0,80); _renderRoomList(); DB.saveChatRoom(_activeRoom).catch(()=>{});
    }
  }

  function _copyMsg(mid) {
    const m = _messages.find(x=>x.id===mid); if (!m) return;
    navigator.clipboard?.writeText(m.text||'').then(()=>Notify.success('Disalin')).catch(()=>Notify.warning('Gagal menyalin'));
  }

  /* ═══ PIN ═══ */
  function _pinMsg(mid) {
    if (!_activeRoom) return;
    const m = _messages.find(x=>x.id===mid); if (!m) return;
    if (_activeRoom.pinnedMsg?.id===mid) {
      _activeRoom.pinnedMsg = null;
      Notify.info('Pin dilepas');
    } else {
      const preview = m.type==='text' ? m.text : m.type==='task' ? '[Task] '+(m.taskData?.title||'') : m.type==='image' ? '[Foto]' : '[Video]';
      _activeRoom.pinnedMsg = { id:m.id, name:m.senderName||'', preview:preview.slice(0,120) };
      Notify.success('Pesan dipin');
    }
    _renderPinBar();
    DB.saveChatRoom(_activeRoom).catch(()=>{});
  }
  function _renderPinBar() {
    const bar = document.getElementById('cht-pin-bar');
    if (!bar) return;
    const p = _activeRoom?.pinnedMsg;
    if (!p) { bar.style.display='none'; bar.innerHTML=''; return; }
    bar.style.display='flex';
    bar.innerHTML = `
      <span style="font-size:13px">📌</span>
      <div onclick="ChatModule._gotoMsg('${p.id}')" style="flex:1;min-width:0;cursor:pointer">
        <div style="font-size:10px;font-weight:700;color:var(--primary)">Pesan disematkan · ${_esc(p.name)}</div>
        <div style="font-size:11px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.preview)}</div>
      </div>
      <button onclick="ChatModule._pinMsg('${p.id}')" title="Lepas pin" style="border:none;background:transparent;cursor:pointer;color:var(--text-3);font-size:14px">✕</button>`;
  }
  function _back() {
    _activeRoom=null;
    if (_typingChannel) { try { _typingChannel.unsubscribe(); } catch{} _typingChannel = null; }
    _typingUsers = {};
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
    if (!text||!_activeRoom) return;
    inp.value=''; inp.style.height='34px';
    const sbtn=document.getElementById('cht-send-btn'); if(sbtn){ sbtn.disabled=true; sbtn.style.opacity='.5'; }
    const me=_me(), msg = { id:Utils.uid(), roomId:_activeRoom.id, senderId:me?.id, senderUsername:me?.username, senderName:me?.nama||'', type:'text', text, createdAt:new Date().toISOString() };
    if (_replyTo) { msg.replyTo = _replyTo; _replyTo = null; _renderReplyBar(); }
    _msgIds.add(msg.id); _messages.push(msg); _appendMsg(msg);
    _activeRoom.lastMessage=text.slice(0,80); _activeRoom.lastMessageAt=msg.createdAt; _activeRoom.lastSender=msg.senderName;
    _renderRoomList();
    // Save in background — don't block UI
    DB.saveChatMessage(msg).catch(e => console.warn('[Chat] save msg:', e));
    DB.saveChatRoom(_activeRoom).catch(e => console.warn('[Chat] save room:', e));
    _notifyMembers(_activeRoom, me?.nama||'', text);
    _notifyMentions(_activeRoom, me?.nama||'', text);
  }

  // Notif khusus untuk user yang di-mention (@username) di grup
  function _notifyMentions(room, senderName, text) {
    if (!window.PushModule || room?.type!=='group') return;
    const me = _me();
    const mentioned = [...text.matchAll(/@([a-zA-Z0-9_.]+)/g)].map(m=>m[1].toLowerCase());
    if (!mentioned.length) return;
    const targets = _users.filter(u => u.username && u.username!==me?.username
      && mentioned.includes((u.username||'').toLowerCase())
      && (room.memberUsernames||[]).includes(u.username));
    targets.forEach(u => {
      PushModule.sendToUser(u.username, { title:`${senderName} menyebut Anda di ${room.name||'Grup'}`, body:text.slice(0,100), data:{ type:'chat', roomId:room.id } }).catch(()=>{});
    });
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

  return { init, openRoom, send, _media, newChat, _filt, _dm, _grp, _search, _back, deleteRoom, _shareTask, _filtTask, _sendTask,
    _composerInput, _composerKey, _scrollEnd, _deleteMsg,
    _msgMenu, _closeCtx, _react, _gotoMsg, _setReply, _cancelReply, _editMsg, _copyMsg, _pinMsg,
    _pickMention, _toggleSearch, _searchConv };
})();
window.ChatModule = ChatModule;
