"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

// Custom hook for smooth real-time number counting from 0
function useCounter(target: number, duration: number = 1500, start: boolean = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Smooth ease-out quad curve
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      setCount(Math.round(easedProgress * target));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, start]);

  return count;
}

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
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Real-time counters starting from 0
  const count1 = useCounter(5, 1400, inView);
  const count2 = useCounter(100, 1600, inView);
  const count3 = useCounter(2, 1200, inView);
  const count4 = useCounter(1, 1000, inView);

  return (
    <section id="mission" ref={sectionRef} className="pt-6 pb-20 md:pt-8 md:pb-24 relative scroll-mt-24">
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
                Omnibites was engineered from the ground up to bridge this gap. We built native JazzCash and Easypaisa QR workflows, dual Urdu/English thermal receipt formatting, and offline-first till architecture that survives local connectivity drops without missing a beat.
              </p>
              <p>
                From an independent street food kitchen in Gujranwala or Rawalpindi to a 10-outlet franchise spanning Lahore and Karachi, Omnibites provides the modern digital operating system Pakistani food entrepreneurs deserve.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-4">
              <Link href="/#demo" className="btn-gold px-6 py-3 text-xs font-bold">
                Join the Network
              </Link>
            </div>
          </div>

          {/* Right Column: 2x2 Stat Tile Grid with Real-time Count-up Animation */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            {/* Stat 1 */}
            <div className="glass-panel p-6 rounded-2xl border-[var(--border)] text-center flex flex-col items-center justify-center space-y-2 group hover:border-[var(--gold)] transition-colors">
              <span className="font-mono font-extrabold text-4xl sm:text-5xl text-[var(--gold)]">
                {count1}
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
                {count2}%
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
                {count3}
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
                {count4}
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
