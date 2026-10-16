-- Migration: Add delivery and rider metadata columns to kitchen_tickets
-- Enhances delivery and takeaway orders with customer address, rider tracking & ETA

ALTER TABLE IF EXISTS public.kitchen_tickets
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine_in',
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_area TEXT,
ADD COLUMN IF NOT EXISTS rider_name TEXT,
ADD COLUMN IF NOT EXISTS rider_eta INTEGER,
ADD COLUMN IF NOT EXISTS rider_delayed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rider_waiting_since TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rider_waiting_minutes INTEGER;

-- Index on order_type for quick channel filtering
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order_type 
ON public.kitchen_tickets (order_type);
