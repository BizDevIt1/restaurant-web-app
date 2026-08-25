"use client";

import React from "react";

export default function FinalCta() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-b from-[var(--bg-soft)] to-[var(--bg-deep)] border border-[var(--border-hi)] p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl">
          {/* Ambient Glows */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-[var(--gold-glow)] rounded-full blur-3xl opacity-20 pointer-events-none"></div>

          <div className="max-w-3xl mx-auto space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
              Transform Your Restaurant Operations Today
            </div>

            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-[var(--text-hi)] leading-tight">
              Ready to Upgrade Your Kitchen to Omnibites?
            </h2>

            <p className="text-[var(--text-lo)] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Join forward-thinking restaurants, cloud kitchens, and franchise chains modernizing their billing, kitchen screens, and inventory.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#demo" className="btn-gold px-8 py-4 text-sm font-bold w-full sm:w-auto text-center shadow-xl">
                Book a Live Demo
              </a>
              <a
                href="https://wa.me/923001234567"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost px-8 py-4 text-sm font-semibold w-full sm:w-auto text-center flex items-center justify-center gap-2"
              >
                <span>Chat with our team 💬</span>
              </a>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 font-mono text-xs text-[var(--text-faint)]">
              <span>✓ 14-Day Risk-Free Trial</span>
              <span>✓ Zero Credit Card Required</span>
              <span>✓ Instant 60-Second Onboarding</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
