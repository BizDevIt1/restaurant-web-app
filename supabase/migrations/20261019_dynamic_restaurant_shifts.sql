-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20261019_dynamic_restaurant_shifts.sql
-- Purpose: Dynamic, multi-shift configuration per restaurant with operating hours
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.restaurant_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    shift_name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_shifts_restaurant_id ON public.restaurant_shifts(restaurant_id, sort_order);

ALTER TABLE IF EXISTS public.restaurant_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all restaurant_shifts operations" ON public.restaurant_shifts;
CREATE POLICY "Allow all restaurant_shifts operations" ON public.restaurant_shifts FOR ALL USING (true);
