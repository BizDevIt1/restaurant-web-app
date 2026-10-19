"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Lock,
  Receipt,
  LayoutGrid,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  ChevronRight,
  Check,
  ShoppingBag,
  CheckCircle2,
} from "lucide-react";
import {
  MenuItem,
  CartItem,
  TableStatus,
  OrderRecord,
  KitchenTicket,
  StaffMember,
  ItemVariant,
} from "@/app/admin/types";
import { useAuth } from "@/app/admin/context/AuthContext";
import { mapRowToTableStatus } from "@/app/admin/context/AdminCacheContext";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import {
  saveStoredOrder,
  saveStoredOrders,
  getStoredOrders,
  saveStoredTables,
  getStoredTables,
  saveStoredKdsTickets,
  getStoredKdsTickets,
  saveStoredMenu,
  getStoredMenu,
  getStoredBranchSettings,
  saveStoredBranchSettings,
  clearUserSession,
  getStoredRawRecipes,
  saveStoredRawRecipes,
  getStoredBaseMaterials,
  saveStoredBaseMaterials,
} from "@/lib/tenantStore";
import { useTerminalSidebar } from "../TerminalSidebarContext";
import { playPosSound } from "@/utils/posAudio";
import {
  subscribeToRemoteKitchenBuzzer,
  subscribeToKitchenWaiterBridge,
  subscribeToTakeawayReadyAlerts,
  TakeawayReadyPayload,
  playRemoteAudioChime,
  getKitchenBroadcastTopic,
} from "@/lib/kitchenWaiterBridge";
import {
  broadcastTerminalMutation,
  subscribeTerminalEventBus,
} from "@/lib/terminalRealtimeSync";
import MenuCategoriesAndSearch from "./components/MenuCategoriesAndSearch";
import ItemGridAndModifiers from "./components/ItemGridAndModifiers";
import OrderTicketPane from "./components/OrderTicketPane";
import PaymentModal from "./components/PaymentModal";
import ThermalReceiptDialog from "./components/ThermalReceiptDialog";
import { ParkedOrder } from "./components/HoldOrdersDrawer";
import FloorMatrixModal from "./components/FloorMatrixModal";
import PosSidebar from "./components/PosSidebar";
import UnifiedOrdersView, {
  UnifiedOrder,
  UnifiedOrderTab,
} from "./components/UnifiedOrdersView";
import KitchenThermalSlipDialog from "./components/KitchenThermalSlipDialog";
import { getTicketStation } from "../kitchen/KitchenTerminalClient";
import { splitOrderIntoStationTickets, getMenuItemStation } from "@/lib/kitchenStationRouting";
import StartShiftModal from "./components/StartShiftModal";
import ConfirmModal from "./components/ConfirmModal";
import ShiftExpiryWarningModal from "./components/ShiftExpiryWarningModal";
import ShiftContinuationModal from "./components/ShiftContinuationModal";
import ShiftSettlementModal from "@/app/admin/components/views/ShiftSettlementModal";
import {
  validateCashierShiftWindow,
  ShiftWindowValidation,
  getNextShiftOption,
  isShiftFromPreviousDate,
  isShiftForCurrentDayAndValid,
  clearStaleShiftStorage,
  isShiftWindowConcluded,
  hasActiveConsecutiveShift,
  getCurrentOperatingShift,
  getRestaurantShiftConfig,
  saveRestaurantShiftConfig,
  parseRestaurantShiftConfig,
  parseShiftOption,
  ShiftTypeOption,
} from "@/lib/shiftSchedule";
import {
  recordMultiShiftRolloverEvent,
  dispatchShiftOpenedAlert,
  dispatchOrderCancelledAlert,
  dispatchSystemSyncAlert,
  dispatchShiftSettlementAlert,
} from "@/lib/shiftAuditNotifications";
import { deductInventoryStockForOrder, isOrderAlreadyDeducted } from "@/lib/inventoryDeduction";
import { recordStaffShiftLogout } from "@/lib/universalShiftLogging";
import {
  saveSharedPosCart,
  clearSharedPosCart,
  getSharedPosCart,
  notifyInventoryStockDeducted,
  subscribeToSharedPosCart,
} from "@/lib/posLedgerSync";
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
import {
  fetchActiveUnpaidTableRecords,
  reconcileTableStatuses,
  autoHealDatabaseTableOccupancy,
  isTableMatchingIdentifier,
  normalizeTableNumber,
  isOrderOccupyingTable,
  broadcastTableReleased,
  subscribeToTableReleased,
  isUuid,
} from "@/lib/tableOccupancy";

const PARKED_ORDERS_KEY = "omni_terminal_parked_orders";

export interface PosTerminalClientProps {
  embedded?: boolean;
}

export default function PosTerminalClient({ embedded = false }: PosTerminalClientProps = {}) {
  const router = useRouter();
  const { user, hasFeature, refreshEntitlements, logout } = useAuth();
  const { setHideHeader } = useTerminalSidebar();
  const currentOrgId = user?.organizationId || user?.id || "default";

  // Shift settlement modal state for embedded admin mode
  const [isShiftSettlementOpen, setIsShiftSettlementOpen] = useState(false);

  // Guard: If a non-cashier arrives at the POS register, immediately redirect to their dedicated terminal
  useEffect(() => {
    if (embedded || !user) return;
    const staffRoleClean = (user.staffRole || "").toLowerCase().trim();
    const roleClean = (user.role || "").toLowerCase().trim();
    const terminalAccessClean = String(user.terminalAccess || "").toUpperCase().trim();

    const isWaiter =
      staffRoleClean === "waiter" ||
      staffRoleClean === "server" ||
      roleClean === "waiter" ||
      roleClean === "server" ||
      terminalAccessClean === "WAITER_ONLY" ||
      terminalAccessClean === "WAITER";

    if (isWaiter) {
      router.replace("/terminal/waiter");
      return;
    }

    const isChef =
      staffRoleClean === "chef" ||
      staffRoleClean === "kitchen" ||
      staffRoleClean === "cook" ||
      staffRoleClean === "kds" ||
      roleClean === "chef" ||
      roleClean === "kitchen" ||
      roleClean === "cook" ||
      roleClean === "kds" ||
      terminalAccessClean === "KDS_ONLY" ||
      terminalAccessClean === "KITCHEN_ONLY";

    if (isChef) {
      router.replace("/terminal/kitchen");
      return;
    }

    const isRider =
      staffRoleClean === "rider" ||
      roleClean === "rider" ||
      terminalAccessClean === "RIDER_ONLY";

    if (isRider) {
      router.replace("/terminal/rider");
      return;
    }
  }, [user, embedded, router]);

  // Strict Shift Window Lockout for Cashiers (disabled when embedded in Admin Dashboard or for waiters)
  const isCashier = Boolean(
    !embedded &&
    user &&
    (user.staffRole as string) !== "waiter" &&
    (user.role as string) !== "waiter" &&
    (user.staffRole as string) !== "server" &&
    (user.role as string) !== "server" &&
    (user.terminalAccess as string) !== "WAITER_ONLY" &&
    (user.staffRole === "cashier" ||
      (user.role as string) === "cashier" ||
      user.terminalAccess === "POS_ONLY")
  );

  // Shift Management State (Mandatory Shift Workflow)
  const [activeShift, setActiveShift] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const keys = [
          currentOrgId,
          user?.restaurantId ? String(user.restaurantId) : "",
          user?.organizationId ? String(user.organizationId) : "",
          "default",
        ].filter(Boolean);

        for (const k of keys) {
          const cached =
            sessionStorage.getItem(`pos_active_shift_${k}`) ||
            localStorage.getItem(`pos_active_shift_${k}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && isShiftForCurrentDayAndValid(parsed)) {
              return parsed;
            }
          }
        }
      } catch { }
    }
    return null;
  });

  const hasOpenActiveShift = Boolean(
    activeShift &&
    (activeShift.status === "OPEN" ||
      activeShift.status === "active" ||
      (!activeShift.status && !activeShift.closed_at))
  );

  const [consecutiveShiftCount, setConsecutiveShiftCount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const keys = [
        currentOrgId,
        user?.restaurantId ? String(user.restaurantId) : "",
        user?.organizationId ? String(user.organizationId) : "",
        "default",
      ].filter(Boolean);
      for (const k of keys) {
        const stored =
          sessionStorage.getItem(`pos_consecutive_shift_count_${k}`) ||
          localStorage.getItem(`pos_consecutive_shift_count_${k}`);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (parsed && parsed > 0) return parsed;
        }
      }
    }
    // Fallback: recover segment number from active shift if marked
    if (activeShift?.shift_type) {
      const match = activeShift.shift_type.match(/Segment\s*#?(\d+)/i);
      if (match) {
        const seg = parseInt(match[1], 10);
        if (seg && seg > 0) return seg;
      }
    }
    return 1;
  });

  const [shiftValidation, setShiftValidation] = useState<ShiftWindowValidation | null>(() => {
    if (embedded || !user || !isCashier) return null;
    const shiftToValidate = (hasOpenActiveShift && activeShift?.shift_type)
      ? activeShift.shift_type
      : user.assignedShift;
    if (!shiftToValidate) return null;
    const restId = user?.restaurantId || (user as any)?.restaurant_id || user?.id;
    const cfg = getRestaurantShiftConfig(restId, user);
    return validateCashierShiftWindow(shiftToValidate, new Date(), activeShift, cfg);
  });

  // Seamless Shift Continuation Engine (Strict Active Guard: suppresses false prompts for active consecutive shifts)
  const isShiftTimeEnded = Boolean(
    !embedded &&
    isCashier &&
    isShiftWindowConcluded(shiftValidation, activeShift, consecutiveShiftCount)
  );
  const [isShiftContinuationModalOpen, setIsShiftContinuationModalOpen] = useState(false);
  const [shiftPromptSnoozedUntil, setShiftPromptSnoozedUntil] = useState<number>(0);

  // Automatically trigger expiration alert when shift ends with persistent 5-minute reminder workflow
  useEffect(() => {
    if (!isShiftTimeEnded) {
      setIsShiftContinuationModalOpen(false);
      return;
    }

    const checkPrompt = () => {
      const now = Date.now();
      if (now >= shiftPromptSnoozedUntil) {
        setIsShiftContinuationModalOpen(true);
      }
    };

    checkPrompt();
    const timer = setInterval(checkPrompt, 5000);
    return () => clearInterval(timer);
  }, [isShiftTimeEnded, shiftPromptSnoozedUntil]);

  const handleDismissContinuationPrompt = useCallback(() => {
    setIsShiftContinuationModalOpen(false);
    // Snooze modal persistently until resolved
    setShiftPromptSnoozedUntil(Date.now() + 15 * 60 * 1000);
    showToast("Shift alert snoozed. Reminding again later.");
  }, []);

  // Seamless New Shift Rollover directly from POS terminal
  const handleSeamlessStartNewShift = async () => {
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      if (!restId) return;

      const currentShiftType = activeShift?.shift_type || shiftValidation?.assignedShift || "First Shift (Morning)";
      const nextShiftType = getNextShiftOption(currentShiftType);
      const newConsecutiveCount = consecutiveShiftCount + 1;
      const handoverCash = activeShift?.opening_float !== undefined ? Number(activeShift.opening_float) : 5000;
      const initialStart = activeShift?.shift_start || activeShift?.created_at || new Date().toISOString();

      // 1. Gracefully finalize previous shift segment in Supabase
      if (activeShift?.id) {
        await supabase
          .from("shift_settlements")
          .update({
            status: "CLOSED",
            shift_end: new Date().toISOString(),
            cash_handover_to_next_shift: handoverCash,
            closing_notes: `[Consecutive Shift Rollover] Shift segment #${consecutiveShiftCount} concluded. Rolled over seamlessly to ${nextShiftType}.`,
          })
          .eq("id", activeShift.id);
      }

      // 2. Insert new shift segment into shift_settlements
      const newShiftPayload: any = {
        restaurant_id: restId,
        branch_id: user?.branchId || branchId || null,
        cashier_name: user?.name || "Terminal Cashier",
        shift_start: new Date().toISOString(),
        shift_type: `${nextShiftType} (Segment #${newConsecutiveCount})`,
        opening_float: handoverCash,
        actual_cash_counted: handoverCash,
        status: "OPEN",
        closing_notes: `Consecutive Shift Segment #${newConsecutiveCount} initiated seamlessly from terminal. Prior shift started: ${initialStart}.`,
        created_at: new Date().toISOString(),
      };

      const { data: newShift, error: newShiftErr } = await supabase
        .from("shift_settlements")
        .insert([newShiftPayload])
        .select("*")
        .maybeSingle();

      if (newShiftErr) {
        console.warn("[PosTerminal] Could not save seamless shift segment:", newShiftErr.message);
      }

      const activeRecord = newShift || { ...newShiftPayload, id: Date.now() };

      // 3. Dispatch real-time Admin Notification & Audit Log
      recordMultiShiftRolloverEvent(currentOrgId, {
        staffName: user?.name || "Cashier",
        previousShiftType: String(currentShiftType),
        newShiftType: String(nextShiftType),
        consecutiveShiftNumber: newConsecutiveCount,
        initialShiftStart: initialStart,
        previousShiftSales: activeShift?.system_cash_sales ? Number(activeShift.system_cash_sales) : undefined,
        branchName: user?.branchName || "Main Branch",
      });

      // 4. Update POS Terminal state & session
      setActiveShift(activeRecord);
      setConsecutiveShiftCount(newConsecutiveCount);
      setIsShiftContinuationModalOpen(false);
      setIsStartShiftModalOpen(false);

      // Re-validate immediately for next shift segment so no stale validation remains
      const newValidation = validateCashierShiftWindow(nextShiftType, new Date(), activeRecord);
      setShiftValidation(newValidation);

      try {
        const orgKeys = [
          currentOrgId,
          String(restId),
          user?.restaurantId ? String(user.restaurantId) : "",
          user?.organizationId ? String(user.organizationId) : "",
          "default",
        ].filter(Boolean);
        orgKeys.forEach((k) => {
          sessionStorage.setItem(`pos_active_shift_${k}`, JSON.stringify(activeRecord));
          localStorage.setItem(`pos_active_shift_${k}`, JSON.stringify(activeRecord));
          sessionStorage.setItem(`pos_consecutive_shift_count_${k}`, String(newConsecutiveCount));
          localStorage.setItem(`pos_consecutive_shift_count_${k}`, String(newConsecutiveCount));
        });
      } catch { }

      showToast(`Seamless shift rollover complete! Started ${nextShiftType} (Segment #${newConsecutiveCount}).`);
    } catch (err) {
      console.error("[PosTerminal] Seamless shift rollover error:", err);
      showToast("Error initiating seamless shift. Please retry.");
    }
  };

  // Direct End Shift & Logout from shift continuation prompt (bypasses Z-Report)
  const handleEndShiftLogout = async () => {
    try {
      // 1. Close shift in database
      await recordStaffShiftLogout(user, {
        station: "pos",
        notes: "Shift ended and logged out from POS terminal shift-expired prompt",
      });
    } catch (err) {
      console.warn("[PosTerminal] Error recording shift logout:", err);
    }

    // 2. Close the continuation modal
    setIsShiftContinuationModalOpen(false);

    // 3. Clear local session data
    clearUserSession();

    // 4. Auth context logout
    logout();

    // 5. Redirect to login
    router.replace("/login");
  };

  // Pre-Shift Expiry 10-Minute Warning Engine (recurring modal every 3 mins)
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [lastWarningDismissedAt, setLastWarningDismissedAt] = useState<number>(0);

  useEffect(() => {
    if (!user || !isCashier) {
      setShiftValidation(null);
      return;
    }
    const verify = () => {
      const shiftToValidate = (hasOpenActiveShift && activeShift?.shift_type)
        ? activeShift.shift_type
        : user.assignedShift;
      if (!shiftToValidate) {
        setShiftValidation(null);
        return;
      }
      const restId = user?.restaurantId || (user as any)?.restaurant_id || user?.id;
      const cfg = getRestaurantShiftConfig(restId, user);
      const result = validateCashierShiftWindow(shiftToValidate, new Date(), activeShift, cfg);
      setShiftValidation(result);

      if (result.isValid && result.isWarningWindow && !hasActiveConsecutiveShift(activeShift, consecutiveShiftCount)) {
        const now = Date.now();
        if (now - lastWarningDismissedAt >= 3 * 60 * 1000) {
          setIsWarningModalOpen(true);
        }
      } else {
        setIsWarningModalOpen(false);
      }
    };
    verify();
    const timer = setInterval(verify, 5000);
    const handleShiftConfigUpdated = () => verify();
    window.addEventListener("restaurant_shift_config_updated", handleShiftConfigUpdated);
    return () => {
      clearInterval(timer);
      window.removeEventListener("restaurant_shift_config_updated", handleShiftConfigUpdated);
    };
  }, [user, isCashier, activeShift, hasOpenActiveShift, consecutiveShiftCount, lastWarningDismissedAt]);

  const handleDismissWarning = useCallback(() => {
    setIsWarningModalOpen(false);
    setLastWarningDismissedAt(Date.now());
  }, []);

  useEffect(() => {
    if (refreshEntitlements) {
      refreshEntitlements();
    }
  }, []);

  // 1. Module Entitlement Check
  const isPosActive = Boolean(
    hasFeature("POS") ||
    user?.assignedFeatures?.some((f) => {
      const u = String(f || "").toUpperCase().trim();
      return u === "POS" || u === "POS_TERMINAL";
    }) ||
    (user?.role as string) === "SUPER_ADMIN"
  );

  // 2. Menu Items & Stock State
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() =>
    getStoredMenu(currentOrgId, [])
  );
  const [rawRecipes, setRawRecipes] = useState<RecipeItemData[]>(() =>
    getStoredRawRecipes(currentOrgId)
  );
  const [baseMaterialsMap, setBaseMaterialsMap] = useState<Map<string, RawMaterialStockData>>(() => {
    const entries = getStoredBaseMaterials(currentOrgId);
    return new Map<string, RawMaterialStockData>(entries);
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dynamic categories calculated from live menu items
  const posCategories = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    let featuredCount = 0;
    menuItems.forEach((item) => {
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
  }, [menuItems]);

  // 3. Active Order Ticket / Cart State (persisted in shared storage & sessionStorage)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = getSharedPosCart(currentOrgId);
      if (stored && stored.length > 0) return stored;
      const raw = sessionStorage.getItem(`pos_active_cart_${currentOrgId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });

  // Cross-tab & multi-window cart synchronization listener
  useEffect(() => {
    const unsub = subscribeToSharedPosCart(
      currentOrgId,
      (syncedCart) => {
        setCart((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(syncedCart)) return prev;
          return syncedCart;
        });
      },
      () => {
        setInventoryTick((prev) => prev + 1);
      }
    );
    return unsub;
  }, [currentOrgId]);

  // 3b. Real-Time Shared Raw Material Ledger & React State Sync
  const [runningTableOrders, setRunningTableOrders] = useState<OrderRecord[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`pos_running_kot_orders_${currentOrgId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });
  const [activeDbOrders, setActiveDbOrders] = useState<any[]>([]);
  const [inventoryTick, setInventoryTick] = useState<number>(0);

  // 3c. Compute temporary stock reservations from active running table orders
  const reservedMaterialsMap = useMemo(() => {
    return computeReservedMaterialsFromActiveOrders(runningTableOrders, rawRecipes);
  }, [runningTableOrders, rawRecipes]);

  // Synchronous memo of simulated raw materials ledger (clean base ledger without local cart deduction)
  const effectiveLedger = useMemo(() => {
    return baseMaterialsMap;
  }, [baseMaterialsMap, inventoryTick]);

  // Live Simulated Menu Items directly bound to menuItems (single source of truth without local cart deduction)
  const liveSimulatedMenuItems = useMemo(() => {
    return menuItems;
  }, [menuItems, inventoryTick]);

  // Reactive State Hook: synchronously / reactively bind base materials and menu catalog
  const [, setReactiveInventoryLedger] = useState<Map<string, RawMaterialStockData>>(() => baseMaterialsMap);
  useEffect(() => {
    setReactiveInventoryLedger(new Map(baseMaterialsMap));
  }, [baseMaterialsMap, inventoryTick]);

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

      const effectiveActiveOrders = activeDbOrders.length > 0 ? activeDbOrders : runningTableOrders;
      const res = calculateUnifiedAvailableStock({
        item,
        variant,
        rawMaterialsLookup: baseMaterialsMap,
        dishRecipes,
        activeOrders: effectiveActiveOrders,
      });

      return {
        maxPortions: res.availableStock,
        availablePortions: res.availableStock,
        isOutOfStock: res.isOutOfStock,
        stockStatus: res.stockStatus,
        limitingIngredient: res.limitingIngredient?.name || res.limitingIngredient,
      };
    },
    [rawRecipes, baseMaterialsMap, activeDbOrders, runningTableOrders]
  );
  const [orderChannel, setOrderChannel] = useState<"dine_in" | "takeaway" | "delivery">(() => {
    if (typeof window === "undefined") return "dine_in";
    try {
      const saved = sessionStorage.getItem(`pos_order_channel_${currentOrgId}`);
      if (saved === "takeaway" || saved === "delivery" || saved === "dine_in") return saved;
    } catch { }
    return "dine_in";
  });
  const [selectedTable, setSelectedTable] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = sessionStorage.getItem(`pos_selected_table_${currentOrgId}`);
      if (saved && !isNaN(Number(saved))) return Number(saved);
    } catch { }
    return 1;
  });
  const [customerName, setCustomerName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem(`pos_customer_name_${currentOrgId}`) || "";
    } catch { }
    return "";
  });
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem(`pos_customer_phone_${currentOrgId}`) || "";
    } catch { }
    return "";
  });
  const [deliveryZone, setDeliveryZone] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return sessionStorage.getItem(`pos_delivery_zone_${currentOrgId}`) || "";
    } catch { }
    return "";
  });

  // Keep shared storage & sessionStorage in sync with active ticket
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      saveSharedPosCart(currentOrgId, cart);
      sessionStorage.setItem(`pos_active_cart_${currentOrgId}`, JSON.stringify(cart));
      sessionStorage.setItem(`pos_order_channel_${currentOrgId}`, orderChannel);
      sessionStorage.setItem(`pos_selected_table_${currentOrgId}`, String(selectedTable));
      sessionStorage.setItem(`pos_customer_name_${currentOrgId}`, customerName);
      sessionStorage.setItem(`pos_customer_phone_${currentOrgId}`, customerPhone);
      sessionStorage.setItem(`pos_delivery_zone_${currentOrgId}`, deliveryZone);
    } catch { }
  }, [cart, orderChannel, selectedTable, customerName, customerPhone, deliveryZone, currentOrgId]);

  // 4. Financials & Discounts (Dynamic Sales Tax configured per restaurant tenant)
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
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [flatDiscount, setFlatDiscount] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<"percent" | "flat">("percent");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "raast" | "split">("cash");

  // 5. Tables & Realtime Floor State
  const [tables, setTables] = useState<TableStatus[]>(() =>
    getStoredTables(currentOrgId, [])
  );
  const tablesRef = useRef<TableStatus[]>(tables);
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  // 6. Orders History State (Hydrated from local cache + Supabase on mount)
  const [orders, setOrders] = useState<OrderRecord[]>(() =>
    getStoredOrders(currentOrgId)
  );
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);

  // 7. Parked / Held Orders State
  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });

  // Clear stale order state on tenant change
  useEffect(() => {
    setOrders([]);
    setRunningTableOrders([]);
    setParkedOrders([]);
  }, [currentOrgId]);

  // 8. Shift Management State (Modal & Handover States)
  // Admin POS Bypass: When accessed from admin dashboard, completely bypass opening float requirements
  const [hasConfirmedOpeningFloat, setHasConfirmedOpeningFloat] = useState<boolean>(() => {
    if (embedded) return true;
    if (typeof window === "undefined") return false;
    try {
      const keys = [
        currentOrgId,
        user?.restaurantId ? String(user.restaurantId) : "",
        user?.organizationId ? String(user.organizationId) : "",
        "default",
      ].filter(Boolean);
      for (const k of keys) {
        const cached =
          sessionStorage.getItem(`pos_active_shift_${k}`) ||
          localStorage.getItem(`pos_active_shift_${k}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (isShiftForCurrentDayAndValid(parsed)) {
            return true;
          }
        }
      }
    } catch { }
    return false;
  });
  const [isCheckingShift, setIsCheckingShift] = useState<boolean>(false);
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState<boolean>(false);
  const [staleUnclosedShift, setStaleUnclosedShift] = useState<any | null>(null);
  const [isStaleShiftPromptOpen, setIsStaleShiftPromptOpen] = useState<boolean>(false);

  // Automatically hide terminal top navigation header when Start Shift modal or Stale Shift prompt is open
  useEffect(() => {
    setHideHeader(isStartShiftModalOpen || isStaleShiftPromptOpen);
    return () => {
      setHideHeader(false);
    };
  }, [isStartShiftModalOpen, isStaleShiftPromptOpen, setHideHeader]);

  const [previousShiftHandover, setPreviousShiftHandover] = useState<{
    amount: number;
    cashierName: string;
    shiftType: string;
  } | null>(null);

  // Auto-detect cashier's assigned shift from admin profile or current time window
  const resolveAssignedShift = useCallback((): ShiftTypeOption => {
    const raw = user?.assignedShift || (user as any)?.shift;
    const config = getRestaurantShiftConfig(user?.restaurantId || (user as any)?.restId, user);
    if (raw) {
      const parsed = parseShiftOption(raw, config);
      if (parsed) return parsed;
    }
    // Fallback based on dynamic restaurant operating shift config
    return getCurrentOperatingShift(new Date(), config);
  }, [user]);

  const assignedShiftType = useMemo(() => resolveAssignedShift(), [resolveAssignedShift]);

  // 9. Modals & Terminal Views
  const [currentView, setCurrentView] = useState<"register" | "orders">("register");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetOrderForSettlement, setTargetOrderForSettlement] = useState<UnifiedOrder | null>(null);
  const [ordersHubInitialTab, setOrdersHubInitialTab] = useState<UnifiedOrderTab>("all");
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<OrderRecord | null>(null);
  const [activeKotTicket, setActiveKotTicket] = useState<KitchenTicket | null>(null);
  const [isHoldDrawerOpen, setIsHoldDrawerOpen] = useState(false);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isRecentOrdersOpen, setIsRecentOrdersOpen] = useState(false);
  const [isClearTicketConfirmOpen, setIsClearTicketConfirmOpen] = useState(false);
  const isSendingKotRef = useRef(false);
  const isSettlingOrderRef = useRef(false);

  // 10. Tenant Feature Entitlements & Pure POS Toggles
  const [tenantFlags, setTenantFlags] = useState<{
    enableKitchenKds: boolean;
    enableTableService: boolean;
    enableDirectThermalPrint: boolean;
    enableOfflineSync: boolean;
  }>({
    enableKitchenKds: user?.enableKitchenKds ?? true,
    enableTableService: user?.enableTableService ?? true,
    enableDirectThermalPrint: user?.enableDirectThermalPrint ?? true,
    enableOfflineSync: user?.enableOfflineSync ?? true,
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        if (restId) {
          const { data } = await supabase
            .from("restaurants")
            .select("enable_kitchen_kds, enable_table_service, enable_direct_thermal_print, enable_offline_sync, enabled_modules, branches")
            .eq("id", restId)
            .maybeSingle();

          if (data && isMounted) {
            if (data.branches?.[0]?.shift_timings) {
              const parsed = parseRestaurantShiftConfig(data.branches[0].shift_timings);
              if (parsed) {
                saveRestaurantShiftConfig(restId, parsed);
              }
            }
            const mods = Array.isArray(data.enabled_modules)
              ? data.enabled_modules.map((m: any) => String(m || "").toLowerCase().trim())
              : [];
            const hasKdsModule = mods.length === 0 || mods.includes("kds_system") || mods.includes("kds");
            const hasTableModule = mods.length === 0 || mods.includes("table_matrix") || mods.includes("tables");

            setTenantFlags({
              enableKitchenKds:
                data.enable_kitchen_kds !== undefined && data.enable_kitchen_kds !== null
                  ? Boolean(data.enable_kitchen_kds)
                  : hasKdsModule,
              enableTableService:
                data.enable_table_service !== undefined && data.enable_table_service !== null
                  ? Boolean(data.enable_table_service)
                  : hasTableModule,
              enableDirectThermalPrint:
                data.enable_direct_thermal_print !== undefined && data.enable_direct_thermal_print !== null
                  ? Boolean(data.enable_direct_thermal_print)
                  : true,
              enableOfflineSync:
                data.enable_offline_sync !== undefined && data.enable_offline_sync !== null
                  ? Boolean(data.enable_offline_sync)
                  : true,
            });
          }
        }
      } catch (err) {
        console.warn("[PosTerminalClient] Error fetching live tenantFlags:", err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const enableKitchenKds = user?.enableKitchenKds === false ? false : (tenantFlags.enableKitchenKds !== undefined ? tenantFlags.enableKitchenKds : (user?.enableKitchenKds ?? true));
  const enableTableService = tenantFlags.enableTableService !== undefined ? tenantFlags.enableTableService : (user?.enableTableService ?? true);
  const enableDirectThermalPrint = tenantFlags.enableDirectThermalPrint !== undefined ? tenantFlags.enableDirectThermalPrint : (user?.enableDirectThermalPrint ?? true);

  // If table service is disabled (Quick Counter / Takeaway Mode), force order channel away from dine_in
  useEffect(() => {
    if (!enableTableService && orderChannel === "dine_in") {
      setOrderChannel("takeaway");
    }
  }, [enableTableService, orderChannel]);

  // Real-time Network & System Sync Event Monitor
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      dispatchSystemSyncAlert(currentOrgId, {
        syncEvent: "Network Reconnected",
        details: "POS connection re-established with cloud servers. Real-time ledger and sync active.",
        branchName: user?.branchName || "Counter POS",
      });
      showToast("Online: Real-time cloud sync active.");
    };

    const handleOffline = () => {
      dispatchSystemSyncAlert(currentOrgId, {
        syncEvent: "Offline Mode Active",
        details: "Network connection lost. Terminal operating on local offline storage until reconnected.",
        branchName: user?.branchName || "Counter POS",
      });
      showToast("Offline mode: Orders will sync automatically when reconnected.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [currentOrgId, user?.branchName]);

  // Clear / Void Active Ticket Handler
  const handleConfirmClearCart = () => {
    const voidTotal = cart.reduce(
      (sum, c) => sum + (c.selectedVariant?.price ?? c.item?.price ?? 0) * (c.quantity || 1),
      0
    );
    const voidItemCount = cart.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    setCart([]);
    setInventoryTick((prev) => prev + 1);
    clearSharedPosCart(currentOrgId);
    playPosSound("chirp");
    showToast("Active ticket cleared. Raw material inventory restored.");
    if (voidItemCount > 0) {
      dispatchOrderCancelledAlert(currentOrgId, {
        orderNumber: `TICKET-${Date.now().toString().slice(-4)}`,
        cashierName: user?.name || "Cashier",
        totalAmount: voidTotal,
        reason: "Active Ticket Cleared / Voided by Cashier",
        itemCount: voidItemCount,
        branchName: user?.branchName || "Counter POS",
      });
    }
  };

  // Helper to ensure an active shift object is available without popping up modals on navigation or browsing
  const getOrRecoverActiveShift = useCallback(() => {
    if (embedded) {
      return (
        activeShift || {
          id: "admin-pos-session",
          status: "OPEN",
          cashier_name: user?.name || "Admin",
          shift_type: "Admin POS Session",
        }
      );
    }
    if (activeShift) return activeShift;
    if (typeof window !== "undefined") {
      try {
        const keys = [
          currentOrgId,
          user?.restaurantId ? String(user.restaurantId) : "",
          user?.organizationId ? String(user.organizationId) : "",
          "default",
        ].filter(Boolean);

        for (const k of keys) {
          const cached =
            sessionStorage.getItem(`pos_active_shift_${k}`) ||
            localStorage.getItem(`pos_active_shift_${k}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.status === "OPEN" || parsed.status === "active" || parsed.id)) {
              setActiveShift(parsed);
              return parsed;
            }
          }
        }
      } catch { }
    }
    return null;
  }, [activeShift, currentOrgId, embedded, user?.name, user?.restaurantId, user?.organizationId]);

  // Sync Supabase active open shift in background without interrupting navigation
  useEffect(() => {
    let isMounted = true;

    // Admin POS Bypass: Completely bypass opening float requirements, shift checks, and Z-report prompts
    if (embedded) {
      setHasConfirmedOpeningFloat(true);
      setIsStartShiftModalOpen(false);
      setIsStaleShiftPromptOpen(false);
      setIsCheckingShift(false);
      try {
        const keys = [
          currentOrgId,
          user?.restaurantId ? String(user.restaurantId) : "",
          user?.organizationId ? String(user.organizationId) : "",
          "default",
        ].filter(Boolean);
        for (const k of keys) {
          sessionStorage.removeItem(`pos_active_shift_${k}`);
          localStorage.removeItem(`pos_active_shift_${k}`);
        }
      } catch { }
      return;
    }

    const checkActiveShift = async () => {
      try {
        setIsCheckingShift(true);
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        // Concurrently query open shift and previous shift handover
        const [openShiftRes, lastShiftRes] = await Promise.all([
          supabase
            .from("shift_settlements")
            .select("*")
            .eq("restaurant_id", restId)
            .eq("status", "OPEN")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("shift_settlements")
            .select("*")
            .eq("restaurant_id", restId)
            .neq("status", "OPEN")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const openShift = openShiftRes.data;
        const lastShift = lastShiftRes.data;

        if (openShift && isMounted) {
          const isStale = isShiftFromPreviousDate(openShift);
          if (isStale) {
            // Prior-day shift left unclosed: prompt cashier/admin to reconcile or cleanly close
            setStaleUnclosedShift(openShift);
            setIsStaleShiftPromptOpen(true);
            setActiveShift(null);
            setHasConfirmedOpeningFloat(false);
            setIsStartShiftModalOpen(false);
            clearStaleShiftStorage(currentOrgId);
          } else {
            // Active shift started TODAY: restore session smoothly
            setActiveShift(openShift);
            setHasConfirmedOpeningFloat(true);
            setIsStartShiftModalOpen(false);
            setIsStaleShiftPromptOpen(false);

            let restoredSeg = 1;
            if (openShift.shift_type) {
              const segMatch = openShift.shift_type.match(/Segment\s*#?(\d+)/i);
              if (segMatch) {
                restoredSeg = parseInt(segMatch[1], 10) || 1;
              }
            }
            if (restoredSeg > 1) {
              setConsecutiveShiftCount(restoredSeg);
            }

            const restoredValidation = validateCashierShiftWindow(openShift.shift_type, new Date(), openShift);
            setShiftValidation(restoredValidation);

            try {
              sessionStorage.setItem(`pos_active_shift_${restId}`, JSON.stringify(openShift));
              sessionStorage.setItem(`pos_active_shift_${currentOrgId}`, JSON.stringify(openShift));
              localStorage.setItem(`pos_active_shift_${restId}`, JSON.stringify(openShift));
              localStorage.setItem(`pos_active_shift_${currentOrgId}`, JSON.stringify(openShift));
            } catch { }

            // Ensure shift sign-in alert is dispatched on terminal session initialization
            const staffSessionId = user?.id || user?.email || user?.name || "cashier";
            const sessionAlertKey = `pos_shift_login_alert_${openShift.id || "active"}_${staffSessionId}`;
            if (!sessionStorage.getItem(sessionAlertKey)) {
              sessionStorage.setItem(sessionAlertKey, "true");
              const targetTenantIds = Array.from(
                new Set(
                  [
                    currentOrgId,
                    String(restId || ""),
                    user?.organizationId ? String(user.organizationId) : "",
                    user?.restaurantId ? String(user.restaurantId) : "",
                    "default",
                  ].filter(Boolean)
                )
              );
              targetTenantIds.forEach((tId) => {
                dispatchShiftOpenedAlert(tId, {
                  cashierName: user?.name || openShift.cashier_name || "Cashier",
                  shiftType: openShift.shift_type || "Active Shift",
                  openingFloat: Number(openShift.opening_float) || 0,
                  branchName: user?.branchName || "Counter POS",
                });
              });
            }
          }
        } else if (isMounted) {
          // No active shift in database: UNCONDITIONAL PROMPT FOR OPENING FLOAT
          setActiveShift(null);
          setHasConfirmedOpeningFloat(false);
          setIsStartShiftModalOpen(true);
          clearStaleShiftStorage(currentOrgId);
        }

        if (lastShift && isMounted) {
          const handoverAmt = Number(
            lastShift.cash_handover_to_next_shift ??
            lastShift.actual_cash_counted ??
            lastShift.expected_drawer_cash ??
            lastShift.opening_float ??
            0
          );
          setPreviousShiftHandover({
            amount: handoverAmt,
            cashierName: lastShift.cashier_name || "Previous Cashier",
            shiftType: lastShift.shift_type || "Previous Shift",
          });
        }
      } catch (e) {
        console.warn("[PosTerminal] Background shift check note:", e);
      } finally {
        if (isMounted) setIsCheckingShift(false);
      }
    };

    checkActiveShift();

    return () => {
      isMounted = false;
    };
  }, [user, currentOrgId, embedded]);

  // Handler: Confirm Start Shift & Declare Opening Float
  const handleConfirmStartShift = async (payload: {
    shiftType: ShiftTypeOption;
    openingFloat: number;
    notes?: string;
  }) => {
    // Admin POS Bypass: Admin mode or embedded POS NEVER starts register shifts
    const isAdmin =
      embedded ||
      user?.role === "ADMIN" ||
      user?.role === "STANDALONE_ADMIN" ||
      user?.role === "BRANCH_ADMIN" ||
      user?.role === "SUPER_ADMIN" ||
      user?.terminalAccess === "FULL_ADMIN";

    if (isAdmin) {
      console.warn("[PosTerminalClient] Admin mode cannot start register shifts.");
      setIsStartShiftModalOpen(false);
      setHasConfirmedOpeningFloat(true);
      return;
    }

    const supabase = createClient();
    const { restId, branchId } = await getValidTenantContext(user);

    const currentRestaurantId =
      !isNaN(Number(restId)) && Number(restId) > 0 ? Number(restId) : null;
    const numericBranchId =
      typeof branchId === "number" && branchId > 0
        ? branchId
        : /^\d+$/.test(String(branchId || ""))
          ? parseInt(String(branchId), 10)
          : null;

    const cashierName = user?.name || user?.email || "Terminal Cashier";

    const shiftPayload: any = {
      restaurant_id: currentRestaurantId,
      cashier_name: cashierName,
      shift_start: new Date().toISOString(),
      opening_float: payload.openingFloat,
      actual_cash_counted: 0,
      status: "OPEN",
      closing_notes: `Shift: ${payload.shiftType}${payload.notes ? " | " + payload.notes : ""}`,
      created_at: new Date().toISOString(),
    };

    if (numericBranchId) {
      shiftPayload.branch_id = numericBranchId;
    }

    let { data, error } = await supabase
      .from("shift_settlements")
      .insert([{ ...shiftPayload, shift_type: payload.shiftType }])
      .select()
      .single();

    if (error && (error.code === "PGRST204" || error.message?.includes("shift_type"))) {
      const retry = await supabase
        .from("shift_settlements")
        .insert([shiftPayload])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn("[PosTerminalClient] Database shift start note, falling back to local shift:", error.message);
      data = {
        id: "shift_" + Date.now(),
        ...shiftPayload,
        shift_type: payload.shiftType,
      };
    }

    // Also persist to public.shifts if table exists
    try {
      await supabase.from("shifts").insert([{
        restaurant_id: currentRestaurantId,
        branch_id: String(numericBranchId || ""),
        cashier_name: cashierName,
        shift_start: new Date().toISOString(),
        status: "OPEN",
      }]);
    } catch { }

    const staffKey = user?.id || user?.name || "cashier";
    sessionStorage.setItem(`pos_session_float_confirmed_${staffKey}`, "true");
    localStorage.setItem(`pos_session_float_confirmed_${staffKey}`, "true");
    sessionStorage.setItem("pos_session_float_confirmed_global", "true");
    localStorage.setItem("pos_session_float_confirmed_global", "true");
    sessionStorage.removeItem(`pos_require_opening_float_${staffKey}`);
    localStorage.removeItem(`pos_require_opening_float_${staffKey}`);
    setHasConfirmedOpeningFloat(true);

    setActiveShift(data);
    setIsStartShiftModalOpen(false);
    // Reset order queue, parked orders, and active cart cleanly from zero (0)
    setCart([]);
    setInventoryTick((prev) => prev + 1);
    setParkedOrders([]);
    setOrders([]);
    setRunningTableOrders([]);
    try {
      sessionStorage.setItem(`pos_active_shift_${restId}`, JSON.stringify(data));
      sessionStorage.setItem(`pos_active_shift_${currentOrgId}`, JSON.stringify(data));
      localStorage.setItem(`pos_active_shift_${restId}`, JSON.stringify(data));
      localStorage.setItem(`pos_active_shift_${currentOrgId}`, JSON.stringify(data));
      clearSharedPosCart(currentOrgId);
      sessionStorage.removeItem(`pos_customer_name_${currentOrgId}`);
      sessionStorage.removeItem(`pos_customer_phone_${currentOrgId}`);
      localStorage.removeItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`);
      localStorage.removeItem(`pos_running_kot_orders_${currentOrgId}`);
    } catch { }

    // Dispatch Cross-Role Shift Opened Alert across all tenant keys (tenantId, restId, organizationId, default)
    const targetTenantIds = Array.from(
      new Set(
        [
          currentOrgId,
          String(restId || ""),
          user?.organizationId ? String(user.organizationId) : "",
          user?.restaurantId ? String(user.restaurantId) : "",
          "default",
        ].filter(Boolean)
      )
    );

    targetTenantIds.forEach((tId) => {
      dispatchShiftOpenedAlert(tId, {
        cashierName: user?.name || "Cashier",
        shiftType: payload.shiftType,
        openingFloat: Number(payload.openingFloat) || 0,
        branchName: user?.branchName || "Counter POS",
      });
    });

    showToast(`Shift started (${payload.shiftType.split(" ")[0]}) • Opening Float: Rs ${payload.openingFloat.toLocaleString()}`);
  };

  const handleOpenCashDrawer = () => {
    playPosSound("chime");
    const floatVal = activeShift?.opening_float !== undefined ? Number(activeShift.opening_float) : 0;
    showToast(`Cash Drawer Opened • Float: Rs ${floatVal.toLocaleString()}`);
  };

  // Handler for reconciling stale shift via Z-Report
  const handleReconcileStaleShift = () => {
    setIsStaleShiftPromptOpen(false);
    setIsShiftSettlementOpen(true);
  };

  // Handler for cleanly auto-closing stale shift and immediately opening StartShiftModal
  const handleCleanlyCloseStaleShift = async () => {
    if (!staleUnclosedShift) return;
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      await supabase
        .from("shift_settlements")
        .update({
          status: "CLOSED",
          shift_end: new Date().toISOString(),
          closing_notes: `Cleanly closed unclosed prior-day shift (${staleUnclosedShift.shift_type}) on next-day register initialization.`,
        })
        .eq("id", staleUnclosedShift.id);

      dispatchShiftSettlementAlert(currentOrgId, {
        cashierName: staleUnclosedShift.cashier_name || "Cashier",
        shiftType: staleUnclosedShift.shift_type || "Prior Shift",
        grossSales: Number(staleUnclosedShift.gross_sales || staleUnclosedShift.system_cash_sales || 0),
        actualCash: Number(staleUnclosedShift.actual_cash_counted || staleUnclosedShift.opening_float || 0),
        expectedCash: Number(staleUnclosedShift.opening_float || 0),
        cashVariance: 0,
        branchName: user?.branchName || "Main Counter",
      });

      showToast(`Prior shift closed. Opening register for today's session.`);
    } catch (err) {
      console.warn("[PosTerminal] Error auto-closing stale shift:", err);
    } finally {
      setStaleUnclosedShift(null);
      setIsStaleShiftPromptOpen(false);
      clearStaleShiftStorage(currentOrgId);
      // Immediately trigger the mandatory Opening Float popup
      setIsStartShiftModalOpen(true);
    }
  };

  const handleStaleShiftSettled = async () => {
    setStaleUnclosedShift(null);
    setIsShiftSettlementOpen(false);
    clearStaleShiftStorage(currentOrgId);
    showToast("Shift closed successfully. Redirecting to login...");
    setTimeout(async () => {
      try {
        await logout();
      } catch {}
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }, 500);
  };

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Takeaway Kitchen Ready Alert Queue (Scoped to POS Terminal)
  interface PosTakeawayReadyAlert {
    id: string;
    orderNumber: string;
    ticketId?: string;
    customerName?: string;
    customerPhone?: string;
    itemsSummary?: string;
    readyAtTime?: string;
    timestamp: number;
  }

  const [takeawayReadyList, setTakeawayReadyList] = useState<PosTakeawayReadyAlert[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`pos_takeaway_ready_${currentOrgId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });

  const handleTakeawayOrderReady = useCallback(
    (alert: {
      orderNumber: string;
      ticketId?: string;
      customerName?: string;
      customerPhone?: string;
      itemsSummary?: string;
      readyAt?: string;
      priority?: string;
    }) => {
      const cleanNum = String(alert.orderNumber || alert.ticketId || "").trim();
      if (!cleanNum) return;

      playRemoteAudioChime(alert.priority === "urgent" || alert.priority === "rush");
      playPosSound("chime");

      const newAlert: PosTakeawayReadyAlert = {
        id: cleanNum,
        orderNumber: cleanNum,
        ticketId: alert.ticketId,
        customerName: alert.customerName,
        customerPhone: alert.customerPhone,
        itemsSummary: alert.itemsSummary,
        readyAtTime: alert.readyAt
          ? new Date(alert.readyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
      };

      setTakeawayReadyList((prev) => {
        if (prev.some((p) => p.orderNumber === cleanNum || (alert.ticketId && p.ticketId === alert.ticketId))) {
          return prev;
        }
        const updated = [newAlert, ...prev];
        try {
          localStorage.setItem(`pos_takeaway_ready_${currentOrgId}`, JSON.stringify(updated));
        } catch { }
        return updated;
      });

      showToast(`🛍️ Takeaway Order #${cleanNum} is Ready for Counter Handover!`);
    },
    [currentOrgId, showToast]
  );

  const handleConfirmTakeawayHandover = async (alert: PosTakeawayReadyAlert) => {
    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      const orderNum = alert.orderNumber;
      const cleanTicket = alert.ticketId || alert.orderNumber;
      const baseKotId = cleanTicket.replace(/-[A-Z0-9]+$/, "");

      // 1. Update orders table to completed
      await supabase
        .from("orders")
        .update({
          order_status: "completed",
          completed_at: nowIso,
          updated_at: nowIso,
        })
        .or(`order_number.eq.${orderNum},id.eq.${orderNum},kot_id.eq.${cleanTicket},kot_id.eq.${baseKotId}`);

      // 2. Update kitchen_tickets table to completed
      await supabase
        .from("kitchen_tickets")
        .update({
          status: "completed",
          completed_at: nowIso,
        })
        .or(`ticket_number.eq.${cleanTicket},ticket_number.eq.${baseKotId},id.eq.${cleanTicket}`);

      // 3. Remove from ready list
      setTakeawayReadyList((prev) => {
        const updated = prev.filter((p) => p.orderNumber !== alert.orderNumber && p.id !== alert.id);
        try {
          localStorage.setItem(`pos_takeaway_ready_${currentOrgId}`, JSON.stringify(updated));
        } catch { }
        return updated;
      });

      playPosSound("chirp");
      showToast(`✅ Takeaway Order #${alert.orderNumber} handed over to guest!`);
    } catch (err) {
      console.error("[PosTerminalClient] Handover confirmation error:", err);
      showToast(`⚠️ Handover confirmation failed. Please retry.`);
    }
  };

  // Safe wrapper for opening payment settlement modal
  const handleOpenPaymentModal = () => {
    const shift = getOrRecoverActiveShift();
    if (!embedded && !shift && isStartShiftModalOpen) {
      showToast("Please declare opening float to start shift.");
      return;
    }
    if (cart.length === 0) {
      playPosSound("buzz");
      showToast("Please add items to cart before proceeding to payment.");
      return;
    }
    if (orderChannel === "delivery") {
      if (!customerName.trim()) {
        playPosSound("buzz");
        showToast("Customer name is required for delivery orders.");
        return;
      }
      if (!customerPhone.trim()) {
        playPosSound("buzz");
        showToast("Phone number is required for delivery orders.");
        return;
      }
      if (!deliveryZone.trim()) {
        playPosSound("buzz");
        showToast("Delivery destination area / address is required.");
        return;
      }
    }
    setTargetOrderForSettlement(null);
    setIsPaymentModalOpen(true);
  };

  // Direct settlement handler for orders selected from the Unified Orders Hub
  const handleSettleUnifiedOrder = (order: UnifiedOrder) => {
    if (
      order.paymentStatus === "voided" ||
      order.kitchenStatus === "voided" ||
      (order.rawOrderRecord as any)?.order_status === "cancelled" ||
      (order.rawOrderRecord as any)?.order_status === "voided" ||
      (order.rawOrderRecord as any)?.status === "voided"
    ) {
      showToast("❌ This order has been VOIDED by Admin and cannot be settled or charged.");
      return;
    }
    getOrRecoverActiveShift();
    setTargetOrderForSettlement(order);
    setIsPaymentModalOpen(true);
  };

  // Save parked orders to local storage
  const saveParkedOrders = (updated: ParkedOrder[]) => {
    setParkedOrders(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`, JSON.stringify(updated));
      } catch { }
    }
  };

  // Sync initial tenant stored menu and tables (Orders strictly managed by active shift)
  useEffect(() => {
    setMenuItems(getStoredMenu(currentOrgId, []));
    setTables(getStoredTables(currentOrgId, []));
  }, [currentOrgId]);

  const isFetchingOrdersRef = useRef<boolean>(false);

  // Fetch live orders from Supabase (Completed, Active KOT, and Held)
  const fetchLiveOrders = useCallback(async () => {
    if (isFetchingOrdersRef.current) return;
    isFetchingOrdersRef.current = true;
    setIsSyncingOrders(true);
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      if (!restId) return;

      const shiftStartIso = activeShift?.shift_start || activeShift?.created_at;

      // Fetch latest orders and kitchen tickets in parallel to reliably sync KOTs, tables, and voided tickets
      const [ordersRes, ticketsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false })
          .limit(250),
        supabase
          .from("kitchen_tickets")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false })
          .limit(250),
      ]);

      if (ordersRes.error) {
        console.warn("[PosTerminalClient] fetchLiveOrders orders query error:", ordersRes.error.message);
      }
      if (ticketsRes.error) {
        console.warn("[PosTerminalClient] fetchLiveOrders kitchen_tickets query error:", ticketsRes.error.message);
      }

      const ordersData = ordersRes.data || [];
      const ticketsData = ticketsRes.data || [];

      // 1. Build comprehensive set of all voided/cancelled ticket and order identifiers
      const voidedKeys = new Set<string>();
      ordersData.forEach((o: any) => {
        const isVoided =
          o.order_status === "cancelled" ||
          o.order_status === "voided" ||
          o.payment_status === "refunded" ||
          o.payment_status === "voided" ||
          o.status === "cancelled" ||
          o.status === "voided";
        if (isVoided) {
          if (o.id) voidedKeys.add(String(o.id));
          if (o.order_number) {
            voidedKeys.add(String(o.order_number));
            voidedKeys.add(String(o.order_number).replace(/^#+/, ""));
          }
        }
      });

      ticketsData.forEach((t: any) => {
        const isVoided = t.status === "voided" || t.status === "cancelled";
        if (isVoided) {
          if (t.id) voidedKeys.add(String(t.id));
          if (t.ticket_number) {
            voidedKeys.add(String(t.ticket_number));
            voidedKeys.add(String(t.ticket_number).replace(/^KOT-/i, ""));
          }
          if (t.order_id) {
            voidedKeys.add(String(t.order_id));
          }
        }
      });

      const completedList: OrderRecord[] = [];
      const runningKotList: OrderRecord[] = [];
      const heldList: ParkedOrder[] = [];
      const currentTables = tablesRef.current || [];

      // 2. Process records from central orders table
      ordersData.forEach((o: any) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const orderNum = o.order_number || o.id;
        const cleanOrderNum = String(orderNum).replace(/^#+/, "");
        const isHeld = String(orderNum).startsWith("#HOLD-") || o.customer_name === "Held Order";
        const isVoided =
          voidedKeys.has(String(o.id)) ||
          voidedKeys.has(String(orderNum)) ||
          voidedKeys.has(cleanOrderNum) ||
          o.order_status === "cancelled" ||
          o.order_status === "voided" ||
          o.payment_status === "refunded" ||
          o.payment_status === "voided" ||
          o.status === "cancelled" ||
          o.status === "voided";
        const isPaid = o.payment_status === "paid" && !isVoided;

        const matchedTable = currentTables.find(
          (t) =>
            (o.table_id && (t.dbId === o.table_id || String(t.id) === String(o.table_id))) ||
            isTableMatchingIdentifier(t, o.table_id) ||
            isTableMatchingIdentifier(t, o.customer_name)
        );
        const resolvedTableId = matchedTable?.id ?? (isNaN(Number(o.table_id)) ? undefined : Number(o.table_id));

        if (isVoided) {
          completedList.push({
            id: orderNum,
            orderChannel: o.order_channel || "dine_in",
            tableId: resolvedTableId,
            tableName: o.customer_name || matchedTable?.label || `Order #${orderNum}`,
            customerName: o.customer_name,
            customerPhone: o.customer_phone,
            delivery_zone: o.delivery_zone,
            items,
            subtotal: Number(o.subtotal || o.total_amount || 0),
            taxAmount: Number(o.tax_amount || 0),
            discountPercent: 0,
            discountAmount: Number(o.discount_amount || 0),
            total: Number(o.total_amount || o.subtotal || 0),
            paymentMethod: (o.payment_method || "voided").toLowerCase(),
            cashierName: o.cashier_name || user?.name || "Cashier",
            timestamp: o.created_at || new Date().toISOString(),
            status: "cancelled",
            payment_status: "voided",
            kotId: o.kot_id || undefined,
            shift_id: o.shift_id ?? null,
            void_reason: o.void_reason || undefined,
            voided_at: o.voided_at || undefined,
          });
        } else if (isPaid) {
          completedList.push({
            id: orderNum,
            orderChannel: o.order_channel || "dine_in",
            tableId: resolvedTableId,
            tableName: o.customer_name || matchedTable?.label || `Order #${orderNum}`,
            customerName: o.customer_name,
            customerPhone: o.customer_phone,
            delivery_zone: o.delivery_zone,
            items,
            subtotal: Number(o.subtotal || o.total_amount || 0),
            taxAmount: Number(o.tax_amount || 0),
            discountPercent: 0,
            discountAmount: Number(o.discount_amount || 0),
            total: Number(o.total_amount || o.subtotal || 0),
            paymentMethod: (o.payment_method || "cash").toLowerCase(),
            cashierName: o.cashier_name || user?.name || "Cashier",
            timestamp: o.created_at || new Date().toISOString(),
            status: o.order_status || "completed",
            payment_status: "paid",
            kotId: o.kot_id || undefined,
            shift_id: o.shift_id ?? null,
          });
        } else if (isHeld) {
          heldList.push({
            id: orderNum,
            cart: items.map((it: any) => ({
              item: {
                id: it.id || "",
                name: it.name,
                price: Number(it.price || 0),
                category: "General",
                imageIcon: "🍲",
                prepTime: it.prepTime || "15 mins",
                stockStatus: "in_stock",
                stockCount: 50,
              },
              quantity: Number(it.quantity || 1),
              notes: it.notes || "",
            })),
            orderChannel: o.order_channel || "dine_in",
            selectedTable: resolvedTableId,
            customerName: o.customer_name || "Held Order",
            customerPhone: o.customer_phone || "",
            deliveryZone: o.delivery_zone || "",
            total: Number(o.total_amount || 0),
            timestamp: new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        } else {
          runningKotList.push({
            id: orderNum,
            kotId: o.kot_id || `KOT-${String(orderNum).replace(/[^0-9]/g, "").slice(-4) || "1001"}`,
            orderChannel: o.order_channel || "dine_in",
            tableId: resolvedTableId,
            tableName: o.customer_name || matchedTable?.label || (resolvedTableId ? `Table ${resolvedTableId}` : `Order #${orderNum}`),
            customerName: o.customer_name,
            customerPhone: o.customer_phone,
            delivery_zone: o.delivery_zone,
            items,
            subtotal: Number(o.subtotal || o.total_amount || 0),
            taxAmount: Number(o.tax_amount || 0),
            discountPercent: 0,
            discountAmount: Number(o.discount_amount || 0),
            total: Number(o.total_amount || 0),
            paymentMethod: (o.payment_method || "cash").toLowerCase(),
            cashierName: o.cashier_name || user?.name || "Cashier",
            timestamp: o.created_at || new Date().toISOString(),
            status: o.order_status || "active",
            payment_status: o.payment_status || "pending",
            shift_id: o.shift_id ?? null,
          });
        }
      });

      // 3. Process kitchen_tickets to guarantee KOT orders and Admin cancellations show up in POS Order Hub
      ticketsData.forEach((t: any) => {
        const ticketItems = Array.isArray(t.items) ? t.items : [];
        const ticketNum = t.ticket_number || t.id;
        const cleanTicketNum = String(ticketNum).replace(/^KOT-/i, "");
        const isTicketVoided =
          t.status === "voided" ||
          t.status === "cancelled" ||
          voidedKeys.has(String(t.id)) ||
          voidedKeys.has(String(ticketNum)) ||
          voidedKeys.has(cleanTicketNum) ||
          (t.order_id && voidedKeys.has(String(t.order_id)));

        const matchedTable = currentTables.find(
          (tbl) =>
            (t.table_number && isTableMatchingIdentifier(tbl, t.table_number)) ||
            (t.customer_name && isTableMatchingIdentifier(tbl, t.customer_name))
        );
        const resolvedTableId = matchedTable?.id;

        const mappedItems = ticketItems.map((it: any) => ({
          id: it.id || "",
          name: it.name || "Item",
          price: Number(it.price || it.price_amount || 0),
          quantity: Number(it.qty || it.quantity || 1),
          notes: it.notes || "",
          prepTime: it.prepTime || "15m",
          preparation_time: it.preparation_time || 15,
          variant: it.variant || it.selectedVariant,
          variant_name: it.variant_name || it.variant?.name,
        }));

        const subtotal = mappedItems.reduce(
          (acc: number, it: any) => acc + (it.price * it.quantity),
          0
        );
        const total = subtotal;

        const alreadyInCompleted = completedList.some(
          (c) =>
            String(c.id) === String(t.id) ||
            String(c.id) === String(ticketNum) ||
            (t.order_id && String(c.id) === String(t.order_id)) ||
            (c.kotId && c.kotId === ticketNum)
        );

        if (isTicketVoided) {
          if (!alreadyInCompleted) {
            completedList.push({
              id: ticketNum,
              orderChannel: t.channel || t.order_type || "dine_in",
              tableId: resolvedTableId,
              tableName: t.table_number || matchedTable?.label || (resolvedTableId ? `Table ${resolvedTableId}` : ticketNum),
              customerName: t.customer_name || t.table_number,
              customerPhone: t.customer_phone,
              delivery_zone: t.delivery_area || t.delivery_address,
              items: mappedItems,
              subtotal,
              taxAmount: 0,
              discountPercent: 0,
              discountAmount: 0,
              total,
              paymentMethod: "voided",
              cashierName: t.server_name || user?.name || "Cashier",
              timestamp: t.created_at || new Date().toISOString(),
              status: "cancelled",
              payment_status: "voided",
              kotId: ticketNum,
              shift_id: null,
              void_reason: t.void_reason || undefined,
              voided_at: t.voided_at || undefined,
            });
          }
        } else if (t.status !== "completed" && t.status !== "fulfilled" && t.status !== "archived") {
          const alreadyInRunning = runningKotList.some(
            (r) =>
              String(r.id) === String(t.id) ||
              String(r.id) === String(ticketNum) ||
              (t.order_id && String(r.id) === String(t.order_id)) ||
              (r.kotId && r.kotId === ticketNum)
          );

          if (!alreadyInRunning && !alreadyInCompleted) {
            runningKotList.push({
              id: t.order_id || ticketNum,
              kotId: ticketNum,
              orderChannel: t.channel || t.order_type || "dine_in",
              tableId: resolvedTableId,
              tableName: t.table_number || matchedTable?.label || (resolvedTableId ? `Table ${resolvedTableId}` : ticketNum),
              customerName: t.customer_name || t.table_number,
              customerPhone: t.customer_phone,
              delivery_zone: t.delivery_area || t.delivery_address,
              items: mappedItems,
              subtotal,
              taxAmount: 0,
              discountPercent: 0,
              discountAmount: 0,
              total,
              paymentMethod: "cash",
              cashierName: t.server_name || user?.name || "Floor Server",
              timestamp: t.created_at || new Date().toISOString(),
              status: t.status || "active",
              payment_status: "pending",
              shift_id: null,
            });
          }
        }
      });

      // 4. Merge with any locally shared running KOT orders, strictly filtering out voided records
      try {
        const rawLocalRunning =
          localStorage.getItem(`pos_running_kot_orders_${currentOrgId}`) ||
          localStorage.getItem(`pos_running_kot_orders_${restId}`);
        if (rawLocalRunning) {
          const parsed = JSON.parse(rawLocalRunning);
          if (Array.isArray(parsed)) {
            parsed.forEach((localR) => {
              const rId = String(localR.id || "");
              const rKot = String(localR.kotId || "");
              const isVoidedLocal =
                voidedKeys.has(rId) ||
                voidedKeys.has(rId.replace(/^#+/, "")) ||
                (rKot && (voidedKeys.has(rKot) || voidedKeys.has(rKot.replace(/^KOT-/i, "")))) ||
                localR.status === "cancelled" ||
                localR.status === "voided" ||
                localR.payment_status === "voided" ||
                localR.payment_status === "refunded";

              const isPaidOrCompleted =
                isVoidedLocal ||
                completedList.some(
                  (c) =>
                    String(c.id) === rId ||
                    (localR.kotId && c.kotId === localR.kotId)
                ) ||
                !isOrderOccupyingTable(localR);

              if (
                !isPaidOrCompleted &&
                !runningKotList.some(
                  (r) =>
                    String(r.id) === rId ||
                    (localR.kotId && r.kotId === localR.kotId)
                )
              ) {
                runningKotList.unshift(localR);
              }
            });
          }
        }
      } catch { }

      // 5. Strict post-filter: NEVER allow any voided order to stay in runningKotList
      const sanitizedRunning = runningKotList.filter((r) => {
        const rId = String(r.id || "");
        const rKot = String(r.kotId || "");
        const isVoided =
          voidedKeys.has(rId) ||
          voidedKeys.has(rId.replace(/^#+/, "")) ||
          (rKot && (voidedKeys.has(rKot) || voidedKeys.has(rKot.replace(/^KOT-/i, "")))) ||
          r.status === "cancelled" ||
          r.status === "voided" ||
          r.payment_status === "voided" ||
          r.payment_status === "refunded";
        return !isVoided;
      });

      setOrders(completedList);
      saveStoredOrders(currentOrgId, completedList);

      setRunningTableOrders(sanitizedRunning);
      setActiveDbOrders(sanitizedRunning);

      // Overwrite localStorage with sanitized active orders so voided orders are never resurrected on refresh
      try {
        localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(sanitizedRunning));
        if (restId) {
          localStorage.setItem(`pos_running_kot_orders_${restId}`, JSON.stringify(sanitizedRunning));
        }
      } catch { }

      // Immediately reflect running KOTs into table occupancy using single source of truth
      const activeRecords = sanitizedRunning
        .filter((ro) => isOrderOccupyingTable(ro))
        .map((ro) => {
          const ident = ro.tableName || (ro.tableId ? String(ro.tableId) : "");
          return {
            tableIdentifier: ident,
            tableNumberNorm: normalizeTableNumber(ident),
            orderId: String(ro.id),
            kotId: ro.kotId,
            tableId: ro.tableId,
            totalAmount: ro.total,
            source: "order" as const,
            paymentStatus: ro.payment_status,
            status: ro.status,
          };
        });
      setTables((prev) => reconcileTableStatuses(prev, activeRecords));

      setParkedOrders(heldList);
      try {
        localStorage.setItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`, JSON.stringify(heldList));
      } catch { }
    } catch (err) {
      console.warn("[PosTerminalClient] fetchLiveOrders exception:", err);
    } finally {
      isFetchingOrdersRef.current = false;
      setIsSyncingOrders(false);
    }
  }, [user, activeShift, currentOrgId]);

  // Sync live orders whenever activeShift or user changes
  useEffect(() => {
    fetchLiveOrders();
  }, [fetchLiveOrders]);

  const isFetchingTablesRef = useRef<boolean>(false);

  // Memoized live table fetching matching admin floor matrix scope
  const fetchLiveTables = useCallback(async () => {
    if (isFetchingTablesRef.current) return;
    isFetchingTablesRef.current = true;
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      if (!restId) return;

      const [tableRes, activeRecords] = await Promise.all([
        supabase
          .from("restaurant_tables")
          .select("*")
          .eq("restaurant_id", restId)
          .order("table_number", { ascending: true }),
        fetchActiveUnpaidTableRecords(restId, supabase),
      ]);

      const data = tableRes.data;
      const error = tableRes.error;

      if (!error && data) {
        const seenIds = new Set<number>();
        const mappedTables: TableStatus[] = data.map((t: any, idx: number) => {
          let mapped = mapRowToTableStatus(t, idx);
          while (seenIds.has(mapped.id)) {
            mapped.id = mapped.id + 100;
          }
          seenIds.add(mapped.id);
          return mapped;
        });

        const reconciled = reconcileTableStatuses(mappedTables, activeRecords);

        setTables(reconciled);
        saveStoredTables(currentOrgId, reconciled);
        autoHealDatabaseTableOccupancy(restId, reconciled, activeRecords, supabase);

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`tables_list_${restId}`, JSON.stringify(reconciled));
            localStorage.setItem(`tables_list_${currentOrgId}`, JSON.stringify(reconciled));
          } catch {}
        }

        // Align selectedTable with current floor layout
        setSelectedTable((prevSelected) => {
          if (reconciled.length === 0) return 1;
          if (reconciled.some((t) => t.id === prevSelected)) return prevSelected;
          return reconciled[0].id;
        });
      }
    } catch (err) {
      console.warn("[PosTerminalClient] fetchLiveTables warning:", err);
    } finally {
      isFetchingTablesRef.current = false;
    }
  }, [user, currentOrgId]);

  // Sync live tables whenever user or currentOrgId changes
  useEffect(() => {
    fetchLiveTables();
  }, [fetchLiveTables]);

  // Memoized live catalog fetch & centralized unified stock computation
  const fetchLiveMenuCatalog = useCallback(async () => {
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      if (!restId) return;

      // Concurrently fetch menu items, recipe BOM items, raw materials, and active unfulfilled orders from Supabase
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
      setActiveDbOrders(activeOrdersRows);

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
    } catch (e) {
      console.warn("[PosTerminal] Error fetching live menu catalog:", e);
    }
  }, [user, currentOrgId]);

  // Load live Supabase catalog, recipes, and branch settings
  useEffect(() => {
    let isMounted = true;

    let unsubTerminalBus: (() => void) | null = null;
    // Debounce timers to batch rapid realtime updates
    let liveOrdersTimer: NodeJS.Timeout | null = null;
    const debouncedFetchLiveOrders = () => {
      if (liveOrdersTimer) clearTimeout(liveOrdersTimer);
      liveOrdersTimer = setTimeout(() => {
        if (isMounted) fetchLiveOrders();
      }, 250);
    };

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

    const loadLivePosData = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        // Concurrently fetch live menu, tables, and tax settings in parallel
        const [, , settingsRes] = await Promise.all([
          fetchLiveMenuCatalog(),
          fetchLiveTables(),
          supabase
            .from("branch_settings")
            .select("tax_rate, tax_rate_percent")
            .eq("restaurant_id", restId)
            .maybeSingle(),
        ]);

        const settingsData = settingsRes.data;

        let resolvedTax: number | null = null;
        if (settingsData) {
          const val = settingsData.tax_rate ?? settingsData.tax_rate_percent;
          if (val !== null && val !== undefined) {
            resolvedTax = Number(val);
          }
        }

        if (resolvedTax === null) {
          const { data: restRow } = await supabase
            .from("restaurants")
            .select("tax_rate, tax_rate_percent")
            .eq("id", restId)
            .maybeSingle();
          if (restRow) {
            const val = (restRow as any).tax_rate ?? (restRow as any).tax_rate_percent;
            if (val !== null && val !== undefined) {
              resolvedTax = Number(val);
            }
          }
        }

        if (resolvedTax !== null && isMounted) {
          setTaxRatePercent(resolvedTax);
          try {
            localStorage.setItem(`pos_tax_rate_${restId}`, String(resolvedTax));
            saveStoredBranchSettings(currentOrgId, "1", { taxRatePercent: resolvedTax });
          } catch { }
        }

        // Fetch persistent orders for current restaurant / shift
        await fetchLiveOrders();
      } catch (e) {
        console.warn("[PosTerminal] Data sync error:", e);
      }
    };

    loadLivePosData();

    // Cross-tab and local window sync for instant tax, menu, and floor table updates
    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === `pos_tax_rate_${currentOrgId}` && e.newValue !== null) {
        setTaxRatePercent(Number(e.newValue));
      }
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
        e.key?.startsWith("omni_tables_")
      ) {
        debouncedFetchLiveTables();
      }
      if (
        e.key === `pos_orders_${currentOrgId}` ||
        e.key?.startsWith("pos_orders_") ||
        e.key?.startsWith("pos_running_kot_")
      ) {
        debouncedFetchLiveOrders();
        debouncedFetchLiveTables();
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
    const handleOrdersUpdated = () => {
      debouncedFetchLiveOrders();
      debouncedFetchLiveTables();
    };

    const handleTableReleasedEvent = (data: any) => {
      if (!data) return;
      const targetTableId = data.tableId;
      const targetTableNum = data.tableNumber;
      const targetOrderId = data.orderId;

      setTables((prev) =>
        prev.map((t) => {
          const matches =
            (targetTableId && (String(t.dbId) === String(targetTableId) || String(t.id) === String(targetTableId))) ||
            (targetTableNum && isTableMatchingIdentifier(t, targetTableNum)) ||
            (targetOrderId && (t.activeOrderId === targetOrderId || String(t.activeOrderId) === String(targetOrderId)));

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

      setRunningTableOrders((prev) => {
        const updated = prev.filter((o) => {
          if (targetOrderId && (String(o.id) === String(targetOrderId) || o.kotId === targetOrderId)) return false;
          if (targetTableNum && (o.tableName === targetTableNum || isTableMatchingIdentifier({ label: targetTableNum }, o.tableId))) return false;
          return true;
        });
        try {
          localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setActiveDbOrders((prev) =>
        prev.filter((o) => {
          if (targetOrderId && (String(o.id) === String(targetOrderId) || o.kotId === targetOrderId)) return false;
          if (targetTableNum && (o.tableName === targetTableNum || isTableMatchingIdentifier({ label: targetTableNum }, o.tableId))) return false;
          return true;
        })
      );

      // Dismiss payment settlement modal immediately if the active settlement order was voided or released
      setTargetOrderForSettlement((currentSettlement) => {
        if (!currentSettlement) return null;
        const matchesTarget =
          (targetOrderId && (String(currentSettlement.id) === String(targetOrderId) || currentSettlement.kotId === targetOrderId)) ||
          (targetTableNum && isTableMatchingIdentifier({ label: targetTableNum }, currentSettlement.tableName || currentSettlement.customerName || currentSettlement.tableId));
        if (matchesTarget) {
          setIsPaymentModalOpen(false);
          showToast(`Order #${targetOrderId || targetTableNum} was voided/released. Removed from settlement.`);
          return null;
        }
        return currentSettlement;
      });

      debouncedFetchLiveTables();
    };

    const handleTableReleasedWindow = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail) {
        handleTableReleasedEvent(custom.detail);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("pos_tax_rate_changed", handleCustomTaxChange);
      window.addEventListener("pos_menu_updated", handleCustomMenuUpdated);
      window.addEventListener("inventory_stock_deducted", handleInventoryStockDeducted);
      window.addEventListener("pos_tables_updated", handleCustomTablesUpdated);
      window.addEventListener("restaurant_tables_changed", handleCustomTablesUpdated);
      window.addEventListener("table_released", handleTableReleasedWindow);
      window.addEventListener("orders_updated", handleOrdersUpdated);
    }

    let ledgerBc: BroadcastChannel | null = null;
    let occBc: BroadcastChannel | null = null;
    let kdsBc: BroadcastChannel | null = null;
    let restOrdersBc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        ledgerBc = new BroadcastChannel("pos_ledger_sync_channel");
        ledgerBc.onmessage = (event) => {
          if (event.data?.type === "INVENTORY_DEDUCTED") {
            debouncedFetchLiveMenu();
          } else if (event.data?.type === "TABLES_UPDATED") {
            debouncedFetchLiveTables();
            debouncedFetchLiveOrders();
          } else if (event.data?.type === "TABLE_RELEASED") {
            handleTableReleasedEvent(event.data?.payload);
          } else if (event.data?.type === "ORDERS_UPDATED") {
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
            debouncedFetchLiveMenu();
          } else if (event.data?.type === "TICKET_VOIDED_BY_ADMIN" || event.data?.type === "ORDER_VOIDED") {
            handleTableReleasedEvent({
              tableNumber: event.data.tableNumber,
              orderId: event.data.ticketId || event.data.orderId,
            });
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
          }
        };
      } catch { }

      try {
        occBc = new BroadcastChannel("omni_table_occupancy_sync");
        occBc.onmessage = (event) => {
          if (event.data?.type === "TABLE_RELEASED") {
            handleTableReleasedEvent(event.data?.payload);
          } else if (event.data?.type === "TABLES_UPDATED" || event.data?.type === "ORDERS_UPDATED") {
            debouncedFetchLiveTables();
            debouncedFetchLiveOrders();
          } else if (event.data?.type === "TICKET_VOIDED_BY_ADMIN" || event.data?.type === "ORDER_VOIDED") {
            handleTableReleasedEvent({
              tableNumber: event.data.tableNumber,
              orderId: event.data.ticketId || event.data.orderId,
            });
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
          }
        };
      } catch { }

      try {
        kdsBc = new BroadcastChannel("pos_kds_sync");
        kdsBc.onmessage = (event) => {
          if (event.data?.type === "TICKET_VOIDED_BY_ADMIN" || event.data?.type === "ORDER_VOIDED") {
            handleTableReleasedEvent({
              tableNumber: event.data.tableNumber,
              orderId: event.data.ticketId || event.data.orderId,
            });
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
          } else if (event.data?.type === "KDS_TICKETS_UPDATED" || event.data?.type === "KOT_CREATED") {
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
          }
        };
      } catch { }

      try {
        restOrdersBc = new BroadcastChannel("restaurant_orders_channel");
        restOrdersBc.onmessage = (event) => {
          if (event.data?.type === "TICKET_VOIDED_BY_ADMIN" || event.data?.type === "ORDER_VOIDED") {
            handleTableReleasedEvent({
              tableNumber: event.data.tableNumber,
              orderId: event.data.ticketId || event.data.orderId,
            });
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
          } else {
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
          }
        };
      } catch { }
    }

    // Subscribe to realtime menu, table, and branch settings updates
    let channel: any = null;
    let unsubBuzzer: (() => void) | null = null;
    let unsubBridge: (() => void) | null = null;
    let unsubTakeaway: (() => void) | null = null;
    let unsubStock: (() => void) | null = null;
    let unsubRelease: (() => void) | null = null;

    // Attach cross-tab, window event, and broadcast takeaway ready listener for POS
    unsubTakeaway = subscribeToTakeawayReadyAlerts(currentOrgId, (alert) => {
      if (!isMounted) return;
      handleTakeawayOrderReady(alert);
    });

    // Attach cross-tab, window event, and broadcast buzzer listener for POS
    unsubBuzzer = subscribeToRemoteKitchenBuzzer(currentOrgId, (payload) => {
      if (!isMounted) return;
      if (payload.orderChannel === "takeaway" || payload.targetStation === "pos") {
        handleTakeawayOrderReady({
          orderNumber: payload.orderNumber || payload.ticketId || "",
          ticketId: payload.ticketId,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          readyAt: payload.readyAt,
          priority: payload.priority,
        });
      } else {
        playRemoteAudioChime(payload.priority === "urgent" || payload.priority === "rush");
        playPosSound("chime");
        showToast(`🔔 Kitchen Alert: ${payload.title ? `${payload.title} - ` : ""}${payload.message}`);
      }
    });

    unsubBridge = subscribeToKitchenWaiterBridge(currentOrgId, {
      onOrderReady: (payload) => {
        if (!isMounted) return;
        const ch = (payload.orderChannel || "").toLowerCase();
        if (ch === "takeaway") {
          handleTakeawayOrderReady({
            orderNumber: payload.orderNumber || payload.ticketId,
            ticketId: payload.ticketId,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            itemsSummary: Array.isArray(payload.items) ? payload.items.map((it: any) => `${it.name || "Item"} x${it.qty || 1}`).join(", ") : undefined,
            readyAt: payload.readyAt,
            priority: payload.priority,
          });
        } else if (ch !== "delivery") {
          playRemoteAudioChime(payload.priority === "urgent" || payload.priority === "rush");
          playPosSound("chime");
          showToast(
            `🔔 Kitchen Pass: Order #${payload.ticketId} (${payload.tableNumber || "Counter"}) is READY for pickup!`
          );
        }
        debouncedFetchLiveOrders();
      },
    });

    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const subId = Math.random().toString(36).substring(2, 7);

        if (restId) {
          unsubRelease = subscribeToTableReleased(restId, handleTableReleasedEvent, supabase);
        }

        // If restId differs from currentOrgId, ensure buzzer listener is active for restId as well
        if (restId && String(restId) !== String(currentOrgId)) {
          const restBuzzerUnsub = subscribeToRemoteKitchenBuzzer(String(restId), (payload) => {
            if (!isMounted) return;
            playRemoteAudioChime(payload.priority === "urgent" || payload.priority === "rush");
            playPosSound("chime");
            showToast(`🔔 Kitchen Alert: ${payload.title ? `${payload.title} - ` : ""}${payload.message}`);
          });
          const prevBuzzer = unsubBuzzer;
          unsubBuzzer = () => {
            if (prevBuzzer) prevBuzzer();
            restBuzzerUnsub();
          };
        }

        unsubStock = subscribeToStockRefresh(restId, () => {
          debouncedFetchLiveMenu();
          debouncedFetchLiveOrders();
        });

        channel = supabase
          .channel(`terminal_realtime_${restId}_${subId}`)
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
              table: "orders",
              filter: `restaurant_id=eq.${restId}`,
            },
            (payload: any) => {
              if (payload?.eventType === "UPDATE") {
                const n = payload.new;
                const o = payload.old;
                if (n && n.order_channel === "takeaway" && n.order_status === "ready" && (!o || o.order_status !== "ready")) {
                  handleTakeawayOrderReady({
                    orderNumber: n.order_number || `#ORD-${n.id}`,
                    ticketId: n.kot_id || n.order_number,
                    customerName: n.customer_name || undefined,
                    customerPhone: n.customer_phone || undefined,
                    readyAt: n.ready_at || new Date().toISOString(),
                  });
                }
              }
              debouncedFetchLiveOrders();
              debouncedFetchLiveTables();
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
            (payload: any) => {
              if (payload?.eventType === "UPDATE") {
                const n = payload.new;
                const o = payload.old;
                if (n?.ready_for_pickup_at && (!o || !o.ready_for_pickup_at || n.status === "ready")) {
                  const ch = (n.channel || n.order_type || "").toLowerCase();
                  if (ch === "takeaway" || String(n.table_number || "").toLowerCase().includes("takeaway") || String(n.table_number || "").toLowerCase().includes("pickup")) {
                    handleTakeawayOrderReady({
                      orderNumber: n.ticket_number || n.id,
                      ticketId: n.ticket_number || n.id,
                      customerName: n.customer_name || undefined,
                      customerPhone: n.customer_phone || undefined,
                      readyAt: n.ready_for_pickup_at,
                      priority: n.priority,
                    });
                  } else if (ch !== "delivery") {
                    playRemoteAudioChime(n.priority === "urgent" || n.priority === "rush");
                    playPosSound("chime");
                    showToast(`🔔 Kitchen Pass: Order #${n.ticket_number || n.id} (${n.table_number || "Counter"}) is READY for pickup!`);
                  }
                }
              }
              debouncedFetchLiveOrders();
            }
          )
          .on("broadcast", { event: "stock_refresh" }, () => {
            debouncedFetchLiveMenu();
            debouncedFetchLiveOrders();
          })
          .on("broadcast", { event: "takeaway_order_ready" }, ({ payload }) => {
            if (!payload) return;
            handleTakeawayOrderReady({
              orderNumber: payload.orderNumber || payload.order_number || payload.ticketId || payload.ticket_id,
              ticketId: payload.ticketId || payload.ticket_id,
              customerName: payload.customerName || payload.customer_name,
              customerPhone: payload.customerPhone || payload.customer_phone,
              itemsSummary: payload.itemsSummary || payload.items_summary,
              readyAt: payload.readyAt || payload.ready_for_pickup_at,
              priority: payload.priority,
            });
          })
          .on("broadcast", { event: "order_ready" }, ({ payload }) => {
            if (!payload) return;
            const ch = (payload.order_channel || payload.orderChannel || "").toLowerCase();
            if (ch === "takeaway") {
              handleTakeawayOrderReady({
                orderNumber: payload.order_number || payload.ticket_id || payload.ticketId,
                ticketId: payload.ticket_id || payload.ticketId,
                customerName: payload.customer_name || payload.customerName,
                customerPhone: payload.customer_phone || payload.customerPhone,
                itemsSummary: Array.isArray(payload.items) ? payload.items.map((it: any) => `${it.name || "Item"} x${it.qty || 1}`).join(", ") : undefined,
                readyAt: payload.ready_for_pickup_at,
                priority: payload.priority,
              });
            } else if (ch !== "delivery") {
              playRemoteAudioChime(payload.priority === "urgent" || payload.priority === "rush");
              playPosSound("chime");
              showToast(`🔔 Kitchen Pass: Order #${payload.ticket_id || payload.ticketId} (${payload.table_number || payload.tableNumber || "Counter"}) is READY for pickup!`);
            }
          })
          .on("broadcast", { event: "kitchen_buzzer_alert" }, ({ payload }) => {
            if (!payload) return;
            if (payload.orderChannel === "takeaway" || payload.targetStation === "pos") {
              handleTakeawayOrderReady({
                orderNumber: payload.orderNumber || payload.ticketId || "",
                ticketId: payload.ticketId,
                customerName: payload.customerName,
                customerPhone: payload.customerPhone,
                readyAt: payload.readyAt,
                priority: payload.priority,
              });
            } else {
              playRemoteAudioChime(payload.priority === "urgent" || payload.priority === "rush");
              playPosSound("chime");
              showToast(`🔔 Kitchen Alert: ${payload.title ? `${payload.title} - ` : ""}${payload.message || `Order #${payload.ticketId || ""} is ready!`}`);
            }
          })
          .on("broadcast", { event: "TABLE_RELEASED" }, ({ payload }) => {
            if (!payload) return;
            handleTableReleasedEvent(payload);
          })
          .on("broadcast", { event: "TABLES_UPDATED" }, () => {
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
          })
          .on("broadcast", { event: "ORDERS_UPDATED" }, () => {
            debouncedFetchLiveOrders();
            debouncedFetchLiveTables();
          })
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "orders",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              if (!isMounted) return;
              debouncedFetchLiveOrders();
              debouncedFetchLiveTables();
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
            () => {
              if (!isMounted) return;
              debouncedFetchLiveOrders();
              debouncedFetchLiveTables();
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
            (payload: any) => {
              if (!isMounted) return;
              if (payload.eventType === "UPDATE") {
                const row = payload.new;
                const statusUpper = String(row.status || "AVAILABLE").toUpperCase();
                const isAvail = statusUpper === "AVAILABLE";
                setTables((prev) =>
                  prev.map((t) => {
                    if (String(t.dbId) === String(row.id) || t.label === row.table_number || String(t.id) === String(row.id)) {
                      let tableLabel = String(row.table_number || row.name || t.label).trim();
                      if (/^\d+$/.test(tableLabel)) {
                        tableLabel = `Table ${tableLabel}`;
                      }
                      return {
                        ...t,
                        label: tableLabel,
                        capacity: Number(row.seating_capacity ?? row.capacity ?? t.capacity),
                        section: row.section_name || row.floor_name || t.section,
                        sectionName: row.section_name || row.floor_name || t.section,
                        status:
                          statusUpper === "OCCUPIED"
                            ? "seated"
                            : statusUpper === "BILLED"
                              ? "billing"
                              : statusUpper === "RESERVED"
                                ? "reserved"
                                : "available",
                        activeOrderId: isAvail ? undefined : (row.active_order_id || row.current_order_id || undefined),
                        activeAmount: isAvail ? undefined : t.activeAmount,
                      };
                    }
                    return t;
                  })
                );
                debouncedFetchLiveTables();
              } else if (payload.eventType === "INSERT") {
                const row = payload.new;
                setTables((prev) => {
                  const filtered = prev.filter((t) => String(t.dbId) !== String(row.id));
                  const newMapped = mapRowToTableStatus(row, filtered.length);
                  return [...filtered, newMapped];
                });
                debouncedFetchLiveTables();
              } else if (payload.eventType === "DELETE") {
                const oldId = payload.old?.id;
                setTables((prev) => prev.filter((t) => String(t.dbId) !== String(oldId) && String(t.id) !== String(oldId)));
                debouncedFetchLiveTables();
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "branch_settings",
              filter: `restaurant_id=eq.${restId}`,
            },
            (payload: any) => {
              if (!isMounted) return;
              const row = payload.new;
              if (row) {
                const tax = row.tax_rate ?? row.tax_rate_percent;
                if (tax !== null && tax !== undefined) {
                  const num = Number(tax);
                  setTaxRatePercent(num);
                  try {
                    localStorage.setItem(`pos_tax_rate_${restId}`, String(num));
                    saveStoredBranchSettings(currentOrgId, "1", { taxRatePercent: num });
                  } catch { }
                }
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "restaurants",
              filter: `id=eq.${restId}`,
            },
            (payload: any) => {
              if (!isMounted) return;
              const row = payload.new;
              if (row) {
                const tax = row.tax_rate ?? row.tax_rate_percent;
                if (tax !== null && tax !== undefined) {
                  const num = Number(tax);
                  setTaxRatePercent(num);
                  try {
                    localStorage.setItem(`pos_tax_rate_${restId}`, String(num));
                    saveStoredBranchSettings(currentOrgId, "1", { taxRatePercent: num });
                  } catch { }
                }
              }
            }
          )
          .subscribe((status: string, err?: any) => {
            console.log(`[PosTerminal Realtime ${restId}] Channel status: ${status}`, err || "");
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              if (isMounted) {
                console.warn(`[PosTerminal Realtime ${restId}] Disconnected (${status}). Auto-reconnecting...`);
                setTimeout(() => {
                  if (isMounted) {
                    debouncedFetchLiveOrders();
                    debouncedFetchLiveTables();
                  }
                }, 1500);
              }
            }
          });

        unsubTerminalBus = subscribeTerminalEventBus(restId, (payload) => {
          if (!isMounted) return;
          console.log("[PosTerminal] Received terminal bus mutation:", payload);
          if (payload.type === "TABLE_RELEASED") {
            handleTableReleasedEvent(payload);
          } else if (payload.type === "ORDER_VOIDED") {
            handleTableReleasedEvent({
              tableId: payload.tableId,
              tableNumber: payload.tableNumber,
              orderId: payload.orderId || payload.ticketId,
            });
            // Optimistically update orders list to mark voided immediately
            const voidTargetId = payload.orderId || payload.ticketId;
            if (voidTargetId) {
              setOrders((prev) =>
                prev.map((o) =>
                  String(o.id) === String(voidTargetId) || o.kotId === String(voidTargetId)
                    ? { ...o, status: "cancelled", payment_status: "voided", paymentMethod: o.paymentMethod || "cash" }
                    : o
                )
              );
            }
          } else if (payload.type === "TABLE_MUTATION") {
            const isRelease = payload.status === "available" || payload.status === "AVAILABLE";
            if (payload.tableNumber || payload.tableId) {
              setTables((prev) =>
                prev.map((t) => {
                  const matches =
                    (payload.tableId && (String(t.dbId) === String(payload.tableId) || String(t.id) === String(payload.tableId))) ||
                    (payload.tableNumber && isTableMatchingIdentifier(t, payload.tableNumber));
                  if (matches) {
                    return {
                      ...t,
                      status: isRelease ? "available" : "seated",
                      activeOrderId: isRelease ? undefined : (payload.orderId ? String(payload.orderId) : t.activeOrderId),
                    };
                  }
                  return t;
                })
              );
            }
          }
          fetchLiveOrders();
          fetchLiveTables();
        });
      } catch { }
    })();

    return () => {
      isMounted = false;
      if (liveOrdersTimer) clearTimeout(liveOrdersTimer);
      if (liveMenuTimer) clearTimeout(liveMenuTimer);
      if (liveTablesTimer) clearTimeout(liveTablesTimer);
      if (unsubTerminalBus) {
        try {
          unsubTerminalBus();
        } catch { }
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("pos_tax_rate_changed", handleCustomTaxChange);
        window.removeEventListener("pos_menu_updated", handleCustomMenuUpdated);
        window.removeEventListener("inventory_stock_deducted", handleInventoryStockDeducted);
        window.removeEventListener("pos_tables_updated", handleCustomTablesUpdated);
        window.removeEventListener("restaurant_tables_changed", handleCustomTablesUpdated);
        window.removeEventListener("table_released", handleTableReleasedWindow);
        window.removeEventListener("orders_updated", handleOrdersUpdated);
      }
      if (unsubRelease) {
        try {
          unsubRelease();
        } catch { }
      }
      if (unsubBuzzer) {
        try {
          unsubBuzzer();
        } catch { }
      }
      if (unsubTakeaway) {
        try {
          unsubTakeaway();
        } catch { }
      }
      if (unsubStock) {
        try {
          unsubStock();
        } catch { }
      }
      if (unsubBridge) {
        try {
          unsubBridge();
        } catch { }
      }
      if (ledgerBc) {
        try {
          ledgerBc.close();
        } catch { }
      }
      if (occBc) {
        try {
          occBc.close();
        } catch { }
      }
      if (kdsBc) {
        try {
          kdsBc.close();
        } catch { }
      }
      if (restOrdersBc) {
        try {
          restOrdersBc.close();
        } catch { }
      }
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch { }
      }
    };
  }, [user, currentOrgId, fetchLiveMenuCatalog, fetchLiveOrders, fetchLiveTables]);

  // Derived selected table object
  const selectedTableObj = tables.find((t) => t.id === selectedTable) || tables[0];

  // Helper to find running active order for a given table
  const getTableActiveOrder = useCallback(
    (table: TableStatus | undefined) => {
      if (!table) return undefined;
      return runningTableOrders.find(
        (o) =>
          (o.tableId === table.id ||
            isTableMatchingIdentifier(table, o.tableId) ||
            isTableMatchingIdentifier(table, o.tableName) ||
            (table.activeOrderId &&
              (o.id === table.activeOrderId || o.kotId === table.activeOrderId))) &&
          o.status !== "completed" &&
          o.status !== "cancelled" &&
          o.status !== "voided" &&
          o.payment_status !== "paid" &&
          o.payment_status !== "refunded" &&
          o.payment_status !== "voided"
      );
    },
    [runningTableOrders]
  );

  const activeRunningOrder = getTableActiveOrder(selectedTableObj);

  // Table selection with automated running tab recall
  const handleSelectTable = (tableId: number, explicitRecall = true) => {
    getOrRecoverActiveShift();
    setSelectedTable(tableId);
    const targetTable = tables.find((t) => t.id === tableId);
    if (!targetTable) return;

    const isOccupied =
      targetTable.status === "seated" ||
      targetTable.status === "occupied" ||
      targetTable.status === "billing";

    if (isOccupied && explicitRecall) {
      const runningOrder = getTableActiveOrder(targetTable);
      if (runningOrder && runningOrder.items && runningOrder.items.length > 0) {
        const recalledCart: CartItem[] = runningOrder.items.map((it) => {
          const menuItem: MenuItem =
            menuItems.find(
              (m) => m.id === it.id || m.name.toLowerCase() === it.name.toLowerCase()
            ) || {
              id: it.id,
              name: it.name,
              price: it.price,
              category: "Dine-In",
              prepTime: it.prepTime || "15m",
              preparation_time: it.preparation_time || 15,
              stockStatus: "in_stock",
              stockCount: 99,
              imageIcon: "🍽️",
              is_available: true,
            };
          return {
            item: menuItem,
            quantity: it.quantity,
            notes: it.notes,
          };
        });
        setCart(recalledCart);
        setInventoryTick((prev) => prev + 1);
        playPosSound("chime");
        showToast(
          `Recalled tab for ${targetTable.label} (Rs ${runningOrder.total.toLocaleString()}).`
        );
      }
    }
  };

  // Cart operations
  const handleAddToCart = (item: MenuItem, notes?: string) => {
    getOrRecoverActiveShift();

    // Determine actual live stock availability for this item or variant
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

    const cleanNotes = notes?.trim() || undefined;
    let limitReached = false;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.item.id === item.id && (c.notes || undefined) === cleanNotes
      );
      if (existingIndex !== -1) {
        const currentQty = prev[existingIndex].quantity;
        if (currentQty >= itemStock.maxPortions) {
          limitReached = true;
          return prev;
        }
        return prev.map((c, idx) =>
          idx === existingIndex
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { item, quantity: 1, notes: cleanNotes, selectedVariant: item.selectedVariant }];
    });

    if (limitReached) {
      playPosSound("buzz");
      showToast(`Insufficient stock available: Cannot add more "${item.name}". Only ${itemStock.maxPortions} available.`);
      return;
    }

    playPosSound("chirp");
    setInventoryTick((prev) => prev + 1);
  };

  const handleUpdateCartQty = (itemId: string, delta: number, notes?: string) => {
    setCart((prev) => {
      const cleanNotes = notes?.trim() || undefined;
      const targetIndex = prev.findIndex(
        (c) => c.item.id === itemId && (c.notes || undefined) === cleanNotes
      );
      const matchIndex = targetIndex !== -1 ? targetIndex : prev.findIndex((c) => c.item.id === itemId);
      if (matchIndex === -1) return prev;

      const target = prev[matchIndex];
      if (target.quantity + delta <= 0) {
        return prev.filter((_, idx) => idx !== matchIndex);
      }

      // If increasing quantity, ensure sufficient raw material stock is available
      if (delta > 0) {
        const variantObj = target.item.selectedVariant;
        const itemStock = variantObj
          ? getVariantPortions(target.item, variantObj)
          : getVariantPortions(target.item);
        if (itemStock.isOutOfStock || itemStock.maxPortions <= 0 || target.quantity >= itemStock.maxPortions) {
          playPosSound("buzz");
          showToast(`Insufficient stock available: Cannot add more "${target.item.name}". Only ${itemStock.maxPortions} available.`);
          return prev;
        }
      }

      return prev.map((c, idx) =>
        idx === matchIndex ? { ...c, quantity: c.quantity + delta } : c
      );
    });
    setInventoryTick((prev) => prev + 1);
  };

  // Bill Calculations
  const cartItemCount = useMemo(
    () => cart.reduce((acc, curr) => acc + curr.quantity, 0),
    [cart]
  );
  const cartSubtotal = useMemo(
    () => cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0),
    [cart]
  );
  const discountAmount = useMemo(
    () =>
      discountMode === "percent"
        ? Math.round((cartSubtotal * discountPercent) / 100)
        : Math.min(cartSubtotal, flatDiscount),
    [cartSubtotal, discountPercent, discountMode, flatDiscount]
  );
  const discountedSubtotal = Math.max(0, cartSubtotal - discountAmount);
  const taxAmount = useMemo(
    () => Math.round((discountedSubtotal * taxRatePercent) / 100),
    [discountedSubtotal, taxRatePercent]
  );
  const cartTotal = discountedSubtotal + taxAmount;

  // Filtered menu items (derived from live simulated menu with cart deductions applied)
  const filteredMenuItems = useMemo(() => {
    return liveSimulatedMenuItems.filter((item) => {
      const isItemFeatured = Boolean(
        item.isPopular ||
        (item as any).isFeatured ||
        (item as any).is_popular ||
        (item as any).is_featured
      );
      const matchCat =
        selectedCategory === "all" ||
        (selectedCategory === "featured" && isItemFeatured) ||
        (item.category || "").toLowerCase() === selectedCategory.toLowerCase();
      const matchQuery =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ((searchQuery.toLowerCase().includes("feat") ||
          searchQuery.toLowerCase().includes("best") ||
          searchQuery.toLowerCase().includes("pop")) &&
          isItemFeatured);
      return matchCat && matchQuery;
    });
  }, [liveSimulatedMenuItems, selectedCategory, searchQuery, inventoryTick]);

  // Send KOT to Kitchen
  const handleSendToKitchen = async () => {
    if (isSendingKotRef.current) return;
    getOrRecoverActiveShift();
    if (!enableKitchenKds) {
      showToast("Pure POS Mode: Kitchen KDS is disabled for this tenant.");
      return;
    }
    if (cart.length === 0) {
      playPosSound("buzz");
      showToast("Please add items to cart before sending KOT.");
      return;
    }

    isSendingKotRef.current = true;
    try {
      if (orderChannel === "delivery") {
      if (!customerName.trim()) {
        playPosSound("buzz");
        showToast("Customer name is required for delivery orders.");
        return;
      }
      if (!customerPhone.trim()) {
        playPosSound("buzz");
        showToast("Phone number is required for delivery orders.");
        return;
      }
      if (!deliveryZone.trim()) {
        playPosSound("buzz");
        showToast("Delivery destination area / address is required.");
        return;
      }
    }

    const matchedTable = tables.find((t) => t.id === selectedTable);
    const tableIdentifier = matchedTable?.label || `Table ${selectedTable}`;

    // 0. Strict Table Occupied Lock: Prevent duplicate orders on already occupied tables
    if (orderChannel === "dine_in") {
      const isTableOccupied = Boolean(
        matchedTable &&
        (matchedTable.status === "seated" ||
          matchedTable.status === "occupied" ||
          matchedTable.status === "billing")
      );
      const isAmendingActiveTab = Boolean(
        targetOrderForSettlement &&
        runningTableOrders.some(
          (ro) => ro.tableId === selectedTable && (ro.id === targetOrderForSettlement?.id || ro.kotId === targetOrderForSettlement?.kotId)
        )
      );
      if (isTableOccupied && !isAmendingActiveTab) {
        playPosSound("buzz");
        showToast(`❌ Cannot place duplicate order: ${tableIdentifier} is currently OCCUPIED with an active order. Settle payment or reload existing tab.`);
        isSendingKotRef.current = false;
        return;
      }
    }

    const newKotId = `KOT-${Math.floor(1000 + Math.random() * 9000)}`;
    const dishPrepTimes = cart.map(
      (c) =>
        c.item.preparation_time ||
        parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
        15
    );
    const orderEstimatedPrepTime = Math.max(...dishPrepTimes, 15);

    const kitchenTicket: KitchenTicket = {
      id: newKotId,
      tableOrChannel:
        orderChannel === "dine_in"
          ? tableIdentifier
          : orderChannel === "takeaway"
            ? "Takeaway Counter"
            : `Delivery: ${customerName || "Customer"}${deliveryZone ? ` (${deliveryZone})` : ""}`,
      orderType: orderChannel,
      serverName: user?.name || "Terminal Cashier",
      elapsedMinutes: 0,
      status: "queued",
      estimatedPrepTime: orderEstimatedPrepTime,
      estimated_prep_time: orderEstimatedPrepTime,
      items: cart.map((c) => {
        const variantObj = c.selectedVariant || c.item.selectedVariant;
        return {
          id: c.item.id,
          name: c.item.name,
          category: c.item.category || (c.item as any).category_name || "General",
          qty: c.quantity,
          notes: c.notes || "",
          modifiers: variantObj ? [variantObj.name] : (c.selectedVariant ? [c.selectedVariant.name] : []),
          prepTime: c.item.prepTime || "15m",
          preparation_time: c.item.preparation_time || 15,
          selectedVariant: variantObj,
          variant: variantObj,
          variant_id: variantObj?.id || null,
          variant_name: variantObj?.name || null,
        };
      }),
      items_status: cart.map((c, idx) => {
        const variantObj = c.selectedVariant || c.item.selectedVariant;
        const dishPrep =
          c.item.preparation_time ||
          parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
          15;
        const notes = c.notes?.trim() || "";
        const modStr = variantObj ? variantObj.name : "";
        const combinedNotes = [notes, modStr ? `Variant: ${modStr}` : ""].filter(Boolean).join(" • ");

        return {
          item_id: c.item.id || `${newKotId}-item-${idx}`,
          name: c.item.name,
          quantity: c.quantity,
          status: "waiting" as const,
          started_at: null,
          completed_at: null,
          prep_time_minutes: dishPrep,
          notes: combinedNotes || undefined,
        };
      }),
      priority: orderChannel === "delivery" ? "urgent" : "normal",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      created_at: new Date().toISOString(),
      isDeducted: false,
    };

    // Determine active order number
    const resolvedOrderId =
      orderChannel === "dine_in" && activeRunningOrder?.id
        ? activeRunningOrder.id
        : `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const posRestId = (user as any)?.restaurant_id || (user as any)?.restaurantId || (user as any)?.organizationId || 1;
    const posBranchId = user?.branchId || (user as any)?.branch_id || null;

    const splitResult = splitOrderIntoStationTickets({
      orderId: resolvedOrderId,
      baseKotId: newKotId,
      cart,
      orderChannel,
      tableIdentifier,
      serverName: user?.name || "Terminal Cashier",
      priority: orderChannel === "delivery" ? "urgent" : "normal",
      customerName: orderChannel === "delivery" ? customerName.trim() || "Delivery Customer" : tableIdentifier,
      customerPhone: orderChannel === "delivery" ? customerPhone.trim() || undefined : undefined,
      deliveryZone: orderChannel === "delivery" ? deliveryZone.trim() || undefined : undefined,
      restaurantId: posRestId,
      branchId: posBranchId,
    });

    const primaryTicket = splitResult.tickets[0] || kitchenTicket;

    // Save tickets locally
    const currentTickets = getStoredKdsTickets(currentOrgId, []);
    saveStoredKdsTickets(currentOrgId, [...splitResult.tickets, ...currentTickets]);

    // Update active order record
    const activeOrder: OrderRecord = {
      id: resolvedOrderId,
      kotId: newKotId,
      orderChannel,
      delivery_zone: orderChannel === "delivery" ? deliveryZone.trim() || undefined : undefined,
      customerName: orderChannel === "delivery" ? customerName.trim() || "Delivery Customer" : undefined,
      customerPhone: orderChannel === "delivery" ? customerPhone.trim() || undefined : undefined,
      tableId: orderChannel === "dine_in" ? selectedTable : undefined,
      tableName:
        orderChannel === "dine_in"
          ? tableIdentifier
          : orderChannel === "delivery"
            ? customerName || "Delivery"
            : undefined,
      items: cart.map((c) => {
        const variantObj = c.selectedVariant || c.item.selectedVariant;
        return {
          id: c.item.id,
          name: c.item.name,
          price: variantObj?.price ?? c.item.price,
          quantity: c.quantity,
          notes: c.notes,
          prepTime: c.item.prepTime || "15m",
          preparation_time: c.item.preparation_time || 15,
          selectedVariant: variantObj,
          variant: variantObj,
          variant_id: variantObj?.id || null,
          variant_name: variantObj?.name || null,
        };
      }),
      estimatedPrepTime: orderEstimatedPrepTime,
      estimated_prep_time: orderEstimatedPrepTime,
      subtotal: cartSubtotal,
      taxAmount,
      discountPercent,
      discountAmount,
      total: cartTotal,
      paymentMethod,
      cashierName: user?.name || "Terminal Cashier",
      timestamp: new Date().toLocaleString(),
      status: "active",
      payment_status: "pending",
    };

    // Store separately in running table orders / kitchen queues without polluting shift invoices
    setRunningTableOrders((prev) => {
      const updated = [
        activeOrder,
        ...prev.filter(
          (o) =>
            o.id !== activeOrder.id &&
            (activeOrder.tableId === undefined || o.tableId !== activeOrder.tableId)
        ),
      ];
      try {
        localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(updated));
      } catch { }
      return updated;
    });

    // If dine-in, mark table occupied in state and Supabase
    if (orderChannel === "dine_in") {
      const updatedTables = tables.map((t) =>
        t.id === selectedTable
          ? {
              ...t,
              status: "seated" as const,
              activeOrderId: resolvedOrderId,
              activeAmount: cartTotal,
            }
          : t
      );
      setTables(updatedTables);
      saveStoredTables(currentOrgId, updatedTables);

      (async () => {
        try {
          const supabase = createClient();
          const { restId } = await getValidTenantContext(user);
          const targetTable = tables.find((t) => t.id === selectedTable);
          const tableUpdatePayload: Record<string, any> = {
            status: "occupied",
          };
          if (targetTable?.dbId) {
            await supabase
              .from("restaurant_tables")
              .update(tableUpdatePayload)
              .eq("restaurant_id", restId)
              .eq("id", targetTable.dbId);
          } else if (targetTable?.label) {
            await supabase
              .from("restaurant_tables")
              .update(tableUpdatePayload)
              .eq("restaurant_id", restId)
              .eq("table_number", targetTable.label);
          }
          window.dispatchEvent(new CustomEvent("restaurant_tables_changed"));
          window.dispatchEvent(new CustomEvent("pos_tables_updated"));
          broadcastTerminalMutation(restId, {
            type: "TABLE_MUTATION",
            tableId: targetTable?.dbId || selectedTable,
            tableNumber: targetTable?.label || tableIdentifier,
            orderId: resolvedOrderId,
            status: "occupied",
          });
          localStorage.setItem(`omni_tables_trigger_${currentOrgId}`, String(Date.now()));
          window.dispatchEvent(new Event("storage"));
        } catch { }
      })();
    }

    // Immediate inventory stock deduction upon POS KOT dispatch
    (async () => {
      try {
        const { restId } = await getValidTenantContext(user);
        await deductInventoryStockForOrder(restId, activeOrder.items, {
          orderId: resolvedOrderId,
          kotId: newKotId,
          source: "pos_terminal",
        });
        notifyInventoryStockDeducted(currentOrgId);
        fetchLiveMenuCatalog();
      } catch (stkErr) {
        console.warn("[PosTerminal] KOT inventory stock deduction error:", stkErr);
      }
    })();

    // Persist KOT / Active order to Supabase orders table
    (async () => {
      try {
        const supabase = createClient();
        const { restId, branchId } = await getValidTenantContext(user);
        const targetTable = tables.find((t) => t.id === selectedTable);
        const isTargetTableUuid =
          Boolean(targetTable?.dbId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetTable.dbId)));

        const customerDisplayName =
          orderChannel === "delivery"
            ? customerName.trim() || "Delivery Customer"
            : orderChannel === "dine_in"
              ? tableIdentifier
              : customerName.trim() || "Walk-in Guest";

        const orderPayload: any = {
          restaurant_id: restId,
          branch_id: branchId || user?.branchId || null,
          order_number: resolvedOrderId,
          kot_id: newKotId,
          order_channel: orderChannel,
          table_id: orderChannel === "dine_in" && isTargetTableUuid ? targetTable?.dbId : null,
          customer_name: customerDisplayName,
          customer_phone: customerPhone?.trim() || null,
          subtotal: cartSubtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total_amount: cartTotal,
          payment_method: paymentMethod || "cash",
          payment_status: "pending",
          order_status: "active",
          is_deducted: true,
          items: activeOrder.items.map((it: any) => ({ ...it, is_deducted: true })),
          cashier_name: user?.name || "Terminal Cashier",
          estimated_prep_time: orderEstimatedPrepTime,
          created_at: new Date().toISOString(),
        };

        if (activeShift?.id) {
          orderPayload.shift_id = !isNaN(Number(activeShift.id)) ? Number(activeShift.id) : activeShift.id;
        }

        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("restaurant_id", restId)
          .eq("order_number", resolvedOrderId)
          .maybeSingle();

        if (existing) {
          const { error: updErr } = await supabase.from("orders").update(orderPayload).eq("id", existing.id);
          if (updErr && (updErr.code === "PGRST204" || updErr.code === "42703" || updErr.message?.includes("shift_id") || updErr.message?.includes("is_deducted") || String(updErr.details || "").includes("shift_id") || String(updErr.details || "").includes("is_deducted"))) {
            delete orderPayload.shift_id;
            delete orderPayload.is_deducted;
            await supabase.from("orders").update(orderPayload).eq("id", existing.id);
          }
        } else {
          const { error: insErr } = await supabase.from("orders").insert([orderPayload]);
          if (insErr && (insErr.code === "PGRST204" || insErr.code === "42703" || insErr.message?.includes("shift_id") || insErr.message?.includes("is_deducted") || String(insErr.details || "").includes("shift_id") || String(insErr.details || "").includes("is_deducted"))) {
            delete orderPayload.shift_id;
            delete orderPayload.is_deducted;
            await supabase.from("orders").insert([orderPayload]);
          }
        }

        // Persist split KOT tickets to Supabase kitchen_tickets table for real-time KDS synchronization
        try {
          for (const ticketPayload of splitResult.payloads) {
            const { error: kotErr } = await supabase.from("kitchen_tickets").insert([ticketPayload]);
            if (kotErr) {
              console.warn("[PosTerminal] kitchen_tickets insert warning:", kotErr.message || kotErr);
            }
          }
        } catch (kotInsErr) {
          console.warn("[PosTerminal] Exception inserting into kitchen_tickets:", kotInsErr);
        }

        // Global Live Stock Invalidation Broadcast across all open terminals via restaurant_${restId}_feed
        broadcastStockRefresh(restId, { orderId: resolvedOrderId, kotId: newKotId, source: "pos_send_kot" });

        // Staged Inventory Sync: Broadcast active order for instant reservation across Orders Hub & terminals
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new CustomEvent("orders_updated", {
              detail: { restaurantId: restId, orderId: resolvedOrderId, kotId: newKotId, timestamp: Date.now() },
            }));
            broadcastTerminalMutation(restId, {
              type: "ORDER_MUTATION",
              orderId: resolvedOrderId,
              tableId: targetTable?.dbId || selectedTable,
              tableNumber: targetTable?.label || tableIdentifier,
              status: "active",
            });
            localStorage.setItem(`pos_orders_${currentOrgId}`, String(Date.now()));
            localStorage.setItem(`pos_running_kot_orders_trigger_${currentOrgId}`, String(Date.now()));
            window.dispatchEvent(new Event("storage"));
          } catch { }
        }
        setInventoryTick((c) => c + 1);
      } catch (kotDbErr) {
        console.warn("[PosTerminal] Error persisting KOT order to database:", kotDbErr);
      }
    })();

    playPosSound("chime");
    if (splitResult.stationCount > 1) {
      const stationNames = splitResult.distinctStations
        .map((s) => s.toUpperCase().replace(/_/g, " "))
        .join(", ");
      showToast(`Order split across ${splitResult.stationCount} stations (${stationNames}).`);
    } else {
      showToast(`Order dispatched to kitchen (${newKotId}).`);
    }
    setActiveKotTicket(primaryTicket);
    } finally {
      setTimeout(() => {
        isSendingKotRef.current = false;
      }, 1000);
    }
  };

  // Hold / Park Order
  const handleHoldOrder = () => {
    getOrRecoverActiveShift();
    if (cart.length === 0) return;
    if (orderChannel === "delivery") {
      if (!customerName.trim()) {
        playPosSound("buzz");
        showToast("Customer name is required for delivery orders.");
        return;
      }
      if (!customerPhone.trim()) {
        playPosSound("buzz");
        showToast("Phone number is required for delivery orders.");
        return;
      }
      if (!deliveryZone.trim()) {
        playPosSound("buzz");
        showToast("Delivery destination area / address is required.");
        return;
      }
    }

    const parkedItem: ParkedOrder = {
      id: `#HOLD-${Math.floor(100 + Math.random() * 900)}`,
      cart,
      orderChannel,
      selectedTable: orderChannel === "dine_in" ? selectedTable : undefined,
      customerName,
      customerPhone,
      deliveryZone,
      total: cartTotal,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    saveParkedOrders([parkedItem, ...parkedOrders]);

    // Persist held order to Supabase orders table
    (async () => {
      try {
        const supabase = createClient();
        const { restId, branchId } = await getValidTenantContext(user);
        const targetTable = tables.find((t) => t.id === selectedTable);
        const isTargetTableUuid =
          Boolean(targetTable?.dbId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetTable.dbId)));

        const subtotalVal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
        const taxVal = Math.max(0, cartTotal - subtotalVal);

        const heldPayload: any = {
          restaurant_id: restId,
          branch_id: branchId || user?.branchId || null,
          order_number: parkedItem.id,
          order_channel: orderChannel,
          table_id: orderChannel === "dine_in" && isTargetTableUuid ? targetTable?.dbId : null,
          customer_name: customerName?.trim() || (orderChannel === "dine_in" && selectedTable ? `Table ${selectedTable} (Held)` : "Held Order"),
          customer_phone: customerPhone?.trim() || null,
          subtotal: subtotalVal,
          tax_amount: taxVal,
          discount_amount: 0,
          total_amount: cartTotal,
          payment_method: "cash",
          payment_status: "pending",
          order_status: "active",
          items: cart.map((c) => {
            const variantObj = c.selectedVariant || c.item.selectedVariant;
            return {
              id: c.item.id,
              name: c.item.name,
              price: variantObj?.price ?? c.item.price,
              quantity: c.quantity,
              notes: c.notes,
              selectedVariant: variantObj,
              variant: variantObj,
              variant_id: variantObj?.id || null,
              variant_name: variantObj?.name || null,
            };
          }),
          cashier_name: user?.name || "Terminal Cashier",
          created_at: new Date().toISOString(),
        };

        if (activeShift?.id) {
          heldPayload.shift_id = !isNaN(Number(activeShift.id)) ? Number(activeShift.id) : activeShift.id;
        }

        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("restaurant_id", restId)
          .eq("order_number", parkedItem.id)
          .maybeSingle();

        if (existing) {
          const { error: updErr } = await supabase.from("orders").update(heldPayload).eq("id", existing.id);
          if (updErr && (updErr.code === "PGRST204" || updErr.code === "42703" || updErr.message?.includes("shift_id") || String(updErr.details || "").includes("shift_id"))) {
            delete heldPayload.shift_id;
            await supabase.from("orders").update(heldPayload).eq("id", existing.id);
          }
        } else {
          const { error: insErr } = await supabase.from("orders").insert([heldPayload]);
          if (insErr && (insErr.code === "PGRST204" || insErr.code === "42703" || insErr.message?.includes("shift_id") || String(insErr.details || "").includes("shift_id"))) {
            delete heldPayload.shift_id;
            await supabase.from("orders").insert([heldPayload]);
          }
        }
        broadcastStockRefresh(restId, { orderId: parkedItem.id, source: "pos_park_order" });
      } catch (err) {
        console.warn("[PosTerminal] Error saving held order to Supabase:", err);
      }
    })();

    setCart([]);
    setInventoryTick((prev) => prev + 1);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryZone("");
    playPosSound("chirp");
    showToast(`Order ${parkedItem.id} parked on hold.`);
  };

  const handleRecallParkedOrder = (parked: ParkedOrder) => {
    setCart(parked.cart);
    setInventoryTick((prev) => prev + 1);
    setOrderChannel(parked.orderChannel);
    if (parked.selectedTable) setSelectedTable(parked.selectedTable);
    if (parked.customerName) setCustomerName(parked.customerName);
    if (parked.customerPhone) setCustomerPhone(parked.customerPhone);
    if (parked.deliveryZone) setDeliveryZone(parked.deliveryZone);

    saveParkedOrders(parkedOrders.filter((p) => p.id !== parked.id));
    setCurrentView("register");
    playPosSound("chime");
    showToast(`Recalled held order ${parked.id} to active ticket.`);
  };

  const handleDiscardParkedOrder = (orderId: string) => {
    const parked = parkedOrders.find((p) => p.id === orderId);
    const voidTotal = parked
      ? parked.cart.reduce(
          (s, c) => s + (c.selectedVariant?.price ?? c.item?.price ?? 0) * (c.quantity || 1),
          0
        )
      : 0;
    saveParkedOrders(parkedOrders.filter((p) => p.id !== orderId));
    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        await supabase
          .from("orders")
          .update({ order_status: "cancelled" })
          .eq("restaurant_id", restId)
          .eq("order_number", orderId);
        broadcastStockRefresh(restId, { orderId, source: "pos_void_order" });
      } catch { }
    })();

    dispatchOrderCancelledAlert(currentOrgId, {
      orderNumber: orderId,
      cashierName: user?.name || "Cashier",
      totalAmount: voidTotal,
      reason: "Discarded Held / Parked Ticket",
      itemCount: parked?.cart?.length,
      branchName: user?.branchName || "Counter POS",
    });

    showToast(`Discarded held order ${orderId}.`);
  };

  // Confirm payment settlement & persist to Supabase
  const handleConfirmSettlement = async (paymentDetails: {
    method: "cash" | "card" | "raast" | "split";
    tenderedAmount: number;
    changeAmount: number;
    splitBreakdown?: { cash: number; card: number };
  }) => {
    if (isSettlingOrderRef.current) return;
    isSettlingOrderRef.current = true;
    try {
    const target = targetOrderForSettlement;
    const isTargetSettlement = Boolean(target);

    const resolvedOrderChannel = target ? (target.orderChannel as any) : orderChannel;
    const resolvedTableId = target ? target.tableId : (orderChannel === "dine_in" ? selectedTable : undefined);
    const resolvedSubtotal = target ? target.subtotal : cartSubtotal;
    const resolvedTaxAmount = target ? target.taxAmount : taxAmount;
    const resolvedDiscountAmount = target ? target.discountAmount : discountAmount;
    const resolvedDiscountPercent = target ? (target.discountPercent || 0) : discountPercent;
    const resolvedTotal = target ? target.total : cartTotal;
    const resolvedCustomerName = target ? (target.customerName || "") : customerName;
    const resolvedCustomerPhone = target ? (target.customerPhone || "") : customerPhone;
    const resolvedDeliveryZone = target ? (target.deliveryZone || "") : deliveryZone;
    const resolvedKotId = target ? target.kotId : activeRunningOrder?.kotId;

    const resolvedOrderId = target
      ? target.id
      : orderChannel === "dine_in" && activeRunningOrder?.id
        ? activeRunningOrder.id
        : `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    const resolvedItems = target
      ? target.items.map((it: any) => {
          const variantObj = it.selectedVariant || it.variant;
          return {
            id: it.id || "",
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            notes: it.notes,
            prepTime: "15m",
            preparation_time: 15,
            selectedVariant: variantObj,
            variant: variantObj,
            variant_id: it.variant_id || variantObj?.id || null,
            variant_name: it.variant_name || variantObj?.name || null,
          };
        })
      : cart.map((c) => {
          const variantObj = c.selectedVariant || c.item.selectedVariant;
          return {
            id: c.item.id,
            name: c.item.name,
            price: variantObj?.price ?? c.item.price,
            quantity: c.quantity,
            notes: c.notes,
            prepTime: c.item.prepTime || "15m",
            preparation_time: c.item.preparation_time || 15,
            selectedVariant: variantObj,
            variant: variantObj,
            variant_id: variantObj?.id || null,
            variant_name: variantObj?.name || null,
          };
        });

    let finalOrderId = resolvedOrderId;
    const targetTable = tables.find(
      (t) =>
        (resolvedTableId && t.id === resolvedTableId) ||
        (target && isTableMatchingIdentifier(t, target.tableName)) ||
        (target && isTableMatchingIdentifier(t, target.tableId)) ||
        (target && isTableMatchingIdentifier(t, target.customerName)) ||
        (orderChannel === "dine_in" && t.id === selectedTable)
    );
    const finalTableId = targetTable?.id ?? resolvedTableId;
    const isTableRelatedSettlement =
      resolvedOrderChannel === "dine_in" ||
      String(resolvedOrderChannel || "").toLowerCase().includes("dine") ||
      Boolean(target?.tableName) ||
      Boolean(target?.tableId) ||
      Boolean(targetTable) ||
      Boolean(resolvedTableId);
    let activeRestId: string | number = user?.restaurantId || "";

    // 1. Direct Supabase Persistence (orders & order_items)
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      if (restId) activeRestId = restId;
      const isTargetTableUuid =
        Boolean(targetTable?.dbId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetTable.dbId)));

      const customerDisplayName =
        resolvedOrderChannel === "delivery"
          ? resolvedCustomerName.trim() || "Delivery Customer"
          : resolvedOrderChannel === "dine_in"
            ? (target?.tableName || targetTable?.label || `Table ${resolvedTableId}`)
            : resolvedCustomerName.trim() || "Walk-in Guest";

      const normalizedPaymentMethod =
        paymentDetails.method === "card"
          ? "card"
          : paymentDetails.method === "raast"
            ? "raast"
            : "cash";

      const orderPayload: any = {
        restaurant_id: restId,
        branch_id: branchId || user?.branchId || null,
        order_number: resolvedOrderId,
        order_channel: resolvedOrderChannel,
        table_id: resolvedOrderChannel === "dine_in" && isTargetTableUuid ? targetTable?.dbId : null,
        customer_name: customerDisplayName,
        customer_phone: resolvedCustomerPhone?.trim() || null,
        subtotal: resolvedSubtotal,
        tax_amount: resolvedTaxAmount,
        discount_amount: resolvedDiscountAmount,
        total_amount: resolvedTotal,
        payment_method: normalizedPaymentMethod,
        payment_status: "paid",
        order_status: "completed",
        is_deducted: true,
        items: resolvedItems.map((c: any) => ({
          id: c.id,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          notes: c.notes,
          prepTime: c.prepTime || "15m",
          selectedVariant: c.selectedVariant || c.variant,
          variant: c.variant || c.selectedVariant,
          variant_id: c.variant_id || c.selectedVariant?.id || null,
          variant_name: c.variant_name || c.selectedVariant?.name || null,
          is_deducted: true,
        })),
        created_at: new Date().toISOString(),
      };

      if (!embedded && activeShift?.id && !isNaN(Number(activeShift.id))) {
        orderPayload.shift_id = Number(activeShift.id);
      }

      // Check if order already exists in Supabase (e.g. dispatched to KOT or Held)
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, order_number, is_deducted, items")
        .eq("restaurant_id", restId)
        .eq("order_number", resolvedOrderId)
        .maybeSingle();

      let createdOrder: any = null;
      let orderErr: any = null;

      if (existingOrder) {
        const updateRes = await supabase
          .from("orders")
          .update(orderPayload)
          .eq("id", existingOrder.id)
          .select("id, order_number")
          .maybeSingle();
        createdOrder = updateRes.data || existingOrder;
        orderErr = updateRes.error;

        if (orderErr && (orderErr.code === "PGRST204" || orderErr.code === "42703" || orderErr.message?.includes("shift_id") || orderErr.message?.includes("is_deducted") || String(orderErr.details || "").includes("shift_id") || String(orderErr.details || "").includes("is_deducted"))) {
          delete orderPayload.shift_id;
          delete orderPayload.is_deducted;
          const retryUpdate = await supabase
            .from("orders")
            .update(orderPayload)
            .eq("id", existingOrder.id)
            .select("id, order_number")
            .maybeSingle();
          createdOrder = retryUpdate.data || existingOrder;
          orderErr = retryUpdate.error;
        }
      } else {
        const insertRes = await supabase
          .from("orders")
          .insert([orderPayload])
          .select("id, order_number")
          .maybeSingle();
        createdOrder = insertRes.data;
        orderErr = insertRes.error;

        // Retry without shift_id or is_deducted if column does not exist or fails
        if (orderErr && (orderErr.code === "PGRST204" || orderErr.code === "42703" || orderErr.message?.includes("shift_id") || orderErr.message?.includes("is_deducted") || String(orderErr.details || "").includes("shift_id") || String(orderErr.details || "").includes("is_deducted"))) {
          delete orderPayload.shift_id;
          delete orderPayload.is_deducted;
          const retry = await supabase
            .from("orders")
            .insert([orderPayload])
            .select("id, order_number")
            .maybeSingle();
          createdOrder = retry.data;
          orderErr = retry.error;
        }

        // Retry minimal payload if still failing
        if (orderErr) {
          console.warn("[PosTerminal] Retrying with minimal order payload due to:", orderErr.message || orderErr.details || orderErr);
          const fallbackPayload: any = {
            restaurant_id: restId,
            order_number: resolvedOrderId,
            order_channel: resolvedOrderChannel,
            customer_name: customerDisplayName,
            subtotal: resolvedSubtotal,
            tax_amount: resolvedTaxAmount,
            discount_amount: resolvedDiscountAmount,
            total_amount: resolvedTotal,
            payment_method: normalizedPaymentMethod,
            payment_status: "paid",
            order_status: "completed",
            items: orderPayload.items,
          };
          const fallbackRetry = await supabase
            .from("orders")
            .insert([fallbackPayload])
            .select("id, order_number")
            .maybeSingle();
          createdOrder = fallbackRetry.data;
          orderErr = fallbackRetry.error;
        }
      }

      if (orderErr) {
        console.error(
          "[PosTerminal] Supabase order insert error:",
          orderErr.message || orderErr.details || orderErr.hint || orderErr.code || JSON.stringify(orderErr),
          orderErr
        );
      } else if (createdOrder) {
        finalOrderId = createdOrder.order_number || createdOrder.id;

        // 2. Insert into public.order_items
        if (resolvedItems.length > 0) {
          const itemsPayload = resolvedItems.map((c) => {
            const isMenuUuid =
              Boolean(c.id &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(c.id)));
            return {
              order_id: createdOrder.id,
              menu_item_id: isMenuUuid ? c.id : null,
              item_name: c.name,
              quantity: c.quantity,
              unit_price: c.price,
              total_price: c.price * c.quantity,
              notes: c.notes || null,
            };
          });

          const { error: itemsErr } = await supabase
            .from("order_items")
            .insert(itemsPayload);

          if (itemsErr) {
            console.warn("[PosTerminal] order_items insert warning:", itemsErr.message || itemsErr);
          }
        }
      }

      // 3. Release table if Dine-In / Table Order: Atomic table release on settlement
      if (isTableRelatedSettlement) {
        const tableIdentifier = target?.tableName || selectedTableObj?.label || targetTable?.label || `Table ${resolvedTableId}`;
        const normNum = normalizeTableNumber(tableIdentifier);
        try {
          const releasePayload = {
            status: "available",
            active_order_id: null,
            current_order_id: null,
            updated_at: new Date().toISOString(),
          };

          let tableId = targetTable?.dbId;
          if (!tableId && target?.tableId && isUuid(String(target.tableId))) {
            tableId = String(target.tableId);
          }

          // Direct ID update if table ID is known
          if (tableId) {
            await supabase
              .from("restaurant_tables")
              .update(releasePayload)
              .eq("id", tableId);
          }

          // Also query all restaurant tables to release by label / table_number
          const { data: restTables } = await supabase
            .from("restaurant_tables")
            .select("id, table_number")
            .eq("restaurant_id", restId);

          if (restTables && Array.isArray(restTables)) {
            const matchedRows = restTables.filter((row: any) =>
              (tableId && row.id === tableId) ||
              (target?.tableId && (row.id === target.tableId || String(row.id) === String(target.tableId))) ||
              (tableIdentifier && (row.table_number === tableIdentifier || normalizeTableNumber(row.table_number) === normNum)) ||
              (normNum && normalizeTableNumber(row.table_number) === normNum)
            );

            for (const r of matchedRows) {
              await supabase
                .from("restaurant_tables")
                .update(releasePayload)
                .eq("id", r.id);
            }
          }

          // Complete any active kitchen tickets for this settled table so it frees cleanly across terminals
          try {
            let kotCloseQuery: any = supabase
              .from("kitchen_tickets")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
              })
              .eq("restaurant_id", restId)
              .neq("status", "completed")
              .neq("status", "cancelled");

            const kotOrConds = [
              resolvedKotId ? `ticket_number.eq.${resolvedKotId}` : "",
              `table_number.eq.${tableIdentifier}`,
              normNum ? `table_number.eq.${normNum}` : "",
              normNum ? `table_number.eq.Table ${normNum}` : "",
            ].filter(Boolean).join(",");

            kotCloseQuery = kotCloseQuery.or(kotOrConds);
            await kotCloseQuery;
          } catch (kErr) {
            console.warn("[PosTerminal] Kitchen ticket close upon payment warning:", kErr);
          }

          // Broadcast clean TABLE_RELEASED event via Realtime/BroadcastChannel
          broadcastTableReleased(
            restId,
            {
              tableId: tableId || finalTableId,
              tableNumber: tableIdentifier,
              orderId: finalOrderId,
            },
            supabase
          );
        } catch (tableRelErr) {
          console.warn("[PosTerminal] Table release error:", tableRelErr);
        }
      }

      // Inventory Stock Deduction: Deduct upon successful payment settlement strictly if NOT already deducted via KOT
      const orderAlreadyDeducted =
        isOrderAlreadyDeducted(restId, finalOrderId, resolvedKotId) ||
        Boolean(existingOrder && (existingOrder as any).is_deducted === true) ||
        (Array.isArray(existingOrder?.items) &&
          existingOrder.items.some((it: any) => it.is_deducted === true || it.isDeducted === true)) ||
        (Array.isArray(resolvedItems) &&
          resolvedItems.some((it: any) => it.is_deducted === true || it.isDeducted === true));

      if (!orderAlreadyDeducted) {
        await deductInventoryStockForOrder(restId, resolvedItems, { orderId: finalOrderId, kotId: resolvedKotId, source: "pos_settlement" });
        notifyInventoryStockDeducted(currentOrgId);
        broadcastStockRefresh(restId, { orderId: finalOrderId, source: "pos_settlement" });
        await fetchLiveMenuCatalog();
      } else {
        console.log(`[PosTerminal] Order ${finalOrderId} (${resolvedKotId}) already deducted at KOT stage. Bypassing checkout duplicate deduction.`);
      }

      window.dispatchEvent(new CustomEvent("orders_updated", { detail: { restaurantId: restId, orderId: finalOrderId, timestamp: Date.now() } }));
      localStorage.setItem(`pos_orders_${currentOrgId}`, String(Date.now()));
      window.dispatchEvent(new Event("storage"));
    } catch (dbErr) {
      console.error("[PosTerminal] Database settlement exception:", dbErr);
    }

    const settledOrder: OrderRecord = {
      id: finalOrderId,
      kotId: resolvedKotId,
      orderChannel: resolvedOrderChannel,
      delivery_zone: resolvedOrderChannel === "delivery" ? resolvedDeliveryZone.trim() || undefined : undefined,
      customerName: resolvedOrderChannel === "delivery" ? resolvedCustomerName.trim() || "Delivery Customer" : undefined,
      customerPhone: resolvedOrderChannel === "delivery" ? resolvedCustomerPhone.trim() || undefined : undefined,
      tableId: resolvedOrderChannel === "dine_in" ? resolvedTableId : undefined,
      tableName:
        resolvedOrderChannel === "dine_in"
          ? (target?.tableName || selectedTableObj?.label || `Table ${resolvedTableId}`)
          : resolvedOrderChannel === "delivery"
            ? resolvedCustomerName || "Delivery"
            : undefined,
      items: (resolvedItems || []).map((it: any) => ({ ...it, is_deducted: true })),
      is_deducted: true,
      estimatedPrepTime: 15,
      estimated_prep_time: 15,
      subtotal: resolvedSubtotal,
      taxAmount: resolvedTaxAmount,
      discountPercent: resolvedDiscountPercent,
      discountAmount: resolvedDiscountAmount,
      total: resolvedTotal,
      paymentMethod: paymentDetails.method,
      cashierName: user?.name || "Terminal Cashier",
      timestamp: new Date().toLocaleString(),
      status: "completed",
      payment_status: "paid",
      shift_id: activeShift?.id ? (!isNaN(Number(activeShift.id)) ? Number(activeShift.id) : activeShift.id) : null,
    };

    const resolvedTableIdent = target?.tableName || selectedTableObj?.label || targetTable?.label || (resolvedTableId ? `Table ${resolvedTableId}` : "");
    const resolvedTableNorm = normalizeTableNumber(resolvedTableIdent);

    // Remove from running KOT orders across both state and localStorage
    setRunningTableOrders((prev) => {
      const updated = prev.filter(
        (o) =>
          o.id !== finalOrderId &&
          o.id !== target?.id &&
          (resolvedOrderChannel !== "dine_in" || (
            o.tableId !== resolvedTableId &&
            o.tableId !== finalTableId &&
            (!resolvedTableId || !isTableMatchingIdentifier({ id: resolvedTableId }, o.tableName || o.customerName || o.tableId)) &&
            (!resolvedTableNorm || normalizeTableNumber(o.tableName || o.customerName || o.tableId) !== resolvedTableNorm)
          ))
      );
      try {
        localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(updated));
        if (activeRestId) {
          localStorage.setItem(`pos_running_kot_orders_${activeRestId}`, JSON.stringify(updated));
        }
      } catch { }
      return updated;
    });

    setActiveDbOrders((prev) =>
      prev.filter(
        (o) =>
          o.id !== finalOrderId &&
          o.id !== target?.id &&
          (resolvedOrderChannel !== "dine_in" || (
            o.tableId !== resolvedTableId &&
            o.tableId !== finalTableId &&
            (!targetTable || (o.tableId !== targetTable.id && o.tableId !== targetTable.dbId)) &&
            (!resolvedTableId || !isTableMatchingIdentifier({ id: resolvedTableId }, o.tableName || o.customerName || o.tableId))
          ))
      )
    );

    // If held order was settled, remove from parkedOrders
    if (target?.source === "held") {
      setParkedOrders((prev) => {
        const updated = prev.filter((p) => p.id !== target.id);
        try {
          localStorage.setItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`, JSON.stringify(updated));
          if (activeRestId) {
            localStorage.setItem(`${PARKED_ORDERS_KEY}_${activeRestId}`, JSON.stringify(updated));
          }
        } catch { }
        return updated;
      });
    }

    // Save settled order record to cashier financial shift invoices list and local state
    setOrders((prev) => [settledOrder, ...prev.filter((o) => o.id !== settledOrder.id)]);
    saveStoredOrder(currentOrgId, settledOrder);

    // Release table in local state and synchronize across tabs
    if (isTableRelatedSettlement) {
      setTables((prev) => {
        const updated = prev.map((t) =>
          (finalTableId && (t.id === finalTableId || String(t.id) === String(finalTableId))) ||
          (targetTable && (t.id === targetTable.id || (t.dbId && t.dbId === targetTable.dbId))) ||
          (resolvedTableId && (t.id === resolvedTableId || String(t.id) === String(resolvedTableId))) ||
          (target && isTableMatchingIdentifier(t, target.tableName)) ||
          (target && isTableMatchingIdentifier(t, target.tableId)) ||
          (target && isTableMatchingIdentifier(t, target.customerName)) ||
          isTableMatchingIdentifier(t, targetTable?.label || `Table ${resolvedTableId}`)
            ? {
              ...t,
              status: "available" as const,
              activeOrderId: undefined,
              activeAmount: undefined,
            }
            : t
        );
        saveStoredTables(currentOrgId, updated);
        if (activeRestId) {
          saveStoredTables(String(activeRestId), updated);
          try {
            localStorage.setItem(`tables_list_${activeRestId}`, JSON.stringify(updated));
            localStorage.setItem(`tables_list_${currentOrgId}`, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
      try {
        window.dispatchEvent(new CustomEvent("restaurant_tables_changed"));
        window.dispatchEvent(new CustomEvent("pos_tables_updated"));
        window.dispatchEvent(new CustomEvent("tables_list_changed"));
      } catch {}
      if (activeRestId) {
        broadcastTerminalMutation(activeRestId, {
          type: "ORDER_MUTATION",
          orderId: finalOrderId,
          status: "paid",
        });
        if (isTableRelatedSettlement) {
          broadcastTerminalMutation(activeRestId, {
            type: "TABLE_RELEASED",
            tableId: targetTable?.dbId || finalTableId,
            tableNumber: target?.tableName || selectedTableObj?.label || targetTable?.label || `Table ${resolvedTableId}`,
            orderId: finalOrderId,
            status: "available",
          });
        }
      }
    }

    // If settled from active cart (not target order from hub), reset active cart
    if (!isTargetSettlement) {
      setCart([]);
      setInventoryTick((prev) => prev + 1);
      clearSharedPosCart(currentOrgId);
      setDiscountPercent(0);
      setFlatDiscount(0);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryZone("");
    }

    setTargetOrderForSettlement(null);
    setIsPaymentModalOpen(false);
    playPosSound("tender");
    showToast(`Order #${finalOrderId} settled & closed successfully.`);
    fetchLiveOrders();

    // If thermal print enabled, show thermal dialog
    if (enableDirectThermalPrint) {
      setActiveReceiptOrder(settledOrder);
    }
    } finally {
      isSettlingOrderRef.current = false;
    }
  };

  // Route settlement requests safely through the payment settlement modal
  const handleSettleAndPrint = async () => {
    handleOpenPaymentModal();
  };

  // If POS Terminal entitlement is not active for this tenant
  if (!isPosActive) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text-hi)]">
        <div className="max-w-md w-full p-8 rounded-3xl glass-panel text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-display font-black text-[var(--text-hi)]">
            POS Terminal Not Active
          </h2>
          <p className="text-xs text-[var(--text-lo)] leading-relaxed">
            The Point of Sale &amp; Billing Counter terminal feature is not enabled for this restaurant&apos;s subscription plan. Please contact your restaurant administrator or upgrade your subscription plan to unlock the POS terminal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`flex-1 w-full flex h-full min-h-0 relative overflow-hidden bg-[var(--bg)] text-[var(--text-hi)] transition-colors duration-300 ${(!hasConfirmedOpeningFloat || isStartShiftModalOpen || isStaleShiftPromptOpen) && !embedded ? "pointer-events-none select-none filter blur-[1px] opacity-40" : ""}`}>
      {/* Sleek Dedicated POS Left Sidebar (Hidden in Embedded Admin Dashboard) */}
      {!embedded && (
        <PosSidebar
          currentView={currentView}
          heldOrdersCount={parkedOrders.length}
          activeOrdersCount={runningTableOrders.length}
          activeShift={activeShift}
          onSelectView={(v) => setCurrentView(v)}
          onOpenOrdersHub={(tab) => {
            setOrdersHubInitialTab(tab || "all");
            setCurrentView("orders");
          }}
          onOpenCashDrawer={handleOpenCashDrawer}
        />
      )}

      {/* Main Content Area: Full-Page Orders Hub or POS Register */}
      {currentView === "orders" ? (
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[var(--bg)] pb-14 md:pb-0">
          <UnifiedOrdersView
            orders={orders}
            runningOrders={runningTableOrders}
            parkedOrders={parkedOrders}
            enableKitchenKds={enableKitchenKds}
            onBackToRegister={() => setCurrentView("register")}
            onSettleOrder={handleSettleUnifiedOrder}
            onRecallHeldOrder={handleRecallParkedOrder}
            onDiscardHeldOrder={handleDiscardParkedOrder}
            onReprintOrder={(ord) => {
              setActiveReceiptOrder(ord);
            }}
            currencySymbol="Rs"
            initialTab={ordersHubInitialTab}
            onRefresh={fetchLiveOrders}
            isRefreshing={isSyncingOrders}
          />
        </div>
      ) : (
        <>
          {/* POS Main Workspace (Catalog & Order Pad) */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative overflow-hidden">
        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="px-4 py-2.5 rounded-2xl bg-[var(--bg-deep)] border border-[var(--gold)]/40 text-[var(--gold)] font-mono text-xs font-bold shadow-2xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Left: Menu Catalog & Item Selector */}
        <div className="w-full flex-1 px-4 sm:px-6 md:px-8 py-4 sm:py-6 pb-32 lg:pb-6 overflow-y-auto space-y-4 sm:space-y-6 min-w-0">
          {/* Header Title Banner (Responsive 300px+) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
            <h1 className="font-display font-black text-xl sm:text-2xl md:text-3xl text-[var(--text-hi)] tracking-tight">
              Point of Sale &amp;{" "}
              <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                Billing Counter
              </span>
            </h1>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* Persistent Active Ticket Trigger for Mobile/Tablet (< 1024px) */}
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(true)}
                className="lg:hidden px-3 py-1.5 rounded-full bg-[var(--gold-dim)] hover:bg-[var(--surface-hi)] border border-[var(--gold)]/40 text-[10.5px] sm:text-[11px] font-mono font-bold text-[var(--gold)] flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                title="View Active Order Ticket"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Active Ticket {cartItemCount > 0 ? `(${cartItemCount})` : ""}</span>
              </button>

              {!embedded && (
                <button
                  type="button"
                  onClick={() => router.push("/terminal/pos/z-report")}
                  className="px-3 py-1.5 rounded-full bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-[10.5px] sm:text-[11px] font-mono font-bold text-[var(--text-hi)] flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                  title="Reconcile Cash Drawer, End Shift & View Z-Report"
                >
                  <Lock className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Z-Report</span>
                </button>
              )}
            </div>
          </div>

          {/* 🛍️ TAKEAWAY READY FOR COUNTER HANDOVER ALERT BANNER */}
          {takeawayReadyList.length > 0 && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {takeawayReadyList.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/20 border-2 border-emerald-500/50 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono shadow-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/25 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                      <ShoppingBag className="w-5 h-5 animate-bounce" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm sm:text-base text-emerald-300 flex items-center gap-2 flex-wrap">
                        <span className="truncate">Takeaway Order #{alert.orderNumber} is Ready for Counter Handover</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-[10px] uppercase font-bold tracking-wider animate-pulse">
                          Kitchen Ready
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-200/80 mt-0.5 flex items-center gap-2 sm:gap-3 flex-wrap">
                        {alert.customerName && (
                          <span>Guest: <strong className="text-emerald-100">{alert.customerName}</strong></span>
                        )}
                        {alert.customerPhone && (
                          <span>• Tel: {alert.customerPhone}</span>
                        )}
                        {alert.itemsSummary && (
                          <span className="truncate max-w-xs">• {alert.itemsSummary}</span>
                        )}
                        <span className="text-emerald-300/60 font-mono">
                          Ready: {alert.readyAtTime || "Just now"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleConfirmTakeawayHandover(alert)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-black" />
                      <span>Confirm Handover</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sleek Compact Red Shift Notification Line */}
          {!embedded && isShiftTimeEnded && (
            <div className="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono text-rose-300 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span className="font-bold text-rose-200">
                  Aap ki shift close ho chuki hai (Shift Concluded)
                </span>
                <span className="text-rose-300/70 text-[11px] hidden md:inline">
                  • Shift has ended. Please close your shift (Z-Report) or start a new shift.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSeamlessStartNewShift}
                  className="px-2.5 py-1 rounded-lg btn-gold text-[#342c14] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Start New Shift</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/terminal/pos/z-report")}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>Close Shift (Z-Report)</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {!embedded && !isShiftTimeEnded && shiftValidation?.isWarningWindow && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-amber-300 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-amber-200">
                    Shift Ending in {shiftValidation.minutesRemaining} Minute{shiftValidation.minutesRemaining !== 1 ? "s" : ""}
                  </span>
                  <span className="text-amber-300/70 ml-2">
                    (Closes at {shiftValidation.shiftEndLabel || "04:00 PM"}). Complete pending orders and open Close Shift (Z-Report).
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/terminal/pos/z-report")}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                <span>Go to Z-Report</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Categories Bar & Search Filter */}
          <MenuCategoriesAndSearch
            categories={posCategories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            totalFilteredCount={filteredMenuItems.length}
          />

          {/* Item Catalog Grid with Modifiers */}
          <ItemGridAndModifiers
            filteredMenuItems={filteredMenuItems}
            onAddToCart={handleAddToCart}
            showToast={showToast}
            getVariantPortions={getVariantPortions}
            inventoryTick={inventoryTick}
          />
        </div>

        {/* Desktop Right Panel: Permanent Cart & Settlements (Screens >= lg) */}
        <div className="hidden lg:flex lg:w-[400px] xl:w-[420px] bg-[var(--bg-deep)]/90 backdrop-blur-2xl border-l border-[var(--border)] p-4 sm:p-5 flex flex-col h-full min-h-0 shrink-0 shadow-lg z-10 overflow-hidden">
          <OrderTicketPane
            isDrawer={false}
            cart={cart}
            cartItemCount={cartItemCount}
            handleUpdateCartQty={handleUpdateCartQty}
            onClearCart={() => setIsClearTicketConfirmOpen(true)}
            orderChannel={orderChannel}
            setOrderChannel={setOrderChannel}
            selectedTable={selectedTable}
            handleSelectTable={handleSelectTable}
            displayTables={tables}
            selectedTableObj={selectedTableObj}
            activeRunningOrder={activeRunningOrder}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            deliveryZone={deliveryZone}
            setDeliveryZone={setDeliveryZone}
            cartSubtotal={cartSubtotal}
            taxAmount={taxAmount}
            taxRatePercent={taxRatePercent}
            discountPercent={discountPercent}
            discountAmount={discountAmount}
            cartTotal={cartTotal}
            onOpenFloorModal={() => setIsFloorModalOpen(true)}
            onSendToKitchen={handleSendToKitchen}
            onHoldOrder={handleHoldOrder}
            onProceedToPayment={handleOpenPaymentModal}
            onSettleAndPrint={handleSettleAndPrint}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            enableKitchenKds={enableKitchenKds}
            enableTableService={enableTableService}
          />
        </div>

        {/* Mobile Slide-Over Drawer (< 1024px) */}
        {isMobileCartOpen && (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 lg:hidden animate-in fade-in duration-200"
            onClick={() => setIsMobileCartOpen(false)}
            aria-hidden="true"
          />
        )}
        <div
          className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] h-full max-h-screen bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-l border-[var(--border)] shadow-2xl p-4 sm:p-5 flex flex-col overflow-hidden lg:hidden transition-transform duration-300 ease-in-out ${isMobileCartOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
            }`}
        >
          <OrderTicketPane
            isDrawer={true}
            onCloseDrawer={() => setIsMobileCartOpen(false)}
            cart={cart}
            cartItemCount={cartItemCount}
            handleUpdateCartQty={handleUpdateCartQty}
            onClearCart={() => setIsClearTicketConfirmOpen(true)}
            orderChannel={orderChannel}
            setOrderChannel={setOrderChannel}
            selectedTable={selectedTable}
            handleSelectTable={handleSelectTable}
            displayTables={tables}
            selectedTableObj={selectedTableObj}
            activeRunningOrder={activeRunningOrder}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            deliveryZone={deliveryZone}
            setDeliveryZone={setDeliveryZone}
            cartSubtotal={cartSubtotal}
            taxAmount={taxAmount}
            taxRatePercent={taxRatePercent}
            discountPercent={discountPercent}
            discountAmount={discountAmount}
            cartTotal={cartTotal}
            onOpenFloorModal={() => setIsFloorModalOpen(true)}
            onSendToKitchen={handleSendToKitchen}
            onHoldOrder={handleHoldOrder}
            onProceedToPayment={handleOpenPaymentModal}
            onSettleAndPrint={handleSettleAndPrint}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            enableKitchenKds={enableKitchenKds}
            enableTableService={enableTableService}
          />
        </div>
      </div>

      {/* Floating Cart Action Bar (Mobile & Tablet - Sticky above Bottom Dock) */}
      {cart.length > 0 && (
        <div className="fixed bottom-[58px] sm:bottom-[62px] inset-x-2 sm:inset-x-4 z-40 lg:hidden animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div className="bg-[var(--bg-deep)]/95 backdrop-blur-2xl border border-[var(--gold)]/40 p-3 sm:p-3.5 rounded-2xl shadow-2xl shadow-black/80 flex items-center justify-between gap-3">
            {/* Left: Total items count + Net Payable amount */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/40 flex items-center justify-center text-sm shrink-0">
                🛒
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[var(--text-lo)] truncate leading-tight">
                  {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
                </p>
                <p className="text-sm font-black font-mono text-[var(--gold)] tracking-tight">
                  Rs {cartTotal.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Right: Prominent Amber "View Ticket & Settle" Button */}
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="btn-gold px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <span>View Ticket &amp; Settle</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {/* Tender & Payment Settlement Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setTargetOrderForSettlement(null);
        }}
        subtotal={targetOrderForSettlement ? targetOrderForSettlement.subtotal : cartSubtotal}
        taxAmount={targetOrderForSettlement ? targetOrderForSettlement.taxAmount : taxAmount}
        taxRatePercent={taxRatePercent}
        discountPercent={targetOrderForSettlement ? (targetOrderForSettlement.discountPercent || 0) : discountPercent}
        setDiscountPercent={setDiscountPercent}
        flatDiscount={flatDiscount}
        setFlatDiscount={setFlatDiscount}
        discountMode={discountMode}
        setDiscountMode={setDiscountMode}
        cartTotal={targetOrderForSettlement ? targetOrderForSettlement.total : cartTotal}
        selectedMethod={paymentMethod}
        setSelectedMethod={setPaymentMethod}
        onConfirmSettlement={handleConfirmSettlement}
      />

      {/* 80mm Thermal Receipt Slip Dialog */}
      <ThermalReceiptDialog
        order={activeReceiptOrder}
        onClose={() => setActiveReceiptOrder(null)}
        taxRatePercent={taxRatePercent}
        restaurantName={user?.restaurantName}
        branchName={user?.branchName}
        address={user?.address}
        phone={user?.phone}
        enableKitchenKds={enableKitchenKds}
        autoPrint={Boolean(enableDirectThermalPrint)}
      />

      {/* 80mm Kitchen Order Ticket (KOT) Thermal Slip Dialog */}
      <KitchenThermalSlipDialog
        ticket={activeKotTicket}
        onClose={() => setActiveKotTicket(null)}
        restaurantName={user?.restaurantName}
        branchName={user?.branchName}
      />

      {/* Dining Room Floor Matrix Modal */}
      <FloorMatrixModal
        isOpen={enableTableService && isFloorModalOpen}
        onClose={() => setIsFloorModalOpen(false)}
        tables={tables}
        selectedTable={selectedTable}
        onSelectTable={(tableId) => handleSelectTable(tableId, true)}
        orders={runningTableOrders}
      />
    </div>

    {/* Modals rendered outside the blurred container */}
    {/* Mandatory Start Shift Modal (Terminal Only: strictly disabled in Admin POS) */}
    {!embedded && (
      <StartShiftModal
        isOpen={isStartShiftModalOpen}
        cashierName={user?.name || user?.email || "Terminal Cashier"}
        branchName={user?.branchName || "Main Branch • Register #01"}
        currencySymbol="Rs"
        assignedShift={assignedShiftType}
        previousHandoverAmount={previousShiftHandover?.amount}
        previousCashierName={previousShiftHandover?.cashierName}
        previousShiftType={previousShiftHandover?.shiftType}
        onConfirmStartShift={handleConfirmStartShift}
        onLogOut={async () => {
          try {
            await recordStaffShiftLogout(user, { station: "cashier" });
          } catch {}
          clearUserSession();
          logout();
          router.push("/login");
        }}
      />
    )}

    {/* Prior-Day Unclosed Shift Audit & Reconciliation Modal (Terminal Only) */}
    {!embedded && isStaleShiftPromptOpen && staleUnclosedShift && (
      <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#1a140a]/98 border border-zinc-200 dark:border-[var(--border-hi)] shadow-2xl dark:shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_24px_rgba(227,177,59,0.08)] p-6 space-y-5 animate-in fade-in zoom-in-95 text-left font-sans">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs dark:shadow-[0_0_15px_rgba(245,158,11,0.25)]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[9px] font-bold uppercase tracking-wider mb-1">
                Prior Day Audit Required
              </span>
              <h3 className="text-base font-bold text-[var(--text-hi)]">
                Unclosed Prior Shift Detected
              </h3>
              <p className="text-xs text-[var(--text-lo)] mt-0.5 leading-relaxed">
                A shift from a previous calendar date was left unclosed. To maintain daily cash ledger separation, please reconcile or cleanly close it to open today&apos;s register.
              </p>
            </div>
          </div>

          {/* Stale Shift Summary Card */}
          <div className="p-4 rounded-2xl bg-zinc-50/90 dark:bg-[#120a0a]/90 border border-zinc-200/80 dark:border-[var(--border)] space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-faint)]">Cashier on Record:</span>
              <span className="font-bold text-[var(--text-hi)]">
                {staleUnclosedShift.cashier_name || "Cashier"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-faint)]">Shift Opened At:</span>
              <span className="text-[var(--text-lo)]">
                {new Date(staleUnclosedShift.shift_start || staleUnclosedShift.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                at{" "}
                {new Date(staleUnclosedShift.shift_start || staleUnclosedShift.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-faint)]">Shift Window:</span>
              <span className="text-[var(--gold)] font-bold">
                {staleUnclosedShift.shift_type || "Standard Shift"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-200/80 dark:border-[var(--border)]/50">
              <span className="text-[var(--text-faint)]">Opening Cash Float:</span>
              <span className="font-bold text-[var(--text-hi)]">
                Rs {Number(staleUnclosedShift.opening_float || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleReconcileStaleShift}
              className="btn-gold w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[var(--gold-glow)]"
            >
              <Receipt className="w-4 h-4" />
              <span>Reconcile &amp; Settle via Z-Report</span>
            </button>
            <button
              type="button"
              onClick={handleCleanlyCloseStaleShift}
              className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[var(--surface-hi)] dark:hover:bg-[var(--surface-hi)]/80 text-zinc-700 dark:text-[var(--text-lo)] hover:text-zinc-900 dark:hover:text-[var(--text-hi)] border border-zinc-200 dark:border-[var(--border)] font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Cleanly Close Shift &amp; Start Today</span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Pre-Shift Expiry 10-Minute Warning Modal (Recurring every 3 minutes) */}
    {!embedded && (
      <ShiftExpiryWarningModal
        isOpen={isWarningModalOpen}
        minutesRemaining={shiftValidation?.minutesRemaining || 0}
        shiftShortName={shiftValidation?.shiftShortName || "Assigned Shift"}
        shiftEndLabel={shiftValidation?.shiftEndLabel || "04:00 PM"}
        onDismiss={handleDismissWarning}
        onProceedToZReport={() => router.push("/terminal/pos/z-report")}
      />
    )}

    {/* Seamless Shift Continuation & Rollover Modal (Non-blocking) */}
    {!embedded && (
      <ShiftContinuationModal
        isOpen={isShiftContinuationModalOpen}
        shiftShortName={shiftValidation?.shiftShortName || activeShift?.shift_type || "Current Shift"}
        shiftEndLabel={shiftValidation?.shiftEndLabel || "Scheduled Time"}
        nextShiftName={getNextShiftOption(activeShift?.shift_type || shiftValidation?.assignedShift)}
        cashierName={user?.name || "Terminal Cashier"}
        consecutiveShiftCount={consecutiveShiftCount}
        onStartNewShift={handleSeamlessStartNewShift}
        onProceedToZReport={() => router.push("/terminal/pos/z-report")}
        onEndShiftLogout={handleEndShiftLogout}
        onDismiss={handleDismissContinuationPrompt}
      />
    )}

    {/* Dedicated Shift Settlement Modal for Stale Shift Reconciliations (Terminal Only) */}
    {!embedded && isShiftSettlementOpen && (
      <ShiftSettlementModal
        isOpen={isShiftSettlementOpen}
        onClose={() => {
          setIsShiftSettlementOpen(false);
          if (staleUnclosedShift) {
            setStaleUnclosedShift(null);
            clearStaleShiftStorage(currentOrgId);
          }
        }}
        cashierName={staleUnclosedShift?.cashier_name || user?.name || "Terminal Cashier"}
        onSettled={handleStaleShiftSettled}
        showToast={showToast}
        orders={orders}
      />
    )}

    {/* Custom Omnibites Confirmation Modal for Clearing Active Ticket */}
    <ConfirmModal
      isOpen={isClearTicketConfirmOpen}
      onClose={() => setIsClearTicketConfirmOpen(false)}
      onConfirm={handleConfirmClearCart}
      title="Clear Active Ticket?"
      description="All items currently in the cart will be discarded. This cannot be undone."
      confirmLabel="Yes, Clear Ticket"
      cancelLabel="Cancel / Keep Items"
      variant="warning"
      icon="trash"
    />
  </>
  );
}
