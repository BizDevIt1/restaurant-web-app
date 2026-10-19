import { createClient } from "@/lib/supabase";

export type TerminalMutationType =
  | "ORDER_MUTATION"
  | "TABLE_MUTATION"
  | "TICKET_MUTATION"
  | "TABLE_RELEASED"
  | "ORDER_VOIDED";

export interface TerminalMutationPayload {
  type: TerminalMutationType;
  tableId?: number | string;
  tableNumber?: string;
  orderId?: number | string;
  ticketId?: string;
  status?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface TerminalRealtimeCallbacks {
  onOrdersChange?: (payload?: any) => void;
  onTablesChange?: (payload?: any) => void;
  onTicketsChange?: (payload?: any) => void;
  onMutation?: (payload: TerminalMutationPayload) => void;
}

/**
 * Broadcasts an instant terminal mutation event across all browser tabs/windows
 * on this machine via BroadcastChannel and same-window CustomEvents.
 */
export function broadcastTerminalMutation(
  restId: string | number,
  payload: TerminalMutationPayload
): void {
  if (typeof window === "undefined") return;
  const restIdStr = String(restId);
  const fullPayload: TerminalMutationPayload = {
    ...payload,
    restId: restIdStr,
    timestamp: payload.timestamp || Date.now(),
  };

  // 1. Cross-tab BroadcastChannel (0ms latency fallback between tabs/windows)
  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(`omnibites_terminal_event_bus_${restIdStr}`);
      bc.postMessage(fullPayload);
      bc.close();
    } catch (e) {
      console.warn("[TerminalEventBus] BroadcastChannel post error:", e);
    }
  }

  // 2. Same-window CustomEvent
  try {
    window.dispatchEvent(
      new CustomEvent("omnibites_terminal_mutation", { detail: fullPayload })
    );

    // 3. Fire legacy custom events for maximum backwards compatibility
    if (payload.type === "TABLE_MUTATION" || payload.type === "TABLE_RELEASED") {
      window.dispatchEvent(new CustomEvent("restaurant_tables_changed", { detail: fullPayload }));
      window.dispatchEvent(new CustomEvent("pos_tables_updated", { detail: fullPayload }));
    }
    if (payload.type === "ORDER_MUTATION" || payload.type === "TABLE_RELEASED" || payload.type === "ORDER_VOIDED") {
      window.dispatchEvent(new CustomEvent("orders_updated", { detail: fullPayload }));
    }
    if (payload.type === "TABLE_RELEASED") {
      window.dispatchEvent(new CustomEvent("table_released", { detail: fullPayload }));
    }
  } catch (err) {
    console.warn("[TerminalEventBus] window dispatchEvent error:", err);
  }
}

/**
 * Subscribes to cross-tab BroadcastChannel events for a given restaurant.
 */
export function subscribeTerminalEventBus(
  restId: string | number,
  onMutation: (payload: TerminalMutationPayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const restIdStr = String(restId);

  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(`omnibites_terminal_event_bus_${restIdStr}`);
      bc.onmessage = (event) => {
        if (event?.data) {
          onMutation(event.data);
        }
      };
    } catch (e) {
      console.warn("[TerminalEventBus] BroadcastChannel listener error:", e);
    }
  }

  const handleWindowMutation = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && (!detail.restId || String(detail.restId) === restIdStr)) {
      onMutation(detail);
    }
  };

  window.addEventListener("omnibites_terminal_mutation", handleWindowMutation);

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.removeEventListener("omnibites_terminal_mutation", handleWindowMutation);
  };
}

/**
 * Sets up a managed Supabase Realtime channel for:
 * - public.orders (restaurant_id=eq.${restId})
 * - public.restaurant_tables (restaurant_id=eq.${restId})
 * - public.kitchen_tickets (restaurant_id=eq.${restId})
 * 
 * Automatically reconnects if channel disconnects, times out, or closes.
 * Also hooks into cross-tab BroadcastChannel for 0ms local mutation reflection.
 */
export function setupTerminalRealtimeSubscription(
  restId: string | number,
  callbacks: TerminalRealtimeCallbacks,
  supabaseClient?: any
): () => void {
  if (typeof window === "undefined") return () => {};
  const restIdStr = String(restId);
  const supabase = supabaseClient || createClient();

  let channel: any = null;
  let isDestroyed = false;
  let reconnectTimer: any = null;

  // 1. Hook into cross-tab BroadcastChannel for zero-latency instant local sync
  const unsubBus = subscribeTerminalEventBus(restIdStr, (payload) => {
    if (isDestroyed) return;
    try {
      callbacks.onMutation?.(payload);
      if (payload.type === "ORDER_MUTATION" || payload.type === "ORDER_VOIDED") {
        callbacks.onOrdersChange?.(payload);
      }
      if (payload.type === "TABLE_MUTATION" || payload.type === "TABLE_RELEASED") {
        callbacks.onTablesChange?.(payload);
      }
      if (payload.type === "TICKET_MUTATION") {
        callbacks.onTicketsChange?.(payload);
      }
    } catch (err) {
      console.warn("[setupTerminalRealtimeSubscription] Broadcast bus callback error:", err);
    }
  });

  // 2. Set up Supabase Realtime Postgres Changes
  const initChannel = () => {
    if (isDestroyed) return;
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {}
      channel = null;
    }

    const subUid = Math.random().toString(36).substring(2, 8);
    const channelName = `rt_term_event_bus_${restIdStr}_${subUid}`;

    channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restIdStr}`,
        },
        (payload: any) => {
          if (isDestroyed) return;
          console.log(`[Supabase Realtime ${restIdStr}] orders ${payload.eventType}`);
          callbacks.onOrdersChange?.(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_tables",
          filter: `restaurant_id=eq.${restIdStr}`,
        },
        (payload: any) => {
          if (isDestroyed) return;
          console.log(`[Supabase Realtime ${restIdStr}] restaurant_tables ${payload.eventType}`);
          callbacks.onTablesChange?.(payload);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kitchen_tickets",
          filter: `restaurant_id=eq.${restIdStr}`,
        },
        (payload: any) => {
          if (isDestroyed) return;
          console.log(`[Supabase Realtime ${restIdStr}] kitchen_tickets ${payload.eventType}`);
          callbacks.onTicketsChange?.(payload);
        }
      )
      .subscribe((status: string, err?: any) => {
        console.log(`[Supabase Realtime ${restIdStr}] Channel (${channelName}) status: ${status}`, err || "");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!isDestroyed) {
            console.warn(`[Supabase Realtime ${restIdStr}] Realtime disconnected (${status}). Auto-reconnecting in 1500ms...`);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              initChannel();
            }, 1500);
          }
        }
      });
  };

  initChannel();

  return () => {
    isDestroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    unsubBus();
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {}
      channel = null;
    }
  };
}
