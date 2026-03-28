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

console.log('[BECCA] InventoryModule v20260327k loaded ✓');
const InventoryModule = (() => {

  let _items      = [];   // master barang
  let _itemLookup = new Map(); // id→item (String keys), always in sync with _items
  let _logs       = [];   // activity line (MASUK/KELUAR only)
  let _opnameLogs = [];   // stok opname (terpisah)
  let _activeTab   = 'stok';
  let _filterKat   = '';
  let _search      = '';
  let _laporanBulan = null; // selected month for laporan tab

  const KATEGORIS = ['Bahan Baku','Bumbu','Minuman','Kemasan','Peralatan','Sembako','Fresh','Lain-lain'];
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
        <div class="page-header-right" id="inv-header-btns">
          ${Auth.can('inventory','edit') ? `
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
        <button id="inv-tab-btn-stok" class="tab-btn active" data-tab="stok"     onclick="InventoryModule.switchTab('stok')">📦 Stok Barang</button>
        <button id="inv-tab-btn-transaksi" class="tab-btn" data-tab="transaksi" onclick="InventoryModule.switchTab('transaksi')">📋 Activity Line</button>
        <button id="inv-tab-btn-alert" class="tab-btn" data-tab="alert"     onclick="InventoryModule.switchTab('alert')">⚠️ Stok Menipis</button>
        <button id="inv-tab-btn-opname" class="tab-btn" data-tab="opname"    onclick="InventoryModule.switchTab('opname')">🔢 Stok Opname</button>
        <button id="inv-tab-btn-laporan" class="tab-btn" data-tab="laporan"  onclick="InventoryModule.switchTab('laporan')">📊 Laporan Bulanan</button>
        <button id="inv-tab-btn-summary" class="tab-btn" data-tab="summary"  onclick="InventoryModule.switchTab('summary')">📈 Summary</button>
      </div>

      <div id="inv-tab-stok"></div>
      <div id="inv-tab-transaksi" class="hidden"></div>
      <div id="inv-tab-alert"     class="hidden"></div>
      <div id="inv-tab-opname"    class="hidden"></div>
      <div id="inv-tab-laporan"   class="hidden"></div>
      <div id="inv-tab-summary"   class="hidden"></div>
    `;

    // Level 4 — gunakan cache jika warm, render segera lalu background-load jika cold
    const cachedItems  = DB.getCached('inv_products');
    const cachedLogs   = DB.getCached('inv_activities');
    const cachedOpname = DB.getCached('opname_logs');

    if (cachedItems)  _items      = cachedItems;
    if (cachedLogs)   _logs       = cachedLogs;
    if (cachedOpname) _opnameLogs = cachedOpname;

    // Reset edit state
    _invEditId = null;
    _invLogPage = 1;
    try { _invLocked = new Set(JSON.parse(localStorage.getItem(_INV_LOCK_KEY)||'[]')); } catch { _invLocked = new Set(); }

    // Render segera dengan data yang ada (cache atau kosong)
    _recalcStok();
    switchTab('stok');

    // Background-load jika ada yang cold
    if (!cachedItems || !cachedLogs || !cachedOpname) {
      const [freshItems, freshLogs, freshOpname] = await Promise.all([
        cachedItems  ? Promise.resolve(cachedItems)  : DB.getInventoryItems(),
        cachedLogs   ? Promise.resolve(cachedLogs)   : DB.getInventory(),
        cachedOpname ? Promise.resolve(cachedOpname) : (typeof DB.getOpnameLogs === 'function' ? DB.getOpnameLogs().catch(()=>[]) : Promise.resolve([])),
      ]);
      _items      = freshItems;
      _logs       = freshLogs;
      _opnameLogs = freshOpname;

      // Auto-dedup: jika ada nama barang ganda (dari double-migration), bersihkan otomatis
      _checkAndDedup();

      // Hitung stok setiap item dari logs + auto-update hargaSatuan
      _recalcStok();
      _items.forEach(item => {
        if (item._hargaTerbaru && item._hargaTerbaru !== item._savedHarga) {
          DB.saveInventoryItem({...item}).catch(()=>{});
          item._savedHarga = item._hargaTerbaru;
        }
      });
      if (_activeTab === 'stok') renderStok();
      else if (_activeTab === 'laporan') renderLaporanBulanan();
      else if (_activeTab === 'summary') renderSummary();
      else switchTab(_activeTab);
    } else {
      // Hanya simpan hargaSatuan jika cache sudah fresh
      _items.forEach(item => {
        if (item._hargaTerbaru && item._hargaTerbaru !== item._savedHarga) {
          DB.saveInventoryItem({...item}).catch(()=>{});
          item._savedHarga = item._hargaTerbaru;
        }
      });
    }
  }

  /* ===================== AUTO DEDUP ====================== */
  // Deteksi duplikat nama → jalankan DB.deduplicateInventoryProducts() sekali
  const _DEDUP_FLAG = 'becca_inv_deduped_v1';
  function _checkAndDedup() {
    if (localStorage.getItem(_DEDUP_FLAG)) return;  // sudah pernah dijalankan
    const seen = new Set();
    const hasDupe = _items.some(item => {
      const key = (item.nama || '').trim().toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (!hasDupe) {
      localStorage.setItem(_DEDUP_FLAG, '1'); // tidak ada duplikat, tandai selesai
      return;
    }
    Notify.warning('Mendeteksi duplikat barang inventory — membersihkan otomatis...');
    DB.deduplicateInventoryProducts().then(async n => {
      if (n > 0) {
        _items = await DB.getInventoryItems();
        _logs  = await DB.getInventory();
        _recalcStok();
        renderStok();
        Notify.success('Duplikat dibersihkan: ' + n + ' item dihapus dari database ✓');
      }
      localStorage.setItem(_DEDUP_FLAG, '1');
    }).catch(err => {
      console.warn('[Inventory] Dedup error:', err);
    });
  }

  /* ===================== HITUNG STOK ===================== */
  function _recalcStok() {
    // Group logs by itemId first — O(logs) instead of O(items×logs)
    const logsByItem = Object.create(null);
    for (const l of _logs) {
      if (!l.itemId) continue;
      if (!logsByItem[l.itemId]) logsByItem[l.itemId] = [];
      logsByItem[l.itemId].push(l);
    }
    // Stok hanya dari MASUK dan KELUAR - OPNAME terpisah
    _items.forEach(item => {
      const logsItem = logsByItem[item.id] || [];

      // ---- Hitung stok ----
      item._stok = logsItem.reduce((acc, l) => {
        if (l.jenis === 'MASUK')  return acc + (l.jumlah || 0);
        if (l.jenis === 'KELUAR') return acc - (l.jumlah || 0);
        return acc;
      }, 0);

      // ---- Hitung Weighted Average Price dari sisa stok (FIFO) ----
      // Sort MASUK ascending (oldest first) untuk simulasi FIFO
      const masukLogs = logsItem
        .filter(l => l.jenis === 'MASUK' && (l.harga || 0) > 0 && (l.jumlah || 0) > 0)
        .sort((a, b) => (a.tgl || '').localeCompare(b.tgl || ''));

      const totalKeluar = logsItem
        .filter(l => l.jenis === 'KELUAR')
        .reduce((s, l) => s + (l.jumlah || 0), 0);

      const currentStok = item._stok;

      if (masukLogs.length === 0 || currentStok <= 0) {
        item._weightedAvgPrice = item.hargaSatuan || 0;
      } else {
        // FIFO: consume KELUAR dari batch tertua, sisa = stok sekarang
        // Kita perlu tahu batch mana yang tersisa
        let consumed = totalKeluar;
        let remainingBatches = [];

        for (const log of masukLogs) {
          if (consumed <= 0) {
            // Batch ini masih fully tersedia
            remainingBatches.push({ qty: log.jumlah, harga: log.harga });
          } else if (consumed >= log.jumlah) {
            // Batch ini habis dikonsumsi keluar
            consumed -= log.jumlah;
          } else {
            // Batch ini sebagian dikonsumsi
            const sisaBatch = log.jumlah - consumed;
            remainingBatches.push({ qty: sisaBatch, harga: log.harga });
            consumed = 0;
          }
        }

        if (remainingBatches.length > 0) {
          const totalNilai = remainingBatches.reduce((s, b) => s + b.qty * b.harga, 0);
          const totalQty   = remainingBatches.reduce((s, b) => s + b.qty, 0);
          item._weightedAvgPrice = totalQty > 0 ? Math.round(totalNilai / totalQty) : 0;
        } else {
          // Semua batch terkonsumsi, pakai harga masuk terbaru
          item._weightedAvgPrice = masukLogs[masukLogs.length - 1]?.harga || 0;
        }

        // Update hargaSatuan = weighted average price
        item.hargaSatuan = item._weightedAvgPrice;
      }
    });
    // Rebuild lookup map so openItemModal can find items by String(id) regardless of type
    _itemLookup = new Map(_items.map(it => [String(it.id), it]));
  }

  /* ===================== TAB SWITCH ===================== */
  function switchTab(tab) {
    _activeTab = tab;
    // Update header button based on active tab
    const hdrBtns = document.getElementById('inv-header-btns');
    if (hdrBtns && Auth.can('inventory','edit')) {
      if (tab === 'transaksi') {
        hdrBtns.innerHTML = ''; // Button is above table in renderTransaksi
      } else if (tab === 'opname' || tab === 'laporan' || tab === 'summary') {
        hdrBtns.innerHTML = '';
      } else {
        hdrBtns.innerHTML = '<button class="btn btn-primary" onclick="InventoryModule.openItemModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d=\"M12 5v14M5 12h14\"/></svg> Barang Baru</button>';
      }
    }
    ['stok','transaksi','alert','opname','laporan','summary'].forEach(t => {
      const tabContent = document.getElementById('inv-tab-'+t);
      if (tabContent) tabContent.classList.toggle('hidden', t !== tab);
      const tabBtn = document.getElementById('inv-tab-btn-'+t);
      if (tabBtn) tabBtn.classList.toggle('active', t === tab);
    });
    if (tab === 'transaksi') {
      // Reload logs (MASUK/KELUAR only) - OPNAME ada di tab sendiri
      DB.getInventory().then(freshLogs => {
        _logs = freshLogs;
        _recalcStok();
        renderTransaksi();
      }).catch(() => renderTransaksi());
    } else if (tab === 'opname') {
      // Reload opname logs dari DB terpisah
      const _getOp = typeof DB.getOpnameLogs === 'function' ? DB.getOpnameLogs() : Promise.resolve([]);
      _getOp.catch(()=>[]).then(fresh => {
        _opnameLogs = fresh;
        renderOpnameTab();
      });
    } else if (tab === 'laporan') {
      renderLaporanBulanan();
    } else if (tab === 'summary') {
      renderSummary();
    } else {
      const renders = { stok: renderStok, alert: renderAlert };
      renders[tab]?.();
    }
  }

  /* ===================== TAB: STOK BARANG ===================== */
  function renderStok() {
    let filtered = _items;
    if (_filterKat) filtered = filtered.filter(i => i.kategori === _filterKat);
    if (_search) {
      const q = _search.toLowerCase();
      filtered = filtered.filter(i => (i.nama||'').toLowerCase().includes(q) || (i.kategori||'').toLowerCase().includes(q) || (i.satuan||'').toLowerCase().includes(q));
    }

    const totalNilai = filtered.reduce((a, i) => a + (i._stok || 0) * (i.hargaSatuan || 0), 0);
    const totalStokPg = Math.max(1, Math.ceil(filtered.length / _stokPerPage));
    if (_stokPage > totalStokPg) _stokPage = totalStokPg;
    const stokOffset  = (_stokPage - 1) * _stokPerPage;
    const pagedItems  = filtered.slice(stokOffset, stokOffset + _stokPerPage);

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

      <!-- Search Bar -->
      <div style="padding:8px 0 6px;display:flex;align-items:center;gap:10px">
        <div style="position:relative;flex:1;max-width:300px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-3)"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input id="inv-stok-search" placeholder="Cari nama / kategori..." value="${_search}"
            style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
            oninput="InventoryModule.setSearch(this.value)">
        </div>
        <span style="font-size:11px;color:var(--text-3)" id="inv-stok-count">${filtered.length} barang</span>
        <select onchange="InventoryModule.setStokPerPage(+this.value)"
          style="padding:3px 6px;border:1px solid var(--border);border-radius:5px;
                 background:var(--surface2);color:var(--text);font-size:11px;cursor:pointer">
          ${[20,50,100].map(n=>`<option value="${n}" ${_stokPerPage===n?'selected':''}>${n}/hal</option>`).join('')}
        </select>
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
                <th class="num" style="color:var(--success)">Stock In</th>
                <th class="num" style="color:var(--danger)">Stock Out</th>
                <th class="num">Stok Sekarang</th>
                <th class="num">Stok Min</th>
                <th class="num">Harga Satuan</th>
                <th class="num">Nilai Stok</th>
                <th>Status</th>
                ${Auth.can('inventory','edit') ? '<th>Aksi</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${pagedItems.length ? pagedItems.map((item, i) => {
                const i_abs = stokOffset + i;
                const stok    = item._stok || 0;
                const min     = item.stokMin || 0;
                // FIFO: nilai stok menggunakan harga batch terbaru
                const nilai   = _getFIFOStockValue(item.id);
                const isLow   = stok <= min;
                const isEmpty = stok <= 0;
                // Calculate stock in/out from logs
                const itemLogs = _logs.filter(l => l.itemId === item.id);
                const stockIn  = itemLogs.filter(l=>l.jenis==='MASUK').reduce((s,l)=>s+(l.jumlah||0),0);
                const stockOut = itemLogs.filter(l=>l.jenis==='KELUAR').reduce((s,l)=>s+(l.jumlah||0),0);
                return `
                  <tr>
                    <td class="text-muted text-small">${i_abs+1}</td>
                    <td>
                      <div class="font-semibold">${item.nama}</div>
                      ${item.keterangan ? `<div class="text-small text-muted">${item.keterangan}</div>` : ''}
                    </td>
                    <td><span class="badge badge-neutral">${item.kategori||'-'}</span></td>
                    <td class="num text-small" style="color:var(--success)">${stockIn} ${item.satuan||''}</td>
                    <td class="num text-small" style="color:var(--danger)">${stockOut} ${item.satuan||''}</td>
                    <td class="num font-semibold" style="color:${isEmpty?'var(--danger)':isLow?'var(--warning)':'var(--success)'}">
                      ${stok} ${item.satuan||''}
                    </td>
                    <td class="num text-muted text-small">${min} ${item.satuan||''}</td>
                    <td class="num text-small" title="${(() => {
                      const masuk = _logs.filter(l=>l.itemId===item.id && l.jenis==='MASUK' && l.harga>0).sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||''));
                      if (!masuk.length) return 'Belum ada data harga';
                      const totalK = _logs.filter(l=>l.itemId===item.id && l.jenis==='KELUAR').reduce((s,l)=>s+(l.jumlah||0),0);
                      let skip=totalK, batches=[];
                      for(const l of masuk){if(skip<=0){batches.push(l.jumlah+'x'+Utils.formatRupiah(l.harga));}else if(skip>=l.jumlah){skip-=l.jumlah;}else{batches.push((l.jumlah-skip)+'x'+Utils.formatRupiah(l.harga));skip=0;}}
                      return 'WAC dari sisa stok:\n'+batches.join(' + ');
                    })()}">${Utils.formatRupiah(item._weightedAvgPrice||item.hargaSatuan||0)}</td>
                    <td class="num text-small">${Utils.formatRupiah(nilai)}</td>
                    <td>
                      <span class="badge ${isEmpty?'badge-danger':isLow?'badge-warning':'badge-success'}">
                        ${isEmpty ? '❌ Habis' : isLow ? '⚠️ Menipis' : '✅ Aman'}
                      </span>
                    </td>
                    ${Auth.can('inventory','edit') ? `
                      <td class="actions" style="white-space:nowrap">
                        <button class="btn-icon" title="Edit Barang"
                                onclick="InventoryModule.openItemModal('${item.id}')">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button class="btn-icon" title="Hapus Barang"
                                style="color:var(--danger)"
                                onclick="InventoryModule.deleteItem('${item.id}')">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="11" style="text-align:center;padding:40px;color:var(--text-3)">
                    Belum ada data barang
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--text-3)">
        <span>Hal ${_stokPage}/${totalStokPg} · ${filtered.length} barang</span>
        <div style="display:flex;gap:4px;align-items:center">
          <button class="btn btn-sm" onclick="InventoryModule.goStokPage(1)" ${_stokPage===1?'disabled':''}>«</button>
          <button class="btn btn-sm" onclick="InventoryModule.goStokPage(${_stokPage-1})" ${_stokPage===1?'disabled':''}>‹</button>
          <button class="btn btn-sm" onclick="InventoryModule.goStokPage(${_stokPage+1})" ${_stokPage===totalStokPg?'disabled':''}>›</button>
          <button class="btn btn-sm" onclick="InventoryModule.goStokPage(${totalStokPg})" ${_stokPage===totalStokPg?'disabled':''}>»</button>
        </div>
      </div>
    `;
  }

  function setKatFilter(kat) {
    _filterKat = kat;
    _stokPage = 1;
    renderStok();
  }

  /* ===================== TAB: TRANSAKSI ===================== */
  /* ===================== ACTIVITY LINE — click to edit ===================== */
  let _invEditId   = null;
  let _stokPage      = 1;
  let _stokPerPage   = parseInt(localStorage.getItem('becca_inv_stok_perPage') || '50');
  let _invLogPage    = 1;
  let _invLogPerPage = parseInt(localStorage.getItem('becca_inv_log_perPage') || '50');
  let _logFilterNama = '';
  let _logFilterTgl  = '';
  let _invLocked   = new Set();
  const _INV_LOCK_KEY = 'becca_inv_locked_ids';

  // FIX: named function so removeEventListener works correctly
  function _ivOutsideClick(e) {
    if (!_invEditId) return;
    const el = document.getElementById('iv-row-'+_invEditId);
    if (el && !el.contains(e.target)) {
      const id = _invEditId;
      document.removeEventListener('click', _ivOutsideClick);
      const ok = _invCommit(id);
      if (ok) _invEditId = null;
      // if !ok: _invEditId stays set, listener re-attached inside _invCommit
    }
  }

  function goInvLogPage(p) {
    if (_invEditId) {
      document.removeEventListener('click', _ivOutsideClick);
      const prevId = _invEditId;
      _invEditId = null;
      _invCommit(prevId, true); // force-save before page switch
    }
    _invLogPage = p;
    renderTransaksi();
  }

  function goStokPage(p)        { _stokPage = p; renderStok(); }
  function setStokPerPage(n)    { _stokPerPage = n; localStorage.setItem('becca_inv_stok_perPage', n); _stokPage = 1; renderStok(); }
  function setInvLogPerPage(n)  { _invLogPerPage = n; localStorage.setItem('becca_inv_log_perPage', n); _invLogPage = 1; renderTransaksi(); }

  function setLogFilterNama(v) { _logFilterNama = v.trim().toLowerCase(); _invLogPage = 1; renderTransaksi(); }
  function setLogFilterTgl(v)  { _logFilterTgl  = v; _invLogPage = 1; renderTransaksi(); }
  function clearLogFilter()    { _logFilterNama = ''; _logFilterTgl = ''; _invLogPage = 1; renderTransaksi(); }

  function renderTransaksi() {
    const canEdit = Auth.can('inventory','edit');
    const sorted  = [..._logs]
      .filter(l => l.jenis !== 'OPNAME')
      .filter(l => l.itemNama || l.tgl)
      .filter(l => !_logFilterNama || (l.itemNama||'').toLowerCase().includes(_logFilterNama))
      .filter(l => !_logFilterTgl  || (l.tgl||'') === _logFilterTgl)
      .sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));

    const totalPages = Math.max(1, Math.ceil(sorted.length / _invLogPerPage));
    if (_invLogPage > totalPages) _invLogPage = totalPages;
    const offset   = (_invLogPage - 1) * _invLogPerPage;
    const pageData = sorted.slice(offset, offset + _invLogPerPage);

    if (!document.getElementById('inv-ss-style')) {
      const st=document.createElement('style'); st.id='inv-ss-style';
      st.textContent=`
        .iv-tbl{width:100%;border-collapse:collapse;font-size:13px;}
        .iv-tbl th{background:var(--surface2);color:var(--text-3);font-size:10px;text-transform:uppercase;
          letter-spacing:.05em;padding:7px 8px;border:1px solid var(--border);white-space:nowrap;
          position:sticky;top:0;z-index:2;}
        .iv-tbl td{border:1px solid var(--border);padding:0;height:32px;background:var(--surface);vertical-align:middle;}
        .iv-tbl td .ivc{display:flex;align-items:center;padding:0 8px;height:32px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;}
        .iv-tbl tr.iv-view:hover td{background:var(--surface2);cursor:pointer;}
        .iv-tbl tr.iv-editing td{background:rgba(99,102,241,.06)!important;outline:1px solid var(--primary);outline-offset:-1px;}
        .iv-inp{width:100%;height:32px;border:none;outline:none;padding:0 6px;background:transparent;color:var(--text);font-size:13px;font-family:var(--font);box-sizing:border-box;}
        .iv-sel{width:100%;height:32px;border:none;outline:none;padding:0 4px;background:var(--surface3);color:var(--text);font-size:12px;font-family:var(--font);cursor:pointer;}
        .iv-num{text-align:right;font-family:var(--font-mono);}
        .iv-num .ivc{justify-content:flex-end;}
        .iv-del{width:26px;height:26px;border:none;background:transparent;cursor:pointer;color:var(--text-3);border-radius:4px;display:flex;align-items:center;justify-content:center;margin:auto;transition:all .15s;}
        .iv-del:hover{background:rgba(239,68,68,.15);color:var(--danger);}
        .iv-saved{animation:ivSv .5s ease;}@keyframes ivSv{0%{background:rgba(34,197,94,.25)}100%{background:transparent}}
      `;
      document.head.appendChild(st);
    }

    const tab = document.getElementById('inv-tab-transaksi');
    if (!tab) return;

    // ── Filter bar: only inject once so typing doesn't lose focus ──
    if (!document.getElementById('inv-log-filter')) {
      const bar = document.createElement('div');
      bar.id = 'inv-log-filter';
      bar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px';
      bar.innerHTML = `
        <input id="inv-log-search" type="text" placeholder="Cari nama barang…"
          oninput="InventoryModule.setLogFilterNama(this.value)"
          style="padding:7px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;width:200px">
        <input id="inv-log-date" type="date"
          onchange="InventoryModule.setLogFilterTgl(this.value)"
          style="padding:7px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px">
        <button id="inv-log-reset" onclick="InventoryModule.clearLogFilter()"
          style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text-3);font-size:12px;cursor:pointer;display:none">✕ Reset</button>
        <span id="inv-log-count" style="font-size:11px;color:var(--text-3);margin-left:auto"></span>
      `;
      tab.insertBefore(bar, tab.firstChild);
    }
    // Sync filter bar state without touching focused element
    const focused = document.activeElement?.id;
    if (focused !== 'inv-log-search') {
      const s = document.getElementById('inv-log-search');
      if (s) s.value = _logFilterNama;
    }
    if (focused !== 'inv-log-date') {
      const d = document.getElementById('inv-log-date');
      if (d) d.value = _logFilterTgl;
    }
    const resetBtn = document.getElementById('inv-log-reset');
    if (resetBtn) resetBtn.style.display = (_logFilterNama || _logFilterTgl) ? '' : 'none';
    const countEl = document.getElementById('inv-log-count');
    if (countEl) countEl.textContent = sorted.length + ' baris';

    // ── Table: always re-render ──
    let tableDiv = document.getElementById('inv-log-table');
    if (!tableDiv) {
      tableDiv = document.createElement('div');
      tableDiv.id = 'inv-log-table';
      tab.appendChild(tableDiv);
    }
    tableDiv.innerHTML = `
      ${canEdit ? '<div style="margin-bottom:8px"><span style="font-size:11px;color:var(--text-3);font-style:italic">Klik baris untuk edit · Enter untuk simpan · + untuk tambah baris baru</span></div>' : ''}
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="iv-tbl" id="inv-grid">
          <thead><tr>
            <th style="width:32px;padding:0;text-align:center">
              ${canEdit
                ? `<button title="Tambah Baris Baru" onclick="InventoryModule.addLogRow()"
                    style="width:26px;height:26px;border-radius:6px;
                           background:rgba(99,102,241,.25);
                           border:1.5px solid rgba(99,102,241,.5);
                           cursor:pointer;color:var(--primary-h);
                           font-size:15px;font-weight:900;line-height:1;
                           display:flex;align-items:center;justify-content:center;
                           transition:all .15s;margin:auto;"
                    onmouseover="this.style.background='var(--primary)';this.style.color='white';this.style.borderColor='var(--primary)'"
                    onmouseout="this.style.background='rgba(99,102,241,.25)';this.style.color='var(--primary-h)';this.style.borderColor='rgba(99,102,241,.5)'">+</button>`
                : '<span style="color:var(--text-3);font-size:11px">#</span>'}
            </th>
            <th style="width:108px">Tanggal</th>
            <th style="min-width:160px">Nama Barang</th>
            <th style="width:90px">Jenis</th>
            <th style="width:75px" class="iv-num">Jumlah</th>
            <th style="width:100px" class="iv-num">Harga (Rp)</th>
            <th style="width:110px">Kode Aktivitas</th>
            <th style="width:80px;text-align:center" id="hpp-ai-header">HPP <span
              style="font-size:9px;background:rgba(99,102,241,.2);color:var(--primary-h);border-radius:3px;padding:1px 4px;margin-left:4px;vertical-align:middle;font-weight:700;cursor:pointer"
              onclick="InventoryModule._showHPPAIInfo()"
              title="Klik untuk lihat statistik AI HPP">AI</span></th>
            <th style="width:110px">Pengambil</th>
            <th style="width:130px">Penanggung Jawab</th>
            <th style="min-width:140px">Catatan</th>
            ${canEdit ? '<th style="width:32px"></th>' : ''}
          </tr></thead>
          <tbody id="inv-tbody">
            ${pageData.length ? pageData.map((r,i)=>_ivRowView(r,i+1+offset,canEdit)).join('') :
              `<tr><td colspan="${canEdit?12:11}" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada data. Klik + di header untuk mulai.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--text-3)">
        <span>Hal ${_invLogPage}/${totalPages} · ${sorted.length} baris</span>
        <div style="display:flex;gap:4px;align-items:center">
          <select onchange="InventoryModule.setInvLogPerPage(+this.value)"
            style="padding:3px 6px;border:1px solid var(--border);border-radius:5px;
                   background:var(--surface2);color:var(--text);font-size:11px;cursor:pointer">
            ${[20,50,100].map(n=>`<option value="${n}" ${_invLogPerPage===n?'selected':''}>${n}/hal</option>`).join('')}
          </select>
          <button class="btn btn-sm" onclick="InventoryModule.goInvLogPage(1)" ${_invLogPage===1?'disabled':''}>«</button>
          <button class="btn btn-sm" onclick="InventoryModule.goInvLogPage(${_invLogPage-1})" ${_invLogPage===1?'disabled':''}>‹</button>
          <button class="btn btn-sm" onclick="InventoryModule.goInvLogPage(${_invLogPage+1})" ${_invLogPage===totalPages?'disabled':''}>›</button>
          <button class="btn btn-sm" onclick="InventoryModule.goInvLogPage(${totalPages})" ${_invLogPage===totalPages?'disabled':''}>»</button>
        </div>
      </div>
    `;
  }

  function _ivRowView(r, rowNum, canEdit) {
    const jColor = r.jenis==='MASUK'?'var(--success)':r.jenis==='KELUAR'?'var(--danger)':'var(--warning)';
    return `<tr class="iv-view" id="iv-row-${r.id}" data-id="${r.id}"
              ${canEdit && !_invLocked.has(r.id) ? `onclick="InventoryModule.startLogEdit('${r.id}')"` : ''}>
      <td onclick="event.stopPropagation();${_invLocked.has(r.id)?`InventoryModule.unlockInvRow('${r.id}')`:'void(0)'}"
          title="${_invLocked.has(r.id)?'Klik untuk buka kunci':''}"
          style="cursor:${_invLocked.has(r.id)?'pointer':'default'}">
        <div class="ivc" style="justify-content:center;color:var(--text-3);font-size:11px">
          ${_invLocked.has(r.id) ? '🔒' : rowNum}
        </div>
      </td>
      <td><div class="ivc">${r.tgl?(r.tgl.split('-').reverse().join('-')):''}</div></td>
      <td><div class="ivc">${r.itemNama||''}</div></td>
      <td><div class="ivc"><span class="badge" style="background:${jColor}18;color:${jColor};border:1px solid ${jColor}40;font-size:10px">${r.jenis||''}</span></div></td>
      <td class="iv-num"><div class="ivc">${r.jumlah||0}</div></td>
      <td class="iv-num"><div class="ivc">${r.harga?Utils.formatRupiah(r.harga):'-'}</div></td>
      <td><div class="ivc">${r.kodeAktivitas||''}</div></td>
      <td style="text-align:center"><div class="ivc" style="justify-content:center">
        ${r.hpp===true||r.hpp==='ya'?'<span style="font-size:11px;font-weight:600;color:var(--success)">HPP</span>':r.hpp===false||r.hpp==='tidak'?'<span style="font-size:11px;color:var(--text-3)">Non-HPP</span>':'<span style="color:var(--text-3);font-size:11px">—</span>'}
      </div></td>
      <td><div class="ivc">${r.pengambil||''}</div></td>
      <td><div class="ivc">${r.penanggungJawab||''}</div></td>
      <td><div class="ivc">${r.catatan||''}</div></td>
      ${canEdit?`<td>
        <div style='display:flex;gap:2px;align-items:center'>
          ${_invLocked.has(r.id)?
            `<button onclick='event.stopPropagation();InventoryModule.unlockInvRow("${r.id}")'
              title='Buka kunci untuk edit'
              style='width:22px;height:22px;border-radius:4px;border:1px solid rgba(99,102,241,.4);background:rgba(99,102,241,.1);cursor:pointer;color:var(--primary-h);font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0'
              onmouseover='this.style.background="var(--primary)";this.style.color="white"'
              onmouseout='this.style.background="rgba(99,102,241,.1)";this.style.color="var(--primary-h)"'>🔓</button>`
            :`<button onclick='event.stopPropagation();InventoryModule.startLogEdit("${r.id}")'
              title='Edit baris' style='width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0'
              onmouseover='this.style.background="var(--surface2)"' onmouseout='this.style.background="transparent"'>✎</button>`}
          <button class='iv-del' onclick='event.stopPropagation();InventoryModule.deleteLogRow("${r.id}")' title='Hapus'>
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' width='12' height='12'><polyline points='3,6 5,6 21,6'/><path d='M19 6l-1 14H6L5 6'/></svg>
          </button>
        </div>
      </td>`:''}\n    </tr>`;
  }

  function _ivRowEdit(r, rowNum, canEdit) {
    const itemOpts  = _items.map(it=>`<option value="${it.id}" ${r.itemId===it.id?'selected':''}>${it.nama} (${it.satuan||''})</option>`).join('');
    const jenisOpts = ['MASUK','KELUAR'].map(j=>`<option value="${j}" ${r.jenis===j?'selected':''}>${j}</option>`).join('');
    return `<tr class="iv-editing" id="iv-row-${r.id}" data-id="${r.id}" onclick="event.stopPropagation()">
      <td><div class="ivc" style="justify-content:center;color:var(--primary-h);font-size:11px">${rowNum}</div></td>
      <td><input class="iv-inp" type="date" value="${r.tgl||''}" id="ivf-tgl-${r.id}" onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      <td><select class="iv-sel" id="ivf-item-${r.id}" onchange="InventoryModule._ivOnItemSelect('${r.id}',this.value,this.options[this.selectedIndex].text)"><option value="">Pilih barang...</option>${itemOpts}</select></td>
      <td><select class="iv-sel" id="ivf-jenis-${r.id}" 
            onchange="InventoryModule._onJenisChange('${r.id}')"
            ${!r.itemId ? 'disabled style="opacity:.4;cursor:not-allowed" title=\"Pilih barang dulu\"' : ''}>${jenisOpts}</select></td>
      <td class="iv-num"><input class="iv-inp" type="number" min="0" value="${r.jumlah||0}" id="ivf-jumlah-${r.id}" style="text-align:right"
        oninput="InventoryModule._onQtyChange('${r.id}',this.value)"
        onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      <td class="iv-num"><input class="iv-inp" type="number" min="0" value="${r.harga||0}" id="ivf-harga-${r.id}" style="text-align:right" onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      <td><select class="iv-sel" id="ivf-kode-${r.id}"
            onchange="InventoryModule._onKodeChange('${r.id}')">
          ${['','SHIFT 1','SHIFT 2','SHIFT 3','RETUR / RUSAK','PENJUALAN','EVENT','STOCK IN','OPNAME'].map(k=>'<option value="'+k+'" '+(r.kodeAktivitas===k?'selected':'')+'>'+( k||'— Pilih —')+'</option>').join('')}
        </select></td>
      <td style="text-align:center;padding:0 4px">
        <select class="iv-sel" id="ivf-hpp-${r.id}" style="width:80px;font-size:11px"
          onchange="InventoryModule._updateHPPBadge('${r.id}',this.value==='ya')">
          <option value="" ${!r.hpp&&r.hpp!==false?'selected':''}>— AI —</option>
          <option value="ya" ${r.hpp===true||r.hpp==='ya'?'selected':''}>Ya</option>
          <option value="tidak" ${r.hpp===false||r.hpp==='tidak'?'selected':''}>Tidak</option>
        </select>
      </td>
      <td><input class="iv-inp" type="text" value="${(r.pengambil||'').replace(/"/g,'&quot;')}" id="ivf-sup-${r.id}" placeholder="Pengambil" onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      <td><input class="iv-inp" type="text" value="${(r.penanggungJawab||'').replace(/"/g,'&quot;')}" id="ivf-pj-${r.id}" placeholder="Penanggung Jawab" onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      <td><input class="iv-inp" type="text" value="${(r.catatan||'').replace(/"/g,'&quot;')}" id="ivf-cat-${r.id}" placeholder="Catatan"
        onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      ${canEdit?`<td><button class="iv-del" style="color:var(--success)" onclick="event.stopPropagation();InventoryModule.commitLogEdit('${r.id}')" title="Simpan">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20,6 9,17 4,12"/></svg>
      </button></td>`:''}
    </tr>`;
  }

  // ============================================================
  // AI HPP — dengan Learning Capability
  // Setiap keputusan user disimpan ke localStorage sebagai training data
  // AI memprioritaskan learned rules di atas built-in rules
  // ============================================================
  const _HPP_STORAGE_KEY = 'becca_hpp_ai_learned';

  const _HPP_BUILTIN = {
    isHPP: [
      {keys:['SHIFT 1','SHIFT 2','SHIFT 3','PENJUALAN','EVENT'], match:'kode'},
      {keys:['KELUAR'], match:'jenis'},
      {keys:['ayam','daging','ikan','sapi','udang','telur','sayur','buah','beras','minyak','tepung',
              'gula','garam','bumbu','rempah','santan','tahu','tempe','susu','wortel','kentang',
              'bawang','tomat','cabe','cabai','merica','jahe','kunyit','kencur','cabai','sosis',
              'nugget','fillet','tulang','hati','ampela','usus','ceker','kepala'], match:'nama'},
    ],
    notHPP: [
      {keys:['RETUR / RUSAK','STOCK IN','OPNAME'], match:'kode'},
      {keys:['MASUK','OPNAME'], match:'jenis'},
      {keys:['bensin','solar','listrik','pdam','pulsa','gaji','seragam','alat','kemasan',
              'plastik','sabun','deterjen','pembersih','tisu','tissue','sarung','gelang',
              'stiker','label','spidol','pena','buku','printer','tinta'], match:'nama'},
    ]
  };

  // Load / save learned data
  function _hppLearnedLoad() {
    try { return JSON.parse(localStorage.getItem(_HPP_STORAGE_KEY) || '{"items":{},"keywords":{}}'); }
    catch { return {items:{}, keywords:{}}; }
  }

  function _hppLearnedSave(data) {
    try { localStorage.setItem(_HPP_STORAGE_KEY, JSON.stringify(data)); } catch{}
  }

  // Simpan keputusan user (dipanggil saat user ubah value HPP dropdown)
  function hppLearn(itemNama, kode, jenis, userDecision) {
    if (userDecision === null || userDecision === undefined) return;
    const learned = _hppLearnedLoad();
    const key = (itemNama||'').toLowerCase().trim();
    // Simpan per nama item
    if (key) {
      learned.items[key] = {hpp: userDecision, updatedAt: new Date().toISOString()};
    }
    // Extract keywords dari nama (min 3 chars) dan simpan
    if (key.length >= 3) {
      const words = key.split(/\s+/).filter(w => w.length >= 3);
      words.forEach(word => {
        if (!learned.keywords[word]) learned.keywords[word] = {ya:0, tidak:0};
        learned.keywords[word][userDecision ? 'ya' : 'tidak']++;
      });
    }
    _hppLearnedSave(learned);
  }

  // Saran AI dengan prioritas: learned > builtin
  function _suggestHPP(kode, jenis, itemNama) {
    const nama = (itemNama||'').toLowerCase().trim();
    const k = (kode||'').toUpperCase();
    const j = (jenis||'').toUpperCase();
    const learned = _hppLearnedLoad();

    // 1. Cek exact item name match (highest priority — user explicitly set this)
    if (learned.items[nama] !== undefined) {
      return learned.items[nama].hpp;
    }

    // 2. Cek partial nama match di learned items
    for (const [learnedNama, data] of Object.entries(learned.items)) {
      if (nama.includes(learnedNama) || learnedNama.includes(nama)) {
        return data.hpp;
      }
    }

    // 3. Cek learned keywords (jika score dominan)
    const words = nama.split(/\s+/).filter(w=>w.length>=3);
    let yaScore = 0, tidakScore = 0;
    words.forEach(w => {
      if (learned.keywords[w]) {
        yaScore    += learned.keywords[w].ya    || 0;
        tidakScore += learned.keywords[w].tidak || 0;
      }
    });
    if (yaScore > tidakScore && yaScore >= 2)    return true;
    if (tidakScore > yaScore && tidakScore >= 2) return false;

    // 4. Fallback ke built-in rules
    for (const rule of _HPP_BUILTIN.notHPP) {
      if (rule.match==='kode' && rule.keys.includes(k)) return false;
      if (rule.match==='jenis' && rule.keys.includes(j)) return false;
      if (rule.match==='nama' && rule.keys.some(kw=>nama.includes(kw))) return false;
    }
    for (const rule of _HPP_BUILTIN.isHPP) {
      if (rule.match==='kode' && rule.keys.includes(k)) return true;
      if (rule.match==='jenis' && rule.keys.includes(j)) return true;
      if (rule.match==='nama' && rule.keys.some(kw=>nama.includes(kw))) return true;
    }
    return null;
  }

  // Statistik AI untuk display
  function hppAIStats() {
    const learned = _hppLearnedLoad();
    const itemCount = Object.keys(learned.items).length;
    const kwCount   = Object.keys(learned.keywords).length;
    const totalDecisions = Object.values(learned.items).length;
    const hppCount  = Object.values(learned.items).filter(v=>v.hpp===true).length;
    const nonHPP    = Object.values(learned.items).filter(v=>v.hpp===false).length;
    return {itemCount, kwCount, totalDecisions, hppCount, nonHPP};
  }

  // Reset AI learning data
  function hppAIReset() {
    localStorage.removeItem(_HPP_STORAGE_KEY);
    Notify.success('AI HPP reset — mulai belajar dari awal');
  }

  // ============ FIFO Weighted Average Price untuk KELUAR ============
  // Contoh: stok 500 (250@17000 + 250@18000), keluar 300
  // → ambil 250@17000 + 50@18000 = (250×17000 + 50×18000)/300 = Rp 17.167
  function _getFIFOAveragePrice(itemId, qty) {
    if (!qty || qty <= 0) return 0;

    // Semua MASUK logs, sort oldest first (FIFO)
    const masukLogs = _logs
      .filter(l => l.itemId === itemId && l.jenis === 'MASUK' && (l.harga||0) > 0 && (l.jumlah||0) > 0)
      .sort((a, b) => (a.tgl||'').localeCompare(b.tgl||''));

    if (!masukLogs.length) {
      const item = _items.find(i => i.id === itemId);
      return item?.hargaSatuan || 0;
    }

    // Hitung berapa yang sudah keluar sebelumnya (untuk tahu posisi FIFO)
    const totalSudahKeluar = _logs
      .filter(l => l.itemId === itemId && l.jenis === 'KELUAR')
      .reduce((s, l) => s + (l.jumlah || 0), 0);

    // Simulasi FIFO: skip batch yang sudah habis terpakai sebelumnya
    let skipQty = totalSudahKeluar;
    let ambilQty = qty;
    let totalCost = 0;
    let totalAmbil = 0;

    for (const log of masukLogs) {
      if (ambilQty <= 0) break;
      const batchQty = log.jumlah || 0;

      if (skipQty >= batchQty) {
        // Batch ini sudah habis dipakai keluar sebelumnya
        skipQty -= batchQty;
        continue;
      }

      // Sisa batch ini yang belum terpakai
      const tersedia = batchQty - skipQty;
      skipQty = 0;

      const diambil = Math.min(tersedia, ambilQty);
      totalCost  += diambil * (log.harga || 0);
      totalAmbil += diambil;
      ambilQty   -= diambil;
    }

    // Jika masih kurang (stok tidak cukup), pakai harga batch terakhir
    if (ambilQty > 0) {
      const lastHarga = masukLogs[masukLogs.length - 1]?.harga || 0;
      totalCost  += ambilQty * lastHarga;
      totalAmbil += ambilQty;
    }

    return totalAmbil > 0 ? Math.round(totalCost / totalAmbil) : 0;
  }

  function _getFIFOStockValue(itemId) {
    // Nilai stok = _weightedAvgPrice × sisa stok
    // _weightedAvgPrice sudah dihitung di _recalcStok()
    const item = _items.find(i => i.id === itemId);
    if (!item) return 0;
    const currentStok = item._stok || 0;
    if (currentStok <= 0) return 0;
    const hargaWAC = item._weightedAvgPrice || item.hargaSatuan || 0;
    return Math.round(currentStok * hargaWAC);
  }

  function _ivOnItemSelect(id, itemId, labelText) {
    const item = _items.find(i=>i.id===itemId);
    // Enable jenis select when item is selected
    const jenisEl2 = document.getElementById('ivf-jenis-'+id);
    if (jenisEl2 && itemId) {
      jenisEl2.disabled = false;
      jenisEl2.style.opacity = '1';
      jenisEl2.style.cursor = 'pointer';
      jenisEl2.title = '';
    }
    const hargaEl = document.getElementById('ivf-harga-'+id);
    if (!hargaEl) return;
    const jenisEl = document.getElementById('ivf-jenis-'+id);
    const jenis = jenisEl?.value || 'MASUK';
    const jumlahEl = document.getElementById('ivf-jumlah-'+id);
    const qty = parseFloat(jumlahEl?.value)||1;
    if (item) {
      // Auto-fill harga:
      // MASUK: pakai harga item (weighted avg dari sisa stok)
      // KELUAR: pakai FIFO weighted avg sesuai qty yang diambil
      if (jenis==='KELUAR') {
        hargaEl.value = _getFIFOAveragePrice(itemId, qty);
      } else {
        // MASUK: tampilkan harga satuan terbaru (WAC)
        hargaEl.value = item._weightedAvgPrice || item.hargaSatuan || 0;
      }
      // AI: suggest HPP
      const kodeEl = document.getElementById('ivf-kode-'+id);
      const hppEl  = document.getElementById('ivf-hpp-'+id);
      if (kodeEl && hppEl) {
        const suggested = _suggestHPP(kodeEl.value, jenis, item.nama);
        if (suggested !== null) {
          hppEl.value = suggested ? 'ya' : 'tidak';
          _updateHPPBadge(id, suggested);
        }
      }
    }
  }

    function _ivReadDOM(id) {
    const g = (suf) => document.getElementById('ivf-'+suf+'-'+id);
    const itemSel = g('item');
    return {
      tgl:       g('tgl')?.value     || '',
      itemId:    itemSel?.value      || '',
      itemNama:  itemSel?.options[itemSel?.selectedIndex]?.text?.split(' (')[0] || '',
      jenis:     g('jenis')?.value   || 'MASUK',
      jumlah:         parseFloat(g('jumlah')?.value) || 0,
      harga:          parseFloat(g('harga')?.value)  || 0,
      kodeAktivitas:  g('kode')?.value    || '',
      hpp:            g('hpp')?.value==='ya' ? true : g('hpp')?.value==='tidak' ? false : null,
      pengambil:      g('sup')?.value     || '',
      penanggungJawab:g('pj')?.value      || '',
      catatan:        g('cat')?.value     || '',
    };
  }

  function startLogEdit(id) {
    if (_invEditId === id) return;
    if (_invLocked.has(id)) return;  // Row terkunci
    // FIX: remove listener first
    document.removeEventListener('click', _ivOutsideClick);
    // Commit previous (with validation — block switching if incomplete)
    if (_invEditId) {
      const prevId = _invEditId;
      _invEditId = null;
      const ok = _invCommit(prevId);
      if (!ok) return; // validation failed, stay on previous row
    }
    _invEditId = id;
    const row  = _logs.find(r=>r.id===id);
    const trEl = document.getElementById('iv-row-'+id);
    if (!row || !trEl) { _invEditId = null; return; }
    // Save original for change detection
    row._original = JSON.stringify({tgl:row.tgl,itemId:row.itemId,jenis:row.jenis,
      jumlah:row.jumlah,harga:row.harga,kodeAktivitas:row.kodeAktivitas,
      hpp:row.hpp,pengambil:row.pengambil,penanggungJawab:row.penanggungJawab,catatan:row.catatan});
    const tbody   = document.getElementById('inv-tbody');
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const rowNum  = allRows.indexOf(trEl)+1;
    trEl.outerHTML = _ivRowEdit(row, rowNum, true);
    setTimeout(() => {
      document.getElementById('ivf-item-'+id)?.focus();
      document.addEventListener('click', _ivOutsideClick);
    }, 50);
  }

  function _invCommit(id, skipValidation = false) {
    const row = _logs.find(r=>r.id===id);
    if (!row) return true;
    const vals = _ivReadDOM(id);

    if (!skipValidation) {
      const _failV = (msg) => {
        Notify.popup(msg);
        _invEditId = id;
        setTimeout(() => document.addEventListener('click', _ivOutsideClick), 50);
        return false;
      };
      if (!vals.itemId)
        return _failV('Nama Barang wajib dipilih sebelum menyimpan');
      if (row._isNew) {
        if (!vals.tgl)
          return _failV('Tanggal wajib diisi');
        if (!vals.jumlah || vals.jumlah <= 0)
          return _failV('Jumlah wajib diisi dan harus lebih dari 0');
        if (!vals.kodeAktivitas)
          return _failV('Kode Aktivitas wajib dipilih');
        if (!vals.pengambil || !vals.pengambil.trim())
          return _failV('Pengambil wajib diisi');
        if (!vals.penanggungJawab || !vals.penanggungJawab.trim())
          return _failV('Penanggung Jawab wajib diisi');
      }
    }
    const origStr = row._original || '{}';
    Object.assign(row, vals);
    const newStr = JSON.stringify({tgl:row.tgl,itemId:row.itemId,jenis:row.jenis,jumlah:row.jumlah,harga:row.harga,kodeAktivitas:row.kodeAktivitas,hpp:row.hpp,pengambil:row.pengambil,penanggungJawab:row.penanggungJawab,catatan:row.catatan});
    row._hasChanged = origStr !== newStr;
    const trEl = document.getElementById('iv-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('inv-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl)+1;
      trEl.outerHTML = _ivRowView(row, rowNum, true);
    }
    if (row._hasChanged === false) {
      // Tidak ada perubahan - skip save dan log
      delete row._original; delete row._hasChanged; delete row._isNew;
      return true;
    }
    delete row._original; delete row._hasChanged; delete row._isNew;
    DB.saveInventoryLog(row).then(() => {
      _recalcStok();
      // Update item hargaSatuan if MASUK and harga provided
      if (row.jenis==='MASUK' && row.harga>0 && row.itemId) {
        const item = _items.find(i=>i.id===row.itemId);
        if (item) {
          item.hargaSatuan = row.harga;
          DB.saveInventoryItem(item).catch(()=>{});
        }
      }
      DB.logActivity({type:'edit_inventory', detail:'Edit: '+(row.itemNama||id), snapshot:{after: {...row}}});
      const newTr = document.getElementById('iv-row-'+id);
      if (newTr) { newTr.classList.add('iv-saved'); setTimeout(()=>newTr.classList.remove('iv-saved'),500); }
    }).catch(e => Notify.error('Gagal simpan', e.message));
    return true;
  }

  async function commitLogEdit(id) {
    if (_invEditId !== id) return;
    document.removeEventListener('click', _ivOutsideClick);
    const ok = _invCommit(id);
    if (ok) _invEditId = null;
    // if !ok: _invEditId stays, listener re-attached in _invCommit
  }

  function unlockInvRow(id) {
    _invLocked.delete(id);
    localStorage.setItem(_INV_LOCK_KEY, JSON.stringify([..._invLocked]));
    startLogEdit(id);
  }

  async function addLogRow() {
    if (_invEditId) {
      document.removeEventListener('click', _ivOutsideClick);
      const prevId = _invEditId;
      _invEditId = null;
      const ok = _invCommit(prevId);
      if (!ok) return; // validation failed, block adding new row
    }
    const today = new Date().toISOString().split('T')[0];
    const newRow = {tgl:today,itemId:'',itemNama:'',jenis:'MASUK',jumlah:0,stokAkhir:0,harga:0,kodeAktivitas:'',hpp:0,pengambil:'',penanggungJawab:'',catatan:''};
    try {
      const saved = await DB.saveInventoryLog(newRow);
      saved._isNew = true;  // strict validation until first commit
      _logs.unshift(saved);
      DB.logActivity({type:'add_inventory', detail:'Baris baru', snapshot:{after: {...saved}}});
      renderTransaksi();
      // Wait for DOM to be fully rendered before starting edit
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const trEl = document.getElementById('iv-row-'+saved.id);
          if (trEl) startLogEdit(saved.id);
        });
      });
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  async function deleteLogRow(id) {
    if (_invEditId===id) { document.removeEventListener('click',_ivOutsideClick); _invEditId=null; }
    const ok = await Modal.confirm({title:'Hapus Baris',message:'Transaksi dihapus permanen.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    const mid = Utils.uid();
    try {
      await DB.deleteInventoryLog(id);
      _logs=_logs.filter(r=>r.id!==id);
      _recalcStok();
      DB.logActivity({type:'delete_inventory', detail:'Baris dihapus'});
      renderTransaksi(); renderStok();
      Notify.success('Baris dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }



  /* ===================== MODAL: BARANG ===================== */
  async function openItemModal(editId = null) {
    // Use lookup map (String keys) to handle any numeric/string type mismatch
    let existing = editId ? (_itemLookup.get(String(editId)) || null) : null;
    // Fallback: if not in lookup, try _items with String comparison then fetch from DB
    if (editId && !existing) {
      existing = _items.find(i => String(i.id) === String(editId)) || null;
    }
    if (editId && !existing) {
      try {
        const all = await DB.getInventoryItems();
        existing = all.find(i => String(i.id) === String(editId)) || null;
        if (existing) { _items = all; _recalcStok(); }
      } catch {}
    }
    const d = existing || {};
    const isEdit = !!editId;
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: isEdit ? 'Edit Barang' : 'Tambah Barang Baru',
      size:  'modal-md',
      body: `
        <form id="inv-item-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Barang <span class="req">*</span></label>
              <input name="nama" class="form-control" value="${d.nama||''}" required placeholder="Nama bahan/barang">
            </div>
            <div class="form-group">
              <label class="form-label">Kategori</label>
              <select name="kategori" class="form-control">
                ${KATEGORIS.map(k=>`<option value="${k}" ${d.kategori===k?'selected':''}>${k}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Satuan <span class="req">*</span></label>
              <input name="satuan" class="form-control" list="inv-sat-list" value="${d.satuan||''}" required>
              <datalist id="inv-sat-list">${SATUANS.map(s=>`<option value="${s}">`).join('')}</datalist>
            </div>
            <div class="form-group">
              <label class="form-label">Stok Minimum</label>
              <input name="stokMin" type="number" min="0" class="form-control" value="${d.stokMin||0}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Harga Satuan (Rp)</label>
            <input name="hargaSatuan" type="number" min="0" class="form-control" value="${d.hargaSatuan||d.harga||0}">
          </div>
          <div class="form-group">
            <label class="form-label">Keterangan</label>
            <input name="keterangan" class="form-control" value="${d.keterangan||d.ket||''}" placeholder="Opsional">
          </div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="InventoryModule._submitItem('${mid}','${editId||''}')">
          ${isEdit ? 'Simpan' : 'Tambah Barang'}
        </button>`,
    });
    return mid;
  }

  async function _submitItem(modalId, editId = '') {
    const fd   = new FormData(document.getElementById('inv-item-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.nama || !data.satuan) { Notify.warning('Nama dan Satuan wajib diisi'); return; }
    data.stokMin      = parseInt(data.stokMin)     || 0;
    data.hargaSatuan  = parseInt(data.hargaSatuan) || 0;
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveInventoryItem(data);
      const idx   = _items.findIndex(i => String(i.id) === String(saved.id));
      if (idx >= 0) _items[idx] = saved; else _items.push(saved);
      _recalcStok();
      renderStok();
      Modal.close(modalId);
      Notify.success(editId ? 'Barang diperbarui' : 'Barang ditambahkan');
      DB.logActivity({type: editId?'edit_item':'add_item', detail: 'Barang: '+data.nama});
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  async function deleteItem(id) {
    const item = _itemLookup.get(String(id)) || _items.find(i => String(i.id) === String(id));
    const ok = await Modal.confirm({
      title: 'Hapus Barang',
      message: `Hapus <strong>${item?.nama || 'barang ini'}</strong> secara permanen?<br><span style="font-size:12px;color:var(--text-muted)">Seluruh riwayat transaksi terkait juga akan tetap ada.</span>`,
      danger: true,
      confirmText: 'Hapus'
    });
    if (!ok) return;
    try {
      await DB.deleteInventoryItem(id);
      _items = _items.filter(i => String(i.id) !== String(id));
      _recalcStok();
      renderStok();
      Notify.success('Barang dihapus');
      DB.logActivity({ type:'delete_item', detail:'Hapus barang: '+(item?.nama||id) });
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  /* ===================== MODAL: TRANSAKSI STOK ===================== */
  function openTransaksiModal(preItemId = null, preJenis = '') {
    const itemOpts = _items.map(it =>
      `<option value="${it.id}" ${preItemId===it.id?'selected':''}>${it.nama} (${it.satuan||''})</option>`
    ).join('');
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: 'Tambah Transaksi Stok',
      body: `
        <form id="inv-trx-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tanggal</label>
              <input name="tgl" type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label class="form-label">Jenis <span class="req">*</span></label>
              <select name="jenis" class="form-control" id="inv-jenis-sel" onchange="InventoryModule._onItemChange(this)">
                <option value="MASUK"  ${(!preJenis||preJenis==='MASUK') ?'selected':''}>📥 MASUK</option>
                <option value="KELUAR" ${preJenis==='KELUAR'?'selected':''}>📤 KELUAR</option>
                <option value="OPNAME" ${preJenis==='OPNAME'?'selected':''}>📋 OPNAME</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Barang <span class="req">*</span></label>
            <select name="itemId" class="form-control" onchange="InventoryModule._onItemChange(this)" required>
              <option value="">Pilih barang...</option>
              ${itemOpts}
            </select>
          </div>
          <div id="inv-stok-info" style="margin-bottom:var(--s3);font-size:12px;color:var(--text-3)"></div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Jumlah <span class="req">*</span></label>
              <input name="jumlah" type="number" min="0" step="0.01" class="form-control" value="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">Harga/Unit (Rp)</label>
              <input name="harga" type="number" min="0" class="form-control" value="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Supplier</label>
              <input name="supplier" class="form-control" placeholder="Nama supplier">
            </div>
            <div class="form-group">
              <label class="form-label">Catatan</label>
              <input name="catatan" class="form-control" placeholder="Opsional">
            </div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="InventoryModule._submitTransaksi('${mid}')">Simpan Transaksi</button>`,
    });
    if (preItemId) setTimeout(() => InventoryModule._onItemChange(null), 100);
    return mid;
  }

  function _onItemChange(sel) {
    const form    = document.getElementById('inv-trx-form');
    if (!form) return;
    const itemId  = form.querySelector('[name="itemId"]')?.value;
    const item    = _items.find(i => i.id === itemId);
    const infoEl  = document.getElementById('inv-stok-info');
    if (infoEl && item) {
      infoEl.innerHTML = `Stok saat ini: <strong style="color:${(item._stok||0)<=0?'var(--danger)':'var(--success)'}">${item._stok||0} ${item.satuan||''}</strong>`;
    }
  }

  async function _submitTransaksi(modalId) {
    const fd   = new FormData(document.getElementById('inv-trx-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.itemId || !data.jumlah) { Notify.warning('Barang dan Jumlah wajib diisi'); return; }
    data.jumlah = parseFloat(data.jumlah) || 0;
    data.harga  = parseInt(data.harga)    || 0;
    // Find item name
    const item  = _items.find(i => i.id === data.itemId);
    data.itemNama = item?.nama || '';
    // Calc stok akhir
    const prevStok = item?._stok || 0;
    if (data.jenis === 'MASUK')  data.stokAkhir = prevStok + data.jumlah;
    if (data.jenis === 'KELUAR') data.stokAkhir = prevStok - data.jumlah;
    if (data.jenis === 'OPNAME') data.stokAkhir = data.jumlah;
    try {
      const saved = await DB.saveInventoryLog(data);
      _logs.unshift(saved);
      _recalcStok();
      renderStok();
      Modal.close(modalId);
      Notify.success('Transaksi disimpan');
      DB.logActivity({type:'add_inventory', detail:`${data.jenis} ${data.itemNama}: ${data.jumlah}`});
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  /* ===================== TAB: STOK MENIPIS ===================== */
  function renderAlert() {
    const low = _items.filter(i => (i._stok||0) <= (i.stokMin||0))
                      .sort((a,b) => (a._stok||0) - (b._stok||0));
    document.getElementById('inv-tab-alert').innerHTML = low.length === 0 ? `
      <div class="empty-state" style="height:40vh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h4>Semua Stok Aman</h4>
        <p>Tidak ada barang yang perlu restock</p>
      </div>` : `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>#</th><th>Nama Barang</th><th>Kategori</th>
              <th class="num">Stok Saat Ini</th><th class="num">Stok Min</th>
              <th>Status</th>
              ${Auth.can('inventory','edit') ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${low.map((item,i) => {
              const stok = item._stok || 0;
              return `
              <tr style="${stok<=0?'background:rgba(239,68,68,.05)':''}">
                <td class="text-muted">${i+1}</td>
                <td class="font-semibold">${item.nama}</td>
                <td><span class="badge badge-neutral">${item.kategori||'-'}</span></td>
                <td class="num" style="color:${stok<=0?'var(--danger)':'var(--warning)'};font-weight:700">
                  ${stok} ${item.satuan||''}
                </td>
                <td class="num text-muted">${item.stokMin||0} ${item.satuan||''}</td>
                <td>
                  <span class="badge ${stok<=0?'badge-danger':'badge-warning'}">
                    ${stok<=0?'❌ HABIS':'⚠️ MENIPIS'}
                  </span>
                </td>
                ${Auth.can('inventory','edit') ? `
                  <td>
                    <button class="btn btn-sm btn-primary" onclick="InventoryModule.openTransaksiModal('${item.id}','MASUK')">
                      Restock
                    </button>
                  </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }


  /* ===================== STOK OPNAME TAB ===================== */
  function renderOpnameTab() {
    const sorted = [..._opnameLogs].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const totalOpname = sorted.length;
    // Group by item for summary
    const byItem = {};
    sorted.forEach(l => {
      if (!byItem[l.itemId]) byItem[l.itemId] = {nama: l.itemNama, logs: []};
      byItem[l.itemId].logs.push(l);
    });
    const lastOpname = sorted[0]?.tgl || '-';
    const itemCount  = Object.keys(byItem).length;

    document.getElementById('inv-tab-opname').innerHTML = `
      <!-- Summary Cards -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
          {l:'Total Opname', v:totalOpname+' record', c:'var(--primary-h)'},
          {l:'Barang Diopname', v:itemCount+' item', c:'var(--info)'},
          {l:'Opname Terakhir', v:lastOpname, c:'var(--text-2)'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:160px">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:16px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>`).join('')}
        ${Auth.can('inventory','edit') ? `
          <div style="margin-left:auto;display:flex;align-items:center">
            <button class="btn btn-ghost btn-sm" onclick="InventoryModule.exportOpnameCSV()">
              Export CSV
            </button>
          </div>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 2fr;gap:var(--s5)">
        <!-- Form Input Opname -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🔢 Input Stok Opname</div>
          </div>
          <div style="padding:var(--s4)">
            <p style="font-size:12px;color:var(--text-3);margin-bottom:var(--s4);line-height:1.5">
              Catat jumlah stok aktual hasil hitung fisik. Data tersimpan terpisah dari Activity Line dan tidak mempengaruhi stok.
            </p>
            <div class="form-group">
              <label class="form-label">Tanggal Opname</label>
              <input type="date" class="form-control" id="op-tgl" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label class="form-label">Barang <span class="req">*</span></label>
              <select class="form-control" id="op-item" onchange="InventoryModule._onOpnameItemChange()">
                <option value="">Pilih barang...</option>
                ${_items.map(it=>`<option value="${it.id}">${it.nama} — Stok: ${it._stok||0} ${it.satuan||''}</option>`).join('')}
              </select>
            </div>
            <div id="op-current-info" style="padding:10px;background:var(--surface2);border-radius:var(--r-md);margin-bottom:var(--s4);font-size:13px;display:none">
              <div style="display:flex;justify-content:space-between">
                <span style="color:var(--text-3)">Stok sistem:</span>
                <strong id="op-current-stok" style="font-family:var(--font-mono)">-</strong>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:4px">
                <span style="color:var(--text-3)">Selisih:</span>
                <strong id="op-selisih" style="font-family:var(--font-mono)">-</strong>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Jumlah Fisik <span class="req">*</span></label>
              <input type="number" min="0" step="0.01" class="form-control" id="op-jumlah" value="0"
                oninput="InventoryModule._onOpnameJumlahChange()">
            </div>
            <div class="form-group">
              <label class="form-label">Catatan</label>
              <input type="text" class="form-control" id="op-catatan" placeholder="Opsional">
            </div>
            <button class="btn btn-primary" style="width:100%" onclick="InventoryModule._submitOpname2()">
              Simpan Opname
            </button>
          </div>
        </div>

        <!-- Laporan Stok Opname -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Laporan Stok Opname</div>
            <div style="display:flex;gap:var(--s2)">
              <select class="form-control" style="width:160px;font-size:12px" id="op-filter-item"
                onchange="InventoryModule.renderOpnameTab()">
                <option value="">Semua Barang</option>
                ${[...new Set(sorted.map(l=>l.itemId))].map(id=>{
                  const n = sorted.find(l=>l.itemId===id)?.itemNama||id;
                  const selVal = document.getElementById('op-filter-item')?.value;
                  return '<option value="'+id+'">'+n+'</option>';
                }).join('')}
              </select>
            </div>
          </div>
          <div class="table-scroll">
            <table class="table" style="font-size:13px">
              <thead>
                <tr>
                  <th style="width:110px">Tanggal</th>
                  <th>Barang</th>
                  <th class="num" style="width:90px">Jumlah Fisik</th>
                  <th class="num" style="width:100px">Stok Sistem</th>
                  <th class="num" style="width:90px">Selisih</th>
                  <th>Catatan</th>
                  ${Auth.can('inventory','edit') ? '<th style="width:32px"></th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  const filterItemId = document.getElementById && document.getElementById('op-filter-item')?.value || '';
                  const rows = filterItemId ? sorted.filter(l=>l.itemId===filterItemId) : sorted;
                  if (!rows.length) return '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-3)">Belum ada data opname</td></tr>';
                  return rows.map(l => {
                    const selisih = (l.jumlah||0) - (l.stokSistem||0);
                    const selisihColor = selisih===0?'var(--text-2)':selisih>0?'var(--success)':'var(--danger)';
                    const tglFmt = l.tgl ? l.tgl.split('-').reverse().join('-') : '';
                    return '<tr>'
                      + '<td style="white-space:nowrap">'+tglFmt+'</td>'
                      + '<td class="font-semibold">'+(l.itemNama||'')+'</td>'
                      + '<td class="num" style="font-family:var(--font-mono)">'+(l.jumlah||0)+'</td>'
                      + '<td class="num text-muted" style="font-family:var(--font-mono)">'+(l.stokSistem!=null?l.stokSistem:'-')+'</td>'
                      + '<td class="num" style="color:'+selisihColor+';font-weight:600;font-family:var(--font-mono)">'+(selisih>=0?'+':'')+selisih+'</td>'
                      + '<td class="text-muted text-small">'+(l.catatan||'')+'</td>'
                      + (Auth.can('inventory','edit') ? '<td><button class="iv-del" onclick="InventoryModule.deleteOpnameRow(\'' + l.id + '\')" title="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg></button></td>' : '')
                      + '</tr>';
                  }).join('');
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  async function deleteOpnameRow(id) {
    const ok = await Modal.confirm({title:'Hapus Opname',message:'Data opname dihapus permanen.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    try {
      if (typeof DB.deleteOpnameLog === 'function') {
        await DB.deleteOpnameLog(id);
      } else {
        await DB.delete('opname_logs', id);
      }
      _opnameLogs = _opnameLogs.filter(r=>r.id!==id);
      renderOpnameTab();
      Notify.success('Data opname dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  function exportOpnameCSV() {
    const rows = [..._opnameLogs].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const hdr = ['Tanggal','Nama Barang','Jumlah Fisik','Stok Sistem','Selisih','Catatan'];
    const data = rows.map(l => {
      const s = (l.jumlah||0)-(l.stokSistem||0);
      return [l.tgl, l.itemNama, l.jumlah||0, l.stokSistem??'', (s>=0?'+':'')+s, l.catatan||'']
        .map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
    });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([[hdr.join(','),...data].join('\n')], {type:'text/csv;charset=utf-8;'})),
      download: `opname-${new Date().toISOString().split('T')[0]}.csv`
    });
    a.click(); URL.revokeObjectURL(a.href);
    Notify.success('CSV di-export');
  }

  function _onOpnameItemChange() {
    const itemId = document.getElementById('op-item')?.value;
    const item   = _items.find(i=>i.id===itemId);
    const info   = document.getElementById('op-current-info');
    const stokEl = document.getElementById('op-current-stok');
    const jumlahEl = document.getElementById('op-jumlah');
    if (item && info && stokEl) {
      const stok = item._stok || 0;
      stokEl.textContent = stok + ' ' + (item.satuan||'');
      stokEl.style.color = stok<=0?'var(--danger)':'var(--success)';
      info.style.display = 'block';
      if (jumlahEl) jumlahEl.value = stok;
      _onOpnameJumlahChange();
    }
  }

  function _onOpnameJumlahChange() {
    const itemId = document.getElementById('op-item')?.value;
    const item   = _items.find(i=>i.id===itemId);
    if (!item) return;
    const jumlah   = parseFloat(document.getElementById('op-jumlah')?.value) || 0;
    const stokSys  = item._stok || 0;
    const selisih  = jumlah - stokSys;
    const selEl    = document.getElementById('op-selisih');
    if (selEl) {
      selEl.textContent = (selisih>=0?'+':'')+selisih+' '+( item.satuan||'');
      selEl.style.color = selisih===0?'var(--text-2)':selisih>0?'var(--success)':'var(--danger)';
    }
  }

  async function _submitOpname2() {
    const itemId = document.getElementById('op-item')?.value;
    const tgl    = document.getElementById('op-tgl')?.value;
    const jumlah = parseFloat(document.getElementById('op-jumlah')?.value) || 0;
    const catatan= document.getElementById('op-catatan')?.value || '';
    if (!itemId) { Notify.warning('Pilih barang terlebih dahulu'); return; }
    const item   = _items.find(i=>i.id===itemId);
    if (!item) return;
    const prevStok = item._stok || 0;
    const selisih  = jumlah - prevStok;
    const log = {
      tgl, itemId: item.id, itemNama: item.nama,
      jumlah,                          // jumlah fisik hasil hitung
      stokSistem: prevStok,            // stok sistem saat opname
      selisih,                         // selisih (fisik - sistem)
      catatan: catatan || ('Opname: '+prevStok+' → '+jumlah+(selisih>=0?' (+'+selisih+')':' ('+selisih+')')),
    };
    try {
      // OPNAME disimpan ke DB terpisah - TIDAK masuk activity line
      if (typeof DB.saveOpnameLog !== 'function') {
        Notify.error('Update diperlukan', 'Upload db.js terbaru ke server');
        return;
      }
      const saved = await DB.saveOpnameLog(log);
      _opnameLogs.unshift(saved);
      // OPNAME tidak mempengaruhi _logs (activity line) dan tidak mempengaruhi stok via _recalcStok
      renderOpnameTab();
      renderStok(); // Refresh tampilan stok (stok tidak berubah karena opname)
      Notify.success('Stok Opname disimpan! '+item.nama+': '+prevStok+' → '+jumlah+' '+( item.satuan||''));
      DB.logActivity({type:'opname', detail:'Opname '+item.nama+': '+prevStok+'→'+jumlah, snapshot:{after:{barang:item.nama, stokLama:prevStok, stokBaru:jumlah, selisih:jumlah-prevStok, tanggal:tgl}}});
      // Reset form
      document.getElementById('op-item').value = '';
      document.getElementById('op-jumlah').value = '0';
      document.getElementById('op-catatan').value = '';
      document.getElementById('op-current-info').style.display = 'none';
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  /* ===================== STOK OPNAME ===================== */
  function openOpnameModal() {
    const itemOpts = _items.map(it => {
      const stok = it._stok || 0;
      return `<option value="${it.id}">${it.nama} — Stok: ${stok} ${it.satuan||''}</option>`;
    }).join('');
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: 'Stok Opname',
      size: 'modal-md',
      body: `
        <p style="color:var(--text-3);font-size:13px;margin-bottom:var(--s4)">
          Stok Opname digunakan untuk menyesuaikan stok aktual di gudang. Jumlah yang dimasukkan akan menjadi stok baru.
        </p>
        <form id="opname-form">
          <div class="form-group">
            <label class="form-label">Tanggal Opname</label>
            <input name="tgl" type="date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Barang <span class="req">*</span></label>
            <select name="itemId" class="form-control" id="opname-item-sel" onchange="InventoryModule._onOpnameItemChange()">
              <option value="">Pilih barang...</option>
              ${itemOpts}
            </select>
          </div>
          <div id="opname-current-info" style="padding:10px;background:var(--surface2);border-radius:var(--r-md);margin-bottom:var(--s4);font-size:13px;display:none">
            Stok saat ini: <strong id="opname-current-stok">-</strong>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Stok Aktual (hasil hitung fisik) <span class="req">*</span></label>
              <input name="jumlah" type="number" min="0" step="0.01" class="form-control" value="0" id="opname-jumlah">
            </div>
            <div class="form-group">
              <label class="form-label">Catatan</label>
              <input name="catatan" class="form-control" placeholder="Hasil opname tgl...">
            </div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="InventoryModule._submitOpname('${mid}')">
          Simpan Opname
        </button>`,
    });
    return mid;
  }

  function _onOpnameItemChange() {
    const sel    = document.getElementById('opname-item-sel');
    const itemId = sel?.value;
    const item   = _items.find(i => i.id === itemId);
    const info   = document.getElementById('opname-current-info');
    const stokEl = document.getElementById('opname-current-stok');
    if (item && info && stokEl) {
      const stok = item._stok || 0;
      stokEl.textContent = stok + ' ' + (item.satuan||'');
      stokEl.style.color = stok <= 0 ? 'var(--danger)' : 'var(--success)';
      info.style.display = 'block';
      // Pre-fill jumlah with current stok
      const jumlahEl = document.getElementById('opname-jumlah');
      if (jumlahEl) jumlahEl.value = stok;
    }
  }

  async function _submitOpname(modalId) {
    const fd     = new FormData(document.getElementById('opname-form'));
    const data   = Object.fromEntries(fd.entries());
    if (!data.itemId) { Notify.warning('Pilih barang terlebih dahulu'); return; }
    const item   = _items.find(i => i.id === data.itemId);
    if (!item)   { Notify.warning('Barang tidak ditemukan'); return; }
    const jumlah = parseFloat(data.jumlah) || 0;
    const prevStok = item._stok || 0;
    const selisih  = jumlah - prevStok;
    const log = {
      tgl:       data.tgl,
      itemId:    item.id,
      itemNama:  item.nama,
      jenis:     'OPNAME',
      jumlah:    jumlah,
      stokAkhir: jumlah,
      harga:     0,
      supplier:  '',
      catatan:   data.catatan || ('Opname: '+prevStok+' → '+jumlah+(selisih>=0?' (+'+selisih+')':' ('+selisih+')')),
    };
    try {
      const saved = await DB.saveInventoryLog(log);
      _logs.unshift(saved);
      _recalcStok();
      renderStok();
      renderTransaksi();
      Modal.close(modalId);
      Notify.success(`Stok Opname disimpan! ${item.nama}: ${prevStok} → ${jumlah} ${item.satuan||''}`);
      DB.logActivity({type:'opname', detail:`Opname ${item.nama}: ${prevStok}→${jumlah}`});
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  // ============ AI Helpers ============
  function _updateHPPBadge(id, isHPPVal) {
    // isHPPVal: true/false/'ya'/'tidak'/undefined
    const isHPP = isHPPVal === true || isHPPVal === 'ya' ? true
                : isHPPVal === false || isHPPVal === 'tidak' ? false : null;
    const sel = document.getElementById('ivf-hpp-'+id);
    if (!sel) return;
    if (isHPP === true) {
      sel.style.color = 'var(--success)';
      sel.style.borderColor = 'rgba(34,197,94,.4)';
    } else if (isHPP === false) {
      sel.style.color = 'var(--text-3)';
      sel.style.borderColor = '';
    } else {
      sel.style.color = '';
      sel.style.borderColor = '';
    }
    // === LEARNING: simpan keputusan user ke AI training data ===
    if (isHPP !== null) {
      const row = _logs.find(r => r.id === id);
      if (row) {
        hppLearn(row.itemNama || '', row.kodeAktivitas || '', row.jenis || '', isHPP);
      }
    }
  }

  function _showHPPAIInfo() {
    const stats   = hppAIStats();
    const learned = _hppLearnedLoad();
    const topItems = Object.entries(learned.items)
      .sort((a,b) => new Date(b[1].updatedAt||0) - new Date(a[1].updatedAt||0))
      .slice(0, 8);

    const statsCards = [
      {l:'Item Dipelajari', v:stats.itemCount,  c:'var(--primary-h)'},
      {l:'Termasuk HPP',    v:stats.hppCount,   c:'var(--success)'},
      {l:'Non-HPP',         v:stats.nonHPP,     c:'var(--text-3)'},
    ].map(s =>
      '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;text-align:center">'
      + '<div style="font-size:11px;color:var(--text-3);margin-bottom:3px">'+s.l+'</div>'
      + '<div style="font-size:20px;font-weight:700;color:'+s.c+';font-family:var(--font-mono)">'+s.v+'</div>'
      + '</div>'
    ).join('');

    const itemRows = topItems.map(([nama, d]) =>
      '<tr>'
      + '<td>'+nama+'</td>'
      + '<td style="text-align:center">'+(d.hpp ? '<span style="color:var(--success);font-weight:600">Ya</span>' : '<span style="color:var(--text-3)">Tidak</span>')+'</td>'
      + '<td class="text-muted text-small">'+(d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('id-ID') : '-')+'</td>'
      + '</tr>'
    ).join('');

    const learnedSection = topItems.length
      ? '<div class="section-title" style="margin-top:var(--s4)">Item yang sudah dipelajari (terbaru)</div>'
        + '<div style="max-height:200px;overflow-y:auto"><table class="table" style="font-size:12px">'
        + '<thead><tr><th>Nama Item</th><th style="text-align:center">HPP</th><th>Dipelajari</th></tr></thead>'
        + '<tbody>'+itemRows+'</tbody></table></div>'
      : '<div style="text-align:center;padding:20px;color:var(--text-3)">AI belum punya data. Edit kolom HPP di Activity Line untuk melatih AI.</div>';

    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: '🤖 AI HPP — Learning Stats',
      size: 'modal-md',
      body: '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin-bottom:var(--s4)">'
        + statsCards + '</div>'
        + '<div style="font-size:12px;color:var(--text-3);margin-bottom:var(--s3)">AI belajar dari setiap perubahan HPP yang Anda buat. Keyword unik: <strong style="color:var(--primary-h)">'+stats.kwCount+'</strong></div>'
        + learnedSection,
      footer: '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="InventoryModule.hppAIReset();Modal.close(\'' + mid + '\')" >Reset AI</button>'
        + '<button class="btn btn-ghost" onclick="Modal.close(\'' + mid + '\')" >Tutup</button>',
    });
  }

  function _aiSuggestHPP(id) {
    const jenisEl = document.getElementById('ivf-jenis-'+id);
    const kodeEl  = document.getElementById('ivf-kode-'+id);
    const hppEl   = document.getElementById('ivf-hpp-'+id);
    // Get item name from current row data
    const trEl    = document.getElementById('iv-row-'+id);
    const row     = _logs.find(r=>r.id===id);
    const itemNama = row?.itemNama || '';
    const jenis   = jenisEl?.value || '';
    const kode    = kodeEl?.value  || '';
    const suggested = _suggestHPP(kode, jenis, itemNama);
    if (hppEl && suggested !== null) {
      hppEl.value = suggested ? 'ya' : 'tidak';
      _updateHPPBadge(id, suggested);
      Notify.success('AI: HPP = '+(suggested?'Ya':'Tidak')+' (berdasarkan kode & jenis)');
    } else {
      Notify.warning('AI tidak dapat menentukan HPP. Pilih manual.');
    }
  }

  function _onKodeChange(id) {
    // When kode changes, re-suggest HPP
    const kodeEl = document.getElementById('ivf-kode-'+id);
    const jenisEl= document.getElementById('ivf-jenis-'+id);
    const hppEl  = document.getElementById('ivf-hpp-'+id);
    const row    = _logs.find(r=>r.id===id);
    if (!row) return;
    const kode   = kodeEl?.value  || '';
    const jenis  = jenisEl?.value || '';
    const suggested = _suggestHPP(kode, jenis, row.itemNama||'');
    if (suggested !== null && hppEl) {
      hppEl.value = suggested ? 'ya' : 'tidak';
      _updateHPPBadge(id, suggested);
    }
    // Also update kodeAktivitas auto-suggest for STOCK IN
    if (kode==='STOCK IN' || kode==='OPNAME') {
      const jenisSelEl = document.getElementById('ivf-jenis-'+id);
      if (jenisSelEl && kode==='STOCK IN') jenisSelEl.value = 'MASUK';
    }
  }

  function _onQtyChange(id, val) {
    // Saat qty berubah, recalc harga KELUAR via FIFO
    const jenisEl = document.getElementById('ivf-jenis-'+id);
    if (!jenisEl || jenisEl.value !== 'KELUAR') return;
    const row  = _logs.find(r=>r.id===id);
    if (!row || !row.itemId) return;
    const qty  = parseFloat(val) || 0;
    if (qty <= 0) return;
    const hargaEl = document.getElementById('ivf-harga-'+id);
    if (hargaEl) {
      hargaEl.value = _getFIFOAveragePrice(row.itemId, qty);
    }
  }

  function _onJenisChange(id) {
    // When jenis changes, re-calc harga via FIFO
    const jenisEl = document.getElementById('ivf-jenis-'+id);
    const jenis   = jenisEl?.value || 'MASUK';
    const row     = _logs.find(r=>r.id===id);
    if (!row || !row.itemId) return;
    const hargaEl  = document.getElementById('ivf-harga-'+id);
    const jumlahEl = document.getElementById('ivf-jumlah-'+id);
    const qty = parseFloat(jumlahEl?.value)||1;
    if (hargaEl) {
      const itemRef = _items.find(i=>i.id===row.itemId);
      hargaEl.value = jenis==='KELUAR'
        ? _getFIFOAveragePrice(row.itemId, qty)
        : (itemRef?._weightedAvgPrice || itemRef?.hargaSatuan || 0);
    }
    // Re-suggest HPP
    const kodeEl = document.getElementById('ivf-kode-'+id);
    const hppEl  = document.getElementById('ivf-hpp-'+id);
    const suggested = _suggestHPP(kodeEl?.value||'', jenis, row.itemNama||'');
    if (suggested !== null && hppEl) {
      hppEl.value = suggested ? 'ya' : 'tidak';
      _updateHPPBadge(id, suggested);
    }
  }

  
  function setSearch(val) {
    const inp = document.getElementById('inv-stok-search');
    const pos = inp ? inp.selectionStart : val.length;
    _search = (val||'').toLowerCase();
    _stokPage = 1;
    renderStok();
    requestAnimationFrame(()=>{
      const el = document.getElementById('inv-stok-search');
      if(el){ el.focus(); try{el.setSelectionRange(pos,pos);}catch(e){} }
    });
  }

  /* ===================== TAB: LAPORAN BULANAN ===================== */
  function setLaporanBulan(bulan) {
    _laporanBulan = bulan;
    renderLaporanBulanan();
  }

  function renderLaporanBulanan() {
    const el = document.getElementById('inv-tab-laporan');
    if (!el) return;

    const BULAN = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const allMonths = [...new Set(_logs.filter(l=>l.tgl).map(l=>l.tgl.slice(0,7)))].sort();
    if (!allMonths.length) {
      el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-3)">Belum ada data activity. Import Activity Line terlebih dahulu.</div>';
      return;
    }
    const currMonth = (_laporanBulan && allMonths.includes(_laporanBulan)) ? _laporanBulan : allMonths[allMonths.length - 1];
    const [yr, mo] = currMonth.split('-');
    const bulanLabel = (BULAN[parseInt(mo)]||mo) + ' ' + yr;

    const monthLogs  = _logs.filter(l => l.tgl && l.tgl.startsWith(currMonth));
    const opnameLogs = monthLogs.filter(l => l.kodeAktivitas && l.kodeAktivitas.toUpperCase() === 'STOCK OPNAME');
    const masukLogs  = monthLogs.filter(l => l.jenis === 'MASUK' && (!l.kodeAktivitas || l.kodeAktivitas.toUpperCase() !== 'STOCK OPNAME'));
    const returLogs  = monthLogs.filter(l => l.isRetur || (l.kodeAktivitas && (l.kodeAktivitas.toUpperCase().includes('RUSAK') || l.kodeAktivitas.toUpperCase().includes('RETUR'))));
    const keluarLogs = monthLogs.filter(l => l.jenis === 'KELUAR' && !returLogs.includes(l));

    const totalMasukQty  = masukLogs.reduce((s,l)=>s+(l.jumlah||0),0);
    const totalMasukVal  = masukLogs.reduce((s,l)=>s+(l.jumlah||0)*(l.harga||0),0);
    const totalKeluarQty = keluarLogs.reduce((s,l)=>s+(l.jumlah||0),0);
    const totalKeluarHPP = keluarLogs.reduce((s,l)=>s+(l.hpp||(l.jumlah||0)*(l.harga||0)),0);
    const totalReturQty  = returLogs.reduce((s,l)=>s+(l.jumlah||0),0);
    const totalReturVal  = returLogs.reduce((s,l)=>s+(l.jumlah||0)*(l.harga||0),0);

    // Top 10 items by HPP keluar
    const byItem = {};
    keluarLogs.forEach(l => {
      if (!l.itemNama) return;
      if (!byItem[l.itemNama]) byItem[l.itemNama] = { nama:l.itemNama, qty:0, hpp:0 };
      byItem[l.itemNama].qty += l.jumlah||0;
      byItem[l.itemNama].hpp += l.hpp||(l.jumlah||0)*(l.harga||0);
    });
    const top10 = Object.values(byItem).sort((a,b)=>b.hpp-a.hpp).slice(0,10);

    el.innerHTML = `
      <div style="padding-top:var(--s4)">
        <div style="display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
          <span style="font-size:13px;color:var(--text-3)">Bulan:</span>
          <select onchange="InventoryModule.setLaporanBulan(this.value)"
            style="padding:5px 10px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface2);color:var(--text);font-size:13px">
            ${allMonths.map(m=>{const[y,m2]=m.split('-');return`<option value="${m}"${m===currMonth?' selected':''}>${(BULAN[parseInt(m2)]||m2)+' '+y}</option>`;}).join('')}
          </select>
          <span style="font-size:15px;font-weight:700;color:var(--heading)">Laporan Inventory — ${bulanLabel}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:var(--s3);margin-bottom:var(--s5)">
          ${[
            {l:'Stock In (Masuk)',    v:totalMasukQty.toFixed(2)+' unit',  sub:'Nilai: '+Utils.formatRupiah(totalMasukVal), c:'var(--success)'},
            {l:'Stock Out (Keluar)',  v:totalKeluarQty.toFixed(2)+' unit', sub:'HPP: '+Utils.formatRupiah(totalKeluarHPP), c:'var(--danger)'},
            {l:'Stock Opname',       v:opnameLogs.length+' item',          sub:'Data awal stok', c:'var(--primary)'},
            {l:'Rusak / Retur',      v:totalReturQty.toFixed(2)+' unit',   sub:'Nilai: '+Utils.formatRupiah(totalReturVal), c:'var(--warning)'},
          ].map(c=>`
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s4)">
              <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${c.l}</div>
              <div style="font-size:18px;font-weight:700;color:${c.c};font-family:var(--font-mono)">${c.v}</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px">${c.sub}</div>
            </div>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s5);align-items:start">

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
            <div style="padding:12px 18px;border-bottom:1px solid var(--border);font-size:14px;font-weight:700;color:var(--heading)">
              Top 10 Produk — HPP Tertinggi
            </div>
            <div class="table-scroll">
              <table class="table" style="font-size:12px">
                <thead><tr><th>#</th><th>Nama Produk</th><th class="num">Qty</th><th class="num">HPP</th></tr></thead>
                <tbody>
                  ${top10.length ? top10.map((it,i)=>`<tr>
                    <td class="text-muted">${i+1}</td>
                    <td style="font-weight:500">${it.nama}</td>
                    <td class="num" style="font-family:var(--font-mono)">${it.qty.toFixed(2)}</td>
                    <td class="num" style="font-family:var(--font-mono);color:var(--danger)">${Utils.formatRupiah(it.hpp)}</td>
                  </tr>`).join('')
                  : '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada data keluar</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
            <div style="padding:12px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:14px;font-weight:700;color:var(--heading)">⚠️ Barang Rusak / Retur</span>
              <span style="font-size:11px;color:var(--text-3)">${returLogs.length} transaksi</span>
            </div>
            <div class="table-scroll">
              <table class="table" style="font-size:12px">
                <thead><tr><th>Tanggal</th><th>Nama Produk</th><th class="num">Qty</th><th class="num">Nilai</th><th>Kode</th><th>PJ</th></tr></thead>
                <tbody>
                  ${returLogs.length ? returLogs.sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||'')).map(l=>{
                    const tgl2=(l.tgl||'').slice(8,10)+'-'+(l.tgl||'').slice(5,7)+'-'+(l.tgl||'').slice(0,4);
                    return `<tr>
                      <td style="white-space:nowrap;color:var(--text-2)">${tgl2||'-'}</td>
                      <td style="font-weight:500">${l.itemNama||'-'}</td>
                      <td class="num" style="font-family:var(--font-mono);color:var(--warning)">${(l.jumlah||0).toFixed(2)}</td>
                      <td class="num" style="font-family:var(--font-mono)">${Utils.formatRupiah((l.jumlah||0)*(l.harga||0))}</td>
                      <td><span class="badge badge-warning" style="font-size:10px">${l.kodeAktivitas||'-'}</span></td>
                      <td style="color:var(--text-3)">${l.penanggungJawab||'-'}</td>
                    </tr>`;
                  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-3)">Tidak ada data rusak/retur</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  /* ===================== TAB: SUMMARY (3-BULAN) ===================== */
  function renderSummary() {
    const el = document.getElementById('inv-tab-summary');
    if (!el) return;

    const BULAN = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
    const _bl = m => { const [y,m2]=m.split('-'); return (BULAN[parseInt(m2)]||m2)+' '+y; };

    const allMonths = [...new Set(_logs.filter(l=>l.tgl).map(l=>l.tgl.slice(0,7)))].sort();
    if (!allMonths.length) {
      el.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-3)">Belum ada data activity. Import Activity Line terlebih dahulu.</div>';
      return;
    }
    const last3 = allMonths.slice(-3);

    // Build stats per month
    const stats = last3.map(m => {
      const logs    = _logs.filter(l => l.tgl && l.tgl.startsWith(m));
      const retur   = logs.filter(l => l.isRetur || (l.kodeAktivitas && (l.kodeAktivitas.toUpperCase().includes('RUSAK')||l.kodeAktivitas.toUpperCase().includes('RETUR'))));
      const masuk   = logs.filter(l => l.jenis==='MASUK' && (!l.kodeAktivitas||l.kodeAktivitas.toUpperCase()!=='STOCK OPNAME'));
      const keluar  = logs.filter(l => l.jenis==='KELUAR' && !retur.includes(l));
      const masukVal   = masuk.reduce((s,l)=>s+(l.jumlah||0)*(l.harga||0),0);
      const keluarHPP  = keluar.reduce((s,l)=>s+(l.hpp||(l.jumlah||0)*(l.harga||0)),0);
      const returVal   = retur.reduce((s,l)=>s+(l.jumlah||0)*(l.harga||0),0);
      // HPP by kode
      const byKode = {};
      keluar.forEach(l => {
        const k = l.kodeAktivitas||'Lainnya';
        byKode[k] = (byKode[k]||0) + (l.hpp||(l.jumlah||0)*(l.harga||0));
      });
      return { m, label:_bl(m), masukCnt:masuk.length, keluarCnt:keluar.length, masukVal, keluarHPP, returVal, byKode };
    });

    // Top items across all 3 months (by HPP keluar)
    const itemMap = {};
    last3.forEach(m => {
      const logs = _logs.filter(l=>l.tgl&&l.tgl.startsWith(m)&&l.jenis==='KELUAR'&&!l.isRetur);
      logs.forEach(l => {
        if (!l.itemNama) return;
        if (!itemMap[l.itemNama]) itemMap[l.itemNama] = { nama:l.itemNama, months:{} };
        itemMap[l.itemNama].months[m] = (itemMap[l.itemNama].months[m]||0) + (l.hpp||(l.jumlah||0)*(l.harga||0));
      });
    });
    const topItems = Object.values(itemMap)
      .map(it => ({ ...it, total: Object.values(it.months).reduce((s,v)=>s+v,0) }))
      .sort((a,b)=>b.total-a.total).slice(0,15);

    const maxHPP = Math.max(...stats.map(s=>s.keluarHPP), 1);

    // Analysis text
    const analysis = (() => {
      if (stats.length < 2) return '<div style="color:var(--text-3)">Minimal 2 bulan data diperlukan.</div>';
      const prev = stats[stats.length-2], curr = stats[stats.length-1];
      const hppDiff = curr.keluarHPP - prev.keluarHPP;
      const hppPct  = prev.keluarHPP > 0 ? ((hppDiff/prev.keluarHPP)*100).toFixed(1) : 0;
      const buyDiff = curr.masukVal - prev.masukVal;
      const buyPct  = prev.masukVal > 0 ? ((buyDiff/prev.masukVal)*100).toFixed(1) : 0;
      const retDiff = curr.returVal - prev.returVal;
      return `
        <div style="padding:var(--s3);background:var(--surface2);border-radius:var(--r-md)">
          <div style="font-weight:600;margin-bottom:6px">HPP ${curr.label} vs ${prev.label}</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${hppDiff>0?'var(--danger)':'var(--success)'}">
            ${hppDiff>0?'+':''}${Utils.formatRupiah(hppDiff)}
            <span style="font-size:13px">(${hppDiff>0?'+':''}${hppPct}%)</span>
          </div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">${hppDiff>0?'HPP meningkat — perlu evaluasi efisiensi':'HPP menurun — efisiensi membaik'}</div>
        </div>
        <div style="padding:var(--s3);background:var(--surface2);border-radius:var(--r-md)">
          <div style="font-weight:600;margin-bottom:6px">Pembelian ${curr.label} vs ${prev.label}</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${buyDiff>0?'var(--warning)':'var(--success)'}">
            ${buyDiff>0?'+':''}${Utils.formatRupiah(buyDiff)}
            <span style="font-size:13px">(${buyDiff>0?'+':''}${buyPct}%)</span>
          </div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">${buyDiff>0?'Pembelian meningkat':'Pembelian lebih efisien'}</div>
        </div>
        ${retDiff!==0?`
        <div style="padding:var(--s3);background:var(--surface2);border-radius:var(--r-md)">
          <div style="font-weight:600;margin-bottom:6px">Rusak/Retur ${curr.label} vs ${prev.label}</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${retDiff>0?'var(--danger)':'var(--success)'}">
            ${retDiff>0?'+':''}${Utils.formatRupiah(retDiff)}
          </div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">${retDiff>0?'Kerugian meningkat':'Kerugian berkurang'}</div>
        </div>`:''}
        ${topItems.length?`
        <div style="padding:var(--s3);background:var(--surface2);border-radius:var(--r-md)">
          <div style="font-weight:600;margin-bottom:8px">Top 5 Produk HPP (${curr.label})</div>
          ${topItems.slice(0,5).map((it,i)=>`
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
              <span>${i+1}. ${it.nama}</span>
              <span style="font-family:var(--font-mono);color:var(--danger)">${Utils.formatRupiah(it.months[curr.m]||0)}</span>
            </div>`).join('')}
        </div>`:''}
      `;
    })();

    el.innerHTML = `
      <div style="padding-top:var(--s4)">
        <div style="font-size:16px;font-weight:700;color:var(--heading);margin-bottom:var(--s5)">
          📈 Summary Inventory — Perbandingan ${last3.length} Bulan
        </div>

        <div style="display:grid;grid-template-columns:repeat(${last3.length},1fr);gap:var(--s4);margin-bottom:var(--s5)">
          ${stats.map(ms=>`
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
              <div style="padding:14px 18px;border-bottom:1px solid var(--border);background:var(--surface2);text-align:center">
                <div style="font-size:15px;font-weight:700;color:var(--heading)">${ms.label}</div>
              </div>
              <div style="padding:var(--s4)">
                ${[
                  {l:'Nilai Stock In',    v:Utils.formatRupiah(ms.masukVal),  c:'var(--success)'},
                  {l:'HPP Stock Out',     v:Utils.formatRupiah(ms.keluarHPP), c:'var(--danger)'},
                  {l:'Nilai Rusak/Retur', v:Utils.formatRupiah(ms.returVal),  c:'var(--warning)'},
                  {l:'Transaksi Masuk',   v:ms.masukCnt+' baris',             c:'var(--text-2)'},
                  {l:'Transaksi Keluar',  v:ms.keluarCnt+' baris',            c:'var(--text-2)'},
                ].map(r=>`
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
                    <span style="font-size:11px;color:var(--text-3)">${r.l}</span>
                    <span style="font-size:12px;font-weight:600;color:${r.c};font-family:var(--font-mono)">${r.v}</span>
                  </div>`).join('')}
                <div style="margin-top:var(--s3)">
                  <div style="font-size:10px;color:var(--text-3);margin-bottom:4px">HPP (relatif)</div>
                  <div style="background:var(--surface2);border-radius:4px;height:8px">
                    <div style="height:8px;width:${(ms.keluarHPP/maxHPP*100).toFixed(1)}%;background:var(--danger);border-radius:4px"></div>
                  </div>
                </div>
              </div>
            </div>`).join('')}
        </div>

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:var(--s5)">
          <div style="padding:12px 18px;border-bottom:1px solid var(--border);font-size:14px;font-weight:700;color:var(--heading)">
            Top 15 Produk — HPP per Bulan
          </div>
          <div class="table-scroll">
            <table class="table" style="font-size:12px">
              <thead><tr>
                <th>#</th><th>Nama Produk</th>
                ${last3.map(m=>`<th class="num">${_bl(m)}</th>`).join('')}
                <th class="num" style="color:var(--danger)">Total HPP</th>
              </tr></thead>
              <tbody>
                ${topItems.length ? topItems.map((it,i)=>`<tr>
                  <td class="text-muted">${i+1}</td>
                  <td style="font-weight:500">${it.nama}</td>
                  ${last3.map(m=>`<td class="num" style="font-family:var(--font-mono);color:var(--text-2)">${it.months[m]?Utils.formatRupiah(it.months[m]):'-'}</td>`).join('')}
                  <td class="num" style="font-family:var(--font-mono);font-weight:700;color:var(--danger)">${Utils.formatRupiah(it.total)}</td>
                </tr>`).join('')
                : `<tr><td colspan="${3+last3.length}" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada data keluar</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
          <div style="font-size:14px;font-weight:700;color:var(--heading);margin-bottom:var(--s4)">💡 Analisa</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s4);font-size:13px">
            ${analysis}
          </div>
        </div>
      </div>
    `;
  }

  // Force-save current edit to DB (pre-save to localStorage) without validation.
  // Called by app.js navigate() before page switch so in-progress data is not lost.
  function flushPendingEdit() {
    if (!_invEditId) return;
    const id = _invEditId;
    document.removeEventListener('click', _ivOutsideClick);
    _invEditId = null;
    _invCommit(id, true); // skipValidation = true
  }

  return {
    init,
    switchTab,
    setKatFilter,
    setSearch,
    setLaporanBulan,
    openItemModal,
    _submitItem,
    deleteItem,
    openTransaksiModal,
    _onItemChange,
    _submitTransaksi,
    startLogEdit,
    commitLogEdit,
    unlockInvRow,
    addLogRow,
    deleteLogRow,
    goInvLogPage,
    goStokPage,
    setStokPerPage,
    setInvLogPerPage,
    flushPendingEdit,
    renderOpnameTab,
    _onOpnameItemChange,
    _onOpnameJumlahChange,
    _submitOpname2,
    _ivOnItemSelect,
    _updateHPPBadge,
    _aiSuggestHPP,
    _onKodeChange,
    _onJenisChange,
    _onQtyChange,
    deleteOpnameRow,
    exportOpnameCSV,
    hppLearn,
    hppAIStats,
    hppAIReset,
    _showHPPAIInfo,
    renderLaporanBulanan,
    renderSummary,
    setLogFilterNama, setLogFilterTgl, clearLogFilter,
  };

})();

window.InventoryModule = InventoryModule;
