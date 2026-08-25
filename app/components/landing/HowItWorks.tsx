"use client";

import React from "react";

export default function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Create your account",
      desc: "Sign up in 60 seconds with your business phone number and restaurant name. No credit card required.",
      badge: "Instant Setup",
    },
    {
      num: "02",
      title: "Set up your restaurant",
      desc: "Configure dining tables, delivery zones, takeaway counters, and connect your thermal receipt printers.",
      badge: "Plug & Play",
    },
    {
      num: "03",
      title: "Add your menu & staff",
      desc: "Upload menu categories, item modifiers, recipe costs in PKR, and assign PIN-protected roles for cashiers and cooks.",
      badge: "Recipe Linked",
    },
    {
      num: "04",
      title: "Start receiving orders",
      desc: "Process dine-in bills on the POS, stream KOT tickets straight to kitchen screens, and take direct digital marketplace orders.",
      badge: "Live KDS Flow",
    },
    {
      num: "05",
      title: "Track & grow",
      desc: "Monitor live daily sales, view ingredient depletion in real-time, and run customer retention campaigns via WhatsApp.",
      badge: "PKR Analytics",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-28 relative bg-[var(--bg-deep)]/40 border-y border-[var(--border)]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Streamlined Deployment
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Up and Running in Five Simple Steps
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg">
            From initial registration to your first live order in under 24 hours — zero complicated hardware installations.
          </p>
        </div>

        {/* 5-step horizontal timeline */}
        <div className="relative">
          {/* Connecting dashed line (Desktop only) */}
          <div className="hidden lg:block absolute top-1/2 left-10 right-10 h-[2px] border-t-2 border-dashed border-[var(--border-hi)] -translate-y-8 z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="glass-panel p-6 rounded-2xl flex flex-col justify-between group transition-all duration-300 relative"
              >
                <div>
                  {/* Step Number Badge */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-soft)] border-2 border-[var(--gold)] text-[var(--gold)] font-mono font-bold text-base flex items-center justify-center shadow-lg shadow-[var(--gold-dim)] group-hover:scale-110 group-hover:bg-[var(--gold)] group-hover:text-[#241a06] transition-all">
                      {step.num}
                    </div>
                    <span className="font-mono text-[10px] text-[var(--text-faint)] uppercase tracking-wider">
                      Step {idx + 1}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-base text-[var(--text-hi)] mb-2 group-hover:text-[var(--gold)] transition-colors">
                    {step.title}
                  </h3>

                  <p className="text-xs text-[var(--text-lo)] leading-relaxed mb-4">
                    {step.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border)]/50">
                  <span className="inline-block font-mono text-[10px] font-semibold text-[var(--olive)] bg-[var(--olive-dim)] px-2 py-0.5 rounded border border-[var(--olive)]/30">
                    {step.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
