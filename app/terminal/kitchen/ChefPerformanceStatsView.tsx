"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Flame,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  Layers,
  UtensilsCrossed,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Calendar,
  Timer,
  Store,
  Building2,
  User,
  Coffee,
  Utensils,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { KdsTicket, KitchenPerformanceDaily } from "@/app/admin/types";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import { formatSmartDuration } from "@/utils/timeFormatters";
import { getStationBadgeInfo, getTicketStation, KitchenStationType } from "./KitchenTerminalClient";

interface ChefPerformanceStatsViewProps {
  tickets: KdsTicket[];
  user: any;
  shiftInfo: {
    shiftTitle: string;
    shiftWindowLabel: string;
    shiftStartFormatted: string;
    shiftEndFormatted: string;
  };
  onBackToQueue: () => void;
}

export default function ChefPerformanceStatsView({
  tickets,
  user,
  shiftInfo,
  onBackToQueue,
}: ChefPerformanceStatsViewProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Today's date string YYYY-MM-DD in local time
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // Check if a ticket status is considered completed / fulfilled
  const isCompleted = (status?: string | null) => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "completed" || s === "fulfilled" || s === "ready" || s === "archived";
  };

  // Helper to extract creation or completion date of a ticket
  const getTicketDateStr = (ticket: KdsTicket): string => {
    const raw = ticket.completed_at || ticket.completedAt || ticket.created_at || ticket.createdAt;
    if (!raw) return todayStr;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return todayStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 1. Calculate Prep Duration for a Ticket (in seconds)
  const calculatePrepDurationSeconds = (ticket: KdsTicket): number => {
    const startIso = ticket.prep_timer_started_at || ticket.prepStartedAt;
    const endIso = ticket.completed_at || ticket.completedAt || ticket.ready_for_pickup_at;

    if (startIso && endIso) {
      const startMs = new Date(startIso).getTime();
      const endMs = new Date(endIso).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
        return Math.round((endMs - startMs) / 1000);
      }
    }

    if (startIso) {
      const startMs = new Date(startIso).getTime();
      if (!isNaN(startMs)) {
        return Math.max(0, Math.round((Date.now() - startMs) / 1000));
      }
    }

    if (typeof ticket.elapsedMinutes === "number" && ticket.elapsedMinutes > 0) {
      return ticket.elapsedMinutes * 60;
    }

    // Fallback to estimated prep time
    return (ticket.estimatedPrepTime || 15) * 60;
  };

  // 2. Filter Today's Tickets
  const todayTickets = useMemo(() => {
    return tickets.filter((t) => {
      const ticketDate = getTicketDateStr(t);
      return ticketDate === todayStr;
    });
  }, [tickets, todayStr]);

  // Today's Completed Tickets
  const todayCompletedTickets = useMemo(() => {
    return todayTickets.filter((t) => isCompleted(t.status));
  }, [todayTickets]);

  // 3. Today's Key Metrics Calculations
  const metrics = useMemo(() => {
    const ordersCompleted = todayCompletedTickets.length;

    let totalPrepSeconds = 0;
    let onTimeOrders = 0;
    let overdueOrders = 0;
    let itemsCooked = 0;

    todayCompletedTickets.forEach((t) => {
      const durationSec = calculatePrepDurationSeconds(t);
      totalPrepSeconds += durationSec;

      const estimatedSec = (t.estimatedPrepTime || 15) * 60;
      if (durationSec <= estimatedSec) {
        onTimeOrders += 1;
      } else {
        overdueOrders += 1;
      }

      // Count items cooked
      if (Array.isArray(t.items)) {
        t.items.forEach((it) => {
          itemsCooked += Number(it.qty || (it as any).quantity || 1);
        });
      }
    });

    const avgPrepTimeSeconds = ordersCompleted > 0 ? Math.round(totalPrepSeconds / ordersCompleted) : 0;
    const onTimePercent = ordersCompleted > 0 ? Math.round((onTimeOrders / ordersCompleted) * 100) : 100;

    return {
      ordersCompleted,
      avgPrepTimeSeconds,
      onTimeOrders,
      overdueOrders,
      onTimePercent,
      itemsCooked,
    };
  }, [todayCompletedTickets]);

  // 4. Weekly Trend (Past 7 Days Data for Recharts Bar Chart)
  const weeklyTrendData = useMemo(() => {
    const days: { [dateStr: string]: { dayName: string; orders: number; onTime: number; avgPrepMin: number; totalPrepSec: number } } = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Initialize past 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dStr = `${year}-${month}-${day}`;
      const name = i === 0 ? "Today" : `${dayNames[d.getDay()]} ${month}/${day}`;

      days[dStr] = {
        dayName: name,
        orders: 0,
        onTime: 0,
        avgPrepMin: 0,
        totalPrepSec: 0,
      };
    }

    // Populate with ticket data
    tickets.forEach((t) => {
      if (!isCompleted(t.status)) return;
      const dStr = getTicketDateStr(t);
      if (days[dStr]) {
        days[dStr].orders += 1;
        const durSec = calculatePrepDurationSeconds(t);
        days[dStr].totalPrepSec += durSec;
        const estSec = (t.estimatedPrepTime || 15) * 60;
        if (durSec <= estSec) {
          days[dStr].onTime += 1;
        }
      }
    });

    return Object.keys(days).map((dateKey) => {
      const item = days[dateKey];
      return {
        date: dateKey,
        day: item.dayName,
        orders: item.orders,
        onTime: item.onTime,
        avgPrepMin: item.orders > 0 ? Math.round((item.totalPrepSec / item.orders / 60) * 10) / 10 : 0,
      };
    });
  }, [tickets]);

  // 5. Top 5 Dishes Cooked Today
  const topDishes = useMemo(() => {
    const dishMap: { [name: string]: { name: string; quantity: number; station: KitchenStationType } } = {};

    todayTickets.forEach((t) => {
      const ticketStation = getTicketStation(t);
      if (Array.isArray(t.items)) {
        t.items.forEach((it) => {
          const name = it.name?.trim() || "Signature Dish";
          const qty = Number(it.qty || (it as any).quantity || 1);
          if (!dishMap[name]) {
            dishMap[name] = {
              name,
              quantity: 0,
              station: ticketStation,
            };
          }
          dishMap[name].quantity += qty;
        });
      }
    });

    const sorted = Object.values(dishMap).sort((a, b) => b.quantity - a.quantity);
    const totalAllDishes = sorted.reduce((acc, curr) => acc + curr.quantity, 0);

    return sorted.slice(0, 5).map((dish, index) => ({
      ...dish,
      rank: index + 1,
      sharePercent: totalAllDishes > 0 ? Math.round((dish.quantity / totalAllDishes) * 100) : 0,
    }));
  }, [todayTickets]);

  // 6. Automatically sync/upsert to `kitchen_performance_daily` in Supabase
  const syncPerformanceDaily = async () => {
    try {
      setIsSyncing(true);
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const chefId = String(user?.id || user?.sub || user?.email || "chef_1");

      const payload: KitchenPerformanceDaily = {
        chef_id: chefId,
        restaurant_id: restId,
        date: todayStr,
        orders_completed: metrics.ordersCompleted,
        avg_prep_time_seconds: metrics.avgPrepTimeSeconds,
        on_time_orders: metrics.onTimeOrders,
        overdue_orders: metrics.overdueOrders,
        items_cooked: metrics.itemsCooked,
      };

      const { error } = await supabase
        .from("kitchen_performance_daily")
        .upsert(payload, { onConflict: "restaurant_id,chef_id,date" });

      if (error) {
        console.warn("[KitchenPerformance] Supabase sync notice:", error.message);
      } else {
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
    } catch (err) {
      console.warn("[KitchenPerformance] Failed to sync daily performance:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (todayCompletedTickets.length > 0) {
      syncPerformanceDaily();
    }
  }, [todayCompletedTickets.length, todayStr]);

  // Formatter for seconds to "Xm Ys"
  const formatPrepTime = (seconds: number) => {
    if (seconds <= 0) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  };

  const chefStation = (user?.assigned_station || user?.assignedStation || "all") as KitchenStationType;
  const stationBadge = getStationBadgeInfo(chefStation);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BAR WITH BACK TO QUEUE BUTTON                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
              Chef Performance{" "}
              <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                Telemetry
              </span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/40 text-[var(--gold)] text-xs font-mono font-bold tracking-wider">
              LIVE
            </span>
          </div>
          <p className="text-xs font-mono text-[var(--text-lo)] mt-1">
            Real-time shift analytics, ticket prep SLA telemetry &amp; weekly throughput
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={syncPerformanceDaily}
            disabled={isSyncing}
            className="p-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] transition-all cursor-pointer font-mono text-xs flex items-center gap-1.5 shadow-2xs"
            title="Recalculate & Sync Daily Performance to Supabase"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[var(--gold)]" : ""}`} />
            <span className="hidden md:inline">{isSyncing ? "Syncing..." : "Sync DB"}</span>
          </button>

          <button
            type="button"
            onClick={onBackToQueue}
            className="btn-gold font-bold px-4 py-2.5 rounded-xl text-xs text-[#342c14] flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-all self-start sm:self-auto font-mono"
          >
            <Flame className="w-4 h-4" />
            <span>Back to KDS Queue</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TODAY'S TELEMETRY STATS CARDS GRID (MATCHES TELEMETRY CARD STYLE)      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Orders Completed */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] shadow-2xs space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] uppercase">
            <span>Orders Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-display font-black text-emerald-700 dark:text-[#25d366]">
              {metrics.ordersCompleted}
            </p>
            <span className="text-[10px] font-mono text-[var(--text-lo)] font-bold">
              tickets
            </span>
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-mono text-[var(--text-faint)] pt-1 border-t border-[var(--border)]/60">
            <span>Total Items:</span>
            <span className="font-bold text-[var(--text-hi)]">{metrics.itemsCooked} dishes</span>
          </div>
        </div>

        {/* Card 2: Average Prep Time */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] shadow-2xs space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] uppercase">
            <span>Avg Prep Duration</span>
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-display font-black text-amber-700 dark:text-[var(--gold)]">
              {formatPrepTime(metrics.avgPrepTimeSeconds)}
            </p>
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-mono text-[var(--text-faint)] pt-1 border-t border-[var(--border)]/60">
            <span>Target Benchmark:</span>
            <span className="font-bold text-[var(--gold)]">15m 00s SLA</span>
          </div>
        </div>

        {/* Card 3: On-Time Rate */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] shadow-2xs space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] uppercase">
            <span>On-Time SLA Rate</span>
            <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <p
              className={`text-2xl sm:text-3xl font-display font-black ${
                metrics.onTimePercent >= 85
                  ? "text-emerald-600 dark:text-[#25d366]"
                  : metrics.onTimePercent >= 70
                  ? "text-amber-500"
                  : "text-red-500"
              }`}
            >
              {metrics.onTimePercent}%
            </p>
            <span className="text-[10px] font-mono text-[var(--text-lo)]">
              ({metrics.onTimeOrders} on-time)
            </span>
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-mono text-[var(--text-faint)] pt-1 border-t border-[var(--border)]/60">
            <span>Overdue SLA:</span>
            <span
              className={`font-bold ${
                metrics.overdueOrders > 0 ? "text-red-400 font-black" : "text-emerald-400"
              }`}
            >
              {metrics.overdueOrders} orders
            </span>
          </div>
        </div>

        {/* Card 4: Current Shift & Station Telemetry */}
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] shadow-2xs space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl pointer-events-none -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] uppercase">
            <span>Station Duty</span>
            <Flame className="w-4 h-4 text-orange-500 shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-display font-black text-[var(--text-hi)] truncate uppercase">
              {chefStation.toUpperCase()}
            </p>
          </div>
          <div className="flex items-center justify-between text-[10.5px] font-mono text-[var(--text-faint)] pt-1 border-t border-[var(--border)]/60">
            <span>Shift:</span>
            <span className="font-bold text-[var(--gold)] truncate max-w-[140px]">
              {shiftInfo.shiftTitle}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MIDDLE SECTION: WEEKLY TREND BAR CHART + CURRENT SHIFT TELEMETRY       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 Cols): Weekly Throughput Trend Bar Chart */}
        <div className="lg:col-span-2 glass-panel p-5 sm:p-6 rounded-3xl border border-[var(--border)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
            <div className="space-y-0.5">
              <h2 className="font-display font-extrabold text-base sm:text-lg text-[var(--text-hi)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--gold)]" />
                <span>This Week's Order Throughput &amp; SLA</span>
              </h2>
              <p className="text-[11px] font-mono text-[var(--text-lo)]">
                Completed ticket volume vs on-time delivery across past 7 days
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[var(--text-lo)]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[var(--gold)]" />
                <span>Total Orders</span>
              </span>
              <span className="flex items-center gap-1.5 text-[var(--text-lo)]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#25d366]" />
                <span>On-Time</span>
              </span>
            </div>
          </div>

          {/* Recharts Container */}
          <div className="w-full h-[260px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyTrendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis
                  dataKey="day"
                  stroke="var(--text-lo)"
                  tick={{ fill: "var(--text-lo)", fontSize: 11, fontFamily: "monospace" }}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--text-lo)"
                  tick={{ fill: "var(--text-lo)", fontSize: 11, fontFamily: "monospace" }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(227, 177, 59, 0.08)" }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-2xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl backdrop-blur-xl font-mono text-xs space-y-1.5 min-w-[140px]">
                          <p className="font-bold text-[var(--gold)] pb-1 border-b border-[var(--border)]">
                            {data.day}
                          </p>
                          <div className="flex justify-between gap-4 text-[var(--text-hi)]">
                            <span className="text-[var(--text-lo)]">Completed:</span>
                            <span className="font-bold">{data.orders} orders</span>
                          </div>
                          <div className="flex justify-between gap-4 text-emerald-400">
                            <span className="text-[var(--text-lo)]">On-Time:</span>
                            <span className="font-bold">{data.onTime}</span>
                          </div>
                          <div className="flex justify-between gap-4 text-amber-400">
                            <span className="text-[var(--text-lo)]">Avg Prep:</span>
                            <span className="font-bold">{data.avgPrepMin}m</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="orders"
                  fill="var(--gold)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
                <Bar
                  dataKey="onTime"
                  fill="#25d366"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right (1 Col): Current Shift Info (Reused from existing shift telemetry) */}
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-[var(--border)] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
              <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-[var(--text-hi)]">
                  Current Shift &amp; Duty Info
                </h3>
                <p className="text-[11px] font-mono text-[var(--text-lo)]">
                  Active roster operational schedule
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-4 font-mono text-xs">
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--text-lo)]">
                  <User className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                  <span>Chef Name:</span>
                </div>
                <span className="text-[var(--text-hi)] font-bold truncate max-w-[130px]">
                  {user?.name || "Kitchen Chef"}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--text-lo)]">
                  <Calendar className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                  <span>Assigned Shift:</span>
                </div>
                <span className="text-[var(--text-hi)] font-bold">
                  {shiftInfo.shiftTitle}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--text-lo)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                  <span>Duty Window:</span>
                </div>
                <span className="text-[var(--gold)] font-bold">
                  {shiftInfo.shiftWindowLabel}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--text-lo)]">
                  <Timer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Start / End:</span>
                </div>
                <span className="text-emerald-400 font-bold">
                  {shiftInfo.shiftStartFormatted} - {shiftInfo.shiftEndFormatted}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--text-lo)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Station Status:</span>
                </div>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active On-Duty</span>
                </span>
              </div>
            </div>
          </div>

          {lastSyncedAt && (
            <p className="text-[10px] font-mono text-[var(--text-faint)] text-center pt-2">
              DB Rollup Synced: {lastSyncedAt}
            </p>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BOTTOM SECTION: TOP 5 DISHES COOKED TODAY                              */}
      {/* ========================================================================= */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-[var(--border)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
          <div className="space-y-0.5">
            <h2 className="font-display font-extrabold text-base sm:text-lg text-[var(--text-hi)] flex items-center gap-2">
              <Award className="w-4 h-4 text-[var(--gold)]" />
              <span>Top 5 Dishes Cooked Today</span>
            </h2>
            <p className="text-[11px] font-mono text-[var(--text-lo)]">
              Ranked by total dish portion output across today's kitchen tickets
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--text-lo)] bg-[var(--surface-hi)] px-3 py-1 rounded-xl border border-[var(--border)] self-start sm:self-auto">
            {metrics.itemsCooked} Total Cooked Dishes
          </span>
        </div>

        {topDishes.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <UtensilsCrossed className="w-8 h-8 text-[var(--text-faint)] mx-auto opacity-40" />
            <p className="text-sm font-mono text-[var(--text-lo)]">
              No orders completed yet today. Start cooking in the KDS queue to log dish throughput!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {topDishes.map((dish) => {
              const badge = getStationBadgeInfo(dish.station);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={dish.name}
                  className="p-4 rounded-2xl bg-white/70 dark:bg-[var(--surface-hi)]/60 border border-[var(--border)] flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-[var(--gold)]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                        dish.rank === 1
                          ? "bg-amber-500 text-black shadow-xs"
                          : dish.rank === 2
                          ? "bg-zinc-400 text-black"
                          : dish.rank === 3
                          ? "bg-amber-700 text-white"
                          : "bg-[var(--surface)] text-[var(--text-lo)] border border-[var(--border)]"
                      }`}
                    >
                      #{dish.rank}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-mono font-bold border uppercase shrink-0 ${badge.className}`}
                    >
                      <BadgeIcon className="w-2.5 h-2.5 shrink-0" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-xs sm:text-sm text-[var(--text-hi)] line-clamp-2 leading-snug">
                      {dish.name}
                    </h4>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="font-mono text-lg font-black text-[var(--gold)]">
                        {dish.quantity}x
                      </span>
                      <span className="font-mono text-[10.5px] text-[var(--text-lo)]">
                        {dish.sharePercent}% share
                      </span>
                    </div>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full bg-[var(--surface)] h-1.5 rounded-full overflow-hidden border border-[var(--border)]/40">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-[var(--gold)] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(8, dish.sharePercent))}%` }}
                    />
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
