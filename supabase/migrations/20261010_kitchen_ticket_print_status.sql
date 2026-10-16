-- Migration: Add printed_at and reprint_count columns to kitchen_tickets
-- Tracks physical thermal printer KOT dispatch history

ALTER TABLE IF EXISTS public.kitchen_tickets
ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reprint_count INTEGER DEFAULT 0;

-- Index on printed_at for quick filtering of unprinted kitchen tickets
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_printed_at 
ON public.kitchen_tickets (printed_at);
