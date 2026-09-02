"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Slide {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  content: React.ReactNode;
}

const slides: Slide[] = [
  {
    id: "pos",
    title: "POS Screen",
    badge: "Frontline Billing",
    badgeColor: "var(--gold)",
    content: (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-xs font-bold border border-[var(--gold)]/30">
              TABLE #04
            </span>
            <span className="text-xs text-[var(--text-lo)]">Waiter: Order Ref #OB-9042</span>
          </div>
          <span className="font-mono text-xs text-[var(--text-hi)] font-bold">Terminal Till #01</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs">
            <div>
              <div className="font-bold text-[var(--text-hi)]">2x Gourmet Beef Smash Burger</div>
              <div className="text-[11px] text-[var(--text-lo)]">+ Extra Cheddar, + Jalapeno</div>
            </div>
            <div className="font-mono font-bold text-[var(--gold)]">$19.00</div>
          </div>
          <div className="flex justify-between p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs">
            <div>
              <div className="font-bold text-[var(--text-hi)]">1x Loaded Truffle Fries</div>
              <div className="text-[11px] text-[var(--text-lo)]">Garlic mayo dip</div>
            </div>
            <div className="font-mono font-bold text-[var(--gold)]">$6.50</div>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border-hi)] flex items-center justify-between text-xs">
          <span className="text-[var(--text-lo)]">Payment Tendered</span>
          <span className="font-mono font-bold text-[var(--olive)]">⚡ Digital Wallet Paid · $25.50</span>
        </div>
      </div>
    ),
  },
  {
    id: "kds",
    title: "KDS Screen",
    badge: "Kitchen Routing",
    badgeColor: "var(--olive)",
    content: (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] text-xs font-mono">
          <span className="text-[var(--text-lo)]">Kitchen Queue: <b className="text-[var(--gold)]">3 Live Tickets</b></span>
          <span className="text-[var(--olive)]">Station 01: Main Grill</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[var(--surface)] border-2 border-[var(--rust)]/60 space-y-2">
            <div className="flex justify-between items-center font-mono text-xs">
              <span className="font-bold text-[var(--text-hi)]">#1180</span>
              <span className="text-[var(--rust)] font-bold animate-pulse">08:42 RUSH</span>
            </div>
            <div className="text-xs text-[var(--text-lo)]">1x Beef Double Stack<br />1x Garlic Wings (6pcs)</div>
            <div className="text-[10px] font-mono text-[var(--rust)] uppercase">Grill Searing</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--gold)]/50 space-y-2">
            <div className="flex justify-between items-center font-mono text-xs">
              <span className="font-bold text-[var(--text-hi)]">#1181</span>
              <span className="text-[var(--gold)] font-bold">04:15 PREP</span>
            </div>
            <div className="text-xs text-[var(--text-lo)]">2x Crispy Zinger<br />2x Regular Fries</div>
            <div className="text-[10px] font-mono text-[var(--gold)] uppercase">Assembling</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "admin",
    title: "Admin Dashboard",
    badge: "Analytics & P&L",
    badgeColor: "var(--gold)",
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-lo)]">Gross Sales</div>
            <div className="font-mono text-sm font-bold text-[var(--gold)] mt-0.5">$4,826.50</div>
            <div className="text-[9px] font-mono text-[var(--olive)]">↑ 24% today</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-lo)]">Orders</div>
            <div className="font-mono text-sm font-bold text-[var(--text-hi)] mt-0.5">142</div>
            <div className="text-[9px] font-mono text-[var(--text-faint)]">Avg $33.98</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-lo)]">KDS SLA</div>
            <div className="font-mono text-sm font-bold text-[var(--olive)] mt-0.5">11m 45s</div>
            <div className="text-[9px] font-mono text-[var(--olive)]">Target &lt; 15m</div>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
          <div className="flex justify-between text-xs font-display font-semibold text-[var(--text-hi)]">
            <span>Peak Hourly Revenue</span>
            <span className="font-mono text-[11px] text-[var(--gold)]">Pk: 8PM - 10PM</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5 items-end h-16 pt-2">
            {[20, 35, 50, 75, 90, 100, 80, 45].map((h, i) => (
              <div
                key={i}
                className="w-full rounded-t bg-gradient-to-t from-[var(--gold)] to-[var(--orange)] opacity-90"
                style={{ height: `${h}%` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "marketplace",
    title: "Marketplace App",
    badge: "Direct Ordering",
    badgeColor: "var(--olive)",
    content: (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] text-xs">
          <span className="font-semibold text-[var(--text-hi)]">Customer Web App · Delivery</span>
          <span className="font-mono text-[var(--gold)] font-bold">25-35 min ETA</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
            <div className="text-2xl text-center py-1">🍔</div>
            <div className="font-bold text-xs text-[var(--text-hi)]">Double Beef Burger</div>
            <div className="font-mono text-xs font-bold text-[var(--gold)]">$9.50</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
            <div className="text-2xl text-center py-1">🍗</div>
            <div className="font-bold text-xs text-[var(--text-hi)]">Peri-Peri Tenders</div>
            <div className="font-mono text-xs font-bold text-[var(--gold)]">$8.20</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border-hi)] flex justify-between items-center text-xs font-mono">
          <span>Checkout Total</span>
          <span className="text-[var(--gold)] font-bold">$17.70 via Card / Wallet</span>
        </div>
      </div>
    ),
  },
  {
    id: "inventory",
    title: "Inventory",
    badge: "Recipe Deduction",
    badgeColor: "var(--gold)",
    content: (
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] text-xs">
          <span className="font-semibold text-[var(--text-hi)]">Live Stock Ledger</span>
          <span className="font-mono text-[var(--rust)] font-bold text-[11px]">1 Low Stock Warning</span>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex justify-between items-center text-xs">
          <div>
            <div className="font-bold text-[var(--text-hi)]">Prime Beef Patties (150g)</div>
            <div className="text-[11px] text-[var(--text-lo)] font-mono">Auto-deducted per burger</div>
          </div>
          <div className="font-mono font-bold text-[var(--olive)] text-right">148 pcs</div>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--rust-dim)]/30 border border-[var(--rust)]/40 flex justify-between items-center text-xs">
          <div>
            <div className="font-bold text-[var(--text-hi)]">Brioche Buns</div>
            <div className="text-[11px] text-[var(--rust)] font-mono">⚠️ Reorder threshold reached</div>
          </div>
          <div className="font-mono font-bold text-[var(--rust)] text-right">28 pcs</div>
        </div>
      </div>
    ),
  },
  {
    id: "reports",
    title: "Reports Page",
    badge: "Nightly Reconciliation",
    badgeColor: "var(--olive)",
    content: (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] text-xs">
          <span className="font-semibold text-[var(--text-hi)]">Payment Breakdown Today</span>
          <span className="font-mono text-[var(--text-lo)]">Daily Settlement</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center">
            <div className="text-[10px] text-[var(--text-lo)]">Cards &amp; Apps</div>
            <div className="font-mono text-xs font-bold text-[var(--gold)] mt-0.5">$2,051.26</div>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center">
            <div className="text-[10px] text-[var(--text-lo)]">Wallets</div>
            <div className="font-mono text-xs font-bold text-[var(--olive)] mt-0.5">$1,336.94</div>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center">
            <div className="text-[10px] text-[var(--text-lo)]">Cash Till</div>
            <div className="font-mono text-xs font-bold text-[var(--text-hi)] mt-0.5">$1,438.30</div>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs space-y-1">
          <div className="font-semibold text-[var(--text-hi)]">End-of-Day Z-Report</div>
          <div className="text-[11px] text-[var(--text-lo)] font-mono flex justify-between">
            <span>Total Settled:</span>
            <span className="font-bold text-[var(--gold)]">$4,826.50</span>
          </div>
        </div>
      </div>
    ),
  },
];

export default function DemoSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused]);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleDotClick = (index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
      },
    }),
  };

  return (
    <div
      className="relative max-w-2xl mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Slider Container Box */}
      <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl p-6 sm:p-8 min-h-[320px] flex flex-col justify-between">
        {/* Animated Slide Content */}
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full flex-1"
          >
            {/* Slide Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
              <h3 className="font-display font-bold text-lg text-[var(--text-hi)]">
                {slides[currentIndex].title}
              </h3>
              <span
                className="px-2.5 py-1 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider border border-current opacity-90"
                style={{
                  color: slides[currentIndex].badgeColor,
                  borderColor: slides[currentIndex].badgeColor,
                  backgroundColor: `${slides[currentIndex].badgeColor}15`,
                }}
              >
                {slides[currentIndex].badge}
              </span>
            </div>

            {/* Slide Custom Inner UI */}
            {slides[currentIndex].content}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons & Progress Dots Bar */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]/60">
          {/* Arrow Left */}
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-colors cursor-pointer"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Dots Indicator Bar */}
          <div className="flex items-center gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleDotClick(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === idx
                    ? "w-7 bg-gradient-to-r from-[var(--gold)] to-[var(--orange)] shadow-sm shadow-[var(--gold-glow)]"
                    : "w-2 bg-[var(--surface-hi)] border border-[var(--border)] hover:bg-[var(--text-faint)]"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Arrow Right */}
          <button
            onClick={handleNext}
            className="p-2 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-colors cursor-pointer"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
