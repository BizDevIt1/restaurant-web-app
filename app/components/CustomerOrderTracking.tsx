"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
  Search,
  ArrowRight,
  ChefHat,
  Utensils,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { createClient } from "../../lib/supabase";
import { formatSmartDuration } from "../../utils/timeFormatters";

interface OrderTrackingProps {
  initialOrderId?: string;
}

interface TrackedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  orderChannel: string;
  tableName?: string;
  orderStatus: "queued" | "preparing" | "ready" | "completed";
  estimatedPrepMinutes: number;
  prepStartedAt?: string;
  createdAt: string;
  items: {
    name: string;
    quantity: number;
    price?: number;
    notes?: string;
    prepTime?: string;
  }[];
  totalAmount: number;
  restaurantName?: string;
}

export default function CustomerOrderTracking({ initialOrderId = "" }: OrderTrackingProps) {
  const sanitizeId = (id: string) => decodeURIComponent(id || "").replace(/^[#%23]+/, "").trim();
  const cleanInitialId = sanitizeId(initialOrderId);

  const [searchInput, setSearchInput] = useState(cleanInitialId);
  const [activeOrderId, setActiveOrderId] = useState(cleanInitialId);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [nowTime, setNowTime] = useState(Date.now());

  // Keep searchInput & activeOrderId in sync if initialOrderId prop changes
  useEffect(() => {
    if (initialOrderId) {
      const clean = sanitizeId(initialOrderId);
      setSearchInput(clean);
      setActiveOrderId(clean);
    }
  }, [initialOrderId]);

  // 1-second live ticking clock for smooth reverse countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch order data from Supabase with dual-table resilient matching
  const fetchOrder = async (queryId: string) => {
    // 1. Decode and clean the input search term
    const rawParam = decodeURIComponent(queryId || "");
    const cleanId = rawParam.replace(/^[#%23]+/, "").trim(); // e.g. "%23ORD-9822" or "#ORD-9822" -> "ORD-9822"
    const digitsOnly = cleanId.replace(/\D/g, "");            // e.g. "9822"

    if (!cleanId && !digitsOnly) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      // Step A: Check public.orders:
      // Try matching UUID id, order_number (full or digits)
      let query = supabase.from("orders").select("*, restaurants(name)");

      const matchers: string[] = [`order_number.ilike.%${cleanId}%`];
      if (digitsOnly) {
        matchers.push(`order_number.ilike.%${digitsOnly}%`);
      }
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
      if (isUuid) {
        matchers.push(`id.eq.${cleanId}`);
      }

      let orderData: any = null;
      const { data: ordResult, error: orderErr } = await query
        .or(matchers.join(","))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!orderErr && ordResult) {
        orderData = ordResult;
      } else if (orderErr) {
        console.warn("[CustomerTracking] Orders query note:", orderErr.message);
      }

      // Step B: Fallback or linked lookup in public.kitchen_tickets
      let ticketData: any = null;
      if (orderData) {
        // Fetch linked kitchen ticket for live cooking timer telemetry
        const ticketMatchers: string[] = [`order_id.eq.${orderData.id}`];
        if (digitsOnly) ticketMatchers.push(`ticket_number.ilike.%${digitsOnly}%`);
        ticketMatchers.push(`ticket_number.ilike.%${cleanId}%`);

        const { data: tData } = await supabase
          .from("kitchen_tickets")
          .select("*, restaurants(name)")
          .or(ticketMatchers.join(","))
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        ticketData = tData;
      } else {
        // Fallback directly to kitchen_tickets if not found in orders
        const ticketMatchers: string[] = [`ticket_number.ilike.%${cleanId}%`];
        if (digitsOnly) {
          ticketMatchers.push(`ticket_number.ilike.%${digitsOnly}%`);
        }
        if (isUuid) {
          ticketMatchers.push(`id.eq.${cleanId}`);
        }

        const { data: directTicket, error: ticketErr } = await supabase
          .from("kitchen_tickets")
          .select("*, restaurants(name)")
          .or(ticketMatchers.join(","))
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!ticketErr && directTicket) {
          ticketData = directTicket;
          // If ticket has order_id, attempt to fetch parent order
          if (directTicket.order_id) {
            const { data: parentOrd } = await supabase
              .from("orders")
              .select("*, restaurants(name)")
              .eq("id", directTicket.order_id)
              .maybeSingle();
            if (parentOrd) orderData = parentOrd;
          }
        }
      }

      if (!orderData && !ticketData) {
        setOrder(null);
        setErrorMessage(`No active order found matching "${cleanId || rawParam}". Please double check your receipt number.`);
        setIsLoading(false);
        return;
      }

      // Map resolved items
      const rawItems = (ticketData?.items || orderData?.items || []) as any[];
      const itemsList = Array.isArray(rawItems)
        ? rawItems.map((it) => ({
            name: it.name || "Item",
            quantity: Number(it.qty || it.quantity) || 1,
            price: Number(it.price) || 0,
            notes: it.notes || undefined,
            prepTime: it.prepTime || undefined,
          }))
        : [];

      // Calculate estimated prep minutes
      let estMinutes =
        Number(orderData?.estimated_prep_time) ||
        Number(ticketData?.estimated_prep_time) ||
        0;

      if (!estMinutes && itemsList.length > 0) {
        const dishMinutes = itemsList.map((i) => {
          return parseInt(String(i.prepTime || "15").replace(/[^0-9]/g, "")) || 15;
        });
        estMinutes = Math.max(...dishMinutes);
      }
      if (!estMinutes || estMinutes <= 0) estMinutes = 15;

      // Status resolution
      let resolvedStatus: TrackedOrder["orderStatus"] = "queued";
      const ktStatus = ticketData?.status;
      const ordStatus = orderData?.order_status;

      if (ktStatus === "completed" || ordStatus === "completed") {
        resolvedStatus = "completed";
      } else if (ktStatus === "ready") {
        resolvedStatus = "ready";
      } else if (ktStatus === "preparing" || ordStatus === "preparing" || orderData?.prep_started_at || ticketData?.prep_timer_started_at) {
        resolvedStatus = "preparing";
      } else {
        resolvedStatus = "queued";
      }

      const prepStartedAt =
        ticketData?.prep_timer_started_at ||
        ticketData?.prep_started_at ||
        orderData?.prep_started_at ||
        undefined;

      const mapped: TrackedOrder = {
        id: orderData?.id || ticketData?.id,
        orderNumber: orderData?.order_number || ticketData?.ticket_number || cleanId,
        customerName: orderData?.customer_name || ticketData?.table_number || "Guest",
        orderChannel: orderData?.order_channel || ticketData?.channel || "dine_in",
        tableName: orderData?.customer_name || ticketData?.table_number,
        orderStatus: resolvedStatus,
        estimatedPrepMinutes: estMinutes,
        prepStartedAt,
        createdAt: orderData?.created_at || ticketData?.created_at || new Date().toISOString(),
        items: itemsList,
        totalAmount: Number(orderData?.total_amount) || 0,
        restaurantName: orderData?.restaurants?.name || ticketData?.restaurants?.name || "OmniBites Dining",
      };

      setOrder(mapped);
    } catch (e: any) {
      console.error("[CustomerTracking] Exception:", e);
      setErrorMessage("Unable to fetch order status. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (activeOrderId) {
      fetchOrder(activeOrderId);
    }
  }, [activeOrderId]);

  // Realtime subscription to live status updates
  useEffect(() => {
    if (!order) return;
    const supabase = createClient();

    const orderClean = (order.orderNumber || "").replace(/^[#%23]+/, "").trim();
    const orderDigits = orderClean.replace(/\D/g, "");

    const channel = supabase
      .channel(`customer_order_track_${orderClean}_${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kitchen_tickets",
        },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          const ticketDigits = (row.ticket_number || "").replace(/\D/g, "");

          const matchesTicket =
            row.order_id === order.id ||
            row.id === order.id ||
            row.ticket_number === order.orderNumber ||
            row.ticket_number === orderClean ||
            (orderDigits && ticketDigits && orderDigits === ticketDigits);

          if (matchesTicket) {
            setOrder((prev) => {
              if (!prev) return prev;
              let nextStatus: TrackedOrder["orderStatus"] = prev.orderStatus;
              if (row.status === "completed") nextStatus = "completed";
              else if (row.status === "ready") nextStatus = "ready";
              else if (row.status === "preparing") nextStatus = "preparing";
              else if (row.status === "queued") nextStatus = "queued";

              return {
                ...prev,
                orderStatus: nextStatus,
                prepStartedAt: row.prep_timer_started_at || row.prep_started_at || prev.prepStartedAt,
                estimatedPrepMinutes: Number(row.estimated_prep_time) || prev.estimatedPrepMinutes,
              };
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          const rowDigits = (row.order_number || "").replace(/\D/g, "");

          const matchesOrder =
            row.id === order.id ||
            row.order_number === order.orderNumber ||
            row.order_number === orderClean ||
            (orderDigits && rowDigits && orderDigits === rowDigits);

          if (matchesOrder) {
            setOrder((prev) => {
              if (!prev) return prev;
              let nextStatus = prev.orderStatus;
              if (row.order_status === "completed") nextStatus = "completed";
              else if (row.order_status === "preparing" || (row.prep_started_at && prev.orderStatus === "queued")) {
                nextStatus = "preparing";
              }
              return {
                ...prev,
                orderStatus: nextStatus,
                prepStartedAt: row.prep_started_at || prev.prepStartedAt,
                estimatedPrepMinutes: Number(row.estimated_prep_time) || prev.estimatedPrepMinutes,
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.orderNumber, order?.id]);

  // Handle Search Submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = searchInput.trim();
    if (!raw) return;
    const clean = sanitizeId(raw);
    setActiveOrderId(clean);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/track/${encodeURIComponent(clean)}`);
    }
  };

  // Reverse countdown computations
  const getCountdownDetails = () => {
    if (!order) return null;

    const estMinutes = order.estimatedPrepMinutes || 15;
    const totalDurationSec = estMinutes * 60;

    if (order.orderStatus === "queued") {
      const estDisplay = estMinutes >= 60 ? formatSmartDuration(totalDurationSec) : `~${estMinutes} mins`;
      return {
        stage: "queued",
        remainingSeconds: totalDurationSec,
        progressPercent: 5,
        title: "Order Placed & Queued",
        subtitle: `Queued for Chef • Estimated Prep: ${estDisplay}`,
        timeDisplay: estMinutes >= 60 ? formatSmartDuration(totalDurationSec) : `~${estMinutes}m`,
        isOverdue: false,
      };
    }

    if (order.orderStatus === "ready") {
      return {
        stage: "ready",
        remainingSeconds: 0,
        progressPercent: 100,
        title: "Order is Ready!",
        subtitle: "Freshly prepared and ready for pickup or table service.",
        timeDisplay: "READY",
        isOverdue: false,
      };
    }

    if (order.orderStatus === "completed") {
      return {
        stage: "completed",
        remainingSeconds: 0,
        progressPercent: 100,
        title: "Order Completed",
        subtitle: "Thank you for dining with us! We hope you enjoyed your meal.",
        timeDisplay: "DELIVERED",
        isOverdue: false,
      };
    }

    // Status is "preparing" (Cooking)
    const startTimeMs = order.prepStartedAt ? new Date(order.prepStartedAt).getTime() : nowTime;
    const elapsedSeconds = Math.max(0, Math.floor((nowTime - startTimeMs) / 1000));
    const remainingSeconds = totalDurationSec - elapsedSeconds;

    const isOverdue = remainingSeconds <= 0;
    const absRemaining = Math.abs(remainingSeconds);
    const formattedDuration = formatSmartDuration(absRemaining);

    const progressPercent = Math.min(
      95,
      Math.max(15, Math.round((elapsedSeconds / totalDurationSec) * 100))
    );

    return {
      stage: "preparing",
      remainingSeconds,
      progressPercent: isOverdue ? 98 : progressPercent,
      title: isOverdue ? "Adding Finishing Touches..." : "Chef is Cooking Your Order",
      subtitle: isOverdue
        ? "Adding finishing touches — Almost Ready!"
        : `Live Kitchen Countdown: ${formattedDuration} remaining`,
      timeDisplay: isOverdue ? `Almost Ready` : `${formattedDuration} left`,
      isOverdue,
      mm: Math.floor(absRemaining / 60),
      ss: absRemaining % 60,
    };
  };

  const countdown = getCountdownDetails();

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Search Bar */}
      <form onSubmit={handleSearch} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter Order or Ticket # (e.g. #ORD-1234)..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text-hi)] font-mono focus:border-[var(--gold)] focus:outline-none transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !searchInput.trim()}
          className="btn-gold px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Track</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Order Not Found</p>
            <p className="text-xs text-red-300/80">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !order && (
        <div className="p-8 rounded-3xl glass-panel border border-[var(--border)] space-y-4 text-center animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gold)]/20 mx-auto" />
          <p className="font-mono text-xs text-[var(--gold)] uppercase tracking-wider">
            Connecting to Live Kitchen Telemetry...
          </p>
        </div>
      )}

      {/* Main Order Card */}
      {order && countdown && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[var(--border)] space-y-6 relative overflow-hidden shadow-2xl">
            {/* Ambient Background Glow */}
            <div className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none ${
              countdown.stage === "ready"
                ? "bg-[#25d366]/20"
                : countdown.isOverdue
                ? "bg-red-500/20"
                : "bg-[var(--gold)]/15"
            }`} />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-bold uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
                  <span>{order.restaurantName}</span>
                </div>
                <h2 className="font-display font-black text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
                  {order.orderNumber}
                </h2>
                <p className="text-xs text-[var(--text-lo)] font-mono mt-0.5">
                  {order.tableName} • Placed {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Huge Timer Badge */}
              <div className="text-left sm:text-right">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border font-mono font-black text-sm sm:text-base ${
                  countdown.stage === "ready"
                    ? "bg-[#25d366]/20 text-[#25d366] border-[#25d366]/40 shadow-lg shadow-[#25d366]/10"
                    : countdown.stage === "completed"
                    ? "bg-neutral-500/20 text-neutral-400 border-neutral-600/30"
                    : countdown.isOverdue
                    ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse shadow-lg shadow-red-500/20"
                    : "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/40 shadow-lg shadow-amber-500/10"
                }`}>
                  {countdown.stage === "ready" ? (
                    <CheckCircle2 className="w-5 h-5 text-[#25d366]" />
                  ) : countdown.stage === "completed" ? (
                    <Sparkles className="w-5 h-5" />
                  ) : countdown.isOverdue ? (
                    <AlertTriangle className="w-5 h-5 text-red-400 animate-bounce" />
                  ) : (
                    <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
                  )}
                  <span>{countdown.timeDisplay}</span>
                </div>
              </div>
            </div>

            {/* Visual 4-Stage Progress Tracker */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-lo)]">
                <span>1. Received</span>
                <span>2. Cooking</span>
                <span>3. Ready</span>
                <span>4. Served</span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-3 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    countdown.stage === "ready"
                      ? "bg-gradient-to-r from-amber-400 to-[#25d366]"
                      : countdown.stage === "completed"
                      ? "bg-gradient-to-r from-neutral-400 to-emerald-400"
                      : countdown.isOverdue
                      ? "bg-gradient-to-r from-amber-400 via-rose-500 to-red-500 animate-pulse"
                      : "bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17]"
                  }`}
                  style={{ width: `${countdown.progressPercent}%` }}
                />
              </div>

              {/* Status Message Highlight */}
              <div className="pt-2 text-center sm:text-left space-y-1">
                <h3 className="font-display font-bold text-base text-[var(--text-hi)]">
                  {countdown.title}
                </h3>
                <p className="text-xs text-[var(--text-lo)] font-medium">
                  {countdown.subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Ordered Dishes Summary */}
          <div className="glass-panel p-6 rounded-3xl border border-[var(--border)] space-y-4 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[var(--gold)]" />
                <h4 className="font-bold text-sm text-[var(--text-hi)]">Items in this Order</h4>
              </div>
              <span className="font-mono text-xs text-[var(--text-faint)]">
                {order.items.reduce((sum, i) => sum + i.quantity, 0)} Items
              </span>
            </div>

            <div className="divide-y divide-[var(--border)]/50">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] font-mono font-bold flex items-center justify-center text-[11px] shrink-0">
                      {item.quantity}x
                    </span>
                    <div>
                      <span className="font-bold text-[var(--text-hi)]">{item.name}</span>
                      {item.notes && (
                        <p className="text-[10.5px] text-amber-400/90 font-mono italic mt-0.5">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {item.price ? (
                    <span className="font-mono font-bold text-[var(--text-hi)]">
                      Rs {(item.price * item.quantity).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {order.totalAmount > 0 && (
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between font-mono text-sm">
                <span className="text-[var(--text-lo)]">Total Amount Paid</span>
                <span className="font-black text-[var(--gold)]">
                  Rs {order.totalAmount.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
