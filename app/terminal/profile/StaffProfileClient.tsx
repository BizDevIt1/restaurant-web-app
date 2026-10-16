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
  BadgeCheck,
  Timer,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../admin/context/AuthContext";
import {
  parseShiftOption,
  getShiftEndLabel,
  getShiftWindowLabel,
  ShiftTypeOption,
} from "../../../lib/shiftSchedule";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import PosSidebar from "../pos/components/PosSidebar";

function getShiftStartLabel(shift: ShiftTypeOption | null): string {
  switch (shift) {
    case "First Shift (Morning)":
      return "08:00 AM";
    case "Second Shift (Evening)":
      return "04:00 PM";
    case "Third Shift (Night / Closing)":
      return "12:00 AM";
    default:
      return "08:00 AM";
  }
}

export default function StaffProfileClient() {
  const router = useRouter();
  const { user, shiftValidation } = useAuth();
  const [activeShiftData, setActiveShiftData] = useState<any>(null);

  // If user has a chef role, redirect directly to the dedicated Kitchen Terminal profile
  useEffect(() => {
    if (!user) return;
    const rawRole = (user.staffRole || "").toLowerCase().trim();
    const isChef =
      rawRole === "chef" ||
      rawRole === "kitchen" ||
      rawRole === "cook" ||
      rawRole === "kds" ||
      user.terminalAccess === "KDS_ONLY" ||
      (user.terminalAccess as string) === "KITCHEN_ONLY";
    if (isChef) {
      router.replace("/terminal/kitchen?tab=profile");
    }
  }, [user, router]);

  // Fetch active shift details if available
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchActiveShift = async () => {
      try {
        const restId = user.restaurantId || user.organizationId || "default";

        // Check local session storage cache
        try {
          const cached = sessionStorage.getItem(`pos_active_shift_${restId}`);
          if (cached && isMounted) {
            setActiveShiftData(JSON.parse(cached));
          }
        } catch {}

        // Query Supabase for latest live open settlement
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
        console.warn("[StaffProfileClient] Error fetching shift:", err);
      }
    };

    fetchActiveShift();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (!user) {
    return null;
  }

  const roleLabel =
    user.staffRole?.toUpperCase() ||
    (user.role === "STAFF_MEMBER" ? "STAFF" : user.role || "OPERATOR");

  // Determine assigned shift schedule details
  const parsedShift = parseShiftOption(user.assignedShift || shiftValidation?.assignedShift);
  const shiftTitle = user.assignedShift || shiftValidation?.assignedShift || "First Shift (Morning)";
  const shiftWindowLabel = parsedShift
    ? getShiftWindowLabel(parsedShift)
    : shiftValidation?.windowLabel || "08:00 AM - 04:00 PM";
  const shiftStartFormatted = getShiftStartLabel(parsedShift);
  const shiftEndFormatted = parsedShift
    ? getShiftEndLabel(parsedShift)
    : shiftValidation?.shiftEndLabel || "04:00 PM";

  return (
    <div className="flex-1 w-full flex h-full min-h-0 relative overflow-hidden bg-[var(--bg)] text-[var(--text-hi)] font-sans select-none transition-colors duration-150">
      {/* POS Left Sidebar with Staff Profile highlighted */}
      <PosSidebar currentView="profile" activeShift={activeShiftData} />

      {/* Main Professional Profile Viewport */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto pb-24 lg:pb-12 scrollbar-thin">
        <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
          {/* ========================================================================= */}
          {/* A. CLEAN TOP BAR HEADING (NO BACK OR Z-REPORT BUTTONS)                    */}
          {/* ========================================================================= */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
                Staff{" "}
                <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                  Profile
                </span>
              </h1>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* B. BALANCED PROFESSIONAL IDENTITY HERO CARD                               */}
          {/* ========================================================================= */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[var(--border)] relative overflow-hidden group">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--gold-dim)]/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Left: Avatar & Identity Core */}
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--gold)] to-amber-600 flex items-center justify-center text-zinc-950 font-black text-3xl font-display shadow-lg shadow-amber-500/20">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[var(--bg-deep)] flex items-center justify-center shadow-xs"
                    title="Active Terminal Session"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  </span>
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-2xl font-display font-extrabold tracking-tight text-[var(--text-hi)] truncate">
                      {user.name}
                    </h2>
                    <span className="px-3 py-0.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/40 text-[var(--gold)] text-xs font-mono font-bold uppercase tracking-wider">
                      {roleLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-lo)] font-mono truncate">
                    {user.email || "No email registered"}
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-xs text-emerald-400 font-mono font-medium">
                    <BadgeCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Verified Staff Member • Live Session</span>
                  </div>
                </div>
              </div>

              {/* Right: Branch & Restaurant Pill */}
              <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-center gap-1.5 font-mono text-xs border-t md:border-t-0 md:border-l border-[var(--border)] pt-4 md:pt-0 md:pl-6 shrink-0">
                <div className="flex items-center gap-2 text-[var(--text-hi)] font-bold">
                  <Building2 className="w-4 h-4 text-[var(--gold)] shrink-0" />
                  <span>{user.restaurantName || "Omnibites Restaurant"}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-lo)]">
                  <Store className="w-4 h-4 text-[var(--text-faint)] shrink-0" />
                  <span>{user.branchName || "Main Branch Outlet"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* C. PROFESSIONAL DETAILS GRID: CREDENTIALS & SHIFT TIMINGS                 */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Staff Member Credentials & Contact Details */}
            <div className="glass-panel p-6 rounded-3xl border border-[var(--border)] space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-[var(--text-hi)]">
                    Staff Credentials &amp; Contact
                  </h3>
                  <p className="text-[11px] text-[var(--text-lo)]">Personal information and outlet assignment</p>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* Full Name */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <User className="w-4 h-4 text-[var(--text-faint)]" />
                    <span>Full Name:</span>
                  </div>
                  <span className="text-[var(--text-hi)] font-bold truncate max-w-[200px]">
                    {user.name}
                  </span>
                </div>

                {/* Email Address */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <Mail className="w-4 h-4 text-[var(--text-faint)]" />
                    <span>Email Address:</span>
                  </div>
                  <span className="text-[var(--text-hi)] font-bold truncate max-w-[200px]">
                    {user.email || "N/A"}
                  </span>
                </div>

                {/* Contact Phone */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <Phone className="w-4 h-4 text-[var(--text-faint)]" />
                    <span>Contact Phone:</span>
                  </div>
                  <span className="text-[var(--text-hi)] font-bold">
                    {user.phone || "Not registered"}
                  </span>
                </div>

                {/* Assigned Branch */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <Store className="w-4 h-4 text-[var(--text-faint)]" />
                    <span>Assigned Branch:</span>
                  </div>
                  <span className="text-[var(--text-hi)] font-bold">
                    {user.branchName || "Main Branch"}
                  </span>
                </div>

                {/* Active Staff Role */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <Shield className="w-4 h-4 text-[var(--text-faint)]" />
                    <span>Active Role:</span>
                  </div>
                  <span className="text-[var(--gold)] font-bold">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Structured Shift Schedule & Operating Window */}
            <div className="glass-panel p-6 rounded-3xl border border-[var(--border)] space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-[var(--text-hi)]">
                    Structured Shift Timings
                  </h3>
                  <p className="text-[11px] text-[var(--text-lo)]">Assigned daily operational schedule</p>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* Shift Designation */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <Calendar className="w-4 h-4 text-[var(--text-faint)]" />
                    <span>Assigned Shift:</span>
                  </div>
                  <span className="text-[var(--text-hi)] font-bold">
                    {shiftTitle}
                  </span>
                </div>

                {/* Scheduled Window Hours */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <Clock className="w-4 h-4 text-[var(--text-faint)]" />
                    <span>Operating Window:</span>
                  </div>
                  <span className="text-[var(--gold)] font-bold">
                    {shiftWindowLabel}
                  </span>
                </div>

                {/* Shift Start Time */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <Timer className="w-4 h-4 text-emerald-400" />
                    <span>Shift Start Time:</span>
                  </div>
                  <span className="text-emerald-400 font-bold">
                    {shiftStartFormatted}
                  </span>
                </div>

                {/* Shift End Time */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <Clock className="w-4 h-4 text-[var(--gold)]" />
                    <span>Shift End Time:</span>
                  </div>
                  <span className="text-[var(--gold)] font-bold">
                    {shiftEndFormatted}
                  </span>
                </div>

                {/* Status Indicator */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Roster Status:</span>
                  </div>
                  <span className="text-emerald-400 font-bold">
                    Active on Duty
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
