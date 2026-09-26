-- Migration: 20260911_shift_settlements_rls_fix.sql
-- Purpose: Ensure shift_settlements has full RLS permissions (USING & WITH CHECK)

ALTER TABLE public.shift_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Shift Settlements Access" ON public.shift_settlements;
DROP POLICY IF EXISTS "Allow all shift_settlements" ON public.shift_settlements;
DROP POLICY IF EXISTS "Allow all operations on shift_settlements" ON public.shift_settlements;

CREATE POLICY "Allow all shift_settlements" ON public.shift_settlements 
FOR ALL USING (true) WITH CHECK (true);

-- Ensure optional columns exist if not already present
ALTER TABLE public.shift_settlements
ADD COLUMN IF NOT EXISTS shift_opened_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS shift_closed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS cash_sales NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS card_sales NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_gross_sales NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS expected_cash_in_drawer NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS variance NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
