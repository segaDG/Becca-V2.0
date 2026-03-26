-- ============================================================
--  BECCA V2.0 — Supabase Schema & RLS Fix (v3)
--  Jalankan di: Supabase Dashboard → SQL Editor → New Query
--  AMAN dijalankan berulang (IF EXISTS / IF NOT EXISTS / exception handling)
-- ============================================================

-- ── 1. Disable RLS ───────────────────────────────────────────

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

-- ── 2. Grant akses anon ──────────────────────────────────────

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

-- ── 3. Fix tipe kolom 'id' yang salah (bigint → text) ────────
-- invoices.id dibuat sebagai bigint (auto-increment), tapi BECCA
-- menggunakan string ID seperti "inv_001". Harus diubah ke text.
-- DROP DEFAULT dulu agar tidak ada sequence conflict.

DO $$ BEGIN
  ALTER TABLE public.invoices ALTER COLUMN id DROP DEFAULT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoices ALTER COLUMN id TYPE text USING id::text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Cek tabel lain yang mungkin juga bigint (users biasanya uuid, tapi jaga-jaga)
DO $$ BEGIN
  ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.users ALTER COLUMN id TYPE text USING id::text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── 4. Tambah kolom 'data' JSONB ke semua tabel ──────────────
-- IF NOT EXISTS aman jika kolom sudah ada

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

-- ── 4. Drop NOT NULL & set DEFAULT (defensif — skip jika kolom tidak ada) ─
-- Setiap ALTER dibungkus DO block agar tidak hentikan eksekusi jika kolom tidak ada

DO $$ BEGIN
  ALTER TABLE public.users ALTER COLUMN username SET DEFAULT '';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks ALTER COLUMN title DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks ALTER COLUMN description DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks ALTER COLUMN assignee DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks ALTER COLUMN creator DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoices ALTER COLUMN order_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customers ALTER COLUMN nama DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.suppliers ALTER COLUMN nama DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ap ALTER COLUMN supplier_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.employees ALTER COLUMN nama DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ── 5. Verifikasi (opsional) ─────────────────────────────────
-- Cek kolom 'data' ada di semua tabel:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name = 'data'
-- ORDER BY table_name;
