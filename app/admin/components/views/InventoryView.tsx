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
} from "lucide-react";
import { RawMaterial, InventoryWastage } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { useAdminCache } from "../../context/AdminCacheContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import WastageModal from "./WastageModal";

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
  const { rawMaterials: cachedRawMaterials, updateRawMaterialRow, insertRawMaterialRow, deleteRawMaterialRow } = useAdminCache();

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

  // Active View Tab: Stock Balances vs. Wastage Log
  const [activeViewTab, setActiveViewTab] = useState<"balances" | "wastage">("balances");

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

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* A. TOP BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <Boxes className="w-3.5 h-3.5" />
            <span>RAW MATERIALS &amp; WASTAGE CONTROL</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-[var(--text-hi)] tracking-tight">
            Inventory{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Registry
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Real-time raw material balances and stock thresholds
          </p>
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
                lowStockWarnings > 0 ? "text-amber-400" : "text-[#25d366]"
              }`}
            >
              Low Stock Warnings
            </span>
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${
                lowStockWarnings > 0
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-[#25d366]/15 border-[#25d366]/30 text-[#25d366]"
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
                lowStockWarnings > 0 ? "text-amber-400" : "text-[#25d366]"
              }`}
            >
              {lowStockWarnings}
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between gap-1 min-w-0">
              <span className="truncate">Safety Threshold</span>
              <span
                className={`font-bold shrink-0 ${
                  lowStockWarnings > 0 ? "text-amber-400" : "text-[#25d366]"
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
            onChange={(val) => setActiveViewTab(val as "balances" | "wastage")}
            buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
            menuClassName="w-56 sm:w-60"
            options={[
              { id: "balances", label: "Stock Balances", count: rawMaterials.length },
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
            placeholder={activeViewTab === "balances" ? "Search materials..." : "Search wastage..."}
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

          {/* Raw Materials Table */}
          <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
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
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                            <Boxes className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-white tracking-wide mb-4">No raw materials registered yet</h3>
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
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                            <Boxes className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-white tracking-wide">No matching raw materials</h3>
                          <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">No raw materials matched your search or category filter.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isLow = item.current_stock <= item.min_safety_stock;
                      const itemValue = item.current_stock * item.cost_per_unit;

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
                            <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] text-[10.5px] font-semibold text-[var(--text-lo)] uppercase">
                              {item.category}
                            </span>
                          </td>

                          {/* Current Stock */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {isLow && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
                                  title="Stock is at or below safety threshold"
                                />
                              )}
                              <span
                                className={`font-extrabold text-sm ${
                                  isLow ? "text-amber-400" : "text-[var(--text-hi)]"
                                }`}
                              >
                                {item.current_stock.toFixed(3)}
                              </span>
                              <span className="text-[11px] text-[var(--text-faint)] lowercase">
                                {item.unit}
                              </span>
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
                          <td className="py-3.5 px-4 font-bold text-[var(--gold)] text-xs">
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
      {/* VIEW TAB 2: WASTAGE & SPOILAGE LOG */}
      {/* ========================================================================= */}
      {activeViewTab === "wastage" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
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
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                            <Flame className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-white tracking-wide mb-4">No wastage logged yet</h3>
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
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                            <Flame className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm font-semibold text-white tracking-wide">No matching wastage records</h3>
                          <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">No wastage logs matched your search query.</p>
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
