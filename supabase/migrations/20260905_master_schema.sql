-- ==============================================================================
-- OMNIBITES ENTERPRISE RESTAURANT SAAS PLATFORM
-- File: supabase/migrations/20260905_master_schema.sql
-- Architecture: Multi-Tenant Architecture with Tenant Isolation & Staff RBAC
--
-- ==============================================================================
-- OPERATIONAL STAFF ROUTING SPECIFICATION:
-- 1. When user logs in with email/password from 'staff_members':
--    - If terminal_access == 'POS_ONLY'   => Redirect to `/admin?tab=pos` (Lock sidebar, kiosk mode)
--    - If terminal_access == 'KDS_ONLY'   => Redirect to `/admin?tab=kds` (Fullscreen Kitchen screen)
--    - If terminal_access == 'RIDER_ONLY' => Redirect to `/admin?tab=riders` (Dispatch & courier panel)
--    - If terminal_access == 'FULL_ADMIN' => Redirect to `/admin?tab=overview` (Full management access)
--
-- Safety Guarantees:
-- - STRICTLY NON-DESTRUCTIVE: Zero DROP, TRUNCATE, or data-loss statements.
-- - FULLY IDEMPOTENT: Uses CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--   DROP POLICY IF EXISTS, and DO-block exception handlers.
-- - FOREIGN KEYS GROUNDED: restaurants(id) is verified BIGINT in this Supabase instance.
--   All restaurant_id columns are typed as BIGINT with ON DELETE CASCADE.
-- - PERMISSIVE DEVELOPMENT RLS: Enabled on all tables with open policies for Next.js.
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABLE: staff_members
-- Staff authentication, operational credentials, role delegation & terminal access
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    branch_name TEXT,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager', 'cashier', 'chef', 'rider', 'waiter')),
    terminal_access TEXT NOT NULL CHECK (terminal_access IN ('FULL_ADMIN', 'POS_ONLY', 'KDS_ONLY', 'RIDER_ONLY')),
    shift TEXT DEFAULT 'Evening' CHECK (shift IN ('Morning', 'Evening Rush', 'Night Owl', 'Evening', 'Night')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'on_break', 'offline')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 2. TABLE: menu_categories
-- Structured categories for catalog navigation, sorting, and display filtering
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 3. TABLE: menu_items
-- Food catalog items, pricing, inventory stock status, and preparation timers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'General',
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    prep_time TEXT DEFAULT '15 mins',
    stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock')),
    stock_count INTEGER DEFAULT 50,
    is_popular BOOLEAN DEFAULT false,
    image_url TEXT,
    image_icon TEXT DEFAULT '🍲',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 4. TABLE: menu_modifiers
-- Dish customizations, add-ons, portion variants, and upcharge pricing
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.menu_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 5. TABLE: restaurant_tables
-- Dining floor matrix, seating capacity, occupancy state, and digital QR codes
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    floor_name TEXT NOT NULL DEFAULT 'Main Dining',
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'billed', 'seated')),
    active_order_id UUID,
    qr_code_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 6. TABLE: orders
-- Customer sales orders, multi-channel billing, financial breakdown, and payments
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    order_number TEXT NOT NULL,
    order_channel TEXT NOT NULL DEFAULT 'dine_in' CHECK (order_channel IN ('dine_in', 'takeaway', 'delivery')),
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'raast')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    order_status TEXT NOT NULL DEFAULT 'completed' CHECK (order_status IN ('active', 'completed', 'cancelled')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    cashier_name TEXT DEFAULT 'Terminal Cashier',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 7. TABLE: order_items
-- Normalized relational line items for orders with item breakdown and modifiers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    modifiers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 8. TABLE: kitchen_tickets
-- Kitchen Display System (KDS) prep tickets, stage transitions, and prep timers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.kitchen_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    table_number TEXT,
    channel TEXT NOT NULL DEFAULT 'dine_in',
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'preparing', 'ready', 'completed')),
    prep_timer_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    server_name TEXT DEFAULT 'Front Desk',
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
    elapsed_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 9. TABLE: deliveries
-- Logistics telemetry, assigned riders, delivery addresses, and cash collection
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
    customer_address TEXT NOT NULL,
    customer_phone TEXT,
    delivery_status TEXT NOT NULL DEFAULT 'ready_for_pickup' CHECK (delivery_status IN ('ready_for_pickup', 'assigned', 'picked_up', 'on_route', 'delivered', 'failed')),
    cod_amount NUMERIC(10, 2) DEFAULT 0.00,
    assigned_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 10. TABLE: branch_settings
-- Thermal printer IPs, kitchen buzzer flags, regional tax rates & operating hours
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.branch_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL,
    thermal_printer_ip TEXT DEFAULT '192.168.1.180',
    kitchen_buzzer_enabled BOOLEAN DEFAULT true,
    tax_authority_name TEXT DEFAULT 'Punjab Revenue Authority (PRA)',
    tax_rate_percent NUMERIC(5, 2) DEFAULT 16.00,
    opening_time TEXT DEFAULT '11:00 AM',
    closing_time TEXT DEFAULT '02:00 AM',
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_branch_settings UNIQUE (restaurant_id, branch_id)
);

-- ==============================================================================
-- 11. HIGH-PERFORMANCE INDEXES
-- Indexing tenant scopes, branches, foreign keys, order dates, and status fields
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_members_restaurant ON public.staff_members(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_branch ON public.staff_members(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_email ON public.staff_members(email);
CREATE INDEX IF NOT EXISTS idx_staff_members_terminal ON public.staff_members(terminal_access);

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON public.menu_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_stock ON public.menu_items(stock_status);
CREATE INDEX IF NOT EXISTS idx_menu_modifiers_item ON public.menu_modifiers(item_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant ON public.restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_branch ON public.restaurant_tables(branch_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON public.restaurant_tables(status);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON public.orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_restaurant ON public.kitchen_tickets(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_status ON public.kitchen_tickets(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order ON public.kitchen_tickets(order_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_restaurant ON public.deliveries(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider ON public.deliveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(delivery_status);

CREATE INDEX IF NOT EXISTS idx_branch_settings_unique ON public.branch_settings(restaurant_id, branch_id);

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) & PERMISSIVE DEVELOPMENT POLICIES
-- RLS activated on all 10 operational tables with open CRUD development access
-- ==============================================================================
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on staff_members" ON public.staff_members;
CREATE POLICY "Allow all operations on staff_members" ON public.staff_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on menu_categories" ON public.menu_categories;
CREATE POLICY "Allow all operations on menu_categories" ON public.menu_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on menu_items" ON public.menu_items;
CREATE POLICY "Allow all operations on menu_items" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on menu_modifiers" ON public.menu_modifiers;
CREATE POLICY "Allow all operations on menu_modifiers" ON public.menu_modifiers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on restaurant_tables" ON public.restaurant_tables;
CREATE POLICY "Allow all operations on restaurant_tables" ON public.restaurant_tables FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on orders" ON public.orders;
CREATE POLICY "Allow all operations on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on order_items" ON public.order_items;
CREATE POLICY "Allow all operations on order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on kitchen_tickets" ON public.kitchen_tickets;
CREATE POLICY "Allow all operations on kitchen_tickets" ON public.kitchen_tickets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on deliveries" ON public.deliveries;
CREATE POLICY "Allow all operations on deliveries" ON public.deliveries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on branch_settings" ON public.branch_settings;
CREATE POLICY "Allow all operations on branch_settings" ON public.branch_settings FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 13. SUPABASE REALTIME REPLICATION CONFIGURATION
-- Enables live Supabase Realtime broadcast for order dispatch, KDS and tables
-- ==============================================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.staff_members,
            public.menu_categories,
            public.menu_items,
            public.restaurant_tables,
            public.orders,
            public.order_items,
            public.kitchen_tickets,
            public.deliveries,
            public.branch_settings;
    EXCEPTION
        WHEN duplicate_object THEN
            NULL;
        WHEN undefined_object THEN
            NULL;
    END;
END
$$;
