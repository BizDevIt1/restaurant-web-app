-- Migration: Add priority & priority_reason columns to kitchen_tickets
-- Priority values: rush, high, normal, chill (with 'urgent' supported for backward compatibility)
-- Priority reasons: vip_customer, delivery_sla, manager_marked, auto_escalated

-- 1. Drop existing priority check constraint if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'kitchen_tickets_priority_check'
  ) THEN
    ALTER TABLE public.kitchen_tickets DROP CONSTRAINT kitchen_tickets_priority_check;
  END IF;
END $$;

-- 2. Ensure priority column exists with default 'normal'
ALTER TABLE IF EXISTS public.kitchen_tickets
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- 3. Add priority check constraint allowing rush, high, normal, chill, and legacy urgent
ALTER TABLE IF EXISTS public.kitchen_tickets
ADD CONSTRAINT kitchen_tickets_priority_check 
CHECK (priority IN ('rush', 'high', 'normal', 'chill', 'urgent'));

-- 4. Add priority_reason column
ALTER TABLE IF EXISTS public.kitchen_tickets
ADD COLUMN IF NOT EXISTS priority_reason TEXT;

-- 5. Add check constraint for priority_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'kitchen_tickets_priority_reason_check'
  ) THEN
    ALTER TABLE public.kitchen_tickets
    ADD CONSTRAINT kitchen_tickets_priority_reason_check
    CHECK (priority_reason IS NULL OR priority_reason IN ('vip_customer', 'delivery_sla', 'manager_marked', 'auto_escalated'));
  END IF;
END $$;

-- 6. Index on priority for fast sorting
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_priority 
ON public.kitchen_tickets (priority);

-- 7. Combined index for priority-based KDS sorting
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_priority_created 
ON public.kitchen_tickets (priority, created_at ASC);
