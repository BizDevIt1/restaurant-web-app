"use client";

import React from "react";
import { X, Clock, Play, Trash2, PauseCircle, ShoppingBag } from "lucide-react";
import { CartItem } from "@/app/admin/types";

export interface ParkedOrder {
  id: string;
  cart: CartItem[];
  orderChannel: "dine_in" | "takeaway" | "delivery";
  selectedTable?: number;
  customerName?: string;
  customerPhone?: string;
  deliveryZone?: string;
  total: number;
  timestamp: string;
  note?: string;
}

interface HoldOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  parkedOrders: ParkedOrder[];
  onRecallOrder: (parkedOrder: ParkedOrder) => void;
  onDiscardOrder: (orderId: string) => void;
}

export default function HoldOrdersDrawer({
  isOpen,
  onClose,
  parkedOrders,
  onRecallOrder,
  onDiscardOrder,
}: HoldOrdersDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-l border-[var(--border)] shadow-2xl p-5 flex flex-col animate-in slide-in-from-right duration-200 text-[var(--text-hi)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center">
              <PauseCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-hi)]">
                Parked / Held Orders
              </h3>
              <p className="text-[11px] font-mono text-[var(--text-lo)]">
                {parkedOrders.length} order{parkedOrders.length === 1 ? "" : "s"} on hold
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {parkedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 text-[var(--text-lo)] space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] flex items-center justify-center text-[var(--gold)] border border-[var(--border)]">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <p className="text-xs font-mono font-medium text-[var(--text-hi)]">No orders currently on hold</p>
              <p className="text-[11px] text-[var(--text-lo)] max-w-xs">
                Use the &quot;Hold Order&quot; button on active tickets to park orders temporarily while tending to other customers.
              </p>
            </div>
          ) : (
            parkedOrders.map((p) => {
              const itemCount = p.cart.reduce((sum, c) => sum + c.quantity, 0);

              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl glass-panel space-y-2.5 font-mono text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-[var(--gold)] text-sm">{p.id}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-lo)] mt-0.5">
                        <Clock className="w-3 h-3 text-[var(--gold)]" />
                        <span>{p.timestamp}</span>
                        <span>•</span>
                        <span className="capitalize">{p.orderChannel.replace("_", "-")}</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-[var(--text-hi)]">
                      Rs {p.total.toLocaleString()}
                    </span>
                  </div>

                  {/* Summary of items */}
                  <div className="text-[11px] text-[var(--text-lo)] line-clamp-2 bg-[var(--surface-hi)] p-2 rounded-lg border border-[var(--border)]">
                    {p.cart.map((c) => `${c.quantity}x ${c.item.name}`).join(", ")}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onDiscardOrder(p.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Discard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onRecallOrder(p);
                        onClose();
                      }}
                      className="btn-gold px-3.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Recall to Cart ({itemCount})</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-xs text-[var(--text-lo)] font-medium border border-[var(--border)] cursor-pointer text-center transition-colors"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </>
  );
}
