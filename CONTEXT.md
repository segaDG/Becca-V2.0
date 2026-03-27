# BECCA V2.0 — AI Context File

> Bagikan file ini di awal setiap sesi AI untuk konteks lengkap tanpa perlu share semua kode.
> Selalu baca file ini sebelum mengerjakan task apapun di project ini.

---

## Project Overview

**BECCA V2.0** adalah sistem manajemen operasional katering — orders, invoices, inventory, karyawan, kas, dan laporan keuangan. Single-page web app, no build step, berjalan langsung dari `index.html`.

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework, no build step) |
| Database | **Supabase** (PostgreSQL + RLS) dengan localStorage fallback |
| Auth | Custom (session di localStorage/sessionStorage) |
| Deploy | **GitHub Pages** — `https://segaDG.github.io/Becca-V2.0/` |
| Fonts | Inter (UI), JetBrains Mono (code) — Google Fonts CDN |
| Icons | Inline SVG |
| Repo | https://github.com/segaDG/Becca-V2.0 |

> **PENTING**: Backend adalah **Supabase**, BUKAN Firebase. Jangan gunakan Firebase API.

---

## Struktur File

```
index.html              → HTML entry point (seminimal mungkin)
share.html              → Standalone task share page (OG preview + deep link ke app)
data-migrator.js        → Migration tool dari v1.0 (jalankan di console browser)

img/
  og-becca.svg          → OG image 1200×630 untuk WhatsApp/social link preview

css/
  base.css              → Design tokens, CSS variables, reset, utility classes
  layout.css            → App shell: sidebar, header, content area, login page
  components.css        → Buttons, cards, forms, modal, toast, badges, dropdown
  tables.css            → Table styles, pagination, data grids

js/
  utils.js              → Helpers: formatRupiah, formatDate, DOM, localStorage
  utils-extensions.js   → Extended utilities (tambahan helper)
  db.js                 → Supabase CRUD + localStorage fallback (CORE)
  db-extensions.js      → Tambahan DB methods
  db-patch.js           → Patch/migration DB utilities
  auth.js               → Login, session, privilege system
  app.js                → Router utama: App.boot(), App.navigate(), App.logout()
  notifications.js      → Real-time notification center
  search-fix.js         → Perbaikan fungsi pencarian global

js/ui/
  notify.js             → Toast notification: Notify.success/error/warning/info()
  modal.js              → Modal dialog: Modal.open/close/confirm()
  sidebar.js            → Sidebar.render(), Sidebar.setActive(), Sidebar.toggle()

js/modules/             → Satu file per modul fitur (lihat status di bawah)
  dashboard.js
  order.js
  invoice.js
  customer.js
  employee.js
  inventory.js
  kas.js
  ap.js
  task.js
  report.js
  settings.js
```

### Script Loading Order di `index.html`

```html
<!-- 1. CORE: Synchronous (no defer) — harus load duluan -->
<script src="js/utils.js?v=..."></script>
<script src="js/utils-extensions.js?v=..."></script>  <!-- WAJIB setelah utils.js, sebelum db.js -->
<script src="js/db.js?v=..."></script>
<script src="js/db-extensions.js?v=..."></script>
<script src="js/db-patch.js?v=..."></script>
<script src="js/auth.js?v=..."></script>

<!-- 2. UI COMPONENTS: Deferred -->
<script src="js/ui/notify.js?v=..." defer></script>
<script src="js/ui/modal.js?v=..." defer></script>
<script src="js/ui/sidebar.js?v=..." defer></script>

<!-- 3. MODULES: Deferred (sebelum app.js) -->
<script src="js/modules/dashboard.js?v=..." defer></script>
...semua modul lainnya...

<!-- 4. APP BOOT: Deferred, terakhir -->
<script src="js/notifications.js?v=..." defer></script>
<script src="js/search-fix.js?v=..." defer></script>
<script src="js/app.js?v=..." defer></script>
```

> Semua `<script>` menggunakan query string `?v=YYYYMMDD` untuk cache busting. Update versi saat ada perubahan penting.

---

## Status Modul

| pageId     | Module          | Status     | Keterangan |
|------------|-----------------|------------|------------|
| dashboard  | DashboardModule | ✅ Done    | Stat cards, widgets, real-time refresh |
| order      | OrderModule     | ✅ Done    | Full CRUD, generate invoice, filter |
| invoice    | InvoiceModule   | ✅ Done    | AR tracking, payment status, overdue alerts |
| customer   | CustomerModule  | ✅ Done    | Full CRUD + delete dengan konfirmasi |
| inventory  | InventoryModule | ✅ Done    | Stok produk, activity log, in/out |
| kas        | KasModule       | ✅ Done    | Kas masuk/keluar, ringkasan saldo |
| ap         | APModule        | ✅ Done    | Accounts Payable, supplier management |
| task       | TaskModule      | ✅ Done    | Kanban board, WA share deep link |
| report     | ReportModule    | ✅ Done    | Laporan keuangan & operasional |
| employee   | EmployeeModule  | ✅ Done    | Data table, logbook, kartu karyawan, foto |
| settings   | SettingsModule  | ✅ Done    | User management + delete, company settings |

### Upcoming Modules

| pageId         | Module              | Status     | Keterangan |
|----------------|---------------------|------------|------------|
| produksi       | ProduksiModule      | 📋 Planned | Form produksi: order+customer+inventory terintegrasi, 3 shift, date picker, saveable |

---

## Pola Kode Standar

### Module Pattern (WAJIB diikuti)

```js
const XModule = (() => {
  // Private state
  let _data = [];
  let _currentPage = 1;

  // Private functions
  function _render() { /* update DOM */ }

  // Load SELALU dari DB — bukan localStorage langsung
  async function _load() {
    _data = await DB.getXxx();  // DB sudah handle cache + LS fallback
  }

  // Public init — dipanggil oleh App.navigate()
  async function init() {
    await _load();
    _render();
  }

  // Save SELALU ke DB
  async function _submit() {
    const data = { ...formValues, id: existingId || Utils.uid() };
    const saved = await DB.saveXxx(data);  // DB handle LS pre-save + Supabase upsert
    _data = await DB.getXxx();
    _render();
    Notify.success('Tersimpan');
  }

  // Delete SELALU ke DB
  async function _delete(id) {
    const ok = await Modal.confirm({ title:'Hapus?', danger:true, confirmText:'Hapus' });
    if (!ok) return;
    await DB.deleteXxx(id);
    _data = _data.filter(x => x.id !== id);
    _render();
    Notify.success('Dihapus');
  }

  // Public API
  return { init, _submit, _delete };
})();

window.XModule = XModule;
```

### Cara Tambah Modul Baru

1. Buat `js/modules/namaModul.js` — ikuti Module Pattern di atas
2. Tambah `<script src="js/modules/namaModul.js?v=..." defer></script>` di `index.html` (sebelum `app.js`)
3. Daftarkan di `App._modules` dalam `app.js`
4. Tambah `<section id="page-namaModul" class="page"></section>` di `index.html`
5. Update tabel status di CONTEXT.md ini

### HTML Pattern untuk Halaman Modul

```html
<!-- BENAR: class="page" (bukan "page hidden") — visibility via .active class -->
<section id="page-namaModul" class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Nama Modul</h1>
      <p class="page-subtitle">Deskripsi singkat</p>
    </div>
    <div class="page-actions">
      <button class="btn btn-primary" onclick="XModule.openForm()">+ Tambah</button>
    </div>
  </div>
  <div class="card">
    <!-- konten -->
  </div>
</section>
```

> **Penting**: Halaman menggunakan `class="page"` saja. Visibility dikontrol lewat `.active` class yang ditambah/dihapus oleh `App.navigate()` — BUKAN `hidden` class. Jangan tambah `hidden` ke page sections.

---

## API Reference

### DB Methods

```js
// Pattern: getXxx() → array, saveXxx(data) → saved object, deleteXxx(id) → bool
// Semua async — selalu await

DB.getOrders()          / DB.saveOrder(data)        / DB.deleteOrder(id)
DB.getInvoices()        / DB.saveInvoice(data)       / DB.deleteInvoice(id)
DB.getCustomers()       / DB.saveCustomer(data)      / DB.deleteCustomer(id)
DB.getEmployees()       / DB.saveEmployee(data)      / DB.deleteEmployee(id)
DB.getInventoryProducts() / DB.saveInventoryProduct(data)
DB.getInventoryActivity() / DB.saveInventoryActivity(data)
DB.getKas()             / DB.saveKas(data)           / DB.deleteKas(id)
DB.getAP()              / DB.saveAP(data)            / DB.deleteAP(id)
DB.getSuppliers()       / DB.saveSupplier(data)      / DB.deleteSupplier(id)
DB.getTasks()           / DB.saveTask(data)          / DB.deleteTask(id)
DB.getSettings()        / DB.saveSettings(data)
DB.deleteCustomer(id)   // Menghapus dari Supabase + localStorage
DB.deleteUser(id)       // Menghapus dari Supabase + localStorage
DB.logActivity({ type, detail })   // Audit trail
DB.migrateFromLocalStorage()       // One-time migration: push semua localStorage → Supabase
```

**Data Architecture:**
- Supabase menyimpan field utama sebagai kolom + seluruh data di kolom `data` (JSONB)
- Konversi otomatis: Supabase snake_case ↔ JS camelCase via `_fromRow()` di db.js
- `DB.getXxx()` selalu return array (tidak pernah null)
- Saat offline / Supabase unavailable → fallback ke localStorage
- Memory cache 60 detik di `_get()`, auto-invalidate saat `_save`/`_delete`

### Auth

```js
Auth.currentUser()           // → { id, username, nama, role, email, noWA? }
Auth.can('feature', 'action') // → bool — privilege check
Auth.isSuperAdmin()           // → bool
Auth.logout()

// Roles: superadmin | admin | operator | viewer
// Contoh privilege: Auth.can('order', 'edit'), Auth.can('report', 'view')
// Auth.can('customer', 'edit') → true hanya untuk admin/superadmin
```

**User Object Fields:**
```js
{
  id, username, nama, role, email,
  noWA: '628xxx'  // optional — nomor WA tanpa '+', dipakai untuk share/notifikasi
}
```

**Demo credentials:**
| Role | Username | Password |
|------|----------|----------|
| superadmin | superadmin | admin123 |
| admin | admin | admin123 |
| operator | operator | op123 |
| viewer | viewer | view123 |

### Notify (Toast)

```js
Notify.success('Judul', 'pesan opsional')   // auto-hide 4s
Notify.error('Judul', 'pesan opsional')     // auto-hide 6s
Notify.warning('Judul', 'pesan opsional')
Notify.info('Judul', 'pesan opsional')
```

### Modal

```js
// Buka modal
Modal.open({
  id: 'modal-nama',           // optional, untuk close manual
  title: 'Judul Modal',
  size: '',                   // '' | 'modal-lg' | 'modal-xl'
  body: '<p>HTML string</p>',
  footer: '<button>...</button>', // optional
  onOpen: (modalEl) => {},    // callback setelah modal tampil
  closable: true              // default true
});

// Tutup modal
Modal.close('modal-nama');   // by id
Modal.closeAll();

// Konfirmasi dialog — returns Promise<boolean>
const ok = await Modal.confirm({
  title: 'Hapus Data?',
  message: 'Data tidak bisa dikembalikan.',
  confirmText: 'Hapus',       // default 'Ya'
  danger: true                // merah untuk aksi destruktif
});
if (ok) { /* lanjutkan hapus */ }
```

### Utils

```js
// Format
Utils.formatRupiah(n, compact?)    // Rp 1.234.567 atau Rp 1.2jt
Utils.formatDate(d, format?)       // 'dd/mm/yyyy' | 'dd mmm yyyy' | 'yyyy-mm-dd'
Utils.formatDateInput(d)           // yyyy-mm-dd (untuk value input[type=date])
Utils.formatNumber(n)              // 1.234.567 (tanpa Rp)
Utils.parseRupiah(str)             // 'Rp 1.000' → 1000
Utils.today()                      // 'yyyy-mm-dd'

// Array helpers
Utils.groupBy(arr, key)            // → { key: [items] }
Utils.sumBy(arr, key)              // → number
Utils.sortBy(arr, key, dir?)       // sort array, dir: 'asc'|'desc'
Utils.uid()                        // → unique string ID
Utils.initials(name)               // 'John Doe' → 'JD'
Utils.slugify(str)                 // 'Nama Item' → 'nama-item'
Utils.clone(obj)                   // deep clone via JSON
Utils.debounce(fn, ms)             // debounce wrapper
Utils.sleep(ms)                    // → Promise (await Utils.sleep(500))

// DOM shortcuts
Utils.$(selector, ctx?)            // querySelector
Utils.$$(selector, ctx?)           // querySelectorAll → Array
Utils.show(el)                     // remove 'hidden' class
Utils.hide(el)                     // add 'hidden' class
Utils.toggle(el, bool?)            // toggle 'hidden' class
Utils.setHTML(sel, html)           // set innerHTML by selector

// Form helpers
Utils.getFormData(formEl)          // → plain object dari FormData
Utils.fillForm(formEl, data)       // isi form dari object
Utils.validate(data, rules)        // → {} if valid, else { field: 'error msg' }

// localStorage (auto-prefix 'becca_') — JANGAN masukkan 'becca_' dalam key!
Utils.ls.get('lastPage')           // reads becca_lastPage
Utils.ls.set('lastPage', value)    // writes becca_lastPage
Utils.ls.del('lastPage')           // removes becca_lastPage
```

### App Router

```js
App.navigate('pageId')    // pindah halaman, memanggil XModule.init()
App.logout()              // clear session, kembali ke login
App.boot()                // init saat pertama load (dipanggil otomatis)
```

---

## Fitur: WA Task Share + Deep Link

### Alur Lengkap

1. User klik tombol share di task → `TaskModule._waText(t)` membuat pesan WA
2. Pesan berisi link ke `share.html?id=ID&t=JUDUL&s=STATUS&p=PRIORITY&a=ASSIGNEE&d=DEADLINE`
3. `share.html` menampilkan task card (standalone, dark theme) + tombol "Buka di BECCA"
4. Tombol "Buka di BECCA" → link ke `index.html?task=ID`
5. Di `app.js` `boot()`: tangkap `?task=ID` → simpan ke `sessionStorage('becca_deep_task')` → strip dari URL
6. Setelah login → `_showApp()`: cek `sessionStorage('becca_deep_task')` → `navigate('task')` → `TaskModule.openModal(id)`

### `share.html`

- File mandiri, tidak butuh `index.html` atau JS module apapun
- OG meta tags: `og:image` → `img/og-becca.svg` (1200×630 SVG)
- Membaca URL params: `id`, `t` (title), `s` (status), `p` (priority), `a` (assignee), `d` (deadline)
- "Buka di BECCA" button → `index.html?task=ENCODED_ID`

### `img/og-becca.svg`

- 1200×630 px — ukuran standar WA/OG preview
- Dark gradient background, logo BECCA, headline "Ada task baru untukmu!"
- Dipakai oleh `og:image` di `share.html`

---

## Design System

### CSS Variables (dari `base.css`)

```css
/* Warna utama */
--bg: #0b0e14              /* Background halaman */
--surface: #131720         /* Card, panel */
--surface2: #1a2033        /* Surface lebih terang */
--surface3: #1e2740        /* Surface paling terang */
--border: #1e2535          /* Border utama */
--border2: #2a3347         /* Border lebih terang */

/* Brand */
--primary: #6366f1         /* Indigo — warna utama */
--primary-h: #818cf8       /* Hover state */
--primary-bg: #6366f11a    /* Background tint */

/* Status */
--success: #22c55e         --success-bg: #22c55e1a
--warning: #f59e0b         --warning-bg: #f59e0b1a
--danger: #ef4444          --danger-bg: #ef44441a
--info: #38bdf8            --info-bg: #38bdf81a

/* Teks */
--text: #e2e8f0            /* Teks utama */
--text-2: #94a3b8          /* Teks sekunder */
--text-3: #475569          /* Teks tersier/placeholder */
--heading: #f8fafc         /* Judul */

/* Spacing (base 4px) */
--s1: 4px  --s2: 8px  --s3: 12px  --s4: 16px  --s5: 20px
--s6: 24px --s8: 32px --s10: 40px --s12: 48px

/* Border radius */
--r-sm: 6px  --r-md: 10px  --r-lg: 14px  --r-xl: 20px  --r-full: 9999px

/* Shadow & transisi */
--shadow-sm / --shadow-md / --shadow-lg
--t-fast: 0.15s  --t-base: 0.2s  --t-slow: 0.3s

/* Font */
--font: 'Inter', sans-serif
--font-mono: 'JetBrains Mono', monospace
```

### Komponen CSS Siap Pakai

```html
<!-- Buttons -->
<button class="btn btn-primary">Simpan</button>
<button class="btn btn-secondary">Batal</button>
<button class="btn btn-danger">Hapus</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-sm btn-primary">Kecil</button>
<button class="btn-icon" style="color:var(--danger)"><!-- SVG icon --></button>

<!-- Badges/Status -->
<span class="badge badge-success">Lunas</span>
<span class="badge badge-warning">Belum Bayar</span>
<span class="badge badge-danger">Overdue</span>
<span class="badge badge-info">Proses</span>

<!-- Cards -->
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Judul</h3>
  </div>
  <div class="card-body">...</div>
</div>

<!-- Stat Cards (Dashboard) -->
<div class="stat-card">
  <div class="stat-icon success"><!-- SVG --></div>
  <div class="stat-value">Rp 10jt</div>
  <div class="stat-label">Total Pendapatan</div>
</div>

<!-- Forms -->
<div class="form-group">
  <label class="form-label">Label</label>
  <input type="text" class="form-control" placeholder="...">
</div>
<div class="form-group">
  <label class="form-label">Pilih</label>
  <select class="form-control">...</select>
</div>

<!-- Tables -->
<div class="table-wrapper">
  <table class="table">
    <thead><tr><th>Kolom</th></tr></thead>
    <tbody id="tbody-id"><tr><td>Data</td></tr></tbody>
  </table>
</div>

<!-- Empty state -->
<div class="empty-state">
  <p>Belum ada data</p>
</div>
```

---

## Pola Error Handling

```js
// Pattern standar untuk async operations
async function _load() {
  try {
    _data = await DB.getXxx();
    _render();
  } catch (err) {
    console.error('[XModule] load error:', err);
    Notify.error('Gagal memuat data', err.message);
  }
}

// Pattern untuk save/delete dengan konfirmasi
async function deleteItem(id) {
  const ok = await Modal.confirm({
    title: 'Hapus Data?',
    message: 'Tindakan ini tidak bisa dibatalkan.',
    confirmText: 'Hapus',
    danger: true
  });
  if (!ok) return;

  try {
    await DB.deleteXxx(id);
    Notify.success('Data dihapus');
    await _load();
  } catch (err) {
    Notify.error('Gagal menghapus', err.message);
  }
}
```

---

## Catatan Penting & Gotchas

### ⚠️ WAJIB: Data Harus Selalu Masuk ke DB (Supabase)

**Aturan utama untuk semua modul, sekarang dan ke depan:**

1. **Load data → selalu dari Supabase** via `DB.getXxx()`, bukan dari `localStorage.getItem()` langsung.
   - `DB.getXxx()` sudah punya 5-menit memory cache + localStorage fallback secara otomatis.
   - Jangan bypass DB layer untuk baca data bisnis.

2. **Simpan data → selalu panggil `DB.saveXxx()`** setelah operasi form/edit/delete.
   - `DB._save()` internal sudah handle: pre-save ke LS dulu, lalu upsert ke Supabase.
   - JANGAN hanya tulis `localStorage.setItem('becca_xxx', ...)` untuk data bisnis tanpa diikuti `DB.saveXxx()`.

3. **Hapus data → selalu panggil `DB.deleteXxx()`**.
   - Jangan hanya hapus dari array in-memory + localStorage tanpa DB call.

4. **Preferensi UI (bukan data bisnis) boleh localStorage-only**, contoh:
   - Pagination size (`becca_kas_perPage`, `becca_ord_perPage`)
   - Widget config dashboard
   - Lock state / row edit state

5. **localStorage hanya untuk:**
   - Cache dari DB (diisi otomatis oleh `DB.getXxx()`)
   - UI state (pagination, filter preference)
   - Fallback saat Supabase offline

**Jika tidak mengikuti aturan ini, data hanya ada di device yang input dan tidak bisa dilihat di device lain.**

---

### Supabase & Data

- **Jangan gunakan Firebase** — backend adalah Supabase
- **Semua DB calls adalah async** — selalu `await DB.getXxx()`
- **`DB.getXxx()` selalu return array** — tidak perlu null check
- **Memory cache 5 menit** — `DB.getXxx()` sudah punya memory cache, aman dipanggil berkali-kali tanpa extra network request
- **Supabase RLS** — anon key terekspos di client (normal untuk Supabase). Untuk production, pastikan RLS policy sudah dikonfigurasi. File `supabase_rls_fix.sql` tersedia di repo
- **`DB.migrateFromLocalStorage()`** — tersedia untuk one-time migration data localStorage → Supabase. Diproteksi flag `becca_migrated_v6` di localStorage
- **Cross-device data** — data sinkron antar device lewat Supabase. localStorage hanya sebagai cache/fallback

### Script & Module Loading

- **Script loading order penting** — utils.js → utils-extensions.js → db.js → ... → modules (defer) → app.js (defer)
- **Cache busting** — semua `<script>` pakai `?v=YYYYMMDD`. Update versi setelah perubahan major
- **Module pattern** — semua modul ikuti IIFE pattern + `window.XModule = XModule`

### Routing & Navigation

- **Page visibility** — `class="page"` + `.active` class. BUKAN `hidden` class. Jangan tambah `hidden` ke `<section class="page">`
- **`App.navigate(pageId)`** — async, memanggil `XModule.init()`, return Promise. Selalu await jika perlu aksi setelah navigate
- **Deep link** — `?task=ID` di URL → `sessionStorage('becca_deep_task')` → setelah login → auto-open task modal

### Utils & Storage

- **`Utils.ls` auto-prefix** — `Utils.ls.set('foo', val)` → `becca_foo`. Jangan masukkan `becca_` dalam key!
  - Benar: `Utils.ls.set('lastPage', pageId)` → tersimpan sebagai `becca_lastPage`
  - Salah: `Utils.ls.set('becca_lastPage', ...)` → tersimpan sebagai `becca_becca_lastPage`
- **db-patch.js** membersihkan key double-prefix `becca_becca_` saat load

### UI Components

- **Toast container** — `id="toast-container"` di `index.html`
- **Modal escape** — setiap `Modal.open()` punya independent escape handler, tidak saling overwrite
- **Sidebar overlay** — `id="sidebar-overlay"` di `index.html`. Dikontrol via `.active` class di `.app-container`
- **CSS variables** — gunakan `var(--primary)` bukan hardcode hex

### Auth & Privilege

- **Delete buttons** — gated by privilege. Customer delete: `Auth.can('customer','edit')` (admin/superadmin saja). Settings user delete: semua user kecuali diri sendiri
- **`_usersCache`** — module-level cache di `settings.js` untuk lookup user saat edit/delete

### Supplier & AP

- **Supplier No. Rekening** — field disimpan sebagai `noRek` di form, tapi render perlu fallback: `s.data?.no_rekening || s.noRekening || s.noRek`

### Keamanan (Known Issues — Internal App)

- Beberapa tempat di modul menggunakan `innerHTML` untuk render data user — potensi XSS jika data diinject. Untuk app internal ini acceptable, tapi perlu sanitasi jika exposed ke public
- Demo credentials hardcoded di `auth.js` — hanya untuk development/demo
