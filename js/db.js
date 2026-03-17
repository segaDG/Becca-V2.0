/* ============================================
   BECCA V2.0 — DB (Database Layer)
   localStorage primary, Firebase optional
============================================ */
const DB = {
  _config: null,
  init(firebaseConfig) { this._config = firebaseConfig; },

  /* ============ HELPERS ============ */
  _get(key) {
    try {
      const raw = localStorage.getItem('becca_' + key);
      return Promise.resolve(raw ? JSON.parse(raw) : []);
    } catch { return Promise.resolve([]); }
  },
  _save(key, data) {
    try {
      const all = JSON.parse(localStorage.getItem('becca_' + key) || '[]');
      const idx = all.findIndex(r => r.id === data.id);
      if (idx >= 0) all[idx] = data; else all.unshift(data);
      localStorage.setItem('becca_' + key, JSON.stringify(all));
      return Promise.resolve(data);
    } catch(err) { return Promise.reject(err); }
  },
  _delete(key, id) {
    try {
      let all = JSON.parse(localStorage.getItem('becca_' + key) || '[]');
      all = all.filter(r => r.id !== id);
      localStorage.setItem('becca_' + key, JSON.stringify(all));
      return Promise.resolve(true);
    } catch(err) { return Promise.reject(err); }
  },

  /* ============ USERS ============ */
  getUsers()              { return this._get('users'); },
  saveUser(data)          { if (!data.id) data.id = Utils.uid(); return this._save('users', data); },
  deleteUser(id)          { return this._delete('users', id); },

  /* ============ ORDERS ============ */
  getOrders()             { return this._get('orders'); },
  saveOrder(data)         { if (!data.id) data.id = Utils.uid(); return this._save('orders', data); },
  deleteOrder(id)         { return this._delete('orders', id); },

  /* ============ INVOICES ============ */
  getInvoices()           { return this._get('invoices'); },
  saveInvoice(data)       { if (!data.id) data.id = Utils.uid(); return this._save('invoices', data); },
  deleteInvoice(id)       { return this._delete('invoices', id); },

  /* ============ CUSTOMERS ============ */
  getCustomers()          { return this._get('customers'); },
  saveCustomer(data)      { if (!data.id) data.id = Utils.uid(); return this._save('customers', data); },
  deleteCustomer(id)      { return this._delete('customers', id); },

  /* ============ KAS ============ */
  getKas()                { return this._get('kas'); },
  saveKas(data) {
    if (!data.id) data.id = Utils.uid();
    data.createdAt = data.createdAt || new Date().toISOString();
    data.createdBy = data.createdBy || (typeof Auth !== 'undefined' ? Auth.currentUser()?.nama : '') || '';
    return this._save('kas', data);
  },
  deleteKas(id)           { return this._delete('kas', id); },
  getKasMasuk()           { return this._get('kas_masuk'); },
  saveKasMasuk(data)      { if (!data.id) data.id = Utils.uid(); return this._save('kas_masuk', data); },

  /* ============ INVENTORY ============ */
  getInventory()          { return this._get('inventory'); },
  // saveInventory = alias for inventory logs (activity line)
  saveInventory(data) {
    if (!data.id) data.id = Utils.uid();
    data.createdAt = data.createdAt || new Date().toISOString();
    return this._save('inventory', data);
  },
  // Explicit alias used by inventory.js
  saveInventoryLog(data) {
    if (!data.id) data.id = Utils.uid();
    data.createdAt = data.createdAt || new Date().toISOString();
    return this._save('inventory', data);
  },
  deleteInventoryLog(id)  { return this._delete('inventory', id); },

  getInventoryItems()     { return this._get('inv_products'); },
  saveInventoryItem(data) { if (!data.id) data.id = Utils.uid(); return this._save('inv_products', data); },
  deleteInventoryItem(id) { return this._delete('inv_products', id); },

  /* ============ EMPLOYEES ============ */
  getEmployees()          { return this._get('employees'); },
  saveEmployee(data)      { if (!data.id) data.id = Utils.uid(); return this._save('employees', data); },
  getEmployeeLogs()       { return this._get('emp_logs'); },
  saveEmployeeLog(data)   { if (!data.id) data.id = Utils.uid(); return this._save('emp_logs', data); },
  deleteEmployeeLog(id)   { return this._delete('emp_logs', id); },

  /* ============ ACCOUNT PAYABLE ============ */
  getAP()                 { return this._get('ap'); },
  saveAP(data)            { if (!data.id) data.id = Utils.uid(); return this._save('ap', data); },
  getSuppliers()          { return this._get('suppliers'); },
  saveSupplier(data)      { if (!data.id) data.id = Utils.uid(); return this._save('suppliers', data); },

  /* ============ TASKS ============ */
  getTasks()              { return this._get('tasks'); },
  saveTask(data)          { if (!data.id) data.id = Utils.uid(); return this._save('tasks', data); },
  deleteTask(id)          { return this._delete('tasks', id); },

  /* ============ SETTINGS ============ */
  getSettings()           { return this._get('settings').then(d => d[0] || {}); },
  saveSettings(data)      { return this._save('settings', { ...data, id: 'settings' }); },

  /* ============ ACTIVITY LOG ============ */
  logActivity(entry) {
    const user = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
    const log = {
      id: Utils.uid(),
      tgl: Utils.today ? Utils.today() : new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      user: user?.nama || 'System',
      role: user?.role || '',
      ...entry,
    };
    return this._save('activity_log', log);
  },
  getActivityLog()        { return this._get('activity_log'); },
  clearActivityLog()      { localStorage.removeItem('becca_activity_log'); return Promise.resolve(true); },

  /* ============ GENERIC ============ */
  delete(collection, id)  { return this._delete(collection, id); },
};
window.DB = DB;
