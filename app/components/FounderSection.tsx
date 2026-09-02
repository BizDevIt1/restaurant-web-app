"use client";

import React from "react";

export default function FounderSection() {
  return (
    <section id="leadership" className="py-14 md:py-16 relative overflow-hidden scroll-mt-24 border-b border-[var(--border)]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot"></span>
            Leadership &amp; Vision
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Meet the <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Founder</span> Behind <span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span>
          </h2>
          <p className="text-[var(--text-lo)] text-base">
            Dedicated to transforming restaurant operations across Pakistan with cutting-edge, native technology.
          </p>
        </div>

        {/* 2-Column Split Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Founder Profile Card */}
          <div className="lg:col-span-5 rounded-3xl bg-[var(--surface)] border border-[var(--border-hi)] p-7 sm:p-9 flex flex-col items-center text-center justify-center relative overflow-hidden backdrop-blur-xl group hover:border-[var(--gold)] hover:shadow-2xl hover:shadow-[var(--gold-dim)] transition-all duration-300">
            {/* Top Accent Ambient Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-56 h-56 bg-[var(--gold-dim)] rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

            <div className="relative z-10 w-full flex flex-col items-center space-y-4">
              {/* Large Founder Image Frame */}
              <div className="relative mb-2">
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-3xl p-1.5 bg-gradient-to-br from-[var(--gold)] via-[var(--border-hi)] to-[var(--orange)] shadow-2xl shadow-black/80 overflow-hidden relative group-hover:scale-105 transition-transform duration-300">
                  <div className="w-full h-full rounded-2xl bg-[var(--bg-deep)] overflow-hidden flex items-center justify-center relative">
                    {/* Default Founder Portrait / Graphic */}
                    <div className="w-full h-full bg-gradient-to-tr from-[var(--bg-soft)] to-[var(--surface-hi)] flex flex-col items-center justify-center text-[var(--gold)]">
                      <svg className="w-24 h-24 sm:w-28 sm:h-28 opacity-85" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                      <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-faint)] mt-1 font-bold">
                        Founder / CEO
                      </span>
                    </div>
                  </div>
                </div>

                {/* Verified Founder Badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[var(--gold)] to-[#c99624] text-[#241a06] font-mono text-[11px] font-extrabold uppercase shadow-lg tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                  <span>★</span> Founder &amp; CEO
                </div>
              </div>

              {/* Name & Title */}
              <div className="pt-2">
                <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-hi)]">
                  Zunnoorain Masroor
                </h3>
                <p className="font-mono text-xs text-[var(--gold)] uppercase tracking-wider font-semibold mt-1">
                  Founder &amp; Chief Executive Officer
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-lo)] leading-relaxed max-w-sm">
                Passionate technologist and product architect focused on solving complex operational, logistics, and payment workflows for food businesses in emerging markets.
              </p>
            </div>
          </div>

          {/* Right Column: Company & Vision Card */}
          <div className="lg:col-span-7 rounded-3xl bg-[var(--surface)] border border-[var(--border-hi)] p-6 sm:p-9 flex flex-col justify-between relative overflow-hidden backdrop-blur-xl group hover:border-[var(--gold)] hover:shadow-2xl hover:shadow-[var(--gold-dim)] transition-all duration-300">
            {/* Ambient Background Spot */}
            <div className="absolute -bottom-24 right-0 w-64 h-64 bg-[var(--orange-dim)] rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition-opacity"></div>

            <div className="relative z-10 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--olive-dim)] text-[var(--olive)] border border-[var(--olive)]/40 text-xs font-semibold uppercase tracking-wider">
                The Company Story
              </div>

              <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-hi)] leading-snug">
                Building Pakistan&apos;s Next-Generation Culinary Infrastructure
              </h3>

              <div className="space-y-3.5 text-xs sm:text-sm text-[var(--text-lo)] leading-relaxed">
                <p>
                  At <span className="font-bold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span>, our journey began with a simple yet pressing observation: the Pakistani food service industry was booming, but the software running it was either hopelessly outdated or unsuited to local realities.
                </p>
                <p>
                  From offline network drops and bilingual receipt requirements to instant mobile wallet settlements like JazzCash and Easypaisa, restaurant operators needed a platform purpose-built for Pakistan. We engineered <span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span> to empower every food entrepreneur—from single street kitchens to nationwide franchise chains.
                </p>
              </div>

              {/* Founder Quote Block */}
              <div className="rounded-2xl bg-[var(--bg-deep)]/80 border-l-4 border-[var(--gold)] p-4 sm:p-5 relative shadow-inner">
                <p className="text-xs sm:text-sm italic text-[var(--text-hi)] leading-relaxed">
                  &ldquo;Our vision is to build an operating system so reliable and intuitive that restaurant founders can focus 100% on exceptional food and customer happiness, while <span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span> handles every order, receipt, inventory item, and delivery seamlessly.&rdquo;
                </p>
                <div className="mt-2.5 flex items-center justify-between text-xs font-mono text-[var(--gold)]">
                  <span>— Zunnoorain Masroor, Founder</span>
                  <span className="text-[var(--text-faint)]"><span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span> Technologies</span>
                </div>
              </div>
            </div>

            {/* Quick Pillars Grid */}
            <div className="relative z-10 grid grid-cols-3 gap-3 pt-5 border-t border-[var(--border)] mt-5 text-center">
              <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)]">
                <div className="font-display font-bold text-base sm:text-lg text-[var(--gold)]">100%</div>
                <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">Local Dedication</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)]">
                <div className="font-display font-bold text-base sm:text-lg text-[var(--olive)]">24/7</div>
                <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">Direct Support</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)]">
                <div className="font-display font-bold text-base sm:text-lg text-[var(--orange)]">Zero</div>
                <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">Downtime POS</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
