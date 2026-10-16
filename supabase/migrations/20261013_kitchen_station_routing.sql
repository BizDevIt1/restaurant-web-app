-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- Migration: 20261013_kitchen_station_routing.sql
-- Purpose: Item-Level Kitchen Station Routing & Chef Station Terminal Isolation
-- Stations: grill, fry, pastry, beverages, assembly, desi, fast_food
-- ==============================================================================

-- 1. Add kitchen_station column to public.menu_items
ALTER TABLE IF EXISTS public.menu_items
    ADD COLUMN IF NOT EXISTS kitchen_station VARCHAR(50) DEFAULT 'assembly';

CREATE INDEX IF NOT EXISTS idx_menu_items_kitchen_station 
    ON public.menu_items(restaurant_id, kitchen_station);

-- 2. Relax kitchen_stations station_name check constraint to allow desi, fast_food, etc.
ALTER TABLE IF EXISTS public.kitchen_stations
    DROP CONSTRAINT IF EXISTS kitchen_stations_station_name_check;

-- Add updated check constraint including all stations
ALTER TABLE IF EXISTS public.kitchen_stations
    ADD CONSTRAINT kitchen_stations_station_name_check 
    CHECK (station_name IN ('grill', 'fry', 'pastry', 'beverages', 'assembly', 'desi', 'fast_food'));

-- 3. Seed default kitchen stations (including desi and fast_food) for existing restaurants
INSERT INTO public.kitchen_stations (restaurant_id, station_name, is_active)
SELECT r.id, s.station_name, true
FROM public.restaurants r
CROSS JOIN (
    VALUES ('grill'), ('fry'), ('pastry'), ('beverages'), ('assembly'), ('desi'), ('fast_food')
) AS s(station_name)
ON CONFLICT DO NOTHING;

-- 4. Ensure kitchen_tickets has index on station_assigned
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_station_assigned
    ON public.kitchen_tickets(restaurant_id, station_assigned);
