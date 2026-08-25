"use client";

import React, { useState } from "react";

interface FeatureCardProps {
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  metric: string;
}

function FeatureCard({ icon, tag, title, description, metric }: FeatureCardProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -(y * 10), y: x * 10 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="glass-panel p-6 sm:p-7 rounded-2xl flex flex-col justify-between group transition-all duration-300 relative overflow-hidden"
      style={{
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
      }}
    >
      {/* Top accent glow */}
      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-[var(--gold-dim)] blur-2xl group-hover:bg-[var(--gold-glow)] transition-colors opacity-40"></div>

      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--gold)] flex items-center justify-center group-hover:border-[var(--gold)] group-hover:scale-105 transition-all shadow-sm">
            {icon}
          </div>
          <span className="font-mono text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] group-hover:text-[var(--gold)] group-hover:border-[var(--gold)]/40 transition-colors">
            {tag}
          </span>
        </div>

        <h3 className="font-display font-bold text-lg text-[var(--text-hi)] mb-2 group-hover:text-[var(--gold)] transition-colors">
          {title}
        </h3>

        <p className="text-xs sm:text-sm text-[var(--text-lo)] leading-relaxed mb-6">
          {description}
        </p>
      </div>

      <div className="pt-4 border-t border-[var(--border)]/60 flex items-center justify-between">
        <span className="font-mono text-xs text-[var(--text-faint)]">System Benchmark</span>
        <span className="font-mono text-xs font-bold text-[var(--gold)]">{metric}</span>
      </div>
    </div>
  );
}

export default function FeatureGrid() {
  const features = [
    {
      title: "POS & Billing",
      tag: "Module 01",
      description:
        "High-velocity table, takeaway, and delivery checkout. Split bills in PKR, apply custom deals, and issue Urdu/English thermal receipts with offline cache failover.",
      metric: "< 2s Billing Time",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "Online Ordering Marketplace",
      tag: "Module 02",
      description:
        "Your branded online storefront where customers order directly. Zero high third-party aggregator commissions with native JazzCash & Easypaisa checkout.",
      metric: "Direct 0% Cut",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      title: "Kitchen Display System",
      tag: "Module 03",
      description:
        "Eliminate paper order slips with live colored kitchen screens. Orders update real-time by prep station (Grill, Fry, Drink) with SLA countdown timers.",
      metric: "0 Lost KOTs",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "Inventory & Recipe Management",
      tag: "Module 04",
      description:
        "Connect menu items to raw ingredient grammages. Auto-deduct buns, chicken, cheese, and sauces per order with automated low-stock vendor purchase orders.",
      metric: "Down 40% Waste",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: "Multi-Branch & Franchise Management",
      tag: "Module 05",
      description:
        "Centralized control across Lahore, Karachi, Islamabad, and beyond. Push menu changes, standardize pricing, and compare branch revenues in one master view.",
      metric: "1-Click Sync",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: "Reports & Analytics",
      tag: "Module 06",
      description:
        "Granular financial intelligence: hourly sales curve, COGS vs gross margin, staff sales velocity, and payment method audit logs in native PKR.",
      metric: "Live P&L Tracking",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: "Customer Loyalty",
      tag: "Module 07",
      description:
        "WhatsApp and phone-number based reward points. Automatic cashback incentives, birthday offers, and re-engagement campaigns that turn first-timers into regulars.",
      metric: "3.4x Repeat Rate",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      title: "Delivery Management",
      tag: "Module 08",
      description:
        "Manage internal riders or 3rd-party logistics. Live GPS dispatching, rider cash settlement tracking, customer SMS tracking links, and delivery zone geofencing.",
      metric: "Real-time Dispatch",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Core Modules
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)]">
            Eight Engineered Engines for Total Food Service Control
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg">
            Purpose-built tools designed around the exact operational realities of Pakistani kitchens, cashier counters, and delivery fleets.
          </p>
        </div>

        {/* 4-column desktop, 2-col tablet, 1-col mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <FeatureCard key={idx} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
