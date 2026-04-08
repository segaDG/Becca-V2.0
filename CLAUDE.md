# BECCA V2.0 — Claude Instructions

## Project Overview

**BECCA V2.0** — sistem manajemen operasional katering (orders, invoices, inventory, karyawan, kas, laporan keuangan). Single-page web app, no build step, berjalan dari `index.html`.

| Layer | Teknologi |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework, no build step) |
| Database | **Supabase** (PostgreSQL + RLS) dengan localStorage fallback |
| Auth | Custom session (localStorage/sessionStorage) |
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

**Core principle:** Local files are for processing. Deliverables go to cloud services (Google Sheets, Slides, etc.). Everything in `.tmp/` is disposable.

---

## Aturan Wajib

### 1. Backend = Supabase, BUKAN Firebase

Jangan gunakan Firebase API. Semua data via Supabase.

### 2. Data HARUS Masuk DB

- **Load** → `await DB.getXxx()` (sudah punya 5-min cache + LS fallback). Jangan `localStorage.getItem()` langsung untuk data bisnis.
- **Save** → `await DB.saveXxx(data)`. Jangan hanya tulis localStorage.
- **Delete** → `await DB.deleteXxx(id)`. Jangan hanya hapus dari array in-memory.
- **localStorage boleh** untuk UI state saja: pagination size, widget config, filter preference.

### 3. Module Pattern (WAJIB)

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

### 4. Tambah Modul Baru

1. Buat `js/modules/namaModul.js` — ikuti Module Pattern
2. Tambah `<script src="js/modules/namaModul.js?v=..." defer>` di `index.html` (sebelum `app.js`)
3. Daftarkan di `App._modules` dalam `app.js`
4. Tambah `<section id="page-namaModul" class="page">` di `index.html`

### 5. Page Visibility

Gunakan `class="page"` + `.active` class. **BUKAN** `hidden` class. Jangan tambah `hidden` ke page sections.

### 6. Script Loading Order

`utils.js → utils-extensions.js → db.js → db-extensions.js → db-patch.js → auth.js` (sync) → UI components (defer) → modules (defer) → `app.js` (defer, terakhir). Cache bust: `?v=YYYYMMDD`.

---

## Gotchas (Tidak Obvious dari Kode)

- **`Utils.ls` auto-prefix `becca_`** — tulis `Utils.ls.set('foo', val)`, JANGAN `Utils.ls.set('becca_foo', val)` (double prefix)
- **Supplier noRek** — render fallback: `s.data?.no_rekening || s.noRekening || s.noRek`
- **Combobox (`Utils.initCombo`)** — floating dropdown di `document.body`, HARUS cleanup. Cek `inputEl._comboHandle` → `.destroy()`
- **Modal closable** — gunakan `closable: false` untuk modal wajib. `hideClose: true` TIDAK dikenali
- **Double-click edit** — `<td>` perlu `data-field="id-input"`, handler via `event.target.closest('td')?.dataset?.field`
- **Daily Order Enter** — Enter di AKT QTY → save + auto-edit baris berikutnya
- **Realtime** — `DB.subscribe()` dedup via `_realtimeChannels Set`. `DBExtensions.init()` punya `_initialized` guard
- **Deep link** — `?task=ID` → `sessionStorage('becca_deep_task')` → auto-open task modal setelah login
- **`search-fix.js`** — patch `setSearch()` ke modul yang support. Guard `__searchPatched` mencegah double-patch

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| superadmin | superadmin | admin123 |
| admin | admin | admin123 |
| operator | operator | op123 |
| viewer | viewer | view123 |
