"use client";

import React from "react";
import { Lock, FileSpreadsheet, AlertOctagon, ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

interface ShiftClosureRequiredModalProps {
  isOpen: boolean;
  shiftShortName: string;
  shiftEndLabel: string;
  onProceedToZReport?: () => void;
  onViewOrdersHub?: () => void;
}

export default function ShiftClosureRequiredModal({
  isOpen,
  shiftShortName,
  shiftEndLabel,
  onProceedToZReport,
  onViewOrdersHub,
}: ShiftClosureRequiredModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleOpenZReport = () => {
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
      className="fixed inset-0 z-[9995] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
    >
      <div className="w-full max-w-md bg-white dark:bg-[var(--bg-deep)] border border-amber-500/35 dark:border-amber-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/20 dark:shadow-black/90 text-center space-y-5 relative overflow-hidden">
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 dark:bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#e04e17]/10 dark:bg-[#e04e17]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Lockout / Grace Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
          <FileSpreadsheet className="w-8 h-8 text-[var(--gold)]" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-sm">
            <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </div>

        {/* Header & Badges */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono text-[10.5px] font-bold uppercase tracking-wider">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Grace Period • Shift Reconciliation Required</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-black text-[var(--text-hi)] tracking-tight">
            Shift Ended — Settlement Required
          </h2>
        </div>

        {/* Informative Guidance Card */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[var(--surface-hi)]/80 border border-zinc-200 dark:border-[var(--border)] text-left space-y-2">
          <p className="text-xs sm:text-[13px] text-[var(--text-hi)] font-medium leading-relaxed">
            Your assigned shift window (<span className="text-[var(--gold)] font-bold">{shiftShortName}</span>) concluded at{" "}
            <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">{shiftEndLabel}</span>.
          </p>
          <p className="text-[11px] text-[var(--text-lo)] leading-relaxed">
            Taking new orders has been locked. The terminal is held in <strong className="text-[var(--text-hi)]">Reconciliation Mode</strong> so you can audit physical cash, count the drawer float, and generate your Z-Report.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleOpenZReport}
            className="w-full py-3.5 px-4 rounded-xl btn-gold font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-[#342c14]" />
            <span>Proceed to Z-Report &amp; Settle Shift</span>
            <ArrowRight className="w-4 h-4 text-[#342c14]" />
          </button>

          {onViewOrdersHub && (
            <button
              type="button"
              onClick={onViewOrdersHub}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[var(--surface)] dark:hover:bg-[var(--surface-hi)] border border-zinc-200 dark:border-[var(--border)] text-zinc-700 dark:text-[var(--text-lo)] hover:text-zinc-900 dark:hover:text-[var(--text-hi)] text-xs font-semibold transition-colors cursor-pointer"
            >
              Review Active Orders First
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
