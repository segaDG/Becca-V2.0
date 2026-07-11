/* ============================================
   BECCA V2.0 — Kas Kecil Module
   Spreadsheet: click row to edit inline
   AI type suggestion from nama field
============================================ */
if(window.BECCA_DEBUG) console.log('[BECCA] KasModule v20260327d loaded');
const KasModule = (() => {
  let _kas        = [];
  let _masuk      = [];
  let _saldoAwal  = 0;  // Saldo awal kas, bisa di-edit user
  let _bulkSelected = new Set();
  let _kasLoaded   = false; // false = first paint, show skeleton; true = data fetched

  // Manual override snapshots per bulan: { 'YYYY-MM': number }
  let _saldoAwalSnapshots = {};

  async function _loadSaldoAwal() {
    try {
      const cfg = await DB.getSettings().catch(()=>({}));
      if (cfg) {
        // Snapshots per-bulan (kalau ada)
        if (cfg.saldoAwalSnapshots && typeof cfg.saldoAwalSnapshots === 'object') {
          _saldoAwalSnapshots = { ...cfg.saldoAwalSnapshots };
        }
        if (cfg.saldoAwal !== undefined && cfg.saldoAwal !== null) {
          const v = parseFloat(cfg.saldoAwal) || 0;
          localStorage.setItem('becca_kas_saldo_awal', String(v));
          return v;
        }
      }
    } catch {}
    return parseFloat(localStorage.getItem('becca_kas_saldo_awal')||'0') || 0;
  }
  function _saveSaldoAwal(v) {
    localStorage.setItem('becca_kas_saldo_awal', String(v));
    _saldoAwal = v;
    DB.saveSettings({ saldoAwal: v }).catch(()=>{});
  }

  // Get saldo awal untuk bulan tertentu (YYYY-MM format).
  // Resolusi: (1) snapshot manual kalau ada → (2) otomatis hitung dari saldo awal
  // global + Σ transaksi sebelum bulan ini.
  // Returns { value, source: 'manual'|'computed', firstTxDate? }
  function _getSaldoAwalForMonth(yearMonth) {
    if (!yearMonth || yearMonth.length < 7) {
      return { value: _saldoAwal, source: 'computed' };
    }
    // Manual override?
    if (_saldoAwalSnapshots && typeof _saldoAwalSnapshots[yearMonth] === 'number') {
      return { value: _saldoAwalSnapshots[yearMonth], source: 'manual' };
    }
    // Otomatis: saldo awal global + Σ kas masuk SEBELUM bulan ini − Σ kas keluar SEBELUM bulan ini
    const cutoff = yearMonth + '-01'; // pertama bulan terpilih
    let sumIn = 0, sumOut = 0;
    _kas.forEach(r => {
      const tgl = r.tgl || '';
      if (!tgl || tgl >= cutoff) return; // skip transaksi di/sesudah bulan ini
      if (r.type === 'Kas') sumIn += (r.jumlah || 0);
      else                  sumOut += (r.jumlah || 0);
    });
    return { value: _saldoAwal + sumIn - sumOut, source: 'computed' };
  }

  // Save snapshot manual untuk bulan tertentu (override otomatis)
  async function _saveSaldoAwalSnapshot(yearMonth, value) {
    _saldoAwalSnapshots[yearMonth] = parseFloat(value) || 0;
    try {
      const cfg = await DB.getSettings().catch(()=>({})) || {};
      cfg.saldoAwalSnapshots = { ..._saldoAwalSnapshots };
      await DB.saveSettings(cfg);
    } catch (e) { if(window.BECCA_DEBUG) console.warn('[Kas] saveSaldoAwalSnapshot failed:', e); }
  }

  // Remove snapshot manual (revert ke otomatis)
  async function _clearSaldoAwalSnapshot(yearMonth) {
    delete _saldoAwalSnapshots[yearMonth];
    try {
      const cfg = await DB.getSettings().catch(()=>({})) || {};
      cfg.saldoAwalSnapshots = { ..._saldoAwalSnapshots };
      await DB.saveSettings(cfg);
    } catch {}
  }
  let _activeTab = 'transaksi';
  let _lastEditMap = {}; // {rowId: {by, at, ts, type}} — for "Terakhir diedit" tooltip
  let _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'', search:'' };
  let _page    = 1;
  // Default perPage: 25 di mobile (<768px) supaya render 12-cell rows tidak laggy
  // di HP / low-end laptop. Desktop tetap 50. User bisa override via dropdown
  // (tersimpan ke LS jadi pilihan user preserve).
  let _perPage = parseInt(
    localStorage.getItem('becca_kas_perPage') ||
    (window.innerWidth < 768 ? '25' : '50')
  );
  let _editingId  = null;
  let _kasLocked  = new Set();
  const _KAS_LOCK_KEY = 'becca_kas_locked_ids';
  let _pendingChanges = {};

  const TYPES = ['Raw Food','Sayuran','Buah segar','Raw Materials','Plastik','Minuman','Snack',
    'Kasbon','Gaji','Bensin','Maintenance','OP.Expense','B.Logistik',
    'Listrik PLN','PDAM','Pulsa','Pajak','Kas','Lain-lain'];
  const SATUANS = ['Kg','Pcs','Bks','Box','Btl','Kli','Prsi','Gbng','Ikt','Lbr',
    'Pack','Bag','Ltr','Unit','Rim','Rol','Sak','Dus'];
  const MONTHS  = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

  /* ===================== AI TYPE SUGGESTION ===================== */
  const TYPE_RULES = [
    // === Non-food (exact categories, checked first) ===
    {keys:['gaji','salary','upah','thr','honor'],      type:'Gaji'},
    {keys:['kasbon','pinjam','piutang','hutang'],      type:'Kasbon'},
    {keys:['bensin','solar','bbm','pertamax','pertalite','fuel'],type:'Bensin'},
    {keys:['listrik','pln','kwh'],                     type:'Listrik PLN'},
    {keys:['pdam','water'],                            type:'PDAM'},
    {keys:['pulsa','kuota','internet','telp','hp'],    type:'Pulsa'},
    {keys:['pajak','tax','bpjs','iuran'],              type:'Pajak'},
    {keys:['servis','service','perbaikan','repair','maintenance','service ac','pasang ac','freon','kompressor','mesin'],type:'Maintenance'},
    {keys:['transport','angkut','kurir','ongkir','logistik'],type:'B.Logistik'},
    {keys:['biaya','operasional','atk','alat tulis','kantor','cleaning','kebersihan','sewa','parkir',
           'etoll','e-toll','toll','admin transfer','admin bank','admin tf'],type:'OP.Expense'},
    {keys:['kas','transfer','bank','dana','gopay','ovo','setoran'],type:'Kas'},
    {keys:['dp','seragam','uniform'],                  type:'OP.Expense'},
    // Plastik & packaging
    {keys:['plastik','mika','mika bento','styrofoam','sterofoam','wadah plastik',
           'sendok plastik','garpu plastik','sendok bening','sedotan','kantong','kresek',
           'cup plastik','cup puding','cup salad','tutup cup','lid cup',
           'box makan','lunch box','food container','food box','food pail',
           'aluminium foil','alumunium foil','cling wrap','wrapping','stretch film',
           'tray','tray foam','paper bag','paper bowl','paper cup','paper box',
           'toples','zipper bag','ziplock','vacuum bag','standing pouch',
           'sarung tangan','glove','tissue','tisu','serbet',
           'hd sampah','trash bag','kantong sampah'],type:'Plastik'},
    // === Food — specific before generic ===
    // Snack (before food so "pop mie" → Snack, not Raw Materials from "mie")
    {keys:['snack','keripik','biskuit','kue','camilan','permen','cokelat',
           'wafer','crackers','popcorn','dodol','nastar','kastengel','putri salju',
           'roti manis','pop mie','pop mi','indomie snack'],type:'Snack'},
    // Minuman (before Raw Materials so "susu uht" → Minuman, not from "susu")
    {keys:['teh','kopi','coffee','jus','juice','minuman','sirup','syrup',
           'susu uht','susu kotak','susu cair','susu','yakult','pocari','aqua','soda','cola',
           'capuccino','latte','matcha','smoothie','milkshake'],type:'Minuman'},
    // Raw Food: protein hewani
    {keys:['ayam','chicken','daging','ikan','sapi','beef','udang','shrimp','telur','egg',
           'cumi','kepiting','kerang','lele','nila','gurame','patin','kakap','tongkol','tuna',
           'bandeng','bawal','cakalang','tenggiri','baronang','kembung','salem',
           'paha','dada','fillet','tulang','ekor','hati ampela','usus','ceker','sayap',
           'bakso','sosis','nugget','kornet','otak','rawon'],type:'Raw Food'},
    // Sayuran
    {keys:['sayur','kangkung','bayam','wortel','kubis','brokoli','sawi','selada',
           'kentang','kol','lobak','tauge','toge','terong','terung','labu','timun','mentimun',
           'tomat','buncis','kacang panjang','pete','petai','jengkol','pare',
           'jagung','daun bawang','daun sup','seledri','kemangi','genjer',
           'paprika','asparagus','rebung','jamur','champignon','enoki',
           'cabe','cabai','cabe merah','cabe rawit','cabe hijau','cabe keriting',
           'bawang merah','bawang putih','bawang bombay','bawang bombai','bawang pre',
           'santan','nangka','pepaya muda',
           'putren','oyong','gambas','sengon','kecipir','kluwih',
           'kembang kol','baby corn','edamame',
           'melinjo','kencur','sereh','serai','lengkuas',
           'pakcoy','pak choy','pecay','pe cay',
           'daun singkong','sesin','daun pisang',
           'daun jeruk'],type:'Sayuran'},
    // Buah segar
    {keys:['buah','apel','jeruk','pisang','mangga','melon','semangka',
           'anggur','strawberry','stroberi','alpukat','nanas','pepaya','salak',
           'rambutan','durian','kelengkeng','manggis','lemon','lime','limau',
           'jambu','sawo','belimbing','sirsak','markisa','kiwi','pear','persik',
           'leci','ceri','kurma','tin','kelapa muda','degan'],type:'Buah segar'},
    // Raw Materials: bumbu, rempah, bahan kering
    {keys:['minyak','tepung','gula','garam','kecap','saos','saus','bumbu','bumbu racik',
           'merica','lada','pala','cengkeh','kayu manis','kunyit','kunir','jahe',
           'laos','daun salam','daun pandan',
           'ketumbar','jintan','kemiri','kluwek','asam','terasi','petis','tauco',
           'santan bubuk','kelapa','margarin','mentega','butter','keju','cream',
           'tahu','tempe','tempeh','oncom','kedelai','kacang kedelai','kacang tanah','kacang',
           'beras','bihun','mie','mi','makaroni','pasta','spaghetti','roti tawar',
           'tepung terigu','tepung beras','tepung maizena','tepung sagu','tepung kanji',
           'krupuk','kerupuk','emping','rempeyek',
           'madu','selai','coklat','vanili','pewarna','pengembang',
           'cuka','mayones','mustard','sambal','bon cabe',
           'kwetiau','bawang goreng','kulit lumpia','kulit pangsit','soun',
           'es batu'],type:'Raw Materials'},
    // Lain-lain (explicit matches)
    {keys:['isi ulang air','air galon','galon air','refill galon','face mask','masker wajah'],type:'Lain-lain'},
  ];

  function _suggestType(nama) {
    if (!nama) return null;
    const lower = nama.toLowerCase().trim();
    for (const rule of TYPE_RULES) {
      // Check longer keys first to avoid false positive from short substrings
      const sorted = [...rule.keys].sort((a,b) => b.length - a.length);
      if (sorted.some(k => lower.includes(k))) return rule.type;
    }
    return null;
  }

  /* ===================== RE-CLASSIFY ALL TYPES ===================== */
  async function reClassifyTypes() {
    const ok = await Modal.confirm({
      title: 'Re-Classify Semua Type',
      message: `<p>Fungsi ini akan memperbarui kolom <strong>Type</strong> pada seluruh data kas berdasarkan AI rules terbaru.</p>
        <ul style="font-size:12px;margin:8px 0;padding-left:18px;color:var(--text-2)">
          <li>Item yang dikenali → Type diperbarui otomatis</li>
          <li>Item yang <strong>tidak</strong> dikenali → Type diubah ke <strong>Lain-lain</strong></li>
          <li>Type non-food (Gaji, Kasbon, Bensin, dll) tetap diproses ulang</li>
        </ul>
        <p style="font-size:12px;color:var(--warning)">⚠ Proses ini akan mengubah data di database. Pastikan Anda yakin.</p>`,
      confirmText: 'Ya, Re-Classify', confirmClass: 'btn-primary', cancelText: 'Batal'
    });
    if (!ok) return;

    Notify.info('Memproses re-classify...');
    let changed = 0, unchanged = 0, errors = 0;
    const CHUNK = 10;
    const toUpdate = [];

    for (const r of _kas) {
      if (!r.nama) continue;
      const newType = _suggestType(r.nama) || 'Lain-lain';
      if (r.type !== newType) {
        r.type = newType;
        toUpdate.push(r);
        changed++;
      } else {
        unchanged++;
      }
    }

    const rcMid = 'rc-result-' + Date.now();
    if (!toUpdate.length) {
      Modal.open({ id: rcMid, title:'Re-Classify Selesai', size:'modal-sm',
        body:`<div style="text-align:center;padding:16px 0">
          <div style="font-size:36px;margin-bottom:8px">✅</div>
          <div style="font-size:14px;font-weight:600;color:var(--heading)">Semua type sudah sesuai</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px">${unchanged} data diperiksa — tidak ada perubahan</div>
        </div>`,
        footer:`<button class="btn btn-primary btn-sm" onclick="Modal.close('${rcMid}')">OK</button>`
      });
      return;
    }

    // Save to Supabase in chunks
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const batch = toUpdate.slice(i, i + CHUNK);
      const results = await Promise.allSettled(batch.map(r => DB.saveKas({...r})));
      errors += results.filter(r => r.status === 'rejected').length;
    }

    // Group changes by type for summary
    const byNewType = {};
    toUpdate.forEach(r => { byNewType[r.type] = (byNewType[r.type]||0)+1; });
    const typeSummary = Object.entries(byNewType).sort((a,b)=>b[1]-a[1])
      .map(([t,c]) => `<tr><td style="padding:4px 8px;font-weight:500">${t}</td><td style="padding:4px 8px;text-align:right;font-family:var(--font-mono)">${c}</td></tr>`).join('');

    renderTransaksi();
    DB.logActivity({ type: 'reclassify_kas', detail: `Re-classify type: ${changed} diubah, ${unchanged} tetap, ${errors} error` });

    Modal.open({ id: rcMid, title:'Re-Classify Selesai', size:'modal-sm',
      body:`<div style="padding:8px 0">
        <div style="display:grid;grid-template-columns:1fr 1fr ${errors?'1fr':''};gap:12px;margin-bottom:16px">
          <div style="text-align:center;padding:12px;background:rgba(99,102,241,.06);border-radius:8px">
            <div style="font-size:24px;font-weight:800;color:var(--primary)">${changed}</div>
            <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;margin-top:2px">Diperbarui</div>
          </div>
          <div style="text-align:center;padding:12px;background:rgba(34,197,94,.06);border-radius:8px">
            <div style="font-size:24px;font-weight:800;color:var(--success)">${unchanged}</div>
            <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;margin-top:2px">Sudah Sesuai</div>
          </div>
          ${errors?`<div style="text-align:center;padding:12px;background:rgba(239,68,68,.06);border-radius:8px">
            <div style="font-size:24px;font-weight:800;color:var(--danger)">${errors}</div>
            <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;margin-top:2px">Error</div>
          </div>`:''}
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px;text-transform:uppercase">Perubahan per Kategori</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="padding:4px 8px;text-align:left;font-size:10px;color:var(--text-3)">Type</th>
            <th style="padding:4px 8px;text-align:right;font-size:10px;color:var(--text-3)">Jumlah</th>
          </tr></thead>
          <tbody>${typeSummary}</tbody>
        </table>
      </div>`,
      footer:`<button class="btn btn-primary btn-sm" onclick="Modal.close('${rcMid}')">OK</button>`
    });
  }

  /* ===================== INIT ===================== */
  async function init() {
    const page = document.getElementById('page-kas');
    page.innerHTML = _renderShell();
    // Pull-to-refresh mobile (auto-no-op desktop)
    if (Utils.pullToRefresh && !page._ptrAttached) {
      page._ptrAttached = true;
      Utils.pullToRefresh(page, async () => {
        try { _kas = await DB.getKas(); _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); } catch {}
        try { _masuk = await DB.getKasMasuk(); } catch {}
        if (_activeTab === 'transaksi') renderTransaksi();
      });
    }
    _saldoAwal = await _loadSaldoAwal();
    try { _kasLocked = new Set(JSON.parse(localStorage.getItem(_KAS_LOCK_KEY)||'[]')); } catch { _kasLocked = new Set(); }
    _editingId = null;
    _pendingChanges = {};
    UndoRedo.setActive('kas');
    // Restore filter state from URL (refresh / shared link)
    if (Utils.urlState) {
      const restored = Utils.urlState.read('kas', ['bulan','type','status','dateFrom','dateTo','search','page']);
      Object.assign(_filter, restored);
      if (restored.page) { const p = parseInt(restored.page); if (p > 0) _page = p; }
    }

    // Progressive loading — fast first page, background load rest
    const cachedKas   = DB.getCached('kas');
    const cachedMasuk = DB.getCached('kas_masuk');
    if (cachedKas)   { _kas = cachedKas; _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); _kasLoaded = true; }
    if (cachedMasuk) _masuk = cachedMasuk;

    switchTab('transaksi');
    _injectStyles();

    if (!cachedKas || !cachedMasuk) {
      // Fast: fetch first page (50 rows) for instant render
      if (!cachedKas) {
        const first = await DB.getPage('kas', { page:1, perPage:100, orderBy:'created_at', ascending:false });
        if (first.data.length) { _kas = first.data; _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); _kasLoaded = true; renderTransaksi(); }
      }
      // Background: load full dataset
      const [freshKas, freshMasuk] = await Promise.all([
        cachedKas   ? Promise.resolve(cachedKas)   : DB.getKas(),
        cachedMasuk ? Promise.resolve(cachedMasuk) : DB.getKasMasuk(),
      ]);
      _kas   = freshKas;
      _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
      _masuk = freshMasuk;
      _kasLoaded = true;
      if (_activeTab === 'transaksi') renderTransaksi();
      else switchTab(_activeTab);
    }
    // Update belanja pasar badge on init (without switching tab)
    _updateBPBadge();
    // One-time fix: rekonsiliasi jumlah = qty × harga untuk data lama
    _autoRecomputeJumlahsOnce();
    // Load last-edit map untuk tooltip "Terakhir diedit"
    DB.getLastEditMap?.(['edit_kas','add_kas','delete_kas']).then(m => {
      _lastEditMap = m || {};
      if (_activeTab === 'transaksi') renderTransaksi();
    }).catch(()=>{});
  }

  /* ── Rekonsiliasi total: pastikan jumlah = qty × harga (one-time) ── */
  function _autoRecomputeJumlahsOnce() {
    const FLAG = 'becca_kas_jumlah_recompute_v1';
    if (localStorage.getItem(FLAG) === '1') return;
    if (!_kas || !_kas.length) return;
    const fixes = [];
    for (const r of _kas) {
      const q = Number(r.qty)||0, h = Number(r.hargaSatuan)||0;
      if (q <= 0 || h <= 0) continue; // skip baris dengan qty/harga 0 (kasus manual)
      const expected = Math.round(q * h);
      if ((Number(r.jumlah)||0) !== expected) {
        r.jumlah = expected;
        fixes.push({...r});
      }
    }
    localStorage.setItem(FLAG, '1');
    if (!fixes.length) return;
    Promise.allSettled(fixes.map(r => DB.saveKas(r))).then(() => {
      Notify.info(`${fixes.length} baris Total dikoreksi sesuai formula qty × harga`);
      if (_activeTab === 'transaksi') renderTransaksi();
    });
  }

  async function _updateBPBadge() {
    let bpDocs = [];
    try { bpDocs = await DB.getBelanjaPasar(); } catch {}
    const pending = bpDocs.filter(d => d.status === 'selesai' && d.kasStatus !== 'confirmed').length;
    // Tab badge
    const tabBtn = document.querySelector('[data-tab="belanjaPasar"]');
    if (tabBtn) {
      const old = tabBtn.querySelector('.bp-kas-badge');
      if (old) old.remove();
      if (pending > 0) tabBtn.insertAdjacentHTML('beforeend',
        `<span class="bp-kas-badge" style="display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;background:#ef4444;color:#fff;border-radius:99px;font-size:9px;font-weight:700;margin-left:6px;padding:0 4px">${pending}</span>`);
    }
    // Sidebar badge
    const sideLink = document.querySelector('[data-page="kas"]');
    if (sideLink) {
      const old = sideLink.querySelector('.bp-side-badge');
      if (old) old.remove();
      if (pending > 0) {
        sideLink.style.position = 'relative';
        sideLink.insertAdjacentHTML('beforeend',
          `<span class="bp-side-badge" style="position:absolute;top:4px;right:4px;min-width:14px;height:14px;background:#ef4444;color:#fff;font-size:8px;font-weight:700;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 3px">${pending}</span>`);
      }
    }
  }

  function _injectStyles() {
    if (document.getElementById('kas-ss-style')) return;
    const s = document.createElement('style');
    s.id = 'kas-ss-style';
    s.textContent = `
      .ks-tbl{width:100%;border-collapse:collapse;font-size:13px;}
      /* Performance: tiap row jadi paint-containment unit. Browser skip paint
         row di luar viewport → scroll lebih smooth di HP/low-end laptop.
         contain-intrinsic-size cegah layout shift saat scroll. */
      .ks-tbl tbody tr{content-visibility:auto;contain-intrinsic-size:auto 34px;}
      .ks-tbl th{background:var(--thead-bg);color:var(--thead-text);font-size:10px;text-transform:uppercase;
        letter-spacing:.05em;padding:7px 8px;border:1px solid var(--border);white-space:nowrap;
        position:sticky;top:0;z-index:2;}
      .ks-tbl td{border:1px solid var(--border);padding:0;height:32px;background:var(--surface);vertical-align:middle;}
      .ks-tbl td .ks-cell{display:flex;align-items:center;padding:0 8px;height:32px;cursor:cell;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;}
      /* Kolom NAMA / KETERANGAN — single scrollable inner container.
         Nama text + badge + link-anggaran SEMUA ikut scroll horizontal kalau
         nama panjang → konten kelihatan lebih banyak per visible width.
         IMPORTANT: tanpa space sebelum .ks-nama-cell karena td.ks-nama-cell
         (class langsung di td), bukan descendant. */
      .ks-tbl td.ks-nama-cell{overflow:hidden;padding:0;max-width:none;height:32px}
      .ks-tbl td.ks-nama-cell .ks-nama-scroll{display:flex;align-items:center;gap:5px;height:32px;padding:0 8px;
        overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:thin;-webkit-overflow-scrolling:touch;cursor:cell;width:100%;box-sizing:border-box}
      .ks-tbl td.ks-nama-cell .ks-nama-scroll::-webkit-scrollbar{height:3px}
      .ks-tbl td.ks-nama-cell .ks-nama-scroll::-webkit-scrollbar-thumb{background:var(--text-3);border-radius:2px}
      .ks-tbl td.ks-nama-cell .ks-nama-scroll::-webkit-scrollbar-track{background:transparent}
      .ks-tbl td.ks-nama-cell .ks-nama-scroll > *{flex:0 0 auto;white-space:nowrap}
      /* Column resize handle di th — drag horizontal untuk lebarkan kolom */
      .ks-tbl th.ks-th-resizable{position:relative}
      .ks-tbl th .ks-resize-handle{position:absolute;top:0;right:-3px;width:6px;height:100%;cursor:col-resize;z-index:5;user-select:none;background:transparent;transition:background .15s}
      .ks-tbl th .ks-resize-handle:hover, .ks-tbl th .ks-resize-handle.dragging{background:rgba(99,102,241,.5)}
      .ks-tbl.ks-col-resizing{cursor:col-resize!important;user-select:none}
      .ks-tbl td .ks-cell[title]{cursor:cell;}
      .ks-tbl tr.ks-view:hover td{background:rgba(99,102,241,.1);cursor:pointer;}
      .ks-tbl tr.ks-editing td{background:rgba(99,102,241,.08)!important;outline:2px solid var(--primary);outline-offset:-1px;box-shadow:inset 0 0 0 1px rgba(99,102,241,.15);}
      .ks-inp{width:100%;height:100%;border:none;outline:none;padding:0 6px;background:transparent;
        color:var(--text);font-size:13px;font-family:var(--font);box-sizing:border-box;min-height:32px;}
      .ks-inp:focus{background:rgba(99,102,241,.1);box-shadow:inset 0 -2px 0 var(--primary);}
      .ks-sel{width:100%;height:32px;border:none;outline:none;padding:0 4px;background:var(--surface3);
        color:var(--text);font-size:12px;font-family:var(--font);cursor:pointer;}
      .ks-num{text-align:right;font-family:var(--font-mono);}
      .ks-num .ks-cell{justify-content:flex-end;}
      .ks-add-row{width:100%;padding:8px 12px;border:none;background:var(--surface2);color:var(--text-3);
        cursor:pointer;font-size:12px;text-align:left;border-top:1px solid var(--border);
        display:flex;align-items:center;gap:6px;transition:background .15s;}
      .ks-add-row:hover{background:var(--surface3);color:var(--primary-h);}
      .ks-del-btn{width:26px;height:26px;border:none;background:transparent;cursor:pointer;color:var(--text-3);
        border-radius:4px;display:flex;align-items:center;justify-content:center;margin:auto;transition:all .15s;}
      .ks-del-btn:hover{background:rgba(239,68,68,.15);color:var(--danger);}
      .ks-saved{animation:ksSv 1.2s ease;}
      @keyframes ksSv{0%,30%{background:rgba(34,197,94,.25)}100%{background:transparent}}
      .ks-ai-badge{font-size:9px;background:rgba(99,102,241,.2);color:var(--primary-h);
        border-radius:3px;padding:1px 4px;margin-left:4px;vertical-align:middle;}
      .ks-tbl tr.ks-row-kas td{background:rgba(59,130,246,.10)!important;}
      .ks-tbl tr.ks-row-kas:hover td{background:rgba(59,130,246,.20)!important;}
      .ks-tbl tr.ks-row-done td{background:rgba(22,101,52,.18)!important;}
      .ks-tbl tr.ks-row-done:hover td{background:rgba(22,101,52,.28)!important;}
      .ks-tbl tr.ks-row-done .badge{background:#16a34a!important;color:#fff!important;font-weight:700!important;}
      .ks-tbl tr.ks-row-done .ks-cell{color:var(--text-2)!important;}
      .ks-tbl tr.ks-row-tbc td{background:rgba(245,158,11,.10)!important;}
      .ks-tbl tr.ks-row-tbc:hover td{background:rgba(245,158,11,.20)!important;}
      .ks-tbl tr.ks-row-tbc .badge-warning{background:#d97706!important;color:#fff!important;font-weight:700!important;}
      .ks-tbl tr.ks-row-bp td{background:rgba(8,145,178,.06)!important;}
      .ks-tbl tr.ks-row-bp:hover td{background:rgba(8,145,178,.12)!important;}
      .ks-tbl tr.ks-row-bp td:first-child{border-left:3px solid #0891b2!important;}
      .ks-action-group{display:flex;align-items:center;gap:4px;padding:2px;background:var(--surface2);border-radius:var(--r-sm);border:1px solid var(--border);}
      .ks-act-btn{height:30px;min-width:30px;border-radius:4px;border:none;background:transparent;cursor:pointer;
        display:flex;align-items:center;justify-content:center;gap:4px;color:var(--text-2);font-size:11px;
        font-weight:600;transition:all .15s;padding:0 6px;white-space:nowrap;}
      .ks-act-btn:hover{background:var(--surface3);color:var(--primary);}
      .ks-act-btn[disabled]{opacity:.3;pointer-events:none;}
      .ks-act-btn svg{flex-shrink:0;}
      .ks-search-float{margin-bottom:var(--s3);overflow:hidden;transition:max-height .2s ease,opacity .2s ease;}
      .ks-search-float.open{max-height:60px;opacity:1;}
      .ks-search-float.closed{max-height:0;opacity:0;margin:0;}
    `;
    document.head.appendChild(s);
    // Auto-select text on focus for edit inputs
    document.addEventListener('focusin', e => {
      if (e.target.matches('.ks-inp,.iv-inp,[data-eid] input,[data-eid] select')) {
        setTimeout(() => { if (e.target.select) e.target.select(); }, 0);
      }
    });
  }

  function _renderShell() {
    return `
      <div class="page-header">
        <div class="page-header-left"><h2>Kas Kecil</h2><p>Manajemen kas dan pengeluaran</p></div>
        <div class="page-header-right"><span id="kas-hdr-btn"></span></div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="transaksi" onclick="KasModule.switchTab('transaksi')">Transaksi</button>
        <button class="tab-btn" data-tab="summary"   onclick="KasModule.switchTab('summary')">Summary</button>
        <button class="tab-btn" data-tab="monthly"   onclick="KasModule.switchTab('monthly')">Monthly Report</button>
        <button class="tab-btn" data-tab="cashflow"  onclick="KasModule.switchTab('cashflow')">Cash Flow</button>
      </div>
      <div id="kas-bp-dash"></div>
      <div id="kas-tab-transaksi"></div>
      <div id="kas-tab-summary"  style="display:none"></div>
      <div id="kas-tab-monthly"  style="display:none"></div>
      <div id="kas-tab-cashflow" style="display:none"></div>
    `;
  }

  function switchTab(tab) {
    _activeTab = tab;
    ['transaksi','summary','monthly','cashflow'].forEach(t => {
      const el = document.getElementById('kas-tab-'+t);
      if (el) el.style.display = t===tab?'':'none';
      document.querySelector('[data-tab="'+t+'"]')?.classList.toggle('active', t===tab);
    });
    const hdr = document.getElementById('kas-hdr-btn');
    if (hdr) hdr.innerHTML = tab==='transaksi' && Auth.can('kas','edit')
      ? `<button class="btn btn-ghost btn-sm" onclick="KasModule.importExcel()" title="Import data dari file Excel (.xlsx)">Import Excel</button>
         <button class="btn btn-ghost btn-sm" onclick="KasModule.exportCSV()">Export CSV</button>
         <button class="btn btn-ghost btn-sm" onclick="KasModule.printPDF()">Print PDF</button>
         ${Auth.currentUser()?.role==='superadmin'?'<button class="btn btn-ghost btn-sm" onclick="KasModule.reClassifyTypes()" title="Perbarui kolom Type berdasarkan AI rules terbaru">Re-Classify Type</button>':''}`
      : '';
    // BP dashboard visibility follows transaksi tab
    const bpEl = document.getElementById('kas-bp-dash');
    if (bpEl) bpEl.style.display = tab==='transaksi' ? '' : 'none';
    if (tab==='transaksi') { UndoRedo.setActive('kas'); _renderBPDashboard(); renderTransaksi(); _renderBalanceCards(); }
    else if (tab==='summary')  renderSummary();
    else if (tab==='monthly')  renderMonthly();
    else if (tab==='cashflow') renderCashflow();
  }

  /* ===================== RENDER TRANSAKSI ===================== */
  function reArrange() {
    // Sort source array _kas by date descending (persists across renders)
    _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    renderTransaksi();
    Notify.success('Data diurutkan berdasarkan tanggal');
  }

  function renderTransaksi() {
    const canEdit = Auth.can('kas','edit');
    const filtered = _applyFilter(_kas); // preserves _kas order, no auto-sort
    const total    = filtered.length;
    const paged    = filtered.slice((_page-1)*_perPage, _page*_perPage);
    const totalPg  = Math.ceil(total/_perPage);
    const sum      = filtered.reduce((s,r)=>s+(r.jumlah||0),0);
    const bulanOpts= [...new Set(_kas.map(r=>r.bulan).filter(Boolean))].sort();

    document.getElementById('kas-tab-transaksi').innerHTML = `
      <div style="margin-bottom:var(--s4)" id="kas-strip-wrap">${_summaryStrip(filtered)}<div id="kas-balance-cards" style="margin-top:var(--s3)"></div></div>
      <div class="filter-bar" style="margin-bottom:var(--s3)">
        <input type="date" class="form-control" value="${_filter.dateFrom}" onchange="KasModule.setFilter('dateFrom',this.value)" style="width:140px" title="Dari tanggal">
        <input type="date" class="form-control" value="${_filter.dateTo}"   onchange="KasModule.setFilter('dateTo',this.value)"   style="width:140px" title="Sampai tanggal">
        <select class="form-control" onchange="KasModule.setFilter('bulan',this.value)" style="width:130px">
          <option value="">Semua Bulan</option>
          ${bulanOpts.map(b=>`<option value="${b}" ${_filter.bulan===b?'selected':''}>${b}</option>`).join('')}
        </select>
        <select class="form-control" onchange="KasModule.setFilter('type',this.value)" style="width:150px">
          <option value="">Semua Type</option>
          ${TYPES.map(t=>`<option value="${t}" ${_filter.type===t?'selected':''}>${t}</option>`).join('')}
        </select>
        <select class="form-control" onchange="KasModule.setFilter('status',this.value)" style="width:120px">
          <option value="">Semua Status</option>
          <option value="DONE" ${_filter.status==='DONE'?'selected':''}>DONE</option>
          <option value="TBC"  ${_filter.status==='TBC' ?'selected':''}>TBC</option>
          <option value="-"    ${_filter.status==='-'   ?'selected':''}>- (Kosong)</option>
        </select>

        <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
          ${Utils.savedViews?.renderButton('kas', { onApply:'KasModule.applySavedFilter', getCurrent:'KasModule.getCurrentFilter' })||''}
          <button title="Lihat aktivitas terbaru" onclick="Utils.openActivityDrawer('kas')" class="ks-act-btn" style="display:inline-flex;align-items:center;gap:5px;padding:6px 10px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Aktivitas
          </button>
          <div class="ks-action-group">
            <button class="ks-act-btn${_filter.search?' active':''}" onclick="KasModule.toggleSearch()" title="Cari data (Ctrl+F)" style="${_filter.search?'color:var(--primary);background:rgba(99,102,241,.12)':''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button class="ks-act-btn" onclick="UndoRedo.undo('kas')" title="Undo (Ctrl+Z)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 10h13a4 4 0 010 8H7"/><path d="M7 6l-4 4 4 4"/></svg>
            </button>
            <button class="ks-act-btn" onclick="UndoRedo.redo('kas')" title="Redo (Ctrl+Shift+Z)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 10H8a4 4 0 000 8h9"/><path d="M17 6l4 4-4 4"/></svg>
            </button>
            <button class="ks-act-btn" onclick="KasModule.reArrange()" title="Urutkan berdasarkan tanggal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18M3 12h12M3 18h6"/></svg>
            </button>
          </div>
          <button id="kas-reset-btn" onclick="KasModule.resetFilter()" title="Reset semua filter" class="filter-reset-btn">↺</button>
          <span class="text-muted text-small">${total} baris${_filter.search?` · "${_filter.search}"`:''}</span>
        </div>
      </div>

      <!-- Floating Search Bar -->
      <div id="kas-search-bar" class="ks-search-float closed">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--surface);border:1px solid var(--primary);border-radius:var(--r-lg);box-shadow:0 4px 16px rgba(0,0,0,.08)">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" width="16" height="16" style="flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="kas-search-input" class="form-control"
            value="${_filter.search||''}"
            placeholder="Cari nama / vendor / penerima... (tekan Enter)"
            enterkeyhint="search"
            style="flex:1;border:none;background:transparent;outline:none;font-size:13px;padding:4px 0;box-shadow:none"
            oninput="KasModule._onSearchTyping(this.value)"
            onkeydown="if(event.key==='Enter'){event.preventDefault();KasModule.setFilter('search',this.value);}else if(event.key==='Escape'){KasModule.toggleSearch()}">
          <button id="kas-search-go" onclick="var i=document.getElementById('kas-search-input');KasModule.setFilter('search',i?i.value:'')"
            title="Cari (Enter)"
            style="width:26px;height:26px;border-radius:6px;border:none;background:var(--primary);color:#fff;cursor:pointer;display:none;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;font-weight:700;padding:0">↩</button>
          <button onclick="KasModule.toggleSearch()" title="Tutup pencarian (Esc)"
            style="width:24px;height:24px;border-radius:50%;border:none;background:var(--surface2);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-3);flex-shrink:0;transition:all .15s"
            onmouseover="this.style.background='var(--danger)';this.style.color='white'" onmouseout="this.style.background='var(--surface2)';this.style.color='var(--text-3)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="12" height="12"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;min-height:24px">
        <div id="kas-saldo-bar" style="font-size:12px;color:var(--text-3)"></div>
        <div id="kas-balance-bar" style="text-align:right"></div>
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;border:1px solid var(--border);border-radius:var(--r-lg)">
        <table class="ks-tbl" id="kas-grid" data-grid-select>
          <thead><tr>
            <th style="width:32px;padding:0;text-align:center">
              ${canEdit
                ? `<button title="Tambah Baris Baru" onclick="KasModule.addRow()"
                    style="width:26px;height:26px;border-radius:6px;
                           background:rgba(99,102,241,.25);
                           border:1.5px solid rgba(99,102,241,.5);
                           cursor:pointer;color:var(--primary-h);
                           font-size:15px;font-weight:900;line-height:1;
                           display:flex;align-items:center;justify-content:center;
                           transition:all .15s;margin:auto;"
                    onmouseover="this.style.background='var(--primary)';this.style.color='white';this.style.borderColor='var(--primary)'"
                    onmouseout="this.style.background='rgba(99,102,241,.25)';this.style.color='var(--primary-h)';this.style.borderColor='rgba(99,102,241,.5)'">+</button>`
                : '<span style=\"color:var(--text-3);font-size:11px\">#</span>'}
            </th>
            <th style="width:108px">Tanggal</th>
            <th class="ks-th-resizable" data-col-key="nama" style="${(()=>{let w='';try{w=parseInt(localStorage.getItem('becca_kas_col_nama'))||0;}catch{}return w>0?`width:${w}px;min-width:${w}px`:'min-width:180px';})()}">Nama / Keterangan<div class="ks-resize-handle" data-col="nama"></div></th>
            <th style="width:130px">Type <span class="ks-ai-badge">AI</span>${Utils.helpTip('Klasifikasi pengeluaran (Raw Food, Gaji, Maintenance, dll). AI auto-suggest berdasarkan nama, bisa override manual.')}</th>
            <th style="width:110px">Vendor</th>
            <th style="width:55px" class="ks-num">Qty</th>
            <th style="width:55px">Sat</th>
            <th style="width:105px" class="ks-num">Harga/Sat</th>
            <th style="width:115px" class="ks-num">Total (Rp)${Utils.helpTip('Otomatis = qty × harga/sat. Tidak bisa diedit manual — ubah qty atau harga.')}</th>
            <th style="width:100px">Penerima</th>
            <th style="width:75px">Status${Utils.helpTip('DONE = pengeluaran dikonfirmasi/sudah cair. TBC = pending verifikasi/belum jelas. Kosong = belum diisi.')}</th>
            ${canEdit ? '<th style="width:58px"></th>' : ''}
            ${canEdit ? `<th style="width:28px;padding:0;text-align:center"><input type="checkbox" title="Pilih semua" onchange="KasModule._bulkToggleAll(this.checked)" style="cursor:pointer"></th>` : ''}
          </tr></thead>
          <tbody id="kas-tbody">
            ${paged.length
              ? paged.map((r,i)=>_rowView(r,(_page-1)*_perPage+i+1,canEdit)).join('')
              : (_kasLoaded
                ? ''
                : (Utils.skeletonRows ? Utils.skeletonRows(canEdit?13:11, 8) : ''))}
          </tbody>
        </table>
      </div>
      ${UI.pagination({ page:_page, totalPages:totalPg, total, perPage:_perPage, onPage:'KasModule.goPage', onPerPage:'KasModule.setPerPage', label:'baris' })}
    `;
    _renderBalanceCards();
    if (window.GridSelect) {
      GridSelect.onFill('kas-grid', _onGridFill);
      GridSelect.onPaste('kas-grid', _onGridPaste);
    }
    _setupColResize();
    // Toggle reset button animation — double rAF to ensure browser painted inactive state first
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const rb = document.getElementById('kas-reset-btn');
      if (rb) { if (_filter.dateFrom||_filter.dateTo||_filter.bulan||_filter.type||_filter.status||_filter.search) rb.classList.add('active'); else rb.classList.remove('active'); }
    }));
  }

  // Column resize — drag handle di kanan th → resize kolom + simpan ke localStorage.
  // Min width 80px, max 800px supaya tidak overflow seluruh tabel.
  function _setupColResize() {
    const table = document.getElementById('kas-grid');
    if (!table) return;
    table.querySelectorAll('.ks-resize-handle').forEach(handle => {
      if (handle.dataset.bound === '1') return;
      handle.dataset.bound = '1';
      handle.addEventListener('mousedown', (e) => {
        const th = handle.closest('th'); if (!th) return;
        const col = handle.dataset.col;
        const startX = e.pageX;
        const startW = th.offsetWidth;
        e.preventDefault();
        handle.classList.add('dragging');
        table.classList.add('ks-col-resizing');
        const onMove = (ev) => {
          const w = Math.max(80, Math.min(800, startW + ev.pageX - startX));
          th.style.width = w + 'px';
          th.style.minWidth = w + 'px';
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          handle.classList.remove('dragging');
          table.classList.remove('ks-col-resizing');
          const finalW = th.offsetWidth;
          try { localStorage.setItem('becca_kas_col_'+col, finalW); } catch {}
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  /* ---- VIEW ROW ---- */
  function _rowView(r, rowNum, canEdit) {
    const sc = r.status==='DONE'?'badge-success':r.status==='TBC'?'badge-warning':'badge-neutral';
    const isBP = !!r.bpDocId;
    const rowColorClass = isBP ? 'ks-row-bp' : r.type==='Kas' ? 'ks-row-kas' : r.status==='DONE' ? 'ks-row-done' : r.status==='TBC' ? 'ks-row-tbc' : '';
    const ksOnDbl = !_kasLocked.has(r.id) ? `KasModule.startEdit('${r.id}',event.target.closest('td')?.dataset?.field)` : '';
    const _le = _lastEditMap[r.id];
    const _leTip = _le ? `Terakhir diedit: ${_le.by} · ${Utils.timeAgo(_le.at)}` : '';
    return `<tr class="ks-view ${rowColorClass}" id="ks-row-${r.id}" data-id="${r.id}" ${_leTip ? `title="${_leTip}"` : ''} style="${_kasLocked.has(r.id)?'opacity:.75':''};cursor:pointer" ondblclick="${ksOnDbl}">
      <td style="width:28px">
        <div class="ks-cell" style="justify-content:center;font-size:11px;color:var(--text-3)">
          ${_kasLocked.has(r.id)?'<span style="opacity:.4">'+rowNum+'</span>':rowNum}
        </div>
      </td>
      <td data-field="ks-tgl-${r.id}" style="white-space:nowrap"><div class="ks-cell">${r.tgl ? r.tgl.split('-').reverse().join('-') : ''}</div></td>
      <td data-field="ks-nama-${r.id}" class="ks-nama-cell" ${r.nama?`title="${(r.nama||'').replace(/"/g,'&quot;')}${r.penerima?' → '+r.penerima:''}${r.bpDestCode?' ['+r.bpDestCode+']':''}"`:''}><div class="ks-nama-scroll"><span>${r.nama||''}</span>${isBP?_bpBadge(r):''}${canEdit?_renderAnggaranBadge(r):''}</div></td>
      <td data-field="ks-type-${r.id}"><div class="ks-cell"><span class="badge badge-neutral" style="font-size:10px">${r.type||''}</span></div></td>
      <td data-field="ks-vendor-${r.id}"><div class="ks-cell" ${r.vendor?`title="${(r.vendor||'').replace(/"/g,'&quot;')}"`:''}>${r.vendor||''}</div></td>
      <td data-field="ks-qty-${r.id}" class="ks-num"><div class="ks-cell">${(r.qty||0)%1===0?(r.qty||0):parseFloat((r.qty||0).toFixed(2))}</div></td>
      <td data-field="ks-sat-${r.id}"><div class="ks-cell">${r.satuan||''}</div></td>
      <td data-field="ks-harga-${r.id}" class="ks-num"><div class="ks-cell">${Utils.formatRupiah(r.hargaSatuan||0)}</div></td>
      <td data-field="ks-jumlah-${r.id}" class="ks-num"><div class="ks-cell"><strong>${Utils.formatRupiah(r.jumlah||0)}</strong></div></td>
      <td data-field="ks-penerima-${r.id}"><div class="ks-cell" ${r.penerima?`title="${(r.penerima||'').replace(/"/g,'&quot;')}"`:''}>${r.penerima||''}</div></td>
      <td data-field="ks-status-${r.id}"><div class="ks-cell"><span class="badge ${sc}" style="font-size:10px">${r.status||''}</span></div></td>
      ${canEdit?`<td>
        <div style='display:flex;gap:2px;align-items:center'>
          ${_kasLocked.has(r.id)?
            `<button onclick='event.stopPropagation();KasModule.unlockKasRow("${r.id}")'
              title='Buka kunci untuk edit'
              style='width:22px;height:22px;border-radius:4px;border:1px solid rgba(99,102,241,.4);background:rgba(99,102,241,.1);cursor:pointer;color:var(--primary-h);font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0'
              onmouseover='this.style.background="var(--primary)";this.style.color="white"'
              onmouseout='this.style.background="rgba(99,102,241,.1)";this.style.color="var(--primary-h)"'>🔓</button>`
            :`<button onclick='event.stopPropagation();KasModule.startEdit("${r.id}")'
              title='Edit' style='width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:transparent;cursor:pointer;color:var(--text-3);font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0'
              onmouseover='this.style.background="var(--surface2)"' onmouseout='this.style.background="transparent"'>✎</button>`}
          <button class='ks-del-btn' onclick='event.stopPropagation();KasModule.deleteRow("${r.id}")' title='Hapus'>
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' width='12' height='12'><polyline points='3,6 5,6 21,6'/><path d='M19 6l-1 14H6L5 6'/></svg>
          </button>
        </div>
      </td>`:''}
      ${canEdit?`<td style="width:28px;padding:0;text-align:center" onclick="event.stopPropagation()">
        <input type="checkbox" class="ks-bulk-chk" data-id="${r.id}" ${_bulkSelected.has(r.id)?'checked':''}
          onchange="KasModule._bulkToggle('${r.id}',this.checked)" style="cursor:pointer">
      </td>`:''}\n    </tr>`;
  }

  /* ---- EDIT ROW ---- */
  function _rowEdit(r, rowNum, canEdit) {
    const typeOpts   = TYPES.map(t=>`<option value="${t}" ${r.type===t?'selected':''}>${t}</option>`).join('');
    const statusOpts = ['-','DONE','TBC'].map(s=>`<option value="${s==='-'?'':s}" ${(r.status||'')===(s==='-'?'':s)?'selected':''}>${s}</option>`).join('');
    const bulanOpts  = MONTHS.map(m=>`<option value="${m}" ${r.bulan===m?'selected':''}>${m}</option>`).join('');
    return `<tr class="ks-editing" id="ks-row-${r.id}" data-id="${r.id}" onclick="event.stopPropagation()">
      <td><div class="ks-cell" style="justify-content:center;color:var(--primary-h);font-size:11px">${rowNum}</div></td>
      <td><input class="ks-inp" type="date" value="${r.tgl||''}" id="ks-tgl-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><input class="ks-inp" type="text" value="${(r.nama||'').replace(/"/g,'&quot;')}" placeholder="Nama/keterangan"
            id="ks-nama-${r.id}" autocomplete="off"
            oninput="KasModule._onNamaInput('${r.id}',this.value)"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><select class="ks-sel" id="ks-type-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')">${typeOpts}</select></td>
      <td><input class="ks-inp" type="text" value="${(r.vendor||'').replace(/"/g,'&quot;')}" placeholder="Vendor"
            id="ks-vendor-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" step="1" value="${r.qty||0}"
            id="ks-qty-${r.id}" oninput="KasModule._calcTotal('${r.id}')" style="text-align:right"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><input class="ks-inp" type="text" value="${r.satuan||''}" list="ks-sat-lst" id="ks-sat-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')">
          <datalist id="ks-sat-lst">${SATUANS.map(s=>`<option value="${s}">`).join('')}</datalist></td>
      <td class="ks-num"><input class="ks-inp" type="number" min="0" value="${r.hargaSatuan||0}"
            id="ks-harga-${r.id}" oninput="KasModule._calcTotal('${r.id}')" style="text-align:right"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td class="ks-num" title="Otomatis: qty × harga">
            <div class="ks-cell" id="ks-jumlah-${r.id}" style="justify-content:flex-end;font-weight:700;color:var(--text-2)">${Utils.formatRupiah(((r.qty||0)*(r.hargaSatuan||0))||r.jumlah||0)}</div></td>
      <td><input class="ks-inp" type="text" value="${(r.penerima||'').replace(/"/g,'&quot;')}" placeholder="Penerima"
            id="ks-penerima-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')"></td>
      <td><select class="ks-sel" id="ks-status-${r.id}"
            onkeydown="KasModule._rowKeyDown(event,'${r.id}')">${statusOpts}</select></td>
      ${canEdit?`<td><div style="display:flex;gap:2px;justify-content:center">
          <button class="ks-del-btn" style="color:var(--success);border:1px solid var(--success)"
            onclick="event.stopPropagation();KasModule.commitEdit('${r.id}')" title="Simpan (Enter)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <polyline points="20,6 9,17 4,12"/></svg></button>
          <button class="ks-del-btn" style="color:var(--danger);border:1px solid rgba(239,68,68,.3)"
            onclick="event.stopPropagation();KasModule.cancelEdit()" title="Batal (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div></td>`:''}
      ${canEdit?'<td style="width:28px"></td>':''}
    </tr>`;
  }

  /* ---- AI: nama input → suggest type + autocomplete dropdown ---- */
  let _acIdx = -1; // active suggestion index

  function _onNamaInput(id, val) {
    // AI type suggestion
    const suggested = _suggestType(val);
    if (suggested) {
      const sel = document.getElementById('ks-type-'+id);
      if (sel) sel.value = suggested;
    }
    // Autocomplete dropdown
    _showNamaSuggestions(id, val);
  }

  function _showNamaSuggestions(id, val) {
    const inp = document.getElementById('ks-nama-'+id);
    if (!inp) return;
    // Remove existing dropdown
    document.getElementById('ks-ac-drop')?.remove();
    _acIdx = -1;
    if (!val || val.length < 1) return;

    const q = val.toLowerCase();
    // Collect unique names from _kas, sorted by frequency
    const freq = {};
    _kas.forEach(r => { if (r.nama) freq[r.nama] = (freq[r.nama]||0)+1; });
    const matches = Object.keys(freq)
      .filter(n => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
      .sort((a,b) => freq[b]-freq[a])
      .slice(0, 8);
    if (!matches.length) return;

    const rect = inp.getBoundingClientRect();
    const drop = document.createElement('div');
    drop.id = 'ks-ac-drop';
    drop.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.bottom+2}px;width:${Math.max(rect.width,200)}px;
      background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:8px;
      box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:9999;max-height:200px;overflow-y:auto;padding:4px 0`;
    drop.innerHTML = matches.map((n,i) => {
      // Highlight matching part
      const idx = n.toLowerCase().indexOf(q);
      const before = n.slice(0, idx);
      const match = n.slice(idx, idx+q.length);
      const after = n.slice(idx+q.length);
      return `<div class="ks-ac-item" data-idx="${i}" data-val="${n.replace(/"/g,'&quot;')}"
        style="padding:6px 12px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .1s"
        onmousedown="KasModule._selectNamaSuggestion('${id}',this.dataset.val)"
        onmouseenter="this.style.background='rgba(99,102,241,.08)'"
        onmouseleave="this.style.background=''">
        <span style="flex:1">${before}<strong style="color:var(--primary)">${match}</strong>${after}</span>
        <span style="font-size:9px;color:var(--text-3)">${freq[n]}x</span>
      </div>`;
    }).join('');
    document.body.appendChild(drop);
    // Auto-highlight first item so Enter immediately selects it
    _acIdx = 0;
    _highlightAc(drop.querySelectorAll('.ks-ac-item'));

    // Close on blur (delayed to allow mousedown on suggestion)
    inp._acBlur = () => setTimeout(() => drop.remove(), 150);
    inp.addEventListener('blur', inp._acBlur, {once:true});
  }

  function _highlightAc(items) {
    items.forEach((it,i) => { it.style.background = i===_acIdx ? 'rgba(99,102,241,.1)' : ''; });
    if (_acIdx >= 0 && items[_acIdx]) items[_acIdx].scrollIntoView({block:'nearest'});
  }

  function _selectNamaSuggestion(id, val) {
    const inp = document.getElementById('ks-nama-'+id);
    if (inp) { inp.value = val; inp.dispatchEvent(new Event('input')); }
    document.getElementById('ks-ac-drop')?.remove();
    // ── Smart defaults: tarik dari entry TERBARU dengan nama sama ──
    // Type, vendor, satuan, hargaSatuan auto-fill kalau field masih kosong.
    // qty tidak di-autofill karena bervariasi tiap transaksi.
    const sameName = _kas.filter(r => r.nama === val && r.id !== id);
    const recent = sameName.sort((a,b) => (b.tgl||'').localeCompare(a.tgl||''))[0];
    const fill = (fieldId, value) => {
      if (value == null || value === '') return;
      const el = document.getElementById(fieldId);
      if (el && !el.value) {
        el.value = value;
        if (el.dispatchEvent) el.dispatchEvent(new Event('change'));
      }
    };
    // Type: prefer suggester ML-style → fallback ke recent
    const suggestedType = _suggestType(val) || recent?.type;
    if (suggestedType) fill('ks-type-'+id, suggestedType);
    if (recent) {
      // Vendor: cari entry pertama yang punya vendor (recent mungkin tidak ada vendor)
      const withVendor = sameName.find(r => r.vendor);
      if (withVendor) fill('ks-vendor-'+id, withVendor.vendor);
      if (recent.satuan) fill('ks-satuan-'+id, recent.satuan);
      if (recent.hargaSatuan) {
        const el = document.getElementById('ks-harga-'+id);
        if (el && !el.value) { el.value = recent.hargaSatuan; _calcTotal(id); }
      }
    }
  }

  /* ---- CALC TOTAL ---- */
  function _calcTotal(id) {
    const qty   = parseFloat(document.getElementById('ks-qty-'+id)?.value)   || 0;
    const harga = parseFloat(document.getElementById('ks-harga-'+id)?.value) || 0;
    const el    = document.getElementById('ks-jumlah-'+id);
    if (!el) return;
    const total = Math.round(qty * harga);
    // Display element (div.ks-cell) — pakai textContent + format Rupiah
    if (el.tagName === 'DIV') el.textContent = Utils.formatRupiah(total);
    else if (qty > 0 && harga > 0) el.value = total;
  }

  /* ===================== EDIT LOGIC ===================== */
  // FIX: use a single named function for outside click so removeEventListener works
  async function _handleOutsideClick(e) {
    if (!_editingId) return;
    if (document.getElementById('_val-popup')) return;
    if (e.target.closest('.notify-popup,.notify-container')) return;
    const editingRow = document.getElementById('ks-row-'+_editingId);
    if (editingRow && !editingRow.contains(e.target)) {
      const id = _editingId;
      document.removeEventListener('click', _handleOutsideClick);
      // Baris baru kosong → cancel, bukan commit
      const row = _kas.find(r => r.id === id);
      if (row && row._isNew && !(row.nama||'').trim()) {
        cancelEdit(id);
        return;
      }
      const ok = await _doCommit(id, true); // skipValidation — bisa exit kapanpun
      if (ok) _editingId = null;
    }
  }

  async function startEdit(id, focusField) {
    if (_editingId === id) return;
    if (_kasLocked.has(id)) {
      // Row terkunci - tidak bisa edit langsung, perlu unlock via # icon
      return;
    }

    // FIX: Remove old listener FIRST before committing
    document.removeEventListener('click', _handleOutsideClick);

    // Commit previous tanpa validasi
    if (_editingId) {
      const prevId = _editingId;
      _editingId = null;
      await _doCommit(prevId, true);
    }

    _editingId = id;
    const row  = _kas.find(r=>r.id===id);
    const trEl = document.getElementById('ks-row-'+id);
    if (!row || !trEl) { _editingId = null; return; }
    row._original = JSON.stringify({tgl:row.tgl,nama:row.nama,type:row.type,vendor:row.vendor,
      qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,jumlah:row.jumlah,
      penerima:row.penerima,status:row.status,bulan:row.bulan});

    const tbody   = document.getElementById('kas-tbody');
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const rowNum  = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
    trEl.outerHTML = _rowEdit(row, rowNum, true);

    // Focus first text input (jumlah read-only → redirect ke harga)
    if (focusField && focusField.startsWith('ks-jumlah-')) focusField = 'ks-harga-' + id;
    setTimeout(() => {
      document.getElementById(focusField || 'ks-nama-'+id)?.focus();
      // Attach outside click AFTER render
      document.addEventListener('click', _handleOutsideClick);
    }, 50);
  }

  function _readRowFromDOM(id) {
    const get = (suffix) => document.getElementById('ks-'+suffix+'-'+id);
    return {
      tgl:         get('tgl')?.value         || '',
      nama:        get('nama')?.value        || '',
      type:        get('type')?.value        || '',
      vendor:      get('vendor')?.value      || '',
      qty:         parseFloat(get('qty')?.value)    || 0,
      satuan:      get('sat')?.value         || '',
      hargaSatuan: parseFloat(get('harga')?.value)  || 0,
      // jumlah selalu computed — qty × harga, tidak baca dari DOM (field read-only)
      jumlah:      Math.round((parseFloat(get('qty')?.value)||0) * (parseFloat(get('harga')?.value)||0)),
      penerima:    get('penerima')?.value    || '',
      status:      get('status')?.value      || '',
    };
  }

  async function _doCommit(id, skipValidation = false) {
    const row = _kas.find(r=>r.id===id);
    if (!row) return true;
    const origStr = row._original || '{}';
    const vals = _readRowFromDOM(id);

    if (!skipValidation) {
      const _failV = (msg) => {
        Notify.popup(msg);
        _editingId = id;
        setTimeout(() => document.addEventListener('click', _handleOutsideClick), 50);
      };
      if (!vals.nama || !vals.nama.trim())            { _failV('Nama / Keterangan wajib diisi'); return false; }
      if (!vals.qty || vals.qty <= 0)                 { _failV('Qty wajib diisi dan harus lebih dari 0'); return false; }
      if (!vals.satuan || !vals.satuan.trim())        { _failV('Satuan wajib diisi'); return false; }
      if (!vals.hargaSatuan || vals.hargaSatuan <= 0) { _failV('Harga Satuan wajib diisi'); return false; }
      if (!vals.penerima || !vals.penerima.trim())    { _failV('Penerima wajib diisi'); return false; }
    }

    Object.assign(row, vals);
    const wasNew = row._isNew;
    // Change detection - skip save if nothing changed
    const newStr = JSON.stringify({tgl:row.tgl,nama:row.nama,type:row.type,vendor:row.vendor,
      qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,jumlah:row.jumlah,
      penerima:row.penerima,status:row.status,bulan:row.bulan});
    delete row._original;
    delete row._isNew;
    const hasChanged = origStr !== newStr;

    const trEl = document.getElementById('ks-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('kas-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
      trEl.outerHTML = _rowView(row, rowNum, true);
    }
    if (!hasChanged) return true;  // Nothing changed - skip save+log

    // Track undo
    try { const origData = JSON.parse(origStr);
    UndoRedo.push('kas', {
      id, before: origData, after: {...row, _original:undefined, _isNew:undefined},
      save: async (data) => { const r = _kas.find(x=>x.id===id); if(r) { Object.assign(r,data); await DB.saveKas({...r}); } },
      render: () => renderTransaksi()
    }); } catch(e){}

    // AWAIT save — mencegah race condition saat switch tab
    try {
      await DB.saveKas(row);
      const logType = wasNew ? 'add_kas' : 'edit_kas';
      const logDetail = wasNew ? 'Baris baru: '+(row.nama||id) : 'Edit: '+(row.nama||id);
      const _after = {id,nama:row.nama,type:row.type,jumlah:row.jumlah,vendor:row.vendor,tgl:row.tgl,status:row.status,qty:row.qty,satuan:row.satuan,hargaSatuan:row.hargaSatuan,penerima:row.penerima};
      const _before = wasNew ? null : (()=>{ try{return JSON.parse(origStr)}catch{return null} })();
      DB.logActivity({type:logType, detail:logDetail, rowId:id, snapshot:{before:_before, after:_after}});
      // Update last-edit tooltip cache supaya fresh tanpa reload
      const _cu = (typeof Auth !== 'undefined' && Auth.currentUser()) ? (Auth.currentUser().username || Auth.currentUser().nama) : 'me';
      _lastEditMap[id] = { by: _cu, at: new Date().toISOString(), ts: Date.now(), type: logType };
      const newTr = document.getElementById('ks-row-'+id);
      if (newTr) { newTr.classList.add('ks-saved'); setTimeout(()=>newTr.classList.remove('ks-saved'),500); }
    } catch(e) { Notify.error('Gagal simpan', e.message); }
    return true;
  }

  async function commitEdit(id) {
    if (_editingId !== id) return;
    document.removeEventListener('click', _handleOutsideClick);
    const ok = await _doCommit(id, true); // skipValidation — bisa exit kapanpun
    if (ok) _editingId = null;
  }

  // Enter: save current row + open new row immediately
  async function commitAndAddRow(id) {
    if (_editingId !== id) return;
    document.removeEventListener('click', _handleOutsideClick);
    const ok = await _doCommit(id, true); // skipValidation
    if (ok) { _editingId = null; addRow(); }
  }

  // Esc: discard changes + close edit
  // Jika baris baru (dari Enter) dan belum diisi → hapus baris tersebut
  function cancelEdit(id) {
    if (_editingId !== id) return;
    document.removeEventListener('click', _handleOutsideClick);
    document.getElementById('_val-popup')?.remove();
    const row = _kas.find(r => r.id === id);
    // Baris baru: Esc selalu cancel (hapus dari local + DB), terlepas dari apa yg sudah diketik
    if (row && row._isNew) {
      _editingId = null;
      _kas = _kas.filter(r => r.id !== id);
      DB.deleteKas(id).catch(() => {});
      renderTransaksi();
      Notify.info('Baris baru dibatalkan');
      return;
    }

    if (row?._original) {
      try { Object.assign(row, JSON.parse(row._original)); } catch {}
    }
    _editingId = null;
    const trEl = document.getElementById('ks-row-'+id);
    if (trEl) {
      const tbody   = document.getElementById('kas-tbody');
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const rowNum  = allRows.indexOf(trEl) + 1 + (_page-1)*_perPage;
      trEl.outerHTML = _rowView(row, rowNum, true);
    }
  }

  function _rowKeyDown(e, id) {
    const acDrop = document.getElementById('ks-ac-drop');
    if (acDrop) {
      // Dropdown active — handle navigation here, prevent all propagation
      const items = acDrop.querySelectorAll('.ks-ac-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation();
        _acIdx = Math.min(_acIdx + 1, items.length - 1);
        _highlightAc(items);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation();
        _acIdx = Math.max(_acIdx - 1, -1);
        _highlightAc(items);
        return;
      }
      if (e.key === 'Enter' && _acIdx >= 0 && items[_acIdx]) {
        e.preventDefault(); e.stopPropagation();
        _selectNamaSuggestion(id, items[_acIdx].dataset.val);
        return;
      }
      if (e.key === 'Tab' && _acIdx >= 0 && items[_acIdx]) {
        e.preventDefault(); e.stopPropagation();
        _selectNamaSuggestion(id, items[_acIdx].dataset.val);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); acDrop.remove(); return; }
    }
    if (e.key === 'Enter')       { e.preventDefault(); commitAndAddRow(id); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(id); }
  }

  /* ===================== ADD / DELETE ===================== */
  function unlockKasRow(id) {
    _kasLocked.delete(id);
    localStorage.setItem(_KAS_LOCK_KEY, JSON.stringify([..._kasLocked]));
    startEdit(id);
  }

  async function addRow() {
    if (_editingId) {
      document.removeEventListener('click', _handleOutsideClick);
      const prevId = _editingId;
      _editingId = null;
      await _doCommit(prevId, true); // skipValidation
    }
    const today = new Date().toISOString().split('T')[0];
    const mo    = parseInt(today.split('-')[1]) - 1;
    const newRow = {
      tgl:today, nama:'', type:'', vendor:'',
      qty:1, satuan:'Pcs', hargaSatuan:0, jumlah:0,
      penerima:'', status:'', bulan:MONTHS[mo],
    };
    try {
      const saved = await DB.saveKas(newRow);
      saved._isNew = true;
      _kas.unshift(saved);
      _page = 1;
      renderTransaksi();
      setTimeout(()=>startEdit(saved.id), 80);
    } catch(e) { Notify.error('Gagal', e.message); }
  }

  /* ── Anggaran Linking (Opsi 4: tracking kas → anggaran) ─────────
     Kas record dapat punya field nullable `anggaranId` yang link ke
     PO Anggaran (po_anggaran table). Disimpan di JSONB data column,
     no schema migration needed. Reconcile via realisasi card di PO detail. */
  const _anggaranCache = {};
  let _anggaranCacheLoaded = false;
  async function _ensureAnggaranCache(force) {
    if (_anggaranCacheLoaded && !force) return;
    try {
      const list = await DB.getPO();
      Object.keys(_anggaranCache).forEach(k => delete _anggaranCache[k]);
      (list || []).forEach(d => {
        const date = d.createdAt ? new Date(d.createdAt).toLocaleDateString('id', {day:'2-digit',month:'short'}) : '';
        // Build item-name list for fuzzy matching (D5 auto-link suggestion)
        const itemNames = (d.items||[])
          .filter(it => it.namaBarang)
          .map(it => String(it.namaBarang).toLowerCase().trim());
        _anggaranCache[d.id] = {
          label: (d.nomorEstimasi || d.id.slice(-6).toUpperCase()),
          date,
          status: d.status || '',
          petugas: d.namaPetugas || '',
          createdAt: d.createdAt || '',
          periode: d.periode || '',
          itemNames,
        };
      });
      _anggaranCacheLoaded = true;
    } catch(e) { /* ignore — fallback to ID slice */ }
  }

  /**
   * D5 — Saran link anggaran: untuk kas row yang belum di-link, cari anggaran
   * AKTIF (bukan selesai/arsip) yang punya item dengan nama mirip + dibuat
   * dalam window ±14 hari dari tgl kas. Return null kalau tidak ada match.
   *
   * Skor matching:
   *   itemNameMatch (contains/included)        : +10
   *   dateRange match (±14 hari createdAt)     : +5
   *   recently created (createdAt < 7 hari)    : +2
   * Threshold minimum 10 (harus ada item-match atau date+recent).
   */
  function _suggestAnggaranFor(r) {
    if (!r || r.anggaranId) return null;
    const rNama = (r.nama || '').toLowerCase().trim();
    if (!rNama) return null;
    if (!_anggaranCacheLoaded) return null;
    const rTgl = r.tgl || '';
    const candidates = [];
    Object.entries(_anggaranCache).forEach(([id, meta]) => {
      if (meta.status === 'selesai' || meta.status === 'arsip') return;
      let score = 0;
      // Item name match (fuzzy contains)
      const itemMatch = (meta.itemNames||[]).some(n =>
        (n.length >= 3 && rNama.includes(n)) || (rNama.length >= 3 && n.includes(rNama))
      );
      if (itemMatch) score += 10;
      // Date proximity (createdAt ± 14d)
      if (meta.createdAt && rTgl) {
        try {
          const diffDays = Math.abs((new Date(rTgl).getTime() - new Date(meta.createdAt).getTime()) / 86400000);
          if (diffDays <= 14) score += 5;
          if (diffDays <= 7) score += 2;
        } catch {}
      }
      if (score >= 10) candidates.push({ id, meta, score });
    });
    if (!candidates.length) return null;
    candidates.sort((a,b) => b.score - a.score || (b.meta.createdAt||'').localeCompare(a.meta.createdAt||''));
    return candidates[0];
  }

  // Quick-apply saran link tanpa buka picker
  async function _applySuggestedAnggaran(rowId, anggaranId) {
    const r = _kas.find(x => x.id === rowId);
    if (!r) return;
    r.anggaranId = anggaranId;
    try {
      await DB.saveKas(r);
      const meta = _anggaranCache[anggaranId];
      Notify.success('Link diterapkan: ' + (meta?.label || anggaranId.slice(-6)));
      DB.logActivity?.({type:'edit_kas', detail:'Auto-link ke anggaran: '+(meta?.label||''), rowId});
      renderTransaksi();
    } catch (e) { Notify.error('Gagal link', e.message); }
  }
  // Eager-load di background saat module init load
  setTimeout(() => _ensureAnggaranCache(), 100);

  function _renderAnggaranBadge(r) {
    if (!r) return '';
    // Skip tombol "+ link" untuk row kosong (baru ditambah belum diisi nama).
    // Link ke anggaran baru relevan setelah ada nama transaksi.
    if (!r.anggaranId && !(r.nama||'').trim()) return '';
    const id = r.anggaranId;
    if (id) {
      const meta = _anggaranCache[id];
      // Stale link: cache sudah loaded tapi anggaran tidak ditemukan → kemungkinan
      // sudah dihapus. Tampilkan badge merah dgn warning, jangan label hash cryptic.
      if (_anggaranCacheLoaded && !meta) {
        return `<span class="ks-anggaran-tag ks-anggaran-stale"
          style="display:inline-block;font-size:9px;background:rgba(239,68,68,.12);color:#ef4444;padding:1px 6px;border-radius:3px;margin-left:4px;font-weight:600;cursor:pointer;vertical-align:middle;border:1px solid rgba(239,68,68,.3)"
          onclick="event.stopPropagation();KasModule._openAnggaranPicker('${r.id}')"
          title="Anggaran sudah dihapus. Klik untuk lepas atau pilih anggaran lain.">⚠️ Anggaran dihapus</span>`;
      }
      const label = meta?.label || id.slice(-6).toUpperCase();
      const tip = `Anggaran: ${label}${meta?.date?' · '+meta.date:''}${meta?.status==='selesai'?' (SELESAI)':''}. Klik untuk ubah.`;
      // Beda warna kalau status selesai — indicator visual bahwa link ke anggaran final
      const isSelesai = meta?.status === 'selesai';
      const bgCol = isSelesai ? 'rgba(100,116,139,.15)' : 'rgba(99,102,241,.15)';
      const fgCol = isSelesai ? 'var(--text-3)' : 'var(--primary-h)';
      return `<span class="ks-anggaran-tag"
        style="display:inline-block;font-size:9px;background:${bgCol};color:${fgCol};padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:600;cursor:pointer;vertical-align:middle"
        onclick="event.stopPropagation();KasModule._openAnggaranPicker('${r.id}')"
        title="${Utils.esc(tip)}">🔗 ${Utils.esc(label)}${isSelesai?' ✓':''}</span>`;
    }
    // D5 — Auto-suggest anggaran. Kalau ada match score >=10, tampil tombol
    // ungu dengan indikator "✨" — klik langsung apply (1 step), atau klik
    // kanan (right-click) buka picker manual kalau mau pilih lain.
    const suggestion = _suggestAnggaranFor(r);
    if (suggestion) {
      const lbl = Utils.esc(suggestion.meta.label || '');
      return `<button class="ks-anggaran-suggest-btn"
        onclick="event.stopPropagation();KasModule._applySuggestedAnggaran('${r.id}','${suggestion.id}')"
        oncontextmenu="event.preventDefault();event.stopPropagation();KasModule._openAnggaranPicker('${r.id}');return false"
        title="Saran link ke ${lbl} (klik kanan untuk pilih manual)"
        style="font-size:9px;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.35);color:var(--primary-h);padding:1px 6px;border-radius:3px;margin-left:4px;cursor:pointer;font-weight:600;vertical-align:middle"
        onmouseover="this.style.background='rgba(99,102,241,.22)'"
        onmouseout="this.style.background='rgba(99,102,241,.12)'">✨ ${lbl}</button>`;
    }
    return `<button class="ks-anggaran-link-btn"
      onclick="event.stopPropagation();KasModule._openAnggaranPicker('${r.id}')"
      title="Kaitkan ke anggaran"
      style="font-size:9px;background:transparent;border:1px dashed var(--border);color:var(--text-3);padding:1px 5px;border-radius:3px;margin-left:4px;cursor:pointer;opacity:.45;font-weight:500;vertical-align:middle"
      onmouseover="this.style.opacity='.85'"
      onmouseout="this.style.opacity='.45'">+ link</button>`;
  }

  async function _openAnggaranPicker(rowId) {
    const row = _kas.find(r => r.id === rowId);
    if (!row) { Notify.warning('Baris kas tidak ditemukan'); return; }
    await _ensureAnggaranCache(true);

    let list = [];
    try { list = await DB.getPO(); } catch { list = []; }
    // Filter: hide arsip/selesai DARI pilihan baru, TAPI keep currently-linked
    // anggaran (walaupun selesai) supaya user tau mau lepas dari mana.
    list = (list || []).filter(d =>
      (d.status !== 'arsip' && d.status !== 'selesai') || d.id === row.anggaranId
    );
    list.sort((a,b) => {
      // Currently-linked di paling atas, lainnya by createdAt desc
      if (a.id === row.anggaranId) return -1;
      if (b.id === row.anggaranId) return 1;
      return (b.createdAt||'').localeCompare(a.createdAt||'');
    });

    const optionsHtml = list.length === 0
      ? `<div style="padding:24px;text-align:center;color:var(--text-3)">Belum ada anggaran. Buat di modul PO dulu.</div>`
      : list.map(d => {
          const isSelected = row.anggaranId === d.id;
          const itemsTotal = (d.items||[]).reduce((s,it) => s+(Number(it.totalHarga)||0), 0);
          const date = d.createdAt ? new Date(d.createdAt).toLocaleDateString('id', {day:'2-digit',month:'short',year:'2-digit'}) : '';
          const itemCount = (d.items||[]).filter(it => (it.namaBarang||'').trim()).length;
          const stColors = {
            'draft':           {bg:'rgba(245,158,11,.15)', fg:'#f59e0b', label:'DRAFT'},
            'finance_request': {bg:'rgba(59,130,246,.15)', fg:'#3b82f6', label:'REQUEST'},
            'finance_done':    {bg:'rgba(16,185,129,.15)', fg:'#10b981', label:'DISETUJUI'},
            'selesai':         {bg:'rgba(99,102,241,.15)', fg:'#6366f1', label:'SELESAI'},
          };
          const sc = stColors[d.status] || {bg:'var(--surface2)', fg:'var(--text-3)', label:(d.status||'-').toUpperCase()};
          const statusBadge = `<span style="font-size:9px;background:${sc.bg};color:${sc.fg};padding:1px 5px;border-radius:3px;font-weight:600">${sc.label}</span>`;
          return `<div onclick="KasModule._selectAnggaran('${rowId}','${d.id}')"
            style="padding:10px 12px;border:1px solid ${isSelected?'var(--primary)':'var(--border)'};border-radius:8px;cursor:pointer;background:${isSelected?'rgba(99,102,241,.08)':'transparent'};margin-bottom:6px;transition:background .15s"
            onmouseover="if(this.dataset.sel!=='1')this.style.background='var(--surface2)'"
            onmouseout="if(this.dataset.sel!=='1')this.style.background='transparent'"
            data-sel="${isSelected?'1':'0'}">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <strong style="color:var(--text);font-size:13px">${Utils.esc(d.nomorEstimasi || d.id.slice(-6))}</strong>
              ${statusBadge}
              <span style="margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--text-3);font-weight:600">${Utils.formatRupiah(itemsTotal)}</span>
            </div>
            <div style="font-size:11px;color:var(--text-3);margin-top:3px">${date} · ${Utils.esc(d.namaPetugas||'—')} · ${itemCount} item</div>
          </div>`;
        }).join('');

    Modal.open({
      id: 'kas-anggaran-picker',
      title: '🔗 Kaitkan ke Anggaran',
      body: `
        <div style="font-size:12px;color:var(--text-3);margin-bottom:12px">Pilih anggaran terkait dengan transaksi <strong style="color:var(--text)">${Utils.esc(row.nama||'(belum diisi)')}</strong> · ${Utils.formatRupiah(row.jumlah||0)}.</div>
        <div style="max-height:420px;overflow-y:auto;padding-right:4px">${optionsHtml}</div>
      `,
      footer: row.anggaranId
        ? `<button class="btn btn-ghost" style="color:var(--danger)" onclick="KasModule._unlinkAnggaran('${rowId}')">✕ Lepas Kaitan</button><button class="btn btn-ghost" onclick="Modal.close('kas-anggaran-picker')">Tutup</button>`
        : `<button class="btn btn-ghost" onclick="Modal.close('kas-anggaran-picker')">Tutup</button>`
    });
  }

  async function _selectAnggaran(rowId, anggaranId) {
    const row = _kas.find(r => r.id === rowId);
    if (!row) return;
    if (row.anggaranId === anggaranId) { Modal.close('kas-anggaran-picker'); return; }
    row.anggaranId = anggaranId;
    try {
      await DB.saveKas({...row});
      DB.logActivity?.({type:'edit_kas', detail:'Link ke anggaran: '+(row.nama||row.id), rowId:row.id});
      Notify.success('Dikaitkan ke anggaran');
      Modal.close('kas-anggaran-picker');
      renderTransaksi();
    } catch(e) {
      Notify.error('Gagal menyimpan', e.message);
    }
  }

  async function _unlinkAnggaran(rowId) {
    const row = _kas.find(r => r.id === rowId);
    if (!row) return;
    delete row.anggaranId;
    try {
      await DB.saveKas({...row});
      DB.logActivity?.({type:'edit_kas', detail:'Unlink anggaran: '+(row.nama||row.id), rowId:row.id});
      Notify.info('Kaitan anggaran dilepas');
      Modal.close('kas-anggaran-picker');
      renderTransaksi();
    } catch(e) {
      Notify.error('Gagal menyimpan', e.message);
    }
  }

  /* ── Summary Category Detail Popup ── Klik kategori di tab Summary
     → modal dengan list transaksi kategori itu di bulan terpilih. */
  function _openCategoryDetail(type, bulan) {
    const rows = _kas.filter(r =>
      (r.type || 'Lain-lain') === type &&
      r.type !== 'Kas' &&
      _tglToYM(r.tgl) === bulan
    );
    rows.sort((a,b) => (a.tgl||'').localeCompare(b.tgl||''));
    const total = rows.reduce((s,r) => s + (r.jumlah||0), 0);
    const doneCount = rows.filter(r => r.status === 'DONE').length;
    const doneTotal = rows.filter(r => r.status === 'DONE').reduce((s,r) => s + (r.jumlah||0), 0);
    const tbcCount = rows.filter(r => r.status === 'TBC').length;
    const tbcTotal = rows.filter(r => r.status === 'TBC').reduce((s,r) => s + (r.jumlah||0), 0);
    const fmtRp = Utils.formatRupiah;
    const fmtTgl = (t) => t ? t.split('-').reverse().join('-') : '-';
    const MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const [y,m] = (bulan||'').split('-');
    const bulanLabel = (MONTHS[parseInt(m)]||m) + ' ' + (y||'');

    const body = rows.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--text-3)">Tidak ada transaksi</div>`
      : `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:16px">
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:9px;color:var(--text-3);letter-spacing:.04em;font-weight:700">TOTAL</div>
            <div style="font-size:14px;font-weight:800;font-family:var(--font-mono);color:var(--text)">${fmtRp(total)}</div>
            <div style="font-size:10px;color:var(--text-3)">${rows.length} transaksi</div>
          </div>
          <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.3);border-radius:8px;padding:10px">
            <div style="font-size:9px;color:#10b981;letter-spacing:.04em;font-weight:700">DONE</div>
            <div style="font-size:14px;font-weight:800;font-family:var(--font-mono);color:#10b981">${fmtRp(doneTotal)}</div>
            <div style="font-size:10px;color:var(--text-3)">${doneCount} confirmed</div>
          </div>
          ${tbcCount > 0 ? `<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px">
            <div style="font-size:9px;color:#f59e0b;letter-spacing:.04em;font-weight:700">TBC</div>
            <div style="font-size:14px;font-weight:800;font-family:var(--font-mono);color:#f59e0b">${fmtRp(tbcTotal)}</div>
            <div style="font-size:10px;color:var(--text-3)">${tbcCount} pending</div>
          </div>` : ''}
        </div>
        <div style="max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead style="position:sticky;top:0;background:var(--surface2);z-index:1">
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;color:var(--text-3);font-weight:700">Tgl</th>
                <th style="text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;color:var(--text-3);font-weight:700">Nama / Keterangan</th>
                <th style="text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;color:var(--text-3);font-weight:700">Vendor</th>
                <th style="text-align:left;padding:8px 10px;font-size:9px;text-transform:uppercase;color:var(--text-3);font-weight:700">Penerima</th>
                <th style="text-align:right;padding:8px 10px;font-size:9px;text-transform:uppercase;color:var(--text-3);font-weight:700">Qty</th>
                <th style="text-align:right;padding:8px 10px;font-size:9px;text-transform:uppercase;color:var(--text-3);font-weight:700">Jumlah</th>
                <th style="text-align:center;padding:8px 10px;font-size:9px;text-transform:uppercase;color:var(--text-3);font-weight:700">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r,i) => {
                const isDone = r.status === 'DONE';
                const isTBC = r.status === 'TBC';
                const statusBadge = isDone
                  ? '<span style="background:rgba(16,185,129,.15);color:#10b981;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700">DONE</span>'
                  : isTBC ? '<span style="background:rgba(245,158,11,.15);color:#f59e0b;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700">TBC</span>'
                  : '<span style="color:var(--text-3);font-size:10px">-</span>';
                return `<tr style="border-bottom:.5px solid var(--border-light);background:${i%2?'var(--surface)':'transparent'}">
                  <td style="padding:7px 10px;font-family:var(--font-mono);font-size:10px;white-space:nowrap;color:var(--text-2)">${fmtTgl(r.tgl)}</td>
                  <td style="padding:7px 10px;color:var(--text);font-weight:500">${Utils.esc(r.nama||'-')}</td>
                  <td style="padding:7px 10px;color:var(--text-3);font-size:10px">${Utils.esc(r.vendor||'-')}</td>
                  <td style="padding:7px 10px;color:var(--text-3);font-size:10px">${Utils.esc(r.penerima||'-')}</td>
                  <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-size:10px;color:var(--text-3)">${r.qty||0}${r.satuan?' '+r.satuan:''}</td>
                  <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-weight:600">${fmtRp(r.jumlah||0)}</td>
                  <td style="padding:7px 10px;text-align:center">${statusBadge}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;

    Modal.open({
      id: 'kas-cat-detail',
      title: `📊 ${Utils.esc(type)} · ${bulanLabel}`,
      size: 'modal-lg',
      body,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('kas-cat-detail')">Tutup</button>`,
    });
  }

  /* ── Bulk Delete ── */
  function _bulkToggle(id, checked) {
    if (checked) _bulkSelected.add(id); else _bulkSelected.delete(id);
    _renderBulkBar();
  }
  function _bulkToggleAll(checked) {
    document.querySelectorAll('.ks-bulk-chk').forEach(c => { if (checked) _bulkSelected.add(c.dataset.id); else _bulkSelected.delete(c.dataset.id); c.checked = checked; });
    _renderBulkBar();
  }
  function _renderBulkBar() {
    let bar = document.getElementById('ks-bulk-bar');
    if (_bulkSelected.size === 0) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'ks-bulk-bar';
      bar.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:500;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:8px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.25);';
      document.body.appendChild(bar);
    }
    bar.innerHTML = `
      <span style="font-size:13px;font-weight:600;color:var(--text)">${_bulkSelected.size} dipilih</span>
      <button onclick="KasModule._bulkDelete()" style="padding:6px 16px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:12px;font-weight:600;cursor:pointer">🗑 Hapus</button>
      <button onclick="KasModule._bulkClear()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;cursor:pointer">Batal</button>`;
  }
  function _bulkClear() {
    _bulkSelected.clear();
    document.querySelectorAll('.ks-bulk-chk').forEach(c => c.checked = false);
    const hdr = document.querySelector('#kas-grid thead input[type="checkbox"]');
    if (hdr) hdr.checked = false;
    _renderBulkBar();
  }
  async function _bulkDelete() {
    const count = _bulkSelected.size;
    const ok = await Modal.confirm({ title:'Hapus Bulk', message:`Hapus <strong>${count}</strong> baris kas secara permanen?`, danger:true, confirmText:`Hapus ${count} Baris` });
    if (!ok) return;
    const ids = [..._bulkSelected];
    let deleted = 0;
    for (const id of ids) { try { await DB.deleteKas(id); _kas = _kas.filter(r=>r.id!==id); deleted++; } catch {} }
    _bulkSelected.clear();
    const bar = document.getElementById('ks-bulk-bar'); if (bar) bar.remove();
    renderTransaksi();
    Notify.success(`${deleted} baris dihapus`);
    DB.logActivity({type:'bulk_delete_kas', detail:`${deleted} baris dihapus`});
  }

  async function deleteRow(id) {
    const deleted = _kas.find(r=>r.id===id);
    if (!deleted) return;
    const ok = await Modal.confirm({
      title: 'Hapus Transaksi',
      message: `<p>Hapus "<strong>${deleted.nama||'-'}</strong>" — ${Utils.formatRupiah(deleted.jumlah||0)}?</p>`,
      confirmText: 'Hapus', confirmClass: 'btn-danger', cancelText: 'Batal'
    });
    if (!ok) return;
    if (_editingId===id) { document.removeEventListener('click',_handleOutsideClick); _editingId=null; }
    _kas = _kas.filter(r=>r.id!==id);
    UndoRedo.push('kas', {
      id, before: deleted, after: null,
      save: async (data) => { if(data) { _kas.push(data); _kas.sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||'')); await DB.saveKas({...data}); } else { _kas=_kas.filter(r=>r.id!==id); await DB.deleteKas(id); } },
      render: () => renderTransaksi()
    });
    renderTransaksi();
    const t = setTimeout(() => {
      DB.deleteKas(id).catch(()=>{});
      DB.logActivity({type:'delete_kas', detail:'Baris dihapus'});
    }, 5000);
    Notify.undo('Baris dihapus', () => {
      clearTimeout(t);
      _kas.push(deleted);
      _kas.sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||''));
      renderTransaksi();
      Notify.success('Undo berhasil');
    });
  }

  /* ===================== FILTER & PAGE ===================== */
  function _applyFilter(data) {
    const q = (_filter.search||'').toLowerCase().trim();
    return data.filter(r=>{
      if (_filter.bulan   && r.bulan !==_filter.bulan)   return false;
      if (_filter.type    && r.type  !==_filter.type)    return false;
      if (_filter.status) {
        if (_filter.status==='-') { if (r.status) return false; }
        else if (r.status!==_filter.status) return false;
      }
      if (_filter.dateFrom && r.tgl  < _filter.dateFrom) return false;
      if (_filter.dateTo  && r.tgl   > _filter.dateTo)   return false;
      if (q) {
        const hay = [r.nama,r.type,r.vendor,r.penerima,r.tgl,r.satuan,r.status].map(v=>(v||'').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  function setFilter(k,v){ if(_editingId)commitEdit(_editingId); _filter[k]=v; _page=1; renderTransaksi();
    Utils.urlState?.write('kas', {..._filter, page: _page>1?_page:''});
    // Keep search bar open & refocus after re-render
    if (k==='search') { const sb=document.getElementById('kas-search-bar'); if(sb){sb.classList.remove('closed');sb.classList.add('open');} const inp=document.getElementById('kas-search-input'); if(inp){inp.focus();inp.selectionStart=inp.selectionEnd=inp.value.length;} }
  }
  // Debounced search handler — render hanya 200ms setelah user stop typing.
  // (Saat ini search pakai Enter-trigger; ini disisakan untuk backward compat.)
  const _setSearchDebounced = Utils.debounce(v => setFilter('search', v), 200);
  // Enter-trigger search: typing TIDAK trigger filter (mencegah lag di HP).
  // Hanya tampil/hide tombol ↩ indicator kalau ada perubahan dari current filter.
  function _onSearchTyping(val) {
    const cur = _filter.search || '';
    const btn = document.getElementById('kas-search-go');
    if (!btn) return;
    const dirty = (val||'') !== cur;
    btn.style.display = dirty ? 'inline-flex' : 'none';
  }
  function resetFilter() {
    const btn = document.getElementById('kas-reset-btn');
    if (btn) { btn.classList.add('spinning'); setTimeout(() => btn.classList.remove('spinning'), 600); }
    if(_editingId)commitEdit(_editingId); _filter={search:''}; _page=1; renderTransaksi();
    Utils.urlState?.clear('kas');
  }
  // Saved views API — dipakai Utils.savedViews dropdown
  function getCurrentFilter() { return {..._filter}; }
  function applySavedFilter(filter) {
    if(_editingId)commitEdit(_editingId);
    _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'', search:'', ...(filter||{}) };
    _page = 1;
    renderTransaksi();
    Utils.urlState?.write('kas', {..._filter, page:''});
  }
  function toggleSearch() {
    const bar = document.getElementById('kas-search-bar');
    if (!bar) return;
    const isOpen = bar.classList.contains('open');
    if (isOpen) {
      bar.classList.remove('open'); bar.classList.add('closed');
      if (_filter.search) { _filter.search=''; _page=1; renderTransaksi(); }
    } else {
      bar.classList.remove('closed'); bar.classList.add('open');
      const inp=document.getElementById('kas-search-input'); if(inp){inp.focus();inp.select();}
    }
  }
  function goPage(p)      { if(_editingId)commitEdit(_editingId); _page=p; renderTransaksi(); Utils.urlState?.write('kas', {..._filter, page: _page>1?_page:''}); }
  function setPerPage(n)  { _perPage=n; localStorage.setItem('becca_kas_perPage',n); _page=1; renderTransaksi(); }

  /* ===================== SUMMARY STRIP ===================== */
  function _summaryStrip(data) {
    const keluar = data.filter(r=>r.type!=='Kas');
    const done   = keluar.filter(r=>r.status==='DONE');
    const tbc    = keluar.filter(r=>r.status==='TBC');
    const noSt   = keluar.filter(r=>!r.status);
    const _card = (icon, label, value, color, accent, onclick='') => {
      return `<div ${onclick?`onclick="${onclick}"`:''}  class="ks-strip-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--s3) var(--s4);min-width:0;transition:all .2s;position:relative;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);${onclick?'cursor:pointer':''}"
        onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='var(--shadow-sm)'"
        onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent}"></div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:12px">${icon}</span>
          <span style="font-size:10px;color:var(--text-2);font-weight:600">${label}</span>
        </div>
        <div style="font-size:14px;font-weight:800;color:${color};font-family:var(--font-mono);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value}</div>
      </div>`;
    };
    const masuk = data.filter(r=>r.type==='Kas');
    return `<style>.ks-cards{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--s2);width:100%;align-items:stretch}@media(max-width:1100px){.ks-cards{grid-template-columns:repeat(3,1fr)}}@media(max-width:600px){.ks-cards{grid-template-columns:repeat(2,1fr)}}</style>
    <div class="ks-cards">
      ${_card('\ud83d\udce4','Total Keluar', Utils.formatRupiah(keluar.reduce((s,r)=>s+(r.jumlah||0),0)), 'var(--danger)', '#ef4444')}
      ${_card('\u2705','Confirmed',    Utils.formatRupiah(done.reduce((s,r)=>s+(r.jumlah||0),0)),   'var(--success)', '#22c55e')}
      ${_card('\u23f3','TBC',          Utils.formatRupiah(tbc.reduce((s,r)=>s+(r.jumlah||0),0)),    'var(--warning)', '#f59e0b', "KasModule.filterByStatus('TBC')")}
      ${_card('\u2753','Tanpa Status', noSt.length+' baris',                                        'var(--text-2)', '#64748b', "KasModule.filterByStatus('-')")}
      ${_card('\ud83d\udcb0','Kas Masuk',   Utils.formatRupiah(masuk.reduce((s,r)=>s+(r.jumlah||0),0)),  'var(--success)', '#10b981', "KasModule.filterKasMasukType()")}
    </div>`;
  }

  /* ===================== EXPORT CSV ===================== */
  /* ===================== IMPORT EXCEL ===================== */
  function importExcel() {
    const inp = Object.assign(document.createElement('input'), { type:'file', accept:'.xlsx,.xls', style:'display:none' });
    document.body.appendChild(inp);
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      document.body.removeChild(inp);
      if (!file) return;

      // ── 1. Load SheetJS dari CDN yang reliable ────────────────
      if (!window.XLSX) {
        Notify.info('Memuat library Excel...');
        const CDNS = [
          'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
          'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
        ];
        let loaded = false;
        for (const src of CDNS) {
          loaded = await new Promise(res => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => res(true);
            s.onerror = () => res(false);
            document.head.appendChild(s);
          });
          if (loaded && window.XLSX) break;
        }
        if (!window.XLSX) { Notify.error('Gagal memuat library Excel. Cek koneksi internet.'); return; }
      }

      // ── 2. Parse file Excel ───────────────────────────────────
      Notify.info('Membaca file Excel...');
      let wb;
      try {
        const buf = await file.arrayBuffer();
        wb = XLSX.read(buf, { type:'array', cellDates:false });
      } catch(e) { Notify.error('File tidak bisa dibaca', e.message); return; }

      // ── 3. Mapping nama kolom Excel → field BECCA ─────────────
      const COL_MAP = {
        // tanggal
        tanggal:'tgl', tgl:'tgl', date:'tgl',
        // nama / keterangan
        nama:'nama', keterangan:'nama', ket:'nama', description:'nama',
        nama_barang:'nama', namabarang:'nama',
        // type
        type:'type', tipe:'type',
        // vendor
        vendor:'vendor',
        // qty
        qty:'qty', jumlah_qty:'qty',
        // satuan
        satuan:'satuan', sat:'satuan', unit:'satuan',
        // harga satuan
        harga:'hargaSatuan', harga_satuan:'hargaSatuan', hargasatuan:'hargaSatuan',
        hargasat:'hargaSatuan', price:'hargaSatuan',
        // jumlah total (debit = pengeluaran)
        jumlah:'jumlah', total:'jumlah', amount:'jumlah', debit:'jumlah',
        // kredit = uang masuk
        kredit:'kredit',
        // penerima
        penerima:'penerima', pic:'penerima',
        nama_penerima:'penerima', namapenerima:'penerima',
        // status
        status:'status',
      };
      const _parseDate = (v) => {
        if (!v && v !== 0) return '';
        // Jika instanceof Date (fallback): pakai local methods karena SheetJS bisa pakai local constructor
        if (v instanceof Date) {
          if (isNaN(v.getTime())) return '';
          const y=v.getFullYear(), m=String(v.getMonth()+1).padStart(2,'0'), d=String(v.getDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        }
        const s = String(v).trim();
        // Format DD/MM/YYYY atau DD-MM-YYYY
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
          const p=s.split(/[\/\-]/);
          // Deteksi otomatis: jika bagian pertama > 12, pasti DD (bukan MM)
          const [a,b,c]=p;
          const dd=parseInt(a),mm=parseInt(b);
          if(dd>12) return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`; // DD/MM/YYYY
          if(mm>12) return `${c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`; // MM/DD/YYYY
          return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`; // default DD/MM/YYYY
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // Excel serial number — dengan cellDates:false semua dates masuk sini sebagai float
        // Formula: (serial - 25569) * 86400000 = ms since Unix epoch (UTC midnight)
        // getTime() → new Date(UTC midnight) → local getFullYear/Month/Date
        // Untuk UTC+7: UTC midnight March 26 = local March 26 07:00 → getDate()=26 ✓
        const num = parseFloat(s);
        if (!isNaN(num) && num > 40000) {
          const serial = Math.floor(num); // floor() strip time component (e.g. 46107.5 → 46107)
          const ms = (serial - 25569) * 86400000;
          const y=new Date(ms).getUTCFullYear();
          const mo=String(new Date(ms).getUTCMonth()+1).padStart(2,'0');
          const d=String(new Date(ms).getUTCDate()).padStart(2,'0');
          return `${y}-${mo}-${d}`;
        }
        return '';
      };
      const _parseNum = (v) => {
        if (v===undefined||v===null||v==='') return 0;
        if (typeof v==='number') return v;
        // Bisa berupa scientific notation: "1.3653161E7"
        const n = parseFloat(String(v).replace(/[^\d.eE\-\+]/g,''));
        return isNaN(n) ? 0 : n;
      };
      const _parseStatus = (v) => {
        const s = String(v||'').trim();
        if (s === '✔' || s.toLowerCase() === 'done' || s.toLowerCase() === 'selesai') return 'DONE';
        if (s.toUpperCase() === 'TBC') return 'TBC';
        return '';
      };
      const _mapHeader = (row) => {
        const map={};
        row.forEach((cell,ci)=>{
          const k=String(cell).toLowerCase().trim().replace(/[\s\/]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
          const k2=String(cell).toLowerCase().trim().replace(/[\s\/]+/g,'');
          const field=COL_MAP[k]||COL_MAP[k2]||COL_MAP[String(cell).toLowerCase().trim()];
          if(field && !(field in map)) map[field]=ci;
        });
        return map;
      };

      // ── 4. Parse semua sheet → newRows (synchronous, cepat) ───
      const newRows = [];
      const newMasuk = [];
      for (const sheetName of wb.SheetNames) {
        const bulanRaw = sheetName.trim().split(/\s+/)[0] || sheetName;
        const bulan    = _normalizeBulan(bulanRaw) || 'Jan';
        const ws   = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (rows.length < 2) continue;
        // Cari baris header (header bisa ada di baris mana saja, cek sampai baris 25)
        let hdrIdx=-1, colIdx={};
        for (let ri=0; ri<Math.min(rows.length,25); ri++) {
          const map = _mapHeader(rows[ri]);
          if (map.tgl!==undefined && Object.keys(map).length >= 2) { hdrIdx=ri; colIdx=map; break; }
        }
        if (hdrIdx<0) { console.warn('[KasImport] Sheet "'+sheetName+'" header tidak dikenali, dilewati'); continue; }
        // Merge sub-header row (e.g. KREDIT/DEBIT di baris setelah header utama)
        const subRow = rows[hdrIdx+1] || [];
        const subMap = _mapHeader(subRow);
        for (const [field, ci] of Object.entries(subMap)) {
          if (!(field in colIdx)) colIdx[field] = ci;
        }
        const dataStart = (subMap.kredit!==undefined || subMap.jumlah!==undefined) && subMap.tgl===undefined
          ? hdrIdx+2 : hdrIdx+1;

        let _lastTgl = ''; // carry-forward tanggal untuk baris yang kolom tgl-nya kosong
        for (let ri=dataStart; ri<rows.length; ri++) {
          const row = rows[ri];
          if (row.every(c=>c===''||c===null||c===undefined)) continue;
          const rawTgl = colIdx.tgl!==undefined ? row[colIdx.tgl] : '';
          const parsedTgl = _parseDate(rawTgl);
          if (parsedTgl) _lastTgl = parsedTgl;
          const tgl = parsedTgl || _lastTgl;
          // Debug: log 3 baris pertama per sheet agar bisa diagnosa date parsing
          if (ri < dataStart+3 && window.BECCA_DEBUG) console.log('[KasImport] row', ri, 'rawTgl=', rawTgl, 'typeof=', typeof rawTgl, 'parsedTgl=', parsedTgl, 'tgl=', tgl);
          if (!tgl) continue;
          const nama = String(row[colIdx.nama]??'').trim();
          if (!nama || nama.toUpperCase()==='ADMINISTRATOR' || nama.toUpperCase().startsWith('TOTAL')) continue;

          const typeRaw    = String(row[colIdx.type]??'').trim();
          const vendor     = String(row[colIdx.vendor]??'').trim();
          const penerima   = String(row[colIdx.penerima]??'').trim();
          const status     = _parseStatus(colIdx.status!==undefined ? row[colIdx.status] : '');
          // Cek kolom KREDIT (O) — jika ada nilai → ini baris kas masuk
          const kreditVal  = _parseNum(colIdx.kredit!==undefined ? row[colIdx.kredit] : 0);
          if (kreditVal > 0) {
            // Baris kas masuk → simpan ke kas table sebagai type="Kas" agar tampil di tabel utama
            newRows.push({ id:Utils.uid(), tgl, nama, type:'Kas', vendor:'', qty:1, satuan:'Kali', hargaSatuan:kreditVal, jumlah:kreditVal, penerima, status, bulan });
          } else {
            // Baris pengeluaran normal: jumlah = QTY × HARGA SATUAN
            const qty        = _parseNum(colIdx.qty!==undefined ? row[colIdx.qty] : 1)||1;
            const hargaSatuan= _parseNum(colIdx.hargaSatuan!==undefined ? row[colIdx.hargaSatuan] : 0);
            const jumlah     = qty * hargaSatuan;
            if (!jumlah && !nama) continue; // skip baris kosong
            const satuanRaw  = String(row[colIdx.satuan]??'').trim();
            const typeNorm   = TYPES.find(t=>t.toLowerCase()===typeRaw.toLowerCase())||typeRaw||_suggestType(nama)||'';
            const satuanNorm = SATUANS.find(s=>s.toLowerCase()===satuanRaw.toLowerCase())||satuanRaw||'Pcs';
            newRows.push({ id:Utils.uid(), tgl, nama, type:typeNorm, vendor, qty, satuan:satuanNorm, hargaSatuan, jumlah, penerima, status, bulan });
          }
        }
      }

      if (!newRows.length) {
        Notify.error('Tidak ada data yang berhasil dibaca', 'Pastikan header kolom ada di baris pertama: Tanggal, Nama/Keterangan, Type, Vendor, Qty, Satuan, Jumlah, dll');
        return;
      }

      // ── 5. Deduplication — skip baris yang sudah ada ─────────────────────
      // Key: tgl|nama|jumlah (case-insensitive) — cukup untuk deteksi duplikat
      const existingKeys = new Set(
        _kas.map(r => `${r.tgl}|${(r.nama||'').toLowerCase().trim()}|${r.jumlah}`)
      );
      const existingMasukKeys = new Set(
        _masuk.map(r => `${r.tgl}|${(r.keterangan||r.ket||'').toLowerCase().trim()}|${r.kredit}`)
      );
      const dedupedRows  = newRows.filter(r => {
        const k = `${r.tgl}|${(r.nama||'').toLowerCase().trim()}|${r.jumlah}`;
        return !existingKeys.has(k);
      });
      const dedupedMasuk = newMasuk.filter(r => {
        const k = `${r.tgl}|${(r.keterangan||'').toLowerCase().trim()}|${r.kredit}`;
        return !existingMasukKeys.has(k);
      });
      const skippedCount = newRows.length - dedupedRows.length;

      if (!dedupedRows.length) {
        Notify.info(`Semua ${newRows.length} baris sudah ada — tidak ada data baru yang diimport`);
        return;
      }

      // ── 6. Langsung masukkan ke _kas + tampilkan ────────────────
      _kas.unshift(...dedupedRows);
      _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'' };
      _page   = 1;
      renderTransaksi();
      const skipMsg = skippedCount > 0 ? ` (${skippedCount} duplikat dilewati)` : '';
      Notify.success(`${dedupedRows.length} baris diimport${skipMsg} — menyimpan ke cloud...`);

      // ── 7. Sync ke Supabase di background (paralel, max 10 sekaligus) ────
      const CHUNK = 10;
      let saved = 0;
      for (let i=0; i<dedupedRows.length; i+=CHUNK) {
        const batch = dedupedRows.slice(i, i+CHUNK);
        await Promise.allSettled(batch.map(r => DB.saveKas(r).then(()=>saved++)));
      }
      DB.logActivity({ type:'import_kas', detail:`Import Excel: ${dedupedRows.length} baris (${skippedCount} duplikat dilewati)` });
      if(window.BECCA_DEBUG) console.log('[KasImport] Sync Supabase selesai:', saved, '/', dedupedRows.length);
    };
    inp.click();
  }

  function exportCSV() {
    const data=_applyFilter(_kas).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const hdr=['Tanggal','Nama','Type','Vendor','Qty','Satuan','Harga/Sat','Total','Penerima','Status','Bulan'];
    const rows=data.map(r=>[r.tgl,r.nama,r.type,r.vendor,r.qty,r.satuan,r.hargaSatuan,r.jumlah,r.penerima,r.status,r.bulan]
      .map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const a=Object.assign(document.createElement('a'),{
      href:URL.createObjectURL(new Blob([[hdr.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8;'})),
      download:`kas-kecil-${new Date().toISOString().split('T')[0]}.csv`
    });
    a.click(); URL.revokeObjectURL(a.href);
    Notify.success('CSV di-export');
  }

  function printPDF() {
    const data = _applyFilter(_kas).sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const total = data.reduce((s,r) => s + (r.jumlah||0), 0);
    Utils.printReport({
      title: 'Laporan Kas Kecil',
      subtitle: `${data.length} transaksi · Total: ${Utils.formatRupiah(total)} · Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}`,
      headers: [{label:'Tanggal'},{label:'Nama'},{label:'Type'},{label:'Vendor'},{label:'Qty',num:true},{label:'Satuan'},{label:'Harga',num:true},{label:'Total',num:true},{label:'Status'}],
      rows: data.map(r => [r.tgl||'', r.nama||'', r.type||'', r.vendor||'', r.qty||'', r.satuan||'', Utils.formatRupiah(r.hargaSatuan||0), Utils.formatRupiah(r.jumlah||0), r.status||'']),
      footer: `Total: ${Utils.formatRupiah(total)}`,
    });
  }

  /* ===================== SUMMARY TAB ===================== */
  function renderSummary() {
    const el = document.getElementById('kas-tab-summary');
    if (!el) return;
    // Gunakan _kas in-memory (bukan localStorage yang bisa corrupt/kosong untuk dataset besar)
    // Exclude type="Kas" (kas masuk) dari summary pengeluaran
    const kasRaw = _kas.filter(r => r.type !== 'Kas');
    const NORM = {'Jan':'Januari','Febuari':'Februari','Feb':'Februari','Mar':'Maret','Apr':'April','Mei':'Mei','Jun':'Juni','Jul':'Juli','Ags':'Agustus','Sep':'September','Okt':'Oktober','Nov':'November','Des':'Desember'};
    const ORDER = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#8b5cf6','#06b6d4','#84cc16','#f97316'];
    const SHORT = {Januari:'Jan',Februari:'Feb',Maret:'Mar',April:'Apr',Mei:'Mei',Juni:'Jun',Juli:'Jul',Agustus:'Ags',September:'Sep',Oktober:'Okt',November:'Nov',Desember:'Des'};
    const nd = {};
    kasRaw.forEach(r => {
      const b = NORM[r.bulan||'']||r.bulan||''; if(!b) return;
      const t = r.type||'Lain-lain';
      if(!nd[b]) nd[b]={};
      nd[b][t]=(nd[b][t]||0)+(r.jumlah||0);
    });
    const bulan = ORDER.filter(b=>nd[b]);
    if (!bulan.length) {
      el.innerHTML = UI.empty({
        iconKey: 'money',
        title: 'Belum ada data Kas Kecil',
        desc: 'Mulai input transaksi di tab Transaksi atau import dari Excel via Settings → Data → Import Kas',
      });
      return;
    }
    const typeMap={};
    kasRaw.forEach(r=>{ const t=r.type||'Lain-lain'; typeMap[t]=(typeMap[t]||0)+(r.jumlah||0); });
    const allTypes=Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).map(([t])=>t);
    const fmtS = n => n ? Utils.formatRupiah(n) : '<span style="color:var(--text-3)">—</span>';
    const badge=(curr,prev)=>{ if(prev===null||!prev) return ''; const p=Math.round((curr-prev)/prev*100); return '<span style="font-size:10px;font-weight:700;color:'+(p>=0?'#ef4444':'#10b981')+';margin-left:4px">'+(p>=0?'▲':'▼')+Math.abs(p)+'%</span>'; };
    // Cards
    const cards = bulan.map((b,i)=>{ const total=Object.values(nd[b]).reduce((s,v)=>s+v,0); const prev=i>0?Object.values(nd[bulan[i-1]]).reduce((s,v)=>s+v,0):0; const rows=kasRaw.filter(r=>(NORM[r.bulan||'']||r.bulan)===b).length; const p=prev?Math.round((total-prev)/prev*100):null; const clr=COLORS[i%COLORS.length]; return '<div style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;width:4px;height:100%;background:'+clr+'"></div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div style="font-size:20px;font-weight:900;color:'+clr+'">'+(SHORT[b]||b)+'</div>'+(p!==null?'<div style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+(p>=0?'rgba(239,68,68,.1)':'rgba(16,185,129,.1)')+';color:'+(p>=0?'#ef4444':'#10b981')+'">'+(p>=0?'▲':'▼')+Math.abs(p)+'% vs '+SHORT[bulan[i-1]]+'</div>':'<div style="font-size:11px;color:var(--text-3);padding:2px 8px;border-radius:20px;background:var(--surface2)">Base Month</div>')+'</div><div style="font-family:var(--font-mono);font-size:22px;font-weight:900;color:var(--heading)">'+fmtS(total)+'</div><div style="font-size:11px;color:var(--text-3);margin-top:4px">'+rows.toLocaleString('id')+' transaksi</div></div>'; }).join('');
    // Table
    const tblRows = allTypes.map((type,ti)=>{ const clr=COLORS[ti%COLORS.length]; const vals=bulan.map(b=>nd[b]?.[type]||0); if(vals.every(v=>v===0)) return ''; const maxV=Math.max(...vals,1); const cells=bulan.map((b,i)=>{ const v=nd[b]?.[type]||0, prev=i>0?(nd[bulan[i-1]]?.[type]||0):null; const bw=Math.round(v/maxV*100); return '<td style="padding:8px 10px;vertical-align:middle;min-width:140px">'+(v?'<div style="font-family:var(--font-mono);font-size:12px;font-weight:700;white-space:nowrap">'+fmtS(v)+badge(v,prev)+'</div><div style="height:5px;background:var(--surface2);border-radius:3px;margin-top:4px;overflow:hidden"><div style="width:'+bw+'%;height:100%;background:'+clr+';border-radius:3px"></div></div>':'<span style="color:var(--text-3);font-size:12px">—</span>')+'</td>'; }).join(''); return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 12px;position:sticky;left:0;background:var(--surface);z-index:1;min-width:130px"><div style="display:flex;align-items:center;gap:7px"><div style="width:10px;height:10px;border-radius:3px;background:'+clr+';flex-shrink:0"></div><span style="font-size:12px;font-weight:600">'+type+'</span></div></td>'+cells+'</tr>'; }).join('');
    const totalCells=bulan.map((b,i)=>{ const t=Object.values(nd[b]).reduce((s,v)=>s+v,0); const p=i>0?Object.values(nd[bulan[i-1]]).reduce((s,v)=>s+v,0):null; return '<td style="padding:10px;font-family:var(--font-mono);font-size:13px;font-weight:800;white-space:nowrap">'+fmtS(t)+badge(t,p)+'</td>'; }).join('');
    const mHeaders=bulan.map((b,i)=>'<th style="padding:10px;text-align:left;font-size:11px;font-weight:800;color:'+COLORS[i%COLORS.length]+';white-space:nowrap;min-width:140px;border-bottom:2px solid '+COLORS[i%COLORS.length]+'">'+b+'</th>').join('');
    // Analysis
    const totals=bulan.map(b=>Object.values(nd[b]).reduce((s,v)=>s+v,0));
    const trend=totals.length>1?totals[totals.length-1]-totals[0]:0;
    const trendPct=totals[0]?Math.round(trend/totals[0]*100):0;
    const topType=allTypes[0], topVal=typeMap[topType]||0;
    const topPct=Math.round(topVal/totals.reduce((s,v)=>s+v,0)*100);
    const topGrowth=allTypes.reduce((b,t)=>{ if(bulan.length<2) return b; const v1=nd[bulan[0]]?.[t]||0,v2=nd[bulan[bulan.length-1]]?.[t]||0; const p=v1?Math.round((v2-v1)/v1*100):-999; return p>b.p?{t,p}:b; },{t:'',p:-999});
    const topDrop=allTypes.reduce((b,t)=>{ if(bulan.length<2) return b; const v1=nd[bulan[0]]?.[t]||0,v2=nd[bulan[bulan.length-1]]?.[t]||0; const p=v1?Math.round((v2-v1)/v1*100):999; return p<b.p?{t,p}:b; },{t:'',p:999});
    const anomalies=allTypes.filter(t=>{ for(let i=1;i<bulan.length;i++){ const v0=nd[bulan[i-1]]?.[t]||0,v1=nd[bulan[i]]?.[t]||0; if(v0>0&&v1/v0>1.5) return true; } return false; });
    const analyses=[
      {icon:'📊',color:'#6366f1',title:'Tren Pengeluaran',desc:trend<0?'Pengeluaran turun '+Math.abs(trendPct)+'% dari '+SHORT[bulan[0]]+' ke '+SHORT[bulan[bulan.length-1]]+' ('+fmtS(Math.abs(trend))+'). Efisiensi operasional membaik.':trend>0?'Pengeluaran naik '+Math.abs(trendPct)+'% dari '+SHORT[bulan[0]]+' ke '+SHORT[bulan[bulan.length-1]]+'. Perlu monitoring lebih lanjut.':'Pengeluaran stabil antar bulan.'},
      {icon:'🏆',color:'#f59e0b',title:'Kategori Terbesar',desc:topType+' mendominasi '+topPct+'% total pengeluaran ('+fmtS(topVal)+'). Fokus efisiensi pada kategori ini akan berdampak paling besar.'},
      topGrowth.t&&topGrowth.p>20?{icon:'⚠️',color:'#ef4444',title:'Kenaikan Signifikan',desc:topGrowth.t+' naik '+topGrowth.p+'% dari '+SHORT[bulan[0]]+' ke '+SHORT[bulan[bulan.length-1]]+'. Perlu investigasi penyebab kenaikan.'}:null,
      topDrop.t&&topDrop.p<-20?{icon:'✅',color:'#10b981',title:'Penghematan Terbesar',desc:topDrop.t+' turun '+Math.abs(topDrop.p)+'% — penghematan berhasil atau aktivitas berkurang.'}:null,
      anomalies.length?{icon:'🔍',color:'#8b5cf6',title:'Anomali Terdeteksi',desc:'Kategori '+anomalies.slice(0,3).join(', ')+' naik >50% antar bulan. Validasi data atau cek penyebab lonjakan.'}:null,
      {icon:'💡',color:'#06b6d4',title:'Rekomendasi',desc:bulan.length===3&&totals[2]<totals[0]*0.5?SHORT[bulan[2]]+' masih berjalan — proyeksi bulanan ~'+fmtS(Math.round(totals[2]/new Date().getDate()*30))+'. Pantau agar tidak melebihi rata-rata historis.':'Pertahankan pola pengeluaran efisien. Review kategori non-operasional untuk potensi penghematan.'}
    ].filter(Boolean);
    const analysisHtml=analyses.map(a=>'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start"><div style="font-size:20px;flex-shrink:0">'+a.icon+'</div><div><div style="font-size:12px;font-weight:800;color:'+a.color+';margin-bottom:3px">'+a.title+'</div><div style="font-size:12px;color:var(--text-2);line-height:1.6">'+a.desc+'</div></div></div>').join('');
    el.innerHTML='<div style="display:flex;gap:var(--s3);margin-bottom:var(--s4)">'+cards+'</div>'
      +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:var(--s4)"><div style="padding:14px 18px;border-bottom:1px solid var(--border)"><div style="font-size:14px;font-weight:800;color:var(--heading)">Perbandingan per Kategori</div><div style="font-size:11px;color:var(--text-3);margin-top:2px">'+bulan.join(' · ')+' — ▲▼ delta vs bulan sebelumnya</div></div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--surface2)"><th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);position:sticky;left:0;background:var(--surface2);z-index:2;min-width:130px">Kategori</th>'+mHeaders+'</tr></thead><tbody>'+tblRows+'<tr style="background:var(--surface2);border-top:2px solid var(--border)"><td style="padding:10px 12px;font-size:12px;font-weight:800;position:sticky;left:0;background:var(--surface2);z-index:1">TOTAL</td>'+totalCells+'</tr></tbody></table></div></div>'
      +'<div><div style="font-size:13px;font-weight:800;color:var(--heading);margin-bottom:var(--s3)">✨ Analisa & Rekomendasi</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s3)">'+analysisHtml+'</div></div>';
  }
  function renderMonthly() {
    // Group by YYYY-MM from tgl (tanggal transaksi), not r.bulan
    const ymSet = new Set();
    _kas.forEach(r => { const ym = _tglToYM(r.tgl); if (ym) ymSet.add(ym); });
    const opts = [...ymSet].sort(); // "2026-01","2026-02",...
    const sel = opts[opts.length-1] || '';
    const BL = {1:'Januari',2:'Februari',3:'Maret',4:'April',5:'Mei',6:'Juni',7:'Juli',8:'Agustus',9:'September',10:'Oktober',11:'November',12:'Desember'};
    const ymLabel = ym => { if (!ym) return ''; const [y,m]=ym.split('-'); return BL[parseInt(m)]+' '+y; };
    document.getElementById('kas-tab-monthly').innerHTML=`
      <div class="filter-bar" style="margin-bottom:var(--s5)">
        <select class="form-control" style="width:160px" onchange="KasModule.renderMonthlyTable(this.value)">
          ${opts.map(ym=>`<option value="${ym}" ${ym===sel?'selected':''}>${ymLabel(ym)}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="KasModule.printMonthly()">Print / PDF</button>
      </div>
      <div id="monthly-table-wrap"></div>`;
    renderMonthlyTable(sel);
  }

  function renderMonthlyTable(bulan) {
    // bulan is now "YYYY-MM" format, filter by tgl
    const allRows = _kas.filter(r => _tglToYM(r.tgl) === bulan);
    // Separate kas masuk vs pengeluaran
    const kasMasuk = allRows.filter(r => r.type === 'Kas');
    const rows     = allRows.filter(r => r.type !== 'Kas'); // pengeluaran only
    const byType = {};
    rows.forEach(r => {
      const t = r.type || 'Lain-lain';
      if (!byType[t]) byType[t] = [];
      byType[t].push(r);
    });
    const totalMasuk = kasMasuk.reduce((s,r) => s+(r.jumlah||0), 0);
    const grand      = rows.reduce((s,r) => s+(r.jumlah||0), 0);
    const grandDone  = rows.filter(r=>r.status==='DONE').reduce((s,r)=>s+(r.jumlah||0),0);
    const grandTBC   = rows.filter(r=>r.status==='TBC').reduce((s,r)=>s+(r.jumlah||0),0);
    // Saldo awal per-bulan: snapshot manual kalau ada, otomatis dari saldo global + sum tx sebelumnya
    const saldoAwalInfo = _getSaldoAwalForMonth(bulan);
    const saldoAwal  = saldoAwalInfo.value;
    const saldoAkhir = saldoAwal + totalMasuk - grand;
    // bulan is "YYYY-MM" format
    const _BL = {1:'Januari',2:'Februari',3:'Maret',4:'April',5:'Mei',6:'Juni',7:'Juli',8:'Agustus',9:'September',10:'Oktober',11:'November',12:'Desember'};
    const bulanLabel = bulan ? _BL[parseInt(bulan.split('-')[1])] + ' ' + bulan.split('-')[0] : '';

    const typesSorted = Object.entries(byType)
      .map(([type, items]) => ({type, items, total: items.reduce((s,r)=>s+(r.jumlah||0),0)}))
      .sort((a,b) => b.total - a.total);

    document.getElementById('monthly-table-wrap').innerHTML = `
      <div id="monthly-report" style="font-family:var(--font)">

        <!-- Title Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:16px 20px;background:var(--surface);border:1px solid var(--border);
                    border-radius:var(--r-lg) var(--r-lg) 0 0;border-bottom:none">
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:2px">Laporan Kas Kecil Bulanan</div>
            <div style="font-size:22px;font-weight:700;color:var(--heading)">${bulanLabel}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text-3)">Total Pengeluaran</div>
            <div style="font-size:24px;font-weight:800;color:var(--danger);font-family:var(--font-mono)">${Utils.formatRupiah(grand)}</div>
          </div>
        </div>

        <!-- Summary Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0;
                    border:1px solid var(--border);border-top:none;overflow:hidden">
          ${[
            {l:'Saldo Awal',     v:Utils.formatRupiah(saldoAwal),  c:'var(--primary-h)', extra:`<button title="${saldoAwalInfo.source==='manual'?'Snapshot manual — klik untuk edit/reset':'Otomatis dari saldo awal global + transaksi sebelumnya — klik untuk override manual'}" onclick="KasModule.openSaldoAwalSnapshot('${bulan}')" style="position:absolute;top:6px;right:6px;background:transparent;border:none;cursor:pointer;font-size:9px;color:${saldoAwalInfo.source==='manual'?'#10b981':'var(--text-3)'};padding:2px 5px;border-radius:3px" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">${saldoAwalInfo.source==='manual'?'📌 manual':'auto ✎'}</button>`},
            {l:'Kas Masuk',      v:Utils.formatRupiah(totalMasuk), c:'var(--success)'},
            {l:'Kas Keluar',     v:Utils.formatRupiah(grand),      c:'var(--danger)'},
            {l:'Confirmed',      v:Utils.formatRupiah(grandDone),  c:'var(--success)'},
            {l:'TBC / Pending',  v:Utils.formatRupiah(grandTBC),   c:'var(--warning)'},
            {l:'Saldo Akhir',    v:Utils.formatRupiah(saldoAkhir), c:saldoAkhir>=0?'var(--success)':'var(--danger)'},
          ].map((s,i) => `
            <div style="padding:12px 16px;background:var(--surface);position:relative;
                        ${i>0?'border-left:1px solid var(--border)':''}">
              ${s.extra||''}
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:3px">${s.l}</div>
              <div style="font-size:14px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
            </div>`).join('')}
        </div>

        <!-- Kas Masuk Section -->
        ${totalMasuk > 0 ? `
        <div style="border:1px solid var(--border);border-top:none;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(16,185,129,.06)">
            <span style="font-size:13px;font-weight:700;color:var(--success)">Kas Masuk (Dana Diterima)</span>
            <span style="font-size:14px;font-weight:700;color:var(--success);font-family:var(--font-mono)">${Utils.formatRupiah(totalMasuk)}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:var(--surface3)">
              <th style="padding:6px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text-3)">Tanggal</th>
              <th style="padding:6px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text-3)">Keterangan</th>
              <th style="padding:6px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text-3)">Vendor</th>
              <th style="padding:6px 12px;text-align:right;font-size:10px;text-transform:uppercase;color:var(--text-3)">Jumlah</th>
            </tr></thead>
            <tbody>${kasMasuk.sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||'')).map((r,i) => `
              <tr style="background:${i%2?'var(--surface2)':'var(--surface)'}">
                <td style="padding:7px 12px;color:var(--text-2)">${r.tgl?r.tgl.split('-').reverse().join('-'):'-'}</td>
                <td style="padding:7px 12px;font-weight:500">${r.nama||'-'}</td>
                <td style="padding:7px 12px;color:var(--text-3)">${r.vendor||'-'}</td>
                <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--success)">${Utils.formatRupiah(r.jumlah||0)}</td>
              </tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

        <!-- Detail per Kategori -->
        <div style="border:1px solid var(--border);border-top:none;border-radius:0 0 var(--r-lg) var(--r-lg);overflow:hidden">
          ${typesSorted.map(({type, items, total}, tIdx) => {
            const done = items.filter(r=>r.status==='DONE').reduce((s,r)=>s+(r.jumlah||0),0);
            const pct  = grand > 0 ? Math.round(total/grand*100) : 0;
            return `
            <div style="${tIdx>0?'border-top:1px solid var(--border)':''}">
              <!-- Type Header -->
              <div style="display:flex;align-items:center;justify-content:space-between;
                          padding:10px 16px;background:var(--surface2)">
                <div style="display:flex;align-items:center;gap:10px">
                  <span style="font-size:13px;font-weight:700;color:var(--heading)">${type}</span>
                  <span style="font-size:11px;color:var(--text-3)">${items.length} transaksi</span>
                  <!-- Progress bar -->
                  <div style="width:80px;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:2px"></div>
                  </div>
                  <span style="font-size:10px;color:var(--text-3)">${pct}%</span>
                </div>
                <div style="text-align:right">
                  <div style="font-size:14px;font-weight:700;color:var(--danger);font-family:var(--font-mono)">${Utils.formatRupiah(total)}</div>
                  ${done < total ? `<div style="font-size:10px;color:var(--text-3)">Confirmed: ${Utils.formatRupiah(done)}</div>` : ''}
                </div>
              </div>

              <!-- Rows Table -->
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                  <thead>
                    <tr style="background:var(--surface3)">
                      <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap;width:90px">Tanggal</th>
                      <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase">Nama / Keterangan</th>
                      <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Kategori</th>
                      <th style="padding:6px 12px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Vendor</th>
                      <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Qty × Sat</th>
                      <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Harga/Sat</th>
                      <th style="padding:6px 12px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;white-space:nowrap">Total</th>
                      <th style="padding:6px 12px;text-align:center;font-weight:600;color:var(--text-3);font-size:10px;text-transform:uppercase;width:65px">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.sort((a,b)=>(a.tgl||'').localeCompare(b.tgl||'')).map((r,i) => `
                      <tr style="${i%2===0?'background:var(--surface)':'background:var(--surface2)'}${r.status==='DONE'?';opacity:.75':''}">
                        <td style="padding:7px 12px;color:var(--text-2);white-space:nowrap">${r.tgl?r.tgl.split('-').reverse().join('-'):'-'}</td>
                        <td style="padding:7px 12px">
                          <div style="font-weight:500;color:var(--text)">${r.nama||'-'}</div>
                          ${r.penerima?`<div style="font-size:10px;color:var(--text-3)">→ ${r.penerima}</div>`:''}
                        </td>
                        <td style="padding:7px 12px"><span style="font-size:10px;padding:2px 6px;border-radius:3px;background:var(--surface2);color:var(--text-2);font-weight:500">${r.type||'-'}</span></td>
                        <td style="padding:7px 12px;color:var(--text-3)">${r.vendor||'-'}</td>
                        <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);color:var(--text-2)">${r.qty||1} ${r.satuan||''}</td>
                        <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);color:var(--text-3)">${Utils.formatRupiah(r.hargaSatuan||0)}</td>
                        <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--text)">${Utils.formatRupiah(r.jumlah||0)}</td>
                        <td style="padding:7px 12px;text-align:center">
                          <span style="font-size:10px;padding:2px 6px;border-radius:3px;font-weight:600;
                            background:${r.status==='DONE'?'rgba(34,197,94,.15)':'rgba(234,179,8,.15)'};
                            color:${r.status==='DONE'?'var(--success)':'var(--warning)'}">
                            ${r.status||'-'}
                          </span>
                        </td>
                      </tr>`).join('')}
                    <!-- Subtotal row -->
                    <tr style="background:var(--surface3);border-top:1px solid var(--border)">
                      <td colspan="6" style="padding:7px 12px;font-weight:700;color:var(--text-2);font-size:11px">
                        Subtotal ${type}
                      </td>
                      <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--danger)">${Utils.formatRupiah(total)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>`;
          }).join('')}

          <!-- Grand Total Footer -->
          <div style="display:flex;justify-content:space-between;align-items:center;
                      padding:14px 20px;background:var(--surface);border-top:2px solid var(--border2)">
            <div style="font-size:13px;font-weight:700;color:var(--heading)">TOTAL PENGELUARAN — ${bulanLabel}</div>
            <div style="font-family:var(--font-mono);font-size:20px;font-weight:800;color:var(--danger)">${Utils.formatRupiah(grand)}</div>
          </div>
        </div>

        <!-- ANALISA LAPORAN -->
        ${_buildAnalysis({rows, kasMasuk, byType, typesSorted, grand, grandDone, grandTBC, totalMasuk, saldoAwal, saldoAkhir, bulanLabel, bulan})}
      </div>
    `;
  }


  /* ===================== ANALISA DETAIL ===================== */
  function _buildAnalysis({rows, kasMasuk, byType, typesSorted, grand, grandDone, grandTBC, totalMasuk, saldoAwal, saldoAkhir, bulanLabel, bulan}) {
    const fR = Utils.formatRupiah;
    // Section dengan anchor id agar bisa di-jump dari sub-nav
    const _sec = (title, body, anchor) => `<div ${anchor?`id="${anchor}" style="scroll-margin-top:80px"`:''} style="margin-top:16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
      <div style="padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface2)">
        <div style="font-size:13px;font-weight:700;color:var(--heading)">${title}</div>
      </div><div style="padding:16px 20px">${body}</div></div>`;

    // ── 1. RINGKASAN KEUANGAN ──
    const summaryRows = [
      {l:'Saldo Awal', v:fR(saldoAwal), c:''},
      {l:`+ Kas Masuk (${kasMasuk.length} transaksi)`, v:fR(totalMasuk), c:'var(--success)'},
      {l:`− Kas Keluar (${rows.length} transaksi, ${Object.keys(byType).length} kategori)`, v:fR(grand), c:'var(--danger)'},
      {l:`  ├ Confirmed (DONE)`, v:fR(grandDone), c:'var(--success)'},
      {l:`  └ Pending (TBC)`, v:fR(grandTBC), c:'var(--warning)'},
    ];
    const summaryHtml = `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <tbody>${summaryRows.map(r => `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:8px 0;color:${r.c||'var(--text-3)'}">${r.l}</td>
        <td style="padding:8px 0;text-align:right;font-family:var(--font-mono);font-weight:600;color:${r.c||'var(--text)'}">${r.v}</td>
      </tr>`).join('')}
      <tr style="border-top:2px solid var(--border)">
        <td style="padding:10px 0;font-weight:700;font-size:13px;color:var(--heading)">Saldo Akhir</td>
        <td style="padding:10px 0;text-align:right;font-family:var(--font-mono);font-weight:800;font-size:16px;color:${saldoAkhir>=0?'var(--success)':'var(--danger)'}">${fR(saldoAkhir)}</td>
      </tr></tbody></table>
      ${grandTBC > 0 ? `<div style="margin-top:12px;padding:8px 12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:6px;font-size:11px;color:var(--warning)">⚠ Masih ada ${rows.filter(r=>r.status==='TBC').length} transaksi TBC senilai ${fR(grandTBC)} yang belum dikonfirmasi.</div>` : ''}`;

    // ── 2. DISTRIBUSI KATEGORI ──
    const catHtml = typesSorted.map((t,i) => {
      const pct = grand > 0 ? (t.total/grand*100).toFixed(1) : 0;
      const avgPerTx = t.items.length > 0 ? Math.round(t.total/t.items.length) : 0;
      const typeSafe = String(t.type||'').replace(/'/g, "\\'");
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:4px 6px;border-radius:6px;cursor:pointer;transition:background .15s"
        onclick="KasModule._openCategoryDetail('${typeSafe}', '${bulan}')"
        onmouseover="this.style.background='var(--surface2)'"
        onmouseout="this.style.background=''"
        title="Klik untuk lihat ${t.items.length} transaksi kategori ${t.type}">
        <span style="font-size:11px;font-weight:700;color:var(--text-3);width:18px">${i+1}.</span>
        <span style="font-size:12px;font-weight:600;min-width:110px">${t.type}</span>
        <span style="font-size:10px;color:var(--text-3);min-width:40px">${t.items.length} tx</span>
        <div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:3px"></div>
        </div>
        <span style="font-size:11px;font-family:var(--font-mono);color:var(--text-2);min-width:100px;text-align:right">${fR(t.total)}</span>
        <span style="font-size:10px;color:var(--text-3);min-width:35px;text-align:right">${pct}%</span>
        <span style="font-size:10px;color:var(--text-3);min-width:90px;text-align:right">avg ${fR(avgPerTx)}</span>
      </div>`;
    }).join('');

    // ── 3. PERBANDINGAN VS BULAN SEBELUMNYA ──
    // bulan is "YYYY-MM" format
    const allYM = [...new Set(_kas.map(r=>_tglToYM(r.tgl)).filter(Boolean))].sort();
    const curIdx = allYM.indexOf(bulan);
    const prevBulan = curIdx > 0 ? allYM[curIdx-1] : null;
    const _ymLabel = ym => { if(!ym) return ''; const _B={1:'Januari',2:'Februari',3:'Maret',4:'April',5:'Mei',6:'Juni',7:'Juli',8:'Agustus',9:'September',10:'Oktober',11:'November',12:'Desember'}; const[y,m]=ym.split('-'); return _B[parseInt(m)]+' '+y; };
    let momHtml = '';
    if (prevBulan) {
      const prevRows = _kas.filter(r => _tglToYM(r.tgl) === prevBulan && r.type !== 'Kas');
      const prevTotal = prevRows.reduce((s,r)=>s+(r.jumlah||0),0);
      const prevByType = {};
      prevRows.forEach(r => { const t=r.type||'Lain-lain'; prevByType[t]=(prevByType[t]||0)+(r.jumlah||0); });
      const delta = grand - prevTotal;
      const deltaPct = prevTotal > 0 ? ((delta/prevTotal)*100).toFixed(1) : 0;
      const prevLabel = _ymLabel(prevBulan);

      // Category comparison
      const allCats = [...new Set([...Object.keys(byType),...Object.keys(prevByType)])];
      const catChanges = allCats.map(cat => {
        const cur = (byType[cat]||[]).reduce((s,r)=>s+(r.jumlah||0),0);
        const prev = prevByType[cat]||0;
        const d = cur - prev;
        const dp = prev > 0 ? ((d/prev)*100).toFixed(0) : (cur > 0 ? 100 : 0);
        return {cat, cur, prev, d, dp: Number(dp)};
      }).sort((a,b) => Math.abs(b.d) - Math.abs(a.d));

      momHtml = `<div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:140px;padding:10px 14px;border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text-3);text-transform:uppercase">${prevLabel}</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--font-mono);color:var(--text)">${fR(prevTotal)}</div>
          <div style="font-size:10px;color:var(--text-3)">${prevRows.length} transaksi</div>
        </div>
        <div style="flex:1;min-width:140px;padding:10px 14px;border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text-3);text-transform:uppercase">${bulanLabel}</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--font-mono);color:var(--text)">${fR(grand)}</div>
          <div style="font-size:10px;color:var(--text-3)">${rows.length} transaksi</div>
        </div>
        <div style="flex:1;min-width:140px;padding:10px 14px;border-radius:8px;border:1px solid ${delta>0?'rgba(239,68,68,.2)':'rgba(34,197,94,.2)'};background:${delta>0?'rgba(239,68,68,.04)':'rgba(34,197,94,.04)'}">
          <div style="font-size:10px;color:var(--text-3);text-transform:uppercase">Selisih</div>
          <div style="font-size:16px;font-weight:700;font-family:var(--font-mono);color:${delta>0?'var(--danger)':'var(--success)'}">${delta>0?'+':''}${fR(delta)}</div>
          <div style="font-size:10px;font-weight:600;color:${delta>0?'var(--danger)':'var(--success)'}">${delta>0?'▲':'▼'} ${Math.abs(deltaPct)}%</div>
        </div>
      </div>
      <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Perubahan per Kategori</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:6px 0;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Kategori</th>
          <th style="padding:6px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">${prevLabel}</th>
          <th style="padding:6px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">${bulanLabel}</th>
          <th style="padding:6px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">Selisih</th>
          <th style="padding:6px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">%</th>
        </tr></thead>
        <tbody>${catChanges.map(c => `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 0;font-weight:500">${c.cat}</td>
          <td style="padding:5px 0;text-align:right;font-family:var(--font-mono);color:var(--text-3)">${fR(c.prev)}</td>
          <td style="padding:5px 0;text-align:right;font-family:var(--font-mono)">${fR(c.cur)}</td>
          <td style="padding:5px 0;text-align:right;font-family:var(--font-mono);font-weight:600;color:${c.d>0?'var(--danger)':'var(--success)'}">${c.d>0?'+':''}${fR(c.d)}</td>
          <td style="padding:5px 0;text-align:right;font-weight:600;color:${c.d>0?'var(--danger)':'var(--success)'}">${c.d>0?'▲':'▼'}${Math.abs(c.dp)}%</td>
        </tr>`).join('')}</tbody>
      </table>`;
    } else {
      momHtml = '<div style="font-size:12px;color:var(--text-3)">Tidak ada data bulan sebelumnya untuk perbandingan.</div>';
    }

    // ── 4. ANALISA PER HARI ──
    const byDate = {};
    rows.forEach(r => { const d=r.tgl||'unknown'; if(!byDate[d]) byDate[d]={total:0,count:0,items:[]}; byDate[d].total+=(r.jumlah||0); byDate[d].count++; byDate[d].items.push(r); });
    const dates = Object.entries(byDate).sort((a,b)=>b[1].total-a[1].total);
    const avgDaily = dates.length > 0 ? Math.round(grand / dates.length) : 0;
    const peakDay = dates[0];
    const dailyHtml = `<div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px;padding:10px 14px;border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase">Hari Aktif</div>
        <div style="font-size:18px;font-weight:700;color:var(--heading)">${dates.length}</div>
      </div>
      <div style="flex:1;min-width:120px;padding:10px 14px;border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase">Rata-rata / Hari</div>
        <div style="font-size:14px;font-weight:700;font-family:var(--font-mono);color:var(--text)">${fR(avgDaily)}</div>
      </div>
      ${peakDay ? `<div style="flex:1;min-width:120px;padding:10px 14px;border-radius:8px;border:1px solid rgba(239,68,68,.15);background:rgba(239,68,68,.04)">
        <div style="font-size:10px;color:var(--text-3);text-transform:uppercase">Hari Tertinggi</div>
        <div style="font-size:14px;font-weight:700;font-family:var(--font-mono);color:var(--danger)">${fR(peakDay[1].total)}</div>
        <div style="font-size:10px;color:var(--text-3)">${peakDay[0].split('-').reverse().join('-')} (${peakDay[1].count} tx)</div>
      </div>` : ''}
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Top 10 Hari Pengeluaran Tertinggi</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="padding:5px 0;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">#</th>
        <th style="padding:5px 0;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Tanggal</th>
        <th style="padding:5px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">Jumlah Tx</th>
        <th style="padding:5px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">Total</th>
        <th style="padding:5px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">vs Rata-rata</th>
      </tr></thead>
      <tbody>${dates.slice(0,10).map(([d,v],i) => {
        const ratio = avgDaily > 0 ? ((v.total/avgDaily-1)*100).toFixed(0) : 0;
        const isHigh = Number(ratio) > 100;
        return `<tr style="border-bottom:1px solid var(--border)${isHigh?';background:rgba(239,68,68,.04)':''}">
          <td style="padding:5px 0;color:var(--text-3)">${i+1}</td>
          <td style="padding:5px 0;font-weight:500">${d.split('-').reverse().join('-')}</td>
          <td style="padding:5px 0;text-align:right;color:var(--text-2)">${v.count}</td>
          <td style="padding:5px 0;text-align:right;font-family:var(--font-mono);font-weight:600">${fR(v.total)}</td>
          <td style="padding:5px 0;text-align:right;font-weight:600;color:${Number(ratio)>0?'var(--danger)':'var(--success)'}">+${ratio}%${isHigh?' ⚠':''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;

    // ── 5. DETEKSI ANOMALI & TRANSAKSI JANGGAL ──
    const findings = [];

    // 5a. Transaksi bernilai tinggi (outlier) — > mean + 2*stddev per kategori
    typesSorted.forEach(({type, items}) => {
      if (items.length < 3) return;
      const vals = items.map(r=>r.jumlah||0);
      const mean = vals.reduce((s,v)=>s+v,0)/vals.length;
      const stddev = Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length);
      const threshold = mean + 2*stddev;
      items.filter(r=>(r.jumlah||0)>threshold).forEach(r => {
        findings.push({
          severity:'high', icon:'⚠️',
          title:`Transaksi outlier di ${type}`,
          desc:`"${r.nama||'-'}" pada ${(r.tgl||'').split('-').reverse().join('-')} senilai ${fR(r.jumlah||0)} — jauh di atas rata-rata kategori ${fR(Math.round(mean))} (${((r.jumlah/mean-1)*100).toFixed(0)}% lebih tinggi)`,
          amount: r.jumlah||0,
          ids: [r.id],
          search: r.nama||'',
        });
      });
    });

    // 5b. Duplikat — nama + jumlah + vendor sama pada hari yang sama
    const dupMap = {};
    rows.forEach(r => {
      const key = `${r.tgl}|${(r.nama||'').toLowerCase().trim()}|${r.jumlah}|${(r.vendor||'').toLowerCase().trim()}`;
      if (!dupMap[key]) dupMap[key] = [];
      dupMap[key].push(r);
    });
    Object.entries(dupMap).filter(([,v])=>v.length>1).forEach(([,dupes]) => {
      const r = dupes[0];
      findings.push({
        severity:'medium', icon:'🔁',
        title:`Kemungkinan duplikat (${dupes.length}x)`,
        desc:`"${r.nama||'-'}" — ${(r.tgl||'').split('-').reverse().join('-')} — ${fR(r.jumlah||0)} × ${dupes.length} kali, vendor "${r.vendor||'-'}". Total: ${fR((r.jumlah||0)*dupes.length)}`,
        amount: (r.jumlah||0)*dupes.length,
        ids: dupes.map(d=>d.id),
        search: r.nama||'',
      });
    });

    // 5c. Harga satuan tinggi vs rata-rata item serupa
    const byNama = {};
    rows.forEach(r => {
      const n = (r.nama||'').toLowerCase().trim();
      if (!n) return;
      if (!byNama[n]) byNama[n] = [];
      byNama[n].push(r);
    });
    Object.entries(byNama).forEach(([nama, items]) => {
      if (items.length < 3) return;
      const prices = items.map(r=>r.hargaSatuan||0).filter(v=>v>0);
      if (prices.length < 3) return;
      const avg = prices.reduce((s,v)=>s+v,0)/prices.length;
      const maxPrice = Math.max(...prices);
      if (maxPrice > avg * 2 && maxPrice > 10000) {
        const expensiveItem = items.find(r=>(r.hargaSatuan||0)===maxPrice);
        findings.push({
          severity:'medium', icon:'💰',
          title:`Harga satuan tidak wajar`,
          desc:`"${expensiveItem?.nama||nama}" pada ${(expensiveItem?.tgl||'').split('-').reverse().join('-')} — harga ${fR(maxPrice)}/${expensiveItem?.satuan||'unit'}, rata-rata biasanya ${fR(Math.round(avg))}/${expensiveItem?.satuan||'unit'} (${((maxPrice/avg-1)*100).toFixed(0)}% lebih mahal)`,
          amount: maxPrice,
          ids: [expensiveItem?.id].filter(Boolean),
          search: expensiveItem?.nama||nama,
        });
      }
    });

    // 5d. Transaksi tanpa vendor
    const noVendor = rows.filter(r => !r.vendor && (r.jumlah||0) > 50000);
    if (noVendor.length > 0) {
      const totalNoVendor = noVendor.reduce((s,r)=>s+(r.jumlah||0),0);
      findings.push({
        severity:'low', icon:'📋',
        title:`${noVendor.length} transaksi tanpa vendor`,
        desc:`Total ${fR(totalNoVendor)} dari ${noVendor.length} transaksi (> Rp 50.000) tidak memiliki informasi vendor/supplier. Sebaiknya dilengkapi untuk audit trail.`,
        amount: totalNoVendor,
        ids: noVendor.map(r=>r.id),
      });
    }

    // 5e. Transaksi bernilai bulat besar (kemungkinan estimasi, bukan aktual)
    const roundTx = rows.filter(r => {
      const j = r.jumlah||0;
      return j >= 500000 && j % 100000 === 0;
    });
    if (roundTx.length >= 3) {
      findings.push({
        severity:'low', icon:'🔢',
        title:`${roundTx.length} transaksi bernilai bulat`,
        desc:`Ditemukan ${roundTx.length} transaksi dengan nilai kelipatan Rp 100.000 (≥ Rp 500.000). Contoh: ${roundTx.slice(0,3).map(r=>`"${r.nama||'-'}" ${fR(r.jumlah||0)}`).join(', ')}. Nilai bulat bisa mengindikasikan estimasi, bukan nilai aktual.`,
        amount: roundTx.reduce((s,r)=>s+(r.jumlah||0),0),
        ids: roundTx.map(r=>r.id),
      });
    }

    // 5f. Hari dengan pengeluaran sangat tinggi vs rata-rata
    dates.forEach(([d,v]) => {
      if (avgDaily > 0 && v.total > avgDaily * 3 && v.total > 1000000) {
        findings.push({
          severity:'medium', icon:'📅',
          title:`Lonjakan pengeluaran pada ${d.split('-').reverse().join('-')}`,
          desc:`Total ${fR(v.total)} dalam ${v.count} transaksi — ${((v.total/avgDaily-1)*100).toFixed(0)}% di atas rata-rata harian (${fR(avgDaily)}). Item terbesar: ${v.items.sort((a,b)=>(b.jumlah||0)-(a.jumlah||0)).slice(0,3).map(r=>`"${r.nama||'-'}" ${fR(r.jumlah||0)}`).join(', ')}.`,
          amount: v.total,
          ids: v.items.map(r=>r.id),
          dateFrom: d, dateTo: d,
        });
      }
    });

    // 5g. Top 10 transaksi terbesar
    const topTx = [...rows].sort((a,b)=>(b.jumlah||0)-(a.jumlah||0)).slice(0,10);

    // Sort findings by severity then amount
    const sevOrder = {high:0, medium:1, low:2};
    findings.sort((a,b) => (sevOrder[a.severity]||9) - (sevOrder[b.severity]||9) || (b.amount||0) - (a.amount||0));

    const sevColors = {high:'var(--danger)', medium:'var(--warning)', low:'var(--text-3)'};
    const sevLabels = {high:'Tinggi', medium:'Sedang', low:'Info'};
    const sevBg     = {high:'rgba(239,68,68,.06)', medium:'rgba(245,158,11,.06)', low:'rgba(148,163,184,.06)'};
    const sevBorder = {high:'rgba(239,68,68,.2)', medium:'rgba(245,158,11,.2)', low:'rgba(148,163,184,.2)'};

    // Store findings globally for goToAnomaly
    window._kasAnomalyFindings = findings;

    // Build detail table for each finding
    const _findingDetail = (f, idx) => {
      const relatedRows = (f.ids||[]).map(id => rows.find(r=>r.id===id)).filter(Boolean);
      if (!relatedRows.length) return '';
      return `<div id="ks-anomaly-detail-${idx}" style="display:none;margin-top:8px;padding:8px 0 0 22px;border-top:1px dashed ${sevBorder[f.severity]}">
        <div style="max-height:250px;overflow-y:auto;border-radius:6px">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="padding:4px 6px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Tanggal</th>
            <th style="padding:4px 6px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Nama</th>
            <th style="padding:4px 6px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Type</th>
            <th style="padding:4px 6px;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Vendor</th>
            <th style="padding:4px 6px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">Qty</th>
            <th style="padding:4px 6px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">Harga/Sat</th>
            <th style="padding:4px 6px;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">Total</th>
          </tr></thead>
          <tbody>${relatedRows.slice(0,20).map(r => `<tr style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s" onclick="KasModule.goToAnomaly(${idx},'${r.id}')"
            onmouseover="this.style.background='rgba(99,102,241,.08)'" onmouseout="this.style.background=''">
            <td style="padding:4px 6px;white-space:nowrap">${(r.tgl||'').split('-').reverse().join('-')}</td>
            <td style="padding:4px 6px;font-weight:500">${r.nama||'-'}</td>
            <td style="padding:4px 6px;color:var(--text-3)">${r.type||'-'}</td>
            <td style="padding:4px 6px;color:var(--text-3)">${r.vendor||'-'}</td>
            <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono)">${r.qty||'-'} ${r.satuan||''}</td>
            <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono)">${fR(r.hargaSatuan||0)}</td>
            <td style="padding:4px 6px;text-align:right;font-family:var(--font-mono);font-weight:600">${fR(r.jumlah||0)}</td>
          </tr>`).join('')}
          ${relatedRows.length>20?`<tr><td colspan="7" style="padding:4px 6px;color:var(--text-3);font-size:10px">...dan ${relatedRows.length-20} transaksi lainnya</td></tr>`:''}
          </tbody>
        </table>
        </div>
      </div>`;
    };

    const anomalyHtml = findings.length > 0
      ? `<div style="font-size:11px;color:var(--text-3);margin-bottom:12px">Ditemukan <strong style="color:var(--heading)">${findings.length}</strong> temuan yang perlu diperhatikan</div>
         ${findings.map((f,i) => `<div style="margin-bottom:8px;padding:10px 14px;border-radius:8px;border:1px solid ${sevBorder[f.severity]};background:${sevBg[f.severity]}">
           <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
             <span style="font-size:14px">${f.icon}</span>
             <span style="font-size:12px;font-weight:700;color:var(--heading);flex:1">${f.title}</span>
             <span style="font-size:9px;padding:2px 6px;border-radius:3px;font-weight:700;background:${sevBg[f.severity]};color:${sevColors[f.severity]};border:1px solid ${sevBorder[f.severity]}">${sevLabels[f.severity]}</span>
           </div>
           <div style="font-size:11px;color:var(--text-2);line-height:1.6;padding-left:22px">${f.desc}</div>
           <div style="display:flex;gap:6px;margin-top:6px;padding-left:22px">
             ${(f.ids&&f.ids.length)?`<button onclick="KasModule.toggleAnomalyDetail(${i})" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid ${sevBorder[f.severity]};background:transparent;color:${sevColors[f.severity]};cursor:pointer;font-weight:600;display:flex;align-items:center;gap:4px;transition:all .15s"
               onmouseover="this.style.background='${sevBg[f.severity]}'" onmouseout="this.style.background='transparent'">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M9 5l7 7-7 7"/></svg>
               ${f.ids.length} data
             </button>`:''}
             ${(f.ids&&f.ids.length)?`<button onclick="KasModule.goToAnomaly(${i})" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid var(--primary);background:transparent;color:var(--primary);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:4px;transition:all .15s"
               onmouseover="this.style.background='rgba(99,102,241,.1)'" onmouseout="this.style.background='transparent'">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
               Lihat di Tabel
             </button>`:''}
           </div>
           ${_findingDetail(f, i)}
         </div>`).join('')}`
      : '<div style="padding:16px;text-align:center;color:var(--success);font-size:12px">Tidak ditemukan anomali atau transaksi janggal pada bulan ini.</div>';

    // Top 10 transaksi terbesar table
    const topTxHtml = `<div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px;margin-top:16px;text-transform:uppercase;letter-spacing:.04em">Top 10 Transaksi Terbesar</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:5px 0;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">#</th>
          <th style="padding:5px 0;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Tanggal</th>
          <th style="padding:5px 0;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Nama</th>
          <th style="padding:5px 0;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Kategori</th>
          <th style="padding:5px 0;text-align:left;font-weight:600;color:var(--text-3);font-size:10px">Vendor</th>
          <th style="padding:5px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">Total</th>
          <th style="padding:5px 0;text-align:right;font-weight:600;color:var(--text-3);font-size:10px">% dari Total</th>
        </tr></thead>
        <tbody>${topTx.map((r,i) => {
          const pct = grand > 0 ? ((r.jumlah||0)/grand*100).toFixed(1) : 0;
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:5px 0;color:var(--text-3)">${i+1}</td>
            <td style="padding:5px 0;white-space:nowrap">${(r.tgl||'').split('-').reverse().join('-')}</td>
            <td style="padding:5px 0;font-weight:500">${r.nama||'-'}</td>
            <td style="padding:5px 0;color:var(--text-3)">${r.type||'-'}</td>
            <td style="padding:5px 0;color:var(--text-3)">${r.vendor||'-'}</td>
            <td style="padding:5px 0;text-align:right;font-family:var(--font-mono);font-weight:600">${fR(r.jumlah||0)}</td>
            <td style="padding:5px 0;text-align:right;color:var(--text-3)">${pct}%</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

    // Sticky sub-nav: jump-to-section anchors di top analisa
    const navLinks = [
      { id:'an-summary',  label:'📊 Ringkasan' },
      { id:'an-kategori', label:'🗂️ Kategori' },
      { id:'an-mom',      label:'📈 vs Bulan Lalu' },
      { id:'an-daily',    label:'📅 Per Hari' },
      { id:'an-anomali',  label:'⚠️ Anomali' },
    ];
    const subNav = `<div style="position:sticky;top:0;z-index:5;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;margin-top:16px;display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      ${navLinks.map(n => `<a href="#${n.id}" onclick="event.preventDefault();document.getElementById('${n.id}')?.scrollIntoView({behavior:'smooth',block:'start'})"
        style="font-size:11px;font-weight:600;color:var(--text-2);background:var(--surface2);padding:5px 11px;border-radius:6px;text-decoration:none;white-space:nowrap;transition:all .15s;cursor:pointer"
        onmouseover="this.style.background='var(--primary)';this.style.color='#fff'"
        onmouseout="this.style.background='var(--surface2)';this.style.color='var(--text-2)'">${n.label}</a>`).join('')}
    </div>
    <style>
      [id^="an-"]{scroll-margin-top:80px}
    </style>`;

    return subNav
      + _sec(`Ringkasan Keuangan — ${bulanLabel}`, summaryHtml, 'an-summary')
      + _sec(`Distribusi Pengeluaran per Kategori`, catHtml, 'an-kategori')
      + _sec(`Perbandingan vs Bulan Sebelumnya`, momHtml, 'an-mom')
      + _sec(`Analisa Pengeluaran Harian`, dailyHtml, 'an-daily')
      + _sec(`Deteksi Anomali & Transaksi Janggal`, anomalyHtml + topTxHtml, 'an-anomali');
  }

  function toggleAnomalyDetail(idx) {
    const el = document.getElementById('ks-anomaly-detail-'+idx);
    if (!el) return;
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : '';
    // Rotate arrow icon on the button that triggered this
    const card = el.closest('div[style*="border-radius:8px"]');
    if (card) {
      const svgs = card.querySelectorAll('svg');
      // First svg in the action buttons row (the arrow)
      const actionRow = card.querySelector('div[style*="display:flex;gap:6px"]');
      if (actionRow) {
        const arrow = actionRow.querySelector('svg');
        if (arrow) { arrow.style.transition = 'transform .2s'; arrow.style.transform = isOpen ? '' : 'rotate(90deg)'; }
      }
    }
  }

  function goToAnomaly(idx, singleId) {
    const findings = window._kasAnomalyFindings;
    if (!findings || !findings[idx]) return;
    const f = findings[idx];
    const ids = singleId ? [singleId] : (f.ids||[]);
    if (!ids.length) return;

    // Switch to transaksi tab
    switchTab('transaksi');

    // Apply search filter if available, or date filter
    let filterDesc = '';
    if (f.search) {
      _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'', search: f.search };
      filterDesc = `Filter: "${f.search}"`;
    } else if (f.dateFrom) {
      _filter = { bulan:'', type:'', status:'', dateFrom: f.dateFrom, dateTo: f.dateTo||f.dateFrom, search:'' };
      filterDesc = `Filter: tanggal ${f.dateFrom.split('-').reverse().join('-')}`;
    } else {
      _filter = { bulan:'', type:'', status:'', dateFrom:'', dateTo:'', search:'' };
      filterDesc = 'Menampilkan semua data';
    }
    _page = 1;
    renderTransaksi();
    Notify.info(`${f.title} — ${ids.length} data ditandai. ${filterDesc}`);

    // Highlight matching rows with pulse animation
    requestAnimationFrame(() => {
      let firstEl = null;
      ids.forEach(id => {
        const row = document.getElementById('ks-row-'+id);
        if (row) {
          if (!firstEl) firstEl = row;
          row.style.transition = 'none';
          row.style.outline = '2px solid var(--primary)';
          row.style.outlineOffset = '-2px';
          row.style.boxShadow = '0 0 0 3px rgba(99,102,241,.2)';
          row.querySelectorAll('td').forEach(td => { td.style.background = 'rgba(99,102,241,.15)'; });
          // Clear highlight after 4s
          setTimeout(() => {
            row.style.transition = 'all .5s';
            row.style.outline = 'none';
            row.style.boxShadow = 'none';
            row.querySelectorAll('td').forEach(td => { td.style.background = ''; });
          }, 4000);
        }
      });
      // Scroll to first match
      if (firstEl) firstEl.scrollIntoView({ behavior:'smooth', block:'center' });
    });
  }

  function printMonthly() {
    const el = document.getElementById('monthly-report');
    if (!el) { Notify.warning('Buat report dulu'); return; }
    const win = window.open('', '_blank');
    // Replace CSS variables with concrete values for print
    let html = el.innerHTML;
    const varMap = {
      'var(--font)':'Inter,sans-serif','var(--font-mono)':'monospace',
      'var(--surface)':'#fff','var(--surface2)':'#f8fafc','var(--surface3)':'#f1f5f9',
      'var(--border)':'#e2e8f0','var(--border2)':'#cbd5e1',
      'var(--heading)':'#0f172a','var(--text)':'#1e293b','var(--text-2)':'#475569','var(--text-3)':'#94a3b8',
      'var(--primary)':'#6366f1','var(--primary-h)':'#4f46e5',
      'var(--danger)':'#ef4444','var(--success)':'#22c55e','var(--warning)':'#eab308',
      'var(--r-lg)':'12px','var(--r-md)':'8px','var(--r-sm)':'4px',
      'var(--s2)':'8px','var(--s3)':'12px','var(--s4)':'16px','var(--s5)':'20px','var(--s6)':'24px',
      'var(--thead-bg)':'#1e293b','var(--thead-text)':'#fff',
    };
    for (const [k,v] of Object.entries(varMap)) html = html.replaceAll(k,v);
    // Remove interactive buttons from print (anomaly action buttons, etc.)
    html = html.replace(/<button[^>]*onclick[^>]*>[\s\S]*?<\/button>/gi, '');
    const reportTitle = el.querySelector('div[style*="font-size:22px"]')?.textContent?.trim() || 'Laporan Kas Kecil';
    const printDate = new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
    win.document.write(`<!DOCTYPE html><html><head><title>Laporan Kas Kecil</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;padding:20px;color:#1e293b;font-size:12px}
        table{width:100%;border-collapse:collapse}
        th,td{padding:6px 10px;border:1px solid #e2e8f0;font-size:11px}
        th{background:#1e293b;color:#fff;font-size:9px;text-transform:uppercase;letter-spacing:.05em}
        @page{size:landscape;margin:12mm 10mm}
        @media print{
          body{padding:0}
          .no-print{display:none!important}
        }
      </style>
    </head><body>${html}
    <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8">
      <span>Dicetak: ${printDate}</span>
      <span>${reportTitle} — BECCA V2.0</span>
    </div>
    <script>setTimeout(()=>{window.print()},300)<\/script>
    </body></html>`);
    win.document.close();
  }

  /* ===================== CASH FLOW ===================== */
  function renderCashflow() {
    const mD={},kD={};
    // Kas masuk = rows type="Kas" dari _kas
    _kas.filter(r=>r.type==='Kas').forEach(r=>{mD[r.tgl]=(mD[r.tgl]||0)+(r.jumlah||0);});
    // Kas keluar = semua rows type≠"Kas" yang status DONE
    _kas.filter(r=>r.type!=='Kas'&&r.status==='DONE').forEach(r=>{kD[r.tgl]=(kD[r.tgl]||0)+r.jumlah;});
    const dates=[...new Set([...Object.keys(mD),...Object.keys(kD)])].sort();
    let bal=0;
    const rows=dates.map(tgl=>{const m=mD[tgl]||0,k=kD[tgl]||0;bal+=m-k;return{tgl,m,k,bal};});
    const tM=rows.reduce((s,r)=>s+r.m,0),tK=rows.reduce((s,r)=>s+r.k,0),net=tM-tK;
    document.getElementById('kas-tab-cashflow').innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-bottom:var(--s5)">
        ${[{l:'Kas Masuk',v:Utils.formatRupiah(tM),c:'var(--success)'},{l:'Kas Keluar',v:Utils.formatRupiah(tK),c:'var(--danger)'},{l:net>=0?'Surplus':'Defisit',v:Utils.formatRupiah(Math.abs(net)),c:net>=0?'var(--success)':'var(--danger)'}]
          .map(s=>`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">${s.l}</div>
            <div style="font-size:20px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>`).join('')}
      </div>
      <div style="padding:8px 14px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.15);border-radius:var(--r-md);margin-bottom:var(--s4);display:flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="16" height="16" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span style="font-size:11px;color:var(--text-2)">Cash flow hanya menghitung transaksi dengan status <strong>DONE</strong>. Transaksi TBC/pending tidak termasuk agar laporan mencerminkan arus kas aktual yang sudah terkonfirmasi.</span>
      </div>
      <div class="table-wrapper"><div class="table-scroll"><table class="table">
        <thead><tr><th>Tanggal</th><th class="num" style="color:var(--success)">Kas Masuk</th><th class="num" style="color:var(--danger)">Kas Keluar (DONE)</th><th class="num">Net</th><th class="num">Balance</th></tr></thead>
        <tbody>${rows.map(r=>{const n=r.m-r.k;return`<tr><td style="white-space:nowrap">${Utils.formatDate(r.tgl,'dd mmm yyyy')}</td><td class="num" style="color:var(--success)">${r.m?Utils.formatRupiah(r.m):'-'}</td><td class="num" style="color:var(--danger)">${r.k?Utils.formatRupiah(r.k):'-'}</td><td class="num" style="color:${n>=0?'var(--success)':'var(--danger)'};font-weight:600">${n?Utils.formatRupiah(Math.abs(n)):'-'}</td><td class="num"><strong style="color:${r.bal>=0?'var(--text)':'var(--danger)'}">${Utils.formatRupiah(r.bal)}</strong></td></tr>`;}).join('')}</tbody>
      </table></div></div>`;
  }

  /* ===================== BALANCE CARDS ===================== */
  const _AI_SVG_KAS = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <defs><linearGradient id="kasAI" x1="0" y1="0" x2="20" y2="20">
      <stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient></defs>
    <circle cx="10" cy="10" r="9" fill="url(#kasAI)" opacity=".15"/>
    <path d="M10 4v2M10 14v2M4 10h2M14 10h2M5.6 5.6l1.1 1.1M13.3 13.3l1.1 1.1M5.6 14.4l1.1-1.1M13.3 6.7l1.1-1.1" 
          stroke="url(#kasAI)" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="10" cy="10" r="2.5" fill="url(#kasAI)"/>
  </svg>`;

  async function _renderBalanceCards() {
    const container = document.getElementById('kas-balance-cards');
    if (!container) return;
    container.innerHTML = ''; // clear dulu
    
    try {
      // Kas masuk = kas rows type="Kas" (import Excel / entry manual di tabel utama)
      const totalMasuk  = _kas.filter(r=>r.type==='Kas').reduce((s,r) => s + (r.jumlah||0), 0);

      // Kas keluar = semua kas kecuali type="Kas"
      const totalKeluar = _kas.filter(r=>r.type!=='Kas').reduce((s,r) => s + (r.jumlah||0), 0);

      // Balance = Saldo Awal + Kas Masuk - Total Keluar
      const saldoAwal = _saldoAwal;
      const balance   = saldoAwal + totalMasuk - totalKeluar;
      const balanceColor = balance >= 0 ? 'var(--success)' : 'var(--danger)';
      
      const cards = [
        {
          label: 'Kas Masuk',
          value: Utils.formatRupiah(totalMasuk),
          color: 'var(--success)',
          prefix: '',
        },
      ];
      // Simpan balance ke localStorage agar dashboard bisa mirror nilai ini secara langsung
      localStorage.setItem('becca_kas_balance', String(balance));

      // Inject Balance bar kanan atas
      const balanceBarEl = document.getElementById('kas-balance-bar');
      if (balanceBarEl) {
        const balColor = balance >= 0 ? 'var(--success)' : 'var(--danger)';
        const balLabel = balance >= 0 ? 'Surplus' : 'Defisit';
        balanceBarEl.innerHTML =
          '<span style="font-size:11px;color:var(--text-3)">Balance &nbsp;</span>'
          + '<span style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:'+balColor+'">'
          + Utils.formatRupiah(Math.abs(balance))+'</span>'
          + '&nbsp;<span style="font-size:11px;color:'+balColor+'">'+balLabel+'</span>';
      }
      // Inject Saldo Awal bar kiri atas (editable hanya Superadmin)
      const saldoBarEl = document.getElementById('kas-saldo-bar');
      if (saldoBarEl) {
        const sa = _saldoAwal;
        const canEditSaldo = Auth.isSuperAdmin();
        saldoBarEl.innerHTML =
          '<span style="color:var(--text-3);font-size:12px">Saldo Awal &nbsp;</span>'
          + '<span id="kas-saldo-val" style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:var(--primary-h);'
          + (canEditSaldo ? 'cursor:pointer;border-bottom:1px dashed rgba(99,102,241,.4);padding-bottom:1px' : '')
          + '"'
          + (canEditSaldo ? ' title="Klik untuk edit saldo awal" onclick="KasModule.editSaldoAwal()"' : '')
          + '>' + Utils.formatRupiah(sa) + '</span>'
          + (canEditSaldo ? ' <span style="font-size:10px;color:var(--text-3);cursor:pointer" onclick="KasModule.editSaldoAwal()" title="Edit">✎</span>' : '');
      }
      
      // Kas Masuk card sudah di _summaryStrip, container dipakai untuk info lain jika perlu
      container.innerHTML = '';
    } catch(e) {
      console.error('Balance cards error:', e);
    }
  }

  /* ===================== STATUS FILTER ===================== */
  function filterByStatus(status) {
    _activeTab = 'transaksi';
    document.querySelectorAll('.kas-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab==='transaksi'));
    document.querySelectorAll('[id^="kas-tab-"]').forEach(el => el.style.display = el.id==='kas-tab-transaksi' ? '' : 'none');
    _filter = { bulan:'', type:'', status, dateFrom:'', dateTo:'' };
    _page = 1;
    renderTransaksi();
  }

  /* ===================== KAS MASUK FILTER ===================== */
  function filterKasMasukType() {
    // Switch ke tab Transaksi dan filter by type=Kas
    _activeTab = 'transaksi';
    document.querySelectorAll('.kas-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab==='transaksi'));
    document.querySelectorAll('[id^="kas-tab-"]').forEach(el => el.style.display = el.id==='kas-tab-transaksi' ? '' : 'none');
    _filter = { bulan:'', type:'Kas', status:'', dateFrom:'', dateTo:'' };
    _page = 1;
    renderTransaksi();
    // Sync dropdown jika ada
    const typeEl = document.getElementById('kas-filter-type');
    if (typeEl) typeEl.value = 'Kas';
  }

  /* ===================== KAS MASUK MODAL ===================== */
  async function openKasMasukModal() {
    const masukData = await DB.getKasMasuk().catch(()=>[]);
    // Sort by date desc
    const sorted = [...masukData].sort((a,b)=>(b.tgl||'').localeCompare(a.tgl||''));
    const mid = Utils.uid();
    
    function _renderMasukTable(rows) {
      if (!rows.length) return UI.empty({iconKey:'chart', title:'Tidak ada data pada periode ini'});
      const total = rows.reduce((s,r)=>s+(r.kredit||0),0);
      return '<div style="font-size:11px;color:var(--text-3);margin-bottom:8px">' + rows.length + ' transaksi</div>'
        + '<div class="table-scroll" style="max-height:400px;overflow-y:auto"><table class="table" style="font-size:12px">'
        + '<thead><tr><th>Tanggal</th><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>'
        + '<tbody>'
        + rows.map(r =>
            '<tr><td style="white-space:nowrap">'+(r.tgl||'-')+'</td>'
            + '<td>'+(r.keterangan||r.ket||r.nama||'Kas Masuk / Setoran')+'</td>'
            + '<td class="num" style="font-family:var(--font-mono)">'+Utils.formatRupiah(r.kredit||0)+'</td></tr>'
          ).join('')
        + '<tr style="background:var(--surface2);font-weight:700">'
        + '<td colspan="2">TOTAL</td>'
        + '<td class="num" style="font-family:var(--font-mono);color:var(--success)">'+Utils.formatRupiah(total)+'</td></tr>'
        + '</tbody></table></div>';
    }

    Modal.open({ id: mid,
      title: 'Kas Masuk',
      size: 'modal-md',
      body: '<div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);align-items:flex-end">'
        + '<div class="form-group" style="margin:0;flex:1">'
        + '<label class="form-label">Dari Tanggal</label>'
        + '<input type="date" class="form-control" id="km-from" placeholder="Dari tanggal">'
        + '</div>'
        + '<div class="form-group" style="margin:0;flex:1">'
        + '<label class="form-label">Sampai Tanggal</label>'
        + '<input type="date" class="form-control" id="km-to" placeholder="Sampai tanggal">'
        + '</div>'
        + '<button class="btn btn-primary btn-sm" onclick="KasModule._filterKasMasuk()">Tampilkan</button>'
        + '<button class="btn btn-ghost btn-sm" onclick="KasModule._filterKasMasuk(true)">Semua</button>'
        + '</div>'
        + '<div id="km-table">' + _renderMasukTable(sorted) + '</div>',
      footer: '<button class="btn btn-ghost" onclick="Modal.close(\'' + mid + '\')" >Tutup</button>',
    });

    // Simpan data untuk filter
    window._kasMasukAll = sorted;
    window._kasMasukMid = mid;
  }

  function _filterKasMasuk(showAll) {
    const data   = window._kasMasukAll || [];
    const from   = document.getElementById('km-from')?.value;
    const to     = document.getElementById('km-to')?.value;
    let filtered = data;
    if (!showAll) {
      if (from) filtered = filtered.filter(r=>(r.tgl||'')>=from);
      if (to)   filtered = filtered.filter(r=>(r.tgl||'')<=to);
    }
    const tableEl = document.getElementById('km-table');
    if (!tableEl) return;
    if (!filtered.length) {
      tableEl.innerHTML = UI.empty({iconKey:'chart', title:'Tidak ada data pada periode ini'});
      return;
    }
    const total = filtered.reduce((s,r)=>s+(r.kredit||0),0);
    tableEl.innerHTML = '<div class="table-scroll"><table class="table" style="font-size:12px">'
      + '<thead><tr><th>Tanggal</th><th>Keterangan</th><th class="num">Jumlah</th></tr></thead>'
      + '<tbody>'
      + filtered.map(r =>
          '<tr><td style="white-space:nowrap">'+(r.tgl||'-')+'</td>'
          + '<td>'+(r.keterangan||r.ket||'-')+'</td>'
          + '<td class="num" style="font-family:var(--font-mono)">'+Utils.formatRupiah(r.kredit||0)+'</td></tr>'
        ).join('')
      + '<tr style="background:var(--surface2);font-weight:700">'
      + '<td colspan="2">TOTAL ('+filtered.length+' transaksi)</td>'
      + '<td class="num" style="font-family:var(--font-mono);color:var(--success)">'+Utils.formatRupiah(total)+'</td></tr>'
      + '</tbody></table></div>';
  }

  /* ===================== EDIT SALDO AWAL ===================== */
  // Buka modal untuk override / reset saldo awal bulan tertentu (per-bulan snapshot)
  function openSaldoAwalSnapshot(yearMonth) {
    const role = Auth.currentUser()?.role || '';
    if (role !== 'superadmin' && role !== 'admin') {
      Notify.error('Akses ditolak', 'Hanya admin/superadmin yang dapat mengubah saldo awal bulan');
      return;
    }
    if (!yearMonth) { Notify.warning('Bulan tidak valid'); return; }
    const info = _getSaldoAwalForMonth(yearMonth);
    const _BL = {1:'Januari',2:'Februari',3:'Maret',4:'April',5:'Mei',6:'Juni',7:'Juli',8:'Agustus',9:'September',10:'Oktober',11:'November',12:'Desember'};
    const [y, m] = yearMonth.split('-');
    const bulanLabel = (_BL[parseInt(m)] || m) + ' ' + y;
    const isManual = info.source === 'manual';
    const mid = 'saldo-snap-' + Date.now();
    const computedVal = (() => {
      // Hitung apa kalau auto, untuk show "auto suggestion"
      if (isManual) {
        const tmp = _saldoAwalSnapshots[yearMonth];
        delete _saldoAwalSnapshots[yearMonth];
        const auto = _getSaldoAwalForMonth(yearMonth).value;
        _saldoAwalSnapshots[yearMonth] = tmp;
        return auto;
      }
      return info.value;
    })();

    Modal.open({ id: mid,
      title: `Saldo Awal — ${bulanLabel}`,
      size: 'modal-sm',
      body: `
        <div style="font-size:12px;color:var(--text-2);margin-bottom:12px">
          ${isManual
            ? `Saat ini <strong style="color:#10b981">manual snapshot</strong> aktif.`
            : `Saat ini <strong>otomatis</strong> dari saldo awal global + Σ transaksi sebelum ${bulanLabel}.`}
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label class="form-label">Saldo Awal Manual (Rp)</label>
          <input type="number" step="1" class="form-control" id="saldo-snap-inp" value="${info.value}" placeholder="0">
          <div class="form-hint" style="font-size:11px;margin-top:4px">
            Otomatis hitung: <strong>${Utils.formatRupiah(computedVal)}</strong> (dari saldo global + transaksi sebelumnya).
            ${isManual ? `<br/>Manual saat ini: <strong style="color:#10b981">${Utils.formatRupiah(info.value)}</strong>.` : ''}
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-3);background:var(--surface2);padding:8px 10px;border-radius:6px">
          📌 Snapshot manual berguna saat rekonsiliasi end-of-month dengan rekening bank.
          Reset ke otomatis kalau ingin sistem kalkulasi sendiri.
        </div>`,
      footer: `
        <button class="btn btn-ghost btn-sm" onclick="Modal.close('${mid}')">Batal</button>
        ${isManual ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="KasModule._resetSaldoAwalSnapshot('${yearMonth}','${mid}')">Reset ke Otomatis</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="KasModule._saveSaldoAwalSnapshot('${yearMonth}','${mid}')">Simpan Manual</button>
      `,
    });
    setTimeout(() => {
      const inp = document.getElementById('saldo-snap-inp');
      if (inp) { inp.focus(); inp.select(); }
    }, 100);
  }

  async function _saveSaldoAwalSnapshotHandler(yearMonth, mid) {
    const val = parseFloat(document.getElementById('saldo-snap-inp')?.value) || 0;
    await _saveSaldoAwalSnapshot(yearMonth, val);
    Modal.close(mid);
    Notify.success('Saldo awal manual disimpan', `${Utils.formatRupiah(val)} untuk bulan terpilih`);
    DB.logActivity?.({type:'saldo_awal_snapshot', detail:`Set saldo awal manual ${yearMonth}: ${Utils.formatRupiah(val)}`});
    // Re-render monthly view
    if (_activeTab === 'monthly') renderMonthlyTable(yearMonth);
  }

  async function _resetSaldoAwalSnapshotHandler(yearMonth, mid) {
    await _clearSaldoAwalSnapshot(yearMonth);
    Modal.close(mid);
    Notify.success('Snapshot manual dihapus', 'Saldo awal kembali ke otomatis');
    DB.logActivity?.({type:'saldo_awal_snapshot_clear', detail:`Reset snapshot ${yearMonth} ke otomatis`});
    if (_activeTab === 'monthly') renderMonthlyTable(yearMonth);
  }

  function editSaldoAwal() {
    if (!Auth.isSuperAdmin()) { Notify.error('Hanya Superadmin yang dapat mengubah Saldo Awal'); return; }
    const current = _saldoAwal;
    const mid = Utils.uid();
    Modal.open({ id: mid,
      title: 'Edit Saldo Awal Kas',
      size: 'modal-sm',
      body: `<div class="form-group">
        <label class="form-label">Saldo Awal (Rp)</label>
        <input type="number" min="0" class="form-control" id="saldo-awal-inp" value="${current}" placeholder="0">
        <div class="form-hint">Saldo awal mempengaruhi Balance. Klik Simpan atau tekan Enter.</div>
      </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Batal</button>
               <button class="btn btn-primary" onclick="KasModule._saveSaldoAwalModal('${mid}')">Simpan</button>`,
    });
    setTimeout(() => {
      const inp = document.getElementById('saldo-awal-inp');
      if (inp) { inp.focus(); inp.select(); }
    }, 100);
  }

  function _saveSaldoAwalModal(mid) {
    const val = parseFloat(document.getElementById('saldo-awal-inp')?.value) || 0;
    _saveSaldoAwal(val);
    Modal.close(mid);
    // Refresh balance bar
    _renderBalanceCards();
    Notify.success('Saldo awal disimpan: '+Utils.formatRupiah(val));
  }

  /* ===================== MONTH HELPERS ===================== */
  const _BULAN_FULL = {
    'Jan':'Januari','Feb':'Februari','Mar':'Maret','Apr':'April',
    'Mei':'Mei','Jun':'Juni','Jul':'Juli','Ags':'Agustus',
    'Sep':'September','Okt':'Oktober','Nov':'November','Des':'Desember'
  };
  const _BULAN_IDX = {
    'Jan':1,'Feb':2,'Mar':3,'Apr':4,'Mei':5,'Jun':6,
    'Jul':7,'Ags':8,'Sep':9,'Okt':10,'Nov':11,'Des':12
  };
  // Normalize semua variasi penulisan bulan ke kode pendek (3 huruf)
  const _BULAN_NORMALIZE = {
    'januari':'Jan','january':'Jan','jan':'Jan',
    'februari':'Feb','february':'Feb','feb':'Feb','febuari':'Feb','februri':'Feb',
    'maret':'Mar','march':'Mar','mar':'Mar',
    'april':'Apr','apr':'Apr',
    'mei':'Mei','may':'Mei',
    'juni':'Jun','june':'Jun','jun':'Jun',
    'juli':'Jul','july':'Jul','jul':'Jul',
    'agustus':'Ags','august':'Ags','ags':'Ags','aug':'Ags',
    'september':'Sep','sept':'Sep','sep':'Sep',
    'oktober':'Okt','october':'Okt','okt':'Okt','oct':'Okt',
    'november':'Nov','nov':'Nov',
    'desember':'Des','december':'Des','des':'Des','dec':'Des',
  };

  function _normalizeBulan(b) {
    if (!b) return '';
    const lower = b.toLowerCase().trim();
    return _BULAN_NORMALIZE[lower] || b;
  }

  // Extract month code from tgl (YYYY-MM-DD) → "Jan","Feb",...
  const _IDX_BULAN = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'Mei',6:'Jun',7:'Jul',8:'Ags',9:'Sep',10:'Okt',11:'Nov',12:'Des'};
  function _tglToBulan(tgl) {
    if (!tgl || tgl.length < 7) return '';
    const m = parseInt(tgl.substring(5,7));
    return _IDX_BULAN[m] || '';
  }
  // Extract "YYYY-MM" from tgl for grouping
  function _tglToYM(tgl) {
    if (!tgl || tgl.length < 7) return '';
    return tgl.substring(0,7);
  }

  function _bulanLabel(bulan) {
    // Return "Januari 2026" from bulan="Jan" using tgl data
    const full = _BULAN_FULL[bulan] || bulan;
    // Find year from actual data
    const monthIdx = _BULAN_IDX[bulan];
    const yearFromData = _kas
      .filter(r => r.bulan === bulan && r.tgl)
      .map(r => parseInt((r.tgl||'').split('-')[0]))
      .filter(y => y > 2000)
      .sort()[0];
    const year = yearFromData || new Date().getFullYear();
    return full + ' ' + year;
  }
  // Force-save current edit without validation (called by navigate() before page switch)
  function flushPendingEdit() {
    if (!_editingId) return;
    const id = _editingId;
    document.removeEventListener('click', _handleOutsideClick);
    _editingId = null;
    _doCommit(id, true); // skipValidation = true
  }

  /* ── FILL-DRAG CALLBACK (via GridSelect) ── */
  const _KAS_COL_MAP = ['','tgl','nama','type','vendor','qty','satuan','hargaSatuan','jumlah','penerima','status'];
  function _onGridFill(tblId, colIdx, srcRow, targetRows, val) {
    const tbl = document.getElementById(tblId);
    if (!tbl) return;
    const tbody = tbl.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.children);
    const key = _KAS_COL_MAP[colIdx];
    if (!key) return;
    if (key === 'jumlah') { Notify.info('Total dihitung otomatis dari qty × harga'); return; }
    const isNum = key==='qty'||key==='hargaSatuan';
    let parsed = isNum ? parseFloat(String(val).replace(/[Rp\s\u00a0.]/g,'').replace(',','.'))||0 : val;
    // Konversi tanggal display (DD-MM-YYYY) → DB format (YYYY-MM-DD)
    if (key==='tgl' && /^\d{2}-\d{2}-\d{4}$/.test(parsed)) {
      const p = parsed.split('-'); parsed = p[2]+'-'+p[1]+'-'+p[0];
    }
    let saved = 0;
    targetRows.forEach(ri => {
      const tr = rows[ri];
      const id = tr?.dataset?.id;
      const row = id ? _kas.find(r=>r.id===id) : null;
      if (!row || _kasLocked.has(id)) return;
      row[key] = parsed;
      if (key==='qty'||key==='hargaSatuan') row.jumlah = (row.qty||0)*(row.hargaSatuan||0);
      DB.saveKas({...row}).catch(()=>{});
      saved++;
    });
    if (saved) { Notify.success(saved+' baris diperbarui'); renderTransaksi(); }
  }

  function _onGridPaste(tblId, startRow, startCol, pasteRows) {
    const tbl = document.getElementById(tblId);
    if (!tbl) return;
    const tbody = tbl.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.children);
    let saved = 0;
    pasteRows.forEach((cols, ri) => {
      const tr = rows[startRow + ri];
      const id = tr?.dataset?.id;
      const row = id ? _kas.find(r=>r.id===id) : null;
      if (!row || _kasLocked.has(id)) return;
      cols.forEach((val, ci) => {
        const key = _KAS_COL_MAP[startCol + ci];
        if (!key) return;
        if (key === 'jumlah') return; // skip \u2014 computed from qty \u00d7 harga
        const isNum = key==='qty'||key==='hargaSatuan';
        let v = isNum ? parseFloat(String(val).replace(/[Rp\s\u00a0.]/g,'').replace(',','.'))||0 : val;
        if (key==='tgl' && /^\d{2}-\d{2}-\d{4}$/.test(v)) { const p=v.split('-'); v=p[2]+'-'+p[1]+'-'+p[0]; }
        row[key] = v;
      });
      row.jumlah = Math.round((row.qty||0)*(row.hargaSatuan||0));
      DB.saveKas({...row}).catch(()=>{});
      saved++;
    });
    if (saved) { Notify.success(saved+' baris di-paste'); renderTransaksi(); }
  }

  /* ===================== BELANJA PASAR DASHBOARD (inside transaksi) ===================== */
  let _bpDocs = [];
  let _bpLoaded = false;

  // Fetch fresh from DB (call on init + after confirm/delete, NOT on every renderTransaksi)
  async function _refreshBPData() {
    try { _bpDocs = await DB.getBelanjaPasar(); } catch { _bpDocs = []; }
    _bpLoaded = true;
    _updateBPBadge();
  }

  // Render cards from cached _bpDocs (sync, no DB call)
  let _bpFilterPending = false; // state filter badge merah

  function _renderBPDashboard() {
    const el = document.getElementById('kas-bp-dash');
    if (!el) return;
    if (!_bpLoaded) { _refreshBPData().then(() => _renderBPDashboard()); return; }
    const docs = _bpDocs.filter(d => d.status === 'selesai').sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    if (!docs.length) { el.innerHTML = ''; return; }

    const isAdmin = Auth.currentUser()?.role === 'superadmin' || Auth.currentUser()?.role === 'admin';

    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const _fmtShort = (ymd) => { const d=new Date(ymd); return isNaN(d)?ymd:`${d.getDate()} ${months[d.getMonth()]}`; };
    const _destColor = (dest) => {
      if (dest==='cikopo') return { c:'#059669', bg:'rgba(5,150,105,.08)', bd:'rgba(5,150,105,.3)' };
      if (dest==='supplier') return { c:'#d97706', bg:'rgba(245,158,11,.08)', bd:'rgba(245,158,11,.3)' };
      if (dest && dest.startsWith('karawang')) return { c:'#6366f1', bg:'rgba(99,102,241,.08)', bd:'rgba(99,102,241,.3)' };
      return { c:'#f59e0b', bg:'rgba(245,158,11,.1)', bd:'rgba(245,158,11,.3)' };
    };
    const _destShortLabel = (dest) => {
      if (dest==='cikopo') return 'Cikopo';
      if (dest==='supplier') return 'Supplier';
      if (dest==='karawang') return 'PS Karawang';
      if (dest && dest.startsWith('karawang|')) {
        const [, tgl, shift] = dest.split('|');
        return `Karawang ${_fmtShort(tgl)} ${shift}`;
      }
      return dest || '';
    };

    // Build { doc, cards[] } per periode
    const groups = []; // [{ doc, cards:[{dest,count,isConfirmed}] }]
    docs.forEach(d => {
      const confirmedDests = Array.isArray(d.confirmedDests) ? d.confirmedDests : [];
      const globalConfirmed = d.kasStatus === 'confirmed';
      const ki = d.kasItems || [];
      const hasPerDest = ki.some(it => !!it.dest);
      const buckets = {};
      if (hasPerDest) {
        ki.forEach(it => {
          if (!it.item) return;
          const k = it.dest || 'other';
          if (!buckets[k]) buckets[k] = { dest: k, count: 0 };
          buckets[k].count++;
        });
      } else {
        (d.items||[]).forEach(it => {
          if (!it.item) return;
          if ((it.qtyCikopo||0) > 0) { buckets.cikopo = buckets.cikopo || { dest:'cikopo', count:0 }; buckets.cikopo.count++; }
          if ((it.qtySupplier||0) > 0) { buckets.supplier = buckets.supplier || { dest:'supplier', count:0 }; buckets.supplier.count++; }
        });
        const ps = d.perShiftKarawang || {};
        Object.entries(ps).forEach(([k, list]) => {
          if (!Array.isArray(list) || !list.length) return;
          const [tgl, shift] = k.split('_');
          buckets[`karawang|${tgl}|${shift}`] = { dest: `karawang|${tgl}|${shift}`, count: list.length };
        });
        if (!Object.keys(ps).length) {
          (d.items||[]).forEach(it => {
            const qK = (it.totalQty||0) - (it.qtyCikopo||0) - (it.qtySupplier||0);
            if (qK > 0) { buckets.karawang = buckets.karawang || { dest:'karawang', count:0 }; buckets.karawang.count++; }
          });
        }
      }
      const order = (k) => k==='cikopo' ? 0 : k.startsWith('karawang') ? 1 : k==='supplier' ? 2 : 3;
      const cards = Object.keys(buckets).sort((a,b) => order(a)-order(b) || a.localeCompare(b)).map(k => ({
        dest: buckets[k].dest,
        count: buckets[k].count,
        isConfirmed: globalConfirmed || confirmedDests.includes(buckets[k].dest),
      }));
      if (cards.length) groups.push({ doc: d, cards });
    });

    const totalPending = groups.reduce((s,g) => s + g.cards.filter(c=>!c.isConfirmed).length, 0);

    // Filter mode: hanya tampilkan group yang punya pending card
    const visibleGroups = _bpFilterPending
      ? groups.filter(g => g.cards.some(c => !c.isConfirmed))
      : groups;

    // Render card chips
    const _chipHtml = (card, doc) => {
      const col = _destColor(card.dest);
      const isConf = card.isConfirmed;
      const dCode = _destCode(card.dest, doc);
      return `<div style="display:flex;flex-direction:column;gap:3px;padding:7px 11px;
        border:1px solid ${isConf?'rgba(16,185,129,.3)':col.bd};border-radius:8px;
        background:${isConf?'rgba(16,185,129,.07)':col.bg};min-width:120px;cursor:pointer;transition:.15s;flex-shrink:0"
        onclick="KasModule.openBPDetail('${doc.id}','${card.dest.replace(/'/g,"\\'")}')"
        onmouseover="this.style.opacity='.82'" onmouseout="this.style.opacity='1'">
        <div style="display:flex;align-items:baseline;gap:5px;line-height:1.2">
          <span style="font-size:11px;font-weight:700;color:${isConf?'#059669':col.c}">${_destShortLabel(card.dest)}</span>
          ${dCode?`<span style="font-size:8px;color:${isConf?'#059669':col.c};opacity:.5;font-family:var(--font-mono)">${dCode}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:10px;margin-top:1px">
          <span style="width:6px;height:6px;border-radius:50%;background:${isConf?'#10b981':col.c};flex-shrink:0;display:inline-block"></span>
          <span style="color:${isConf?'#10b981':col.c};font-weight:600">${isConf?'Terkonfirmasi':'Belum'}</span>
          <span style="margin-left:auto;color:var(--text-3)">${card.count} item</span>
        </div>
      </div>`;
    };

    // Render per-period group rows
    const groupsHtml = visibleGroups.map((g, gi) => {
      const { doc, cards } = g;
      const confCount = cards.filter(c=>c.isConfirmed).length;
      const allConf = confCount === cards.length;
      const hasPending = cards.some(c=>!c.isConfirmed);
      // Auto-expand: periode paling baru (gi===0) atau yang punya pending, collapse yang sudah selesai
      const openByDefault = gi === 0 || hasPending;
      const collapseId = `bp-group-${doc.id}`;
      const chipsHtml = cards.map(c => _chipHtml(c, doc)).join('');

      return `<div style="border:1px solid ${hasPending?'rgba(239,68,68,.2)':'var(--border)'};border-radius:10px;overflow:hidden;${hasPending?'':'opacity:.85'}">
        <!-- Period header (clickable, toggle collapse) -->
        <div onclick="(()=>{const b=document.getElementById('${collapseId}');const arr=this.querySelector('.bp-arr');if(b.style.display==='none'){b.style.display='flex';arr.textContent='▲'}else{b.style.display='none';arr.textContent='▼'}})()"
          style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;background:${hasPending?'rgba(239,68,68,.04)':'var(--surface2)'};user-select:none"
          onmouseover="this.style.background='${hasPending?'rgba(239,68,68,.08)':'var(--surface3)'}'" onmouseout="this.style.background='${hasPending?'rgba(239,68,68,.04)':'var(--surface2)'}'">
          <span style="font-size:12px;font-weight:700;color:var(--text)">${doc.periode||'-'}</span>
          <span style="font-size:10px;color:var(--text-3);margin-left:2px">${doc.tahun||''}</span>
          <span style="margin-left:auto;font-size:10px;font-weight:700;color:${allConf?'#10b981':'#ef4444'}">
            ${allConf ? '✓ Semua terkonfirmasi' : `${confCount}/${cards.length} terkonfirmasi`}
          </span>
          <span class="bp-arr" style="font-size:9px;color:var(--text-3)">${openByDefault?'▲':'▼'}</span>
        </div>
        <!-- Cards row (collapsible) -->
        <div id="${collapseId}" style="display:${openByDefault?'flex':'none'};gap:8px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid var(--border)">
          ${chipsHtml}
          ${isAdmin ? `<button onclick="event.stopPropagation();KasModule.deleteBPKas('${doc.id}')"
            style="align-self:flex-end;margin-left:auto;font-size:9px;padding:4px 10px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.06);color:#dc2626;border-radius:6px;cursor:pointer;font-weight:600;flex-shrink:0">
            Hapus Periode
          </button>` : ''}
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div style="background:var(--surface);border:1px solid rgba(8,145,178,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#0891b2">🛒 Belanja Pasar</span>
          ${totalPending > 0 ? `<button onclick="KasModule._bpToggleFilter()" style="
            border:none;padding:3px 10px;border-radius:10px;font-size:9px;font-weight:700;cursor:pointer;transition:all .15s;
            background:${_bpFilterPending?'#dc2626':'rgba(220,38,38,.1)'};color:${_bpFilterPending?'#fff':'#dc2626'};"
            title="${_bpFilterPending?'Tampilkan semua periode':'Filter: tampilkan hanya yang belum terkonfirmasi'}">
            ${totalPending} belum konfirmasi${_bpFilterPending?' ✕':''}
          </button>` : `<span style="font-size:9px;color:#10b981;font-weight:700">✓ Semua terkonfirmasi</span>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">${groupsHtml}</div>
      </div>`;
  }

  function _bpToggleFilter() {
    _bpFilterPending = !_bpFilterPending;
    _renderBPDashboard();
  }

  async function openBPDetail(docId, focusDest) {
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) return;
    const isConfirmed = doc.kasStatus === 'confirmed';
    const rp = n => n ? 'Rp '+Math.round(Number(n)).toLocaleString('id') : '-';

    // ── Generate / migrate kasItems jadi per-destinasi ──
    // Struktur baru per entry: { item, satuan, dest, destLabel, estQty, estHarga, aktQty, aktHarga, aktTotal }
    // dest: 'cikopo' | 'supplier' | `karawang|<YYYY-MM-DD>|<Shift>`
    const hasPerDest = (doc.kasItems||[]).some(it => !!it.dest);
    let items;
    if (doc.kasItems?.length && hasPerDest) {
      // Sudah punya struktur per-destinasi — pakai langsung
      items = doc.kasItems;
    } else {
      // Belum / legacy — build dari doc.items + perShiftKarawang
      const legacyByItem = {};
      (doc.kasItems||[]).forEach(ki => { legacyByItem[(ki.item||'').toLowerCase().trim()] = ki; });
      items = [];
      // 1) Cikopo (merged across dates)
      (doc.items||[]).forEach(it => {
        if (!it.item || !(it.qtyCikopo>0)) return;
        const leg = legacyByItem[it.item.toLowerCase().trim()];
        items.push({
          item: it.item, satuan: it.satuan||'',
          dest: 'cikopo', destLabel: 'Pasar Cikopo',
          estQty: it.qtyCikopo, estHarga: it.harga||0,
          aktQty: it.qtyCikopo, aktHarga: leg?.aktHarga || it.harga || 0,
          aktTotal: 0,
        });
      });
      // 2) Karawang per shift — pakai perShiftKarawang kalau ada, else merged karawang
      const ps = doc.perShiftKarawang || {};
      const psKeys = Object.keys(ps);
      if (psKeys.length) {
        psKeys.sort().forEach(k => {
          const [tgl, shift] = k.split('_');
          (ps[k]||[]).forEach(kw => {
            const leg = legacyByItem[(kw.item||'').toLowerCase().trim()];
            const label = `PS Karawang — ${_fmtTglShortDay(tgl)} ${shift}`;
            items.push({
              item: kw.item, satuan: kw.satuan||'',
              dest: `karawang|${tgl}|${shift}`, destLabel: label,
              estQty: kw.qty, estHarga: kw.harga||0,
              aktQty: kw.qty, aktHarga: leg?.aktHarga || kw.harga || 0,
              aktTotal: 0,
            });
          });
        });
      } else {
        // Fallback: karawang merged (qtyKarawang per item)
        (doc.items||[]).forEach(it => {
          const qKw = (it.totalQty||0) - (it.qtyCikopo||0) - (it.qtySupplier||0);
          if (qKw <= 0) return;
          const leg = legacyByItem[(it.item||'').toLowerCase().trim()];
          items.push({
            item: it.item, satuan: it.satuan||'',
            dest: 'karawang', destLabel: 'PS Karawang',
            estQty: qKw, estHarga: it.harga||0,
            aktQty: qKw, aktHarga: leg?.aktHarga || it.harga || 0,
            aktTotal: 0,
          });
        });
      }
      // 3) Supplier (merged)
      (doc.items||[]).forEach(it => {
        if (!it.item || !(it.qtySupplier>0)) return;
        const leg = legacyByItem[it.item.toLowerCase().trim()];
        items.push({
          item: it.item, satuan: it.satuan||'',
          dest: 'supplier', destLabel: 'Supplier',
          estQty: it.qtySupplier, estHarga: it.harga||0,
          aktQty: it.qtySupplier, aktHarga: leg?.aktHarga || it.harga || 0,
          aktTotal: 0,
        });
      });
      // Compute aktTotal
      items.forEach(it => { it.aktTotal = (Number(it.aktQty)||0) * (Number(it.aktHarga)||0); });
      doc.kasItems = items;
    }
    const aktGrandTotal = items.reduce((s,it) => s+(Number(it.aktQty)||0)*(Number(it.aktHarga)||0), 0);

    // Group items by dest untuk render
    const groups = {};
    items.forEach((it, gi) => {
      const k = it.dest || 'other';
      if (!groups[k]) groups[k] = { label: it.destLabel || k, items: [] };
      groups[k].items.push({ ...it, _gi: gi });
    });
    // Urutan section: cikopo → karawang (per shift, sorted) → supplier
    let sortedGroupKeys = Object.keys(groups).sort((a,b) => {
      const order = (k) => k==='cikopo' ? 0 : k.startsWith('karawang') ? 1 : k==='supplier' ? 2 : 3;
      return order(a) - order(b) || a.localeCompare(b);
    });
    // FILTER ke 1 section saja kalau focusDest dikasih — user klik card spesifik
    // (Cikopo / Karawang per shift / Supplier) → modal hanya tampilkan section itu
    // + tombol "Konfirmasi" per-section.
    const singleSection = !!focusDest && groups[focusDest];
    if (singleSection) sortedGroupKeys = [focusDest];
    // Status confirm per-dest (dari array doc.confirmedDests) atau global doc.kasStatus
    const confirmedDests = Array.isArray(doc.confirmedDests) ? doc.confirmedDests : [];
    const destConfirmed = focusDest ? (doc.kasStatus === 'confirmed' || confirmedDests.includes(focusDest)) : isConfirmed;
    const groupColors = (k) => {
      if (k==='cikopo') return { bg:'rgba(5,150,105,.08)', border:'rgba(5,150,105,.3)', text:'#059669' };
      if (k==='supplier') return { bg:'rgba(245,158,11,.08)', border:'rgba(245,158,11,.3)', text:'#d97706' };
      if (k.startsWith('karawang')) return { bg:'rgba(99,102,241,.08)', border:'rgba(99,102,241,.3)', text:'#6366f1' };
      return { bg:'var(--surface2)', border:'var(--border)', text:'var(--text-2)' };
    };

    // Builder section per group
    const _renderSection = (key, group) => {
      const c = groupColors(key);
      const sectionSubtotal = group.items.reduce((s,it) => s + (Number(it.aktQty)||0)*(Number(it.aktHarga)||0), 0);
      return `
        <div id="bp-kas-section-${doc.id}-${key.replace(/[|]/g,'_')}" style="margin-bottom:14px;border:1px solid ${c.border};border-radius:8px;overflow:hidden;scroll-margin-top:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:${c.bg};border-bottom:1px solid ${c.border}">
            <div style="font-size:12px;font-weight:700;color:${c.text}">📍 ${group.label}</div>
            <div style="font-size:11px;color:${c.text};font-weight:700;font-family:var(--font-mono)" id="bp-kas-sub-${doc.id}-${key.replace(/[|]/g,'_')}">${rp(sectionSubtotal)}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11.5px">
            <thead><tr style="background:var(--surface2);color:var(--text-2)">
              <th style="padding:6px 6px;font-size:9px;width:25px">#</th>
              <th style="padding:6px 6px;font-size:9px;text-align:left">ITEM</th>
              <th style="padding:6px 6px;font-size:9px;text-align:right;width:55px">EST QTY</th>
              <th style="padding:6px 6px;font-size:9px;width:40px">SAT</th>
              <th style="padding:6px 6px;font-size:9px;text-align:right;width:80px">EST HARGA</th>
              <th style="padding:6px 6px;font-size:9px;text-align:right;width:70px;color:${c.text}">AKT QTY</th>
              <th style="padding:6px 6px;font-size:9px;text-align:right;width:95px;color:${c.text}">AKT HARGA</th>
              <th style="padding:6px 6px;font-size:9px;text-align:right;width:100px;color:${c.text};background:${c.bg}">TOTAL</th>
            </tr></thead>
            <tbody>${group.items.map((it, locI) => {
              const i = it._gi; // global index in doc.kasItems
              const aktT = (Number(it.aktQty)||0)*(Number(it.aktHarga)||0);
              const estH = Number(it.estHarga)||0;
              return `<tr style="border-bottom:1px solid var(--border);${locI%2?'background:rgba(0,0,0,.012)':''}">
                <td style="padding:8px 6px;text-align:center;color:var(--text-3);font-size:10px">${locI+1}</td>
                <td style="padding:8px 6px;font-weight:600">${it.item}</td>
                <td style="padding:8px 6px;text-align:right;font-family:var(--font-mono);color:var(--text-3)">${it.estQty||'-'}</td>
                <td style="padding:8px 6px;color:var(--text-3)">${it.satuan}</td>
                <td style="padding:8px 6px;text-align:right;font-family:var(--font-mono);color:var(--text-3)">${estH?rp(estH):'-'}</td>
                <td style="padding:5px 4px;text-align:right">${(isConfirmed || confirmedDests.includes(key))
                  ? `<span style="font-family:var(--font-mono);font-weight:600;color:${c.text}">${it.aktQty}</span>`
                  : `<input type="number" min="0" step="0.5" value="${it.aktQty||0}" data-doc="${doc.id}" data-idx="${i}" data-field="aktQty"
                      onchange="KasModule._bpCellChange('${doc.id}',${i})"
                      style="width:65px;border:1px solid var(--border);border-radius:4px;padding:4px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)" onfocus="this.select()">`}</td>
                <td style="padding:5px 4px;text-align:right">${(isConfirmed || confirmedDests.includes(key))
                  ? `<span style="font-family:var(--font-mono);font-weight:600">${rp(it.aktHarga)}</span>`
                  : `<input type="text" value="${rp(it.aktHarga||0)}" data-doc="${doc.id}" data-idx="${i}" data-field="aktHarga"
                      onfocus="this.value=this.dataset.raw||${it.aktHarga||0};this.type='number';this.select()"
                      onblur="this.dataset.raw=this.value;this.type='text';this.value='Rp '+Number(this.dataset.raw||0).toLocaleString('id');KasModule._bpCellChange('${doc.id}',${i})"
                      onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();KasModule._bpFocusNextAktHarga(this);}"
                      style="width:90px;border:1px solid var(--border);border-radius:4px;padding:4px;text-align:right;font-family:var(--font-mono);font-size:11px;background:var(--surface)">`}</td>
                <td style="padding:8px 6px;text-align:right;font-family:var(--font-mono);font-weight:700;color:${c.text};background:${c.bg}" id="bp-kas-total-${doc.id}-${i}">${aktT?rp(aktT):'-'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>`;
    };

    const mid = 'bp-kas-'+Utils.uid();
    window._bpKasMid = mid;
    const sectionTitle = singleSection ? ' · ' + (groups[focusDest].label || focusDest) : '';
    Modal.open({
      id: mid,
      title: '🛒 Belanja Pasar — '+doc.periode + sectionTitle,
      size: 'modal-xl',
      body: `<style>.modal-xl{max-width:980px!important}</style>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div><span style="font-size:11px;color:var(--text-3)">Oleh: ${doc.namaPetugas||'-'}</span>
            ${(doc.selectedForms||[]).length ? `<div style="font-size:9px;color:var(--text-3);margin-top:2px">Form: ${(doc.selectedForms||[]).map(sf => sf.tanggal?.slice(5)+' '+({S1:'S1',S2:'S2&3'}[sf.shift]||sf.shift)).join(', ')}</div>` : ''}
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${isConfirmed ? `<span style="font-size:10px;background:rgba(16,185,129,.12);color:#10b981;padding:2px 8px;border-radius:10px;font-weight:700">✓ oleh ${doc.kasConfirmedBy||'-'}</span>` : ''}
            <span style="font-size:11px;color:var(--text-3)">Grand Total:</span>
            <span style="font-size:14px;font-weight:800;font-family:var(--font-mono);color:#059669" id="bp-kas-grand-${doc.id}">${rp(aktGrandTotal)}</span>
          </div>
        </div>
        <div style="max-height:62vh;overflow-y:auto;padding-right:4px">
          ${sortedGroupKeys.map(k => _renderSection(k, groups[k])).join('') || '<div style="padding:24px;text-align:center;color:var(--text-3);font-size:12px">Belum ada item di belanja pasar ini</div>'}
        </div>`,
      footer: (() => {
        const isAdmin = Auth.currentUser()?.role === 'superadmin' || Auth.currentUser()?.role === 'admin';
        // Mode SINGLE SECTION (klik card spesifik)
        if (singleSection) {
          // destConfirmed = section ini confirmed (per-section atau via global kasStatus)
          if (destConfirmed) {
            return `<span style="font-size:11px;color:#10b981;font-weight:700;margin-right:auto">✓ Section ini sudah dikonfirmasi</span>
              ${isAdmin ? `<button class="btn" onclick="KasModule.resetBPSection('${doc.id}','${String(focusDest).replace(/'/g,"\\'")}')" style="border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.05);color:#dc2626">↻ Reset Konfirmasi</button>` : ''}
              <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`;
          }
          const lbl = groups[focusDest].label || focusDest;
          return `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
            <button class="btn btn-primary" onclick="KasModule.confirmBPSection('${doc.id}','${String(focusDest).replace(/'/g,"\\'")}')" style="background:#059669;border-color:#059669">Konfirmasi ${Utils.esc(lbl)}</button>`;
        }
        // Mode GLOBAL (no focusDest) — backward compat
        const hapusBtn = isAdmin
          ? `<button class="btn" onclick="Modal.close('${mid}');KasModule.deleteBPKas('${doc.id}')"
              style="border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.05);color:#dc2626;margin-right:auto">
              Hapus dari Kas
            </button>` : '';
        if (isConfirmed) {
          return `${hapusBtn}<span style="font-size:11px;color:#10b981;font-weight:700">✓ Dikonfirmasi oleh ${Utils.esc(doc.kasConfirmedBy||'-')}</span>
            <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`;
        }
        return `${hapusBtn}<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
          <button class="btn btn-primary" onclick="KasModule.confirmBelanjaPasar('${doc.id}')" style="background:#059669;border-color:#059669">Konfirmasi Semua</button>`;
      })(),
      onOpen: () => {
        if (focusDest) {
          const key = String(focusDest).replace(/[|]/g,'_');
          const el = document.getElementById(`bp-kas-section-${doc.id}-${key}`);
          if (el) {
            el.scrollIntoView({ behavior:'smooth', block:'start' });
            // Highlight flash 1.4s
            const orig = el.style.boxShadow;
            el.style.transition = 'box-shadow .25s';
            el.style.boxShadow = '0 0 0 3px rgba(99,102,241,.35)';
            setTimeout(() => { el.style.boxShadow = orig; }, 1400);
          }
        }
      },
    });
  }

  // Helper: format YYYY-MM-DD → "1 Jun" (short)
  /**
   * Kode unik per destinasi belanja pasar — supaya kas kecil & badge bisa
   * dipersingkat tapi tetap traceable. Format:
   *   PC<YY><MM><startD><endD>      → Pasar Cikopo (range tanggal)
   *   PK<YY><MM><DD><Shift>         → PS Karawang per-shift
   *   PK<YY><MM><startD><endD>      → PS Karawang merged (fallback)
   *   SP<YY><MM><startD><endD>      → Supplier
   *
   * Contoh:
   *   Cikopo 8-10 Jun 2026  → PC2606810
   *   Karawang 8 Jun S1     → PK260608S1
   *   Supplier 8-10 Jun     → SP2606810
   */
  function _destCode(dest, doc) {
    if (!dest) return '';
    const dates = (doc && doc.dates) || [];
    const first = dates[0] || '';
    const last = dates[dates.length - 1] || first;
    const yy = first.slice(2,4);
    const mm = first.slice(5,7);
    const sd = first.slice(8,10); // 2-digit zero-padded: 02, 05, 10
    const ed = last.slice(8,10);
    if (dest === 'cikopo')   return `PC${yy}${mm}${sd}${sd!==ed?ed:''}`;
    if (dest === 'supplier') return `SP${yy}${mm}${sd}${sd!==ed?ed:''}`;
    if (dest === 'karawang') return `PK${yy}${mm}${sd}${sd!==ed?ed:''}`;
    if (dest.startsWith('karawang|')) {
      const [, tgl, shift] = dest.split('|');
      return `PK${tgl.slice(2,4)}${tgl.slice(5,7)}${tgl.slice(8,10)}${shift||''}`;
    }
    return '';
  }
  // Warna per destinasi — dipakai untuk badge di kas row + section header
  function _destStyle(dest) {
    if (dest === 'cikopo')   return { label:'Pasar Cikopo', fg:'#059669', bg:'rgba(5,150,105,.14)' };
    if (dest === 'supplier') return { label:'Supplier',     fg:'#d97706', bg:'rgba(245,158,11,.14)' };
    if (dest && dest.startsWith('karawang')) {
      let lbl = 'PS Karawang';
      if (dest.startsWith('karawang|')) {
        const [, tgl, shift] = dest.split('|');
        lbl = `PS Karawang ${_fmtTglShortDay(tgl)} ${shift||''}`.trim();
      }
      return { label:lbl, fg:'#6366f1', bg:'rgba(99,102,241,.14)' };
    }
    return { label:'Pasar', fg:'#0891b2', bg:'rgba(8,145,178,.14)' };
  }
  // Derive kode unik dari bpDest + tgl kalau bpDestCode tidak tersimpan (kas
  // rows lama yang sudah masuk sebelum field bpDestCode ada).
  function _bpCodeFallback(r) {
    if (r.bpDestCode) return r.bpDestCode;
    if (!r.bpDest || !r.tgl) return '';
    const yy = r.tgl.slice(2,4), mm = r.tgl.slice(5,7), dd = r.tgl.slice(8,10);
    if (r.bpDest === 'cikopo')   return `PC${yy}${mm}${dd}`;
    if (r.bpDest === 'supplier') return `SP${yy}${mm}${dd}`;
    if (r.bpDest === 'karawang') return `PK${yy}${mm}${dd}`;
    if (r.bpDest.startsWith('karawang|')) {
      const [, t, shift] = r.bpDest.split('|');
      return `PK${t.slice(2,4)}${t.slice(5,7)}${t.slice(8,10)}${shift||''}`;
    }
    return '';
  }
  // Badge HTML untuk kas row — kode unik bold + warna sesuai destinasi.
  // Label lengkap (mis. "PS Karawang 12 Jun S1") di-pindah ke title tooltip
  // supaya cell tidak terlalu ramai. Hover badge → tampil destLabel.
  function _bpBadge(r) {
    const s = _destStyle(r.bpDest);
    const code = _bpCodeFallback(r);
    if (!code) return ''; // tanpa kode tidak usah render badge sama sekali
    return `<span title="${s.label}" style="font-size:9px;background:${s.bg};color:${s.fg};padding:2px 7px;border-radius:5px;margin-left:5px;font-weight:700;letter-spacing:.02em;font-family:var(--font-mono);vertical-align:middle;line-height:1.3">${code}</span>`;
  }

  function _fmtTglShortDay(ymd) {
    if (!ymd) return '';
    const d = new Date(ymd);
    if (isNaN(d)) return ymd;
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    return d.getDate() + ' ' + months[d.getMonth()];
  }

  function _bpCellChange(docId, idx) {
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) return;
    if (!doc.kasItems?.length) {
      doc.kasItems = (doc.items||[]).filter(it=>it.item).map(it => ({
        item: it.item, satuan: it.satuan||'', estQty: it.totalQty||0, estHarga: it.harga||0, aktQty: it.totalQty||0, aktHarga: it.harga||0, aktTotal: (it.totalQty||0)*(it.harga||0)
      }));
    }
    const it = doc.kasItems[idx]; if (!it) return;
    const qtyInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${idx}"][data-field="aktQty"]`);
    const hrgInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${idx}"][data-field="aktHarga"]`);
    if (qtyInp) it.aktQty = parseFloat(qtyInp.value)||0;
    if (hrgInp) it.aktHarga = parseFloat(hrgInp.dataset.raw||(()=>{const s=hrgInp.value.replace(/[Rp\s]/g,'');return /^\d+\.\d{3}/.test(s)?s.replace(/\./g,''):s})()||0)||0;
    it.aktTotal = it.aktQty * it.aktHarga;
    const rp = n => n?'Rp '+Math.round(Number(n)).toLocaleString('id'):'-';
    const tEl = document.getElementById(`bp-kas-total-${docId}-${idx}`);
    if (tEl) tEl.textContent = rp(it.aktTotal);
    const gEl = document.getElementById(`bp-kas-grand-${docId}`);
    if (gEl) gEl.textContent = rp(doc.kasItems.reduce((s,i)=>s+(Number(i.aktQty)||0)*(Number(i.aktHarga)||0),0));
    // Update section subtotal (kalau struktur per-destinasi)
    if (it.dest) {
      const sectionKey = (it.dest||'').replace(/[|]/g,'_');
      const subEl = document.getElementById(`bp-kas-sub-${docId}-${sectionKey}`);
      if (subEl) {
        const subTotal = doc.kasItems.filter(x => x.dest === it.dest).reduce((s,i)=>s+(Number(i.aktQty)||0)*(Number(i.aktHarga)||0),0);
        subEl.textContent = rp(subTotal);
      }
    }
    DB.saveBelanjaPasar(doc).catch(()=>{});
  }

  async function confirmBelanjaPasar(docId) {
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) return;
    if (doc.kasStatus === 'confirmed') { Notify.info('Sudah dikonfirmasi'); return; }
    const cu = Auth.currentUser();
    const ok = await Modal.confirm({
      title: 'Konfirmasi Belanja Pasar',
      message: `<p>Data <strong>AKT QTY</strong> dan <strong>AKT Harga</strong> sudah benar?</p>
        <p style="margin-top:8px;color:#f59e0b;font-weight:600">⚠ Data akan masuk ke transaksi kas kecil dan diteruskan ke Inventory.</p>`,
      confirmText: 'Ya, Konfirmasi',
    });
    if (!ok) return;
    if (!doc.kasItems?.length) {
      doc.kasItems = (doc.items||[]).filter(it=>it.item).map(it => ({
        item: it.item, satuan: it.satuan||'', estQty: it.totalQty||0, estHarga: it.harga||0, aktQty: it.totalQty||0, aktHarga: it.harga||0, aktTotal: (it.totalQty||0)*(it.harga||0)
      }));
    }
    // Read latest DOM values
    doc.kasItems.forEach((it, i) => {
      const qtyInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${i}"][data-field="aktQty"]`);
      const hrgInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${i}"][data-field="aktHarga"]`);
      if (qtyInp) it.aktQty = parseFloat(qtyInp.value)||0;
      if (hrgInp) it.aktHarga = parseFloat(hrgInp.dataset.raw||(()=>{const s=hrgInp.value.replace(/[Rp\s]/g,'');return /^\d+\.\d{3}/.test(s)?s.replace(/\./g,''):s})()||0)||0;
      it.aktTotal = it.aktQty * it.aktHarga;
    });
    doc.kasStatus = 'confirmed';
    doc.kasConfirmedAt = new Date().toISOString();
    doc.kasConfirmedBy = cu?.nama || cu?.username || '-';
    try {
      await DB.saveBelanjaPasar(doc);
      // Auto-insert kas kecil rows for each item with aktQty > 0
      const today = new Date().toISOString().slice(0,10);
      let inserted = 0;
      // Vendor per destinasi supaya analisis kas per-pasar lebih granular.
      const _vendorOf = (dest) => {
        if (!dest) return 'Pasar';
        if (dest === 'cikopo') return 'Pasar Cikopo';
        if (dest === 'supplier') return 'Supplier';
        if (dest === 'karawang') return 'PS Karawang';
        if (dest.startsWith('karawang|')) {
          const [, tgl, shift] = dest.split('|');
          return `PS Karawang (${_fmtTglShortDay(tgl)} ${shift})`;
        }
        return 'Pasar';
      };
      for (const it of doc.kasItems) {
        if (!it.aktQty || !it.aktHarga) continue;
        const row = {
          tgl: today, nama: it.item, type: 'Belanja Pasar',
          vendor: _vendorOf(it.dest), qty: it.aktQty, satuan: it.satuan||'',
          hargaSatuan: it.aktHarga, jumlah: it.aktTotal,
          penerima: doc.namaPetugas||'-', status: 'DONE',
          bpDocId: doc.id, // link back to belanja pasar
          bpDest: it.dest || null,
          bpDestCode: _destCode(it.dest, doc),
        };
        try { await DB.saveKas(row); _kas.unshift(row); inserted++; } catch {}
      }
      if (window._bpKasMid) Modal.close(window._bpKasMid);
      Notify.success(`Dikonfirmasi + ${inserted} item masuk kas kecil`);
      _renderBPDashboard();
      renderTransaksi();
      DB.logActivity({type:'confirm_belanja_pasar', detail:`Konfirmasi ${doc.periode}: ${inserted} item → kas kecil`});
    } catch(e) { Notify.error('Gagal: '+(e.message||'')); }
  }

  /**
   * Konfirmasi 1 SECTION saja (Cikopo / Karawang per shift / Supplier).
   * Items dari section lain di doc yang sama tetap pending — bisa dikonfirmasi
   * terpisah nanti. Kas rows hanya dibuat untuk items dengan dest sesuai.
   * doc.confirmedDests menyimpan array dest yang sudah dikonfirmasi.
   * Kalau semua dest sudah confirmed → otomatis set doc.kasStatus='confirmed'.
   */
  async function confirmBPSection(docId, dest) {
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) return;
    if (doc.kasStatus === 'confirmed') { Notify.info('Sudah dikonfirmasi global'); return; }
    doc.confirmedDests = Array.isArray(doc.confirmedDests) ? doc.confirmedDests : [];
    if (doc.confirmedDests.includes(dest)) { Notify.info('Section ini sudah dikonfirmasi'); return; }
    const cu = Auth.currentUser();
    // Resolve label dari kasItems
    const sectionItems = (doc.kasItems||[]).filter(it => it.dest === dest);
    if (!sectionItems.length) { Notify.warning('Section ini tidak punya item'); return; }
    const label = sectionItems[0].destLabel || dest;
    const ok = await Modal.confirm({
      title: 'Konfirmasi ' + label,
      message: `<p>Data <strong>AKT QTY</strong> dan <strong>AKT Harga</strong> untuk <strong>${Utils.esc(label)}</strong> sudah benar?</p>
        <p style="margin-top:8px;color:#f59e0b;font-weight:600">⚠ Section ini akan dibuat baris kas kecil terpisah. Section lain tetap pending.</p>`,
      confirmText: 'Ya, Konfirmasi',
    });
    if (!ok) return;
    // Read latest DOM values untuk items section ini saja
    sectionItems.forEach(it => {
      const i = doc.kasItems.indexOf(it);
      const qtyInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${i}"][data-field="aktQty"]`);
      const hrgInp = document.querySelector(`input[data-doc="${docId}"][data-idx="${i}"][data-field="aktHarga"]`);
      if (qtyInp) it.aktQty = parseFloat(qtyInp.value)||0;
      if (hrgInp) it.aktHarga = parseFloat(hrgInp.dataset.raw||(()=>{const s=hrgInp.value.replace(/[Rp\s]/g,'');return /^\d+\.\d{3}/.test(s)?s.replace(/\./g,''):s})()||0)||0;
      it.aktTotal = it.aktQty * it.aktHarga;
    });
    doc.confirmedDests.push(dest);
    doc.kasConfirmedBy = cu?.nama || cu?.username || '-';
    doc.kasConfirmedAt = new Date().toISOString();
    // Vendor per destinasi
    const _vendorOf = (d) => {
      if (!d) return 'Pasar';
      if (d === 'cikopo') return 'Pasar Cikopo';
      if (d === 'supplier') return 'Supplier';
      if (d === 'karawang') return 'PS Karawang';
      if (d.startsWith('karawang|')) {
        const [, tgl, shift] = d.split('|');
        return `PS Karawang (${_fmtTglShortDay(tgl)} ${shift})`;
      }
      return 'Pasar';
    };
    // Cek apakah SEMUA dest sudah confirmed → set global kasStatus
    const allDests = [...new Set((doc.kasItems||[]).map(it => it.dest).filter(Boolean))];
    if (allDests.every(d => doc.confirmedDests.includes(d))) {
      doc.kasStatus = 'confirmed';
    }
    try {
      await DB.saveBelanjaPasar(doc);
      // Insert kas rows HANYA untuk section ini
      const today = new Date().toISOString().slice(0,10);
      let inserted = 0;
      const destCode = _destCode(dest, doc);
      for (const it of sectionItems) {
        if (!it.aktQty || !it.aktHarga) continue;
        const row = {
          tgl: today, nama: it.item, type: 'Belanja Pasar',
          vendor: _vendorOf(dest), qty: it.aktQty, satuan: it.satuan||'',
          hargaSatuan: it.aktHarga, jumlah: it.aktTotal,
          penerima: doc.namaPetugas||'-', status: 'DONE',
          bpDocId: doc.id, bpDest: dest, bpDestCode: destCode,
        };
        try { await DB.saveKas(row); _kas.unshift(row); inserted++; } catch {}
      }
      if (window._bpKasMid) Modal.close(window._bpKasMid);
      Notify.success(`${label} dikonfirmasi · ${inserted} item masuk kas`);
      _renderBPDashboard();
      renderTransaksi();
      DB.logActivity({type:'confirm_belanja_pasar', detail:`Konfirmasi ${label} (${doc.periode}): ${inserted} item → kas`});
    } catch(e) { Notify.error('Gagal: '+(e.message||'')); }
  }

  /**
   * Reset konfirmasi 1 section — hapus dari doc.confirmedDests +
   * delete kas rows dengan bpDocId+bpDest matching.
   * Admin only. Untuk recovery kalau konfirmasi salah / kas rows tidak masuk.
   */
  /**
   * Enter pada AKT HARGA → fokus ke AKT HARGA baris berikutnya di SECTION
   * yang sama. Speed up entry banyak baris berturut-turut (mode admin
   * input harga aktual setelah belanja).
   * Pakai querySelector all dari semua input aktHarga visible di modal,
   * cari yang current → fokus index+1. Wrap-around tidak (di akhir →
   * blur saja, tidak loncat ke section lain).
   */
  function _bpFocusNextAktHarga(curInput) {
    if (!curInput) return;
    const modal = curInput.closest('.modal');
    if (!modal) return;
    // Ambil semua aktHarga input di MODAL (semua section yang sedang tampil)
    const all = Array.from(modal.querySelectorAll('input[data-field="aktHarga"]'));
    const i = all.indexOf(curInput);
    if (i < 0 || i >= all.length - 1) return; // tidak ada next
    const next = all[i + 1];
    if (next) {
      next.focus();
      // .select() akan otomatis jalan via onfocus handler yg ada
    }
  }

  async function resetBPSection(docId, dest) {
    const role = Auth.currentUser()?.role;
    if (role !== 'superadmin' && role !== 'admin') { Notify.warning('Hanya Admin/Superadmin'); return; }
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) return;
    const sLabel = _destStyle(dest).label;
    // Cari kas rows untuk section ini. Untuk doc lama yang confirm global tapi
    // kas rows tidak punya bpDest field, fallback by bpDocId + name match.
    let linkedKas = _kas.filter(r => r.bpDocId === docId && r.bpDest === dest);
    if (!linkedKas.length && doc.kasStatus === 'confirmed') {
      // Kas rows mungkin ada tapi tanpa bpDest (legacy confirm). Match by item name
      // yang ada di section ini.
      const sectionNames = new Set((doc.kasItems||[]).filter(it => it.dest === dest).map(it => (it.item||'').toLowerCase().trim()));
      linkedKas = _kas.filter(r => r.bpDocId === docId && !r.bpDest && sectionNames.has((r.nama||'').toLowerCase().trim()));
    }
    const ok = await Modal.confirm({
      title: 'Reset Konfirmasi Section',
      message: `<p>Reset <strong>${Utils.esc(sLabel)}</strong> ke "Belum Konfirmasi"?</p>
        ${linkedKas.length ? `<p style="color:#ef4444;font-weight:600;margin-top:8px">⚠ ${linkedKas.length} baris kas terkait akan dihapus.</p>` : '<p style="margin-top:8px;color:var(--text-3);font-size:11px">Tidak ada baris kas yang terkait — hanya reset flag konfirmasi.</p>'}`,
      danger: true, confirmText: 'Reset',
    });
    if (!ok) return;
    // Delete kas rows untuk section ini
    for (const r of linkedKas) {
      try { await DB.deleteKas(r.id); _kas = _kas.filter(k => k.id !== r.id); } catch {}
    }
    // Migrate dari global-confirm ke per-section: kalau kasStatus='confirmed'
    // tapi confirmedDests kosong, isi confirmedDests dengan SEMUA dest dulu,
    // lalu remove yang di-reset. Hasil: dest yang di-reset jadi pending,
    // sisanya tetap confirmed via array.
    const allDests = [...new Set((doc.kasItems||[]).map(it => it.dest).filter(Boolean))];
    if (doc.kasStatus === 'confirmed' && !(doc.confirmedDests||[]).length) {
      doc.confirmedDests = [...allDests];
    }
    doc.confirmedDests = (doc.confirmedDests||[]).filter(d => d !== dest);
    // Reset global kasStatus karena ada section yang sekarang pending
    doc.kasStatus = null;
    doc.kasConfirmedAt = null;
    try { await DB.saveBelanjaPasar(doc); } catch {}
    if (window._bpKasMid) Modal.close(window._bpKasMid);
    Notify.success(`Reset ${sLabel} · ${linkedKas.length} baris kas dihapus`);
    _renderBPDashboard();
    renderTransaksi();
    DB.logActivity({type:'reset_bp_section', detail:`Reset ${sLabel} (${doc.periode}): ${linkedKas.length} kas dihapus`});
  }

  /**
   * Recovery helper — reset SEMUA section di doc kecuali yang di-keep.
   * Dipakai untuk perbaikan batch dari console:
   *   KasModule._resetSectionsExcept('<docId>', ['cikopo'])
   */
  async function _resetSectionsExcept(docId, keepDests = []) {
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) { console.warn('Doc not found'); return; }
    const allDests = [...new Set((doc.kasItems||[]).map(it => it.dest).filter(Boolean))];
    // Migrate global-confirm → per-section dulu
    if (doc.kasStatus === 'confirmed' && !(doc.confirmedDests||[]).length) {
      doc.confirmedDests = [...allDests];
    }
    const toReset = allDests.filter(d => !keepDests.includes(d));
    console.log('Will reset:', toReset);
    let totalDeleted = 0;
    for (const d of toReset) {
      let linkedKas = _kas.filter(r => r.bpDocId === docId && r.bpDest === d);
      // Fallback by item name kalau bpDest field belum di-set di kas row lama
      if (!linkedKas.length) {
        const sectionNames = new Set((doc.kasItems||[]).filter(it => it.dest === d).map(it => (it.item||'').toLowerCase().trim()));
        linkedKas = _kas.filter(r => r.bpDocId === docId && !r.bpDest && sectionNames.has((r.nama||'').toLowerCase().trim()));
      }
      for (const r of linkedKas) {
        try { await DB.deleteKas(r.id); _kas = _kas.filter(k => k.id !== r.id); totalDeleted++; } catch {}
      }
      doc.confirmedDests = (doc.confirmedDests||[]).filter(x => x !== d);
      console.log(`Reset ${d} — ${linkedKas.length} kas rows deleted`);
    }
    // Reset global kasStatus krn ada section pending
    doc.kasStatus = null;
    doc.kasConfirmedAt = null;
    try { await DB.saveBelanjaPasar(doc); } catch {}
    _renderBPDashboard();
    renderTransaksi();
    Notify.success(`Reset ${toReset.length} section · ${totalDeleted} kas dihapus`);
  }

  async function deleteBPKas(docId) {
    const role = Auth.currentUser()?.role;
    if (role !== 'superadmin' && role !== 'admin') { Notify.warning('Hanya Admin/Superadmin'); return; }
    if (!_bpDocs.length) { try { _bpDocs = await DB.getBelanjaPasar(); } catch {} }
    const doc = _bpDocs.find(d => d.id === docId);
    if (!doc) { Notify.warning('Data tidak ditemukan'); return; }
    const linkedKas = _kas.filter(r => r.bpDocId === docId);
    const ok = await Modal.confirm({
      title: 'Hapus Belanja Pasar dari Kas',
      message: `<p>Hapus <strong>🛒 ${doc.periode||'-'}</strong> dari kas kecil?</p>
        ${linkedKas.length ? `<p style="margin-top:8px;color:#ef4444;font-weight:600">⚠ ${linkedKas.length} baris transaksi kas terkait juga akan dihapus.</p>` : ''}
        <p style="margin-top:8px">Card akan hilang dari kas. Form belanja pasar dikembalikan ke status draft di PO.</p>`,
      danger: true, confirmText: 'Hapus dari Kas',
    });
    if (!ok) return;
    // Delete linked kas rows
    for (const r of linkedKas) {
      try { await DB.deleteKas(r.id); _kas = _kas.filter(k=>k.id!==r.id); } catch {}
    }
    // Reset ALL status — return to draft so it disappears from kas dashboard
    doc.status = 'draft';
    doc.kasStatus = null; doc.kasConfirmedAt = null; doc.kasConfirmedBy = null; doc.kasItems = null;
    doc.invSyncStatus = null; doc.invSyncedAt = null; doc.invSyncedBy = null;
    try { await DB.saveBelanjaPasar(doc); } catch {}
    // Remove from local cache
    _bpDocs = _bpDocs.filter(d => d.id !== docId || d.status !== 'selesai');
    Notify.success('Belanja pasar dihapus dari kas');
    _renderBPDashboard();
    renderTransaksi();
    _updateBPBadge();
  }

  return { init, switchTab, setFilter, resetFilter, getCurrentFilter, applySavedFilter, toggleSearch, goPage, setPerPage, addRow, startEdit, commitEdit, commitAndAddRow, cancelEdit, _rowKeyDown, unlockKasRow, _onNamaInput, _selectNamaSuggestion, _calcTotal, deleteRow, _bulkToggle, _bulkToggleAll, _bulkDelete, _bulkClear, reArrange, reClassifyTypes, renderSummary, renderMonthlyTable, importExcel, exportCSV, printPDF, printMonthly, toggleAnomalyDetail, goToAnomaly, _renderBalanceCards, openKasMasukModal, _filterKasMasuk, filterKasMasukType, filterByStatus, editSaldoAwal, _saveSaldoAwalModal, openSaldoAwalSnapshot, _saveSaldoAwalSnapshot: _saveSaldoAwalSnapshotHandler, _resetSaldoAwalSnapshot: _resetSaldoAwalSnapshotHandler, flushPendingEdit, openBPDetail, confirmBelanjaPasar, confirmBPSection, resetBPSection, _resetSectionsExcept, _bpCellChange, _bpFocusNextAktHarga, deleteBPKas, _bpToggleFilter, _openAnggaranPicker, _selectAnggaran, _unlinkAnggaran, _applySuggestedAnggaran, _setSearchDebounced, _onSearchTyping, _openCategoryDetail };
})();
window.KasModule = KasModule;
