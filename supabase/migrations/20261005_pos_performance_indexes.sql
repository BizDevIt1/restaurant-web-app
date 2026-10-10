-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20261005_pos_performance_indexes.sql
-- Purpose: Adds composite indexes for lightning-fast POS querying & zero-lag orders/shift lookups
-- ==============================================================================

-- 1. Fast live order lookups by restaurant, shift, and creation timestamp
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created ON public.orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_rest_status ON public.orders(restaurant_id, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON public.orders(shift_id);

-- 2. Fast shift lookup and previous shift handover queries
CREATE INDEX IF NOT EXISTS idx_shift_settlements_rest_status ON public.shift_settlements(restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_settlements_rest_cashier ON public.shift_settlements(restaurant_id, cashier_name, status);

-- 3. Fast recipe BOM and stock validation queries
CREATE INDEX IF NOT EXISTS idx_recipe_items_rest_menu ON public.recipe_items(restaurant_id, menu_item_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_rest ON public.raw_materials(restaurant_id);

-- 4. Fast menu items & table status lookups
CREATE INDEX IF NOT EXISTS idx_menu_items_rest_created ON public.menu_items(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_rest ON public.restaurant_tables(restaurant_id, table_number);
