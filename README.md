# BECCA V2.0 — Catering Order System

Sistem manajemen orderan catering berbasis web. Versi 2.0 dibangun dengan arsitektur modular untuk kemudahan maintenance dan pengembangan.

## 🚀 Quick Start

1. Clone repo ini
2. Buka `index.html` langsung di browser (atau gunakan Live Server di VS Code)
3. Login dengan akun demo:
   - `superadmin / admin123`
   - `admin / admin123`
   - `operator / op123`
   - `viewer / view123`

## 📁 Struktur

```
├── index.html          ← Entry point (~60 baris)
├── CONTEXT.md          ← Dokumentasi untuk AI assistant
├── css/
│   ├── base.css        ← Design tokens + reset
│   ├── layout.css      ← Sidebar, header, layout
│   ├── components.css  ← UI components
│   └── tables.css      ← Tabel + pagination
└── js/
    ├── utils.js        ← Helper functions
    ├── db.js           ← Firebase + localStorage
    ├── auth.js         ← Login + session
    ├── app.js          ← Router + boot
    ├── ui/
    │   ├── notify.js   ← Toast notifications
    │   ├── modal.js    ← Dynamic modal
    │   └── sidebar.js  ← Navigation
    └── modules/
        ├── dashboard.js
        ├── order.js
        └── (modul lain dalam pengembangan)
```

## 🔧 Konfigurasi Firebase

Edit `js/app.js` bagian `_firebaseConfig`:

```js
_firebaseConfig: {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  ...
}
```

Tanpa Firebase, data tersimpan di localStorage browser.

## 📋 Status Modul

| Modul | Status |
|-------|--------|
| Dashboard | ✅ Selesai |
| Order | ✅ Selesai |
| Invoice | 🚧 TODO |
| Customer | 🚧 TODO |
| Karyawan | 🚧 TODO |
| Inventory | 🚧 TODO |
| Kas Kecil | 🚧 TODO |
| Account Payable | 🚧 TODO |
| Task | 🚧 TODO |
| Laporan | 🚧 TODO |
| Pengaturan | 🚧 TODO |

## 🤖 Cara Minta Bantuan AI

Share file `CONTEXT.md` + file modul yang relevan. Jangan perlu share semua kode sekaligus.
