/* ============================================
   BECCA V2.0 — Belanja Pasar Module
   Sub-module of Purchase Order.
   Workflow: Select dates → Pick form produksi → Pembagian lokasi → Per-shift breakdown → Print
============================================ */
if (typeof window.POBelanjaPasarModule !== 'undefined') { console.warn('[BP] Already loaded'); }
else { window.POBelanjaPasarModule = (() => {
  let _data = [];     // saved belanja pasar docs
  let _forms = [];    // daily_order_forms from DB
  let _el = null;     // container element (#po-content)
  let _doc = null;    // currently open/editing doc
  let _step = 0;      // 0=list, 1=dates, 2=forms, 3=lokasi, 4=breakdown

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

  /* ── New document ──────────────────────────── */
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
    _renderStep1();
  }

  /* ── Open existing ─────────────────────────── */
  function openDoc(id) {
    _doc = _data.find(d => d.id === id);
    if (!_doc) return;
    _step = 3;
    _renderStep3();
  }

  /* ── Step 1: Date range ────────────────────── */
  function _renderStep1() {
    if (!_el) return;
    _el.innerHTML = `
      <div style="margin-bottom:12px"><button onclick="POBelanjaPasarModule.backToList()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Kembali</button></div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:24px;max-width:500px;margin:0 auto">
        <h3 style="margin-bottom:16px;font-size:16px">Step 1: Pilih Periode</h3>
        <p style="color:var(--text-2);font-size:13px;margin-bottom:16px">Tentukan tanggal awal dan akhir belanja pasar. Setiap hari akan diberi label A, B, C, dst.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="form-group"><label class="form-label">Tanggal Mulai</label>
            <input type="date" class="form-control" id="bp-date-start" value="${_doc.dates?.[0]||''}"></div>
          <div class="form-group"><label class="form-label">Tanggal Akhir</label>
            <input type="date" class="form-control" id="bp-date-end" value="${_doc.dates?.at(-1)||''}"></div>
        </div>
        <div id="bp-date-preview" style="margin-bottom:16px"></div>
        <button class="btn btn-primary" onclick="POBelanjaPasarModule._onStep1Next()" style="width:100%">Lanjut → Pilih Form Produksi</button>
      </div>`;
    // Auto-preview on change
    const upd = () => {
      const s = document.getElementById('bp-date-start')?.value;
      const e = document.getElementById('bp-date-end')?.value;
      const pv = document.getElementById('bp-date-preview');
      if (!s || !e || !pv) return;
      const dates = _dateRange(s, e);
      if (!dates.length) { pv.innerHTML = '<span style="color:var(--danger);font-size:12px">Tanggal tidak valid</span>'; return; }
      pv.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">${dates.map((d,i) => `<span style="background:rgba(5,150,105,.08);color:#059669;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600">${DAY_LABELS[i]||i+1} — ${_fmtDate(d)}</span>`).join('')}</div>`;
    };
    document.getElementById('bp-date-start')?.addEventListener('change', upd);
    document.getElementById('bp-date-end')?.addEventListener('change', upd);
    upd();
  }

  function _onStep1Next() {
    const s = document.getElementById('bp-date-start')?.value;
    const e = document.getElementById('bp-date-end')?.value;
    if (!s || !e) { Notify.warning('Pilih tanggal mulai dan akhir'); return; }
    const dates = _dateRange(s, e);
    if (!dates.length || dates.length > 7) { Notify.warning('Periode maksimal 7 hari'); return; }
    _doc.dates = dates;
    _doc.dayLabels = {};
    dates.forEach((d, i) => { _doc.dayLabels[d] = DAY_LABELS[i] || String(i+1); });
    _doc.periode = _fmtDate(dates[0]) + ' - ' + _fmtDate(dates.at(-1));
    _step = 2;
    _renderStep2();
  }

  /* ── Step 2: Form selection ────────────────── */
  function _renderStep2() {
    if (!_el) return;
    // Find matching forms
    const matched = [];
    _doc.dates.forEach(d => {
      ['S1','S2'].forEach(shift => {
        const f = _forms.find(f => f.tanggal === d && f.shift === shift);
        const label = _doc.dayLabels[d] || '';
        const shiftLabel = shift === 'S1' ? 'Shift 1' : 'Shift 2&3';
        const itemCount = f ? (f.items||[]).filter(it=>it.item).length : 0;
        const selected = _doc.selectedForms?.some(sf => sf.tanggal === d && sf.shift === shift) ?? !!f;
        matched.push({ tanggal: d, shift, label, shiftLabel, formId: f?.id || null, itemCount, available: !!f, selected });
      });
    });
    // Auto-select all available by default if no prior selection
    if (!_doc.selectedForms?.length) matched.forEach(m => { if (m.available) m.selected = true; });

    _el.innerHTML = `
      <div style="margin-bottom:12px;display:flex;gap:6px">
        <button onclick="POBelanjaPasarModule._goStep(1)" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Ubah Tanggal</button>
        <span style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:4px">🛒 ${_doc.periode}</span>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:20px;max-width:600px;margin:0 auto">
        <h3 style="margin-bottom:8px;font-size:16px">Step 2: Pilih Form Produksi</h3>
        <p style="color:var(--text-2);font-size:13px;margin-bottom:16px">Centang form produksi yang ingin dimasukkan ke belanja pasar.</p>
        <div style="margin-bottom:12px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:600;color:var(--primary)">
            <input type="checkbox" id="bp-select-all" onchange="POBelanjaPasarModule._toggleAll(this.checked)" style="width:16px;height:16px;accent-color:var(--primary)" checked> Pilih Semua
          </label>
        </div>
        <div style="display:grid;gap:6px" id="bp-form-list">
          ${matched.map((m, i) => `
            <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid ${m.available?'var(--border)':'rgba(239,68,68,.2)'};border-radius:8px;cursor:${m.available?'pointer':'default'};${m.available?'':'opacity:.5;background:rgba(239,68,68,.03)'}">
              <input type="checkbox" data-idx="${i}" data-tanggal="${m.tanggal}" data-shift="${m.shift}"
                ${m.selected && m.available ? 'checked' : ''} ${m.available?'':'disabled'}
                style="width:16px;height:16px;accent-color:#059669">
              <span style="font-size:11px;font-weight:800;color:#059669;background:rgba(5,150,105,.08);padding:2px 8px;border-radius:4px">${m.label}</span>
              <span style="font-size:13px;font-weight:600">${_fmtDate(m.tanggal)} — ${m.shiftLabel}</span>
              <span style="margin-left:auto;font-size:11px;color:${m.available?'var(--text-2)':'#ef4444'};font-weight:600">${m.available ? m.itemCount+' items' : 'Tidak ada form'}</span>
            </label>
          `).join('')}
        </div>
        <button class="btn btn-primary" onclick="POBelanjaPasarModule._onStep2Next()" style="width:100%;margin-top:16px">Lanjut → Pembagian Lokasi</button>
      </div>`;
  }

  function _toggleAll(checked) {
    document.querySelectorAll('#bp-form-list input[type="checkbox"]:not(:disabled)').forEach(cb => { cb.checked = checked; });
  }

  function _onStep2Next() {
    const selected = [];
    document.querySelectorAll('#bp-form-list input[type="checkbox"]:checked').forEach(cb => {
      const tanggal = cb.dataset.tanggal;
      const shift = cb.dataset.shift;
      const f = _forms.find(f => f.tanggal === tanggal && f.shift === shift);
      if (f) selected.push({ formId: f.id, tanggal, shift, itemCount: (f.items||[]).filter(it=>it.item).length });
    });
    if (!selected.length) { Notify.warning('Pilih minimal satu form'); return; }
    _doc.selectedForms = selected;
    _mergeItems();
    _step = 3;
    _renderStep3();
  }

  /* ── Merge items across selected forms ─────── */
  function _mergeItems() {
    const map = {}; // key = item name lowercase
    _doc.selectedForms.forEach(sf => {
      const f = _forms.find(f => f.id === sf.formId);
      if (!f || !f.items) return;
      f.items.forEach(it => {
        if (!it.item) return;
        const key = it.item.toLowerCase().trim();
        if (!map[key]) {
          map[key] = { item: it.item, satuan: it.satuan || '', totalQty: 0, qtyCikopo: 0, qtyPsKarawang: 0 };
        }
        map[key].totalQty += Number(it.aktQty) || Number(it.estQty) || 0;
      });
    });
    // Preserve existing assignments if re-merging
    const oldItems = _doc.items || [];
    const merged = Object.values(map).sort((a,b) => a.item.localeCompare(b.item));
    merged.forEach(m => {
      const old = oldItems.find(o => o.item.toLowerCase().trim() === m.item.toLowerCase().trim());
      if (old) {
        m.qtyCikopo = Math.min(old.qtyCikopo || 0, m.totalQty);
      }
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
        ${_step >= 2 ? `<button onclick="POBelanjaPasarModule._goStep(2)" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Ubah Form</button>` : ''}
        <button onclick="POBelanjaPasarModule.backToList()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Daftar</button>
        <span style="font-size:12px;font-weight:700;color:#059669">🛒 ${_doc.periode}</span>
        <span style="font-size:11px;color:var(--text-3)">${(items).length} items dari ${(_doc.selectedForms||[]).length} form</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          ${!locked ? `<button onclick="POBelanjaPasarModule._saveDoc()" style="padding:6px 14px;border:none;border-radius:7px;background:#059669;color:#fff;font-size:12px;cursor:pointer;font-weight:700">💾 Simpan</button>` : ''}
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
    // Update sisa cell
    const sisaEl = document.getElementById('bp-sisa-'+idx);
    if (sisaEl) { sisaEl.textContent = _n2(it.qtyPsKarawang); sisaEl.style.color = it.qtyPsKarawang > 0 ? '#6366f1' : 'var(--text-3)'; }
    // Update totals
    const items = _doc.items;
    const tcEl = document.getElementById('bp-total-cikopo');
    const tkEl = document.getElementById('bp-total-krw');
    if (tcEl) tcEl.textContent = _n2(items.reduce((s,i) => s + (i.qtyCikopo||0), 0));
    if (tkEl) tkEl.textContent = _n2(items.reduce((s,i) => s + (i.totalQty - (i.qtyCikopo||0)), 0));
    // Validate
    const inp = document.querySelector(`input[data-idx="${idx}"]`);
    if (inp) inp.style.borderColor = val > it.totalQty ? '#ef4444' : 'var(--border)';
  }

  /* ── Step 4: Per-shift breakdown ───────────── */
  function _goStep(n) {
    _step = n;
    if (n === 1) _renderStep1();
    else if (n === 2) _renderStep2();
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
      const cikopo = [];
      const karawang = [];
      f.items.forEach(fi => {
        if (!fi.item) return;
        const qty = Number(fi.aktQty) || Number(fi.estQty) || 0;
        if (!qty) return;
        const merged = (_doc.items||[]).find(m => m.item.toLowerCase().trim() === fi.item.toLowerCase().trim());
        if (!merged || !merged.totalQty) return;
        const ratioC = (merged.qtyCikopo || 0) / merged.totalQty;
        const ratioK = 1 - ratioC;
        const qC = Math.round(qty * ratioC * 100) / 100;
        const qK = Math.round(qty * ratioK * 100) / 100;
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
            <div style="background:var(--surface2);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:11px;font-weight:800;color:#fff;background:#059669;padding:2px 8px;border-radius:4px">${label}</span>
                <span style="font-size:13px;font-weight:600">${_fmtDate(d)} — ${shiftLabel}</span>
              </div>
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
            <div style="font-size:12px;font-weight:700;margin-bottom:4px;color:${color}">${label} — ${_fmtDate(d)} — ${shiftLabel}</div>
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
  function _dateRange(start, end) {
    const out = [];
    const d = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    while (d <= e) {
      out.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function _fmtDate(d) {
    if (!d) return '-';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('id', { day: 'numeric', month: 'short' });
  }
  function _n2(n) { const v = Number(n)||0; return v === Math.floor(v) ? String(v) : v.toFixed(1); }

  return { init, newDoc, openDoc, backToList,
    _onStep1Next, _onStep2Next, _toggleAll, _onCikopoChange,
    _goStep, _printAll, _saveDoc, _deleteDoc, _selesaikan, _reopen };
})(); }
