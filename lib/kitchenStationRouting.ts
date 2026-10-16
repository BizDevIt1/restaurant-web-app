"use client";

import React from "react";
import {
  Flame,
  Utensils,
  Sparkles,
  Coffee,
  Layers,
  LayoutGrid,
  Sandwich,
  Soup,
} from "lucide-react";
import { KitchenTicket, CartItem, ItemVariant } from "@/app/admin/types";

export type KitchenStationType =
  | "all"
  | "grill"
  | "fry"
  | "pastry"
  | "beverages"
  | "assembly"
  | "desi"
  | "fast_food"
  | string;

export interface StationOption {
  id: KitchenStationType;
  label: string;
  shortCode: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  badgeBg: string;
  description: string;
}

export const STATION_OPTIONS: StationOption[] = [
  {
    id: "all",
    label: "All Stations",
    shortCode: "ALL",
    icon: LayoutGrid,
    colorClass: "text-[var(--gold)]",
    badgeBg: "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/30",
    description: "Full kitchen master overview (Head Chef)",
  },
  {
    id: "fast_food",
    label: "Fast Food",
    shortCode: "FF",
    icon: Sandwich,
    colorClass: "text-amber-400",
    badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    description: "Burgers, Sandwiches, Pizzas & Wraps",
  },
  {
    id: "desi",
    label: "Desi",
    shortCode: "DESI",
    icon: Soup,
    colorClass: "text-red-400",
    badgeBg: "bg-red-500/15 text-red-300 border-red-500/30",
    description: "Karahi, Handi, Biryani, Curries & Tandoor",
  },
  {
    id: "grill",
    label: "Grill",
    shortCode: "GRL",
    icon: Flame,
    colorClass: "text-orange-400",
    badgeBg: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    description: "BBQ, Steaks, Kebabs, Tikkas & Charcoals",
  },
  {
    id: "fry",
    label: "Fry",
    shortCode: "FRY",
    icon: Utensils,
    colorClass: "text-yellow-400",
    badgeBg: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    description: "Deep Fryers, Wings, Nuggets, Fries & Crispy",
  },
  {
    id: "pastry",
    label: "Pastry",
    shortCode: "PAS",
    icon: Sparkles,
    colorClass: "text-pink-400",
    badgeBg: "bg-pink-500/15 text-pink-300 border-pink-500/30",
    description: "Cakes, Desserts, Bakery & Sweet Treats",
  },
  {
    id: "beverages",
    label: "Beverages",
    shortCode: "BEV",
    icon: Coffee,
    colorClass: "text-cyan-400",
    badgeBg: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    description: "Hot & Cold Drinks, Shakes, Juices & Mocktails",
  },
  {
    id: "assembly",
    label: "Assembly",
    shortCode: "ASM",
    icon: Layers,
    colorClass: "text-emerald-400",
    badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    description: "Salads, Soups, Appetizers & Final Packing",
  },
];

/**
 * Normalizes user-input or database station identifiers to lowercase canonical names.
 */
export function normalizeStationName(station?: string | null): KitchenStationType {
  if (!station) return "assembly";
  const norm = String(station).toLowerCase().trim().replace(/[-\s]+/g, "_");
  if (norm === "fast_food" || norm === "fastfood" || norm === "fast_foods") return "fast_food";
  if (norm === "desi" || norm === "karahi" || norm === "tandoor") return "desi";
  if (norm === "grill" || norm === "bbq" || norm === "steak") return "grill";
  if (norm === "fry" || norm === "fryer" || norm === "fries") return "fry";
  if (norm === "pastry" || norm === "dessert" || norm === "bakery") return "pastry";
  if (norm === "beverages" || norm === "beverage" || norm === "drinks" || norm === "drink" || norm === "bar") return "beverages";
  if (norm === "assembly" || norm === "salad" || norm === "packing" || norm === "general") return "assembly";
  if (norm === "all") return "all";
  return norm;
}

/**
 * Formats badge details for a given kitchen station.
 */
export function getStationBadgeInfo(station: KitchenStationType | string) {
  const norm = normalizeStationName(station);
  switch (norm) {
    case "fast_food":
      return { label: "FAST FOOD", shortCode: "FF", icon: Sandwich, className: "bg-amber-500/15 text-amber-300 border-amber-500/30", colorClass: "text-amber-400" };
    case "desi":
      return { label: "DESI", shortCode: "DESI", icon: Soup, className: "bg-red-500/15 text-red-300 border-red-500/30", colorClass: "text-red-400" };
    case "grill":
      return { label: "GRILL", shortCode: "GRL", icon: Flame, className: "bg-orange-500/15 text-orange-400 border-orange-500/30", colorClass: "text-orange-400" };
    case "fry":
      return { label: "FRY", shortCode: "FRY", icon: Utensils, className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", colorClass: "text-yellow-400" };
    case "pastry":
      return { label: "PASTRY", shortCode: "PAS", icon: Sparkles, className: "bg-pink-500/15 text-pink-300 border-pink-500/30", colorClass: "text-pink-400" };
    case "beverages":
      return { label: "BEVERAGES", shortCode: "BEV", icon: Coffee, className: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", colorClass: "text-cyan-400" };
    case "assembly":
      return { label: "ASSEMBLY", shortCode: "ASM", icon: Layers, className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", colorClass: "text-emerald-400" };
    default:
      return { label: (station || "GENERAL").toUpperCase(), shortCode: "GEN", icon: Layers, className: "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)]", colorClass: "text-[var(--text-lo)]" };
  }
}

/**
 * Determines the kitchen station for a product or menu item.
 * Evaluates explicit configuration first, then heuristic analysis.
 */
export function getMenuItemStation(item: any): KitchenStationType {
  if (!item) return "assembly";

  // 1. Explicit station tag assigned in Menu Management or in item definition
  const explicit = (
    item.kitchen_station ||
    item.kitchenStation ||
    item.station ||
    item.station_assigned ||
    item.assigned_station ||
    item.item?.kitchen_station ||
    item.item?.kitchenStation ||
    item.item?.station ||
    ""
  ).toLowerCase().trim();

  if (explicit) {
    return normalizeStationName(explicit);
  }

  // 2. Intelligent inference from item name and category
  const name = String(item.name || item.item?.name || "").toLowerCase();
  const cat = String(item.category || item.item?.category || (item as any).category_name || "").toLowerCase();

  // Desi (Karahi, Handi, Biryani, Tandoor, Curries)
  if (
    cat.includes("desi") ||
    cat.includes("karahi") ||
    cat.includes("handi") ||
    cat.includes("biryani") ||
    cat.includes("tandoor") ||
    cat.includes("curry") ||
    name.includes("karahi") ||
    name.includes("handi") ||
    name.includes("biryani") ||
    name.includes("pulao") ||
    name.includes("daal") ||
    name.includes("dahl") ||
    name.includes("roti") ||
    name.includes("naan") ||
    name.includes("nihari") ||
    name.includes("haleem") ||
    name.includes("sajji") ||
    name.includes("chapli") ||
    name.includes("qorma") ||
    name.includes("korma") ||
    name.includes("butter chicken") ||
    name.includes("tikka masala")
  ) {
    return "desi";
  }

  // Fast Food (Burgers, Sandwiches, Pizza, Wraps, Rolls)
  if (
    cat.includes("fast_food") ||
    cat.includes("fast food") ||
    cat.includes("burger") ||
    cat.includes("pizza") ||
    cat.includes("sandwich") ||
    name.includes("burger") ||
    name.includes("zinger") ||
    name.includes("pizza") ||
    name.includes("sandwich") ||
    name.includes("wrap") ||
    name.includes("club sandwich") ||
    name.includes("shawarma") ||
    name.includes("hot dog") ||
    name.includes("sliders") ||
    name.includes("paratha roll")
  ) {
    return "fast_food";
  }

  // Grill / BBQ
  if (
    cat.includes("grill") ||
    cat.includes("bbq") ||
    cat.includes("steak") ||
    name.includes("grill") ||
    name.includes("bbq") ||
    name.includes("tikka") ||
    name.includes("boti") ||
    name.includes("kebab") ||
    name.includes("kabab") ||
    name.includes("seekh") ||
    name.includes("steak") ||
    name.includes("skewer") ||
    name.includes("charcoal") ||
    name.includes("chops") ||
    name.includes("ribs")
  ) {
    return "grill";
  }

  // Fryers / Crispy
  if (
    cat.includes("fry") ||
    cat.includes("crispy") ||
    name.includes("fries") ||
    name.includes("fried") ||
    name.includes("wings") ||
    name.includes("nuggets") ||
    name.includes("broast") ||
    name.includes("crispy") ||
    name.includes("tempura") ||
    name.includes("onion rings") ||
    name.includes("loaded fries")
  ) {
    return "fry";
  }

  // Pastry & Desserts
  if (
    cat.includes("dessert") ||
    cat.includes("pastry") ||
    cat.includes("bakery") ||
    cat.includes("sweet") ||
    name.includes("cake") ||
    name.includes("pie") ||
    name.includes("croissant") ||
    name.includes("donut") ||
    name.includes("cookie") ||
    name.includes("ice cream") ||
    name.includes("tart") ||
    name.includes("waffle") ||
    name.includes("pancake") ||
    name.includes("brownie") ||
    name.includes("halwa") ||
    name.includes("kheer") ||
    name.includes("gulab jamun") ||
    name.includes("pudding")
  ) {
    return "pastry";
  }

  // Beverages & Drinks
  if (
    cat.includes("beverage") ||
    cat.includes("drink") ||
    cat.includes("coffee") ||
    cat.includes("tea") ||
    name.includes("coffee") ||
    name.includes("tea") ||
    name.includes("chai") ||
    name.includes("juice") ||
    name.includes("soda") ||
    name.includes("shake") ||
    name.includes("smoothie") ||
    name.includes("water") ||
    name.includes("latte") ||
    name.includes("mojito") ||
    name.includes("coke") ||
    name.includes("pepsi") ||
    name.includes("sprite") ||
    name.includes("espresso") ||
    name.includes("frappe")
  ) {
    return "beverages";
  }

  // Assembly (Salads, Starters, Soups, Sauces)
  if (
    cat.includes("assembly") ||
    cat.includes("salad") ||
    cat.includes("appetizer") ||
    cat.includes("starter") ||
    cat.includes("soup") ||
    name.includes("salad") ||
    name.includes("soup") ||
    name.includes("raita") ||
    name.includes("chutney") ||
    name.includes("sauce") ||
    name.includes("appetizer")
  ) {
    return "assembly";
  }

  return "assembly";
}

/**
 * Checks whether an item belongs to a specific kitchen station.
 */
export function isItemForStation(item: any, station: KitchenStationType): boolean {
  if (station === "all") return true;
  const targetStation = normalizeStationName(station);
  const itemStation = getMenuItemStation(item);
  return itemStation === targetStation;
}

/**
 * Checks whether a kitchen ticket applies to a given station.
 */
export function isTicketApplicableToStation(
  ticket: any,
  station: KitchenStationType
): boolean {
  if (station === "all") return true;
  const targetStation = normalizeStationName(station);

  // 1. Check ticket level explicit station
  const explicit = normalizeStationName(ticket.station_assigned || ticket.station);
  if (explicit === targetStation) return true;

  // 2. Check if any items belong to the station
  if (ticket.items && Array.isArray(ticket.items)) {
    const hasItem = ticket.items.some((item: any) => isItemForStation(item, targetStation));
    if (hasItem) return true;
  }

  // 3. Fallback check for unassigned tickets mapping to assembly
  if (targetStation === "assembly") {
    if (!ticket.station_assigned && !ticket.station) return true;
  }

  return false;
}

/**
 * Filters the items in a ticket down to only those that belong to a designated station.
 */
export function filterTicketItemsForStation(items: any[], station: KitchenStationType): any[] {
  if (station === "all" || !items || !Array.isArray(items)) return items || [];
  const targetStation = normalizeStationName(station);
  return items.filter((item) => isItemForStation(item, targetStation));
}

export interface SplitOrderParams {
  orderId: string;
  baseKotId: string;
  cart: CartItem[];
  orderChannel: "dine_in" | "takeaway" | "delivery";
  tableIdentifier: string;
  serverName: string;
  priority?: string;
  tableNotes?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryZone?: string;
  restaurantId: string | number;
  branchId?: string | number | null;
}

export interface SplitOrderResult {
  tickets: KitchenTicket[];
  payloads: any[];
  stationCount: number;
  distinctStations: KitchenStationType[];
}

/**
 * Automatic Order Splitting on Send to KOT:
 * Groups mixed cart items by their target kitchen stations and generates
 * distinct, station-routed KDS tickets so that each station queue receives
 * only its designated items without requiring manual intervention.
 */
export function splitOrderIntoStationTickets(params: SplitOrderParams): SplitOrderResult {
  const {
    orderId,
    baseKotId,
    cart,
    orderChannel,
    tableIdentifier,
    serverName,
    priority = "normal",
    tableNotes = "",
    customerName,
    customerPhone,
    deliveryZone,
    restaurantId,
    branchId,
  } = params;

  // 1. Group cart items by their resolved kitchen station
  const stationGroups = new Map<KitchenStationType, CartItem[]>();

  for (const cartItem of cart) {
    const station = getMenuItemStation(cartItem.item || cartItem);
    if (!stationGroups.has(station)) {
      stationGroups.set(station, []);
    }
    stationGroups.get(station)!.push(cartItem);
  }

  const distinctStations = Array.from(stationGroups.keys());
  const isMultiStation = distinctStations.length > 1;

  const tickets: KitchenTicket[] = [];
  const payloads: any[] = [];
  const nowIso = new Date().toISOString();
  const nowTimeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // 2. Build dedicated station ticket for each group
  distinctStations.forEach((station) => {
    const groupItems = stationGroups.get(station)!;
    const badge = getStationBadgeInfo(station);
    const stationSuffix = badge.shortCode;

    // Use baseKotId if single station; append shortcode if multi-station
    const ticketId = isMultiStation ? `${baseKotId}-${stationSuffix}` : baseKotId;

    const dishPrepTimes = groupItems.map(
      (c) =>
        c.item.preparation_time ||
        parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
        15
    );
    const stationEstimatedPrepTime = Math.max(...dishPrepTimes, 15);

    const mappedItems = groupItems.map((c) => {
      const variantObj = c.selectedVariant || c.item.selectedVariant;
      const combinedNotes = [c.notes, tableNotes].filter(Boolean).join(" • ");
      return {
        id: c.item.id,
        name: c.item.name,
        category: c.item.category || "General",
        qty: c.quantity,
        notes: combinedNotes || "",
        modifiers: variantObj ? [variantObj.name] : [],
        prepTime: c.item.prepTime || "15m",
        preparation_time: c.item.preparation_time || 15,
        selectedVariant: variantObj,
        variant: variantObj,
        variant_id: variantObj?.id || null,
        variant_name: variantObj?.name || null,
        station,
        kitchen_station: station,
      };
    });

    const mappedItemsStatus = groupItems.map((c, idx) => {
      const variantObj = c.selectedVariant || c.item.selectedVariant;
      const notes = [c.notes, tableNotes, variantObj ? `Variant: ${variantObj.name}` : ""]
        .filter(Boolean)
        .join(" • ");
      const dishPrep =
        c.item.preparation_time ||
        parseInt(String(c.item.prepTime || "15").replace(/[^0-9]/g, "")) ||
        15;

      return {
        item_id: c.item.id || `${ticketId}-item-${idx}`,
        name: c.item.name,
        quantity: c.quantity,
        status: "waiting" as const,
        started_at: null,
        completed_at: null,
        prep_time_minutes: dishPrep,
        notes: notes || undefined,
        station,
      };
    });

    const ticket: KitchenTicket = {
      id: ticketId,
      dbId: undefined,
      ticket_number: ticketId,
      tableOrChannel: tableIdentifier,
      orderType: orderChannel,
      serverName: serverName || "Floor Server",
      elapsedMinutes: 0,
      status: "queued",
      estimatedPrepTime: stationEstimatedPrepTime,
      estimated_prep_time: stationEstimatedPrepTime,
      station_assigned: station,
      station,
      items: mappedItems,
      items_status: mappedItemsStatus,
      priority: priority as any,
      createdAt: nowTimeStr,
      created_at: nowIso,
      isDeducted: false,
      customer_name: customerName || tableIdentifier,
      customer_phone: customerPhone || null,
      delivery_area: deliveryZone || null,
    };

    const payload: any = {
      restaurant_id: restaurantId,
      branch_id: branchId || null,
      ticket_number: ticketId,
      table_number: tableIdentifier,
      channel: orderChannel,
      status: "queued",
      station_assigned: station,
      items: mappedItems,
      items_status: mappedItemsStatus,
      server_name: serverName || "Floor Server",
      priority,
      estimated_prep_time: stationEstimatedPrepTime,
      order_type: orderChannel,
      customer_name: customerName || tableIdentifier,
      customer_phone: customerPhone?.trim() || null,
      delivery_area: deliveryZone?.trim() || null,
      created_at: nowIso,
    };

    tickets.push(ticket);
    payloads.push(payload);
  });

  return {
    tickets,
    payloads,
    stationCount: distinctStations.length,
    distinctStations,
  };
}
