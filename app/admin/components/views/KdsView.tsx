"use client";

import React, { useState, useEffect } from "react";
import {
  Flame,
  Clock,
  CheckCircle2,
  Check,
  Bell,
  Volume2,
  Archive,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { KdsTicket } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { playKitchenBuzzer, saveStoredKdsTickets } from "../../../../lib/tenantStore";
import { formatSmartDuration } from "../../../../utils/timeFormatters";

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
  const currentOrgId = user?.organizationId || user?.id || "default";

  // Filter tab state
  const [activeTab, setActiveTab] = useState<"all_active" | "queued" | "preparing" | "ready" | "completed">("all_active");
  const [isBuzzerRinging, setIsBuzzerRinging] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());

  // Real-time 1-second ticking interval for live reverse cook timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sound Buzzer Chime with visual wave effect
  const triggerBuzzerChime = () => {
    playKitchenBuzzer();
    setIsBuzzerRinging(true);
    showToast("Kitchen alert buzzer sounded.");
    setTimeout(() => {
      setIsBuzzerRinging(false);
    }, 1200);
  };

  // Live reverse countdown timing engine
  const getTicketTiming = (ticket: KdsTicket) => {
    let estimatedMinutes =
      ticket.estimatedPrepTime ||
      ticket.estimated_prep_time;

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

    const startedAt =
      ticket.prep_timer_started_at ||
      ticket.prepStartedAt;

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

  // Advance ticket status through full workflow: queued -> preparing -> ready -> completed
  const handleTransition = (ticketId: string) => {
    handleAdvanceKds(ticketId);
  };

  // Re-open completed ticket if needed
  const handleReopenTicket = (ticketId: string) => {
    handleAdvanceKds(ticketId, "preparing");
  };

  // Stale Ticket Threshold Configuration (60 minutes unstarted)
  const STALE_THRESHOLD_MINUTES = 60;

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

  const checkIsTicketStale = (ticket: KdsTicket, nowMs: number) => {
    if (ticket.status !== "queued") {
      return { isStale: false, elapsedMinutes: 0, elapsedText: "" };
    }
    const createdMs = getTicketCreatedAtMs(ticket, nowMs);
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const isStale = elapsedMinutes >= STALE_THRESHOLD_MINUTES;
    const elapsedText = formatSmartDuration(elapsedSeconds);
    return { isStale, elapsedMinutes, elapsedText };
  };

  // Counts for telemetry
  const queuedTickets = kdsTickets.filter((t) => t.status === "queued");
  const preparingTickets = kdsTickets.filter((t) => t.status === "preparing");
  const readyTickets = kdsTickets.filter((t) => t.status === "ready");
  const completedTickets = kdsTickets.filter((t) => t.status === "completed" || t.status === "cancelled");

  const filteredTickets = kdsTickets.filter((ticket) => {
    if (activeTab === "all_active") {
      return ticket.status !== "completed" && ticket.status !== "cancelled";
    }
    return ticket.status === activeTab;
  });

  return (
    <div className={`p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200 transition-all ${
      isBuzzerRinging ? "ring-4 ring-amber-500/50" : ""
    }`}>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            • KITCHEN STATION TELEMETRY
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Kitchen Order Display{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              (KDS Station)
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Live Kitchen Telemetry
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={triggerBuzzerChime}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold font-mono cursor-pointer flex items-center gap-2 transition-all shadow-md ${
              isBuzzerRinging
                ? "bg-amber-500 text-black border-amber-400 shadow-amber-500/40 scale-105"
                : "bg-[var(--surface-hi)] border border-[var(--border)] hover:border-amber-500/50 text-amber-400"
            }`}
          >
            <Volume2 className={`w-4 h-4 ${isBuzzerRinging ? "animate-bounce" : ""}`} />
            <span>Test Buzzer (Chime)</span>
          </button>
        </div>
      </div>

      {/* KDS Stage Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Queued</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-xl font-display font-black text-blue-400">{queuedTickets.length}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Cooking Now</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xl font-display font-black text-amber-400">{preparingTickets.length}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Ready for Handoff</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />
          </div>
          <p className="text-xl font-display font-black text-[#25d366]">{readyTickets.length}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Completed Today</span>
            <Archive className="w-3.5 h-3.5 text-[var(--gold)]" />
          </div>
          <p className="text-xl font-display font-black text-[var(--gold)]">{completedTickets.length}</p>
        </div>
      </div>

      {/* Stage Filter Tabs (Mobile Dropdown < 1024px, Desktop Pills >= 1024px) */}
      <div className="w-full">
        {/* Mobile & Tablet Dropdown Filter (< 1024px) */}
        <div className="lg:hidden w-full mb-3">
          <ResponsiveSelect
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
            options={[
              { id: "all_active", label: "All Active", count: queuedTickets.length + preparingTickets.length + readyTickets.length },
              { id: "queued", label: "Queued", count: queuedTickets.length },
              { id: "preparing", label: "Cooking", count: preparingTickets.length },
              { id: "ready", label: "Ready", count: readyTickets.length },
              { id: "completed", label: "Completed", count: completedTickets.length },
            ]}
          />
        </div>

        {/* Desktop Horizontal Pills (>= 1024px) */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] overflow-x-auto max-w-full scrollbar-none">
          {[
            { id: "all_active", label: `All Active (${queuedTickets.length + preparingTickets.length + readyTickets.length})` },
            { id: "queued", label: `Queued (${queuedTickets.length})` },
            { id: "preparing", label: `Cooking (${preparingTickets.length})` },
            { id: "ready", label: `Ready (${readyTickets.length})` },
            { id: "completed", label: `Completed (${completedTickets.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "btn-gold text-[#342c14] shadow-sm font-black"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KDS Ticket Cards Grid */}
      {filteredTickets.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-[var(--border)] space-y-3">
          <CheckCircle2 className="w-12 h-12 text-[#25d366] mx-auto opacity-70" />
          <p className="font-display font-bold text-base text-[var(--text-hi)]">Kitchen Queue is Clear!</p>
          <p className="text-xs font-mono text-[var(--text-faint)]">
            All orders in this stage have been prepared or dispatched.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {filteredTickets.map((ticket) => {
            const timing = getTicketTiming(ticket);
            const { isStale, elapsedMinutes: elapsedSincePlaced, elapsedText: elapsedSincePlacedText } = checkIsTicketStale(ticket, nowTime);
            const isCooking = ticket.status === "preparing";
            const isReady = ticket.status === "ready";
            const isCompleted = ticket.status === "completed" || ticket.status === "cancelled";
            const isOverdue = isCooking && timing.isOverdue;

            return (
              <div
                key={ticket.id}
                className={`glass-panel p-5 rounded-2xl border space-y-4 transition-all duration-300 relative group overflow-hidden flex flex-col justify-between shadow-xl ${
                  isStale
                    ? "bg-red-950/20 border-red-500/50 shadow-red-950/30 opacity-90"
                    : isCompleted
                    ? "opacity-60 border-[var(--border)] bg-[var(--surface-hi)]/30"
                    : isReady
                    ? "bg-[#25d366]/5 border-[#25d366]/50 hover:border-[#25d366]"
                    : isOverdue
                    ? "bg-red-500/10 border-red-500/50 shadow-red-500/20 hover:border-red-400"
                    : isCooking
                    ? "bg-amber-500/5 border-amber-500/40 hover:border-amber-400"
                    : "border-[var(--border)] hover:border-[var(--gold)]/40"
                }`}
              >
                {/* Stale Ticket Expiration Warning Banner */}
                {isStale && (
                  <div className="bg-red-500/25 border-b border-red-500/40 px-3 py-1.5 text-center text-[10.5px] font-mono font-black text-red-300 uppercase tracking-wider flex items-center justify-center gap-1.5 -mx-5 -mt-5 mb-3 shadow-inner">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse" />
                    <span>ORDER EXPIRED / STALE (Elapsed: &gt;{elapsedSincePlacedText || `${elapsedSincePlaced}m`})</span>
                  </div>
                )}

                {/* Progress bar line along top of cooking tickets */}
                {isCooking && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-black/40 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        isOverdue
                          ? "bg-gradient-to-r from-red-600 via-rose-500 to-red-400 animate-pulse w-full"
                          : "bg-gradient-to-r from-amber-500 via-[#e3b13b] to-emerald-400"
                      }`}
                      style={{ width: isOverdue ? "100%" : `${timing.progressPercent}%` }}
                    />
                  </div>
                )}

                <div className="space-y-2 pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-[var(--text-hi)] flex items-center gap-1.5">
                      {ticket.priority === "urgent" && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      )}
                      {ticket.id}
                    </span>

                    {/* Live Reverse Countdown Timer Badge / Stale Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold flex items-center gap-1.5 border transition-all ${
                        isStale
                          ? "bg-red-600/30 text-red-300 border-red-500/50 shadow-sm shadow-red-500/30 animate-pulse font-black"
                          : isCompleted
                          ? "bg-neutral-500/20 text-neutral-400 border-neutral-600/30"
                          : isReady
                          ? "bg-[#25d366]/20 text-[#25d366] border-[#25d366]/30 font-black"
                          : isOverdue
                          ? "bg-red-500/25 text-red-400 border-red-500/40 animate-pulse font-extrabold shadow-sm shadow-red-500/30"
                          : isCooking
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30 font-extrabold"
                          : "bg-blue-500/15 text-blue-300 border-blue-500/30"
                      }`}
                    >
                      {isStale ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          <span>VOID / STALE</span>
                        </>
                      ) : isReady ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />
                          <span>READY</span>
                        </>
                      ) : isCompleted ? (
                        <>
                          <Archive className="w-3.5 h-3.5" />
                          <span>DONE</span>
                        </>
                      ) : isOverdue ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                          <span>{timing.formattedTime}</span>
                        </>
                      ) : isCooking ? (
                        <>
                          <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          <span>{timing.formattedTime}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>{timing.formattedTime}</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[var(--gold)]">{ticket.tableOrChannel}</span>
                    <span className="text-[var(--text-faint)] text-[11px]">{ticket.serverName}</span>
                  </div>

                  {ticket.createdAt && (
                    <div className="text-[10px] font-mono text-[var(--text-faint)]">
                      Placed: {ticket.createdAt} {isStale ? `(${elapsedSincePlacedText || `${elapsedSincePlaced}m`} ago)` : ""}
                    </div>
                  )}
                </div>

                {/* Checklist of dishes */}
                <div className="space-y-2 flex-1">
                  {ticket.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[var(--surface-hi)]/70 border border-[var(--border)] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--text-hi)]">{it.name}</span>
                        {(() => {
                          const qty = Number(it.qty || (it as any).quantity || 1);
                          if (qty > 1) {
                            return (
                              <span className="font-mono font-black text-[var(--gold)] bg-[var(--gold-dim)] px-2 py-0.5 rounded-lg text-[11px]">
                                {qty}x
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      {it.notes && (
                        <p className="text-[10.5px] text-amber-400/90 font-mono italic flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>{it.notes}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Status Advance Action Button */}
                <div className="pt-2">
                  {isCompleted ? (
                    <button
                      type="button"
                      onClick={() => handleReopenTicket(ticket.id)}
                      className="w-full py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-open Ticket</span>
                    </button>
                  ) : isStale ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled={true}
                        title="Ticket expired (>60m unstarted). Contact Floor Manager to void or re-issue."
                        className="w-full py-2.5 rounded-xl font-bold text-xs cursor-not-allowed opacity-50 bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center justify-center gap-2"
                      >
                        <Flame className="w-4 h-4 text-neutral-500" />
                        <span>Start Cooking (Locked)</span>
                      </button>
                      <p className="text-[10px] text-red-400/90 font-mono text-center leading-tight">
                        Ticket expired (&gt;60m unstarted). Contact Floor Manager to void or re-issue.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAdvanceKds(ticket.id, "cancelled")}
                        className="w-full py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/30 font-mono font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Archive className="w-3.5 h-3.5 text-red-400" />
                        <span>Archive Stale Ticket</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTransition(ticket.id)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition-all ${
                        isReady
                          ? "bg-[#25d366] text-[#140c0c] font-black shadow-lg shadow-[#25d366]/20 hover:bg-[#20ba59]"
                          : ticket.status === "preparing"
                          ? "bg-amber-500 hover:bg-amber-400 text-black font-black shadow-md"
                          : "btn-gold animate-sheen"
                      }`}
                    >
                      {isReady ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Handed to Waiter / Rider</span>
                        </>
                      ) : ticket.status === "preparing" ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Mark Order Ready (Ding!)</span>
                        </>
                      ) : (
                        <>
                          <Flame className="w-4 h-4" />
                          <span>Start Cooking</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
