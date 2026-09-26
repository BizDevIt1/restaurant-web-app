"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  UtensilsCrossed,
  Users,
  Clock,
  ArrowUpRight,
  RotateCcw,
  ChefHat,
  ChevronRight,
  Receipt,
  Flame,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { AuthenticatedUser, AdminTab, TableStatus, KdsTicket, OrderRecord } from "../../types";
import { formatSmartDuration } from "../../../../utils/timeFormatters";
import RevenueVelocityChart from "./RevenueVelocityChart";

interface OverviewViewProps {
  user: AuthenticatedUser;
  currentDate?: string;
  tables: TableStatus[];
  setSelectedTable: (id: number) => void;
  kdsTickets: KdsTicket[];
  handleAdvanceKds: (ticketId: string) => void;
  setActiveTab: (tab: AdminTab) => void;
  showToast: (msg: string) => void;
  orders?: OrderRecord[];
  todayGrossSales?: number;
  activeFloorOrders?: number;
  avgCookTime?: number;
}

function useCountUp(target: number, duration: number = 900) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * target));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  return count;
}

export default function OverviewView({
  user,
  currentDate,
  tables,
  setSelectedTable,
  kdsTickets,
  handleAdvanceKds,
  setActiveTab,
  showToast,
  orders = [],
}: OverviewViewProps) {
  const isBranchAdmin = user.role === "BRANCH_ADMIN";
  const isFranchiseOwner = user.role === "FRANCHISE_OWNER";

  // ============================================================================
  // 1. DYNAMIC TODAY'S GROSS SALES & RECEIPTS
  // ============================================================================
  const todayOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === "cancelled") return false;
      if (!o.timestamp) return true;
      try {
        const orderDate = new Date(o.timestamp);
        const today = new Date();
        return (
          orderDate.getFullYear() === today.getFullYear() &&
          orderDate.getMonth() === today.getMonth() &&
          orderDate.getDate() === today.getDate()
        );
      } catch {
        return true;
      }
    });
  }, [orders]);

  const computedGrossSales = useMemo(() => {
    return todayOrders.reduce((acc, order) => acc + (order.total || 0), 0);
  }, [todayOrders]);

  const closedReceiptsCount = todayOrders.length;
  const avgTicketAmount =
    closedReceiptsCount > 0 ? Math.round(computedGrossSales / closedReceiptsCount) : 0;

  // ============================================================================
  // 2. ACTIVE ORDERS IN PROGRESS & KITCHEN METRICS
  // ============================================================================
  const activeKdsTickets = useMemo(() => {
    return kdsTickets.filter((t) => t.status !== "completed");
  }, [kdsTickets]);

  const activeOrdersCount = activeKdsTickets.length;
  const prepCount = activeKdsTickets.filter(
    (t) => t.status === "preparing" || t.status === "queued"
  ).length;

  // ============================================================================
  // 3. TABLE SEATING & FLOOR OCCUPANCY
  // ============================================================================
  const occupiedTables = useMemo(() => {
    return tables.filter(
      (t) =>
        t.status === "seated" ||
        (t.status as string) === "occupied" ||
        t.status === "billing"
    ).length;
  }, [tables]);

  const totalTables = tables.length;
  const seatedPercentage =
    totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;
  const availableTablesCount = Math.max(0, totalTables - occupiedTables);

  // ============================================================================
  // 4. AVERAGE COOK TIME CALCULATION
  // ============================================================================
  const computedAvgCookTime = useMemo(() => {
    const timedTickets = kdsTickets.filter((t) => (t.elapsedMinutes || 0) > 0);
    if (timedTickets.length === 0) return 0;
    const total = timedTickets.reduce((acc, t) => acc + (t.elapsedMinutes || 0), 0);
    return Math.round(total / timedTickets.length);
  }, [kdsTickets]);

  // Animated counters
  const animatedSales = useCountUp(computedGrossSales);
  const animatedOrders = useCountUp(activeOrdersCount);
  const animatedCookTime = useCountUp(computedAvgCookTime);

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* ===================== DYNAMIC PAGE HEADING ===================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            •{" "}
            {(isBranchAdmin
              ? (user.branchName || user.restaurantName)
              : user.restaurantName
            )
              .replace(/frenchis\w*|franchis\w*/gi, "")
              .replace(/\s+/g, " ")
              .trim()
              .toUpperCase() || "RESTAURANT"}
            {user.city ? ` • ${user.city.toUpperCase()}` : ""}
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            {isFranchiseOwner ? (
              <>
                Enterprise{" "}
                <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                  Overview
                </span>
              </>
            ) : (
              <>
                Outlet{" "}
                <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                  Operations
                </span>
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            {isFranchiseOwner
              ? `Today — ${currentDate || "Live Data"} • Multi-branch network telemetry & consolidated performance.`
              : `Today — ${currentDate || "Live Data"} • Real-time kitchen, POS counter, and floor billing operations.`}
          </p>
        </div>
      </div>

      {/* ===================== SECTION 1: 4 DYNAMIC STAT CARDS ===================== */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 w-full">
        {/* Card 1: Today's Gross Sales */}
        <div className="glass-panel p-3 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 border border-[var(--border)] hover:border-[var(--gold)]/40 shadow-xl min-w-0 w-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[10px] sm:text-[11px] font-bold border border-[var(--gold)]/30 shrink-0">
              <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>Today</span>
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-mono font-extrabold text-xl sm:text-2xl lg:text-3xl text-[var(--gold)] tracking-tight truncate">
              Rs {animatedSales.toLocaleString()}
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1 break-words leading-tight">
              Today's Gross Sales
            </p>
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[9.5px] sm:text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between gap-1 min-w-0">
            <span className="truncate">{closedReceiptsCount} receipts</span>
            <span className="text-[var(--gold)] font-semibold shrink-0 truncate">
              Avg: Rs {avgTicketAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Card 2: Active Orders In Progress */}
        <div className="glass-panel p-3 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 border border-[var(--border)] hover:border-[var(--orange)]/40 shadow-xl min-w-0 w-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/30 text-[var(--orange)] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <UtensilsCrossed className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--orange-dim)] text-[var(--orange)] font-mono text-[10px] sm:text-[11px] font-bold border border-[var(--orange)]/30 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] animate-pulse" />
              <span>Queue</span>
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-mono font-extrabold text-xl sm:text-2xl lg:text-3xl text-[var(--text-hi)] tracking-tight truncate">
              {animatedOrders}
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1 break-words leading-tight">
              Active Kitchen Orders
            </p>
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[9.5px] sm:text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between gap-1 min-w-0">
            <span className="truncate">{prepCount} prep</span>
            <span className="text-[var(--orange)] font-semibold shrink-0 truncate">{occupiedTables} tables</span>
          </div>
        </div>

        {/* Card 3: Table Seating Capacity */}
        <div className="glass-panel p-3 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 border border-[var(--border)] hover:border-[#25d366]/40 shadow-xl min-w-0 w-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] font-mono text-[10px] sm:text-[11px] font-bold border border-[#25d366]/30 shrink-0">
              {seatedPercentage}%
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-mono font-extrabold text-xl sm:text-2xl lg:text-3xl text-[var(--text-hi)] tracking-tight truncate">
              {occupiedTables} / {totalTables}
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1 break-words leading-tight">
              Tables Occupied
            </p>
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[9.5px] sm:text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between gap-1 min-w-0">
            <span className="truncate">{availableTablesCount} open</span>
            <span className="text-[#25d366] font-semibold shrink-0 truncate">
              {availableTablesCount > 0 ? "Available" : "Full"}
            </span>
          </div>
        </div>

        {/* Card 4: Avg Kitchen Prep Time */}
        <div className="glass-panel p-3 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 border border-[var(--border)] hover:border-blue-500/40 shadow-xl min-w-0 w-full">
          <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-mono text-[10px] sm:text-[11px] font-bold border border-blue-500/30 shrink-0">
              {computedAvgCookTime > 18 ? "Delayed" : "Optimal"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-mono font-extrabold text-xl sm:text-2xl lg:text-3xl text-[var(--text-hi)] tracking-tight truncate">
              {animatedCookTime}m
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1 break-words leading-tight">
              Avg Kitchen Prep
            </p>
          </div>
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[9.5px] sm:text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between gap-1 min-w-0">
            <span className="truncate">&lt; 18m target</span>
            <span className="text-blue-400 font-semibold shrink-0 truncate">
              {computedAvgCookTime === 0 ? "No delay" : "On track"}
            </span>
          </div>
        </div>
      </section>

      {/* ===================== SECTION 2: HOURLY CHART & FLOOR MATRIX ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Multi-Timeframe Revenue Velocity Chart */}
        <div className="lg:col-span-2">
          <RevenueVelocityChart orders={orders} />
        </div>

        {/* Table Floor Matrix */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl space-y-4 border border-[var(--border)] shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-extrabold text-base text-[var(--text-hi)]">
              Live Floor Matrix
            </h3>
            <span className="text-[10.5px] font-mono text-[#25d366] font-bold">
              {occupiedTables} Seated • {availableTablesCount} Free
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {tables.length === 0 ? (
              <div className="col-span-2 py-8 px-4 text-center rounded-xl bg-[var(--surface-hi)]/30 border border-white/5 space-y-2">
                <p className="font-display font-semibold text-xs text-[var(--text-hi)]">
                  No tables configured yet
                </p>
                <p className="text-[11px] font-mono text-[var(--text-faint)]">
                  Configure floor tables in Floor &amp; Tables to see live seating matrix.
                </p>
                <button
                  onClick={() => setActiveTab("tables")}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-[10.5px] font-mono font-bold text-[var(--gold)] cursor-pointer transition-colors"
                >
                  <span>Go to Floor &amp; Tables</span>
                </button>
              </div>
            ) : (
              tables.map((tbl) => (
                <div
                  key={tbl.id}
                  onClick={() => {
                    setSelectedTable(tbl.id);
                    setActiveTab("pos");
                    showToast(`Opened POS ticket for ${tbl.label}`);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer group ${
                    tbl.status === "seated"
                      ? "bg-[var(--gold-dim)]/50 border-[var(--gold)]/50 hover:border-[var(--gold)] shadow-sm"
                      : tbl.status === "billing"
                      ? "bg-amber-500/10 border-amber-500/40 hover:border-amber-400"
                      : "bg-[var(--surface-hi)]/40 border-[var(--border)] hover:border-[var(--gold)]/30"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-hi)] font-mono">
                      {tbl.label}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        tbl.status === "seated"
                          ? "bg-[#25d366] shadow-[0_0_6px_#25d366]"
                          : tbl.status === "billing"
                          ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
                          : "bg-[var(--text-faint)]"
                      }`}
                    />
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-[var(--text-lo)] flex items-center justify-between">
                    <span>{tbl.capacity} Seats</span>
                    {tbl.activeAmount ? (
                      <span className="text-[var(--gold)] font-bold">
                        Rs {tbl.activeAmount.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[#25d366]">Available</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===================== SECTION 3: ACTIVE KITCHEN QUEUE ===================== */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl space-y-4 border border-[var(--border)] shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ChefHat className="w-5 h-5 text-[var(--gold)]" />
            <h3 className="font-display font-extrabold text-base text-[var(--text-hi)]">
              Active Kitchen Orders (KDS Queue)
            </h3>
          </div>
          <button
            onClick={() => setActiveTab("kds")}
            className="text-xs font-mono font-bold text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Open Full Screen KDS</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeKdsTickets.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[var(--surface-hi)]/40 border border-[var(--border)] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#25d366] mx-auto opacity-80" />
            <p className="font-display font-bold text-sm text-[var(--text-hi)]">
              Kitchen Display Queue is Clear
            </p>
            <p className="text-xs font-mono text-[var(--text-faint)]">
              New orders submitted from POS Counter or online delivery will immediately appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeKdsTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-hi)] font-mono block">
                      {ticket.id}
                    </span>
                    <span className="text-[10px] text-[var(--gold)] font-semibold font-mono">
                      {ticket.tableOrChannel}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                      ticket.status === "ready"
                        ? "bg-[#25d366]/20 text-[#25d366]"
                        : ticket.elapsedMinutes > 15
                        ? "bg-red-500/20 text-red-400 animate-pulse"
                        : "bg-[var(--gold-dim)] text-[var(--gold)]"
                    }`}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>
                      {ticket.elapsedMinutes >= 60
                        ? formatSmartDuration(ticket.elapsedMinutes * 60)
                        : `${ticket.elapsedMinutes}m`}
                    </span>
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-[var(--text-hi)] min-h-[60px]">
                  {ticket.items.slice(0, 3).map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="truncate">{it.name}</span>
                      {(() => {
                        const qty = Number(it.qty || (it as any).quantity || 1);
                        if (qty > 1) {
                          return <span className="font-bold text-[var(--gold)] font-mono ml-2">{qty}x</span>;
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                  {ticket.items.length > 3 && (
                    <span className="text-[10px] text-[var(--text-faint)] font-mono">
                      +{ticket.items.length - 3} more items...
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleAdvanceKds(ticket.id)}
                  className="w-full btn-gold py-2 text-[11px] font-bold cursor-pointer rounded-xl flex items-center justify-center gap-1.5"
                >
                  {ticket.status === "ready" ? "Mark Picked Up" : "Advance KOT"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
