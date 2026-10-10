-- Migration: Add variants JSONB column to public.menu_items
-- Purpose: Supports portion sizes, volume variants, and portion pricing in Menu Management & POS

ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;
