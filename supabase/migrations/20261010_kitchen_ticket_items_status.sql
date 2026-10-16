-- Migration: Add items_status JSONB column to kitchen_tickets for item-level tracking
-- Structure: [{item_id, name, quantity, status, started_at, completed_at, prep_time_minutes, notes}]

ALTER TABLE IF EXISTS public.kitchen_tickets
ADD COLUMN IF NOT EXISTS items_status JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for fast JSONB querying on kitchen_tickets
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_items_status
ON public.kitchen_tickets USING gin (items_status);
