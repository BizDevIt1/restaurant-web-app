/**
 * OMNIBITES PLATFORM AUTHENTICATION & ROLE-SCOPED SESSION MANAGEMENT
 * File: lib/auth.ts
 *
 * Implements strict role isolation and prevents session leaks, route cross-over,
 * and hydration race conditions between Restaurant Admins and Staff Members.
 */

export interface AuthSession {
  userType: "ADMIN" | "STAFF";
  id: string | number;
  email: string;
  organizationId: number;
  restaurantName: string;
  role: string; // e.g. 'owner', 'manager', 'cashier', 'chef', 'rider', 'STANDALONE_ADMIN'
  terminalAccess: "FULL_ADMIN" | "POS_ONLY" | "KDS_ONLY" | "RIDER_ONLY";
  branchId?: number | null;
  // UI & branding hydration metadata
  name?: string;
  city?: string;
  address?: string;
  phone?: string;
  cuisine?: string;
  logoUrl?: string;
  branchName?: string;
  assignedFeatures?: string[];
  restaurantType?: "STANDALONE" | "FRANCHISE";
  branchesCount?: number;
  branches?: any[];
  staffRole?: "manager" | "cashier" | "chef" | "rider" | "waiter";
}

export const ADMIN_SESSION_KEY = "omni_admin_session";
export const STAFF_SESSION_KEY = "omni_staff_session";
export const LEGACY_SESSION_KEY = "omni_active_user";

/**
 * Get active AuthSession with strict isolation.
 * Staff session takes precedence if staff key is set; otherwise Admin session.
 * Automatically clears stale legacy keys to prevent crossover.
 */
export function getActiveAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    // 1. Check Admin Session first (Admin dashboard priority)
    const rawAdmin = localStorage.getItem(ADMIN_SESSION_KEY);
    if (rawAdmin) {
      const parsed = JSON.parse(rawAdmin);
      if (parsed && parsed.userType === "ADMIN") {
        // Ensure conflicting staff or legacy keys are removed
        if (localStorage.getItem(STAFF_SESSION_KEY)) localStorage.removeItem(STAFF_SESSION_KEY);
        if (localStorage.getItem(LEGACY_SESSION_KEY)) localStorage.removeItem(LEGACY_SESSION_KEY);
        if (localStorage.getItem("staff_user")) localStorage.removeItem("staff_user");
        return parsed as AuthSession;
      }
    }

    // 2. Check Staff Session
    const rawStaff = localStorage.getItem(STAFF_SESSION_KEY);
    if (rawStaff) {
      const parsed = JSON.parse(rawStaff);
      if (parsed && parsed.userType === "STAFF") {
        // Ensure conflicting admin or legacy keys are removed
        if (localStorage.getItem(ADMIN_SESSION_KEY)) localStorage.removeItem(ADMIN_SESSION_KEY);
        if (localStorage.getItem(LEGACY_SESSION_KEY)) localStorage.removeItem(LEGACY_SESSION_KEY);
        return parsed as AuthSession;
      }
    }

    // 3. Migration fallback for existing sessions
    const rawLegacy = localStorage.getItem(LEGACY_SESSION_KEY);
    if (rawLegacy) {
      try {
        const parsed = JSON.parse(rawLegacy);
        if (parsed && parsed.email && parsed.email !== "admin@omnibites.com" && parsed.email !== "admin@gmail.com") {
          const isStaff =
            parsed.userType === "STAFF" ||
            parsed.role === "STAFF_MEMBER" ||
            Boolean(parsed.staffRole) ||
            (parsed.terminalAccess && parsed.terminalAccess !== "FULL_ADMIN");

          const session: AuthSession = {
            userType: isStaff ? "STAFF" : "ADMIN",
            id: parsed.id || "default",
            email: parsed.email,
            organizationId: Number(parsed.organizationId || parsed.restaurantId || 27),
            restaurantName: parsed.restaurantName || "Restaurant",
            role: parsed.staffRole || parsed.role || (isStaff ? "cashier" : "STANDALONE_ADMIN"),
            terminalAccess: parsed.terminalAccess || (isStaff ? "POS_ONLY" : "FULL_ADMIN"),
            branchId: parsed.branchId ? Number(parsed.branchId) || null : null,
            name: parsed.name || parsed.restaurantName,
            city: parsed.city,
            address: parsed.address,
            phone: parsed.phone,
            cuisine: parsed.cuisine,
            logoUrl: parsed.logoUrl,
            branchName: parsed.branchName,
            assignedFeatures: parsed.assignedFeatures,
            restaurantType: parsed.restaurantType,
            branchesCount: parsed.branchesCount,
            branches: parsed.branches,
            staffRole: parsed.staffRole,
          };

          if (isStaff) {
            localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
            localStorage.removeItem(ADMIN_SESSION_KEY);
          } else {
            localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
            localStorage.removeItem(STAFF_SESSION_KEY);
          }
          localStorage.removeItem(LEGACY_SESSION_KEY);
          return session;
        } else {
          localStorage.removeItem(LEGACY_SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(LEGACY_SESSION_KEY);
      }
    }
  } catch (err) {
    console.warn("[auth.ts] Error resolving active AuthSession:", err);
  }

  // Strictly return null if no authenticated session exists. ZERO mock or fallback admin credentials.
  return null;
}

/**
 * Save AuthSession with role isolation.
 * Staff logins strictly clear Admin sessions and vice versa.
 */
export function setAuthSession(session: AuthSession | null): void {
  if (typeof window === "undefined") return;

  try {
    if (!session) {
      clearAllAuthSessions();
      return;
    }

    if (session.userType === "STAFF") {
      localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
      localStorage.removeItem(ADMIN_SESSION_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } else {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      localStorage.removeItem(STAFF_SESSION_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
  } catch (err) {
    console.error("[auth.ts] Error saving AuthSession:", err);
  }
}

/**
 * Clear all authentication and session keys (Logout).
 */
export function clearAllAuthSessions(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STAFF_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
    localStorage.removeItem("admin_user");
    localStorage.removeItem("active_user");
    localStorage.removeItem("omni_active_user");
    localStorage.removeItem("staff_user");
    localStorage.removeItem("omni_staff_session");
    localStorage.removeItem("omni_admin_session");
  } catch {}
}
