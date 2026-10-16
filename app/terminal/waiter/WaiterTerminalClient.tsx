"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  RefreshCw,
  Search,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  UtensilsCrossed,
  ChefHat,
  Filter,
  Check,
  Building2,
  History,
  Send,
  ShoppingBag,
  LogOut,
} from "lucide-react";
import {
  MenuItem,
  CartItem,
  TableStatus,
  OrderRecord,
  KitchenTicket,
  ItemVariant,
  KdsTicket,
} from "@/app/admin/types";
import { useAuth } from "@/app/admin/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import {
  getStoredMenu,
  saveStoredMenu,
  getStoredRawRecipes,
  saveStoredRawRecipes,
  getStoredBaseMaterials,
  saveStoredBaseMaterials,
  getStoredTables,
  saveStoredTables,
  playWaiterChime,
  playWaiterBuzzer,
  saveStoredKdsTickets,
  getStoredKdsTickets,
  getStoredBranchSettings,
  saveStoredBranchSettings,
  clearUserSession,
  setActiveUserSession,
} from "@/lib/tenantStore";
import {
  subscribeToKitchenWaiterBridge,
  subscribeToRemoteKitchenBuzzer,
  broadcastWaiterOrderPickedUp,
  broadcastWaiterOrderServed,
  playRemoteAudioChime,
  getKitchenBroadcastTopic,
} from "@/lib/kitchenWaiterBridge";
import {
  applyRecipeCalculationsToMenu,
  calculateVariantPortions,
  calculateRecipePortions,
  simulateCartRawMaterials,
  getItemCartQuantity,
  computeReservedMaterialsFromActiveOrders,
  getItemActiveReservedQuantity,
  RawMaterialStockData,
  RecipeItemData,
} from "@/lib/recipePortions";
import {
  computeUnifiedMenuCatalog,
  broadcastStockRefresh,
  subscribeToStockRefresh,
  calculateUnifiedAvailableStock,
} from "@/lib/unifiedStock";
import { deductInventoryStockForOrder } from "@/lib/inventoryDeduction";
import {
  safeUpdateKitchenTicket,
  applyOrderFilter,
} from "@/lib/kitchenTicketSync";
import {
  notifyInventoryStockDeducted,
  saveSharedPosCart,
} from "@/lib/posLedgerSync";
import {
  fetchActiveUnpaidTableRecords,
  reconcileTableStatuses,
  autoHealDatabaseTableOccupancy,
  isTableMatchingIdentifier,
  normalizeTableNumber,
  isOrderOccupyingTable,
  subscribeToTableReleased,
  type ActiveUnpaidTableRecord,
} from "@/lib/tableOccupancy";
import { isTicketExpired } from "@/lib/orderExpiry";
import { playPosSound } from "@/utils/posAudio";
import MenuCategoriesAndSearch, {
  CategoryOption,
} from "../pos/components/MenuCategoriesAndSearch";
import ItemGridAndModifiers from "../pos/components/ItemGridAndModifiers";
import FloorMatrixModal from "../pos/components/FloorMatrixModal";
import { getTicketStation } from "../kitchen/KitchenTerminalClient";
import { splitOrderIntoStationTickets, getMenuItemStation } from "@/lib/kitchenStationRouting";
import WaiterSidebar, { WaiterViewMode } from "./components/WaiterSidebar";
import WaiterOrderTicketPane from "./components/WaiterOrderTicketPane";
import WaiterReadyPassView from "./components/WaiterReadyPassView";
import WaiterFloorQueueView from "./components/WaiterFloorQueueView";
import WaiterReadyAlertToast, {
  WaiterReadyAlert,
} from "./components/WaiterReadyAlertToast";
import StaffShiftRolloverModal from "../components/StaffShiftRolloverModal";
import { recordStaffShiftLogout } from "@/lib/universalShiftLogging";

const DEFAULT_TABLES: TableStatus[] = [
  { id: 1, label: "Table 01", capacity: 4, section: "Main Dining", status: "available" },
  { id: 2, label: "Table 02", capacity: 2, section: "Main Dining", status: "available" },
  { id: 3, label: "Table 03", capacity: 6, section: "Main Dining", status: "available" },
  { id: 4, label: "Table 04", capacity: 4, section: "Terrace", status: "available" },
  { id: 5, label: "Table 05", capacity: 8, section: "Terrace", status: "available" },
  { id: 6, label: "Table 06", capacity: 2, section: "Lounge", status: "available" },
  { id: 7, label: "Table 07", capacity: 4, section: "Lounge", status: "available" },
  { id: 8, label: "Table 08", capacity: 4, section: "VIP Room", status: "available" },
];

export default function WaiterTerminalClient() {
  const { user, setUser, shiftValidation, isShiftLocked, logout } = useAuth();
  const router = useRouter();
  const currentOrgId = user?.organizationId || user?.id || "default";

  // Shift Rollover & Timing Governance
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [shiftSnoozedUntil, setShiftSnoozedUntil] = useState<number>(0);

  useEffect(() => {
    if (!isShiftLocked) {
      setIsRolloverModalOpen(false);
      return;
    }

    const checkPrompt = () => {
      const now = Date.now();
      if (now >= shiftSnoozedUntil) {
        setIsRolloverModalOpen(true);
      }
    };

    checkPrompt();
    const timer = setInterval(checkPrompt, 5000);
    return () => clearInterval(timer);
  }, [isShiftLocked, shiftSnoozedUntil]);

  const handleRolloverSuccess = (nextShift: string) => {
    if (user) {
      const updatedUser = { ...user, assignedShift: nextShift };
      setUser(updatedUser);
      setActiveUserSession(updatedUser);
    }
    setShiftSnoozedUntil(0);
    setIsRolloverModalOpen(false);
    showToast(`✅ Floor Shift successfully rolled over to ${nextShift}!`);
  };

  const handleHandoverLogout = async () => {
    try {
      await recordStaffShiftLogout(user, { station: "waiter", notes: "Handed over at shift conclusion" });
    } catch {}
    clearUserSession();
    logout();
    router.replace("/login");
  };

  // Remind Me Later — dismiss modal and snooze for 15 minutes
  const handleRemindLater = () => {
    setIsRolloverModalOpen(false);
    setShiftSnoozedUntil(Date.now() + 15 * 60 * 1000);
    showToast("Shift alert snoozed. Reminding again in 15 minutes.");
  };

  // Views: "ordering" | "ready_pass" | "floor_queue"
  const [currentView, setCurrentView] = useState<WaiterViewMode>("ordering");

  // Menu, Inventory & Recipes State
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() =>
    getStoredMenu(currentOrgId, [])
  );
  const [rawRecipes, setRawRecipes] = useState<RecipeItemData[]>(() =>
    getStoredRawRecipes(currentOrgId)
  );
  const [baseMaterialsMap, setBaseMaterialsMap] = useState<
    Map<string, RawMaterialStockData>
  >(() => {
    const entries = getStoredBaseMaterials(currentOrgId);
    return new Map<string, RawMaterialStockData>(entries);
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inventoryTick, setInventoryTick] = useState<number>(0);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  // Table State
  const [tables, setTables] = useState<TableStatus[]>(() =>
    getStoredTables(currentOrgId, DEFAULT_TABLES)
  );
  const [activeUnpaidRecords, setActiveUnpaidRecords] = useState<ActiveUnpaidTableRecord[]>([]);
  const [selectedTable, setSelectedTable] = useState<number>(1);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);

  // Order Cart State - strictly locked to Dine-In table orders
  const [cart, setCart] = useState<CartItem[]>([]);
  const orderChannel: "dine_in" = "dine_in";
  const [tableNotes, setTableNotes] = useState<string>("");
  const [isSendingKot, setIsSendingKot] = useState<boolean>(false);

  // Real-time Tickets & Kitchen Pass State
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());
  const [floatingAlerts, setFloatingAlerts] = useState<WaiterReadyAlert[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const acknowledgedTicketsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  // Live timer tick every second for pickup countdowns
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  }, []);

  // 1. Concurrently Fetch Live Menu Catalog, Recipe Items (BOM), Raw Materials, and Active Orders
  const fetchLiveMenuCatalog = useCallback(async () => {
    try {
      const { restId } = await getValidTenantContext(user);
      if (!restId) return;
      const supabase = createClient();

      // Concurrently fetch menu items, recipe BOM items, raw materials, and active unfulfilled orders
      const [menuRes, recipeRes, materialsRes, ordersRes] = await Promise.all([
        supabase
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false }),
        supabase
          .from("recipe_items")
          .select(
            "menu_item_id, variant_id, variant_name, raw_material_id, quantity_required, unit, raw_materials(id, name, current_stock, min_safety_stock, cost_per_unit, unit)"
          )
          .eq("restaurant_id", restId),
        supabase
          .from("raw_materials")
          .select("id, name, current_stock, min_safety_stock, cost_per_unit, unit")
          .eq("restaurant_id", restId),
        supabase
          .from("orders")
          .select("id, order_number, order_status, items")
          .eq("restaurant_id", restId)
          .eq("order_status", "active"),
      ]);

      const menuData = menuRes.data || [];
      const recipeRows = recipeRes.data || [];
      const materialRows = materialsRes.data || [];
      const activeOrdersRows = ordersRes.data || [];

      // Populate base raw materials map
      const bMap = new Map<string, RawMaterialStockData>();
      if (materialRows && materialRows.length > 0) {
        materialRows.forEach((m: any) => {
          bMap.set(String(m.id), {
            id: m.id,
            name: m.name,
            current_stock: Math.max(0, Number(m.current_stock) || 0),
            min_safety_stock: Number(m.min_safety_stock) || 0,
            cost_per_unit: Number(m.cost_per_unit) || 0,
            unit: m.unit,
          });
        });
      }
      if (recipeRows && recipeRows.length > 0) {
        recipeRows.forEach((r: any) => {
          const rawObj = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
          if (rawObj && rawObj.id && !bMap.has(String(rawObj.id))) {
            bMap.set(String(rawObj.id), {
              id: rawObj.id,
              name: rawObj.name,
              current_stock: Math.max(0, Number(rawObj.current_stock) || 0),
              min_safety_stock: Number(rawObj.min_safety_stock) || 0,
              cost_per_unit: Number(rawObj.cost_per_unit) || 0,
              unit: rawObj.unit,
            });
          }
        });
        setRawRecipes(recipeRows);
        saveStoredRawRecipes(currentOrgId, recipeRows);
      }
      setBaseMaterialsMap(bMap);
      saveStoredBaseMaterials(currentOrgId, bMap);
      setActiveOrders(activeOrdersRows);

      if (menuData.length > 0) {
        const mappedMenu = computeUnifiedMenuCatalog({
          menuRows: menuData,
          recipeRows,
          materialRows,
          activeOrders: activeOrdersRows,
        });

        setMenuItems(mappedMenu);
        saveStoredMenu(currentOrgId, mappedMenu);
      }
    } catch (err) {
      console.warn("[WaiterTerminal] Catalog sync warning:", err);
    }
  }, [user, currentOrgId]);

  // 2. Fetch Live Dining Tables from Supabase
  const fetchLiveTables = useCallback(async () => {
    try {
      const { restId } = await getValidTenantContext(user);
      if (!restId) return;
      const supabase = createClient();
      const [tableRes, activeRecords] = await Promise.all([
        supabase
          .from("restaurant_tables")
          .select("*")
          .eq("restaurant_id", restId)
          .order("table_number", { ascending: true }),
        fetchActiveUnpaidTableRecords(restId, supabase),
      ]);

      const tableData = tableRes.data;
      const tableErr = tableRes.error;

      if (!tableErr && tableData && tableData.length > 0) {
        const mappedTables: TableStatus[] = tableData.map((t: any, idx: number) => {
          let resolvedId = idx + 1;
          const num = Number(t.id);
          if (!isNaN(num) && num > 0 && num < 100000) resolvedId = num;
          else if (t.table_number) {
            const extracted = parseInt(String(t.table_number).replace(/\D/g, ""), 10);
            if (!isNaN(extracted) && extracted > 0) resolvedId = extracted;
          }
          let label = String(t.table_number || t.name || `Table ${resolvedId}`).trim();
          if (/^\d+$/.test(label)) label = `Table ${label}`;
          const rawStatus = String(t.status || "available").toLowerCase();
          const isOccupied =
            rawStatus === "occupied" ||
            rawStatus === "seated" ||
            rawStatus === "dining" ||
            rawStatus === "billed";
          return {
            id: resolvedId,
            dbId: t.id,
            label,
            capacity: Number(t.seating_capacity ?? t.capacity ?? 4),
            section: t.section_name || t.floor_name || "Main Dining",
            sectionName: t.section_name || t.floor_name || "Main Dining",
            status: isOccupied ? "seated" : rawStatus === "reserved" ? "reserved" : "available",
            activeOrderId: (t.active_order_id || t.current_order_id) ? String(t.active_order_id || t.current_order_id) : undefined,
          };
        });

        const reconciled = reconcileTableStatuses(mappedTables, activeRecords);
        setActiveUnpaidRecords(activeRecords);
        setTables(reconciled);
        saveStoredTables(currentOrgId, reconciled);
        autoHealDatabaseTableOccupancy(restId, reconciled, activeRecords, supabase);
      }
    } catch (err) {
      console.warn("[WaiterTerminal] Tables sync warning:", err);
    }
  }, [user, currentOrgId]);

  useEffect(() => {
    fetchLiveMenuCatalog();
    fetchLiveTables();
  }, [fetchLiveMenuCatalog, fetchLiveTables]);

  // Subscribe to live global stock refresh events across all terminals
  useEffect(() => {
    let unsubStock: (() => void) | undefined;
    const initRealtimeStock = async () => {
      const { restId } = await getValidTenantContext(user);
      if (!restId) return;
      unsubStock = subscribeToStockRefresh(restId, () => {
        fetchLiveMenuCatalog();
      });
    };
    initRealtimeStock();
    return () => {
      if (unsubStock) unsubStock();
    };
  }, [user, fetchLiveMenuCatalog]);

  // Reconcile table occupancy dynamically: strictly single-source using activeUnpaidRecords
  useEffect(() => {
    setTables((prev) => reconcileTableStatuses(prev, activeUnpaidRecords));
  }, [activeUnpaidRecords]);

  // Subscribe to TABLE_RELEASED broadcast events from bill settlements
  useEffect(() => {
    let unsubRelease: (() => void) | undefined;
    getValidTenantContext(user).then(({ restId }) => {
      if (!restId) return;
      const supabase = createClient();
      unsubRelease = subscribeToTableReleased(
        restId,
        (data) => {
          // Immediately release table in state and clear stale amounts
          setTables((prev) => {
            const updated = prev.map((t) => {
              const matches =
                (data.tableId && (String(t.dbId) === String(data.tableId) || String(t.id) === String(data.tableId))) ||
                (data.tableNumber && isTableMatchingIdentifier(t, data.tableNumber)) ||
                (data.orderId && (t.activeOrderId === data.orderId || String(t.activeOrderId) === String(data.orderId)));

              if (matches) {
                return {
                  ...t,
                  status: "available" as const,
                  activeOrderId: undefined,
                  activeAmount: undefined,
                };
              }
              return t;
            });
            saveStoredTables(currentOrgId, updated);
            saveStoredTables(String(restId), updated);
            return updated;
          });

          // Filter out settled order/table from activeUnpaidRecords
          setActiveUnpaidRecords((prev) =>
            prev.filter((r) => {
              if (data.orderId && (r.orderId === data.orderId || r.kotId === data.orderId)) return false;
              if (data.tableNumber && (r.tableIdentifier === data.tableNumber || normalizeTableNumber(r.tableIdentifier) === normalizeTableNumber(data.tableNumber))) return false;
              if (data.tableId && String(r.tableId) === String(data.tableId)) return false;
              return true;
            })
          );

          // Clear settled order from local storage
          try {
            const rawRunning = localStorage.getItem(`pos_running_kot_orders_${currentOrgId}`) || localStorage.getItem(`pos_running_kot_orders_${restId}`);
            if (rawRunning) {
              const parsed = JSON.parse(rawRunning);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter((o) => {
                  if (data.orderId && (String(o.id) === String(data.orderId) || o.kotId === data.orderId)) return false;
                  if (data.tableNumber && (o.tableName === data.tableNumber || isTableMatchingIdentifier({ label: data.tableNumber }, o.tableId))) return false;
                  return true;
                });
                localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(filtered));
                localStorage.setItem(`pos_running_kot_orders_${restId}`, JSON.stringify(filtered));
              }
            }
          } catch {}

          fetchLiveTables();
        },
        supabase
      );
    });

    return () => {
      if (unsubRelease) unsubRelease();
    };
  }, [user, currentOrgId, fetchLiveTables]);

  // On initial mount or table list load, default to an available table if initial table is occupied
  const initialTablePickedRef = useRef(false);
  useEffect(() => {
    if (!tables || tables.length === 0 || initialTablePickedRef.current) return;
    const currentT = tables.find((t) => t.id === selectedTable);
    const isOcc = currentT && (currentT.status === "seated" || currentT.status === "occupied" || currentT.status === "billing");
    if (isOcc || !currentT) {
      const availableTable = tables.find((t) => t.status === "available" || (!t.status && t.status !== "reserved"));
      if (availableTable) {
        setSelectedTable(availableTable.id);
        initialTablePickedRef.current = true;
      }
    } else {
      initialTablePickedRef.current = true;
    }
  }, [tables]);

  // 3. Real-Time Shared Raw Material Ledger (clean base ledger without local cart deduction)
  const effectiveLedger = useMemo(() => {
    return baseMaterialsMap;
  }, [baseMaterialsMap, inventoryTick]);

  // 4. Live Simulated Menu Items directly bound to menuItems (unified via computeUnifiedMenuCatalog)
  const liveSimulatedMenuItems = useMemo(() => {
    return menuItems;
  }, [menuItems, inventoryTick]);

  // Dynamic categories calculated from live simulated menu items
  const waiterCategories: CategoryOption[] = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    let featuredCount = 0;
    liveSimulatedMenuItems.forEach((item) => {
      if (item.isPopular || (item as any).isFeatured || (item as any).is_popular || (item as any).is_featured) {
        featuredCount++;
      }
      const cat = item.category || "other";
      const key = cat.toLowerCase();
      if (map.has(key)) {
        map.get(key)!.count += 1;
      } else {
        map.set(key, {
          id: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " "),
          count: 1,
        });
      }
    });
    const result = Array.from(map.values());
    if (featuredCount > 0) {
      result.unshift({
        id: "featured",
        label: "⭐ Featured / Best Sellers",
        count: featuredCount,
      });
    }
    return result;
  }, [liveSimulatedMenuItems]);

  // Unified Item & Variant Stock Calculation: single source of truth formula across all terminals
  const getVariantPortions = useCallback(
    (item: MenuItem, variant?: ItemVariant) => {
      const rawItemId = String(item.id);
      const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;
      let dishRecipes = rawRecipes.filter(
        (r) => String(r.menu_item_id) === baseId || String(r.menu_item_id) === rawItemId
      );
      if (dishRecipes.length === 0) {
        if (Array.isArray((item as any).recipe) && (item as any).recipe.length > 0) {
          dishRecipes = (item as any).recipe;
        } else if (Array.isArray((item as any).recipe_items) && (item as any).recipe_items.length > 0) {
          dishRecipes = (item as any).recipe_items;
        }
      }

      const res = calculateUnifiedAvailableStock({
        item,
        variant,
        rawMaterialsLookup: baseMaterialsMap,
        dishRecipes,
        activeOrders,
      });

      return {
        maxPortions: res.availableStock,
        availablePortions: res.availableStock,
        isOutOfStock: res.isOutOfStock,
        stockStatus: res.stockStatus,
        limitingIngredient: res.limitingIngredient?.name || res.limitingIngredient,
      };
    },
    [rawRecipes, baseMaterialsMap, activeOrders]
  );

  // Filtered menu items by category and search query using live simulated catalog
  const filteredMenuItems = useMemo(() => {
    return liveSimulatedMenuItems.filter((item) => {
      const isItemFeatured = Boolean(
        item.isPopular ||
        (item as any).isFeatured ||
        (item as any).is_popular ||
        (item as any).is_featured
      );
      const matchesCategory =
        selectedCategory === "all" ||
        (selectedCategory === "featured" && isItemFeatured) ||
        (item.category || "").toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((searchQuery.toLowerCase().includes("feat") ||
          searchQuery.toLowerCase().includes("best") ||
          searchQuery.toLowerCase().includes("pop")) &&
          isItemFeatured);
      return matchesCategory && matchesSearch;
    });
  }, [liveSimulatedMenuItems, selectedCategory, searchQuery, inventoryTick]);

  // Cart operations with Live Stock Availability verification
  const handleAddToCart = useCallback(
    (item: MenuItem, notes?: string) => {
      const variantObj = item.selectedVariant;
      const itemStock = variantObj
        ? getVariantPortions(item, variantObj)
        : getVariantPortions(item);
      const isOutOfStock = itemStock.isOutOfStock || itemStock.maxPortions <= 0;

      if (isOutOfStock) {
        playPosSound("buzz");
        showToast(`Insufficient stock available: "${item.name}" has reached its maximum available limit.`);
        return;
      }

      let limitReached = false;

      setCart((prev) => {
        const variantKey = variantObj?.id || "def";
        const existingIdx = prev.findIndex(
          (c) =>
            c.item.id === item.id &&
            (c.selectedVariant?.id || "def") === variantKey &&
            (c.notes || "") === (notes || "")
        );

        if (existingIdx >= 0) {
          const currentQty = prev[existingIdx].quantity;
          if (currentQty >= itemStock.maxPortions) {
            limitReached = true;
            return prev;
          }
          return prev.map((c, idx) =>
            idx === existingIdx ? { ...c, quantity: c.quantity + 1 } : c
          );
        }

        const newItem: CartItem = {
          item,
          quantity: 1,
          selectedVariant: variantObj,
          notes: notes || undefined,
        };
        return [...prev, newItem];
      });

      if (limitReached) {
        playPosSound("buzz");
        showToast(`Insufficient stock available: Cannot add more "${item.name}". Only ${itemStock.maxPortions} available.`);
        return;
      }

      setInventoryTick((prev) => prev + 1);
      playPosSound("chirp");
      showToast(`Added ${item.name} to ticket.`);
    },
    [getVariantPortions, showToast]
  );

  const handleUpdateCartQty = useCallback(
    (target: CartItem, delta: number) => {
      if (delta > 0) {
        const variantObj = target.selectedVariant || target.item.selectedVariant;
        const itemStock = variantObj
          ? getVariantPortions(target.item, variantObj)
          : getVariantPortions(target.item);
        if (itemStock.isOutOfStock || itemStock.maxPortions <= 0 || target.quantity >= itemStock.maxPortions) {
          playPosSound("buzz");
          showToast(`Insufficient stock available: Cannot add more "${target.item.name}". Only ${itemStock.maxPortions} available.`);
          return;
        }
      }

      setCart((prev) => {
        const variantKey = target.selectedVariant?.id || "def";
        return prev
          .map((c) => {
            if (
              c.item.id === target.item.id &&
              (c.selectedVariant?.id || "def") === variantKey &&
              (c.notes || "") === (target.notes || "")
            ) {
              const nextQty = c.quantity + delta;
              return nextQty > 0 ? { ...c, quantity: nextQty } : null;
            }
            return c;
          })
          .filter(Boolean) as CartItem[];
      });
      setInventoryTick((prev) => prev + 1);
    },
    [getVariantPortions, showToast]
  );

  const handleClearCart = useCallback(() => {
    setCart([]);
    setTableNotes("");
    showToast("Cleared table ticket.");
  }, [showToast]);

  // Dynamic Sales Tax configured per restaurant tenant (Parity with POS Terminal)
  const [taxRatePercent, setTaxRatePercent] = useState<number>(() => {
    if (typeof window === "undefined") return 16;
    try {
      const direct = localStorage.getItem(`pos_tax_rate_${currentOrgId}`);
      if (direct !== null && !isNaN(Number(direct))) return Number(direct);
      const cached = getStoredBranchSettings(currentOrgId, "1");
      if (cached && typeof cached.taxRatePercent === "number") return cached.taxRatePercent;
    } catch { }
    return 16;
  });

  useEffect(() => {
    let isMounted = true;
    const fetchTaxRate = async () => {
      try {
        const { restId } = await getValidTenantContext(user);
        if (!restId) return;

        const supabase = createClient();
        const { data: restRow } = await supabase
          .from("restaurants")
          .select("tax_rate, tax_rate_percent")
          .eq("id", restId)
          .maybeSingle();

        if (restRow && isMounted) {
          const val = (restRow as any).tax_rate ?? (restRow as any).tax_rate_percent;
          if (val !== null && val !== undefined && !isNaN(Number(val))) {
            const resolved = Number(val);
            setTaxRatePercent(resolved);
            try {
              localStorage.setItem(`pos_tax_rate_${restId}`, String(resolved));
              saveStoredBranchSettings(currentOrgId, "1", { taxRatePercent: resolved });
            } catch { }
          }
        }
      } catch (err) {
        console.warn("[WaiterTerminal] Tax rate sync error:", err);
      }
    };

    fetchTaxRate();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === `pos_tax_rate_${currentOrgId}` && e.newValue !== null) {
        setTaxRatePercent(Number(e.newValue));
      }
    };
    const handleCustomTaxChange = (e: any) => {
      if (
        (e.detail?.restaurantId === String(currentOrgId) || !e.detail?.restaurantId) &&
        typeof e.detail?.taxRate === "number"
      ) {
        setTaxRatePercent(e.detail.taxRate);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("pos_tax_rate_updated" as any, handleCustomTaxChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pos_tax_rate_updated" as any, handleCustomTaxChange);
    };
  }, [user, currentOrgId]);

  // Cart Financials
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, c) => {
      const price = c.selectedVariant?.price ?? c.item.price;
      return acc + price * c.quantity;
    }, 0);
  }, [cart]);

  const salesTaxAmount = useMemo(() => {
    return Math.round((cartSubtotal * taxRatePercent) / 100);
  }, [cartSubtotal, taxRatePercent]);

  const cartTotal = useMemo(() => {
    return cartSubtotal + salesTaxAmount;
  }, [cartSubtotal, salesTaxAmount]);

  // Realtime Kitchen Sync & Ready Notifications
  const triggerReadyNotification = useCallback(
    (ticket: KdsTicket) => {
      if (acknowledgedTicketsRef.current.has(ticket.id)) return;
      acknowledgedTicketsRef.current.add(ticket.id);

      if (soundEnabled) {
        playRemoteAudioChime(ticket.priority === "urgent" || ticket.priority === "rush");
      }

      const newAlert: WaiterReadyAlert = {
        ticketId: ticket.id,
        tableOrChannel: ticket.tableOrChannel || "Counter",
        items: ticket.items || [],
        readyAt: ticket.ready_for_pickup_at || new Date().toISOString(),
        priority: ticket.priority,
      };

      setFloatingAlerts((prev) => [
        newAlert,
        ...prev.filter((a) => a.ticketId !== ticket.id),
      ]);

      showToast(`🔔 ORDER #${ticket.id} READY at Kitchen Pass - ${ticket.tableOrChannel || "Counter"}`);
    },
    [soundEnabled, showToast]
  );

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    // Debounce timers to batch rapid realtime updates
    let liveMenuTimer: NodeJS.Timeout | null = null;
    const debouncedFetchLiveMenu = () => {
      if (liveMenuTimer) clearTimeout(liveMenuTimer);
      liveMenuTimer = setTimeout(() => {
        if (isMounted) fetchLiveMenuCatalog();
      }, 250);
    };

    let liveTablesTimer: NodeJS.Timeout | null = null;
    const debouncedFetchLiveTables = () => {
      if (liveTablesTimer) clearTimeout(liveTablesTimer);
      liveTablesTimer = setTimeout(() => {
        if (isMounted) fetchLiveTables();
      }, 250);
    };

    // 1. Cross-tab BroadcastChannel & Window Events Bridge Listener
    const unsubBridge = subscribeToKitchenWaiterBridge(currentOrgId, {
      onOrderReady: (payload) => {
        if (!isMounted) return;
        const ticketId = payload.ticketId;
        setTickets((prev) => {
          const existing = prev.find((t) => t.id === ticketId);
          if (existing) {
            const updated: KdsTicket = {
              ...existing,
              status: "ready",
              ready_for_pickup_at: payload.readyAt,
              items: payload.items && payload.items.length > 0 ? (payload.items as any) : existing.items,
              priority: (payload.priority as any) || existing.priority,
            };
            triggerReadyNotification(updated);
            return prev.map((t) => (t.id === ticketId ? updated : t));
          } else {
            const newT: KdsTicket = {
              id: ticketId,
              tableOrChannel: payload.tableNumber,
              orderType: "dine_in",
              elapsedMinutes: 0,
              items: payload.items as any,
              status: "ready",
              ready_for_pickup_at: payload.readyAt,
              serverName: "Floor Waiter",
              priority: (payload.priority as any) || "normal",
              createdAt: "Just now",
            };
            triggerReadyNotification(newT);
            return [newT, ...prev];
          }
        });
      },
      onOrderPickedUp: (payload) => {
        if (!isMounted) return;
        setTickets((prev) =>
          prev.map((t) =>
            t.id === payload.ticketId
              ? { ...t, picked_up_at: payload.pickedUpAt }
              : t
          )
        );
        setFloatingAlerts((fa) => fa.filter((a) => a.ticketId !== payload.ticketId));
      },
      onOrderServed: (payload) => {
        if (!isMounted) return;
        setTickets((prev) =>
          prev.map((t) =>
            t.id === payload.ticketId
              ? { ...t, status: "completed", completed_at: payload.servedAt }
              : t
          )
        );
        setFloatingAlerts((fa) => fa.filter((a) => a.ticketId !== payload.ticketId));
      },
    });

    // 2. Remote Kitchen Buzzer Listener
    const unsubBuzzer = subscribeToRemoteKitchenBuzzer(currentOrgId, (payload) => {
      if (!isMounted) return;
      if (soundEnabled) {
        playRemoteAudioChime(payload.priority === "urgent" || payload.priority === "rush");
      }
      showToast(`🔔 ${payload.title ? `${payload.title}: ` : ""}${payload.message}`);
      if (payload.ticketId) {
        const newAlert: WaiterReadyAlert = {
          ticketId: payload.ticketId,
          tableOrChannel: payload.tableNumber || "Counter",
          items: [],
          readyAt: payload.readyAt || new Date().toISOString(),
          priority: payload.priority,
        };
        setFloatingAlerts((prev) => [
          newAlert,
          ...prev.filter((a) => a.ticketId !== payload.ticketId),
        ]);
      }
    });

    // 3. Cross-tab and Window Events Sync (Matching POS & Admin)
    const handleStorageUpdate = (e: StorageEvent) => {
      if (
        e.key === `pos_menu_${currentOrgId}` ||
        e.key?.startsWith("pos_menu_") ||
        e.key?.startsWith("pos_inventory_deducted_")
      ) {
        debouncedFetchLiveMenu();
      }
      if (
        e.key === `tables_list_${currentOrgId}` ||
        e.key === `omni_tables_${currentOrgId}` ||
        e.key?.startsWith("tables_list_") ||
        e.key?.startsWith("omni_tables_") ||
        e.key === `pos_orders_${currentOrgId}` ||
        e.key?.startsWith("pos_orders_") ||
        e.key?.startsWith("pos_running_kot_")
      ) {
        debouncedFetchLiveTables();
      }
    };
    const handleCustomMenuUpdated = (e: any) => {
      if (e.detail?.menu && Array.isArray(e.detail.menu)) {
        setMenuItems(e.detail.menu);
      }
      debouncedFetchLiveMenu();
    };
    const handleInventoryStockDeducted = () => {
      debouncedFetchLiveMenu();
    };
    const handleCustomTablesUpdated = () => {
      debouncedFetchLiveTables();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("pos_menu_updated", handleCustomMenuUpdated);
      window.addEventListener("inventory_stock_deducted", handleInventoryStockDeducted);
      window.addEventListener("pos_tables_updated", handleCustomTablesUpdated);
      window.addEventListener("restaurant_tables_changed", handleCustomTablesUpdated);
      window.addEventListener("orders_updated", handleCustomTablesUpdated);
    }

    let ledgerBc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        ledgerBc = new BroadcastChannel("pos_ledger_sync_channel");
        ledgerBc.onmessage = (event) => {
          if (event.data?.type === "INVENTORY_DEDUCTED") {
            debouncedFetchLiveMenu();
          } else if (event.data?.type === "TABLES_UPDATED") {
            debouncedFetchLiveTables();
          } else if (event.data?.type === "ORDERS_UPDATED") {
            debouncedFetchLiveTables();
            debouncedFetchLiveMenu();
          }
        };
      } catch { }
    }

    const initTerminalRealtime = async () => {
      try {
        const { restId } = await getValidTenantContext(user);
        if (!restId) return;
        const supabase = createClient();
        const subId = Math.random().toString(36).substring(2, 7);

        // Fetch recent kitchen tickets
        const { data, error } = await supabase
          .from("kitchen_tickets")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false })
          .limit(80);

        if (!error && data && isMounted) {
          const mapped: KdsTicket[] = data.map((t: any) => ({
            id: t.ticket_number || t.id,
            tableOrChannel: t.table_number || t.channel,
            orderType: t.channel,
            elapsedMinutes: t.elapsed_minutes || 0,
            items: Array.isArray(t.items) ? t.items : [],
            status: t.status,
            items_status: Array.isArray(t.items_status) ? t.items_status : null,
            station_assigned: t.station_assigned || null,
            serverName: t.server_name || "Floor Server",
            priority: t.priority || "normal",
            priority_reason: t.priority_reason || null,
            ready_for_pickup_at: t.ready_for_pickup_at || null,
            picked_up_at: t.picked_up_at || null,
            completed_at: t.completed_at || null,
            printed_at: t.printed_at || null,
            reprint_count: Number(t.reprint_count) || 0,
            createdAt: t.created_at
              ? new Date(t.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now",
            created_at: t.created_at || undefined,
          }));

          setTickets(mapped);

          // Seed already acknowledged tickets so we don't spam chime on first load
          mapped.forEach((t) => {
            if (t.ready_for_pickup_at) {
              acknowledgedTicketsRef.current.add(t.id);
            }
          });
        }

        // Full Supabase Realtime Channel Subscription (Catalog, BOM, Raw Materials & Tickets)
        channel = supabase
          .channel(`waiter_realtime_${restId}_${subId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "menu_items",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetchLiveMenu();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "categories",
            },
            () => {
              debouncedFetchLiveMenu();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "recipe_items",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetchLiveMenu();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "raw_materials",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetchLiveMenu();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "restaurant_tables",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetchLiveTables();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "orders",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetchLiveTables();
              debouncedFetchLiveMenu();
            }
          )
          .on(
            "broadcast",
            { event: "stock_refresh" },
            () => {
              debouncedFetchLiveMenu();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "kitchen_tickets",
              filter: `restaurant_id=eq.${restId}`,
            },
            (payload) => {
              if (!isMounted) return;

              if (payload.eventType === "INSERT") {
                const newRow: any = payload.new;
                const newT: KdsTicket = {
                  id: newRow.ticket_number || newRow.id,
                  tableOrChannel: newRow.table_number || newRow.channel,
                  orderType: newRow.channel,
                  elapsedMinutes: 0,
                  items: Array.isArray(newRow.items) ? newRow.items : [],
                  status: newRow.status,
                  items_status: Array.isArray(newRow.items_status) ? newRow.items_status : null,
                  station_assigned: newRow.station_assigned || null,
                  serverName: newRow.server_name || "Floor Server",
                  priority: newRow.priority || "normal",
                  priority_reason: newRow.priority_reason || null,
                  ready_for_pickup_at: newRow.ready_for_pickup_at || null,
                  picked_up_at: newRow.picked_up_at || null,
                  completed_at: newRow.completed_at || null,
                  printed_at: newRow.printed_at || null,
                  reprint_count: Number(newRow.reprint_count) || 0,
                  createdAt: newRow.created_at
                    ? new Date(newRow.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Just now",
                  created_at: newRow.created_at || undefined,
                };

                setTickets((prev) => [newT, ...prev.filter((t) => t.id !== newT.id)]);

                if (newRow.ready_for_pickup_at && !newRow.picked_up_at) {
                  triggerReadyNotification(newT);
                }
              } else if (payload.eventType === "UPDATE") {
                const uRow: any = payload.new;
                const ticketId = uRow.ticket_number || uRow.id;

                setTickets((prev) =>
                  prev.map((t) => {
                    if (t.id === ticketId) {
                      const updated: KdsTicket = {
                        ...t,
                        status: uRow.status,
                        priority: uRow.priority !== undefined ? uRow.priority : t.priority,
                        ready_for_pickup_at:
                          uRow.ready_for_pickup_at !== undefined
                            ? uRow.ready_for_pickup_at
                            : t.ready_for_pickup_at,
                        picked_up_at:
                          uRow.picked_up_at !== undefined
                            ? uRow.picked_up_at
                            : t.picked_up_at,
                        completed_at:
                          uRow.completed_at !== undefined
                            ? uRow.completed_at
                            : t.completed_at,
                        items: Array.isArray(uRow.items) ? uRow.items : t.items,
                        items_status: Array.isArray(uRow.items_status)
                          ? uRow.items_status
                          : t.items_status,
                      };

                      if (
                        (uRow.status === "ready" || uRow.ready_for_pickup_at) &&
                        !uRow.picked_up_at &&
                        !acknowledgedTicketsRef.current.has(ticketId)
                      ) {
                        triggerReadyNotification(updated);
                      }

                      if (uRow.picked_up_at || uRow.status === "completed") {
                        setFloatingAlerts((fa) => fa.filter((a) => a.ticketId !== ticketId));
                      }

                      return updated;
                    }
                    return t;
                  })
                );
              }
              debouncedFetchLiveTables();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "orders",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetchLiveTables();
            }
          )
          .on("broadcast", { event: "kitchen_buzzer_alert" }, ({ payload }) => {
            if (!isMounted || !payload) return;
            if (soundEnabled) {
              playRemoteAudioChime(payload.priority === "urgent" || payload.priority === "rush");
            }
            showToast(`🔔 ${payload.title ? `${payload.title}: ` : ""}${payload.message}`);
            if (payload.ticketId) {
              const newAlert: WaiterReadyAlert = {
                ticketId: payload.ticketId,
                tableOrChannel: payload.tableNumber || "Counter",
                items: Array.isArray(payload.items) ? payload.items : [],
                readyAt: payload.readyAt || new Date().toISOString(),
                priority: payload.priority,
              };
              setFloatingAlerts((prev) => [
                newAlert,
                ...prev.filter((a) => a.ticketId !== payload.ticketId),
              ]);
            }
          })
          .on("broadcast", { event: "order_ready" }, ({ payload }) => {
            if (!isMounted || !payload) return;
            const ticketId = payload.ticket_id || payload.ticketId;
            if (ticketId && !acknowledgedTicketsRef.current.has(ticketId)) {
              if (soundEnabled) {
                playRemoteAudioChime(payload.priority === "urgent" || payload.priority === "rush");
              }
              acknowledgedTicketsRef.current.add(ticketId);

              const newAlert: WaiterReadyAlert = {
                ticketId,
                tableOrChannel: payload.table_number || payload.tableNumber || "Counter",
                items: Array.isArray(payload.items) ? payload.items : [],
                readyAt: payload.ready_for_pickup_at || payload.readyAt || new Date().toISOString(),
                priority: payload.priority,
              };

              setFloatingAlerts((prev) => [
                newAlert,
                ...prev.filter((a) => a.ticketId !== ticketId),
              ]);
              showToast(`🔔 ORDER #${ticketId} READY at the kitchen pass!`);
            }
          })
          .subscribe();
      } catch (err) {
        console.warn("[WaiterTerminal] Realtime subscription init error:", err);
      }
    };

    initTerminalRealtime();

    return () => {
      isMounted = false;
      if (liveMenuTimer) clearTimeout(liveMenuTimer);
      if (liveTablesTimer) clearTimeout(liveTablesTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("pos_menu_updated", handleCustomMenuUpdated);
        window.removeEventListener("inventory_stock_deducted", handleInventoryStockDeducted);
        window.removeEventListener("pos_tables_updated", handleCustomTablesUpdated);
        window.removeEventListener("restaurant_tables_changed", handleCustomTablesUpdated);
        window.removeEventListener("orders_updated", handleCustomTablesUpdated);
      }
      unsubBridge();
      unsubBuzzer();
      if (ledgerBc) {
        try {
          ledgerBc.close();
        } catch { }
      }
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch { }
      }
    };
  }, [
    user,
    soundEnabled,
    triggerReadyNotification,
    showToast,
    currentOrgId,
    fetchLiveMenuCatalog,
    fetchLiveTables,
  ]);

  // Step 1: Mark Ticket Picked Up from Kitchen Pass (Acknowledge Handoff)
  const handleMarkPickedUp = async (ticketId: string) => {
    const targetTicket = tickets.find((t) => t.id === ticketId);

    const pickedUpIso = new Date().toISOString();
    const serverName = user?.name || "Floor Waiter";

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              picked_up_at: pickedUpIso,
              serverName,
            }
          : t
      )
    );

    setFloatingAlerts((prev) => prev.filter((a) => a.ticketId !== ticketId));
    playPosSound("chime");
    showToast(`✅ Order #${ticketId} Picked Up from Pass! Now Delivering to Table.`);

    broadcastWaiterOrderPickedUp({
      orgId: currentOrgId,
      ticketId,
      pickedUpAt: pickedUpIso,
      waiterName: serverName,
    });

    try {
      const { restId } = await getValidTenantContext(user);
      const supabase = createClient();
      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        {
          picked_up_at: pickedUpIso,
          server_name: serverName,
        },
        tickets.find((t) => t.id === ticketId),
        restId || currentOrgId
      );
    } catch (err) {
      console.warn("[WaiterTerminal] Error updating picked_up_at in Supabase:", err);
    }
  };

  // Step 2: Mark Order Delivered & Served to Table (Complete Handoff Loop with Deferred Stock Deduction)
  const handleMarkServed = async (ticketId: string) => {
    const targetTicket = tickets.find((t) => t.id === ticketId);

    const servedIso = new Date().toISOString();
    const serverName = user?.name || "Floor Waiter";

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: "completed",
              isDeducted: true,
              completed_at: servedIso,
              completedAt: servedIso,
            }
          : t
      )
    );

    setFloatingAlerts((prev) => prev.filter((a) => a.ticketId !== ticketId));
    playPosSound("tender");
    showToast(`🍽️ Order #${ticketId} Delivered & Served to Guests!`);

    broadcastWaiterOrderServed({
      orgId: currentOrgId,
      ticketId,
      servedAt: servedIso,
      waiterName: serverName,
    });

    // Inventory stock was already exact-once deducted upon order placement / KOT dispatch.
    // Marking an order served/delivered to table must never trigger duplicate inventory deduction.

    try {
      const { restId } = await getValidTenantContext(user);
      const supabase = createClient();
      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        {
          status: "completed",
          completed_at: servedIso,
        },
        targetTicket || tickets.find((t) => t.id === ticketId),
        restId || currentOrgId
      );

      let orderQuery: any = supabase
        .from("orders")
        .update({ order_status: "active", updated_at: servedIso });
      if (restId) orderQuery = orderQuery.eq("restaurant_id", restId);
      orderQuery = applyOrderFilter(orderQuery, ticketId);
      await orderQuery;

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("orders_updated", { detail: { restaurantId: restId, orderId: ticketId, timestamp: Date.now() } }));
        localStorage.setItem(`pos_orders_${currentOrgId}`, String(Date.now()));
        window.dispatchEvent(new Event("storage"));
      }
    } catch (err) {
      console.warn("[WaiterTerminal] Error updating served status in Supabase:", err);
    }
  };

  // Quick Direct Serve (1-click Pickup and Delivery with Deferred Stock Deduction)
  const handleQuickServe = async (ticketId: string) => {
    const targetTicket = tickets.find((t) => t.id === ticketId);

    const nowIso = new Date().toISOString();
    const serverName = user?.name || "Floor Waiter";

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              picked_up_at: t.picked_up_at || nowIso,
              status: "completed",
              isDeducted: true,
              completed_at: nowIso,
              completedAt: nowIso,
            }
          : t
      )
    );

    setFloatingAlerts((prev) => prev.filter((a) => a.ticketId !== ticketId));
    playPosSound("tender");
    showToast(`🍽️ Order #${ticketId} Served directly to customer!`);

    broadcastWaiterOrderPickedUp({
      orgId: currentOrgId,
      ticketId,
      pickedUpAt: nowIso,
      waiterName: serverName,
    });
    broadcastWaiterOrderServed({
      orgId: currentOrgId,
      ticketId,
      servedAt: nowIso,
      waiterName: serverName,
    });

    // Inventory stock was already exact-once deducted upon order placement / KOT dispatch.
    // Handover / serving to table must never trigger duplicate inventory deduction.

    try {
      const { restId } = await getValidTenantContext(user);
      const supabase = createClient();
      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        {
          picked_up_at: nowIso,
          status: "completed",
          completed_at: nowIso,
        },
        tickets.find((t) => t.id === ticketId),
        restId || currentOrgId
      );

      let orderQuery: any = supabase
        .from("orders")
        .update({ order_status: "active", updated_at: nowIso });
      if (restId) orderQuery = orderQuery.eq("restaurant_id", restId);
      orderQuery = applyOrderFilter(orderQuery, ticketId);
      await orderQuery;

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("orders_updated", { detail: { restaurantId: restId, orderId: ticketId, timestamp: Date.now() } }));
        localStorage.setItem(`pos_orders_${currentOrgId}`, String(Date.now()));
        window.dispatchEvent(new Event("storage"));
      }
    } catch (err) {
      console.warn("[WaiterTerminal] Error updating quick serve in Supabase:", err);
    }
  };

  // Direct Table-Side KOT Dispatch to Kitchen
  const handleSendToKitchen = async () => {
    if (isSendingKot || cart.length === 0) return;
    setIsSendingKot(true);

    try {
      const { restId: rawTenantId, branchId: rawBranchId } = await getValidTenantContext(user);
      const parsedRestId = Number(rawTenantId && !isNaN(Number(rawTenantId)) && Number(rawTenantId) > 0 ? rawTenantId : (user?.restaurantId || user?.organizationId || 40));
      const restId = (parsedRestId === 27 || !parsedRestId || isNaN(parsedRestId)) ? 40 : parsedRestId;
      const branchId = rawBranchId || user?.branchId || null;
      const supabase = createClient();

      const matchedTable = tables.find((t) => t.id === selectedTable);
      const tableIdentifier =
        orderChannel === "dine_in"
          ? matchedTable?.label || `Table ${selectedTable}`
          : "Takeaway Counter";

      // 0. Strict Table Occupied Lock: Block duplicate order creation on occupied tables
      if (orderChannel === "dine_in") {
        const hasActiveTicket = tickets.some((tk) => {
          if (
            tk.status === "completed" ||
            tk.status === "cancelled" ||
            tk.status === "voided" ||
            tk.status === "archived" ||
            isTicketExpired(tk)
          ) {
            return false;
          }
          return isTableMatchingIdentifier(matchedTable || { id: selectedTable }, tk.tableOrChannel);
        });

        const isTableOccupied = Boolean(
          hasActiveTicket ||
          (matchedTable &&
          (matchedTable.status === "seated" ||
            matchedTable.status === "occupied" ||
            matchedTable.status === "billing"))
        );
        if (isTableOccupied) {
          showToast(`❌ Cannot place order: ${tableIdentifier} is currently OCCUPIED with an active order.`);
          setIsSendingKot(false);
          return;
        }
      }

      const newKotId = `KOT-${Math.floor(1000 + Math.random() * 9000)}`;
      const resolvedOrderId = `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

      const dishPrepTimes = cart.map(
        (c) =>
          c.item.preparation_time ||
          parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
          15
      );
      const orderEstimatedPrepTime = Math.max(...dishPrepTimes, 15);

      // Map full order items containing price, quantity, and variant metadata for POS Hub & recipes
      const orderItems = cart.map((c) => {
        const variantObj = c.selectedVariant || c.item.selectedVariant;
        const combinedNotes = [c.notes, tableNotes].filter(Boolean).join(" • ");
        const itemPrice = Number(variantObj?.price ?? c.item.price ?? 0);
        const itemQty = Number(c.quantity || 1);
        return {
          id: c.item.id,
          name: c.item.name,
          category: c.item.category || "General",
          price: itemPrice,
          quantity: itemQty,
          qty: itemQty,
          notes: combinedNotes || "",
          modifiers: variantObj ? [variantObj.name] : [],
          prepTime: c.item.prepTime || "15m",
          preparation_time: c.item.preparation_time || 15,
          selectedVariant: variantObj,
          variant: variantObj,
          variant_id: variantObj?.id || null,
          variant_name: variantObj?.name || null,
        };
      });

      const kitchenTicket: KitchenTicket = {
        id: newKotId,
        tableOrChannel: tableIdentifier,
        orderType: orderChannel,
        serverName: user?.name || "Floor Server",
        elapsedMinutes: 0,
        status: "queued",
        estimatedPrepTime: orderEstimatedPrepTime,
        estimated_prep_time: orderEstimatedPrepTime,
        items: orderItems,
        items_status: cart.map((c, idx) => {
          const variantObj = c.selectedVariant || c.item.selectedVariant;
          const notes = [c.notes, tableNotes, variantObj ? `Variant: ${variantObj.name}` : ""]
            .filter(Boolean)
            .join(" • ");
          return {
            item_id: c.item.id || `${newKotId}-item-${idx}`,
            name: c.item.name,
            quantity: c.quantity,
            status: "waiting" as const,
            started_at: null,
            completed_at: null,
            prep_time_minutes: c.item.preparation_time || 15,
            notes: notes || undefined,
          };
        }),
        priority: "normal",
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        created_at: new Date().toISOString(),
        isDeducted: true,
      };

      // Automatic Item-Level Station Splitting
      const splitResult = splitOrderIntoStationTickets({
        orderId: resolvedOrderId,
        baseKotId: newKotId,
        cart,
        orderChannel,
        tableIdentifier,
        serverName: user?.name || "Floor Server",
        priority: "normal",
        tableNotes,
        restaurantId: restId,
        branchId: branchId || user?.branchId || null,
      });

      // 1. Insert all split station tickets into kitchen_tickets Supabase table
      for (const ticketPayload of splitResult.payloads) {
        try {
          await supabase.from("kitchen_tickets").insert([ticketPayload]);
        } catch (kotInsErr) {
          console.warn("[WaiterTerminal] kitchen_tickets insert warning:", kotInsErr);
        }
      }

      // 2. Immediate exact-once inventory stock deduction upon Waiter KOT dispatch
      try {
        await deductInventoryStockForOrder(restId, orderItems, {
          orderId: resolvedOrderId,
          kotId: newKotId,
          source: "waiter_kot_dispatch",
        });
        notifyInventoryStockDeducted(currentOrgId);
      } catch (deductErr) {
        console.warn("[WaiterTerminal] KOT inventory stock deduction error:", deductErr);
      }

      // 3. Persist order row in central orders table (guarantee table_id & items are linked for POS Orders Hub)
      const isValidUuid = (val?: any): boolean =>
        Boolean(val && typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      let targetTableUuid: string | null = null;
      if (isValidUuid(matchedTable?.dbId)) {
        targetTableUuid = String(matchedTable!.dbId);
      } else if (orderChannel === "dine_in" && tableIdentifier) {
        try {
          const { data: dbTable } = await supabase
            .from("restaurant_tables")
            .select("id")
            .eq("restaurant_id", restId)
            .or(`table_number.eq.${tableIdentifier},table_number.eq.${tableIdentifier.replace(/\D/g, '')},table_number.eq.Table ${tableIdentifier.replace(/\D/g, '')}`)
            .limit(1)
            .maybeSingle();
          if (dbTable?.id && isValidUuid(dbTable.id)) {
            targetTableUuid = dbTable.id;
          }
        } catch { }
      }

      let createdDbOrderId = resolvedOrderId;
      try {
        const orderPayload: any = {
          restaurant_id: restId,
          order_number: resolvedOrderId,
          order_channel: orderChannel,
          customer_name: tableIdentifier || "Table",
          customer_phone: null,
          subtotal: Number(cartSubtotal) || 0,
          tax_amount: Number(salesTaxAmount) || 0,
          discount_amount: 0,
          total_amount: Number(cartTotal) || 0,
          payment_method: "cash",
          payment_status: "pending",
          order_status: "active",
          is_deducted: true,
          items: Array.isArray(orderItems)
            ? orderItems.map((it: any) => ({ ...it, is_deducted: true }))
            : [],
          cashier_name: user?.name || "Floor Server",
          created_at: new Date().toISOString(),
        };

        if (branchId && typeof branchId === "string" && branchId !== "all" && branchId !== "branch_0") {
          orderPayload.branch_id = branchId;
        } else {
          orderPayload.branch_id = null;
        }

        if (orderChannel === "dine_in" && targetTableUuid) {
          orderPayload.table_id = targetTableUuid;
        }

        if (orderEstimatedPrepTime) {
          orderPayload.estimated_prep_time = Number(orderEstimatedPrepTime) || 15;
        }

        let { data: orderData, error: orderErr } = await supabase
          .from("orders")
          .insert([orderPayload])
          .select("id")
          .maybeSingle();

        if (orderErr) {
          const errDetail = orderErr.message || orderErr.details || orderErr.hint || orderErr.code || (typeof orderErr === 'object' ? JSON.stringify(orderErr, Object.getOwnPropertyNames(orderErr)) : String(orderErr));
          console.warn("[WaiterTerminal] orders insert initial attempt failed, retrying with sanitized schema:", errDetail);

          delete orderPayload.table_id;
          delete orderPayload.estimated_prep_time;
          delete orderPayload.is_deducted;
          orderPayload.branch_id = null;

          const retryRes: any = await supabase
            .from("orders")
            .insert([orderPayload]);

          if (!retryRes?.error) {
            orderErr = null;
          } else {
            const rawErr = retryRes.error;
            const retryErrDetail = rawErr?.message || rawErr?.details || rawErr?.hint || rawErr?.code || (typeof rawErr === 'object' ? JSON.stringify(rawErr, Object.getOwnPropertyNames(rawErr)) : String(rawErr));
            console.error("[WaiterTerminal] Critical error inserting master order:", retryErrDetail);
          }
        }

        if (orderData?.id) {
          createdDbOrderId = orderData.id;
        } else {
          try {
            const { data: createdRow } = await supabase
              .from("orders")
              .select("id")
              .eq("restaurant_id", restId)
              .eq("order_number", resolvedOrderId)
              .maybeSingle();
            if (createdRow?.id) {
              createdDbOrderId = createdRow.id;
            }
          } catch { }
        }
      } catch (ordErr) {
        console.warn("[WaiterTerminal] Exception persisting order:", ordErr);
      }

      // Live Global Stock Invalidation & Realtime Broadcast across all open terminals via restaurant_${restId}_feed
      broadcastStockRefresh(restId, {
        orderId: resolvedOrderId,
        kotId: newKotId,
        source: "waiter_terminal",
      });

      // 4. Mark table occupied globally across Waiter, POS, and Admin floor matrices
      if (orderChannel === "dine_in") {
        const updatedTables: TableStatus[] = tables.map((t) =>
          t.id === selectedTable || (matchedTable && t.id === matchedTable.id)
            ? {
                ...t,
                status: "seated",
                activeOrderId: resolvedOrderId,
                activeAmount: cartTotal,
              }
            : t
        );
        setTables(updatedTables);
        saveStoredTables(currentOrgId, updatedTables);
        saveStoredTables(String(restId), updatedTables);

        (async () => {
          try {
            const tableUpdatePayload: Record<string, any> = {
              status: "occupied",
            };
            if (isValidUuid(createdDbOrderId)) {
              tableUpdatePayload.active_order_id = createdDbOrderId;
            }
            if (targetTableUuid) {
              await supabase
                .from("restaurant_tables")
                .update(tableUpdatePayload)
                .eq("restaurant_id", restId)
                .eq("id", targetTableUuid);
            } else if (matchedTable?.label || tableIdentifier) {
              const cleanDigits = tableIdentifier.replace(/\D/g, "");
              const orClauses = [
                `table_number.eq.${tableIdentifier}`,
                matchedTable?.label ? `table_number.eq.${matchedTable.label}` : null,
                cleanDigits ? `table_number.eq.Table ${cleanDigits}` : null,
                cleanDigits ? `table_number.eq.${cleanDigits}` : null,
              ].filter(Boolean).join(",");
              await supabase
                .from("restaurant_tables")
                .update(tableUpdatePayload)
                .eq("restaurant_id", restId)
                .or(orClauses);
            }

            // Global cross-terminal synchronization broadcast
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("pos_tables_updated"));
              window.dispatchEvent(new CustomEvent("restaurant_tables_changed"));
              window.dispatchEvent(new CustomEvent("orders_updated"));
              if ("BroadcastChannel" in window) {
                try {
                  const bc = new BroadcastChannel("pos_ledger_sync_channel");
                  bc.postMessage({
                    type: "TABLES_UPDATED",
                    restId,
                    tableIdentifier,
                    status: "occupied",
                    timestamp: Date.now(),
                  });
                  bc.postMessage({
                    type: "ORDERS_UPDATED",
                    restId,
                    orderId: resolvedOrderId,
                    timestamp: Date.now(),
                  });
                  bc.close();
                } catch { }
              }
            }
          } catch (tErr) {
            console.warn("[WaiterTerminal] Table occupied sync error:", tErr);
          }
        })();
      }

      // 5. Instantly register in shared POS Running KOT Orders so POS Order Hub shows it immediately for payment
      const activeRunningOrder: OrderRecord = {
        id: resolvedOrderId,
        kotId: newKotId,
        orderChannel,
        tableId: matchedTable?.id ?? selectedTable,
        tableName: tableIdentifier,
        customerName: tableIdentifier,
        items: orderItems,
        subtotal: Number(cartSubtotal) || 0,
        taxAmount: Number(salesTaxAmount) || 0,
        discountPercent: 0,
        discountAmount: 0,
        total: Number(cartTotal) || 0,
        paymentMethod: "cash",
        cashierName: user?.name || "Floor Server",
        timestamp: new Date().toISOString(),
        status: "active",
        payment_status: "pending",
        isDeducted: true,
      };

      try {
        const rawRunning = localStorage.getItem(`pos_running_kot_orders_${currentOrgId}`);
        const currentRunning: OrderRecord[] = rawRunning ? JSON.parse(rawRunning) : [];
        const updatedRunning = [
          ...currentRunning.filter((o: any) => o.id !== resolvedOrderId && o.kotId !== newKotId),
          activeRunningOrder,
        ];
        localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(updatedRunning));
        localStorage.setItem(`pos_running_kot_orders_${restId}`, JSON.stringify(updatedRunning));
        localStorage.setItem(`pos_running_kot_orders_trigger_${currentOrgId}`, String(Date.now()));
        localStorage.setItem(`pos_running_kot_orders_trigger_${restId}`, String(Date.now()));
      } catch (err) {
        console.warn("[WaiterTerminal] Error caching running order for POS:", err);
      }

      // 6. Update local stored tickets and broadcast immediate cross-screen sync
      const currentStored = getStoredKdsTickets(currentOrgId, []);
      saveStoredKdsTickets(currentOrgId, [...splitResult.tickets, ...currentStored]);
      setTickets((prev) => [...splitResult.tickets, ...prev.filter((t) => !splitResult.tickets.some((st) => st.id === t.id))]);

      // Broadcast order updates to POS Orders Hub and all screens
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new CustomEvent("restaurant_tables_changed"));
          window.dispatchEvent(new CustomEvent("pos_tables_updated"));
          window.dispatchEvent(new CustomEvent("tables_list_changed"));
          window.dispatchEvent(new CustomEvent("orders_updated", {
            detail: { restaurantId: restId, orderId: resolvedOrderId, kotId: newKotId, timestamp: Date.now() },
          }));
          window.dispatchEvent(new CustomEvent("pos_orders_updated", {
            detail: { restaurantId: restId, orderId: resolvedOrderId, kotId: newKotId, timestamp: Date.now() },
          }));
          localStorage.setItem(`pos_orders_${currentOrgId}`, String(Date.now()));
          localStorage.setItem(`pos_orders_${restId}`, String(Date.now()));
          localStorage.setItem(`omni_tables_trigger_${currentOrgId}`, String(Date.now()));
          localStorage.setItem(`omni_tables_trigger_${restId}`, String(Date.now()));
          window.dispatchEvent(new Event("storage"));
        } catch { }
      }

      // Broadcast live stock invalidation across all terminals & refresh local catalog
      if (restId) {
        broadcastStockRefresh(restId, { source: "waiter_kot_sent", orderId: resolvedOrderId });
        fetchLiveMenuCatalog();
      }

      // Play success audio & clear ticket
      playPosSound("chime");
      if (splitResult.stationCount > 1) {
        const stationNames = splitResult.distinctStations
          .map((s) => s.toUpperCase().replace(/_/g, " "))
          .join(", ");
        showToast(`🚀 Dispatched to ${splitResult.stationCount} Stations (${stationNames}) for ${tableIdentifier}!`);
      } else {
        const singleStation = (splitResult.distinctStations[0] || "kitchen").toUpperCase().replace(/_/g, " ");
        showToast(`🚀 Dispatched ${newKotId} to ${singleStation} Station for ${tableIdentifier}!`);
      }
      setCart([]);
      setTableNotes("");
      setInventoryTick((c) => c + 1);

      // Auto-advance selectedTable to next available table so waiter can immediately take a new order
      const nextAvailable = tables.find(
        (t) => t.id !== selectedTable && (t.status === "available" || (!t.status && t.status !== "reserved"))
      );
      if (nextAvailable) {
        setSelectedTable(nextAvailable.id);
      }
    } catch (err: any) {
      console.error("[WaiterTerminal] Error sending KOT to kitchen:", err);
      showToast("Error sending order to kitchen. Please retry.");
    } finally {
      setIsSendingKot(false);
    }
  };

  // Counts for sidebar badges
  const readyTicketsCount = useMemo(() => {
    return tickets.filter(
      (t) =>
        (t.status === "ready" || t.ready_for_pickup_at != null) &&
        t.picked_up_at == null &&
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        t.status !== "voided" &&
        t.status !== "archived" &&
        !isTicketExpired(t)
    ).length;
  }, [tickets]);

  const activeTicketsCount = useMemo(() => {
    return tickets.filter(
      (t) =>
        t.status !== "completed" &&
        !t.picked_up_at &&
        t.status !== "cancelled" &&
        t.status !== "voided" &&
        t.status !== "archived" &&
        !isTicketExpired(t)
    ).length;
  }, [tickets]);

  const overdueCount = useMemo(() => {
    return tickets.filter((t) => {
      if (!t.ready_for_pickup_at || t.picked_up_at || t.status === "completed") return false;
      const waitSec = Math.floor(
        (nowMs - new Date(t.ready_for_pickup_at).getTime()) / 1000
      );
      return waitSec >= 300; // 5+ min
    }).length;
  }, [tickets, nowMs]);

  return (
    <div className="h-full w-full flex bg-[var(--bg)] text-[var(--text-hi)] overflow-hidden select-none transition-colors duration-300">
      {/* Floating Ready Alerts Toasts */}
      <WaiterReadyAlertToast
        alerts={floatingAlerts}
        onPickUp={handleMarkPickedUp}
        onDismiss={(ticketId) =>
          setFloatingAlerts((prev) => prev.filter((a) => a.ticketId !== ticketId))
        }
      />

      {/* 1. POS-Style Sidebar */}
      <WaiterSidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        readyTicketsCount={readyTicketsCount}
        activeTicketsCount={activeTicketsCount}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          if (next) playWaiterBuzzer();
        }}
        onTestSound={() => {
          playWaiterBuzzer();
          showToast("🔔 Test service buzzer played successfully!");
        }}
      />

      {/* 2. Main Terminal Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[var(--bg)]">
        {/* Shift Warning / Lockout Notification Banner */}
        {shiftValidation && (shiftValidation.isWarningWindow || isShiftLocked) && (
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs font-mono shrink-0 transition-all ${
            isShiftLocked
              ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
              : "bg-amber-500/15 border-amber-500/30 text-amber-300"
          }`}>
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${isShiftLocked ? "text-rose-400" : "text-amber-400"} shrink-0`} />
              <span>
                {isShiftLocked
                  ? `🛑 Shift Window Concluded: ${shiftValidation.shiftShortName} ended at ${shiftValidation.shiftEndLabel}. Rollover required to continue floor duties.`
                  : `⏳ Shift Window Expiring: ${shiftValidation.shiftShortName} closes in ${shiftValidation.minutesRemaining} min (${shiftValidation.shiftEndLabel}).`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsRolloverModalOpen(true)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase font-mono cursor-pointer transition-all ${
                isShiftLocked
                  ? "bg-rose-500 hover:bg-rose-400 text-white shadow-sm"
                  : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm"
              }`}
            >
              {isShiftLocked ? "Execute Rollover" : "Rollover Shift"}
            </button>
          </div>
        )}

        {/* Overdue Warning Sticky Banner (if any orders >= 5 minutes) */}
        {overdueCount > 0 && (
          <div className="bg-red-500/15 border-b border-red-500/30 px-4 py-2 text-xs font-bold text-red-300 flex items-center justify-between gap-2 shrink-0 animate-pulse">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                ⚠️ {overdueCount} order{overdueCount > 1 ? "s" : ""} waiting 5+ minutes for waiter pickup at the kitchen pass!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentView("ready_pass")}
              className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white font-mono text-[10px] font-bold uppercase tracking-wider cursor-pointer shadow-xs"
            >
              View Pass
            </button>
          </div>
        )}

        {/* Global Toast Alert Banner */}
        {toastMessage && (
          <div className="bg-[var(--gold-dim)] border-b border-[var(--gold)]/30 px-4 py-2.5 text-xs font-bold text-[var(--gold)] flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-[var(--gold)] hover:text-white text-xs cursor-pointer px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic Views: Ordering / Ready Pass / Floor Queue */}
        {currentView === "ordering" && (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-[var(--bg)]">
            {/* Center Area: Menu & Modifiers Catalog */}
            <div className="w-full flex-1 px-4 sm:px-6 md:px-8 py-4 sm:py-6 pb-28 lg:pb-6 overflow-y-auto space-y-4 sm:space-y-6 min-w-0 scrollbar-thin">
              {/* Header Title Banner matching POS Theme */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 pb-1">
                <h1 className="font-display font-black text-xl sm:text-2xl md:text-3xl text-[var(--text-hi)] tracking-tight">
                  Table-Side &amp;{" "}
                  <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                    Ordering Counter
                  </span>
                </h1>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Shift Status Indicator */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Shift: {user?.assignedShift || "Active Shift"}</span>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono shadow-xs">
                    <span className="text-[var(--gold)] font-bold">Tables Seated:</span>
                    <span className="text-[var(--text-hi)] font-bold font-mono">
                      {tables.filter((t) => t.status === "seated").length} / {tables.length}
                    </span>
                  </div>

                  {readyTicketsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentView("ready_pass")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold animate-pulse cursor-pointer shadow-xs"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{readyTicketsCount} Ready at Pass</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Category Dropdown & Search Filter */}
              <MenuCategoriesAndSearch
                categories={waiterCategories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                totalFilteredCount={filteredMenuItems.length}
              />

              {/* Dishes Catalog Grid with Modifiers */}
              <ItemGridAndModifiers
                filteredMenuItems={filteredMenuItems}
                onAddToCart={handleAddToCart}
                showToast={showToast}
                getVariantPortions={getVariantPortions}
                inventoryTick={inventoryTick}
              />
            </div>

            {/* Right Area: Dedicated Table Order Ticket Pane */}
            <div className="w-full lg:w-[400px] xl:w-[420px] shrink-0 h-72 lg:h-full border-t lg:border-t-0 border-[var(--border)] overflow-hidden shadow-lg z-10">
              <WaiterOrderTicketPane
                cart={cart}
                onUpdateQty={handleUpdateCartQty}
                onClearCart={handleClearCart}
                orderChannel={orderChannel}
                selectedTable={selectedTable}
                onSelectTable={setSelectedTable}
                tables={tables}
                onOpenFloorMatrix={() => setIsFloorModalOpen(true)}
                tableNotes={tableNotes}
                setTableNotes={setTableNotes}
                cartSubtotal={cartSubtotal}
                salesTaxAmount={salesTaxAmount}
                taxRatePercent={taxRatePercent}
                cartTotal={cartTotal}
                onSendToKitchen={handleSendToKitchen}
                isSendingKot={isSendingKot}
              />
            </div>
          </div>
        )}

        {currentView === "ready_pass" && (
          <WaiterReadyPassView
            tickets={tickets}
            nowMs={nowMs}
            onMarkPickedUp={handleMarkPickedUp}
            onMarkServed={handleMarkServed}
            onQuickServe={handleQuickServe}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onTestBuzzer={() => {
              playWaiterBuzzer();
              showToast("🔔 Waiter service buzzer rang!");
            }}
          />
        )}

        {currentView === "floor_queue" && (
          <WaiterFloorQueueView
            tickets={tickets}
            nowMs={nowMs}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}
      </div>

      {/* Floor Plan Matrix Modal */}
      <FloorMatrixModal
        isOpen={isFloorModalOpen}
        onClose={() => setIsFloorModalOpen(false)}
        tables={tables}
        orders={activeUnpaidRecords.map((rec) => {
          const matchedT = tables.find(
            (t) =>
              (rec.tableId && (t.dbId === rec.tableId || String(t.id) === String(rec.tableId))) ||
              isTableMatchingIdentifier(t, rec.tableIdentifier) ||
              (rec.tableNumberNorm && normalizeTableNumber(t.label || t.id) === rec.tableNumberNorm)
          );
          return {
            id: String(rec.orderId || rec.kotId),
            tableId: matchedT?.id || (typeof rec.tableId === "number" ? rec.tableId : 0),
            tableName: rec.tableIdentifier || matchedT?.label || "",
            total: rec.totalAmount || 0,
            status: "pending" as any,
            channel: "dine_in" as any,
            payment_status: rec.paymentStatus || "pending",
            paymentStatus: rec.paymentStatus || "pending",
            items: rec.items || [],
            kotPrinted: true,
            kitchenStatus: rec.status as any,
            createdAt: rec.createdAt,
            created_at: rec.createdAt,
          };
        })}
        selectedTable={selectedTable}
        onSelectTable={(tableId) => {
          setSelectedTable(tableId);
          setIsFloorModalOpen(false);
          const tObj = tables.find((t) => t.id === tableId);
          showToast(`Selected ${tObj?.label || `Table ${tableId}`} (Available)`);
        }}
      />

      {/* Strict Shift Rollover & Operational Handover Modal */}
      <StaffShiftRolloverModal
        isOpen={Boolean(isRolloverModalOpen && isShiftLocked && Date.now() >= shiftSnoozedUntil)}
        user={user}
        shiftValidation={shiftValidation}
        stationLabel="Floor Waiter Station"
        onRolloverSuccess={handleRolloverSuccess}
        onLogout={handleHandoverLogout}
        onRemindLater={handleRemindLater}
      />
    </div>
  );
}
