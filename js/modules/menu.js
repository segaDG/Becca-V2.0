/* ============================================
   BECCA V2.0 — Menu Module
   Tab 1: Menu Generator (weekly planner per customer)
   Tab 2: Menu Library (1500+ menu items)
============================================ */
if(window.BECCA_DEBUG) console.log('[BECCA] MenuModule v20260404a loaded');

const MenuModule = (() => {
  'use strict';
  let _library = [], _plans = [], _customers = [], _orders = [];
  let _activeTab = 'generator';

  const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
  const SHIFTS = ['S1','S2','S3'];
  const DEFAULT_KOMPOSISI = ['Karbo','Lauk','Pendamping','Sayur','Sambel','Buah'];
  const KATEGORI = ['Nasi','Lauk Kering','Lauk Kuah','Pendamping','Sayur','Sambel','Buah','Minuman','Paketan'];
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
    const [library, plans, customers, orders] = await Promise.all([
      DB.getMenuLibrary().catch(()=>[]),
      DB.getMenuPlans().catch(()=>[]),
      DB.getCustomers().catch(()=>[]),
      DB.getOrders().catch(()=>[]),
    ]);
    _library = library; _plans = plans; _orders = orders;
    _customers = customers.filter(c=>(c.status||'AKTIF')==='AKTIF').sort((a,b)=>(a.nama||'').localeCompare(b.nama||''));
    // Seed library if empty
    // Seed v2: adds new items not yet in library (checks by name, skips existing)
    const SEED_VER = 'becca_menu_seed_v3';
    if (!localStorage.getItem(SEED_VER)) {
      await _seedLibrary();
      localStorage.setItem(SEED_VER, '1');
      _library = await DB.getMenuLibrary().catch(()=>[]);
    }
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
      </div>
      <div id="menu-tab-generator" ${_activeTab!=='generator'?'class="hidden"':''}></div>
      <div id="menu-tab-library" ${_activeTab!=='library'?'class="hidden"':''}></div>
    `;
    if (_activeTab==='generator') _renderGenerator();
    else _renderLibrary();
  }

  function switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(tab==='generator'?'Generator':'Library')));
    ['generator','library'].forEach(t => {
      const el = document.getElementById('menu-tab-'+t);
      if (el) el.classList.toggle('hidden', t!==tab);
    });
    if (tab==='generator') _renderGenerator();
    else _renderLibrary();
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
    const katColors = {'Nasi':'#f59e0b','Lauk Kering':'#ef4444','Lauk Kuah':'#f97316','Pendamping':'#8b5cf6','Sayur':'#10b981','Sambel':'#ec4899','Buah':'#06b6d4','Minuman':'#3b82f6','Paketan':'#6366f1'};

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
    const katColor = {'Nasi':'#f59e0b','Lauk Kering':'#ef4444','Lauk Kuah':'#f97316','Pendamping':'#8b5cf6','Sayur':'#10b981','Sambel':'#ec4899','Buah':'#06b6d4','Minuman':'#3b82f6','Paketan':'#6366f1'}[m.klasifikasi]||'var(--text-3)';
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
  let _genWeekStart = '', _genCustomers = []; // selected customer IDs

  function _getMonday() {
    const dt = new Date(); dt.setHours(12,0,0,0);
    const day = dt.getDay();
    dt.setDate(dt.getDate() + (day===0?-6:1-day));
    return dt.toISOString().slice(0,10);
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
    const weekCustomers = weekOrderNames.size
      ? _customers.filter(c => weekOrderNames.has((c.nama||'').toLowerCase()) || weekOrderNames.has((c.namaShort||'').toLowerCase()))
      : _customers;

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

      <!-- Customer selector -->
      <div class="card" style="margin-bottom:var(--s4);padding:var(--s3)">
        <div style="display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap">
          <span style="font-size:12px;font-weight:600;color:var(--text-2)">Customer:</span>
          <!-- Custom multi-select dropdown -->
          <div style="position:relative;flex-shrink:0">
            <button id="gen-cust-toggle" onclick="MenuModule._genToggleDrop(event)"
              style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;min-width:240px;border:1px solid var(--border);border-radius:var(--r-sm);background:var(--surface);cursor:pointer;font-size:12px;color:var(--text);text-align:left">
              <span id="gen-cust-label" style="flex:1">Pilih customer${weekCustomers.length < _customers.length ? ' ('+weekCustomers.length+' ada order)' : ''}...</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12" style="flex-shrink:0;opacity:.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div id="gen-cust-drop" style="display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:200;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:6px;min-width:280px;max-height:300px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.15)">
              <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r-sm);cursor:pointer;font-size:12px;font-weight:600;color:var(--text-2);border-bottom:1px solid var(--border);margin-bottom:4px"
                onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                <input type="checkbox" id="gen-cust-all" onchange="MenuModule._genToggleAllCust(this.checked)" style="width:14px;height:14px;cursor:pointer">
                Pilih Semua (${weekCustomers.length})
              </label>
              ${weekCustomers.map(c=>`
                <label class="gen-cust-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:var(--r-sm);cursor:pointer;transition:.1s"
                  onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                  <input type="checkbox" class="gen-cust-cb" value="${c.id}" onchange="MenuModule._genUpdateDropLabel()"
                    ${_genCustomers.includes(c.id)?'disabled title="Sudah ditambahkan"':''} style="width:14px;height:14px;cursor:pointer;flex-shrink:0">
                  <span style="font-size:12px;font-weight:600;color:${_genCustomers.includes(c.id)?'var(--text-3)':'var(--text)'}">${_esc(c.namaShort||c.nama)}</span>
                  ${_genCustomers.includes(c.id)?'<span style="font-size:9px;color:var(--text-3);margin-left:auto">\u2713 Aktif</span>':''}
                </label>`).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="MenuModule._genAddCustomer()">Tambah</button>
          <div style="flex:1"></div>
          ${canEdit?`<button class="btn btn-primary btn-sm" onclick="MenuModule._genSave()">\ud83d\udcbe Simpan</button>`:''}
        </div>
        ${_genCustomers.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:var(--s2)">
          ${_genCustomers.map(cid=>{
            const c=_customers.find(x=>x.id===cid);
            return c?`<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:var(--r-full);background:var(--primary-bg);color:var(--primary-h);font-size:11px;font-weight:600">
              ${_esc(c.namaShort||c.nama)} <span onclick="MenuModule._genRemoveCustomer('${cid}')" style="cursor:pointer;font-size:13px">\u00d7</span>
            </span>`:'';
          }).join('')}
        </div>`:''}
      </div>

      <!-- Weekly grid per customer -->
      <div id="gen-content">
        ${_genCustomers.length ? _genCustomers.map(cid=>_genCustomerBlock(cid, plan)).join('') : '<div style="text-align:center;padding:var(--s8);color:var(--text-3)">Pilih customer untuk mulai membuat menu mingguan</div>'}
      </div>
    `;

    // Load saved customer selection + plan
    if (plan?.customers?.length && !_genCustomers.length) {
      _genCustomers = plan.customers;
      _renderGenerator();
    }
  }

  function _genCustomerBlock(custId, plan) {
    const cust = _customers.find(c=>c.id===custId);
    if (!cust) return '';
    const custName = cust.namaShort || cust.nama;
    // Customer-specific komposisi (default or custom)
    const komposisi = cust.menuKomposisi || [...DEFAULT_KOMPOSISI];
    const planData = plan?.data?.[custId] || {};

    return `<div class="card" style="margin-bottom:var(--s4);padding:0;overflow:hidden">
      <div style="padding:var(--s3) var(--s4);background:var(--thead-bg);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span style="font-size:14px;font-weight:700;color:var(--thead-text)">${_esc(custName)}</span>
        <div style="display:flex;gap:var(--s2);flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="MenuModule._editKomposisi('${custId}')">Komposisi: ${komposisi.join(', ')}</button>
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
                    return `<td style="padding:2px 4px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)">
                      <div style="font-size:8px;color:var(--text-3);margin-bottom:1px">${komp}</div>
                      <input type="text" value="${_esc(val)}" placeholder="-"
                        style="width:100%;border:none;background:transparent;padding:2px 4px;font-size:11px;color:var(--text);outline:none;font-family:var(--font)"
                        onfocus="this.style.background='var(--surface2)'" onblur="this.style.background='transparent'"
                        onchange="MenuModule._genSetCell('${custId}','${shift}',${di},'${komp}',this.value)"
                        list="menu-suggestions">
                    </td>`;
                  }).join('')}
                </tr>`).join('')}
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <!-- Datalist for autocomplete from library -->
      <datalist id="menu-suggestions">
        ${_library.slice(0,500).map(m=>`<option value="${_esc(m.nama)}">`).join('')}
      </datalist>
    </div>`;
  }

  // Cell edit
  let _pendingPlan = null;
  function _genSetCell(custId, shift, dayIdx, field, value) {
    if (!_pendingPlan) {
      const existing = _plans.find(p=>p.weekStart===_genWeekStart);
      _pendingPlan = existing ? {...existing, data:{...existing.data}} : {id:Utils.uid(), weekStart:_genWeekStart, customers:_genCustomers, data:{}};
    }
    if (!_pendingPlan.data[custId]) _pendingPlan.data[custId] = {};
    if (!_pendingPlan.data[custId][shift]) _pendingPlan.data[custId][shift] = {};
    if (!_pendingPlan.data[custId][shift][dayIdx]) _pendingPlan.data[custId][shift][dayIdx] = {tema:'',menu:{}};
    if (field==='tema') _pendingPlan.data[custId][shift][dayIdx].tema = value;
    else _pendingPlan.data[custId][shift][dayIdx].menu[field] = value;
    _pendingPlan.customers = _genCustomers;
  }

  async function _genSave() {
    if (!_pendingPlan) { Notify.info('Belum ada perubahan'); return; }
    _pendingPlan.updatedAt = new Date().toISOString();
    _pendingPlan.updatedBy = Auth.currentUser()?.nama||'';
    try {
      await DB.saveMenuPlan(_pendingPlan);
      const idx = _plans.findIndex(p=>p.id===_pendingPlan.id);
      if (idx>=0) _plans[idx]=_pendingPlan; else _plans.push(_pendingPlan);
      Notify.success('Menu plan disimpan');
      _pendingPlan = null;
    } catch(e) { Notify.error('Gagal: '+e.message); }
  }

  let _genDropClickHandler = null;
  function _genToggleDrop(e) {
    e.stopPropagation();
    const drop = document.getElementById('gen-cust-drop');
    const toggle = document.getElementById('gen-cust-toggle');
    if (!drop) return;
    const isOpen = drop.style.display !== 'none';
    drop.style.display = isOpen ? 'none' : 'block';
    toggle && (toggle.style.borderColor = isOpen ? 'var(--border)' : 'var(--primary)');
    if (!isOpen) {
      if (_genDropClickHandler) document.removeEventListener('click', _genDropClickHandler);
      _genDropClickHandler = (ev) => {
        if (!drop.contains(ev.target) && !toggle?.contains(ev.target)) {
          drop.style.display = 'none';
          if (toggle) toggle.style.borderColor = 'var(--border)';
          document.removeEventListener('click', _genDropClickHandler);
          _genDropClickHandler = null;
        }
      };
      setTimeout(() => document.addEventListener('click', _genDropClickHandler), 10);
    }
  }
  function _genToggleAllCust(checked) {
    document.querySelectorAll('.gen-cust-cb:not(:disabled)').forEach(cb => { cb.checked = checked; });
    _genUpdateDropLabel();
  }
  function _genUpdateDropLabel() {
    const n = document.querySelectorAll('.gen-cust-cb:checked').length;
    const lbl = document.getElementById('gen-cust-label');
    if (lbl) lbl.textContent = n ? n + ' customer dipilih' : 'Pilih customer...';
    const all = document.getElementById('gen-cust-all');
    if (all) { const total = document.querySelectorAll('.gen-cust-cb:not(:disabled)').length; all.checked = n > 0 && n === total; all.indeterminate = n > 0 && n < total; }
  }
  function _genAddCustomer() {
    const checked = [...document.querySelectorAll('.gen-cust-cb:checked')].map(cb => cb.value);
    if (!checked.length) return;
    let added = 0;
    checked.forEach(cid => { if (!_genCustomers.includes(cid)) { _genCustomers.push(cid); added++; } });
    if (added) _renderGenerator();
  }
  function _genRemoveCustomer(cid) {
    _genCustomers = _genCustomers.filter(c=>c!==cid);
    _renderGenerator();
  }
  function _genPrevWeek() { const d=new Date(_genWeekStart+'T12:00:00'); d.setDate(d.getDate()-7); _genWeekStart=d.toISOString().slice(0,10); _pendingPlan=null; _renderGenerator(); }
  function _genNextWeek() { const d=new Date(_genWeekStart+'T12:00:00'); d.setDate(d.getDate()+7); _genWeekStart=d.toISOString().slice(0,10); _pendingPlan=null; _renderGenerator(); }
  function _genThisWeek() { _genWeekStart=_getMonday(); _pendingPlan=null; _renderGenerator(); }

  /* ═══ PDF PRINT ═══ */
  function _printMenuPDF(custId) {
    const cust = _customers.find(c=>c.id===custId);
    if (!cust) return;
    const custName = cust.namaShort || cust.nama;
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

    const others = _customers.filter(c=>c.id!==srcId);
    if (!others.length) { Notify.info('Tidak ada customer lain.'); return; }

    const mid = 'copy-menu-'+Date.now();
    Modal.open({ id:mid, title:'Salin Menu '+_esc(srcName)+' ke Customer Lain', size:'modal-md',
      body:`
        <p style="font-size:12px;color:var(--text-2);margin-bottom:var(--s3)">Menu <strong>${_esc(srcName)}</strong> minggu ini akan disalin ke customer yang dipilih di bawah.</p>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s2)">
          <span style="font-size:11px;font-weight:600;color:var(--text-2)">${others.length} customer tersedia</span>
          <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="MenuModule._copyCheckAll('${mid}',true)">Pilih Semua</button>
          <button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="MenuModule._copyCheckAll('${mid}',false)">Batal Semua</button>
        </div>
        <div id="copy-cust-list" style="display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto">
          ${others.map(c=>`
            <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer;transition:.1s"
              onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
              <input type="checkbox" class="copy-cust-cb" value="${c.id}" style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
              <span style="font-size:13px;font-weight:600;color:var(--text)">${_esc(c.namaShort||c.nama)}</span>
              ${c.namaShort&&c.nama!==c.namaShort?`<span style="font-size:10px;color:var(--text-3)">${_esc(c.nama)}</span>`:''}
            </label>`).join('')}
        </div>`,
      footer:`<span id="copy-count" style="font-size:11px;color:var(--text-3)">0 dipilih</span>
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="MenuModule._doCopyMenu('${srcId}','${mid}')">Salin</button>`,
      onOpen: () => {
        document.querySelectorAll('.copy-cust-cb').forEach(cb => {
          cb.addEventListener('change', () => {
            const n = document.querySelectorAll('.copy-cust-cb:checked').length;
            const el = document.getElementById('copy-count');
            if (el) el.textContent = n + ' dipilih';
          });
        });
      },
    });
  }

  function _copyCheckAll(mid, check) {
    document.querySelectorAll('.copy-cust-cb').forEach(cb => { cb.checked = check; });
    const n = check ? document.querySelectorAll('.copy-cust-cb').length : 0;
    const el = document.getElementById('copy-count');
    if (el) el.textContent = n + ' dipilih';
  }

  async function _doCopyMenu(srcId, modalId) {
    const destIds = [...document.querySelectorAll('.copy-cust-cb:checked')].map(cb=>cb.value);
    if (!destIds.length) { Notify.warning('Pilih minimal satu customer tujuan.'); return; }

    const savedPlan = _plans.find(p=>p.weekStart===_genWeekStart);
    const activePlan = (_pendingPlan?.weekStart===_genWeekStart) ? _pendingPlan : savedPlan;
    const srcData = activePlan?.data?.[srcId];
    if (!srcData) { Notify.warning('Data menu sumber tidak ditemukan.'); return; }

    if (!_pendingPlan) {
      _pendingPlan = activePlan
        ? {...activePlan, data:{...activePlan.data}}
        : {id:Utils.uid(), weekStart:_genWeekStart, customers:_genCustomers, data:{}};
    }

    destIds.forEach(dId => {
      // Deep copy srcData so each customer gets independent data
      _pendingPlan.data[dId] = JSON.parse(JSON.stringify(srcData));
      if (!_genCustomers.includes(dId)) _genCustomers.push(dId);
    });
    _pendingPlan.customers = _genCustomers;

    Modal.close(modalId);
    _renderGenerator();
    const names = destIds.map(id=>{ const c=_customers.find(x=>x.id===id); return c?.namaShort||c?.nama||id; }).join(', ');
    Notify.success('Menu disalin ke: '+names+'. Klik Simpan untuk menyimpan.');
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
          ${current.map((k,i)=>`<div class="komp-row" draggable="true" ondragstart="MenuModule._kompDragStart(event,this)" ondragover="MenuModule._kompDragOver(event,this)" ondragleave="this.classList.remove('drag-over')" ondrop="MenuModule._kompDrop(event,this)" ondragend="MenuModule._kompDragEnd()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="flex-shrink:0;opacity:.3"><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>
            <input type="text" class="form-control komp-input" value="${_esc(k)}" style="flex:1;min-height:30px;font-size:13px;background:transparent;border:none;padding:2px 6px">
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;flex-shrink:0">\u00d7</button>
          </div>`).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:var(--s2)" onclick="MenuModule._kompAdd()">+ Tambah Komponen</button>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="MenuModule._saveKomposisi('${custId}','${mid}')">Simpan</button>`,
    });
  }

  async function _saveKomposisi(custId, modalId) {
    const inputs = document.querySelectorAll('.komp-input');
    const komposisi = [...inputs].map(i=>i.value.trim()).filter(Boolean);
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
      <input type="text" class="form-control komp-input" placeholder="Nama komponen..." style="flex:1;min-height:30px;font-size:13px;background:transparent;border:none;padding:2px 6px">
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;flex-shrink:0">\u00d7</button>`;
    list.appendChild(div);
    div.querySelector('input').focus();
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
        _pendingPlan = existing ? {...existing, data:{...existing.data}} : {id:Utils.uid(), weekStart:_genWeekStart, customers:_genCustomers, data:{}};
      }
      _pendingPlan.data[custId] = parsed;
      _pendingPlan.customers = _genCustomers;
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

    // === NASI ===
    ['Nasi Putih','Nasi Uduk','Nasi Kuning','Nasi Liwet','Nasi Goreng','Nasi Kebuli','Nasi Jagung','Nasi Merah','Nasi Tim','Nasi Bakar','Nasi Tutug Oncom','Nasi Gurih','Lontong','Ketupat','Bubur Ayam'].forEach(n=>_m(n,'Nasi','Indonesia','Umum'));
    ['Nasi Goreng Jawa','Nasi Goreng Kampung','Nasi Goreng Seafood','Nasi Goreng Pete','Nasi Goreng Teri'].forEach(n=>_m(n,'Nasi','Indonesia','Jawa'));
    ['Nasi Padang','Nasi Kapau'].forEach(n=>_m(n,'Nasi','Indonesia','Padang'));
    ['Onigiri','Nasi Jepang','Sushi Rice'].forEach(n=>_m(n,'Nasi','Jepang','Umum'));

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
     ['Fuyunghai','Telur fuyunghai saus asam manis','Umum'],['Omurice','Nasi goreng bungkus telur dadar','Jepang'],
    ].forEach(([n,b,t])=>_m(n,'Lauk Kering','Indonesia',t,'Regular',b));

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

  return {
    init, switchTab,
    _libFilter, openMenuDetail, openMenuForm, _saveMenu, deleteMenu,
    _genAddCustomer, _genRemoveCustomer, _genSetCell, _genSave,
    _genPrevWeek, _genNextWeek, _genThisWeek,
    _genToggleDrop, _genToggleAllCust, _genUpdateDropLabel,
    _printMenuPDF, _openCopyModal, _copyCheckAll, _doCopyMenu,
    _editKomposisi, _saveKomposisi,
    _kompDragStart, _kompDragOver, _kompDrop, _kompDragEnd, _kompAdd,
    _aiGenerateMenu, _aiResep,
  };
})();
window.MenuModule = MenuModule;
