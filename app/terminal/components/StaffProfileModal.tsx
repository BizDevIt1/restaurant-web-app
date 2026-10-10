"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
  Clock,
  Calendar,
  Store,
  Building2,
  CheckCircle2,
  LogOut,
  X,
  Sparkles,
  BadgeCheck,
  Timer,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { AuthenticatedUser } from "../../admin/types";
import { ShiftWindowValidation, getShiftWindowLabel, parseShiftOption } from "../../../lib/shiftSchedule";
import { createClient } from "@/lib/supabase";

interface StaffProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthenticatedUser;
  shiftValidation?: ShiftWindowValidation | null;
  onLogoutRequest: () => void;
}

export default function StaffProfileModal({
  isOpen,
  onClose,
  user,
  shiftValidation,
  onLogoutRequest,
}: StaffProfileModalProps) {
  const [activeShiftData, setActiveShiftData] = useState<any>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(false);

  // Fetch active shift details from public.shift_settlements
  useEffect(() => {
    if (!isOpen || !user) return;
    let isMounted = true;

    const fetchActiveShift = async () => {
      try {
        setIsLoadingShift(true);
        // First check sessionStorage for immediate cache
        const restId = user.restaurantId || user.organizationId || "default";
        try {
          const cached = sessionStorage.getItem(`pos_active_shift_${restId}`);
          if (cached && isMounted) {
            setActiveShiftData(JSON.parse(cached));
          }
        } catch {}

        // Then query Supabase for latest live open settlement
        const supabase = createClient();
        const { data, error } = await supabase
          .from("shift_settlements")
          .select("*")
          .eq("restaurant_id", Number(user.restaurantId) || 1)
          .eq("status", "OPEN")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data && isMounted) {
          setActiveShiftData(data);
        }
      } catch (err) {
        console.warn("[StaffProfileModal] Error fetching active shift:", err);
      } finally {
        if (isMounted) setIsLoadingShift(false);
      }
    };

    fetchActiveShift();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  if (!isOpen) return null;

  const roleLabel =
    user.staffRole?.toUpperCase() ||
    (user.role === "STAFF_MEMBER" ? "STAFF" : user.role || "OPERATOR");

  // Determine assigned shift schedule details
  const parsedShift = parseShiftOption(user.assignedShift || shiftValidation?.assignedShift);
  const shiftWindowLabel = parsedShift
    ? getShiftWindowLabel(parsedShift)
    : shiftValidation?.windowLabel || "08:00 AM - 04:00 PM";
  const shiftTitle = user.assignedShift || shiftValidation?.assignedShift || "First Shift (Morning)";

  // Shift session start time formatting
  const sessionStartTime = activeShiftData?.shift_start || activeShiftData?.created_at;
  const formattedStartTime = sessionStartTime
    ? new Date(sessionStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  // Calculate elapsed session hours
  const elapsedHours = sessionStartTime
    ? Math.max(0, (Date.now() - new Date(sessionStartTime).getTime()) / (1000 * 60 * 60)).toFixed(1)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--bg-deep)] border border-[var(--gold)]/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text-hi)] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header with Glow */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-[var(--gold-dim)]/40 via-transparent to-transparent border-b border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-[var(--surface-hi)]/80 hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] transition-colors cursor-pointer"
            title="Close Profile"
          >
            <X className="w-4 h-4" />
          </button>

          {/* User Avatar & Identity Block */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--gold)] to-amber-600 flex items-center justify-center text-zinc-950 font-black text-2xl font-display shadow-lg shadow-amber-500/20">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[var(--bg-deep)] flex items-center justify-center shadow-xs"
                title="Active Terminal Session"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-hi)] truncate">
                  {user.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/40 text-[var(--gold)] text-[10px] font-mono font-bold uppercase tracking-wider">
                  {roleLabel}
                </span>
              </div>
              <p className="text-xs text-[var(--text-lo)] font-mono truncate mt-0.5">
                {user.email || "No email linked"}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono mt-1 font-semibold">
                <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Verified Staff Member • Active Session</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Shift Schedule & Timing Card (Primary Highlight) */}
          <div className="p-4 rounded-2xl bg-[var(--surface-hi)]/70 border border-[var(--gold)]/30 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/40 flex items-center justify-center text-[var(--gold)] shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--gold)] font-mono">
                    Shift Schedule &amp; Timings
                  </h3>
                  <p className="text-[11px] text-[var(--text-lo)]">Assigned operating shift</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                {shiftValidation?.isValid ? "Active Window" : "Shift Assigned"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-[var(--text-faint)] font-mono block">
                  Shift Designation
                </span>
                <p className="text-xs font-bold text-[var(--text-hi)] truncate">
                  {shiftTitle}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-[var(--text-faint)] font-mono block">
                  Scheduled Hours
                </span>
                <p className="text-xs font-bold text-[var(--gold)] font-mono truncate">
                  {shiftWindowLabel}
                </p>
              </div>
            </div>

            {/* Live Operational Shift Segment Info */}
            {activeShiftData && (
              <div className="pt-2 border-t border-[var(--border)]/60 grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] block">Started At</span>
                  <span className="font-bold text-[var(--text-hi)]">
                    {formattedStartTime || "Live"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] block">Session Duration</span>
                  <span className="font-bold text-emerald-400">
                    {elapsedHours ? `${elapsedHours} hrs` : "Ongoing"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] block">Opening Float</span>
                  <span className="font-bold text-[var(--gold)]">
                    Rs {Number(activeShiftData.opening_float || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Staff Details & Organization Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Phone */}
            <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/50 border border-[var(--border)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-lo)] shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-[var(--text-faint)] font-mono block">
                  Contact Phone
                </span>
                <p className="text-xs font-semibold text-[var(--text-hi)] truncate font-mono">
                  {user.phone || "No phone registered"}
                </p>
              </div>
            </div>

            {/* Outlet / Branch */}
            <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/50 border border-[var(--border)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-lo)] shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-[var(--text-faint)] font-mono block">
                  Assigned Branch
                </span>
                <p className="text-xs font-semibold text-[var(--text-hi)] truncate">
                  {user.branchName || "Main Branch"}
                </p>
              </div>
            </div>

            {/* Restaurant Brand */}
            <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/50 border border-[var(--border)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-lo)] shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-[var(--text-faint)] font-mono block">
                  Restaurant Brand
                </span>
                <p className="text-xs font-semibold text-[var(--text-hi)] truncate">
                  {user.restaurantName || "Omnibites Restaurant"}
                </p>
              </div>
            </div>

            {/* Terminal Access */}
            <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/50 border border-[var(--border)] flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-lo)] shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-[var(--text-faint)] font-mono block">
                  Terminal Scope
                </span>
                <p className="text-xs font-semibold text-[var(--text-hi)] truncate font-mono">
                  {user.terminalAccess || "POS Terminal Full Access"}
                </p>
              </div>
            </div>
          </div>

          {/* POS Terminal Capabilities */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/40 border border-[var(--border)] space-y-2">
            <span className="text-[10px] font-bold uppercase text-[var(--text-faint)] font-mono block tracking-wider">
              Terminal Privileges &amp; Features
            </span>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                POS Order Settlement
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Thermal Receipt Printing
              </span>
              {user.enableKitchenKds && (
                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Kitchen KDS Routing
                </span>
              )}
              {user.enableTableService && (
                <span className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Table Dine-In Service
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 sm:p-5 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-between gap-3">
          {/* Safe Terminal Logout Option */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogoutRequest();
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold font-mono transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of Terminal</span>
          </button>

          {/* Close Profile Dialog Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 text-[var(--text-hi)] border border-[var(--border)] text-xs font-bold font-mono transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
