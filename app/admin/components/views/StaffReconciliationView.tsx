"use client";

import React, { useMemo } from "react";
import {
  ArrowLeft,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Users,
  ShieldCheck,
} from "lucide-react";
import StaffShiftAuditTable, { ShiftRecordLike } from "../StaffShiftAuditTable";

interface StaffReconciliationViewProps {
  settlements: ShiftRecordLike[];
  currencySymbol?: string;
  onBack: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function StaffReconciliationView({
  settlements = [],
  currencySymbol = "Rs",
  onBack,
  onRefresh,
  isRefreshing = false,
}: StaffReconciliationViewProps) {
  // Aggregate high-level shift audit telemetry
  const stats = useMemo(() => {
    let total = settlements.length;
    let activeOpen = 0;
    let balanced = 0;
    let flagged = 0;
    let totalCollections = 0;

    settlements.forEach((s) => {
      const status = (s.status || "").toUpperCase();
      const variance = Number(s.cash_variance || s.variance || 0);
      const sales = Number(s.system_cash_sales || s.totalSales || s.total_sales || 0);

      totalCollections += sales;

      if (status === "OPEN") {
        activeOpen++;
      } else if (variance === 0) {
        balanced++;
      } else {
        flagged++;
      }
    });

    return {
      total,
      activeOpen,
      balanced,
      flagged,
      totalCollections,
    };
  }, [settlements]);

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200 select-none">
      {/* Navigation Breadcrumb / Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          id="back-to-staff-roster-btn"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer shadow-sm font-mono self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Staff Management</span>
        </button>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--gold)]/50 text-xs font-mono font-semibold text-[var(--text-hi)] transition-all cursor-pointer shadow-sm self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--gold)] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh Records"}</span>
          </button>
        )}
      </div>

      {/* Page Title Header */}
      <div className="border-b border-[var(--border)] pb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shadow-inner">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-black font-display tracking-tight text-[var(--text-hi)]">
              Staff Shift Audit Trail &amp;{" "}
              <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                Daily Reconciliation
              </span>
            </h1>
            <p className="text-xs font-mono text-[var(--text-lo)] mt-0.5">
              Consolidated daily staff shift windows, cash collections, duration tracking, and drawer balances
            </p>
          </div>
        </div>
      </div>

      {/* Shift Audit KPI Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Shifts Audited */}
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Total Shifts</span>
            <Users className="w-3.5 h-3.5 text-[var(--text-faint)]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-hi)]">
            {stats.total}
          </div>
          <div className="text-[10px] text-[var(--text-lo)] font-mono">
            Logged across all roles
          </div>
        </div>

        {/* Active / Open Shifts */}
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Active / Open</span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            {stats.activeOpen}
          </div>
          <div className="text-[10px] text-[var(--text-lo)] font-mono">
            Currently clocked-in
          </div>
        </div>

        {/* Balanced Shifts */}
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Reconciled</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#25d366]">
            {stats.balanced}
          </div>
          <div className="text-[10px] text-[var(--text-lo)] font-mono">
            Zero cash discrepancy
          </div>
        </div>

        {/* Discrepancies */}
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Flagged Variance</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className={`text-2xl font-bold font-mono ${stats.flagged > 0 ? "text-rose-400" : "text-[var(--text-lo)]"}`}>
            {stats.flagged}
          </div>
          <div className="text-[10px] text-[var(--text-lo)] font-mono">
            {stats.flagged > 0 ? "Over/short drawer counts" : "No flagged variances"}
          </div>
        </div>
      </div>

      {/* Main Reconciliation Table Panel */}
      <div className="glass-panel p-5 sm:p-7 rounded-2xl border border-[var(--border)] space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-hi)]">
                Audit Table &amp; Shift Breakdown
              </h3>
              <p className="text-[11px] font-mono text-[var(--text-lo)]">
                Filter by staff role, status, or search specific team members
              </p>
            </div>
          </div>
        </div>

        <StaffShiftAuditTable
          settlements={settlements}
          currencySymbol={currencySymbol}
          emptyMessage="No active or recorded shifts found for this restaurant."
        />
      </div>
    </div>
  );
}
