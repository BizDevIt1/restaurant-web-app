-- ==============================================================================
-- Migration: 20261002_dynamic_tax_configuration.sql
-- Purpose: Ensure dynamic tax rate columns exist across restaurants and branch_settings
-- ==============================================================================

-- 1. Ensure public.restaurants has tax_rate and tax_rate_percent columns
ALTER TABLE IF EXISTS public.restaurants
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 16.00,
ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5, 2) DEFAULT 16.00;

-- 2. Ensure public.branch_settings has tax_rate and tax_rate_percent columns
ALTER TABLE IF EXISTS public.branch_settings
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 16.00,
ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5, 2) DEFAULT 16.00;

-- 3. Create helper index for rapid tenant settings lookup
CREATE INDEX IF NOT EXISTS idx_branch_settings_restaurant_id ON public.branch_settings(restaurant_id);
