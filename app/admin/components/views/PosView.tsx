"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Search,
  Plus,
  Minus,
  UtensilsCrossed,
  ChefHat,
  Receipt,
  Printer,
  X,
  CheckCircle2,
  Building2,
  Calendar,
  CreditCard,
  QrCode,
  Banknote,
  Sparkles,
  Star,
  LayoutGrid,
  AlertTriangle,
  Users,
  User,
  Phone,
  ChevronDown,
  Check,
  Lock,
  RotateCcw,
  MapPin,
} from "lucide-react";
import { MenuItem, CartItem, TableStatus, OrderRecord, StaffMember } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useAdminCache, mapRowToTableStatus } from "../../context/AdminCacheContext";
import { saveStoredOrder, saveStoredTables } from "../../../../lib/tenantStore";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import ShiftSettlementModal from "./ShiftSettlementModal";

interface PosViewProps {
  menuItems: MenuItem[];
  cart: CartItem[];
  handleAddToCart: (item: MenuItem) => void;
  handleUpdateCartQty: (itemId: string, delta: number) => void;
  orderChannel: "dine_in" | "takeaway" | "delivery";
  setOrderChannel: (ch: "dine_in" | "takeaway" | "delivery") => void;
  selectedTable: number;
  setSelectedTable: (id: number) => void;
  tables: TableStatus[];
  setTables?: React.Dispatch<React.SetStateAction<TableStatus[]>>;
  paymentMethod: "cash" | "card" | "raast";
  setPaymentMethod: (p: "cash" | "card" | "raast") => void;
  cartSubtotal: number;
  taxAmount: number;
  taxRatePercent?: number;
  discountPercent: number;
  discountAmount: number;
  cartTotal: number;
  handleSendToKitchen: (deliveryMeta?: { customerName?: string; customerPhone?: string; deliveryZone?: string }) => void;
  onSettleOrder?: (order: OrderRecord) => void;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  orders?: OrderRecord[];
  staffList?: StaffMember[];
  showToast: (msg: string) => void;
}

export default function PosView({
  menuItems,
  cart,
  handleAddToCart,
  handleUpdateCartQty,
  orderChannel,
  setOrderChannel,
  selectedTable,
  setSelectedTable,
  tables,
  setTables,
  paymentMethod,
  setPaymentMethod,
  cartSubtotal,
  taxAmount,
  taxRatePercent = 16,
  discountPercent,
  discountAmount,
  cartTotal,
  handleSendToKitchen,
  onSettleOrder,
  setCart,
  orders = [],
  staffList = [],
  showToast,
}: PosViewProps) {
  const { user } = useAuth();
  const currentOrgId = user?.organizationId || user?.id || "default";

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Delivery Order State (Customer Name, Phone, and Delivery Destination Area)
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [deliveryZone, setDeliveryZone] = useState<string>("");

  const cartItemCount = useMemo(() => cart.reduce((acc, curr) => acc + curr.quantity, 0), [cart]);

  // Thermal Receipt Modal State
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<OrderRecord | null>(null);

  const { branchSettings } = useAdminCache();

  // Live Supabase tables state & floor modal (backed by SWR cache)
  const [liveTables, setLiveTables] = useState<TableStatus[]>(() => (tables && tables.length > 0 ? tables : []));
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [floorFilterSection, setFloorFilterSection] = useState<string>("all");
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Sync with cached tables from parent/store
  useEffect(() => {
    if (tables && tables.length > 0) {
      setLiveTables(tables);
    }
  }, [tables]);

  // Fetch live active tables from Supabase public.restaurant_tables (Background revalidation)
  const fetchLiveTables = async () => {
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restId)
        .order("table_number", { ascending: true });

      if (!error && data) {
        const mapped: TableStatus[] = data.map((t: any, idx: number) => mapRowToTableStatus(t, idx));
        setLiveTables(mapped);
        if (setTables) {
          setTables(mapped);
        }
      }
    } catch (e) {
      console.warn("[PosView] Live table fetch warning:", e);
    }
  };

  useEffect(() => {
    // Only perform fetch if no tables exist in cache
    if (!tables || tables.length === 0) {
      fetchLiveTables();
    }

    let channel: any = null;
    let isSubscribed = true;

    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        if (!isSubscribed) return;

        channel = supabase
          .channel(`realtime:pos_tables:${restId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "restaurant_tables",
              filter: `restaurant_id=eq.${restId}`,
            },
            (payload: any) => {
              if (!isSubscribed) return;
              if (payload.eventType === "UPDATE") {
                const updatedRow = payload.new;
                const mappedStatus = mapRowToTableStatus(updatedRow);
                setLiveTables((prev) =>
                  prev.map((t) =>
                    String(t.dbId) === String(updatedRow.id) ||
                    String(t.id) === String(updatedRow.id) ||
                    t.label === updatedRow.table_number
                      ? mappedStatus
                      : t
                  )
                );
                if (setTables) {
                  setTables((prev) =>
                    prev.map((t) =>
                      String(t.dbId) === String(updatedRow.id) ||
                      String(t.id) === String(updatedRow.id) ||
                      t.label === updatedRow.table_number
                        ? mappedStatus
                        : t
                    )
                  );
                }
              } else if (payload.eventType === "INSERT") {
                const newRow = payload.new;
                const mappedStatus = mapRowToTableStatus(newRow);
                setLiveTables((prev) => [...prev.filter((t) => String(t.dbId) !== String(newRow.id)), mappedStatus]);
                if (setTables) {
                  setTables((prev) => [...prev.filter((t) => String(t.dbId) !== String(newRow.id)), mappedStatus]);
                }
              } else if (payload.eventType === "DELETE") {
                const oldId = payload.old?.id;
                setLiveTables((prev) => prev.filter((t) => String(t.dbId) !== String(oldId) && String(t.id) !== String(oldId)));
                if (setTables) {
                  setTables((prev) => prev.filter((t) => String(t.dbId) !== String(oldId) && String(t.id) !== String(oldId)));
                }
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("[PosView] Realtime subscription error:", err);
      }
    })();

    return () => {
      isSubscribed = false;
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [user]);

  const displayTables = liveTables.length > 0 ? liveTables : tables;
  const selectedTableObj = displayTables.find((t) => t.id === selectedTable) || displayTables[0];

  // Helper to find running active order for a given table
  const getTableActiveOrder = (table: TableStatus | undefined) => {
    if (!table) return undefined;
    return orders.find(
      (o) =>
        (o.tableId === table.id ||
          (table.activeOrderId && (o.id === table.activeOrderId || o.kotId === table.activeOrderId))) &&
        o.status !== "completed" &&
        o.status !== "cancelled"
    );
  };

  const activeRunningOrder = getTableActiveOrder(selectedTableObj);

  // Table selection with automated recall
  const handleSelectTable = (tableId: number, explicitRecall = true) => {
    setSelectedTable(tableId);
    const targetTable = displayTables.find((t) => t.id === tableId);
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
            menuItems.find((m) => m.id === it.id || m.name.toLowerCase() === it.name.toLowerCase()) || {
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
        showToast(`Recalled running tab for ${targetTable.label} (Rs ${runningOrder.total.toLocaleString()}).`);
      }
    }
  };

  // Dynamic Categories with live item counts for dropdown
  const posCategoriesList = useMemo(() => {
    const defaultCats = [
      { id: "karahi", label: "Karahi & Handi" },
      { id: "bbq", label: "Desi BBQ & Tandoor" },
      { id: "burgers", label: "Smash Burgers" },
      { id: "fast_food", label: "Fast Food & Pizza" },
      { id: "drinks", label: "Beverages & Tea" },
      { id: "desserts", label: "Desserts" },
    ];

    const map = new Map<string, { id: string; label: string; count: number }>();

    defaultCats.forEach((cat) => {
      map.set(cat.id.toLowerCase(), {
        id: cat.id,
        label: cat.label,
        count: 0,
      });
    });

    menuItems.forEach((item) => {
      const catKey = (item.category || "other").toLowerCase();
      if (map.has(catKey)) {
        map.get(catKey)!.count += 1;
      } else {
        const label = item.category
          ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
          : "Other";
        map.set(catKey, {
          id: item.category,
          label,
          count: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [menuItems]);

  const filteredMenuItems = menuItems.filter((item) => {
    const matchCategory =
      selectedCategory === "all" ||
      (item.category || "").toLowerCase() === selectedCategory.toLowerCase();
    const matchSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Handle Settle and Open Thermal Receipt Slip
  const handleSettleAndPrint = () => {
    if (cart.length === 0) {
      showToast("Please add items to bill before settling order.");
      return;
    }

    const orderNumber = `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const resolvedOrderId =
      orderChannel === "dine_in" && activeRunningOrder?.id
        ? activeRunningOrder.id
        : orderNumber;

    const now = new Date();
    const formattedTimestamp = now.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const dishPrepTimes = cart.map((c) => {
      return (
        c.item.preparation_time ||
        parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
        15
      );
    });
    const orderEstimatedPrepTime = dishPrepTimes.length > 0 ? Math.max(...dishPrepTimes) : 15;

    const newOrder: OrderRecord = {
      id: resolvedOrderId,
      kotId: activeRunningOrder?.kotId,
      orderChannel: orderChannel,
      delivery_zone: orderChannel === "delivery" ? (deliveryZone.trim() || undefined) : undefined,
      customerName: orderChannel === "delivery" ? (customerName.trim() || "Delivery Customer") : undefined,
      customerPhone: orderChannel === "delivery" ? (customerPhone.trim() || undefined) : undefined,
      rider_id: null,
      assignedRiderId: undefined,
      assignedRiderName: undefined,
      tableId: orderChannel === "dine_in" ? selectedTable : undefined,
      tableName:
        orderChannel === "dine_in"
          ? (selectedTableObj?.label || `Table ${selectedTable}`)
          : orderChannel === "delivery"
            ? (customerName.trim() || "Delivery Order")
            : undefined,
      items: cart.map((c) => {
        const itemPrepMinutes =
          c.item.preparation_time ||
          parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
          15;
        return {
          id: c.item.id,
          name: c.item.name,
          price: c.item.price,
          quantity: c.quantity,
          notes: c.notes,
          prepTime: c.item.prepTime || `${itemPrepMinutes}m`,
          preparation_time: itemPrepMinutes,
        };
      }),
      estimatedPrepTime: orderEstimatedPrepTime,
      estimated_prep_time: orderEstimatedPrepTime,
      subtotal: cartSubtotal,
      taxAmount: taxAmount,
      discountPercent: discountPercent,
      discountAmount: discountAmount,
      total: cartTotal,
      paymentMethod: paymentMethod,
      cashierName: user?.name || "Terminal Cashier",
      timestamp: formattedTimestamp,
      status: orderChannel === "delivery" ? "queued" : "completed",
    };

    // 1. Save to tenant persistence & state
    if (onSettleOrder) {
      onSettleOrder(newOrder);
    } else {
      saveStoredOrder(currentOrgId, newOrder);
    }

    // 2. Free up table if dine_in
    if (orderChannel === "dine_in") {
      if (setTables) {
        setTables((prev) => {
          const updated = prev.map((t) =>
            t.id === selectedTable
              ? { ...t, status: "available" as const, activeOrderId: undefined, activeAmount: undefined, timeSeated: undefined }
              : t
          );
          saveStoredTables(currentOrgId, updated);
          return updated;
        });
      }

      setLiveTables((prev) =>
        prev.map((t) =>
          t.id === selectedTable
            ? { ...t, status: "available" as const, activeOrderId: undefined, activeAmount: undefined, timeSeated: undefined }
            : t
        )
      );

      // Two-way sync: Direct update to Supabase public.restaurant_tables
      (async () => {
        try {
          const supabase = createClient();
          const { restId } = await getValidTenantContext(user);
          const targetTable = displayTables.find((t) => t.id === selectedTable);
          const dbId = targetTable?.dbId;
          const tableNum = targetTable?.label || `Table ${selectedTable}`;

          const isUuid = typeof dbId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbId);

          let query = supabase
            .from("restaurant_tables")
            .update({
              status: "available",
              current_order_id: null,
              active_order_id: null,
              updated_at: new Date().toISOString(),
            });

          if (isUuid) {
            query = query.or(`id.eq.${dbId},table_number.eq.${tableNum}`);
          } else if (tableNum) {
            query = query.eq("table_number", tableNum);
          }

          const { error: relErr } = await query.eq("restaurant_id", restId);
          if (relErr) {
            console.warn("[PosView] Direct table release error:", relErr);
          } else {
            console.log(`[PosView] Table ${tableNum} marked AVAILABLE in database.`);
          }
        } catch (e) {
          console.warn("[PosView] Direct table release error:", e);
        }
      })();
    }

    // 3. Clear cart & delivery inputs
    setCart([]);
    setDeliveryZone("");
    setCustomerName("");
    setCustomerPhone("");
    setIsMobileCartOpen(false);

    // 4. Open Thermal Receipt Slip modal
    setActiveReceiptOrder(newOrder);
    showToast(`Order ${newOrder.id} settled. Thermal receipt ready.`);
  };

  const handlePrintSlip = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Reusable Active Order Ticket Panel (used in Desktop Sidebar and Mobile Slide-Over Drawer)
  const renderCartTicketContent = (isDrawer: boolean) => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 1. Header & Channel Selector */}
      <div className="shrink-0 space-y-2 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="font-display font-black text-sm text-[var(--text-hi)] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[var(--gold)]" /> Active Order Ticket
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--text-faint)]">
              {cartItemCount} items
            </span>
            {isDrawer && (
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] cursor-pointer transition-colors"
                aria-label="Close Order Ticket"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Order Channel Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-[var(--surface-hi)] p-1 rounded-xl border border-[var(--border)] text-xs font-mono font-medium">
          {(["dine_in", "takeaway", "delivery"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setOrderChannel(ch)}
              className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer text-center capitalize ${
                orderChannel === ch
                  ? "bg-[var(--gold)] text-[#1a1400] font-bold shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
              }`}
            >
              {ch.replace("_", "-")}
            </button>
          ))}
        </div>

        {/* Dine-In: Single compact row for table select & Floor Grid (No redundant preview card) */}
        {orderChannel === "dine_in" ? (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <select
                  value={selectedTable}
                  onChange={(e) => handleSelectTable(Number(e.target.value), true)}
                  className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] rounded-lg py-1.5 pl-2.5 pr-7 text-xs text-[var(--text-hi)] font-mono focus:border-[var(--gold)] focus:outline-none cursor-pointer truncate"
                >
                  {displayTables.length === 0 ? (
                    <option value="" disabled>
                      No tables configured
                    </option>
                  ) : (
                    displayTables.map((t) => {
                      const isOccupied = t.status === "seated" || t.status === "occupied";
                      const isBilled = t.status === "billing";
                      const isReserved = t.status === "reserved";
                      const runningOrder = getTableActiveOrder(t);
                      const runningAmount = runningOrder?.total ?? t.activeAmount;
                      const amountStr = runningAmount ? ` • Rs ${runningAmount.toLocaleString()}` : "";

                      const statusTag = isOccupied
                        ? `[OCCUPIED${amountStr}]`
                        : isBilled
                        ? `[BILLED${amountStr}]`
                        : isReserved
                        ? "[RESERVED]"
                        : "[AVAILABLE]";
                      return (
                        <option key={t.id} value={t.id} className="bg-[#140c0c] text-[#f7f0dd]">
                          {t.label} ({t.capacity}s) — {statusTag}
                        </option>
                      );
                    })
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
              </div>

              <button
                type="button"
                onClick={() => setIsFloorModalOpen(true)}
                className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-[var(--gold)] hover:text-white bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/50 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                title="Open Floor Plan Grid"
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Grid</span>
              </button>
            </div>

            {/* Active Running Tab Recalled Notice (Only when occupied/billing) */}
            {selectedTableObj && (selectedTableObj.status === "seated" || selectedTableObj.status === "occupied" || selectedTableObj.status === "billing") && (
              <div className="p-2 rounded-lg bg-gradient-to-r from-red-500/15 via-amber-500/10 to-red-500/15 border border-red-500/30 flex items-center justify-between text-[11px] font-mono">
                <span className="text-red-300 truncate">
                  Tab: {selectedTableObj.label} {activeRunningOrder ? `(Rs ${activeRunningOrder.total.toLocaleString()})` : ""}
                </span>
                {activeRunningOrder && (
                  <button
                    type="button"
                    onClick={() => handleSelectTable(selectedTable, true)}
                    className="text-[10px] text-[var(--gold)] hover:underline shrink-0 ml-2"
                  >
                    Reload
                  </button>
                )}
              </div>
            )}
          </div>
        ) : orderChannel === "takeaway" ? (
          <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)]">
            <span className="font-mono text-[var(--text-faint)]">DISPATCH:</span>
            <span className="font-mono font-bold text-[var(--gold)]">
              Takeaway Pickup Counter
            </span>
          </div>
        ) : (
          /* Delivery Mode: Customer Name, Phone, and Delivery Destination Area */
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[var(--text-faint)] flex items-center gap-1 font-bold">
                    <User className="w-3 h-3 text-[var(--gold)]" />
                    CUSTOMER NAME:
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Ahmed Ali"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[var(--text-faint)] flex items-center gap-1 font-bold">
                    <Phone className="w-3 h-3 text-[var(--gold)]" />
                    PHONE NUMBER:
                  </span>
                </div>
                <input
                  type="tel"
                  placeholder="0300-1234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-[var(--text-faint)] flex items-center gap-1 font-bold">
                  <MapPin className="w-3 h-3 text-[var(--gold)]" />
                  DELIVERY DESTINATION AREA:
                </span>
                {deliveryZone.trim() && (
                  <span className="text-blue-400 font-bold">
                    Zone Set
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Type delivery area (e.g. Sector F-7, Gulberg)..."
                value={deliveryZone}
                onChange={(e) => setDeliveryZone(e.target.value)}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-lg py-1.5 px-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Expanded Cart Items Container (Prominently Visible & Scrollable) */}
      <div className="flex-1 min-h-[80px] overflow-y-auto space-y-1.5 pr-1 my-1.5 divide-y divide-[var(--border)]">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6 border border-dashed border-[var(--border)] rounded-xl text-[var(--text-faint)] space-y-1 my-auto">
            <UtensilsCrossed className="w-6 h-6 text-[var(--text-faint)] opacity-60" />
            <p className="text-xs font-mono">Order cart is empty</p>
          </div>
        ) : (
          cart.map((c) => (
            <div
              key={c.item.id}
              className="flex items-center justify-between py-1.5 text-xs gap-2 first:pt-0"
            >
              <div className="flex-1 min-w-0 pr-1">
                <p className="font-medium text-[var(--text-hi)] truncate">{c.item.name}</p>
                <span className="text-[11px] text-[var(--text-lo)] font-mono">
                  Rs {c.item.price.toLocaleString()} each
                </span>
              </div>

              {/* Compact Quantity Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center border border-[var(--border)] rounded-md bg-[var(--bg-deep)]">
                  <button
                    type="button"
                    onClick={() => handleUpdateCartQty(c.item.id, -1)}
                    className="px-2 py-0.5 text-[var(--text-lo)] hover:text-white cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-1 text-xs font-semibold text-[var(--text-hi)] font-mono">
                    {c.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateCartQty(c.item.id, 1)}
                    className="px-2 py-0.5 text-[var(--text-lo)] hover:text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <span className="font-semibold text-[var(--text-hi)] font-mono min-w-[60px] text-right">
                  Rs {(c.item.price * c.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Compact Totals & Settlement Actions - Pinned and Guaranteed Visible */}
      <div className="shrink-0 bg-[var(--bg-deep)] pt-2 border-t border-[var(--border)] space-y-1.5 text-xs pb-1">
        <div className="space-y-0.5 font-mono">
          <div className="flex items-center justify-between text-xs py-0.5 text-[var(--text-lo)]">
            <span>Subtotal</span>
            <span>Rs {cartSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs py-0.5 text-[var(--text-lo)]">
            <span>Sales Tax ({taxRatePercent}%)</span>
            <span>Rs {taxAmount.toLocaleString()}</span>
          </div>
          {discountPercent > 0 && (
            <div className="flex items-center justify-between text-[#25d366] text-xs py-0.5">
              <span>Discount ({discountPercent}%)</span>
              <span>- Rs {discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-bold text-[var(--gold)] py-1 border-t border-[var(--border)]">
            <span>Total Amount</span>
            <span>Rs {cartTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Compact Payment Method Pills */}
        <div className="grid grid-cols-3 gap-1.5 my-1">
          {[
            { id: "cash", label: "Cash", icon: Banknote },
            { id: "card", label: "Card / POS", icon: CreditCard },
            { id: "raast", label: "Raast QR", icon: QrCode },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaymentMethod(p.id as any)}
              className={`py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                paymentMethod === p.id
                  ? "bg-[var(--gold-dim)] border-[var(--gold)] text-[var(--gold)] shadow-sm font-bold"
                  : "bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)]"
              }`}
            >
              <p.icon className="w-3.5 h-3.5" />
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Action Buttons: Send to Kitchen & Settle Bill */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              handleSendToKitchen({ customerName, customerPhone, deliveryZone });
              if (orderChannel === "delivery") {
                setCustomerName("");
                setCustomerPhone("");
                setDeliveryZone("");
              }
            }}
            className="py-2.5 px-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--gold)]/40 hover:bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <ChefHat className="w-4 h-4" />
            <span>Send KOT</span>
          </button>

          <button
            type="button"
            onClick={handleSettleAndPrint}
            className="btn-gold animate-sheen py-2.5 px-3 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
          >
            <Receipt className="w-4 h-4" />
            <span>Settle &amp; Print</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row min-h-0 relative">
      {/* Scoped CSS for Thermal Receipt 80mm Printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-print-area,
          #thermal-receipt-print-area * {
            visibility: visible !important;
          }
          #thermal-receipt-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 6mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Left: Menu Catalog & Item Selector (Full Width on Mobile & Tablet) */}
      <div className="w-full flex-1 p-4 sm:p-8 overflow-y-auto space-y-6">
        {/* Header Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
              • LIVE POS TERMINAL
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
              Point of Sale &amp;{" "}
              <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                Billing Counter
              </span>
            </h1>
            <p className="text-xs text-[var(--text-lo)] mt-1 font-medium">
              Order ticket dispatch, dining table tabs, and receipt printing.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Persistent Active Ticket Trigger for Mobile/Tablet (< 1024px) */}
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="lg:hidden px-3.5 py-1.5 rounded-full bg-[var(--gold-dim)] hover:bg-[var(--surface-hi)] border border-[var(--gold)]/40 text-[11px] font-mono font-bold text-[var(--gold)] flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              title="View Active Order Ticket"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Active Ticket {cartItemCount > 0 ? `(${cartItemCount})` : ""}</span>
            </button>

            <span className="px-3 py-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono font-bold text-[var(--gold)] flex items-center gap-1.5 shadow-sm">
              <Clock className="w-3.5 h-3.5" /> Shift Active • Cashier Terminal
            </span>
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-[11px] font-mono font-bold text-[var(--text-hi)] flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              title="Reconcile Cash Drawer, End Shift & Print Z-Report"
            >
              <Lock className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>End Shift / Z-Report</span>
            </button>
          </div>
        </div>

        {/* Unified Category Dropdown & Search Bar in a Single Horizontal Row */}
        <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
          {/* Category Dropdown (styled identically to search bar) */}
          <div className="relative w-[44%] sm:w-60 shrink-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--text-hi)] text-xs font-mono rounded-xl pl-3 pr-8 py-2.5 h-10 focus:outline-none transition-all shadow-inner cursor-pointer"
            >
              <option value="all" className="bg-[#1a1400] text-[var(--text-hi)]">
                All Categories ({menuItems.length})
              </option>
              {posCategoriesList.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-[#1a1400] text-[var(--text-hi)]">
                  {cat.label} ({cat.count})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Live Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-3 py-2.5 h-10 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Food Items Grid */}
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {menuItems.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--surface-hi)] border border-white/10 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white tracking-wide">No menu items created yet</h3>
              <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">
                Add dishes in Menu Management to start taking orders.
              </p>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--surface-hi)] border border-white/10 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white tracking-wide">No matching dishes</h3>
              <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">
                Try adjusting your search query or category filter.
              </p>
            </div>
          ) : (
            filteredMenuItems.map((item) => {
              const isOutOfStock =
                item.stockStatus === "out_of_stock" || Boolean(item.isAutoOutOfStock);

              const onDishClick = () => {
                if (isOutOfStock) {
                  showToast(
                    item.isAutoOutOfStock
                      ? "Ingredient unavailable in kitchen inventory."
                      : `Item "${item.name}" is currently sold out.`
                  );
                  return;
                }
                handleAddToCart(item);
              };

              return (
                <div
                  key={item.id}
                  onClick={onDishClick}
                  className={`glass-panel p-4 sm:p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-3 relative overflow-hidden ${
                    isOutOfStock
                      ? "opacity-60 grayscale-[40%] border-red-500/30 bg-black/30 cursor-not-allowed"
                      : "border-[var(--border)] hover:border-[var(--gold)]/50 hover:shadow-xl hover:shadow-[var(--gold-glow)]/10 cursor-pointer group"
                  }`}
                >
                  {/* Clean Greyed-out Sold Out Overlay Badge */}
                  {isOutOfStock && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[1.5px] p-3 text-center pointer-events-auto">
                      <span className="px-3 py-1 rounded-full bg-red-600/90 text-white font-mono text-[11px] font-black tracking-wider uppercase shadow-lg shadow-red-600/30">
                        SOLD OUT / OUT OF STOCK
                      </span>
                      {item.isAutoOutOfStock ? (
                        <span className="text-[10px] font-mono text-red-200/90 mt-1.5 font-semibold">
                          Ingredient unavailable in kitchen inventory
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-400 mt-1">
                          Temporarily unavailable
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="w-11 h-11 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      {item.imageIcon}
                    </div>
                    {isOutOfStock ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-mono text-[10px] font-bold uppercase">
                        Sold Out
                      </span>
                    ) : item.stockStatus === "low_stock" ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold uppercase">
                        Low: {item.stockCount}
                      </span>
                    ) : item.isPopular ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[10px] font-bold uppercase">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span>Popular</span>
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h4 className="font-display font-bold text-sm text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors leading-snug">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-[var(--text-faint)] font-mono mt-0.5">
                      Prep Time: ~{item.prepTime}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <span className="font-mono font-extrabold text-sm text-[var(--gold)]">
                      Rs {item.price.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDishClick();
                      }}
                      className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
                        isOutOfStock
                          ? "bg-zinc-800/40 border-zinc-700 text-zinc-500 cursor-not-allowed"
                          : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-[#1a1400] group-hover:border-[var(--gold)] cursor-pointer"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Desktop Right Panel: Permanent Cart & Billing Settlements (Screens >= lg) */}
      <div id="pos-cart-panel" className="hidden lg:flex lg:w-[400px] xl:w-[420px] bg-[var(--bg-deep)] border-l border-[var(--border)] p-4 sm:p-6 flex-col justify-between h-auto lg:h-screen shrink-0 shadow-2xl z-10">
        {renderCartTicketContent(false)}
      </div>

      {/* ========================================================================= */}
      {/* MOBILE & TABLET: SLIDE-OVER CART DRAWER (< 1024px) */}
      {/* ========================================================================= */}
      {/* Dark Backdrop Overlay */}
      {isMobileCartOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileCartOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-over Sheet from the Right */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] max-h-screen bg-[var(--bg-deep)] border-l border-[var(--border)] shadow-2xl p-4 sm:p-5 flex flex-col overflow-y-auto lg:hidden transition-transform duration-300 ease-in-out ${
          isMobileCartOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        {renderCartTicketContent(true)}
      </div>

      {/* ========================================================================= */}
      {/* MOBILE & TABLET: FLOATING ACTION BAR TRIGGER (< 1024px) */}
      {/* ========================================================================= */}
      {(cart.length > 0 ||
        (orderChannel === "dine_in" &&
          (selectedTableObj?.status === "seated" ||
            selectedTableObj?.status === "occupied" ||
            selectedTableObj?.status === "billing" ||
            Boolean(activeRunningOrder)))) && (
        <div className="fixed bottom-4 right-4 z-40 lg:hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-bold px-5 py-3 rounded-2xl shadow-xl shadow-amber-900/40 active:scale-95 transition-all cursor-pointer"
          >
            <div className="relative">
              <Receipt className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 bg-neutral-950 text-amber-400 text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartItemCount}
              </span>
            </div>
            <span>Active Order</span>
            <span className="bg-neutral-950/20 px-2 py-0.5 rounded-lg text-sm font-mono">
              Rs {cartTotal.toLocaleString()}
            </span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 80mm THERMAL RECEIPT MODAL DIALOG */}
      {/* ========================================================================= */}
      {activeReceiptOrder && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveReceiptOrder(null);
          }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto custom-scrollbar animate-in fade-in duration-200"
        >
          <div className="relative max-w-md w-full flex flex-col items-center my-auto space-y-4 animate-in zoom-in-95 duration-150">
            {/* Top Bar Action Buttons (Excluded from Thermal Print) */}
            <div className="w-full flex items-center justify-between no-print px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#25d366] animate-pulse" />
                <span className="font-mono text-xs font-bold text-[var(--text-hi)]">
                  Thermal Slip Ready • 80mm
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceiptOrder(null)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            {/* Authentic 80mm Thermal Receipt Paper Slip */}
            <div
              id="thermal-receipt-print-area"
              className="w-full max-w-[320px] bg-white text-black p-4 sm:p-6 rounded-lg shadow-2xl font-mono text-[11px] leading-tight select-text border border-neutral-300 mx-auto"
              style={{
                fontFamily: "'Courier New', Courier, monospace",
              }}
            >
              {/* Receipt Header */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-neutral-400">
                <h2 className="font-black text-base tracking-wider uppercase text-neutral-900">
                  {user?.restaurantName || "THE ROYAL HAVELI"}
                </h2>
                <p className="text-[10px] text-neutral-600">
                  {user?.branchName || user?.address || "Main Boulevard, Gulberg III, Lahore"}
                </p>
                <p className="text-[9px] text-neutral-500">
                  Phone: {user?.phone || "+92 300 8472910"}
                </p>
                <p className="text-[9px] text-neutral-500">
                  STRN: 32778761-0 • NTN: 8492018-4
                </p>
                <div className="pt-1 font-bold text-[10px] tracking-wide text-neutral-800 uppercase">
                  *** TAX INVOICE ***
                </div>
              </div>

              {/* Order Meta Info */}
              <div className="py-2.5 space-y-0.5 text-[10px] text-neutral-700 border-b border-dashed border-neutral-400">
                <div className="flex justify-between">
                  <span>INVOICE NO:</span>
                  <span className="font-bold text-neutral-900">{activeReceiptOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE/TIME:</span>
                  <span>{activeReceiptOrder.timestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span>CHANNEL:</span>
                  <span className="uppercase font-bold">
                    {activeReceiptOrder.orderChannel === "dine_in"
                      ? activeReceiptOrder.tableName || `Table ${activeReceiptOrder.tableId}`
                      : activeReceiptOrder.orderChannel === "takeaway"
                      ? "TAKEAWAY COUNTER"
                      : "DELIVERY RIDER"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>CASHIER:</span>
                  <span>{activeReceiptOrder.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>PAYMENT MODE:</span>
                  <span className="uppercase font-bold">{activeReceiptOrder.paymentMethod}</span>
                </div>
                {activeReceiptOrder.customerName && (
                  <div className="flex justify-between text-neutral-900">
                    <span>CUSTOMER:</span>
                    <span className="font-bold truncate max-w-[150px]">{activeReceiptOrder.customerName}</span>
                  </div>
                )}
                {activeReceiptOrder.customerPhone && (
                  <div className="flex justify-between text-neutral-900">
                    <span>PHONE:</span>
                    <span className="font-bold">{activeReceiptOrder.customerPhone}</span>
                  </div>
                )}
                {activeReceiptOrder.delivery_zone && (
                  <div className="flex justify-between text-neutral-900">
                    <span>DELIVERY AREA:</span>
                    <span className="font-bold truncate max-w-[150px]">{activeReceiptOrder.delivery_zone}</span>
                  </div>
                )}
                {activeReceiptOrder.assignedRiderName && (
                  <div className="flex justify-between text-neutral-900">
                    <span>RIDER:</span>
                    <span className="font-bold">{activeReceiptOrder.assignedRiderName}</span>
                  </div>
                )}
              </div>

              {/* Itemized Table Header */}
              <div className="py-2 border-b border-dashed border-neutral-400">
                <div className="flex justify-between text-[10px] font-bold text-neutral-900 pb-1">
                  <span className="w-1/2">ITEM</span>
                  <span className="w-1/6 text-center">QTY</span>
                  <span className="w-1/3 text-right">PRICE (PKR)</span>
                </div>

                {/* Items */}
                <div className="space-y-1 pt-1">
                  {activeReceiptOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[10.5px]">
                      <span className="w-1/2 truncate font-semibold text-neutral-800">{it.name}</span>
                      <span className="w-1/6 text-center text-neutral-700 font-bold">{it.quantity}</span>
                      <span className="w-1/3 text-right font-bold text-neutral-900">
                        {(it.price * it.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Tax Calculation */}
              <div className="py-2.5 space-y-1 text-[10px] border-b border-dashed border-neutral-400">
                <div className="flex justify-between text-neutral-700">
                  <span>SUBTOTAL:</span>
                  <span>Rs {activeReceiptOrder.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-neutral-700">
                  <span>SALES TAX ({taxRatePercent}%):</span>
                  <span>Rs {activeReceiptOrder.taxAmount.toLocaleString()}</span>
                </div>
                {activeReceiptOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-neutral-700">
                    <span>DISCOUNT ({activeReceiptOrder.discountPercent}%):</span>
                    <span>- Rs {activeReceiptOrder.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-neutral-950 pt-1.5 border-t border-neutral-800">
                  <span>NET TOTAL:</span>
                  <span>Rs {activeReceiptOrder.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Footer Notice & Signature */}
              <div className="text-center pt-3 space-y-2 text-[9.5px] text-neutral-600">
                <p>Thank you for dining with us!</p>
                <p>Please present this invoice for customer support or feedback.</p>

                <p className="font-bold text-neutral-800 pt-1">
                  Track Live Prep: /track/{String(activeReceiptOrder.id || "").replace(/^[#%23]+/, "").trim()}
                </p>

                <div className="pt-2 pb-1 border-t border-dotted border-neutral-400 flex justify-between items-end text-[8.5px]">
                  <span>Customer Stamp</span>
                  <span>Cashier Authorized Signature</span>
                </div>

                <p className="text-[8px] text-neutral-400 pt-1 font-mono">
                  Powered by OmniPOS Enterprise Engine v2.0
                </p>
              </div>
            </div>

            {/* Bottom Modal Actions (Excluded from Print) */}
            <div className="w-full grid grid-cols-3 gap-2.5 no-print pt-2">
              <button
                type="button"
                onClick={() => {
                  const cleanTrackingId = String(activeReceiptOrder.id || "").replace(/^[#%23]+/, "").trim();
                  const trackingUrl = `/track/${encodeURIComponent(cleanTrackingId)}`;
                  window.open(trackingUrl, "_blank");
                }}
                className="py-3 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer transition-colors text-center flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Tracker</span>
              </button>

              <button
                type="button"
                onClick={handlePrintSlip}
                className="btn-gold animate-sheen py-3 px-3 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReceiptOrder(null)}
                className="py-3 px-3 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-hi)] border border-[var(--border)] text-xs font-bold cursor-pointer transition-colors text-center"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floor Matrix Quick Selection Modal */}
      {isFloorModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFloorModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 no-print"
        >
          <div className="w-[95vw] max-w-2xl rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl p-4 sm:p-6 space-y-4 max-h-[90vh] flex flex-col mx-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/25 text-[var(--gold)] flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-hi)]">
                    Dining Room Floor Matrix
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFloorModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            {/* Section Dropdown Filter */}
            <div className="relative w-full sm:w-64">
              <select
                value={floorFilterSection}
                onChange={(e) => setFloorFilterSection(e.target.value)}
                className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--text-hi)] text-xs font-mono rounded-xl pl-3 pr-8 py-2 h-9 focus:outline-none transition-all shadow-inner cursor-pointer"
              >
                <option value="all" className="bg-[#1a1400] text-[var(--text-hi)]">
                  All Sections ({displayTables.length})
                </option>
                {Array.from(new Set(displayTables.map((t) => t.section || "Main Dining"))).map((sec) => {
                  const count = displayTables.filter((t) => (t.section || "Main Dining") === sec).length;
                  return (
                    <option key={sec} value={sec} className="bg-[#1a1400] text-[var(--text-hi)]">
                      {sec} ({count})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Floor Tables Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto pr-1 py-1">
              {displayTables
                .filter(
                  (t) =>
                    floorFilterSection === "all" ||
                    (t.section || "Main Dining") === floorFilterSection
                )
                .map((t) => {
                  const isSelected = t.id === selectedTable;
                  const isOccupied = t.status === "seated" || t.status === "occupied";
                  const isBilled = t.status === "billing";
                  const isReserved = t.status === "reserved";
                  const runningOrder = getTableActiveOrder(t);
                  const runningAmount = runningOrder?.total ?? t.activeAmount;

                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        handleSelectTable(t.id, true);
                        setIsFloorModalOpen(false);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 relative ${
                        isSelected
                          ? "border-[var(--gold)] bg-[var(--gold)]/10 shadow-md ring-1 ring-[var(--gold)]"
                          : isOccupied
                          ? "border-red-500/30 bg-red-500/5 hover:border-red-500/50"
                          : isBilled
                          ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                          : isReserved
                          ? "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50"
                          : "border-[var(--border)] bg-[var(--surface-hi)] hover:border-[var(--gold)]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-[var(--text-hi)]">
                          {t.label}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[var(--gold)]" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-[var(--text-faint)]">{t.section || "Main Dining"}</span>
                        {runningAmount !== undefined && runningAmount > 0 && (
                          <span className="font-bold text-red-400">Rs {runningAmount.toLocaleString()}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/60 text-[10px] font-mono">
                        <span className="flex items-center gap-1 text-[var(--text-muted)]">
                          <Users className="w-2.5 h-2.5" />
                          {t.capacity}
                        </span>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            isOccupied
                              ? "text-red-400 bg-red-500/15"
                              : isBilled
                              ? "text-amber-400 bg-amber-500/15"
                              : isReserved
                              ? "text-blue-400 bg-blue-500/15"
                              : "text-[#25d366] bg-[#25d366]/15"
                          }`}
                        >
                          {isOccupied ? "Occupied" : isBilled ? "Billed" : isReserved ? "Reserved" : "Available"}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={() => setIsFloorModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-xs text-[var(--text-hi)] font-medium border border-[var(--border)] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Settlement & Z-Report Modal */}
      <ShiftSettlementModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        showToast={showToast}
        cashierName={user?.name || "Terminal Cashier"}
        orders={orders}
      />
    </div>
  );
}
