"use client";

import React, { useState, useEffect, useRef } from "react";

export default function AboutManifesto() {
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

  return (
    <section id="about" ref={sectionRef} className="py-20 md:py-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Manifesto Copy */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
              Our Mission
            </div>

            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] leading-tight">
              Software Built for the Realities of Pakistani Food Service
            </h2>

            <div className="space-y-4 text-[var(--text-lo)] text-sm sm:text-base leading-relaxed">
              <p>
                For years, restaurant owners in Pakistan were forced to choose between rigid foreign software billed in US Dollars with zero local payment integrations, or outdated offline POS systems from the early 2000s that crash whenever the internet blinks.
              </p>
              <p>
                FoodNet was engineered from the ground up to bridge this gap. We built native JazzCash and Easypaisa QR workflows, dual Urdu/English thermal receipt formatting, and offline-first till architecture that survives local connectivity drops without missing a beat.
              </p>
              <p>
                From an independent street food kitchen in Gujranwala or Rawalpindi to a 10-outlet franchise spanning Lahore and Karachi, FoodNet provides the modern digital operating system Pakistani food entrepreneurs deserve.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-4">
              <a href="#demo" className="btn-gold px-6 py-3 text-xs font-bold">
                Join the Network
              </a>
              <span className="font-mono text-xs text-[var(--text-faint)]">
                Headquartered in Punjab, Pakistan 🇵🇰
              </span>
            </div>
          </div>

          {/* Right Column: 2x2 Stat Tile Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            {/* Stat 1 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--gold)] transition-colors">
              <span className="font-mono font-extrabold text-4xl sm:text-5xl text-[var(--gold)]">
                {inView ? "5" : "0"}
              </span>
              <span className="font-display font-bold text-sm text-[var(--text-hi)]">
                Core Modules
              </span>
              <p className="text-[11px] text-[var(--text-lo)] leading-tight">
                POS, KDS, Inventory, Delivery &amp; Marketplace
              </p>
            </div>

            {/* Stat 2 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--olive)] transition-colors">
              <span className="font-mono font-extrabold text-4xl sm:text-5xl text-[var(--olive)]">
                {inView ? "100%" : "0%"}
              </span>
              <span className="font-display font-bold text-sm text-[var(--text-hi)]">
                PKR Native
              </span>
              <p className="text-[11px] text-[var(--text-lo)] leading-tight">
                Zero currency volatility or foreign credit cards
              </p>
            </div>

            {/* Stat 3 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--orange)] transition-colors">
              <span className="font-mono font-extrabold text-4xl sm:text-5xl text-[var(--orange)]">
                {inView ? "2" : "0"}
              </span>
              <span className="font-display font-bold text-sm text-[var(--text-hi)]">
                Mobile Rails
              </span>
              <p className="text-[11px] text-[var(--text-lo)] leading-tight">
                Instant JazzCash &amp; Easypaisa settlements
              </p>
            </div>

            {/* Stat 4 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--gold)] transition-colors">
              <span className="font-mono font-extrabold text-4xl sm:text-5xl text-[var(--gold)]">
                {inView ? "1" : "0"}
              </span>
              <span className="font-display font-bold text-sm text-[var(--text-hi)]">
                Live Dashboard
              </span>
              <p className="text-[11px] text-[var(--text-lo)] leading-tight">
                Complete multi-branch control anywhere in Pakistan
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
