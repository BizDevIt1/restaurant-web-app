import { createClient } from "./supabase";
import { applyOrderFilter, safeUpdateKitchenTicket } from "./kitchenTicketSync";

/**
 * 4-Hour Stale Order Expiry Cutoff in milliseconds.
 * 4 hours = 4 * 60 * 60 * 1000 = 14,400,000 ms.
 */
export const ORDER_EXPIRY_CUTOFF_MS = 4 * 60 * 60 * 1000;

export interface ExpiryCheckableOrder {
  id?: string | number;
  order_number?: string;
  orderNumber?: string;
  status?: string;
  order_status?: string;
  orderStatus?: string;
  payment_status?: string;
  paymentStatus?: string;
  created_at?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  timestamp?: string | number | Date | null;
  date?: string | number | Date | null;
  notes?: string | null;
  isExpired?: boolean;
  is_expired?: boolean;
  [key: string]: any;
}

export interface ExpiryCheckableTicket {
  id?: string;
  ticket_number?: string;
  status?: string;
  created_at?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  timestamp?: string | number | Date | null;
  notes?: string | null;
  isExpired?: boolean;
  is_expired?: boolean;
  [key: string]: any;
}

/**
 * Parses a creation timestamp into epoch milliseconds.
 */
export function getOrderCreationEpochMs(item: ExpiryCheckableOrder | ExpiryCheckableTicket): number | null {
  if (!item) return null;

  const rawTime =
    item.created_at ||
    item.createdAt ||
    item.timestamp ||
    item.date;

  if (!rawTime) return null;

  if (typeof rawTime === "number") {
    // If timestamp in seconds instead of ms
    return rawTime < 10000000000 ? rawTime * 1000 : rawTime;
  }

  if (rawTime instanceof Date) {
    return rawTime.getTime();
  }

  const parsed = new Date(String(rawTime)).getTime();
  return isNaN(parsed) ? null : parsed;
}

/**
 * Checks whether an order is stale/expired beyond the 4-hour cutoff.
 * If an order is already settled/completed and paid, it is not expired.
 */
export function isOrderExpired(order: ExpiryCheckableOrder | null | undefined, nowMs: number = Date.now()): boolean {
  if (!order) return false;

  // Fully completed, archived, or paid orders are not expired
  if (
    order.status === "archived" ||
    order.order_status === "archived" ||
    order.orderStatus === "archived" ||
    order.status === "voided" ||
    order.order_status === "voided"
  ) {
    return false;
  }

  // Explicit expired flag
  if (order.isExpired === true || order.is_expired === true) return true;
  if (order.status === "expired" || order.order_status === "expired" || order.orderStatus === "expired") return true;
  if (typeof order.notes === "string" && order.notes.includes("[EXPIRED")) return true;

  // Fully completed and settled orders are not expired
  const isCompleted =
    order.order_status === "completed" ||
    order.orderStatus === "completed" ||
    order.status === "completed";
  const isPaid =
    order.payment_status === "paid" ||
    order.paymentStatus === "paid";

  if (isCompleted && isPaid) {
    return false;
  }

  // If order is cancelled, check if it was cancelled due to expiry
  if (order.order_status === "cancelled" || order.status === "cancelled") {
    if (typeof order.notes === "string" && order.notes.includes("EXPIRED")) {
      return true;
    }
  }

  // Calculate age against 4-hour cutoff
  const creationMs = getOrderCreationEpochMs(order);
  if (!creationMs) return false;

  const ageMs = nowMs - creationMs;
  return ageMs >= ORDER_EXPIRY_CUTOFF_MS;
}

/**
 * Checks whether a kitchen ticket is stale/expired beyond the 4-hour cutoff.
 */
export function isTicketExpired(ticket: ExpiryCheckableTicket | null | undefined, nowMs: number = Date.now()): boolean {
  if (!ticket) return false;

  // Completed, archived, cancelled, or voided tickets are resolved and not active expired
  if (
    ticket.status === "completed" ||
    ticket.status === "archived" ||
    ticket.status === "voided" ||
    ticket.status === "cancelled"
  ) {
    return false;
  }

  if (ticket.isExpired === true || ticket.is_expired === true) return true;
  if (ticket.status === "expired") return true;
  if (typeof ticket.notes === "string" && ticket.notes.includes("[EXPIRED")) return true;

  const creationMs = getOrderCreationEpochMs(ticket);
  if (!creationMs) return false;

  const ageMs = nowMs - creationMs;
  return ageMs >= ORDER_EXPIRY_CUTOFF_MS;
}

/**
 * Synchronizes an expired order and ticket across Supabase and broadcasts realtime events.
 * Abides by Postgres CHECK constraints:
 * - orders.order_status IN ('active', 'completed', 'cancelled') -> sets to 'cancelled'
 * - kitchen_tickets.status IN ('queued', 'preparing', 'ready', 'completed') -> sets to 'completed'
 * Frees any locked dining table back to 'available'.
 */
export async function syncOrderExpiredState(
  restaurantId: string | number,
  orderNumberOrId: string,
  options?: {
    ticketNumber?: string;
    tableIdentifier?: string;
    tableDbId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const restIdNum = Number(restaurantId) || restaurantId;
    const nowIso = new Date().toISOString();
    const expiryNote = "[EXPIRED / STALE (4-HOUR CUTOFF)]";

    // 1. Update orders table in Supabase
    if (orderNumberOrId) {
      let orderQuery: any = supabase
        .from("orders")
        .update({
          order_status: "cancelled",
        })
        .eq("restaurant_id", restIdNum);
      orderQuery = applyOrderFilter(orderQuery, orderNumberOrId);
      await orderQuery;
    }

    // 2. Update kitchen_tickets table in Supabase
    const targetTicket = options?.ticketNumber || orderNumberOrId;
    if (targetTicket) {
      await safeUpdateKitchenTicket(
        supabase,
        targetTicket,
        {
          status: "completed",
          completed_at: nowIso,
        },
        null,
        restIdNum
      );
    }

    // 3. Free locked dining table if any
    if (options?.tableDbId) {
      await supabase
        .from("restaurant_tables")
        .update({
          status: "available",
          active_order_id: null,
          updated_at: nowIso,
        })
        .eq("restaurant_id", restIdNum)
        .eq("id", options.tableDbId);
    } else if (options?.tableIdentifier) {
      await supabase
        .from("restaurant_tables")
        .update({
          status: "available",
          active_order_id: null,
          updated_at: nowIso,
        })
        .eq("restaurant_id", restIdNum)
        .eq("table_number", options.tableIdentifier);
    }

    // 4. Dispatch cross-tab / window realtime broadcast
    if (typeof window !== "undefined") {
      try {
        const detail = {
          restaurantId: restIdNum,
          orderId: orderNumberOrId,
          ticketNumber: options?.ticketNumber,
          tableIdentifier: options?.tableIdentifier,
          timestamp: Date.now(),
        };
        window.dispatchEvent(new CustomEvent("order_expired", { detail }));
        window.dispatchEvent(new CustomEvent("restaurant_tables_changed"));
        localStorage.setItem(`order_expired_${restIdNum}_${orderNumberOrId}`, JSON.stringify(detail));
      } catch {}
    }

    return { success: true };
  } catch (err: any) {
    console.warn("[orderExpiry] Error syncing expired state to DB:", err);
    return { success: false, error: err?.message || String(err) };
  }
}
