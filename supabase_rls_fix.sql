-- ============================================================
--  BECCA V2.0 — Supabase Schema & RLS Fix (v5)
--  Jalankan di: Supabase Dashboard → SQL Editor → New Query
--  AMAN dijalankan berulang (IF EXISTS / IF NOT EXISTS / DO blocks)
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

-- ── 3. Fix kolom 'id' di SEMUA tabel: bigint → text ──────────
-- Supabase default membuat id sebagai bigint GENERATED ALWAYS AS IDENTITY.
-- BECCA menggunakan string UUID (Utils.uid()) sebagai ID.
-- Upsert dengan string ke bigint GENERATED ALWAYS menyebabkan error 500.
-- DROP DEFAULT dulu agar sequence tidak konflik, lalu ubah tipe ke text.
-- Semua dibungkus DO block — aman jika id sudah text (EXCEPTION diabaikan).

DO $$ BEGIN ALTER TABLE public.users          ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users          ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.tasks          ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks          ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.orders         ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.orders         ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.invoices       ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.invoices       ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.customers      ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.customers      ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.kas            ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kas            ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.kas_masuk      ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.kas_masuk      ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.employees      ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employees      ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.emp_logs       ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.emp_logs       ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.inv_activities ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inv_activities ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.inv_products   ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.inv_products   ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.opname_logs    ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.opname_logs    ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.ap             ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.ap             ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.suppliers      ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.suppliers      ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.presence       ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.presence       ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE public.activity_logs  ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.activity_logs  ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── 4. Tambah kolom 'data' JSONB ke semua tabel ──────────────

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

-- ── 5. Drop NOT NULL & set DEFAULT pada kolom yang sering error ─

-- users
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN username SET DEFAULT ''; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;  EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN password SET DEFAULT ''; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN nama     DROP NOT NULL;  EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN nama     SET DEFAULT ''; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN role     DROP NOT NULL;  EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ALTER COLUMN role     SET DEFAULT ''; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- tasks
DO $$ BEGIN ALTER TABLE public.tasks ALTER COLUMN title       DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks ALTER COLUMN description DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks ALTER COLUMN assignee    DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks ALTER COLUMN creator     DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- orders
DO $$ BEGIN ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- invoices
DO $$ BEGIN ALTER TABLE public.invoices ALTER COLUMN order_id      DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.invoices ALTER COLUMN periode_dari   DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.invoices ALTER COLUMN periode_dari   SET DEFAULT ''; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.invoices ALTER COLUMN periode_sampai DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.invoices ALTER COLUMN periode_sampai SET DEFAULT ''; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- customers / suppliers
DO $$ BEGIN ALTER TABLE public.customers ALTER COLUMN nama DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.suppliers ALTER COLUMN nama DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ap
DO $$ BEGIN ALTER TABLE public.ap ALTER COLUMN supplier_id DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- employees
DO $$ BEGIN ALTER TABLE public.employees ALTER COLUMN nama DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ── 6. Verifikasi (uncomment untuk cek) ──────────────────────
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name IN ('id','data')
-- ORDER BY table_name, column_name;
