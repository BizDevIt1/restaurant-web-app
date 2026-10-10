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
import StartShiftModal, { ShiftTypeOption } from "./components/StartShiftModal";
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
} from "@/lib/shiftSchedule";
import {
  recordMultiShiftRolloverEvent,
  dispatchShiftOpenedAlert,
  dispatchOrderCancelledAlert,
  dispatchSystemSyncAlert,
  dispatchShiftSettlementAlert,
} from "@/lib/shiftAuditNotifications";
import { deductInventoryStockForOrder } from "@/lib/inventoryDeduction";
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
  RawMaterialStockData,
  RecipeItemData,
} from "@/lib/recipePortions";

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

  // Strict Shift Window Lockout for Cashiers (disabled when embedded in Admin Dashboard)
  const isCashier = Boolean(
    !embedded &&
    user &&
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
    return validateCashierShiftWindow(shiftToValidate, new Date(), activeShift);
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
    // Snooze modal for 5 minutes persistently until resolved
    setShiftPromptSnoozedUntil(Date.now() + 5 * 60 * 1000);
    showToast("Shift alert snoozed. Reminding again in 5 minutes.");
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
      const result = validateCashierShiftWindow(shiftToValidate, new Date(), activeShift);
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
    return () => clearInterval(timer);
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
    menuItems.forEach((item) => {
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
    return Array.from(map.values());
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
  const [inventoryTick, setInventoryTick] = useState<number>(0);

  // Synchronous memo of simulated raw materials ledger (re-evaluated immediately on any cart, recipe, or inventory tick change)
  const effectiveLedger = useMemo(() => {
    return simulateCartRawMaterials(cart, rawRecipes, baseMaterialsMap);
  }, [cart, rawRecipes, baseMaterialsMap, inventoryTick]);

  // Synchronous memo of live simulated menu items with fresh cloned references to guarantee immediate re-rendering
  const liveSimulatedMenuItems = useMemo(() => {
    return applyRecipeCalculationsToMenu(menuItems, rawRecipes, effectiveLedger);
  }, [menuItems, rawRecipes, effectiveLedger, inventoryTick]);

  // Reactive State Hook: synchronously / reactively bind cart, ledger, rawRecipes, and menu catalog
  const [, setReactiveInventoryLedger] = useState<Map<string, RawMaterialStockData>>(() =>
    simulateCartRawMaterials(cart, rawRecipes, baseMaterialsMap)
  );
  useEffect(() => {
    const updatedLedger = simulateCartRawMaterials(cart, rawRecipes, baseMaterialsMap);
    setReactiveInventoryLedger(new Map(updatedLedger));
  }, [cart, rawRecipes, baseMaterialsMap, inventoryTick]);

  // Unified Item & Variant Stock Calculation: resolves exact available portions against active ledger
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
      const inCartQty = getItemCartQuantity(cart, item, variant);

      if (variant) {
        // Resolve target variant with full properties if present on item.variants
        const matchedVariant =
          item.variants?.find(
            (v) =>
              (v.id && variant.id && String(v.id) === String(variant.id)) ||
              (v.name && variant.name && v.name.trim().toLowerCase() === variant.name.trim().toLowerCase())
          ) || variant;

        const liveYield = calculateVariantPortions(
          dishRecipes,
          matchedVariant,
          effectiveLedger,
          item.price
        );

        const hasVariantBOM = liveYield.resolvedBOM.length > 0;

        let maxPortions = liveYield.maxPortions;
        if (!hasVariantBOM || effectiveLedger.size === 0) {
          const baseCount =
            typeof matchedVariant.maxPortions === "number"
              ? matchedVariant.maxPortions
              : typeof item.stockCount === "number"
              ? item.stockCount
              : 20;
          maxPortions = Math.max(0, baseCount - inCartQty);
        } else {
          maxPortions = Math.max(0, maxPortions);
        }

        const isOutOfStock = maxPortions <= 0;
        return {
          maxPortions,
          isOutOfStock,
          stockStatus: isOutOfStock ? ("out_of_stock" as const) : liveYield.stockStatus,
          limitingIngredient: liveYield.limitingIngredient,
        };
      }

      // Single size or base dish calculation
      if (dishRecipes.length > 0 && effectiveLedger.size > 0) {
        const calc = calculateRecipePortions(dishRecipes, item.price, effectiveLedger);
        const maxPortions = Math.max(0, calc.maxPortions);
        const isOutOfStock = maxPortions <= 0;
        return {
          maxPortions,
          isOutOfStock,
          stockStatus: isOutOfStock ? ("out_of_stock" as const) : calc.stockStatus,
          limitingIngredient: calc.limitingIngredient?.name,
        };
      }

      // Fallback for non-recipe items (Available Portions = Max Yield - Current Cart Quantity)
      const rawCount =
        typeof item.availablePortions === "number"
          ? item.availablePortions
          : typeof item.stockCount === "number"
          ? item.stockCount
          : 20;
      const remaining = Math.max(0, rawCount - inCartQty);
      return {
        maxPortions: remaining,
        isOutOfStock: remaining <= 0 || item.stockStatus === "out_of_stock",
        stockStatus:
          remaining <= 0 || item.stockStatus === "out_of_stock"
            ? ("out_of_stock" as const)
            : ("in_stock" as const),
      };
    },
    [rawRecipes, effectiveLedger, cart, inventoryTick]
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

  // 6b. Running / Open KOT Orders (Stored separately in kitchen queue & active tables, NOT in shift invoices)
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
    const raw = (user?.assignedShift || (user as any)?.shift || "").toLowerCase();
    if (raw.includes("morning") || raw.includes("first")) return "First Shift (Morning)";
    if (raw.includes("evening") || raw.includes("second") || raw.includes("rush")) return "Second Shift (Evening)";
    if (raw.includes("night") || raw.includes("third") || raw.includes("owl") || raw.includes("closing")) return "Third Shift (Night / Closing)";

    // Fallback based on live wall clock
    const hour = new Date().getHours();
    if (hour >= 8 && hour < 16) return "First Shift (Morning)";
    if (hour >= 16 && hour < 24) return "Second Shift (Evening)";
    return "Third Shift (Night / Closing)";
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
            .select("enable_kitchen_kds, enable_table_service, enable_direct_thermal_print, enable_offline_sync, enabled_modules")
            .eq("id", restId)
            .maybeSingle();

          if (data && isMounted) {
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

      // Fetch latest orders for this restaurant to reliably match tables, held tickets, and recent orders
      let { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restId)
        .neq("order_status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(250);

      if (error) {
        console.warn("[PosTerminalClient] fetchLiveOrders query error:", error.message);
        return;
      }

      if (data) {
        const completedList: OrderRecord[] = [];
        const runningKotList: OrderRecord[] = [];
        const heldList: ParkedOrder[] = [];
        const currentTables = tablesRef.current || [];

        data.forEach((o: any) => {
          const items = Array.isArray(o.items) ? o.items : [];
          const orderNum = o.order_number || o.id;
          const isHeld = String(orderNum).startsWith("#HOLD-") || o.customer_name === "Held Order";
          const isPaid = o.payment_status === "paid" || o.order_status === "completed";

          const matchedTable = currentTables.find((t) => t.dbId === o.table_id || String(t.id) === String(o.table_id));
          const resolvedTableId = matchedTable?.id ?? (isNaN(Number(o.table_id)) ? undefined : Number(o.table_id));

          if (isPaid) {
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
              status: "active",
              payment_status: "pending",
              shift_id: o.shift_id ?? null,
            });
          }
        });

        setOrders(completedList);
        saveStoredOrders(currentOrgId, completedList);

        setRunningTableOrders(runningKotList);
        try {
          localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(runningKotList));
        } catch { }

        setParkedOrders(heldList);
        try {
          localStorage.setItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`, JSON.stringify(heldList));
        } catch { }
      }
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

      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restId)
        .order("table_number", { ascending: true });

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

        setTables(mappedTables);
        saveStoredTables(currentOrgId, mappedTables);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(`tables_list_${restId}`, JSON.stringify(mappedTables));
            localStorage.setItem(`tables_list_${currentOrgId}`, JSON.stringify(mappedTables));
          } catch {}
        }

        // Align selectedTable with current floor layout
        setSelectedTable((prevSelected) => {
          if (mappedTables.length === 0) return 1;
          if (mappedTables.some((t) => t.id === prevSelected)) return prevSelected;
          return mappedTables[0].id;
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

  // Memoized live catalog fetch & recipe BOM stock deductions
  const fetchLiveMenuCatalog = useCallback(async () => {
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      if (!restId) return;

      // Concurrently fetch menu items, recipe BOM items, and raw materials from Supabase
      const [menuRes, recipeRes, materialsRes] = await Promise.all([
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
      ]);

      const menuData = menuRes.data;
      const menuErr = menuRes.error;
      const recipeRows = recipeRes.data;
      const materialRows = materialsRes.data;

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

      if (!menuErr && menuData) {
        let mappedMenu: MenuItem[] = menuData.map((d: any) => ({
          id: d.id,
          name: d.name,
          category: d.category || "karahi",
          price: Number(d.price),
          prepTime: d.prep_time || "15 mins",
          stockStatus: d.stock_status || "in_stock",
          stockCount: d.stock_count ?? 20,
          imageIcon: d.image_icon || "🍲",
          isPopular: Boolean(d.is_popular),
          variants: (() => {
            let rawList: any[] | null = null;
            if (Array.isArray(d.variants) && d.variants.length > 0) {
              rawList = d.variants;
            } else if (typeof d.variants === "string") {
              try {
                const parsed = JSON.parse(d.variants);
                if (Array.isArray(parsed) && parsed.length > 0) rawList = parsed;
              } catch { }
            }
            if (!rawList && d.description) {
              try {
                const parsed = JSON.parse(d.description);
                if (Array.isArray(parsed.variants) && parsed.variants.length > 0) rawList = parsed.variants;
              } catch { }
            }
            if (!rawList && Array.isArray(d.metadata?.variants) && d.metadata.variants.length > 0) {
              rawList = d.metadata.variants;
            }
            if (rawList && rawList.length > 0) {
              return rawList.map((v: any, idx: number) => {
                const vId = v.id ? String(v.id) : `var_${d.id}_${idx}`;
                const matchedFromRows = (recipeRows || [])
                  .filter(
                    (r: any) =>
                      String(r.menu_item_id) === String(d.id) &&
                      ((r.variant_id && String(r.variant_id) === vId) ||
                        (r.variant_name &&
                          v.name &&
                          String(r.variant_name).trim().toLowerCase() ===
                            String(v.name).trim().toLowerCase()))
                  )
                  .map((r: any) => {
                    const raw = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
                    return {
                      raw_material_id: r.raw_material_id,
                      raw_material_name: raw?.name || "Ingredient",
                      quantity_required: Number(r.quantity_required) || 0,
                      unit: r.unit || raw?.unit || "",
                      cost_per_unit: Number(raw?.cost_per_unit) || 0,
                    };
                  });

                const effectiveRecipe =
                  Array.isArray(v.recipe) && v.recipe.length > 0
                    ? v.recipe
                    : matchedFromRows;

                return {
                  id: vId,
                  name: String(v.name || `Portion ${idx + 1}`).trim(),
                  price: Number(v.price ?? d.price ?? 0),
                  isDefault: Boolean(v.isDefault),
                  raw_material_id: v.raw_material_id,
                  raw_material_qty: v.raw_material_qty ? Number(v.raw_material_qty) : undefined,
                  quantity_multiplier: v.quantity_multiplier ? Number(v.quantity_multiplier) : undefined,
                  recipe: effectiveRecipe,
                };
              });
            }
            return undefined;
          })(),
          is_available: (d.stock_status || "in_stock") !== "out_of_stock",
          in_stock: (d.stock_status || "in_stock") !== "out_of_stock",
          image_url: d.image_url || undefined,
          imageUrl: d.image_url || undefined,
        }));

        if (recipeRows && recipeRows.length > 0) {
          mappedMenu = applyRecipeCalculationsToMenu(mappedMenu, recipeRows, bMap);
        }

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

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("pos_tax_rate_changed", handleCustomTaxChange);
      window.addEventListener("pos_menu_updated", handleCustomMenuUpdated);
      window.addEventListener("inventory_stock_deducted", handleInventoryStockDeducted);
      window.addEventListener("pos_tables_updated", handleCustomTablesUpdated);
      window.addEventListener("restaurant_tables_changed", handleCustomTablesUpdated);
    }

    // Subscribe to realtime menu, table, and branch settings updates
    let channel: any = null;
    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const subId = Math.random().toString(36).substring(2, 7);

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
            () => {
              debouncedFetchLiveOrders();
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
              debouncedFetchLiveOrders();
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
                        activeOrderId: row.active_order_id || row.current_order_id || undefined,
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
          .subscribe();
      } catch { }
    })();

    return () => {
      isMounted = false;
      if (liveOrdersTimer) clearTimeout(liveOrdersTimer);
      if (liveMenuTimer) clearTimeout(liveMenuTimer);
      if (liveTablesTimer) clearTimeout(liveTablesTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("pos_tax_rate_changed", handleCustomTaxChange);
        window.removeEventListener("pos_menu_updated", handleCustomMenuUpdated);
        window.removeEventListener("inventory_stock_deducted", handleInventoryStockDeducted);
        window.removeEventListener("pos_tables_updated", handleCustomTablesUpdated);
        window.removeEventListener("restaurant_tables_changed", handleCustomTablesUpdated);
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
            (table.activeOrderId &&
              (o.id === table.activeOrderId || o.kotId === table.activeOrderId))) &&
          o.status !== "completed" &&
          o.status !== "cancelled"
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
    playPosSound("chirp");
    const cleanNotes = notes?.trim() || undefined;
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.item.id === item.id && (c.notes || undefined) === cleanNotes
      );
      if (existingIndex !== -1) {
        return prev.map((c, idx) =>
          idx === existingIndex
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { item, quantity: 1, notes: cleanNotes, selectedVariant: item.selectedVariant }];
    });
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
        if (itemStock.isOutOfStock || itemStock.maxPortions <= 0) {
          playPosSound("buzz");
          showToast(`Insufficient stock available: "${target.item.name}" has reached its maximum available limit.`);
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
      const matchCat =
        selectedCategory === "all" ||
        (item.category || "").toLowerCase() === selectedCategory.toLowerCase();
      const matchQuery =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
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
          qty: c.quantity,
          notes: c.notes,
          prepTime: c.item.prepTime || "15m",
          preparation_time: c.item.preparation_time || 15,
          selectedVariant: variantObj,
          variant: variantObj,
          variant_id: variantObj?.id || null,
          variant_name: variantObj?.name || null,
        };
      }),
      priority: orderChannel === "delivery" ? "urgent" : "normal",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      created_at: new Date().toISOString(),
      isDeducted: false,
    };

    // Save ticket locally
    const currentTickets = getStoredKdsTickets(currentOrgId, []);
    saveStoredKdsTickets(currentOrgId, [kitchenTicket, ...currentTickets]);

    // Update active order record
    const resolvedOrderId =
      orderChannel === "dine_in" && activeRunningOrder?.id
        ? activeRunningOrder.id
        : `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

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
      setTables((prev) =>
        prev.map((t) =>
          t.id === selectedTable
            ? {
              ...t,
              status: "seated",
              activeOrderId: resolvedOrderId,
              activeAmount: cartTotal,
            }
            : t
        )
      );

      (async () => {
        try {
          const supabase = createClient();
          const { restId } = await getValidTenantContext(user);
          const targetTable = tables.find((t) => t.id === selectedTable);
          if (targetTable?.dbId) {
            await supabase
              .from("restaurant_tables")
              .update({
                status: "OCCUPIED",
                current_order_id: resolvedOrderId,
                updated_at: new Date().toISOString(),
              })
              .eq("restaurant_id", restId)
              .eq("id", targetTable.dbId);
          }
        } catch { }
      })();
    }

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
          items: activeOrder.items,
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
          if (updErr && (updErr.code === "PGRST204" || updErr.code === "42703" || updErr.message?.includes("shift_id") || String(updErr.details || "").includes("shift_id"))) {
            delete orderPayload.shift_id;
            await supabase.from("orders").update(orderPayload).eq("id", existing.id);
          }
        } else {
          const { error: insErr } = await supabase.from("orders").insert([orderPayload]);
          if (insErr && (insErr.code === "PGRST204" || insErr.code === "42703" || insErr.message?.includes("shift_id") || String(insErr.details || "").includes("shift_id"))) {
            delete orderPayload.shift_id;
            await supabase.from("orders").insert([orderPayload]);
          }
        }

        // Deduct inventory stock for recipe items linked to ordered dishes
        await deductInventoryStockForOrder(restId, activeOrder.items, { orderId: resolvedOrderId, source: "pos_kot_dispatch" });
        notifyInventoryStockDeducted(currentOrgId);
        await fetchLiveMenuCatalog();
      } catch (kotDbErr) {
        console.warn("[PosTerminal] Error persisting KOT order to database:", kotDbErr);
      }
    })();

    playPosSound("chime");
    showToast(`Order dispatched to kitchen (${newKotId}).`);
    setActiveKotTicket(kitchenTicket);
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

    // 1. Direct Supabase Persistence (orders & order_items)
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      const targetTable = tables.find((t) => t.id === resolvedTableId);
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
        })),
        created_at: new Date().toISOString(),
      };

      if (!embedded && activeShift?.id && !isNaN(Number(activeShift.id))) {
        orderPayload.shift_id = Number(activeShift.id);
      }

      // Check if order already exists in Supabase (e.g. dispatched to KOT or Held)
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, order_number")
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

        if (orderErr && (orderErr.code === "PGRST204" || orderErr.code === "42703" || orderErr.message?.includes("shift_id") || String(orderErr.details || "").includes("shift_id"))) {
          delete orderPayload.shift_id;
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

        // Retry without shift_id if column does not exist or fails
        if (orderErr && (orderErr.code === "PGRST204" || orderErr.code === "42703" || orderErr.message?.includes("shift_id") || String(orderErr.details || "").includes("shift_id"))) {
          delete orderPayload.shift_id;
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

      // 3. Release table if Dine-In
      if (resolvedOrderChannel === "dine_in" && isTargetTableUuid && targetTable?.dbId) {
        await supabase
          .from("restaurant_tables")
          .update({
            status: "AVAILABLE",
            current_order_id: null,
            active_order_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("restaurant_id", restId)
          .eq("id", targetTable.dbId);
      }

      // Deduct inventory stock if not sent through KOT earlier
      if (!resolvedKotId) {
        await deductInventoryStockForOrder(restId, resolvedItems, { orderId: finalOrderId, source: "pos_direct_settlement" });
        notifyInventoryStockDeducted(currentOrgId);
        await fetchLiveMenuCatalog();
      }
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
      items: resolvedItems,
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

    // Remove from running KOT orders
    setRunningTableOrders((prev) => {
      const updated = prev.filter(
        (o) =>
          o.id !== finalOrderId &&
          o.id !== target?.id &&
          (resolvedOrderChannel !== "dine_in" || o.tableId !== resolvedTableId)
      );
      try {
        localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(updated));
      } catch { }
      return updated;
    });

    // If held order was settled, remove from parkedOrders
    if (target?.source === "held") {
      setParkedOrders((prev) => {
        const updated = prev.filter((p) => p.id !== target.id);
        try {
          localStorage.setItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`, JSON.stringify(updated));
        } catch { }
        return updated;
      });
    }

    // Save settled order record to cashier financial shift invoices list and local state
    setOrders((prev) => [settledOrder, ...prev.filter((o) => o.id !== settledOrder.id)]);
    saveStoredOrder(currentOrgId, settledOrder);

    // Release table in local state
    if (resolvedOrderChannel === "dine_in" && resolvedTableId) {
      setTables((prev) =>
        prev.map((t) =>
          t.id === resolvedTableId
            ? {
              ...t,
              status: "available",
              activeOrderId: undefined,
              activeAmount: undefined,
            }
            : t
        )
      );
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

          {/* Shift Expiry Continuation Prompt Banner */}
          {!embedded && isShiftTimeEnded && (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-amber-300 shadow-md animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="font-bold text-amber-200 flex items-center gap-2">
                    <span>Shift Concluded • Action Required</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                      Rollover Available
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-300/90 mt-0.5">
                    Your shift has ended. Please close your shift (Z-Report) and logout, or start a new shift.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSeamlessStartNewShift}
                  className="px-3.5 py-2 rounded-xl btn-gold text-[#342c14] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Start New Shift / Cover</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/terminal/pos/z-report")}
                  className="px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 border border-[var(--border)] text-[var(--text-hi)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <span>Close Shift &amp; Logout (Z-Report)</span>
                  <ChevronRight className="w-3.5 h-3.5" />
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
        onLogOut={() => {
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
