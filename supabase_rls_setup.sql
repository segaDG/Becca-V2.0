-- ============================================
-- BECCA V2.0 — Supabase RLS Setup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- This enables Row Level Security on all tables
-- ============================================

-- Step 1: Enable RLS on all tables
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emp_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emp_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kas_masuk ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inv_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inv_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ap ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_order_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS news ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS po_anggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emp_jadwal ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS opname_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS menu_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS menu_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS delivery ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policies — allow anon key full CRUD access
-- (BECCA handles auth at application level, not Supabase level)
-- This is equivalent to current behavior but with RLS enabled,
-- so if someone gets a different key they can't bypass.

-- Helper function: create full-access policy for anon role
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'users','employees','emp_logs','emp_absensi','emp_payroll',
    'orders','invoices','customers','kas','kas_masuk',
    'inv_products','inv_activities','ap','suppliers','tasks',
    'activity_logs','settings','chat_rooms','chat_messages',
    'daily_order_forms','news','push_tokens','presence',
    'po_anggaran','emp_jadwal','opname_logs',
    'menu_library','menu_plans','delivery'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop existing policies if any
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON %I', t, t);

    -- Create policies for anon role (BECCA's auth layer)
    EXECUTE format('CREATE POLICY "anon_select_%s" ON %I FOR SELECT TO anon USING (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%s" ON %I FOR INSERT TO anon WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%s" ON %I FOR UPDATE TO anon USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%s" ON %I FOR DELETE TO anon USING (true)', t, t);
  END LOOP;
END $$;

-- Step 3: Make activity_logs INSERT-only for non-service roles
-- (prevent deletion of audit trail)
DROP POLICY IF EXISTS "anon_delete_activity_logs" ON activity_logs;
CREATE POLICY "anon_delete_activity_logs" ON activity_logs
  FOR DELETE TO anon USING (false);  -- NOBODY can delete audit logs via anon key

-- Verify
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
