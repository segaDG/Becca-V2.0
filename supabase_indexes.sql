-- ============================================
-- BECCA V2.0 — Database Indexes for Performance
-- Run in Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================

-- KAS (transaksi kas kecil) — sering di-filter by tgl, bulan, type
CREATE INDEX IF NOT EXISTS idx_kas_tgl ON public.kas ((data->>'tgl'));
CREATE INDEX IF NOT EXISTS idx_kas_bulan ON public.kas ((data->>'bulan'));

-- ORDERS — sering di-filter by tanggal, customer
CREATE INDEX IF NOT EXISTS idx_orders_tgl ON public.orders ((data->>'tanggal'));
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders ((data->>'customer'));

-- INVOICES — sering di-filter by tglInvoice, status, customer
CREATE INDEX IF NOT EXISTS idx_invoices_tgl ON public.invoices ((data->>'tglInvoice'));
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices ((data->>'status'));

-- INV_ACTIVITIES (inventory logs) — sering di-filter by tgl, itemId, syncTag
CREATE INDEX IF NOT EXISTS idx_inv_act_tgl ON public.inv_activities ((data->>'tgl'));
CREATE INDEX IF NOT EXISTS idx_inv_act_item ON public.inv_activities ((data->>'itemId'));
CREATE INDEX IF NOT EXISTS idx_inv_act_sync ON public.inv_activities ((data->>'syncTag'));

-- DAILY_ORDER_FORMS — sering di-filter by tanggal, shift
CREATE INDEX IF NOT EXISTS idx_do_forms_tgl ON public.daily_order_forms ((data->>'tanggal'));
CREATE INDEX IF NOT EXISTS idx_do_forms_shift ON public.daily_order_forms ((data->>'shift'));

-- ACTIVITY_LOGS — sering di-sort by timestamp
CREATE INDEX IF NOT EXISTS idx_activity_ts ON public.activity_logs ((data->>'timestamp'));

-- EMPLOYEES — sering di-search by nama
CREATE INDEX IF NOT EXISTS idx_emp_nama ON public.employees ((data->>'nama'));

-- AP (account payable) — sering di-filter by supplier, status
CREATE INDEX IF NOT EXISTS idx_ap_supplier ON public.ap ((data->>'supplier'));
CREATE INDEX IF NOT EXISTS idx_ap_status ON public.ap ((data->>'status'));

-- SUPPLIERS — sering di-search by nama
CREATE INDEX IF NOT EXISTS idx_sup_nama ON public.suppliers ((data->>'nama'));

-- TASKS — sering di-filter by status
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks ((data->>'status'));

-- PUSH_TOKENS — sering di-filter by username, role
CREATE INDEX IF NOT EXISTS idx_push_username ON public.push_tokens (username);
CREATE INDEX IF NOT EXISTS idx_push_role ON public.push_tokens (role);

-- DELIVERY_SCHEDULES — sering di-filter by weekStart
CREATE INDEX IF NOT EXISTS idx_dlv_week ON public.delivery_schedules ((data->>'weekStart'));

-- DELIVERY_TRACKING_LOGS — sering di-filter by driverId, date
CREATE INDEX IF NOT EXISTS idx_trk_driver ON public.delivery_tracking_logs ((data->>'driverId'));
CREATE INDEX IF NOT EXISTS idx_trk_date ON public.delivery_tracking_logs ((data->>'date'));

-- SETTINGS — hanya 1 row, tidak perlu index

-- PRESENCE — sering di-filter by last_seen
CREATE INDEX IF NOT EXISTS idx_presence_seen ON public.presence (last_seen);
