/* ============================================
   BECCA V2.0 — Delivery Schedule Module
   Weekly delivery calendar with driver + PIC assignment
   Depends: db.js, utils.js, modal.js, notify.js, auth.js
============================================ */
if(window.BECCA_DEBUG) console.log('[BECCA] DeliveryModule v20260405a loaded');

const DeliveryModule = (() => {
  'use strict';

  let _schedules = [], _orders = [], _customers = [], _employees = [];
  let _weekStart = '';
  const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
  const DAYS_SHORT = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const STATUS = {
    pending:    { label:'Pending',  color:'var(--warning)',  bg:'var(--warning-bg)' },
    in_transit: { label:'Dikirim',  color:'var(--info)',     bg:'var(--info-bg)'    },
    delivered:  { label:'Terkirim', color:'var(--success)',  bg:'var(--success-bg)' },
    cancelled:  { label:'Batal',    color:'var(--danger)',   bg:'var(--danger-bg)'  },
  };
  const SHIFT_ORDER = ['S1','S2','S3','all'];
  const SHIFT_C = {
    S1:  { bg:'rgba(59,130,246,.15)',  text:'#60a5fa', card:'rgba(59,130,246,.06)', border:'rgba(59,130,246,.22)', label:'S1', head:'rgba(59,130,246,.1)' },
    S2:  { bg:'rgba(16,185,129,.15)',  text:'#34d399', card:'rgba(16,185,129,.06)', border:'rgba(16,185,129,.22)', label:'S2', head:'rgba(16,185,129,.1)' },
    S3:  { bg:'rgba(245,158,11,.15)',  text:'#fbbf24', card:'rgba(245,158,11,.06)', border:'rgba(245,158,11,.22)', label:'S3', head:'rgba(245,158,11,.1)' },
    all: { bg:'rgba(148,163,184,.12)', text:'#94a3b8', card:'rgba(148,163,184,.04)',border:'rgba(148,163,184,.15)',label:'All',head:'rgba(148,163,184,.08)' },
  };

  /* ═══ HELPERS ═══ */
  function _toStr(dt) {
    return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  }
  function _getMonday(d) {
    const dt = new Date(d); dt.setHours(12,0,0,0);
    const day = dt.getDay();
    dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
    return _toStr(dt);
  }
  function _weekDays(mon) {
    const r = [];
    for (let i = 0; i < 7; i++) { const d = new Date(mon+'T12:00:00'); d.setDate(d.getDate()+i); r.push(_toStr(d)); }
    return r;
  }
  function _fmtDateFull(s) {
    if (!s) return '-';
    try { return new Date(s+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}); } catch { return s; }
  }
  function _dayName(s) { const d = new Date(s+'T12:00:00'); return DAYS[d.getDay()===0?6:d.getDay()-1]; }
  function _isToday(s) { return s === _toStr(new Date()); }
  function _currentSchedule() { return _schedules.find(sc => sc.weekStart === _weekStart); }
  function _getEntriesForDate(date) { const sc = _currentSchedule(); return sc?.entries?.filter(e => e.date === date) || []; }

  function _getDrivers() {
    return _employees.filter(e => e.status!=='nonaktif' && e.status!=='resign' &&
      ['driver','supir','pengemudi','transport'].some(k => (e.jabatan||'').toLowerCase().includes(k)||(e.divisi||e.departemen||'').toLowerCase().includes(k))
    ).sort((a,b) => (a.nama||'').localeCompare(b.nama||''));
  }
  function _getPIC() {
    return _employees.filter(e => e.status!=='nonaktif' && e.status!=='resign' &&
      ['pramusaji','service','pic','waiter','crew','staff'].some(k => (e.jabatan||'').toLowerCase().includes(k)||(e.divisi||e.departemen||'').toLowerCase().includes(k))
    ).sort((a,b) => (a.nama||'').localeCompare(b.nama||''));
  }
  function _allActiveEmployees() {
    return _employees.filter(e => e.status!=='nonaktif' && e.status!=='resign').sort((a,b) => (a.nama||'').localeCompare(b.nama||''));
  }
  function _customerOptions(date) {
    const map = {};
    _orders.forEach(o => {
      if (o.tglOrder===date && o.namaPerusahaan) {
        const name = o.namaPerusahaan;
        if (!map[name]) {
          const c = _customers.find(x => (x.nama||'').toLowerCase()===name.toLowerCase());
          const id = c?.customerId||'', short = c?.namaShort||'';
          map[name] = { label: (id?'['+id+'] ':'')+name+(short?' ('+short+')':''), value: name };
        }
      }
    });
    return Object.values(map).sort((a,b) => a.label.localeCompare(b.label));
  }
  function _calcPax(name, date) {
    const n = v => Number(v)||0;
    return _orders.filter(o => o.namaPerusahaan===name && o.tglOrder===date)
      .reduce((s,o) => s+n(o.breakfast)+n(o.shift1)+n(o.spare1)+n(o.ot1)+n(o.snack1)+n(o.shift2)+n(o.spare2)+n(o.ot2)+n(o.snack2)+n(o.shift3)+n(o.spare3)+n(o.ot3)+n(o.snack3)+n(o.snackBerat), 0);
  }
  function _custShort(name) {
    const c = _customers.find(x => (x.nama||'').toLowerCase()===(name||'').toLowerCase());
    return c?.namaShort || name || '-';
  }

  /* ═══ PIC CONFLICT ═══ */
  function _buildConflictMap(entries) {
    const map = {};
    entries.forEach(e => {
      const shift = e.shift||'all';
      (e.picIds||[]).forEach(pid => {
        const keys = shift==='all' ? ['S1','S2','S3','all'].map(s=>pid+'::'+s) : [pid+'::'+shift, pid+'::all'];
        keys.forEach(k => { map[k] = (map[k]||0)+1; });
      });
    });
    return map;
  }
  function _picHasConflict(entry, cmap) {
    const shift = entry.shift||'all';
    return (entry.picIds||[]).some(pid => (cmap[pid+'::'+shift]||0) > 1);
  }

  /* ═══ INIT ═══ */
  async function init() {
    const page = document.getElementById('page-delivery');
    if (!page) return;
    _weekStart = _getMonday(new Date());
    page.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-3)">Memuat jadwal delivery...</div>';
    const [schedules, orders, customers, employees] = await Promise.all([
      DB.getDeliverySchedules().catch(()=>[]), DB.getOrders().catch(()=>[]),
      DB.getCustomers().catch(()=>[]), DB.getEmployees().catch(()=>[]),
    ]);
    _schedules=schedules; _orders=orders; _customers=customers; _employees=employees;
    _renderFull(page);
  }

  /* ═══ RENDER FULL ═══ */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-delivery');
    const canEdit = Auth.can('delivery','edit');
    const days = _weekDays(_weekStart);
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left"><h2>Delivery Schedule</h2><p>Jadwal pengiriman mingguan</p></div>
        <div class="page-header-right">
          ${canEdit?`<button class="btn btn-danger btn-sm" onclick="DeliveryModule.resetWeek()" title="Hapus semua jadwal minggu ini">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Reset</button>
          <button class="btn btn-ghost" onclick="DeliveryModule.autoPopulate()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg>
            Auto dari Order</button>`:''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.prevWeek()">\u2039 Minggu Lalu</button>
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.goToday()">Hari Ini</button>
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.nextWeek()">Minggu Depan \u203a</button>
        <div style="flex:1"></div>
        <span style="font-size:13px;font-weight:600;color:var(--heading);background:var(--surface);border:1px solid var(--border2);padding:6px 16px;border-radius:var(--r-full);display:inline-flex;align-items:center;gap:6px;box-shadow:var(--shadow-sm)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          ${_fmtDateFull(_weekStart)} \u2014 ${_fmtDateFull(days[6])}
        </span>
      </div>
      <div class="tabs" style="margin-bottom:var(--s4)">
        <button class="tab-btn active" data-dlv-tab="jadwal" onclick="DeliveryModule.switchTab('jadwal')">\ud83d\udcc5 Jadwal</button>
        <button class="tab-btn" data-dlv-tab="summary" onclick="DeliveryModule.switchTab('summary')">\ud83d\udcca Summary</button>
        <button class="tab-btn" data-dlv-tab="tracking" onclick="DeliveryModule.switchTab('tracking')">\ud83d\udce1 Tracking</button>
      </div>
      <div id="dlv-tab-jadwal"><div id="dlv-grid"></div></div>
      <div id="dlv-tab-summary" class="hidden"></div>
      <div id="dlv-tab-tracking" class="hidden"></div>`;
    _renderWeekGrid();
  }

  /* ═══ RENDER WEEK GRID ═══ */
  function _renderWeekGrid() {
    const el = document.getElementById('dlv-grid');
    if (!el) return;
    const days = _weekDays(_weekStart), canEdit = Auth.can('delivery','edit');

    el.innerHTML = `<div id="dlv-week" style="display:grid;grid-template-columns:repeat(7,1fr);gap:var(--s2);min-height:60vh">
      ${days.map((date,i) => {
        const entries = _getEntriesForDate(date), today = _isToday(date);
        const delivered = entries.filter(e=>e.status==='delivered').length, total = entries.length;
        const cmap = _buildConflictMap(entries);
        // Group by shift, then driver inside each shift
        const shiftGrp = {};
        entries.forEach(e => {
          const s = e.shift||'all';
          if (!shiftGrp[s]) shiftGrp[s] = {};
          const dk = e.driverName||'\u2014 No driver';
          if (!shiftGrp[s][dk]) shiftGrp[s][dk] = [];
          shiftGrp[s][dk].push(e);
        });
        const dt = new Date(date+'T12:00:00');
        return `<div style="background:var(--surface);border:1px solid ${today?'var(--primary)':'var(--border)'};border-radius:var(--r-md);display:flex;flex-direction:column;min-width:0;overflow:hidden;box-shadow:${today?'0 0 0 2px rgba(99,102,241,.15),':''}0 2px 8px rgba(0,0,0,.08)">
          <div style="padding:var(--s3);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:${today?'var(--primary-bg)':'var(--surface2)'}">
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${today?'var(--primary-h)':'var(--text-3)'}">${DAYS_SHORT[i]}</div>
              <div style="display:flex;align-items:baseline;gap:4px">
                <span style="font-size:16px;font-weight:700;color:${today?'var(--primary)':'var(--heading)'}">${dt.getDate()}</span>
                <span style="font-size:10px;font-weight:600;color:${today?'var(--primary-h)':'var(--text-3)'}">${MONTHS_SHORT[dt.getMonth()]}</span>
              </div>
            </div>
            <div style="text-align:right">
              ${total>0?`<div style="font-size:10px;color:var(--text-3)">${delivered}/${total}</div>`:''}
              ${canEdit?`<button class="btn-icon" style="width:24px;height:24px" onclick="DeliveryModule.openModal(null,'${date}')" title="Tambah"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 5v14M5 12h14"/></svg></button>`:''}
            </div>
          </div>
          <div style="flex:1;overflow-y:auto;padding:var(--s2)">
            ${!total?'<div style="text-align:center;padding:var(--s6) var(--s2);color:var(--text-3);font-size:11px">Belum ada</div>':
              SHIFT_ORDER.filter(s=>shiftGrp[s]).map(s=>{
                const sc=SHIFT_C[s]||SHIFT_C.all;
                const drivers=shiftGrp[s];
                return `<div style="margin-bottom:var(--s3)">
                  <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:2px 6px;border-radius:4px;display:inline-block;background:${sc.head};color:${sc.text};margin-bottom:3px">${sc.label}</div>
                  ${Object.entries(drivers).map(([drv,items])=>`<div style="margin-bottom:2px">
                    <div style="font-size:8px;font-weight:700;color:var(--text-3);padding:1px 0;display:flex;align-items:center;gap:3px;overflow:hidden">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="8" height="8" style="flex-shrink:0"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${drv}</span>
                    </div>
                    ${items.map(e=>_renderCard(e,canEdit,cmap)).join('')}
                  </div>`).join('')}
                </div>`;
              }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
    <style>
      @media(max-width:1100px){
        #dlv-week{grid-template-columns:repeat(7,minmax(180px,1fr))!important}
        #dlv-grid{overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;padding-bottom:var(--s2)}
        #dlv-week>div{scroll-snap-align:start;min-width:180px}
      }
      @media(max-width:768px){
        #dlv-week{grid-template-columns:repeat(7,minmax(160px,1fr))!important;min-height:auto!important}
        #dlv-week>div{min-width:160px}
      }
    </style>`;
  }

  /* ═══ RENDER CARD ═══ */
  function _renderCard(entry, canEdit, cmap) {
    const st = STATUS[entry.status]||STATUS.pending;
    const conflict = _picHasConflict(entry, cmap);
    const sc = SHIFT_C[entry.shift]||SHIFT_C.all;
    const bg = conflict ? 'rgba(239,68,68,.07)' : sc.card;
    const bdr = conflict ? 'var(--danger)' : sc.border;

    return `<div onclick="${canEdit?`DeliveryModule.openModal('${entry.id}','${entry.date}')`:'void(0)'}"
      style="background:${bg};border:1px solid ${bdr};border-radius:var(--r-sm);padding:var(--s2) var(--s3);margin-bottom:4px;cursor:${canEdit?'pointer':'default'};transition:all var(--t-fast)"
      onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:1px">
        <span onclick="event.stopPropagation();DeliveryModule.cycleStatus('${entry.id}')" title="${st.label}"
          style="width:8px;height:8px;border-radius:50%;background:${st.color};cursor:pointer;flex-shrink:0"></span>
        <div style="font-size:11px;font-weight:700;color:var(--heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${_custShort(entry.customerName)}</div>
      </div>
      ${(entry.picNames||[]).length?`<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:1px">
        ${(entry.picNames||[]).map(name=>`<span style="font-size:8px;font-weight:600;padding:0 4px;border-radius:var(--r-full);background:${conflict?'var(--danger-bg)':'rgba(148,163,184,.12)'};color:${conflict?'var(--danger)':'var(--text-2)'}">${name}</span>`).join('')}
        ${conflict?'<span style="font-size:9px;color:var(--danger)">\u26a0</span>':''}
      </div>`:''}
      ${entry.totalPax?`<div style="font-size:9px;color:var(--text-3)">${entry.totalPax} pax${entry.deliveryTime?' \u00b7 '+entry.deliveryTime:''}</div>`:''}
    </div>`;
  }

  /* ═══ WEEK NAV ═══ */
  function prevWeek() { const d=new Date(_weekStart+'T12:00:00'); d.setDate(d.getDate()-7); _weekStart=_toStr(d); _renderFull(); }
  function nextWeek() { const d=new Date(_weekStart+'T12:00:00'); d.setDate(d.getDate()+7); _weekStart=_toStr(d); _renderFull(); }
  function goToday()  { _weekStart=_getMonday(new Date()); _renderFull(); }

  /* ═══ MODAL ═══ */
  function openModal(entryId, date) {
    const sc = _currentSchedule();
    const existing = entryId&&sc ? (sc.entries||[]).find(e=>e.id===entryId) : null;
    if (!Auth.can('delivery','edit')) return;
    const drivers=_getDrivers(), pics=_getPIC(), allEmps=_allActiveEmployees(), custOpts=_customerOptions(date);
    const driverList=drivers.length?drivers:allEmps, picList=pics.length?pics:allEmps;
    const mid='dlv-'+Date.now(), dayLabel=_dayName(date)+', '+_fmtDateFull(date), selPics=existing?(existing.picIds||[]):[];

    // Count usage per day (exclude current entry being edited)
    const dayEntries = _getEntriesForDate(date).filter(e => e.id !== entryId);
    const picUsage = {};  // picId → count
    const drvUsage = {};  // driverId → count
    dayEntries.forEach(e => {
      (e.picIds||[]).forEach(pid => { picUsage[pid] = (picUsage[pid]||0)+1; });
      if (e.driverId) drvUsage[e.driverId] = (drvUsage[e.driverId]||0)+1;
    });

    Modal.open({ id:mid, title:existing?'Edit Delivery':'Tambah Delivery', size:'modal-lg',
      body: `
        <input type="hidden" id="dlv-modal-date" value="${date}">
        <div style="font-size:13px;color:var(--primary-h);font-weight:600;margin-bottom:var(--s4)">${dayLabel}</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer <span class="req">*</span></label>
            <input type="text" id="dlv-customer" class="form-control" placeholder="Klik atau ketik untuk cari..." value="${existing?.customerName||''}" autocomplete="off">
            <div style="font-size:10px;color:var(--text-3);margin-top:2px">${custOpts.length} customer</div>
          </div>
          <div class="form-group">
            <label class="form-label">Driver</label>
            <input type="text" id="dlv-driver" class="form-control" placeholder="Klik atau ketik untuk cari..." value="${existing?.driverName||''}" autocomplete="off">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">PIC / Pramusaji</label>
          <input type="text" id="dlv-pic-search" class="form-control" placeholder="Cari nama PIC..." oninput="DeliveryModule._filterPIC(this.value)" style="margin-bottom:var(--s2)">
          <div id="dlv-pic-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s2)">
            ${picList.map(e=>{
              const cnt = picUsage[e.id]||0;
              const bColor = cnt>=3?'var(--danger)':cnt>=2?'var(--warning)':'var(--info)';
              const bBg = cnt>=3?'var(--danger-bg)':cnt>=2?'var(--warning-bg)':'var(--info-bg)';
              const badge = cnt?`<span style="font-size:9px;font-weight:700;padding:0 6px;border-radius:var(--r-full);background:${bBg};color:${bColor};margin-left:auto;flex-shrink:0">${cnt}x</span>`:'';
              return `<label class="form-check dlv-pic-item" style="padding:5px var(--s2);display:flex;align-items:center;border-radius:var(--r-sm);cursor:pointer" data-name="${(e.nama||'').toLowerCase()}">
                <input type="checkbox" value="${e.id}" data-nama="${e.nama}" ${selPics.includes(e.id)?'checked':''} style="accent-color:var(--primary);width:16px;height:16px;cursor:pointer;flex-shrink:0">
                <span style="flex:1;margin-left:var(--s2);font-size:13px">${e.nama}${e.jabatan?` <span style="color:var(--text-3);font-size:11px">\u00b7 ${e.jabatan}</span>`:''}</span>
                ${badge}
              </label>`;}).join('')}
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">Shift</label>
            <select id="dlv-shift" class="form-control">
              <option value="all" ${!existing||existing.shift==='all'?'selected':''}>Semua Shift</option>
              <option value="S1" ${existing?.shift==='S1'?'selected':''}>Shift 1</option>
              <option value="S2" ${existing?.shift==='S2'?'selected':''}>Shift 2</option>
              <option value="S3" ${existing?.shift==='S3'?'selected':''}>Shift 3</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Waktu Kirim</label>
            <input type="time" id="dlv-time" class="form-control" value="${existing?.deliveryTime||''}">
          </div>
          <div class="form-group"><label class="form-label">Total Pax</label>
            <input type="number" id="dlv-pax" class="form-control" value="${existing?.totalPax||''}" placeholder="Auto">
          </div>
        </div>
        <div class="form-group"><label class="form-label">Status</label>
          <div style="display:flex;gap:var(--s2);flex-wrap:wrap">
            ${Object.entries(STATUS).map(([k,v])=>`<label style="padding:4px 10px;border-radius:var(--r-full);border:1px solid ${v.color}30;background:${existing&&existing.status===k?v.bg:'transparent'};cursor:pointer;display:flex;align-items:center;gap:4px">
              <input type="radio" name="dlv-status" value="${k}" ${(existing?existing.status:k==='pending'?'pending':'')===k?'checked':''} style="display:none">
              <span style="width:8px;height:8px;border-radius:50%;background:${v.color}"></span>
              <span style="font-size:12px;font-weight:600;color:${v.color}">${v.label}</span>
            </label>`).join('')}
          </div>
        </div>
        <div class="form-group"><label class="form-label">Catatan</label>
          <textarea id="dlv-notes" class="form-control" rows="2" placeholder="Opsional...">${existing?.notes||''}</textarea>
        </div>`,
      footer: `${existing?`<button class="btn btn-danger" onclick="DeliveryModule.deleteEntry('${entryId}','${mid}')">Hapus</button>`:''}<div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="DeliveryModule.saveEntry('${entryId||''}','${date}','${mid}')">Simpan</button>`,
    });
    // Init combos
    const ci = document.getElementById('dlv-customer');
    if (ci) Utils.initCombo(ci, custOpts, { onSelect(item) { ci.value=item.value; const p=document.getElementById('dlv-pax'); if(p&&!existing){const x=_calcPax(item.value,date);if(x>0)p.value=x;} } });
    // Driver — dropdown with usage badge in label
    const di = document.getElementById('dlv-driver');
    if (di) {
      const dOpts = driverList.map(e=>{
        const cnt = drvUsage[e.id]||0;
        const tag = cnt ? ` (${cnt}x)` : '';
        return {label:e.nama+(e.jabatan?' \u00b7 '+e.jabatan:'')+tag, value:e.id, nama:e.nama};
      });
      Utils.initCombo(di, dOpts, { onSelect(item){di.value=item.nama;di.dataset.id=item.value;} });
      if (existing?.driverId) di.dataset.id=existing.driverId;
    }
  }

  function _filterPIC(q) {
    const l = q.toLowerCase();
    document.querySelectorAll('.dlv-pic-item').forEach(el => { el.style.display = el.dataset.name.includes(l) ? '' : 'none'; });
  }

  /* ═══ SAVE ═══ */
  async function saveEntry(entryId, date, modalId) {
    const customerName = (document.getElementById('dlv-customer')?.value||'').trim();
    if (!customerName) { Notify.warning('Pilih customer'); return; }
    const di = document.getElementById('dlv-driver');
    const driverId = di?.dataset?.id||'', driverName = (di?.value||'').trim();
    const picChecks = document.querySelectorAll('#dlv-pic-list input[type="checkbox"]:checked');
    const picIds=[...picChecks].map(c=>c.value), picNames=[...picChecks].map(c=>c.dataset.nama);
    const status = (document.querySelector('input[name="dlv-status"]:checked')||{}).value||'pending';
    const shift = document.getElementById('dlv-shift').value;
    const deliveryTime = document.getElementById('dlv-time').value;
    const totalPax = parseInt(document.getElementById('dlv-pax').value)||0;
    const notes = document.getElementById('dlv-notes').value.trim();

    let sc = _currentSchedule();
    if (!sc) { const days=_weekDays(_weekStart); sc={id:Utils.uid(),weekStart:_weekStart,weekEnd:days[6],entries:[],createdBy:Auth.currentUser()?.nama||'',createdAt:new Date().toISOString()}; _schedules.push(sc); }
    if (!sc.entries) sc.entries=[];
    const cust = _customers.find(c=>(c.nama||'').toLowerCase()===customerName.toLowerCase());
    const data = { id:entryId||Utils.uid(), date, customerId:cust?.id||'', customerName, driverId, driverName, picIds, picNames, shift, status, deliveryTime, totalPax, notes, updatedBy:Auth.currentUser()?.nama||'', updatedAt:new Date().toISOString() };
    if (entryId) { const idx=sc.entries.findIndex(e=>e.id===entryId); if(idx>=0)sc.entries[idx]=data; else sc.entries.push(data); } else sc.entries.push(data);
    try { await DB.saveDeliverySchedule(sc); Notify.success(entryId?'Diperbarui':'Ditambahkan'); } catch(e) { Notify.error('Gagal: '+e.message); }
    Modal.close(modalId); _renderWeekGrid();
  }

  /* ═══ DELETE ═══ */
  async function deleteEntry(entryId, modalId) {
    if (!confirm('Hapus delivery ini?')) return;
    const sc = _currentSchedule(); if(!sc) return;
    sc.entries = (sc.entries||[]).filter(e=>e.id!==entryId);
    try { await DB.saveDeliverySchedule(sc); Notify.success('Dihapus'); } catch { Notify.error('Gagal'); }
    Modal.close(modalId); _renderWeekGrid();
  }

  /* ═══ CYCLE STATUS ═══ */
  async function cycleStatus(entryId) {
    const sc=_currentSchedule(); if(!sc||!Auth.can('delivery','edit')) return;
    const e = (sc.entries||[]).find(x=>x.id===entryId); if(!e) return;
    const ord=['pending','in_transit','delivered']; e.status=ord[(ord.indexOf(e.status)+1)%ord.length];
    e.updatedBy=Auth.currentUser()?.nama||''; e.updatedAt=new Date().toISOString();
    try { await DB.saveDeliverySchedule(sc); } catch {} _renderWeekGrid();
  }

  /* ═══ AUTO POPULATE — 1 card per customer per shift ═══ */
  async function autoPopulate() {
    const days=_weekDays(_weekStart);
    let sc=_currentSchedule();
    if (!sc) { sc={id:Utils.uid(),weekStart:_weekStart,weekEnd:days[6],entries:[],createdBy:Auth.currentUser()?.nama||'',createdAt:new Date().toISOString()}; _schedules.push(sc); }
    if (!sc.entries) sc.entries=[];
    const n=v=>Number(v)||0;
    let added=0;
    days.forEach(date => {
      // Aggregate per customer per shift
      const map = {}; // key: "custName::shift" → pax
      _orders.filter(o=>o.tglOrder===date).forEach(o => {
        const name=o.namaPerusahaan; if(!name) return;
        const s1 = n(o.breakfast)+n(o.shift1)+n(o.spare1)+n(o.ot1)+n(o.snack1);
        const s2 = n(o.shift2)+n(o.spare2)+n(o.ot2)+n(o.snack2);
        const s3 = n(o.shift3)+n(o.spare3)+n(o.ot3)+n(o.snack3);
        if (s1>0) { const k=name+'::S1'; map[k]=(map[k]||0)+s1; }
        if (s2>0) { const k=name+'::S2'; map[k]=(map[k]||0)+s2; }
        if (s3>0) { const k=name+'::S3'; map[k]=(map[k]||0)+s3; }
      });
      Object.entries(map).forEach(([key,pax]) => {
        const [cn,shift] = key.split('::');
        if (sc.entries.some(e=>e.date===date&&e.customerName===cn&&e.shift===shift)) return;
        const c=_customers.find(x=>(x.nama||'').toLowerCase()===cn.toLowerCase());
        sc.entries.push({id:Utils.uid(),date,customerId:c?.id||'',customerName:cn,driverId:'',driverName:'',picIds:[],picNames:[],shift,status:'pending',deliveryTime:'',totalPax:pax,notes:'',updatedBy:Auth.currentUser()?.nama||'',updatedAt:new Date().toISOString()});
        added++;
      });
    });
    if (!added) { Notify.info('Tidak ada order baru'); return; }
    try { await DB.saveDeliverySchedule(sc); Notify.success(added+' delivery ditambahkan'); } catch(e) { Notify.error('Gagal: '+e.message); }
    _renderWeekGrid();
  }

  /* ═══ RESET WEEK ═══ */
  async function resetWeek() {
    const sc = _currentSchedule();
    if (!sc || !(sc.entries||[]).length) { Notify.info('Tidak ada jadwal untuk direset'); return; }
    if (!confirm('Hapus SEMUA jadwal delivery minggu ini? (' + sc.entries.length + ' entry)')) return;
    sc.entries = [];
    try { await DB.saveDeliverySchedule(sc); Notify.success('Jadwal minggu ini direset'); } catch(e) { Notify.error('Gagal: '+e.message); }
    _renderWeekGrid();
  }

  /* ═══ TABS ═══ */
  function switchTab(tab) {
    document.querySelectorAll('[data-dlv-tab]').forEach(b => b.classList.toggle('active', b.dataset.dlvTab===tab));
    ['jadwal','summary','tracking'].forEach(t => {
      const el = document.getElementById('dlv-tab-'+t);
      if (el) el.classList.toggle('hidden', t!==tab);
    });
    if (tab==='summary') _renderSummary();
    if (tab==='tracking') _renderTracking();
  }

  /* ═══ SUMMARY ═══ */
  function _renderSummary() {
    const el = document.getElementById('dlv-tab-summary');
    if (!el) return;
    const sc = _currentSchedule();
    const entries = sc?.entries || [];
    const totalEntries = entries.length;
    const totalDelivered = entries.filter(e=>e.status==='delivered').length;
    const totalPax = entries.reduce((s,e)=>s+(e.totalPax||0),0);
    const deliveredPax = entries.filter(e=>e.status==='delivered').reduce((s,e)=>s+(e.totalPax||0),0);
    const uniqueCustomers = new Set(entries.map(e=>e.customerName)).size;

    // Driver stats
    const drvMap = {};
    entries.forEach(e => {
      const name = e.driverName || '— Belum assign';
      if (!drvMap[name]) drvMap[name] = { trips:0, customers:new Set(), pax:0, delivered:0 };
      drvMap[name].trips++;
      if (e.customerName) drvMap[name].customers.add(e.customerName);
      drvMap[name].pax += e.totalPax||0;
      if (e.status==='delivered') drvMap[name].delivered++;
    });

    // PIC stats
    const picMap = {};
    entries.forEach(e => {
      (e.picNames||[]).forEach((name,idx) => {
        if (!picMap[name]) picMap[name] = { trips:0, customers:new Set(), pax:0, delivered:0 };
        picMap[name].trips++;
        if (e.customerName) picMap[name].customers.add(e.customerName);
        picMap[name].pax += e.totalPax||0;
        if (e.status==='delivered') picMap[name].delivered++;
      });
    });

    const drvRows = Object.entries(drvMap).sort((a,b)=>b[1].trips-a[1].trips);
    const picRows = Object.entries(picMap).sort((a,b)=>b[1].trips-a[1].trips);

    el.innerHTML = `
      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--s3);margin-bottom:var(--s5)">
        <div class="stat-card blue"><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;font-weight:600;letter-spacing:.04em;margin-bottom:4px">Total Pengiriman</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:var(--heading)">${totalEntries}</div>
          <div style="font-size:11px;color:var(--text-3)">${totalDelivered} terkirim</div></div>
        <div class="stat-card green"><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;font-weight:600;letter-spacing:.04em;margin-bottom:4px">Total Pax</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:var(--success)">${totalPax.toLocaleString('id')}</div>
          <div style="font-size:11px;color:var(--text-3)">${deliveredPax.toLocaleString('id')} terkirim</div></div>
        <div class="stat-card purple"><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;font-weight:600;letter-spacing:.04em;margin-bottom:4px">Customer</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:var(--primary-h)">${uniqueCustomers}</div></div>
        <div class="stat-card yellow"><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;font-weight:600;letter-spacing:.04em;margin-bottom:4px">Driver Aktif</div>
          <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:var(--warning)">${drvRows.filter(([n])=>n!=='— Belum assign').length}</div></div>
      </div>

      <!-- Driver Table -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div class="card-header"><span class="card-title">Rekap Driver</span></div>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>#</th><th>Driver</th><th class="num">Pengiriman</th><th class="num">Customer</th><th class="num">Total Pax</th><th class="num">Terkirim</th></tr></thead>
          <tbody>
            ${drvRows.length ? drvRows.map(([name,d],i)=>`<tr>
              <td style="color:var(--text-3)">${i+1}</td>
              <td style="font-weight:600">${name}</td>
              <td class="num"><span style="font-family:var(--font-mono);font-weight:700">${d.trips}</span></td>
              <td class="num">${d.customers.size}</td>
              <td class="num" style="font-family:var(--font-mono)">${d.pax.toLocaleString('id')}</td>
              <td class="num"><span style="padding:2px 8px;border-radius:var(--r-full);font-size:11px;font-weight:700;background:${d.delivered===d.trips?'var(--success-bg)':'var(--warning-bg)'};color:${d.delivered===d.trips?'var(--success)':'var(--warning)'}">${d.delivered}/${d.trips}</span></td>
            </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:var(--s6);color:var(--text-3)">Belum ada data</td></tr>'}
          </tbody>
        </table></div>
      </div>

      <!-- PIC Table -->
      <div class="card">
        <div class="card-header"><span class="card-title">Rekap PIC / Pramusaji</span></div>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>#</th><th>Nama PIC</th><th class="num">Penugasan</th><th class="num">Customer</th><th class="num">Total Pax</th><th class="num">Terkirim</th></tr></thead>
          <tbody>
            ${picRows.length ? picRows.map(([name,d],i)=>`<tr>
              <td style="color:var(--text-3)">${i+1}</td>
              <td style="font-weight:600">${name}</td>
              <td class="num"><span style="font-family:var(--font-mono);font-weight:700">${d.trips}</span></td>
              <td class="num">${d.customers.size}</td>
              <td class="num" style="font-family:var(--font-mono)">${d.pax.toLocaleString('id')}</td>
              <td class="num"><span style="padding:2px 8px;border-radius:var(--r-full);font-size:11px;font-weight:700;background:${d.delivered===d.trips?'var(--success-bg)':'var(--warning-bg)'};color:${d.delivered===d.trips?'var(--success)':'var(--warning)'}">${d.delivered}/${d.trips}</span></td>
            </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:var(--s6);color:var(--text-3)">Belum ada data</td></tr>'}
          </tbody>
        </table></div>
      </div>
    `;
  }

  /* ═══ TRACKING ═══ */
  let _trackingInterval = null, _trackingDriverId = null, _trackingDate = '';
  let _trackingLogs = [], _checkpoints = [];

  function _haversine(lat1,lon1,lat2,lon2) {
    const R=6371000, rad=Math.PI/180;
    const dLat=(lat2-lat1)*rad, dLon=(lon2-lon1)*rad;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  async function _loadAllCheckpoints() {
    const settings = await DB.getSettings().catch(()=>({}));
    const bps = settings.bpsLat ? [{id:'bps',nama:settings.bpsLocationName||'BPS Office',lat:+settings.bpsLat,lng:+settings.bpsLng,type:'bps'}] : [];
    const custCPs = _customers.filter(c=>c.lat&&c.lng).map(c=>({id:c.id,nama:c.namaShort||c.nama,lat:+c.lat,lng:+c.lng,type:'customer'}));
    const custom = await DB.getDeliveryCheckpoints().catch(()=>[]);
    _checkpoints = [...bps,...custCPs,...custom.map(c=>({...c,type:'custom'}))];
    return _checkpoints;
  }

  function _findNearest(lat,lng) {
    let best=null, bestDist=Infinity;
    _checkpoints.forEach(cp=>{
      if(!cp.lat||!cp.lng) return;
      const d=_haversine(lat,lng,cp.lat,cp.lng);
      if(d<bestDist){bestDist=d;best={...cp,distance:d};}
    });
    return best;
  }

  async function _pingLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      const {latitude:lat,longitude:lng}=pos.coords;
      const nearest=_findNearest(lat,lng);
      const drv=_employees.find(e=>e.id===_trackingDriverId);
      const log={
        id:Utils.uid(), driverId:_trackingDriverId, driverName:drv?.nama||'',
        date:_trackingDate, timestamp:new Date().toISOString(),
        lat,lng,
        nearestId:nearest?.id||null, nearestName:nearest?.nama||null,
        distanceM:nearest?Math.round(nearest.distance):null,
        status:nearest&&nearest.distance<200?'at_checkpoint':'moving',
      };
      await DB.saveDeliveryTrackingLog(log).catch(()=>{});
      _trackingLogs.push(log);
      _renderTracking();
      // Push notification jika tiba di checkpoint
      if(log.status==='at_checkpoint'&&typeof PushModule!=='undefined'){
        PushModule.sendToRole?.('admin',{title:'Driver Tiba',body:`${log.driverName} tiba di ${log.nearestName}`}).catch(()=>{});
      }
    },(err)=>{ Notify.warning('GPS error: '+err.message); if(err.code===1){stopTracking();Notify.error('Akses lokasi ditolak — tracking dihentikan');} },{enableHighAccuracy:true,timeout:30000});
  }

  async function startTracking(driverId) {
    if(!driverId){Notify.warning('Pilih driver terlebih dahulu');return;}
    if(!navigator.geolocation){Notify.error('Browser tidak mendukung GPS');return;}
    if(_trackingInterval) stopTracking();
    _trackingDriverId=driverId;
    _trackingDate=_toStr(new Date());
    await _loadAllCheckpoints();
    // Load existing logs for today
    const allLogs=await DB.getDeliveryTrackingLogs().catch(()=>[]);
    _trackingLogs=allLogs.filter(l=>l.driverId===driverId&&l.date===_trackingDate).sort((a,b)=>(a.timestamp||'').localeCompare(b.timestamp||''));
    _pingLocation();
    _trackingInterval=setInterval(()=>_pingLocation(),5*60*1000);
    _renderTracking();
    Notify.success('Tracking dimulai — update setiap 5 menit');
  }

  function stopTracking() {
    if(_trackingInterval) clearInterval(_trackingInterval);
    _trackingInterval=null; _trackingDriverId=null;
    _renderTracking();
    Notify.info('Tracking dihentikan');
  }

  async function _renderTracking() {
    const el=document.getElementById('dlv-tab-tracking');
    if(!el) return;
    if(!_checkpoints.length) await _loadAllCheckpoints();
    const drivers=_getDrivers();
    const allEmps=_allActiveEmployees();
    const driverList=drivers.length?drivers:allEmps;
    const isActive=!!_trackingInterval;
    const activeDrv=_employees.find(e=>e.id===_trackingDriverId);

    el.innerHTML=`
      <!-- Controls -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div style="padding:var(--s4);display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap">
          <div class="form-group" style="margin:0;flex:1;min-width:200px">
            <label class="form-label">Pilih Driver</label>
            <select id="trk-driver" class="form-control" ${isActive?'disabled':''}>
              <option value="">— Pilih Driver —</option>
              ${driverList.map(e=>`<option value="${e.id}" ${_trackingDriverId===e.id?'selected':''}>${e.nama}${e.jabatan?' \u00b7 '+e.jabatan:''}</option>`).join('')}
            </select>
          </div>
          ${isActive
            ?`<button class="btn btn-danger" onclick="DeliveryModule.stopTracking()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                Stop Tracking</button>
              <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--success);font-weight:600">
                <span style="width:8px;height:8px;border-radius:50%;background:var(--success);animation:pulse 1.5s infinite"></span>
                Aktif — ${activeDrv?.nama||''}</span>`
            :`<button class="btn btn-primary" onclick="DeliveryModule.startTracking(document.getElementById('trk-driver').value)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start Tracking</button>`}
          <div style="margin-left:auto"><button class="btn btn-ghost btn-sm" onclick="DeliveryModule.openCheckpointManager()">Kelola Checkpoint</button></div>
        </div>
      </div>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}</style>

      ${isActive||_trackingLogs.length?`
      <!-- Checkpoint Progress -->
      <div class="card" style="margin-bottom:var(--s4)">
        <div class="card-header"><span class="card-title">Checkpoint Progress</span><span style="font-size:11px;color:var(--text-3)">${_trackingDate}</span></div>
        <div style="padding:var(--s4)">
          ${_checkpoints.length?_checkpoints.map(cp=>{
            const visited=_trackingLogs.find(l=>l.nearestId===cp.id&&l.status==='at_checkpoint');
            const lastLog=_trackingLogs.length?_trackingLogs[_trackingLogs.length-1]:null;
            const dist=lastLog?_haversine(lastLog.lat,lastLog.lng,cp.lat,cp.lng):null;
            const dotColor=visited?'var(--success)':dist!==null&&dist<500?'var(--info)':'var(--text-3)';
            return `<div style="display:flex;align-items:center;gap:var(--s3);padding:var(--s2) 0;border-bottom:1px solid var(--border)">
              <span style="width:12px;height:12px;border-radius:50%;background:${dotColor};flex-shrink:0"></span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--heading)">${cp.nama} <span style="font-size:10px;color:var(--text-3);font-weight:400">${cp.type}</span></div>
                <a href="https://www.google.com/maps?q=${cp.lat},${cp.lng}" target="_blank" style="font-size:10px;color:var(--primary-h)">${cp.lat.toFixed(5)}, ${cp.lng.toFixed(5)}</a>
              </div>
              ${visited?`<span style="font-size:11px;color:var(--success);font-weight:600">\u2713 ${new Date(visited.timestamp).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</span>`
                :dist!==null?`<span style="font-size:11px;color:var(--text-3)">${dist<1000?Math.round(dist)+'m':(dist/1000).toFixed(1)+'km'}</span>`
                :''}
            </div>`;}).join(''):'<div style="color:var(--text-3);padding:var(--s4);text-align:center">Belum ada checkpoint. Tambahkan lokasi di Customer atau Kelola Checkpoint.</div>'}
        </div>
      </div>

      <!-- Tracking Log Table -->
      <div class="card">
        <div class="card-header"><span class="card-title">Log Tracking</span><span style="font-size:11px;color:var(--text-3)">${_trackingLogs.length} ping</span></div>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>Waktu</th><th>Koordinat</th><th>Checkpoint Terdekat</th><th class="num">Jarak</th><th>Status</th></tr></thead>
          <tbody>
            ${_trackingLogs.length?[..._trackingLogs].reverse().map(l=>{
              const stColor=l.status==='at_checkpoint'?'var(--success)':l.status==='moving'?'var(--info)':'var(--text-3)';
              const stLabel=l.status==='at_checkpoint'?'Di Checkpoint':l.status==='moving'?'Bergerak':'Idle';
              return `<tr>
                <td style="white-space:nowrap;font-family:var(--font-mono);font-size:12px">${new Date(l.timestamp).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                <td><a href="https://www.google.com/maps?q=${l.lat},${l.lng}" target="_blank" style="font-size:11px">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</a></td>
                <td>${l.nearestName||'-'}</td>
                <td class="num" style="font-family:var(--font-mono)">${l.distanceM!=null?(l.distanceM<1000?l.distanceM+'m':(l.distanceM/1000).toFixed(1)+'km'):'-'}</td>
                <td><span style="font-size:11px;font-weight:600;color:${stColor}">${stLabel}</span></td>
              </tr>`;}).join(''):'<tr><td colspan="5" style="text-align:center;padding:var(--s6);color:var(--text-3)">Belum ada log tracking</td></tr>'}
          </tbody>
        </table></div>
      </div>`:'<div style="text-align:center;padding:var(--s8);color:var(--text-3)">Pilih driver dan klik Start Tracking untuk memulai</div>'}
    `;
  }

  /* ═══ CHECKPOINT MANAGER ═══ */
  async function openCheckpointManager() {
    await _loadAllCheckpoints();
    const custom=await DB.getDeliveryCheckpoints().catch(()=>[]);
    const mid='cp-mgr-'+Date.now();
    Modal.open({id:mid,title:'Kelola Checkpoint',size:'modal-lg',
      body:`
        <div class="table-scroll"><table class="table">
          <thead><tr><th>Nama</th><th>Lat</th><th>Lng</th><th>Tipe</th><th>Maps</th><th></th></tr></thead>
          <tbody>
            ${_checkpoints.map(cp=>`<tr>
              <td style="font-weight:600">${cp.nama}</td>
              <td style="font-family:var(--font-mono);font-size:11px">${cp.lat?.toFixed(5)||'-'}</td>
              <td style="font-family:var(--font-mono);font-size:11px">${cp.lng?.toFixed(5)||'-'}</td>
              <td><span class="badge ${cp.type==='bps'?'badge-info':cp.type==='customer'?'badge-primary':'badge-warning'}">${cp.type}</span></td>
              <td><a href="https://www.google.com/maps?q=${cp.lat},${cp.lng}" target="_blank" style="font-size:11px;display:inline-flex;align-items:center;gap:3px;color:var(--primary-h)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>Maps</a></td>
              <td>${cp.type==='custom'?`<button class="btn-icon" style="color:var(--danger)" onclick="DeliveryModule.deleteCheckpoint('${cp.id}','${mid}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>`:''}</td>
            </tr>`).join('')}
            ${!_checkpoints.length?'<tr><td colspan="6" style="text-align:center;padding:var(--s4);color:var(--text-3)">Belum ada checkpoint</td></tr>':''}
          </tbody>
        </table></div>
        <div style="margin-top:var(--s4);padding-top:var(--s4);border-top:1px solid var(--border)">
          <h4 style="margin-bottom:var(--s3)">Tambah Checkpoint Baru</h4>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:var(--s2);align-items:end">
            <div class="form-group" style="margin:0"><label class="form-label">Nama</label><input id="cp-nama" class="form-control" placeholder="Nama lokasi"></div>
            <div class="form-group" style="margin:0"><label class="form-label">Lat</label><input id="cp-lat" class="form-control" type="number" step="any" placeholder="-6.xxx"></div>
            <div class="form-group" style="margin:0"><label class="form-label">Lng</label><input id="cp-lng" class="form-control" type="number" step="any" placeholder="107.xxx"></div>
            <button class="btn btn-primary btn-sm" onclick="DeliveryModule.addCheckpoint('${mid}')">+ Tambah</button>
          </div>
        </div>`,
      footer:`<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });
  }

  async function addCheckpoint(modalId) {
    const nama=(document.getElementById('cp-nama')?.value||'').trim();
    const lat=parseFloat(document.getElementById('cp-lat')?.value);
    const lng=parseFloat(document.getElementById('cp-lng')?.value);
    if(!nama){Notify.warning('Nama checkpoint wajib diisi');return;}
    if(isNaN(lat)||isNaN(lng)){Notify.warning('Latitude dan Longitude wajib diisi');return;}
    await DB.saveDeliveryCheckpoint({nama,lat,lng});
    Notify.success('Checkpoint "'+nama+'" ditambahkan');
    Modal.close(modalId);
    openCheckpointManager();
  }

  async function deleteCheckpoint(id,modalId) {
    if(!confirm('Hapus checkpoint ini?')) return;
    await DB.deleteDeliveryCheckpoint(id);
    Notify.success('Checkpoint dihapus');
    Modal.close(modalId);
    openCheckpointManager();
  }

  return { init, prevWeek, nextWeek, goToday, openModal, saveEntry, deleteEntry, cycleStatus, autoPopulate, resetWeek, switchTab, startTracking, stopTracking, openCheckpointManager, addCheckpoint, deleteCheckpoint, _filterPIC };
})();
window.DeliveryModule = DeliveryModule;
