/* ============================================
   BECCA V2.0 — DB Module
   Semua operasi Firebase Firestore
   Fallback ke localStorage jika offline
   ============================================ */

const DB = {
  _db: null,
  _useLocal: false,

  /* === Init Firebase === */
  init(config) {
    if (!config || !config.projectId) {
      console.warn('[DB] No Firebase config, using localStorage fallback');
      this._useLocal = true;
      return;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      this._db = firebase.firestore();
      console.log('[DB] Firebase connected');
    } catch (e) {
      console.error('[DB] Firebase init failed, using localStorage', e);
      this._useLocal = true;
    }
  },

  /* === GENERIC CRUD === */
  async getAll(collection) {
    if (this._useLocal) return this._lsGet(collection);
    try {
      const snap = await this._db.collection(collection).orderBy('createdAt','desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  },

  async save(collection, data) {
    const doc = { ...data, updatedAt: new Date().toISOString() };
    if (this._useLocal) {
      const all = this._lsGet(collection);
      const idx = all.findIndex(i => i.id === doc.id);
      if (idx >= 0) all[idx] = doc; else all.unshift({ ...doc, id: doc.id || Utils.uid(), createdAt: new Date().toISOString() });
      this._lsSet(collection, all);
      return doc;
    }
    if (doc.id) {
      await this._db.collection(collection).doc(doc.id).set(doc, { merge: true });
      return doc;
    } else {
      doc.id = Utils.uid();
      doc.createdAt = new Date().toISOString();
      await this._db.collection(collection).doc(doc.id).set(doc);
      return doc;
    }
  },

  async delete(collection, id) {
    if (this._useLocal) {
      const all = this._lsGet(collection).filter(i => i.id !== id);
      this._lsSet(collection, all);
      return;
    }
    await this._db.collection(collection).doc(id).delete();
  },

  async getById(collection, id) {
    if (this._useLocal) return this._lsGet(collection).find(i => i.id === id) || null;
    const doc = await this._db.collection(collection).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  /* === Koleksi BECCA === */

  // Orders
  getOrders()          { return this.getAll('orders'); },
  saveOrder(data)      { return this.save('orders', data); },
  deleteOrder(id)      { return this.delete('orders', id); },

  // Invoices
  getInvoices()        { return this.getAll('invoices'); },
  saveInvoice(data)    { return this.save('invoices', data); },
  deleteInvoice(id)    { return this.delete('invoices', id); },

  // Customers
  getCustomers()       { return this.getAll('customers'); },
  saveCustomer(data)   { return this.save('customers', data); },
  deleteCustomer(id)   { return this.delete('customers', id); },

  // Employees
  getEmployees()       { return this.getAll('employees'); },
  saveEmployee(data)   { return this.save('employees', data); },
  deleteEmployee(id)   { return this.delete('employees', id); },

  // Employee Log
  getEmployeeLogs()    { return this.getAll('employee_logs'); },
  saveEmployeeLog(data){ return this.save('employee_logs', data); },

  // Inventory
  getInventory()       { return this.getAll('inventory'); },
  saveInventory(data)  { return this.save('inventory', data); },
  getInventoryItems()  { return this.getAll('inventory_items'); },
  saveInventoryItem(d) { return this.save('inventory_items', d); },

  // Kas Kecil
  getKas()             { return this.getAll('kas'); },
  saveKas(data)        { return this.save('kas', data); },
  deleteKas(id)        { return this.delete('kas', id); },

  // Account Payable
  getAP()              { return this.getAll('ap'); },
  saveAP(data)         { return this.save('ap', data); },
  deleteAP(id)         { return this.delete('ap', id); },
  getSuppliers()       { return this.getAll('suppliers'); },
  saveSupplier(data)   { return this.save('suppliers', data); },

  // Tasks
  getTasks()           { return this.getAll('tasks'); },
  saveTask(data)       { return this.save('tasks', data); },
  deleteTask(id)       { return this.delete('tasks', id); },

  // Users
  getUsers()           { return this.getAll('users'); },
  saveUser(data)       { return this.save('users', data); },

  // Settings
  async getSettings() {
    const doc = await this.getById('meta', 'settings');
    return doc || {};
  },
  async saveSettings(data) {
    return this.save('meta', { ...data, id: 'settings' });
  },

  // Activity Log
  async logActivity(data) {
    return this.save('activity_logs', {
      ...data,
      id: Utils.uid(),
      createdAt: new Date().toISOString(),
      user: Auth.currentUser()?.username || 'system',
    });
  },
  getActivityLogs() { return this.getAll('activity_logs'); },

  /* === localStorage fallback === */
  _lsGet(col) { return Utils.ls.get(`becca_${col}`, []); },
  _lsSet(col, data) { Utils.ls.set(`becca_${col}`, data); },
};

window.DB = DB;
/* ============================================
   BECCA V2.0 — DB Extensions
   Tambahkan ke db.js (atau load setelah db.js)
   Methods untuk: Kas, Inventory, Employee
   ============================================ */

// Extend DB object dengan method baru
Object.assign(DB, {

  /* ============ KAS KECIL ============ */

  getKas() {
    return this._get('kas');
  },

  saveKas(data) {
    if (!data.id) data.id = Utils.uid();
    data.createdAt = data.createdAt || new Date().toISOString();
    data.createdBy = data.createdBy || Auth.currentUser()?.nama || '';
    return this._save('kas', data);
  },

  deleteKas(id) {
    return this._delete('kas', id);
  },

  getKasMasuk() {
    return this._get('kas_masuk');
  },

  saveKasMasuk(data) {
    if (!data.id) data.id = Utils.uid();
    return this._save('kas_masuk', data);
  },

  /* ============ INVENTORY ============ */

  getInventory() {
    return this._get('inventory');
  },

  saveInventory(data) {
    if (!data.id) data.id = Utils.uid();
    data.createdAt = data.createdAt || new Date().toISOString();
    return this._save('inventory', data);
  },

  getInventoryItems() {
    return this._get('inv_products');
  },

  saveInventoryItem(data) {
    if (!data.id) data.id = Utils.uid();
    return this._save('inv_products', data);
  },

  /* ============ EMPLOYEES ============ */

  getEmployees() {
    return this._get('employees');
  },

  saveEmployee(data) {
    if (!data.id) data.id = Utils.uid();
    return this._save('employees', data);
  },

  getEmployeeLogs() {
    return this._get('emp_logs');
  },

  saveEmployeeLog(data) {
    if (!data.id) data.id = Utils.uid();
    return this._save('emp_logs', data);
  },

  deleteEmployeeLog(id) {
    return this._delete('emp_logs', id);
  },

  /* ============ GENERIC (jika belum ada di db.js) ============ */

  // Generic delete — bisa dipakai modul lain
  delete(collection, id) {
    return this._delete(collection, id);
  },

  /* ============ INTERNAL HELPERS ============
     Pastikan db.js sudah punya _get, _save, _delete.
     Jika belum, uncomment bagian bawah ini:
  */

  /*
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
  */
});
