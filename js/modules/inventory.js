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

if(window.BECCA_DEBUG) console.log('[BECCA] InventoryModule v20260327k loaded');
const InventoryModule = (() => {

  let _items      = [];   // master barang
  let _itemLookup = new Map(); // id→item (String keys), always in sync with _items
  let _logs       = [];   // activity line (MASUK/KELUAR only)
  let _opnameLogs = [];   // stok opname (terpisah)
  let _activeTab   = 'stok';
  let _filterKat   = '';
  let _search      = '';
  let _laporanBulan = null; // selected month for laporan tab
  let _opnamePeriod = new Date().toISOString().slice(0,7); // period filter for opname
  let _opnameDraft  = {}; // itemId → value (string, as typed) — live draft state
  let _opnameTgl    = new Date().toISOString().slice(0,10);  // tanggal opname
  let _bulkSelected = new Set(); // bulk delete selection

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
    if (cachedLogs)   { _logs = cachedLogs; _logs.sort((a,b) => (b.tgl||'').localeCompare(a.tgl||'')); }
    if (cachedOpname) _opnameLogs = cachedOpname;

    // Reset edit state
    _invEditId = null;
    _invLogPage = 1;
    try { _invLocked = new Set(JSON.parse(localStorage.getItem(_INV_LOCK_KEY)||'[]')); } catch { _invLocked = new Set(); }

    // Render segera dengan data yang ada (cache atau kosong)
    _recalcStok();
    // Preserve active tab across re-init (e.g. navigating away and back)
    const restoreTab = _activeTab || 'stok';
    switchTab(restoreTab);

    // Fast first page for activity logs (heaviest table)
    if (!cachedLogs) {
      const first = await DB.getPage('inv_activities', { page:1, perPage:100, orderBy:'created_at', ascending:false });
      if (first.data.length) { _logs = first.data; _logs.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); _recalcStok(); }
    }

    // Background-load full dataset
    if (!cachedItems?.length || !cachedLogs?.length || !cachedOpname?.length) {
      const [freshItems, freshLogs, freshOpname] = await Promise.all([
        cachedItems?.length  ? Promise.resolve(cachedItems)  : DB.getInventoryItems(),
        cachedLogs?.length   ? Promise.resolve(cachedLogs)   : DB.getInventory(),
        cachedOpname?.length ? Promise.resolve(cachedOpname) : (typeof DB.getOpnameLogs === 'function' ? DB.getOpnameLogs().catch(()=>[]) : Promise.resolve([])),
      ]);
      if (freshItems?.length)  _items = freshItems;
      if (freshLogs?.length)   _logs  = freshLogs; else if (!_logs.length && freshLogs) _logs = freshLogs;
      _logs.sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));
      if (freshOpname?.length) _opnameLogs = freshOpname; else if (!_opnameLogs.length && freshOpname) _opnameLogs = freshOpname;

      // Auto-dedup: jika ada nama barang ganda (dari double-migration), bersihkan otomatis
      _checkAndDedup();

      // One-time migration: clear HPP on MASUK rows
      if (!localStorage.getItem('becca_hpp_masuk_fix')) {
        const toFix = _logs.filter(l => l.jenis === 'MASUK' && (l.hpp === true || l.hpp === 'ya'));
        if (toFix.length) {
          if(window.BECCA_DEBUG) console.log('[Inventory] Fixing HPP on ' + toFix.length + ' MASUK rows');
          for (const l of toFix) { l.hpp = null; DB.saveInventoryLog({...l}).catch(()=>{}); }
        }
        localStorage.setItem('becca_hpp_masuk_fix', '1');
      }

      // Hitung stok setiap item dari logs + auto-update hargaSatuan
      _recalcStok();
      _items.forEach(item => {
        if (item._hargaTerbaru && item._hargaTerbaru !== item._savedHarga) {
          DB.saveInventoryItem({...item}).catch(()=>{});
          item._savedHarga = item._hargaTerbaru;
        }
      });
      // Re-render current tab without switching away
      if (_activeTab === 'stok') renderStok();
      else if (_activeTab === 'transaksi') renderTransaksi();
      else if (_activeTab === 'laporan') renderLaporanBulanan();
      else if (_activeTab === 'summary') renderSummary();
      else if (_activeTab === 'alert') renderAlert();
      else if (_activeTab === 'opname') renderOpnameTab();
      // Update sync badges on tab + sidebar (without needing Activity Line to be active)
      _updateSyncBadges();
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
        _logs.sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));
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
      UndoRedo.setActive('inv');
      _bpDocsCache = null; // force refresh BP docs on tab switch
      // Render immediately with current data, then refresh from DB
      renderTransaksi();
      DB.getInventory().then(freshLogs => {
        if (!freshLogs || !freshLogs.length) { if(window.BECCA_DEBUG) console.warn('[Inventory] Fresh logs empty, keeping cached data'); return; }
        _logs = freshLogs;
        _logs.sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));
        _recalcStok();
        renderTransaksi();
      }).catch(() => {});
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
    // Pre-build log lookup map: itemId → {in, out} — avoids O(n·m) in render loop
    if (!_logStockMap || _logStockMapVer !== _logs.length) {
      _logStockMap = {};
      _logs.forEach(l => {
        if (!l.itemId) return;
        if (!_logStockMap[l.itemId]) _logStockMap[l.itemId] = { in:0, out:0 };
        if (l.jenis === 'MASUK') _logStockMap[l.itemId].in += (l.jumlah||0);
        else if (l.jenis === 'KELUAR') _logStockMap[l.itemId].out += (l.jumlah||0);
      });
      _logStockMapVer = _logs.length;
    }
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
          { l:'Stok Menipis',       v: _items.filter(i => (i.stokMin||0) > 0 && (i._stok||0) <= (i.stokMin||0)).length, c:'var(--warning)' },
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;flex:1 1 160px;min-width:0;max-width:220px">
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
                // Stock in/out from pre-built map (O(1) lookup)
                const _ls = _logStockMap[item.id] || { in:0, out:0 };
                const stockIn = _ls.in;
                const stockOut = _ls.out;
                return `
                  <tr>
                    <td class="text-muted text-small">${i_abs+1}</td>
                    <td>
                      <div class="font-semibold">${item.nama}</div>
                      ${item.keterangan ? `<div class="text-small text-muted">${item.keterangan}</div>` : ''}
                    </td>
                    <td><span class="badge badge-neutral">${item.kategori||'-'}</span></td>
                    <td class="num text-small" style="color:var(--success)">${+stockIn.toFixed(2)} ${item.satuan||''}</td>
                    <td class="num text-small" style="color:var(--danger)">${+stockOut.toFixed(2)} ${item.satuan||''}</td>
                    <td class="num font-semibold" style="color:${isEmpty?'var(--danger)':isLow?'var(--warning)':'var(--success)'}">
                      ${+stok.toFixed(2)} ${item.satuan||''}
                    </td>
                    <td class="num text-muted text-small">${+min.toFixed(2)} ${item.satuan||''}</td>
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
                  <td colspan="11">
                    ${UI.empty({iconKey:'box', title:'Belum ada data barang', desc:'Klik "Barang Baru" untuk menambahkan'})}
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
      ${UI.pagination({ page: _stokPage, totalPages: totalStokPg, total: filtered.length, perPage: _stokPerPage, onPage: 'InventoryModule.goStokPage', onPerPage: 'InventoryModule.setStokPerPage', label: 'barang' })}
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
  let _logStockMap   = null; // itemId → {in, out} — cached for render performance
  let _logStockMapVer = 0;
  let _invLogPage    = 1;
  let _invLogPerPage = parseInt(localStorage.getItem('becca_inv_log_perPage') || '50');
  let _logFilterNama = '';
  let _logFilterTgl  = '';
  let _invLocked   = new Set();
  const _INV_LOCK_KEY = 'becca_inv_locked_ids';

  // FIX: named function so removeEventListener works correctly
  function _ivOutsideClick(e) {
    if (!_invEditId) return;
    if (e.target.closest('.becca-combo-drop,.notify-popup,.notify-container')) return;
    const el = document.getElementById('iv-row-'+_invEditId);
    if (el && !el.contains(e.target)) {
      const id = _invEditId;
      document.removeEventListener('click', _ivOutsideClick);
      // Jika baris baru kosong, cancel saja (bukan commit)
      const row = _logs.find(r => r.id === id);
      if (row && row._isNew && !row.itemId) {
        cancelLogEdit(id);
        return;
      }
      const ok = _invCommit(id);
      if (ok) _invEditId = null;
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
  function clearLogFilter() {
    const btn = document.getElementById('inv-log-reset');
    if (btn) { btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 600); }
    _logFilterNama = ''; _logFilterTgl = ''; _invLogPage = 1; renderTransaksi();
  }

  /* ═══ SYNC FORM PRODUKSI → ACTIVITY LINE ═══ */
  let _syncChecked = {}; // formId → Set of checked item indices
  let _bpDocsCache = null; // cached belanja pasar docs for sync dashboard

  async function _updateSyncBadges() {
    let forms = [];
    try { forms = await DB.getDailyOrderForms(); } catch {}
    // Build syncTag lookup map once — O(n) instead of O(n*m) nested filters
    const stMap = {};
    _logs.forEach(l => { if (l.syncTag) (stMap[l.syncTag] = stMap[l.syncTag]||[]).push(l); });

    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3);
    const cutoffStr = cutoff.getFullYear()+'-'+String(cutoff.getMonth()+1).padStart(2,'0')+'-'+String(cutoff.getDate()).padStart(2,'0');
    const relevant = forms.filter(f => f.tanggal >= cutoffStr && (f.items||[]).some(it => _n(it.estQty)>0 || _n(it.aktQty)>0));
    let pendingProduksi = relevant.filter(f => {
      const sl = stMap['do_'+(f.tanggal||'').replace(/-/g,'')+'_'+f.shift] || [];
      const si = (f.items||[]).filter(it => _n(it.estQty)>0 || _n(it.aktQty)>0);
      return sl.length < si.length;
    }).length;

    let bpDocs = [];
    try { bpDocs = await DB.getBelanjaPasar(); } catch {}
    const pendingBP = bpDocs.filter(d => {
      if (d.kasStatus !== 'confirmed') return false;
      const sl = stMap['bp_'+d.id] || [];
      const si = (d.kasItems||[]).filter(it => _n(it.aktQty)>0);
      return sl.length < si.length;
    }).length;

    const totalPending = pendingProduksi + pendingBP;

    // Activity Line tab badge
    const tabBtn = document.getElementById('inv-tab-btn-transaksi');
    if (tabBtn) {
      const old = tabBtn.querySelector('.sync-badge');
      if (old) old.remove();
      if (totalPending > 0) {
        tabBtn.style.position = 'relative';
        tabBtn.insertAdjacentHTML('beforeend',
          `<span class="sync-badge" style="position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid var(--surface)">${totalPending}</span>`);
      }
    }
    // Sidebar badge
    const sideLink = document.querySelector('[data-page="inventory"]');
    if (sideLink) {
      const old = sideLink.querySelector('.sync-badge');
      if (old) old.remove();
      if (totalPending > 0) {
        sideLink.style.position = 'relative';
        sideLink.insertAdjacentHTML('beforeend',
          `<span class="sync-badge" style="position:absolute;top:4px;right:4px;min-width:14px;height:14px;background:#ef4444;color:#fff;font-size:8px;font-weight:700;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 3px">${totalPending}</span>`);
      }
    }
  }

  async function _renderSyncDashboard(tab) {
    let el = document.getElementById('inv-sync-dash');
    if (!el) {
      el = document.createElement('div'); el.id = 'inv-sync-dash';
      el.style.cssText = 'margin-bottom:12px';
      tab.insertBefore(el, tab.firstChild);
    }
    // Load daily order forms dari DB (cross-device)
    let forms = [];
    try { forms = await DB.getDailyOrderForms(); } catch(e) {
      try { forms = JSON.parse(localStorage.getItem('becca_daily_order_forms')||'[]'); } catch {}
    }
    if (!forms.length) { el.innerHTML = ''; return; }

    const today = new Date().toISOString().slice(0,10);
    // Show forms with aktual data from last 3 days + today
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-3);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    // Show forms that have estQty OR aktQty data (not just aktQty)
    const relevant = forms.filter(f => f.tanggal >= cutoffStr && (f.items||[]).some(it => _n(it.estQty) > 0 || _n(it.aktQty) > 0));
    if (!relevant.length) { el.innerHTML = ''; return; }

    // Build syncTag lookup — O(1) per form instead of O(logs)
    const stMap = {};
    _logs.forEach(l => { if (l.syncTag) (stMap[l.syncTag] = stMap[l.syncTag]||[]).push(l); });
    const cards = relevant.sort((a,b) => (b.tanggal||'').localeCompare(a.tanggal||'')).map(f => {
      const syncTag = 'do_' + (f.tanggal||'').replace(/-/g,'') + '_' + f.shift;
      const syncedLogs = stMap[syncTag] || [];
      const syncItems = (f.items||[]).filter(it => _n(it.estQty) > 0 || _n(it.aktQty) > 0);
      const totalItems = syncItems.length;
      const syncedCount = syncedLogs.length;
      const needsUpdate = syncItems.some(it => {
        const baseQty = _n(it.aktQty) > 0 ? _n(it.aktQty) : _n(it.estQty);
        const log = syncedLogs.find(l => (l.itemNama||'').toLowerCase() === (it.item||'').toLowerCase());
        return log && log.jumlah !== baseQty;
      });
      const isFullSync = syncedCount >= totalItems && !needsUpdate;
      const shiftLabel = (f.shift||'').startsWith('EVT') ? 'C'+(f.shift||'').replace('EVT','') :
        {S1:'Shift 1',S2:'Shift 2&3',SNK1:'Snack 1',SNK2:'Snack 2',SNK3:'Snack 3',SNK4:'Snack Brt'}[f.shift]||f.shift;
      const dateLabel = new Date(f.tanggal+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short'});
      const statusColor = isFullSync ? '#10b981' : syncedCount > 0 ? '#f59e0b' : 'var(--text-3)';
      const statusText = isFullSync ? 'Synced' : syncedCount > 0 ? (needsUpdate ? 'Update' : 'Partial') : 'Belum';
      const statusBg = isFullSync ? 'rgba(16,185,129,.1)' : syncedCount > 0 ? 'rgba(245,158,11,.1)' : 'var(--surface2)';

      return `<button onclick="InventoryModule.syncFormProduksi('${f.id}')" title="${f.tanggal} ${shiftLabel}"
        style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;
        border:1px solid ${isFullSync?'rgba(16,185,129,.3)':syncedCount>0?'rgba(245,158,11,.3)':'var(--border)'};
        border-radius:8px;background:${statusBg};cursor:pointer;min-width:70px;transition:.15s;
        ${isFullSync?'opacity:.5;filter:grayscale(.3)':''}"
        onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 2px 8px rgba(0,0,0,.1)';this.style.opacity='1';this.style.filter=''"
        onmouseout="this.style.transform='';this.style.boxShadow='';${isFullSync?`this.style.opacity='.5';this.style.filter='grayscale(.3)'`:``}">
        <span style="font-size:9px;font-weight:700;color:var(--text-3)">${dateLabel}</span>
        <span style="font-size:11px;font-weight:700;color:var(--text)">${shiftLabel}</span>
        <span style="font-size:9px;font-weight:700;color:${statusColor}">${isFullSync?'✓ Synced':statusText}</span>
        <span style="font-size:8px;color:var(--text-3)">${syncedCount}/${totalItems}</span>
      </button>`;
    }).join('');

    // Count pending for dashboard display
    const pendingCount = relevant.filter(f => {
      const sl = stMap['do_'+(f.tanggal||'').replace(/-/g,'')+'_'+f.shift] || [];
      const si = (f.items||[]).filter(it => _n(it.estQty)>0 || _n(it.aktQty)>0);
      return sl.length < si.length;
    }).length;

    // Badges handled by _updateSyncBadges (called on init + after sync)
    _updateSyncBadges();

    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M4 4v5h5M20 20v-5h-5"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
          Sync Form Produksi
          ${pendingCount>0?'<span style="background:#ef4444;color:#fff;font-size:9px;padding:1px 6px;border-radius:10px;font-weight:700">'+pendingCount+' pending</span>':''}
        </div>
        <div style="display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">${cards}</div>
      </div>`;

    // ── Belanja Pasar sync section ──
    if (!_bpDocsCache) { try { _bpDocsCache = await DB.getBelanjaPasar(); } catch { _bpDocsCache = []; } }
    const confirmedBP = _bpDocsCache.filter(d => d.kasStatus === 'confirmed');
    if (confirmedBP.length) {
      const bpCards = confirmedBP.map(d => {
        const syncTag = 'bp_' + d.id;
        const syncedLogs = stMap[syncTag] || [];
        const bpItems = (d.kasItems||[]).filter(it => _n(it.aktQty) > 0);
        const totalItems = bpItems.length;
        const syncedCount = syncedLogs.length;
        const isFullSync = syncedCount >= totalItems;
        const statusColor = isFullSync ? '#0891b2' : syncedCount > 0 ? '#f59e0b' : 'var(--text-3)';
        const statusText = isFullSync ? 'Synced' : syncedCount > 0 ? 'Partial' : 'Belum';
        const statusBg = isFullSync ? 'rgba(8,145,178,.1)' : syncedCount > 0 ? 'rgba(245,158,11,.1)' : 'var(--surface2)';
        const isAdmin = Auth.currentUser()?.role === 'superadmin' || Auth.currentUser()?.role === 'admin';
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;
          border:1px solid ${isFullSync?'rgba(8,145,178,.3)':syncedCount>0?'rgba(245,158,11,.3)':'var(--border)'};
          border-radius:8px;background:${statusBg};min-width:80px;position:relative">
          <div onclick="InventoryModule.syncBelanjaPasar('${d.id}')" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:100%"
            onmouseover="this.parentElement.style.transform='translateY(-1px)'" onmouseout="this.parentElement.style.transform=''">
            <span style="font-size:9px;font-weight:700;color:var(--text-3)">🛒 ${d.periode||'-'}</span>
            <span style="font-size:9px;font-weight:700;color:${statusColor}">${statusText}</span>
            <span style="font-size:8px;color:var(--text-3)">${syncedCount}/${totalItems}</span>
          </div>
          ${isAdmin ? `<button onclick="event.stopPropagation();InventoryModule.deleteBPSync('${d.id}')" title="Hapus sync belanja pasar"
            style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:99px;border:none;background:#ef4444;color:#fff;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700;line-height:1">×</button>` : ''}
        </div>`;
      }).join('');
      el.innerHTML += `
        <div style="background:var(--surface);border:1px solid rgba(8,145,178,.2);border-radius:10px;padding:10px 14px;margin-top:8px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#0891b2;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            🛒 Sync Belanja Pasar → Inventory (MASUK)
          </div>
          <div style="display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">${bpCards}</div>
        </div>`;
    }
  }

  async function syncFormProduksi(formId) {
    let forms = [];
    try { forms = await DB.getDailyOrderForms(); } catch(e) {
      try { forms = JSON.parse(localStorage.getItem('becca_daily_order_forms')||'[]'); } catch {}
    }
    const form = forms.find(f => f.id === formId);
    if (!form || !form.items?.length) { Notify.warning('Form tidak ditemukan'); return; }

    const syncTag = 'do_' + (form.tanggal||'').replace(/-/g,'') + '_' + form.shift;
    const syncedLogs = _logs.filter(l => l.syncTag === syncTag);
    // Use estQty for initial sync (first time), aktQty if already revised
    const syncItems = (form.items||[]).filter(it => _n(it.estQty) > 0 || _n(it.aktQty) > 0);
    const shiftLabel = (form.shift||'').startsWith('EVT') ? 'Event C'+(form.shift||'').replace('EVT','') :
      {S1:'SHIFT 1',S2:'SHIFT 2',SNK1:'SHIFT 1',SNK2:'SHIFT 2',SNK3:'SHIFT 3',SNK4:'SHIFT 3'}[form.shift]||form.shift;
    const dateLabel = new Date(form.tanggal+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});

    // Init checked state
    if (!_syncChecked[formId]) _syncChecked[formId] = new Set();
    const checked = _syncChecked[formId];

    // Build preview rows — initial qty from estQty, revisi column for adjustments
    const rows = syncItems.map((it, i) => {
      const invItem = _items.find(x => (x.nama||'').toLowerCase() === (it.item||'').toLowerCase());
      const existing = syncedLogs.find(l => (l.itemNama||'').toLowerCase() === (it.item||'').toLowerCase());
      const isNew = !existing;
      // First sync: use estQty. Re-sync after revision: prefer aktQty
      const baseQty = _n(it.aktQty) > 0 ? _n(it.aktQty) : _n(it.estQty);
      const qtyChanged = existing && existing.jumlah !== baseQty;
      const noMatch = !invItem;
      const isChecked = checked.has(i);
      const highlight = qtyChanged ? 'background:rgba(245,158,11,.12)' : isNew ? 'background:rgba(99,102,241,.06)' : '';
      const itemKey = (it.item||'').replace(/'/g,"\\'");
      return `<tr style="${highlight};border-bottom:1px solid var(--border)">
        <td style="padding:5px;text-align:center">
          ${noMatch ? '<span style="color:#ef4444;font-size:9px">-</span>' :
            `<input type="checkbox" ${isChecked?'checked':''} onchange="InventoryModule._toggleSyncCheck('${formId}',${i})"
              style="width:15px;height:15px;accent-color:#10b981;cursor:pointer">`}
        </td>
        <td style="padding:5px 6px;font-weight:600;font-size:11px${noMatch?';color:#ef4444;text-decoration:line-through':''}">${it.item||''}</td>
        <td style="padding:5px 6px;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:700">${baseQty}</td>
        <td style="padding:4px 3px;text-align:center">
          <input type="number" min="0" step="1" value="${baseQty}" data-sync-idx="${i}" data-item="${itemKey}" data-harga="${_n(it.hargaSatuan)}" data-orig="${baseQty}"
            style="width:55px;padding:3px 4px;text-align:right;border:1px solid var(--border);border-radius:4px;
            font-size:11px;font-family:var(--font-mono);background:var(--surface);color:var(--text)"
            onfocus="this.select()" oninput="InventoryModule._updateSyncTotals()">
        </td>
        <td style="padding:5px 6px;text-align:center;font-size:10px;color:var(--text-3)">${it.satuan||''}</td>
        <td style="padding:5px 6px;text-align:center;font-size:9px">
          ${noMatch ? '<span style="color:#ef4444;font-weight:700">NO MATCH</span>' :
            isNew ? '<span style="color:#6366f1;font-weight:700">BARU</span>' :
            qtyChanged ? '<span style="color:#f59e0b;font-weight:700">UPDATE</span>' :
            '<span style="color:#10b981">OK</span>'}
        </td>
      </tr>`;
    }).join('');

    const checkedCount = checked.size;
    const syncableCount = syncItems.filter((it,i) => _items.some(x => (x.nama||'').toLowerCase() === (it.item||'').toLowerCase())).length;

    const mid = 'sync-preview-' + Utils.uid();
    window._syncPreviewMid = mid;
    Modal.open({
      id: mid, title: 'Sync Form Produksi → Activity Line', size: 'modal-xl',
      body: `
        <style>.modal-xl{max-width:750px!important}</style>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:14px;font-weight:700">${dateLabel}</div>
            <div style="font-size:12px;color:var(--primary);font-weight:600">${shiftLabel}</div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--text-3)">
            ${syncItems.length} item &middot; ${syncedLogs.length} sudah sync
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${(()=>{
            const aktTotal = syncItems.reduce((s,it)=>s+(_n(it.aktQty)>0?_n(it.aktQty):_n(it.estQty))*_n(it.hargaSatuan),0);
            const budgetShift = _n(form._budget) || _n(form.budgetBelanja) || 0;
            const sisaAkt = budgetShift > 0 ? budgetShift - aktTotal : 0;
            const rp = n => 'Rp '+Math.round(n).toLocaleString('id');
            return `
            <div style="flex:1;min-width:100px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 10px">
              <div style="font-size:8px;font-weight:700;color:var(--text-3)">AKT TOTAL</div>
              <div style="font-size:13px;font-weight:800;color:#6366f1;font-family:var(--font-mono)">${rp(aktTotal)}</div>
            </div>
            <div style="flex:1;min-width:100px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:6px 10px">
              <div style="font-size:8px;font-weight:700;color:#f59e0b">REVISI TOTAL</div>
              <div style="font-size:13px;font-weight:800;color:#f59e0b;font-family:var(--font-mono)" id="sync-revisi-total">${rp(aktTotal)}</div>
            </div>
            <div style="flex:1;min-width:100px;background:${sisaAkt>=0?'rgba(16,185,129,.05)':'rgba(239,68,68,.05)'};border:1px solid ${sisaAkt>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'};border-radius:6px;padding:6px 10px">
              <div style="font-size:8px;font-weight:700;color:${sisaAkt>=0?'#10b981':'#ef4444'}">SISA AKT</div>
              <div style="font-size:13px;font-weight:800;font-family:var(--font-mono);color:${sisaAkt>=0?'#10b981':'#ef4444'}" id="sync-sisa-total">${sisaAkt>=0?'+':'-'}${rp(Math.abs(sisaAkt))}</div>
              <div style="font-size:8px;color:var(--text-3)" id="sync-sisa-label" data-budget="${budgetShift}">${budgetShift>0?'Budget: '+rp(budgetShift):'budget belum tersedia'}</div>
            </div>`;
          })()}
        </div>
        <div style="font-size:10px;color:var(--text-3);margin-bottom:6px;display:flex;gap:12px">
          <span><span style="display:inline-block;width:10px;height:10px;background:rgba(99,102,241,.15);border-radius:2px;margin-right:3px;vertical-align:middle"></span>Baru</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:rgba(245,158,11,.15);border-radius:2px;margin-right:3px;vertical-align:middle"></span>Qty berubah</span>
        </div>
        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:var(--surface2)">
              <th style="padding:5px;width:30px"></th>
              <th style="padding:5px 6px;text-align:left;font-size:9px;font-weight:700;color:var(--text-3)">ITEM</th>
              <th style="padding:5px 6px;text-align:right;font-size:9px;font-weight:700;color:var(--text-3)">AKT QTY</th>
              <th style="padding:5px 6px;text-align:center;font-size:9px;font-weight:700;color:#f59e0b">REVISI</th>
              <th style="padding:5px 6px;text-align:center;font-size:9px;font-weight:700;color:var(--text-3)">SAT</th>
              <th style="padding:5px 6px;text-align:center;font-size:9px;font-weight:700;color:var(--text-3)">STATUS</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--text-3)"><span class="sync-checked-count">${checkedCount}</span> / ${syncableCount} item dicentang</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost" onclick="Modal.close(window._syncPreviewMid)">Batal</button>
            <button class="btn btn-primary" onclick="InventoryModule._confirmSync('${formId}')"
              style="background:#10b981;border-color:#10b981;${checkedCount?'':'opacity:.4;pointer-events:none'}">
              Sync ${checkedCount} Item
            </button>
          </div>
        </div>`,
      buttons: []
    });
  }

  function _toggleSyncCheck(formId, idx) {
    if (!_syncChecked[formId]) _syncChecked[formId] = new Set();
    const s = _syncChecked[formId];
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    // Update button text + state tanpa refresh modal
    const cnt = s.size;
    const btn = document.querySelector('[onclick*="_confirmSync"]');
    if (btn) {
      btn.textContent = 'Sync ' + cnt + ' Item';
      btn.style.opacity = cnt ? '1' : '.4';
      btn.style.pointerEvents = cnt ? 'auto' : 'none';
    }
    const cntEl = document.querySelector('.sync-checked-count');
    if (cntEl) cntEl.textContent = cnt;
  }

  function _updateSyncTotals() {
    const rp = n => 'Rp '+Math.round(n).toLocaleString('id');
    let revTotal = 0, origTotal = 0;
    document.querySelectorAll('[data-sync-idx]').forEach(inp => {
      const qty = parseFloat(inp.value)||0;
      const harga = parseFloat(inp.dataset.harga)||0;
      const orig = parseFloat(inp.dataset.orig)||0;
      revTotal += qty * harga;
      origTotal += orig * harga;
      inp.style.borderColor = qty !== orig ? '#f59e0b' : 'var(--border)';
    });
    // Update Revisi Total
    const revEl = document.getElementById('sync-revisi-total');
    if (revEl) revEl.textContent = rp(revTotal);
    // Update Sisa AKT — budget - revisi total
    const sisaEl = document.getElementById('sync-sisa-total');
    const sisaLbl = document.getElementById('sync-sisa-label');
    if (sisaEl) {
      const budget = parseFloat(sisaLbl?.dataset?.budget)||0;
      if (budget > 0) {
        const sisa = budget - revTotal;
        sisaEl.textContent = (sisa>=0?'+':'-')+rp(Math.abs(sisa));
        sisaEl.style.color = sisa>=0?'#10b981':'#ef4444';
      }
    }
  }

  async function _confirmSync(formId) {
    let forms = [];
    try { forms = await DB.getDailyOrderForms(); } catch(e) {
      try { forms = JSON.parse(localStorage.getItem('becca_daily_order_forms')||'[]'); } catch {}
    }
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    const syncTag = 'do_' + (form.tanggal||'').replace(/-/g,'') + '_' + form.shift;
    const shiftCode = (form.shift||'').startsWith('EVT') ? 'EVENT' :
      {S1:'SHIFT 1',S2:'SHIFT 2',SNK1:'SHIFT 1',SNK2:'SHIFT 2',SNK3:'SHIFT 3',SNK4:'SHIFT 3'}[form.shift]||form.shift;
    const checked = _syncChecked[formId] || new Set();
    const syncItems = (form.items||[]).filter(it => _n(it.estQty) > 0 || _n(it.aktQty) > 0);
    let synced = 0, revised = 0;

    // Read revised QTY from DOM — keyed by item name for safety
    const revInputs = document.querySelectorAll('[data-sync-idx]');
    const revByName = {};
    revInputs.forEach(inp => {
      const name = (inp.dataset.item||'').toLowerCase().trim();
      if (name) revByName[name] = parseFloat(inp.value)||0;
    });

    for (const [i, it] of syncItems.entries()) {
      if (!checked.has(i)) continue;
      const invItem = _items.find(x => (x.nama||'').toLowerCase() === (it.item||'').toLowerCase());
      if (!invItem) continue;

      const baseQty = _n(it.aktQty) > 0 ? _n(it.aktQty) : _n(it.estQty);
      const itemKey = (it.item||'').toLowerCase().trim();
      const revQty = revByName[itemKey] !== undefined ? revByName[itemKey] : baseQty;
      const qtyToSync = revQty;

      // Write revisi back as aktQty in form produksi
      it.aktQty = revQty;
      it.aktTotal = revQty * _n(it.hargaSatuan);
      if (revQty !== baseQty) {
        it._syncRevised = true;
        revised++;
      }

      const existing = _logs.find(l => l.syncTag === syncTag && l.itemId === invItem.id);
      const logData = {
        id: existing?.id || undefined,
        tgl: form.tanggal, itemId: invItem.id, itemNama: invItem.nama,
        jenis: 'KELUAR', jumlah: qtyToSync, harga: _n(it.hargaSatuan),
        kodeAktivitas: shiftCode, hpp: true,
        pengambil: 'Form Produksi',
        penanggungJawab: (typeof Auth!=='undefined'&&Auth.currentUser()) ? (Auth.currentUser().nama||Auth.currentUser().username||'Sync') : 'Sync',
        catatan: '', syncTag,
      };
      try {
        const saved = await DB.saveInventoryLog(logData);
        if (existing) { Object.assign(existing, saved); }
        else { _logs.unshift(saved); }
        synced++;
      } catch(e) { console.warn('[Sync]', e); }
    }

    // Always save form back — aktQty updated from revisi
    if (synced > 0) {
      form.updatedAt = new Date().toISOString();
      try { await DB.saveDailyOrderForm(form); } catch(e) { console.warn('[Sync] save form:', e); }
    }

    // Log sync activity (#5: history tercatat)
    DB.logActivity({type:'sync_inventory', detail:`Sync ${synced} item dari ${(form.shift||'').startsWith('EVT')?'Event':'Shift'} ${form.tanggal}${revised?' ('+revised+' revisi)':''}`,
      snapshot:{syncTag, formId, synced, revised}});

    _syncChecked[formId] = new Set();
    Modal.close(window._syncPreviewMid);
    const msg = [synced + ' item di-sync'];
    if (revised) msg.push(revised + ' revisi QTY');
    Notify.success(msg.join(', '));
    renderTransaksi();
  }

  /* ── Sync Belanja Pasar → Inventory (MASUK) ─── */
  let _bpSyncChecked = {};
  async function syncBelanjaPasar(docId) {
    if (!_bpDocsCache) { try { _bpDocsCache = await DB.getBelanjaPasar(); } catch { _bpDocsCache = []; } }
    const bpDocs = _bpDocsCache;
    const doc = bpDocs.find(d => d.id === docId);
    if (!doc || !doc.kasItems?.length) { Notify.warning('Data belanja pasar tidak ditemukan'); return; }

    const syncTag = 'bp_' + doc.id;
    const syncedLogs = _logs.filter(l => l.syncTag === syncTag);
    const bpItems = doc.kasItems.filter(it => _n(it.aktQty) > 0);

    if (!_bpSyncChecked[docId]) _bpSyncChecked[docId] = new Set();
    const checked = _bpSyncChecked[docId];

    const rows = bpItems.map((it, i) => {
      const invItem = _items.find(x => (x.nama||'').toLowerCase() === (it.item||'').toLowerCase());
      const existing = syncedLogs.find(l => (l.itemNama||'').toLowerCase() === (it.item||'').toLowerCase());
      const noMatch = !invItem;
      const isChecked = checked.has(i);
      const isNew = !existing;
      const highlight = isNew ? 'background:rgba(8,145,178,.06)' : '';
      return `<tr style="${highlight};border-bottom:1px solid var(--border)">
        <td style="padding:5px;text-align:center">
          ${noMatch ? '<span style="color:#ef4444;font-size:9px">-</span>' :
            `<input type="checkbox" ${isChecked?'checked':''} onchange="InventoryModule._toggleBPSyncCheck('${docId}',${i})"
              style="width:15px;height:15px;accent-color:#0891b2;cursor:pointer">`}
        </td>
        <td style="padding:5px 6px;font-weight:600;font-size:11px${noMatch?';color:#ef4444;text-decoration:line-through':''}">${it.item||''}</td>
        <td style="padding:5px 6px;text-align:right;font-family:var(--font-mono);font-size:11px;font-weight:700">${_n(it.aktQty)}</td>
        <td style="padding:5px 6px;text-align:center;font-size:10px;color:var(--text-3)">${it.satuan||''}</td>
        <td style="padding:5px 6px;text-align:right;font-family:var(--font-mono);font-size:11px">Rp ${Math.round(_n(it.aktHarga)).toLocaleString('id')}</td>
        <td style="padding:5px 6px;text-align:center;font-size:9px">
          ${noMatch ? '<span style="color:#ef4444;font-weight:700">NO MATCH</span>' :
            isNew ? '<span style="color:#0891b2;font-weight:700">BARU</span>' :
            '<span style="color:#10b981">OK</span>'}
        </td>
      </tr>`;
    }).join('');

    const syncableCount = bpItems.filter(it => _items.some(x => (x.nama||'').toLowerCase() === (it.item||'').toLowerCase())).length;
    const mid = 'bp-sync-' + Utils.uid();
    window._bpSyncMid = mid;
    Modal.open({
      id: mid, title: '🛒 Sync Belanja Pasar → Inventory (MASUK)', size: 'modal-xl',
      body: `
        <style>.modal-xl{max-width:700px!important}</style>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <div><div style="font-size:14px;font-weight:700">${doc.periode||'-'}</div>
            <div style="font-size:11px;color:#0891b2;font-weight:600">Belanja Pasar → MASUK inventory</div></div>
          <div style="font-size:11px;color:var(--text-3)">${bpItems.length} item · ${syncedLogs.length} synced</div>
        </div>
        <div style="overflow-x:auto;max-height:50vh;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px"><thead>
            <tr style="background:rgba(8,145,178,.08)"><th style="padding:5px;width:30px">✓</th><th style="padding:5px;text-align:left">Item</th><th style="padding:5px;text-align:right;width:60px">QTY</th><th style="padding:5px;width:50px">Sat</th><th style="padding:5px;text-align:right;width:80px">Harga</th><th style="padding:5px;width:70px">Status</th></tr>
          </thead><tbody>${rows}</tbody></table>
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--text-3)"><span class="bp-sync-cnt">${checked.size}</span> / ${syncableCount} item</span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
            <button class="btn btn-primary" onclick="InventoryModule._confirmBPSync('${docId}')"
              style="background:#0891b2;border-color:#0891b2;${checked.size?'':'opacity:.4;pointer-events:none'}">
              Sync ${checked.size} Item
            </button>
          </div>
        </div>`,
      buttons: []
    });
  }

  function _toggleBPSyncCheck(docId, idx) {
    if (!_bpSyncChecked[docId]) _bpSyncChecked[docId] = new Set();
    const s = _bpSyncChecked[docId];
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    const cnt = s.size;
    const btn = document.querySelector('[onclick*="_confirmBPSync"]');
    if (btn) { btn.textContent = 'Sync ' + cnt + ' Item'; btn.style.opacity = cnt?'1':'.4'; btn.style.pointerEvents = cnt?'auto':'none'; }
    const cntEl = document.querySelector('.bp-sync-cnt');
    if (cntEl) cntEl.textContent = cnt;
  }

  async function _confirmBPSync(docId) {
    if (!_bpDocsCache) { try { _bpDocsCache = await DB.getBelanjaPasar(); } catch { _bpDocsCache = []; } }
    const doc = _bpDocsCache.find(d => d.id === docId);
    if (!doc) return;

    const syncTag = 'bp_' + doc.id;
    const checked = _bpSyncChecked[docId] || new Set();
    const bpItems = (doc.kasItems||[]).filter(it => _n(it.aktQty) > 0);
    let synced = 0;

    for (const [i, it] of bpItems.entries()) {
      if (!checked.has(i)) continue;
      const invItem = _items.find(x => (x.nama||'').toLowerCase() === (it.item||'').toLowerCase());
      if (!invItem) continue;

      const existing = _logs.find(l => l.syncTag === syncTag && l.itemId === invItem.id);
      const logData = {
        id: existing?.id || undefined,
        tgl: new Date().toISOString().slice(0,10),
        itemId: invItem.id, itemNama: invItem.nama,
        jenis: 'MASUK', jumlah: _n(it.aktQty), harga: _n(it.aktHarga),
        kodeAktivitas: 'BELANJA PASAR', hpp: false,
        pengambil: 'Belanja Pasar',
        penanggungJawab: Auth.currentUser()?.nama || 'Sync',
        catatan: doc.periode || '',
        syncTag,
        sourceFormIds: (doc.selectedForms||[]).map(sf => sf.formId),
      };
      try {
        const saved = await DB.saveInventoryLog(logData);
        if (existing) Object.assign(existing, saved);
        else _logs.unshift(saved);
        synced++;
      } catch(e) { console.warn('[BPSync]', e); }
    }

    if (synced > 0) {
      doc.invSyncStatus = 'synced';
      doc.invSyncedAt = new Date().toISOString();
      doc.invSyncedBy = Auth.currentUser()?.nama || '-';
      try { await DB.saveBelanjaPasar(doc); } catch {}
    }

    DB.logActivity({type:'sync_belanja_pasar', detail:`Sync ${synced} item belanja pasar → inventory (MASUK)`, snapshot:{syncTag, docId, synced}});
    _bpSyncChecked[docId] = new Set();
    Modal.close(window._bpSyncMid);
    Notify.success(synced + ' item MASUK ke inventory');
    renderTransaksi();
  }

  async function deleteBPSync(docId) {
    const role = Auth.currentUser()?.role;
    if (role !== 'superadmin' && role !== 'admin') { Notify.warning('Hanya Admin/Superadmin'); return; }

    // Refresh logs from DB to get accurate sync state
    try { _logs = await DB.getInventory(); _logs.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); } catch {}
    const syncTag = 'bp_' + docId;
    const syncedLogs = _logs.filter(l => l.syncTag === syncTag);

    // Use cached docs
    if (!_bpDocsCache) { try { _bpDocsCache = await DB.getBelanjaPasar(); } catch { _bpDocsCache = []; } }
    const doc = _bpDocsCache.find(d => d.id === docId);
    const periode = doc?.periode || '-';

    // First confirmation
    const ok1 = await Modal.confirm({
      title: 'Hapus Sync Belanja Pasar',
      message: `<div style="font-size:13px">
        <p>Hapus sync <strong>🛒 ${periode}</strong>?</p>
        ${syncedLogs.length > 0 ? `<div style="margin-top:10px;padding:10px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px">
          <div style="font-weight:700;color:#ef4444;margin-bottom:4px">⚠ ${syncedLogs.length} item MASUK akan dihapus dari Activity Line:</div>
          <div style="max-height:150px;overflow-y:auto;font-size:11px;color:var(--text-2)">
            ${syncedLogs.map(l => `• ${l.itemNama} — ${l.jumlah} ${l.satuan||''}`).join('<br>')}
          </div>
          <div style="font-size:11px;color:#ef4444;margin-top:6px;font-weight:600">Stok inventory akan berkurang sesuai jumlah yang dihapus.</div>
        </div>` : '<p style="color:var(--text-3);margin-top:8px">Belum ada item yang ter-sync.</p>'}
      </div>`,
      danger: true,
      confirmText: 'Lanjut Hapus',
    });
    if (!ok1) return;

    // Second confirmation
    const ok2 = await Modal.confirm({
      title: 'Konfirmasi Ulang — Hapus Permanen',
      message: `<p style="color:#ef4444;font-weight:700;font-size:15px">⚠ Tindakan ini TIDAK BISA dibatalkan.</p>
        <p style="margin-top:10px"><strong>${syncedLogs.length} log MASUK</strong> akan dihapus permanen dan stok inventory akan berkurang.</p>
        <p style="margin-top:8px">Yakin ingin melanjutkan?</p>`,
      danger: true,
      confirmText: 'Ya, Hapus Permanen',
    });
    if (!ok2) return;

    // Delete all synced logs
    let deleted = 0;
    for (const log of syncedLogs) {
      try {
        await DB.deleteInventoryLog(log.id);
        _logs = _logs.filter(l => l.id !== log.id);
        deleted++;
      } catch(e) { console.warn('[DeleteBPSync]', e); }
    }

    // Reset doc sync status
    if (doc) {
      doc.invSyncStatus = null;
      doc.invSyncedAt = null;
      doc.invSyncedBy = null;
      try { await DB.saveBelanjaPasar(doc); } catch {}
    }

    // Recalc stock
    _recalcStok();

    DB.logActivity({type:'delete_bp_sync', detail:`Hapus sync belanja pasar ${periode}: ${deleted} log MASUK dihapus`, snapshot:{syncTag, docId, deleted}});
    Notify.success(`${deleted} log MASUK dihapus dari inventory`);
    renderTransaksi();
  }

  function _n(v) { return Number(v)||0; }

  function reArrangeInv() {
    _logs.sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));
    renderTransaksi();
    Notify.success('Data diurutkan berdasarkan tanggal');
  }

  function renderTransaksi() {
    const canEdit = Auth.can('inventory','edit');
    const sorted  = [..._logs]
      .filter(l => l.jenis !== 'OPNAME')
      .filter(l => !_logFilterNama || (l.itemNama||'').toLowerCase().includes(_logFilterNama))
      .filter(l => !_logFilterTgl  || (l.tgl||'') === _logFilterTgl);

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
        .iv-inp:focus{background:rgba(99,102,241,.08)}
        .iv-sel{width:100%;height:32px;border:none;outline:none;padding:0 4px;background:var(--surface3);color:var(--text);font-size:12px;font-family:var(--font);cursor:pointer;}
        .iv-num{text-align:right;font-family:var(--font-mono);}
        .iv-num .ivc{justify-content:flex-end;}
        .iv-del{width:26px;height:26px;border:none;background:transparent;cursor:pointer;color:var(--text-3);border-radius:4px;display:flex;align-items:center;justify-content:center;margin:auto;transition:all .15s;}
        .iv-del:hover{background:rgba(239,68,68,.15);color:var(--danger);}
        .iv-saved{animation:ivSv .5s ease;}@keyframes ivSv{0%{background:rgba(34,197,94,.25)}100%{background:transparent}}
        .iv-tbl tr.iv-synced td{background:rgba(139,92,246,.04)!important;border-left-color:rgba(139,92,246,.15)}
        .iv-tbl tr.iv-synced:hover td{background:rgba(139,92,246,.1)!important}
        .iv-tbl tr.iv-synced td:first-child{border-left:3px solid #8b5cf6!important}
        .iv-tbl tr.iv-bp-synced td{background:rgba(8,145,178,.04)!important}
        .iv-tbl tr.iv-bp-synced:hover td{background:rgba(8,145,178,.1)!important}
        .iv-tbl tr.iv-bp-synced td:first-child{border-left:3px solid #0891b2!important}
      `;
      document.head.appendChild(st);
    }

    const tab = document.getElementById('inv-tab-transaksi');
    if (!tab) return;

    // ── Sync Dashboard ──
    _renderSyncDashboard(tab);

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
        <button onclick="UndoRedo.undo('inv')" title="Undo (Ctrl+Z)" style="height:30px;width:30px;min-width:30px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:13px;${UndoRedo.canUndo('inv')?'':'opacity:.3;pointer-events:none'}">↩</button>
        <button onclick="UndoRedo.redo('inv')" title="Redo (Ctrl+Shift+Z)" style="height:30px;width:30px;min-width:30px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:13px;${UndoRedo.canRedo('inv')?'':'opacity:.3;pointer-events:none'}">↪</button>
        <button onclick="InventoryModule.reArrangeInv()" title="Urutkan berdasarkan tanggal" style="height:30px;padding:0 10px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;cursor:pointer;display:flex;align-items:center;gap:4px;color:var(--text-2);font-size:11px;font-weight:600;white-space:nowrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M3 6h18M3 12h12M3 18h6"/></svg>Re-arrange</button>
        <button id="inv-log-reset" class="filter-reset-btn" onclick="InventoryModule.clearLogFilter()">↺</button>
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
    if (resetBtn) {
      if (_logFilterNama || _logFilterTgl) resetBtn.classList.add('active');
      else resetBtn.classList.remove('active');
    }
    const countEl = document.getElementById('inv-log-count');
    if (countEl) countEl.textContent = sorted.length + ' baris';
    // Update undo/redo button state
    document.querySelectorAll('#inv-log-filter button[onclick*="UndoRedo"]').forEach(btn => {
      const isUndo = btn.onclick?.toString().includes('undo');
      const canDo = isUndo ? UndoRedo.canUndo('inv') : UndoRedo.canRedo('inv');
      btn.style.opacity = canDo ? '1' : '.3';
      btn.style.pointerEvents = canDo ? 'auto' : 'none';
    });

    // ── Table: always re-render ──
    let tableDiv = document.getElementById('inv-log-table');
    if (!tableDiv) {
      tableDiv = document.createElement('div');
      tableDiv.id = 'inv-log-table';
      tab.appendChild(tableDiv);
    }
    tableDiv.innerHTML = `
      ${canEdit ? '<div style="margin-bottom:8px"><span style="font-size:11px;color:var(--text-3);font-style:italic">Klik baris untuk edit · Enter untuk simpan · + untuk tambah baris baru</span></div>' : ''}
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="iv-tbl" id="inv-grid" data-grid-select>
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
            ${canEdit ? `<th style="width:28px;padding:0;text-align:center"><input type="checkbox" title="Pilih semua" onchange="InventoryModule._bulkToggleAll(this.checked)" style="cursor:pointer"></th>` : ''}
          </tr></thead>
          <tbody id="inv-tbody">
            ${pageData.length ? pageData.map((r,i)=>_ivRowView(r,i+1+offset,canEdit)).join('') :
              `<tr><td colspan="${canEdit?14:11}" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada data. Klik + di header untuk mulai.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${UI.pagination({ page: _invLogPage, totalPages: totalPages, total: sorted.length, perPage: _invLogPerPage, onPage: 'InventoryModule.goInvLogPage', onPerPage: 'InventoryModule.setInvLogPerPage', label: 'baris' })}
    `;
    // Wire GridSelect drag-copy & paste
    if (window.GridSelect) {
      GridSelect.onFill('inv-grid', _onGridFill);
      GridSelect.onPaste('inv-grid', _onGridPaste);
    }
  }

  // GridSelect column map: index → field name
  const _IV_COL_MAP = ['','tgl','itemNama','jenis','jumlah','harga','kodeAktivitas','hpp','pengambil','penanggungJawab','catatan'];

  function _onGridFill(tblId, colIdx, srcRow, targetRows, val) {
    const tbody = document.getElementById('inv-tbody');
    if (!tbody) return;
    const key = _IV_COL_MAP[colIdx];
    if (!key) return;
    const isNum = key==='jumlah'||key==='harga';
    const parsed = isNum ? parseFloat(String(val).replace(/[Rp\s\u00a0.]/g,'').replace(',','.'))||0 : val;
    let saved = 0;
    targetRows.forEach(ri => {
      const tr = tbody.children[ri]; if (!tr) return;
      const id = tr.dataset.id;
      const row = _logs.find(r=>r.id===id);
      if (!row || _invLocked.has(id)) return;
      row[key] = parsed;
      if (key==='jumlah'||key==='harga') _recalcStok();
      DB.saveInventoryLog({...row}).catch(()=>{});
      saved++;
    });
    if (saved) { Notify.success(saved+' baris diperbarui'); renderTransaksi(); renderStok(); }
  }

  function _onGridPaste(tblId, startRow, startCol, pasteRows) {
    const tbody = document.getElementById('inv-tbody');
    if (!tbody) return;
    let saved = 0;
    pasteRows.forEach((cols, ri) => {
      const tr = tbody.children[startRow+ri]; if (!tr) return;
      const id = tr.dataset.id;
      const row = _logs.find(r=>r.id===id);
      if (!row || _invLocked.has(id)) return;
      cols.forEach((val, ci) => {
        const key = _IV_COL_MAP[startCol+ci];
        if (!key) return;
        const isNum = key==='jumlah'||key==='harga';
        row[key] = isNum ? parseFloat(String(val).replace(/[Rp\s\u00a0.]/g,'').replace(',','.'))||0 : val;
      });
      DB.saveInventoryLog({...row}).catch(()=>{});
      saved++;
    });
    if (saved) { _recalcStok(); Notify.success(saved+' baris diperbarui'); renderTransaksi(); renderStok(); }
  }

  function _ivRowView(r, rowNum, canEdit) {
    const jColor = r.jenis==='MASUK'?'var(--success)':r.jenis==='KELUAR'?'var(--danger)':'var(--warning)';
    const isSync = !!r.syncTag;
    const isBPSync = isSync && (r.syncTag||'').startsWith('bp_');
    const syncClass = isBPSync ? ' iv-bp-synced' : isSync ? ' iv-synced' : '';
    return `<tr class="iv-view${syncClass}" id="iv-row-${r.id}" data-id="${r.id}"
              ${canEdit && !_invLocked.has(r.id) ? `ondblclick="InventoryModule.startLogEdit('${r.id}',event.target.closest('td')?.dataset?.field)"` : ''}>
      <td onclick="event.stopPropagation();${_invLocked.has(r.id)?`InventoryModule.unlockInvRow('${r.id}')`:'void(0)'}"
          title="${_invLocked.has(r.id)?'Klik untuk buka kunci':''}"
          style="cursor:${_invLocked.has(r.id)?'pointer':'default'}">
        <div class="ivc" style="justify-content:center;color:var(--text-3);font-size:11px">
          ${_invLocked.has(r.id) ? '🔒' : rowNum}
        </div>
      </td>
      <td data-field="ivf-tgl-${r.id}"><div class="ivc">${r.tgl?(r.tgl.split('-').reverse().join('-')):''}</div></td>
      <td data-field="ivf-item-txt-${r.id}"><div class="ivc">${r.itemNama||''}${isBPSync?'<span style="font-size:8px;background:rgba(8,145,178,.15);color:#0891b2;padding:1px 4px;border-radius:3px;margin-left:4px;font-weight:700;vertical-align:middle">PASAR</span>':isSync?'<span style="font-size:8px;background:rgba(139,92,246,.15);color:#8b5cf6;padding:1px 4px;border-radius:3px;margin-left:4px;font-weight:700;vertical-align:middle">SYNC</span>':''}</div></td>
      <td data-field="ivf-jenis-${r.id}"><div class="ivc"><span class="badge" style="background:${jColor}18;color:${jColor};border:1px solid ${jColor}40;font-size:10px">${r.jenis||''}</span></div></td>
      <td data-field="ivf-jumlah-${r.id}" class="iv-num"><div class="ivc">${r.jumlah||0}</div></td>
      <td data-field="ivf-harga-${r.id}" class="iv-num"><div class="ivc">${r.harga?Utils.formatRupiah(r.harga):'-'}</div></td>
      <td data-field="ivf-kode-${r.id}"><div class="ivc">${r.kodeAktivitas||''}</div></td>
      <td data-field="ivf-hpp-${r.id}" style="text-align:center"><div class="ivc" style="justify-content:center">
        ${r.jenis==='MASUK'?'<span style="font-size:11px;color:var(--text-3)">—</span>'
          :r.hpp===true||r.hpp==='ya'?'<span style="font-size:11px;font-weight:600;color:var(--success)">HPP</span>'
          :r.hpp===false||r.hpp==='tidak'?'<span style="font-size:11px;color:var(--text-3)">Non-HPP</span>'
          :'<span style="font-size:11px;font-weight:600;color:var(--success)">HPP</span>'}
      </div></td>
      <td data-field="ivf-sup-${r.id}"><div class="ivc">${r.pengambil||''}</div></td>
      <td data-field="ivf-pj-${r.id}"><div class="ivc">${r.penanggungJawab||''}</div></td>
      <td data-field="ivf-cat-${r.id}"><div class="ivc">${r.catatan||''}</div></td>
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
      </td>`:''}
      ${canEdit?`<td style="width:28px;padding:0;text-align:center" onclick="event.stopPropagation()">
        <input type="checkbox" class="iv-bulk-chk" data-id="${r.id}" ${_bulkSelected.has(r.id)?'checked':''}
          onchange="InventoryModule._bulkToggle('${r.id}',this.checked)" style="cursor:pointer">
      </td>`:''}\n    </tr>`;
  }

  function _ivRowEdit(r, rowNum, canEdit) {
    const jenisOpts = ['MASUK','KELUAR'].map(j=>`<option value="${j}" ${r.jenis===j?'selected':''}>${j}</option>`).join('');
    const curNama   = r.itemId ? (_items.find(i=>i.id===r.itemId)?.nama || r.itemNama || '') : '';
    return `<tr class="iv-editing" id="iv-row-${r.id}" data-id="${r.id}" onclick="event.stopPropagation()">
      <td><div class="ivc" style="justify-content:center;color:var(--primary-h);font-size:11px">${rowNum}</div></td>
      <td><input class="iv-inp" type="date" value="${r.tgl||''}" id="ivf-tgl-${r.id}" onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')"></td>
      <td style="position:relative;min-width:150px">
        <input type="hidden" id="ivf-item-${r.id}" value="${r.itemId||''}" data-nama="${Utils.esc(curNama)}">
        <input class="iv-inp" id="ivf-item-txt-${r.id}" type="text" autocomplete="off"
          placeholder="Cari barang..." value="${Utils.esc(curNama)}" style="min-width:140px"
          onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')">
      </td>
      <td><select class="iv-sel" id="ivf-jenis-${r.id}"
            onchange="InventoryModule._onJenisChange('${r.id}')"
            onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')"
            ${!r.itemId ? 'disabled style="opacity:.4;cursor:not-allowed" title=\"Pilih barang dulu\"' : ''}>${jenisOpts}</select></td>
      <td class="iv-num"><input class="iv-inp" type="number" min="0" value="${r.jumlah||0}" id="ivf-jumlah-${r.id}" style="text-align:right"
        oninput="InventoryModule._onQtyChange('${r.id}',this.value)"
        onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')"></td>
      <td class="iv-num"><input class="iv-inp" type="number" min="0" value="${r.harga||0}" id="ivf-harga-${r.id}" style="text-align:right" onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')"></td>
      <td><select class="iv-sel" id="ivf-kode-${r.id}"
            onchange="InventoryModule._onKodeChange('${r.id}')"
            onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')">
          ${['','SHIFT 1','SHIFT 2','SHIFT 3','RETUR / RUSAK','PENJUALAN','EVENT','STOCK IN','OPNAME'].map(k=>'<option value="'+k+'" '+(r.kodeAktivitas===k?'selected':'')+'>'+( k||'— Pilih —')+'</option>').join('')}
        </select></td>
      <td style="text-align:center;padding:0 4px">
        <select class="iv-sel" id="ivf-hpp-${r.id}" style="width:80px;font-size:11px"
          onchange="InventoryModule._updateHPPBadge('${r.id}',this.value==='ya')"
          onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')">
          <option value="" ${!r.hpp&&r.hpp!==false?'selected':''}>— AI —</option>
          <option value="ya" ${r.hpp===true||r.hpp==='ya'?'selected':''}>Ya</option>
          <option value="tidak" ${r.hpp===false||r.hpp==='tidak'?'selected':''}>Tidak</option>
        </select>
      </td>
      <td><input class="iv-inp" type="text" value="${(r.pengambil||'').replace(/"/g,'&quot;')}" id="ivf-sup-${r.id}" placeholder="Pengambil" onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')"></td>
      <td><input class="iv-inp" type="text" value="${(r.penanggungJawab||'').replace(/"/g,'&quot;')}" id="ivf-pj-${r.id}" placeholder="Penanggung Jawab" onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')"></td>
      <td><input class="iv-inp" type="text" value="${(r.catatan||'').replace(/"/g,'&quot;')}" id="ivf-cat-${r.id}" placeholder="Catatan"
        onkeydown="InventoryModule._logRowKeyDown(event,'${r.id}')"></td>
      ${canEdit?`<td><button class="iv-del" style="color:var(--success)" onclick="event.stopPropagation();InventoryModule.commitLogEdit('${r.id}')" title="Simpan">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20,6 9,17 4,12"/></svg>
      </button></td>`:''}
      ${canEdit?'<td style="width:28px"></td>':''}
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
    const itemHid = g('item');
    return {
      tgl:       g('tgl')?.value        || '',
      itemId:    itemHid?.value         || '',
      itemNama:  itemHid?.dataset?.nama || g('item-txt')?.value?.trim() || '',
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

  function startLogEdit(id, focusField) {
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
    row._original = JSON.stringify({tgl:row.tgl,itemId:row.itemId,itemNama:row.itemNama,jenis:row.jenis,
      jumlah:row.jumlah,harga:row.harga,kodeAktivitas:row.kodeAktivitas,
      hpp:row.hpp,pengambil:row.pengambil,penanggungJawab:row.penanggungJawab,catatan:row.catatan});
    const tbody   = document.getElementById('inv-tbody');
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const rowNum  = allRows.indexOf(trEl)+1;
    trEl.outerHTML = _ivRowEdit(row, rowNum, true);
    setTimeout(() => {
      const txtEl = document.getElementById('ivf-item-txt-'+id);
      if (txtEl) {
        // Frequency: count how many times each itemId appears in logs
        const freq = {};
        _logs.forEach(l => { if (l.itemId) freq[l.itemId] = (freq[l.itemId] || 0) + 1; });
        Utils.initCombo(txtEl,
          _items.map(i => ({ label: i.nama + (i.satuan ? ' ('+i.satuan+')' : ''), value: i.id, nama: i.nama })),
          { frequency: freq,
            onSelect: entry => {
              const hid = document.getElementById('ivf-item-'+id);
              if (hid) { hid.value = entry.value; hid.dataset.nama = entry.nama; }
              _ivOnItemSelect(id, entry.value, entry.label);
          }}
        );
        document.getElementById(focusField || 'ivf-item-txt-'+id)?.focus();
      }
      document.addEventListener('click', _ivOutsideClick);
    }, 50);
  }

  async function _invCommit(id, skipValidation = false) {
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
    const newStr = JSON.stringify({tgl:row.tgl,itemId:row.itemId,itemNama:row.itemNama,jenis:row.jenis,jumlah:row.jumlah,harga:row.harga,kodeAktivitas:row.kodeAktivitas,hpp:row.hpp,pengambil:row.pengambil,penanggungJawab:row.penanggungJawab,catatan:row.catatan});
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
    const origData = JSON.parse(origStr);
    UndoRedo.push('inv', {
      id, before: origData, after: {...row},
      save: async (data) => { const r = _logs.find(x=>x.id===id); if(r) { Object.assign(r,data); await DB.saveInventoryLog({...r}); } },
      render: () => renderTransaksi()
    });
    delete row._original; delete row._hasChanged; delete row._isNew;
    // AWAIT save — mencegah race condition saat switch tab
    try {
      await DB.saveInventoryLog(row);
      _recalcStok();
      if (row.jenis==='MASUK' && row.harga>0 && row.itemId) {
        const item = _items.find(i=>i.id===row.itemId);
        if (item) { item.hargaSatuan = row.harga; DB.saveInventoryItem(item).catch(()=>{}); }
      }
      const _ivBefore = (()=>{ try{return JSON.parse(origStr)}catch{return null} })();
      DB.logActivity({type:'edit_inventory', detail:'Edit: '+(row.itemNama||id), rowId:id, snapshot:{before:_ivBefore, after:{id:row.id,tgl:row.tgl,itemId:row.itemId,itemNama:row.itemNama,jenis:row.jenis,jumlah:row.jumlah,harga:row.harga,kodeAktivitas:row.kodeAktivitas,pengambil:row.pengambil,penanggungJawab:row.penanggungJawab,catatan:row.catatan}}});
      const newTr = document.getElementById('iv-row-'+id);
      if (newTr) { newTr.classList.add('iv-saved'); setTimeout(()=>newTr.classList.remove('iv-saved'),500); }
    } catch(e) { Notify.error('Gagal simpan', e.message); }
    return true;
  }

  async function commitLogEdit(id) {
    if (_invEditId !== id) return;
    document.removeEventListener('click', _ivOutsideClick);
    const ok = _invCommit(id);
    if (ok) _invEditId = null;
    // if !ok: _invEditId stays, listener re-attached in _invCommit
  }

  // Enter: save current row + open new row immediately
  function commitAndAddLogRow(id) {
    if (_invEditId !== id) return;
    document.removeEventListener('click', _ivOutsideClick);
    const ok = _invCommit(id);
    if (ok) { _invEditId = null; addLogRow(); }
  }

  // Esc: discard changes + close edit (no new row)
  function cancelLogEdit(id) {
    if (_invEditId !== id) return;
    document.removeEventListener('click', _ivOutsideClick);
    // Dismiss any validation popup
    document.getElementById('_val-popup')?.remove();
    const row = _logs.find(r => r.id === id);
    // If new empty row, delete it (check DOM value too, row data may be stale)
    const domItem = document.getElementById('ivf-item-'+id)?.value || '';
    if (row && row._isNew && !domItem && !(row.itemNama||'').trim()) {
      _invEditId = null;
      _logs = _logs.filter(r => r.id !== id);
      DB.deleteInventoryLog(id).catch(() => {});
      _renderActivityLog();
      Notify.info('Baris baru dibatalkan');
      return;
    }
    if (row?._original) {
      try { Object.assign(row, JSON.parse(row._original)); } catch {}
    }
    _invEditId = null;
    const trEl = document.getElementById('iv-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('inv-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl) + 1;
      trEl.outerHTML = _ivRowView(row, rowNum, true);
    }
  }

  function _logRowKeyDown(e, id) {
    if (e.key === 'Enter')       { e.preventDefault(); commitAndAddLogRow(id); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelLogEdit(id); }
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
    // Clear active filters so new empty row is visible
    if (_logFilterNama || _logFilterTgl) {
      _logFilterNama = ''; _logFilterTgl = '';
      const s = document.getElementById('inv-log-search'); if (s) s.value = '';
      const d = document.getElementById('inv-log-date'); if (d) d.value = '';
    }
    const today = new Date().toISOString().split('T')[0];
    const _user = (typeof Auth!=='undefined'&&Auth.currentUser()) ? (Auth.currentUser().nama||Auth.currentUser().username||'') : '';
    const newRow = {tgl:today,itemId:'',itemNama:'',jenis:'MASUK',jumlah:0,stokAkhir:0,harga:0,kodeAktivitas:'',hpp:0,pengambil:'',penanggungJawab:_user,catatan:''};
    try {
      const saved = await DB.saveInventoryLog(newRow);
      saved._isNew = true;  // strict validation until first commit
      _logs.unshift(saved);
      _invLogPage = 1;
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

  /* ── Bulk Delete ── */
  function _bulkToggle(id, checked) {
    if (checked) _bulkSelected.add(id); else _bulkSelected.delete(id);
    _renderBulkBar();
  }
  function _bulkToggleAll(checked) {
    const chks = document.querySelectorAll('.iv-bulk-chk');
    chks.forEach(c => { if (checked) _bulkSelected.add(c.dataset.id); else _bulkSelected.delete(c.dataset.id); c.checked = checked; });
    _renderBulkBar();
  }
  function _renderBulkBar() {
    let bar = document.getElementById('iv-bulk-bar');
    if (_bulkSelected.size === 0) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'iv-bulk-bar';
      bar.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:500;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:8px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.25);';
      document.body.appendChild(bar);
    }
    bar.innerHTML = `
      <span style="font-size:13px;font-weight:600;color:var(--text)">${_bulkSelected.size} dipilih</span>
      <button onclick="InventoryModule._bulkDelete()" style="padding:6px 16px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px">
        🗑 Hapus
      </button>
      <button onclick="InventoryModule._bulkClear()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;cursor:pointer">Batal</button>`;
  }
  function _bulkClear() {
    _bulkSelected.clear();
    document.querySelectorAll('.iv-bulk-chk').forEach(c => c.checked = false);
    const hdr = document.querySelector('#inv-grid thead input[type="checkbox"]');
    if (hdr) hdr.checked = false;
    _renderBulkBar();
  }
  async function _bulkDelete() {
    const count = _bulkSelected.size;
    const ok = await Modal.confirm({ title:'Hapus Bulk', message:`Hapus <strong>${count}</strong> baris inventory secara permanen?`, danger:true, confirmText:`Hapus ${count} Baris` });
    if (!ok) return;
    const ids = [..._bulkSelected];
    let deleted = 0;
    for (const id of ids) {
      try { await DB.deleteInventoryLog(id); _logs = _logs.filter(r=>r.id!==id); deleted++; } catch {}
    }
    _bulkSelected.clear();
    const bar = document.getElementById('iv-bulk-bar'); if (bar) bar.remove();
    _recalcStok();
    renderTransaksi(); renderStok();
    Notify.success(`${deleted} baris dihapus`);
    DB.logActivity({type:'bulk_delete_inventory', detail:`${deleted} baris dihapus`});
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
    data.hargaSatuan  = Utils.parseNum(data.hargaSatuan);
    if (editId) {
      data.id = editId;
      const existing = _items.find(i => String(i.id) === String(editId));
      if (existing) Utils.mergePreserve(data, existing);
    }
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
              <input name="jumlah" type="number" min="0" step="1" class="form-control" value="0" required>
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
    data.harga  = Utils.parseNum(data.harga);
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
    const low = _items.filter(i => (i.stokMin||0) > 0 && (i._stok||0) <= (i.stokMin||0))
                      .sort((a,b) => (a._stok||0) - (b._stok||0));
    document.getElementById('inv-tab-alert').innerHTML = low.length === 0 ? `
      ${UI.empty({iconKey:'check', title:'Semua stok aman', desc:'Tidak ada barang yang perlu restock', height:'40vh'})}` : `
      <div class="table-wrapper">
        <div class="table-scroll">
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
        </div>
      </div>`;
  }


  /* ===================== STOK OPNAME TAB ===================== */
  function renderOpnameTab() {
    // Filter: show if stok > 0 OR has transactions in selected period
    const periodItems = _items.filter(item => {
      if ((item._stok || 0) > 0) return true;
      return _logs.some(l => String(l.itemId) === String(item.id) && (l.tgl||'').startsWith(_opnamePeriod));
    }).sort((a,b) => {
      const k = (a.kategori||'').localeCompare(b.kategori||'');
      return k || (a.nama||'').localeCompare(b.nama||'');
    });

    const filledCount = periodItems.filter(it => _opnameDraft[it.id] !== undefined && _opnameDraft[it.id] !== '').length;
    const recentLogs  = [..._opnameLogs].filter(l=>(l.tgl||'').startsWith(_opnamePeriod)).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));

    document.getElementById('inv-tab-opname').innerHTML = `
      <!-- Header bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s4);flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:6px">
          <button class="btn btn-sm" onclick="InventoryModule._adjOpnamePeriod(-1)">‹</button>
          <input type="month" value="${_opnamePeriod}" onchange="InventoryModule._setOpnamePeriod(this.value)"
            style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-size:13px;font-weight:700;cursor:pointer">
          <button class="btn btn-sm" onclick="InventoryModule._adjOpnamePeriod(1)">›</button>
          <span style="font-size:12px;color:var(--text-3);margin-left:4px">${periodItems.length} barang aktif</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px">
            <label style="font-size:11px;color:var(--text-3);font-weight:600;white-space:nowrap">Tgl Opname</label>
            <input type="date" value="${_opnameTgl}" onchange="InventoryModule._setOpnameTgl(this.value)"
              style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-size:12px">
          </div>
          <button class="btn btn-ghost btn-sm" onclick="InventoryModule.exportOpnameCSV()">Export CSV</button>
          ${filledCount > 0 ? `
            <button class="btn btn-ghost btn-sm" onclick="InventoryModule._resetOpnameDraft()">Reset Draft</button>
            <button class="btn btn-primary" onclick="InventoryModule._submitOpnameBulk()">
              💾 Simpan ${filledCount} Item
            </button>` : ''}
        </div>
      </div>

      <!-- Spreadsheet grid -->
      <div class="table-wrapper">
        <div class="table-scroll">
          <table class="table" style="font-size:12px">
            <thead>
              <tr style="position:sticky;top:0;z-index:1">
                <th style="width:28px">#</th>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th style="width:52px">Sat.</th>
                <th class="num" style="color:#6366f1;width:90px">Stok Sistem</th>
                <th class="num" style="color:#f59e0b;width:130px">Jumlah Fisik</th>
                <th class="num" style="width:110px">Selisih</th>
              </tr>
            </thead>
            <tbody>
              ${periodItems.length === 0
                ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-3)">
                    Tidak ada barang aktif pada periode ${_opnamePeriod}
                   </td></tr>`
                : periodItems.map((item,i) => {
                    const stokSis  = item._stok || 0;
                    const draftVal = _opnameDraft[item.id];
                    const hasDraft = draftVal !== undefined && draftVal !== '';
                    const jumlah   = hasDraft ? parseFloat(draftVal) || 0 : null;
                    const selisih  = jumlah !== null ? jumlah - stokSis : null;
                    const sc       = selisih===null?'var(--text-3)':selisih===0?'var(--text-2)':selisih>0?'#10b981':'#ef4444';
                    return `
                      <tr id="op-row-${item.id}" style="${hasDraft?'background:rgba(99,102,241,.05)':''}">
                        <td class="text-muted text-small">${i+1}</td>
                        <td class="font-semibold">${Utils.esc(item.nama)}</td>
                        <td><span class="badge badge-neutral">${item.kategori||'-'}</span></td>
                        <td class="text-muted text-small">${item.satuan||''}</td>
                        <td class="num" style="color:#6366f1;font-family:var(--font-mono)">${+stokSis.toFixed(2)}</td>
                        <td class="num">
                          <input type="number" min="0" step="1"
                            id="op-in-${item.id}"
                            value="${hasDraft?draftVal:''}"
                            placeholder="${+stokSis.toFixed(2)}"
                            oninput="InventoryModule._onOpnameInput('${item.id}',${stokSis},'${item.satuan||''}')"
                            style="width:108px;padding:4px 7px;border:1px solid ${hasDraft?'#6366f1':'var(--border)'};
                              border-radius:5px;background:var(--surface);color:var(--text);font-size:12px;
                              text-align:right;font-family:var(--font-mono);outline:none;box-sizing:border-box">
                        </td>
                        <td class="num">
                          <span id="op-sel-${item.id}"
                            style="font-family:var(--font-mono);font-weight:600;font-size:12px;color:${sc}">
                            ${selisih===null?'—':(selisih>=0?'+':'')+selisih.toFixed(2)+' '+(item.satuan||'')}
                          </span>
                        </td>
                      </tr>`;
                  }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${filledCount > 0 ? `
        <div style="margin-top:var(--s3);display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-ghost" onclick="InventoryModule._resetOpnameDraft()">Reset Draft</button>
          <button class="btn btn-primary" onclick="InventoryModule._submitOpnameBulk()" style="min-width:200px">
            💾 Simpan Opname — ${filledCount} item terisi
          </button>
        </div>` : ''}

      <!-- Riwayat opname periode ini -->
      ${recentLogs.length > 0 ? `
        <div style="margin-top:var(--s5)">
          <div style="font-size:13px;font-weight:700;margin-bottom:var(--s3)">
            📋 Riwayat Opname — ${_opnamePeriod}
            <span style="font-size:11px;font-weight:400;color:var(--text-3);margin-left:6px">${recentLogs.length} record</span>
          </div>
          <div class="table-scroll">
            <table class="table" style="font-size:12px">
              <thead>
                <tr>
                  <th>Tanggal</th><th>Nama Barang</th>
                  <th class="num">Jumlah Fisik</th><th class="num">Stok Sistem</th>
                  <th class="num">Selisih</th><th>Catatan</th>
                  ${Auth.can('inventory','edit') ? '<th style="width:32px"></th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${recentLogs.map(l => {
                  const sel = (l.jumlah||0) - (l.stokSistem||0);
                  const sc  = sel===0?'var(--text-2)':sel>0?'#10b981':'#ef4444';
                  return `<tr>
                    <td style="white-space:nowrap">${(l.tgl||'').split('-').reverse().join('-')}</td>
                    <td class="font-semibold">${l.itemNama||''}</td>
                    <td class="num" style="font-family:var(--font-mono)">${l.jumlah||0}</td>
                    <td class="num text-muted" style="font-family:var(--font-mono)">${l.stokSistem??'-'}</td>
                    <td class="num font-semibold" style="color:${sc};font-family:var(--font-mono)">${sel>=0?'+':''}${sel}</td>
                    <td class="text-muted text-small">${l.catatan||''}</td>
                    ${Auth.can('inventory','edit') ? `<td><button class="iv-del" title="Hapus"
                      onclick="InventoryModule.deleteOpnameRow('${l.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                      </svg></button></td>` : ''}
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
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

  /* ===================== NEW OPNAME HELPERS ===================== */
  function _onOpnameInput(itemId, stokSistem, satuan) {
    const inp = document.getElementById('op-in-' + itemId);
    if (!inp) return;
    const val = inp.value;
    _opnameDraft[itemId] = val;
    inp.style.borderColor = val !== '' ? '#6366f1' : 'var(--border)';
    // Update row highlight
    const row = document.getElementById('op-row-' + itemId);
    if (row) row.style.background = val !== '' ? 'rgba(99,102,241,.05)' : '';
    // Update selisih cell instantly — no re-render needed
    const selEl = document.getElementById('op-sel-' + itemId);
    if (selEl) {
      if (val === '') {
        selEl.textContent = '—';
        selEl.style.color = 'var(--text-3)';
      } else {
        const jumlah  = parseFloat(val) || 0;
        const selisih = jumlah - stokSistem;
        selEl.textContent = (selisih >= 0 ? '+' : '') + selisih.toFixed(2) + ' ' + satuan;
        selEl.style.color = selisih === 0 ? 'var(--text-2)' : selisih > 0 ? '#10b981' : '#ef4444';
      }
    }
    // Update counter badges without re-render
    const filled = Object.values(_opnameDraft).filter(v => v !== '').length;
    document.querySelectorAll('.op-save-btn').forEach(el => {
      el.textContent = filled > 0 ? `💾 Simpan ${filled} Item` : '';
      el.style.display = filled > 0 ? '' : 'none';
    });
  }

  function _adjOpnamePeriod(delta) {
    const [y, m] = _opnamePeriod.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    _opnamePeriod = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    _opnameDraft  = {};
    renderOpnameTab();
  }

  function _setOpnamePeriod(val) {
    if (!val) return;
    _opnamePeriod = val;
    _opnameDraft  = {};
    renderOpnameTab();
  }

  function _setOpnameTgl(val) { _opnameTgl = val; }

  function _resetOpnameDraft() { _opnameDraft = {}; renderOpnameTab(); }

  async function _submitOpnameBulk() {
    const toSave = [];
    for (const item of _items) {
      const val = _opnameDraft[item.id];
      if (val === undefined || val === '') continue;
      const jumlah = parseFloat(val);
      if (isNaN(jumlah)) continue;
      toSave.push({ item, jumlah });
    }
    if (!toSave.length) { Notify.warning('Belum ada data yang diisi'); return; }

    // Confirmation with summary table
    const rowsHtml = toSave.slice(0, 15).map(({ item, jumlah }) => {
      const stokSis = item._stok || 0;
      const sel = jumlah - stokSis;
      const sc  = sel === 0 ? 'var(--text-2)' : sel > 0 ? '#10b981' : '#ef4444';
      return `<tr>
        <td style="padding:4px 8px;font-size:12px">${Utils.esc(item.nama)}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:right;font-family:monospace">${stokSis} → ${jumlah} ${item.satuan||''}</td>
        <td style="padding:4px 8px;font-size:12px;text-align:right;font-family:monospace;color:${sc};font-weight:700">${sel>=0?'+':''}${sel}</td>
      </tr>`;
    }).join('');
    const moreHtml = toSave.length > 15
      ? `<tr><td colspan="3" style="padding:4px 8px;font-size:11px;color:var(--text-3)">...dan ${toSave.length - 15} item lainnya</td></tr>`
      : '';

    const ok = await Modal.confirm({
      title   : `Simpan Stok Opname — ${_opnameTgl}`,
      message : `
        <p style="margin-bottom:8px;font-size:13px">Pastikan jumlah berikut sudah benar sebelum disimpan:</p>
        <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">
          <table style="width:100%;border-collapse:collapse">
            <thead style="background:var(--surface2);position:sticky;top:0">
              <tr>
                <th style="padding:6px 8px;font-size:11px;text-align:left">Barang</th>
                <th style="padding:6px 8px;font-size:11px;text-align:right">Sistem → Fisik</th>
                <th style="padding:6px 8px;font-size:11px;text-align:right">Selisih</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}${moreHtml}</tbody>
          </table>
        </div>
        <p style="margin-top:8px;font-size:12px;color:var(--text-3)">${toSave.length} item akan disimpan ke riwayat opname.</p>`,
      confirmText: 'Simpan Sekarang',
      danger: false,
    });
    if (!ok) return;

    let saved = 0;
    for (const { item, jumlah } of toSave) {
      const log = {
        tgl       : _opnameTgl,
        itemId    : item.id,
        itemNama  : item.nama,
        jumlah,
        stokSistem: item._stok || 0,
        selisih   : jumlah - (item._stok || 0),
        catatan   : 'Stok Opname ' + _opnamePeriod,
      };
      try {
        const s = await DB.saveOpnameLog(log);
        _opnameLogs.unshift(s);
        saved++;
      } catch(e) { console.error('[Opname] save error:', e); }
    }

    _opnameDraft = {};
    renderOpnameTab();
    Notify.success('Stok Opname tersimpan: ' + saved + ' item ✓');
    DB.logActivity({ type:'opname_bulk', detail:'Opname massal: '+saved+' item pada '+_opnameTgl });
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
      el.innerHTML = UI.empty({iconKey:'list', title:'Belum ada data activity', desc:'Import Activity Line terlebih dahulu'});
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
      el.innerHTML = UI.empty({iconKey:'chart', title:'Belum ada data activity', desc:'Import Activity Line terlebih dahulu'});
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
    commitAndAddLogRow,
    cancelLogEdit,
    _logRowKeyDown,
    unlockInvRow,
    addLogRow,
    deleteLogRow, _bulkToggle, _bulkToggleAll, _bulkDelete, _bulkClear,
    goInvLogPage,
    goStokPage,
    setStokPerPage,
    setInvLogPerPage,
    flushPendingEdit,
    renderOpnameTab,
    _onOpnameInput,
    _adjOpnamePeriod,
    _setOpnamePeriod,
    _setOpnameTgl,
    _resetOpnameDraft,
    _submitOpnameBulk,
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
    setLogFilterNama, setLogFilterTgl, clearLogFilter, reArrangeInv,
    syncFormProduksi, _toggleSyncCheck, _confirmSync, _updateSyncTotals,
    syncBelanjaPasar, _toggleBPSyncCheck, _confirmBPSync, deleteBPSync,
    get _invEditId() { return _invEditId; },
  };

})();

window.InventoryModule = InventoryModule;
