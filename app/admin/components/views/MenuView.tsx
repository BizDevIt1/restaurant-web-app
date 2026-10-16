"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  UtensilsCrossed,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  Star,
  ChevronDown,
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MenuItem, RawMaterial, ItemVariant } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { useAdminCache } from "../../context/AdminCacheContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import RecipeModal from "./RecipeModal";
import DishDetailsModal from "./DishDetailsModal";
import MenuItemFormView from "./MenuItemFormView";
import { getSmartFoodImage } from "@/utils/posFoodImages";
import { applyRecipeCalculationsToMenu } from "@/lib/recipePortions";
import {
  ItemPortionAvailabilityText,
  ItemStockStatusBadge,
  VariantPortionBadge,
} from "@/app/components/PosInventoryPortionBadges";
import { getMenuItemStation, getStationBadgeInfo, normalizeStationName } from "@/lib/kitchenStationRouting";
import { getItemRepresentativePortions } from "@/lib/posLedgerSync";

interface MenuViewProps {
  menuItems: MenuItem[];
  onAddDish?: (newDish: MenuItem) => void;
  onUpdateDish?: (updatedDish: MenuItem) => void;
  onDeleteDish?: (dishId: string) => void;
  handleToggleStock?: (dishId: string) => void;
  onToggleStock?: (dishId: string) => void;
  showToast: (msg: string) => void;
  routeAction?: { action: "new" | "edit" | "reconciliation"; id?: string } | null;
}

interface FormIngredient {
  raw_material_id: string | number;
  raw_material_name: string;
  category: string;
  quantity_required: number;
  unit: string;
  cost_per_unit: number;
}

const PREDEFINED_CATEGORIES = [
  { id: "karahi", label: "Karahi & Handi" },
  { id: "bbq", label: "Desi BBQ & Tandoor" },
  { id: "burgers", label: "Smash Burgers" },
  { id: "fast_food", label: "Fast Food & Pizza" },
  { id: "drinks", label: "Beverages & Tea" },
  { id: "desserts", label: "Desserts" },
];

const VARIANT_PRESETS = [
  {
    label: "Drinks / Beverages",
    variants: [
      { id: "v1", name: "250ml", price: 100 },
      { id: "v2", name: "500ml", price: 180 },
      { id: "v3", name: "1.5L", price: 280 },
      { id: "v4", name: "2.25L", price: 380 },
    ],
  },
  {
    label: "Pizza Sizes",
    variants: [
      { id: "v1", name: "Small (8\")", price: 650 },
      { id: "v2", name: "Medium (10\")", price: 1250 },
      { id: "v3", name: "Large (12\")", price: 1850 },
      { id: "v4", name: "Extra Large (14\")", price: 2450 },
    ],
  },
  {
    label: "Desi / Handi / Karahi",
    variants: [
      { id: "v1", name: "Half", price: 1200 },
      { id: "v2", name: "Full", price: 2200 },
    ],
  },
  {
    label: "Custom / Fast Food",
    variants: [
      { id: "v1", name: "Single Patty", price: 650 },
      { id: "v2", name: "Double Patty", price: 950 },
    ],
  },
];

function VariantSectionEditor({
  hasVariants,
  setHasVariants,
  formPrice,
  setFormPrice,
  formVariants,
  setFormVariants,
  showToast,
}: {
  hasVariants: boolean;
  setHasVariants: React.Dispatch<React.SetStateAction<boolean>>;
  formPrice: string;
  setFormPrice: React.Dispatch<React.SetStateAction<string>>;
  formVariants: ItemVariant[];
  setFormVariants: React.Dispatch<React.SetStateAction<ItemVariant[]>>;
  showToast: (msg: string) => void;
}) {
  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-hi)]/60 border border-[var(--border)] space-y-3.5">
      {/* Toggle Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className="text-xs font-bold text-[var(--text-hi)] flex items-center gap-1.5 font-mono">
            <Layers className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span>Portions, Sizes &amp; Volume Variants</span>
          </label>
          <p className="text-[11px] text-[var(--text-lo)] mt-0.5">
            Does this item have multiple sizes or volume options?
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !hasVariants;
            setHasVariants(next);
            if (next && formVariants.length === 0) {
              const base = parseFloat(formPrice) || 1000;
              setFormVariants([
                { id: `var_${Date.now()}_1`, name: "Regular", price: base },
                { id: `var_${Date.now()}_2`, name: "Large", price: Math.round(base * 1.5) },
              ]);
            }
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            hasVariants ? "bg-[var(--gold)]" : "bg-zinc-700"
          }`}
          role="switch"
          aria-checked={hasVariants}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
              hasVariants ? "translate-x-5 bg-black" : "translate-x-0 bg-white"
            }`}
          />
        </button>
      </div>

      {!hasVariants ? (
        // Standard Single Base Price Input
        <div>
          <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
            Base Selling Price (Rs.) <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--gold)] pointer-events-none">
              Rs.
            </span>
            <input
              type="number"
              min="0"
              step="1"
              required={!hasVariants}
              value={formPrice}
              onChange={(e) => setFormPrice(e.target.value)}
              placeholder="0"
              className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl pl-12 pr-3.5 py-2.5 text-xs text-[var(--text-hi)] font-mono font-bold text-[var(--gold)] focus:outline-none transition-all placeholder:text-[var(--text-lo)]/30"
            />
          </div>
        </div>
      ) : (
        // Dynamic Variant Builder
        <div className="space-y-3.5 pt-1 border-t border-[var(--border)]/60">
          {/* Preset Chips */}
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)] block mb-1.5">
              Quick Preset Templates (1-Click Auto-Fill)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VARIANT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setFormVariants(
                      preset.variants.map((v, i) => ({
                        ...v,
                        id: `var_${Date.now()}_${i}`,
                      }))
                    );
                    showToast(`Applied "${preset.label}" sizes.`);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[var(--surface-mid)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)] border border-[var(--border)] text-[10.5px] font-mono font-semibold transition-colors text-[var(--text-lo)] cursor-pointer active:scale-95"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Variant Rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-[var(--text-muted)] px-1">
              <span>Portion / Size Label</span>
              <span className="pr-12">Price (PKR)</span>
            </div>

            {formVariants.map((v, idx) => (
              <div key={v.id || idx} className="space-y-1.5 p-2 rounded-xl bg-[var(--surface-mid)]/40 border border-[var(--border)]/60">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => {
                      const updated = [...formVariants];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setFormVariants(updated);
                    }}
                    placeholder='e.g. Small (8"), 1.5L, Half'
                    className="flex-1 bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] font-medium focus:outline-none"
                  />

                  <div className="w-28 relative shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold text-[var(--gold)] pointer-events-none">
                      Rs.
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={v.price || ""}
                      onChange={(e) => {
                        const updated = [...formVariants];
                        updated[idx] = {
                          ...updated[idx],
                          price: parseFloat(e.target.value) || 0,
                        };
                        setFormVariants(updated);
                      }}
                      placeholder="0"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 rounded-xl pl-8 pr-2.5 py-2 text-xs text-[var(--gold)] font-mono font-bold focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (formVariants.length <= 1) {
                        showToast("Must retain at least one size variant.");
                        return;
                      }
                      setFormVariants(formVariants.filter((_, i) => i !== idx));
                    }}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer shrink-0"
                    title="Remove Size Variant"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Independent Image URL per variant */}
                <div className="flex items-center gap-2 px-0.5">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]">
                      <LinkIcon className="w-3 h-3" />
                    </span>
                    <input
                      type="url"
                      value={v.imageUrl || v.image_url || ""}
                      onChange={(e) => {
                        const updated = [...formVariants];
                        updated[idx] = {
                          ...updated[idx],
                          imageUrl: e.target.value,
                          image_url: e.target.value,
                        };
                        setFormVariants(updated);
                      }}
                      placeholder="Variant photo URL (optional, e.g. distinct 1.5L bottle photo)"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 rounded-lg pl-7 pr-2 py-1 text-[11px] text-[var(--text-lo)] font-mono placeholder:text-[var(--text-lo)]/30 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Another Variant Button */}
          <button
            type="button"
            onClick={() => {
              setFormVariants((prev) => [
                ...prev,
                { id: `var_${Date.now()}_${prev.length}`, name: "", price: 0 },
              ]);
            }}
            className="w-full py-2 rounded-xl bg-[var(--surface-mid)] hover:bg-[var(--surface)] border border-dashed border-[var(--border-hi)] text-xs font-mono font-semibold text-[var(--gold)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Another Size/Portion</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function MenuView({
  menuItems,
  onAddDish,
  onUpdateDish,
  onDeleteDish,
  handleToggleStock,
  onToggleStock,
  showToast,
  routeAction,
}: MenuViewProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Helper to extract numeric restaurant ID for PostgreSQL BIGINT
  const parseNumericId = (id?: string | number): number => {
    if (!id) return 27;
    if (typeof id === "number") return id;
    const digits = String(id).replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : 27;
  };

  // Connect Admin Menu View to the shared live POS inventory ledger & simulated catalog
  const {
    rawRecipes,
    rawMaterials,
    effectiveLedger,
    liveSimulatedMenuItems,
    getVariantPortions,
    inventoryTick,
  } = useAdminCache();

  // Detailed Recipe & Variant Inspection Modal (Eye icon)
  const [inspectingDish, setInspectingDish] = useState<MenuItem | null>(null);

  // Local catalog synchronized directly with live simulated inventory engine
  const [catalog, setCatalog] = useState<MenuItem[]>(() =>
    liveSimulatedMenuItems && liveSimulatedMenuItems.length > 0
      ? liveSimulatedMenuItems
      : menuItems || []
  );

  useEffect(() => {
    if (liveSimulatedMenuItems && liveSimulatedMenuItems.length > 0) {
      setCatalog(liveSimulatedMenuItems);
    } else if (menuItems) {
      setCatalog(menuItems);
    }
  }, [liveSimulatedMenuItems, menuItems, inventoryTick]);

  // Load items from Supabase on mount / tenant change
  const fetchFromSupabase = useCallback(async () => {
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[MenuView] Supabase load error:", error);
        return;
      }

      if (data) {
        let mapped: MenuItem[] = data.map((row: any) => {
          const prepMinutes =
            Number(row.preparation_time) ||
            parseInt(String(row.prep_time || "15").replace(/[^0-9]/g, "")) ||
            15;
          return {
            id: row.id,
            name: row.name,
            category: row.category || "karahi",
            kitchen_station: row.kitchen_station || row.station || undefined,
            station: row.kitchen_station || row.station || undefined,
            price: Number(row.price),
            prepTime: row.prep_time || `${prepMinutes}m`,
            preparation_time: prepMinutes,
            stockStatus: row.stock_status || "in_stock",
            stockCount: row.stock_count ?? 20,
            imageIcon: row.image_icon || "",
            isPopular: Boolean(row.is_popular || row.is_featured || row.isPopular || row.isFeatured),
            is_popular: Boolean(row.is_popular || row.is_featured || row.isPopular || row.isFeatured),
            isFeatured: Boolean(row.is_popular || row.is_featured || row.isPopular || row.isFeatured),
            is_featured: Boolean(row.is_popular || row.is_featured || row.isPopular || row.isFeatured),
            variants: (() => {
              if (Array.isArray(row.variants) && row.variants.length > 0) return row.variants;
              if (row.description) {
                try {
                  const parsed = JSON.parse(row.description);
                  if (Array.isArray(parsed.variants) && parsed.variants.length > 0) return parsed.variants;
                } catch {}
              }
              if (Array.isArray(row.metadata?.variants) && row.metadata.variants.length > 0) return row.metadata.variants;
              return undefined;
            })(),
            is_available: (row.stock_status || "in_stock") !== "out_of_stock",
            in_stock: (row.stock_status || "in_stock") !== "out_of_stock",
            image_url: row.image_url || undefined,
            imageUrl: row.image_url || undefined,
          };
        });

        // Fetch recipes and linked raw materials to compute live food costs, margins, and dynamic stock availability
        try {
          const { data: recipeRows } = await supabase
            .from("recipe_items")
            .select(
              "menu_item_id, variant_id, variant_name, raw_material_id, quantity_required, unit, raw_materials(id, name, current_stock, min_safety_stock, cost_per_unit, unit)"
            )
            .eq("restaurant_id", restId);

          if (recipeRows && recipeRows.length > 0) {
            mapped = mapped.map((item) => {
              if (item.variants && Array.isArray(item.variants)) {
                const enrichedVars = item.variants.map((v) => {
                  if (v.recipe && Array.isArray(v.recipe) && v.recipe.length > 0) return v;
                  const matched = recipeRows.filter(
                    (r: any) =>
                      String(r.menu_item_id) === String(item.id) &&
                      ((r.variant_id && String(r.variant_id) === String(v.id)) ||
                        (r.variant_name && v.name && r.variant_name.trim().toLowerCase() === v.name.trim().toLowerCase()))
                  );
                  if (matched.length > 0) {
                    return {
                      ...v,
                      recipe: matched.map((r: any) => {
                        const raw = Array.isArray(r.raw_materials) ? r.raw_materials[0] : r.raw_materials;
                        return {
                          raw_material_id: r.raw_material_id,
                          raw_material_name: raw?.name || "Ingredient",
                          quantity_required: Number(r.quantity_required) || 0,
                          unit: r.unit || raw?.unit || "",
                          cost_per_unit: Number(raw?.cost_per_unit) || 0,
                        };
                      }),
                    };
                  }
                  return v;
                });
                return { ...item, variants: enrichedVars };
              }
              return item;
            });

            mapped = applyRecipeCalculationsToMenu(mapped, recipeRows, effectiveLedger);
          }
        } catch (rErr) {
          console.warn("[MenuView] Recipe fetch warning:", rErr);
        }

        setCatalog(mapped);
      }
    } catch (err) {
      console.error("[MenuView] Supabase fetch exception:", err);
    }
  }, [user?.organizationId, user?.id]);

  useEffect(() => {
    let isMounted = true;
    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isMounted) fetchFromSupabase();
      }, 200);
    };

    fetchFromSupabase();

    // Cross-tab and local window realtime sync
    const handleStockDeducted = () => {
      debouncedFetch();
    };
    const handleMenuUpdated = () => {
      debouncedFetch();
    };
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key?.startsWith("pos_inventory_deducted_") ||
        e.key?.startsWith("pos_menu_")
      ) {
        debouncedFetch();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("inventory_stock_deducted", handleStockDeducted);
      window.addEventListener("pos_menu_updated", handleMenuUpdated);
      window.addEventListener("storage", handleStorage);
    }

    // Supabase Realtime channel subscription for raw_materials & recipes
    let channel: any = null;
    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const subId = Math.random().toString(36).substring(2, 7);

        channel = supabase
          .channel(`admin_menu_realtime_${restId}_${subId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "raw_materials",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetch();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "recipe_items",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetch();
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "menu_items",
              filter: `restaurant_id=eq.${restId}`,
            },
            () => {
              debouncedFetch();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("[MenuView] Realtime subscription error:", err);
      }
    })();

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("inventory_stock_deducted", handleStockDeducted);
        window.removeEventListener("pos_menu_updated", handleMenuUpdated);
        window.removeEventListener("storage", handleStorage);
      }
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [fetchFromSupabase, user]);

  // Filtering & Search State
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [dishToDelete, setDishToDelete] = useState<MenuItem | null>(null);

  // Recipe / BOM Modal State (for card standalone quick access)
  const [selectedDishForRecipe, setSelectedDishForRecipe] = useState<MenuItem | null>(null);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);

  const handleOpenRecipe = (dish: MenuItem) => {
    setSelectedDishForRecipe(dish);
    setIsRecipeModalOpen(true);
  };

  // Form State for Add / Edit
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("karahi");
  const [formPrice, setFormPrice] = useState<string>("1000");
  const [hasVariants, setHasVariants] = useState<boolean>(false);
  const [formVariants, setFormVariants] = useState<ItemVariant[]>([]);
  const [formPrepTime, setFormPrepTime] = useState("15m");
  const [formStockStatus, setFormStockStatus] = useState<"in_stock" | "low_stock" | "out_of_stock">("in_stock");
  const [formStockCount, setFormStockCount] = useState<string>("20");
  const [formIsPopular, setFormIsPopular] = useState(false);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [isSubmittingDish, setIsSubmittingDish] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size exceeds 5MB limit.");
      return;
    }
    setImageUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setFormImageUrl(data.url);
        showToast("Image uploaded successfully.");
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
      console.warn("[MenuView] Image upload error, using local fallback:", err);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === "string") {
          setFormImageUrl(e.target.result);
          showToast("Image loaded from local file.");
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setImageUploadLoading(false);
    }
  };

  // Embedded Recipe / BOM Builder State inside Add/Edit Dish Modal
  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([]);
  const [formIngredients, setFormIngredients] = useState<FormIngredient[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [inputQuantity, setInputQuantity] = useState<string>("0.2");

  const fetchRawMaterials = async () => {
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const { data, error } = await supabase
        .from("raw_materials")
        .select("*")
        .eq("restaurant_id", restId)
        .order("name", { ascending: true });

      if (!error && data) {
        const mapped: RawMaterial[] = data.map((r: any) => ({
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
        setAvailableMaterials(mapped);
        if (mapped.length > 0 && !selectedMaterialId) {
          setSelectedMaterialId(String(mapped[0].id));
        }
      }
    } catch (err) {
      console.warn("[MenuView] Failed fetching raw materials:", err);
    }
  };

  useEffect(() => {
    fetchRawMaterials();
  }, [user?.organizationId, user?.id]);

  // Dedicated Full-Page Creation & Editing Mode (No Popup Modals)
  const [creationMode, setCreationMode] = useState<"add" | "edit" | null>(null);
  const [dishToEdit, setDishToEdit] = useState<MenuItem | null>(null);

  // Synchronize routeAction for bookmarking / direct nested URLs
  useEffect(() => {
    if (!routeAction) {
      if (creationMode !== null) {
        setCreationMode(null);
        setDishToEdit(null);
      }
      return;
    }

    if (routeAction.action === "new") {
      setDishToEdit(null);
      setCreationMode("add");
    } else if (routeAction.action === "edit" && routeAction.id) {
      const target = catalog.find((d) => String(d.id) === String(routeAction.id));
      if (target) {
        setDishToEdit(target);
        setCreationMode("edit");
      } else {
        (async () => {
          try {
            const supabase = createClient();
            const { data } = await supabase
              .from("menu_items")
              .select("*")
              .eq("id", routeAction.id)
              .maybeSingle();

            if (data) {
              const prepMinutes =
                Number(data.preparation_time) ||
                parseInt(String(data.prep_time || "15").replace(/[^0-9]/g, "")) ||
                15;
              const mapped: MenuItem = {
                id: data.id,
                name: data.name,
                category: data.category || "karahi",
                price: Number(data.price),
                prepTime: data.prep_time || `${prepMinutes}m`,
                preparation_time: prepMinutes,
                stockStatus: data.stock_status || "in_stock",
                stockCount: data.stock_count ?? 20,
                imageIcon: data.image_icon || "",
                isPopular: Boolean(data.is_popular || data.is_featured || data.isPopular || data.isFeatured),
                is_popular: Boolean(data.is_popular || data.is_featured || data.isPopular || data.isFeatured),
                isFeatured: Boolean(data.is_popular || data.is_featured || data.isPopular || data.isFeatured),
                is_featured: Boolean(data.is_popular || data.is_featured || data.isPopular || data.isFeatured),
                image_url: data.image_url || undefined,
                imageUrl: data.image_url || undefined,
                is_available: (data.stock_status || "in_stock") !== "out_of_stock",
                in_stock: (data.stock_status || "in_stock") !== "out_of_stock",
                variants: Array.isArray(data.variants) ? data.variants : undefined,
                description: data.description || "",
              };
              setDishToEdit(mapped);
              setCreationMode("edit");
            }
          } catch (e) {
            console.warn("[MenuView] Error loading dish for edit route:", e);
          }
        })();
      }
    }
  }, [routeAction, catalog]);

  const handleOpenAddDish = () => {
    setDishToEdit(null);
    setCreationMode("add");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/menu/new");
    }
  };

  const handleOpenEditDish = (dish: MenuItem) => {
    setDishToEdit(dish);
    setCreationMode("edit");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/admin/menu/${dish.id}`);
    }
  };

  const handleQuickStationChange = async (dish: MenuItem, newStation: string) => {
    const norm = normalizeStationName(newStation);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("menu_items")
        .update({ kitchen_station: norm })
        .eq("id", dish.id);

      if (error) {
        console.error("Failed to update kitchen station:", error);
        showToast(`Failed to update station: ${error.message}`);
        return;
      }

      setCatalog((prev) =>
        prev.map((d) =>
          String(d.id) === String(dish.id)
            ? { ...d, kitchen_station: norm, station: norm }
            : d
        )
      );

      const b = getStationBadgeInfo(norm);
      showToast(`Assigned "${dish.name}" to ${b.label} Station`);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pos_menu_updated", {
            detail: {
              dish: { ...dish, kitchen_station: norm, station: norm },
              action: "update",
              timestamp: Date.now(),
            },
          })
        );
        window.dispatchEvent(new Event("storage"));
      }
    } catch (err) {
      console.error("Station update error:", err);
      showToast("Error updating kitchen station.");
    }
  };

  const currentSelectedMaterial = useMemo(() => {
    return (
      availableMaterials.find((m) => String(m.id) === String(selectedMaterialId)) ||
      availableMaterials[0] ||
      null
    );
  }, [availableMaterials, selectedMaterialId]);

  const handleAddFormIngredient = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!currentSelectedMaterial) {
      showToast("Please select a raw material.");
      return;
    }

    const qty = parseFloat(inputQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast("Please enter a valid positive quantity (e.g. 0.25).");
      return;
    }

    setFormIngredients((prev) => {
      const existingIdx = prev.findIndex(
        (it) => String(it.raw_material_id) === String(currentSelectedMaterial.id)
      );
      if (existingIdx !== -1) {
        return prev.map((it, idx) =>
          idx === existingIdx
            ? { ...it, quantity_required: it.quantity_required + qty }
            : it
        );
      }
      return [
        ...prev,
        {
          raw_material_id: currentSelectedMaterial.id,
          raw_material_name: currentSelectedMaterial.name,
          category: currentSelectedMaterial.category,
          quantity_required: qty,
          unit: currentSelectedMaterial.unit,
          cost_per_unit: currentSelectedMaterial.cost_per_unit,
        },
      ];
    });

    showToast(`Added ${currentSelectedMaterial.name} (${qty} ${currentSelectedMaterial.unit}) to recipe.`);
    setInputQuantity("0.2");
  };

  const handleRemoveFormIngredient = (rawMaterialId: string | number) => {
    setFormIngredients((prev) =>
      prev.filter((it) => String(it.raw_material_id) !== String(rawMaterialId))
    );
  };

  const formRecipeCost = useMemo(() => {
    return formIngredients.reduce(
      (sum, it) => sum + it.quantity_required * it.cost_per_unit,
      0
    );
  }, [formIngredients]);

  const formNumericPrice = parseFloat(formPrice) || 0;
  const formGrossMargin = formNumericPrice - formRecipeCost;
  const formMarginPct = formNumericPrice > 0 ? (formGrossMargin / formNumericPrice) * 100 : 0;

  // Stock toggle resolver
  const toggleStock = onToggleStock || handleToggleStock;

  // Close Add/Edit dish modal and restore URL to /admin/menu
  const closeDishModal = () => {
    setIsAddModalOpen(false);
    setEditingDish(null);
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin/menu/")) {
      window.history.pushState(null, "", "/admin/menu");
    }
  };

  // Open Add Modal with fresh defaults
  const openAddModal = () => {
    setFormName("");
    setFormDescription("");
    setFormCategory("karahi");
    setFormPrice("1250");
    setHasVariants(false);
    setFormVariants([]);
    setFormPrepTime("15m");
    setFormStockStatus("in_stock");
    setFormStockCount("25");
    setFormIsPopular(false);
    setFormImageUrl("");
    setFormIngredients([]);
    setInputQuantity("0.2");
    fetchRawMaterials();
    setIsAddModalOpen(true);
    if (typeof window !== "undefined" && window.location.pathname !== "/admin/menu/new") {
      window.history.pushState(null, "", "/admin/menu/new");
    }
  };

  // Open Edit Modal with selected dish
  const openEditModal = (dish: MenuItem) => {
    setEditingDish(dish);
    setFormName(dish.name);
    setFormDescription(dish.description || "");
    setFormCategory(dish.category || "karahi");
    setFormPrice(String(dish.price));
    setFormImageUrl(dish.imageUrl || dish.image_url || "");
    if (dish.variants && dish.variants.length > 0) {
      setHasVariants(true);
      setFormVariants(dish.variants);
    } else {
      setHasVariants(false);
      setFormVariants([]);
    }
    setFormPrepTime(dish.prepTime || "15m");
    setFormStockStatus(dish.stockStatus || "in_stock");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/admin/menu/${dish.id}`);
    }
    setFormStockCount(String(dish.stockCount || 20));
    setFormIsPopular(Boolean(dish.isPopular));
    setFormIngredients([]);
    setInputQuantity("0.2");
    fetchRawMaterials();

    // Pre-load existing ingredients by querying public.recipe_items joined with public.raw_materials
    (async () => {
      try {
        const supabase = createClient();
        const { data: recData, error: recErr } = await supabase
          .from("recipe_items")
          .select("raw_material_id, quantity_required, unit, raw_materials(id, name, unit, cost_per_unit, category)")
          .eq("menu_item_id", dish.id);

        if (!recErr && recData && recData.length > 0) {
          const mapped: FormIngredient[] = recData.map((r: any) => {
            const raw = r.raw_materials;
            return {
              raw_material_id: r.raw_material_id,
              raw_material_name: raw?.name || `Material #${r.raw_material_id}`,
              category: raw?.category || "General",
              quantity_required: Number(r.quantity_required) || 0,
              unit: r.unit || raw?.unit || "kg",
              cost_per_unit: Number(raw?.cost_per_unit) || 0,
            };
          });
          setFormIngredients(mapped);
        }
      } catch (err) {
        console.warn("[MenuView] Error preloading recipe items:", err);
      }
    })();
  };

  // Handle Create Dish directly in Supabase
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDish) return;
    setIsSubmittingDish(true);
    try {
      const trimmedName = formName.trim();
      let numericPrice = parseFloat(formPrice);

      if (!trimmedName) {
        showToast("Please enter a valid dish name.");
        return;
      }

    if (hasVariants) {
      if (formVariants.length === 0) {
        showToast("Please add at least one portion or size variant.");
        return;
      }
      for (const v of formVariants) {
        if (!v.name.trim()) {
          showToast("Please specify a label for all size variants.");
          return;
        }
        if (isNaN(v.price) || v.price <= 0) {
          showToast(`Please enter a valid price for size "${v.name}".`);
          return;
        }
      }
      numericPrice = formVariants[0].price;
    } else if (isNaN(numericPrice) || numericPrice <= 0) {
      showToast("Please enter a valid positive price in PKR.");
      return;
    }

    let createdId = `dish_${Date.now()}`;
    const prepMinutes = parseInt(String(formPrepTime).replace(/[^0-9]/g, "")) || 15;
    const formattedPrepTime = `${prepMinutes}m`;

    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      const sanitizedPrice = parseFloat(String(numericPrice)) || 0;
      const sanitizedVariants = hasVariants && Array.isArray(formVariants) && formVariants.length > 0 ? formVariants : null;

      const insertPayload: any = {
        restaurant_id: restId,
        branch_id: branchId || user?.branchId || null,
        name: trimmedName,
        category: formCategory || "General",
        price: Math.round(sanitizedPrice),
        prep_time: formattedPrepTime,
        preparation_time: prepMinutes,
        stock_status: formStockStatus || "in_stock",
        stock_count: parseInt(formStockCount) || 50,
        image_icon: null,
        image_url: formImageUrl.trim() || null,
        is_popular: Boolean(formIsPopular),
        variants: sanitizedVariants,
      };

      let { data, error } = await supabase
        .from("menu_items")
        .insert([insertPayload])
        .select()
        .single();

      // If variants column is missing from Supabase schema cache (PGRST204 or column error)
      if (error && (error.message?.includes("variants") || error.code === "PGRST204")) {
        delete insertPayload.variants;
        if (sanitizedVariants) {
          // Fallback: safely encode variants list into existing description column
          insertPayload.description = JSON.stringify({ variants: sanitizedVariants });
        }
        const retry = await supabase
          .from("menu_items")
          .insert([insertPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      // If preparation_time column is missing from Supabase schema cache
      if (error && (error.message?.includes("preparation_time") || error.code === "PGRST204")) {
        delete insertPayload.preparation_time;
        const retry = await supabase
          .from("menu_items")
          .insert([insertPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("[MenuView] Supabase insert error full object:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        showToast(`Error saving dish: ${error.message || "Insert failed"}`);
        return;
      } else if (data) {
        createdId = data.id;

        // Purge stale links & bulk insert newly defined ingredients into public.recipe_items
        await supabase.from("recipe_items").delete().eq("menu_item_id", createdId);

        if (formIngredients.length > 0) {
          const rows = formIngredients.map((item) => ({
            restaurant_id: restId,
            menu_item_id: createdId,
            raw_material_id: item.raw_material_id,
            quantity_required: Number(item.quantity_required),
            unit: item.unit,
          }));

          const { error: insRecErr } = await supabase.from("recipe_items").insert(rows);
          if (insRecErr) {
            console.warn("[MenuView] Error inserting recipe items:", insRecErr);
          }
        }
      }
    } catch (err) {
      console.error("[MenuView] Insert exception:", err);
      showToast("Error saving dish.");
      return;
    }

    const newDish: MenuItem = {
      id: createdId,
      name: trimmedName,
      category: formCategory,
      price: Math.round(numericPrice),
      prepTime: formattedPrepTime,
      preparation_time: prepMinutes,
      stockStatus: formStockStatus,
      stockCount: parseInt(formStockCount) || 20,
      imageIcon: "",
      image_url: formImageUrl.trim() || undefined,
      imageUrl: formImageUrl.trim() || undefined,
      isPopular: formIsPopular,
      recipeCost: formRecipeCost,
      recipeMargin: formMarginPct,
      hasRecipe: formIngredients.length > 0,
      variants: hasVariants && formVariants.length > 0 ? formVariants : undefined,
    };

    setCatalog((prev) => [newDish, ...prev]);
    if (onAddDish) {
      onAddDish(newDish);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pos_menu_updated", {
          detail: { newDish, action: "insert", timestamp: Date.now() },
        })
      );
      window.dispatchEvent(new Event("storage"));
    }
    setIsAddModalOpen(false);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/menu");
    }
    showToast(`Dish "${newDish.name}" saved successfully.`);
    } finally {
      setIsSubmittingDish(false);
    }
  };

  // Handle Edit Dish directly in Supabase
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish || isSubmittingDish) return;
    setIsSubmittingDish(true);
    try {
      const trimmedName = formName.trim();
      let numericPrice = parseFloat(formPrice);

      if (!trimmedName) {
        showToast("Please enter a valid dish name.");
        return;
      }

    if (hasVariants) {
      if (formVariants.length === 0) {
        showToast("Please add at least one portion or size variant.");
        return;
      }
      for (const v of formVariants) {
        if (!v.name.trim()) {
          showToast("Please specify a label for all size variants.");
          return;
        }
        if (isNaN(v.price) || v.price <= 0) {
          showToast(`Please enter a valid price for size "${v.name}".`);
          return;
        }
      }
      numericPrice = formVariants[0].price;
    } else if (isNaN(numericPrice) || numericPrice <= 0) {
      showToast("Please enter a valid positive price.");
      return;
    }

    const prepMinutes = parseInt(String(formPrepTime).replace(/[^0-9]/g, "")) || 15;
    const formattedPrepTime = `${prepMinutes}m`;

    try {
      const supabase = createClient();
      const sanitizedPrice = parseFloat(String(numericPrice)) || 0;
      const sanitizedVariants = hasVariants && Array.isArray(formVariants) && formVariants.length > 0 ? formVariants : null;

      const updatePayload: any = {
        name: trimmedName,
        category: formCategory || "General",
        price: Math.round(sanitizedPrice),
        prep_time: formattedPrepTime,
        preparation_time: prepMinutes,
        stock_status: formStockStatus,
        stock_count: parseInt(formStockCount) || 20,
        image_icon: null,
        image_url: formImageUrl.trim() || null,
        is_popular: formIsPopular,
        variants: sanitizedVariants,
      };

      let { error } = await supabase
        .from("menu_items")
        .update(updatePayload)
        .eq("id", editingDish.id);

      // If variants column is missing from Supabase schema cache
      if (error && (error.message?.includes("variants") || error.code === "PGRST204")) {
        delete updatePayload.variants;
        if (sanitizedVariants) {
          updatePayload.description = JSON.stringify({ variants: sanitizedVariants });
        }
        const retry = await supabase
          .from("menu_items")
          .update(updatePayload)
          .eq("id", editingDish.id);
        error = retry.error;
      }

      // If preparation_time column is missing from Supabase schema cache
      if (error && (error.message?.includes("preparation_time") || error.code === "PGRST204")) {
        delete updatePayload.preparation_time;
        const retry = await supabase
          .from("menu_items")
          .update(updatePayload)
          .eq("id", editingDish.id);
        error = retry.error;
      }

      if (error) {
        console.error("[MenuView] Supabase update error full object:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        showToast(`Error updating dish: ${error.message || "Update failed"}`);
        return;
      }

      // 2. Purge stale links & bulk insert newly defined ingredients into public.recipe_items
      await supabase.from("recipe_items").delete().eq("menu_item_id", editingDish.id);

      if (formIngredients.length > 0) {
        const { restId } = await getValidTenantContext(user);
        const rows = formIngredients.map((item) => ({
          restaurant_id: restId,
          menu_item_id: editingDish.id,
          raw_material_id: item.raw_material_id,
          quantity_required: Number(item.quantity_required),
          unit: item.unit,
        }));

        const { error: insRecErr } = await supabase.from("recipe_items").insert(rows);
        if (insRecErr) {
          console.warn("[MenuView] Error updating recipe items:", insRecErr);
        }
      }
    } catch (err) {
      console.error("[MenuView] Update exception:", err);
      showToast("Error updating dish.");
      return;
    }

    const updatedDish: MenuItem = {
      ...editingDish,
      name: trimmedName,
      category: formCategory,
      price: Math.round(numericPrice),
      prepTime: formattedPrepTime,
      preparation_time: prepMinutes,
      stockStatus: formStockStatus,
      stockCount: parseInt(formStockCount) || 20,
      imageIcon: "",
      image_url: formImageUrl.trim() || undefined,
      imageUrl: formImageUrl.trim() || undefined,
      isPopular: formIsPopular,
      recipeCost: formRecipeCost,
      recipeMargin: formMarginPct,
      hasRecipe: formIngredients.length > 0,
      variants: hasVariants && formVariants.length > 0 ? formVariants : undefined,
    };

    setCatalog((prev) =>
      prev.map((d) => (d.id === updatedDish.id ? updatedDish : d))
    );
    if (onUpdateDish) {
      onUpdateDish(updatedDish);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pos_menu_updated", {
          detail: { updatedDish, action: "update", timestamp: Date.now() },
        })
      );
      window.dispatchEvent(new Event("storage"));
    }
    setEditingDish(null);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/menu");
    }
    showToast(`Dish "${updatedDish.name}" updated with ${formIngredients.length} recipe ingredients.`);
    } finally {
      setIsSubmittingDish(false);
    }
  };

  // Manual In-Stock / Out-of-Stock Toggle Handler with Supabase Persistence & Strict Zero-Stock Recipe Guard
  const handleToggleAvailability = async (dish: MenuItem) => {
    const repYield = getItemRepresentativePortions(dish, getVariantPortions);
    const isStrictlyZeroStock = repYield.portionCount <= 0;
    const isCurrentlyActive = !isStrictlyZeroStock && dish.stockStatus !== "out_of_stock" && dish.in_stock !== false;
    const targetInStock = !isCurrentlyActive;

    // Guard: Cannot enable dish if raw materials are strictly zero (zero yield)
    if (targetInStock && isStrictlyZeroStock) {
      const missingDetails =
        dish.missingIngredients && dish.missingIngredients.length > 0
          ? `: ${dish.missingIngredients.join(", ")}`
          : "";
      showToast(
        `Cannot enable dish: Insufficient raw material ingredients in inventory (0 portions available)${missingDetails}`
      );
      return;
    }

    const targetDbStatus = targetInStock
      ? (repYield.portionCount <= 5 && repYield.portionCount > 0 ? "low_stock" : "in_stock")
      : "out_of_stock";
    const targetCount = targetInStock ? Math.max(1, repYield.portionCount || dish.stockCount || 20) : 0;

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      let { error } = await supabase
        .from("menu_items")
        .update({
          is_available: targetInStock,
          stock_status: targetDbStatus,
          stock_count: targetCount,
        })
        .eq("id", dish.id)
        .eq("restaurant_id", restId);

      if (error && (error.code === "PGRST204" || error.code === "42703" || error.message?.includes("is_available"))) {
        const fb = await supabase
          .from("menu_items")
          .update({
            stock_status: targetDbStatus,
            stock_count: targetCount,
          })
          .eq("id", dish.id)
          .eq("restaurant_id", restId);
        error = fb.error;
      }

      if (error) {
        console.error("[MenuView] Stock toggle persistence error:", error);
        showToast(`Failed to update stock status: ${error.message}`);
        return;
      }
    } catch (err: any) {
      console.error("[MenuView] Stock toggle exception:", err);
      showToast("Error saving stock status.");
      return;
    }

    const updated: MenuItem = {
      ...dish,
      stockStatus: targetDbStatus,
      stockCount: targetCount,
      is_available: targetInStock,
      in_stock: targetInStock,
    };

    setCatalog((prev) => prev.map((d) => (d.id === dish.id ? updated : d)));
    if (onUpdateDish) {
      onUpdateDish(updated);
    }
    if (onToggleStock) {
      onToggleStock(dish.id);
    } else if (handleToggleStock) {
      handleToggleStock(dish.id);
    }
    showToast(
      `"${dish.name}" updated to ${targetInStock ? "In Stock" : "Out of Stock"}.`
    );
  };

  // Immediate stock cycling in Supabase (in_stock -> low_stock -> out_of_stock)
  const handleCycleStock = async (dish: MenuItem) => {
    const nextStatus: MenuItem["stockStatus"] =
      dish.stockStatus === "in_stock"
        ? "low_stock"
        : dish.stockStatus === "low_stock"
        ? "out_of_stock"
        : "in_stock";

    // Guard: Cannot cycle dish to in_stock if raw materials are insufficient or zero
    if (nextStatus === "in_stock") {
      if (dish.isAutoOutOfStock) {
        const missingDetails =
          dish.missingIngredients && dish.missingIngredients.length > 0
            ? `: ${dish.missingIngredients.join(", ")}`
            : "";
        showToast(
          `Unavailable: Linked recipe ingredients are depleted${missingDetails}`
        );
        return;
      }

      try {
        const supabase = createClient();
        const { data: linkedBOM } = await supabase
          .from("recipe_items")
          .select("quantity_required, raw_materials(name, current_stock)")
          .eq("menu_item_id", dish.id);

        if (linkedBOM && linkedBOM.length > 0) {
          const depleted = linkedBOM.filter((r: any) => {
            const raw = r.raw_materials;
            const currentStock = Number(raw?.current_stock) || 0;
            const req = Number(r.quantity_required) || 0;
            return currentStock < req || currentStock <= 0;
          });
          if (depleted.length > 0) {
            const names = depleted.map((d: any) => d.raw_materials?.name || "Ingredient").join(", ");
            showToast(`Unavailable: Linked recipe ingredients are depleted (${names}).`);
            return;
          }
        }
      } catch (bomErr) {
        console.warn("[MenuView] Live recipe check warning:", bomErr);
      }
    }

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const nextCount =
        nextStatus === "out_of_stock" ? 0 : Math.max(1, dish.stockCount || 20);
      const isAvailable = nextStatus !== "out_of_stock";

      let { error } = await supabase
        .from("menu_items")
        .update({
          is_available: isAvailable,
          stock_status: nextStatus,
          stock_count: nextCount,
        })
        .eq("id", dish.id)
        .eq("restaurant_id", restId);

      if (error && (error.code === "PGRST204" || error.code === "42703" || error.message?.includes("is_available"))) {
        const fb = await supabase
          .from("menu_items")
          .update({ stock_status: nextStatus, stock_count: nextCount })
          .eq("id", dish.id)
          .eq("restaurant_id", restId);
        error = fb.error;
      }

      if (error) {
        console.error("[MenuView] Supabase stock status error:", error);
        showToast(`Error updating stock status: ${error.message}`);
        return;
      }
    } catch (err) {
      console.error("[MenuView] Stock status exception:", err);
      showToast("Error updating stock status.");
      return;
    }

    const updated: MenuItem = {
      ...dish,
      stockStatus: nextStatus,
      is_available: nextStatus !== "out_of_stock",
      in_stock: nextStatus !== "out_of_stock",
    };
    setCatalog((prev) => prev.map((d) => (d.id === dish.id ? updated : d)));
    if (onUpdateDish) {
      onUpdateDish(updated);
    }
    if (onToggleStock) {
      onToggleStock(dish.id);
    } else if (handleToggleStock) {
      handleToggleStock(dish.id);
    }
    showToast(`Stock for ${dish.name} set to: ${nextStatus.toUpperCase()}`);
  };

  // Handle Delete Confirmation from Supabase
  const confirmDelete = async () => {
    if (!dishToDelete) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", dishToDelete.id);

      if (error) {
        console.error("[MenuView] Supabase delete error:", error);
        showToast(`Error deleting dish: ${error.message}`);
        return;
      }
    } catch (err) {
      console.error("[MenuView] Delete exception:", err);
      showToast("Error deleting dish.");
      return;
    }

    setCatalog((prev) => prev.filter((d) => d.id !== dishToDelete.id));
    if (onDeleteDish) {
      onDeleteDish(dishToDelete.id);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pos_menu_updated", {
          detail: { deletedId: dishToDelete.id, action: "delete", timestamp: Date.now() },
        })
      );
      window.dispatchEvent(new Event("storage"));
    }
    showToast(`Dish "${dishToDelete.name}" removed.`);
    setDishToDelete(null);
  };

  // Dynamic Categories with live item counts for dropdown (strictly categories added by admin in catalog)
  const categoriesList = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();

    catalog.forEach((dish) => {
      if (!dish.category) return;
      const rawCat = dish.category.trim();
      if (!rawCat) return;
      const catLower = rawCat.toLowerCase();

      // Check if this category maps to a known predefined category (e.g. "burgers" <-> "Smash Burgers")
      const matchedPredefined = PREDEFINED_CATEGORIES.find(
        (c) => c.id.toLowerCase() === catLower || c.label.toLowerCase() === catLower
      );

      const catKey = matchedPredefined ? matchedPredefined.id.toLowerCase() : catLower;
      const label = matchedPredefined
        ? matchedPredefined.label
        : rawCat.length <= 3
        ? rawCat.toUpperCase()
        : rawCat
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

      if (map.has(catKey)) {
        map.get(catKey)!.count += 1;
      } else {
        map.set(catKey, {
          id: catKey,
          label,
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [catalog]);

  // Reset selected category to "all" if the currently selected category no longer exists
  useEffect(() => {
    if (
      selectedCategory !== "all" &&
      categoriesList.length > 0 &&
      !categoriesList.some((c) => c.id.toLowerCase() === selectedCategory.toLowerCase())
    ) {
      setSelectedCategory("all");
    }
  }, [categoriesList, selectedCategory]);

  // Filtered dishes list
  const filteredDishes = catalog.filter((dish) => {
    const cat = (dish.category || "").trim().toLowerCase();
    const matchedPredefined = PREDEFINED_CATEGORIES.find(
      (c) => c.id.toLowerCase() === cat || c.label.toLowerCase() === cat
    );
    const catId = matchedPredefined ? matchedPredefined.id.toLowerCase() : cat;

    const matchCategory =
      selectedCategory === "all" ||
      cat === selectedCategory.toLowerCase() ||
      catId === selectedCategory.toLowerCase();
    const matchSearch =
      !searchQuery ||
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dish.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dish.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Category counts
  const totalCount = catalog.length;
  const inStockCount = catalog.filter((i) => i.stockStatus === "in_stock").length;
  const lowStockCount = catalog.filter((i) => i.stockStatus === "low_stock").length;
  const outOfStockCount = catalog.filter((i) => i.stockStatus === "out_of_stock").length;

  // Render Item Image Upload & Strict Unique Mapping Section
  const renderImageSection = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    const previewSrc = formImageUrl.trim() || getSmartFoodImage(formName, formCategory);
    const isCustomUrl = Boolean(formImageUrl.trim());

    return (
      <div className="bg-[var(--surface-mid)]/60 border border-[var(--border)] rounded-2xl p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[var(--text-hi)] flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span>Item Image &amp; Variant Visual</span>
          </label>
          {isCustomUrl && (
            <button
              type="button"
              onClick={() => setFormImageUrl("")}
              className="text-[11px] font-mono text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              Reset to Smart Preset
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5">
          {/* Live Preview Box */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-[var(--gold)]/40 overflow-hidden bg-black/40 shrink-0 shadow-md group">
            <img
              src={previewSrc}
              alt={formName || "Dish Preview"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80";
              }}
            />
            {imageUploadLoading && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-[10px] text-[var(--gold)] font-mono gap-1">
                <span className="animate-spin text-sm">⏳</span>
                <span>Uploading...</span>
              </div>
            )}
            <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-xs py-0.5 text-center text-[9px] font-mono text-[var(--text-lo)] truncate px-1">
              {isCustomUrl ? "Custom Image" : "Auto-Resolved"}
            </div>
          </div>

          {/* Controls: Upload & URL */}
          <div className="flex-1 w-full space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={imageUploadLoading}
                className="px-3 py-1.5 rounded-xl bg-[var(--gold-dim)] hover:bg-[var(--gold)]/20 border border-[var(--gold)]/40 text-[var(--gold)] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{imageUploadLoading ? "Uploading..." : "Upload Photo"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const suggested = getSmartFoodImage(formName, formCategory);
                  setFormImageUrl(suggested);
                  showToast(`Matched photo for "${formName || formCategory}"!`);
                }}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-hi)] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>Auto-Suggest Photo</span>
              </button>
            </div>

            {/* Direct Image URL input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]">
                <LinkIcon className="w-3.5 h-3.5" />
              </span>
              <input
                type="url"
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                placeholder="Or paste direct image URL (https://...)"
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-mono"
              />
            </div>
            <p className="text-[10.5px] text-[var(--text-muted)]">
              Ensures this exact dish/variant (e.g. 500ml vs 1.5L, Malai Boti vs Karahi) stores its own independent image in the database.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render Recipe & Ingredients (Auto-Deduction BOM) Builder Section
  const renderRecipeSection = () => {
    return (
      <div className="space-y-3 pt-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-[var(--text-hi)] uppercase tracking-wide">
                Recipe &amp; Ingredients (Auto-Deduction BOM)
              </h4>
              <p className="text-[10px] text-[var(--text-lo)] font-sans">
                Quantities will automatically deduct from raw materials stock when kitchen moves order to "Cooking".
              </p>
            </div>
          </div>
          {formRecipeCost > 0 && (
            <div className="text-right shrink-0">
              <span className="text-[10px] text-[var(--text-faint)] block uppercase">Recipe Food Cost (BOM)</span>
              <span className="text-xs font-bold font-mono text-[var(--gold)]">
                Rs. {Math.round(formRecipeCost).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Input Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-[var(--surface-hi)] p-3 rounded-xl border border-[var(--border)]">
          {/* Material Select */}
          <div className="sm:col-span-6 space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-lo)] uppercase">Select Raw Material *</label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border)] focus:border-[var(--gold)] rounded-lg px-2.5 py-2 text-xs text-[var(--text-hi)] focus:outline-none transition-all cursor-pointer"
            >
              {availableMaterials.length === 0 ? (
                <option value="">No raw materials found in inventory</option>
              ) : (
                availableMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.name} ({mat.unit}) — Rs. {mat.cost_per_unit || 0}/{mat.unit}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Quantity Input + Auto-locked Unit */}
          <div className="sm:col-span-4 space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-lo)] uppercase">Required Qty *</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="any"
                min="0.001"
                value={inputQuantity}
                onChange={(e) => setInputQuantity(e.target.value)}
                placeholder="0.25"
                className="w-full bg-[var(--bg-deep)] border border-[var(--border)] focus:border-[var(--gold)] rounded-lg px-2.5 py-2 text-xs text-[var(--text-hi)] focus:outline-none transition-all font-mono font-semibold"
              />
              <span className="px-2.5 py-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border)] text-[11px] font-bold text-[var(--gold)] font-mono shrink-0">
                {currentSelectedMaterial?.unit || "unit"}
              </span>
            </div>
          </div>

          {/* Add Button */}
          <div className="sm:col-span-2 flex items-end">
            <button
              type="button"
              onClick={handleAddFormIngredient}
              className="w-full py-2 px-3 bg-[var(--gold-dim)] hover:bg-[var(--gold)]/25 text-[var(--gold)] border border-[var(--gold)]/40 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Inline Ingredients Table */}
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-deep)]">
          {formIngredients.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-faint)] bg-[var(--surface-base)]/40 font-sans">
              No recipe ingredients linked yet. Link raw materials above to enable automatic kitchen stock deduction.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[var(--surface-hi)] text-[10px] text-[var(--text-lo)] uppercase border-b border-[var(--border)] sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Ingredient</th>
                    <th className="py-2 px-2 text-right">Required Qty</th>
                    <th className="py-2 px-2">Unit</th>
                    <th className="py-2 px-2 text-right">Cost Contrib</th>
                    <th className="py-2 px-2 text-center w-9"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/50">
                  {formIngredients.map((item, idx) => {
                    const costContrib = item.quantity_required * item.cost_per_unit;
                    return (
                      <tr key={`${item.raw_material_id}_${idx}`} className="hover:bg-[var(--surface-hi)]/40 transition-colors">
                        <td className="py-2 px-3 font-medium text-[var(--text-hi)]">
                          {item.raw_material_name}
                        </td>
                        <td className="py-2 px-2 text-right text-[var(--gold)] font-bold">
                          {item.quantity_required}
                        </td>
                        <td className="py-2 px-2 text-[var(--text-lo)]">{item.unit}</td>
                        <td className="py-2 px-2 text-right text-[var(--text-hi)]">
                          Rs. {Math.round(costContrib).toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveFormIngredient(item.raw_material_id)}
                            className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 cursor-pointer transition-colors"
                            title="Remove ingredient"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Summary Footer */}
          {formIngredients.length > 0 && (
            <div className="bg-[var(--surface-hi)] p-2.5 border-t border-[var(--border)] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[var(--text-lo)] uppercase font-semibold">
                  Items: <strong className="text-[var(--text-hi)]">{formIngredients.length}</strong>
                </span>
                <span className="text-[var(--border)]">|</span>
                <span className="text-[10px] text-[var(--text-lo)]">
                  Gross Margin:{" "}
                  <strong className={formMarginPct >= 40 ? "text-emerald-700 dark:text-[#25d366]" : formMarginPct > 0 ? "text-amber-800 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}>
                    {formMarginPct.toFixed(1)}% (Rs. {Math.round(formGrossMargin)})
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-lo)] uppercase font-semibold">Total BOM Cost:</span>
                <strong className="text-[var(--gold)] text-sm">
                  Rs. {Math.round(formRecipeCost).toLocaleString()}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Dedicated Full-Page Menu Item Creation & Recipe Builder View (No Popup Modals)
  if (creationMode) {
    return (
      <MenuItemFormView
        key={dishToEdit ? `edit_${dishToEdit.id}` : "add_new_dish"}
        initialData={dishToEdit}
        mode={creationMode}
        onCancel={() => {
          setCreationMode(null);
          setDishToEdit(null);
          if (typeof window !== "undefined") {
            window.history.pushState(null, "", "/admin/menu");
          }
        }}
        onSuccess={(savedDish) => {
          if (creationMode === "add") {
            setCatalog((prev) => [savedDish, ...prev]);
            if (onAddDish) onAddDish(savedDish);
          } else {
            setCatalog((prev) =>
              prev.map((d) => (String(d.id) === String(savedDish.id) ? savedDish : d))
            );
            if (onUpdateDish) onUpdateDish(savedDish);
          }
          setCreationMode(null);
          setDishToEdit(null);
          if (typeof window !== "undefined") {
            window.history.pushState(null, "", "/admin/menu");
          }
          fetchFromSupabase();
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Menu &amp; Live{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Stock Inventory
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddDish}
            className="btn-gold animate-sheen px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Dish</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-faint)] uppercase font-semibold">TOTAL DISHES</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-[var(--text-hi)]">{totalCount}</div>
          <span className="text-[10px] text-[var(--text-lo)] block">Total catalog menu items</span>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-700 dark:text-[#25d366] uppercase font-semibold">IN STOCK</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs dark:bg-[#25d366]/15 dark:text-[#25d366] dark:border-[#25d366]/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-emerald-700 dark:text-[#25d366]">{inStockCount}</div>
          <span className="text-[10px] text-emerald-700 dark:text-[#25d366] block font-semibold">Available for POS ordering</span>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-800 dark:text-amber-400 uppercase font-semibold">LOW STOCK</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-amber-800 dark:text-amber-400">{lowStockCount}</div>
          <span className="text-[10px] text-amber-800/80 dark:text-amber-400/80 block font-medium">Running low on threshold</span>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-semibold">86'D (SOLD OUT)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 flex items-center justify-center">
              <X className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-rose-700 dark:text-rose-400">{outOfStockCount}</div>
          <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80 block font-medium">Blocked from billing</span>
        </div>
      </div>

      {/* Unified Category Dropdown & Search Bar in a Single Horizontal Row */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
        {/* Category Dropdown (styled identically to search bar) */}
        <div className="relative w-[44%] sm:w-60 shrink-0">
          <ResponsiveSelect
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
            menuClassName="w-56 sm:w-60"
            options={[
              { id: "all", label: "All Categories", count: catalog.length },
              ...categoriesList.map((filter) => ({
                id: filter.id,
                label: filter.label,
                count: filter.count,
              })),
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
            placeholder="Search dishes..."
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-3 py-2.5 h-10 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner font-sans"
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

      {/* Menu Items Catalog Table & Responsive Stacked Cards */}
      <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
        {/* Mobile Stacked Card List (< 768px) - Zero Horizontal Scrolling */}
        <div className="md:hidden flex flex-col divide-y divide-[var(--border)]">
          {catalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide mb-3">No menu items created yet</h3>
              <button
                type="button"
                onClick={handleOpenAddDish}
                className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Add Dish</span>
              </button>
            </div>
          ) : filteredDishes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No matching menu items</h3>
              <p className="text-xs text-[var(--text-lo)] max-w-xs mt-1">No dishes matched your current search or category filter.</p>
            </div>
          ) : (
            filteredDishes.map((dish) => {
              const repYield = getItemRepresentativePortions(dish, getVariantPortions);
              const isStrictlyZeroStock = repYield.portionCount <= 0;
              const isEffectivelyOos = isStrictlyZeroStock || (dish.stockStatus === "out_of_stock" && !dish.hasRecipe);
              const isItemActive = !isStrictlyZeroStock && dish.stockStatus !== "out_of_stock" && dish.in_stock !== false;

              return (
              <div key={dish.id} className="p-3.5 space-y-3 bg-[var(--surface-base)]/20 hover:bg-[var(--surface-hi)]/30 transition-colors">
                {/* Header: Image + Name + Category + Popular */}
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[var(--text-hi)] text-sm truncate">
                          {dish.name}
                        </span>
                        {(dish.isPopular || (dish as any).isFeatured || (dish as any).is_popular) && (
                          <span className="badge-pill badge-gold text-[9px] shrink-0">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>Featured</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[var(--text-faint)] font-mono mt-0.5">
                        <span className="badge-pill badge-neutral text-[10px] uppercase font-semibold">
                          {dish.category}
                        </span>
                        {(() => {
                          const station = getMenuItemStation(dish);
                          const b = getStationBadgeInfo(station);
                          return (
                            <div className="relative inline-flex items-center">
                              <select
                                value={station}
                                onChange={(e) => handleQuickStationChange(dish, e.target.value)}
                                className={`px-2 py-0.5 pr-5 rounded text-[9px] font-mono font-bold uppercase border cursor-pointer appearance-none bg-transparent hover:opacity-85 transition-all focus:outline-none ${b.className}`}
                                title="Click to assign Kitchen Station"
                              >
                                <option value="desi" className="bg-[var(--bg-deep)] text-red-300">Desi</option>
                                <option value="fast_food" className="bg-[var(--bg-deep)] text-amber-300">Fast Food</option>
                                <option value="grill" className="bg-[var(--bg-deep)] text-orange-400">Grill</option>
                                <option value="fry" className="bg-[var(--bg-deep)] text-yellow-300">Fry</option>
                                <option value="pastry" className="bg-[var(--bg-deep)] text-pink-300">Pastry</option>
                                <option value="beverages" className="bg-[var(--bg-deep)] text-cyan-300">Beverages</option>
                                <option value="assembly" className="bg-[var(--bg-deep)] text-emerald-300">Assembly</option>
                              </select>
                              <ChevronDown className="w-2.5 h-2.5 pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 opacity-70" />
                            </div>
                          );
                        })()}
                        <span>ID: {dish.id}</span>
                        <span>• ~{dish.prepTime || "15m"}</span>
                      </div>
                      {/* Plain-text POS Portion Availability Counter */}
                      <ItemPortionAvailabilityText
                        displayText={repYield.displayText}
                        textColorClass={repYield.textColorClass}
                      />
                    </div>
                  </div>

                  {/* Stock Toggle Switch */}
                  <div className="shrink-0 pt-0.5 flex flex-col items-end gap-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isItemActive}
                      onClick={() => handleToggleAvailability(dish)}
                      disabled={isStrictlyZeroStock}
                      className={`relative inline-flex h-5 w-10 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isStrictlyZeroStock
                          ? "bg-zinc-800 border-zinc-700/60 opacity-50 cursor-not-allowed"
                          : isItemActive
                          ? "bg-emerald-500 shadow-sm shadow-emerald-500/20 cursor-pointer"
                          : "bg-zinc-700 cursor-pointer"
                      }`}
                      title={
                        isStrictlyZeroStock
                          ? `Auto Out of Stock: Depleted ingredients or zero yield`
                          : isItemActive
                          ? (repYield.portionCount <= 5 ? `Low Stock (${repYield.portionCount} portions available)` : "In Stock")
                          : "Disabled"
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isItemActive
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                    <ItemStockStatusBadge
                      isOutOfStock={isStrictlyZeroStock}
                      portionCount={repYield.portionCount}
                    />
                  </div>
                </div>

                {/* Price & Summary */}
                <div className="flex items-center justify-between text-xs font-mono bg-[var(--surface-hi)]/30 px-3 py-2 rounded-xl border border-[var(--border)]/60">
                  <span className="text-[10px] text-[var(--text-faint)] uppercase font-semibold">Price</span>
                  <span className="font-extrabold text-[var(--gold)] text-xs">
                    {dish.variants && dish.variants.length > 0 ? (
                      <>
                        Rs {Math.min(...dish.variants.map((v) => v.price)).toLocaleString()}
                        {dish.variants.length > 1
                          ? ` - ${Math.max(...dish.variants.map((v) => v.price)).toLocaleString()}`
                          : ""}
                        <span className="ml-1.5 text-[9.5px] text-amber-800 dark:text-amber-400 font-medium">
                          ({dish.variants.length} sizes)
                        </span>
                      </>
                    ) : (
                      <>Rs {dish.price.toLocaleString()}</>
                    )}
                  </span>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border)]/40">
                  <button
                    type="button"
                    onClick={() => setInspectingDish(dish)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] text-[10px] font-mono font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-xs"
                    title="View Recipe & Variant Details"
                  >
                    <Eye className="w-3 h-3 text-[var(--gold)]" />
                    <span>View Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditDish(dish)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] text-[10px] font-mono font-semibold cursor-pointer transition-all inline-flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDishToDelete(dish)}
                    className="p-1.5 rounded-lg bg-[var(--surface-hi)] hover:bg-rose-500/20 text-[var(--text-faint)] hover:text-rose-400 border border-[var(--border)] transition-all cursor-pointer"
                    title="Delete Dish"
                  >
                    <Trash2 className="w-3 h-3" />
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
              <tr className="border-b border-[var(--border)] bg-[var(--surface-hi)]/80 text-[10.5px] font-mono text-[var(--text-faint)] uppercase whitespace-nowrap">
                <th className="py-3.5 px-4 font-bold">Dish Item</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Category</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Price (PKR)</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Prep Time</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Stock Status</th>
                <th className="py-3.5 px-4 font-bold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {catalog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                      <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide mb-4">No menu items created yet</h3>
                      <button
                        type="button"
                        onClick={handleOpenAddDish}
                        className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] transition-transform"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Dish</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredDishes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                      <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No matching menu items</h3>
                      <p className="text-xs text-[var(--text-lo)] max-w-sm mt-1 mb-4">No dishes matched your current search or category filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDishes.map((dish) => {
                  const repYield = getItemRepresentativePortions(dish, getVariantPortions);
                  const isStrictlyZeroStock = repYield.portionCount <= 0;
                  const isItemActive = !isStrictlyZeroStock && dish.stockStatus !== "out_of_stock" && dish.in_stock !== false;

                  return (
                  <tr key={dish.id} className="hover:bg-[var(--surface-hi)]/40 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden relative shadow-sm">
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[var(--text-hi)] block text-sm group-hover:text-[var(--gold)] transition-colors">
                              {dish.name}
                            </span>
                            {(dish.isPopular || (dish as any).isFeatured || (dish as any).is_popular) && (
                              <span className="badge-pill badge-gold text-[9px]">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                <span>Featured</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--text-faint)] font-mono">ID: {dish.id}</span>
                          <ItemPortionAvailabilityText
                            displayText={repYield.displayText}
                            textColorClass={repYield.textColorClass}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono uppercase text-[var(--text-lo)] font-semibold text-[11px] whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="badge-pill badge-neutral text-[10px] uppercase font-semibold">
                          {dish.category}
                        </span>
                        {(() => {
                          const station = getMenuItemStation(dish);
                          const b = getStationBadgeInfo(station);
                          return (
                            <div className="relative inline-flex items-center">
                              <select
                                value={station}
                                onChange={(e) => handleQuickStationChange(dish, e.target.value)}
                                className={`px-2 py-0.5 pr-5 rounded-md text-[9.5px] font-mono font-bold uppercase border cursor-pointer appearance-none bg-transparent hover:opacity-85 transition-all focus:outline-none ${b.className}`}
                                title="Click to assign Kitchen Station"
                              >
                                <option value="desi" className="bg-[var(--bg-deep)] text-red-300">Desi</option>
                                <option value="fast_food" className="bg-[var(--bg-deep)] text-amber-300">Fast Food</option>
                                <option value="grill" className="bg-[var(--bg-deep)] text-orange-400">Grill</option>
                                <option value="fry" className="bg-[var(--bg-deep)] text-yellow-300">Fry</option>
                                <option value="pastry" className="bg-[var(--bg-deep)] text-pink-300">Pastry</option>
                                <option value="beverages" className="bg-[var(--bg-deep)] text-cyan-300">Beverages</option>
                                <option value="assembly" className="bg-[var(--bg-deep)] text-emerald-300">Assembly</option>
                              </select>
                              <ChevronDown className="w-2.5 h-2.5 pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 opacity-70" />
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-sm text-[var(--gold)] whitespace-nowrap">
                      {dish.variants && dish.variants.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span>
                            Rs {Math.min(...dish.variants.map((v) => v.price)).toLocaleString()}
                            {dish.variants.length > 1
                              ? ` - ${Math.max(...dish.variants.map((v) => v.price)).toLocaleString()}`
                              : ""}
                          </span>
                          <span className="text-[10px] text-amber-800 dark:text-amber-400 font-mono font-medium">
                            ({dish.variants.length} sizes)
                          </span>
                        </div>
                      ) : (
                        <span>Rs {dish.price.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[var(--text-faint)] text-[11px] whitespace-nowrap">
                      ~{dish.prepTime || "15m"}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isItemActive}
                          onClick={() => handleToggleAvailability(dish)}
                          disabled={isStrictlyZeroStock}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40 focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)] ${
                            isStrictlyZeroStock
                              ? "bg-zinc-800 border-zinc-700/60 opacity-50 cursor-not-allowed"
                              : isItemActive
                              ? "bg-emerald-500 hover:bg-emerald-400 cursor-pointer shadow-sm shadow-emerald-500/20"
                              : "bg-zinc-700 hover:bg-zinc-600 cursor-pointer"
                          }`}
                          title={
                            isStrictlyZeroStock
                              ? `Auto Out of Stock: Depleted ingredients or zero yield`
                              : isItemActive
                              ? (repYield.portionCount <= 5 ? `Low Stock (${repYield.portionCount} portions available)` : "In Stock")
                              : "Disabled"
                          }
                        >
                          <span className="sr-only">Toggle Stock Status</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              isItemActive ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>

                        {/* Matching Pill Status Badge */}
                        <ItemStockStatusBadge
                          isOutOfStock={isStrictlyZeroStock}
                          portionCount={repYield.portionCount}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectingDish(dish)}
                          className="p-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all cursor-pointer shadow-sm"
                          title="View Details & Recipe BOM"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditDish(dish)}
                          className="p-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all cursor-pointer shadow-sm"
                          title="Edit Dish Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDishToDelete(dish)}
                          className="p-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-red-500/20 text-[var(--text-lo)] hover:text-red-400 border border-[var(--border)] hover:border-red-500/40 transition-all cursor-pointer shadow-sm"
                          title="Delete Dish"
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

      {/* ========================================================================= */}
      {/* 3. DELETE DISH CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      {dishToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDishToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-red-500/30 shadow-2xl p-6 space-y-4 my-auto animate-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-[var(--text-hi)]">
                    Delete Dish Item?
                  </h3>
                  <p className="text-[11px] font-mono text-[var(--text-faint)]">
                    Permanent removal from catalog &amp; POS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDishToDelete(null)}
                className="w-7 h-7 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-lo)] leading-relaxed font-sans">
              Are you sure you want to delete <strong className="text-[var(--text-hi)]">{dishToDelete.name}</strong>? This will immediately remove it from all POS counters, KDS stations, and digital menu lists.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDishToDelete(null)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold font-mono cursor-pointer transition-colors shadow-lg shadow-red-500/20 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Dish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RECIPE & BILL OF MATERIALS (BOM) MODAL */}
      {/* ========================================================================= */}
      <RecipeModal
        isOpen={isRecipeModalOpen}
        dish={selectedDishForRecipe}
        onClose={() => {
          setIsRecipeModalOpen(false);
          setSelectedDishForRecipe(null);
        }}
        onSaveSuccess={(dishId, totalCost, marginPct) => {
          setCatalog((prev) =>
            prev.map((d) =>
              d.id === dishId
                ? {
                    ...d,
                    recipeCost: totalCost,
                    recipeMargin: marginPct,
                    hasRecipe: totalCost > 0,
                  }
                : d
            )
          );
          fetchFromSupabase();
        }}
        showToast={showToast}
      />

      {/* ========================================================================= */}
      {/* 5. DETAILED DISH & VARIANT BREAKDOWN MODAL (Interactive Eye Icon) */}
      {/* ========================================================================= */}
      <DishDetailsModal
        isOpen={Boolean(inspectingDish)}
        dish={inspectingDish}
        onClose={() => setInspectingDish(null)}
        getVariantPortions={getVariantPortions}
        rawRecipes={rawRecipes}
        rawMaterials={rawMaterials && rawMaterials.length > 0 ? rawMaterials : availableMaterials}
        effectiveLedger={effectiveLedger}
        onEditDish={handleOpenEditDish}
      />
    </div>
  );
}
