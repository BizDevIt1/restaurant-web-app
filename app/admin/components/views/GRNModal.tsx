"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  PackageCheck,
  AlertCircle,
  FileCheck2,
  Boxes,
  Truck,
  Hash,
  FileText,
  Calendar,
  Building2,
  Check,
  RefreshCw,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { PurchaseOrder, PurchaseOrderItem, RawMaterial } from "../../types";

export interface ReceivedItemInspection {
  raw_material_id?: number | string;
  name: string;
  unit: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_price: number;
  subtotal: number;
}

interface GRNModalProps {
  po: PurchaseOrder | null;
  rawMaterials: RawMaterial[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmInward: (
    po: PurchaseOrder,
    inspectedItems: ReceivedItemInspection[],
    challanNumber: string,
    receiverNotes: string
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export default function GRNModal({
  po,
  rawMaterials,
  isOpen,
  onClose,
  onConfirmInward,
  isSubmitting = false,
}: GRNModalProps) {
  const [inspectedItems, setInspectedItems] = useState<ReceivedItemInspection[]>([]);
  const [challanNumber, setChallanNumber] = useState("");
  const [receiverNotes, setReceiverNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize inspection list when PO changes
  useEffect(() => {
    if (!po) {
      setInspectedItems([]);
      setChallanNumber("");
      setReceiverNotes("");
      setFormError(null);
      return;
    }

    let rawItems = po.items;
    if (typeof rawItems === "string") {
      try {
        rawItems = JSON.parse(rawItems);
      } catch {
        rawItems = [];
      }
    }
    const safeItems = Array.isArray(rawItems) ? rawItems : [];

    const items: ReceivedItemInspection[] = safeItems.map((item: any) => {
      // Find matching inventory raw material if not already linked
      let matchedRmId = item.raw_material_id;
      if (!matchedRmId) {
        const itemClean = String(item.name || "").trim().toLowerCase();
        const found = rawMaterials.find((rm) => {
          const rmClean = String(rm.name || "").trim().toLowerCase();
          return rmClean === itemClean || rmClean.includes(itemClean) || itemClean.includes(rmClean);
        });
        if (found) matchedRmId = found.id;
      }

      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;

      return {
        raw_material_id: matchedRmId,
        name: item.name || "Item",
        unit: item.unit || "kg",
        ordered_quantity: qty,
        received_quantity: qty, // Prefilled with ordered quantity
        unit_price: price,
        subtotal: qty * price,
      };
    });

    setInspectedItems(items);
    setChallanNumber("");
    setReceiverNotes("");
    setFormError(null);
  }, [po, rawMaterials]);

  // Handle change in received quantity
  const handleQuantityChange = (index: number, newQty: number) => {
    setInspectedItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const safeQty = Math.max(0, isNaN(newQty) ? 0 : newQty);
      item.received_quantity = safeQty;
      item.subtotal = safeQty * item.unit_price;
      updated[index] = item;
      return updated;
    });
  };

  // Handle manual linking of inventory raw material
  const handleRawMaterialLink = (index: number, rmId: string) => {
    setInspectedItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.raw_material_id = rmId ? Number(rmId) : undefined;
      updated[index] = item;
      return updated;
    });
  };

  // Computed summary totals
  const totalOrderedAmount = useMemo(() => {
    return inspectedItems.reduce(
      (sum, item) => sum + item.ordered_quantity * item.unit_price,
      0
    );
  }, [inspectedItems]);

  const totalReceivedAmount = useMemo(() => {
    return inspectedItems.reduce(
      (sum, item) => sum + item.received_quantity * item.unit_price,
      0
    );
  }, [inspectedItems]);

  const hasVariance = useMemo(() => {
    return inspectedItems.some(
      (item) => item.received_quantity !== item.ordered_quantity
    );
  }, [inspectedItems]);

  const hasZeroTotalReceived = useMemo(() => {
    return inspectedItems.length > 0 && inspectedItems.every((item) => item.received_quantity <= 0);
  }, [inspectedItems]);

  // Submit GRN Confirmation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;

    if (po.status === "RECEIVED") {
      setFormError("This purchase order has already been marked as RECEIVED and inwarded.");
      return;
    }

    if (inspectedItems.length === 0) {
      setFormError("No items found in this purchase order to inward.");
      return;
    }

    if (hasZeroTotalReceived) {
      setFormError("At least one item must have a received quantity greater than 0.");
      return;
    }

    setFormError(null);
    await onConfirmInward(po, inspectedItems, challanNumber.trim(), receiverNotes.trim());
  };

  if (!isOpen || !po) return null;

  const orderDateFormatted = po.created_at
    ? new Date(po.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Recent";

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-4xl rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl font-sans max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* ========================================================================= */}
        {/* A. MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="p-5 sm:p-6 border-b border-[var(--border)] shrink-0 flex items-start justify-between gap-4 bg-[var(--surface-hi)]/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold tracking-wider uppercase mb-1">
                <FileCheck2 className="w-3 h-3" />
                <span>INWARD STOCK VERIFICATION</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--text-hi)] tracking-tight">
                Goods Received Note (GRN) Verification
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-lo)] mt-1 font-mono">
                <span className="flex items-center gap-1.5 text-[var(--gold)] font-bold">
                  <Hash className="w-3 h-3" />
                  <span>PO Number: {po.po_number}</span>
                </span>
                <span className="text-[var(--text-faint)]">•</span>
                <span className="flex items-center gap-1.5 text-[var(--text-hi)]">
                  <Building2 className="w-3 h-3 text-[var(--text-faint)]" />
                  <span>Supplier: {po.supplier_name}</span>
                </span>
                <span className="text-[var(--text-faint)]">•</span>
                <span className="flex items-center gap-1.5 text-[var(--text-faint)]">
                  <Calendar className="w-3 h-3" />
                  <span>Date: {orderDateFormatted}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm disabled:opacity-40"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* B. MODAL BODY (SCROLLABLE INSPECTION TABLE & NOTES) */}
        {/* ========================================================================= */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
            {formError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Delivery Slip & Notes Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 sm:p-5 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono">
            <div>
              <label className="block text-[var(--text-lo)] mb-1 font-semibold uppercase tracking-wider text-[10px]">
                Delivery Invoice / Challan Number <span className="text-[var(--text-faint)] font-normal">(Vendor Reference)</span>
              </label>
              <div className="relative">
                <FileText className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={challanNumber}
                  onChange={(e) => setChallanNumber(e.target.value)}
                  placeholder="e.g. INV-98240 or DC-410"
                  className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] pl-8 pr-3 py-2 text-[var(--text-hi)] text-xs focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[var(--text-lo)] mb-1 font-semibold uppercase tracking-wider text-[10px]">
                Receiver Inspection Notes <span className="text-[var(--text-faint)] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={receiverNotes}
                onChange={(e) => setReceiverNotes(e.target.value)}
                placeholder="e.g. Checked for freshness, packaging intact, temp OK"
                className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] px-3 py-2 text-[var(--text-hi)] text-xs focus:outline-none transition-all font-sans"
              />
            </div>
          </div>

          {/* Inspection Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-lo)] font-mono">
                <Boxes className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>Receiving Inspection Table ({inspectedItems.length} Items)</span>
              </div>
              {hasVariance && (
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Partial delivery detected</span>
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border)] overflow-hidden glass-panel shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[var(--text-faint)] uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Raw Material / Description</th>
                      <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                      <th className="py-2.5 px-3 text-right w-36">Received Qty</th>
                      <th className="py-2.5 px-3 text-right">Rate (Rs)</th>
                      <th className="py-2.5 px-3 text-right">Item Total (Rs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/40">
                    {inspectedItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--text-faint)]">
                          No line items found in this order.
                        </td>
                      </tr>
                    ) : (
                      inspectedItems.map((item, idx) => {
                        const isPartial = item.received_quantity < item.ordered_quantity;
                        const isOver = item.received_quantity > item.ordered_quantity;
                        const matchedMaterial = rawMaterials.find(
                          (rm) => String(rm.id) === String(item.raw_material_id)
                        );

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-3 text-[var(--text-faint)]">{idx + 1}</td>
                            
                            {/* Material Name & Unit */}
                            <td className="py-3 px-3">
                              <div className="font-sans font-bold text-[var(--text-hi)] text-xs">
                                {item.name}{" "}
                                <span className="font-mono text-[11px] font-normal text-[var(--gold)]">
                                  ({item.unit})
                                </span>
                              </div>

                              {/* Inventory Stock Attribution Indicator */}
                              <div className="mt-1">
                                {matchedMaterial ? (
                                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-sans">
                                    <Check className="w-3 h-3" />
                                    <span>
                                      Links to:{" "}
                                      <strong className="font-mono">{matchedMaterial.name}</strong>{" "}
                                      (Current Stock: {matchedMaterial.current_stock} {matchedMaterial.unit})
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-amber-400 font-sans flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>Link to inventory:</span>
                                    </span>
                                    <select
                                      value={item.raw_material_id || ""}
                                      onChange={(e) => handleRawMaterialLink(idx, e.target.value)}
                                      className="bg-[var(--surface)] border border-[var(--border)] text-[10px] text-[var(--text-hi)] rounded-md px-1.5 py-0.5 focus:border-[var(--gold)] focus:outline-none"
                                    >
                                      <option value="">-- Match Material --</option>
                                      {rawMaterials.map((rm) => (
                                        <option key={rm.id} value={rm.id}>
                                          {rm.name} ({rm.current_stock} {rm.unit})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Ordered Quantity */}
                            <td className="py-3 px-3 text-right text-[var(--text-lo)] font-bold">
                              {item.ordered_quantity}{" "}
                              <span className="text-[10px] font-normal text-[var(--text-faint)]">
                                {item.unit}
                              </span>
                            </td>

                            {/* Received Quantity Input */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.received_quantity}
                                  onChange={(e) =>
                                    handleQuantityChange(idx, parseFloat(e.target.value))
                                  }
                                  className={`w-24 text-right rounded-lg bg-[var(--surface-hi)] border px-2.5 py-1 text-xs font-bold text-[var(--text-hi)] focus:outline-none transition-all ${
                                    isPartial
                                      ? "border-amber-500/50 text-amber-300"
                                      : isOver
                                      ? "border-blue-500/50 text-blue-300"
                                      : "border-[var(--border)] focus:border-[var(--gold)]"
                                  }`}
                                />
                                <span className="text-[10px] text-[var(--text-faint)] w-6 text-left">
                                  {item.unit}
                                </span>
                              </div>
                            </td>

                            {/* Purchase Rate */}
                            <td className="py-3 px-3 text-right text-[var(--text-lo)]">
                              Rs {item.unit_price.toLocaleString()}
                            </td>

                            {/* Computed Subtotal */}
                            <td className="py-3 px-3 text-right font-bold text-[var(--text-hi)]">
                              Rs {item.subtotal.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Totals & Financial Summary Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] font-mono text-xs space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-[var(--text-lo)]">
              <span>Original Order Amount:</span>
              <span>Rs {totalOrderedAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold text-[var(--text-hi)] pt-2.5 border-t border-[var(--border)]">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>Total Net Stock Inward Value:</span>
              </span>
              <span className="text-base text-[var(--gold)]">
                Rs {totalReceivedAmount.toLocaleString()}
              </span>
            </div>
            {hasVariance && (
              <p className="text-[10px] text-amber-400 pt-1 font-sans">
                Notice: The inwarded stock total differs from the original PO amount due to adjusted received quantities.
              </p>
            )}
          </div>

          </div>

          {/* ========================================================================= */}
          {/* C. MODAL ACTIONS (DOCKED) */}
          {/* ========================================================================= */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[var(--bg-deep)]">
            <div className="text-[11px] text-[var(--text-faint)] font-mono">
              Status will update to <strong className="text-emerald-400">RECEIVED</strong>
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface)] transition-all cursor-pointer font-bold text-xs"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || hasZeroTotalReceived}
                className="btn-gold animate-sheen px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center gap-2 shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#1a1400]" />
                ) : (
                  <PackageCheck className="w-4 h-4 text-[#1a1400]" />
                )}
                <span>Confirm &amp; Inward Stock</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
