"use client";

import React, { useMemo } from "react";
import { Lock } from "lucide-react";

export interface ShiftRecordLike {
  id?: string | number | null;
  restaurant_id?: number | string | null;
  cashier_name?: string | null;
  shift_type?: string | null;
  opening_float?: number | string | null;
  system_cash_sales?: number | string | null;
  actual_cash_counted?: number | string | null;
  cash_variance?: number | string | null;
  status?: string | null;
  closing_notes?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  [key: string]: any;
}

export interface ConsolidatedDailyShift {
  id: string;
  dateKey: string;
  dateLabel: string;
  loginTime: string;
  logoutTime: string;
  shiftWindow: string;
  staffName: string;
  openingFloat: number;
  totalSales: number;
  expectedCash: number;
  actualCounted: number;
  variance: number;
  status: "OPEN" | "CLOSED" | "FLAGGED";
  timestamp: number;
  rawSegmentsCount: number;
}

interface StaffShiftAuditTableProps {
  settlements: ShiftRecordLike[];
  currencySymbol?: string;
  emptyMessage?: string;
}

export default function StaffShiftAuditTable({
  settlements = [],
  currencySymbol = "Rs",
  emptyMessage = "No shift settlements logged yet for this restaurant.",
}: StaffShiftAuditTableProps) {
  // Consolidate shift records by staff member and calendar date
  const consolidatedShifts = useMemo<ConsolidatedDailyShift[]>(() => {
    if (!settlements || settlements.length === 0) return [];

    const groups = new Map<string, ShiftRecordLike[]>();

    settlements.forEach((s) => {
      // Clean staff name: eliminate all "Segment #X", "Consecutive", etc.
      const cleanCashier = (s.cashier_name || "Cashier")
        .replace(/\s*\(?Segment\s*#?\d+\)?/gi, "")
        .replace(/\s*\(?Consecutive\)?/gi, "")
        .replace(/\s*•\s*Segment\s*#?\d+/gi, "")
        .trim() || "Cashier";

      const nameLower = cleanCashier.toLowerCase();
      const roleLower = String(s.cashier_role || s.role || "").toLowerCase().trim();
      // Admin bypass: Admin never has cashier shifts
      if (
        nameLower === "admin" ||
        roleLower === "admin" ||
        nameLower.startsWith("admin ") ||
        nameLower.endsWith(" admin") ||
        s.id === "admin-pos-session"
      ) {
        return;
      }

      const startRaw = s.shift_start || s.created_at;
      const startDate = startRaw ? new Date(startRaw) : new Date();
      const dateKey = !isNaN(startDate.getTime())
        ? startDate.toISOString().slice(0, 10)
        : "unknown-date";

      const key = `${cleanCashier.toLowerCase()}__${dateKey}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(s);
    });

    const result: ConsolidatedDailyShift[] = [];

    groups.forEach((groupRecords, key) => {
      // Sort chronologically (oldest first)
      const sorted = [...groupRecords].sort((a, b) => {
        const timeA = new Date(a.shift_start || a.created_at || 0).getTime();
        const timeB = new Date(b.shift_start || b.created_at || 0).getTime();
        return timeA - timeB;
      });

      const firstRecord = sorted[0];
      const lastRecord = sorted[sorted.length - 1];

      const cleanCashier = (firstRecord.cashier_name || "Cashier")
        .replace(/\s*\(?Segment\s*#?\d+\)?/gi, "")
        .replace(/\s*\(?Consecutive\)?/gi, "")
        .replace(/\s*•\s*Segment\s*#?\d+/gi, "")
        .trim() || "Cashier";

      const earliestStartTime = new Date(firstRecord.shift_start || firstRecord.created_at || Date.now());
      const hasOpenShift = sorted.some(
        (r) =>
          r.status === "OPEN" ||
          r.status === "active" ||
          (!r.status && !r.shift_end && !r.closed_at)
      );

      const latestEndTime = !hasOpenShift
        ? new Date(lastRecord.shift_end || lastRecord.closed_at || lastRecord.created_at || Date.now())
        : null;

      const dateLabel = !isNaN(earliestStartTime.getTime())
        ? earliestStartTime.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        : "Recent Date";

      const loginTime = !isNaN(earliestStartTime.getTime())
        ? earliestStartTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        : "Start";

      const logoutTime = hasOpenShift
        ? "Active"
        : latestEndTime && !isNaN(latestEndTime.getTime())
          ? latestEndTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          : "Closed";

      const shiftWindow = `${dateLabel} | ${loginTime} - ${logoutTime}`;

      // Opening float of the initial shift session
      const openingFloat = Number(firstRecord.opening_float) || 0;

      // Total sales generated during the daily session
      const totalSales = sorted.reduce(
        (sum, r) => sum + (Number(r.system_cash_sales) || 0),
        0
      );

      // Expected cash = Opening Float + Total Sales
      const expectedCash = openingFloat + totalSales;

      // Actual cash counted at Z-Report settlement
      const actualCounted = Number(lastRecord.actual_cash_counted) || 0;

      // Variance = Difference (+/-)
      const variance = hasOpenShift ? 0 : actualCounted - expectedCash;

      let status: "OPEN" | "CLOSED" | "FLAGGED" = "CLOSED";
      if (hasOpenShift) {
        status = "OPEN";
      } else if (
        lastRecord.status === "FLAGGED" ||
        Math.abs(variance) > 500
      ) {
        status = "FLAGGED";
      }

      result.push({
        id: String(firstRecord.id || key),
        dateKey: !isNaN(earliestStartTime.getTime()) ? earliestStartTime.toISOString().slice(0, 10) : key,
        dateLabel,
        loginTime,
        logoutTime,
        shiftWindow,
        staffName: cleanCashier,
        openingFloat,
        totalSales,
        expectedCash,
        actualCounted,
        variance,
        status,
        timestamp: earliestStartTime.getTime(),
        rawSegmentsCount: sorted.length,
      });
    });

    // Return newest shifts first
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [settlements]);

  if (consolidatedShifts.length === 0) {
    return (
      <div className="py-8 text-center text-xs font-mono text-[var(--text-faint)] space-y-2">
        <Lock className="w-6 h-6 mx-auto opacity-40 text-[var(--gold)]" />
        <p>{emptyMessage}</p>
        <p className="text-[10px]">
          Close a cashier register from POS to record the first Z-report.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto select-none">
      <table className="w-full text-left font-mono text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10.5px] uppercase tracking-wider text-[var(--text-faint)]">
            <th className="py-2.5 px-3">Date &amp; Shift Window</th>
            <th className="py-2.5 px-3">Staff Name</th>
            <th className="py-2.5 px-3 text-right">Opening Float</th>
            <th className="py-2.5 px-3 text-right">Total Sales</th>
            <th className="py-2.5 px-3 text-right">Expected Cash</th>
            <th className="py-2.5 px-3 text-right">Actual Counted</th>
            <th className="py-2.5 px-3 text-right">Variance</th>
            <th className="py-2.5 px-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]/40">
          {consolidatedShifts.map((shift, idx) => {
            const isBalanced = shift.variance === 0;
            const isSurplus = shift.variance > 0;
            const isSameAsPrevDate = idx > 0 && shift.dateLabel === consolidatedShifts[idx - 1].dateLabel;

            return (
              <tr
                key={shift.id || idx}
                className="hover:bg-white/[0.02] transition-colors"
              >
                {/* 1. Date & Shift Window */}
                <td className="py-3 px-3 font-semibold text-[var(--text-hi)] whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={
                        isSameAsPrevDate
                          ? "text-[var(--text-faint)] font-normal"
                          : "text-[var(--text-hi)] font-semibold"
                      }
                    >
                      {shift.dateLabel}
                    </span>
                    <span className="text-[var(--text-faint)]">|</span>
                    <span className="text-amber-400 font-mono font-medium">
                      {shift.loginTime} – {shift.logoutTime}
                    </span>
                  </div>
                </td>

                {/* 2. Staff / Cashier Name (Clean plain text name, no segment tags) */}
                <td className="py-3 px-3 text-[var(--text-lo)] font-sans font-medium whitespace-nowrap">
                  {shift.staffName}
                </td>

                {/* 3. Opening Float */}
                <td className="py-3 px-3 text-right text-[var(--text-lo)] font-mono whitespace-nowrap">
                  {currencySymbol} {shift.openingFloat.toLocaleString()}
                </td>

                {/* 4. Total Sales */}
                <td className="py-3 px-3 text-right text-[#25d366] font-bold font-mono whitespace-nowrap">
                  {currencySymbol} {shift.totalSales.toLocaleString()}
                </td>

                {/* 5. Closing / Expected Cash */}
                <td className="py-3 px-3 text-right text-[var(--gold)] font-bold font-mono whitespace-nowrap">
                  {currencySymbol} {shift.expectedCash.toLocaleString()}
                </td>

                {/* 6. Actual Counted */}
                <td className="py-3 px-3 text-right text-[var(--text-hi)] font-black font-mono whitespace-nowrap">
                  {currencySymbol} {shift.actualCounted.toLocaleString()}
                </td>

                {/* 7. Variance (+/-) */}
                <td
                  className={`py-3 px-3 text-right font-bold font-mono whitespace-nowrap ${shift.status === "OPEN"
                      ? "text-[var(--text-faint)]"
                      : isBalanced
                        ? "text-[#25d366]"
                        : isSurplus
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                >
                  {shift.status === "OPEN"
                    ? "—"
                    : `${shift.variance >= 0 ? "+" : ""}${currencySymbol} ${shift.variance.toLocaleString()}`}
                </td>

                {/* 8. Status Badge */}
                <td className="py-3 px-3 text-center whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${shift.status === "OPEN"
                        ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        : shift.status === "FLAGGED"
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                      }`}
                  >
                    {shift.status === "OPEN" && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping mr-1" />
                    )}
                    {shift.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
