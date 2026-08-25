"use client";

import React from "react";
import { motion } from "framer-motion";

export default function ProblemSolution() {
  const problems = [
    {
      title: "Manual Orders over Phone & Messaging Apps",
      desc: "Orders get missed, kitchen instructions get lost in chat threads, and staff waste peak hours typing receipts by hand.",
    },
    {
      title: "Stock Wastage from Guesswork",
      desc: "No link between sales and inventory. High-cost items run out mid-shift or go unaccounted for in storage.",
    },
    {
      title: "Billing & Cash Register Discrepancies",
      desc: "Manual calculator additions, unrecorded discounts, and cash-drawer mismatches create constant financial leakage.",
    },
    {
      title: "Scattered, Disconnected Systems",
      desc: "A separate delivery portal, a paper kitchen ticket book, a messaging-app rider group, and an offline ledger that never talk to each other.",
    },
    {
      title: "Blind Spot Reporting",
      desc: "Owners only see end-of-month estimates without itemized profit margins, peak-hour velocity, or branch comparisons.",
    },
  ];

  const solutions = [
    {
      title: "Direct Digital Order Pipeline",
      desc: "Orders from dining tables, online ordering, and your direct marketplace route instantly to the kitchen display with zero retyping.",
    },
    {
      title: "Recipe-Linked Inventory Deduction",
      desc: "Every dish sold automatically deducts exact ingredient quantities with live low-stock alerts.",
    },
    {
      title: "Unified Billing with Local & Global Payments",
      desc: "Lightning-fast till checkout with integrated card, wallet, and QR payments, plus automatic tax calculation and thermal printing.",
    },
    {
      title: "All-in-One Restaurant Operations",
      desc: "POS, kitchen display, delivery fleet dispatch, and multi-branch inventory unified into a single live dashboard.",
    },
    {
      title: "Live Real-Time P&L Intelligence",
      desc: "Track sales velocity, highest-margin dishes, hourly trends, and branch performance from anywhere in the world.",
    },
  ];

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-16 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Transformation
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Stop Running Your Restaurant on Fragmented Tools
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg">
            See how Omnibites replaces chaotic paper slips and messaging-app confusion with unified, automated digital precision.
          </p>
        </motion.div>

        {/* Side-by-Side Comparison Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: The Problem Today (Slides in from Left) */}
          <motion.div
            initial={{ opacity: 0, x: -70 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl bg-[var(--rust-dim)]/40 border border-[var(--rust)]/30 p-6 sm:p-8 relative overflow-hidden backdrop-blur-md"
          >
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-[var(--rust)]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--rust)]/20 text-[var(--rust)] border border-[var(--rust)]/40 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-[var(--text-hi)]">
                    The Problem Today
                  </h3>
                  <p className="text-xs text-[var(--text-lo)]">Without Omnibites</p>
                </div>
              </div>
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-[var(--rust)]/20 text-[var(--rust)] font-semibold border border-[var(--rust)]/30">
                CHAOTIC
              </span>
            </div>

            <div className="space-y-5">
              {problems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3.5">
                  <div className="w-5 h-5 rounded-full bg-[var(--rust)]/20 text-[var(--rust)] flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold">
                    ✕
                  </div>
                  <div>
                    <h4 className="font-display font-semibold text-sm text-[var(--text-hi)]">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[var(--text-lo)] mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Panel: How Omnibites Fixes It (Slides in from Right) */}
          <motion.div
            initial={{ opacity: 0, x: 70 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl bg-[var(--olive-dim)]/40 border border-[var(--olive)]/40 p-6 sm:p-8 relative overflow-hidden backdrop-blur-md shadow-xl shadow-[var(--olive-dim)]"
          >
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-[var(--olive)]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--olive)]/20 text-[var(--olive)] border border-[var(--olive)]/40 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-[var(--text-hi)]">
                    How Omnibites Fixes It
                  </h3>
                  <p className="text-xs text-[var(--olive)] font-medium">With Omnibites OS</p>
                </div>
              </div>
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-[var(--olive)]/20 text-[var(--olive)] font-semibold border border-[var(--olive)]/40">
                OPTIMIZED
              </span>
            </div>

            <div className="space-y-5">
              {solutions.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3.5">
                  <div className="w-5 h-5 rounded-full bg-[var(--olive)]/20 text-[var(--olive)] border border-[var(--olive)]/40 flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-display font-semibold text-sm text-[var(--text-hi)]">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[var(--text-lo)] mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
