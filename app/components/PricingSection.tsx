import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  CreditCard,
  Sparkles,
  Check,
  Building2,
  Calculator,
  X,
  Plus,
  Minus,
  ArrowRight,
} from "lucide-react";
import { usePlatformCurrency, formatCurrencyPrice } from "@/lib/currency";

interface PlanItem {
  id: string | number;
  name: string;
  desc: string;
  monthlyPrice: string;
  annualPrice: string;
  rawPrice: number;
  interval: string;
  pricingModel?: "flat" | "per_branch";
  pricing_model?: "flat" | "per_branch";
  discountPercent: number;
  customDuration?: string;
  isFeatured: boolean;
  badge: string;
  features: string[];
  ctaText: string;
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

function parsePlanModelAndTagline(dbPlan: {
  numeric_limit?: string;
  pricing_model?: string;
  tagline?: string;
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

  let cleanDesc = numLimit
    .replace(/^\[(per_branch|per-branch|branch|flat)\]\s*/i, "")
    .trim();

  if (dbPlan.tagline && String(dbPlan.tagline).trim()) {
    cleanDesc = String(dbPlan.tagline)
      .replace(/^\[(per_branch|per-branch|branch|flat)\]\s*/i, "")
      .trim();
  }

  if (!cleanDesc) {
    cleanDesc = model === "per_branch"
      ? "Per-branch scaled SaaS access & multi-terminal cloud suite"
      : "Full platform SaaS access & multi-device POS management";
  }

  return { model, desc: cleanDesc };
}

function mapSupabasePlanToPricingTier(dbPlan: any, customSymbol?: string): PlanItem {
  const numPrice = Number(dbPlan.rawPrice !== undefined ? dbPlan.rawPrice : (dbPlan.price || 0));
  const formattedMonthly = formatCurrencyPrice(numPrice, customSymbol);

  const rawInterval = String(dbPlan.rawInterval || dbPlan.interval || "Monthly").trim();
  const { raw, discountPercent, customDays } = parsePlanInterval(rawInterval);

  // Calculate annual price using the plan's exact discount %
  const discountMultiplier = Math.max(0, (100 - discountPercent) / 100);
  const annualDiscounted = Math.round(numPrice * discountMultiplier);
  const formattedAnnual = formatCurrencyPrice(annualDiscounted, customSymbol);

  const model: "flat" | "per_branch" =
    dbPlan.pricingModel === "per_branch" || dbPlan.pricing_model === "per_branch"
      ? "per_branch"
      : "flat";

  let cleanDesc = String(dbPlan.desc || dbPlan.tagline || dbPlan.subtitle || "").trim();
  if (!cleanDesc) {
    const { desc: parsedDesc } = parsePlanModelAndTagline(dbPlan);
    cleanDesc = parsedDesc;
  }

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

  const isPopular = Boolean(dbPlan.isFeatured || dbPlan.is_popular);

  return {
    id: dbPlan.dbId || dbPlan.id,
    name: dbPlan.name,
    desc: cleanDesc,
    monthlyPrice: formattedMonthly,
    annualPrice: formattedAnnual,
    rawPrice: numPrice,
    interval: raw,
    pricingModel: model,
    pricing_model: model,
    discountPercent,
    customDuration: customDays ? `${customDays} Days` : undefined,
    isFeatured: isPopular,
    badge: isPopular ? "Most Popular" : (model === "per_branch" ? "Per Branch" : "Flat Rate"),
    features: featArr,
    ctaText: dbPlan.ctaText || (model === "per_branch" ? "Calculate & Scale" : "Get Started"),
  };
}

export default function PricingSection() {
  const router = useRouter();
  const { currency, symbol, formatPrice } = usePlatformCurrency();
  const [isAnnual, setIsAnnual] = useState(false);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const CACHE_KEY = "omni_published_plans";

  useEffect(() => {
    // 1. Instant check in persistent localStorage with normalization
    try {
      if (typeof window !== "undefined") {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached && cached.trim()) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = parsed.map((p) => mapSupabasePlanToPricingTier(p));
            setPlans(normalized);
            setIsLoading(false);
          }
        }
      }
    } catch (e) {
      console.warn("Pricing cache read error:", e);
    }

    // 2. Fetch live plans directly from our server API route
    async function loadLivePlans(forceLoading = false) {
      if (forceLoading) setIsLoading(true);
      try {
        const res = await fetch("/api/super-admin/plans");
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (data && data.plans && data.plans.length > 0) {
          const mapped = data.plans.map(mapSupabasePlanToPricingTier);
          setPlans(mapped);
          try {
            if (typeof window !== "undefined") {
              sessionStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
            }
          } catch (e) {
            console.warn("Pricing cache write error:", e);
          }
        }
      } catch (err) {
        console.warn("Could not load pricing plans from server:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadLivePlans(false);

    // 3. Multi-Channel Real-time Listeners:

    // A. BroadcastChannel for instant cross-tab real-time sync
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("omni_plans_sync");
        bc.onmessage = (event) => {
          if (event.data?.type === "PLANS_UPDATED") {
            if (event.data.plans && Array.isArray(event.data.plans)) {
              setPlans(event.data.plans.map((p: any) => mapSupabasePlanToPricingTier(p)));
              setIsLoading(false);
            } else {
              loadLivePlans(false);
            }
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel init failed:", e);
      }
    }

    // B. LocalStorage and CustomEvent listeners for cross-tab and same-tab updates
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "omni_plans_updated_at" ||
        e.key === "omni_published_plans" ||
        e.key === "subscription_plans" ||
        e.key === "pricing_subscription_plans"
      ) {
        const cached = localStorage.getItem("omni_published_plans");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setPlans(parsed.map((p: any) => mapSupabasePlanToPricingTier(p)));
              setIsLoading(false);
            }
          } catch { }
        }
        loadLivePlans(false);
      }
    };

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ timestamp?: string; plans?: any[] }>;
      if (customEvent.detail?.plans && Array.isArray(customEvent.detail.plans)) {
        setPlans(customEvent.detail.plans.map((p: any) => mapSupabasePlanToPricingTier(p)));
        setIsLoading(false);
      } else {
        loadLivePlans(false);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("omni_plans_updated", handleCustomEvent);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", () => loadLivePlans(false));

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadLivePlans(false);
      }
    }

    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("omni_plans_updated", handleCustomEvent);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", () => loadLivePlans(false));
    };
  }, []);

  // Compute active annual discount percentage dynamically from configured plans
  const activeAnnualDiscount =
    plans.find((p) => p.discountPercent && p.interval.toLowerCase().includes("annual"))?.discountPercent ||
    plans.find((p) => p.discountPercent)?.discountPercent ||
    17;

  const handlePlanSelect = (tier: PlanItem) => {
    const isPerBranch = tier.pricingModel === "per_branch" || tier.pricing_model === "per_branch";
    if (isPerBranch) {
      setSelectedPlan(tier);
      setIsModalOpen(true);
    } else {
      router.push(`/signup?tier=${encodeURIComponent(tier.name)}`);
    }
  };

  return (
    <section id="pricing" className="pt-28 pb-20 md:pt-32 md:pb-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            <Sparkles className="w-3.5 h-3.5" />
            Transparent Pricing
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Predictable Plans for <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Every Stage</span>
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg font-medium">
            Transparent rates that scale with your restaurant as you grow.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <span
              className={`text-sm font-semibold cursor-pointer ${!isAnnual ? "text-[var(--text-hi)]" : "text-[var(--text-faint)]"
                }`}
              onClick={() => setIsAnnual(false)}
            >
              Monthly Billing
            </span>

            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-14 h-8 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] p-1 relative transition-colors cursor-pointer focus:outline-none"
              aria-label="Toggle annual pricing"
            >
              <div
                className={`w-6 h-6 rounded-full bg-[var(--gold)] shadow-md transition-transform duration-300 ${isAnnual ? "translate-x-6 bg-gradient-to-r from-[var(--gold)] to-[var(--orange)]" : "translate-x-0"
                  }`}
              ></div>
            </button>

            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-semibold cursor-pointer ${isAnnual ? "text-[var(--text-hi)]" : "text-[var(--text-faint)]"
                  }`}
                onClick={() => setIsAnnual(true)}
              >
                Annual Billing
              </span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--olive-dim)] text-[var(--olive)] border border-[var(--olive)]/40">
                Save {activeAnnualDiscount}% billed annually
              </span>
            </div>
          </div>
        </div>

        {/* Real-time Dynamic Tiers Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4 border border-[var(--border)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="font-display font-extrabold text-xl text-[var(--text-hi)]">
              Plans are being updated
            </h3>
            <p className="text-xs text-[var(--text-lo)]">
              New custom platform tiers are being published in real-time. Check back shortly or contact our team for enterprise onboarding.
            </p>
            <Link href="/signup" className="btn-gold text-xs px-6 py-2.5 inline-block font-bold">
              Get Started
            </Link>
          </div>
        ) : (
          <div
            className={`w-full ${plans.length === 1
                ? "max-w-md mx-auto"
                : plans.length === 2
                  ? "grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6 sm:gap-8 items-stretch"
                  : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-[1240px] mx-auto gap-6 sm:gap-8 items-stretch"
              }`}
          >
            {plans.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 relative ${tier.isFeatured
                    ? "bg-[var(--bg-soft)] border-2 border-[var(--gold)] shadow-2xl shadow-[var(--gold-glow)] scale-[1.02] lg:-translate-y-1.5 z-10"
                    : "glass-panel border border-[var(--border)] hover:border-[var(--gold)]/60"
                  }`}
              >
                {/* Featured Badge */}
                {tier.isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--gold)] to-[#c99624] text-[#342c14] font-mono text-[11px] font-extrabold uppercase px-3.5 py-0.5 rounded-full shadow-md tracking-wider whitespace-nowrap">
                    ★ {tier.badge}
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
                        {tier.customDuration
                          ? formatPrice(tier.rawPrice)
                          : isAnnual
                            ? formatPrice(Math.round(tier.rawPrice * Math.max(0, (100 - tier.discountPercent) / 100)))
                            : formatPrice(tier.rawPrice)}
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
                    ) : isAnnual ? (
                      <div className="text-[11px] text-[var(--gold)] font-mono mt-1 font-semibold">
                        Billed annually (Save {tier.discountPercent}%)
                      </div>
                    ) : (
                      <div className="text-[11px] text-[var(--text-faint)] font-mono mt-1">
                        Billed Monthly
                      </div>
                    )}
                  </div>

                  {/* Features List with Checkmarks */}
                  <div className="space-y-2.5 mb-8">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-2 font-semibold">
                      Included Features:
                    </div>
                    {tier.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2 text-xs text-[var(--text-hi)]">
                        <Check className="w-3.5 h-3.5 text-[var(--gold)] mt-0.5 shrink-0" />
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Get Started / Select Plan Action Button */}
                <button
                  type="button"
                  onClick={() => handlePlanSelect(tier)}
                  className={`w-full py-3.5 px-4 text-xs sm:text-sm font-bold text-center rounded-xl transition-all block cursor-pointer shadow-md ${tier.isFeatured
                      ? "btn-gold shadow-lg shadow-[var(--gold-glow)] hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-hi)] hover:border-[var(--gold)] hover:text-[var(--gold)] hover:bg-[var(--gold-dim)]/20"
                    }`}
                >
                  {tier.ctaText || "Get Started"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Branch Scaling Calculation Modal Popup */}
      <BranchCalculationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        plan={selectedPlan}
        isAnnual={isAnnual}
      />
    </section>
  );
}

/**
 * Interactive Branch Calculation Modal Popup
 * Rendered via Portal to document.body so it is always perfectly centered and never cut off.
 */
function BranchCalculationModal({
  isOpen,
  onClose,
  plan,
  isAnnual,
}: {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanItem | null;
  isAnnual: boolean;
}) {
  const router = useRouter();
  const { currency, symbol, formatPrice } = usePlatformCurrency();
  const [mounted, setMounted] = useState(false);
  const [branches, setBranches] = useState<number>(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset default branches to 1 on open and lock background scroll
  useEffect(() => {
    if (isOpen) {
      setBranches(1);
      if (typeof document !== "undefined") {
        document.body.style.overflow = "hidden";
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "unset";
      }
    };
  }, [isOpen]);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !plan || !mounted) return null;

  const unitRate = Number(plan.rawPrice || 0);
  const discountPercent = plan.discountPercent || 17;
  const discountMultiplier = Math.max(0, (100 - discountPercent) / 100);

  const rawMonthlyTotal = unitRate * branches;
  const rawAnnualTotalMonthly = Math.round(unitRate * discountMultiplier * branches);
  const effectiveMonthly = isAnnual ? rawAnnualTotalMonthly : rawMonthlyTotal;
  const annualYearlyTotal = rawAnnualTotalMonthly * 12;

  const handleProceed = () => {
    onClose();
    router.push(
      `/signup?tier=${encodeURIComponent(plan.name)}&branches=${branches}&billing=${isAnnual ? "annual" : "monthly"}`
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-[400px] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[var(--gold)]/40 shadow-2xl shadow-[var(--gold-glow)] space-y-4 relative animate-in zoom-in-95 duration-200 bg-[var(--bg-deep)] text-left max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:border-[var(--gold)] transition-all cursor-pointer"
          aria-label="Close branch calculation modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 pr-7">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-[10px] font-bold uppercase tracking-wider">
            <Calculator className="w-3 h-3 text-[var(--gold)]" />
            Branch Pricing Calculator
          </div>
          <h3 className="font-display font-bold text-lg sm:text-xl text-[var(--text-hi)] leading-tight">
            Calculate for <span className="text-[var(--gold)]">{plan.name}</span>
          </h3>
          <p className="text-[11px] text-[var(--text-lo)] leading-snug">
            Choose your active branches to scale your plan.
          </p>
        </div>

        {/* Branch Counter Stepper */}
        <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold uppercase tracking-wider text-[var(--text-hi)] text-[11px] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>Active Branches</span>
            </label>
            <span className="font-mono text-[11px] font-bold text-[var(--gold)]">
              {formatPrice(unitRate)} / branch / mo
            </span>
          </div>

          {/* Stepper Control */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setBranches((prev) => Math.max(1, prev - 1))}
              disabled={branches <= 1}
              className="w-10 h-10 rounded-xl bg-[var(--bg-deep)] border border-[var(--border)] hover:border-[var(--gold)] disabled:opacity-35 disabled:hover:border-[var(--border)] text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer font-bold text-base shrink-0"
              aria-label="Decrease branch count"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="flex-1 relative">
              <input
                type="number"
                min="1"
                max="500"
                value={branches}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setBranches(Math.max(1, val));
                }}
                className="w-full text-center font-mono font-bold text-lg py-2 bg-[var(--bg-deep)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl text-[var(--text-hi)] focus:outline-none transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[var(--text-faint)] pointer-events-none">
                {branches === 1 ? "outlet" : "outlets"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setBranches((prev) => prev + 1)}
              className="w-10 h-10 rounded-xl bg-[var(--bg-deep)] border border-[var(--border)] hover:border-[var(--gold)] text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer font-bold text-base shrink-0"
              aria-label="Increase branch count"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cost Summary Box */}
        <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[var(--gold-dim)]/30 via-[var(--surface-hi)] to-[var(--bg-deep)] border border-[var(--gold)]/30 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-lo)]">
            <span>Billing Cycle</span>
            <span className="font-semibold text-[var(--text-hi)]">
              {isAnnual ? `Annual (Save ${discountPercent}%)` : "Monthly Recurring"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-lo)]">
            <span>Breakdown</span>
            <span className="font-mono text-[var(--text-hi)]">
              {formatPrice(unitRate)} × {branches} {branches === 1 ? "outlet" : "outlets"}
            </span>
          </div>

          {isAnnual && (
            <div className="flex items-center justify-between text-[11px] text-[#25d366] font-semibold">
              <span>Annual Savings Applied</span>
              <span>-{discountPercent}% OFF</span>
            </div>
          )}

          <div className="pt-2.5 border-t border-[var(--border)]/60 flex items-baseline justify-between">
            <div>
              <span className="text-[11px] font-bold text-[var(--text-hi)] block">
                Total Estimated Fee
              </span>
              <span className="text-[10px] text-[var(--text-faint)] font-mono">
                {isAnnual
                  ? `${formatPrice(annualYearlyTotal)} billed annually`
                  : "Billed monthly"}
              </span>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-extrabold text-[var(--gold)]">
                {formatPrice(effectiveMonthly)}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-faint)]">
                {" "}/ mo
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--border-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleProceed}
            className="flex-1 btn-gold py-2.5 text-xs font-bold rounded-xl shadow-lg shadow-[var(--gold-glow)] inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Proceed ({branches} {branches === 1 ? "Branch" : "Branches"})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
