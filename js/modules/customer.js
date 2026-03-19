/* ============================================
   BECCA V2.0 — Customer Module
   Table: Nama Perusahaan | PIC | Telp | Kota | Alamat | Status | Email | Catatan
============================================ */
const CustomerModule = (() => {
  let _data = [];
  let _search = '';

  async function init() {
    const page = document.getElementById('page-customer');
    if (!page) return;
    try { _data = JSON.parse(localStorage.getItem('becca_customers')||'[]'); } catch(e){ _data=[]; }
    _render(page);
  }

  function _render(page) {
    if (!page) page = document.getElementById('page-customer');
    if (!page) return;
    const canEdit = Auth.can('customer','edit');
    const list = _search
      ? _data.filter(c=>(c.nama||'').toLowerCase().includes(_search)||(c.pic||'').toLowerCase().includes(_search)||(c.kota||'').toLowerCase().includes(_search))
      : _data;
    const aktif   = _data.filter(c=>(c.status||'AKTIF')==='AKTIF').length;
    const nonAktif = _data.length - aktif;

    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Data Customer</h2>
          <p>Manajemen data perusahaan klien catering</p>
        </div>
        ${canEdit ? '<div class="page-header-right"><button class="btn btn-primary" onclick="CustomerModule.openModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg> Tambah Customer</button></div>' : ''}
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin-bottom:var(--s4)">
        ${[
          {l:'Total Customer',v:_data.length,c:'#6366f1',s:'perusahaan'},
          {l:'Aktif',         v:aktif,       c:'#10b981',s:'aktif'},
          {l:'Tidak Aktif',  v:nonAktif,    c:'#f59e0b',s:'non-aktif'},
        ].map(s=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${s.c}"></div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px">${s.l}</div>
          <div style="font-size:22px;font-weight:900;color:${s.c};font-family:var(--font-mono)">${s.v} <span style="font-size:12px;font-weight:400;color:var(--text-3)">${s.s}</span></div>
        </div>`).join('')}
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
          <div style="position:relative;flex:1;max-width:300px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"
              style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-3)"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input placeholder="Cari nama / PIC / kota..." value="${_search}"
              style="width:100%;padding:6px 8px 6px 28px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);font-size:12px;color:var(--text);outline:none;box-sizing:border-box"
              oninput="CustomerModule.setSearch(this.value)">
          </div>
          <span style="font-size:12px;color:var(--text-3);margin-left:auto">${list.length} customer</span>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:900px">
            <thead>
              <tr style="background:var(--primary-h)">
                <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;width:36px">#</th>
                <th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;min-width:200px">Nama Perusahaan</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;width:110px">PIC</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;width:120px">No. Telepon</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;width:100px">Kota</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;min-width:140px">Alamat</th>
                <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;width:80px">Status</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;min-width:130px">Email</th>
                <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;min-width:120px">Catatan</th>
                ${canEdit ? '<th style="padding:10px 12px;width:50px"></th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${!list.length
                ? '<tr><td colspan="10" style="text-align:center;padding:48px;color:var(--text-3);font-size:13px">Belum ada data customer.<br><span style=\"font-size:12px\">Klik \"+ Tambah Customer\" untuk menambahkan.</span></td></tr>'
                : list.map((c,i)=>{
                    const ak=(c.status||'AKTIF')==='AKTIF';
                    const sc=ak?'background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)':'background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.25)';
                    const bg=i%2===1?'var(--surface2)':'transparent';
                    return '<tr style="border-bottom:1px solid var(--border);background:'+bg+'" onmouseover="this.style.background=\'rgba(99,102,241,.05)\'" onmouseout="this.style.background=\''+bg+'\'">'
                      +'<td style="padding:10px 12px;text-align:center;font-size:11px;color:var(--text-3)">'+(i+1)+'</td>'
                      +'<td style="padding:10px 14px"><div style="font-weight:700;font-size:13px;color:var(--heading)">'+(c.nama||'-')+'</div></td>'
                      +'<td style="padding:10px 12px;font-size:12px;color:var(--text-2)">'+(c.pic||'-')+'</td>'
                      +'<td style="padding:10px 12px;font-size:12px;font-family:var(--font-mono);color:var(--text-2)">'+(c.noHp||'-')+'</td>'
                      +'<td style="padding:10px 12px;font-size:12px;color:var(--text-2)">'+(c.kota||'-')+'</td>'
                      +'<td style="padding:10px 12px;font-size:12px;color:var(--text-2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(c.alamat||'')+'">'+(c.alamat||'-')+'</td>'
                      +'<td style="padding:10px 12px;text-align:center"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;'+sc+'">'+(c.status||'AKTIF')+'</span></td>'
                      +'<td style="padding:10px 12px;font-size:12px;color:var(--text-3)">'+(c.email||'-')+'</td>'
                      +'<td style="padding:10px 12px;font-size:12px;color:var(--text-3)">'+(c.catatan||'-')+'</td>'
                      +(canEdit?'<td style="padding:10px 12px"><button onclick="CustomerModule.openModal(\''+c.id+'\')" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);display:inline-flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg></button></td>':'')
                      +'</tr>';
                  }).join('')
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function setSearch(val) {
    _search = (val||'').toLowerCase().trim();
    _render();
  }

  function openModal(id) {
    const c = id ? _data.find(x=>x.id===id) : null;
    Modal.open({
      title: c ? 'Edit Customer' : 'Tambah Customer',
      body: `<div style="display:grid;gap:var(--s3)">
        <div class="form-group">
          <label class="form-label">Nama Perusahaan <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="cf-nama" placeholder="PT. ..." value="${c?.nama||''}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
          <div class="form-group">
            <label class="form-label">PIC</label>
            <input class="form-control" id="cf-pic" placeholder="Nama PIC" value="${c?.pic||''}">
          </div>
          <div class="form-group">
            <label class="form-label">No. Telepon</label>
            <input class="form-control" id="cf-hp" type="tel" placeholder="08xx..." value="${c?.noHp||''}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)">
          <div class="form-group">
            <label class="form-label">Kota</label>
            <input class="form-control" id="cf-kota" placeholder="Karawang" value="${c?.kota||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="cf-status">
              <option value="AKTIF" ${(c?.status||'AKTIF')==='AKTIF'?'selected':''}>Aktif</option>
              <option value="NON-AKTIF" ${c?.status==='NON-AKTIF'?'selected':''}>Non-Aktif</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Alamat Lengkap</label>
          <input class="form-control" id="cf-alamat" placeholder="Jl. ..." value="${c?.alamat||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-control" id="cf-email" type="email" placeholder="email@perusahaan.com" value="${c?.email||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Catatan</label>
          <input class="form-control" id="cf-catatan" placeholder="Keterangan tambahan" value="${c?.catatan||''}">
        </div>
      </div>`,
      buttons: [
        {label:'Batal', class:'btn-ghost', onclick:'Modal.close()'},
        {label: c?'Simpan Perubahan':'Tambah Customer', class:'btn-primary',
         onclick:`CustomerModule._submit('${c?.id||''}')`}
      ]
    });
  }

  function _submit(id) {
    const nama = document.getElementById('cf-nama')?.value?.trim();
    if (!nama) { Notify.warning('Nama perusahaan wajib diisi'); return; }
    const obj = {
      id:      id || Utils.uid(),
      nama,
      pic:     document.getElementById('cf-pic')?.value?.trim()    ||'',
      noHp:    document.getElementById('cf-hp')?.value?.trim()     ||'',
      kota:    document.getElementById('cf-kota')?.value?.trim()   ||'',
      status:  document.getElementById('cf-status')?.value         ||'AKTIF',
      alamat:  document.getElementById('cf-alamat')?.value?.trim() ||'',
      email:   document.getElementById('cf-email')?.value?.trim()  ||'',
      catatan: document.getElementById('cf-catatan')?.value?.trim()||'',
    };
    if (id) {
      const i = _data.findIndex(c=>c.id===id);
      if (i>=0) _data[i]=obj; else _data.push(obj);
    } else {
      _data.push(obj);
    }
    localStorage.setItem('becca_customers', JSON.stringify(_data));
    Modal.close();
    Notify.success(id?'Customer diperbarui':'Customer berhasil ditambahkan');
    _render();
  }

  return { init, setSearch, openModal, _submit };
})();
window.CustomerModule = CustomerModule;
