"use client";

import React from "react";
import { Clock, RotateCcw, FileSpreadsheet, ArrowRight, ShieldCheck, Sparkles, X, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { isShiftSnoozeAllowed, getMinutesSinceShiftEnd } from "@/lib/shiftSchedule";

interface ShiftContinuationModalProps {
  isOpen: boolean;
  shiftShortName: string;
  shiftEndLabel: string;
  nextShiftName?: string;
  cashierName?: string;
  consecutiveShiftCount?: number;
  onStartNewShift: () => void;
  onProceedToZReport?: () => void;
  onEndShiftLogout?: () => void;
  onDismiss: () => void;
}

export default function ShiftContinuationModal({
  isOpen,
  shiftShortName,
  shiftEndLabel,
  nextShiftName = "Next Shift",
  cashierName = "Cashier",
  consecutiveShiftCount = 1,
  onStartNewShift,
  onProceedToZReport,
  onEndShiftLogout,
  onDismiss,
}: ShiftContinuationModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const isSnoozeAllowed = isShiftSnoozeAllowed(shiftShortName);
  const minutesSinceEnd = getMinutesSinceShiftEnd(shiftShortName);

  const handleOpenZReport = () => {
    if (onProceedToZReport) {
      onProceedToZReport();
    } else {
      router.push("/terminal/pos/z-report");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-continuation-title"
      className="fixed inset-0 z-[9990] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 select-none"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[var(--bg-deep)] border border-amber-500/35 dark:border-amber-500/50 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/20 dark:shadow-black/90 space-y-5 relative overflow-hidden">
        {/* Glow ambient accents */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[var(--gold)]/10 dark:bg-[var(--gold)]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close / Remind Later button in top right — strictly active if within 60 minutes */}
        {isSnoozeAllowed && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-[var(--surface-hi)] dark:hover:bg-[var(--surface-hi)]/80 text-zinc-600 dark:text-[var(--text-lo)] hover:text-zinc-900 dark:hover:text-[var(--text-hi)] border border-zinc-200 dark:border-[var(--border)] transition-colors cursor-pointer"
            title="Remind me later"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header Icon & Status Badge */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
            <Clock className="w-7 h-7 text-[var(--gold)]" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider">
            <span>Shift Window Expired • Action Required</span>
          </div>

          <h2
            id="shift-continuation-title"
            className="text-xl sm:text-2xl font-display font-black text-[var(--text-hi)] tracking-tight"
          >
            Shift Ended
          </h2>
          <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-200/90 font-mono font-medium max-w-sm">
            Your shift has ended. Please close your shift (Z-Report) and logout, or start a new shift.
          </p>
        </div>

        {/* Detailed Info Card */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[var(--surface-hi)]/90 border border-zinc-200 dark:border-[var(--border)] space-y-3">
          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="p-2.5 rounded-xl bg-white dark:bg-[var(--bg)] border border-zinc-200/80 dark:border-[var(--border)] space-y-0.5">
              <span className="text-[9.5px] font-mono uppercase text-[var(--text-muted)] block">
                Cashier
              </span>
              <p className="text-xs font-bold text-[var(--text-hi)] truncate">{cashierName}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-[var(--bg)] border border-zinc-200/80 dark:border-[var(--border)] space-y-0.5">
              <span className="text-[9.5px] font-mono uppercase text-[var(--text-muted)] block">
                Concluded Window
              </span>
              <p className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 truncate">
                {shiftShortName} ({shiftEndLabel})
              </p>
            </div>
          </div>

          {consecutiveShiftCount > 1 && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                Multi-shift active: You are currently on consecutive shift segment #{consecutiveShiftCount}.
              </span>
            </div>
          )}

          <p className="text-[11.5px] text-[var(--text-lo)] leading-relaxed">
            Please select an option below: Close your shift to reconcile cash drawer and return to the login screen, or start a consecutive shift directly to continue operating.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* Option A: Close Shift & Logout (Z-Report) */}
          <button
            type="button"
            onClick={handleOpenZReport}
            className="w-full py-3.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 border border-amber-500/40 dark:border-amber-500/50 text-amber-800 hover:text-amber-950 dark:text-amber-200 dark:hover:text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Close Shift &amp; Logout (Z-Report)</span>
          </button>

          {/* Option B: Start New Shift / Cover */}
          <button
            type="button"
            onClick={onStartNewShift}
            className="w-full py-3.5 px-4 rounded-xl btn-gold font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] cursor-pointer transition-all"
          >
            <RotateCcw className="w-4 h-4 text-[#342c14] stroke-[2.5]" />
            <span>Start New Shift / Cover ({nextShiftName})</span>
            <ArrowRight className="w-4 h-4 text-[#342c14]" />
          </button>

          {/* Remind Me Later (15 min) — strictly visible within 60 minutes */}
          {isSnoozeAllowed ? (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] text-xs font-mono font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>Remind Me Later (15 min)</span>
            </button>
          ) : (
            <div className="py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center text-[10.5px] font-mono">
              Snooze expired ({minutesSinceEnd}m past scheduled end). Action required.
            </div>
          )}

          {/* End Shift & Logout — direct logout without Z-Report */}
          {onEndShiftLogout && (
            <button
              type="button"
              onClick={onEndShiftLogout}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--surface)] hover:bg-rose-500/10 border border-[var(--border)] hover:border-rose-500/30 text-[var(--text-lo)] hover:text-rose-400 text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>End Shift &amp; Logout</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
