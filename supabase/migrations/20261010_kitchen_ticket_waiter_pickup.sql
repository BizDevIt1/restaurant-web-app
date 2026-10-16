-- Migration: Add ready_for_pickup_at and picked_up_at to kitchen_tickets
-- Supports kitchen-to-waiter handoff workflow, realtime pickup alerts, and 5-min SLA tracking

ALTER TABLE IF EXISTS public.kitchen_tickets
ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

-- Indices for rapid querying and filtering of tickets waiting for waiter pickup
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_ready_for_pickup_at 
ON public.kitchen_tickets (ready_for_pickup_at);

CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_picked_up_at 
ON public.kitchen_tickets (picked_up_at);
