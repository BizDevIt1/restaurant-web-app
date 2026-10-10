-- ==============================================================================
-- Migration: 20261005_recipe_items_variant_support.sql
-- Purpose: Add variant_id and variant_name support to recipe_items
--          Enables granular per-size recipe ingredients and portion mapping
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'recipe_items' 
          AND column_name = 'variant_id'
    ) THEN
        ALTER TABLE public.recipe_items ADD COLUMN variant_id VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'recipe_items' 
          AND column_name = 'variant_name'
    ) THEN
        ALTER TABLE public.recipe_items ADD COLUMN variant_name VARCHAR(100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recipe_items_variant_id ON public.recipe_items(variant_id);
