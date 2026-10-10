"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Clock,
  Ban,
  SlidersHorizontal,
  X,
  Check,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { MenuItem, ItemVariant } from "@/app/admin/types";
import { getSmartFoodImage } from "@/utils/posFoodImages";

const COMMON_MODIFIERS = [
  "Less Spicy",
  "Extra Spicy",
  "No Onions",
  "No Mayo",
  "Cheese Slice (+Rs 80)",
  "Double Patty (+Rs 200)",
  "Diet Coke",
  "Extra Raita",
  "Extra Sauce",
  "Packing Separate",
];

function getDishUnitPlural(name: string): string {
  const lower = (name || "").toLowerCase();
  if (lower.includes("burger") || lower.includes("zinger")) return "Burgers";
  if (lower.includes("karahi") || lower.includes("handi")) return "Karahis";
  if (lower.includes("pizza")) return "Pizzas";
  if (lower.includes("biryani") || lower.includes("rice") || lower.includes("pulao")) return "Plates";
  if (lower.includes("tikka") || lower.includes("kebab") || lower.includes("boti")) return "Servings";
  if (lower.includes("roll") || lower.includes("wrap")) return "Rolls";
  if (lower.includes("drink") || lower.includes("shake") || lower.includes("tea") || lower.includes("chai") || lower.includes("coffee")) return "Drinks";
  if (lower.includes("cake") || lower.includes("dessert") || lower.includes("ice cream")) return "Portions";
  return "left";
}

interface LuxuryFoodCardProps {
  item: MenuItem;
  onItemClick: (item: MenuItem) => void;
  onOpenModifier: (e: React.MouseEvent, item: MenuItem) => void;
  getVariantPortions?: (
    item: MenuItem,
    variant?: ItemVariant
  ) => {
    maxPortions: number;
    isOutOfStock: boolean;
    stockStatus: "in_stock" | "low_stock" | "out_of_stock";
    limitingIngredient?: string;
  };
  inventoryTick?: number;
}

export const LuxuryFoodCard = function LuxuryFoodCard({
  item,
  onItemClick,
  onOpenModifier,
  getVariantPortions,
  inventoryTick,
}: LuxuryFoodCardProps) {
  const hasMultipleSizes = Boolean(item.variants && item.variants.length > 0);

  // Total available yield across all sizes/variants
  const totalVariantYield = useMemo(() => {
    if (!hasMultipleSizes || !item.variants || item.variants.length === 0) return 0;
    return item.variants.reduce((sum, v) => {
      let vStock = 0;
      if (getVariantPortions) {
        vStock = getVariantPortions(item, v).maxPortions;
      } else if (typeof v.maxPortions === "number") {
        vStock = v.maxPortions;
      } else if (typeof (v as any).availablePortions === "number") {
        vStock = (v as any).availablePortions;
      } else if (typeof (v as any).stockCount === "number") {
        vStock = (v as any).stockCount;
      }
      return sum + Math.max(0, vStock);
    }, 0);
  }, [hasMultipleSizes, item, getVariantPortions, inventoryTick]);

  // Representative variant: prioritize default if in stock, or first variant with remaining stock
  const representativeVariant = useMemo(() => {
    if (!hasMultipleSizes || !item.variants || item.variants.length === 0) return null;
    const def = item.variants.find((v) => v.isDefault) || item.variants[0];
    if (getVariantPortions) {
      const defYield = getVariantPortions(item, def);
      if (defYield.maxPortions > 0 && !defYield.isOutOfStock) return def;
      const alt = item.variants.find((v) => {
        const y = getVariantPortions(item, v);
        return y.maxPortions > 0 && !y.isOutOfStock;
      });
      return alt || def;
    }
    const defPortions = def.maxPortions ?? (def as any).availablePortions ?? 0;
    if (defPortions > 0) return def;
    const alt = item.variants.find(
      (v) => (v.maxPortions ?? (v as any).availablePortions ?? 0) > 0
    );
    return alt || def;
  }, [hasMultipleSizes, item, getVariantPortions, inventoryTick]);

  const portionCount = useMemo(() => {
    if (hasMultipleSizes) {
      if (representativeVariant) {
        if (getVariantPortions) {
          return Math.max(0, getVariantPortions(item, representativeVariant).maxPortions);
        }
        if (typeof representativeVariant.maxPortions === "number") {
          return Math.max(0, representativeVariant.maxPortions);
        }
        if (typeof (representativeVariant as any).availablePortions === "number") {
          return Math.max(0, (representativeVariant as any).availablePortions);
        }
      }
      return Math.max(0, totalVariantYield);
    }
    if (getVariantPortions) {
      const singleYield = getVariantPortions(item);
      if (typeof singleYield?.maxPortions === "number" && singleYield.maxPortions !== Infinity) {
        return Math.max(0, singleYield.maxPortions);
      }
    }
    if (typeof item.availablePortions === "number") {
      return Math.max(0, item.availablePortions);
    }
    if (typeof item.maxPortions === "number") {
      return Math.max(0, item.maxPortions);
    }
    if (typeof item.stockCount === "number") {
      return Math.max(0, item.stockCount);
    }
    return 0;
  }, [hasMultipleSizes, representativeVariant, totalVariantYield, getVariantPortions, item, inventoryTick]);

  // Strict Out-of-Stock Rule: only disabled when total available yield across all sizes/variants drops strictly to 0
  const isOutOfStock = useMemo(() => {
    if (hasMultipleSizes) {
      return totalVariantYield <= 0;
    }
    return portionCount <= 0;
  }, [hasMultipleSizes, totalVariantYield, portionCount]);

  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  const smartImage = useMemo(
    () =>
      getSmartFoodImage(
        item.name,
        item.category,
        (item as any).imageUrl || (item as any).image_url
      ),
    [item.name, item.category, (item as any).imageUrl, (item as any).image_url]
  );

  const imgSrc = fallbackSrc || smartImage;

  const handleImageError = () => {
    if (!fallbackSrc) {
      const name = (item.name || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();
      const keyword = `${name} ${cat}`;

      if (keyword.includes("burger") || keyword.includes("zinger") || keyword.includes("patty")) {
        setFallbackSrc("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80");
      } else if (keyword.includes("pizza") || keyword.includes("slice") || keyword.includes("crust")) {
        setFallbackSrc("https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80");
      } else if (keyword.includes("drink") || keyword.includes("beverage") || keyword.includes("shake") || keyword.includes("tea") || keyword.includes("coffee") || keyword.includes("chai")) {
        setFallbackSrc("https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80");
      } else if (keyword.includes("dessert") || keyword.includes("cake") || keyword.includes("sweet") || keyword.includes("ice cream")) {
        setFallbackSrc("https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80");
      } else if (keyword.includes("karahi") || keyword.includes("curry") || keyword.includes("handi") || keyword.includes("desi") || keyword.includes("nihari")) {
        setFallbackSrc("https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80");
      } else if (keyword.includes("biryani") || keyword.includes("rice") || keyword.includes("pulao")) {
        setFallbackSrc("https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80");
      } else if (keyword.includes("bbq") || keyword.includes("kebab") || keyword.includes("tikka") || keyword.includes("grill") || keyword.includes("boti")) {
        setFallbackSrc("https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80");
      } else {
        setFallbackSrc("https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80");
      }
    }
  };

  const minPrice = useMemo(() => {
    return item.variants && item.variants.length > 0
      ? Math.min(...item.variants.map((v) => v.price))
      : item.price;
  }, [item.variants, item.price]);

  return (
    <div
      onClick={() => {
        if (!isOutOfStock) onItemClick(item);
      }}
      className={`glass-panel bg-[var(--surface-hi)] border border-[var(--border)] rounded-2xl p-2.5 flex flex-col justify-between group transition-all duration-150 shadow-xs relative overflow-hidden select-none ${
        isOutOfStock
          ? "opacity-55 grayscale-[25%] cursor-not-allowed border-rose-500/30"
          : "hover:border-[var(--gold)]/60 hover:shadow-md cursor-pointer active:scale-[0.98]"
      }`}
    >
      {/* Sleek Top-Right Prohibition Badge when Out of Stock */}
      {isOutOfStock && (
        <div
          title="Out of Stock"
          aria-label="Out of Stock"
          className="absolute top-2.5 right-2.5 z-20 flex items-center justify-center w-7 h-7 rounded-full bg-red-600/90 text-white shadow-md border border-red-400/40 backdrop-blur-sm pointer-events-none"
        >
          <Ban className="w-4 h-4 text-white stroke-[2.5]" />
        </div>
      )}

      {/* 1. High-quality dish image */}
      <div className="w-full h-28 sm:h-32 rounded-xl overflow-hidden relative bg-[var(--surface)] border border-[var(--border)]/60 mb-2.5 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={item.name}
          onError={handleImageError}
          className={`object-cover w-full h-full transition-transform duration-300 ${
            !isOutOfStock ? "group-hover:scale-105" : ""
          }`}
          loading="lazy"
        />
      </div>

      {/* 2. Item Name & Universal Portion Badge & 3. Price & 4. Quick Add Button */}
      <div className="w-full flex-1 flex flex-col justify-between">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors line-clamp-1 w-full text-left leading-tight truncate">
            {item.name}
          </h4>

          {/* Plain Text Stock Portion Display */}
          <p
            className={`text-[10px] sm:text-[11px] font-mono leading-tight mt-1 truncate ${
              isOutOfStock
                ? "text-rose-600 dark:text-rose-400 font-bold"
                : portionCount <= 5
                ? "text-amber-700 dark:text-amber-400 font-bold"
                : "text-[var(--text-lo)]"
            }`}
          >
            {isOutOfStock
              ? hasMultipleSizes
                ? `0 (${representativeVariant?.name || "Regular"})`
                : "0 Portions"
              : hasMultipleSizes
              ? `${portionCount} (${representativeVariant?.name || "Regular"})`
              : `${portionCount} Portions`}
          </p>
        </div>

        <div className="w-full flex items-center justify-between text-xs pt-2 mt-1">
          <span className="font-extrabold text-amber-800 dark:text-[var(--gold)] font-mono text-xs sm:text-sm leading-tight flex items-baseline gap-1">
            {item.variants && item.variants.length > 0 && (
              <span className="text-[10px] text-[var(--text-lo)] font-sans font-normal">from</span>
            )}
            <span>Rs {minPrice.toLocaleString()}</span>
          </span>

          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold transition-all shrink-0 ${
              isOutOfStock
                ? "bg-[var(--surface)] text-[var(--text-faint)] cursor-not-allowed"
                : "bg-amber-500/15 dark:bg-[var(--gold-dim)] group-hover:bg-[var(--gold)] text-amber-900 dark:text-[var(--gold)] group-hover:text-[#241a05] border border-amber-500/30 group-hover:border-[var(--gold)] shadow-xs"
            }`}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ItemGridAndModifiersProps {
  filteredMenuItems: MenuItem[];
  onAddToCart: (item: MenuItem, notes?: string) => void;
  showToast: (msg: string) => void;
  getVariantPortions?: (
    item: MenuItem,
    variant?: ItemVariant
  ) => {
    maxPortions: number;
    isOutOfStock: boolean;
    stockStatus: "in_stock" | "low_stock" | "out_of_stock";
    limitingIngredient?: string;
  };
  inventoryTick?: number;
}

export default function ItemGridAndModifiers({
  filteredMenuItems,
  onAddToCart,
  showToast,
  getVariantPortions,
  inventoryTick,
}: ItemGridAndModifiersProps) {
  // Modal states
  const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);
  const [selectedItemForVariant, setSelectedItemForVariant] = useState<MenuItem | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState<string>("");

  const handleOpenModifier = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setSelectedItemForModifier(item);
    setSelectedNotes([]);
    setCustomNote("");
  };

  const toggleNote = (note: string) => {
    setSelectedNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note]
    );
  };

  const handleConfirmModifier = () => {
    if (!selectedItemForModifier) return;
    const notesArr = [...selectedNotes];
    if (customNote.trim()) {
      notesArr.push(customNote.trim());
    }
    const finalNotes = notesArr.join(", ");
    onAddToCart(selectedItemForModifier, finalNotes || undefined);
    setSelectedItemForModifier(null);
  };

  // Dynamically sync modal item with live reactive simulated menu items
  const activeVariantItem = useMemo(() => {
    if (!selectedItemForVariant) return null;
    return (
      filteredMenuItems.find(
        (m) =>
          String(m.id) === String(selectedItemForVariant.id) ||
          (selectedItemForVariant.name &&
            m.name.trim().toLowerCase() === selectedItemForVariant.name.trim().toLowerCase())
      ) || selectedItemForVariant
    );
  }, [filteredMenuItems, selectedItemForVariant, inventoryTick]);

  const handleItemClick = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      if (getVariantPortions) {
        const anyInStock = item.variants.some((v) => {
          const y = getVariantPortions(item, v);
          return y.maxPortions > 0;
        });
        if (!anyInStock) {
          showToast(`Insufficient stock available: "${item.name}" is completely out of stock.`);
          return;
        }
      }
      setSelectedItemForVariant(item);
      return;
    }

    if (getVariantPortions) {
      const y = getVariantPortions(item);
      if (y.maxPortions <= 0) {
        showToast(`Insufficient stock available: "${item.name}" has reached its maximum available limit.`);
        return;
      }
    }

    const remainingPortions = getVariantPortions
      ? getVariantPortions(item).maxPortions
      : typeof item.stockCount === "number"
      ? item.stockCount
      : 99;

    if (remainingPortions <= 0) {
      if (
        item.stockStatus === "out_of_stock" ||
        item.isAutoOutOfStock ||
        item.in_stock === false ||
        item.is_available === false
      ) {
        showToast(`${item.name} is currently 86'd / out of stock.`);
        return;
      }
    }

    onAddToCart(item);
  };

  const handleSelectVariant = (variant: ItemVariant) => {
    const itemToUse = activeVariantItem || selectedItemForVariant;
    if (!itemToUse) return;

    if (getVariantPortions) {
      const vStock = getVariantPortions(itemToUse, variant);
      if (vStock.maxPortions <= 0) {
        showToast(`Insufficient stock available: "${itemToUse.name} (${variant.name})" has reached its maximum available limit.`);
        return;
      }
    }

    const clonedItem: MenuItem = {
      ...itemToUse,
      id: `${itemToUse.id}_${variant.id || variant.name.toLowerCase().replace(/\s+/g, "_")}`,
      name: `${itemToUse.name} (${variant.name})`,
      price: variant.price,
      selectedVariant: variant,
      stockStatus: "in_stock",
      isAutoOutOfStock: false,
      is_available: true,
      in_stock: true,
    };

    onAddToCart(clonedItem);
    // Keep modal open so cashier sees real-time portion limits (like Double Petti dropping to 0) immediately
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
        {filteredMenuItems.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center glass-panel rounded-2xl shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-hi)] tracking-wide">
              No matching items
            </h3>
            <p className="text-xs text-[var(--text-lo)] max-w-sm mt-1">
              Try adjusting your category filter or search keywords.
            </p>
          </div>
        ) : (
          filteredMenuItems.map((item) => (
            <LuxuryFoodCard
              key={item.id}
              item={item}
              onItemClick={handleItemClick}
              onOpenModifier={handleOpenModifier}
              getVariantPortions={getVariantPortions}
              inventoryTick={inventoryTick}
            />
          ))
        )}
      </div>

      {/* Item Modifiers Modal Dialog */}
      {selectedItemForModifier && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItemForModifier(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-[95vw] max-w-md rounded-3xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 text-[var(--text-hi)]">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/20 overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getSmartFoodImage(selectedItemForModifier.name, selectedItemForModifier.category)}
                    alt={selectedItemForModifier.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-hi)]">
                    {selectedItemForModifier.name}
                  </h3>
                  <p className="text-xs font-mono text-[var(--gold)]">
                    Rs {selectedItemForModifier.price.toLocaleString()} • Kitchen Prep Notes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForModifier(null)}
                className="w-8 h-8 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Modifiers Chips */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase font-semibold">
                Quick Prep Directives:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {COMMON_MODIFIERS.map((mod) => {
                  const isChecked = selectedNotes.includes(mod);
                  return (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => toggleNote(mod)}
                      className={`px-3 py-2 rounded-xl text-xs font-mono text-left transition-all border flex items-center justify-between cursor-pointer ${isChecked
                        ? "bg-[var(--gold-dim)] border-[var(--gold)] text-[var(--gold)] font-bold shadow-xs"
                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-lo)] hover:border-[var(--gold)]/50"
                        }`}
                    >
                      <span className="truncate">{mod}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 shrink-0 ml-1 text-[var(--gold)]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Instruction Input */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase font-semibold">
                Custom Kitchen Note:
              </span>
              <input
                type="text"
                placeholder="e.g. Extra well done, pack dressing separately..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmModifier();
                  }
                }}
                className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)]/60 rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-faint)] font-mono focus:outline-none shadow-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSelectedItemForModifier(null)}
                className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-xs text-[var(--text-lo)] font-medium border border-[var(--border)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModifier}
                className="btn-gold font-bold px-5 py-2 rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Amber Size / Portion Selection Modal */}
      {activeVariantItem && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItemForVariant(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md bg-[var(--bg-deep)] border border-[var(--border)] rounded-3xl p-6 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-150 font-sans text-[var(--text-hi)]">
            <button
              type="button"
              onClick={() => setSelectedItemForVariant(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[var(--gold)]">
                Portion Sizing
              </span>
              <h3 className="text-xl font-bold text-[var(--text-hi)] mt-1 font-display">
                {activeVariantItem.name}
              </h3>
              <p className="text-xs text-[var(--text-lo)] mt-0.5">
                Select a portion size to add to the active ticket:
              </p>
            </div>

            <div className="space-y-2.5 pt-1 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
              {activeVariantItem.variants?.map((v, idx) => {
                const vStock = getVariantPortions
                  ? getVariantPortions(activeVariantItem, v)
                  : {
                      maxPortions:
                        typeof activeVariantItem.stockCount === "number"
                          ? activeVariantItem.stockCount
                          : 99,
                      isOutOfStock: false,
                      stockStatus: "in_stock" as const,
                    };
                const isVariantOos = vStock.maxPortions <= 0;

                return (
                  <button
                    key={v.id || idx}
                    type="button"
                    onClick={() => {
                      if (!isVariantOos) {
                        handleSelectVariant(v);
                      } else {
                        showToast(`Insufficient stock available: "${activeVariantItem.name} (${v.name})" has reached its maximum available limit.`);
                      }
                    }}
                    disabled={isVariantOos}
                    className={`w-full p-4 rounded-2xl glass-panel text-left transition-all duration-150 group flex items-center justify-between shadow-xs border ${
                      isVariantOos
                        ? "opacity-50 grayscale-[35%] cursor-not-allowed border-rose-500/30 bg-black/40"
                        : "hover:border-[var(--gold)] cursor-pointer active:scale-[0.98] border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hi)]"
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold block transition-colors truncate ${
                            isVariantOos
                              ? "text-zinc-500 line-through"
                              : "text-[var(--text-hi)] group-hover:text-[var(--gold)]"
                          }`}
                        >
                          {v.name}
                        </span>
                        {v.isDefault && (
                          <span className="badge-pill badge-gold text-[9px] px-2 py-0.5 shrink-0">
                            Default
                          </span>
                        )}

                        {/* Sizing-Specific Portion Badge */}
                        {isVariantOos ? (
                          <span className="badge-pill badge-danger text-[9px] px-2 py-0.5 rounded-md shrink-0">
                            <span className="badge-dot" />
                            <span>0 left (Out of Stock)</span>
                          </span>
                        ) : vStock.maxPortions <= 5 ? (
                          <span className="badge-pill badge-warning text-[9px] px-2 py-0.5 rounded-md shrink-0">
                            <span className="badge-dot animate-pulse" />
                            <span>{vStock.maxPortions} left</span>
                          </span>
                        ) : (
                          <span className="badge-pill badge-success text-[9px] px-2 py-0.5 rounded-md shrink-0">
                            <span className="badge-dot" />
                            <span>{vStock.maxPortions} portions</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-base font-black font-mono tracking-tight ${
                          isVariantOos ? "text-zinc-600" : "text-[var(--gold)]"
                        }`}
                      >
                        Rs {Number(v.price).toLocaleString()}
                      </span>
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors shadow-xs ${
                          isVariantOos
                            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                            : "bg-[var(--gold-dim)] text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-zinc-950"
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedItemForVariant(null)}
                className="px-5 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-amber-900 dark:text-[var(--gold)] hover:text-amber-800 dark:hover:text-amber-300 text-xs font-bold cursor-pointer border border-[var(--gold)]/30 hover:border-[var(--gold)]/60 transition-all shadow-xs"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
