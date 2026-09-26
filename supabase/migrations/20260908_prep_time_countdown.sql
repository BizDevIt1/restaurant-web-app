-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20260908_prep_time_countdown.sql
-- Purpose: Bind dish preparation time to live reverse countdown timers in KDS & Orders
-- ==============================================================================

-- 1. Ensure preparation_time column exists on public.menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 15;

-- Populate existing rows with integer parsed from prep_time if null
UPDATE public.menu_items
SET preparation_time = COALESCE(NULLIF(regexp_replace(prep_time, '[^0-9]', '', 'g'), '')::INTEGER, 15)
WHERE preparation_time IS NULL;

-- 2. Ensure estimated_prep_time and prep_started_at exist on public.orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS estimated_prep_time INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS prep_started_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Ensure estimated_prep_time exists on public.kitchen_tickets (prep_timer_started_at already exists)
ALTER TABLE public.kitchen_tickets
ADD COLUMN IF NOT EXISTS estimated_prep_time INTEGER DEFAULT 15;
