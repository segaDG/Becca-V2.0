-- ============================================================
--  BECCA V2.0 — Server-side Aggregation Functions (Level 3)
--  Jalankan SEKALI di Supabase Dashboard → SQL Editor → New Query
--  Fungsi ini menghitung summary di PostgreSQL, bukan di browser,
--  sehingga dashboard cukup transfer ~1KB JSON, bukan ribuan baris.
-- ============================================================

-- 1. Kas summary: total masuk/keluar + 10 transaksi terbaru
CREATE OR REPLACE FUNCTION becca_kas_summary()
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'total_masuk',  COALESCE(SUM(CASE WHEN data->>'type' = 'Kas'
                      THEN (data->>'jumlah')::numeric ELSE 0 END), 0),
    'total_keluar', COALESCE(SUM(CASE WHEN data->>'type' != 'Kas'
                      THEN (data->>'jumlah')::numeric ELSE 0 END), 0),
    'count',        COUNT(*),
    'recent', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT id, data FROM kas
        ORDER BY COALESCE(data->>'tgl','') DESC, id DESC
        LIMIT 10
      ) t
    )
  ) FROM kas;
$$;

-- 2. Employee summary: jumlah aktif, total hutang, top 5 debitur
CREATE OR REPLACE FUNCTION becca_employee_summary()
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'active_count', COUNT(*) FILTER (
      WHERE data->>'status' IN ('AKTIF','ACTIVE','aktif','active','Aktif',
                                'Tetap','Kontrak','Percobaan','Harian')
    ),
    'total_hutang', COALESCE(SUM(
      CASE WHEN data->>'status' IN ('AKTIF','ACTIVE','aktif','active','Aktif',
                                    'Tetap','Kontrak','Percobaan','Harian')
      THEN COALESCE((data->>'sisaHutang')::numeric,
                    (data->>'hutang')::numeric, 0)
      ELSE 0 END
    ), 0),
    'top_hutang', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT id, data FROM employees
        WHERE data->>'status' IN ('AKTIF','ACTIVE','aktif','active','Aktif',
                                  'Tetap','Kontrak','Percobaan','Harian')
          AND COALESCE((data->>'sisaHutang')::numeric,
                       (data->>'hutang')::numeric, 0) > 0
        ORDER BY COALESCE((data->>'sisaHutang')::numeric,
                          (data->>'hutang')::numeric, 0) DESC
        LIMIT 5
      ) t
    )
  ) FROM employees;
$$;

-- 3. Inventory summary: item aktif, nilai stok, daftar stok menipis
CREATE OR REPLACE FUNCTION becca_inventory_summary()
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'active_items', COUNT(*) FILTER (
      WHERE data->>'status' IN ('AKTIF','ACTIVE','aktif','active','Aktif','Activated')
    ),
    'total_nilai', COALESCE(SUM(
      COALESCE((data->>'balance')::numeric, 0) *
      COALESCE((data->>'harga')::numeric, (data->>'hargaSatuan')::numeric, 0)
    ), 0),
    'low_stock', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT id, data FROM inv_products
        WHERE COALESCE((data->>'balance')::numeric, 0)
           <= COALESCE((data->>'stokMin')::numeric, 0)
        LIMIT 8
      ) t
    )
  ) FROM inv_products;
$$;

-- 4. Tasks summary: jumlah task yang masih terbuka
CREATE OR REPLACE FUNCTION becca_tasks_summary()
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'open_count', COUNT(*) FILTER (
      WHERE data->>'status' NOT IN ('done','arsip')
    )
  ) FROM tasks;
$$;

-- 5. Invoices summary: total nilai yang belum lunas
CREATE OR REPLACE FUNCTION becca_invoices_summary()
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'belum_lunas', COALESCE(SUM(
      CASE WHEN data->>'status' != 'LUNAS'
      THEN COALESCE((data->>'total')::numeric, 0) ELSE 0 END
    ), 0)
  ) FROM invoices;
$$;

-- 6. AP summary: total AP yang belum lunas
CREATE OR REPLACE FUNCTION becca_ap_summary()
RETURNS json LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'belum_lunas', COALESCE(SUM(
      CASE WHEN data->>'status' != 'LUNAS'
      THEN COALESCE((data->>'total')::numeric, 0) ELSE 0 END
    ), 0)
  ) FROM ap;
$$;

-- Verifikasi: test semua fungsi langsung di sini
-- SELECT becca_kas_summary();
-- SELECT becca_employee_summary();
-- SELECT becca_inventory_summary();
-- SELECT becca_tasks_summary();
-- SELECT becca_invoices_summary();
-- SELECT becca_ap_summary();
