export type UserRole = "STANDALONE_ADMIN" | "FRANCHISE_OWNER" | "BRANCH_ADMIN" | "STAFF_MEMBER" | "ADMIN" | "SUPER_ADMIN";

export interface BranchData {
  id: string;
  name: string;
  code: string; // e.g. LHR-01, ISB-02, KHI-01
  city: string;
  address: string;
  phone?: string;
  managerName: string;
  managerEmail?: string;
  assignedFeatures?: string[]; // e.g. ['POS', 'KITCHEN', 'RIDER', 'MENU', 'STAFF']
  status: "ACTIVE" | "INACTIVE" | any;
  todaySales?: number;
  activeOrders?: number;
  rating?: number;
  isHq?: boolean;
  organizationId?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  userType?: "ADMIN" | "STAFF";
  restaurantName: string; // Super Admin assigned restaurant brand name
  city?: string;          // Dynamic city set by Super Admin (e.g. "Karachi", "Gujranwala", "Islamabad")
  address?: string;       // Physical headquarters / outlet address
  phone?: string;         // Official contact phone
  cuisine?: string;       // Cuisine category
  logoUrl?: string;       // Custom restaurant brand logo (public.restaurants.logo_url)
  branchId?: string;      // Set for BRANCH_ADMIN or STANDALONE_ADMIN
  branchName?: string;    // Set for BRANCH_ADMIN (specific outlet name)
  branches?: BranchData[]; // Set for FRANCHISE_OWNER (contains real branches from Super Admin & Franchiser)
  assignedFeatures: string[]; // Only modules enabled by Super Admin (or delegated for Branch Admin)
  restaurantType?: "STANDALONE" | "FRANCHISE";
  branchesCount?: number;
  organizationId?: string;
  restaurantId?: string;
  terminalAccess?: "FULL_ADMIN" | "POS_ONLY" | "KDS_ONLY" | "RIDER_ONLY" | "MANAGER_ONLY" | "WAITER_ONLY";
  staffRole?: "manager" | "cashier" | "chef" | "rider" | "waiter";
  assignedShift?: string;
  assigned_station?: "grill" | "fry" | "pastry" | "beverages" | "assembly" | string | null;
  assignedStation?: "grill" | "fry" | "pastry" | "beverages" | "assembly" | string | null;
  enableKitchenKds?: boolean;
  enableTableService?: boolean;
  enableDirectThermalPrint?: boolean;
  enableOfflineSync?: boolean;
}

// Backwards compatibility aliases
export type UserProfile = AuthenticatedUser;
export type PersonaRole = "franchiser" | "branch_admin" | "standalone";

export type AdminTab =
  | "overview"
  | "branches"
  | "staff"
  | "menu"
  | "inventory"
  | "procurement"
  | "expenses"
  | "tables"
  | "pos"
  | "kds"
  | "riders"
  | "orders"
  | "analytics"
  | "settings"
  | "subscription"
  | "profile";

export interface RestaurantTable {
  id: string | number;
  restaurant_id: number;
  branch_id?: string | number | null;
  table_number: string;
  section_name: string;
  seating_capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED" | string;
  current_order_id?: string | number | null;
  active_covers?: number;
  is_active?: boolean;
  qr_code_url?: string;
  created_at?: string;
  updated_at?: string;
}


export interface RawMaterial {
  id: number | string;
  restaurant_id: number;
  branch_id?: number | string | null;
  name: string;
  sku?: string;
  category: string;
  unit: string;
  current_stock: number;
  min_safety_stock: number;
  cost_per_unit: number;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeItem {
  id?: number | string;
  restaurant_id: number;
  menu_item_id: string | number;
  raw_material_id: number | string;
  quantity_required: number;
  unit: string;
  created_at?: string;
  // Joined / UI helper fields
  raw_material_name?: string;
  raw_material_category?: string;
  cost_per_unit?: number;
}

export interface InventoryWastage {
  id?: number | string;
  restaurant_id: number;
  raw_material_id?: number | string | null;
  raw_material_name?: string;
  quantity: number;
  unit: string;
  cost_loss: number;
  reason: string;
  logged_by: string;
  created_at?: string;
}

export type ModuleFeature = "pos" | "kds" | "rider" | "inventory" | "staff" | "analytics";

export interface Branch extends BranchData {
  status: "ACTIVE" | "INACTIVE" | any;
  assignedModules?: ModuleFeature[];
}

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  password?: string;
  role: "manager" | "cashier" | "chef" | "rider" | "waiter";
  branchId: string;
  branchName: string;
  phone: string;
  shift:
    | "First Shift (Morning)"
    | "Second Shift (Evening)"
    | "Third Shift (Night / Closing)"
    | "Morning"
    | "Evening"
    | "Night"
    | "Evening Rush"
    | "Night Owl"
    | string;
  status: "active" | "on_break" | "offline" | "inactive" | "suspended";
  assignedScreen: "POS Counter" | "Kitchen (KDS)" | "Rider Dispatch" | "Full Admin" | "Waiter Station" | "Manager Terminal";
  terminalAccess?: "FULL_ADMIN" | "POS_ONLY" | "KDS_ONLY" | "RIDER_ONLY" | "WAITER_ONLY" | "MANAGER_ONLY";
  assigned_zones?: string[];
  assigned_station?: "grill" | "fry" | "pastry" | "beverages" | "assembly" | string | null;
  assignedStation?: "grill" | "fry" | "pastry" | "beverages" | "assembly" | string | null;
  avatar: string;
  joinedDate: string;
}

export type KitchenStationType =
  | "all"
  | "grill"
  | "fry"
  | "pastry"
  | "beverages"
  | "assembly"
  | "desi"
  | "fast_food"
  | string;

export interface KitchenStation {
  id: number | string;
  restaurant_id: number | string;
  station_name: KitchenStationType | string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RiderDelivery {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  riderName: string;
  riderPhone: string;
  branchId: string;
  branchName: string;
  status: "assigned" | "picked_up" | "on_route" | "delivered";
  orderAmount: number;
  itemsCount: number;
  etaMinutes: number;
  paymentMethod: "cash" | "card" | "raast";
  dispatchedAt: string;
  assignedAt: string;
  deliveredAt?: string;
}

export interface OperationalNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "warning" | "info" | "success" | "urgent";
  branchName?: string;
  read: boolean;
}

export interface BranchSettings {
  branchDisplayName: string;
  address: string;
  phone: string;
  printerIp: string;
  printerPaperWidth?: string;
  kitchenBuzzerEnabled: boolean;
  openingTime: string;
  closingTime: string;
  taxRatePercent?: number;
  currencySymbol?: string;
}

export interface VariantRecipeItem {
  raw_material_id: string | number;
  raw_material_name?: string;
  quantity_required: number;
  unit?: string;
  cost_per_unit?: number;
}

export interface ItemVariant {
  id: string;
  name: string; // e.g. "Small", "Medium", "Large", "Half", "Full", "Single Petti", "Double Petti"
  price: number;
  isDefault?: boolean;
  image_url?: string;
  imageUrl?: string;
  recipe?: VariantRecipeItem[];
  quantity_multiplier?: number;
  raw_material_id?: string | number;
  raw_material_qty?: number;
  maxPortions?: number;
  availablePortions?: number;
  isOutOfStock?: boolean;
  stockStatus?: "in_stock" | "low_stock" | "out_of_stock";
  limitingIngredient?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: "bbq" | "karahi" | "burgers" | "drinks" | "desserts" | string;
  price: number;
  prepTime: string;
  preparation_time?: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  stockCount: number;
  imageIcon: string;
  description?: string;
  isPopular?: boolean;
  is_popular?: boolean;
  isFeatured?: boolean;
  is_featured?: boolean;
  recipeCost?: number;
  recipeMargin?: number;
  hasRecipe?: boolean;
  variants?: ItemVariant[];
  image_url?: string;
  imageUrl?: string;
  selectedVariant?: ItemVariant;
  kitchen_station?: KitchenStationType | string;
  station?: KitchenStationType | string;
  // Dynamic Recipe Availability & Stock Persistence helpers:
  is_available?: boolean;
  in_stock?: boolean;
  isAutoOutOfStock?: boolean;
  maxPortions?: number;
  availablePortions?: number;
  missingIngredients?: string[];
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  notes?: string;
  selectedVariant?: ItemVariant;
}

export interface TableStatus {
  id: number;
  label: string;
  capacity: number;
  seats?: number;
  status: "available" | "seated" | "billing" | "reserved" | "occupied" | string;
  section?: string;
  sectionName?: string;
  activeOrderId?: string;
  activeAmount?: number;
  timeSeated?: string;
  dbId?: string | number;
}

export interface KitchenTicket {
  id: string;
  dbId?: string | number;
  ticket_number?: string;
  tableOrChannel: string;
  orderType: "dine_in" | "takeaway" | "delivery";
  elapsedMinutes: number;
  items: {
    id?: string;
    name: string;
    qty: number;
    notes?: string;
    prepTime?: string;
    preparation_time?: number;
    selectedVariant?: ItemVariant;
    variant?: ItemVariant;
    variant_id?: string | number | null;
    variant_name?: string | null;
    modifiers?: string[];
    category?: string;
    station?: KitchenStationType | string;
    kitchen_station?: KitchenStationType | string;
  }[];
  status: "queued" | "preparing" | "ready" | "completed" | "cancelled" | "archived" | "fulfilled" | "paused" | "voided" | string;
  serverName: string;
  priority?: KitchenTicketPriority;
  priority_reason?: KitchenTicketPriorityReason | string | null;
  createdAt?: string;
  created_at?: string;
  isDeducted?: boolean;
  deductedAt?: string;
  prepStartedAt?: string;
  prep_timer_started_at?: string;
  estimatedPrepTime?: number;
  estimated_prep_time?: number;
  station_assigned?: "grill" | "fry" | "pastry" | "beverages" | "assembly" | string | null;
  station?: "grill" | "fry" | "pastry" | "beverages" | "assembly" | string | null;
  items_status?: KdsItemStatusRecord[] | null;
  printed_at?: string | null;
  reprint_count?: number;
  ready_for_pickup_at?: string | null;
  picked_up_at?: string | null;
  completed_at?: string | null;
  completedAt?: string | null;
  order_type?: "dine_in" | "takeaway" | "delivery" | string;
  customer_name?: string | null;
  customerName?: string | null;
  tableId?: number | string;
  tableName?: string;
  table_id?: number | string;
  table_number?: string;
  customer_phone?: string | null;
  customerPhone?: string | null;
  delivery_address?: string | null;
  deliveryAddress?: string | null;
  delivery_area?: string | null;
  deliveryArea?: string | null;
  rider_name?: string | null;
  riderName?: string | null;
  rider_eta?: number | string | null;
  riderEta?: number | string | null;
  rider_delayed?: boolean | null;
  riderDelayed?: boolean | null;
  rider_waiting_minutes?: number | null;
  rider_waiting_since?: string | null;
  notes?: string | null;
  chef_notes?: string | null;
  paused_at?: string | null;
  pausedAt?: string | null;
  pause_reason?: string | null;
  pauseReason?: string | null;
  total_paused_seconds?: number | null;
  totalPausedSeconds?: number | null;
  modifications?: KitchenTicketModification[] | null;
  void_reason?: string | null;
  voidReason?: string | null;
  voided_at?: string | null;
  voidedAt?: string | null;
  isExpired?: boolean;
  is_expired?: boolean;
  orderId?: string | number;
}

export interface KitchenTicketModification {
  type: "added" | "removed" | "qty_changed";
  item_name: string;
  qty?: number;
  old_qty?: number;
  new_qty?: number;
  modified_at: string;
  modified_by?: string;
}

export interface KitchenPerformanceDaily {
  id?: number | string;
  chef_id: string;
  restaurant_id: number | string;
  date: string;
  orders_completed: number;
  avg_prep_time_seconds: number;
  on_time_orders: number;
  overdue_orders: number;
  items_cooked: number;
  created_at?: string;
  updated_at?: string;
}

export type KitchenTicketPriority = "rush" | "high" | "normal" | "chill" | "urgent";

export type KitchenTicketPriorityReason =
  | "vip_customer"
  | "delivery_sla"
  | "manager_marked"
  | "auto_escalated";

export type KdsDishStatus = "waiting" | "cooking" | "ready";

export interface KdsItemStatusRecord {
  item_id: string;
  name: string;
  quantity: number;
  status: KdsDishStatus;
  started_at?: string | null;
  completed_at?: string | null;
  prep_time_minutes?: number;
  notes?: string;
  modifiers?: string[];
  variant_name?: string | null;
  special_instructions?: string | null;
}

export type KdsTicket = KitchenTicket;

export interface OrderRecord {
  id: string;
  orderChannel: "dine_in" | "takeaway" | "delivery";
  delivery_zone?: string;
  customerName?: string;
  customerPhone?: string;
  rider_id?: string | null;
  assignedRiderId?: string;
  assignedRiderName?: string;
  tableId?: number;
  tableName?: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
    prepTime?: string;
    preparation_time?: number;
    selectedVariant?: ItemVariant;
    variant?: ItemVariant;
    variant_id?: string | number | null;
    variant_name?: string | null;
    is_deducted?: boolean;
    isDeducted?: boolean;
  }[];
  subtotal: number;
  taxAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  paymentMethod: "cash" | "card" | "raast" | "split";
  cashierName: string;
  timestamp: string;
  created_at?: string;
  createdAt?: string;
  kotId?: string;
  status: "completed" | "cancelled" | "active" | "queued" | "preparing" | "ready" | "out_for_delivery" | string;
  payment_status?: "paid" | "pending" | "refunded" | string;
  paymentStatus?: "paid" | "pending" | "refunded" | string;
  is_deducted?: boolean;
  isDeducted?: boolean;
  deductedAt?: string;
  estimatedPrepTime?: number;
  estimated_prep_time?: number;
  prepStartedAt?: string;
  prep_started_at?: string;
  shift_id?: number | string | null;
  isExpired?: boolean;
  is_expired?: boolean;
}

export interface BillingInvoice {
  id: string;
  invoiceNumber: string;
  period: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "overdue";
  paymentMethod: string;
  planName: string;
  taxAmount?: number;
  subtotal?: number;
}

export interface ShiftSettlement {
  id?: number | string;
  restaurant_id: number;
  branch_id?: number | string | null;
  cashier_name: string;
  shift_start: string;
  shift_end: string;
  opening_float: number;
  system_cash_sales: number;
  system_card_sales: number;
  system_digital_sales: number;
  total_tax_collected: number;
  total_discounts: number;
  gross_sales: number;
  total_orders_count: number;
  actual_cash_counted: number;
  cash_variance: number;
  expected_drawer_cash?: number | null;
  cash_handover_to_next_shift?: number | null;
  shift_type?: string | null;
  status: "OPEN" | "CLOSED" | "AUDITED" | string;
  closing_notes?: string | null;
  created_at?: string;
}

export interface Supplier {
  id: string | number;
  restaurant_id: number;
  branch_id?: string | number | null;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  category: string;
  payment_terms: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrderItem {
  raw_material_id?: number | string;
  name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: string | number;
  restaurant_id: number;
  branch_id?: string | number | null;
  po_number: string;
  supplier_id?: string | number | null;
  supplier_name: string;
  status: "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED" | string;
  total_cost: number;
  items: PurchaseOrderItem[];
  notes?: string;
  expected_delivery?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OperatingExpense {
  id?: number | string;
  restaurant_id: number;
  branch_id?: number | string | null;
  category: string;
  title: string;
  amount: number;
  payment_method: string;
  expense_date: string;
  receipt_url?: string;
  logged_by?: string;
  notes?: string;
  created_at?: string;
}

export function isMenuItemFeatured(item?: Partial<MenuItem> | null): boolean {
  if (!item) return false;
  return Boolean(
    item.isPopular ||
    item.is_popular ||
    item.isFeatured ||
    item.is_featured ||
    (Array.isArray((item as any).tags) &&
      ((item as any).tags.includes("featured") ||
       (item as any).tags.includes("popular") ||
       (item as any).tags.includes("best_seller")))
  );
}

