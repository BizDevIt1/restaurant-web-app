"use client";

import React, { useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  Search,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  UtensilsCrossed,
  Check,
  ChefHat,
  Filter,
  ShoppingBag,
  Volume2,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { KdsTicket } from "@/app/admin/types";
import { formatSmartDuration } from "@/utils/timeFormatters";

interface WaiterReadyPassViewProps {
  tickets: KdsTicket[];
  nowMs: number;
  onMarkPickedUp: (ticketId: string) => Promise<void> | void;
  onMarkServed: (ticketId: string) => Promise<void> | void;
  onQuickServe?: (ticketId: string) => Promise<void> | void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onTestBuzzer?: () => void;
}

type PassTabFilter = "pass" | "in_transit" | "served" | "all";

export default function WaiterReadyPassView({
  tickets,
  nowMs,
  onMarkPickedUp,
  onMarkServed,
  onQuickServe,
  searchQuery,
  setSearchQuery,
  onTestBuzzer,
}: WaiterReadyPassViewProps) {
  const [activeTab, setActiveTab] = useState<PassTabFilter>("pass");
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());

  // Ticket classification
  // 1. At kitchen pass: ready for pickup, NOT yet picked up, NOT completed
  const atPassTickets = tickets.filter((t) => {
    const isReady =
      (t.status === "ready" || t.ready_for_pickup_at != null) &&
      t.picked_up_at == null &&
      t.status !== "completed";
    return isReady;
  });

  // 2. In-transit: picked up by waiter, delivering to table, NOT completed
  const inTransitTickets = tickets.filter((t) => {
    const isInTransit =
      t.picked_up_at != null &&
      t.status !== "completed" &&
      t.status !== ("served" as any);
    return isInTransit;
  });

  // 3. Recently served: completed today
  const recentlyServedTickets = tickets.filter((t) => {
    return t.status === "completed" || t.status === ("served" as any);
  });

  // Filter based on active tab & search query
  const displayedTickets = tickets.filter((t) => {
    const isAtPass =
      (t.status === "ready" || t.ready_for_pickup_at != null) &&
      t.picked_up_at == null &&
      t.status !== "completed";
    const isInTransit =
      t.picked_up_at != null &&
      t.status !== "completed" &&
      t.status !== ("served" as any);
    const isServed =
      t.status === "completed" || t.status === ("served" as any);

    if (activeTab === "pass" && !isAtPass) return false;
    if (activeTab === "in_transit" && !isInTransit) return false;
    if (activeTab === "served" && !isServed) return false;
    if (activeTab === "all" && !isAtPass && !isInTransit && !isServed) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = String(t.id).toLowerCase().includes(q);
    const tableMatch = String(t.tableOrChannel || "").toLowerCase().includes(q);
    const itemMatch = (t.items || []).some((it) =>
      it.name.toLowerCase().includes(q)
    );
    return idMatch || tableMatch || itemMatch;
  });

  const handlePickUp = async (ticketId: string) => {
    if (submittingIds.has(ticketId)) return;
    setSubmittingIds((prev) => new Set(prev).add(ticketId));
    try {
      await onMarkPickedUp(ticketId);
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  };

  const handleServed = async (ticketId: string) => {
    if (submittingIds.has(ticketId)) return;
    setSubmittingIds((prev) => new Set(prev).add(ticketId));
    try {
      await onMarkServed(ticketId);
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  };

  const handleQuickServeClick = async (ticketId: string) => {
    if (submittingIds.has(ticketId)) return;
    setSubmittingIds((prev) => new Set(prev).add(ticketId));
    try {
      if (onQuickServe) {
        await onQuickServe(ticketId);
      } else {
        await onMarkPickedUp(ticketId);
        await onMarkServed(ticketId);
      }
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)] p-4 sm:p-6 overflow-hidden select-none">
      {/* Top Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 shadow-inner">
            <Bell className={`w-5 h-5 ${atPassTickets.length > 0 ? "animate-bounce text-[var(--gold)]" : ""}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black font-display text-[var(--text-hi)] leading-tight tracking-tight">
                Kitchen Pass &amp;{" "}
                <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                  Pickup Handoff
                </span>
              </h2>
              {atPassTickets.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14] text-[10px] font-mono font-black animate-pulse shadow-xs">
                  {atPassTickets.length} READY
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-[var(--text-lo)] mt-0.5">
              Real-time synchronization between Kitchen and Waiter Station
            </p>
          </div>
        </div>

        {/* Right tools: Test buzzer & Search input */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onTestBuzzer && (
            <button
              type="button"
              onClick={onTestBuzzer}
              className="px-3 py-2 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/50 text-[var(--text-lo)] hover:text-[var(--gold)] font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              title="Test the waiter service buzzer audio"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Test Buzzer</span>
            </button>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table, order, or dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-xs font-mono text-[var(--text-hi)] placeholder:text-[var(--text-faint)] rounded-xl pl-9 pr-3 py-2 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Stage Counters (Segmented Controls Matching Screenshot) */}
      <div className="flex items-center justify-between gap-2 pt-3 pb-2 overflow-x-auto scrollbar-none shrink-0 border-b border-[var(--border)]/50">
        <div className="flex items-center p-1 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("pass")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "pass"
                ? "bg-[var(--gold)] text-[#342c14] shadow-xs"
                : "text-[var(--text-lo)] hover:text-[var(--gold)] hover:bg-[var(--gold-dim)]/20"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>At Kitchen Pass</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === "pass"
                  ? "bg-black/20 text-[#342c14]"
                  : "bg-[var(--gold)]/20 text-[var(--gold)]"
              }`}
            >
              {atPassTickets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("in_transit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "in_transit"
                ? "bg-[var(--gold)] text-[#342c14] shadow-xs"
                : "text-[var(--text-lo)] hover:text-[var(--gold)] hover:bg-[var(--gold-dim)]/20"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>In-Transit</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === "in_transit"
                  ? "bg-black/20 text-[#342c14]"
                  : "bg-[var(--gold)]/20 text-[var(--gold)]"
              }`}
            >
              {inTransitTickets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("served")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "served"
                ? "bg-[var(--gold)] text-[#342c14] shadow-xs font-bold"
                : "text-[var(--text-lo)] hover:text-[var(--gold)] hover:bg-[var(--gold-dim)]/20"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Served</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === "served"
                  ? "bg-black/20 text-[#342c14]"
                  : "bg-[var(--gold)]/20 text-[var(--gold)]"
              }`}
            >
              {recentlyServedTickets.length}
            </span>
          </button>
        </div>
      </div>

      {/* Cards list */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 scrollbar-thin">
        {displayedTickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-center text-[var(--text-faint)]">
              {activeTab === "pass" ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
              ) : activeTab === "in_transit" ? (
                <UtensilsCrossed className="w-8 h-8 text-[var(--gold)]/60" />
              ) : (
                <Clock className="w-8 h-8 text-amber-400/60" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-hi)]">
                {activeTab === "pass"
                  ? "Kitchen Pass Clear!"
                  : activeTab === "in_transit"
                  ? "No Orders In Transit"
                  : "No History Found"}
              </h3>
              <p className="text-xs font-mono text-[var(--text-lo)] mt-1 max-w-sm">
                {activeTab === "pass"
                  ? "No orders currently waiting at the kitchen pass. When the chef finishes cooking, the buzzer will chime here instantly."
                  : activeTab === "in_transit"
                  ? "Orders you pick up from the kitchen will appear here until delivered to guest tables."
                  : "Delivered tickets will be archived cleanly."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {displayedTickets.map((t) => {
              const isAtPass =
                (t.status === "ready" || t.ready_for_pickup_at != null) &&
                t.picked_up_at == null &&
                t.status !== "completed";
              const isInTransit =
                t.picked_up_at != null &&
                t.status !== "completed" &&
                t.status !== ("served" as any);
              const isServed =
                t.status === "completed" || t.status === ("served" as any);

              const readyMs = t.ready_for_pickup_at
                ? new Date(t.ready_for_pickup_at).getTime()
                : nowMs;
              const waitSec = Math.max(0, Math.floor((nowMs - readyMs) / 1000));
              const isOverdue = waitSec >= 300 && isAtPass; // 5+ min waiting at pass
              const isRush =
                (t.priority || "").toLowerCase() === "rush" ||
                (t.priority || "").toLowerCase() === "urgent";
              const isSubmitting = submittingIds.has(t.id);

              return (
                <div
                  key={t.id}
                  className="glass-panel p-3.5 sm:p-4 pr-4 sm:pr-5 rounded-xl sm:rounded-2xl border border-[var(--border)] hover:border-[var(--gold)]/40 hover:bg-[var(--surface-hi)]/30 transition-all duration-200 relative group overflow-hidden shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4"
                >
                  {/* Left vertical status accent line */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 sm:w-1.5 ${
                      isOverdue
                        ? "bg-gradient-to-b from-red-500 to-orange-500 animate-pulse"
                        : isAtPass
                        ? "bg-gradient-to-b from-amber-500 to-orange-500"
                        : isInTransit
                        ? "bg-gradient-to-b from-emerald-500 to-teal-400"
                        : "bg-gradient-to-b from-teal-400 to-emerald-500"
                    }`}
                  />

                  {/* Zone 1: Order Metadata & Status Pill (Start Content) */}
                  <div className="flex flex-col gap-1.5 shrink-0 min-w-0 lg:w-60 xl:w-72 pl-1.5 relative z-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm sm:text-base text-[var(--text-hi)]">
                        #{t.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                        {t.tableOrChannel || "Counter"}
                      </span>
                      {isRush && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
                          RUSH
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-mono text-[var(--text-faint)]">
                      Channel: {t.orderType || "Dine-In"} • Server: {t.serverName || "Floor Server"}
                    </span>

                    {/* Status / Timing Badge */}
                    <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                      {isAtPass && (
                        <div
                          className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                            isOverdue
                              ? "bg-red-500/25 text-red-300 border border-red-500/50 animate-pulse"
                              : waitSec >= 120
                              ? "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/40"
                              : "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30"
                          }`}
                        >
                          <Bell className="w-3.5 h-3.5 animate-pulse" />
                          <span>At Pass ({formatSmartDuration(waitSec)})</span>
                        </div>
                      )}

                      {isInTransit && (
                        <div className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                          <UtensilsCrossed className="w-3.5 h-3.5" />
                          <span>En Route to Table</span>
                        </div>
                      )}

                      {isServed && (
                        <div className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 bg-[var(--gold-dim)]/40 text-[var(--gold)] border border-[var(--gold)]/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Served</span>
                        </div>
                      )}
                    </div>

                    {/* Overdue alert banner if waiting > 5 minutes at pass */}
                    {isOverdue && (
                      <div className="px-2.5 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-[11px] font-mono font-bold text-red-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                        <span>Food plated 5+ min ago — pick up!</span>
                      </div>
                    )}
                  </div>

                  {/* Zone 2: Order Items & Notes (Flexible Middle Content) */}
                  <div className="flex-1 min-w-0 space-y-1.5 relative z-1">
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {(t.items || []).map((it, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs py-2 px-3 rounded-xl bg-[var(--surface-hi)]/30 border border-[var(--border)]/70 hover:border-[var(--gold)]/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-mono font-bold text-[var(--gold)] shrink-0">
                              {it.qty}x
                            </span>
                            <span className="font-semibold text-[var(--text-hi)] break-words">
                              {it.name}
                            </span>
                            {it.modifiers?.map((mod, mIdx) => (
                              <span
                                key={mIdx}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 font-medium"
                              >
                                +{mod}
                              </span>
                            ))}
                            {it.notes && (
                              <span className="text-[10.5px] text-amber-300 font-mono italic break-words">
                                Note: {it.notes}
                              </span>
                            )}
                          </div>
                          {it.prepTime && (
                            <span className="text-[10px] text-[var(--text-faint)] font-mono shrink-0">
                              {it.prepTime}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Zone 3: Workflow Action Buttons (End Content / Actions) */}
                  <div className="shrink-0 flex items-center justify-end gap-2 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border)]/50 relative z-1">
                    {isAtPass && (
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto justify-end">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handlePickUp(t.id)}
                          className="shrink-0 whitespace-nowrap flex-1 sm:flex-none py-2 px-3.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md bg-gradient-to-r from-[#e3b13b] via-[#e5a93b] to-[#d97706] hover:brightness-110 text-[#342c14] active:scale-[0.98] disabled:opacity-50"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>Received / Pick Up</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleQuickServeClick(t.id)}
                          className="shrink-0 whitespace-nowrap py-2 px-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-[var(--surface-hi)] hover:bg-[var(--gold)] text-[var(--gold)] hover:text-[#342c14] border border-[var(--gold)]/40 hover:border-[var(--gold)] shadow-xs active:scale-[0.98] disabled:opacity-50"
                          title="Direct Serve (Pick up & deliver to table in 1 click)"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Quick Serve</span>
                        </button>
                      </div>
                    )}

                    {isInTransit && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleServed(t.id)}
                        className="w-full lg:w-auto py-2.5 px-4 rounded-xl font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md bg-[var(--gold)] hover:brightness-110 text-[#342c14] active:scale-[0.98] disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        )}
                        <span>Confirm Delivered</span>
                      </button>
                    )}

                    {isServed && (
                      <div className="w-full lg:w-auto py-2 px-3 rounded-xl font-mono text-xs text-center text-[var(--gold)] bg-[var(--gold-dim)]/20 border border-[var(--gold)]/30 flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Delivered to {t.tableOrChannel || "Guest"}</span>
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
