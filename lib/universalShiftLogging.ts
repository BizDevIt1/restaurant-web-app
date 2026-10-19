import { createClient } from "./supabase";
import { getValidTenantContext } from "./tenantResolver";
import {
  parseShiftOption,
  getShiftShortName,
  getShiftWindowLabel,
  getCurrentOperatingShift,
  isShiftFromPreviousDate,
  clearStaleShiftStorage,
} from "./shiftSchedule";

export type StaffRoleType = "cashier" | "waiter" | "chef" | "manager" | "staff";

export interface UniversalShiftRecord {
  id: string;
  restaurant_id: string | number;
  branch_id?: string | number | null;
  cashier_name: string;
  cashier_id?: string | null;
  staff_role: StaffRoleType;
  shift_type?: string | null;
  shift_start: string;
  shift_end?: string | null;
  opening_float?: number | null;
  system_cash_sales?: number | null;
  system_card_sales?: number | null;
  system_digital_sales?: number | null;
  gross_sales?: number | null;
  actual_cash_counted?: number | null;
  cash_variance?: number | null;
  status: "OPEN" | "CLOSED" | "FLAGGED";
  closing_notes?: string | null;
  created_at: string;
  terminal_label?: string;
}

/**
 * Infer or normalize a staff role string into standard StaffRoleType
 */
export function normalizeStaffRole(rawRole?: string | null, rawTerminal?: string | null, rawName?: string | null): StaffRoleType {
  const combined = `${rawRole || ""} ${rawTerminal || ""} ${rawName || ""}`.toLowerCase();
  if (combined.includes("waiter") || combined.includes("server") || combined.includes("floor")) {
    return "waiter";
  }
  if (combined.includes("chef") || combined.includes("cook") || combined.includes("kitchen") || combined.includes("kds")) {
    return "chef";
  }
  if (combined.includes("manager") || combined.includes("supervisor") || combined.includes("admin")) {
    return "manager";
  }
  return "cashier";
}

/**
 * Extract role from record fields, closing notes tag, or username
 */
export function extractRoleFromShiftRecord(record: any): StaffRoleType {
  if (record.staff_role) {
    return normalizeStaffRole(record.staff_role);
  }
  if (record.role) {
    return normalizeStaffRole(record.role);
  }
  const notes = String(record.closing_notes || "");
  const tagMatch = notes.match(/\[ROLE:\s*([A-Za-z]+)\]/i);
  if (tagMatch) {
    return normalizeStaffRole(tagMatch[1]);
  }
  return normalizeStaffRole(undefined, record.terminal_label || record.counter_name, record.cashier_name);
}

/**
 * Record a shift session opening for any staff member (Cashier, Waiter, Chef, Manager)
 */
export async function recordStaffShiftLogin(
  user: any,
  options?: {
    shiftType?: string;
    openingFloat?: number;
    notes?: string;
    station?: string;
  }
): Promise<UniversalShiftRecord | null> {
  if (!user) return null;

  try {
    const supabase = createClient();
    const { restId } = await getValidTenantContext(user);
    if (!restId) return null;

    const numericRestId = !isNaN(Number(restId)) ? Number(restId) : restId;
    const branchId = user.branchId;
    const numericBranchId =
      typeof branchId === "number" && branchId > 0
        ? branchId
        : /^\d+$/.test(String(branchId || ""))
        ? parseInt(String(branchId), 10)
        : null;

    const rawRole = (user.staffRole || user.role || "").toLowerCase();
    const staffRole = normalizeStaffRole(rawRole, user.terminalAccess, user.name);
    const staffName = user.name || user.email || `${staffRole.toUpperCase()} User`;
    const staffKey = String(user.id || user.email || user.name || staffRole)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");

    // Determine shift window designation
    let resolvedShift = options?.shiftType || user.assignedShift;
    if (!resolvedShift) {
      resolvedShift = getCurrentOperatingShift(new Date());
    }

    const isFinancialRole = staffRole === "cashier";
    const floatAmount = isFinancialRole ? Number(options?.openingFloat || 0) : 0;
    const nowIso = new Date().toISOString();

    const roleTag = `[ROLE: ${staffRole.toUpperCase()}]`;
    const closingNoteText = `${roleTag} Shift: ${resolvedShift}${options?.notes ? " | " + options.notes : ""}`;

    // Close any prior unclosed shifts for this staff member to prevent stuck OPEN / ACTIVE statuses
    try {
      const { data: priorOpenShifts } = await supabase
        .from("shift_settlements")
        .select("id")
        .eq("restaurant_id", numericRestId)
        .eq("status", "OPEN")
        .or(`cashier_name.eq.${staffName},cashier_name.eq.${user.email || staffName}`);

      if (priorOpenShifts && priorOpenShifts.length > 0) {
        const priorIds = priorOpenShifts.map((s: any) => s.id);
        await supabase
          .from("shift_settlements")
          .update({
            status: "CLOSED",
            shift_end: nowIso,
            closed_at: nowIso,
            closing_notes: `Auto-closed prior unclosed segment on new login at ${new Date().toLocaleTimeString()}`,
          })
          .in("id", priorIds);
      }
    } catch (cleanErr) {
      console.warn("[universalShiftLogging] Warning auto-closing prior open shifts:", cleanErr);
    }

    const primaryPayload: any = {
      restaurant_id: numericRestId,
      cashier_name: staffName,
      shift_start: nowIso,
      opening_float: floatAmount,
      actual_cash_counted: 0,
      gross_sales: 0,
      status: "OPEN",
      staff_role: staffRole,
      shift_type: resolvedShift,
      closing_notes: closingNoteText,
      created_at: nowIso,
    };

    if (numericBranchId) {
      primaryPayload.branch_id = numericBranchId;
    }

    let { data, error } = await supabase
      .from("shift_settlements")
      .insert([primaryPayload])
      .select()
      .single();

    // Fallback if staff_role or shift_type column is missing from schema
    if (error && (error.code === "PGRST204" || error.code === "42703" || error.message?.includes("column"))) {
      console.warn("[universalShiftLogging] Schema fallback for shift insert:", error.message);
      delete primaryPayload.staff_role;
      let retry = await supabase
        .from("shift_settlements")
        .insert([primaryPayload])
        .select()
        .single();

      if (retry.error && (retry.error.code === "PGRST204" || retry.error.message?.includes("shift_type"))) {
        delete primaryPayload.shift_type;
        retry = await supabase
          .from("shift_settlements")
          .insert([primaryPayload])
          .select()
          .single();
      }
      data = retry.data;
    }

    // Also attempt optional mirror insert into public.shifts if present
    try {
      await supabase.from("shifts").insert([{
        restaurant_id: numericRestId,
        branch_id: String(numericBranchId || ""),
        cashier_name: staffName,
        shift_start: nowIso,
        status: "OPEN",
      }]);
    } catch { }

    const resolvedRecord: UniversalShiftRecord = {
      id: data?.id || `shift_${Date.now()}`,
      restaurant_id: numericRestId,
      branch_id: numericBranchId,
      cashier_name: staffName,
      cashier_id: user.id || null,
      staff_role: staffRole,
      shift_type: resolvedShift,
      shift_start: nowIso,
      opening_float: floatAmount,
      system_cash_sales: 0,
      gross_sales: 0,
      status: "OPEN",
      closing_notes: closingNoteText,
      created_at: nowIso,
      terminal_label: getTerminalLabelForRole(staffRole),
    };

    // Store in browser session and local storage
    if (typeof window !== "undefined") {
      try {
        const storageVal = JSON.stringify(resolvedRecord);
        sessionStorage.setItem(`staff_active_shift_${staffKey}`, storageVal);
        localStorage.setItem(`staff_active_shift_${staffKey}`, storageVal);
        sessionStorage.setItem(`staff_active_shift_${restId}_${staffRole}`, storageVal);
        localStorage.setItem(`staff_active_shift_${restId}_${staffRole}`, storageVal);
        sessionStorage.setItem(`staff_session_token_${staffKey}`, `token_${Date.now()}`);
        localStorage.setItem(`staff_session_token_${staffKey}`, `token_${Date.now()}`);
      } catch { }
    }

    return resolvedRecord;
  } catch (err) {
    console.warn("[universalShiftLogging] Failed to log shift login:", err);
    return null;
  }
}

/**
 * Record a shift session closing when any staff member logs out or concludes shift.
 * Automatically executes a database update query to close the active shift:
 * status = 'CLOSED', closed_at = NOW(), shift_end = NOW().
 */
export async function recordStaffShiftLogout(
  user: any,
  options?: { notes?: string; station?: string }
): Promise<boolean> {
  if (!user) return false;

  try {
    const supabase = createClient();
    const { restId } = await getValidTenantContext(user);
    if (!restId) return false;

    const numericRestId = !isNaN(Number(restId)) ? Number(restId) : restId;
    const rawRole = (user.staffRole || user.role || "").toLowerCase();
    const staffRole = normalizeStaffRole(rawRole, user.terminalAccess, user.name);
    const staffName = user.name || user.email || `${staffRole.toUpperCase()} User`;
    const staffEmail = user.email || "";
    const staffKey = String(user.id || user.email || user.name || staffRole)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");

    const nowIso = new Date().toISOString();

    // Check cached active shift record
    let shiftId: string | null = null;
    if (typeof window !== "undefined") {
      try {
        const cachedStr =
          sessionStorage.getItem(`staff_active_shift_${staffKey}`) ||
          localStorage.getItem(`staff_active_shift_${staffKey}`) ||
          sessionStorage.getItem(`staff_active_shift_${restId}_${staffRole}`) ||
          localStorage.getItem(`staff_active_shift_${restId}_${staffRole}`) ||
          sessionStorage.getItem(`pos_active_shift_${restId}`) ||
          localStorage.getItem(`pos_active_shift_${restId}`);
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          shiftId = parsed.id;
        }
      } catch { }
    }

    const roleTag = `[ROLE: ${staffRole.toUpperCase()}]`;
    const closingNotes = `${roleTag} Session completed at ${new Date().toLocaleTimeString()}${
      options?.notes ? " | " + options.notes : ""
    }`;

    const updatePayload: any = {
      shift_end: nowIso,
      closed_at: nowIso,
      status: "CLOSED",
      closing_notes: closingNotes,
    };

    // 1. If explicit shift ID exists and is a DB id, close it
    if (shiftId && !String(shiftId).startsWith("shift_")) {
      try {
        const res = await supabase
          .from("shift_settlements")
          .update(updatePayload)
          .eq("id", shiftId);

        if (res.error && (res.error.code === "PGRST204" || res.error.message?.includes("closed_at"))) {
          delete updatePayload.closed_at;
          await supabase
            .from("shift_settlements")
            .update(updatePayload)
            .eq("id", shiftId);
          updatePayload.closed_at = nowIso;
        }
      } catch (e1) {
        console.warn("[universalShiftLogging] Error updating specific shiftId:", e1);
      }
    }

    // 2. Guaranteed close of ALL open shifts for this staff member in shift_settlements
    try {
      let openQuery = supabase
        .from("shift_settlements")
        .select("id")
        .eq("restaurant_id", numericRestId)
        .eq("status", "OPEN");

      if (user.id) {
        openQuery = openQuery.or(`cashier_name.eq.${staffName},cashier_name.eq.${staffEmail},cashier_id.eq.${user.id}`);
      } else {
        openQuery = openQuery.or(`cashier_name.eq.${staffName},cashier_name.eq.${staffEmail}`);
      }

      const { data: openShifts } = await openQuery;
      if (openShifts && openShifts.length > 0) {
        const idsToClose = openShifts.map((s: any) => s.id);
        const { error: batchErr } = await supabase
          .from("shift_settlements")
          .update(updatePayload)
          .in("id", idsToClose);

        if (batchErr && (batchErr.code === "PGRST204" || batchErr.message?.includes("closed_at"))) {
          delete updatePayload.closed_at;
          await supabase
            .from("shift_settlements")
            .update(updatePayload)
            .in("id", idsToClose);
        }
      }
    } catch (openErr) {
      console.warn("[universalShiftLogging] Error closing remaining open shifts:", openErr);
    }

    // 3. Mirror close in shifts table if present
    try {
      await supabase
        .from("shifts")
        .update({ status: "CLOSED", shift_end: nowIso })
        .eq("restaurant_id", numericRestId)
        .eq("cashier_name", staffName)
        .eq("status", "OPEN");
    } catch { }

    // 4. Clean up local & session storage
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(`staff_active_shift_${staffKey}`);
        localStorage.removeItem(`staff_active_shift_${staffKey}`);
        sessionStorage.removeItem(`staff_active_shift_${restId}_${staffRole}`);
        localStorage.removeItem(`staff_active_shift_${restId}_${staffRole}`);
        sessionStorage.removeItem(`pos_active_shift_${restId}`);
        localStorage.removeItem(`pos_active_shift_${restId}`);
        sessionStorage.removeItem(`pos_session_float_confirmed_${staffKey}`);
        localStorage.removeItem(`pos_session_float_confirmed_${staffKey}`);
        sessionStorage.removeItem("pos_session_float_confirmed_global");
        localStorage.removeItem("pos_session_float_confirmed_global");
        sessionStorage.removeItem(`staff_session_token_${staffKey}`);
        localStorage.removeItem(`staff_session_token_${staffKey}`);
      } catch { }
    }

    return true;
  } catch (err) {
    console.warn("[universalShiftLogging] Error logging shift logout:", err);
    return false;
  }
}

/**
 * Check if a staff member currently has an active unclosed shift in the database.
 * Used during staff login for single-session enforcement and duplicate login prevention.
 */
export async function checkActiveStaffSession(
  restaurantId: string | number,
  user: { id?: string | number; name?: string; email?: string }
): Promise<UniversalShiftRecord | null> {
  if (!restaurantId || !user) return null;

  try {
    const supabase = createClient();
    const numericRestId = !isNaN(Number(restaurantId)) ? Number(restaurantId) : restaurantId;
    const staffName = user.name || user.email || "";
    const staffEmail = user.email || "";

    let query = supabase
      .from("shift_settlements")
      .select("*")
      .eq("restaurant_id", numericRestId)
      .eq("status", "OPEN")
      .order("created_at", { ascending: false });

    if (user.id) {
      query = query.or(`cashier_name.eq.${staffName},cashier_name.eq.${staffEmail},cashier_id.eq.${user.id}`);
    } else {
      query = query.or(`cashier_name.eq.${staffName},cashier_name.eq.${staffEmail}`);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error || !data) return null;

    const staffRole = extractRoleFromShiftRecord(data);
    return {
      id: String(data.id),
      restaurant_id: data.restaurant_id,
      branch_id: data.branch_id,
      cashier_name: data.cashier_name || staffName,
      cashier_id: data.cashier_id || user.id || null,
      staff_role: staffRole,
      shift_type: data.shift_type || "Active Shift",
      shift_start: data.shift_start || data.created_at,
      shift_end: data.shift_end || null,
      opening_float: Number(data.opening_float) || 0,
      status: "OPEN",
      closing_notes: data.closing_notes || "",
      created_at: data.created_at,
      terminal_label: getTerminalLabelForRole(staffRole, data.counter_name || data.terminal_label),
    };
  } catch (err) {
    console.warn("[universalShiftLogging] Error checking active staff session:", err);
    return null;
  }
}

/**
 * Force-close all prior active shifts for a staff member.
 * Called when a staff member opts to terminate an existing session during login.
 */
export async function forceCloseStaffSession(
  restaurantId: string | number,
  user: { id?: string | number; name?: string; email?: string }
): Promise<boolean> {
  return await recordStaffShiftLogout(
    { ...user, restaurantId },
    { notes: "Prior session explicitly terminated during new login" }
  );
}

/**
 * Seamlessly transitions any staff member (Waiter, Chef, Cashier) from an expiring shift
 * into the next operating shift segment without breaking operational flow.
 */
export async function recordStaffShiftRollover(
  user: any,
  nextShiftType: string,
  options?: { notes?: string; station?: string }
): Promise<UniversalShiftRecord | null> {
  if (!user) return null;

  try {
    // 1. Close current expiring shift cleanly
    await recordStaffShiftLogout(user, {
      notes: `Shift rollover handover to ${nextShiftType}${options?.notes ? " | " + options.notes : ""}`,
      station: options?.station,
    });

    // 2. Open new consecutive shift segment
    const rolloverNotes = `Consecutive shift rollover started from terminal session${options?.notes ? " | " + options.notes : ""}`;
    const newShift = await recordStaffShiftLogin(user, {
      shiftType: nextShiftType,
      notes: rolloverNotes,
      station: options?.station,
    });

    // 3. Update cached user assignedShift in session so UI immediately reflects the new shift
    if (typeof window !== "undefined") {
      try {
        const storedUser = sessionStorage.getItem("active_user_session") || localStorage.getItem("active_user_session");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.assignedShift = nextShiftType;
          sessionStorage.setItem("active_user_session", JSON.stringify(parsed));
          localStorage.setItem("active_user_session", JSON.stringify(parsed));
        }
      } catch {}
    }

    return newShift;
  } catch (err) {
    console.warn("[universalShiftLogging] Error during staff shift rollover:", err);
    return null;
  }
}

/**
 * Fetch all universal staff shifts for the manager terminal / admin audit ledger
 */
export async function fetchUniversalStaffShifts(
  restId: string | number
): Promise<UniversalShiftRecord[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shift_settlements")
      .select("*")
      .eq("restaurant_id", restId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data && data.length > 0) {
      return data.map((d: any) => {
        const staffRole = extractRoleFromShiftRecord(d);
        return {
          id: String(d.id),
          restaurant_id: d.restaurant_id,
          branch_id: d.branch_id,
          cashier_name: d.cashier_name || "Staff Member",
          cashier_id: d.cashier_id || null,
          staff_role: staffRole,
          shift_type: d.shift_type || "Day Shift",
          shift_start: d.shift_start || d.shift_opened_at || d.created_at,
          shift_end: d.shift_end || d.shift_closed_at || null,
          opening_float: Number(d.opening_float) || 0,
          system_cash_sales: Number(d.system_cash_sales ?? d.cash_sales ?? 0),
          system_card_sales: Number(d.system_card_sales ?? d.card_sales ?? 0),
          system_digital_sales: Number(d.system_digital_sales ?? 0),
          gross_sales: Number(d.gross_sales ?? d.total_gross_sales ?? 0),
          actual_cash_counted: Number(d.actual_cash_counted ?? 0),
          cash_variance: Number(d.cash_variance ?? d.variance ?? 0),
          status: (d.status === "FLAGGED" ? "FLAGGED" : d.status === "CLOSED" ? "CLOSED" : "OPEN") as "OPEN" | "CLOSED" | "FLAGGED",
          closing_notes: d.closing_notes || d.notes || "",
          created_at: d.created_at || new Date().toISOString(),
          terminal_label: getTerminalLabelForRole(staffRole, d.counter_name || d.terminal_label),
        };
      });
    }
  } catch (err) {
    console.warn("[universalShiftLogging] Error loading shifts from Supabase:", err);
  }

  // 100% Realtime Database Sourcing: zero mock/dummy records when database has 0 records
  return [];
}

export function getTerminalLabelForRole(role: StaffRoleType, override?: string): string {
  if (override) return override;
  switch (role) {
    case "waiter":
      return "Floor Waiter Terminal";
    case "chef":
      return "Kitchen KDS Terminal";
    case "manager":
      return "Manager Terminal";
    case "cashier":
    default:
      return "POS Billing Counter";
  }
}
