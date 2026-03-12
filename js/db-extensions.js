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
