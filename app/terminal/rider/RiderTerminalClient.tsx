"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bike,
  Clock,
  CheckCircle2,
  Check,
  MapPin,
  Phone,
  Navigation,
  DollarSign,
  Package,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Flame,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  User,
} from "lucide-react";
import { useAuth } from "@/app/admin/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import ResponsiveSelect from "@/app/admin/components/ResponsiveSelect";

export interface RiderDeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  zone?: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: "queued" | "preparing" | "ready" | "assigned" | "picked_up" | "on_route" | "delivered" | "failed" | "completed";
  items: Array<{ name: string; quantity: number; notes?: string }>;
  createdAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  riderName?: string;
}

export default function RiderTerminalClient() {
  const router = useRouter();
  const { user } = useAuth();
  const currentOrgId = user?.organizationId || user?.id || "default";

  const [orders, setOrders] = useState<RiderDeliveryOrder[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "in_transit" | "delivered">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch delivery orders and subscribe to realtime updates
  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const fetchDeliveryOrders = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restId)
          .eq("order_channel", "delivery")
          .order("created_at", { ascending: false })
          .limit(60);

        if (!error && data && isMounted) {
          const mapped: RiderDeliveryOrder[] = data.map((o: any) => ({
            id: String(o.id),
            orderNumber: o.order_number || `#ORD-${o.id}`,
            customerName: o.customer_name || "Delivery Customer",
            customerPhone: o.customer_phone || "",
            deliveryAddress: o.delivery_address || o.delivery_zone || "Main Delivery Area",
            zone: o.delivery_zone || undefined,
            totalAmount: Number(o.total_amount || 0),
            paymentMethod: o.payment_method || "cash",
            paymentStatus: o.payment_status || "pending",
            status: (o.order_status as any) || "ready",
            items: Array.isArray(o.items)
              ? o.items.map((it: any) => ({
                  name: it.name || it.item?.name || "Dish",
                  quantity: Number(it.quantity || it.qty || 1),
                  notes: it.notes,
                }))
              : [],
            createdAt: o.created_at
              ? new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Just now",
            pickedUpAt: o.picked_up_at || undefined,
            deliveredAt: o.delivered_at || undefined,
            riderName: o.rider_name || undefined,
          }));

          setOrders(mapped);
        }

        // Realtime listener on orders table
        const subId = Math.random().toString(36).substring(2, 7);
        channel = supabase
          .channel(`rider_term_${restId}_${subId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "orders",
              filter: `restaurant_id=eq.${restId}`,
            },
            (payload) => {
              const row: any = payload.new;
              if (row && row.order_channel === "delivery") {
                const mappedOrder: RiderDeliveryOrder = {
                  id: String(row.id),
                  orderNumber: row.order_number || `#ORD-${row.id}`,
                  customerName: row.customer_name || "Delivery Customer",
                  customerPhone: row.customer_phone || "",
                  deliveryAddress: row.delivery_address || row.delivery_zone || "Main Delivery Area",
                  zone: row.delivery_zone || undefined,
                  totalAmount: Number(row.total_amount || 0),
                  paymentMethod: row.payment_method || "cash",
                  paymentStatus: row.payment_status || "pending",
                  status: (row.order_status as any) || "ready",
                  items: Array.isArray(row.items) ? row.items : [],
                  createdAt: row.created_at
                    ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Just now",
                  pickedUpAt: row.picked_up_at || undefined,
                  deliveredAt: row.delivered_at || undefined,
                  riderName: row.rider_name || undefined,
                };

                setOrders((prev) => {
                  const filtered = prev.filter((o) => o.id !== mappedOrder.id);
                  return [mappedOrder, ...filtered];
                });

                if (payload.eventType === "INSERT") {
                  showToast(`New Delivery Dispatch: ${mappedOrder.orderNumber}`);
                }
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("[RiderTerminal] Supabase delivery fetch error:", err);
      }
    };

    fetchDeliveryOrders();

    return () => {
      isMounted = false;
      if (channel) channel.unsubscribe();
    };
  }, [user, showToast]);

  // Update delivery order status
  const handleUpdateDeliveryStatus = async (
    orderId: string,
    newStatus: "picked_up" | "on_route" | "delivered" | "failed"
  ) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    const timestamp = new Date().toISOString();

    // 1. Optimistic update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: newStatus,
              pickedUpAt: newStatus === "picked_up" || newStatus === "on_route" ? timestamp : o.pickedUpAt,
              deliveredAt: newStatus === "delivered" ? timestamp : o.deliveredAt,
              riderName: user?.name || "Rider",
            }
          : o
      )
    );

    if (newStatus === "picked_up" || newStatus === "on_route") {
      showToast(`Order ${target.orderNumber} picked up. On route to destination!`);
    } else if (newStatus === "delivered") {
      showToast(`Delivery completed for ${target.orderNumber}! COD recorded.`);
    } else if (newStatus === "failed") {
      showToast(`Order ${target.orderNumber} flagged for manager follow-up.`);
    }

    // 2. Persist to Supabase
    try {
      const supabase = createClient();
      const updateData: any = {
        order_status: newStatus === "delivered" ? "completed" : newStatus,
        rider_name: user?.name || "Rider",
      };

      if (newStatus === "picked_up" || newStatus === "on_route") {
        updateData.picked_up_at = timestamp;
      }
      if (newStatus === "delivered") {
        updateData.delivered_at = timestamp;
        if (target.paymentMethod === "cash") {
          updateData.payment_status = "paid";
        }
      }

      await supabase.from("orders").update(updateData).eq("id", orderId);
    } catch (err) {
      console.warn("[RiderTerminal] Error updating delivery order status:", err);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const active = orders.filter((o) => o.status !== "delivered" && o.status !== "completed" && o.status !== "failed");
    const inTransit = orders.filter((o) => o.status === "picked_up" || o.status === "on_route");
    const delivered = orders.filter((o) => o.status === "delivered" || o.status === "completed");

    const codCollectedToday = delivered.reduce((sum, o) => {
      return o.paymentMethod === "cash" ? sum + o.totalAmount : sum;
    }, 0);

    return {
      activeCount: active.length,
      inTransitCount: inTransit.length,
      deliveredCount: delivered.length,
      codCollected: codCollectedToday,
    };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tab filter
      if (activeTab === "active") {
        if (o.status === "delivered" || o.status === "completed" || o.status === "failed") return false;
      } else if (activeTab === "in_transit") {
        if (o.status !== "picked_up" && o.status !== "on_route") return false;
      } else if (activeTab === "delivered") {
        if (o.status !== "delivered" && o.status !== "completed") return false;
      }

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          o.deliveryAddress.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-hi)] select-none overflow-hidden">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--bg)] border border-blue-500/40 text-blue-400 shadow-2xl font-mono text-xs font-semibold animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RIDER METRICS & STATIONS BAR                                              */}
      {/* ========================================================================= */}
      <div className="h-16 px-4 sm:px-6 md:px-8 bg-[var(--surface-hi)]/80 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
        {/* Left: Station Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold text-xs font-mono">
            <Bike className="w-4 h-4" />
            <span className="uppercase tracking-wider">Rider Terminal Station</span>
          </div>

          <div className="h-5 w-px bg-[var(--border)] hidden sm:block" />

          {/* Quick Jump Buttons for Operations */}
          <div className="hidden lg:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.push("/terminal/pos")}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>POS Billing</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/terminal/kitchen")}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Kitchen KDS</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/terminal/manager")}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manager Station</span>
            </button>
          </div>
        </div>

        {/* Center: Shift Metrics Badges */}
        <div className="hidden md:flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
            <span className="text-[var(--text-lo)]">Active Drops:</span>
            <span className="font-bold text-blue-400">{metrics.activeCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
            <span className="text-[var(--text-lo)]">Delivered Today:</span>
            <span className="font-bold text-emerald-400">{metrics.deliveredCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <DollarSign className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span className="text-[var(--text-lo)]">COD In Bag:</span>
            <span className="font-bold text-[var(--gold)]">Rs. {metrics.codCollected.toLocaleString()}</span>
          </div>
        </div>

        {/* Right: Search Input */}
        <div className="relative w-44 sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address, phone..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-hi)] focus:outline-none focus:border-blue-500 transition-colors font-mono"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABS SELECTOR                                                             */}
      {/* ========================================================================= */}
      <div className="px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between shrink-0">
        {/* Mobile & Tablet Dropdown Filter (< 1024px) */}
        <div className="lg:hidden w-full sm:w-64">
          <ResponsiveSelect
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
            options={[
              { id: "active", label: "Assigned & Ready", count: metrics.activeCount },
              { id: "in_transit", label: "On Route", count: metrics.inTransitCount },
              { id: "delivered", label: "Delivered Today", count: metrics.deliveredCount },
            ]}
            buttonClassName="h-10 text-xs font-mono font-bold text-[var(--text-hi)]"
            menuClassName="w-full sm:w-64"
          />
        </div>

        {/* Desktop Tabs (>= 1024px) */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 bg-[var(--bg-deep)] rounded-xl border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "active"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <span>Assigned &amp; Ready</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20">
              {metrics.activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("in_transit")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "in_transit"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <span>On Route</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-orange-500/20">
              {metrics.inTransitCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delivered")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "delivered"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <span>Delivered Today</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20">
              {metrics.deliveredCount}
            </span>
          </button>
        </div>

        {/* Mobile metrics snippet */}
        <div className="flex md:hidden items-center gap-1.5 font-mono text-[11px] text-[var(--gold)] font-bold">
          <span>COD:</span>
          <span>Rs. {metrics.codCollected.toLocaleString()}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DELIVERY CARDS GRID                                                       */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <Bike className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="text-base font-bold font-display text-[var(--text-hi)]">
              No Deliveries in this Queue
            </h3>
            <p className="text-xs font-mono text-[var(--text-lo)] max-w-sm mt-1">
              New delivery orders dispatched from the POS Counter or Web Admin will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const isCash = order.paymentMethod === "cash";
              const isDelivered = order.status === "delivered" || order.status === "completed";
              const isOnRoute = order.status === "on_route" || order.status === "picked_up";

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl glass-panel border flex flex-col justify-between overflow-hidden shadow-md transition-all ${
                    isDelivered
                      ? "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/10"
                      : isOnRoute
                      ? "border-orange-500/40 bg-orange-50/60 dark:bg-orange-950/10"
                      : "border-[var(--border)] bg-[var(--surface-hi)]/40"
                  }`}
                >
                  {/* Top Bar */}
                  <div className="p-4 border-b border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[var(--text-hi)]">
                          {order.orderNumber}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-faint)]">
                          {order.createdAt}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs ${
                          isDelivered
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                            : isOnRoute
                            ? "bg-orange-50 text-orange-800 border border-orange-200/80 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30"
                            : "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30"
                        }`}
                      >
                        {isOnRoute ? "In Transit" : order.status}
                      </span>
                    </div>

                    {/* Customer & Call Button */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="space-y-0.5 truncate">
                        <div className="text-xs font-bold text-[var(--text-hi)] truncate">
                          {order.customerName}
                        </div>
                        {order.customerPhone && (
                          <div className="text-[11px] font-mono text-[var(--text-lo)]">
                            {order.customerPhone}
                          </div>
                        )}
                      </div>

                      {order.customerPhone && (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                          title="Call Customer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Destination & Map Link */}
                  <div className="p-4 space-y-3 flex-1">
                    <div className="p-3 rounded-xl bg-[var(--bg-deep)]/80 border border-[var(--border)] space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div className="text-xs font-mono text-[var(--text-hi)] leading-relaxed">
                          {order.deliveryAddress}
                        </div>
                      </div>

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-400 hover:text-blue-300 underline font-bold"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Open Directions in Maps</span>
                      </a>
                    </div>

                    {/* Order Items Preview */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
                        Order Items:
                      </span>
                      <div className="max-h-28 overflow-y-auto space-y-1">
                        {order.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs font-mono text-[var(--text-lo)] py-0.5 border-b border-[var(--border)]/40 last:border-none"
                          >
                            <span className="truncate">{it.name}</span>
                            <span className="font-bold text-[var(--text-hi)]">x{it.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Status Pill */}
                    <div className="pt-1">
                      <div
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                          isCash
                            ? "bg-amber-500/10 border-amber-500/30 text-[var(--gold)]"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        <span className="font-bold flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>{isCash ? "Collect Cash (COD):" : "Prepaid Online:"}</span>
                        </span>
                        <span className="font-black text-sm">
                          Rs. {order.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-3.5 bg-[var(--surface-hi)]/60 border-t border-[var(--border)]">
                    {!isOnRoute && !isDelivered && (
                      <button
                        type="button"
                        onClick={() => handleUpdateDeliveryStatus(order.id, "picked_up")}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <Bike className="w-4 h-4" />
                        <span>Accept &amp; Start Delivery</span>
                      </button>
                    )}

                    {isOnRoute && (
                      <button
                        type="button"
                        onClick={() => handleUpdateDeliveryStatus(order.id, "delivered")}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Delivered &amp; Collect COD</span>
                      </button>
                    )}

                    {isDelivered && (
                      <div className="text-center py-1 font-mono text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>Delivered Successfully</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
