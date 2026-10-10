"use client";

import { CartItem, MenuItem, ItemVariant } from "@/app/admin/types";
import {
  RawMaterialStockData,
  RecipeItemData,
  simulateCartRawMaterials,
  calculateVariantPortions,
  calculateRecipePortions,
  getItemCartQuantity,
} from "./recipePortions";

export const POS_LEDGER_BROADCAST_CHANNEL = "omni_pos_ledger_sync";
export const POS_CART_CUSTOM_EVENT = "omni_pos_cart_updated";
export const POS_INVENTORY_TICK_EVENT = "omni_inventory_ledger_tick";

function safeQueueMicrotask(fn: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
  } else {
    setTimeout(fn, 0);
  }
}

export function getPosCartStorageKey(orgId: string = "default"): string {
  return `pos_active_cart_${orgId || "default"}`;
}

/**
 * Persists active cart to localStorage & sessionStorage, and broadcasts
 * across all browser tabs/windows and in-memory listeners.
 */
export function saveSharedPosCart(orgId: string = "default", cart: CartItem[]): void {
  if (typeof window === "undefined") return;
  const key = getPosCartStorageKey(orgId);
  try {
    const serialized = JSON.stringify(cart || []);
    localStorage.setItem(key, serialized);
    sessionStorage.setItem(key, serialized);
  } catch (err) {
    console.warn("[posLedgerSync] Error saving cart to storage:", err);
  }

  // Cross-tab broadcast
  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(POS_LEDGER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "POS_CART_UPDATED",
        orgId,
        cart,
        timestamp: Date.now(),
      });
      bc.close();
    } catch (err) {
      console.warn("[posLedgerSync] BroadcastChannel error:", err);
    }
  }

  // In-window event dispatch deferred to microtask so React render cycles are never interrupted
  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent(POS_CART_CUSTOM_EVENT, {
          detail: { orgId, cart, timestamp: Date.now() },
        })
      );
      window.dispatchEvent(
        new CustomEvent(POS_INVENTORY_TICK_EVENT, {
          detail: { orgId, timestamp: Date.now() },
        })
      );
    } catch { }
  });
}

/**
 * Clears active cart from storage and broadcasts across all tabs.
 */
export function clearSharedPosCart(orgId: string = "default"): void {
  if (typeof window === "undefined") return;
  const key = getPosCartStorageKey(orgId);
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch { }

  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(POS_LEDGER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "POS_CART_CLEARED",
        orgId,
        cart: [],
        timestamp: Date.now(),
      });
      bc.close();
    } catch { }
  }

  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent(POS_CART_CUSTOM_EVENT, {
          detail: { orgId, cart: [], timestamp: Date.now() },
        })
      );
      window.dispatchEvent(
        new CustomEvent(POS_INVENTORY_TICK_EVENT, {
          detail: { orgId, timestamp: Date.now() },
        })
      );
    } catch { }
  });
}

/**
 * Hydrates active POS cart from localStorage or sessionStorage.
 */
export function getSharedPosCart(orgId: string = "default"): CartItem[] {
  if (typeof window === "undefined") return [];
  const key = getPosCartStorageKey(orgId);
  try {
    const rawLocal = localStorage.getItem(key);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) return parsed;
    }
    const rawSession = sessionStorage.getItem(key);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { }
  return [];
}

/**
 * Signals that an order has been settled or inventory deducted, triggering immediate
 * re-evaluation across all listeners.
 */
export function notifyInventoryStockDeducted(orgId: string = "default"): void {
  if (typeof window === "undefined") return;
  if ("BroadcastChannel" in window) {
    try {
      const bc = new BroadcastChannel(POS_LEDGER_BROADCAST_CHANNEL);
      bc.postMessage({
        type: "INVENTORY_DEDUCTED",
        orgId,
        timestamp: Date.now(),
      });
      bc.close();
    } catch { }
  }

  safeQueueMicrotask(() => {
    try {
      window.dispatchEvent(
        new CustomEvent("inventory_stock_deducted", {
          detail: { orgId, timestamp: Date.now() },
        })
      );
      window.dispatchEvent(
        new CustomEvent(POS_INVENTORY_TICK_EVENT, {
          detail: { orgId, timestamp: Date.now() },
        })
      );
    } catch { }
  });
}

/**
 * Subscribes to real-time cart and inventory ledger synchronization events across
 * tabs, windows, and components.
 */
export function subscribeToSharedPosCart(
  orgId: string = "default",
  onCartUpdate: (cart: CartItem[]) => void,
  onTick?: () => void
): () => void {
  if (typeof window === "undefined") return () => { };

  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(POS_LEDGER_BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.orgId && orgId && String(data.orgId) !== String(orgId) && data.orgId !== "default" && orgId !== "default") {
          return;
        }
        if (data.type === "POS_CART_UPDATED" || data.type === "POS_CART_CLEARED") {
          onCartUpdate(Array.isArray(data.cart) ? data.cart : []);
          if (onTick) onTick();
        } else if (data.type === "INVENTORY_DEDUCTED") {
          if (onTick) onTick();
        }
      };
    } catch (err) {
      console.warn("[posLedgerSync] BroadcastChannel init warning:", err);
    }
  }

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent;
    safeQueueMicrotask(() => {
      if (custom.detail?.cart !== undefined) {
        onCartUpdate(Array.isArray(custom.detail.cart) ? custom.detail.cart : []);
      }
      if (onTick) onTick();
    });
  };

  const handleStorageEvent = (e: StorageEvent) => {
    const targetKey = getPosCartStorageKey(orgId);
    if (e.key === targetKey) {
      safeQueueMicrotask(() => {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : [];
          onCartUpdate(Array.isArray(val) ? val : []);
          if (onTick) onTick();
        } catch {
          onCartUpdate([]);
        }
      });
    }
  };

  const handleTickEvent = () => {
    safeQueueMicrotask(() => {
      if (onTick) onTick();
    });
  };

  window.addEventListener(POS_CART_CUSTOM_EVENT, handleCustomEvent);
  window.addEventListener(POS_INVENTORY_TICK_EVENT, handleTickEvent);
  window.addEventListener("inventory_stock_deducted", handleTickEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    if (bc) {
      try {
        bc.close();
      } catch { }
    }
    window.removeEventListener(POS_CART_CUSTOM_EVENT, handleCustomEvent);
    window.removeEventListener(POS_INVENTORY_TICK_EVENT, handleTickEvent);
    window.removeEventListener("inventory_stock_deducted", handleTickEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

export interface PortionYieldResult {
  maxPortions: number;
  isOutOfStock: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  limitingIngredient?: string;
}

/**
 * Unified calculation function: identical to POS Terminal getVariantPortions.
 * Evaluates per-variant BOM with integer flooring floor(Stock / Req) against active effective ledger.
 */
export function calculateItemPortions(
  item: MenuItem,
  variant: ItemVariant | undefined,
  rawRecipes: RecipeItemData[] | any[],
  effectiveLedger: Map<string, RawMaterialStockData>,
  cart: CartItem[] = []
): PortionYieldResult {
  const rawItemId = String(item.id);
  const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;
  let dishRecipes = (rawRecipes || []).filter(
    (r) => String(r.menu_item_id) === baseId || String(r.menu_item_id) === rawItemId
  );
  if (dishRecipes.length === 0) {
    if (Array.isArray((item as any).recipe) && (item as any).recipe.length > 0) {
      dishRecipes = (item as any).recipe;
    } else if (Array.isArray((item as any).recipe_items) && (item as any).recipe_items.length > 0) {
      dishRecipes = (item as any).recipe_items;
    }
  }
  const inCartQty = getItemCartQuantity(cart, item, variant);

  if (variant) {
    const matchedVariant =
      item.variants?.find(
        (v) =>
          (v.id && variant.id && String(v.id) === String(variant.id)) ||
          (v.name && variant.name && v.name.trim().toLowerCase() === variant.name.trim().toLowerCase())
      ) || variant;

    const liveYield = calculateVariantPortions(
      dishRecipes,
      matchedVariant,
      effectiveLedger,
      item.price
    );

    const hasVariantBOM = liveYield.resolvedBOM.length > 0;
    let maxPortions = liveYield.maxPortions;
    if (!hasVariantBOM || effectiveLedger.size === 0) {
      const baseCount =
        typeof matchedVariant.maxPortions === "number"
          ? matchedVariant.maxPortions
          : typeof item.stockCount === "number"
          ? item.stockCount
          : 20;
      maxPortions = Math.max(0, baseCount - inCartQty);
    } else {
      maxPortions = Math.max(0, maxPortions);
    }

    const isOutOfStock = maxPortions <= 0;
    return {
      maxPortions,
      isOutOfStock,
      stockStatus: isOutOfStock ? "out_of_stock" : liveYield.stockStatus,
      limitingIngredient: liveYield.limitingIngredient,
    };
  }

  // Single size or base dish calculation
  if (dishRecipes.length > 0 && effectiveLedger.size > 0) {
    const calc = calculateRecipePortions(dishRecipes, item.price, effectiveLedger);
    const maxPortions = Math.max(0, calc.maxPortions);
    const isOutOfStock = maxPortions <= 0;
    return {
      maxPortions,
      isOutOfStock,
      stockStatus: isOutOfStock ? "out_of_stock" : calc.stockStatus,
      limitingIngredient: calc.limitingIngredient?.name,
    };
  }

  // Fallback for non-recipe items (Available Portions = Max Yield - Current Cart Quantity)
  const rawCount =
    typeof item.availablePortions === "number"
      ? item.availablePortions
      : typeof item.stockCount === "number"
      ? item.stockCount
      : 20;
  const remaining = Math.max(0, rawCount - inCartQty);
  return {
    maxPortions: remaining,
    isOutOfStock: remaining <= 0 || item.stockStatus === "out_of_stock",
    stockStatus: remaining <= 0 || item.stockStatus === "out_of_stock" ? "out_of_stock" : "in_stock",
  };
}

/**
 * Returns unified display attributes for an item matching POS Terminal LuxuryFoodCard 100%.
 */
export function getItemRepresentativePortions(
  item: MenuItem,
  getPortionsFn: (item: MenuItem, variant?: ItemVariant) => PortionYieldResult
): {
  hasMultipleSizes: boolean;
  representativeVariant: ItemVariant | null;
  portionCount: number;
  isOutOfStock: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  limitingIngredient?: string;
  displayText: string;
  textColorClass: string;
} {
  const hasMultipleSizes = Boolean(item.variants && item.variants.length > 0);

  let representativeVariant: ItemVariant | null = null;
  if (hasMultipleSizes && item.variants && item.variants.length > 0) {
    const def = item.variants.find((v) => v.isDefault) || item.variants[0];
    const defYield = getPortionsFn(item, def);
    if (defYield.maxPortions > 0 && !defYield.isOutOfStock) {
      representativeVariant = def;
    } else {
      const alt = item.variants.find((v) => {
        const y = getPortionsFn(item, v);
        return y.maxPortions > 0 && !y.isOutOfStock;
      });
      representativeVariant = alt || def;
    }
  }

  let portionCount = 0;
  if (hasMultipleSizes && representativeVariant) {
    portionCount = getPortionsFn(item, representativeVariant).maxPortions;
  } else {
    const singleYield = getPortionsFn(item);
    if (typeof singleYield?.maxPortions === "number" && singleYield.maxPortions !== Infinity) {
      portionCount = singleYield.maxPortions;
    } else if (typeof item.availablePortions === "number") {
      portionCount = item.availablePortions;
    } else if (typeof item.maxPortions === "number") {
      portionCount = item.maxPortions;
    } else if (typeof item.stockCount === "number") {
      portionCount = item.stockCount;
    }
  }

  let isOutOfStock = false;
  if (hasMultipleSizes && item.variants && item.variants.length > 0) {
    isOutOfStock = item.variants.every((v) => {
      const y = getPortionsFn(item, v);
      return y.maxPortions <= 0;
    });
  } else {
    const singleYield = getPortionsFn(item);
    if (singleYield) {
      isOutOfStock = singleYield.maxPortions <= 0;
    } else {
      isOutOfStock = portionCount <= 0 || (item.stockStatus === "out_of_stock" && !item.hasRecipe);
    }
  }

  // Strict Zero-Stock Lock: Items with remaining portions (> 0) must remain Active & In Stock
  if (portionCount > 0) {
    isOutOfStock = false;
  }

  const stockStatus: "in_stock" | "low_stock" | "out_of_stock" = isOutOfStock || portionCount <= 0
    ? "out_of_stock"
    : portionCount <= 5
    ? "low_stock"
    : "in_stock";

  const limitingIngredient = representativeVariant
    ? getPortionsFn(item, representativeVariant).limitingIngredient
    : getPortionsFn(item).limitingIngredient;

  const displayText =
    isOutOfStock || portionCount <= 0
      ? hasMultipleSizes
        ? `0 (${representativeVariant?.name || "Regular"})`
        : "0 Portions"
      : hasMultipleSizes
      ? `${portionCount} (${representativeVariant?.name || "Regular"})`
      : `${portionCount} Portions`;

  const textColorClass =
    isOutOfStock || portionCount <= 0
      ? "text-rose-400"
      : portionCount <= 5
      ? "text-amber-400"
      : "text-[var(--text-lo)]";

  return {
    hasMultipleSizes,
    representativeVariant,
    portionCount,
    isOutOfStock,
    stockStatus,
    limitingIngredient,
    displayText,
    textColorClass,
  };
}
