"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";

export default function HeroOrbit() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -(y * 6), y: x * 6 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-6 items-center">
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-6 space-y-7 text-left z-10">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot"></span>
              Built for restaurants in Pakistan
            </div>

            {/* H1 Headline */}
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.12] text-[var(--text-hi)]">
              Manage Your Restaurant with{" "}
              <span className="text-gradient-gold block sm:inline">
                One Complete POS &amp; Online Ordering
              </span>{" "}
              System
            </h1>

            {/* Subcopy */}
            <p className="text-base sm:text-lg text-[var(--text-lo)] max-w-xl leading-relaxed">
              Replace disconnected WhatsApp ordering, manual paper slips, and scattered Excel ledgers.
              Omnibites unites your billing till, kitchen display, inventory, JazzCash &amp; Easypaisa payments, and direct delivery marketplace into one unified operating system.
            </p>

            {/* CTA Button Pair */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link
                href="/pricing"
                className="btn-gold px-7 py-3.5 text-base text-center shadow-lg shadow-[var(--gold-glow)]"
              >
                Get Started
              </Link>
              <Link
                href="/#demo"
                className="btn-ghost px-7 py-3.5 text-base text-center"
              >
                Book a Demo
              </Link>
            </div>

            {/* Trust Strip */}
            <div className="pt-3 border-t border-[var(--border)]/70">
              <p className="font-mono text-xs text-[var(--text-faint)] tracking-tight flex items-center gap-2 flex-wrap">
                <span>No card required</span>
                <span className="text-[var(--gold)]">·</span>
                <span>Setup in under a day</span>
                <span className="text-[var(--gold)]">·</span>
                <span className="text-[var(--text-lo)] font-medium">PKR &amp; Urdu/English ready</span>
              </p>
            </div>
          </div>

          {/* Right Column: Visual Mockup matching the original reference exactly */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="lg:col-span-6 relative flex items-center justify-center min-h-[440px] select-none perspective-[1000px]"
          >
            <div
              className="relative w-[480px] sm:w-[500px] h-[375px] transition-transform duration-300 ease-out"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* 1. Top Right Pill: Order #4471 accepted */}
              <div
                className="absolute top-0 right-0 z-20 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-xl backdrop-blur-md"
                style={{
                  background: "#160e0d",
                  borderColor: "rgba(247, 231, 190, 0.16)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{
                    background: "#e3b13b",
                    boxShadow: "0 0 8px #e3b13b",
                  }}
                ></span>
                <span className="font-display font-bold text-xs text-[#f7f0dd] tracking-tight">
                  Order #4471 accepted
                </span>
              </div>

              {/* 2. Top Left Card: Network Overview */}
              <div
                className="absolute top-4 left-0 w-[290px] sm:w-[300px] rounded-[18px] border p-4 shadow-xl backdrop-blur-xl z-10"
                style={{
                  background: "rgba(36, 29, 16, 0.55)",
                  borderColor: "rgba(247, 231, 190, 0.15)",
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display font-bold text-xs sm:text-sm text-[#f7f0dd]">
                    Network Overview
                  </span>
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{
                      background: "#e3b13b",
                      boxShadow: "0 0 8px #e3b13b",
                    }}
                  ></span>
                </div>

                {/* 7 Gradient Vertical Bars */}
                <div
                  className="grid grid-cols-7 gap-2 items-end h-24 mb-3 pb-2"
                  style={{ borderBottom: "1px solid rgba(247, 231, 190, 0.12)" }}
                >
                  {[
                    { height: "32%" },
                    { height: "52%" },
                    { height: "38%" },
                    { height: "72%" },
                    { height: "52%" },
                    { height: "90%" },
                    { height: "66%" },
                  ].map((bar, idx) => (
                    <div
                      key={idx}
                      className="w-full rounded-t-[4px]"
                      style={{
                        height: bar.height,
                        background: "linear-gradient(to top, #e04e17 0%, #e87a1e 45%, #f5c344 100%)",
                      }}
                    ></div>
                  ))}
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[10px] tracking-wider text-[#8d8067] font-medium uppercase">
                    REVENUE
                  </span>
                  <span className="text-xs font-semibold text-[#c1b295]">
                    <span className="text-[9px] font-normal mr-0.5">Rs</span>4,82,650
                  </span>
                </div>
              </div>

              {/* 3. Bottom Left Card: Kitchen Ticket Slips (Tight gap right under Network Overview) */}
              <div
                className="absolute top-[220px] left-6 w-[195px] sm:w-[205px] rounded-[16px] border p-3 shadow-lg backdrop-blur-xl z-10"
                style={{
                  background: "rgba(36, 29, 16, 0.45)",
                  borderColor: "rgba(247, 231, 190, 0.14)",
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {/* Left Ticket (Orange accent) */}
                  <div
                    className="rounded-[10px] p-2 space-y-1.5 border"
                    style={{
                      background: "#140c0c",
                      borderColor: "rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <div
                      className="w-8 h-1 rounded-full"
                      style={{ background: "#e04e17" }}
                    ></div>
                    <div className="w-12 h-1 rounded-full bg-white/15"></div>
                    <div className="w-8 h-1 rounded-full bg-white/10"></div>
                  </div>

                  {/* Right Ticket (Gold accent) */}
                  <div
                    className="rounded-[10px] p-2 space-y-1.5 border"
                    style={{
                      background: "#140c0c",
                      borderColor: "rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <div
                      className="w-8 h-1 rounded-full"
                      style={{ background: "#e3b13b" }}
                    ></div>
                    <div className="w-12 h-1 rounded-full bg-white/15"></div>
                    <div className="w-8 h-1 rounded-full bg-white/10"></div>
                  </div>
                </div>
              </div>

              {/* 4. Right Side: Tall Phone Device Mockup */}
              <div
                className="absolute top-6 right-0 w-[170px] sm:w-[178px] h-[340px] rounded-[28px] border-[1.5px] p-3 shadow-2xl backdrop-blur-xl z-10 flex flex-col justify-between"
                style={{
                  background: "#160e0d",
                  borderColor: "rgba(247, 231, 190, 0.16)",
                }}
              >
                <div>
                  {/* Status Bar */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#8d8067] mb-2 px-0.5">
                    <span>11:42</span>
                    <span className="tracking-widest">•••</span>
                  </div>

                  {/* Phone App Card 1: ON THE WAY */}
                  <div
                    className="rounded-[14px] p-2.5 space-y-2 mb-2 border"
                    style={{
                      background: "#1c1210",
                      borderColor: "rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <div
                      className="inline-block px-1.5 py-0.5 rounded-[3px] font-mono text-[8px] font-bold tracking-wider"
                      style={{
                        color: "#e3b13b",
                        background: "rgba(227, 177, 59, 0.12)",
                        border: "1px solid rgba(227, 177, 59, 0.25)",
                      }}
                    >
                      ON THE WAY
                    </div>
                    <div className="w-20 h-1 rounded-full bg-white/15"></div>
                    <div className="w-14 h-1 rounded-full bg-white/10"></div>
                  </div>

                  {/* Phone App Card 2 */}
                  <div
                    className="rounded-[14px] p-2.5 space-y-2 border"
                    style={{
                      background: "#1c1210",
                      borderColor: "rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <div className="w-20 h-1 rounded-full bg-white/15"></div>
                    <div className="w-12 h-1 rounded-full bg-white/10"></div>
                  </div>
                </div>

                {/* 5. Floating Bottom Pill: Rider en route · 12 min (Overlapping Phone) */}
                <div
                  className="absolute bottom-4 -left-11 z-30 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-2xl backdrop-blur-md whitespace-nowrap"
                  style={{
                    background: "#140c0c",
                    borderColor: "rgba(247, 231, 190, 0.22)",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{
                      background: "#e3b13b",
                      boxShadow: "0 0 8px #e3b13b",
                    }}
                  ></span>
                  <span className="font-display font-bold text-[11px] text-[#f7f0dd]">
                    Rider en route · 12 min
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
