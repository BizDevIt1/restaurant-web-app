/**
 * OMNIBITES PLATFORM - SHIFT AUDIT & NOTIFICATION ENGINE
 * File: lib/shiftAuditNotifications.ts
 *
 * Provides utilities for:
 * 1. Tracking consecutive staff shifts & total duration
 * 2. Logging audit events and dispatching real-time notifications to the Admin Dashboard
 * 3. Persisting notifications for admin review
 */

import { OperationalNotification } from "@/app/admin/types";

const NOTIFICATIONS_KEY_PREFIX = "omni_notifications_";

export interface StaffShiftSummary {
  staffName: string;
  totalShiftsCount: number;
  isConsecutive: boolean;
  firstShiftStart: string;
  lastShiftEnd?: string;
  totalHoursWorked: number;
  totalSales: number;
  shifts: any[];
}

/**
 * Retrieve notifications stored in localStorage for a tenant/restaurant
 */
/**
 * Retrieve notifications stored in localStorage for a tenant/restaurant
 */
export function getStoredNotifications(tenantId: string = "default"): OperationalNotification[] {
  if (typeof window === "undefined") return [];

  const seenIds = new Set<string>();
  const merged: OperationalNotification[] = [];

  const tryAddList = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              merged.push(item);
            }
          }
        }
      }
    } catch {}
  };

  // 1. Check primary tenant key
  tryAddList(`${NOTIFICATIONS_KEY_PREFIX}${tenantId}`);

  // 2. Check global mirror key
  tryAddList(`${NOTIFICATIONS_KEY_PREFIX}global`);

  // 3. Check default fallback key
  if (tenantId !== "default") {
    tryAddList(`${NOTIFICATIONS_KEY_PREFIX}default`);
  }

  if (merged.length > 0) {
    return merged.slice(0, 40);
  }

  // Provide helpful initial operational notifications if first session
  const initialNotifs: OperationalNotification[] = [
    {
      id: "notif_system_ready",
      title: "OmniBites System Active",
      message: "POS Terminal, KDS Kitchen Display, and Inventory Ledger are online and operational.",
      type: "info",
      timestamp: "Today",
      branchName: "Main Branch",
      read: false,
    },
    {
      id: "notif_shift_monitor",
      title: "Real-time Audits & Shift Monitoring",
      message: "Shift tracking, multi-shift rollovers, and cash drawer reconciliations active.",
      type: "info",
      timestamp: "Today",
      branchName: "Main Branch",
      read: true,
    },
  ];

  try {
    localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}${tenantId}`, JSON.stringify(initialNotifs));
  } catch {}
  return initialNotifs;
}

/**
 * Save / prepend a notification and dispatch cross-component event
 */
export function addAdminNotification(
  tenantId: string = "default",
  notification: Omit<OperationalNotification, "id" | "timestamp" | "read"> & {
    id?: string;
    timestamp?: string;
    read?: boolean;
  }
): OperationalNotification {
  if (typeof window === "undefined") {
    return {
      id: notification.id || `notif_${Date.now()}`,
      title: notification.title,
      message: notification.message,
      type: notification.type || "info",
      timestamp: notification.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      branchName: notification.branchName,
      read: false,
    };
  }

  const existing = getStoredNotifications(tenantId);
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const newNotif: OperationalNotification = {
    id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: notification.title,
    message: notification.message,
    type: notification.type || "info",
    timestamp: notification.timestamp || timeFormatted,
    branchName: notification.branchName,
    read: notification.read ?? false,
  };

  const updated = [newNotif, ...existing.filter((n) => n.id !== newNotif.id)].slice(0, 40);

  try {
    // 1. Write to target tenant storage
    localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}${tenantId}`, JSON.stringify(updated));

    // 2. Mirror to global broadcast key
    localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}global`, JSON.stringify(updated));

    // 3. Mirror to default key if different
    if (tenantId !== "default") {
      const defaultExisting = getStoredNotifications("default");
      const updatedDefault = [newNotif, ...defaultExisting.filter((n) => n.id !== newNotif.id)].slice(0, 40);
      localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}default`, JSON.stringify(updatedDefault));
    }

    // 4. Fire storage sync tick so listening tabs/windows wake up immediately
    localStorage.setItem("omni_notifications_sync_tick", JSON.stringify({
      tick: Date.now(),
      tenantId,
      id: newNotif.id,
      title: newNotif.title,
    }));

    // 5. Dispatch event so AdminHeader and dashboard in current tab update immediately
    window.dispatchEvent(new CustomEvent("omni_notifications_updated", { detail: updated }));
  } catch (err) {
    console.warn("[shiftAuditNotifications] Error saving notification:", err);
  }

  return newNotif;
}

/**
 * Mark all notifications as read for a given tenant
 */
export function markAllNotificationsRead(tenantId: string = "default"): void {
  if (typeof window === "undefined") return;
  const existing = getStoredNotifications(tenantId);
  const updated = existing.map((n) => ({ ...n, read: true }));
  try {
    localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}${tenantId}`, JSON.stringify(updated));
    localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}global`, JSON.stringify(updated));
    if (tenantId !== "default") {
      localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}default`, JSON.stringify(updated));
    }
    localStorage.setItem("omni_notifications_sync_tick", JSON.stringify({ tick: Date.now(), markedRead: true }));
    window.dispatchEvent(new CustomEvent("omni_notifications_updated", { detail: updated }));
  } catch (err) {
    console.warn("[shiftAuditNotifications] Error marking read:", err);
  }
}

/**
 * Dismiss a specific notification by ID
 */
export function dismissNotification(tenantId: string = "default", notifId: string): void {
  if (typeof window === "undefined") return;
  const existing = getStoredNotifications(tenantId);
  const updated = existing.filter((n) => n.id !== notifId);
  try {
    localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}${tenantId}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("omni_notifications_updated", { detail: updated }));
  } catch (err) {
    console.warn("[shiftAuditNotifications] Error dismissing notification:", err);
  }
}

/**
 * Clear all notifications for a given tenant
 */
export function clearAllNotifications(tenantId: string = "default"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${NOTIFICATIONS_KEY_PREFIX}${tenantId}`, JSON.stringify([]));
    window.dispatchEvent(new CustomEvent("omni_notifications_updated", { detail: [] }));
  } catch (err) {
    console.warn("[shiftAuditNotifications] Error clearing notifications:", err);
  }
}

/**
 * Record a seamless multi-shift rollover event and notify the Admin Dashboard
 */
export function recordMultiShiftRolloverEvent(
  tenantId: string = "default",
  data: {
    staffName: string;
    previousShiftType: string;
    newShiftType: string;
    consecutiveShiftNumber: number;
    initialShiftStart: string;
    currentRolloverTime?: string;
    previousShiftSales?: number;
    branchName?: string;
  }
): OperationalNotification {
  const startTime = new Date(data.initialShiftStart).getTime();
  const now = Date.now();
  const diffHours = !isNaN(startTime) && startTime > 0 ? ((now - startTime) / (1000 * 60 * 60)).toFixed(1) : "0.0";
  const startFormatted = !isNaN(startTime)
    ? new Date(data.initialShiftStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Earlier";
  const nowFormatted = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const salesInfo = data.previousShiftSales !== undefined && data.previousShiftSales > 0
    ? ` • Previous Segment Sales: Rs ${data.previousShiftSales.toLocaleString()}`
    : "";

  return addAdminNotification(tenantId, {
    title: `Multi-Shift Rollover: ${data.staffName}`,
    message: `${data.staffName} seamlessly started consecutive shift (${data.newShiftType}) after completing ${data.previousShiftType}. Working ${diffHours} hrs total (${startFormatted} - ${nowFormatted})${salesInfo}.`,
    type: "info",
    branchName: data.branchName || "Main Register",
  });
}

/**
 * Analyze an array of shift settlements and compute consecutive multi-shift statistics per staff
 */
export function analyzeStaffMultiShifts(settlements: any[]): Record<string, StaffShiftSummary> {
  const result: Record<string, StaffShiftSummary> = {};

  if (!Array.isArray(settlements) || settlements.length === 0) {
    return result;
  }

  // Sort chronologically ascending
  const sorted = [...settlements].sort((a, b) => {
    const timeA = new Date(a.shift_start || a.created_at).getTime();
    const timeB = new Date(b.shift_start || b.created_at).getTime();
    return timeA - timeB;
  });

  sorted.forEach((shift) => {
    const staffName = shift.cashier_name?.trim() || "Cashier";
    const startTime = new Date(shift.shift_start || shift.created_at).getTime();
    const endTime = shift.shift_end || shift.closed_at
      ? new Date(shift.shift_end || shift.closed_at).getTime()
      : Date.now();
    const durationHours = (!isNaN(startTime) && !isNaN(endTime) && endTime >= startTime)
      ? (endTime - startTime) / (1000 * 60 * 60)
      : 0;

    const sales = Number(shift.gross_sales || shift.system_cash_sales || 0);

    if (!result[staffName]) {
      result[staffName] = {
        staffName,
        totalShiftsCount: 1,
        isConsecutive: false,
        firstShiftStart: shift.shift_start || shift.created_at,
        lastShiftEnd: shift.shift_end || shift.closed_at,
        totalHoursWorked: Math.max(0, durationHours),
        totalSales: sales,
        shifts: [shift],
      };
    } else {
      const prev = result[staffName];
      prev.totalShiftsCount += 1;
      prev.isConsecutive = true;
      prev.lastShiftEnd = shift.shift_end || shift.closed_at || new Date().toISOString();
      prev.totalHoursWorked += Math.max(0, durationHours);
      prev.totalSales += sales;
      prev.shifts.push(shift);
    }
  });

  return result;
}

/**
 * Dispatch automated low stock or out-of-stock alert notification
 */
export function dispatchLowStockAlert(
  tenantId: string = "default",
  data: {
    itemName: string;
    currentStock: number;
    minSafetyStock: number;
    unit?: string;
    isRawMaterial?: boolean;
    branchName?: string;
  }
): OperationalNotification {
  const isOutOfStock = data.currentStock <= 0;
  const unitStr = data.unit ? ` ${data.unit}` : "";

  const title = isOutOfStock
    ? `Out of Stock: ${data.itemName}`
    : `Low Stock Warning: ${data.itemName}`;

  const message = isOutOfStock
    ? `${data.itemName} is completely depleted (0${unitStr} remaining). Linked menu items will be automatically suspended or portion-limited.`
    : `${data.itemName} inventory dropped to ${data.currentStock}${unitStr} (Safety threshold: ${data.minSafetyStock}${unitStr}). Reorder or procure soon.`;

  return addAdminNotification(tenantId, {
    title,
    message,
    type: isOutOfStock ? "urgent" : "warning",
    branchName: data.branchName || "Main Inventory",
  });
}

/**
 * Dispatch shift opening alert when a staff cashier opens a register session
 */
export function dispatchShiftOpenedAlert(
  tenantId: string = "default",
  data: {
    cashierName: string;
    shiftType: string;
    openingFloat: number;
    branchName?: string;
    registerName?: string;
  }
): OperationalNotification {
  return addAdminNotification(tenantId, {
    title: `Shift Register Opened: ${data.cashierName}`,
    message: `${data.cashierName} opened a new ${data.shiftType} session on ${data.registerName || "Register 01"}. Verified opening cash drawer float: Rs ${data.openingFloat.toLocaleString()}.`,
    type: "info",
    branchName: data.branchName || "Counter POS",
  });
}

/**
 * Dispatch Z-Report shift reconciliation and financial audit alert
 */
export function dispatchShiftSettlementAlert(
  tenantId: string = "default",
  data: {
    cashierName: string;
    shiftType: string;
    grossSales: number;
    actualCash: number;
    expectedCash: number;
    cashVariance: number;
    branchName?: string;
    threshold?: number;
  }
): OperationalNotification {
  const isBalanced = data.cashVariance === 0;
  const isOver = data.cashVariance > 0;
  const absVariance = Math.abs(data.cashVariance);
  const threshold = data.threshold ?? 500;
  const isFlagged = absVariance > threshold;

  let title = `Z-Report Settled: ${data.cashierName}`;
  let type: "success" | "warning" | "urgent" = "success";

  if (isFlagged) {
    title = `Z-Report Discrepancy Flagged: ${data.cashierName}`;
    type = "urgent";
  } else if (!isBalanced) {
    title = `Z-Report Cash Variance: ${data.cashierName}`;
    type = "warning";
  }

  const varianceText = isBalanced
    ? "Drawer balanced with zero variance."
    : `Cash variance of ${isOver ? "+" : "-"}Rs ${absVariance.toLocaleString()} (${isOver ? "Excess" : "Shortage"}). Expected: Rs ${data.expectedCash.toLocaleString()}, Counted: Rs ${data.actualCash.toLocaleString()}.`;

  const message = `${data.cashierName} completed shift close (${data.shiftType}). Gross Sales: Rs ${data.grossSales.toLocaleString()}. ${varianceText}`;

  return addAdminNotification(tenantId, {
    title,
    message,
    type,
    branchName: data.branchName || "Counter POS",
  });
}

/**
 * Dispatch operational exception alert when an order is cancelled or voided
 */
export function dispatchOrderCancelledAlert(
  tenantId: string = "default",
  data: {
    orderNumber: string | number;
    cashierName?: string;
    totalAmount?: number;
    reason?: string;
    itemCount?: number;
    branchName?: string;
  }
): OperationalNotification {
  const amountStr = data.totalAmount && data.totalAmount > 0 ? ` (Rs ${data.totalAmount.toLocaleString()})` : "";
  const itemsStr = data.itemCount ? ` with ${data.itemCount} items` : "";
  const staffStr = data.cashierName ? ` by ${data.cashierName}` : "";
  const reasonStr = data.reason ? ` Reason: "${data.reason}".` : "";

  return addAdminNotification(tenantId, {
    title: `Order Voided: #${data.orderNumber}`,
    message: `POS order #${data.orderNumber}${amountStr}${itemsStr} was cancelled/voided${staffStr}.${reasonStr}`,
    type: "warning",
    branchName: data.branchName || "Main Counter",
  });
}

/**
 * Dispatch system synchronization and integrity event alert
 */
export function dispatchSystemSyncAlert(
  tenantId: string = "default",
  data: {
    syncEvent: string;
    details: string;
    branchName?: string;
  }
): OperationalNotification {
  return addAdminNotification(tenantId, {
    title: `System Sync: ${data.syncEvent}`,
    message: data.details,
    type: "info",
    branchName: data.branchName || "Cloud Sync",
  });
}
