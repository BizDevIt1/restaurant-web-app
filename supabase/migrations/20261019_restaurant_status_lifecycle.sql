-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20261019_restaurant_status_lifecycle.sql
-- Purpose: Real-time restaurant deactivation & cascading deletion lifecycle
-- ==============================================================================

-- 1. Ensure status and initial_status columns exist on public.restaurants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'restaurants' 
          AND column_name = 'status'
    ) THEN
        ALTER TABLE public.restaurants ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'restaurants' 
          AND column_name = 'initial_status'
    ) THEN
        ALTER TABLE public.restaurants ADD COLUMN initial_status VARCHAR(50) DEFAULT 'Active';
    END IF;
END $$;

-- 2. Backfill existing records to have clean default status
UPDATE public.restaurants 
SET status = 'active' 
WHERE status IS NULL OR status = '';

UPDATE public.restaurants 
SET initial_status = 'Active' 
WHERE initial_status IS NULL OR initial_status = '';

-- 3. High-performance index for realtime status checks
CREATE INDEX IF NOT EXISTS idx_restaurants_id_status ON public.restaurants(id, status);
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON public.restaurants(status);
