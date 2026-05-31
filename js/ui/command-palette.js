/* ============================================
   BECCA V2.0 — Command Palette (Cmd/Ctrl+K)
   Quick navigate + actions dengan fuzzy search.
   - Cmd/Ctrl+K → buka palette
   - Esc → tutup
   - ↑/↓ → navigate, Enter → execute
============================================ */
const CommandPalette = (() => {
  'use strict';

  const _RECENT_KEY = 'becca_cp_recent';
  const MAX_RECENT = 5;

  // ── Source utama: navigation items (per role) ────────────
  function _pages() {
    if (typeof Auth === 'undefined') return [];
    const map = [
      ['dashboard',  'Dashboard',       '📊'],
      ['order',      'Order',           '📝'],
      ['invoice',    'Invoice',         '📄'],
      ['customer',   'Customer',        '🏢'],
      ['news',       'News',            '📰'],
      ['kas',        'Kas Kecil',       '💰'],
      ['daily-order','Daily Order',     '🍽️'],
      ['inventory',  'Inventory',       '📦'],
      ['employee',   'Karyawan',        '👥'],
      ['ap',         'Account Payable', '💳'],
      ['po',         'Purchase Order',  '🛒'],
      ['task',       'Task',            '✓'],
      ['menu',       'Menu',            '🍴'],
      ['delivery',   'Delivery',        '🚚'],
      ['haccp',      'HACCP',           '🛡️'],
      ['chat',       'Chat',            '💬'],
      ['personal',   'Personal',        '👤'],
      ['report',     'Laporan',         '📈'],
      ['settings',   'Pengaturan',      '⚙️'],
    ];
    return map.filter(([id]) => Auth.can(id, 'view') || id === 'dashboard').map(([id, label, icon]) => ({
      kind: 'nav', id, label, icon,
      description: 'Buka halaman ' + label,
      run: () => App.navigate(id),
      score: 0,
    }));
  }

  // ── Source: common actions (context-aware tapi minimal) ─
  function _actions() {
    const list = [
      { id:'act-new-customer', label:'Tambah Customer Baru', icon:'➕', description:'Buka form customer', when:()=>Auth.can('customer','edit'),
        run: () => { App.navigate('customer'); setTimeout(()=>window.CustomerModule?.openModal?.(), 300); } },
      { id:'act-new-kas', label:'Tambah Baris Kas Baru', icon:'➕', description:'Tambah pengeluaran kas', when:()=>Auth.can('kas','edit'),
        run: () => { App.navigate('kas'); setTimeout(()=>window.KasModule?.addRow?.(), 300); } },
      { id:'act-haccp-temp', label:'Catat Suhu HACCP', icon:'🌡️', description:'Quick log suhu', when:()=>Auth.can('haccp','edit'),
        run: () => { App.navigate('haccp'); setTimeout(()=>window.HaccpModule?.openQuickLog?.(), 300); } },
      { id:'act-tests', label:'Jalankan Test Suite', icon:'🧪', description:'BeccaTests.runAll()', when:()=>Auth.isSuperAdmin?.(),
        run: () => { if (window.BeccaTests) BeccaTests.runAll(); else Notify.warning('Test suite tidak tersedia'); } },
      { id:'act-logout', label:'Logout', icon:'🚪', description:'Keluar dari BECCA',
        run: () => { Auth.logout?.(); location.reload(); } },
      { id:'act-print', label:'Print Halaman Aktif', icon:'🖨️', description:'Cetak halaman saat ini',
        run: () => window.print() },
      { id:'act-clear-cache', label:'Bersihkan Cache Modul', icon:'🧹', description:'Reload semua modul fresh', when:()=>Auth.isSuperAdmin?.(),
        run: () => { try { App._loadedModules?.clear?.(); Notify.info('Cache modul dibersihkan — refresh halaman'); } catch{} } },
    ];
    return list.filter(a => !a.when || a.when()).map(a => ({ ...a, kind:'action', score:0 }));
  }

  // ── Recent items ─────────────────────────────────────────
  function _getRecent() {
    try { return JSON.parse(localStorage.getItem(_RECENT_KEY)||'[]'); } catch { return []; }
  }
  function _pushRecent(id) {
    try {
      const list = _getRecent().filter(x => x !== id);
      list.unshift(id);
      localStorage.setItem(_RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
    } catch {}
  }

  // ── Fuzzy match: cocok bila SEMUA karakter query muncul berurutan ─
  function _fuzzy(label, q) {
    if (!q) return { match:true, score:0 };
    const L = label.toLowerCase(), Q = q.toLowerCase();
    if (L.includes(Q)) return { match:true, score: 100 - L.indexOf(Q) }; // exact substring tinggi
    let li = 0, qi = 0, score = 0, streak = 0;
    while (li < L.length && qi < Q.length) {
      if (L[li] === Q[qi]) { qi++; streak++; score += streak; }
      else streak = 0;
      li++;
    }
    return { match: qi === Q.length, score };
  }

  // ── State + render ───────────────────────────────────────
  let _items = [];
  let _filtered = [];
  let _selectedIdx = 0;
  let _open = false;

  function _allItems() {
    const recent = _getRecent();
    const all = [..._pages(), ..._actions()];
    // Boost recent items
    all.forEach(it => { const r = recent.indexOf(it.id); if (r >= 0) it.recentBoost = (MAX_RECENT - r) * 10; });
    return all;
  }

  function _runQuery(q) {
    const list = _items.map(it => {
      const m = _fuzzy(it.label, q);
      const desc = _fuzzy(it.description || '', q);
      return { ...it, _matched: m.match || desc.match, _score: Math.max(m.score, desc.score * 0.5) + (it.recentBoost||0) };
    }).filter(it => !q || it._matched);
    list.sort((a,b) => b._score - a._score);
    return list.slice(0, 50);
  }

  function _renderItems() {
    const list = document.getElementById('cp-list'); if (!list) return;
    if (!_filtered.length) {
      list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-3);font-size:12px">Tidak ada hasil</div>`;
      return;
    }
    list.innerHTML = _filtered.map((it, i) => `
      <div class="cp-item ${i===_selectedIdx?'cp-sel':''}" data-idx="${i}" onclick="CommandPalette._pick(${i})">
        <span style="font-size:16px;width:24px;text-align:center">${it.icon||'•'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.label}</div>
          ${it.description?`<div style="font-size:10.5px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.description}</div>`:''}
        </div>
        <span style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em">${it.kind==='nav'?'Halaman':'Aksi'}</span>
      </div>`).join('');
  }

  function _pick(idx) {
    const it = _filtered[idx]; if (!it) return;
    _pushRecent(it.id);
    close();
    try { it.run?.(); } catch (e) { Notify?.error?.('Aksi gagal', e.message); }
  }

  function open() {
    if (_open) return;
    _open = true;
    _items = _allItems();
    _filtered = _runQuery('');
    _selectedIdx = 0;
    _injectCss();
    const overlay = document.createElement('div');
    overlay.id = 'cp-overlay';
    overlay.innerHTML = `
      <div id="cp-modal" role="dialog" aria-label="Command palette">
        <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
          <span style="color:var(--text-3);font-size:14px">⌘</span>
          <input id="cp-input" placeholder="Cari halaman atau aksi... (↑↓ pilih, Enter buka, Esc tutup)" autocomplete="off"
            style="flex:1;border:none;background:transparent;outline:none;font-size:14px;color:var(--text)">
          <kbd style="font-size:10px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:2px 6px;color:var(--text-3)">Esc</kbd>
        </div>
        <div id="cp-list" style="max-height:380px;overflow-y:auto"></div>
        <div style="padding:6px 14px;border-top:1px solid var(--border);font-size:10px;color:var(--text-3);display:flex;gap:10px">
          <span>↑↓ navigasi</span><span>Enter buka</span><span>Esc tutup</span>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    _renderItems();
    setTimeout(() => {
      const inp = document.getElementById('cp-input');
      inp?.focus();
      inp?.addEventListener('input', () => {
        _filtered = _runQuery(inp.value);
        _selectedIdx = 0;
        _renderItems();
      });
      inp?.addEventListener('keydown', _key);
    }, 30);
  }

  function close() {
    document.getElementById('cp-overlay')?.remove();
    _open = false;
  }

  function _key(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _selectedIdx = Math.min(_filtered.length - 1, _selectedIdx + 1);
      _renderItems();
      _scrollToSel();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _selectedIdx = Math.max(0, _selectedIdx - 1);
      _renderItems();
      _scrollToSel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      _pick(_selectedIdx);
    }
  }
  function _scrollToSel() {
    const el = document.querySelector('.cp-item.cp-sel');
    el?.scrollIntoView({ block:'nearest' });
  }

  function _injectCss() {
    if (document.getElementById('cp-css')) return;
    const s = document.createElement('style');
    s.id = 'cp-css';
    s.textContent = `
      #cp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);
        -webkit-backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:flex-start;
        justify-content:center;padding-top:12vh;animation:cpFade .15s ease}
      #cp-modal{width:min(560px,calc(100vw - 32px));background:var(--surface);
        border:1px solid var(--border);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.4);
        overflow:hidden;animation:cpUp .2s cubic-bezier(.34,1.4,.64,1)}
      .cp-item{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;
        border-bottom:1px solid var(--border)}
      .cp-item:last-child{border-bottom:none}
      .cp-item:hover, .cp-item.cp-sel{background:var(--primary-bg)}
      .cp-sel{box-shadow:inset 3px 0 0 var(--primary)}
      @keyframes cpFade{from{opacity:0}to{opacity:1}}
      @keyframes cpUp{from{opacity:0;transform:translateY(-12px) scale(.97)}to{opacity:1;transform:none}}
      @media(max-width:640px){#cp-overlay{padding-top:8vh}}
    `;
    document.head.appendChild(s);
  }

  // ── Init: global keyboard listener ───────────────────────
  function init() {
    if (window.__cpInited) return; window.__cpInited = true;
    document.addEventListener('keydown', (e) => {
      // Cmd+K (Mac) / Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (_open) close(); else open();
      }
    });
  }

  return { init, open, close, _pick };
})();
window.CommandPalette = CommandPalette;
