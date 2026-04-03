/* ============================================
   BECCA V2.0 — News & Pengumuman Module
   v2.2: Media per-user LS + Video IDB + Polling
============================================ */
const NewsModule = (() => {
  'use strict';

  const _KEY = 'becca_news';
  let _items = [];
  let _readSet = new Set();
  let _divisiList = [];
  let _jabatanList = [];

  // Create-form ephemeral state
  let _fMedia = [];   // [{type:'image'|'video-idb'|'video-url', _full, _thumb, idbKey, url, name, ...}]
  let _fPollOn = false;
  let _fPollOpts = [];

  /* ═══════════════════════════════════════════
     PERSISTENCE — becca_news (item metadata only)
  ═══════════════════════════════════════════ */
  function _readKey() {
    const uid = (typeof Auth !== 'undefined' && Auth.currentUser()?.id) || 'anon';
    return 'becca_news_read_' + uid;
  }
  function _load() {
    try { _items = JSON.parse(localStorage.getItem(_KEY) || '[]'); } catch { _items = []; }
    try { _readSet = new Set(JSON.parse(localStorage.getItem(_readKey()) || '[]')); } catch { _readSet = new Set(); }
  }
  function _persist() { localStorage.setItem(_KEY, JSON.stringify(_items)); }

  function _markRead(id) {
    if (!_readSet.has(id)) {
      _readSet.add(id);
      try {
        const r = JSON.parse(localStorage.getItem(_readKey()) || '[]');
        if (!r.includes(id)) { r.push(id); localStorage.setItem(_readKey(), JSON.stringify(r)); }
      } catch {}
    }
    const idx = _items.findIndex(i => i.id === id);
    if (idx !== -1) {
      if (!_items[idx].views) _items[idx].views = [];
      const user = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
      const uid  = user?.id || user?.username || 'anon';
      if (!_items[idx].views.some(v => v.uid === uid)) {
        _items[idx].views.push({ uid, nama: user?.nama || user?.username || 'User', viewedAt: new Date().toISOString() });
        _persist();
        // Sync views ke Supabase (fire and forget)
        if (typeof DB !== 'undefined') DB.saveNews(_items[idx]).catch(() => {});
      }
    }
    _updateBadge();
  }
  function _unreadCount() { return _items.filter(i => !_readSet.has(i.id)).length; }
  function _updateBadge() {
    const el = document.getElementById('news-nav-badge');
    if (!el) return;
    const n = _unreadCount();
    el.textContent = n > 9 ? '9+' : String(n);
    el.style.display = n > 0 ? 'flex' : 'none';
  }

  /* ═══════════════════════════════════════════
     PER-USER IMAGE STORAGE  (becca_media_<uid>)
     Gambar full-size disimpan di LS milik creator.
     becca_news hanya menyimpan thumbnail kecil.
  ═══════════════════════════════════════════ */
  function _imgKey(uid) { return 'becca_media_' + uid; }

  function _imgLoad(ownerId, id) {
    try { return (JSON.parse(localStorage.getItem(_imgKey(ownerId)) || '{}'))[id] || null; }
    catch { return null; }
  }
  function _imgSave(uid, id, data) {
    try {
      const store = JSON.parse(localStorage.getItem(_imgKey(uid)) || '{}');
      store[id] = data;
      localStorage.setItem(_imgKey(uid), JSON.stringify(store));
    } catch(e) { console.warn('[News] Image save failed:', e); }
  }
  function _imgDelete(ownerId, id) {
    try {
      const store = JSON.parse(localStorage.getItem(_imgKey(ownerId)) || '{}');
      delete store[id];
      localStorage.setItem(_imgKey(ownerId), JSON.stringify(store));
    } catch {}
  }

  /* ═══════════════════════════════════════════
     INDEXEDDB — video blob storage (per device)
  ═══════════════════════════════════════════ */
  const _IDB = (() => {
    let _db = null;
    async function open() {
      if (_db) return _db;
      return new Promise((res, rej) => {
        const req = indexedDB.open('becca_media_v1', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('blobs', { keyPath: 'id' });
        req.onsuccess = e => { _db = e.target.result; res(_db); };
        req.onerror   = rej;
      });
    }
    return {
      async save(id, blob) {
        const db = await open();
        return new Promise((res, rej) => {
          const tx = db.transaction('blobs', 'readwrite');
          tx.objectStore('blobs').put({ id, blob });
          tx.oncomplete = res; tx.onerror = rej;
        });
      },
      async load(id) {
        const db = await open();
        return new Promise(res => {
          const tx  = db.transaction('blobs', 'readonly');
          const req = tx.objectStore('blobs').get(id);
          req.onsuccess = e => res(e.target.result?.blob || null);
          req.onerror   = () => res(null);
        });
      },
      async remove(id) {
        try {
          const db = await open();
          await new Promise((res, rej) => {
            const tx = db.transaction('blobs', 'readwrite');
            tx.objectStore('blobs').delete(id);
            tx.oncomplete = res; tx.onerror = rej;
          });
        } catch {}
      },
    };
  })();

  /* ═══════════════════════════════════════════
     CONSTANTS & UTILS
  ═══════════════════════════════════════════ */
  const _COLOR = { info:'#6366f1', success:'#10b981', warning:'#f59e0b', urgent:'#ef4444' };
  const _ICON  = { info:'📢', success:'✅', warning:'⚠️', urgent:'🚨' };
  const _LABEL = { info:'Info', success:'Kabar Baik', warning:'Penting', urgent:'URGENT' };

  function _fmtTime(iso) {
    if (!iso) return '';
    try {
      const d = Date.now() - new Date(iso).getTime();
      if (d < 60000)    return 'Baru saja';
      if (d < 3600000)  return Math.floor(d / 60000) + ' mnt lalu';
      if (d < 86400000) return Math.floor(d / 3600000) + ' jam lalu';
      if (d < 604800000) return Math.floor(d / 86400000) + ' hari lalu';
      return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    } catch { return ''; }
  }

  function _ytEmbedUrl(url) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    return m ? 'https://www.youtube.com/embed/' + m[1] : null;
  }
  function _ytThumbUrl(url) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    return m ? 'https://img.youtube.com/vi/' + m[1] + '/mqdefault.jpg' : null;
  }

  function _compressImage(file, maxPx = 1024, quality = 0.78) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxPx || h > maxPx) {
            if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
            else        { w = Math.round(w * maxPx / h); h = maxPx; }
          }
          const cvs = document.createElement('canvas');
          cvs.width = w; cvs.height = h;
          cvs.getContext('2d').drawImage(img, 0, 0, w, h);
          res(cvs.toDataURL('image/jpeg', quality));
        };
        img.onerror = rej; img.src = e.target.result;
      };
      reader.onerror = rej; reader.readAsDataURL(file);
    });
  }

  function _videoThumb(file) {
    return new Promise(resolve => {
      const vid = document.createElement('video');
      const url = URL.createObjectURL(file);
      vid.src = url; vid.muted = true;
      vid.onloadeddata = () => {
        vid.currentTime = Math.min(1, vid.duration / 4 || 1);
      };
      vid.onseeked = () => {
        const cvs = document.createElement('canvas');
        cvs.width = 160; cvs.height = 90;
        cvs.getContext('2d').drawImage(vid, 0, 0, 160, 90);
        URL.revokeObjectURL(url);
        resolve(cvs.toDataURL('image/jpeg', 0.7));
      };
      vid.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      vid.load();
    });
  }

  function _fmtBytes(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  /* ─── Per-user saved video tracker ─── */
  function _vidSavedKey() {
    const uid = Auth.currentUser()?.id || Auth.currentUser()?.username || 'anon';
    return 'becca_svid_' + uid;
  }
  function _getUserVidKey(idbKey) {
    const uid = (Auth.currentUser()?.id || Auth.currentUser()?.username || 'anon').slice(0, 10);
    return 'uv_' + uid + '_' + idbKey;
  }
  function _isVidSaved(idbKey) {
    try { return !!(JSON.parse(localStorage.getItem(_vidSavedKey()) || '{}')[idbKey]); }
    catch { return false; }
  }
  function _getVidSavedKey(idbKey) {
    try { return (JSON.parse(localStorage.getItem(_vidSavedKey()) || '{}'))[idbKey] || null; }
    catch { return null; }
  }
  function _markVidSaved(idbKey, userKey) {
    try {
      const k = _vidSavedKey();
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      s[idbKey] = userKey;
      localStorage.setItem(k, JSON.stringify(s));
    } catch {}
  }

  /* ═══════════════════════════════════════════
     RENDER — card list
  ═══════════════════════════════════════════ */
  function _render() {
    const page = document.getElementById('page-news');
    if (!page) return;
    _load();
    const canWrite = Auth.can('news', 'create');
    const sorted   = [..._items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unread   = _unreadCount();

    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>News & Pengumuman</h2>
          <p>Informasi terbaru dari tim${unread > 0 ? ` · <strong style="color:#6366f1">${unread} belum dibaca</strong>` : ''}</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;flex-wrap:wrap">
          ${unread > 0 ? `<button class="btn btn-ghost" onclick="NewsModule.markAllRead()" style="font-size:12px">✓ Tandai Semua Dibaca</button>` : ''}
          ${canWrite ? `<button class="btn btn-primary" onclick="NewsModule.openCreate()">+ Buat Pengumuman</button>` : ''}
        </div>
      </div>
      ${sorted.length === 0 ? `
        <div style="text-align:center;padding:80px 20px;color:var(--text-3)">
          <div style="font-size:48px;margin-bottom:12px">📭</div>
          <div style="font-size:15px;font-weight:600;margin-bottom:6px">Belum ada pengumuman</div>
          <div style="font-size:13px;margin-bottom:20px">Pengumuman dari admin akan muncul di sini</div>
          ${canWrite ? `<button class="btn btn-primary" onclick="NewsModule.openCreate()" style="font-size:13px">+ Buat Pengumuman Pertama</button>` : ''}
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:10px;max-width:720px">
          ${sorted.map(item => {
            const unrd       = !_readSet.has(item.id);
            const col        = _COLOR[item.tipe] || '#6366f1';
            const viewCnt    = (item.views || []).length;
            const media      = item.media || [];
            const firstImg   = media.find(m => m.type === 'image');
            const hasVideo   = media.some(m => m.type === 'video-idb' || m.type === 'video-url');
            const hasPoll    = !!item.poll;
            const totalVotes = hasPoll ? item.poll.options.reduce((s, o) => s + o.votes.length, 0) : 0;
            // Thumbnail: use stored thumb (small) — never need to hit per-user LS for card
            const cardThumb  = firstImg?.thumb || null;
            return `
              <div onclick="NewsModule.openItem('${item.id}')"
                style="background:var(--surface);border:1px solid ${unrd ? col : 'var(--border)'};
                       border-left:4px solid ${unrd ? col : 'var(--border)'};
                       border-radius:12px;padding:14px 16px;cursor:pointer;
                       transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)"
                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'"
                onmouseout="this.style.transform='';this.style.boxShadow='0 1px 4px rgba(0,0,0,.08)'">
                ${unrd ? `<div style="position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;background:${col}"></div>` : ''}
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;flex-wrap:wrap">
                  <span style="font-size:16px">${_ICON[item.tipe] || '📢'}</span>
                  <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;
                    background:${col}20;color:${col};text-transform:uppercase;letter-spacing:.04em">${_LABEL[item.tipe] || 'Info'}</span>
                  ${firstImg || hasVideo ? `<span style="font-size:11px;color:var(--text-3)">${firstImg ? '🖼' : ''}${hasVideo ? '🎬' : ''}</span>` : ''}
                  ${hasPoll ? `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(16,185,129,.1);color:#10b981;font-weight:600">📊 ${totalVotes} suara</span>` : ''}
                  <span style="font-size:11px;color:var(--text-3);margin-left:auto">${_fmtTime(item.createdAt)}</span>
                </div>
                <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:4px">${item.judul}</div>
                <div style="font-size:12px;color:var(--text-2);line-height:1.5;overflow:hidden;
                  text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${item.isi}</div>
                ${cardThumb ? `
                  <div style="margin-top:10px;border-radius:8px;overflow:hidden;height:140px">
                    <img src="${cardThumb}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
                  </div>` : ''}
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
                  <span style="font-size:11px;color:var(--text-3)">— ${item.author || 'Admin'}</span>
                  <span onclick="event.stopPropagation();NewsModule.openViewers('${item.id}')"
                    style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:4px;
                           cursor:pointer;padding:2px 6px;border-radius:6px;transition:background .15s"
                    onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    ${viewCnt > 0 ? viewCnt + ' dilihat' : 'Belum dilihat'}
                  </span>
                </div>
              </div>`;
          }).join('')}
        </div>
      `}
    `;
    _updateBadge();
  }

  /* ═══════════════════════════════════════════
     POLL HTML
  ═══════════════════════════════════════════ */
  function _renderPollHtml(item) {
    if (!item.poll) return '';
    const poll        = item.poll;
    const uid         = (typeof Auth !== 'undefined' ? Auth.currentUser()?.id : null) || 'anon';
    const totalVotes  = poll.options.reduce((s, o) => s + o.votes.length, 0);
    const votedSet    = new Set(poll.options.filter(o => o.votes.some(v => _voteUid(v) === uid)).map(o => o.id));
    const hasVoted    = votedSet.size > 0;
    const canSeeVoters = typeof Auth !== 'undefined' && Auth.can('news', 'edit');
    return `
      <div id="news-poll-${item.id}" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          📊 ${poll.question}
          <span style="font-size:11px;color:var(--text-3);font-weight:400">${totalVotes} suara</span>
        </div>
        ${poll.options.map(opt => {
          const pct   = totalVotes > 0 ? Math.round(opt.votes.length / totalVotes * 100) : 0;
          const voted = votedSet.has(opt.id);
          const voterLabel = opt.votes.length > 0 && canSeeVoters
            ? `<span onclick="event.stopPropagation();NewsModule.openVoters('${item.id}','${opt.id}')"
                style="position:relative;font-size:11px;color:${voted ? 'var(--primary)' : 'var(--text-3)'};
                       cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;
                       white-space:nowrap">${opt.votes.length} orang</span>`
            : (hasVoted ? `<span style="position:relative;font-size:11px;color:var(--text-3)">${opt.votes.length} orang</span>` : '');
          return `
            <div style="margin-bottom:8px">
              <div onclick="NewsModule._voteItem('${item.id}','${opt.id}')"
                style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                       border:2px solid ${voted ? 'var(--primary)' : 'var(--border)'};
                       border-radius:8px;cursor:pointer;position:relative;overflow:hidden;
                       background:${voted ? 'rgba(99,102,241,.05)' : 'var(--surface)'};
                       transition:border-color .15s">
                ${hasVoted ? `<div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;
                  background:${voted ? 'rgba(99,102,241,.12)' : 'rgba(0,0,0,.04)'};pointer-events:none"></div>` : ''}
                <div style="position:relative;flex:1;font-size:13px;color:var(--text)">${opt.text}</div>
                ${hasVoted ? `<span style="position:relative;font-size:12px;font-weight:700;min-width:34px;text-align:right;
                  color:${voted ? 'var(--primary)' : 'var(--text-3)'}">${pct}%</span>` : ''}
                ${voterLabel}
                ${voted ? `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5"
                  width="14" height="14" style="position:relative;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
              </div>
            </div>`;
        }).join('')}
        <div style="font-size:11px;color:var(--text-3);margin-top:2px">
          ${hasVoted
            ? 'Anda sudah memilih · ' + (poll.multiple ? 'Pilihan ganda' : 'Klik opsi lain untuk ganti')
            : 'Klik opsi untuk memilih' + (poll.multiple ? ' · Pilihan ganda' : '')}
        </div>
      </div>`;
  }

  /* ═══════════════════════════════════════════
     OPEN ITEM (detail modal)
  ═══════════════════════════════════════════ */
  function openItem(id) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    _markRead(id);
    _render();
    const col      = _COLOR[item.tipe] || '#6366f1';
    const canDel   = Auth.can('news', 'create');
    const viewCnt  = (item.views || []).length;
    const mid      = Utils.uid();
    const media    = item.media || [];

    // Build media HTML (images load from per-user LS; videos get async placeholders)
    const mediaHtml = media.map((m, idx) => {
      if (m.type === 'image') {
        const data = _imgLoad(m.ownerId, m.id) || m.full || m.thumb || null;
        return data ? `
          <div style="margin-bottom:8px;border-radius:8px;overflow:hidden;position:relative">
            <img src="${data}" style="width:100%;max-height:400px;object-fit:contain;background:var(--surface2);cursor:zoom-in"
              onclick="NewsModule._openImage('${item.id}',${idx})" loading="lazy">
            <button onclick="NewsModule._downloadMedia('${item.id}',${idx})"
              style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.55);color:#fff;border:none;
                     border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;backdrop-filter:blur(4px)">
              ⬇ Simpan
            </button>
          </div>` : `
          <div style="padding:16px;text-align:center;font-size:12px;color:var(--text-3);
                      background:var(--surface2);border-radius:8px;margin-bottom:8px">
            🖼 Gambar tidak tersedia di perangkat ini
          </div>`;
      }
      if (m.type === 'video-idb') {
        return `
          <div id="vid-ph-${m.idbKey}" style="margin-bottom:8px;border-radius:8px;overflow:hidden;
               background:var(--surface2);min-height:80px;display:flex;align-items:center;justify-content:center">
            <div style="font-size:12px;color:var(--text-3)">⏳ Memuat video...</div>
          </div>`;
      }
      if (m.type === 'video-url') {
        const embed = _ytEmbedUrl(m.url);
        return embed ? `
          <div style="margin-bottom:8px;border-radius:8px;overflow:hidden;position:relative;padding-top:56.25%">
            <iframe src="${embed}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0"
              allowfullscreen loading="lazy"></iframe>
          </div>` : `
          <div style="margin-bottom:8px;position:relative">
            <video src="${m.url}" controls style="width:100%;max-height:300px;border-radius:8px;background:#000"></video>
            <button onclick="NewsModule._downloadMedia('${item.id}',${idx})"
              style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.55);color:#fff;border:none;
                     border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">
              ⬇ Simpan
            </button>
          </div>`;
      }
      return '';
    }).join('');

    Modal.open({
      id: mid,
      title: `${_ICON[item.tipe] || '📢'} ${item.judul}`,
      size: 'modal-lg',
      body: `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;
            background:${col}20;color:${col};text-transform:uppercase">${_LABEL[item.tipe] || 'Info'}</span>
          <span style="font-size:11px;color:var(--text-3)">${_fmtTime(item.createdAt)} · oleh ${item.author || 'Admin'}</span>
        </div>
        <div style="font-size:13px;color:var(--text);line-height:1.8;white-space:pre-wrap${mediaHtml || item.poll ? ';margin-bottom:14px' : ''}">${item.isi}</div>
        ${mediaHtml}
        ${_renderPollHtml(item)}
      `,
      footer: `
        ${media.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="NewsModule._downloadAll('${item.id}')">⬇ Unduh Semua</button>` : ''}
        ${canDel ? `<button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="NewsModule.deleteItem('${item.id}')">Hapus</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="Modal.close('${mid}');NewsModule.openViewers('${item.id}')"
          style="display:flex;align-items:center;gap:5px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          ${viewCnt} dilihat
        </button>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
      `,
    });

    // Load IDB videos async after modal renders
    requestAnimationFrame(() => {
      (item.media || []).forEach((m, mediaIdx) => {
        if (m.type !== 'video-idb') return;
        const hasSaved = _isVidSaved(m.idbKey);
        const loadKey  = hasSaved ? (_getVidSavedKey(m.idbKey) || m.idbKey) : m.idbKey;
        _IDB.load(loadKey).then(async blob => {
          // Fallback ke original key jika user key sudah tidak ada
          if (!blob && hasSaved) blob = await _IDB.load(m.idbKey);
          // Cross-device: load dari base64 yang disimpan di news item (video ≤ 10MB)
          if (!blob && m.data) {
            try { blob = await fetch(m.data).then(r => r.blob()); } catch {}
            if (blob) _IDB.save(m.idbKey, blob).catch(() => {}); // cache lokal
          }
          const ph = document.getElementById('vid-ph-' + m.idbKey);
          if (!ph) return;
          if (blob) {
            const url = URL.createObjectURL(blob);
            ph.innerHTML = `
              <div style="position:relative">
                <video src="${url}" controls style="width:100%;max-height:300px;border-radius:8px;background:#000"
                  onended="try{URL.revokeObjectURL('${url}')}catch{}"></video>
                <div style="position:absolute;top:8px;right:8px;display:flex;gap:4px">
                  <button id="vid-btn-${m.idbKey}"
                    onclick="NewsModule._saveVideo('${item.id}',${mediaIdx})"
                    style="background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:6px;
                           padding:4px 8px;font-size:11px;cursor:pointer">
                    ${hasSaved ? '✓ Tersimpan' : '⬇ Simpan'}
                  </button>
                  ${hasSaved ? `<button onclick="NewsModule._openVideoPlayer('${loadKey}','${m.name||'Video'}')"
                    style="background:rgba(99,102,241,.85);color:#fff;border:none;border-radius:6px;
                           padding:4px 8px;font-size:11px;cursor:pointer">▶ Putar Full</button>` : ''}
                </div>
              </div>`;
          } else {
            ph.innerHTML = `
              <div style="padding:20px;text-align:center;font-size:12px;color:var(--text-3)">
                🎬 Video tidak tersedia di perangkat ini<br>
                <span style="font-size:11px">(diunggah dari perangkat lain)</span>
              </div>`;
          }
        });
      });
    });
  }

  /* ═══════════════════════════════════════════
     GALLERY DOWNLOAD — simpan ke galeri device
     Konversi base64 → Blob secara sinkron (menjaga
     user gesture agar Web Share API tidak error)
  ═══════════════════════════════════════════ */
  function _b64ToBlob(dataUrl, mimeOverride) {
    try {
      const [hdr, b64] = dataUrl.split(',');
      const mime = mimeOverride || hdr.match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch { return null; }
  }

  async function _galleryDownload(data, name, mimeType) {
    // Konversi ke Blob secara sinkron — jangan await sebelum share API
    const blob = data instanceof Blob ? data
      : (typeof data === 'string' && data.startsWith('data:') ? _b64ToBlob(data, mimeType) : null);

    // Mobile: coba Web Share API (share sheet → "Simpan ke Foto" dll)
    const isMobile = navigator.maxTouchPoints > 0;
    if (isMobile && blob && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], name, { type: blob.type || mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      } catch(e) {
        if (e.name === 'AbortError') return;
        // Error lain (NotAllowedError dll): lanjut ke download biasa
      }
    }

    // Desktop atau fallback: download lewat <a>
    const url = blob ? URL.createObjectURL(blob) : (data || '');
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if (blob) setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* ═══════════════════════════════════════════
     OPEN IMAGE — lightbox full-screen viewer
  ═══════════════════════════════════════════ */
  function _openImage(itemId, mediaIdx) {
    const item = _items.find(i => i.id === itemId);
    if (!item) return;
    const m = (item.media || [])[mediaIdx];
    if (!m) return;
    const src = _imgLoad(m.ownerId, m.id) || m.full || m.thumb;
    if (!src) { Notify.error('Gambar tidak tersedia'); return; }

    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: m.name || 'Foto',
      size: 'modal-xl',
      body: `<div id="imgv-${mid}" style="background:#000;border-radius:8px;min-height:200px;
              display:flex;align-items:center;justify-content:center;overflow:hidden"></div>`,
      footer: `
        <button class="btn btn-ghost btn-sm" onclick="NewsModule._downloadMedia('${itemId}',${mediaIdx})">⬇ Unduh</button>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
      `,
    });
    // Load image setelah modal render (hindari embed base64 besar di innerHTML)
    const img = new Image();
    img.style.cssText = 'max-width:100%;max-height:85vh;object-fit:contain;display:block;margin:auto;border-radius:4px';
    img.onload = () => {
      const el = document.getElementById('imgv-' + mid);
      if (el) { el.style.minHeight = ''; el.appendChild(img); }
    };
    img.src = src;
  }

  /* ═══════════════════════════════════════════
     DOWNLOAD ALL — unduh semua media sekaligus
  ═══════════════════════════════════════════ */
  async function _downloadAll(itemId) {
    const item = _items.find(i => i.id === itemId);
    if (!item || !(item.media || []).length) return;

    const blobs = [], names = [];

    for (let idx = 0; idx < item.media.length; idx++) {
      const m = item.media[idx];
      if (m.type === 'image') {
        const data = _imgLoad(m.ownerId, m.id) || m.full || m.thumb;
        if (!data) continue;
        const b = _b64ToBlob(data, 'image/jpeg');
        if (b) {
          blobs.push(b); names.push(m.name || `gambar-${idx+1}.jpg`);
          const vuid = Auth.currentUser()?.id || Auth.currentUser()?.username || 'anon';
          if (vuid !== m.ownerId) _imgSave(vuid, m.id, data);
        }
      } else if (m.type === 'video-idb') {
        const hasSaved = _isVidSaved(m.idbKey);
        const srcKey   = hasSaved ? (_getVidSavedKey(m.idbKey) || m.idbKey) : m.idbKey;
        let b = await _IDB.load(srcKey);
        if (!b && hasSaved) b = await _IDB.load(m.idbKey);
        // Cross-device: load dari base64 jika tersedia
        if (!b && m.data) { try { b = await fetch(m.data).then(r => r.blob()); } catch {} }
        if (b) { blobs.push(b); names.push(m.name || `video-${idx+1}.mp4`); }
      } else if (m.type === 'video-url') {
        window.open(m.url, '_blank');
      }
    }

    if (!blobs.length) { Notify.info('Tidak ada media yang bisa diunduh'); return; }

    // Mobile: share semua file sekaligus dalam satu share sheet
    const isMobile = navigator.maxTouchPoints > 0;
    if (isMobile && navigator.share && navigator.canShare) {
      try {
        const files = blobs.map((b, i) => new File([b], names[i], { type: b.type }));
        if (navigator.canShare({ files })) {
          await navigator.share({ files });
          Notify.success(`${blobs.length} media siap disimpan ✓`);
          return;
        }
      } catch(e) {
        if (e.name === 'AbortError') return;
      }
    }

    // Desktop: download satu per satu
    for (let i = 0; i < blobs.length; i++) {
      const url = URL.createObjectURL(blobs[i]);
      const a = document.createElement('a');
      a.href = url; a.download = names[i];
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      if (i < blobs.length - 1) await new Promise(r => setTimeout(r, 350));
    }
    Notify.success(`${blobs.length} media diunduh ✓`);
  }

  /* ═══════════════════════════════════════════
     SAVE VIDEO — simpan ke IDB user + download
  ═══════════════════════════════════════════ */
  async function _saveVideo(itemId, mediaIdx) {
    const item = _items.find(i => i.id === itemId);
    if (!item) return;
    const m = (item.media || [])[mediaIdx];
    if (!m || m.type !== 'video-idb') return;

    const btn = document.getElementById('vid-btn-' + m.idbKey);
    if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

    const hasSaved = _isVidSaved(m.idbKey);
    const srcKey   = hasSaved ? (_getVidSavedKey(m.idbKey) || m.idbKey) : m.idbKey;
    let blob       = await _IDB.load(srcKey);
    if (!blob && hasSaved) blob = await _IDB.load(m.idbKey);
    // Cross-device: load dari base64 yang disimpan di news item
    if (!blob && m.data) {
      if (btn) btn.textContent = '⏳ Mengunduh...';
      try { blob = await fetch(m.data).then(r => r.blob()); } catch {}
    }
    if (!blob) {
      Notify.error('Video tidak tersedia di perangkat ini');
      if (btn) { btn.disabled = false; btn.textContent = '⬇ Simpan'; }
      return;
    }

    // Simpan ke IDB milik user ini
    const userKey = _getUserVidKey(m.idbKey);
    await _IDB.save(userKey, blob);
    _markVidSaved(m.idbKey, userKey);

    // Simpan ke galeri device (Web Share API atau fallback download)
    await _galleryDownload(blob, m.name || 'video.mp4', 'video/mp4');
    Notify.success('Video disimpan ke galeri ✓');

    // Update button → Putar Full
    if (btn) {
      btn.disabled = false; btn.textContent = '✓ Tersimpan';
      // Tambah tombol Putar Full di sebelahnya
      const playBtn = document.createElement('button');
      playBtn.textContent = '▶ Putar Full';
      playBtn.style.cssText = 'background:rgba(99,102,241,.85);color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;margin-left:4px';
      playBtn.onclick = () => _openVideoPlayer(userKey, m.name || 'Video');
      btn.parentNode.appendChild(playBtn);
    }
  }

  /* ═══════════════════════════════════════════
     OPEN VIDEO PLAYER — fullscreen modal
  ═══════════════════════════════════════════ */
  function _openVideoPlayer(idbKey, name) {
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: '▶ ' + (name || 'Video'),
      size: 'modal-xl',
      body: `<div id="vp-${mid}" style="background:#000;border-radius:8px;min-height:180px;
              display:flex;align-items:center;justify-content:center">
        <div style="color:#888;font-size:13px">⏳ Memuat...</div>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
    _IDB.load(idbKey).then(blob => {
      const el = document.getElementById('vp-' + mid);
      if (!el) return;
      if (!blob) { el.innerHTML = `<div style="color:#aaa;padding:20px;font-size:12px">Video tidak tersedia</div>`; return; }
      const url = URL.createObjectURL(blob);
      el.innerHTML = `<video src="${url}" controls autoplay
        style="width:100%;border-radius:8px;max-height:75vh;display:block"
        onended="try{URL.revokeObjectURL('${url}')}catch{}"></video>`;
    });
  }

  /* ═══════════════════════════════════════════
     DOWNLOAD MEDIA — simpan ke perangkat user
  ═══════════════════════════════════════════ */
  async function _downloadMedia(itemId, mediaIdx) {
    const item = _items.find(i => i.id === itemId);
    if (!item) return;
    const m = (item.media || [])[mediaIdx];
    if (!m) return;

    if (m.type === 'image') {
      // Prioritas: LS creator (full) → m.full (cross-device) → thumbnail
      const data = _imgLoad(m.ownerId, m.id) || m.full || m.thumb;
      if (!data) { Notify.error('Gambar tidak tersedia'); return; }
      // Simpan salinan ke LS user yang sedang login
      const viewerUid = Auth.currentUser()?.id || Auth.currentUser()?.username || 'anon';
      if (viewerUid !== m.ownerId) _imgSave(viewerUid, m.id, data);
      // Simpan ke galeri device
      await _galleryDownload(data, m.name || 'gambar.jpg', 'image/jpeg');
      Notify.success('Gambar disimpan ke galeri ✓');
    } else if (m.type === 'video-url') {
      window.open(m.url, '_blank');
    }
  }

  /* ═══════════════════════════════════════════
     VOTE
  ═══════════════════════════════════════════ */
  // Normalize vote entry: old votes stored uid as string, new as {uid,nama}
  const _voteUid  = v => (typeof v === 'string' ? v : v?.uid);
  const _voteName = v => (typeof v === 'string' ? null : v?.nama);

  function _voteItem(id, optId) {
    const item = _items.find(i => i.id === id);
    if (!item?.poll) return;
    const cu   = Auth.currentUser();
    const uid  = cu?.id || cu?.username || 'anon';
    const nama = cu?.nama || cu?.username || uid;
    const opt  = item.poll.options.find(o => o.id === optId);
    if (!opt) return;
    if (!item.poll.multiple) {
      item.poll.options.forEach(o => { o.votes = o.votes.filter(v => _voteUid(v) !== uid); });
      opt.votes.push({ uid, nama });
    } else {
      if (opt.votes.some(v => _voteUid(v) === uid)) opt.votes = opt.votes.filter(v => _voteUid(v) !== uid);
      else opt.votes.push({ uid, nama });
    }
    _persist();
    if (typeof DB !== 'undefined') DB.saveNews(item).catch(() => {});
    _render();
    const container = document.getElementById('news-poll-' + id);
    if (container) container.outerHTML = _renderPollHtml(item);
  }

  /* ═══════════════════════════════════════════
     VIEWERS
  ═══════════════════════════════════════════ */
  function openViewers(id) {
    const item  = _items.find(i => i.id === id);
    if (!item) return;
    const views = item.views || [];
    const mid   = Utils.uid();
    Modal.open({
      id: mid, title: `👁 Sudah Dilihat — ${item.judul}`, size: 'modal-md',
      body: views.length === 0 ? `
        <div style="text-align:center;padding:40px 20px;color:var(--text-3)">
          <div style="font-size:36px;margin-bottom:10px">👁</div>
          <div>Belum ada yang membuka pengumuman ini</div>
        </div>
      ` : `
        <div style="margin-bottom:10px;font-size:12px;color:var(--text-3)">${views.length} orang sudah membaca</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${views.map(v => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;
                        background:var(--surface2);border-radius:8px">
              <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);
                          display:flex;align-items:center;justify-content:center;
                          font-size:11px;font-weight:700;color:#fff;flex-shrink:0">
                ${(v.nama||'?')[0].toUpperCase()}
              </div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--text)">${v.nama||'User'}</div>
                <div style="font-size:11px;color:var(--text-3)">${_fmtTime(v.viewedAt)}</div>
              </div>
              <div style="font-size:10px;color:var(--text-3)">
                ${v.viewedAt ? new Date(v.viewedAt).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}
              </div>
            </div>`).join('')}
        </div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  /* ═══════════════════════════════════════════
     POLL VOTERS
  ═══════════════════════════════════════════ */
  function openVoters(itemId, optId) {
    const item = _items.find(i => i.id === itemId);
    if (!item?.poll) return;
    const opt = item.poll.options.find(o => o.id === optId);
    if (!opt) return;
    const mid = Utils.uid();
    const voters = opt.votes;
    Modal.open({
      id: mid, title: `📊 Pemilih — ${opt.text}`, size: 'modal-sm',
      body: voters.length === 0 ? `
        <div style="text-align:center;padding:40px 20px;color:var(--text-3)">
          <div style="font-size:32px;margin-bottom:8px">🗳</div>
          <div>Belum ada yang memilih opsi ini</div>
        </div>
      ` : `
        <div style="margin-bottom:10px;font-size:12px;color:var(--text-3)">${voters.length} orang memilih opsi ini</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${voters.map(v => {
            const name = _voteName(v) || _voteUid(v) || 'User';
            const init = name[0]?.toUpperCase() || '?';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;
                        background:var(--surface2);border-radius:8px">
              <div style="width:28px;height:28px;border-radius:50%;background:var(--primary);
                          display:flex;align-items:center;justify-content:center;
                          font-size:11px;font-weight:700;color:#fff;flex-shrink:0">${init}</div>
              <div style="font-size:13px;font-weight:600;color:var(--text)">${name}</div>
            </div>`;
          }).join('')}
        </div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  /* ═══════════════════════════════════════════
     CREATE FORM
  ═══════════════════════════════════════════ */
  async function openCreate() {
    _divisiList = []; _jabatanList = [];
    _fMedia = []; _fPollOn = false;
    _fPollOpts = [{ id: Utils.uid(), text: '' }, { id: Utils.uid(), text: '' }];
    try {
      if (typeof DB !== 'undefined') {
        const emps   = await DB.getEmployees().catch(() => []);
        _divisiList  = [...new Set(emps.map(e => e.divisi || e.departemen).filter(Boolean))].sort();
        _jabatanList = [...new Set(emps.map(e => e.jabatan).filter(Boolean))].sort();
      }
    } catch {}

    Modal.open({
      id: 'news-create', title: '📢 Buat Pengumuman', size: 'modal-lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="form-group">
            <label class="form-label">Tipe</label>
            <select id="nc-tipe" class="form-control">
              <option value="info">📢 Info</option>
              <option value="success">✅ Kabar Baik</option>
              <option value="warning">⚠️ Penting</option>
              <option value="urgent">🚨 URGENT</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Judul <span style="color:#ef4444">*</span></label>
            <input id="nc-judul" class="form-control" placeholder="Judul pengumuman..."
              oninput="this.style.borderColor=''">
          </div>
          <div class="form-group">
            <label class="form-label">Isi Pengumuman <span style="color:#ef4444">*</span></label>
            <textarea id="nc-isi" class="form-control" rows="4" placeholder="Tulis isi pengumuman..."
              style="resize:vertical" oninput="this.style.borderColor=''"></textarea>
          </div>

          <!-- Media -->
          <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">📎 Lampiran Media</div>
            <div id="nc-media-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px"></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <label class="btn btn-ghost btn-sm" style="cursor:pointer;font-size:12px">
                🖼 Tambah Gambar
                <input type="file" id="nc-img-input" accept="image/*" multiple style="display:none"
                  onchange="NewsModule._ncAddImages(this)">
              </label>
              <label class="btn btn-ghost btn-sm" style="cursor:pointer;font-size:12px">
                🎬 Upload Video
                <input type="file" id="nc-vid-input" accept="video/*" style="display:none"
                  onchange="NewsModule._ncAddVideoFile(this)">
              </label>
              <button class="btn btn-ghost btn-sm" type="button" onclick="NewsModule._ncAddVideoUrl()" style="font-size:12px">
                🔗 Video URL
              </button>
            </div>
            <div style="font-size:11px;color:var(--text-3);margin-top:6px;line-height:1.6">
              Gambar maks 10 buah · <span style="color:#f59e0b;font-weight:600">Video maks 10 MB</span> (lebih besar hanya tersedia di perangkat ini) · URL untuk YouTube/link eksternal
            </div>
          </div>

          <!-- Polling -->
          <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:12px;font-weight:600;color:var(--text-2)">📊 Polling</div>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text-2)">
                <input type="checkbox" id="nc-poll-toggle" onchange="NewsModule._ncTogglePoll(this.checked)">
                Aktifkan Polling
              </label>
            </div>
            <div id="nc-poll-body" style="display:none;margin-top:12px">
              <div class="form-group" style="margin-bottom:10px">
                <label class="form-label">Pertanyaan <span style="color:#ef4444">*</span></label>
                <input id="nc-poll-q" class="form-control" placeholder="Contoh: Apakah Anda setuju?"
                  oninput="this.style.borderColor=''">
              </div>
              <div style="font-size:11px;font-weight:600;color:var(--text-2);margin-bottom:6px">Pilihan Jawaban</div>
              <div id="nc-poll-opts"></div>
              <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" type="button" onclick="NewsModule._ncAddPollOpt()" style="font-size:12px">+ Tambah Pilihan</button>
                <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text-2);cursor:pointer">
                  <input type="checkbox" id="nc-poll-multiple"> Boleh Pilih Lebih dari 1
                </label>
              </div>
            </div>
          </div>

          <!-- Push -->
          <div style="border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:10px">📱 Push Notifikasi</div>
            <div class="form-group" style="margin-bottom:8px">
              <label class="form-label">Kirim Push Ke</label>
              <select id="nc-target" class="form-control" onchange="NewsModule._ncTargetChange(this.value)">
                <option value="all">Semua Karyawan</option>
                <option value="divisi">Divisi Tertentu</option>
                <option value="jabatan">Jabatan Tertentu</option>
                <option value="none">Tidak Kirim Push</option>
              </select>
            </div>
            <div id="nc-filter-wrap" style="display:none;margin-bottom:8px">
              <div class="form-group" style="margin:0">
                <label class="form-label" id="nc-filter-label">Divisi</label>
                <select id="nc-filter-value" class="form-control" onchange="NewsModule._ncCountRecipients()">
                  ${_divisiList.map(d => `<option value="${Utils.esc(d)}">${Utils.esc(d)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div id="nc-push-info" style="padding:8px 12px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--text-3)">
              📱 Penerima push: <strong id="nc-count">menghitung...</strong> device
              <div style="margin-top:2px;font-size:11px">Pengumuman tetap tampil di feed untuk semua user</div>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('news-create')">Batal</button>
        <button class="btn btn-primary" onclick="NewsModule._submitCreate()">Kirim Pengumuman</button>
      `,
    });
    _ncRenderPollOpts();
    setTimeout(() => NewsModule._ncCountRecipients(), 200);
  }

  /* ─── Form: Media ─── */
  function _ncRenderMediaPreview() {
    const el = document.getElementById('nc-media-list');
    if (!el) return;
    if (_fMedia.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = _fMedia.map((m, i) => {
      const thumb = m._thumb || m.thumb || null;
      const label = m.type === 'video-idb' ? `<div style="position:absolute;bottom:3px;left:3px;background:rgba(0,0,0,.6);color:#fff;font-size:9px;padding:1px 4px;border-radius:3px">${_fmtBytes(m.size||0)}</div>` : '';
      return `
        <div style="position:relative;width:80px;height:80px;flex-shrink:0">
          ${thumb
            ? `<img src="${thumb}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`
            : `<div style="width:80px;height:80px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px">🎬</div>`}
          ${label}
          <button onclick="NewsModule._ncRemoveMedia(${i})"
            style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;
                   background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:11px;
                   display:flex;align-items:center;justify-content:center;line-height:1">×</button>
        </div>`;
    }).join('');
  }

  async function _ncAddImages(input) {
    const files     = Array.from(input.files || []);
    const imgCount  = _fMedia.filter(m => m.type === 'image').length;
    const remaining = 10 - imgCount;
    if (remaining <= 0) { Notify.warning('Maksimal 10 gambar per pengumuman'); input.value = ''; return; }
    for (const file of files.slice(0, remaining)) {
      try {
        const [full, thumb] = await Promise.all([
          _compressImage(file, 1024, 0.78),
          _compressImage(file, 200, 0.60),
        ]);
        _fMedia.push({ type: 'image', _full: full, _thumb: thumb, name: file.name });
        _ncRenderMediaPreview();
      } catch { Notify.error('Gagal memuat: ' + file.name); }
    }
    input.value = '';
  }

  async function _ncAddVideoFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    // Validate video size — max 50MB for local, max 10MB for cloud sync
    if (file.size > 50 * 1024 * 1024) {
      Notify.warning('Video terlalu besar. Maks 50MB.');
      input.value = ''; return;
    }
    if (file.size > 10 * 1024 * 1024) {
      Notify.info('Video > 10MB hanya tersimpan di perangkat ini (tidak sync ke cloud)');
    }
    Notify.info('Memproses video...');
    const idbKey = Utils.uid();
    const thumb  = await _videoThumb(file).catch(() => null);
    try {
      await _IDB.save(idbKey, file);
      _fMedia.push({ type: 'video-idb', idbKey, _thumb: thumb, name: file.name, size: file.size });
      _ncRenderMediaPreview();
    } catch(e) {
      Notify.error('Gagal menyimpan video: ' + (e.message || 'Storage penuh'));
    }
    input.value = '';
  }

  function _ncAddVideoUrl() {
    const url = prompt('Masukkan URL video:\n(YouTube: youtube.com/watch?v=... atau youtu.be/...)\n(Langsung: link file video)');
    if (!url?.trim()) return;
    const u     = url.trim();
    const thumb = _ytThumbUrl(u);
    _fMedia.push({ type: 'video-url', url: u, _thumb: thumb, name: 'Video', thumb });
    _ncRenderMediaPreview();
  }

  async function _ncRemoveMedia(idx) {
    const m = _fMedia[idx];
    if (m?.type === 'video-idb' && m.idbKey) await _IDB.remove(m.idbKey);
    _fMedia.splice(idx, 1);
    _ncRenderMediaPreview();
  }

  /* ─── Form: Poll ─── */
  function _ncTogglePoll(on) {
    _fPollOn = on;
    const body = document.getElementById('nc-poll-body');
    if (body) body.style.display = on ? '' : 'none';
  }
  function _ncAddPollOpt() {
    if (_fPollOpts.length >= 6) { Notify.warning('Maksimal 6 pilihan'); return; }
    _fPollOpts.push({ id: Utils.uid(), text: '' });
    _ncRenderPollOpts();
  }
  function _ncRemovePollOpt(idx) {
    if (_fPollOpts.length <= 2) { Notify.warning('Minimal 2 pilihan'); return; }
    _fPollOpts.splice(idx, 1);
    _ncRenderPollOpts();
  }
  function _ncPollOptInput(idx, val) { if (_fPollOpts[idx]) _fPollOpts[idx].text = val; }
  function _ncRenderPollOpts() {
    const el = document.getElementById('nc-poll-opts');
    if (!el) return;
    el.innerHTML = _fPollOpts.map((opt, i) => `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-3);width:16px;text-align:right;flex-shrink:0">${i+1}.</span>
        <input class="form-control" style="flex:1;font-size:13px" placeholder="Pilihan ${i+1}..."
          value="${Utils.esc(opt.text)}" oninput="NewsModule._ncPollOptInput(${i},this.value)">
        <button onclick="NewsModule._ncRemovePollOpt(${i})"
          style="width:28px;height:28px;flex-shrink:0;border-radius:6px;border:1px solid var(--border);
                 background:transparent;cursor:pointer;font-size:16px;color:var(--text-3);
                 display:flex;align-items:center;justify-content:center">×</button>
      </div>`).join('');
  }

  /* ─── Form: Push ─── */
  function _ncTargetChange(val) {
    const wrap  = document.getElementById('nc-filter-wrap');
    const label = document.getElementById('nc-filter-label');
    const sel   = document.getElementById('nc-filter-value');
    const info  = document.getElementById('nc-push-info');
    if (val === 'none') { if (wrap) wrap.style.display='none'; if (info) info.style.display='none'; return; }
    if (info) info.style.display = '';
    if (val === 'all') { if (wrap) wrap.style.display='none'; }
    else {
      if (wrap) wrap.style.display = '';
      if (label) label.textContent = val === 'divisi' ? 'Divisi' : 'Jabatan';
      const list = val === 'divisi' ? _divisiList : _jabatanList;
      if (sel) sel.innerHTML = list.map(d => `<option value="${Utils.esc(d)}">${Utils.esc(d)}</option>`).join('');
    }
    _ncCountRecipients();
  }
  async function _ncCountRecipients() {
    const target = document.getElementById('nc-target')?.value || 'all';
    if (target === 'none') return;
    const val    = document.getElementById('nc-filter-value')?.value;
    const filter = target==='divisi'&&val ? {divisi:val} : target==='jabatan'&&val ? {jabatan:val} : {};
    if (typeof DB === 'undefined') return;
    const rows = await DB.getPushTokens(filter).catch(() => []);
    const el   = document.getElementById('nc-count');
    if (el) el.textContent = rows.length;
  }

  /* ═══════════════════════════════════════════
     SUBMIT CREATE
  ═══════════════════════════════════════════ */
  async function _submitCreate() {
    const judul  = document.getElementById('nc-judul')?.value.trim();
    const isi    = document.getElementById('nc-isi')?.value.trim();
    const tipe   = document.getElementById('nc-tipe')?.value || 'info';
    const target = document.getElementById('nc-target')?.value || 'all';
    const fval   = document.getElementById('nc-filter-value')?.value;
    const _err = (id, msg) => {
      const el = document.getElementById(id);
      if (el) { el.style.borderColor = '#ef4444'; el.focus(); el.scrollIntoView({ behavior:'smooth', block:'center' }); }
      Notify.warning(msg);
    };
    if (!judul) { _err('nc-judul', 'Judul wajib diisi'); return; }
    if (!isi)   { _err('nc-isi',   'Isi pengumuman wajib diisi'); return; }

    let poll = null;
    if (_fPollOn) {
      const q    = document.getElementById('nc-poll-q')?.value.trim();
      const opts = _fPollOpts.filter(o => o.text.trim());
      if (!q)            { _err('nc-poll-q', 'Pertanyaan polling wajib diisi'); return; }
      if (opts.length<2) { Notify.warning('Minimal 2 pilihan polling harus diisi'); return; }
      poll = {
        question: q,
        options:  opts.map(o => ({ id: o.id, text: o.text.trim(), votes: [] })),
        multiple: document.getElementById('nc-poll-multiple')?.checked || false,
      };
    }

    const user    = Auth.currentUser();
    const ownerId = user?.id || user?.username || 'anon';

    // Save full images to creator's per-user LS; store only thumb + ref in news item
    const savedMedia = [];
    for (const m of _fMedia) {
      if (m.type === 'image') {
        const id = Utils.uid();
        _imgSave(ownerId, id, m._full);
        // Simpan full juga di news item agar device lain bisa akses ukuran penuh
        savedMedia.push({ type: 'image', id, ownerId, name: m.name, thumb: m._thumb, full: m._full });
      } else if (m.type === 'video-idb') {
        // Baca blob; jika ≤ 10MB simpan sebagai base64 agar cross-device bisa download
        let vidData = null;
        if ((m.size || 0) <= 10 * 1024 * 1024) {
          try {
            const blob = await _IDB.load(m.idbKey);
            if (blob) vidData = await new Promise(res => {
              const r = new FileReader();
              r.onload = e => res(e.target.result);
              r.readAsDataURL(blob);
            });
          } catch {}
        }
        savedMedia.push({ type: 'video-idb', idbKey: m.idbKey, name: m.name, size: m.size, thumb: m._thumb, ...(vidData ? { data: vidData } : {}) });
      } else if (m.type === 'video-url') {
        savedMedia.push({ type: 'video-url', url: m.url, name: m.name, thumb: m.thumb });
      }
    }

    const item = {
      id: Utils.uid(), judul, isi, tipe,
      author: user?.nama || user?.username || 'Admin',
      createdAt: new Date().toISOString(),
      views: [],
      ...(savedMedia.length > 0 && { media: savedMedia }),
      ...(poll && { poll }),
    };
    _items.push(item);
    _persist();
    // Sync ke Supabase agar semua device menerima pengumuman
    if (typeof DB !== 'undefined') DB.saveNews(item).catch(() => {});
    Modal.close('news-create');
    _fMedia = [];
    _render();
    Notify.success('Pengumuman berhasil dikirim');

    if (target !== 'none' && typeof PushModule !== 'undefined') {
      const filter = target==='divisi'&&fval ? {divisi:fval} : target==='jabatan'&&fval ? {jabatan:fval} : {};
      try {
        const rows = await DB.getPushTokens(filter).catch(() => []);
        await PushModule.sendToGroup(filter, { title: judul, body: isi.substring(0, 120), data: { type: 'news' } });
        if (rows.length) Notify.success(`Push terkirim ke ${rows.length} device ✓`);
        else Notify.info('Belum ada device terdaftar untuk notifikasi push');
      } catch(e) { console.warn('Push failed:', e); }
    }
  }

  /* ═══════════════════════════════════════════
     DELETE / MARK READ
  ═══════════════════════════════════════════ */
  async function deleteItem(id) {
    if (!confirm('Hapus pengumuman ini?')) return;
    const item = _items.find(i => i.id === id);
    if (item) {
      // Clean up per-user image LS and IDB
      const ownerId = Auth.currentUser()?.id || Auth.currentUser()?.username || 'anon';
      (item.media || []).forEach(m => {
        if (m.type === 'image')     _imgDelete(m.ownerId || ownerId, m.id);
        if (m.type === 'video-idb') _IDB.remove(m.idbKey);
      });
    }
    _items = _items.filter(i => i.id !== id);
    _persist();
    if (typeof DB !== 'undefined') DB.deleteNews(id).catch(() => {});
    Modal.closeAll();
    _render();
    Notify.success('Pengumuman dihapus');
  }

  function markAllRead() { _items.forEach(i => _markRead(i.id)); _render(); }

  async function init() {
    // ── 1. Tampilkan dari localStorage dulu (instan, tanpa tunggu network) ──
    _load();
    _render();

    // ── 2. Fetch dari Supabase di background, update jika ada data baru ──
    if (typeof DB !== 'undefined') {
      DB.getNews().then(rows => {
        if (!Array.isArray(rows)) return;
        _items = rows;
        try { localStorage.setItem(_KEY, JSON.stringify(_items)); } catch {}
        _render();
        _updateBadge();
      }).catch(() => {});
    }
  }

  return {
    init, openItem, openViewers, openVoters, openCreate, deleteItem, markAllRead,
    _submitCreate, _updateBadge, _voteItem, _downloadMedia, _downloadAll,
    _saveVideo, _openVideoPlayer, _openImage,
    _ncTargetChange, _ncCountRecipients,
    _ncAddImages, _ncAddVideoFile, _ncAddVideoUrl, _ncRemoveMedia,
    _ncTogglePoll, _ncAddPollOpt, _ncRemovePollOpt, _ncPollOptInput,
  };
})();

window.NewsModule = NewsModule;
