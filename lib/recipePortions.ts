/**
 * Real-Time Recipe-Based Portion Calculation & Non-Negative Inventory Sync Engine
 *
 * Formula:
 *   Max Portions = min_i ( floor( max(0, Stock_i) / RequiredQty_i ) )
 *
 * Strict Non-Negative Guard:
 *   - Raw material stock is clamped at >= 0 (never negative).
 *   - Calculated available portions are clamped at >= 0.
 *   - If any required ingredient is depleted (stock <= 0 or stock < required), portions locks strictly at 0.
 *   - Status automatically resolves to "out_of_stock", is_available = false, in_stock = false.
 */

export interface RawMaterialStockData {
  id?: string | number;
  name?: string;
  current_stock?: number | string | null;
  min_safety_stock?: number | string | null;
  cost_per_unit?: number | string | null;
  unit?: string | null;
}

export interface RecipeItemData {
  id?: string | number;
  menu_item_id?: string | number;
  raw_material_id?: string | number;
  quantity_required: number | string;
  unit?: string | null;
  raw_materials?: RawMaterialStockData | RawMaterialStockData[] | any | null;
}

export interface RecipeCalculationResult {
  hasRecipe: boolean;
  maxPortions: number; // Integer >= 0
  exactPortions: number; // Exact float >= 0
  isOutOfStock: boolean;
  isAutoOutOfStock: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  totalCost: number;
  recipeMargin: number;
  limitingIngredient?: {
    name: string;
    currentStock: number;
    requiredQty: number;
    unit: string;
    maxPortions: number;
  };
  depletedIngredients: string[];
  missingIngredients: string[];
}

/**
 * Calculates dynamic available portions for a dish based on raw material inventory.
 */
export function calculateRecipePortions(
  dishRecipes: RecipeItemData[] | any[],
  sellingPrice: number = 0,
  rawMaterialsLookup?: Map<string, RawMaterialStockData>
): RecipeCalculationResult {
  if (!dishRecipes || dishRecipes.length === 0) {
    return {
      hasRecipe: false,
      maxPortions: Infinity,
      exactPortions: Infinity,
      isOutOfStock: false,
      isAutoOutOfStock: false,
      stockStatus: "in_stock",
      totalCost: 0,
      recipeMargin: 0,
      depletedIngredients: [],
      missingIngredients: [],
    };
  }

  let totalCost = 0;
  let minPortions = Infinity;
  let minExact = Infinity;
  let limiting: RecipeCalculationResult["limitingIngredient"] = undefined;
  const depleted: string[] = [];
  const missing: string[] = [];

  for (const r of dishRecipes) {
    const rawObj = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
    const liveRaw =
      rawMaterialsLookup && r.raw_material_id
        ? rawMaterialsLookup.get(String(r.raw_material_id))
        : null;
    const raw = liveRaw || rawObj;

    const reqQty = Math.max(0, Number(r.quantity_required) || 0);
    const costPerUnit = Math.max(0, Number(raw?.cost_per_unit) || 0);
    totalCost += reqQty * costPerUnit;

    // Strict non-negative guard for stock: clamp at >= 0
    const rawStock = Number(raw?.current_stock);
    const currentStock = Math.max(0, isNaN(rawStock) ? 0 : rawStock);
    const matName = raw?.name || "Ingredient";
    const unitStr = r.unit || raw?.unit || "";

    if (reqQty > 0) {
      const exactRatio = currentStock / reqQty;
      const wholePortions = Math.max(0, Math.floor(exactRatio));

      if (wholePortions < minPortions) {
        minPortions = wholePortions;
        minExact = Math.max(0, exactRatio);
        limiting = {
          name: matName,
          currentStock,
          requiredQty: reqQty,
          unit: unitStr,
          maxPortions: wholePortions,
        };
      }

      if (currentStock <= 0) {
        depleted.push(`${matName} (Depleted: 0 ${unitStr})`);
        missing.push(`${matName} (Req: ${reqQty} ${unitStr}, Stock: 0 ${unitStr})`);
      } else if (currentStock < reqQty) {
        missing.push(`${matName} (Req: ${reqQty} ${unitStr}, Stock: ${currentStock} ${unitStr})`);
      }
    }
  }

  // Clamped at 0: never negative
  const maxPortions = minPortions === Infinity ? 0 : Math.max(0, minPortions);
  const exactPortions = minExact === Infinity ? 0 : Math.max(0, Math.round(minExact * 100) / 100);
  const isOutOfStock = maxPortions < 1;
  const isAutoOutOfStock = isOutOfStock;
  const stockStatus: "in_stock" | "low_stock" | "out_of_stock" =
    maxPortions < 1
      ? "out_of_stock"
      : maxPortions <= 5
      ? "low_stock"
      : "in_stock";

  const recipeMargin =
    sellingPrice > 0
      ? Math.round(((sellingPrice - totalCost) / sellingPrice) * 100)
      : 0;

  return {
    hasRecipe: true,
    maxPortions,
    exactPortions,
    isOutOfStock,
    isAutoOutOfStock,
    stockStatus,
    totalCost: Math.round(totalCost * 100) / 100,
    recipeMargin,
    limitingIngredient: limiting,
    depletedIngredients: depleted,
    missingIngredients: missing,
  };
}

/**
 * Enriches a list of menu items with real-time recipe calculations,
 * updating portions, food cost, margin, and stock status seamlessly.
 */
export function applyRecipeCalculationsToMenu<T extends Record<string, any>>(
  menuItems: T[],
  recipeRows: RecipeItemData[] | any[] = [],
  rawMaterialsLookup?: Map<string, RawMaterialStockData>
): T[] {
  // Build raw materials lookup from lookup or recipeRows if available
  const lookup = rawMaterialsLookup
    ? new Map(rawMaterialsLookup)
    : new Map<string, RawMaterialStockData>();

  if (recipeRows && Array.isArray(recipeRows)) {
    for (const r of recipeRows) {
      const rawObj = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
      if (rawObj && rawObj.id && !lookup.has(String(rawObj.id))) {
        lookup.set(String(rawObj.id), {
          id: rawObj.id,
          name: rawObj.name,
          current_stock: Math.max(0, Number(rawObj.current_stock) || 0),
          min_safety_stock: Number(rawObj.min_safety_stock) || 0,
          cost_per_unit: Number(rawObj.cost_per_unit) || 0,
          unit: rawObj.unit,
        });
      }
    }
  }

  return menuItems.map((item) => {
    const rawItemId = String(item.id);
    const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;
    let dishRecipes = (recipeRows || []).filter(
      (r) =>
        String(r.menu_item_id) === rawItemId ||
        String(r.menu_item_id) === baseId
    );

    if (dishRecipes.length === 0) {
      if (Array.isArray((item as any).recipe) && (item as any).recipe.length > 0) {
        dishRecipes = (item as any).recipe;
      } else if (Array.isArray((item as any).recipe_items) && (item as any).recipe_items.length > 0) {
        dishRecipes = (item as any).recipe_items;
      }
    }

    // If item has variants, calculate each variant independently from live stock ledger
    if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
      const enrichedVariants = item.variants.map((v: any) => {
        const vYield = calculateVariantPortions(
          dishRecipes,
          v,
          lookup,
          item.price
        );
        const hasVariantBOM = vYield.resolvedBOM.length > 0;
        const vBasePortions =
          typeof v.maxPortions === "number"
            ? v.maxPortions
            : typeof (v as any).availablePortions === "number"
            ? (v as any).availablePortions
            : typeof item.stockCount === "number"
            ? item.stockCount
            : 20;
        const portions = hasVariantBOM && lookup.size > 0 ? vYield.maxPortions : vBasePortions;
        const isOutOfStock = portions <= 0;
        return {
          ...v,
          recipe: hasVariantBOM ? vYield.resolvedBOM : v.recipe,
          hasRecipe: hasVariantBOM,
          maxPortions: portions,
          availablePortions: portions,
          isOutOfStock,
          stockStatus: isOutOfStock ? "out_of_stock" : (portions <= 5 ? "low_stock" : "in_stock"),
          limitingIngredient: vYield.limitingIngredient,
          foodCost: vYield.foodCost,
        };
      });

      const defaultVar = enrichedVariants.find((v: any) => v.isDefault) || enrichedVariants[0];
      const hasAnyInStock = enrichedVariants.some((v: any) => !v.isOutOfStock && v.maxPortions > 0);
      const allOutOfStock = !hasAnyInStock;
      const hasAnyRecipe = enrichedVariants.some((v: any) => v.hasRecipe) || dishRecipes.length > 0;

      return {
        ...item,
        hasRecipe: hasAnyRecipe,
        variants: enrichedVariants,
        maxPortions: defaultVar ? defaultVar.maxPortions : 0,
        availablePortions: defaultVar ? defaultVar.maxPortions : 0,
        stockCount: defaultVar ? defaultVar.maxPortions : 0,
        limitingIngredient: defaultVar?.limitingIngredient,
        isAutoOutOfStock: allOutOfStock,
        stockStatus: allOutOfStock
          ? "out_of_stock"
          : defaultVar?.stockStatus || (hasAnyInStock ? "in_stock" : "out_of_stock"),
        is_available: hasAnyInStock,
        in_stock: hasAnyInStock,
      };
    }

    if (dishRecipes.length === 0) {
      return {
        ...item,
        hasRecipe: false,
        isAutoOutOfStock: false,
      };
    }

    const price = Number(item.price) || 0;
    const calc = calculateRecipePortions(dishRecipes, price, lookup);

    return {
      ...item,
      hasRecipe: calc.hasRecipe,
      recipeCost: calc.totalCost,
      recipeMargin: calc.recipeMargin,
      maxPortions: calc.maxPortions,
      availablePortions: calc.maxPortions,
      stockCount: calc.maxPortions,
      limitingIngredient: calc.limitingIngredient,
      missingIngredients: calc.missingIngredients,
      isAutoOutOfStock: calc.isAutoOutOfStock,
      stockStatus: calc.isAutoOutOfStock ? "out_of_stock" : (calc.stockStatus || "in_stock"),
      is_available: !calc.isOutOfStock,
      in_stock: !calc.isOutOfStock,
    };
  });
}

export interface CartItemLike {
  item: {
    id: string | number;
    name?: string;
    price?: number;
    selectedVariant?: any;
    variants?: any[];
  };
  quantity: number;
}

/**
 * Derives the ingredient multiplier for a specific variant.
 */
export function getVariantMultiplier(
  variant?: { name?: string; price?: number; quantity_multiplier?: number } | null,
  basePrice?: number
): number {
  if (!variant) return 1;
  if (typeof variant.quantity_multiplier === "number" && variant.quantity_multiplier > 0) {
    return variant.quantity_multiplier;
  }
  const name = (variant.name || "").toLowerCase().trim();

  // 1. Explicit decimal or integer in variant name (e.g. "1.5 kg", "1.5x", "2x", "2 petti", "2 patty", "0.5")
  const explicitNum = name.match(/(?:^|[(\s])(\d+(?:\.\d+)?)\s*(?:x|kg|petti|patty|pc|pcs|portion)?(?:\s|[)]|$)/i);
  if (explicitNum && explicitNum[1]) {
    const val = parseFloat(explicitNum[1]);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  }

  // 2. Named variants
  if (/(?:quadruple|4\s*x|4\s*petti|4\s*patty|4-petti|4-patty)/i.test(name)) return 4;
  if (/(?:triple|3\s*x|3\s*petti|3\s*patty|3-petti|3-patty|jumbo|family|mega)/i.test(name)) return 3;
  if (/(?:double|2\s*x|2\s*petti|2\s*patty|2-petti|2-patty|mighty|full|large|xl|extra\s*large)/i.test(name)) return 2;
  if (/(?:quarter|small|mini|250ml|250g|0\.25)/i.test(name)) return 0.5;
  if (/(?:half|half\s*portion|500ml|500g|0\.5)/i.test(name)) return 0.5;
  if (/(?:single|1\s*x|1\s*petti|1\s*patty|1-petti|1-patty|medium|regular|standard|1\s*portion)/i.test(name)) return 1;

  if (basePrice && basePrice > 0 && variant.price && variant.price > basePrice) {
    const ratio = Math.round((variant.price / basePrice) * 10) / 10;
    if (ratio >= 2.5) return 3;
    if (ratio >= 1.6) return 2;
    if (ratio >= 1.3) return 1.5;
  }
  return 1;
}

export interface PortionYieldMetrics {
  foodCost: number;
  availablePortions: number;
  maxPortions: number;
  exactPortions: number;
  grossMargin: number;
  marginPct: number;
  limitingIngredientName: string;
  isDepleted: boolean;
  isOutOfStock: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  limitingIngredient?: {
    name: string;
    currentStock: number;
    requiredQty: number;
    unit: string;
    portions: number;
  };
  depletedIngredients: string[];
  missingIngredients: string[];
}

/**
 * Authoritative mathematical portion calculation function.
 * Formula:
 *   Max Portions = min_i ( floor( max(0, Stock_i) / RequiredQty_i ) )
 *
 * Strict non-negative inventory guard:
 *   - Current stock is clamped at >= 0.
 *   - Evaluates whole portions independently with integer flooring (zero fractional loss).
 *   - Operates identically whether given a Map or an Array of raw materials.
 */
export function calculateIngredientsPortionYield(
  recipeItems: Array<{
    raw_material_id: string | number;
    raw_material_name?: string;
    quantity_required: number | string;
    unit?: string | null;
    cost_per_unit?: number | string | null;
  }> | any[],
  materialsSource: Map<string, RawMaterialStockData> | RawMaterialStockData[] | any[],
  sellingPrice: number = 0
): PortionYieldMetrics {
  if (!recipeItems || recipeItems.length === 0) {
    return {
      foodCost: 0,
      availablePortions: 99,
      maxPortions: 99,
      exactPortions: 99,
      grossMargin: Math.round(sellingPrice),
      marginPct: sellingPrice > 0 ? 100 : 0,
      limitingIngredientName: "",
      isDepleted: false,
      isOutOfStock: false,
      stockStatus: "in_stock",
      depletedIngredients: [],
      missingIngredients: [],
    };
  }

  const getMaterial = (id: string | number, fallback?: any, matName?: string): RawMaterialStockData | undefined => {
    const strId = String(id);
    let found: RawMaterialStockData | undefined = undefined;
    if (materialsSource instanceof Map) {
      found =
        materialsSource.get(strId) ||
        (typeof id === "number" ? materialsSource.get(id as any) : undefined);
      if (!found) {
        for (const [k, v] of materialsSource.entries()) {
          if (String(k) === strId || String(v.id) === strId) {
            found = v;
            break;
          }
          if (matName && v.name && v.name.trim().toLowerCase() === matName.trim().toLowerCase()) {
            found = v;
            break;
          }
        }
      }
    } else if (Array.isArray(materialsSource)) {
      found = materialsSource.find(
        (m) =>
          String(m.id) === strId ||
          (matName && m.name && m.name.trim().toLowerCase() === matName.trim().toLowerCase())
      );
    }
    if (found) return found;

    if (fallback) {
      const raw = Array.isArray(fallback) ? fallback[0] : fallback;
      if (raw && (raw.id || raw.current_stock !== undefined)) {
        return {
          id: raw.id || strId,
          name: raw.name || matName || "Ingredient",
          current_stock: Math.max(0, Number(raw.current_stock) || 0),
          cost_per_unit: Number(raw.cost_per_unit) || 0,
          unit: raw.unit || "",
        };
      }
    }
    return undefined;
  };

  let foodCost = 0;
  let minPortions = Infinity;
  let minExact = Infinity;
  let limitingIngredientName = "";
  let limiting: PortionYieldMetrics["limitingIngredient"] = undefined;
  let isDepleted = false;
  const depleted: string[] = [];
  const missing: string[] = [];
  let hasValidRequirement = false;

  for (const item of recipeItems) {
    const raw = getMaterial(item.raw_material_id, (item as any).raw_materials, item.raw_material_name);
    const unitCost =
      raw?.cost_per_unit !== undefined
        ? Number(raw.cost_per_unit)
        : Number(item.cost_per_unit) || 0;
    const reqQty = Math.max(0, Number(item.quantity_required) || 0);
    foodCost += reqQty * unitCost;

    if (reqQty > 0) {
      hasValidRequirement = true;
      const rawStock = Number(raw?.current_stock);
      const currentStock = Math.max(0, isNaN(rawStock) ? 0 : rawStock);
      const matName = raw?.name || item.raw_material_name || "Ingredient";
      const unitStr = item.unit || raw?.unit || "";

      // Strict mathematical flooring: floor(Remaining Stock / Required Qty)
      // Guard against IEEE-754 float precision loss with 1e-9 epsilon while strictly flooring whole portions
      const exactRatio = (currentStock + 1e-9) / reqQty;
      const wholePortions = Math.max(0, Math.floor(exactRatio));

      if (wholePortions < minPortions) {
        minPortions = wholePortions;
        minExact = exactRatio;
        limitingIngredientName = matName;
        limiting = {
          name: matName,
          currentStock,
          requiredQty: reqQty,
          unit: unitStr,
          portions: wholePortions,
        };
      }

      if (currentStock <= 0) {
        isDepleted = true;
        depleted.push(`${matName} (Depleted: 0 ${unitStr})`);
        missing.push(`${matName} (Req: ${reqQty} ${unitStr}, Stock: 0 ${unitStr})`);
      } else if (currentStock < reqQty) {
        isDepleted = true;
        missing.push(`${matName} (Req: ${reqQty} ${unitStr}, Stock: ${currentStock} ${unitStr})`);
      }
    }
  }

  const wholePortions =
    !hasValidRequirement || minPortions === Infinity ? 0 : Math.max(0, minPortions);
  const exactPortions =
    !hasValidRequirement || minExact === Infinity
      ? 0
      : Math.max(0, Math.round(minExact * 100) / 100);
  const isOutOfStock = wholePortions < 1;
  const stockStatus: "in_stock" | "low_stock" | "out_of_stock" =
    wholePortions < 1
      ? "out_of_stock"
      : wholePortions <= 5
      ? "low_stock"
      : "in_stock";

  const grossMargin = sellingPrice - foodCost;
  const marginPct = sellingPrice > 0 ? (grossMargin / sellingPrice) * 100 : 0;

  return {
    foodCost: Math.round(foodCost * 100) / 100,
    availablePortions: wholePortions,
    maxPortions: wholePortions,
    exactPortions,
    grossMargin: Math.round(grossMargin),
    marginPct: Math.round(marginPct),
    limitingIngredientName,
    isDepleted,
    isOutOfStock,
    stockStatus,
    limitingIngredient: limiting,
    depletedIngredients: depleted,
    missingIngredients: missing,
  };
}

/**
 * Calculates remaining available portions for a specific size variant based on effective stock.
 * Evaluates independently without artificial pricing ratios or shared pool interference.
 */
export interface ResolvedVariantIngredient {
  raw_material_id: string | number;
  raw_material_name?: string;
  quantity_required: number;
  unit?: string | null;
  cost_per_unit?: number | null;
}

/**
 * Checks whether a recipe_items row belongs specifically to a given size variant.
 */
export function isRecipeRowForVariant(
  row: { variant_id?: string | number | null; variant_name?: string | null },
  variant: { id?: string | number; name?: string }
): boolean {
  if (!variant) return false;
  const vId = variant.id !== undefined && variant.id !== null ? String(variant.id).trim() : "";
  const vName = (variant.name || "").trim().toLowerCase();

  const rId = row.variant_id !== undefined && row.variant_id !== null ? String(row.variant_id).trim() : "";
  const rName = (row.variant_name || "").trim().toLowerCase();

  if (rId && vId) {
    if (rId === vId || vId.endsWith(`_${rId}`) || rId.endsWith(`_${vId}`)) return true;
  }

  if (rName && vName) {
    if (rName === vName) return true;
    const vWords = vName.split(/[\s-_(),.]+/).filter(Boolean);
    const rWords = rName.split(/[\s-_(),.]+/).filter(Boolean);
    if (rWords.length > 0 && rWords.every((w) => vWords.includes(w))) return true;
    if (vWords.length > 0 && vWords.every((w) => rWords.includes(w))) return true;
    if (vName.includes(rName) || rName.includes(vName)) return true;
  }

  return false;
}

/**
 * Resolves the explicit, independent BOM ingredient list for a size variant.
 * Guarantees zero shared pool bleed or generic parent item fallback.
 */
export function resolveVariantBOM(
  variant: {
    id?: string | number;
    name?: string;
    price?: number;
    raw_material_id?: string | number;
    raw_material_qty?: number;
    quantity_multiplier?: number;
    recipe?: Array<{
      raw_material_id: string | number;
      raw_material_name?: string;
      quantity_required: number | string;
      unit?: string | null;
      cost_per_unit?: number | string | null;
    }>;
  } | null | undefined,
  dishRecipes: RecipeItemData[] | any[] = [],
  basePrice?: number
): ResolvedVariantIngredient[] {
  if (!variant) return [];

  // 1. Direct variant-specific recipe array (configured in Dedicated Sizing Recipe Builder)
  if (variant.recipe && Array.isArray(variant.recipe) && variant.recipe.length > 0) {
    const valid = variant.recipe
      .filter((r: any) => Number(r.quantity_required) > 0)
      .map((r: any) => ({
        raw_material_id: r.raw_material_id,
        raw_material_name: r.raw_material_name || "Ingredient",
        quantity_required: Number(r.quantity_required) || 0,
        unit: r.unit || "",
        cost_per_unit: Number(r.cost_per_unit) || 0,
      }));
    if (valid.length > 0) return valid;
  }

  // 2. Direct single raw material on variant
  if (variant.raw_material_id && Number(variant.raw_material_qty) > 0) {
    return [
      {
        raw_material_id: variant.raw_material_id,
        raw_material_name: "Ingredient",
        quantity_required: Number(variant.raw_material_qty),
        unit: "",
        cost_per_unit: 0,
      },
    ];
  }

  if (!dishRecipes || dishRecipes.length === 0) {
    return [];
  }

  // 3. Match from dishRecipes table rows
  const variantSpecificRows = dishRecipes.filter((r: any) =>
    isRecipeRowForVariant(r, variant as any)
  );
  const baseDishRows = dishRecipes.filter(
    (r: any) => !r.variant_id && !r.variant_name
  );

  if (variantSpecificRows.length > 0) {
    const resolved: ResolvedVariantIngredient[] = variantSpecificRows.map((r: any) => {
      const raw = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
      return {
        raw_material_id: r.raw_material_id,
        raw_material_name: raw?.name || r.raw_material_name || "Ingredient",
        quantity_required: Math.max(0, Number(r.quantity_required) || 0),
        unit: r.unit || raw?.unit || "",
        cost_per_unit: Number(raw?.cost_per_unit) || 0,
      };
    });

    // Include non-overlapping base dish ingredients (e.g. Bun / packaging is base, Patty is variant-specific)
    for (const b of baseDishRows) {
      if (!resolved.some((x) => String(x.raw_material_id) === String(b.raw_material_id))) {
        const raw = Array.isArray(b.raw_materials) ? b.raw_materials[0] : b.raw_materials;
        resolved.push({
          raw_material_id: b.raw_material_id,
          raw_material_name: raw?.name || b.raw_material_name || "Ingredient",
          quantity_required: Math.max(0, Number(b.quantity_required) || 0),
          unit: b.unit || raw?.unit || "",
          cost_per_unit: Number(raw?.cost_per_unit) || 0,
        });
      }
    }

    return resolved;
  }

  // 4. Base dish rows scaled by derived multiplier
  const candidateBaseRows = baseDishRows.length > 0 ? baseDishRows : dishRecipes;
  if (candidateBaseRows.length > 0) {
    const multiplier = getVariantMultiplier(variant, basePrice);
    return candidateBaseRows.map((r: any) => {
      const raw = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
      const baseReq = Math.max(0, Number(r.quantity_required) || 0);
      return {
        raw_material_id: r.raw_material_id,
        raw_material_name: raw?.name || r.raw_material_name || "Ingredient",
        quantity_required: Math.max(0, Math.round(baseReq * multiplier * 1000) / 1000),
        unit: r.unit || raw?.unit || "",
        cost_per_unit: Number(raw?.cost_per_unit) || 0,
      };
    });
  }

  return [];
}

/**
 * Calculates remaining available portions for a specific size variant based on effective stock.
 * Formula:
 *   Variant Max Portions = min_i ( floor( Simulated Stock_i / Variant Required Qty_i ) )
 */
export function calculateVariantPortions(
  dishRecipes: RecipeItemData[] | any[],
  variant: {
    id?: string | number;
    name: string;
    price?: number;
    raw_material_id?: string | number;
    raw_material_qty?: number;
    quantity_multiplier?: number;
    recipe?: Array<{
      raw_material_id: string | number;
      raw_material_name?: string;
      quantity_required: number | string;
      unit?: string | null;
      cost_per_unit?: number | string | null;
    }>;
  },
  effectiveMaterialsMap: Map<string, RawMaterialStockData> | RawMaterialStockData[] | any[],
  basePrice?: number
): {
  maxPortions: number;
  exactPortions: number;
  isOutOfStock: boolean;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  limitingIngredient?: string;
  foodCost: number;
  resolvedBOM: ResolvedVariantIngredient[];
} {
  const resolvedBOM = resolveVariantBOM(variant, dishRecipes, basePrice);

  if (resolvedBOM.length === 0) {
    return {
      maxPortions: 0,
      exactPortions: 0,
      isOutOfStock: true,
      stockStatus: "out_of_stock",
      limitingIngredient: undefined,
      foodCost: 0,
      resolvedBOM: [],
    };
  }

  const yieldRes = calculateIngredientsPortionYield(
    resolvedBOM,
    effectiveMaterialsMap,
    variant.price || 0
  );

  return {
    maxPortions: yieldRes.maxPortions,
    exactPortions: yieldRes.exactPortions,
    isOutOfStock: yieldRes.isOutOfStock,
    stockStatus: yieldRes.stockStatus,
    limitingIngredient: yieldRes.limitingIngredientName,
    foodCost: yieldRes.foodCost,
    resolvedBOM,
  };
}

/**
 * Simulates raw material consumption for items currently in cart,
 * producing an effective inventory state in memory without touching the database.
 * Supports temporary reservations from active, undelivered orders to prevent double-ordering.
 * Every size variant strictly consumes its own unique recipe quantities.
 */
export function simulateCartRawMaterials(
  cart: CartItemLike[],
  recipeRows: RecipeItemData[] | any[],
  baseMaterials: Map<string, RawMaterialStockData>,
  reservedMaterials?: Map<string, number>
): Map<string, RawMaterialStockData> {
  const effective = new Map<string, RawMaterialStockData>();
  baseMaterials.forEach((v, k) => {
    const rawStock = Math.max(0, Number(v.current_stock) || 0);
    const reserved = reservedMaterials
      ? (reservedMaterials.get(String(k)) ?? reservedMaterials.get(String(v.id ?? "")) ?? 0)
      : 0;
    const effectiveStock = Math.max(0, Math.round((rawStock - reserved) * 1000) / 1000);
    effective.set(String(k), { ...v, current_stock: effectiveStock });
  });

  // Seed any raw materials from recipeRows if not already in effective
  if (recipeRows && Array.isArray(recipeRows)) {
    for (const r of recipeRows) {
      const rawObj = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
      if (rawObj && rawObj.id && !effective.has(String(rawObj.id))) {
        const rawStock = Math.max(0, Number(rawObj.current_stock) || 0);
        const reserved = reservedMaterials
          ? (reservedMaterials.get(String(rawObj.id)) ?? 0)
          : 0;
        const effectiveStock = Math.max(0, Math.round((rawStock - reserved) * 1000) / 1000);
        effective.set(String(rawObj.id), {
          id: rawObj.id,
          name: rawObj.name,
          current_stock: effectiveStock,
          min_safety_stock: Number(rawObj.min_safety_stock) || 0,
          cost_per_unit: Number(rawObj.cost_per_unit) || 0,
          unit: rawObj.unit,
        });
      }
    }
  }

  if (!cart || cart.length === 0) {
    return effective;
  }

  const deductIngredient = (
    matId: string | number,
    reqQty: number,
    totalDeductQty: number,
    matName?: string
  ) => {
    const strId = String(matId);
    let target = effective.get(strId);
    if (!target) {
      for (const [k, v] of effective.entries()) {
        if (String(k) === strId || String(v.id) === strId) {
          target = v;
          break;
        }
        if (matName && v.name && v.name.trim().toLowerCase() === matName.trim().toLowerCase()) {
          target = v;
          break;
        }
      }
    }
    if (target) {
      const curStock = Math.max(0, Number(target.current_stock) || 0);
      const deductAmt = reqQty * totalDeductQty;
      target.current_stock = Math.max(0, Math.round((curStock - deductAmt) * 1000) / 1000);
    }
  };

  for (const c of cart) {
    const qty = Number(c.quantity) || 1;
    if (qty <= 0) continue;

    const rawItemId = String(c.item.id);
    const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;

    // Find all recipe rows for this dish
    let allDishRecipes = (recipeRows || []).filter(
      (r: any) =>
        String(r.menu_item_id) === baseId ||
        String(r.menu_item_id) === rawItemId
    );

    if (allDishRecipes.length === 0) {
      if (Array.isArray((c.item as any).recipe) && (c.item as any).recipe.length > 0) {
        allDishRecipes = (c.item as any).recipe;
      } else if (Array.isArray((c.item as any).recipe_items) && (c.item as any).recipe_items.length > 0) {
        allDishRecipes = (c.item as any).recipe_items;
      }
    }

    // Identify variant object: from selectedVariant or matched within item.variants
    let variantObj = c.item.selectedVariant || (c as any).selectedVariant;
    if (!variantObj && Array.isArray(c.item.variants) && c.item.variants.length > 0) {
      variantObj = c.item.variants.find((v: any) => {
        const vId = String(v.id || "");
        const vName = String(v.name || "").trim().toLowerCase();
        return (
          (vId && (rawItemId.endsWith(`_${vId}`) || rawItemId === vId)) ||
          (vName && (rawItemId.endsWith(`_${vName.replace(/\s+/g, "_")}`) || (c.item.name || "").toLowerCase().includes(vName)))
        );
      });
    }

    if (variantObj) {
      // Resolve variant-specific BOM: prevents shared pool bleed and ensures exact sizing quantities
      const bom = resolveVariantBOM(variantObj, allDishRecipes, c.item.price);
      if (bom.length > 0) {
        for (const ing of bom) {
          deductIngredient(
            ing.raw_material_id,
            Number(ing.quantity_required) || 0,
            qty,
            ing.raw_material_name
          );
        }
        continue;
      }
    }

    // Direct single raw material on item
    if ((c.item as any).raw_material_id && Number((c.item as any).raw_material_qty) > 0) {
      deductIngredient(
        (c.item as any).raw_material_id,
        Number((c.item as any).raw_material_qty),
        qty,
        (c.item as any).raw_material_name
      );
      continue;
    }

    // Single size item or base dish without variant BOM
    const baseRecipes = allDishRecipes.filter((r: any) => !r.variant_id && !r.variant_name);
    const activeRecipes = baseRecipes.length > 0 ? baseRecipes : allDishRecipes;

    for (const r of activeRecipes) {
      const matId = String(r.raw_material_id);
      const reqQty = Math.max(0, Number(r.quantity_required) || 0);
      const rawName =
        r.raw_material_name ||
        (Array.isArray(r.raw_materials) ? r.raw_materials[0]?.name : r.raw_materials?.name);
      deductIngredient(matId, reqQty, qty, rawName);
    }
  }

  return effective;
}

/**
 * Returns the exact current quantity of an item (or variant) currently in the active cart.
 */
export function getItemCartQuantity(
  cart: Array<{ item: { id: string | number; name?: string; selectedVariant?: any }; quantity: number }>,
  item: { id: string | number; name?: string },
  variant?: { id?: string | number; name?: string }
): number {
  if (!cart || cart.length === 0) return 0;
  const rawItemId = String(item.id);
  const baseItemId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;

  return cart.reduce((total, c) => {
    const cRawId = String(c.item.id);
    const cBaseId = cRawId.includes("_") ? cRawId.split("_")[0] : cRawId;
    if (cBaseId !== baseItemId && cRawId !== rawItemId) {
      return total;
    }

    if (variant) {
      const cVar = c.item.selectedVariant;
      const vId = variant.id !== undefined && variant.id !== null ? String(variant.id) : "";
      const vName = (variant.name || "").trim().toLowerCase();

      const matchesVariant =
        (cVar && vId && String(cVar.id) === vId) ||
        (cVar && vName && cVar.name && String(cVar.name).trim().toLowerCase() === vName) ||
        (vId && cRawId.endsWith(`_${vId}`)) ||
        (vName && (cRawId.endsWith(`_${vName.replace(/\s+/g, "_")}`) || (c.item.name || "").toLowerCase().includes(vName)));

      return matchesVariant ? total + (Number(c.quantity) || 0) : total;
    }

    // Single size item
    if (!c.item.selectedVariant) {
      return total + (Number(c.quantity) || 0);
    }

    return total;
  }, 0);
}

export interface ActiveOrderLike {
  id?: string | number;
  status?: string;
  order_status?: string;
  is_deducted?: boolean;
  isDeducted?: boolean;
  items?: Array<{
    id?: string | number;
    name?: string;
    qty?: number;
    quantity?: number;
    selectedVariant?: any;
    variant?: any;
    variant_id?: string | number | null;
    variant_name?: string | null;
    price?: number;
    preparation_time?: number;
    is_deducted?: boolean;
    isDeducted?: boolean;
    item?: any;
  }>;
}

/**
 * Computes raw material quantities temporarily reserved across all active, undelivered orders.
 * Orders marked 'completed', 'served', 'cancelled', 'voided', 'archived', or with isDeducted: true
 * are excluded from reservation since their raw material impact is either permanently settled or canceled.
 */
export function computeReservedMaterialsFromActiveOrders(
  activeOrders: ActiveOrderLike[] = [],
  recipeRows: RecipeItemData[] | any[] = []
): Map<string, number> {
  const reservedMap = new Map<string, number>();
  if (!activeOrders || activeOrders.length === 0) return reservedMap;

  const addReservation = (matId: string | number, qty: number) => {
    if (!matId || qty <= 0) return;
    const strId = String(matId);
    const existing = reservedMap.get(strId) || 0;
    reservedMap.set(strId, Math.round((existing + qty) * 1000) / 1000);
  };

  for (const ord of activeOrders) {
    const status = String(ord.status || ord.order_status || "").toLowerCase().trim();
    const isOrderDeducted = Boolean(
      ord.is_deducted === true ||
      ord.isDeducted === true ||
      String((ord as any).is_deducted) === "true" ||
      String((ord as any).isDeducted) === "true" ||
      (Array.isArray(ord.items) && ord.items.some((it: any) => it.is_deducted === true || it.isDeducted === true)) ||
      (typeof ord.items === "object" && ord.items !== null && ((ord.items as any).is_deducted === true || (ord.items as any).isDeducted === true))
    );

    if (
      status === "completed" ||
      status === "served" ||
      status === "cancelled" ||
      status === "voided" ||
      status === "archived" ||
      isOrderDeducted
    ) {
      continue;
    }

    const items = ord.items;
    if (!items || !Array.isArray(items)) continue;

    for (const it of items) {
      const qty = Number(it.qty ?? it.quantity ?? (it as any).item?.quantity ?? 1);
      if (qty <= 0) continue;

      const rawItemId = it.id ? String(it.id) : (it as any).item?.id ? String((it as any).item.id) : "";
      const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;

      let allDishRecipes = (recipeRows || []).filter(
        (r: any) =>
          String(r.menu_item_id) === baseId ||
          String(r.menu_item_id) === rawItemId
      );

      if (allDishRecipes.length === 0) {
        if (Array.isArray((it as any).recipe) && (it as any).recipe.length > 0) {
          allDishRecipes = (it as any).recipe;
        } else if (Array.isArray((it as any).recipe_items) && (it as any).recipe_items.length > 0) {
          allDishRecipes = (it as any).recipe_items;
        }
      }

      // Identify variant object
      let variantObj =
        it.selectedVariant ||
        it.variant ||
        (it as any).item?.selectedVariant ||
        (it as any).item?.variant;

      if (!variantObj && (it.variant_id || it.variant_name)) {
        variantObj = { id: it.variant_id, name: it.variant_name };
      }

      if (variantObj) {
        const bom = resolveVariantBOM(variantObj, allDishRecipes, it.price ?? (it as any).item?.price);
        if (bom.length > 0) {
          for (const ing of bom) {
            const reqQty = Number(ing.quantity_required) || 0;
            addReservation(ing.raw_material_id, reqQty * qty);
          }
          continue;
        }
      }

      // Base recipes
      const baseRecipes = allDishRecipes.filter((r: any) => !r.variant_id && !r.variant_name);
      const activeRecipes = baseRecipes.length > 0 ? baseRecipes : allDishRecipes;

      for (const r of activeRecipes) {
        const reqQty = Number(r.quantity_required) || 0;
        addReservation(r.raw_material_id, reqQty * qty);
      }
    }
  }

  return reservedMap;
}

/**
 * Calculates the total portion count of a specific menu item or variant currently reserved in active orders.
 */
export function getItemActiveReservedQuantity(
  activeOrders: ActiveOrderLike[] = [],
  item: { id: string | number; name?: string },
  variant?: { id?: string | number; name?: string }
): number {
  if (!activeOrders || activeOrders.length === 0) return 0;
  const rawItemId = String(item.id);
  const baseItemId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;
  const itemName = (item.name || "").trim().toLowerCase();

  let totalReserved = 0;

  for (const ord of activeOrders) {
    const status = String(ord.status || ord.order_status || "").toLowerCase().trim();
    const isOrderDeducted = Boolean(
      ord.is_deducted === true ||
      ord.isDeducted === true ||
      String((ord as any).is_deducted) === "true" ||
      String((ord as any).isDeducted) === "true" ||
      (Array.isArray(ord.items) && ord.items.some((it: any) => it.is_deducted === true || it.isDeducted === true)) ||
      (typeof ord.items === "object" && ord.items !== null && ((ord.items as any).is_deducted === true || (ord.items as any).isDeducted === true))
    );

    if (
      status === "completed" ||
      status === "served" ||
      status === "cancelled" ||
      status === "voided" ||
      status === "archived" ||
      isOrderDeducted
    ) {
      continue;
    }

    const items = ord.items;
    if (!items || !Array.isArray(items)) continue;

    for (const it of items) {
      const itRawId = String(it.id || (it as any).item?.id || "");
      const itBaseId = itRawId.includes("_") ? itRawId.split("_")[0] : itRawId;
      const itName = (it.name || (it as any).item?.name || "").trim().toLowerCase();
      const parenthesizedMatch = itName.match(/^(.+?)\s*\(([^)]+)\)$/);
      const cleanBaseName = parenthesizedMatch ? parenthesizedMatch[1].trim() : itName;

      const matchesItem =
        (itBaseId && itBaseId === baseItemId) ||
        (itRawId && itRawId === rawItemId) ||
        (itemName && (cleanBaseName === itemName || itName === itemName));

      if (!matchesItem) continue;

      const qty = Number(it.qty ?? it.quantity ?? (it as any).item?.quantity ?? 1);
      if (qty <= 0) continue;

      if (variant) {
        const vId = variant.id !== undefined && variant.id !== null ? String(variant.id) : "";
        const vName = (variant.name || "").trim().toLowerCase();
        const itVar = it.selectedVariant || it.variant || (it as any).item?.selectedVariant;
        const itExtractedVar = parenthesizedMatch ? parenthesizedMatch[2].trim().toLowerCase() : "";
        const itVarId = it.variant_id ? String(it.variant_id) : (itVar?.id ? String(itVar.id) : "");
        const itVarName = (it.variant_name || itVar?.name || itExtractedVar || "").trim().toLowerCase();

        const matchesVariant =
          (vId && itVarId === vId) ||
          (vName && itVarName === vName) ||
          (itVar && vId && String(itVar.id) === vId) ||
          (itVar && vName && itVar.name && String(itVar.name).trim().toLowerCase() === vName) ||
          (vName && itExtractedVar === vName) ||
          (vId && itRawId.endsWith(`_${vId}`)) ||
          (vName && itRawId.endsWith(`_${vName.replace(/\s+/g, "_")}`));

        if (matchesVariant) {
          totalReserved += qty;
        }
      } else {
        totalReserved += qty;
      }
    }
  }

  return totalReserved;
}

