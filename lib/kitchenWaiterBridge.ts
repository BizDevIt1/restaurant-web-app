"use client";

import { createClient } from "./supabase";
import { playWaiterBuzzer } from "./tenantStore";

export const KITCHEN_WAITER_BROADCAST_CHANNEL = "omni_kitchen_waiter_bridge";
export const KITCHEN_BUZZER_BROADCAST_CHANNEL = "omni_kitchen_buzzer_sync";

export const KITCHEN_ORDER_READY_EVENT = "omni_kitchen_order_ready";
export const KITCHEN_BUZZER_ALERT_EVENT = "omni_kitchen_buzzer_alert";
export const TAKEAWAY_ORDER_READY_EVENT = "omni_takeaway_order_ready";
export const DELIVERY_ORDER_READY_EVENT = "omni_delivery_order_ready";
export const WAITER_ORDER_PICKED_UP_EVENT = "omni_waiter_order_picked_up";
export const WAITER_ORDER_SERVED_EVENT = "omni_waiter_order_served";

export const getKitchenBroadcastTopic = (orgId: string | number = "default") =>
  `omni_kitchen_alerts_${String(orgId || "default")}`;

export interface KitchenBuzzerAlertPayload {
  orgId: string;
  ticketId?: string;
  orderNumber?: string;
  tableNumber?: string;
  orderChannel?: string;
  targetStation?: "waiter" | "pos" | "rider" | "all";
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  token?: string;
  priority?: string;
  title?: string;
  message: string;
  readyAt?: string;
  timestamp: number;
}

export interface KitchenReadyPayload {
  orgId: string;
  ticketId: string;
  orderNumber?: string;
  tableNumber: string;
  orderChannel?: "dine_in" | "takeaway" | "delivery" | string;
  targetStation?: "waiter" | "pos" | "rider" | "all";
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  token?: string;
  items: Array<{
    name: string;
    qty: number;
    notes?: string;
    modifiers?: string[];
    variant_name?: string | null;
  }>;
  readyAt: string;
  priority?: string;
  itemName?: string;
  isCompleteOrder?: boolean;
}

export interface TakeawayReadyPayload {
  orgId: string;
  ticketId: string;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  itemsSummary?: string;
  items?: any[];
  readyAt: string;
  priority?: string;
  timestamp: number;
}

export interface DeliveryReadyPayload {
  orgId: string;
  ticketId: string;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryZone?: string;
  token?: string;
  itemsSummary?: string;
  items?: any[];
  readyAt: string;
  priority?: string;
  timestamp: number;
}

export interface WaiterPickupPayload {
  orgId: string;
  ticketId: string;
  pickedUpAt: string;
  waiterName?: string;
}

export interface WaiterServedPayload {
  orgId: string;
  ticketId: string;
  servedAt: string;
  waiterName?: string;
}

function safeQueueMicrotask(fn: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
  } else {
    setTimeout(fn, 0);
  }
}

/**
 * Generates an in-memory 8kHz mono WAV Data URI representing a restaurant service chime.
 * This guarantees that HTMLAudioElement.play() always succeeds without network latency or 404s.
 */
let cachedBellWavDataUri: string | null = null;
export function getServiceBellWavDataUri(): string {
  if (cachedBellWavDataUri) return cachedBellWavDataUri;

  const sampleRate = 8000;
  const duration = 0.45;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF Chunk Descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " Sub-chunk
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // "data" Sub-chunk
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, numSamples * 2, true);

  // Dual-harmonic chime (C6: 1046.5Hz + G6: 1567.98Hz with smooth exponential decay)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-7.5 * t);
    const wave =
      Math.sin(2 * Math.PI * 1046.5 * t) * 0.65 +
      Math.sin(2 * Math.PI * 1567.98 * t) * 0.35;
    const sample = Math.max(-1, Math.min(1, wave * decay)) * 32767;
    view.setInt16(44 + i * 2, sample, true);
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  cachedBellWavDataUri = "data:audio/wav;base64," + btoa(binary);
  return cachedBellWavDataUri;
}

/**
 * Executes the audible chime using both an HTMLAudioElement (.play())
 * and Web Audio API synthesizer for maximum reliability and volume across browsers.
 */
export function playRemoteAudioChime(isRush: boolean = false): void {
  if (typeof window === "undefined") return;

  // 1. Play high-fidelity Web Audio API buzzer
  try {
    playWaiterBuzzer(isRush);
  } catch {}

  // 2. Play via HTMLAudioElement as strictly specified
  try {
    const wavUri = getServiceBellWavDataUri();
    const audio = new Audio(wavUri);
    audio.volume = 0.85;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Handled silently if browser autoplay requires user gesture
        console.debug("[kitchenWaiterBridge] HTMLAudioElement autoplay handled:", err);
      });
    }
  } catch (audioErr) {
    console.debug("[kitchenWaiterBridge] HTMLAudioElement error:", audioErr);
  }
}

/**
 * Dispatches an instant remote buzzer alert from the Kitchen Terminal to
 * active Waiter and POS stations across cross-tab BroadcastChannel,
 * window CustomEvent, and Supabase Realtime broadcast topic.
 */
export function broadcastKitchenBuzzerAlert(payload: KitchenBuzzerAlertPayload): void {
  if (typeof window === "undefined") return;

  // 1. Cross-tab BroadcastChannel
  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(KITCHEN_BUZZER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "KITCHEN_BUZZER_ALERT",
        payload,
        timestamp: Date.now(),
      });
      bc.close();
    } catch (err) {
      console.warn("[kitchenWaiterBridge] BroadcastChannel buzzer postMessage error:", err);
    }
  }

  // 2. Window CustomEvent
  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent(KITCHEN_BUZZER_ALERT_EVENT, {
          detail: payload,
        })
      );
    } catch {}
  });

  // 3. Supabase Realtime Broadcast (Cross-device sync to shared topic)
  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(payload.orgId);
    const channel = supabase.channel(topic);
    if ((channel as any)?.state === "joined") {
      channel.send({
        type: "broadcast",
        event: "kitchen_buzzer_alert",
        payload,
      });
    } else {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "kitchen_buzzer_alert",
            payload,
          });
        }
      });
    }
  } catch (err) {
    console.warn("[kitchenWaiterBridge] Supabase buzzer broadcast error:", err);
  }
}

/**
 * Subscribes Waiter and POS terminals to remote buzzer alerts sent from the Kitchen Terminal.
 */
export function subscribeToRemoteKitchenBuzzer(
  orgId: string | number = "default",
  onAlert: (payload: KitchenBuzzerAlertPayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(KITCHEN_BUZZER_BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.payload) return;
        const payloadOrg = String(data.payload.orgId || "");
        if (
          payloadOrg &&
          orgId &&
          payloadOrg !== String(orgId) &&
          payloadOrg !== "default" &&
          orgId !== "default"
        ) {
          return;
        }

        if (data.type === "KITCHEN_BUZZER_ALERT") {
          onAlert(data.payload);
        }
      };
    } catch (err) {
      console.warn("[kitchenWaiterBridge] BroadcastChannel init warning:", err);
    }
  }

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<KitchenBuzzerAlertPayload>;
    if (custom.detail) {
      onAlert(custom.detail);
    }
  };

  window.addEventListener(KITCHEN_BUZZER_ALERT_EVENT, handleCustomEvent);

  // 3. Supabase Realtime Channel
  let channel: any = null;
  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(orgId);
    channel = supabase
      .channel(topic)
      .on("broadcast", { event: "kitchen_buzzer_alert" }, ({ payload }) => {
        if (!payload) return;
        onAlert(payload);
      })
      .subscribe();
  } catch (err) {
    console.warn("[kitchenWaiterBridge] Supabase remote buzzer subscription error:", err);
  }

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.removeEventListener(KITCHEN_BUZZER_ALERT_EVENT, handleCustomEvent);
    if (channel) {
      try {
        channel.unsubscribe();
      } catch {}
    }
  };
}

/**
 * Dispatches an ORDER_READY notification from the kitchen to all active waiter and POS terminals.
 */
export function broadcastKitchenOrderReady(payload: KitchenReadyPayload): void {
  if (typeof window === "undefined") return;

  // 1. Cross-tab BroadcastChannel
  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(KITCHEN_WAITER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "ORDER_READY",
        payload,
        timestamp: Date.now(),
      });
      bc.close();
    } catch (err) {
      console.warn("[kitchenWaiterBridge] BroadcastChannel postMessage error:", err);
    }
  }

  // 2. Window CustomEvent
  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent(KITCHEN_ORDER_READY_EVENT, {
          detail: payload,
        })
      );
    } catch {}
  });

  // 3. Supabase Realtime Broadcast (Cross-device sync to shared topic)
  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(payload.orgId);
    const channel = supabase.channel(topic);
    if ((channel as any)?.state === "joined") {
      channel.send({
        type: "broadcast",
        event: "order_ready",
        payload,
      });
    } else {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "order_ready",
            payload,
          });
        }
      });
    }
  } catch (err) {
    console.warn("[kitchenWaiterBridge] Supabase broadcast error:", err);
  }

  // 4. Also trigger buzzer alert
  broadcastKitchenBuzzerAlert({
    orgId: payload.orgId,
    ticketId: payload.ticketId,
    tableNumber: payload.tableNumber,
    orderChannel: payload.orderChannel || "dine_in",
    targetStation: payload.targetStation || "waiter",
    customerName: payload.customerName,
    priority: payload.priority,
    title: payload.isCompleteOrder ? "Order Ready" : "Dish Ready",
    message: payload.isCompleteOrder
      ? `Order #${payload.ticketId} (${payload.tableNumber || "Counter"}) is ready for pickup!`
      : `Dish "${payload.itemName || "Item"}" for #${payload.ticketId} is ready at the pass!`,
    readyAt: payload.readyAt,
    timestamp: Date.now(),
  });
}

/**
 * Dispatches a targeted TAKEAWAY_ORDER_READY alert from the kitchen to active POS registers.
 */
export function broadcastTakeawayOrderReady(payload: TakeawayReadyPayload): void {
  if (typeof window === "undefined") return;

  // 1. Cross-tab BroadcastChannel
  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(KITCHEN_WAITER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "TAKEAWAY_ORDER_READY",
        payload,
        timestamp: Date.now(),
      });
      bc.close();
    } catch (err) {
      console.warn("[kitchenWaiterBridge] BroadcastChannel takeaway ready error:", err);
    }
  }

  // 2. Window CustomEvent
  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent(TAKEAWAY_ORDER_READY_EVENT, {
          detail: payload,
        })
      );
    } catch {}
  });

  // 3. Supabase Realtime Broadcast to POS
  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(payload.orgId);
    const channel = supabase.channel(topic);
    if ((channel as any)?.state === "joined") {
      channel.send({
        type: "broadcast",
        event: "takeaway_order_ready",
        payload,
      });
    } else {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "takeaway_order_ready",
            payload,
          });
        }
      });
    }
  } catch (err) {
    console.warn("[kitchenWaiterBridge] Supabase takeaway broadcast error:", err);
  }

  // 4. Targeted POS Buzzer Alert
  broadcastKitchenBuzzerAlert({
    orgId: payload.orgId,
    ticketId: payload.ticketId,
    orderNumber: payload.orderNumber,
    orderChannel: "takeaway",
    targetStation: "pos",
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    priority: payload.priority,
    title: "Takeaway Ready",
    message: `Takeaway Order #${payload.orderNumber} is Ready for Counter Handover`,
    readyAt: payload.readyAt,
    timestamp: Date.now(),
  });
}

/**
 * Dispatches a targeted DELIVERY_ORDER_READY alert from the kitchen to Rider Terminals & Dispatch.
 */
export function broadcastDeliveryOrderReady(payload: DeliveryReadyPayload): void {
  if (typeof window === "undefined") return;

  // 1. Cross-tab BroadcastChannel
  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(KITCHEN_WAITER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "DELIVERY_ORDER_READY",
        payload,
        timestamp: Date.now(),
      });
      bc.close();
    } catch (err) {
      console.warn("[kitchenWaiterBridge] BroadcastChannel delivery ready error:", err);
    }
  }

  // 2. Window CustomEvent
  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent(DELIVERY_ORDER_READY_EVENT, {
          detail: payload,
        })
      );
    } catch {}
  });

  // 3. Supabase Realtime Broadcast to Riders
  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(payload.orgId);
    const channel = supabase.channel(topic);
    if ((channel as any)?.state === "joined") {
      channel.send({
        type: "broadcast",
        event: "delivery_order_ready",
        payload,
      });
    } else {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "delivery_order_ready",
            payload,
          });
        }
      });
    }
  } catch (err) {
    console.warn("[kitchenWaiterBridge] Supabase delivery broadcast error:", err);
  }

  // 4. Targeted Rider Buzzer Alert
  broadcastKitchenBuzzerAlert({
    orgId: payload.orgId,
    ticketId: payload.ticketId,
    orderNumber: payload.orderNumber,
    orderChannel: "delivery",
    targetStation: "rider",
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    deliveryAddress: payload.deliveryAddress,
    token: payload.token,
    priority: payload.priority,
    title: "Delivery Ready",
    message: `Delivery Order #${payload.orderNumber} is Ready for Pickup / Out for Delivery`,
    readyAt: payload.readyAt,
    timestamp: Date.now(),
  });
}

/**
 * Subscribes POS Terminal to targeted Takeaway Ready Alerts.
 */
export function subscribeToTakeawayReadyAlerts(
  onAlert: (payload: TakeawayReadyPayload) => void
): () => void;
export function subscribeToTakeawayReadyAlerts(
  orgId: string | number,
  onAlert: (payload: TakeawayReadyPayload) => void
): () => void;
export function subscribeToTakeawayReadyAlerts(
  orgIdOrHandler: string | number | ((payload: TakeawayReadyPayload) => void) = "default",
  maybeHandler?: (payload: TakeawayReadyPayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const orgId = typeof orgIdOrHandler === "function" ? "default" : orgIdOrHandler;
  const onAlert = typeof orgIdOrHandler === "function" ? orgIdOrHandler : maybeHandler;
  if (!onAlert) return () => {};

  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(KITCHEN_WAITER_BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.payload) return;
        if (data.type === "TAKEAWAY_ORDER_READY") {
          onAlert(data.payload);
        }
      };
    } catch {}
  }

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<TakeawayReadyPayload>;
    if (custom.detail) onAlert(custom.detail);
  };
  window.addEventListener(TAKEAWAY_ORDER_READY_EVENT, handleCustomEvent);

  let channel: any = null;
  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(orgId);
    channel = supabase
      .channel(topic)
      .on("broadcast", { event: "takeaway_order_ready" }, ({ payload }) => {
        if (!payload) return;
        onAlert(payload);
      })
      .subscribe();
  } catch {}

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.removeEventListener(TAKEAWAY_ORDER_READY_EVENT, handleCustomEvent);
    if (channel) {
      try {
        channel.unsubscribe();
      } catch {}
    }
  };
}

/**
 * Subscribes Rider Terminal & Rider Dispatch to targeted Delivery Ready Alerts.
 */
export function subscribeToDeliveryReadyAlerts(
  onAlert: (payload: DeliveryReadyPayload) => void
): () => void;
export function subscribeToDeliveryReadyAlerts(
  orgId: string | number,
  onAlert: (payload: DeliveryReadyPayload) => void
): () => void;
export function subscribeToDeliveryReadyAlerts(
  orgIdOrHandler: string | number | ((payload: DeliveryReadyPayload) => void) = "default",
  maybeHandler?: (payload: DeliveryReadyPayload) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const orgId = typeof orgIdOrHandler === "function" ? "default" : orgIdOrHandler;
  const onAlert = typeof orgIdOrHandler === "function" ? orgIdOrHandler : maybeHandler;
  if (!onAlert) return () => {};

  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(KITCHEN_WAITER_BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.payload) return;
        if (data.type === "DELIVERY_ORDER_READY") {
          onAlert(data.payload);
        }
      };
    } catch {}
  }

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<DeliveryReadyPayload>;
    if (custom.detail) onAlert(custom.detail);
  };
  window.addEventListener(DELIVERY_ORDER_READY_EVENT, handleCustomEvent);

  let channel: any = null;
  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(orgId);
    channel = supabase
      .channel(topic)
      .on("broadcast", { event: "delivery_order_ready" }, ({ payload }) => {
        if (!payload) return;
        onAlert(payload);
      })
      .subscribe();
  } catch {}

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.removeEventListener(DELIVERY_ORDER_READY_EVENT, handleCustomEvent);
    if (channel) {
      try {
        channel.unsubscribe();
      } catch {}
    }
  };
}

/**
 * Dispatches a WAITER_PICKED_UP notification when a waiter collects an order from the kitchen pass.
 */
export function broadcastWaiterOrderPickedUp(payload: WaiterPickupPayload): void {
  if (typeof window === "undefined") return;

  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(KITCHEN_WAITER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "ORDER_PICKED_UP",
        payload,
        timestamp: Date.now(),
      });
      bc.close();
    } catch (err) {
      console.warn("[kitchenWaiterBridge] BroadcastChannel postMessage error:", err);
    }
  }

  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent(WAITER_ORDER_PICKED_UP_EVENT, {
          detail: payload,
        })
      );
    } catch {}
  });

  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(payload.orgId);
    const channel = supabase.channel(topic);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "order_picked_up",
          payload,
        });
      }
    });
  } catch {}
}

/**
 * Dispatches a WAITER_SERVED notification when an order is delivered to the customer's table.
 */
export function broadcastWaiterOrderServed(payload: WaiterServedPayload): void {
  if (typeof window === "undefined") return;

  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(KITCHEN_WAITER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "ORDER_SERVED",
        payload,
        timestamp: Date.now(),
      });
      bc.close();
    } catch (err) {
      console.warn("[kitchenWaiterBridge] BroadcastChannel postMessage error:", err);
    }
  }

  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent(WAITER_ORDER_SERVED_EVENT, {
          detail: payload,
        })
      );
    } catch {}
  });

  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(payload.orgId);
    const channel = supabase.channel(topic);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "order_served",
          payload,
        });
      }
    });
  } catch {}
}

/**
 * Subscribes to the kitchen-to-waiter real-time bridge.
 */
export function subscribeToKitchenWaiterBridge(
  orgId: string | number = "default",
  callbacks: {
    onOrderReady?: (payload: KitchenReadyPayload) => void;
    onOrderPickedUp?: (payload: WaiterPickupPayload) => void;
    onOrderServed?: (payload: WaiterServedPayload) => void;
  }
): () => void {
  if (typeof window === "undefined") return () => {};

  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(KITCHEN_WAITER_BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.payload) return;
        const payloadOrg = String(data.payload.orgId || "");
        if (
          payloadOrg &&
          orgId &&
          payloadOrg !== String(orgId) &&
          payloadOrg !== "default" &&
          orgId !== "default"
        ) {
          return;
        }

        if (data.type === "ORDER_READY" && callbacks.onOrderReady) {
          callbacks.onOrderReady(data.payload);
        } else if (data.type === "ORDER_PICKED_UP" && callbacks.onOrderPickedUp) {
          callbacks.onOrderPickedUp(data.payload);
        } else if (data.type === "ORDER_SERVED" && callbacks.onOrderServed) {
          callbacks.onOrderServed(data.payload);
        }
      };
    } catch (err) {
      console.warn("[kitchenWaiterBridge] BroadcastChannel init warning:", err);
    }
  }

  const handleReadyEvent = (e: Event) => {
    const custom = e as CustomEvent<KitchenReadyPayload>;
    if (custom.detail && callbacks.onOrderReady) {
      callbacks.onOrderReady(custom.detail);
    }
  };

  const handlePickedUpEvent = (e: Event) => {
    const custom = e as CustomEvent<WaiterPickupPayload>;
    if (custom.detail && callbacks.onOrderPickedUp) {
      callbacks.onOrderPickedUp(custom.detail);
    }
  };

  const handleServedEvent = (e: Event) => {
    const custom = e as CustomEvent<WaiterServedPayload>;
    if (custom.detail && callbacks.onOrderServed) {
      callbacks.onOrderServed(custom.detail);
    }
  };

  window.addEventListener(KITCHEN_ORDER_READY_EVENT, handleReadyEvent);
  window.addEventListener(WAITER_ORDER_PICKED_UP_EVENT, handlePickedUpEvent);
  window.addEventListener(WAITER_ORDER_SERVED_EVENT, handleServedEvent);

  let channel: any = null;
  try {
    const supabase = createClient();
    const topic = getKitchenBroadcastTopic(orgId);
    channel = supabase
      .channel(topic)
      .on("broadcast", { event: "order_ready" }, ({ payload }) => {
        if (!payload) return;
        if (callbacks.onOrderReady) callbacks.onOrderReady(payload);
      })
      .on("broadcast", { event: "order_picked_up" }, ({ payload }) => {
        if (!payload) return;
        if (callbacks.onOrderPickedUp) callbacks.onOrderPickedUp(payload);
      })
      .on("broadcast", { event: "order_served" }, ({ payload }) => {
        if (!payload) return;
        if (callbacks.onOrderServed) callbacks.onOrderServed(payload);
      })
      .subscribe();
  } catch {}

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.removeEventListener(KITCHEN_ORDER_READY_EVENT, handleReadyEvent);
    window.removeEventListener(WAITER_ORDER_PICKED_UP_EVENT, handlePickedUpEvent);
    window.removeEventListener(WAITER_ORDER_SERVED_EVENT, handleServedEvent);
    if (channel) {
      try {
        channel.unsubscribe();
      } catch {}
    }
  };
}
