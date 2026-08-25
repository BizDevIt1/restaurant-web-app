"use client";

import React from "react";
import Link from "next/link";

export default function FinalCta() {
  return (
    <section className="py-20 md:py-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-b from-[var(--surface-hi)] via-[var(--bg-deep)] to-[var(--bg-deep)] border-2 border-[var(--gold)]/60 p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl shadow-[var(--gold-glow)]/40">
          {/* Top Radial Ambient Core */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[var(--gold-dim)] rounded-full blur-3xl opacity-60"></div>
          <div className="absolute -bottom-20 right-10 w-72 h-72 bg-[var(--orange-dim)] rounded-full blur-3xl opacity-40"></div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
              Get Started In Minutes
            </div>

            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-[var(--text-hi)] tracking-tight">
              Take Control of Your Restaurant Business Today
            </h2>

            <p className="text-[var(--text-lo)] text-base sm:text-lg leading-relaxed">
              Join leading Pakistani restaurants, cloud kitchens, and franchise groups upgrading to FoodNet. No setup hurdles, no foreign currency cards.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/pricing"
                className="w-full sm:w-auto btn-gold px-8 py-3.5 text-base font-bold text-center shadow-xl shadow-[var(--gold-glow)]"
              >
                Get Started
              </Link>
              <Link
                href="/#demo"
                className="w-full sm:w-auto btn-ghost px-8 py-3.5 text-base font-semibold text-center"
              >
                Book a Demo
              </Link>
            </div>

            <div className="pt-4">
              <p className="font-mono text-xs text-[var(--text-faint)]">
                14-day full feature trial · Free data import &amp; menu setup assistance
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
