"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const teaserFaqs = [
    {
      num: "01",
      q: "How does the 14-day free trial work?",
      a: "You get full, unrestricted access to the complete Omnibites operating system for 14 days without entering any credit card or banking details. Configure your full menu, test POS billing, send test kitchen tickets, and try the online marketplace firsthand.",
    },
    {
      num: "02",
      q: "Can I manage multiple branches across different cities or countries?",
      a: "Yes. Professional and higher plans support unlimited branches with a consolidated master dashboard, regardless of location.",
    },
    {
      num: "03",
      q: "Does the POS work when the internet is down?",
      a: "Yes. Local offline cache keeps billing and kitchen ticket printing running, syncing automatically once you're back online.",
    },
  ];

  const toggleItem = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq-teaser" className="py-20 md:py-24 relative bg-[var(--bg-deep)]/50 border-y border-[var(--border)]">
      <div className="max-w-[960px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-mono font-bold uppercase tracking-wider text-[var(--gold)]">
            FREQUENTLY ASKED QUESTIONS
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Got Questions? We Have Answers.
          </h2>
          <p className="text-[var(--text-lo)] text-base max-w-2xl mx-auto">
            Everything you need to know about adopting Omnibites in your restaurant operations.
          </p>
        </div>

        {/* Main Glassmorphic Container Card */}
        <div className="bg-[#140c0c]/80 backdrop-blur-2xl border border-[var(--border)] rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* 3 Teaser Accordion Items */}
          <div className="divide-y divide-[var(--border)]/40">
            {teaserFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className={`py-5 sm:py-6 transition-all duration-300 ${
                    isOpen ? "opacity-100" : "opacity-90 hover:opacity-100"
                  }`}
                >
                  <button
                    onClick={() => toggleItem(idx)}
                    className="w-full flex items-center justify-between text-left gap-4 cursor-pointer focus:outline-none group"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Numbered Gold Badge */}
                      <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono font-bold text-xs flex items-center justify-center shrink-0 group-hover:border-[var(--gold)] transition-colors">
                        {faq.num}
                      </div>
                      <span className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors">
                        {faq.q}
                      </span>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-full border border-[var(--border)] flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isOpen
                          ? "rotate-45 bg-[var(--gold)] text-[#241a06] border-[var(--gold)]"
                          : "bg-[var(--surface-hi)] text-[var(--text-lo)] group-hover:border-[var(--gold)]/50"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </button>

                  <div
                    className={`transition-all duration-300 ease-in-out pl-11 pr-2 overflow-hidden ${
                      isOpen ? "max-h-96 pt-3.5 opacity-100" : "max-h-0 pt-0 opacity-0"
                    }`}
                  >
                    <p className="text-sm sm:text-base text-[var(--text-lo)] leading-relaxed font-normal">
                      {faq.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* View All FAQs Link Button */}
          <div className="mt-8 text-center pt-4 border-t border-[var(--border)]/40">
            <Link
              href="/faq"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full bg-gradient-to-br from-[#f5c85c] via-[#e3b13b] to-[#c99624] text-[#241a06] font-bold text-sm shadow-[0_4px_20px_rgba(227,177,59,0.45)] hover:shadow-[0_6px_28px_rgba(227,177,59,0.65)] hover:-translate-y-0.5 transition-all duration-300 border border-white/30 cursor-pointer"
            >
              <span>View All 8+ FAQs &amp; Knowledge Base</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
