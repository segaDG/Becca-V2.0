/* ============================================================
   BECCA V2.0 — DB Module (Supabase Backend)
   Realtime sync antar semua device dan user
   ============================================================ */

const DB = (() => {
  'use strict';

  // ── Supabase client ────────────────────────────────────────
  let _sb   = null;   // supabase client instance
  let _ready = false;
  let _realtimeSubs = [];

  function _getConfig() {
    try {
      // Cek dedicated keys dulu (paling reliable)
      const url = localStorage.getItem('becca_supabase_url') || '';
      const key = localStorage.getItem('becca_supabase_key') || '';
      if (url && key) return { url, key };

      // Fallback: becca_becca_settings (object)
      const s1 = JSON.parse(localStorage.getItem('becca_becca_settings') || '{}');
      if (s1.supabaseUrl && s1.supabaseKey) return { url: s1.supabaseUrl, key: s1.supabaseKey };

      // Fallback: becca_settings (array atau object)
      const raw = localStorage.getItem('becca_settings') || '{}';
      const s2  = JSON.parse(raw);
      const s   = Array.isArray(s2) ? (s2[0] || {}) : s2;
      return {
        url: url || s1.supabaseUrl || s.supabaseUrl || '',
        key: key || s1.supabaseKey || s.supabaseKey || '',
      };
    } catch { return { url: '', key: '' }; }
  }

  async function _initClient() {
    if (_sb) return _sb;
    const cfg = _getConfig();
    if (!cfg.url || !cfg.key) {
      console.warn('[DB] Supabase not configured — falling back to localStorage');
      return null;
    }
    try {
      // Load Supabase SDK jika belum ada
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
      return null;
    }
  }

  // ── REALTIME subscription ─────────────────────────────────
  function subscribe(table, callback) {
    _initClient().then(sb => {
      if (!sb) return;
      const sub = sb
        .channel('becca_' + table)
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
    // Prioritas: field root (typed columns) di-merge dengan data jsonb
    const base = row.data || {};
    return { ...base, ...row, data: undefined };
  }

  function _fromRows(rows) {
    return (rows || []).map(_fromRow);
  }

  // ── Generic CRUD dengan fallback ke localStorage ───────────
  async function _get(table) {
    const sb = await _initClient();
    if (!sb) return _lsGet(table);

    const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('[DB] get ' + table + ':', error.message);
      return _lsGet(table);
    }
    const result = _fromRows(data);
    // Sync ke localStorage sebagai cache
    try { localStorage.setItem('becca_' + table, JSON.stringify(result)); } catch {}
    return result;
  }

  async function _save(table, obj) {
    const sb = await _initClient();
    if (!sb) return _lsSave(table, obj);

    if (!obj.id) obj.id = Utils.uid();
    obj.updated_at = new Date().toISOString();

    const row = { ...obj, data: JSON.stringify(obj) };

    const { data, error } = await sb
      .from(table)
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('[DB] save ' + table + ':', error.message);
      return _lsSave(table, obj);
    }

    const result = _fromRow(data);
    // Sync localStorage cache
    _lsSave(table, result);
    return result;
  }

  async function _delete(table, id) {
    const sb = await _initClient();
    if (!sb) return _lsDelete(table, id);

    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) {
      console.warn('[DB] delete ' + table + ':', error.message);
    }
    _lsDelete(table, id);
    return true;
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
    if (!_ready) return;

    // Pre-cache semua table utama di background
    const tables = ['users','orders','invoices','customers','kas','kas_masuk',
      'inventory','inv_products','employees','emp_logs','ap','suppliers',
      'tasks','settings','activity_logs'];

    for (const t of tables) {
      _get(t).catch(() => {});
    }
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

  // ── INVENTORY ─────────────────────────────────────────────
  const getInventory      = ()     => _get('inventory');
  const saveInventory     = (data) => {
    if (!data.id) data.id = Utils.uid();
    if (!data.createdAt) data.createdAt = new Date().toISOString();
    return _save('inventory', data);
  };
  const saveInventoryLog  = (data) => {
    if (!data.id) data.id = Utils.uid();
    if (!data.createdAt) data.createdAt = new Date().toISOString();
    return _save('inventory', data);
  };
  const deleteInventoryLog = (id) => _delete('inventory', id);

  const getOpnameLogs    = ()     => _get('opname_logs');
  const saveOpnameLog    = (data) => { if (!data.id) data.id = Utils.uid(); return _save('opname_logs', data); };
  const deleteOpnameLog  = (id)   => _delete('opname_logs', id);

  const getInventoryItems   = ()     => _get('inv_products');
  const saveInventoryItem   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('inv_products', data); };
  const deleteInventoryItem = (id)   => _delete('inv_products', id);

  // ── EMPLOYEES ─────────────────────────────────────────────
  const getEmployees   = ()     => _get('employees');
  const saveEmployee   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('employees', data); };
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

  // ── ACCOUNT PAYABLE ───────────────────────────────────────
  const getAP         = ()     => _get('ap');
  const saveAP        = (data) => { if (!data.id) data.id = Utils.uid(); return _save('ap', data); };
  const getSuppliers  = ()     => _get('suppliers');
  const saveSupplier  = (data) => { if (!data.id) data.id = Utils.uid(); return _save('suppliers', data); };

  // ── TASKS ─────────────────────────────────────────────────
  const getTasks   = ()     => _get('tasks');
  const saveTask   = (data) => { if (!data.id) data.id = Utils.uid(); return _save('tasks', data); };
  const deleteTask = (id)   => _delete('tasks', id);

  // ── SETTINGS ──────────────────────────────────────────────
  const getSettings  = async () => {
    const sb = await _initClient();
    if (sb) {
      const { data } = await sb.from('settings').select('*').eq('id','main').single();
      if (data?.data) {
        try { return { ...JSON.parse(data.data), id: 'main' }; } catch {}
      }
    }
    // Fallback
    try { return JSON.parse(localStorage.getItem('becca_settings') || '{}'); } catch { return {}; }
  };
  const saveSettings = async (data) => {
    // Merge dengan settings lokal (supaya githubToken dll tidak hilang)
    const local = JSON.parse(localStorage.getItem('becca_settings') || '{}');
    const merged = { ...local, ...data, id: 'main' };
    localStorage.setItem('becca_settings', JSON.stringify(merged));

    const sb = await _initClient();
    if (sb) {
      await sb.from('settings').upsert(
        { id: 'main', data: JSON.stringify(merged), updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
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
    const data = {
      id:         userId,
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

  const getOnlineUsers = async (withinMs = 30000) => {
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
                      'presence','activity_logs','users','settings'];

      tables.forEach(table => {
        const cb = callbacks[table] || callbacks['*'];
        if (!cb) return;

        subscribe(table, payload => {
          cb({ table, ...payload });
          // Invalidate localStorage cache untuk force refresh
          _get(table).catch(() => {});
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
      inventory:   'becca_inventory',
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

        // Upsert semua rows
        const toInsert = rows.map(r => ({
          ...r,
          id:   r.id || Utils.uid(),
          data: JSON.stringify(r),
          updated_at: r.updatedAt || r.updated_at || new Date().toISOString(),
          created_at: r.createdAt || r.created_at || new Date().toISOString(),
        }));

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

  // ── Public API ─────────────────────────────────────────────
  return {
    init,
    subscribe, unsubscribeAll, setupRealtime,
    migrateFromLocalStorage,
    isReady: () => _ready,

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
    getKasMasuk, saveKasMasuk, deleteKasMasuk,
    // Inventory
    getInventory, saveInventory,
    saveInventoryLog, deleteInventoryLog,
    getOpnameLogs, saveOpnameLog, deleteOpnameLog,
    getInventoryItems, saveInventoryItem, deleteInventoryItem,
    // Employees
    getEmployees, saveEmployee,
    getEmployeeLogs, saveEmployeeLog, deleteEmployeeLog,
    // AP
    getAP, saveAP, getSuppliers, saveSupplier,
    // Tasks
    getTasks, saveTask, deleteTask,
    // Settings
    getSettings, saveSettings,
    // Logs
    logActivity, getActivityLogs,
    // Presence
    updatePresence, getOnlineUsers,
  };
})();

window.DB = DB;
