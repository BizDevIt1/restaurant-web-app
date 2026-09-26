"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChefHat,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Layers,
  DollarSign,
  Percent,
  TrendingUp,
  Package,
} from "lucide-react";
import { MenuItem, RawMaterial, RecipeItem } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface RecipeModalProps {
  isOpen: boolean;
  dish: MenuItem | null;
  onClose: () => void;
  onSaveSuccess: (dishId: string, totalCost: number, marginPct: number) => void;
  showToast: (msg: string) => void;
}

interface LocalIngredient {
  raw_material_id: string | number;
  raw_material_name: string;
  category: string;
  quantity_required: number;
  unit: string;
  cost_per_unit: number;
}

export default function RecipeModal({
  isOpen,
  dish,
  onClose,
  onSaveSuccess,
  showToast,
}: RecipeModalProps) {
  const { user } = useAuth();

  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([]);
  const [ingredients, setIngredients] = useState<LocalIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State for Adding an Ingredient
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [inputQuantity, setInputQuantity] = useState<string>("1");

  // Selected raw material details
  const currentSelectedMaterial = useMemo(() => {
    return availableMaterials.find((m) => String(m.id) === String(selectedMaterialId)) || null;
  }, [availableMaterials, selectedMaterialId]);

  // Load available raw materials & existing recipe items
  useEffect(() => {
    if (!isOpen || !dish) return;

    let isMounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        // 1. Fetch active raw materials
        const { data: rawData, error: rawError } = await supabase
          .from("raw_materials")
          .select("*")
          .eq("restaurant_id", restId)
          .order("name", { ascending: true });

        if (rawError) {
          console.warn("[RecipeModal] Raw materials load error:", rawError.message);
        }

        const materials: RawMaterial[] = (rawData || []).map((r: any) => ({
          id: r.id,
          restaurant_id: Number(r.restaurant_id),
          name: r.name,
          sku: r.sku,
          category: r.category || "General",
          unit: r.unit || "kg",
          current_stock: Number(r.current_stock) || 0,
          min_safety_stock: Number(r.min_safety_stock) || 0,
          cost_per_unit: Number(r.cost_per_unit) || 0,
        }));

        if (isMounted) {
          setAvailableMaterials(materials);
          if (materials.length > 0) {
            setSelectedMaterialId(String(materials[0].id));
          }
        }

        // 2. Fetch existing recipe items for this dish
        const { data: recipeData, error: recipeError } = await supabase
          .from("recipe_items")
          .select("*, raw_materials(*)")
          .eq("menu_item_id", dish.id);

        if (recipeError) {
          console.warn("[RecipeModal] Recipe items load error:", recipeError.message);
        }

        if (recipeData && isMounted) {
          const mappedIngredients: LocalIngredient[] = recipeData.map((row: any) => {
            const raw = row.raw_materials || materials.find((m) => String(m.id) === String(row.raw_material_id));
            return {
              raw_material_id: row.raw_material_id,
              raw_material_name: raw?.name || `Material #${row.raw_material_id}`,
              category: raw?.category || "General",
              quantity_required: Number(row.quantity_required) || 0,
              unit: row.unit || raw?.unit || "kg",
              cost_per_unit: Number(raw?.cost_per_unit) || 0,
            };
          });
          setIngredients(mappedIngredients);
        } else if (isMounted) {
          setIngredients([]);
        }
      } catch (err) {
        console.error("[RecipeModal] Data load error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, dish?.id, user?.organizationId, user?.id]);

  // Handle Add Ingredient to Local Table
  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSelectedMaterial) {
      showToast("Please select a raw material.");
      return;
    }

    const qty = parseFloat(inputQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast("Please enter a valid positive quantity.");
      return;
    }

    // Check if ingredient already exists in recipe
    const existingIndex = ingredients.findIndex(
      (item) => String(item.raw_material_id) === String(currentSelectedMaterial.id)
    );

    if (existingIndex !== -1) {
      // Update quantity
      setIngredients((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity_required: item.quantity_required + qty }
            : item
        )
      );
      showToast(`Updated quantity for ${currentSelectedMaterial.name}.`);
    } else {
      // Add new ingredient
      const newIngredient: LocalIngredient = {
        raw_material_id: currentSelectedMaterial.id,
        raw_material_name: currentSelectedMaterial.name,
        category: currentSelectedMaterial.category,
        quantity_required: qty,
        unit: currentSelectedMaterial.unit,
        cost_per_unit: currentSelectedMaterial.cost_per_unit,
      };
      setIngredients((prev) => [...prev, newIngredient]);
      showToast(`Added ${currentSelectedMaterial.name} to recipe.`);
    }

    // Reset quantity input to 1 or default
    setInputQuantity("1");
  };

  // Handle Remove Ingredient
  const handleRemoveIngredient = (rawMaterialId: string | number) => {
    setIngredients((prev) =>
      prev.filter((item) => String(item.raw_material_id) !== String(rawMaterialId))
    );
  };

  // Financial Calculations
  const totalRecipeCost = useMemo(() => {
    return ingredients.reduce(
      (sum, item) => sum + item.quantity_required * item.cost_per_unit,
      0
    );
  }, [ingredients]);

  const sellingPrice = dish?.price || 0;
  const grossMargin = sellingPrice - totalRecipeCost;
  const marginPercentage = sellingPrice > 0 ? (grossMargin / sellingPrice) * 100 : 0;
  const isHealthyMargin = marginPercentage >= 50;

  // Save Recipe to Supabase
  const handleSaveRecipe = async () => {
    if (!dish) return;
    setIsSaving(true);

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);

      // 1. Delete existing recipe items for this menu item
      const { error: deleteError } = await supabase
        .from("recipe_items")
        .delete()
        .eq("menu_item_id", dish.id);

      if (deleteError) {
        console.warn("[RecipeModal] Delete error:", deleteError.message);
      }

      // 2. Insert updated recipe rows (if any)
      if (ingredients.length > 0) {
        const rowsToInsert = ingredients.map((item) => ({
          restaurant_id: restId,
          menu_item_id: dish.id,
          raw_material_id: item.raw_material_id,
          quantity_required: item.quantity_required,
          unit: item.unit,
        }));

        const { error: insertError } = await supabase
          .from("recipe_items")
          .insert(rowsToInsert);

        if (insertError) {
          console.warn("[RecipeModal] Insert error:", insertError.message);
        }
      }

      // 3. Callback to update state in parent view optimistically
      onSaveSuccess(dish.id, totalRecipeCost, marginPercentage);
      showToast(`Recipe updated. Cost: Rs ${totalRecipeCost.toFixed(2)}`);
      onClose();
    } catch (err) {
      console.error("[RecipeModal] Save exception:", err);
      showToast("Error saving recipe.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !dish) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col font-sans animate-in zoom-in-95 duration-200">
        {/* ========================================================================= */}
        {/* A. MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface-hi)]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)] tracking-tight">
                  Recipe &amp; Bill of Materials
                </h3>
              </div>
              {/* Target Dish Details */}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="font-bold text-xs text-[var(--text-hi)]">{dish.name}</span>
                <span className="text-[10px] text-[var(--text-faint)] font-mono">•</span>
                <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-lo)] uppercase">
                  {dish.category}
                </span>
                <span className="text-[10px] text-[var(--text-faint)] font-mono">•</span>
                <span className="font-mono text-xs font-extrabold text-[var(--gold)]">
                  Price: Rs {dish.price.toLocaleString()}
                </span>
              </div>
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

        {/* ========================================================================= */}
        {/* B. SCROLLABLE CONTENT BODY */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
          {/* C. ADD INGREDIENT ROW (INLINE PICKER) */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)] shrink-0">
          <form
            onSubmit={handleAddIngredient}
            className="flex flex-col sm:flex-row sm:items-end gap-2.5 text-xs font-mono"
          >
            {/* Raw Material Selector */}
            <div className="flex-1 space-y-1">
              <label className="text-[10.5px] font-bold text-[var(--text-hi)] uppercase flex items-center gap-1">
                <Package className="w-3 h-3 text-[var(--gold)]" />
                <span>Select Raw Material</span>
              </label>
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                disabled={availableMaterials.length === 0}
                className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] focus:outline-none transition-all cursor-pointer"
              >
                {availableMaterials.length === 0 ? (
                  <option value="">No raw materials found in registry</option>
                ) : (
                  availableMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit}) — Rs {m.cost_per_unit}/{m.unit}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Quantity Input */}
            <div className="w-full sm:w-36 space-y-1">
              <label className="text-[10.5px] font-bold text-[var(--text-hi)] uppercase">
                Portion Qty ({currentSelectedMaterial?.unit || "unit"})
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={inputQuantity}
                onChange={(e) => setInputQuantity(e.target.value)}
                placeholder="0.150"
                className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] focus:outline-none font-bold text-[var(--gold)]"
              />
            </div>

            {/* Add Button */}
            <button
              type="submit"
              disabled={availableMaterials.length === 0}
              className="btn-gold px-4 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.02] transition-transform shrink-0 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Ingredient</span>
            </button>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* B. DYNAMIC INGREDIENTS TABLE */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto border border-[var(--border)] rounded-xl bg-[var(--surface)]/40 divide-y divide-[var(--border)] scrollbar-thin">
          <div className="p-2.5 bg-[var(--surface-hi)]/80 text-[10.5px] font-mono text-[var(--text-faint)] uppercase font-bold grid grid-cols-12 gap-2 sticky top-0 z-10 backdrop-blur-md">
            <span className="col-span-5">Raw Material</span>
            <span className="col-span-2 text-right">Portion Qty</span>
            <span className="col-span-2 text-right">Unit Cost</span>
            <span className="col-span-2 text-right">Line Cost</span>
            <span className="col-span-1 text-center">Action</span>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-xs font-mono text-[var(--text-faint)]">
              Loading recipe items...
            </div>
          ) : ingredients.length === 0 ? (
            <div className="py-10 text-center text-xs font-mono text-[var(--text-faint)] space-y-1.5">
              <ChefHat className="w-7 h-7 mx-auto opacity-40 text-[var(--gold)]" />
              <p>No ingredients linked to this recipe yet.</p>
              <p className="text-[11px] text-[var(--text-lo)]">
                Select raw materials from the dropdown above to calculate accurate COGS.
              </p>
            </div>
          ) : (
            ingredients.map((item) => {
              const lineCost = item.quantity_required * item.cost_per_unit;
              return (
                <div
                  key={item.raw_material_id}
                  className="p-2.5 grid grid-cols-12 gap-2 items-center text-xs font-mono hover:bg-[var(--surface-hi)]/40 transition-colors"
                >
                  {/* Name & Category */}
                  <div className="col-span-5">
                    <span className="font-sans font-bold text-[var(--text-hi)] block text-xs">
                      {item.raw_material_name}
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)] uppercase">
                      {item.category}
                    </span>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2 text-right font-bold text-[var(--text-hi)]">
                    {item.quantity_required.toFixed(3)}{" "}
                    <span className="text-[10px] font-normal text-[var(--text-faint)] lowercase">
                      {item.unit}
                    </span>
                  </div>

                  {/* Unit Cost */}
                  <div className="col-span-2 text-right text-[var(--text-lo)] text-[11px]">
                    Rs {item.cost_per_unit.toLocaleString()}
                  </div>

                  {/* Line Item Cost */}
                  <div className="col-span-2 text-right font-bold text-[var(--gold)]">
                    Rs {lineCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  {/* Remove Action */}
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(item.raw_material_id)}
                      className="p-1 rounded-lg text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Remove ingredient"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>

        {/* ========================================================================= */}
        {/* D. LIVE FINANCIAL SUMMARY FOOTER (AUTO-CALCULATED) */}
        {/* ========================================================================= */}
        <div className="p-3.5 rounded-xl bg-[var(--surface-hi)]/70 border border-[var(--border)] font-mono shrink-0 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Total Recipe Cost (COGS) */}
            <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-faint)] uppercase block">
                RECIPE COGS
              </span>
              <span className="text-base font-extrabold text-[var(--gold)] mt-0.5 block">
                Rs {totalRecipeCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Selling Price */}
            <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-faint)] uppercase block">
                SELLING PRICE
              </span>
              <span className="text-base font-extrabold text-[var(--text-hi)] mt-0.5 block">
                Rs {sellingPrice.toLocaleString()}
              </span>
            </div>

            {/* Gross Margin (Rs) */}
            <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-faint)] uppercase block">
                GROSS MARGIN
              </span>
              <span
                className={`text-base font-extrabold mt-0.5 block ${
                  grossMargin >= 0 ? "text-[#25d366]" : "text-red-400"
                }`}
              >
                Rs {grossMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Margin % */}
            <div
              className={`p-2 rounded-lg border ${
                isHealthyMargin
                  ? "bg-[#25d366]/10 border-[#25d366]/30 text-[#25d366]"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              <span className="text-[10px] uppercase block opacity-80">
                PROFIT MARGIN
              </span>
              <span className="text-base font-extrabold mt-0.5 block">
                {marginPercentage.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] transition-colors cursor-pointer text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveRecipe}
              disabled={isSaving}
              className="btn-gold px-5 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Recipe"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
