"use client";

import React, { useState } from "react";
import {
  Clock,
  Search,
  CheckCircle2,
  Flame,
  ChefHat,
  Bell,
  UtensilsCrossed,
  Layers,
  Filter,
} from "lucide-react";
import { KdsTicket } from "@/app/admin/types";
import { formatSmartDuration } from "@/utils/timeFormatters";
import { isTicketExpired } from "@/lib/orderExpiry";

interface WaiterFloorQueueViewProps {
  tickets: KdsTicket[];
  nowMs: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export default function WaiterFloorQueueView({
  tickets,
  nowMs,
  searchQuery,
  setSearchQuery,
}: WaiterFloorQueueViewProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("active");

  const activeTicketsCount = tickets.filter(
    (t) =>
      t.status !== "completed" &&
      !t.picked_up_at &&
      t.status !== "cancelled" &&
      t.status !== "voided" &&
      t.status !== "archived" &&
      !isTicketExpired(t)
  ).length;

  const deliveredTicketsCount = tickets.filter(
    (t) =>
      (t.status === "completed" || t.picked_up_at != null) &&
      t.status !== "cancelled" &&
      t.status !== "voided" &&
      t.status !== "archived"
  ).length;

  const allTicketsCount = tickets.filter(
    (t) =>
      t.status !== "cancelled" &&
      t.status !== "voided" &&
      t.status !== "archived" &&
      (t.status === "completed" || t.picked_up_at != null || !isTicketExpired(t))
  ).length;

  const filteredTickets = tickets.filter((t) => {
    if (
      t.status === "cancelled" ||
      t.status === "voided" ||
      t.status === "archived"
    ) {
      return false;
    }
    const isCompleted = t.status === "completed" || t.picked_up_at != null;
    if (!isCompleted && isTicketExpired(t)) return false;

    if (statusFilter === "active" && isCompleted) return false;
    if (statusFilter === "completed" && !isCompleted) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = t.id.toLowerCase().includes(q);
    const tableMatch = (t.tableOrChannel || "").toLowerCase().includes(q);
    const itemMatch = (t.items || []).some((it) => it.name.toLowerCase().includes(q));
    return idMatch || tableMatch || itemMatch;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg)] p-4 sm:p-6 overflow-hidden select-none">
      {/* Top filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black font-display text-[var(--text-hi)] leading-tight tracking-tight">
              Live Floor Queue &amp;{" "}
              <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                Order Status
              </span>
            </h2>
            <p className="text-xs font-mono text-[var(--text-lo)] mt-0.5">
              Track live kitchen progress for all your tables in real-time
            </p>
          </div>
        </div>

        {/* Status filter tabs & search */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-[var(--gold)] text-[#342c14] shadow-xs font-black"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] hover:bg-[var(--gold-dim)]/20"
              }`}
            >
              Active ({activeTicketsCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                statusFilter === "completed"
                  ? "bg-[var(--gold)] text-[#342c14] shadow-xs font-black"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] hover:bg-[var(--gold-dim)]/20"
              }`}
            >
              Delivered ({deliveredTicketsCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-[var(--gold)] text-[#342c14] shadow-xs font-black"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] hover:bg-[var(--gold-dim)]/20"
              }`}
            >
              All ({allTicketsCount})
            </button>
          </div>

          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table/order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-xs font-mono text-[var(--text-hi)] placeholder:text-[var(--text-faint)] rounded-xl pl-8 pr-3 py-2 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Ticket grid */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 scrollbar-thin">
        {filteredTickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-faint)] space-y-2">
            <Clock className="w-10 h-10 stroke-[1.5]" />
            <p className="text-xs font-mono">No floor orders match the current filter.</p>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {filteredTickets.map((t) => {
              const isReady = t.ready_for_pickup_at != null && t.picked_up_at == null;
              const isCooking = t.status === "cooking" || t.status === "in_progress";
              const isCompleted = t.status === "completed" || t.picked_up_at != null;

              return (
                <div
                  key={t.id}
                  className="glass-panel p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-[var(--border)] hover:border-[var(--gold)]/40 hover:bg-[var(--surface-hi)]/30 transition-all duration-200 relative group overflow-hidden shadow-sm flex flex-col lg:flex-row lg:items-start justify-between gap-3 sm:gap-4"
                >
                  {/* Vertical Status Accent Line on Left Edge */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 sm:w-1.5 ${
                      isReady
                        ? "bg-gradient-to-b from-emerald-500 to-teal-400"
                        : isCooking
                        ? "bg-gradient-to-b from-amber-500 to-orange-500"
                        : isCompleted
                        ? "bg-gradient-to-b from-teal-400 to-emerald-500"
                        : "bg-gradient-to-b from-blue-500 to-cyan-400"
                    }`}
                  />

                  {/* Zone 1: Metadata (Left Column) */}
                  <div className="flex flex-col gap-1.5 shrink-0 min-w-0 lg:w-60 xl:w-72 pl-1.5 relative z-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm sm:text-base text-[var(--text-hi)]">
                        #{t.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                        {t.tableOrChannel || "Counter"}
                      </span>
                    </div>

                    <div className="text-[10.5px] font-mono text-[var(--text-faint)]">
                      <span>Server: {t.serverName || "Floor Server"}</span>
                      {t.createdAt && <span className="block mt-0.5">Placed: {t.createdAt}</span>}
                    </div>

                    <div className="pt-0.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isReady
                            ? "bg-[var(--gold)] text-[#342c14] font-black animate-pulse shadow-xs"
                            : isCooking
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : isCompleted
                            ? "bg-[var(--gold-dim)]/40 text-[var(--gold)] border border-[var(--gold)]/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                        }`}
                      >
                        {isReady
                          ? "Ready at Pass"
                          : isCooking
                          ? "Cooking Now"
                          : isCompleted
                          ? "Delivered"
                          : "Queued"}
                      </span>
                    </div>
                  </div>

                  {/* Zone 2: Items & Modifiers (Middle Content) */}
                  <div className="flex-1 min-w-0 space-y-1.5 relative z-1">
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {(t.items || []).map((it, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs py-1.5 px-3 rounded-xl bg-[var(--surface-hi)]/30 border border-[var(--border)]/70 hover:border-[var(--gold)]/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="font-bold text-[var(--gold)]">{it.qty}x</span>
                            <span className="font-medium text-[var(--text-hi)] break-words">{it.name}</span>
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
                        </div>
                      ))}
                    </div>
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
