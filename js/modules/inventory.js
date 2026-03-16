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
              + Barang
            </button>
          ` : ''}
        </div>

      <div class="tabs">
        <button class="tab-btn active" data-tab="stok"     onclick="InventoryModule.switchTab('stok')">📦 Stok Barang</button>
        <button class="tab-btn"        data-tab="transaksi" onclick="InventoryModule.switchTab('transaksi')">📋 Activity Line</button>
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
    // Update header button based on active tab
    const hdrBtns = document.getElementById('inv-header-btns');
    if (hdrBtns && Auth.can('inventory','edit')) {
      if (tab === 'transaksi') {
        hdrBtns.innerHTML = '<button class="btn btn-primary btn-sm" onclick="InventoryModule.addLogRow()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d=\"M12 5v14M5 12h14\"/></svg> + Baris</button>';
      } else {
        hdrBtns.innerHTML = '<button class="btn btn-primary" onclick="InventoryModule.openItemModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d=\"M12 5v14M5 12h14\"/></svg> + Barang</button>';
      }
    }
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
  /* ===================== RIWAYAT TRANSAKSI — click to edit ===================== */
  let _invEditId = null;
  let _invPending = {};

  function renderTransaksi() {
    const canEdit = Auth.can('inventory','edit');
    const sorted  = [..._logs].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));

    if (!document.getElementById('inv-ss-style')) {
      const st = document.createElement('style'); st.id='inv-ss-style';
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
        .iv-add-row{width:100%;padding:8px 12px;border:none;background:var(--surface2);color:var(--text-3);cursor:pointer;font-size:12px;text-align:left;border-top:1px solid var(--border);display:flex;align-items:center;gap:6px;transition:background .15s;}
        .iv-add-row:hover{background:var(--surface3);color:var(--primary-h);}
        .iv-del{width:26px;height:26px;border:none;background:transparent;cursor:pointer;color:var(--text-3);border-radius:4px;display:flex;align-items:center;justify-content:center;margin:auto;transition:all .15s;}
        .iv-del:hover{background:rgba(239,68,68,.15);color:var(--danger);}
        .iv-saved{animation:ivSv .5s ease;}@keyframes ivSv{0%{background:rgba(34,197,94,.25)}100%{background:transparent}}
      `;
      document.head.appendChild(st);
    }

    document.getElementById('inv-tab-transaksi').innerHTML = `
      ${canEdit ? '<div style="font-size:11px;color:var(--text-3);padding:4px 0 8px;font-style:italic">Klik baris untuk edit langsung. Tekan Enter untuk simpan.</div>' : ''}
      <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="iv-tbl" id="inv-grid">
          <thead><tr>
            <th style="width:32px">#</th>
            <th style="width:108px">Tanggal</th>
            <th style="min-width:160px">Nama Barang</th>
            <th style="width:90px">Jenis</th>
            <th style="width:75px" class="iv-num">Jumlah</th>
            <th style="width:90px" class="iv-num">Stok Akhir</th>
            <th style="width:100px" class="iv-num">Harga (Rp)</th>
            <th style="width:110px">Supplier</th>
            <th style="min-width:140px">Catatan</th>
            ${canEdit ? '<th style="width:32px"></th>' : ''}
          </tr></thead>
          <tbody id="inv-tbody">
            ${sorted.length ? sorted.map((r,i)=>_ivRowView(r,i+1,canEdit)).join('') :
              `<tr><td colspan="${canEdit?10:9}" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada transaksi. Klik + Baris Baru untuk mulai.</td></tr>`}
          </tbody>
        </table>
        ${canEdit ? `<button class="iv-add-row" onclick="InventoryModule.addLogRow()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
          + Baris Baru
        </button>` : ''}
      </div>
    `;
  }

  function _ivRowView(r, rowNum, canEdit) {
    const jColor = r.jenis==='MASUK'?'var(--success)':r.jenis==='KELUAR'?'var(--danger)':'var(--warning)';
    return `<tr class="iv-view" id="iv-row-${r.id}" data-id="${r.id}"
              ${canEdit?`onclick="InventoryModule.startLogEdit('${r.id}')"`  :''}>
      <td><div class="ivc" style="justify-content:center;color:var(--text-3);font-size:11px">${rowNum}</div></td>
      <td><div class="ivc">${r.tgl||''}</div></td>
      <td><div class="ivc">${r.itemNama||''}</div></td>
      <td><div class="ivc"><span class="badge" style="background:${jColor}18;color:${jColor};border:1px solid ${jColor}40;font-size:10px">${r.jenis||''}</span></div></td>
      <td class="iv-num"><div class="ivc" style="justify-content:flex-end">${r.jumlah||0}</div></td>
      <td class="iv-num"><div class="ivc" style="justify-content:flex-end">${r.stokAkhir??'-'}</div></td>
      <td class="iv-num"><div class="ivc" style="justify-content:flex-end">${r.harga?Utils.formatRupiah(r.harga):'-'}</div></td>
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
    const jenisOpts = ['MASUK','KELUAR','OPNAME'].map(j=>`<option value="${j}" ${r.jenis===j?'selected':''}>${j}</option>`).join('');
    return `<tr class="iv-editing" id="iv-row-${r.id}" data-id="${r.id}">
      <td><div class="ivc" style="justify-content:center;color:var(--primary-h);font-size:11px">${rowNum}</div></td>
      <td><input class="iv-inp" type="date" value="${r.tgl||''}" onchange="InventoryModule._ivSet('${r.id}','tgl',this.value)"></td>
      <td><select class="iv-sel" onchange="InventoryModule._ivSetItem('${r.id}',this.value,this.options[this.selectedIndex].text)">
        <option value="">Pilih barang...</option>${itemOpts}
      </select></td>
      <td><select class="iv-sel" onchange="InventoryModule._ivSet('${r.id}','jenis',this.value)">${jenisOpts}</select></td>
      <td class="iv-num"><input class="iv-inp iv-num" type="number" min="0" value="${r.jumlah||0}"
        oninput="InventoryModule._ivSet('${r.id}','jumlah',parseFloat(this.value)||0)"
        onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')" style="text-align:right"></td>
      <td class="iv-num"><input class="iv-inp iv-num" type="number" min="0" value="${r.stokAkhir||0}"
        oninput="InventoryModule._ivSet('${r.id}','stokAkhir',parseFloat(this.value)||0)" style="text-align:right"></td>
      <td class="iv-num"><input class="iv-inp iv-num" type="number" min="0" value="${r.harga||0}"
        oninput="InventoryModule._ivSet('${r.id}','harga',parseFloat(this.value)||0)" style="text-align:right"></td>
      <td><input class="iv-inp" type="text" value="${(r.supplier||'').replace(/"/g,'&quot;')}" placeholder="Supplier"
        oninput="InventoryModule._ivSet('${r.id}','supplier',this.value)"></td>
      <td><input class="iv-inp" type="text" value="${(r.catatan||'').replace(/"/g,'&quot;')}" placeholder="Catatan"
        oninput="InventoryModule._ivSet('${r.id}','catatan',this.value)"
        onkeydown="if(event.key==='Enter')InventoryModule.commitLogEdit('${r.id}')"></td>
      ${canEdit?`<td><button class="iv-del" style="color:var(--success)" onclick="InventoryModule.commitLogEdit('${r.id}')" title="Simpan">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20,6 9,17 4,12"/></svg>
      </button></td>`:''}
    </tr>`;
  }

  function _ivSet(id,field,value){ if(!_invPending[id])_invPending[id]={}; _invPending[id][field]=value; }
  function _ivSetItem(id,itemId,label){ _ivSet(id,'itemId',itemId); _ivSet(id,'itemNama',label.split(' (')[0]); }

  function startLogEdit(id) {
    if (_invEditId===id) return;
    if (_invEditId) commitLogEdit(_invEditId);
    _invEditId = id;
    const row  = _logs.find(r=>r.id===id);
    const trEl = document.getElementById('iv-row-'+id);
    if (!row||!trEl) return;
    const tbody   = document.getElementById('inv-tbody');
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const rowNum  = allRows.indexOf(trEl)+1;
    trEl.outerHTML = _ivRowEdit(row, rowNum, true);
    setTimeout(()=>document.addEventListener('click', _ivOutside), 100);
  }

  function _ivOutside(e) {
    if (!_invEditId) { document.removeEventListener('click',_ivOutside); return; }
    const el = document.getElementById('iv-row-'+_invEditId);
    if (el && !el.contains(e.target)) { commitLogEdit(_invEditId); document.removeEventListener('click',_ivOutside); }
  }

  async function commitLogEdit(id) {
    if (_invEditId!==id) return;
    _invEditId = null;
    const row     = _logs.find(r=>r.id===id);
    const pending = _invPending[id]||{};
    delete _invPending[id];
    if (!row) return;
    // Read ALL current values from DOM inputs (more reliable than pending)
    const trEl = document.getElementById('iv-row-'+id);
    if (trEl) {
      const dateFld   = trEl.querySelector('input[type="date"]');
      const itemSel   = trEl.querySelectorAll('select')[0];
      const jenisSel  = trEl.querySelectorAll('select')[1];
      const inputs    = trEl.querySelectorAll('input[type="number"]');
      const textInps  = trEl.querySelectorAll('input[type="text"]');
      if (dateFld)   pending.tgl        = dateFld.value;
      if (jenisSel)  pending.jenis      = jenisSel.value;
      if (itemSel && itemSel.value) {
        pending.itemId   = itemSel.value;
        pending.itemNama = itemSel.options[itemSel.selectedIndex]?.text?.split(' (')[0] || pending.itemNama;
      }
      if (inputs[0])  pending.jumlah    = parseFloat(inputs[0].value)||0;
      if (inputs[1])  pending.stokAkhir = parseFloat(inputs[1].value)||0;
      if (inputs[2])  pending.harga     = parseFloat(inputs[2].value)||0;
      if (textInps[0]) pending.supplier = textInps[0].value;
      if (textInps[1]) pending.catatan  = textInps[1].value;
    }
    Object.assign(row, pending);
    const tbody   = document.getElementById('inv-tbody');
    if (!tbody) return;
    const trEl2    = document.getElementById('iv-row-'+id);
    if (trEl2) {
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl2)+1;
      trEl2.outerHTML = _ivRowView(row, rowNum, true);
    }
    try {
      await DB.saveInventoryLog(row);
      DB.logActivity({type:'edit_inventory',detail:`Edit: ${row.itemNama||id}`});
      _recalcStok();
      const newTr = document.getElementById('iv-row-'+id);
      if (newTr) { newTr.classList.add('iv-saved'); setTimeout(()=>newTr.classList.remove('iv-saved'),500); }
    } catch(e) { Notify.error('Gagal simpan',e.message); }
  }

  async function addLogRow() {
    if (_invEditId) await commitLogEdit(_invEditId);
    const today = new Date().toISOString().split('T')[0];
    const newRow = {tgl:today,itemId:'',itemNama:'',jenis:'MASUK',jumlah:0,stokAkhir:0,harga:0,supplier:'',catatan:''};
    try {
      const saved = await DB.saveInventoryLog(newRow);
      _logs.unshift(saved);
      DB.logActivity({type:'add_inventory',detail:'Baris baru'});
      renderTransaksi();
      setTimeout(()=>startLogEdit(saved.id),80);
    } catch(e) { Notify.error('Gagal',e.message); }
  }

  async function deleteLogRow(id) {
    if (_invEditId===id){_invEditId=null;delete _invPending[id];}
    const ok = await Modal.confirm({title:'Hapus Baris',message:'Transaksi dihapus permanen.',danger:true,confirmText:'Hapus'});
    if (!ok) return;
    const mid = Utils.uid();
    try {
      await DB.delete('inventory',id);
      _logs=_logs.filter(r=>r.id!==id);
      _recalcStok();
      DB.logActivity({type:'delete_inventory',detail:'Baris dihapus'});
      renderTransaksi(); renderStok();
      Notify.success('Baris dihapus');
    } catch(e) { Notify.error('Gagal',e.message); }
  }

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

    const mid = Utils.uid(); Modal.open({ id: mid,
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

    const mid = Utils.uid(); Modal.open({ id: mid,
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
    startLogEdit,
    commitLogEdit,
    _ivSet,
    _ivSetItem,
    addLogRow,
    deleteLogRow,
  };

})();

window.InventoryModule = InventoryModule;
