"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { CreditCard, Sparkles, Check } from "lucide-react";

interface PlanItem {
  id: string | number;
  name: string;
  desc: string;
  monthlyPrice: string;
  annualPrice: string;
  rawPrice: number;
  isFeatured: boolean;
  badge: string;
  features: string[];
  ctaText: string;
}

function mapSupabasePlanToPricingTier(dbPlan: {
  id: number | string;
  name: string;
  price: number | string;
  interval?: string;
  numeric_limit?: string;
  features?: string;
  is_popular?: boolean;
}): PlanItem {
  const numPrice = Number(dbPlan.price || 0);
  const formattedMonthly = `$${numPrice.toLocaleString()}`;
  // Annual price with 17% discount
  const annualDiscounted = Math.round(numPrice * 0.83);
  const formattedAnnual = `$${annualDiscounted.toLocaleString()}`;

  const featArr = dbPlan.features
    ? dbPlan.features.split("\n").filter((f: string) => f.trim())
    : [`${dbPlan.numeric_limit || "1 Branch"} Access`, "Omnibites Cloud POS", "High-Speed Billing", "Thermal Receipt Printing"];

  return {
    id: dbPlan.id,
    name: dbPlan.name,
    desc: dbPlan.numeric_limit ? `${dbPlan.numeric_limit} full SaaS access & support` : "Full Omnibites SaaS features",
    monthlyPrice: formattedMonthly,
    annualPrice: formattedAnnual,
    rawPrice: numPrice,
    isFeatured: Boolean(dbPlan.is_popular),
    badge: dbPlan.is_popular ? "Most Popular" : (dbPlan.numeric_limit || "Active Tier"),
    features: featArr,
    ctaText: "Get Started",
  };
}

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const CACHE_KEY = "pricing_subscription_plans";

  useEffect(() => {
    // 1. Instant check in sessionStorage
    try {
      if (typeof window !== "undefined") {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPlans(parsed);
            setIsLoading(false);
          }
        }
      }
    } catch (e) {
      console.warn("Pricing cache read error:", e);
    }

    // 2. Fetch live plans from Supabase API
    async function loadLivePlans(forceLoading = false) {
      if (forceLoading) setIsLoading(true);
      try {
        const res = await fetch("/api/super-admin/plans");
        const data = await res.json();
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
        } else {
          setPlans([]);
        }
      } catch (err) {
        console.error("Failed to load pricing plans from Supabase:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadLivePlans(false);

    // 3. Real-time Supabase Subscription: Listen for INSERT, UPDATE, DELETE
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("pricing-realtime-plans")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscription_plans" },
          () => {
            loadLivePlans(false);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn("Pricing realtime subscription error:", e);
    }
  }, []);

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
              className={`text-sm font-semibold cursor-pointer ${
                !isAnnual ? "text-[var(--text-hi)]" : "text-[var(--text-faint)]"
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
                className={`w-6 h-6 rounded-full bg-[var(--gold)] shadow-md transition-transform duration-300 ${
                  isAnnual ? "translate-x-6 bg-gradient-to-r from-[var(--gold)] to-[var(--orange)]" : "translate-x-0"
                }`}
              ></div>
            </button>

            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-semibold cursor-pointer ${
                  isAnnual ? "text-[var(--text-hi)]" : "text-[var(--text-faint)]"
                }`}
                onClick={() => setIsAnnual(true)}
              >
                Annual Billing
              </span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--olive-dim)] text-[var(--olive)] border border-[var(--olive)]/40">
                Save 17% billed annually
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
          <div className={`grid grid-cols-1 md:grid-cols-2 ${plans.length >= 3 ? "lg:grid-cols-3" : ""} gap-6 items-stretch`}>
            {plans.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 relative ${
                  tier.isFeatured
                    ? "bg-[var(--bg-soft)] border-2 border-[var(--gold)] shadow-2xl shadow-[var(--gold-glow)] scale-[1.02] lg:-translate-y-1.5 z-10"
                    : "glass-panel border border-[var(--border)]"
                }`}
              >
                {/* Featured Badge */}
                {tier.isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--gold)] to-[#c99624] text-[#342c14] font-mono text-[11px] font-extrabold uppercase px-3.5 py-0.5 rounded-full shadow-md tracking-wider">
                    ★ {tier.badge}
                  </div>
                )}

                <div>
                  {!tier.isFeatured && (
                    <div className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--text-faint)] mb-1">
                      {tier.badge}
                    </div>
                  )}

                  <h3 className="font-display font-extrabold text-2xl text-[var(--text-hi)] mb-2">
                    {tier.name}
                  </h3>

                  <p className="text-xs text-[var(--text-lo)] min-h-[36px] mb-6 leading-relaxed">
                    {tier.desc}
                  </p>

                  {/* Price Display */}
                  <div className="mb-6 pb-6 border-b border-[var(--border)]/60">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[var(--text-hi)]">
                        {isAnnual ? tier.annualPrice : tier.monthlyPrice}
                      </span>
                      <span className="font-mono text-xs text-[var(--text-faint)]">/ month</span>
                    </div>
                    {isAnnual && (
                      <div className="text-[11px] text-[var(--gold)] font-mono mt-1 font-semibold">
                        Billed annually (Save 17%)
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

                {/* Get Started Action Button */}
                <Link
                  href={`/signup?tier=${encodeURIComponent(tier.name)}`}
                  className={`w-full py-3 text-xs font-bold text-center rounded-xl transition-all block cursor-pointer ${
                    tier.isFeatured
                      ? "btn-gold shadow-lg shadow-[var(--gold-glow)]"
                      : "btn-ghost hover:border-[var(--gold)] hover:text-[var(--gold)]"
                  }`}
                >
                  {tier.ctaText}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
