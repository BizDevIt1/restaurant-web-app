/**
 * OMNIBITES PLATFORM - SHIFT SCHEDULE & TIME-WINDOW VALIDATION
 * File: lib/shiftSchedule.ts
 *
 * Implements flexible, dynamic operating shift windows configured per restaurant:
 * - First Shift (Morning): configurable start/end (default: 08:00 AM – 04:00 PM)
 * - Second Shift (Evening): configurable start/end (default: 04:00 PM – 12:00 AM)
 * - Third Shift (Night / Closing): configurable start/end (default: 12:00 AM – 08:00 AM)
 */

export interface DynamicShiftItem {
  id?: string;
  name: string; // e.g. "Morning Shift", "Evening Shift", "Full Day Shift"
  start: string; // 24-hr format "HH:mm" e.g. "10:00"
  end: string;   // 24-hr format "HH:mm" e.g. "18:00"
  order: number; // 1, 2, 3, 4
  isActive?: boolean;
}

export type ShiftTypeOption =
  | "First Shift (Morning)"
  | "Second Shift (Evening)"
  | "Third Shift (Night / Closing)"
  | string;

export interface ShiftTimingHours {
  name?: string; // Optional custom title e.g. "Morning Shift", "Night Shift"
  start: string; // 24-hr format "HH:mm" e.g. "08:00"
  end: string;   // 24-hr format "HH:mm" e.g. "14:00" or "00:00"
}

export interface RestaurantShiftConfig {
  firstShift: ShiftTimingHours;
  secondShift: ShiftTimingHours;
  thirdShift: ShiftTimingHours;
  shifts?: DynamicShiftItem[];
  operatingHours?: {
    openingTime: string;
    closingTime: string;
  };
}

export const DEFAULT_SHIFT_CONFIG: RestaurantShiftConfig = {
  firstShift: { name: "First Shift", start: "08:00", end: "16:00" },
  secondShift: { name: "Second Shift", start: "16:00", end: "00:00" },
  thirdShift: { name: "Third Shift", start: "00:00", end: "08:00" },
  shifts: [
    { name: "First Shift", start: "08:00", end: "16:00", order: 1, isActive: true },
    { name: "Second Shift", start: "16:00", end: "00:00", order: 2, isActive: true },
    { name: "Third Shift", start: "00:00", end: "08:00", order: 3, isActive: true },
  ],
  operatingHours: {
    openingTime: "08:00 AM",
    closingTime: "12:00 AM",
  },
};

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
  shiftStartTime?: string;
  shiftEndTime?: string;
  graceDeadlineMs?: number;
  isGraceExpired?: boolean;
}

/**
 * Format 24-hour "HH:mm" to 12-hour "hh:mm A" string (e.g. "14:00" -> "02:00 PM")
 */
export function format24HourTo12Hour(timeStr?: string | null): string {
  if (!timeStr || typeof timeStr !== "string") return "08:00 AM";
  const trimmed = timeStr.trim();
  if (trimmed.toUpperCase().includes("AM") || trimmed.toUpperCase().includes("PM")) {
    return trimmed;
  }
  const parts = trimmed.split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
  if (isNaN(hours)) return "08:00 AM";
  const ampm = hours >= 12 && hours < 24 ? "PM" : "AM";
  const modHours = hours % 12 === 0 ? 12 : hours % 12;
  const padHours = String(modHours).padStart(2, "0");
  const padMinutes = String(isNaN(minutes) ? 0 : minutes).padStart(2, "0");
  return `${padHours}:${padMinutes} ${ampm}`;
}

/**
 * Format 12-hour "hh:mm A" or 24-hour time to standardized 24-hour "HH:mm" string
 */
export function format12HourTo24Hour(timeStr?: string | null): string {
  if (!timeStr || typeof timeStr !== "string") return "08:00";
  const trimmed = timeStr.trim().toUpperCase();
  if (!trimmed.includes("AM") && !trimmed.includes("PM")) {
    const parts = trimmed.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (isNaN(h)) return "08:00";
    return `${String(h).padStart(2, "0")}:${String(isNaN(m) ? 0 : m).padStart(2, "0")}`;
  }
  const isPM = trimmed.includes("PM");
  const isAM = trimmed.includes("AM");
  const cleaned = trimmed.replace(/[^\d:]/g, "");
  const parts = cleaned.split(":");
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Converts any time representation into minutes from midnight (0 to 1439).
 */
export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const trimmed = timeStr.trim().toUpperCase();
  const isPM = trimmed.includes("PM");
  const isAM = trimmed.includes("AM");
  const cleaned = trimmed.replace(/[^\d:]/g, "");
  const parts = cleaned.split(":");
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return (hours * 60 + minutes) % 1440;
}

export function normalizeShiftTimingObj(rawTiming: any, fallbackName?: string): ShiftTimingHours | null {
  if (!rawTiming || typeof rawTiming !== "object") return null;
  const start = rawTiming.start || rawTiming.opening || rawTiming.startTime;
  const end = rawTiming.end || rawTiming.closing || rawTiming.endTime;
  const name = rawTiming.name || rawTiming.title || rawTiming.shift_name || rawTiming.label || fallbackName;
  if (!start || !end) return null;
  return {
    name: name ? String(name).trim() : fallbackName,
    start: format12HourTo24Hour(String(start)),
    end: format12HourTo24Hour(String(end)),
  };
}

export function getEffectiveShiftsList(
  config?: RestaurantShiftConfig | null
): DynamicShiftItem[] {
  const cfg = config || (typeof window !== "undefined" ? getRestaurantShiftConfig() : DEFAULT_SHIFT_CONFIG);
  if (cfg.shifts && Array.isArray(cfg.shifts) && cfg.shifts.length > 0) {
    return [...cfg.shifts]
      .filter((s) => s.isActive !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  return [
    {
      name: cfg.firstShift?.name || "First Shift",
      start: cfg.firstShift?.start || "08:00",
      end: cfg.firstShift?.end || "16:00",
      order: 1,
      isActive: true,
    },
    {
      name: cfg.secondShift?.name || "Second Shift",
      start: cfg.secondShift?.start || "16:00",
      end: cfg.secondShift?.end || "00:00",
      order: 2,
      isActive: true,
    },
    {
      name: cfg.thirdShift?.name || "Third Shift",
      start: cfg.thirdShift?.start || "00:00",
      end: cfg.thirdShift?.end || "08:00",
      order: 3,
      isActive: true,
    },
  ];
}

export function parseRestaurantShiftConfig(raw: any): RestaurantShiftConfig | null {
  if (!raw || typeof raw !== "object") return null;

  // 1. Check for dynamic shifts array
  const rawShiftsArray = Array.isArray(raw.shifts)
    ? raw.shifts
    : Array.isArray(raw.shift_timings?.shifts)
    ? raw.shift_timings.shifts
    : null;

  let parsedShifts: DynamicShiftItem[] | undefined = undefined;
  if (rawShiftsArray && rawShiftsArray.length > 0) {
    parsedShifts = rawShiftsArray.map((s: any, idx: number) => ({
      id: s.id ? String(s.id) : undefined,
      name: String(s.name || s.shift_name || s.title || `Shift ${idx + 1}`).trim(),
      start: format12HourTo24Hour(s.start || s.start_time || s.opening),
      end: format12HourTo24Hour(s.end || s.end_time || s.closing),
      order: s.order !== undefined ? Number(s.order) : s.sort_order !== undefined ? Number(s.sort_order) : idx + 1,
      isActive: s.isActive !== undefined ? Boolean(s.isActive) : s.is_active !== undefined ? Boolean(s.is_active) : true,
    }));
  }

  // 2. Backward compatibility with first_shift, second_shift, third_shift
  const first = parsedShifts && parsedShifts[0]
    ? { name: parsedShifts[0].name, start: parsedShifts[0].start, end: parsedShifts[0].end }
    : normalizeShiftTimingObj(raw.first_shift || raw.firstShift, "First Shift");

  const second = parsedShifts && parsedShifts[1]
    ? { name: parsedShifts[1].name, start: parsedShifts[1].start, end: parsedShifts[1].end }
    : normalizeShiftTimingObj(raw.second_shift || raw.secondShift, "Second Shift");

  const third = parsedShifts && parsedShifts[2]
    ? { name: parsedShifts[2].name, start: parsedShifts[2].start, end: parsedShifts[2].end }
    : normalizeShiftTimingObj(raw.third_shift || raw.thirdShift, "Third Shift");

  const rawHours = raw.operating_hours || raw.operatingHours || raw.shift_timings?.operating_hours;
  const operatingHours = rawHours
    ? {
        openingTime: format24HourTo12Hour(rawHours.opening_time || rawHours.openingTime || raw.opening_time || raw.openingTime || "08:00 AM"),
        closingTime: format24HourTo12Hour(rawHours.closing_time || rawHours.closingTime || raw.closing_time || raw.closingTime || "12:00 AM"),
      }
    : (raw.opening_time || raw.openingTime || raw.closing_time || raw.closingTime)
    ? {
        openingTime: format24HourTo12Hour(raw.opening_time || raw.openingTime || "08:00 AM"),
        closingTime: format24HourTo12Hour(raw.closing_time || raw.closingTime || "12:00 AM"),
      }
    : DEFAULT_SHIFT_CONFIG.operatingHours;

  if (first || second || third || (parsedShifts && parsedShifts.length > 0)) {
    return {
      firstShift: first || DEFAULT_SHIFT_CONFIG.firstShift,
      secondShift: second || DEFAULT_SHIFT_CONFIG.secondShift,
      thirdShift: third || DEFAULT_SHIFT_CONFIG.thirdShift,
      shifts: parsedShifts,
      operatingHours,
    };
  }
  return null;
}

export interface ShiftOperatingHoursValidation {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates that a shift's start and end times fall strictly within the restaurant's operational hours window.
 * Supports both same-day (e.g. 09:00 AM - 11:00 PM) and overnight (e.g. 11:00 AM - 02:00 AM) restaurant hours.
 */
export function validateShiftWithinOperatingHours(
  shiftStartStr?: string | null,
  shiftEndStr?: string | null,
  openTimeStr?: string | null,
  closeTimeStr?: string | null,
  shiftLabel?: string
): ShiftOperatingHoursValidation {
  if (!shiftStartStr || !shiftEndStr) {
    return { isValid: false, reason: `${shiftLabel || "Shift"}: Start and end times are required.` };
  }
  if (!openTimeStr || !closeTimeStr) {
    return { isValid: true };
  }

  const openMin = parseTimeToMinutes(openTimeStr);
  const closeMin = parseTimeToMinutes(closeTimeStr);
  const shiftStartMin = parseTimeToMinutes(shiftStartStr);
  const shiftEndMin = parseTimeToMinutes(shiftEndStr);

  const formattedOpen = format24HourTo12Hour(openTimeStr);
  const formattedClose = format24HourTo12Hour(closeTimeStr);
  const formattedStart = format24HourTo12Hour(shiftStartStr);
  const formattedEnd = format24HourTo12Hour(shiftEndStr);
  const label = shiftLabel ? `"${shiftLabel}"` : "Shift";

  const operatingDuration = openMin === closeMin ? 1440 : (closeMin - openMin + 1440) % 1440;
  const startOffset = (shiftStartMin - openMin + 1440) % 1440;
  const shiftDuration = (shiftEndMin - shiftStartMin + 1440) % 1440;

  if (shiftDuration === 0) {
    return {
      isValid: false,
      reason: `${label}: Start time (${formattedStart}) and end time (${formattedEnd}) cannot be identical.`,
    };
  }

  if (startOffset > operatingDuration) {
    return {
      isValid: false,
      reason: `${label}: Start time (${formattedStart}) is outside restaurant operational hours (${formattedOpen} – ${formattedClose}).`,
    };
  }

  if (startOffset + shiftDuration > operatingDuration) {
    return {
      isValid: false,
      reason: `${label}: End time (${formattedEnd}) exceeds restaurant operational closing time (${formattedClose}).`,
    };
  }

  return { isValid: true };
}

/**
 * Resolves the active restaurant's shift timings config from user context, local cache, or defaults.
 */
export function getRestaurantShiftConfig(
  restaurantId?: string | number | null,
  userOrSettings?: any | null
): RestaurantShiftConfig {
  // 1. Inspect direct user/branch object if provided
  if (userOrSettings) {
    if (userOrSettings.branches && Array.isArray(userOrSettings.branches) && userOrSettings.branches[0]?.shift_timings) {
      const parsed = parseRestaurantShiftConfig(userOrSettings.branches[0].shift_timings);
      if (parsed) return parsed;
    }
    if (userOrSettings.shift_timings || userOrSettings.shiftTimings) {
      const parsed = parseRestaurantShiftConfig(userOrSettings.shift_timings || userOrSettings.shiftTimings);
      if (parsed) return parsed;
    }
  }

  // 2. Check browser localStorage
  if (typeof window !== "undefined") {
    try {
      const targetId = restaurantId ? String(restaurantId) : undefined;
      const keysToTry = [
        targetId ? `restaurant_shift_config_${targetId}` : null,
        "restaurant_shift_config_current",
      ].filter(Boolean) as string[];

      for (const key of keysToTry) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = parseRestaurantShiftConfig(JSON.parse(stored));
          if (parsed) return parsed;
        }
      }

      // Check all keys matching restaurant_shift_config_* if targetId was missing or not matched
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("restaurant_shift_config_")) {
          try {
            const stored = localStorage.getItem(k);
            if (stored) {
              const parsed = parseRestaurantShiftConfig(JSON.parse(stored));
              if (parsed) return parsed;
            }
          } catch {}
        }
      }

      // Check active user session stored in localStorage or sessionStorage
      for (const storage of [localStorage, sessionStorage]) {
        for (const sessionKey of ["pos_auth_user", "active_user_session", "admin_user_session"]) {
          const raw = storage.getItem(sessionKey);
          if (raw) {
            const user = JSON.parse(raw);
            if (user?.branches?.[0]?.shift_timings) {
              const parsed = parseRestaurantShiftConfig(user.branches[0].shift_timings);
              if (parsed) return parsed;
            }
            if (user?.shift_timings || user?.shiftTimings) {
              const parsed = parseRestaurantShiftConfig(user.shift_timings || user.shiftTimings);
              if (parsed) return parsed;
            }
          }
        }
      }
    } catch {}
  }

  return DEFAULT_SHIFT_CONFIG;
}

/**
 * Live async synchronizer: fetches the restaurant's operational shift timings from Supabase
 * and caches them locally so all terminal validations immediately follow the admin's timings.
 */
export async function syncRestaurantShiftConfigFromDb(
  restaurantId?: string | number | null
): Promise<RestaurantShiftConfig | null> {
  if (typeof window === "undefined" || !restaurantId) return null;
  try {
    const numericRestId = typeof restaurantId === "number"
      ? restaurantId
      : parseInt(String(restaurantId).replace(/[^0-9]/g, ""), 10);
    if (!numericRestId) return null;

    const { createClient } = await import("@/lib/supabase");
    const supabase = createClient();

    // 1. Try querying public.restaurant_shifts table first
    let dynamicShifts: DynamicShiftItem[] | null = null;
    try {
      const { data: dbShifts, error: shiftErr } = await supabase
        .from("restaurant_shifts")
        .select("*")
        .eq("restaurant_id", numericRestId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!shiftErr && Array.isArray(dbShifts) && dbShifts.length > 0) {
        dynamicShifts = dbShifts.map((row) => ({
          id: row.id,
          name: row.shift_name,
          start: format12HourTo24Hour(row.start_time),
          end: format12HourTo24Hour(row.end_time),
          order: row.sort_order,
          isActive: row.is_active,
        }));
      }
    } catch {}

    // 2. Query public.restaurants branches column
    const { data: restData } = await supabase
      .from("restaurants")
      .select("branches")
      .eq("id", numericRestId)
      .maybeSingle();

    const branchTimings = restData?.branches?.[0]?.shift_timings;
    const parsed = parseRestaurantShiftConfig(branchTimings);

    if (dynamicShifts && dynamicShifts.length > 0) {
      const mergedConfig: RestaurantShiftConfig = {
        firstShift: { name: dynamicShifts[0].name, start: dynamicShifts[0].start, end: dynamicShifts[0].end },
        secondShift: dynamicShifts[1]
          ? { name: dynamicShifts[1].name, start: dynamicShifts[1].start, end: dynamicShifts[1].end }
          : { name: "Second Shift", start: "16:00", end: "00:00" },
        thirdShift: dynamicShifts[2]
          ? { name: dynamicShifts[2].name, start: dynamicShifts[2].start, end: dynamicShifts[2].end }
          : { name: "Third Shift", start: "00:00", end: "08:00" },
        shifts: dynamicShifts,
        operatingHours: parsed?.operatingHours,
      };
      saveRestaurantShiftConfig(restaurantId, mergedConfig);
      return mergedConfig;
    }

    if (parsed) {
      saveRestaurantShiftConfig(restaurantId, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn("[shiftSchedule] syncRestaurantShiftConfigFromDb error:", err);
  }
  return null;
}

/**
 * Persists the configured shift timings to localStorage and broadcasts update events across tabs/windows.
 */
export function saveRestaurantShiftConfig(
  restaurantId: string | number,
  config: RestaurantShiftConfig
): void {
  if (typeof window === "undefined") return;
  try {
    const shiftsList = getEffectiveShiftsList(config);
    const enrichedConfig: RestaurantShiftConfig = {
      ...config,
      shifts: shiftsList,
      firstShift: shiftsList[0] ? { name: shiftsList[0].name, start: shiftsList[0].start, end: shiftsList[0].end } : config.firstShift,
      secondShift: shiftsList[1] ? { name: shiftsList[1].name, start: shiftsList[1].start, end: shiftsList[1].end } : config.secondShift,
      thirdShift: shiftsList[2] ? { name: shiftsList[2].name, start: shiftsList[2].start, end: shiftsList[2].end } : config.thirdShift,
    };

    const serialized = JSON.stringify(enrichedConfig);
    const restIdStr = String(restaurantId);
    localStorage.setItem(`restaurant_shift_config_${restIdStr}`, serialized);
    localStorage.setItem("restaurant_shift_config_current", serialized);

    // Update pos_auth_user cache in localStorage
    const rawSession = localStorage.getItem("pos_auth_user");
    if (rawSession) {
      try {
        const sessionUser = JSON.parse(rawSession);
        if (sessionUser && sessionUser.branches && sessionUser.branches.length > 0) {
          sessionUser.branches[0].shift_timings = {
            first_shift: enrichedConfig.firstShift,
            second_shift: enrichedConfig.secondShift,
            third_shift: enrichedConfig.thirdShift,
            shifts: shiftsList,
            operating_hours: enrichedConfig.operatingHours,
          };
          localStorage.setItem("pos_auth_user", JSON.stringify(sessionUser));
        }
      } catch {}
    }

    // Broadcast event across UI
    window.dispatchEvent(
      new CustomEvent("restaurant_shift_config_updated", {
        detail: { restaurantId: restIdStr, config: enrichedConfig },
      })
    );

    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel("restaurant_shift_sync");
        bc.postMessage({ type: "SHIFT_CONFIG_UPDATED", restaurantId: restIdStr, config: enrichedConfig });
        bc.close();
      } catch {}
    }
  } catch (err) {
    console.warn("[shiftSchedule] Failed to save shift config to localStorage:", err);
  }
}

export function findActiveShiftByTime(
  date: Date = new Date(),
  customConfig?: RestaurantShiftConfig | null
): DynamicShiftItem | null {
  const cfg = customConfig || (typeof window !== "undefined" ? getRestaurantShiftConfig() : DEFAULT_SHIFT_CONFIG);
  const shifts = getEffectiveShiftsList(cfg);
  if (shifts.length === 0) return null;

  const currentTotalMin = date.getHours() * 60 + date.getMinutes();
  for (const s of shifts) {
    if (isTimeWithinWindow(currentTotalMin, s.start, s.end)) {
      return s;
    }
  }
  return shifts[0];
}

export function getNextShift(
  currentShiftNameOrObj?: string | DynamicShiftItem | null,
  customConfig?: RestaurantShiftConfig | null
): DynamicShiftItem {
  const cfg = customConfig || (typeof window !== "undefined" ? getRestaurantShiftConfig() : DEFAULT_SHIFT_CONFIG);
  const shifts = getEffectiveShiftsList(cfg);
  if (shifts.length === 0) {
    return { name: "First Shift", start: "08:00", end: "16:00", order: 1 };
  }
  if (!currentShiftNameOrObj) {
    return shifts[0];
  }
  const currentStr = typeof currentShiftNameOrObj === "string"
    ? currentShiftNameOrObj.toLowerCase().trim()
    : (currentShiftNameOrObj.name || "").toLowerCase().trim();

  const idx = shifts.findIndex(
    (s) => s.name.toLowerCase().trim() === currentStr || currentStr.includes(s.name.toLowerCase().trim())
  );

  if (idx === -1) {
    return shifts[0];
  }
  const nextIdx = (idx + 1) % shifts.length;
  return shifts[nextIdx];
}

export function parseShiftOption(
  raw?: string | null,
  customConfig?: RestaurantShiftConfig | null
): ShiftTypeOption | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;
  const str = raw.toLowerCase().trim();
  const cfg = customConfig || (typeof window !== "undefined" ? getRestaurantShiftConfig() : null);
  const shifts = getEffectiveShiftsList(cfg);

  for (const s of shifts) {
    const sName = s.name.toLowerCase().trim();
    if (str === sName || str.includes(sName)) {
      return s.name;
    }
  }

  if (str.includes("morning") || str.includes("first") || str.includes("1st") || str.includes("breakfast") || str.includes("subah")) {
    return shifts[0]?.name || "First Shift (Morning)";
  }
  if (str.includes("evening") || str.includes("second") || str.includes("2nd") || str.includes("rush") || str.includes("shaam")) {
    return shifts[1]?.name || "Second Shift (Evening)";
  }
  if (str.includes("night") || str.includes("third") || str.includes("3rd") || str.includes("owl") || str.includes("closing") || str.includes("raat")) {
    return shifts[2]?.name || "Third Shift (Night / Closing)";
  }
  return shifts[0]?.name || null;
}

export function getShiftShortName(
  shift: ShiftTypeOption,
  customConfig?: RestaurantShiftConfig | null
): string {
  const cfg = customConfig || (typeof window !== "undefined" ? getRestaurantShiftConfig() : null);
  const shifts = getEffectiveShiftsList(cfg);
  const str = String(shift || "").toLowerCase().trim();

  const matched = shifts.find(
    (s) => s.name.toLowerCase().trim() === str || str.includes(s.name.toLowerCase().trim())
  );
  if (matched?.name) {
    return matched.name;
  }
  return String(shift);
}

export function getShiftDisplayName(
  shift: ShiftTypeOption,
  customConfig?: RestaurantShiftConfig | null
): string {
  return getShiftShortName(shift, customConfig);
}

export function getShiftTimingForType(
  shift: ShiftTypeOption,
  config?: RestaurantShiftConfig | null
): ShiftTimingHours {
  const cfg = config || getRestaurantShiftConfig();
  const shifts = getEffectiveShiftsList(cfg);
  const str = String(shift || "").toLowerCase().trim();

  const matched = shifts.find(
    (s) => s.name.toLowerCase().trim() === str || str.includes(s.name.toLowerCase().trim())
  );
  if (matched) {
    return { name: matched.name, start: matched.start, end: matched.end };
  }
  return {
    name: shifts[0]?.name || "First Shift",
    start: shifts[0]?.start || "08:00",
    end: shifts[0]?.end || "16:00",
  };
}

export function getShiftWindowLabel(
  shift: ShiftTypeOption,
  customConfig?: RestaurantShiftConfig | null
): string {
  const timing = getShiftTimingForType(shift, customConfig);
  return `${format24HourTo12Hour(timing.start)} - ${format24HourTo12Hour(timing.end)}`;
}

export function getShiftStartLabel(
  shift: ShiftTypeOption | null,
  customConfig?: RestaurantShiftConfig | null
): string {
  if (!shift) return "08:00 AM";
  const timing = getShiftTimingForType(shift, customConfig);
  return format24HourTo12Hour(timing.start);
}

export function getShiftEndLabel(
  shift: ShiftTypeOption,
  customConfig?: RestaurantShiftConfig | null
): string {
  const timing = getShiftTimingForType(shift, customConfig);
  return format24HourTo12Hour(timing.end);
}

export function getNextShiftOption(
  current?: ShiftTypeOption | string | null,
  customConfig?: RestaurantShiftConfig | null
): ShiftTypeOption {
  return getNextShift(current, customConfig).name;
}

export function calculateGraceDeadline(
  shiftEndStr: string,
  referenceDate: Date = new Date(),
  graceMinutes: number = 30
): Date {
  const endMin = parseTimeToMinutes(shiftEndStr);
  const deadline = new Date(referenceDate);
  const endHours = Math.floor(endMin / 60);
  const endMinutes = endMin % 60;
  deadline.setHours(endHours, endMinutes, 0, 0);

  // If shift crosses midnight and end is earlier in day compared to reference, adjust day
  if (deadline.getTime() < referenceDate.getTime() - 12 * 60 * 60 * 1000) {
    deadline.setDate(deadline.getDate() + 1);
  }

  deadline.setTime(deadline.getTime() + graceMinutes * 60 * 1000);
  return deadline;
}

export function isTimeWithinWindow(currentTotalMin: number, startStr: string, endStr: string): boolean {
  const startMin = parseTimeToMinutes(startStr);
  let endMin = parseTimeToMinutes(endStr);
  const isMidnight = endMin === 0 || endStr === "24:00" || endStr === "00:00";
  if (startMin > 0 && isMidnight) {
    endMin = 1440;
  }

  if (startMin < endMin) {
    return currentTotalMin >= startMin && currentTotalMin < endMin;
  } else {
    // Overnight window crossing midnight
    return currentTotalMin >= startMin || currentTotalMin < endMin;
  }
}

export function getCurrentOperatingShift(
  date: Date = new Date(),
  customConfig?: RestaurantShiftConfig | null
): ShiftTypeOption {
  const cfg = customConfig || getRestaurantShiftConfig();
  const currentTotalMin = date.getHours() * 60 + date.getMinutes();

  if (isTimeWithinWindow(currentTotalMin, cfg.firstShift.start, cfg.firstShift.end)) {
    return "First Shift (Morning)";
  }
  if (isTimeWithinWindow(currentTotalMin, cfg.secondShift.start, cfg.secondShift.end)) {
    return "Second Shift (Evening)";
  }
  if (isTimeWithinWindow(currentTotalMin, cfg.thirdShift.start, cfg.thirdShift.end)) {
    return "Third Shift (Night / Closing)";
  }
  return "First Shift (Morning)";
}

export function evaluateActiveShiftDetails(
  assignedShift?: string | null,
  activeShiftRecord?: any | null,
  date: Date = new Date(),
  customConfig?: RestaurantShiftConfig | null
): {
  shiftType: ShiftTypeOption;
  shiftShortName: string;
  windowLabel: string;
  shiftEndLabel: string;
  fullShiftLabel: string;
} {
  const cfg = customConfig || getRestaurantShiftConfig();
  const recordShiftType = parseShiftOption(
    activeShiftRecord?.shift_type ||
    (activeShiftRecord?.closing_notes?.includes("Shift:")
      ? activeShiftRecord.closing_notes.split("|")[0].replace("Shift:", "").trim()
      : null)
  );

  const userAssigned = parseShiftOption(assignedShift);
  const timeBased = getCurrentOperatingShift(date, cfg);
  const resolved = recordShiftType || userAssigned || timeBased;

  return {
    shiftType: resolved,
    shiftShortName: getShiftShortName(resolved),
    windowLabel: getShiftWindowLabel(resolved, cfg),
    shiftEndLabel: getShiftEndLabel(resolved, cfg),
    fullShiftLabel: `${resolved} (${getShiftWindowLabel(resolved, cfg)})`,
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
  activeShift?: any | null,
  customConfig?: RestaurantShiftConfig | null
): ShiftWindowValidation {
  const restId = activeShift?.restaurant_id || activeShift?.restaurantId;
  const cfg = customConfig || getRestaurantShiftConfig(restId, activeShift);
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
  const windowLabel = getShiftWindowLabel(parsed, cfg);
  const shiftEndLabel = getShiftEndLabel(parsed, cfg);
  const timing = getShiftTimingForType(parsed, cfg);

  const startMin = parseTimeToMinutes(timing.start);
  let endMin = parseTimeToMinutes(timing.end);
  const isMidnight = endMin === 0 || timing.end === "24:00" || timing.end === "00:00";
  if (startMin > 0 && isMidnight) {
    endMin = 1440;
  }

  let isValid = false;
  let minutesRemaining = 0;

  if (startMin < endMin) {
    isValid = totalMinutesNow >= startMin && totalMinutesNow < endMin;
    minutesRemaining = isValid ? (endMin - totalMinutesNow) : 0;
  } else {
    // Overnight window crossing midnight
    isValid = totalMinutesNow >= startMin || totalMinutesNow < endMin;
    if (isValid) {
      if (totalMinutesNow >= startMin) {
        minutesRemaining = (1440 - totalMinutesNow) + endMin;
      } else {
        minutesRemaining = endMin - totalMinutesNow;
      }
    } else {
      minutesRemaining = 0;
    }
  }

  // Grace Period for Active Consecutive Shifts:
  // If the cashier transitioned to this shift slightly early (up to 15 mins prior to official window start)
  // or is currently on an active open consecutive segment started today, recognize valid duty
  if (!isValid && isOpenToday && activeShiftType === parsed) {
    const isConsecutive = hasActiveConsecutiveShift(currentActiveShift);
    if (isConsecutive) {
      // 15-minute early start handover grace:
      const isEarly = startMin >= 15
        ? (totalMinutesNow >= startMin - 15 && totalMinutesNow < startMin)
        : (totalMinutesNow >= 1440 - (15 - startMin) || totalMinutesNow < startMin);
      if (isEarly) {
        isValid = true;
        minutesRemaining = 15;
      }
    }
  }

  const isWarningWindow = isValid && minutesRemaining <= 10 && minutesRemaining > 0;
  const graceDeadline = calculateGraceDeadline(timing.end, date, 30);
  const isGraceExpired = !isValid && date.getTime() >= graceDeadline.getTime();

  return {
    isValid,
    assignedShift: parsed,
    shiftShortName,
    windowLabel,
    shiftEndLabel,
    shiftStartTime: format24HourTo12Hour(timing.start),
    shiftEndTime: format24HourTo12Hour(timing.end),
    graceDeadlineMs: graceDeadline.getTime(),
    isGraceExpired,
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
  userOrShift?: any | null,
  customConfig?: RestaurantShiftConfig | null
): ShiftWindowValidation {
  let activeShift: any = null;
  const cfg = customConfig || getRestaurantShiftConfig(
    userOrShift?.restaurantId || userOrShift?.organizationId,
    userOrShift
  );

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

  return validateCashierShiftWindow(assignedShiftRaw, date, activeShift, cfg);
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
 * Dynamically resolves according to the restaurant's configured shift timing hours.
 */
export function getShiftEndDateTime(
  shiftTypeRaw?: ShiftTypeOption | string | null,
  referenceDate: Date = new Date(),
  customConfig?: RestaurantShiftConfig | null
): Date | null {
  const parsed = parseShiftOption(shiftTypeRaw);
  if (!parsed) return null;

  const cfg = customConfig || getRestaurantShiftConfig();
  const timing = getShiftTimingForType(parsed, cfg);

  const startMin = parseTimeToMinutes(timing.start);
  let endMin = parseTimeToMinutes(timing.end);
  const isMidnight = endMin === 0 || timing.end === "24:00" || timing.end === "00:00";
  if (startMin > 0 && isMidnight) {
    endMin = 1440;
  }

  const d = new Date(referenceDate);
  const currentTotalMin = d.getHours() * 60 + d.getMinutes();

  const endHour = Math.floor(endMin / 60) % 24;
  const endMinute = endMin % 60;

  const result = new Date(d);
  result.setSeconds(0, 0);

  if (startMin < endMin) {
    if (endMin === 1440) {
      if (currentTotalMin >= startMin) {
        result.setDate(result.getDate() + 1);
        result.setHours(0, 0, 0, 0);
      } else {
        result.setHours(0, 0, 0, 0);
      }
    } else {
      if (currentTotalMin < startMin - 180) {
        result.setDate(result.getDate() - 1);
      }
      result.setHours(endHour, endMinute, 0, 0);
    }
    return result;
  } else {
    // Overnight shift crossing midnight
    if (currentTotalMin >= startMin) {
      result.setDate(result.getDate() + 1);
      result.setHours(endHour, endMinute, 0, 0);
    } else {
      result.setHours(endHour, endMinute, 0, 0);
    }
    return result;
  }
}

/**
 * Calculates elapsed minutes since the scheduled shift end time.
 * Returns 0 if the shift has not yet concluded.
 */
export function getMinutesSinceShiftEnd(
  shiftTypeRaw?: ShiftTypeOption | string | null,
  referenceDate: Date = new Date(),
  activeShift?: any | null,
  customConfig?: RestaurantShiftConfig | null
): number {
  if (activeShift?.shift_end) {
    const endMs = new Date(activeShift.shift_end).getTime();
    if (!isNaN(endMs)) {
      return Math.max(0, Math.floor((referenceDate.getTime() - endMs) / (60 * 1000)));
    }
  }

  const shiftEnd = getShiftEndDateTime(shiftTypeRaw, referenceDate, customConfig);
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
  maxGraceMinutes: number = 60,
  customConfig?: RestaurantShiftConfig | null
): boolean {
  const minutesPast = getMinutesSinceShiftEnd(shiftTypeRaw, referenceDate, activeShift, customConfig);
  return minutesPast <= maxGraceMinutes;
}
