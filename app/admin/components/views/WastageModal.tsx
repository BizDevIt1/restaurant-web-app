"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Flame,
  X,
  AlertTriangle,
  Package,
  DollarSign,
  User,
  Scale,
  ChevronDown,
} from "lucide-react";
import { RawMaterial, InventoryWastage } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface WastageModalProps {
  isOpen: boolean;
  rawMaterials: RawMaterial[];
  onClose: () => void;
  onWastageLogged: (wastage: InventoryWastage, updatedMaterialId: string | number, newStock: number) => void;
  showToast: (msg: string) => void;
}

const LOSS_REASONS = [
  "Expired / Shelf Life",
  "Kitchen Spoilage / Burnt",
  "Dropped / Spilled",
  "Quality Rejection",
  "Handling Damage",
] as const;

export default function WastageModal({
  isOpen,
  rawMaterials,
  onClose,
  onWastageLogged,
  showToast,
}: WastageModalProps) {
  const { user } = useAuth();

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(
    rawMaterials.length > 0 ? String(rawMaterials[0].id) : ""
  );
  const [wastedQty, setWastedQty] = useState<string>("1");
  const [lossReason, setLossReason] = useState<string>(LOSS_REASONS[0]);
  const [loggedBy, setLoggedBy] = useState<string>(user?.name || "Admin");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize selected material when modal opens or materials load
  useEffect(() => {
    if (isOpen && rawMaterials.length > 0) {
      if (!selectedMaterialId || !rawMaterials.some((m) => String(m.id) === String(selectedMaterialId))) {
        setSelectedMaterialId(String(rawMaterials[0].id));
      }
    }
  }, [isOpen, rawMaterials, selectedMaterialId]);

  // Selected Material Details
  const selectedMaterial = useMemo(() => {
    return rawMaterials.find((m) => String(m.id) === String(selectedMaterialId)) || null;
  }, [rawMaterials, selectedMaterialId]);

  // Financial Loss Calculation
  const numericQty = parseFloat(wastedQty) || 0;
  const unitCost = selectedMaterial?.cost_per_unit || 0;
  const financialLoss = numericQty * unitCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) {
      showToast("Please select a raw material.");
      return;
    }

    if (isNaN(numericQty) || numericQty <= 0) {
      showToast("Please enter a valid positive wasted quantity.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);

      const numericMaterialId = Number(selectedMaterial.id);
      const currentStock = Number(selectedMaterial.current_stock) || 0;
      const newStock = Math.max(0, currentStock - numericQty);

      // 1. Insert record into public.inventory_wastage
      const { data: wastageData, error: wastageErr } = await supabase
        .from("inventory_wastage")
        .insert([
          {
            restaurant_id: restId,
            raw_material_id: numericMaterialId,
            quantity: numericQty,
            unit: selectedMaterial.unit,
            cost_loss: Math.round(financialLoss * 100) / 100,
            reason: lossReason,
            logged_by: loggedBy.trim() || user?.name || "Admin",
          },
        ])
        .select()
        .single();

      if (wastageErr) {
        console.warn("[WastageModal] Insert warning:", wastageErr.message);
      }

      // 2. Decrement raw material stock in public.raw_materials
      const { error: stockErr } = await supabase
        .from("raw_materials")
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", numericMaterialId);

      if (stockErr) {
        console.warn("[WastageModal] Stock decrement warning:", stockErr.message);
      }

      // 3. Callback to optimistically update UI state
      const createdRecord: InventoryWastage = {
        id: wastageData?.id || Date.now(),
        restaurant_id: restId,
        raw_material_id: numericMaterialId,
        raw_material_name: selectedMaterial.name,
        quantity: numericQty,
        unit: selectedMaterial.unit,
        cost_loss: financialLoss,
        reason: lossReason,
        logged_by: loggedBy.trim() || user?.name || "Admin",
        created_at: new Date().toISOString(),
      };

      onWastageLogged(createdRecord, selectedMaterial.id, newStock);
      showToast(`Wastage logged. Rs ${financialLoss.toFixed(2)} recorded as loss.`);
      onClose();
    } catch (err) {
      console.error("[WastageModal] Exception:", err);
      showToast("Error recording wastage.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-red-500/40 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 font-sans my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface-hi)]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)] tracking-tight">
                Log Wastage &amp; Spoilage
              </h3>
              <p className="text-xs text-[var(--text-lo)] mt-0.5">
                Record ruined inventory and auto-deduct stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs font-sans custom-scrollbar">
          {/* Raw Material Dropdown */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
              Select Raw Material <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
              >
                {rawMaterials.length === 0 ? (
                  <option value="" className="bg-[var(--bg-deep)] text-[var(--text-lo)]">No raw materials in inventory</option>
                ) : (
                  rawMaterials.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                      {m.name} — Current: {m.current_stock} {m.unit} (Rs {m.cost_per_unit}/{m.unit})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Wasted Quantity & Loss Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                Wasted Quantity <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={wastedQty}
                  onChange={(e) => setWastedQty(e.target.value)}
                  placeholder="1.000"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 rounded-xl px-3.5 py-2.5 pr-12 text-xs text-red-400 font-mono font-bold focus:outline-none transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-faint)] lowercase pointer-events-none">
                  {selectedMaterial?.unit || "unit"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                Loss Reason <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                >
                  {LOSS_REASONS.map((r) => (
                    <option key={r} value={r} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                      {r}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {/* Logged By */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
              Logged By (Staff Name)
            </label>
            <input
              type="text"
              value={loggedBy}
              onChange={(e) => setLoggedBy(e.target.value)}
              placeholder="Staff or Admin Name"
              className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
            />
          </div>

          {/* Computed Financial Loss Banner */}
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider block">
                  Financial Loss (COGS)
                </span>
                <span className="text-base font-bold text-red-400">
                  Total Loss: Rs {financialLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <span className="text-xs text-[var(--text-faint)] font-mono">
              @ Rs {unitCost}/{selectedMaterial?.unit || "unit"}
            </span>
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border)] flex items-center justify-end gap-2.5 shrink-0 bg-[var(--bg-deep)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || rawMaterials.length === 0}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-red-600/20 hover:scale-[1.02] transition-transform disabled:opacity-50"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Deducting..." : "Confirm & Deduct Stock"}</span>
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
