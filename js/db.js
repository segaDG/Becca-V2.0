/* ============================================================
   BECCA V2.0 — DB Module (Supabase Backend)
   Realtime sync antar semua device dan user
   ============================================================ */

const DB = (() => {
  'use strict';

  // ── Supabase client ────────────────────────────────────────
  let _sb          = null;   // supabase client instance
  let _ready       = false;
  let _initPromise = null;   // singleton — prevents concurrent SDK loads
  let _realtimeSubs = [];
  let _realtimeChannels = new Set(); // track active channel names to prevent duplicates

  // ── Supabase config (otomatis semua device) ──
  // URL & key di-embed langsung agar tidak perlu setup manual
  // Aman karena BECCA punya auth layer sendiri + RLS disabled via app logic
  const _SUPA_URL = 'https://pevwkyrsfpmzhwxkoask.supabase.co';
  const _SUPA_KEY_PARTS = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.',
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldndreXJzZnBtemh3',
    'eGtvYXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTg0MTE',
    'sImV4cCI6MjA4ODI3NDQxMX0',
    '.725qbv0LxRBqic3qa1utj1N7REZMMSrnBnktxNmeZtc'
  ];

  function _getConfig() {
    try {
      // Cek jika ada override di localStorage (untuk testing / ganti key)
      const url = localStorage.getItem('becca_supabase_url') || _SUPA_URL;
      const key = localStorage.getItem('becca_supabase_key') || _SUPA_KEY_PARTS.join('');
      return { url, key };
    } catch { return { url: _SUPA_URL, key: _SUPA_KEY_PARTS.join('') }; }
  }

  async function _initClient() {
    // Fast path: already connected
    if (_sb) return _sb;
    // Singleton: if init is already in flight, wait for it — prevents concurrent SDK loads
    if (!_initPromise) {
      _initPromise = (async () => {
        const cfg = _getConfig();
        if (!cfg.url || !cfg.key) {
          console.warn('[DB] Supabase not configured — falling back to localStorage');
          return null;
        }
        try {
          // Load SDK hanya sekali — kalau sudah ada di window, skip
          if (!window.supabase) {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
              s.onload = resolve;
              s.onerror = reject;
              document.head.appendChild(s);
            });
          }
          _sb    = window.supabase.createClient(cfg.url, cfg.key);
          _ready = true;
          console.log('[DB] Supabase connected ✓');
          return _sb;
        } catch(e) {
          console.error('[DB] Supabase init failed:', e.message);
          _initPromise = null;  // allow retry on transient failure
          return null;
        }
      })();
    }
    return _initPromise;
  }

  // ── REALTIME subscription ─────────────────────────────────
  function subscribe(table, callback) {
    const chName = 'becca_' + table;
    if (_realtimeChannels.has(chName)) return; // prevent duplicate subscriptions
    _realtimeChannels.add(chName);
    _initClient().then(sb => {
      if (!sb) { _realtimeChannels.delete(chName); return; }
      const sub = sb
        .channel(chName)
        .on('postgres_changes',
          { event: '*', schema: 'public', table },
          payload => callback(payload)
        )
        .subscribe();
      _realtimeSubs.push(sub);
    });
  }

  function unsubscribeAll() {
    if (!_sb) return;
    _realtimeSubs.forEach(s => _sb.removeChannel(s));
    _realtimeSubs = [];
    _realtimeChannels.clear();
  }

  // ── HELPERS ────────────────────────────────────────────────
  // Normalize: Supabase pakai snake_case, BECCA pakai camelCase + jsonb data field
  function _toRow(table, obj) {
    if (!obj) return obj;
    // Simpan semua field ke kolom 'data' sebagai jsonb backup
    // Field utama yang ada kolomnya tetap di root
    const row = { ...obj, data: obj };
    return row;
  }

  function _fromRow(row) {
    if (!row) return null;
    const merged = {};
    // 1. Copy native columns dulu (termasuk snake_case seperti harga_satuan)
    Object.entries(row).forEach(([k, v]) => {
      if (k === 'data') return;
      if (v !== null && v !== undefined) merged[k] = v;
    });
    // 2. Override dengan data JSON — JSON adalah source of truth untuk business data
    // Mencegah native column default (0, '') menimpa nilai benar dari JSON
    if (row.data) {
      try {
        const base = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        Object.assign(merged, base);
      } catch {}
    }
    merged.data = undefined;

    // Normalize: tambah alias camelCase untuk field yang dipakai BECCA
    if (merged.nama && !merged.namaPerusahaan) merged.namaPerusahaan = merged.nama;
    if (merged.namaPerusahaan && !merged.nama) merged.nama = merged.namaPerusahaan;
    if (merged.telepon && !merged.noHp) merged.noHp = merged.telepon;
    if (merged.no_hp && !merged.noHp) merged.noHp = merged.no_hp;
    if (merged.jenis_pelayanan && !merged.jenisPelayanan) merged.jenisPelayanan = merged.jenis_pelayanan;
    if (merged.harga_per_pax && !merged.hargaPerPax) merged.hargaPerPax = merged.harga_per_pax;
    if (merged.biaya_box !== undefined && merged.biayaBox === undefined) merged.biayaBox = merged.biaya_box;
    if (merged.biaya_lainnya !== undefined && merged.biayaLainnya === undefined) merged.biayaLainnya = merged.biaya_lainnya;
    if (merged.qty_lauk !== undefined && merged.qtyLauk === undefined) merged.qtyLauk = merged.qty_lauk;
    if (merged.qty_pendamping !== undefined && merged.qtyPendamping === undefined) merged.qtyPendamping = merged.qty_pendamping;
    if (merged.harga_shift1 !== undefined && merged.hargaShift1 === undefined) merged.hargaShift1 = merged.harga_shift1;
    if (merged.harga_ot1 !== undefined && merged.hargaOT1 === undefined) merged.hargaOT1 = merged.harga_ot1;
    if (merged.customer_id && !merged.customerId) merged.customerId = merged.customer_id;
    if (merged.created_at && !merged.createdAt) merged.createdAt = merged.created_at;
    if (merged.updated_at && !merged.updatedAt) merged.updatedAt = merged.updated_at;
    // Employee fields
    if (merged.tgl_join && !merged.tglJoin) merged.tglJoin = merged.tgl_join;
    if (merged.tgl_lahir && !merged.tglLahir) merged.tglLahir = merged.tgl_lahir;
    if (merged.nama_panggil && !merged.namaPanggil) merged.namaPanggil = merged.nama_panggil;
    if (merged.sisa_hutang !== undefined && merged.sisaHutang === undefined) merged.sisaHutang = merged.sisa_hutang;
    if (merged.gaji_awal !== undefined && merged.gajiAwal === undefined) merged.gajiAwal = merged.gaji_awal;
    if (merged.no_ktp && !merged.noKtp) merged.noKtp = merged.no_ktp;
    if (merged.tempat_lahir && !merged.tempatLahir) merged.tempatLahir = merged.tempat_lahir;
    if (merged.employee_id && !merged.employeeId) merged.employeeId = merged.employee_id;
    // NIK - strip .0 dari float
    if (merged.nik !== undefined && merged.nik !== null) merged.nik = String(merged.nik).replace(/\.0$/, '');

    // Parse column_prices jika string
    if (merged.column_prices && typeof merged.column_prices === 'string') {
      try { merged.columnPrices = JSON.parse(merged.column_prices); } catch {}
    } else if (merged.column_prices) {
      merged.columnPrices = merged.column_prices;
    }

    return merged;
  }

  function _fromRows(rows) {
    return (rows || []).map(_fromRow);
  }

  // ── Generic CRUD dengan fallback ke localStorage ───────────
  // Table yang tidak punya created_at column
  const NO_CREATED_AT = ['settings', 'presence', 'activity_logs', 'opname_logs'];

  // Table yang tidak punya updated_at column
  const NO_UPDATED_AT = ['activity_logs', 'opname_logs', 'emp_logs', 'kas', 'kas_masuk', 'emp_absensi', 'emp_payroll', 'emp_jadwal'];

  // Table yang TIDAK dicache di localStorage (selalu fetch fresh dari Supabase)
  // invoices masuk NO_CACHE agar skeleton rows dari Supabase tidak overwrite
  // seed data yang valid di localStorage
  const NO_CACHE = ['customers','users','tasks','suppliers','ap','invoices'];

  // Kolom NOT NULL di Supabase yang wajib disertakan dalam minimal upsert
  // Key = nama kolom Supabase, value = fungsi yang mengambil nilai dari obj BECCA
  const REQUIRED_COLS = {
    tasks:          (obj) => ({ title:       obj.judul       || obj.title       || '' }),
    ap:             (obj) => ({ supplier_id: obj.supplier_id || obj.supplier    || obj.vendor || '' }),
    customers:      (obj) => ({ nama:        obj.nama        || obj.namaPerusahaan || '' }),
    suppliers:      (obj) => ({ nama:        obj.nama        || obj.namaPerusahaan || '' }),
    employees:      (obj) => ({ nama:        obj.nama        || '' }),
    inv_activities: (obj) => ({ nama:        obj.itemNama    || obj.nama          || '' }),
    inv_products:   (obj) => ({ nama:        obj.nama        || obj.itemNama      || '' }),
    // users: semua kolom NOT NULL di tabel Supabase wajib disertakan
    users: (obj) => ({
      username: obj.username || '',
      password: obj.password || obj._pw || '',
      nama:     obj.nama     || obj.namaLengkap || obj.username || '',
      role:     obj.role     || 'operator',
    }),
    // invoices: periode_dari & periode_sampai adalah tipe DATE di Supabase
    // Kirim hanya jika ada nilai valid — string kosong '' invalid untuk DATE
    invoices: (obj) => {
      const r = {};
      const dari   = obj.dari   || obj.periode_dari   || '';
      const sampai = obj.sampai || obj.periode_sampai || '';
      if (dari)   r.periode_dari   = dari;
      if (sampai) r.periode_sampai = sampai;
      return r;
    },
  };

  // In-memory cache — cleared on save/delete
  const _memCache = {};
  const _CACHE_TTL = 300000; // 5 menit

  // Fetch semua baris dengan auto-pagination (Supabase max_rows=1000 per request)
  async function _fetchAll(sb, table) {
    const PAGE = 1000;
    let all = [], from = 0;
    const needOrder = !NO_CREATED_AT.includes(table);
    while (true) {
      let q = sb.from(table).select('*').range(from, from + PAGE - 1);
      if (needOrder) q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) { console.warn('[DB] fetchAll ' + table + ':', error.message); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  async function _get(table) {
    const sb = await _initClient();
    if (!sb) return _lsGet(table);

    // Cek memory cache dulu
    const cached = _memCache[table];
    if (cached && (Date.now() - cached.ts) < _CACHE_TTL) {
      return cached.data;
    }

    const data = await _fetchAll(sb, table);
    let result = _fromRows(data);

    // PENTING: Jika Supabase kosong tapi localStorage punya data,
    // pakai localStorage (data belum dimigrasi) dan jangan overwrite
    if (result.length === 0) {
      const lsData = JSON.parse(localStorage.getItem('becca_' + table) || '[]');
      if (Array.isArray(lsData) && lsData.length > 0) {
        console.log('[DB] ' + table + ': Supabase kosong, pakai localStorage (' + lsData.length + ' rows)');
        return Promise.resolve(lsData);
      }
    }

    // Cache ke localStorage hanya untuk table non-realtime
    if (result.length > 0 && !NO_CACHE.includes(table)) {
      try { localStorage.setItem('becca_' + table, JSON.stringify(result)); } catch {}
    }

    // Untuk NO_CACHE tables: merge item localStorage yang belum tersync ke Supabase.
    // Hanya merge item yang punya _ls_saved_at dalam 24 jam terakhir —
    // mencegah item lama (yang sudah dihapus di device lain) muncul kembali.
    if (NO_CACHE.includes(table)) {
      try {
        const lsData  = JSON.parse(localStorage.getItem('becca_' + table) || '[]');
        const supaIds = new Set(result.map(r => r.id));
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const pending = lsData.filter(r => {
          if (!r.id || supaIds.has(r.id)) return false;
          // Hanya include item yang baru disimpan (< 24 jam) — item lama/tanpa
          // timestamp dianggap stale/deleted dan dibuang dari merge
          const age = r._ls_saved_at ? (Date.now() - r._ls_saved_at) : Infinity;
          return age < ONE_DAY;
        });
        if (pending.length) result = [...pending, ...result];
      } catch {}
    }

    // Simpan ke memory cache SETELAH merge LS agar hasil konsisten
    _memCache[table] = { ts: Date.now(), data: result };

    return result;
  }

  function _invalidateCache(table) {
    delete _memCache[table];
  }

  // Kembalikan data dari memCache jika masih fresh, null jika sudah expired/belum ada
  // Dipakai oleh modul untuk progressive loading (render langsung jika cache warm)
  function getCached(table) {
    const c = _memCache[table];
    return (c && (Date.now() - c.ts) < _CACHE_TTL) ? c.data : null;
  }

  async function _save(table, obj) {
    const sb = await _initClient();
    if (!sb) return _lsSave(table, obj);

    if (!obj.id) obj.id = Utils.uid();
    obj.updated_at = new Date().toISOString();

    // Pre-save ke localStorage + invalidate cache SEBELUM Supabase call
    // agar data tidak hilang jika user navigasi saat request masih in-flight
    _invalidateCache(table);
    // Tag waktu pre-save untuk NO_CACHE tables — dipakai di merge expiry (_get)
    if (NO_CACHE.includes(table) && !obj._ls_saved_at) obj._ls_saved_at = Date.now();
    _lsSave(table, obj);

    // Guard khusus employees: jika save tidak membawa foto (fotoUrl/ktpUrl),
    // merge dari sumber tercepat yang tersedia — mencegah foto terhapus oleh save parsial.
    if (table === 'employees' && obj.id) {
      const hasFoto = obj.fotoUrl && String(obj.fotoUrl).startsWith('data:');
      const hasKtp  = obj.ktpUrl  && String(obj.ktpUrl).startsWith('data:');
      if (!hasFoto || !hasKtp) {
        // 1. Coba localStorage dulu (sync, 0ms network)
        try {
          const lsArr = JSON.parse(localStorage.getItem('becca_employees') || '[]');
          const lsEmp = Array.isArray(lsArr) ? lsArr.find(e => e.id === obj.id) : null;
          if (lsEmp) {
            if (!hasFoto && lsEmp.fotoUrl?.startsWith('data:')) obj.fotoUrl = lsEmp.fotoUrl;
            if (!hasKtp  && lsEmp.ktpUrl?.startsWith('data:'))  obj.ktpUrl  = lsEmp.ktpUrl;
          }
        } catch {}
        // 2. Hanya hit Supabase jika LS juga tidak punya foto (misal device baru)
        const stillNoFoto = !obj.fotoUrl?.startsWith('data:');
        const stillNoKtp  = !obj.ktpUrl?.startsWith('data:');
        if (stillNoFoto || stillNoKtp) {
          try {
            const { data: existRow } = await sb.from('employees').select('data').eq('id', obj.id).maybeSingle();
            if (existRow) {
              const exist = typeof existRow.data === 'string' ? JSON.parse(existRow.data) : (existRow.data || {});
              if (stillNoFoto && exist.fotoUrl?.startsWith('data:')) obj.fotoUrl = exist.fotoUrl;
              if (stillNoKtp  && exist.ktpUrl?.startsWith('data:'))  obj.ktpUrl  = exist.ktpUrl;
            }
          } catch {}
        }
      }
    }

    // Selalu pakai minimal upsert: hanya id + data JSON + timestamps
    // Menghindari error kolom (42703/PGRST116) karena field BECCA tidak selalu
    // match nama kolom Supabase. Kolom 'data' adalah source of truth.
    const minimal = { id: obj.id, data: JSON.stringify(obj) };
    if (!NO_UPDATED_AT.includes(table)) {
      minimal.updated_at = obj.updated_at;
    }
    if (!NO_CREATED_AT.includes(table)) {
      minimal.created_at = obj.created_at || obj.createdAt || new Date().toISOString();
    }
    // Tambahkan kolom NOT NULL yang wajib ada agar tidak ditolak Postgres
    if (REQUIRED_COLS[table]) Object.assign(minimal, REQUIRED_COLS[table](obj));

    // Pakai .select() array, bukan .single() — hindari PGRST116 saat upsert
    // mengembalikan HTTP 204 (no content / row tidak berubah)
    const { data: rows, error } = await sb
      .from(table)
      .upsert(minimal, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('[DB] save ' + table + ':', error.message);
      return obj; // sudah disimpan ke localStorage di pre-save atas
    }

    // Jika upsert sukses tapi tidak return row (204), fetch manual
    let saved = rows && rows.length > 0 ? rows[0] : null;
    if (!saved) {
      const { data: fetched } = await sb.from(table).select('*').eq('id', obj.id).maybeSingle();
      saved = fetched;
    }

    const result = _fromRow(saved || minimal);
    // Pastikan field asli obj tetap ada (minimal tidak punya semua field)
    const merged = { ...obj, ...result };
    _invalidateCache(table);
    _lsSave(table, merged);
    return merged;
  }

  async function _delete(table, id) {
    const sb = await _initClient();
    if (!sb) return _lsDelete(table, id);

    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) {
      console.warn('[DB] delete ' + table + ':', error.message);
      // Tetap hapus dari localStorage agar UI konsisten
      _lsDelete(table, id);
      _invalidateCache(table);
      throw new Error('[DB] delete ' + table + ' failed: ' + error.message);
    }
    _invalidateCache(table);
    _lsDelete(table, id);
    return true;
  }

  // Hapus semua baris dari satu tabel (Supabase + localStorage + memCache)
  async function clearTableData(table) {
    _invalidateCache(table);
    localStorage.removeItem('becca_' + table);
    const sb = await _initClient();
    if (!sb) return;
    // PostgREST requires a filter — .not('id','is',null) matches all rows
    const { error } = await sb.from(table).delete().not('id', 'is', null);
    if (error) throw new Error(error.message);
  }

  // ── localStorage fallback ──────────────────────────────────
  function _lsGet(key) {
    try {
      return Promise.resolve(
        JSON.parse(localStorage.getItem('becca_' + key) || '[]')
      );
    } catch { return Promise.resolve([]); }
  }

  function _lsSave(key, data) {
    try {
      const arr = JSON.parse(localStorage.getItem('becca_' + key) || '[]');
      const idx = arr.findIndex(x => x.id === data.id);
      if (idx >= 0) arr[idx] = data; else arr.unshift(data);
      localStorage.setItem('becca_' + key, JSON.stringify(arr));
      return Promise.resolve(data);
    } catch { return Promise.resolve(data); }
  }

  function _lsDelete(key, id) {
    try {
      let arr = JSON.parse(localStorage.getItem('becca_' + key) || '[]');
      arr = arr.filter(x => x.id !== id);
      localStorage.setItem('becca_' + key, JSON.stringify(arr));
    } catch {}
    return Promise.resolve(true);
  }

  // ── Init: load semua data ke localStorage sebagai cache ────
  async function init() {
    await _initClient();
    // Tidak pre-cache — data di-fetch lazy saat modul diakses
    // Ini mencegah sidebar berat saat pertama load
  }

  // ══════════════════════════════════════════════════════════
  //  PUBLIC API — sama persis dengan db.js lama
  // ══════════════════════════════════════════════════════════

  // ── USERS ─────────────────────────────────────────────────
  const getUsers    = ()     => _get('users');
  const saveUser    = (data) => _save('users', data);
  const deleteUser  = (id)   => _delete('users', id);

  // ── ORDERS ────────────────────────────────────────────────
  const getOrders   = ()     => _get('orders');
  const saveOrder   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('orders', data); };
  const deleteOrder = (id)   => _delete('orders', id);

  // ── INVOICES ──────────────────────────────────────────────
  const getInvoices   = ()     => _get('invoices');
  const saveInvoice   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('invoices', data); };
  const deleteInvoice = (id)   => _delete('invoices', id);

  // ── CUSTOMERS ─────────────────────────────────────────────
  const getCustomers   = ()     => _get('customers');
  const saveCustomer   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('customers', data); };
  const deleteCustomer = (id)   => _delete('customers', id);

  // ── KAS ───────────────────────────────────────────────────
  const getKas    = ()     => _get('kas');
  const saveKas   = async (data) => {
    if (!data.id) data.id = Utils.uid();
    if (!data.tgl) data.tgl = new Date().toISOString().split('T')[0];
    return _save('kas', data);
  };
  const deleteKas    = (id) => _delete('kas', id);
  const getKasMasuk  = ()   => _get('kas_masuk');
  const saveKasMasuk = (data) => {
    if (!data.id) data.id = Utils.uid();
    return _save('kas_masuk', data);
  };
  const deleteKasMasuk = (id) => _delete('kas_masuk', id);

  // ── PURCHASE ORDER (Anggaran) ──────────────────────────────
  const getPO    = ()     => _get('po_anggaran');
  const savePO   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('po_anggaran', data); };
  const deletePO = (id)   => _delete('po_anggaran', id);

  // ── BELANJA PASAR ─────────────────────────────────────────
  const getBelanjaPasar    = ()     => _get('po_belanja_pasar');
  const saveBelanjaPasar   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('po_belanja_pasar', data); };
  const deleteBelanjaPasar = (id)   => _delete('po_belanja_pasar', id);

  // ── INVENTORY ─────────────────────────────────────────────
  const getInventory      = ()     => _get('inv_activities');
  const saveInventory     = (data) => {
    if (!data.id) data.id = Utils.uid();
    if (!data.createdAt) data.createdAt = new Date().toISOString();
    return _save('inv_activities', data);
  };
  const saveInventoryLog  = (data) => {
    if (!data.id) data.id = Utils.uid();
    if (!data.createdAt) data.createdAt = new Date().toISOString();
    return _save('inv_activities', data);
  };
  const deleteInventoryLog = (id) => _delete('inv_activities', id);

  const getOpnameLogs    = ()     => _get('opname_logs');
  const saveOpnameLog    = (data) => { if (!data.id) data.id = Utils.uid(); return _save('opname_logs', data); };
  const deleteOpnameLog  = (id)   => _delete('opname_logs', id);

  const getInventoryItems   = ()     => _get('inv_products');
  const saveInventoryItem   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('inv_products', data); };
  const deleteInventoryItem = (id)   => _delete('inv_products', id);

  // ── EMPLOYEES ─────────────────────────────────────────────
  const getEmployees    = ()     => _get('employees');
  const saveEmployee    = (data) => { if (!data.id) data.id = Utils.uid(); return _save('employees', data); };
  const deleteEmployee  = (id)   => _delete('employees', id);
  const getEmployeeLogs = async () => {
    const sb = await _initClient();
    if (sb) return _get('emp_logs');
    // Fallback: coba beberapa key lama
    const d1 = JSON.parse(localStorage.getItem('becca_emp_logs')      || '[]');
    const d2 = JSON.parse(localStorage.getItem('becca_employee_logs') || '[]');
    const d3 = JSON.parse(localStorage.getItem('becca_logbook')       || '[]');
    const combined = [...d1, ...d2, ...d3];
    const unique = combined.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
    return Promise.resolve(unique);
  };
  const saveEmployeeLog   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('emp_logs', data); };
  const deleteEmployeeLog = (id)   => _delete('emp_logs', id);

  // ── EMP ABSENSI ────────────────────────────────────────────
  const getEmpAbsensi    = ()     => _get('emp_absensi');
  const saveEmpAbsensi   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('emp_absensi', data); };
  const deleteEmpAbsensi = (id)   => _delete('emp_absensi', id);

  // ── EMP PAYROLL ────────────────────────────────────────────
  const getEmpPayroll    = ()     => _get('emp_payroll');
  const saveEmpPayroll   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('emp_payroll', data); };
  const deleteEmpPayroll = (id)   => _delete('emp_payroll', id);

  // ── EMP JADWAL SHIFT ───────────────────────────────────────
  const getEmpJadwal    = ()     => _get('emp_jadwal');
  const saveEmpJadwal   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('emp_jadwal', data); };
  const deleteEmpJadwal = (id)   => _delete('emp_jadwal', id);

  // ── ACCOUNT PAYABLE ───────────────────────────────────────
  const getAP         = ()     => _get('ap');
  const saveAP        = (data) => { if (!data.id) data.id = Utils.uid(); return _save('ap', data); };
  const deleteAP      = (id)   => _delete('ap', id);
  const getSuppliers  = ()     => _get('suppliers');
  const saveSupplier  = (data) => { if (!data.id) data.id = Utils.uid(); return _save('suppliers', data); };
  const deleteSupplier = (id)  => _delete('suppliers', id);

  // ── NEWS & PENGUMUMAN ─────────────────────────────────────
  const getNews    = ()     => _get('news');
  const saveNews   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('news', data); };
  const deleteNews = (id)   => _delete('news', id);

  // ── TASKS ─────────────────────────────────────────────────
  const getTasks   = ()     => _get('tasks');
  const saveTask   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('tasks', data); };
  const deleteTask = (id)   => _delete('tasks', id);

  // ── DAILY ORDER FORMS ─────────────────────────────────────
  const getDailyOrderForms   = ()     => _get('daily_order_forms');
  const saveDailyOrderForm   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('daily_order_forms', data); };
  const deleteDailyOrderForm = (id)   => _delete('daily_order_forms', id);

  // ── SETTINGS ──────────────────────────────────────────────
  const getSettings  = async () => {
    const sb = await _initClient();
    if (sb) {
      // Pakai maybeSingle() agar tidak error 406 jika row belum ada
      const { data } = await sb.from('settings').select('*').eq('id','main').maybeSingle();
      if (data?.data) {
        try {
          const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
          // Deteksi korupsi: semua key adalah angka (terjadi jika string di-spread sebagai object)
          const keys = Object.keys(parsed);
          const isCorrupted = keys.length > 0 && keys.every(k => !isNaN(k));
          if (!isCorrupted) {
            // Sync privileges + customRoles ke localStorage agar Auth bisa baca antar device
            // MERGE — DB wins per role+feature, tapi local menambahkan role/feature baru yang belum di DB
            if (parsed._privileges) {
              try {
                const localPriv = JSON.parse(localStorage.getItem('becca_privileges') || '{}');
                const merged = { ...localPriv };
                Object.keys(parsed._privileges).forEach(role => {
                  merged[role] = { ...(merged[role]||{}), ...parsed._privileges[role] };
                });
                localStorage.setItem('becca_privileges', JSON.stringify(merged));
              } catch {}
            }
            if (parsed._customRoles && Array.isArray(parsed._customRoles)) {
              try { localStorage.setItem('becca_custom_roles', JSON.stringify(parsed._customRoles)); } catch {}
            }
            return { ...parsed, id: 'main' };
          }
          console.warn('[DB] Settings Supabase korup (char-indexed) — pakai localStorage');
          // Auto-repair: jika localStorage punya data valid, push ke Supabase sekali
          try {
            const localRaw = localStorage.getItem('becca_settings');
            if (localRaw) {
              const localParsed = JSON.parse(localRaw);
              if (typeof localParsed === 'object' && !Array.isArray(localParsed) &&
                  Object.keys(localParsed).length > 0) {
                sb.from('settings').upsert(
                  { id: 'main', data: JSON.stringify({ ...localParsed, id: 'main' }), updated_at: new Date().toISOString() },
                  { onConflict: 'id' }
                ).then(() => console.log('[DB] Settings auto-repaired ✓')).catch(() => {});
              }
            }
          } catch {}
        } catch {}
      }
    }
    // Fallback localStorage
    try {
      const raw = localStorage.getItem('becca_settings') || '{}';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
    } catch { return {}; }
  };
  const saveSettings = async (data) => {
    // Guard: jika data berupa string, parse dulu (mencegah char-spread korupsi)
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = {}; }
    }
    const sb = await _initClient();
    // Fetch current Supabase state as base — mencegah field penting (logoUrl, dll) hilang
    // karena db-patch menghapus logoUrl dari localStorage setiap load
    let supaBase = {};
    if (sb) {
      try {
        const { data: row } = await sb.from('settings').select('data').eq('id','main').maybeSingle();
        if (row?.data) {
          const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          if (typeof parsed === 'object' && !Array.isArray(parsed)) supaBase = parsed;
        }
      } catch {}
    }
    // local: untuk githubToken dan setting lokal lain yang tidak ada di Supabase
    const local = JSON.parse(localStorage.getItem('becca_settings') || '{}');
    // supaBase (cloud) → local (override lokal) → data (nilai baru)
    const merged = { ...supaBase, ...local, ...data, id: 'main' };
    localStorage.setItem('becca_settings', JSON.stringify(merged));

    if (sb) {
      const { error } = await sb.from('settings').upsert(
        { id: 'main', data: JSON.stringify(merged), updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
      if (error) throw new Error('Supabase settings upsert failed: ' + (error.message || JSON.stringify(error)));
    }
    return merged;
  };

  // ── ACTIVITY LOG ──────────────────────────────────────────
  const logActivity = async (entry) => {
    const user = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
    const log = {
      id:        Utils.uid(),
      tgl:       new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      username:  user?.username || user?.nama || 'System',
      role:      user?.role || '',
      ...entry,
      data:      entry,
    };
    return _save('activity_logs', log);
  };

  const getActivityLogs = () => _get('activity_logs');

  // ── PRESENCE (user online) ────────────────────────────────
  const updatePresence = async (userId, userData) => {
    // Gunakan username sebagai ID agar tidak duplikat per session
    const stableId = (userData.username || userId || '').toLowerCase().replace(/\s+/g,'_');
    const data = {
      id:         stableId,
      username:   userData.username || userId,
      nama:       userData.nama || userId,
      role:       userData.role || '',
      last_seen:  new Date().toISOString(),
      session_id: userData.sessionId || Utils.uid(),
      data:       JSON.stringify(userData),
    };

    const sb = await _initClient();
    if (sb) {
      await sb.from('presence').upsert(data, { onConflict: 'id' });
    } else {
      try { localStorage.setItem('becca_presence_' + userId, JSON.stringify(data)); } catch {}
    }
    return Promise.resolve(data);
  };

  const getOnlineUsers = async (withinMs = 300000) => { // default 5 menit
    const sb = await _initClient();
    const cutoff = new Date(Date.now() - withinMs).toISOString();

    if (sb) {
      const { data } = await sb.from('presence')
        .select('*')
        .gte('last_seen', cutoff);
      return (data || []).map(r => {
        try { return { ...JSON.parse(r.data || '{}'), ...r }; } catch { return r; }
      });
    }

    // Fallback localStorage
    const online = [];
    const now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('becca_presence_')) continue;
      try {
        const u = JSON.parse(localStorage.getItem(key));
        if (u?.last_seen && now - new Date(u.last_seen).getTime() < withinMs) {
          online.push(u);
        }
      } catch {}
    }
    return online;
  };

  // ── REALTIME LISTENERS ────────────────────────────────────
  // Dipanggil dari app.js untuk setup global realtime
  function setupRealtime(callbacks = {}) {
    _initClient().then(sb => {
      if (!sb) return;

      const tables = ['orders','invoices','tasks','customers','kas',
                      'presence','activity_logs','users','settings',
                      'emp_absensi'];

      tables.forEach(table => {
        const cb = callbacks[table] || callbacks['*'];
        if (!cb) return;

        subscribe(table, payload => {
          // Invalidate BEFORE callback so modules get fresh data
          delete _memCache[table];
          cb({ table, ...payload });
        });
      });

      console.log('[DB] Realtime subscriptions active ✓');
    });
  }

  // ── MIGRATE: pindahkan data localStorage ke Supabase ──────
  async function migrateFromLocalStorage() {
    const sb = await _initClient();
    if (!sb) { console.warn('[DB] Cannot migrate: Supabase not configured'); return; }

    const tables = {
      users:       'becca_users',
      orders:      'becca_orders',
      invoices:    'becca_invoices',
      customers:   'becca_customers',
      kas:         'becca_kas',
      kas_masuk:   'becca_kas_masuk',
      inv_activities: 'becca_inv_activities',
      inv_products:'becca_inv_products',
      employees:   'becca_employees',
      emp_logs:    'becca_emp_logs',
      ap:          'becca_ap',
      suppliers:   'becca_suppliers',
      tasks:       'becca_tasks',
      activity_logs:'becca_activity_logs',
    };

    let total = 0;
    for (const [table, lsKey] of Object.entries(tables)) {
      try {
        const rows = JSON.parse(localStorage.getItem(lsKey) || '[]');
        if (!rows.length) continue;

        // Upsert minimal: hanya id + data JSON blob + timestamps
        // Hindari spread ...r karena bisa include kolom yang tidak ada di Supabase (error 42703)
        let toInsert = rows.map(r => {
          const minimal = {
            id:   r.id || Utils.uid(),
            data: JSON.stringify(r),
          };
          if (!NO_UPDATED_AT.includes(table)) {
            minimal.updated_at = r.updatedAt || r.updated_at || new Date().toISOString();
          }
          if (!NO_CREATED_AT.includes(table)) {
            minimal.created_at = r.createdAt || r.created_at || new Date().toISOString();
          }
          return minimal;
        });

        // Khusus employees: preserve foto yang sudah ada di Supabase.
        // Upsert menimpa seluruh kolom data — jika LS tidak punya foto tapi
        // Supabase sudah punya, foto akan terhapus. Cegah dengan merge dulu.
        if (table === 'employees') {
          try {
            const { data: supaRows } = await sb.from('employees').select('id, data');
            const photoMap = {};
            (supaRows || []).forEach(row => {
              try {
                const d = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
                if (d.fotoUrl?.startsWith('data:') || d.ktpUrl?.startsWith('data:')) {
                  photoMap[row.id] = { fotoUrl: d.fotoUrl || '', ktpUrl: d.ktpUrl || '' };
                }
              } catch {}
            });
            toInsert = toInsert.map(minimal => {
              const supaPhoto = photoMap[minimal.id];
              if (!supaPhoto) return minimal;
              try {
                const d = JSON.parse(minimal.data || '{}');
                let changed = false;
                if (!d.fotoUrl?.startsWith('data:') && supaPhoto.fotoUrl?.startsWith('data:')) {
                  d.fotoUrl = supaPhoto.fotoUrl; changed = true;
                }
                if (!d.ktpUrl?.startsWith('data:') && supaPhoto.ktpUrl?.startsWith('data:')) {
                  d.ktpUrl = supaPhoto.ktpUrl; changed = true;
                }
                return changed ? { ...minimal, data: JSON.stringify(d) } : minimal;
              } catch { return minimal; }
            });
          } catch(e) { console.warn('[DB] migrate employees photo-preserve:', e.message); }
        }

        const { error } = await sb.from(table).upsert(toInsert, { onConflict: 'id' });
        if (error) {
          console.warn('[DB] Migrate ' + table + ':', error.message);
        } else {
          total += rows.length;
          console.log('[DB] Migrated ' + table + ': ' + rows.length + ' rows');
        }
      } catch(e) {
        console.warn('[DB] Migrate error ' + table + ':', e.message);
      }
    }
    console.log('[DB] Migration complete: ' + total + ' total rows');
    return total;
  }

  // ── AGGREGATION RPC (Level 3 — server-side summary) ───────
  // Setiap fungsi mencoba RPC dulu (1KB transfer vs ribuan baris).
  // Jika SQL belum di-deploy, otomatis fallback ke full-fetch.
  // Setiap fungsi hanya mencoba RPC. Jika gagal (SQL belum di-deploy),
  // kembalikan null — dashboard akan menangani fallback secara batch.
  async function getKasSummary() {
    const sb = await _initClient();
    if (!sb) return null;
    const { data, error } = await sb.rpc('becca_kas_summary');
    if (error || !data) return null;
    if (data.recent) data.recent = data.recent.map(r => _fromRow(r));
    return data;
  }

  async function getEmployeeSummary() {
    const sb = await _initClient();
    if (!sb) return null;
    const { data, error } = await sb.rpc('becca_employee_summary');
    if (error || !data) return null;
    if (data.top_hutang) data.top_hutang = data.top_hutang.map(r => _fromRow(r));
    return data;
  }

  async function getInventorySummary() {
    const sb = await _initClient();
    if (!sb) return null;
    const { data, error } = await sb.rpc('becca_inventory_summary');
    if (error || !data) return null;
    if (data.low_stock) data.low_stock = data.low_stock.map(r => _fromRow(r));
    return data;
  }

  async function getTasksSummary() {
    const sb = await _initClient();
    if (!sb) return null;
    const { data, error } = await sb.rpc('becca_tasks_summary');
    return (error || !data) ? null : data;
  }

  async function getInvoicesSummary() {
    const sb = await _initClient();
    if (!sb) return null;
    const { data, error } = await sb.rpc('becca_invoices_summary');
    return (error || !data) ? null : data;
  }

  async function getAPSummary() {
    const sb = await _initClient();
    if (!sb) return null;
    const { data, error } = await sb.rpc('becca_ap_summary');
    return (error || !data) ? null : data;
  }

  // ── PUSH TOKENS ───────────────────────────────────────────
  const savePushToken = async (data) => {
    const sb = await _initClient();
    if (!sb) return;
    await sb.from('push_tokens').upsert(data, { onConflict: 'token' });
  };

  const getPushTokens = async (filter = {}) => {
    const sb = await _initClient();
    if (!sb) return [];
    let q = sb.from('push_tokens').select('token,user_id,username,nama,role,divisi,jabatan');
    if (filter.user_id)  q = q.eq('user_id', filter.user_id);
    if (filter.username) q = q.eq('username', filter.username);
    if (filter.nama)     q = q.eq('nama', filter.nama);
    if (filter.divisi)   q = q.eq('divisi', filter.divisi);
    if (filter.jabatan)  q = q.eq('jabatan', filter.jabatan);
    if (filter.role)     q = q.eq('role', filter.role);
    const { data } = await q;
    return data || [];
  };

  // ── DEDUP: hapus duplikat inv_products berdasarkan nama ────
  async function deduplicateInventoryProducts() {
    const sb = await _initClient();
    if (!sb) return 0;

    // Ambil semua produk & aktivitas sekaligus
    const [allItems, allActs] = await Promise.all([
      _fetchAll(sb, 'inv_products'),
      _fetchAll(sb, 'inv_activities'),
    ]);

    // Parse data JSON dari setiap row
    function _parseData(row) {
      try { return typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}); }
      catch { return {}; }
    }

    // Hitung jumlah aktivitas per itemId
    const actCount = {};
    const actsByItemId = {};
    allActs.forEach(row => {
      const d = _parseData(row);
      const iid = d.itemId;
      if (!iid) return;
      actCount[iid] = (actCount[iid] || 0) + 1;
      if (!actsByItemId[iid]) actsByItemId[iid] = [];
      actsByItemId[iid].push({ rowId: row.id, data: d });
    });

    // Group produk by nama (case-insensitive)
    const groups = {};
    allItems.forEach(row => {
      const d = _parseData(row);
      const key = (d.nama || row.nama || '').trim().toLowerCase();
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ id: row.id, created_at: row.created_at, data: d });
    });

    let deleted = 0;
    for (const items of Object.values(groups)) {
      if (items.length <= 1) continue;

      // Prioritas survivor: paling banyak aktivitas → paling lama created_at
      items.sort((a, b) => {
        const ca = actCount[a.id] || 0;
        const cb = actCount[b.id] || 0;
        if (cb !== ca) return cb - ca;
        return (a.created_at || '').localeCompare(b.created_at || '');
      });

      const [keep, ...dupes] = items;
      for (const dupe of dupes) {
        // Re-link activity logs dari dupe ke survivor
        const dupeActs = actsByItemId[dupe.id] || [];
        for (const { rowId, data } of dupeActs) {
          const updated = { ...data, itemId: keep.id, itemNama: keep.data.nama || data.itemNama };
          await sb.from('inv_activities')
            .update({ data: JSON.stringify(updated) })
            .eq('id', rowId);
        }
        // Hapus duplikat
        await sb.from('inv_products').delete().eq('id', dupe.id);
        deleted++;
      }
    }

    if (deleted > 0) {
      _invalidateCache('inv_products');
      _invalidateCache('inv_activities');
      try {
        localStorage.removeItem('becca_inv_products');
        localStorage.removeItem('becca_inv_activities');
      } catch {}
      console.log('[DB] deduplicateInventoryProducts: ' + deleted + ' duplikat dihapus');
    }
    return deleted;
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    init,
    subscribe, unsubscribeAll, setupRealtime,
    migrateFromLocalStorage,
    isReady: () => _ready,
    getCached,

    // Users
    getUsers, saveUser, deleteUser,
    // Orders
    getOrders, saveOrder, deleteOrder,
    // Invoices
    getInvoices, saveInvoice, deleteInvoice,
    // Customers
    getCustomers, saveCustomer, deleteCustomer,
    // Kas
    getKas, saveKas, deleteKas,
    getPO, savePO, deletePO,
    getBelanjaPasar, saveBelanjaPasar, deleteBelanjaPasar,
    getKasMasuk, saveKasMasuk, deleteKasMasuk,
    // Inventory
    getInventory, saveInventory,
    saveInventoryLog, deleteInventoryLog,
    getOpnameLogs, saveOpnameLog, deleteOpnameLog,
    getInventoryItems, saveInventoryItem, deleteInventoryItem,
    // Employees
    getEmployees, saveEmployee, deleteEmployee,
    getEmployeeLogs, saveEmployeeLog, deleteEmployeeLog,
    getEmpAbsensi, saveEmpAbsensi, deleteEmpAbsensi,
    getEmpPayroll, saveEmpPayroll, deleteEmpPayroll,
    getEmpJadwal, saveEmpJadwal, deleteEmpJadwal,
    // AP
    getAP, saveAP, deleteAP, getSuppliers, saveSupplier, deleteSupplier,
    // News & Pengumuman
    getNews, saveNews, deleteNews,
    // Tasks
    getTasks, saveTask, deleteTask,
    // Daily Order Forms
    getDailyOrderForms, saveDailyOrderForm, deleteDailyOrderForm,
    // Settings
    getSettings, saveSettings,
    // Logs
    logActivity, getActivityLogs,
    // Presence
    updatePresence, getOnlineUsers,
    // Aggregation RPC (Level 3)
    getKasSummary, getEmployeeSummary, getInventorySummary,
    getTasksSummary, getInvoicesSummary, getAPSummary,
    // Bulk operations
    clearTableData,
    deduplicateInventoryProducts,
    // Push tokens
    savePushToken, getPushTokens,
  };
})();

window.DB = DB;
