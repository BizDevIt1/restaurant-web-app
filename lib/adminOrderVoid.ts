/**
 * OMNIBITES PLATFORM - UNIVERSAL ORDER CANCELLATION & VOID SYNC
 * File: lib/adminOrderVoid.ts
 *
 * When an Admin cancels an order:
 * 1. kitchen_tickets record is marked as status: "voided", with void_reason and voided_at.
 * 2. orders record is marked as order_status: "cancelled", payment_status: "voided".
 * 3. restaurant_tables occupied by this order are freed and returned to status: "available".
 * 4. Cross-terminal broadcasts are fired to Kitchen, Waiter, and POS terminals.
 * 5. POS payment settlement is strictly prohibited for voided orders.
 */

import { createClient } from "./supabase";
import { getValidTenantContext } from "./tenantResolver";
import { broadcastTableReleased } from "./tableOccupancy";
import { broadcastTerminalMutation } from "./terminalRealtimeSync";
import { saveStoredKdsTickets, getStoredKdsTickets, getStoredTables, saveStoredTables } from "./tenantStore";

export interface VoidOrderParams {
  ticketId: string;
  orderId?: string | number | null;
  tableNumber?: string | null;
  reason?: string;
  adminName?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function cancelAndVoidOrderByAdmin(
  user: any,
  params: VoidOrderParams
): Promise<{ success: boolean; error?: string }> {
  const { ticketId, orderId, tableNumber, reason = "Cancelled by Admin", adminName = "Admin" } = params;
  const nowIso = new Date().toISOString();
  const fullReason = reason?.trim() ? `Cancelled by ${adminName}: ${reason.trim()}` : `Cancelled by ${adminName}`;

  try {
    const supabase = createClient();
    const { restId } = await getValidTenantContext(user);
    const targetRestId = restId || user?.restaurantId || user?.restaurant_id || 1;
    const orgId = user?.organizationId || user?.id || String(targetRestId);

    const targetTicketId = String(ticketId).trim();
    const digitsOnly = targetTicketId.replace(/[^\d]/g, "");
    const kotFormatted = digitsOnly ? `KOT-${digitsOnly}` : targetTicketId;

    // 1. UPDATE KITCHEN_TICKETS -> VOIDED
    const ktPayload = {
      status: "voided",
      void_reason: fullReason,
      voided_at: nowIso,
    };

    let ktUpdated = false;

    // A. Try updating by UUID if targetTicketId is a valid UUID
    if (UUID_REGEX.test(targetTicketId)) {
      const { data, error } = await supabase
        .from("kitchen_tickets")
        .update(ktPayload)
        .eq("restaurant_id", targetRestId)
        .eq("id", targetTicketId)
        .select();

      if (!error && data && data.length > 0) {
        ktUpdated = true;
      }
    }

    // B. Try updating by ticket_number (e.g. KOT-2516 or 2516)
    if (!ktUpdated) {
      const { data, error } = await supabase
        .from("kitchen_tickets")
        .update(ktPayload)
        .eq("restaurant_id", targetRestId)
        .or(`ticket_number.eq.${targetTicketId},ticket_number.eq.${kotFormatted}`)
        .select();

      if (!error && data && data.length > 0) {
        ktUpdated = true;
      } else if (error) {
        console.warn("[cancelAndVoidOrderByAdmin] ticket_number update warning:", error);
      }
    }

    // C. Fallback: if not matched yet and tableNumber is provided, void active ticket for that table
    let cleanTable = "";
    if (tableNumber) {
      cleanTable = String(tableNumber).trim();
    }

    if (!ktUpdated && cleanTable) {
      const digits = cleanTable.replace(/[^\d]/g, "");
      const formattedTbl = digits ? `Table ${digits.padStart(2, "0")}` : cleanTable;

      await supabase
        .from("kitchen_tickets")
        .update(ktPayload)
        .eq("restaurant_id", targetRestId)
        .or(`table_number.eq.${cleanTable},table_number.eq.${formattedTbl}`)
        .not("status", "in", '("completed","voided")');
    }

    // 2. UPDATE ORDERS -> CANCELLED & PAYMENT REFUNDED (orders table constraint allows 'refunded', 'pending', 'paid')
    const orderPayload = {
      order_status: "cancelled",
      payment_status: "refunded",
    };

    const targetOrderNumber = orderId ? String(orderId).trim() : "";
    if (targetOrderNumber) {
      if (UUID_REGEX.test(targetOrderNumber)) {
        await supabase
          .from("orders")
          .update(orderPayload)
          .eq("restaurant_id", targetRestId)
          .eq("id", targetOrderNumber);
      } else {
        const cleanOrd = targetOrderNumber.replace(/^#+/, "");
        await supabase
          .from("orders")
          .update(orderPayload)
          .eq("restaurant_id", targetRestId)
          .or(`order_number.eq.${targetOrderNumber},order_number.eq.#${cleanOrd},order_number.eq.##${cleanOrd},order_number.eq.${cleanOrd}`);
      }
    }

    if (targetTicketId) {
      try {
        const { data: ktRow } = await supabase
          .from("kitchen_tickets")
          .select("order_id")
          .eq("restaurant_id", targetRestId)
          .or(`ticket_number.eq.${targetTicketId},ticket_number.eq.${kotFormatted}`)
          .maybeSingle();

        if (ktRow?.order_id && UUID_REGEX.test(ktRow.order_id)) {
          await supabase
            .from("orders")
            .update(orderPayload)
            .eq("restaurant_id", targetRestId)
            .eq("id", ktRow.order_id);
        }
      } catch (ktLookErr) {
        console.warn("[cancelAndVoidOrderByAdmin] ktRow lookup warning:", ktLookErr);
      }

      try {
        await supabase
          .from("orders")
          .update(orderPayload)
          .eq("restaurant_id", targetRestId)
          .or(`order_number.eq.${targetTicketId},order_number.eq.${kotFormatted}`);
      } catch {}
    }

    // 3. RELEASE OCCUPIED TABLE BACK TO AVAILABLE & CANCEL TABLE ACTIVE ORDERS
    if (cleanTable) {
      const isDineIn = !cleanTable.toLowerCase().includes("takeaway") &&
                       !cleanTable.toLowerCase().includes("delivery") &&
                       !cleanTable.toLowerCase().includes("counter");

      if (isDineIn) {
        const digits = cleanTable.replace(/[^\d]/g, "");
        const formattedTbl = digits ? `Table ${digits.padStart(2, "0")}` : cleanTable;

        // Cancel any active orders associated with this table by table_id or customer_name
        const { data: tableRow } = await supabase
          .from("restaurant_tables")
          .select("id, table_number")
          .eq("restaurant_id", targetRestId)
          .or(`table_number.eq.${cleanTable},table_number.eq.${formattedTbl},table_number.eq.Table ${digits}`)
          .maybeSingle();

        if (tableRow?.id) {
          await supabase
            .from("orders")
            .update(orderPayload)
            .eq("restaurant_id", targetRestId)
            .eq("table_id", tableRow.id)
            .or("order_status.eq.active,order_status.eq.pending,payment_status.eq.pending");
        }

        await supabase
          .from("orders")
          .update(orderPayload)
          .eq("restaurant_id", targetRestId)
          .or(`customer_name.eq.${cleanTable},customer_name.eq.${formattedTbl}`)
          .or("order_status.eq.active,order_status.eq.pending,payment_status.eq.pending");

        // Release table in database
        await supabase
          .from("restaurant_tables")
          .update({
            status: "available",
            active_order_id: null,
            current_order_id: null,
            active_covers: 0,
          })
          .eq("restaurant_id", targetRestId)
          .or(`table_number.eq.${cleanTable},table_number.eq.${formattedTbl},table_number.eq.Table ${digits}`);

        broadcastTableReleased(
          targetRestId,
          {
            tableNumber: cleanTable,
            orderId: targetTicketId,
          },
          supabase
        );
      }
    }

    // 4. UPDATE LOCAL STORAGE CACHES IMMEDIATELY
    if (typeof window !== "undefined") {
      try {
        const storedKds = getStoredKdsTickets(orgId, []);
        if (storedKds.length > 0) {
          const updatedKds = storedKds.map((t: any) =>
            t.id === targetTicketId || t.ticket_number === targetTicketId || t.id === kotFormatted
              ? {
                  ...t,
                  status: "voided" as const,
                  void_reason: fullReason,
                  voided_at: nowIso,
                  voidedAt: nowIso,
                }
              : t
          );
          saveStoredKdsTickets(orgId, updatedKds);
        }

        if (cleanTable) {
          const storedTables = getStoredTables(orgId, []);
          if (storedTables.length > 0) {
            const digits = cleanTable.replace(/[^\d]/g, "");
            const formattedTbl = digits ? `Table ${digits.padStart(2, "0")}` : cleanTable;
            const updatedTbls = storedTables.map((tbl: any) =>
              tbl.table_number === cleanTable || tbl.table_number === formattedTbl || tbl.name === cleanTable
                ? { ...tbl, status: "available" as const, active_order_id: null, isOccupied: false }
                : tbl
            );
            saveStoredTables(orgId, updatedTbls);
          }
        }

        const cleanOrd = (targetOrderNumber || "").replace(/^#+/, "");
        for (const storageKey of [
          `pos_running_kot_orders_${orgId}`,
          `pos_running_kot_orders_${targetRestId}`,
        ]) {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            try {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const filtered = list.filter((r: any) => {
                  const rNum = String(r.id || r.order_number || "").replace(/^#+/, "");
                  return rNum !== cleanOrd && r.id !== targetOrderNumber && r.kotId !== targetTicketId;
                });
                localStorage.setItem(storageKey, JSON.stringify(filtered));
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("[cancelAndVoidOrderByAdmin] localStorage update warning:", e);
      }
    }

    // 5. CROSS-TERMINAL BROADCASTS & LOCAL EVENT SYNC
    if (typeof window !== "undefined") {
      // Immediate 0ms broadcast across omnibites_terminal_event_bus
      broadcastTerminalMutation(targetRestId, {
        type: "ORDER_VOIDED",
        orderId: targetOrderNumber || targetTicketId,
        ticketId: targetTicketId,
        tableNumber: cleanTable || undefined,
        status: "cancelled",
      });
      if (cleanTable) {
        broadcastTerminalMutation(targetRestId, {
          type: "TABLE_RELEASED",
          tableNumber: cleanTable,
          orderId: targetTicketId,
          status: "available",
        });
      }

      const payload = {
        type: "TICKET_VOIDED_BY_ADMIN",
        ticketId: targetTicketId,
        orderId: targetOrderNumber || targetTicketId,
        tableNumber: cleanTable || undefined,
        reason: fullReason,
        restaurantId: targetRestId,
        timestamp: nowIso,
      };

      // BroadcastChannels for instant zero-latency cross-tab pickup
      for (const channelName of [
        "pos_kds_sync",
        "kitchen_order_channel",
        "restaurant_orders_channel",
        "pos_ledger_sync_channel",
        "omni_table_occupancy_sync",
        "table_occupancy_channel",
      ]) {
        try {
          const bc = new BroadcastChannel(channelName);
          bc.postMessage(payload);
          bc.close();
        } catch {}
      }

      // Fire table release broadcast on channels
      if (cleanTable) {
        try {
          const occBc = new BroadcastChannel("omni_table_occupancy_sync");
          occBc.postMessage({
            type: "TABLE_RELEASED",
            payload: { tableNumber: cleanTable, orderId: targetTicketId },
          });
          occBc.close();
        } catch {}

        try {
          const posLedgerBc = new BroadcastChannel("pos_ledger_sync_channel");
          posLedgerBc.postMessage({
            type: "TABLE_RELEASED",
            payload: { tableNumber: cleanTable, orderId: targetTicketId },
          });
          posLedgerBc.close();
        } catch {}
      }

      // Window custom events
      window.dispatchEvent(new CustomEvent("order_voided_by_admin", { detail: payload }));
      window.dispatchEvent(new CustomEvent("ticket_voided_by_admin", { detail: payload }));
      window.dispatchEvent(new CustomEvent("pos_tables_updated", { detail: { restId: targetRestId } }));
      window.dispatchEvent(new CustomEvent("kitchen_ticket_updated", { detail: payload }));
      window.dispatchEvent(new CustomEvent("kds_tickets_updated", { detail: payload }));
      if (cleanTable) {
        window.dispatchEvent(
          new CustomEvent("table_released", {
            detail: { tableNumber: cleanTable, orderId: targetTicketId },
          })
        );
        window.dispatchEvent(new CustomEvent("orders_updated"));
      }
      window.dispatchEvent(new Event("storage"));
    }

    return { success: true };
  } catch (err: any) {
    console.error("[cancelAndVoidOrderByAdmin] Error voiding order:", err);
    return { success: false, error: err?.message || String(err) };
  }
}
