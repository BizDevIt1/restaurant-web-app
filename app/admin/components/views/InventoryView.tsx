"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Layers,
  Package,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Flame,
  Calendar,
  User,
  History,
  ChevronDown,
  UtensilsCrossed,
  ShoppingCart,
  Eye,
  AlertCircle,
  Info,
} from "lucide-react";
import { RawMaterial, InventoryWastage, MenuItem, ItemVariant } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { useAdminCache } from "../../context/AdminCacheContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import WastageModal from "./WastageModal";
import {
  ItemPortionAvailabilityText,
  ItemStockStatusBadge,
  VariantPortionBadge,
} from "@/app/components/PosInventoryPortionBadges";
import { getItemRepresentativePortions } from "@/lib/posLedgerSync";
import { getSmartFoodImage } from "@/utils/posFoodImages";

interface InventoryViewProps {
  showToast: (msg: string) => void;
}

const CATEGORIES = [
  "Meat & Poultry",
  "Dairy",
  "Produce",
  "Bakery",
  "Sauces & Spices",
  "Packaging",
  "General",
] as const;

const UNITS = ["kg", "g", "liters", "ml", "pcs"] as const;

// Helper to generate a standardized SKU code
const generateSku = (name: string, category: string): string => {
  const catCode = category.slice(0, 3).toUpperCase();
  const nameCode = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "ITM";
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `RM-${catCode}-${nameCode}-${randomSuffix}`;
};

export default function InventoryView({ showToast }: InventoryViewProps) {
  const { user } = useAuth();
  const {
    rawMaterials: cachedRawMaterials,
    updateRawMaterialRow,
    insertRawMaterialRow,
    deleteRawMaterialRow,
    liveSimulatedMenuItems,
    effectiveLedger,
    baseMaterialsMap,
    getVariantPortions,
    posCart,
    inventoryTick,
    rawRecipes,
  } = useAdminCache();

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(() =>
    cachedRawMaterials && cachedRawMaterials.length > 0 ? cachedRawMaterials : []
  );
  const [wastageLogs, setWastageLogs] = useState<InventoryWastage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(() =>
    !(cachedRawMaterials && cachedRawMaterials.length > 0)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with SWR cache if updated elsewhere
  useEffect(() => {
    if (cachedRawMaterials && cachedRawMaterials.length > 0) {
      setRawMaterials(cachedRawMaterials);
      setIsLoading(false);
    }
  }, [cachedRawMaterials]);

  // Active View Tab: Stock Balances vs. Live Recipe Portions vs. Wastage Log
  const [activeViewTab, setActiveViewTab] = useState<"balances" | "live_stock" | "wastage">("balances");
  const [dishCategoryFilter, setDishCategoryFilter] = useState<string>("all");
  const [inspectingDish, setInspectingDish] = useState<MenuItem | null>(null);
  const [selectedInspectVariant, setSelectedInspectVariant] = useState<ItemVariant | null>(null);

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWastageModalOpen, setIsWastageModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterial | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RawMaterial | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<string>("Meat & Poultry");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [formUnit, setFormUnit] = useState<string>("kg");
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [formCurrentStock, setFormCurrentStock] = useState<string>("0");
  const [formMinSafetyStock, setFormMinSafetyStock] = useState<string>("5");
  const [formCostPerUnit, setFormCostPerUnit] = useState<string>("0");
  const [formSku, setFormSku] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Raw Materials & Wastage Logs from Supabase
  const fetchInventory = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);

      // 1. Fetch raw materials
      const { data, error } = await supabase
        .from("raw_materials")
        .select("*")
        .eq("restaurant_id", restId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[InventoryView] Supabase load error:", error.message);
        if (isManualRefresh) {
          showToast("Sync note: Supabase schema cache updating or table pending migration.");
        }
      } else if (data) {
        const mapped: RawMaterial[] = data.map((row: any) => ({
          id: row.id,
          restaurant_id: Number(row.restaurant_id),
          branch_id: row.branch_id,
          name: row.name,
          sku: row.sku || `RM-${row.id}`,
          category: row.category || "General",
          unit: row.unit || "kg",
          current_stock: Number(row.current_stock) || 0,
          min_safety_stock: Number(row.min_safety_stock) || 0,
          cost_per_unit: Number(row.cost_per_unit) || 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        setRawMaterials(mapped);
      }

      // 2. Fetch wastage history log
      try {
        const { data: wData, error: wError } = await supabase
          .from("inventory_wastage")
          .select("*, raw_materials(name)")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false });

        if (!wError && wData) {
          const mappedWastage: InventoryWastage[] = wData.map((row: any) => ({
            id: row.id,
            restaurant_id: Number(row.restaurant_id),
            raw_material_id: row.raw_material_id,
            raw_material_name: row.raw_materials?.name || `Material #${row.raw_material_id}`,
            quantity: Number(row.quantity) || 0,
            unit: row.unit || "kg",
            cost_loss: Number(row.cost_loss) || 0,
            reason: row.reason || "General Spoilage",
            logged_by: row.logged_by || "Admin",
            created_at: row.created_at,
          }));
          setWastageLogs(mappedWastage);
        }
      } catch (wEx) {
        console.warn("[InventoryView] Wastage fetch exception:", wEx);
      }
    } catch (err) {
      console.error("[InventoryView] Fetch error:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventory();

    const handleStockDeducted = () => {
      fetchInventory();
    };

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("pos_inventory_deducted_")) {
        fetchInventory();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("inventory_stock_deducted", handleStockDeducted);
      window.addEventListener("storage", handleStorageUpdate);
    }

    let channel: any = null;
    let isMounted = true;

    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        if (restId && isMounted) {
          const subId = Math.random().toString(36).substring(2, 7);
          channel = supabase
            .channel(`admin_inventory_realtime_${restId}_${subId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "raw_materials",
                filter: `restaurant_id=eq.${restId}`,
              },
              () => {
                if (isMounted) fetchInventory();
              }
            )
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "inventory_wastage",
                filter: `restaurant_id=eq.${restId}`,
              },
              () => {
                if (isMounted) fetchInventory();
              }
            )
            .subscribe();
        }
      } catch (err) {
        console.warn("[InventoryView] Realtime subscription error:", err);
      }
    })();

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("inventory_stock_deducted", handleStockDeducted);
        window.removeEventListener("storage", handleStorageUpdate);
      }
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch { }
      }
    };
  }, [user?.organizationId, user?.id]);

  // Open Add Modal
  const openAddModal = () => {
    setEditingItem(null);
    setFormName("");
    setFormCategory("Meat & Poultry");
    setIsCustomCategory(false);
    setFormUnit("kg");
    setIsCustomUnit(false);
    setFormCurrentStock("0");
    setFormMinSafetyStock("5");
    setFormCostPerUnit("0");
    setFormSku("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: RawMaterial) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setIsCustomCategory(!CATEGORIES.includes(item.category as any));
    setFormUnit(item.unit);
    setIsCustomUnit(!UNITS.includes(item.unit as any));
    setFormCurrentStock(String(item.current_stock));
    setFormMinSafetyStock(String(item.min_safety_stock));
    setFormCostPerUnit(String(item.cost_per_unit));
    setFormSku(item.sku || "");
    setIsModalOpen(true);
  };

  // Handle Form Submit (Add or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const cleanName = formName.trim();
    if (!cleanName) {
      showToast("Please enter an item name.");
      return;
    }

    const currentStockNum = parseFloat(formCurrentStock);
    const minSafetyNum = parseFloat(formMinSafetyStock);
    const costPerUnitNum = parseFloat(formCostPerUnit);

    if (isNaN(currentStockNum) || currentStockNum < 0) {
      showToast("Invalid current stock quantity.");
      return;
    }
    if (isNaN(minSafetyNum) || minSafetyNum < 0) {
      showToast("Invalid minimum safety stock.");
      return;
    }
    if (isNaN(costPerUnitNum) || costPerUnitNum < 0) {
      showToast("Invalid cost per unit.");
      return;
    }

    setIsSaving(true);
    const finalSku = formSku.trim() || (editingItem?.sku ? editingItem.sku : generateSku(cleanName, formCategory));

    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);

      if (editingItem) {
        // Optimistic update
        const updatedItem: RawMaterial = {
          ...editingItem,
          name: cleanName,
          sku: finalSku,
          category: formCategory,
          unit: formUnit,
          current_stock: currentStockNum,
          min_safety_stock: minSafetyNum,
          cost_per_unit: costPerUnitNum,
          updated_at: new Date().toISOString(),
        };

        setRawMaterials((prev) =>
          prev.map((item) => (item.id === editingItem.id ? updatedItem : item))
        );
        updateRawMaterialRow(updatedItem);
        setIsModalOpen(false);
        showToast(`Updated "${cleanName}".`);

        const { error } = await supabase
          .from("raw_materials")
          .update({
            name: cleanName,
            sku: finalSku,
            category: formCategory,
            unit: formUnit,
            current_stock: currentStockNum,
            min_safety_stock: minSafetyNum,
            cost_per_unit: costPerUnitNum,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingItem.id);

        if (error) {
          console.warn("[InventoryView] Supabase update warning:", error.message);
        }
      } else {
        // Optimistic create
        const tempId = Date.now();
        const newItem: RawMaterial = {
          id: tempId,
          restaurant_id: restId,
          branch_id: branchId || null,
          name: cleanName,
          sku: finalSku,
          category: formCategory,
          unit: formUnit,
          current_stock: currentStockNum,
          min_safety_stock: minSafetyNum,
          cost_per_unit: costPerUnitNum,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setRawMaterials((prev) => [newItem, ...prev]);
        setIsModalOpen(false);
        showToast(`Saved "${cleanName}".`);

        const { data, error } = await supabase
          .from("raw_materials")
          .insert([
            {
              restaurant_id: restId,
              branch_id: branchId || null,
              name: cleanName,
              sku: finalSku,
              category: formCategory,
              unit: formUnit,
              current_stock: currentStockNum,
              min_safety_stock: minSafetyNum,
              cost_per_unit: costPerUnitNum,
            },
          ])
          .select()
          .single();

        if (error) {
          console.warn("[InventoryView] Supabase insert warning:", error.message);
        } else if (data) {
          // Update temp ID with real DB ID
          const persistedItem = { ...newItem, id: data.id };
          setRawMaterials((prev) =>
            prev.map((item) =>
              item.id === tempId ? persistedItem : item
            )
          );
          insertRawMaterialRow(persistedItem);
        }
      }
    } catch (err) {
      console.error("[InventoryView] Save error:", err);
      showToast("Error saving inventory item.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Item
  const handleDelete = async () => {
    if (!itemToDelete) return;
    const target = itemToDelete;
    setItemToDelete(null);

    // Optimistic delete
    setRawMaterials((prev) => prev.filter((item) => item.id !== target.id));
    deleteRawMaterialRow(target.id);
    showToast(`Deleted "${target.name}".`);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("raw_materials")
        .delete()
        .eq("id", target.id);

      if (error) {
        console.warn("[InventoryView] Supabase delete warning:", error.message);
      }
    } catch (err) {
      console.error("[InventoryView] Delete error:", err);
    }
  };

  // Quick Stats Computations (Compact 3 Cards)
  const totalStockItems = rawMaterials.length;
  const lowStockWarnings = useMemo(() => {
    return rawMaterials.filter((item) => item.current_stock <= item.min_safety_stock).length;
  }, [rawMaterials]);
  const inventoryValuation = useMemo(() => {
    return rawMaterials.reduce(
      (sum, item) => sum + item.current_stock * item.cost_per_unit,
      0
    );
  }, [rawMaterials]);

  // Filtered Raw Materials
  const filteredItems = useMemo(() => {
    return rawMaterials.filter((item) => {
      const matchCategory =
        selectedCategory === "all" ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [rawMaterials, selectedCategory, searchQuery]);

  // Dynamic Categories with live item counts for dropdown
  const inventoryCategoriesList = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();

    // Seed predefined categories
    CATEGORIES.forEach((cat) => {
      map.set(cat.toLowerCase(), {
        id: cat,
        label: cat,
        count: 0,
      });
    });

    // Count and discover any additional categories
    rawMaterials.forEach((item) => {
      const catKey = (item.category || "other").toLowerCase();
      if (map.has(catKey)) {
        map.get(catKey)!.count += 1;
      } else {
        const label = item.category
          ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
          : "Other";
        map.set(catKey, {
          id: item.category,
          label,
          count: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [rawMaterials]);

  // Filtered Wastage Logs
  const filteredWastage = useMemo(() => {
    return wastageLogs.filter((w) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (w.raw_material_name && w.raw_material_name.toLowerCase().includes(q)) ||
        w.reason.toLowerCase().includes(q) ||
        w.logged_by.toLowerCase().includes(q)
      );
    });
  }, [wastageLogs, searchQuery]);

  // Live Simulated Dishes Metrics & Filtering (Mirrored from POS Terminal Recipe Ledger)
  const inStockDishesCount = useMemo(() => {
    return (liveSimulatedMenuItems || []).filter((d) => {
      const rep = getItemRepresentativePortions(d, getVariantPortions);
      return !rep.isOutOfStock && d.stockStatus !== "out_of_stock";
    }).length;
  }, [liveSimulatedMenuItems, getVariantPortions, inventoryTick]);

  const lowStockDishesCount = useMemo(() => {
    return (liveSimulatedMenuItems || []).filter((d) => {
      const rep = getItemRepresentativePortions(d, getVariantPortions);
      return !rep.isOutOfStock && rep.portionCount > 0 && rep.portionCount <= 5;
    }).length;
  }, [liveSimulatedMenuItems, getVariantPortions, inventoryTick]);

  const outOfStockDishesCount = useMemo(() => {
    return (liveSimulatedMenuItems || []).filter((d) => {
      const rep = getItemRepresentativePortions(d, getVariantPortions);
      return rep.portionCount <= 0 || (!d.hasRecipe && d.stockStatus === "out_of_stock");
    }).length;
  }, [liveSimulatedMenuItems, getVariantPortions, inventoryTick]);

  const totalCartReservedUnits = useMemo(() => {
    return (posCart || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
  }, [posCart]);

  const filteredDishes = useMemo(() => {
    return (liveSimulatedMenuItems || []).filter((d) => {
      const matchCat =
        dishCategoryFilter === "all" ||
        d.category.toLowerCase() === dishCategoryFilter.toLowerCase();
      const matchSearch =
        !searchQuery ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [liveSimulatedMenuItems, dishCategoryFilter, searchQuery, inventoryTick]);

  const dishCategoriesList = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    (liveSimulatedMenuItems || []).forEach((d) => {
      const key = (d.category || "other").toLowerCase();
      const label = d.category ? d.category.charAt(0).toUpperCase() + d.category.slice(1) : "Other";
      if (!map.has(key)) {
        map.set(key, { id: key, label, count: 1 });
      } else {
        map.get(key)!.count += 1;
      }
    });
    return Array.from(map.values());
  }, [liveSimulatedMenuItems]);

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* A. TOP BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
            Inventory{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Registry
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Secondary Action: Log Wastage */}
          <button
            type="button"
            onClick={() => setIsWastageModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-bold font-mono cursor-pointer inline-flex items-center gap-2 transition-all shadow-sm hover:scale-[1.02]"
          >
            <Flame className="w-4 h-4" />
            <span>Log Wastage</span>
          </button>

          {/* Primary Action: Add Raw Material */}
          <button
            type="button"
            onClick={openAddModal}
            className="btn-gold animate-sheen px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Add Raw Material</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* B. QUICK STATS BANNER (COMPACT, 3 CARDS ONLY) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full font-mono">
        {/* Card 1: Total Stock Items */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:border-[var(--gold)]/30 min-w-0 w-full border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
            <span className="text-[11px] font-mono font-semibold text-[var(--text-lo)] uppercase tracking-wider break-words whitespace-normal">
              Total Stock Items
            </span>
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0 group-hover:scale-110 transition-transform">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-mono font-extrabold text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight truncate">
              {totalStockItems}
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between gap-1 min-w-0">
              <span className="truncate">Catalogued Materials</span>
              <span className="text-[var(--gold)] font-bold shrink-0">Active</span>
            </div>
          </div>
        </div>

        {/* Card 2: Low Stock Warnings */}
        <div
          className={`glass-panel p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 min-w-0 w-full border border-[var(--border)] ${
            lowStockWarnings > 0
              ? "hover:border-amber-500/40"
              : "hover:border-[#25d366]/40"
          }`}
        >
          <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
            <span
              className={`text-[11px] font-mono font-semibold uppercase tracking-wider break-words whitespace-normal ${
                lowStockWarnings > 0 ? "text-amber-800 dark:text-amber-400" : "text-emerald-700 dark:text-[#25d366]"
              }`}
            >
              Low Stock Warnings
            </span>
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${
                lowStockWarnings > 0
                  ? "bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-[#25d366]/15 dark:border-[#25d366]/30 dark:text-[#25d366]"
              }`}
            >
              {lowStockWarnings > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
          </div>
          <div className="min-w-0">
            <div
              className={`font-mono font-extrabold text-2xl sm:text-3xl tracking-tight truncate ${
                lowStockWarnings > 0 ? "text-amber-800 dark:text-amber-400" : "text-emerald-700 dark:text-[#25d366]"
              }`}
            >
              {lowStockWarnings}
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between gap-1 min-w-0">
              <span className="truncate">Safety Threshold</span>
              <span
                className={`font-bold shrink-0 ${
                  lowStockWarnings > 0 ? "text-amber-800 dark:text-amber-400" : "text-emerald-700 dark:text-[#25d366]"
                }`}
              >
                {lowStockWarnings > 0 ? "Action Required" : "Healthy"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Inventory Valuation */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:border-[var(--gold)]/30 min-w-0 w-full border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
            <span className="text-[11px] font-mono font-semibold text-[var(--text-lo)] uppercase tracking-wider break-words whitespace-normal">
              Inventory Valuation
            </span>
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-mono font-extrabold text-2xl sm:text-3xl text-[var(--gold)] tracking-tight truncate">
              Rs {inventoryValuation.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between gap-1 min-w-0">
              <span className="truncate">Ingredient Asset Value</span>
              <span className="text-[var(--text-lo)] font-bold shrink-0">Cost Basis</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW NAVIGATION TOGGLE & SEARCH: SINGLE HORIZONTAL ROW */}
      {/* ========================================================================= */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full border-b border-[var(--border)] pb-3">
        {/* View Tab Dropdown (styled identically to search bar) */}
        <div className="relative w-[44%] sm:w-60 shrink-0">
          <ResponsiveSelect
            value={activeViewTab}
            onChange={(val) => setActiveViewTab(val as "balances" | "live_stock" | "wastage")}
            buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
            menuClassName="w-56 sm:w-64"
            options={[
              { id: "balances", label: "Stock Balances", count: rawMaterials.length },
              {
                id: "live_stock",
                label: "Live Recipe & Portions",
                count: liveSimulatedMenuItems ? liveSimulatedMenuItems.length : 0,
              },
              { id: "wastage", label: "Wastage Log", count: wastageLogs.length },
            ]}
          />
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeViewTab === "balances"
                ? "Search materials..."
                : activeViewTab === "live_stock"
                ? "Search dishes & portion availability..."
                : "Search wastage..."
            }
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-3 py-2.5 h-10 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW TAB 1: STOCK BALANCES */}
      {/* ========================================================================= */}
      {activeViewTab === "balances" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Universal Categories Dropdown Filter */}
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <ResponsiveSelect
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
                buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
                menuClassName="w-full sm:w-64"
                options={[
                  { id: "all", label: "All Categories", count: rawMaterials.length },
                  ...inventoryCategoriesList.map((cat) => ({
                    id: cat.id,
                    label: cat.label,
                    count: cat.count,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Raw Materials Table & Responsive Stack */}
          <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
            {/* Mobile Stacked Card List (< 768px) - Zero Horizontal Scrolling */}
            <div className="md:hidden flex flex-col divide-y divide-[var(--border)]">
              {rawMaterials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide mb-3">No raw materials registered yet</h3>
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Material</span>
                  </button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No matching raw materials</h3>
                  <p className="text-xs text-[var(--text-lo)] max-w-xs mt-1">No raw materials matched your search or category filter.</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const effectiveStock = effectiveLedger?.get(String(item.id))?.current_stock;
                  const numEffective = typeof effectiveStock === "number" ? Math.max(0, effectiveStock) : item.current_stock;
                  const inFlightReserved = Math.max(0, item.current_stock - numEffective);
                  const itemValue = numEffective * item.cost_per_unit;
                  const isDepleted = numEffective <= 0;
                  const isLow = !isDepleted && numEffective <= item.min_safety_stock;

                  return (
                    <div key={item.id} className="p-3.5 space-y-2.5 bg-[var(--surface-base)]/20 hover:bg-[var(--surface-hi)]/30 transition-colors">
                      {/* Top Row: Name + SKU + Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-[var(--text-hi)] text-sm block">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-faint)] font-mono">
                            SKU: {item.sku || "N/A"} • <span className="text-[var(--gold)] uppercase">{item.category}</span>
                          </span>
                        </div>
                        <span
                          className={`badge-pill ${
                            isDepleted
                              ? "badge-danger"
                              : isLow
                              ? "badge-warning"
                              : "badge-success"
                          }`}
                        >
                          <span className="badge-dot" />
                          {isDepleted ? "DEPLETED" : isLow ? "LOW STOCK" : "IN STOCK"}
                        </span>
                      </div>

                      {/* Metrics: Current Stock, Safety, Unit Cost, Total Value */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[var(--surface-hi)]/50 p-2.5 rounded-lg border border-[var(--border)]">
                        <div>
                          <span className="text-[10px] text-[var(--text-faint)] block uppercase">Available Stock</span>
                          <span className={`font-extrabold text-sm ${isDepleted ? "text-red-700 dark:text-red-400" : isLow ? "text-amber-800 dark:text-amber-400" : "text-emerald-700 dark:text-[#25d366]"}`}>
                            {numEffective.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} <span className="text-[10px] text-[var(--text-faint)] font-normal">{item.unit}</span>
                          </span>
                          {inFlightReserved > 0 && (
                            <span className="text-[9.5px] font-mono text-amber-800 dark:text-amber-400 block mt-0.5 font-semibold">
                              -{inFlightReserved.toFixed(2)} in POS cart ({item.current_stock.toFixed(2)} total)
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-faint)] block uppercase">Safety Level</span>
                          <span className="font-medium text-[var(--text-lo)] text-xs">
                            Min: {item.min_safety_stock} {item.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-faint)] block uppercase">Unit Cost</span>
                          <span className="font-medium text-[var(--text-lo)] text-xs">
                            Rs {item.cost_per_unit.toLocaleString()} / {item.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-faint)] block uppercase">Total Value</span>
                          <span className="font-bold text-[var(--gold)] text-xs">
                            Rs {itemValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[var(--border)]/40">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] text-[10px] font-mono font-semibold cursor-pointer transition-all inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 rounded-lg bg-[var(--surface-hi)] hover:bg-red-500/20 text-[var(--text-lo)] hover:text-red-400 border border-[var(--border)] transition-colors cursor-pointer"
                          title="Delete material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[10px] font-mono text-[var(--text-faint)] uppercase">
                    <th className="py-3.5 px-4 font-bold">Item Name &amp; SKU</th>
                    <th className="py-3.5 px-4 font-bold">Category</th>
                    <th className="py-3.5 px-4 font-bold">Current Stock</th>
                    <th className="py-3.5 px-4 font-bold">Safety Level</th>
                    <th className="py-3.5 px-4 font-bold">Unit Cost</th>
                    <th className="py-3.5 px-4 font-bold">Total Value</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {rawMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4">
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                          <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                            <Boxes className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide mb-4">No raw materials registered yet</h3>
                          <button
                            type="button"
                            onClick={openAddModal}
                            className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] transition-transform"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Material</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4">
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                          <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                            <Boxes className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No matching raw materials</h3>
                          <p className="text-xs text-[var(--text-lo)] max-w-sm mt-1 mb-4">No raw materials matched your search or category filter.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const effectiveStock = effectiveLedger?.get(String(item.id))?.current_stock;
                      const numEffective = typeof effectiveStock === "number" ? Math.max(0, effectiveStock) : item.current_stock;
                      const inFlightReserved = Math.max(0, item.current_stock - numEffective);
                      const isLow = numEffective <= item.min_safety_stock;
                      const itemValue = numEffective * item.cost_per_unit;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[var(--surface-hi)]/40 transition-colors group"
                        >
                          {/* Item Name & SKU */}
                          <td className="py-3.5 px-4">
                            <div>
                              <span className="font-sans font-bold text-sm text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors block">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-[var(--text-faint)]">
                                SKU: {item.sku || `RM-${item.id}`}
                              </span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className="badge-pill badge-neutral text-[10px] uppercase font-semibold">
                              {item.category}
                            </span>
                          </td>

                          {/* Current Stock & Active POS Cart Reservation */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {isLow && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
                                    title="Effective available stock is at or below safety threshold"
                                  />
                                )}
                                <span
                                  className={`font-extrabold text-sm ${
                                    isLow ? "text-amber-800 dark:text-amber-400" : "text-[var(--text-hi)]"
                                  }`}
                                >
                                  {numEffective.toFixed(3)}
                                </span>
                                <span className="text-[11px] text-[var(--text-faint)] lowercase">
                                  {item.unit}
                                </span>
                              </div>
                              {inFlightReserved > 0 && (
                                <span className="text-[9.5px] text-amber-800 dark:text-amber-400 font-mono font-semibold">
                                  -{inFlightReserved.toFixed(2)} in POS cart ({item.current_stock.toFixed(2)} on-hand)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Safety Level */}
                          <td className="py-3.5 px-4 text-[11px] text-[var(--text-lo)]">
                            Min: {item.min_safety_stock} {item.unit}
                          </td>

                          {/* Unit Cost */}
                          <td className="py-3.5 px-4 text-[11px] text-[var(--text-lo)]">
                            Rs {item.cost_per_unit.toLocaleString()} / {item.unit}
                          </td>

                          {/* Total Value */}
                          <td className="py-3.5 px-4 font-bold text-amber-900 dark:text-[var(--gold)] text-xs">
                            Rs {itemValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="p-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all cursor-pointer shadow-sm"
                                title="Edit raw material"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemToDelete(item)}
                                className="p-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-red-500/20 text-[var(--text-lo)] hover:text-red-400 border border-[var(--border)] hover:border-red-500/40 transition-all cursor-pointer shadow-sm"
                                title="Delete raw material"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* VIEW TAB 2: LIVE RECIPE & PORTIONS (MIRRORED FROM POS TERMINAL LEDGER) */}
      {/* ========================================================================= */}
      {activeViewTab === "live_stock" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="glass-panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[var(--text-faint)] uppercase block">Dishes Monitored</span>
                <span className="text-xl font-bold text-[var(--text-hi)] font-mono">{(liveSimulatedMenuItems || []).length}</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
            </div>

            <div className="glass-panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-400 uppercase block font-semibold">In Stock</span>
                <span className="text-xl font-bold text-emerald-400 font-mono">{inStockDishesCount}</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="glass-panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-800 dark:text-amber-400 uppercase block font-semibold">Low Stock (&le; 5)</span>
                <span className="text-xl font-bold text-amber-800 dark:text-amber-400 font-mono">{lowStockDishesCount}</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            <div className="glass-panel p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase block font-semibold">86&apos;d (Sold Out)</span>
                <span className="text-xl font-bold text-rose-700 dark:text-rose-400 font-mono">{outOfStockDishesCount}</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Active POS In-Flight Reservation Notification Banner if cart has items */}
          {totalCartReservedUnits > 0 && (
            <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2.5 text-amber-300">
                <ShoppingCart className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span>
                  Active POS terminal cart is currently reserving ingredients for <strong>{totalCartReservedUnits}</strong> items in real-time. Portions below reflect live remaining yield.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                LIVE SIMULATION
              </span>
            </div>
          )}

          {/* Category Filter */}
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <ResponsiveSelect
                value={dishCategoryFilter}
                onChange={(val) => setDishCategoryFilter(val)}
                buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
                menuClassName="w-full sm:w-64"
                options={[
                  { id: "all", label: "All Dish Categories", count: (liveSimulatedMenuItems || []).length },
                  ...dishCategoriesList.map((cat) => ({
                    id: cat.id,
                    label: cat.label,
                    count: cat.count,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Table & Cards List */}
          <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
            {/* Mobile Stacked Card List (< 768px) */}
            <div className="md:hidden flex flex-col divide-y divide-[var(--border)]">
              {filteredDishes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No matching dishes</h3>
                  <p className="text-xs text-[var(--text-lo)] max-w-xs mt-1">No items matched your category filter or search query.</p>
                </div>
              ) : (
                filteredDishes.map((dish) => {
                  const repYield = getItemRepresentativePortions(dish, getVariantPortions);
                  const isStrictlyZeroStock = repYield.portionCount <= 0;
                  const isEffectivelyOos = isStrictlyZeroStock || (!dish.hasRecipe && dish.stockStatus === "out_of_stock");

                  return (
                    <div key={dish.id} className="p-3.5 space-y-3 bg-[var(--surface-base)]/20 hover:bg-[var(--surface-hi)]/30 transition-colors">
                      <div className="flex items-start gap-3 justify-between">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
                            <img
                              src={getSmartFoodImage(dish.name, dish.category, dish.imageUrl || dish.image_url)}
                              alt={dish.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-[var(--text-hi)] text-sm truncate block">
                              {dish.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)] font-mono mt-0.5">
                              <span className="badge-pill badge-neutral text-[10px] uppercase font-semibold">
                                {dish.category}
                              </span>
                              <span>ID: {dish.id}</span>
                            </div>
                            <ItemPortionAvailabilityText
                              displayText={repYield.displayText}
                              textColorClass={repYield.textColorClass}
                            />
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <ItemStockStatusBadge
                            isOutOfStock={isEffectivelyOos}
                            portionCount={repYield.portionCount}
                          />
                        </div>
                      </div>

                      {/* Variants Yields */}
                      {dish.variants && dish.variants.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-[var(--border)]/40">
                          <span className="text-[9.5px] font-mono text-[var(--text-faint)] uppercase block">
                            Variant Breakdown (Integer Floored):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {dish.variants.map((v, idx) => {
                              const vYield = getVariantPortions
                                ? getVariantPortions(dish, v)
                                : {
                                    maxPortions: repYield.portionCount,
                                    isOutOfStock: isEffectivelyOos,
                                    stockStatus: isEffectivelyOos ? ("out_of_stock" as const) : repYield.portionCount <= 5 ? ("low_stock" as const) : ("in_stock" as const),
                                  };
                              return (
                                <div
                                  key={v.id || idx}
                                  className="flex items-center gap-1.5 bg-[var(--surface-hi)] px-2 py-1 rounded-lg border border-[var(--border)] text-[10px] font-mono"
                                >
                                  <span className="text-[var(--text-hi)] font-medium">{v.name}:</span>
                                  <VariantPortionBadge yieldResult={vYield} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Action */}
                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/40 text-xs">
                        <span className="font-mono text-[10px] text-[var(--text-faint)]">
                          Price: Rs {dish.price.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingDish(dish);
                            setSelectedInspectVariant(dish.variants && dish.variants.length > 0 ? dish.variants[0] : null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] text-[10.5px] font-mono font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect BOM</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[10px] font-mono text-[var(--text-faint)] uppercase whitespace-nowrap">
                    <th className="py-3.5 px-4 font-bold">Dish Item</th>
                    <th className="py-3.5 px-4 font-bold">Category</th>
                    <th className="py-3.5 px-4 font-bold">Price</th>
                    <th className="py-3.5 px-4 font-bold">Live Status</th>
                    <th className="py-3.5 px-4 font-bold">Variants &amp; Recipe Yields</th>
                    <th className="py-3.5 px-4 font-bold text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredDishes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4">
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                          <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                            <UtensilsCrossed className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No matching dishes</h3>
                          <p className="text-xs text-[var(--text-lo)] max-w-sm mt-1">No items matched your category filter or search query.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDishes.map((dish) => {
                      const repYield = getItemRepresentativePortions(dish, getVariantPortions);
                      const isStrictlyZeroStock = repYield.portionCount <= 0;
                      const isEffectivelyOos = isStrictlyZeroStock || (!dish.hasRecipe && dish.stockStatus === "out_of_stock");

                      return (
                        <tr key={dish.id} className="hover:bg-[var(--surface-hi)]/40 transition-colors group">
                          {/* Dish Item & Plain Text Availability Counter */}
                          <td className="py-3.5 px-4 font-sans">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden relative shadow-sm">
                                <img
                                  src={getSmartFoodImage(dish.name, dish.category, dish.imageUrl || dish.image_url)}
                                  alt={dish.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              </div>
                              <div>
                                <span className="font-bold text-sm text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors block">
                                  {dish.name}
                                </span>
                                <span className="text-[10px] text-[var(--text-faint)] font-mono">
                                  ID: {dish.id}
                                </span>
                                <ItemPortionAvailabilityText
                                  displayText={repYield.displayText}
                                  textColorClass={repYield.textColorClass}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="badge-pill badge-neutral text-[10px] uppercase font-semibold">
                              {dish.category}
                            </span>
                          </td>

                          {/* Price */}
                          <td className="py-3.5 px-4 whitespace-nowrap font-extrabold text-[var(--gold)] text-xs">
                            Rs {dish.price.toLocaleString()}
                          </td>

                          {/* Live Status Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <ItemStockStatusBadge
                              isOutOfStock={isEffectivelyOos}
                              portionCount={repYield.portionCount}
                            />
                          </td>

                          {/* Variants & Recipe Yields */}
                          <td className="py-3.5 px-4">
                            {dish.variants && dish.variants.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 max-w-sm">
                                {dish.variants.map((v, idx) => {
                                  const vYield = getVariantPortions
                                    ? getVariantPortions(dish, v)
                                    : {
                                        maxPortions: repYield.portionCount,
                                        isOutOfStock: isEffectivelyOos,
                                        stockStatus: isEffectivelyOos ? ("out_of_stock" as const) : repYield.portionCount <= 5 ? ("low_stock" as const) : ("in_stock" as const),
                                      };
                                  return (
                                    <span
                                      key={v.id || idx}
                                      className="inline-flex items-center gap-1 bg-[var(--surface-hi)] px-2 py-0.5 rounded border border-[var(--border)] text-[9.5px] font-mono"
                                    >
                                      <span className="text-[var(--text-lo)] font-medium">{v.name}:</span>
                                      <VariantPortionBadge yieldResult={vYield} />
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[var(--text-faint)]">
                                Single portion item
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setInspectingDish(dish);
                                setSelectedInspectVariant(dish.variants && dish.variants.length > 0 ? dish.variants[0] : null);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-sm"
                              title="Inspect Recipe BOM & Inventory Breakdown"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect BOM</span>
                            </button>
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
      )}

      {/* ========================================================================= */}
      {/* VIEW TAB 3: WASTAGE & SPOILAGE LOG */}
      {/* ========================================================================= */}
      {activeViewTab === "wastage" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
            {/* Mobile Stacked Card List (< 768px) - Zero Horizontal Scrolling */}
            <div className="md:hidden flex flex-col divide-y divide-[var(--border)]">
              {wastageLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                    <Flame className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide mb-3">No wastage logged yet</h3>
                  <button
                    type="button"
                    onClick={() => setIsWastageModalOpen(true)}
                    className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Log Wastage</span>
                  </button>
                </div>
              ) : filteredWastage.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                    <Flame className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No matching wastage records</h3>
                  <p className="text-xs text-[var(--text-lo)] max-w-xs mt-1">No wastage logs matched your search query.</p>
                </div>
              ) : (
                filteredWastage.map((entry) => {
                  const dateFormatted = entry.created_at
                    ? new Date(entry.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Just now";

                  return (
                    <div key={entry.id} className="p-3.5 space-y-2 bg-[var(--surface-base)]/20 hover:bg-[var(--surface-hi)]/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-[var(--text-hi)] text-sm block">
                            {entry.raw_material_name}
                          </span>
                          <span className="text-[10px] text-[var(--text-faint)] font-mono">
                            {dateFormatted} • By {entry.logged_by}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-semibold uppercase">
                          {entry.reason}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono bg-[var(--surface-hi)]/50 px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
                        <span className="text-[11px] text-[var(--text-lo)]">
                          Wasted: <strong className="text-red-400 font-extrabold">{entry.quantity.toFixed(3)} {entry.unit}</strong>
                        </span>
                        <span className="font-bold text-red-400 text-xs">
                          Loss: Rs {entry.cost_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[10px] font-mono text-[var(--text-faint)] uppercase">
                    <th className="py-3.5 px-4 font-bold">Date &amp; Time</th>
                    <th className="py-3.5 px-4 font-bold">Item Name</th>
                    <th className="py-3.5 px-4 font-bold">Quantity Wasted</th>
                    <th className="py-3.5 px-4 font-bold">Reason</th>
                    <th className="py-3.5 px-4 font-bold">Financial Loss</th>
                    <th className="py-3.5 px-4 font-bold text-right">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {wastageLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4">
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                          <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                            <Flame className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide mb-4">No wastage logged yet</h3>
                          <button
                            type="button"
                            onClick={() => setIsWastageModalOpen(true)}
                            className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] transition-transform"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Log Wastage</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filteredWastage.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4">
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                          <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                            <Flame className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No matching wastage records</h3>
                          <p className="text-xs text-[var(--text-lo)] max-w-sm mt-1 mb-4">No wastage logs matched your search query.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredWastage.map((entry) => {
                      const dateFormatted = entry.created_at
                        ? new Date(entry.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Just now";

                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-[var(--surface-hi)]/40 transition-colors"
                        >
                          {/* Date & Time */}
                          <td className="py-3.5 px-4 text-[var(--text-lo)] text-[11px]">
                            {dateFormatted}
                          </td>

                          {/* Item Name */}
                          <td className="py-3.5 px-4">
                            <span className="font-sans font-bold text-sm text-[var(--text-hi)] block">
                              {entry.raw_material_name}
                            </span>
                          </td>

                          {/* Quantity Wasted */}
                          <td className="py-3.5 px-4 font-extrabold text-red-400 text-xs">
                            {entry.quantity.toFixed(3)}{" "}
                            <span className="text-[10px] font-normal text-[var(--text-faint)] lowercase">
                              {entry.unit}
                            </span>
                          </td>

                          {/* Reason */}
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[10px] font-semibold uppercase">
                              {entry.reason}
                            </span>
                          </td>

                          {/* Financial Loss */}
                          <td className="py-3.5 px-4 font-extrabold text-red-400 text-xs">
                            Rs {entry.cost_loss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Logged By */}
                          <td className="py-3.5 px-4 text-right text-[var(--text-lo)] text-[11px]">
                            <span className="inline-flex items-center gap-1 justify-end">
                              <User className="w-3 h-3 text-[var(--text-faint)]" />
                              <span>{entry.logged_by}</span>
                            </span>
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
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT RAW MATERIAL MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface-hi)]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)] tracking-tight">
                    {editingItem ? "Edit Raw Material" : "Add Raw Material"}
                  </h3>
                  <p className="text-xs text-[var(--text-lo)] mt-0.5">
                    Configure ingredient stock, safety thresholds, and purchasing costs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs font-sans custom-scrollbar">
                {/* Item Name */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Item Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Chicken Breast Fillet"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  />
                </div>

                {/* Category & Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-[var(--text-lo)]">
                        Category
                      </label>
                      {isCustomCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(false);
                            setFormCategory(CATEGORIES[0]);
                          }}
                          className="text-[11px] text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <X className="w-3 h-3" />
                          <span>Presets</span>
                        </button>
                      )}
                    </div>
                    {isCustomCategory ? (
                      <input
                        type="text"
                        autoFocus
                        required
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="e.g. Seafood, Oils"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={formCategory}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setIsCustomCategory(true);
                              setFormCategory("");
                            } else {
                              setFormCategory(e.target.value);
                            }
                          }}
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                              {cat}
                            </option>
                          ))}
                          <option value="__custom__" className="bg-[var(--bg-deep)] text-[var(--gold)] font-bold">
                            + Custom Category...
                          </option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-[var(--text-lo)]">
                        Measurement Unit
                      </label>
                      {isCustomUnit && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomUnit(false);
                            setFormUnit(UNITS[0]);
                          }}
                          className="text-[11px] text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <X className="w-3 h-3" />
                          <span>Presets</span>
                        </button>
                      )}
                    </div>
                    {isCustomUnit ? (
                      <input
                        type="text"
                        autoFocus
                        required
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value)}
                        placeholder="e.g. boxes, cans, packs"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={formUnit}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setIsCustomUnit(true);
                              setFormUnit("");
                            } else {
                              setFormUnit(e.target.value);
                            }
                          }}
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                              {u}
                            </option>
                          ))}
                          <option value="__custom__" className="bg-[var(--bg-deep)] text-[var(--gold)] font-bold">
                            + Custom Unit...
                          </option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Current Stock & Min Safety Stock */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Current Stock ({formUnit}) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      required
                      value={formCurrentStock}
                      onChange={(e) => setFormCurrentStock(e.target.value)}
                      placeholder="0.000"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] font-mono font-bold text-[var(--gold)] focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Safety Alert Level ({formUnit}) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      required
                      value={formMinSafetyStock}
                      onChange={(e) => setFormMinSafetyStock(e.target.value)}
                      placeholder="5.000"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] font-mono focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Purchase Cost per Unit & SKU */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Cost per Unit (Rs) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--gold)] pointer-events-none">
                        Rs
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formCostPerUnit}
                        onChange={(e) => setFormCostPerUnit(e.target.value)}
                        placeholder="e.g. 850"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[var(--text-hi)] font-mono font-bold text-[var(--gold)] focus:outline-none transition-all placeholder:text-[var(--text-lo)]/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      SKU Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      placeholder="Auto-generated if blank"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons Footer */}
              <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border)] flex items-center justify-end gap-2.5 shrink-0 bg-[var(--bg-deep)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : editingItem ? "Save Changes" : "Create Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      {itemToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setItemToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-red-500/40 shadow-2xl p-5 space-y-4 font-sans animate-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--text-hi)]">Delete Material?</h4>
                  <p className="text-[11px] font-mono text-[var(--text-faint)] mt-0.5">
                    Confirm removing &ldquo;{itemToDelete.name}&rdquo;
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="w-7 h-7 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] border border-[var(--border)] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md cursor-pointer transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WASTAGE & SPOILAGE LOGGING MODAL */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* RECIPE BOM & INGREDIENT BREAKDOWN INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {inspectingDish && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectingDish(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-2xl bg-[var(--bg-deep)] border border-[var(--border)] rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150 text-[var(--text-hi)] font-sans">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 overflow-hidden shrink-0">
                  <img
                    src={getSmartFoodImage(inspectingDish.name, inspectingDish.category, inspectingDish.imageUrl || inspectingDish.image_url)}
                    alt={inspectingDish.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[var(--gold)] uppercase font-bold tracking-wider">
                    Recipe BOM Breakdown &bull; {inspectingDish.category}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-hi)]">
                    {inspectingDish.name}
                  </h3>
                  <p className="text-[11px] text-[var(--text-lo)] font-mono">
                    Live integer floor yield calculation &bull; Real-time active POS ledger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingDish(null)}
                className="w-8 h-8 rounded-full bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If Item has Multiple Variants: Variant Selector Tabs */}
            {inspectingDish.variants && inspectingDish.variants.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10.5px] font-mono text-[var(--text-faint)] uppercase block font-semibold">
                  Select Size / Variant:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {inspectingDish.variants.map((v) => {
                    const isSelected = selectedInspectVariant?.id === v.id || (!selectedInspectVariant && v.isDefault);
                    const vYield = getVariantPortions
                      ? getVariantPortions(inspectingDish, v)
                      : { maxPortions: 0, isOutOfStock: true, stockStatus: "out_of_stock" as const };

                    return (
                      <button
                        key={v.id || v.name}
                        type="button"
                        onClick={() => setSelectedInspectVariant(v)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-2 border cursor-pointer ${
                          isSelected
                            ? "bg-[var(--gold-dim)] border-[var(--gold)] text-[var(--gold)] font-bold shadow-xs"
                            : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)] hover:border-[var(--gold)]/40"
                        }`}
                      >
                        <span>{v.name}</span>
                        <VariantPortionBadge yieldResult={vYield} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recipe Ingredients & Real-Time Availability Table */}
            {(() => {
              const activeVariant = selectedInspectVariant || (inspectingDish.variants && inspectingDish.variants[0]);
              const rawItemId = String(inspectingDish.id);
              const baseId = rawItemId.includes("_") ? rawItemId.split("_")[0] : rawItemId;
              let dishRecipes = (rawRecipes || []).filter(
                (r) => String(r.menu_item_id) === baseId || String(r.menu_item_id) === rawItemId
              );
              if (dishRecipes.length === 0) {
                if (Array.isArray((inspectingDish as any).recipe) && (inspectingDish as any).recipe.length > 0) {
                  dishRecipes = (inspectingDish as any).recipe;
                } else if (Array.isArray((inspectingDish as any).recipe_items) && (inspectingDish as any).recipe_items.length > 0) {
                  dishRecipes = (inspectingDish as any).recipe_items;
                }
              }

              if (dishRecipes.length === 0) {
                return (
                  <div className="py-8 text-center text-xs font-mono text-[var(--text-faint)] bg-[var(--surface-hi)]/30 rounded-2xl border border-[var(--border)]">
                    No recipe ingredients linked to this item in Supabase yet.
                  </div>
                );
              }

              // Compute yield for this variant
              const yieldResult = getVariantPortions
                ? getVariantPortions(inspectingDish, activeVariant)
                : { maxPortions: 0, isOutOfStock: false, stockStatus: "in_stock" as const };

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--text-lo)]">
                      Total BOM Portions Available:{" "}
                      <strong className={yieldResult.maxPortions > 5 ? "text-emerald-700 dark:text-emerald-400" : yieldResult.maxPortions > 0 ? "text-amber-800 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}>
                        {yieldResult.maxPortions}
                      </strong>
                    </span>
                    {yieldResult.limitingIngredient && (
                      <span className="text-[11px] text-amber-800 dark:text-amber-400 font-semibold">
                        Bottleneck: {yieldResult.limitingIngredient}
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="bg-[var(--surface-hi)] border-b border-[var(--border)] text-[10px] text-[var(--text-faint)] uppercase whitespace-nowrap">
                          <th className="py-2.5 px-3">Ingredient</th>
                          <th className="py-2.5 px-2 text-right">Req Qty</th>
                          <th className="py-2.5 px-2 text-right">Physical</th>
                          <th className="py-2.5 px-2 text-right">POS Reserved</th>
                          <th className="py-2.5 px-2 text-right">Effective</th>
                          <th className="py-2.5 px-3 text-right">Yield</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]/60">
                        {dishRecipes.map((r: any, idx: number) => {
                          const matId = String(r.raw_material_id);
                          const rawObj = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
                          const matName = rawObj?.name || r.raw_material_name || `Material #${matId}`;
                          const unit = r.unit || rawObj?.unit || "kg";
                          const req = Number(r.quantity_required) || 0;
                          const physical = Number(baseMaterialsMap.get(matId)?.current_stock ?? rawObj?.current_stock ?? 0);
                          const effective = Number(effectiveLedger.get(matId)?.current_stock ?? physical);
                          const reserved = Math.max(0, physical - effective);
                          const yieldForIng = req > 0 ? Math.floor((Math.max(0, effective) + 1e-9) / req) : Infinity;
                          const isBottleneck = yieldForIng === yieldResult.maxPortions;

                          return (
                            <tr key={`${matId}_${idx}`} className={`hover:bg-[var(--surface-hi)]/30 ${isBottleneck ? "bg-amber-500/5" : ""}`}>
                              <td className="py-2 px-3 font-sans font-medium text-[var(--text-hi)]">
                                <span>{matName}</span>
                                {isBottleneck && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8.5px] bg-amber-500/15 text-amber-900 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 font-mono font-bold">
                                    LIMITING
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-amber-800 dark:text-[var(--gold)]">
                                {req} {unit}
                              </td>
                              <td className="py-2 px-2 text-right text-[var(--text-lo)]">
                                {physical.toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-right text-amber-800 dark:text-amber-400 font-semibold">
                                {reserved > 0 ? `-${reserved.toFixed(2)}` : "0"}
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-[var(--text-hi)]">
                                {effective.toFixed(2)} {unit}
                              </td>
                              <td className="py-2 px-3 text-right font-black font-mono">
                                <span className={yieldForIng <= 5 ? (yieldForIng === 0 ? "text-rose-700 dark:text-rose-400" : "text-amber-800 dark:text-amber-400") : "text-emerald-700 dark:text-emerald-400"}>
                                  {yieldForIng === Infinity ? "∞" : yieldForIng}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="pt-2 flex justify-end border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setInspectingDish(null)}
                className="btn-gold px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WASTAGE & SPOILAGE LOGGING MODAL */}
      {/* ========================================================================= */}
      <WastageModal
        isOpen={isWastageModalOpen}
        rawMaterials={rawMaterials}
        onClose={() => setIsWastageModalOpen(false)}
        onWastageLogged={(newWastage, updatedMatId, newStock) => {
          setWastageLogs((prev) => [newWastage, ...prev]);
          setRawMaterials((prev) =>
            prev.map((m) =>
              String(m.id) === String(updatedMatId)
                ? { ...m, current_stock: newStock }
                : m
            )
          );
        }}
        showToast={showToast}
      />
    </div>
  );
}
