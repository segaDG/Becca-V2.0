/* ============================================
   BECCA V2.0 — Inventory Module
   Depends: db.js, utils.js, modal.js, notify.js, auth.js

   Schemas:
   - InventoryItem (produk/bahan):
     { id, nama, satuan, kategori, stokMin, hargaSatuan, keterangan }
   - InventoryLog (transaksi stok):
     { id, tgl, itemId, itemNama, jenis ('MASUK'|'KELUAR'|'OPNAME'),
       jumlah, stokAkhir, harga, supplier, catatan, createdBy }
============================================ */

const InventoryModule = (() => {

  let _items   = [];   // master barang
  let _logs    = [];   // transaksi
  let _activeTab = 'stok';
  let _filterKat = '';

  const KATEGORIS = ['Bahan Baku','Bumbu','Minuman','Kemasan','Peralatan','Lain-lain'];
  const SATUANS   = ['kg','gr','liter','ml','pcs','pack','karton','lusin','botol','sachet'];

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-inventory');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Inventory</h2>
          <p>Manajemen stok bahan dan barang</p>
        </div>
        <div class="page-header-right">
          ${Auth.can('inventory','edit') ? `
            <button class="btn btn-ghost" onclick="InventoryModule.openTransaksiModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Transaksi Stok
            </button>
            <button class="btn btn-primary" onclick="InventoryModule.openItemModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Barang Baru
            </button>
          ` : ''}
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn active" data-tab="stok"     onclick="InventoryModule.switchTab('stok')">📦 Stok Barang</button>
        <button class="tab-btn"        data-tab="transaksi" onclick="InventoryModule.switchTab('transaksi')">📋 Riwayat Transaksi</button>
        <button class="tab-btn"        data-tab="alert"     onclick="InventoryModule.switchTab('alert')">⚠️ Stok Menipis</button>
      </div>

      <div id="inv-tab-stok"></div>
      <div id="inv-tab-transaksi" class="hidden"></div>
      <div id="inv-tab-alert"     class="hidden"></div>
    `;

    [_items, _logs] = await Promise.all([
      DB.getInventoryItems(),
      DB.getInventory(),
    ]);

    // Hitung stok setiap item dari logs
    _recalcStok();
    switchTab('stok');
  }

  /* ===================== HITUNG STOK ===================== */
  function _recalcStok() {
    _items.forEach(item => {
      const logsItem = _logs.filter(l => l.itemId === item.id);
      item._stok = logsItem.reduce((acc, l) => {
        if (l.jenis === 'MASUK')  return acc + (l.jumlah || 0);
        if (l.jenis === 'KELUAR') return acc - (l.jumlah || 0);
        if (l.jenis === 'OPNAME') return l.stokAkhir || acc;
        return acc;
      }, 0);
    });
  }

  /* ===================== TAB SWITCH ===================== */
  function switchTab(tab) {
    _activeTab = tab;
    ['stok','transaksi','alert'].forEach(t => {
      document.getElementById(`inv-tab-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    const renders = { stok: renderStok, transaksi: renderTransaksi, alert: renderAlert };
    renders[tab]?.();
  }

  /* ===================== TAB: STOK BARANG ===================== */
  function renderStok() {
    let filtered = _items;
    if (_filterKat) filtered = filtered.filter(i => i.kategori === _filterKat);

    const totalNilai = filtered.reduce((a, i) => a + (i._stok || 0) * (i.hargaSatuan || 0), 0);

    document.getElementById('inv-tab-stok').innerHTML = `
      <!-- Stats -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
          { l:'Total Jenis Barang', v: _items.length, c:'var(--primary-h)' },
          { l:'Ditampilkan',        v: filtered.length, c:'var(--text-1)' },
          { l:'Nilai Stok',         v: Utils.formatRupiah(totalNilai, true), c:'var(--success)' },
          { l:'Stok Menipis',       v: _items.filter(i => (i._stok||0) <= (i.stokMin||0)).length, c:'var(--warning)' },
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:160px">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:18px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>

      <!-- Filter -->
      <div class="filter-bar">
        <button class="btn btn-sm ${!_filterKat?'btn-primary':'btn-ghost'}"
                onclick="InventoryModule.setKatFilter('')">Semua</button>
        ${KATEGORIS.map(k => `
          <button class="btn btn-sm ${_filterKat===k?'btn-primary':'btn-ghost'}"
                  onclick="InventoryModule.setKatFilter('${k}')">${k}</button>
        `).join('')}
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th>Satuan</th>
                <th class="num">Stok Sekarang</th>
                <th class="num">Stok Min</th>
                <th class="num">Harga Satuan</th>
                <th class="num">Nilai Stok</th>
                <th>Status</th>
                ${Auth.can('inventory','edit') ? '<th>Aksi</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${filtered.length ? filtered.map((item, i) => {
                const stok    = item._stok || 0;
                const min     = item.stokMin || 0;
                const nilai   = stok * (item.hargaSatuan || 0);
                const isLow   = stok <= min;
                const isEmpty = stok <= 0;
                return `
                  <tr>
                    <td class="text-muted text-small">${i+1}</td>
                    <td>
                      <div class="font-semibold">${item.nama}</div>
                      ${item.keterangan ? `<div class="text-small text-muted">${item.keterangan}</div>` : ''}
                    </td>
                    <td><span class="badge badge-neutral">${item.kategori||'-'}</span></td>
                    <td class="text-muted text-small">${item.satuan||'-'}</td>
                    <td class="num font-semibold" style="color:${isEmpty?'var(--danger)':isLow?'var(--warning)':'var(--success)'}">
                      ${Utils.formatNumber ? Utils.formatNumber(stok) : stok} ${item.satuan||''}
                    </td>
                    <td class="num text-muted text-small">${min} ${item.satuan||''}</td>
                    <td class="num text-small">${Utils.formatRupiah(item.hargaSatuan||0)}</td>
                    <td class="num text-small">${Utils.formatRupiah(nilai)}</td>
                    <td>
                      <span class="badge ${isEmpty?'badge-danger':isLow?'badge-warning':'badge-success'}">
                        ${isEmpty ? '❌ Habis' : isLow ? '⚠️ Menipis' : '✅ Aman'}
                      </span>
                    </td>
                    ${Auth.can('inventory','edit') ? `
                      <td class="actions">
                        <div style="display:flex;gap:4px">
                          <button class="btn-icon" title="Edit Barang"
                                  onclick="InventoryModule.openItemModal('${item.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button class="btn-icon" title="Tambah Transaksi" style="color:var(--primary-h)"
                                  onclick="InventoryModule.openTransaksiModal('${item.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M12 5v14M5 12h14"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="10" style="text-align:center;padding:40px;color:var(--text-3)">
                    Belum ada data barang
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function setKatFilter(kat) {
    _filterKat = kat;
    renderStok();
  }

  /* ===================== TAB: TRANSAKSI ===================== */
  function renderTransaksi() {
    const sorted = [..._logs].sort((a, b) => b.tgl?.localeCompare(a.tgl));

    document.getElementById('inv-tab-transaksi').innerHTML = `
      <div class="filter-bar" style="margin-bottom:var(--s4)">
        <span class="text-muted text-small" style="margin-left:auto">${sorted.length} transaksi</span>
        ${Auth.can('inventory','edit') ? `
          <button class="btn btn-primary btn-sm" onclick="InventoryModule.openTransaksiModal()">
            + Transaksi Baru
          </button>
        ` : ''}
      </div>

      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tanggal</th>
                <th>Nama Barang</th>
                <th>Jenis</th>
                <th class="num">Jumlah</th>
                <th class="num">Stok Akhir</th>
                <th class="num">Harga Sat.</th>
                <th>Supplier/Catatan</th>
                <th>Dicatat Oleh</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.length ? sorted.map((log, i) => {
                const item   = _items.find(it => it.id === log.itemId);
                const satuan = item?.satuan || '';
                const jenisCls = log.jenis === 'MASUK' ? 'badge-success' :
                                 log.jenis === 'KELUAR' ? 'badge-danger' : 'badge-neutral';
                return `
                  <tr>
                    <td class="text-muted text-small">${i+1}</td>
                    <td style="white-space:nowrap">${Utils.formatDate ? Utils.formatDate(log.tgl,'dd/mm/yyyy') : log.tgl}</td>
                    <td class="font-semibold">${log.itemNama||'-'}</td>
                    <td><span class="badge ${jenisCls}">${log.jenis}</span></td>
                    <td class="num">${log.jumlah||0} ${satuan}</td>
                    <td class="num text-muted">${log.stokAkhir != null ? log.stokAkhir + ' ' + satuan : '-'}</td>
                    <td class="num text-small">${log.harga ? Utils.formatRupiah(log.harga) : '-'}</td>
                    <td class="text-small text-muted">${log.supplier||log.catatan||'-'}</td>
                    <td class="text-small text-muted">${log.createdBy||'-'}</td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="9" style="text-align:center;padding:40px;color:var(--text-3)">
                    Belum ada transaksi
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /* ===================== TAB: STOK MENIPIS ===================== */
  function renderAlert() {
    const low = _items.filter(i => (i._stok || 0) <= (i.stokMin || 0));

    document.getElementById('inv-tab-alert').innerHTML = `
      ${low.length === 0 ? `
        <div class="empty-state" style="height:40vh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h4>Semua Stok Aman</h4>
          <p>Tidak ada barang yang perlu direstok saat ini.</p>
        </div>
      ` : `
        <div style="background:var(--warning-bg,#fef9ec);border:1px solid var(--warning);border-radius:var(--r-md);
                    padding:12px 16px;margin-bottom:var(--s4);color:var(--warning);font-size:13px">
          ⚠️ <strong>${low.length} barang</strong> perlu segera direstok
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>#</th><th>Nama Barang</th><th>Kategori</th>
                <th class="num">Stok Sekarang</th><th class="num">Stok Min</th>
                <th class="num">Kekurangan</th><th>Status</th>
                ${Auth.can('inventory','edit') ? '<th>Aksi</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${low.map((item, i) => {
                const stok     = item._stok || 0;
                const min      = item.stokMin || 0;
                const kurang   = min - stok;
                const isEmpty  = stok <= 0;
                return `
                  <tr>
                    <td>${i+1}</td>
                    <td class="font-semibold">${item.nama}</td>
                    <td><span class="badge badge-neutral">${item.kategori||'-'}</span></td>
                    <td class="num" style="color:${isEmpty?'var(--danger)':'var(--warning)'}">
                      ${stok} ${item.satuan||''}
                    </td>
                    <td class="num text-muted">${min} ${item.satuan||''}</td>
                    <td class="num" style="color:var(--danger);font-weight:600">
                      ${kurang > 0 ? kurang + ' ' + (item.satuan||'') : 'Habis!'}
                    </td>
                    <td>
                      <span class="badge ${isEmpty?'badge-danger':'badge-warning'}">
                        ${isEmpty ? '❌ Habis' : '⚠️ Menipis'}
                      </span>
                    </td>
                    ${Auth.can('inventory','edit') ? `
                      <td>
                        <button class="btn btn-sm btn-primary"
                                onclick="InventoryModule.openTransaksiModal('${item.id}','MASUK')">
                          + Restok
                        </button>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  }

  /* ===================== MODAL: BARANG ===================== */
  function openItemModal(editId = null) {
    const existing = editId ? _items.find(i => i.id === editId) : null;
    const d = existing || {};

    const mid = Modal.open({
      title: editId ? 'Edit Barang' : 'Tambah Barang Baru',
      size:  'modal-md',
      body: `
        <form id="inv-item-form">
          <div class="form-group">
            <label class="form-label">Nama Barang <span class="req">*</span></label>
            <input name="nama" class="form-control" value="${d.nama||''}" required placeholder="Contoh: Minyak Goreng Tropical">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <select name="kategori" class="form-control">
                <option value="">— Pilih —</option>
                ${KATEGORIS.map(k => `<option value="${k}" ${d.kategori===k?'selected':''}>${k}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Satuan <span class="req">*</span></label>
              <select name="satuan" class="form-control" required>
                <option value="">— Pilih —</option>
                ${SATUANS.map(s => `<option value="${s}" ${d.satuan===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Stok Minimum</label>
              <input name="stokMin" type="number" min="0" class="form-control" value="${d.stokMin||0}">
            </div>
            <div class="form-group">
              <label class="form-label">Harga Satuan (Rp)</label>
              <input name="hargaSatuan" type="number" min="0" class="form-control" value="${d.hargaSatuan||0}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Keterangan</label>
            <input name="keterangan" class="form-control" value="${d.keterangan||''}" placeholder="Opsional">
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="InventoryModule._submitItem('${mid||'__mid'}','${editId||''}')">
          ${editId ? 'Simpan Perubahan' : 'Tambah Barang'}
        </button>
      `,
    });
    return mid;
  }

  async function _submitItem(modalId, editId = '') {
    const fd   = new FormData(document.getElementById('inv-item-form'));
    const data = Object.fromEntries(fd.entries());

    if (!data.nama || !data.satuan) {
      Notify.warning('Nama dan Satuan wajib diisi');
      return;
    }
    data.stokMin     = parseInt(data.stokMin) || 0;
    data.hargaSatuan = parseInt(data.hargaSatuan) || 0;
    if (editId) data.id = editId;

    try {
      const saved = await DB.saveInventoryItem(data);
      const idx   = _items.findIndex(i => i.id === saved.id);
      if (idx >= 0) _items[idx] = { ..._items[idx], ...saved };
      else          _items.unshift({ ...saved, _stok: 0 });

      _recalcStok();
      renderStok();
      Modal.close(modalId);
      Notify.success(editId ? 'Barang diperbarui' : 'Barang ditambahkan');
    } catch (err) {
      Notify.error('Gagal menyimpan', err.message);
    }
  }

  /* ===================== MODAL: TRANSAKSI ===================== */
  function openTransaksiModal(preItemId = null, preJenis = '') {
    const itemOpts = _items
      .map(i => `<option value="${i.id}" ${preItemId===i.id?'selected':''}>${i.nama} (${i.satuan||''})</option>`)
      .join('');

    const today = Utils.today ? Utils.today() : new Date().toISOString().split('T')[0];

    const mid = Modal.open({
      title: 'Transaksi Stok',
      size:  'modal-md',
      body: `
        <form id="inv-log-form">
          <div class="form-group">
            <label class="form-label">Barang <span class="req">*</span></label>
            <select name="itemId" class="form-control" required onchange="InventoryModule._onItemChange(this)">
              <option value="">— Pilih Barang —</option>
              ${itemOpts}
            </select>
            <div id="inv-stok-preview" style="margin-top:6px;font-size:12px;color:var(--text-3)"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Jenis Transaksi <span class="req">*</span></label>
              <select name="jenis" class="form-control" required>
                <option value="MASUK"  ${preJenis==='MASUK' ?'selected':''}>📥 Stok Masuk</option>
                <option value="KELUAR" ${preJenis==='KELUAR'?'selected':''}>📤 Stok Keluar</option>
                <option value="OPNAME" ${preJenis==='OPNAME'?'selected':''}>🔢 Stock Opname</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tanggal <span class="req">*</span></label>
              <input name="tgl" type="date" class="form-control" value="${today}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" id="inv-jumlah-label">Jumlah <span class="req">*</span></label>
              <input name="jumlah" type="number" min="0" step="0.01" class="form-control" required placeholder="0">
            </div>
            <div class="form-group">
              <label class="form-label">Harga Satuan (Rp)</label>
              <input name="harga" type="number" min="0" class="form-control" placeholder="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Supplier</label>
              <input name="supplier" class="form-control" placeholder="Nama supplier (jika ada)">
            </div>
            <div class="form-group">
              <label class="form-label">Catatan</label>
              <input name="catatan" class="form-control" placeholder="Opsional">
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="InventoryModule._submitTransaksi('${mid||'__mid'}')">
          Simpan Transaksi
        </button>
      `,
    });

    // Trigger preview jika preItemId sudah dipilih
    if (preItemId) {
      setTimeout(() => {
        const sel = document.querySelector('#inv-log-form [name="itemId"]');
        if (sel) { sel.value = preItemId; _onItemChange(sel); }
      }, 100);
    }

    return mid;
  }

  function _onItemChange(sel) {
    const item    = _items.find(i => i.id === sel.value);
    const preview = document.getElementById('inv-stok-preview');
    if (item && preview) {
      preview.textContent = `Stok sekarang: ${item._stok || 0} ${item.satuan||''}  |  Min: ${item.stokMin||0}`;
    }
  }

  async function _submitTransaksi(modalId) {
    const fd   = new FormData(document.getElementById('inv-log-form'));
    const data = Object.fromEntries(fd.entries());

    if (!data.itemId || !data.tgl || !data.jumlah) {
      Notify.warning('Barang, Tanggal, dan Jumlah wajib diisi');
      return;
    }

    const item     = _items.find(i => i.id === data.itemId);
    data.itemNama  = item?.nama || '';
    data.jumlah    = parseFloat(data.jumlah) || 0;
    data.harga     = parseInt(data.harga) || 0;

    // Hitung stok akhir
    const stokNow  = item?._stok || 0;
    if (data.jenis === 'MASUK')       data.stokAkhir = stokNow + data.jumlah;
    else if (data.jenis === 'KELUAR') data.stokAkhir = stokNow - data.jumlah;
    else                              data.stokAkhir = data.jumlah; // OPNAME = set langsung

    data.createdBy = Auth.currentUser?.()?.nama || '';

    try {
      const saved = await DB.saveInventory(data);
      _logs.unshift(saved);
      _recalcStok();

      // Re-render tab aktif
      const renders = { stok: renderStok, transaksi: renderTransaksi, alert: renderAlert };
      renders[_activeTab]?.();

      Modal.close(modalId);
      Notify.success(`Transaksi ${data.jenis} berhasil dicatat`);
    } catch (err) {
      Notify.error('Gagal menyimpan transaksi', err.message);
    }
  }

  /* ===================== PUBLIC API ===================== */
  return {
    init,
    switchTab,
    setKatFilter,
    openItemModal,
    _submitItem,
    openTransaksiModal,
    _onItemChange,
    _submitTransaksi,
  };

})();

window.InventoryModule = InventoryModule;
