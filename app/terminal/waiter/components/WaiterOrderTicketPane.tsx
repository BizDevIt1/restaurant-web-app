"use client";

import React from "react";
import {
  Utensils,
  UtensilsCrossed,
  Trash2,
  Send,
  LayoutGrid,
  ShoppingBag,
  AlertCircle,
  FileText,
  Receipt,
  ChevronDown,
} from "lucide-react";
import { CartItem, TableStatus } from "@/app/admin/types";

interface WaiterOrderTicketPaneProps {
  cart: CartItem[];
  onUpdateQty: (item: CartItem, delta: number) => void;
  onClearCart: () => void;
  orderChannel?: "dine_in" | "takeaway" | "delivery";
  setOrderChannel?: (ch: "dine_in" | "takeaway" | "delivery") => void;
  selectedTable: number;
  onSelectTable: (tableId: number) => void;
  tables: TableStatus[];
  onOpenFloorMatrix: () => void;
  tableNotes: string;
  setTableNotes: (notes: string) => void;
  cartSubtotal: number;
  salesTaxAmount?: number;
  taxRatePercent?: number;
  cartTotal: number;
  onSendToKitchen: () => void;
  isSendingKot: boolean;
}

export default function WaiterOrderTicketPane({
  cart,
  onUpdateQty,
  onClearCart,
  orderChannel = "dine_in",
  setOrderChannel,
  selectedTable,
  onSelectTable,
  tables,
  onOpenFloorMatrix,
  tableNotes,
  setTableNotes,
  cartSubtotal,
  salesTaxAmount = 0,
  taxRatePercent = 16,
  cartTotal,
  onSendToKitchen,
  isSendingKot,
}: WaiterOrderTicketPaneProps) {
  const currentTableObj = tables.find((t) => t.id === selectedTable);
  const totalItemCount = cart.reduce((acc, c) => acc + c.quantity, 0);

  const isCurrentTableOccupied = Boolean(
    orderChannel === "dine_in" &&
    currentTableObj &&
    (currentTableObj.status === "seated" ||
      currentTableObj.status === "occupied" ||
      currentTableObj.status === "billing" ||
      Boolean(currentTableObj.activeOrderId))
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-l border-[var(--border)] p-4 sm:p-5 select-none text-[var(--text-hi)]">
      {/* 1. Header: Active Order Ticket */}
      <div className="shrink-0 space-y-2 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="font-display font-black text-sm text-[var(--text-hi)] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[var(--gold)]" /> Active Order Ticket
          </span>

          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                title="Cancel & Clear Entire Order Ticket"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cancel Order</span>
              </button>
            )}
            <span className="text-[11px] font-mono text-[var(--text-faint)]">
              {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
            </span>
          </div>
        </div>

        {/* Order Channel Strictly Scoped to Dine-In Table Service */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs">
          <div className="flex items-center gap-2 font-bold">
            <Utensils className="w-3.5 h-3.5 text-amber-400" />
            <span>Dine-In Table Service</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 font-semibold text-amber-300">
            Table Order Only
          </span>
        </div>

        {/* Table Selector Dropdown + Grid button */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedTable}
                onChange={(e) => onSelectTable(Number(e.target.value))}
                className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] rounded-lg py-1.5 pl-2.5 pr-7 text-xs text-[var(--text-hi)] font-mono focus:border-[var(--gold)] focus:outline-none cursor-pointer truncate"
              >
                {tables.length === 0 ? (
                  <option value="" disabled>
                    No tables configured
                  </option>
                ) : (
                  tables.map((t) => {
                    const isOccupied =
                      t.status === "seated" ||
                      t.status === "occupied" ||
                      Boolean(t.activeOrderId);
                    const isBilled = t.status === "billing";
                    const isReserved = t.status === "reserved";
                    const runningAmount = t.activeAmount;
                    const amountStr = runningAmount
                      ? ` • Rs ${runningAmount.toLocaleString()}`
                      : "";

                    const statusTag = isOccupied
                      ? `[OCCUPIED${amountStr}]`
                      : isBilled
                      ? `[BILLED${amountStr}]`
                      : isReserved
                      ? "[RESERVED]"
                      : "[AVAILABLE]";

                    return (
                      <option
                        key={`${t.id}_${t.dbId || ""}`}
                        value={t.id}
                        className="bg-[#140c0c] text-[#f7f0dd]"
                      >
                        {t.label} ({t.capacity || 4}s) — {statusTag}
                      </option>
                    );
                  })
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
            </div>

            <button
              type="button"
              onClick={onOpenFloorMatrix}
              className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-[var(--gold)] hover:text-[var(--text-hi)] bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/50 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
              title="Open Floor Plan Grid"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Grid</span>
            </button>
          </div>

          {/* Occupied notification bar */}
          {isCurrentTableOccupied && currentTableObj && (
            <div className="p-2 rounded-lg border flex items-center justify-between text-[11px] font-mono bg-gradient-to-r from-red-500/15 via-amber-500/10 to-red-500/15 border-red-500/30 text-red-300">
              <span className="truncate font-bold flex items-center gap-1.5">
                <span>
                  🔒 OCCUPIED: {currentTableObj.label}{" "}
                  {currentTableObj.activeAmount
                    ? `(Rs ${currentTableObj.activeAmount.toLocaleString()})`
                    : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={onOpenFloorMatrix}
                className="text-[10px] text-[var(--gold)] hover:underline shrink-0 ml-2 cursor-pointer"
              >
                Reload
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Middle Cart Container - Matches POS & Admin Ticket Box */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1.5 pr-1.5 my-2 divide-y divide-[var(--border)]">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8 border border-dashed border-[var(--border)] rounded-xl text-[var(--text-faint)] space-y-1 my-auto">
            <UtensilsCrossed className="w-6 h-6 text-[var(--text-faint)] opacity-60 mb-1" />
            <p className="text-xs font-mono">Order cart is empty</p>
          </div>
        ) : (
          cart.map((c, index) => {
            const variantObj = c.selectedVariant || c.item.selectedVariant;
            const itemPrice = variantObj?.price ?? c.item.price;
            const lineTotal = itemPrice * c.quantity;

            return (
              <div
                key={`${c.item.id}-${variantObj?.id || "def"}-${index}`}
                className="flex items-center justify-between py-1.5 text-xs gap-2 first:pt-0"
              >
                <div className="flex-1 min-w-0 pr-1">
                  <p className="font-medium text-[var(--text-hi)] truncate">
                    {c.item.name}
                    {variantObj && (
                      <span className="text-[var(--text-lo)] font-normal text-[11px]">
                        {" "}({variantObj.name})
                      </span>
                    )}
                  </p>
                  <span className="text-[11px] text-[var(--text-lo)] font-mono">
                    Rs {itemPrice.toLocaleString()} each
                  </span>
                  {c.notes && (
                    <p className="text-[10px] text-amber-300/80 font-mono italic truncate">
                      Note: {c.notes}
                    </p>
                  )}
                </div>

                {/* Compact Quantity Controls & Delete Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center border border-[var(--border)] rounded-md bg-[var(--bg-deep)]">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(c, -1)}
                      className="px-2 py-0.5 text-[var(--text-lo)] hover:text-[var(--text-hi)] cursor-pointer"
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="px-1 text-xs font-semibold text-[var(--text-hi)] font-mono">
                      {c.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(c, 1)}
                      className="px-2 py-0.5 text-[var(--text-lo)] hover:text-[var(--text-hi)] cursor-pointer"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-semibold text-[var(--text-hi)] font-mono min-w-[55px] text-right">
                    Rs {lineTotal.toLocaleString()}
                  </span>

                  <button
                    type="button"
                    onClick={() => onUpdateQty(c, -c.quantity)}
                    className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/20 transition-colors cursor-pointer ml-0.5"
                    title={`Remove ${c.item.name} from ticket`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Kitchen Special Instructions / Notes */}
      <div className="shrink-0 pt-2 pb-1.5 border-t border-[var(--border)] space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-lo)]">
          <FileText className="w-3 h-3 text-[var(--gold)]" />
          <span>Chef Special Instructions:</span>
        </div>
        <input
          type="text"
          value={tableNotes}
          onChange={(e) => setTableNotes(e.target.value)}
          placeholder="e.g. Extra spicy, serve drinks first..."
          className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] text-xs text-[var(--text-hi)] placeholder:text-[var(--text-faint)] rounded-lg px-2.5 py-1.5 font-mono focus:outline-none transition-all"
        />
      </div>

      {/* 4. Totals & Send Action - Matches POS Ticket */}
      <div className="shrink-0 mt-auto bg-[var(--bg-deep)] pt-2 border-t border-[var(--border)] space-y-1.5 text-xs pb-1">
        <div className="space-y-0.5 font-mono">
          <div className="flex items-center justify-between text-xs py-0.5 text-[var(--text-lo)]">
            <span>Subtotal</span>
            <span className="text-[var(--text-hi)] font-bold">
              Rs {cartSubtotal.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs py-0.5 text-[var(--text-lo)]">
            <span>Sales Tax ({taxRatePercent}%)</span>
            <span className="text-[var(--text-hi)] font-bold">
              Rs {salesTaxAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-base font-bold text-[var(--gold)] py-1 border-t border-[var(--border)]">
            <span>Total Amount</span>
            <span>Rs {cartTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Primary Send to Kitchen Button */}
        <button
          type="button"
          disabled={cart.length === 0 || isSendingKot || isCurrentTableOccupied}
          onClick={onSendToKitchen}
          className={`w-full py-3 px-4 rounded-xl font-black font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
            cart.length === 0 || isSendingKot || isCurrentTableOccupied
              ? "bg-[var(--surface)] text-[var(--text-faint)] border border-[var(--border)] cursor-not-allowed opacity-60"
              : "btn-gold animate-sheen text-[#342c14] font-bold shadow-[0_4px_20px_rgba(227,177,59,0.35)]"
          }`}
        >
          {isCurrentTableOccupied ? (
            <>
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 font-bold">
                Table Occupied — Choose Available
              </span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>
                {isSendingKot
                  ? "Sending to Kitchen..."
                  : "Send Order to Kitchen (KOT)"}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
