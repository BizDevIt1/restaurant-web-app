"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { MenuItem, RestaurantTable, TableStatus, RawMaterial } from "../types";
import { useAuth } from "./AuthContext";
import { createClient } from "../../../lib/supabase";
import { getValidTenantContext } from "../../../lib/tenantResolver";

export interface BranchSettingsCache {
  taxRatePercent: number;
  printerIp: string;
  printerPaperWidth: string;
  kitchenBuzzerEnabled: boolean;
  openingTime: string;
  closingTime: string;
  currencySymbol: string;
  varianceThreshold: number;
}

export interface AdminCacheContextType {
  // Cached Collections
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  restaurantTables: RestaurantTable[];
  setRestaurantTables: React.Dispatch<React.SetStateAction<RestaurantTable[]>>;
  tableStatuses: TableStatus[];
  setTableStatuses: React.Dispatch<React.SetStateAction<TableStatus[]>>;
  rawMaterials: RawMaterial[];
  setRawMaterials: React.Dispatch<React.SetStateAction<RawMaterial[]>>;
  branchSettings: BranchSettingsCache;
  setBranchSettings: React.Dispatch<React.SetStateAction<BranchSettingsCache>>;

  // Revalidation Status
  isRevalidating: {
    menu: boolean;
    tables: boolean;
    inventory: boolean;
    settings: boolean;
  };

  // Revalidate Handlers (Stale-While-Revalidate)
  revalidateMenuItems: (force?: boolean) => Promise<void>;
  revalidateTables: (force?: boolean) => Promise<void>;
  revalidateRawMaterials: (force?: boolean) => Promise<void>;
  revalidateBranchSettings: (force?: boolean) => Promise<void>;

  // Atomic Realtime Delta Mutators (Zero Full Refetch)
  updateTableRow: (updatedRow: any) => void;
  insertTableRow: (newRow: any) => void;
  deleteTableRow: (id: string | number) => void;

  updateMenuItemRow: (updatedRow: any) => void;
  insertMenuItemRow: (newRow: any) => void;
  deleteMenuItemRow: (id: string | number) => void;

  updateRawMaterialRow: (updatedRow: any) => void;
  insertRawMaterialRow: (newRow: any) => void;
  deleteRawMaterialRow: (id: string | number) => void;

  updateBranchSettingsRow: (updatedRow: any) => void;
}

const STALE_THRESHOLD_MS = 45 * 1000; // 45 seconds SWR freshness window

// Module-level in-memory cache to persist data across component lifecycles
const moduleCache = {
  menuItems: [] as MenuItem[],
  restaurantTables: [] as RestaurantTable[],
  tableStatuses: [] as TableStatus[],
  rawMaterials: [] as RawMaterial[],
  branchSettings: {
    taxRatePercent: 16.0,
    printerIp: "192.168.1.180",
    printerPaperWidth: "80mm",
    kitchenBuzzerEnabled: true,
    openingTime: "11:00 AM",
    closingTime: "02:00 AM",
    currencySymbol: "Rs",
    varianceThreshold: 500,
  } as BranchSettingsCache,
  timestamps: {
    menu: 0,
    tables: 0,
    inventory: 0,
    settings: 0,
  },
};

export function mapRowToTableStatus(row: any, fallbackIdx: number = 0): TableStatus {
  const statusUpper = String(row.status || "AVAILABLE").toUpperCase();
  return {
    id: Number(row.id) || fallbackIdx + 1,
    label: row.table_number || row.name || `Table ${row.id}`,
    capacity: Number(row.seating_capacity ?? row.capacity ?? 4),
    status:
      statusUpper === "OCCUPIED"
        ? "seated"
        : statusUpper === "BILLED"
        ? "billing"
        : statusUpper === "RESERVED"
        ? "reserved"
        : "available",
    section: row.section_name || row.floor_name || "Main Dining",
    activeOrderId: (row.active_order_id || row.current_order_id)
      ? String(row.active_order_id || row.current_order_id)
      : undefined,
    dbId: row.id,
  };
}

export function mapRowToRestaurantTable(row: any): RestaurantTable {
  return {
    id: row.id,
    restaurant_id: Number(row.restaurant_id),
    branch_id: row.branch_id,
    table_number: row.table_number || row.name || `Table ${row.id}`,
    section_name: row.section_name || row.floor_name || "Main Dining",
    seating_capacity: Number(row.seating_capacity ?? row.capacity ?? 4),
    status: (row.status ? String(row.status).toUpperCase() : "AVAILABLE") as any,
    current_order_id: row.current_order_id || row.active_order_id || null,
    qr_code_url: row.qr_code_url || undefined,
    is_active: row.is_active !== undefined ? row.is_active : true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const AdminCacheContext = createContext<AdminCacheContextType | null>(null);

export function AdminCacheProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => moduleCache.menuItems);
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>(() => moduleCache.restaurantTables);
  const [tableStatuses, setTableStatuses] = useState<TableStatus[]>(() => moduleCache.tableStatuses);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() => moduleCache.rawMaterials);
  const [branchSettings, setBranchSettings] = useState<BranchSettingsCache>(() => moduleCache.branchSettings);

  const [isRevalidating, setIsRevalidating] = useState({
    menu: false,
    tables: false,
    inventory: false,
    settings: false,
  });

  // Sync to module-level store on state changes
  useEffect(() => {
    moduleCache.menuItems = menuItems;
  }, [menuItems]);

  useEffect(() => {
    moduleCache.restaurantTables = restaurantTables;
    moduleCache.tableStatuses = tableStatuses;
  }, [restaurantTables, tableStatuses]);

  useEffect(() => {
    moduleCache.rawMaterials = rawMaterials;
  }, [rawMaterials]);

  useEffect(() => {
    moduleCache.branchSettings = branchSettings;
  }, [branchSettings]);

  // Keep references to prevent stale closures
  const userRef = useRef(user);
  userRef.current = user;

  // In-flight request guards to prevent duplicate concurrent network fetches
  const inFlightRef = useRef({ tables: false, menu: false, inventory: false, settings: false });
  const lastEagerInitTenantRef = useRef<string | null>(null);

  // 1. REVALIDATE TABLES (SWR)
  const revalidateTables = useCallback(async (force = false) => {
    const now = Date.now();
    if (inFlightRef.current.tables) return;
    if (!force && moduleCache.timestamps.tables > 0 && now - moduleCache.timestamps.tables < STALE_THRESHOLD_MS) {
      return; // Still fresh
    }

    inFlightRef.current.tables = true;
    setIsRevalidating((prev) => ({ ...prev, tables: true }));
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(userRef.current);
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restId)
        .order("table_number", { ascending: true });

      if (!error && data) {
        const mappedTables: RestaurantTable[] = data.map(mapRowToRestaurantTable);
        const mappedStatuses: TableStatus[] = data.map((r, idx) => mapRowToTableStatus(r, idx));

        moduleCache.restaurantTables = mappedTables;
        moduleCache.tableStatuses = mappedStatuses;

        setRestaurantTables(mappedTables);
        setTableStatuses(mappedStatuses);
      }
    } catch (err) {
      console.warn("[AdminCacheContext] revalidateTables warning:", err);
    } finally {
      moduleCache.timestamps.tables = Date.now(); // Record timestamp on completion or error to prevent hammering
      inFlightRef.current.tables = false;
      setIsRevalidating((prev) => ({ ...prev, tables: false }));
    }
  }, []);

  // 2. REVALIDATE MENU ITEMS (SWR)
  const revalidateMenuItems = useCallback(async (force = false) => {
    const now = Date.now();
    if (inFlightRef.current.menu) return;
    if (!force && moduleCache.timestamps.menu > 0 && now - moduleCache.timestamps.menu < STALE_THRESHOLD_MS) {
      return;
    }

    inFlightRef.current.menu = true;
    setIsRevalidating((prev) => ({ ...prev, menu: true }));
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(userRef.current);

      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const mapped: MenuItem[] = data.map((row: any) => {
          const prepMinutes =
            Number(row.preparation_time) ||
            parseInt(String(row.prep_time || "15").replace(/[^0-9]/g, "")) ||
            15;
          return {
            id: row.id,
            name: row.name,
            category: row.category || "karahi",
            price: Number(row.price),
            prepTime: row.prep_time || `${prepMinutes}m`,
            preparation_time: prepMinutes,
            stockStatus: row.stock_status || "in_stock",
            stockCount: row.stock_count ?? 20,
            imageIcon: row.image_icon || "🍲",
            isPopular: Boolean(row.is_popular),
            is_available: (row.stock_status || "in_stock") === "in_stock",
            in_stock: (row.stock_status || "in_stock") === "in_stock",
          };
        });

        // Try to fetch recipes to compute live cost and auto-stock
        try {
          const { data: recipeRows } = await supabase
            .from("recipe_items")
            .select(
              "menu_item_id, raw_material_id, quantity_required, unit, raw_materials(id, name, current_stock, min_safety_stock, cost_per_unit, unit)"
            )
            .eq("restaurant_id", restId);

          if (recipeRows && recipeRows.length > 0) {
            mapped.forEach((d) => {
              const dishRecipes = recipeRows.filter(
                (r: any) => String(r.menu_item_id) === String(d.id)
              );

              if (dishRecipes.length > 0) {
                d.hasRecipe = true;
                let totalCost = 0;
                let minPortions = Infinity;
                const missing: string[] = [];

                dishRecipes.forEach((r: any) => {
                  const raw = r.raw_materials as any;
                  const reqQty = Number(r.quantity_required) || 0;
                  const costPerUnit = Number(raw?.cost_per_unit) || 0;
                  totalCost += reqQty * costPerUnit;

                  const currentStock = Number(raw?.current_stock) || 0;
                  if (reqQty > 0) {
                    const portions = Math.floor(currentStock / reqQty);
                    if (portions < minPortions) {
                      minPortions = portions;
                    }
                    if (currentStock < reqQty) {
                      missing.push(
                        `${raw?.name || "Ingredient"} (Req: ${reqQty} ${
                          r.unit || raw?.unit || ""
                        }, Stock: ${currentStock})`
                      );
                    }
                  }
                });

                d.recipeCost = totalCost;
                d.recipeMargin =
                  d.price > 0
                    ? Math.round(((d.price - totalCost) / d.price) * 100)
                    : 0;
                const canMake = minPortions === Infinity ? 0 : minPortions;
                d.maxPortions = canMake;
                d.missingIngredients = missing;

                if (canMake < 1) {
                  d.isAutoOutOfStock = true;
                  d.stockStatus = "out_of_stock";
                  d.is_available = false;
                  d.in_stock = false;
                } else {
                  d.isAutoOutOfStock = false;
                  d.is_available = d.stockStatus === "in_stock";
                  d.in_stock = d.stockStatus === "in_stock";
                }
              } else {
                d.hasRecipe = false;
                d.isAutoOutOfStock = false;
                d.is_available = d.stockStatus === "in_stock";
                d.in_stock = d.stockStatus === "in_stock";
              }
            });
          }
        } catch (rErr) {
          console.warn("[AdminCacheContext] recipe check warning:", rErr);
        }

        moduleCache.menuItems = mapped;
        setMenuItems(mapped);
      }
    } catch (err) {
      console.warn("[AdminCacheContext] revalidateMenuItems warning:", err);
    } finally {
      moduleCache.timestamps.menu = Date.now();
      inFlightRef.current.menu = false;
      setIsRevalidating((prev) => ({ ...prev, menu: false }));
    }
  }, []);

  // 3. REVALIDATE RAW MATERIALS (SWR)
  const revalidateRawMaterials = useCallback(async (force = false) => {
    const now = Date.now();
    if (inFlightRef.current.inventory) return;
    if (!force && moduleCache.timestamps.inventory > 0 && now - moduleCache.timestamps.inventory < STALE_THRESHOLD_MS) {
      return;
    }

    inFlightRef.current.inventory = true;
    setIsRevalidating((prev) => ({ ...prev, inventory: true }));
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(userRef.current);
      const { data, error } = await supabase
        .from("raw_materials")
        .select("*")
        .eq("restaurant_id", restId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const mapped: RawMaterial[] = data.map((r: any) => ({
          id: r.id,
          restaurant_id: r.restaurant_id,
          branch_id: r.branch_id,
          name: r.name,
          sku: r.sku,
          category: r.category || "General",
          unit: r.unit || "kg",
          current_stock: Number(r.current_stock ?? 0),
          min_safety_stock: Number(r.min_safety_stock ?? 5),
          cost_per_unit: Number(r.cost_per_unit ?? 0),
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));

        moduleCache.rawMaterials = mapped;
        setRawMaterials(mapped);
      }
    } catch (err) {
      console.warn("[AdminCacheContext] revalidateRawMaterials warning:", err);
    } finally {
      moduleCache.timestamps.inventory = Date.now();
      inFlightRef.current.inventory = false;
      setIsRevalidating((prev) => ({ ...prev, inventory: false }));
    }
  }, []);

  // 4. REVALIDATE BRANCH SETTINGS (SWR)
  const revalidateBranchSettings = useCallback(async (force = false) => {
    const now = Date.now();
    if (inFlightRef.current.settings) return;
    if (!force && moduleCache.timestamps.settings > 0 && now - moduleCache.timestamps.settings < STALE_THRESHOLD_MS) {
      return;
    }

    inFlightRef.current.settings = true;
    setIsRevalidating((prev) => ({ ...prev, settings: true }));
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(userRef.current);
      const { data, error } = await supabase
        .from("branch_settings")
        .select("*")
        .eq("restaurant_id", restId)
        .maybeSingle();

      if (!error && data) {
        const resolvedTax = data.tax_rate ?? data.tax_rate_percent ?? 16.0;
        const resolvedPrinterIp = data.printer_ip || data.thermal_printer_ip || "192.168.1.180";
        const resolvedPaperWidth = data.printer_paper_width || "80mm";
        const resolvedBuzzer = data.buzzer_enabled ?? data.kitchen_buzzer_enabled ?? true;

        const updatedSettings: BranchSettingsCache = {
          taxRatePercent: Number(resolvedTax),
          printerIp: String(resolvedPrinterIp),
          printerPaperWidth: String(resolvedPaperWidth),
          kitchenBuzzerEnabled: Boolean(resolvedBuzzer),
          openingTime: String(data.opening_time || "11:00 AM"),
          closingTime: String(data.closing_time || "02:00 AM"),
          currencySymbol: String(data.currency_symbol || "Rs"),
          varianceThreshold: Number(data.variance_threshold || 500),
        };

        moduleCache.branchSettings = updatedSettings;
        setBranchSettings(updatedSettings);
      }
    } catch (err) {
      console.warn("[AdminCacheContext] revalidateBranchSettings warning:", err);
    } finally {
      moduleCache.timestamps.settings = Date.now();
      inFlightRef.current.settings = false;
      setIsRevalidating((prev) => ({ ...prev, settings: false }));
    }
  }, []);

  // Initial eager population on tenant/user change
  useEffect(() => {
    const tenantKey = `${user?.id || ""}_${user?.restaurantId || ""}_${user?.organizationId || ""}`;
    if (userRef.current && lastEagerInitTenantRef.current !== tenantKey) {
      lastEagerInitTenantRef.current = tenantKey;
      revalidateTables();
      revalidateMenuItems();
      revalidateRawMaterials();
      revalidateBranchSettings();
    }
  }, [user?.id, user?.restaurantId, user?.organizationId, revalidateTables, revalidateMenuItems, revalidateRawMaterials, revalidateBranchSettings]);

  // =========================================================================
  // ATOMIC REALTIME DELTA MUTATORS (Zero Full Refetch)
  // =========================================================================

  // Tables
  const updateTableRow = useCallback((updatedRow: any) => {
    if (!updatedRow) return;
    const mappedTable = mapRowToRestaurantTable(updatedRow);
    const mappedStatus = mapRowToTableStatus(updatedRow);

    setRestaurantTables((prev) =>
      prev.map((t) => (String(t.id) === String(updatedRow.id) ? mappedTable : t))
    );

    setTableStatuses((prev) =>
      prev.map((t) =>
        String(t.dbId) === String(updatedRow.id) ||
        String(t.id) === String(updatedRow.id) ||
        t.label === updatedRow.table_number
          ? mappedStatus
          : t
      )
    );
  }, []);

  const insertTableRow = useCallback((newRow: any) => {
    if (!newRow) return;
    const mappedTable = mapRowToRestaurantTable(newRow);
    const mappedStatus = mapRowToTableStatus(newRow);

    setRestaurantTables((prev) => [...prev.filter((t) => String(t.id) !== String(newRow.id)), mappedTable]);
    setTableStatuses((prev) => [...prev.filter((t) => String(t.dbId) !== String(newRow.id) && String(t.id) !== String(newRow.id)), mappedStatus]);
  }, []);

  const deleteTableRow = useCallback((id: string | number) => {
    setRestaurantTables((prev) => prev.filter((t) => String(t.id) !== String(id)));
    setTableStatuses((prev) => prev.filter((t) => String(t.dbId) !== String(id) && String(t.id) !== String(id)));
  }, []);

  // Menu Items
  const updateMenuItemRow = useCallback((updatedRow: any) => {
    if (!updatedRow) return;
    setMenuItems((prev) =>
      prev.map((item) => {
        if (String(item.id) !== String(updatedRow.id)) return item;
        const prepMinutes =
          Number(updatedRow.preparation_time) ||
          parseInt(String(updatedRow.prep_time || "15").replace(/[^0-9]/g, "")) ||
          item.preparation_time ||
          15;

        return {
          ...item,
          name: updatedRow.name ?? item.name,
          category: updatedRow.category ?? item.category,
          price: updatedRow.price !== undefined ? Number(updatedRow.price) : item.price,
          prepTime: updatedRow.prep_time ?? item.prepTime,
          preparation_time: prepMinutes,
          stockStatus: updatedRow.stock_status ?? item.stockStatus,
          stockCount: updatedRow.stock_count !== undefined ? updatedRow.stock_count : item.stockCount,
          imageIcon: updatedRow.image_icon ?? item.imageIcon,
          isPopular: updatedRow.is_popular !== undefined ? Boolean(updatedRow.is_popular) : item.isPopular,
          is_available: (updatedRow.stock_status || item.stockStatus) === "in_stock",
          in_stock: (updatedRow.stock_status || item.stockStatus) === "in_stock",
        };
      })
    );
  }, []);

  const insertMenuItemRow = useCallback((newRow: any) => {
    if (!newRow) return;
    const prepMinutes =
      Number(newRow.preparation_time) ||
      parseInt(String(newRow.prep_time || "15").replace(/[^0-9]/g, "")) ||
      15;

    const newItem: MenuItem = {
      id: newRow.id,
      name: newRow.name,
      category: newRow.category || "karahi",
      price: Number(newRow.price),
      prepTime: newRow.prep_time || `${prepMinutes}m`,
      preparation_time: prepMinutes,
      stockStatus: newRow.stock_status || "in_stock",
      stockCount: newRow.stock_count ?? 20,
      imageIcon: newRow.image_icon || "🍲",
      isPopular: Boolean(newRow.is_popular),
      is_available: (newRow.stock_status || "in_stock") === "in_stock",
      in_stock: (newRow.stock_status || "in_stock") === "in_stock",
    };

    setMenuItems((prev) => [newItem, ...prev.filter((item) => String(item.id) !== String(newRow.id))]);
  }, []);

  const deleteMenuItemRow = useCallback((id: string | number) => {
    setMenuItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
  }, []);

  // Raw Materials
  const updateRawMaterialRow = useCallback((updatedRow: any) => {
    if (!updatedRow) return;
    setRawMaterials((prev) =>
      prev.map((r) =>
        String(r.id) === String(updatedRow.id)
          ? {
              ...r,
              name: updatedRow.name ?? r.name,
              sku: updatedRow.sku ?? r.sku,
              category: updatedRow.category ?? r.category,
              unit: updatedRow.unit ?? r.unit,
              current_stock: updatedRow.current_stock !== undefined ? Number(updatedRow.current_stock) : r.current_stock,
              min_safety_stock: updatedRow.min_safety_stock !== undefined ? Number(updatedRow.min_safety_stock) : r.min_safety_stock,
              cost_per_unit: updatedRow.cost_per_unit !== undefined ? Number(updatedRow.cost_per_unit) : r.cost_per_unit,
              updated_at: updatedRow.updated_at,
            }
          : r
      )
    );
  }, []);

  const insertRawMaterialRow = useCallback((newRow: any) => {
    if (!newRow) return;
    const newMaterial: RawMaterial = {
      id: newRow.id,
      restaurant_id: newRow.restaurant_id,
      branch_id: newRow.branch_id,
      name: newRow.name,
      sku: newRow.sku,
      category: newRow.category || "General",
      unit: newRow.unit || "kg",
      current_stock: Number(newRow.current_stock ?? 0),
      min_safety_stock: Number(newRow.min_safety_stock ?? 5),
      cost_per_unit: Number(newRow.cost_per_unit ?? 0),
      created_at: newRow.created_at,
      updated_at: newRow.updated_at,
    };

    setRawMaterials((prev) => [newMaterial, ...prev.filter((r) => String(r.id) !== String(newRow.id))]);
  }, []);

  const deleteRawMaterialRow = useCallback((id: string | number) => {
    setRawMaterials((prev) => prev.filter((r) => String(r.id) !== String(id)));
  }, []);

  // Branch Settings
  const updateBranchSettingsRow = useCallback((updatedRow: any) => {
    if (!updatedRow) return;
    setBranchSettings((prev) => {
      const resolvedTax = updatedRow.tax_rate ?? updatedRow.tax_rate_percent ?? prev.taxRatePercent;
      const resolvedPrinterIp = updatedRow.printer_ip || updatedRow.thermal_printer_ip || prev.printerIp;
      const resolvedPaperWidth = updatedRow.printer_paper_width || prev.printerPaperWidth;
      const resolvedBuzzer = updatedRow.buzzer_enabled ?? updatedRow.kitchen_buzzer_enabled ?? prev.kitchenBuzzerEnabled;

      return {
        ...prev,
        taxRatePercent: Number(resolvedTax),
        printerIp: String(resolvedPrinterIp),
        printerPaperWidth: String(resolvedPaperWidth),
        kitchenBuzzerEnabled: Boolean(resolvedBuzzer),
        openingTime: updatedRow.opening_time ? String(updatedRow.opening_time) : prev.openingTime,
        closingTime: updatedRow.closing_time ? String(updatedRow.closing_time) : prev.closingTime,
        currencySymbol: updatedRow.currency_symbol ? String(updatedRow.currency_symbol) : prev.currencySymbol,
        varianceThreshold: updatedRow.variance_threshold !== undefined ? Number(updatedRow.variance_threshold) : prev.varianceThreshold,
      };
    });
  }, []);

  return (
    <AdminCacheContext.Provider
      value={{
        menuItems,
        setMenuItems,
        restaurantTables,
        setRestaurantTables,
        tableStatuses,
        setTableStatuses,
        rawMaterials,
        setRawMaterials,
        branchSettings,
        setBranchSettings,
        isRevalidating,
        revalidateMenuItems,
        revalidateTables,
        revalidateRawMaterials,
        revalidateBranchSettings,
        updateTableRow,
        insertTableRow,
        deleteTableRow,
        updateMenuItemRow,
        insertMenuItemRow,
        deleteMenuItemRow,
        updateRawMaterialRow,
        insertRawMaterialRow,
        deleteRawMaterialRow,
        updateBranchSettingsRow,
      }}
    >
      {children}
    </AdminCacheContext.Provider>
  );
}

export function useAdminCache() {
  const context = useContext(AdminCacheContext);
  if (!context) {
    throw new Error("useAdminCache must be used within an AdminCacheProvider");
  }
  return context;
}
