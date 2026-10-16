/**
 * OMNIBITES PLATFORM - SHIFT SCHEDULE & TIME-WINDOW VALIDATION
 * File: lib/shiftSchedule.ts
 *
 * Implements strict operating shift windows:
 * - First Shift (Morning): 08:00 AM – 04:00 PM (08:00 to 16:00)
 * - Second Shift (Evening): 04:00 PM – 12:00 AM (16:00 to 24:00 / 00:00)
 * - Third Shift (Night / Closing): 12:00 AM – 08:00 AM (00:00 to 08:00)
 */

export type ShiftTypeOption =
  | "First Shift (Morning)"
  | "Second Shift (Evening)"
  | "Third Shift (Night / Closing)";

export interface ShiftWindowValidation {
  isValid: boolean;
  assignedShift: ShiftTypeOption | string;
  shiftShortName: string;
  windowLabel: string;
  errorMessage?: string;
  currentHour: number;
  currentMinute: number;
  minutesRemaining: number;
  isWarningWindow: boolean;
  shiftEndLabel: string;
}

export function parseShiftOption(raw?: string | null): ShiftTypeOption | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;
  const str = raw.toLowerCase().trim();
  if (str.includes("morning") || str.includes("first") || str.includes("1st")) {
    return "First Shift (Morning)";
  }
  if (str.includes("evening") || str.includes("second") || str.includes("2nd") || str.includes("rush")) {
    return "Second Shift (Evening)";
  }
  if (str.includes("night") || str.includes("third") || str.includes("3rd") || str.includes("owl") || str.includes("closing")) {
    return "Third Shift (Night / Closing)";
  }
  return null;
}

export function getShiftShortName(shift: ShiftTypeOption): string {
  switch (shift) {
    case "First Shift (Morning)":
      return "First Shift";
    case "Second Shift (Evening)":
      return "Second Shift";
    case "Third Shift (Night / Closing)":
      return "Third Shift";
  }
}

export function getShiftWindowLabel(shift: ShiftTypeOption): string {
  switch (shift) {
    case "First Shift (Morning)":
      return "08:00 AM - 04:00 PM";
    case "Second Shift (Evening)":
      return "04:00 PM - 12:00 AM";
    case "Third Shift (Night / Closing)":
      return "12:00 AM - 08:00 AM";
  }
}

export function getShiftEndLabel(shift: ShiftTypeOption): string {
  switch (shift) {
    case "First Shift (Morning)":
      return "04:00 PM";
    case "Second Shift (Evening)":
      return "12:00 AM";
    case "Third Shift (Night / Closing)":
      return "08:00 AM";
  }
}

export function getNextShiftOption(current?: ShiftTypeOption | string | null): ShiftTypeOption {
  const parsed = parseShiftOption(current);
  switch (parsed) {
    case "First Shift (Morning)":
      return "Second Shift (Evening)";
    case "Second Shift (Evening)":
      return "Third Shift (Night / Closing)";
    case "Third Shift (Night / Closing)":
      return "First Shift (Morning)";
    default:
      return "Second Shift (Evening)";
  }
}

export function getCurrentOperatingShift(date: Date = new Date()): ShiftTypeOption {
  const currentHour = date.getHours();
  if (currentHour >= 8 && currentHour < 16) {
    return "First Shift (Morning)";
  }
  if (currentHour >= 16 && currentHour < 24) {
    return "Second Shift (Evening)";
  }
  return "Third Shift (Night / Closing)";
}

export function evaluateActiveShiftDetails(
  assignedShift?: string | null,
  activeShiftRecord?: any | null,
  date: Date = new Date()
): {
  shiftType: ShiftTypeOption;
  shiftShortName: string;
  windowLabel: string;
  shiftEndLabel: string;
  fullShiftLabel: string;
} {
  const recordShiftType = parseShiftOption(
    activeShiftRecord?.shift_type ||
    (activeShiftRecord?.closing_notes?.includes("Shift:")
      ? activeShiftRecord.closing_notes.split("|")[0].replace("Shift:", "").trim()
      : null)
  );

  const userAssigned = parseShiftOption(assignedShift);
  const timeBased = getCurrentOperatingShift(date);
  const resolved = recordShiftType || userAssigned || timeBased;

  return {
    shiftType: resolved,
    shiftShortName: getShiftShortName(resolved),
    windowLabel: getShiftWindowLabel(resolved),
    shiftEndLabel: getShiftEndLabel(resolved),
    fullShiftLabel: `${resolved} (${getShiftWindowLabel(resolved)})`,
  };
}

/**
 * Helper to recover any cached active open shift for today from browser session/local storage.
 */
export function getStoredActiveShift(): any | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("pos_active_shift_")) {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && isShiftForCurrentDayAndValid(parsed)) {
            return parsed;
          }
        }
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("pos_active_shift_")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && isShiftForCurrentDayAndValid(parsed)) {
            return parsed;
          }
        }
      }
    }
  } catch { }
  return null;
}

/**
 * Returns true if the cashier has successfully transitioned to or started an active consecutive shift segment today.
 */
export function hasActiveConsecutiveShift(activeShift?: any | null, consecutiveCount?: number): boolean {
  const shift = activeShift || getStoredActiveShift();
  if (!shift || !isShiftForCurrentDayAndValid(shift)) return false;

  const count = consecutiveCount ?? (typeof window !== "undefined" ? (() => {
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("pos_consecutive_shift_count_")) {
          const val = parseInt(sessionStorage.getItem(key) || "1", 10);
          if (val > 1) return val;
        }
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("pos_consecutive_shift_count_")) {
          const val = parseInt(localStorage.getItem(key) || "1", 10);
          if (val > 1) return val;
        }
      }
    } catch { }
    return 1;
  })() : 1);

  if (count > 1) return true;

  const typeStr = (shift.shift_type || "").toLowerCase();
  const notesStr = (shift.closing_notes || "").toLowerCase();

  return Boolean(
    typeStr.includes("segment") ||
    notesStr.includes("consecutive") ||
    notesStr.includes("rollover") ||
    /segment\s*#?[2-9]/i.test(typeStr)
  );
}

/**
 * Strict Active Guard:
 * Evaluates whether an expired shift window prompt/modal should actually be shown.
 * Suppresses expired window prompts if the cashier has already transitioned to or started
 * a subsequent consecutive shift segment.
 */
export function isShiftWindowConcluded(
  shiftValidation?: ShiftWindowValidation | null,
  activeShift?: any | null,
  consecutiveCount?: number
): boolean {
  if (!shiftValidation || shiftValidation.isValid) return false;

  const shift = activeShift || getStoredActiveShift();
  if (!shift) {
    // If no active shift exists at all, window is expired
    return true;
  }

  // If active shift is from a previous calendar day, it is stale and requires reconciliation
  if (isShiftFromPreviousDate(shift)) {
    return true;
  }

  // Check if cashier has transitioned to or started an active consecutive shift segment
  if (hasActiveConsecutiveShift(shift, consecutiveCount)) {
    // Determine the consecutive shift's OWN operating window
    const activeShiftType = parseShiftOption(shift.shift_type || shift.closing_notes);
    if (activeShiftType) {
      // Evaluate against the active consecutive shift's window, NOT the baseline original window
      const consecutiveValidation = validateCashierShiftWindow(activeShiftType, new Date(), shift);
      // Only conclude if the consecutive shift segment itself has expired
      return !consecutiveValidation.isValid;
    }
    // If consecutive shift was started and is open, suppress stale prompt for previous window
    return false;
  }

  // Not a consecutive shift: standard expiry check
  return !shiftValidation.isValid;
}

export function validateCashierShiftWindow(
  assignedShiftRaw?: string | null,
  date: Date = new Date(),
  activeShift?: any | null
): ShiftWindowValidation {
  const currentActiveShift = activeShift !== undefined ? activeShift : getStoredActiveShift();
  const isOpenToday = Boolean(currentActiveShift && isShiftForCurrentDayAndValid(currentActiveShift));

  // If cashier holds an open active shift from today with an assigned shift_type (e.g. rolled over consecutive shift),
  // prioritize that active shift segment over the static assignedShift profile
  const activeShiftType = isOpenToday
    ? parseShiftOption(
        currentActiveShift.shift_type ||
        (currentActiveShift.closing_notes?.includes("Shift:")
          ? currentActiveShift.closing_notes.split("|")[0].replace("Shift:", "").trim()
          : null)
      )
    : null;

  const rawToParse = activeShiftType || assignedShiftRaw;
  const parsed = parseShiftOption(rawToParse);
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();
  const totalMinutesNow = currentHour * 60 + currentMinute;

  if (!parsed) {
    return {
      isValid: true,
      assignedShift: rawToParse || "Unassigned",
      shiftShortName: "General Shift",
      windowLabel: "All Operating Hours",
      currentHour,
      currentMinute,
      minutesRemaining: 999,
      isWarningWindow: false,
      shiftEndLabel: "Open",
    };
  }

  const shiftShortName = getShiftShortName(parsed);
  const windowLabel = getShiftWindowLabel(parsed);
  const shiftEndLabel = getShiftEndLabel(parsed);

  let isValid = false;
  let minutesRemaining = 0;

  if (parsed === "First Shift (Morning)") {
    isValid = totalMinutesNow >= 480 && totalMinutesNow < 960; // 08:00 - 16:00
    minutesRemaining = isValid ? (960 - totalMinutesNow) : 0;
  } else if (parsed === "Second Shift (Evening)") {
    isValid = totalMinutesNow >= 960 && totalMinutesNow < 1440; // 16:00 - 24:00
    minutesRemaining = isValid ? (1440 - totalMinutesNow) : 0;
  } else if (parsed === "Third Shift (Night / Closing)") {
    isValid = totalMinutesNow >= 0 && totalMinutesNow < 480; // 00:00 - 08:00
    minutesRemaining = isValid ? (480 - totalMinutesNow) : 0;
  }

  // Grace Period for Active Consecutive Shifts:
  // If the cashier transitioned to this shift slightly early (up to 15 mins prior to official window start)
  // or is currently on an active open consecutive segment started today, recognize valid duty
  if (!isValid && isOpenToday && activeShiftType === parsed) {
    const isConsecutive = hasActiveConsecutiveShift(currentActiveShift);
    if (isConsecutive) {
      // 15-minute early start handover grace:
      if (
        (parsed === "First Shift (Morning)" && totalMinutesNow >= 465 && totalMinutesNow < 480) ||
        (parsed === "Second Shift (Evening)" && totalMinutesNow >= 945 && totalMinutesNow < 960) ||
        (parsed === "Third Shift (Night / Closing)" && totalMinutesNow >= 1425 && totalMinutesNow < 1440)
      ) {
        isValid = true;
        minutesRemaining = 15;
      }
    }
  }

  const isWarningWindow = isValid && minutesRemaining <= 10 && minutesRemaining > 0;

  return {
    isValid,
    assignedShift: parsed,
    shiftShortName,
    windowLabel,
    shiftEndLabel,
    currentHour,
    currentMinute,
    minutesRemaining,
    isWarningWindow,
    errorMessage: isValid
      ? undefined
      : `Access Denied: Your assigned shift is ${shiftShortName} (${windowLabel}). You cannot log in during this shift window.`,
  };
}

/**
 * Universal Staff Shift Window Validation (Cashiers, Waiters, Chefs)
 * Validates whether any staff member is within their scheduled shift hours,
 * accounting for active rolled-over shifts and early start grace periods.
 */
export function validateStaffShiftWindow(
  assignedShiftRaw?: string | null,
  date: Date = new Date(),
  userOrShift?: any | null
): ShiftWindowValidation {
  let activeShift: any = null;
  if (userOrShift && (userOrShift.id || userOrShift.email || userOrShift.staffRole)) {
    const staffKey = String(userOrShift.id || userOrShift.email || userOrShift.name || userOrShift.staffRole)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
    const restId = userOrShift.restaurantId || userOrShift.organizationId || "default";
    const staffRole = userOrShift.staffRole || "staff";

    if (typeof window !== "undefined") {
      try {
        const cachedStr =
          sessionStorage.getItem(`staff_active_shift_${staffKey}`) ||
          localStorage.getItem(`staff_active_shift_${staffKey}`) ||
          sessionStorage.getItem(`staff_active_shift_${restId}_${staffRole}`) ||
          localStorage.getItem(`staff_active_shift_${restId}_${staffRole}`);
        if (cachedStr) {
          activeShift = JSON.parse(cachedStr);
        }
      } catch {}
    }
  } else if (userOrShift !== undefined) {
    activeShift = userOrShift;
  } else {
    activeShift = getStoredActiveShift();
  }

  return validateCashierShiftWindow(assignedShiftRaw, date, activeShift);
}

/**
 * Check if a shift was opened on a prior calendar date (before today 00:00:00).
 */
export function isShiftFromPreviousDate(shift: any): boolean {
  if (!shift) return false;
  const dateStr = shift.shift_start || shift.created_at;
  if (!dateStr) return false;
  const shiftDate = new Date(dateStr);
  if (isNaN(shiftDate.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return shiftDate < todayStart;
}

/**
 * Check if a shift is active and valid for the current calendar day.
 */
export function isShiftForCurrentDayAndValid(shift: any): boolean {
  if (!shift) return false;
  const isOpen =
    shift.status === "OPEN" ||
    shift.status === "active" ||
    (!shift.status && !shift.closed_at && !shift.shift_end);
  if (!isOpen) return false;
  return !isShiftFromPreviousDate(shift);
}

/**
 * Clear all stale cached shift and confirmation keys across sessionStorage and localStorage.
 */
export function clearStaleShiftStorage(currentOrgId?: string, staffKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    const orgs = Array.from(new Set([currentOrgId, "40", "default", "27"].filter(Boolean))) as string[];
    orgs.forEach((org) => {
      sessionStorage.removeItem(`pos_active_shift_${org}`);
      localStorage.removeItem(`pos_active_shift_${org}`);
      sessionStorage.removeItem(`pos_consecutive_shift_count_${org}`);
      localStorage.removeItem(`pos_consecutive_shift_count_${org}`);
    });

    if (staffKey) {
      sessionStorage.removeItem(`pos_session_float_confirmed_${staffKey}`);
      localStorage.removeItem(`pos_session_float_confirmed_${staffKey}`);
      sessionStorage.removeItem(`pos_require_opening_float_${staffKey}`);
      localStorage.removeItem(`pos_require_opening_float_${staffKey}`);
    }

    sessionStorage.removeItem("pos_session_float_confirmed_global");
    localStorage.removeItem("pos_session_float_confirmed_global");
  } catch (e) {
    console.warn("[shiftSchedule] Error clearing stale shift storage:", e);
  }
}

/**
 * Resolves the scheduled end Date for a given shift relative to a reference Date.
 * - Morning Shift: ends at 16:00 (04:00 PM)
 * - Evening Shift: ends at 00:00 (midnight, 12:00 AM)
 * - Night Shift: ends at 08:00 (08:00 AM)
 */
export function getShiftEndDateTime(
  shiftTypeRaw?: ShiftTypeOption | string | null,
  referenceDate: Date = new Date()
): Date | null {
  const parsed = parseShiftOption(shiftTypeRaw);
  if (!parsed) return null;

  const d = new Date(referenceDate);
  const currentTotalMin = d.getHours() * 60 + d.getMinutes();

  if (parsed === "First Shift (Morning)") {
    // 08:00 AM - 04:00 PM (16:00)
    const end = new Date(d);
    if (currentTotalMin < 480) {
      end.setDate(end.getDate() - 1);
    }
    end.setHours(16, 0, 0, 0);
    return end;
  }

  if (parsed === "Second Shift (Evening)") {
    // 04:00 PM - 12:00 AM (24:00 / 00:00)
    const end = new Date(d);
    if (currentTotalMin >= 960) {
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
    } else {
      end.setHours(0, 0, 0, 0);
    }
    return end;
  }

  if (parsed === "Third Shift (Night / Closing)") {
    // 12:00 AM - 08:00 AM (08:00)
    const end = new Date(d);
    if (currentTotalMin >= 960) {
      end.setDate(end.getDate() + 1);
    }
    end.setHours(8, 0, 0, 0);
    return end;
  }

  return null;
}

/**
 * Calculates elapsed minutes since the scheduled shift end time.
 * Returns 0 if the shift has not yet concluded.
 */
export function getMinutesSinceShiftEnd(
  shiftTypeRaw?: ShiftTypeOption | string | null,
  referenceDate: Date = new Date(),
  activeShift?: any | null
): number {
  if (activeShift?.shift_end) {
    const endMs = new Date(activeShift.shift_end).getTime();
    if (!isNaN(endMs)) {
      return Math.max(0, Math.floor((referenceDate.getTime() - endMs) / (60 * 1000)));
    }
  }

  const shiftEnd = getShiftEndDateTime(shiftTypeRaw, referenceDate);
  if (!shiftEnd) return 0;

  const diffMs = referenceDate.getTime() - shiftEnd.getTime();
  if (diffMs <= 0) return 0;

  return Math.floor(diffMs / (60 * 1000));
}

/**
 * 1-Hour Strict Grace Period Rule:
 * Returns true if current time is within 60 minutes of the scheduled shift end.
 * Returns false if more than 60 minutes have elapsed since scheduled shift end.
 */
export function isShiftSnoozeAllowed(
  shiftTypeRaw?: ShiftTypeOption | string | null,
  referenceDate: Date = new Date(),
  activeShift?: any | null,
  maxGraceMinutes: number = 60
): boolean {
  const minutesPast = getMinutesSinceShiftEnd(shiftTypeRaw, referenceDate, activeShift);
  return minutesPast <= maxGraceMinutes;
}


