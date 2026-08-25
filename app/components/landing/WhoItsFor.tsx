"use client";

import React, { useState } from "react";

interface WhoCardProps {
  title: string;
  tagline: string;
  benefits: string[];
  icon: React.ReactNode;
}

function WhoCard({ title, tagline, benefits, icon }: WhoCardProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -(y * 8), y: x * 8 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="glass-panel p-6 rounded-2xl flex flex-col justify-between group transition-all duration-300 relative border-[var(--border)] hover:border-[var(--orange)]/60 hover:bg-[var(--orange-dim)]/20"
      style={{
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
      }}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="w-11 h-11 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--orange)] flex items-center justify-center group-hover:border-[var(--orange)] group-hover:scale-105 transition-all">
            {icon}
          </div>
          <span className="w-2 h-2 rounded-full bg-[var(--orange)] opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_var(--orange-glow)]"></span>
        </div>

        <h3 className="font-display font-bold text-lg text-[var(--text-hi)] mb-1 group-hover:text-[var(--orange)] transition-colors">
          {title}
        </h3>

        <p className="text-xs font-mono text-[var(--text-lo)] mb-4">
          {tagline}
        </p>

        <ul className="space-y-2 mb-4">
          {benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-lo)]">
              <span className="text-[var(--olive)] font-bold mt-0.5">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-3 border-t border-[var(--border)]/50 flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)] group-hover:text-[var(--text-hi)] transition-colors">
        <span>Tailored Workflow</span>
        <span className="text-[var(--orange)] font-semibold">Ready to deploy →</span>
      </div>
    </div>
  );
}

export default function WhoItsFor() {
  const categories = [
    {
      title: "Single Restaurants",
      tagline: "Dine-in, takeaway & local delivery",
      benefits: [
        "1-station fast POS with thermal billing",
        "Recipe ingredient tracking in PKR",
        "Direct WhatsApp ordering for regulars",
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
        </svg>
      ),
    },
    {
      title: "Cloud Kitchens",
      tagline: "Delivery-only multi-brand setups",
      benefits: [
        "Multi-brand routing to one KDS screen",
        "Direct rider dispatch & cash settlement",
        "Commission-free online marketplace storefront",
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
    },
    {
      title: "Multi-Branch Restaurants",
      tagline: "Regional chains across Pakistan",
      benefits: [
        "Consolidated master admin & sales ledger",
        "City-wide menu & pricing synchronisation",
        "Inter-branch stock transfers & audits",
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      ),
    },
    {
      title: "Franchises",
      tagline: "Strict brand & royalty controls",
      benefits: [
        "Franchisee role permissions & royalty reporting",
        "Standardized recipe specs & portion control",
        "Audit logs for all voids, discounts & cash outs",
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: "Delivery Businesses",
      tagline: "Dedicated food logistics fleets",
      benefits: [
        "Live rider GPS route tracking & status",
        "Rider daily cash-in-hand reconciliation",
        "Geofenced delivery radius & dynamic delivery fee",
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      title: "Cafés & Food Businesses",
      tagline: "Bakeries, beverage bars & snack spots",
      benefits: [
        "Fast-tap barcode scanning & quick addons",
        "Customer loyalty numbers for repeat points",
        "JazzCash & Easypaisa QR instant billing",
      ],
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-20 md:py-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--orange-dim)] border border-[var(--orange)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--orange)]">
            Ecosystem Fit
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Engineered for Every Pakistani Food Format
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg">
            Whether you operate an independent local kitchen in Rawalpindi or a 10-branch franchise across Lahore and Karachi.
          </p>
        </div>

        {/* 6-column / 3-col / 2-col / 1-col grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat, idx) => (
            <WhoCard key={idx} {...cat} />
          ))}
        </div>
      </div>
    </section>
  );
}
