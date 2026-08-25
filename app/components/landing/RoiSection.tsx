"use client";

import React, { useState, useEffect, useRef } from "react";

export default function RoiSection() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const progressMetrics = [
    {
      title: "Order & Register Errors",
      trend: "Down significantly",
      percent: 85,
      note: "Eliminated misheard verbal orders & manual slip recalculation errors",
      color: "var(--olive)",
    },
    {
      title: "Front-of-House Billing Speed",
      trend: "3x Faster",
      percent: 90,
      note: "Instant split-bill checkout & integrated JazzCash/Easypaisa QR",
      color: "var(--gold)",
    },
    {
      title: "Raw Ingredient Stock Wastage",
      trend: "Down drastically",
      percent: 78,
      note: "Recipe-linked inventory auto-deducts exact grammages with reorder alerts",
      color: "var(--olive)",
    },
    {
      title: "Kitchen Ticket Turnaround",
      trend: "2x Faster",
      percent: 88,
      note: "Direct digital KDS routing by prep station prevents kitchen bottlenecks",
      color: "var(--orange)",
    },
  ];

  return (
    <section ref={sectionRef} className="py-20 md:py-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] p-8 sm:p-12 relative overflow-hidden shadow-2xl">
          {/* Subtle Ambient Radial behind the card */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--gold-dim)] rounded-full blur-3xl -z-0 opacity-30"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[var(--orange-dim)] rounded-full blur-3xl -z-0 opacity-20"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            {/* Left Column: ROI Levers */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
                Operational ROI
              </div>

              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
                Tangible Business Impact on Day One
              </h2>

              <p className="text-[var(--text-lo)] text-sm sm:text-base leading-relaxed">
                FoodNet doesn&apos;t just record receipts — it removes friction from your entire food production pipeline, unlocking higher profit margins per seat and delivery order.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-lg bg-[var(--olive-dim)] text-[var(--olive)] border border-[var(--olive)]/40 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-[var(--text-hi)]">
                      Less Ingredient Wastage
                    </h4>
                    <p className="text-xs text-[var(--text-lo)] leading-relaxed mt-0.5">
                      Gram-level recipe deductions ensure you never wonder where high-cost proteins, dairy, and oils disappeared.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/40 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-[var(--text-hi)]">
                      Faster Billing &amp; Higher Table Turn
                    </h4>
                    <p className="text-xs text-[var(--text-lo)] leading-relaxed mt-0.5">
                      Fast-tap till interface prints Urdu/English receipts in under two seconds, processing peak rush hours smoothly.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-lg bg-[var(--orange-dim)] text-[var(--orange)] border border-[var(--orange)]/40 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-[var(--text-hi)]">
                      Unified Kitchen Flow
                    </h4>
                    <p className="text-xs text-[var(--text-lo)] leading-relaxed mt-0.5">
                      No re-typing between delivery aggregators, phone calls, and kitchen staff. Every order arrives formatted on station screens.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: 4 Stacked Animated Progress Bars */}
            <div className="lg:col-span-6 p-6 sm:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-6">
              <div className="border-b border-[var(--border)]/60 pb-3 flex items-center justify-between">
                <span className="font-display font-bold text-sm text-[var(--text-hi)]">Efficiency Metrics</span>
                <span className="font-mono text-xs text-[var(--text-faint)]">System Telemetry</span>
              </div>

              <div className="space-y-5">
                {progressMetrics.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-hi)]">{item.title}</span>
                      <span className="font-mono font-bold text-[var(--gold)] bg-[var(--surface-hi)] px-2 py-0.5 rounded border border-[var(--border)]">
                        {item.trend}
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full h-3 rounded-full bg-[var(--bg-soft)] border border-[var(--border)] overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: inView ? `${item.percent}%` : "0%",
                          background: item.color,
                        }}
                      ></div>
                    </div>

                    <p className="text-[11px] text-[var(--text-lo)] font-mono">
                      {item.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
