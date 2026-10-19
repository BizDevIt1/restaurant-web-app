"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/app/admin/context/AuthContext";
import {
  validateCashierShiftWindow,
  ShiftWindowValidation,
  isShiftFromPreviousDate,
  isShiftWindowConcluded,
  getRestaurantShiftConfig,
} from "@/lib/shiftSchedule";

export interface ShiftContextValue {
  shiftValidation: ShiftWindowValidation | null;
  activeShift: any | null;
  setActiveShift: React.Dispatch<React.SetStateAction<any | null>>;
  minutesRemaining: number;
  isWarningWindow: boolean;
  isWarningModalOpen: boolean;
  setIsWarningModalOpen: (open: boolean) => void;
  snoozeWarningModal: () => void;
  isClosureRequired: boolean;
  isShiftLocked: boolean;
  shiftShortName: string;
  windowLabel: string;
  shiftEndLabel: string;
}

const ShiftContext = createContext<ShiftContextValue | undefined>(undefined);

const WARNING_RECURRENCE_MS = 3 * 60 * 1000; // 3 minutes

export function ShiftProvider({
  children,
  initialActiveShift = null,
}: {
  children: React.ReactNode;
  initialActiveShift?: any | null;
}) {
  const { user } = useAuth();

  const isCashier = Boolean(
    user &&
    (user.staffRole === "cashier" ||
      (user.role as string) === "cashier" ||
      user.terminalAccess === "POS_ONLY")
  );

  const [activeShift, setActiveShift] = useState<any | null>(initialActiveShift);
  const [shiftValidation, setShiftValidation] = useState<ShiftWindowValidation | null>(() => {
    if (!user || !isCashier) return null;
    const shiftToValidate = initialActiveShift?.shift_type || user.assignedShift;
    if (!shiftToValidate) return null;
    return validateCashierShiftWindow(shiftToValidate, new Date(), initialActiveShift);
  });

  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [lastWarningDismissedAt, setLastWarningDismissedAt] = useState<number>(0);

  // Synchronize activeShift with initialActiveShift if provided
  useEffect(() => {
    if (initialActiveShift) {
      setActiveShift(initialActiveShift);
    }
  }, [initialActiveShift]);

  // Periodic Shift Window Evaluation (every 5 seconds)
  useEffect(() => {
    if (!user || !isCashier) {
      setShiftValidation(null);
      return;
    }

    const verify = () => {
      const shiftToValidate = activeShift?.shift_type || user.assignedShift;
      if (!shiftToValidate) {
        setShiftValidation(null);
        return;
      }
      const restId = user?.restaurantId || (user as any)?.restaurant_id || user?.id;
      const cfg = getRestaurantShiftConfig(restId, user);
      const result = validateCashierShiftWindow(shiftToValidate, new Date(), activeShift, cfg);
      setShiftValidation(result);

      // Check 10-minute warning trigger
      if (result.isValid && result.isWarningWindow) {
        const now = Date.now();
        if (now - lastWarningDismissedAt >= WARNING_RECURRENCE_MS) {
          setIsWarningModalOpen(true);
        }
      } else {
        // If no longer in warning window (e.g. shift concluded or renewed), close warning modal
        setIsWarningModalOpen(false);
      }
    };

    verify();
    const timer = setInterval(verify, 5000);
    const handleShiftConfigUpdated = () => verify();
    window.addEventListener("restaurant_shift_config_updated", handleShiftConfigUpdated);
    return () => {
      clearInterval(timer);
      window.removeEventListener("restaurant_shift_config_updated", handleShiftConfigUpdated);
    };
  }, [user, isCashier, activeShift, lastWarningDismissedAt]);

  const snoozeWarningModal = useCallback(() => {
    setIsWarningModalOpen(false);
    setLastWarningDismissedAt(Date.now());
  }, []);

  const minutesRemaining = shiftValidation?.minutesRemaining ?? 999;
  const isWarningWindow = Boolean(shiftValidation?.isValid && shiftValidation?.isWarningWindow);

  // An active shift is open if it has OPEN status, is from current day, and has no closed_at timestamp
  const isStale = isShiftFromPreviousDate(activeShift);
  const hasOpenActiveShift = Boolean(
    activeShift &&
    !isStale &&
    (activeShift.status === "OPEN" ||
      activeShift.status === "active" ||
      (!activeShift.status && !activeShift.closed_at))
  );

  // Strict Active Guard: Check if shift is concluded, suppressing for active consecutive shifts
  const isConcluded = isShiftWindowConcluded(shiftValidation, activeShift);

  // Grace Period / Closure Required: Shift window has expired, but the cashier holds an open shift that must be settled
  const isClosureRequired = Boolean(isConcluded && hasOpenActiveShift);

  // Hard lockout: Shift window expired AND cashier does NOT have an open shift to reconcile
  const isShiftLocked = Boolean(isConcluded && !hasOpenActiveShift);

  const shiftShortName = shiftValidation?.shiftShortName || "Shift";
  const windowLabel = shiftValidation?.windowLabel || "";
  const shiftEndLabel = shiftValidation?.shiftEndLabel || "04:00 PM";

  const contextValue = useMemo<ShiftContextValue>(() => ({
    shiftValidation,
    activeShift,
    setActiveShift,
    minutesRemaining,
    isWarningWindow,
    isWarningModalOpen,
    setIsWarningModalOpen,
    snoozeWarningModal,
    isClosureRequired,
    isShiftLocked,
    shiftShortName,
    windowLabel,
    shiftEndLabel,
  }), [
    shiftValidation,
    activeShift,
    minutesRemaining,
    isWarningWindow,
    isWarningModalOpen,
    snoozeWarningModal,
    isClosureRequired,
    isShiftLocked,
    shiftShortName,
    windowLabel,
    shiftEndLabel,
  ]);

  return (
    <ShiftContext.Provider value={contextValue}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift(): ShiftContextValue {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error("useShift must be used within a ShiftProvider");
  }
  return context;
}
