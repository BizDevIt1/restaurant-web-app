"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Flame,
  Bike,
  ShieldCheck,
  Building2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../admin/context/AuthContext";

export default function TerminalRoleDispatcher() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const rawRole = (user.staffRole || user.role || "").toLowerCase().trim();

    if (rawRole === "cashier") {
      router.replace("/terminal/pos");
    } else if (rawRole === "chef" || rawRole === "kitchen") {
      router.replace("/terminal/kitchen");
    } else if (rawRole === "rider") {
      router.replace("/terminal/rider");
    } else if (rawRole === "manager" || rawRole === "supervisor") {
      router.replace("/terminal/manager");
    } else if (user.terminalAccess === "POS_ONLY") {
      router.replace("/terminal/pos");
    } else if (user.terminalAccess === "KDS_ONLY") {
      router.replace("/terminal/kitchen");
    } else if (user.terminalAccess === "RIDER_ONLY") {
      router.replace("/terminal/rider");
    } else if ((user.terminalAccess as any) === "MANAGER_ONLY") {
      router.replace("/terminal/manager");
    }
  }, [user, router]);

  // If user is Admin, Manager or multi-role, display the 4-tier station launcher
  return (
    <div className="h-full w-full flex items-center justify-center p-6 bg-[var(--bg-deep)]">
      <div className="max-w-3xl w-full glass-panel rounded-3xl border border-[var(--border)] p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 mx-auto flex items-center justify-center text-[var(--gold)] shadow-inner">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold font-display text-[var(--text-hi)]">
            4-Tier Staff Terminals Portal
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {/* Tier 1: Cashier / POS station */}
          <button
            type="button"
            onClick={() => router.push("/terminal/pos")}
            className="flex flex-col items-center text-center p-5 rounded-2xl bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/60 transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-[var(--text-hi)] font-sans">
              POS Terminal
            </span>
            <span className="text-[10px] font-mono text-[var(--text-faint)] mt-1">
              Billing &amp; Settlement
            </span>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-mono font-bold text-[var(--gold)] opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Tier 2: Kitchen / KDS station */}
          <button
            type="button"
            onClick={() => router.push("/terminal/kitchen")}
            className="flex flex-col items-center text-center p-5 rounded-2xl bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)] hover:border-orange-500/60 transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Flame className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-[var(--text-hi)] font-sans">
              KDS Terminal
            </span>
            <span className="text-[10px] font-mono text-[var(--text-faint)] mt-1">
              Live Cooking Queue
            </span>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-mono font-bold text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Tier 3: Rider / Dispatch station */}
          <button
            type="button"
            onClick={() => router.push("/terminal/rider")}
            className="flex flex-col items-center text-center p-5 rounded-2xl bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)] hover:border-blue-500/60 transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Bike className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-[var(--text-hi)] font-sans">
              Rider Terminal
            </span>
            <span className="text-[10px] font-mono text-[var(--text-faint)] mt-1">
              Deliveries &amp; Tracking
            </span>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-mono font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Tier 4: Manager Station */}
          <button
            type="button"
            onClick={() => router.push("/terminal/manager")}
            className="flex flex-col items-center text-center p-5 rounded-2xl bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border border-[var(--border)] hover:border-emerald-500/60 transition-all cursor-pointer group shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-[var(--text-hi)] font-sans">
              Manager Station
            </span>
            <span className="text-[10px] font-mono text-[var(--text-faint)] mt-1">
              Shifts &amp; Overrides
            </span>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Open</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="text-xs font-mono text-[var(--text-faint)] hover:text-[var(--gold)] underline cursor-pointer"
          >
            Back to Web Admin Portal
          </button>
        </div>
      </div>
    </div>
  );
}
