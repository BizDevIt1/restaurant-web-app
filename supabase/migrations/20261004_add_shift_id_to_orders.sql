-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20261004_add_shift_id_to_orders.sql
-- Purpose: Adds shift_id to orders table for shift reconciliation & audit tracking
-- ==============================================================================

-- 1. Ensure public.shifts table exists if referencing shifts(id) with UUID
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    cashier_name VARCHAR(100),
    shift_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shift_end TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add shift_id to public.orders table
-- Notice: In OmniBites, cashier sessions are stored in public.shift_settlements (BIGINT ID).
-- If public.shifts is used with UUID, shift_id can reference public.shifts(id).
-- The DO block safely checks and assigns the appropriate foreign key without crashing.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'orders' 
          AND column_name = 'shift_id'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'shift_settlements'
        ) THEN
            ALTER TABLE public.orders 
            ADD COLUMN shift_id BIGINT REFERENCES public.shift_settlements(id) ON DELETE SET NULL;
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'shifts'
        ) THEN
            ALTER TABLE public.orders 
            ADD COLUMN shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;
        ELSE
            ALTER TABLE public.orders 
            ADD COLUMN shift_id BIGINT;
        END IF;
    END IF;
END $$;

-- 3. Create index for fast shift reconciliation & live order queries
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON public.orders(shift_id);
