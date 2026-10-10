"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Receipt,
  Printer,
  Search,
  Clock,
  User,
} from "lucide-react";
import { OrderRecord } from "@/app/admin/types";

interface RecentOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderRecord[];
  onSelectOrderToReprint: (order: OrderRecord) => void;
  currencySymbol?: string;
}

export default function RecentOrdersModal({
  isOpen,
  onClose,
  orders,
  onSelectOrderToReprint,
  currencySymbol = "Rs",
}: RecentOrdersModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const deduplicatedOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const map = new Map<string | number, OrderRecord>();
    orders.forEach((o) => {
      // Must be strictly settled and paid
      const orderStatus = String(o.status || (o as any).order_status || "").toLowerCase().trim();
      const paymentStatus = String(o.payment_status || o.paymentStatus || (o as any).payment_status || "").toLowerCase().trim();

      // Exclude rejected, cancelled, pending, active, or unpaid KOT orders
      const isUnpaid =
        paymentStatus === "pending" ||
        paymentStatus === "unpaid" ||
        paymentStatus === "refunded";

      const isUnsettledKot =
        orderStatus === "active" ||
        orderStatus === "queued" ||
        orderStatus === "preparing" ||
        orderStatus === "ready" ||
        orderStatus === "cancelled" ||
        orderStatus === "rejected";

      if (isUnpaid || (isUnsettledKot && paymentStatus !== "paid")) {
        return;
      }

      if (orderStatus === "cancelled" || orderStatus === "rejected") {
        return;
      }

      const key = String(o.id || (o as any).order_number || (o as any).order_id || "").trim();
      if (key && !map.has(key)) {
        map.set(key, o);
      }
    });
    return Array.from(map.values());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return deduplicatedOrders;
    const q = searchQuery.toLowerCase().trim();
    return deduplicatedOrders.filter((o) => {
      const idMatch = String(o.id).toLowerCase().includes(q);
      const custMatch = o.customerName && o.customerName.toLowerCase().includes(q);
      const tableMatch =
        (o.tableName && o.tableName.toLowerCase().includes(q)) ||
        (o.tableId !== undefined && String(o.tableId).includes(q));
      const channelMatch = o.orderChannel && o.orderChannel.toLowerCase().includes(q);
      return idMatch || custMatch || tableMatch || channelMatch;
    });
  }, [deduplicatedOrders, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl bg-[var(--bg-deep)] border border-[var(--border)] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--text-hi)]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--bg-deep)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/20 text-[var(--gold)] flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-[var(--text-hi)]">
                Shift Invoices &amp; Recent Orders
              </h2>
              <p className="text-xs text-[var(--text-lo)]">
                Quick reprint and audit of settled orders for this shift
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-deep)]/60">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, customer, table, or channel..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)]/60 text-[var(--text-hi)] text-xs placeholder:text-[var(--text-faint)] focus:outline-none transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-faint)] flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-xs text-[var(--text-lo)] font-mono">
                {deduplicatedOrders.length === 0
                  ? "No settled orders in this shift yet."
                  : "No orders match your search."}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const orderTime = order.timestamp || order.created_at || order.createdAt;
              const formattedTime = orderTime
                ? new Date(orderTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : "Just now";

              const itemCount = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
              const channelDisplay =
                order.orderChannel === "dine_in"
                  ? "Dine-In"
                  : order.orderChannel === "takeaway"
                    ? "Takeaway"
                    : order.orderChannel === "delivery"
                      ? "Delivery"
                      : order.orderChannel || "Dine-In";

              return (
                <div
                  key={order.id}
                  className="p-3.5 rounded-2xl glass-panel hover:border-[var(--gold)]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[var(--gold)] bg-[var(--gold-dim)] px-2.5 py-0.5 rounded-lg border border-[var(--gold)]/20">
                        #{order.id}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--text-lo)] bg-[var(--surface-hi)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                        {channelDisplay}
                      </span>
                      {(order.tableName || order.tableId) && (
                        <span className="text-[11px] font-medium text-[var(--gold)] bg-[var(--gold-dim)] px-2 py-0.5 rounded-md border border-[var(--gold)]/20">
                          {order.tableName || `Table ${order.tableId}`}
                        </span>
                      )}
                      <span className="text-[11px] text-[var(--text-lo)] flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-[var(--text-faint)]" />
                        {formattedTime}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--text-hi)] truncate">
                      {order.items?.map((it) => `${it.quantity}x ${it.name}`).join(", ") ||
                        "Standard order items"}
                    </div>

                    {order.customerName && (
                      <div className="text-[11px] text-[var(--text-lo)] flex items-center gap-1">
                        <User className="w-3 h-3 text-[var(--text-faint)]" />
                        <span>{order.customerName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--border)]">
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[var(--text-hi)] font-mono">
                        {currencySymbol} {order.total.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[var(--text-lo)] font-mono">
                        {itemCount} {itemCount === 1 ? "item" : "items"} • {order.paymentMethod || "Cash"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectOrderToReprint(order);
                        onClose();
                      }}
                      className="btn-gold px-3 py-1.5 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Reprint</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-deep)] flex items-center justify-between text-xs text-[var(--text-lo)]">
          <span>Total Shift Records: {deduplicatedOrders.length}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
