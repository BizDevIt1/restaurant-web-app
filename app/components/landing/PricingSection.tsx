"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  const tiers = [
    {
      name: "Starter",
      desc: "Perfect for single dine-in or takeaway restaurants starting their digital transformation.",
      monthlyPrice: "₨7,500",
      annualPrice: "₨6,375",
      isFeatured: false,
      badge: "Single Outlet",
      features: [
        "1 Branch Location",
        "Up to 5 Staff Logins",
        "6% Marketplace Commission",
        "High-Speed POS & Billing",
        "Basic Kitchen Display (1 station)",
        "Standard Urdu/English Receipts",
        "Standard Email & WhatsApp Support",
      ],
      ctaText: "Get Started",
    },
    {
      name: "Professional",
      desc: "Ideal for growing high-volume eateries, multi-station kitchens, and regional locations.",
      monthlyPrice: "₨16,000",
      annualPrice: "₨13,600",
      isFeatured: true,
      badge: "Most Popular",
      features: [
        "Up to 3 Branch Locations",
        "Up to 20 Staff Logins",
        "5% Marketplace Commission",
        "Multi-Station KDS Routing",
        "Recipe-Linked Inventory Deduction",
        "Direct Delivery & Rider Dispatch",
        "Customer Loyalty & Reward Points",
        "Priority 24/7 Phone & WhatsApp Support",
      ],
      ctaText: "Get Started Now",
    },
    {
      name: "Franchise",
      desc: "Engineered for established restaurant groups with strict central controls and multi-city branches.",
      monthlyPrice: "₨34,000",
      annualPrice: "₨28,900",
      isFeatured: false,
      badge: "Multi-Branch Groups",
      note: "One-time setup fee applies",
      features: [
        "Up to 10 Branch Locations",
        "Up to 75 Staff Logins",
        "4% Marketplace Commission",
        "Centralized Master Menu Push",
        "Inter-Branch Stock Transfers",
        "Franchisee Royalty Audits & P&L",
        "Thermal & Cloud Printer Fleet Sync",
        "Dedicated Account Specialist & Onsite Setup",
      ],
      ctaText: "Choose Franchise",
    },
    {
      name: "Enterprise",
      desc: "Custom operating system deployments for nationwide chains and enterprise food networks.",
      monthlyPrice: "Contact Us",
      annualPrice: "Contact Us",
      isFeatured: false,
      badge: "Custom Scale",
      features: [
        "Unlimited Branches & Cities",
        "Unlimited Staff & Admin Seats",
        "Custom Negotiated Commission Rates",
        "Custom ERP & SAP Integrations",
        "Dedicated Server Infrastructure",
        "Custom Feature Engineering",
        "SLA Guarantee & Onsite Training",
        "Executive Strategy Reviews",
      ],
      ctaText: "Contact Enterprise",
    },
  ];

  return (
    <section id="pricing" className="py-20 md:py-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Transparent Pricing
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Predictable Plans in Native Pakistani Rupee
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg">
            No surprise foreign exchange currency shocks, no USD card billing problems. Transparent monthly rates that scale with your restaurant.
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
                Save ~15% billed annually
              </span>
            </div>
          </div>
        </div>

        {/* 4 Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 relative ${
                tier.isFeatured
                  ? "bg-[var(--bg-soft)] border-2 border-[var(--gold)] shadow-2xl shadow-[var(--gold-glow)] scale-[1.02] lg:-translate-y-2 z-10"
                  : "glass-panel border-[var(--border)]"
              }`}
            >
              {/* Featured Badge */}
              {tier.isFeatured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[var(--gold)] to-[#c99624] text-[#241a06] font-mono text-[11px] font-extrabold uppercase px-3.5 py-0.5 rounded-full shadow-md tracking-wider">
                  {tier.badge}
                </div>
              )}

              <div>
                {!tier.isFeatured && (
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">
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
                    {tier.monthlyPrice !== "Contact Us" && (
                      <span className="font-mono text-xs text-[var(--text-faint)]">/ month</span>
                    )}
                  </div>
                  {tier.note && (
                    <div className="font-mono text-[10px] text-[var(--text-faint)] mt-1">
                      {tier.note}
                    </div>
                  )}
                  {isAnnual && tier.monthlyPrice !== "Contact Us" && (
                    <div className="text-[11px] text-[var(--olive)] font-mono mt-1">
                      Billed annually (Save ~15%)
                    </div>
                  )}
                </div>

                {/* Features List with Olive Checkmarks */}
                <div className="space-y-2.5 mb-8">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-2">
                    Included Features:
                  </div>
                  {tier.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs text-[var(--text-lo)]">
                      <span className="w-4 h-4 rounded-full bg-[var(--olive-dim)] text-[var(--olive)] border border-[var(--olive)]/40 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                        ✓
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <Link
                href="/#demo"
                className={`w-full py-3 text-xs font-bold text-center rounded-xl transition-all block ${
                  tier.isFeatured
                    ? "btn-gold shadow-lg shadow-[var(--gold-glow)]"
                    : "btn-ghost hover:border-[var(--gold)]"
                }`}
              >
                {tier.ctaText}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
