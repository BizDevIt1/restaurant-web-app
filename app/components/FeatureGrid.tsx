"use client";

import React from "react";
import FeatureModule from "./FeatureModule";
import ModuleVisualSlider from "./ModuleVisualSlider";
import { motion } from "framer-motion";

export default function FeatureGrid() {
  // TODO: replace these Unsplash/Picsum placeholder images with real Omnibites product screenshots before launch
  const posBillingImages = [
    {
      src: "https://images.unsplash.com/photo-1556742049-0a67daf64f22?auto=format&fit=crop&w=1000&q=80",
      alt: "Restaurant POS counter & card checkout terminal",
      badge: "POS Terminal",
    },
    {
      src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80",
      alt: "Cashier till & receipt billing station",
      badge: "Fast Checkout",
    },
    {
      src: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1000&q=80",
      alt: "Contactless digital mobile payment processing",
      badge: "Card & Mobile Wallet",
    },
    {
      src: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1000&q=80",
      alt: "Thermal receipt printing at restaurant till",
      badge: "Multi-Language Print",
    },
    {
      src: "https://images.unsplash.com/photo-1445116572660-238031888a6a?auto=format&fit=crop&w=1000&q=80",
      alt: "Table order management & bill splitting",
      badge: "Table Billing",
    },
  ];

  // TODO: replace these Unsplash/Picsum placeholder images with real Omnibites product screenshots before launch
  const kdsImages = [
    {
      src: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1000&q=80",
      alt: "Commercial restaurant kitchen line & prep station",
      badge: "Grill Station",
    },
    {
      src: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1000&q=80",
      alt: "Chefs cooking on busy kitchen line",
      badge: "Line Cooking",
    },
    {
      src: "https://images.unsplash.com/photo-1581299894007-aaa50297cf16?auto=format&fit=crop&w=1000&q=80",
      alt: "Kitchen order KOT dispatch & assembly station",
      badge: "KOT Dispatch",
    },
    {
      src: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80",
      alt: "Expo counter & food pass in commercial kitchen",
      badge: "Expo Pass",
    },
    {
      src: "https://images.unsplash.com/photo-1507048331197-7d4ac70811cf?auto=format&fit=crop&w=1000&q=80",
      alt: "Chef finalizing dish plating for instant service",
      badge: "SLA Timers",
    },
  ];

  // TODO: replace these Unsplash/Picsum placeholder images with real Omnibites product screenshots before launch
  const inventoryImages = [
    {
      src: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=80",
      alt: "Restaurant ingredient pantry & stock shelves",
      badge: "Ingredient Stock",
    },
    {
      src: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=80",
      alt: "Fresh kitchen prep ingredients & food stock",
      badge: "Recipe Quantities",
    },
    {
      src: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=1000&q=80",
      alt: "Walk-in cold storage & raw food inventory",
      badge: "Low-Stock Alerts",
    },
    {
      src: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1000&q=80",
      alt: "Chef auditing ingredient stock & recipe costs",
      badge: "Cost Tracking",
    },
    {
      src: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1000&q=80",
      alt: "Commercial kitchen storage & supplier delivery",
      badge: "Auto Reorder",
    },
  ];

  // TODO: replace these Unsplash/Picsum placeholder images with real Omnibites product screenshots before launch
  const multiBranchImages = [
    {
      src: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1000&q=80",
      alt: "Modern restaurant exterior storefront & dining room",
      badge: "Downtown Outlet",
    },
    {
      src: "https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?auto=format&fit=crop&w=1000&q=80",
      alt: "Franchise restaurant dining hall & brand interior",
      badge: "West End Branch",
    },
    {
      src: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1000&q=80",
      alt: "Multi-branch restaurant location storefront",
      badge: "Central Hub",
    },
    {
      src: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1000&q=80",
      alt: "Multi-location restaurant chain operational view",
      badge: "Master HQ Hub",
    },
    {
      src: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1000&q=80",
      alt: "Franchise management dashboard & central control",
      badge: "1-Click Sync",
    },
  ];

  const modules = [
    {
      id: "pos-billing",
      moduleNumber: "MODULE 01",
      title: "POS & Billing",
      description:
        "High-velocity table, takeaway, and delivery checkout. Split bills in your currency, apply custom deals, and issue multi-language thermal receipts with offline cache failover.",
      bullets: [
        "Lightning-fast bill splitting and till checkout in under 2 seconds.",
        "Multi-language thermal receipt printing with offline cache failover.",
        "Integrated card, digital wallet, and instant QR payments.",
        "Custom combo deals, automated tax calculation, and discount authorization PINs.",
      ],
      reverse: false,
      visual: <ModuleVisualSlider title="POS & Billing" images={posBillingImages} />,
    },
    {
      id: "kitchen-display",
      moduleNumber: "MODULE 02",
      title: "Kitchen Display System (KDS)",
      description:
        "Eliminate paper order slips with live colored kitchen screens. Orders update in real time by prep station (Grill, Fry, Drink) with SLA countdown timers.",
      bullets: [
        "Real-time order routing by prep station (Grill, Fry, Assembly, Drinks).",
        "Color-coded SLA countdown timers for zero missed or delayed KOTs.",
        "One-tap status updates (Preparing → Ready → Dispatched) synced live.",
        "Instant cook notification alerts when special customer notes are added.",
      ],
      reverse: true,
      visual: <ModuleVisualSlider title="Kitchen Display System" images={kdsImages} />,
    },
    {
      id: "inventory-recipe",
      moduleNumber: "MODULE 03",
      title: "Inventory & Recipe Management",
      description:
        "Connect menu items to raw ingredient quantities. Auto-deduct stock per order with automated low-stock vendor purchase orders.",
      bullets: [
        "Automatic ingredient deduction per sale (buns, proteins, cheese, oil, and sauces).",
        "Live low-stock alerts with automated vendor purchase order generation.",
        "Recipe cost breakdown in your currency to identify highest-margin menu items.",
        "Waste tracking and stock discrepancy audit logs to reduce food loss by 40%.",
      ],
      reverse: false,
      visual: <ModuleVisualSlider title="Inventory & Recipe Management" images={inventoryImages} />,
    },
    {
      id: "multi-branch-franchise",
      moduleNumber: "MODULE 04",
      title: "Multi-Branch & Franchise Management",
      description:
        "Centralized control across every branch and outlet you operate. Push menu changes, standardize pricing, and compare branch revenues in one master view.",
      bullets: [
        "1-click master menu and price updates pushed instantly across all locations.",
        "Real-time branch sales, margin comparisons, and cashier audit trails in one view.",
        "Multi-tier staff permissions (Super Admin, Branch Manager, Cashier, Cook).",
        "Unified supplier catalog and bulk stock transfers between branches.",
      ],
      reverse: true,
      visual: <ModuleVisualSlider title="Multi-Branch & Franchise Management" images={multiBranchImages} />,
    },
  ];

  return (
    <section id="features" className="py-12 md:py-14 relative overflow-hidden border-b border-[var(--border)]">
      {/* Overall Section Eyebrow & Intro Heading */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 mb-4 sm:mb-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            Core Modules
          </div>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[var(--text-hi)]">
            Engineered Modules for <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Total Food Service Control</span>
          </h2>
          <p className="text-[var(--text-lo)] text-base sm:text-lg leading-relaxed">
            Purpose-built tools designed around the real operational needs of restaurant counters, kitchens, and delivery fleets — anywhere you operate.
          </p>
        </motion.div>
      </div>

      {/* 4 Vertical Horizontal Module Sections */}
      <div>
        {modules.map((module, idx) => (
          <FeatureModule key={module.id} {...module} index={idx} />
        ))}
      </div>
    </section>
  );
}
