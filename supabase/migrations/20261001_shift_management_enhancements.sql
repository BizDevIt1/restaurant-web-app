-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20261001_shift_management_enhancements.sql
-- Purpose: Adds shift_type to shift_settlements and shift_id to orders
-- ==============================================================================

ALTER TABLE public.shift_settlements
ADD COLUMN IF NOT EXISTS shift_type TEXT DEFAULT 'First Shift (Morning)';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shift_id BIGINT;
