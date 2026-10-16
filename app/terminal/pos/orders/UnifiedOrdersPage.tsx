"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/admin/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import { OrderRecord } from "@/app/admin/types";
import { deductInventoryStockForOrder, isOrderAlreadyDeducted } from "@/lib/inventoryDeduction";
import { broadcastStockRefresh } from "@/lib/unifiedStock";
import { dispatchOrderCancelledAlert } from "@/lib/shiftAuditNotifications";
import { normalizeTableNumber, isUuid, isOrderOccupyingTable, broadcastTableReleased } from "@/lib/tableOccupancy";
import {
  getStoredOrders,
  saveStoredOrders,
  getStoredTables,
  saveStoredTables,
  getStoredBranchSettings,
  getActiveUserSession,
} from "@/lib/tenantStore";
import PosSidebar from "../components/PosSidebar";
import UnifiedOrdersView, {
  ParkedOrder,
  UnifiedOrder,
  UnifiedOrderTab,
} from "../components/UnifiedOrdersView";
import PaymentModal from "../components/PaymentModal";
import ThermalReceiptDialog from "../components/ThermalReceiptDialog";
import { playPosSound } from "@/utils/posAudio";

const PARKED_ORDERS_KEY = "omni_terminal_parked_orders";

export default function UnifiedOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Instant synchronous session retrieval to eliminate hydration delays and 0ms empty flicker
  const activeSession = typeof window !== "undefined" ? getActiveUserSession() : null;
  const currentOrgId =
    (user?.restaurantId ? String(user.restaurantId) : "") ||
    (activeSession?.restaurantId ? String(activeSession.restaurantId) : "") ||
    (user?.organizationId ? String(user.organizationId) : "") ||
    (activeSession?.organizationId ? String(activeSession.organizationId) : "") ||
    (user?.id ? String(user.id) : "") ||
    (activeSession?.id ? String(activeSession.id) : "") ||
    "default";

  // Tab state for direct navigation from POS sidebar
  const [selectedTab, setSelectedTab] = useState<UnifiedOrderTab>("all");

  // Shift & Feature states
  const [activeShift, setActiveShift] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const keys = [
          currentOrgId,
          user?.restaurantId ? String(user.restaurantId) : "",
          activeSession?.restaurantId ? String(activeSession.restaurantId) : "",
          user?.organizationId ? String(user.organizationId) : "",
          user?.id ? String(user.id) : "",
        ].filter(Boolean);

        for (const k of keys) {
          const cached = sessionStorage.getItem(`pos_active_shift_${k}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.status === "OPEN") return parsed;
          }
        }
      } catch { }
    }
    return null;
  });

  // Keep a stable ref to activeShift so queries can read it without recreating callbacks or triggering re-subscription loops
  const activeShiftRef = useRef(activeShift);
  useEffect(() => {
    activeShiftRef.current = activeShift;
  }, [activeShift]);

  const isFetchingOrdersRef = useRef(false);
  const fetchOrdersTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [enableKitchenKds, setEnableKitchenKds] = useState<boolean>(
    user?.enableKitchenKds ?? true
  );
  const [enableDirectThermalPrint, setEnableDirectThermalPrint] = useState<boolean>(
    user?.enableDirectThermalPrint ?? true
  );

  // Orders collections (Tenant-Scoped Clean Initialization: starts empty [] to prevent stale order flashes)
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [runningTableOrders, setRunningTableOrders] = useState<OrderRecord[]>([]);
  const [parkedOrders, setParkedOrders] = useState<ParkedOrder[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isSettlingOrderRef = useRef(false);

  // Clear stale state on tenant change
  useEffect(() => {
    setOrders([]);
    setRunningTableOrders([]);
    setParkedOrders([]);
  }, [currentOrgId]);

  // Modals for settlement & reprint
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetOrderForSettlement, setTargetOrderForSettlement] =
    useState<UnifiedOrder | null>(null);
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<OrderRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "raast" | "split">(
    "cash"
  );
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [flatDiscount, setFlatDiscount] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<"percent" | "flat">("percent");
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

  // Fetch orders from Supabase (Completed, Active KOT, and Held) with concurrency locking
  const fetchOrders = useCallback(async (showRefreshingSpinner = false) => {
    if (isFetchingOrdersRef.current) return;
    isFetchingOrdersRef.current = true;

    if (showRefreshingSpinner) {
      setIsRefreshing(true);
    }
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      if (!restId) return;

      // Dynamic Tax sync (non-blocking)
      try {
        const { data: settingsData } = await supabase
          .from("branch_settings")
          .select("tax_rate, tax_rate_percent")
          .eq("restaurant_id", restId)
          .maybeSingle();
        if (settingsData) {
          const val = settingsData.tax_rate ?? settingsData.tax_rate_percent;
          if (val !== null && val !== undefined) {
            setTaxRatePercent(Number(val));
          }
        }
      } catch { }

      // Fetch latest orders for this restaurant without fragile PostgREST .or() date-locking
      // This ensures all active KOT orders, held orders, and settled orders are retrieved smoothly
      const { data: dbOrders, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restId)
        .neq("order_status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(250);

      if (error) {
        console.warn("[UnifiedOrdersPage] fetchOrders query error:", error);
        return;
      }

      if (dbOrders) {
        const completedList: OrderRecord[] = [];
        const runningKotList: OrderRecord[] = [];
        const heldList: ParkedOrder[] = [];

        dbOrders.forEach((o: any) => {
          const items = Array.isArray(o.items) ? o.items : [];
          const orderNum = o.order_number || o.id;
          const isHeld = String(orderNum).startsWith("#HOLD-") || o.customer_name === "Held Order";
          const isPaid = o.payment_status === "paid";

          if (isPaid) {
            completedList.push({
              id: orderNum,
              orderChannel: o.order_channel || "dine_in",
              tableId: o.table_id ? (isNaN(Number(o.table_id)) ? undefined : Number(o.table_id)) : undefined,
              tableName: o.customer_name || (o.table_id ? `Table ${o.table_id}` : `Order #${orderNum}`),
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
              selectedTable: o.table_id ? (isNaN(Number(o.table_id)) ? undefined : Number(o.table_id)) : undefined,
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
              tableId: o.table_id || undefined,
              tableName: o.customer_name || (o.table_id ? `Table ${o.table_id}` : `Order #${orderNum}`),
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

        // Merge with any locally parked orders that haven't synced yet (strictly scoped to restId)
        try {
          const rawLocalParked = localStorage.getItem(`${PARKED_ORDERS_KEY}_${restId}`);
          if (rawLocalParked) {
            const parsed = JSON.parse(rawLocalParked);
            if (Array.isArray(parsed)) {
              parsed.forEach((localP) => {
                if (!heldList.some((h) => h.id === localP.id)) {
                  heldList.push(localP);
                }
              });
            }
          }
        } catch { }

        // Merge with locally stored running KOT orders
        try {
          const rawLocalRunning = localStorage.getItem(`pos_running_kot_orders_${restId}`);
          if (rawLocalRunning) {
            const parsed = JSON.parse(rawLocalRunning);
            if (Array.isArray(parsed)) {
              parsed.forEach((localR) => {
                if (!runningKotList.some((r) => r.id === localR.id)) {
                  const alreadyPaidOrCompleted = completedList.some((c) => c.id === localR.id);
                  if (!alreadyPaidOrCompleted && isOrderOccupyingTable(localR)) {
                    runningKotList.unshift(localR);
                  }
                }
              });
            }
          }
        } catch { }

        setOrders(completedList);
        setRunningTableOrders(runningKotList);
        setParkedOrders(heldList);

        // Immediate background cache write strictly scoped to restId
        try {
          saveStoredOrders(String(restId), completedList);
          localStorage.setItem(`pos_running_kot_orders_${restId}`, JSON.stringify(runningKotList));
          localStorage.setItem(`${PARKED_ORDERS_KEY}_${restId}`, JSON.stringify(heldList));
        } catch { }
      }
    } catch (err) {
      console.warn("[UnifiedOrdersPage] fetchOrders error:", err);
    } finally {
      isFetchingOrdersRef.current = false;
      setIsRefreshing(false);
    }
  }, [user, currentOrgId]);

  // Debounced background sync for realtime database updates (orders & kitchen tickets)
  const triggerDebouncedFetch = useCallback(() => {
    if (fetchOrdersTimeoutRef.current) {
      clearTimeout(fetchOrdersTimeoutRef.current);
    }
    fetchOrdersTimeoutRef.current = setTimeout(() => {
      fetchOrders(false);
    }, 200);
  }, [fetchOrders]);

  // Stable realtime channel subscription and one-time feature init
  useEffect(() => {
    let isMounted = true;
    let ordersChannel: any = null;

    const init = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        if (!restId) return;

        // Fetch shift (non-blocking)
        try {
          const { data: openShift } = await supabase
            .from("shift_settlements")
            .select("*")
            .eq("restaurant_id", restId)
            .eq("status", "OPEN")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (openShift && isMounted) {
            setActiveShift(openShift);
            try {
              sessionStorage.setItem(`pos_active_shift_${currentOrgId}`, JSON.stringify(openShift));
              if (user?.restaurantId) {
                sessionStorage.setItem(`pos_active_shift_${user.restaurantId}`, JSON.stringify(openShift));
              }
            } catch { }
          }
        } catch (shiftErr) {
          console.warn("[UnifiedOrdersPage] Shift fetch error:", shiftErr);
        }

        // Fetch tenant flags (non-blocking)
        try {
          const { data: restData } = await supabase
            .from("restaurants")
            .select("enable_kitchen_kds, enable_direct_thermal_print, enabled_modules")
            .eq("id", restId)
            .maybeSingle();

          if (restData && isMounted) {
            const hasKds = Array.isArray(restData.enabled_modules)
              ? restData.enabled_modules.includes("kds_system")
              : true;
            setEnableKitchenKds(
              restData.enable_kitchen_kds !== null && restData.enable_kitchen_kds !== undefined
                ? Boolean(restData.enable_kitchen_kds)
                : hasKds
            );
            setEnableDirectThermalPrint(
              restData.enable_direct_thermal_print !== null && restData.enable_direct_thermal_print !== undefined
                ? Boolean(restData.enable_direct_thermal_print)
                : true
            );
          }
        } catch (flagsErr) {
          console.warn("[UnifiedOrdersPage] Flags fetch error:", flagsErr);
        }

        // Initial fetch: guarantees orders load smoothly regardless of realtime status
        if (isMounted) {
          await fetchOrders(orders.length === 0);
        }

        // Realtime subscription in isolated block with guaranteed UNIQUE channel identifier
        if (restId && isMounted) {
          try {
            // First safely clean up any leftover channels matching this prefix
            const existingChannels = supabase.getChannels();
            existingChannels.forEach((ch: any) => {
              if (ch.topic && ch.topic.includes(`unified_orders_hub_${restId}`)) {
                try {
                  supabase.removeChannel(ch);
                } catch { }
              }
            });

            const subUid = Math.random().toString(36).substring(2, 9);
            ordersChannel = supabase
              .channel(`unified_orders_hub_${restId}_${subUid}`)
              .on(
                "postgres_changes",
                {
                  event: "*",
                  schema: "public",
                  table: "orders",
                  filter: `restaurant_id=eq.${restId}`,
                },
                () => {
                  if (isMounted) {
                    triggerDebouncedFetch();
                  }
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
                  if (isMounted) {
                    triggerDebouncedFetch();
                  }
                }
              )
              .subscribe();
          } catch (rtErr) {
            console.warn("[UnifiedOrdersPage] Realtime subscription error:", rtErr);
          }
        }
      } catch (err) {
        console.warn("[UnifiedOrdersPage] Init error:", err);
      }
    };

    init();

    const handleStorageUpdate = (e: StorageEvent) => {
      if (
        e.key?.startsWith("pos_orders_") ||
        e.key?.startsWith("orders_") ||
        e.key?.startsWith("pos_running_kot_")
      ) {
        if (isMounted) triggerDebouncedFetch();
      }
    };
    const handleOrdersCustom = () => {
      if (isMounted) triggerDebouncedFetch();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageUpdate);
      window.addEventListener("orders_updated", handleOrdersCustom);
      window.addEventListener("pos_orders_updated", handleOrdersCustom);
    }

    return () => {
      isMounted = false;
      if (fetchOrdersTimeoutRef.current) {
        clearTimeout(fetchOrdersTimeoutRef.current);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageUpdate);
        window.removeEventListener("orders_updated", handleOrdersCustom);
        window.removeEventListener("pos_orders_updated", handleOrdersCustom);
      }
      if (ordersChannel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(ordersChannel);
        } catch { }
      }
    };
  }, [user, currentOrgId, fetchOrders, triggerDebouncedFetch]);

  // Handle direct settlement of order
  const handleSettleOrder = (order: UnifiedOrder) => {
    setTargetOrderForSettlement(order);
    setIsPaymentModalOpen(true);
  };

  const handleConfirmSettlement = async (paymentDetails: {
    method: "cash" | "card" | "raast" | "split";
    tenderedAmount: number;
    changeAmount: number;
    splitBreakdown?: { cash: number; card: number };
  }) => {
    if (isSettlingOrderRef.current) return;
    if (!targetOrderForSettlement) return;

    const ord = targetOrderForSettlement;

    isSettlingOrderRef.current = true;
    const finalOrderId = ord.id;

    let targetRestId: string | number = currentOrgId;
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      if (restId) targetRestId = restId;

      const normalizedPaymentMethod =
        paymentDetails.method === "card"
          ? "card"
          : paymentDetails.method === "raast"
            ? "raast"
            : "cash";

      const orderPayload: any = {
        restaurant_id: restId,
        branch_id: branchId || user?.branchId || null,
        order_number: finalOrderId,
        order_channel: ord.orderChannel,
        customer_name: ord.customerName || (ord.tableName ? ord.tableName : "Walk-in Guest"),
        customer_phone: ord.customerPhone || null,
        subtotal: ord.subtotal,
        tax_amount: ord.taxAmount,
        discount_amount: ord.discountAmount,
        total_amount: ord.total,
        payment_method: normalizedPaymentMethod,
        payment_status: "paid",
        order_status: "completed",
        is_deducted: true,
        items: ord.items.map((it: any) => ({
          id: it.id,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          notes: it.notes,
          selectedVariant: it.selectedVariant || it.variant,
          variant: it.variant || it.selectedVariant,
          variant_id: it.variant_id || it.selectedVariant?.id || null,
          variant_name: it.variant_name || it.selectedVariant?.name || null,
          is_deducted: true,
        })),
        created_at: new Date().toISOString(),
      };

      if (activeShift?.id) {
        orderPayload.shift_id = !isNaN(Number(activeShift.id)) ? Number(activeShift.id) : activeShift.id;
      }

      const { data: existing } = await supabase
        .from("orders")
        .select("id, is_deducted, items")
        .eq("restaurant_id", restId)
        .eq("order_number", finalOrderId)
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

      // Real-time raw material inventory deduction strictly if NOT already deducted via KOT
      const orderAlreadyDeducted =
        isOrderAlreadyDeducted(restId, finalOrderId, ord.kotId) ||
        Boolean(existing && (existing as any).is_deducted === true) ||
        (Array.isArray(existing?.items) &&
          existing.items.some((it: any) => it.is_deducted === true || it.isDeducted === true)) ||
        (Array.isArray(ord.items) &&
          ord.items.some((it: any) => it.is_deducted === true || it.isDeducted === true));

      if (!orderAlreadyDeducted) {
        await deductInventoryStockForOrder(restId, ord.items, {
          orderId: finalOrderId,
          kotId: ord.kotId,
          source: "terminal_settle",
        });
        broadcastStockRefresh(restId, { orderId: finalOrderId, source: "terminal_settle" });
      } else {
        console.log(`[UnifiedOrdersPage] Order ${finalOrderId} (${ord.kotId}) was already deducted. Skipping settlement duplicate deduction.`);
      }

      // Release table if Dine-In: Automatic freeing on settlement
      if (ord.orderChannel === "dine_in" || ord.tableId || ord.tableName) {
        const tableIdentifier = ord.tableName || (ord.tableId ? `Table ${ord.tableId}` : "");
        const normNum = normalizeTableNumber(tableIdentifier);
        try {
          const releasePayload = {
            status: "available",
            current_order_id: null,
            active_order_id: null,
            updated_at: new Date().toISOString(),
          };

          if (ord.tableId && isUuid(String(ord.tableId))) {
            await supabase
              .from("restaurant_tables")
              .update(releasePayload)
              .eq("id", ord.tableId);
          }

          const { data: restTables } = await supabase
            .from("restaurant_tables")
            .select("id, table_number")
            .eq("restaurant_id", Number(restId) || restId);

          if (restTables && Array.isArray(restTables)) {
            const matchedRows = restTables.filter((row: any) =>
              (ord.tableId && (row.id === ord.tableId || String(row.id) === String(ord.tableId))) ||
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

          broadcastTableReleased(
            restId,
            {
              tableId: ord.tableId,
              tableNumber: tableIdentifier,
              orderId: finalOrderId,
            },
            supabase
          );

          // Complete any active kitchen tickets for this settled table so it frees cleanly across terminals
          try {
            let kotCloseQuery: any = supabase
              .from("kitchen_tickets")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
              })
              .eq("restaurant_id", restId)
              .not("status", "in", '("completed","cancelled","archived","voided")');

            if (ord.kotId) {
              kotCloseQuery = kotCloseQuery.or(`ticket_number.eq.${ord.kotId},id.eq.${ord.kotId}`);
            } else if (normNum) {
              kotCloseQuery = kotCloseQuery.or(`table_number.eq.${normNum},table_number.eq.Table ${normNum},customer_name.eq.${tableIdentifier}`);
            }
            await kotCloseQuery;
          } catch (kotCloseErr) {
            console.warn("[UnifiedOrdersPage] Error closing KOT tickets on settlement:", kotCloseErr);
          }

          // Broadcast table status update across all terminals
          const currentTables = getStoredTables(currentOrgId, []);
          const updatedTables = currentTables.map((t) =>
            (ord.tableId && String(t.id) === String(ord.tableId)) ||
            (ord.tableId && t.dbId === ord.tableId) ||
            (tableIdentifier && (t.label === tableIdentifier || (t as any).table_number === tableIdentifier)) ||
            (normNum && normalizeTableNumber(t.label || t.id) === normNum)
              ? { ...t, status: "available" as const, activeOrderId: undefined, activeAmount: undefined }
              : t
          );
          saveStoredTables(currentOrgId, updatedTables);
          if (restId && String(restId) !== currentOrgId) {
            saveStoredTables(String(restId), updatedTables);
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("restaurant_tables_changed"));
            window.dispatchEvent(new CustomEvent("pos_tables_updated"));
            localStorage.setItem(`omni_tables_trigger_${currentOrgId}`, String(Date.now()));
            window.dispatchEvent(new Event("storage"));
          }

          // Broadcast clean TABLE_RELEASED event across terminals
          broadcastTableReleased(
            restId,
            {
              tableId: ord.tableId ? String(ord.tableId) : undefined,
              tableNumber: normNum || tableIdentifier,
              orderId: finalOrderId,
            },
            supabase
          );
        } catch (tRelErr) {
          console.warn("[UnifiedOrdersPage] Table release error on settlement:", tRelErr);
        }
      }

      // Broadcast order update to POS and all terminals
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("orders_updated", { detail: { restaurantId: restId, orderId: finalOrderId, timestamp: Date.now() } }));
        localStorage.setItem(`pos_orders_${currentOrgId}`, String(Date.now()));
        window.dispatchEvent(new Event("storage"));
      }
    } catch (err) {
      console.warn("[UnifiedOrdersPage] Supabase insert warning:", err);
    } finally {
      setTimeout(() => {
        isSettlingOrderRef.current = false;
      }, 1200);
    }

    const settledOrder: OrderRecord = {
      id: finalOrderId,
      kotId: ord.kotId,
      orderChannel: ord.orderChannel as any,
      tableId: ord.tableId,
      tableName: ord.tableName,
      customerName: ord.customerName,
      customerPhone: ord.customerPhone,
      delivery_zone: ord.deliveryZone,
      items: ord.items.map((it) => ({
        id: it.id || "",
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        notes: it.notes,
        is_deducted: true,
      })),
      is_deducted: true,
      subtotal: ord.subtotal,
      taxAmount: ord.taxAmount,
      discountPercent: ord.discountPercent || 0,
      discountAmount: ord.discountAmount,
      total: ord.total,
      paymentMethod: paymentDetails.method,
      cashierName: user?.name || "Terminal Cashier",
      timestamp: new Date().toLocaleString(),
      status: "completed",
      payment_status: "paid",
      shift_id: activeShift?.id ? (!isNaN(Number(activeShift.id)) ? Number(activeShift.id) : activeShift.id) : null,
    };

    // Update state & storage
    setOrders((prev) => [settledOrder, ...prev.filter((o) => o.id !== settledOrder.id)]);

    // Always cleanse settled order from running table orders and local storage
    setRunningTableOrders((prev) => {
      const tableNorm = normalizeTableNumber(ord.tableName || (ord.tableId ? String(ord.tableId) : ""));
      const updated = prev.filter((o) => {
        if (o.id === ord.id || o.id === finalOrderId) return false;
        if (ord.kotId && o.kotId === ord.kotId) return false;
        if (tableNorm && normalizeTableNumber(o.tableName || o.tableId) === tableNorm) return false;
        if (ord.tableId && String(o.tableId) === String(ord.tableId)) return false;
        return true;
      });
      try {
        localStorage.setItem(`pos_running_kot_orders_${currentOrgId}`, JSON.stringify(updated));
        const activeRestId = user?.restaurantId ? String(user.restaurantId) : "";
        if (activeRestId && activeRestId !== currentOrgId) {
          localStorage.setItem(`pos_running_kot_orders_${activeRestId}`, JSON.stringify(updated));
        }
        if (targetRestId && String(targetRestId) !== currentOrgId) {
          localStorage.setItem(`pos_running_kot_orders_${targetRestId}`, JSON.stringify(updated));
        }
      } catch { }
      return updated;
    });

    if (ord.source === "held") {
      setParkedOrders((prev) => {
        const updated = prev.filter((p) => p.id !== ord.id);
        try {
          localStorage.setItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`, JSON.stringify(updated));
        } catch { }
        return updated;
      });
    }

    setIsPaymentModalOpen(false);
    setTargetOrderForSettlement(null);
    playPosSound("tender");
    fetchOrders(false);

    if (enableDirectThermalPrint) {
      setActiveReceiptOrder(settledOrder);
    }
  };

  const handleDiscardHeldOrder = (orderId: string) => {
    setParkedOrders((prev) => {
      const updated = prev.filter((p) => p.id !== orderId);
      try {
        localStorage.setItem(`${PARKED_ORDERS_KEY}_${currentOrgId}`, JSON.stringify(updated));
      } catch { }
      return updated;
    });

    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        await supabase
          .from("orders")
          .update({ order_status: "cancelled" })
          .eq("restaurant_id", restId)
          .eq("order_number", orderId);
        if (restId) {
          broadcastStockRefresh(restId, { source: "order_cancelled", orderId });
        }
      } catch { }
    })();

    dispatchOrderCancelledAlert(currentOrgId, {
      orderNumber: orderId,
      cashierName: user?.name || "Staff",
      reason: "Cancelled from Orders Hub",
      branchName: user?.branchName || "Orders Hub",
    });
  };

  const handleRecallHeldOrder = (parked: ParkedOrder) => {
    try {
      sessionStorage.setItem(`pos_active_cart_${currentOrgId}`, JSON.stringify(parked.cart));
      sessionStorage.setItem(`pos_order_channel_${currentOrgId}`, parked.orderChannel);
      if (parked.selectedTable) {
        sessionStorage.setItem(`pos_selected_table_${currentOrgId}`, String(parked.selectedTable));
      }
      if (parked.customerName) {
        sessionStorage.setItem(`pos_customer_name_${currentOrgId}`, parked.customerName);
      }
      if (parked.customerPhone) {
        sessionStorage.setItem(`pos_customer_phone_${currentOrgId}`, parked.customerPhone);
      }
      if (parked.deliveryZone) {
        sessionStorage.setItem(`pos_delivery_zone_${currentOrgId}`, parked.deliveryZone);
      }
      handleDiscardHeldOrder(parked.id);
    } catch { }
    // Navigate back to POS register with recalled order
    router.push("/terminal/pos");
  };

  return (
    <div className="flex-1 w-full flex h-full min-h-0 relative overflow-hidden bg-[var(--bg)] text-[var(--text-hi)]">
      {/* Left Navigation Sidebar */}
      <PosSidebar
        currentView="orders"
        heldOrdersCount={parkedOrders.length}
        activeOrdersCount={runningTableOrders.length}
        activeShift={activeShift}
        onSelectView={(v) => {
          if (v === "register") {
            router.push("/terminal/pos");
          }
        }}
        onOpenHeldOrders={() => setSelectedTab("held")}
        onOpenRecentOrders={() => setSelectedTab("settled")}
        onOpenOrdersHub={(tab) => setSelectedTab(tab || "all")}
        onOpenCashDrawer={() => {}}
      />

      {/* Main Order Management Hub Workspace */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 lg:pb-0">
        <UnifiedOrdersView
          orders={orders}
          runningOrders={runningTableOrders}
          parkedOrders={parkedOrders}
          enableKitchenKds={enableKitchenKds}
          onBackToRegister={() => router.push("/terminal/pos")}
          onSettleOrder={handleSettleOrder}
          onRecallHeldOrder={handleRecallHeldOrder}
          onDiscardHeldOrder={handleDiscardHeldOrder}
          onReprintOrder={(ord) => setActiveReceiptOrder(ord)}
          currencySymbol="Rs"
          initialTab={selectedTab}
          onRefresh={() => fetchOrders(true)}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Direct Payment Tender Modal */}
      {targetOrderForSettlement && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setTargetOrderForSettlement(null);
          }}
          subtotal={targetOrderForSettlement.subtotal}
          taxAmount={targetOrderForSettlement.taxAmount}
          taxRatePercent={taxRatePercent}
          discountPercent={discountPercent}
          setDiscountPercent={setDiscountPercent}
          flatDiscount={flatDiscount}
          setFlatDiscount={setFlatDiscount}
          discountMode={discountMode}
          setDiscountMode={setDiscountMode}
          cartTotal={targetOrderForSettlement.total}
          selectedMethod={paymentMethod}
          setSelectedMethod={setPaymentMethod}
          onConfirmSettlement={handleConfirmSettlement}
        />
      )}

      {/* Thermal Receipt Dialog */}
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
    </div>
  );
}
