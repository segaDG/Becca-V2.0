# BECCA V2.0 — Context File
> Bagikan file ini di awal setiap sesi AI untuk konteks tanpa perlu share semua kode

## Stack
- Vanilla HTML/CSS/JS (no framework, no build step)
- Firebase Firestore (localStorage fallback jika offline)
- Deploy: Vercel (static)
- Repo: https://github.com/segaDG/Becca-V2.0

## Struktur File

```
css/
  base.css        → Design tokens, reset, utility classes
  layout.css      → App shell: sidebar, header, content, login page
  components.css  → Buttons, cards, forms, modal, toast, badge, dropdown
  tables.css      → Table styles + pagination

js/
  utils.js        → Helper: formatRupiah, formatDate, uid, DOM helpers, localStorage
  db.js           → Firebase CRUD + localStorage fallback. Methods: getOrders/saveOrder/deleteOrder dll
  auth.js         → Login/logout, session (localStorage), privilege check (Auth.can(feature, action))

js/ui/
  notify.js       → Toast: Notify.success/error/warning/info(title, msg)
  modal.js        → Modal: Modal.open(opts), Modal.close(id), Modal.confirm(opts) → Promise<bool>
  sidebar.js      → Sidebar.render(), Sidebar.setActive(pageId), Sidebar.toggle()

js/modules/
  dashboard.js    → DashboardModule.init() — stat cards + recent orders table
  order.js        → OrderModule.init() — input order, list, filter, edit, delete

app.js            → App.boot(), App.navigate(pageId), App.logout() — main router
```

## Konvensi Kode

### Modul Pattern
```js
const XModule = (() => {
  let _data = []; // private state
  // private functions
  async function init() { /* render page */ }
  // return public API
  return { init };
})();
window.XModule = XModule;
```

### CSS Variables (dari base.css)
```
--bg, --surface, --surface2, --surface3, --border, --border2
--primary, --primary-h, --primary-bg
--success, --warning, --danger, --info (masing-masing ada -bg)
--text, --text-2, --text-3, --heading
--s1(4px) → --s12(48px), --r-sm/md/lg/xl/full
--font, --font-mono, --shadow-sm/md/lg, --t-fast/base/slow
```

### Helper functions
```js
Utils.formatRupiah(n, compact?)  // Rp 1.000.000 atau Rp 1jt
Utils.formatDate(d, format?)     // dd/mm/yyyy | dd mmm yyyy | yyyy-mm-dd
Utils.today()                    // string yyyy-mm-dd
Utils.uid()                      // unique id
Utils.initials(name)             // "John Doe" → "JD"
Utils.groupBy(arr, key)
Utils.sumBy(arr, key)
Utils.ls.get/set/del(key)
```

### DB Methods
```js
// Pattern: getXxx() → array, saveXxx(data) → saved, deleteXxx(id)
DB.getOrders() / DB.saveOrder(data) / DB.deleteOrder(id)
DB.getInvoices() / DB.saveInvoice(data) / DB.deleteInvoice(id)
DB.getCustomers() / DB.saveCustomer(data)
DB.getEmployees() / DB.saveEmployee(data)
DB.getKas() / DB.saveKas(data) / DB.deleteKas(id)
DB.getAP() / DB.saveAP(data) / DB.getSuppliers() / DB.saveSupplier(data)
DB.getTasks() / DB.saveTask(data)
DB.getSettings() / DB.saveSettings(data)
DB.logActivity({ type, detail })
```

### Auth
```js
Auth.currentUser()    // { id, username, nama, role, email }
Auth.can('order', 'view')  // privilege check
Auth.isSuperAdmin()
```

### Modal & Notify
```js
Modal.open({ id?, title, size?, body, footer?, onOpen?, closable? })
Modal.close(id)
Modal.confirm({ title, message, confirmText?, danger? }) // → Promise<bool>

Notify.success('Judul', 'pesan opsional')
Notify.error('Judul', 'pesan opsional')
Notify.warning(...)
Notify.info(...)
```

## Pages & Modules
| pageId     | Module          | Status     |
|------------|-----------------|------------|
| dashboard  | DashboardModule | ✅ Done    |
| order      | OrderModule     | ✅ Done    |
| invoice    | InvoiceModule   | 🚧 TODO    |
| customer   | CustomerModule  | 🚧 TODO    |
| employee   | EmployeeModule  | 🚧 TODO    |
| inventory  | InventoryModule | 🚧 TODO    |
| kas        | KasModule       | 🚧 TODO    |
| ap         | APModule        | 🚧 TODO    |
| task       | TaskModule      | 🚧 TODO    |
| report     | ReportModule    | 🚧 TODO    |
| settings   | SettingsModule  | 🚧 TODO    |

## Cara Tambah Modul Baru
1. Buat `js/modules/namaModul.js` ikuti pola Module Pattern di atas
2. Tambahkan `<script src="js/modules/namaModul.js">` di index.html (sebelum app.js)
3. Daftarkan di `App._modules` di app.js
4. Tambahkan `<section id="page-namaModul" class="page hidden">` di index.html
