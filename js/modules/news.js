/* ============================================
   BECCA V2.0 — News & Pengumuman Module
   v2.1: Media (gambar/video) + Polling
============================================ */
const NewsModule = (() => {
  'use strict';

  const _KEY = 'becca_news';
  let _items = [];
  let _readSet = new Set();
  let _divisiList = [];
  let _jabatanList = [];

  // Create-form ephemeral state (reset on openCreate)
  let _fMedia = [];
  let _fPollOn = false;
  let _fPollOpts = [];

  /* ─── PERSISTENCE ─── */
  function _readKey() {
    const uid = (typeof Auth !== 'undefined' && Auth.currentUser()?.id) || 'anon';
    return 'becca_news_read_' + uid;
  }

  function _load() {
    try { _items = JSON.parse(localStorage.getItem(_KEY) || '[]'); } catch { _items = []; }
    try {
      const r = JSON.parse(localStorage.getItem(_readKey()) || '[]');
      _readSet = new Set(r);
    } catch { _readSet = new Set(); }
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
    // Track viewer in item.views[]
    const idx = _items.findIndex(i => i.id === id);
    if (idx !== -1) {
      if (!_items[idx].views) _items[idx].views = [];
      const user = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
      const uid  = user?.id || user?.username || 'anon';
      if (!_items[idx].views.some(v => v.uid === uid)) {
        _items[idx].views.push({ uid, nama: user?.nama || user?.username || 'User', viewedAt: new Date().toISOString() });
        _persist();
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

  /* ─── CONSTANTS ─── */
  const _COLOR = { info:'#6366f1', success:'#10b981', warning:'#f59e0b', urgent:'#ef4444' };
  const _ICON  = { info:'📢', success:'✅', warning:'⚠️', urgent:'🚨' };
  const _LABEL = { info:'Info', success:'Kabar Baik', warning:'Penting', urgent:'URGENT' };

  function _fmtTime(iso) {
    if (!iso) return '';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      if (diff < 60000)    return 'Baru saja';
      if (diff < 3600000)  return Math.floor(diff / 60000) + ' mnt lalu';
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
      if (diff < 604800000) return Math.floor(diff / 86400000) + ' hari lalu';
      return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    } catch { return ''; }
  }

  function _ytEmbedUrl(url) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }

  function _ytThumbUrl(url) {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
  }

  function _compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1024;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          const cvs = document.createElement('canvas');
          cvs.width = w; cvs.height = h;
          cvs.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(cvs.toDataURL('image/jpeg', 0.78));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ─── RENDER (card list) ─── */
  function _render() {
    const page = document.getElementById('page-news');
    if (!page) return;
    _load();
    const _role = (Auth.currentUser()?.role || '').toLowerCase();
    const canWrite = ['admin','superadmin'].includes(_role) || Auth.can('news','create');
    const sorted = [..._items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unread = _unreadCount();

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
            const unrd      = !_readSet.has(item.id);
            const col       = _COLOR[item.tipe] || '#6366f1';
            const viewCnt   = (item.views || []).length;
            const firstImg  = (item.media || []).find(m => m.type === 'image');
            const hasVideo  = (item.media || []).some(m => m.type === 'video');
            const hasPoll   = !!item.poll;
            const totalVotes = hasPoll ? item.poll.options.reduce((s, o) => s + o.votes.length, 0) : 0;
            return `
              <div onclick="NewsModule.openItem('${item.id}')"
                style="background:var(--surface);border:1px solid ${unrd ? col : 'var(--border)'};
                       border-left:4px solid ${unrd ? col : 'var(--border)'};
                       border-radius:12px;padding:14px 16px;cursor:pointer;
                       transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden"
                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'"
                onmouseout="this.style.transform='';this.style.boxShadow=''">
                ${unrd ? `<div style="position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;background:${col}"></div>` : ''}
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;flex-wrap:wrap">
                  <span style="font-size:16px">${_ICON[item.tipe] || '📢'}</span>
                  <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;
                    background:${col}20;color:${col};text-transform:uppercase;letter-spacing:.04em">${_LABEL[item.tipe] || 'Info'}</span>
                  ${firstImg || hasVideo ? `<span style="font-size:10px;color:var(--text-3)">${firstImg ? '🖼' : ''}${hasVideo ? '🎬' : ''}</span>` : ''}
                  ${hasPoll ? `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(16,185,129,.1);color:#10b981;font-weight:600">📊 ${totalVotes} suara</span>` : ''}
                  <span style="font-size:11px;color:var(--text-3);margin-left:auto">${_fmtTime(item.createdAt)}</span>
                </div>
                <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:4px">${item.judul}</div>
                <div style="font-size:12px;color:var(--text-2);line-height:1.5;
                  overflow:hidden;text-overflow:ellipsis;display:-webkit-box;
                  -webkit-line-clamp:2;-webkit-box-orient:vertical">${item.isi}</div>
                ${firstImg ? `
                  <div style="margin-top:10px;border-radius:8px;overflow:hidden;height:140px">
                    <img src="${firstImg.data}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
                  </div>
                ` : ''}
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
                  <span style="font-size:11px;color:var(--text-3)">— ${item.author || 'Admin'}</span>
                  <span onclick="event.stopPropagation();NewsModule.openViewers('${item.id}')"
                    style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:4px;
                           cursor:pointer;padding:2px 6px;border-radius:6px;transition:background .15s"
                    onmouseover="this.style.background='var(--surface2)'"
                    onmouseout="this.style.background=''">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    ${viewCnt > 0 ? `${viewCnt} dilihat` : 'Belum dilihat'}
                  </span>
                </div>
              </div>`;
          }).join('')}
        </div>
      `}
    `;
    _updateBadge();
  }

  /* ─── POLL HTML ─── */
  function _renderPollHtml(item) {
    if (!item.poll) return '';
    const poll = item.poll;
    const user = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
    const uid  = user?.id || user?.username || 'anon';
    const totalVotes   = poll.options.reduce((s, o) => s + o.votes.length, 0);
    const userVotedSet = new Set(poll.options.filter(o => o.votes.includes(uid)).map(o => o.id));
    const hasVoted     = userVotedSet.size > 0;

    return `
      <div id="news-poll-${item.id}" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          📊 ${poll.question}
          <span style="font-size:11px;color:var(--text-3);font-weight:400">${totalVotes} suara</span>
        </div>
        ${poll.options.map(opt => {
          const pct   = totalVotes > 0 ? Math.round(opt.votes.length / totalVotes * 100) : 0;
          const voted = userVotedSet.has(opt.id);
          return `
            <div style="margin-bottom:8px">
              <div onclick="NewsModule._voteItem('${item.id}','${opt.id}')"
                style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                       border:2px solid ${voted ? 'var(--primary)' : 'var(--border)'};
                       border-radius:8px;cursor:pointer;position:relative;overflow:hidden;
                       background:${voted ? 'rgba(99,102,241,.05)' : 'var(--surface)'};
                       transition:border-color .15s,background .15s">
                ${hasVoted ? `<div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;
                  background:${voted ? 'rgba(99,102,241,.12)' : 'rgba(0,0,0,.04)'};
                  pointer-events:none"></div>` : ''}
                <div style="position:relative;flex:1;font-size:13px;color:var(--text)">${opt.text}</div>
                ${hasVoted ? `<span style="position:relative;font-size:12px;font-weight:700;min-width:35px;text-align:right;
                  color:${voted ? 'var(--primary)' : 'var(--text-3)'}">${pct}%</span>` : ''}
                ${voted ? `<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5"
                  width="14" height="14" style="position:relative;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
              </div>
            </div>`;
        }).join('')}
        <div style="font-size:11px;color:var(--text-3);margin-top:2px">
          ${hasVoted
            ? `Anda sudah memilih · ${poll.multiple ? 'Pilihan ganda' : 'Klik pilihan lain untuk ganti'}`
            : `Klik opsi untuk memilih${poll.multiple ? ' · Pilihan ganda' : ''}`}
        </div>
      </div>
    `;
  }

  /* ─── OPEN ITEM ─── */
  function openItem(id) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    _markRead(id);
    _render();
    const col = _COLOR[item.tipe] || '#6366f1';
    const canDelete = ['admin','superadmin'].includes((Auth.currentUser()?.role||'').toLowerCase()) || Auth.can('news','delete');
    const viewCnt = (item.views || []).length;
    const mid = Utils.uid();

    const mediaHtml = (item.media || []).map(m => {
      if (m.type === 'image') return `
        <div style="margin-bottom:8px;border-radius:8px;overflow:hidden">
          <img src="${m.data}" style="width:100%;max-height:400px;object-fit:contain;background:var(--surface2)" loading="lazy">
        </div>`;
      if (m.type === 'video') {
        const embed = _ytEmbedUrl(m.url);
        if (embed) return `
          <div style="margin-bottom:8px;border-radius:8px;overflow:hidden;position:relative;padding-top:56.25%">
            <iframe src="${embed}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0"
              allowfullscreen loading="lazy"></iframe>
          </div>`;
        return `
          <div style="margin-bottom:8px">
            <video src="${m.url}" controls style="width:100%;max-height:300px;border-radius:8px;background:#000"></video>
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
        ${canDelete ? `<button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="NewsModule.deleteItem('${item.id}')">Hapus</button>` : ''}
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
  }

  /* ─── VOTE ─── */
  function _voteItem(id, optId) {
    const item = _items.find(i => i.id === id);
    if (!item || !item.poll) return;
    const user = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
    const uid  = user?.id || user?.username || 'anon';
    const opt  = item.poll.options.find(o => o.id === optId);
    if (!opt) return;

    if (!item.poll.multiple) {
      // Single choice: move vote to new option
      item.poll.options.forEach(o => { o.votes = o.votes.filter(v => v !== uid); });
      opt.votes.push(uid);
    } else {
      // Multiple choice: toggle
      if (opt.votes.includes(uid)) opt.votes = opt.votes.filter(v => v !== uid);
      else opt.votes.push(uid);
    }
    _persist();
    _render();
    // Update poll section in-place in open modal
    const container = document.getElementById('news-poll-' + id);
    if (container) container.outerHTML = _renderPollHtml(item);
  }

  /* ─── VIEWERS ─── */
  function openViewers(id) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    const views = item.views || [];
    const mid   = Utils.uid();
    Modal.open({
      id: mid,
      title: `👁 Sudah Dilihat — ${item.judul}`,
      size: 'modal-md',
      body: views.length === 0 ? `
        <div style="text-align:center;padding:40px 20px;color:var(--text-3)">
          <div style="font-size:36px;margin-bottom:10px">👁</div>
          <div style="font-size:14px">Belum ada yang membuka pengumuman ini</div>
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
                <div style="font-size:13px;font-weight:600;color:var(--text)">${v.nama || 'User'}</div>
                <div style="font-size:11px;color:var(--text-3)">${_fmtTime(v.viewedAt)}</div>
              </div>
              <div style="font-size:10px;color:var(--text-3)">
                ${v.viewedAt ? new Date(v.viewedAt).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  /* ─── CREATE FORM ─── */
  async function openCreate() {
    _divisiList = [];
    _jabatanList = [];
    _fMedia = [];
    _fPollOn = false;
    _fPollOpts = [{ id: Utils.uid(), text: '' }, { id: Utils.uid(), text: '' }];

    try {
      if (typeof DB !== 'undefined') {
        const emps = await DB.getEmployees().catch(() => []);
        _divisiList  = [...new Set(emps.map(e => e.divisi || e.departemen).filter(Boolean))].sort();
        _jabatanList = [...new Set(emps.map(e => e.jabatan).filter(Boolean))].sort();
      }
    } catch {}

    Modal.open({
      id: 'news-create',
      title: '📢 Buat Pengumuman',
      size: 'modal-lg',
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
            <label class="form-label">Judul *</label>
            <input id="nc-judul" class="form-control" placeholder="Judul pengumuman...">
          </div>
          <div class="form-group">
            <label class="form-label">Isi Pengumuman *</label>
            <textarea id="nc-isi" class="form-control" rows="4"
              placeholder="Tulis isi pengumuman di sini..." style="resize:vertical"></textarea>
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
              <button class="btn btn-ghost btn-sm" type="button" onclick="NewsModule._ncAddVideoUrl()" style="font-size:12px">
                🎬 Tambah Video URL
              </button>
            </div>
            <div style="font-size:11px;color:var(--text-3);margin-top:6px">Gambar maks 3 buah · Video: URL YouTube atau link langsung</div>
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
                <label class="form-label">Pertanyaan *</label>
                <input id="nc-poll-q" class="form-control" placeholder="Contoh: Apakah Anda setuju?">
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

  /* ─── FORM MEDIA HANDLERS ─── */
  function _ncRenderMediaPreview() {
    const el = document.getElementById('nc-media-list');
    if (!el) return;
    if (_fMedia.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = _fMedia.map((m, i) => {
      const thumb = m.type === 'image' ? m.data : (m.thumb || null);
      return `
        <div style="position:relative;width:80px;height:80px;flex-shrink:0">
          ${thumb
            ? `<img src="${thumb}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`
            : `<div style="width:80px;height:80px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px">🎬</div>`}
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
    const remaining = 3 - imgCount;
    if (remaining <= 0) { Notify.warning('Maksimal 3 gambar per pengumuman'); input.value = ''; return; }
    for (const file of files.slice(0, remaining)) {
      try {
        const data = await _compressImage(file);
        _fMedia.push({ type: 'image', data, name: file.name });
        _ncRenderMediaPreview();
      } catch { Notify.error('Gagal memuat gambar: ' + file.name); }
    }
    input.value = '';
  }

  function _ncAddVideoUrl() {
    const url = prompt('Masukkan URL video:\n(YouTube: youtube.com/watch?v=... atau youtu.be/...)\n(Langsung: URL file .mp4 dll)');
    if (!url || !url.trim()) return;
    const u     = url.trim();
    const thumb = _ytThumbUrl(u);
    _fMedia.push({ type: 'video', url: u, name: 'Video', thumb });
    _ncRenderMediaPreview();
  }

  function _ncRemoveMedia(idx) {
    _fMedia.splice(idx, 1);
    _ncRenderMediaPreview();
  }

  /* ─── FORM POLL HANDLERS ─── */
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

  function _ncPollOptInput(idx, val) {
    if (_fPollOpts[idx]) _fPollOpts[idx].text = val;
  }

  function _ncRenderPollOpts() {
    const el = document.getElementById('nc-poll-opts');
    if (!el) return;
    el.innerHTML = _fPollOpts.map((opt, i) => `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-3);width:16px;text-align:right;flex-shrink:0">${i + 1}.</span>
        <input class="form-control" style="flex:1;font-size:13px"
          placeholder="Pilihan ${i + 1}..."
          value="${Utils.esc(opt.text)}"
          oninput="NewsModule._ncPollOptInput(${i}, this.value)">
        <button onclick="NewsModule._ncRemovePollOpt(${i})"
          style="width:28px;height:28px;flex-shrink:0;border-radius:6px;border:1px solid var(--border);
                 background:transparent;cursor:pointer;font-size:16px;color:var(--text-3);
                 display:flex;align-items:center;justify-content:center">×</button>
      </div>
    `).join('');
  }

  /* ─── PUSH HANDLERS ─── */
  function _ncTargetChange(val) {
    const wrap  = document.getElementById('nc-filter-wrap');
    const label = document.getElementById('nc-filter-label');
    const sel   = document.getElementById('nc-filter-value');
    const info  = document.getElementById('nc-push-info');
    if (val === 'none') {
      if (wrap) wrap.style.display = 'none';
      if (info) info.style.display = 'none';
      return;
    }
    if (info) info.style.display = '';
    if (val === 'all') {
      if (wrap) wrap.style.display = 'none';
    } else {
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
    const filter = target === 'divisi' && val ? { divisi: val }
                 : target === 'jabatan' && val ? { jabatan: val } : {};
    if (typeof DB === 'undefined') return;
    const rows = await DB.getPushTokens(filter).catch(() => []);
    const el   = document.getElementById('nc-count');
    if (el) el.textContent = rows.length;
  }

  /* ─── SUBMIT ─── */
  async function _submitCreate() {
    const judul  = document.getElementById('nc-judul')?.value.trim();
    const isi    = document.getElementById('nc-isi')?.value.trim();
    const tipe   = document.getElementById('nc-tipe')?.value || 'info';
    const target = document.getElementById('nc-target')?.value || 'all';
    const val    = document.getElementById('nc-filter-value')?.value;
    if (!judul) { Notify.warning('Judul wajib diisi'); return; }
    if (!isi)   { Notify.warning('Isi pengumuman wajib diisi'); return; }

    let poll = null;
    if (_fPollOn) {
      const q    = document.getElementById('nc-poll-q')?.value.trim();
      const opts = _fPollOpts.filter(o => o.text.trim());
      if (!q)            { Notify.warning('Pertanyaan polling wajib diisi'); return; }
      if (opts.length < 2) { Notify.warning('Minimal 2 pilihan polling harus diisi'); return; }
      poll = {
        question: q,
        options: opts.map(o => ({ id: o.id, text: o.text.trim(), votes: [] })),
        multiple: document.getElementById('nc-poll-multiple')?.checked || false,
      };
    }

    const user = Auth.currentUser();
    const item = {
      id: Utils.uid(), judul, isi, tipe,
      author: user?.nama || user?.username || 'Admin',
      createdAt: new Date().toISOString(),
      views: [],
      ..._fMedia.length > 0  && { media: _fMedia.map(m => ({ ...m })) },
      ...(poll               && { poll }),
    };
    _items.push(item);
    _persist();
    Modal.close('news-create');
    _fMedia = [];
    _render();
    Notify.success('Pengumuman berhasil dikirim');

    if (target !== 'none' && typeof PushModule !== 'undefined') {
      const filter = target === 'divisi' && val ? { divisi: val }
                   : target === 'jabatan' && val ? { jabatan: val } : {};
      try {
        const rows = await DB.getPushTokens(filter).catch(() => []);
        await PushModule.sendToGroup(filter, { title: judul, body: isi.substring(0, 120), data: { type: 'news' } });
        if (rows.length) Notify.success(`Push terkirim ke ${rows.length} device ✓`);
        else Notify.info('Belum ada device terdaftar untuk notifikasi push');
      } catch(e) { console.warn('Push failed:', e); }
    }
  }

  /* ─── DELETE / MARK READ ─── */
  function deleteItem(id) {
    if (!confirm('Hapus pengumuman ini?')) return;
    _items = _items.filter(i => i.id !== id);
    _persist();
    Modal.closeAll();
    _render();
    Notify.success('Pengumuman dihapus');
  }

  function markAllRead() {
    _items.forEach(i => _markRead(i.id));
    _render();
  }

  async function init() { _load(); _render(); }

  return {
    init, openItem, openViewers, openCreate, deleteItem, markAllRead,
    _submitCreate, _updateBadge,
    _voteItem,
    _ncTargetChange, _ncCountRecipients,
    _ncAddImages, _ncAddVideoUrl, _ncRemoveMedia,
    _ncTogglePoll, _ncAddPollOpt, _ncRemovePollOpt, _ncPollOptInput,
  };
})();

window.NewsModule = NewsModule;
