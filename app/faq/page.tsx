"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Mail } from "lucide-react";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import WhatsAppFloat from "../components/landing/WhatsAppFloat";

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const fullFaqs = [
    {
      num: "01",
      q: "How does the 14-day free trial work?",
      a: "You get full, unrestricted access to the complete Omnibites operating system for 14 days without entering any credit card or banking details. Configure your full menu, test POS billing, send test kitchen tickets, and try the online marketplace firsthand.",
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
      a: "Omnibites supports standard ESC/POS-compatible thermal printers over USB and LAN, with multi-language receipt templates.",
    },
    {
      num: "05",
      q: "How does online marketplace ordering and rider integration work?",
      a: "Your branded storefront routes orders directly into the same kitchen display and POS system, with support for internal riders or third-party delivery fleets.",
    },
    {
      num: "06",
      q: "Can Omnibites import existing menu items, inventory, and historical data?",
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

      <main className="flex-1 pt-28 pb-24">
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
            Everything you need to know about Omnibites POS, KDS, inventory, hardware compatibility, pricing, and onboarding.
          </p>

          {/* Meta Info */}
          <div className="flex items-center justify-center gap-3 font-mono text-xs text-[var(--text-faint)] pt-1">
            <span>Last Updated: August 2026</span>
            <span>&bull;</span>
            <span>24/7 Knowledge Base</span>
          </div>
        </div>

        {/* Main Glassmorphic Container Card (960px max-width) */}
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <div className="bg-[#140c0c]/80 backdrop-blur-2xl border border-[var(--border)] rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            {/* Ambient Inner Glow */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-[var(--gold-dim)] rounded-full blur-3xl opacity-15 pointer-events-none" />

            {/* Accordion List */}
            <div className="divide-y divide-[var(--border)]/40">
              {fullFaqs.map((faq, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`py-5 sm:py-6 transition-all duration-300 ${
                      isOpen ? "opacity-100" : "opacity-90 hover:opacity-100"
                    }`}
                  >
                    {/* Header Button */}
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
                        {/* Title */}
                        <h2 className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors">
                          {faq.q}
                        </h2>
                      </div>

                      {/* Expand / Collapse Icon */}
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

                    {/* Expandable Answer Content */}
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

            {/* Callout Infobox */}
            <div className="mt-8 pt-6 border-t border-[var(--border)]/60">
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] font-mono text-xs text-[var(--text-hi)] space-y-2">
                <p className="font-bold text-[var(--gold)] uppercase tracking-wider text-[11px]">
                  Need Direct Support or Custom Hardware Setup?
                </p>
                <p className="text-[var(--text-lo)] font-sans text-xs sm:text-sm leading-relaxed">
                  Email: <strong className="text-[var(--text-hi)]">contact@omnibites.com</strong> &bull; Hotline: <strong className="text-[var(--text-hi)]">+1 (800) 555-0199</strong> &bull; Company: <strong className="text-[var(--text-hi)]">Omnibites Technologies Inc.</strong>
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
