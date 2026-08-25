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
              Software Built for Modern Food Service Operators
            </h2>

            <div className="space-y-4 text-[var(--text-lo)] text-sm sm:text-base leading-relaxed">
              <p>
                For years, restaurant operators were forced to choose between legacy offline systems that crash during peak hours or rigid, overpriced software with zero localized payment options.
              </p>
              <p>
                Omnibites was engineered from the ground up to solve this. We built a unified platform with multi-currency support, multi-language thermal receipts, and offline-first till architecture that keeps your business running smoothly.
              </p>
              <p>
                Omnibites provides the modern digital operating system that food entrepreneurs deserve for non-stop operational performance.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-4">
              <a href="#demo" className="btn-gold px-6 py-3 text-xs font-bold">
                Join the Network
              </a>
              <span className="font-mono text-xs text-[var(--text-faint)]">
                Built for modern food service networks
              </span>
            </div>
          </div>

          {/* Right Column: 2x2 Stat Tile Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            {/* Stat 1 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--gold)] transition-colors">
              <span className="font-mono font-extrabold text-4xl sm:text-5xl text-[var(--gold)]">
                {inView ? "8" : "0"}
              </span>
              <span className="font-display font-bold text-sm text-[var(--text-hi)]">
                Core Modules
              </span>
              <p className="text-[11px] text-[var(--text-lo)] leading-tight">
                POS, KDS, Inventory, Delivery, Marketplace &amp; Franchise
              </p>
            </div>

            {/* Stat 2 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--olive)] transition-colors">
              <span className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--olive)]">
                {inView ? "99.9%" : "0%"}
              </span>
              <span className="font-display font-bold text-sm text-[var(--text-hi)]">
                Uptime SLA
              </span>
              <p className="text-[11px] text-[var(--text-lo)] leading-tight">
                Offline-first engine with seamless cloud sync
              </p>
            </div>

            {/* Stat 3 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--orange)] transition-colors">
              <span className="font-mono font-extrabold text-2xl sm:text-3xl text-[var(--orange)]">
                {inView ? "Flexible" : "—"}
              </span>
              <span className="font-display font-bold text-sm text-[var(--text-hi)]">
                Multi-Currency
              </span>
              <p className="text-[11px] text-[var(--text-lo)] leading-tight">
                Support for all major payment rails &amp; tenders
              </p>
            </div>

            {/* Stat 4 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--gold)] transition-colors">
              <span className="font-mono font-extrabold text-4xl sm:text-5xl text-[var(--gold)]">
                {inView ? "1" : "0"}
              </span>
              <span className="font-display font-bold text-sm text-[var(--text-hi)]">
                Unified Platform
              </span>
              <p className="text-[11px] text-[var(--text-lo)] leading-tight">
                Complete multi-branch control anywhere you operate
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
