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
        ${canEdit ? `<div class="page-header-right">
          <button class="btn btn-primary" onclick="POModule.addAnggaran()">+ Buat Anggaran</button>
        </div>` : ''}
      </div>
      <div class="tabs" style="margin-bottom:var(--s4)">
        <button class="tab-btn active" onclick="POModule.switchTab('active')">Aktif</button>
        <button class="tab-btn" onclick="POModule.switchTab('arsip')">Arsip</button>
        <button class="tab-btn" onclick="POModule.switchTab('belanja-pasar')">Belanja Pasar</button>
      </div>
      <div id="po-content"></div>`;
    _renderList('active');
  }

  function switchTab(tab) {
    // Auto-save belanja pasar when switching away
    if (typeof POBelanjaPasarModule !== 'undefined') POBelanjaPasarModule.autoSave?.();
    document.querySelectorAll('.tabs .tab-btn').forEach((b,i) => {
      b.classList.toggle('active', (i===0&&tab==='active')||(i===1&&tab==='arsip')||(i===2&&tab==='belanja-pasar'));
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
      const ver = '?v=20260402h';
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

  /* ── Card list ─────────────────────────────── */
  function _renderList(tab) {
    const el = document.getElementById('po-content');
    if (!el) return;
    const sorted = _sortedChain();
    const list = sorted.filter(d => tab==='arsip' ? d.status==='arsip' : d.status!=='arsip');
    if (!list.length) {
      el.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-3)"><div style="font-size:32px;margin-bottom:8px">📋</div>${tab==='arsip'?'Belum ada arsip':'Belum ada anggaran'}</div>`;
      return;
    }
    el.innerHTML = `<div style="display:grid;gap:10px">
      ${list.map(d => {
        const chainIdx = sorted.findIndex(s => s.id === d.id);
        const kebutuhan = (d.items||[]).reduce((s,it) => s + (Number(it.totalHarga)||0), 0);
        const sisaPrev = _getSisaPeriode(d);
        const requestDana = kebutuhan - sisaPrev;
        const isConfirmed = d.confirmedBy;
        const isSelesai = d.status === 'selesai';
        const cardBg = isSelesai ? 'rgba(100,116,139,.08)' : isConfirmed ? 'rgba(16,185,129,.08)' : d.status==='arsip' ? 'rgba(100,116,139,.04)' : '';
        const cardBorder = isSelesai ? 'rgba(100,116,139,.25)' : isConfirmed ? 'rgba(16,185,129,.3)' : 'var(--border)';
        return `<div style="background:var(--surface);border:1px solid ${cardBorder};border-radius:10px;padding:12px 16px;cursor:pointer;transition:.15s;position:relative;overflow:hidden;${cardBg?'background:'+cardBg:''}"
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
            <span>Items: <strong>${(d.items||[]).filter(it=>it.namaBarang).length}</strong></span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
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
      setTimeout(() => _startEdit(doc.id, 0), 100);
    } catch(e) { Notify.error('Gagal membuat anggaran'); }
  }

  /* ── Detail view ───────────────────────────── */
  function openAnggaran(id) {
    if (_editState) _commitEdit();
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

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
          <div class="form-group"><label class="form-label">Nomor Estimasi</label>
            <input class="form-control" value="${doc.nomorEstimasi||''}" onchange="POModule._saveMeta('${id}','nomorEstimasi',this.value)" style="font-family:var(--font-mono);font-weight:700" ${locked?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Dibuat oleh</label>
            <input class="form-control" value="${doc.namaPetugas||''}" disabled style="background:var(--surface2)"></div>
          <div class="form-group"><label class="form-label">Periode</label>
            <input class="form-control" value="${doc.periode||''}" placeholder="2 Apr - 5 Apr" onchange="POModule._saveMeta('${id}','periode',this.value)" ${locked?'disabled':''}></div>
          <div class="form-group"><label class="form-label">Tahun</label>
            <input class="form-control" type="number" value="${doc.tahun||2026}" onchange="POModule._saveMeta('${id}','tahun',+this.value)" ${locked?'disabled':''}></div>
        </div>
      </div>

      <div style="position:relative;overflow:hidden;border:1px solid var(--border);border-radius:10px">
        ${isSelesai ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72px;font-weight:900;color:rgba(100,116,139,.08);pointer-events:none;white-space:nowrap;letter-spacing:12px;text-transform:uppercase;font-style:italic;z-index:2">SELESAI</div>` : ''}
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:800px" id="po-table" data-grid-select data-doc="${id}">
          <thead><tr style="background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff">
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
            <tr style="border-top:2px solid var(--border);background:rgba(220,38,38,.06)">
              <td colspan="5" style="padding:7px;text-align:right;font-size:11px;font-weight:700;color:#dc2626">Total Kebutuhan</td>
              <td colspan="2" style="padding:7px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:700;color:#dc2626" id="po-f-kebutuhan">${rpA(itemsTotal)}</td><td></td>
            </tr>
            <tr style="background:var(--surface2)">
              <td colspan="5" style="padding:6px;text-align:right;font-size:10px;color:var(--text-3)">
                Sisa Periode Sebelumnya
                ${!isFirst ? `<span style="font-size:8px;background:rgba(99,102,241,.1);color:#6366f1;padding:1px 5px;border-radius:3px;margin-left:4px">auto dari #${chainIdx}</span>` : ''}
              </td>
              <td colspan="2" style="padding:6px;text-align:right">
                ${isFirst && !locked
                  ? `<input type="number" step="1" value="${doc.sisaPeriode||0}" id="po-f-sisa-prev-input"
                      onchange="POModule._saveMeta('${id}','sisaPeriode',+this.value);POModule._updateFooter('${id}')"
                      style="width:120px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-family:var(--font-mono);font-size:12px;background:var(--surface)">`
                  : `<span id="po-f-sisa-prev" style="font-family:var(--font-mono);font-size:12px;color:#10b981;font-weight:600">${rpA(sisaPeriode)}</span>`}
              </td><td></td>
            </tr>
            <tr style="background:rgba(99,102,241,.05)">
              <td colspan="5" style="padding:7px;text-align:right;font-size:11px;font-weight:700;color:#6366f1">
                Request Dana
                <span style="font-size:8px;color:var(--text-3);font-weight:400;margin-left:4px">= kebutuhan − sisa prev</span>
              </td>
              <td colspan="2" style="padding:7px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:700;color:#6366f1" id="po-f-request">${requestDana > 0 ? rpA(requestDana) : 'Rp 0 (surplus '+rp(Math.abs(requestDana))+')'}</td><td></td>
            </tr>
            <tr style="background:var(--surface2)"><td colspan="5"></td>
              <td style="padding:4px 6px;text-align:right;font-size:10px;color:var(--text-3)">Cash</td>
              <td style="padding:4px 6px"><input type="number" step="1" value="${doc.cash||0}" id="po-f-cash"
                onchange="POModule._saveMeta('${id}','cash',+this.value);POModule._updateFooter('${id}')" ${locked?'disabled':''}
                style="width:120px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)"></td><td></td></tr>
            <tr style="background:var(--surface2)"><td colspan="5"></td>
              <td style="padding:4px 6px;text-align:right;font-size:10px;color:var(--text-3)">ATM</td>
              <td style="padding:4px 6px"><input type="number" step="1" value="${doc.atm||0}" id="po-f-atm"
                onchange="POModule._saveMeta('${id}','atm',+this.value);POModule._updateFooter('${id}')" ${locked?'disabled':''}
                style="width:120px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)"></td><td></td></tr>
            <tr style="background:var(--surface2)"><td colspan="5"></td>
              <td style="padding:4px 6px;text-align:right;font-size:10px;color:var(--text-3);font-weight:600">Total Dana</td>
              <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:600" id="po-f-total-dana">${rpA(totalDana)}</td><td></td></tr>
            <tr style="background:${sisaUang>=0?'rgba(16,185,129,.06)':'rgba(239,68,68,.06)'}" id="po-f-sisa-row">
              <td colspan="5"></td>
              <td style="padding:6px;text-align:right;font-size:11px;font-weight:700">SISA</td>
              <td style="padding:6px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:700;color:${sisaUang>=0?'#10b981':'#ef4444'}" id="po-f-sisa">${sisaUang<0?'- ':''}${rpA(Math.abs(sisaUang))}</td><td></td></tr>
          </tfoot>
        </table>
        </div>
      </div>
      ${!locked ? `<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:var(--text-3);font-style:italic">Double-click baris untuk edit · Enter simpan & lanjut · Esc batal · Drag handle untuk copy</span>
        <button onclick="POModule._addRows('${id}')" style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text-3);font-size:11px;cursor:pointer">+ Tambah 10 Baris</button>
      </div>` : ''}`;

    // Register GridSelect callbacks
    if (window.GridSelect) {
      GridSelect.onFill('po-table', _onFill);
      GridSelect.onPaste('po-table', _onPaste);
    }
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
    DB.savePO(doc).catch(() => {});

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
    const sisaPeriode = _getSisaPeriode(doc);
    const requestDana = itemsTotal - sisaPeriode;
    const totalDana = sisaPeriode + (Number(doc.cash)||0) + (Number(doc.atm)||0);
    const sisaUang = totalDana - itemsTotal;

    const $k = document.getElementById('po-f-kebutuhan');
    const $r = document.getElementById('po-f-request');
    const $td = document.getElementById('po-f-total-dana');
    const $s = document.getElementById('po-f-sisa');
    const $sp = document.getElementById('po-f-sisa-prev');
    const $sr = document.getElementById('po-f-sisa-row');

    if ($k) $k.textContent = rpA(itemsTotal);
    if ($r) $r.textContent = requestDana > 0 ? rpA(requestDana) : 'Rp 0 (surplus '+rp(Math.abs(requestDana))+')';
    if ($td) $td.textContent = rpA(totalDana);
    if ($s) { $s.textContent = (sisaUang<0?'- ':'')+rpA(Math.abs(sisaUang)); $s.style.color = sisaUang>=0?'#10b981':'#ef4444'; }
    if ($sr) $sr.style.background = sisaUang>=0 ? 'rgba(16,185,129,.06)' : 'rgba(239,68,68,.06)';
    if ($sp) $sp.textContent = rpA(sisaPeriode);
  }

  /* ── Meta save ─────────────────────────────── */
  async function _saveMeta(docId, key, val) {
    const doc = _data.find(d => d.id === docId);
    if (!doc) return;
    doc[key] = val;
    DB.savePO(doc).catch(() => {});
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

  /* ── Arsip ─────────────────────────────────── */
  async function arsipkan(id) {
    if (_editState) _commitEdit();
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    doc.status = 'arsip';
    await DB.savePO(doc);
    Notify.success('Anggaran diarsipkan');
    _render();
  }
  async function unarsip(id) {
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    doc.status = 'draft';
    await DB.savePO(doc);
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
    Notify.success('Anggaran ditandai Selesai');
    openAnggaran(id);
  }
  async function reopenAnggaran(id) {
    const doc = _data.find(d => d.id === id);
    if (!doc) return;
    doc.status = 'draft';
    await DB.savePO(doc);
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
      Notify.success('Anggaran berhasil diduplikat');
      openAnggaran(doc.id);
    } catch(e) { Notify.error('Gagal menduplikat'); }
  }

  /* ── Delete ────────────────────────────────── */
  async function deleteAnggaran(id) {
    const ok = await Modal.confirm({title:'Hapus Anggaran',message:'Anggaran ini akan dihapus permanen.<br><strong>Perhatian:</strong> Sisa dana akan menyesuaikan ke anggaran sesudahnya.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    _data = _data.filter(d => d.id !== id);
    try { await DB.deletePO(id); } catch(e) {}
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

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Anggaran #${chainIdx+1} ${doc.nomorEstimasi}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:16px}
    @page{size:A4 portrait;margin:10mm}@media print{.no-print{display:none!important}}table{width:100%;border-collapse:collapse}</style></head><body>
    <button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 20px;background:#dc2626;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;z-index:99">Print</button>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div><div style="font-size:11px;font-weight:700;color:#dc2626;background:#fef2f2;display:inline-block;padding:2px 8px;border-radius:3px">BPS</div>
        <div style="font-size:22px;font-weight:900;color:#1a1a2e;margin-top:4px">Estimasi Anggaran Mingguan</div>
        <div style="font-size:10px;color:#666;margin-top:2px">Anggaran #${chainIdx+1}</div></div>
      <div style="text-align:right"><div style="font-size:9px;color:#666;background:#f5f5f5;padding:3px 8px;border-radius:3px">Estimation Number #${doc.nomorEstimasi||''}</div>
        <div style="font-size:10px;margin-top:4px"><span style="color:#666">Nama Petugas:</span> <strong style="font-size:18px;color:#dc2626">${doc.namaPetugas||''}</strong></div>
        ${doc.confirmedBy?`<div style="font-size:9px;color:#10b981;margin-top:2px">✓ Confirmed by ${doc.confirmedBy}</div>`:''}</div>
    </div>
    <div style="font-size:10px;color:#666;margin-bottom:8px;padding:6px 10px;background:#fafafa;border:1px solid #eee;border-radius:4px"><strong>Tujuan</strong><br>Lembaran estimasi anggaran ini di buat untuk menghitung anggaran yang akan dikeluarkan untuk keperluan operasional dan gaji pada periode yang bersangkutan.</div>
    <div style="display:flex;gap:8px;margin-bottom:8px;font-size:11px"><span style="color:#dc2626;font-weight:700">Periode ${doc.tahun||''}</span><span style="font-weight:700">${doc.periode||''}</span></div>
    <div style="position:relative">
      ${isSelesai ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:64px;font-weight:900;color:rgba(100,116,139,.08);pointer-events:none;white-space:nowrap;letter-spacing:10px;font-style:italic;z-index:2">SELESAI</div>` : ''}
      <table><thead><tr style="background:#dc2626;color:#fff">
        <th style="padding:6px;font-size:9px;text-align:left">Nama barang</th><th style="padding:6px;font-size:9px;width:40px">QTY</th><th style="padding:6px;font-size:9px;width:50px">Satuan</th>
        <th style="padding:6px;font-size:9px;text-align:left">Keterangan</th><th style="padding:6px;font-size:9px;text-align:right;width:90px">Harga (IDR)</th>
        <th style="padding:6px;font-size:9px;text-align:right;width:100px;background:rgba(0,0,0,.1)">Total Harga</th>
        <th style="padding:6px;font-size:9px;text-align:right;width:100px;background:rgba(255,255,255,.1)">Alokasi Dana Real</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#fef2f2;font-weight:700"><td colspan="4"></td><td style="padding:6px;text-align:right;color:#dc2626">Total Kebutuhan</td><td style="padding:6px;text-align:right;font-size:12px;color:#dc2626">${rpP(itemsTotal)}</td><td></td></tr>
        <tr><td colspan="4"></td><td style="padding:4px 6px;text-align:right;font-size:10px;color:#666">Sisa Periode Sebelumnya</td><td style="padding:4px 6px;text-align:right;font-size:10px;color:#10b981;font-weight:600">${rpP(sisaPeriode)}</td><td></td></tr>
        <tr style="background:#eef2ff"><td colspan="4"></td><td style="padding:5px 6px;text-align:right;font-size:10px;font-weight:700;color:#4f46e5">Request Dana</td><td style="padding:5px 6px;text-align:right;font-size:11px;font-weight:700;color:#4f46e5">${requestDana>0?rpP(requestDana):'0,- (surplus)'}</td><td></td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px">Cash ${rpP(doc.cash||0)}</td><td></td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px">ATM. ${rpP(doc.atm||0)}</td><td></td></tr>
        <tr><td colspan="5"></td><td style="padding:3px 6px;text-align:right;font-size:10px;color:#666">Total Dana ${rpP(totalDana)}</td><td></td></tr>
        <tr><td colspan="5"></td><td style="padding:4px 6px;text-align:right;font-size:11px;font-weight:700;color:${sisaUang>=0?'#10b981':'#dc2626'}">SISA ${sisaUang<0?'- ':''}${rpP(Math.abs(sisaUang))}</td><td></td></tr>
      </tfoot></table>
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
    printAnggaran, kirimWA, _startEdit, _onEditKey, _liveCalc, _saveMeta, _addRows, _updateFooter,
    flushPendingEdit };
})(); }
