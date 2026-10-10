"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Flame,
  Clock,
  CheckCircle2,
  Check,
  Bell,
  Volume2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  UtensilsCrossed,
  ShoppingBag,
  Bike,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { KdsTicket } from "@/app/admin/types";
import { useAuth } from "@/app/admin/context/AuthContext";
import ResponsiveSelect from "@/app/admin/components/ResponsiveSelect";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import {
  getStoredKdsTickets,
  saveStoredKdsTickets,
  playKitchenBuzzer,
} from "@/lib/tenantStore";
import { deductInventoryStockForOrder } from "@/lib/inventoryDeduction";

export default function KitchenTerminalClient() {
  const router = useRouter();
  const { user } = useAuth();
  const currentOrgId = user?.organizationId || user?.id || "default";

  const [kdsTickets, setKdsTickets] = useState<KdsTicket[]>(() => {
    return getStoredKdsTickets(currentOrgId, []);
  });

  const [activeTab, setActiveTab] = useState<"all_active" | "queued" | "preparing" | "ready" | "completed">("all_active");
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isBuzzerRinging, setIsBuzzerRinging] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // 1-second interval for live countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger kitchen audio buzzer chime
  const handleTriggerBuzzer = () => {
    playKitchenBuzzer();
    setIsBuzzerRinging(true);
    showToast("Kitchen alert chime sounded.");
    setTimeout(() => setIsBuzzerRinging(false), 1200);
  };

  // Fetch live tickets from Supabase and subscribe to realtime changes
  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const fetchTickets = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        const { data, error } = await supabase
          .from("kitchen_tickets")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false });

        if (!error && data && isMounted) {
          const mapped: KdsTicket[] = data.map((t: any) => ({
            id: t.ticket_number || t.id,
            tableOrChannel: t.table_number || t.channel,
            orderType: t.channel,
            elapsedMinutes: t.prep_timer_started_at
              ? Math.max(0, Math.round((Date.now() - new Date(t.prep_timer_started_at).getTime()) / 60000))
              : (t.elapsed_minutes || 0),
            items: Array.isArray(t.items)
              ? t.items.map((it: any) => ({
                  ...it,
                  name: it.name || it.item?.name || "Dish",
                  qty: Number(it.qty || it.quantity || 1),
                }))
              : [],
            status: t.status,
            serverName: t.server_name || "Front Desk",
            priority: t.priority,
            createdAt: t.created_at
              ? new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Just now",
            created_at: t.created_at || undefined,
            isDeducted: Boolean(t.prep_timer_started_at || t.status === "preparing" || t.status === "ready" || t.status === "completed"),
            prepStartedAt: t.prep_timer_started_at || undefined,
            prep_timer_started_at: t.prep_timer_started_at || undefined,
            estimatedPrepTime: Number(t.estimated_prep_time) || 15,
            estimated_prep_time: Number(t.estimated_prep_time) || 15,
          }));

          setKdsTickets(mapped);
          saveStoredKdsTickets(currentOrgId, mapped);
        }

        // Realtime Subscription
        const subId = Math.random().toString(36).substring(2, 7);
        channel = supabase
          .channel(`kds_term_${restId}_${subId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "kitchen_tickets",
              filter: `restaurant_id=eq.${restId}`,
            },
            (payload) => {
              if (payload.eventType === "INSERT") {
                const newRow: any = payload.new;
                const newT: KdsTicket = {
                  id: newRow.ticket_number || newRow.id,
                  tableOrChannel: newRow.table_number || newRow.channel,
                  orderType: newRow.channel,
                  elapsedMinutes: 0,
                  items: Array.isArray(newRow.items) ? newRow.items : [],
                  status: newRow.status,
                  serverName: newRow.server_name || "Front Desk",
                  priority: newRow.priority,
                  createdAt: newRow.created_at
                    ? new Date(newRow.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Just now",
                  created_at: newRow.created_at || undefined,
                  prepStartedAt: newRow.prep_timer_started_at || undefined,
                  prep_timer_started_at: newRow.prep_timer_started_at || undefined,
                  estimatedPrepTime: Number(newRow.estimated_prep_time) || 15,
                  estimated_prep_time: Number(newRow.estimated_prep_time) || 15,
                };
                playKitchenBuzzer();
                setKdsTickets((prev) => [newT, ...prev.filter((t) => t.id !== newT.id)]);
                showToast(`New Kitchen Ticket: ${newT.id}`);
              } else if (payload.eventType === "UPDATE") {
                const uRow: any = payload.new;
                setKdsTickets((prev) =>
                  prev.map((t) =>
                    t.id === uRow.ticket_number || t.id === uRow.id
                      ? {
                          ...t,
                          status: uRow.status,
                          prepStartedAt: uRow.prep_timer_started_at || t.prepStartedAt,
                          prep_timer_started_at: uRow.prep_timer_started_at || t.prep_timer_started_at,
                          estimatedPrepTime: Number(uRow.estimated_prep_time) || t.estimatedPrepTime,
                        }
                      : t
                  )
                );
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("[KitchenTerminal] Supabase connection error:", err);
      }
    };

    fetchTickets();

    return () => {
      isMounted = false;
      if (channel) channel.unsubscribe();
    };
  }, [user, currentOrgId, showToast]);

  const advancingTicketsRef = useRef<Set<string>>(new Set());

  // Advance ticket status and trigger real-time stock deduction
  const handleAdvanceTicket = async (ticketId: string, targetStatus?: KdsTicket["status"]) => {
    if (advancingTicketsRef.current.has(ticketId)) return;
    const currentTicket = kdsTickets.find((t) => t.id === ticketId);
    if (!currentTicket) return;

    advancingTicketsRef.current.add(ticketId);
    try {
      let nextStatus: KdsTicket["status"] = "preparing";
      if (targetStatus) {
        nextStatus = targetStatus;
      } else {
        if (currentTicket.status === "queued") nextStatus = "preparing";
        else if (currentTicket.status === "preparing") nextStatus = "ready";
        else if (currentTicket.status === "ready") nextStatus = "completed";
        else nextStatus = "preparing";
      }

    const isStartingCooking = nextStatus === "preparing" && currentTicket.status !== "preparing";
    const prepTimestamp = new Date().toISOString();

    // 1. Optimistic Update
    const updatedTickets = kdsTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: nextStatus,
          prepStartedAt: isStartingCooking ? (t.prepStartedAt || prepTimestamp) : t.prepStartedAt,
          prep_timer_started_at: isStartingCooking ? (t.prep_timer_started_at || prepTimestamp) : t.prep_timer_started_at,
          isDeducted: isStartingCooking ? true : t.isDeducted,
        };
      }
      return t;
    });

    setKdsTickets(updatedTickets);
    saveStoredKdsTickets(currentOrgId, updatedTickets);

    if (nextStatus === "ready") {
      playKitchenBuzzer();
      showToast(`Ticket #${ticketId} is READY for service!`);
    } else {
      showToast(`Ticket #${ticketId} moved to ${nextStatus.toUpperCase()}`);
    }

    // 2. Real-time Inventory Stock Deduction on Cooking Start
    if (isStartingCooking && !currentTicket.isDeducted) {
      try {
        const { restId } = await getValidTenantContext(user);
        await deductInventoryStockForOrder(restId, currentTicket.items || []);
      } catch (deductErr) {
        console.warn("[KitchenTerminal] Stock deduction exception:", deductErr);
      }
    }

    // 3. Supabase Sync
    try {
      const supabase = createClient();
      const updatePayload: any = { status: nextStatus };
      if (isStartingCooking) updatePayload.prep_timer_started_at = prepTimestamp;
      if (nextStatus === "completed") updatePayload.completed_at = new Date().toISOString();

      await supabase
        .from("kitchen_tickets")
        .update(updatePayload)
        .or(`ticket_number.eq.${ticketId},id.eq.${ticketId}`);
    } catch (syncErr) {
      console.warn("[KitchenTerminal] Error updating ticket in Supabase:", syncErr);
    }
  } finally {
    setTimeout(() => {
      advancingTicketsRef.current.delete(ticketId);
    }, 800);
  }
};

  // Live timer calculation
  const getTicketTiming = (ticket: KdsTicket) => {
    let estimatedMinutes = ticket.estimatedPrepTime || ticket.estimated_prep_time || 15;
    const startedAt = ticket.prep_timer_started_at || ticket.prepStartedAt;

    if (!startedAt || ticket.status === "queued") {
      return {
        isStarted: false,
        estimatedMinutes,
        elapsedSeconds: 0,
        remainingSeconds: estimatedMinutes * 60,
        isOverdue: false,
        formattedTime: `~${estimatedMinutes}m target`,
        progressPercent: 0,
      };
    }

    const startTimeMs = new Date(startedAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((nowTime - startTimeMs) / 1000));
    const totalTargetSeconds = estimatedMinutes * 60;
    const remainingSeconds = totalTargetSeconds - elapsedSeconds;
    const isOverdue = remainingSeconds <= 0;

    const progressPercent = Math.min(
      100,
      Math.max(0, Math.floor((elapsedSeconds / totalTargetSeconds) * 100))
    );

    const formatTimer = (totalSec: number) => {
      const absSec = Math.abs(totalSec);
      const mins = Math.floor(absSec / 60);
      const secs = absSec % 60;
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    return {
      isStarted: true,
      estimatedMinutes,
      elapsedSeconds,
      remainingSeconds,
      isOverdue,
      formattedTime: isOverdue ? `+${formatTimer(remainingSeconds)} overdue` : `${formatTimer(remainingSeconds)} left`,
      progressPercent,
    };
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return kdsTickets.filter((t) => {
      // Tab filter
      if (activeTab === "all_active" && (t.status === "completed" || t.status === "archived")) return false;
      if (activeTab !== "all_active" && t.status !== activeTab) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesChannel = (t.tableOrChannel || "").toLowerCase().includes(q);
        const matchesItem = (t.items || []).some((it: any) => (it.name || "").toLowerCase().includes(q));
        if (!matchesId && !matchesChannel && !matchesItem) return false;
      }

      return true;
    });
  }, [kdsTickets, activeTab, searchQuery]);

  // Counts for badge headers
  const counts = useMemo(() => {
    return {
      all: kdsTickets.filter((t) => t.status !== "completed" && t.status !== "archived").length,
      queued: kdsTickets.filter((t) => t.status === "queued").length,
      preparing: kdsTickets.filter((t) => t.status === "preparing").length,
      ready: kdsTickets.filter((t) => t.status === "ready").length,
      completed: kdsTickets.filter((t) => t.status === "completed" || t.status === "archived").length,
    };
  }, [kdsTickets]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-hi)] select-none overflow-hidden">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--bg)] border border-[var(--gold)]/40 text-[var(--gold)] shadow-2xl font-mono text-xs font-semibold animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-[var(--gold)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* KDS SECONDARY CONTROL BAR                                                 */}
      {/* ========================================================================= */}
      <div className="h-14 px-4 sm:px-6 md:px-8 bg-[var(--surface-hi)]/80 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
        {/* Left: Station Identity & Quick Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold text-xs font-mono">
            <Flame className="w-4 h-4" />
            <span className="uppercase tracking-wider">KDS Terminal Station</span>
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
              onClick={() => router.push("/terminal/rider")}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center gap-1.5 cursor-pointer"
            >
              <Bike className="w-3.5 h-3.5 text-blue-400" />
              <span>Rider Dispatch</span>
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

        {/* Center: Stage Filter Tabs */}
        {/* Mobile & Tablet Dropdown Filter (< 1024px) */}
        <div className="lg:hidden w-40 sm:w-52">
          <ResponsiveSelect
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
            options={[
              { id: "all_active", label: "Active", count: counts.all },
              { id: "queued", label: "Queued", count: counts.queued },
              { id: "preparing", label: "Cooking", count: counts.preparing },
              { id: "ready", label: "Ready", count: counts.ready },
              { id: "completed", label: "Done", count: counts.completed },
            ]}
            buttonClassName="h-9 text-xs font-mono font-bold text-[var(--text-hi)]"
            menuClassName="w-48 sm:w-56"
          />
        </div>

        {/* Desktop Stage Filter Tabs (>= 1024px) */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-[var(--bg-deep)] rounded-xl border border-[var(--border)] overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab("all_active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "all_active"
                ? "bg-[var(--surface-hi)] text-[var(--text-hi)] shadow-sm border border-[var(--border)]"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <span>Active</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--border)] font-mono">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("queued")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "queued"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <span>Queued</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-400">
              {counts.queued}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preparing")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "preparing"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <span>Cooking</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-orange-500/20 text-orange-400">
              {counts.preparing}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ready")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "ready"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <span>Ready</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400">
              {counts.ready}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "completed"
                ? "bg-[var(--surface-hi)] text-[var(--text-hi)] border border-[var(--border)] shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <span>Done</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--border)]">
              {counts.completed}
            </span>
          </button>
        </div>

        {/* Right: Search & Buzzer Button */}
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block w-44">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--gold)] transition-colors font-mono"
            />
          </div>

          <button
            type="button"
            onClick={handleTriggerBuzzer}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-mono font-bold cursor-pointer transition-all ${
              isBuzzerRinging
                ? "bg-red-500 text-white border-red-400 animate-bounce"
                : "bg-[var(--bg)] hover:bg-[var(--surface-hi)] border-[var(--border)] text-orange-400"
            }`}
            title="Sound kitchen alert buzzer"
          >
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chime</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TICKET MATRIX CARDS VIEWPORT                                              */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        {filteredTickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-3">
              <Flame className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="text-base font-bold font-display text-[var(--text-hi)]">
              All Orders Prepared
            </h3>
            <p className="text-xs font-mono text-[var(--text-lo)] max-w-sm mt-1">
              There are no pending tickets in the {activeTab.replace("_", " ")} queue. New orders from POS Counter will pop up here instantly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTickets.map((ticket) => {
              const timing = getTicketTiming(ticket);
              const isUrgent = ticket.priority === "urgent" || ticket.orderType === "delivery";
              const isCompleted = ticket.status === "completed" || ticket.status === "archived";

              return (
                <div
                  key={ticket.id}
                  className={`rounded-2xl glass-panel border flex flex-col justify-between overflow-hidden shadow-md transition-all duration-200 ${
                    ticket.status === "ready"
                      ? "border-emerald-500/50 bg-emerald-50/60 dark:bg-emerald-950/15"
                      : ticket.status === "preparing"
                      ? timing.isOverdue
                        ? "border-red-500/60 bg-red-50/60 dark:bg-red-950/20 animate-pulse"
                        : "border-orange-500/40 bg-orange-50/60 dark:bg-orange-950/10"
                      : "border-[var(--border)] bg-[var(--surface-hi)]/40"
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-3.5 border-b border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[var(--text-hi)]">
                          {ticket.id}
                        </span>
                        {isUrgent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 uppercase">
                            Urgent
                          </span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs ${
                          ticket.status === "ready"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                            : ticket.status === "preparing"
                            ? "bg-orange-50 text-orange-800 border border-orange-200/80 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30"
                            : ticket.status === "queued"
                            ? "bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
                            : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>

                    {/* Table / Channel & Time */}
                    <div className="flex items-center justify-between text-xs font-mono text-[var(--text-lo)]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-[var(--gold)]">
                          {ticket.tableOrChannel}
                        </span>
                        <span className="text-[var(--text-faint)]">•</span>
                        <span className="capitalize">{ticket.orderType}</span>
                      </div>
                      <span className="text-[11px] text-[var(--text-faint)]">
                        {ticket.createdAt}
                      </span>
                    </div>

                    {/* Dynamic Cook Countdown Timer Bar */}
                    {ticket.status === "preparing" && (
                      <div className="pt-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="flex items-center gap-1 text-orange-400 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>Timer:</span>
                          </span>
                          <span
                            className={`font-bold font-mono ${
                              timing.isOverdue ? "text-red-400 animate-pulse" : "text-orange-400"
                            }`}
                          >
                            {timing.formattedTime}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              timing.isOverdue ? "bg-red-500" : "bg-orange-500"
                            }`}
                            style={{ width: `${timing.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Body: Items List */}
                  <div className="p-3.5 flex-1 space-y-2 overflow-y-auto max-h-56">
                    {ticket.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-2 p-2 rounded-xl bg-[var(--bg-deep)]/60 border border-[var(--border)]/60"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-[var(--text-hi)] leading-tight">
                            {item.name}
                          </div>
                          {item.notes && (
                            <div className="text-[10px] font-mono text-amber-400/90 italic">
                              Note: {item.notes}
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] font-mono font-black text-xs text-[var(--gold)] shrink-0">
                          x{item.qty || item.quantity || 1}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Card Footer: Action Buttons */}
                  <div className="p-3 bg-[var(--surface-hi)]/60 border-t border-[var(--border)]">
                    {ticket.status === "queued" && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceTicket(ticket.id, "preparing")}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <Flame className="w-4 h-4" />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {ticket.status === "preparing" && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceTicket(ticket.id, "ready")}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Order Ready</span>
                      </button>
                    )}

                    {ticket.status === "ready" && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceTicket(ticket.id, "completed")}
                        className="w-full py-2.5 px-3 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 text-[var(--text-hi)] border border-[var(--border)] hover:border-emerald-500/50 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Hand Over / Served</span>
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceTicket(ticket.id, "ready")}
                        className="w-full py-2 px-3 rounded-xl bg-[var(--bg-deep)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-mono text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Recall Ticket</span>
                      </button>
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
