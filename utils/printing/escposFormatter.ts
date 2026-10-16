/**
 * ESC/POS Byte Command Formatter for 80mm Thermal Receipt Printers
 * Standard 80mm roll width: 42-48 columns (Font A)
 */

import { KitchenTicket } from "@/app/admin/types";

export interface EscPosFormattingOptions {
  restaurantName?: string;
  branchName?: string;
  reprintCount?: number;
  deliveryAddress?: string;
  chefNotes?: string;
}

// ESC/POS Command Byte Constants
export const ESC_POS_COMMANDS = {
  INIT: [0x1b, 0x40], // ESC @
  ALIGN_LEFT: [0x1b, 0x61, 0x00], // ESC a 0
  ALIGN_CENTER: [0x1b, 0x61, 0x01], // ESC a 1
  ALIGN_RIGHT: [0x1b, 0x61, 0x02], // ESC a 2
  FONT_NORMAL: [0x1d, 0x21, 0x00], // GS ! 0
  FONT_LARGE: [0x1d, 0x21, 0x11], // GS ! 0x11 (2x width + 2x height)
  FONT_DOUBLE_HEIGHT: [0x1d, 0x21, 0x01], // GS ! 0x01
  FONT_DOUBLE_WIDTH: [0x1d, 0x21, 0x10], // GS ! 0x10
  BOLD_ON: [0x1b, 0x45, 0x01], // ESC E 1
  BOLD_OFF: [0x1b, 0x45, 0x00], // ESC E 0
  INVERT_ON: [0x1d, 0x42, 0x01], // GS B 1 (White on Black)
  INVERT_OFF: [0x1d, 0x42, 0x00], // GS B 0
  FEED_LINE: [0x0a], // LF
  CUT_PAPER: [0x1d, 0x56, 0x42, 0x00], // GS V 66 0 (Feed 4 lines & cut)
  BEEP: [0x1b, 0x42, 0x03, 0x02], // ESC B 3 2 (3 beeps)
};

const LINE_WIDTH = 42;

function padLine(left: string, right: string, width: number = LINE_WIDTH): string {
  const spaceNeeded = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(spaceNeeded) + right;
}

function divider(char: string = "-", width: number = LINE_WIDTH): string {
  return char.repeat(width);
}

/**
 * Format a Kitchen Order Ticket into binary ESC/POS byte commands for an 80mm thermal printer.
 */
export function formatTicketToEscPos(
  ticket: KitchenTicket,
  options: EscPosFormattingOptions = {}
): Uint8Array {
  const bytes: number[] = [];
  const textEncoder = new TextEncoder();

  const addBytes = (arr: number[]) => {
    bytes.push(...arr);
  };

  const addText = (text: string) => {
    const encoded = textEncoder.encode(text);
    for (let i = 0; i < encoded.length; i++) {
      bytes.push(encoded[i]);
    }
  };

  const addLine = (text: string = "") => {
    addText(text);
    addBytes(ESC_POS_COMMANDS.FEED_LINE);
  };

  const restName = (options.restaurantName || "RESTAURANT KITCHEN").toUpperCase();
  const isRush =
    (ticket.priority || "").toLowerCase() === "rush" ||
    (ticket.priority || "").toLowerCase() === "urgent";
  const reprintCount = options.reprintCount ?? ticket.reprint_count ?? 0;

  // 1. Initialize
  addBytes(ESC_POS_COMMANDS.INIT);

  // If rush, trigger printer audible buzzer
  if (isRush) {
    addBytes(ESC_POS_COMMANDS.BEEP);
  }

  // 2. Restaurant Name (Large font, centered)
  addBytes(ESC_POS_COMMANDS.ALIGN_CENTER);
  addBytes(ESC_POS_COMMANDS.FONT_LARGE);
  addBytes(ESC_POS_COMMANDS.BOLD_ON);
  addLine(restName);

  if (options.branchName) {
    addBytes(ESC_POS_COMMANDS.FONT_NORMAL);
    addBytes(ESC_POS_COMMANDS.BOLD_OFF);
    addLine(options.branchName.toUpperCase());
  }

  addBytes(ESC_POS_COMMANDS.FONT_NORMAL);
  addBytes(ESC_POS_COMMANDS.BOLD_ON);
  addLine("*** KITCHEN ORDER TICKET (KOT) ***");
  addBytes(ESC_POS_COMMANDS.BOLD_OFF);
  addLine(divider("="));

  // 3. KOT Number, Date, Time
  addBytes(ESC_POS_COMMANDS.ALIGN_LEFT);
  addBytes(ESC_POS_COMMANDS.BOLD_ON);
  addBytes(ESC_POS_COMMANDS.FONT_DOUBLE_HEIGHT);
  addLine(`TICKET #: ${ticket.id}`);
  addBytes(ESC_POS_COMMANDS.FONT_NORMAL);
  addBytes(ESC_POS_COMMANDS.BOLD_OFF);

  const now = new Date();
  const dateStr = now.toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeStr = ticket.createdAt || now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  addLine(padLine(`DATE: ${dateStr}`, `TIME: ${timeStr}`));
  addLine(
    padLine(
      `ORDER: ${(ticket.orderType || "DINE_IN").toUpperCase()}`,
      `SERVER: ${ticket.serverName || "Cashier"}`
    )
  );

  if (ticket.station_assigned || ticket.station) {
    addLine(`STATION: ${String(ticket.station_assigned || ticket.station).toUpperCase()}`);
  }

  // Rush / Priority Banner
  if (isRush) {
    addBytes(ESC_POS_COMMANDS.ALIGN_CENTER);
    addBytes(ESC_POS_COMMANDS.INVERT_ON);
    addBytes(ESC_POS_COMMANDS.BOLD_ON);
    addLine("   *** URGENT / RUSH PRIORITY ***   ");
    addBytes(ESC_POS_COMMANDS.INVERT_OFF);
    addBytes(ESC_POS_COMMANDS.BOLD_OFF);
    addBytes(ESC_POS_COMMANDS.ALIGN_LEFT);
  } else if (ticket.priority && ticket.priority !== "normal") {
    addLine(`PRIORITY: ${ticket.priority.toUpperCase()}`);
  }

  addLine(divider("-"));

  // 4. Table Number or Delivery Address
  addBytes(ESC_POS_COMMANDS.BOLD_ON);
  addBytes(ESC_POS_COMMANDS.FONT_DOUBLE_HEIGHT);
  const dest = ticket.tableOrChannel || "Counter Takeaway";
  addLine(`DESTINATION: ${dest.toUpperCase()}`);
  addBytes(ESC_POS_COMMANDS.FONT_NORMAL);
  addBytes(ESC_POS_COMMANDS.BOLD_OFF);

  if (options.deliveryAddress) {
    addLine(`DELIVERY TO: ${options.deliveryAddress}`);
  }

  addLine(divider("="));

  // 5. Items Header
  addBytes(ESC_POS_COMMANDS.BOLD_ON);
  addLine(padLine("QTY  ITEM DESCRIPTION", "PREP"));
  addLine(divider("-"));
  addBytes(ESC_POS_COMMANDS.BOLD_OFF);

  // 6. Items with Quantities and Special Instructions Indented
  const items = ticket.items || [];
  for (const item of items) {
    const qty = Number(item.qty || (item as any).quantity || 1);
    const itemName = item.name || "Dish Item";
    const prepEstimate = item.prepTime || `${item.preparation_time || 15}m`;

    addBytes(ESC_POS_COMMANDS.BOLD_ON);
    addLine(padLine(`[${qty}x] ${itemName}`, prepEstimate));
    addBytes(ESC_POS_COMMANDS.BOLD_OFF);

    // Indented Special Instructions / Dish Notes
    if (item.notes && item.notes.trim()) {
      addLine(`     >> INSTRUCTION: ${item.notes.trim()}`);
    }
  }

  addLine(divider("-"));

  // 7. Chef Notes Section
  const combinedChefNotes =
    options.chefNotes ||
    items
      .map((it) => it.notes)
      .filter(Boolean)
      .join(" | ") ||
    "";

  addLine("CHEF NOTES / KITCHEN REMARKS:");
  if (combinedChefNotes.trim()) {
    addLine(`  * ${combinedChefNotes}`);
  } else {
    addLine("  * Standard kitchen preparation guidelines apply.");
  }

  if (ticket.estimatedPrepTime || ticket.estimated_prep_time) {
    addLine(`  * Target Delivery: ~${ticket.estimatedPrepTime || ticket.estimated_prep_time} mins`);
  }

  addLine(divider("-"));

  // 8. Footer Section
  addBytes(ESC_POS_COMMANDS.ALIGN_CENTER);
  if (reprintCount > 0) {
    addBytes(ESC_POS_COMMANDS.BOLD_ON);
    addLine(`*** REPRINT #${reprintCount} (${timeStr}) ***`);
    addBytes(ESC_POS_COMMANDS.BOLD_OFF);
  }

  addLine("*** KITCHEN ONLY - NO FINANCIAL VALUE ***");
  addBytes(ESC_POS_COMMANDS.FEED_LINE);
  addBytes(ESC_POS_COMMANDS.FEED_LINE);
  addBytes(ESC_POS_COMMANDS.FEED_LINE);

  // 9. Paper Cut
  addBytes(ESC_POS_COMMANDS.CUT_PAPER);

  return new Uint8Array(bytes);
}

/**
 * Format ticket as authentic 80mm monospace plain text for print preview modal & browser dialogs.
 */
export function formatTicketToPlainText(
  ticket: KitchenTicket,
  options: EscPosFormattingOptions = {}
): string {
  const lines: string[] = [];
  const restName = (options.restaurantName || "RESTAURANT KITCHEN").toUpperCase();
  const isRush =
    (ticket.priority || "").toLowerCase() === "rush" ||
    (ticket.priority || "").toLowerCase() === "urgent";
  const reprintCount = options.reprintCount ?? ticket.reprint_count ?? 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeStr = ticket.createdAt || now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  lines.push("==========================================");
  lines.push(centerText(restName));
  if (options.branchName) {
    lines.push(centerText(options.branchName.toUpperCase()));
  }
  lines.push(centerText("*** KITCHEN ORDER TICKET (KOT) ***"));
  lines.push("==========================================");

  lines.push(`TICKET #: ${ticket.id}`);
  lines.push(padLine(`DATE: ${dateStr}`, `TIME: ${timeStr}`));
  lines.push(
    padLine(
      `ORDER: ${(ticket.orderType || "DINE_IN").toUpperCase()}`,
      `SERVER: ${ticket.serverName || "Cashier"}`
    )
  );

  if (ticket.station_assigned || ticket.station) {
    lines.push(`STATION: ${String(ticket.station_assigned || ticket.station).toUpperCase()}`);
  }

  if (isRush) {
    lines.push("------------------------------------------");
    lines.push(centerText("*** URGENT / RUSH PRIORITY ***"));
    lines.push("------------------------------------------");
  } else if (ticket.priority && ticket.priority !== "normal") {
    lines.push(`PRIORITY: ${ticket.priority.toUpperCase()}`);
  }

  lines.push("------------------------------------------");
  const dest = ticket.tableOrChannel || "Counter Takeaway";
  lines.push(`DESTINATION: ${dest.toUpperCase()}`);
  if (options.deliveryAddress) {
    lines.push(`DELIVERY TO: ${options.deliveryAddress}`);
  }
  lines.push("==========================================");

  lines.push(padLine("QTY  ITEM SPECIFICATION", "PREP"));
  lines.push("------------------------------------------");

  const items = ticket.items || [];
  for (const item of items) {
    const qty = Number(item.qty || (item as any).quantity || 1);
    const itemName = item.name || "Dish Item";
    const prepEstimate = item.prepTime || `${item.preparation_time || 15}m`;

    lines.push(padLine(`[${qty}x] ${itemName}`, prepEstimate));
    if (item.notes && item.notes.trim()) {
      lines.push(`     >> INSTRUCTION: ${item.notes.trim()}`);
    }
  }

  lines.push("------------------------------------------");
  lines.push("CHEF NOTES / KITCHEN REMARKS:");

  const combinedChefNotes =
    options.chefNotes ||
    items
      .map((it) => it.notes)
      .filter(Boolean)
      .join(" | ") ||
    "";

  if (combinedChefNotes.trim()) {
    lines.push(`  * ${combinedChefNotes}`);
  } else {
    lines.push("  * Standard kitchen preparation guidelines apply.");
  }

  if (ticket.estimatedPrepTime || ticket.estimated_prep_time) {
    lines.push(`  * Target Delivery: ~${ticket.estimatedPrepTime || ticket.estimated_prep_time} mins`);
  }

  lines.push("------------------------------------------");
  if (reprintCount > 0) {
    lines.push(centerText(`*** REPRINT #${reprintCount} (${timeStr}) ***`));
  }
  lines.push(centerText("*** KITCHEN ONLY - NO FINANCIAL VALUE ***"));
  lines.push("==========================================");

  return lines.join("\n");
}

function centerText(text: string, width: number = LINE_WIDTH): string {
  if (text.length >= width) return text;
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text;
}
