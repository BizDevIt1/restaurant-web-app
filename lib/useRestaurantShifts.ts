"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  DynamicShiftItem,
  RestaurantShiftConfig,
  getRestaurantShiftConfig,
  getEffectiveShiftsList,
  findActiveShiftByTime,
  getNextShift,
  format24HourTo12Hour,
  parseTimeToMinutes,
  calculateGraceDeadline,
  syncRestaurantShiftConfigFromDb,
} from "./shiftSchedule";

export interface UseRestaurantShiftsResult {
  shifts: DynamicShiftItem[];
  operatingHours: { openingTime: string; closingTime: string };
  activeShift: DynamicShiftItem | null;
  nextShift: DynamicShiftItem | null;
  currentShiftEndTime: string;
  currentShiftEndDate: Date | null;
  graceDeadlineDate: Date | null;
  minutesRemaining: number;
  minutesPastEnd: number;
  is10MinuteWarning: boolean;
  isExpired: boolean;
  isGraceExpired: boolean;
  formatShiftLabel: (shift: DynamicShiftItem) => string;
  refreshShifts: () => Promise<void>;
  rawConfig: RestaurantShiftConfig;
}

/**
 * Universal Dynamic Shift Hook for All Terminals (POS, Waiter, Kitchen, Admin)
 * Single Source of Truth dynamically populated from the database.
 */
export function useRestaurantShifts(
  restaurantId?: string | number | null,
  user?: any
): UseRestaurantShiftsResult {
  const resolvedRestId = restaurantId || user?.restaurantId || user?.restId || user?.organizationId;
  const [config, setConfig] = useState<RestaurantShiftConfig>(() =>
    getRestaurantShiftConfig(resolvedRestId, user)
  );
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Clock tick every 2 seconds for high-precision warning/expiry evaluation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Sync latest from database on mount if restaurantId is available
  useEffect(() => {
    if (resolvedRestId) {
      syncRestaurantShiftConfigFromDb(resolvedRestId).then((fresh) => {
        if (fresh) setConfig(fresh);
      });
    }
  }, [resolvedRestId]);

  // Listen to cross-window and local shift configuration update broadcasts
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail?.config) {
        setConfig(e.detail.config);
      } else {
        setConfig(getRestaurantShiftConfig(resolvedRestId, user));
      }
    };

    window.addEventListener("restaurant_shift_config_updated", handleUpdate);
    return () => {
      window.removeEventListener("restaurant_shift_config_updated", handleUpdate);
    };
  }, [resolvedRestId, user]);

  const shifts = useMemo(() => getEffectiveShiftsList(config), [config]);

  const operatingHours = useMemo(() => {
    return {
      openingTime: config.operatingHours?.openingTime || "10:00 AM",
      closingTime: config.operatingHours?.closingTime || "02:00 AM",
    };
  }, [config]);

  // Derive active shift based on currentTime
  const activeShift = useMemo(() => {
    return findActiveShiftByTime(currentTime, config);
  }, [currentTime, config]);

  // Derive next shift
  const nextShift = useMemo(() => {
    return getNextShift(activeShift, config);
  }, [activeShift, config]);

  // Scheduled end time and grace evaluation
  const {
    currentShiftEndTime,
    currentShiftEndDate,
    graceDeadlineDate,
    minutesRemaining,
    minutesPastEnd,
    is10MinuteWarning,
    isExpired,
    isGraceExpired,
  } = useMemo(() => {
    if (!activeShift) {
      return {
        currentShiftEndTime: "12:00 AM",
        currentShiftEndDate: null,
        graceDeadlineDate: null,
        minutesRemaining: 999,
        minutesPastEnd: 0,
        is10MinuteWarning: false,
        isExpired: false,
        isGraceExpired: false,
      };
    }

    const endFormatted = format24HourTo12Hour(activeShift.end);
    const startMin = parseTimeToMinutes(activeShift.start);
    let endMin = parseTimeToMinutes(activeShift.end);
    if (startMin > 0 && (endMin === 0 || activeShift.end === "24:00" || activeShift.end === "00:00")) {
      endMin = 1440;
    }
    const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes();

    let rem = 0;
    let past = 0;
    let expired = false;

    if (startMin < endMin) {
      if (currentMin >= startMin && currentMin < endMin) {
        rem = endMin - currentMin;
        expired = false;
      } else if (currentMin >= endMin) {
        past = currentMin - endMin;
        expired = true;
      } else {
        rem = 0;
        expired = true;
      }
    } else {
      // overnight shift (e.g. 16:00 to 02:00)
      if (currentMin >= startMin) {
        rem = (1440 - currentMin) + endMin;
        expired = false;
      } else if (currentMin < endMin) {
        rem = endMin - currentMin;
        expired = false;
      } else {
        past = currentMin - endMin;
        expired = true;
      }
    }

    const graceDate = calculateGraceDeadline(activeShift.end, currentTime, 30);
    const graceExp = currentTime.getTime() >= graceDate.getTime();
    const isWarning = !expired && rem <= 10 && rem > 0;

    return {
      currentShiftEndTime: endFormatted,
      currentShiftEndDate: new Date(graceDate.getTime() - 30 * 60 * 1000),
      graceDeadlineDate: graceDate,
      minutesRemaining: rem,
      minutesPastEnd: past,
      is10MinuteWarning: isWarning,
      isExpired: expired,
      isGraceExpired: graceExp,
    };
  }, [activeShift, currentTime]);

  const formatShiftLabel = useCallback((shift: DynamicShiftItem) => {
    return `${shift.name} (${format24HourTo12Hour(shift.start)} – ${format24HourTo12Hour(shift.end)})`;
  }, []);

  const refreshShifts = useCallback(async () => {
    if (resolvedRestId) {
      const fresh = await syncRestaurantShiftConfigFromDb(resolvedRestId);
      if (fresh) {
        setConfig(fresh);
      }
    }
  }, [resolvedRestId]);

  return {
    shifts,
    operatingHours,
    activeShift,
    nextShift,
    currentShiftEndTime,
    currentShiftEndDate,
    graceDeadlineDate,
    minutesRemaining,
    minutesPastEnd,
    is10MinuteWarning,
    isExpired,
    isGraceExpired,
    formatShiftLabel,
    refreshShifts,
    rawConfig: config,
  };
}
