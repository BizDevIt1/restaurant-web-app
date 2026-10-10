import { createClient } from "./supabase";
import { resolveVariantBOM } from "./recipePortions";
import { dispatchLowStockAlert } from "./shiftAuditNotifications";

export interface OrderItemDeductionInput {
  id?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  selectedVariant?: any;
  variant?: any;
  variant_id?: string | number | null;
  variant_name?: string | null;
  item?: any;
}

/**
 * Deduct raw materials inventory stock linked via recipe_items (Bill of Materials)
 * for items sold in POS or sent to Kitchen.
 * Bi-directionally syncs with Supabase and broadcasts realtime events.
 */
export async function deductInventoryStockForOrder(
  restaurantId: string | number,
  items: OrderItemDeductionInput[],
  options?: { orderId?: string | number; source?: string }
): Promise<{ success: boolean; deductedMaterials?: Record<string, number>; error?: string }> {
  if (!restaurantId || !items || items.length === 0) {
    return { success: true };
  }

  try {
    const supabase = createClient();
    const restIdNum = Number(restaurantId) || restaurantId;

    // 1. Fetch recipe items for this restaurant
    const { data: recipeRows, error: recipeErr } = await supabase
      .from("recipe_items")
      .select("id, menu_item_id, raw_material_id, quantity_required, unit, variant_id, variant_name")
      .eq("restaurant_id", restIdNum);

    if (recipeErr || !recipeRows || recipeRows.length === 0) {
      return { success: true }; // No recipes mapped, nothing to deduct
    }

    // 2. Fetch menu items to map item name -> menu_item_id and correlate variants
    const { data: menuRows } = await supabase
      .from("menu_items")
      .select("id, name, variants")
      .eq("restaurant_id", restIdNum);

    const nameToMenuId = new Map<string, string>();
    const menuItemMap = new Map<string, any>();
    if (menuRows) {
      menuRows.forEach((m: any) => {
        const idStr = String(m.id);
        nameToMenuId.set(m.name.trim().toLowerCase(), idStr);
        menuItemMap.set(idStr, m);
      });
    }

    // 3. Compute total raw material decrements
    const materialDeductions: Record<string, number> = {};

    items.forEach((item: any) => {
      const quantitySold = Number(item.quantity ?? item.qty ?? 1);
      if (quantitySold <= 0) return;

      const rawItemId = item.id ? String(item.id) : "";
      const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;
      const itemName = (item.name || "").trim().toLowerCase();
      const parenthesizedMatch = (item.name || "").match(/^(.+?)\s*\(([^)]+)\)$/);
      const cleanBaseName = parenthesizedMatch ? parenthesizedMatch[1].trim().toLowerCase() : itemName;
      const extractedVariantName = parenthesizedMatch ? parenthesizedMatch[2].trim() : "";

      // Robust ID resolution: match by direct recipeRows ID first, fallback to dish name matching
      let resolvedMenuId: string | undefined = undefined;
      if (baseId && recipeRows.some((r: any) => String(r.menu_item_id) === baseId)) {
        resolvedMenuId = baseId;
      } else if (rawItemId && recipeRows.some((r: any) => String(r.menu_item_id) === rawItemId)) {
        resolvedMenuId = rawItemId;
      } else if (cleanBaseName && nameToMenuId.has(cleanBaseName)) {
        resolvedMenuId = nameToMenuId.get(cleanBaseName);
      } else if (itemName && nameToMenuId.has(itemName)) {
        resolvedMenuId = nameToMenuId.get(itemName);
      } else if (baseId) {
        resolvedMenuId = baseId;
      }

      if (!resolvedMenuId) return;

      const linkedRecipes = recipeRows.filter(
        (r: any) => String(r.menu_item_id) === resolvedMenuId
      );

      // Resolve variant object
      let variantObj: any =
        item.selectedVariant ||
        item.variant ||
        item.item?.selectedVariant ||
        item.item?.variant;

      if (!variantObj && (item.variant_id || item.variant_name)) {
        variantObj = {
          id: item.variant_id,
          name: item.variant_name,
        };
      }

      // Check menu item variants definition
      const menuItem = menuItemMap.get(String(resolvedMenuId));
      let menuVariantsList: any[] = [];
      if (menuItem?.variants) {
        if (Array.isArray(menuItem.variants)) menuVariantsList = menuItem.variants;
        else if (typeof menuItem.variants === "string") {
          try {
            const parsed = JSON.parse(menuItem.variants);
            if (Array.isArray(parsed)) menuVariantsList = parsed;
          } catch {}
        }
      }

      if (!variantObj) {
        if (rawItemId.includes("_")) {
          const varKey = rawItemId.split("_").slice(1).join("_").toLowerCase();
          const found = menuVariantsList.find(
            (v: any) =>
              String(v.id).toLowerCase() === varKey ||
              (v.name && v.name.toLowerCase().replace(/\s+/g, "_") === varKey) ||
              (v.name && v.name.toLowerCase() === varKey)
          );
          if (found) variantObj = found;
        }

        if (!variantObj && extractedVariantName) {
          const found = menuVariantsList.find(
            (v: any) =>
              v.name && v.name.trim().toLowerCase() === extractedVariantName.toLowerCase()
          );
          if (found) {
            variantObj = found;
          } else {
            variantObj = { name: extractedVariantName };
          }
        }
      }

      if (variantObj) {
        const bom = resolveVariantBOM(variantObj, linkedRecipes, item.price);
        if (bom.length > 0) {
          bom.forEach((r: any) => {
            const matId = String(r.raw_material_id);
            const reqQty = Number(r.quantity_required) || 0;
            const totalDeduct = reqQty * quantitySold;
            materialDeductions[matId] = (materialDeductions[matId] || 0) + totalDeduct;
          });
          return;
        }
      }

      // Base dish (single size) ingredients: exclude other variants' items
      const baseRecipes = linkedRecipes.filter((r: any) => !r.variant_id && !r.variant_name);
      const recipesToDeduct = baseRecipes.length > 0 ? baseRecipes : linkedRecipes;

      recipesToDeduct.forEach((r: any) => {
        const matId = String(r.raw_material_id);
        const reqQty = Number(r.quantity_required) || 0;
        const totalDeduct = reqQty * quantitySold;
        materialDeductions[matId] = (materialDeductions[matId] || 0) + totalDeduct;
      });
    });

    const materialIds = Object.keys(materialDeductions);
    if (materialIds.length === 0) {
      return { success: true };
    }

    // 4. Fetch current stock balances for the targeted raw materials
    const { data: currentMaterials, error: fetchMatErr } = await supabase
      .from("raw_materials")
      .select("id, name, current_stock, min_safety_stock, unit")
      .eq("restaurant_id", restIdNum)
      .in("id", materialIds);

    if (fetchMatErr || !currentMaterials) {
      console.warn("[InventoryDeduction] Could not fetch target raw materials:", fetchMatErr);
      return { success: false, error: fetchMatErr?.message };
    }

    // 5. Update each raw material record in public.raw_materials & trigger threshold alerts
    for (const mat of currentMaterials) {
      const matIdStr = String(mat.id);
      const toDeduct = materialDeductions[matIdStr] || 0;
      const currentStockNum = Math.max(0, Number(mat.current_stock) || 0);
      const updatedStock = Math.max(0, Math.round((currentStockNum - toDeduct) * 1000) / 1000);
      const minSafety = Number(mat.min_safety_stock ?? 5);

      await supabase
        .from("raw_materials")
        .update({
          current_stock: updatedStock,
          updated_at: new Date().toISOString(),
        })
        .eq("restaurant_id", restIdNum)
        .eq("id", mat.id);

      // Automated Low Stock / Out of Stock Alert Trigger
      if (updatedStock <= minSafety) {
        const targetTenantIds = Array.from(
          new Set([String(restIdNum), String(restaurantId), "default"].filter(Boolean))
        );
        targetTenantIds.forEach((tId) => {
          dispatchLowStockAlert(tId, {
            itemName: mat.name,
            currentStock: updatedStock,
            minSafetyStock: minSafety,
            unit: mat.unit,
            isRawMaterial: true,
          });
        });
      }
    }

    // 6. Dispatch cross-tab & local window broadcast events for instant UI synchronization
    if (typeof window !== "undefined") {
      try {
        const eventDetail = {
          restaurantId,
          orderId: options?.orderId,
          source: options?.source || "pos",
          materialDeductions,
          timestamp: Date.now(),
        };
        window.dispatchEvent(new CustomEvent("inventory_stock_deducted", {
          detail: eventDetail,
        }));
        window.dispatchEvent(new CustomEvent("pos_menu_updated", {
          detail: { restaurantId, action: "stock_deducted", timestamp: Date.now() },
        }));
        localStorage.setItem(
          `pos_inventory_deducted_${restaurantId}`,
          JSON.stringify(eventDetail)
        );
        window.dispatchEvent(new Event("storage"));
      } catch { }
    }

    return { success: true, deductedMaterials: materialDeductions };
  } catch (err: any) {
    console.error("[InventoryDeduction] Exception deducting raw materials:", err);
    return { success: false, error: err?.message || String(err) };
  }
}
