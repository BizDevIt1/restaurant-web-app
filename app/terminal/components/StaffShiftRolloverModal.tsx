"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  LogOut,
  Play,
  BellRing,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import {
  ShiftWindowValidation,
  getNextShiftOption,
  getShiftShortName,
  getRestaurantShiftConfig,
  findActiveShiftByTime,
  calculateGraceDeadline,
  format24HourTo12Hour,
  getEffectiveShiftsList,
} from "@/lib/shiftSchedule";
import { recordStaffShiftRollover } from "@/lib/universalShiftLogging";

interface StaffShiftRolloverModalProps {
  isOpen: boolean;
  user: any;
  shiftValidation: ShiftWindowValidation | null;
  stationLabel: string;
  onRolloverSuccess: (nextShift: string) => void;
  onLogout: () => void;
  onRemindLater?: (snoozeUntilMs: number) => void;
}

export default function StaffShiftRolloverModal({
  isOpen,
  user,
  shiftValidation,
  stationLabel,
  onRolloverSuccess,
  onLogout,
  onRemindLater,
}: StaffShiftRolloverModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  // Clock ticker every second while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const restId = user?.restaurantId || user?.restId || user?.organizationId;
  const config = useMemo(() => getRestaurantShiftConfig(restId, user), [restId, user]);

  // Dynamic Shift Target on Start: find matching real-world shift or next chronological shift
  const currentShiftName = shiftValidation?.assignedShift || user?.assignedShift;
  const dynamicNextShift = useMemo(() => {
    const activeByTime = findActiveShiftByTime(new Date(now), config);
    if (activeByTime && activeByTime.name !== currentShiftName) {
      return activeByTime.name;
    }
    return getNextShiftOption(currentShiftName, config);
  }, [now, config, currentShiftName]);

  const nextShiftShort = getShiftShortName(dynamicNextShift, config);

  // Strict 30-Minute Grace Window with Hard Cutoff
  const endTiming = shiftValidation?.shiftEndTime || "04:00 PM";
  const graceDeadline = useMemo(() => {
    if (shiftValidation?.graceDeadlineMs) {
      return new Date(shiftValidation.graceDeadlineMs);
    }
    return calculateGraceDeadline(endTiming, new Date(now), 30);
  }, [shiftValidation?.graceDeadlineMs, endTiming, now]);

  const graceMsRemaining = Math.max(0, graceDeadline.getTime() - now);
  const graceMinsRemaining = Math.ceil(graceMsRemaining / (60 * 1000));
  const isGraceExpired = now >= graceDeadline.getTime();

  if (!isOpen || !shiftValidation) return null;

  const handleStartNextShift = async () => {
    setIsSubmitting(true);
    try {
      await recordStaffShiftRollover(user, dynamicNextShift, {
        station: stationLabel,
      });
      onRolloverSuccess(dynamicNextShift);
    } catch (err) {
      console.warn("[StaffShiftRolloverModal] Rollover error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemindClick = () => {
    if (!onRemindLater || isGraceExpired) return;
    // Remind Me Later snoozes by 10 minutes, bounded strictly by graceDeadline
    const snoozeTarget = Math.min(now + 10 * 60 * 1000, graceDeadline.getTime());
    onRemindLater(snoozeTarget);
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-lockout-title"
    >
      <div className="w-full max-w-md bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-hi)] font-sans relative">
        {/* Glow ambient accent */}
        <div className={`absolute -top-20 -right-20 w-40 h-40 ${isGraceExpired ? "bg-red-500/20" : "bg-amber-500/15"} rounded-full blur-3xl pointer-events-none`} />

        {/* Header */}
        <div className="text-center space-y-2 relative">
          <div className={`w-14 h-14 rounded-2xl ${isGraceExpired ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/40"} flex items-center justify-center mx-auto shadow-inner`}>
            {isGraceExpired ? (
              <ShieldAlert className="w-7 h-7 text-red-400 animate-pulse" />
            ) : (
              <Clock className="w-7 h-7 text-[var(--gold)]" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border">
            {isGraceExpired ? (
              <span className="text-red-400 bg-red-950/40 border-red-800/50">
                🚨 Hard Cutoff • Grace Period Expired
              </span>
            ) : (
              <span className="text-amber-400 bg-amber-950/30 border-amber-500/30">
                Shift Window Expired • Action Required
              </span>
            )}
          </div>

          <h2 id="shift-lockout-title" className="font-display font-black text-xl text-[var(--text-hi)] tracking-tight">
            {isGraceExpired ? "Shift Duty Locked" : "Shift Expired"}
          </h2>

          <p className="text-xs text-[var(--text-lo)] font-mono">
            <span className="font-bold text-[var(--text-hi)]">{shiftValidation.shiftShortName}</span> ended at{" "}
            <span className="font-bold text-[var(--gold)]">{shiftValidation.shiftEndLabel}</span>
          </p>
        </div>

        {/* Grace Window Status Banner */}
        <div className={`p-3.5 rounded-2xl border text-xs font-mono space-y-1 ${
          isGraceExpired
            ? "bg-red-950/40 border-red-800/60 text-red-200"
            : "bg-amber-500/10 border-amber-500/30 text-amber-300"
        }`}>
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {isGraceExpired ? "30-Min Grace Expired" : "Strict 30-Min Grace Active"}
            </span>
            <span className="font-mono">
              {isGraceExpired ? "0m left" : `${graceMinsRemaining}m left`}
            </span>
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed font-sans">
            {isGraceExpired
              ? "The 30-minute grace period has passed. Terminal access is now locked until you start the next shift or log out."
              : `Handover or switch shifts now. You have ${graceMinsRemaining} minutes remaining before hard lockout.`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 font-mono">
          {/* 1. Start Next Shift */}
          <button
            type="button"
            onClick={handleStartNextShift}
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl btn-gold font-bold text-xs cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Play className="w-4 h-4 stroke-[2.5]" />
            <span>{isSubmitting ? "Starting Shift..." : `Start Next Shift (${nextShiftShort})`}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>

          {/* 2. Remind Me Later — Hidden once currentTime >= graceDeadline */}
          {!isGraceExpired && onRemindLater && (
            <button
              type="button"
              onClick={handleRemindClick}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--gold)] border border-[var(--gold)]/30 hover:border-[var(--gold)] font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Remind Me Later (10m snooze, max {graceMinsRemaining}m)</span>
            </button>
          )}

          {/* 3. End Shift & Logout */}
          <button
            type="button"
            onClick={onLogout}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[var(--surface)] hover:bg-rose-500/10 text-[var(--text-lo)] hover:text-rose-400 border border-[var(--border)] hover:border-rose-500/30 font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>End Shift &amp; Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
