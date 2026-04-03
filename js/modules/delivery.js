/* ============================================
   BECCA V2.0 — Delivery Schedule Module
   Weekly delivery calendar with driver + PIC assignment
   Depends: db.js, utils.js, modal.js, notify.js, auth.js
============================================ */
console.log('[BECCA] DeliveryModule v20260405a loaded');

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
  const SHIFT_C = {
    S1: { bg:'rgba(99,102,241,.15)',  text:'#818cf8', card:'rgba(99,102,241,.05)', border:'rgba(99,102,241,.2)'  },
    S2: { bg:'rgba(16,185,129,.15)',  text:'#34d399', card:'rgba(16,185,129,.05)', border:'rgba(16,185,129,.2)'  },
    S3: { bg:'rgba(245,158,11,.15)',  text:'#fbbf24', card:'rgba(245,158,11,.05)', border:'rgba(245,158,11,.2)'  },
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
          ${canEdit?`<button class="btn btn-ghost" onclick="DeliveryModule.autoPopulate()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg>
            Auto dari Order</button>`:''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.prevWeek()">\u2039 Minggu Lalu</button>
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.goToday()">Hari Ini</button>
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.nextWeek()">Minggu Depan \u203a</button>
        <div style="flex:1"></div>
        <span style="font-size:14px;font-weight:600;color:var(--heading)">${_fmtDateFull(_weekStart)} \u2014 ${_fmtDateFull(days[6])}</span>
      </div>
      <div id="dlv-grid"></div>`;
    _renderWeekGrid();
  }

  /* ═══ RENDER WEEK GRID ═══ */
  function _renderWeekGrid() {
    const el = document.getElementById('dlv-grid');
    if (!el) return;
    const days = _weekDays(_weekStart), canEdit = Auth.can('delivery','edit');

    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:var(--s2);min-height:60vh">
      ${days.map((date,i) => {
        const entries = _getEntriesForDate(date), today = _isToday(date);
        const delivered = entries.filter(e=>e.status==='delivered').length, total = entries.length;
        const cmap = _buildConflictMap(entries);
        const drvGrp = {};
        entries.forEach(e => { const dk = e.driverName||'\u2014 No driver'; if(!drvGrp[dk])drvGrp[dk]=[]; drvGrp[dk].push(e); });
        const dt = new Date(date+'T12:00:00');
        return `<div style="background:var(--surface);border:1px solid ${today?'var(--primary)':'var(--border)'};border-radius:var(--r-md);display:flex;flex-direction:column;min-width:0;overflow:hidden;${today?'box-shadow:0 0 0 2px rgba(99,102,241,.15)':''}">
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
              Object.entries(drvGrp).map(([drv,items])=>`<div style="margin-bottom:var(--s2)">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--info);padding:2px 0;margin-bottom:2px;display:flex;align-items:center;gap:4px;overflow:hidden">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="9" height="9" style="flex-shrink:0"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${drv}</span>
                </div>
                ${items.map(e=>_renderCard(e,canEdit,cmap)).join('')}
              </div>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
    <style>@media(max-width:900px){#dlv-grid>div>div{grid-template-columns:1fr 1fr!important}}@media(max-width:600px){#dlv-grid>div>div{grid-template-columns:1fr!important}}</style>`;
  }

  /* ═══ RENDER CARD ═══ */
  function _renderCard(entry, canEdit, cmap) {
    const st = STATUS[entry.status]||STATUS.pending;
    const conflict = _picHasConflict(entry, cmap);
    const sc = SHIFT_C[entry.shift]||null;
    const picLabel = (entry.picNames||[]).join(', ');
    // Card colors: conflict=red, else shift-tinted, else default
    const bg = conflict ? 'rgba(239,68,68,.07)' : (sc ? sc.card : 'var(--surface2)');
    const bdr = conflict ? 'var(--danger)' : (sc ? sc.border : 'var(--border)');
    // Shift badge
    const sBadge = sc ? `<span style="font-size:8px;font-weight:800;padding:1px 5px;border-radius:var(--r-full);background:${sc.bg};color:${sc.text}">${entry.shift}</span>` : '';

    return `<div onclick="${canEdit?`DeliveryModule.openModal('${entry.id}','${entry.date}')`:'void(0)'}"
      style="background:${bg};border:1px solid ${bdr};border-radius:var(--r-sm);padding:var(--s2) var(--s3);margin-bottom:4px;cursor:${canEdit?'pointer':'default'};transition:all var(--t-fast)"
      onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:1px">
        <span onclick="event.stopPropagation();DeliveryModule.cycleStatus('${entry.id}')" title="${st.label}"
          style="width:8px;height:8px;border-radius:50%;background:${st.color};cursor:pointer;flex-shrink:0"></span>
        <div style="font-size:11px;font-weight:700;color:var(--heading);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${_custShort(entry.customerName)}</div>
        ${sBadge}
      </div>
      ${picLabel?`<div style="font-size:9px;color:${conflict?'var(--danger)':'var(--text-2)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${conflict?'font-weight:700':''}">
        ${picLabel}${conflict?' \u26a0':''}
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
          <input type="text" id="dlv-pic-search" class="form-control" placeholder="Cari PIC..." oninput="DeliveryModule._filterPIC(this.value)" style="margin-bottom:var(--s2)">
          <div id="dlv-pic-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s2)">
            ${picList.map(e=>`<label class="form-check dlv-pic-item" style="padding:4px 0" data-name="${(e.nama||'').toLowerCase()}">
              <input type="checkbox" value="${e.id}" data-nama="${e.nama}" ${selPics.includes(e.id)?'checked':''}>
              <span class="form-check-label">${e.nama}${e.jabatan?' <span style="color:var(--text-3);font-size:11px">\u00b7 '+e.jabatan+'</span>':''}</span>
            </label>`).join('')}
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
    const di = document.getElementById('dlv-driver');
    if (di) {
      const dOpts = driverList.map(e=>({label:e.nama+(e.jabatan?' \u00b7 '+e.jabatan:''),value:e.id,nama:e.nama}));
      Utils.initCombo(di, dOpts, { onSelect(item){di.value=item.nama;di.dataset.id=item.value;} });
      if (existing?.driverId) di.dataset.id=existing.driverId;
    }
  }

  function _filterPIC(q) { const l=q.toLowerCase(); document.querySelectorAll('.dlv-pic-item').forEach(el=>{el.style.display=el.dataset.name.includes(l)?'':'none';}); }

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

  /* ═══ AUTO POPULATE ═══ */
  async function autoPopulate() {
    const days=_weekDays(_weekStart);
    let sc=_currentSchedule();
    if (!sc) { sc={id:Utils.uid(),weekStart:_weekStart,weekEnd:days[6],entries:[],createdBy:Auth.currentUser()?.nama||'',createdAt:new Date().toISOString()}; _schedules.push(sc); }
    if (!sc.entries) sc.entries=[];
    let added=0;
    days.forEach(date => {
      const custMap={};
      _orders.filter(o=>o.tglOrder===date).forEach(o => {
        const name=o.namaPerusahaan; if(!name) return; if(!custMap[name]) custMap[name]=0;
        const n=v=>Number(v)||0;
        custMap[name]+=n(o.breakfast)+n(o.shift1)+n(o.spare1)+n(o.ot1)+n(o.snack1)+n(o.shift2)+n(o.spare2)+n(o.ot2)+n(o.snack2)+n(o.shift3)+n(o.spare3)+n(o.ot3)+n(o.snack3)+n(o.snackBerat);
      });
      Object.entries(custMap).forEach(([cn,pax]) => {
        if (sc.entries.some(e=>e.date===date&&e.customerName===cn)) return;
        const c=_customers.find(x=>(x.nama||'').toLowerCase()===cn.toLowerCase());
        sc.entries.push({id:Utils.uid(),date,customerId:c?.id||'',customerName:cn,driverId:'',driverName:'',picIds:[],picNames:[],shift:'all',status:'pending',deliveryTime:'',totalPax:pax,notes:'',updatedBy:Auth.currentUser()?.nama||'',updatedAt:new Date().toISOString()});
        added++;
      });
    });
    if (!added) { Notify.info('Tidak ada order baru'); return; }
    try { await DB.saveDeliverySchedule(sc); Notify.success(added+' delivery ditambahkan'); } catch(e) { Notify.error('Gagal: '+e.message); }
    _renderWeekGrid();
  }

  return { init, prevWeek, nextWeek, goToday, openModal, saveEntry, deleteEntry, cycleStatus, autoPopulate, _filterPIC };
})();
window.DeliveryModule = DeliveryModule;
