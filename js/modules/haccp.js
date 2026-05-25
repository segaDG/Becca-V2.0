/* ============================================
   BECCA V2.0 — HACCP / Food Safety Logging
   Tabs: Suhu, Sanitasi, Bahan Masuk, Ringkasan
   Data: haccp_temp_log, haccp_sanitation, haccp_receiving (Supabase)
============================================ */
const HaccpModule = (() => {
  'use strict';

  // ── State ──────────────────────────────────────────────
  let _tempLogs = [];
  let _sanitLogs = [];
  let _receiving = [];
  let _suppliers = [];
  let _items = [];
  let _activeTab = 'suhu';

  // ── Thresholds (HACCP standard, configurable) ──────────
  const THRESHOLDS = {
    freezer:    { min: -30, max: -18, label: 'Freezer (≤ -18°C)', icon: '❄️' },
    chiller:    { min: 0,   max: 4,   label: 'Chiller (0-4°C)',    icon: '🧊' },
    'hot-hold': { min: 60,  max: 100, label: 'Hot Holding (≥ 60°C)', icon: '🔥' },
    'core-cook':{ min: 75,  max: 100, label: 'Core Cook (≥ 75°C)',   icon: '🍳' },
  };
  const SHIFTS = ['Pagi', 'Siang', 'Malam'];

  // Sanitation checklist defaults (boleh override via settings)
  const SANITATION_ITEMS = [
    { key: 'handwash',   label: 'Cuci tangan staff sebelum shift', critical: true },
    { key: 'equipment',  label: 'Sanitasi peralatan dapur', critical: true },
    { key: 'surface',    label: 'Sanitasi meja kerja & talenan', critical: true },
    { key: 'storage',    label: 'Sanitasi wadah penyimpanan', critical: false },
    { key: 'floor',      label: 'Kebersihan lantai dapur', critical: false },
    { key: 'toilet',     label: 'Kebersihan toilet', critical: false },
    { key: 'wash-area',  label: 'Kebersihan area cuci', critical: false },
    { key: 'fridge',     label: 'Inspeksi visual kondisi chiller/freezer', critical: true },
    { key: 'pest',       label: 'Tidak ada tanda hama (tikus/kecoa/lalat)', critical: true },
    { key: 'thermo-cal', label: 'Kalibrasi termometer (cek mingguan)', critical: false },
  ];

  function _ymd(d = new Date()) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function _hhmm(d = new Date()) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function _evalTemp(area, suhuC) {
    const t = THRESHOLDS[area];
    if (!t) return { ok: true, status: 'unknown' };
    if (suhuC < t.min || suhuC > t.max) {
      return { ok: false, status: 'CRITICAL', msg: `Di luar batas ${t.min}°C–${t.max}°C` };
    }
    return { ok: true, status: 'OK' };
  }

  // ── Init ───────────────────────────────────────────────
  async function _load() {
    try { _tempLogs = await DB.getHaccpTemp(); } catch { _tempLogs = []; }
    try { _sanitLogs = await DB.getHaccpSanitation(); } catch { _sanitLogs = []; }
    try { _receiving = await DB.getHaccpReceiving(); } catch { _receiving = []; }
    try { _suppliers = await DB.getSuppliers(); } catch { _suppliers = []; }
    try { _items = await DB.getInventory(); } catch { _items = []; }
  }
  async function init() {
    if (!Auth.can('haccp', 'view')) {
      document.getElementById('page-haccp').innerHTML = '<div class="card" style="padding:24px;text-align:center"><div style="color:var(--text-3)">Tidak ada akses ke HACCP</div></div>';
      return;
    }
    await _load();
    _render();
  }

  function _render() {
    const el = document.getElementById('page-haccp');
    const canEdit = Auth.can('haccp', 'all');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <h2>🛡️ HACCP — Food Safety Logging</h2>
          <p class="page-sub">Log suhu, sanitasi, dan penerimaan bahan untuk traceability & compliance</p>
        </div>
        <div style="display:flex;gap:6px">
          ${canEdit ? `<button class="btn btn-primary" onclick="HaccpModule.openQuickLog()">+ Quick Log Suhu</button>` : ''}
          <button class="btn btn-ghost" onclick="HaccpModule.exportReport()">📄 Laporan PDF</button>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn ${_activeTab==='suhu'?'active':''}" onclick="HaccpModule.switchTab('suhu')">🌡️ Suhu</button>
        <button class="tab-btn ${_activeTab==='sanitasi'?'active':''}" onclick="HaccpModule.switchTab('sanitasi')">🧼 Sanitasi</button>
        <button class="tab-btn ${_activeTab==='receiving'?'active':''}" onclick="HaccpModule.switchTab('receiving')">📦 Bahan Masuk</button>
        <button class="tab-btn ${_activeTab==='ringkasan'?'active':''}" onclick="HaccpModule.switchTab('ringkasan')">📊 Ringkasan</button>
      </div>
      <div id="haccp-content"></div>
    `;
    _renderTab();
  }

  function switchTab(t) {
    _activeTab = t;
    document.querySelectorAll('#page-haccp .tab-btn').forEach(b => {
      b.classList.toggle('active', b.textContent.toLowerCase().includes(t === 'suhu' ? 'suhu' : t === 'sanitasi' ? 'sanitasi' : t === 'receiving' ? 'bahan masuk' : 'ringkasan'));
    });
    _renderTab();
  }
  function _renderTab() {
    const c = document.getElementById('haccp-content');
    if (!c) return;
    if (_activeTab === 'suhu') c.innerHTML = _renderTemp();
    else if (_activeTab === 'sanitasi') c.innerHTML = _renderSanitation();
    else if (_activeTab === 'receiving') c.innerHTML = _renderReceiving();
    else if (_activeTab === 'ringkasan') c.innerHTML = _renderSummary();
  }

  // ── Tab: Suhu (Temperature Log) ────────────────────────
  function _renderTemp() {
    const today = _ymd();
    const todayLogs = _tempLogs.filter(l => l.tgl === today);
    const canEdit = Auth.can('haccp', 'all');

    // Compliance status per area per shift hari ini
    const matrix = {};
    Object.keys(THRESHOLDS).forEach(area => {
      matrix[area] = {};
      SHIFTS.forEach(s => matrix[area][s] = null);
    });
    todayLogs.forEach(l => {
      if (matrix[l.area] && matrix[l.area][l.shift] === null) {
        const ev = _evalTemp(l.area, parseFloat(l.suhuC));
        matrix[l.area][l.shift] = ev.ok ? 'ok' : 'fail';
      }
    });

    let matrixHtml = `
      <div class="card" style="margin-bottom:14px">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-title">📅 Status Hari Ini — ${today}</div>
          <div style="font-size:11px;color:var(--text-3)">Cek 3x/hari per area</div>
        </div>
        <div style="padding:14px;overflow-x:auto">
          <table class="data-table" style="margin:0">
            <thead><tr><th>Area</th>${SHIFTS.map(s => `<th style="text-align:center">${s}</th>`).join('')}<th style="text-align:center">Status</th></tr></thead>
            <tbody>
              ${Object.entries(THRESHOLDS).map(([key, t]) => {
                const cells = SHIFTS.map(s => {
                  const v = matrix[key][s];
                  if (v === 'ok')   return `<td style="text-align:center;color:#22c55e;font-size:18px">✓</td>`;
                  if (v === 'fail') return `<td style="text-align:center;color:#ef4444;font-size:18px">✗</td>`;
                  return `<td style="text-align:center;color:var(--text-3)">—</td>`;
                }).join('');
                const totalDone = SHIFTS.filter(s => matrix[key][s] !== null).length;
                const totalFail = SHIFTS.filter(s => matrix[key][s] === 'fail').length;
                let badge;
                if (totalFail > 0) badge = `<span class="badge badge-danger">${totalFail} CRITICAL</span>`;
                else if (totalDone === SHIFTS.length) badge = `<span class="badge badge-success">Lengkap</span>`;
                else badge = `<span class="badge" style="background:var(--surface2);color:var(--text-2)">${totalDone}/${SHIFTS.length}</span>`;
                return `<tr>
                  <td><strong>${t.icon} ${t.label}</strong></td>
                  ${cells}
                  <td style="text-align:center">${badge}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const recent = [..._tempLogs].sort((a,b) => (b.tgl + b.jam) > (a.tgl + a.jam) ? 1 : -1).slice(0, 50);
    const rows = recent.map(l => {
      const ev = _evalTemp(l.area, parseFloat(l.suhuC));
      const tInfo = THRESHOLDS[l.area];
      return `<tr ${ev.ok ? '' : 'style="background:rgba(239,68,68,.05)"'}>
        <td>${Utils.esc(l.tgl)}</td>
        <td>${Utils.esc(l.jam)}</td>
        <td>${Utils.esc(l.shift)}</td>
        <td>${tInfo ? tInfo.icon + ' ' + tInfo.label.split(' (')[0] : Utils.esc(l.area)}</td>
        <td style="text-align:right;font-weight:700;color:${ev.ok ? '#22c55e' : '#ef4444'}">${parseFloat(l.suhuC).toFixed(1)}°C</td>
        <td>${ev.ok ? '<span class="badge badge-success">OK</span>' : `<span class="badge badge-danger">CRITICAL</span>`}</td>
        <td>${Utils.esc(l.ket || '')}</td>
        <td>${Utils.esc(l.by || '')}</td>
        ${canEdit ? `<td><button class="btn btn-xs btn-ghost" onclick="HaccpModule.deleteTempLog('${l.id}')">🗑️</button></td>` : ''}
      </tr>`;
    }).join('');

    return matrixHtml + `
      <div class="card">
        <div class="card-header"><div class="card-title">📋 Log Suhu (50 terakhir)</div></div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Jam</th><th>Shift</th><th>Area</th><th>Suhu</th><th>Status</th><th>Catatan</th><th>By</th>${canEdit?'<th></th>':''}</tr></thead>
            <tbody>${rows || `<tr><td colspan="${canEdit?9:8}" style="text-align:center;padding:20px;color:var(--text-3)">Belum ada log suhu</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function openQuickLog() {
    if (!Auth.can('haccp', 'all')) { Notify.warning('Tidak ada akses tambah HACCP'); return; }
    const user = Auth.currentUser();
    const now = new Date();
    const defaultShift = now.getHours() < 11 ? 'Pagi' : now.getHours() < 17 ? 'Siang' : 'Malam';
    Modal.open({
      id: 'haccp-temp-add',
      title: '🌡️ Log Suhu',
      size: 'modal-md',
      body: `
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Tanggal</label>
            <input type="date" id="ht-tgl" class="form-control" value="${_ymd(now)}">
          </div>
          <div class="form-group">
            <label class="form-label">Jam</label>
            <input type="time" id="ht-jam" class="form-control" value="${_hhmm(now)}">
          </div>
        </div>
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Shift</label>
            <select id="ht-shift" class="form-control">
              ${SHIFTS.map(s => `<option value="${s}" ${s===defaultShift?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Area</label>
            <select id="ht-area" class="form-control" onchange="HaccpModule._onAreaChange(this.value)">
              ${Object.entries(THRESHOLDS).map(([k,t]) => `<option value="${k}">${t.icon} ${t.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Suhu (°C) <span id="ht-target" style="font-size:11px;color:var(--text-3);font-weight:400"></span></label>
          <input type="number" step="0.1" id="ht-suhu" class="form-control" placeholder="contoh: -20 atau 65" style="font-size:18px;font-weight:700">
          <div id="ht-status" style="margin-top:6px;font-size:12px"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan (opsional)</label>
          <input type="text" id="ht-ket" class="form-control" placeholder="contoh: setelah loading, AC nyala">
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close('haccp-temp-add')">Batal</button>
        <button class="btn btn-primary" onclick="HaccpModule._saveTempLog()">💾 Simpan</button>
      `,
      onOpen: () => {
        const inp = document.getElementById('ht-suhu');
        const updateTarget = () => {
          const a = document.getElementById('ht-area').value;
          const t = THRESHOLDS[a];
          document.getElementById('ht-target').textContent = t ? ` — Target: ${t.min}°C s/d ${t.max}°C` : '';
        };
        updateTarget();
        inp.oninput = () => {
          const a = document.getElementById('ht-area').value;
          const v = parseFloat(inp.value);
          const status = document.getElementById('ht-status');
          if (isNaN(v)) { status.innerHTML = ''; return; }
          const ev = _evalTemp(a, v);
          status.innerHTML = ev.ok
            ? `<span style="color:#22c55e">✓ Dalam batas aman</span>`
            : `<span style="color:#ef4444">⚠ ${ev.msg} — KRITIS</span>`;
        };
        document.getElementById('ht-area').addEventListener('change', updateTarget);
        setTimeout(() => inp.focus(), 80);
      },
    });
  }
  function _onAreaChange(area) {
    const t = THRESHOLDS[area];
    document.getElementById('ht-target').textContent = t ? ` — Target: ${t.min}°C s/d ${t.max}°C` : '';
  }

  async function _saveTempLog() {
    const user = Auth.currentUser();
    const suhu = parseFloat(document.getElementById('ht-suhu').value);
    if (isNaN(suhu)) { Notify.warning('Isi suhu dulu'); return; }
    const data = {
      tgl: document.getElementById('ht-tgl').value,
      jam: document.getElementById('ht-jam').value,
      shift: document.getElementById('ht-shift').value,
      area: document.getElementById('ht-area').value,
      suhuC: suhu,
      ket: document.getElementById('ht-ket').value.trim(),
      by: user?.nama || user?.username || '',
      ts: Date.now(),
    };
    const ev = _evalTemp(data.area, suhu);
    if (!ev.ok) {
      const confirm = await new Promise(r => Modal.confirm({
        title: '⚠ Suhu di luar batas!',
        message: `${ev.msg}. Tetap simpan? Critical Control Point akan terflag di laporan.`,
        danger: true,
        okText: 'Tetap Simpan',
        onConfirm: () => r(true),
        onCancel: () => r(false),
      }));
      if (!confirm) return;
    }
    try {
      await DB.saveHaccpTemp(data);
      DB.logActivity({ type: 'haccp_temp_log', detail: `${data.area} ${data.suhuC}°C ${ev.ok?'OK':'CRITICAL'}` });
      Modal.close('haccp-temp-add');
      Notify.success('Log suhu tersimpan' + (ev.ok ? '' : ' (flagged CRITICAL)'));
      await _load();
      _renderTab();
    } catch (e) { Notify.error('Gagal: ' + e.message); }
  }

  function deleteTempLog(id) {
    Modal.confirm({
      title: 'Hapus log?',
      message: 'Log suhu akan dihapus permanen.',
      danger: true,
      onConfirm: async () => {
        try {
          await DB.deleteHaccpTemp(id);
          DB.logActivity({ type: 'haccp_temp_del', detail: 'ID ' + id });
          await _load(); _renderTab();
          Notify.success('Log dihapus');
        } catch (e) { Notify.error(e.message); }
      },
    });
  }

  // ── Tab: Sanitasi ──────────────────────────────────────
  function _renderSanitation() {
    const today = _ymd();
    const todaySanit = _sanitLogs.filter(l => l.tgl === today);
    const canEdit = Auth.can('haccp', 'all');

    const recent = [..._sanitLogs].sort((a,b) => (b.tgl + (b.jam||'')) > (a.tgl + (a.jam||'')) ? 1 : -1).slice(0, 30);
    const rows = recent.map(l => {
      const items = Array.isArray(l.items) ? l.items : [];
      const totalOk = items.filter(i => i.ok).length;
      const totalCritical = items.filter(i => !i.ok && i.critical).length;
      const totalAll = items.length;
      let badge;
      if (totalCritical > 0) badge = `<span class="badge badge-danger">${totalCritical} CRITICAL FAIL</span>`;
      else if (totalOk === totalAll) badge = `<span class="badge badge-success">Lengkap (${totalOk}/${totalAll})</span>`;
      else badge = `<span class="badge" style="background:var(--surface2);color:var(--text-2)">${totalOk}/${totalAll}</span>`;
      return `<tr>
        <td>${Utils.esc(l.tgl)}</td>
        <td>${Utils.esc(l.jam || '')}</td>
        <td>${Utils.esc(l.shift)}</td>
        <td>${badge}</td>
        <td>${Utils.esc(l.by || '')}</td>
        <td><button class="btn btn-xs btn-ghost" onclick="HaccpModule.viewSanit('${l.id}')">👁 Detail</button></td>
      </tr>`;
    }).join('');

    return `
      <div class="card" style="margin-bottom:14px">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-title">🧼 Sanitasi Hari Ini — ${today}</div>
          ${canEdit ? `<button class="btn btn-primary" onclick="HaccpModule.openSanitCheck()">+ Checklist Baru</button>` : ''}
        </div>
        <div style="padding:14px;font-size:12px;color:var(--text-2)">
          ${todaySanit.length === 0
            ? `<div style="text-align:center;color:var(--text-3);padding:20px">Belum ada checklist hari ini. Klik tombol di atas.</div>`
            : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
                ${todaySanit.map(l => {
                  const items = Array.isArray(l.items) ? l.items : [];
                  const ok = items.filter(i => i.ok).length;
                  const total = items.length;
                  const crit = items.filter(i => !i.ok && i.critical).length;
                  return `<div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:${crit>0?'rgba(239,68,68,.05)':'var(--surface)'}">
                    <div style="font-weight:700;font-size:13px">Shift ${Utils.esc(l.shift)}</div>
                    <div style="font-size:11px;color:var(--text-3);margin-top:2px">${Utils.esc(l.jam || '')} · ${Utils.esc(l.by || '')}</div>
                    <div style="margin-top:6px;font-size:12px">${ok}/${total} OK${crit>0?` · <span style="color:#ef4444">${crit} critical</span>`:''}</div>
                  </div>`;
                }).join('')}
              </div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📋 Riwayat Sanitasi (30 terakhir)</div></div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Jam</th><th>Shift</th><th>Status</th><th>By</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-3)">Belum ada checklist</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function openSanitCheck() {
    if (!Auth.can('haccp', 'all')) { Notify.warning('Tidak ada akses'); return; }
    const now = new Date();
    const defaultShift = now.getHours() < 11 ? 'Pagi' : now.getHours() < 17 ? 'Siang' : 'Malam';
    Modal.open({
      id: 'haccp-sanit-add',
      title: '🧼 Checklist Sanitasi',
      size: 'modal-md',
      body: `
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Tanggal</label>
            <input type="date" id="hs-tgl" class="form-control" value="${_ymd(now)}">
          </div>
          <div class="form-group">
            <label class="form-label">Shift</label>
            <select id="hs-shift" class="form-control">
              ${SHIFTS.map(s => `<option value="${s}" ${s===defaultShift?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-2);margin-bottom:8px">Centang yang sudah dicek. Item <span style="color:#ef4444">●</span> wajib (critical).</div>
        <div style="display:grid;gap:6px;max-height:340px;overflow-y:auto;padding:4px">
          ${SANITATION_ITEMS.map((it, i) => `
            <label style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:6px;cursor:pointer" id="hs-row-${i}">
              <input type="checkbox" data-key="${it.key}" data-critical="${it.critical?'1':'0'}" data-label="${Utils.esc(it.label)}" style="width:18px;height:18px;cursor:pointer">
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600">${Utils.esc(it.label)}</div>
              </div>
              ${it.critical ? '<span style="color:#ef4444;font-size:16px">●</span>' : ''}
            </label>
          `).join('')}
        </div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Catatan tambahan</label>
          <textarea id="hs-ket" class="form-control" rows="2" placeholder="contoh: tikus terdeteksi di gudang belakang"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="document.querySelectorAll('#haccp-sanit-add input[type=checkbox]').forEach(c=>c.checked=true)">Centang Semua</button>
        <button class="btn btn-secondary" onclick="Modal.close('haccp-sanit-add')">Batal</button>
        <button class="btn btn-primary" onclick="HaccpModule._saveSanit()">💾 Simpan</button>
      `,
    });
  }

  async function _saveSanit() {
    const user = Auth.currentUser();
    const items = Array.from(document.querySelectorAll('#haccp-sanit-add input[type=checkbox]')).map(c => ({
      key: c.dataset.key,
      label: c.dataset.label,
      critical: c.dataset.critical === '1',
      ok: c.checked,
    }));
    const data = {
      tgl: document.getElementById('hs-tgl').value,
      jam: _hhmm(),
      shift: document.getElementById('hs-shift').value,
      items,
      ket: document.getElementById('hs-ket').value.trim(),
      by: user?.nama || user?.username || '',
      ts: Date.now(),
    };
    const critFail = items.filter(i => !i.ok && i.critical).length;
    if (critFail > 0) {
      const ok = await new Promise(r => Modal.confirm({
        title: `⚠ ${critFail} item critical belum dicek!`,
        message: 'Tetap simpan? Critical fail akan masuk ke laporan compliance.',
        danger: true,
        okText: 'Tetap Simpan',
        onConfirm: () => r(true),
        onCancel: () => r(false),
      }));
      if (!ok) return;
    }
    try {
      await DB.saveHaccpSanitation(data);
      DB.logActivity({ type: 'haccp_sanit_log', detail: `${data.shift} ${items.filter(i=>i.ok).length}/${items.length}` });
      Modal.close('haccp-sanit-add');
      Notify.success('Checklist tersimpan');
      await _load(); _renderTab();
    } catch (e) { Notify.error('Gagal: ' + e.message); }
  }

  function viewSanit(id) {
    const log = _sanitLogs.find(l => l.id === id);
    if (!log) return;
    const items = Array.isArray(log.items) ? log.items : [];
    Modal.open({
      id: 'haccp-sanit-view',
      title: `🧼 Sanitasi ${log.tgl} ${log.shift}`,
      size: 'modal-md',
      body: `
        <div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Oleh: ${Utils.esc(log.by||'-')} pada ${Utils.esc(log.jam||'-')}</div>
        <div style="display:grid;gap:4px">
          ${items.map(i => `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:6px;background:${i.ok?'rgba(34,197,94,.05)':(i.critical?'rgba(239,68,68,.08)':'var(--surface2)')}">
              <span style="font-size:16px;color:${i.ok?'#22c55e':'#ef4444'}">${i.ok?'✓':'✗'}</span>
              <span style="flex:1;font-size:12px">${Utils.esc(i.label)}</span>
              ${i.critical ? '<span style="color:#ef4444;font-size:12px;font-weight:700">Critical</span>' : ''}
            </div>
          `).join('')}
        </div>
        ${log.ket ? `<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:6px;font-size:12px"><strong>Catatan:</strong> ${Utils.esc(log.ket)}</div>` : ''}
      `,
      footer: `<button class="btn btn-secondary" onclick="Modal.close('haccp-sanit-view')">Tutup</button>`,
    });
  }

  // ── Tab: Bahan Masuk (Receiving) ──────────────────────
  function _renderReceiving() {
    const canEdit = Auth.can('haccp', 'all');
    const sorted = [..._receiving].sort((a, b) => (b.tgl + '') > (a.tgl + '') ? 1 : -1).slice(0, 50);
    const rows = sorted.map(r => {
      const items = Array.isArray(r.items) ? r.items : [];
      const supplierName = (_suppliers.find(s => s.id === r.supplierId)?.nama) || r.supplierNama || '-';
      // Check expiry warning: any item expires < 7 days
      const today = _ymd();
      const expiringSoon = items.filter(i => i.expDate && i.expDate <= _addDays(today, 7) && i.expDate >= today).length;
      const expired = items.filter(i => i.expDate && i.expDate < today).length;
      return `<tr>
        <td>${Utils.esc(r.tgl)}</td>
        <td>${Utils.esc(supplierName)}</td>
        <td>${items.length} item</td>
        <td>${expired > 0 ? `<span class="badge badge-danger">${expired} expired</span>` : expiringSoon > 0 ? `<span class="badge" style="background:#fef3c7;color:#92400e">${expiringSoon} expire <7d</span>` : '<span class="badge badge-success">OK</span>'}</td>
        <td>${Utils.esc(r.by||'')}</td>
        <td>
          <button class="btn btn-xs btn-ghost" onclick="HaccpModule.viewReceiving('${r.id}')">👁</button>
          ${canEdit ? `<button class="btn btn-xs btn-ghost" onclick="HaccpModule.deleteReceiving('${r.id}')">🗑</button>` : ''}
        </td>
      </tr>`;
    }).join('');

    // Expiry alert section
    const today = _ymd();
    const allItems = _receiving.flatMap(r => (Array.isArray(r.items)?r.items:[]).map(i => ({...i, _supplier: r.supplierNama || (_suppliers.find(s=>s.id===r.supplierId)?.nama) || '-', _recTgl: r.tgl})));
    const expiringSoon = allItems.filter(i => i.expDate && i.expDate <= _addDays(today, 7) && i.expDate >= today).sort((a,b) => a.expDate > b.expDate ? 1 : -1);
    const expired = allItems.filter(i => i.expDate && i.expDate < today).sort((a,b) => a.expDate > b.expDate ? 1 : -1);

    let alertHtml = '';
    if (expiringSoon.length + expired.length > 0) {
      alertHtml = `
        <div class="card" style="margin-bottom:14px;border-left:3px solid #ef4444">
          <div class="card-header"><div class="card-title">⚠️ Peringatan Expired</div></div>
          <div style="padding:14px">
            ${expired.length > 0 ? `
              <div style="margin-bottom:8px">
                <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:4px">${expired.length} item KADALUARSA — buang/return!</div>
                <div style="font-size:11px;color:var(--text-2);line-height:1.6">
                  ${expired.slice(0,5).map(i => `${Utils.esc(i.nama)} (${Utils.esc(i.expDate)}, dari ${Utils.esc(i._supplier)})`).join(' · ')}
                  ${expired.length > 5 ? ` · +${expired.length-5} lainnya` : ''}
                </div>
              </div>
            ` : ''}
            ${expiringSoon.length > 0 ? `
              <div>
                <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px">${expiringSoon.length} item akan expire dalam 7 hari:</div>
                <div style="font-size:11px;color:var(--text-2);line-height:1.6">
                  ${expiringSoon.slice(0,8).map(i => `${Utils.esc(i.nama)} (${Utils.esc(i.expDate)})`).join(' · ')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    return alertHtml + `
      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-title">📦 Riwayat Penerimaan Bahan</div>
          ${canEdit ? `<button class="btn btn-primary" onclick="HaccpModule.openReceiving()">+ Catat Penerimaan</button>` : ''}
        </div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Supplier</th><th>Item</th><th>Expiry Status</th><th>By</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-3)">Belum ada catatan penerimaan</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  }
  function _addDays(ymd, n) {
    const d = new Date(ymd + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return _ymd(d);
  }

  function openReceiving() {
    if (!Auth.can('haccp', 'all')) { Notify.warning('Tidak ada akses'); return; }
    Modal.open({
      id: 'haccp-rec-add',
      title: '📦 Catat Penerimaan Bahan',
      size: 'modal-lg',
      body: `
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Tanggal</label>
            <input type="date" id="hr-tgl" class="form-control" value="${_ymd()}">
          </div>
          <div class="form-group">
            <label class="form-label">Supplier</label>
            <select id="hr-supplier" class="form-control">
              <option value="">— Pilih Supplier —</option>
              ${_suppliers.map(s => `<option value="${s.id}">${Utils.esc(s.nama)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Item yang diterima</label>
          <div id="hr-items">
            ${_receiveItemRow(0)}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="HaccpModule._addReceiveItem()" style="margin-top:6px">+ Tambah Item</button>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea id="hr-ket" class="form-control" rows="2" placeholder="contoh: kondisi kemasan rusak, sebagian dikembalikan"></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close('haccp-rec-add')">Batal</button>
        <button class="btn btn-primary" onclick="HaccpModule._saveReceiving()">💾 Simpan</button>
      `,
    });
  }
  function _receiveItemRow(idx) {
    return `
      <div class="hr-item-row" style="display:grid;grid-template-columns:2.5fr 1fr 1fr 1.2fr 0.8fr 32px;gap:6px;margin-bottom:6px;align-items:center">
        <input type="text" class="form-control" placeholder="Nama bahan" data-field="nama" list="hr-item-list-${idx}">
        <input type="number" step="0.01" class="form-control" placeholder="Qty" data-field="qty">
        <input type="text" class="form-control" placeholder="Satuan" data-field="satuan">
        <input type="date" class="form-control" data-field="expDate" title="Tanggal expired">
        <label style="display:flex;align-items:center;gap:4px;font-size:11px;justify-content:center;color:var(--text-2)">
          <input type="checkbox" data-field="halal" style="width:14px;height:14px"> Halal
        </label>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.hr-item-row').remove()" style="padding:4px 8px">✕</button>
        <datalist id="hr-item-list-${idx}">
          ${_items.slice(0, 100).map(it => `<option value="${Utils.esc(it.nama)}">`).join('')}
        </datalist>
      </div>
    `;
  }
  function _addReceiveItem() {
    const wrap = document.getElementById('hr-items');
    const idx = wrap.querySelectorAll('.hr-item-row').length;
    wrap.insertAdjacentHTML('beforeend', _receiveItemRow(idx));
  }

  async function _saveReceiving() {
    const user = Auth.currentUser();
    const rows = document.querySelectorAll('#haccp-rec-add .hr-item-row');
    const items = Array.from(rows).map(row => {
      const get = (f) => row.querySelector(`[data-field="${f}"]`);
      return {
        nama: get('nama').value.trim(),
        qty: parseFloat(get('qty').value) || 0,
        satuan: get('satuan').value.trim(),
        expDate: get('expDate').value || null,
        halal: get('halal').checked,
      };
    }).filter(i => i.nama);
    if (!items.length) { Notify.warning('Tambahkan minimal 1 item'); return; }
    const supplierSel = document.getElementById('hr-supplier');
    const supplierId = supplierSel.value;
    const supplierNama = supplierSel.options[supplierSel.selectedIndex]?.text || '';
    const data = {
      tgl: document.getElementById('hr-tgl').value,
      supplierId,
      supplierNama: supplierId ? supplierNama : '',
      items,
      ket: document.getElementById('hr-ket').value.trim(),
      by: user?.nama || user?.username || '',
      ts: Date.now(),
    };
    try {
      await DB.saveHaccpReceiving(data);
      DB.logActivity({ type: 'haccp_rec_log', detail: `${supplierNama} ${items.length} item` });
      Modal.close('haccp-rec-add');
      Notify.success('Penerimaan tersimpan');
      await _load(); _renderTab();
    } catch (e) { Notify.error(e.message); }
  }

  function viewReceiving(id) {
    const r = _receiving.find(x => x.id === id);
    if (!r) return;
    const items = Array.isArray(r.items) ? r.items : [];
    const supplierName = r.supplierNama || (_suppliers.find(s => s.id === r.supplierId)?.nama) || '-';
    const today = _ymd();
    Modal.open({
      id: 'haccp-rec-view',
      title: `📦 Penerimaan ${r.tgl}`,
      size: 'modal-md',
      body: `
        <div style="font-size:12px;color:var(--text-3);margin-bottom:10px">
          Supplier: <strong>${Utils.esc(supplierName)}</strong> · Oleh: ${Utils.esc(r.by||'-')}
        </div>
        <table class="data-table">
          <thead><tr><th>Nama</th><th>Qty</th><th>Satuan</th><th>Expired</th><th>Halal</th></tr></thead>
          <tbody>
            ${items.map(i => {
              const exp = i.expDate;
              let expHtml = '-';
              if (exp) {
                if (exp < today) expHtml = `<span style="color:#ef4444;font-weight:700">${exp} EXPIRED</span>`;
                else if (exp <= _addDays(today, 7)) expHtml = `<span style="color:#92400e;font-weight:700">${exp} (≤7d)</span>`;
                else expHtml = exp;
              }
              return `<tr>
                <td>${Utils.esc(i.nama)}</td>
                <td>${i.qty}</td>
                <td>${Utils.esc(i.satuan||'-')}</td>
                <td>${expHtml}</td>
                <td>${i.halal?'✓':'-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${r.ket ? `<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:6px;font-size:12px"><strong>Catatan:</strong> ${Utils.esc(r.ket)}</div>` : ''}
      `,
      footer: `<button class="btn btn-secondary" onclick="Modal.close('haccp-rec-view')">Tutup</button>`,
    });
  }

  function deleteReceiving(id) {
    Modal.confirm({
      title: 'Hapus catatan?',
      danger: true,
      onConfirm: async () => {
        try { await DB.deleteHaccpReceiving(id); await _load(); _renderTab(); Notify.success('Dihapus'); }
        catch (e) { Notify.error(e.message); }
      },
    });
  }

  // ── Tab: Ringkasan (Compliance) ────────────────────────
  function _renderSummary() {
    const today = _ymd();
    const last30 = _addDays(today, -30);

    // Compliance suhu: % cek yang dilakukan vs target (3 shift × 4 area × 30 hari = 360)
    const tempLogs30 = _tempLogs.filter(l => l.tgl >= last30);
    const tempTarget = 30 * 3 * Object.keys(THRESHOLDS).length;
    const tempDone = tempLogs30.length;
    const tempCritical = tempLogs30.filter(l => !_evalTemp(l.area, parseFloat(l.suhuC)).ok).length;
    const tempCompliancePct = Math.min(100, Math.round((tempDone / Math.max(tempTarget, 1)) * 100));

    // Compliance sanitasi: jumlah checklist hari dengan critical complete vs hari (30)
    const sanit30 = _sanitLogs.filter(l => l.tgl >= last30);
    const sanitDaysCovered = new Set(sanit30.map(l => l.tgl)).size;
    const sanitCompliancePct = Math.round((sanitDaysCovered / 30) * 100);
    const sanitCriticalFail = sanit30.reduce((s, l) => s + (Array.isArray(l.items) ? l.items.filter(i => !i.ok && i.critical).length : 0), 0);

    // Receiving: jumlah catatan + expired count
    const rec30 = _receiving.filter(r => r.tgl >= last30);
    const allItems30 = rec30.flatMap(r => (Array.isArray(r.items) ? r.items : []));
    const expiredCount = allItems30.filter(i => i.expDate && i.expDate < today).length;
    const halalPct = allItems30.length > 0 ? Math.round((allItems30.filter(i => i.halal).length / allItems30.length) * 100) : 0;

    const tempColor = tempCritical === 0 && tempCompliancePct >= 80 ? '#22c55e' : tempCritical > 0 ? '#ef4444' : '#f59e0b';
    const sanitColor = sanitCriticalFail === 0 && sanitCompliancePct >= 80 ? '#22c55e' : sanitCriticalFail > 0 ? '#ef4444' : '#f59e0b';

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:14px">
        <div class="card" style="padding:14px;border-left:4px solid ${tempColor}">
          <div style="font-size:11px;color:var(--text-3);font-weight:700;letter-spacing:.05em">SUHU 30 HARI</div>
          <div style="font-size:28px;font-weight:800;margin-top:4px;color:${tempColor}">${tempCompliancePct}%</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px">${tempDone} dari ~${tempTarget} cek</div>
          ${tempCritical > 0 ? `<div style="font-size:11px;color:#ef4444;font-weight:700;margin-top:4px">⚠ ${tempCritical} CRITICAL excursion</div>` : ''}
        </div>
        <div class="card" style="padding:14px;border-left:4px solid ${sanitColor}">
          <div style="font-size:11px;color:var(--text-3);font-weight:700;letter-spacing:.05em">SANITASI 30 HARI</div>
          <div style="font-size:28px;font-weight:800;margin-top:4px;color:${sanitColor}">${sanitCompliancePct}%</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px">${sanitDaysCovered} hari ter-cover</div>
          ${sanitCriticalFail > 0 ? `<div style="font-size:11px;color:#ef4444;font-weight:700;margin-top:4px">⚠ ${sanitCriticalFail} critical fail</div>` : ''}
        </div>
        <div class="card" style="padding:14px;border-left:4px solid ${expiredCount>0?'#ef4444':'#22c55e'}">
          <div style="font-size:11px;color:var(--text-3);font-weight:700;letter-spacing:.05em">PENERIMAAN 30 HARI</div>
          <div style="font-size:28px;font-weight:800;margin-top:4px">${rec30.length}</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px">${allItems30.length} item · ${halalPct}% halal-cert</div>
          ${expiredCount > 0 ? `<div style="font-size:11px;color:#ef4444;font-weight:700;margin-top:4px">⚠ ${expiredCount} kadaluarsa</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">📋 Critical Events (excursion + critical fail)</div></div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead><tr><th>Tanggal</th><th>Jenis</th><th>Detail</th><th>By</th></tr></thead>
            <tbody>
              ${[
                ...tempLogs30.filter(l => !_evalTemp(l.area, parseFloat(l.suhuC)).ok).map(l => ({
                  tgl: l.tgl, jenis: '🌡️ Suhu',
                  detail: `${THRESHOLDS[l.area]?.label||l.area}: ${l.suhuC}°C (${l.shift})`,
                  by: l.by || '-',
                  ts: l.ts || 0,
                })),
                ...sanit30.filter(l => Array.isArray(l.items) && l.items.some(i => !i.ok && i.critical)).map(l => ({
                  tgl: l.tgl, jenis: '🧼 Sanitasi',
                  detail: `${l.items.filter(i => !i.ok && i.critical).length} critical fail (${l.shift})`,
                  by: l.by || '-',
                  ts: l.ts || 0,
                })),
                ...rec30.flatMap(r => (Array.isArray(r.items)?r.items:[]).filter(i => i.expDate && i.expDate < today).map(i => ({
                  tgl: r.tgl, jenis: '📦 Expired',
                  detail: `${i.nama} expired ${i.expDate}`,
                  by: r.by || '-',
                  ts: r.ts || 0,
                }))),
              ].sort((a,b) => b.ts - a.ts).slice(0, 30).map(e => `
                <tr style="background:rgba(239,68,68,.03)">
                  <td>${Utils.esc(e.tgl)}</td>
                  <td>${e.jenis}</td>
                  <td>${Utils.esc(e.detail)}</td>
                  <td>${Utils.esc(e.by)}</td>
                </tr>
              `).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:#22c55e">✓ Tidak ada critical event 30 hari terakhir — bagus!</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function exportReport() {
    const w = window.open('', '_blank');
    if (!w) { Notify.error('Popup diblokir browser'); return; }
    const today = _ymd();
    const last30 = _addDays(today, -30);
    const tempLogs30 = _tempLogs.filter(l => l.tgl >= last30);
    const sanit30 = _sanitLogs.filter(l => l.tgl >= last30);
    const rec30 = _receiving.filter(r => r.tgl >= last30);
    const critTemp = tempLogs30.filter(l => !_evalTemp(l.area, parseFloat(l.suhuC)).ok);

    w.document.write(`
      <!DOCTYPE html><html><head><title>HACCP Report ${today}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;font-size:12px;line-height:1.5}
        h1{font-size:20px;margin-bottom:4px}
        h2{font-size:14px;margin-top:18px;border-bottom:1px solid #999;padding-bottom:3px}
        table{width:100%;border-collapse:collapse;margin-top:6px}
        th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}
        th{background:#f3f3f3;font-weight:bold}
        .crit{background:#fee;color:#900;font-weight:bold}
        .footer{margin-top:24px;font-size:10px;color:#666;border-top:1px solid #ddd;padding-top:8px}
      </style></head><body>
      <h1>HACCP Compliance Report</h1>
      <div>Periode: ${last30} s/d ${today}</div>
      <div>Dicetak: ${new Date().toLocaleString('id-ID')} oleh ${Auth.currentUser()?.nama||'-'}</div>

      <h2>1. Ringkasan</h2>
      <table>
        <tr><th>Kategori</th><th>Total Log</th><th>Critical / Excursion</th></tr>
        <tr><td>Log Suhu</td><td>${tempLogs30.length}</td><td class="${critTemp.length>0?'crit':''}">${critTemp.length}</td></tr>
        <tr><td>Checklist Sanitasi</td><td>${sanit30.length}</td><td class="${sanit30.some(l=>(l.items||[]).some(i=>!i.ok&&i.critical))?'crit':''}">${sanit30.reduce((s,l)=>s+(Array.isArray(l.items)?l.items.filter(i=>!i.ok&&i.critical).length:0),0)}</td></tr>
        <tr><td>Penerimaan Bahan</td><td>${rec30.length}</td><td>${rec30.flatMap(r=>(r.items||[]).filter(i=>i.expDate&&i.expDate<today)).length} expired</td></tr>
      </table>

      <h2>2. Critical Temperature Excursions</h2>
      ${critTemp.length === 0 ? '<p>✓ Tidak ada excursion 30 hari terakhir.</p>' : `
      <table>
        <tr><th>Tanggal</th><th>Jam</th><th>Shift</th><th>Area</th><th>Suhu</th><th>By</th></tr>
        ${critTemp.map(l => `<tr class="crit">
          <td>${l.tgl}</td><td>${l.jam}</td><td>${l.shift}</td><td>${THRESHOLDS[l.area]?.label||l.area}</td>
          <td>${l.suhuC}°C</td><td>${l.by||'-'}</td>
        </tr>`).join('')}
      </table>`}

      <h2>3. Sanitation Critical Fails</h2>
      ${sanit30.filter(l => (l.items||[]).some(i => !i.ok && i.critical)).length === 0 ? '<p>✓ Tidak ada critical fail 30 hari terakhir.</p>' : `
      <table>
        <tr><th>Tanggal</th><th>Shift</th><th>Item Critical Fail</th><th>By</th></tr>
        ${sanit30.filter(l => (l.items||[]).some(i => !i.ok && i.critical)).map(l => `<tr class="crit">
          <td>${l.tgl}</td><td>${l.shift}</td>
          <td>${(l.items||[]).filter(i => !i.ok && i.critical).map(i => i.label).join('; ')}</td>
          <td>${l.by||'-'}</td>
        </tr>`).join('')}
      </table>`}

      <div class="footer">Dokumen ini dihasilkan otomatis oleh BECCA HACCP Module. Untuk audit, simpan PDF ini minimal 2 tahun.</div>
      <script>setTimeout(() => window.print(), 400);</${''}script>
      </body></html>
    `);
    w.document.close();
  }

  return {
    init, switchTab,
    openQuickLog, _saveTempLog, deleteTempLog, _onAreaChange,
    openSanitCheck, _saveSanit, viewSanit,
    openReceiving, _saveReceiving, viewReceiving, deleteReceiving, _addReceiveItem,
    exportReport,
  };
})();
window.HaccpModule = HaccpModule;
