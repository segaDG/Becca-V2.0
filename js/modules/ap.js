/* ============================================
   BECCA V2.0 — Account Payable Module
============================================ */
const APModule = (() => {
  let _ap = [];
  let _suppliers = [];

  async function init() {
    const page = document.getElementById('page-ap');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Account Payable</h2>
          <p>Manajemen hutang dan tagihan supplier</p>
        </div>
        <div class="page-header-right" id="ap-header-actions"></div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" id="ap-tab-btn-list"     onclick="APModule.switchTab('list')">📋 Daftar AP</button>
        <button class="tab-btn"        id="ap-tab-btn-supplier" onclick="APModule.switchTab('supplier')">🏭 Supplier</button>
      </div>
      <div id="ap-tab-list"></div>
      <div id="ap-tab-supplier" class="hidden"></div>
    `;
    Promise.all([DB.getAP().catch(()=>[]), DB.getSuppliers().catch(()=>[])]).then(([ap, sup]) => {
      _ap        = ap;
      _suppliers = sup;
      switchTab('list');
    });
  }

  let _activeTab = 'list';

  function switchTab(tab) {
    _activeTab = tab;
    ['list','supplier'].forEach(t => {
      const el  = document.getElementById('ap-tab-'+t);
      const btn = document.getElementById('ap-tab-btn-'+t);
      if (el)  el.classList.toggle('hidden', t !== tab);
      if (btn) btn.classList.toggle('active', t === tab);
    });
    // Update header actions
    const hdr = document.getElementById('ap-header-actions');
    if (hdr) {
      if (tab === 'list' && Auth.can('ap','edit')) {
        hdr.innerHTML = '<button class="btn btn-primary" onclick="APModule.openModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg> Tambah AP</button>';
      } else if (tab === 'supplier' && Auth.can('ap','edit')) {
        hdr.innerHTML = '<button class="btn btn-primary" onclick="APModule.openAddSupplierModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg> Tambah Supplier</button>';
      } else {
        hdr.innerHTML = '';
      }
    }
    if (tab === 'list')     render();
    if (tab === 'supplier') renderSuppliers();
  }


  function render() {
    const sorted     = [..._ap].sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''));
    const totalHutang = _ap.filter(r=>r.status!=='LUNAS').reduce((s,r) => s+(r.total||0),0);
    const totalLunas  = _ap.filter(r=>r.status==='LUNAS').reduce((s,r) => s+(r.total||0),0);
    const totalSisa   = totalHutang;
    const today       = new Date().toISOString().split('T')[0];
    const canEdit     = Auth.can('ap','edit');

    const statsHtml = [
      { l:'Total Hutang',  v: Utils.formatRupiah(totalHutang,true), c:'var(--danger)'    },
      { l:'Sudah Dibayar', v: Utils.formatRupiah(totalLunas,true),  c:'var(--success)'   },
      { l:'Total Tagihan', v: sorted.length + ' item',              c:'var(--primary-h)' },
      { l:'Supplier',      v: _suppliers.length + ' supplier',      c:'var(--text-2)'    },
    ].map(s =>
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:150px">'
      + '<div style="font-size:11px;color:var(--text-3);margin-bottom:4px">'+s.l+'</div>'
      + '<div style="font-size:16px;font-weight:700;color:'+s.c+';font-family:var(--font-mono)">'+s.v+'</div>'
      + '</div>'
    ).join('');

    const theadHtml = '<tr>'
      + '<th>#</th><th>Tanggal</th><th>Supplier</th><th>Keterangan</th>'
      + '<th class="num">Qty</th><th>Sat</th><th class="num">Harga/Sat</th>'
      + '<th class="num">Total</th><th class="num">Terbayar</th><th class="num">Sisa</th>'
      + '<th>Jatuh Tempo</th><th>Status</th>'
      + (canEdit ? '<th>Aksi</th>' : '')
      + '</tr>';

    const tbodyHtml = sorted.length
      ? sorted.map((r, i) => {
          const sisa = (r.total||0) - (r.terbayar||0);
          const late = r.jatuhTempo && r.status!=='LUNAS' && r.jatuhTempo < today;
          const sc   = r.status==='LUNAS' ? 'badge-success' : r.status==='CICILAN' ? 'badge-warning' : 'badge-danger';
          const tglFmt = r.tgl ? r.tgl.split('-').reverse().join('/') : '-';
          const jtFmt  = r.jatuhTempo ? r.jatuhTempo.split('-').reverse().join('/') : '-';
          const cells  = ''
            + '<td class="text-muted">' + (i+1) + '</td>'
            + '<td style="white-space:nowrap;color:var(--text-2)">' + tglFmt + '</td>'
            + '<td style="font-weight:600">' + (r.supplier||'-') + '</td>'
            + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(r.keterangan||r.ket||'')+'">' + (r.keterangan||r.ket||'-') + '</td>'
            + '<td class="num" style="color:var(--text-3)">' + (r.qty ? Number(r.qty).toLocaleString('id') : '-') + '</td>'
            + '<td style="color:var(--text-3);font-size:11px">' + (r.satuan||'-') + '</td>'
            + '<td class="num" style="font-family:var(--font-mono);color:var(--text-3)">' + (r.hargaSatuan ? Utils.formatRupiah(r.hargaSatuan,true) : '-') + '</td>'
            + '<td class="num" style="font-family:var(--font-mono);font-weight:700">' + Utils.formatRupiah(r.total||0) + '</td>'
            + '<td class="num" style="font-family:var(--font-mono);color:var(--success)">' + Utils.formatRupiah(r.terbayar||0) + '</td>'
            + '<td class="num" style="font-family:var(--font-mono);color:' + (sisa>0?'var(--danger)':'var(--text-3)') + '">' + Utils.formatRupiah(sisa) + '</td>'
            + '<td style="white-space:nowrap;color:' + (late?'var(--danger)':'var(--text-3)') + ';font-size:11px">' + jtFmt + '</td>'
            + '<td><span class="badge ' + sc + '" style="font-size:10px">' + (r.status||'BELUM') + '</span></td>';
          const acts = canEdit
            ? '<td onclick="event.stopPropagation()"><div style="display:flex;gap:3px">'
              + '<button class="btn-icon" title="Edit" onclick="APModule.openModal(\''+r.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg></button>'
              + '<button class="btn-icon" title="Hapus" onclick="APModule._deleteAP(\''+r.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>'
              + '</div></td>'
            : '';
          return '<tr style="cursor:pointer;background:' + (late?'rgba(239,68,68,0.05)':'') + '"'
            + ' onclick="APModule.openModal(\''+r.id+'\')"'
            + ' onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'">'
            + cells + acts + '</tr>';
        }).join('')
      : '<tr><td colspan="13" style="text-align:center;padding:40px;color:var(--text-3)">Belum ada data AP.</td></tr>';

    document.getElementById('ap-tab-list').innerHTML =
      '<div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">' + statsHtml + '</div>'
      + '<div class="table-wrapper"><table class="table" style="font-size:12px">'
      + '<thead>' + theadHtml + '</thead>'
      + '<tbody>' + tbodyHtml + '</tbody>'
      + '</table></div>';
  }


  function openModal(editId = null) {
    const existing = editId ? _ap.find(r => r.id === editId) : null;
    const d = existing || { tgl: Utils.today ? Utils.today() : '', status: 'BELUM' };
    const suppOpts = _suppliers.map(s => `<option value="${s.nama}" ${d.supplier===s.nama?'selected':''}>${s.nama}</option>`).join('');
    const mid = Utils.uid(); Modal.open({ id: mid,
      title: editId ? 'Edit AP' : 'Tambah Account Payable',
      body: `
        <form id="ap-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tanggal <span class="req">*</span></label>
              <input name="tgl" type="date" class="form-control" value="${d.tgl||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Jatuh Tempo</label>
              <input name="jatuhTempo" type="date" class="form-control" value="${d.jatuhTempo||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Supplier <span class="req">*</span></label>
            <select name="supplier" class="form-control" required>
              <option value="">— Pilih Supplier —</option>
              ${suppOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Keterangan / Item</label>
            <input name="keterangan" class="form-control" placeholder="Nama barang / keterangan" value="${d.keterangan||d.ket||''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Qty</label>
              <input name="qty" type="number" min="0" class="form-control" value="${d.qty||0}"
                oninput="(function(){const q=parseFloat(this.value)||0;const h=parseFloat(document.querySelector('[name=hargaSatuan]')?.value)||0;const t=document.querySelector('[name=total]');if(t)t.value=q*h;}).call(this)">
            </div>
            <div class="form-group">
              <label class="form-label">Satuan</label>
              <input name="satuan" class="form-control" placeholder="Pcs, Kg, Ltr..." value="${d.satuan||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Harga Satuan (Rp)</label>
              <input name="hargaSatuan" type="number" min="0" class="form-control" value="${d.hargaSatuan||0}"
                oninput="(function(){const h=parseFloat(this.value)||0;const q=parseFloat(document.querySelector('[name=qty]')?.value)||0;const t=document.querySelector('[name=total]');if(t)t.value=q*h;}).call(this)">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Total (Rp)</label>
              <input name="total" type="number" min="0" class="form-control" value="${d.total||0}">
            </div>
            <div class="form-group">
              <label class="form-label">Terbayar (Rp)</label>
              <input name="terbayar" type="number" min="0" class="form-control" value="${d.terbayar||0}">
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-control">
                <option value="BELUM"   ${(d.status||'BELUM')==='BELUM'  ?'selected':''}>⏳ Belum</option>
                <option value="CICILAN" ${d.status==='CICILAN'?'selected':''}>🔸 Cicilan</option>
                <option value="LUNAS"   ${d.status==='LUNAS'  ?'selected':''}>✅ Lunas</option>
              </select>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="APModule._submit('${mid}','${editId||''}')">Simpan</button>
      `,
    });
    return mid;
  }

  function openSupplierModal(editSuppId=null) {
    const editSupp = editSuppId ? _suppliers.find(s=>s.id===editSuppId) : null;
    const mid = Utils.uid();

    function _buildSupList() {
      if (!_suppliers.length) return '<div style="text-align:center;padding:20px;color:var(--text-3)">Belum ada supplier</div>';
      return _suppliers.map(s => `
        <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:10px 12px;margin-bottom:8px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between">
            <div>
              <div style="font-weight:700;font-size:13px">${s.nama||'-'}</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:2px">
                ${s.alamat ? '<span>📍 '+s.alamat+'</span> · ' : ''}
                ${s.noHp   ? '<span>📞 '+s.noHp+'</span> · '   : ''}
                ${s.email  ? '<span>✉️ '+s.email+'</span>'      : ''}
              </div>
              ${s.bank||s.noRek ? `<div style="font-size:11px;color:var(--text-3);margin-top:2px">
                🏦 ${s.bank||''} ${s.noRek||''}
              </div>` : ''}
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" onclick="APModule.openSupplierModal('${s.id}')">Edit</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="APModule._deleteSupplier('${s.id}')">Hapus</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    Modal.open({ id: mid,
      title: editSupp ? 'Edit Supplier' : 'Kelola Supplier',
      size: 'modal-lg',
      body: editSupp ? `
        <form id="sup-edit-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Supplier <span class="req">*</span></label>
              <input name="nama" class="form-control" value="${editSupp.nama||''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">No. HP / Telepon</label>
              <input name="noHp" class="form-control" value="${editSupp.noHp||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input name="email" type="email" class="form-control" value="${editSupp.email||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Kategori / Jenis</label>
              <input name="kategori" class="form-control" value="${editSupp.kategori||''}" placeholder="Contoh: Bahan Baku, Kemasan, Jasa">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Alamat</label>
            <input name="alamat" class="form-control" value="${editSupp.alamat||''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nama Bank</label>
              <input name="bank" class="form-control" value="${editSupp.bank||''}" placeholder="BCA, Mandiri, BNI...">
            </div>
            <div class="form-group">
              <label class="form-label">No. Rekening</label>
              <input name="noRek" class="form-control" value="${editSupp.noRek||''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Atas Nama Rekening</label>
              <input name="atasNama" class="form-control" value="${editSupp.atasNama||''}">
            </div>
            <div class="form-group">
              <label class="form-label">NPWP</label>
              <input name="npwp" class="form-control" value="${editSupp.npwp||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Catatan</label>
            <textarea name="catatan" class="form-control" rows="2">${editSupp.catatan||''}</textarea>
          </div>
        </form>
      ` : `
        <!-- Daftar supplier -->
        <div style="max-height:300px;overflow-y:auto;margin-bottom:var(--s4)" id="sup-list-wrap">
          ${_buildSupList()}
        </div>
        <!-- Form tambah baru -->
        <div style="border-top:1px solid var(--border);padding-top:var(--s4)">
          <div style="font-weight:600;font-size:13px;margin-bottom:var(--s3)">+ Tambah Supplier Baru</div>
          <form id="sup-add-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nama <span class="req">*</span></label>
                <input name="nama" id="new-sup-name" class="form-control" placeholder="Nama supplier" required>
              </div>
              <div class="form-group">
                <label class="form-label">No. HP</label>
                <input name="noHp" class="form-control" placeholder="08xx">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bank</label>
                <input name="bank" class="form-control" placeholder="BCA, Mandiri...">
              </div>
              <div class="form-group">
                <label class="form-label">No. Rekening</label>
                <input name="noRek" class="form-control">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Alamat</label>
              <input name="alamat" class="form-control" placeholder="Alamat supplier">
            </div>
          </form>
        </div>
      `,
      footer: editSupp ? `
        <button class="btn btn-ghost" onclick="APModule.openSupplierModal()">← Kembali</button>
        <button class="btn btn-primary" onclick="APModule._saveEditSupplier('${mid}','${editSuppId}')">Simpan</button>
      ` : `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
        <button class="btn btn-primary" onclick="APModule._addSupplierFull('${mid}')">+ Tambah Supplier</button>
      `,
    });
  }


  async function _addSupplier() {
    const nama = document.getElementById('new-sup-name').value.trim();
    if (!nama) return;
    const saved = await DB.saveSupplier({ nama });
    _suppliers.push(saved);
    document.getElementById('sup-list-wrap').innerHTML += `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <span>${saved.nama}</span>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="APModule._deleteSupplier('${saved.id}')">Hapus</button>
      </div>
    `;
    document.getElementById('new-sup-name').value = '';
  }

  async function _deleteAP(id) {
    const ok = await Utils.confirm({title:'Hapus AP?', msg:'Yakin hapus transaksi ini?', danger:true});
    if (!ok) return;
    try {
      await DB.delete('ap', id);
      _ap = _ap.filter(r => r.id !== id);
      render();
      Notify.success('AP dihapus');
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  async function _deleteSupplier(id) {
    await DB.delete('suppliers', id);
    _suppliers = _suppliers.filter(s => s.id !== id);
    render();
  }

  async function _submit(modalId, editId='') {
    const fd   = new FormData(document.getElementById('ap-form'));
    const data = Object.fromEntries(fd.entries());
    if (!data.supplier) { Notify.warning('Supplier wajib diisi'); return; }
    data.total       = parseFloat(data.total)       || 0;
    data.terbayar    = parseFloat(data.terbayar)    || 0;
    data.qty         = parseFloat(data.qty)         || 0;
    data.hargaSatuan = parseFloat(data.hargaSatuan) || 0;
    // Normalize keterangan field
    if (!data.keterangan) data.keterangan = data.ket || '';
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveAP(data);
      const idx   = _ap.findIndex(r => r.id === saved.id);
      if (idx >= 0) _ap[idx] = saved; else _ap.unshift(saved);
      render();
      Modal.close(modalId);
      Notify.success(editId ? 'AP berhasil diperbarui!' : 'AP baru ditambahkan!');
      DB.logActivity({type:editId?'edit_ap':'add_ap',detail:`AP Supplier: ${data.supplier}`});
    } catch(err) { Notify.error('Gagal', err.message); }
  }

  /* ===================== SUPPLIER PAGE ===================== */
  function renderSuppliers() {
    const el = document.getElementById('ap-tab-supplier');
    if (!el) return;

    // Stats
    const totalSup  = _suppliers.length;
    const supWithAP = _suppliers.filter(s => _ap.some(a => a.supplier===s.nama)).length;

    el.innerHTML = `
      <!-- Stats -->
      <div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">
        ${[
          {l:'Total Supplier', v:totalSup+' supplier',       c:'var(--primary-h)'},
          {l:'Punya Tagihan',  v:supWithAP+' supplier',      c:'var(--warning)'},
          {l:'Total AP Aktif', v:_ap.filter(a=>a.status!=='LUNAS').length+' tagihan', c:'var(--danger)'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 18px;min-width:150px">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:16px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>`).join('')}
      </div>

      <!-- Supplier Table -->
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Supplier</th>
              <th>Kategori / Bidang</th>
              <th>No. HP</th>
              <th>Kota</th>
              <th>Bank</th>
              <th>No. Rekening</th>
              <th>Atas Nama</th>
              <th class="num">Total AP</th>
              <th class="num">Sisa Hutang</th>
              ${Auth.can('ap','edit') ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${!_suppliers.length ? `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-3)">
              Belum ada data supplier. Klik "+ Tambah Supplier" untuk menambahkan.
            </td></tr>` :
            _suppliers.map((s,i) => {
              const apItems    = _ap.filter(a => a.supplier === s.nama);
              const totalAP    = apItems.reduce((sum,a)=>sum+(a.total||0),0);
              const totalBayar = apItems.reduce((sum,a)=>sum+(a.terbayar||0),0);
              const sisa       = Math.max(0, totalAP - totalBayar);
              return `<tr style="cursor:pointer" onclick="APModule.showSupplierDetail('${s.id}')"
                onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                <td class="text-muted">${i+1}</td>
                <td>
                  <div style="font-weight:700">${s.nama||'-'}</div>
                  ${s.alamat ? `<div style="font-size:11px;color:var(--text-3)">📍 ${s.alamat}</div>` : ''}
                </td>
                <td><span class="badge badge-neutral">${s.kategori||'-'}</span></td>
                <td class="text-muted">${s.noHp||'-'}</td>
                <td class="text-muted text-small">${s.kota||'-'}</td>
                <td class="text-muted">${s.bank||'-'}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${s.noRek||'-'}</td>
                <td class="text-muted">${s.atasNama||'-'}</td>
                <td class="num" style="font-family:var(--font-mono)">${totalAP>0?Utils.formatRupiah(totalAP,true):'-'}</td>
                <td class="num" style="font-family:var(--font-mono);color:${sisa>0?'var(--danger)':'var(--text-3)'}">
                  ${sisa>0?Utils.formatRupiah(sisa,true):'-'}
                </td>
                ${Auth.can('ap','edit') ? `<td onclick="event.stopPropagation()">
                  <div style="display:flex;gap:4px">
                    <button class="btn-icon" title="Edit" onclick="APModule.openEditSupplierModal('${s.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="btn-icon" title="Hapus" onclick="APModule._deleteSupplier('${s.id}')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function showSupplierDetail(suppId) {
    const s      = _suppliers.find(x => x.id === suppId);
    if (!s) return;
    const apItems    = _ap.filter(a => a.supplier === s.nama);
    const totalAP    = apItems.reduce((sum,a)=>sum+(a.total||0),0);
    const totalBayar = apItems.reduce((sum,a)=>sum+(a.terbayar||0),0);
    const sisa       = Math.max(0, totalAP - totalBayar);
    const mid        = Utils.uid();

    Modal.open({ id: mid,
      title: '🏭 Detail Supplier',
      size: 'modal-lg',
      body: `
        <!-- Header supplier -->
        <div style="display:flex;gap:16px;padding:14px 16px;background:var(--surface2);border-radius:var(--r-md);margin-bottom:var(--s4)">
          <div style="width:52px;height:52px;border-radius:10px;background:rgba(99,102,241,.15);
                      color:var(--primary-h);display:flex;align-items:center;justify-content:center;
                      font-size:22px;font-weight:800;flex-shrink:0">
            ${s.nama?.substring(0,1).toUpperCase()||'?'}
          </div>
          <div style="flex:1">
            <div style="font-size:18px;font-weight:700;color:var(--heading)">${s.nama}</div>
            <div style="font-size:12px;color:var(--text-3)">${s.kategori||''} ${s.alamat?'· 📍'+s.alamat:''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;color:var(--text-3)">Sisa Hutang</div>
            <div style="font-size:20px;font-weight:800;color:${sisa>0?'var(--danger)':'var(--success)'};font-family:var(--font-mono)">
              ${Utils.formatRupiah(sisa,true)}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)">
          <!-- Info supplier -->
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">Informasi Supplier</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              ${[
                {l:'No. HP',        v: s.noHp||'-'},
                {l:'Kota',          v: s.kota||'-'},
                {l:'Alamat',        v: s.alamat||'-'},
                {l:'Bank',          v: s.bank||'-'},
                {l:'No. Rekening',  v: s.noRek||'-'},
                {l:'Atas Nama',     v: s.atasNama||'-'},
                {l:'NPWP',          v: s.npwp||'-'},
                {l:'Catatan',       v: s.catatan||'-'},
              ].map(r=>`<tr>
                <td style="padding:6px 8px;color:var(--text-3);border-bottom:1px solid var(--border);width:40%">${r.l}</td>
                <td style="padding:6px 8px;font-weight:500;border-bottom:1px solid var(--border)">${r.v}</td>
              </tr>`).join('')}
            </table>
            <!-- Summary AP -->
            <div style="margin-top:var(--s3);padding:10px 12px;background:var(--surface2);border-radius:var(--r-md)">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:var(--text-3)">Total AP</span>
                <span style="font-family:var(--font-mono)">${Utils.formatRupiah(totalAP)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:var(--text-3)">Total Terbayar</span>
                <span style="font-family:var(--font-mono);color:var(--success)">${Utils.formatRupiah(totalBayar)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;border-top:1px solid var(--border);padding-top:6px;margin-top:4px">
                <span>Sisa Hutang</span>
                <span style="color:${sisa>0?'var(--danger)':'var(--success)'}">${Utils.formatRupiah(sisa)}</span>
              </div>
            </div>
          </div>

          <!-- Riwayat AP -->
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:var(--s2)">
              Riwayat AP (${apItems.length} tagihan)
            </div>
            <div style="max-height:320px;overflow-y:auto">
              ${apItems.length ? `
              <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead><tr style="background:var(--surface2)">
                  <th style="padding:5px 8px;text-align:left;color:var(--text-3)">Tanggal</th>
                  <th style="padding:5px 8px;text-align:left;color:var(--text-3)">Keterangan</th>
                  <th style="padding:5px 8px;text-align:right;color:var(--text-3)">Total</th>
                  <th style="padding:5px 8px;text-align:right;color:var(--text-3)">Sisa</th>
                  <th style="padding:5px 8px;text-align:center;color:var(--text-3)">Status</th>
                </tr></thead>
                <tbody>
                  ${apItems.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')).map(a=>{
                    const sisaA = Math.max(0,(a.total||0)-(a.terbayar||0));
                    const sc    = a.status==='LUNAS'?'badge-success':a.status==='CICILAN'?'badge-warning':'badge-danger';
                    return `<tr>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border);white-space:nowrap">${a.tgl?a.tgl.split('-').reverse().join('/'):'-'}</td>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${a.keterangan||'-'}</td>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--font-mono)">${Utils.formatRupiah(a.total||0)}</td>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--font-mono);color:${sisaA>0?'var(--danger)':'var(--success)'}">${sisaA>0?Utils.formatRupiah(sisaA):'-'}</td>
                      <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:center">
                        <span class="badge ${sc}" style="font-size:10px">${a.status||'BELUM'}</span>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>` : `<div style="text-align:center;padding:30px;color:var(--text-3)">Belum ada tagihan AP</div>`}
            </div>
          </div>
        </div>
      `,
      footer: `
        ${Auth.can('ap','edit') ? `<button class="btn btn-ghost" onclick="APModule.openEditSupplierModal('${suppId}');Modal.close('${mid}')">Edit Supplier</button>` : ''}
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
      `,
    });
  }

  function openAddSupplierModal() {
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: '+ Tambah Supplier Baru',
      size: 'modal-lg',
      body: `<form id="sup-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Supplier <span class="req">*</span></label>
            <input name="nama" class="form-control" required placeholder="Nama supplier">
          </div>
          <div class="form-group">
            <label class="form-label">Kategori / Jenis</label>
            <input name="kategori" class="form-control" placeholder="Bahan Baku, Kemasan, Jasa...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">No. HP / Telepon</label>
            <input name="noHp" class="form-control" placeholder="08xx">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input name="email" type="email" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Alamat</label>
          <input name="alamat" class="form-control" placeholder="Alamat lengkap supplier">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Bank</label>
            <input name="bank" class="form-control" placeholder="BCA, Mandiri, BNI...">
          </div>
          <div class="form-group">
            <label class="form-label">No. Rekening</label>
            <input name="noRek" class="form-control">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Atas Nama Rekening</label>
            <input name="atasNama" class="form-control">
          </div>
          <div class="form-group">
            <label class="form-label">NPWP</label>
            <input name="npwp" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="catatan" class="form-control" rows="2" placeholder="Catatan tambahan"></textarea>
        </div>
      </form>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="APModule._submitSupplier('${mid}')">Tambah Supplier</button>
      `,
    });
    setTimeout(() => document.querySelector('#sup-form input')?.focus(), 100);
  }

  function openEditSupplierModal(suppId) {
    const s   = _suppliers.find(x => x.id === suppId);
    if (!s) return;
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: 'Edit Supplier',
      size: 'modal-lg',
      body: `<form id="sup-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Supplier <span class="req">*</span></label>
            <input name="nama" class="form-control" value="${s.nama||''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Kategori / Jenis</label>
            <input name="kategori" class="form-control" value="${s.kategori||''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">No. HP / Telepon</label>
            <input name="noHp" class="form-control" value="${s.noHp||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input name="email" type="email" class="form-control" value="${s.email||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Alamat</label>
          <input name="alamat" class="form-control" value="${s.alamat||''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nama Bank</label>
            <input name="bank" class="form-control" value="${s.bank||''}">
          </div>
          <div class="form-group">
            <label class="form-label">No. Rekening</label>
            <input name="noRek" class="form-control" value="${s.noRek||''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Atas Nama Rekening</label>
            <input name="atasNama" class="form-control" value="${s.atasNama||''}">
          </div>
          <div class="form-group">
            <label class="form-label">NPWP</label>
            <input name="npwp" class="form-control" value="${s.npwp||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="catatan" class="form-control" rows="2">${s.catatan||''}</textarea>
        </div>
      </form>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
        <button class="btn btn-primary" onclick="APModule._submitSupplier('${mid}','${suppId}')">Simpan</button>
      `,
    });
  }

  async function _submitSupplier(mid, editId='') {
    const form = document.getElementById('sup-form');
    const fd   = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!data.nama?.trim()) { Notify.warning('Nama supplier wajib diisi'); return; }
    if (editId) data.id = editId;
    try {
      const saved = await DB.saveSupplier(data);
      const idx   = _suppliers.findIndex(s=>s.id===saved.id);
      if (idx>=0) _suppliers[idx]=saved; else _suppliers.push(saved);
      Modal.close(mid);
      Notify.success(editId ? 'Supplier diperbarui!' : 'Supplier "'+data.nama+'" ditambahkan!');
      renderSuppliers();
      DB.logActivity({type:'supplier', detail:(editId?'Edit: ':'Tambah: ')+data.nama});
    } catch(e) { Notify.error('Gagal', e.message); }
  }


  return { init, render, switchTab, renderSuppliers, showSupplierDetail, openAddSupplierModal, openEditSupplierModal, _submitSupplier, openModal, openSupplierModal, _submit, _deleteAP, _deleteSupplier };
})();
window.APModule = APModule;
