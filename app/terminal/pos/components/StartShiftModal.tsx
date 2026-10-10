"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Banknote,
  Sun,
  Sunset,
  Moon,
  Clock,
  User,
  Building2,
  LogOut,
  AlertCircle,
  Lock,
} from "lucide-react";
import { playPosSound } from "@/utils/posAudio";

import { useAuth } from "@/app/admin/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";

export type ShiftTypeOption =
  | "First Shift (Morning)"
  | "Second Shift (Evening)"
  | "Third Shift (Night / Closing)";

interface StartShiftModalProps {
  isOpen: boolean;
  cashierName: string;
  branchName?: string;
  currencySymbol?: string;
  assignedShift?: ShiftTypeOption;
  previousHandoverAmount?: number;
  previousCashierName?: string;
  previousShiftType?: string;
  onConfirmStartShift: (payload: {
    shiftType: ShiftTypeOption;
    openingFloat: number;
    notes?: string;
  }) => Promise<void>;
  onLogOut?: () => void;
  user?: any;
}

export default function StartShiftModal({
  isOpen,
  cashierName,
  branchName = "Main Branch • Register #01",
  currencySymbol = "Rs",
  assignedShift,
  previousHandoverAmount,
  previousCashierName,
  previousShiftType,
  onConfirmStartShift,
  onLogOut,
  user: propUser,
}: StartShiftModalProps) {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [openingFloat, setOpeningFloat] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [handoverData, setHandoverData] = useState<{
    amount: number;
    cashierName: string;
    shiftType: string;
    closedAt?: string;
  } | null>(() => {
    if (previousHandoverAmount !== undefined) {
      return {
        amount: previousHandoverAmount,
        cashierName: previousCashierName || "Previous Cashier",
        shiftType: previousShiftType || "Previous Shift",
      };
    }
    return null;
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Lock body scroll and set data-attribute to hide background header
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute("data-shift-modal-open", "true");
    } else {
      document.body.removeAttribute("data-shift-modal-open");
    }
    return () => {
      document.body.removeAttribute("data-shift-modal-open");
    };
  }, [isOpen]);

  // Automatically detect cashier's assigned shift from staff profile
  const detectedShift: ShiftTypeOption = React.useMemo(() => {
    if (assignedShift) return assignedShift;
    const raw = (user?.assignedShift || (user as any)?.shift || "").toLowerCase();
    if (raw.includes("morning") || raw.includes("first")) return "First Shift (Morning)";
    if (raw.includes("evening") || raw.includes("second") || raw.includes("rush")) return "Second Shift (Evening)";
    if (raw.includes("night") || raw.includes("third") || raw.includes("closing") || raw.includes("owl")) return "Third Shift (Night / Closing)";

    // Time-based fallback
    const hour = new Date().getHours();
    if (hour >= 8 && hour < 16) return "First Shift (Morning)";
    if (hour >= 16 && hour < 24) return "Second Shift (Evening)";
    return "Third Shift (Night / Closing)";
  }, [assignedShift, user]);

  // Query most recently closed shift to retrieve cash_handover_to_next_shift and prepopulate float
  useEffect(() => {
    if (!isOpen) return;

    if (previousHandoverAmount !== undefined) {
      setOpeningFloat((prev) => (prev === "" ? String(previousHandoverAmount) : prev));
      return;
    }

    let isMountedLocal = true;
    const fetchPreviousShiftHandover = async () => {
      try {
        const supabase = createClient();
        const { restId, branchId } = await getValidTenantContext(user);

        let query = supabase
          .from("shift_settlements")
          .select("*")
          .eq("restaurant_id", restId)
          .neq("status", "OPEN")
          .order("created_at", { ascending: false })
          .limit(1);

        if (branchId) {
          const numBranch = Number(branchId);
          if (!isNaN(numBranch) && numBranch > 0) {
            query = query.eq("branch_id", numBranch);
          }
        }

        const { data: lastShift, error } = await query.maybeSingle();

        if (error) {
          console.warn("[StartShiftModal] Handover query notice:", error.message);
        }

        if (lastShift && isMountedLocal) {
          const handoverAmt = Number(
            lastShift.cash_handover_to_next_shift ??
            lastShift.actual_cash_counted ??
            lastShift.opening_float ??
            0
          );

          setHandoverData({
            amount: handoverAmt,
            cashierName: lastShift.cashier_name || "Previous Cashier",
            shiftType: lastShift.shift_type || "Previous Shift",
            closedAt: lastShift.closed_at || lastShift.shift_end,
          });

          // Automatically prepopulate the "Physical Opening Cash Float (Rs)" input field
          setOpeningFloat(String(handoverAmt));
        } else if (previousHandoverAmount !== undefined && isMountedLocal) {
          setOpeningFloat(String(previousHandoverAmount));
        }
      } catch (err) {
        console.warn("[StartShiftModal] Exception fetching previous shift handover:", err);
        if (previousHandoverAmount !== undefined && isMountedLocal) {
          setOpeningFloat(String(previousHandoverAmount));
        }
      }
    };

    fetchPreviousShiftHandover();

    return () => {
      isMountedLocal = false;
    };
  }, [isOpen, user, previousHandoverAmount]);

  // Live formatted time
  const [currentTime, setCurrentTime] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen || !isMounted) return null;

  const numericFloat = parseFloat(openingFloat) || 0;

  // Resolve shift metadata based on assigned locked shift
  const shiftHours =
    detectedShift === "First Shift (Morning)"
      ? "08:00 AM – 04:00 PM"
      : detectedShift === "Second Shift (Evening)"
      ? "04:00 PM – 12:00 AM"
      : "12:00 AM – 08:00 AM";

  const ShiftIcon =
    detectedShift === "First Shift (Morning)"
      ? Sun
      : detectedShift === "Second Shift (Evening)"
      ? Sunset
      : Moon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (openingFloat.trim() === "" || isNaN(numericFloat) || numericFloat < 0) {
      setErrorMessage("Mandatory: Please enter the physical starting cash float present in the drawer (e.g. Rs 5,000) before accessing the POS terminal.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onConfirmStartShift({
        shiftType: detectedShift,
        openingFloat: numericFloat,
        notes: notes.trim() || undefined,
      });
      playPosSound("chime");
    } catch (err: any) {
      console.error("[StartShiftModal] Error starting shift:", err);
      setErrorMessage(err?.message || "Failed to start shift. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      style={{ isolation: "isolate" }}
    >
      <div className="w-full max-w-lg max-h-[92vh] bg-[var(--bg-deep)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden text-[var(--text-hi)] flex flex-col my-auto animate-in zoom-in-95 duration-200 relative">
        {/* ===================================================================== */}
        {/* 1. TOP HEADER                                                         */}
        {/* ===================================================================== */}
        <div className="p-5 sm:p-6 border-b border-[var(--border)] bg-gradient-to-b from-[var(--surface-hi)]/40 to-transparent shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-display font-bold text-[var(--text-hi)] tracking-tight truncate">
                Start Shift &amp; Declare Float
              </h2>
            </div>

            {/* Logout / Switch Cashier Action */}
            {onLogOut && (
              <button
                type="button"
                onClick={onLogOut}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-red-500/10 border border-[var(--border)] hover:border-red-500/40 text-[var(--text-lo)] hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Log Out or Switch Account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            )}
          </div>

          {/* Cashier & Register Context Bar */}
          <div className="mt-4 pt-3 border-t border-[var(--border)]/60 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--text-lo)] bg-[var(--surface)]/60 px-3 py-1.5 rounded-xl border border-[var(--border)]/40 min-w-0">
              <User className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
              <div className="truncate min-w-0">
                <span className="text-[10px] uppercase font-mono block text-[var(--text-faint)] leading-none">
                  Cashier
                </span>
                <span className="font-semibold text-[var(--text-hi)] truncate block">
                  {cashierName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[var(--text-lo)] bg-[var(--surface)]/60 px-3 py-1.5 rounded-xl border border-[var(--border)]/40 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
              <div className="truncate min-w-0">
                <span className="text-[10px] uppercase font-mono block text-[var(--text-faint)] leading-none">
                  Register
                </span>
                <span className="font-semibold text-[var(--text-hi)] truncate block">
                  {branchName}
                </span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-2 text-[var(--text-lo)] bg-[var(--surface)]/60 px-3 py-1.5 rounded-xl border border-[var(--border)]/40 min-w-0">
              <Clock className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
              <div className="truncate min-w-0">
                <span className="text-[10px] uppercase font-mono block text-[var(--text-faint)] leading-none">
                  Live Time
                </span>
                <span className="font-mono font-bold text-[var(--text-hi)] truncate block">
                  {currentTime || "00:00:00"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2. FORM BODY & STICKY FOOTER                                         */}
        {/* ===================================================================== */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Section A: Assigned Shift (Simplified) */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center shrink-0">
                <ShiftIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-[var(--text-hi)] block truncate">
                    {detectedShift} • {shiftHours}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--gold)] font-semibold px-2 py-0.5 rounded bg-[var(--gold-dim)] border border-[var(--gold)]/20 shrink-0">
                    Assigned
                  </span>
                </div>
              </div>
              <Lock className="w-4 h-4 text-[var(--text-faint)] shrink-0" />
            </div>

            {/* Section B: Previous Handover (Single Line) */}
            {(handoverData?.amount !== undefined || previousHandoverAmount !== undefined) && (
              <div className="p-3 px-4 rounded-xl bg-[var(--surface-hi)]/60 border border-[var(--gold)]/30 flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--text-lo)] truncate">
                  Previous Shift Handover ({handoverData?.cashierName || previousCashierName || "Prior Cashier"}{handoverData?.shiftType ? ` • ${handoverData.shiftType}` : ""}):
                </span>
                <span className="font-bold text-[var(--gold)] ml-2 shrink-0">
                  {currencySymbol} {(handoverData?.amount ?? previousHandoverAmount ?? 0).toLocaleString()}
                </span>
              </div>
            )}

            {/* Section C: Opening Cash Float Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="opening-float-input"
                  className="text-xs font-bold uppercase tracking-wider text-[var(--text-lo)] block"
                >
                  Physical Opening Cash Float ({currencySymbol})
                </label>
                {(handoverData?.amount !== undefined || previousHandoverAmount !== undefined) && (
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    ✓ Prepopulated from Previous Shift
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-black text-xl text-[var(--gold)] pointer-events-none select-none">
                  {currencySymbol}
                </div>
                <input
                  id="opening-float-input"
                  type="number"
                  step="any"
                  min="0"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  placeholder="0.00"
                  required
                  autoFocus
                  className="w-full pl-14 pr-4 py-3 rounded-2xl bg-[var(--surface)] border-2 border-[var(--border)] focus:border-[var(--gold)] focus:outline-none text-[var(--text-hi)] font-mono font-black text-2xl tracking-wider transition-all placeholder:text-[var(--text-faint)] shadow-inner"
                />
              </div>
            </div>

            {/* Section D: Optional Shift Notes */}
            <div className="space-y-1.5">
              <label
                htmlFor="opening-notes-input"
                className="text-xs font-bold uppercase tracking-wider text-[var(--text-lo)] block"
              >
                Shift Handover Notes (Optional)
              </label>
              <input
                id="opening-notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter any handover notes..."
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] focus:outline-none text-xs text-[var(--text-hi)] transition-colors placeholder:text-[var(--text-faint)]"
              />
            </div>
          </div>

          {/* ===================================================================== */}
          {/* 3. STICKY SUBMIT FOOTER                                              */}
          {/* ===================================================================== */}
          <div className="p-4 sm:p-5 border-t border-[var(--border)] bg-[var(--surface)]/30 shrink-0">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#e3b13b] via-[#f0c354] to-[#df9d1d] hover:brightness-105 active:scale-[0.99] text-[#241a05] font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#241a05] border-t-transparent rounded-full animate-spin" />
                  <span>Starting Shift...</span>
                </>
              ) : (
                <span>Confirm &amp; Start Shift</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
