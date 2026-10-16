-- Migration: Add is_deducted persistent atomic idempotency guard flag to orders table
-- Prevents cascading / multi-trigger inventory deductions across order lifecycle

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_deducted BOOLEAN NOT NULL DEFAULT false;

-- Performance index for fast lookup of order deduction state and active reservation exclusion
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_deducted 
ON public.orders(restaurant_id, is_deducted);

CREATE INDEX IF NOT EXISTS idx_orders_number_deducted 
ON public.orders(restaurant_id, order_number, is_deducted);

COMMENT ON COLUMN public.orders.is_deducted IS 'Persistent idempotency guard ensuring raw materials inventory is deducted strictly exact-once across order lifecycle';
