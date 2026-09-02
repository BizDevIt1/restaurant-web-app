"use client";

import React from "react";

export default function EarlyPartners() {
  const partnerSegments = [
    {
      title: "Cloud Kitchen Owners",
      initials: "CK",
      role: "Delivery-First Operators",
      tag: "Founding Partner Program",
      benefit:
        "Waived initial setup fees, personalized multi-brand kitchen display configuration, and direct technical integration with your dedicated rider fleets.",
    },
    {
      title: "Single-Branch Restaurants",
      initials: "SB",
      role: "Dine-In & Takeaway Eateries",
      tag: "Founding Partner Program",
      benefit:
        "Guaranteed locked-in monthly pricing for 2 years, free menu digitization and recipe cost modeling, plus complimentary thermal printer setup.",
    },
    {
      title: "Multi-Branch & Franchise Groups",
      initials: "FG",
      role: "Multi-Outlet Chains (3–10 Outlets)",
      tag: "Founding Partner Program",
      benefit:
        "Free full historical data migration from legacy systems, dedicated account manager, and staff training across all locations.",
    },
  ];

  return (
    <section className="py-14 md:py-16 relative border-b border-[var(--border)]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Exclusive Cohort
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Join the <span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span> <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Founding Partner Program</span>
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg">
            We&apos;re actively onboarding forward-thinking restaurant operators into our inaugural cohort, with exclusive onboarding benefits.
          </p>
        </div>

        {/* 3-Column Dashed Border Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {partnerSegments.map((segment, idx) => (
            <div
              key={idx}
              className="rounded-2xl border-2 border-dashed border-[var(--border-hi)] bg-[var(--surface)]/60 p-7 flex flex-col justify-between hover:border-[var(--gold)] hover:bg-[var(--surface-hi)] transition-all duration-300 group"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  {/* Initials Disc */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--orange)] p-0.5 shadow-md">
                    <div className="w-full h-full rounded-full bg-[var(--bg-deep)] flex items-center justify-center font-display font-extrabold text-[var(--gold)] text-sm group-hover:bg-[var(--gold)] group-hover:text-[#241a06] transition-colors">
                      {segment.initials}
                    </div>
                  </div>

                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                    {segment.tag}
                  </span>
                </div>

                <h3 className="font-display font-bold text-xl text-[var(--text-hi)] mb-1">
                  {segment.title}
                </h3>
                <p className="text-xs font-mono text-[var(--text-lo)] mb-4">
                  {segment.role}
                </p>

                <div className="p-4 rounded-xl bg-[var(--bg-deep)]/80 border border-[var(--border)] mb-4">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--olive)] font-semibold block mb-1">
                    Cohort Benefit:
                  </span>
                  <p className="text-xs text-[var(--text-lo)] leading-relaxed">
                    {segment.benefit}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)]/60 flex items-center justify-between text-xs">
                <span className="font-mono text-[var(--text-faint)]">Status: Enrolling</span>
                <a
                  href="#demo"
                  className="text-[var(--gold)] font-semibold hover:underline flex items-center gap-1"
                >
                  Apply for Cohort →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
