"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Flame,
  Clock,
  CheckCircle2,
  Check,
  Volume2,
  Archive,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Search,
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Store,
  Building2,
  BadgeCheck,
  Timer,
  Utensils,
  Coffee,
  Layers,
  LayoutGrid,
  LayoutList,
  Printer,
  Bell,
  MapPin,
  Bike,
  ShoppingBag,
  Pause,
  Play,
  Ban,
  Lock,
  LogOut,
} from "lucide-react";
import {
  KdsTicket,
  KdsDishStatus,
  KdsItemStatusRecord,
  KitchenTicketPriority,
  KitchenTicketPriorityReason,
  KitchenTicketModification,
} from "@/app/admin/types";
import { useAuth } from "@/app/admin/context/AuthContext";
import ResponsiveSelect from "@/app/admin/components/ResponsiveSelect";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import {
  getStoredKdsTickets,
  saveStoredKdsTickets,
  playModificationChime,
  clearUserSession,
  setActiveUserSession,
  getStoredStaff,
} from "@/lib/tenantStore";
import {
  deductInventoryStockForOrder,
  restockInventoryForOrder,
} from "@/lib/inventoryDeduction";
import {
  isTicketExpired,
  isOrderExpired,
  syncOrderExpiredState,
  ORDER_EXPIRY_CUTOFF_MS,
  getOrderCreationEpochMs,
} from "@/lib/orderExpiry";
import {
  safeUpdateKitchenTicket,
  applyTicketFilter,
} from "@/lib/kitchenTicketSync";
import {
  broadcastKitchenOrderReady,
  broadcastKitchenBuzzerAlert,
  broadcastTakeawayOrderReady,
  broadcastDeliveryOrderReady,
} from "@/lib/kitchenWaiterBridge";
import { formatSmartDuration } from "@/utils/timeFormatters";
import {
  parseShiftOption,
  getShiftStartLabel,
  getShiftEndLabel,
  getShiftWindowLabel,
  getRestaurantShiftConfig,
  getEffectiveShiftsList,
  format24HourTo12Hour,
  ShiftTypeOption,
} from "@/lib/shiftSchedule";
import KitchenSidebar from "./KitchenSidebar";
import KotPrintPreviewModal from "./KotPrintPreviewModal";
import ChefPerformanceStatsView from "./ChefPerformanceStatsView";
import { printerService } from "@/utils/printing/printerService";
import StaffShiftRolloverModal from "../components/StaffShiftRolloverModal";
import { recordStaffShiftLogout } from "@/lib/universalShiftLogging";
import { subscribeTerminalEventBus } from "@/lib/terminalRealtimeSync";

import {
  KitchenStationType,
  STATION_OPTIONS,
  StationOption,
  getStationBadgeInfo,
  getMenuItemStation,
  isItemForStation,
  isTicketApplicableToStation,
  filterTicketItemsForStation,
  normalizeStationName,
} from "@/lib/kitchenStationRouting";

export type { KitchenStationType, StationOption };
export {
  STATION_OPTIONS,
  getStationBadgeInfo,
  isTicketApplicableToStation,
  normalizeStationName,
  isItemForStation,
  filterTicketItemsForStation,
  getMenuItemStation,
};

export function getTicketStation(ticket: any): KitchenStationType {
  const explicit = (ticket.station_assigned || ticket.station || "").toLowerCase().trim();
  if (explicit) {
    return normalizeStationName(explicit);
  }
  if (ticket.items && Array.isArray(ticket.items) && ticket.items.length > 0) {
    return getMenuItemStation(ticket.items[0]);
  }
  return "assembly";
}

export function getPriorityRank(priority?: string): number {
  const norm = (priority || "normal").toLowerCase();
  if (norm === "rush" || norm === "urgent") return 0;
  if (norm === "high") return 1;
  if (norm === "normal") return 2;
  if (norm === "chill") return 3;
  return 2;
}

export interface PriorityVisualConfig {
  label: "RUSH" | "HIGH" | "NORMAL" | "CHILL";
  badgeEmoji: string;
  badgeClass: string;
  cardBorderClass: string;
  isRush: boolean;
  reasonLabel?: string;
}

export function getPriorityVisualConfig(
  priority?: string,
  reason?: string | null
): PriorityVisualConfig {
  const norm = (priority || "normal").toLowerCase();
  const formatReason = (r?: string | null) => {
    if (!r) return undefined;
    switch (r) {
      case "vip_customer":
        return "VIP Customer";
      case "delivery_sla":
        return "Delivery SLA";
      case "manager_marked":
        return "Manager Marked";
      case "auto_escalated":
        return "Auto Escalated (>10m)";
      default:
        return r.replace(/_/g, " ");
    }
  };

  const reasonLabel = formatReason(reason);

  if (norm === "rush" || norm === "urgent") {
    return {
      label: "RUSH",
      badgeEmoji: "⚡",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold tracking-wide",
      cardBorderClass: "border-amber-500/50 shadow-md shadow-black/30",
      isRush: true,
      reasonLabel,
    };
  }

  if (norm === "high") {
    return {
      label: "HIGH",
      badgeEmoji: "▲",
      badgeClass: "bg-stone-800 text-stone-200 border-stone-700/80 font-semibold tracking-wide",
      cardBorderClass: "border-stone-700/80 shadow-sm shadow-black/20",
      isRush: false,
      reasonLabel,
    };
  }

  if (norm === "chill") {
    return {
      label: "CHILL",
      badgeEmoji: "▼",
      badgeClass: "bg-stone-800/60 text-stone-400 border-stone-800 font-medium tracking-wide",
      cardBorderClass: "border-stone-800 hover:border-stone-700",
      isRush: false,
      reasonLabel,
    };
  }

  return {
    label: "NORMAL",
    badgeEmoji: "",
    badgeClass: "bg-stone-800/40 text-stone-400 border-stone-800",
    cardBorderClass: "border-stone-800 hover:border-stone-700",
    isRush: false,
    reasonLabel,
  };
}

export type OrderChannelType = "dine_in" | "takeaway" | "delivery";

export interface OrderChannelInfo {
  channel: OrderChannelType;
  badgeText: string;
  badgeEmoji: string;
  badgeClass: string;
  actionText: string;
  actionIcon: string;
}

export function getOrderChannelInfo(ticket: KdsTicket): OrderChannelInfo {
  const rawType = (
    ticket.order_type ||
    ticket.orderType ||
    ticket.tableOrChannel ||
    ""
  ).toLowerCase().trim();

  const isDelivery =
    rawType === "delivery" ||
    rawType.includes("delivery") ||
    rawType.includes("rider") ||
    Boolean(
      ticket.delivery_address ||
      ticket.deliveryAddress ||
      ticket.delivery_area ||
      ticket.deliveryArea ||
      ticket.rider_name ||
      ticket.riderName
    );

  const isTakeaway =
    !isDelivery &&
    (rawType === "takeaway" ||
      rawType.includes("takeaway") ||
      rawType.includes("pickup") ||
      rawType.includes("counter"));

  if (isDelivery) {
    return {
      channel: "delivery",
      badgeText: "DELIVERY",
      badgeEmoji: "🚗",
      badgeClass:
        "bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold",
      actionText: "Ready for Rider",
      actionIcon: "🛵",
    };
  }

  if (isTakeaway) {
    return {
      channel: "takeaway",
      badgeText: "TAKEAWAY",
      badgeEmoji: "🛍️",
      badgeClass:
        "bg-stone-800 text-amber-200/90 border-stone-700 font-semibold",
      actionText: "Ready for Pickup",
      actionIcon: "🛍️",
    };
  }

  return {
    channel: "dine_in",
    badgeText: "DINE-IN",
    badgeEmoji: "🍽️",
    badgeClass:
      "bg-stone-800/60 text-stone-300 border-stone-700/60 font-semibold",
    actionText: "Hand to Waiter",
    actionIcon: "🔔",
  };
}

export function getTicketItemsStatus(ticket: KdsTicket): KdsItemStatusRecord[] {
  // ticket.items is the authoritative source of ordered items.
  // We strictly iterate through ticket.items so no ghost or residual items are ever displayed.
  if (!ticket.items || !Array.isArray(ticket.items) || ticket.items.length === 0) {
    return [];
  }

  const isReady = ticket.status === "ready" || ticket.status === "completed";
  const isCooking = ticket.status === "preparing";

  return ticket.items.map((it, idx) => {
    const rawQty = Number(it.qty || (it as any).quantity || 1);
    const dishPrep =
      it.preparation_time ||
      parseInt(String(it.prepTime || "15").replace(/[^0-9]/g, "")) ||
      15;

    // Combine all note sources cleanly without dropping any instructions
    const rawNoteParts = [
      it.notes,
      (it as any).special_instructions,
      (it as any).specialInstructions,
      (it as any).instructions,
    ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

    const extractedNotes = rawNoteParts.length > 0 ? rawNoteParts.join(" • ") : undefined;

    const rawModifiers: string[] = [];
    if (Array.isArray((it as any).modifiers)) {
      (it as any).modifiers.forEach((m: any) => {
        if (typeof m === "string" && m.trim()) {
          rawModifiers.push(m.trim());
        } else if (m && typeof m === "object" && (m.name || m.label || m.title)) {
          rawModifiers.push(String(m.name || m.label || m.title).trim());
        }
      });
    } else if (typeof (it as any).modifier === "string" && (it as any).modifier.trim()) {
      (it as any).modifier.split(/[,•]/).forEach((part: string) => {
        if (part.trim()) rawModifiers.push(part.trim());
      });
    }

    const rawVariant =
      it.variant_name ||
      it.selectedVariant?.name ||
      it.variant?.name ||
      (it as any).variantName ||
      null;

    const rawSpecialInstructions =
      (it as any).special_instructions ||
      (it as any).specialInstructions ||
      (it as any).instructions ||
      null;

    const itemId = (it as any).id || (it as any).item_id || `${ticket.id}-item-${idx}`;

    // Find any existing status record for this exact item in ticket.items_status
    let matchedStatusRecord: KdsItemStatusRecord | undefined;
    if (Array.isArray(ticket.items_status) && ticket.items_status.length > 0) {
      matchedStatusRecord =
        ticket.items_status.find(
          (sr) => sr && ((sr.item_id && sr.item_id === itemId) || sr.name === it.name)
        );
    }

    if (matchedStatusRecord) {
      return {
        ...matchedStatusRecord,
        item_id: itemId,
        name: it.name || matchedStatusRecord.name || "Dish",
        quantity: rawQty,
        prep_time_minutes: dishPrep,
        notes: matchedStatusRecord.notes || extractedNotes || undefined,
        modifiers: matchedStatusRecord.modifiers || (rawModifiers.length > 0 ? rawModifiers : undefined),
        variant_name: matchedStatusRecord.variant_name || rawVariant || null,
        special_instructions: matchedStatusRecord.special_instructions || rawSpecialInstructions || null,
        status: matchedStatusRecord.status || (isReady ? "ready" : isCooking ? "cooking" : "waiting"),
      };
    }

    return {
      item_id: itemId,
      name: it.name || (it as any).item?.name || "Dish",
      quantity: rawQty,
      status: isReady ? "ready" : isCooking ? "cooking" : "waiting",
      started_at: isCooking ? (ticket.prep_timer_started_at || ticket.prepStartedAt || null) : null,
      completed_at: isReady ? (ticket.created_at || null) : null,
      prep_time_minutes: dishPrep,
      notes: extractedNotes || undefined,
      modifiers: rawModifiers.length > 0 ? rawModifiers : undefined,
      variant_name: rawVariant || null,
      special_instructions: rawSpecialInstructions || null,
    };
  });
}

export interface InstructionTag {
  type: "no_ingredient" | "spicy" | "allergy" | "vegan" | "custom";
  label: string;
  badge: string;
  className: string;
}

export function detectInstructionTags(text?: string | null): InstructionTag[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const tags: InstructionTag[] = [];

  // 1. ALLERGY KEYWORDS: High visibility alert
  if (
    lower.includes("allergy") ||
    lower.includes("allergic") ||
    lower.includes("nut") ||
    lower.includes("peanut") ||
    lower.includes("lactose") ||
    lower.includes("dairy") ||
    lower.includes("gluten") ||
    lower.includes("shellfish") ||
    lower.includes("egg") ||
    lower.includes("sesame")
  ) {
    let allergyType = "ALLERGY ALERT";
    if (lower.includes("peanut")) allergyType = "PEANUT ALLERGY";
    else if (lower.includes("nut")) allergyType = "NUT ALLERGY";
    else if (lower.includes("lactose")) allergyType = "LACTOSE ALLERGY";
    else if (lower.includes("dairy")) allergyType = "DAIRY ALLERGY";
    else if (lower.includes("gluten")) allergyType = "GLUTEN ALLERGY";
    else if (lower.includes("shellfish")) allergyType = "SHELLFISH ALLERGY";
    else if (lower.includes("egg")) allergyType = "EGG ALLERGY";
    else if (lower.includes("sesame")) allergyType = "SESAME ALLERGY";

    tags.push({
      type: "allergy",
      label: allergyType,
      badge: "⚠️",
      className:
        "bg-rose-500/20 text-rose-200 border border-rose-500/50 font-black uppercase tracking-wider",
    });
  }

  // 2. NO INGREDIENT KEYWORDS: "no onion", "no garlic", "without sugar", etc.
  const noMatches = lower.match(/\b(?:no|without)\s+([a-z0-9_-]+)/gi);
  if (noMatches && noMatches.length > 0) {
    const seen = new Set<string>();
    noMatches.forEach((m) => {
      const clean = m.trim().toUpperCase();
      if (!seen.has(clean)) {
        seen.add(clean);
        tags.push({
          type: "no_ingredient",
          label: clean,
          badge: "🚫",
          className:
            "bg-stone-800 text-stone-200 border border-stone-600 font-bold uppercase tracking-wider",
        });
      }
    });
  }

  // 3. SPICY / HEAT LEVEL KEYWORDS
  if (
    lower.includes("extra spicy") ||
    lower.includes("very spicy") ||
    lower.includes("extra hot")
  ) {
    tags.push({
      type: "spicy",
      label: "EXTRA SPICY",
      badge: "🌶️",
      className:
        "bg-red-500/20 text-red-200 border border-red-500/40 font-bold uppercase tracking-wider",
    });
  } else if (
    lower.includes("mild spicy") ||
    lower.includes("less spicy") ||
    lower.includes("mild")
  ) {
    tags.push({
      type: "spicy",
      label: "MILD SPICE",
      badge: "🌶️",
      className:
        "bg-amber-500/15 text-amber-200 border border-amber-500/30 font-semibold uppercase tracking-wider",
    });
  } else if (lower.includes("spicy") || lower.includes("hot")) {
    tags.push({
      type: "spicy",
      label: "SPICY",
      badge: "🌶️",
      className:
        "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold uppercase tracking-wider",
    });
  }

  // 4. VEGAN / VEGETARIAN KEYWORDS
  if (lower.includes("vegan")) {
    tags.push({
      type: "vegan",
      label: "VEGAN",
      badge: "🌱",
      className:
        "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase tracking-wider",
    });
  } else if (lower.includes("vegetarian") || lower.includes("pure veg")) {
    tags.push({
      type: "vegan",
      label: "VEGETARIAN",
      badge: "🌱",
      className:
        "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold uppercase tracking-wider",
    });
  }

  return tags;
}

export interface FormattedItemModifiers {
  variantName: string | null;
  modifierPills: string[];
  instructionTags: InstructionTag[];
  customCookingNote: string | null;
}

export function extractItemModifiersAndNotes(
  item: KdsItemStatusRecord,
  ticketItem?: any
): FormattedItemModifiers {
  // 1. Identify variant
  let variantName: string | null = null;
  const rawVariant =
    item.variant_name ||
    ticketItem?.variant_name ||
    ticketItem?.selectedVariant?.name ||
    ticketItem?.variant?.name ||
    (ticketItem as any)?.variantName ||
    null;

  if (rawVariant && typeof rawVariant === "string" && rawVariant.trim()) {
    if (!item.name.toLowerCase().includes(rawVariant.toLowerCase().trim())) {
      variantName = rawVariant.trim();
    }
  }

  // 2. Identify modifiers list
  const modifierPills: string[] = [];
  const seenMods = new Set<string>();

  const addModifier = (mStr: string) => {
    const cleaned = mStr.trim();
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    // Don't duplicate variant name
    if (variantName && lower === variantName.toLowerCase()) return;
    // Don't duplicate dish name
    if (lower === item.name.toLowerCase()) return;
    // Check if it's "Variant: XYZ"
    if (/^variant:\s*/i.test(cleaned)) {
      const v = cleaned.replace(/^variant:\s*/i, "").trim();
      if (v && !variantName && !item.name.toLowerCase().includes(v.toLowerCase())) {
        variantName = v;
      }
      return;
    }
    if (!seenMods.has(lower)) {
      seenMods.add(lower);
      modifierPills.push(cleaned);
    }
  };

  // From item.modifiers or ticketItem.modifiers
  const modsSource = item.modifiers || (ticketItem as any)?.modifiers;
  if (Array.isArray(modsSource)) {
    modsSource.forEach((m: any) => {
      if (typeof m === "string") {
        addModifier(m);
      } else if (m && typeof m === "object" && (m.name || m.label || m.title)) {
        addModifier(m.name || m.label || m.title);
      }
    });
  }

  // From (ticketItem as any).modifier
  if (typeof (ticketItem as any)?.modifier === "string") {
    (ticketItem as any).modifier.split(/[,•]/).forEach((part: string) => addModifier(part));
  }

  // 3. Extract Notes & Instruction Tags
  const noteSources: string[] = [
    item.notes,
    ticketItem?.notes,
    item.special_instructions,
    ticketItem?.special_instructions,
    (ticketItem as any)?.specialInstructions,
    (ticketItem as any)?.instructions,
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  const combinedNoteText = noteSources.join(" • ");
  const instructionTags = detectInstructionTags(combinedNoteText);

  // 4. Formulate Clean Custom Cooking Note
  let customCookingNote: string | null = null;
  if (noteSources.length > 0) {
    const noteParts = combinedNoteText
      .split(/•|\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const filteredParts = noteParts.filter((part) => {
      const pLower = part.toLowerCase();
      // Remove variant mentions
      if (/^variant:\s*/i.test(part)) {
        const v = part.replace(/^variant:\s*/i, "").trim();
        if (v && !variantName && !item.name.toLowerCase().includes(v.toLowerCase())) {
          variantName = v;
        }
        return false;
      }
      if (variantName && pLower === variantName.toLowerCase()) return false;
      // If it's already in modifierPills, don't duplicate
      if (seenMods.has(pLower)) return false;

      // If it matches an instruction tag exactly (e.g. "no onion"), don't duplicate
      const matchesExistingTag = instructionTags.some((t) =>
        pLower === t.label.toLowerCase() || pLower === `no ${t.label.replace("NO ", "").toLowerCase()}`
      );
      if (matchesExistingTag) return false;

      return true;
    });

    if (filteredParts.length > 0) {
      customCookingNote = filteredParts.join(" • ");
    }
  }

  return {
    variantName,
    modifierPills,
    instructionTags,
    customCookingNote,
  };
}

export interface TicketAllergyAlert {
  source: string;
  warning: string;
}

export function extractTicketAllergies(ticket: KdsTicket): TicketAllergyAlert[] {
  const alerts: TicketAllergyAlert[] = [];
  const allergyRegex = /\b(allergy|allergic|nut|peanut|lactose|dairy|gluten|shellfish|egg|sesame)\b/i;

  // 1. Ticket-level notes
  const ticketNoteTexts = [
    ticket.notes,
    ticket.chef_notes,
    (ticket as any).chefNotes,
    (ticket as any).special_instructions,
    (ticket as any).instructions,
    (ticket as any).order_notes,
  ].filter(Boolean) as string[];

  ticketNoteTexts.forEach((nt) => {
    if (allergyRegex.test(nt)) {
      alerts.push({ source: "Order Note", warning: nt });
    }
  });

  // 2. Ticket items
  if (Array.isArray(ticket.items)) {
    ticket.items.forEach((it) => {
      const itNotes = [
        it.notes,
        (it as any).special_instructions,
        (it as any).specialInstructions,
        (it as any).instructions,
        (it as any).modifier,
        Array.isArray((it as any).modifiers) ? (it as any).modifiers.join(", ") : undefined,
      ].filter(Boolean) as string[];

      const combined = itNotes.join(" • ");
      if (combined && allergyRegex.test(combined)) {
        alerts.push({ source: it.name, warning: combined });
      }
    });
  }

  // 3. items_status if present
  if (Array.isArray(ticket.items_status)) {
    ticket.items_status.forEach((is) => {
      if (is.notes && allergyRegex.test(is.notes)) {
        const exists = alerts.some((a) => a.source === is.name && a.warning === is.notes);
        if (!exists) {
          alerts.push({ source: is.name, warning: is.notes });
        }
      }
    });
  }

  return alerts;
}

export function getItemTiming(item: KdsItemStatusRecord, ticket: KdsTicket, nowMs: number) {
  const prepMinutes = item.prep_time_minutes || 15;
  const startedAt =
    item.started_at ||
    (item.status === "cooking" ? (ticket.prep_timer_started_at || ticket.prepStartedAt) : null);

  if (item.status === "ready") {
    return {
      statusText: "Ready",
      isOverdue: false,
      remainingSeconds: 0,
      badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 font-semibold",
    };
  }

  const isPaused = ticket.status === "paused";
  const currentPauseSec = isPaused && (ticket.paused_at || ticket.pausedAt)
    ? Math.max(0, Math.floor((nowMs - new Date(ticket.paused_at || ticket.pausedAt!).getTime()) / 1000))
    : 0;
  const totalAccumulatedPausedSec = (ticket.total_paused_seconds || ticket.totalPausedSeconds || 0) + currentPauseSec;

  if (item.status === "waiting" || !startedAt) {
    return {
      statusText: `~${prepMinutes}m`,
      isOverdue: false,
      remainingSeconds: prepMinutes * 60,
      badgeClass: "text-[var(--text-lo)] bg-[var(--surface-hi)] border-[var(--border)] font-medium",
    };
  }

  const startMs = new Date(startedAt).getTime();
  const rawElapsedSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const elapsedSeconds = Math.max(0, rawElapsedSeconds - totalAccumulatedPausedSec);
  const totalSeconds = prepMinutes * 60;
  const remainingSeconds = totalSeconds - elapsedSeconds;
  const isOverdue = remainingSeconds <= 0;
  const absRemaining = Math.abs(remainingSeconds);

  if (isPaused) {
    return {
      statusText: "Paused",
      isOverdue: false,
      remainingSeconds: Math.max(0, remainingSeconds),
      badgeClass: "text-stone-300 bg-stone-800 border-stone-700 font-medium",
    };
  }

  return {
    statusText: isOverdue ? `+${formatSmartDuration(absRemaining)} Overdue` : `${formatSmartDuration(absRemaining)} left`,
    isOverdue,
    remainingSeconds,
    badgeClass: isOverdue
      ? "text-amber-300 bg-amber-950/40 border-amber-600/40 font-semibold"
      : "text-amber-400 bg-amber-500/15 border-amber-500/30 font-semibold",
  };
}


// Order modification diff detector for KDS live tickets
export function detectTicketModifications(
  oldItems: any[],
  newItems: any[],
  modifiedBy?: string
): KitchenTicketModification[] {
  const oldMap = new Map<string, number>();
  (oldItems || []).forEach((it) => {
    const name = (it.name || it.item?.name || "Dish").trim();
    const qty = Number(it.qty || it.quantity || 1);
    oldMap.set(name, (oldMap.get(name) || 0) + qty);
  });

  const newMap = new Map<string, number>();
  (newItems || []).forEach((it) => {
    const name = (it.name || it.item?.name || "Dish").trim();
    const qty = Number(it.qty || it.quantity || 1);
    newMap.set(name, (newMap.get(name) || 0) + qty);
  });

  const diffs: KitchenTicketModification[] = [];
  const timestamp = new Date().toISOString();

  // Additions and quantity increases
  for (const [name, newQty] of newMap.entries()) {
    const oldQty = oldMap.get(name) || 0;
    if (oldQty === 0) {
      diffs.push({
        type: "added",
        item_name: name,
        qty: newQty,
        new_qty: newQty,
        old_qty: 0,
        modified_at: timestamp,
        modified_by: modifiedBy,
      });
    } else if (newQty > oldQty) {
      diffs.push({
        type: "qty_changed",
        item_name: name,
        qty: newQty - oldQty,
        old_qty: oldQty,
        new_qty: newQty,
        modified_at: timestamp,
        modified_by: modifiedBy,
      });
    }
  }

  // Removals and quantity decreases
  for (const [name, oldQty] of oldMap.entries()) {
    const newQty = newMap.get(name) || 0;
    if (newQty === 0) {
      diffs.push({
        type: "removed",
        item_name: name,
        qty: oldQty,
        old_qty: oldQty,
        new_qty: 0,
        modified_at: timestamp,
        modified_by: modifiedBy,
      });
    } else if (newQty < oldQty) {
      diffs.push({
        type: "qty_changed",
        item_name: name,
        qty: newQty - oldQty,
        old_qty: oldQty,
        new_qty: newQty,
        modified_at: timestamp,
        modified_by: modifiedBy,
      });
    }
  }

  return diffs;
}

export const VOID_REASONS = [
  { id: "Customer Walked Out", label: "Customer Walked Out", desc: "Guest left before food was prepared" },
  { id: "Mistake / Duplicate Order", label: "Mistake / Duplicate Order", desc: "Duplicate entry or wrong items keyed by staff" },
  { id: "Payment Failed / Cancelled", label: "Payment Failed / Cancelled", desc: "Payment was declined, refunded, or cancelled at POS" },
  { id: "Kitchen Spoilage / Out of Stock", label: "Kitchen Spoilage / Out of Stock", desc: "Ingredient spoiled or kitchen cannot fulfill dish" },
  { id: "Other", label: "Other", desc: "Specify custom void reason below" },
];

export default function KitchenTerminalClient() {
  const router = useRouter();
  const { user, setUser, shiftValidation, isShiftLocked, logout } = useAuth();
  const currentOrgId = user?.organizationId || user?.id || "default";

  // Shift Rollover & Timing Governance
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [shiftSnoozedUntil, setShiftSnoozedUntil] = useState<number>(0);

  useEffect(() => {
    if (!isShiftLocked) {
      setIsRolloverModalOpen(false);
      return;
    }

    const checkPrompt = () => {
      const now = Date.now();
      if (now >= shiftSnoozedUntil) {
        setIsRolloverModalOpen(true);
      }
    };

    checkPrompt();
    const timer = setInterval(checkPrompt, 5000);
    return () => clearInterval(timer);
  }, [isShiftLocked, shiftSnoozedUntil]);

  const handleRolloverSuccess = (nextShift: string) => {
    if (user) {
      const updatedUser = { ...user, assignedShift: nextShift };
      setUser(updatedUser);
      setActiveUserSession(updatedUser);
    }
    setShiftSnoozedUntil(0);
    setIsRolloverModalOpen(false);
    showToast(`✅ Kitchen Shift successfully rolled over to ${nextShift}!`);
  };

  const handleHandoverLogout = async () => {
    try {
      await recordStaffShiftLogout(user, { station: "kitchen", notes: "Handed over at shift conclusion" });
    } catch {}
    clearUserSession();
    logout();
    router.replace("/login");
  };

  // 10-Minute Warning: Evaluated dynamically (activeShift.end_time - 10 minutes)
  const lastWarningToastRef = useRef<number>(0);
  useEffect(() => {
    if (shiftValidation?.isValid && shiftValidation?.isWarningWindow) {
      const now = Date.now();
      if (now - lastWarningToastRef.current >= 3 * 60 * 1000) {
        lastWarningToastRef.current = now;
        showToast(
          `⚠️ Shift Warning: Your scheduled kitchen shift ends in ${shiftValidation.minutesRemaining}m (${shiftValidation.shiftEndLabel}). Please prepare for handover.`
        );
      }
    }
  }, [shiftValidation?.isValid, shiftValidation?.isWarningWindow, shiftValidation?.minutesRemaining, shiftValidation?.shiftEndLabel]);

  // Remind Me Later — dismiss modal and snooze (bounded by 30-min grace deadline)
  const handleRemindLater = (snoozeUntilMs?: number) => {
    setIsRolloverModalOpen(false);
    const target = snoozeUntilMs || (Date.now() + 10 * 60 * 1000);
    setShiftSnoozedUntil(target);
    showToast("Shift alert snoozed for 10 minutes.");
  };

  // Manager Role Authorization Check (for Priority Override Dropdowns)
  const isManager = useMemo(() => {
    if (!user) return false;
    const rawRole = (user.staffRole || user.role || "").toLowerCase().trim();
    return (
      rawRole === "manager" ||
      rawRole === "admin" ||
      rawRole === "owner" ||
      rawRole === "floor_manager" ||
      rawRole === "supervisor" ||
      (user as any)?.isAdmin === true ||
      (user as any)?.is_admin === true
    );
  }, [user]);

  // Role Access Guard: Redirect Cashiers to POS Terminal
  useEffect(() => {
    if (!user) return;
    const rawRole = (user.staffRole || user.role || "").toLowerCase().trim();
    const isChef =
      rawRole === "chef" ||
      rawRole === "kitchen" ||
      rawRole === "cook" ||
      rawRole === "kds" ||
      user.terminalAccess === "KDS_ONLY" ||
      (user.terminalAccess as string) === "KITCHEN_ONLY";
    const isCashier =
      !isChef &&
      (rawRole === "cashier" || user.terminalAccess === "POS_ONLY");

    if (isCashier) {
      router.replace("/terminal/pos");
    }
  }, [user, router]);

  // Strict Real-Time Feed: Hydrate from stored tickets first to prevent blank flash, followed by live Supabase sync
  const [kdsTickets, setKdsTickets] = useState<KdsTicket[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = getStoredKdsTickets(currentOrgId, []);
        if (Array.isArray(stored) && stored.length > 0) {
          return stored.filter(
            (t) =>
              t &&
              t.id &&
              !["1024", "1025", "1026", "1027", "#1024", "#1025", "#1026", "#1027", "mock", "dummy"].some((m) =>
                String(t.id).toLowerCase().includes(m)
              )
          );
        }
      } catch {}
    }
    return [];
  });
  const [restaurantId, setRestaurantId] = useState<string | number>(currentOrgId);

  // Purge any legacy mock/dummy tickets from local storage on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = getStoredKdsTickets(currentOrgId, []);
        if (Array.isArray(stored) && stored.length > 0) {
          const cleaned = stored.filter(
            (t) =>
              t &&
              t.id &&
              !["1024", "1025", "1026", "1027", "#1024", "#1025", "#1026", "#1027", "mock", "dummy"].some((m) =>
                String(t.id).toLowerCase().includes(m)
              )
          );
          if (cleaned.length !== stored.length) {
            saveStoredKdsTickets(currentOrgId, cleaned);
          }
        }
      }
    } catch { }
  }, [currentOrgId]);

  // User Role & Elevated Privileges Identification
  const staffRole = String(user?.staffRole || (user as any)?.staff_role || "").toLowerCase().trim();
  const baseRole = String(user?.role || (user as any)?.job_title || "").toLowerCase().trim();
  const combinedRole = `${staffRole} ${baseRole}`;

  // Elevated kitchen managers who have cross-station oversight authority
  const isElevatedKitchenManager = useMemo(() => {
    if (!user) return false;
    return (
      combinedRole.includes("admin") ||
      combinedRole.includes("owner") ||
      combinedRole.includes("manager") ||
      combinedRole.includes("supervisor") ||
      combinedRole.includes("head") ||
      combinedRole.includes("lead") ||
      (user as any)?.isAdmin === true ||
      (user as any)?.is_admin === true
    );
  }, [user, combinedRole]);

  // Multi-Station Oversight:
  // Strictly restricted to elevated managers and admins. Standard line chefs NEVER have multi-station oversight.
  const canOversightAllStations = useMemo(() => {
    return isElevatedKitchenManager;
  }, [isElevatedKitchenManager]);

  // A line cook is locked strictly to their designated station queue:
  const isLineCook = useMemo(() => {
    return !canOversightAllStations;
  }, [canOversightAllStations]);

  // Chef Assigned Station & Real-time Synchronization
  const [liveAssignedStation, setLiveAssignedStation] = useState<KitchenStationType | null>(() => {
    const raw = (user?.assigned_station || (user as any)?.assignedStation || (user as any)?.station || "").toLowerCase().trim();
    if (raw && raw !== "all" && raw !== "general") {
      return normalizeStationName(raw);
    }
    return null;
  });

  // Real-time synchronization of assigned station directly from staff profile in Supabase
  useEffect(() => {
    if (!user?.email) return;
    let isMounted = true;

    const syncChefStation = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("staff_members")
          .select("assigned_station, role, shift")
          .eq("email", user.email.toLowerCase().trim())
          .maybeSingle();

        if (!error && data && isMounted) {
          const freshRaw = (data.assigned_station || "").toLowerCase().trim();
          if (freshRaw && freshRaw !== "all" && freshRaw !== "general") {
            const normalized = normalizeStationName(freshRaw);
            setLiveAssignedStation(normalized);
            // Also sync active user session if out of date
            const currentStation = (user.assigned_station || user.assignedStation || "").toLowerCase().trim();
            if (normalizeStationName(currentStation) !== normalized) {
              const updatedUser = {
                ...user,
                assigned_station: normalized,
                assignedStation: normalized,
              };
              setUser(updatedUser);
              setActiveUserSession(updatedUser);
            }
          }
        }
      } catch (err) {
        console.warn("[KitchenTerminal] Could not sync staff assigned station:", err);
      }
    };

    syncChefStation();
    return () => {
      isMounted = false;
    };
  }, [user?.email]);

  const chefAssignedStation = useMemo<KitchenStationType>(() => {
    if (liveAssignedStation) return liveAssignedStation;
    let raw = (user?.assigned_station || (user as any)?.assignedStation || (user as any)?.station || "").toLowerCase().trim();
    if (!raw && typeof window !== "undefined" && user?.email) {
      try {
        const list = getStoredStaff(currentOrgId, []);
        const found = list.find((s: any) => s.email && s.email.toLowerCase().trim() === user.email.toLowerCase().trim());
        if (found) {
          raw = ((found as any).assigned_station || (found as any).assignedStation || (found as any).station || "").toLowerCase().trim();
        }
      } catch {}
    }
    if (raw && raw !== "all" && raw !== "general") {
      return normalizeStationName(raw);
    }
    // For standard chefs without an explicit station, default cleanly to "assembly"
    return isLineCook ? "assembly" : ("all" as KitchenStationType);
  }, [liveAssignedStation, user, currentOrgId, isLineCook]);

  // Default view: Strictly filter to assigned kitchen station for line chefs, or "all" for elevated managers
  const [selectedStation, setSelectedStation] = useState<KitchenStationType>(() => {
    if (!canOversightAllStations) {
      const raw = (user?.assigned_station || (user as any)?.assignedStation || "").toLowerCase().trim();
      if (raw && raw !== "all" && raw !== "general") {
        return normalizeStationName(raw);
      }
      return "assembly";
    }
    return "all";
  });

  const hasInitializedStationRef = useRef(false);
  useEffect(() => {
    if (isLineCook && chefAssignedStation && !hasInitializedStationRef.current) {
      hasInitializedStationRef.current = true;
      setSelectedStation(chefAssignedStation);
    }
  }, [isLineCook, chefAssignedStation]);

  // Strictly enforce that line cooks remain locked to their designated station queue
  useEffect(() => {
    if (isLineCook) {
      const target = chefAssignedStation || "assembly";
      if (selectedStation !== target) {
        setSelectedStation(target);
      }
    }
  }, [isLineCook, chefAssignedStation, selectedStation]);

  // Load configured stations dynamically from Supabase
  const [kitchenStations, setKitchenStations] = useState<any[]>([]);
  useEffect(() => {
    let isMounted = true;
    const fetchStations = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const { data, error } = await supabase
          .from("kitchen_stations")
          .select("*")
          .eq("restaurant_id", restId)
          .eq("is_active", true);

        if (!error && data && data.length > 0 && isMounted) {
          setKitchenStations(data);
        }
      } catch {
        // Fallback to STATION_OPTIONS
      }
    };
    fetchStations();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const [activeTab, setActiveTab] = useState<"all_active" | "queued" | "preparing" | "paused" | "ready" | "completed" | "voided" | "profile" | "stats">("all_active");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isBuzzerRinging, setIsBuzzerRinging] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pause Cooking Modal State
  const [isPauseModalOpen, setIsPauseModalOpen] = useState<boolean>(false);
  const [pauseTargetTicket, setPauseTargetTicket] = useState<KdsTicket | null>(null);
  const [selectedPauseReason, setSelectedPauseReason] = useState<string>("Out of Stock");
  const [customPauseReason, setCustomPauseReason] = useState<string>("");

  const handleOpenPauseModal = (ticket: KdsTicket) => {
    setPauseTargetTicket(ticket);
    setSelectedPauseReason("Out of Stock");
    setCustomPauseReason("");
    setIsPauseModalOpen(true);
  };

  const handleClosePauseModal = () => {
    setIsPauseModalOpen(false);
    setPauseTargetTicket(null);
    setSelectedPauseReason("Out of Stock");
    setCustomPauseReason("");
  };

  // ❌ Void Order Modal State (Manager Role Only)
  const [isVoidModalOpen, setIsVoidModalOpen] = useState<boolean>(false);
  const [voidTargetTicket, setVoidTargetTicket] = useState<KdsTicket | null>(null);
  const [selectedVoidReason, setSelectedVoidReason] = useState<string>("Customer Walked Out");
  const [customVoidReason, setCustomVoidReason] = useState<string>("");
  const [isVoidSubmitting, setIsVoidSubmitting] = useState<boolean>(false);

  const handleOpenVoidModal = (ticket: KdsTicket) => {
    if (!isManager) {
      showToast("🔒 Manager authorization required to void tickets.");
      return;
    }
    setVoidTargetTicket(ticket);
    setSelectedVoidReason("Customer Walked Out");
    setCustomVoidReason("");
    setIsVoidModalOpen(true);
  };

  const handleCloseVoidModal = () => {
    setIsVoidModalOpen(false);
    setVoidTargetTicket(null);
    setSelectedVoidReason("Customer Walked Out");
    setCustomVoidReason("");
    setIsVoidSubmitting(false);
  };

  // 📦 Item Removed Restock Confirmation Modal State
  const [restockConfirmModalData, setRestockConfirmModalData] = useState<{
    isOpen: boolean;
    ticketId: string;
    removedItems: { name: string; qty: number }[];
  } | null>(null);

  const handleConfirmRestock = async () => {
    if (!restockConfirmModalData || !restockConfirmModalData.removedItems?.length) {
      setRestockConfirmModalData(null);
      return;
    }
    try {
      const { restId } = await getValidTenantContext(user);
      await restockInventoryForOrder(restId, restockConfirmModalData.removedItems);
      const itemsList = restockConfirmModalData.removedItems
        .map((i) => `${i.qty}x ${i.name}`)
        .join(", ");
      showToast(`📦 Restocked ingredients for removed item(s): ${itemsList}`);
    } catch (err) {
      console.error("[KitchenTerminal] Restock exception:", err);
      showToast("⚠️ Failed to restock ingredients. Check raw materials.");
    } finally {
      setRestockConfirmModalData(null);
    }
  };

  const handleCancelRestock = () => {
    setRestockConfirmModalData(null);
  };

  // Void ticket execution: reverses inventory if deducted, marks voided in DB, removes from active queue
  const handleConfirmVoidTicket = async () => {
    if (!voidTargetTicket || isVoidSubmitting) return;
    setIsVoidSubmitting(true);
    const ticketId = voidTargetTicket.id;
    const finalReason =
      selectedVoidReason === "Other"
        ? customVoidReason.trim() || "Other / Unspecified"
        : selectedVoidReason;
    const voidIso = new Date().toISOString();

    try {
      // 1. Reverses inventory deduction if already deducted (or cooking started)
      const hadDeduction = Boolean(
        voidTargetTicket.isDeducted ||
        isCookingStatus(voidTargetTicket.status) ||
        voidTargetTicket.status === "ready" ||
        voidTargetTicket.prep_timer_started_at
      );

      if (hadDeduction) {
        try {
          const { restId } = await getValidTenantContext(user);
          await restockInventoryForOrder(restId, voidTargetTicket.items || []);
          showToast(`📦 Restocked ingredients for voided ticket #${ticketId}`);
        } catch (restockErr) {
          console.warn("[KitchenTerminal] Void restock exception:", restockErr);
        }
      }

      // 2. Optimistically update local tickets (marks voided, removing from active queue)
      const updatedTickets = kdsTickets.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: "voided" as const,
            void_reason: finalReason,
            voidReason: finalReason,
            voided_at: voidIso,
            voidedAt: voidIso,
            isDeducted: false,
          };
        }
        return t;
      });

      setKdsTickets(updatedTickets);
      saveStoredKdsTickets(currentOrgId, updatedTickets);
      showToast(`❌ Ticket #${ticketId} VOIDED (${finalReason}) and removed from active queue`);

      // 3. Persist void status & reason in Supabase
      try {
        const supabase = createClient();
        await safeUpdateKitchenTicket(
          supabase,
          ticketId,
          {
            status: "voided",
            void_reason: finalReason,
            voided_at: voidIso,
          },
          voidTargetTicket || kdsTickets.find((t) => t.id === ticketId),
          restaurantId || currentOrgId
        );
      } catch (sbErr) {
        console.warn("[KitchenTerminal] Supabase void sync error:", sbErr);
      }

      handleCloseVoidModal();
    } catch (err) {
      console.error("[KitchenTerminal] Void ticket error:", err);
      showToast("⚠️ Failed to void ticket. Please retry.");
    } finally {
      setIsVoidSubmitting(false);
    }
  };

  // Thermal KOT Print Preview & Status Tracking State
  const [previewTicket, setPreviewTicket] = useState<KdsTicket | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const handleOpenPrintPreview = (ticket: KdsTicket) => {
    setPreviewTicket(ticket);
    setIsPrintModalOpen(true);
  };

  const handlePrintSuccess = async (
    ticketId: string,
    printedAt: string,
    nextReprintCount: number
  ) => {
    const updatedTickets = kdsTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          printed_at: printedAt,
          reprint_count: nextReprintCount,
        };
      }
      return t;
    });

    setKdsTickets(updatedTickets);
    saveStoredKdsTickets(currentOrgId, updatedTickets);
    showToast(`🖨️ KOT #${ticketId} thermal slip printed successfully!`);

    try {
      const supabase = createClient();
      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        {
          printed_at: printedAt,
          reprint_count: nextReprintCount,
        },
        previewTicket || kdsTickets.find((t) => t.id === ticketId),
        restaurantId || currentOrgId
      );
    } catch (err) {
      console.warn("[KitchenTerminal] Error updating printed_at in Supabase:", err);
    }
  };

  const channelRef = useRef<any>(null);

  const handlePrintFailed = (ticketId: string, error: string) => {
    showToast(`⚠️ KOT #${ticketId} print failed: ${error}. Queued for retry.`);
  };

  const sendKitchenBuzzerAlert = useCallback(
    (alertPayload: Parameters<typeof broadcastKitchenBuzzerAlert>[0]) => {
      const primaryId = String(restaurantId || currentOrgId || "default");
      broadcastKitchenBuzzerAlert({ ...alertPayload, orgId: primaryId });
      if (primaryId !== String(currentOrgId)) {
        broadcastKitchenBuzzerAlert({ ...alertPayload, orgId: String(currentOrgId) });
      }
    },
    [restaurantId, currentOrgId]
  );

  const sendKitchenOrderReady = useCallback(
    (readyPayload: Parameters<typeof broadcastKitchenOrderReady>[0]) => {
      const primaryId = String(restaurantId || currentOrgId || "default");
      broadcastKitchenOrderReady({ ...readyPayload, orgId: primaryId });
      if (primaryId !== String(currentOrgId)) {
        broadcastKitchenOrderReady({ ...readyPayload, orgId: String(currentOrgId) });
      }
    },
    [restaurantId, currentOrgId]
  );

  const sendTakeawayOrderReady = useCallback(
    (payload: Parameters<typeof broadcastTakeawayOrderReady>[0]) => {
      const primaryId = String(restaurantId || currentOrgId || "default");
      broadcastTakeawayOrderReady({ ...payload, orgId: primaryId });
      if (primaryId !== String(currentOrgId)) {
        broadcastTakeawayOrderReady({ ...payload, orgId: String(currentOrgId) });
      }
    },
    [restaurantId, currentOrgId]
  );

  const sendDeliveryOrderReady = useCallback(
    (payload: Parameters<typeof broadcastDeliveryOrderReady>[0]) => {
      const primaryId = String(restaurantId || currentOrgId || "default");
      broadcastDeliveryOrderReady({ ...payload, orgId: primaryId });
      if (primaryId !== String(currentOrgId)) {
        broadcastDeliveryOrderReady({ ...payload, orgId: String(currentOrgId) });
      }
    },
    [restaurantId, currentOrgId]
  );

  // Chef Hand to Waiter Action & Realtime Event Emission with Strict Channel Routing
  const handleHandToWaiter = async (ticketId: string) => {
    const currentTicket = kdsTickets.find((t) => t.id === ticketId);
    if (!currentTicket) return;

    if (isTicketExpired(currentTicket, nowTime)) {
      showToast(`🛑 Ticket #${ticketId} is EXPIRED (4-hour cutoff) - Cannot be handed over.`);
      return;
    }

    const readyIso = new Date().toISOString();

    // 1. Optimistic Update in Kitchen Terminal state
    const updatedTickets = kdsTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: "ready" as const,
          ready_for_pickup_at: readyIso,
        };
      }
      return t;
    });

    setKdsTickets(updatedTickets);
    saveStoredKdsTickets(currentOrgId, updatedTickets);

    const chInfo = getOrderChannelInfo(currentTicket);
    const channel = (chInfo.channel || (currentTicket as any).orderType || (currentTicket as any).order_type || "dine_in").toLowerCase();
    const cleanTicketId = String(currentTicket.ticket_number || currentTicket.id || ticketId);
    const baseKotId = cleanTicketId.replace(/-[A-Z0-9]+$/, "");
    const primaryOrderNumber = currentTicket.ticket_number || cleanTicketId;
    const itemsSummary = (currentTicket.items || [])
      .map((i: any) => `${i.name || i.item?.name || "Dish"} x${i.qty || i.quantity || 1}`)
      .slice(0, 3)
      .join(", ");

    // 2. Strict Channel Scoped Alerts
    if (channel === "takeaway") {
      sendTakeawayOrderReady({
        orgId: String(restaurantId || currentOrgId),
        ticketId: cleanTicketId,
        orderNumber: primaryOrderNumber,
        customerName: currentTicket.customer_name || currentTicket.customerName || undefined,
        customerPhone: currentTicket.customer_phone || currentTicket.customerPhone || undefined,
        itemsSummary,
        items: currentTicket.items || [],
        readyAt: readyIso,
        priority: currentTicket.priority,
        timestamp: Date.now(),
      });
      showToast(`🛍️ Takeaway Order #${primaryOrderNumber} is Ready for Counter Handover! (Alert sent to POS)`);
    } else if (channel === "delivery") {
      sendDeliveryOrderReady({
        orgId: String(restaurantId || currentOrgId),
        ticketId: cleanTicketId,
        orderNumber: primaryOrderNumber,
        customerName: currentTicket.customer_name || currentTicket.customerName || undefined,
        customerPhone: currentTicket.customer_phone || currentTicket.customerPhone || undefined,
        deliveryAddress: currentTicket.delivery_address || currentTicket.deliveryAddress || currentTicket.delivery_area || currentTicket.deliveryArea || "Main Delivery Area",
        deliveryZone: currentTicket.delivery_area || currentTicket.deliveryArea || undefined,
        token: `#${cleanTicketId.slice(-4)}`,
        itemsSummary,
        items: currentTicket.items || [],
        readyAt: readyIso,
        priority: currentTicket.priority,
        timestamp: Date.now(),
      });
      showToast(`🛵 Delivery Order #${primaryOrderNumber} is Ready for Rider Pickup! (Alert sent to Rider Terminal)`);
    } else {
      // Dine-In Table Service -> Alert Handheld Waiter
      sendKitchenOrderReady({
        orgId: String(restaurantId || currentOrgId),
        ticketId: cleanTicketId,
        tableNumber: String(currentTicket.tableOrChannel || "Counter"),
        items: currentTicket.items || [],
        readyAt: readyIso,
        priority: currentTicket.priority,
        isCompleteOrder: true,
      });
      showToast(`🔔 Handed Order #${primaryOrderNumber} to Waiter! Waiter alerted.`);
    }

    // 3. Realtime Broadcast emission to Waiter / Rider terminals
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: channel === "takeaway" ? "takeaway_order_ready" : channel === "delivery" ? "delivery_order_ready" : "order_ready",
          payload: {
            ticket_id: cleanTicketId,
            order_number: primaryOrderNumber,
            table_number: currentTicket.tableOrChannel,
            order_channel: channel,
            customer_name: currentTicket.customer_name || currentTicket.customerName || null,
            customer_phone: currentTicket.customer_phone || currentTicket.customerPhone || null,
            delivery_address: currentTicket.delivery_address || currentTicket.deliveryAddress || null,
            rider_name: currentTicket.rider_name || currentTicket.riderName || null,
            items: currentTicket.items || [],
            ready_for_pickup_at: readyIso,
            priority: currentTicket.priority,
          },
        });
      }
    } catch (bcErr) {
      console.warn("[KitchenTerminal] Broadcast hand to terminal error:", bcErr);
    }

    // 4. Supabase Database Update for kitchen_tickets AND linked orders
    try {
      const supabase = createClient();
      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        {
          status: "ready",
          ready_for_pickup_at: readyIso,
        },
        kdsTickets.find((t) => t.id === ticketId),
        restaurantId || currentOrgId
      );

      // Concurrently update orders table to 'ready'
      let orderQuery: any = supabase
        .from("orders")
        .update({
          order_status: "ready",
          ready_at: readyIso,
          updated_at: readyIso,
        })
        .or(`kot_id.eq.${cleanTicketId},kot_id.eq.${baseKotId},order_number.eq.${cleanTicketId},order_number.eq.${baseKotId}`);
      if (restaurantId) {
        orderQuery = orderQuery.eq("restaurant_id", restaurantId);
      }
      await orderQuery;
    } catch (dbErr) {
      console.warn("[KitchenTerminal] Supabase update ready status error:", dbErr);
    }
  };

  // Sync profile tab from URL search parameters or custom event
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "profile") {
        setActiveTab("profile");
      } else if (tabParam === "stats") {
        setActiveTab("stats");
      }
    }

    const handleKitchenTab = (e: any) => {
      if (e?.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener("kitchen-tab-change", handleKitchenTab);
    return () => window.removeEventListener("kitchen-tab-change", handleKitchenTab);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // 1-second interval for live countdown timers
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger remote audio buzzer chime on Waiter & POS stations (kitchen muted)
  const handleTriggerBuzzer = useCallback(() => {
    setIsBuzzerRinging(true);
    sendKitchenBuzzerAlert({
      orgId: String(restaurantId || currentOrgId),
      title: "Kitchen Service Call",
      message: "🔔 Kitchen pass alert: Chef requests floor staff assistance at pass!",
      timestamp: Date.now(),
    });
    showToast("🔔 Service chime broadcasted to Waiter & POS stations (Kitchen muted)");
    setTimeout(() => setIsBuzzerRinging(false), 1200);
  }, [restaurantId, currentOrgId, sendKitchenBuzzerAlert, showToast]);

  // Fetch live tickets from Supabase and subscribe to realtime changes
  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const fetchTickets = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        if (restId) {
          setRestaurantId(restId);
        }

        const { data, error } = await supabase
          .from("kitchen_tickets")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false });

        if (!error && data && isMounted) {
          const mapped: KdsTicket[] = data.map((t: any) => ({
            id: t.ticket_number || t.id,
            dbId: t.id,
            ticket_number: t.ticket_number || t.id,
            tableOrChannel: t.table_number || t.channel,
            elapsedMinutes: t.prep_timer_started_at
              ? Math.max(0, Math.round((Date.now() - new Date(t.prep_timer_started_at).getTime()) / 60000))
              : (t.elapsed_minutes || 0),
            items: Array.isArray(t.items)
              ? t.items.map((it: any) => ({
                ...it,
                name: it.name || it.item?.name || "Dish",
                qty: Number(it.qty || it.quantity || 1),
              }))
              : [],
            status: t.status,
            items_status: Array.isArray(t.items_status) ? t.items_status : null,
            station_assigned: t.station_assigned || t.station || null,
            station: t.station_assigned || t.station || null,
            serverName: t.server_name || "Front Desk",
            priority: t.priority || "normal",
            priority_reason: t.priority_reason || null,
            printed_at: t.printed_at || null,
            reprint_count: Number(t.reprint_count) || 0,
            ready_for_pickup_at: t.ready_for_pickup_at || null,
            picked_up_at: t.picked_up_at || null,
            completed_at: t.completed_at || null,
            completedAt: t.completed_at || null,
            createdAt: t.created_at
              ? new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Just now",
            created_at: t.created_at || undefined,
            isDeducted: Boolean(t.prep_timer_started_at || t.status === "preparing" || t.status === "ready" || t.status === "completed"),
            prepStartedAt: t.prep_timer_started_at || undefined,
            prep_timer_started_at: t.prep_timer_started_at || undefined,
            estimatedPrepTime: Number(t.estimated_prep_time) || 15,
            estimated_prep_time: Number(t.estimated_prep_time) || 15,
            orderType: t.order_type || t.channel || "dine_in",
            order_type: t.order_type || t.channel || "dine_in",
            customer_name: t.customer_name || t.customerName || null,
            customerName: t.customer_name || t.customerName || null,
            customer_phone: t.customer_phone || t.customerPhone || null,
            customerPhone: t.customer_phone || t.customerPhone || null,
            delivery_address: t.delivery_address || t.deliveryAddress || null,
            deliveryAddress: t.delivery_address || t.deliveryAddress || null,
            delivery_area: t.delivery_area || t.deliveryArea || t.delivery_zone || t.deliveryZone || null,
            deliveryArea: t.delivery_area || t.deliveryArea || t.delivery_zone || t.deliveryZone || null,
            rider_name: t.rider_name || t.riderName || null,
            riderName: t.rider_name || t.riderName || null,
            rider_eta: t.rider_eta != null ? Number(t.rider_eta) : (t.riderEta != null ? Number(t.riderEta) : null),
            rider_delayed: Boolean(t.rider_delayed || t.riderDelayed),
            riderDelayed: Boolean(t.rider_delayed || t.riderDelayed),
            rider_waiting_minutes: t.rider_waiting_minutes != null ? Number(t.rider_waiting_minutes) : null,
            rider_waiting_since: t.rider_waiting_since || null,
            notes: t.notes || t.chef_notes || null,
            chef_notes: t.chef_notes || t.notes || null,
            paused_at: t.paused_at || null,
            pausedAt: t.paused_at || null,
            pause_reason: t.pause_reason || null,
            pauseReason: t.pause_reason || null,
            total_paused_seconds: Number(t.total_paused_seconds) || 0,
            totalPausedSeconds: Number(t.total_paused_seconds) || 0,
            modifications: Array.isArray(t.modifications) ? t.modifications : [],
            void_reason: t.void_reason || null,
            voidReason: t.void_reason || null,
            voided_at: t.voided_at || null,
            voidedAt: t.voided_at || null,
          }));

          setKdsTickets(mapped);
          saveStoredKdsTickets(currentOrgId, mapped);
        } else if (!error && isMounted) {
          setKdsTickets([]);
          saveStoredKdsTickets(currentOrgId, []);
        }

        if (!isMounted) return;

        // Clean up any existing channel reference before resubscribing
        if (channelRef.current) {
          try {
            channelRef.current.unsubscribe();
            supabase.removeChannel(channelRef.current);
          } catch {}
          channelRef.current = null;
        }

        // Realtime Subscription with proper callback ordering
        const subId = Math.random().toString(36).substring(2, 8);
        const channelName = `kitchen_realtime_${restId}_${subId}`;

        // Ensure all .on() event listeners are chained and added BEFORE calling .subscribe()
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "kitchen_tickets",
              filter: `restaurant_id=eq.${restId}`,
            },
            (payload: any) => {
              if (!isMounted) return;
              if (payload.eventType === "INSERT") {
                const newRow: any = payload.new;
                const newT: KdsTicket = {
                  id: newRow.ticket_number || newRow.id,
                  dbId: newRow.id,
                  ticket_number: newRow.ticket_number || newRow.id,
                  tableOrChannel: newRow.table_number || newRow.channel,
                  elapsedMinutes: 0,
                  items: Array.isArray(newRow.items)
                    ? newRow.items.map((it: any) => ({
                      ...it,
                      name: it.name || it.item?.name || "Dish",
                      qty: Number(it.qty || it.quantity || 1),
                    }))
                    : [],
                  status: newRow.status,
                  items_status: Array.isArray(newRow.items_status) ? newRow.items_status : null,
                  station_assigned: newRow.station_assigned || newRow.station || null,
                  station: newRow.station_assigned || newRow.station || null,
                  serverName: newRow.server_name || "Front Desk",
                  priority: newRow.priority || "normal",
                  priority_reason: newRow.priority_reason || null,
                  printed_at: newRow.printed_at || null,
                  reprint_count: Number(newRow.reprint_count) || 0,
                  ready_for_pickup_at: newRow.ready_for_pickup_at || null,
                  picked_up_at: newRow.picked_up_at || null,
                  completed_at: newRow.completed_at || null,
                  completedAt: newRow.completed_at || null,
                  createdAt: newRow.created_at
                    ? new Date(newRow.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Just now",
                  created_at: newRow.created_at || undefined,
                  prepStartedAt: newRow.prep_timer_started_at || undefined,
                  prep_timer_started_at: newRow.prep_timer_started_at || undefined,
                  estimatedPrepTime: Number(newRow.estimated_prep_time) || 15,
                  estimated_prep_time: Number(newRow.estimated_prep_time) || 15,
                  orderType: newRow.order_type || newRow.channel || "dine_in",
                  order_type: newRow.order_type || newRow.channel || "dine_in",
                  customer_name: newRow.customer_name || newRow.customerName || null,
                  customerName: newRow.customer_name || newRow.customerName || null,
                  customer_phone: newRow.customer_phone || newRow.customerPhone || null,
                  customerPhone: newRow.customer_phone || newRow.customerPhone || null,
                  delivery_address: newRow.delivery_address || newRow.deliveryAddress || null,
                  deliveryAddress: newRow.delivery_address || newRow.deliveryAddress || null,
                  delivery_area: newRow.delivery_area || newRow.deliveryArea || newRow.delivery_zone || newRow.deliveryZone || null,
                  deliveryArea: newRow.delivery_area || newRow.deliveryArea || newRow.delivery_zone || newRow.deliveryZone || null,
                  rider_name: newRow.rider_name || newRow.riderName || null,
                  riderName: newRow.rider_name || newRow.riderName || null,
                  rider_eta: newRow.rider_eta != null ? Number(newRow.rider_eta) : (newRow.riderEta != null ? Number(newRow.riderEta) : null),
                  riderEta: newRow.rider_eta != null ? Number(newRow.rider_eta) : (newRow.riderEta != null ? Number(newRow.riderEta) : null),
                  rider_delayed: Boolean(newRow.rider_delayed || newRow.riderDelayed),
                  riderDelayed: Boolean(newRow.rider_delayed || newRow.riderDelayed),
                  rider_waiting_minutes: newRow.rider_waiting_minutes != null ? Number(newRow.rider_waiting_minutes) : null,
                  rider_waiting_since: newRow.rider_waiting_since || null,
                  notes: newRow.notes || newRow.chef_notes || null,
                  chef_notes: newRow.chef_notes || newRow.notes || null,
                  paused_at: newRow.paused_at || null,
                  pausedAt: newRow.paused_at || null,
                  pause_reason: newRow.pause_reason || null,
                  pauseReason: newRow.pause_reason || null,
                  total_paused_seconds: Number(newRow.total_paused_seconds) || 0,
                  totalPausedSeconds: Number(newRow.total_paused_seconds) || 0,
                  modifications: Array.isArray(newRow.modifications) ? newRow.modifications : [],
                  void_reason: newRow.void_reason || null,
                  voidReason: newRow.void_reason || null,
                  voided_at: newRow.voided_at || null,
                  voidedAt: newRow.voided_at || null,
                };
                const rawPri = (newRow.priority || "normal").toLowerCase();
                const isRushOrder = rawPri === "rush" || rawPri === "urgent";

                setKdsTickets((prev) => {
                  const updated = [newT, ...prev.filter((t) => t.id !== newT.id)];
                  saveStoredKdsTickets(currentOrgId, updated);
                  return updated;
                });
                if (isRushOrder) {
                  showToast(`🚨 URGENT RUSH TICKET: #${newT.id}! (Urgent Tone)`);
                } else {
                  showToast(`New Kitchen Ticket: ${newT.id}`);
                }
              } else if (payload.eventType === "UPDATE") {
                const uRow: any = payload.new;
                const targetTicketId = uRow.ticket_number || uRow.id;
                const isRushNow =
                  (uRow.priority || "").toLowerCase() === "rush" ||
                  (uRow.priority || "").toLowerCase() === "urgent";

                let detectedDiffs: KitchenTicketModification[] = [];
                let removedForRestock: { name: string; qty: number }[] = [];

                setKdsTickets((prev) => {
                  const prevTicket = prev.find(
                    (t) =>
                      t.id === targetTicketId ||
                      (t.dbId && t.dbId === uRow.id) ||
                      (t.ticket_number && t.ticket_number === uRow.ticket_number)
                  );
                  const wasRushBefore =
                    (prevTicket?.priority || "").toLowerCase() === "rush" ||
                    (prevTicket?.priority || "").toLowerCase() === "urgent";

                  if (isRushNow && !wasRushBefore) {
                    showToast(`🚨 Ticket #${targetTicketId} escalated to RUSH!`);
                  }

                  // 📝 Detect modification diff if changed items arrive
                  if (prevTicket && Array.isArray(uRow.items)) {
                    detectedDiffs = detectTicketModifications(
                      prevTicket.items || [],
                      uRow.items,
                      uRow.modified_by || user?.name || "Server"
                    );

                    if (detectedDiffs.length > 0) {
                      const cookingStarted = Boolean(
                        prevTicket.isDeducted ||
                        isCookingStatus(prevTicket.status) ||
                        prevTicket.status === "ready" ||
                        prevTicket.prep_timer_started_at
                      );

                      if (cookingStarted) {
                        detectedDiffs.forEach((d) => {
                          if (d.type === "removed") {
                            removedForRestock.push({
                              name: d.item_name,
                              qty: Math.abs(d.qty || 1),
                            });
                          } else if (d.type === "qty_changed" && (d.qty || 0) < 0) {
                            removedForRestock.push({
                              name: d.item_name,
                              qty: Math.abs(d.qty || 1),
                            });
                          }
                        });
                      }
                    }
                  }

                  const nextList = prev.map((t) => {
                    if (
                      t.id === targetTicketId ||
                      (t.dbId && t.dbId === uRow.id) ||
                      (t.ticket_number && t.ticket_number === uRow.ticket_number)
                    ) {
                      let updatedMods: KitchenTicketModification[] = Array.isArray(uRow.modifications)
                        ? uRow.modifications
                        : Array.isArray(t.modifications)
                          ? [...t.modifications]
                          : [];

                      if (detectedDiffs.length > 0) {
                        updatedMods = [...updatedMods, ...detectedDiffs];
                      }

                      return {
                        ...t,
                        dbId: uRow.id || t.dbId,
                        ticket_number: uRow.ticket_number || t.ticket_number,
                        status: uRow.status,
                        items: Array.isArray(uRow.items)
                          ? uRow.items.map((it: any) => ({
                            ...it,
                            name: it.name || it.item?.name || "Dish",
                            qty: Number(it.qty || it.quantity || 1),
                          }))
                          : t.items,
                        modifications: updatedMods,
                        void_reason: uRow.void_reason !== undefined ? uRow.void_reason : t.void_reason,
                        voidReason: uRow.void_reason !== undefined ? uRow.void_reason : t.voidReason,
                        voided_at: uRow.voided_at !== undefined ? uRow.voided_at : t.voided_at,
                        voidedAt: uRow.voided_at !== undefined ? uRow.voided_at : t.voidedAt,
                        priority: uRow.priority !== undefined ? uRow.priority : t.priority,
                        priority_reason:
                          uRow.priority_reason !== undefined
                            ? uRow.priority_reason
                            : t.priority_reason,
                        items_status: Array.isArray(uRow.items_status)
                          ? uRow.items_status
                          : t.items_status,
                        station_assigned:
                          uRow.station_assigned !== undefined
                            ? uRow.station_assigned
                            : t.station_assigned,
                        station:
                          uRow.station_assigned !== undefined
                            ? uRow.station_assigned
                            : t.station,
                        printed_at:
                          uRow.printed_at !== undefined
                            ? uRow.printed_at
                            : t.printed_at,
                        reprint_count:
                          uRow.reprint_count !== undefined
                            ? Number(uRow.reprint_count)
                            : t.reprint_count,
                        ready_for_pickup_at:
                          uRow.ready_for_pickup_at !== undefined
                            ? uRow.ready_for_pickup_at
                            : t.ready_for_pickup_at,
                        picked_up_at:
                          uRow.picked_up_at !== undefined
                            ? uRow.picked_up_at
                            : t.picked_up_at,
                        completed_at:
                          uRow.completed_at !== undefined
                            ? uRow.completed_at
                            : t.completed_at,
                        completedAt:
                          uRow.completed_at !== undefined
                            ? uRow.completed_at
                            : t.completedAt,
                        prepStartedAt: uRow.prep_timer_started_at || t.prepStartedAt,
                        prep_timer_started_at:
                          uRow.prep_timer_started_at || t.prep_timer_started_at,
                        estimatedPrepTime:
                          Number(uRow.estimated_prep_time) || t.estimatedPrepTime,
                        orderType: uRow.order_type || uRow.channel || t.orderType,
                        order_type: uRow.order_type || uRow.channel || t.order_type,
                        customer_name: uRow.customer_name !== undefined ? uRow.customer_name : t.customer_name,
                        customerName: uRow.customer_name !== undefined ? uRow.customer_name : t.customerName,
                        customer_phone: uRow.customer_phone !== undefined ? uRow.customer_phone : t.customer_phone,
                        customerPhone: uRow.customer_phone !== undefined ? uRow.customer_phone : t.customerPhone,
                        delivery_address: uRow.delivery_address !== undefined ? uRow.delivery_address : t.delivery_address,
                        deliveryAddress: uRow.delivery_address !== undefined ? uRow.delivery_address : t.deliveryAddress,
                        delivery_area: uRow.delivery_area !== undefined ? uRow.delivery_area : t.delivery_area,
                        deliveryArea: uRow.delivery_area !== undefined ? uRow.delivery_area : t.deliveryArea,
                        rider_name: uRow.rider_name !== undefined ? uRow.rider_name : t.rider_name,
                        riderName: uRow.rider_name !== undefined ? uRow.rider_name : t.riderName,
                        rider_eta: uRow.rider_eta !== undefined ? Number(uRow.rider_eta) : t.rider_eta,
                        riderEta: uRow.rider_eta !== undefined ? Number(uRow.rider_eta) : t.riderEta,
                        rider_delayed: uRow.rider_delayed !== undefined ? Boolean(uRow.rider_delayed) : t.rider_delayed,
                        riderDelayed: uRow.rider_delayed !== undefined ? Boolean(uRow.rider_delayed) : t.riderDelayed,
                        rider_waiting_minutes: uRow.rider_waiting_minutes !== undefined ? Number(uRow.rider_waiting_minutes) : t.rider_waiting_minutes,
                        rider_waiting_since: uRow.rider_waiting_since !== undefined ? uRow.rider_waiting_since : t.rider_waiting_since,
                        notes: uRow.notes !== undefined ? uRow.notes : t.notes,
                        chef_notes: uRow.chef_notes !== undefined ? uRow.chef_notes : t.chef_notes,
                        paused_at: uRow.paused_at !== undefined ? uRow.paused_at : t.paused_at,
                        pausedAt: uRow.paused_at !== undefined ? uRow.paused_at : t.pausedAt,
                        pause_reason: uRow.pause_reason !== undefined ? uRow.pause_reason : t.pause_reason,
                        pauseReason: uRow.pause_reason !== undefined ? uRow.pause_reason : t.pauseReason,
                        total_paused_seconds: uRow.total_paused_seconds !== undefined ? Number(uRow.total_paused_seconds) : t.total_paused_seconds,
                        totalPausedSeconds: uRow.total_paused_seconds !== undefined ? Number(uRow.total_paused_seconds) : t.totalPausedSeconds,
                      };
                    }
                    return t;
                  });
                  saveStoredKdsTickets(currentOrgId, nextList);
                  return nextList;
                });

                // Play short notification chime and notify user when modifications arrive
                if (detectedDiffs.length > 0) {
                  playModificationChime();
                  const summary = detectedDiffs
                    .map((d) => `${d.qty != null ? `${Math.abs(d.qty)}x ` : ""}${d.item_name} ${d.type}`)
                    .join(", ");
                  showToast(`📝 Order #${targetTicketId} MODIFIED: ${summary}`);

                  // If items were removed after cooking started, show confirm dialog: "Item removed — restock ingredients?"
                  if (removedForRestock.length > 0) {
                    setRestockConfirmModalData({
                      isOpen: true,
                      ticketId: targetTicketId,
                      removedItems: removedForRestock,
                    });
                  }
                }
              } else if (payload.eventType === "DELETE") {
                const oldRow: any = payload.old;
                const delId = oldRow?.ticket_number || oldRow?.id;
                if (delId) {
                  setKdsTickets((prev) => {
                    const nextList = prev.filter((t) => t.id !== delId);
                    saveStoredKdsTickets(currentOrgId, nextList);
                    return nextList;
                  });
                }
              }
            }
          )
          .subscribe((status: string, err?: any) => {
            console.log(`[Kitchen Realtime ${restId}] Channel status: ${status}`, err || "");
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              if (isMounted) {
                console.warn(`[Kitchen Realtime ${restId}] Disconnected (${status}). Auto-reconnecting...`);
                setTimeout(() => {
                  if (isMounted) fetchTickets();
                }, 1500);
              }
            }
          });

        unsubBus = subscribeTerminalEventBus(restId, (payload) => {
          if (!isMounted) return;
          console.log("[KitchenTerminal] Terminal bus mutation:", payload);
          if (payload.type === "ORDER_VOIDED") {
            const vId = payload.ticketId || payload.orderId;
            if (vId) {
              setKdsTickets((prev) =>
                prev.map((t) =>
                  t.id === vId || t.ticket_number === vId || (t.ticket_number && String(t.ticket_number).includes(String(vId)))
                    ? { ...t, status: "voided", void_reason: payload.reason || "Cancelled by Admin" }
                    : t
                )
              );
            }
            fetchTickets();
          } else if (payload.type === "TICKET_MUTATION" || payload.type === "ORDER_MUTATION") {
            fetchTickets();
          }
        });

        channelRef.current = channel;
      } catch (err) {
        console.warn("[KitchenTerminal] Supabase connection error:", err);
      }
    };

    let unsubBus: (() => void) | null = null;
    fetchTickets();

    // Cross-tab Local Storage Listener (Instant sync with POS checkouts on same device)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && !e.key.includes("kds")) return;
      const stored = getStoredKdsTickets(currentOrgId, []);
      if (Array.isArray(stored)) {
        const valid = stored.filter(
          (t) =>
            t &&
            t.id &&
            !["1024", "1025", "1026", "1027", "#1024", "#1025", "#1026", "#1027", "mock", "dummy"].some((m) =>
              String(t.id).toLowerCase().includes(m)
            )
        );
        setKdsTickets(valid);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      isMounted = false;
      if (unsubBus) {
        try { unsubBus(); } catch {}
      }
      if (channel) {
        try {
          channel.unsubscribe();
          const supabaseClient = createClient();
          supabaseClient.removeChannel(channel);
        } catch (err) {
          console.warn("[KitchenTerminal] Channel cleanup error:", err);
        }
      }
      channelRef.current = null;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user, currentOrgId, showToast]);

  const advancingTicketsRef = useRef<Set<string>>(new Set());

  // Advance ticket status and trigger delivery-linked stock deduction
  const handleAdvanceTicket = async (ticketId: string, targetStatus?: KdsTicket["status"]) => {
    if (advancingTicketsRef.current.has(ticketId)) return;
    const currentTicket = kdsTickets.find((t) => t.id === ticketId);
    if (!currentTicket) return;

    // Voided orders are permanently cancelled and can NEVER be reopened or advanced by chef
    if (isVoidedStatus(currentTicket.status)) {
      showToast(`❌ Ticket #${ticketId} is VOIDED - Reopening or advancing voided orders is prohibited.`);
      return;
    }

    const createdMs = getOrderCreationEpochMs(currentTicket);
    const isExceededCutoff = createdMs ? (nowTime - createdMs >= ORDER_EXPIRY_CUTOFF_MS) : false;
    const isOrderCutoffExpired = isExceededCutoff || isTicketExpired(currentTicket, nowTime) || Boolean((currentTicket as any).was_expired);

    // If order exceeded the 4-hour cutoff, starting cooking or reopening is permanently disabled (only archiving allowed)
    if (isOrderCutoffExpired) {
      if (targetStatus !== "archived") {
        showToast(`🛑 Ticket #${ticketId} is EXPIRED (4-hour cutoff) - Cannot start cooking or reopen.`);
        return;
      }
    }

    // If order was completed, it can ONLY be reopened within 2 hours of completion
    if (isCompletedStatus(currentTicket.status) && (targetStatus === "preparing" || !targetStatus)) {
      const completedTime = currentTicket.completed_at || currentTicket.completedAt || (currentTicket as any).updated_at || (currentTicket as any).updatedAt;
      const completedMs = completedTime ? new Date(completedTime).getTime() : null;
      const completedAgeMs = completedMs && !isNaN(completedMs) ? Math.max(0, nowTime - completedMs) : (createdMs ? Math.max(0, nowTime - createdMs) : 0);
      const isPast2Hours = completedAgeMs > 2 * 60 * 60 * 1000;

      if (isOrderCutoffExpired) {
        showToast(`🛑 Ticket #${ticketId} was EXPIRED - Reopening is permanently disabled.`);
        return;
      }
      if (isPast2Hours) {
        showToast(`🔒 Ticket #${ticketId} was completed over 2 hours ago - Reopening window has expired.`);
        return;
      }
    }

    advancingTicketsRef.current.add(ticketId);
    try {
      let nextStatus: KdsTicket["status"] = "preparing";
      if (targetStatus) {
        nextStatus = targetStatus;
      } else {
        if (currentTicket.status === "queued") nextStatus = "preparing";
        else if (currentTicket.status === "preparing") nextStatus = "ready";
        else if (currentTicket.status === "ready") nextStatus = "completed";
        else nextStatus = "preparing";
      }

      const isStartingCooking = nextStatus === "preparing" && currentTicket.status !== "preparing";
      const isFulfillment = (nextStatus === "completed" || nextStatus === "archived") && currentTicket.status !== "completed" && currentTicket.status !== "archived";
      const prepTimestamp = new Date().toISOString();

      // Synchronize item status records with ticket advance
      const currentItems = getTicketItemsStatus(currentTicket);
      const syncedItems = currentItems.map((it) => ({
        ...it,
        status: nextStatus === "ready" || nextStatus === "completed" || nextStatus === "archived"
          ? ("ready" as const)
          : nextStatus === "preparing"
            ? (it.status === "waiting" ? ("cooking" as const) : it.status)
            : it.status,
        completed_at: nextStatus === "ready" || nextStatus === "completed" || nextStatus === "archived" ? (it.completed_at || prepTimestamp) : it.completed_at,
        started_at: nextStatus === "preparing" ? (it.started_at || prepTimestamp) : it.started_at,
      }));

      const readyTimestamp = new Date().toISOString();

      // 1. Optimistic Update
      const updatedTickets = kdsTickets.map((t) => {
        if (t.id === ticketId) {
          const wasExpired = Boolean(isOrderCutoffExpired || (t as any).was_expired);
          return {
            ...t,
            status: nextStatus,
            was_expired: wasExpired,
            ...(nextStatus === "archived" || nextStatus === "completed" ? { isExpired: false, is_expired: false } : {}),
            ready_for_pickup_at: nextStatus === "ready" ? (t.ready_for_pickup_at || readyTimestamp) : t.ready_for_pickup_at,
            prepStartedAt: isStartingCooking ? (t.prepStartedAt || prepTimestamp) : t.prepStartedAt,
            prep_timer_started_at: isStartingCooking ? (t.prep_timer_started_at || prepTimestamp) : t.prep_timer_started_at,
            isDeducted: isFulfillment ? true : t.isDeducted,
            items_status: syncedItems,
            completed_at: (nextStatus === "completed" || nextStatus === "archived") ? (t.completed_at || prepTimestamp) : t.completed_at,
            completedAt: (nextStatus === "completed" || nextStatus === "archived") ? (t.completedAt || prepTimestamp) : t.completedAt,
          };
        }
        return t;
      });

      setKdsTickets(updatedTickets);
      saveStoredKdsTickets(currentOrgId, updatedTickets);

      if (nextStatus === "archived") {
        showToast(`📦 Ticket #${ticketId} archived and moved from active queue.`);
      } else if (nextStatus === "ready") {
        const chInfo = getOrderChannelInfo(currentTicket);
        const channel = (chInfo.channel || (currentTicket as any).orderType || (currentTicket as any).order_type || "dine_in").toLowerCase();
        const cleanTicketId = String(currentTicket.ticket_number || currentTicket.id || ticketId);
        const baseKotId = cleanTicketId.replace(/-[A-Z0-9]+$/, "");
        const primaryOrderNumber = currentTicket.ticket_number || cleanTicketId;
        const itemsSummary = (currentTicket.items || [])
          .map((i: any) => `${i.name || i.item?.name || "Dish"} x${i.qty || i.quantity || 1}`)
          .slice(0, 3)
          .join(", ");

        if (channel === "takeaway") {
          sendTakeawayOrderReady({
            orgId: String(restaurantId || currentOrgId),
            ticketId: cleanTicketId,
            orderNumber: primaryOrderNumber,
            customerName: currentTicket.customer_name || currentTicket.customerName || undefined,
            customerPhone: currentTicket.customer_phone || currentTicket.customerPhone || undefined,
            itemsSummary,
            items: currentTicket.items || [],
            readyAt: readyTimestamp,
            priority: currentTicket.priority,
            timestamp: Date.now(),
          });
          showToast(`🛍️ Takeaway Order #${primaryOrderNumber} is Ready for Counter Handover! (Alert sent to POS)`);
        } else if (channel === "delivery") {
          sendDeliveryOrderReady({
            orgId: String(restaurantId || currentOrgId),
            ticketId: cleanTicketId,
            orderNumber: primaryOrderNumber,
            customerName: currentTicket.customer_name || currentTicket.customerName || undefined,
            customerPhone: currentTicket.customer_phone || currentTicket.customerPhone || undefined,
            deliveryAddress: currentTicket.delivery_address || currentTicket.deliveryAddress || currentTicket.delivery_area || currentTicket.deliveryArea || "Main Delivery Area",
            deliveryZone: currentTicket.delivery_area || currentTicket.deliveryArea || undefined,
            token: `#${cleanTicketId.slice(-4)}`,
            itemsSummary,
            items: currentTicket.items || [],
            readyAt: readyTimestamp,
            priority: currentTicket.priority,
            timestamp: Date.now(),
          });
          showToast(`🛵 Delivery Order #${primaryOrderNumber} is Ready for Rider Pickup! (Alert sent to Rider Terminal)`);
        } else {
          // Dine-In Table Service -> Alert Handheld Waiter
          sendKitchenOrderReady({
            orgId: String(restaurantId || currentOrgId),
            ticketId: cleanTicketId,
            tableNumber: String(currentTicket.tableOrChannel || "Counter"),
            items: currentTicket.items || [],
            readyAt: readyTimestamp,
            priority: currentTicket.priority,
            isCompleteOrder: true,
          });
          showToast(`🔔 Handed Order #${primaryOrderNumber} to Waiter! Waiter alerted.`);
        }
      } else {
        showToast(`Ticket #${ticketId} status updated to ${nextStatus.toUpperCase()}`);
      }

      // 2. Kitchen completion/fulfillment: Inventory was already exact-once deducted upon KOT placement.
      // Transitioning status in KDS must never trigger duplicate inventory deduction.

      // 3. Supabase Sync
      try {
        const supabase = createClient();
        const updatePayload: any = { 
          status: nextStatus, 
          items_status: syncedItems,
        };
        if (isStartingCooking) updatePayload.prep_timer_started_at = prepTimestamp;
        if (nextStatus === "ready") updatePayload.ready_for_pickup_at = readyTimestamp;
        if (nextStatus === "completed" || nextStatus === "archived") updatePayload.completed_at = new Date().toISOString();

        await safeUpdateKitchenTicket(
          supabase,
          ticketId,
          updatePayload,
          currentTicket,
          restaurantId || currentOrgId
        );

        if (nextStatus === "archived" || nextStatus === "completed") {
          const cleanTicketId = String(currentTicket.ticket_number || currentTicket.id || ticketId);
          const baseKotId = cleanTicketId.replace(/-[A-Z0-9]+$/, "");
          const isDineIn = Boolean(
            currentTicket.tableOrChannel &&
            currentTicket.tableOrChannel !== "Counter" &&
            !currentTicket.tableOrChannel.toLowerCase().includes("takeaway") &&
            !currentTicket.tableOrChannel.toLowerCase().includes("delivery")
          );

          // For Dine-In, kitchen completion marks food prepared/served, but order stays active until payment is settled at POS!
          let orderUpdate: any = supabase
            .from("orders")
            .update({
              order_status: isDineIn ? "active" : "completed",
              updated_at: new Date().toISOString(),
            })
            .or(`kot_id.eq.${cleanTicketId},kot_id.eq.${baseKotId},order_number.eq.${cleanTicketId},order_number.eq.${baseKotId}`);
          if (restaurantId || currentOrgId) {
            orderUpdate = orderUpdate.eq("restaurant_id", restaurantId || currentOrgId);
          }
          await orderUpdate;

          // NOTE: Dine-in tables must NEVER be freed by kitchen completion!
          // Tables remain occupied until payment settlement at POS counter.
        }

        if (nextStatus === "ready") {
          const chInfo = getOrderChannelInfo(currentTicket);
          const channel = (chInfo.channel || (currentTicket as any).orderType || (currentTicket as any).order_type || "dine_in").toLowerCase();
          const cleanTicketId = String(currentTicket.ticket_number || currentTicket.id || ticketId);
          const baseKotId = cleanTicketId.replace(/-[A-Z0-9]+$/, "");

          // Concurrently update orders table to 'ready'
          let orderQuery: any = supabase
            .from("orders")
            .update({
              order_status: "ready",
              ready_at: readyTimestamp,
              updated_at: readyTimestamp,
            })
            .or(`kot_id.eq.${cleanTicketId},kot_id.eq.${baseKotId},order_number.eq.${cleanTicketId},order_number.eq.${baseKotId}`);
          if (restaurantId) {
            orderQuery = orderQuery.eq("restaurant_id", restaurantId);
          }
          await orderQuery;

          if (channelRef.current) {
            channelRef.current.send({
              type: "broadcast",
              event: channel === "takeaway" ? "takeaway_order_ready" : channel === "delivery" ? "delivery_order_ready" : "order_ready",
              payload: {
                ticket_id: cleanTicketId,
                order_number: currentTicket.ticket_number || cleanTicketId,
                table_number: currentTicket.tableOrChannel || "Counter",
                order_channel: channel,
                customer_name: currentTicket.customer_name || currentTicket.customerName || null,
                customer_phone: currentTicket.customer_phone || currentTicket.customerPhone || null,
                delivery_address: currentTicket.delivery_address || currentTicket.deliveryAddress || null,
                items: currentTicket.items || [],
                ready_for_pickup_at: readyTimestamp,
                priority: currentTicket.priority,
              },
            });
          }
        }
      } catch (syncErr) {
        console.warn("[KitchenTerminal] Error updating ticket in Supabase:", syncErr);
      }
    } finally {
      setTimeout(() => {
        advancingTicketsRef.current.delete(ticketId);
      }, 800);
    }
  };

  // Pause cooking ticket with structured reason
  const handlePauseTicket = async (ticketId: string, reason: string) => {
    const currentTicket = kdsTickets.find((t) => t.id === ticketId);
    if (!currentTicket) return;

    const pauseTimestamp = new Date().toISOString();

    const updatedTickets = kdsTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: "paused" as const,
          paused_at: pauseTimestamp,
          pausedAt: pauseTimestamp,
          pause_reason: reason,
          pauseReason: reason,
        };
      }
      return t;
    });

    setKdsTickets(updatedTickets);
    saveStoredKdsTickets(currentOrgId, updatedTickets);
    handleClosePauseModal();
    showToast(`⏸️ Order #${ticketId} paused: ${reason}`);

    try {
      const supabase = createClient();
      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        {
          status: "paused",
          paused_at: pauseTimestamp,
          pause_reason: reason,
        },
        currentTicket,
        restaurantId || currentOrgId
      );
    } catch (syncErr) {
      console.warn("[KitchenTerminal] Error pausing ticket in Supabase:", syncErr);
    }
  };

  // Resume cooking ticket and adjust timers to exclude paused duration
  const handleResumeTicket = async (ticketId: string) => {
    const currentTicket = kdsTickets.find((t) => t.id === ticketId);
    if (!currentTicket) return;

    const nowMs = Date.now();
    const pausedAtMs = currentTicket.paused_at || currentTicket.pausedAt
      ? new Date(currentTicket.paused_at || currentTicket.pausedAt!).getTime()
      : nowMs;
    const currentPauseSec = Math.max(0, Math.floor((nowMs - pausedAtMs) / 1000));
    const updatedTotalPausedSec =
      (currentTicket.total_paused_seconds || currentTicket.totalPausedSeconds || 0) +
      currentPauseSec;

    // Shift prep_timer_started_at forward by currentPauseSec to account for paused time
    const currentStartMs =
      currentTicket.prep_timer_started_at || currentTicket.prepStartedAt
        ? new Date(currentTicket.prep_timer_started_at || currentTicket.prepStartedAt!).getTime()
        : nowMs;
    const adjustedStartIso = new Date(currentStartMs + currentPauseSec * 1000).toISOString();

    const updatedTickets = kdsTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: "preparing" as const,
          paused_at: null,
          pausedAt: null,
          pause_reason: null,
          pauseReason: null,
          total_paused_seconds: updatedTotalPausedSec,
          totalPausedSeconds: updatedTotalPausedSec,
          prep_timer_started_at: adjustedStartIso,
          prepStartedAt: adjustedStartIso,
        };
      }
      return t;
    });

    setKdsTickets(updatedTickets);
    saveStoredKdsTickets(currentOrgId, updatedTickets);
    showToast(`▶️ Order #${ticketId} cooking resumed!`);

    try {
      const supabase = createClient();
      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        {
          status: "preparing",
          paused_at: null,
          pause_reason: null,
          total_paused_seconds: updatedTotalPausedSec,
          prep_timer_started_at: adjustedStartIso,
        },
        currentTicket,
        restaurantId || currentOrgId
      );
    } catch (syncErr) {
      console.warn("[KitchenTerminal] Error resuming ticket in Supabase:", syncErr);
    }
  };

  // Item-level Status Advance & Real-time Sync (waiting -> cooking -> ready)
  const handleUpdateItemStatus = async (
    ticketId: string,
    itemId: string,
    targetStatus?: KdsDishStatus
  ) => {
    const currentTicket = kdsTickets.find((t) => t.id === ticketId);
    if (!currentTicket) return;

    const createdMs = getOrderCreationEpochMs(currentTicket);
    const isExceededCutoff = createdMs ? (nowTime - createdMs >= ORDER_EXPIRY_CUTOFF_MS) : false;
    const isOrderCutoffExpired = isExceededCutoff || isTicketExpired(currentTicket, nowTime) || Boolean((currentTicket as any).was_expired);

    if (isCompletedStatus(currentTicket.status) || isOrderCutoffExpired) {
      if (isCompletedStatus(currentTicket.status)) {
        showToast(`🔒 Order #${ticketId} is already completed - Items cannot be modified.`);
      } else {
        showToast(`🛑 Ticket #${ticketId} is EXPIRED (4-hour cutoff) - Cannot be cooked or modified.`);
      }
      return;
    }

    const currentItemsStatus = getTicketItemsStatus(currentTicket);
    const nowIso = new Date().toISOString();

    const updatedItemsStatus: KdsItemStatusRecord[] = currentItemsStatus.map((item) => {
      if (item.item_id !== itemId) return item;

      let next: KdsDishStatus = "cooking";
      if (targetStatus) {
        next = targetStatus;
      } else {
        if (item.status === "waiting") next = "cooking";
        else if (item.status === "cooking") next = "ready";
        else if (item.status === "ready") next = "waiting";
      }

      return {
        ...item,
        status: next,
        started_at: next === "cooking" ? (item.started_at || nowIso) : (next === "waiting" ? null : item.started_at),
        completed_at: next === "ready" ? nowIso : null,
      };
    });

    const targetItem = updatedItemsStatus.find((it) => it.item_id === itemId);
    const allItemsReady = updatedItemsStatus.length > 0 && updatedItemsStatus.every((it) => it.status === "ready");

    // If starting any dish and ticket was queued, also start ticket cooking
    const shouldStartCooking =
      currentTicket.status === "queued" &&
      updatedItemsStatus.some((it) => it.status === "cooking" || it.status === "ready");

    const updatedTickets = kdsTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: allItemsReady ? ("ready" as const) : shouldStartCooking ? ("preparing" as const) : t.status,
          ready_for_pickup_at: allItemsReady ? (t.ready_for_pickup_at || nowIso) : t.ready_for_pickup_at,
          prepStartedAt: shouldStartCooking ? (t.prepStartedAt || nowIso) : t.prepStartedAt,
          prep_timer_started_at: shouldStartCooking ? (t.prep_timer_started_at || nowIso) : t.prep_timer_started_at,
          items_status: updatedItemsStatus,
        };
      }
      return t;
    });

    setKdsTickets(updatedTickets);
    saveStoredKdsTickets(currentOrgId, updatedTickets);

    if (targetItem?.status === "ready") {
      if (allItemsReady) {
        sendKitchenOrderReady({
          orgId: String(restaurantId || currentOrgId),
          ticketId,
          tableNumber: String(currentTicket.tableOrChannel || "Counter"),
          items: currentTicket.items || [],
          readyAt: nowIso,
          priority: currentTicket.priority,
          itemName: targetItem.name,
          isCompleteOrder: true,
        });
        showToast(`All dishes ready for #${ticketId}! (Alert sent to Waiter Terminal)`);
      } else {
        sendKitchenOrderReady({
          orgId: String(restaurantId || currentOrgId),
          ticketId,
          tableNumber: String(currentTicket.tableOrChannel || "Counter"),
          items: [{ name: targetItem.name, qty: 1 }],
          readyAt: nowIso,
          priority: currentTicket.priority,
          itemName: targetItem.name,
          isCompleteOrder: false,
        });
        showToast(`"${targetItem.name}" marked READY (Waiter notified)`);
      }
    } else if (targetItem?.status === "cooking") {
      showToast(`"${targetItem.name}" is now COOKING`);
    } else {
      showToast(`"${targetItem?.name}" reset to WAITING`);
    }

    // Deferred inventory deduction: Stock is NOT deducted on cooking start, only upon final fulfillment/delivery

    // Supabase Realtime Sync
    try {
      const supabase = createClient();
      const updatePayload: any = {
        items_status: updatedItemsStatus,
      };
      if (allItemsReady) {
        updatePayload.status = "ready";
        updatePayload.ready_for_pickup_at = nowIso;
      } else if (shouldStartCooking) {
        updatePayload.status = "preparing";
        updatePayload.prep_timer_started_at = nowIso;
      }

      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        updatePayload,
        currentTicket,
        restaurantId || currentOrgId
      );

      if (channelRef.current && (allItemsReady || targetItem?.status === "ready")) {
        channelRef.current.send({
          type: "broadcast",
          event: "order_ready",
          payload: {
            ticket_id: ticketId,
            table_number: currentTicket.tableOrChannel || "Counter",
            items: currentTicket.items || [],
            ready_for_pickup_at: nowIso,
            priority: currentTicket.priority,
            item_name: targetItem?.name,
          },
        });
      }
    } catch (err) {
      console.warn("[KitchenTerminal] Error updating items_status in Supabase:", err);
    }
  };

  // Stale Ticket Threshold Configuration (60 minutes unstarted)
  const STALE_THRESHOLD_MINUTES = 60;

  // Helper to parse ticket creation timestamp in ms
  const getTicketCreatedAtMs = (ticket: KdsTicket, fallbackNow: number): number => {
    if (ticket.created_at) {
      const t = new Date(ticket.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    if (ticket.createdAt) {
      const t = new Date(ticket.createdAt).getTime();
      if (!isNaN(t)) return t;
      const match = ticket.createdAt.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
      if (match) {
        const d = new Date();
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[4];
        if (ampm) {
          if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
          if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
        }
        d.setHours(h, m, 0, 0);
        return d.getTime();
      }
    }
    return fallbackNow;
  };

  const isVoidedStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "voided" || s === "void";
  };

  const isCompletedStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "completed" || s === "archived" || s === "fulfilled" || s === "cancelled" || s === "done" || s === "closed";
  };

  const isQueuedStatus = (status?: string | null): boolean => {
    if (!status) return true;
    const s = status.trim().toLowerCase();
    return s === "queued" || s === "pending" || s === "new" || s === "active" || s === "open" || s === "received";
  };

  const isCookingStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "preparing" || s === "cooking" || s === "in_progress";
  };

  const isPausedStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "paused";
  };

  const isReadyStatus = (status?: string | null): boolean => {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === "ready" || s === "prepared";
  };

  const checkIsTicketStale = (ticket: KdsTicket, nowMs: number) => {
    if (!isQueuedStatus(ticket.status)) {
      return { isStale: false, elapsedMinutes: 0, elapsedText: "" };
    }
    const createdMs = getTicketCreatedAtMs(ticket, nowMs);
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const isStale = elapsedMinutes >= STALE_THRESHOLD_MINUTES;
    const elapsedText = formatSmartDuration(elapsedSeconds);
    return { isStale, elapsedMinutes, elapsedText };
  };

  // 5. Manager Priority Override Handler
  const handleOverridePriority = async (
    ticketId: string,
    newPriority: KitchenTicketPriority
  ) => {
    const isRush = newPriority === "rush" || newPriority === "urgent";
    const updatedTickets = kdsTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          priority: newPriority,
          priority_reason: "manager_marked" as const,
        };
      }
      return t;
    });

    setKdsTickets(updatedTickets);
    saveStoredKdsTickets(currentOrgId, updatedTickets);

    if (isRush) {
      showToast(`🚨 Priority escalated to RUSH for #${ticketId}! (Urgent Tone)`);
    } else {
      showToast(`Priority changed to ${newPriority.toUpperCase()} for #${ticketId}`);
    }

    try {
      const supabase = createClient();
      await safeUpdateKitchenTicket(
        supabase,
        ticketId,
        {
          priority: newPriority,
          priority_reason: "manager_marked",
        },
        kdsTickets.find((t) => t.id === ticketId),
        restaurantId || currentOrgId
      );
    } catch (err) {
      console.warn("[KitchenTerminal] Priority override sync failed:", err);
    }
  };

  // 6. Auto-escalation Logic: If a 'normal' ticket is unstarted for 10+ minutes, upgrade to 'high'
  const autoEscalatedTicketsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unstartedNormalTickets = kdsTickets.filter((t) => {
      const isUnstarted = isQueuedStatus(t.status);
      const isNormal = (t.priority || "normal").toLowerCase() === "normal";
      if (!isUnstarted || !isNormal) return false;
      const createdMs = getTicketCreatedAtMs(t, nowTime);
      const unstartedMinutes = Math.floor((nowTime - createdMs) / 60000);
      return unstartedMinutes >= 10 && !autoEscalatedTicketsRef.current.has(t.id);
    });

    if (unstartedNormalTickets.length === 0) return;

    unstartedNormalTickets.forEach((t) => autoEscalatedTicketsRef.current.add(t.id));
    const toEscalateIds = new Set(unstartedNormalTickets.map((t) => t.id));

    const updated = kdsTickets.map((t) => {
      if (toEscalateIds.has(t.id)) {
        return {
          ...t,
          priority: "high" as const,
          priority_reason: "auto_escalated" as const,
        };
      }
      return t;
    });

    setKdsTickets(updated);
    saveStoredKdsTickets(currentOrgId, updated);
    showToast(
      `⚠️ ${unstartedNormalTickets.length} ticket(s) unstarted >10m auto-escalated to HIGH priority!`
    );

    (async () => {
      try {
        const supabase = createClient();
        for (const t of unstartedNormalTickets) {
          await safeUpdateKitchenTicket(
            supabase,
            t.id,
            {
              priority: "high",
              priority_reason: "auto_escalated",
            },
            t,
            restaurantId || currentOrgId
          );
        }
      } catch (err) {
        console.warn("[KitchenTerminal] Auto-escalation sync failed:", err);
      }
    })();
  }, [nowTime, kdsTickets, currentOrgId, showToast]);

  // 7. 4-Hour Stale Order Expiry Cutoff: Automatically transition tickets active > 4 hours to EXPIRED
  const expiredSyncedTicketsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const expiredTickets = kdsTickets.filter((t) => {
      if (t.status === "completed" || t.status === "voided" || t.status === "archived") return false;
      return isTicketExpired(t, nowTime);
    });

    if (expiredTickets.length === 0) return;

    const newlyExpired = expiredTickets.filter((t) => !expiredSyncedTicketsRef.current.has(t.id));
    if (newlyExpired.length === 0) return;

    newlyExpired.forEach((t) => expiredSyncedTicketsRef.current.add(t.id));
    const expiredIdSet = new Set(newlyExpired.map((t) => t.id));

    const updated = kdsTickets.map((t) => {
      if (expiredIdSet.has(t.id)) {
        return {
          ...t,
          status: "expired" as const,
          isExpired: true,
          is_expired: true,
        };
      }
      return t;
    });

    setKdsTickets(updated);
    saveStoredKdsTickets(currentOrgId, updated);
    showToast(`🛑 ${newlyExpired.length} order(s) exceeded the 4-hour cutoff and transitioned to EXPIRED.`);

    (async () => {
      try {
        const { restId } = await getValidTenantContext(user);
        for (const t of newlyExpired) {
          await syncOrderExpiredState(restId, String((t as any).orderId || t.id), {
            ticketNumber: t.id,
            tableIdentifier: t.tableOrChannel,
          });
        }
      } catch (err) {
        console.warn("[KitchenTerminal] Expiry sync failed:", err);
      }
    })();
  }, [nowTime, kdsTickets, currentOrgId, showToast, user]);

  // Live Reverse Countdown Timing Engine (Admin KDS Parity)
  const getTicketTiming = (ticket: KdsTicket) => {
    if (isTicketExpired(ticket, nowTime)) {
      return {
        isStarted: false,
        estimatedMinutes: 0,
        elapsedSeconds: 0,
        remainingSeconds: 0,
        isOverdue: true,
        formattedTime: "EXPIRED (4h+)",
        progressPercent: 100,
        isPaused: false,
        pausedSeconds: 0,
        pausedDurationText: "",
      };
    }

    let estimatedMinutes = ticket.estimatedPrepTime || ticket.estimated_prep_time;

    if (!estimatedMinutes && ticket.items && ticket.items.length > 0) {
      const itemTimes = ticket.items.map((it: any) => {
        return (
          it.preparation_time ||
          parseInt(String(it.prepTime || "15").replace(/[^0-9]/g, "")) ||
          15
        );
      });
      estimatedMinutes = Math.max(...itemTimes);
    }
    if (!estimatedMinutes || estimatedMinutes <= 0) {
      estimatedMinutes = 15;
    }

    const startedAt = ticket.prep_timer_started_at || ticket.prepStartedAt;

    if (!startedAt || ticket.status === "queued") {
      return {
        isStarted: false,
        estimatedMinutes,
        elapsedSeconds: 0,
        remainingSeconds: estimatedMinutes * 60,
        isOverdue: false,
        formattedTime: `~${estimatedMinutes}m queued`,
        progressPercent: 0,
        isPaused: false,
        pausedSeconds: 0,
        pausedDurationText: "",
      };
    }

    const isPaused = ticket.status === "paused";
    const currentPauseSec = isPaused && (ticket.paused_at || ticket.pausedAt)
      ? Math.max(0, Math.floor((nowTime - new Date(ticket.paused_at || ticket.pausedAt!).getTime()) / 1000))
      : 0;

    const totalAccumulatedPausedSec =
      (ticket.total_paused_seconds || ticket.totalPausedSeconds || 0) + currentPauseSec;

    const startTimeMs = new Date(startedAt).getTime();
    const rawElapsedSeconds = Math.max(0, Math.floor((nowTime - startTimeMs) / 1000));
    // DEDUCT paused duration from elapsed cooking time
    const elapsedSeconds = Math.max(0, rawElapsedSeconds - totalAccumulatedPausedSec);
    const totalDurationSeconds = estimatedMinutes * 60;
    const remainingSeconds = totalDurationSeconds - elapsedSeconds;

    const isOverdue = remainingSeconds <= 0;
    const absRemaining = Math.abs(remainingSeconds);
    const formattedSmart = formatSmartDuration(absRemaining);
    const pausedDurationText = formatSmartDuration(currentPauseSec);

    const formattedTime = isPaused
      ? `Paused ${pausedDurationText}`
      : isOverdue
        ? `+${formattedSmart} Overdue`
        : `${formattedSmart} left`;

    const progressPercent = Math.min(
      100,
      Math.max(0, Math.round((elapsedSeconds / totalDurationSeconds) * 100))
    );

    return {
      isStarted: true,
      estimatedMinutes,
      elapsedSeconds,
      remainingSeconds,
      isOverdue,
      formattedTime,
      progressPercent,
      isPaused,
      pausedSeconds: currentPauseSec,
      totalAccumulatedPausedSec,
      pausedDurationText,
    };
  };

  // Station Scoped Tickets (Multi-station support)
  const stationScopedTickets = useMemo(() => {
    if (selectedStation === "all") return kdsTickets;
    return kdsTickets.filter((ticket) => isTicketApplicableToStation(ticket, selectedStation));
  }, [kdsTickets, selectedStation]);

  // Telemetry Counts (Scoped to selected station for accurate operational visibility)
  const queuedTickets = useMemo(() => stationScopedTickets.filter((t) => isQueuedStatus(t.status)), [stationScopedTickets]);
  const preparingTickets = useMemo(() => stationScopedTickets.filter((t) => isCookingStatus(t.status)), [stationScopedTickets]);
  const pausedTickets = useMemo(() => stationScopedTickets.filter((t) => isPausedStatus(t.status)), [stationScopedTickets]);
  const readyTickets = useMemo(() => stationScopedTickets.filter((t) => isReadyStatus(t.status)), [stationScopedTickets]);
  const completedTickets = useMemo(() => stationScopedTickets.filter((t) => isCompletedStatus(t.status) && !isVoidedStatus(t.status)), [stationScopedTickets]);
  const voidedTickets = useMemo(() => stationScopedTickets.filter((t) => isVoidedStatus(t.status)), [stationScopedTickets]);

  // Active ticket counts per station for the Station Pill Bar
  const stationCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: kdsTickets.filter((t) => !isCompletedStatus(t.status) && !isVoidedStatus(t.status)).length,
      fast_food: 0,
      desi: 0,
      grill: 0,
      fry: 0,
      pastry: 0,
      beverages: 0,
      assembly: 0,
    };
    kdsTickets.forEach((t) => {
      if (!isCompletedStatus(t.status) && !isVoidedStatus(t.status)) {
        STATION_OPTIONS.forEach((opt) => {
          if (opt.id !== "all" && isTicketApplicableToStation(t, opt.id)) {
            counts[opt.id] = (counts[opt.id] || 0) + 1;
          }
        });
      }
    });
    return counts;
  }, [kdsTickets]);

  // Filtered Tickets for Display Grid (Priority Sorted)
  const filteredTickets = useMemo(() => {
    const list = stationScopedTickets.filter((ticket) => {
      // Tab filter
      if (activeTab === "all_active") {
        if (isCompletedStatus(ticket.status) || isVoidedStatus(ticket.status)) return false;
        return true;
      }
      if (activeTab === "queued" && !isQueuedStatus(ticket.status)) return false;
      if (activeTab === "preparing" && !isCookingStatus(ticket.status)) return false;
      if (activeTab === "paused" && !isPausedStatus(ticket.status)) return false;
      if (activeTab === "ready" && !isReadyStatus(ticket.status)) return false;
      if (activeTab === "completed" && (!isCompletedStatus(ticket.status) || isVoidedStatus(ticket.status))) return false;
      if (activeTab === "voided" && !isVoidedStatus(ticket.status)) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = (ticket.id || "").toLowerCase().includes(q);
        const matchesChannel = (ticket.tableOrChannel || "").toLowerCase().includes(q);
        const matchesServer = (ticket.serverName || "").toLowerCase().includes(q);
        const matchesItem = (ticket.items || []).some((it: any) => (it.name || "").toLowerCase().includes(q));
        if (!matchesId && !matchesChannel && !matchesServer && !matchesItem) return false;
      }

      return true;
    });

    // 3. Sort ticket grid: Latest order on top, older orders underneath in sequence across all tabs
    return list.sort((a, b) => {
      // Completed tab: Sort by completed timestamp (or created timestamp fallback) descending (newest on top)
      if (activeTab === "completed") {
        const getCompTime = (t: KdsTicket) => {
          const raw = t.completed_at || t.completedAt || (t as any).updated_at || (t as any).updatedAt;
          if (raw) {
            const ms = new Date(raw).getTime();
            if (!isNaN(ms)) return ms;
          }
          return getTicketCreatedAtMs(t, nowTime);
        };
        const timeA = getCompTime(a);
        const timeB = getCompTime(b);
        return timeB - timeA;
      }

      // Ready tab: Sort by ready_for_pickup timestamp (or created timestamp fallback) descending (newest on top)
      if (activeTab === "ready") {
        const getReadyTime = (t: KdsTicket) => {
          if (t.ready_for_pickup_at) {
            const ms = new Date(t.ready_for_pickup_at).getTime();
            if (!isNaN(ms)) return ms;
          }
          return getTicketCreatedAtMs(t, nowTime);
        };
        const timeA = getReadyTime(a);
        const timeB = getReadyTime(b);
        return timeB - timeA;
      }

      // Voided tab: Sort by latest timestamp descending (newest on top)
      if (activeTab === "voided") {
        const timeA = getTicketCreatedAtMs(a, nowTime);
        const timeB = getTicketCreatedAtMs(b, nowTime);
        return timeB - timeA;
      }

      // Active tabs (all_active, queued, preparing, paused):
      // Priority first (rush / high on top), then latest order on top (timeB - timeA)
      const rankA = getPriorityRank(a.priority);
      const rankB = getPriorityRank(b.priority);
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      const timeA = getTicketCreatedAtMs(a, nowTime);
      const timeB = getTicketCreatedAtMs(b, nowTime);
      return timeB - timeA;
    });
  }, [stationScopedTickets, activeTab, searchQuery, nowTime]);

  // 5+ Min Waiter Pickup SLA Tracking
  const overduePickupTickets = useMemo(() => {
    return kdsTickets.filter((t) => {
      if (!t.ready_for_pickup_at || t.picked_up_at) return false;
      const waitSec = Math.max(
        0,
        Math.floor((nowTime - new Date(t.ready_for_pickup_at).getTime()) / 1000)
      );
      return waitSec >= 300; // 5+ minutes
    });
  }, [kdsTickets, nowTime]);

  // Chef Profile Shift Information
  const roleLabel =
    user?.staffRole?.toUpperCase() ||
    (user?.role === "STAFF_MEMBER" ? "STAFF" : user?.role || "CHEF");

  const restId = user?.restaurantId || (user as any)?.restId || user?.organizationId;
  const shiftConfig = useMemo(() => getRestaurantShiftConfig(restId, user), [restId, user]);
  const effectiveShifts = useMemo(() => getEffectiveShiftsList(shiftConfig), [shiftConfig]);
  const parsedShift = parseShiftOption(user?.assignedShift || shiftValidation?.assignedShift, shiftConfig);
  const shiftTitle = user?.assignedShift || shiftValidation?.assignedShift || effectiveShifts[0]?.name || "Kitchen Duty Roster";
  const shiftWindowLabel = parsedShift
    ? getShiftWindowLabel(parsedShift, shiftConfig)
    : shiftValidation?.windowLabel || (effectiveShifts[0] ? `${format24HourTo12Hour(effectiveShifts[0].start)} - ${format24HourTo12Hour(effectiveShifts[0].end)}` : "Operating Hours");
  const shiftStartFormatted = getShiftStartLabel(parsedShift, shiftConfig);
  const shiftEndFormatted = parsedShift
    ? getShiftEndLabel(parsedShift, shiftConfig)
    : shiftValidation?.shiftEndLabel || (effectiveShifts[0] ? format24HourTo12Hour(effectiveShifts[0].end) : "12:00 AM");

  return (
    <div className="flex-1 w-full flex h-full min-h-0 relative overflow-hidden bg-[var(--bg)] text-[var(--text-hi)] font-sans select-none transition-colors duration-150">
      {/* ========================================================================= */}
      {/* 1. INDEPENDENT KITCHEN TERMINAL SIDEBAR (MIRRORS POS TERMINAL SHELL)     */}
      {/* ========================================================================= */}
      <KitchenSidebar
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        queuedCount={queuedTickets.length}
        preparingCount={preparingTickets.length}
        pausedCount={pausedTickets.length}
        readyCount={readyTickets.length}
        completedCount={completedTickets.length}
        onTriggerBuzzer={handleTriggerBuzzer}
        isBuzzerRinging={isBuzzerRinging}
      />

      {/* ========================================================================= */}
      {/* 2. MAIN SCROLLABLE VIEWPORT (PURE KDS OR CHEF PROFILE VIEW)              */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Shift Warning / Lockout Notification Banner */}
        {shiftValidation && (shiftValidation.isWarningWindow || isShiftLocked) && (
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs font-mono shrink-0 transition-all ${
            isShiftLocked
              ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
              : "bg-amber-500/15 border-amber-500/30 text-amber-300"
          }`}>
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${isShiftLocked ? "text-rose-400" : "text-amber-400"} shrink-0`} />
              <span>
                {isShiftLocked
                  ? `🛑 Kitchen Shift Window Concluded: ${shiftValidation.shiftShortName} ended at ${shiftValidation.shiftEndLabel}. Rollover required to continue kitchen service.`
                  : `⏳ Kitchen Shift Window Expiring: ${shiftValidation.shiftShortName} closes in ${shiftValidation.minutesRemaining} min (${shiftValidation.shiftEndLabel}).`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsRolloverModalOpen(true)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase font-mono cursor-pointer transition-all ${
                isShiftLocked
                  ? "bg-rose-500 hover:bg-rose-400 text-white shadow-sm"
                  : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm"
              }`}
            >
              {isShiftLocked ? "Execute Rollover" : "Rollover Shift"}
            </button>
          </div>
        )}
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed top-18 right-6 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--bg)] border border-[var(--gold)]/40 text-[var(--gold)] shadow-2xl font-mono text-xs font-semibold animate-in fade-in slide-in-from-top-4">
            <Sparkles className="w-4 h-4 text-[var(--gold)]" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="flex-1 min-w-0 h-full overflow-y-auto pb-24 lg:pb-12 scrollbar-thin">
          <div
            className={`px-4 sm:px-6 md:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200 transition-all ${isBuzzerRinging ? "ring-4 ring-amber-500/50 rounded-3xl" : ""
              }`}
          >
            {/* ========================================================================= */}
            {/* CHEF PROFILE VIEW (LOCAL, PREVENTS CROSS-ROUTING TO POS)                  */}
            {/* ========================================================================= */}
            {activeTab === "profile" ? (
              <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
                {/* Profile Heading Bar with Quick Back Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                      Chef{" "}
                      <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                        Profile
                      </span>
                    </h1>
                    <p className="text-xs font-mono text-[var(--text-lo)] mt-1">
                      Personal credentials, assigned kitchen station &amp; operational shift schedule
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("all_active")}
                    className="btn-gold font-bold px-4 py-2.5 rounded-xl text-xs text-[#342c14] flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-all self-start sm:self-auto font-mono"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Back to KDS Queue</span>
                  </button>
                </div>

                {/* Hero Card */}
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[var(--border)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="relative shrink-0">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-zinc-950 font-black text-3xl font-display shadow-lg shadow-amber-500/20">
                          {user?.name ? user.name.charAt(0).toUpperCase() : "C"}
                        </div>
                        <span
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[var(--bg-deep)] flex items-center justify-center shadow-xs"
                          title="Active Kitchen Terminal Session"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        </span>
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-2xl font-display font-extrabold tracking-tight text-[var(--text-hi)] truncate">
                            {user?.name || "Kitchen Chef"}
                          </h2>
                          <span className="px-3 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-400 text-xs font-mono font-bold uppercase tracking-wider">
                            {roleLabel}
                          </span>
                          {chefAssignedStation ? (
                            <span className="px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                              <Flame className="w-3 h-3 text-amber-400" />
                              <span>STATION: {chefAssignedStation.toUpperCase()}</span>
                            </span>
                          ) : (
                            <span className="px-3 py-0.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                              <Layers className="w-3 h-3 text-[var(--gold)]" />
                              <span>ALL STATIONS</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-lo)] font-mono truncate">
                          {user?.email || "kitchen@restaurant.com"}
                        </p>
                        <div className="flex items-center gap-2 pt-1 text-xs text-emerald-400 font-mono font-medium">
                          <BadgeCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>Verified Kitchen Staff • Live Session</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-center gap-1.5 font-mono text-xs border-t md:border-t-0 md:border-l border-[var(--border)] pt-4 md:pt-0 md:pl-6 shrink-0">
                      <div className="flex items-center gap-2 text-[var(--text-hi)] font-bold">
                        <Building2 className="w-4 h-4 text-[var(--gold)] shrink-0" />
                        <span>{user?.restaurantName || "Omnibites Restaurant"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--text-lo)]">
                        <Store className="w-4 h-4 text-[var(--text-faint)] shrink-0" />
                        <span>{user?.branchName || "Main Kitchen Station"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1: Credentials & Contact */}
                  <div className="glass-panel p-6 rounded-3xl border border-[var(--border)] space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
                      <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-[var(--text-hi)]">
                          Chef Credentials &amp; Contact
                        </h3>
                        <p className="text-[11px] text-[var(--text-lo)]">Staff record &amp; station assignment</p>
                      </div>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <User className="w-4 h-4 text-[var(--text-faint)]" />
                          <span>Full Name:</span>
                        </div>
                        <span className="text-[var(--text-hi)] font-bold truncate max-w-[200px]">
                          {user?.name || "N/A"}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Mail className="w-4 h-4 text-[var(--text-faint)]" />
                          <span>Email Address:</span>
                        </div>
                        <span className="text-[var(--text-hi)] font-bold truncate max-w-[200px]">
                          {user?.email || "N/A"}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Phone className="w-4 h-4 text-[var(--text-faint)]" />
                          <span>Contact Phone:</span>
                        </div>
                        <span className="text-[var(--text-hi)] font-bold">
                          {user?.phone || "Not registered"}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Layers className="w-4 h-4 text-[var(--gold)]" />
                          <span>Assigned Station:</span>
                        </div>
                        <span className="text-[var(--gold)] font-bold uppercase">
                          {chefAssignedStation ? chefAssignedStation : "All Stations / General"}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Store className="w-4 h-4 text-[var(--text-faint)]" />
                          <span>Kitchen Outlet:</span>
                        </div>
                        <span className="text-[var(--text-hi)] font-bold">
                          {user?.branchName || "Main Kitchen"}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Shield className="w-4 h-4 text-[var(--text-faint)]" />
                          <span>Station Role:</span>
                        </div>
                        <span className="text-orange-400 font-bold">
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Shift Timings */}
                  <div className="glass-panel p-6 rounded-3xl border border-[var(--border)] space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sm text-[var(--text-hi)]">
                          Kitchen Shift Schedule
                        </h3>
                        <p className="text-[11px] text-[var(--text-lo)]">Assigned daily cooking operational schedule</p>
                      </div>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Calendar className="w-4 h-4 text-[var(--text-faint)]" />
                          <span>Assigned Shift:</span>
                        </div>
                        <span className="text-[var(--text-hi)] font-bold">
                          {shiftTitle}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Clock className="w-4 h-4 text-[var(--text-faint)]" />
                          <span>Operating Window:</span>
                        </div>
                        <span className="text-[var(--gold)] font-bold">
                          {shiftWindowLabel}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Timer className="w-4 h-4 text-emerald-400" />
                          <span>Shift Start:</span>
                        </div>
                        <span className="text-emerald-400 font-bold">
                          {shiftStartFormatted}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <Clock className="w-4 h-4 text-[var(--gold)]" />
                          <span>Shift End:</span>
                        </div>
                        <span className="text-[var(--gold)] font-bold">
                          {shiftEndFormatted}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-[var(--text-lo)]">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Kitchen Status:</span>
                        </div>
                        <span className="text-emerald-400 font-bold">
                          Active on Kitchen Duty
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "stats" ? (
              <ChefPerformanceStatsView
                tickets={kdsTickets}
                user={user}
                shiftInfo={{
                  shiftTitle,
                  shiftWindowLabel,
                  shiftStartFormatted,
                  shiftEndFormatted,
                }}
                onBackToQueue={() => setActiveTab("all_active")}
              />
            ) : (
              <>
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                      Kitchen Order Display{" "}
                      <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                        (KDS Station)
                      </span>
                    </h1>
                    <p className="text-xs font-mono text-[var(--text-lo)] mt-1">
                      Live chef ticket sequencing, reverse cook countdown timers &amp; handoff queue
                    </p>
                  </div>

                  {/* Quick Search & Buzzer Chime Button */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-44 sm:w-56">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tickets / dish..."
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--surface-hi)]/80 border border-[var(--border)] text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--gold)] transition-colors font-mono"
                      />
                    </div>

                    {/* Shift Status Indicator */}
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold shrink-0 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="hidden md:inline">Shift:</span>
                      <span>{user?.assignedShift || "Active Shift"}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleTriggerBuzzer}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold font-mono cursor-pointer flex items-center gap-2 transition-all shadow-md shrink-0 ${isBuzzerRinging
                          ? "bg-amber-500 text-black border-amber-400 shadow-amber-500/40 scale-105"
                          : "bg-white/80 dark:bg-[var(--surface-hi)] border border-[var(--border)] hover:border-amber-500/50 text-amber-900 dark:text-amber-400 shadow-2xs"
                        }`}
                      title="Test kitchen alert buzzer"
                    >
                      <Volume2 className={`w-4 h-4 ${isBuzzerRinging ? "animate-bounce" : ""}`} />
                      <span className="hidden sm:inline">Chime</span>
                    </button>
                  </div>
                </div>

                {/* Station Filter Pill Bar & Terminal Isolation */}
                <div className="w-full">
                  {isLineCook ? (
                    <div className="text-xs font-mono font-bold tracking-wide py-1">
                      <span className="text-[var(--text-lo)] uppercase">Station: </span>
                      <span className="text-[var(--gold)] font-black uppercase">
                        {normalizeStationName(chefAssignedStation).replace(/_/g, " ")}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold tracking-wider text-[var(--text-lo)] uppercase flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[var(--gold)]" />
                            <span>Station Filter:</span>
                          </span>
                          {canOversightAllStations && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span>Multi-Station Oversight</span>
                            </span>
                          )}
                        </div>

                        {canOversightAllStations && selectedStation !== "all" && (
                          <button
                            type="button"
                            onClick={() => setSelectedStation("all")}
                            className="text-[11px] font-mono text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                          >
                            <span>Reset to All Stations</span>
                          </button>
                        )}
                      </div>

                      {/* Multi-Station Oversight: Full interactive station pills */}
                      <div className="p-1.5 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center gap-2 overflow-x-auto max-w-full scrollbar-none shadow-2xs">
                        {STATION_OPTIONS.map((station) => {
                          const isSelected = selectedStation === station.id;
                          const isMyStation = chefAssignedStation === station.id;
                          const count = stationCounts[station.id] || 0;
                          const Icon = station.icon;

                          return (
                            <button
                              key={station.id}
                              type="button"
                              onClick={() => setSelectedStation(station.id)}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                isSelected
                                  ? "btn-gold text-[#342c14] shadow-md font-black scale-[1.02]"
                                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] border border-transparent"
                              }`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-[#342c14]" : station.colorClass}`} />
                              <span>{station.label}</span>
                              {count > 0 && (
                                <span
                                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                                    isSelected
                                      ? "bg-[#342c14]/20 text-[#342c14]"
                                      : "bg-[var(--surface)] text-[var(--text-hi)] border border-[var(--border)]"
                                  }`}
                                >
                                  {count}
                                </span>
                              )}
                              {isMyStation && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded-md font-black uppercase ${
                                    isSelected
                                      ? "bg-black/20 text-[#342c14]"
                                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  }`}
                                >
                                  My Station
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* KDS Stage Telemetry Bar (Admin KDS Parity) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div
                    onClick={() => setActiveTab("queued")}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1 shadow-2xs cursor-pointer hover:border-blue-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase">
                      <span>Queued</span>
                      <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-xl font-display font-black text-blue-700 dark:text-blue-400">
                      {queuedTickets.length}
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("preparing")}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1 shadow-2xs cursor-pointer hover:border-amber-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase">
                      <span>Cooking Now</span>
                      <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-xl font-display font-black text-amber-800 dark:text-amber-400">
                      {preparingTickets.length}
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("paused")}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1 shadow-2xs cursor-pointer hover:border-neutral-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase">
                      <span>Paused</span>
                      <Pause className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-300" />
                    </div>
                    <p className="text-xl font-display font-black text-neutral-800 dark:text-neutral-200">
                      {pausedTickets.length}
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("ready")}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1 shadow-2xs cursor-pointer hover:border-emerald-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase">
                      <span>Ready for Handoff</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-[#25d366]" />
                    </div>
                    <p className="text-xl font-display font-black text-emerald-700 dark:text-[#25d366]">
                      {readyTickets.length}
                    </p>
                  </div>

                  <div
                    onClick={() => setActiveTab("completed")}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1 shadow-2xs cursor-pointer hover:border-[var(--gold)]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase">
                      <span>Completed Today</span>
                      <Archive className="w-3.5 h-3.5 text-amber-700 dark:text-[var(--gold)]" />
                    </div>
                    <p className="text-xl font-display font-black text-amber-800 dark:text-[var(--gold)]">
                      {completedTickets.length}
                    </p>
                  </div>

                  {/* ❌ Requirement 6: Voided Today Counter in Telemetry Header */}
                  <div
                    onClick={() => setActiveTab("voided")}
                    className="p-3.5 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1 shadow-2xs cursor-pointer hover:border-rose-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase">
                      <span>Voided Today</span>
                      <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <p className="text-xl font-display font-black text-rose-700 dark:text-rose-400">
                      {voidedTickets.length}
                    </p>
                  </div>
                </div>

                {/* Stage Filter Tabs & View Mode Switcher */}
                <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="lg:hidden w-full">
                    <ResponsiveSelect
                      value={activeTab}
                      onChange={(val) => setActiveTab(val as any)}
                      options={[
                        {
                          id: "all_active",
                          label: "All Active",
                          count: queuedTickets.length + preparingTickets.length + pausedTickets.length + readyTickets.length,
                        },
                        { id: "queued", label: "Queued", count: queuedTickets.length },
                        { id: "preparing", label: "Cooking", count: preparingTickets.length },
                        { id: "paused", label: "Paused", count: pausedTickets.length },
                        { id: "ready", label: "Ready", count: readyTickets.length },
                        { id: "completed", label: "Completed", count: completedTickets.length },
                        { id: "voided", label: "Voided", count: voidedTickets.length },
                      ]}
                    />
                  </div>

                  <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] overflow-x-auto max-w-full scrollbar-none">
                    {[
                      {
                        id: "all_active",
                        label: `All Active (${queuedTickets.length + preparingTickets.length + pausedTickets.length + readyTickets.length})`,
                      },
                      { id: "queued", label: `Queued (${queuedTickets.length})` },
                      { id: "preparing", label: `Cooking (${preparingTickets.length})` },
                      { id: "paused", label: `Paused (${pausedTickets.length})` },
                      { id: "ready", label: `Ready (${readyTickets.length})` },
                      { id: "completed", label: `Completed (${completedTickets.length})` },
                      { id: "voided", label: `Voided (${voidedTickets.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id
                            ? "btn-gold text-[#342c14] shadow-sm font-black"
                            : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5+ Min Waiter Pickup SLA Breach Sticky Banner */}
                {overduePickupTickets.length > 0 && (
                  <div className="mb-4 p-3.5 rounded-2xl bg-red-500/20 border-2 border-red-500/80 text-red-100 flex items-center justify-between gap-3 shadow-xl shadow-red-950/60 animate-pulse">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-inner">
                        <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-wider text-red-200">
                          ⚠️ {overduePickupTickets.length} ORDER{overduePickupTickets.length > 1 ? "S" : ""} WAITING 5+ MIN FOR WAITER PICKUP!
                        </div>
                        <div className="text-[11px] font-mono text-red-300 truncate">
                          Pass SLA Breach: {overduePickupTickets.map((t) => `#${t.id} (${t.tableOrChannel})`).join(", ")}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-red-500 text-white font-mono text-[11px] font-black uppercase shrink-0 shadow-sm">
                      URGENT PASS SLA
                    </span>
                  </div>
                )}

                {/* KDS Ticket Cards Grid */}
                {filteredTickets.length === 0 ? (
                  <div className="glass-panel p-12 text-center rounded-2xl border border-[var(--border)] space-y-3">
                    {activeTab === "voided" ? (
                      <>
                        <Ban className="w-12 h-12 text-rose-400 mx-auto opacity-70" />
                        <p className="font-display font-bold text-base text-[var(--text-hi)]">
                          {selectedStation === "all" ? "No Voided Orders Today" : `No Voided Orders for ${selectedStation.toUpperCase()} Station`}
                        </p>
                        <p className="text-xs font-mono text-[var(--text-faint)]">
                          Voided tickets with reversed inventory deductions appear here.
                        </p>
                      </>
                    ) : activeTab === "completed" ? (
                      <>
                        <Archive className="w-12 h-12 text-[var(--gold)] mx-auto opacity-70" />
                        <p className="font-display font-bold text-base text-[var(--text-hi)]">
                          {selectedStation === "all" ? "No Completed Orders Yet" : `No Completed Orders for ${selectedStation.toUpperCase()} Station`}
                        </p>
                        <p className="text-xs font-mono text-[var(--text-faint)]">
                          Orders marked as completed or fulfilled will appear here.
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-12 h-12 text-[#25d366] mx-auto opacity-70" />
                        <p className="font-display font-bold text-base text-[var(--text-hi)]">
                          {selectedStation === "all" ? "Kitchen Queue is Clear!" : `${selectedStation.toUpperCase()} Station Queue is Clear!`}
                        </p>
                        <p className="text-xs font-mono text-[var(--text-faint)]">
                          {selectedStation === "all"
                            ? "All orders in this stage have been prepared or dispatched. New orders from POS Counter will arrive here automatically."
                            : isLineCook
                            ? `No active tickets currently routed to the ${selectedStation.toUpperCase()} station. New orders will appear automatically.`
                            : `No active tickets assigned to the ${selectedStation.toUpperCase()} station. Switch stations or click 'Reset to All Stations' above.`}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5 sm:space-y-3">
                    {filteredTickets.map((ticket) => {
                      const timing = getTicketTiming(ticket);
                      const isExpired = isTicketExpired(ticket, nowTime);
                      const { isStale, elapsedMinutes: elapsedSincePlaced, elapsedText: elapsedSincePlacedText } =
                        checkIsTicketStale(ticket, nowTime);
                      const isCooking = isCookingStatus(ticket.status);
                      const isPaused = isPausedStatus(ticket.status);
                      const isReady = isReadyStatus(ticket.status);
                      const isCompleted = isCompletedStatus(ticket.status);
                      const isVoided = isVoidedStatus(ticket.status);

                      // Expiry & Lock computations
                      const createdMs = getOrderCreationEpochMs(ticket);
                      const isPast4HourCutoff = createdMs ? (nowTime - createdMs >= ORDER_EXPIRY_CUTOFF_MS) : false;
                      const wasExpired = Boolean((ticket as any).was_expired || (typeof ticket.notes === "string" && ticket.notes.includes("EXPIRED")));
                      const isOrderCutoffExpired = isExpired || isPast4HourCutoff || wasExpired;

                      // 2-hour completion grace period for delivered/completed orders
                      const completedTime = ticket.completed_at || ticket.completedAt || (ticket as any).updated_at || (ticket as any).updatedAt;
                      const completedMs = completedTime ? new Date(completedTime).getTime() : null;
                      const completedAgeMs = completedMs && !isNaN(completedMs) ? Math.max(0, nowTime - completedMs) : (createdMs ? Math.max(0, nowTime - createdMs) : 0);
                      const isPast2HourCompletedWindow = isCompleted && completedAgeMs > 2 * 60 * 60 * 1000;
                      const canReopenCompleted = isCompleted && !isVoided && !wasExpired && !isPast4HourCutoff && !isPast2HourCompletedWindow;

                      // Completed, expired, or voided orders lock all internal item toggles and modifications
                      const isTicketLocked = isCompleted || isExpired || isOrderCutoffExpired || isVoided;
                      const isOverdue = isCooking && timing.isOverdue;
                      const station = getTicketStation(ticket);
                      const stationBadge = getStationBadgeInfo(station);
                      const StationIcon = stationBadge.icon;

                      // Waiter pickup SLA computations
                      const isWaitingPickup = ticket.ready_for_pickup_at != null && ticket.picked_up_at == null;
                      const isPickedUp = ticket.picked_up_at != null;
                      const pickupWaitSec = isWaitingPickup && ticket.ready_for_pickup_at
                        ? Math.max(0, Math.floor((nowTime - new Date(ticket.ready_for_pickup_at).getTime()) / 1000))
                        : 0;
                      const isPickupOverdue = isWaitingPickup && pickupWaitSec >= 300; // 5+ min

                      // Item-level tracking computations
                      const allItemsStatus = getTicketItemsStatus(ticket);
                      // Station-level item isolation: when viewing a station queue, isolate to only items for that station
                      const itemsStatusForStation = selectedStation === "all"
                        ? allItemsStatus
                        : allItemsStatus.filter((item, idx) => {
                            const ticketItem =
                              ticket.items?.[idx] ||
                              ticket.items?.find(
                                (ti: any) => (ti.id && ti.id === item.item_id) || ti.name === item.name
                              );
                            return isItemForStation(ticketItem || item, selectedStation);
                          });
                      const itemsStatus = itemsStatusForStation.length > 0 ? itemsStatusForStation : allItemsStatus;
                      const readyItemsCount = itemsStatus.filter((it) => it.status === "ready").length;
                      const totalItemsCount = itemsStatus.length;
                      const isAllItemsReady = totalItemsCount > 0 && readyItemsCount === totalItemsCount;
                      const itemProgressPercent = totalItemsCount > 0 ? Math.round((readyItemsCount / totalItemsCount) * 100) : 0;

                      // Priority styling & configuration
                      const priorityInfo = getPriorityVisualConfig(ticket.priority, ticket.priority_reason);
                      const isRush = priorityInfo.isRush;

                      // Delivery & Channel tracking computations
                      const channelInfo = getOrderChannelInfo(ticket);
                      const isDelivery = channelInfo.channel === "delivery";
                      const isTakeaway = channelInfo.channel === "takeaway";

                      const riderWaitingMin = ticket.rider_waiting_minutes != null
                        ? ticket.rider_waiting_minutes
                        : ticket.rider_waiting_since
                          ? Math.max(1, Math.floor((nowTime - new Date(ticket.rider_waiting_since).getTime()) / 60000))
                          : isWaitingPickup && isDelivery && pickupWaitSec >= 120
                            ? Math.max(1, Math.floor(pickupWaitSec / 60))
                            : 0;

                      const isRiderDelayed = Boolean(
                        ticket.rider_delayed ||
                        ticket.riderDelayed ||
                        riderWaitingMin > 0
                      );
                      const riderWaitDisplayMin = riderWaitingMin > 0 ? riderWaitingMin : Math.max(1, Math.floor(pickupWaitSec / 60));

                      const ticketAllergies = extractTicketAllergies(ticket);
                      const explicitChefNotes =
                        ticket.chef_notes ||
                        ticket.notes ||
                        (ticket as any).chefNotes ||
                        (ticket as any).special_instructions ||
                        (ticket as any).order_notes;
                      const chefNotesText = explicitChefNotes ? String(explicitChefNotes).trim() : null;
                      const hasAllergies = ticketAllergies.length > 0;

                      // =========================================================================
                      // LIST TILE FORMAT (Space-Efficient Horizontal Row)
                      // =========================================================================
                      return (
                          <div
                            key={ticket.id}
                            className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-transparent transition-all duration-200 relative group overflow-hidden shadow-sm flex flex-col lg:flex-row lg:items-start justify-between gap-3 sm:gap-4 ${
                              isExpired
                                ? "border-2 border-rose-500 shadow-rose-950/20"
                                : isVoided
                                ? "opacity-60 border border-zinc-700/60"
                                : isCompleted
                                ? "opacity-60 border border-emerald-600/50"
                                : isPickupOverdue
                                ? "border-2 border-rose-500 shadow-rose-950/20"
                                : isPaused
                                ? "border-2 border-amber-500 shadow-amber-950/20"
                                : isRush
                                ? "border-2 border-amber-400 shadow-amber-950/20"
                                : isReady
                                ? "border-2 border-emerald-500 shadow-emerald-950/20"
                                : isCooking
                                ? "border-2 border-amber-500 shadow-amber-950/20"
                                : "border border-[var(--border)] hover:border-[var(--gold)]/60"
                            }`}
                          >
                            {/* Vertical Status Accent Line on Left Edge */}
                            <div
                              className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                                isExpired
                                  ? "bg-rose-500 animate-pulse"
                                  : isReady
                                  ? "bg-emerald-500"
                                  : isCooking
                                  ? isOverdue
                                    ? "bg-amber-600"
                                    : "bg-amber-500"
                                  : isPaused
                                  ? "bg-stone-500"
                                  : isRush
                                  ? "bg-amber-400"
                                  : "bg-[var(--gold)]"
                              }`}
                            />

                            {/* Zone 1: Order Metadata & Live Timer (Start Content) */}
                            <div className="flex items-center gap-3 shrink-0 min-w-0 lg:w-60 xl:w-72 pl-1.5 relative z-1">
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-black text-sm sm:text-base text-[var(--text-hi)] flex items-center gap-1 shrink-0">
                                    {isRush && (
                                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                                    )}
                                    #{ticket.id}
                                  </span>
                                  <span className="font-mono font-bold text-xs text-[var(--gold)] truncate max-w-[130px]">
                                    {ticket.tableOrChannel || "Counter Takeaway"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isExpired && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-mono font-black uppercase tracking-wider bg-rose-500/25 text-rose-300 border border-rose-500/50 animate-pulse">
                                      🛑 Order Expired (4h Cutoff)
                                    </span>
                                  )}

                                  <span
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold uppercase tracking-wider border shrink-0 ${stationBadge.className}`}
                                    title={`Assigned Station: ${stationBadge.label}`}
                                  >
                                    <StationIcon className="w-2.5 h-2.5 shrink-0" />
                                    <span>{stationBadge.label}</span>
                                  </span>

                                  <span
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-wider border shrink-0 ${channelInfo.badgeClass}`}
                                  >
                                    <span>{channelInfo.badgeEmoji}</span>
                                    <span>{channelInfo.badgeText}</span>
                                  </span>

                                  {priorityInfo.label !== "NORMAL" && (
                                    <span
                                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-wider border shrink-0 ${priorityInfo.badgeClass}`}
                                    >
                                      <span>{priorityInfo.badgeEmoji}</span>
                                      <span>{priorityInfo.label}</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-xs font-mono">
                                  {/* Live Timer Pill */}
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
                                      isStale
                                        ? "bg-[var(--surface)] text-[var(--text-faint)] border-[var(--border)]"
                                        : isPaused
                                        ? "bg-[var(--surface-hi)] text-[var(--gold)] border-[var(--border)]"
                                        : isCompleted
                                        ? "bg-[var(--surface)]/80 text-[var(--text-faint)] border-[var(--border)]"
                                        : isReady
                                        ? "bg-emerald-950/40 text-emerald-300 border-emerald-600/30"
                                        : isOverdue
                                        ? "bg-amber-950/40 text-amber-300 border-amber-600/40 animate-pulse"
                                        : isCooking
                                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                        : "bg-[var(--surface-hi)] text-[var(--text-hi)] border-[var(--border)]"
                                    }`}
                                  >
                                    {isReady ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span>READY</span>
                                      </>
                                    ) : isCooking ? (
                                      <>
                                        <Flame className="w-3 h-3 text-amber-400" />
                                        <span>{timing.formattedTime}</span>
                                      </>
                                    ) : isPaused ? (
                                      <>
                                        <Pause className="w-3 h-3 text-amber-300" />
                                        <span>PAUSED</span>
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3 h-3 text-stone-400" />
                                        <span>{timing.formattedTime}</span>
                                      </>
                                    )}
                                  </span>

                                  <span className="text-[10px] text-[var(--text-faint)] truncate max-w-[80px]">
                                    {ticket.createdAt ? ticket.createdAt : "Just now"}
                                  </span>

                                  {/* Print Slip Icon Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenPrintPreview(ticket);
                                    }}
                                    className={`p-1 rounded-md text-[10px] border transition-all cursor-pointer ${
                                      ticket.printed_at
                                        ? "bg-emerald-950/40 text-emerald-300 border-emerald-600/30 hover:bg-emerald-900/40"
                                        : "bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] text-[var(--text-hi)] border-[var(--border)]"
                                    }`}
                                    title="Print 80mm Thermal KOT Slip"
                                  >
                                    <Printer className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Zone 2: Detailed Items & Modifiers (Center Content) */}
                            <div className="flex-1 min-w-0 py-2 lg:py-0 lg:px-4 lg:border-x border-[var(--border)]/60 space-y-2 relative z-1">
                              {/* Items Progress & Quick Info Header */}
                              <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[var(--text-faint)] pb-1 border-b border-[var(--border)]/40">
                                <div className="flex items-center gap-2">
                                  <span className="text-[var(--text-hi)] font-bold uppercase tracking-wider text-[11px]">
                                    Items ({totalItemsCount})
                                  </span>
                                  <span className="text-[var(--text-lo)]">
                                    {readyItemsCount}/{totalItemsCount} Ready
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <div className="w-20 h-1.5 bg-[var(--surface-hi)] rounded-full overflow-hidden border border-[var(--border)]">
                                    <div
                                      className={`h-full transition-all duration-300 rounded-full ${
                                        isAllItemsReady ? "bg-emerald-500" : "bg-[var(--gold)]"
                                      }`}
                                      style={{ width: `${itemProgressPercent}%` }}
                                    />
                                  </div>
                                  {isAllItemsReady && (
                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-600/30">
                                      ALL READY
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Structured, Fully Legible Items & Modifiers List */}
                              <div className="space-y-2 max-h-72 overflow-y-auto pr-1.5 custom-scrollbar">
                                {itemsStatus.map((item, idx) => {
                                  const isItemReady = item.status === "ready";
                                  const isItemCooking = item.status === "cooking";
                                  const ticketItem =
                                    ticket.items?.[idx] ||
                                    ticket.items?.find(
                                      (ti: any) => (ti.id && ti.id === item.item_id) || ti.name === item.name
                                    );

                                  const {
                                    variantName,
                                    modifierPills,
                                    instructionTags,
                                    customCookingNote,
                                  } = extractItemModifiersAndNotes(item, ticketItem);

                                  return (
                                    <div
                                      key={item.item_id || idx}
                                      onClick={() => {
                                        if (isTicketLocked) {
                                          if (isCompleted) {
                                            showToast(`🔒 Order #${ticket.id} is already completed. Items cannot be changed.`);
                                          } else {
                                            showToast(`🛑 Order #${ticket.id} is expired. Cooking cannot be started.`);
                                          }
                                          return;
                                        }
                                        handleUpdateItemStatus(ticket.id, item.item_id);
                                      }}
                                      className={`p-2.5 rounded-xl border text-xs font-mono transition-all select-none space-y-1.5 ${
                                        isTicketLocked
                                          ? "opacity-75 cursor-not-allowed bg-[var(--surface)] text-[var(--text-faint)] border-[var(--border)]"
                                          : isItemReady
                                          ? "cursor-pointer bg-emerald-950/25 text-emerald-200 border-emerald-600/40 opacity-85 shadow-2xs"
                                          : isItemCooking
                                          ? "cursor-pointer bg-amber-950/25 text-amber-200 border-amber-500/50 ring-1 ring-amber-500/20 shadow-2xs"
                                          : "cursor-pointer bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] text-[var(--text-hi)] border-[var(--border)] hover:border-[var(--gold)]/40 shadow-2xs"
                                      }`}
                                      role="button"
                                      tabIndex={isTicketLocked ? -1 : 0}
                                      title={
                                        isTicketLocked
                                          ? isCompleted
                                            ? "Order Completed - All items locked"
                                            : "Order Expired - Locked"
                                          : "Click to toggle item preparation status"
                                      }
                                    >
                                      {/* Main Item Row: Checkbox + Qty + Name + Variant + Prep Timer */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          {/* Status checkbox indicator */}
                                          <span
                                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 font-bold ${
                                              isItemReady
                                                ? "bg-emerald-500 text-stone-950 font-black shadow-2xs"
                                                : isItemCooking
                                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse"
                                                : "bg-[var(--surface)] text-[var(--text-lo)] border border-[var(--border)]"
                                            }`}
                                          >
                                            {isItemReady ? "✓" : isItemCooking ? "🔥" : ""}
                                          </span>

                                          {/* Quantity */}
                                          <span className="font-mono font-black text-sm text-[var(--gold)] shrink-0">
                                            {item.quantity}x
                                          </span>

                                          {/* Item Name */}
                                          <span
                                            className={`font-bold text-xs sm:text-[13px] text-[var(--text-hi)] leading-snug break-words ${
                                              isItemReady ? "line-through opacity-75" : ""
                                            }`}
                                          >
                                            {item.name}
                                          </span>

                                          {/* Variant Tag */}
                                          {variantName && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--gold)] shrink-0">
                                              {variantName}
                                            </span>
                                          )}
                                        </div>

                                        {/* Prep Time or Status Badge */}
                                        <div className="shrink-0 flex items-center gap-1">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase tracking-wider ${
                                              isItemReady
                                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                                : isItemCooking
                                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                                : "text-[var(--text-faint)] bg-[var(--surface)] border border-[var(--border)]"
                                            }`}
                                          >
                                            {isItemReady ? "Ready" : isItemCooking ? "Cooking" : `${item.prep_time_minutes || 15}m`}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Sub-Badges Row: Modifiers & Dietary / Exclusion Tags */}
                                      {(modifierPills.length > 0 || instructionTags.length > 0) && (
                                        <div className="flex flex-wrap items-center gap-1.5 pl-6 pt-0.5">
                                          {/* Modifiers (e.g. extra sauce, extra cheese, dip) */}
                                          {modifierPills.map((mod, mIdx) => (
                                            <span
                                              key={mIdx}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface)] text-[var(--text-hi)] border border-[var(--border)] text-[10.5px] font-mono font-medium shadow-2xs"
                                            >
                                              <span className="text-[var(--gold)] font-bold">+</span>
                                              <span>{mod}</span>
                                            </span>
                                          ))}

                                          {/* Instruction Tags (e.g. ⚠️ NUT ALLERGY, 🚫 NO ONION, 🌶️ EXTRA SPICY, 🌱 VEGAN) */}
                                          {instructionTags.map((tag, tIdx) => (
                                            <span
                                              key={tIdx}
                                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-2xs ${tag.className}`}
                                            >
                                              <span>{tag.badge}</span>
                                              <span>{tag.label}</span>
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Special Instructions & Custom Cooking Notes (Fully legible, wraps cleanly without ellipses) */}
                                      {customCookingNote && (
                                        <div className="ml-6 flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200/95 text-[11px] font-mono leading-relaxed break-words shadow-2xs">
                                          <span className="font-bold text-amber-400 shrink-0">📝 Note:</span>
                                          <span className="break-words flex-1 font-medium">{customCookingNote}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Compact Inline Alerts: Order-level Allergy, Chef Notes, Delivery ETA */}
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono pt-1">
                                {hasAllergies && (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-200 font-black animate-pulse">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <span className="break-words">Order Allergy Alert: {ticketAllergies.map((a) => a.warning).join(", ")}</span>
                                  </div>
                                )}

                                {chefNotesText && (
                                  <div className="inline-flex items-start gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] border border-[var(--gold)]/40 text-[var(--gold)]">
                                    <span className="font-black shrink-0">Order Note:</span>
                                    <span className="break-words leading-tight">{chefNotesText}</span>
                                  </div>
                                )}

                                {isDelivery && (
                                  <div className="inline-flex items-center gap-1 text-[var(--text-lo)] bg-[var(--surface-hi)]/60 px-2 py-0.5 rounded border border-[var(--border)]">
                                    <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="break-words">
                                      {ticket.delivery_area || ticket.deliveryArea || ticket.delivery_address || "Delivery"}
                                    </span>
                                    {ticket.rider_name && (
                                      <span className="text-emerald-400 font-semibold">• Rider: {ticket.rider_name}</span>
                                    )}
                                  </div>
                                )}

                                {isRiderDelayed && (
                                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-600/30">
                                    <span>⚠️ Rider waiting {riderWaitDisplayMin}m</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Zone 3: Workflow Action Buttons (End Content) */}
                            <div className="shrink-0 flex items-center justify-between lg:justify-end gap-2 flex-wrap lg:flex-nowrap min-w-0 lg:w-56 xl:w-64 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border)]/50 relative z-1">
                              {isVoided ? (
                                <div className="flex items-center gap-2 w-full lg:w-auto">
                                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/40 flex items-center gap-1.5 shadow-2xs">
                                    <Ban className="w-3.5 h-3.5 text-red-400" />
                                    <span>Voided Order</span>
                                  </span>
                                </div>
                              ) : isExpired ? (
                                <div className="flex items-center gap-2 w-full lg:w-auto">
                                  <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-1.5 animate-pulse">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Expired (4h Cutoff)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAdvanceTicket(ticket.id, "archived")}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-mono font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all shadow-xs hover:scale-105 active:scale-95"
                                    title="Move expired order to archive"
                                  >
                                    <Archive className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Archive</span>
                                  </button>
                                </div>
                              ) : isCompleted ? (
                                canReopenCompleted ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAdvanceTicket(ticket.id, "preparing")}
                                    className="w-full lg:w-auto px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] text-[var(--text-hi)] border border-[var(--border)] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all font-mono"
                                    title="Re-open ticket (available within 2 hours of completion)"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Re-open Ticket</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5 w-full lg:w-auto">
                                    {wasExpired || isPast4HourCutoff ? (
                                      <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                                        <Archive className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Archived (Expired)</span>
                                      </span>
                                    ) : (
                                      <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-zinc-500/15 text-zinc-400 border border-zinc-700/40 flex items-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-zinc-400" />
                                        <span>Completed (Locked)</span>
                                      </span>
                                    )}
                                  </div>
                                )
                              ) : isStale ? (
                                <div className="flex items-center gap-1.5 w-full lg:w-auto">
                                  <button
                                    type="button"
                                    disabled={true}
                                    className="px-2.5 py-1.5 rounded-xl text-xs font-mono opacity-50 bg-[var(--surface)] text-[var(--text-faint)] border border-[var(--border)] cursor-not-allowed"
                                  >
                                    Expired
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdvanceTicket(ticket.id, "archived")}
                                    className="px-3 py-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] text-[var(--text-hi)] border border-[var(--border)] font-mono font-semibold text-xs cursor-pointer flex items-center gap-1"
                                  >
                                    <Archive className="w-3 h-3 text-[var(--text-lo)]" />
                                    <span>Archive</span>
                                  </button>
                                </div>
                              ) : isReady ? (
                                isPickedUp ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAdvanceTicket(ticket.id, "completed")}
                                    className="w-full lg:w-auto px-3.5 py-2 rounded-xl font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all bg-emerald-950/40 text-emerald-300 border border-emerald-600/30 hover:bg-emerald-900/40 font-mono"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Picked Up (Archive)</span>
                                  </button>
                                ) : isWaitingPickup ? (
                                  <div className="flex items-center gap-1.5 w-full lg:w-auto">
                                    <button
                                      type="button"
                                      onClick={() => handleHandToWaiter(ticket.id)}
                                      className="flex-1 lg:flex-none px-2.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] text-[var(--text-hi)] border border-[var(--border)] font-semibold text-xs cursor-pointer flex items-center justify-center gap-1 transition-all font-mono"
                                      title="Re-send alert notification"
                                    >
                                      {isDelivery ? <Bike className="w-3.5 h-3.5" /> : isTakeaway ? <ShoppingBag className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                                      <span>Alert</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAdvanceTicket(ticket.id, "completed")}
                                      className="flex-1 lg:flex-none px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 font-bold text-xs cursor-pointer flex items-center justify-center gap-1 font-mono shadow-sm"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>Handed</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleHandToWaiter(ticket.id)}
                                    className="w-full lg:w-auto px-4 py-2 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all bg-[#d4a373] hover:bg-[#c39263] text-stone-950 shadow-md font-mono"
                                  >
                                    {isDelivery ? <Bike className="w-3.5 h-3.5 stroke-[2.5]" /> : isTakeaway ? <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" /> : <Bell className="w-3.5 h-3.5 stroke-[2.5]" />}
                                    <span>{channelInfo.actionText}</span>
                                  </button>
                                )
                              ) : isPaused || ticket.status === "paused" ? (
                                <button
                                  type="button"
                                  onClick={() => handleResumeTicket(ticket.id)}
                                  className="w-full lg:w-auto px-4 py-2 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md font-mono"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current stroke-[2.5]" />
                                  <span>Resume</span>
                                </button>
                              ) : ticket.status === "preparing" ? (
                                <div className="flex items-center gap-1.5 w-full lg:w-auto">
                                  {isAllItemsReady ? (
                                    <button
                                      type="button"
                                      onClick={() => handleAdvanceTicket(ticket.id, "ready")}
                                      className="flex-1 lg:flex-none px-3.5 py-2 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 font-mono shadow-sm"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>Ready (Pass)</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAdvanceTicket(ticket.id, "ready")}
                                      className="flex-1 lg:flex-none px-3 py-2 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all bg-[#d4a373]/80 hover:bg-[#d4a373] text-stone-950 font-mono"
                                      title="Mark ticket ready for pass"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                      <span>Mark Ready</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPauseModal(ticket)}
                                    className="px-2.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] text-[var(--text-hi)] border border-[var(--border)] font-semibold text-xs cursor-pointer flex items-center justify-center gap-1 font-mono"
                                    title="Pause cooking ticket"
                                  >
                                    <Pause className="w-3 h-3 fill-[var(--text-lo)]" />
                                    <span className="hidden xl:inline">Pause</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceTicket(ticket.id, "preparing")}
                                  className="w-full lg:w-auto px-4 py-2 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all bg-[#d4a373] hover:bg-[#c39263] text-stone-950 shadow-md font-mono"
                                >
                                  <Flame className="w-3.5 h-3.5" />
                                  <span>Start Cooking</span>
                                </button>
                              )}

                              {/* Manager Void Button (compact) */}
                              {isManager && !isCompleted && !isVoided && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenVoidModal(ticket)}
                                  className="p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-rose-400 border border-[var(--border)] hover:border-rose-500/40 transition-all cursor-pointer"
                                  title="Manager: Void Order"
                                >
                                  <Ban className="w-3.5 h-3.5 text-rose-400/80" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 80mm Thermal KOT Print Preview Modal */}
      <KotPrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPreviewTicket(null);
        }}
        ticket={previewTicket}
        onPrintSuccess={handlePrintSuccess}
        onPrintFailed={handlePrintFailed}
      />

      {/* ⏸️ Requirement 4: Pause Cooking Reason Modal */}
      {isPauseModalOpen && pauseTargetTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClosePauseModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-modal-title"
            className="w-full max-w-md bg-[#181611] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Pause className="w-4 h-4 fill-amber-400/30" />
                  </div>
                  <h3 id="pause-modal-title" className="font-display font-black text-lg text-[var(--text-hi)]">
                    Pause Cooking Order
                  </h3>
                </div>
                <p className="text-xs font-mono text-[var(--text-faint)]">
                  Ticket #{pauseTargetTicket.id} • {pauseTargetTicket.tableOrChannel || "Takeaway"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClosePauseModal}
                className="text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 rounded-lg transition-colors cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-lo)] font-bold block">
                Select Reason to Pause:
              </label>
              <div className="space-y-2">
                {[
                  { id: "Out of Stock", label: "Out of Stock", desc: "Ingredients or side items currently out of stock" },
                  { id: "Waiting for Ingredient", label: "Waiting for Ingredient", desc: "Prep line waiting on fresh batch, stock, or prep" },
                  { id: "Customer Requested", label: "Customer Requested", desc: "Guest requested delay or modification" },
                  { id: "Other", label: "Other", desc: "Specify custom kitchen reason below" },
                ].map((opt) => {
                  const isSelected = selectedPauseReason === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => setSelectedPauseReason(opt.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${isSelected
                          ? "bg-amber-500/15 border-amber-500/60 text-amber-200 shadow-sm"
                          : "bg-[var(--surface-hi)]/40 hover:bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                        }`}
                    >
                      <input
                        type="radio"
                        name="pauseReason"
                        value={opt.id}
                        checked={isSelected}
                        onChange={() => setSelectedPauseReason(opt.id)}
                        className="mt-1 accent-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-mono text-xs font-bold ${isSelected ? "text-amber-300" : "text-[var(--text-hi)]"}`}>
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-[var(--text-faint)]">
                          {opt.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {selectedPauseReason === "Other" && (
                <div className="pt-2 space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[11px] font-mono text-[var(--text-faint)] uppercase font-semibold">
                    Enter Free Text Reason:
                  </label>
                  <input
                    type="text"
                    value={customPauseReason}
                    onChange={(e) => setCustomPauseReason(e.target.value)}
                    placeholder="e.g. Equipment cleaning, chef swap, wait for manager..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-amber-400 font-mono shadow-inner"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleClosePauseModal}
                className="flex-1 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-mono font-bold text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalReason =
                    selectedPauseReason === "Other"
                      ? customPauseReason.trim() || "Other"
                      : selectedPauseReason;
                  handlePauseTicket(pauseTargetTicket.id, finalReason);
                }}
                disabled={selectedPauseReason === "Other" && !customPauseReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-mono font-black text-xs cursor-pointer transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Confirm Pause</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📦 Requirement 4: Item Removed Restock Confirm Dialog */}
      {restockConfirmModalData?.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restock-modal-title"
        >
          <div className="w-full max-w-md bg-[#181611] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 id="restock-modal-title" className="font-display font-black text-lg text-[var(--text-hi)]">
                    Item removed — restock ingredients?
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-faint)]">
                    Ticket #{restockConfirmModalData.ticketId} modified after cooking started
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelRestock}
                className="text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 rounded-lg transition-colors cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 font-mono">
              <p className="text-xs text-[var(--text-lo)]">
                The following item(s) were removed from ticket #{restockConfirmModalData.ticketId} after cooking commenced:
              </p>
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                {restockConfirmModalData.removedItems.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-bold text-amber-200">
                    <span>• {it.qty}x {it.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wider">
                      Removed
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-faint)]">
                Would you like to return raw ingredients back into inventory stock?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[var(--border)] font-mono">
              <button
                type="button"
                onClick={handleCancelRestock}
                className="flex-1 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-bold text-xs cursor-pointer transition-all"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmRestock}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs cursor-pointer transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Yes, Restock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ❌ Requirement 5: Void Order Modal (Manager Role Only) */}
      {isVoidModalOpen && voidTargetTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseVoidModal();
          }}
        >
          <div className="w-full max-w-md bg-[#181611] border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <Ban className="w-4 h-4" />
                  </div>
                  <h3 id="void-modal-title" className="font-display font-black text-lg text-[var(--text-hi)]">
                    Void Kitchen Ticket
                  </h3>
                </div>
                <p className="text-xs font-mono text-[var(--text-faint)]">
                  Ticket #{voidTargetTicket.id} • {voidTargetTicket.tableOrChannel || "Takeaway"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseVoidModal}
                className="text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 rounded-lg transition-colors cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs font-mono space-y-1">
                <div className="font-black flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>MANAGER AUTHORIZATION REQUIRED</span>
                </div>
                <p className="text-[11px] text-rose-200/80">
                  Voiding will mark this ticket as VOIDED, remove it from active queue, and automatically reverse inventory deduction if deducted.
                </p>
              </div>

              <label className="text-xs font-mono uppercase tracking-wider text-[var(--text-lo)] font-bold block pt-1">
                Select Void Reason:
              </label>
              <div className="space-y-2">
                {VOID_REASONS.map((opt) => {
                  const isSelected = selectedVoidReason === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => setSelectedVoidReason(opt.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${isSelected
                          ? "bg-rose-500/15 border-rose-500/60 text-rose-200 shadow-sm"
                          : "bg-[var(--surface-hi)]/40 hover:bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                        }`}
                    >
                      <input
                        type="radio"
                        name="voidReason"
                        value={opt.id}
                        checked={isSelected}
                        onChange={() => setSelectedVoidReason(opt.id)}
                        className="mt-1 accent-rose-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-mono text-xs font-bold ${isSelected ? "text-rose-300" : "text-[var(--text-hi)]"}`}>
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-[var(--text-faint)]">
                          {opt.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {selectedVoidReason === "Other" && (
                <div className="pt-2 space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[11px] font-mono text-[var(--text-faint)] uppercase font-semibold">
                    Enter Custom Void Reason:
                  </label>
                  <input
                    type="text"
                    value={customVoidReason}
                    onChange={(e) => setCustomVoidReason(e.target.value)}
                    placeholder="e.g. Guest walked out, mistake entry, chef burnt dish..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-rose-400 font-mono shadow-inner"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-[var(--border)] font-mono">
              <button
                type="button"
                onClick={handleCloseVoidModal}
                disabled={isVoidSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-bold text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoidTicket}
                disabled={isVoidSubmitting || (selectedVoidReason === "Other" && !customVoidReason.trim())}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs cursor-pointer transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isVoidSubmitting ? "Voiding..." : "Confirm Void"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strict Shift Rollover & Operational Handover Modal */}
      <StaffShiftRolloverModal
        isOpen={Boolean(isRolloverModalOpen && isShiftLocked && Date.now() >= shiftSnoozedUntil)}
        user={user}
        shiftValidation={shiftValidation}
        stationLabel="Kitchen Display Terminal"
        onRolloverSuccess={handleRolloverSuccess}
        onLogout={handleHandoverLogout}
        onRemindLater={handleRemindLater}
      />
    </div>
  );
}
