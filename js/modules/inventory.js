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
      </div>

      <div id="inv-tab-stok"></div>
      <div id="inv-tab-transaksi" class="hidden"></div>
      <div id="inv-tab-alert"     class="hidden"></div>
      <div id="inv-tab-opname"    class="hidden"></div>
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
    // Update header button based on active tab
    const hdrBtns = document.getElementById('inv-header-btns');
    if (hdrBtns && Auth.can('inventory','edit')) {
      if (tab === 'transaksi') {
        hdrBtns.innerHTML = ''; // Button is above table in renderTransaksi
      } else if (tab === 'opname') {
        hdrBtns.innerHTML = '';
      } else {
        hdrBtns.innerHTML = '<button class="btn btn-primary" onclick="InventoryModule.openItemModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d=\"M12 5v14M5 12h14\"/></svg> Barang Baru</button>';
      }
    }
    ['stok','transaksi','alert','opname'].forEach(t => {
      const tabContent = document.getElementById('inv-tab-'+t);
      if (tabContent) tabContent.classList.toggle('hidden', t !== tab);
      const tabBtn = document.getElementById('inv-tab-btn-'+t);
      if (tabBtn) tabBtn.classList.toggle('active', t === tab);
    });
    const renders = { stok: renderStok, transaksi: renderTransaksi, alert: renderAlert, opname: renderOpnameTab };
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
              ${filtered.length ? filtered.map((item, i) => {
                const stok    = item._stok || 0;
                const min     = item.stokMin || 0;
                const nilai   = stok * (item.hargaSatuan || 0);
                const isLow   = stok <= min;
                const isEmpty = stok <= 0;
                // Calculate stock in/out from logs
                const itemLogs = _logs.filter(l => l.itemId === item.id);
                const stockIn  = itemLogs.filter(l=>l.jenis==='MASUK').reduce((s,l)=>s+(l.jumlah||0),0);
                const stockOut = itemLogs.filter(l=>l.jenis==='KELUAR').reduce((s,l)=>s+(l.jumlah||0),0);
                return `
                  <tr>
                    <td class="text-muted text-small">${i+1}</td>
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
                  <td colspan="11" style="text-align:center;padding:40px;color:var(--text-3)">
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
  /* ===================== ACTIVITY LINE — click to edit ===================== */
  let _invEditId = null;

  // FIX: named function so removeEventListener works correctly
  function _ivOutsideClick(e) {
    if (!_invEditId) return;
    const el = document.getElementById('iv-row-'+_invEditId);
    if (el && !el.contains(e.target)) {
      _invCommit(_invEditId);
    }
  }

  function renderTransaksi() {
    const canEdit = Auth.can('inventory','edit');
    const sorted  = [..._logs].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));

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

    document.getElementById('inv-tab-transaksi').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;color:var(--text-3);font-style:italic">${canEdit ? 'Klik baris untuk edit · Enter untuk simpan' : ''}</span>
        <div style="display:flex;gap:var(--s2)">
          ${canEdit ? `
            <button class="btn btn-primary btn-sm" onclick="InventoryModule.addLogRow()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
              Baris Baru
            </button>` : ''}
        </div>
      </div>
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="iv-tbl" id="inv-grid">
          <thead><tr>
            <th style="width:32px">#</th>
            <th style="width:108px">Tanggal</th>
            <th style="min-width:160px">Nama Barang</th>
            <th style="width:90px">Jenis</th>
            <th style="width:75px" class="iv-num">Jumlah</th>
            <th style="width:100px" class="iv-num">Harga (Rp)</th>
            <th style="width:110px">Supplier</th>
            <th style="min-width:140px">Catatan</th>
            ${canEdit ? '<th style="width:32px"></th>' : ''}
          </tr></thead>
          <tbody id="inv-tbody">
            ${sorted.length ? sorted.map((r,i)=>_ivRowView(r,i+1,canEdit)).join('') :
              `<tr><td colspan="${canEdit?9:8}" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada data. Klik Baris Baru untuk mulai.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function _ivRowView(r, rowNum, canEdit) {
    const jColor = r.jenis==='MASUK'?'var(--success)':r.jenis==='KELUAR'?'var(--danger)':'var(--warning)';
    return `<tr class="iv-view" id="iv-row-${r.id}" data-id="${r.id}"
              ${canEdit?`onclick="InventoryModule.startLogEdit('${r.id}')"`  :''}>
      <td><div class="ivc" style="justify-content:center;color:var(--text-3);font-size:11px">${rowNum}</div></td>
      <td><div class="ivc">${r.tgl?(r.tgl.split('-').reverse().join('-')):''}</div></td>
      <td><div class="ivc">${r.itemNama||''}</div></td>
      <td><div class="ivc"><span class="badge" style="background:${jColor}18;color:${jColor};border:1px solid ${jColor}40;font-size:10px">${r.jenis||''}</span></div></td>
      <td class="iv-num"><div class="ivc">${r.jumlah||0}</div></td>
      <td class="iv-num"><div class="ivc">${r.harga?Utils.formatRupiah(r.harga):'-'}</div></td>
      <td><div class="ivc">${r.supplier||''}</div></td>
      <td><div class="ivc">${r.catatan||''}</div></td>
      ${canEdit?`<td><button class="iv-del" onclick="event.stopPropagation();InventoryModule.deleteLogRow('${r.id}')" title="Hapus">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
          <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
        </svg></button></td>`:''}
    </tr>`;
  }

  function _ivRowEdit(r, rowNum, canEdit) {
    const itemOpts  = _items.map(it=>`<option value="${it.id}" ${r.itemId===it.id?'selected':''}>${it.nama} (${it.satuan||''})</option>`).join('');
    const jenisOpts = ['MASUK','KELUAR'].map(j=>`<option value="${j}" ${r.jenis===j?'selected':''}>${j}</option>`).join('');
    return `<tr class="iv-editing" id="iv-row-${r.id}" data-id="${r.id}" onclick="event.stopPropagation()">
      <td><div class="ivc" style="justify-content:center;color:var(--primary-h);font-size:11px">${rowNum}</div></td>
      <td><input class="iv-inp" type="date" value="${r.tgl||''}" id="ivf-tgl-${r.id}"></td>
      <td><select class="iv-sel" id="ivf-item-${r.id}" onchange="InventoryModule._ivOnItemSelect('${r.id}',this.value,this.options[this.selectedIndex].text)"><option value="">Pilih barang...</option>${itemOpts}</select></td>
      <td><select class="iv-sel" id="ivf-jenis-${r.id}">${jenisOpts}</select></td>
      <td class="iv-num"><input class="iv-inp" type="number" min="0" value="${r.jumlah||0}" id="ivf-jumlah-${r.id}" style="text-align:right"
        onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      <td class="iv-num"><input class="iv-inp" type="number" min="0" value="${r.harga||0}" id="ivf-harga-${r.id}" style="text-align:right"></td>
      <td><input class="iv-inp" type="text" value="${(r.supplier||'').replace(/"/g,'&quot;')}" id="ivf-sup-${r.id}" placeholder="Supplier"></td>
      <td><input class="iv-inp" type="text" value="${(r.catatan||'').replace(/"/g,'&quot;')}" id="ivf-cat-${r.id}" placeholder="Catatan"
        onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      ${canEdit?`<td><button class="iv-del" style="color:var(--success)" onclick="event.stopPropagation();InventoryModule.commitLogEdit('${r.id}')" title="Simpan">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20,6 9,17 4,12"/></svg>
      </button></td>`:''}
    </tr>`;
  }

  function _ivOnItemSelect(id, itemId, labelText) {
    const item = _items.find(i=>i.id===itemId);
    // Update itemNama display after commit
    const hargaEl = document.getElementById('ivf-harga-'+id);
    if (!hargaEl) return;
    const jenisEl = document.getElementById('ivf-jenis-'+id);
    const jenis = jenisEl?.value || 'MASUK';
    if (item) {
      hargaEl.value = (jenis==='KELUAR') ? _getFIFOPrice(itemId) : (item.hargaSatuan||0);
    }
  }

  function _getFIFOPrice(itemId) {
    const masukLogs = _logs
      .filter(l=>l.itemId===itemId && l.jenis==='MASUK' && (l.harga||0)>0)
      .sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||''));
    if (masukLogs.length>0) return masukLogs[0].harga;
    const item = _items.find(i=>i.id===itemId);
    return item?.hargaSatuan || 0;
  }

    function _ivReadDOM(id) {
    const g = (suf) => document.getElementById('ivf-'+suf+'-'+id);
    const itemSel = g('item');
    return {
      tgl:       g('tgl')?.value     || '',
      itemId:    itemSel?.value      || '',
      itemNama:  itemSel?.options[itemSel?.selectedIndex]?.text?.split(' (')[0] || '',
      jenis:     g('jenis')?.value   || 'MASUK',
      jumlah:    parseFloat(g('jumlah')?.value) || 0,
      harga:     parseFloat(g('harga')?.value)  || 0,
      supplier:  g('sup')?.value     || '',
      catatan:   g('cat')?.value     || '',
    };
  }

  function startLogEdit(id) {
    if (_invEditId === id) return;
    // FIX: remove listener first
    document.removeEventListener('click', _ivOutsideClick);
    // Commit previous
    if (_invEditId) {
      const prevId = _invEditId;
      _invEditId = null;
      _invCommit(prevId);
    }
    _invEditId = id;
    const row  = _logs.find(r=>r.id===id);
    const trEl = document.getElementById('iv-row-'+id);
    if (!row || !trEl) { _invEditId = null; return; }
    const tbody   = document.getElementById('inv-tbody');
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const rowNum  = allRows.indexOf(trEl)+1;
    trEl.outerHTML = _ivRowEdit(row, rowNum, true);
    setTimeout(() => {
      document.getElementById('ivf-item-'+id)?.focus();
      document.addEventListener('click', _ivOutsideClick);
    }, 50);
  }

  function _invCommit(id) {
    const row = _logs.find(r=>r.id===id);
    if (!row) return;
    const vals = _ivReadDOM(id);
    Object.assign(row, vals);
    const trEl = document.getElementById('iv-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('inv-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl)+1;
      trEl.outerHTML = _ivRowView(row, rowNum, true);
    }
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
      DB.logActivity({type:'edit_inventory', detail:'Edit: '+(row.itemNama||id)});
      const newTr = document.getElementById('iv-row-'+id);
      if (newTr) { newTr.classList.add('iv-saved'); setTimeout(()=>newTr.classList.remove('iv-saved'),500); }
    }).catch(e => Notify.error('Gagal simpan', e.message));
  }

  async function commitLogEdit(id) {
    if (_invEditId !== id) return;
    document.removeEventListener('click', _ivOutsideClick);
    _invEditId = null;
    _invCommit(id);
  }

  async function addLogRow() {
    if (_invEditId) {
      document.removeEventListener('click', _ivOutsideClick);
      _invEditId = null;
    }
    const today = new Date().toISOString().split('T')[0];
    const newRow = {tgl:today,itemId:'',itemNama:'',jenis:'MASUK',jumlah:0,stokAkhir:0,harga:0,supplier:'',catatan:''};
    try {
      const saved = await DB.saveInventoryLog(newRow);
      _logs.unshift(saved);
      DB.logActivity({type:'add_inventory', detail:'Baris baru'});
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
      await DB.delete('inventory',id);
      _logs=_logs.filter(r=>r.id!==id);
      _recalcStok();
      DB.logActivity({type:'delete_inventory', detail:'Baris dihapus'});
      renderTransaksi(); renderStok();
      Notify.success('Baris dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }



  /* ===================== MODAL: BARANG ===================== */
  function openItemModal(editId = null) {
    const existing = editId ? _items.find(i => i.id === editId) : null;
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
            <input name="hargaSatuan" type="number" min="0" class="form-control" value="${d.hargaSatuan||0}">
          </div>
          <div class="form-group">
            <label class="form-label">Keterangan</label>
            <input name="keterangan" class="form-control" value="${d.keterangan||''}" placeholder="Opsional">
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
      const idx   = _items.findIndex(i => i.id === saved.id);
      if (idx >= 0) _items[idx] = saved; else _items.push(saved);
      _recalcStok();
      renderStok();
      Modal.close(modalId);
      Notify.success(editId ? 'Barang diperbarui' : 'Barang ditambahkan');
      DB.logActivity({type: editId?'edit_item':'add_item', detail: 'Barang: '+data.nama});
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
    const itemOpts = _items.map(it => {
      const stok = it._stok || 0;
      return `<option value="${it.id}">${it.nama} — Stok: ${stok} ${it.satuan||''}</option>`;
    }).join('');

    document.getElementById('inv-tab-opname').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s5)">
        <!-- Form Opname -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🔢 Input Stok Opname</div>
          </div>
          <div style="padding:var(--s5)">
            <p style="font-size:13px;color:var(--text-3);margin-bottom:var(--s4)">
              Masukkan jumlah stok aktual hasil hitung fisik di gudang.
            </p>
            <div class="form-group">
              <label class="form-label">Tanggal Opname</label>
              <input type="date" class="form-control" id="op-tgl" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label class="form-label">Barang <span class="req">*</span></label>
              <select class="form-control" id="op-item" onchange="InventoryModule._onOpnameItemChange()">
                <option value="">Pilih barang...</option>
                ${itemOpts}
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
              <label class="form-label">Stok Aktual (hasil hitung fisik) <span class="req">*</span></label>
              <input type="number" min="0" step="0.01" class="form-control" id="op-jumlah" value="0"
                oninput="InventoryModule._onOpnameJumlahChange()">
            </div>
            <div class="form-group">
              <label class="form-label">Catatan</label>
              <input type="text" class="form-control" id="op-catatan" placeholder="Opsional">
            </div>
            <button class="btn btn-primary w-full" onclick="InventoryModule._submitOpname2()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
              Simpan Stok Opname
            </button>
          </div>
        </div>

        <!-- Opname History -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Riwayat Opname</div>
          </div>
          <div class="table-scroll">
            <table class="table">
              <thead><tr><th>Tanggal</th><th>Barang</th><th class="num">Stok Baru</th><th>Catatan</th></tr></thead>
              <tbody>
                ${_logs.filter(l=>l.jenis==='OPNAME').sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')).slice(0,20).map(l=>`
                  <tr>
                    <td style="white-space:nowrap">${l.tgl||''}</td>
                    <td class="font-semibold">${l.itemNama||''}</td>
                    <td class="num" style="font-family:var(--font-mono)">${l.jumlah||0}</td>
                    <td class="text-muted text-small">${l.catatan||''}</td>
                  </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-3)">Belum ada riwayat opname</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
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
      jenis: 'OPNAME', jumlah, stokAkhir: jumlah, harga: 0,
      supplier: '', catatan: catatan || ('Opname: '+prevStok+' → '+jumlah+(selisih>=0?' (+'+selisih+')':' ('+selisih+')')),
    };
    try {
      const saved = await DB.saveInventoryLog(log);
      _logs.unshift(saved);
      _recalcStok();
      renderStok();
      renderOpnameTab(); // Refresh opname page
      Notify.success('Stok Opname disimpan! '+item.nama+': '+prevStok+' → '+jumlah+' '+( item.satuan||''));
      DB.logActivity({type:'opname', detail:'Opname '+item.nama+': '+prevStok+'→'+jumlah});
      // Reset form
      document.getElementById('op-item').value = '';
      document.getElementById('op-jumlah').value = '0';
      document.getElementById('op-catatan').value = '';
      document.getElementById('op-current-info').style.display = 'none';
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

  return {
    init,
    switchTab,
    setKatFilter,
    openItemModal,
    _submitItem,
    openTransaksiModal,
    _onItemChange,
    _submitTransaksi,
    startLogEdit,
    commitLogEdit,
    addLogRow,
    deleteLogRow,
    renderOpnameTab,
    _onOpnameItemChange,
    _onOpnameJumlahChange,
    _submitOpname2,
    _ivOnItemSelect,
  };

})();

window.InventoryModule = InventoryModule;
