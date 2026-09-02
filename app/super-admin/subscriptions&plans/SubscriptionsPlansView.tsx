"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Plus,
  Download,
  Store,
  Check,
  Sliders,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
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
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface PlanTierItem {
  id: string;
  dbId?: number | string;
  name: string;
  subtitle: string;
  price: string;
  rawPrice?: number | string;
  period: string;
  rawInterval?: string;
  annualPrice: string;
  subscribers: number;
  isFeatured: boolean;
  badge: string;
  features: string[];
}

// Helper to convert DB plan row to UI format
function mapDbPlanToUi(dbPlan: {
  id: number | string;
  name: string;
  price: number | string;
  interval?: string;
  numeric_limit?: string;
  features?: string;
  is_popular?: boolean;
}): PlanTierItem {
  const formattedPrice = `$${Number(dbPlan.price || 0).toLocaleString()}`;
  const intervalStr = dbPlan.interval || "Monthly";
  const featArr = dbPlan.features
    ? dbPlan.features.split("\n").filter((f: string) => f.trim())
    : [`${dbPlan.numeric_limit || "1 Branch"} Access`, "POS Cloud Suite"];

  return {
    id: `db-${dbPlan.id}`,
    dbId: dbPlan.id,
    name: dbPlan.name,
    subtitle: dbPlan.numeric_limit || "Multi-Branch Network",
    price: formattedPrice,
    rawPrice: dbPlan.price,
    period: ` / ${intervalStr.toLowerCase()}`,
    rawInterval: dbPlan.interval || "Monthly",
    annualPrice: intervalStr === "Annual" ? `Billed Annual` : `Billed ${intervalStr}`,
    subscribers: 0,
    isFeatured: Boolean(dbPlan.is_popular),
    badge: dbPlan.is_popular ? "Most Popular" : (dbPlan.numeric_limit || "Active Tier"),
    features: featArr,
  };
}

// Subscriptions & Plans Component
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

  const [subFilter, setSubFilter] = useState<"all" | "active" | "trial" | "expiring">("all");
  const [subSearch, setSubSearch] = useState("");
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
    description: "",
    price: "",
    billing: "Monthly",
    outletScope: "single" as "single" | "multiple",
    outlets: "Single Standalone Outlet",
    branchLimit: "",
    features: "",
    isFeatured: false,
  });

  const [merchantSubscriptions, setMerchantSubscriptions] = useState([
    {
      id: "sub-1",
      restaurant: "Salt'n Pepper Village",
      branch: "Main Boulevard, Lahore",
      city: "Lahore",
      tier: "Professional",
      tierBadge: "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/30",
      cycle: "Monthly",
      amount: "$9,999",
      nextInvoice: "Sep 12, 2026",
      status: "Active",
      statusBadge: "bg-[#25d366]/15 text-[#25d366] border-[#25d366]/30",
      outlets: 3,
    },
    {
      id: "sub-2",
      restaurant: "Kolachi Oceanfront",
      branch: "Do Darya, Karachi",
      city: "Karachi",
      tier: "Franchise",
      tierBadge: "bg-[var(--orange-dim)] text-[var(--orange)] border-[var(--orange)]/30",
      cycle: "Annual",
      amount: "$239,990",
      nextInvoice: "Dec 20, 2026",
      status: "Active",
      statusBadge: "bg-[#25d366]/15 text-[#25d366] border-[#25d366]/30",
      outlets: 6,
    },
    {
      id: "sub-3",
      restaurant: "Howdy Gourmet Burgers",
      branch: "F-7 Markaz, Islamabad",
      city: "Islamabad",
      tier: "Professional",
      tierBadge: "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/30",
      cycle: "Monthly",
      amount: "$9,999",
      nextInvoice: "Sep 18, 2026",
      status: "Active",
      statusBadge: "bg-[#25d366]/15 text-[#25d366] border-[#25d366]/30",
      outlets: 2,
    },
    {
      id: "sub-4",
      restaurant: "Bundu Khan Traditional",
      branch: "Liberty Market, Lahore",
      city: "Lahore",
      tier: "Franchise",
      tierBadge: "bg-[var(--orange-dim)] text-[var(--orange)] border-[var(--orange)]/30",
      cycle: "Monthly",
      amount: "$24,999",
      nextInvoice: "Sep 04, 2026",
      status: "Expiring",
      statusBadge: "bg-[var(--orange-dim)] text-[var(--orange)] border-[var(--orange)]/30",
      outlets: 5,
    },
    {
      id: "sub-5",
      restaurant: "Espresso Coffee Lounge",
      branch: "Clifton Block 4, Karachi",
      city: "Karachi",
      tier: "Starter",
      tierBadge: "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)]",
      cycle: "Monthly",
      amount: "$4,999",
      nextInvoice: "Aug 30, 2026",
      status: "Trial",
      statusBadge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      outlets: 1,
    },
    {
      id: "sub-6",
      restaurant: "Monal Heights Restaurant",
      branch: "Pir Sohawa, Islamabad",
      city: "Islamabad",
      tier: "Franchise",
      tierBadge: "bg-[var(--orange-dim)] text-[var(--orange)] border-[var(--orange)]/30",
      cycle: "Annual",
      amount: "$239,990",
      nextInvoice: "Jan 15, 2027",
      status: "Active",
      statusBadge: "bg-[#25d366]/15 text-[#25d366] border-[#25d366]/30",
      outlets: 4,
    },
    {
      id: "sub-7",
      restaurant: "Burger O'Clock Hub",
      branch: "Gulshan-e-Iqbal, Karachi",
      city: "Karachi",
      tier: "Starter",
      tierBadge: "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)]",
      cycle: "Monthly",
      amount: "$4,999",
      nextInvoice: "Sep 28, 2026",
      status: "Active",
      statusBadge: "bg-[#25d366]/15 text-[#25d366] border-[#25d366]/30",
      outlets: 1,
    },
  ]);

  const CACHE_KEY = "subscription_plans";

  const savePlansToSessionStorage = (plans: PlanTierItem[]) => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(plans));
      }
    } catch (e) {
      console.warn("Failed to write plans to sessionStorage:", e);
    }
  };

  const getPlansFromSessionStorage = (): PlanTierItem[] | null => {
    try {
      if (typeof window !== "undefined") {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (e) {
      console.warn("Failed to read plans from sessionStorage:", e);
    }
    return null;
  };

  // Load plans from Supabase / sessionStorage and subscribe to Realtime updates
  useEffect(() => {
    // 1. Instant check in sessionStorage for instant UI without loading spinner
    const cached = getPlansFromSessionStorage();
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setTierPlans(cached);
      setIsLoadingPlans(false);
    }

    async function loadPlans(forceLoading = false) {
      if (forceLoading) setIsLoadingPlans(true);
      try {
        const res = await fetch("/api/super-admin/plans");
        const json = await res.json();
        if (json && json.plans) {
          const dbTiers = json.plans.map(mapDbPlanToUi);
          setTierPlans(dbTiers);
          savePlansToSessionStorage(dbTiers);
        }
      } catch (err) {
        console.error("Failed to load plans from Supabase:", err);
      } finally {
        setIsLoadingPlans(false);
      }
    }

    if (!cached || cached.length === 0) {
      loadPlans(true);
    } else {
      loadPlans(false);
    }

    // Supabase Real-time listener
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("realtime-subscription_plans")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscription_plans" },
          () => {
            loadPlans(false);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn("Realtime subscription setup failed:", e);
    }
  }, []);

  const handleOpenCreatePlan = (updateUrl = true) => {
    setEditingPlanId(null);
    setNewPlan({
      name: "",
      description: "",
      price: "",
      billing: "Monthly",
      outletScope: "single",
      outlets: "Single Standalone Outlet",
      branchLimit: "",
      features: "",
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
    const rawId = tier.dbId || tier.id.replace(/^db-/, "");
    const isSingle = !tier.subtitle || tier.subtitle.toLowerCase().includes("single") || tier.subtitle.includes("1 Branch");
    const branchLimitVal = isSingle ? "" : tier.subtitle;
    const numPrice = tier.rawPrice !== undefined ? String(tier.rawPrice) : tier.price.replace(/[^0-9]/g, "");
    const billingVal = tier.rawInterval || "Monthly";

    setEditingPlanId(rawId);
    setNewPlan({
      name: tier.name,
      description: tier.subtitle,
      price: numPrice,
      billing: billingVal,
      outletScope: isSingle ? "single" : "multiple",
      outlets: isSingle ? "Single Standalone Outlet" : "Multi-Branch Network",
      branchLimit: branchLimitVal,
      features: tier.features.join("\n"),
      isFeatured: tier.isFeatured,
    });

    if (billingVal.toLowerCase().includes("days") || billingVal.toLowerCase().includes("custom")) {
      const daysMatch = billingVal.match(/\d+/);
      if (daysMatch) {
        setCustomDays(daysMatch[0]);
        setTempCustomDays(daysMatch[0]);
      }
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

  // Watch initial load and browser back/forward buttons (popstate)
  useEffect(() => {
    const syncFromUrl = () => {
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
          } else {
            setIsCreatingPlan(true);
          }
        } else {
          setIsCreatingPlan(true);
        }
      }
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [initialMode, tierPlans.length]);

  const handleApplyDiscount = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = tempDiscount.trim() || "17";
    setAnnualDiscount(val);
    setNewPlan({ ...newPlan, billing: "Annual" });
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

    const rawId = planToDelete.dbId || planToDelete.id.replace(/^db-/, "");
    const numericId = parseInt(String(rawId), 10);

    try {
      const res = await fetch(`/api/super-admin/plans?id=${numericId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete plan");
      }

      // Update React state and sessionStorage immediately in real-time
      setTierPlans((prev) => {
        const updated = prev.filter(
          (t) => t.id !== planToDelete.id && t.dbId !== numericId && t.id !== `db-${numericId}`
        );
        savePlansToSessionStorage(updated);
        return updated;
      });

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
    if (!newPlan.name.trim() || isSaving) return;

    setIsSaving(true);

    const isSingle = newPlan.outletScope === "single";
    const limitStr = isSingle
      ? "1 Branch (Single Outlet)"
      : (newPlan.branchLimit?.trim()
          ? (newPlan.branchLimit.toLowerCase().includes("branch") || newPlan.branchLimit.toLowerCase().includes("unlimited")
              ? newPlan.branchLimit
              : `${newPlan.branchLimit} Branch Locations`)
          : "Multi-Branch Network");

    let featuresList = planFeatures.length > 0
      ? [...planFeatures]
      : (newPlan.features
          ? newPlan.features.split("\n").filter((f) => f.trim())
          : [`${limitStr} Access`, "Full POS Suite Access", "KDS Real-time Routing", "Dedicated WhatsApp Support"]);

    if (featuresList.length > 0 && !featuresList.some((f) => f.toLowerCase().includes("branch"))) {
      featuresList = [`${limitStr} Access`, ...featuresList];
    }

    try {
      const isEditing = Boolean(editingPlanId);
      const url = "/api/super-admin/plans";
      const method = isEditing ? "PUT" : "POST";
      const payload: Record<string, unknown> = {
        name: newPlan.name.trim(),
        price: newPlan.price,
        interval: newPlan.billing,
        numeric_limit: limitStr,
        features: featuresList.join("\n"),
        is_popular: newPlan.isFeatured,
      };

      if (isEditing) {
        payload.id = editingPlanId;
      }

      // 1. Save / Update directly into Supabase Realtime Database via API route
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to save to Supabase");
      }

      // 2. Map the newly returned Supabase row to local UI state and sync sessionStorage
      if (result.plan) {
        const savedPlan = mapDbPlanToUi(result.plan);
        if (isEditing) {
          setTierPlans((prev) => {
            const updated = prev.map((t) =>
              t.id === `db-${result.plan.id}` || t.dbId === result.plan.id ? savedPlan : t
            );
            savePlansToSessionStorage(updated);
            return updated;
          });
        } else {
          // Append to end so earlier plans remain first and new plans show after them
          setTierPlans((prev) => {
            const updated = [...prev, savedPlan];
            savePlansToSessionStorage(updated);
            return updated;
          });
        }
      }

      showToast(
        isEditing
          ? `Plan "${newPlan.name}" updated successfully!`
          : `Plan "${newPlan.name}" successfully published & saved to Supabase!`
      );

      // Reset form and return to plans view
      setNewPlan({
        name: "",
        description: "",
        price: "",
        billing: "Monthly",
        outletScope: "single",
        outlets: "Single Standalone Outlet",
        branchLimit: "",
        features: "",
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

  const filteredSubscriptions = merchantSubscriptions.filter((sub) => {
    const matchesSearch =
      sub.restaurant.toLowerCase().includes(subSearch.toLowerCase()) ||
      sub.branch.toLowerCase().includes(subSearch.toLowerCase()) ||
      sub.city.toLowerCase().includes(subSearch.toLowerCase()) ||
      sub.tier.toLowerCase().includes(subSearch.toLowerCase());
    if (subFilter === "all") return matchesSearch;
    if (subFilter === "active") return matchesSearch && sub.status === "Active";
    if (subFilter === "trial") return matchesSearch && sub.status === "Trial";
    if (subFilter === "expiring") return matchesSearch && sub.status === "Expiring";
    return matchesSearch;
  });

  // ===================== FULL PAGE VIEW: CREATE / EDIT PLAN =====================
  if (isCreatingPlan) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Page Heading with Back Icon Button */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <button
              type="button"
              onClick={handleClosePlanForm}
              className="w-8 h-8 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--gold)] text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shadow-sm group shrink-0"
              title="Back to Subscriptions & Plans"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider">
              <CreditCard className="w-3.5 h-3.5" />
              {editingPlanId ? "Plan Tier Editor" : "Platform Plan Builder"}
            </div>
          </div>

          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            {editingPlanId ? "Edit Platform " : "Create Platform "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Plan Tier</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            {editingPlanId
              ? "Modify SaaS tier pricing, branch scope, validity period, and features for this existing plan."
              : "Configure SaaS tier pricing, branch limits, billing frequency, and feature entitlements for restaurant merchants."}
          </p>
        </div>

        {/* Main Form Container */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 w-full border border-[var(--border)] shadow-xl space-y-6">
          <form onSubmit={handleCreatePlan} className="space-y-5 text-xs font-sans">
            {/* 1. Outlet Scope & Branch Limits */}
            <div className="space-y-2">
              <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
                Branch Scope / Outlet Limit
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 bg-[var(--surface-hi)] border border-[var(--border)] rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setNewPlan({
                      ...newPlan,
                      outletScope: "single",
                      branchLimit: "",
                      outlets: "Single Standalone Outlet",
                    });
                  }}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    newPlan.outletScope === "single"
                      ? "bg-[var(--gold)] text-[#342c14] shadow-sm font-extrabold"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Single Standalone Outlet</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewPlan({
                      ...newPlan,
                      outletScope: "multiple",
                      branchLimit: newPlan.branchLimit && !newPlan.branchLimit.includes("1 Branch") ? newPlan.branchLimit : "",
                      outlets: "Multi-Branch Network",
                    });
                  }}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    newPlan.outletScope === "multiple"
                      ? "bg-[var(--gold)] text-[#342c14] shadow-sm font-extrabold"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>Multi-Branch Network (Numeric)</span>
                </button>
              </div>

              {newPlan.outletScope === "multiple" && (
                <div className="p-4 bg-[var(--surface-hi)] border border-[var(--gold)]/40 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 mt-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[var(--gold)] uppercase font-mono text-[10px]">
                      Set Numeric Branch Limit
                    </label>
                    {newPlan.branchLimit ? (
                      <span className="text-[11px] font-mono text-[var(--text-lo)]">
                        Selected: <strong className="text-[var(--gold)]">{newPlan.branchLimit}</strong>
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                        Type custom limit or select a preset below
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={newPlan.branchLimit}
                    onChange={(e) => setNewPlan({ ...newPlan, branchLimit: e.target.value })}
                    placeholder="e.g. Up to 5 Branches, 10 Branches, Unlimited"
                    className="w-full bg-[var(--bg-deep)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none font-mono"
                  />

                  <div className="flex flex-wrap gap-2">
                    {["2 Branches", "3 Branches", "5 Branches", "10 Branches", "Unlimited"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNewPlan({ ...newPlan, branchLimit: preset })}
                        className={`px-3 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer border ${
                          newPlan.branchLimit === preset
                            ? "bg-[var(--gold)] text-[#342c14] border-[var(--gold)]"
                            : "bg-[var(--bg-deep)] text-[var(--text-lo)] border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--text-hi)]"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Plan Name & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
                  Plan Name <span className="text-[var(--gold)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="e.g. Enterprise Plus Tier"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
                  Subtitle / Tagline
                </label>
                <input
                  type="text"
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  placeholder="e.g. Single Outlet &amp; Cloud Kitchens"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 3. Pricing & Billing Frequency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
                  Price ($) <span className="text-[var(--gold)]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[var(--gold)] text-sm pointer-events-none">
                    $
                  </span>
                  <input
                    type="text"
                    required
                    value={newPlan.price}
                    onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value.replace(/^\$\s*/, "") })}
                    placeholder="49"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-7 pr-4 py-2.5 text-sm font-mono font-bold text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
                  Billing Frequency
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
                          newPlan.billing === "Annual"
                            ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Annual</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 font-bold">
                            {annualDiscount ? `Save ${annualDiscount}%` : "Save %"}
                          </span>
                        </div>
                        {newPlan.billing === "Annual" && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewPlan({ ...newPlan, billing: "Quarterly" });
                          setIsBillingDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                          newPlan.billing === "Quarterly"
                            ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                        }`}
                      >
                        <span>Quarterly</span>
                        {newPlan.billing === "Quarterly" && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsBillingDropdownOpen(false);
                          setTempCustomDays(customDays || "");
                          setIsCustomDaysModalOpen(true);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                          newPlan.billing.startsWith("Custom")
                            ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[var(--gold)]" />
                          <span>Custom (Days)</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 font-bold">
                            Calendar
                          </span>
                        </div>
                        {newPlan.billing.startsWith("Custom") && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Feature Entitlements (Interactive with Enter Key & Pure Gold Ticks) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
                  Feature Entitlements
                </label>
                <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                  {planFeatures.length} {planFeatures.length === 1 ? "feature" : "features"} added
                </span>
              </div>

              {/* Input field: press Enter to add feature */}
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
                  placeholder="Type a feature and press Enter (e.g. Multi-Station KDS Routing)..."
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleAddFeature()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 hover:bg-[var(--gold)] hover:text-[#342c14] text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Added features list with Pure Golden Checkmarks */}
              {planFeatures.length > 0 && (
                <div className="space-y-1.5 pt-1 max-h-60 overflow-y-auto pr-1">
                  {planFeatures.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] group hover:border-[var(--gold)]/40 transition-all animate-in fade-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Check className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                        <span className="text-xs text-[var(--text-hi)] font-medium truncate">
                          {feat}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-1 rounded-lg text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                        title="Remove feature"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Feature Suggestions */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)] font-semibold">
                  Quick Feature Suggestions (click to add):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "1 Branch POS Terminal",
                    "Up to 10 Staff Logins",
                    "Multi-Station KDS Routing",
                    "Thermal Receipt Printing",
                    "Daily End-of-Day Sales Report",
                    "Direct Rider Dispatch App",
                    "Customer Loyalty & Points",
                    "24/7 Priority WhatsApp Support",
                  ].map((sugg) => (
                    <button
                      key={sugg}
                      type="button"
                      onClick={() => handleAddFeature(sugg)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-medium transition-all cursor-pointer border ${
                        planFeatures.includes(sugg)
                          ? "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/40 font-bold opacity-60 cursor-default"
                          : "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--text-hi)]"
                      }`}
                      disabled={planFeatures.includes(sugg)}
                    >
                      {planFeatures.includes(sugg) ? `✓ ${sugg}` : `+ ${sugg}`}
                    </button>
                  ))}
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
                    <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-[#f5c85c] to-[#e3b13b] text-[#342c14] font-extrabold shadow-sm uppercase tracking-wider animate-in fade-in zoom-in-95">
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
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleClosePlanForm}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] text-xs font-semibold hover:text-[var(--text-hi)] cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-gold px-6 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-2 disabled:opacity-75"
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
                    <h4 className="font-display font-extrabold text-base text-[var(--text-hi)]">
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-4 pr-10 py-2.5 text-base font-mono font-bold text-[var(--gold)] focus:outline-none"
                      autoFocus
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[var(--gold)] text-base">
                      %
                    </span>
                  </div>
                </div>

                {/* Quick Percentage Presets */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-mono text-[var(--text-faint)] uppercase font-semibold">
                    Quick Presets
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["10", "15", "17", "20", "25", "30"].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTempDiscount(pct)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer border ${
                          tempDiscount === pct
                            ? "bg-[var(--gold)] text-[#342c14] border-[var(--gold)] shadow-sm font-extrabold"
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
                  <span className="font-mono font-bold text-[var(--gold)]">
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
                    <h4 className="font-display font-extrabold text-base text-[var(--text-hi)]">
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-4 pr-14 py-2.5 text-base font-mono font-bold text-[var(--gold)] focus:outline-none"
                      autoFocus
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[var(--gold)] text-xs uppercase">
                      Days
                    </span>
                  </div>
                </div>

                {/* Quick Days Presets */}
                <div className="space-y-1.5">
                  <label className="text-[10.5px] font-mono text-[var(--text-faint)] uppercase font-semibold">
                    Quick Presets
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["7", "14", "30", "45", "60", "90", "180", "365"].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setTempCustomDays(days)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer border ${
                          tempCustomDays === days
                            ? "bg-[var(--gold)] text-[#342c14] border-[var(--gold)] shadow-sm font-extrabold"
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
                  <span className="font-mono font-bold text-[var(--gold)]">
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
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[var(--gold)]" />
            Omnibites Billing &amp; Licensing
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Subscriptions &amp; <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Plans</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Manage platform SaaS tiers, active franchise subscriptions, billing cycles, and feature add-ons.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenCreatePlan(true)}
            className="btn-gold text-xs px-4 py-2 gap-1.5 font-bold cursor-pointer inline-flex items-center shadow-lg shadow-[var(--gold-glow)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Plan</span>
          </button>
          <button
            onClick={() => showToast("Exporting Active Subscriptions CSV...")}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer"
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
        <div className="glass-panel p-10 rounded-3xl text-center space-y-3 border border-[var(--border)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center mx-auto">
            <CreditCard className="w-6 h-6" />
          </div>
          <h4 className="font-display font-bold text-lg text-[var(--text-hi)]">
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
        <div className={`grid grid-cols-1 md:grid-cols-2 ${tierPlans.length >= 3 ? "lg:grid-cols-3" : ""} gap-6`}>
          {tierPlans.map((tier) => (
            <div
              key={tier.id}
              className={`glass-panel p-6 sm:p-7 rounded-3xl flex flex-col justify-between relative transition-all duration-300 ${
                tier.isFeatured
                  ? "border-[var(--gold)]/60 shadow-2xl shadow-[var(--gold-dim)] ring-1 ring-[var(--gold)]/40"
                  : "border-[var(--border)]"
              }`}
            >
              {tier.isFeatured && (
                <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#f5c85c] to-[#e3b13b] text-[#342c14] font-mono text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                  ★ {tier.badge}
                </span>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-bold text-lg text-[var(--text-hi)]">
                      {tier.name}
                    </h4>
                    {!tier.isFeatured && (
                      <span className="font-mono text-[10.5px] px-2.5 py-0.5 rounded-full bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]">
                        {tier.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-lo)] mt-1 leading-snug">
                    {tier.subtitle}
                  </p>
                </div>

                <div className="pt-2 pb-1 border-y border-[var(--border)]/60">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono font-extrabold text-3xl text-[var(--gold)]">
                      {tier.price}
                    </span>
                    <span className="font-sans text-xs text-[var(--text-faint)]">
                      {tier.period}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-faint)] block mt-0.5">
                    {tier.annualPrice}
                  </span>
                </div>

                {/* Feature List with Pure Golden Checkmark */}
                <ul className="space-y-2 text-xs text-[var(--text-hi)] pt-2">
                  {tier.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[var(--gold)] mt-0.5 shrink-0" />
                      <span className="leading-snug">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 mt-4 border-t border-[var(--border)]/60 flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditPlan(tier)}
                  className="flex-1 py-2 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--gold)] text-xs font-bold transition-all text-center cursor-pointer"
                >
                  Edit Tier
                </button>
                <button
                  onClick={() => setPlanToDelete(tier)}
                  className="px-3 py-2 rounded-xl bg-[var(--surface-hi)] border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-500 hover:text-red-400 text-xs font-bold transition-all text-center cursor-pointer group"
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

      {/* 3. Active Merchant Subscriptions Table */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-extrabold text-xl text-[var(--text-hi)]">
              Merchant Subscriptions &amp; Billing
            </h3>
            <p className="text-xs text-[var(--text-lo)] mt-0.5">
              Real-time status of subscribed outlets, invoice renewals, and tier assignments
            </p>
          </div>

          {/* Filter Segmented Control */}
          <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-medium self-start sm:self-auto">
            {(["all", "active", "trial", "expiring"] as const).map((filterType) => (
              <button
                key={filterType}
                onClick={() => setSubFilter(filterType)}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer capitalize font-mono text-xs ${
                  subFilter === filterType
                    ? "bg-[var(--gold)] text-[#342c14] font-bold shadow-md"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
              >
                {filterType === "all"
                  ? "All (248)"
                  : filterType === "active"
                  ? "Active"
                  : filterType === "trial"
                  ? "Trial"
                  : "Expiring"}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar for Subscriptions */}
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            value={subSearch}
            onChange={(e) => setSubSearch(e.target.value)}
            placeholder="Search by restaurant name, branch, or tier..."
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-full pl-9 pr-4 py-2 text-xs sm:text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="pb-3 font-semibold">Restaurant Outlet</th>
                <th className="pb-3 font-semibold">Subscribed Tier</th>
                <th className="pb-3 font-semibold">Billing Cycle</th>
                <th className="pb-3 font-semibold text-right">Fee</th>
                <th className="pb-3 font-semibold text-center">Next Invoice</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40 font-medium">
              {filteredSubscriptions.map((sub) => (
                <tr key={sub.id} className="group">
                  {/* Restaurant Info */}
                  <td className="py-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center shadow-sm">
                      {sub.restaurant.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors block">
                        {sub.restaurant}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)] font-mono">
                        {sub.branch} ({sub.outlets} {sub.outlets > 1 ? "outlets" : "outlet"})
                      </span>
                    </div>
                  </td>

                  {/* Tier Badge */}
                  <td className="py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold border ${sub.tierBadge}`}>
                      {sub.tier}
                    </span>
                  </td>

                  {/* Cycle */}
                  <td className="py-3.5 font-mono text-[var(--text-lo)]">
                    {sub.cycle}
                  </td>

                  {/* Fee */}
                  <td className="py-3.5 text-right font-mono font-bold text-[var(--gold)]">
                    {sub.amount}
                  </td>

                  {/* Next Invoice */}
                  <td className="py-3.5 text-center font-mono text-[var(--text-lo)] text-[11px]">
                    {sub.nextInvoice}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold border ${sub.statusBadge}`}>
                      {sub.status === "Active" && <CheckCircle2 className="w-3 h-3 text-[#25d366]" />}
                      {sub.status === "Trial" && <Clock className="w-3 h-3 text-blue-400" />}
                      {sub.status === "Expiring" && <AlertTriangle className="w-3 h-3 text-[var(--orange)]" />}
                      <span>{sub.status}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => showToast(`Invoice downloaded for ${sub.restaurant}`)}
                        className="p-1.5 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] text-[var(--text-lo)] transition-colors cursor-pointer"
                        title="Download Invoice"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => showToast(`Modifying subscription for ${sub.restaurant}`)}
                        className="p-1.5 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] text-[var(--text-lo)] transition-colors cursor-pointer"
                        title="Edit Subscription"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                  <h4 className="font-display font-extrabold text-lg text-[var(--text-hi)]">
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
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold font-mono transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-75"
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
