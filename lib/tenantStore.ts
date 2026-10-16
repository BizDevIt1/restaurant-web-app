import { AuthenticatedUser, BranchData, MenuItem, StaffMember, UserRole, OrderRecord, KitchenTicket, TableStatus, BranchSettings } from "../app/admin/types";
import {
  getActiveAuthSession,
  setAuthSession,
  clearAllAuthSessions,
  AuthSession,
} from "./auth";
import { isShiftForCurrentDayAndValid } from "./shiftSchedule";

// Key Constants for LocalStorage Persistence
const ACTIVE_USER_KEY = "omni_active_user";
const FRANCHISE_BRANCHES_KEY = "omni_franchise_branches";
const BRANCH_ACCOUNTS_KEY = "omni_branch_accounts";
const MENU_KEY_PREFIX = "omni_menu_";
const RAW_RECIPES_KEY_PREFIX = "omni_raw_recipes_";
const BASE_MATERIALS_KEY_PREFIX = "omni_base_materials_";
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
    setTimeout(() => {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(
        new CustomEvent("pos_menu_updated", {
          detail: { orgId, menu, timestamp: Date.now() },
        })
      );
    }, 0);
  } catch {}
}

/**
 * Get tenant-scoped stored raw recipe rows for synchronous hydration.
 */
export function getStoredRawRecipes(orgId: string = "default"): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${RAW_RECIPES_KEY_PREFIX}${orgId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Save tenant-scoped stored raw recipe rows.
 */
export function saveStoredRawRecipes(orgId: string = "default", recipes: any[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${RAW_RECIPES_KEY_PREFIX}${orgId}`, JSON.stringify(recipes || []));
  } catch {}
}

/**
 * Get tenant-scoped stored base materials entries for synchronous hydration.
 */
export function getStoredBaseMaterials(orgId: string = "default"): [string, any][] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${BASE_MATERIALS_KEY_PREFIX}${orgId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Save tenant-scoped stored base materials entries.
 */
export function saveStoredBaseMaterials(orgId: string = "default", materialsMap: Map<string, any>): void {
  if (typeof window === "undefined") return;
  try {
    const entries = Array.from(materialsMap.entries());
    localStorage.setItem(`${BASE_MATERIALS_KEY_PREFIX}${orgId}`, JSON.stringify(entries));
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
      if (Array.isArray(parsed)) {
        const map = new Map<string | number, OrderRecord>();
        parsed.forEach((o: any) => {
          const key = String(o.id || o.order_number || o.order_id || "").trim();
          if (key && !map.has(key)) {
            map.set(key, o);
          }
        });
        return Array.from(map.values());
      }
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
    const updated = [order, ...existing.filter((o) => String(o.id) !== String(order.id))];
    localStorage.setItem(`${ORDERS_KEY_PREFIX}${tenantId}`, JSON.stringify(updated));
  } catch {}
}

/**
 * Save an array of orders to tenant storage.
 */
export function saveStoredOrders(tenantId: string = "default", orders: OrderRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const map = new Map<string | number, OrderRecord>();
    orders.forEach((o: any) => {
      const key = String(o.id || o.order_number || o.order_id || "").trim();
      if (key && !map.has(key)) {
        map.set(key, o);
      }
    });
    const cleanOrders = Array.from(map.values());
    localStorage.setItem(`${ORDERS_KEY_PREFIX}${tenantId}`, JSON.stringify(cleanOrders));
  } catch {}
}

/**
 * Purge tenant-scoped local and session storage caches for orders, running KOTs, parked orders, shifts, and tables.
 * If tenantId is specified, scrubs all order/shift keys for that specific tenant.
 * If tenantId is omitted or "all", scrubs order/shift keys across all tenants.
 */
export function purgeTenantOrderCache(tenantId?: string | number): void {
  if (typeof window === "undefined") return;
  try {
    const tId = tenantId !== undefined && tenantId !== null ? String(tenantId).trim() : null;

    const isTargetKey = (key: string): boolean => {
      const isOrderRelated =
        key.startsWith("omni_orders_") ||
        key.startsWith("pos_running_kot_orders_") ||
        key.startsWith("omni_terminal_parked_orders_") ||
        key.startsWith("pos_active_shift_") ||
        key.startsWith("pos_require_opening_float_") ||
        key.startsWith("pos_cart_") ||
        key.startsWith("pos_customer_name_") ||
        key.startsWith("pos_customer_phone_") ||
        key.startsWith("pos_tax_rate_") ||
        key.startsWith("omni_kds_") ||
        key.startsWith("omni_tables_") ||
        key.startsWith("tables_list_") ||
        key.startsWith("pos_session_float_confirmed_");

      if (!isOrderRelated) return false;
      if (!tId || tId === "all") return true;
      return key.endsWith(`_${tId}`);
    };

    // Clean localStorage
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && isTargetKey(key)) {
        localStorage.removeItem(key);
      }
    }

    // Clean sessionStorage
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && isTargetKey(key)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn("[tenantStore] purgeTenantOrderCache error:", err);
  }
}

/**
 * Purge order and KOT caches from other tenants to prevent cross-tenant contamination.
 */
export function purgeStaleOrderCachesExcept(activeTenantId: string | number): void {
  if (typeof window === "undefined") return;
  try {
    const keepId = String(activeTenantId).trim();
    if (!keepId) return;

    const isStaleKey = (key: string): boolean => {
      const isOrderCache =
        key.startsWith("omni_orders_") ||
        key.startsWith("pos_running_kot_orders_") ||
        key.startsWith("omni_terminal_parked_orders_");

      if (!isOrderCache) return false;
      return !key.endsWith(`_${keepId}`);
    };

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && isStaleKey(key)) {
        localStorage.removeItem(key);
      }
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && isStaleKey(key)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn("[tenantStore] purgeStaleOrderCachesExcept error:", err);
  }
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
    // Cross-sync with admin tables_list_ storage
    const adminRaw = localStorage.getItem(`tables_list_${tenantId}`);
    if (adminRaw) {
      const parsed = JSON.parse(adminRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t: any, idx: number) => {
          let resolvedId = idx + 1;
          const numId = Number(t.id);
          if (!isNaN(numId) && numId > 0 && numId < 100000) {
            resolvedId = numId;
          } else if (t.table_number) {
            const extracted = parseInt(String(t.table_number).replace(/\D/g, ""), 10);
            if (!isNaN(extracted) && extracted > 0) resolvedId = extracted;
          }
          let label = String(t.table_number || t.label || `Table ${resolvedId}`).trim();
          if (/^\d+$/.test(label)) label = `Table ${label}`;
          return {
            id: resolvedId,
            label,
            capacity: Number(t.seating_capacity ?? t.capacity ?? 4),
            status: String(t.status || "AVAILABLE").toLowerCase() === "occupied" ? "seated" : String(t.status || "AVAILABLE").toLowerCase() === "billed" ? "billing" : String(t.status || "AVAILABLE").toLowerCase() === "reserved" ? "reserved" : "available",
            section: t.section_name || t.floor_name || t.section || "Main Dining",
            dbId: t.id || t.dbId,
          };
        });
      }
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
    localStorage.setItem(`tables_list_${tenantId}`, JSON.stringify(tables));
  } catch {}
}

/**
 * Real Web Audio API Kitchen Buzzer / Chime.
 * Synthesizes a crisp dual-tone order alert bell without any external audio file dependencies.
 */
export function playKitchenBuzzer(isRush: boolean = false): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (isRush) {
      // Urgent, rapid high-pitched triple-burst buzzer for rush orders
      const bursts = [
        { time: now, freq: 1100, dur: 0.12 },
        { time: now + 0.15, freq: 1320, dur: 0.12 },
        { time: now + 0.30, freq: 1540, dur: 0.22 },
      ];
      bursts.forEach(({ time, freq, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
      });
      return;
    }

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

/**
 * Synthesizes a bright, pleasant 3-tone service bell chime (C6 -> E6 -> G6)
 * for waiter terminals when orders become ready for pickup.
 * Pure Web Audio API synthesis without external audio files.
 */
export function playWaiterChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic 3-note ascending restaurant service bell chime (C6: 1046.5Hz -> E6: 1318.5Hz -> G6: 1568Hz)
    const notes = [
      { freq: 1046.5, time: now, dur: 0.35, gain: 0.28 },
      { freq: 1318.51, time: now + 0.12, dur: 0.45, gain: 0.32 },
      { freq: 1567.98, time: now + 0.24, dur: 0.8, gain: 0.38 },
    ];

    notes.forEach(({ freq, time, dur, gain: targetGain }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(targetGain, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
    });
  } catch {
    // AudioContext permission or browser autoplay policies safely caught
  }
}

/**
 * Synthesizes a loud, distinct restaurant service buzzer / buzzer chime
 * specifically for active Waiter Terminal sessions when an order or dish is marked ready in the kitchen.
 */
export function playWaiterBuzzer(isRush?: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    if (isRush) {
      // Rapid urgent 3-burst attention buzzer for rush orders
      const bursts = [
        { time: now, freq: 1174.66, dur: 0.14, gain: 0.4 },
        { time: now + 0.16, freq: 1396.91, dur: 0.14, gain: 0.45 },
        { time: now + 0.32, freq: 1760.00, dur: 0.35, gain: 0.5 },
      ];
      bursts.forEach(({ time, freq, dur, gain: targetGain }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(targetGain, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
      });
      return;
    }

    // Standard restaurant service bell chime: crisp ding (1046Hz C6) followed by ringing harmonic (1568Hz G6)
    const tones = [
      { freq: 1046.50, time: now, dur: 0.32, gain: 0.38, type: "sine" as OscillatorType },
      { freq: 1318.51, time: now + 0.12, dur: 0.40, gain: 0.42, type: "sine" as OscillatorType },
      { freq: 1567.98, time: now + 0.22, dur: 0.75, gain: 0.48, type: "triangle" as OscillatorType },
    ];

    tones.forEach(({ freq, time, dur, gain: targetGain, type }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(targetGain, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
    });
  } catch {
    // AudioContext permission or browser autoplay policies safely caught
  }
}

/**
 * Synthesizes a distinctive dual-tone notification chime (F6 -> A6)
 * for kitchen terminals when an active ticket is modified (items added/removed/changed).
 * Pure Web Audio API synthesis without external audio files.
 */
export function playModificationChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const notes = [
      { freq: 1396.91, time: now, dur: 0.25, gain: 0.3 }, // F6
      { freq: 1760.00, time: now + 0.1, dur: 0.5, gain: 0.35 }, // A6
    ];

    notes.forEach(({ freq, time, dur, gain: targetGain }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(targetGain, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
    });
  } catch {
    // AudioContext permission or browser autoplay policies safely caught
  }
}

export const DEFAULT_CORE_FEATURES = [
  "OVERVIEW",
  "STAFF",
  "SETTINGS",
  "SUBSCRIPTION",
];

/**
 * Helper to normalize module names into standard feature strings.
 * Core features are always-on; 9 granular enterprise modules require explicit assignment:
 * 1. POS Terminal -> POS
 * 2. Menu Management -> MENU
 * 3. Inventory & Stock -> INVENTORY
 * 4. KDS Queue -> KDS, KITCHEN
 * 5. Rider Fleet -> RIDER
 * 6. Table & Floor Matrix -> TABLES
 * 7. Procurement -> PROCUREMENT
 * 8. Expenses -> EXPENSES
 * 9. Reports -> REPORTS, ANALYTICS
 */
export function normalizeModules(modules: any): string[] {
  if (!Array.isArray(modules) || modules.length === 0) {
    return [...DEFAULT_CORE_FEATURES];
  }
  const mapping: Record<string, string[]> = {
    pos_terminal: ["POS"],
    pos: ["POS"],
    menu: ["MENU"],
    inventory_stock: ["INVENTORY"],
    inventory: ["INVENTORY"],
    kds_system: ["KDS", "KITCHEN"],
    kds: ["KDS", "KITCHEN"],
    kitchen: ["KDS", "KITCHEN"],
    rider_app: ["RIDER"],
    rider: ["RIDER"],
    riders: ["RIDER"],
    dispatch: ["RIDER"],
    table_matrix: ["TABLES"],
    tables: ["TABLES"],
    procurement: ["PROCUREMENT"],
    expenses: ["EXPENSES"],
    reports: ["REPORTS", "ANALYTICS"],
    analytics: ["REPORTS", "ANALYTICS"],
    branches: ["BRANCHES"],
  };

  const assigned: string[] = [];
  modules.forEach((m: any) => {
    const lower = String(m || "").toLowerCase().trim();
    if (mapping[lower]) {
      assigned.push(...mapping[lower]);
    } else if (typeof m === "string" && m.trim()) {
      assigned.push(m.toUpperCase().trim());
    }
  });

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
            enableKitchenKds: matchedSa.enable_kitchen_kds ?? matchedSa.enableKitchenKds ?? true,
            enableTableService: matchedSa.enable_table_service ?? matchedSa.enableTableService ?? true,
            enableDirectThermalPrint: matchedSa.enable_direct_thermal_print ?? matchedSa.enableDirectThermalPrint ?? true,
            enableOfflineSync: matchedSa.enable_offline_sync ?? matchedSa.enableOfflineSync ?? true,
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
      assignedShift: session.assignedShift || (session as any).shift,
      enableKitchenKds: (session as any).enableKitchenKds ?? (session as any).enable_kitchen_kds ?? true,
      enableTableService: (session as any).enableTableService ?? (session as any).enable_table_service ?? true,
      enableDirectThermalPrint: (session as any).enableDirectThermalPrint ?? (session as any).enable_direct_thermal_print ?? true,
      enableOfflineSync: (session as any).enableOfflineSync ?? (session as any).enable_offline_sync ?? true,
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
      purgeTenantOrderCache();
      clearAllAuthSessions();
      return;
    }

    const previousSession = getActiveAuthSession();
    const prevOrgId = previousSession ? String(previousSession.organizationId) : "";
    const prevUserId = previousSession ? String(previousSession.id) : "";

    const sanitized = sanitizeUserSession(user);
    if (!sanitized) {
      purgeTenantOrderCache();
      clearAllAuthSessions();
      return;
    }

    const newOrgId = String(sanitized.organizationId || sanitized.restaurantId || "");
    const newUserId = String(sanitized.id || "");

    // Clear stale state on tenant change or staff profile switch
    if (prevOrgId && newOrgId && prevOrgId !== newOrgId) {
      purgeTenantOrderCache(prevOrgId);
      purgeStaleOrderCachesExcept(newOrgId);
    } else if (prevUserId && newUserId && prevUserId !== newUserId) {
      // Staff profile switch: clear session shift/cart state
      purgeTenantOrderCache(newOrgId);
    } else if (!prevOrgId && newOrgId) {
      purgeStaleOrderCachesExcept(newOrgId);
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
      assignedShift: sanitized.assignedShift,
    };

    setAuthSession(session);

    // Maintain session confirmation state strictly for active current-day shifts
    if (typeof window !== "undefined") {
      try {
        const staffKey = String(sanitized.id || sanitized.email || sanitized.name || "cashier").toLowerCase().replace(/[^a-z0-9]/g, "_");
        const rawShift = sessionStorage.getItem(`pos_active_shift_${sanitized.organizationId || "default"}`) ||
          localStorage.getItem(`pos_active_shift_${sanitized.organizationId || "default"}`);
        let isValidTodayShift = false;
        if (rawShift) {
          try {
            const parsed = JSON.parse(rawShift);
            isValidTodayShift = isShiftForCurrentDayAndValid(parsed);
          } catch {}
        }

        if (isValidTodayShift) {
          sessionStorage.setItem(`pos_session_float_confirmed_${staffKey}`, "true");
          localStorage.setItem(`pos_session_float_confirmed_${staffKey}`, "true");
        } else {
          // If no shift or stale shift from previous date, clear confirmed flags so opening float is required
          sessionStorage.removeItem(`pos_session_float_confirmed_${staffKey}`);
          localStorage.removeItem(`pos_session_float_confirmed_${staffKey}`);
          sessionStorage.removeItem("pos_session_float_confirmed_global");
          localStorage.removeItem("pos_session_float_confirmed_global");
          sessionStorage.removeItem(`pos_active_shift_${sanitized.organizationId || "default"}`);
          localStorage.removeItem(`pos_active_shift_${sanitized.organizationId || "default"}`);
        }
      } catch {}
    }
  } catch (err) {
    console.error("[tenantStore] Error setting active user session:", err);
  }
}

/**
 * Clear user session (Logout).
 */
export function clearUserSession(): void {
  if (typeof window !== "undefined") {
    try {
      purgeTenantOrderCache();
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (
          key &&
          (key.startsWith("pos_session_float_confirmed_") ||
            key.startsWith("pos_active_shift_") ||
            key.startsWith("pos_require_opening_float_"))
        ) {
          sessionStorage.removeItem(key);
        }
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("pos_session_float_confirmed_") ||
            key.startsWith("pos_active_shift_") ||
            key.startsWith("pos_require_opening_float_"))
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch {}
  }
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
    let resolvedTax: number | undefined;
    const directTax = localStorage.getItem(`pos_tax_rate_${restaurantId}`);
    if (directTax !== null && !isNaN(Number(directTax))) {
      resolvedTax = Number(directTax);
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          ...defaultSettings,
          ...parsed,
          taxRatePercent: resolvedTax !== undefined ? resolvedTax : (parsed.taxRatePercent ?? defaultSettings.taxRatePercent),
        };
      }
    }
    if (resolvedTax !== undefined) {
      return {
        ...defaultSettings,
        taxRatePercent: resolvedTax,
      };
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
  settings: Partial<BranchSettings>
): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredBranchSettings(restaurantId, branchId);
    const merged = { ...existing, ...settings };
    const key = `${SETTINGS_KEY_PREFIX}${restaurantId}_${branchId}`;
    localStorage.setItem(key, JSON.stringify(merged));
  } catch {}
}

