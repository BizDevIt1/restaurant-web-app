"use client";

import React from "react";
import { Lock, ShieldAlert, ArrowLeft, CreditCard, Sparkles, Building2 } from "lucide-react";
import { AdminTab } from "../types";

interface ModuleLockedViewProps {
  moduleName: string;
  requiredFeature: string;
  description?: string;
  onNavigate: (tab: AdminTab) => void;
}

const FEATURE_BUNDLE_METADATA: Record<
  string,
  { bundleName: string; entitlementKey: string; details: string; included: string[] }
> = {
  INVENTORY: {
    bundleName: "Inventory & Stock Suite",
    entitlementKey: "inventory_stock",
    details:
      "Enterprise inventory tracking, supplier procurement purchase orders, raw ingredient recipe costing, and menu catalog management.",
    included: ["Raw Materials & Real-time Stock", "Suppliers Directory & POs", "Menu Catalog & Dish Pricing", "Automatic Recipe Stock Deduction"],
  },
  KITCHEN: {
    bundleName: "Kitchen & Floor Operations",
    entitlementKey: "kds_system",
    details:
      "Multi-station kitchen display routing, chef ticket management, prep timers, and dynamic floor section table status matrix.",
    included: ["Multi-Station Kitchen KDS Display", "Live KOT Ticket Sequencing & Cook Timers", "Interactive Floor Matrix & Table Occupancy", "Dine-in Floor Reservations"],
  },
  POS: {
    bundleName: "Cloud POS Counter",
    entitlementKey: "pos_terminal",
    details:
      "High-speed point of sale terminal, instant thermal receipt printing, cash drawer reconciliations, and split payments.",
    included: ["Instant Dine-in / Takeaway / Delivery Billing", "Thermal Printing & Custom Receipt Branding", "Discount & Surcharge Controls", "Shift Cash Drawer Auditing"],
  },
  RIDER: {
    bundleName: "Rider Dispatch & Fleet Telemetry",
    entitlementKey: "rider_app",
    details:
      "Dedicated courier dispatching, live courier geo-telemetry, customer ETA tracking, and digital COD collection settlements.",
    included: ["Live Delivery Courier Dispatch Engine", "Driver Fleet Console & Onboarding", "Zone & Sector Delivery Mapping", "Digital Cash on Delivery (COD) Settlements"],
  },
};

export default function ModuleLockedView({
  moduleName,
  requiredFeature,
  description,
  onNavigate,
}: ModuleLockedViewProps) {
  const bundle = FEATURE_BUNDLE_METADATA[requiredFeature.toUpperCase()] || {
    bundleName: `${requiredFeature} Module`,
    entitlementKey: requiredFeature.toLowerCase(),
    details: "This operational module is not included in your active restaurant subscription plan.",
    included: [],
  };

  return (
    <div className="flex-1 min-h-[80vh] flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300">
      <div className="max-w-2xl w-full glass-panel border border-[var(--border)] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden space-y-8">
        {/* Subtle Ambient Background Glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--gold)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#e04e17]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Badge */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-[var(--border)] pb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-bold tracking-wider uppercase">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Module Not Activated</span>
          </div>

          <span className="font-mono text-xs text-[var(--text-faint)]">
            Required: <span className="text-[var(--gold)] font-bold">{bundle.entitlementKey}</span>
          </span>
        </div>

        {/* Central Lock Graphic & Messaging */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border-hi)] flex items-center justify-center text-[var(--gold)] shadow-inner">
              <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--gold)] stroke-[1.75]" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500 text-amber-400 flex items-center justify-center text-[10px] font-bold font-mono">
              !
            </span>
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-hi)] font-display tracking-tight">
              {moduleName} is Locked
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-lo)] leading-relaxed">
              {description || bundle.details}
            </p>
          </div>
        </div>

        {/* Feature Bundle Breakdown Card */}
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5 space-y-3 font-mono">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-hi)]">
            <Sparkles className="w-4 h-4 text-[var(--gold)]" />
            <span>How to unlock this feature:</span>
          </div>
          <p className="text-xs text-[var(--text-lo)] leading-relaxed font-sans">
            This screen belongs to the <strong className="text-[var(--gold)]">{bundle.bundleName}</strong>. 
            To activate access for your restaurant or branch, your Super Administrator must enable the{" "}
            <code className="px-1.5 py-0.5 rounded bg-[var(--surface-hi)] text-[var(--gold)] text-[11px] font-mono border border-[var(--border)]">
              {bundle.entitlementKey}
            </code>{" "}
            add-on entitlement under your restaurant profile.
          </p>

          {bundle.included.length > 0 && (
            <div className="pt-2 border-t border-[var(--border)]/60">
              <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider block mb-2 font-bold">
                Bundle includes:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans text-[var(--text-lo)]">
                {bundle.included.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate("overview")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-hi)] font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--text-lo)]" />
            <span>Return to Overview</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("subscription")}
            className="w-full sm:w-auto btn-gold animate-sheen px-6 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <CreditCard className="w-4 h-4" />
            <span>View Subscription &amp; Quotas</span>
          </button>
        </div>
      </div>
    </div>
  );
}
