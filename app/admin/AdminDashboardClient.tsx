"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Store,
  Menu as MenuIcon,
  LayoutDashboard,
  UtensilsCrossed,
  ChefHat,
  ShoppingBag,
  Package,
  TrendingUp,
  Sliders,
  Sun,
  Moon,
  LogOut,
  MapPin,
  Flame,
  X,
  Bell,
  Plus,
  Users,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  getStoredMenu,
  saveStoredMenu,
  getStoredStaff,
  saveStoredStaff,
  getStoredOrders,
  saveStoredOrder,
  saveStoredOrders,
  getStoredKdsTickets,
  saveStoredKdsTickets,
  getStoredTables,
  saveStoredTables,
  playKitchenBuzzer,
  clearUserSession,
  getActiveUserSession,
  setActiveUserSession,
  normalizeModules,
} from "../../lib/tenantStore";
import { createClient } from "../../lib/supabase";
import { safeUpdateKitchenTicket, applyOrderFilter } from "../../lib/kitchenTicketSync";
import { getValidTenantContext } from "../../lib/tenantResolver";
import { getActiveAuthSession } from "../../lib/auth";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminCacheProvider, useAdminCache, mapRowToTableStatus } from "./context/AdminCacheContext";
import { getPermittedNavigation } from "./navigationConfig";
import {
  fetchActiveUnpaidTableRecords,
  reconcileTableStatuses,
  subscribeToTableReleased,
  isTableMatchingIdentifier,
} from "@/lib/tableOccupancy";
import {
  getStoredNotifications,
  markAllNotificationsRead,
  dispatchLowStockAlert,
} from "../../lib/shiftAuditNotifications";
import {
  AdminTab,
  Branch,
  CartItem,
  KdsTicket,
  MenuItem,
  OperationalNotification,
  OrderRecord,
  RiderDelivery,
  StaffMember,
  TableStatus,
} from "./types";

import AdminSidebar from "./components/AdminSidebar";
import AdminHeader from "./components/AdminHeader";
import AdminBottomDock from "./components/AdminBottomDock";
import AdminMenuDrawer from "./components/AdminMenuDrawer";
import OverviewView from "./components/views/OverviewView";
import BranchesView from "./components/views/BranchesView";
import PosView from "./components/views/PosView";
import StaffView from "./components/views/StaffView";
import KdsView from "./components/views/KdsView";
import RiderDispatchView from "./components/views/RiderDispatchView";
import MenuView from "./components/views/MenuView";
import InventoryView from "./components/views/InventoryView";
import ProcurementView from "./components/views/ProcurementView";
import ExpensesView from "./components/views/ExpensesView";
import TableView from "./components/views/TableView";
import AnalyticsView from "./components/views/AnalyticsView";
import SettingsView from "./components/views/SettingsView";
import SubscriptionView from "./components/views/SubscriptionView";
import ProfileView from "./components/views/ProfileView";
import ModuleLockedView from "./components/ModuleLockedView";
import { deductInventoryStockForOrder } from "@/lib/inventoryDeduction";
import { isTicketExpired, syncOrderExpiredState } from "@/lib/orderExpiry";
import { applyRecipeCalculationsToMenu } from "@/lib/recipePortions";
import {
  computeUnifiedMenuCatalog,
  broadcastStockRefresh,
  subscribeToStockRefresh,
} from "@/lib/unifiedStock";
import {
  saveSharedPosCart,
  clearSharedPosCart,
  getSharedPosCart,
  subscribeToSharedPosCart,
} from "@/lib/posLedgerSync";

export default function AdminDashboardClient({
  initialCollapsed = false,
  initialSlug = [],
}: {
  initialCollapsed?: boolean;
  initialSlug?: string[];
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function verifyAuth() {
      try {
        const localSession = getActiveUserSession();
        if (localSession) {
          if (!isMounted) return;
          setIsAuthenticated(true);
          setIsLoading(false);

          // Asynchronously query Supabase restaurants directly for fresh enabled_modules
          (async () => {
            try {
              const trimmedEmail = (localSession.email || "").trim().toLowerCase();
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localSession.id);
              const numericId = parseInt(
                String(localSession.organizationId || localSession.restaurantId || (!isUuid ? localSession.id : "")).replace(/[^0-9]/g, ""),
                10
              );

              const conditions: string[] = [];
              if (numericId && !isNaN(numericId) && numericId > 0) conditions.push(`id.eq.${numericId}`);
              if (isUuid) conditions.push(`owner_id.eq.${localSession.id}`);
              if (trimmedEmail) conditions.push(`owner_email.eq.${trimmedEmail}`);

              if (conditions.length > 0) {
                const { data: rest } = await supabase
                  .from("restaurants")
                  .select("enabled_modules, brand_name")
                  .or(conditions.join(","))
                  .limit(1)
                  .maybeSingle();

                if (rest) {
                  const normalized = normalizeModules(Array.isArray(rest.enabled_modules) ? rest.enabled_modules : []);
                  const updated = {
                    ...localSession,
                    assignedFeatures: normalized,
                    restaurantName: rest.brand_name || localSession.restaurantName,
                  };
                  setActiveUserSession(updated);
                  console.log("[AdminDashboardClient] Entitlements pre-hydrated on mount:", normalized);
                }
              }
            } catch (e) {
              console.warn("[AdminDashboardClient] Initial entitlement sync notice:", e);
            }
          })();

          return;
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (user && !error) {
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }

        clearUserSession();
        router.replace("/login?redirect=/admin");
      } catch (err) {
        if (!isMounted) return;
        const localSession = getActiveUserSession();
        if (localSession) {
          setIsAuthenticated(true);
        } else {
          clearUserSession();
          router.replace("/login?redirect=/admin");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    verifyAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        const localSession = getActiveUserSession();
        if (!localSession) {
          clearUserSession();
          router.replace("/login?redirect=/admin");
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)] text-[var(--text-hi)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-[var(--text-faint)]">Verifying session security...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <AdminCacheProvider>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-deep)] text-[var(--text-hi)]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin" />
                <p className="text-xs font-mono text-[var(--text-faint)]">Loading workspace...</p>
              </div>
            </div>
          }
        >
          <AdminDashboardContent initialCollapsed={initialCollapsed} initialSlug={initialSlug} />
        </Suspense>
      </AdminCacheProvider>
    </AuthProvider>
  );
}

// Canonical mapping of AdminTab to clean nested URL path
export const TAB_TO_PATH: Record<AdminTab, string> = {
  overview: "/admin",
  pos: "/admin/pos",
  kds: "/admin/kitchen",
  menu: "/admin/menu",
  inventory: "/admin/inventory",
  procurement: "/admin/procurement",
  expenses: "/admin/expenses",
  tables: "/admin/tables",
  staff: "/admin/staff",
  riders: "/admin/dispatch",
  analytics: "/admin/reports",
  orders: "/admin/reports",
  settings: "/admin/settings",
  branches: "/admin/branches",
  subscription: "/admin/subscription",
  profile: "/admin/profile",
};

// Map URL segments and aliases back to AdminTab
const PATH_SEGMENT_TO_TAB: Record<string, AdminTab> = {
  "": "overview",
  overview: "overview",
  pos: "pos",
  kitchen: "kds",
  kds: "kds",
  menu: "menu",
  inventory: "inventory",
  procurement: "procurement",
  expenses: "expenses",
  tables: "tables",
  staff: "staff",
  dispatch: "riders",
  riders: "riders",
  reports: "analytics",
  analytics: "analytics",
  orders: "analytics",
  settings: "settings",
  branches: "branches",
  subscription: "subscription",
  profile: "profile",
  "z-report": "staff",
  zreport: "staff",
  settlement: "staff",
  shifts: "staff",
};

export function parseAdminRoute(
  pathname: string,
  slug?: string[]
): {
  tab: AdminTab;
  routeAction: { action: "new" | "edit" | "reconciliation"; id?: string } | null;
} {
  let segments: string[] = [];
  if (slug && slug.length > 0) {
    segments = slug;
  } else if (pathname) {
    const clean = pathname.replace(/^\/admin\/?/, "");
    segments = clean ? clean.split("/").filter(Boolean) : [];
  }

  if (segments.length === 0) {
    return { tab: "overview", routeAction: null };
  }

  const firstSeg = segments[0].toLowerCase();
  const tab: AdminTab = PATH_SEGMENT_TO_TAB[firstSeg] || "overview";

  if (segments.length >= 2) {
    const secondSeg = segments[1];
    if (secondSeg === "new") {
      return { tab, routeAction: { action: "new" } };
    } else if (secondSeg === "reconciliation") {
      return { tab, routeAction: { action: "reconciliation" } };
    } else if (secondSeg === "edit" && segments.length >= 3) {
      return { tab, routeAction: { action: "edit", id: decodeURIComponent(segments[2]) } };
    } else {
      return { tab, routeAction: { action: "edit", id: decodeURIComponent(secondSeg) } };
    }
  }

  return { tab, routeAction: null };
}

function AdminDashboardContent({
  initialCollapsed = false,
  initialSlug = [],
}: {
  initialCollapsed?: boolean;
  initialSlug?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const VALID_TABS: AdminTab[] = [
    "overview",
    "branches",
    "staff",
    "menu",
    "inventory",
    "procurement",
    "expenses",
    "tables",
    "pos",
    "kds",
    "riders",
    "orders",
    "analytics",
    "settings",
    "subscription",
    "profile",
  ];

  // Derive initial tab and modal action from clean URL or legacy ?tab= query param
  const legacyTabFromUrl = (searchParams?.get("tab") as AdminTab | null);
  const initialParsed = parseAdminRoute(pathname || "/admin", initialSlug);
  const initialTab: AdminTab = legacyTabFromUrl && VALID_TABS.includes(legacyTabFromUrl)
    ? legacyTabFromUrl
    : initialParsed.tab;

  const {
    user,
    isFranchiser,
    isFranchiseOwner,
    isBranchAdmin,
    isStandaloneAdmin,
    activeBranchId,
    setActiveBranchId,
    hasFeature,
    refreshEntitlements,
    logout,
  } = useAuth();

  // Helper to extract numeric restaurant ID for PostgreSQL BIGINT
  const parseNumericId = (id?: string | number): number => {
    if (!id) return 27;
    if (typeof id === "number") return id;
    const digits = String(id).replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : 27;
  };

  // In-Memory SWR Client Cache Hook
  const {
    menuItems: cachedMenuItems,
    tableStatuses: cachedTableStatuses,
    branchSettings: cachedBranchSettings,
    updateTableRow,
    insertTableRow,
    deleteTableRow,
    updateMenuItemRow,
    updateBranchSettingsRow,
    updateRawMaterialRow,
    insertRawMaterialRow,
    deleteRawMaterialRow,
  } = useAdminCache();

  // Navigation & Multi-Tenant State driven by clean nested App Router paths
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [routeAction, setRouteAction] = useState<{ action: "new" | "edit" | "reconciliation"; id?: string } | null>(
    initialParsed.routeAction
  );

  // Persistent Keep-Alive Shell: track loaded views so their DOM/state is never destroyed
  const [mountedTabs, setMountedTabs] = useState<Set<AdminTab>>(() => new Set([initialTab]));

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // 1. Strict URL Path listener: Synchronize activeTab and routeAction from pathname
  useEffect(() => {
    if (!pathname) return;
    const parsed = parseAdminRoute(pathname);
    setActiveTab((prev) => (prev !== parsed.tab ? parsed.tab : prev));
    setRouteAction(parsed.routeAction);
  }, [pathname]);

  // 2. Browser Back / Forward navigation listener: Instant popstate sync
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const parsed = parseAdminRoute(window.location.pathname);
      setActiveTab((prev) => (prev !== parsed.tab ? parsed.tab : prev));
      setRouteAction(parsed.routeAction);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 3. Backwards compatibility: Gracefully rewrite legacy ?tab= query parameter to clean nested paths
  useEffect(() => {
    const legacyTab = searchParams?.get("tab") as AdminTab | null;
    if (legacyTab && VALID_TABS.includes(legacyTab)) {
      const cleanPath = TAB_TO_PATH[legacyTab] || "/admin";
      const remainingParams = new URLSearchParams(searchParams.toString());
      remainingParams.delete("tab");
      const qs = remainingParams.toString();
      const target = qs ? `${cleanPath}?${qs}` : cleanPath;
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", target);
      }
      setActiveTab(legacyTab);
    }
  }, [searchParams]);

  // 3.5 Re-verify entitlements whenever URL path changes
  useEffect(() => {
    refreshEntitlements();
  }, [pathname]);

  // 4. Instant in-memory tab change with clean URL updates (zero server roundtrip, zero flicker)
  const handleTabChange = (nextTab: AdminTab) => {
    setActiveTab(nextTab);
    setRouteAction(null);
    setIsMenuDrawerOpen(false);
    const targetPath = TAB_TO_PATH[nextTab] || "/admin";
    if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
      window.history.pushState({ tab: nextTab }, "", targetPath);
    }
    refreshEntitlements();
  };
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [branches, setBranches] = useState<Branch[]>(() => {
    if (!user) return [];
    if (user.role === "FRANCHISE_OWNER" && user.branches && user.branches.length > 0) {
      return user.branches.map((b) => ({
        ...b,
        todaySales: b.todaySales || 0,
        activeOrders: b.activeOrders || 0,
        rating: b.rating || 5.0,
        phone: b.phone || user.phone || "+92 300 0000000",
        assignedModules: (b.assignedFeatures || []).map((f) => f.toLowerCase() as any),
      }));
    } else if (user.role === "BRANCH_ADMIN") {
      return [
        {
          id: user.branchId || "branch_01",
          name: user.branchName || "Branch Outlet",
          code: `${(user.city || "BR").substring(0, 3).toUpperCase()}-01`,
          city: user.city || "",
          address: user.address || user.city || "Branch Location",
          phone: user.phone || "+92 300 0000000",
          managerName: user.name,
          managerEmail: user.email,
          assignedFeatures: user.assignedFeatures,
          assignedModules: user.assignedFeatures.map((f) => f.toLowerCase() as any),
          status: "ACTIVE",
          todaySales: 0,
          activeOrders: 0,
          rating: 5.0,
        },
      ];
    } else {
      return [
        {
          id: user.branchId || "main_hq",
          name: user.restaurantName,
          code: `${(user.city || "HQ").substring(0, 3).toUpperCase()}-01`,
          city: user.city || "",
          address: user.address || user.city || "Main Location",
          phone: user.phone || "+92 300 0000000",
          managerName: user.name,
          managerEmail: user.email,
          assignedFeatures: user.assignedFeatures,
          assignedModules: user.assignedFeatures.map((f) => f.toLowerCase() as any),
          status: "ACTIVE",
          todaySales: 0,
          activeOrders: 0,
          rating: 5.0,
          isHq: true,
        },
      ];
    }
  });

  const currentOrgId = user?.organizationId || user?.id || "default";

  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    return getStoredStaff(currentOrgId, []);
  });
  const [deliveries, setDeliveries] = useState<RiderDelivery[]>([]);
  const [notifications, setNotifications] = useState<OperationalNotification[]>(() => {
    return getStoredNotifications(currentOrgId);
  });

  useEffect(() => {
    const handleUpdate = (e?: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setNotifications(e.detail);
      } else {
        setNotifications(getStoredNotifications(currentOrgId));
      }
    };
    window.addEventListener("omni_notifications_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    const interval = setInterval(() => {
      setNotifications(getStoredNotifications(currentOrgId));
    }, 2500);

    return () => {
      window.removeEventListener("omni_notifications_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      clearInterval(interval);
    };
  }, [currentOrgId]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialCollapsed);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };
  const [branchStatus, setBranchStatus] = useState<"open" | "rush" | "paused">("open");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // POS & Operational State (Initialized clean without dummy mock arrays, backed by SWR cache)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    return cachedMenuItems && cachedMenuItems.length > 0
      ? cachedMenuItems
      : getStoredMenu(currentOrgId, []);
  });
  const [cart, setCart] = useState<CartItem[]>(() => getSharedPosCart(currentOrgId));

  // Cross-tab real-time sync with POS Terminal
  useEffect(() => {
    const unsub = subscribeToSharedPosCart(currentOrgId, (syncedCart) => {
      setCart((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(syncedCart)) return prev;
        return syncedCart;
      });
    });
    return unsub;
  }, [currentOrgId]);

  // Keep shared POS storage in sync safely after render
  const prevCartRef = useRef<string>(JSON.stringify(cart));
  useEffect(() => {
    const serialized = JSON.stringify(cart);
    if (prevCartRef.current !== serialized) {
      prevCartRef.current = serialized;
      saveSharedPosCart(currentOrgId, cart);
    }
  }, [cart, currentOrgId]);
  const [orderChannel, setOrderChannel] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  const [selectedTable, setSelectedTable] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "raast">("cash");
  const [discountPercent] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [tables, setTables] = useState<TableStatus[]>(() => {
    return cachedTableStatuses && cachedTableStatuses.length > 0
      ? cachedTableStatuses
      : getStoredTables(currentOrgId, []);
  });
  const [kdsTickets, setKdsTickets] = useState<KdsTicket[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    return getStoredOrders(currentOrgId);
  });
  const isSendingKotRef = useRef(false);

  // Synchronize menu items and tables instantly when cache updates
  useEffect(() => {
    if (cachedMenuItems && cachedMenuItems.length > 0) {
      setMenuItems(cachedMenuItems);
    }
  }, [cachedMenuItems]);

  useEffect(() => {
    if (cachedTableStatuses && cachedTableStatuses.length > 0) {
      setTables(cachedTableStatuses);
    }
  }, [cachedTableStatuses]);

  // Dynamically compute today's live orders and sales for header ticker & overview
  const todayOrders = useMemo(() => {
    const today = new Date();
    const filtered = orders.filter((o) => {
      if (o.status === "cancelled") return false;
      const timeStr = o.timestamp || o.created_at || o.createdAt;
      if (!timeStr) return true;
      try {
        const d = new Date(timeStr);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      } catch {
        return true;
      }
    });
    return filtered.length > 0 ? filtered : orders.filter((o) => o.status !== "cancelled");
  }, [orders]);

  const todayGrossSales = useMemo(() => {
    return todayOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
  }, [todayOrders]);

  const todayOrdersCount = todayOrders.length;
  const activeFloorOrders = orders.filter((o) => o.status === "in_progress" || o.status === "seated" || o.status === "pending").length || 14;
  const avgCookTime = 13.4;

  const handleAddDish = (newDish: MenuItem) => {
    setMenuItems((prev) => {
      const updated = [newDish, ...prev];
      setTimeout(() => saveStoredMenu(currentOrgId, updated), 0);
      return updated;
    });
    showToast(`Added ${newDish.name} to menu`);
    const restId = parseNumericId(currentOrgId);
    if (restId) broadcastStockRefresh(restId, { source: "admin_add_dish" });
  };

  const handleUpdateDish = (updatedDish: MenuItem) => {
    setMenuItems((prev) => {
      const updated = prev.map((item) => (item.id === updatedDish.id ? updatedDish : item));
      setTimeout(() => saveStoredMenu(currentOrgId, updated), 0);
      return updated;
    });
    showToast(`Updated ${updatedDish.name}`);
    const restId = parseNumericId(currentOrgId);
    if (restId) broadcastStockRefresh(restId, { source: "admin_update_dish" });
  };

  const handleDeleteDish = (dishId: string) => {
    setMenuItems((prev) => {
      const updated = prev.filter((item) => item.id !== dishId);
      setTimeout(() => saveStoredMenu(currentOrgId, updated), 0);
      return updated;
    });
    showToast("Dish removed from menu");
    const restId = parseNumericId(currentOrgId);
    if (restId) broadcastStockRefresh(restId, { source: "admin_delete_dish" });
  };

  const handleToggleStock = (itemId: string) => {
    setMenuItems((prev) => {
      let toggledItem: MenuItem | undefined;
      let targetStockStatus: string = "in_stock";

      const updated = prev.map((item) => {
        if (item.id === itemId) {
          const nextStatus: "in_stock" | "low_stock" | "out_of_stock" =
            item.stockStatus === "in_stock"
              ? "low_stock"
              : item.stockStatus === "low_stock"
              ? "out_of_stock"
              : "in_stock";
          toggledItem = item;
          targetStockStatus = nextStatus;
          return { ...item, stockStatus: nextStatus };
        }
        return item;
      });

      if (toggledItem && (targetStockStatus === "low_stock" || targetStockStatus === "out_of_stock")) {
        dispatchLowStockAlert(currentOrgId, {
          itemName: toggledItem.name,
          currentStock: targetStockStatus === "out_of_stock" ? 0 : 3,
          minSafetyStock: 5,
          unit: "portions",
          isRawMaterial: false,
          branchName: user?.branchName || "Main Kitchen",
        });
      }

      setTimeout(() => saveStoredMenu(currentOrgId, updated), 0);
      return updated;
    });
    showToast("Stock status updated in real-time");
    const restId = parseNumericId(currentOrgId);
    if (restId) broadcastStockRefresh(restId, { source: "admin_toggle_stock" });
  };

  // Live Branch Operational Settings from Supabase / SWR Cache
  const [taxRatePercent, setTaxRatePercent] = useState<number>(() => cachedBranchSettings?.taxRatePercent || 16.0);
  const [kitchenBuzzerEnabled, setKitchenBuzzerEnabled] = useState<boolean>(() => cachedBranchSettings?.kitchenBuzzerEnabled ?? true);

  // Sync state with SWR cache when updated
  useEffect(() => {
    if (cachedMenuItems && cachedMenuItems.length > 0) {
      setMenuItems(cachedMenuItems);
    }
  }, [cachedMenuItems]);

  useEffect(() => {
    if (cachedTableStatuses && cachedTableStatuses.length > 0) {
      setTables(cachedTableStatuses);
    }
  }, [cachedTableStatuses]);

  useEffect(() => {
    if (cachedBranchSettings) {
      setTaxRatePercent(cachedBranchSettings.taxRatePercent);
      setKitchenBuzzerEnabled(cachedBranchSettings.kitchenBuzzerEnabled);
    }
  }, [cachedBranchSettings]);

  const isLoadingSupabaseRef = useRef<boolean>(false);
  const lastLoadedSupabaseTenantRef = useRef<string | null>(null);
  const lastSupabaseLoadTimeRef = useRef<number>(0);

  // Sync menu, staff, tables, KDS tickets, and orders whenever active tenant or user changes
  useEffect(() => {
    if (!user) return;
    const orgId = user.organizationId || user.id || "default";
    const restId = parseNumericId(orgId);

    setMenuItems(getStoredMenu(orgId, []));
    setStaffList(getStoredStaff(orgId, []));
    setTables(getStoredTables(orgId, []));
    setKdsTickets(getStoredKdsTickets(orgId, []));
    setOrders(getStoredOrders(orgId));

    let isMounted = true;
    const loadSupabaseData = async () => {
      const now = Date.now();
      if (isLoadingSupabaseRef.current) return;
      if (lastLoadedSupabaseTenantRef.current === orgId && now - lastSupabaseLoadTimeRef.current < 15000) {
        return; // Within 15s cache cooldown for same tenant
      }

      isLoadingSupabaseRef.current = true;
      try {
        const supabase = createClient();
        const { restId: resolvedRestId } = await getValidTenantContext(user);

        // 1. Fetch live Menu Items, Recipes, Raw Materials, and Unfulfilled Orders
        const [menuRes, recipeRes, materialsRes, ordersRes] = await Promise.all([
          supabase
            .from("menu_items")
            .select("*")
            .eq("restaurant_id", resolvedRestId)
            .order("created_at", { ascending: false }),
          supabase
            .from("recipe_items")
            .select(
              "menu_item_id, variant_id, variant_name, raw_material_id, quantity_required, unit, raw_materials(id, name, current_stock, min_safety_stock, cost_per_unit, unit)"
            )
            .eq("restaurant_id", resolvedRestId),
          supabase
            .from("raw_materials")
            .select("id, name, current_stock, min_safety_stock, cost_per_unit, unit")
            .eq("restaurant_id", resolvedRestId),
          supabase
            .from("orders")
            .select("id, order_number, order_status, items")
            .eq("restaurant_id", resolvedRestId)
            .eq("order_status", "active"),
        ]);

        const menuRows = menuRes.data || [];
        const recipeRows = recipeRes.data || [];
        const materialRows = materialsRes.data || [];
        const activeOrdersRows = ordersRes.data || [];

        if (menuRows.length > 0 && isMounted) {
          const unifiedMenu = computeUnifiedMenuCatalog({
            menuRows,
            recipeRows,
            materialRows,
            activeOrders: activeOrdersRows,
          });

          setMenuItems(unifiedMenu);
          saveStoredMenu(orgId, unifiedMenu);
        }

        // 2. Fetch live Staff Members
        const { data: staffData, error: staffErr } = await supabase
          .from("staff_members")
          .select("*")
          .eq("restaurant_id", resolvedRestId)
          .order("created_at", { ascending: false });

        if (!staffErr && staffData && isMounted) {
          const mappedStaff: StaffMember[] = staffData.map((s: any) => ({
            id: s.id,
            name: s.full_name,
            email: s.email,
            password: s.password_hash,
            role: s.role,
            branchId: s.branch_id || "main",
            branchName: s.branch_name || "Main Outlet",
            phone: s.phone || "",
            shift: s.shift || "Evening",
            status: s.status || "active",
            terminalAccess: s.terminal_access,
            assignedScreen:
              s.terminal_access === "POS_ONLY"
                ? "POS Counter"
                : s.terminal_access === "KDS_ONLY"
                  ? "Kitchen (KDS)"
                  : s.terminal_access === "RIDER_ONLY"
                    ? "Rider Dispatch"
                    : "Full Admin",
            avatar: (s.full_name || "ST").substring(0, 2).toUpperCase(),
            joinedDate: "Active",
          }));
          setStaffList(mappedStaff);
          saveStoredStaff(orgId, mappedStaff);
        }

        // 3. Fetch live Orders
        const { data: ordersData, error: ordersErr } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", resolvedRestId)
          .order("created_at", { ascending: false });
        if (!ordersErr && ordersData && isMounted) {
          const mappedOrders: OrderRecord[] = ordersData.map((o: any) => ({
            id: o.order_number || o.id,
            orderChannel: (o.order_channel || "dine_in") as any,
            tableId: o.table_id ? Number(o.table_id) || undefined : undefined,
            tableName: o.customer_name || (o.table_id ? `Table ${o.table_id}` : undefined),
            items: Array.isArray(o.items) ? o.items : [],
            subtotal: Number(o.subtotal || 0),
            taxAmount: Number(o.tax_amount || 0),
            discountPercent: 0,
            discountAmount: Number(o.discount_amount || 0),
            total: Number(o.total_amount || 0),
            paymentMethod: (o.payment_method || "cash") as any,
            cashierName: o.cashier_name || "Terminal Cashier",
            created_at: o.created_at || new Date().toISOString(),
            createdAt: o.created_at || new Date().toISOString(),
            timestamp: o.created_at || new Date().toISOString(),
            status: o.order_status === "completed" ? "completed" : o.order_status === "cancelled" ? "cancelled" : "active",
            estimatedPrepTime: Number(o.estimated_prep_time) || 15,
            estimated_prep_time: Number(o.estimated_prep_time) || 15,
            prepStartedAt: o.prep_started_at || undefined,
            prep_timer_started_at: o.prep_started_at || undefined,
          }));
          setOrders((prev) => {
            const map = new Map<string, OrderRecord>();
            prev.forEach((p) => map.set(p.id, p));
            mappedOrders.forEach((m) => map.set(m.id, m));
            return Array.from(map.values());
          });
          saveStoredOrders(orgId, mappedOrders);
        }

        // 4. Fetch live Kitchen Tickets
        const { data: ticketData, error: ticketErr } = await supabase
          .from("kitchen_tickets")
          .select("*")
          .eq("restaurant_id", resolvedRestId)
          .order("created_at", { ascending: false });

        if (!ticketErr && ticketData && isMounted) {
          const mappedTickets: KdsTicket[] = ticketData.map((t: any) => ({
            id: t.ticket_number || t.id,
            tableOrChannel: t.table_number || t.channel,
            orderType: t.channel,
            elapsedMinutes: t.prep_timer_started_at
              ? Math.max(0, Math.round((Date.now() - new Date(t.prep_timer_started_at).getTime()) / 60000))
              : (t.elapsed_minutes || 0),
            items: Array.isArray(t.items)
              ? t.items.map((it: any) => ({
                ...it,
                name: it.name || it.item?.name || "Dish",
                qty: Number(it.qty || it.quantity || 1),
              }))
              : [],
            status: t.status,
            serverName: t.server_name || "Front Desk",
            priority: t.priority,
            createdAt: t.created_at ? new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now",
            created_at: t.created_at || undefined,
            isDeducted: Boolean(t.prep_timer_started_at || t.status === "preparing" || t.status === "ready" || t.status === "completed"),
            deductedAt: t.prep_timer_started_at || undefined,
            prepStartedAt: t.prep_timer_started_at || undefined,
            prep_timer_started_at: t.prep_timer_started_at || undefined,
            estimatedPrepTime: Number(t.estimated_prep_time) || undefined,
            estimated_prep_time: Number(t.estimated_prep_time) || undefined,
          }));
          setKdsTickets(mappedTickets);
          saveStoredKdsTickets(orgId, mappedTickets);
        }

        // 5. Fetch live Tables from public.restaurant_tables and active unpaid records
        const [tablesRes, activeRecords] = await Promise.all([
          supabase
            .from("restaurant_tables")
            .select("*")
            .eq("restaurant_id", resolvedRestId)
            .order("table_number", { ascending: true }),
          fetchActiveUnpaidTableRecords(resolvedRestId, supabase),
        ]);

        const tablesData = tablesRes.data;
        const tablesErr = tablesRes.error;

        if (!tablesErr && tablesData && isMounted) {
          const mappedTables: TableStatus[] = tablesData.map((t: any, idx: number) =>
            mapRowToTableStatus(t, idx)
          );
          const reconciled = reconcileTableStatuses(mappedTables, activeRecords);
          setTables(reconciled);
          saveStoredTables(orgId, reconciled);
        }

        // 6. Fetch live Branch Operational Settings from public.branch_settings
        const { data: settingsData } = await supabase
          .from("branch_settings")
          .select("*")
          .eq("restaurant_id", resolvedRestId)
          .maybeSingle();

        if (settingsData && isMounted) {
          const resolvedTax = settingsData.tax_rate ?? settingsData.tax_rate_percent;
          if (resolvedTax !== null && resolvedTax !== undefined) {
            setTaxRatePercent(Number(resolvedTax));
          }
          const resolvedBuzzer = settingsData.buzzer_enabled ?? settingsData.kitchen_buzzer_enabled;
          if (typeof resolvedBuzzer === "boolean") {
            setKitchenBuzzerEnabled(resolvedBuzzer);
          }
        }
      } catch (err) {
        console.warn("[AdminDashboardClient] Supabase sync exception:", err);
      } finally {
        isLoadingSupabaseRef.current = false;
        lastLoadedSupabaseTenantRef.current = orgId;
        lastSupabaseLoadTimeRef.current = Date.now();
      }
    };

    loadSupabaseData();

    // Attach Realtime listener for kitchen_tickets, tables, branch_settings, raw_materials, recipe_items, and orders
    let kdsChannel: any = null;
    let tablesChannel: any = null;
    let settingsChannel: any = null;
    let rawMaterialsChannel: any = null;
    let recipeItemsChannel: any = null;
    let menuItemsChannel: any = null;
    let ordersChannel: any = null;

    try {
      const supabase = createClient();
      const subUid = Math.random().toString(36).substring(2, 8);

      kdsChannel = supabase
        .channel(`rt_kitchen_tickets_${restId}_${subUid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "kitchen_tickets",
            filter: `restaurant_id=eq.${restId}`,
          },
          (payload) => {
            if (payload.eventType === "UPDATE") {
              const updatedRow: any = payload.new;
              setKdsTickets((prev) =>
                prev.map((t) =>
                  t.id === updatedRow.ticket_number || t.id === updatedRow.id
                    ? {
                      ...t,
                      status: updatedRow.status,
                      prepStartedAt: updatedRow.prep_timer_started_at || t.prepStartedAt,
                      prep_timer_started_at: updatedRow.prep_timer_started_at || t.prep_timer_started_at,
                      estimatedPrepTime: Number(updatedRow.estimated_prep_time) || t.estimatedPrepTime,
                      estimated_prep_time: Number(updatedRow.estimated_prep_time) || t.estimated_prep_time,
                      elapsedMinutes: updatedRow.prep_timer_started_at
                        ? Math.max(0, Math.round((Date.now() - new Date(updatedRow.prep_timer_started_at).getTime()) / 60000))
                        : (updatedRow.elapsed_minutes || t.elapsedMinutes),
                    }
                    : t
                )
              );
            } else if (payload.eventType === "INSERT") {
              const newRow: any = payload.new;
              const newTicket: KdsTicket = {
                id: newRow.ticket_number || newRow.id,
                tableOrChannel: newRow.table_number || newRow.channel,
                orderType: newRow.channel,
                elapsedMinutes: 0,
                items: Array.isArray(newRow.items)
                  ? newRow.items.map((it: any) => ({
                    ...it,
                    name: it.name || it.item?.name || "Dish",
                    qty: Number(it.qty || it.quantity || 1),
                  }))
                  : [],
                status: newRow.status,
                serverName: newRow.server_name || "Front Desk",
                priority: newRow.priority,
                createdAt: newRow.created_at ? new Date(newRow.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now",
                created_at: newRow.created_at || undefined,
                prepStartedAt: newRow.prep_timer_started_at || undefined,
                prep_timer_started_at: newRow.prep_timer_started_at || undefined,
                estimatedPrepTime: Number(newRow.estimated_prep_time) || undefined,
                estimated_prep_time: Number(newRow.estimated_prep_time) || undefined,
              };
              setKdsTickets((prev) => [newTicket, ...prev.filter((t) => t.id !== newTicket.id)]);
            }
          }
        )
        .subscribe();

      tablesChannel = supabase
        .channel(`rt_client_tables_${restId}_${subUid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "restaurant_tables",
            filter: `restaurant_id=eq.${restId}`,
          },
          (payload: any) => {
            if (!isMounted) return;
            if (payload.eventType === "UPDATE") {
              const updatedRow = payload.new;
              const mappedStatus = mapRowToTableStatus(updatedRow);
              setTables((prev) =>
                prev.map((t) =>
                  String(t.dbId) === String(updatedRow.id) ||
                    String(t.id) === String(updatedRow.id) ||
                    t.label === updatedRow.table_number
                    ? mappedStatus
                    : t
                )
              );
              updateTableRow(updatedRow);
            } else if (payload.eventType === "INSERT") {
              const newRow = payload.new;
              const mappedStatus = mapRowToTableStatus(newRow);
              setTables((prev) => [...prev.filter((t) => String(t.dbId) !== String(newRow.id)), mappedStatus]);
              insertTableRow(newRow);
            } else if (payload.eventType === "DELETE") {
              const oldId = payload.old?.id;
              setTables((prev) => prev.filter((t) => String(t.dbId) !== String(oldId) && String(t.id) !== String(oldId)));
              deleteTableRow(oldId);
            }
          }
        )
        .subscribe();

      settingsChannel = supabase
        .channel(`rt_branch_settings_${restId}_${subUid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "branch_settings",
            filter: `restaurant_id=eq.${restId}`,
          },
          (payload: any) => {
            const newRow = payload.new;
            if (newRow && isMounted) {
              updateBranchSettingsRow(newRow);
              const resolvedTax = newRow.tax_rate ?? newRow.tax_rate_percent;
              if (resolvedTax !== null && resolvedTax !== undefined) {
                setTaxRatePercent(Number(resolvedTax));
              }
              const resolvedBuzzer = newRow.buzzer_enabled ?? newRow.kitchen_buzzer_enabled;
              if (typeof resolvedBuzzer === "boolean") {
                setKitchenBuzzerEnabled(resolvedBuzzer);
              }
            }
          }
        )
        .subscribe();

      // Realtime listener for raw_materials changes: selective atomic update without full page reload
      rawMaterialsChannel = supabase
        .channel(`rt_raw_materials_${restId}_${subUid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "raw_materials",
            filter: `restaurant_id=eq.${restId}`,
          },
          (payload: any) => {
            if (payload.eventType === "UPDATE") {
              updateRawMaterialRow(payload.new);
            } else if (payload.eventType === "INSERT") {
              insertRawMaterialRow(payload.new);
            } else if (payload.eventType === "DELETE") {
              deleteRawMaterialRow(payload.old?.id);
            }
          }
        )
        .subscribe();

      recipeItemsChannel = supabase
        .channel(`rt_recipe_items_${restId}_${subUid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "recipe_items",
            filter: `restaurant_id=eq.${restId}`,
          },
          () => {
            if (isMounted) {
              loadSupabaseData();
            }
          }
        )
        .subscribe();

      // Realtime listener for menu_items changes
      menuItemsChannel = supabase
        .channel(`rt_menu_items_${restId}_${subUid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menu_items",
            filter: `restaurant_id=eq.${restId}`,
          },
          (payload: any) => {
            if (isMounted) {
              console.log("[Admin Realtime] menu_items event:", payload.eventType);
              loadSupabaseData();
            }
          }
        )
        .subscribe();

      // Realtime listener for orders changes (updates live sales & order count ticker)
      ordersChannel = supabase
        .channel(`rt_orders_${restId}_${subUid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `restaurant_id=eq.${restId}`,
          },
          (payload: any) => {
            if (isMounted) {
              console.log("[Admin Realtime] orders event:", payload.eventType);
              loadSupabaseData();
            }
          }
        )
        .subscribe();
    } catch (chanErr) {
      console.warn("[AdminDashboardClient] Realtime subscription error:", chanErr);
    }

    const handleSyncEvent = () => {
      if (isMounted) {
        loadSupabaseData();
      }
    };

    const handleTableReleasedEvent = (data?: any) => {
      if (!isMounted) return;
      if (data) {
        const { tableId, tableNumber, orderId } = data;
        setTables((prev) =>
          prev.map((t) => {
            const matches =
              (tableId && (String(t.dbId) === String(tableId) || String(t.id) === String(tableId))) ||
              (tableNumber && isTableMatchingIdentifier(t, tableNumber)) ||
              (orderId && t.activeOrderId === orderId);
            if (matches) {
              return {
                ...t,
                status: "available",
                activeOrderId: undefined,
                activeAmount: undefined,
              };
            }
            return t;
          })
        );
      }
      loadSupabaseData();
    };

    const handleTableReleasedWindow = (e: Event) => {
      handleTableReleasedEvent((e as CustomEvent).detail);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pos_tables_updated", handleSyncEvent);
      window.addEventListener("restaurant_tables_changed", handleSyncEvent);
      window.addEventListener("table_released", handleTableReleasedWindow);
      window.addEventListener("orders_updated", handleSyncEvent);
      window.addEventListener("inventory_stock_deducted", handleSyncEvent);
      window.addEventListener("pos_menu_updated", handleSyncEvent);
    }

    let ledgerBc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        ledgerBc = new BroadcastChannel("pos_ledger_sync_channel");
        ledgerBc.onmessage = (event) => {
          if (event.data?.type === "TABLE_RELEASED") {
            handleTableReleasedEvent(event.data?.payload);
          } else if (isMounted) {
            loadSupabaseData();
          }
        };
      } catch { }
    }

    const unsubStock = subscribeToStockRefresh(restId, () => {
      if (isMounted) {
        loadSupabaseData();
      }
    });

    const unsubRelease = subscribeToTableReleased(restId, handleTableReleasedEvent);

    return () => {
      isMounted = false;
      if (unsubStock) unsubStock();
      if (unsubRelease) unsubRelease();
      if (typeof window !== "undefined") {
        window.removeEventListener("pos_tables_updated", handleSyncEvent);
        window.removeEventListener("restaurant_tables_changed", handleSyncEvent);
        window.removeEventListener("table_released", handleTableReleasedWindow);
        window.removeEventListener("orders_updated", handleSyncEvent);
        window.removeEventListener("inventory_stock_deducted", handleSyncEvent);
        window.removeEventListener("pos_menu_updated", handleSyncEvent);
      }
      if (ledgerBc) {
        try { ledgerBc.close(); } catch { }
      }
      try {
        const supabase = createClient();
        if (kdsChannel) supabase.removeChannel(kdsChannel);
        if (tablesChannel) supabase.removeChannel(tablesChannel);
        if (settingsChannel) supabase.removeChannel(settingsChannel);
        if (rawMaterialsChannel) supabase.removeChannel(rawMaterialsChannel);
        if (recipeItemsChannel) supabase.removeChannel(recipeItemsChannel);
        if (menuItemsChannel) supabase.removeChannel(menuItemsChannel);
        if (ordersChannel) supabase.removeChannel(ordersChannel);
      } catch { }
    };
  }, [user?.organizationId, user?.id]);



  useEffect(() => {
    try {
      const savedTheme = (localStorage.getItem("theme") || (localStorage as any).theme) as "dark" | "light" | null;
      const active = savedTheme === "light" ? "light" : "dark";
      setTheme(active);
      if (active === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch { }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
    try {
      localStorage.setItem("theme", next);
      (localStorage as any).theme = next;
    } catch { }
  };

  // POS Handlers
  const handleAddToCart = (item: MenuItem) => {
    if (item.stockStatus === "out_of_stock" || item.isAutoOutOfStock) {
      showToast(
        item.isAutoOutOfStock
          ? "Ingredient unavailable in kitchen inventory."
          : `Item "${item.name}" is currently out of stock.`
      );
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.item.id === itemId) {
            const nextQty = c.quantity + delta;
            return nextQty > 0 ? { ...c, quantity: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const cartSubtotal = cart.reduce(
    (acc, curr) => acc + curr.item.price * curr.quantity,
    0
  );
  const taxAmount = Math.round((cartSubtotal * taxRatePercent) / 100);
  const discountAmount = Math.round((cartSubtotal * discountPercent) / 100);
  const cartTotal = cartSubtotal + taxAmount - discountAmount;

  const handleSendToKitchen = (deliveryMeta?: { customerName?: string; customerPhone?: string; deliveryZone?: string }) => {
    if (isSendingKotRef.current) return;
    if (cart.length === 0) {
      showToast("Please add items to cart before sending KOT.");
      return;
    }
    isSendingKotRef.current = true;
    try {

    const matchedTable = tables.find((t) => t.id === selectedTable);
    const tableIdentifier = matchedTable?.label || `Table ${selectedTable}`;

    // Look for an existing active running order for this table
    const existingActiveOrder = orderChannel === "dine_in"
      ? orders.find(
        (o) =>
          (o.tableId === selectedTable ||
            (matchedTable?.activeOrderId &&
              (o.id === matchedTable.activeOrderId || o.kotId === matchedTable.activeOrderId))) &&
          o.status !== "completed" &&
          o.status !== "cancelled"
      )
      : undefined;

    // Calculate incremental diff items for kitchen (Round 2+ vs Fresh Round 1)
    let itemsForKitchen: {
      id?: string;
      name: string;
      qty: number;
      notes?: string;
      prepTime?: string;
      preparation_time?: number;
    }[] = [];

    if (existingActiveOrder) {
      cart.forEach((c) => {
        const prevItem = existingActiveOrder.items.find(
          (it) => it.id === c.item.id || it.name.toLowerCase() === c.item.name.toLowerCase()
        );
        const prevQty = prevItem ? prevItem.quantity : 0;
        const addedQty = c.quantity - prevQty;
        if (addedQty > 0) {
          const itemPrepMinutes =
            c.item.preparation_time ||
            parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
            15;
          itemsForKitchen.push({
            id: c.item.id,
            name: c.item.name,
            qty: addedQty,
            notes: c.notes,
            prepTime: c.item.prepTime || `${itemPrepMinutes}m`,
            preparation_time: itemPrepMinutes,
          });
        }
      });

      if (itemsForKitchen.length === 0) {
        showToast(`No new items to dispatch for ${tableIdentifier}.`);
        return;
      }
    } else {
      itemsForKitchen = cart.map((c) => {
        const itemPrepMinutes =
          c.item.preparation_time ||
          parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
          15;
        const variantObj = c.selectedVariant || c.item.selectedVariant;
        return {
          id: c.item.id,
          name: c.item.name,
          qty: c.quantity,
          notes: c.notes,
          prepTime: c.item.prepTime || `${itemPrepMinutes}m`,
          preparation_time: itemPrepMinutes,
          selectedVariant: variantObj,
          variant: variantObj,
          variant_id: variantObj?.id || null,
          variant_name: variantObj?.name || null,
        };
      });
    }

    const newKotId = `KOT-${Math.floor(1000 + Math.random() * 9000)}`;
    const dishPrepTimes = itemsForKitchen.map((c) => c.preparation_time || 15);
    const ticketEstimatedPrepTime = dishPrepTimes.length > 0 ? Math.max(...dishPrepTimes) : 15;

    const roundSuffix = existingActiveOrder ? " (Round 2+)" : "";
    const newTicket: KdsTicket = {
      id: newKotId,
      tableOrChannel:
        orderChannel === "dine_in"
          ? `${tableIdentifier}${roundSuffix}`
          : orderChannel === "takeaway"
            ? "Takeaway Counter"
            : `Delivery: ${deliveryMeta?.customerName || "Customer"}${deliveryMeta?.deliveryZone ? ` (${deliveryMeta.deliveryZone})` : ""}`,
      orderType: orderChannel,
      serverName: user?.name || "Terminal 01",
      elapsedMinutes: 0,
      status: "queued",
      estimatedPrepTime: ticketEstimatedPrepTime,
      estimated_prep_time: ticketEstimatedPrepTime,
      items: itemsForKitchen,
      priority: orderChannel === "delivery" ? "urgent" : "normal",
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      created_at: new Date().toISOString(),
      isDeducted: false,
    };

    // 1. Dispatch KOT to KDS state
    setKdsTickets((prev) => {
      const updated = [newTicket, ...prev];
      saveStoredKdsTickets(currentOrgId, updated);
      return updated;
    });

    if (kitchenBuzzerEnabled) {
      playKitchenBuzzer();
    }

    // Full cumulative items list for the order record
    const fullOrderItems = cart.map((c) => {
      const itemPrepMinutes =
        c.item.preparation_time ||
        parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
        15;
      const variantObj = c.selectedVariant || c.item.selectedVariant;
      return {
        id: c.item.id,
        name: c.item.name,
        price: variantObj?.price ?? c.item.price,
        quantity: c.quantity,
        notes: c.notes,
        prepTime: c.item.prepTime || `${itemPrepMinutes}m`,
        preparation_time: itemPrepMinutes,
        selectedVariant: variantObj,
        variant: variantObj,
        variant_id: variantObj?.id || null,
        variant_name: variantObj?.name || null,
      };
    });

    if (existingActiveOrder) {
      // 2A. Update Existing Active Running Order with cumulative cart
      const updatedActiveOrder: OrderRecord = {
        ...existingActiveOrder,
        items: fullOrderItems,
        subtotal: cartSubtotal,
        taxAmount: taxAmount,
        discountAmount: discountAmount,
        total: cartTotal,
        kotId: newKotId,
        status: "active",
      };

      setOrders((prev) =>
        prev.map((o) => (o.id === existingActiveOrder.id ? updatedActiveOrder : o))
      );
      saveStoredOrder(currentOrgId, updatedActiveOrder);

      // Update table activeAmount in local state
      setTables((prev) => {
        const updated = prev.map((t) =>
          t.id === selectedTable
            ? {
              ...t,
              status: "seated" as const,
              activeOrderId: existingActiveOrder.id,
              activeAmount: cartTotal,
            }
            : t
        );
        saveStoredTables(currentOrgId, updated);
        return updated;
      });

      showToast(`Kitchen ticket ${newKotId} dispatched for ${tableIdentifier} (Round 2+). Total: Rs ${cartTotal.toLocaleString()}`);

      // Async DB Sync: Update orders & insert incremental KOT
      (async () => {
        try {
          const supabase = createClient();
          const { restId, branchId } = await getValidTenantContext(user);

          let orderUpdateQuery: any = supabase
            .from("orders")
            .update({
              items: fullOrderItems,
              subtotal: cartSubtotal,
              tax_amount: taxAmount,
              discount_amount: discountAmount,
              total_amount: cartTotal,
              order_status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("restaurant_id", restId);
          orderUpdateQuery = applyOrderFilter(orderUpdateQuery, existingActiveOrder.id);
          await orderUpdateQuery;

          const ticketPayload: any = {
            restaurant_id: restId,
            branch_id: branchId || user?.branchId || null,
            order_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingActiveOrder.id) ? existingActiveOrder.id : null,
            ticket_number: newKotId,
            table_number: newTicket.tableOrChannel,
            channel: orderChannel,
            status: "queued",
            items: itemsForKitchen,
            server_name: newTicket.serverName,
            priority: newTicket.priority,
            estimated_prep_time: ticketEstimatedPrepTime,
          };
          const { error: insErr } = await supabase.from("kitchen_tickets").insert([ticketPayload]);
          if (insErr && insErr.message?.includes("estimated_prep_time")) {
            delete ticketPayload.estimated_prep_time;
            await supabase.from("kitchen_tickets").insert([ticketPayload]);
          }
        } catch (err) {
          console.warn("[AdminDashboardClient] Round KOT DB sync error:", err);
        }
      })();
    } else {
      // 2B. Create Fresh Active Order (Round 1)
      const newOrderId = `ORD-${Date.now().toString().slice(-6)}`;
      const freshOrderRecord: OrderRecord = {
        id: newOrderId,
        orderChannel: orderChannel,
        tableId: orderChannel === "dine_in" ? selectedTable : undefined,
        tableName:
          orderChannel === "dine_in"
            ? tableIdentifier
            : orderChannel === "delivery"
              ? (deliveryMeta?.customerName?.trim() || "Delivery Order")
              : undefined,
        customerName: orderChannel === "delivery" ? (deliveryMeta?.customerName?.trim() || "Delivery Customer") : undefined,
        customerPhone: orderChannel === "delivery" ? (deliveryMeta?.customerPhone?.trim() || undefined) : undefined,
        delivery_zone: orderChannel === "delivery" ? (deliveryMeta?.deliveryZone?.trim() || undefined) : undefined,
        rider_id: null,
        assignedRiderId: undefined,
        assignedRiderName: undefined,
        items: fullOrderItems,
        subtotal: cartSubtotal,
        taxAmount: taxAmount,
        discountPercent: discountPercent,
        discountAmount: discountAmount,
        total: cartTotal,
        paymentMethod: paymentMethod,
        cashierName: user?.name || "Terminal Cashier",
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        kotId: newKotId,
        status: orderChannel === "delivery" ? "queued" : "active",
      };

      setOrders((prev) => [freshOrderRecord, ...prev.filter((o) => o.id !== newOrderId)]);
      saveStoredOrder(currentOrgId, freshOrderRecord);

      if (orderChannel === "dine_in") {
        setTables((prev) => {
          const updated = prev.map((t) =>
            t.id === selectedTable
              ? {
                ...t,
                status: "seated" as const,
                activeOrderId: newOrderId,
                activeAmount: cartTotal,
                timeSeated: "Just now",
              }
              : t
          );
          saveStoredTables(currentOrgId, updated);
          return updated;
        });
      }

      showToast(`Kitchen ticket ${newKotId} dispatched to KDS station.`);

      // Async DB Sync: Insert into public.orders, insert public.kitchen_tickets, and atomically lock public.restaurant_tables
      (async () => {
        try {
          const supabase = createClient();
          const { restId, branchId } = await getValidTenantContext(user);
          const dbId = matchedTable?.dbId || selectedTable;
          const isUuid = typeof dbId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbId);

          const orderPayload: any = {
            restaurant_id: restId,
            branch_id: branchId || user?.branchId || null,
            order_number: freshOrderRecord.id,
            kot_id: newKotId,
            order_channel: orderChannel,
            delivery_zone: orderChannel === "delivery" ? (deliveryMeta?.deliveryZone?.trim() || null) : null,
            customer_name:
              orderChannel === "delivery"
                ? (deliveryMeta?.customerName?.trim() || "Delivery Customer")
                : (freshOrderRecord.tableName || (orderChannel === "dine_in" ? tableIdentifier : "Walk-in Guest")),
            customer_phone: orderChannel === "delivery" ? (deliveryMeta?.customerPhone?.trim() || null) : null,
            rider_id: null,
            subtotal: cartSubtotal,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            total_amount: cartTotal,
            payment_method: paymentMethod,
            payment_status: "pending",
            order_status: "active",
            items: freshOrderRecord.items,
            cashier_name: freshOrderRecord.cashierName,
            estimated_prep_time: ticketEstimatedPrepTime,
          };
          if (orderChannel === "dine_in" && isUuid) {
            orderPayload.table_id = dbId;
          }

          let { data: orderData, error: orderErr } = await supabase
            .from("orders")
            .insert([orderPayload])
            .select("id")
            .maybeSingle();

          if (orderErr && orderErr.message?.includes("estimated_prep_time")) {
            delete orderPayload.estimated_prep_time;
            const retry = await supabase.from("orders").insert([orderPayload]).select("id").maybeSingle();
            orderData = retry.data;
          }

          const createdDbOrderId = orderData?.id || freshOrderRecord.id;

          // Insert KOT ticket
          const ticketPayload: any = {
            restaurant_id: restId,
            branch_id: branchId || user?.branchId || null,
            order_id: orderData?.id || null,
            ticket_number: newKotId,
            table_number: newTicket.tableOrChannel,
            channel: orderChannel,
            status: "queued",
            items: itemsForKitchen,
            server_name: newTicket.serverName,
            priority: newTicket.priority,
            estimated_prep_time: ticketEstimatedPrepTime,
          };
          const { error: kotErr } = await supabase.from("kitchen_tickets").insert([ticketPayload]);
          if (kotErr && kotErr.message?.includes("estimated_prep_time")) {
            delete ticketPayload.estimated_prep_time;
            await supabase.from("kitchen_tickets").insert([ticketPayload]);
          }

          // Atomically lock table to occupied in public.restaurant_tables
          if (orderChannel === "dine_in") {
            const tableUpdatePayload: Record<string, any> = {
              status: "occupied",
            };
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(createdDbOrderId))) {
              tableUpdatePayload.active_order_id = createdDbOrderId;
            }
            if (/^\d+$/.test(String(createdDbOrderId))) {
              tableUpdatePayload.current_order_id = Number(createdDbOrderId);
            }

            let query = supabase.from("restaurant_tables").update(tableUpdatePayload);
            if (isUuid) {
              query = query.or(`id.eq.${dbId},table_number.eq.${tableIdentifier}`);
            } else {
              query = query.eq("table_number", tableIdentifier);
            }
            await query.eq("restaurant_id", restId);
            console.log(`[AdminDashboardClient] Table ${tableIdentifier} atomically locked to occupied.`);
          }

          // Broadcast table lock and order sync across all screens
          if (typeof window !== "undefined") {
            try {
              window.dispatchEvent(new CustomEvent("restaurant_tables_changed"));
              window.dispatchEvent(new CustomEvent("pos_tables_updated"));
              window.dispatchEvent(new CustomEvent("orders_updated", {
                detail: { restaurantId: restId, orderId: createdDbOrderId, kotId: newKotId, timestamp: Date.now() },
              }));
              localStorage.setItem(`omni_tables_trigger_${currentOrgId}`, String(Date.now()));
              localStorage.setItem(`pos_orders_${currentOrgId}`, String(Date.now()));
              window.dispatchEvent(new Event("storage"));
            } catch { }
          }
        } catch (tblErr) {
          console.warn("[AdminDashboardClient] Fresh order & table lock exception:", tblErr);
        }
      })();
    }

      clearSharedPosCart(currentOrgId);
      setCart([]);
    } finally {
      setTimeout(() => {
        isSendingKotRef.current = false;
      }, 1000);
    }
  };

  const handleAdvanceKds = (ticketId: string, specificStatus?: KdsTicket["status"]) => {
    const currentTicket = kdsTickets.find((t) => t.id === ticketId);
    let nextStatus: KdsTicket["status"] = "preparing";

    if (specificStatus) {
      nextStatus = specificStatus;
    } else if (currentTicket) {
      if (currentTicket.status === "queued") nextStatus = "preparing";
      else if (currentTicket.status === "preparing") nextStatus = "ready";
      else if (currentTicket.status === "ready") nextStatus = "completed";
      else nextStatus = "preparing";
    }

    // STRICT STALE TICKET GUARD:
    // Block tickets in queued status that have exceeded 60 minutes unstarted from transitioning to cooking/preparing
    if (currentTicket && currentTicket.status === "queued" && nextStatus === "preparing") {
      let createdMs = Date.now();
      if (currentTicket.created_at) {
        const parsed = new Date(currentTicket.created_at).getTime();
        if (!isNaN(parsed)) createdMs = parsed;
      } else if (currentTicket.createdAt) {
        const parsed = new Date(currentTicket.createdAt).getTime();
        if (!isNaN(parsed)) {
          createdMs = parsed;
        } else {
          const match = currentTicket.createdAt.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
          if (match) {
            const d = new Date();
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const ampm = match[4];
            if (ampm) {
              if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
              if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
            }
            d.setHours(h, m, 0, 0);
            createdMs = d.getTime();
          }
        }
      }

      const elapsedMinutes = (Date.now() - createdMs) / (60 * 1000);
      if (elapsedMinutes >= 60) {
        showToast("Cannot start cooking: This ticket has expired (>60 mins unstarted). Contact Floor Manager to void or re-issue.");
        return;
      }
    }

    if (currentTicket && isTicketExpired(currentTicket)) {
      showToast(`🛑 Order Expired (4-hour cutoff): Ticket #${ticketId} has expired and cannot be processed.`);
      syncOrderExpiredState(currentOrgId, ticketId, {
        tableIdentifier: currentTicket.tableName || (currentTicket.tableId ? String(currentTicket.tableId) : currentTicket.tableOrChannel) || undefined,
      });
      return;
    }

    if (nextStatus === "ready") {
      playKitchenBuzzer();
    }

    // Determine if this transition moves ticket to "Cooking" / "preparing" stage
    const isTransitionToCooking =
      nextStatus === "preparing" && currentTicket?.status !== "preparing";
    const isAlreadyDeducted = Boolean(
      currentTicket?.isDeducted || currentTicket?.deductedAt
    );
    const prepStartTimestamp = new Date().toISOString();

    // 1. Optimistic React state update (with duplicate deduction prevention flag)
    setKdsTickets((prev) => {
      const updated = prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: nextStatus,
            prepStartedAt: isTransitionToCooking ? (t.prepStartedAt || prepStartTimestamp) : t.prepStartedAt,
            prep_timer_started_at: isTransitionToCooking ? (t.prep_timer_started_at || prepStartTimestamp) : t.prep_timer_started_at,
            elapsedMinutes: nextStatus === "preparing" && !t.elapsedMinutes ? 1 : t.elapsedMinutes,
            isDeducted: nextStatus === "completed" ? true : t.isDeducted,
            deductedAt: nextStatus === "completed"
              ? t.deductedAt || prepStartTimestamp
              : t.deductedAt,
          };
        }
        return t;
      });
      saveStoredKdsTickets(currentOrgId, updated);
      return updated;
    });

    // 2. Async DB update to public.kitchen_tickets if ticket exists in database
    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const updatePayload: any = {
          status: nextStatus,
        };
        if (nextStatus === "completed" || nextStatus === "archived") {
          updatePayload.completed_at = new Date().toISOString();
        }
        if (isTransitionToCooking) {
          updatePayload.prep_timer_started_at = prepStartTimestamp;
        }
        await safeUpdateKitchenTicket(
          supabase,
          ticketId,
          updatePayload,
          currentTicket,
          restId || currentOrgId
        );

        // KDS status completion: Inventory stock was already exact-once deducted upon order placement / KOT dispatch.
        // Changing KDS status must never trigger duplicate inventory deduction.
      } catch (err) {
        console.warn("Could not sync KDS status to kitchen_tickets DB table:", err);
      }
    })();

    showToast(`Kitchen status updated for ${ticketId}`);
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCat = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[var(--bg)] text-[var(--text-hi)] flex transition-colors duration-300 antialiased font-sans selection:bg-[var(--gold)]/20 selection:text-[var(--gold)]">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[999] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--bg-deep)] border border-[var(--gold)]/40 text-[var(--gold)] shadow-2xl shadow-black/80 font-mono text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-[var(--gold)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================== SIDEBAR ===================== */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        counts={{
          kdsTickets: kdsTickets.length,
          activeRiders: deliveries.filter(
            (d) => d.status === "on_route" || d.status === "assigned" || d.status === "picked_up"
          ).length,
          staffTotal: staffList.length,
          branchesTotal: branches.length,
          menuAlerts: menuItems.filter((i) => i.stockStatus !== "in_stock").length,
        }}
        theme={theme}
        toggleTheme={toggleTheme}
        permittedNavItems={
          user
            ? getPermittedNavigation(user.role, user.assignedFeatures || [], user.terminalAccess)
            : undefined
        }
      />


      {/* ===================== MAIN CONTENT AREA ===================== */}
      <main className={`flex-1 min-w-0 max-w-full overflow-x-hidden flex flex-col h-screen ${activeTab === "pos" ? "overflow-hidden" : "overflow-y-auto"} pb-16 lg:pb-0`}>
        {/* Top Navbar */}
        <AdminHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          theme={theme}
          toggleTheme={toggleTheme}
          notifications={notifications}
          markNotificationsAsRead={() => {
            markAllNotificationsRead(currentOrgId);
            setNotifications(getStoredNotifications(currentOrgId));
          }}
          onNewOrderClick={() => handleTabChange("pos")}
          onLogout={() => {
            logout();
            router.push("/login");
          }}
          onNavigateProfile={() => handleTabChange("profile")}
          onOpenMobileMenu={() => setIsMenuDrawerOpen(true)}
          todaySales={todayGrossSales}
          todayOrdersCount={todayOrdersCount}
        />


        {/* ===================== MODULAR VIEW MOUNTS ===================== */}
        {mountedTabs.has("overview") && user && (
          <div
            key="view-overview"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "overview" ? "" : "hidden"}`}
            style={{ display: activeTab === "overview" ? undefined : "none" }}
          >
            <OverviewView
              user={user}
              tables={tables}
              setSelectedTable={setSelectedTable}
              kdsTickets={kdsTickets}
              handleAdvanceKds={handleAdvanceKds}
              setActiveTab={handleTabChange}
              showToast={showToast}
              orders={orders}
              todayGrossSales={todayGrossSales}
              activeFloorOrders={activeFloorOrders}
              avgCookTime={avgCookTime}
            />
          </div>
        )}

        {mountedTabs.has("branches") && (
          <div
            key="view-branches"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "branches" ? "" : "hidden"}`}
            style={{ display: activeTab === "branches" ? undefined : "none" }}
          >
            <BranchesView
              branches={branches}
              setBranches={setBranches}
              persona={isFranchiser ? "franchiser" : "branch_admin"}
              selectedBranchId={selectedBranchId}
              setSelectedBranchId={setSelectedBranchId}
              showToast={showToast}
            />
          </div>
        )}

        {mountedTabs.has("pos") && (
          <div
            key="view-pos"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "pos" ? "" : "hidden"}`}
            style={{ display: activeTab === "pos" ? undefined : "none" }}
          >
            {hasFeature("POS") ? (
              <PosView
                menuItems={menuItems}
                cart={cart}
                handleAddToCart={handleAddToCart}
                handleUpdateCartQty={handleUpdateCartQty}
                orderChannel={orderChannel}
                setOrderChannel={setOrderChannel}
                selectedTable={selectedTable}
                setSelectedTable={setSelectedTable}
                tables={tables}
                setTables={setTables}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                cartSubtotal={cartSubtotal}
                taxAmount={taxAmount}
                taxRatePercent={taxRatePercent}
                discountPercent={discountPercent}
                discountAmount={discountAmount}
                cartTotal={cartTotal}
                handleSendToKitchen={handleSendToKitchen}
                setCart={setCart}
                orders={orders}
                staffList={staffList}
                showToast={showToast}
              />
            ) : (
              <ModuleLockedView
                moduleName="POS Counter"
                requiredFeature="POS"
                onNavigate={handleTabChange}
              />
            )}
          </div>
        )}

        {mountedTabs.has("staff") && (
          <div
            key="view-staff"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "staff" ? "" : "hidden"}`}
            style={{ display: activeTab === "staff" ? undefined : "none" }}
          >
            <StaffView
              staffList={staffList}
              setStaffList={setStaffList}
              persona={isFranchiser ? "franchiser" : "branch_admin"}
              selectedBranchId={selectedBranchId}
              showToast={showToast}
              routeAction={routeAction}
            />
          </div>
        )}


        {mountedTabs.has("kds") && (
          <div
            key="view-kds"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "kds" ? "" : "hidden"}`}
            style={{ display: activeTab === "kds" ? undefined : "none" }}
          >
            {hasFeature("KITCHEN") ? (
              <KdsView
                kdsTickets={kdsTickets}
                setKdsTickets={setKdsTickets}
                handleAdvanceKds={handleAdvanceKds}
                showToast={showToast}
              />
            ) : (
              <ModuleLockedView
                moduleName="Kitchen Display System (KDS)"
                requiredFeature="KITCHEN"
                onNavigate={handleTabChange}
              />
            )}
          </div>
        )}

        {mountedTabs.has("riders") && (
          <div
            key="view-riders"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "riders" ? "" : "hidden"}`}
            style={{ display: activeTab === "riders" ? undefined : "none" }}
          >
            {hasFeature("RIDER") ? (
              <RiderDispatchView
                deliveries={deliveries}
                setDeliveries={setDeliveries}
                persona={isFranchiser ? "franchiser" : "branch_admin"}
                selectedBranchId={selectedBranchId}
                orders={orders}
                setOrders={setOrders}
                kdsTickets={kdsTickets}
                setKdsTickets={setKdsTickets}
                staffList={staffList}
                showToast={showToast}
              />
            ) : (
              <ModuleLockedView
                moduleName="Rider Dispatch & Fleet"
                requiredFeature="RIDER"
                onNavigate={handleTabChange}
              />
            )}
          </div>
        )}

        {mountedTabs.has("menu") && (
          <div
            key="view-menu"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "menu" ? "block" : "hidden"}`}
            style={{ display: activeTab === "menu" ? undefined : "none" }}
          >
            {hasFeature("MENU") ? (
              <MenuView
                menuItems={menuItems}
                onAddDish={handleAddDish}
                onUpdateDish={handleUpdateDish}
                onDeleteDish={handleDeleteDish}
                handleToggleStock={handleToggleStock}
                onToggleStock={handleToggleStock}
                showToast={showToast}
                routeAction={routeAction}
              />
            ) : (
              <ModuleLockedView
                moduleName="Menu Management"
                requiredFeature="MENU"
                onNavigate={handleTabChange}
                onNavigateOverview={() => handleTabChange("overview")}
              />
            )}
          </div>
        )}

        {mountedTabs.has("inventory") && (
          <div
            key="view-inventory"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "inventory" ? "" : "hidden"}`}
            style={{ display: activeTab === "inventory" ? undefined : "none" }}
          >
            {hasFeature("INVENTORY") ? (
              <InventoryView
                showToast={showToast}
              />
            ) : (
              <ModuleLockedView
                moduleName="Stock & Inventory Suite"
                requiredFeature="INVENTORY"
                onNavigate={handleTabChange}
              />
            )}
          </div>
        )}

        {mountedTabs.has("procurement") && (
          <div
            key="view-procurement"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "procurement" ? "" : "hidden"}`}
            style={{ display: activeTab === "procurement" ? undefined : "none" }}
          >
            {hasFeature("PROCUREMENT") ? (
              <ProcurementView
                showToast={showToast}
              />
            ) : (
              <ModuleLockedView
                moduleName="Procurement & Purchase Orders"
                requiredFeature="PROCUREMENT"
                onNavigate={handleTabChange}
              />
            )}
          </div>
        )}

        {mountedTabs.has("expenses") && (
          <div
            key="view-expenses"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "expenses" ? "" : "hidden"}`}
            style={{ display: activeTab === "expenses" ? undefined : "none" }}
          >
            {hasFeature("EXPENSES") ? (
              <ExpensesView
                showToast={showToast}
              />
            ) : (
              <ModuleLockedView
                moduleName="Expenses & OPEX"
                requiredFeature="EXPENSES"
                onNavigate={handleTabChange}
              />
            )}
          </div>
        )}

        {mountedTabs.has("tables") && (
          <div
            key="view-tables"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "tables" ? "" : "hidden"}`}
            style={{ display: activeTab === "tables" ? undefined : "none" }}
          >
            {hasFeature("TABLES") ? (
              <TableView
                showToast={showToast}
                routeAction={routeAction}
              />
            ) : (
              <ModuleLockedView
                moduleName="Floor Matrix & Tables"
                requiredFeature="TABLES"
                onNavigate={handleTabChange}
              />
            )}
          </div>
        )}

        {(mountedTabs.has("analytics") || mountedTabs.has("orders")) && (
          <div
            key="view-analytics"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "analytics" || activeTab === "orders" ? "" : "hidden"}`}
            style={{ display: activeTab === "analytics" || activeTab === "orders" ? undefined : "none" }}
          >
            {hasFeature("REPORTS") || hasFeature("ANALYTICS") ? (
              <AnalyticsView
                user={user || undefined}
                showToast={showToast}
              />
            ) : (
              <ModuleLockedView
                moduleName="Analytics & Reports"
                requiredFeature="REPORTS"
                onNavigate={handleTabChange}
              />
            )}
          </div>
        )}

        {mountedTabs.has("settings") && user && (
          <div
            key="view-settings"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "settings" ? "" : "hidden"}`}
            style={{ display: activeTab === "settings" ? undefined : "none" }}
          >
            <SettingsView
              user={user}
              showToast={showToast}
            />
          </div>
        )}

        {mountedTabs.has("subscription") && (
          <div
            key="view-subscription"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "subscription" ? "" : "hidden"}`}
            style={{ display: activeTab === "subscription" ? undefined : "none" }}
          >
            <SubscriptionView
              user={user}
              branches={branches}
              staffList={staffList}
              orders={orders}
              showToast={showToast}
            />
          </div>
        )}

        {mountedTabs.has("profile") && user && (
          <div
            key="view-profile"
            className={`w-full flex-1 flex flex-col min-h-0 ${activeTab === "profile" ? "" : "hidden"}`}
            style={{ display: activeTab === "profile" ? undefined : "none" }}
          >
            <ProfileView
              user={user}
              showToast={showToast}
            />
          </div>
        )}
      </main>

      {/* Mobile & Tablet Bottom Navigation Dock (< 1024px) */}
      <AdminBottomDock
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenMenuDrawer={() => setIsMenuDrawerOpen(true)}
        kdsCount={kdsTickets.length}
        userInitials={
          (user?.restaurantName || user?.name || "N")
            .trim()
            .substring(0, 1)
            .toUpperCase()
        }
        restaurantName={user?.restaurantName}
        isHidden={isMenuDrawerOpen}
        hasPos={hasFeature("POS")}
        hasKitchen={hasFeature("KITCHEN")}
      />

      {/* Mobile & Tablet Bottom Sheet Grid Drawer (< 1024px) */}
      <AdminMenuDrawer
        isOpen={isMenuDrawerOpen}
        onClose={() => setIsMenuDrawerOpen(false)}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={() => {
          logout();
          router.push("/login");
        }}
        permittedNavItems={user ? getPermittedNavigation(user.role, user.assignedFeatures || [], user.terminalAccess) : undefined}
        counts={{
          kdsTickets: kdsTickets.length,
          activeRiders: deliveries.filter(
            (d) => d.status === "on_route" || d.status === "assigned" || d.status === "picked_up"
          ).length,
          staffTotal: staffList.length,
          menuAlerts: menuItems.filter((i) => i.stockStatus !== "in_stock").length,
        }}
      />
    </div>
  );
}
