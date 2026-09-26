export type UserRole = "STANDALONE_ADMIN" | "FRANCHISE_OWNER" | "BRANCH_ADMIN" | "STAFF_MEMBER" | "ADMIN";

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
  terminalAccess?: "FULL_ADMIN" | "POS_ONLY" | "KDS_ONLY" | "RIDER_ONLY";
  staffRole?: "manager" | "cashier" | "chef" | "rider" | "waiter";
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
  shift: "Morning" | "Evening" | "Night" | "Evening Rush" | "Night Owl";
  status: "active" | "on_break" | "offline" | "inactive" | "suspended";
  assignedScreen: "POS Counter" | "Kitchen (KDS)" | "Rider Dispatch" | "Full Admin";
  terminalAccess?: "FULL_ADMIN" | "POS_ONLY" | "KDS_ONLY" | "RIDER_ONLY";
  assigned_zones?: string[];
  avatar: string;
  joinedDate: string;
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
  kitchenBuzzerEnabled: boolean;
  openingTime: string;
  closingTime: string;
  taxRatePercent?: number;
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
  recipeCost?: number;
  recipeMargin?: number;
  hasRecipe?: boolean;
  // Dynamic Recipe Availability & Stock Persistence helpers:
  is_available?: boolean;
  in_stock?: boolean;
  isAutoOutOfStock?: boolean;
  maxPortions?: number;
  missingIngredients?: string[];
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  notes?: string;
}

export interface TableStatus {
  id: number;
  label: string;
  capacity: number;
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
  tableOrChannel: string;
  orderType: "dine_in" | "takeaway" | "delivery";
  elapsedMinutes: number;
  items: { id?: string; name: string; qty: number; notes?: string; prepTime?: string; preparation_time?: number }[];
  status: "queued" | "preparing" | "ready" | "completed" | "cancelled";
  serverName: string;
  priority?: "urgent" | "normal";
  createdAt?: string;
  created_at?: string;
  isDeducted?: boolean;
  deductedAt?: string;
  prepStartedAt?: string;
  prep_timer_started_at?: string;
  estimatedPrepTime?: number;
  estimated_prep_time?: number;
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
  }[];
  subtotal: number;
  taxAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  paymentMethod: "cash" | "card" | "raast";
  cashierName: string;
  timestamp: string;
  created_at?: string;
  createdAt?: string;
  kotId?: string;
  status: "completed" | "cancelled" | "active" | "queued" | "preparing" | "ready" | "out_for_delivery" | string;
  isDeducted?: boolean;
  deductedAt?: string;
  estimatedPrepTime?: number;
  estimated_prep_time?: number;
  prepStartedAt?: string;
  prep_started_at?: string;
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

