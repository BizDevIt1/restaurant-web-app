"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Mail } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WhatsAppFloat from "../components/WhatsAppFloat";

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const fullFaqs = [
    {
      num: "01",
      q: "How does the 14-day free trial work?",
      a: (
        <span>
          You get full, unrestricted access to the complete <span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span> operating system for 14 days without entering any credit card or banking details. Configure your full menu, test POS billing, send test kitchen tickets, and try the online marketplace firsthand.
        </span>
      ),
    },
    {
      num: "02",
      q: "Can I manage multiple branches across different locations?",
      a: "Yes. Professional and higher plans support multi-branch networks with a consolidated master dashboard, regardless of location.",
    },
    {
      num: "03",
      q: "Does the POS work when the internet is down?",
      a: "Yes. Local offline cache keeps billing and kitchen ticket printing running, syncing automatically once you're back online.",
    },
    {
      num: "04",
      q: "What thermal printers and receipt hardware are supported?",
      a: (
        <span>
          <span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span> supports standard ESC/POS-compatible thermal printers over USB and LAN, with multi-language receipt templates.
        </span>
      ),
    },
    {
      num: "05",
      q: "How does online marketplace ordering and rider integration work?",
      a: "Your branded storefront routes orders directly into the same kitchen display and POS system, with support for internal riders or third-party delivery fleets.",
    },
    {
      num: "06",
      q: (
        <span>
          Can <span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span> import existing menu items, inventory, and historical data?
        </span>
      ),
      a: "In most cases, yes — our team helps migrate your existing menu, inventory, and customer data during onboarding.",
    },
    {
      num: "07",
      q: "How are software fees and marketplace commissions calculated?",
      a: "Subscription fees depend on your plan; marketplace commission (if any) is confirmed with our sales team based on your setup.",
    },
    {
      num: "08",
      q: "Is technical support and staff onboarding included?",
      a: "Yes, every plan includes support, with onboarding and priority levels increasing on higher-tier plans.",
    },
  ];

  const toggleItem = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text-hi)] font-sans">
      {/* Top Navbar */}
      <Navbar />

      <main className="flex-1 pt-28 md:pt-32 pb-24">
        {/* Hero Section */}
        <div className="max-w-[880px] mx-auto px-4 sm:px-6 text-center mb-10 space-y-4">
          {/* Breadcrumb Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] font-mono text-xs text-[var(--text-lo)] mb-2">
            <Link href="/" className="hover:text-[var(--gold)] transition-colors">
              Home
            </Link>
            <span className="text-[var(--text-faint)]">/</span>
            <span className="text-[var(--text-faint)]">Help Center</span>
            <span className="text-[var(--text-faint)]">/</span>
            <span className="text-[var(--text-hi)] font-medium">FAQ</span>
          </div>

          {/* Hero Title */}
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[var(--text-hi)] tracking-tight leading-tight">
            Frequently Asked <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Questions</span>
          </h1>

          {/* Hero Subtitle */}
          <p className="text-[var(--text-lo)] text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Everything you need to know about <span className="font-semibold"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span></span> POS, KDS, inventory, hardware compatibility, pricing, and onboarding.
          </p>

          {/* Meta Info */}
          <div className="flex items-center justify-center gap-3 font-mono text-xs text-[var(--text-faint)] pt-1">
            <span>Last Updated: August 2026</span>
            <span>&bull;</span>
            <span>24/7 Knowledge Base</span>
          </div>
        </div>

        {/* 8 FAQs Modern Container */}
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <div className="bg-[var(--surface)]/90 backdrop-blur-2xl border border-[var(--border)] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--gold-dim)] rounded-full blur-3xl opacity-30 pointer-events-none" />

            <div className="divide-y divide-[var(--border)]/60 relative z-10">
              {fullFaqs.map((faq, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div key={idx} className="py-5 sm:py-6 transition-all duration-300">
                    <button
                      onClick={() => toggleItem(idx)}
                      className="w-full flex items-start justify-between gap-4 text-left group cursor-pointer focus:outline-none"
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="font-mono text-xs text-[var(--gold)] font-bold pt-1 shrink-0">
                          {faq.num}
                        </span>
                        <span className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors">
                          {faq.q}
                        </span>
                      </div>
                      <div
                        className={`w-7 h-7 rounded-full border border-[var(--border)] flex items-center justify-center text-xs shrink-0 transition-transform duration-300 ${
                          isOpen
                            ? "rotate-180 bg-[var(--gold)] text-[#241a06] border-[var(--gold)]"
                            : "bg-[var(--surface-hi)] text-[var(--text-lo)] group-hover:border-[var(--gold)]"
                        }`}
                      >
                        ↓
                      </div>
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        isOpen ? "max-h-60 opacity-100 mt-3 pl-7" : "max-h-0 opacity-0"
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

            {/* Callout Infobox */}
            <div className="mt-8 pt-6 border-t border-[var(--border)]/60">
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] font-mono text-xs text-[var(--text-hi)] space-y-2">
                <p className="font-bold text-[var(--gold)] uppercase tracking-wider text-[11px]">
                  Need Direct Support or Custom Hardware Setup?
                </p>
                <p className="text-[var(--text-lo)] font-sans text-xs sm:text-sm leading-relaxed">
                  Email: <strong className="text-[var(--text-hi)]">contact@omnibites.com</strong> &bull; Hotline: <strong className="text-[var(--text-hi)]">+1 (800) 555-0199</strong> &bull; Company: <strong className="text-[var(--text-hi)]"><span className="text-[#f7f0dd]">Omni</span><span className="text-[#f5a623]">bites</span> Technologies Inc.</strong>
                </p>
              </div>
            </div>

            {/* Return CTA Gold Button */}
            <div className="mt-8 text-center pt-2">
              <a
                href="https://wa.me/923001234567"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full bg-gradient-to-br from-[#f5c85c] via-[#e3b13b] to-[#c99624] text-[#241a06] font-bold text-sm shadow-[0_4px_20px_rgba(227,177,59,0.45)] hover:shadow-[0_6px_28px_rgba(227,177,59,0.65)] hover:-translate-y-0.5 transition-all duration-300 border border-white/30 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat with Support on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* WhatsApp Float Widget */}
      <WhatsAppFloat />
    </div>
  );
}
