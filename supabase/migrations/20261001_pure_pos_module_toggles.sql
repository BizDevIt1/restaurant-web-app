-- Migration: Add standalone Pure POS and Module Toggling flags
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS enable_kitchen_kds BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_table_service BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_direct_thermal_print BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_offline_sync BOOLEAN DEFAULT true;

-- Update existing records to ensure non-null defaults
UPDATE public.restaurants
SET
  enable_kitchen_kds = COALESCE(enable_kitchen_kds, true),
  enable_table_service = COALESCE(enable_table_service, true),
  enable_direct_thermal_print = COALESCE(enable_direct_thermal_print, true),
  enable_offline_sync = COALESCE(enable_offline_sync, true);
