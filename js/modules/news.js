/* ============================================
   BECCA V2.0 — News & Pengumuman Module
   Broadcast center untuk admin ke semua user
============================================ */
const NewsModule = (() => {
  'use strict';

  const _KEY = 'becca_news';
  let _items = [];
  let _readSet = new Set();
  let _divisiList = [];
  let _jabatanList = [];

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

  function _persist() {
    localStorage.setItem(_KEY, JSON.stringify(_items));
  }

  function _markRead(id) {
    if (_readSet.has(id)) return;
    _readSet.add(id);
    try {
      const r = JSON.parse(localStorage.getItem(_readKey()) || '[]');
      if (!r.includes(id)) { r.push(id); localStorage.setItem(_readKey(), JSON.stringify(r)); }
    } catch {}
    _updateBadge();
  }

  function _unreadCount() {
    return _items.filter(i => !_readSet.has(i.id)).length;
  }

  function _updateBadge() {
    const el = document.getElementById('news-nav-badge');
    if (!el) return;
    const n = _unreadCount();
    el.textContent = n > 9 ? '9+' : String(n);
    el.style.display = n > 0 ? 'flex' : 'none';
  }

  const _COLOR = { info:'#6366f1', success:'#10b981', warning:'#f59e0b', urgent:'#ef4444' };
  const _ICON  = { info:'📢', success:'✅', warning:'⚠️', urgent:'🚨' };
  const _LABEL = { info:'Info', success:'Kabar Baik', warning:'Penting', urgent:'URGENT' };

  function _fmtTime(iso) {
    if (!iso) return '';
    try {
      const diff = Date.now() - new Date(iso).getTime();
      if (diff < 60000) return 'Baru saja';
      if (diff < 3600000) return Math.floor(diff / 60000) + ' mnt lalu';
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' jam lalu';
      if (diff < 604800000) return Math.floor(diff / 86400000) + ' hari lalu';
      return new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    } catch { return ''; }
  }

  /* ─── RENDER ─── */
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
            const unrd = !_readSet.has(item.id);
            const col  = _COLOR[item.tipe] || '#6366f1';
            return `
              <div onclick="NewsModule.openItem('${item.id}')"
                style="background:var(--surface);border:1px solid ${unrd ? col : 'var(--border)'};
                       border-left:4px solid ${unrd ? col : 'var(--border)'};
                       border-radius:12px;padding:14px 16px;cursor:pointer;
                       transition:transform .15s,box-shadow .15s;position:relative"
                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'"
                onmouseout="this.style.transform='';this.style.boxShadow=''">
                ${unrd ? `<div style="position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;background:${col}"></div>` : ''}
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap">
                  <span style="font-size:16px">${_ICON[item.tipe] || '📢'}</span>
                  <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;
                    background:${col}20;color:${col};text-transform:uppercase;letter-spacing:.04em">${_LABEL[item.tipe] || 'Info'}</span>
                  <span style="font-size:11px;color:var(--text-3);margin-left:auto">${_fmtTime(item.createdAt)}</span>
                </div>
                <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:4px">${item.judul}</div>
                <div style="font-size:12px;color:var(--text-2);line-height:1.5;
                  overflow:hidden;text-overflow:ellipsis;display:-webkit-box;
                  -webkit-line-clamp:2;-webkit-box-orient:vertical">${item.isi}</div>
                <div style="font-size:11px;color:var(--text-3);margin-top:7px">— ${item.author || 'Admin'}</div>
              </div>`;
          }).join('')}
        </div>
      `}
    `;
    _updateBadge();
  }

  /* ─── OPEN ITEM ─── */
  function openItem(id) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    _markRead(id);
    _render();
    const col = _COLOR[item.tipe] || '#6366f1';
    const canDelete = ['admin','superadmin'].includes((Auth.currentUser()?.role||'').toLowerCase()) || Auth.can('news','delete');
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: `${_ICON[item.tipe] || '📢'} ${item.judul}`,
      size: 'modal-md',
      body: `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;
            background:${col}20;color:${col};text-transform:uppercase">${_LABEL[item.tipe] || 'Info'}</span>
          <span style="font-size:11px;color:var(--text-3)">${_fmtTime(item.createdAt)} · oleh ${item.author || 'Admin'}</span>
        </div>
        <div style="font-size:13px;color:var(--text);line-height:1.8;white-space:pre-wrap">${item.isi}</div>
      `,
      footer: `
        ${canDelete ? `<button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="NewsModule.deleteItem('${item.id}')">Hapus</button>` : ''}
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
      `,
    });
  }

  /* ─── CREATE ─── */
  async function openCreate() {
    // Fetch employees untuk daftar divisi & jabatan
    _divisiList = [];
    _jabatanList = [];
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
      size: 'modal-md',
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
            <label class="form-label">Judul</label>
            <input id="nc-judul" class="form-control" placeholder="Judul pengumuman...">
          </div>
          <div class="form-group">
            <label class="form-label">Isi Pengumuman</label>
            <textarea id="nc-isi" class="form-control" rows="5"
              placeholder="Tulis isi pengumuman di sini..." style="resize:vertical"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Kirim Push Notifikasi Ke</label>
            <select id="nc-target" class="form-control" onchange="NewsModule._ncTargetChange(this.value)">
              <option value="all">Semua Karyawan</option>
              <option value="divisi">Divisi Tertentu</option>
              <option value="jabatan">Jabatan Tertentu</option>
              <option value="none">Tidak Kirim Push</option>
            </select>
          </div>
          <div id="nc-filter-wrap" style="display:none">
            <div class="form-group" style="margin:0">
              <label class="form-label" id="nc-filter-label">Divisi</label>
              <select id="nc-filter-value" class="form-control" onchange="NewsModule._ncCountRecipients()">
                ${_divisiList.map(d => `<option value="${Utils.esc(d)}">${Utils.esc(d)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div id="nc-push-info" style="padding:10px 12px;background:var(--surface2);border-radius:8px;font-size:12px;color:var(--text-3)">
            📱 Penerima push: <strong id="nc-count">menghitung...</strong> device terdaftar
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('news-create')">Batal</button>
        <button class="btn btn-primary" onclick="NewsModule._submitCreate()">Kirim Pengumuman</button>
      `,
    });
    setTimeout(() => NewsModule._ncCountRecipients(), 200);
  }

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

  async function _submitCreate() {
    const judul  = document.getElementById('nc-judul')?.value.trim();
    const isi    = document.getElementById('nc-isi')?.value.trim();
    const tipe   = document.getElementById('nc-tipe')?.value || 'info';
    const target = document.getElementById('nc-target')?.value || 'all';
    const val    = document.getElementById('nc-filter-value')?.value;
    if (!judul) { Notify.warning('Judul wajib diisi'); return; }
    if (!isi)   { Notify.warning('Isi pengumuman wajib diisi'); return; }
    const user = Auth.currentUser();
    const item = {
      id: Utils.uid(),
      judul, isi, tipe,
      author: user?.nama || user?.username || 'Admin',
      createdAt: new Date().toISOString(),
    };
    _items.push(item);
    _persist();
    Modal.close('news-create');
    _render();
    Notify.success('Pengumuman berhasil dikirim');
    // Kirim push notification ke target
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

  async function init() {
    _load();
    _render();
  }

  return { init, openItem, openCreate, deleteItem, markAllRead, _submitCreate, _updateBadge, _ncTargetChange, _ncCountRecipients };
})();

window.NewsModule = NewsModule;
