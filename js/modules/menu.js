/* ============================================
   BECCA V2.0 — Menu Module
   Tab 1: Menu Generator (weekly planner per customer)
   Tab 2: Menu Library (1500+ menu items)
============================================ */
if(window.BECCA_DEBUG) console.log('[BECCA] MenuModule v20260404a loaded');

const MenuModule = (() => {
  'use strict';
  let _library = [], _plans = [], _customers = [], _orders = [], _groups = [];
  let _activeTab = 'generator';

  const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
  const SHIFTS = ['S1','S2','S3'];
  const DEFAULT_KOMPOSISI = ['Karbo','Lauk','Pendamping','Sayur','Sambel','Buah'];
  const KATEGORI = ['Karbo','Lauk Kering','Lauk Kuah','Pendamping','Sayur','Sambel','Buah','Minuman','Paketan'];
  const KOMP_OPTIONS = ['Karbo','Lauk','Lauk Kering','Lauk Kuah','Pendamping','Sayur','Sambel','Buah','Minuman','Paketan'];
  const CATEGORY = ['Indonesia','Western','Jepang','Thailand'];
  const TEMA = ['Padang','Sunda','Jawa','Betawi','Makassar','Manado','Bali','Medan','Kalimantan','Aceh','Umum'];
  const JENIS = ['Regular','Paketan'];

  /* ═══ HELPERS ═══ */
  function _esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ═══ INIT ═══ */
  async function init() {
    const page = document.getElementById('page-menu');
    if (!page) return;
    page.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-3)">Memuat menu...</div>';
    const [library, plans, customers, orders, settings] = await Promise.all([
      DB.getMenuLibrary().catch(()=>[]),
      DB.getMenuPlans().catch(()=>[]),
      DB.getCustomers().catch(()=>[]),
      DB.getOrders().catch(()=>[]),
      DB.getSettings().catch(()=>({})),
    ]);
    _library = library; _plans = plans; _orders = orders;
    _groups = settings._menuGroups || [];
    try { if (!_groups.length) _groups = JSON.parse(localStorage.getItem('becca_menu_groups')||'[]'); } catch {}
    _customers = _dedupeCustomers(customers.filter(c=>(c.status||'AKTIF')==='AKTIF'));
    // Seed library if empty
    // Seed v2: adds new items not yet in library (checks by name, skips existing)
    const SEED_VER = 'becca_menu_seed_v3';
    if (!localStorage.getItem(SEED_VER)) {
      await _seedLibrary();
      localStorage.setItem(SEED_VER, '1');
      _library = await DB.getMenuLibrary().catch(()=>[]);
    }
    await _migrateNasiToKarbo();
    _renderFull(page);
  }

  /* ═══ RENDER ═══ */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-menu');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h2>Menu</h2><p>Menu Generator & Library</p></div>
      </div>
      <div class="tabs" style="margin-bottom:var(--s4)">
        <button class="tab-btn ${_activeTab==='generator'?'active':''}" onclick="MenuModule.switchTab('generator')">\ud83c\udf73 Menu Generator</button>
        <button class="tab-btn ${_activeTab==='library'?'active':''}" onclick="MenuModule.switchTab('library')">\ud83d\udcda Menu Library</button>
        <button class="tab-btn ${_activeTab==='grup'?'active':''}" onclick="MenuModule.switchTab('grup')">\ud83d\udc65 Grup Menu</button>
      </div>
      <div id="menu-tab-generator" ${_activeTab!=='generator'?'class="hidden"':''}></div>
      <div id="menu-tab-library" ${_activeTab!=='library'?'class="hidden"':''}></div>
      <div id="menu-tab-grup" ${_activeTab!=='grup'?'class="hidden"':''}></div>
    `;
    if (_activeTab==='generator') _renderGenerator();
    else if (_activeTab==='library') _renderLibrary();
    else _renderGroups();
  }

  function switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.tabs .tab-btn').forEach(b => {
      const isActive =
        (tab==='generator' && b.textContent.includes('Generator')) ||
        (tab==='library' && b.textContent.includes('Library')) ||
        (tab==='grup' && b.textContent.includes('Grup'));
      b.classList.toggle('active', isActive);
    });
    ['generator','library','grup'].forEach(t => {
      const el = document.getElementById('menu-tab-'+t);
      if (el) el.classList.toggle('hidden', t!==tab);
    });
    if (tab==='generator') _renderGenerator();
    else if (tab==='library') _renderLibrary();
    else {
      _renderGroups();
      DB.getCustomers().catch(()=>null).then(fresh => {
        if (!fresh) return;
        _customers = fresh.filter(c=>(c.status||'AKTIF')==='AKTIF').sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
        _renderGroups();
      });
    }
  }

  /* ═══════════════════════════════════════════
     MENU LIBRARY
     ═══════════════════════════════════════════ */
  let _libSearch='', _libKat='', _libCat='', _libTema='', _libJenis='';

  function _renderLibrary() {
    const el = document.getElementById('menu-tab-library');
    if (!el) return;
    let list = _library.filter(m=>!m.archived);
    if (_libSearch) { const q=_libSearch.toLowerCase(); list=list.filter(m=>(m.nama||'').toLowerCase().includes(q)||(m.bahan||'').toLowerCase().includes(q)); }
    if (_libKat) list=list.filter(m=>m.klasifikasi===_libKat);
    if (_libCat) list=list.filter(m=>m.category===_libCat);
    if (_libTema) list=list.filter(m=>m.tema===_libTema);
    if (_libJenis) list=list.filter(m=>m.jenis===_libJenis);

    // Count per kategori (from full library, not filtered)
    const allItems = _library.filter(m=>!m.archived);
    const katCounts = {};
    KATEGORI.forEach(k => katCounts[k] = 0);
    allItems.forEach(m => {
      if(katCounts[m.klasifikasi]!==undefined) katCounts[m.klasifikasi]++;
      // Also count Paketan by jenis (if klasifikasi is different like Nasi)
      if(m.jenis==='Paketan' && m.klasifikasi!=='Paketan') katCounts['Paketan']++;
    });
    const katColors = {'Karbo':'#f59e0b','Lauk Kering':'#ef4444','Lauk Kuah':'#f97316','Pendamping':'#8b5cf6','Sayur':'#10b981','Sambel':'#ec4899','Buah':'#06b6d4','Minuman':'#3b82f6','Paketan':'#6366f1'};

    el.innerHTML = `
      <!-- Kategori cards -->
      <div style="display:flex;gap:var(--s2);margin-bottom:var(--s3);overflow-x:auto;padding-bottom:4px">
        <div onclick="MenuModule._libFilter('kat','')" style="flex-shrink:0;padding:8px 14px;border-radius:var(--r-sm);cursor:pointer;border:1px solid ${!_libKat?'var(--primary)':'var(--border)'};background:${!_libKat?'var(--primary-bg)':'var(--surface)'};display:flex;align-items:center;gap:6px;transition:all .15s;box-shadow:0 1px 3px rgba(0,0,0,.06)"
          onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
          <span style="font-size:12px;font-weight:600;color:${!_libKat?'var(--primary)':'var(--text)'}">Semua</span>
          <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:var(--r-full);background:var(--surface2);color:var(--text-2)">${allItems.length}</span>
        </div>
        ${KATEGORI.map(k=>{
          const c=katColors[k]||'var(--text-3)';
          const active=_libKat===k;
          return `<div onclick="MenuModule._libFilter('kat','${k}')" style="flex-shrink:0;padding:8px 14px;border-radius:var(--r-sm);cursor:pointer;border:1px solid ${active?c+'50':'var(--border)'};background:${active?c+'12':'var(--surface)'};display:flex;align-items:center;gap:6px;transition:all .15s;box-shadow:0 1px 3px rgba(0,0,0,.06)"
            onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
            <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0"></span>
            <span style="font-size:12px;font-weight:600;color:${active?c:'var(--text)'};white-space:nowrap">${k}</span>
            <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:var(--r-full);background:${active?c+'20':'var(--surface2)'};color:${active?c:'var(--text-2)'}">${katCounts[k]}</span>
          </div>`;
        }).join('')}
      </div>

      <div class="filter-bar" style="margin-bottom:var(--s3)">
        <input type="text" class="form-control" style="flex:1;min-width:200px" placeholder="Cari menu / bahan..." value="${_esc(_libSearch)}" oninput="MenuModule._libFilter('search',this.value)">
        <select class="form-control" style="width:130px" onchange="MenuModule._libFilter('kat',this.value)">
          <option value="">Semua Klasifikasi</option>
          ${KATEGORI.map(k=>`<option value="${k}" ${_libKat===k?'selected':''}>${k}</option>`).join('')}
        </select>
        <select class="form-control" style="width:120px" onchange="MenuModule._libFilter('cat',this.value)">
          <option value="">Semua Category</option>
          ${CATEGORY.map(c=>`<option value="${c}" ${_libCat===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <select class="form-control" style="width:120px" onchange="MenuModule._libFilter('tema',this.value)">
          <option value="">Semua Tema</option>
          ${TEMA.map(t=>`<option value="${t}" ${_libTema===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <select class="form-control" style="width:110px" onchange="MenuModule._libFilter('jenis',this.value)">
          <option value="">Semua Jenis</option>
          ${JENIS.map(j=>`<option value="${j}" ${_libJenis===j?'selected':''}>${j}</option>`).join('')}
        </select>
        <span id="menu-lib-count" style="font-size:11px;color:var(--text-3);white-space:nowrap">${list.length} menu</span>
        <button class="btn btn-primary btn-sm" onclick="MenuModule.openMenuForm()">+ Tambah Menu</button>
      </div>

      <div id="menu-lib-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s3)">
        ${list.slice(0,100).map(m => _menuCard(m)).join('')}
      </div>
      ${list.length>100?`<div style="text-align:center;padding:var(--s4);color:var(--text-3);font-size:12px">Menampilkan 100 dari ${list.length} menu. Gunakan filter.</div>`:''}
    `;
  }

  function _extractHpp(m) {
    if (!m.resep) return 0;
    // Try multiple patterns to extract HPP value
    const patterns = [
      /HPP[^\d]*(?:Rp\.?\s*)([\d.,]+)/i,
      /per porsi[^\d]*(?:Rp\.?\s*)([\d.,]+)/i,
      /Rp\.?\s*([\d.,]+)\s*(?:\/|per)\s*porsi/i,
    ];
    for (const re of patterns) {
      const match = m.resep.match(re);
      if (match) { const v = parseInt(match[1].replace(/[.,]/g,'')); if (v > 0 && v < 100000) return v; }
    }
    return 0;
  }

  function _hppBadge(hpp, isPaketan) {
    if (!hpp) return '';
    const maxHpp = isPaketan ? 10000 : 6000;
    let sign, color, bg;
    if (hpp <= 2000)          { sign='$'; color='#10b981'; bg='rgba(16,185,129,.1)'; }
    else if (hpp <= 3500)     { sign='$$'; color='#22c55e'; bg='rgba(34,197,94,.1)'; }
    else if (hpp <= 5000)     { sign='$$$'; color='#f59e0b'; bg='rgba(245,158,11,.1)'; }
    else if (hpp <= maxHpp)   { sign='$$$$'; color='#f97316'; bg='rgba(249,115,22,.1)'; }
    else                      { sign='$$$$$'; color='#ef4444'; bg='rgba(239,68,68,.1)'; }
    return `<span title="HPP ~Rp ${hpp.toLocaleString('id')}/porsi" style="font-size:9px;font-weight:800;color:${color};background:${bg};padding:2px 6px;border-radius:var(--r-full);letter-spacing:1px">${sign}</span>`;
  }

  function _menuCard(m) {
    const katColor = {'Karbo':'#f59e0b','Lauk Kering':'#ef4444','Lauk Kuah':'#f97316','Pendamping':'#8b5cf6','Sayur':'#10b981','Sambel':'#ec4899','Buah':'#06b6d4','Minuman':'#3b82f6','Paketan':'#6366f1'}[m.klasifikasi]||'var(--text-3)';
    const hasResep = !!m.resep;
    const isPaketan = m.jenis==='Paketan' || m.klasifikasi==='Paketan';
    const hpp = _extractHpp(m);
    return `<div class="card" style="padding:var(--s3);cursor:pointer;transition:all .2s" onclick="MenuModule.openMenuDetail('${m.id}')"
      onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
      onmouseout="this.style.transform='';this.style.boxShadow='0 1px 4px rgba(0,0,0,.06)'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s2);gap:4px">
        <span style="font-size:14px;font-weight:700;color:var(--heading);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(m.nama)}</span>
        <div style="display:flex;gap:3px;align-items:center;flex-shrink:0">
          <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:var(--r-full);background:${katColor}18;color:${katColor}">${m.klasifikasi}</span>
          ${_hppBadge(hpp, isPaketan)}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:var(--s2);align-items:center">
        <span class="badge badge-primary" style="font-size:9px">${m.category}</span>
        <span class="badge badge-neutral" style="font-size:9px">${m.tema}</span>
        ${isPaketan&&m.klasifikasi!=='Paketan'?'<span class="badge badge-warning" style="font-size:9px">Paketan</span>':''}
        ${hasResep?'<span style="font-size:8px;font-weight:700;padding:1px 5px;border-radius:var(--r-full);background:var(--success-bg);color:var(--success)">\u2713 Resep</span>':''}
      </div>
      ${m.bahan?`<div style="font-size:11px;color:var(--text-2);max-height:36px;overflow:hidden;line-height:1.4">${_esc(m.bahan)}</div>`:''}
      <div style="display:flex;gap:4px;margin-top:var(--s2);align-items:center">
        ${hpp?`<span style="font-size:10px;font-weight:600;color:var(--text-3);font-family:var(--font-mono)">Rp ${hpp.toLocaleString('id')}/pax</span>`:''}
        ${!hasResep?`<button onclick="event.stopPropagation();MenuModule._aiResep('${m.id}')" style="background:none;border:1px solid var(--primary);border-radius:var(--r-full);padding:2px 8px;cursor:pointer;font-size:9px;font-weight:600;color:var(--primary-h);transition:all .15s" onmouseover="this.style.background='var(--primary-bg)'" onmouseout="this.style.background='none'"><span style="font-size:8px;padding:0 3px;border-radius:3px;background:var(--primary-bg);margin-right:2px">AI</span>Resep</button>`:''}
        <div style="flex:1"></div>
        <button class="btn-icon" style="width:24px;height:24px" onclick="event.stopPropagation();MenuModule.openMenuForm('${m.id}')" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" style="width:24px;height:24px;color:var(--danger)" onclick="event.stopPropagation();MenuModule.deleteMenu('${m.id}')" title="Hapus">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    </div>`;
  }

  let _libSearchTimer = null;
  function _libFilter(key, val) {
    if (key==='search') {
      _libSearch=val;
      // Debounce search — render setelah 200ms berhenti ketik
      clearTimeout(_libSearchTimer);
      _libSearchTimer = setTimeout(() => {
        _renderLibraryGrid();
      }, 200);
      return;
    }
    if (key==='kat') _libKat=val;
    else if (key==='cat') _libCat=val;
    else if (key==='tema') _libTema=val;
    else if (key==='jenis') _libJenis=val;
    _renderLibrary();
  }

  // Re-render hanya grid (bukan filter bar) — preserves search input focus
  function _renderLibraryGrid() {
    let list = _library.filter(m=>!m.archived);
    if (_libSearch) { const q=_libSearch.toLowerCase(); list=list.filter(m=>(m.nama||'').toLowerCase().includes(q)||(m.bahan||'').toLowerCase().includes(q)); }
    if (_libKat) list=list.filter(m=>m.klasifikasi===_libKat);
    if (_libCat) list=list.filter(m=>m.category===_libCat);
    if (_libTema) list=list.filter(m=>m.tema===_libTema);
    if (_libJenis) list=list.filter(m=>m.jenis===_libJenis);
    const grid = document.getElementById('menu-lib-grid');
    const count = document.getElementById('menu-lib-count');
    if (grid) grid.innerHTML = list.slice(0,100).map(m=>_menuCard(m)).join('') + (list.length>100?`<div style="text-align:center;padding:var(--s4);color:var(--text-3);font-size:12px;grid-column:1/-1">Menampilkan 100 dari ${list.length}. Gunakan filter.</div>`:'');
    if (count) count.textContent = list.length + ' menu';
  }

  function openMenuDetail(id) {
    const m = _library.find(x=>x.id===id);
    if (!m) return;
    const mid = 'menu-'+Date.now();
    Modal.open({id:mid, title:m.nama, size:'modal-lg',
      body:`
        <div style="display:flex;gap:var(--s2);flex-wrap:wrap;margin-bottom:var(--s4)">
          <span class="badge badge-primary">${m.category}</span>
          <span class="badge badge-neutral">${m.tema}</span>
          <span class="badge" style="background:${m.jenis==='Paketan'?'var(--warning-bg)':'var(--info-bg)'};color:${m.jenis==='Paketan'?'var(--warning)':'var(--info)'}">${m.jenis}</span>
          <span class="badge badge-neutral">${m.klasifikasi}</span>
        </div>
        ${m.bahan?`<div class="form-group"><label class="form-label">Bahan</label><div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap">${_esc(m.bahan)}</div></div>`:''}
        ${m.resep?`<div class="form-group">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s2)">
              <label class="form-label" style="margin:0">Resep</label>
              <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="Modal.close('${mid}');MenuModule._aiResep('${m.id}')"><span style="font-size:9px;padding:1px 5px;border-radius:var(--r-full);background:var(--primary-bg);color:var(--primary-h);font-weight:700;margin-right:3px">AI</span> Re-generate</button>
            </div>
            <div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap">${_esc(m.resep)}</div>
          </div>`
          :`<div style="text-align:center;padding:var(--s4);border:1px dashed var(--border);border-radius:var(--r-md);color:var(--text-3)">
            <p style="margin-bottom:var(--s3)">Resep belum tersedia</p>
            <button class="btn btn-primary btn-sm" onclick="Modal.close('${mid}');MenuModule._aiResep('${m.id}')"><span style="font-size:9px;padding:1px 5px;border-radius:var(--r-full);background:rgba(255,255,255,.2);margin-right:3px">AI</span> Generate Resep</button>
          </div>`}
        ${m.estimasiBahan?`<div style="font-size:11px;color:var(--text-3);margin-top:var(--s3)">Est. bahan mentah: ${m.estimasiBahan}</div>`:''}`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  /* ═══════════════════════════════════════════
     MENU GENERATOR
     ═══════════════════════════════════════════ */
  let _genWeekStart = '', _weekCustomers = [];
  let _genGroups = [];      // [[custId,...], ...] — tiap inner array = 1 tab
  let _genActiveGroup = 0;  // index tab aktif
  let _genPendingCusts = []; // pilihan sementara di dropdown sebelum diklik Tambah
  let _copyDestWeek = '';   // minggu tujuan di modal Salin ke...
  let _copySrcId = '';      // customer sumber di modal Salin ke...

  function _genAllCusts() { return _genGroups.flat(); }
  function _genGroupLabel(gi) {
    return (_genGroups[gi]||[]).map(id => { const c=_customers.find(x=>x.id===id); return c?.namaShort||c?.nama||id; }).join(', ');
  }
  function _genGroupPrimary(gi) { return _genGroups[gi]?.[0] || null; }

  function _getMonday() {
    const dt = new Date(); dt.setHours(12,0,0,0);
    const day = dt.getDay();
    dt.setDate(dt.getDate() + (day===0?-6:1-day));
    return dt.toISOString().slice(0,10);
  }

  function _fmtWeekPeriod(ws) {
    const MO = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const fmt = s => { const d=new Date(s+'T12:00:00'); return d.getDate()+' '+MO[d.getMonth()]; };
    const we = new Date(new Date(ws+'T12:00:00').getTime()+6*86400000);
    const weStr = we.getFullYear()+'-'+String(we.getMonth()+1).padStart(2,'0')+'-'+String(we.getDate()).padStart(2,'0');
    return fmt(ws)+' — '+fmt(weStr)+' '+new Date(ws+'T12:00:00').getFullYear();
  }

  function _renderGenerator() {
    const el = document.getElementById('menu-tab-generator');
    if (!el) return;
    if (!_genWeekStart) _genWeekStart = _getMonday();
    const canEdit = Auth.can('menu','edit');

    // Find or create plan for this week
    let plan = _plans.find(p=>p.weekStart===_genWeekStart);

    const _weekEnd = new Date(new Date(_genWeekStart+'T12:00:00').getTime() + 6*86400000);
    const _fmtPeriod = (s) => { const d=new Date(s+'T12:00:00'); return d.getDate()+' '+['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][d.getMonth()]+' '+d.getFullYear(); };
    const weekEndStr = _weekEnd.getFullYear()+'-'+String(_weekEnd.getMonth()+1).padStart(2,'0')+'-'+String(_weekEnd.getDate()).padStart(2,'0');

    // Hanya tampilkan customer yang punya order di minggu ini
    const weekOrderNames = new Set(
      _orders.filter(o => o.tglOrder >= _genWeekStart && o.tglOrder <= weekEndStr)
             .map(o => (o.namaPerusahaan||'').toLowerCase())
    );
    _weekCustomers = weekOrderNames.size
      ? _customers.filter(c => weekOrderNames.has((c.nama||'').toLowerCase()) || weekOrderNames.has((c.namaShort||'').toLowerCase()))
      : _customers;
    // Tutup dropdown lama jika ada (misal saat ganti minggu)
    document.getElementById('gen-cust-drop')?.remove();

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="MenuModule._genPrevWeek()">\u2039 Minggu Lalu</button>
        <button class="btn btn-ghost btn-sm" onclick="MenuModule._genThisWeek()">Minggu Ini</button>
        <button class="btn btn-ghost btn-sm" onclick="MenuModule._genNextWeek()">Minggu Depan \u203a</button>
        <div style="flex:1"></div>
        <span style="font-size:13px;font-weight:600;color:var(--heading);background:var(--surface);border:1px solid var(--border2);padding:6px 16px;border-radius:var(--r-full);box-shadow:var(--shadow-sm);display:inline-flex;align-items:center;gap:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          ${_fmtPeriod(_genWeekStart)} \u2014 ${_fmtPeriod(weekEndStr)}
        </span>
      </div>

      <!-- Customer selector + tabs -->
      <div class="card" style="margin-bottom:var(--s4);padding:var(--s3)">
        <div style="display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap;margin-bottom:${_genGroups.length?'var(--s3)':'0'}">
          <span style="font-size:12px;font-weight:600;color:var(--text-2)">Customer:</span>
          <button id="gen-cust-toggle" type="button" onclick="MenuModule._genToggleDrop(event)"
            style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;min-width:220px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface);cursor:pointer;font-size:12px;color:var(--text);text-align:left">
            <span id="gen-cust-label" style="flex:1">${_genPendingCusts.length ? _genPendingCusts.length+' dipilih' : 'Pilih customer'+(_weekCustomers.length<_customers.length?' ('+_weekCustomers.length+' ada order)':'')+'...'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12" style="flex-shrink:0;opacity:.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button type="button" data-gen-tambah class="btn btn-primary btn-sm" onclick="MenuModule._genAddCustomer()">Tambah</button>
          <div style="flex:1"></div>
          ${canEdit?`<span id="gen-save-status" style="font-size:11px;color:var(--text-3)"></span>`:''}
        </div>
        ${_genGroups.length ? `
          <!-- Tab row \u2014 tiap group = 1 tab, nama dipisah koma -->
          <div style="display:flex;gap:0;flex-wrap:wrap;border-bottom:2px solid var(--border)">
            ${_genGroups.map((group, gi) => {
              const label = _genGroupLabel(gi);
              const isActive = gi === _genActiveGroup;
              return `<div style="display:inline-flex;align-items:center;gap:5px;padding:7px 16px 6px;cursor:pointer;border-bottom:2px solid ${isActive?'var(--primary)':'transparent'};margin-bottom:-2px;transition:.15s;background:${isActive?'var(--primary-bg)':'transparent'}">
                <span onclick="MenuModule._genSwitchTab(${gi})" style="font-size:12px;font-weight:${isActive?'700':'500'};color:${isActive?'var(--primary-h)':'var(--text-2)'}">
                  ${_esc(label)}
                </span>
                <span onclick="MenuModule._genRemoveGroup(${gi})" style="font-size:11px;color:var(--text-3);cursor:pointer;line-height:1;padding:1px 2px;border-radius:3px" onmouseover="this.style.background='var(--surface2)';this.style.color='var(--danger)'" onmouseout="this.style.background='';this.style.color='var(--text-3)'">\u00d7</span>
              </div>`;
            }).join('')}
          </div>` : ''}
      </div>

      <!-- Weekly grid \u2014 hanya group aktif -->
      <div id="gen-content">
        ${!_genGroups.length
          ? '<div style="text-align:center;padding:var(--s8);color:var(--text-3)">Pilih customer untuk mulai membuat menu mingguan</div>'
          : _genCustomerBlock(_genGroupPrimary(_genActiveGroup), plan, _genGroupLabel(_genActiveGroup))}
      </div>
    `;

    // Clamp active group index
    if (_genGroups.length && _genActiveGroup >= _genGroups.length) _genActiveGroup = _genGroups.length - 1;
    if (_genActiveGroup < 0) _genActiveGroup = 0;

    // Load saved selection + plan (hanya sekali saat pertama kali)
    if (!_genGroups.length && (plan?.groups?.length || plan?.customers?.length)) {
      if (plan.groups?.length) {
        _genGroups = plan.groups;
      } else {
        // legacy: tiap customer jadi solo group
        _genGroups = plan.customers.map(cid => [cid]);
      }
      _genActiveGroup = 0;
      _renderGenerator();
    }
  }

  function _genCustomerBlock(custId, plan, groupLabel) {
    if (!custId) return '';
    const cust = _customers.find(c=>c.id===custId);
    if (!cust) return '';
    const displayName = groupLabel || cust.namaShort || cust.nama;
    // Customer-specific komposisi (default or custom)
    const komposisi = cust.menuKomposisi || [...DEFAULT_KOMPOSISI];
    const planData = plan?.data?.[custId] || {};

    return `<div class="card" style="margin-bottom:var(--s4);padding:0;overflow:hidden">
      <div style="padding:var(--s3) var(--s4);background:var(--thead-bg);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span style="font-size:14px;font-weight:700;color:var(--thead-text)">${_esc(displayName)}</span>
        <div style="display:flex;gap:var(--s2);flex-wrap:wrap">
          <button class="btn btn-sm" style="font-size:10px;background:rgba(99,102,241,.12);color:#6366f1;border:1px solid rgba(99,102,241,.3)" onclick="MenuModule._editKomposisi('${custId}')">Komposisi</button>
          <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="MenuModule._openCopyModal('${custId}')">Salin ke...</button>
          <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="MenuModule._printMenuPDF('${custId}')">PDF</button>
          <button class="btn btn-primary btn-sm" style="font-size:10px" onclick="MenuModule._aiGenerateMenu('${custId}')">AI Generate</button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:900px;font-size:12px">
          <thead>
            <tr style="background:var(--surface2)">
              <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--text-3);width:80px">SHIFT</th>
              ${DAYS.map((d,di)=>{
                const dt=new Date(new Date(_genWeekStart+'T12:00:00').getTime()+di*86400000);
                return `<th style="padding:6px 8px;text-align:center;font-size:10px;color:var(--text-3)">
                  <div>${d}</div>
                  <div style="font-size:9px;font-weight:400">${dt.getDate()}/${dt.getMonth()+1}</div>
                </th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${SHIFTS.map(shift => {
              const shiftData = planData[shift] || {};
              return `
                <tr style="border-top:2px solid var(--border)">
                  <td rowspan="${komposisi.length+1}" style="padding:6px 8px;font-weight:700;color:var(--primary-h);vertical-align:top;border-right:1px solid var(--border)">${shift}
                  </td>
                  ${DAYS.map((_,di) => {
                    const dayData = shiftData[di] || {};
                    return `<td style="padding:4px 6px;border-right:1px solid var(--border);vertical-align:top">
                      <input type="text" placeholder="Tema..." value="${_esc(dayData.tema||'')}"
                        style="width:100%;border:none;background:var(--primary-bg);border-radius:4px;padding:3px 6px;font-size:10px;font-weight:600;color:var(--primary-h);outline:none;text-align:center"
                        onchange="MenuModule._genSetCell('${custId}','${shift}',${di},'tema',this.value)">
                    </td>`;
                  }).join('')}
                </tr>
                ${komposisi.map(komp => `<tr>
                  ${DAYS.map((_,di) => {
                    const dayData = (planData[shift]||{})[di] || {};
                    const val = (dayData.menu||{})[komp] || '';
                    const dlId = 'menu-dl-' + komp.toLowerCase().replace(/\s+\d+$/,'').replace(/\s+/g,'-');
                    return `<td style="padding:2px 4px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)">
                      <div style="font-size:8px;color:var(--text-3);margin-bottom:1px">${komp}</div>
                      <input type="text" value="${_esc(val)}" placeholder="-"
                        style="width:100%;border:none;background:transparent;padding:2px 4px;font-size:11px;color:var(--text);outline:none;font-family:var(--font)"
                        onfocus="this.style.background='var(--surface2)'" onblur="this.style.background='transparent'"
                        onchange="MenuModule._genSetCell('${custId}','${shift}',${di},'${komp}',this.value)"
                        list="${dlId}">
                    </td>`;
                  }).join('')}
                </tr>`).join('')}
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <!-- Datalist per komposisi untuk autocomplete yang terfilter -->
      ${[...new Set(komposisi.map(k=>k.replace(/\s+\d+$/,'')))].map(base => {
        const dlId = 'menu-dl-' + base.toLowerCase().replace(/\s+/g,'-');
        const matches = _library.filter(m => !m.archived && _kompMatchKlas(base, m.klasifikasi));
        return `<datalist id="${dlId}">${matches.map(m=>`<option value="${_esc(m.nama)}">`).join('')}</datalist>`;
      }).join('')}
    </div>`;
  }

  function _kompMatchKlas(komp, klasifikasi) {
    const k = (komp || '').toLowerCase().replace(/\s+\d+$/, '').trim();
    const kl = (klasifikasi || '').toLowerCase();
    if (k === 'lauk') return kl === 'lauk kering' || kl === 'lauk kuah';
    if (k === 'karbo') return kl === 'karbo';
    if (k === 'pendamping') return kl === 'pendamping';
    if (k === 'sayur') return kl === 'sayur';
    if (k === 'sambel') return kl === 'sambel';
    if (k === 'buah') return kl === 'buah';
    if (k === 'minuman') return kl === 'minuman';
    if (k === 'paketan') return kl === 'paketan';
    // Fallback untuk komposisi custom: coba exact match klasifikasi
    return kl === k || kl.startsWith(k);
  }

  // Cell edit + auto-save
  let _pendingPlan = null;
  let _autoSaveTimer = null;
  let _autoSaving = false;

  function _genSetCell(custId, shift, dayIdx, field, value) {
    if (!_pendingPlan) {
      const existing = _plans.find(p=>p.weekStart===_genWeekStart);
      _pendingPlan = existing ? {...existing, data:{...existing.data}} : {id:Utils.uid(), weekStart:_genWeekStart, groups:_genGroups, customers:_genAllCusts(), data:{}};
    }
    if (!_pendingPlan.data[custId]) _pendingPlan.data[custId] = {};
    if (!_pendingPlan.data[custId][shift]) _pendingPlan.data[custId][shift] = {};
    if (!_pendingPlan.data[custId][shift][dayIdx]) _pendingPlan.data[custId][shift][dayIdx] = {tema:'',menu:{}};
    if (field==='tema') _pendingPlan.data[custId][shift][dayIdx].tema = value;
    else _pendingPlan.data[custId][shift][dayIdx].menu[field] = value;
    _pendingPlan.groups = _genGroups;
    _pendingPlan.customers = _genAllCusts();
    // Auto-save 1.5s setelah berhenti mengetik
    _genSetSaveStatus('...');
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(_genAutoSave, 1500);
  }

  function _genSetSaveStatus(msg, color) {
    const el = document.getElementById('gen-save-status');
    if (el) { el.textContent = msg; el.style.color = color || 'var(--text-3)'; }
  }

  async function _doSavePlan() {
    if (!_pendingPlan) return;
    _genGroups.forEach(group => {
      const primary = group[0];
      if (!primary || group.length < 2) return;
      const src = _pendingPlan.data[primary];
      if (!src) return;
      group.slice(1).forEach(id => { _pendingPlan.data[id] = JSON.parse(JSON.stringify(src)); });
    });
    _pendingPlan.groups = _genGroups;
    _pendingPlan.customers = _genAllCusts();
    _pendingPlan.updatedAt = new Date().toISOString();
    _pendingPlan.updatedBy = Auth.currentUser()?.nama||'';
    await DB.saveMenuPlan(_pendingPlan);
    const idx = _plans.findIndex(p=>p.id===_pendingPlan.id);
    if (idx>=0) _plans[idx]=_pendingPlan; else _plans.push(_pendingPlan);
  }

  async function _genAutoSave() {
    if (!_pendingPlan || _autoSaving) return;
    _autoSaving = true;
    _genSetSaveStatus('Menyimpan...');
    try {
      await _doSavePlan();
      _genSetSaveStatus('✓ Tersimpan', 'var(--success)');
    } catch(e) {
      _genSetSaveStatus('⚠ Gagal simpan', 'var(--danger)');
      console.error('[Menu] auto-save error:', e);
    } finally { _autoSaving = false; }
  }

  async function _genSave() {
    if (!_pendingPlan) { Notify.info('Belum ada perubahan'); return; }
    clearTimeout(_autoSaveTimer);
    _genSetSaveStatus('Menyimpan...');
    try {
      await _doSavePlan();
      Notify.success('Menu plan disimpan');
      _genSetSaveStatus('✓ Tersimpan', 'var(--success)');
    } catch(e) { Notify.error('Gagal: '+e.message); _genSetSaveStatus('⚠ Gagal', 'var(--danger)'); }
  }

  let _genDropClickHandler = null;

  function _genToggleDrop(e) {
    e.stopPropagation();
    const toggle = document.getElementById('gen-cust-toggle');
    const existing = document.getElementById('gen-cust-drop');
    if (existing) {
      existing.remove();
      if (toggle) toggle.style.borderColor = 'var(--border)';
      if (_genDropClickHandler) { document.removeEventListener('click', _genDropClickHandler); _genDropClickHandler = null; }
      return;
    }
    const rect = toggle.getBoundingClientRect();
    const drop = document.createElement('div');
    drop.id = 'gen-cust-drop';
    drop.style.cssText = `position:fixed;top:${rect.bottom+4}px;left:${rect.left}px;z-index:9999;
      background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-md);
      padding:6px;min-width:${Math.max(280, rect.width)}px;max-height:300px;overflow-y:auto;
      box-shadow:0 8px 24px rgba(0,0,0,.18)`;
    drop.innerHTML = `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r-sm);cursor:pointer;font-size:12px;font-weight:600;color:var(--text-2);border-bottom:1px solid var(--border);margin-bottom:4px"
        onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <input type="checkbox" id="gen-cust-all" onchange="MenuModule._genToggleAllCust(this.checked)" style="width:14px;height:14px;cursor:pointer">
        Pilih Semua (${_weekCustomers.length})
      </label>
      ${_weekCustomers.map(c => {
        const inUse = _genAllCusts().includes(c.id);
        return `<label class="gen-cust-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r-sm);cursor:pointer;transition:.1s"
          onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
          <input type="checkbox" class="gen-cust-cb" value="${_esc(c.id)}"
            ${inUse?'disabled title="Sudah di tab"':''}
            ${_genPendingCusts.includes(c.id)?'checked':''}
            onchange="MenuModule._genCbChange(this)"
            style="width:14px;height:14px;cursor:pointer;flex-shrink:0">
          <span style="font-size:12px;font-weight:600;color:${inUse?'var(--text-3)':'var(--text)'}">${_esc(c.namaShort||c.nama)}</span>
          ${inUse?'<span style="font-size:9px;color:var(--text-3);margin-left:auto">✓ Aktif</span>':''}
        </label>`;
      }).join('')}`;
    document.body.appendChild(drop);
    if (toggle) toggle.style.borderColor = 'var(--primary)';
    _genDropClickHandler = (ev) => {
      // Jangan tutup dropdown saat klik Tambah — cek apakah target adalah tombol Tambah
      const tambahBtn = document.querySelector('[data-gen-tambah]');
      if (tambahBtn?.contains(ev.target)) return;
      if (!drop.contains(ev.target) && !toggle?.contains(ev.target)) {
        drop.remove();
        if (toggle) toggle.style.borderColor = 'var(--border)';
        document.removeEventListener('click', _genDropClickHandler);
        _genDropClickHandler = null;
      }
    };
    setTimeout(() => document.addEventListener('click', _genDropClickHandler), 10);
  }

  function _genCbChange(cb) {
    const cid = cb.value;
    if (cb.checked) { if (!_genPendingCusts.includes(cid)) _genPendingCusts.push(cid); }
    else { _genPendingCusts = _genPendingCusts.filter(x=>x!==cid); }
    _genUpdateDropLabel();
  }

  function _genToggleAllCust(checked) {
    document.querySelectorAll('.gen-cust-cb:not(:disabled)').forEach(cb => {
      cb.checked = checked;
      const cid = cb.value;
      if (checked && !_genPendingCusts.includes(cid)) _genPendingCusts.push(cid);
    });
    if (!checked) _genPendingCusts = [];
    _genUpdateDropLabel();
  }

  function _genUpdateDropLabel() {
    const n = _genPendingCusts.length;
    const lbl = document.getElementById('gen-cust-label');
    if (lbl) lbl.textContent = n ? n+' dipilih' : 'Pilih customer'+(_weekCustomers.length<_customers.length?' ('+_weekCustomers.length+' ada order)':'')+'...';
    const all = document.getElementById('gen-cust-all');
    const total = _weekCustomers.filter(c=>!_genAllCusts().includes(c.id)).length;
    if (all) { all.checked = n>0 && n===total; all.indeterminate = n>0 && n<total; }
  }

  function _genAddCustomer() {
    if (!_genPendingCusts.length) return;
    const allExisting = _genAllCusts();
    const newCusts = _genPendingCusts.filter(id => !allExisting.includes(id));
    _genPendingCusts = [];
    document.getElementById('gen-cust-drop')?.remove();
    if (_genDropClickHandler) { document.removeEventListener('click', _genDropClickHandler); _genDropClickHandler = null; }
    if (!newCusts.length) return;
    _genGroups.push(newCusts); // semua yang dipilih bersamaan = 1 group = 1 tab
    _genActiveGroup = _genGroups.length - 1;
    _renderGenerator();
  }

  function _genRemoveGroup(gi) {
    const group = _genGroups[gi];
    if (!group) return;
    const label = _genGroupLabel(gi);
    const mid = 'rm-tab-' + Date.now();
    Modal.open({
      id: mid,
      title: 'Hapus Tab?',
      size: 'modal-sm',
      body: `<p style="font-size:13px;color:var(--text)">Hapus tab <strong>${_esc(label)}</strong>?</p>
        <p style="font-size:12px;color:var(--text-3);margin-top:6px">Data menu yang belum disimpan pada tab ini akan hilang. Aksi ini dapat dibatalkan sesaat setelah penghapusan.</p>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-danger" onclick="Modal.close('${mid}');MenuModule._doRemoveGroup(${gi})">Hapus</button>`,
    });
  }

  function _doRemoveGroup(gi) {
    const group = _genGroups[gi];
    if (!group) return;
    const label = _genGroupLabel(gi);
    const prevActiveGroup = _genActiveGroup;
    // Simpan snapshot untuk undo
    const snapshot = { group: [...group], gi, prevActiveGroup };
    _genGroups.splice(gi, 1);
    if (_genActiveGroup >= _genGroups.length) _genActiveGroup = Math.max(0, _genGroups.length - 1);
    _renderGenerator();
    Notify.undo('Tab "' + label + '" dihapus', () => {
      // Restore group ke posisi semula
      _genGroups.splice(snapshot.gi, 0, snapshot.group);
      _genActiveGroup = snapshot.prevActiveGroup;
      _renderGenerator();
    });
  }

  function _genSwitchTab(gi) {
    _genActiveGroup = gi;
    _renderGenerator();
  }
  function _genPrevWeek() { clearTimeout(_autoSaveTimer); const d=new Date(_genWeekStart+'T12:00:00'); d.setDate(d.getDate()-7); _genWeekStart=d.toISOString().slice(0,10); _pendingPlan=null; _genGroups=[]; _genActiveGroup=0; _renderGenerator(); }
  function _genNextWeek() { clearTimeout(_autoSaveTimer); const d=new Date(_genWeekStart+'T12:00:00'); d.setDate(d.getDate()+7); _genWeekStart=d.toISOString().slice(0,10); _pendingPlan=null; _genGroups=[]; _genActiveGroup=0; _renderGenerator(); }
  function _genThisWeek() { clearTimeout(_autoSaveTimer); _genWeekStart=_getMonday(); _pendingPlan=null; _genGroups=[]; _genActiveGroup=0; _renderGenerator(); }

  /* ═══ PDF PRINT ═══ */
  function _printMenuPDF(custId) {
    const cust = _customers.find(c=>c.id===custId);
    if (!cust) return;
    // Cari label group (bisa berisi nama banyak customer jika tab gabungan)
    const groupIdx = _genGroups.findIndex(g => g[0] === custId);
    const custName = groupIdx >= 0 ? _genGroupLabel(groupIdx) : (cust.namaShort || cust.nama);
    const komposisi = cust.menuKomposisi || [...DEFAULT_KOMPOSISI];
    const savedPlan = _plans.find(p=>p.weekStart===_genWeekStart);
    const activePlan = (_pendingPlan?.weekStart===_genWeekStart) ? _pendingPlan : savedPlan;
    const planData = activePlan?.data?.[custId] || {};

    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const _fmtDate = (s) => { const d=new Date(s+'T12:00:00'); return d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear(); };
    const weekEnd = new Date(new Date(_genWeekStart+'T12:00:00').getTime()+6*86400000);
    const weekEndStr = weekEnd.getFullYear()+'-'+String(weekEnd.getMonth()+1).padStart(2,'0')+'-'+String(weekEnd.getDate()).padStart(2,'0');
    const period = _fmtDate(_genWeekStart)+' — '+_fmtDate(weekEndStr);

    const shiftColors = { S1:'#6366f1', S2:'#0891b2', S3:'#059669' };

    const tableRows = SHIFTS.map(shift => {
      const shiftData = planData[shift] || {};
      const temaRow = `<tr>
        <td rowspan="${komposisi.length+1}" style="padding:6px 10px;font-weight:800;font-size:13px;color:${shiftColors[shift]||'#374151'};vertical-align:top;border-right:1px solid #e5e7eb;border-top:2px solid #d1d5db;white-space:nowrap">${shift}</td>
        ${DAYS.map((_,di) => {
          const tema = (shiftData[di]||{}).tema || '';
          return `<td style="padding:5px 8px;border-right:1px solid #e5e7eb;border-top:2px solid #d1d5db;text-align:center;font-size:10px;font-weight:700;color:${shiftColors[shift]||'#374151'};background:#f8fafc">${_esc(tema)}</td>`;
        }).join('')}
      </tr>`;
      const kompRows = komposisi.map(komp => `<tr>
        ${DAYS.map((_,di) => {
          const val = ((shiftData[di]||{}).menu||{})[komp] || '';
          return `<td style="padding:4px 8px;border-right:1px solid #e5e7eb;border-bottom:1px solid #f3f4f6;font-size:11px;vertical-align:top">
            <div style="font-size:9px;color:#9ca3af;margin-bottom:2px">${_esc(komp)}</div>
            <div style="color:#1f2937">${_esc(val)||'<span style="color:#d1d5db">—</span>'}</div>
          </td>`;
        }).join('')}
      </tr>`).join('');
      return temaRow + kompRows;
    }).join('');

    const dayHeaders = DAYS.map((d,di) => {
      const dt = new Date(new Date(_genWeekStart+'T12:00:00').getTime()+di*86400000);
      return `<th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#374151;border-right:1px solid #e5e7eb;min-width:90px">
        <div>${d}</div>
        <div style="font-size:10px;font-weight:400;color:#6b7280">${dt.getDate()}/${dt.getMonth()+1}</div>
      </th>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
      <title>Menu ${custName} — ${period}</title>
      <style>
        @page { size: A3 landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Segoe UI', sans-serif; margin: 0; color: #1f2937; background: #fff; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; }
        td, th { border: none; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #6366f1">
        <div>
          <div style="font-size:22px;font-weight:900;color:#6366f1">MENU MINGGUAN</div>
          <div style="font-size:16px;font-weight:700;color:#1f2937;margin-top:2px">${_esc(custName)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${period}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#9ca3af">
          <div>BECCA Catering Management</div>
          <div>Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="padding:8px;text-align:left;font-size:11px;font-weight:700;color:#374151;border-right:1px solid #e5e7eb;width:48px">SHIFT</th>
            ${dayHeaders}
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { Notify.warning('Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  /* ═══ COPY TO OTHER CUSTOMERS ═══ */
  function _openCopyModal(srcId) {
    const src = _customers.find(c=>c.id===srcId);
    if (!src) return;
    const srcName = src.namaShort || src.nama;
    const savedPlan = _plans.find(p=>p.weekStart===_genWeekStart);
    const activePlan = (_pendingPlan?.weekStart===_genWeekStart) ? _pendingPlan : savedPlan;
    const srcData = activePlan?.data?.[srcId];
    if (!srcData) { Notify.warning('Menu '+srcName+' belum ada isi. Isi dulu sebelum menyalin.'); return; }

    _copyDestWeek = _genWeekStart;
    _copySrcId = srcId;

    const mid = 'copy-menu-'+Date.now();
    Modal.open({ id:mid, title:'Salin Menu — '+_esc(srcName), size:'modal-md',
      body:`
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:var(--s3);padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm)">
          <button class="btn btn-ghost btn-sm" onclick="MenuModule._copyWeekNav(-1,'${mid}')" style="flex-shrink:0">‹</button>
          <span id="copy-week-lbl" style="flex:1;text-align:center;font-size:12px;font-weight:600;color:var(--text)"></span>
          <button class="btn btn-ghost btn-sm" onclick="MenuModule._copyWeekNav(1,'${mid}')" style="flex-shrink:0">›</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s2)">
          <span id="copy-cust-avail" style="font-size:11px;font-weight:600;color:var(--text-2)"></span>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="MenuModule._copyCheckAll('${mid}',true)">Pilih Semua</button>
            <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="MenuModule._copyCheckAll('${mid}',false)">Batal Semua</button>
          </div>
        </div>
        <div id="copy-cust-list" style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto"></div>`,
      footer:`<div style="display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap;width:100%">
        <span id="copy-count" style="font-size:11px;color:var(--text-3)">0 dipilih</span>
        <label id="copy-merge-wrap" style="display:none;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--text-2);padding:4px 10px;border:1px solid var(--border);border-radius:var(--r-full);background:var(--surface2)">
          <input type="checkbox" id="copy-merge" style="width:13px;height:13px;cursor:pointer">
          Gabungkan jadi 1 tab
        </label>
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="MenuModule._doCopyMenu('${srcId}','${mid}')">Salin</button>
      </div>`,
      onOpen: () => _renderCopyList(mid),
    });
  }

  function _renderCopyList(mid) {
    const lbl = document.getElementById('copy-week-lbl');
    if (lbl) lbl.textContent = _fmtWeekPeriod(_copyDestWeek);

    const we = new Date(new Date(_copyDestWeek+'T12:00:00').getTime()+6*86400000);
    const weStr = we.getFullYear()+'-'+String(we.getMonth()+1).padStart(2,'0')+'-'+String(we.getDate()).padStart(2,'0');
    const orderNames = new Set(
      _orders.filter(o=>o.tglOrder>=_copyDestWeek&&o.tglOrder<=weStr)
             .map(o=>(o.namaPerusahaan||'').toLowerCase())
    );
    const eligible = _customers.filter(c =>
      c.id !== _copySrcId &&
      (orderNames.has((c.nama||'').toLowerCase()) || orderNames.has((c.namaShort||'').toLowerCase()))
    );

    const avail = document.getElementById('copy-cust-avail');
    if (avail) avail.textContent = eligible.length ? eligible.length+' customer ada orderan' : 'Tidak ada customer dengan orderan';

    const el = document.getElementById('copy-cust-list');
    if (!el) return;
    if (!eligible.length) {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-3);font-size:12px">Tidak ada customer dengan orderan di periode ini</div>';
      const countEl=document.getElementById('copy-count'); if(countEl) countEl.textContent='0 dipilih';
      const mw=document.getElementById('copy-merge-wrap'); if(mw) mw.style.display='none';
      return;
    }
    el.innerHTML = eligible.map(c=>`
      <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer;transition:.1s"
        onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <input type="checkbox" class="copy-cust-cb" value="${c.id}" style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
        <span style="font-size:13px;font-weight:600;color:var(--text)">${_esc(c.namaShort||c.nama)}</span>
        ${c.namaShort&&c.nama!==c.namaShort?`<span style="font-size:10px;color:var(--text-3)">${_esc(c.nama)}</span>`:''}
      </label>`).join('');
    const _upd = () => {
      const n=document.querySelectorAll('.copy-cust-cb:checked').length;
      const ce=document.getElementById('copy-count'); if(ce) ce.textContent=n+' dipilih';
      const mw=document.getElementById('copy-merge-wrap'); if(mw) mw.style.display=n>=2?'flex':'none';
    };
    document.querySelectorAll('.copy-cust-cb').forEach(cb=>cb.addEventListener('change',_upd));
    const ce=document.getElementById('copy-count'); if(ce) ce.textContent='0 dipilih';
    const mw=document.getElementById('copy-merge-wrap'); if(mw) mw.style.display='none';
  }

  function _copyWeekNav(dir, mid) {
    const d=new Date(_copyDestWeek+'T12:00:00'); d.setDate(d.getDate()+dir*7);
    _copyDestWeek=d.toISOString().slice(0,10);
    _renderCopyList(mid);
  }

  function _copyCheckAll(mid, check) {
    document.querySelectorAll('.copy-cust-cb').forEach(cb=>{cb.checked=check;});
    const n=check?document.querySelectorAll('.copy-cust-cb').length:0;
    const el=document.getElementById('copy-count'); if(el) el.textContent=n+' dipilih';
    const mw=document.getElementById('copy-merge-wrap'); if(mw) mw.style.display=n>=2?'flex':'none';
  }

  async function _doCopyMenu(srcId, modalId) {
    const destIds=[...document.querySelectorAll('.copy-cust-cb:checked')].map(cb=>cb.value);
    if (!destIds.length) { Notify.warning('Pilih minimal satu customer tujuan.'); return; }

    const savedPlan=_plans.find(p=>p.weekStart===_genWeekStart);
    const activePlan=(_pendingPlan?.weekStart===_genWeekStart)?_pendingPlan:savedPlan;
    const srcData=activePlan?.data?.[srcId];
    if (!srcData) { Notify.warning('Data menu sumber tidak ditemukan.'); return; }

    const names=destIds.map(id=>{const c=_customers.find(x=>x.id===id);return c?.namaShort||c?.nama||id;}).join(', ');
    const gabung=document.getElementById('copy-merge')?.checked&&destIds.length>=2;

    // Salin ke minggu berbeda — simpan langsung ke DB
    if (_copyDestWeek !== _genWeekStart) {
      let destPlan=_plans.find(p=>p.weekStart===_copyDestWeek);
      destPlan=destPlan?{...destPlan,data:{...destPlan.data}}:{id:Utils.uid(),weekStart:_copyDestWeek,groups:[],customers:[],data:{}};
      destIds.forEach(dId=>{destPlan.data[dId]=JSON.parse(JSON.stringify(srcData));});
      const existing=destPlan.groups.flat();
      const newIds=destIds.filter(id=>!existing.includes(id));
      if (gabung&&newIds.length) destPlan.groups.push(newIds);
      else newIds.forEach(dId=>destPlan.groups.push([dId]));
      destPlan.customers=destPlan.groups.flat();
      try {
        await DB.saveMenuPlan(destPlan);
        const idx=_plans.findIndex(p=>p.weekStart===_copyDestWeek);
        if (idx>=0) _plans[idx]=destPlan; else _plans.push(destPlan);
        Modal.close(modalId);
        Notify.success('Menu disalin ke '+names+' ('+_fmtWeekPeriod(_copyDestWeek)+'). Tersimpan.');
      } catch(e) { Notify.error('Gagal menyimpan: '+(e.message||'')); }
      return;
    }

    // Salin ke minggu yang sama — gunakan _pendingPlan
    if (!_pendingPlan) {
      _pendingPlan=activePlan?{...activePlan,data:{...activePlan.data}}:{id:Utils.uid(),weekStart:_genWeekStart,groups:_genGroups,customers:_genAllCusts(),data:{}};
    }
    const allExisting=_genAllCusts();
    const newIds=destIds.filter(id=>!allExisting.includes(id));
    destIds.forEach(dId=>{_pendingPlan.data[dId]=JSON.parse(JSON.stringify(srcData));});
    if (gabung) { if (newIds.length) _genGroups.push(newIds); }
    else { newIds.forEach(dId=>_genGroups.push([dId])); }
    _pendingPlan.groups=_genGroups;
    _pendingPlan.customers=_genAllCusts();
    Modal.close(modalId);
    _renderGenerator();
    const info=gabung&&newIds.length>=2?' (digabung 1 tab)':'';
    Notify.success('Menu disalin ke: '+names+info+'. Klik Simpan untuk menyimpan.');
  }

  function _editKomposisi(custId) {
    const cust = _customers.find(c=>c.id===custId);
    if (!cust) return;
    const current = cust.menuKomposisi || [...DEFAULT_KOMPOSISI];
    const mid = 'komp-'+Date.now();
    Modal.open({id:mid, title:'Komposisi Menu: '+(cust.namaShort||cust.nama), size:'modal-md',
      body:`
        <style>
          .komp-row{display:flex;align-items:center;gap:var(--s2);margin-bottom:4px;padding:6px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);cursor:grab;transition:background .15s}
          .komp-row:active{cursor:grabbing;background:var(--primary-bg);border-color:var(--primary)}
          .komp-row.drag-over{border-top:2px solid var(--primary)}
        </style>
        <p style="font-size:12px;color:var(--text-2);margin-bottom:var(--s3)">Drag untuk ubah urutan. Tambah/hapus sesuai kebutuhan.</p>
        <div id="komp-list">
          ${current.map(k => { const base = k.replace(/\s+\d+$/,''); const inOpts = KOMP_OPTIONS.includes(base); return `<div class="komp-row" draggable="true" ondragstart="MenuModule._kompDragStart(event,this)" ondragover="MenuModule._kompDragOver(event,this)" ondragleave="this.classList.remove('drag-over')" ondrop="MenuModule._kompDrop(event,this)" ondragend="MenuModule._kompDragEnd()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="flex-shrink:0;opacity:.3"><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>
            <select class="form-control komp-input" style="flex:1;min-height:30px;font-size:13px">
              ${KOMP_OPTIONS.map(o=>`<option value="${o}"${base===o?' selected':''}>${o}</option>`).join('')}
              ${!inOpts?`<option value="${_esc(base)}" selected>${_esc(base)}</option>`:''}
            </select>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;flex-shrink:0">\u00d7</button>
          </div>`; }).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:var(--s2)" onclick="MenuModule._kompAdd()">+ Tambah Komponen</button>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="MenuModule._saveKomposisi('${custId}','${mid}')">Simpan</button>`,
    });
  }

  function _autoNumberKomposisi(arr) {
    const count = {};
    arr.forEach(v => { count[v] = (count[v]||0)+1; });
    const seen = {};
    return arr.map(v => {
      if (count[v] <= 1) return v;
      seen[v] = (seen[v]||0)+1;
      return v + ' ' + seen[v];
    });
  }

  async function _saveKomposisi(custId, modalId) {
    const inputs = document.querySelectorAll('.komp-input');
    const raw = [...inputs].map(i=>(i.value||'').trim()).filter(Boolean);
    const komposisi = _autoNumberKomposisi(raw);
    const cust = _customers.find(c=>c.id===custId);
    if (cust) {
      cust.menuKomposisi = komposisi;
      await DB.saveCustomer(cust).catch(()=>{});
    }
    Modal.close(modalId);
    _renderGenerator();
    Notify.success('Komposisi disimpan');
  }

  /* ═══ KOMPOSISI DRAG & DROP ═══ */
  let _kompDragging = null;
  function _kompDragStart(e, el) { _kompDragging=el; el.style.opacity='.5'; e.dataTransfer.effectAllowed='move'; }
  function _kompDragOver(e, el) { e.preventDefault(); e.dataTransfer.dropEffect='move'; document.querySelectorAll('.komp-row').forEach(r=>r.classList.remove('drag-over')); el.classList.add('drag-over'); }
  function _kompDrop(e, el) { e.preventDefault(); el.classList.remove('drag-over'); if(_kompDragging&&_kompDragging!==el) { const list=document.getElementById('komp-list'); list.insertBefore(_kompDragging,el); } }
  function _kompDragEnd() { if(_kompDragging) _kompDragging.style.opacity='1'; _kompDragging=null; document.querySelectorAll('.komp-row').forEach(r=>r.classList.remove('drag-over')); }
  function _kompAdd() {
    const list=document.getElementById('komp-list');
    if(!list) return;
    const div=document.createElement('div');
    div.className='komp-row'; div.draggable=true;
    div.setAttribute('ondragstart','MenuModule._kompDragStart(event,this)');
    div.setAttribute('ondragover','MenuModule._kompDragOver(event,this)');
    div.setAttribute('ondragleave',"this.classList.remove('drag-over')");
    div.setAttribute('ondrop','MenuModule._kompDrop(event,this)');
    div.setAttribute('ondragend','MenuModule._kompDragEnd()');
    div.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="flex-shrink:0;opacity:.3"><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>
      <select class="form-control komp-input" style="flex:1;min-height:30px;font-size:13px">
        <option value="">-- Pilih komponen --</option>
        ${KOMP_OPTIONS.map(o=>`<option value="${o}">${o}</option>`).join('')}
      </select>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;flex-shrink:0">\u00d7</button>`;
    list.appendChild(div);
    div.querySelector('select').focus();
  }

  /* ═══ AI INTEGRATION — Google Gemini API ═══ */
  async function _getApiKey() {
    const settings = await DB.getSettings().catch(()=>({}));
    return settings.geminiApiKey || '';
  }

  // Retry same model first (503 is often temporary), then fallback
  const _GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];

  async function _callGemini(prompt) {
    const apiKey = await _getApiKey();
    if (!apiKey) { Notify.error('API Key Gemini belum diisi. Buka Settings \u2192 Pengaturan Umum.'); return null; }
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const model = _GEMINI_MODELS[Math.min(attempt, _GEMINI_MODELS.length - 1)];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (res.status === 403 || res.status === 401) {
          Notify.error('API key Gemini tidak valid. Cek di Settings.');
          return null;
        }
        if (res.status === 429 || res.status === 503 || res.status === 500 || res.status === 404) {
          console.warn(`[AI] ${model} error (${res.status}), retry ${attempt+1}/${MAX_RETRIES}...`);
          if (attempt < MAX_RETRIES - 1) {
            Notify.info(`AI sibuk, mencoba model lain...`);
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
          Notify.error('AI sedang sibuk — coba lagi nanti');
          return null;
        }
        if (!res.ok) {
          const err = await res.text();
          console.error('[AI]', err);
          Notify.error('AI error: ' + res.status);
          return null;
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
      } catch(e) {
        if (attempt < MAX_RETRIES - 1) { await new Promise(r => setTimeout(r, 1000)); continue; }
        Notify.error('Gagal menghubungi AI: ' + e.message);
        return null;
      }
    }
    return null;
  }

  async function _aiGenerateMenu(custId) {
    const cust = _customers.find(c=>c.id===custId);
    if (!cust) return;
    const komposisi = cust.menuKomposisi || [...DEFAULT_KOMPOSISI];
    const custName = cust.namaShort || cust.nama;

    const menuByKat = {};
    _library.forEach(m => { if(!menuByKat[m.klasifikasi]) menuByKat[m.klasifikasi]=[]; if(menuByKat[m.klasifikasi].length<25) menuByKat[m.klasifikasi].push(m.nama); });

    const prompt = `Buatkan menu catering untuk "${custName}" selama 7 hari (Senin-Minggu), 3 shift (S1, S2, S3).
Komposisi per shift: ${komposisi.join(', ')}.
Menu TIDAK BOLEH berulang dalam seminggu.
Tiap hari beri tema masakan daerah Indonesia yang berbeda.
Pilih dari menu berikut:
${Object.entries(menuByKat).map(([k,items])=>`${k}: ${items.join(', ')}`).join('\n')}

PENTING: Output HANYA JSON valid, tanpa markdown, tanpa penjelasan.
Format: {"S1":{"0":{"tema":"...","menu":{"${komposisi.join('":"...","')}":"..."}},"1":{...},...},"S2":{...},"S3":{...}}
Key hari: 0=Senin, 1=Selasa, ..., 6=Minggu.`;

    Notify.info('AI sedang membuat menu ' + custName + '...');
    const result = await _callGemini(prompt);
    if (!result) return;

    try {
      const jsonStr = result.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
      const parsed = JSON.parse(jsonStr);
      if (!_pendingPlan) {
        const existing = _plans.find(p=>p.weekStart===_genWeekStart);
        _pendingPlan = existing ? {...existing, data:{...existing.data}} : {id:Utils.uid(), weekStart:_genWeekStart, groups:_genGroups, customers:_genAllCusts(), data:{}};
      }
      _pendingPlan.data[custId] = parsed;
      _pendingPlan.groups = _genGroups;
      _pendingPlan.customers = _genAllCusts();
      _renderGenerator();
      Notify.success('\u2713 Menu AI diterapkan! Klik Simpan untuk menyimpan.');
    } catch(e) { Notify.error('AI response bukan JSON valid: '+e.message); if(window.BECCA_DEBUG) console.log('Raw AI:', result); }
  }

  async function _aiResep(menuId) {
    const m = _library.find(x=>x.id===menuId);
    if (!m) return;
    const mid = 'ai-resep-'+Date.now();
    Modal.open({id:mid, title:'<span style="display:inline-flex;align-items:center;gap:6px">AI Resep: '+_esc(m.nama)+' <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:var(--r-full);background:var(--primary-bg);color:var(--primary-h)">AI</span></span>', size:'modal-lg',
      body:`<div id="ai-resep-body" style="text-align:center;padding:var(--s8);color:var(--text-3)">
        <img loading="lazy" decoding="async" src="/img/logo-bps.png" style="width:48px;height:48px;margin-bottom:var(--s3);animation:pulse 1.5s ease-in-out infinite" onerror="this.style.display='none'">
        <div>Generating resep untuk <strong>${_esc(m.nama)}</strong>...</div>
        <div style="font-size:11px;margin-top:var(--s2);color:var(--primary-h)">Menggunakan Google Gemini AI</div>
      </div><style>@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.05)}}</style>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });

    const prompt = `Berikan resep lengkap untuk "${m.nama}" (masakan ${m.category}, tema ${m.tema}).
Untuk 100 porsi catering massal.

PENTING: Ini untuk catering industri dengan budget ketat.
- HPP MAKSIMAL Rp 6.000 per porsi (rekomendasi Rp 1.500 - Rp 4.000)
- Harga jual 1 set komposisi lengkap hanya Rp 15.000-20.000
- Gunakan bahan yang murah dan mudah didapat di pasar tradisional
- Lauk bahan mentah di bawah Rp 150.000/kg
- Prioritaskan efisiensi biaya tanpa mengorbankan rasa

Format jawaban:

BAHAN (100 porsi):
- (daftar bahan + takaran + estimasi harga bahan)

CARA MEMBUAT:
1. (langkah detail)

TIPS CATERING:
- (tips efisiensi biaya + masak skala besar)

ESTIMASI HPP: Rp ... per porsi (harus di bawah Rp 6.000)`;

    const result = await _callGemini(prompt);
    const body = document.getElementById('ai-resep-body');
    if (!body) return;

    if (result) {
      m.resep = result;
      await DB.saveMenuItem(m).catch(()=>{});
      body.innerHTML = `<div style="text-align:left;font-size:13px;line-height:1.7;white-space:pre-wrap;color:var(--text)">${_esc(result)}</div>`;
      // Update footer with saved indicator
      const footer = body.closest('.modal')?.querySelector('.modal-footer');
      if (footer) footer.innerHTML = `<span style="font-size:11px;color:var(--success);font-weight:600">\u2713 Resep disimpan otomatis</span><div style="flex:1"></div><button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`;
      Notify.success('Resep berhasil di-generate & disimpan');
    } else {
      body.innerHTML = `<div style="text-align:center;padding:var(--s6);color:var(--danger)">Gagal generate resep. Cek API key di Settings.</div>`;
    }
  }

  /* ─── Migration: Nasi → Karbo / Paketan ─── */
  async function _migrateNasiToKarbo() {
    const FLAG = 'becca_menu_nasi_to_karbo_v1';
    if (localStorage.getItem(FLAG)) return;
    const KARBO_NAMES = new Set([
      'nasi putih','nasi uduk','nasi kuning','nasi merah','nasi jagung',
      'nasi gurih','nasi tutug oncom','lontong','ketupat'
    ]);
    const toUpdate = _library.filter(m =>
      m.klasifikasi === 'Nasi' ||
      ((m.nama||'').toLowerCase() === 'omurice' && m.klasifikasi === 'Lauk Kering')
    );
    if (!toUpdate.length) { localStorage.setItem(FLAG, '1'); return; }
    const updated = toUpdate.map(m => {
      const nm = (m.nama || '').toLowerCase().trim();
      const newKlas = KARBO_NAMES.has(nm) ? 'Karbo' : 'Paketan';
      return { ...m, klasifikasi: newKlas };
    });
    for (const item of updated) {
      try { await DB.saveMenuItem(item); } catch {}
    }
    updated.forEach(u => { const i = _library.findIndex(m => m.id === u.id); if (i >= 0) _library[i] = u; });
    localStorage.setItem(FLAG, '1');
  }

  /* ═══════════════════════════════════════════
     SEED LIBRARY — 1500+ menu items
     ═══════════════════════════════════════════ */
  async function _seedLibrary() {
    // Build set of existing menu names to skip duplicates
    const existingNames = new Set(_library.map(m=>(m.nama||'').toLowerCase()));
    const items = [];
    const _m = (nama,klasifikasi,category,tema,jenis,bahan) => {
      if (existingNames.has(nama.toLowerCase())) return; // skip existing
      items.push({id:Utils.uid(),nama,klasifikasi,category,tema,jenis:jenis||'Regular',bahan:bahan||'',resep:'',archived:false});
    };

    // === KARBO (karbohidrat pokok) ===
    ['Nasi Putih','Nasi Uduk','Nasi Kuning','Nasi Merah','Nasi Jagung','Nasi Tutug Oncom','Nasi Gurih','Lontong','Ketupat'].forEach(n=>_m(n,'Karbo','Indonesia','Umum'));
    // === PAKETAN (nasi/karbo yang sudah jadi hidangan lengkap) ===
    ['Nasi Goreng','Nasi Liwet','Nasi Kebuli','Nasi Tim','Nasi Bakar','Bubur Ayam'].forEach(n=>_m(n,'Paketan','Indonesia','Umum','Paketan'));
    ['Nasi Goreng Jawa','Nasi Goreng Kampung','Nasi Goreng Seafood','Nasi Goreng Pete','Nasi Goreng Teri'].forEach(n=>_m(n,'Paketan','Indonesia','Jawa','Paketan'));
    ['Nasi Padang','Nasi Kapau'].forEach(n=>_m(n,'Paketan','Indonesia','Padang','Paketan'));
    ['Onigiri','Nasi Jepang','Sushi Rice'].forEach(n=>_m(n,'Paketan','Jepang','Umum','Paketan'));

    // === LAUK KERING ===
    const laukKering = [
      ['Ayam Goreng','Ayam goreng bumbu kuning','Umum'],['Ayam Goreng Kremes','Ayam goreng dengan kremesan','Jawa'],
      ['Ayam Goreng Lengkuas','Ayam bumbu lengkuas','Sunda'],['Ayam Bakar','Ayam bakar bumbu kecap','Umum'],
      ['Ayam Bakar Padang','Ayam bakar bumbu padang','Padang'],['Ayam Geprek','Ayam crispy + sambal','Umum'],
      ['Ayam Katsu','Ayam tepung panko, saus katsu','Jepang'],['Ayam Teriyaki','Ayam saus teriyaki','Jepang'],
      ['Ayam Penyet','Ayam goreng penyet + sambal','Jawa'],['Ayam Pop','Ayam rebus bumbu minimal','Padang'],
      ['Ayam Goreng Kalasan','Ayam bumbu kalasan','Jawa'],['Ayam Goreng Serundeng','Ayam + serundeng kelapa','Jawa'],
      ['Ayam Rica-Rica','Ayam bumbu rica pedas','Manado'],['Ayam Woku','Ayam bumbu woku','Manado'],
      ['Ayam Taliwang','Ayam bakar bumbu taliwang','Umum'],['Ayam Goreng Bumbu Rujak','Ayam bumbu rujak','Jawa'],
      ['Ayam Saus Mentega','Ayam goreng saus mentega','Western'],['Ayam Lada Hitam','Ayam tumis lada hitam','Umum'],
      ['Ayam Saus Tiram','Ayam tumis saus tiram','Umum'],['Ayam BBQ','Ayam panggang saus bbq','Western'],
      ['Ikan Goreng','Ikan goreng bumbu kuning','Umum'],['Ikan Goreng Tepung','Ikan goreng tepung crispy','Umum'],
      ['Ikan Bakar','Ikan bakar bumbu kecap','Umum'],['Ikan Goreng Sambal Matah','Ikan goreng + sambal matah','Bali'],
      ['Ikan Panggang Bumbu Padang','Ikan panggang bumbu padang','Padang'],
      ['Lele Goreng','Lele goreng + lalapan','Umum'],['Lele Penyet','Lele goreng penyet','Jawa'],
      ['Nila Goreng','Ikan nila goreng','Umum'],['Patin Goreng','Ikan patin goreng','Kalimantan'],
      ['Bandeng Presto','Bandeng presto goreng','Jawa'],['Bandeng Goreng Crispy','Bandeng goreng kering','Jawa'],
      ['Tahu Goreng','Tahu goreng tepung','Umum'],['Tahu Isi','Tahu isi sayur goreng','Umum'],
      ['Tempe Goreng','Tempe goreng tepung','Umum'],['Tempe Goreng Bumbu','Tempe goreng bumbu kuning','Umum'],
      ['Tempe Mendoan','Tempe mendoan tipis','Jawa'],['Tempe Orek','Tempe orek kecap','Jawa'],
      ['Tempe Bacem','Tempe bacem manis','Jawa'],['Tahu Bacem','Tahu bacem manis','Jawa'],
      ['Perkedel Kentang','Perkedel kentang goreng','Umum'],['Perkedel Jagung','Perkedel jagung goreng','Umum'],
      ['Bakwan Sayur','Bakwan sayur goreng','Umum'],['Risol Ragout','Risol isi ragout','Umum'],
      ['Nugget Ayam','Nugget ayam goreng','Western'],['Sosis Goreng','Sosis ayam goreng','Western'],
      ['Telur Dadar','Telur dadar biasa','Umum'],['Telur Balado','Telur balado pedas','Padang'],
      ['Telur Ceplok','Telur ceplok mata sapi','Umum'],['Telur Pindang','Telur pindang bumbu','Jawa'],
      ['Daging Sapi Goreng','Daging sapi goreng kering','Umum'],['Empal Gentong','Empal daging sapi','Jawa'],
      ['Dendeng Balado','Dendeng sapi balado','Padang'],['Dendeng Batokok','Dendeng sapi batokok','Padang'],
      ['Rendang Daging','Daging sapi rendang','Padang'],['Rendang Ayam','Ayam rendang','Padang'],
      ['Semur Daging','Daging sapi semur','Betawi'],['Gepuk Daging','Daging gepuk manis','Sunda'],
      ['Udang Goreng Tepung','Udang goreng tepung','Umum'],['Udang Goreng Mentega','Udang goreng mentega','Umum'],
      ['Cumi Goreng Tepung','Cumi goreng tepung','Umum'],['Cumi Goreng Pedas','Cumi goreng sambal','Umum'],
      ['Ikan Asin Goreng','Ikan asin goreng','Umum'],['Teri Kacang','Teri goreng + kacang','Umum'],
      ['Kerupuk Udang','Kerupuk udang goreng','Umum'],['Emping Goreng','Emping melinjo goreng','Umum'],
    ];
    laukKering.forEach(([n,b,t])=>_m(n,'Lauk Kering','Indonesia',t,'Regular',b));
    // Lauk kering Thailand
    ['Gai Tod (Ayam Goreng Thai)','Pla Tod (Ikan Goreng Thai)','Tod Man Pla (Fish Cake)'].forEach(n=>_m(n,'Lauk Kering','Thailand','Umum'));

    // === LAUK KUAH ===
    const laukKuah = [
      ['Ayam Bumbu Kuning','Ayam kuah kuning','Umum'],['Opor Ayam','Ayam opor santan','Jawa'],
      ['Gulai Ayam','Ayam gulai santan','Padang'],['Kare Ayam','Ayam kare santan','Umum'],
      ['Rawon','Daging sapi rawon kluwek','Jawa'],['Soto Ayam','Soto ayam kuah kuning','Jawa'],
      ['Soto Betawi','Soto daging santan','Betawi'],['Soto Madura','Soto daging bening','Jawa'],
      ['Soto Banjar','Soto ayam khas banjar','Kalimantan'],['Soto Lamongan','Soto ayam lamongan','Jawa'],
      ['Sup Ayam','Sup ayam sayur bening','Umum'],['Sup Daging','Sup daging sapi bening','Umum'],
      ['Tongseng Ayam','Tongseng ayam santan','Jawa'],['Tongseng Kambing','Tongseng kambing','Jawa'],
      ['Semur Ayam','Semur ayam kecap','Betawi'],['Semur Tahu Tempe','Semur tahu tempe','Betawi'],
      ['Gulai Ikan','Ikan gulai santan','Padang'],['Gulai Tunjang','Kikil gulai santan','Padang'],
      ['Sayur Asem','Sayur asem jawa','Jawa'],['Sayur Lodeh','Sayur lodeh santan','Jawa'],
      ['Pindang Ikan','Pindang ikan palembang','Umum'],['Garang Asem','Garang asem ayam','Jawa'],
      ['Sup Iga','Sup iga sapi','Umum'],['Sup Buntut','Sup buntut sapi','Umum'],
      ['Kare Jepang','Kare Jepang roux','Jepang'],['Tom Yam','Tom yam goong','Thailand'],
      ['Tom Kha Gai','Sup ayam santan thai','Thailand'],['Miso Soup','Sup miso tahu wakame','Jepang'],
      ['Cream Soup','Sup krim jagung/ayam','Western'],['Mushroom Soup','Sup krim jamur','Western'],
    ];
    laukKuah.forEach(([n,b,t])=>_m(n,'Lauk Kuah','Indonesia',t,'Regular',b));

    // === PENDAMPING ===
    const pendamping = [
      ['Tumis Tahu','Tahu tumis bumbu','Umum'],['Tumis Tempe','Tempe tumis kecap','Umum'],
      ['Orak Arik Telur','Telur orak arik sayur','Umum'],['Telur Sambal Goreng','Telur sambal goreng','Jawa'],
      ['Sambal Goreng Kentang','Kentang sambal goreng','Jawa'],['Sambal Goreng Ati','Ati ampela sambal goreng','Jawa'],
      ['Capcay','Capcay sayur campur','Umum'],['Tumis Buncis','Buncis tumis','Umum'],
      ['Tumis Kangkung','Kangkung tumis bawang','Umum'],['Tumis Taoge','Taoge tumis','Umum'],
      ['Tumis Labu Siam','Labu siam tumis','Umum'],['Oseng Tempe','Tempe oseng kecap','Jawa'],
      ['Balado Terong','Terong balado','Padang'],['Acar Kuning','Acar timun wortel','Umum'],
      ['Sambal Goreng Krecek','Krecek sambal goreng','Jawa'],['Tumis Tahu Sumedang','Tahu sumedang tumis','Sunda'],
      ['Tahu Telur','Tahu telur surabaya','Jawa'],['Makaroni Goreng','Makaroni goreng bumbu','Umum'],
      ['Kentang Goreng','French fries','Western'],['Kentang Balado','Kentang goreng balado','Padang'],
      ['Mie Goreng','Mie goreng bumbu','Umum'],['Bihun Goreng','Bihun goreng','Umum'],
      ['Kwetiau Goreng','Kwetiau goreng','Umum'],['Egg Roll','Egg roll sayur ayam','Umum'],
      ['Spring Roll','Spring roll goreng','Umum'],['Edamame','Edamame rebus garam','Jepang'],
      ['Gyoza','Gyoza ayam/sayur','Jepang'],['Pad Thai Side','Pad thai mini porsi','Thailand'],
    ];
    pendamping.forEach(([n,b,t])=>_m(n,'Pendamping','Indonesia',t));
    // Aneka Gorengan (Pendamping)
    ['Tahu Crispy','Tempe Crispy','Bakwan Jagung','Bakwan Udang','Pisang Goreng','Ubi Goreng','Singkong Goreng',
     'Cireng','Comro','Misro','Gehu Pedas','Tahu Walik','Martabak Tahu','Risol Mayo','Pastel Ayam',
     'Lumpia Sayur','Lumpia Semarang','Pangsit Goreng','Wonton Goreng','Tahu Sumedang',
     'Tempe Kemul','Sukun Goreng','Talas Goreng','Bala-Bala','Onde-Onde',
     'Kroket Kentang','Donat Kentang','Roti Goreng','Cakwe','Tahu Gejrot',
    ].forEach(n=>_m(n,'Pendamping','Indonesia','Umum','Regular','Gorengan'));

    // === SAYUR ===
    const sayur = [
      ['Sayur Bayam','Bayam bening','Umum'],['Sayur Sop','Sup sayur bening','Umum'],
      ['Sayur Asem','Sayur asem khas jawa','Jawa'],['Sayur Lodeh','Sayur lodeh santan','Jawa'],
      ['Sayur Labu','Labu kuning santan','Umum'],['Urap Sayur','Urap sayur kelapa','Jawa'],
      ['Gado-Gado','Gado-gado bumbu kacang','Betawi'],['Pecel','Pecel sayur bumbu kacang','Jawa'],
      ['Karedok','Karedok sayur mentah','Sunda'],['Rujak Cingur','Rujak cingur surabaya','Jawa'],
      ['Gulai Daun Singkong','Daun singkong gulai','Padang'],['Gulai Nangka','Nangka muda gulai','Padang'],
      ['Tumis Kangkung','Kangkung tumis bawang','Umum'],['Tumis Bayam','Bayam tumis bawang','Umum'],
      ['Cah Sawi','Sawi hijau tumis','Umum'],['Cah Brokoli','Brokoli tumis bawang','Umum'],
      ['Tumis Wortel','Wortel tumis','Umum'],['Tumis Terong','Terong tumis','Umum'],
      ['Sayur Bening Bayam','Bayam bening jagung','Jawa'],['Sayur Bobor','Bobor bayam santan','Jawa'],
      ['Plecing Kangkung','Kangkung rebus + sambal plecing','Bali'],['Lawar','Lawar sayur bali','Bali'],
      ['Sayur Daun Pepaya','Daun pepaya tumis','Manado'],['Cakalang Sayur','Cakalang + sayur manado','Manado'],
      ['Sayur Nangka','Nangka muda masak santan','Jawa'],['Gudeg','Gudeg nangka muda','Jawa'],
      ['Terancam','Terancam sayur mentah','Sunda'],['Selada Air Rebus','Selada air + bumbu kacang','Umum'],
    ];
    sayur.forEach(([n,b,t])=>_m(n,'Sayur','Indonesia',t));
    // Aneka Sayur Nusantara
    [['Sayur Tewel','Tewel nangka muda khas jawa','Jawa'],['Sayur Bening Kelor','Daun kelor bening','Jawa'],
     ['Sayur Bening Labu','Labu siam bening','Jawa'],['Sayur Santan Labu','Labu kuning santan','Umum'],
     ['Oseng Genjer','Genjer tumis','Sunda'],['Tumis Pare','Pare tumis telur','Jawa'],
     ['Tumis Kacang Panjang','Kacang panjang tumis','Umum'],['Tumis Jagung Muda','Jagung muda tumis','Umum'],
     ['Tumis Daun Pepaya','Daun pepaya tumis teri','Umum'],['Tumis Rebung','Rebung tumis','Umum'],
     ['Tumis Jantung Pisang','Jantung pisang tumis','Jawa'],['Sayur Kuning','Sayur kuning santan','Umum'],
     ['Tongseng Sayur','Tongseng sayur santan','Jawa'],['Gulai Pakis','Pakis gulai padang','Padang'],
     ['Sayur Lilin','Sayur lilin labu siam','Sunda'],['Trancam','Trancam sayur mentah','Jawa'],
     ['Asinan Sayur','Asinan sayur betawi','Betawi'],['Lotek','Lotek sayur sunda','Sunda'],
     ['Pecal Kacang','Pecal kacang panjang','Jawa'],['Sayur Gambas','Gambas tumis','Umum'],
     ['Tumis Toge Tahu','Toge + tahu tumis','Umum'],['Sayur Kacang Merah','Kacang merah santan','Umum'],
    ].forEach(([n,b,t])=>_m(n,'Sayur','Indonesia',t));

    // === SAMBEL ===
    const sambel = [
      ['Sambal Terasi','Sambal terasi ulek','Umum'],['Sambal Matah','Sambal matah bali','Bali'],
      ['Sambal Bajak','Sambal bajak jawa','Jawa'],['Sambal Lado Mudo','Sambal hijau padang','Padang'],
      ['Sambal Ijo','Sambal hijau lombok','Umum'],['Sambal Bawang','Sambal bawang goreng','Umum'],
      ['Sambal Dabu-Dabu','Sambal dabu-dabu manado','Manado'],['Sambal Roa','Sambal roa manado','Manado'],
      ['Sambal Kecap','Sambal kecap rawit','Umum'],['Sambal Geprek','Sambal geprek pedas','Umum'],
      ['Sambal Tomat','Sambal tomat mentah','Umum'],['Sambal Mangga','Sambal mangga muda','Umum'],
      ['Sambal Balado','Sambal balado padang','Padang'],['Sambal Pencit','Sambal mangga muda','Jawa'],
      ['Sambal Petis','Sambal petis surabaya','Jawa'],['Acar','Acar timun wortel','Umum'],
    ];
    sambel.forEach(([n,b,t])=>_m(n,'Sambel','Indonesia',t));
    // Aneka Sambal Nusantara
    [['Sambal Korek','Sambal korek bawang merah','Jawa'],['Sambal Ulek Mentah','Sambal mentah ulek','Umum'],
     ['Sambal Teri','Sambal teri medan','Medan'],['Sambal Goreng Teri','Teri goreng sambal','Umum'],
     ['Sambal Lalapan','Sambal tomat lalapan','Umum'],['Sambal Embe','Sambal embe manado','Manado'],
     ['Sambal Cabe Ijo','Sambal cabe hijau goreng','Padang'],['Sambal Cuka','Sambal cuka khas palembang','Umum'],
     ['Sambal Kemiri','Sambal kemiri bakar','Umum'],['Sambal Kelapa','Sambal kelapa parut','Bali'],
     ['Sambal Dendeng','Sambal dendeng kering','Padang'],['Sambal Goreng Pete','Sambal goreng pete','Jawa'],
     ['Sambal Cibiuk','Sambal cibiuk garut','Sunda'],['Sambal Oncom','Sambal oncom sunda','Sunda'],
     ['Sambal Jambal','Sambal jambal ikan asin','Sunda'],['Sambal Tumpang','Sambal tumpang tempe','Jawa'],
     ['Sambal Rica','Sambal rica manado pedas','Manado'],['Sambal Cakalang','Sambal cakalang fufu','Manado'],
    ].forEach(([n,b,t])=>_m(n,'Sambel','Indonesia',t));

    // === ANEKA TELUR (Lauk Kering) ===
    [['Telur Dadar Padang','Telur dadar tebal bumbu padang','Padang'],['Telur Balado Padang','Telur rebus balado pedas','Padang'],
     ['Telur Bumbu Bali','Telur goreng bumbu bali','Bali'],['Telur Kecap','Telur ceplok kecap manis','Umum'],
     ['Telur Bumbu Rujak','Telur goreng bumbu rujak','Jawa'],['Telur Sambal Goreng','Telur sambal goreng kering','Jawa'],
     ['Telur Opor','Telur rebus opor santan','Jawa'],['Telur Gulai','Telur rebus gulai kuning','Padang'],
     ['Telur Semur','Telur rebus semur kecap','Betawi'],['Telur Rendang','Telur rebus rendang kering','Padang'],
     ['Telur Asin','Telur asin rebus','Umum'],['Telur Goreng Crispy','Telur goreng tepung crispy','Umum'],
     ['Telur Bumbu Kuning','Telur rebus bumbu kuning','Umum'],['Telur Petis','Telur goreng petis','Jawa'],
     ['Telur Dadar Sayur','Telur dadar isi sayur','Umum'],['Telur Dadar Kornet','Telur dadar isi kornet','Umum'],
     ['Telur Mata Sapi Sambal','Telur ceplok + sambal bawang','Umum'],['Telur Saus Tiram','Telur goreng saus tiram','Umum'],
     ['Telur Puyuh Balado','Telur puyuh goreng balado','Padang'],['Telur Puyuh Kecap','Telur puyuh semur kecap','Jawa'],
     ['Telur Puyuh Bacem','Telur puyuh bacem manis','Jawa'],['Telur Dadar Gulung','Telur dadar gulung isi','Umum'],
     ['Fuyunghai','Telur fuyunghai saus asam manis','Umum'],
    ].forEach(([n,b,t])=>_m(n,'Lauk Kering','Indonesia',t,'Regular',b));
    _m('Omurice','Paketan','Jepang','Umum','Paketan','Nasi goreng bungkus telur dadar');

    // === BUAH ===
    ['Semangka','Melon','Pepaya','Pisang','Jeruk','Apel','Pir','Mangga','Salak','Jambu Biji','Nanas','Buah Naga'].forEach(n=>_m(n,'Buah','Indonesia','Umum'));

    // === PAKETAN ===
    const paketan = [
      ['Bakso','Bakso sapi kuah','Jawa'],['Soto Ayam','Soto ayam lamongan','Jawa'],
      ['Rawon','Rawon daging sapi','Jawa'],['Mie Ayam','Mie ayam bakso','Umum'],
      ['Mie Goreng Jawa','Mie goreng jawa','Jawa'],['Nasi Goreng Spesial','Nasi goreng + telur + ayam','Umum'],
      ['Nasi Uduk Komplit','Nasi uduk + lauk komplit','Betawi'],['Nasi Kuning Komplit','Nasi kuning + lauk','Umum'],
      ['Sop Buntut','Sop buntut sapi','Umum'],['Lontong Sayur','Lontong + sayur santan','Jawa'],
      ['Ketoprak','Ketoprak + bumbu kacang','Betawi'],['Nasi Pecel','Nasi + pecel sayur','Jawa'],
      ['Nasi Liwet Komplit','Nasi liwet + teri + telur','Jawa'],['Bubur Ayam Komplit','Bubur ayam + cakwe','Umum'],
      ['Siomay Bandung','Siomay + bumbu kacang','Sunda'],['Batagor','Batagor + bumbu kacang','Sunda'],
      ['Nasi Bakar Ayam','Nasi bakar isi ayam','Umum'],['Sate Ayam','Sate ayam + lontong','Jawa'],
      ['Nasi Kebuli Kambing','Nasi kebuli + kambing','Umum'],['Gado-Gado Komplit','Gado-gado + lontong','Betawi'],
      ['Nasi Padang Komplit','Nasi + rendang + gulai','Padang'],['Laksa','Laksa kuah santan','Umum'],
      ['Kwetiau Siram','Kwetiau siram kuah','Umum'],['Mie Rebus','Mie rebus kuah','Umum'],
      ['Cap Cay Kuah','Capcay kuah + nasi','Umum'],['Nasi Hainan','Nasi hainan + ayam','Umum'],
    ];
    paketan.forEach(([n,b,t])=>_m(n,'Paketan','Indonesia',t,'Paketan',b));
    // Aneka Paketan Nusantara
    [['Soto Betawi','Soto daging santan betawi','Betawi'],['Soto Banjar','Soto ayam khas banjar','Kalimantan'],
     ['Soto Lamongan','Soto ayam kuah kuning','Jawa'],['Soto Kudus','Soto kerbau khas kudus','Jawa'],
     ['Soto Mie','Soto mie bogor','Sunda'],['Bakso Malang','Bakso urat + tahu bakso','Jawa'],
     ['Bakso Aci','Bakso aci kuah pedas','Sunda'],['Mie Ayam Ceker','Mie ayam + ceker ayam','Umum'],
     ['Mie Ayam Pangsit','Mie ayam + pangsit goreng','Umum'],['Mie Goreng Aceh','Mie goreng bumbu aceh','Aceh'],
     ['Mie Rebus Medan','Mie rebus kuah khas medan','Medan'],['Mie Kocok','Mie kocok bandung','Sunda'],
     ['Kwetiau Goreng Seafood','Kwetiau goreng campur','Umum'],['Bihun Goreng Spesial','Bihun goreng + telur + ayam','Umum'],
     ['Nasi Goreng Kampung','Nasi goreng pete + teri','Umum'],['Nasi Goreng Rendang','Nasi goreng + rendang cincang','Padang'],
     ['Nasi Bakar Teri','Nasi bakar isi teri sambal','Umum'],['Nasi Bakar Cumi','Nasi bakar isi cumi asin','Umum'],
     ['Nasi Tutug Oncom Komplit','Nasi tutug oncom + lauk','Sunda'],['Nasi Timbel Komplit','Nasi timbel + lauk sunda','Sunda'],
     ['Kupat Tahu','Kupat tahu + bumbu kacang','Sunda'],['Tahu Gejrot Komplit','Tahu gejrot + gorengan','Sunda'],
     ['Sate Padang','Sate padang kuah kental','Padang'],['Sate Madura','Sate ayam bumbu kacang','Jawa'],
     ['Sate Lilit Bali','Sate lilit ikan khas bali','Bali'],['Sate Taichan','Sate taichan + sambal','Umum'],
     ['Nasi Megono','Nasi megono pekalongan','Jawa'],['Nasi Bogana','Nasi bogana tegal','Jawa'],
     ['Gudeg Komplit','Gudeg + ayam + telur + krecek','Jawa'],['Rawon Komplit','Rawon + telur asin + taoge','Jawa'],
     ['Tongseng Kambing Komplit','Tongseng kambing + nasi','Jawa'],['Gulai Kambing Komplit','Gulai kambing + nasi','Padang'],
     ['Lontong Balap','Lontong balap surabaya','Jawa'],['Lontong Cap Go Meh','Lontong opor + sambal goreng','Jawa'],
     ['Tahu Tek','Tahu tek surabaya','Jawa'],['Rujak Cingur Komplit','Rujak cingur + lontong','Jawa'],
     ['Pecel Lele Komplit','Pecel lele + nasi + sambal','Jawa'],['Ayam Penyet Komplit','Ayam penyet + nasi + sambal','Jawa'],
     ['Empal Gentong Komplit','Empal gentong + nasi','Jawa'],['Coto Makassar','Coto makassar + ketupat','Makassar'],
     ['Pallubasa','Pallubasa makassar + nasi','Makassar'],['Konro Bakar','Konro bakar + nasi','Makassar'],
     ['Sop Konro','Sop konro + nasi','Makassar'],['Papeda Ikan Kuah Kuning','Papeda + ikan kuah kuning','Umum'],
    ].forEach(([n,b,t])=>_m(n,'Paketan','Indonesia',t,'Paketan',b));

    // === MINUMAN ===
    ['Es Teh Manis','Es Jeruk','Air Mineral','Teh Hangat','Kopi','Es Cincau','Es Kelapa','Jus Jambu','Jus Jeruk','Jus Alpukat','Susu','Wedang Jahe'].forEach(n=>_m(n,'Minuman','Indonesia','Umum'));

    if (!items.length) { return; } // no new items to add
    Notify.info('Menambahkan ' + items.length + ' menu baru...');
    // Batch save — 50 items per batch
    for (let i=0; i<items.length; i+=50) {
      const batch = items.slice(i, i+50);
      await Promise.all(batch.map(item => DB.saveMenuItem(item).catch(()=>{}))).catch(()=>{});
    }
    Notify.success(items.length + ' menu baru ditambahkan ke library');
  }

  /* ═══ MENU CRUD ═══ */
  function openMenuForm(menuId) {
    const existing = menuId ? _library.find(m=>m.id===menuId) : null;
    const mid = 'mf-'+Date.now();
    Modal.open({id:mid, title:existing?'Edit Menu':'Tambah Menu Baru', size:'modal-lg',
      body:`
        <div class="form-row">
          <div class="form-group"><label class="form-label">Nama Menu <span class="req">*</span></label>
            <input id="mf-nama" class="form-control" value="${_esc(existing?.nama||'')}" placeholder="Nama menu...">
          </div>
          <div class="form-group"><label class="form-label">Klasifikasi</label>
            <select id="mf-kat" class="form-control">
              ${KATEGORI.map(k=>`<option value="${k}" ${existing?.klasifikasi===k?'selected':''}>${k}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Category</label>
            <select id="mf-cat" class="form-control">
              ${CATEGORY.map(c=>`<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Tema</label>
            <select id="mf-tema" class="form-control">
              ${TEMA.map(t=>`<option value="${t}" ${existing?.tema===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Jenis</label>
            <select id="mf-jenis" class="form-control">
              ${JENIS.map(j=>`<option value="${j}" ${existing?.jenis===j?'selected':''}>${j}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Bahan</label>
          <textarea id="mf-bahan" class="form-control" rows="3" placeholder="Daftar bahan...">${_esc(existing?.bahan||'')}</textarea>
        </div>
        <div class="form-group"><label class="form-label">Resep</label>
          <textarea id="mf-resep" class="form-control" rows="4" placeholder="Resep (opsional)...">${_esc(existing?.resep||'')}</textarea>
        </div>`,
      footer:`${existing?`<button class="btn btn-danger" onclick="MenuModule.deleteMenu('${menuId}','${mid}')">Hapus</button>`:''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="MenuModule._saveMenu('${menuId||''}','${mid}')">Simpan</button>`,
    });
  }

  async function _saveMenu(menuId, modalId) {
    const nama = (document.getElementById('mf-nama')?.value||'').trim();
    if (!nama) { Notify.warning('Nama menu wajib diisi'); return; }
    const data = {
      id: menuId || Utils.uid(),
      nama,
      klasifikasi: document.getElementById('mf-kat').value,
      category: document.getElementById('mf-cat').value,
      tema: document.getElementById('mf-tema').value,
      jenis: document.getElementById('mf-jenis').value,
      bahan: (document.getElementById('mf-bahan')?.value||'').trim(),
      resep: (document.getElementById('mf-resep')?.value||'').trim(),
      archived: false,
    };
    try {
      await DB.saveMenuItem(data);
      if (menuId) { const idx=_library.findIndex(m=>m.id===menuId); if(idx>=0) _library[idx]=data; }
      else _library.unshift(data);
      Notify.success(menuId?'Menu diperbarui':'Menu ditambahkan');
    } catch(e) { Notify.error('Gagal: '+e.message); }
    Modal.close(modalId);
    _renderLibrary();
  }

  async function deleteMenu(menuId, modalId) {
    if (!confirm('Hapus menu ini?')) return;
    try { await DB.deleteMenuItem(menuId); _library=_library.filter(m=>m.id!==menuId); Notify.success('Menu dihapus'); } catch { Notify.error('Gagal'); }
    if (modalId) Modal.close(modalId);
    _renderLibrary();
  }

  /* ═══════════════════════════════════════════
     GRUP MENU
     ═══════════════════════════════════════════ */

  async function _saveGroups() {
    try {
      localStorage.setItem('becca_menu_groups', JSON.stringify(_groups));
      await DB.saveSettings({ _menuGroups: _groups });
    } catch(e) { Notify.error('Gagal menyimpan grup: '+e.message); }
  }

  function _renderGroups() {
    const el = document.getElementById('menu-tab-grup');
    if (!el) return;
    const assignedCusts = new Set(_groups.flatMap(g => g.customers || []));
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s4)">
        <p style="color:var(--text-3);font-size:13px">Kelompokan customer dengan komposisi yang sama untuk mengurangi human error</p>
        <button class="btn btn-primary btn-sm" onclick="MenuModule._addGroup()">+ Tambah Grup</button>
      </div>
      ${_groups.length === 0 ? `
        <div style="text-align:center;padding:48px 24px;color:var(--text-3)">
          <div style="font-size:36px;margin-bottom:12px">&#128101;</div>
          <p style="font-weight:600;margin-bottom:4px">Belum ada grup menu</p>
          <p style="font-size:12px">Buat grup untuk mengelompokkan customer dengan komposisi yang sama.</p>
        </div>
      ` : _groups.map(g => _renderGroupCard(g, assignedCusts)).join('')}
    `;
  }

  function _renderGroupCard(g, assignedCusts) {
    const custList = (g.customers || []).map(cid => {
      const c = _customers.find(x => x.id === cid);
      if (!c) return '';
      const code = _getLaukPendCode(c);
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface2);border-radius:var(--r-sm);margin-bottom:4px">
        <span style="font-size:13px;flex:1">${_custDisplayName(c)}</span>
        <span style="font-size:10px;font-weight:700;color:#6366f1;background:rgba(99,102,241,.1);padding:1px 7px;border-radius:var(--r-full);flex-shrink:0">${_esc(code)}</span>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);padding:2px 6px;font-size:11px;min-width:0;flex-shrink:0" onclick="MenuModule._removeCustFromGroup('${g.id}','${cid}')">&times;</button>
      </div>`;
    }).join('');
    const unassigned = _customers.filter(c => !assignedCusts.has(c.id));
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:var(--s4);margin-bottom:var(--s3)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s3)">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
            <span style="font-size:16px">&#128101;</span>
            <input type="text" value="${_esc(g.nama)}"
              style="font-weight:600;font-size:15px;background:transparent;border:none;border-bottom:1px solid transparent;padding:2px 4px;color:var(--text);outline:none;width:100%;max-width:220px"
              onfocus="this.style.borderBottomColor='var(--primary)'"
              onblur="this.style.borderBottomColor='transparent';MenuModule._renameGroup('${g.id}',this.value)"
              onkeydown="if(event.key==='Enter')this.blur()">
          </div>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger);flex-shrink:0" onclick="MenuModule._deleteGroup('${g.id}')">Hapus Grup</button>
        </div>
        <div style="margin-bottom:var(--s3)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Komposisi</span>
            <button class="btn btn-sm" style="font-size:10px;background:rgba(99,102,241,.12);color:#6366f1;border:1px solid rgba(99,102,241,.3)" onclick="MenuModule._editGroupKomp('${g.id}')">Komposisi</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${(g.komposisi||DEFAULT_KOMPOSISI).map(k=>`<span style="padding:2px 10px;border-radius:var(--r-full);background:rgba(99,102,241,.1);color:#6366f1;font-size:11px;font-weight:600">${_esc(k)}</span>`).join('')}
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Customer (${(g.customers||[]).length})</span>
            ${unassigned.length > 0
              ? `<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="MenuModule._addCustToGroup('${g.id}')">+ Tambah</button>`
              : `<span style="font-size:11px;color:var(--text-3)">Semua customer sudah di grup</span>`}
          </div>
          ${custList || '<p style="font-size:12px;color:var(--text-3);text-align:center;padding:8px 0">Belum ada customer di grup ini</p>'}
        </div>
      </div>
    `;
  }

  function _addGroup() {
    const mid = 'modal-add-group';
    Modal.open({
      id: mid,
      title: 'Tambah Grup Menu',
      body: `
        <div class="form-group">
          <label class="form-label">Nama Grup</label>
          <input id="ag-nama" type="text" class="form-control" placeholder="Contoh: Grup A, Grup Direksi..." autocomplete="off">
        </div>`,
      footer: `
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="MenuModule._doAddGroup('${mid}')">Tambah</button>`,
    });
    setTimeout(() => document.getElementById('ag-nama')?.focus(), 100);
  }

  function _doAddGroup(modalId) {
    const nama = (document.getElementById('ag-nama')?.value||'').trim();
    if (!nama) { Notify.warning('Nama grup wajib diisi'); return; }
    _groups.push({ id: 'grp_'+Utils.uid(), nama, komposisi: [...DEFAULT_KOMPOSISI], customers: [] });
    Modal.close(modalId);
    _saveGroups();
    _renderGroups();
  }

  function _deleteGroup(gid) {
    const g = _groups.find(x => x.id === gid);
    if (!g) return;
    if (!confirm('Hapus grup "'+g.nama+'"?')) return;
    _groups = _groups.filter(x => x.id !== gid);
    _saveGroups();
    _renderGroups();
  }

  function _renameGroup(gid, nama) {
    nama = (nama||'').trim();
    if (!nama) return;
    const g = _groups.find(x => x.id === gid);
    if (!g || g.nama === nama) return;
    g.nama = nama;
    _saveGroups();
  }

  function _editGroupKomp(gid) {
    const g = _groups.find(x => x.id === gid);
    if (!g) return;
    const komp = g.komposisi || [...DEFAULT_KOMPOSISI];
    const mid = 'modal-group-komp';
    Modal.open({
      id: mid,
      title: 'Komposisi — '+_esc(g.nama),
      body: `
        <p style="font-size:12px;color:var(--text-3);margin-bottom:var(--s3)">Centang komponen yang termasuk dalam komposisi grup ini:</p>
        <div id="gkomp-list">
          ${KOMP_OPTIONS.map(k=>`
            <label style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer">
              <input type="checkbox" value="${_esc(k)}" ${komp.includes(k)?'checked':''} style="width:16px;height:16px;accent-color:var(--primary)">
              <span style="font-size:14px">${_esc(k)}</span>
            </label>`).join('')}
        </div>`,
      footer: `
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="MenuModule._saveKomposisiGrup('${gid}','${mid}')">Simpan</button>`,
    });
  }

  function _saveKomposisiGrup(gid, modalId) {
    const g = _groups.find(x => x.id === gid);
    if (!g) return;
    const checks = document.querySelectorAll('#gkomp-list input[type=checkbox]:checked');
    const komp = Array.from(checks).map(c => c.value);
    if (!komp.length) { Notify.warning('Pilih minimal 1 komponen'); return; }
    g.komposisi = komp;
    Modal.close(modalId);
    _saveGroups();
    _renderGroups();
  }

  function _dedupeCustomers(list) {
    const seen = new Set();
    return list
      .filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
      .sort((a,b) => (_custName(a)).localeCompare(_custName(b)));
  }

  function _custName(c) {
    return c.namaShort || c.nama_singkat || c.namaPerusahaan || c.nama || '';
  }

  function _custDisplayName(c) {
    return _esc(_custName(c));
  }

  function _getLaukPendCode(cust) {
    // Prioritas: field eksplisit qty_lauk/qty_pendamping dari tabel customers
    const L = cust.qtyLauk ?? cust.qty_lauk;
    const P = cust.qtyPendamping ?? cust.qty_pendamping;
    if (L !== undefined && L !== null) return (L||0)+'L'+(P||0)+'P';
    // Fallback: hitung dari menuKomposisi
    const komp = cust.menuKomposisi || DEFAULT_KOMPOSISI;
    let l = 0, p = 0;
    komp.forEach(k => {
      const base = k.replace(/\s+\d+$/, '');
      if (base === 'Lauk' || base === 'Lauk Kering' || base === 'Lauk Kuah') l++;
      else if (base === 'Pendamping') p++;
    });
    return l + 'L' + p + 'P';
  }



  async function _addCustToGroup(gid) {
    const g = _groups.find(x => x.id === gid);
    if (!g) return;
    const fresh = await DB.getCustomers().catch(()=>null);
    if (fresh) _customers = _dedupeCustomers(fresh.filter(c=>(c.status||'AKTIF')==='AKTIF'));
    const assignedCusts = new Set(_groups.flatMap(x => x.customers || []));
    const available = _customers.filter(c => !assignedCusts.has(c.id));
    if (!available.length) { Notify.info('Semua customer sudah tergabung dalam grup'); return; }

    // Build suggestion groups by L+P code
    const byCode = {};
    available.forEach(c => {
      const code = _getLaukPendCode(c);
      if (!byCode[code]) byCode[code] = [];
      byCode[code].push(c.id);
    });
    const suggestions = Object.entries(byCode)
      .filter(([, ids]) => ids.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    const mid = 'modal-add-cust-grp';
    Modal.open({
      id: mid,
      title: 'Tambah Customer ke '+_esc(g.nama),
      body: `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:var(--s3)">
          <input type="text" id="acg-search" class="form-control" placeholder="Cari nama customer..."
            style="flex:1" oninput="MenuModule._filterCustGroupList(this.value)" autocomplete="off">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap;cursor:pointer;flex-shrink:0">
            <input type="checkbox" id="acg-all" style="width:15px;height:15px;accent-color:var(--primary)"
              onchange="MenuModule._toggleAllCustGroup(this.checked)">
            Pilih semua
          </label>
        </div>
        ${suggestions.length ? `
        <div style="margin-bottom:var(--s3)">
          <p style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Saran pengelompokan</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${suggestions.map(([code, ids]) => `
              <button onclick="MenuModule._selectBySuggestion('${code}')"
                style="padding:4px 10px;border-radius:var(--r-full);border:1px solid rgba(99,102,241,.4);background:rgba(99,102,241,.08);color:#6366f1;font-size:12px;font-weight:600;cursor:pointer">
                ${_esc(code)} <span style="opacity:.7;font-weight:400">(${ids.length})</span>
              </button>`).join('')}
          </div>
        </div>` : ''}
        <div id="acg-list" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm)">
          ${available.map(c => {
            const code = _getLaukPendCode(c);
            const searchNama = (c.namaPerusahaan||c.nama||'').toLowerCase()+' '+(c.namaShort||c.nama_singkat||'').toLowerCase();
            return `<label class="acg-item" data-nama="${_esc(searchNama)}" data-code="${_esc(code)}"
              style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-bottom:1px solid var(--border);cursor:pointer">
              <input type="checkbox" value="${c.id}"
                style="width:16px;height:16px;accent-color:var(--primary);flex-shrink:0"
                onchange="MenuModule._onCustGroupCheck()">
              <span style="font-size:13px;flex:1">${_custDisplayName(c)}</span>
              <span style="font-size:11px;font-weight:700;color:#6366f1;background:rgba(99,102,241,.1);padding:2px 8px;border-radius:var(--r-full);flex-shrink:0">${_esc(code)}</span>
            </label>`;
          }).join('')}
        </div>`,
      footer: `
        <span id="acg-count" style="font-size:12px;color:var(--text-3);align-self:center">0 dipilih</span>
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" id="acg-submit" disabled onclick="MenuModule._doAddMultiCustToGroup('${gid}','${mid}')">Tambah</button>`,
    });
    setTimeout(() => document.getElementById('acg-search')?.focus(), 100);
  }

  function _filterCustGroupList(q) {
    q = (q||'').toLowerCase();
    document.querySelectorAll('.acg-item').forEach(el => {
      el.style.display = (!q || el.dataset.nama.includes(q)) ? 'flex' : 'none';
    });
    _onCustGroupCheck();
  }

  function _toggleAllCustGroup(checked) {
    document.querySelectorAll('#acg-list .acg-item').forEach(el => {
      if (el.style.display === 'none') return;
      const cb = el.querySelector('input[type=checkbox]');
      if (cb) cb.checked = checked;
    });
    _onCustGroupCheck();
  }

  function _selectBySuggestion(code) {
    document.querySelectorAll('#acg-list .acg-item').forEach(el => {
      const cb = el.querySelector('input[type=checkbox]');
      if (cb) cb.checked = el.dataset.code === code;
    });
    _onCustGroupCheck();
  }

  function _onCustGroupCheck() {
    const allItems = Array.from(document.querySelectorAll('#acg-list .acg-item')).filter(el => el.style.display !== 'none');
    const checkedCount = allItems.filter(el => el.querySelector('input[type=checkbox]')?.checked).length;
    const countEl = document.getElementById('acg-count');
    const submitEl = document.getElementById('acg-submit');
    const allCb = document.getElementById('acg-all');
    if (countEl) countEl.textContent = checkedCount + ' dipilih';
    if (submitEl) submitEl.disabled = checkedCount === 0;
    if (allCb) allCb.checked = allItems.length > 0 && checkedCount === allItems.length;
  }

  function _doAddMultiCustToGroup(gid, modalId) {
    const g = _groups.find(x => x.id === gid);
    if (!g) return;
    const ids = Array.from(document.querySelectorAll('#acg-list input[type=checkbox]:checked')).map(c => c.value);
    if (!ids.length) return;
    if (!g.customers) g.customers = [];
    ids.forEach(cid => { if (!g.customers.includes(cid)) g.customers.push(cid); });
    Modal.close(modalId);
    _saveGroups();
    _renderGroups();
  }

  function _removeCustFromGroup(gid, custId) {
    const g = _groups.find(x => x.id === gid);
    if (!g) return;
    g.customers = (g.customers||[]).filter(c => c !== custId);
    _saveGroups();
    _renderGroups();
  }

  return {
    init, switchTab,
    _libFilter, openMenuDetail, openMenuForm, _saveMenu, deleteMenu,
    _genAddCustomer, _genRemoveGroup, _doRemoveGroup, _genSetCell, _genSave, _genAutoSave,
    _genPrevWeek, _genNextWeek, _genThisWeek, _genSwitchTab,
    _genToggleDrop, _genToggleAllCust, _genUpdateDropLabel, _genCbChange,
    _printMenuPDF, _openCopyModal, _copyCheckAll, _doCopyMenu, _copyWeekNav, _renderCopyList,
    _editKomposisi, _saveKomposisi,
    _kompDragStart, _kompDragOver, _kompDrop, _kompDragEnd, _kompAdd,
    _aiGenerateMenu, _aiResep,
    _renderGroups, _addGroup, _doAddGroup, _deleteGroup, _renameGroup,
    _editGroupKomp, _saveKomposisiGrup,
    _dedupeCustomers, _getLaukPendCode, _addCustToGroup, _filterCustGroupList, _toggleAllCustGroup,
    _selectBySuggestion, _onCustGroupCheck, _doAddMultiCustToGroup, _removeCustFromGroup,
  };
})();
window.MenuModule = MenuModule;
