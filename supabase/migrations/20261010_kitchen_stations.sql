-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20261010_kitchen_stations.sql
-- Purpose: Multi-Station KDS Support (Grill, Fry, Pastry, Beverages, Assembly)
-- ==============================================================================

-- 1. Create kitchen_stations table
CREATE TABLE IF NOT EXISTS public.kitchen_stations (
    id SERIAL PRIMARY KEY,
    restaurant_id BIGINT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    station_name VARCHAR(50) NOT NULL CHECK (station_name IN ('grill', 'fry', 'pastry', 'beverages', 'assembly')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for kitchen_stations
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all kitchen_stations operations" ON public.kitchen_stations;
CREATE POLICY "Allow all kitchen_stations operations" 
    ON public.kitchen_stations FOR ALL USING (true) WITH CHECK (true);

-- Indexes for lightning-fast station querying
CREATE INDEX IF NOT EXISTS idx_kitchen_stations_restaurant ON public.kitchen_stations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_stations_active ON public.kitchen_stations(restaurant_id, is_active);

-- 2. Add assigned_station column to the existing staff_members table
ALTER TABLE public.staff_members
    ADD COLUMN IF NOT EXISTS assigned_station VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_staff_members_assigned_station ON public.staff_members(restaurant_id, assigned_station);

-- 3. Add station_assigned column to kitchen_tickets table
ALTER TABLE public.kitchen_tickets
    ADD COLUMN IF NOT EXISTS station_assigned VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_station_assigned ON public.kitchen_tickets(restaurant_id, station_assigned);

-- 4. Seed default kitchen stations for existing restaurants
INSERT INTO public.kitchen_stations (restaurant_id, station_name, is_active)
SELECT r.id, s.station_name, true
FROM public.restaurants r
CROSS JOIN (
    VALUES ('grill'), ('fry'), ('pastry'), ('beverages'), ('assembly')
) AS s(station_name)
ON CONFLICT DO NOTHING;
