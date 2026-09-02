"use client";

import React from "react";

export default function SecuritySection() {
  const securityItems = [
    {
      title: "Cloud Backups",
      desc: "Every order, payment, and inventory update is encrypted and continuously synced to secure cloud redundancy.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
    },
    {
      title: "Role-Based Access",
      desc: "PIN-protected cashier, kitchen, and manager profiles ensure staff only access their designated workflows.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      title: "Secure Tenant Separation",
      desc: "Complete database isolation prevents cross-organization data access with strict enterprise encryption at rest.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: "Offline POS Support",
      desc: "If your internet drops, local cache keeps tills billing and tickets printing without a second of downtime.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.166a1 1 0 111.414 1.414" />
        </svg>
      ),
    },
    {
      title: "Secure Payments",
      desc: "Zero stored card info. Tokenized digital wallet and 3DS payment gateway checkouts.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      title: "Regular Backups",
      desc: "Automated hourly database snapshots with point-in-time recovery and zero data-loss architecture.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      title: "Activity & Audit Logs",
      desc: "Full forensic traceability on every bill void, discount, drawer pop, and manual ingredient adjustment.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      title: "Uptime Monitoring",
      desc: "99.9% guaranteed platform SLA with proactive multi-region health checks and auto-scaling capacity.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-14 md:py-16 relative border-b border-[var(--border)]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--olive-dim)] border border-[var(--olive)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--olive)]">
            Security &amp; Resilience
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Mission-Critical Reliability for <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Non-Stop Rush Hours</span>
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg">
            Built with enterprise-grade resilience so you never lose an order during internet interruptions or evening rush periods.
          </p>
        </div>

        {/* 4-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {securityItems.map((item, idx) => (
            <div
              key={idx}
              className="glass-panel p-6 rounded-2xl flex flex-col justify-between group hover:border-[var(--olive)]/60 transition-all duration-300"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-[var(--olive-dim)] text-[var(--olive)] border border-[var(--olive)]/40 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  {item.icon}
                </div>

                <h3 className="font-display font-bold text-base text-[var(--text-hi)] mb-2 group-hover:text-[var(--olive)] transition-colors">
                  {item.title}
                </h3>

                <p className="text-xs text-[var(--text-lo)] leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--border)]/50 flex items-center gap-1.5 text-[11px] font-mono text-[var(--olive)]">
                <span>Active Protection</span>
                <span>✓</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
