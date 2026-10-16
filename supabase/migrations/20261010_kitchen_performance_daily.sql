-- Migration: Create kitchen_performance_daily table
-- Tracks daily chef operational metrics, throughput, prep duration, and SLA adherence

CREATE TABLE IF NOT EXISTS public.kitchen_performance_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chef_id TEXT NOT NULL,
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    orders_completed INTEGER NOT NULL DEFAULT 0,
    avg_prep_time_seconds INTEGER NOT NULL DEFAULT 0,
    on_time_orders INTEGER NOT NULL DEFAULT 0,
    overdue_orders INTEGER NOT NULL DEFAULT 0,
    items_cooked INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_chef_restaurant_date UNIQUE (restaurant_id, chef_id, date)
);

-- Indices for performance aggregation queries
CREATE INDEX IF NOT EXISTS idx_kpd_restaurant_date 
ON public.kitchen_performance_daily (restaurant_id, date);

CREATE INDEX IF NOT EXISTS idx_kpd_chef_date 
ON public.kitchen_performance_daily (chef_id, date);
