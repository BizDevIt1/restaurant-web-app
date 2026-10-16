-- Migration: Add pause tracking columns to kitchen_tickets
-- Allows kitchen staff to temporarily pause tickets (out of stock, waiting for ingredient, customer request, etc.)
-- without counting paused duration against cooking prep time.

ALTER TABLE IF EXISTS public.kitchen_tickets
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pause_reason TEXT,
ADD COLUMN IF NOT EXISTS total_paused_seconds INTEGER DEFAULT 0;

-- Update status check constraint to allow 'paused' alongside existing statuses
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
CHECK (status IN ('queued', 'preparing', 'paused', 'ready', 'completed', 'cancelled', 'archived', 'fulfilled'));

-- Index on status for filtering paused tickets
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_status 
ON public.kitchen_tickets (status);
