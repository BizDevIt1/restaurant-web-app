import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks if a value is a valid UUID string format.
 */
export const isUuid = (val?: string | number | null): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim());
};

export interface TicketIdentifierTarget {
  id?: string | number;
  dbId?: string | number;
  ticket_number?: string;
}

/**
 * Safely applies targeting filter to a Supabase kitchen_tickets query.
 * Prevents PostgreSQL '22P02: invalid input syntax for type uuid' errors
 * when passing non-UUID ticket numbers (e.g. 'KOT-1234') into UUID columns.
 */
export function applyTicketFilter<T = any>(
  query: T,
  ticketId: string | number,
  ticket?: TicketIdentifierTarget | null
): T {
  const q: any = query;
  // 1. If explicit dbId is a valid UUID, target by primary key 'id'
  if (ticket?.dbId && isUuid(ticket.dbId)) {
    return q.eq("id", String(ticket.dbId));
  }
  // 2. If ticketId itself is a valid UUID, target by 'id'
  if (isUuid(ticketId)) {
    return q.eq("id", String(ticketId));
  }
  // 3. If ticket object has an id that is a UUID, target by 'id'
  if (ticket?.id && isUuid(ticket.id)) {
    return q.eq("id", String(ticket.id));
  }
  // 4. Otherwise target by 'ticket_number' column (TEXT)
  const cleanNum = ticket?.ticket_number || String(ticketId);
  return q.eq("ticket_number", cleanNum);
}

/**
 * Safely applies targeting filter to a Supabase orders query.
 * Prevents PostgreSQL '22P02' errors when passing non-UUID order numbers (e.g. '#ORD-1234').
 */
export function applyOrderFilter<T = any>(
  query: T,
  orderId: string | number,
  order?: { id?: string | number; order_number?: string; orderNumber?: string } | null
): T {
  const q: any = query;
  if (order?.id && isUuid(order.id)) {
    return q.eq("id", String(order.id));
  }
  if (isUuid(orderId)) {
    return q.eq("id", String(orderId));
  }
  const cleanOrderNum = order?.order_number || order?.orderNumber || String(orderId);
  return q.eq("order_number", cleanOrderNum);
}

/**
 * Executes a resilient, error-checked update on kitchen_tickets.
 * Logs any database error and returns success status.
 */
export async function safeUpdateKitchenTicket(
  supabase: SupabaseClient,
  ticketId: string | number,
  payload: Record<string, any>,
  ticket?: TicketIdentifierTarget | null,
  restaurantId?: string | number | null
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const cleanPayload = { ...payload };
    delete cleanPayload.is_expired;
    delete cleanPayload.isExpired;
    delete cleanPayload.was_expired;

    let query: any = supabase.from("kitchen_tickets").update(cleanPayload);
    if (restaurantId) {
      query = query.eq("restaurant_id", restaurantId);
    }
    query = applyTicketFilter(query, ticketId, ticket);
    const { data, error } = await query;
    if (error) {
      console.error("[safeUpdateKitchenTicket] Update failed:", error.message || error, {
        ticketId,
        payload: cleanPayload,
      });
      // Fallback: If primary target was id and it failed or vice versa, attempt fallback
      if (ticket?.ticket_number && isUuid(ticketId)) {
        let fallbackQuery: any = supabase
          .from("kitchen_tickets")
          .update(cleanPayload)
          .eq("ticket_number", ticket.ticket_number);
        if (restaurantId) fallbackQuery = fallbackQuery.eq("restaurant_id", restaurantId);
        const { data: fbData, error: fbErr } = await fallbackQuery;
        if (!fbErr) return { success: true, data: fbData };
      }
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error("[safeUpdateKitchenTicket] Unexpected error during update:", err);
    return { success: false, error: err };
  }
}
