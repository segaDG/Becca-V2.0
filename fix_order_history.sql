-- ============================================================
-- BECCA — Fix order_history FK + Convert id columns to TEXT
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Buat tabel order_history jika belum ada
CREATE TABLE IF NOT EXISTS public.order_history (
  id         TEXT PRIMARY KEY,
  order_id   TEXT,
  action     TEXT,
  note       TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  data       JSONB
);

-- 2. Drop FK constraint yang blokir perubahan tipe
ALTER TABLE IF EXISTS public.order_history
  DROP CONSTRAINT IF EXISTS order_history_order_id_fkey;

-- 3. Convert orders.id bigint → text
DO $$ BEGIN ALTER TABLE public.orders ALTER COLUMN id DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.orders ALTER COLUMN id TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Convert order_history.order_id bigint → text
DO $$ BEGIN ALTER TABLE public.order_history ALTER COLUMN id        DROP DEFAULT; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_history ALTER COLUMN id        TYPE text USING id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_history ALTER COLUMN order_id  TYPE text USING order_id::text; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5. Drop CHECK constraint orders_tipe_check (membatasi nilai tipe)
ALTER TABLE IF EXISTS public.orders DROP CONSTRAINT IF EXISTS orders_tipe_check;

-- 5b. Drop NOT NULL pada SEMUA kolom orders (kecuali id) sekaligus
DO $$
DECLARE col record;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name != 'id' AND is_nullable = 'NO'
  LOOP
    EXECUTE format('ALTER TABLE public.orders ALTER COLUMN %I DROP NOT NULL', col.column_name);
  END LOOP;
END $$;

-- 6. Disable RLS & Grant akses
ALTER TABLE IF EXISTS public.order_history DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.order_history TO anon;

-- 6. Verifikasi
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'order_history')
  AND column_name IN ('id', 'order_id')
ORDER BY table_name, column_name;
