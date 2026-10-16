"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  UtensilsCrossed,
  Sparkles,
  Plus,
  Trash2,
  Check,
  X,
  ChevronDown,
  Upload,
  Image as ImageIcon,
  Star,
  ChefHat,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Info,
} from "lucide-react";
import { MenuItem, ItemVariant, RawMaterial, VariantRecipeItem } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import { calculateIngredientsPortionYield } from "@/lib/recipePortions";
import { getMenuItemStation, normalizeStationName, getStationBadgeInfo, STATION_OPTIONS } from "@/lib/kitchenStationRouting";

export interface MenuItemFormViewProps {
  initialData?: MenuItem | null;
  mode: "add" | "edit";
  onCancel: () => void;
  onSuccess: (savedDish: MenuItem) => void;
  showToast: (msg: string) => void;
}

export default function MenuItemFormView({
  initialData,
  mode = "add",
  onCancel,
  onSuccess,
  showToast,
}: MenuItemFormViewProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // General Form States
  const [formName, setFormName] = useState(initialData?.name || "");
  const [formCategory, setFormCategory] = useState(initialData?.category || "");
  const [formKitchenStation, setFormKitchenStation] = useState<string>(() => {
    if (initialData?.kitchen_station) return normalizeStationName(initialData.kitchen_station);
    if (initialData?.station) return normalizeStationName(initialData.station);
    if (mode === "edit" && initialData) return normalizeStationName(getMenuItemStation(initialData));
    return "";
  });
  const [formPrice, setFormPrice] = useState(
    initialData?.price !== undefined ? String(initialData.price) : ""
  );
  const [formPrepTime, setFormPrepTime] = useState(initialData?.prepTime || "15m");
  const [formStockStatus, setFormStockStatus] = useState<"in_stock" | "low_stock" | "out_of_stock">(
    initialData?.stockStatus || "in_stock"
  );
  const [formStockCount, setFormStockCount] = useState(
    initialData?.stockCount !== undefined ? String(initialData.stockCount) : "50"
  );
  const [formIsPopular, setFormIsPopular] = useState(
    Boolean(
      initialData?.isPopular ||
      (initialData as any)?.is_popular ||
      (initialData as any)?.isFeatured ||
      (initialData as any)?.is_featured
    )
  );
  const [formImageUrl, setFormImageUrl] = useState(
    initialData?.imageUrl || initialData?.image_url || ""
  );
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Categories (Loaded from restaurant's catalog + custom input)
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Sizing Variants & Per-Size Recipe Builder State
  const [hasVariants, setHasVariants] = useState(
    Boolean(initialData?.variants && initialData.variants.length > 0)
  );

  const [formVariants, setFormVariants] = useState<ItemVariant[]>(() => {
    if (initialData?.variants && initialData.variants.length > 0) {
      return initialData.variants.map((v) => ({
        ...v,
        recipe: Array.isArray(v.recipe) ? v.recipe : [],
      }));
    }
    return [];
  });

  // Active Variant Tab for Granular Recipe Editing
  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => {
    if (initialData?.variants && initialData.variants.length > 0) {
      return initialData.variants[0].id || "var_0";
    }
    return "";
  });

  // Standard Dish Recipe (Used when hasVariants is false)
  const [baseDishRecipe, setBaseDishRecipe] = useState<VariantRecipeItem[]>([]);

  // Raw Materials Lookup from Supabase
  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [inputQuantity, setInputQuantity] = useState<string>("0.25");
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);

  // Fetch Raw Materials
  useEffect(() => {
    let isMounted = true;
    async function loadMaterials() {
      try {
        setIsLoadingMaterials(true);
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const { data, error } = await supabase
          .from("raw_materials")
          .select("*")
          .eq("restaurant_id", restId)
          .order("name", { ascending: true });

        if (!error && data && isMounted) {
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
          if (mapped.length > 0) {
            setSelectedMaterialId(String(mapped[0].id));
          }
        }
      } catch (err) {
        console.warn("[MenuItemFormView] Error fetching raw materials:", err);
      } finally {
        if (isMounted) setIsLoadingMaterials(false);
      }
    }
    loadMaterials();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Fetch distinct existing categories for this restaurant
  useEffect(() => {
    let isMounted = true;
    const fetchExistingCategories = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const { data, error } = await supabase
          .from("menu_items")
          .select("category")
          .eq("restaurant_id", restId);

        if (!error && data && isMounted) {
          const distinct = Array.from(
            new Set(
              data
                .map((row: any) => row.category)
                .filter((cat: any): cat is string => Boolean(cat && typeof cat === "string" && cat.trim().length > 0))
                .map((cat: string) => cat.trim())
            )
          ).sort((a, b) => a.localeCompare(b));
          setExistingCategories(distinct);
        }
      } catch (err) {
        console.warn("[MenuItemFormView] Category load error:", err);
      }
    };
    fetchExistingCategories();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const filteredCategorySuggestions = useMemo(() => {
    const query = formCategory.trim().toLowerCase();
    const fallbackDefaults = [
      "Karahi & Handi",
      "BBQ & Grill",
      "Burgers",
      "Fast Food & Pizza",
      "Beverages",
      "Desserts",
    ];
    const sourceList = existingCategories.length > 0 ? existingCategories : fallbackDefaults;
    if (!query) return sourceList;
    return sourceList.filter((c) => c.toLowerCase().includes(query));
  }, [existingCategories, formCategory]);

  // Pre-load Existing Recipe Items if in Edit Mode
  useEffect(() => {
    if (mode !== "edit" || !initialData?.id) return;
    let isMounted = true;

    async function loadExistingRecipes() {
      try {
        const supabase = createClient();
        const { data: recRows, error } = await supabase
          .from("recipe_items")
          .select("*, raw_materials(*)")
          .eq("menu_item_id", initialData!.id);

        if (!error && recRows && isMounted) {
          // If dish has variants, attach variant recipes if not already in JSONB
          if (initialData?.variants && initialData.variants.length > 0) {
            setFormVariants((prev) =>
              prev.map((v) => {
                if (v.recipe && v.recipe.length > 0) return v;
                const matchedRows = recRows.filter(
                  (r: any) => r.variant_id && String(r.variant_id) === String(v.id)
                );
                if (matchedRows.length > 0) {
                  return {
                    ...v,
                    recipe: matchedRows.map((r: any) => {
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
                    }),
                  };
                }
                return v;
              })
            );
          } else {
            // Base dish recipe
            const baseItems: VariantRecipeItem[] = recRows
              .filter((r: any) => !r.variant_id)
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
            setBaseDishRecipe(baseItems);
          }
        }
      } catch (err) {
        console.warn("[MenuItemFormView] Error pre-loading recipes:", err);
      }
    }
    loadExistingRecipes();
    return () => {
      isMounted = false;
    };
  }, [mode, initialData]);

  // Ensure selectedVariantId is always valid
  useEffect(() => {
    if (formVariants.length > 0) {
      if (!formVariants.some((v) => v.id === selectedVariantId)) {
        setSelectedVariantId(formVariants[0].id);
      }
    }
  }, [formVariants, selectedVariantId]);

  // Current active variant for recipe editing
  const activeVariant = useMemo(() => {
    return formVariants.find((v) => v.id === selectedVariantId) || formVariants[0];
  }, [formVariants, selectedVariantId]);

  // Current selected material object
  const currentMaterial = useMemo(() => {
    return (
      availableMaterials.find((m) => String(m.id) === String(selectedMaterialId)) ||
      availableMaterials[0]
    );
  }, [availableMaterials, selectedMaterialId]);

  // Helper to add an ingredient to a specific variant's recipe
  const handleAddIngredientToVariant = (variantId: string) => {
    if (!currentMaterial) {
      showToast("Please choose a raw material ingredient.");
      return;
    }
    const qty = parseFloat(inputQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast("Please enter a valid positive quantity (e.g. 0.25 or 1).");
      return;
    }

    setFormVariants((prev) =>
      prev.map((v) => {
        if (v.id !== variantId) return v;
        const currentRecipe = Array.isArray(v.recipe) ? [...v.recipe] : [];
        const existingIdx = currentRecipe.findIndex(
          (r) => String(r.raw_material_id) === String(currentMaterial.id)
        );

        if (existingIdx !== -1) {
          currentRecipe[existingIdx] = {
            ...currentRecipe[existingIdx],
            quantity_required: currentRecipe[existingIdx].quantity_required + qty,
          };
        } else {
          currentRecipe.push({
            raw_material_id: currentMaterial.id,
            raw_material_name: currentMaterial.name,
            quantity_required: qty,
            unit: currentMaterial.unit,
            cost_per_unit: currentMaterial.cost_per_unit,
          });
        }
        return { ...v, recipe: currentRecipe };
      })
    );

    showToast(`Added ${currentMaterial.name} (${qty} ${currentMaterial.unit}) to ${activeVariant?.name || "size"}.`);
    setInputQuantity("0.25");
  };

  // Helper to remove an ingredient from a specific variant
  const handleRemoveIngredientFromVariant = (variantId: string, rawMatId: string | number) => {
    setFormVariants((prev) =>
      prev.map((v) => {
        if (v.id !== variantId) return v;
        const filtered = (v.recipe || []).filter(
          (r) => String(r.raw_material_id) !== String(rawMatId)
        );
        return { ...v, recipe: filtered };
      })
    );
  };

  // Helper to add ingredient to base recipe
  const handleAddIngredientToBaseRecipe = () => {
    if (!currentMaterial) {
      showToast("Please choose a raw material ingredient.");
      return;
    }
    const qty = parseFloat(inputQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast("Please enter a valid positive quantity (e.g. 0.25).");
      return;
    }

    setBaseDishRecipe((prev) => {
      const existingIdx = prev.findIndex(
        (r) => String(r.raw_material_id) === String(currentMaterial.id)
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
          raw_material_id: currentMaterial.id,
          raw_material_name: currentMaterial.name,
          quantity_required: qty,
          unit: currentMaterial.unit,
          cost_per_unit: currentMaterial.cost_per_unit,
        },
      ];
    });

    showToast(`Added ${currentMaterial.name} (${qty} ${currentMaterial.unit}) to dish recipe.`);
    setInputQuantity("0.25");
  };

  const handleRemoveIngredientFromBaseRecipe = (rawMatId: string | number) => {
    setBaseDishRecipe((prev) =>
      prev.filter((r) => String(r.raw_material_id) !== String(rawMatId))
    );
  };

  // Copy recipe from another variant
  const handleCopyRecipeFrom = (sourceVariantId: string, targetVariantId: string) => {
    const source = formVariants.find((v) => v.id === sourceVariantId);
    if (!source || !source.recipe || source.recipe.length === 0) {
      showToast("Selected source variant has no ingredients to copy.");
      return;
    }

    setFormVariants((prev) =>
      prev.map((v) => {
        if (v.id !== targetVariantId) return v;
        return {
          ...v,
          recipe: JSON.parse(JSON.stringify(source.recipe)),
        };
      })
    );
    showToast(`Copied ingredients from ${source.name} to ${activeVariant?.name}.`);
  };

  // Compute live yield & metrics using the exact authoritative portion engine
  const computeRecipeMetrics = (recipeItems: VariantRecipeItem[], sellingPrice: number) => {
    return calculateIngredientsPortionYield(recipeItems, availableMaterials, sellingPrice);
  };

  // Image Upload Handler
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
      console.warn("[MenuItemFormView] Image upload error, using local base64 fallback:", err);
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

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      showToast("Please enter a valid dish name.");
      return;
    }

    const resolvedCategory = formCategory.trim();
    if (!resolvedCategory) {
      showToast("Please enter or select a category for this dish.");
      return;
    }

    const resolvedStation = formKitchenStation.trim().toLowerCase();
    if (!resolvedStation) {
      showToast("Please select a Kitchen Station (e.g. Desi, Fast Food, Grill, etc.).");
      return;
    }

    // Validate Variants if enabled
    if (hasVariants) {
      if (formVariants.length === 0) {
        showToast("Please define at least one size variant or disable variant mode.");
        return;
      }
      for (const v of formVariants) {
        if (!v.name.trim()) {
          showToast("Every size variant must have a valid name (e.g. Single Petti).");
          return;
        }
        if (isNaN(v.price) || v.price < 0) {
          showToast(`Invalid price for size variant "${v.name}".`);
          return;
        }
      }
    } else {
      const numericPrice = parseFloat(formPrice);
      if (isNaN(numericPrice) || numericPrice < 0) {
        showToast("Please enter a valid base price.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);

      // Clean variants payload
      const cleanedVariants = hasVariants
        ? formVariants.map((v, idx) => ({
            id: v.id || `var_${idx + 1}`,
            name: v.name.trim(),
            price: Number(v.price),
            isDefault: Boolean(v.isDefault),
            recipe: Array.isArray(v.recipe) ? v.recipe : [],
          }))
        : null;

      const primaryPrice = hasVariants
        ? cleanedVariants && cleanedVariants.length > 0
          ? cleanedVariants.find((v) => v.isDefault)?.price || cleanedVariants[0].price
          : 0
        : parseFloat(formPrice) || 0;

      const prepMinutes = parseInt(formPrepTime.replace(/[^0-9]/g, "")) || 15;
      const formattedPrepTime = formPrepTime.toLowerCase().endsWith("m")
        ? formPrepTime
        : `${prepMinutes}m`;

      const payload: any = {
        restaurant_id: restId,
        branch_id: branchId || user?.branchId || null,
        name: trimmedName,
        category: resolvedCategory,
        kitchen_station: resolvedStation,
        price: Math.round(primaryPrice),
        prep_time: formattedPrepTime,
        preparation_time: prepMinutes,
        stock_status: formStockStatus,
        stock_count: parseInt(formStockCount) || 50,
        image_url: formImageUrl.trim() || null,
        is_popular: Boolean(formIsPopular),
        description: initialData?.description || null,
        variants: cleanedVariants,
      };

      let dishId: string | number = initialData?.id || "";

      if (mode === "add") {
        let { data, error } = await supabase
          .from("menu_items")
          .insert([payload])
          .select()
          .single();

        if (error && (error.message?.includes("kitchen_station") || error.code === "PGRST204" || error.code === "42703")) {
          delete payload.kitchen_station;
          const retryStation = await supabase.from("menu_items").insert([payload]).select().single();
          data = retryStation.data;
          error = retryStation.error;
        }

        if (error && (error.message?.includes("variants") || error.code === "PGRST204")) {
          delete payload.variants;
          if (cleanedVariants) {
            payload.description = JSON.stringify({ variants: cleanedVariants });
          }
          const retry = await supabase.from("menu_items").insert([payload]).select().single();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error("[MenuItemFormView] Insert error:", error);
          showToast(`Error creating dish: ${error.message}`);
          setIsSubmitting(false);
          return;
        }
        dishId = data.id;
      } else {
        let { error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", initialData!.id);

        if (error && (error.message?.includes("kitchen_station") || error.code === "PGRST204" || error.code === "42703")) {
          delete payload.kitchen_station;
          const retryStation = await supabase
            .from("menu_items")
            .update(payload)
            .eq("id", initialData!.id);
          error = retryStation.error;
        }

        if (error && (error.message?.includes("variants") || error.code === "PGRST204")) {
          delete payload.variants;
          if (cleanedVariants) {
            payload.description = JSON.stringify({ variants: cleanedVariants });
          }
          const retry = await supabase
            .from("menu_items")
            .update(payload)
            .eq("id", initialData!.id);
          error = retry.error;
        }

        if (error) {
          console.error("[MenuItemFormView] Update error:", error);
          showToast(`Error updating dish: ${error.message}`);
          setIsSubmitting(false);
          return;
        }
        dishId = initialData!.id;
      }

      // Sync recipe_items in Database
      try {
        // Purge old recipes for this dish
        await supabase.from("recipe_items").delete().eq("menu_item_id", dishId);

        const recipeRowsToInsert: any[] = [];

        if (hasVariants && cleanedVariants) {
          for (const v of cleanedVariants) {
            if (v.recipe && Array.isArray(v.recipe)) {
              for (const r of v.recipe) {
                recipeRowsToInsert.push({
                  restaurant_id: restId,
                  menu_item_id: dishId,
                  variant_id: v.id,
                  variant_name: v.name,
                  raw_material_id: r.raw_material_id,
                  quantity_required: Number(r.quantity_required),
                  unit: r.unit || "",
                });
              }
            }
          }
        } else if (baseDishRecipe.length > 0) {
          for (const r of baseDishRecipe) {
            recipeRowsToInsert.push({
              restaurant_id: restId,
              menu_item_id: dishId,
              variant_id: null,
              variant_name: null,
              raw_material_id: r.raw_material_id,
              quantity_required: Number(r.quantity_required),
              unit: r.unit || "",
            });
          }
        }

        if (recipeRowsToInsert.length > 0) {
          const { error: insRecErr } = await supabase
            .from("recipe_items")
            .insert(recipeRowsToInsert);

          if (insRecErr && (insRecErr.message?.includes("variant_id") || insRecErr.code === "PGRST204")) {
            // Fallback for schema if columns not yet updated
            const fallbackRows = recipeRowsToInsert.map((row) => ({
              restaurant_id: row.restaurant_id,
              menu_item_id: row.menu_item_id,
              raw_material_id: row.raw_material_id,
              quantity_required: row.quantity_required,
              unit: row.unit,
            }));
            await supabase.from("recipe_items").insert(fallbackRows);
          }
        }
      } catch (recSyncErr) {
        console.warn("[MenuItemFormView] Recipe sync error (handled):", recSyncErr);
      }

      // Construct saved dish object for local parent state
      const savedDish: MenuItem = {
        id: String(dishId),
        name: trimmedName,
        category: resolvedCategory,
        kitchen_station: resolvedStation,
        station: resolvedStation,
        price: Math.round(primaryPrice),
        prepTime: formattedPrepTime,
        preparation_time: prepMinutes,
        stockStatus: formStockStatus,
        stockCount: parseInt(formStockCount) || 50,
        imageIcon: "",
        imageUrl: formImageUrl.trim() || undefined,
        image_url: formImageUrl.trim() || undefined,
        isPopular: Boolean(formIsPopular),
        is_popular: Boolean(formIsPopular),
        isFeatured: Boolean(formIsPopular),
        is_featured: Boolean(formIsPopular),
        description: initialData?.description || undefined,
        variants: cleanedVariants || undefined,
        hasRecipe: hasVariants
          ? cleanedVariants?.some((v) => v.recipe && v.recipe.length > 0)
          : baseDishRecipe.length > 0,
      };

      showToast(
        mode === "add"
          ? `Dish "${savedDish.name}" created successfully with recipes.`
          : `Dish "${savedDish.name}" updated successfully.`
      );
      onSuccess(savedDish);
    } catch (err: any) {
      console.error("[MenuItemFormView] Unexpected submit error:", err);
      showToast("An unexpected error occurred while saving menu item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-3 sm:p-6 lg:p-8 space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer shadow-sm font-mono"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--gold)]" />
          <span>Back to Menu Catalog</span>
        </button>
      </div>

      {/* Main Page Title Header */}
      <div className="border-b border-[var(--border)] pb-5">
        <h1 className="text-2xl sm:text-4xl font-black font-display tracking-tight text-[var(--text-hi)]">
          {mode === "add" ? (
            <>
              Create Menu Item &amp;{" "}
              <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                Per-Size Recipes
              </span>
            </>
          ) : (
            <>
              Edit Menu Item &amp;{" "}
              <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                Portion Sizing
              </span>
            </>
          )}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CARD 1: GENERAL DISH INFORMATION */}
        <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="text-sm font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--gold)]" />
              <span>1. General Information &amp; Classification</span>
            </h2>
            <span className="text-[11px] font-mono text-[var(--text-faint)]">Core Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Dish Name */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-lo)] block">
                Dish / Product Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Chicken Peshawari Karahi, Classic Smash Burger"
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/70 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
              />
            </div>

            {/* Category (Free-Text Input + Dynamic Suggestions Combobox) */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-medium text-[var(--text-lo)] block">
                Category <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formCategory}
                  onChange={(e) => {
                    setFormCategory(e.target.value);
                    setIsCategoryDropdownOpen(true);
                  }}
                  onFocus={() => setIsCategoryDropdownOpen(true)}
                  placeholder="Type or select a category"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/70 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-4 py-2.5 pr-10 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                  className="w-7 h-7 flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--gold)] transition-colors cursor-pointer"
                  title="View categories"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isCategoryDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Combobox Dropdown Suggestions */}
                {isCategoryDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsCategoryDropdownOpen(false)}
                    />
                    <div className="absolute z-30 left-0 right-0 top-full mt-1.5 max-h-52 overflow-y-auto rounded-2xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-2xl p-1.5 space-y-0.5 custom-scrollbar font-sans animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1 text-[10px] font-mono text-[var(--text-faint)] uppercase tracking-wider">
                        {existingCategories.length > 0 ? "Saved Categories" : "Suggested Categories"}
                      </div>
                      {filteredCategorySuggestions.length > 0 ? (
                        filteredCategorySuggestions.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setFormCategory(cat);
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                              formCategory.toLowerCase() === cat.toLowerCase()
                                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                                : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                            }`}
                          >
                            <span>{cat}</span>
                            {formCategory.toLowerCase() === cat.toLowerCase() && (
                              <Check className="w-3.5 h-3.5 text-[var(--gold)]" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-[var(--text-lo)] italic">
                          New category: &quot;{formCategory}&quot;
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Preparation Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-lo)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                <span>Prep Time</span>
              </label>
              <input
                type="text"
                value={formPrepTime}
                onChange={(e) => setFormPrepTime(e.target.value)}
                placeholder="e.g. 15m"
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/70 rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
              />
            </div>

            {/* Kitchen Station Routing */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-hi)] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Kitchen Station <span className="text-red-400">*</span></span>
                </span>
                <span className="text-[10px] font-mono text-[var(--gold)] font-bold uppercase tracking-wider">
                  Required
                </span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formKitchenStation}
                  onChange={(e) => setFormKitchenStation(e.target.value)}
                  className={`w-full bg-[var(--surface-hi)] border rounded-xl px-4 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans ${
                    !formKitchenStation
                      ? "border-amber-500/60 focus:border-[var(--gold)]"
                      : "border-[var(--border)] focus:border-[var(--gold)]/70"
                  }`}
                >
                  <option value="" disabled className="bg-[var(--bg-deep)] text-[var(--text-faint)]">
                    -- Select Kitchen Station * --
                  </option>
                  <option value="desi" className="bg-[var(--bg-deep)] text-red-300">
                    Desi (Karahi, Handi, Biryani, Curries, Tandoor)
                  </option>
                  <option value="fast_food" className="bg-[var(--bg-deep)] text-amber-300">
                    Fast Food (Burgers, Sandwiches, Pizza, Wraps)
                  </option>
                  <option value="grill" className="bg-[var(--bg-deep)] text-orange-400">
                    Grill (BBQ, Steaks, Tikkas, Kebabs, Charcoals)
                  </option>
                  <option value="fry" className="bg-[var(--bg-deep)] text-yellow-300">
                    Fry (Fryers, Wings, Nuggets, Crispy Fries)
                  </option>
                  <option value="pastry" className="bg-[var(--bg-deep)] text-pink-300">
                    Pastry (Cakes, Desserts, Bakery, Sweets)
                  </option>
                  <option value="beverages" className="bg-[var(--bg-deep)] text-cyan-300">
                    Beverages (Drinks, Shakes, Juices, Mocktails, Coffee)
                  </option>
                  <option value="assembly" className="bg-[var(--bg-deep)] text-emerald-300">
                    Assembly (Salads, Soups, Appetizers, Packaging)
                  </option>
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Station Tag Preview / Explanation */}
              {formKitchenStation ? (
                (() => {
                  const badge = getStationBadgeInfo(formKitchenStation);
                  return (
                    <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-[var(--text-lo)]">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${badge.className}`}>
                        [{badge.shortCode}] {badge.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)]">
                        Routes to this station on Send to KOT
                      </span>
                    </div>
                  );
                })()
              ) : (
                <p className="text-[10px] text-amber-400/90 font-mono pt-0.5">
                  ⚠️ Explicit station assignment is required for kitchen routing.
                </p>
              )}
            </div>

            {/* Stock Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-lo)] block">
                Stock Status
              </label>
              <div className="relative">
                <select
                  value={formStockStatus}
                  onChange={(e) => setFormStockStatus(e.target.value as any)}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/70 rounded-xl px-4 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                >
                  <option value="in_stock" className="bg-[var(--bg-deep)] text-emerald-400">In Stock</option>
                  <option value="low_stock" className="bg-[var(--bg-deep)] text-amber-400">Low Stock</option>
                  <option value="out_of_stock" className="bg-[var(--bg-deep)] text-rose-400">Out of Stock</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Popular Toggle */}
            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setFormIsPopular(!formIsPopular)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  formIsPopular
                    ? "bg-[var(--gold-dim)] border-[var(--gold)] text-[var(--gold)]"
                    : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
              >
                <Star className={`w-4 h-4 ${formIsPopular ? "fill-current" : ""}`} />
                <span>Featured / Best Seller</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: DISH PRESENTATION & IMAGERY */}
        <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="text-sm font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[var(--gold)]" />
              <span>2. Visual &amp; POS Card Presentation</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* Live Preview Box (Clean blank state when no image provided) */}
            <div className="md:col-span-1 flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)]">
              {formImageUrl ? (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-black/40 border border-[var(--border)] flex items-center justify-center relative shadow-inner">
                  <img
                    src={formImageUrl}
                    alt={formName || "Dish Preview"}
                    className="w-full h-full object-cover"
                    onError={() => setFormImageUrl("")}
                  />
                </div>
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] flex flex-col items-center justify-center text-[var(--text-faint)] p-3 text-center">
                  <ImageIcon className="w-7 h-7 mb-1.5 opacity-35 text-[var(--gold)]" />
                  <span className="text-[10px] font-mono leading-tight">No image</span>
                </div>
              )}
            </div>

            {/* Inputs & Uploader */}
            <div className="md:col-span-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-lo)] block">
                  Image Direct URL
                </label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://... (Optional)"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/70 rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploadLoading}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-hi)] inline-flex items-center gap-2 cursor-pointer transition-all shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>{imageUploadLoading ? "Uploading..." : "Upload Image File"}</span>
                </button>

                {formImageUrl && (
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("")}
                    className="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Remove Image
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: SIZING MATRIX & PER-SIZE RECIPE BUILDER */}
        <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--gold)]" />
                <span>3. Portion Sizing &amp; Per-Size Recipe Builder</span>
              </h2>
            </div>

            {/* Sizing Matrix Mode Toggle */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)] border border-[var(--border)] shrink-0 self-start sm:self-auto shadow-2xs">
              <button
                type="button"
                onClick={() => setHasVariants(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  !hasVariants
                    ? "bg-[var(--gold)] text-black shadow-xs font-extrabold"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
              >
                Single Standard Size
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasVariants(true);
                  if (formVariants.length === 0) {
                    const firstVar: ItemVariant = {
                      id: `var_${Date.now()}`,
                      name: "Regular",
                      price: formPrice ? parseFloat(formPrice) || 0 : 0,
                      isDefault: true,
                      recipe: baseDishRecipe.length > 0 ? [...baseDishRecipe] : [],
                    };
                    setFormVariants([firstVar]);
                    setSelectedVariantId(firstVar.id);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                  hasVariants
                    ? "bg-[var(--gold)] text-black shadow-xs font-extrabold"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
              >
                Multiple Sizes / Portions
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CASE A: SINGLE STANDARD PORTION DISH */}
          {/* ========================================================================= */}
          {!hasVariants ? (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-hi)] block font-mono">
                    Selling Price (Rs) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="e.g. 1250"
                    className="w-full bg-white dark:bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--gold)] font-mono font-bold focus:outline-none shadow-2xs"
                  />
                </div>
              </div>

              {/* Recipe BOM for Single Size */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-[var(--surface-hi)]/60 border border-[var(--border)] space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                  <h3 className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase flex items-center gap-1.5">
                    <ChefHat className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Standard Dish Bill of Materials (BOM)</span>
                  </h3>
                </div>

                {/* Add Raw Material Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-[10px] font-mono font-semibold uppercase text-[var(--text-faint)]">
                      Select Raw Material
                    </label>
                    <div className="relative">
                      <select
                        value={selectedMaterialId}
                        onChange={(e) => setSelectedMaterialId(e.target.value)}
                        className="w-full appearance-none bg-white dark:bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-xs text-[var(--text-hi)] rounded-xl px-3 py-2 pr-8 cursor-pointer focus:outline-none shadow-2xs"
                      >
                        {availableMaterials.map((m) => (
                          <option key={m.id} value={m.id} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                            {m.name} ({m.category}) — {m.current_stock} {m.unit} in stock @ Rs {m.cost_per_unit}/{m.unit}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[10px] font-mono font-semibold uppercase text-[var(--text-faint)]">
                      Required Quantity ({currentMaterial?.unit || "unit"})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={inputQuantity}
                      onChange={(e) => setInputQuantity(e.target.value)}
                      placeholder="0.25"
                      className="w-full bg-white dark:bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-xs text-[var(--text-hi)] rounded-xl px-3 py-2 focus:outline-none font-mono shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddIngredientToBaseRecipe}
                      className="w-full btn-gold py-2 px-3 rounded-xl text-xs font-bold font-mono inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Ingredient</span>
                    </button>
                  </div>
                </div>

                {/* Ingredients List Table */}
                {baseDishRecipe.length === 0 ? (
                  <div className="py-6 px-4 text-center rounded-xl bg-white dark:bg-black/20 border border-dashed border-[var(--border)] text-xs text-[var(--text-faint)] shadow-xs">
                    No recipe ingredients linked yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-black/20 shadow-xs">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--surface-hi)]/80 dark:bg-[var(--surface-hi)] text-[10px] font-mono uppercase text-[var(--text-lo)] dark:text-[var(--text-faint)]">
                          <th className="py-2.5 px-3">Ingredient</th>
                          <th className="py-2.5 px-3">Required Qty</th>
                          <th className="py-2.5 px-3">Unit Cost</th>
                          <th className="py-2.5 px-3">Subtotal</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {baseDishRecipe.map((ing, idx) => {
                          const mat = availableMaterials.find(
                            (m) => String(m.id) === String(ing.raw_material_id)
                          );
                          const unitCost = mat?.cost_per_unit || ing.cost_per_unit || 0;
                          const subtotal = ing.quantity_required * unitCost;

                          return (
                            <tr key={`${ing.raw_material_id}_${idx}`} className="hover:bg-[var(--surface-hi)]/30 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-[var(--text-hi)]">
                                {mat?.name || ing.raw_material_name}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-[var(--text-hi)]">
                                {ing.quantity_required} {ing.unit || mat?.unit}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[var(--text-lo)]">
                                Rs {unitCost.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-[var(--gold)]">
                                Rs {Math.round(subtotal).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIngredientFromBaseRecipe(ing.raw_material_id)}
                                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
                                  title="Remove Ingredient"
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

                {/* Live Recipe Metrics Bar */}
                {baseDishRecipe.length > 0 && (() => {
                  const metrics = computeRecipeMetrics(baseDishRecipe, parseFloat(formPrice) || 0);
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                      <div className="p-3.5 rounded-xl bg-white dark:bg-[var(--surface-hi)] border border-[var(--border)] shadow-xs">
                        <span className="text-[10px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase block">Food Cost</span>
                        <span className="text-sm font-bold font-mono text-[var(--text-hi)] mt-0.5 block">Rs {metrics.foodCost}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white dark:bg-[var(--surface-hi)] border border-[var(--border)] shadow-xs">
                        <span className="text-[10px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase block">Gross Margin</span>
                        <span className={`text-sm font-bold font-mono mt-0.5 block ${metrics.marginPct >= 50 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-400"}`}>
                          {metrics.marginPct}% (Rs {metrics.grossMargin})
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white dark:bg-[var(--surface-hi)] border border-[var(--border)] col-span-2 shadow-xs">
                        <span className="text-[10px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase block">Real-Time POS Portion Yield</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-sm font-black font-mono ${metrics.availablePortions <= 5 ? "text-amber-800 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                            {metrics.availablePortions} Portions
                          </span>
                          {metrics.limitingIngredientName && (
                            <span className="text-[10px] text-[var(--text-lo)] dark:text-[var(--text-faint)] truncate font-mono">
                              (Limiting: {metrics.limitingIngredientName})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CASE B: MULTIPLE SIZES / PORTIONS WITH PER-SIZE RECIPE BUILDER */
            /* ========================================================================= */
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Sizes / Variants Matrix Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-hi)] font-mono uppercase tracking-wide">
                    Portion Sizes &amp; Prices
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = formVariants.length + 1;
                      const newVar: ItemVariant = {
                        id: `var_${Date.now()}`,
                        name: formVariants.length === 0 ? "Regular" : `Size ${nextIdx}`,
                        price: formPrice ? parseFloat(formPrice) || 0 : 0,
                        isDefault: formVariants.length === 0,
                        recipe: [],
                      };
                      setFormVariants([...formVariants, newVar]);
                      setSelectedVariantId(newVar.id);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-900 border border-amber-500/35 hover:bg-amber-500/25 dark:bg-[var(--gold-dim)] dark:border-[var(--gold)]/30 dark:text-[var(--gold)] dark:hover:bg-[var(--gold)] dark:hover:text-black text-xs font-mono font-bold transition-all inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Size Variant</span>
                  </button>
                </div>

                {formVariants.length === 0 ? (
                  <div className="py-8 px-4 text-center rounded-2xl bg-white dark:bg-black/20 border border-dashed border-[var(--border)] space-y-3 shadow-xs">
                    <Layers className="w-8 h-8 mx-auto text-[var(--gold)] opacity-40" />
                    <p className="text-xs text-[var(--text-lo)] font-sans">No portion sizes defined yet.</p>
                    <button
                      type="button"
                      onClick={() => {
                        const newVar: ItemVariant = {
                          id: `var_${Date.now()}`,
                          name: "Regular",
                          price: formPrice ? parseFloat(formPrice) || 0 : 0,
                          isDefault: true,
                          recipe: [],
                        };
                        setFormVariants([newVar]);
                        setSelectedVariantId(newVar.id);
                      }}
                      className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add First Size Variant</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formVariants.map((v, idx) => {
                      const isSelected = v.id === selectedVariantId;
                      const variantMetrics = computeRecipeMetrics(v.recipe || [], v.price);

                      return (
                        <div
                          key={v.id || idx}
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-white dark:bg-[var(--surface-hi)] border-[var(--gold)] shadow-sm dark:shadow-md dark:shadow-black/20 ring-1 ring-[var(--gold)]/25"
                              : "bg-white/75 dark:bg-[var(--surface-hi)]/40 hover:bg-white dark:hover:bg-[var(--surface-hi)]/70 border-[var(--border)] shadow-2xs"
                          }`}
                        >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Default Radio */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormVariants((prev) =>
                                prev.map((item) => ({
                                  ...item,
                                  isDefault: item.id === v.id,
                                }))
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all shrink-0 cursor-pointer ${
                              v.isDefault
                                ? "bg-amber-500/15 text-amber-900 border border-amber-500/35 dark:bg-[var(--gold)] dark:text-black font-extrabold shadow-2xs"
                                : "bg-neutral-100 hover:bg-neutral-200/70 dark:bg-[var(--surface-hi)] dark:hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)]"
                            }`}
                            title="Set as Default POS Size"
                          >
                            {v.isDefault ? "Default" : "Set Default"}
                          </button>

                          {/* Size Name Input */}
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              required
                              value={v.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setFormVariants((prev) =>
                                  prev.map((item) =>
                                    item.id === v.id ? { ...item, name: newName } : item
                                  )
                                );
                              }}
                              placeholder="Size Name (e.g. Single Petti, Double Petti)"
                              className="w-full bg-white dark:bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] text-xs font-bold text-[var(--text-hi)] rounded-xl px-3 py-2 focus:outline-none transition-all shadow-2xs"
                            />
                          </div>

                          {/* Size Price Input */}
                          <div className="w-32 shrink-0">
                            <div className="relative">
                              <span className="text-[10px] font-mono text-[var(--gold)] font-bold absolute left-2.5 top-1/2 -translate-y-1/2">
                                Rs
                              </span>
                              <input
                                type="number"
                                min="0"
                                required
                                value={v.price}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newPrice = parseFloat(e.target.value) || 0;
                                  setFormVariants((prev) =>
                                    prev.map((item) =>
                                      item.id === v.id ? { ...item, price: newPrice } : item
                                    )
                                  );
                                }}
                                className="w-full bg-white dark:bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] text-xs font-mono font-bold text-[var(--gold)] rounded-xl pl-8 pr-2.5 py-2 focus:outline-none transition-all shadow-2xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Live Badges for this Size */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                          {/* Recipe Status Pill */}
                          <span
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border inline-flex items-center gap-1.5 shadow-2xs ${
                              v.recipe && v.recipe.length > 0
                                ? variantMetrics.availablePortions <= 5
                                  ? "bg-amber-500/15 text-amber-900 border-amber-500/35 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-600/40"
                                  : "bg-emerald-500/15 text-emerald-900 border-emerald-500/35 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-600/35"
                                : "bg-neutral-500/15 text-neutral-800 border-neutral-400/30 dark:bg-zinc-800/80 dark:text-zinc-400 dark:border-zinc-700/50"
                            }`}
                          >
                            <ChefHat className="w-3 h-3" />
                            <span>
                              {v.recipe && v.recipe.length > 0
                                ? `${v.recipe.length} Ingredients (${variantMetrics.availablePortions} Yield)`
                                : "No Recipe Linked"}
                            </span>
                          </span>

                          {/* Delete Size Button */}
                          {formVariants.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const filtered = formVariants.filter((item) => item.id !== v.id);
                                if (v.isDefault && filtered.length > 0) {
                                  filtered[0].isDefault = true;
                                }
                                setFormVariants(filtered);
                              }}
                              className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
                              title="Delete Size Variant"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

              {/* ========================================================================= */}
              {/* DEDICATED RECIPE BUILDER FOR ACTIVE SIZE VARIANT */}
              {/* ========================================================================= */}
              {activeVariant && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] dark:border-[var(--gold)]/40 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-900 border border-amber-500/30 dark:bg-[var(--gold-dim)] dark:text-[var(--gold)] dark:border-transparent font-mono text-[10px] font-bold uppercase mb-1">
                        Active Size Recipe Builder
                      </div>
                      <h3 className="text-sm font-bold text-[var(--text-hi)] font-mono flex items-center gap-2 flex-wrap">
                        <span>Recipe Ingredients for:</span>
                        <span className="text-amber-800 dark:text-[var(--gold)] font-black">{activeVariant.name}</span>
                        <span className="text-xs text-[var(--text-lo)] font-normal">
                          (Selling at Rs {activeVariant.price.toLocaleString()})
                        </span>
                      </h3>
                    </div>

                    {/* Copy Recipe From Another Size Dropdown */}
                    {formVariants.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)]">Clone Recipe:</span>
                        <div className="relative">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleCopyRecipeFrom(e.target.value, activeVariant.id);
                                e.target.value = "";
                              }
                            }}
                            defaultValue=""
                            className="appearance-none bg-white dark:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--gold)] text-[11px] font-mono text-[var(--text-hi)] hover:text-amber-800 dark:hover:text-[var(--gold)] rounded-xl px-2.5 py-1 pr-6 cursor-pointer focus:outline-none shadow-2xs"
                          >
                            <option value="" disabled>Copy from size...</option>
                            {formVariants
                              .filter((v) => v.id !== activeVariant.id)
                              .map((v) => (
                                <option key={v.id} value={v.id} className="bg-white dark:bg-[var(--bg-deep)] text-[var(--text-hi)]">
                                  {v.name} ({v.recipe?.length || 0} items)
                                </option>
                              ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-[var(--text-faint)] pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Raw Material to This Size */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                    <div className="sm:col-span-6 space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase text-[var(--text-lo)] dark:text-[var(--text-faint)]">
                        Select Raw Material Ingredient
                      </label>
                      <div className="relative">
                        <select
                          value={selectedMaterialId}
                          onChange={(e) => setSelectedMaterialId(e.target.value)}
                          className="w-full appearance-none bg-white dark:bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] text-xs text-[var(--text-hi)] rounded-xl px-3 py-2 pr-8 cursor-pointer focus:outline-none shadow-2xs"
                        >
                          {availableMaterials.map((m) => (
                            <option key={m.id} value={m.id} className="bg-white dark:bg-[var(--bg-deep)] text-[var(--text-hi)]">
                              {m.name} ({m.category}) — {m.current_stock} {m.unit} in stock @ Rs {m.cost_per_unit}/{m.unit}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-mono font-bold uppercase text-[var(--text-lo)] dark:text-[var(--text-faint)]">
                        Required Qty ({currentMaterial?.unit || "unit"})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={inputQuantity}
                        onChange={(e) => setInputQuantity(e.target.value)}
                        placeholder="0.25"
                        className="w-full bg-white dark:bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] text-xs text-[var(--text-hi)] rounded-xl px-3 py-2 focus:outline-none font-mono shadow-2xs"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={() => handleAddIngredientToVariant(activeVariant.id)}
                        className="w-full btn-gold py-2 px-3 rounded-xl text-xs font-bold font-mono inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to {activeVariant.name}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Variant Ingredients Table */}
                  {!activeVariant.recipe || activeVariant.recipe.length === 0 ? (
                    <div className="py-6 px-4 text-center rounded-xl bg-white dark:bg-black/20 border border-dashed border-[var(--border)] text-xs text-[var(--text-faint)]">
                      No recipe ingredients defined for <strong className="text-[var(--text-hi)]">{activeVariant.name}</strong> yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-black/20 shadow-xs">
                      <table className="w-full text-left text-xs font-sans">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-neutral-100/80 dark:bg-[var(--surface)] text-[10px] font-mono uppercase text-[var(--text-lo)] dark:text-[var(--text-faint)]">
                            <th className="py-2.5 px-3">Ingredient</th>
                            <th className="py-2.5 px-3">Required Qty</th>
                            <th className="py-2.5 px-3">Current Stock</th>
                            <th className="py-2.5 px-3">Unit Cost</th>
                            <th className="py-2.5 px-3">Subtotal</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {activeVariant.recipe.map((ing, idx) => {
                            const mat = availableMaterials.find(
                              (m) => String(m.id) === String(ing.raw_material_id)
                            );
                            const unitCost = mat?.cost_per_unit || ing.cost_per_unit || 0;
                            const subtotal = ing.quantity_required * unitCost;

                            return (
                              <tr key={`${ing.raw_material_id}_${idx}`} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="py-2.5 px-3 font-semibold text-[var(--text-hi)]">
                                  {mat?.name || ing.raw_material_name}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-[var(--text-hi)]">
                                  {ing.quantity_required} {ing.unit || mat?.unit}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[var(--text-lo)]">
                                  {mat?.current_stock ?? "—"} {ing.unit || mat?.unit}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[var(--text-lo)]">
                                  Rs {unitCost.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-amber-800 dark:text-[var(--gold)]">
                                  Rs {Math.round(subtotal).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIngredientFromVariant(activeVariant.id, ing.raw_material_id)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15 cursor-pointer transition-colors"
                                    title="Remove Ingredient"
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

                  {/* Active Size Live Metrics Bar */}
                  {activeVariant.recipe && activeVariant.recipe.length > 0 && (() => {
                    const metrics = computeRecipeMetrics(activeVariant.recipe, activeVariant.price);
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                        <div className="p-3.5 rounded-xl bg-white dark:bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                          <span className="text-[10px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase block">{activeVariant.name} Cost</span>
                          <span className="text-sm font-bold font-mono text-[var(--text-hi)] mt-0.5 block">Rs {metrics.foodCost}</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-white dark:bg-[var(--surface)] border border-[var(--border)] shadow-xs">
                          <span className="text-[10px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase block">Profit Margin</span>
                          <span className={`text-sm font-bold font-mono mt-0.5 block ${metrics.marginPct >= 50 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-400"}`}>
                            {metrics.marginPct}% (Rs {metrics.grossMargin})
                          </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-white dark:bg-[var(--surface)] border border-[var(--border)] col-span-2 shadow-xs">
                          <span className="text-[10px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase block">
                            Independent POS Available Yield for {activeVariant.name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-sm font-black font-mono ${metrics.availablePortions <= 5 ? "text-amber-800 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                              {metrics.availablePortions} Portions
                            </span>
                            {metrics.limitingIngredientName && (
                              <span className="text-[10px] text-[var(--text-lo)] dark:text-[var(--text-faint)] truncate font-mono">
                                (Limiting: {metrics.limitingIngredientName})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-lg sticky bottom-4 z-20 backdrop-blur-md">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-2xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel &amp; Discard
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-gold px-7 py-2.5 rounded-2xl text-xs font-bold font-mono cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? "Saving & Syncing..." : mode === "add" ? "Create Menu Item & Sync Recipes" : "Save Changes & Update Recipes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
