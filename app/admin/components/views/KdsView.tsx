"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Flame,
  Clock,
  CheckCircle2,
  Volume2,
  Archive,
  AlertTriangle,
  Ban,
  Search,
  Calendar,
  Utensils,
  Receipt,
  X,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { KdsTicket } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { playKitchenBuzzer } from "../../../../lib/tenantStore";
import { formatSmartDuration } from "../../../../utils/timeFormatters";
import { cancelAndVoidOrderByAdmin } from "../../../../lib/adminOrderVoid";

interface KdsViewProps {
  kdsTickets: KdsTicket[];
  setKdsTickets?: React.Dispatch<React.SetStateAction<KdsTicket[]>>;
  handleAdvanceKds: (ticketId: string, specificStatus?: KdsTicket["status"]) => void;
  showToast: (msg: string) => void;
}

export default function KdsView({
  kdsTickets,
  setKdsTickets,
  handleAdvanceKds,
  showToast,
}: KdsViewProps) {
  const { user } = useAuth();

  // Scope filter: Today's Orders (default true) vs All Time
  const [onlyToday, setOnlyToday] = useState(true);

  // Active filter tab
  const [activeTab, setActiveTab] = useState<
    "all" | "queued" | "preparing" | "ready" | "completed" | "voided" | "expired"
  >("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [isBuzzerRinging, setIsBuzzerRinging] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());

  // Cancel/Void modal state
  const [cancellingTicket, setCancellingTicket] = useState<KdsTicket | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState("Customer Changed Mind");
  const [cancelReasonCustom, setCancelReasonCustom] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const customReasonInputRef = useRef<HTMLInputElement | null>(null);

  // 1-second ticking interval for reverse cook timers and elapsed times
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Buzzer chime with visual wave animation
  const triggerBuzzerChime = () => {
    playKitchenBuzzer();
    setIsBuzzerRinging(true);
    showToast("Kitchen alert buzzer sounded.");
    setTimeout(() => {
      setIsBuzzerRinging(false);
    }, 1200);
  };

  // Helper to parse ticket creation timestamp in ms
  const getTicketCreatedAtMs = (ticket: KdsTicket, fallbackNow: number): number => {
    if (ticket.created_at) {
      const t = new Date(ticket.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    if (ticket.createdAt) {
      const t = new Date(ticket.createdAt).getTime();
      if (!isNaN(t)) return t;
      const match = ticket.createdAt.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
      if (match) {
        const d = new Date();
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[4];
        if (ampm) {
          if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
          if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
        }
        d.setHours(h, m, 0, 0);
        return d.getTime();
      }
    }
    return fallbackNow;
  };

  // Date check for today's orders
  const isTodayTicket = (ticket: KdsTicket): boolean => {
    const ts = ticket.created_at || ticket.createdAt;
    if (!ts) return true;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  // Status classification helpers
  const isVoidedStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "voided" || s === "cancelled";
  };

  const isCompletedStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return (
      s === "completed" ||
      s === "fulfilled" ||
      s === "done" ||
      s === "closed" ||
      s === "archived"
    );
  };

  const isQueuedStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "queued" || s === "pending" || s === "new";
  };

  const isCookingStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "preparing" || s === "cooking" || s === "in_progress";
  };

  const isReadyStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "ready" || s === "prepared";
  };

  // 60-minute threshold for stale/expired tickets
  const STALE_THRESHOLD_MINUTES = 60;

  const checkIsTicketExpired = (ticket: KdsTicket, nowMs: number) => {
    if (ticket.isExpired || ticket.is_expired) {
      return { isExpired: true, elapsedMinutes: 60, elapsedText: "Expired" };
    }
    if (!isQueuedStatus(ticket.status)) {
      return { isExpired: false, elapsedMinutes: 0, elapsedText: "" };
    }
    const createdMs = getTicketCreatedAtMs(ticket, nowMs);
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const isExpired = elapsedMinutes >= STALE_THRESHOLD_MINUTES;
    const elapsedText = formatSmartDuration(elapsedSeconds);
    return { isExpired, elapsedMinutes, elapsedText };
  };

  // Dynamic reverse countdown timing calculation
  const getTicketTiming = (ticket: KdsTicket) => {
    let estimatedMinutes =
      ticket.estimatedPrepTime || ticket.estimated_prep_time;

    if (!estimatedMinutes && ticket.items && ticket.items.length > 0) {
      const itemTimes = ticket.items.map((it: any) => {
        return (
          it.preparation_time ||
          parseInt(String(it.prepTime || "15").replace(/[^0-9]/g, "")) ||
          15
        );
      });
      estimatedMinutes = Math.max(...itemTimes);
    }
    if (!estimatedMinutes || estimatedMinutes <= 0) {
      estimatedMinutes = 15;
    }

    const startedAt = ticket.prep_timer_started_at || ticket.prepStartedAt;

    if (!startedAt || ticket.status === "queued") {
      return {
        isStarted: false,
        estimatedMinutes,
        elapsedSeconds: 0,
        remainingSeconds: estimatedMinutes * 60,
        isOverdue: false,
        formattedTime: `~${estimatedMinutes}m queued`,
        progressPercent: 0,
      };
    }

    const startTimeMs = new Date(startedAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((nowTime - startTimeMs) / 1000));
    const totalDurationSeconds = estimatedMinutes * 60;
    const remainingSeconds = totalDurationSeconds - elapsedSeconds;

    const isOverdue = remainingSeconds <= 0;
    const absRemaining = Math.abs(remainingSeconds);
    const formattedSmart = formatSmartDuration(absRemaining);

    const formattedTime = isOverdue
      ? `+${formattedSmart} Overdue`
      : `${formattedSmart} left`;

    const progressPercent = Math.min(
      100,
      Math.max(0, Math.round((elapsedSeconds / totalDurationSeconds) * 100))
    );

    return {
      isStarted: true,
      estimatedMinutes,
      elapsedSeconds,
      remainingSeconds,
      isOverdue,
      formattedTime,
      progressPercent,
    };
  };

  // Base list filtered by Today's Scope
  const scopedTickets = useMemo(() => {
    if (!onlyToday) return kdsTickets;
    return kdsTickets.filter((t) => isTodayTicket(t));
  }, [kdsTickets, onlyToday]);

  // Telemetry Audit Counts
  const telemetry = useMemo(() => {
    let queued = 0;
    let cooking = 0;
    let ready = 0;
    let completed = 0;
    let voided = 0;
    let expired = 0;

    scopedTickets.forEach((t) => {
      const { isExpired } = checkIsTicketExpired(t, nowTime);
      if (isVoidedStatus(t.status)) {
        voided += 1;
      } else if (isExpired) {
        expired += 1;
      } else if (isCompletedStatus(t.status)) {
        completed += 1;
      } else if (isReadyStatus(t.status)) {
        ready += 1;
      } else if (isCookingStatus(t.status)) {
        cooking += 1;
      } else if (isQueuedStatus(t.status)) {
        queued += 1;
      }
    });

    return {
      total: scopedTickets.length,
      queued,
      cooking,
      ready,
      completed,
      voided,
      expired,
    };
  }, [scopedTickets, nowTime]);

  // Filtered tickets based on active tab and search query
  const filteredTickets = useMemo(() => {
    return scopedTickets.filter((ticket) => {
      const { isExpired } = checkIsTicketExpired(ticket, nowTime);
      const isVoid = isVoidedStatus(ticket.status);
      const isDone = isCompletedStatus(ticket.status);
      const isCook = isCookingStatus(ticket.status);
      const isRdy = isReadyStatus(ticket.status);
      const isQueue = isQueuedStatus(ticket.status) && !isExpired && !isVoid;

      // Filter by tab
      if (activeTab === "queued" && !isQueue) return false;
      if (activeTab === "preparing" && !isCook) return false;
      if (activeTab === "ready" && !isRdy) return false;
      if (activeTab === "completed" && !isDone) return false;
      if (activeTab === "voided" && !isVoid) return false;
      if (activeTab === "expired" && (!isExpired || isVoid || isDone)) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = ticket.id?.toLowerCase().includes(q);
        const tblMatch = ticket.tableOrChannel?.toLowerCase().includes(q);
        const serverMatch = ticket.serverName?.toLowerCase().includes(q);
        const itemsMatch = ticket.items?.some((it) =>
          it.name?.toLowerCase().includes(q) || (it.notes && it.notes.toLowerCase().includes(q))
        );
        if (!idMatch && !tblMatch && !serverMatch && !itemsMatch) return false;
      }

      return true;
    });
  }, [scopedTickets, activeTab, searchQuery, nowTime]);

  // Cancel / Void Handler via Universal adminOrderVoid helper
  const handleConfirmCancelOrder = async () => {
    if (!cancellingTicket) return;

    if (cancelReasonPreset === "Other" && !cancelReasonCustom.trim()) {
      showToast("Please write a custom reason for cancellation.");
      customReasonInputRef.current?.focus();
      return;
    }

    setIsVoiding(true);

    const finalReason =
      cancelReasonPreset === "Other"
        ? cancelReasonCustom.trim()
        : cancelReasonCustom.trim()
        ? `${cancelReasonPreset} - ${cancelReasonCustom.trim()}`
        : cancelReasonPreset;

    try {
      const res = await cancelAndVoidOrderByAdmin(user, {
        ticketId: cancellingTicket.id,
        orderId: cancellingTicket.orderId || cancellingTicket.id,
        tableNumber: cancellingTicket.table_number || cancellingTicket.tableOrChannel,
        reason: finalReason,
        adminName: user?.name || user?.email || "Admin",
      });

      if (res.success) {
        // Optimistically update local tickets state
        if (setKdsTickets) {
          setKdsTickets((prev) =>
            prev.map((t) =>
              t.id === cancellingTicket.id
                ? {
                    ...t,
                    status: "voided",
                    void_reason: `Cancelled by Admin: ${finalReason}`,
                    voided_at: new Date().toISOString(),
                  }
                : t
            )
          );
        }

        showToast(
          `Order ${cancellingTicket.id} cancelled & voided across Kitchen, Waiter, and POS.`
        );
        setCancellingTicket(null);
        setCancelReasonCustom("");
      } else {
        showToast(`Failed to cancel order: ${res.error || "Unknown error"}`);
      }
    } catch (err: any) {
      showToast(`Error cancelling order: ${err?.message || "Internal error"}`);
    } finally {
      setIsVoiding(false);
    }
  };

  const todayDateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={`px-4 sm:px-6 md:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200 transition-all ${
        isBuzzerRinging ? "ring-4 ring-amber-500/50" : ""
      }`}
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
              Live Order & Kitchen Audit
            </span>
            <span className="text-[11px] font-mono text-[var(--text-faint)]">•</span>
            <span className="text-[11px] font-mono text-[var(--text-faint)] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[var(--gold)]" />
              {todayDateStr}
            </span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
            Order Audit &{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Kitchen Operations Hub
            </span>
          </h1>
          <p className="text-xs font-mono text-[var(--text-lo)] mt-0.5">
            Real-time daily incoming orders, preparation stages, and cross-terminal order cancellation control.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Today Only vs All History Switcher */}
          <button
            type="button"
            onClick={() => setOnlyToday((prev) => !prev)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-mono font-bold cursor-pointer flex items-center gap-2 transition-all shadow-2xs ${
              onlyToday
                ? "bg-[var(--gold)] text-[#2a2007] border-[var(--gold)] font-black"
                : "bg-white/80 dark:bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{onlyToday ? "Daily Audit: Today Only" : "All Records (All Dates)"}</span>
          </button>

          {/* Test Buzzer Chime */}
          <button
            type="button"
            onClick={triggerBuzzerChime}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold font-mono cursor-pointer flex items-center gap-2 transition-all shadow-2xs ${
              isBuzzerRinging
                ? "bg-amber-500 text-black border-amber-400 shadow-amber-500/40 scale-105"
                : "bg-white/80 dark:bg-[var(--surface-hi)] border border-[var(--border)] hover:border-amber-500/50 text-amber-900 dark:text-amber-400"
            }`}
          >
            <Volume2 className={`w-3.5 h-3.5 ${isBuzzerRinging ? "animate-bounce" : ""}`} />
            <span>Test Buzzer</span>
          </button>
        </div>
      </div>

      {/* Telemetry Bar (7 KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {/* Total Orders Today */}
        <div
          onClick={() => setActiveTab("all")}
          className={`p-3 rounded-2xl border space-y-1 transition-all cursor-pointer shadow-2xs ${
            activeTab === "all"
              ? "bg-[var(--surface-hi)] border-[var(--gold)] ring-1 ring-[var(--gold)]"
              : "bg-white/80 dark:bg-[var(--surface-hi)]/70 border-[var(--border)] hover:border-[var(--gold)]/40"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] uppercase">
            <span>Total Today</span>
            <Receipt className="w-3.5 h-3.5 text-[var(--gold)]" />
          </div>
          <p className="text-xl font-display font-black text-[var(--text-hi)]">{telemetry.total}</p>
        </div>

        {/* Queued / Placed (Not Cooking Yet) */}
        <div
          onClick={() => setActiveTab("queued")}
          className={`p-3 rounded-2xl border space-y-1 transition-all cursor-pointer shadow-2xs ${
            activeTab === "queued"
              ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500"
              : "bg-white/80 dark:bg-[var(--surface-hi)]/70 border-[var(--border)] hover:border-blue-400/40"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-blue-400 uppercase">
            <span>Queued</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-xl font-display font-black text-blue-600 dark:text-blue-400">{telemetry.queued}</p>
        </div>

        {/* Cooking Now */}
        <div
          onClick={() => setActiveTab("preparing")}
          className={`p-3 rounded-2xl border space-y-1 transition-all cursor-pointer shadow-2xs ${
            activeTab === "preparing"
              ? "bg-amber-500/10 border-amber-500 ring-1 ring-amber-500"
              : "bg-white/80 dark:bg-[var(--surface-hi)]/70 border-[var(--border)] hover:border-amber-400/40"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-amber-500 uppercase">
            <span>Cooking</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-display font-black text-amber-600 dark:text-amber-400">{telemetry.cooking}</p>
        </div>

        {/* Ready for Handoff */}
        <div
          onClick={() => setActiveTab("ready")}
          className={`p-3 rounded-2xl border space-y-1 transition-all cursor-pointer shadow-2xs ${
            activeTab === "ready"
              ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500"
              : "bg-white/80 dark:bg-[var(--surface-hi)]/70 border-[var(--border)] hover:border-emerald-400/40"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-500 uppercase">
            <span>Ready</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-xl font-display font-black text-emerald-600 dark:text-[#25d366]">{telemetry.ready}</p>
        </div>

        {/* Completed Today */}
        <div
          onClick={() => setActiveTab("completed")}
          className={`p-3 rounded-2xl border space-y-1 transition-all cursor-pointer shadow-2xs ${
            activeTab === "completed"
              ? "bg-[var(--surface-hi)] border-[var(--gold)] ring-1 ring-[var(--gold)]"
              : "bg-white/80 dark:bg-[var(--surface-hi)]/70 border-[var(--border)] hover:border-[var(--gold)]/40"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--gold)] uppercase">
            <span>Completed</span>
            <Archive className="w-3.5 h-3.5 text-[var(--gold)]" />
          </div>
          <p className="text-xl font-display font-black text-amber-700 dark:text-[var(--gold)]">{telemetry.completed}</p>
        </div>

        {/* Voided / Cancelled */}
        <div
          onClick={() => setActiveTab("voided")}
          className={`p-3 rounded-2xl border space-y-1 transition-all cursor-pointer shadow-2xs ${
            activeTab === "voided"
              ? "bg-red-500/10 border-red-500 ring-1 ring-red-500"
              : "bg-white/80 dark:bg-[var(--surface-hi)]/70 border-[var(--border)] hover:border-red-400/40"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-red-400 uppercase">
            <span>Voided</span>
            <Ban className="w-3.5 h-3.5 text-red-500" />
          </div>
          <p className="text-xl font-display font-black text-red-600 dark:text-red-400">{telemetry.voided}</p>
        </div>

        {/* Expired / Stale */}
        <div
          onClick={() => setActiveTab("expired")}
          className={`p-3 rounded-2xl border space-y-1 transition-all cursor-pointer shadow-2xs ${
            activeTab === "expired"
              ? "bg-rose-500/10 border-rose-500 ring-1 ring-rose-500"
              : "bg-white/80 dark:bg-[var(--surface-hi)]/70 border-[var(--border)] hover:border-rose-400/40"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-rose-400 uppercase">
            <span>Expired</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <p className="text-xl font-display font-black text-rose-600 dark:text-rose-400">{telemetry.expired}</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Mobile Filter Dropdown */}
        <div className="lg:hidden w-full">
          <ResponsiveSelect
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
            options={[
              { id: "all", label: "All Orders", count: telemetry.total },
              { id: "queued", label: "Queued (Not Started)", count: telemetry.queued },
              { id: "preparing", label: "Cooking Now", count: telemetry.cooking },
              { id: "ready", label: "Ready for Handoff", count: telemetry.ready },
              { id: "completed", label: "Completed", count: telemetry.completed },
              { id: "voided", label: "Voided / Cancelled", count: telemetry.voided },
              { id: "expired", label: "Expired / Stale", count: telemetry.expired },
            ]}
          />
        </div>

        {/* Desktop Filter Pills */}
        <div className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] overflow-x-auto max-w-full scrollbar-none">
          {[
            { id: "all", label: `All (${telemetry.total})` },
            { id: "queued", label: `Queued (${telemetry.queued})` },
            { id: "preparing", label: `Cooking (${telemetry.cooking})` },
            { id: "ready", label: `Ready (${telemetry.ready})` },
            { id: "completed", label: `Completed (${telemetry.completed})` },
            { id: "voided", label: `Voided (${telemetry.voided})` },
            { id: "expired", label: `Expired (${telemetry.expired})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "btn-gold text-[#342c14] shadow-sm font-black"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-lo)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search KOT, table, dish..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/70 dark:bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Orders ListTile Form */}
      {filteredTickets.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-[var(--border)] space-y-3">
          <Utensils className="w-12 h-12 text-[var(--gold)] mx-auto opacity-70" />
          <p className="font-display font-bold text-base text-[var(--text-hi)]">
            No Orders Found in This View
          </p>
          <p className="text-xs font-mono text-[var(--text-faint)] max-w-md mx-auto">
            {activeTab === "voided"
              ? "No orders have been voided or cancelled today."
              : activeTab === "expired"
              ? "All placed orders were initiated on time. No stale/expired tickets."
              : activeTab === "completed"
              ? "No orders completed yet for the selected period."
              : "No tickets matching your filter criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const timing = getTicketTiming(ticket);
            const { isExpired, elapsedMinutes: elapsedSincePlaced, elapsedText: elapsedSincePlacedText } =
              checkIsTicketExpired(ticket, nowTime);
            const isCooking = isCookingStatus(ticket.status);
            const isReady = isReadyStatus(ticket.status);
            const isCompleted = isCompletedStatus(ticket.status);
            const isVoided = isVoidedStatus(ticket.status);
            const isOverdue = isCooking && timing.isOverdue;

            // Status border accent
            const statusAccentColor = isVoided
              ? "border-l-red-500 bg-red-950/10"
              : isExpired
              ? "border-l-rose-500 bg-rose-950/10"
              : isCompleted
              ? "border-l-[var(--gold)]/40 bg-[var(--surface-hi)]/20 opacity-80"
              : isReady
              ? "border-l-[#25d366] bg-[#25d366]/5"
              : isOverdue
              ? "border-l-red-500 bg-red-500/5"
              : isCooking
              ? "border-l-amber-500 bg-amber-500/5"
              : "border-l-blue-500 bg-blue-500/5";

            return (
              <div
                key={ticket.id}
                className={`glass-panel p-4 rounded-2xl border border-[var(--border)] border-l-4 transition-all duration-200 shadow-sm hover:shadow-md hover:border-[var(--gold)]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${statusAccentColor}`}
              >
                {/* Left Section: Ticket Info & Table */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-[280px]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm sm:text-base text-[var(--text-hi)] flex items-center gap-1.5">
                        {ticket.priority === "urgent" && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        )}
                        {ticket.id}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30">
                        {ticket.tableOrChannel || "Takeaway"}
                      </span>

                      {ticket.orderType && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]">
                          {ticket.orderType.replace("_", " ")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-lo)] flex-wrap">
                      <span>Server: <strong className="text-[var(--text-hi)]">{ticket.serverName || "Front Desk"}</strong></span>
                      <span>•</span>
                      {ticket.createdAt && (
                        <span>
                          Placed: {ticket.createdAt}
                          {isExpired ? ` (${elapsedSincePlacedText || `${elapsedSincePlaced}m`} ago)` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle Section: Dishes List & Custom Notes */}
                <div className="flex-1 space-y-1.5 max-w-2xl">
                  <div className="flex flex-wrap gap-1.5">
                    {ticket.items.map((it, idx) => {
                      const qty = Number(it.qty || (it as any).quantity || 1);
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/70 dark:bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-medium text-[var(--text-hi)]"
                        >
                          <span className="font-mono font-bold text-[var(--gold)] bg-[var(--gold)]/10 px-1.5 py-0.2 rounded text-[11px]">
                            {qty}x
                          </span>
                          <span>{it.name}</span>
                          {it.notes && (
                            <span className="text-[10px] text-amber-500 font-mono italic flex items-center gap-0.5 ml-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              {it.notes}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Voided Details Notice */}
                  {isVoided && (
                    <div className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        <strong>Voided by Admin:</strong>{" "}
                        {ticket.void_reason || "Cancelled and payment blocked across all terminals."}
                      </span>
                    </div>
                  )}

                  {/* Expired Stale Notice */}
                  {isExpired && !isVoided && (
                    <div className="text-xs font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        <strong>Expired Ticket:</strong> Exceeded {STALE_THRESHOLD_MINUTES}m in queue without cooking.
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Badge & Actions Section */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border)]">
                  {/* Status Indicator Badge */}
                  <div className="min-w-[120px] text-right">
                    {isVoided ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-red-500/15 text-red-400 border border-red-500/30">
                        <Ban className="w-3.5 h-3.5" />
                        VOIDED
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        EXPIRED
                      </span>
                    ) : isReady ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        READY
                      </span>
                    ) : isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[var(--surface-hi)] text-[var(--gold)] border border-[var(--border)]">
                        <Archive className="w-3.5 h-3.5" />
                        COMPLETED
                      </span>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-red-500/15 text-red-400 border border-red-500/30 animate-bounce">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {timing.formattedTime}
                      </span>
                    ) : isCooking ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                        <Flame className="w-3.5 h-3.5" />
                        {timing.formattedTime}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        QUEUED
                      </span>
                    )}
                  </div>

                  {/* Actions Group */}
                  <div className="flex items-center gap-2">
                    {/* Universal Admin Cancel / Void Button (Available for all non-completed and non-voided tickets) */}
                    {!isCompleted && !isVoided && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancellingTicket(ticket);
                          setCancelReasonPreset("Customer Changed Mind");
                          setCancelReasonCustom("");
                        }}
                        className="px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all shadow-2xs hover:scale-102"
                        title="Cancel & Void order across Kitchen, Waiter, and POS terminals"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel Order</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Cancel & Void Confirmation Modal */}
      {cancellingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden font-sans animate-in zoom-in-95 duration-150 relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-hi)]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base sm:text-lg text-[var(--text-hi)]">
                    Cancel &amp; Void Order
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-lo)]">
                    Target: <strong className="text-[var(--gold)]">{cancellingTicket.id}</strong> ({cancellingTicket.tableOrChannel || "Table"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancellingTicket(null)}
                disabled={isVoiding}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 sm:space-y-5">
              {/* Warning Explanation Notice */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-950/25 border border-amber-600/30 space-y-1.5 text-xs font-mono text-amber-200/90">
                <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Permanent Cross-Terminal Cancellation</span>
                </div>
                <p className="leading-relaxed text-[var(--text-lo)]">
                  Cancelling this order will immediately mark it as <strong className="text-red-400 font-bold">VOIDED</strong> across the Kitchen Station, Waiter Terminal, and POS Order Hub. The occupied table will be released, and payment settlement will be strictly blocked.
                </p>
              </div>

              {/* Quick Reason Presets */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-[var(--text-lo)] uppercase">
                  Select Cancellation Reason
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    "Customer Changed Mind",
                    "Guest Left / Walked Out",
                    "Duplicate / Mistake Order",
                    "Kitchen Delay / Out of Stock",
                    "Other",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setCancelReasonPreset(preset);
                        if (preset === "Other") {
                          setTimeout(() => customReasonInputRef.current?.focus(), 50);
                        }
                      }}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-mono text-left border transition-all cursor-pointer ${
                        cancelReasonPreset === preset
                          ? "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)] ring-1 ring-[var(--gold)] font-black shadow-sm"
                          : "bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:border-[var(--gold)]/40 font-bold"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Notes / Details (Mandatory if 'Other' selected) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold uppercase">
                  <label
                    htmlFor="cancel-custom-reason"
                    className={
                      cancelReasonPreset === "Other"
                        ? "text-amber-400 flex items-center gap-1.5"
                        : "text-[var(--text-lo)]"
                    }
                  >
                    {cancelReasonPreset === "Other" ? (
                      <>
                        <span>Specify Cancellation Reason</span>
                        <span className="text-red-400 font-bold">* (Required)</span>
                      </>
                    ) : (
                      "Additional Notes (Optional)"
                    )}
                  </label>
                  {cancelReasonPreset === "Other" && !cancelReasonCustom.trim() && (
                    <span className="text-[10px] text-amber-400 font-normal normal-case">
                      Reason required to proceed
                    </span>
                  )}
                </div>
                <input
                  id="cancel-custom-reason"
                  ref={customReasonInputRef}
                  type="text"
                  value={cancelReasonCustom}
                  onChange={(e) => setCancelReasonCustom(e.target.value)}
                  placeholder={
                    cancelReasonPreset === "Other"
                      ? "Write cancellation reason here (required)..."
                      : "e.g. Guest had to rush, table bill cleared as void..."
                  }
                  className={`w-full px-4 py-2.5 rounded-xl bg-[var(--surface-hi)]/60 border text-xs font-mono text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none transition-all ${
                    cancelReasonPreset === "Other" && !cancelReasonCustom.trim()
                      ? "border-amber-500/70 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                      : "border-[var(--border)] focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]"
                  }`}
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setCancellingTicket(null)}
                  disabled={isVoiding}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] font-mono font-bold text-xs cursor-pointer border border-[var(--border)] transition-all"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelOrder}
                  disabled={isVoiding || (cancelReasonPreset === "Other" && !cancelReasonCustom.trim())}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-mono font-black text-xs cursor-pointer shadow-lg shadow-red-950/60 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {isVoiding ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Voiding Order...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Void Order</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
