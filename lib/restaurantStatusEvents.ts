/**
 * OMNIBITES PLATFORM - REAL-TIME RESTAURANT EVICTION & STATUS LIFECYCLE
 * File: lib/restaurantStatusEvents.ts
 *
 * Implements real-time broadcast and instant session eviction when a Super Admin
 * deactivates or permanently deletes a restaurant.
 */

import { createClient } from "./supabase";
import { clearUserSession, purgeTenantOrderCache } from "./tenantStore";
import { clearAllAuthSessions } from "./auth";

export type RestaurantEvictionType = "RESTAURANT_DEACTIVATED" | "RESTAURANT_DELETED";

export interface RestaurantEvictionPayload {
  type: RestaurantEvictionType;
  restaurantId: string;
  timestamp: number;
}

/**
 * Universal broadcast dispatched by Super Admin actions immediately upon Deactivate or Delete.
 * Dispatches synchronously across multiple transport layers:
 * 1. Dedicated BroadcastChannel("omnibites_global_status_${restaurantId}")
 * 2. Universal BroadcastChannel("omnibites_restaurant_eviction")
 * 3. DOM CustomEvent & StorageEvent for multi-tab/window coverage
 * 4. Supabase Realtime WebSocket broadcast for cross-device coverage
 */
export function broadcastRestaurantEviction(
  restaurantId: string | number,
  type: RestaurantEvictionType
): void {
  if (typeof window === "undefined") return;

  const restIdStr = String(restaurantId);
  const payload: RestaurantEvictionPayload = {
    type,
    restaurantId: restIdStr,
    timestamp: Date.now(),
  };

  // 1. Dedicated BroadcastChannel for this restaurant
  try {
    const bc = new BroadcastChannel(`omnibites_global_status_${restIdStr}`);
    bc.postMessage(payload);
    setTimeout(() => {
      try {
        bc.close();
      } catch {}
    }, 2000);
  } catch {}

  // 2. Global eviction channel
  try {
    const globalBc = new BroadcastChannel("omnibites_restaurant_eviction");
    globalBc.postMessage(payload);
    setTimeout(() => {
      try {
        globalBc.close();
      } catch {}
    }, 2000);
  } catch {}

  // 3. Local DOM custom event
  try {
    window.dispatchEvent(
      new CustomEvent("omnibites_restaurant_eviction", { detail: payload })
    );
  } catch {}

  // 4. LocalStorage trigger (invokes 'storage' event across other tabs on same origin)
  try {
    localStorage.setItem("omnibites_eviction_event", JSON.stringify(payload));
  } catch {}

  // 5. Supabase Realtime WebSocket broadcast to eject remote devices
  try {
    const supabase = createClient();
    const ch = supabase.channel(`restaurant-status-${restIdStr}`);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({
          type: "broadcast",
          event: "restaurant_eviction",
          payload,
        }).finally(() => {
          setTimeout(() => {
            try {
              supabase.removeChannel(ch);
            } catch {}
          }, 3000);
        });
      }
    });
  } catch (err) {
    console.warn("[restaurantStatusEvents] Supabase realtime broadcast error:", err);
  }
}

/**
 * Deep session purge: wipes all local storage, session storage, cookies, and Supabase auth.
 */
export async function executeTenantSessionEviction(restaurantId?: string | number): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    // 1. Wipe tenant caches
    if (restaurantId) {
      purgeTenantOrderCache(String(restaurantId));
    } else {
      purgeTenantOrderCache();
    }

    // 2. Clear role and user sessions
    clearUserSession();
    clearAllAuthSessions();

    // 3. Wipe any residual storage keys
    try {
      sessionStorage.clear();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith("pos_") ||
            k.startsWith("active_") ||
            k.startsWith("omni_") ||
            k.startsWith("restaurant_") ||
            k.startsWith("sb-") ||
            k.includes("session") ||
            k.includes("auth") ||
            k.includes("user"))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}

    // 4. Disconnect Supabase Auth
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      supabase.removeAllChannels();
    } catch {}
  } catch (err) {
    console.warn("[restaurantStatusEvents] Eviction purge warning:", err);
  }
}
