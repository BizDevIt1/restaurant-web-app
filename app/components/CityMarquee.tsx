"use client";

import React from "react";

export default function CityMarquee() {
  const highlights = [
    "DINE-IN TILLS",
    "KITCHEN DISPLAY (KDS)",
    "RECIPE INVENTORY",
    "DIRECT MARKETPLACE",
    "MULTI-BRANCH CONTROL",
    "RIDER DISPATCH",
    "DESK & TABLE BILLING",
    "EXPO STATIONS",
  ];

  // Duplicate for seamless infinite marquee loop
  const displayItems = [...highlights, ...highlights, ...highlights, ...highlights];

  return (
    <section className="relative w-full bg-[var(--bg-deep)] border-y border-[var(--border)] py-4 overflow-hidden select-none">
      <div className="flex items-center gap-6 animate-marquee whitespace-nowrap">
        {displayItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-6">
            <span className="font-mono text-xs sm:text-sm font-semibold tracking-widest text-[var(--text-lo)] uppercase hover:text-[var(--gold)] transition-colors">
              {item}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold-glow)]"></span>
          </div>
        ))}
      </div>
    </section>
  );
}
