"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  ChefHat,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MenuItem, RawMaterial } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import RecipeModal from "./RecipeModal";

interface MenuViewProps {
  menuItems: MenuItem[];
  onAddDish?: (newDish: MenuItem) => void;
  onUpdateDish?: (updatedDish: MenuItem) => void;
  onDeleteDish?: (dishId: string) => void;
  handleToggleStock?: (dishId: string) => void;
  onToggleStock?: (dishId: string) => void;
  showToast: (msg: string) => void;
  routeAction?: { action: "new" | "edit"; id?: string } | null;
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

  // Local catalog synchronized directly with Supabase
  const [catalog, setCatalog] = useState<MenuItem[]>(menuItems || []);

  useEffect(() => {
    if (menuItems) {
      setCatalog(menuItems);
    }
  }, [menuItems]);

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
            imageIcon: row.image_icon || "",
            isPopular: Boolean(row.is_popular),
            is_available: (row.stock_status || "in_stock") === "in_stock",
            in_stock: (row.stock_status || "in_stock") === "in_stock",
          };
        });

        // Fetch recipes and linked raw materials to compute live food costs, margins, and dynamic stock availability
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

                // Rule 1: If canMakePortions < 1, dish status MUST automatically resolve to OUT OF STOCK
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
          console.warn("[MenuView] Recipe fetch warning:", rErr);
        }

        setCatalog(mapped);
      }
    } catch (err) {
      console.error("[MenuView] Supabase fetch exception:", err);
    }
  }, [user?.organizationId, user?.id]);

  useEffect(() => {
    fetchFromSupabase();
  }, [fetchFromSupabase]);

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
  const [formPrepTime, setFormPrepTime] = useState("15m");
  const [formStockStatus, setFormStockStatus] = useState<"in_stock" | "low_stock" | "out_of_stock">("in_stock");
  const [formStockCount, setFormStockCount] = useState<string>("20");
  const [formIsPopular, setFormIsPopular] = useState(false);

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

  // Synchronize routeAction for bookmarking / direct nested URLs
  useEffect(() => {
    if (!routeAction) {
      if (isAddModalOpen || editingDish) {
        setIsAddModalOpen(false);
        setEditingDish(null);
      }
      return;
    }

    if (routeAction.action === "new") {
      if (isAddModalOpen && !editingDish) {
        return;
      }
      setFormName("");
      setFormCategory("karahi");
      setFormPrice("1250");
      setFormPrepTime("15m");
      setFormStockStatus("in_stock");
      setFormStockCount("25");
      setFormIsPopular(false);
      setFormIngredients([]);
      setInputQuantity("0.2");
      fetchRawMaterials();
      setIsAddModalOpen(true);
      setEditingDish(null);
    } else if (routeAction.action === "edit" && routeAction.id) {
      const target = catalog.find((d) => String(d.id) === String(routeAction.id));
      if (target && (!editingDish || String(editingDish.id) !== String(target.id))) {
        setEditingDish(target);
        setFormName(target.name);
        setFormCategory(target.category || "karahi");
        setFormPrice(String(target.price));
        setFormPrepTime(target.prepTime || "15m");
        setFormStockStatus(target.stockStatus || "in_stock");
        setFormStockCount(String(target.stockCount || 20));
        setFormIsPopular(Boolean(target.isPopular));
        setFormIngredients([]);
        setInputQuantity("0.2");
        fetchRawMaterials();
        setIsAddModalOpen(false);
      } else if (!target) {
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
                isPopular: Boolean(data.is_popular),
                is_available: (data.stock_status || "in_stock") === "in_stock",
                in_stock: (data.stock_status || "in_stock") === "in_stock",
              };
              setEditingDish(mapped);
              setFormName(mapped.name);
              setFormCategory(mapped.category || "karahi");
              setFormPrice(String(mapped.price));
              setFormPrepTime(mapped.prepTime || "15m");
              setFormStockStatus(mapped.stockStatus || "in_stock");
              setFormStockCount(String(mapped.stockCount || 20));
              setFormIsPopular(Boolean(mapped.isPopular));
              setFormIngredients([]);
              setInputQuantity("0.2");
              fetchRawMaterials();
              setIsAddModalOpen(false);
            }
          } catch (e) {
            console.warn("[MenuView] Error loading dish for edit route:", e);
          }
        })();
      }
    }
  }, [routeAction, catalog]);

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
    setFormPrepTime("15m");
    setFormStockStatus("in_stock");
    setFormStockCount("25");
    setFormIsPopular(false);
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
    const trimmedName = formName.trim();
    const numericPrice = parseFloat(formPrice);

    if (!trimmedName) {
      showToast("Please enter a valid dish name.");
      return;
    }
    if (isNaN(numericPrice) || numericPrice <= 0) {
      showToast("Please enter a valid positive price in PKR.");
      return;
    }

    let createdId = `dish_${Date.now()}`;
    const prepMinutes = parseInt(String(formPrepTime).replace(/[^0-9]/g, "")) || 15;
    const formattedPrepTime = `${prepMinutes}m`;

    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      const insertPayload: any = {
        restaurant_id: restId,
        branch_id: branchId || user?.branchId || null,
        name: trimmedName,
        category: formCategory,
        price: Math.round(numericPrice),
        prep_time: formattedPrepTime,
        preparation_time: prepMinutes,
        stock_status: formStockStatus || "in_stock",
        stock_count: parseInt(formStockCount) || 50,
        image_icon: null,
        is_popular: Boolean(formIsPopular),
      };

      let { data, error } = await supabase
        .from("menu_items")
        .insert([insertPayload])
        .select()
        .single();

      if (error && error.message?.includes("preparation_time")) {
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
        console.error("[MenuView] Supabase insert error:", error);
        showToast(`Error saving dish: ${error.message}`);
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
      isPopular: formIsPopular,
      recipeCost: formRecipeCost,
      recipeMargin: formMarginPct,
      hasRecipe: formIngredients.length > 0,
    };

    setCatalog((prev) => [newDish, ...prev]);
    if (onAddDish) {
      onAddDish(newDish);
    }
    setIsAddModalOpen(false);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/menu");
    }
    showToast(`Dish "${newDish.name}" saved successfully.`);
  };

  // Handle Edit Dish directly in Supabase
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish) return;
    const trimmedName = formName.trim();
    const numericPrice = parseFloat(formPrice);

    if (!trimmedName) {
      showToast("Please enter a valid dish name.");
      return;
    }
    if (isNaN(numericPrice) || numericPrice <= 0) {
      showToast("Please enter a valid positive price.");
      return;
    }

    const prepMinutes = parseInt(String(formPrepTime).replace(/[^0-9]/g, "")) || 15;
    const formattedPrepTime = `${prepMinutes}m`;

    try {
      const supabase = createClient();
      const updatePayload: any = {
        name: trimmedName,
        category: formCategory,
        price: Math.round(numericPrice),
        prep_time: formattedPrepTime,
        preparation_time: prepMinutes,
        stock_status: formStockStatus,
        stock_count: parseInt(formStockCount) || 20,
        image_icon: null,
        is_popular: formIsPopular,
      };

      let { error } = await supabase
        .from("menu_items")
        .update(updatePayload)
        .eq("id", editingDish.id);

      if (error && error.message?.includes("preparation_time")) {
        delete updatePayload.preparation_time;
        const retry = await supabase
          .from("menu_items")
          .update(updatePayload)
          .eq("id", editingDish.id);
        error = retry.error;
      }

      if (error) {
        console.error("[MenuView] Supabase update error:", error);
        showToast(`Error updating dish: ${error.message}`);
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
      isPopular: formIsPopular,
      recipeCost: formRecipeCost,
      recipeMargin: formMarginPct,
      hasRecipe: formIngredients.length > 0,
    };

    setCatalog((prev) =>
      prev.map((d) => (d.id === updatedDish.id ? updatedDish : d))
    );
    if (onUpdateDish) {
      onUpdateDish(updatedDish);
    }
    setEditingDish(null);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/menu");
    }
    showToast(`Dish "${updatedDish.name}" updated with ${formIngredients.length} recipe ingredients.`);
  };

  // Manual In-Stock / Out-of-Stock Toggle Handler with Supabase Persistence & Recipe Guard
  const handleToggleAvailability = async (dish: MenuItem) => {
    const currentInStock = dish.stockStatus === "in_stock";
    const targetInStock = !currentInStock;

    // Guard: Cannot enable dish if raw materials are insufficient or zero
    if (targetInStock) {
      if (dish.isAutoOutOfStock) {
        const missingDetails =
          dish.missingIngredients && dish.missingIngredients.length > 0
            ? `: ${dish.missingIngredients.join(", ")}`
            : "";
        showToast(
          `Cannot enable dish: Insufficient raw material ingredients in inventory${missingDetails}`
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
            showToast(`Cannot enable "${dish.name}": Linked raw material(s) depleted (${names}).`);
            return;
          }
        }
      } catch (bomErr) {
        console.warn("[MenuView] Live recipe check warning:", bomErr);
      }
    }

    const targetDbStatus = targetInStock ? "in_stock" : "out_of_stock";
    const targetCount = targetInStock ? Math.max(1, dish.stockCount || 20) : 0;

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
      is_available: nextStatus === "in_stock",
      in_stock: nextStatus === "in_stock",
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
    showToast(`Dish "${dishToDelete.name}" removed.`);
    setDishToDelete(null);
  };

  // Filtered dishes list
  const filteredDishes = catalog.filter((dish) => {
    const matchCategory =
      selectedCategory === "all" ||
      dish.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchSearch =
      !searchQuery ||
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dish.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dish.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Dynamic Categories with live item counts for dropdown
  const categoriesList = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();

    // Seed predefined categories
    PREDEFINED_CATEGORIES.forEach((cat) => {
      map.set(cat.id.toLowerCase(), {
        id: cat.id,
        label: cat.label,
        count: 0,
      });
    });

    // Count and discover any additional categories in catalog
    catalog.forEach((dish) => {
      const catKey = (dish.category || "other").toLowerCase();
      if (map.has(catKey)) {
        map.get(catKey)!.count += 1;
      } else {
        const label = dish.category
          ? dish.category.charAt(0).toUpperCase() + dish.category.slice(1)
          : "Other";
        map.set(catKey, {
          id: catKey,
          label,
          count: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [catalog]);

  // Category counts
  const totalCount = catalog.length;
  const inStockCount = catalog.filter((i) => i.stockStatus === "in_stock").length;
  const lowStockCount = catalog.filter((i) => i.stockStatus === "low_stock").length;
  const outOfStockCount = catalog.filter((i) => i.stockStatus === "out_of_stock").length;

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
                  {formIngredients.map((item) => {
                    const costContrib = item.quantity_required * item.cost_per_unit;
                    return (
                      <tr key={item.raw_material_id} className="hover:bg-[var(--surface-hi)]/40 transition-colors">
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
                  <strong className={formMarginPct >= 40 ? "text-[#25d366]" : formMarginPct > 0 ? "text-amber-400" : "text-rose-400"}>
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

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            <UtensilsCrossed className="w-3.5 h-3.5" />
            DISH CATALOG &amp; MENU MATRIX
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Menu &amp; Live{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Stock Inventory
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Manage dish recipes, pricing, and live inventory availability.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openAddModal}
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
            <span className="text-[10px] text-[#25d366] uppercase font-semibold">IN STOCK</span>
            <div className="w-8 h-8 rounded-xl bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-[#25d366]">{inStockCount}</div>
          <span className="text-[10px] text-[#25d366] block font-semibold">Available for POS ordering</span>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-400 uppercase font-semibold">LOW STOCK</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-amber-400">{lowStockCount}</div>
          <span className="text-[10px] text-amber-400/80 block">Running low on threshold</span>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-400 uppercase font-semibold">86'D (SOLD OUT)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <X className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-display font-black text-rose-400">{outOfStockCount}</div>
          <span className="text-[10px] text-rose-400/80 block">Blocked from billing</span>
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

      {/* Menu Items Catalog Table */}
      <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-hi)]/80 text-[10.5px] font-mono text-[var(--text-faint)] uppercase whitespace-nowrap">
                <th className="py-3.5 px-4 font-bold">Dish Item</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Category</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Price (PKR)</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Recipe / Cost</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Prep Time</th>
                <th className="py-3.5 px-4 font-bold whitespace-nowrap">Stock Status</th>
                <th className="py-3.5 px-4 font-bold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {catalog.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--surface-hi)] border border-white/10 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-white tracking-wide mb-4">No menu items created yet</h3>
                      <button
                        type="button"
                        onClick={openAddModal}
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
                  <td colSpan={7} className="p-4">
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--surface-hi)] border border-white/10 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-white tracking-wide">No matching menu items</h3>
                      <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">No dishes matched your current search or category filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDishes.map((dish) => (
                  <tr key={dish.id} className="hover:bg-[var(--surface-hi)]/40 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <UtensilsCrossed className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[var(--text-hi)] block text-sm group-hover:text-[var(--gold)] transition-colors">
                              {dish.name}
                            </span>
                            {dish.isPopular && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 font-bold uppercase">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                <span>Popular</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--text-faint)] font-mono">ID: {dish.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono uppercase text-[var(--text-lo)] font-semibold text-[11px] whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] whitespace-nowrap">
                        {dish.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-extrabold text-sm text-[var(--gold)] whitespace-nowrap">
                      Rs {dish.price.toLocaleString()}
                    </td>
                    {/* Recipe / Cost & Margin (Clean text, no pill box) */}
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      {dish.hasRecipe && dish.recipeCost !== undefined ? (
                        <div className="flex flex-col gap-0.5 whitespace-nowrap">
                          <div className="text-xs font-bold text-[var(--text-hi)] flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-[10px] text-[var(--text-faint)] font-normal uppercase">Cost:</span>
                            <span className="whitespace-nowrap">Rs {dish.recipeCost.toFixed(0)}</span>
                          </div>
                          {dish.recipeMargin !== undefined && (
                            <div
                              className={`text-[10px] font-semibold whitespace-nowrap ${
                                dish.recipeMargin >= 50
                                  ? "text-emerald-400"
                                  : dish.recipeMargin >= 30
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }`}
                            >
                              Margin: {dish.recipeMargin.toFixed(0)}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--text-faint)] whitespace-nowrap">
                          No Recipe
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[var(--text-faint)] text-[11px] whitespace-nowrap">
                      ~{dish.prepTime || "15m"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1.5">
                        {/* Pure Enable / Disable Toggle Switch (No text) */}
                        <div className="flex items-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={dish.stockStatus === "in_stock" && !dish.isAutoOutOfStock}
                            onClick={() => handleToggleAvailability(dish)}
                            disabled={dish.isAutoOutOfStock}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40 focus:ring-offset-1 focus:ring-offset-[var(--bg-deep)] ${
                              dish.isAutoOutOfStock
                                ? "bg-zinc-800 border-zinc-700/60 opacity-50 cursor-not-allowed"
                                : dish.stockStatus === "in_stock"
                                ? "bg-emerald-500 hover:bg-emerald-400 cursor-pointer shadow-sm shadow-emerald-500/20"
                                : "bg-zinc-700 hover:bg-zinc-600 cursor-pointer"
                            }`}
                            title={
                              dish.isAutoOutOfStock
                                ? `Auto Out of Stock: Depleted ingredients (${dish.missingIngredients?.join(", ") || "Zero stock"})`
                                : dish.stockStatus === "in_stock"
                                ? "In Stock"
                                : "Disabled"
                            }
                          >
                            <span className="sr-only">Toggle Stock Status</span>
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                dish.stockStatus === "in_stock" && !dish.isAutoOutOfStock
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Recipe BOM Portions & Missing Ingredients Warnings */}
                        {dish.hasRecipe && (
                          <div className="text-[10px] font-mono">
                            {dish.isAutoOutOfStock ? (
                              <span
                                className="text-rose-400 font-semibold flex items-center gap-1"
                                title={dish.missingIngredients?.join(" | ")}
                              >
                                ⚠️ {dish.missingIngredients?.[0] || "Stock exhausted (0 portions)"}
                              </span>
                            ) : dish.maxPortions !== undefined && dish.maxPortions < Infinity ? (
                              <span className="text-[var(--text-faint)]">
                                Can make: <strong className="text-[var(--gold)] font-bold">{dish.maxPortions}</strong> portions
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Recipe / BOM Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenRecipe(dish)}
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-hi)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-[10.5px] font-mono font-semibold cursor-pointer transition-all shadow-sm inline-flex items-center gap-1.5"
                          title="View / Edit Recipe & Bill of Materials"
                        >
                          <ChefHat className="w-3.5 h-3.5 text-[var(--gold)]" />
                          <span>Recipe / BOM</span>
                        </button>

                        {/* Edit Dish Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(dish)}
                          className="p-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all cursor-pointer shadow-sm"
                          title="Edit Dish Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Dish Button */}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ADD NEW DISH MODAL */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDishModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface-hi)]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)] tracking-tight">Add New Dish</h3>
                  <p className="text-xs text-[var(--text-lo)] mt-0.5">
                    Create item in catalog, configure pricing and recipe BOM
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeDishModal()}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs font-sans custom-scrollbar">
                {/* Dish Name */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Dish Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Enter dish name"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  />
                </div>

                {/* Category & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Category <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                      >
                        {PREDEFINED_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Selling Price (Rs.) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--gold)] pointer-events-none">
                        Rs.
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        placeholder="0"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl pl-12 pr-3.5 py-2.5 text-xs text-[var(--text-hi)] font-mono font-bold text-[var(--gold)] focus:outline-none transition-all placeholder:text-[var(--text-lo)]/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Prep Time & Stock Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Prep Time
                    </label>
                    <input
                      type="text"
                      value={formPrepTime}
                      onChange={(e) => setFormPrepTime(e.target.value)}
                      placeholder="e.g. 15m"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Initial Status
                    </label>
                    <div className="relative">
                      <select
                        value={formStockStatus}
                        onChange={(e) => setFormStockStatus(e.target.value as any)}
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                      >
                        <option value="in_stock" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">In Stock</option>
                        <option value="low_stock" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Low Stock</option>
                        <option value="out_of_stock" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Out of Stock</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Description / Ingredients Summary
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of flavors, toppings, or allergens..."
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl p-3.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans resize-none"
                  />
                </div>

                {/* Recipe BOM Section */}
                {renderRecipeSection()}
              </div>

              {/* Action Buttons Footer */}
              <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border)] flex items-center justify-end gap-2.5 shrink-0 bg-[var(--bg-deep)]">
                <button
                  type="button"
                  onClick={() => closeDishModal()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
                >
                  Add Dish to Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EDIT DISH MODAL */}
      {/* ========================================================================= */}
      {editingDish && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDishModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface-hi)]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)] tracking-tight">Edit Dish Details</h3>
                  <p className="text-xs text-[var(--text-lo)] mt-0.5">ID: {editingDish.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeDishModal()}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs font-sans custom-scrollbar">
                {/* Dish Name */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Dish Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Enter dish name"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  />
                </div>

                {/* Category & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Category <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                      >
                        {PREDEFINED_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Selling Price (Rs.) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--gold)] pointer-events-none">
                        Rs.
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        placeholder="0"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl pl-12 pr-3.5 py-2.5 text-xs text-[var(--text-hi)] font-mono font-bold text-[var(--gold)] focus:outline-none transition-all placeholder:text-[var(--text-lo)]/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Prep Time & Stock Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Prep Time
                    </label>
                    <input
                      type="text"
                      value={formPrepTime}
                      onChange={(e) => setFormPrepTime(e.target.value)}
                      placeholder="e.g. 15m"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Manual Status
                    </label>
                    <div className="relative">
                      <select
                        value={formStockStatus}
                        onChange={(e) => setFormStockStatus(e.target.value as any)}
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                      >
                        <option value="in_stock" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">In Stock</option>
                        <option value="low_stock" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Low Stock</option>
                        <option value="out_of_stock" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Out of Stock</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Description / Ingredients Summary
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of flavors, toppings, or allergens..."
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl p-3.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans resize-none"
                  />
                </div>

                {/* Recipe BOM Section */}
                {renderRecipeSection()}
              </div>

              {/* Action Buttons Footer */}
              <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border)] flex items-center justify-end gap-2.5 shrink-0 bg-[var(--bg-deep)]">
                <button
                  type="button"
                  onClick={() => closeDishModal()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              Are you sure you want to delete <strong className="text-[var(--text-hi)]">{dishToDelete.name}</strong> ({dishToDelete.id})? This will immediately remove it from all POS counters, KDS stations, and digital menu lists.
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
    </div>
  );
}
