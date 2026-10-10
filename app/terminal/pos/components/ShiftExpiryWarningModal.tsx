"use client";

import React from "react";
import { AlertTriangle, Clock, ArrowRight, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

interface ShiftExpiryWarningModalProps {
  isOpen: boolean;
  minutesRemaining: number;
  shiftShortName: string;
  shiftEndLabel: string;
  onDismiss: () => void;
  onProceedToZReport?: () => void;
}

export default function ShiftExpiryWarningModal({
  isOpen,
  minutesRemaining,
  shiftShortName,
  shiftEndLabel,
  onDismiss,
  onProceedToZReport,
}: ShiftExpiryWarningModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleGoToZReport = () => {
    onDismiss();
    if (onProceedToZReport) {
      onProceedToZReport();
    } else {
      router.push("/terminal/pos/z-report");
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
    >
      <div className="w-full max-w-md bg-white dark:bg-[var(--bg-deep)] border border-amber-500/30 dark:border-amber-500/50 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/20 dark:shadow-black/80 text-center space-y-5 relative overflow-hidden">
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#e04e17]/10 dark:bg-[#e04e17]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Warning Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
          <Clock className="w-8 h-8 animate-pulse" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-mono font-black text-[10px]">
            !
          </div>
        </div>

        {/* Header & Badges */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10.5px] font-bold uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Shift Ending Soon • {minutesRemaining} Mins Left</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-black text-[var(--text-hi)] tracking-tight">
            Shift Expiry Warning
          </h2>
        </div>

        {/* Description Card */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[var(--surface-hi)]/70 border border-zinc-200 dark:border-[var(--border)] text-left space-y-2">
          <p className="text-xs sm:text-[13px] text-[var(--text-hi)] font-medium leading-relaxed">
            Your assigned shift (<span className="text-[var(--gold)] font-bold">{shiftShortName}</span>) ends at{" "}
            <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">{shiftEndLabel}</span>.
          </p>
          <p className="text-[11px] text-[var(--text-lo)] leading-relaxed">
            Please wrap up pending orders and open <strong className="text-[var(--text-hi)]">Close Shift (Z-Report)</strong> to reconcile physical cash drawer totals before your shift concludes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={handleGoToZReport}
            className="w-full py-3.5 px-4 rounded-xl btn-gold font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer transition-all"
          >
            <span>Open Close Shift (Z-Report)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[var(--surface)] dark:hover:bg-[var(--surface-hi)] border border-zinc-200 dark:border-[var(--border)] text-zinc-700 dark:text-[var(--text-lo)] hover:text-zinc-900 dark:hover:text-[var(--text-hi)] text-xs font-semibold transition-colors cursor-pointer"
          >
            Acknowledge &amp; Continue (Remind in 3 Mins)
          </button>
        </div>
      </div>
    </div>
  );
}
