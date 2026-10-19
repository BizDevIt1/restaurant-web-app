"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "./supabase";
import {
  RestaurantEvictionType,
  RestaurantEvictionPayload,
  executeTenantSessionEviction,
} from "./restaurantStatusEvents";
import { AuthenticatedUser } from "@/app/admin/types";

interface UseRestaurantStatusGuardOptions {
  user?: AuthenticatedUser | null;
  onEvicted?: (type: RestaurantEvictionType) => void;
}

export function useRestaurantStatusGuard({
  user,
  onEvicted,
}: UseRestaurantStatusGuardOptions = {}) {
  const pathname = usePathname();
  const router = useRouter();

  const [isEvicted, setIsEvicted] = useState(false);
  const [evictionType, setEvictionType] = useState<RestaurantEvictionType | null>(null);

  const hasEvictedRef = useRef(false);

  // Trigger universal eviction flow
  const triggerEviction = useCallback(
    async (type: RestaurantEvictionType) => {
      if (hasEvictedRef.current) return;
      hasEvictedRef.current = true;

      setEvictionType(type);
      setIsEvicted(true);

      const restId = user?.restaurantId || user?.organizationId || user?.id;
      await executeTenantSessionEviction(restId);

      if (onEvicted) {
        onEvicted(type);
      }
    },
    [user, onEvicted]
  );

  // 1. Resolve numeric restaurant ID from user context
  const rawRestId = user?.restaurantId || user?.organizationId || user?.id;
  const numericRestId = rawRestId
    ? parseInt(String(rawRestId).replace(/[^0-9]/g, ""), 10)
    : null;

  const isSuperAdmin = user?.role === "SUPER_ADMIN" || (user as any)?.isSuperAdmin;

  // 2. Active Verification: Query Supabase on mount and route changes
  const verifyRestaurantStatus = useCallback(async () => {
    if (isSuperAdmin || !numericRestId || isNaN(numericRestId) || numericRestId <= 0) {
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, status, initial_status")
        .eq("id", numericRestId)
        .maybeSingle();

      // If database returned no row and no connection error, the restaurant was deleted
      if (!error && !data) {
        console.warn(`[StatusGuard] Restaurant #${numericRestId} not found in database. Triggering eviction.`);
        triggerEviction("RESTAURANT_DELETED");
        return;
      }

      // If row exists, verify whether it was deactivated
      if (data) {
        const statusClean = String(data.status || "").toLowerCase().trim();
        const initialStatusClean = String(data.initial_status || "").toLowerCase().trim();

        if (statusClean === "inactive" || statusClean === "deactivated" || initialStatusClean === "deactivated") {
          console.warn(`[StatusGuard] Restaurant #${numericRestId} status is inactive/deactivated. Triggering eviction.`);
          triggerEviction("RESTAURANT_DEACTIVATED");
          return;
        }
      }
    } catch (err) {
      console.warn("[StatusGuard] Verification exception:", err);
    }
  }, [isSuperAdmin, numericRestId, triggerEviction]);

  // Run active check on mount and pathname change
  useEffect(() => {
    verifyRestaurantStatus();
  }, [verifyRestaurantStatus, pathname]);

  // 3. Real-Time Event Listeners & WebSocket Subscriptions
  useEffect(() => {
    if (isSuperAdmin || !numericRestId) return;

    const restIdStr = String(numericRestId);

    // A. Local BroadcastChannels
    let dedicatedBc: BroadcastChannel | null = null;
    let globalBc: BroadcastChannel | null = null;

    try {
      dedicatedBc = new BroadcastChannel(`omnibites_global_status_${restIdStr}`);
      dedicatedBc.onmessage = (event: MessageEvent<RestaurantEvictionPayload>) => {
        if (event.data && (event.data.restaurantId === restIdStr || !event.data.restaurantId)) {
          triggerEviction(event.data.type || "RESTAURANT_DEACTIVATED");
        }
      };
    } catch {}

    try {
      globalBc = new BroadcastChannel("omnibites_restaurant_eviction");
      globalBc.onmessage = (event: MessageEvent<RestaurantEvictionPayload>) => {
        if (event.data && (event.data.restaurantId === restIdStr || !event.data.restaurantId)) {
          triggerEviction(event.data.type || "RESTAURANT_DEACTIVATED");
        }
      };
    } catch {}

    // B. DOM Event Listener
    const handleDomEviction = (e: Event) => {
      const customEvent = e as CustomEvent<RestaurantEvictionPayload>;
      if (customEvent.detail && (customEvent.detail.restaurantId === restIdStr || !customEvent.detail.restaurantId)) {
        triggerEviction(customEvent.detail.type || "RESTAURANT_DEACTIVATED");
      }
    };
    window.addEventListener("omnibites_restaurant_eviction", handleDomEviction);

    // C. Storage Event Listener (cross-tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "omnibites_eviction_event" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.restaurantId === restIdStr || !parsed.restaurantId) {
            triggerEviction(parsed.type || "RESTAURANT_DEACTIVATED");
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);

    // D. Supabase Realtime Channels
    const supabase = createClient();

    // 1) Broadcast channel listener
    const broadcastChannel = supabase
      .channel(`restaurant-status-${restIdStr}`)
      .on("broadcast", { event: "restaurant_eviction" }, ({ payload }) => {
        if (payload && (payload.restaurantId === restIdStr || !payload.restaurantId)) {
          triggerEviction(payload.type || "RESTAURANT_DEACTIVATED");
        }
      })
      .subscribe();

    // 2) Postgres Changes listener directly on restaurants table
    const dbChangesChannel = supabase
      .channel(`db-restaurants-status-${restIdStr}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurants",
          filter: `id=eq.${numericRestId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            triggerEviction("RESTAURANT_DELETED");
          } else if (payload.eventType === "UPDATE") {
            const newRow = payload.new as any;
            const statusClean = String(newRow?.status || "").toLowerCase().trim();
            const initialClean = String(newRow?.initial_status || "").toLowerCase().trim();
            if (statusClean === "inactive" || statusClean === "deactivated" || initialClean === "deactivated") {
              triggerEviction("RESTAURANT_DEACTIVATED");
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (dedicatedBc) dedicatedBc.close();
      if (globalBc) globalBc.close();
      window.removeEventListener("omnibites_restaurant_eviction", handleDomEviction);
      window.removeEventListener("storage", handleStorage);
      try {
        supabase.removeChannel(broadcastChannel);
        supabase.removeChannel(dbChangesChannel);
      } catch {}
    };
  }, [isSuperAdmin, numericRestId, triggerEviction]);

  const handleConfirmRedirect = useCallback(() => {
    router.push("/login");
  }, [router]);

  return {
    isEvicted,
    evictionType,
    handleConfirmRedirect,
  };
}
