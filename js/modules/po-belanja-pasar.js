/* ============================================
   BECCA V2.0 — Belanja Pasar Module
   Sub-module of Purchase Order.
   Workflow: Pick form produksi → Pembagian lokasi → Per-shift breakdown → Print
============================================ */
// v2 — always re-assign to pick up fixes
window.POBelanjaPasarModule = (() => {
  let _data = [];
  let _forms = [];
  let _el = null;
  let _doc = null;
  let _step = 0; // 0=list, 1=pick forms, 3=lokasi, 4=breakdown

  const DAY_LABELS = 'ABCDEFG'.split('');

  /* ── Init ──────────────────────────────────── */
  async function init(container) {
    _el = container || document.getElementById('po-content');
    if (!_el) return;
    try { _data = await DB.getBelanjaPasar(); } catch(e) {
      try { _data = JSON.parse(localStorage.getItem('becca_po_belanja_pasar')||'[]'); } catch { _data = []; }
    }
    _data.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    try { _forms = await DB.getDailyOrderForms(); } catch { _forms = []; }
    _step = 0; _doc = null;
    _renderList();
  }

  /* ── List view ─────────────────────────────── */
  function _renderList() {
    _step = 0; _doc = null;
    if (!_el) return;
    const canEdit = Auth.can('po','edit');
    _el.innerHTML = `
      ${canEdit ? `<div style="margin-bottom:12px;text-align:right">
        <button class="btn btn-primary" onclick="POBelanjaPasarModule.newDoc()">+ Buat Belanja Pasar</button>
      </div>` : ''}
      ${!_data.length
        ? `<div style="text-align:center;padding:48px;color:var(--text-3)"><div style="font-size:32px;margin-bottom:8px">🛒</div>Belum ada data belanja pasar</div>`
        : `<div style="display:grid;gap:10px">${_data.map(d => {
            const n = (d.items||[]).filter(it=>it.item).length;
            const isSelesai = d.status==='selesai';
            return `<div style="background:var(--surface);border:1px solid ${isSelesai?'rgba(100,116,139,.25)':'var(--border)'};border-radius:10px;padding:12px 16px;cursor:pointer;transition:.15s;position:relative;overflow:hidden;${isSelesai?'background:rgba(100,116,139,.06)':''}"
              onclick="POBelanjaPasarModule.openDoc('${d.id}')"
              onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
              ${isSelesai?'<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:28px;font-weight:900;color:rgba(100,116,139,.1);pointer-events:none;letter-spacing:6px;font-style:italic">SELESAI</div>':''}
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;position:relative;z-index:1">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:12px;font-weight:700;color:#059669">🛒 ${d.periode||'-'}</span>
                  ${isSelesai?'<span style="font-size:9px;background:rgba(100,116,139,.15);color:#64748b;padding:1px 6px;border-radius:10px;font-weight:700">Selesai</span>':''}
                </div>
                <span style="font-size:11px;color:var(--text-3)">Oleh: ${d.namaPetugas||'-'}</span>
              </div>
              <div style="display:flex;gap:14px;font-size:12px;color:var(--text-2);position:relative;z-index:1">
                <span>Tanggal: <strong>${(d.dates||[]).length} hari</strong></span>
                <span>Items: <strong>${n}</strong></span>
                <span>Forms: <strong>${(d.selectedForms||[]).length}</strong></span>
              </div>
            </div>`;
          }).join('')}</div>`}`;
  }

  /* ── New document → straight to form picker ── */
  function newDoc() {
    const cu = Auth.currentUser();
    _doc = {
      id: Utils.uid(),
      periode: '', dates: [], dayLabels: {},
      selectedForms: [], items: [], perShift: {},
      status: 'draft',
      namaPetugas: cu?.nama || cu?.username || '',
      createdAt: new Date().toISOString(),
    };
    _step = 1;
    _renderFormPicker();
  }

  /* ── Open existing ─────────────────────────── */
  function openDoc(id) {
    _doc = _data.find(d => d.id === id);
    if (!_doc) return;
    _step = 3;
    _renderStep3();
  }

  /* ── Form picker (replaces old Step 1+2) ───── */
  function _renderFormPicker() {
    if (!_el) return;
    // Only show forms from yesterday (Today()-1) backwards
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth()+1).padStart(2,'0') + '-' + String(yesterday.getDate()).padStart(2,'0');

    // Get all unique dates from forms, sorted newest first
    const dateSet = new Set();
    _forms.forEach(f => { if (f.tanggal) dateSet.add(f.tanggal); });
    console.log('[BP] yesterday cutoff:', yStr, '| all form dates:', [...dateSet].sort());
    const allDates = [...dateSet]
      .filter(d => d <= yStr)
      .sort((a,b) => b.localeCompare(a)); // newest first
    console.log('[BP] filtered dates:', allDates);

    // Build grouped list
    let groupHtml = '';
    allDates.forEach(d => {
      const s1 = _forms.find(f => f.tanggal === d && f.shift === 'S1');
      const s2 = _forms.find(f => f.tanggal === d && f.shift === 'S2');
      if (!s1 && !s2) return;
      const s1Count = s1 ? (s1.items||[]).filter(it=>it.item).length : 0;
      const s2Count = s2 ? (s2.items||[]).filter(it=>it.item).length : 0;
      const alreadySelected = (_doc.selectedForms||[]).some(sf => sf.tanggal === d);

      groupHtml += `
        <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:6px">
          <div style="background:var(--surface2);padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">
            <input type="checkbox" class="bp-date-chk" data-date="${d}"
              ${alreadySelected?'checked':''}
              onchange="POBelanjaPasarModule._onDateToggle('${d}',this.checked)"
              style="width:16px;height:16px;accent-color:#059669">
            <span style="font-size:13px;font-weight:700">${_fmtDateFull(d)}</span>
            <span style="font-size:11px;color:var(--text-3)">${_dayName(d)}</span>
          </div>
          <div style="padding:6px 12px;display:flex;gap:12px" id="bp-shifts-${d}">
            ${s1 ? `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0">
              <input type="checkbox" class="bp-form-chk" data-tanggal="${d}" data-shift="S1" data-fid="${s1.id}"
                ${alreadySelected?'checked':''} style="width:14px;height:14px;accent-color:#059669">
              <span style="font-size:12px">Shift 1</span>
              <span style="font-size:10px;color:var(--text-3);font-weight:600">${s1Count} items</span>
            </label>` : '<span style="font-size:11px;color:var(--text-3);padding:4px 0">Shift 1: —</span>'}
            ${s2 ? `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0">
              <input type="checkbox" class="bp-form-chk" data-tanggal="${d}" data-shift="S2" data-fid="${s2.id}"
                ${alreadySelected?'checked':''} style="width:14px;height:14px;accent-color:#059669">
              <span style="font-size:12px">Shift 2&3</span>
              <span style="font-size:10px;color:var(--text-3);font-weight:600">${s2Count} items</span>
            </label>` : '<span style="font-size:11px;color:var(--text-3);padding:4px 0">Shift 2&3: —</span>'}
          </div>
        </div>`;
    });

    _el.innerHTML = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <button onclick="POBelanjaPasarModule.backToList()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Kembali</button>
        <h3 style="font-size:15px;margin:0">Pilih Form Produksi</h3>
        <span style="font-size:11px;color:var(--text-3)">Centang tanggal & shift yang ingin dimasukkan</span>
      </div>
      <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:600;color:var(--primary)">
          <input type="checkbox" id="bp-select-all" onchange="POBelanjaPasarModule._toggleAll(this.checked)" style="width:16px;height:16px;accent-color:var(--primary)"> Pilih Semua
        </label>
        <span id="bp-selected-count" style="font-size:11px;color:var(--text-3);margin-left:auto">0 form dipilih</span>
      </div>
      <div id="bp-form-list" style="max-height:60vh;overflow-y:auto">
        ${groupHtml || '<div style="text-align:center;padding:32px;color:var(--text-3)">Tidak ada form produksi yang tersedia</div>'}
      </div>
      <button class="btn btn-primary" onclick="POBelanjaPasarModule._onPickDone()" style="width:100%;margin-top:12px">Lanjut → Pembagian Lokasi</button>`;
    _updateCount();
  }

  function _onDateToggle(date, checked) {
    document.querySelectorAll(`.bp-form-chk[data-tanggal="${date}"]`).forEach(cb => { cb.checked = checked; });
    _updateCount();
  }

  function _toggleAll(checked) {
    document.querySelectorAll('.bp-date-chk, .bp-form-chk').forEach(cb => { cb.checked = checked; });
    _updateCount();
  }

  function _updateCount() {
    const n = document.querySelectorAll('.bp-form-chk:checked').length;
    const el = document.getElementById('bp-selected-count');
    if (el) el.textContent = n + ' form dipilih';
  }

  function _onPickDone() {
    const selected = [];
    const dateSet = new Set();
    document.querySelectorAll('.bp-form-chk:checked').forEach(cb => {
      const tanggal = cb.dataset.tanggal;
      const shift = cb.dataset.shift;
      const fid = cb.dataset.fid;
      const f = _forms.find(f => f.id === fid);
      if (f) {
        selected.push({ formId: f.id, tanggal, shift, itemCount: (f.items||[]).filter(it=>it.item).length });
        dateSet.add(tanggal);
      }
    });
    if (!selected.length) { Notify.warning('Pilih minimal satu form'); return; }

    // Build dates + dayLabels from selection
    const dates = [...dateSet].sort();
    _doc.selectedForms = selected;
    _doc.dates = dates;
    _doc.dayLabels = {};
    dates.forEach((d, i) => { _doc.dayLabels[d] = DAY_LABELS[i] || String(i+1); });
    _doc.periode = _fmtDateFull(dates[0]) + ' - ' + _fmtDateFull(dates.at(-1));

    _mergeItems();
    _step = 3;
    _renderStep3();
  }

  /* ── Merge items across selected forms ─────── */
  function _mergeItems() {
    const map = {};
    _doc.selectedForms.forEach(sf => {
      const f = _forms.find(f => f.id === sf.formId);
      if (!f || !f.items) return;
      f.items.forEach(it => {
        if (!it.item) return;
        const key = it.item.toLowerCase().trim();
        if (!map[key]) map[key] = { item: it.item, satuan: it.satuan || '', totalQty: 0, qtyCikopo: 0, qtyPsKarawang: 0 };
        map[key].totalQty += Number(it.aktQty) || Number(it.estQty) || 0;
      });
    });
    const oldItems = _doc.items || [];
    const merged = Object.values(map).sort((a,b) => a.item.localeCompare(b.item));
    merged.forEach(m => {
      const old = oldItems.find(o => o.item.toLowerCase().trim() === m.item.toLowerCase().trim());
      if (old) m.qtyCikopo = Math.min(old.qtyCikopo || 0, m.totalQty);
      m.qtyPsKarawang = Math.round((m.totalQty - m.qtyCikopo) * 100) / 100;
    });
    _doc.items = merged;
  }

  /* ── Step 3: Pembagian Lokasi ──────────────── */
  function _renderStep3() {
    if (!_el || !_doc) return;
    const items = _doc.items || [];
    const locked = _doc.status === 'selesai';

    _el.innerHTML = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button onclick="POBelanjaPasarModule._goStep(1)" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Ubah Form</button>
        <button onclick="POBelanjaPasarModule.backToList()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Daftar</button>
        <span style="font-size:12px;font-weight:700;color:#059669">🛒 ${_doc.periode}</span>
        <span style="font-size:11px;color:var(--text-3)">${items.length} items dari ${(_doc.selectedForms||[]).length} form</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          ${!locked ? `<button onclick="POBelanjaPasarModule._saveDoc()" style="padding:6px 14px;border:none;border-radius:7px;background:#059669;color:#fff;font-size:12px;cursor:pointer;font-weight:700">Simpan</button>` : ''}
          ${!locked ? `<button onclick="POBelanjaPasarModule._selesaikan()" style="padding:6px 12px;border:1px solid rgba(100,116,139,.4);border-radius:7px;background:rgba(100,116,139,.08);color:#64748b;font-size:12px;cursor:pointer;font-weight:600">Selesaikan</button>` : ''}
          ${locked ? `<button onclick="POBelanjaPasarModule._reopen()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">Buka Kembali</button>` : ''}
          <button onclick="POBelanjaPasarModule._deleteDoc()" style="padding:6px 12px;border:1px solid rgba(239,68,68,.3);border-radius:7px;background:rgba(239,68,68,.07);color:#ef4444;font-size:12px;cursor:pointer">Hapus</button>
          <button onclick="POBelanjaPasarModule._goStep(4)" style="padding:6px 14px;border:1px solid rgba(99,102,241,.4);border-radius:7px;background:rgba(99,102,241,.08);color:#6366f1;font-size:12px;cursor:pointer;font-weight:600">Lihat Per-Shift →</button>
        </div>
      </div>

      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:10px">
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px" id="bp-table">
          <thead><tr style="background:linear-gradient(135deg,#059669,#10b981);color:#fff">
            <th style="padding:10px 6px;font-size:9px;font-weight:700;width:30px">#</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:left;min-width:180px">ITEM</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right;width:80px">TOTAL QTY</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;width:60px">SATUAN</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right;width:100px;background:rgba(0,0,0,.15)">CIKOPO</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right;width:120px;background:rgba(255,255,255,.12)">PS. KARAWANG</th>
          </tr></thead>
          <tbody>${items.map((it,i) => {
            const sisa = Math.round((it.totalQty - (it.qtyCikopo||0)) * 100) / 100;
            const bg = i%2 ? 'background:rgba(0,0,0,.012)' : '';
            return `<tr style="border-bottom:1px solid var(--border);${bg}">
              <td style="padding:12px 6px;text-align:center;color:var(--text-3);font-size:10px">${i+1}</td>
              <td style="padding:12px 8px;font-weight:600">${it.item}</td>
              <td style="padding:12px 8px;text-align:right;font-family:var(--font-mono);font-weight:700">${_n2(it.totalQty)}</td>
              <td style="padding:12px 8px;color:var(--text-2)">${it.satuan}</td>
              <td style="padding:8px 4px;text-align:right;background:rgba(5,150,105,.04)">
                ${locked
                  ? `<span style="font-family:var(--font-mono);font-weight:600">${_n2(it.qtyCikopo)}</span>`
                  : `<input type="number" min="0" step="0.5" value="${it.qtyCikopo||0}" data-idx="${i}"
                      onchange="POBelanjaPasarModule._onCikopoChange(${i},+this.value)"
                      style="width:80px;border:1px solid var(--border);border-radius:4px;padding:6px;text-align:right;font-family:var(--font-mono);font-size:12px;background:var(--surface)"
                      onfocus="this.select()">`}
              </td>
              <td style="padding:12px 8px;text-align:right;font-family:var(--font-mono);font-weight:600;background:rgba(99,102,241,.04);color:${sisa>0?'#6366f1':'var(--text-3)'}" id="bp-sisa-${i}">${_n2(sisa)}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);background:var(--surface2)">
              <td colspan="2" style="padding:10px;text-align:right;font-weight:700">Total</td>
              <td style="padding:10px 8px;text-align:right;font-family:var(--font-mono);font-weight:700">${_n2(items.reduce((s,it) => s + (it.totalQty||0), 0))}</td>
              <td></td>
              <td style="padding:10px 8px;text-align:right;font-family:var(--font-mono);font-weight:700;background:rgba(5,150,105,.04)" id="bp-total-cikopo">${_n2(items.reduce((s,it) => s + (it.qtyCikopo||0), 0))}</td>
              <td style="padding:10px 8px;text-align:right;font-family:var(--font-mono);font-weight:700;background:rgba(99,102,241,.04)" id="bp-total-krw">${_n2(items.reduce((s,it) => s + (it.totalQty - (it.qtyCikopo||0)), 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      ${!locked ? `<div style="margin-top:8px;font-size:11px;color:var(--text-3);font-style:italic">Isi jumlah Cikopo, sisanya otomatis ke PS. Karawang</div>` : ''}`;
  }

  function _onCikopoChange(idx, val) {
    if (!_doc || !_doc.items[idx]) return;
    const it = _doc.items[idx];
    it.qtyCikopo = Math.min(val, it.totalQty);
    it.qtyPsKarawang = Math.round((it.totalQty - it.qtyCikopo) * 100) / 100;
    const sisaEl = document.getElementById('bp-sisa-'+idx);
    if (sisaEl) { sisaEl.textContent = _n2(it.qtyPsKarawang); sisaEl.style.color = it.qtyPsKarawang > 0 ? '#6366f1' : 'var(--text-3)'; }
    const items = _doc.items;
    const tcEl = document.getElementById('bp-total-cikopo');
    const tkEl = document.getElementById('bp-total-krw');
    if (tcEl) tcEl.textContent = _n2(items.reduce((s,i) => s + (i.qtyCikopo||0), 0));
    if (tkEl) tkEl.textContent = _n2(items.reduce((s,i) => s + (i.totalQty - (i.qtyCikopo||0)), 0));
    const inp = document.querySelector(`input[data-idx="${idx}"]`);
    if (inp) inp.style.borderColor = val > it.totalQty ? '#ef4444' : 'var(--border)';
  }

  /* ── Step 4: Per-shift breakdown ───────────── */
  function _goStep(n) {
    _step = n;
    if (n === 1) _renderFormPicker();
    else if (n === 3) _renderStep3();
    else if (n === 4) { _computePerShift(); _renderStep4(); }
  }

  function _computePerShift() {
    if (!_doc) return;
    const ps = {};
    (_doc.selectedForms||[]).forEach(sf => {
      const f = _forms.find(f => f.id === sf.formId);
      if (!f || !f.items) return;
      const key = sf.tanggal + '_' + sf.shift;
      const cikopo = [], karawang = [];
      f.items.forEach(fi => {
        if (!fi.item) return;
        const qty = Number(fi.aktQty) || Number(fi.estQty) || 0;
        if (!qty) return;
        const merged = (_doc.items||[]).find(m => m.item.toLowerCase().trim() === fi.item.toLowerCase().trim());
        if (!merged || !merged.totalQty) return;
        const ratioC = (merged.qtyCikopo || 0) / merged.totalQty;
        const qC = Math.round(qty * ratioC * 100) / 100;
        const qK = Math.round(qty * (1 - ratioC) * 100) / 100;
        if (qC > 0) cikopo.push({ item: fi.item, qty: qC, satuan: fi.satuan || merged.satuan || '' });
        if (qK > 0) karawang.push({ item: fi.item, qty: qK, satuan: fi.satuan || merged.satuan || '' });
      });
      ps[key] = { cikopo, psKarawang: karawang };
    });
    _doc.perShift = ps;
  }

  function _renderStep4() {
    if (!_el || !_doc) return;
    const ps = _doc.perShift || {};
    const dates = _doc.dates || [];
    let html = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button onclick="POBelanjaPasarModule._goStep(3)" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Pembagian Lokasi</button>
        <span style="font-size:12px;font-weight:700;color:#059669">🛒 ${_doc.periode}</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button onclick="POBelanjaPasarModule._printAll('cikopo')" style="padding:6px 12px;border:1px solid rgba(5,150,105,.4);border-radius:7px;background:rgba(5,150,105,.08);color:#059669;font-size:12px;cursor:pointer;font-weight:600">Print Cikopo</button>
          <button onclick="POBelanjaPasarModule._printAll('psKarawang')" style="padding:6px 12px;border:1px solid rgba(99,102,241,.4);border-radius:7px;background:rgba(99,102,241,.08);color:#6366f1;font-size:12px;cursor:pointer;font-weight:600">Print PS. Karawang</button>
        </div>
      </div>`;

    dates.forEach(d => {
      const label = _doc.dayLabels?.[d] || '';
      ['S1','S2'].forEach(shift => {
        const key = d + '_' + shift;
        const data = ps[key];
        if (!data) return;
        const shiftLabel = shift === 'S1' ? 'Shift 1' : 'Shift 2&3';
        html += `
          <div style="margin-bottom:12px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
            <div style="background:var(--surface2);padding:10px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">
              <span style="font-size:11px;font-weight:800;color:#fff;background:#059669;padding:2px 8px;border-radius:4px">${label}</span>
              <span style="font-size:13px;font-weight:600">${_fmtDateFull(d)} — ${shiftLabel}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              <div style="border-right:1px solid var(--border);padding:10px">
                <div style="font-size:10px;font-weight:700;color:#059669;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Cikopo (${data.cikopo.length})</div>
                ${data.cikopo.length
                  ? `<table style="width:100%;font-size:11px;border-collapse:collapse">${data.cikopo.map((it,i) =>
                      `<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 6px">${i+1}</td><td style="padding:4px 6px">${it.item}</td><td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);font-weight:600">${_n2(it.qty)}</td><td style="padding:4px 6px;color:var(--text-3)">${it.satuan}</td></tr>`
                    ).join('')}</table>`
                  : '<div style="font-size:11px;color:var(--text-3);padding:8px">— Tidak ada —</div>'}
              </div>
              <div style="padding:10px">
                <div style="font-size:10px;font-weight:700;color:#6366f1;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">PS. Karawang (${data.psKarawang.length})</div>
                ${data.psKarawang.length
                  ? `<table style="width:100%;font-size:11px;border-collapse:collapse">${data.psKarawang.map((it,i) =>
                      `<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 6px">${i+1}</td><td style="padding:4px 6px">${it.item}</td><td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);font-weight:600">${_n2(it.qty)}</td><td style="padding:4px 6px;color:var(--text-3)">${it.satuan}</td></tr>`
                    ).join('')}</table>`
                  : '<div style="font-size:11px;color:var(--text-3);padding:8px">— Tidak ada —</div>'}
              </div>
            </div>
          </div>`;
      });
    });
    _el.innerHTML = html;
  }

  /* ── Print ─────────────────────────────────── */
  function _printAll(lokasi) {
    if (!_doc) return;
    const ps = _doc.perShift || {};
    const dates = _doc.dates || [];
    const title = lokasi === 'cikopo' ? 'CIKOPO' : 'PS. KARAWANG';
    const color = lokasi === 'cikopo' ? '#059669' : '#4f46e5';

    let tables = '';
    dates.forEach(d => {
      const label = _doc.dayLabels?.[d] || '';
      ['S1','S2'].forEach(shift => {
        const key = d + '_' + shift;
        const data = ps[key];
        if (!data) return;
        const items = lokasi === 'cikopo' ? data.cikopo : data.psKarawang;
        if (!items.length) return;
        const shiftLabel = shift === 'S1' ? 'Shift 1' : 'Shift 2&3';
        tables += `
          <div style="margin-bottom:16px;page-break-inside:avoid">
            <div style="font-size:12px;font-weight:700;margin-bottom:4px;color:${color}">${label} — ${_fmtDateFull(d)} — ${shiftLabel}</div>
            <table><thead><tr style="background:${color};color:#fff">
              <th style="padding:5px;font-size:9px;width:25px">NO</th>
              <th style="padding:5px;font-size:9px;text-align:left">ITEM</th>
              <th style="padding:5px;font-size:9px;text-align:right;width:60px">QTY</th>
              <th style="padding:5px;font-size:9px;width:50px">SATUAN</th>
            </tr></thead><tbody>
              ${items.map((it,i) => `<tr style="border-bottom:1px solid #eee;${i%2?'background:#f9f9f9':''}">
                <td style="padding:4px 6px;font-size:10px;text-align:center">${i+1}</td>
                <td style="padding:4px 6px;font-size:10px">${it.item}</td>
                <td style="padding:4px 6px;font-size:10px;text-align:right;font-weight:600">${_n2(it.qty)}</td>
                <td style="padding:4px 6px;font-size:10px">${it.satuan}</td>
              </tr>`).join('')}
            </tbody></table>
          </div>`;
      });
    });

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Belanja Pasar - ${title}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:16px}
    @page{size:A4 portrait;margin:10mm}@media print{.no-print{display:none!important}}table{width:100%;border-collapse:collapse}</style></head><body>
    <button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 20px;background:${color};color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;z-index:99">Print</button>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:${color};background:${color}11;display:inline-block;padding:2px 8px;border-radius:3px">BPS</div>
      <div style="font-size:20px;font-weight:900;margin-top:4px">FORM BELANJA PASAR — ${title}</div>
      <div style="font-size:11px;color:#666;margin-top:2px">Periode: ${_doc.periode} | Petugas: ${_doc.namaPetugas||'-'}</div>
    </div>
    ${tables}
    </body></html>`;
    const w = window.open('','_blank','width=800,height=900');
    if (w) { w.document.write(html); w.document.close(); }
  }

  /* ── Save / Delete / Status ────────────────── */
  async function _saveDoc() {
    if (!_doc) return;
    _doc.updatedAt = new Date().toISOString();
    _computePerShift();
    try {
      await DB.saveBelanjaPasar(_doc);
      if (!_data.find(d => d.id === _doc.id)) _data.unshift(_doc);
      Notify.success('Belanja pasar disimpan');
    } catch(e) { Notify.error('Gagal menyimpan'); }
  }

  async function _deleteDoc() {
    if (!_doc) return;
    const ok = await Modal.confirm({title:'Hapus Belanja Pasar',message:'Data ini akan dihapus permanen.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    _data = _data.filter(d => d.id !== _doc.id);
    try { await DB.deleteBelanjaPasar(_doc.id); } catch {}
    Notify.success('Data dihapus');
    _renderList();
  }

  async function _selesaikan() {
    if (!_doc) return;
    await _saveDoc();
    _doc.status = 'selesai';
    await DB.saveBelanjaPasar(_doc);
    Notify.success('Ditandai Selesai');
    _renderStep3();
  }

  async function _reopen() {
    if (!_doc) return;
    _doc.status = 'draft';
    await DB.saveBelanjaPasar(_doc);
    Notify.success('Dibuka kembali');
    _renderStep3();
  }

  function backToList() { _renderList(); }

  /* ── Helpers ───────────────────────────────── */
  function _fmtDateFull(d) {
    if (!d) return '-';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function _dayName(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('id', { weekday: 'long' });
  }
  function _n2(n) { const v = Number(n)||0; return v === Math.floor(v) ? String(v) : v.toFixed(1); }

  return { init, newDoc, openDoc, backToList,
    _onDateToggle, _toggleAll, _updateCount, _onPickDone, _onCikopoChange,
    _goStep, _printAll, _saveDoc, _deleteDoc, _selesaikan, _reopen };
})();
