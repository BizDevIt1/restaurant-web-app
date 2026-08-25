"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import WhatsAppFloat from "../components/landing/WhatsAppFloat";

export default function TermsPage() {
  useEffect(() => {
    // Set explicit browser tab page title
    document.title = "Terms and Conditions | FoodNet";

    // Scroll reveal observer
    const elements = document.querySelectorAll(".reveal-init");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -60px 0px",
        threshold: 0.1,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 1. Header Navbar */}
      <Navbar />

      <main className="flex-1">
        {/* Ambient Top Glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-[radial-gradient(circle_at_center,var(--gold-dim)_0%,transparent_70%)] pointer-events-none -z-10 opacity-70"
          aria-hidden="true"
        />

        {/* Hero Header */}
        <section className="pt-24 pb-12 md:pt-32 md:pb-16 text-center">
          <div className="max-w-[880px] mx-auto px-4 sm:px-6">
            {/* Breadcrumb */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono text-[var(--text-lo)] mb-6">
              <Link href="/" className="hover:text-[var(--gold)] transition-colors">
                Home
              </Link>
              <span>/</span>
              <span className="text-[var(--gold)]">Legal</span>
              <span>/</span>
              <span className="text-[var(--text-hi)] font-medium">Terms &amp; Conditions</span>
            </div>

            <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[var(--text-hi)] leading-tight mb-4">
              Terms &amp; <span className="text-gradient-gold">Conditions</span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--text-lo)] max-w-2xl mx-auto leading-relaxed">
              Please review these terms carefully. By accessing or using FoodNet’s Point of Sale, Online Ordering, and Restaurant Management OS, you agree to be bound by this agreement.
            </p>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs font-mono text-[var(--text-faint)]">
              <span>Last Updated: August 2026</span>
              <span>•</span>
              <span>Effective in: Pakistan</span>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="pb-24">
          <div className="max-w-[960px] mx-auto px-4 sm:px-6">
            <div className="bg-[var(--bg-deep)]/80 backdrop-blur-xl border border-[var(--border)] rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-14 shadow-2xl space-y-12 text-[var(--text-lo)] text-sm sm:text-base leading-relaxed">
              
              {/* 1. Introduction */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    01
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Acceptance of Terms
                  </h2>
                </div>
                <p>
                  These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between your restaurant business (&quot;Merchant&quot;, &quot;User&quot;, or &quot;You&quot;) and FoodNet Technologies (Pvt) Ltd. (&quot;FoodNet&quot;, &quot;We&quot;, &quot;Us&quot;, or &quot;Our&quot;).
                </p>
                <p>
                  By creating an account, launching a POS terminal, configuring online ordering, or utilizing our kitchen display systems, you confirm that you have read, understood, and agreed to be bound by these Terms and our Privacy Policy.
                </p>
              </div>

              {/* 2. Scope of Services */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    02
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Scope of FoodNet Services
                  </h2>
                </div>
                <p>
                  FoodNet provides an integrated software-as-a-service platform for restaurant operations, including:
                </p>
                <ul className="list-disc list-inside space-y-2 pl-2 text-[var(--text-lo)]">
                  <li><strong className="text-[var(--text-hi)]">Cloud Point of Sale (POS)</strong> with offline synchronization for billing and receipts.</li>
                  <li><strong className="text-[var(--text-hi)]">Kitchen Display System (KDS)</strong> and Waiter QR / Table ordering portals.</li>
                  <li><strong className="text-[var(--text-hi)]">Direct WhatsApp &amp; Web Online Ordering</strong> marketplaces.</li>
                  <li><strong className="text-[var(--text-hi)]">Multi-Branch &amp; Inventory Management</strong> with automated recipe deductions.</li>
                  <li><strong className="text-[var(--text-hi)]">Pakistani Payment Integrations</strong> (JazzCash, Easypaisa, 1Link, Bank Cards).</li>
                </ul>
              </div>

              {/* 3. Account Security & Credentials */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    03
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Merchant Accounts &amp; Terminal Security
                  </h2>
                </div>
                <p>
                  You are responsible for maintaining the confidentiality of all login credentials, branch terminal PINs, and manager overrides. FoodNet is not liable for unauthorized transactions or drawer adjustments resulting from compromised merchant passwords.
                </p>
                <p>
                  You agree to immediately notify FoodNet customer support in the event of unauthorized access to your branch database or admin console.
                </p>
              </div>

              {/* 4. Subscription & Billing */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    04
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Subscriptions, Pricing &amp; Payments in PKR
                  </h2>
                </div>
                <p>
                  All subscription fees are billed in Pakistani Rupees (PKR) according to your selected plan (Starter, Growth, or Multi-Branch Enterprise).
                </p>
                <ul className="list-disc list-inside space-y-2 pl-2 text-[var(--text-lo)]">
                  <li><strong className="text-[var(--text-hi)]">Billing Cycles:</strong> Subscriptions are billed on a monthly or discounted annual cycle in advance.</li>
                  <li><strong className="text-[var(--text-hi)]">0% Commission Promise:</strong> FoodNet does not take a percentage cut from your in-house dine-in or direct online marketplace food orders.</li>
                  <li><strong className="text-[var(--text-hi)]">Taxes:</strong> Fees are exclusive of applicable provincial sales taxes (PRA, SRB, KPRA, BRA) or federal taxes unless explicitly stated on your invoice.</li>
                </ul>
              </div>

              {/* 5. Food Quality & Customer Orders */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    05
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Menu Content, Food Hygiene &amp; Fulfilment
                  </h2>
                </div>
                <p>
                  The Merchant is solely responsible for menu pricing accuracy, item descriptions, allergen warnings, food preparation standards, and timely delivery or table service.
                </p>
                <p>
                  FoodNet acts purely as an infrastructure technology provider and is not responsible for food safety, consumer health claims, or delivery disputes between the restaurant and end-customers.
                </p>
              </div>

              {/* 6. Data Ownership & Privacy */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    06
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Merchant Data Ownership
                  </h2>
                </div>
                <p>
                  You own all customer databases, sales reports, inventory logs, and customer contact information captured through your FoodNet instance. We never sell, rent, or distribute your customer lists or proprietary recipe costs to third parties.
                </p>
              </div>

              {/* 7. Uptime & Offline Operation */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    07
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Service Level, Uptime &amp; Offline Sync
                  </h2>
                </div>
                <p>
                  We aim for 99.9% cloud server uptime. To protect your restaurant during local internet or power load-shedding outages in Pakistan, the FoodNet POS terminal includes automatic offline billing mode, queuing transactions locally and syncing automatically once connectivity restores.
                </p>
              </div>

              {/* 8. Governing Law */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    08
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Governing Law &amp; Dispute Resolution
                  </h2>
                </div>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of the Islamic Republic of Pakistan. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of Lahore / Islamabad, Pakistan.
                </p>
              </div>

              {/* 9. Contact & Support */}
              <div className="space-y-4 pt-6 border-t border-[var(--border)]/60">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center font-mono font-bold text-xs">
                    09
                  </span>
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                    Contacting FoodNet Legal Support
                  </h2>
                </div>
                <p>
                  If you have questions regarding these Terms &amp; Conditions or require enterprise merchant agreements, please contact our legal desk:
                </p>
                <div className="p-4 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] font-mono text-xs sm:text-sm space-y-1 text-[var(--text-hi)]">
                  <div><strong>Email:</strong> legal@foodnet.pk</div>
                  <div><strong>Support Hotline:</strong> +92 (300) 000-FOOD</div>
                  <div><strong>Registered Office:</strong> FoodNet Technologies (Pvt) Ltd., Gulberg III, Lahore, Pakistan</div>
                </div>
              </div>

            </div>

            {/* Bottom Return Action */}
            <div className="mt-10 text-center">
              <Link
                href="/"
                className="btn-gold px-8 py-3.5 text-sm inline-flex items-center gap-2 shadow-lg shadow-[var(--gold-glow)]"
              >
                <span>Return to Home</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 3. Footer */}
      <Footer />

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
