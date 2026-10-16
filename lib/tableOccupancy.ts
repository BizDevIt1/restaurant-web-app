import { TableStatus, RestaurantTable, KitchenTicket, OrderRecord } from "@/app/admin/types";
import { isTicketExpired, isOrderExpired } from "./orderExpiry";

export interface ActiveUnpaidTableRecord {
  orderId: string;
  kotId?: string;
  tableIdentifier: string;
  tableNumberNorm: string;
  tableId?: number | string;
  totalAmount?: number;
  items?: any[];
  status?: string;
  paymentStatus?: string;
  createdAt?: string;
  source: "kitchen_ticket" | "order";
}

export function isUuid(val: any): boolean {
  if (!val || typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

/**
 * Extracts a normalized, canonical identifier for a table.
 * Strips "table", "t-", leading zeros, and whitespace.
 * e.g. "Table 01" -> "1", "Table 1" -> "1", "01" -> "1", 1 -> "1"
 */
export function normalizeTableNumber(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  if (!str) return "";
  if (isUuid(str)) return "";

  // If there are digits present in the string (e.g. "Table 01", "T-2", "03", "4")
  const digitsMatch = str.match(/\d+/);
  if (digitsMatch) {
    const num = parseInt(digitsMatch[0], 10);
    if (!isNaN(num)) return String(num);
  }

  // Fallback for non-numeric table labels like "Patio Corner", "VIP Lounge"
  return str.toLowerCase().replace(/^(table|tbl|t)\s*[-_:]*\s*/i, "").trim();
}

/**
 * Universally checks whether a table object matches an identifier string or number.
 */
export function isTableMatchingIdentifier(
  table: { id?: number | string; label?: string; table_number?: string; name?: string; dbId?: any },
  identifier: string | number | null | undefined
): boolean {
  if (identifier === null || identifier === undefined) return false;
  const rawIdStr = String(identifier).trim();
  if (!rawIdStr) return false;

  // 1. Non-dining channels MUST NEVER match any dine-in table!
  const lower = rawIdStr.toLowerCase();
  if (
    lower === "counter" ||
    lower === "takeaway" ||
    lower === "delivery" ||
    lower === "pickup" ||
    lower.startsWith("takeaway") ||
    lower.startsWith("delivery") ||
    lower.startsWith("counter") ||
    lower.startsWith("pickup")
  ) {
    return false;
  }

  // 2. Exact numeric ID or dbId match
  if (table.id !== undefined && String(table.id) === rawIdStr) return true;
  if (table.dbId !== undefined && String(table.dbId) === rawIdStr) return true;

  // UUIDs are database primary keys and should never be normalized as table digits
  if (isUuid(rawIdStr)) return false;

  // 3. Normalized digit/token match ONLY if the identifier explicitly represents a table
  // (e.g. "Table 01", "T-1", "Table 1", "1")
  const normTarget = normalizeTableNumber(rawIdStr);
  if (normTarget) {
    const isPureTableStr = /^(table|tbl|t)?\s*[-_:]*\s*\d+$/i.test(rawIdStr);
    if (isPureTableStr) {
      if (table.id !== undefined && normalizeTableNumber(table.id) === normTarget) return true;
      if (table.label && normalizeTableNumber(table.label) === normTarget) return true;
      if (table.table_number && normalizeTableNumber(table.table_number) === normTarget) return true;
      if (table.name && normalizeTableNumber(table.name) === normTarget) return true;
    }
  }

  // 4. Normalized string fallback
  const cleanTarget = rawIdStr.toLowerCase().replace(/^(table|tbl|t)\s*[-_:]*\s*/i, "").trim();
  if (!cleanTarget) return false;

  const candidates = [
    table.label,
    table.table_number,
    table.name,
    table.id !== undefined ? `Table ${table.id}` : "",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    const cleanCand = c.toLowerCase().replace(/^(table|tbl|t)\s*[-_:]*\s*/i, "").trim();
    if (cleanCand && cleanCand === cleanTarget) return true;
  }

  return false;
}

/**
 * Single Source of Truth for whether an order record occupies a table:
 * An order ONLY occupies a table if:
 * order.payment_status !== 'paid' AND order.order_status !== 'cancelled' AND order.order_status !== 'completed'
 * Status casing and enums are strictly checked case-insensitively ('paid', 'completed', 'cancelled').
 */
export function isOrderOccupyingTable(order: {
  payment_status?: string | null;
  paymentStatus?: string | null;
  order_status?: string | null;
  orderStatus?: string | null;
  status?: string | null;
  [key: string]: any;
} | null | undefined): boolean {
  if (!order) return false;
  const payStatus = String(order.payment_status ?? order.paymentStatus ?? "").trim().toLowerCase();
  const ordStatus = String(order.order_status ?? order.orderStatus ?? order.status ?? "").trim().toLowerCase();

  // If paid, it NEVER occupies a table
  if (payStatus === "paid") return false;

  // If completed, cancelled, voided, or archived, it NEVER occupies a table
  if (
    ordStatus === "completed" ||
    ordStatus === "cancelled" ||
    ordStatus === "voided" ||
    ordStatus === "archived"
  ) {
    return false;
  }

  return true;
}

/**
 * Fetch all active unpaid Dine-In records across orders and kitchen_tickets tables.
 * Single source of truth is orders: an order ONLY occupies a table if:
 * order.payment_status !== 'paid' AND order.order_status !== 'cancelled' AND order.order_status !== 'completed'
 */
export async function fetchActiveUnpaidTableRecords(
  restId: string | number,
  supabase: any
): Promise<ActiveUnpaidTableRecord[]> {
  if (!restId || !supabase) return [];
  const restIdNum = Number(restId) || restId;
  const activeRecords: ActiveUnpaidTableRecord[] = [];
  const seenTableNorms = new Set<string>();
  const seenTableDbIds = new Set<string>();

  try {
    // 1. Fetch active unpaid orders from orders table (PRIMARY SINGLE SOURCE OF TRUTH)
    const { data: orderRows, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, kot_id, table_id, customer_name, order_channel, order_status, payment_status, total_amount, subtotal, items, created_at")
      .eq("restaurant_id", restIdNum)
      .neq("payment_status", "paid")
      .neq("order_status", "cancelled")
      .neq("order_status", "completed")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!orderErr && orderRows) {
      orderRows.forEach((o: any) => {
        // Enforce strict single-source rule
        if (!isOrderOccupyingTable(o)) return;

        const channel = (o.order_channel || "").toLowerCase();
        if (
          channel === "takeaway" ||
          channel === "delivery" ||
          channel === "pickup" ||
          channel === "counter"
        ) return;

        let tableDbId: string | number | undefined = undefined;
        let tableRef = "";
        let norm = "";

        if (o.table_id !== null && o.table_id !== undefined && String(o.table_id).trim() !== "") {
          const rawTid = String(o.table_id).trim();
          if (isUuid(rawTid)) {
            tableDbId = rawTid;
          } else {
            tableRef = rawTid;
            norm = normalizeTableNumber(rawTid);
          }
        }

        // If norm is not yet found, extract from customer_name (e.g. "Table 01", "Table 1", "T-1")
        if (!norm && o.customer_name) {
          const cleanCust = o.customer_name.trim();
          if (/^(table|tbl|t)?\s*[-_:]*\s*\d+$/i.test(cleanCust)) {
            norm = normalizeTableNumber(cleanCust);
            if (!tableRef) tableRef = cleanCust;
          }
        }

        if (!tableDbId && !norm && !tableRef) return;

        const totalAmt = Number(o.total_amount || o.subtotal || 0);
        const orderNum = o.order_number || o.id;

        activeRecords.push({
          orderId: String(orderNum),
          kotId: o.kot_id || undefined,
          tableIdentifier: String(tableRef || (norm ? `Table ${norm}` : "")),
          tableNumberNorm: norm,
          tableId: tableDbId || o.table_id,
          totalAmount: totalAmt > 0 ? totalAmt : undefined,
          items: o.items,
          status: o.order_status,
          paymentStatus: o.payment_status,
          createdAt: o.created_at,
          source: "order",
        });
        if (norm) seenTableNorms.add(norm);
        if (tableDbId) seenTableDbIds.add(String(tableDbId));
      });
    }

    // 2. Supplement with active, in-flight kitchen tickets (< 15 mins fresh) if not already tracked
    const { data: ticketRows, error: ticketErr } = await supabase
      .from("kitchen_tickets")
      .select("id, ticket_number, table_number, channel, order_type, status, items, created_at, customer_name")
      .eq("restaurant_id", restIdNum)
      .not("status", "in", '("completed","cancelled","archived","voided")')
      .order("created_at", { ascending: false })
      .limit(50);

    if (!ticketErr && ticketRows) {
      ticketRows.forEach((t: any) => {
        const ticketStatus = String(t.status || "").toLowerCase();
        if (ticketStatus === "cancelled" || ticketStatus === "voided" || ticketStatus === "archived" || ticketStatus === "completed") return;

        const channel = (t.channel || t.order_type || "").toLowerCase();
        const tableStr = t.table_number || t.customer_name || "";
        const isTakeaway =
          channel === "takeaway" ||
          channel === "delivery" ||
          tableStr.toLowerCase().includes("takeaway") ||
          tableStr.toLowerCase().includes("pickup") ||
          tableStr.toLowerCase().includes("delivery");

        if (isTakeaway) return; // Strictly Dine-In tables

        const norm = normalizeTableNumber(tableStr);
        if (!norm) return;

        // If table already has an active unpaid order record, link kotId and items amount
        const existing = activeRecords.find((r) =>
          (norm && r.tableNumberNorm === norm) ||
          isTableMatchingIdentifier({ label: tableStr }, r.tableIdentifier)
        );
        if (existing) {
          if (!existing.kotId) {
            existing.kotId = String(t.ticket_number || t.id);
          }
          if ((!existing.totalAmount || existing.totalAmount === 0) && Array.isArray(t.items)) {
            const ticketAmt = t.items.reduce((acc: number, it: any) => {
              const p = Number(it.price || 0);
              const q = Number(it.quantity || it.qty || 1);
              return acc + (p * q);
            }, 0);
            if (ticketAmt > 0) existing.totalAmount = ticketAmt;
          }
          return;
        }

        // Never let stale kitchen tickets resurrect an order if there is no active unpaid order
        // Only accept if ticket was created very recently (< 15 minutes) as an in-flight dispatch
        const ticketTime = t.created_at ? new Date(t.created_at).getTime() : 0;
        const isFresh = ticketTime > 0 && Date.now() - ticketTime < 15 * 60 * 1000;
        if (!isFresh) return;

        let totalAmt = 0;
        if (Array.isArray(t.items)) {
          totalAmt = t.items.reduce((acc: number, it: any) => {
            const p = Number(it.price || 0);
            const q = Number(it.quantity || it.qty || 1);
            return acc + (p * q);
          }, 0);
        }

        const ticketId = t.ticket_number || t.id;
        activeRecords.push({
          orderId: String(ticketId),
          kotId: String(ticketId),
          tableIdentifier: tableStr,
          tableNumberNorm: norm,
          totalAmount: totalAmt > 0 ? totalAmt : undefined,
          items: t.items,
          status: t.status,
          createdAt: t.created_at,
          source: "kitchen_ticket",
        });
        seenTableNorms.add(norm);
      });
    }
  } catch (err) {
    console.warn("[TableOccupancy] Exception querying active unpaid records:", err);
  }

  return activeRecords;
}

/**
 * Reconcile a collection of TableStatus items against active unpaid records.
 * Single Source of Truth:
 * - An order ONLY occupies a table if:
 *   order.payment_status !== 'paid' AND order.order_status !== 'cancelled' AND order.order_status !== 'completed'
 * - If no active unpaid order exists for a table, force the table status to 'available'
 *   and clear any stale running total amounts.
 */
export function reconcileTableStatuses(
  tables: TableStatus[],
  activeRecords: ActiveUnpaidTableRecord[]
): TableStatus[] {
  if (!tables || tables.length === 0) return [];

  // Filter strictly using the single-source-of-truth condition
  const validRecords = (activeRecords || []).filter((rec) => isOrderOccupyingTable(rec));

  return tables.map((t) => {
    const matchedRecord = validRecords.find((rec) =>
      (rec.tableId && (t.dbId === rec.tableId || String(t.id) === String(rec.tableId))) ||
      isTableMatchingIdentifier(t, rec.tableIdentifier) ||
      isTableMatchingIdentifier(t, rec.tableId) ||
      (rec.tableNumberNorm && normalizeTableNumber(t.label || t.id) === rec.tableNumberNorm)
    );

    if (matchedRecord) {
      return {
        ...t,
        status: "seated", // Renders as "OCCUPIED"
        activeOrderId: matchedRecord.orderId || matchedRecord.kotId || t.activeOrderId,
        activeAmount:
          matchedRecord.totalAmount !== undefined && matchedRecord.totalAmount > 0
            ? matchedRecord.totalAmount
            : t.activeAmount,
      };
    }

    // If no active unpaid record exists, preserve manual reservations
    const isManuallyReserved = t.status === "reserved";
    if (isManuallyReserved) {
      return {
        ...t,
        status: "reserved",
        activeOrderId: undefined,
        activeAmount: undefined,
      };
    }

    // Single source of truth: If no active unpaid order exists for a table,
    // force table status to 'available' and clear any stale running total amounts
    return {
      ...t,
      status: "available",
      activeOrderId: undefined,
      activeAmount: undefined,
    };
  });
}

/**
 * Reconcile a collection of RestaurantTable items against active unpaid records.
 */
export function reconcileRestaurantTables(
  tables: RestaurantTable[],
  activeRecords: ActiveUnpaidTableRecord[]
): RestaurantTable[] {
  if (!tables || tables.length === 0) return [];

  const validRecords = (activeRecords || []).filter((rec) => isOrderOccupyingTable(rec));

  return tables.map((t) => {
    const matchedRecord = validRecords.find((rec) =>
      (rec.tableId && (t.id === rec.tableId || String(t.id) === String(rec.tableId))) ||
      isTableMatchingIdentifier(t, rec.tableIdentifier) ||
      isTableMatchingIdentifier(t, rec.tableId) ||
      (rec.tableNumberNorm && normalizeTableNumber(t.table_number || t.id) === rec.tableNumberNorm)
    );

    if (matchedRecord) {
      return {
        ...t,
        status: "OCCUPIED" as any,
        current_order_id: matchedRecord.orderId || matchedRecord.kotId || t.current_order_id,
        active_order_id: matchedRecord.orderId || matchedRecord.kotId || (t as any).active_order_id,
        active_amount: matchedRecord.totalAmount || (t as any).active_amount,
      };
    }

    const isReserved = (t.status as string) === "RESERVED";
    if (isReserved) {
      return {
        ...t,
        status: "RESERVED",
        current_order_id: null,
        active_order_id: null,
        active_amount: null,
      };
    }

    return {
      ...t,
      status: "AVAILABLE",
      current_order_id: null,
      active_order_id: null,
      active_amount: null,
    };
  });
}

/**
 * Asynchronously heals and updates public.restaurant_tables rows in Supabase:
 * - Marks tables with active unpaid orders as 'occupied'.
 * - Releases tables with zero active orders back to 'available'.
 */
export async function autoHealDatabaseTableOccupancy(
  restId: string | number,
  tables: TableStatus[],
  activeRecords: ActiveUnpaidTableRecord[],
  supabase: any
): Promise<void> {
  if (!restId || !supabase) return;
  const restIdNum = Number(restId) || restId;
  const validRecords = (activeRecords || []).filter((rec) => isOrderOccupyingTable(rec));

  try {
    // Fetch current database table rows to only heal rows whose DB status is actually desynchronized
    const { data: dbTables, error } = await supabase
      .from("restaurant_tables")
      .select("id, status, active_order_id, current_order_id, table_number")
      .eq("restaurant_id", restIdNum);

    if (error || !dbTables || !Array.isArray(dbTables)) return;

    for (const dbTable of dbTables) {
      const dbStatusLower = String(dbTable.status || "available").toLowerCase();
      const dbTableNorm = normalizeTableNumber(dbTable.table_number || dbTable.id);

      const matchedRecord = validRecords.find((rec) =>
        (rec.tableId && String(rec.tableId) === String(dbTable.id)) ||
        (rec.tableNumberNorm && rec.tableNumberNorm === dbTableNorm) ||
        isTableMatchingIdentifier({ id: dbTable.id, label: dbTable.table_number }, rec.tableIdentifier) ||
        isTableMatchingIdentifier({ id: dbTable.id, label: dbTable.table_number }, rec.tableId)
      );

      if (matchedRecord) {
        // Should be occupied. Only update if NOT already marked occupied with this order id!
        const needsUpdate =
          dbStatusLower !== "occupied" ||
          (matchedRecord.orderId && isUuid(matchedRecord.orderId) && dbTable.active_order_id !== matchedRecord.orderId);

        if (needsUpdate) {
          const payload: Record<string, any> = {
            status: "occupied",
            updated_at: new Date().toISOString(),
          };
          if (matchedRecord.orderId && isUuid(matchedRecord.orderId)) {
            payload.active_order_id = matchedRecord.orderId;
          }
          await supabase.from("restaurant_tables").update(payload).eq("id", dbTable.id);
        }
      } else {
        // Should be available (or reserved). Only heal if currently marked occupied or has lingering active_order_id!
        const isReserved = dbStatusLower === "reserved";
        if (!isReserved) {
          const needsRelease =
            dbStatusLower !== "available" ||
            dbTable.active_order_id !== null ||
            dbTable.current_order_id !== null;

          if (needsRelease) {
            await supabase
              .from("restaurant_tables")
              .update({
                status: "available",
                active_order_id: null,
                current_order_id: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", dbTable.id);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[TableOccupancy] autoHealDatabaseTableOccupancy exception:", err);
  }
}

export const TABLE_OCCUPANCY_BROADCAST_CHANNEL = "omni_table_occupancy_sync";

export interface TableReleasedEventData {
  tableId?: string | number;
  tableNumber?: string;
  orderId?: string;
  restaurantId: string | number;
  timestamp: number;
}

/**
 * Broadcasts a clean TABLE_RELEASED event across BroadcastChannel,
 * Supabase Realtime, and in-window CustomEvents.
 */
export function broadcastTableReleased(
  restId: string | number,
  data: { tableId?: string | number; tableNumber?: string; orderId?: string },
  supabase?: any
): void {
  const restIdStr = String(restId);
  const eventPayload: TableReleasedEventData = {
    ...data,
    restaurantId: restIdStr,
    timestamp: Date.now(),
  };

  // 1. Cross-tab BroadcastChannel
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(TABLE_OCCUPANCY_BROADCAST_CHANNEL);
      bc.postMessage({ type: "TABLE_RELEASED", payload: eventPayload });
      bc.close();
    } catch (err) {
      console.warn("[TableOccupancy] BroadcastChannel error:", err);
    }

    try {
      const legacyBc = new BroadcastChannel("pos_ledger_sync_channel");
      legacyBc.postMessage({ type: "TABLE_RELEASED", payload: eventPayload });
      legacyBc.close();
    } catch {}
  }

  // 2. Supabase Realtime Broadcast (if supabase client provided)
  if (supabase) {
    try {
      const channel = supabase.channel(`table_occupancy_${restIdStr}`);
      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          channel
            .send({
              type: "broadcast",
              event: "TABLE_RELEASED",
              payload: eventPayload,
            })
            .then(() => {
              supabase.removeChannel(channel);
            })
            .catch(() => {
              supabase.removeChannel(channel);
            });
        }
      });
    } catch (err) {
      console.warn("[TableOccupancy] Supabase broadcast error:", err);
    }
  }

  // 3. Local Window CustomEvents & storage event
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("table_released", { detail: eventPayload })
      );
      window.dispatchEvent(new CustomEvent("restaurant_tables_changed"));
      window.dispatchEvent(new CustomEvent("pos_tables_updated"));
      localStorage.setItem(`omni_tables_trigger_${restIdStr}`, String(Date.now()));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  }
}

/**
 * Subscribes to TABLE_RELEASED events across BroadcastChannel,
 * Supabase Realtime, and local window events.
 */
export function subscribeToTableReleased(
  restId: string | number,
  onRelease: (data: TableReleasedEventData) => void,
  supabase?: any
): () => void {
  if (typeof window === "undefined") return () => {};
  const restIdStr = String(restId);

  // 1. BroadcastChannel listener
  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(TABLE_OCCUPANCY_BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        const msg = event.data;
        if (msg?.type === "TABLE_RELEASED" && msg.payload) {
          if (!msg.payload.restaurantId || String(msg.payload.restaurantId) === restIdStr) {
            onRelease(msg.payload);
          }
        }
      };
    } catch (err) {
      console.warn("[TableOccupancy] BroadcastChannel subscription error:", err);
    }
  }

  // 2. Window CustomEvent listener
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent;
    if (custom.detail) {
      if (!custom.detail.restaurantId || String(custom.detail.restaurantId) === restIdStr) {
        onRelease(custom.detail);
      }
    }
  };
  window.addEventListener("table_released", handleCustomEvent);

  // 3. Supabase Realtime broadcast listener (if supabase client provided)
  let rtChannel: any = null;
  if (supabase) {
    try {
      rtChannel = supabase
        .channel(`rt_table_release_${restIdStr}_${Math.random().toString(36).slice(2, 7)}`)
        .on("broadcast", { event: "TABLE_RELEASED" }, ({ payload }: any) => {
          if (payload) {
            onRelease(payload);
          }
        })
        .subscribe();
    } catch (err) {
      console.warn("[TableOccupancy] Supabase Realtime subscription error:", err);
    }
  }

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.removeEventListener("table_released", handleCustomEvent);
    if (rtChannel && supabase) {
      try {
        supabase.removeChannel(rtChannel);
      } catch {}
    }
  };
}

