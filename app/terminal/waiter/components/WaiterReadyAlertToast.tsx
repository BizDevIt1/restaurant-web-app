"use client";

import React, { useState, useEffect } from "react";
import { Bell, CheckCircle2, Clock, X, ChefHat, Loader2 } from "lucide-react";
import { formatSmartDuration } from "@/utils/timeFormatters";

export interface WaiterReadyAlert {
  ticketId: string;
  tableOrChannel: string;
  items: Array<{
    name: string;
    qty: number;
    notes?: string;
    variant_name?: string | null;
  }>;
  readyAt: string;
  priority?: string;
}

interface WaiterReadyAlertToastProps {
  alerts: WaiterReadyAlert[];
  onPickUp: (ticketId: string) => Promise<void> | void;
  onDismiss: (ticketId: string) => void;
}

export default function WaiterReadyAlertToast({
  alerts,
  onPickUp,
  onDismiss,
}: WaiterReadyAlertToastProps) {
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!alerts || alerts.length === 0) return null;

  const handlePickUp = async (ticketId: string) => {
    if (submittingIds.has(ticketId)) return;
    setSubmittingIds((prev) => new Set(prev).add(ticketId));
    try {
      await onPickUp(ticketId);
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  };

  return (
    <div
      className="fixed top-20 right-4 z-[100] flex flex-col gap-3 max-w-md w-[calc(100vw-2rem)] pointer-events-none select-none"
      role="region"
      aria-label="Order Ready Notifications"
    >
      {alerts.map((alert) => {
        const isSubmitting = submittingIds.has(alert.ticketId);
        const isRush =
          (alert.priority || "").toLowerCase() === "rush" ||
          (alert.priority || "").toLowerCase() === "urgent";

        const readyTimeMs = new Date(alert.readyAt).getTime();
        const elapsedSec = Math.max(0, Math.floor((nowMs - readyTimeMs) / 1000));
        const isOverdue = elapsedSec >= 300; // 5+ minutes

        return (
          <div
            key={alert.ticketId}
            className={`pointer-events-auto rounded-2xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.95)] border-2 transition-all duration-300 animate-in slide-in-from-top-4 fade-in ${
              isOverdue
                ? "bg-[#1f0d0d] border-red-500 ring-2 ring-red-500/40 text-red-50 shadow-red-950/60"
                : isRush
                ? "bg-[#22140a] border-amber-500 ring-2 ring-amber-500/40 text-amber-50 shadow-amber-950/60"
                : "bg-[#16120e] border-[#e5a93b]/85 ring-2 ring-[#e5a93b]/25 text-neutral-100 shadow-black/90"
            }`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    isOverdue
                      ? "bg-red-500/25 border border-red-500/50 text-red-400 animate-bounce"
                      : isRush
                      ? "bg-amber-500/25 border border-amber-500/50 text-amber-400 animate-pulse"
                      : "bg-[#e5a93b]/20 border border-[#e5a93b]/40 text-[#f5c358] animate-pulse"
                  }`}
                >
                  <Bell className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-white uppercase tracking-wider truncate">
                      ORDER #{alert.ticketId} READY
                    </span>
                    {isRush && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-red-500/30 text-red-300 border border-red-500/60 uppercase shadow-xs">
                        RUSH
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-black text-[#f5c358] truncate flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm">📍</span>
                    <span>
                      {alert.tableOrChannel?.toUpperCase().includes("TABLE")
                        ? alert.tableOrChannel
                        : `Table ${alert.tableOrChannel || "Counter"}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Elapsed Wait Badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold shadow-sm ${
                    isOverdue
                      ? "bg-red-600 text-white animate-pulse border border-red-400"
                      : "bg-[#251e18] text-[#f5c358] border border-[#e5a93b]/30"
                  }`}
                  title={`Ready at ${new Date(alert.readyAt).toLocaleTimeString()}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatSmartDuration(elapsedSec)}</span>
                </span>

                <button
                  type="button"
                  onClick={() => onDismiss(alert.ticketId)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white cursor-pointer transition-colors border border-white/10"
                  title="Dismiss notification"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Overdue Warning Callout (if >= 5 minutes) */}
            {isOverdue && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-red-950/90 border border-red-500/70 text-xs font-bold text-red-200 flex items-center gap-2 shadow-sm">
                <span className="animate-ping w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <span>⚠️ Order waiting 5+ min for pickup! Food getting cold.</span>
              </div>
            )}

            {/* Items list */}
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
              {alert.items && alert.items.length > 0 ? (
                alert.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between text-xs py-1.5 px-2.5 rounded-lg bg-black/35 border border-white/5"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[#f5c358] font-mono text-xs px-1.5 py-0.5 rounded bg-[#e5a93b]/15 border border-[#e5a93b]/30 shrink-0">
                          {it.qty}x
                        </span>
                        <span className="font-bold text-white text-xs truncate">
                          {it.name}
                        </span>
                      </div>
                      {it.variant_name && (
                        <span className="text-[11px] text-amber-200/80 font-mono block mt-0.5 ml-8">
                          ({it.variant_name})
                        </span>
                      )}
                      {it.notes && (
                        <span className="text-[11px] italic text-amber-300 block mt-0.5 ml-8 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          ↳ Note: {it.notes}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs font-semibold text-amber-200/90 bg-[#e5a93b]/10 border border-[#e5a93b]/25 px-3 py-2.5 rounded-xl flex items-center gap-2.5 shadow-inner">
                  <ChefHat className="w-4 h-4 text-[#f5c358] shrink-0" />
                  <span>Complete order package ready at kitchen pass</span>
                </div>
              )}
            </div>

            {/* Action Button: [Mark Picked Up] */}
            <div className="mt-3.5 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handlePickUp(alert.ticketId)}
                className="w-full py-3 px-4 rounded-xl font-black font-mono text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:brightness-110 text-white shadow-lg shadow-emerald-950/60 border border-emerald-400/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Updating Pickup Status...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[3] text-white" />
                    <span>Mark Picked Up</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
