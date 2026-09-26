-- Migration: 20260919_branches_and_restaurants_schema_fix.sql
-- Purpose: Resolve missing public.branches table and ensure schema consistency across restaurants and branch queries

-- 1. Create public.branches table for multi-branch relational tracking
CREATE TABLE IF NOT EXISTS public.branches (
    id SERIAL PRIMARY KEY,
    restaurant_id BIGINT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Main Branch',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing branch lookups by tenant
CREATE INDEX IF NOT EXISTS idx_branches_restaurant_id ON public.branches(restaurant_id);

-- Enable RLS and permissive policy for multi-tenant queries
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all branches operations" ON public.branches;
CREATE POLICY "Allow all branches operations" ON public.branches FOR ALL USING (true);

-- 2. Align restaurants table schema
-- Ensure restaurants has logo_url, hq_address, owner_email, and optional email alias
ALTER TABLE IF EXISTS public.restaurants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE IF EXISTS public.restaurants ADD COLUMN IF NOT EXISTS hq_address TEXT;
ALTER TABLE IF EXISTS public.restaurants ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Ensure branch_settings unique index by restaurant
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_settings_restaurant_fix ON public.branch_settings(restaurant_id);
