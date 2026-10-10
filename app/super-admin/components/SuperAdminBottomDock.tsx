"use client";

import React from "react";
import {
  LayoutDashboard,
  Store,
  Layers,
  Menu,
} from "lucide-react";

interface SuperAdminBottomDockProps {
  activeNav: string;
  onSelectNav: (nav: string) => void;
  onOpenMenuDrawer: () => void;
  userInitials?: string;
  isHidden?: boolean;
}

export default function SuperAdminBottomDock({
  activeNav,
  onSelectNav,
  onOpenMenuDrawer,
  userInitials = "SA",
  isHidden = false,
}: SuperAdminBottomDockProps) {
  if (isHidden) return null;

  const isDashboardActive = activeNav === "Dashboard";
  const isRestaurantsActive = activeNav === "Restaurants";
  const isPlansActive = activeNav === "Subscriptions & Plans";

  return (
    <nav
      aria-label="Super Admin Mobile Navigation Dock"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-t border-[var(--border)] px-3 py-2 flex items-center justify-between shadow-2xl select-none transition-colors duration-200"
    >
      {/* Brand / User Avatar Pill */}
      <div className="flex items-center justify-center pl-1 pr-2 shrink-0">
        <div className="w-8 h-8 rounded-full bg-[var(--surface-hi)] border border-[var(--border-hi)] flex items-center justify-center font-bold text-xs text-[var(--gold)] font-mono shadow-inner">
          {userInitials}
        </div>
      </div>

      {/* Dock Navigation Items: Exactly 2 Core Tabs + 1 Menu Trigger Button */}
      <div className="flex-1 flex items-center justify-around gap-2 max-w-sm mx-auto">
        {/* Core Tab 1: Dashboard */}
        <button
          type="button"
          onClick={() => onSelectNav("Dashboard")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer ${
            isDashboardActive
              ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
              : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span className="leading-none text-[11px] truncate">Dashboard</span>
        </button>

        {/* Core Tab 2: Restaurants */}
        <button
          type="button"
          onClick={() => onSelectNav("Restaurants")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer ${
            isRestaurantsActive
              ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
              : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
          }`}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span className="leading-none text-[11px] truncate">Restaurants</span>
        </button>

        {/* Dedicated Menu Trigger Button */}
        <button
          type="button"
          onClick={onOpenMenuDrawer}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
        >
          <Menu className="w-4 h-4 shrink-0" />
          <span className="leading-none text-[11px] truncate">Menu</span>
        </button>
      </div>
    </nav>
  );
}
