"use client";

import React, { useState, useMemo } from "react";
import {
  Lock,
  Search,
  UtensilsCrossed,
  Flame,
  Receipt,
  ShieldCheck,
  X,
} from "lucide-react";
import { extractRoleFromShiftRecord, StaffRoleType } from "@/lib/universalShiftLogging";
import ResponsiveSelect from "./ResponsiveSelect";

export interface ShiftRecordLike {
  id?: string | number | null;
  restaurant_id?: number | string | null;
  cashier_name?: string | null;
  cashier_role?: string | null;
  role?: string | null;
  staff_role?: string | null;
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
  terminal_label?: string | null;
  [key: string]: any;
}

export interface ConsolidatedDailyShift {
  id: string;
  dateKey: string;
  dateLabel: string;
  loginTime: string;
  logoutTime: string;
  shiftWindow: string;
  durationLabel: string;
  staffName: string;
  role: StaffRoleType;
  station: string;
  openingFloat: number;
  totalSales: number;
  expectedCash: number;
  actualCounted: number;
  variance: number;
  status: "OPEN" | "CLOSED" | "FLAGGED";
  timestamp: number;
  rawSegmentsCount: number;
  closingNotes?: string;
}

interface StaffShiftAuditTableProps {
  settlements: ShiftRecordLike[];
  currencySymbol?: string;
  emptyMessage?: string;
}

export default function StaffShiftAuditTable({
  settlements = [],
  currencySymbol = "Rs",
  emptyMessage = "No active or recorded shifts found for this restaurant.",
}: StaffShiftAuditTableProps) {
  // Filter states
  const [selectedRole, setSelectedRole] = useState<"all" | StaffRoleType>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Consolidate shift records by staff member, role, and calendar date
  const consolidatedShifts = useMemo<ConsolidatedDailyShift[]>(() => {
    if (!settlements || settlements.length === 0) return [];

    const groups = new Map<string, { role: StaffRoleType; records: ShiftRecordLike[] }>();

    settlements.forEach((s) => {
      // Clean staff name: eliminate all "Segment #X", "Consecutive", etc.
      let cleanStaffName = (s.cashier_name || s.staff_name || "Staff Member")
        .replace(/\s*\(?Segment\s*#?\d+\)?/gi, "")
        .replace(/\s*\(?Consecutive\)?/gi, "")
        .replace(/\s*•\s*Segment\s*#?\d+/gi, "")
        .trim() || "Staff Member";

      if (cleanStaffName.toLowerCase() === "waiter") {
        cleanStaffName = "Waiter";
      }

      const nameLower = cleanStaffName.toLowerCase();

      // Skip hardcoded developer admin dummy sessions if present
      if (
        nameLower === "developer admin" ||
        s.id === "admin-pos-session"
      ) {
        return;
      }

      // Extract role dynamically
      const role = extractRoleFromShiftRecord(s);

      const startRaw = s.shift_start || s.created_at;
      const startDate = startRaw ? new Date(startRaw) : new Date();
      const dateKey = !isNaN(startDate.getTime())
        ? startDate.toISOString().slice(0, 10)
        : "unknown-date";

      // Group by staff name + role + date so different roles and shifts are strictly isolated
      const groupKey = `${cleanStaffName.toLowerCase()}__${role}__${dateKey}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { role, records: [] });
      }
      groups.get(groupKey)!.records.push(s);
    });

    const result: ConsolidatedDailyShift[] = [];

    groups.forEach(({ role, records }, key) => {
      // Sort chronologically (oldest first)
      const sorted = [...records].sort((a, b) => {
        const timeA = new Date(a.shift_start || a.created_at || 0).getTime();
        const timeB = new Date(b.shift_start || b.created_at || 0).getTime();
        return timeA - timeB;
      });

      const firstRecord = sorted[0];
      const lastRecord = sorted[sorted.length - 1];

      let cleanStaffName = (firstRecord.cashier_name || firstRecord.staff_name || "Staff Member")
        .replace(/\s*\(?Segment\s*#?\d+\)?/gi, "")
        .replace(/\s*\(?Consecutive\)?/gi, "")
        .replace(/\s*•\s*Segment\s*#?\d+/gi, "")
        .trim() || "Staff Member";

      if (cleanStaffName.toLowerCase() === "waiter") {
        cleanStaffName = "Floor Server";
      }

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

      // Real localized calendar date label (never dummy or faded)
      const dateLabel = !isNaN(earliestStartTime.getTime())
        ? earliestStartTime.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

      const loginTime = !isNaN(earliestStartTime.getTime())
        ? earliestStartTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "Start";

      // If open shift is from a previous calendar day, flag as Unclosed rather than active now
      const isShiftToday =
        !isNaN(earliestStartTime.getTime()) &&
        earliestStartTime.toDateString() === new Date().toDateString();

      const logoutTime = hasOpenShift
        ? (isShiftToday ? "Active Now" : "Unclosed")
        : latestEndTime && !isNaN(latestEndTime.getTime())
        ? latestEndTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "Closed";

      const shiftWindow = `${dateLabel} | ${loginTime} - ${logoutTime}`;

      // Calculate shift duration
      let durationLabel = "Active Session";
      if (!hasOpenShift && latestEndTime && !isNaN(earliestStartTime.getTime()) && !isNaN(latestEndTime.getTime())) {
        const diffMs = Math.max(0, latestEndTime.getTime() - earliestStartTime.getTime());
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        durationLabel = `${hours}h ${minutes}m`;
      } else if (hasOpenShift && !isNaN(earliestStartTime.getTime())) {
        const diffMs = Math.max(0, Date.now() - earliestStartTime.getTime());
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        durationLabel = `${hours}h ${minutes}m (Live)`;
      }

      // Station inference (retained for data model)
      let station = firstRecord.terminal_label || firstRecord.counter_name || "";
      if (!station) {
        if (role === "waiter") station = "Floor Waiter Station";
        else if (role === "chef") station = "Kitchen KDS Line";
        else if (role === "manager") station = "Manager Station";
        else station = "POS Billing Counter";
      }

      // Financial figures for cashier roles
      const openingFloat = Number(firstRecord.opening_float) || 0;
      const totalSales = sorted.reduce(
        (sum, r) => sum + (Number(r.system_cash_sales ?? r.gross_sales) || 0),
        0
      );
      const expectedCash = openingFloat + totalSales;
      const actualCounted = Number(lastRecord.actual_cash_counted) || 0;
      const variance = hasOpenShift ? 0 : actualCounted - expectedCash;

      let status: "OPEN" | "CLOSED" | "FLAGGED" = "CLOSED";
      if (hasOpenShift) {
        status = "OPEN";
      } else if (
        lastRecord.status === "FLAGGED" ||
        (role === "cashier" && Math.abs(variance) > 500)
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
        durationLabel,
        staffName: cleanStaffName,
        role,
        station,
        openingFloat,
        totalSales,
        expectedCash,
        actualCounted,
        variance,
        status,
        timestamp: earliestStartTime.getTime(),
        rawSegmentsCount: sorted.length,
        closingNotes: (lastRecord.closing_notes || firstRecord.closing_notes) ?? undefined,
      });
    });

    // Return newest shifts first
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [settlements]);

  // Counts by role
  const roleCounts = useMemo(() => {
    return {
      all: consolidatedShifts.length,
      cashier: consolidatedShifts.filter((s) => s.role === "cashier").length,
      waiter: consolidatedShifts.filter((s) => s.role === "waiter").length,
      chef: consolidatedShifts.filter((s) => s.role === "chef").length,
      manager: consolidatedShifts.filter((s) => s.role === "manager").length,
    };
  }, [consolidatedShifts]);

  // Filtered shifts based on active role, status, and search query
  const filteredShifts = useMemo(() => {
    return consolidatedShifts.filter((s) => {
      if (selectedRole !== "all" && s.role !== selectedRole) {
        return false;
      }
      if (selectedStatus !== "all" && s.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = s.staffName.toLowerCase().includes(query);
        const matchesDate = s.dateLabel.toLowerCase().includes(query);
        const matchesWindow = s.shiftWindow.toLowerCase().includes(query);
        if (!matchesName && !matchesDate && !matchesWindow) {
          return false;
        }
      }
      return true;
    });
  }, [consolidatedShifts, selectedRole, selectedStatus, searchQuery]);

  // Determine if financial columns should be omitted (Waiters & Chefs)
  const isNonFinancialView = selectedRole === "waiter" || selectedRole === "chef";

  // Helper for rendering role text matching dashboard color scheme
  const renderRoleBadge = (role: StaffRoleType) => {
    switch (role) {
      case "waiter":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--gold)]">
            <UtensilsCrossed className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
            <span>Waiter</span>
          </span>
        );
      case "chef":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Chef</span>
          </span>
        );
      case "manager":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Manager</span>
          </span>
        );
      case "cashier":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#25d366]">
            <Receipt className="w-3.5 h-3.5 text-[#25d366] shrink-0" />
            <span>Cashier</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* ========================================================================= */}
      {/* AUDIT FILTER TOOLBAR: Role Tabs, Status Filter & Search                   */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* AUDIT FILTER TOOLBAR: Line 1 (Role Tabs) & Line 2 (Status & Search)       */}
      {/* ========================================================================= */}
      <div className="space-y-3 pb-3 border-b border-[var(--border)]">
        {/* LINE 1: Role Filter Tabs (Mobile & Tablet Dropdown < 1024px, Desktop Pills >= 1024px) */}
        <div className="w-full">
          {/* Mobile & Tablet Dropdown (< 1024px) when tabs > 3 */}
          <div className="lg:hidden w-full">
            <ResponsiveSelect
              value={selectedRole}
              onChange={(val) => setSelectedRole(val as any)}
              buttonClassName="h-10 text-xs font-mono font-bold text-[var(--text-hi)]"
              menuClassName="w-full"
              labelPrefix="Role:"
              options={[
                { id: "all", label: "All Staff", count: roleCounts.all },
                {
                  id: "cashier",
                  label: "Cashiers",
                  count: roleCounts.cashier,
                  icon: <Receipt className="w-3.5 h-3.5 text-[#25d366]" />,
                },
                {
                  id: "waiter",
                  label: "Waiters",
                  count: roleCounts.waiter,
                  icon: <UtensilsCrossed className="w-3.5 h-3.5 text-[var(--gold)]" />,
                },
                {
                  id: "chef",
                  label: "Chefs",
                  count: roleCounts.chef,
                  icon: <Flame className="w-3.5 h-3.5 text-amber-400" />,
                },
                {
                  id: "manager",
                  label: "Managers",
                  count: roleCounts.manager,
                  icon: <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />,
                },
              ]}
            />
          </div>

          {/* Desktop Horizontal Tabs / Pills (>= 1024px) */}
          <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] overflow-x-auto max-w-full scrollbar-none">
            <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase tracking-wider px-2">
              Role:
            </span>

            <button
              type="button"
              onClick={() => setSelectedRole("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedRole === "all"
                  ? "bg-[var(--gold)] text-[#140c0c] font-black shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)] bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)]"
              }`}
            >
              <span>All Staff</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedRole === "all" ? "bg-black/20 text-[#140c0c] font-black" : "bg-[var(--surface)] text-[var(--text-lo)]"
                }`}
              >
                {roleCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole("cashier")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedRole === "cashier"
                  ? "bg-[#25d366] text-[#140c0c] font-black shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[#25d366] bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)]"
              }`}
            >
              <Receipt className="w-3 h-3" />
              <span>Cashiers</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedRole === "cashier" ? "bg-black/20 text-[#140c0c] font-black" : "bg-[var(--surface)] text-[var(--text-lo)]"
                }`}
              >
                {roleCounts.cashier}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole("waiter")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedRole === "waiter"
                  ? "bg-[var(--gold)] text-[#140c0c] font-black shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)]"
              }`}
            >
              <UtensilsCrossed className="w-3 h-3" />
              <span>Waiters</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedRole === "waiter" ? "bg-black/20 text-[#140c0c] font-black" : "bg-[var(--surface)] text-[var(--text-lo)]"
                }`}
              >
                {roleCounts.waiter}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole("chef")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedRole === "chef"
                  ? "bg-amber-500 text-[#140c0c] font-black shadow-sm"
                  : "text-[var(--text-lo)] hover:text-amber-400 bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)]"
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>Chefs</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedRole === "chef" ? "bg-black/20 text-[#140c0c] font-black" : "bg-[var(--surface)] text-[var(--text-lo)]"
                }`}
              >
                {roleCounts.chef}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole("manager")}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedRole === "manager"
                  ? "bg-blue-500 text-white font-black shadow-sm"
                  : "text-[var(--text-lo)] hover:text-blue-400 bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)]"
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Managers</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedRole === "manager" ? "bg-black/20 text-white font-black" : "bg-[var(--surface)] text-[var(--text-lo)]"
                }`}
              >
                {roleCounts.manager}
              </span>
            </button>
          </div>
        </div>

        {/* LINE 2: Status Dropdown & Live Search in a Single Horizontal Row */}
        <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
          {/* Status Filter Dropdown */}
          <div className="relative w-[44%] sm:w-56 shrink-0">
            <ResponsiveSelect
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
              menuClassName="w-56"
              labelPrefix="Status:"
              options={[
                { id: "all", label: "All Statuses" },
                { id: "OPEN", label: "Active / Open" },
                { id: "CLOSED", label: "Closed Shift" },
                { id: "FLAGGED", label: "Flagged Shift" },
              ]}
            />
          </div>

          {/* Quick Search matching StaffView search input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff by name, date or window..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-8 py-2.5 h-10 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SHIFT AUDIT TABLE (Seamless Integration - Station Column Removed)        */}
      {/* ========================================================================= */}
      {filteredShifts.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-[var(--text-faint)] space-y-2 border border-dashed border-[var(--border)] rounded-2xl">
          <Lock className="w-6 h-6 mx-auto opacity-40 text-[var(--gold)]" />
          <p>{emptyMessage}</p>
          <p className="text-[10px]">
            {consolidatedShifts.length === 0
              ? "Shifts will populate dynamically as authenticated staff start, operate, or close shifts."
              : `No shifts match the current role filter (${selectedRole.toUpperCase()}) or status.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto select-none">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10.5px] uppercase tracking-wider text-[var(--text-faint)] bg-white/[0.02]">
                <th className="py-3 px-3">Date &amp; Shift Window</th>
                <th className="py-3 px-3">Staff Name</th>
                <th className="py-3 px-3">Role</th>

                {/* DYNAMIC FINANCIAL COLUMNS: OMITTED FOR WAITERS & CHEFS */}
                {!isNonFinancialView && (
                  <>
                    <th className="py-3 px-3 text-right">Opening Float</th>
                    <th className="py-3 px-3 text-right">Total Sales</th>
                    <th className="py-3 px-3 text-right">Expected Cash</th>
                    <th className="py-3 px-3 text-right">Actual Counted</th>
                    <th className="py-3 px-3 text-right">Variance</th>
                  </>
                )}

                {/* NON-FINANCIAL DETAIL: Shift Duration */}
                {isNonFinancialView && (
                  <th className="py-3 px-3 text-right">Shift Duration</th>
                )}

                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {filteredShifts.map((shift, idx) => {
                const isBalanced = shift.variance === 0;
                const isSurplus = shift.variance > 0;
                const isCashierRow = shift.role === "cashier";

                return (
                  <tr
                    key={shift.id || idx}
                    className="hover:bg-white/[0.025] transition-colors"
                  >
                    {/* 1. Date & Shift Window (Always bright, bold & fully readable) */}
                    <td className="py-3.5 px-3 font-semibold text-[var(--text-hi)] whitespace-nowrap">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-[var(--text-hi)] font-bold">
                          {shift.dateLabel}
                        </span>
                        <span className="text-[var(--text-faint)]">|</span>
                        <span className="text-[var(--gold)] font-medium">
                          {shift.loginTime} – {shift.logoutTime}
                        </span>
                      </div>
                    </td>

                    {/* 2. Staff Member Name */}
                    <td className="py-3.5 px-3 text-[var(--text-hi)] font-sans font-medium whitespace-nowrap">
                      {shift.staffName}
                    </td>

                    {/* 3. Distinctive Role Badge */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {renderRoleBadge(shift.role)}
                    </td>

                    {/* DYNAMIC FINANCIAL COLUMNS (When NOT filtered by waiter/chef) */}
                    {!isNonFinancialView && (
                      <>
                        {/* Opening Float */}
                        <td className="py-3.5 px-3 text-right font-mono whitespace-nowrap">
                          {isCashierRow ? (
                            <span className="text-[var(--text-lo)]">
                              {currencySymbol} {shift.openingFloat.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[var(--text-faint)] text-[10px]">— Non-Cashier</span>
                          )}
                        </td>

                        {/* Total Sales */}
                        <td className="py-3.5 px-3 text-right font-bold font-mono whitespace-nowrap">
                          {isCashierRow ? (
                            <span className="text-[#25d366]">
                              {currencySymbol} {shift.totalSales.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[var(--text-faint)] text-[10px]">—</span>
                          )}
                        </td>

                        {/* Expected Cash */}
                        <td className="py-3.5 px-3 text-right font-bold font-mono whitespace-nowrap">
                          {isCashierRow ? (
                            <span className="text-[var(--gold)]">
                              {currencySymbol} {shift.expectedCash.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[var(--text-faint)] text-[10px]">—</span>
                          )}
                        </td>

                        {/* Actual Counted */}
                        <td className="py-3.5 px-3 text-right font-black font-mono whitespace-nowrap">
                          {isCashierRow ? (
                            <span className="text-[var(--text-hi)]">
                              {currencySymbol} {shift.actualCounted.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[var(--text-faint)] text-[10px]">—</span>
                          )}
                        </td>

                        {/* Variance */}
                        <td
                          className={`py-3.5 px-3 text-right font-bold font-mono whitespace-nowrap ${
                            !isCashierRow
                              ? "text-[var(--text-faint)]"
                              : shift.status === "OPEN"
                              ? "text-[var(--text-faint)]"
                              : isBalanced
                              ? "text-[#25d366]"
                              : isSurplus
                              ? "text-[var(--gold)]"
                              : "text-rose-400"
                          }`}
                        >
                          {!isCashierRow ? (
                            <span className="text-[10px] text-[var(--text-faint)]">—</span>
                          ) : shift.status === "OPEN" ? (
                            "—"
                          ) : (
                            `${shift.variance >= 0 ? "+" : ""}${currencySymbol} ${shift.variance.toLocaleString()}`
                          )}
                        </td>
                      </>
                    )}

                    {/* Non-financial view duration */}
                    {isNonFinancialView && (
                      <td className="py-3.5 px-3 text-right font-mono text-[var(--gold)] font-bold whitespace-nowrap">
                        {shift.durationLabel}
                      </td>
                    )}

                    {/* Status Badge */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          shift.status === "OPEN"
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : shift.status === "FLAGGED"
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            : "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                        }`}
                      >
                        {shift.status === "OPEN" && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping mr-1" />
                        )}
                        {shift.status === "OPEN" ? "ACTIVE / OPEN" : shift.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
