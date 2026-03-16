/* ============================================
   BECCA V2.0 — Kas Kecil Module
   Depends: db.js, utils.js, modal.js, notify.js
   Data schema: { id, tgl, nama, type, vendor, qty, satuan,
                  hargaSatuan, jumlah, penerima, status, bulan,
                  createdAt, createdBy }
   ============================================ */

const KasModule = (() => {
  let _kas = [];
  let _masuk = [];
  let _activeTab = 'transaksi';
  let _filter = { bulan: '', type: '', status: '', dateFrom: '', dateTo: '' };
  let _page = 1;
  const _perPage = 100;

  const TYPES = ['Raw Food','Sayuran','Buah segar','Raw Materials','Minuman','Snack',
                 'Kasbon','Gaji','Bensin','Maintenance','OP.Expense','B.Logistik',
                 'Listrik PLN','PDAM','Pulsa','Pajak','Kas','Lain-lain'];
  const SATUANS = ['Kg','Pcs','Bks','Box','Btl','Kli','Prsi','Gbng','Ikt','Lbr',
                   'Pack','Bag','Ltr','Unit','Rim','Rol','Sak','Dus'];

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-kas');
    page.innerHTML = _renderShell();
    [_kas, _masuk] = await Promise.all([DB.getKas(), DB.getKasMasuk()]);
    switchTab('transaksi');
  }

  function _renderShell() {
    return `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Kas Kecil</h2>
          <p>Manajemen kas operasional harian</p>
        </div>
        <div class="page-header-right">
          ${Auth.can('kas','edit') ? `<button class="btn btn-primary" onclick="KasModule.openFormModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg>
            Tambah Transaksi
          </button>` : ''}
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="transaksi" onclick="KasModule.switchTab('transaksi')">📒 Transaksi</button>
        <button class="tab-btn" data-tab="summary"    onclick="KasModule.switchTab('summary')">📊 Summary</button>
        <button class="tab-btn" data-tab="monthly"    onclick="KasModule.switchTab('monthly')">📅 Monthly Report</button>
        <button class="tab-btn" data-tab="cashflow"   onclick="KasModule.switchTab('cashflow')">💸 Cash Flow</button>
      </div>
      <div id="kas-tab-transaksi"></div>
      <div id="kas-tab-summary"  class="hidden"></div>
      <div id="kas-tab-monthly"  class="hidden"></div>
      <div id="kas-tab-cashflow" class="hidden"></div>
    `;
  }

  function switchTab(tab) {
    _activeTab = tab;
    ['transaksi','summary','monthly','cashflow'].forEach(t => {
      document.getElementById(`kas-tab-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    const renders = { transaksi: renderTransaksi, summary: renderSummary, monthly: renderMonthly, cashflow: renderCashflow };
    renders[tab]?.();
  }

  /* ===================== TRANSAKSI TAB ===================== */
  function renderTransaksi() {
    const filtered = _applyFilter(_kas);
    const total    = filtered.length;
    const start    = (_page-1)*_perPage;
    const paged    = filtered.slice(start, start+_perPage);
    const totalPages = Math.ceil(total/_perPage);

    const sumJumlah = filtered.reduce((s,r) => s + (r.jumlah||0), 0);
    const bulanOpts = [...new Set(_kas.map(r => r.bulan).filter(Boolean))].sort();

    document.getElementById('kas-tab-transaksi').innerHTML = `
      <!-- Summary strip -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${_summaryStrip(filtered)}
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <input type="date" class="form-control" placeholder="Dari" value="${_filter.dateFrom}"
          onchange="KasModule.setFilter('dateFrom',this.value)" style="width:140px">
        <input type="date" class="form-control" placeholder="Sampai" value="${_filter.dateTo}"
          onchange="KasModule.setFilter('dateTo',this.value)" style="width:140px">
        <select class="form-control" onchange="KasModule.setFilter('bulan',this.value)" style="width:130px">
          <option value="">Semua Bulan</option>
          ${bulanOpts.map(b => `<option value="${b}" ${_filter.bulan===b?'selected':''}>${b}</option>`).join('')}
        </select>
        <select class="form-control" onchange="KasModule.setFilter('type',this.value)" style="width:150px">
          <option value="">Semua Type</option>
          ${TYPES.map(t => `<option value="${t}" ${_filter.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <select class="form-control" onchange="KasModule.setFilter('status',this.value)" style="width:120px">
          <option value="">Semua Status</option>
          <option value="DONE"  ${_filter.status==='DONE' ?'selected':''}>DONE</option>
          <option value="TBC"   ${_filter.status==='TBC'  ?'selected':''}>TBC</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="KasModule.resetFilter()">↺ Reset</button>
        <span class="text-muted text-small" style="margin-left:auto">${total} transaksi · ${Utils.formatRupiah(sumJumlah)}</span>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>#</th><th>Tanggal</th><th>Nama Barang</th><th>Type</th>
                <th>Vendor</th><th class="num">Qty</th><th>Sat</th>
                <th class="num">Harga/Sat</th><th>Penerima</th>
                <th class="num">Jumlah</th><th>Status</th>
                ${Auth.can('kas','edit') ? '<th>Aksi</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${paged.length ? paged.map((r,i) => `
                <tr>
                  <td class="text-muted text-small">${start+i+1}</td>
                  <td style="white-space:nowrap">${Utils.formatDate(r.tgl,'dd/mm/yyyy')}</td>
                  <td><span class="font-medium">${r.nama}</span></td>
                  <td><span class="badge ${_typeBadge(r.type)}">${r.type}</span></td>
                  <td class="text-muted text-small">${r.vendor||'-'}</td>
                  <td class="num">${r.qty||0}</td>
                  <td class="text-muted text-small">${r.satuan||''}</td>
                  <td class="num">${Utils.formatRupiah(r.hargaSatuan)}</td>
                  <td class="text-muted text-small">${r.penerima||'-'}</td>
                  <td class="num"><strong>${Utils.formatRupiah(r.jumlah)}</strong></td>
                  <td><span class="badge ${r.status==='DONE'?'badge-success':'badge-warning'}">${r.status}</span></td>
                  ${Auth.can('kas','edit') ? `
                  <td class="actions">
                    <div style="display:flex;gap:4px">
                      <button class="btn-icon" title="Edit" onclick="KasModule.editRow('${r.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon" title="Hapus" onclick="KasModule.deleteRow('${r.id}')" style="color:var(--danger)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </td>` : ''}
                </tr>
              `).join('') : `<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--text-3)">Tidak ada data</td></tr>`}
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="pagination">
          <span class="pagination-info">Halaman ${_page} dari ${totalPages} · ${total} data</span>
          <div class="pagination-controls">
            <button class="page-btn" onclick="KasModule.goPage(${_page-1})" ${_page<=1?'disabled':''}>‹</button>
            ${_pageButtons(totalPages)}
            <button class="page-btn" onclick="KasModule.goPage(${_page+1})" ${_page>=totalPages?'disabled':''}>›</button>
          </div>
        </div>
      </div>
    `;
  }

  function _summaryStrip(data) {
    const done = data.filter(r=>r.status==='DONE');
    const tbc  = data.filter(r=>r.status==='TBC');
    const cards = [
      { label:'Total Keluar', val: Utils.formatRupiah(data.reduce((s,r)=>s+(r.jumlah||0),0),true), color:'var(--danger)' },
      { label:'Confirmed',    val: Utils.formatRupiah(done.reduce((s,r)=>s+(r.jumlah||0),0),true), color:'var(--success)' },
      { label:'TBC',          val: Utils.formatRupiah(tbc.reduce((s,r)=>s+(r.jumlah||0),0),true),  color:'var(--warning)' },
      { label:'Transaksi',    val: data.length, color:'var(--primary-h)' },
    ];
    return cards.map(c => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:140px">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${c.label}</div>
        <div style="font-size:18px;font-weight:700;color:${c.color};font-family:var(--font-mono)">${c.val}</div>
      </div>
    `).join('');
  }

  function _typeBadge(type) {
    const map = {
      'Gaji':'badge-info','Kasbon':'badge-warning','Raw Food':'badge-success',
      'Sayuran':'badge-success','Buah segar':'badge-success','Snack':'badge-neutral',
      'Bensin':'badge-neutral','Maintenance':'badge-neutral',
    };
    return map[type] || 'badge-neutral';
  }

  function _pageButtons(total) {
    if (total <= 7) {
      return Array.from({length:total}, (_,i) =>
        `<button class="page-btn ${_page===i+1?'active':''}" onclick="KasModule.goPage(${i+1})">${i+1}</button>`
      ).join('');
    }
    // Simplified: prev ... current ... next
    return `
      <button class="page-btn ${_page===1?'active':''}" onclick="KasModule.goPage(1)">1</button>
      ${_page > 3 ? '<span style="padding:0 4px;color:var(--text-3)">…</span>' : ''}
      ${_page > 2 ? `<button class="page-btn" onclick="KasModule.goPage(${_page-1})">${_page-1}</button>` : ''}
      ${_page !== 1 && _page !== total ? `<button class="page-btn active">${_page}</button>` : ''}
      ${_page < total-1 ? `<button class="page-btn" onclick="KasModule.goPage(${_page+1})">${_page+1}</button>` : ''}
      ${_page < total-2 ? '<span style="padding:0 4px;color:var(--text-3)">…</span>' : ''}
      <button class="page-btn ${_page===total?'active':''}" onclick="KasModule.goPage(${total})">${total}</button>
    `;
  }

  /* ===================== SUMMARY TAB ===================== */
  function renderSummary() {
    const byType  = Utils.groupBy(_kas, 'type');
    const byBulan = Utils.groupBy(_kas, 'bulan');
    const bulanKeys = Object.keys(byBulan).sort();

    // Table by type
    const typeRows = Object.entries(byType)
      .map(([type, rows]) => ({ type, total: Utils.sumBy(rows,'jumlah'), count: rows.length }))
      .sort((a,b) => b.total - a.total);

    const grandTotal = typeRows.reduce((s,r) => s+r.total, 0);

    document.getElementById('kas-tab-summary').innerHTML = `
      <div class="grid-2" style="gap:var(--s5)">
        <!-- By Type -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Pengeluaran per Kategori</div>
          </div>
          <table class="table">
            <thead><tr><th>Kategori</th><th class="num">Jumlah</th><th class="num">Transaksi</th><th class="num">%</th></tr></thead>
            <tbody>
              ${typeRows.map(r => `
                <tr>
                  <td><span class="badge ${_typeBadge(r.type)}">${r.type}</span></td>
                  <td class="num">${Utils.formatRupiah(r.total)}</td>
                  <td class="num text-muted">${r.count}</td>
                  <td class="num">
                    <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
                      <div style="width:60px;height:4px;background:var(--border);border-radius:2px">
                        <div style="width:${Math.round(r.total/grandTotal*100)}%;height:100%;background:var(--primary);border-radius:2px"></div>
                      </div>
                      <span class="text-small">${Math.round(r.total/grandTotal*100)}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')}
              <tr style="background:var(--surface2)">
                <td><strong>TOTAL</strong></td>
                <td class="num"><strong>${Utils.formatRupiah(grandTotal)}</strong></td>
                <td class="num text-muted">${_kas.length}</td>
                <td class="num">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- By Month -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Pengeluaran per Bulan</div>
          </div>
          <table class="table">
            <thead><tr><th>Bulan</th><th class="num">Total Keluar</th><th class="num">Transaksi</th></tr></thead>
            <tbody>
              ${bulanKeys.map(bulan => {
                const rows = byBulan[bulan];
                const total = Utils.sumBy(rows, 'jumlah');
                return `
                  <tr>
                    <td><strong>${bulan}</strong></td>
                    <td class="num">${Utils.formatRupiah(total)}</td>
                    <td class="num text-muted">${rows.length}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ===================== MONTHLY REPORT ===================== */
  function renderMonthly() {
    const bulanOpts = [...new Set(_kas.map(r=>r.bulan).filter(Boolean))].sort();
    const sel = bulanOpts[bulanOpts.length-1] || '';

    document.getElementById('kas-tab-monthly').innerHTML = `
      <div class="filter-bar" style="margin-bottom:var(--s5)">
        <select class="form-control" id="monthly-bulan-sel" style="width:160px" onchange="KasModule.renderMonthlyTable(this.value)">
          ${bulanOpts.map(b => `<option value="${b}" ${b===sel?'selected':''}>${b}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ Print / PDF</button>
      </div>
      <div id="monthly-table-wrap"></div>
    `;
    renderMonthlyTable(sel);
  }

  function renderMonthlyTable(bulan) {
    const rows = _kas.filter(r => r.bulan === bulan);
    const byType = Utils.groupBy(rows, 'type');
    const grandTotal = Utils.sumBy(rows, 'jumlah');

    document.getElementById('monthly-table-wrap').innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Laporan Kas Kecil — ${bulan}</div>
          <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--danger)">${Utils.formatRupiah(grandTotal)}</div>
        </div>
        ${Object.entries(byType).sort((a,b)=>Utils.sumBy(b[1],'jumlah')-Utils.sumBy(a[1],'jumlah')).map(([type,items]) => `
          <div style="margin-bottom:var(--s4)">
            <div class="section-title" style="display:flex;justify-content:space-between">
              <span>${type}</span>
              <span style="font-family:var(--font-mono)">${Utils.formatRupiah(Utils.sumBy(items,'jumlah'))}</span>
            </div>
            <table class="table" style="font-size:12px">
              <thead><tr><th>Tgl</th><th>Nama</th><th>Vendor</th><th class="num">Qty</th><th>Sat</th><th class="num">Harga</th><th class="num">Total</th><th>Status</th></tr></thead>
              <tbody>
                ${items.map(r => `
                  <tr>
                    <td style="white-space:nowrap">${Utils.formatDate(r.tgl,'dd/mm/yyyy')}</td>
                    <td>${r.nama}</td>
                    <td class="text-muted">${r.vendor||'-'}</td>
                    <td class="num">${r.qty||0}</td>
                    <td class="text-muted">${r.satuan||''}</td>
                    <td class="num">${Utils.formatRupiah(r.hargaSatuan)}</td>
                    <td class="num"><strong>${Utils.formatRupiah(r.jumlah)}</strong></td>
                    <td><span class="badge ${r.status==='DONE'?'badge-success':'badge-warning'}">${r.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ===================== CASH FLOW TAB ===================== */
  function renderCashflow() {
    // Gabungkan kas masuk & keluar per tanggal
    const masukByDate = {};
    _masuk.forEach(r => {
      masukByDate[r.tgl] = (masukByDate[r.tgl]||0) + r.kredit;
    });
    const keluarByDate = {};
    _kas.filter(r=>r.status==='DONE').forEach(r => {
      keluarByDate[r.tgl] = (keluarByDate[r.tgl]||0) + r.jumlah;
    });

    const allDates = [...new Set([...Object.keys(masukByDate),...Object.keys(keluarByDate)])].sort();
    let balance = 0;
    const rows = allDates.map(tgl => {
      const masuk  = masukByDate[tgl] || 0;
      const keluar = keluarByDate[tgl] || 0;
      balance += masuk - keluar;
      return { tgl, masuk, keluar, balance };
    });

    const totalMasuk  = Utils.sumBy(rows,'masuk');
    const totalKeluar = Utils.sumBy(rows,'keluar');
    const netBalance  = totalMasuk - totalKeluar;

    document.getElementById('kas-tab-cashflow').innerHTML = `
      <!-- Summary -->
      <div class="grid-3" style="margin-bottom:var(--s5)">
        <div class="stat-card green">
          <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
          <div class="stat-value">${Utils.formatRupiah(totalMasuk,true)}</div>
          <div class="stat-label">Total Kas Masuk</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>
          <div class="stat-value">${Utils.formatRupiah(totalKeluar,true)}</div>
          <div class="stat-label">Total Kas Keluar</div>
        </div>
        <div class="stat-card ${netBalance>=0?'green':'red'}">
          <div class="stat-icon ${netBalance>=0?'green':'red'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/></svg></div>
          <div class="stat-value" style="color:${netBalance>=0?'var(--success)':'var(--danger)'}">${Utils.formatRupiah(Math.abs(netBalance),true)}</div>
          <div class="stat-label">${netBalance>=0?'Surplus':'Defisit'}</div>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th class="num" style="color:var(--success)">Kas Masuk</th>
                <th class="num" style="color:var(--danger)">Kas Keluar</th>
                <th class="num">Net</th>
                <th class="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => {
                const net = r.masuk - r.keluar;
                return `
                  <tr>
                    <td style="white-space:nowrap">${Utils.formatDate(r.tgl,'dd mmm yyyy')}</td>
                    <td class="num" style="color:var(--success)">${r.masuk ? Utils.formatRupiah(r.masuk) : '-'}</td>
                    <td class="num" style="color:var(--danger)">${r.keluar ? Utils.formatRupiah(r.keluar) : '-'}</td>
                    <td class="num" style="color:${net>=0?'var(--success)':'var(--danger)'};font-weight:600">${net!==0 ? Utils.formatRupiah(Math.abs(net)) : '-'}</td>
                    <td class="num">
                      <strong style="color:${r.balance>=0?'var(--text)':'var(--danger)'}">${Utils.formatRupiah(r.balance)}</strong>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ===================== FILTER & PAGINATION ===================== */
  function _applyFilter(data) {
    return data.filter(r => {
      if (_filter.bulan    && r.bulan !== _filter.bulan) return false;
      if (_filter.type     && r.type  !== _filter.type)  return false;
      if (_filter.status   && r.status!== _filter.status)return false;
      if (_filter.dateFrom && r.tgl   <  _filter.dateFrom) return false;
      if (_filter.dateTo   && r.tgl   >  _filter.dateTo)   return false;
      return true;
    });
  }

  function setFilter(key, val) { _filter[key] = val; _page = 1; renderTransaksi(); }
  function resetFilter()       { _filter = {}; _page = 1; renderTransaksi(); }
  function goPage(p)           { _page = p; renderTransaksi(); }

  /* ===================== FORM MODAL ===================== */
  function openFormModal(existing = null) {
    const isEdit = !!existing;
    const d = existing || { tgl: Utils.today(), status:'DONE', qty:1 };
    const mid = Modal.open({
      title: isEdit ? 'Edit Transaksi' : 'Tambah Transaksi Kas',
      size: 'modal-lg',
      body: `
        <form id="kas-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tanggal <span class="req">*</span></label>
              <input name="tgl" type="date" class="form-control" value="${d.tgl||Utils.today()}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Bulan</label>
              <select name="bulan" class="form-control">
                ${Utils.MONTHS.map(m => `<option value="${m}" ${d.bulan===m?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Nama Barang / Keterangan <span class="req">*</span></label>
            <input name="nama" class="form-control" value="${d.nama||''}" placeholder="Nama barang atau keterangan" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Type / Kategori <span class="req">*</span></label>
              <select name="type" class="form-control" required>
                ${TYPES.map(t => `<option value="${t}" ${d.type===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Vendor / Supplier</label>
              <input name="vendor" class="form-control" value="${d.vendor||''}" placeholder="Nama vendor">
            </div>
          </div>
          <div class="form-row-3">
            <div class="form-group">
              <label class="form-label">Qty</label>
              <input name="qty" type="number" min="0" step="0.01" class="form-control" value="${d.qty||1}"
                oninput="KasModule._calcTotal()">
            </div>
            <div class="form-group">
              <label class="form-label">Satuan</label>
              <input name="satuan" class="form-control" list="satuan-list" value="${d.satuan||''}">
              <datalist id="satuan-list">${SATUANS.map(s=>`<option value="${s}">`).join('')}</datalist>
            </div>
            <div class="form-group">
              <label class="form-label">Harga / Satuan (Rp)</label>
              <input name="hargaSatuan" type="number" min="0" class="form-control" value="${d.hargaSatuan||0}"
                oninput="KasModule._calcTotal()">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Total (Rp)</label>
              <input name="jumlah" type="number" min="0" id="kas-jumlah" class="form-control" value="${d.jumlah||0}">
            </div>
            <div class="form-group">
              <label class="form-label">Nama Penerima</label>
              <input name="penerima" class="form-control" value="${d.penerima||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <div style="display:flex;gap:var(--s4)">
              <label class="form-check"><input type="radio" name="status" value="DONE" ${(d.status||'DONE')==='DONE'?'checked':''}> <span class="form-check-label">✅ DONE</span></label>
              <label class="form-check"><input type="radio" name="status" value="TBC" ${d.status==='TBC'?'checked':''}> <span class="form-check-label">⏳ TBC</span></label>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="KasModule._submitForm('${mid}','${isEdit?d.id:''}')">
          ${isEdit ? 'Simpan Perubahan' : 'Tambah Transaksi'}
        </button>
      `,
    });
    return mid;
  }

  function _calcTotal() {
    const qty   = parseFloat(document.querySelector('[name=qty]')?.value) || 0;
    const harga = parseFloat(document.querySelector('[name=hargaSatuan]')?.value) || 0;
    const jumlahEl = document.getElementById('kas-jumlah');
    if (jumlahEl) jumlahEl.value = Math.round(qty * harga);
  }

  async function _submitForm(modalId, editId = '') {
    const form = document.getElementById('kas-form');
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!data.tgl || !data.nama || !data.type) {
      Notify.warning('Validasi gagal', 'Tanggal, Nama, dan Type wajib diisi');
      return;
    }
    // Auto-set bulan dari tgl jika kosong
    if (!data.bulan && data.tgl) {
      const m = parseInt(data.tgl.split('-')[1]) - 1;
      data.bulan = Utils.MONTHS[m];
    }
    data.qty         = parseFloat(data.qty) || 0;
    data.hargaSatuan = parseInt(data.hargaSatuan) || 0;
    data.jumlah      = parseInt(data.jumlah) || 0;
    if (editId) data.id = editId;

    try {
      const saved = await DB.saveKas(data);
      const idx = _kas.findIndex(r => r.id === saved.id);
      if (idx >= 0) _kas[idx] = saved; else _kas.unshift(saved);
      renderTransaksi();
      Modal.close(modalId);
      Notify.success(editId ? 'Transaksi diperbarui' : 'Transaksi ditambahkan');
    } catch (err) { Notify.error('Gagal simpan', err.message); }
  }

  function editRow(id) {
    const row = _kas.find(r => r.id === id);
    if (row) openFormModal(row);
  }

  async function deleteRow(id) {
    const ok = await Modal.confirm({ title:'Hapus Transaksi', message:'Data kas akan dihapus permanen.', danger:true, confirmText:'Hapus' });
    if (!ok) return;
    try {
      await DB.deleteKas(id);
      _kas = _kas.filter(r => r.id !== id);
      renderTransaksi();
      Notify.success('Transaksi dihapus');
    } catch (err) { Notify.error('Gagal', err.message); }
  }

  return {
    init, switchTab, setFilter, resetFilter, goPage,
    openFormModal, editRow, deleteRow,
    renderMonthlyTable, _calcTotal, _submitForm,
  };
})();

window.KasModule = KasModule;
