"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Plus,
  Download,
  Store,
  Check,
  Sliders,
  FileText,
  CreditCard,
  X,
  ChevronDown,
  Star,
  Percent,
  ArrowLeft,
  Loader2,
  Calendar,
  Trash2,
  Building2,
  Layers,
  DollarSign,
  Tag,
  Clock,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { usePlatformCurrency, formatCurrencyPrice, getPlatformCurrency } from "@/lib/currency";

interface PlanTierItem {
  id: string;
  dbId?: number | string;
  name: string;
  tagline: string;
  subtitle: string;
  desc: string;
  price: string;
  rawPrice: number;
  pricingModel: "flat" | "per_branch";
  pricing_model?: "flat" | "per_branch";
  period: string;
  rawInterval: string;
  annualPrice: string;
  discountPercent: number;
  customDuration?: string;
  subscribers: number;
  isFeatured: boolean;
  badge: string;
  features: string[];
}

function parsePlanInterval(intervalStr?: string) {
  const raw = String(intervalStr || "Monthly").trim();
  
  // Extract discount percentage e.g. "Annual (Save 20%)", "20%", "Annual (25% OFF)"
  const discountMatch = raw.match(/(\d+)\s*%/);
  const discountPercent = discountMatch ? parseInt(discountMatch[1], 10) : (raw.toLowerCase().includes("annual") ? 17 : 17);

  // Extract custom days e.g. "Custom (14 Days)", "30 Days"
  const daysMatch = raw.match(/(\d+)\s*days?/i);
  const customDays = daysMatch ? daysMatch[1] : null;

  return {
    raw,
    discountPercent,
    customDays,
    isCustom: Boolean(daysMatch) || raw.toLowerCase().includes("custom"),
    isAnnual: raw.toLowerCase().includes("annual"),
  };
}

// Helper to extract pricing model and clean tagline / description
function parsePlanModelAndTagline(dbPlan: {
  numeric_limit?: string;
  pricing_model?: string;
  tagline?: string;
  description?: string;
  desc?: string;
  subtitle?: string;
}): { model: "flat" | "per_branch"; desc: string } {
  const numLimit = String(dbPlan.numeric_limit || "").trim();
  const rawModel = String(dbPlan.pricing_model || "").trim().toLowerCase();

  let model: "flat" | "per_branch" = "flat";

  if (rawModel === "per_branch" || rawModel === "per-branch") {
    model = "per_branch";
  } else if (
    numLimit.startsWith("[per_branch]") ||
    numLimit.startsWith("[per-branch]") ||
    numLimit.startsWith("[branch]") ||
    numLimit.toLowerCase().includes("pricing_model:per_branch") ||
    numLimit.toLowerCase().includes("per-branch") ||
    numLimit.toLowerCase().includes("per branch") ||
    (numLimit.toLowerCase().includes("branch") && !numLimit.toLowerCase().includes("single"))
  ) {
    model = "per_branch";
  }

  // Extract clean description by removing prefix tag like [per_branch] or [flat]
  let cleanDesc = String(dbPlan.desc || dbPlan.tagline || dbPlan.description || dbPlan.subtitle || "").trim();
  if (cleanDesc) {
    cleanDesc = cleanDesc.replace(/^\[(per_branch|per-branch|branch|flat)\]\s*/i, "").trim();
  }

  if (!cleanDesc && numLimit) {
    cleanDesc = numLimit.replace(/^\[(per_branch|per-branch|branch|flat)\]\s*/i, "").trim();
  }

  if (!cleanDesc) {
    cleanDesc = model === "per_branch"
      ? "Per-branch scaled SaaS access & multi-terminal cloud suite"
      : "Full platform SaaS access & multi-device POS management";
  }

  return { model, desc: cleanDesc };
}

function encodePlanNumericLimit(model: "flat" | "per_branch", tagline?: string): string {
  const clean = String(tagline || "")
    .replace(/^\[(per_branch|per-branch|branch|flat)\]\s*/i, "")
    .trim();
  const defaultText = model === "per_branch" ? "Per-branch scaled SaaS access & multi-terminal cloud suite" : "Full platform SaaS access & multi-device POS management";
  const tagText = clean || defaultText;
  return `[${model}] ${tagText}`;
}

// Helper to convert DB plan row to UI format
function mapDbPlanToUi(dbPlan: any, customSymbol?: string): PlanTierItem {
  const numPrice = Number(dbPlan.rawPrice !== undefined ? dbPlan.rawPrice : (dbPlan.price || 0));
  const formattedPrice = formatCurrencyPrice(numPrice, customSymbol);
  const rawInterval = String(dbPlan.rawInterval || dbPlan.interval || "Monthly").trim();
  const { raw, discountPercent, customDays, isAnnual } = parsePlanInterval(rawInterval);

  const discountMultiplier = Math.max(0, (100 - discountPercent) / 100);
  const annualDiscounted = Math.round(numPrice * discountMultiplier);
  const formattedAnnual = formatCurrencyPrice(annualDiscounted, customSymbol);

  const { model, desc } = parsePlanModelAndTagline(dbPlan);

  const featArr = Array.isArray(dbPlan.features)
    ? dbPlan.features
    : typeof dbPlan.features === "string" && dbPlan.features.trim()
    ? dbPlan.features.split("\n").filter((f: string) => f.trim())
    : [
        model === "per_branch" ? "Per-Branch Scaled Access" : "Full Platform License",
        "Omnibites Cloud POS",
        "High-Speed Billing Terminal",
        "Thermal Receipt Printing",
      ];

  const isPopular = Boolean(dbPlan.is_popular || dbPlan.isFeatured);

  return {
    id: `db-${dbPlan.dbId || dbPlan.id}`,
    dbId: dbPlan.dbId || dbPlan.id,
    name: dbPlan.name,
    tagline: desc,
    subtitle: desc,
    desc: desc,
    price: formattedPrice,
    rawPrice: numPrice,
    pricingModel: model,
    pricing_model: model,
    period: customDays
      ? `/ ${customDays} days`
      : model === "per_branch"
      ? "/ branch / month"
      : "/ month",
    rawInterval: raw,
    annualPrice: customDays
      ? `Billed every ${customDays} Days`
      : isAnnual
      ? `Billed annually (Save ${discountPercent}%)`
      : `Billed Monthly`,
    discountPercent,
    customDuration: customDays ? `${customDays} Days` : undefined,
    subscribers: 0,
    isFeatured: isPopular,
    badge: isPopular ? "Most Popular" : (model === "per_branch" ? "Per Branch" : "Flat Rate"),
    features: featArr,
  };
}

export default function SubscriptionsPlansView({
  showToast,
  initialMode,
}: {
  showToast: (msg: string) => void;
  initialMode?: "new" | "edit" | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currency, symbol, formatPrice } = usePlatformCurrency();

  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<number | string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isBillingDropdownOpen, setIsBillingDropdownOpen] = useState(false);
  
  // Annual discount modal state
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [annualDiscount, setAnnualDiscount] = useState("");
  const [tempDiscount, setTempDiscount] = useState("");

  // Custom days calendar modal state
  const [isCustomDaysModalOpen, setIsCustomDaysModalOpen] = useState(false);
  const [customDays, setCustomDays] = useState("");
  const [tempCustomDays, setTempCustomDays] = useState("");

  // Feature entitlements interactive state
  const [featureInput, setFeatureInput] = useState("");
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);

  // Delete modal state
  const [planToDelete, setPlanToDelete] = useState<PlanTierItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [tierPlans, setTierPlans] = useState<PlanTierItem[]>([]);

  const [newPlan, setNewPlan] = useState({
    name: "",
    tagline: "",
    pricingModel: "flat" as "flat" | "per_branch",
    price: "",
    billing: "Monthly",
    isFeatured: false,
  });

  const CACHE_KEY = "omni_published_plans";

  const broadcastPlanUpdates = (updatedPlans?: PlanTierItem[]) => {
    try {
      if (typeof window !== "undefined") {
        const now = String(Date.now());
        localStorage.setItem("omni_plans_updated_at", now);
        if (updatedPlans && Array.isArray(updatedPlans)) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(updatedPlans));
        }
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("omni_plans_updated", { detail: { timestamp: now, plans: updatedPlans } })
          );
          if ("BroadcastChannel" in window) {
            const bc = new BroadcastChannel("omni_plans_sync");
            bc.postMessage({ type: "PLANS_UPDATED", timestamp: now, plans: updatedPlans });
            bc.close();
          }
        }, 0);
      }
    } catch (e) {
      console.warn("Cross-tab sync notification failed:", e);
    }
  };

  const savePlansToLocalStorage = (plans: PlanTierItem[]) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(CACHE_KEY, JSON.stringify(plans));
      }
    } catch (e) {
      console.warn("Failed to write plans to localStorage:", e);
    }
  };

  const getPlansFromLocalStorage = (): PlanTierItem[] | null => {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (e) {
      console.warn("Failed to read plans from localStorage:", e);
    }
    return null;
  };

  // Load plans from Supabase / localStorage and subscribe to Realtime updates
  useEffect(() => {
    // 1. Instant check in localStorage for instant UI without loading spinner
    const cached = getPlansFromLocalStorage();
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setTierPlans(cached);
      setIsLoadingPlans(false);
    }

    async function loadPlans(forceLoading = false) {
      if (forceLoading) setIsLoadingPlans(true);
      try {
        const res = await fetch(`/api/super-admin/plans?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Pragma": "no-cache",
            "Cache-Control": "no-cache",
          },
        });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.plans) && json.plans.length > 0) {
            const dbTiers = json.plans.map(mapDbPlanToUi);
            setTierPlans(dbTiers);
            savePlansToLocalStorage(dbTiers);
          }
        }
      } catch (err) {
        console.warn("Failed to load plans from server:", err);
      } finally {
        setIsLoadingPlans(false);
      }
    }

    if (!cached || cached.length === 0) {
      loadPlans(true);
    } else {
      loadPlans(false);
    }

    // BroadcastChannel and storage listeners for instant updates
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("omni_plans_sync");
        bc.onmessage = (event) => {
          if (event.data?.type === "PLANS_UPDATED") {
            loadPlans(false);
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel init failed:", e);
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "omni_plans_updated_at" || e.key === "subscription_plans") {
        loadPlans(false);
      }
    };
    const handleCustomEvent = () => loadPlans(false);

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("omni_plans_updated", handleCustomEvent);

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("omni_plans_updated", handleCustomEvent);
    };
  }, []);

  const handleOpenCreatePlan = (updateUrl = true) => {
    setEditingPlanId(null);
    setNewPlan({
      name: "",
      tagline: "",
      pricingModel: "flat",
      price: "",
      billing: "Monthly",
      isFeatured: false,
    });
    setAnnualDiscount("");
    setTempDiscount("");
    setCustomDays("");
    setTempCustomDays("");
    setPlanFeatures([]);
    setFeatureInput("");
    setIsCreatingPlan(true);
    if (updateUrl && typeof window !== "undefined") {
      window.history.pushState(null, "", "/super-admin/subscriptions&plans/new");
    }
  };

  const handleOpenEditPlan = (tier: PlanTierItem, updateUrl = true) => {
    const rawId = tier.dbId || String(tier.id || "").replace(/^db-/, "");
    const numPrice = tier.rawPrice !== undefined ? String(tier.rawPrice) : tier.price.replace(/[^0-9]/g, "");
    const billingVal = tier.rawInterval || "Monthly";

    setEditingPlanId(rawId);
    setNewPlan({
      name: tier.name,
      tagline: tier.desc || tier.tagline || tier.subtitle || "",
      pricingModel: tier.pricingModel || "flat",
      price: numPrice,
      billing: billingVal,
      isFeatured: tier.isFeatured,
    });

    if (billingVal.toLowerCase().includes("days") || billingVal.toLowerCase().includes("custom")) {
      const daysMatch = billingVal.match(/\d+/);
      if (daysMatch) {
        setCustomDays(daysMatch[0]);
        setTempCustomDays(daysMatch[0]);
      }
    }

    const discountMatch = billingVal.match(/(\d+)\s*%/);
    if (discountMatch) {
      setAnnualDiscount(discountMatch[1]);
      setTempDiscount(discountMatch[1]);
    } else if (billingVal.toLowerCase().includes("annual")) {
      setAnnualDiscount("17");
      setTempDiscount("17");
    }

    setPlanFeatures([...tier.features]);
    setFeatureInput("");
    setIsCreatingPlan(true);
    if (updateUrl && typeof window !== "undefined") {
      window.history.pushState(null, "", `/super-admin/subscriptions&plans/edit?id=${rawId}`);
    }
  };

  const handleClosePlanForm = () => {
    setIsCreatingPlan(false);
    setEditingPlanId(null);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/super-admin/subscriptions&plans");
    }
  };

  const initialHandledRef = React.useRef(false);

  // Watch initial mount only
  useEffect(() => {
    if (initialHandledRef.current) return;
    initialHandledRef.current = true;

    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    const search = window.location.search;
    const params = new URLSearchParams(search);

    if (path.endsWith("/new") || initialMode === "new") {
      setIsCreatingPlan(true);
      setEditingPlanId(null);
    } else if (path.endsWith("/edit") || initialMode === "edit") {
      const idParam = params.get("id");
      if (idParam && tierPlans.length > 0) {
        const found = tierPlans.find(
          (t) => String(t.dbId) === String(idParam) || t.id === `db-${idParam}` || t.id === idParam
        );
        if (found) {
          handleOpenEditPlan(found, false);
          return;
        }
      }
      setIsCreatingPlan(true);
    }
  }, [initialMode]);

  // Watch browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname;
      const search = window.location.search;
      const params = new URLSearchParams(search);

      if (path.endsWith("/new")) {
        setIsCreatingPlan(true);
        setEditingPlanId(null);
      } else if (path.endsWith("/edit")) {
        const idParam = params.get("id");
        if (idParam && tierPlans.length > 0) {
          const found = tierPlans.find(
            (t) => String(t.dbId) === String(idParam) || t.id === `db-${idParam}` || t.id === idParam
          );
          if (found) {
            handleOpenEditPlan(found, false);
            return;
          }
        }
        setIsCreatingPlan(true);
      } else {
        setIsCreatingPlan(false);
        setEditingPlanId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [tierPlans]);

  const handleApplyDiscount = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = tempDiscount.trim() || "17";
    setAnnualDiscount(val);
    setNewPlan({ ...newPlan, billing: `Annual (Save ${val}%)` });
    showToast(`Annual discount set to ${val}%`);
    setIsDiscountModalOpen(false);
  };

  const handleApplyCustomDays = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = tempCustomDays.trim() || "14";
    setCustomDays(val);
    setNewPlan({ ...newPlan, billing: `Custom (${val} Days)` });
    showToast(`Custom validity period set to ${val} Days`);
    setIsCustomDaysModalOpen(false);
  };

  const handleAddFeature = (textToAdd?: string) => {
    const feat = (textToAdd || featureInput).trim();
    if (!feat) return;
    if (!planFeatures.includes(feat)) {
      setPlanFeatures((prev) => [...prev, feat]);
    }
    setFeatureInput("");
  };

  const handleRemoveFeature = (indexToRemove: number) => {
    setPlanFeatures((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Delete plan handler from Supabase and sessionStorage
  const handleConfirmDelete = async () => {
    if (!planToDelete || isDeleting) return;
    setIsDeleting(true);

    const rawId = planToDelete.dbId || String(planToDelete.id || "").replace(/^db-/, "");
    const numericId = parseInt(String(rawId), 10);

    try {
      // Call server API route with secret key for guaranteed backend deletion in Supabase
      const res = await fetch(`/api/super-admin/plans?id=${numericId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: numericId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete plan from database");
      }

      // Update React state and localStorage immediately in real-time
      const updatedAfterDelete = tierPlans.filter(
        (t) => t.id !== planToDelete.id && t.dbId !== numericId && t.id !== `db-${numericId}`
      );
      setTierPlans(updatedAfterDelete);
      savePlansToLocalStorage(updatedAfterDelete);
      broadcastPlanUpdates(updatedAfterDelete);

      // Ensure we stay on the plans listing view
      setIsCreatingPlan(false);
      setEditingPlanId(null);
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path.includes("/new") || path.includes("/edit")) {
          window.history.replaceState(null, "", "/super-admin/subscriptions&plans");
        }
      }

      showToast(`Plan "${planToDelete.name}" deleted successfully!`);
      setPlanToDelete(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete plan";
      showToast(`Error: ${errMsg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Keyboard shortcut: Press Enter to confirm delete when modal is open
  useEffect(() => {
    if (!planToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmDelete();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (!isDeleting) setPlanToDelete(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [planToDelete, isDeleting]);

  const handleCreatePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPlan.name.trim()) {
      showToast("Please enter a plan name");
      return;
    }
    if (isSaving) return;

    setIsSaving(true);

    const defaultFeatures = newPlan.pricingModel === "per_branch"
      ? ["Per-Branch Scaled POS License", "Omnibites Cloud POS Suite", "Multi-Station KDS Routing", "Dedicated Priority Support"]
      : ["Full Platform SaaS License", "Omnibites Cloud POS Suite", "High-Speed Billing Terminal", "Dedicated Priority Support"];

    const featuresList = planFeatures.length > 0 ? [...planFeatures] : defaultFeatures;
    const numericPrice = parseInt(String(newPlan.price || 0).replace(/[^0-9]/g, ""), 10) || 0;
    const userTagline = newPlan.tagline.trim();
    const encodedNumericLimit = encodePlanNumericLimit(newPlan.pricingModel, userTagline);

    try {
      const isEditing = Boolean(editingPlanId);
      const url = "/api/super-admin/plans";
      const method = isEditing ? "PUT" : "POST";
      const payload: Record<string, unknown> = {
        name: newPlan.name.trim(),
        tagline: userTagline,
        pricing_model: newPlan.pricingModel,
        unit_price: numericPrice,
        price: numericPrice,
        interval: newPlan.billing,
        numeric_limit: encodedNumericLimit,
        features: featuresList.join("\n"),
        is_popular: newPlan.isFeatured,
      };

      if (isEditing) {
        payload.id = editingPlanId;
      }

      // Call server API route with secret key for guaranteed backend persistence in Supabase
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.plan) {
        throw new Error(result.error || "Unable to save plan in database");
      }
      const savedDbPlan = result.plan;

      // 3. Update React state and localStorage with the saved plan
      if (savedDbPlan) {
        const savedPlan = mapDbPlanToUi(savedDbPlan);
        let updatedPlansList: PlanTierItem[];
        if (isEditing) {
          updatedPlansList = tierPlans.map((t) =>
            t.id === `db-${savedDbPlan.id}` || t.dbId === savedDbPlan.id ? savedPlan : t
          );
        } else {
          updatedPlansList = [...tierPlans, savedPlan];
        }
        setTierPlans(updatedPlansList);
        savePlansToLocalStorage(updatedPlansList);
        broadcastPlanUpdates(updatedPlansList);
      }

      showToast(
        isEditing
          ? `Plan "${newPlan.name}" updated successfully!`
          : `Plan "${newPlan.name}" successfully published & saved!`
      );

      // Reset form and return to plans view
      setNewPlan({
        name: "",
        tagline: "",
        pricingModel: "flat",
        price: "",
        billing: "Monthly",
        isFeatured: false,
      });
      setAnnualDiscount("");
      setTempDiscount("");
      setCustomDays("");
      setTempCustomDays("");
      setPlanFeatures([]);
      setFeatureInput("");
      setEditingPlanId(null);
      setIsCreatingPlan(false);
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", "/super-admin/subscriptions&plans");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error saving plan";
      showToast(`Failed: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ===================== FULL PAGE VIEW: CREATE / EDIT PLAN =====================
  if (isCreatingPlan) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 pb-12 md:pb-6 w-full max-w-full min-w-0">
        {/* Page Heading with Back Icon Button */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <button
              type="button"
              onClick={handleClosePlanForm}
              className="p-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer group shrink-0"
              title="Back to Subscriptions & Plans"
              aria-label="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-[11px] font-semibold uppercase tracking-wider">
              <CreditCard className="w-3.5 h-3.5" />
              {editingPlanId ? "Plan Tier Editor" : "Platform Plan Builder"}
            </div>
          </div>

          <h1 className="font-bold text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            {editingPlanId ? "Edit Platform " : "Create Platform "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Plan Tier</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            {editingPlanId
              ? "Modify SaaS tier pricing model, rates, billing frequency, and feature entitlements for this plan."
              : "Configure SaaS tier pricing structure, billing frequency, and feature entitlements for restaurant merchants."}
          </p>
        </div>

        {/* Main Form Container */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 w-full border border-[var(--border)] shadow-xl space-y-6">
          <form onSubmit={handleCreatePlan} className="space-y-6 text-xs font-sans">
            {/* 1. Plan Identity: Name & Tagline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-[var(--gold)]" />
                  <span>Plan Name</span>
                  <span className="text-[var(--gold)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="e.g. Starter, Professional, Enterprise Plus"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-[var(--gold)]" />
                  <span>Plan Tagline / Subtitle</span>
                </label>
                <input
                  type="text"
                  value={newPlan.tagline}
                  onChange={(e) => setNewPlan({ ...newPlan, tagline: e.target.value })}
                  placeholder="e.g. Best for growing multi-location franchises & cloud kitchens"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 2. Pricing Model Selector */}
            <div className="space-y-2">
              <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-[var(--gold)]" />
                <span>Pricing Model</span>
                <span className="text-[var(--gold)]">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Flat Rate Card */}
                <button
                  type="button"
                  onClick={() => setNewPlan({ ...newPlan, pricingModel: "flat" })}
                  className={`flex items-start gap-3 p-4 rounded-2xl text-left transition-all cursor-pointer border ${
                    newPlan.pricingModel === "flat"
                      ? "bg-[var(--gold-dim)]/50 border-[var(--gold)] shadow-lg shadow-[var(--gold-glow)]"
                      : "bg-[var(--surface-hi)] border-[var(--border)] hover:border-[var(--gold)]/50 hover:bg-[var(--surface)] text-[var(--text-lo)]"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      newPlan.pricingModel === "flat"
                        ? "bg-gradient-to-br from-[#f5c85c] to-[#e3b13b] text-[#342c14] shadow-md shadow-[var(--gold-glow)]"
                        : "bg-[var(--bg-deep)] text-[var(--text-lo)] border border-[var(--border)]"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--text-hi)]">
                        Flat Rate
                      </span>
                      {newPlan.pricingModel === "flat" && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14] font-bold">
                          <Check className="w-2.5 h-2.5" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-lo)] mt-0.5 leading-snug">
                      Single fixed recurring price across all outlets and organization branches.
                    </p>
                  </div>
                </button>

                {/* Per-Branch Scaled Pricing Card */}
                <button
                  type="button"
                  onClick={() => setNewPlan({ ...newPlan, pricingModel: "per_branch" })}
                  className={`flex items-start gap-3 p-4 rounded-2xl text-left transition-all cursor-pointer border ${
                    newPlan.pricingModel === "per_branch"
                      ? "bg-[var(--gold-dim)]/50 border-[var(--gold)] shadow-lg shadow-[var(--gold-glow)]"
                      : "bg-[var(--surface-hi)] border-[var(--border)] hover:border-[var(--gold)]/50 hover:bg-[var(--surface)] text-[var(--text-lo)]"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      newPlan.pricingModel === "per_branch"
                        ? "bg-gradient-to-br from-[#f5c85c] to-[#e3b13b] text-[#342c14] shadow-md shadow-[var(--gold-glow)]"
                        : "bg-[var(--bg-deep)] text-[var(--text-lo)] border border-[var(--border)]"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--text-hi)]">
                        Per-Branch Scaled Pricing
                      </span>
                      {newPlan.pricingModel === "per_branch" && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14] font-bold">
                          <Check className="w-2.5 h-2.5" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-lo)] mt-0.5 leading-snug">
                      Dynamic unit rate billed per active branch / outlet location.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Pricing & Billing Frequency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3 text-[var(--gold)]" />
                  <span>
                    {newPlan.pricingModel === "per_branch"
                      ? `Unit Price per Branch (${symbol})`
                      : `Base Price / Flat Rate (${symbol})`}
                  </span>
                  <span className="text-[var(--gold)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[var(--gold)] text-sm pointer-events-none">
                    {symbol}
                  </span>
                  <input
                    type="text"
                    required
                    value={newPlan.price}
                    onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value.replace(/^[^\d]*/, "") })}
                    placeholder="0"
                    className={`w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pr-4 py-2.5 text-sm font-semibold text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all ${
                      symbol.length > 2 ? (symbol.endsWith(".") ? "pl-[38px]" : "pl-[42px]") : symbol.length === 2 ? "pl-[32px]" : "pl-[26px]"
                    }`}
                  />
                </div>
                <span className="text-[10.5px] text-[var(--text-lo)] block">
                  {newPlan.price ? (
                    <>
                      Calculated as{" "}
                      <strong className="text-[var(--gold)]">
                        {formatPrice(newPlan.price)}
                        {newPlan.pricingModel === "per_branch" ? " / branch" : ""}
                        {newPlan.billing.toLowerCase().includes("annual") ? " / mo (annual)" : ` / ${newPlan.billing.toLowerCase()}`}
                      </strong>
                    </>
                  ) : (
                    newPlan.pricingModel === "per_branch"
                      ? `Enter the unit rate in ${currency} charged for each restaurant branch`
                      : `Enter the fixed flat rate in ${currency} for the entire subscription`
                  )}
                </span>
              </div>

              <div className="space-y-1.5 relative">
                <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[var(--gold)]" />
                  <span>Billing Frequency</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsBillingDropdownOpen(!isBillingDropdownOpen)}
                    className="w-full flex items-center justify-between bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] cursor-pointer text-left transition-all"
                  >
                    <span className="truncate">
                      {newPlan.billing === "Annual"
                        ? (annualDiscount ? `Annual (Save ${annualDiscount}%)` : "Annual (Save 17%)")
                        : newPlan.billing}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${
                        isBillingDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
                      }`}
                    />
                  </button>

                  {isBillingDropdownOpen && (
                    <div className="absolute left-0 top-[calc(100%+6px)] w-full bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl p-1.5 shadow-2xl z-50 space-y-1 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setNewPlan({ ...newPlan, billing: "Monthly" });
                          setIsBillingDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                          newPlan.billing === "Monthly"
                            ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                        }`}
                      >
                        <span>Monthly</span>
                        {newPlan.billing === "Monthly" && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsBillingDropdownOpen(false);
                          setTempDiscount(annualDiscount || "");
                          setIsDiscountModalOpen(true);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                          newPlan.billing === "Annual" || newPlan.billing.startsWith("Annual")
                            ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Annual</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 font-semibold">
                            {annualDiscount ? `Save ${annualDiscount}%` : "Save %"}
                          </span>
                        </div>
                        {(newPlan.billing === "Annual" || newPlan.billing.startsWith("Annual")) && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Feature Entitlements Builder (Interactive Tag/Pill Builder) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[var(--gold)]" />
                  <span>Feature Entitlements Builder</span>
                </label>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--gold)] font-semibold">
                  {planFeatures.length} {planFeatures.length === 1 ? "feature" : "features"} configured
                </span>
              </div>

              {/* Tag Input Field: Press Enter or Click Add */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                  placeholder="Type a feature entitlement and press Enter (e.g. Multi-Station KDS Routing)..."
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleAddFeature()}
                  className="btn-gold px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Active feature tags / pills */}
              {planFeatures.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1 max-h-56 overflow-y-auto pr-1">
                  {planFeatures.map((feat, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 py-1.5 px-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/60 transition-all animate-in fade-in zoom-in-95 duration-150 group"
                    >
                      <Check className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                      <span className="text-xs text-[var(--text-hi)] font-medium">
                        {feat}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-0.5 rounded-md text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer shrink-0 ml-0.5"
                        title="Remove feature"
                        aria-label={`Remove ${feat}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[var(--surface-hi)]/50 border border-dashed border-[var(--border)] text-center text-[11px] text-[var(--text-faint)]">
                  No feature entitlements added yet. Type above and press Enter, or choose from the quick suggestions below.
                </div>
              )}

              {/* Quick Feature Suggestions */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase text-[var(--text-faint)] font-semibold tracking-wider block">
                  Quick Feature Suggestions (click to add):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Multi-Station KDS Routing",
                    "Thermal Receipt Printing",
                    "Unlimited Staff Logins",
                    "Delivery & Rider Dispatch",
                    "Daily End-of-Day Sales Report",
                    "Customer Loyalty & CRM",
                    "24/7 Priority WhatsApp Support",
                    "Inventory & Recipe Costing",
                    "Custom Floor Plan Layouts",
                  ].map((sugg) => {
                    const isAdded = planFeatures.includes(sugg);
                    return (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => handleAddFeature(sugg)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                          isAdded
                            ? "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/40 font-bold opacity-60 cursor-default"
                            : "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--text-hi)]"
                        }`}
                        disabled={isAdded}
                      >
                        {isAdded ? `✓ ${sugg}` : `+ ${sugg}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5. Most Popular Star Checkbox */}
            <label className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/60 transition-all cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={newPlan.isFeatured}
                onChange={(e) => setNewPlan({ ...newPlan, isFeatured: e.target.checked })}
                className="hidden"
              />
              <div
                className={`w-6 h-6 rounded-xl flex items-center justify-center border transition-all ${
                  newPlan.isFeatured
                    ? "bg-gradient-to-br from-[#f5c85c] to-[#e3b13b] border-[var(--gold)] text-[#342c14] shadow-md shadow-[var(--gold-glow)]"
                    : "border-[var(--border-hi)] bg-[var(--bg-deep)] text-[var(--text-faint)] group-hover:border-[var(--gold)]"
                }`}
              >
                <Star className={`w-4 h-4 ${newPlan.isFeatured ? "fill-[#342c14]" : ""}`} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-[var(--text-hi)]">
                    Mark as Most Popular Tier
                  </span>
                  {newPlan.isFeatured && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#f5c85c] to-[#e3b13b] text-[#342c14] font-bold shadow-sm uppercase tracking-wider animate-in fade-in zoom-in-95">
                      ★ Most Popular
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--text-lo)] leading-tight mt-0.5">
                  Highlights this plan with a prominent golden badge across the platform pricing grid.
                </span>
              </div>
            </label>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleClosePlanForm}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] text-xs font-semibold hover:text-[var(--text-hi)] cursor-pointer transition-colors disabled:opacity-50 text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto btn-gold px-6 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingPlanId ? "Update Plan Tier" : "Publish Plan Tier"}</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ===================== ANNUAL DISCOUNT PERCENTAGE POPUP ===================== */}
        {isDiscountModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsDiscountModalOpen(false)}
            />

            <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-[var(--bg-deep)] border border-[var(--gold)]/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 z-10 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center">
                    <Percent className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-[var(--text-hi)]">
                      Annual Discount %
                    </h4>
                    <p className="text-[11px] text-[var(--text-lo)]">
                      Set annual billing discount percentage
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="p-1 rounded-lg text-[var(--text-lo)] hover:text-[var(--text-hi)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyDiscount} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                    Discount Percentage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={tempDiscount}
                      onChange={(e) => setTempDiscount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyDiscount();
                        }
                      }}
                      placeholder="e.g. 17"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-4 pr-10 py-2.5 text-base font-bold text-[var(--gold)] focus:outline-none"
                      autoFocus
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-[var(--gold)] text-base">
                      %
                    </span>
                  </div>
                </div>

                {/* Quick Percentage Presets */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] text-[var(--text-faint)] uppercase font-semibold tracking-wider">
                    Quick Presets
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["10", "15", "17", "20", "25", "30"].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTempDiscount(pct)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                          tempDiscount === pct
                            ? "btn-gold shadow-sm border-white/30"
                            : "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--text-hi)]"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Badge */}
                <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs flex items-center justify-between">
                  <span className="text-[var(--text-lo)]">Display Text:</span>
                  <span className="font-semibold text-[var(--gold)]">
                    {tempDiscount ? `Save ${tempDiscount}%` : "e.g. Save 17%"}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsDiscountModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] text-xs font-semibold hover:text-[var(--text-hi)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    Apply %
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== CUSTOM DAYS CALENDAR POPUP ===================== */}
        {isCustomDaysModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsCustomDaysModalOpen(false)}
            />

            <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-[var(--bg-deep)] border border-[var(--gold)]/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 z-10 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-[var(--text-hi)]">
                      Custom Duration (Days)
                    </h4>
                    <p className="text-[11px] text-[var(--text-lo)]">
                      Set custom validity or billing period
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomDaysModalOpen(false)}
                  className="p-1 rounded-lg text-[var(--text-lo)] hover:text-[var(--text-hi)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyCustomDays} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                    Custom Duration (Days)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={tempCustomDays}
                      onChange={(e) => setTempCustomDays(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyCustomDays();
                        }
                      }}
                      placeholder="e.g. 14"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-4 pr-14 py-2.5 text-base font-bold text-[var(--gold)] focus:outline-none"
                      autoFocus
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-[var(--gold)] text-xs uppercase">
                      Days
                    </span>
                  </div>
                </div>

                {/* Quick Days Presets */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] text-[var(--text-faint)] uppercase font-semibold tracking-wider">
                    Quick Presets
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["7", "14", "30", "45", "60", "90", "180", "365"].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setTempCustomDays(days)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                          tempCustomDays === days
                            ? "btn-gold shadow-sm border-white/30"
                            : "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--text-hi)]"
                        }`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Badge */}
                <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs flex items-center justify-between">
                  <span className="text-[var(--text-lo)]">Display Text:</span>
                  <span className="font-semibold text-[var(--gold)]">
                    {tempCustomDays ? `${tempCustomDays} Days` : "e.g. 14 Days"}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsCustomDaysModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] text-xs font-semibold hover:text-[var(--text-hi)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    Apply Days
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===================== DEFAULT VIEW: SUBSCRIPTIONS & PLANS LISTING =====================
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 w-full max-w-full min-w-0">
      {/* 1. Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full min-w-0">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-[11px] font-semibold uppercase tracking-wider mb-2 max-w-full">
            <Sparkles className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
            <span className="truncate">Omnibites Billing &amp; Licensing</span>
          </div>
          <h1 className="font-bold text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Subscriptions &amp; <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Plans</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Manage platform SaaS tiers, active franchise subscriptions, billing cycles, and feature add-ons.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenCreatePlan(true)}
            className="btn-gold text-xs px-3.5 sm:px-4 py-2 gap-1.5 font-bold cursor-pointer inline-flex items-center shadow-lg shadow-[var(--gold-glow)] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Plan</span>
          </button>
          <button
            onClick={() => showToast("Exporting Active Subscriptions CSV...")}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Invoices</span>
          </button>
        </div>
      </div>

      {/* 2. Subscription Tier Plans Cards (Dynamic from Supabase in Ascending Order) */}
      {isLoadingPlans ? (
        <div className="flex justify-center items-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin"></div>
        </div>
      ) : tierPlans.length === 0 ? (
        <div className="glass-panel p-6 sm:p-10 rounded-2xl sm:rounded-3xl text-center space-y-3 border border-[var(--border)] w-full">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center mx-auto">
            <CreditCard className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-lg text-[var(--text-hi)]">
            No Subscription Plans Published Yet
          </h4>
          <p className="text-xs text-[var(--text-lo)] max-w-md mx-auto">
            Create your first subscription tier plan using the button below. Once published, it will instantly appear in real-time here and on the Get Started pricing page.
          </p>
          <button
            onClick={() => handleOpenCreatePlan(true)}
            className="btn-gold text-xs px-5 py-2.5 font-bold cursor-pointer inline-flex items-center gap-2 mt-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Plan</span>
          </button>
        </div>
      ) : (
        <div
          className={`w-full ${
            tierPlans.length === 1
              ? "max-w-md"
              : tierPlans.length === 2
              ? "grid grid-cols-1 md:grid-cols-2 max-w-4xl gap-6 sm:gap-8 items-stretch"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch"
          }`}
        >
          {tierPlans.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 relative min-w-0 ${
                tier.isFeatured
                  ? "bg-[var(--bg-soft)] border-2 border-[var(--gold)] shadow-2xl shadow-[var(--gold-glow)]"
                  : "glass-panel border border-[var(--border)] hover:border-[var(--gold)]/60"
              }`}
            >
              {/* Featured Badge */}
              {tier.isFeatured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--gold)] to-[#c99624] text-[#342c14] font-mono text-[11px] font-extrabold uppercase px-3.5 py-0.5 rounded-full shadow-md tracking-wider whitespace-nowrap">
                  ★ {tier.badge || "Most Popular"}
                </div>
              )}

              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--gold)] mb-1 font-bold">
                  {tier.pricingModel === "per_branch" ? "Per Branch" : "Flat Rate"}
                </div>

                <h3 className="font-display font-extrabold text-2xl text-[var(--text-hi)] mb-2">
                  {tier.name}
                </h3>

                {tier.desc ? (
                  <p className="text-xs sm:text-sm text-[var(--text-lo)] mb-3 leading-relaxed">
                    {tier.desc}
                  </p>
                ) : (
                  <div className="mb-2" />
                )}

                {/* Price Display */}
                <div className="mb-6 pb-6 border-b border-[var(--border)]/60">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[var(--text-hi)]">
                      {formatPrice(tier.rawPrice)}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-faint)]">
                      {tier.customDuration
                        ? `/ ${tier.customDuration.toLowerCase()}`
                        : tier.pricingModel === "per_branch"
                        ? "/ branch / month"
                        : "/ month"}
                    </span>
                  </div>
                  {tier.customDuration ? (
                    <div className="text-[11px] text-[var(--gold)] font-mono mt-1 font-semibold">
                      Billed every {tier.customDuration}
                    </div>
                  ) : tier.rawInterval?.toLowerCase().includes("annual") ? (
                    <div className="text-[11px] text-[var(--gold)] font-mono mt-1 font-semibold">
                      Billed annually (Save {tier.discountPercent || 17}%)
                    </div>
                  ) : (
                    <div className="text-[11px] text-[var(--text-faint)] font-mono mt-1">
                      Billed Monthly
                    </div>
                  )}
                </div>

                {/* Features List with Pure Golden Checkmark */}
                <div className="space-y-2.5 mb-8">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-2 font-semibold">
                    INCLUDED FEATURES:
                  </div>
                  {tier.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2 text-xs text-[var(--text-hi)]">
                      <Check className="w-3.5 h-3.5 text-[var(--gold)] mt-0.5 shrink-0" />
                      <span className="leading-snug">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Super Admin Actions (Edit Tier & Delete) */}
              <div className="pt-4 border-t border-[var(--border)]/60 flex items-center gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => handleOpenEditPlan(tier)}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--gold)] text-xs font-semibold transition-all text-center cursor-pointer"
                >
                  Edit Tier
                </button>
                <button
                  type="button"
                  onClick={() => setPlanToDelete(tier)}
                  className="px-3 py-2.5 rounded-xl bg-[var(--surface-hi)] border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-500 hover:text-red-400 text-xs font-semibold transition-all text-center cursor-pointer group"
                  title={`Delete ${tier.name}`}
                  aria-label="Delete Plan Tier"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================== DELETE PLAN CONFIRMATION MODAL ===================== */}
      {planToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => !isDeleting && setPlanToDelete(null)}
          />

          <div className="relative w-full max-w-md bg-[var(--bg-deep)] border border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-5 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-500 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-[var(--text-hi)]">
                    Delete Plan Tier
                  </h4>
                  <p className="text-xs text-[var(--text-lo)]">
                    Permanent database action
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setPlanToDelete(null)}
                className="p-1.5 rounded-xl text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-[var(--text-hi)] text-sm font-medium">
                Are you sure you want to delete <strong className="text-[var(--gold)]">{planToDelete.name}</strong>?
              </p>
              <p className="text-[var(--text-lo)] leading-relaxed">
                This will immediately remove this subscription tier from both the platform control center and the public pricing page in real-time. This action cannot be undone.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-75"
                autoFocus
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
