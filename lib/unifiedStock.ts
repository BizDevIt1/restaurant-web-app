import { createClient } from "./supabase";
import { MenuItem, ItemVariant } from "@/app/admin/types";
import {
  calculateRecipePortions,
  calculateVariantPortions,
  getItemActiveReservedQuantity,
  RawMaterialStockData,
  RecipeItemData,
} from "./recipePortions";

export interface UnifiedStockResult {
  databaseStock: number;
  unfulfilledOrdersQuantity: number;
  availableStock: number;
  isOutOfStock: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  limitingIngredient?: any;
}

/**
 * Broadcasts an immediate live stock refresh event across all terminals:
 * - Supabase Realtime Broadcast Channel: restaurant_${restId}_feed
 * - Browser BroadcastChannel API (cross-tab / multi-window)
 * - CustomEvent on window
 * - localStorage storage event trigger
 */
export function broadcastStockRefresh(restaurantId: string | number, detail?: any) {
  if (!restaurantId) return;
  const restIdStr = String(restaurantId);

  // 1. Cross-tab & Multi-Window Local Broadcast
  if (typeof window !== "undefined") {
    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel(`stock_feed_${restIdStr}`);
        bc.postMessage({
          type: "STOCK_REFRESH",
          restaurantId: restIdStr,
          detail,
          timestamp: Date.now(),
        });
        bc.close();
      }
      window.dispatchEvent(
        new CustomEvent("stock_refresh", {
          detail: { restaurantId: restIdStr, detail, timestamp: Date.now() },
        })
      );
      localStorage.setItem(`stock_refresh_ts_${restIdStr}`, String(Date.now()));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.warn("[UnifiedStock] Local broadcast warning:", e);
    }
  }

  // 2. Global Supabase Realtime Broadcast (restaurant_${restId}_feed)
  try {
    const supabase = createClient();
    const topic = `restaurant_${restIdStr}_feed`;
    const channel = supabase.channel(topic);

    const emit = () => {
      channel.send({
        type: "broadcast",
        event: "stock_refresh",
        payload: {
          restaurantId: restIdStr,
          detail,
          timestamp: Date.now(),
        },
      });
    };

    if ((channel as any)?.state === "joined") {
      emit();
    } else {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          emit();
        }
      });
    }
  } catch (err) {
    console.warn("[UnifiedStock] Supabase realtime broadcast error:", err);
  }
}

/**
 * Subscribes a terminal (POS, Waiter, Admin) to live global stock refresh events.
 * Listens to:
 * 1. Supabase channel: restaurant_${restId}_feed (broadcast event: "stock_refresh")
 * 2. Browser BroadcastChannel: stock_feed_${restId}
 * 3. Window custom event: "stock_refresh"
 * 4. LocalStorage storage event
 * 5. Supabase postgres_changes on orders, menu_items, raw_materials, recipe_items
 */
export function subscribeToStockRefresh(
  restaurantId: string | number,
  onRefresh: () => void
): () => void {
  if (!restaurantId || typeof window === "undefined") return () => {};
  const restIdStr = String(restaurantId);

  let isMounted = true;
  let debounceTimer: NodeJS.Timeout | null = null;
  const triggerDebounced = () => {
    if (!isMounted) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (isMounted) onRefresh();
    }, 150);
  };

  // 1. Browser BroadcastChannel
  let bc: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      bc = new BroadcastChannel(`stock_feed_${restIdStr}`);
      bc.onmessage = (event) => {
        if (event.data?.type === "STOCK_REFRESH") {
          triggerDebounced();
        }
      };
    } catch {}
  }

  // 2. Window event
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent;
    if (
      !custom.detail?.restaurantId ||
      String(custom.detail.restaurantId) === restIdStr
    ) {
      triggerDebounced();
    }
  };
  window.addEventListener("stock_refresh", handleCustomEvent);

  // 3. Storage event
  const handleStorage = (e: StorageEvent) => {
    if (e.key === `stock_refresh_ts_${restIdStr}`) {
      triggerDebounced();
    }
  };
  window.addEventListener("storage", handleStorage);

  // 4. Supabase Realtime Channel
  let channel: any = null;
  try {
    const supabase = createClient();
    channel = supabase
      .channel(`stock_sub_${restIdStr}_${Math.random().toString(36).slice(2, 7)}`)
      // Live feed broadcast
      .on(
        "broadcast",
        { event: "stock_refresh" },
        ({ payload }: any) => {
          if (!payload?.restaurantId || String(payload.restaurantId) === restIdStr) {
            triggerDebounced();
          }
        }
      )
      // Postgres changes: orders
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restIdStr}`,
        },
        () => {
          triggerDebounced();
        }
      )
      // Postgres changes: menu_items
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `restaurant_id=eq.${restIdStr}`,
        },
        () => {
          triggerDebounced();
        }
      )
      // Postgres changes: raw_materials
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "raw_materials",
          filter: `restaurant_id=eq.${restIdStr}`,
        },
        () => {
          triggerDebounced();
        }
      )
      // Postgres changes: recipe_items
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recipe_items",
          filter: `restaurant_id=eq.${restIdStr}`,
        },
        () => {
          triggerDebounced();
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("[UnifiedStock] Supabase realtime subscription error:", err);
  }

  return () => {
    isMounted = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    window.removeEventListener("stock_refresh", handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
    if (channel) {
      try {
        const supabase = createClient();
        supabase.removeChannel(channel);
      } catch {}
    }
  };
}

/**
 * Unified Available Stock Calculation (Single Source of Truth)
 *
 * Formula:
 *   Available Stock = Database Stock - (Sum of quantities in unfulfilled orders across ALL terminals)
 *
 * - Database Stock:
 *     If item / variant has a recipe in recipe_items, strictly computed from
 *     raw_materials using recipe ratios: min(floor(current_stock / quantity_required)).
 *     Otherwise, directly taken from database stock_count (menu_items.stock_count).
 * - Active Orders Reservation:
 *     Sum of quantities in unfulfilled active orders (orders where order_status = 'active')
 *     across all terminals in the shared database orders table.
 * - Local-only carts / session storage are NOT deducted.
 */
export function calculateUnifiedAvailableStock(params: {
  item: MenuItem | any;
  variant?: ItemVariant | any;
  rawMaterialsLookup: Map<string, RawMaterialStockData>;
  dishRecipes: any[];
  activeOrders: any[];
}): UnifiedStockResult {
  const { item, variant, rawMaterialsLookup, dishRecipes, activeOrders } = params;

  let databaseStock = 0;
  let limitingIngredient: any = undefined;

  if (variant) {
    // Target is a specific variant
    const matchedBOM =
      variant.recipe && Array.isArray(variant.recipe) && variant.recipe.length > 0
        ? variant.recipe
        : dishRecipes.filter(
            (r: any) =>
              (r.variant_id && String(r.variant_id) === String(variant.id)) ||
              (r.variant_name &&
                variant.name &&
                String(r.variant_name).trim().toLowerCase() ===
                  String(variant.name).trim().toLowerCase())
          );

    const hasBOM = matchedBOM.length > 0;
    if (hasBOM && rawMaterialsLookup.size > 0) {
      const vYield = calculateVariantPortions(
        dishRecipes,
        variant,
        rawMaterialsLookup,
        item.price
      );
      databaseStock = vYield.maxPortions;
      limitingIngredient = vYield.limitingIngredient;
    } else {
      databaseStock =
        typeof variant.stock_count === "number"
          ? variant.stock_count
          : typeof variant.maxPortions === "number"
          ? variant.maxPortions
          : typeof item.stockCount === "number"
          ? item.stockCount
          : typeof item.stock_count === "number"
          ? item.stock_count
          : 20;
    }

    const unfulfilledOrdersQuantity = getItemActiveReservedQuantity(
      activeOrders,
      item,
      variant
    );
    const availableStock = Math.max(0, databaseStock - unfulfilledOrdersQuantity);
    const isOutOfStock = availableStock <= 0;
    const stockStatus: "in_stock" | "low_stock" | "out_of_stock" = isOutOfStock
      ? "out_of_stock"
      : availableStock <= 5
      ? "low_stock"
      : "in_stock";

    return {
      databaseStock,
      unfulfilledOrdersQuantity,
      availableStock,
      isOutOfStock,
      stockStatus,
      limitingIngredient,
    };
  }

  // Target is the main item
  if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
    // If item has variants, calculate each variant and derive item stock from default variant
    const enrichedVariants = item.variants.map((v: any) => {
      const vRes = calculateUnifiedAvailableStock({
        item,
        variant: v,
        rawMaterialsLookup,
        dishRecipes,
        activeOrders,
      });
      return {
        ...v,
        maxPortions: vRes.availableStock,
        availablePortions: vRes.availableStock,
        isOutOfStock: vRes.isOutOfStock,
        stockStatus: vRes.stockStatus,
        limitingIngredient: vRes.limitingIngredient,
      };
    });

    const defaultVar =
      enrichedVariants.find((v: any) => v.isDefault) || enrichedVariants[0];
    const hasAnyInStock = enrichedVariants.some(
      (v: any) => !v.isOutOfStock && v.maxPortions > 0
    );
    const availableStock = defaultVar ? defaultVar.maxPortions : 0;
    const isOutOfStock = !hasAnyInStock;
    const stockStatus: "in_stock" | "low_stock" | "out_of_stock" = isOutOfStock
      ? "out_of_stock"
      : defaultVar?.stockStatus || (hasAnyInStock ? "in_stock" : "out_of_stock");

    return {
      databaseStock: defaultVar ? defaultVar.maxPortions : 0,
      unfulfilledOrdersQuantity: getItemActiveReservedQuantity(activeOrders, item),
      availableStock,
      isOutOfStock,
      stockStatus,
      limitingIngredient: defaultVar?.limitingIngredient,
    };
  }

  // Item has no variants
  const hasRecipe = dishRecipes.length > 0 && rawMaterialsLookup.size > 0;
  if (hasRecipe) {
    const calc = calculateRecipePortions(dishRecipes, item.price, rawMaterialsLookup);
    databaseStock = calc.maxPortions;
    limitingIngredient = calc.limitingIngredient;
  } else {
    databaseStock =
      typeof item.stock_count === "number"
        ? item.stock_count
        : typeof item.stockCount === "number"
        ? item.stockCount
        : 20;
  }

  const unfulfilledOrdersQuantity = getItemActiveReservedQuantity(
    activeOrders,
    item
  );
  const availableStock = Math.max(0, databaseStock - unfulfilledOrdersQuantity);
  const isOutOfStock = availableStock <= 0;
  const stockStatus: "in_stock" | "low_stock" | "out_of_stock" = isOutOfStock
    ? "out_of_stock"
    : availableStock <= 5
    ? "low_stock"
    : "in_stock";

  return {
    databaseStock,
    unfulfilledOrdersQuantity,
    availableStock,
    isOutOfStock,
    stockStatus,
    limitingIngredient,
  };
}

/**
 * Computes a fully unified MenuItem[] catalog with live Available Stock.
 * Shared identically across POS, Waiter, and Admin screens.
 */
export function computeUnifiedMenuCatalog(params: {
  menuRows: any[];
  recipeRows: any[];
  materialRows: any[];
  activeOrders: any[];
}): MenuItem[] {
  const { menuRows, recipeRows = [], materialRows = [], activeOrders = [] } = params;

  // Build raw materials lookup
  const rawMaterialsLookup = new Map<string, RawMaterialStockData>();
  if (Array.isArray(materialRows)) {
    materialRows.forEach((m: any) => {
      rawMaterialsLookup.set(String(m.id), {
        id: m.id,
        name: m.name,
        current_stock: Math.max(0, Number(m.current_stock) || 0),
        min_safety_stock: Number(m.min_safety_stock) || 0,
        cost_per_unit: Number(m.cost_per_unit) || 0,
        unit: m.unit,
      });
    });
  }

  if (Array.isArray(recipeRows)) {
    recipeRows.forEach((r: any) => {
      const rawObj = Array.isArray(r.raw_materials)
        ? r.raw_materials[0]
        : r.raw_materials;
      if (rawObj && rawObj.id && !rawMaterialsLookup.has(String(rawObj.id))) {
        rawMaterialsLookup.set(String(rawObj.id), {
          id: rawObj.id,
          name: rawObj.name,
          current_stock: Math.max(0, Number(rawObj.current_stock) || 0),
          min_safety_stock: Number(rawObj.min_safety_stock) || 0,
          cost_per_unit: Number(rawObj.cost_per_unit) || 0,
          unit: rawObj.unit,
        });
      }
    });
  }

  return (menuRows || []).map((row: any) => {
    const rawItemId = String(row.id);
    const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;

    // Filter recipes for this item
    let dishRecipes = (recipeRows || []).filter(
      (r: any) =>
        String(r.menu_item_id) === rawItemId ||
        String(r.menu_item_id) === baseId
    );

    if (dishRecipes.length === 0) {
      if (Array.isArray(row.recipe) && row.recipe.length > 0) {
        dishRecipes = row.recipe;
      } else if (Array.isArray(row.recipe_items) && row.recipe_items.length > 0) {
        dishRecipes = row.recipe_items;
      }
    }

    // Extract variants
    let variants: any[] | undefined = undefined;
    if (Array.isArray(row.variants) && row.variants.length > 0) {
      variants = row.variants;
    } else if (typeof row.variants === "string") {
      try {
        const parsed = JSON.parse(row.variants);
        if (Array.isArray(parsed) && parsed.length > 0) variants = parsed;
      } catch {}
    }
    if (!variants && row.description) {
      try {
        const parsed = JSON.parse(row.description);
        if (Array.isArray(parsed.variants) && parsed.variants.length > 0) {
          variants = parsed.variants;
        }
      } catch {}
    }
    if (!variants && Array.isArray(row.metadata?.variants) && row.metadata.variants.length > 0) {
      variants = row.metadata.variants;
    }

    const prepMinutes =
      Number(row.preparation_time) ||
      parseInt(String(row.prep_time || "15").replace(/[^0-9]/g, "")) ||
      15;

    const baseMenuItem: MenuItem = {
      id: rawItemId,
      name: row.name,
      category: row.category || "karahi",
      kitchen_station: row.kitchen_station || row.station || undefined,
      station: row.kitchen_station || row.station || undefined,
      price: Number(row.price),
      prepTime: row.prep_time || `${prepMinutes}m`,
      preparation_time: prepMinutes,
      stockStatus: row.stock_status || "in_stock",
      stockCount: row.stock_count ?? 20,
      imageIcon: row.image_icon || "🍲",
      isPopular: Boolean(row.is_popular || row.is_featured || row.isPopular || row.isFeatured),
      is_popular: Boolean(row.is_popular || row.is_featured || row.isPopular || row.isFeatured),
      isFeatured: Boolean(row.is_popular || row.is_featured || row.isPopular || row.isFeatured),
      is_featured: Boolean(row.is_popular || row.is_featured || row.isPopular || row.isFeatured),
      image_url: row.image_url || undefined,
      imageUrl: row.image_url || undefined,
      variants,
    };

    if (variants && variants.length > 0) {
      // Map variants with recipe links
      const mappedVariants: ItemVariant[] = variants.map((v: any, idx: number) => {
        const vId = v.id ? String(v.id) : `var_${rawItemId}_${idx}`;
        const matchedFromRows = (recipeRows || [])
          .filter(
            (r: any) =>
              (String(r.menu_item_id) === rawItemId || String(r.menu_item_id) === baseId) &&
              ((r.variant_id && String(r.variant_id) === vId) ||
                (r.variant_name &&
                  v.name &&
                  String(r.variant_name).trim().toLowerCase() ===
                    String(v.name).trim().toLowerCase()))
          )
          .map((r: any) => {
            const raw = Array.isArray(r.raw_materials)
              ? r.raw_materials[0]
              : r.raw_materials;
            return {
              raw_material_id: r.raw_material_id,
              raw_material_name: raw?.name || "Ingredient",
              quantity_required: Number(r.quantity_required) || 0,
              unit: r.unit || raw?.unit || "",
              cost_per_unit: Number(raw?.cost_per_unit) || 0,
            };
          });

        const effectiveRecipe =
          Array.isArray(v.recipe) && v.recipe.length > 0
            ? v.recipe
            : matchedFromRows;

        const variantObj = {
          ...v,
          id: vId,
          name: String(v.name || `Portion ${idx + 1}`).trim(),
          price: Number(v.price ?? row.price ?? 0),
          isDefault: Boolean(v.isDefault),
          recipe: effectiveRecipe,
        };

        const vStockRes = calculateUnifiedAvailableStock({
          item: baseMenuItem,
          variant: variantObj,
          rawMaterialsLookup,
          dishRecipes,
          activeOrders,
        });

        return {
          ...variantObj,
          maxPortions: vStockRes.availableStock,
          availablePortions: vStockRes.availableStock,
          isOutOfStock: vStockRes.isOutOfStock,
          stockStatus: vStockRes.stockStatus,
          limitingIngredient: vStockRes.limitingIngredient,
          hasRecipe: effectiveRecipe.length > 0,
        };
      });

      const defaultVar =
        mappedVariants.find((v) => v.isDefault) || mappedVariants[0];
      const hasAnyInStock = mappedVariants.some(
        (v) => !v.isOutOfStock && (v.maxPortions ?? 0) > 0
      );
      const isAutoOutOfStock = !hasAnyInStock;
      const stockCount = defaultVar ? (defaultVar.maxPortions ?? 0) : 0;
      const stockStatus = isAutoOutOfStock
        ? "out_of_stock"
        : defaultVar?.stockStatus || (hasAnyInStock ? "in_stock" : "out_of_stock");

      return {
        ...baseMenuItem,
        variants: mappedVariants,
        hasRecipe: mappedVariants.some((v: any) => v.hasRecipe) || dishRecipes.length > 0,
        maxPortions: stockCount,
        availablePortions: stockCount,
        stockCount,
        limitingIngredient: defaultVar?.limitingIngredient,
        isAutoOutOfStock,
        stockStatus,
        is_available: hasAnyInStock,
        in_stock: hasAnyInStock,
      };
    }

    // No variants
    const itemStockRes = calculateUnifiedAvailableStock({
      item: baseMenuItem,
      rawMaterialsLookup,
      dishRecipes,
      activeOrders,
    });

    return {
      ...baseMenuItem,
      hasRecipe: dishRecipes.length > 0,
      maxPortions: itemStockRes.availableStock,
      availablePortions: itemStockRes.availableStock,
      stockCount: itemStockRes.availableStock,
      limitingIngredient: itemStockRes.limitingIngredient,
      isAutoOutOfStock: itemStockRes.isOutOfStock,
      stockStatus: itemStockRes.stockStatus,
      is_available: !itemStockRes.isOutOfStock,
      in_stock: !itemStockRes.isOutOfStock,
    };
  });
}

/**
 * Concurrently fetches live menu items, recipes, raw materials, and unfulfilled
 * orders from Supabase, then applies the unified stock computation.
 */
export async function fetchLiveUnifiedCatalog(
  restaurantId: string | number
): Promise<{
  catalog: MenuItem[];
  rawRecipes: RecipeItemData[];
  rawMaterialsLookup: Map<string, RawMaterialStockData>;
  activeOrders: any[];
}> {
  const supabase = createClient();
  const restId = Number(restaurantId) || restaurantId;

  const [menuRes, recipeRes, materialsRes, ordersRes] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restId)
      .order("created_at", { ascending: false }),
    supabase
      .from("recipe_items")
      .select(
        "menu_item_id, variant_id, variant_name, raw_material_id, quantity_required, unit, raw_materials(id, name, current_stock, min_safety_stock, cost_per_unit, unit)"
      )
      .eq("restaurant_id", restId),
    supabase
      .from("raw_materials")
      .select("id, name, current_stock, min_safety_stock, cost_per_unit, unit")
      .eq("restaurant_id", restId),
    supabase
      .from("orders")
      .select("id, order_number, order_status, payment_status, items")
      .eq("restaurant_id", restId)
      .eq("order_status", "active"),
  ]);

  const menuRows = menuRes.data || [];
  const recipeRows = recipeRes.data || [];
  const materialRows = materialsRes.data || [];
  const activeOrders = ordersRes.data || [];

  const catalog = computeUnifiedMenuCatalog({
    menuRows,
    recipeRows,
    materialRows,
    activeOrders,
  });

  const rawMaterialsLookup = new Map<string, RawMaterialStockData>();
  materialRows.forEach((m: any) => {
    rawMaterialsLookup.set(String(m.id), {
      id: m.id,
      name: m.name,
      current_stock: Math.max(0, Number(m.current_stock) || 0),
      min_safety_stock: Number(m.min_safety_stock) || 0,
      cost_per_unit: Number(m.cost_per_unit) || 0,
      unit: m.unit,
    });
  });

  return {
    catalog,
    rawRecipes: recipeRows,
    rawMaterialsLookup,
    activeOrders,
  };
}
