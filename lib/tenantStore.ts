import { AuthenticatedUser, BranchData, MenuItem, StaffMember, UserRole, OrderRecord, KitchenTicket, TableStatus, BranchSettings } from "../app/admin/types";
import {
  getActiveAuthSession,
  setAuthSession,
  clearAllAuthSessions,
  AuthSession,
} from "./auth";

// Key Constants for LocalStorage Persistence
const ACTIVE_USER_KEY = "omni_active_user";
const FRANCHISE_BRANCHES_KEY = "omni_franchise_branches";
const BRANCH_ACCOUNTS_KEY = "omni_branch_accounts";
const MENU_KEY_PREFIX = "omni_menu_";
const STAFF_KEY_PREFIX = "omni_staff_";
const ORDERS_KEY_PREFIX = "omni_orders_";
const KDS_KEY_PREFIX = "omni_kds_";
const TABLES_KEY_PREFIX = "omni_tables_";
export const SETTINGS_KEY_PREFIX = "omni_settings_";

export interface BranchAccount {
  email: string;
  password?: string;
  name: string;
  role: "BRANCH_ADMIN";
  restaurantName: string;
  city: string;
  address?: string;
  phone?: string;
  branchId: string;
  branchName: string;
  assignedFeatures: string[];
  organizationId?: string;
}

export const ALL_PAKISTAN_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Peshawar",
  "Multan",
  "Gujranwala",
  "Sialkot",
  "Quetta",
  "Bahawalpur",
  "Sargodha",
  "Sukkur",
  "Hyderabad",
  "Abbottabad",
  "Larkana",
  "Sheikhupura",
  "Jhang",
  "Rahim Yar Khan",
  "Gujrat",
  "Mardan",
  "Kasur",
  "Sahiwal",
  "Okara",
  "Wah Cantt",
  "Dera Ghazi Khan",
  "Mirpur",
  "Muzaffarabad",
  "Gwadar",
  "Gilgit",
  "Skardu",
  "Jhelum",
  "Attock",
  "Chiniot",
  "Kamoke",
  "Hafizabad",
  "Kohat",
  "Khanewal",
  "Dera Ismail Khan",
  "Turbat",
];

/**
 * Get stored franchise branches for an organization.
 * Pure dynamic storage - Zero dummy mock fallbacks.
 */
export function getStoredFranchiseBranches(orgId?: string): BranchData[] {
  if (typeof window === "undefined") return [];
  try {
    const key = orgId ? `${FRANCHISE_BRANCHES_KEY}_${orgId}` : FRANCHISE_BRANCHES_KEY;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    // Fallback check generic key if orgId not specified
    if (orgId) {
      const genericRaw = localStorage.getItem(FRANCHISE_BRANCHES_KEY);
      if (genericRaw) {
        const parsed = JSON.parse(genericRaw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}
  return [];
}

/**
 * Save franchise branches to storage.
 */
export function saveFranchiseBranches(branches: BranchData[], orgId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = orgId ? `${FRANCHISE_BRANCHES_KEY}_${orgId}` : FRANCHISE_BRANCHES_KEY;
    localStorage.setItem(key, JSON.stringify(branches));
    localStorage.setItem(FRANCHISE_BRANCHES_KEY, JSON.stringify(branches));
  } catch {}
}

/**
 * Get all dynamically created branch admin accounts.
 * Returns empty array if none registered - Zero dummy seeds.
 */
export function getStoredBranchAccounts(): BranchAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BRANCH_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Save a newly provisioned branch manager account.
 */
export function saveBranchAccount(account: BranchAccount): void {
  if (typeof window === "undefined") return;
  try {
    const accounts = getStoredBranchAccounts();
    const existingIndex = accounts.findIndex(
      (a) => a.email.toLowerCase() === account.email.toLowerCase()
    );
    if (existingIndex >= 0) {
      accounts[existingIndex] = account;
    } else {
      accounts.push(account);
    }
    localStorage.setItem(BRANCH_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}

/**
 * Get tenant-scoped stored menu items.
 * Pure dynamic storage - Falls back to default initial menu if uninitialized.
 */
export function getStoredMenu(orgId: string = "default", fallback: MenuItem[] = []): MenuItem[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${MENU_KEY_PREFIX}${orgId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return fallback;
}

/**
 * Save tenant-scoped stored menu items.
 */
export function saveStoredMenu(orgId: string = "default", menu: MenuItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${MENU_KEY_PREFIX}${orgId}`, JSON.stringify(menu));
  } catch {}
}

/**
 * Get tenant-scoped stored staff members.
 * Pure dynamic storage - Falls back to default initial staff if uninitialized.
 */
export function getStoredStaff(tenantId: string = "default", fallback: StaffMember[] = []): StaffMember[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${STAFF_KEY_PREFIX}${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const seen = new Set<string>();
        return parsed.filter((s: StaffMember) => {
          if (!s?.id || seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
      }
    }
  } catch {}
  return fallback;
}

/**
 * Save tenant-scoped stored staff members.
 */
export function saveStoredStaff(tenantId: string = "default", staff: StaffMember[]): void {
  if (typeof window === "undefined") return;
  try {
    const seen = new Set<string>();
    const deduplicated = staff.filter((s: StaffMember) => {
      if (!s?.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    localStorage.setItem(`${STAFF_KEY_PREFIX}${tenantId}`, JSON.stringify(deduplicated));
  } catch {}
}

/**
 * Get tenant-scoped stored completed order records.
 */
export function getStoredOrders(tenantId: string = "default"): OrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${ORDERS_KEY_PREFIX}${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Save a newly settled order to tenant storage.
 */
export function saveStoredOrder(tenantId: string = "default", order: OrderRecord): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredOrders(tenantId);
    const updated = [order, ...existing.filter((o) => o.id !== order.id)];
    localStorage.setItem(`${ORDERS_KEY_PREFIX}${tenantId}`, JSON.stringify(updated));
  } catch {}
}

/**
 * Save an array of orders to tenant storage.
 */
export function saveStoredOrders(tenantId: string = "default", orders: OrderRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${ORDERS_KEY_PREFIX}${tenantId}`, JSON.stringify(orders));
  } catch {}
}

/**
 * Get tenant-scoped stored kitchen (KDS) tickets.
 */
export function getStoredKdsTickets(
  tenantId: string = "default",
  fallback: KitchenTicket[] = []
): KitchenTicket[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${KDS_KEY_PREFIX}${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return fallback;
}

/**
 * Save kitchen (KDS) tickets to tenant storage.
 */
export function saveStoredKdsTickets(
  tenantId: string = "default",
  tickets: KitchenTicket[]
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${KDS_KEY_PREFIX}${tenantId}`, JSON.stringify(tickets));
  } catch {}
}

/**
 * Get tenant-scoped floor matrix table statuses.
 */
export function getStoredTables(
  tenantId: string = "default",
  fallback: TableStatus[] = []
): TableStatus[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${TABLES_KEY_PREFIX}${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return fallback;
}

/**
 * Save floor matrix table statuses to tenant storage.
 */
export function saveStoredTables(
  tenantId: string = "default",
  tables: TableStatus[]
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${TABLES_KEY_PREFIX}${tenantId}`, JSON.stringify(tables));
  } catch {}
}

/**
 * Real Web Audio API Kitchen Buzzer / Chime.
 * Synthesizes a crisp dual-tone order alert bell without any external audio file dependencies.
 */
export function playKitchenBuzzer(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tone 1 - Crisp initial ding (A5, 880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Tone 2 - Harmonic resonance (D6, 1174.66Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1174.66, now + 0.15);
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch {
    // AudioContext permission or browser autoplay policies safely handled
  }
}

export const DEFAULT_CORE_FEATURES = [
  "OVERVIEW",
  "EXPENSES",
  "ANALYTICS",
  "STAFF",
  "SETTINGS",
  "SUBSCRIPTION",
];

/**
 * Helper to normalize module names into standard feature strings.
 * Core features are always-on; add-on entitlements require explicit assignment.
 */
export function normalizeModules(modules: any): string[] {
  if (!Array.isArray(modules) || modules.length === 0) {
    return [...DEFAULT_CORE_FEATURES];
  }
  const mapping: Record<string, string> = {
    pos_terminal: "POS",
    pos: "POS",
    kds_system: "KITCHEN",
    kds: "KITCHEN",
    kitchen: "KITCHEN",
    tables: "KITCHEN",
    rider_app: "RIDER",
    rider: "RIDER",
    riders: "RIDER",
    dispatch: "RIDER",
    inventory_stock: "INVENTORY",
    inventory: "INVENTORY",
    procurement: "INVENTORY",
    menu: "INVENTORY",
    branches: "BRANCHES",
  };

  const assigned = modules
    .map((m: any) => {
      const lower = String(m || "").toLowerCase().trim();
      return mapping[lower] || null;
    })
    .filter(Boolean) as string[];

  return Array.from(new Set([...DEFAULT_CORE_FEATURES, ...assigned]));
}

export const OMNI_RESTAURANTS_KEY = "omni_restaurants";
export const SA_RESTAURANTS_KEY = "sa_restaurants";

/**
 * Helper to get all real restaurants stored in localStorage from Super Admin.
 */
export function getStoredRestaurants(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const omniRaw = localStorage.getItem(OMNI_RESTAURANTS_KEY);
    if (omniRaw) {
      const parsed = JSON.parse(omniRaw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const saRaw = localStorage.getItem(SA_RESTAURANTS_KEY);
    if (saRaw) {
      const parsed = JSON.parse(saRaw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Helper to save/update a real restaurant record in localStorage.
 */
export function saveStoredRestaurant(restaurant: any): void {
  if (typeof window === "undefined" || !restaurant) return;
  try {
    const list = getStoredRestaurants();
    const existingIdx = list.findIndex(
      (r: any) =>
        (r.id && restaurant.id && String(r.id) === String(restaurant.id)) ||
        (r.owner_email && restaurant.owner_email && r.owner_email.toLowerCase() === restaurant.owner_email.toLowerCase())
    );
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...restaurant };
    } else {
      list.unshift(restaurant);
    }
    localStorage.setItem(OMNI_RESTAURANTS_KEY, JSON.stringify(list));
    localStorage.setItem(SA_RESTAURANTS_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Authenticate against real local storage records (provisioned branch accounts & Super Admin restaurants).
 * Returns null if no authentic record is found. ZERO mock seeds.
 */
export function authenticateLocalAccount(email: string, pass?: string): AuthenticatedUser | null {
  const normEmail = email.trim().toLowerCase();
  if (!normEmail) return null;

  // 1. Check real branch accounts provisioned by Franchisers
  const branchAccounts = getStoredBranchAccounts();
  const matchedBranch = branchAccounts.find(
    (b) =>
      b.email.toLowerCase() === normEmail &&
      (!b.password || !pass || b.password === pass)
  );

  if (matchedBranch) {
    return {
      id: `usr_${matchedBranch.branchId || Date.now()}`,
      name: matchedBranch.name,
      email: matchedBranch.email,
      role: "BRANCH_ADMIN",
      restaurantName: matchedBranch.restaurantName,
      city: matchedBranch.city,
      address: matchedBranch.address,
      phone: matchedBranch.phone,
      branchId: matchedBranch.branchId,
      branchName: matchedBranch.branchName,
      assignedFeatures: normalizeModules(matchedBranch.assignedFeatures),
      organizationId: matchedBranch.organizationId,
    };
  }

  // 2. Check Super Admin deployed restaurants stored locally
  if (typeof window !== "undefined") {
    try {
      const allRestaurants = getStoredRestaurants();
      if (Array.isArray(allRestaurants)) {
        const matchedSa = allRestaurants.find((r: any) => {
          const rEmail = (r.email || r.owner_email || "").trim().toLowerCase();
          const emailMatches = rEmail === normEmail;
          if (!emailMatches) return false;
          if (pass && (r.owner_password || r.password)) {
            const expectedPass = r.owner_password || r.password;
            return expectedPass === pass;
          }
          return true;
        });

        if (matchedSa) {
          // Determine if franchise
          const isExplicitFranchise =
            matchedSa.restaurant_type === "FRANCHISE" ||
            matchedSa.business_type === "franchise" ||
            matchedSa.businessType === "franchise" ||
            matchedSa.restaurantType === "FRANCHISE";

          const rawBranches = Array.isArray(matchedSa.branches)
            ? matchedSa.branches
            : matchedSa.branches
            ? [matchedSa.branches]
            : [];

          const hasFranchiseBranch = rawBranches.some(
            (b: any) => typeof b === "object" && (b.type === "franchise" || b.type === "FRANCHISE")
          );

          const isFranchise = isExplicitFranchise || hasFranchiseBranch || rawBranches.length > 1;

          // Check if custom branches were provisioned dynamically for this org
          const dynamicBranches = getStoredFranchiseBranches(String(matchedSa.id));

          const sourceBranches =
            dynamicBranches.length > 0
              ? dynamicBranches
              : rawBranches.length > 0
              ? rawBranches
              : [matchedSa.branch || matchedSa.hq_address || "Main Outlet"];

          const branchesList: BranchData[] = isFranchise
            ? sourceBranches.map((b: any, idx: number) => {
                const bName = typeof b === "string" ? b : b.name || `Outlet ${idx + 1}`;
                const bCity = typeof b === "object" && b.city ? b.city : matchedSa.city || "";
                const bAddress =
                  typeof b === "object" && b.address
                    ? b.address
                    : matchedSa.branch || matchedSa.hq_address || "";
                const bPhone = typeof b === "object" && b.phone ? b.phone : matchedSa.phone || "";
                return {
                  id: typeof b === "object" && b.id ? b.id : `sa_br_${matchedSa.id}_${idx}`,
                  name: bName,
                  code:
                    typeof b === "object" && b.code
                      ? b.code
                      : `${(bCity || "BR").substring(0, 3).toUpperCase()}-${String(idx + 1).padStart(2, "0")}`,
                  city: bCity,
                  address: bAddress,
                  phone: bPhone,
                  managerName:
                    typeof b === "object" && b.managerName
                      ? b.managerName
                      : matchedSa.ownerName || matchedSa.contact_person || "Branch Manager",
                  managerEmail:
                    typeof b === "object" && b.managerEmail
                      ? b.managerEmail
                      : matchedSa.email || matchedSa.owner_email || normEmail,
                  assignedFeatures:
                    typeof b === "object" && b.assignedFeatures
                      ? b.assignedFeatures
                      : normalizeModules(matchedSa.enabled_modules),
                  status: "ACTIVE",
                  todaySales: 0,
                  activeOrders: 0,
                  organizationId: String(matchedSa.id),
                };
              })
            : [];

          const saUser: AuthenticatedUser = {
            id: String(matchedSa.id),
            email: matchedSa.email || matchedSa.owner_email || normEmail,
            name: matchedSa.ownerName || matchedSa.contact_person || matchedSa.name || "Restaurant Owner",
            role: isFranchise ? "FRANCHISE_OWNER" : "STANDALONE_ADMIN",
            restaurantName: matchedSa.brand_name || matchedSa.name || "Restaurant",
            city: matchedSa.city || "",
            address: matchedSa.hq_address || matchedSa.branch || "",
            phone: matchedSa.phone || "",
            cuisine: matchedSa.cuisine || matchedSa.category || "Fine Dining",
            branchId: !isFranchise ? `br_${matchedSa.id}` : undefined,
            branchName: !isFranchise ? (matchedSa.branch || matchedSa.name) : undefined,
            branches: isFranchise ? branchesList : undefined,
            assignedFeatures: normalizeModules(matchedSa.enabled_modules),
            restaurantType: isFranchise ? "FRANCHISE" : "STANDALONE",
            branchesCount: isFranchise ? branchesList.length : 1,
            organizationId: String(matchedSa.id),
          };

          return sanitizeUserSession(saUser);
        }
      }
    } catch {}
  }

  // Zero hardcoded dummy seeds - If not matched with real data, return null
  return null;
}

export function sanitizeSessionText(text?: string): string {
  if (!text) return "";
  return text
    .replace(/frenchis\w*|franchis\w*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeUserSession(u: AuthenticatedUser | null): AuthenticatedUser | null {
  if (!u) return null;
  const cleanRest = sanitizeSessionText(u.restaurantName) || "Restaurant";
  const cleanName = sanitizeSessionText(u.name) || "Admin";
  const cleanEmail = u.email ? u.email.replace(/frenchis\w*|franchis\w*/gi, "admin").trim() : "";
  const cleanBranch = u.branchName ? sanitizeSessionText(u.branchName) || "Main Branch" : undefined;
  const cleanBranches = u.branches?.map((b: any, idx: number) => ({
    ...b,
    id: b.id || b.branch_id || b.code || `branch_${idx}`,
    name: sanitizeSessionText(b.name) || "Branch Outlet",
    managerName: sanitizeSessionText(b.managerName) || "Branch Manager",
    managerEmail: b.managerEmail ? b.managerEmail.replace(/frenchis\w*|franchis\w*/gi, "admin").trim() : "",
  }));

  return {
    ...u,
    restaurantName: cleanRest,
    name: cleanName,
    email: cleanEmail,
    branchName: cleanBranch,
    branches: cleanBranches,
  };
}

/**
 * Get active user session or null if not authenticated.
 * Uses isolated role-scoped storage (Admin vs Staff).
 * ZERO mock fallback.
 */
export function getActiveUserSession(): AuthenticatedUser | null {
  if (typeof window === "undefined") return null;
  try {
    const session = getActiveAuthSession();
    if (!session) return null;

    let branches = session.branches;
    if (session.role === "FRANCHISE_OWNER" || session.role === "franchiser") {
      const stored = getStoredFranchiseBranches(String(session.organizationId || session.id));
      if (stored.length > 0) {
        branches = stored;
      }
    }

    const user: AuthenticatedUser = {
      id: String(session.id),
      email: session.email,
      name: session.name || session.restaurantName || "User",
      role: (session.userType === "STAFF" ? "STAFF_MEMBER" : (session.role as any)) || "STANDALONE_ADMIN",
      userType: session.userType,
      restaurantName: session.restaurantName,
      city: session.city,
      address: session.address,
      phone: session.phone,
      cuisine: session.cuisine,
      logoUrl: session.logoUrl,
      branchId: session.branchId ? String(session.branchId) : undefined,
      branchName: session.branchName,
      branches: branches,
      assignedFeatures: normalizeModules(session.assignedFeatures),
      restaurantType: session.restaurantType || "STANDALONE",
      branchesCount: session.branchesCount || (branches ? branches.length : 1),
      organizationId: String(session.organizationId),
      restaurantId: String(session.organizationId),
      terminalAccess: session.terminalAccess,
      staffRole: session.staffRole || (session.userType === "STAFF" ? (session.role as any) : undefined),
    };

    return sanitizeUserSession(user);
  } catch (err) {
    console.warn("[tenantStore] Error reading user session:", err);
  }
  return null;
}

/**
 * Save active user session to role-isolated localStorage.
 */
export function setActiveUserSession(user: AuthenticatedUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!user) {
      clearAllAuthSessions();
      return;
    }

    const sanitized = sanitizeUserSession(user);
    if (!sanitized) {
      clearAllAuthSessions();
      return;
    }

    const isStaff =
      sanitized.userType === "STAFF" ||
      sanitized.role === "STAFF_MEMBER" ||
      Boolean(sanitized.staffRole) ||
      (sanitized.terminalAccess && sanitized.terminalAccess !== "FULL_ADMIN");

    const session: AuthSession = {
      userType: isStaff ? "STAFF" : "ADMIN",
      id: sanitized.id,
      email: sanitized.email,
      organizationId: Number(sanitized.organizationId || sanitized.restaurantId || 27),
      restaurantName: sanitized.restaurantName,
      role: sanitized.staffRole || sanitized.role || (isStaff ? "cashier" : "STANDALONE_ADMIN"),
      terminalAccess: sanitized.terminalAccess || (isStaff ? "POS_ONLY" : "FULL_ADMIN"),
      branchId: sanitized.branchId ? Number(sanitized.branchId) || null : null,
      name: sanitized.name,
      city: sanitized.city,
      address: sanitized.address,
      phone: sanitized.phone,
      cuisine: sanitized.cuisine,
      logoUrl: sanitized.logoUrl,
      branchName: sanitized.branchName,
      assignedFeatures: sanitized.assignedFeatures,
      restaurantType: sanitized.restaurantType,
      branchesCount: sanitized.branchesCount,
      branches: sanitized.branches,
      staffRole: sanitized.staffRole,
    };

    setAuthSession(session);
  } catch (err) {
    console.error("[tenantStore] Error setting active user session:", err);
  }
}

/**
 * Clear user session (Logout).
 */
export function clearUserSession(): void {
  clearAllAuthSessions();
}

/**
 * Get tenant-scoped branch settings (printer IP, buzzer toggle, timings, address).
 */
export function getStoredBranchSettings(
  restaurantId: string = "default",
  branchId: string = "main",
  fallback?: BranchSettings
): BranchSettings {
  const defaultSettings: BranchSettings = fallback || {
    branchDisplayName: "Main Outlet",
    address: "Commercial Area",
    phone: "+92 300 0000000",
    printerIp: "192.168.1.180",
    kitchenBuzzerEnabled: true,
    openingTime: "11:00 AM",
    closingTime: "02:00 AM",
    taxRatePercent: 16.0,
  };

  if (typeof window === "undefined") return defaultSettings;
  try {
    const key = `${SETTINGS_KEY_PREFIX}${restaurantId}_${branchId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          ...defaultSettings,
          ...parsed,
        };
      }
    }
  } catch {}
  return defaultSettings;
}

/**
 * Save tenant-scoped branch settings.
 */
export function saveStoredBranchSettings(
  restaurantId: string = "default",
  branchId: string = "main",
  settings: BranchSettings
): void {
  if (typeof window === "undefined") return;
  try {
    const key = `${SETTINGS_KEY_PREFIX}${restaurantId}_${branchId}`;
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {}
}

