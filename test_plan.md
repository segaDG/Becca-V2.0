# BECCA V2.0 — Test Plan

## Overview

BECCA uses browser-based tests (no build step). Tests run in the app context with full access to DB, Auth, and all modules.

## How to Run

### In Browser (Manual)
1. Login sebagai **superadmin**
2. Buka **Settings → Tab Data → Run Tests**
3. Atau di Console: `await BeccaTests.runAll()`

### In Claude Code (Automated)
Tests dijalankan otomatis sebelum setiap `git push` via pre-push hook.
Jika ada test FAIL, push dibatalkan.

```bash
# Manual run
node tests/run-tests.js
```

---

## Test Suites

### 1. Regression Tests (`testRegression`)
**Purpose:** Pastikan semua module, globals, dan API method tersedia setelah deploy.

| Test | Cek |
|------|-----|
| Core globals | Utils, DB, Auth, App, Modal, Notify, Sidebar exist |
| DB methods | Semua CRUD method tersedia (getXxx, saveXxx, deleteXxx) |
| Auth methods | login, can, currentUser, _SESSION_TIMEOUT = 30min |
| Utils methods | formatRupiah, formatDate, uid, esc, ls |
| XSS protection | Utils.esc() escapes `<script>` tags |
| Utils.ls prefix | Auto-prefix `becca_` bekerja benar |
| Module map | Semua module terdaftar di App._MODULE_MAP |
| No hardcoded passwords | _defaultUsers tidak punya field password |

### 2. Data Integrity Tests (`testDataIntegrity`)
**Purpose:** Pastikan save → load tidak kehilangan field apapun.

| Test | Cek |
|------|-----|
| Employee full CRUD | Save dengan semua field → load → semua field ada |
| Employee custom field | Field non-standard (`customField`) tetap preserved |
| Customer merge pattern | Edit via form → field non-form (`internalNote`) preserved |
| Chat message by room | Save message → getChatMessagesByRoom → ditemukan |
| Delete cleanup | Delete → record benar-benar hilang |

### 3. Permission Tests (`testPermissions`)
**Purpose:** Pastikan role-based access control berjalan benar.

| Test | Cek |
|------|-----|
| superadmin access | Auth.can('*', '*') = true |
| viewer restrictions | Hanya bisa view, tidak bisa edit/delete |
| operator restrictions | Bisa edit order, tidak bisa akses emp_finance |
| Session timeout config | _SESSION_TIMEOUT = 1800000 (30 min) |
| No hardcoded passwords | _defaultUsers.password = undefined |

### 4. Financial Accuracy Tests (`testFinancialAccuracy`)
**Purpose:** Pastikan kalkulasi keuangan akurat.

| Test | Cek |
|------|-----|
| formatRupiah | 1000 → "Rp 1.000", 1500000 → "Rp 1.500.000" |
| parseRupiah | "Rp 1.000" → 1000 |
| Gaji calculation | gajiPokok + tunjangan = gaji |
| Gaji save/load | Simpan → muat → nilai sama |
| Gaji fallback | gajiPokok=0 → tampil dari field gaji lama |
| Kas saldo | masuk - keluar = saldo benar |

### 5. Critical Path Tests (`testCriticalPath`)
**Purpose:** Pastikan flow utama berjalan end-to-end.

| Test | Cek |
|------|-----|
| App.navigate works | Function exists, _currentPage set |
| DB connected | Supabase connection active |
| Load employees | Returns array, not empty |
| Load customers | Returns array |
| Load orders | Returns array |
| Load inventory | Items + logs return array |
| Load kas | Returns array |
| Load settings | Returns object |
| Load chat rooms | Returns array |
| Order CRUD cycle | Save → verify exists → delete → verify gone |
| PushModule exists | Push notification module loaded |
| Service Worker | Registered and active |

---

## Test Data Convention

- Test records use ID prefix `__test_` (e.g., `__test_emp_1713945600000`)
- All test records are cleaned up (deleted) after each test
- Tests should NOT modify production data

## Adding New Tests

1. Edit `js/tests.js`
2. Add test function inside the appropriate suite
3. Use helpers: `assert(suite, name, condition)`, `assertEqual(suite, name, actual, expected)`, `skip(suite, name, reason)`
4. Update this test plan

## Pass Criteria

- **All tests PASS** = safe to deploy
- **Any FAIL** = investigate before push
- **SKIP** = test requires conditions not met (e.g., not logged in)

## Known Limitations

- Tests run in browser context — require login
- Cannot test offline scenarios automatically
- Cannot test concurrent access (single browser)
- Financial accuracy tests cover calculations, not UI display
