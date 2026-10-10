-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20261001_strict_shift_handover_and_assignment.sql
-- Purpose: Relaxes shift constraints on staff_members and ensures shift_settlements
--          tracks status, handover amounts, and closed_at timestamps.
-- ==============================================================================

-- 1. Ensure staff_members allows standardized shift strings
ALTER TABLE public.staff_members
DROP CONSTRAINT IF EXISTS staff_members_shift_check;

ALTER TABLE public.staff_members
ALTER COLUMN shift SET DEFAULT 'First Shift (Morning)';

-- 2. Ensure shift_settlements has all required columns for strict auditing
ALTER TABLE public.shift_settlements
ADD COLUMN IF NOT EXISTS shift_type TEXT DEFAULT 'First Shift (Morning)',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN',
ADD COLUMN IF NOT EXISTS actual_cash_counted NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_handover_to_next_shift NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 3. Index for fast previous shift handover retrieval
CREATE INDEX IF NOT EXISTS idx_shift_settlements_handover
ON public.shift_settlements (restaurant_id, branch_id, created_at DESC);
