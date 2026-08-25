"use client";

import React from "react";

export default function CityMarquee() {
  const cities = [
    "KARACHI",
    "LAHORE",
    "ISLAMABAD",
    "GUJRANWALA",
    "FAISALABAD",
    "MULTAN",
    "SIALKOT",
    "RAWALPINDI",
  ];

  // Duplicate for seamless infinite marquee loop
  const displayCities = [...cities, ...cities, ...cities, ...cities];

  return (
    <section className="relative w-full bg-[var(--bg-deep)] border-y border-[var(--border)] py-4 overflow-hidden select-none">
      <div className="flex items-center gap-6 animate-marquee whitespace-nowrap">
        {displayCities.map((city, idx) => (
          <div key={idx} className="flex items-center gap-6">
            <span className="font-mono text-xs sm:text-sm font-semibold tracking-widest text-[var(--text-lo)] uppercase hover:text-[var(--gold)] transition-colors">
              {city}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold-glow)]"></span>
          </div>
        ))}
      </div>
    </section>
  );
}
