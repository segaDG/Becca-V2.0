/* ============================================
   BECCA V2.0 — Delivery Schedule Module
   Weekly delivery calendar with driver + PIC assignment
   Depends: db.js, utils.js, modal.js, notify.js, auth.js
============================================ */
console.log('[BECCA] DeliveryModule v20260403a loaded ✓');

const DeliveryModule = (() => {
  'use strict';

  /* ═══ STATE ═══ */
  let _schedules = [];
  let _orders    = [];
  let _customers = [];
  let _employees = [];
  let _weekStart = ''; // YYYY-MM-DD (Monday)
  const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
  const DAYS_SHORT = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  const STATUS = {
    pending:    { label:'Pending',    color:'var(--warning)',  bg:'var(--warning-bg)', icon:'⏱' },
    in_transit: { label:'Dikirim',    color:'var(--info)',     bg:'var(--info-bg)',    icon:'🚚' },
    delivered:  { label:'Terkirim',   color:'var(--success)',  bg:'var(--success-bg)', icon:'✓' },
    cancelled:  { label:'Batal',      color:'var(--danger)',   bg:'var(--danger-bg)',  icon:'✕' },
  };

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

  /* ═══ HELPERS ═══ */
  // Local YYYY-MM-DD (tanpa timezone shift dari toISOString)
  function _toStr(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const d = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  function _getMonday(d) {
    const dt = new Date(d); dt.setHours(12,0,0,0); // noon to avoid DST edge
    const day = dt.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
    return _toStr(dt);
  }
  function _weekDays(monday) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday + 'T12:00:00');
      d.setDate(d.getDate() + i);
      days.push(_toStr(d));
    }
    return days;
  }
  function _fmtDate(s) {
    if (!s) return '-';
    const d = new Date(s + 'T12:00:00');
    return d.getDate() + '/' + (d.getMonth()+1);
  }
  function _fmtDateFull(s) {
    if (!s) return '-';
    try { return new Date(s + 'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}); }
    catch { return s; }
  }
  function _dayName(s) {
    const d = new Date(s + 'T12:00:00');
    return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
  }
  function _isToday(s) { return s === _toStr(new Date()); }

  function _currentSchedule() {
    return _schedules.find(sc => sc.weekStart === _weekStart);
  }
  function _getEntriesForDate(date) {
    const sc = _currentSchedule();
    if (!sc || !sc.entries) return [];
    return sc.entries.filter(e => e.date === date);
  }

  function _getDrivers() {
    return _employees.filter(e =>
      e.status !== 'nonaktif' && e.status !== 'resign' &&
      ['driver','supir','pengemudi','transport'].some(k =>
        (e.jabatan||'').toLowerCase().includes(k) ||
        (e.divisi||e.departemen||'').toLowerCase().includes(k))
    ).sort((a,b) => (a.nama||'').localeCompare(b.nama||''));
  }
  function _getPIC() {
    return _employees.filter(e =>
      e.status !== 'nonaktif' && e.status !== 'resign' &&
      ['pramusaji','service','pic','waiter','crew','staff'].some(k =>
        (e.jabatan||'').toLowerCase().includes(k) ||
        (e.divisi||e.departemen||'').toLowerCase().includes(k))
    ).sort((a,b) => (a.nama||'').localeCompare(b.nama||''));
  }
  function _allActiveEmployees() {
    return _employees.filter(e => e.status !== 'nonaktif' && e.status !== 'resign')
      .sort((a,b) => (a.nama||'').localeCompare(b.nama||''));
  }

  function _customerOptions(date) {
    // Hanya customer yang punya order pada tanggal ini, enriched dengan customerId + namaShort
    const map = {};
    _orders.forEach(o => {
      if (o.tglOrder === date && o.namaPerusahaan) {
        const name = o.namaPerusahaan;
        if (!map[name]) {
          const cust = _customers.find(c => (c.nama||'').toLowerCase() === name.toLowerCase());
          const id = cust?.customerId || '';
          const short = cust?.namaShort || '';
          const label = (id ? '['+id+'] ' : '') + name + (short ? ' ('+short+')' : '');
          map[name] = { label, value: name };
        }
      }
    });
    return Object.values(map).sort((a,b) => a.label.localeCompare(b.label));
  }

  function _calcPax(customerName, date) {
    const n = v => Number(v)||0;
    return _orders.filter(o => o.namaPerusahaan === customerName && o.tglOrder === date)
      .reduce((sum, o) => {
        return sum + n(o.breakfast) + n(o.shift1) + n(o.spare1) + n(o.ot1) + n(o.snack1)
          + n(o.shift2) + n(o.spare2) + n(o.ot2) + n(o.snack2)
          + n(o.shift3) + n(o.spare3) + n(o.ot3) + n(o.snack3) + n(o.snackBerat);
      }, 0);
  }

  /* ═══ INIT ═══ */
  async function init() {
    const page = document.getElementById('page-delivery');
    if (!page) return;
    _weekStart = _getMonday(new Date());

    // Progressive load — render shell, then fetch data
    page.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-3)">Memuat jadwal delivery...</div>';

    const [schedules, orders, customers, employees] = await Promise.all([
      DB.getDeliverySchedules().catch(() => []),
      DB.getOrders().catch(() => []),
      DB.getCustomers().catch(() => []),
      DB.getEmployees().catch(() => []),
    ]);
    _schedules = schedules;
    _orders    = orders;
    _customers = customers;
    _employees = employees;
    _renderFull(page);
  }

  /* ═══ RENDER — FULL PAGE ═══ */
  function _renderFull(page) {
    if (!page) page = document.getElementById('page-delivery');
    const canEdit = Auth.can('delivery','edit');
    const days = _weekDays(_weekStart);
    const weekEnd = days[6];

    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Delivery Schedule</h2>
          <p>Jadwal pengiriman mingguan</p>
        </div>
        <div class="page-header-right">
          ${canEdit ? `
            <button class="btn btn-ghost" onclick="DeliveryModule.autoPopulate()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg>
              Auto dari Order
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Week Navigation -->
      <div style="display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.prevWeek()">‹ Minggu Lalu</button>
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.goToday()">Hari Ini</button>
        <button class="btn btn-ghost btn-sm" onclick="DeliveryModule.nextWeek()">Minggu Depan ›</button>
        <div style="flex:1"></div>
        <span style="font-size:14px;font-weight:600;color:var(--heading)">
          ${_fmtDateFull(_weekStart)} — ${_fmtDateFull(weekEnd)}
        </span>
      </div>

      <!-- Week Grid -->
      <div id="dlv-grid"></div>
    `;

    _renderWeekGrid();
  }

  /* ═══ RENDER — WEEK GRID ═══ */
  function _renderWeekGrid() {
    const el = document.getElementById('dlv-grid');
    if (!el) return;
    const days = _weekDays(_weekStart);
    const canEdit = Auth.can('delivery','edit');

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:var(--s2);min-height:60vh">
        ${days.map((date, i) => {
          const entries = _getEntriesForDate(date);
          const today = _isToday(date);
          const delivered = entries.filter(e => e.status === 'delivered').length;
          const total = entries.length;

          // Group by driver
          const driverGroups = {};
          entries.forEach(e => {
            const dk = e.driverName || '— Belum ada driver';
            if (!driverGroups[dk]) driverGroups[dk] = [];
            driverGroups[dk].push(e);
          });

          return `<div style="background:var(--surface);border:1px solid ${today?'var(--primary)':'var(--border)'};border-radius:var(--r-md);display:flex;flex-direction:column;min-width:0;overflow:hidden;${today?'box-shadow:0 0 0 2px rgba(99,102,241,.15)':''}">
            <!-- Day Header -->
            <div style="padding:var(--s3);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:${today?'var(--primary-bg)':'var(--surface2)'}">
              <div>
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${today?'var(--primary-h)':'var(--text-3)'}">${DAYS_SHORT[i]}</div>
                <div style="display:flex;align-items:baseline;gap:4px">
                  <span style="font-size:16px;font-weight:700;color:${today?'var(--primary)':'var(--heading)'}">${new Date(date+'T12:00:00').getDate()}</span>
                  <span style="font-size:10px;font-weight:600;color:${today?'var(--primary-h)':'var(--text-3)'}">${MONTHS_SHORT[new Date(date+'T12:00:00').getMonth()]}</span>
                </div>
              </div>
              <div style="text-align:right">
                ${total > 0 ? `<div style="font-size:10px;color:var(--text-3)">${delivered}/${total}</div>` : ''}
                ${canEdit ? `<button class="btn-icon" style="width:24px;height:24px" onclick="DeliveryModule.openModal(null,'${date}')" title="Tambah delivery">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 5v14M5 12h14"/></svg>
                </button>` : ''}
              </div>
            </div>
            <!-- Entries -->
            <div style="flex:1;overflow-y:auto;padding:var(--s2)">
              ${total === 0 ? `<div style="text-align:center;padding:var(--s6) var(--s2);color:var(--text-3);font-size:11px">Belum ada jadwal</div>` :
                Object.entries(driverGroups).map(([driver, items]) => `
                  <div style="margin-bottom:var(--s2)">
                    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--primary-h);padding:2px 0;margin-bottom:2px;display:flex;align-items:center;gap:4px">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                      ${driver}
                    </div>
                    ${items.map(e => _renderCard(e, canEdit)).join('')}
                  </div>
                `).join('')
              }
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Mobile: horizontal scroll hint -->
      <style>
        @media(max-width:900px){
          #dlv-grid>div{display:block!important}
          #dlv-grid>div>div{grid-template-columns:1fr 1fr!important}
        }
        @media(max-width:600px){
          #dlv-grid>div>div{grid-template-columns:1fr!important}
        }
      </style>
    `;
  }

  /* ═══ RENDER — DELIVERY CARD ═══ */
  function _renderCard(entry, canEdit) {
    const st = STATUS[entry.status] || STATUS.pending;
    const picLabel = (entry.picNames || []).join(', ');
    const shiftLabel = entry.shift === 'all' ? '' : entry.shift;
    const infoParts = [shiftLabel, entry.totalPax ? entry.totalPax+' pax' : '', entry.deliveryTime].filter(Boolean).join(' · ');
    return `<div onclick="${canEdit ? `DeliveryModule.openModal('${entry.id}','${entry.date}')` : ''}"
      style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s2) var(--s3);margin-bottom:4px;cursor:${canEdit?'pointer':'default'};transition:all var(--t-fast);border-left:3px solid ${st.color}"
      onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='var(--surface2)'">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:2px">
        <div style="font-size:11px;font-weight:700;color:var(--heading);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${entry.customerName||'-'}</div>
        <span onclick="event.stopPropagation();DeliveryModule.cycleStatus('${entry.id}')" title="Klik untuk ganti status"
          style="font-size:8px;font-weight:700;padding:1px 5px;border-radius:var(--r-full);background:${st.bg};color:${st.color};cursor:pointer;white-space:nowrap;flex-shrink:0">
          ${st.icon} ${st.label}
        </span>
      </div>
      ${entry.driverName ? `<div style="font-size:9px;color:var(--info);display:flex;align-items:center;gap:3px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="8" height="8"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        ${entry.driverName}
      </div>` : ''}
      ${picLabel ? `<div style="font-size:9px;color:var(--text-2);display:flex;align-items:center;gap:3px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="8" height="8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${picLabel}
      </div>` : ''}
      ${infoParts ? `<div style="font-size:9px;color:var(--text-3);margin-top:1px">${infoParts}</div>` : ''}
      ${entry.notes ? `<div style="font-size:8px;color:var(--text-3);margin-top:1px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${entry.notes}</div>` : ''}
    </div>`;
  }

  /* ═══ WEEK NAVIGATION ═══ */
  function prevWeek() {
    const d = new Date(_weekStart + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    _weekStart = _toStr(d);
    _renderFull();
  }
  function nextWeek() {
    const d = new Date(_weekStart + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    _weekStart = _toStr(d);
    _renderFull();
  }
  function goToday() {
    _weekStart = _getMonday(new Date());
    _renderFull();
  }

  /* ═══ MODAL — ADD/EDIT ENTRY ═══ */
  function openModal(entryId, date) {
    const sc = _currentSchedule();
    const existing = entryId && sc ? (sc.entries||[]).find(e => e.id === entryId) : null;
    const canEdit = Auth.can('delivery','edit');
    if (!canEdit) return;

    const drivers = _getDrivers();
    const pics = _getPIC();
    const allEmps = _allActiveEmployees();
    const custOpts = _customerOptions(date);

    // If no dedicated drivers/PIC found, fall back to all active employees
    const driverList = drivers.length ? drivers : allEmps;
    const picList = pics.length ? pics : allEmps;

    const mid = 'dlv-modal-' + Date.now();
    const dayLabel = _dayName(date) + ', ' + _fmtDateFull(date);
    const selPics = existing ? (existing.picIds || []) : [];

    Modal.open({
      id: mid,
      title: existing ? 'Edit Delivery' : 'Tambah Delivery',
      size: 'modal-lg',
      body: `
        <input type="hidden" id="dlv-modal-date" value="${date}">
        <div style="font-size:13px;color:var(--primary-h);font-weight:600;margin-bottom:var(--s4)">${dayLabel}</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer <span class="req">*</span></label>
            <input type="text" id="dlv-customer" class="form-control" placeholder="Klik atau ketik untuk cari..." value="${existing?.customerName||''}" autocomplete="off">
            <div style="font-size:10px;color:var(--text-3);margin-top:2px">${custOpts.length} customer dengan order di tanggal ini</div>
          </div>
          <div class="form-group">
            <label class="form-label">Driver</label>
            <input type="text" id="dlv-driver" class="form-control" placeholder="Klik atau ketik untuk cari..." value="${existing?.driverName||''}" autocomplete="off">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">PIC / Pramusaji (bisa pilih beberapa)</label>
          <input type="text" id="dlv-pic-search" class="form-control" placeholder="Cari nama PIC..." oninput="DeliveryModule._filterPIC(this.value)" style="margin-bottom:var(--s2)">
          <div id="dlv-pic-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--s2)">
            ${picList.map(e => `
              <label class="form-check dlv-pic-item" style="padding:4px 0" data-name="${(e.nama||'').toLowerCase()}">
                <input type="checkbox" value="${e.id}" data-nama="${e.nama}" ${selPics.includes(e.id)?'checked':''}>
                <span class="form-check-label">${e.nama}${e.jabatan?' <span style="color:var(--text-3);font-size:11px">· '+e.jabatan+'</span>':''}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Shift</label>
            <select id="dlv-shift" class="form-control">
              <option value="all" ${!existing||existing.shift==='all'?'selected':''}>Semua Shift</option>
              <option value="S1" ${existing&&existing.shift==='S1'?'selected':''}>Shift 1</option>
              <option value="S2" ${existing&&existing.shift==='S2'?'selected':''}>Shift 2</option>
              <option value="S3" ${existing&&existing.shift==='S3'?'selected':''}>Shift 3</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Waktu Kirim</label>
            <input type="time" id="dlv-time" class="form-control" value="${existing?.deliveryTime||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Total Pax</label>
            <input type="number" id="dlv-pax" class="form-control" value="${existing?.totalPax||''}" placeholder="Auto dari order">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Status</label>
          <div style="display:flex;gap:var(--s2);flex-wrap:wrap">
            ${Object.entries(STATUS).map(([k,v]) => `
              <label class="form-check" style="padding:4px 10px;border-radius:var(--r-full);border:1px solid ${v.color}30;background:${existing&&existing.status===k?v.bg:'transparent'};cursor:pointer">
                <input type="radio" name="dlv-status" value="${k}" ${(existing?existing.status:k==='pending'?'pending':'')===k?'checked':''} style="display:none">
                <span style="font-size:12px;font-weight:600;color:${v.color}">${v.icon} ${v.label}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea id="dlv-notes" class="form-control" rows="2" placeholder="Catatan opsional...">${existing?.notes||''}</textarea>
        </div>
      `,
      footer: `
        ${existing ? `<button class="btn btn-danger" onclick="DeliveryModule.deleteEntry('${entryId}','${mid}')">Hapus</button>` : ''}
        <div style="flex:1"></div>
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="DeliveryModule.saveEntry('${entryId||''}','${date}','${mid}')">Simpan</button>
      `,
    });

    // Searchable dropdown — customer
    const custInput = document.getElementById('dlv-customer');
    if (custInput) {
      Utils.initCombo(custInput, custOpts, {
        onSelect(item) {
          custInput.value = item.value;
          const paxEl = document.getElementById('dlv-pax');
          if (paxEl && !existing) {
            const pax = _calcPax(item.value, date);
            if (pax > 0) paxEl.value = pax;
          }
        }
      });
    }
    // Searchable dropdown — driver
    const drvInput = document.getElementById('dlv-driver');
    if (drvInput) {
      const drvOpts = driverList.map(e => ({ label: e.nama + (e.jabatan ? ' · '+e.jabatan : ''), value: e.id, nama: e.nama }));
      Utils.initCombo(drvInput, drvOpts, {
        onSelect(item) { drvInput.value = item.nama; drvInput.dataset.id = item.value; }
      });
      if (existing?.driverId) drvInput.dataset.id = existing.driverId;
    }
  }

  function _filterPIC(q) {
    const lower = q.toLowerCase();
    document.querySelectorAll('.dlv-pic-item').forEach(el => {
      el.style.display = el.dataset.name.includes(lower) ? '' : 'none';
    });
  }

  /* ═══ SAVE ENTRY ═══ */
  async function saveEntry(entryId, date, modalId) {
    const customerName = (document.getElementById('dlv-customer')?.value || '').trim();
    if (!customerName) { Notify.warning('Pilih customer terlebih dahulu'); return; }

    const drvInput = document.getElementById('dlv-driver');
    const driverId = drvInput?.dataset?.id || '';
    const driverName = (drvInput?.value || '').trim();

    const picChecks = document.querySelectorAll('#dlv-pic-list input[type="checkbox"]:checked');
    const picIds = [...picChecks].map(c => c.value);
    const picNames = [...picChecks].map(c => c.dataset.nama);

    const status = (document.querySelector('input[name="dlv-status"]:checked')||{}).value || 'pending';
    const shift = document.getElementById('dlv-shift').value;
    const deliveryTime = document.getElementById('dlv-time').value;
    const totalPax = parseInt(document.getElementById('dlv-pax').value) || 0;
    const notes = document.getElementById('dlv-notes').value.trim();

    // Find or create schedule for this week
    let sc = _currentSchedule();
    if (!sc) {
      const days = _weekDays(_weekStart);
      sc = {
        id: Utils.uid(),
        weekStart: _weekStart,
        weekEnd: days[6],
        entries: [],
        createdBy: Auth.currentUser()?.nama || '',
        createdAt: new Date().toISOString(),
      };
      _schedules.push(sc);
    }
    if (!sc.entries) sc.entries = [];

    const cust = _customers.find(c => (c.nama||'').toLowerCase() === customerName.toLowerCase());
    const entryData = {
      id: entryId || Utils.uid(),
      date,
      customerId: cust?.id || '',
      customerName,
      driverId,
      driverName,
      picIds,
      picNames,
      shift,
      status,
      deliveryTime,
      totalPax,
      notes,
      updatedBy: Auth.currentUser()?.nama || '',
      updatedAt: new Date().toISOString(),
    };

    if (entryId) {
      const idx = sc.entries.findIndex(e => e.id === entryId);
      if (idx >= 0) sc.entries[idx] = entryData;
      else sc.entries.push(entryData);
    } else {
      sc.entries.push(entryData);
    }

    try {
      await DB.saveDeliverySchedule(sc);
      Notify.success(entryId ? 'Delivery diperbarui' : 'Delivery ditambahkan');
    } catch(e) {
      Notify.error('Gagal menyimpan: ' + e.message);
    }

    Modal.close(modalId);
    _renderWeekGrid();
  }

  /* ═══ DELETE ENTRY ═══ */
  async function deleteEntry(entryId, modalId) {
    if (!confirm('Hapus jadwal delivery ini?')) return;
    const sc = _currentSchedule();
    if (!sc) return;
    sc.entries = (sc.entries||[]).filter(e => e.id !== entryId);
    try {
      await DB.saveDeliverySchedule(sc);
      Notify.success('Delivery dihapus');
    } catch(e) {
      Notify.error('Gagal menghapus');
    }
    Modal.close(modalId);
    _renderWeekGrid();
  }

  /* ═══ CYCLE STATUS ═══ */
  async function cycleStatus(entryId) {
    const sc = _currentSchedule();
    if (!sc || !Auth.can('delivery','edit')) return;
    const entry = (sc.entries||[]).find(e => e.id === entryId);
    if (!entry) return;
    const order = ['pending','in_transit','delivered'];
    const idx = order.indexOf(entry.status);
    entry.status = order[(idx + 1) % order.length];
    entry.updatedBy = Auth.currentUser()?.nama || '';
    entry.updatedAt = new Date().toISOString();
    try { await DB.saveDeliverySchedule(sc); } catch {}
    _renderWeekGrid();
  }

  /* ═══ AUTO-POPULATE FROM ORDERS ═══ */
  async function autoPopulate() {
    const days = _weekDays(_weekStart);
    let sc = _currentSchedule();
    if (!sc) {
      sc = {
        id: Utils.uid(),
        weekStart: _weekStart,
        weekEnd: days[6],
        entries: [],
        createdBy: Auth.currentUser()?.nama || '',
        createdAt: new Date().toISOString(),
      };
      _schedules.push(sc);
    }
    if (!sc.entries) sc.entries = [];

    let added = 0;
    days.forEach(date => {
      // Find customers with orders on this date
      const dayOrders = _orders.filter(o => o.tglOrder === date);
      const custMap = {};
      dayOrders.forEach(o => {
        const name = o.namaPerusahaan;
        if (!name) return;
        if (!custMap[name]) custMap[name] = 0;
        const n = v => Number(v)||0;
        custMap[name] += n(o.breakfast)+n(o.shift1)+n(o.spare1)+n(o.ot1)+n(o.snack1)
          +n(o.shift2)+n(o.spare2)+n(o.ot2)+n(o.snack2)
          +n(o.shift3)+n(o.spare3)+n(o.ot3)+n(o.snack3)+n(o.snackBerat);
      });

      Object.entries(custMap).forEach(([custName, pax]) => {
        // Skip if already exists for this date + customer
        const exists = sc.entries.some(e => e.date === date && e.customerName === custName);
        if (exists) return;
        const cust = _customers.find(c => (c.nama||'').toLowerCase() === custName.toLowerCase());
        sc.entries.push({
          id: Utils.uid(),
          date,
          customerId: cust?.id || '',
          customerName: custName,
          driverId: '',
          driverName: '',
          picIds: [],
          picNames: [],
          shift: 'all',
          status: 'pending',
          deliveryTime: '',
          totalPax: pax,
          notes: '',
          updatedBy: Auth.currentUser()?.nama || '',
          updatedAt: new Date().toISOString(),
        });
        added++;
      });
    });

    if (added === 0) {
      Notify.info('Tidak ada order baru untuk minggu ini, atau semua sudah ada di jadwal');
      return;
    }

    try {
      await DB.saveDeliverySchedule(sc);
      Notify.success(added + ' delivery ditambahkan dari order');
    } catch(e) {
      Notify.error('Gagal menyimpan: ' + e.message);
    }
    _renderWeekGrid();
  }

  /* ═══ PUBLIC API ═══ */
  return {
    init,
    prevWeek, nextWeek, goToday,
    openModal, saveEntry, deleteEntry,
    cycleStatus, autoPopulate,
    _filterPIC,
  };
})();
window.DeliveryModule = DeliveryModule;
