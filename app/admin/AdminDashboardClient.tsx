"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Store,
  Flame,
  ChefHat,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  CreditCard,
  TrendingUp,
  Search,
  Sun,
  Moon,
  Bell,
  Plus,
  Minus,
  Trash2,
  Printer,
  Receipt,
  RotateCcw,
  Sparkles,
  Sliders,
  DollarSign,
  Package,
  Layers,
  ChevronRight,
  ChevronDown,
  Menu as MenuIcon,
  X,
  MapPin,
  Bike,
  Activity,
  Check,
  Percent,
  SlidersHorizontal,
  LogOut,
  Coffee,
  QrCode,
  ShieldCheck,
} from "lucide-react";

// Count up hook for metrics
function useCountUp(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * target));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  return count;
}

// Sample Menu Data for Single-Branch POS & KDS
interface MenuItem {
  id: string;
  name: string;
  category: "bbq" | "karahi" | "burgers" | "drinks" | "desserts";
  price: number;
  prepTime: string;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  stockCount: number;
  imageIcon: string;
  isPopular?: boolean;
}

const INITIAL_MENU: MenuItem[] = [
  {
    id: "item_1",
    name: "Mutton Shinwari Karahi (Half)",
    category: "karahi",
    price: 2450,
    prepTime: "25m",
    stockStatus: "in_stock",
    stockCount: 18,
    imageIcon: "🍲",
    isPopular: true,
  },
  {
    id: "item_2",
    name: "Chicken Makhni Handi",
    category: "karahi",
    price: 1850,
    prepTime: "20m",
    stockStatus: "in_stock",
    stockCount: 24,
    imageIcon: "🥘",
    isPopular: true,
  },
  {
    id: "item_3",
    name: "Beef Seekh Kabab Platter (4 pcs)",
    category: "bbq",
    price: 1350,
    prepTime: "18m",
    stockStatus: "in_stock",
    stockCount: 15,
    imageIcon: "🍢",
    isPopular: true,
  },
  {
    id: "item_4",
    name: "Reshmi Malai Boti",
    category: "bbq",
    price: 1450,
    prepTime: "15m",
    stockStatus: "in_stock",
    stockCount: 20,
    imageIcon: "🍗",
  },
  {
    id: "item_5",
    name: "Smokey Truffle Angus Smash Burger",
    category: "burgers",
    price: 1250,
    prepTime: "12m",
    stockStatus: "in_stock",
    stockCount: 30,
    imageIcon: "🍔",
    isPopular: true,
  },
  {
    id: "item_6",
    name: "Crispy Zinger Crunch Deluxe",
    category: "burgers",
    price: 890,
    prepTime: "10m",
    stockStatus: "low_stock",
    stockCount: 4,
    imageIcon: "🍔",
  },
  {
    id: "item_7",
    name: "Roghni Naan (Sesame Butter)",
    category: "karahi",
    price: 150,
    prepTime: "5m",
    stockStatus: "in_stock",
    stockCount: 120,
    imageIcon: "🫓",
  },
  {
    id: "item_8",
    name: "Kandhari Naan (Special)",
    category: "karahi",
    price: 190,
    prepTime: "5m",
    stockStatus: "in_stock",
    stockCount: 90,
    imageIcon: "🫓",
  },
  {
    id: "item_9",
    name: "Mint Margarita Chiller",
    category: "drinks",
    price: 450,
    prepTime: "4m",
    stockStatus: "in_stock",
    stockCount: 45,
    imageIcon: "🍹",
    isPopular: true,
  },
  {
    id: "item_10",
    name: "Special Matka Chai",
    category: "drinks",
    price: 220,
    prepTime: "6m",
    stockStatus: "in_stock",
    stockCount: 80,
    imageIcon: "☕",
  },
  {
    id: "item_11",
    name: "Sizzling Hot Brownie with Gelato",
    category: "desserts",
    price: 790,
    prepTime: "8m",
    stockStatus: "in_stock",
    stockCount: 12,
    imageIcon: "🍨",
    isPopular: true,
  },
  {
    id: "item_12",
    name: "Shahi Kheer Thali",
    category: "desserts",
    price: 490,
    prepTime: "2m",
    stockStatus: "out_of_stock",
    stockCount: 0,
    imageIcon: "🍮",
  },
];

interface CartItem {
  item: MenuItem;
  quantity: number;
  notes?: string;
}

interface TableStatus {
  id: number;
  label: string;
  capacity: number;
  status: "available" | "seated" | "billing";
  activeOrderId?: string;
  activeAmount?: number;
  timeSeated?: string;
}

const INITIAL_TABLES: TableStatus[] = [
  { id: 1, label: "T-01 (Family Booth)", capacity: 6, status: "seated", activeOrderId: "#ORD-9120", activeAmount: 6450, timeSeated: "28m ago" },
  { id: 2, label: "T-02 (Window Pair)", capacity: 2, status: "available" },
  { id: 3, label: "T-03 (Main Hall)", capacity: 4, status: "seated", activeOrderId: "#ORD-9122", activeAmount: 3790, timeSeated: "14m ago" },
  { id: 4, label: "T-04 (Main Hall)", capacity: 4, status: "billing", activeOrderId: "#ORD-9118", activeAmount: 8900, timeSeated: "55m ago" },
  { id: 5, label: "T-05 (VIP Lounge)", capacity: 8, status: "seated", activeOrderId: "#ORD-9125", activeAmount: 14200, timeSeated: "42m ago" },
  { id: 6, label: "T-06 (Patio Deck)", capacity: 4, status: "available" },
  { id: 7, label: "T-07 (Patio Deck)", capacity: 4, status: "available" },
  { id: 8, label: "T-08 (Family Section)", capacity: 6, status: "seated", activeOrderId: "#ORD-9128", activeAmount: 5120, timeSeated: "10m ago" },
];

interface KitchenTicket {
  id: string;
  tableOrChannel: string;
  orderType: "dine_in" | "takeaway" | "delivery";
  elapsedMinutes: number;
  items: { name: string; qty: number; notes?: string }[];
  status: "queued" | "preparing" | "ready";
  serverName: string;
}

const INITIAL_KDS: KitchenTicket[] = [
  {
    id: "KOT-9120",
    tableOrChannel: "Table 01",
    orderType: "dine_in",
    elapsedMinutes: 19,
    serverName: "Farhan (Server 1)",
    status: "preparing",
    items: [
      { name: "Mutton Shinwari Karahi (Half)", qty: 1, notes: "Low spice, extra ginger" },
      { name: "Reshmi Malai Boti", qty: 2 },
      { name: "Roghni Naan", qty: 4 },
      { name: "Mint Margarita Chiller", qty: 2 },
    ],
  },
  {
    id: "KOT-9122",
    tableOrChannel: "Table 03",
    orderType: "dine_in",
    elapsedMinutes: 8,
    serverName: "Kashif (Server 2)",
    status: "preparing",
    items: [
      { name: "Chicken Makhni Handi", qty: 1 },
      { name: "Beef Seekh Kabab Platter", qty: 1 },
      { name: "Kandhari Naan", qty: 3 },
    ],
  },
  {
    id: "KOT-9127",
    tableOrChannel: "Delivery (FoodPanda #481)",
    orderType: "delivery",
    elapsedMinutes: 4,
    serverName: "Online Dispatch",
    status: "queued",
    items: [
      { name: "Smokey Truffle Angus Smash Burger", qty: 2, notes: "Extra cheese & truffle dip" },
      { name: "Crispy Zinger Crunch Deluxe", qty: 1 },
      { name: "Mint Margarita Chiller", qty: 2 },
    ],
  },
  {
    id: "KOT-9125",
    tableOrChannel: "Table 05 (VIP)",
    orderType: "dine_in",
    elapsedMinutes: 24,
    serverName: "Asad (Head Waiter)",
    status: "ready",
    items: [
      { name: "Mutton Shinwari Karahi (Full)", qty: 1 },
      { name: "Reshmi Malai Boti", qty: 3 },
      { name: "Special Matka Chai", qty: 6 },
    ],
  },
];

export default function AdminDashboardClient({
  initialCollapsed = false,
}: {
  initialCollapsed?: boolean;
}) {
  const router = useRouter();

  // Navigation State
  const [activeTab, setActiveTab] = useState<
    "overview" | "pos" | "kds" | "orders" | "menu" | "analytics" | "settings"
  >("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialCollapsed);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [branchStatus, setBranchStatus] = useState<"open" | "rush" | "paused">("open");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // POS State
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<number>(1);
  const [orderChannel, setOrderChannel] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "raast">("cash");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");

  // KDS State
  const [kdsTickets, setKdsTickets] = useState<KitchenTicket[]>(INITIAL_KDS);
  const [tables, setTables] = useState<TableStatus[]>(INITIAL_TABLES);

  // Animated KPI numbers
  const todayGrossSales = useCountUp(164850, 1000);
  const totalOrdersCount = useCountUp(86, 900);
  const activeFloorOrders = useCountUp(14, 800);
  const avgCookTime = 13.4;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Sync theme
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("app_theme") as "dark" | "light" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_theme", nextTheme);
    }
    showToast(`Switched to ${nextTheme.toUpperCase()} mode`);
  };

  // POS Cart Calculations
  const cartSubtotal = cart.reduce((acc, item) => acc + item.item.price * item.quantity, 0);
  const taxAmount = Math.round(cartSubtotal * 0.16); // 16% GST
  const discountAmount = Math.round((cartSubtotal * discountPercent) / 100);
  const cartTotal = cartSubtotal + taxAmount - discountAmount;

  const handleAddToCart = (item: MenuItem) => {
    if (item.stockStatus === "out_of_stock") {
      showToast(`⚠️ "${item.name}" is currently 86'd / Out of Stock!`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    showToast(`Added ${item.name} to order`);
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.item.id === itemId) {
            const nextQty = ci.quantity + delta;
            return nextQty > 0 ? { ...ci, quantity: nextQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleClearCart = () => {
    setCart([]);
    showToast("Cart cleared");
  };

  const handleSendToKitchen = () => {
    if (cart.length === 0) {
      showToast("Please add items to cart before sending KOT");
      return;
    }

    const newTicket: KitchenTicket = {
      id: `KOT-${Math.floor(1000 + Math.random() * 9000)}`,
      tableOrChannel: orderChannel === "dine_in" ? `Table 0${selectedTable}` : orderChannel.toUpperCase(),
      orderType: orderChannel,
      elapsedMinutes: 0,
      status: "preparing",
      serverName: "Terminal 01",
      items: cart.map((ci) => ({ name: ci.item.name, qty: ci.quantity })),
    };

    setKdsTickets([newTicket, ...kdsTickets]);
    setCart([]);
    showToast(`🔥 Order ${newTicket.id} fired to Kitchen Display System!`);
  };

  const handleToggleStock = (itemId: string) => {
    setMenuItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const nextStatus: "in_stock" | "low_stock" | "out_of_stock" =
            item.stockStatus === "in_stock"
              ? "low_stock"
              : item.stockStatus === "low_stock"
              ? "out_of_stock"
              : "in_stock";
          return { ...item, stockStatus: nextStatus };
        }
        return item;
      })
    );
    showToast("Stock status updated in real-time");
  };

  const handleAdvanceKds = (ticketId: string) => {
    setKdsTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          if (t.status === "queued") return { ...t, status: "preparing" };
          if (t.status === "preparing") return { ...t, status: "ready" };
        }
        return t;
      })
    );
    showToast(`Kitchen status updated for ${ticketId}`);
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCat = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-hi)] flex transition-colors duration-300 antialiased font-sans selection:bg-[var(--gold)]/20 selection:text-[var(--gold)]">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[999] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--bg-deep)] border border-[var(--gold)]/40 text-[var(--gold)] shadow-2xl shadow-black/80 font-mono text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-[var(--gold)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================== SIDEBAR ===================== */}
      <aside
        className={`bg-[var(--bg-deep)] border-r border-[var(--border)] shrink-0 transition-all duration-300 flex flex-col justify-between z-40 fixed lg:static inset-y-0 left-0 ${
          isSidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className="h-20 flex items-center justify-between px-5 border-b border-[var(--border)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f5c85c] via-[#e3b13b] to-[#e04e17] flex items-center justify-center text-[#342c14] font-black text-base shadow-lg shadow-[var(--gold-glow)] shrink-0">
                <Store className="w-5 h-5 stroke-[2.5]" />
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0">
                  <h2 className="font-display font-extrabold text-sm text-[var(--text-hi)] leading-tight truncate">
                    Omnibites <span className="text-[var(--gold)]">POS</span>
                  </h2>
                  <p className="text-[10.5px] font-mono text-[var(--text-faint)] truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] animate-pulse" />
                    Gulberg Main Outlet
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-xl hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors cursor-pointer hidden lg:flex"
              title="Toggle sidebar"
            >
              <MenuIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {[
              { id: "overview", label: "Dashboard", icon: LayoutDashboard, badge: null },
              { id: "pos", label: "POS & Billing", icon: UtensilsCrossed, badge: "Live" },
              { id: "kds", label: "Kitchen Display (KDS)", icon: ChefHat, badge: String(kdsTickets.length) },
              { id: "orders", label: "Live Orders Stream", icon: ShoppingBag, badge: "14" },
              { id: "menu", label: "Menu & 86'd Stock", icon: Package, badge: null },
              { id: "analytics", label: "Daily Sales Report", icon: TrendingUp, badge: null },
              { id: "settings", label: "Branch Settings", icon: Sliders, badge: null },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer select-none group relative ${
                    isActive
                      ? "bg-[var(--gold-dim)] text-[var(--gold)] shadow-sm border border-[var(--gold)]/30 font-extrabold"
                      : "text-[var(--text-lo)] hover:bg-[var(--surface-hi)] hover:text-[var(--text-hi)] border border-transparent"
                  }`}
                  title={item.label}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? "text-[var(--gold)]" : "text-[var(--text-faint)]"
                    }`}
                  />
                  {!isSidebarCollapsed && (
                    <div className="flex items-center justify-between w-full min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isActive
                              ? "bg-[var(--gold)] text-[#342c14]"
                              : "bg-[var(--surface-hi)] text-[var(--text-faint)] group-hover:text-[var(--text-hi)]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[var(--gold)] rounded-r-full shadow-[0_0_10px_var(--gold)]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Terminal Details */}
        <div className="p-4 border-t border-[var(--border)] space-y-3">
          {!isSidebarCollapsed && (
            <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)]">
                <span>TERMINAL ID</span>
                <span className="text-[var(--gold)] font-bold">POS-01</span>
              </div>
              <div className="flex items-center justify-between">
                <span>SHIFT CASHIER</span>
                <span className="font-bold text-[var(--text-hi)]">Tariq (Admin)</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-colors cursor-pointer"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
            </button>

            {!isSidebarCollapsed && (
              <Link
                href="/super-admin/dashboard"
                className="flex-1 px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold font-mono flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit Portal</span>
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ===================== MAIN CONTENT AREA ===================== */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-20 bg-[var(--bg-deep)]/80 backdrop-blur-xl border-b border-[var(--border)] px-5 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
          {/* Branch Identity & Live Status Toggle */}
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-base sm:text-lg text-[var(--text-hi)] truncate">
                  Gulberg Main Branch
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[10px] font-bold uppercase border border-[var(--gold)]/30">
                  Outlet #104
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-lo)] font-mono flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[var(--gold)]" />
                MM Alam Road, Block B2, Lahore
              </p>
            </div>
          </div>

          {/* Quick Actions & Status Mode */}
          <div className="flex items-center gap-3">
            {/* Live Outlet Operating Status Switcher */}
            <div className="flex items-center bg-[var(--surface-hi)] p-1 rounded-2xl border border-[var(--border)]">
              <button
                onClick={() => {
                  setBranchStatus("open");
                  showToast("Branch status set to: OPEN (Accepting all orders)");
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  branchStatus === "open"
                    ? "bg-[#25d366]/20 text-[#25d366] border border-[#25d366]/40 shadow-sm"
                    : "text-[var(--text-faint)] hover:text-[var(--text-hi)]"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
                <span className="hidden sm:inline">Open</span>
              </button>

              <button
                onClick={() => {
                  setBranchStatus("rush");
                  showToast("Branch status set to: HIGH RUSH (+15m prep time)");
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  branchStatus === "rush"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm"
                    : "text-[var(--text-faint)] hover:text-[var(--text-hi)]"
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rush Hour</span>
              </button>

              <button
                onClick={() => {
                  setBranchStatus("paused");
                  showToast("Branch status set to: PAUSED");
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  branchStatus === "paused"
                    ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm"
                    : "text-[var(--text-faint)] hover:text-[var(--text-hi)]"
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Paused</span>
              </button>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => showToast("3 Kitchen KOT items pending delivery pickup")}
              className="p-2.5 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:border-[var(--gold)]/40 transition-colors cursor-pointer relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-[var(--orange)] absolute top-2 right-2 ring-2 ring-[var(--bg-deep)]" />
            </button>

            {/* Quick POS Trigger */}
            <button
              onClick={() => setActiveTab("pos")}
              className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Bill (POS)</span>
            </button>
          </div>
        </header>

        {/* ===================== TAB 1: OVERVIEW DASHBOARD ===================== */}
        {activeTab === "overview" && (
          <div className="p-5 sm:p-8 space-y-7 animate-in fade-in duration-200">
            {/* 1. Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* Today's Sales */}
              <div className="p-5 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-xl relative overflow-hidden space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] font-bold">
                    Today's Gross Sales
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--gold)] font-mono tracking-tight">
                    Rs {todayGrossSales.toLocaleString()}
                  </h3>
                  <p className="text-[11px] text-[#25d366] font-mono font-semibold mt-1 flex items-center gap-1">
                    <span>↑ +18.4%</span>
                    <span className="text-[var(--text-faint)]">vs yesterday</span>
                  </p>
                </div>
              </div>

              {/* Active Floor & Delivery Orders */}
              <div className="p-5 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-xl relative overflow-hidden space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] font-bold">
                    Live Active Orders
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-[var(--orange-dim)] text-[var(--orange)] flex items-center justify-center">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-hi)] font-mono tracking-tight">
                    {activeFloorOrders} <span className="text-xs text-[var(--text-lo)] font-normal">in progress</span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-lo)] font-mono mt-1">
                    6 in Kitchen · 8 Seated
                  </p>
                </div>
              </div>

              {/* Table Occupancy Rate */}
              <div className="p-5 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-xl relative overflow-hidden space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] font-bold">
                    Table Seating Capacity
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-[#25d366]/15 text-[#25d366] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-hi)] font-mono tracking-tight">
                    75% <span className="text-xs text-[var(--text-lo)] font-normal">(6/8 Tables)</span>
                  </h3>
                  <div className="w-full bg-[var(--surface-hi)] h-1.5 rounded-full overflow-hidden mt-2">
                    <div className="bg-gradient-to-r from-[#e3b13b] to-[#25d366] h-full w-3/4 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Avg Kitchen Prep Time */}
              <div className="p-5 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-xl relative overflow-hidden space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] font-bold">
                    Avg Cooking Speed
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-hi)] font-mono tracking-tight">
                    {avgCookTime} <span className="text-xs text-[var(--text-lo)] font-normal">mins</span>
                  </h3>
                  <p className="text-[11px] text-[#25d366] font-mono font-semibold mt-1">
                    ✓ Optimal kitchen velocity
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Middle Row: Hourly Sales Chart + Live Floor Map */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Hourly Sales Activity */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-extrabold text-base text-[var(--text-hi)]">
                      Today's Hourly Revenue Velocity
                    </h3>
                    <p className="text-xs text-[var(--text-lo)] font-mono">Peak hours: 1:00 PM (Lunch) &amp; 9:00 PM (Dinner)</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--gold)]">
                    PKR (Thousands)
                  </span>
                </div>

                {/* Pure CSS/SVG Warm Luxury Bars */}
                <div className="h-48 flex items-end justify-between gap-2 sm:gap-3 pt-6 border-b border-[var(--border)] pb-2">
                  {[
                    { hour: "12 PM", val: 18, peak: false },
                    { hour: "1 PM", val: 38, peak: true },
                    { hour: "2 PM", val: 28, peak: false },
                    { hour: "3 PM", val: 14, peak: false },
                    { hour: "4 PM", val: 8, peak: false },
                    { hour: "5 PM", val: 12, peak: false },
                    { hour: "6 PM", val: 22, peak: false },
                    { hour: "7 PM", val: 34, peak: false },
                    { hour: "8 PM", val: 42, peak: true },
                    { hour: "9 PM", val: 48, peak: true },
                    { hour: "10 PM", val: 32, peak: false },
                  ].map((bar, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      <span className="text-[10px] font-mono font-bold text-[var(--gold)] opacity-0 group-hover:opacity-100 transition-opacity">
                        {bar.val}k
                      </span>
                      <div
                        style={{ height: `${(bar.val / 50) * 100}%` }}
                        className={`w-full rounded-t-xl transition-all duration-300 group-hover:brightness-125 ${
                          bar.peak
                            ? "bg-gradient-to-t from-[#e04e17] via-[#e3b13b] to-[#f5c85c] shadow-[0_0_12px_var(--gold-glow)]"
                            : "bg-[var(--gold-dim)] border border-[var(--gold)]/30 hover:bg-[var(--gold)]/40"
                        }`}
                      />
                      <span className="text-[10px] font-mono text-[var(--text-faint)] group-hover:text-[var(--text-hi)]">
                        {bar.hour}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Floor Matrix */}
              <div className="p-6 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-extrabold text-base text-[var(--text-hi)]">
                    Live Floor Matrix
                  </h3>
                  <span className="text-[10.5px] font-mono text-[#25d366] font-bold">
                    6 Seated
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {tables.map((tbl) => (
                    <div
                      key={tbl.id}
                      onClick={() => {
                        setSelectedTable(tbl.id);
                        setActiveTab("pos");
                        showToast(`Opened POS ticket for ${tbl.label}`);
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer group ${
                        tbl.status === "seated"
                          ? "bg-[var(--gold-dim)]/50 border-[var(--gold)]/50 hover:border-[var(--gold)] shadow-sm"
                          : tbl.status === "billing"
                          ? "bg-amber-500/10 border-amber-500/40 hover:border-amber-400"
                          : "bg-[var(--surface-hi)]/40 border-[var(--border)] hover:border-[var(--border-hi)]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--text-hi)] font-mono">
                          {tbl.label.split(" ")[0]}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            tbl.status === "seated"
                              ? "bg-[#25d366] shadow-[0_0_6px_#25d366]"
                              : tbl.status === "billing"
                              ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
                              : "bg-[var(--text-faint)]"
                          }`}
                        />
                      </div>
                      <div className="mt-2 text-[10px] font-mono text-[var(--text-lo)] flex items-center justify-between">
                        <span>{tbl.capacity} Seats</span>
                        {tbl.activeAmount ? (
                          <span className="text-[var(--gold)] font-bold">
                            Rs {tbl.activeAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[#25d366]">Available</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Live Active KDS / Order Stream Snippet */}
            <div className="p-6 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ChefHat className="w-5 h-5 text-[var(--gold)]" />
                  <h3 className="font-display font-extrabold text-base text-[var(--text-hi)]">
                    Active Kitchen Orders (KDS Queue)
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab("kds")}
                  className="text-xs font-mono font-bold text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Full Screen KDS</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kdsTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <div>
                        <span className="text-xs font-bold text-[var(--text-hi)] font-mono block">
                          {ticket.id}
                        </span>
                        <span className="text-[10px] text-[var(--gold)] font-semibold font-mono">
                          {ticket.tableOrChannel}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                          ticket.status === "ready"
                            ? "bg-[#25d366]/20 text-[#25d366]"
                            : ticket.elapsedMinutes > 15
                            ? "bg-red-500/20 text-red-400 animate-pulse"
                            : "bg-[var(--gold-dim)] text-[var(--gold)]"
                        }`}
                      >
                        ⏱ {ticket.elapsedMinutes}m
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[var(--text-hi)] min-h-[60px]">
                      {ticket.items.slice(0, 3).map((it, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="truncate">{it.name}</span>
                          <span className="font-bold text-[var(--gold)] font-mono ml-2">x{it.qty}</span>
                        </div>
                      ))}
                      {ticket.items.length > 3 && (
                        <span className="text-[10px] text-[var(--text-faint)] font-mono">
                          +{ticket.items.length - 3} more items...
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleAdvanceKds(ticket.id)}
                      className="w-full btn-gold py-2 text-[11px] font-bold cursor-pointer rounded-xl flex items-center justify-center gap-1.5"
                    >
                      {ticket.status === "ready" ? "Mark Picked Up" : "Advance KOT"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: POS & QUICK BILLING ===================== */}
        {activeTab === "pos" && (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0">
            {/* Left: Menu & Item Selector */}
            <div className="flex-1 p-5 sm:p-7 overflow-y-auto space-y-6">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {[
                  { id: "all", label: "All Items" },
                  { id: "karahi", label: "Karahi & Handi" },
                  { id: "bbq", label: "Desi BBQ & Tandoor" },
                  { id: "burgers", label: "Smash Burgers" },
                  { id: "drinks", label: "Beverages & Tea" },
                  { id: "desserts", label: "Desserts" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      selectedCategory === cat.id
                        ? "btn-gold text-[#342c14] shadow-md shadow-[var(--gold-glow)]"
                        : "bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dish by name (e.g. Shinwari, Seekh Kabab, Smash Burger)..."
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-2xl pl-10 pr-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none"
                />
              </div>

              {/* Food Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className={`p-4 rounded-3xl bg-[var(--bg-deep)] border transition-all cursor-pointer group flex flex-col justify-between space-y-3 relative overflow-hidden ${
                      item.stockStatus === "out_of_stock"
                        ? "opacity-45 border-red-500/30 cursor-not-allowed"
                        : "border-[var(--border)] hover:border-[var(--gold)]/60 hover:shadow-xl hover:shadow-[var(--gold-glow)]/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-3xl">{item.imageIcon}</span>
                      {item.stockStatus === "out_of_stock" ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-mono text-[9px] font-bold uppercase">
                          86'd (Sold Out)
                        </span>
                      ) : item.stockStatus === "low_stock" ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[9px] font-bold uppercase">
                          Low: {item.stockCount} left
                        </span>
                      ) : item.isPopular ? (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[9px] font-bold uppercase">
                          ★ Popular
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <h4 className="font-display font-bold text-sm text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors leading-tight">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-[var(--text-faint)] font-mono mt-0.5">
                        Prep: ~{item.prepTime}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                      <span className="font-display font-extrabold text-sm text-[var(--gold)] font-mono">
                        Rs {item.price.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        className="w-7 h-7 rounded-xl bg-[var(--surface-hi)] text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-[#342c14] flex items-center justify-center transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Active POS Cart & Bill Settlement Panel */}
            <div className="w-full lg:w-96 bg-[var(--bg-deep)] border-t lg:border-t-0 lg:border-l border-[var(--border)] p-5 sm:p-6 flex flex-col justify-between space-y-5 shrink-0">
              <div className="space-y-4 min-h-0 flex-1 flex flex-col">
                {/* Channel & Table Selector */}
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1 bg-[var(--surface-hi)] p-1 rounded-2xl border border-[var(--border)] text-xs font-bold font-mono">
                    {(["dine_in", "takeaway", "delivery"] as const).map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setOrderChannel(ch)}
                        className={`py-2 rounded-xl transition-all cursor-pointer text-center capitalize ${
                          orderChannel === ch
                            ? "btn-gold text-[#342c14] shadow-sm"
                            : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                        }`}
                      >
                        {ch.replace("_", "-")}
                      </button>
                    ))}
                  </div>

                  {orderChannel === "dine_in" && (
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-mono text-[var(--text-faint)]">SELECT TABLE:</span>
                      <select
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(Number(e.target.value))}
                        className="bg-[var(--surface-hi)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--gold)] font-mono font-bold focus:outline-none cursor-pointer"
                      >
                        {tables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} ({t.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[160px]">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[var(--border)] rounded-2xl text-[var(--text-faint)] space-y-2">
                      <UtensilsCrossed className="w-7 h-7 text-[var(--text-faint)]" />
                      <p className="text-xs font-mono">Click menu items to add to this order ticket.</p>
                    </div>
                  ) : (
                    cart.map((c) => (
                      <div
                        key={c.item.id}
                        className="p-3 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-[var(--text-hi)] truncate block">
                            {c.item.name}
                          </span>
                          <span className="text-[11px] font-mono text-[var(--gold)]">
                            Rs {(c.item.price * c.quantity).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-[var(--bg-deep)] px-2 py-1 rounded-xl border border-[var(--border)]">
                          <button
                            onClick={() => handleUpdateCartQty(c.item.id, -1)}
                            className="text-[var(--text-faint)] hover:text-red-400 p-0.5 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-xs px-1 text-[var(--text-hi)]">
                            {c.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateCartQty(c.item.id, 1)}
                            className="text-[var(--text-faint)] hover:text-[var(--gold)] p-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Settlement Totals */}
              <div className="pt-4 border-t border-[var(--border)] space-y-3 text-xs">
                <div className="space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-[var(--text-lo)]">
                    <span>Subtotal</span>
                    <span>Rs {cartSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--text-lo)]">
                    <span>Punjab GST (16%)</span>
                    <span>Rs {taxAmount.toLocaleString()}</span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex items-center justify-between text-[#25d366]">
                      <span>Discount ({discountPercent}%)</span>
                      <span>- Rs {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-base font-extrabold text-[var(--gold)] pt-1 border-t border-[var(--border)]">
                    <span>Total Amount</span>
                    <span>Rs {cartTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Selector */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {[
                    { id: "cash", label: "Cash" },
                    { id: "card", label: "Card / POS" },
                    { id: "raast", label: "Raast QR" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPaymentMethod(p.id as any)}
                      className={`py-2 text-[11px] font-mono font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === p.id
                          ? "bg-[var(--gold-dim)] border-[var(--gold)] text-[var(--gold)]"
                          : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Main Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleSendToKitchen}
                    className="py-3 px-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--gold)]/40 hover:bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>Send KOT</span>
                  </button>

                  <button
                    onClick={() => {
                      if (cart.length === 0) {
                        showToast("Please add items to bill");
                        return;
                      }
                      showToast(`🧾 Bill of Rs ${cartTotal.toLocaleString()} settled & printed!`);
                      setCart([]);
                    }}
                    className="btn-gold py-3 px-3 rounded-2xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Settle &amp; Print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: KITCHEN DISPLAY (KDS) ===================== */}
        {activeTab === "kds" && (
          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-xl text-[var(--text-hi)] flex items-center gap-2">
                  <ChefHat className="w-6 h-6 text-[var(--gold)]" />
                  <span>Kitchen Order Display (KDS)</span>
                </h3>
                <p className="text-xs text-[var(--text-lo)] font-mono mt-0.5">
                  Real-time chef station tickets with live elapsed prep timers.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => showToast("🔔 Kitchen buzzer sounded!")}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono cursor-pointer flex items-center gap-1.5"
                >
                  <Flame className="w-4 h-4" />
                  <span>Test Buzzer</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {kdsTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`rounded-3xl border p-5 space-y-4 transition-all shadow-2xl flex flex-col justify-between ${
                    ticket.status === "ready"
                      ? "bg-[#25d366]/5 border-[#25d366]/40"
                      : ticket.elapsedMinutes > 18
                      ? "bg-red-500/5 border-red-500/50 shadow-red-500/10"
                      : "bg-[var(--bg-deep)] border-[var(--border-hi)]"
                  }`}
                >
                  <div className="space-y-2 pb-3 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm text-[var(--text-hi)]">
                        {ticket.id}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold flex items-center gap-1 ${
                          ticket.status === "ready"
                            ? "bg-[#25d366]/20 text-[#25d366]"
                            : ticket.elapsedMinutes > 18
                            ? "bg-red-500/20 text-red-400 animate-pulse"
                            : "bg-[var(--gold-dim)] text-[var(--gold)]"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{ticket.elapsedMinutes} mins</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-[var(--gold)]">{ticket.tableOrChannel}</span>
                      <span className="text-[var(--text-faint)]">{ticket.serverName}</span>
                    </div>
                  </div>

                  {/* Checklist of dishes */}
                  <div className="space-y-2 flex-1">
                    {ticket.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[var(--surface-hi)]/60 border border-[var(--border)] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text-hi)]">{it.name}</span>
                          <span className="font-mono font-black text-[var(--gold)] bg-[var(--gold-dim)] px-2 py-0.5 rounded-lg">
                            x{it.qty}
                          </span>
                        </div>
                        {it.notes && (
                          <p className="text-[10.5px] text-amber-400/90 font-mono italic">
                            ⚠️ {it.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Status Advance Action */}
                  <button
                    onClick={() => handleAdvanceKds(ticket.id)}
                    className={`w-full py-3 rounded-2xl font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition-all ${
                      ticket.status === "ready"
                        ? "bg-[#25d366] text-[#140c0c] font-black shadow-lg shadow-[#25d366]/20"
                        : "btn-gold"
                    }`}
                  >
                    {ticket.status === "ready" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Handed to Waiter / Rider</span>
                      </>
                    ) : ticket.status === "preparing" ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Mark Order Ready (Ding!)</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-4 h-4" />
                        <span>Start Cooking</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: MENU & 86'D STOCK MANAGER ===================== */}
        {activeTab === "menu" && (
          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-xl text-[var(--text-hi)] flex items-center gap-2">
                  <Package className="w-6 h-6 text-[var(--gold)]" />
                  <span>Menu &amp; Live Stock Inventory</span>
                </h3>
                <p className="text-xs text-[var(--text-lo)] font-mono mt-0.5">
                  Toggle instant 86'd status to block sold-out items from POS &amp; online orders.
                </p>
              </div>

              <button
                onClick={() => showToast("Item creation modal ready")}
                className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Dish</span>
              </button>
            </div>

            {/* Menu Items Table */}
            <div className="rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-hi)]/60 text-[10.5px] font-mono text-[var(--text-faint)] uppercase">
                    <th className="py-3.5 px-4 font-bold">Dish Item</th>
                    <th className="py-3.5 px-4 font-bold">Category</th>
                    <th className="py-3.5 px-4 font-bold">Price (PKR)</th>
                    <th className="py-3.5 px-4 font-bold">Kitchen Prep</th>
                    <th className="py-3.5 px-4 font-bold">Live Status</th>
                    <th className="py-3.5 px-4 font-bold text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {menuItems.map((dish) => (
                    <tr key={dish.id} className="hover:bg-[var(--surface-hi)]/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{dish.imageIcon}</span>
                          <div>
                            <span className="font-bold text-[var(--text-hi)] block">{dish.name}</span>
                            <span className="text-[10px] text-[var(--text-faint)] font-mono">ID: {dish.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono uppercase text-[var(--text-lo)]">
                        {dish.category}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[var(--gold)]">
                        Rs {dish.price.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[var(--text-faint)]">
                        ~{dish.prepTime}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                            dish.stockStatus === "in_stock"
                              ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                              : dish.stockStatus === "low_stock"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-red-500/15 text-red-400 border border-red-500/30"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {dish.stockStatus === "in_stock"
                            ? "In Stock"
                            : dish.stockStatus === "low_stock"
                            ? `Low Stock (${dish.stockCount})`
                            : "86'd (Sold Out)"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleStock(dish.id)}
                          className="px-3 py-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-hi)] hover:text-[var(--gold)] border border-[var(--border)] text-[11px] font-mono font-bold cursor-pointer transition-colors"
                        >
                          Change Status
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB 5: DAILY SALES REPORT ===================== */}
        {activeTab === "analytics" && (
          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-xl text-[var(--text-hi)] flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-[var(--gold)]" />
                  <span>Daily Sales &amp; End of Shift Settlement</span>
                </h3>
                <p className="text-xs text-[var(--text-lo)] font-mono mt-0.5">
                  Automated register reconciliation, tax breakups, and payment channel summary.
                </p>
              </div>

              <button
                onClick={() => showToast("🖨️ Shift Z-Report printed to thermal printer!")}
                className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Z-Report</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] space-y-2">
                <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase font-bold">CASH DRAWER TOTAL</span>
                <h4 className="font-display font-black text-2xl text-[var(--text-hi)] font-mono">Rs 84,200</h4>
                <p className="text-[10px] text-[#25d366] font-mono">Verified in physical drawer</p>
              </div>

              <div className="p-5 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] space-y-2">
                <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase font-bold">CARD / POS SWIPES</span>
                <h4 className="font-display font-black text-2xl text-[var(--gold)] font-mono">Rs 62,450</h4>
                <p className="text-[10px] text-[var(--text-faint)] font-mono">Meezan &amp; HBL POS Terminals</p>
              </div>

              <div className="p-5 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] space-y-2">
                <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase font-bold">ONLINE / RAAST QR</span>
                <h4 className="font-display font-black text-2xl text-[var(--orange)] font-mono">Rs 18,200</h4>
                <p className="text-[10px] text-[var(--text-faint)] font-mono">Direct bank settlement</p>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 6: SETTINGS ===================== */}
        {activeTab === "settings" && (
          <div className="p-5 sm:p-8 space-y-6 max-w-3xl">
            <div>
              <h3 className="font-display font-black text-xl text-[var(--text-hi)] flex items-center gap-2">
                <Sliders className="w-6 h-6 text-[var(--gold)]" />
                <span>Branch Profile &amp; Hardware Configuration</span>
              </h3>
              <p className="text-xs text-[var(--text-lo)] font-mono mt-0.5">
                Thermal receipt printer IP, tax rates, and delivery parameters.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] space-y-5 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[11px]">
                  Branch Display Name
                </label>
                <input
                  type="text"
                  defaultValue="Omnibites • Gulberg Main Branch"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[11px]">
                    KOT Thermal Printer IP
                  </label>
                  <input
                    type="text"
                    defaultValue="192.168.1.180 (Port 9100)"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[11px]">
                    Sales Tax Authority Rate
                  </label>
                  <input
                    type="text"
                    defaultValue="16% (PRA - Punjab Revenue Authority)"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] font-mono focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={() => showToast("✅ Branch hardware configuration saved!")}
                className="btn-gold px-5 py-2.5 text-xs font-bold cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
