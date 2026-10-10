"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Receipt,
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
  Layers,
  Filter,
  MapPin,
  Phone,
} from "lucide-react";
import { OrderRecord, CartItem } from "@/app/admin/types";
import { ParkedOrder } from "./HoldOrdersDrawer";
import ResponsiveSelect from "@/app/admin/components/ResponsiveSelect";

export type { ParkedOrder };
export type UnifiedOrderTab = "all" | "kot" | "held" | "pending" | "settled";

export interface UnifiedOrder {
  id: string;
  kotId?: string;
  source: "settled" | "kot" | "held";
  orderChannel: "dine_in" | "takeaway" | "delivery" | string;
  tableId?: number;
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

interface UnifiedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: UnifiedOrderTab;
  isPageMode?: boolean;
  orders: OrderRecord[];
  runningOrders: OrderRecord[];
  parkedOrders: ParkedOrder[];
  enableKitchenKds: boolean;
  onSettleOrder: (order: UnifiedOrder) => void;
  onRecallHeldOrder?: (order: ParkedOrder) => void;
  onDiscardHeldOrder?: (orderId: string) => void;
  onReprintOrder: (order: OrderRecord) => void;
  currencySymbol?: string;
}

export default function UnifiedOrdersModal({
  isOpen,
  onClose,
  initialTab = "all",
  isPageMode = false,
  orders,
  runningOrders,
  parkedOrders,
  enableKitchenKds,
  onSettleOrder,
  onRecallHeldOrder,
  onDiscardHeldOrder,
  onReprintOrder,
  currencySymbol = "Rs",
}: UnifiedOrdersModalProps) {
  const [activeTab, setActiveTab] = useState<UnifiedOrderTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  // Sync initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab === "kot" && !enableKitchenKds) {
        setActiveTab("all");
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab, enableKitchenKds]);

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

  if (!isOpen && !isPageMode) return null;

  const modalBody = (
    <div
      className={`w-full bg-[#170F0D] border border-[var(--border)] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-hi)] ${
        isPageMode
          ? "flex-1 h-full"
          : "max-w-4xl max-h-[92vh] sm:max-h-[88vh] animate-in zoom-in-95 duration-150"
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. HEADER & MODAL CLOSE                                                  */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[#170F0D]/95 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display text-[var(--text-hi)] tracking-tight truncate">
                  Order Management Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-lo)] shrink-0">
                  {tabCounts.all} Total
                </span>
              </div>
              <p className="text-xs text-[var(--text-lo)] truncate">
                Centralized live order status, active KOT tickets &amp; direct payment settlement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] transition-colors cursor-pointer shrink-0"
            title="Close Orders Hub"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. DYNAMIC STATUS FILTER TABS                                             */}
        {/* ========================================================================= */}
        {/* Mobile & Tablet Dropdown Filter (< 1024px) */}
        <div className="lg:hidden px-4 pt-3 pb-2 border-b border-[var(--border)] bg-[#170F0D]/60 w-full shrink-0">
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
        <div className="hidden lg:flex px-4 pt-3 pb-2 border-b border-[var(--border)] bg-[#170F0D]/60 overflow-x-auto no-scrollbar items-center gap-2">
          {/* Tab 1: All Orders */}
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "all"
                ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
                : "bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]"
            }`}
          >
            <span>All Orders</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                activeTab === "kot"
                  ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
                  : "bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]"
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>KOT / Kitchen Active</span>
              {tabCounts.kot > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "held"
                ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
                : "bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]"
            }`}
          >
            <PauseCircle className="w-3.5 h-3.5" />
            <span>Held Orders</span>
            {tabCounts.held > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === "held"
                    ? "bg-[#342c14]/15 text-[#342c14]"
                    : "bg-[var(--surface-hi)] text-[var(--text-lo)]"
                }`}
              >
                {tabCounts.held}
              </span>
            )}
          </button>

          {/* Tab 4: Pending Settlement / Unpaid */}
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "pending"
                ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
                : "bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Pending Settlement</span>
            {tabCounts.pending > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "settled"
                ? "btn-gold text-[#342c14] font-bold shadow-md shadow-amber-500/20"
                : "bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed &amp; Settled</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
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
        <div className="p-3 sm:p-4 border-b border-[var(--border)] bg-[#170F0D]/70 flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, KOT #, customer, table, or dish..."
              className="w-full pl-10 pr-8 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)]/60 text-[var(--text-hi)] text-xs placeholder:text-[var(--text-faint)] focus:outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <div className="relative w-full sm:w-40">
              <Filter className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="w-full appearance-none pl-8 pr-7 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)]/60 text-[var(--text-hi)] text-xs focus:outline-none transition-all cursor-pointer shadow-inner font-mono"
              >
                <option value="all">All Channels</option>
                <option value="dine_in">Dine-In</option>
                <option value="takeaway">Takeaway</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. ORDERS LIST (CARD / ROW VIEW)                                          */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#120B09]/40">
          {filteredOrders.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-faint)] flex items-center justify-center mx-auto shadow-inner">
                <Receipt className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--text-hi)]">
                  {searchQuery || channelFilter !== "all"
                    ? "No matching orders found"
                    : activeTab === "kot"
                      ? "No active KOT orders in kitchen queue"
                      : activeTab === "held"
                        ? "No orders currently held"
                        : activeTab === "pending"
                          ? "No unpaid orders pending settlement"
                          : "No orders recorded for this category yet"}
                </p>
                <p className="text-xs text-[var(--text-lo)] font-mono">
                  {searchQuery || channelFilter !== "all"
                    ? "Try clearing filters or search terms."
                    : "Orders appear here in real-time as they are created or dispatched."}
                </p>
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
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#170F0D] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
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

                  {/* Right Section: Amount & Direct Action Buttons (Cleanly Aligned) */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-[var(--border)] min-w-[150px]">
                    {/* Amount & Items */}
                    <div className="text-left md:text-right">
                      <div className="text-xl sm:text-2xl font-black text-[var(--gold)] font-mono tracking-tight">
                        {currencySymbol} {order.total.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-[var(--text-lo)] font-mono">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* ACTION 1: Settle & Charge (For Pending, Unpaid, or Held orders) */}
                      {(isPending || isHeld) && (
                        <button
                          type="button"
                          onClick={() => {
                            onSettleOrder(order);
                            onClose();
                          }}
                          className="btn-gold px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                          title="Collect payment & settle order immediately"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Settle &amp; Charge</span>
                        </button>
                      )}

                      {/* ACTION 2: Recall Held Order (to active cart) */}
                      {isHeld && order.rawParkedOrder && onRecallHeldOrder && (
                        <button
                          type="button"
                          onClick={() => {
                            onRecallHeldOrder(order.rawParkedOrder!);
                            onClose();
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-hi)] border border-[var(--border)] text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                          title="Recall ticket to active cart"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Recall</span>
                        </button>
                      )}

                      {/* ACTION 3: Discard Held Order */}
                      {isHeld && onDiscardHeldOrder && (
                        <button
                          type="button"
                          onClick={() => onDiscardHeldOrder(order.id)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer active:scale-95"
                          title="Discard held order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* ACTION 4: Reprint Receipt (For Settled & Paid orders) */}
                      {isPaid && order.rawOrderRecord && (
                        <button
                          type="button"
                          onClick={() => {
                            onReprintOrder(order.rawOrderRecord!);
                            onClose();
                          }}
                          className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-hi)] border border-[var(--border)] text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
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
        {/* 5. FOOTER SUMMARY & CLOSE                                                 */}
        {/* ========================================================================= */}
        <div className="p-3.5 sm:p-4 border-t border-[var(--border)] bg-[#170F0D] flex items-center justify-between text-xs text-[var(--text-lo)]">
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
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-semibold transition-colors cursor-pointer"
          >
            {isPageMode ? "Back to Register" : "Close Hub"}
          </button>
        </div>
      </div>
  );

  if (isPageMode) {
    return modalBody;
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150 select-none text-[var(--text-hi)]"
    >
      {modalBody}
    </div>
  );
}
