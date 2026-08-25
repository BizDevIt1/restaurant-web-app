"use client";

import React from "react";

export default function AboutHero() {
  return (
    <section className="relative pt-28 pb-4 md:pt-36 md:pb-6 text-center">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Eyebrow - Matching Home Hero */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot"></span>
            About Omnibites
          </div>

          {/* Heading */}
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-[3.25rem] text-[var(--text-hi)] leading-[1.15] tracking-tight">
            Powering Multi-Vendor Restaurants, From Kitchen to Delivery
          </h1>

          {/* Description */}
          <p className="text-base sm:text-lg text-[var(--text-lo)] leading-relaxed max-w-2xl mx-auto">
            <span className="font-extrabold">
              <span className="text-[#f7f0dd]">Omni</span>
              <span className="text-[#f5a623]">bites</span>
            </span>{" "}
            gives you total control over your entire culinary ecosystem with real-time order sync, multi-branch management, and lightning-fast POS.
          </p>

          {/* Mouse Scroll Animation */}
          <div className="flex flex-col items-center justify-center pt-3 gap-1.5">
            <a
              href="#leadership"
              aria-label="Scroll down to leadership section"
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-6 h-9 rounded-full border-2 border-[var(--gold)]/60 flex items-start justify-center p-1 shadow-lg shadow-[var(--gold-dim)] bg-[var(--surface)] group-hover:border-[var(--gold)] transition-colors">
                <div className="w-1.5 h-2 rounded-full bg-gradient-to-b from-[var(--gold)] to-[var(--orange)] animate-mouse-scroll"></div>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-faint)] group-hover:text-[var(--gold)] transition-colors">
                Scroll Down
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
