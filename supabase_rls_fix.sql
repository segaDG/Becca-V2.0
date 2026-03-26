-- ============================================================
--  BECCA V2.0 — Supabase Schema & RLS Fix (v2)
--  Jalankan di: Supabase Dashboard → SQL Editor → New Query
--
--  Masalah yang diselesaikan:
--  - Invoice kosong / customer undefined (kolom 'data' belum ada di invoices)
--  - User baru tidak bisa login di device lain (kolom 'data' belum ada di users)
--  - Data tidak terlihat di device lain (RLS blocking anon access)
--
--  AMAN dijalankan berulang — semua pakai IF EXISTS / IF NOT EXISTS
-- ============================================================

-- ── 1. Disable RLS pada semua tabel BECCA ────────────────────

ALTER TABLE IF EXISTS public.users            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.settings         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks            DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders           DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kas              DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kas_masuk        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.emp_logs         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inv_activities   DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inv_products     DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.opname_logs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ap               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.presence         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs    DISABLE ROW LEVEL SECURITY;

-- ── 2. Grant akses anon role ke semua tabel ──────────────────

GRANT ALL ON public.users            TO anon;
GRANT ALL ON public.settings         TO anon;
GRANT ALL ON public.tasks            TO anon;
GRANT ALL ON public.orders           TO anon;
GRANT ALL ON public.invoices         TO anon;
GRANT ALL ON public.customers        TO anon;
GRANT ALL ON public.kas              TO anon;
GRANT ALL ON public.kas_masuk        TO anon;
GRANT ALL ON public.employees        TO anon;
GRANT ALL ON public.emp_logs         TO anon;
GRANT ALL ON public.inv_activities   TO anon;
GRANT ALL ON public.inv_products     TO anon;
GRANT ALL ON public.opname_logs      TO anon;
GRANT ALL ON public.ap               TO anon;
GRANT ALL ON public.suppliers        TO anon;
GRANT ALL ON public.presence         TO anon;
GRANT ALL ON public.activity_logs    TO anon;

-- ── 3. Tambah kolom 'data' JSONB ke SEMUA tabel ──────────────
-- BECCA _save() selalu menulis business data ke kolom 'data'.
-- Tanpa kolom ini, semua write gagal silently — data hanya tersimpan
-- di localStorage device A dan tidak pernah sampai ke Supabase.
-- IF NOT EXISTS aman dijalankan berulang.

ALTER TABLE IF EXISTS public.users          ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.settings       ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.tasks          ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.orders         ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.invoices       ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.customers      ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.kas            ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.kas_masuk      ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.employees      ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.emp_logs       ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.inv_activities ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.inv_products   ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.opname_logs    ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.ap             ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.suppliers      ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.presence       ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE IF EXISTS public.activity_logs  ADD COLUMN IF NOT EXISTS data JSONB;

-- ── 4. Drop NOT NULL constraints yang tidak disertakan di minimal upsert ─
-- BECCA hanya mengirim: id, data, created_at, updated_at ke Supabase.
-- Kolom native lain harus nullable agar upsert tidak ditolak.

ALTER TABLE IF EXISTS public.users
  ALTER COLUMN username    SET DEFAULT '';

ALTER TABLE IF EXISTS public.tasks
  ALTER COLUMN title       DROP NOT NULL,
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN assignee    DROP NOT NULL,
  ALTER COLUMN creator     DROP NOT NULL;

ALTER TABLE IF EXISTS public.orders
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.invoices
  ALTER COLUMN order_id    DROP NOT NULL;

ALTER TABLE IF EXISTS public.customers
  ALTER COLUMN nama        DROP NOT NULL;

ALTER TABLE IF EXISTS public.suppliers
  ALTER COLUMN nama        DROP NOT NULL;

ALTER TABLE IF EXISTS public.ap
  ALTER COLUMN supplier_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.employees
  ALTER COLUMN nama        DROP NOT NULL;

-- ── 5. Verifikasi hasil ──────────────────────────────────────
-- Jalankan query ini setelah script selesai untuk memverifikasi:

-- Cek RLS status:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' ORDER BY tablename;

-- Cek kolom 'data' ada di semua tabel:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name = 'data'
-- ORDER BY table_name;
