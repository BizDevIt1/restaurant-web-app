"use client";

import React, { useState } from "react";

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does the 14-day free trial work?",
      a: "You get full, unrestricted access to the complete FoodNet Operating System for 14 days without entering any credit card or banking details. You can configure your full menu, test POS billing, send test KDS tickets, and experience the online marketplace firsthand.",
    },
    {
      q: "Can I manage multiple branches across different cities in Pakistan?",
      a: "Yes! FoodNet natively supports multi-branch and multi-city architectures. Whether you have outlets in Lahore, Karachi, Islamabad, or Gujranwala, you can manage master menus, regional pricing, staff PINs, and branch comparisons from a single unified master dashboard.",
    },
    {
      q: "Does the POS work when the internet is down?",
      a: "Absolutely. FoodNet features an offline-first POS engine with local caching. During internet outages or broadband lag, cashiers can continue taking orders, applying discounts, and printing receipts. As soon as the internet recovers, all transactions sync automatically to the cloud.",
    },
    {
      q: "What thermal printers and receipt hardware are supported?",
      a: "FoodNet supports standard 80mm and 58mm ESC/POS thermal printers via USB, Ethernet/LAN, Bluetooth, and Wi-Fi. It prints bilingual receipts (Urdu & English) formatted with Pakistani GST/PST tax numbers and custom QR codes for customer loyalty.",
    },
    {
      q: "How does the online marketplace ordering and rider integration work?",
      a: "You get a dedicated online ordering web storefront and QR code digital menu for your restaurant. Customers place orders directly, pay via JazzCash, Easypaisa, or Cash on Delivery, and your internal riders or integrated 3rd-party logistics dispatch automatically with live GPS tracking.",
    },
    {
      q: "Can FoodNet import existing menu items, inventory, and historical data?",
      a: "Yes. Our onboarding specialists provide free data migration services. You can send us your current Excel sheets, paper menus, or legacy POS exports, and our team will format, verify, and upload your entire item catalog and recipe costs into FoodNet.",
    },
    {
      q: "How are software fees and marketplace commissions calculated?",
      a: "All software plan subscriptions are billed in flat Pakistani Rupees (PKR) monthly or annually with zero foreign exchange fees. Marketplace commissions only apply to orders generated through your digital ordering web storefront (from 4% to 6% based on your chosen tier) with 0% commission on in-house POS dine-in or takeaway.",
    },
    {
      q: "Is technical support and staff onboarding included?",
      a: "Yes, 24/7 localized support via direct WhatsApp and phone is included in every plan. For multi-branch and franchise accounts, we also provide on-site setup and interactive staff training sessions across all major Pakistani cities.",
    },
  ];

  const toggleItem = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-28 relative bg-[var(--bg-deep)]/50 border-y border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Got Questions?
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Frequently Asked Questions
          </h2>
          <p className="text-[var(--text-lo)] text-base">
            Everything you need to know about adopting FoodNet in your restaurant operations.
          </p>
        </div>

        {/* Accordion Container */}
        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? "bg-[var(--surface-hi)] border-[var(--gold)] shadow-lg shadow-[var(--gold-dim)]/40"
                    : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-hi)]"
                }`}
              >
                <button
                  onClick={() => toggleItem(idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="font-display font-bold text-base sm:text-lg text-[var(--text-hi)]">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isOpen
                        ? "rotate-45 bg-[var(--gold)] text-[#241a06] border-[var(--gold)]"
                        : "bg-[var(--surface-hi)] text-[var(--text-lo)]"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>

                <div
                  className={`transition-all duration-300 ease-in-out px-6 overflow-hidden ${
                    isOpen ? "max-h-96 pb-6 opacity-100" : "max-h-0 pb-0 opacity-0"
                  }`}
                >
                  <p className="text-sm text-[var(--text-lo)] leading-relaxed pt-1 border-t border-[var(--border)]/40">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
