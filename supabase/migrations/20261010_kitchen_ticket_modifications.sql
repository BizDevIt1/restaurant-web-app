-- Migration: Add order modification and void tracking to kitchen_tickets
-- Tracks modifications (added, removed, qty_changed items) and void metadata

ALTER TABLE IF EXISTS public.kitchen_tickets
ADD COLUMN IF NOT EXISTS modifications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS void_reason TEXT,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

-- Update status check constraint to include 'voided'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kitchen_tickets_status_check'
    ) THEN
        ALTER TABLE public.kitchen_tickets DROP CONSTRAINT kitchen_tickets_status_check;
    END IF;
END $$;

ALTER TABLE public.kitchen_tickets
ADD CONSTRAINT kitchen_tickets_status_check
CHECK (status IN ('queued', 'preparing', 'paused', 'ready', 'completed', 'cancelled', 'archived', 'fulfilled', 'voided'));

-- Index for searching / filtering modifications or voided tickets
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_modifications 
ON public.kitchen_tickets USING gin (modifications);

CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_voided_at
ON public.kitchen_tickets (voided_at)
WHERE voided_at IS NOT NULL;
