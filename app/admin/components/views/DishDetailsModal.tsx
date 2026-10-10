"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  ChefHat,
  Layers,
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Clock,
  Flame,
  ArrowRight,
} from "lucide-react";
import { MenuItem, RawMaterial, ItemVariant } from "../../types";
import { getSmartFoodImage } from "@/utils/posFoodImages";
import {
  ItemStockStatusBadge,
  VariantPortionBadge,
} from "@/app/components/PosInventoryPortionBadges";

interface DishDetailsModalProps {
  isOpen: boolean;
  dish: MenuItem | null;
  onClose: () => void;
  getVariantPortions?: (item: MenuItem, variant?: ItemVariant) => any;
  rawRecipes?: any[];
  rawMaterials?: RawMaterial[];
  effectiveLedger?: Map<string, any>;
  onEditDish?: (dish: MenuItem) => void;
}

export default function DishDetailsModal({
  isOpen,
  dish,
  onClose,
  getVariantPortions,
  rawRecipes = [],
  rawMaterials = [],
  effectiveLedger,
  onEditDish,
}: DishDetailsModalProps) {
  if (!isOpen || !dish) return null;

  const hasVariants = Boolean(dish.variants && dish.variants.length > 0);

  // Default active variant selection (first or default)
  const defaultVar = useMemo(() => {
    if (!hasVariants || !dish.variants) return null;
    return dish.variants.find((v) => v.isDefault) || dish.variants[0];
  }, [hasVariants, dish.variants]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | number>(
    () => defaultVar?.id || (dish.variants && dish.variants[0]?.id) || ""
  );

  const activeVariant = useMemo(() => {
    if (!hasVariants || !dish.variants) return null;
    return (
      dish.variants.find((v) => String(v.id) === String(selectedVariantId)) ||
      defaultVar ||
      dish.variants[0]
    );
  }, [hasVariants, dish.variants, selectedVariantId, defaultVar]);

  // Lookup raw materials map by ID
  const materialsMap = useMemo(() => {
    const map = new Map<string, RawMaterial>();
    for (const m of rawMaterials) {
      map.set(String(m.id), m);
    }
    return map;
  }, [rawMaterials]);

  // Resolve recipe ingredients for the dish (or active variant)
  const resolvedIngredients = useMemo(() => {
    const rawItemId = String(dish.id);
    const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;

    let candidateRecipes: any[] = [];

    // 1. Check if active variant has embedded recipe
    if (activeVariant && Array.isArray(activeVariant.recipe) && activeVariant.recipe.length > 0) {
      candidateRecipes = activeVariant.recipe;
    } else if (Array.isArray((dish as any).recipe) && (dish as any).recipe.length > 0) {
      candidateRecipes = (dish as any).recipe;
    } else if (Array.isArray((dish as any).recipe_items) && (dish as any).recipe_items.length > 0) {
      candidateRecipes = (dish as any).recipe_items;
    } else if (rawRecipes && rawRecipes.length > 0) {
      // Filter from rawRecipes in context
      const dishMatches = rawRecipes.filter(
        (r) => String(r.menu_item_id) === rawItemId || String(r.menu_item_id) === baseId
      );

      if (activeVariant) {
        const vId = String(activeVariant.id).trim();
        const vName = (activeVariant.name || "").trim().toLowerCase();
        const variantMatches = dishMatches.filter((r) => {
          if (r.variant_id && String(r.variant_id) === vId) return true;
          if (r.variant_name && vName && String(r.variant_name).trim().toLowerCase() === vName) return true;
          return false;
        });

        candidateRecipes = variantMatches.length > 0 ? variantMatches : dishMatches;
      } else {
        candidateRecipes = dishMatches;
      }
    }

    return candidateRecipes.map((r: any) => {
      const matId = String(r.raw_material_id || "");
      const rawFromMap = materialsMap.get(matId);
      const rawObj = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;

      const name = rawFromMap?.name || rawObj?.name || r.raw_material_name || `Ingredient #${matId}`;
      const unit = r.unit || rawFromMap?.unit || rawObj?.unit || "kg";
      const quantityRequired = Number(r.quantity_required) || 0;
      const costPerUnit = Number(rawFromMap?.cost_per_unit ?? rawObj?.cost_per_unit ?? r.cost_per_unit ?? 0);
      const totalItemCost = quantityRequired * costPerUnit;

      const physicalStock = Number(rawFromMap?.current_stock ?? rawObj?.current_stock ?? 0);
      const effectiveStock = Number(effectiveLedger?.get(matId)?.current_stock ?? physicalStock);
      const maxPortions = quantityRequired > 0 ? Math.floor((Math.max(0, effectiveStock) + 1e-9) / quantityRequired) : Infinity;

      return {
        id: matId,
        name,
        unit,
        quantityRequired,
        costPerUnit,
        totalItemCost,
        physicalStock,
        effectiveStock,
        maxPortions,
      };
    });
  }, [dish, activeVariant, rawRecipes, materialsMap, effectiveLedger]);

  // Financial Computations for current view
  const currentSellingPrice = Number(activeVariant?.price ?? dish.price ?? 0);

  const calculatedTotalCost = useMemo(() => {
    if (resolvedIngredients.length > 0) {
      return resolvedIngredients.reduce((sum, ing) => sum + ing.totalItemCost, 0);
    }
    if (activeVariant && typeof (activeVariant as any).foodCost === "number") {
      return (activeVariant as any).foodCost;
    }
    if (typeof dish.recipeCost === "number") {
      return dish.recipeCost;
    }
    return 0;
  }, [resolvedIngredients, activeVariant, dish.recipeCost]);

  const grossProfit = Math.max(0, currentSellingPrice - calculatedTotalCost);
  const profitMarginPct =
    currentSellingPrice > 0
      ? Math.round(((currentSellingPrice - calculatedTotalCost) / currentSellingPrice) * 100)
      : 0;

  // Active yield result for current variant or single dish
  const activeYield = useMemo(() => {
    if (getVariantPortions) {
      return getVariantPortions(dish, activeVariant || undefined);
    }
    const portionCount = activeVariant?.maxPortions ?? dish.stockCount ?? 0;
    return {
      maxPortions: portionCount,
      isOutOfStock: portionCount <= 0,
      stockStatus: portionCount <= 0 ? "out_of_stock" : portionCount <= 5 ? "low_stock" : "in_stock",
    };
  }, [dish, activeVariant, getVariantPortions]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-3xl bg-[var(--bg-deep)] border border-[var(--border)] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200 text-[var(--text-hi)] font-sans">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[var(--border)] bg-[var(--surface-base)]/40 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 overflow-hidden shadow-md">
              <img
                src={getSmartFoodImage(dish.name, dish.category, dish.imageUrl || dish.image_url)}
                alt={dish.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                  {dish.category}
                </span>
                <span className="text-xs text-[var(--text-faint)] font-mono">
                  ID: {dish.id}
                </span>
                <span className="text-xs text-[var(--text-faint)] font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--gold)]" />
                  ~{dish.prepTime || "15m"}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--text-hi)] truncate mt-1">
                {dish.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-extrabold text-[var(--gold)] font-mono">
                  {hasVariants && dish.variants
                    ? `Rs ${Math.min(...dish.variants.map((v) => v.price)).toLocaleString()} - ${Math.max(...dish.variants.map((v) => v.price)).toLocaleString()}`
                    : `Rs ${dish.price.toLocaleString()}`}
                </span>
                <ItemStockStatusBadge
                  isOutOfStock={activeYield.maxPortions <= 0}
                  portionCount={activeYield.maxPortions}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-sm"
            title="Close Details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* SECTION 1: ALL SIZE VARIANTS & PORTION BREAKDOWN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-hi)]">
                  {hasVariants ? "Size Variants & Live Stock Breakdown" : "Portion Yield & Stock Status"}
                </h3>
              </div>
              {hasVariants && (
                <span className="text-[11px] font-mono text-[var(--text-faint)]">
                  {dish.variants?.length} Sizes Available
                </span>
              )}
            </div>

            {hasVariants && dish.variants && dish.variants.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {dish.variants.map((v, idx) => {
                  const isSelected = String(v.id) === String(selectedVariantId);
                  const vYield = getVariantPortions
                    ? getVariantPortions(dish, v)
                    : {
                        maxPortions: v.maxPortions ?? 0,
                        isOutOfStock: (v.maxPortions ?? 0) <= 0,
                        stockStatus: (v.maxPortions ?? 0) <= 0 ? "out_of_stock" : (v.maxPortions ?? 0) <= 5 ? "low_stock" : "in_stock",
                      };

                  return (
                    <button
                      key={v.id || idx}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-xs ${
                        isSelected
                          ? "bg-[var(--gold-dim)]/40 border-[var(--gold)] ring-1 ring-[var(--gold)]/50"
                          : "bg-[var(--surface-hi)]/40 border-[var(--border)] hover:border-[var(--gold)]/40 hover:bg-[var(--surface-hi)]/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <span className="font-bold text-xs text-[var(--text-hi)] truncate">
                          {v.name}
                        </span>
                        <span className="font-mono text-xs font-extrabold text-[var(--gold)] shrink-0">
                          Rs {v.price.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 w-full pt-1 border-t border-[var(--border)]/40">
                        <span className="text-[10px] font-mono text-[var(--text-faint)]">
                          Portions:
                        </span>
                        <VariantPortionBadge yieldResult={vYield} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/30 border border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-[var(--text-hi)] block">
                    Standard Dish Portion
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-lo)] mt-0.5 block">
                    Price: Rs {dish.price.toLocaleString()}
                  </span>
                </div>
                <VariantPortionBadge yieldResult={activeYield} />
              </div>
            )}
          </div>

          {/* SECTION 2: FINANCIAL METRICS & PROFIT MARGIN */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-hi)]">
                Financial Cost & Profit Margin {activeVariant ? `(${activeVariant.name})` : ""}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Selling Price */}
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/40 border border-[var(--border)] flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)]">
                  Selling Price
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--gold)] font-mono mt-1">
                  Rs {currentSellingPrice.toLocaleString()}
                </span>
              </div>

              {/* Recipe Cost */}
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/40 border border-[var(--border)] flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)]">
                  Recipe Cost
                </span>
                <span className="text-base sm:text-lg font-black text-[var(--text-hi)] font-mono mt-1">
                  Rs {calculatedTotalCost.toFixed(0)}
                </span>
              </div>

              {/* Gross Profit */}
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/40 border border-[var(--border)] flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)]">
                  Gross Profit
                </span>
                <span className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-1">
                  Rs {grossProfit.toFixed(0)}
                </span>
              </div>

              {/* Profit Margin % */}
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)]/40 border border-[var(--border)] flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)]">
                  Profit Margin
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-base sm:text-lg font-black font-mono ${
                      profitMarginPct >= 50
                        ? "text-emerald-400"
                        : profitMarginPct >= 30
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {profitMarginPct}%
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase font-mono ${
                      profitMarginPct >= 50
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : profitMarginPct >= 30
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {profitMarginPct >= 50 ? "Healthy" : profitMarginPct >= 30 ? "Fair" : "Low"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: DETAILED RECIPE RAW MATERIALS & YIELD BREAKDOWN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--text-hi)]">
                  Recipe Ingredients &amp; Raw Material Inventory
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-faint)]">
                {resolvedIngredients.length} Raw Materials
              </span>
            </div>

            {resolvedIngredients.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[var(--surface-hi)]/30 border border-dashed border-[var(--border)] text-center space-y-2">
                <Package className="w-8 h-8 text-[var(--text-faint)] mx-auto opacity-40" />
                <h4 className="text-xs font-semibold text-[var(--text-lo)]">
                  No Recipe Ingredients Configured
                </h4>
                <p className="text-[11px] text-[var(--text-faint)] max-w-sm mx-auto">
                  Add raw materials and quantities required for this dish to enable live food cost tracking and automatic stock exhaustion.
                </p>
                {onEditDish && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditDish(dish);
                    }}
                    className="mt-2 btn-gold px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Configure Recipe Now</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-base)]/40 shadow-inner">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-hi)] border-b border-[var(--border)] text-[10px] text-[var(--text-faint)] uppercase whitespace-nowrap">
                      <th className="py-2.5 px-3 font-bold">Ingredient / Material</th>
                      <th className="py-2.5 px-3 text-right font-bold">Req Qty</th>
                      <th className="py-2.5 px-3 text-right font-bold">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right font-bold">Total Cost</th>
                      <th className="py-2.5 px-3 text-right font-bold">Kitchen Stock</th>
                      <th className="py-2.5 px-3 text-right font-bold">Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/60">
                    {resolvedIngredients.map((ing, idx) => {
                      const isLimiting =
                        ing.maxPortions !== Infinity &&
                        ing.maxPortions === activeYield.maxPortions &&
                        activeYield.maxPortions >= 0;

                      return (
                        <tr
                          key={`${ing.id}_${idx}`}
                          className={`hover:bg-[var(--surface-hi)]/30 transition-colors ${
                            isLimiting ? "bg-amber-500/5" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 font-sans font-medium text-[var(--text-hi)] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{ing.name}</span>
                              {isLimiting && (
                                <span className="px-1.5 py-0.2 rounded text-[8.5px] bg-amber-500/20 text-amber-300 font-mono font-bold uppercase shrink-0">
                                  Bottleneck
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-[var(--gold)] whitespace-nowrap">
                            {ing.quantityRequired} {ing.unit}
                          </td>

                          <td className="py-2.5 px-3 text-right text-[var(--text-lo)] whitespace-nowrap">
                            Rs {ing.costPerUnit.toFixed(1)} / {ing.unit}
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-[var(--text-hi)] whitespace-nowrap">
                            Rs {ing.totalItemCost.toFixed(2)}
                          </td>

                          <td className="py-2.5 px-3 text-right text-[var(--text-lo)] whitespace-nowrap">
                            {ing.effectiveStock.toFixed(2)} {ing.unit}
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold font-mono whitespace-nowrap">
                            <span
                              className={
                                ing.maxPortions <= 5
                                  ? ing.maxPortions === 0
                                    ? "text-rose-400"
                                    : "text-amber-400"
                                  : "text-emerald-400"
                              }
                            >
                              {ing.maxPortions === Infinity ? "∞" : `${ing.maxPortions} portions`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border)] bg-[var(--surface-hi)]/60 text-[11px] font-bold">
                      <td colSpan={3} className="py-2.5 px-3 uppercase text-[var(--text-faint)]">
                        Total Recipe Ingredient Cost:
                      </td>
                      <td className="py-2.5 px-3 text-right text-[var(--gold)] font-mono">
                        Rs {calculatedTotalCost.toFixed(2)}
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 text-right font-mono text-[var(--text-lo)]">
                        Profit Margin: {profitMarginPct}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--border)] bg-[var(--surface-base)]/40 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] font-mono text-[var(--text-faint)] hidden sm:block">
            {dish.name} &bull; Recipe BOM &amp; Variant Ledger
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onEditDish && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditDish(dish);
                }}
                className="px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Dish</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
