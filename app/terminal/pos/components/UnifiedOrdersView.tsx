"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Layers,
  Search,
  Clock,
  User,
  Printer,
  CreditCard,
  ChefHat,
  PauseCircle,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Filter,
  X,
  RefreshCw,
  MapPin,
  Phone,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { OrderRecord } from "@/app/admin/types";
import { ParkedOrder } from "./HoldOrdersDrawer";
import ResponsiveSelect from "@/app/admin/components/ResponsiveSelect";

export type { ParkedOrder };
export type UnifiedOrderTab = "all" | "kot" | "held" | "pending" | "settled";

export interface UnifiedOrder {
  id: string;
  kotId?: string;
  source: "settled" | "kot" | "held";
  orderChannel: "dine_in" | "takeaway" | "delivery" | string;
  tableId?: number | string;
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryZone?: string;
  items: {
    id?: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
  }[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountPercent?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus: "paid" | "pending" | "held";
  kitchenStatus?: "queued" | "preparing" | "ready" | "completed" | "none";
  timestamp: string;
  cashierName?: string;
  rawOrderRecord?: OrderRecord;
  rawParkedOrder?: ParkedOrder;
}

interface UnifiedOrdersViewProps {
  orders: OrderRecord[];
  runningOrders: OrderRecord[];
  parkedOrders: ParkedOrder[];
  enableKitchenKds: boolean;
  onBackToRegister: () => void;
  onSettleOrder: (order: UnifiedOrder) => void;
  onRecallHeldOrder?: (order: ParkedOrder) => void;
  onDiscardHeldOrder?: (orderId: string) => void;
  onReprintOrder: (order: OrderRecord) => void;
  currencySymbol?: string;
  initialTab?: UnifiedOrderTab;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export default function UnifiedOrdersView({
  orders,
  runningOrders,
  parkedOrders,
  enableKitchenKds,
  onBackToRegister,
  onSettleOrder,
  onRecallHeldOrder,
  onDiscardHeldOrder,
  onReprintOrder,
  currencySymbol = "Rs",
  initialTab = "all",
  onRefresh,
  isRefreshing = false,
}: UnifiedOrdersViewProps) {
  const [activeTab, setActiveTab] = useState<UnifiedOrderTab>(
    initialTab === "kot" && !enableKitchenKds ? "all" : initialTab
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  // Keep activeTab in sync if parent changes initialTab (e.g. from POS Sidebar or Drawer)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab === "kot" && !enableKitchenKds ? "all" : initialTab);
    }
  }, [initialTab, enableKitchenKds]);

  // If KDS is disabled and activeTab was "kot", fall back to "all"
  useEffect(() => {
    if (!enableKitchenKds && activeTab === "kot") {
      setActiveTab("all");
    }
  }, [enableKitchenKds, activeTab]);

  // Unify all order records into standardized UnifiedOrder objects
  const allUnifiedOrders = useMemo<UnifiedOrder[]>(() => {
    const list: UnifiedOrder[] = [];
    const seenIds = new Set<string>();

    // 1. Running / Active KOT Orders (Kitchen & Open Table Tabs)
    runningOrders.forEach((o) => {
      const idKey = String(o.id || o.kotId || "").trim();
      if (!idKey || seenIds.has(idKey)) return;
      seenIds.add(idKey);

      const isDineIn = o.orderChannel === "dine_in";
      const resolvedTableName = isDineIn
        ? (o.tableName && o.tableName.toLowerCase().startsWith("table")
            ? o.tableName
            : o.tableId
              ? `Table ${o.tableId}`
              : undefined)
        : undefined;

      list.push({
        id: o.id,
        kotId: o.kotId,
        source: "kot",
        orderChannel: o.orderChannel || "dine_in",
        tableId: isDineIn ? o.tableId : undefined,
        tableName: resolvedTableName,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryZone: o.delivery_zone,
        items: o.items || [],
        subtotal: o.subtotal || o.total,
        taxAmount: o.taxAmount || 0,
        discountAmount: o.discountAmount || 0,
        discountPercent: o.discountPercent || 0,
        total: o.total,
        paymentMethod: o.paymentMethod || "pending",
        paymentStatus: "pending",
        kitchenStatus: (o.status as any) || "queued",
        timestamp: o.timestamp || o.created_at || new Date().toISOString(),
        cashierName: o.cashierName,
        rawOrderRecord: o,
      });
    });

    // 2. Held / Parked Orders
    parkedOrders.forEach((p) => {
      const idKey = String(p.id || "").trim();
      if (!idKey || seenIds.has(idKey)) return;
      seenIds.add(idKey);

      const items = p.cart.map((c) => ({
        id: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.quantity,
        notes: c.notes,
      }));

      const subtotal = p.cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
      const isDineIn = p.orderChannel === "dine_in";

      list.push({
        id: p.id,
        source: "held",
        orderChannel: p.orderChannel || "dine_in",
        tableId: isDineIn ? p.selectedTable : undefined,
        tableName: isDineIn && p.selectedTable ? `Table ${p.selectedTable}` : undefined,
        customerName: p.customerName,
        customerPhone: p.customerPhone,
        deliveryZone: p.deliveryZone,
        items,
        subtotal,
        taxAmount: Math.max(0, p.total - subtotal),
        discountAmount: 0,
        discountPercent: 0,
        total: p.total,
        paymentStatus: "held",
        kitchenStatus: "none",
        timestamp: p.timestamp,
        cashierName: "Held Tab",
        rawParkedOrder: p,
      });
    });

    // 3. Completed & Settled Shift Invoices
    orders.forEach((o) => {
      const idKey = String(o.id || (o as any).order_number || "").trim();
      if (!idKey || seenIds.has(idKey)) return;
      seenIds.add(idKey);

      const isDineIn = o.orderChannel === "dine_in";
      const resolvedTableName = isDineIn
        ? (o.tableName && o.tableName.toLowerCase().startsWith("table")
            ? o.tableName
            : o.tableId
              ? `Table ${o.tableId}`
              : undefined)
        : undefined;

      list.push({
        id: o.id,
        kotId: o.kotId,
        source: "settled",
        orderChannel: o.orderChannel || "dine_in",
        tableId: isDineIn ? o.tableId : undefined,
        tableName: resolvedTableName,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryZone: o.delivery_zone,
        items: o.items || [],
        subtotal: o.subtotal || o.total,
        taxAmount: o.taxAmount || 0,
        discountAmount: o.discountAmount || 0,
        discountPercent: o.discountPercent || 0,
        total: o.total,
        paymentMethod: o.paymentMethod || "cash",
        paymentStatus: "paid",
        kitchenStatus: "completed",
        timestamp: o.timestamp || o.created_at || new Date().toISOString(),
        cashierName: o.cashierName,
        rawOrderRecord: o,
      });
    });

    return list;
  }, [orders, runningOrders, parkedOrders]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: allUnifiedOrders.length,
      kot: allUnifiedOrders.filter(
        (o) => o.source === "kot" && o.paymentStatus !== "paid"
      ).length,
      held: allUnifiedOrders.filter((o) => o.source === "held").length,
      pending: allUnifiedOrders.filter(
        (o) => o.paymentStatus === "pending" || o.paymentStatus === "held"
      ).length,
      settled: allUnifiedOrders.filter((o) => o.paymentStatus === "paid").length,
    };
  }, [allUnifiedOrders]);

  // Filter orders by active tab, search query, and channel
  const filteredOrders = useMemo(() => {
    return allUnifiedOrders.filter((order) => {
      // 1. Tab Filter
      if (activeTab === "kot") {
        if (order.source !== "kot" || order.paymentStatus === "paid") return false;
      } else if (activeTab === "held") {
        if (order.source !== "held") return false;
      } else if (activeTab === "pending") {
        if (order.paymentStatus === "paid") return false;
      } else if (activeTab === "settled") {
        if (order.paymentStatus !== "paid") return false;
      }

      // 2. Channel Filter
      if (channelFilter !== "all" && order.orderChannel !== channelFilter) {
        return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = String(order.id).toLowerCase().includes(q);
        const kotMatch = order.kotId ? order.kotId.toLowerCase().includes(q) : false;
        const custMatch = order.customerName
          ? order.customerName.toLowerCase().includes(q)
          : false;
        const phoneMatch = order.customerPhone
          ? order.customerPhone.toLowerCase().includes(q)
          : false;
        const tableMatch =
          (order.tableName && order.tableName.toLowerCase().includes(q)) ||
          (order.tableId !== undefined && String(order.tableId).includes(q));
        const itemMatch = order.items.some((it) =>
          it.name.toLowerCase().includes(q)
        );

        return idMatch || kotMatch || custMatch || phoneMatch || tableMatch || itemMatch;
      }

      return true;
    });
  }, [allUnifiedOrders, activeTab, channelFilter, searchQuery]);

  return (
    <div className="w-full flex-1 flex flex-col h-full bg-[var(--bg)] overflow-hidden text-[var(--text-hi)] select-none">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & TITLE                                                     */}
      {/* ========================================================================= */}
      <div className="px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-2 shrink-0">
        <h1 className="font-display font-black text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
          Live Orders &amp;{" "}
          <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
            Kitchen Queue
          </span>
        </h1>
      </div>

      {/* ========================================================================= */}
      {/* 2. DYNAMIC STATUS FILTER TABS                                             */}
      {/* ========================================================================= */}
      {/* Mobile & Tablet Dropdown Filter (< 1024px) */}
      <div className="lg:hidden px-4 sm:px-6 md:px-8 pt-2 pb-1 w-full shrink-0">
        <ResponsiveSelect
          value={activeTab}
          onChange={(val) => setActiveTab(val as UnifiedOrderTab)}
          options={[
            { id: "all", label: "All Orders", count: tabCounts.all },
            ...(enableKitchenKds
              ? [{ id: "kot", label: "KOT / Kitchen Active", count: tabCounts.kot, icon: <ChefHat className="w-3.5 h-3.5" /> }]
              : []),
            { id: "held", label: "Held Orders", count: tabCounts.held, icon: <PauseCircle className="w-3.5 h-3.5" /> },
            { id: "pending", label: "Pending Settlement", count: tabCounts.pending, icon: <AlertCircle className="w-3.5 h-3.5" /> },
            { id: "settled", label: "Completed & Settled", count: tabCounts.settled, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
          ]}
          buttonClassName="h-10 text-xs font-mono font-bold text-[var(--text-hi)]"
          menuClassName="w-full"
        />
      </div>

      {/* Desktop Horizontal Tabs (>= 1024px) */}
      <div className="hidden lg:flex px-4 sm:px-6 md:px-8 pt-2 pb-1 overflow-x-auto no-scrollbar items-center gap-2 shrink-0">
        {/* Tab 1: All Orders */}
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "all"
              ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
              : "glass-panel hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 text-[var(--text-lo)] border border-[var(--border)]"
          }`}
        >
          <span>All Orders</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === "all"
                ? "bg-[#342c14]/15 text-[#342c14]"
                : "bg-[var(--surface-hi)] text-[var(--text-lo)]"
            }`}
          >
            {tabCounts.all}
          </span>
        </button>

        {/* Tab 2: KOT / Kitchen Active (Conditionally rendered ONLY if enable_kitchen_kds is TRUE) */}
        {enableKitchenKds && (
          <button
            type="button"
            onClick={() => setActiveTab("kot")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "kot"
                ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
                : "glass-panel hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 text-[var(--text-lo)] border border-[var(--border)]"
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>KOT / Kitchen Active</span>
            {tabCounts.kot > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === "kot"
                    ? "bg-[#342c14]/15 text-[#342c14]"
                    : "bg-[var(--surface-hi)] text-[var(--text-lo)]"
                }`}
              >
                {tabCounts.kot}
              </span>
            )}
          </button>
        )}

        {/* Tab 3: Held Orders */}
        <button
          type="button"
          onClick={() => setActiveTab("held")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "held"
              ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
              : "glass-panel hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 text-[var(--text-lo)] border border-[var(--border)]"
          }`}
        >
          <PauseCircle className="w-3.5 h-3.5" />
          <span>Held Orders</span>
          {tabCounts.held > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === "held"
                  ? "bg-[#342c14]/15 text-[#342c14]"
                  : "bg-[var(--surface-hi)] text-[var(--text-lo)]"
              }`}
            >
              {tabCounts.held}
            </span>
          )}
        </button>

        {/* Tab 4: Pending Settlement */}
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "pending"
              ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
              : "glass-panel hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 text-[var(--text-lo)] border border-[var(--border)]"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Pending Settlement</span>
          {tabCounts.pending > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === "pending"
                  ? "bg-[#342c14]/15 text-[#342c14]"
                  : "bg-[var(--surface-hi)] text-[var(--text-lo)]"
              }`}
            >
              {tabCounts.pending}
            </span>
          )}
        </button>

        {/* Tab 5: Completed & Settled */}
        <button
          type="button"
          onClick={() => setActiveTab("settled")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "settled"
              ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
              : "glass-panel hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 text-[var(--text-lo)] border border-[var(--border)]"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completed &amp; Settled</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === "settled"
                ? "bg-[#342c14]/15 text-[#342c14]"
                : "bg-[var(--surface-hi)] text-[var(--text-lo)]"
            }`}
          >
            {tabCounts.settled}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. SEARCH & CHANNEL BAR                                                   */}
      {/* ========================================================================= */}
      <div className="px-4 sm:px-6 md:px-8 py-3 flex flex-wrap items-center gap-2.5 shrink-0 w-full border-b border-[var(--border)]/30 bg-[var(--surface)]/10">
        <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
          <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order #, KOT #, customer, table, or dish..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 text-[var(--text-hi)] text-xs placeholder:text-[var(--text-faint)] focus:outline-none transition-all shadow-inner h-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 rounded-md transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-36 sm:w-44">
            <Filter className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="w-full appearance-none pl-8 pr-7 py-2 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 text-[var(--text-hi)] text-xs focus:outline-none transition-all cursor-pointer shadow-inner font-mono h-9"
            >
              <option value="all">All Channels</option>
              <option value="dine_in">Dine-In</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-hi)] hover:border-[var(--gold)]/50 text-[var(--gold)] text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-50 h-9 shrink-0 shadow-xs active:scale-95 whitespace-nowrap"
              title="Sync latest orders from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden xs:inline sm:inline">Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ORDERS LIST (FULL-PAGE CARD VIEW)                                      */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-5 space-y-3.5">
        {allUnifiedOrders.length === 0 && isRefreshing ? (
          <div className="space-y-3.5 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-4 sm:p-5 rounded-2xl glass-panel border border-[var(--border)] bg-[var(--surface)]/40 space-y-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]/40">
                  <div className="flex items-center gap-2.5">
                    <div className="h-5 w-24 bg-[var(--surface-hi)] rounded-md" />
                    <div className="h-5 w-16 bg-[var(--surface-hi)] rounded-md" />
                  </div>
                  <div className="h-5 w-20 bg-[var(--surface-hi)] rounded-md" />
                </div>
                <div className="space-y-2 py-1">
                  <div className="h-3.5 w-48 bg-[var(--surface-hi)]/70 rounded-md" />
                  <div className="h-3.5 w-36 bg-[var(--surface-hi)]/70 rounded-md" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]/40">
                  <div className="h-4 w-28 bg-[var(--surface-hi)]/60 rounded-md" />
                  <div className="h-7 w-28 bg-[var(--surface-hi)] rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="min-h-[340px] flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface-hi)]/80 border border-[var(--border)] text-[var(--gold)] flex items-center justify-center mx-auto shadow-inner transition-transform hover:scale-105">
              {searchQuery || channelFilter !== "all" ? (
                <Search className="w-7 h-7 text-[var(--text-faint)]" />
              ) : activeTab === "kot" ? (
                <ChefHat className="w-7 h-7 text-amber-400" />
              ) : activeTab === "held" ? (
                <PauseCircle className="w-7 h-7 text-amber-500" />
              ) : activeTab === "pending" ? (
                <AlertCircle className="w-7 h-7 text-rose-400" />
              ) : activeTab === "settled" ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              ) : (
                <Layers className="w-7 h-7 text-[var(--text-faint)]" />
              )}
            </div>
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-bold text-[var(--text-hi)] tracking-tight">
                {searchQuery || channelFilter !== "all"
                  ? "No matching orders found"
                  : activeTab === "kot"
                    ? "Kitchen Queue is Clear"
                    : activeTab === "held"
                      ? "No Parked or Held Orders"
                      : activeTab === "pending"
                        ? "All Orders Settled"
                        : activeTab === "settled"
                          ? "No Settled Invoices Yet"
                          : "No Orders in this View"}
              </h3>
              <p className="text-xs text-[var(--text-lo)] leading-relaxed">
                {searchQuery || channelFilter !== "all"
                  ? "No orders match your current search terms or channel filter. Try clearing filters to see all orders."
                  : activeTab === "kot"
                    ? "Active dine-in and takeaway tickets sent to the kitchen will display here in real-time."
                    : activeTab === "held"
                      ? "Park an order from the POS register to hold it temporarily and resume it later."
                      : activeTab === "pending"
                        ? "No orders are currently waiting for payment or cashier settlement."
                        : activeTab === "settled"
                          ? "Completed and paid orders for this shift will be recorded here."
                          : "Orders dispatched or created on this terminal will appear here live."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {(searchQuery || channelFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setChannelFilter("all");
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-hi)] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
              {activeTab !== "all" && filteredOrders.length === 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--gold)] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>View All Orders</span>
                </button>
              )}
              <button
                type="button"
                onClick={onBackToRegister}
                className="btn-gold px-4 py-2 rounded-xl text-[#342c14] text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              >
                + New POS Order
              </button>
            </div>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const orderTime = order.timestamp;
            const formattedTime = orderTime
              ? new Date(orderTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now";

            const itemCount = order.items.reduce(
              (sum, it) => sum + (it.quantity || 1),
              0
            );

            const channelLabel =
              order.orderChannel === "dine_in"
                ? "Dine-In"
                : order.orderChannel === "takeaway"
                  ? "Takeaway"
                  : order.orderChannel === "delivery"
                    ? "Delivery"
                    : String(order.orderChannel);

            const isPaid = order.paymentStatus === "paid";
            const isHeld = order.paymentStatus === "held";
            const isPending = order.paymentStatus === "pending";

            return (
              <div
                key={`${order.source}-${order.id}`}
                className="p-4 sm:p-5 rounded-2xl glass-panel border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 group relative overflow-hidden"
              >
                {/* Status Accent Top Indicator Line */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isPaid
                      ? "bg-emerald-500/80"
                      : isHeld
                        ? "bg-indigo-500/80"
                        : "bg-amber-500/80"
                  }`}
                />

                {/* Left Section: Structured Rows */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  {/* 1. TOP ROW: Header Metadata (Cleanly Separated, Zero Duplicate Customer Chips) */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {/* Order ID */}
                    <span className="font-mono text-xs font-bold text-[var(--gold)] bg-[var(--gold-dim)] px-2.5 py-0.5 rounded-lg border border-[var(--gold)]/20 shadow-xs">
                      #{order.id}
                    </span>

                    {/* KOT ID Badge (if applicable) */}
                    {order.kotId && (
                      <span className="font-mono text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                        {order.kotId}
                      </span>
                    )}

                    {/* Channel Badge (Dine-In, Takeaway, Delivery) */}
                    <span className="badge-pill badge-neutral">
                      {channelLabel}
                    </span>

                    {/* Table Badge (ONLY for Dine-In) */}
                    {order.orderChannel === "dine_in" && (order.tableName || order.tableId) && (
                      <span className="badge-pill badge-gold">
                        {order.tableName || `Table ${order.tableId}`}
                      </span>
                    )}

                    {/* Status Badge */}
                    {isPaid ? (
                      <span className="badge-pill badge-success">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>PAID • {order.paymentMethod?.toUpperCase() || "CASH"}</span>
                      </span>
                    ) : isHeld ? (
                      <span className="badge-pill badge-purple">
                        <PauseCircle className="w-3 h-3" />
                        <span>HELD ORDER</span>
                      </span>
                    ) : (
                      <span className="badge-pill badge-warning">
                        <AlertCircle className="w-3 h-3" />
                        <span>PAYMENT PENDING</span>
                      </span>
                    )}

                    {/* Kitchen Status (if KDS enabled and active KOT) */}
                    {enableKitchenKds && order.source === "kot" && (
                      <span className="badge-pill badge-info">
                        <ChefHat className="w-3 h-3" />
                        <span>KITCHEN: {String(order.kitchenStatus).toUpperCase()}</span>
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="text-[11px] text-[var(--text-faint)] flex items-center gap-1 font-mono ml-auto sm:ml-0">
                      <Clock className="w-3 h-3" />
                      {formattedTime}
                    </span>
                  </div>

                  {/* 2. MIDDLE ROW: Ordered Items Vertical Stack */}
                  <div className="py-0.5">
                    {order.items.length > 0 ? (
                      <ul className="space-y-1">
                        {order.items.map((it, idx) => (
                          <li
                            key={`${it.id || it.name}-${idx}`}
                            className="flex items-center gap-2 text-xs font-sans text-[var(--text-hi)]"
                          >
                            {/* Aligned Quantity Pill / Tag */}
                            <span className="inline-flex items-center justify-center min-w-[26px] h-5 px-1.5 rounded-md bg-[var(--gold-dim)] border border-[var(--gold)]/25 text-[var(--gold)] font-mono font-bold text-[11px] shrink-0">
                              {it.quantity}×
                            </span>
                            {/* Dish Name */}
                            <span className="font-medium text-[var(--text-hi)]">
                              {it.name}
                            </span>
                            {/* Optional item notes */}
                            {it.notes && (
                              <span className="text-[11px] text-[var(--text-lo)] italic font-normal">
                                ({it.notes})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-[var(--text-lo)] italic">No items recorded</span>
                    )}
                  </div>

                  {/* 3. BOTTOM ROW: Dedicated Customer & Delivery Details (Compact, zero repetition) */}
                  {(order.customerName || order.customerPhone || order.deliveryZone) && (
                    <div className="flex items-center gap-3 text-xs text-[var(--text-lo)] bg-[var(--surface-hi)]/60 px-3 py-1.5 rounded-xl border border-[var(--border)] w-fit flex-wrap">
                      {order.customerName && (
                        <div className="flex items-center gap-1.5 font-semibold text-[var(--text-hi)]">
                          <User className="w-3.5 h-3.5 text-[var(--gold)]" />
                          <span>{order.customerName}</span>
                        </div>
                      )}
                      {order.customerPhone && (
                        <div className="flex items-center gap-1 font-mono text-[var(--text-lo)]">
                          <Phone className="w-3 h-3 text-[var(--text-faint)]" />
                          <span>{order.customerPhone}</span>
                        </div>
                      )}
                      {order.deliveryZone && (
                        <div className="flex items-center gap-1 text-[var(--text-lo)]">
                          <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>{order.deliveryZone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Section: Amount & Action Buttons (Cleanly Aligned) */}
                <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-[var(--border)]/60 min-w-0 lg:min-w-[160px]">
                  {/* Total Amount & Item Count */}
                  <div className="text-left lg:text-right">
                    <div className="text-xl sm:text-2xl font-black text-[var(--gold)] font-mono tracking-tight">
                      {currencySymbol} {order.total.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-[var(--text-lo)] font-mono">
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {(isPending || isHeld) && (
                      <button
                        type="button"
                        onClick={() => onSettleOrder(order)}
                        className="btn-gold px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
                        title="Collect payment & settle order immediately"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Settle &amp; Charge</span>
                      </button>
                    )}

                    {/* Recall Held Order */}
                    {isHeld && order.rawParkedOrder && onRecallHeldOrder && (
                      <button
                        type="button"
                        onClick={() => onRecallHeldOrder(order.rawParkedOrder!)}
                        className="px-3.5 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-hi)] border border-[var(--border)] text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                        title="Recall ticket to active cart"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Recall</span>
                      </button>
                    )}

                    {/* Discard Held Order */}
                    {isHeld && onDiscardHeldOrder && (
                      <button
                        type="button"
                        onClick={() => onDiscardHeldOrder(order.id)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer active:scale-95 shrink-0"
                        title="Discard held order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Reprint Receipt */}
                    {isPaid && order.rawOrderRecord && (
                      <button
                        type="button"
                        onClick={() => onReprintOrder(order.rawOrderRecord!)}
                        className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-hi)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 whitespace-nowrap"
                        title="Reprint thermal receipt slip"
                      >
                        <Printer className="w-3.5 h-3.5 text-[var(--gold)]" />
                        <span>Reprint</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. FOOTER SUMMARY & BACK LINK (SEAMLESS DIRECTLY ON PAGE)                 */}
      {/* ========================================================================= */}
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between text-xs text-[var(--text-lo)] shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-[var(--text-hi)]">{filteredOrders.length}</strong> of{" "}
            {allUnifiedOrders.length} orders
          </span>
          {tabCounts.pending > 0 && (
            <span className="hidden sm:inline-block text-amber-800 dark:text-amber-400 font-mono font-bold">
              • {tabCounts.pending} Unsettled
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onBackToRegister}
          className="px-4 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-semibold transition-colors cursor-pointer"
        >
          Return to POS Register
        </button>
      </div>
    </div>
  );
}
