"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Receipt,
  X,
  ChevronDown,
  LayoutGrid,
  User,
  Phone,
  MapPin,
  UtensilsCrossed,
  ChefHat,
  Trash2,
  Clock,
  ArrowRight,
  AlertTriangle,
  Plus,
  Pencil,
  Check,
} from "lucide-react";
import { CartItem, TableStatus, OrderRecord } from "@/app/admin/types";
import { useAuth } from "@/app/admin/context/AuthContext";

interface OrderTicketPaneProps {
  isDrawer: boolean;
  onCloseDrawer?: () => void;
  cart: CartItem[];
  cartItemCount: number;
  handleUpdateCartQty: (itemId: string, delta: number, notes?: string) => void;
  onClearCart?: () => void;
  orderChannel: "dine_in" | "takeaway" | "delivery";
  setOrderChannel: (ch: "dine_in" | "takeaway" | "delivery") => void;
  selectedTable: number;
  handleSelectTable: (tableId: number, explicitRecall?: boolean) => void;
  displayTables: TableStatus[];
  selectedTableObj?: TableStatus;
  activeRunningOrder?: OrderRecord;
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  deliveryZone: string;
  setDeliveryZone: (val: string) => void;
  cartSubtotal: number;
  taxAmount: number;
  taxRatePercent: number;
  discountPercent: number;
  discountAmount: number;
  cartTotal: number;
  onOpenFloorModal: () => void;
  onSendToKitchen: () => void;
  onSettleAndPrint?: () => void;
  onProceedToPayment?: () => void;
  onHoldOrder?: () => void;
  paymentMethod?: "cash" | "card" | "raast" | "split";
  setPaymentMethod?: (pm: "cash" | "card" | "raast" | "split") => void;
  enableKitchenKds?: boolean;
  enableTableService?: boolean;
}

export default function OrderTicketPane({
  isDrawer,
  onCloseDrawer,
  cart,
  cartItemCount,
  handleUpdateCartQty,
  onClearCart,
  orderChannel,
  setOrderChannel,
  selectedTable,
  handleSelectTable,
  displayTables,
  selectedTableObj,
  activeRunningOrder,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  deliveryZone,
  setDeliveryZone,
  cartSubtotal,
  taxAmount,
  taxRatePercent,
  discountPercent,
  discountAmount,
  cartTotal,
  onOpenFloorModal,
  onSendToKitchen,
  onSettleAndPrint,
  onProceedToPayment,
  onHoldOrder,
  paymentMethod,
  setPaymentMethod,
  enableKitchenKds = true,
  enableTableService = true,
}: OrderTicketPaneProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showDeliveryErrors, setShowDeliveryErrors] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const addressInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isCustomerModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCustomerModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCustomerModalOpen]);

  const isDeliveryIncomplete =
    orderChannel === "delivery" &&
    (!customerName.trim() || !customerPhone.trim() || !deliveryZone.trim());

  const [isActionLocked, setIsActionLocked] = useState(false);

  const handleActionClick = async (callback?: () => void | Promise<void>) => {
    if (isActionLocked) return;
    if (orderChannel === "delivery" && isDeliveryIncomplete) {
      setShowDeliveryErrors(true);
      setIsCustomerModalOpen(true);
      return;
    }
    if (callback) {
      setIsActionLocked(true);
      try {
        await callback();
      } finally {
        setTimeout(() => setIsActionLocked(false), 900);
      }
    }
  };

  const handleCustomerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDeliveryIncomplete) {
      setShowDeliveryErrors(true);
      return;
    }
    setIsCustomerModalOpen(false);
  };

  // Strict boolean check against active tenant / user feature entitlements
  const isKdsEnabled =
    enableKitchenKds === false || user?.enableKitchenKds === false
      ? false
      : user?.assignedFeatures && user.assignedFeatures.length > 0 && !user.assignedFeatures.some((f) => f.toUpperCase() === "KITCHEN" || f.toUpperCase() === "KDS")
      ? false
      : Boolean(user?.enableKitchenKds ?? enableKitchenKds ?? true);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden text-[var(--text-hi)]">
      {/* 1. Fixed Header & Channel Selector */}
      <div className="shrink-0 space-y-2 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="font-display font-black text-sm text-[var(--text-hi)] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[var(--gold)]" /> Active Order Ticket
          </span>
          <div className="flex items-center gap-2">
            {cart.length > 0 && onClearCart && (
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
              {cartItemCount} items
            </span>
            {isDrawer && onCloseDrawer && (
              <button
                type="button"
                onClick={onCloseDrawer}
                className="p-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--surface-mid)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] cursor-pointer transition-colors"
                aria-label="Close Order Ticket"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Order Channel Tabs */}
        <div className={`grid ${enableTableService ? "grid-cols-3" : "grid-cols-2"} gap-1 bg-[var(--surface-hi)] p-1 rounded-xl border border-[var(--border)] text-xs font-mono font-medium`}>
          {(enableTableService
            ? (["dine_in", "takeaway", "delivery"] as const)
            : (["takeaway", "delivery"] as const)
          ).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => {
                setOrderChannel(ch);
                if (ch === "delivery" && isDeliveryIncomplete) {
                  setShowDeliveryErrors(false);
                  setIsCustomerModalOpen(true);
                }
              }}
              className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer text-center capitalize ${orderChannel === ch
                  ? "btn-gold text-[#342c14] font-bold shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
            >
              {ch === "dine_in" ? "Dine-In" : ch === "takeaway" ? (enableTableService ? "Takeaway" : "Quick Counter") : "Delivery"}
            </button>
          ))}
        </div>

        {/* Dine-In: Single compact row for table select & Floor Grid */}
        {enableTableService && orderChannel === "dine_in" ? (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                {(() => {
                  const effectiveSelectedTable = displayTables.some((t) => t.id === selectedTable)
                    ? selectedTable
                    : displayTables.length > 0
                      ? displayTables[0].id
                      : selectedTable;
                  return (
                    <select
                      value={effectiveSelectedTable}
                      onChange={(e) => handleSelectTable(Number(e.target.value), true)}
                      className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] rounded-lg py-1.5 pl-2.5 pr-7 text-xs text-[var(--text-hi)] font-mono focus:border-[var(--gold)] focus:outline-none cursor-pointer truncate"
                    >
                      {displayTables.length === 0 ? (
                        <option value="" disabled>
                          No tables configured
                        </option>
                      ) : (
                        displayTables.map((t) => {
                          const isOccupied = t.status === "seated" || t.status === "occupied";
                          const isBilled = t.status === "billing";
                          const isReserved = t.status === "reserved";
                          const runningAmount = t.activeAmount;
                          const amountStr = runningAmount ? ` • Rs ${runningAmount.toLocaleString()}` : "";

                          const statusTag = isOccupied
                            ? `[OCCUPIED${amountStr}]`
                            : isBilled
                              ? `[BILLED${amountStr}]`
                              : isReserved
                                ? "[RESERVED]"
                                : "[AVAILABLE]";
                          return (
                            <option key={`${t.id}_${t.dbId || ""}`} value={t.id} className="bg-[#140c0c] text-[#f7f0dd]">
                              {t.label} ({t.capacity}s) — {statusTag}
                            </option>
                          );
                        })
                      )}
                    </select>
                  );
                })()}
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
              </div>

              <button
                type="button"
                onClick={onOpenFloorModal}
                className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-[var(--gold)] hover:text-[var(--text-hi)] bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/50 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                title="Open Floor Plan Grid"
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Grid</span>
              </button>
            </div>

            {/* Active Running Tab Recalled Notice (Only when occupied/billing) */}
            {selectedTableObj && (selectedTableObj.status === "seated" || selectedTableObj.status === "occupied" || selectedTableObj.status === "billing") && (
              <div className="p-2 rounded-lg bg-gradient-to-r from-red-500/15 via-amber-500/10 to-red-500/15 border border-red-500/30 flex items-center justify-between text-[11px] font-mono">
                <span className="text-red-300 truncate">
                  Tab: {selectedTableObj.label} {activeRunningOrder ? `(Rs ${activeRunningOrder.total.toLocaleString()})` : ""}
                </span>
                {activeRunningOrder && (
                  <button
                    type="button"
                    onClick={() => handleSelectTable(selectedTable, true)}
                    className="text-[10px] text-[var(--gold)] hover:underline shrink-0 ml-2 cursor-pointer"
                  >
                    Reload
                  </button>
                )}
              </div>
            )}
          </div>
        ) : orderChannel === "takeaway" ? (
          <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)]">
            <span className="font-mono text-[var(--text-faint)]">DISPATCH:</span>
            <span className="font-mono font-bold text-[var(--gold)]">
              Takeaway Pickup Counter
            </span>
          </div>
        ) : (
          /* Delivery Mode: Sleek Pop-up Trigger & Summary Badge (No permanent cluttered input fields) */
          <div className="pt-0.5">
            {customerName.trim() || customerPhone.trim() || deliveryZone.trim() ? (
              <div
                onClick={() => {
                  setShowDeliveryErrors(false);
                  setIsCustomerModalOpen(true);
                }}
                className={`p-2.5 rounded-xl bg-[var(--surface-hi)] border ${
                  isDeliveryIncomplete && showDeliveryErrors
                    ? "border-red-500/60 bg-red-50 dark:bg-red-950/20"
                    : "border-[var(--border)] hover:border-[var(--gold)]/50"
                } transition-all cursor-pointer group flex items-start justify-between gap-2 shadow-sm`}
                title="Click to edit customer details"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-hi)] font-medium">
                    <User className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                    <span className="font-bold truncate">
                      {customerName.trim() || (
                        <span className="text-red-400 font-normal italic">Name missing *</span>
                      )}
                    </span>
                    {customerPhone.trim() ? (
                      <span className="text-[var(--text-faint)] text-[11px] font-mono shrink-0">
                        • {customerPhone.trim()}
                      </span>
                    ) : (
                      <span className="text-red-400 text-[11px] font-normal italic shrink-0">
                        • Phone missing *
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-lo)] font-mono">
                    <MapPin className="w-3 h-3 text-[var(--gold)] shrink-0" />
                    <span className="truncate">
                      {deliveryZone.trim() || (
                        <span className="text-red-400 italic">Address missing *</span>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeliveryErrors(false);
                    setIsCustomerModalOpen(true);
                  }}
                  className="shrink-0 p-1.5 rounded-lg text-[var(--text-faint)] group-hover:text-[var(--gold)] hover:bg-white/5 transition-colors cursor-pointer"
                  title="Edit customer details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowDeliveryErrors(false);
                  setIsCustomerModalOpen(true);
                }}
                className={`w-full py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer text-xs font-semibold ${
                  showDeliveryErrors
                    ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-red-950/30 dark:border-red-500/60 dark:text-red-300"
                    : "bg-[var(--surface-hi)] border-[var(--border)] hover:border-[var(--gold)]/50 text-[var(--text-hi)] hover:bg-[var(--gold-dim)]"
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                <span>Add Customer Details</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Scrollable Middle Cart Container */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1.5 pr-1.5 my-2 divide-y divide-[var(--border)]">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6 border border-dashed border-[var(--border)] rounded-xl text-[var(--text-faint)] space-y-1 my-auto">
            <UtensilsCrossed className="w-6 h-6 text-[var(--text-faint)] opacity-60" />
            <p className="text-xs font-mono">Order cart is empty</p>
          </div>
        ) : (
          cart.map((c, index) => (
            <div
              key={`${c.item.id}-${c.notes || "standard"}-${index}`}
              className="flex items-center justify-between py-1.5 text-xs gap-2 first:pt-0"
            >
              <div className="flex-1 min-w-0 pr-1">
                <p className="font-medium text-[var(--text-hi)] truncate">{c.item.name}</p>
                <span className="text-[11px] text-[var(--text-lo)] font-mono">
                  Rs {c.item.price.toLocaleString()} each
                </span>
              </div>

              {/* Compact Quantity Controls & Delete Button */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center border border-[var(--border)] rounded-md bg-[var(--bg-deep)]">
                  <button
                    type="button"
                    onClick={() => handleUpdateCartQty(c.item.id, -1, c.notes)}
                    className="px-2 py-0.5 text-[var(--text-lo)] hover:text-[var(--text-hi)] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-1 text-xs font-semibold text-[var(--text-hi)] font-mono">
                    {c.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateCartQty(c.item.id, 1, c.notes)}
                    className="px-2 py-0.5 text-[var(--text-lo)] hover:text-[var(--text-hi)] cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <span className="font-semibold text-[var(--text-hi)] font-mono min-w-[55px] text-right">
                  Rs {(c.item.price * c.quantity).toLocaleString()}
                </span>

                <button
                  type="button"
                  onClick={() => handleUpdateCartQty(c.item.id, -c.quantity, c.notes)}
                  className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/20 transition-colors cursor-pointer ml-0.5"
                  title={`Remove ${c.item.name} from ticket`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Totals & Settlement Actions - Rigidly Fixed & Non-Scrollable */}
      <div className="shrink-0 mt-auto bg-[var(--bg-deep)] pt-2 border-t border-[var(--border)] space-y-1.5 text-xs pb-1">
        <div className="space-y-0.5 font-mono">
          <div className="flex items-center justify-between text-xs py-0.5 text-[var(--text-lo)]">
            <span>Subtotal</span>
            <span>Rs {cartSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs py-0.5 text-[var(--text-lo)]">
            <span>Sales Tax ({taxRatePercent}%)</span>
            <span>Rs {taxAmount.toLocaleString()}</span>
          </div>
          {discountPercent > 0 && (
            <div className="flex items-center justify-between text-[#25d366] text-xs py-0.5">
              <span>Discount ({discountPercent}%)</span>
              <span>- Rs {discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-bold text-[var(--gold)] py-1 border-t border-[var(--border)]">
            <span>Total Amount</span>
            <span>Rs {cartTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Stage 1: Order Building, Kitchen Dispatch & Table Hold Actions */}
        {(isKdsEnabled || orderChannel === "dine_in" || onHoldOrder) && (
          <div
            className={`grid ${
              isKdsEnabled && (orderChannel === "dine_in" || onHoldOrder)
                ? "grid-cols-2"
                : "grid-cols-1"
            } gap-2 pt-1`}
          >
            {isKdsEnabled && (
              <button
                type="button"
                disabled={cart.length === 0 || isActionLocked}
                onClick={() => handleActionClick(onSendToKitchen)}
                className="py-2.5 px-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--gold)]/40 hover:bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                title="Dispatch active ticket to kitchen display (KOT)"
              >
                <ChefHat className="w-4 h-4" />
                <span>{isActionLocked ? "Sending KOT..." : "Send KOT"}</span>
              </button>
            )}

            {(orderChannel === "dine_in" || onHoldOrder) && (
              <button
                type="button"
                disabled={cart.length === 0 || isActionLocked}
                onClick={() => handleActionClick(onHoldOrder)}
                className={`py-2.5 px-3 rounded-xl bg-white/80 dark:bg-[var(--surface-hi)] border border-amber-500/35 hover:border-amber-500/60 hover:bg-amber-500/10 text-amber-900 dark:text-amber-400 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] ${
                  !isKdsEnabled ? "w-full" : ""
                }`}
                title="Save open table check / hold order without paying immediately"
              >
                <Clock className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <span>Hold Order</span>
              </button>
            )}
          </div>
        )}

        {/* Stage 2: Final Payment Settlement (Opens Payment Settlement Modal) */}
        <div className="pt-0.5">
          <button
            type="button"
            disabled={cart.length === 0 || isActionLocked}
            onClick={() => handleActionClick(onProceedToPayment || onSettleAndPrint)}
            className="w-full btn-gold animate-sheen py-2.5 px-3 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            <Receipt className="w-3.5 h-3.5 text-[#241a0d]" />
            <span className="text-[#241a0d] tracking-wider font-bold text-xs uppercase">
              {isActionLocked ? "Opening Payment..." : "Proceed to Payment"}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#241a0d]" />
          </button>
        </div>
      </div>

      {/* 3. Focused Customer & Delivery Details Popup Modal (Rendered via Portal to document.body) */}
      {mounted && typeof document !== "undefined" && isCustomerModalOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-delivery-modal-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsCustomerModalOpen(false);
              }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 select-none"
            >
              <div className="w-full max-w-md bg-[#16120e] border border-[var(--border)] rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200 text-[var(--text-hi)]">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)]">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 id="customer-delivery-modal-title" className="text-sm font-bold text-[var(--text-hi)]">
                        Customer &amp; Delivery Details
                      </h3>
                      <p className="text-[10px] text-[var(--text-faint)] font-mono">
                        Required for delivery order dispatch &amp; receipt
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form Fields: Minimalist Asterisk Only, No Placeholders */}
                <form onSubmit={handleCustomerFormSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-lo)] flex items-center gap-1 font-medium">
                      <User className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Customer Name</span>
                      <span className="text-red-400 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                           e.preventDefault();
                           phoneInputRef.current?.focus();
                        }
                      }}
                      className={`w-full bg-[var(--surface-hi)] border ${
                        showDeliveryErrors && !customerName.trim()
                          ? "border-red-500 ring-1 ring-red-500/50 bg-red-50/80 dark:bg-red-950/20"
                          : "border-[var(--border)] focus:border-[var(--gold)]"
                      } rounded-xl py-2 px-3 text-xs text-[var(--text-hi)] font-mono focus:outline-none transition-colors`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-lo)] flex items-center gap-1 font-medium">
                      <Phone className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Phone Number</span>
                      <span className="text-red-400 font-bold">*</span>
                    </label>
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addressInputRef.current?.focus();
                        }
                      }}
                      className={`w-full bg-[var(--surface-hi)] border ${
                        showDeliveryErrors && !customerPhone.trim()
                          ? "border-red-500 ring-1 ring-red-500/50 bg-red-50/80 dark:bg-red-950/20"
                          : "border-[var(--border)] focus:border-[var(--gold)]"
                      } rounded-xl py-2 px-3 text-xs text-[var(--text-hi)] font-mono focus:outline-none transition-colors`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-mono text-[var(--text-lo)] flex items-center gap-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Delivery Address</span>
                      <span className="text-red-400 font-bold">*</span>
                    </label>
                    <textarea
                      ref={addressInputRef}
                      rows={2}
                      value={deliveryZone}
                      onChange={(e) => setDeliveryZone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (isDeliveryIncomplete) {
                            setShowDeliveryErrors(true);
                          } else {
                            setIsCustomerModalOpen(false);
                          }
                        }
                      }}
                      className={`w-full bg-[var(--surface-hi)] border ${
                        showDeliveryErrors && !deliveryZone.trim()
                          ? "border-red-500 ring-1 ring-red-500/50 bg-red-50/80 dark:bg-red-950/20"
                          : "border-[var(--border)] focus:border-[var(--gold)]"
                      } rounded-xl py-2 px-3 text-xs text-[var(--text-hi)] font-mono focus:outline-none transition-colors resize-none`}
                    />
                  </div>

                  {/* Footer / Cancel & Done Buttons */}
                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(false)}
                      className="py-2 px-3.5 rounded-xl text-xs font-medium text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isDeliveryIncomplete}
                      className="btn-gold py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                      title={isDeliveryIncomplete ? "Fill all required fields to proceed" : "Save customer details"}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
