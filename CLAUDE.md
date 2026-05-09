# BECCA V2.0 — Claude Instructions

## Project Overview

**BECCA V2.0** — sistem manajemen operasional katering (orders, invoices, inventory, karyawan, kas, laporan keuangan). Single-page web app, no build step, berjalan dari `index.html`.

| Layer | Teknologi |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework, no build step) |
| Database | **Supabase** (PostgreSQL + RLS enabled) dengan localStorage fallback |
| Auth | Custom session (localStorage/sessionStorage) + 30 min idle timeout |
| Deploy | GitHub Pages — `https://segaDG.github.io/Becca-V2.0/` |
| Repo | https://github.com/segaDG/Becca-V2.0 |

---

## Agent Instructions (WAT Framework)

You operate inside the **WAT framework** (Workflows, Agents, Tools). Probabilistic AI handles reasoning, deterministic code handles execution.

### Architecture

- **Workflows** — Markdown SOPs in `workflows/`. Defines objective, inputs, tools, outputs, edge cases.
- **Agents** — Your role. Read workflows, run tools in sequence, handle failures, ask when unclear.
- **Tools** — Python scripts in `tools/`. API calls, data transforms, file ops. Credentials in `.env`.

### How to Operate

1. **Check existing tools first** — look in `tools/` before building anything new.
2. **Learn from failures** — read full error, fix script, retest (check with me before re-running paid APIs), document in workflow.
3. **Keep workflows current** — update when you find better methods or constraints. Don't create/overwrite workflows without asking unless explicitly told to.

### Self-Improvement Loop

Identify what broke → fix the tool → verify fix → update workflow → move on.

### File Structure

```
.tmp/              # Temporary/intermediate files (disposable, regenerated as needed)
tools/             # Python scripts for deterministic execution
workflows/         # Markdown SOPs
.env               # API keys (NEVER store secrets elsewhere)
credentials.json   # Google OAuth (gitignored)
```

---

## Aturan Wajib

### 1. Backend = Supabase, BUKAN Firebase

Jangan gunakan Firebase API. Semua data via Supabase. Firebase hanya untuk push notification (FCM).

### 2. Data HARUS Masuk DB

- **Load** → `await DB.getXxx()` (sudah punya 5-min cache + LS fallback). Jangan `localStorage.getItem()` langsung untuk data bisnis.
- **Save** → `await DB.saveXxx(data)`. Jangan hanya tulis localStorage.
- **Delete** → `await DB.deleteXxx(id)`. Jangan hanya hapus dari array in-memory.
- **localStorage boleh** untuk UI state saja: pagination size, widget config, filter preference.

### 3. WAJIB: Merge Existing Data Sebelum Save (CRITICAL)

Saat edit record via form, `Object.fromEntries(FormData)` hanya menghasilkan field yang ada di form. Field lain (foto, metadata, timestamps) akan HILANG jika tidak di-merge. **Pattern wajib:**

```js
if (editId) {
  const existing = _dataArray.find(e => e.id === editId);
  if (existing) Object.keys(existing).forEach(k => { if (!(k in data)) data[k] = existing[k]; });
}
await DB.saveXxx(data);
```

Modul yang sudah di-fix: employee, customer, settings (user & general), ap, inventory.

### 4. Module Pattern (WAJIB)

```js
const XModule = (() => {
  let _data = [];
  async function _load() { _data = await DB.getXxx(); }
  async function init() { await _load(); _render(); }
  function _render() { /* update DOM */ }
  return { init };
})();
window.XModule = XModule;
```

### 5. Tambah Modul Baru

1. Buat `js/modules/namaModul.js` — ikuti Module Pattern
2. Tambah entry di `App._MODULE_MAP` dalam `app.js` (lazy loading)
3. Tambah `<section id="page-namaModul" class="page">` di `index.html`

### 6. Page Visibility

Gunakan `class="page"` + `.active` class. **BUKAN** `hidden` class.

### 7. Cache Busting & Service Worker

- Modules dimuat lazily via `App._MODULE_MAP` dengan `?v=YYYYMMDD`
- **Selalu update versi** di `App._MODULE_MAP` (app.js) saat mengubah module
- **Selalu update** `app.js?v=` di `index.html` saat mengubah app.js
- SW strategy: **network-first** untuk JS/CSS — deploy langsung efektif
- **JANGAN** pakai cache-first untuk JS — sudah pernah menyebabkan fix tidak ter-deploy

### 8. Realtime Handler — JANGAN Re-init Saat User di Halaman

Untuk modul dengan inline editing (kas, inventory, ap, daily-order, po), realtime handler di `db-extensions.js` HARUS **skip re-init** saat user sedang di halaman tersebut:

```js
// BENAR: skip jika user sedang di halaman
if (window.App?._currentPage === 'inventory') return;

// SALAH: re-init saat user di halaman (hancurkan edit state)
if (window.App?._currentPage !== 'inventory') return;
InventoryModule?.init?.();
```

---

## Security Rules

### Auth
- **Tidak ada hardcoded password** — default users di `auth.js` hanya punya structure (id, role), TANPA password
- Login **wajib via Supabase** — jika Supabase offline, login ditolak (bukan fallback ke default)
- **Session timeout 30 menit** idle — auto-logout pada next page load
- **Password plaintext** di Supabase (known limitation) — future: migrate ke hashed

### Financial Audit Trail
- Tabel `kas`, `kas_masuk`, `invoices`, `ap`, `emp_payroll`, `employees` otomatis di-log ke `activity_logs` setiap save/delete
- `activity_logs` **tidak bisa dihapus** via anon key (RLS policy: DELETE = false)

### Supabase RLS
- RLS enabled di semua 29 tabel (via `supabase_rls_setup.sql`)
- Anon key punya full CRUD access (auth di application layer)
- `activity_logs` INSERT-only (audit trail protection)

---

## Gotchas (Tidak Obvious dari Kode)

- **`Utils.ls` auto-prefix `becca_`** — tulis `Utils.ls.set('foo', val)`, JANGAN `Utils.ls.set('becca_foo', val)`
- **Supplier noRek** — render fallback: `s.data?.no_rekening || s.noRekening || s.noRek`
- **Combobox (`Utils.initCombo`)** — floating dropdown di `document.body`, HARUS cleanup via `inputEl._comboHandle?.destroy()`
- **Modal closable** — gunakan `closable: false` untuk modal wajib. `hideClose: true` TIDAK dikenali
- **Double-click edit** — `<td>` perlu `data-field="id-input"`, handler via `event.target.closest('td')?.dataset?.field`
- **Daily Order Enter** — Enter di AKT QTY → save + auto-edit baris berikutnya
- **Daily Order EST QTY mobile (Form Produksi)** — pakai `type="text" inputmode="numeric"`, **JANGAN** `type="number"`. Android Chrome tidak fire `keydown` event di `<input type="number">` — handler Enter/Tab tidak akan jalan. Selain itu `_estQtyBlur` pass `jumpToField='di-item'` sebagai fallback supaya tap "→I" tetap auto-spawn baris berikutnya kalau keyboard tidak fire keydown.
- **Daily Order Sync** — matching nama item ke inventory pakai exact match lalu partial match (contains)
- **PO Belanja Pasar 3 kolom QTY** — formula wajib: `qtyKarawang = totalQty − qtyCikopo − qtySupplier`. Saat `_onCikopoChange`/`_onSupplierChange`: clamp value ke max yg masih sisa, lalu **tulis kembali ke input DOM** (`inp.value = clampedValue`) supaya tampilan match nilai internal (kalau user ketik 12000 di field qty kecil, internal terklamp tapi visual masih 12000 → user kira formula salah). Item dgn `qtySupplier > 0` & `!supplierImportedTo` muncul sebagai mini-card di PO list dan bisa di-import ke Anggaran via `POModule._openSupplierImport(bpDocId)`.
- **Deep link** — `?task=ID` → `sessionStorage('becca_deep_task')` → auto-open task modal setelah login
- **Employee gaji** — field `gajiPokok` + `tunjangan` = `gaji` (total). Display harus fallback: `emp.gajiPokok || emp.gaji` untuk data lama
- **Chat privacy** — rooms hanya visible ke members. `_isMember()` cek `Array.isArray(members)` — guard against string
- **Auto-backup** — superadmin only, daily, strip foto/heavy fields, simpan di `becca_backup_latest`
- **Gemini AI** — retry chain: `gemini-2.5-flash` → `gemini-2.5-flash` → `gemini-2.0-flash-lite` (429/503/404 trigger next)

---

## Testing

### Test Suite (`js/tests.js`)

7 test suites, dijalankan di browser:
1. **Regression** — globals, DB methods, module map, no hardcoded passwords
2. **Data Integrity** — save/load/merge preserves all fields
3. **Permission** — role-based access (superadmin/viewer/operator)
4. **Financial Accuracy** — formatRupiah, gaji calculation, kas saldo
5. **Critical Path** — DB connection, load all tables, CRUD cycle
6. **Performance & Health** — load time, render speed, query latency
7. **New Features** — Utils helpers (timeAgo/normalizePhone/helpTip/pullToRefresh/urlState/skeletonRows), DB.getLastEditMap, OfflineQueue, WeeklyDigest, Activity Drawer, GridSelect, UndoRedo, PO Belanja Pasar SUPPLIER column + Tab handling, Daily Order Form Produksi mobile Enter fix

### Cara Run
- **Browser:** Settings → Data → Run Tests (superadmin only)
- **Console:** `await BeccaTests.runAll()`

### WAJIB: Run Tests Sebelum Push

**Setiap kali mengubah kode, jalankan test sebelum push.** Jika ada test FAIL, investigasi dan fix sebelum push. Jangan push kode yang gagal test.

Checklist sebelum push:
1. Buka BECCA di browser, login sebagai superadmin
2. Buka Console → `await BeccaTests.runAll()`
3. Pastikan **0 failed**
4. Baru `git push`

### Test Data Convention
- Test records pakai ID prefix `__test_`
- Semua test records di-cleanup otomatis setelah test
- Tests TIDAK mengubah production data

Lihat `test_plan.md` untuk detail lengkap setiap test case.

## Credentials

Default users **tidak memiliki password** di source code. Password disimpan di Supabase. Jika perlu reset, edit langsung di Supabase Dashboard atau via Settings → Users.
