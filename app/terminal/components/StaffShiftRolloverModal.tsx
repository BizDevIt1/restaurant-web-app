"use client";

import React, { useState } from "react";
import {
  Clock,
  LogOut,
  Play,
  BellRing,
} from "lucide-react";
import {
  ShiftWindowValidation,
  getNextShiftOption,
  getShiftShortName,
  isShiftSnoozeAllowed,
  getMinutesSinceShiftEnd,
} from "@/lib/shiftSchedule";
import { recordStaffShiftRollover } from "@/lib/universalShiftLogging";

interface StaffShiftRolloverModalProps {
  isOpen: boolean;
  user: any;
  shiftValidation: ShiftWindowValidation | null;
  stationLabel: string;
  onRolloverSuccess: (nextShift: string) => void;
  onLogout: () => void;
  onRemindLater: () => void;
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

  if (!isOpen || !shiftValidation) return null;

  const currentShift = shiftValidation.assignedShift;
  const nextShift = getNextShiftOption(currentShift);
  const nextShiftShort = getShiftShortName(nextShift);
  const isSnoozeAllowed = isShiftSnoozeAllowed(currentShift);
  const minutesSinceEnd = getMinutesSinceShiftEnd(currentShift);

  const handleStartNextShift = async () => {
    setIsSubmitting(true);
    try {
      await recordStaffShiftRollover(user, nextShift, {
        station: stationLabel,
      });
      onRolloverSuccess(nextShift);
    } catch (err) {
      console.warn("[StaffShiftRolloverModal] Rollover error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-lockout-title"
    >
      <div className="w-full max-w-sm bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-hi)] font-sans">
        {/* Header — compact */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/40 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h2 id="shift-lockout-title" className="font-display font-black text-lg text-[var(--text-hi)]">
            Shift Expired
          </h2>
          <p className="text-xs text-[var(--text-lo)] font-mono">
            {shiftValidation.shiftShortName} ended at {shiftValidation.shiftEndLabel}
          </p>
          {!isSnoozeAllowed && (
            <p className="text-[11px] text-amber-400 font-mono">
              Grace period ended ({minutesSinceEnd}m past scheduled end). Action required.
            </p>
          )}
        </div>

        {/* 3 Action Buttons — stacked, clean */}
        <div className="space-y-2.5 font-mono">
          {/* 1. Start Next Shift */}
          <button
            type="button"
            onClick={handleStartNextShift}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl btn-gold font-bold text-xs cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 stroke-[2.5]" />
            <span>{isSubmitting ? "Starting..." : `Start Next Shift (${nextShiftShort})`}</span>
          </button>

          {/* 2. Remind Me Later — strictly visible/enabled within 60 minutes */}
          {isSnoozeAllowed ? (
            <button
              type="button"
              onClick={onRemindLater}
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-hi)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <BellRing className="w-4 h-4" />
              <span>Remind Me Later (15 min)</span>
            </button>
          ) : (
            <div className="py-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center text-[10.5px] font-mono">
              Snooze expired (&gt;60 min). Choose an option below.
            </div>
          )}

          {/* 3. End Shift & Logout */}
          <button
            type="button"
            onClick={onLogout}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-[var(--surface)] hover:bg-rose-500/10 text-[var(--text-lo)] hover:text-rose-400 border border-[var(--border)] hover:border-rose-500/30 font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>End Shift &amp; Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
