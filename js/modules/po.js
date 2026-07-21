/* ============================================
   BECCA V2.0 — Purchase Order / Anggaran Belanja Module
   Chain: sisa anggaran N → sisaPeriode anggaran N+1
   View/edit rows, GridSelect drag-copy, Rp formatting
============================================ */
if (typeof window.POModule !== 'undefined') { console.warn('[PO] Already loaded'); }
else { window.POModule = (() => {
  let _data = [];
  let _editState = null; // { docId, idx }

  const rp  = n => n ? 'Rp '+Math.round(Number(n)).toLocaleString('id') : '';
  const rpA = n => 'Rp '+Math.round(Number(n)||0).toLocaleString('id');
  const _COL = ['','namaBarang','qty','satuan','keterangan','harga','totalHarga','alokasiDanaReal'];

  function _isFinance() {
    const role = Auth.currentUser()?.role;
    return role === 'superadmin' || role === 'finance';
  }

  /* ── Chain helpers ─────────────────────────── */
  function _sortedChain() {
    return [..._data].sort((a,b) => (a.createdAt||'').localeCompare(b.createdAt||''));
  }
  function _getChainSisa(docId) {
    const sorted = _sortedChain();
    if (!sorted.length) return null;
    const idx = sorted.findIndex(d => d.id === docId);
    if (idx <= 0) return null;
    // Use SISA Real from previous anggaran if available (more accurate than estimasi)
    const prev = sorted[idx - 1];
    const itemsTotalPrev = (prev.items||[]).reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
    const alokasiTotal = (prev.items||[]).reduce((s,it) => s + (Number(it.alokasiDanaReal)||0), 0);
    // If real alokasi exists, gunakan formula baru: sisa = kebutuhan - alokasi
    if (alokasiTotal > 0) {
      return itemsTotalPrev - alokasiTotal;
    }
    // Fallback: estimasi chain
    let carry = Number(sorted[0].sisaPeriode) || 0;
    for (let i = 0; i < idx; i++) {
      const d = sorted[i];
      const itemsTotal = (d.items||[]).reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
      const totalDana = carry + (Number(d.cash)||0) + (Number(d.atm)||0);
      carry = totalDana - itemsTotal;
    }
    return carry;
  }
  function _getSisaPeriode(doc) {
    const chain = _getChainSisa(doc.id);
    return chain !== null ? chain : (Number(doc.sisaPeriode)||0);
  }

  /* ── Init ──────────────────────────────────── */
  async function init() {
    const page = document.getElementById('page-po');
    if (!page) return;
    try { _data = await DB.getPO(); } catch(e) {
      try { _data = JSON.parse(localStorage.getItem('becca_po_anggaran')||'[]'); } catch { _data = []; }
    }
    _data.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    _render(page);
    _updateBadge();
  }

  /* ── Main render ───────────────────────────── */
  function _render(page) {
    _editState = null;
    if (!page) page = document.getElementById('page-po');
    if (!page) return;
    const canEdit = Auth.can('po','edit');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Purchase Order</h2>
          <p>Estimasi Anggaran Belanja Mingguan</p>
        </div>
        <div class="page-header-right" style="display:flex;gap:8px;align-items:center">
          <button title="Lihat aktivitas terbaru" onclick="Utils.openActivityDrawer('po')" style="padding:7px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text-2);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Aktivitas
          </button>
          ${canEdit ? `<button class="btn btn-primary" onclick="POModule.addAnggaran()">+ Buat Anggaran</button>` : ''}
        </div>
      </div>
      <div class="tabs" style="margin-bottom:var(--s4)">
        <button class="tab-btn active" onclick="POModule.switchTab('belanja-pasar')">Belanja Pasar</button>
        <button class="tab-btn" onclick="POModule.switchTab('active')">Anggaran</button>
        <button class="tab-btn" onclick="POModule.switchTab('arsip')">Arsip</button>
      </div>
      <div id="po-content"></div>`;
    // Default landing tab: Belanja Pasar (paling sering dipakai operator harian)
    _loadBelanjaPasar();
  }

  function switchTab(tab) {
    // Auto-save belanja pasar when switching away
    if (typeof POBelanjaPasarModule !== 'undefined') POBelanjaPasarModule.autoSave?.();
    document.querySelectorAll('.tabs .tab-btn').forEach((b,i) => {
      b.classList.toggle('active', (i===0&&tab==='belanja-pasar')||(i===1&&tab==='active')||(i===2&&tab==='arsip'));
    });
    if (tab === 'belanja-pasar') { _loadBelanjaPasar(); return; }
    _renderList(tab);
  }

  async function _loadBelanjaPasar() {
    const el = document.getElementById('po-content');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-3)">Memuat...</div>';
    await new Promise((resolve, reject) => {
      const base = 'js/modules/po-belanja-pasar.js';
      const ver = '?v=20260720a';
      // Remove old script tag if exists (force reload fresh version)
      const old = document.querySelector(`script[src^="${base}"]`);
      if (old) old.remove();
      const s = document.createElement('script');
      s.src = base + ver;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    if (typeof POBelanjaPasarModule !== 'undefined') POBelanjaPasarModule.init(el);
  }

  async function _renderRequestCards() {
    const wrap = document.getElementById('po-req-cards');
    if (!wrap) return;
    const role = Auth.currentUser()?.role;
    const canApprove = role === 'superadmin' || role === 'admin' || role === 'purchaser';
    if (!canApprove) { wrap.innerHTML = ''; return; }
    let logs = [];
    try { logs = await DB.getInventory(); } catch {}
    const reqs = (logs || []).filter(l => l.jenis === 'REQUEST' && (l.reqStatus || 'pending') === 'pending');
    if (!reqs.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700;color:var(--text)">📬 Request Barang</span>
        <span style="font-size:11px;background:rgba(99,102,241,.12);color:#6366f1;padding:2px 8px;border-radius:10px;font-weight:700">${reqs.length} pending</span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${reqs.map(r => `
          <div style="background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(99,102,241,.04));border:1px solid rgba(99,102,241,.3);border-radius:10px;padding:10px 14px;min-width:200px;max-width:240px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <span style="font-size:9px;font-weight:700;color:#6366f1;background:rgba(99,102,241,.12);padding:1px 6px;border-radius:8px;letter-spacing:.04em">REQUEST</span>
              <span style="font-size:10px;color:var(--text-3)">${r.tgl||'-'}</span>
            </div>
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">${Utils.esc(r.itemNama||'-')}</div>
            <div style="font-size:12px;color:var(--text-2);margin-bottom:4px">${r.jumlah||0} ${r.kodeAktivitas||''}</div>
            <div style="font-size:11px;color:var(--text-3);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.esc(r.catatan||'')}${r.catatan&&r.pengambil?' · ':''}${Utils.esc(r.pengambil||'-')}</div>
            <button onclick="POModule._approveRequestModal('${r.id}')"
              style="width:100%;padding:5px;border:1px solid rgba(99,102,241,.5);border-radius:7px;background:rgba(99,102,241,.08);color:#6366f1;font-size:11px;font-weight:700;cursor:pointer;transition:background .15s"
              onmouseover="this.style.background='rgba(99,102,241,.18)'" onmouseout="this.style.background='rgba(99,102,241,.08)'">
              ✓ Setujui → Belanja Pasar
            </button>
            <button onclick="POModule._rejectRequestModal('${r.id}')"
              style="width:100%;padding:5px;border:1px solid rgba(239,68,68,.3);border-radius:7px;background:rgba(239,68,68,.05);color:#ef4444;font-size:11px;font-weight:600;cursor:pointer;margin-top:5px;transition:background .15s"
              onmouseover="this.style.background='rgba(239,68,68,.12)'" onmouseout="this.style.background='rgba(239,68,68,.05)'">
              ✕ Tolak
            </button>
          </div>`).join('')}
      </div>`;
  }

  async function _approveRequestModal(reqId) {
    let logs = [];
    try { logs = await DB.getInventory(); } catch {}
    const req = (logs || []).find(l => l.id === reqId);
    if (!req) { Notify.warning('Request tidak ditemukan'); return; }
    let bpDocs = [];
    try { bpDocs = await DB.getBelanjaPasar(); } catch {}
    const targets = (bpDocs || [])
      .filter(d => d.kasStatus !== 'confirmed' && d.status !== 'selesai')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const mid = 'req-approve-' + Utils.uid();
    window._reqApproveMid = mid;
    Modal.open({
      id: mid,
      title: '✓ Setujui Request ke Belanja Pasar',
      size: 'modal-sm',
      body: `
        <div style="margin-bottom:12px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2);border-radius:8px;padding:10px 12px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${Utils.esc(req.itemNama || '-')}</div>
          <div style="font-size:12px;color:var(--text-2);margin-top:2px">${req.jumlah || 0} ${req.kodeAktivitas || ''} · oleh ${Utils.esc(req.pengambil || '-')}</div>
          ${req.catatan ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${Utils.esc(req.catatan)}</div>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Tambahkan ke Belanja Pasar <span class="req">*</span></label>
          <select id="req-bp-target" class="form-control">
            <option value="__new__" style="font-weight:700;color:var(--primary)">+ Buat Belanja Pasar Baru</option>
            ${targets.map(t => `<option value="${t.id}">${t.periode || '-'} (${(t.items || []).filter(i => i.item).length} item)</option>`).join('')}
          </select>
        </div>
        <div style="font-size:11px;color:var(--text-3);margin-top:4px">Qty akan masuk ke kolom <strong>Supplier</strong> secara otomatis.</div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close(window._reqApproveMid)">Batal</button>
        <button class="btn btn-primary" onclick="POModule._approveRequestDo('${reqId}')">Tambahkan ke Belanja Pasar</button>`,
    });
  }

  async function _approveRequestDo(reqId) {
    const targetId = document.getElementById('req-bp-target')?.value;
    if (!targetId) { Notify.error('Pilih Belanja Pasar terlebih dahulu'); return; }
    let logs = [];
    try { logs = await DB.getInventory(); } catch {}
    const req = (logs || []).find(l => l.id === reqId);
    if (!req) { Notify.error('Request tidak ditemukan'); return; }
    const jumlah = Number(req.jumlah) || 0;
    const newItem = {
      item: req.itemNama || '',
      totalQty: jumlah,
      qtySupplier: jumlah,
      qtyCikopo: 0,
      qtyKarawang: 0,
      harga: 0,
      satuan: req.kodeAktivitas || '',
      sumber: 'REQUEST',
      fromRequest: true,
      reqId: req.id,
      stokGudang: 0,
      totalDemand: 0,
    };
    let bp;
    if (targetId === '__new__') {
      const cu = Auth.currentUser();
      const today = new Date().toISOString().slice(0, 10);
      bp = {
        id: Utils.uid(),
        periode: today,
        dates: [today],
        dayLabels: {},
        selectedForms: [],
        items: [],
        cikopo: [],
        perShiftKarawang: {},
        status: 'draft',
        namaPetugas: cu?.nama || cu?.username || '',
        createdAt: new Date().toISOString(),
      };
    } else {
      let bpDocs = [];
      try { bpDocs = await DB.getBelanjaPasar(); } catch {}
      bp = (bpDocs || []).find(d => d.id === targetId);
      if (!bp) { Notify.error('Belanja Pasar tidak ditemukan'); return; }
    }
    bp.items = bp.items || [];
    bp.items.push(newItem);
    try {
      await DB.saveBelanjaPasar(bp);
      req.reqStatus = 'fulfilled';
      req.penanggungJawab = Auth.currentUser()?.nama || Auth.currentUser()?.username || '';
      await DB.saveInventoryLog(req);
      Modal.close(window._reqApproveMid);
      Notify.success(`${Utils.esc(req.itemNama)} ditambahkan ke Belanja Pasar (kolom Supplier)`);
      _renderRequestCards();
      DB.logActivity?.({ type: 'approve_request', detail: `Approve request: ${req.itemNama} ${jumlah} ${req.kodeAktivitas || ''} → BP ${bp.periode || ''}`, rowId: req.id });
    } catch(e) { Notify.error('Gagal: ' + e.message); }
  }

  async function _rejectRequestModal(reqId) {
    let logs = [];
    try { logs = await DB.getInventory(); } catch {}
    const req = (logs || []).find(l => l.id === reqId);
    if (!req) { Notify.warning('Request tidak ditemukan'); return; }
    const mid = 'req-reject-' + Utils.uid();
    window._reqRejectMid = mid;
    Modal.open({
      id: mid,
      title: '✕ Tolak Request Barang',
      size: 'modal-sm',
      body: `
        <div style="margin-bottom:12px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:10px 12px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${Utils.esc(req.itemNama || '-')}</div>
          <div style="font-size:12px;color:var(--text-2);margin-top:2px">${req.jumlah || 0} ${req.kodeAktivitas || ''} · oleh ${Utils.esc(req.pengambil || '-')}</div>
          ${req.catatan ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${Utils.esc(req.catatan)}</div>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Alasan penolakan <span style="color:var(--danger)">*</span></label>
          <textarea id="req-reject-alasan" class="form-control" rows="3" placeholder="Tulis alasan penolakan..." style="resize:vertical"></textarea>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close(window._reqRejectMid)">Batal</button>
        <button class="btn btn-danger" onclick="POModule._rejectRequestDo('${reqId}')" style="background:#ef4444;border-color:#ef4444;color:#fff">Tolak Request</button>`,
    });
    setTimeout(() => document.getElementById('req-reject-alasan')?.focus(), 100);
  }

  async function _rejectRequestDo(reqId) {
    const alasan = document.getElementById('req-reject-alasan')?.value?.trim();
    if (!alasan) { Notify.warning('Isi alasan penolakan terlebih dahulu'); return; }
    let logs = [];
    try { logs = await DB.getInventory(); } catch {}
    const req = (logs || []).find(l => l.id === reqId);
    if (!req) { Notify.error('Request tidak ditemukan'); return; }
    try {
      req.reqStatus = 'rejected';
      req.reqRejectAlasan = alasan;
      req.rejectedBy = Auth.currentUser()?.nama || Auth.currentUser()?.username || '';
      req.rejectedAt = new Date().toISOString();
      await DB.saveInventoryLog(req);
      Modal.close(window._reqRejectMid);
      Notify.success(`Request ${Utils.esc(req.itemNama)} ditolak`);
      _renderRequestCards();
      DB.logActivity?.({ type: 'reject_request', detail: `Tolak request: ${req.itemNama} — ${alasan}`, rowId: req.id });
    } catch(e) { Notify.error('Gagal: ' + e.message); }
  }

  /* ── Card list ─────────────────────────────── */
  function _renderList(tab) {
    const el = document.getElementById('po-content');
    if (!el) return;
    const sorted = _sortedChain();
    // Display newest-first; chainIdx tetap berdasarkan urutan kronologis (oldest=#1)
    const list = sorted.filter(d => tab==='arsip' ? d.status==='arsip' : d.status!=='arsip').slice().reverse();
    // Supplier cards container — di-populate async setelah fetch BP docs
    const supplierCardsHtml = tab === 'active' ? `<div id="po-supplier-cards" style="margin-bottom:14px"></div>` : '';
    if (!list.length) {
      el.innerHTML = `${supplierCardsHtml}<div style="text-align:center;padding:48px;color:var(--text-3)"><div style="font-size:32px;margin-bottom:8px">📋</div>${tab==='arsip'?'Belum ada arsip':'Belum ada anggaran'}</div>`;
      if (tab === 'active') _renderSupplierCards();
      return;
    }
    el.innerHTML = supplierCardsHtml + `<div style="display:grid;gap:10px">
      ${list.map(d => {
        const chainIdx = sorted.findIndex(s => s.id === d.id);
        const kebutuhan = (d.items||[]).reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
        const alokasiTotal = (d.items||[]).reduce((s,it) => s + (Number(it.alokasiDanaReal)||0), 0);
        const cashReal = Number(d.cashReal)||0, atmReal = Number(d.atmReal)||0;
        const totalDanaReal = cashReal + atmReal;
        const sisaReal = kebutuhan - alokasiTotal;
        const selisih = sisaReal - totalDanaReal;
        const hasReal = alokasiTotal > 0 || totalDanaReal > 0;
        const sisaPrev = _getSisaPeriode(d);
        const requestDana = kebutuhan - sisaPrev;
        const isConfirmed = d.confirmedBy;
        const isSelesai = d.status === 'selesai';
        const cardBg = isSelesai ? 'rgba(100,116,139,.08)' : isConfirmed ? 'rgba(16,185,129,.08)' : d.status==='arsip' ? 'rgba(100,116,139,.04)' : '';
        const cardBorder = isSelesai ? 'rgba(100,116,139,.25)' : isConfirmed ? 'rgba(16,185,129,.3)' : 'var(--border)';
        return `<div id="po-row-${d.id}" style="background:var(--surface);border:1px solid ${cardBorder};border-radius:10px;padding:12px 16px;cursor:pointer;transition:.15s;position:relative;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);${cardBg?'background:'+cardBg:''}"
          onclick="POModule.openAnggaran('${d.id}')"
          onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
          ${isSelesai ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:32px;font-weight:900;color:rgba(100,116,139,.12);pointer-events:none;white-space:nowrap;letter-spacing:6px;font-style:italic">SELESAI</div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;position:relative;z-index:1">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:10px;font-weight:800;color:#fff;background:${isSelesai?'#64748b':'#dc2626'};padding:1px 6px;border-radius:4px;font-family:var(--font-mono)">#${chainIdx+1}</span>
              <span style="font-size:12px;font-weight:700;color:${isSelesai?'#64748b':'#dc2626'};font-family:var(--font-mono)">${d.nomorEstimasi||''}</span>
              <span style="font-size:11px;color:var(--text-3)">${d.periode||'-'}</span>
              ${isSelesai ? '<span style="font-size:9px;background:rgba(100,116,139,.15);color:#64748b;padding:1px 6px;border-radius:10px;font-weight:700">Selesai</span>' : ''}
              ${isConfirmed?'<span style="font-size:9px;background:rgba(16,185,129,.12);color:#10b981;padding:1px 6px;border-radius:10px;font-weight:700">✓ Confirmed</span>':''}
              ${!isConfirmed && d.pendingFinance ? '<span style="font-size:9px;background:rgba(245,158,11,.12);color:#f59e0b;padding:1px 6px;border-radius:10px;font-weight:700">⏳ Pending Finance</span>' : ''}
              ${d.status==='arsip'?'<span style="font-size:9px;background:rgba(100,116,139,.1);color:var(--text-3);padding:1px 6px;border-radius:10px;font-weight:600">Arsip</span>':''}
            </div>
            <span style="font-size:11px;color:var(--text-3)">Oleh: ${d.namaPetugas||'-'}</span>
          </div>
          <div style="display:flex;gap:14px;font-size:12px;color:var(--text-2);flex-wrap:wrap;position:relative;z-index:1">
            <span>Kebutuhan: <strong style="color:var(--text)">${rp(kebutuhan)||'-'}</strong></span>
            ${sisaPrev ? `<span>Sisa Prev: <strong style="color:#10b981">${rp(sisaPrev)}</strong></span>` : ''}
            ${requestDana > 0 ? `<span>Request: <strong style="color:#6366f1">${rp(requestDana)}</strong></span>` : ''}
            ${hasReal ? `<span>Sisa: <strong style="color:${sisaReal>=0?'#10b981':'#ef4444'}">${(sisaReal<0?'- ':'')+rp(Math.abs(sisaReal))}</strong></span>` : ''}
            ${hasReal ? `<span>Selisih: <strong style="color:${selisih===0?'#10b981':selisih>0?'#f59e0b':'#ef4444'}">${selisih===0?'Rp 0 ✓':(selisih>0?'+':'-')+rp(Math.abs(selisih))}</strong></span>` : ''}
            <span>Items: <strong>${(d.items||[]).filter(it=>it.namaBarang).length}</strong></span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
    if (tab === 'active') _renderSupplierCards();
  }

  /* ─── SUPPLIER MINI-CARDS — items dari Belanja Pasar yg dialokasikan ke Supplier ─── */
  async function _renderSupplierCards() {
    const wrap = document.getElementById('po-supplier-cards');
    if (!wrap) return;
    let bpDocs = [];
    try { bpDocs = await DB.getBelanjaPasar(); } catch { bpDocs = []; }
    // Cari BP docs dengan items yg punya qtySupplier > 0 dan belum di-import
    const cards = (bpDocs || []).map(bp => {
      const supplierItems = (bp.items || []).filter(it => (it.qtySupplier || 0) > 0 && !it.supplierImportedTo);
      if (!supplierItems.length) return null;
      const totalQty = supplierItems.reduce((s, it) => s + (it.qtySupplier || 0), 0);
      const totalNilai = supplierItems.reduce((s, it) => s + (it.qtySupplier || 0) * (it.harga || 0), 0);
      return { bp, supplierItems, totalQty, totalNilai };
    }).filter(Boolean);

    if (!cards.length) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700;color:var(--text)">📦 Supplier dari Belanja Pasar</span>
        <span style="font-size:11px;color:var(--text-3)">${cards.length} dokumen siap di-import ke Anggaran</span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${cards.map(c => `
          <div onclick="POModule._openSupplierImport('${c.bp.id}')"
               style="cursor:pointer;background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.04));border:1px solid rgba(245,158,11,.35);border-radius:10px;padding:10px 14px;min-width:180px;transition:transform .15s,box-shadow .15s"
               onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(245,158,11,.2)'"
               onmouseout="this.style.transform='';this.style.boxShadow=''">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="font-size:14px">🏷️</span>
              <span style="font-size:11px;font-weight:700;color:#d97706">SUPPLIER</span>
            </div>
            <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">${c.bp.periode || '-'}</div>
            <div style="font-size:11px;color:var(--text-3)">${c.supplierItems.length} item · ${Utils.formatRupiah(c.totalNilai, true)}</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:4px;font-style:italic">Klik untuk import →</div>
          </div>`).join('')}
      </div>`;
  }

  /* ─── MODAL: Import Supplier items ke Anggaran ─── */
  async function _openSupplierImport(bpDocId) {
    let bpDocs = [];
    try { bpDocs = await DB.getBelanjaPasar(); } catch {}
    const bp = (bpDocs || []).find(d => d.id === bpDocId);
    if (!bp) { Notify.warning('Dokumen Belanja Pasar tidak ditemukan'); return; }
    const items = (bp.items || []).filter(it => (it.qtySupplier || 0) > 0 && !it.supplierImportedTo);
    if (!items.length) { Notify.info('Tidak ada item supplier yang belum di-import'); return; }

    // Pilihan anggaran target — yg masih draft (status≠selesai/arsip)
    const targets = _data.filter(d => d.status !== 'selesai' && d.status !== 'arsip').sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    if (!targets.length) {
      Modal.confirm({
        title: 'Belum Ada Anggaran',
        message: '<p>Belum ada anggaran draft yg bisa di-target. Buat anggaran baru dulu?</p>',
        confirmText: 'Buat Anggaran Baru',
      }).then(ok => { if (ok) addAnggaran(); });
      return;
    }

    const mid = 'sup-imp-' + Utils.uid();
    window._supImpMid = mid;
    Modal.open({
      id: mid,
      title: '📦 Import Supplier ke Anggaran',
      size: 'modal-md',
      body: `
        <div style="margin-bottom:10px;font-size:11px;color:var(--text-3)">
          Belanja Pasar: <strong style="color:var(--text)">${bp.periode || '-'}</strong> · ${items.length} item supplier
        </div>
        <div class="form-group">
          <label class="form-label">Pilih Anggaran Tujuan</label>
          <select id="sup-imp-target" class="form-control">
            ${targets.map(t => `<option value="${t.id}">#${(t.nomorEstimasi||'?')} · ${t.periode||'-'} (${(t.items||[]).filter(i=>i.namaBarang).length} item)</option>`).join('')}
          </select>
        </div>
        <div style="margin:12px 0 6px;display:flex;align-items:center;gap:8px">
          <label style="font-size:12px;font-weight:600">Item yg di-import:</label>
          <button type="button" onclick="POModule._supImpToggleAll(true)" style="margin-left:auto;font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);cursor:pointer">Pilih Semua</button>
          <button type="button" onclick="POModule._supImpToggleAll(false)" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:5px;background:var(--surface2);cursor:pointer">Reset</button>
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;max-height:320px;overflow-y:auto">
          ${items.map((it, i) => {
            const total = (it.qtySupplier || 0) * (it.harga || 0);
            return `<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px;${i%2?'background:rgba(0,0,0,.012)':''}">
              <input type="checkbox" class="sup-imp-chk" data-idx="${i}" data-key="${(it.item||'').toLowerCase().trim()}" checked
                style="width:16px;height:16px;accent-color:#f59e0b;cursor:pointer">
              <span style="flex:1;font-weight:500">${it.item}</span>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-3);min-width:80px;text-align:right">${it.qtySupplier} ${it.satuan || ''}</span>
              <span style="font-family:var(--font-mono);font-size:11px;font-weight:600;color:#d97706;min-width:90px;text-align:right">${Utils.formatRupiah(total, true)}</span>
            </label>`;
          }).join('')}
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close(window._supImpMid)">Batal</button>
        <button class="btn btn-primary" onclick="POModule._supImpConfirm('${bpDocId}')" style="background:#f59e0b;border-color:#f59e0b">+ Import ke Anggaran</button>`,
    });
  }

  function _supImpToggleAll(checked) {
    document.querySelectorAll('.sup-imp-chk').forEach(c => { c.checked = checked; });
  }

  async function _supImpConfirm(bpDocId) {
    const targetId = document.getElementById('sup-imp-target')?.value;
    const target = _data.find(d => d.id === targetId);
    if (!target) { Notify.error('Anggaran tujuan tidak valid'); return; }
    const checked = Array.from(document.querySelectorAll('.sup-imp-chk:checked')).map(c => c.dataset.key);
    if (!checked.length) { Notify.warning('Pilih minimal 1 item'); return; }

    let bpDocs = [];
    try { bpDocs = await DB.getBelanjaPasar(); } catch {}
    const bp = (bpDocs || []).find(d => d.id === bpDocId);
    if (!bp) { Notify.error('Dokumen Belanja Pasar tidak ditemukan'); return; }

    const checkedSet = new Set(checked);
    let added = 0;
    target.items = target.items || [];
    bp.items.forEach(it => {
      const key = (it.item || '').toLowerCase().trim();
      if (!checkedSet.has(key)) return;
      if ((it.qtySupplier || 0) <= 0) return;
      if (it.supplierImportedTo) return;
      const qty   = it.qtySupplier;
      const harga = it.harga || 0;
      target.items.push({
        id: 'item_' + Utils.uid(),
        namaBarang: it.item,
        qty,
        satuan: it.satuan || '',
        keterangan: 'Supplier · BP ' + (bp.periode || ''),
        harga,
        totalHarga: qty * harga,
        alokasiDanaReal: 0,
      });
      it.supplierImportedTo = target.id;
      added++;
    });

    if (!added) { Notify.warning('Tidak ada item yg diimport'); return; }

    target.updatedAt = new Date().toISOString();
    try {
      await DB.savePO(target);
      await DB.saveBelanjaPasar(bp);
      DB.logActivity?.({ type: 'import_supplier_to_po', detail: `${added} item supplier dari BP ${bp.periode||''} → ${target.nomorEstimasi||''}`, rowId: target.id });
      if (window._supImpMid) Modal.close(window._supImpMid);
      Notify.success(`${added} item supplier diimport ke ${target.nomorEstimasi || 'anggaran'}`);
      _renderList('active');
    } catch (e) {
      Notify.error('Gagal import: ' + (e.message || ''));
    }
  }

  /* ── Add new ───────────────────────────────── */
  async function addAnggaran() {
    const today = new Date();
    const cu = typeof Auth!=='undefined' ? Auth.currentUser() : null;
    const doc = {
      id: Utils.uid(),
      nomorEstimasi: 'EAM'+today.getFullYear().toString().slice(-2)+String(today.getMonth()+1).padStart(2,'0')+String(today.getDate()).padStart(2,'0'),
      namaPetugas: cu?.nama || cu?.username || '',
      periode: '', tahun: today.getFullYear(), status: 'draft',
      confirmedBy: null, confirmedAt: null,
      items: Array.from({length:25}, () => ({namaBarang:'',qty:'',satuan:'',keterangan:'',harga:'',totalHarga:0,alokasiDanaReal:''})),
      sisaPeriode: 0, cash: 0, atm: 0,
      createdAt: today.toISOString(),
    };
    try {
      await DB.savePO(doc); _data.unshift(doc); openAnggaran(doc.id);
      DB.logActivity?.({ type: 'add_po', detail: `Anggaran baru: ${doc.nomorEstimasi||doc.id}`, rowId: doc.id });
      setTimeout(() => _startEdit(doc.id, 0), 100);
    } catch(e) { Notify.error('Gagal membuat anggaran'); }
  }

  /* ── Detail view ───────────────────────────── */
  function openAnggaran(id) {
    if (_editState) _commitEdit();
    if (window.UndoRedo) UndoRedo.setActive('po');
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    const el = document.getElementById('po-content');
    if (!el) return;
    const items = doc.items || [];
    const itemsTotal = items.reduce((s,it) => s + (Number(it.totalHarga)||0), 0);

    const sorted = _sortedChain();
    const chainIdx = sorted.findIndex(s => s.id === id);
    const isFirst = chainIdx <= 0;
    const sisaPeriode = _getSisaPeriode(doc);
    const requestDana = itemsTotal - sisaPeriode;
    const totalDana = sisaPeriode + (Number(doc.cash)||0) + (Number(doc.atm)||0);
    const sisaUang = totalDana - itemsTotal;

    const canEdit = Auth.can('po','edit');
    const isArsip = doc.status === 'arsip';
    const isSelesai = doc.status === 'selesai';
    const locked = isArsip || isSelesai;

    el.innerHTML = `
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button onclick="POModule.backToList()" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">← Kembali</button>
        <span style="font-size:10px;font-weight:800;color:#fff;background:${isSelesai?'#64748b':'#dc2626'};padding:2px 8px;border-radius:4px;font-family:var(--font-mono)">Anggaran #${chainIdx+1}</span>
        <button onclick="POModule.printAnggaran('${id}')" style="padding:6px 12px;border:1px solid rgba(99,102,241,.4);border-radius:7px;background:rgba(99,102,241,.08);color:#6366f1;font-size:12px;cursor:pointer;font-weight:600">Print</button>
        <button onclick="POModule.kirimWA('${id}')" style="padding:6px 12px;border:1px solid rgba(37,211,102,.4);border-radius:7px;background:rgba(37,211,102,.08);color:#25d366;font-size:12px;cursor:pointer;font-weight:600">Kirim WA</button>
        ${canEdit && !locked ? `<button onclick="POModule.importBelanjaPasar('${id}')" style="padding:6px 12px;border:1px solid rgba(5,150,105,.4);border-radius:7px;background:rgba(5,150,105,.08);color:#059669;font-size:12px;cursor:pointer;font-weight:600">Import Belanja Pasar</button>` : ''}
        ${canEdit ? `<button onclick="POModule.duplikatAnggaran('${id}')" style="padding:6px 12px;border:1px solid rgba(99,102,241,.3);border-radius:7px;background:var(--surface2);color:var(--text-2);font-size:12px;cursor:pointer">Duplikat</button>` : ''}
        ${canEdit && !locked ? `<button onclick="POModule.selesaikan('${id}')" style="padding:6px 12px;border:1px solid rgba(100,116,139,.4);border-radius:7px;background:rgba(100,116,139,.08);color:#64748b;font-size:12px;cursor:pointer;font-weight:600">Selesaikan</button>` : ''}
        ${canEdit && isSelesai ? `<button onclick="POModule.reopenAnggaran('${id}')" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">Buka Kembali</button>` : ''}
        ${canEdit && !isArsip ? `<button onclick="POModule.arsipkan('${id}')" style="padding:6px 12px;border:1px solid rgba(245,158,11,.4);border-radius:7px;background:rgba(245,158,11,.08);color:#f59e0b;font-size:12px;cursor:pointer;font-weight:600">Arsipkan</button>` : ''}
        ${isArsip ? `<button onclick="POModule.unarsip('${id}')" style="padding:6px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer">Buka dari Arsip</button>` : ''}
        ${canEdit ? `<button onclick="POModule.deleteAnggaran('${id}')" style="padding:6px 12px;border:1px solid rgba(239,68,68,.3);border-radius:7px;background:rgba(239,68,68,.07);color:#ef4444;font-size:12px;cursor:pointer">Hapus</button>` : ''}
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
          ${doc.confirmedBy
            ? `<span style="font-size:11px;background:rgba(16,185,129,.1);color:#10b981;padding:4px 10px;border-radius:20px;font-weight:700">✓ Confirmed by ${doc.confirmedBy}</span>`
            : doc.pendingFinance
              ? `<span style="font-size:11px;background:rgba(245,158,11,.1);color:#f59e0b;padding:4px 10px;border-radius:20px;font-weight:600">⏳ Menunggu konfirmasi finance</span>
                 ${_isFinance() ? `<button onclick="POModule.confirmAnggaran('${id}')" style="padding:6px 14px;border:none;border-radius:7px;background:#10b981;color:#fff;font-size:12px;cursor:pointer;font-weight:700">✓ Konfirmasi</button>` : ''}`
              : _isFinance()
                ? `<button onclick="POModule.confirmAnggaran('${id}')" style="padding:6px 14px;border:none;border-radius:7px;background:#10b981;color:#fff;font-size:12px;cursor:pointer;font-weight:700">✓ Konfirmasi Finance</button>`
                : Auth.can('po','edit')
                  ? `<button onclick="POModule.ajukanFinance('${id}')" style="padding:6px 14px;border:none;border-radius:7px;background:#f59e0b;color:#fff;font-size:12px;cursor:pointer;font-weight:700">📩 Ajukan ke Finance</button>`
                  : '<span style="font-size:11px;color:var(--text-3)">Belum dikonfirmasi</span>'}
        </div>
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
          <div class="form-group"><label class="form-label">Nomor Estimasi / Nama File PDF</label>
            <input class="form-control" id="po-nomor-estimasi-${id}" value="${doc.nomorEstimasi||''}" onchange="POModule._saveMeta('${id}','nomorEstimasi',this.value)" style="font-family:var(--font-mono);font-weight:700" ${locked?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Dibuat oleh</label>
            <input class="form-control" value="${doc.namaPetugas||''}" disabled style="background:var(--surface2)"></div>
          <div class="form-group"><label class="form-label">Tanggal Awal Periode</label>
            <input class="form-control" type="date" value="${doc.periodeAwal||''}" onchange="POModule._saveMeta('${id}','periodeAwal',this.value)" ${locked?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Tanggal Akhir Periode</label>
            <input class="form-control" type="date" value="${doc.periodeAkhir||''}" onchange="POModule._saveMeta('${id}','periodeAkhir',this.value)" ${locked?'disabled':''}></div>
        </div>
      </div>

      <div style="position:relative;overflow:hidden;border:1px solid var(--border);border-radius:10px">
        ${isSelesai ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72px;font-weight:900;color:rgba(100,116,139,.08);pointer-events:none;white-space:nowrap;letter-spacing:12px;text-transform:uppercase;font-style:italic;z-index:2">SELESAI</div>` : ''}
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:800px" id="po-table" data-grid-select data-doc="${id}">
          <thead><tr style="background:var(--thead-bg);color:var(--thead-text)">
            <th style="padding:7px 6px;font-size:9px;font-weight:700;width:28px">#</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:left;min-width:180px">NAMA BARANG</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;width:45px">QTY</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;width:55px">SATUAN</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:left;min-width:110px">KETERANGAN</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:right;width:100px">HARGA (IDR)</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:right;width:110px;background:rgba(0,0,0,.15)">TOTAL HARGA</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:right;min-width:100px;background:rgba(255,255,255,.12)">ALOKASI DANA REAL</th>
          </tr></thead>
          <tbody>${items.map((it,i) => _viewRow(id, it, i, locked)).join('')}</tbody>
          <tfoot>
            ${(() => {
              const alokasiTotal = items.reduce((s,it) => s + (Number(it.alokasiDanaReal)||0), 0);
              const danaDiterima = Number(doc.danaDiterima)||0;
              const cashReal = Number(doc.cashReal)||0;
              const atmReal = Number(doc.atmReal)||0;
              const totalDanaReal = cashReal + atmReal;
              const sisaReal = itemsTotal - alokasiTotal;
              const selisih = sisaReal - totalDanaReal;
              const _fmtInp = v => v ? 'Rp ' + Math.round(Number(v)).toLocaleString('id-ID') : '0';
              const _inp = (field, val) => locked
                ? `<span style="font-family:var(--font-mono);font-size:11px;font-weight:600">${rpA(val)}</span>`
                : `<input type="text" value="${_fmtInp(val)}" inputmode="numeric"
                    onfocus="this.value=String(this.value).replace(/[^0-9-]/g,'')"
                    onblur="var v=parseInt(String(this.value).replace(/[^0-9-]/g,''))||0;this.value=v?'Rp '+v.toLocaleString('id-ID'):'0';POModule._saveMeta('${id}','${field}',v);POModule._updateFooter('${id}')"
                    style="width:120px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)">`;
              const _rBg = 'background:rgba(244,63,94,.05)';
              const _ak = locked ? '' : '<td></td>';
              return `
            <tr style="border-top:2px solid var(--border);background:rgba(220,38,38,.06)">
              <td colspan="6" style="padding:6px;text-align:right;font-size:10px;font-weight:600;color:#dc2626">Total Kebutuhan</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:600;color:#dc2626" id="po-f-kebutuhan">${rpA(itemsTotal)}</td>
              <td style="padding:6px;text-align:right;font-size:10px;font-weight:700;color:#dc2626;${_rBg}"><span style="color:var(--text-3);font-weight:400">Total Alokasi</span> <span id="po-f-alokasi-total" style="font-family:var(--font-mono);font-size:12px">${rpA(alokasiTotal)}</span></td>
              ${_ak}
            </tr>
            <tr style="background:var(--surface2)">
              <td colspan="6" style="padding:6px;text-align:right;font-size:10px;color:var(--text-3)">
                Sisa Periode Sebelumnya
                ${!isFirst ? '<span style="font-size:8px;background:rgba(99,102,241,.1);color:#6366f1;padding:1px 5px;border-radius:3px;margin-left:4px">auto dari #'+chainIdx+'</span>' : ''}
              </td>
              <td style="padding:6px;text-align:right">
                ${isFirst && !locked
                  ? '<input type="number" step="1" value="'+(doc.sisaPeriode||0)+'" onchange="POModule._saveMeta(\''+id+'\',\'sisaPeriode\',+this.value);POModule._updateFooter(\''+id+'\')" style="width:120px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-family:var(--font-mono);font-size:12px;background:var(--surface)">'
                  : '<span id="po-f-sisa-prev" style="font-family:var(--font-mono);font-size:12px;color:#10b981;font-weight:600">'+rpA(sisaPeriode)+'</span>'}
              </td>
              <td style="padding:6px;${_rBg}"></td>
              ${_ak}
            </tr>
            <tr style="background:rgba(99,102,241,.08)">
              <td colspan="6" style="padding:9px;text-align:right;font-size:13px;font-weight:800;color:#6366f1">Request Dana</td>
              <td style="padding:9px;text-align:right;font-family:var(--font-mono);font-size:17px;font-weight:900;color:#6366f1;letter-spacing:.01em" id="po-f-request">${requestDana > 0 ? rpA(requestDana) : 'Rp 0 (surplus '+rp(Math.abs(requestDana))+')'}</td>
              <td style="padding:9px;${_rBg};text-align:right;font-size:10px;color:var(--text-3)">Dana Diterima ${_inp('danaDiterima', danaDiterima)}</td>
              ${_ak}
            </tr>
            <tr style="background:var(--surface2)"><td colspan="6"></td>
              <td></td>
              <td style="padding:4px 6px;${_rBg};text-align:right;font-size:10px;color:var(--text-3)">Cash ${_inp('cashReal', cashReal)}</td>
              ${_ak}</tr>
            <tr style="background:var(--surface2)"><td colspan="6"></td>
              <td></td>
              <td style="padding:4px 6px;${_rBg};text-align:right;font-size:10px;color:var(--text-3)">ATM ${_inp('atmReal', atmReal)}</td>
              ${_ak}</tr>
            <tr style="background:var(--surface2)"><td colspan="6"></td>
              <td></td>
              <td style="padding:4px 6px;${_rBg};text-align:right;font-size:10px;font-weight:600;color:var(--text-3)">Total Cash+ATM <span id="po-f-total-real" style="font-family:var(--font-mono);font-size:11px;font-weight:700">${rpA(totalDanaReal)}</span></td>
              ${_ak}</tr>
            <tr id="po-f-sisa-row"><td colspan="6"></td>
              <td></td>
              <td style="padding:6px;${_rBg};text-align:right;font-size:11px;font-weight:700;color:#7c3aed">SISA (Real)${Utils.helpTip('Sisa anggaran = Total Kebutuhan − Total Alokasi. Positif = belanja lebih murah dari estimasi (untung). Negatif = belanja melebihi anggaran.', 'bottom')} <span id="po-f-sisa-real" style="font-family:var(--font-mono);font-size:13px;color:${sisaReal>=0?'#10b981':'#ef4444'}">${sisaReal<0?'- ':''}${rpA(Math.abs(sisaReal))}</span></td>
              ${_ak}</tr>

            <tr style="${selisih===0?'background:rgba(16,185,129,.08)':selisih>0?'background:rgba(245,158,11,.08)':'background:rgba(239,68,68,.08)'}"><td colspan="6"></td>
              <td></td>
              <td style="padding:6px;text-align:right;font-size:11px;font-weight:700">SELISIH${Utils.helpTip('Cash reconciliation = SISA − (Cash + ATM). Idealnya 0 = pencatatan match dengan kas riil. Tidak nol = ada gap (lupa catat, salah input, atau uang fisik tidak match).', 'bottom')} <span id="po-f-selisih" style="font-family:var(--font-mono);font-size:13px;color:${selisih===0?'#10b981':selisih>0?'#f59e0b':'#ef4444'}">${selisih===0?'Rp 0 ✓':(selisih>0?'+':'-')+rpA(Math.abs(selisih))}</span></td>
              ${_ak}</tr>
            `;
            })()}
          </tfoot>
        </table>
        </div>
      </div>
      ${!locked ? `<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:11px;color:var(--text-3);font-style:italic">Double-click baris untuk edit · Enter simpan & lanjut · Esc batal · Drag handle untuk copy</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="UndoRedo.undo('po')" title="Undo (Ctrl+Z)" style="height:28px;width:28px;min-width:28px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:13px">↩</button>
          <button onclick="UndoRedo.redo('po')" title="Redo (Ctrl+Y)" style="height:28px;width:28px;min-width:28px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:13px">↪</button>
          <button onclick="POModule._addRows('${id}')" style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text-3);font-size:11px;cursor:pointer">+ Tambah 10 Baris</button>
        </div>
      </div>` : ''}

      <div id="po-realisasi-kas" style="margin-top:16px">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.04)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <span style="font-size:14px">💰</span>
            <strong style="font-size:13px;color:var(--text)">Realisasi Kas Kecil</strong>
            <span style="font-size:10px;color:var(--text-3);font-style:italic">— pengeluaran kas yg dikaitkan ke anggaran ini</span>
            <span id="po-realisasi-summary" style="margin-left:auto;font-size:11px;color:var(--text-3)">Memuat...</span>
          </div>
          <div id="po-realisasi-content">
            <div style="text-align:center;padding:20px;color:var(--text-3);font-size:11px">Memuat data kas...</div>
          </div>
        </div>
      </div>`;

    // Register GridSelect callbacks
    if (window.GridSelect) {
      GridSelect.onFill('po-table', _onFill);
      GridSelect.onPaste('po-table', _onPaste);
      if (typeof GridSelect.onClear === 'function') GridSelect.onClear('po-table', _onClear);
    }

    // Load Realisasi Kas async (after main render, non-blocking)
    _loadRealisasiKas(id, itemsTotal);
  }

  /* ── Realisasi Kas: pull kas yg punya anggaranId === docId, render table + variance ── */
  async function _loadRealisasiKas(docId, planTotal) {
    const wrap = document.getElementById('po-realisasi-content');
    const summaryEl = document.getElementById('po-realisasi-summary');
    if (!wrap) return;
    let kasList = [];
    try { kasList = await DB.getKas(); } catch { kasList = []; }
    const linked = (kasList || [])
      .filter(r => r && r.anggaranId === docId)
      .sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));

    const totalRealisasi = linked.reduce((s,r) => s + (Number(r.jumlah)||0), 0);
    const variance = (Number(planTotal)||0) - totalRealisasi;
    const variancePct = planTotal > 0 ? Math.round((totalRealisasi/planTotal) * 100) : 0;
    const varColor = variance > 0 ? '#f59e0b' : variance < 0 ? '#ef4444' : '#10b981';
    const varLabel = variance > 0 ? 'Sisa Anggaran' : variance < 0 ? 'Over Budget' : 'Tepat';

    if (summaryEl) {
      summaryEl.innerHTML = linked.length === 0
        ? `<span style="color:var(--text-3)">Belum ada kas yg dikaitkan</span>`
        : `<span style="color:var(--text-3)">${linked.length} entry · </span><strong style="color:var(--text);font-family:var(--font-mono)">${rp(totalRealisasi)}</strong><span style="color:var(--text-3)"> dari </span><strong style="color:var(--text);font-family:var(--font-mono)">${rp(planTotal||0)}</strong><span style="margin-left:6px;font-size:10px;font-weight:700;background:${varColor}1a;color:${varColor};padding:2px 7px;border-radius:10px">${variancePct}% · ${varLabel}</span>`;
    }

    if (linked.length === 0) {
      wrap.innerHTML = `
        <div style="text-align:center;padding:24px 16px;color:var(--text-3)">
          <div style="font-size:12px;margin-bottom:6px">Belum ada transaksi kas kecil yg dikaitkan ke anggaran ini.</div>
          <div style="font-size:11px;font-style:italic">Buka modul Kas → klik tombol <strong style="color:var(--primary-h)">+ link</strong> di samping nama transaksi → pilih anggaran ini.</div>
        </div>`;
      return;
    }

    const rows = linked.map((r, i) => {
      const date = r.tgl ? r.tgl.split('-').reverse().join('-') : '-';
      const status = r.status === 'DONE' ? '<span style="font-size:9px;background:rgba(16,185,129,.15);color:#10b981;padding:1px 5px;border-radius:3px;font-weight:600">DONE</span>'
        : r.status === 'TBC' ? '<span style="font-size:9px;background:rgba(245,158,11,.15);color:#f59e0b;padding:1px 5px;border-radius:3px;font-weight:600">TBC</span>'
        : '';
      return `<tr style="border-bottom:1px solid var(--border);${i%2?'background:rgba(0,0,0,.012)':''}">
        <td style="padding:7px 8px;font-size:11px;color:var(--text-3);text-align:center">${i+1}</td>
        <td style="padding:7px 8px;font-size:11px;font-family:var(--font-mono);white-space:nowrap">${date}</td>
        <td style="padding:7px 8px;font-size:11px;font-weight:500">${Utils.esc(r.nama||'-')}</td>
        <td style="padding:7px 8px;font-size:11px;color:var(--text-3)">${Utils.esc(r.vendor||'-')}</td>
        <td style="padding:7px 8px;font-size:11px;color:var(--text-3)">${Utils.esc(r.penerima||'-')}</td>
        <td style="padding:7px 8px;text-align:center">${status}</td>
        <td style="padding:7px 8px;text-align:right;font-family:var(--font-mono);font-weight:600;font-size:11px">${rp(r.jumlah||0)}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:640px">
          <thead><tr style="background:var(--thead-bg);color:var(--thead-text)">
            <th style="padding:7px 6px;font-size:9px;font-weight:700;width:28px">#</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:left;width:90px">TGL</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:left">NAMA / KETERANGAN</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:left;width:120px">VENDOR</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:left;width:120px">PENERIMA</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;width:60px">STATUS</th>
            <th style="padding:7px 6px;font-size:9px;font-weight:700;text-align:right;width:110px">JUMLAH</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:var(--surface2);font-weight:700">
              <td colspan="6" style="padding:8px;font-size:11px;text-align:right;color:var(--text-2)">TOTAL REALISASI</td>
              <td style="padding:8px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text)">${rp(totalRealisasi)}</td>
            </tr>
            <tr style="background:${varColor}0d">
              <td colspan="6" style="padding:8px;font-size:11px;text-align:right;color:var(--text-2)">SELISIH (Plan − Realisasi)</td>
              <td style="padding:8px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:700;color:${varColor}">${variance>0?'+':variance<0?'-':''}${rp(Math.abs(variance))} <span style="font-size:9px;font-weight:600">· ${varLabel}</span></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  /* ── View row (display mode, GridSelect works) ── */
  function _viewRow(docId, it, i, locked) {
    const bg = i%2 ? 'background:rgba(0,0,0,.012)' : '';
    const h = Number(it.harga)||0;
    const t = Number(it.totalHarga)||0;
    const a = Number(it.alokasiDanaReal)||0;
    const dbl = locked ? '' : `ondblclick="POModule._startEdit('${docId}',${i},event)"`;
    return `<tr data-idx="${i}" ${dbl} style="border-bottom:1px solid var(--border);${bg};${locked?'':'cursor:pointer'}">
      <td style="padding:12px 6px;text-align:center;color:var(--text-3);font-size:10px">${it.namaBarang?i+1:''}</td>
      <td style="padding:12px 8px;font-size:12px">${it.namaBarang||''}</td>
      <td style="padding:12px 8px;font-size:12px;text-align:right;font-family:var(--font-mono)">${it.qty||''}</td>
      <td style="padding:12px 8px;font-size:12px">${it.satuan||''}</td>
      <td style="padding:12px 8px;font-size:12px;color:var(--text-2)">${it.keterangan||''}</td>
      <td style="padding:12px 8px;font-size:12px;text-align:right;font-family:var(--font-mono)">${h ? rp(h) : ''}</td>
      <td style="padding:12px 8px;text-align:right;font-family:var(--font-mono);font-weight:600;font-size:11px;background:rgba(71,85,105,.07);color:${t?'var(--text)':'var(--text-3)'}">${t ? rp(t) : ''}</td>
      <td style="padding:12px 8px;font-size:12px;text-align:right;font-family:var(--font-mono);background:rgba(244,63,94,.05)">${a ? rp(a) : ''}</td>
      ${locked ? '' : `<td style="padding:4px;text-align:center;white-space:nowrap">
        <button onclick="event.stopPropagation();POModule._copyRow('${docId}',${i})" title="Copy" style="border:none;background:none;cursor:pointer;color:var(--text-3);font-size:11px;padding:2px 4px" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-3)'">📋</button>
        <button onclick="event.stopPropagation();POModule._pasteRow('${docId}',${i})" title="Paste di bawah" style="border:none;background:none;cursor:pointer;color:var(--text-3);font-size:11px;padding:2px 4px" onmouseover="this.style.color='var(--success)'" onmouseout="this.style.color='var(--text-3)'">📥</button>
        <button onclick="event.stopPropagation();POModule._deleteRow('${docId}',${i})" title="Hapus baris" style="border:none;background:none;cursor:pointer;color:var(--text-3);font-size:11px;padding:2px 4px" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-3)'">🗑</button>
      </td>`}
    </tr>`;
  }

  /* ── Edit row (inputs) ─────────────────────── */
  function _editRow(docId, it, i) {
    const bg = i%2 ? 'background:rgba(0,0,0,.012)' : '';
    const esc = v => String(v||'').replace(/"/g,'&quot;');
    const kd = `onkeydown="POModule._onEditKey(event)"`;
    const ist = 'width:100%;border:none;background:rgba(220,38,38,.03);padding:10px 8px;font-size:12px;color:var(--text);outline:none;border-radius:3px';
    const nst = ist+';text-align:right;font-family:var(--font-mono)';
    return `<tr class="po-editing" data-idx="${i}" style="border-bottom:1px solid var(--border);${bg};outline:2px solid rgba(99,102,241,.4);outline-offset:-2px;position:relative;z-index:1">
      <td style="padding:12px 6px;text-align:center;color:var(--text-3);font-size:10px">${it.namaBarang?i+1:''}</td>
      <td style="padding:4px" data-key="namaBarang"><input value="${esc(it.namaBarang)}" ${kd} style="${ist}"></td>
      <td style="padding:4px" data-key="qty"><input type="number" min="0" step="1" value="${it.qty||''}" ${kd} oninput="POModule._liveCalc(this)" style="${nst}" onfocus="this.select()"></td>
      <td style="padding:4px" data-key="satuan"><input value="${esc(it.satuan)}" ${kd} style="${ist}"></td>
      <td style="padding:4px" data-key="keterangan"><input value="${esc(it.keterangan)}" ${kd} style="${ist}"></td>
      <td style="padding:4px" data-key="harga"><input type="number" min="0" step="1" value="${it.harga||''}" ${kd} oninput="POModule._liveCalc(this)" style="${nst}" onfocus="this.select()"></td>
      <td class="po-total-cell" style="padding:12px 8px;text-align:right;font-family:var(--font-mono);font-weight:600;font-size:11px;background:rgba(71,85,105,.07);color:${it.totalHarga?'var(--text)':'var(--text-3)'}">${it.totalHarga ? rp(it.totalHarga) : ''}</td>
      <td style="padding:4px;background:rgba(244,63,94,.05)" data-key="alokasiDanaReal"><input type="number" min="0" step="1" value="${it.alokasiDanaReal||''}" ${kd} style="${nst};background:rgba(244,63,94,.03)" onfocus="this.select()"></td>
    </tr>`;
  }

  /* ── Edit flow ─────────────────────────────── */
  function _startEdit(docId, idx, e) {
    if (_editState) _commitEdit();
    const doc = _data.find(d => d.id === docId);
    if (!doc || !doc.items[idx]) return;
    if (doc.status === 'selesai' || doc.status === 'arsip') return;

    _editState = { docId, idx };
    const tbody = document.querySelector('#po-table tbody');
    if (!tbody) return;
    const tr = tbody.querySelector(`tr[data-idx="${idx}"]`);
    if (!tr) return;

    tr.outerHTML = _editRow(docId, doc.items[idx], idx);

    // Focus the column user clicked
    let focusKey = 'namaBarang';
    if (e && e.target) {
      const td = e.target.closest('td');
      if (td) {
        const colIdx = Array.from(td.parentElement.children).indexOf(td);
        const key = _COL[colIdx];
        if (key && key !== 'totalHarga' && key !== '') focusKey = key;
        if (key === 'totalHarga') focusKey = 'harga';
      }
    }
    const newTr = tbody.querySelector(`tr[data-idx="${idx}"]`);
    const target = newTr?.querySelector(`td[data-key="${focusKey}"] input`) || newTr?.querySelector('input');
    if (target) { target.focus(); target.select(); }

    setTimeout(() => document.addEventListener('click', _handleOutsideClick), 0);
  }

  function _commitEdit() {
    if (!_editState) return;
    const { docId, idx } = _editState;
    document.removeEventListener('click', _handleOutsideClick);
    const doc = _data.find(d => d.id === docId);
    if (!doc || !doc.items[idx]) { _editState = null; return; }

    const tr = document.querySelector('#po-table tbody tr.po-editing');
    if (!tr) { _editState = null; return; }

    const item = doc.items[idx];
    const _before = { ...item };
    tr.querySelectorAll('td[data-key]').forEach(td => {
      const key = td.dataset.key;
      const input = td.querySelector('input');
      if (!input || !key) return;
      if (key === 'qty' || key === 'harga' || key === 'alokasiDanaReal') {
        item[key] = parseFloat(input.value) || 0;
      } else {
        item[key] = input.value;
      }
    });
    item.totalHarga = (Number(item.qty)||0) * (Number(item.harga)||0);
    const _after = { ...item };
    if (window.UndoRedo && JSON.stringify(_before) !== JSON.stringify(_after)) {
      const _docId = docId, _idx = idx;
      UndoRedo.push('po', {
        before: _before, after: _after,
        save: (state) => { const d=_data.find(x=>x.id===_docId); if(d&&d.items[_idx]){Object.assign(d.items[_idx],state); d.items[_idx].totalHarga=(Number(d.items[_idx].qty)||0)*(Number(d.items[_idx].harga)||0); DB.savePO(d).catch(()=>{}); _updateFooter(_docId);} },
        render: () => { const d=_data.find(x=>x.id===_docId); if(d) openAnggaran(_docId); },
      });
    }
    DB.savePO(doc).catch(() => {});
    DB.logActivity?.({ type: 'edit_po', detail: `Edit baris #${idx+1}: ${item.namaBarang||'(kosong)'} — ${doc.nomorEstimasi||''}`, rowId: docId });

    const locked = doc.status === 'selesai' || doc.status === 'arsip';
    tr.outerHTML = _viewRow(docId, item, idx, locked);
    _editState = null;
    _updateFooter(docId);
  }

  function _cancelEdit() {
    if (!_editState) return;
    const { docId, idx } = _editState;
    document.removeEventListener('click', _handleOutsideClick);
    const doc = _data.find(d => d.id === docId);
    const tr = document.querySelector('#po-table tbody tr.po-editing');
    if (tr && doc?.items[idx]) {
      const locked = doc.status === 'selesai' || doc.status === 'arsip';
      tr.outerHTML = _viewRow(docId, doc.items[idx], idx, locked);
    }
    _editState = null;
  }

  function _handleOutsideClick(e) {
    if (!_editState) return;
    const editTr = document.querySelector('#po-table tbody tr.po-editing');
    if (editTr && editTr.contains(e.target)) return;
    _commitEdit();
  }

  function _onEditKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); _cancelEdit(); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!_editState) return;
      const { docId, idx } = _editState;
      _commitEdit();
      const doc = _data.find(d => d.id === docId);
      if (doc && idx + 1 < (doc.items||[]).length) _startEdit(docId, idx + 1);
    }
  }

  function _liveCalc(input) {
    const tr = input.closest('tr');
    if (!tr) return;
    const q = parseFloat(tr.querySelector('td[data-key="qty"] input')?.value) || 0;
    const h = parseFloat(tr.querySelector('td[data-key="harga"] input')?.value) || 0;
    const totalTd = tr.querySelector('.po-total-cell');
    if (!totalTd) return;
    const t = q * h;
    totalTd.textContent = t ? rp(t) : '';
    totalTd.style.color = t ? 'var(--text)' : 'var(--text-3)';
  }

  /* ── GridSelect callbacks ──────────────────── */
  function _onFill(tblId, colIdx, srcRow, targetRows, val) {
    const tbl = document.getElementById('po-table');
    if (!tbl) return;
    const docId = tbl.dataset.doc;
    const doc = _data.find(d => d.id === docId);
    if (!doc || doc.status==='selesai'||doc.status==='arsip') return;
    const key = _COL[colIdx];
    if (!key || key==='totalHarga') return;
    const isNum = key==='qty'||key==='harga'||key==='alokasiDanaReal';
    const parsed = isNum ? parseFloat(String(val).replace(/[Rp\s\u00a0.]/g,'').replace(',','.'))||0 : val;
    let changed = 0;
    targetRows.forEach(ri => {
      if (!doc.items[ri]) return;
      doc.items[ri][key] = parsed;
      if (key==='qty'||key==='harga') doc.items[ri].totalHarga = (Number(doc.items[ri].qty)||0)*(Number(doc.items[ri].harga)||0);
      changed++;
    });
    if (changed) {
      DB.savePO(doc).catch(()=>{});
      const tbody = tbl.querySelector('tbody');
      const locked = doc.status==='selesai'||doc.status==='arsip';
      if (tbody) tbody.innerHTML = doc.items.map((it,i) => _viewRow(docId, it, i, locked)).join('');
      _updateFooter(docId);
      Notify.success(changed+' baris diperbarui');
    }
  }

  /* Delete/Backspace clear cell — kosongkan value (skip kolom computed) */
  let _onClearBatch = { docId: null, changed: 0, timer: null };
  function _onClear(tblId, rowIdx, colIdx) {
    const tbl = document.getElementById('po-table');
    if (!tbl) return;
    const docId = tbl.dataset.doc;
    const doc = _data.find(d => d.id === docId);
    if (!doc || doc.status === 'selesai' || doc.status === 'arsip') return;
    const key = _COL[colIdx];
    if (!key || key === 'totalHarga') return; // skip computed column
    const item = doc.items[rowIdx];
    if (!item) return;

    const isNum = key === 'qty' || key === 'harga' || key === 'alokasiDanaReal';
    item[key] = isNum ? 0 : '';
    if (key === 'qty' || key === 'harga') {
      item.totalHarga = (Number(item.qty) || 0) * (Number(item.harga) || 0);
    }
    _onClearBatch.docId = docId;
    _onClearBatch.changed++;
    // Debounce: batch multiple cell clears jadi 1 save + 1 render
    clearTimeout(_onClearBatch.timer);
    _onClearBatch.timer = setTimeout(() => {
      DB.savePO(doc).catch(() => {});
      const tbody = tbl.querySelector('tbody');
      const locked = doc.status === 'selesai' || doc.status === 'arsip';
      if (tbody) tbody.innerHTML = doc.items.map((it, i) => _viewRow(docId, it, i, locked)).join('');
      _updateFooter(docId);
      Notify.success(_onClearBatch.changed + ' cell dikosongkan');
      _onClearBatch = { docId: null, changed: 0, timer: null };
    }, 100);
  }

  function _onPaste(tblId, startRow, startCol, pasteRows) {
    const tbl = document.getElementById('po-table');
    if (!tbl) return;
    const docId = tbl.dataset.doc;
    const doc = _data.find(d => d.id === docId);
    if (!doc || doc.status==='selesai'||doc.status==='arsip') return;
    let changed = 0;
    pasteRows.forEach((cols, ri) => {
      const ii = startRow + ri;
      if (!doc.items[ii]) return;
      cols.forEach((val, ci) => {
        const key = _COL[startCol + ci];
        if (!key || key==='totalHarga') return;
        const isNum = key==='qty'||key==='harga'||key==='alokasiDanaReal';
        doc.items[ii][key] = isNum ? parseFloat(String(val).replace(/[Rp\s\u00a0.]/g,'').replace(',','.'))||0 : val;
        if (key==='qty'||key==='harga') doc.items[ii].totalHarga = (Number(doc.items[ii].qty)||0)*(Number(doc.items[ii].harga)||0);
      });
      changed++;
    });
    if (changed) {
      DB.savePO(doc).catch(()=>{});
      const tbody = tbl.querySelector('tbody');
      const locked = doc.status==='selesai'||doc.status==='arsip';
      if (tbody) tbody.innerHTML = doc.items.map((it,i) => _viewRow(docId, it, i, locked)).join('');
      _updateFooter(docId);
      Notify.success(changed+' baris dipaste');
    }
  }

  /* ── Footer live update ────────────────────── */
  function _updateFooter(docId) {
    const doc = _data.find(d => d.id === docId);
    if (!doc) return;
    const items = doc.items || [];
    const itemsTotal = items.reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
    const alokasiTotal = items.reduce((s,it) => s + (Number(it.alokasiDanaReal)||0), 0);
    const sisaPeriode = _getSisaPeriode(doc);
    const requestDana = itemsTotal - sisaPeriode;
    const totalDana = sisaPeriode + (Number(doc.cash)||0) + (Number(doc.atm)||0);
    const sisaUang = totalDana - itemsTotal;
    const danaDiterima = Number(doc.danaDiterima)||0;
    const cashReal = Number(doc.cashReal)||0;
    const atmReal = Number(doc.atmReal)||0;
    const totalDanaReal = cashReal + atmReal;
    const sisaReal = itemsTotal - alokasiTotal;
    const selisih = sisaReal - totalDanaReal;

    const $ = id => document.getElementById(id);
    const set = (id, txt, col) => { const el=$(id); if(el){el.textContent=txt; if(col)el.style.color=col;} };

    set('po-f-kebutuhan', rpA(itemsTotal));
    set('po-f-alokasi-total', rpA(alokasiTotal));
    set('po-f-request', requestDana > 0 ? rpA(requestDana) : 'Rp 0 (surplus '+rp(Math.abs(requestDana))+')');
    set('po-f-total-dana', rpA(totalDana));
    set('po-f-sisa', (sisaUang<0?'- ':'')+rpA(Math.abs(sisaUang)), sisaUang>=0?'#10b981':'#ef4444');
    set('po-f-sisa-prev', rpA(sisaPeriode));
    set('po-f-total-real', rpA(totalDanaReal));
    set('po-f-sisa-real', (sisaReal<0?'- ':'')+rpA(Math.abs(sisaReal)), sisaReal>=0?'#10b981':'#ef4444');
    set('po-f-selisih', selisih===0?'Rp 0 ✓':(selisih>0?'+':'-')+rpA(Math.abs(selisih)), selisih===0?'#10b981':selisih>0?'#f59e0b':'#ef4444');
    const $sr = $('po-f-sisa-row');
    if ($sr) $sr.style.background = sisaUang>=0 ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)';
  }

  /* ── Meta save ─────────────────────────────── */
  async function _saveMeta(docId, key, val) {
    const doc = _data.find(d => d.id === docId);
    if (!doc) return;
    const oldVal = doc[key];
    if (String(oldVal ?? '') === String(val ?? '')) return; // no change → skip log & save
    doc[key] = val;
    // Auto-generate nomorEstimasi, periode, dan tahun dari date picker
    if (key === 'periodeAwal' || key === 'periodeAkhir') {
      const awal  = key === 'periodeAwal'  ? val : doc.periodeAwal;
      const akhir = key === 'periodeAkhir' ? val : doc.periodeAkhir;
      if (awal) {
        const d1 = new Date(awal + 'T00:00:00');
        doc.tahun = d1.getFullYear();
        const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        doc.periode = akhir ? `${fmt(awal)} - ${fmt(akhir)}` : fmt(awal);
        const sorted = _sortedChain();
        const seqNum = sorted.findIndex(s => s.id === doc.id) + 1 || 1;
        doc.nomorEstimasi = _buildFilename(doc, seqNum);
        const nEl = document.getElementById(`po-nomor-estimasi-${doc.id}`);
        if (nEl) nEl.value = doc.nomorEstimasi;
      }
    }
    DB.savePO(doc).catch(() => {});
    DB.logActivity?.({ type: 'edit_po', detail: `${key}: ${oldVal||'∅'} → ${val||'∅'} (${doc.nomorEstimasi||''})`, rowId: docId });
  }

  /* ── Add rows ──────────────────────────────── */
  function _addRows(docId) {
    if (_editState) _commitEdit();
    const doc = _data.find(d => d.id === docId);
    if (!doc) return;
    for (let i = 0; i < 10; i++) doc.items.push({namaBarang:'',qty:'',satuan:'',keterangan:'',harga:'',totalHarga:0,alokasiDanaReal:''});
    DB.savePO(doc).catch(() => {});
    openAnggaran(docId);
  }

  let _copiedRow = null;
  function _copyRow(docId, idx) {
    const doc = _data.find(d => d.id === docId);
    if (!doc || !doc.items[idx]) return;
    _copiedRow = { ...doc.items[idx] };
    Notify.success('Baris di-copy');
  }
  function _pasteRow(docId, idx) {
    if (!_copiedRow) { Notify.warning('Belum ada baris yang di-copy'); return; }
    if (_editState) _commitEdit();
    const doc = _data.find(d => d.id === docId);
    if (!doc) return;
    const newItem = { ...(_copiedRow) };
    newItem.totalHarga = (Number(newItem.qty)||0) * (Number(newItem.harga)||0);
    doc.items.splice(idx + 1, 0, newItem);
    DB.savePO(doc).catch(() => {});
    openAnggaran(docId);
    Notify.success('Baris di-paste');
  }
  function _deleteRow(docId, idx) {
    if (_editState) _commitEdit();
    const doc = _data.find(d => d.id === docId);
    if (!doc || !doc.items[idx]) return;
    doc.items.splice(idx, 1);
    DB.savePO(doc).catch(() => {});
    openAnggaran(docId);
  }

  /* ── Arsip ─────────────────────────────────── */
  async function arsipkan(id) {
    if (_editState) _commitEdit();
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    doc.status = 'arsip';
    await DB.savePO(doc);
    DB.logActivity?.({ type: 'po_anggaran_arsip', detail: `Arsipkan: ${doc.nomorEstimasi||''} (${doc.periode||''})`, rowId: id });
    Notify.success('Anggaran diarsipkan');
    _render();
  }
  async function unarsip(id) {
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    doc.status = 'draft';
    await DB.savePO(doc);
    DB.logActivity?.({ type: 'po_anggaran_unarsip', detail: `Buka arsip: ${doc.nomorEstimasi||''}`, rowId: id });
    Notify.success('Anggaran dibuka dari arsip');
    openAnggaran(id);
  }

  /* ── Selesai ───────────────────────────────── */
  async function selesaikan(id) {
    if (_editState) _commitEdit();
    const ok = await Modal.confirm({title:'Selesaikan Anggaran', message:'Anggaran akan ditandai <strong>Selesai</strong>.<br>Semua field akan terkunci dan tidak bisa diedit.', confirmText:'Ya, Selesaikan'});
    if (!ok) return;
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    doc.status = 'selesai';
    await DB.savePO(doc);
    DB.logActivity?.({ type: 'po_anggaran_selesai', detail: `Selesai: ${doc.nomorEstimasi||''} (${doc.periode||''})`, rowId: id });
    Notify.success('Anggaran ditandai Selesai');
    openAnggaran(id);
  }
  async function reopenAnggaran(id) {
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    doc.status = 'draft';
    await DB.savePO(doc);
    DB.logActivity?.({ type: 'po_anggaran_reopen', detail: `Buka kembali: ${doc.nomorEstimasi||''}`, rowId: id });
    Notify.success('Anggaran dibuka kembali');
    openAnggaran(id);
  }

  /* ── Finance confirmation ──────────────────── */
  async function confirmAnggaran(id) {
    const cu = typeof Auth!=='undefined' ? Auth.currentUser() : null;
    const nama = cu?.nama || cu?.username || 'Finance';
    const ok = await Modal.confirm({title:'Konfirmasi Anggaran', message:`Konfirmasi anggaran ini sebagai <strong>${nama}</strong>?<br>Tindakan ini menandai bahwa finance telah menyetujui anggaran.`, confirmText:'Ya, Konfirmasi'});
    if (!ok) return;
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    doc.confirmedBy = nama;
    doc.confirmedAt = new Date().toISOString();
    doc.pendingFinance = false;
    await DB.savePO(doc);
    DB.logActivity?.({ type: 'po_anggaran_confirm', detail: `Konfirmasi finance: ${doc.nomorEstimasi||''} oleh ${nama}`, rowId: id });
    _updateBadge();
    Notify.success('Anggaran dikonfirmasi oleh ' + nama);
    // Push notif ke pembuat anggaran bahwa sudah dikonfirmasi
    if (window.Push && doc.namaPetugas) {
      Push.sendToUser(doc.namaPetugas, {
        title: '✅ Anggaran Dikonfirmasi',
        body: `Anggaran ${doc.nomorEstimasi} telah dikonfirmasi oleh ${nama}`,
        data: { type: 'po_confirmed', poId: doc.id }
      }).catch(() => {});
    }
    openAnggaran(id);
  }

  /* ── Ajukan ke Finance ─────────────────────── */
  async function ajukanFinance(id) {
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    const cu = Auth.currentUser();
    const pengaju = cu?.nama || cu?.username || '-';
    doc.pendingFinance = true;
    doc.pendingBy = pengaju;
    doc.pendingAt = new Date().toISOString();
    await DB.savePO(doc);
    DB.logActivity?.({ type: 'po_anggaran_pending', detail: `Ajukan ke finance: ${doc.nomorEstimasi||''} oleh ${pengaju}`, rowId: id });
    _updateBadge();

    // Push notification ke semua user role finance
    if (window.Push) {
      Push.sendToGroup({ role: 'finance' }, {
        title: '📩 Pengajuan Konfirmasi Anggaran',
        body: `${pengaju} mengajukan konfirmasi anggaran ${doc.nomorEstimasi||''} (${doc.periode||''})`,
        data: { type: 'po_pending', poId: doc.id }
      }).catch(() => {});
    }

    // In-app notification via Notify
    Notify.success('Pengajuan dikirim ke Finance');
    openAnggaran(id);
  }

  /* ── Badge on sidebar ──────────────────────── */
  function _updateBadge() {
    const badge = document.getElementById('po-nav-badge');
    if (!badge) return;
    // Count: finance sees pending requests, others see nothing
    const count = _isFinance() ? _data.filter(d => d.pendingFinance && !d.confirmedBy).length : 0;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /* ── Import dari Belanja Pasar ──────────────── */
  async function importBelanjaPasar(id) {
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    // Load belanja pasar data
    let bpList = [];
    try { bpList = await DB.getBelanjaPasar(); } catch {
      try { bpList = JSON.parse(localStorage.getItem('becca_po_belanja_pasar')||'[]'); } catch { bpList = []; }
    }
    bpList = bpList.filter(bp => (bp.items||[]).some(it => it.item));
    if (!bpList.length) { Notify.warning('Belum ada Form Belanja Pasar yang tersedia'); return; }

    // Show picker modal
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: 'Import dari Belanja Pasar',
      size: 'modal-md',
      body: `<p style="color:var(--text-2);font-size:13px;margin-bottom:12px">Pilih form belanja pasar untuk diimport ke anggaran ini. Item akan ditambahkan ke tabel anggaran.</p>
        <div style="display:grid;gap:8px">
          ${bpList.map(bp => {
            const n = (bp.items||[]).filter(it=>it.item).length;
            const total = (bp.items||[]).reduce((s,it) => s + (it.totalQty||0) * (it.harga||0), 0);
            return `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer">
              <input type="radio" name="bp-pick" value="${bp.id}" style="accent-color:#059669;width:16px;height:16px">
              <div>
                <div style="font-weight:600;font-size:13px">🛒 ${bp.periode||'-'}</div>
                <div style="font-size:11px;color:var(--text-3)">${n} items · Total ${rp(total)} · ${bp.namaPetugas||'-'}</div>
              </div>
            </label>`;
          }).join('')}
        </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
               <button class="btn btn-primary" onclick="POModule._doImportBP('${id}','${mid}')">Import</button>`,
    });
  }

  async function _doImportBP(docId, mid) {
    const picked = document.querySelector('input[name="bp-pick"]:checked')?.value;
    if (!picked) { Notify.warning('Pilih satu form belanja pasar'); return; }
    let bpList = [];
    try { bpList = JSON.parse(localStorage.getItem('becca_po_belanja_pasar')||'[]'); } catch {}
    // Try memory first (BP module may have it)
    if (typeof POBelanjaPasarModule !== 'undefined' && POBelanjaPasarModule._data) {
      bpList = POBelanjaPasarModule._data;
    }
    const bp = bpList.find(b => b.id === picked);
    if (!bp || !bp.items?.length) { Notify.warning('Form belanja pasar kosong'); return; }

    const doc = _data.find(d => d.id === docId);
    if (!doc) return;

    // Map BP items to anggaran rows
    let added = 0;
    bp.items.forEach(bpItem => {
      if (!bpItem.item || !bpItem.totalQty) return;
      // Check if item already exists in anggaran
      const existing = doc.items.find(row => row.namaBarang && row.namaBarang.toLowerCase().trim() === bpItem.item.toLowerCase().trim());
      if (existing) {
        // Update existing row
        existing.qty = (Number(existing.qty)||0) + bpItem.totalQty;
        existing.harga = existing.harga || bpItem.harga || 0;
        existing.totalHarga = (Number(existing.qty)||0) * (Number(existing.harga)||0);
        existing.keterangan = (existing.keterangan ? existing.keterangan + ' ' : '') + 'BP';
      } else {
        // Find first empty row
        let emptyRow = doc.items.find(row => !row.namaBarang);
        if (!emptyRow) {
          emptyRow = {namaBarang:'',qty:'',satuan:'',keterangan:'',harga:'',totalHarga:0,alokasiDanaReal:''};
          doc.items.push(emptyRow);
        }
        emptyRow.namaBarang = bpItem.item;
        emptyRow.qty = bpItem.totalQty;
        emptyRow.satuan = bpItem.satuan || '';
        emptyRow.harga = bpItem.harga || 0;
        emptyRow.totalHarga = bpItem.totalQty * (bpItem.harga || 0);
        emptyRow.keterangan = 'BP';
      }
      added++;
    });

    try { await DB.savePO(doc); } catch(e) { Notify.error('Gagal menyimpan'); return; }
    Modal.close(mid);
    Notify.success(added + ' item diimport dari Belanja Pasar');
    openAnggaran(docId);
  }

  /* ── Duplikat ──────────────────────────────── */
  async function duplikatAnggaran(id) {
    const src = _data.find(d => d.id === id);
    if (!src) return;
    const cu = typeof Auth!=='undefined' ? Auth.currentUser() : null;
    const doc = {
      ...JSON.parse(JSON.stringify(src)),
      id: Utils.uid(),
      nomorEstimasi: src.nomorEstimasi + '-COPY',
      namaPetugas: cu?.nama || cu?.username || src.namaPetugas,
      status: 'draft',
      confirmedBy: null, confirmedAt: null,
      createdAt: new Date().toISOString(),
    };
    try {
      await DB.savePO(doc);
      _data.push(doc);
      DB.logActivity?.({ type: 'add_po', detail: `Duplikat dari ${src.nomorEstimasi||''} → ${doc.nomorEstimasi}`, rowId: doc.id });
      Notify.success('Anggaran berhasil diduplikat');
      openAnggaran(doc.id);
    } catch(e) { Notify.error('Gagal menduplikat'); }
  }

  /* ── Delete ────────────────────────────────── */
  async function deleteAnggaran(id) {
    const target = _data.find(d => d.id === id);
    const ok = await Modal.confirm({title:'Hapus Anggaran',message:'Anggaran ini akan dihapus permanen.<br><strong>Perhatian:</strong> Sisa dana akan menyesuaikan ke anggaran sesudahnya.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    _data = _data.filter(d => d.id !== id);
    try {
      await DB.deletePO(id);
      DB.logActivity?.({ type: 'delete_po', detail: `Hapus: ${target?.nomorEstimasi||id} (${target?.periode||''})`, rowId: id });
    } catch(e) {}
    _render();
    Notify.success('Anggaran dihapus');
  }

  /* ── Navigation ────────────────────────────── */
  function backToList() { flushPendingEdit(); _render(); }
  function flushPendingEdit() {
    if (_editState) _commitEdit();
    // Auto-save belanja pasar when leaving PO page
    if (typeof POBelanjaPasarModule !== 'undefined') POBelanjaPasarModule.autoSave?.();
  }

  /* ── Filename builder ──────────────────────── */
  function _buildFilename(doc, seqNum) {
    if (!doc.periodeAwal || !doc.periodeAkhir) return `BPS-EAM-???????? #${seqNum||'?'}`;
    const d1 = new Date(doc.periodeAwal);
    const d2 = new Date(doc.periodeAkhir);
    const dd1 = String(d1.getDate()).padStart(2,'0');
    const dd2 = String(d2.getDate()).padStart(2,'0');
    const yy  = String(d1.getFullYear()).slice(-2);
    const mm  = String(d1.getMonth()+1).padStart(2,'0');
    return `BPS-EAM-${dd1}${dd2}${yy}${mm} #${seqNum||'?'}`;
  }

  function _formatPeriodeLengkap(doc) {
    if (!doc.periodeAwal || !doc.periodeAkhir) return doc.periode || '';
    const opt = { day:'numeric', month:'long', year:'numeric' };
    const loc = 'id-ID';
    const d1 = new Date(doc.periodeAwal);
    const d2 = new Date(doc.periodeAkhir);
    if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
      return `${d1.getDate()} – ${d2.toLocaleDateString(loc, opt)}`;
    }
    return `${d1.toLocaleDateString(loc, opt)} – ${d2.toLocaleDateString(loc, opt)}`;
  }

  /* ── Print ─────────────────────────────────── */
  function printAnggaran(id) {
    if (_editState) _commitEdit();
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    const items = doc.items || [];
    const rpP = n => n ? Math.round(Number(n)).toLocaleString('id')+',-' : '';

    const sorted = _sortedChain();
    const chainIdx = sorted.findIndex(s => s.id === id);
    const sisaPeriode = _getSisaPeriode(doc);
    const itemsTotal = items.reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
    const requestDana = itemsTotal - sisaPeriode;
    const totalDana = sisaPeriode + (Number(doc.cash)||0) + (Number(doc.atm)||0);
    const sisaUang = totalDana - itemsTotal;
    const isSelesai = doc.status === 'selesai';

    // ── Data Real (realisasi belanja) ──
    const alokasiTotal  = items.reduce((s,it) => s + (Number(it.alokasiDanaReal)||0), 0);
    const danaDiterima  = Number(doc.danaDiterima)||0;
    const cashReal      = Number(doc.cashReal)||0;
    const atmReal       = Number(doc.atmReal)||0;
    const totalDanaReal = cashReal + atmReal;
    const sisaReal      = itemsTotal - alokasiTotal;
    const selisihReal   = sisaReal - totalDanaReal;
    const hasReal       = alokasiTotal > 0 || danaDiterima > 0 || totalDanaReal > 0;

    const rows = items.map((it,i) => {
      const h = Number(it.harga)||0;
      const t = Number(it.totalHarga)||0;
      const a = Number(it.alokasiDanaReal)||0;
      return `<tr style="border-bottom:1px solid #eee;${i%2?'background:#f9f9f9':''}">
        <td style="padding:4px 8px;font-size:10px">${it.namaBarang||''}</td>
        <td style="padding:4px 6px;text-align:center;font-size:10px">${it.qty||''}</td>
        <td style="padding:4px 6px;text-align:center;font-size:10px">${it.satuan||''}</td>
        <td style="padding:4px 6px;font-size:10px">${it.keterangan||''}</td>
        <td style="padding:4px 6px;text-align:right;font-size:10px">${h?rpP(h):''}</td>
        <td style="padding:4px 6px;text-align:right;font-size:10px;font-weight:600;background:rgba(71,85,105,.05)">${t?rpP(t):''}</td>
        <td style="padding:4px 6px;text-align:right;font-size:10px;background:rgba(244,63,94,.04)">${a?rpP(a):''}</td>
      </tr>`;
    }).join('');

    const filename = doc.nomorEstimasi || _buildFilename(doc, chainIdx+1);
    const periodeLengkap = _formatPeriodeLengkap(doc);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${filename}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:16px}
    @page{size:A4 portrait;margin:10mm}@media print{.no-print{display:none!important}}table{width:100%;border-collapse:collapse}</style></head><body>
    <button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 20px;background:#dc2626;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;z-index:99">Print / Save PDF</button>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div><div style="font-size:11px;font-weight:700;color:#dc2626;background:#fef2f2;display:inline-block;padding:2px 8px;border-radius:3px">BPS</div>
        <div style="font-size:22px;font-weight:900;color:#1a1a2e;margin-top:4px">Estimasi Anggaran Mingguan</div>
        <div style="font-size:10px;color:#666;margin-top:2px">Anggaran #${chainIdx+1}</div></div>
      <div style="text-align:right">
        <div style="font-size:10px;font-weight:700;color:#1a1a2e;background:#f5f5f5;padding:4px 10px;border-radius:5px;font-family:monospace;letter-spacing:.5px">${filename}</div>
        <div style="font-size:9px;color:#666;margin-top:3px">Estimation Number #${doc.nomorEstimasi||''}</div>
        <div style="font-size:10px;margin-top:4px"><span style="color:#666">Nama Petugas:</span> <strong style="font-size:18px;color:#dc2626">${doc.namaPetugas||''}</strong></div>
        ${doc.confirmedBy?`<div style="font-size:9px;color:#10b981;margin-top:2px">✓ Confirmed by ${doc.confirmedBy}</div>`:''}</div>
    </div>
    <div style="font-size:10px;color:#666;margin-bottom:8px;padding:6px 10px;background:#fafafa;border:1px solid #eee;border-radius:4px"><strong>Tujuan</strong><br>Lembaran estimasi anggaran ini di buat untuk menghitung anggaran yang akan dikeluarkan untuk keperluan operasional dan gaji pada periode yang bersangkutan.</div>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;padding:7px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px">
      <span style="font-size:11px;color:#dc2626;font-weight:700">Periode</span>
      <span style="font-size:13px;font-weight:800;color:#1a1a2e">${periodeLengkap}</span>
      ${doc.periode && doc.periodeAwal ? `<span style="font-size:10px;color:#999">(${doc.periode})</span>` : ''}
    </div>
    <div style="position:relative">
      ${isSelesai ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:64px;font-weight:900;color:rgba(100,116,139,.08);pointer-events:none;white-space:nowrap;letter-spacing:10px;font-style:italic;z-index:2">SELESAI</div>` : ''}
      <table><thead><tr style="background:#dc2626;color:#fff">
        <th style="padding:6px;font-size:9px;text-align:left">Nama barang</th><th style="padding:6px;font-size:9px;width:40px">QTY</th><th style="padding:6px;font-size:9px;width:50px">Satuan</th>
        <th style="padding:6px;font-size:9px;text-align:left">Keterangan</th><th style="padding:6px;font-size:9px;text-align:right;width:90px">Harga (IDR)</th>
        <th style="padding:6px;font-size:9px;text-align:right;width:100px;background:rgba(0,0,0,.1)">Total Harga</th>
        <th style="padding:6px;font-size:9px;text-align:right;width:100px;background:rgba(255,255,255,.1)">Alokasi Dana Real</th></tr></thead>
      <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;page-break-inside:avoid;break-inside:avoid;margin-top:0">
      <tbody>
        <tr style="background:#fef2f2"><td colspan="4"></td><td style="padding:5px;text-align:right;font-size:10px;font-weight:600;color:#dc2626">Total Kebutuhan</td><td style="padding:5px;text-align:right;font-size:10px;font-weight:600;color:#dc2626">${rpP(itemsTotal)}</td><td style="padding:5px;text-align:right;font-size:10px;color:#dc2626;background:rgba(244,63,94,.06)">${hasReal?'<span style="font-weight:400;color:#999">Total Alokasi</span> '+rpP(alokasiTotal):''}</td></tr>
        <tr><td colspan="4"></td><td style="padding:4px 6px;text-align:right;font-size:10px;color:#666">Sisa Periode Sebelumnya</td><td style="padding:4px 6px;text-align:right;font-size:10px;color:#10b981;font-weight:600">${rpP(sisaPeriode)}</td><td style="background:rgba(244,63,94,.06)"></td></tr>
        <tr style="background:#eef2ff"><td colspan="4"></td><td style="padding:8px 6px;text-align:right;font-size:13px;font-weight:800;color:#4f46e5">Request Dana</td><td style="padding:8px 6px;text-align:right;font-size:17px;font-weight:900;color:#4f46e5;letter-spacing:.01em">${requestDana>0?rpP(requestDana):'0,- (surplus)'}</td><td style="padding:8px 6px;text-align:right;font-size:10px;color:#666;background:rgba(244,63,94,.06)">${hasReal?'<span style="color:#999">Dana Diterima</span> '+rpP(danaDiterima):''}</td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px">Cash ${rpP(doc.cash||0)}</td><td style="padding:3px 6px;text-align:right;font-size:10px;background:rgba(244,63,94,.06)">${hasReal?'<span style="color:#999">Cash</span> '+rpP(cashReal):''}</td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px">ATM. ${rpP(doc.atm||0)}</td><td style="padding:3px 6px;text-align:right;font-size:10px;background:rgba(244,63,94,.06)">${hasReal?'<span style="color:#999">ATM</span> '+rpP(atmReal):''}</td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px;color:#666">Total Dana ${rpP(totalDana)}</td><td style="padding:3px 6px;text-align:right;font-size:10px;color:#666;font-weight:600;background:rgba(244,63,94,.06)">${hasReal?'<span style="color:#999;font-weight:400">Total Cash+ATM</span> '+rpP(totalDanaReal):''}</td></tr>
        <tr><td colspan="5"></td><td style="padding:4px 6px;text-align:right;font-size:11px;font-weight:700;color:${sisaUang>=0?'#10b981':'#dc2626'}">SISA ${sisaUang<0?'- ':''}${rpP(Math.abs(sisaUang))}</td><td style="padding:4px 6px;text-align:right;font-size:11px;font-weight:700;color:#7c3aed;background:rgba(244,63,94,.06)">${hasReal?'<span style="color:#999;font-weight:400">SISA (Real)</span> '+(sisaReal<0?'- ':'')+rpP(Math.abs(sisaReal)):''}</td></tr>
        ${hasReal?`<tr><td colspan="5"></td><td></td><td style="padding:5px 6px;text-align:right;font-size:11px;font-weight:700;color:${selisihReal===0?'#10b981':selisihReal>0?'#f59e0b':'#dc2626'};background:${selisihReal===0?'rgba(16,185,129,.1)':selisihReal>0?'rgba(245,158,11,.1)':'rgba(239,68,68,.1)'}"><span style="color:#999;font-weight:400">SELISIH</span> ${selisihReal===0?'Rp 0 ✓':(selisihReal>0?'+':'-')+rpP(Math.abs(selisihReal))}</td></tr>`:''}
      </tbody></table>
    </div></body></html>`;
    const w = window.open('','_blank','width=800,height=900');
    if (w) { w.document.write(html); w.document.close(); }
  }

  /* ── Kirim WA ───────────────────────────────── */
  function kirimWA(id) {
    if (_editState) _commitEdit();
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    const items = (doc.items||[]).filter(it => it.namaBarang);
    const rpW = n => n ? 'Rp '+Math.round(Number(n)).toLocaleString('id') : '-';

    const sorted = _sortedChain();
    const chainIdx = sorted.findIndex(s => s.id === id);
    const sisaPeriode = _getSisaPeriode(doc);
    const itemsTotal = items.reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
    const requestDana = itemsTotal - sisaPeriode;
    const totalDana = sisaPeriode + (Number(doc.cash)||0) + (Number(doc.atm)||0);
    const sisaUang = totalDana - itemsTotal;

    let text = `*ESTIMASI ANGGARAN MINGGUAN*\n`;
    text += `Anggaran #${chainIdx+1} — ${doc.nomorEstimasi||''}\n`;
    text += `Periode: ${doc.periode||'-'} ${doc.tahun||''}\n`;
    text += `Petugas: ${doc.namaPetugas||'-'}\n`;
    if (doc.confirmedBy) text += `Confirmed by: ${doc.confirmedBy}\n`;
    if (doc.status === 'selesai') text += `Status: SELESAI\n`;
    text += `\n———————————————\n`;

    items.forEach((it, i) => {
      const t = Number(it.totalHarga)||0;
      text += `${i+1}. ${it.namaBarang}`;
      if (it.qty) text += `  ${it.qty} ${it.satuan||''}`;
      if (it.harga) text += `  @${rpW(it.harga)}`;
      if (t) text += `  = *${rpW(t)}*`;
      if (it.keterangan) text += `\n   _${it.keterangan}_`;
      text += `\n`;
    });

    text += `———————————————\n`;
    text += `*Total Kebutuhan:* ${rpW(itemsTotal)}\n`;
    if (sisaPeriode) text += `Sisa Periode Sblm: ${rpW(sisaPeriode)}\n`;
    if (requestDana > 0) text += `*Request Dana:* ${rpW(requestDana)}\n`;
    else text += `Request Dana: Rp 0 (surplus ${rpW(Math.abs(requestDana))})\n`;
    text += `\nCash: ${rpW(doc.cash||0)}\nATM: ${rpW(doc.atm||0)}\nTotal Dana: ${rpW(totalDana)}\n`;
    text += `*SISA: ${sisaUang<0?'- ':''}${rpW(Math.abs(sisaUang))}*\n`;
    text += `\n_Dikirim via BECCA_`;

    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  return { init, switchTab, addAnggaran, openAnggaran, backToList, arsipkan, unarsip,
    selesaikan, reopenAnggaran, confirmAnggaran, ajukanFinance, importBelanjaPasar, _doImportBP,
    duplikatAnggaran, deleteAnggaran,
    printAnggaran, kirimWA, _startEdit, _onEditKey, _liveCalc, _saveMeta, _addRows, _copyRow, _pasteRow, _deleteRow, _updateFooter,
    flushPendingEdit,
    _openSupplierImport, _supImpToggleAll, _supImpConfirm,
    _renderRequestCards, _approveRequestModal, _approveRequestDo,
    _rejectRequestModal, _rejectRequestDo };
})(); }
