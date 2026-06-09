/* ============================================
   BECCA V2.0 — Form Belanja Pasar Module
   Sub-module of Purchase Order.
   Only items with sumber PASAR or PARTIAL enter this form.
   Cikopo: merged all dates. PS Karawang: per date per shift.
============================================ */
window.POBelanjaPasarModule = (() => {
  let _data = [];
  let _forms = [];
  let _el = null;
  let _doc = null;
  let _step = 0; // 0=list, 1=pick forms, 3=lokasi, 4=breakdown

  const DAY_LABELS = 'ABCDEFG'.split('');
  const rp = n => n ? 'Rp '+Math.round(Number(n)).toLocaleString('id') : '';

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
        <button class="btn btn-primary" onclick="POBelanjaPasarModule.newDoc()">+ Buat Form Belanja Pasar</button>
      </div>` : ''}
      ${!_data.length
        ? UI.empty({iconKey:'cart', title:'Belum ada data', desc:'Belum ada belanja pasar'})
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
                <span>${(d.dates||[]).length} hari</span>
                <span>Items: <strong>${n}</strong></span>
                <span>Forms: <strong>${(d.selectedForms||[]).length}</strong></span>
              </div>
            </div>`;
          }).join('')}</div>`}`;
  }

  /* ── New ────────────────────────────────────── */
  function newDoc() {
    const cu = Auth.currentUser();
    _doc = {
      id: Utils.uid(), periode: '', dates: [], dayLabels: {},
      selectedForms: [], items: [], cikopo: [], perShiftKarawang: {},
      status: 'draft', namaPetugas: cu?.nama || cu?.username || '',
      createdAt: new Date().toISOString(),
    };
    _step = 1;
    _renderFormPicker();
  }

  function openDoc(id) {
    _doc = _data.find(d => d.id === id);
    if (!_doc) return;
    _step = 3;
    _renderStep3();
  }

  /* ── Form picker ───────────────────────────── */
  function _renderFormPicker() {
    if (!_el) return;
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth()+1).padStart(2,'0') + '-' + String(yesterday.getDate()).padStart(2,'0');

    const dateSet = new Set();
    _forms.forEach(f => { if (f.tanggal) dateSet.add(f.tanggal); });
    const allDates = [...dateSet].filter(d => d >= yStr).sort((a,b) => a.localeCompare(b));

    // Collect formIds already used in OTHER belanja pasar docs (prevent double-use)
    const usedFormIds = new Set();
    _data.forEach(bp => {
      if (bp.id === _doc?.id) return; // exclude current doc being edited
      (bp.selectedForms||[]).forEach(sf => { if (sf.formId) usedFormIds.add(sf.formId); });
    });

    let groupHtml = '';
    allDates.forEach(d => {
      const s1 = _forms.find(f => f.tanggal === d && f.shift === 'S1');
      const s2 = _forms.find(f => f.tanggal === d && f.shift === 'S2');
      if (!s1 && !s2) return;
      const s1Count = s1 ? (s1.items||[]).filter(it=>it.item).length : 0;
      const s2Count = s2 ? (s2.items||[]).filter(it=>it.item).length : 0;
      const s1Used = s1 && usedFormIds.has(s1.id);
      const s2Used = s2 && usedFormIds.has(s2.id);
      const alreadySelected = (_doc.selectedForms||[]).some(sf => sf.tanggal === d);

      groupHtml += `
        <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:6px">
          <div style="background:var(--surface2);padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border)">
            <input type="checkbox" class="bp-date-chk" data-date="${d}"
              ${alreadySelected?'checked':''}
              onchange="POBelanjaPasarModule._onDateToggle('${d}',this.checked)"
              style="width:16px;height:16px;accent-color:#059669">
            <span style="font-size:13px;font-weight:700">${_fmtFull(d)}</span>
            <span style="font-size:11px;color:var(--text-3)">${_dayName(d)}</span>
          </div>
          <div style="padding:6px 12px;display:flex;gap:12px">
            ${s1 ? (s1Used
              ? `<span style="font-size:11px;color:#f59e0b;padding:4px 0;font-weight:600">Shift 1 <span style="font-size:9px;background:rgba(245,158,11,.1);padding:1px 5px;border-radius:3px">sudah dipakai</span></span>`
              : `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0">
              <input type="checkbox" class="bp-form-chk" data-tanggal="${d}" data-shift="S1" data-fid="${s1.id}"
                ${alreadySelected?'checked':''} style="width:14px;height:14px;accent-color:#059669">
              <span style="font-size:12px">Shift 1</span>
              <span style="font-size:10px;color:var(--text-3);font-weight:600">${s1Count} items</span>
            </label>`) : '<span style="font-size:11px;color:var(--text-3);padding:4px 0">Shift 1: —</span>'}
            ${s2 ? (s2Used
              ? `<span style="font-size:11px;color:#f59e0b;padding:4px 0;font-weight:600">Shift 2&3 <span style="font-size:9px;background:rgba(245,158,11,.1);padding:1px 5px;border-radius:3px">sudah dipakai</span></span>`
              : `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0">
              <input type="checkbox" class="bp-form-chk" data-tanggal="${d}" data-shift="S2" data-fid="${s2.id}"
                ${alreadySelected?'checked':''} style="width:14px;height:14px;accent-color:#059669">
              <span style="font-size:12px">Shift 2&3</span>
              <span style="font-size:10px;color:var(--text-3);font-weight:600">${s2Count} items</span>
            </label>`) : '<span style="font-size:11px;color:var(--text-3);padding:4px 0">Shift 2&3: —</span>'}
          </div>
        </div>`;
    });

    _el.innerHTML = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <button onclick="POBelanjaPasarModule.backToList()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Kembali</button>
        <h3 style="font-size:15px;margin:0">Pilih Form Produksi</h3>
      </div>
      <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:600;color:var(--primary)">
          <input type="checkbox" id="bp-select-all" onchange="POBelanjaPasarModule._toggleAll(this.checked)" style="width:16px;height:16px;accent-color:var(--primary)"> Pilih Semua
        </label>
        <span id="bp-selected-count" style="font-size:11px;color:var(--text-3);margin-left:auto">0 form dipilih</span>
      </div>
      <div id="bp-form-list" style="max-height:60vh;overflow-y:auto">
        ${groupHtml || UI.empty({iconKey:'calendar', title:'Tidak ada form produksi'})}
      </div>
      <button class="btn btn-primary" onclick="POBelanjaPasarModule._onPickDone()" style="width:100%;margin-top:12px">Lanjut → Form Belanja Pasar</button>`;
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

  async function _onPickDone() {
    const selected = [];
    const dateSet = new Set();
    document.querySelectorAll('.bp-form-chk:checked').forEach(cb => {
      const tanggal = cb.dataset.tanggal;
      const shift = cb.dataset.shift;
      const fid = cb.dataset.fid;
      const f = _forms.find(f => f.id === fid);
      if (f) { selected.push({ formId: f.id, tanggal, shift }); dateSet.add(tanggal); }
    });
    if (!selected.length) { Notify.warning('Pilih minimal satu form'); return; }
    const dates = [...dateSet].sort();
    _doc.selectedForms = selected;
    _doc.dates = dates;
    _doc.dayLabels = {};
    dates.forEach((d, i) => { _doc.dayLabels[d] = DAY_LABELS[i] || String(i+1); });
    _doc.periode = _fmtFull(dates[0]) + ' - ' + _fmtFull(dates.at(-1));
    await _mergeItems();
    _step = 3;
    _renderStep3();
  }

  /* ── Merge: only PASAR + PARTIAL items ─────── */
  async function _mergeItems() {
    // 1. Load inventory stock (fresh from DB)
    let invItems = [], invLogs = [];
    try { invItems = await DB.getInventoryItems(); } catch {}
    try { invLogs = await DB.getInventory(); } catch {}
    // Compute current stock per item
    const logsByItem = {};
    invLogs.forEach(l => { if (l.itemId) (logsByItem[l.itemId] = logsByItem[l.itemId]||[]).push(l); });
    const stockMap = {};
    invItems.forEach(inv => {
      const ls = logsByItem[inv.id] || [];
      const stok = ls.reduce((a,l) => l.jenis==='MASUK' ? a+(l.jumlah||0) : l.jenis==='KELUAR' ? a-(l.jumlah||0) : a, 0);
      stockMap[inv.nama.toLowerCase().trim()] = stok;
    });

    // 2. Accumulate total estQty demand across ALL selected forms + track date/shift per item
    const demandMap = {};
    _doc.selectedForms.forEach(sf => {
      const f = _forms.find(f => f.id === sf.formId);
      if (!f || !f.items) return;
      f.items.forEach(it => {
        if (!it.item) return;
        // Fallback ke aktQty kalau estQty kosong/0 — beberapa form hanya diisi
        // aktQty (qty aktual setelah produksi) tanpa estimasi awal. Sebelumnya
        // item-item itu ke-skip dari Belanja Pasar (mis. cabe rawit merah,
        // cabai hijau tw) padahal aktual mereka dipakai.
        const estQ = Number(it.estQty) || Number(it.aktQty) || 0;
        if (estQ <= 0) return;
        const key = it.item.toLowerCase().trim();
        const _pH = v => { const s = String(v||0).replace(/[Rp\s]/g,''); return /^\d+\.\d{3}/.test(s) ? Number(s.replace(/\./g,'')) : Number(s.replace(/,/g,'.'))||0; };
        if (!demandMap[key]) demandMap[key] = { item: it.item, satuan: it.satuan||'', totalDemand: 0, harga: _pH(it.hargaSatuan), dateShifts: {} };
        demandMap[key].totalDemand += estQ;
        if (!demandMap[key].harga && it.hargaSatuan) demandMap[key].harga = _pH(it.hargaSatuan);
        // Track tanggal + shift per item — untuk display "Tgl X, S1,S2,S3" di tabel
        const tgl = sf.tanggal || f.tanggal;
        const shift = f.shift || sf.shift;
        if (tgl && shift) {
          if (!demandMap[key].dateShifts[tgl]) demandMap[key].dateShifts[tgl] = new Set();
          demandMap[key].dateShifts[tgl].add(shift);
        }
      });
    });

    // 3. Compare demand vs stock → determine what needs to be bought
    const map = {};
    Object.values(demandMap).forEach(d => {
      const key = d.item.toLowerCase().trim();
      const stok = stockMap[key] || 0;
      const demand = d.totalDemand;
      let pasarQty = 0;
      if (stok <= 0)       pasarQty = demand;        // PASAR: no stock at all
      else if (stok < demand) pasarQty = demand - stok; // PARTIAL: buy the shortage
      // else: STOK — don't add to belanja pasar
      if (pasarQty <= 0) return;
      // Serialisasi dateShifts (Set tidak bisa JSON) jadi { '2026-06-01': ['S1','S2'] }
      const dsSer = {};
      Object.entries(d.dateShifts || {}).forEach(([t, s]) => { dsSer[t] = [...s].sort(); });
      map[key] = { item: d.item, satuan: d.satuan, totalQty: Math.round(pasarQty*100)/100, harga: d.harga, qtyCikopo: 0, qtySupplier: 0, qtyKarawang: 0, stokGudang: Math.max(0,stok), totalDemand: demand, dateShifts: dsSer };
    });

    // 4. Preserve existing Cikopo + Supplier assignments
    const oldItems = _doc.items || [];
    const merged = Object.values(map).sort((a,b) => a.item.localeCompare(b.item));
    merged.forEach(m => {
      const old = oldItems.find(o => o.item.toLowerCase().trim() === m.item.toLowerCase().trim());
      if (old) {
        m.qtyCikopo   = Math.min(old.qtyCikopo   || 0, m.totalQty);
        m.qtySupplier = Math.min(old.qtySupplier || 0, m.totalQty - m.qtyCikopo);
        // preserve import status supaya tidak duplikat saat re-compute
        m.supplierImportedTo = old.supplierImportedTo || null;
      }
      m.qtyKarawang = Math.round((m.totalQty - (m.qtyCikopo||0) - (m.qtySupplier||0)) * 100) / 100;
    });
    _doc.items = merged;
  }

  // Format dateShifts → string compact untuk display di sel ITEM.
  // Contoh: { '2026-06-01': ['S1','S2','S3'], '2026-06-02': ['S1','S2','S3'], '2026-06-03': ['S1','S2','S3'] }
  //         → "Tgl 1-3 · S1-3"      (semua tanggal sama shift, dan shift continuous)
  //         → "Tgl 1: S1,S2 · Tgl 2: S2"  (shift beda per tanggal)
  function _fmtDateShifts(ds) {
    if (!ds || typeof ds !== 'object') return '';
    const entries = Object.entries(ds);
    if (!entries.length) return '';

    // Helper: kelompokkan angka konsekutif jadi range. [1,2,3,5,6,8] → "1-3,5-6,8"
    const _range = (nums) => {
      const sorted = [...new Set(nums)].sort((a,b)=>a-b);
      if (!sorted.length) return '';
      const out = [];
      let start = sorted[0], prev = sorted[0];
      for (let i = 1; i <= sorted.length; i++) {
        if (i < sorted.length && sorted[i] === prev + 1) { prev = sorted[i]; continue; }
        out.push(start === prev ? String(start) : `${start}-${prev}`);
        if (i < sorted.length) { start = sorted[i]; prev = sorted[i]; }
      }
      return out.join(',');
    };

    // Ambil hari (tanggal) dari ISO date
    const _day = (t) => { const d = new Date(t); return isNaN(d) ? 0 : d.getDate(); };
    // Format shift list: ['S1','S2','S3'] → "S1-3", ['S1','S3'] → "S1,S3"
    const _fmtShifts = (arr) => {
      const nums = arr.map(s => parseInt(String(s).replace(/\D/g,'')) || 0).filter(n => n > 0).sort((a,b)=>a-b);
      if (!nums.length) return '';
      // Continuous → S1-3, scattered → S1,S3
      let contiguous = true;
      for (let i = 1; i < nums.length; i++) if (nums[i] !== nums[i-1] + 1) { contiguous = false; break; }
      if (contiguous && nums.length > 1) return `S${nums[0]}-${nums[nums.length-1]}`;
      return nums.map(n => 'S' + n).join(',');
    };

    // Cek apakah semua tanggal punya shift set yang SAMA → format ringkas
    const days = entries.map(([t]) => _day(t)).filter(d => d > 0);
    const uniqueShiftSets = new Set(entries.map(([,s]) => [...s].sort().join('|')));
    if (uniqueShiftSets.size === 1) {
      const sh = _fmtShifts(entries[0][1]);
      return `Tgl ${_range(days)} · ${sh}`;
    }
    // Per-tanggal breakdown (sort by day)
    return entries
      .map(([t, s]) => ({ day: _day(t), shifts: _fmtShifts(s) }))
      .filter(x => x.day > 0)
      .sort((a,b) => a.day - b.day)
      .map(x => `Tgl ${x.day}: ${x.shifts}`)
      .join(' · ');
  }

  /* ── Step 3: Form Belanja Pasar (pembagian lokasi) ── */
  function _renderStep3() {
    if (!_el || !_doc) return;
    const items = _doc.items || [];
    const locked = _doc.status === 'selesai';
    const grandTotal = items.reduce((s,it) => s + (it.totalQty * (it.harga||0)), 0);

    _el.innerHTML = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button onclick="POBelanjaPasarModule._goStep(1)" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Ubah Form</button>
        <button onclick="POBelanjaPasarModule.backToList()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Daftar</button>
        <span style="font-size:12px;font-weight:700;color:#059669">🛒 ${_doc.periode}</span>
        <span style="font-size:11px;color:var(--text-3)">${items.length} items (PASAR+PARTIAL) dari ${(_doc.selectedForms||[]).length} form</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          ${!locked ? `<button onclick="POBelanjaPasarModule._saveDoc()" style="padding:6px 14px;border:none;border-radius:7px;background:#059669;color:#fff;font-size:12px;cursor:pointer;font-weight:700">Simpan</button>` : ''}
          ${!locked ? `<button onclick="POBelanjaPasarModule._selesaikan()" style="padding:6px 12px;border:1px solid rgba(100,116,139,.4);border-radius:7px;background:rgba(100,116,139,.08);color:#64748b;font-size:12px;cursor:pointer;font-weight:600">Selesaikan</button>` : ''}
          ${locked ? `<button onclick="POBelanjaPasarModule._reopen()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">Buka Kembali</button>` : ''}
          <button onclick="POBelanjaPasarModule._deleteDoc()" style="padding:6px 12px;border:1px solid rgba(239,68,68,.3);border-radius:7px;background:rgba(239,68,68,.07);color:#ef4444;font-size:12px;cursor:pointer">Hapus</button>
          <button onclick="POBelanjaPasarModule._goStep(4)" style="padding:6px 14px;border:1px solid rgba(99,102,241,.4);border-radius:7px;background:rgba(99,102,241,.08);color:#6366f1;font-size:12px;cursor:pointer;font-weight:600">Lihat Per-Shift →</button>
        </div>
      </div>

      <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text)">Form Belanja Pasar — Pembagian Lokasi</div>

      <style>
        /* Desktop ≥769px: table-layout:fixed dengan ITEM auto-flex ngambil sisa lebar.
           Mobile <768px: scroll horizontal — table min-width supaya ITEM tetap memadai. */
        #bp-table{table-layout:fixed;min-width:760px}
        @media (max-width:768px){
          #bp-table{table-layout:auto;min-width:980px}
          #bp-table .bp-item-cell{min-width:170px;max-width:240px}
        }
        /* Item cell: default tidak ada scroll/scrollbar.
           Class .is-overflow ditambah via JS hanya kalau scrollWidth > clientWidth
           (nama benar-benar lebih panjang dari kolom). */
        #bp-table .bp-item-cell{padding:12px 8px}
        #bp-table .bp-item-name{overflow:hidden;white-space:nowrap;font-weight:600}
        #bp-table .bp-item-name.is-overflow{overflow-x:auto;scrollbar-width:thin;-webkit-overflow-scrolling:touch;cursor:ew-resize}
        #bp-table .bp-item-name.is-overflow::-webkit-scrollbar{height:4px}
        #bp-table .bp-item-name.is-overflow::-webkit-scrollbar-thumb{background:var(--text-3);border-radius:2px}
        #bp-table .bp-item-name.is-overflow::-webkit-scrollbar-track{background:transparent}
        /* Sub-line di bawah nama: keterangan tanggal & shift (compact, italic) */
        #bp-table .bp-item-sub{font-size:10px;color:var(--text-3);margin-top:2px;font-weight:400;letter-spacing:.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        /* Sticky thead — background SOLID supaya row di bawah tidak tembus saat scroll.
           Untuk th yang punya tint rgba (CIKOPO/SUPPLIER/KARAWANG/BELI QTY), tint
           dilayer di atas base solid via linear-gradient. */
        #bp-table thead th{position:sticky;top:0;z-index:3;background:var(--thead-bg);box-shadow:inset 0 -1px 0 var(--border)}
        #bp-table thead th.th-tint-beli{background:linear-gradient(rgba(0,0,0,.06),rgba(0,0,0,.06)),var(--thead-bg)}
        #bp-table thead th.th-tint-cikopo{background:linear-gradient(rgba(5,150,105,.18),rgba(5,150,105,.18)),var(--thead-bg)}
        #bp-table thead th.th-tint-supplier{background:linear-gradient(rgba(245,158,11,.18),rgba(245,158,11,.18)),var(--thead-bg)}
        #bp-table thead th.th-tint-karawang{background:linear-gradient(rgba(99,102,241,.15),rgba(99,102,241,.15)),var(--thead-bg)}
      </style>
      <div style="border:1px solid var(--border);border-radius:10px;overflow:auto;-webkit-overflow-scrolling:touch;max-height:calc(100vh - 260px)">
        <table style="width:100%;border-collapse:collapse;font-size:12px" id="bp-table">
          <colgroup>
            <col style="width:28px"><col><!-- ITEM flex -->
            <col style="width:60px"><col style="width:60px"><col style="width:75px">
            <col style="width:48px"><col style="width:82px"><col style="width:92px">
            <col style="width:80px"><col style="width:80px"><col style="width:88px">
          </colgroup>
          <thead><tr style="color:var(--thead-text)">
            <th style="padding:10px 6px;font-size:9px;font-weight:700">#</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:left">ITEM</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right">SISA GUDANG</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right">EST QTY</th>
            <th class="th-tint-beli" style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right" title="Boleh lebih dari kebutuhan — selebihnya jadi stok">BELI QTY</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700">SATUAN</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right">HARGA</th>
            <th style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right">TOTAL</th>
            <th class="th-tint-cikopo" style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right">CIKOPO</th>
            <th class="th-tint-supplier" style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right">SUPPLIER</th>
            <th class="th-tint-karawang" style="padding:10px 6px;font-size:9px;font-weight:700;text-align:right">PS. KARAWANG</th>
          </tr></thead>
          <tbody>${items.map((it,i) => {
            const sisa = Math.round((it.totalQty - (it.qtyCikopo||0) - (it.qtySupplier||0)) * 100) / 100;
            const total = it.totalQty * (it.harga||0);
            const bg = i%2 ? 'background:rgba(0,0,0,.012)' : '';
            return `<tr style="border-bottom:1px solid var(--border);${bg}">
              <td style="padding:12px 6px;text-align:center;color:var(--text-3);font-size:10px">${i+1}</td>
              <td class="bp-item-cell" title="${(it.item||'').replace(/"/g,'&quot;')}${(()=>{const d=_fmtDateShifts(it.dateShifts);return d?'&#10;Kebutuhan: '+d.replace(/"/g,'&quot;'):'';})()}">
                <div class="bp-item-name">${it.item}</div>
                ${(()=>{const d=_fmtDateShifts(it.dateShifts);return d?`<div class="bp-item-sub">📅 ${d}</div>`:'';})()}
              </td>
              <td style="padding:12px 6px;text-align:right;font-family:var(--font-mono);color:${(it.stokGudang||0)>0?'#10b981':'var(--text-3)'};font-weight:600">${_n2(it.stokGudang||0)}</td>
              <td style="padding:12px 6px;text-align:right;font-family:var(--font-mono);color:#6366f1">${_n2(it.totalDemand||0)}</td>
              <td style="padding:8px 4px;text-align:right;background:rgba(0,0,0,.02)">
                ${locked
                  ? `<span style="font-family:var(--font-mono);font-weight:700">${_n2(it.totalQty)}</span>`
                  : `<input type="number" min="0" step="0.5" value="${it.totalQty||''}" data-idx="${i}"
                      class="bp-beli-input"
                      onchange="POBelanjaPasarModule._onBeliQtyChange(${i},+this.value)"
                      title="Bisa lebih besar dari kebutuhan bersih — selebihnya akan jadi stok gudang."
                      style="width:100%;max-width:70px;border:1px solid var(--border);border-radius:4px;padding:6px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:700;background:var(--surface)"
                      onfocus="this.select()">`}
              </td>
              <td style="padding:12px 6px;color:var(--text-2)">${it.satuan}</td>
              <td style="padding:12px 6px;text-align:right;font-family:var(--font-mono);font-size:11px">${it.harga ? rp(it.harga) : '-'}</td>
              <td id="bp-total-${i}" style="padding:12px 6px;text-align:right;font-family:var(--font-mono);font-weight:600;font-size:11px">${total ? rp(total) : '-'}</td>
              <td style="padding:8px 4px;text-align:right;background:rgba(5,150,105,.04)">
                ${locked
                  ? `<span style="font-family:var(--font-mono);font-weight:600">${_n2(it.qtyCikopo)}</span>`
                  : `<input type="number" min="0" step="0.5" value="${it.qtyCikopo||''}" data-idx="${i}" placeholder="0"
                      class="bp-cikopo-input"
                      onchange="POBelanjaPasarModule._onCikopoChange(${i},+this.value)"
                      onkeydown="POBelanjaPasarModule._onCikopoKey(event,${i})"
                      style="width:70px;border:1px solid var(--border);border-radius:4px;padding:6px;text-align:right;font-family:var(--font-mono);font-size:12px;background:var(--surface)"
                      onfocus="this.select()">`}
              </td>
              <td style="padding:8px 4px;text-align:right;background:rgba(245,158,11,.04)">
                ${locked
                  ? `<span style="font-family:var(--font-mono);font-weight:600">${_n2(it.qtySupplier)}</span>`
                  : `<input type="number" min="0" step="0.5" value="${it.qtySupplier||''}" data-idx="${i}" placeholder="0"
                      class="bp-supplier-input"
                      onchange="POBelanjaPasarModule._onSupplierChange(${i},+this.value)"
                      onkeydown="POBelanjaPasarModule._onSupplierKey(event,${i})"
                      style="width:70px;border:1px solid var(--border);border-radius:4px;padding:6px;text-align:right;font-family:var(--font-mono);font-size:12px;background:var(--surface)"
                      onfocus="this.select()">`}
              </td>
              <td style="padding:12px 8px;text-align:right;font-family:var(--font-mono);font-weight:600;background:rgba(99,102,241,.04);color:${sisa>0?'#6366f1':'var(--text-3)'}" id="bp-sisa-${i}">${_n2(sisa)}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);background:var(--surface2)">
              <td colspan="4" style="padding:10px;text-align:right;font-weight:700">Total</td>
              <td style="padding:10px 6px;text-align:right;font-family:var(--font-mono);font-weight:700;background:rgba(0,0,0,.04)" id="bp-total-beli">${_n2(items.reduce((s,it) => s + (it.totalQty||0), 0))}</td>
              <td colspan="2"></td>
              <td style="padding:10px 6px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#dc2626;font-size:11px" id="bp-grand-total">${rp(grandTotal)}</td>
              <td style="padding:10px 6px;text-align:right;font-family:var(--font-mono);font-weight:700;background:rgba(5,150,105,.04)" id="bp-total-cikopo">${_n2(items.reduce((s,it) => s + (it.qtyCikopo||0), 0))}</td>
              <td style="padding:10px 6px;text-align:right;font-family:var(--font-mono);font-weight:700;background:rgba(245,158,11,.04)" id="bp-total-supp">${_n2(items.reduce((s,it) => s + (it.qtySupplier||0), 0))}</td>
              <td style="padding:10px 6px;text-align:right;font-family:var(--font-mono);font-weight:700;background:rgba(99,102,241,.04)" id="bp-total-krw">${_n2(items.reduce((s,it) => s + (it.totalQty - (it.qtyCikopo||0) - (it.qtySupplier||0)), 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      ${!locked ? `<div style="margin-top:8px;font-size:11px;color:var(--text-3);font-style:italic">Cikopo (hijau) → pasar Cikopo · Supplier (kuning) → diteruskan ke Anggaran sebagai mini-card · Sisanya otomatis ke PS. Karawang. Hanya PASAR & PARTIAL yang masuk.</div>` : ''}`;
    // Deteksi overflow nama item — tambah class .is-overflow hanya kalau benar-benar lebih panjang dari cell.
    // Pakai rAF supaya DOM sudah layout sebelum diukur.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('#bp-table .bp-item-name').forEach(el => {
        if (el.scrollWidth - el.clientWidth > 1) el.classList.add('is-overflow');
        else el.classList.remove('is-overflow');
      });
    }));
    // Re-deteksi saat window resize (kolom ITEM flex bisa berubah lebarnya)
    if (!window.__bpResizeBound) {
      window.__bpResizeBound = true;
      window.addEventListener('resize', Utils.debounce(() => {
        document.querySelectorAll('#bp-table .bp-item-name').forEach(el => {
          if (el.scrollWidth - el.clientWidth > 1) el.classList.add('is-overflow');
          else el.classList.remove('is-overflow');
        });
      }, 150));
    }
  }

  // BELI QTY editable — admin boleh beli > kebutuhan bersih (surplus jadi stok)
  function _onBeliQtyChange(idx, val) {
    if (!_doc || !_doc.items[idx]) return;
    const it = _doc.items[idx];
    it.totalQty = Math.max(0, Math.round((+val || 0) * 100) / 100);
    // Re-clamp cikopo + supplier kalau melebihi totalQty baru
    const sum = (it.qtyCikopo || 0) + (it.qtySupplier || 0);
    if (sum > it.totalQty) {
      const overflow = sum - it.totalQty;
      if ((it.qtyCikopo || 0) >= overflow) it.qtyCikopo = Math.round(((it.qtyCikopo || 0) - overflow) * 100) / 100;
      else {
        const remain = overflow - (it.qtyCikopo || 0);
        it.qtyCikopo = 0;
        it.qtySupplier = Math.max(0, Math.round(((it.qtySupplier || 0) - remain) * 100) / 100);
      }
      // Sync Cikopo + Supplier inputs di DOM
      const cInp = document.querySelector(`.bp-cikopo-input[data-idx="${idx}"]`);
      if (cInp) cInp.value = it.qtyCikopo || '';
      const sInp = document.querySelector(`.bp-supplier-input[data-idx="${idx}"]`);
      if (sInp) sInp.value = it.qtySupplier || '';
    }
    it.qtyKarawang = Math.round((it.totalQty - (it.qtyCikopo || 0) - (it.qtySupplier || 0)) * 100) / 100;
    // Reset import status (item belum di-import ulang ke anggaran)
    if (it.supplierImportedTo) it.supplierImportedTo = null;
    _updateBpRow(idx);
  }

  function _onCikopoKey(e, idx) {
    // Handle Enter, Tab, atau "→I" key di Android (kadang fire keydown 'Tab')
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      _onCikopoChange(idx, +e.target.value);
      const inputs = document.querySelectorAll('.bp-cikopo-input');
      const next = [...inputs].find(el => +el.dataset.idx === idx + 1);
      if (next) { next.focus(); next.select(); }
    }
  }

  function _onCikopoChange(idx, val) {
    if (!_doc || !_doc.items[idx]) return;
    const it = _doc.items[idx];
    const supplier = it.qtySupplier || 0;
    // Cikopo + Supplier ≤ totalQty
    it.qtyCikopo = Math.min(Math.max(val, 0), Math.max(0, it.totalQty - supplier));
    it.qtyKarawang = Math.round((it.totalQty - it.qtyCikopo - supplier) * 100) / 100;
    // Write clamped value back to input DOM supaya user lihat nilai aktual
    const inp = document.querySelector(`.bp-cikopo-input[data-idx="${idx}"]`);
    if (inp && +inp.value !== it.qtyCikopo) inp.value = it.qtyCikopo || '';
    _updateBpRow(idx);
  }

  function _onSupplierKey(e, idx) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      _onSupplierChange(idx, +e.target.value);
      const inputs = document.querySelectorAll('.bp-supplier-input');
      const next = [...inputs].find(el => +el.dataset.idx === idx + 1);
      if (next) { next.focus(); next.select(); }
    }
  }

  function _onSupplierChange(idx, val) {
    if (!_doc || !_doc.items[idx]) return;
    const it = _doc.items[idx];
    const cikopo = it.qtyCikopo || 0;
    // Supplier + Cikopo ≤ totalQty
    it.qtySupplier = Math.min(Math.max(val, 0), Math.max(0, it.totalQty - cikopo));
    it.qtyKarawang = Math.round((it.totalQty - cikopo - it.qtySupplier) * 100) / 100;
    // Reset import status kalau qty supplier berubah (item belum di-import lagi)
    if (it.supplierImportedTo) it.supplierImportedTo = null;
    // Write clamped value back to input DOM supaya user lihat nilai aktual
    const inp = document.querySelector(`.bp-supplier-input[data-idx="${idx}"]`);
    if (inp && +inp.value !== it.qtySupplier) inp.value = it.qtySupplier || '';
    _updateBpRow(idx);
  }

  function _updateBpRow(idx) {
    const items = _doc.items;
    const it = items[idx];
    const sisaEl = document.getElementById('bp-sisa-'+idx);
    if (sisaEl) { sisaEl.textContent = _n2(it.qtyKarawang); sisaEl.style.color = it.qtyKarawang > 0 ? '#6366f1' : 'var(--text-3)'; }
    // Refresh TOTAL row cell (totalQty × harga)
    const tEl = document.getElementById('bp-total-'+idx);
    if (tEl) {
      const total = it.totalQty * (it.harga || 0);
      tEl.textContent = total ? rp(total) : '-';
    }
    const tcEl  = document.getElementById('bp-total-cikopo');
    const tsEl  = document.getElementById('bp-total-supp');
    const tkEl  = document.getElementById('bp-total-krw');
    const tqEl  = document.getElementById('bp-total-beli');
    const tgEl  = document.getElementById('bp-grand-total');
    if (tcEl) tcEl.textContent = _n2(items.reduce((s,i) => s + (i.qtyCikopo||0), 0));
    if (tsEl) tsEl.textContent = _n2(items.reduce((s,i) => s + (i.qtySupplier||0), 0));
    if (tkEl) tkEl.textContent = _n2(items.reduce((s,i) => s + (i.totalQty - (i.qtyCikopo||0) - (i.qtySupplier||0)), 0));
    if (tqEl) tqEl.textContent = _n2(items.reduce((s,i) => s + (i.totalQty||0), 0));
    if (tgEl) tgEl.textContent = rp(items.reduce((s,i) => s + ((i.totalQty||0) * (i.harga||0)), 0));
  }

  /* ── Step 4: Breakdown — Cikopo merged, PS.Karawang per-shift ── */
  function _goStep(n) {
    _step = n;
    if (n === 1) _renderFormPicker();
    else if (n === 3) _renderStep3();
    else if (n === 4) { _computeBreakdown(); _renderStep4(); }
  }

  function _computeBreakdown() {
    if (!_doc) return;
    // Cikopo: merge ALL items across all dates/shifts into ONE list
    const cikopoMap = {};
    _doc.items.forEach(it => {
      if ((it.qtyCikopo||0) <= 0) return;
      const key = it.item.toLowerCase().trim();
      if (!cikopoMap[key]) cikopoMap[key] = { item: it.item, qty: 0, satuan: it.satuan, harga: it.harga||0 };
      cikopoMap[key].qty += it.qtyCikopo;
    });
    _doc.cikopo = Object.values(cikopoMap).sort((a,b) => a.item.localeCompare(b.item));

    // Supplier: merge items dengan qtySupplier > 0 (untuk diteruskan ke Anggaran via mini-card)
    const supplierMap = {};
    _doc.items.forEach(it => {
      if ((it.qtySupplier||0) <= 0) return;
      const key = it.item.toLowerCase().trim();
      if (!supplierMap[key]) supplierMap[key] = { item: it.item, qty: 0, satuan: it.satuan, harga: it.harga||0 };
      supplierMap[key].qty += it.qtySupplier;
    });
    _doc.supplier = Object.values(supplierMap).sort((a,b) => a.item.localeCompare(b.item));

    // PS Karawang: per date per shift — proportional from merged items
    const ps = {};
    (_doc.selectedForms||[]).forEach(sf => {
      const f = _forms.find(f => f.id === sf.formId);
      if (!f || !f.items) return;
      const key = sf.tanggal + '_' + sf.shift;
      const karawang = [];
      f.items.forEach(fi => {
        if (!fi.item) return;
        // Sama dengan demand: fallback estQty → aktQty
        const estQ = Number(fi.estQty) || Number(fi.aktQty) || 0;
        if (estQ <= 0) return;
        // Only include items that are in the merged pasar list
        const merged = (_doc.items||[]).find(m => m.item.toLowerCase().trim() === fi.item.toLowerCase().trim());
        if (!merged || !merged.totalQty) return;
        // BUG FIX: derivedKarawang harus kurangi BOTH qtyCikopo + qtySupplier.
        // Sebelumnya cuma kurangi Cikopo → item yang 100% ke Supplier malah
        // ikut dihitung masuk Karawang.
        const derivedKarawang = Math.max(0, merged.totalQty - (merged.qtyCikopo||0) - (merged.qtySupplier||0));
        const ratioK = merged.totalQty > 0 ? derivedKarawang / merged.totalQty : 0;
        const qK = Math.round(estQ * ratioK * 100) / 100;
        if (qK > 0) karawang.push({ item: fi.item, qty: qK, satuan: fi.satuan||merged.satuan||'', harga: merged.harga||Number(fi.hargaSatuan)||0 });
      });
      ps[key] = karawang;
    });
    _doc.perShiftKarawang = ps;
  }

  function _renderStep4() {
    if (!_el || !_doc) return;
    const cikopo = _doc.cikopo || [];
    const ps = _doc.perShiftKarawang || {};
    const dates = _doc.dates || [];
    const cikopoTotal = cikopo.reduce((s,it) => s + it.qty * (it.harga||0), 0);

    let html = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button onclick="POBelanjaPasarModule._goStep(3)" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Pembagian Lokasi</button>
        <span style="font-size:12px;font-weight:700;color:#059669">🛒 ${_doc.periode}</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button onclick="POBelanjaPasarModule._printCikopo()" style="padding:6px 12px;border:1px solid rgba(5,150,105,.4);border-radius:7px;background:rgba(5,150,105,.08);color:#059669;font-size:12px;cursor:pointer;font-weight:600">Print Cikopo</button>
          <button onclick="POBelanjaPasarModule._printKarawang()" style="padding:6px 12px;border:1px solid rgba(99,102,241,.4);border-radius:7px;background:rgba(99,102,241,.08);color:#6366f1;font-size:12px;cursor:pointer;font-weight:600">Print PS. Karawang</button>
        </div>
      </div>

      <!-- CIKOPO: ALL merged -->
      <div style="margin-bottom:16px;border:1px solid rgba(5,150,105,.3);border-radius:10px;overflow:hidden">
        <div style="background:rgba(5,150,105,.08);padding:10px 14px;font-size:13px;font-weight:700;color:#059669;border-bottom:1px solid rgba(5,150,105,.2)">
          PASAR CIKOPO — Gabungan Semua Tanggal & Shift (${cikopo.length} items)
        </div>
        ${cikopo.length ? `<table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--surface2)">
            <th style="padding:6px;font-size:9px;width:25px">#</th>
            <th style="padding:6px;font-size:9px;text-align:left">ITEM</th>
            <th style="padding:6px;font-size:9px;text-align:right;width:60px">QTY</th>
            <th style="padding:6px;font-size:9px;width:50px">SATUAN</th>
            <th style="padding:6px;font-size:9px;text-align:right;width:90px">HARGA</th>
            <th style="padding:6px;font-size:9px;text-align:right;width:100px">TOTAL</th>
          </tr></thead>
          <tbody>${cikopo.map((it,i) => `<tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.012)':''}">
            <td style="padding:8px 6px;text-align:center;color:var(--text-3);font-size:10px">${i+1}</td>
            <td style="padding:8px 6px;font-weight:600">${it.item}</td>
            <td style="padding:8px 6px;text-align:right;font-family:var(--font-mono);font-weight:700">${_n2(it.qty)}</td>
            <td style="padding:8px 6px;color:var(--text-2)">${it.satuan}</td>
            <td style="padding:8px 6px;text-align:right;font-family:var(--font-mono)">${it.harga ? rp(it.harga) : '-'}</td>
            <td style="padding:8px 6px;text-align:right;font-family:var(--font-mono);font-weight:600">${it.harga ? rp(it.qty * it.harga) : '-'}</td>
          </tr>`).join('')}
          <tr style="border-top:2px solid var(--border);background:var(--surface2)"><td colspan="5" style="padding:8px;text-align:right;font-weight:700">Total Cikopo</td>
            <td style="padding:8px 6px;text-align:right;font-family:var(--font-mono);font-weight:700;color:#059669">${rp(cikopoTotal)}</td></tr>
          </tbody></table>` : '<div style="padding:16px;text-align:center;color:var(--text-3)">Tidak ada item Cikopo</div>'}
      </div>

      <!-- PS KARAWANG: per date per shift -->
      <div style="font-size:13px;font-weight:700;color:#6366f1;margin-bottom:8px">PS. KARAWANG — Per Tanggal & Shift</div>`;

    dates.forEach(d => {
      const label = _doc.dayLabels?.[d] || '';
      ['S1','S2'].forEach(shift => {
        const key = d + '_' + shift;
        const items = ps[key];
        if (!items || !items.length) return;
        const shiftLabel = shift === 'S1' ? 'Shift 1' : 'Shift 2&3';
        const shiftTotal = items.reduce((s,it) => s + it.qty * (it.harga||0), 0);
        html += `
          <div style="margin-bottom:10px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
            <div style="background:rgba(99,102,241,.06);padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:10px;font-weight:800;color:#fff;background:#6366f1;padding:2px 8px;border-radius:4px">${label}</span>
                <span style="font-size:12px;font-weight:600">${_fmtFull(d)} — ${shiftLabel}</span>
              </div>
              <span style="font-size:11px;font-weight:700;color:#6366f1">${rp(shiftTotal)}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <tbody>${items.map((it,i) => `<tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.012)':''}">
                <td style="padding:6px">${i+1}</td>
                <td style="padding:6px;font-weight:600">${it.item}</td>
                <td style="padding:6px;text-align:right;font-family:var(--font-mono);font-weight:600">${_n2(it.qty)}</td>
                <td style="padding:6px;color:var(--text-3)">${it.satuan}</td>
                <td style="padding:6px;text-align:right;font-family:var(--font-mono)">${it.harga ? rp(it.harga) : '-'}</td>
                <td style="padding:6px;text-align:right;font-family:var(--font-mono);font-weight:600">${it.harga ? rp(it.qty * it.harga) : '-'}</td>
              </tr>`).join('')}</tbody>
            </table>
          </div>`;
      });
    });
    _el.innerHTML = html;
  }

  /* ── Print Cikopo (merged) ─────────────────── */
  function _printCikopo() {
    if (!_doc) return;
    const items = _doc.cikopo || [];
    const total = items.reduce((s,it) => s + it.qty * (it.harga||0), 0);
    const rpP = n => n ? Math.round(Number(n)).toLocaleString('id')+',-' : '';
    const rows = items.map((it,i) => `<tr style="border-bottom:1px solid #eee;${i%2?'background:#f9f9f9':''}">
      <td style="padding:4px 6px;font-size:10px;text-align:center">${i+1}</td>
      <td style="padding:4px 6px;font-size:10px;font-weight:600">${it.item}</td>
      <td style="padding:4px 6px;font-size:10px;text-align:right;font-weight:600">${_n2(it.qty)}</td>
      <td style="padding:4px 6px;font-size:10px">${it.satuan}</td>
      <td style="padding:4px 6px;font-size:10px;text-align:right">${it.harga?rpP(it.harga):''}</td>
      <td style="padding:4px 6px;font-size:10px;text-align:right;font-weight:600">${it.harga?rpP(it.qty*it.harga):''}</td>
    </tr>`).join('');
    _openPrint('PASAR CIKOPO', '#059669', `
      <div style="font-size:10px;color:#666;margin-bottom:8px">Gabungan semua tanggal & shift | Periode: ${_doc.periode}</div>
      <table><thead><tr style="background:#059669;color:#fff">
        <th style="padding:5px;font-size:9px;width:25px">NO</th><th style="padding:5px;font-size:9px;text-align:left">ITEM</th>
        <th style="padding:5px;font-size:9px;text-align:right;width:50px">QTY</th><th style="padding:5px;font-size:9px;width:45px">SAT</th>
        <th style="padding:5px;font-size:9px;text-align:right;width:80px">HARGA</th><th style="padding:5px;font-size:9px;text-align:right;width:90px">TOTAL</th>
      </tr></thead><tbody>${rows}
        <tr style="border-top:2px solid #ddd;font-weight:700"><td colspan="5" style="padding:6px;text-align:right;color:#059669">TOTAL</td>
          <td style="padding:6px;text-align:right;font-size:12px;color:#059669">${rpP(total)}</td></tr>
      </tbody></table>`);
  }

  /* ── Print PS. Karawang (per-shift) ────────── */
  function _printKarawang() {
    if (!_doc) return;
    const ps = _doc.perShiftKarawang || {};
    const dates = _doc.dates || [];
    const rpP = n => n ? Math.round(Number(n)).toLocaleString('id')+',-' : '';
    let tables = '';
    dates.forEach(d => {
      const label = _doc.dayLabels?.[d] || '';
      ['S1','S2'].forEach(shift => {
        const key = d + '_' + shift;
        const items = ps[key];
        if (!items || !items.length) return;
        const shiftLabel = shift === 'S1' ? 'Shift 1' : 'Shift 2&3';
        const shiftTotal = items.reduce((s,it) => s + it.qty * (it.harga||0), 0);
        tables += `<div style="margin-bottom:14px;page-break-inside:avoid">
          <div style="font-size:12px;font-weight:700;color:#4f46e5;margin-bottom:4px">${label} — ${_fmtFull(d)} — ${shiftLabel}
            <span style="float:right;font-size:10px">${rpP(shiftTotal)}</span></div>
          <table><thead><tr style="background:#4f46e5;color:#fff">
            <th style="padding:5px;font-size:9px;width:25px">NO</th><th style="padding:5px;font-size:9px;text-align:left">ITEM</th>
            <th style="padding:5px;font-size:9px;text-align:right;width:50px">QTY</th><th style="padding:5px;font-size:9px;width:45px">SAT</th>
            <th style="padding:5px;font-size:9px;text-align:right;width:80px">HARGA</th><th style="padding:5px;font-size:9px;text-align:right;width:90px">TOTAL</th>
          </tr></thead><tbody>${items.map((it,i) => `<tr style="border-bottom:1px solid #eee;${i%2?'background:#f9f9f9':''}">
            <td style="padding:4px 6px;font-size:10px;text-align:center">${i+1}</td>
            <td style="padding:4px 6px;font-size:10px;font-weight:600">${it.item}</td>
            <td style="padding:4px 6px;font-size:10px;text-align:right;font-weight:600">${_n2(it.qty)}</td>
            <td style="padding:4px 6px;font-size:10px">${it.satuan}</td>
            <td style="padding:4px 6px;font-size:10px;text-align:right">${it.harga?rpP(it.harga):''}</td>
            <td style="padding:4px 6px;font-size:10px;text-align:right;font-weight:600">${it.harga?rpP(it.qty*it.harga):''}</td>
          </tr>`).join('')}</tbody></table></div>`;
      });
    });
    _openPrint('PS. KARAWANG', '#4f46e5', `<div style="font-size:10px;color:#666;margin-bottom:8px">Per tanggal & shift | Periode: ${_doc.periode}</div>${tables}`);
  }

  function _openPrint(title, color, body) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:16px}
    @page{size:A4 portrait;margin:10mm}@media print{.no-print{display:none!important}}table{width:100%;border-collapse:collapse}</style></head><body>
    <button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 20px;background:${color};color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;z-index:99">Print</button>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:${color};background:${color}11;display:inline-block;padding:2px 8px;border-radius:3px">BPS</div>
      <div style="font-size:20px;font-weight:900;margin-top:4px">FORM BELANJA PASAR — ${title}</div>
      <div style="font-size:10px;color:#666;margin-top:2px">Petugas: ${_doc.namaPetugas||'-'}</div>
    </div>${body}</body></html>`;
    const w = window.open('','_blank','width=800,height=900');
    if (w) { w.document.write(html); w.document.close(); }
  }

  /* ── Save / Delete / Status ────────────────── */
  async function _saveDoc() {
    if (!_doc) return;
    _doc.updatedAt = new Date().toISOString();
    _computeBreakdown();
    try {
      await DB.saveBelanjaPasar(_doc);
      if (!_data.find(d => d.id === _doc.id)) _data.unshift(_doc);
      Notify.success('Form belanja pasar disimpan');
    } catch(e) { Notify.error('Gagal menyimpan'); }
  }

  // Auto-save: called when user leaves PO page or switches tab
  let _autoSaving = false;
  function autoSave() {
    if (_autoSaving || !_doc || _doc.status === 'selesai' || _step < 3) return;
    _autoSaving = true;
    _doc.updatedAt = new Date().toISOString();
    _computeBreakdown();
    DB.saveBelanjaPasar(_doc)
      .then(() => { if (!_data.find(d => d.id === _doc.id)) _data.unshift(_doc); })
      .catch(() => {})
      .finally(() => { _autoSaving = false; });
  }

  async function _deleteDoc() {
    if (!_doc) return;
    const ok = await Modal.confirm({title:'Hapus Form Belanja Pasar',message:'Data ini akan dihapus permanen.',danger:true,confirmText:'Hapus'});
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

  function backToList() { autoSave(); _renderList(); }

  /* ── Helpers ───────────────────────────────── */
  function _fmtFull(d) {
    if (!d) return '-';
    return new Date(d + 'T00:00:00').toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function _dayName(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('id', { weekday: 'long' });
  }
  function _n2(n) { const v = Number(n)||0; return v === Math.floor(v) ? String(v) : v.toFixed(1); }

  return { init, newDoc, openDoc, backToList, autoSave,
    _onDateToggle, _toggleAll, _updateCount, _onPickDone,
    _onCikopoChange, _onCikopoKey, _onSupplierChange, _onSupplierKey, _onBeliQtyChange,
    _goStep, _printCikopo, _printKarawang, _saveDoc, _deleteDoc, _selesaikan, _reopen };
})();
