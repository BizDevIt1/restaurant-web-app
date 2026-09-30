"use client";

import React from "react";
import {
  LayoutGrid,
  Receipt,
  Flame,
  Menu,
} from "lucide-react";
import { AdminTab } from "../types";

interface AdminBottomDockProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  onOpenMenuDrawer: () => void;
  kdsCount?: number;
  userInitials?: string;
  restaurantName?: string;
  isHidden?: boolean;
  hasPos?: boolean;
  hasKitchen?: boolean;
}

export default function AdminBottomDock({
  activeTab,
  setActiveTab,
  onOpenMenuDrawer,
  kdsCount = 0,
  userInitials = "N",
  isHidden = false,
  hasPos = true,
  hasKitchen = true,
}: AdminBottomDockProps) {
  if (isHidden) return null;

  const isDashboardActive = activeTab === "overview" || activeTab === "branches";
  const isPosActive = activeTab === "pos";
  const isKdsActive = activeTab === "kds";

  return (
    <nav
      aria-label="Mobile Navigation Dock"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-t border-[var(--border)] px-3 py-2 flex items-center justify-between shadow-2xl select-none transition-colors duration-200"
    >
      {/* Brand / User Avatar Pill */}
      <div className="flex items-center justify-center pl-1 pr-2 shrink-0">
        <div className="w-8 h-8 rounded-full bg-[var(--surface-hi)] border border-[var(--border-hi)] flex items-center justify-center font-bold text-xs text-[var(--gold)] font-mono shadow-inner">
          {userInitials}
        </div>
      </div>

      {/* Dock Navigation Items */}
      <div className="flex-1 flex items-center justify-around gap-1 max-w-md mx-auto">
        {/* Tab 1: Dashboard / Overview */}
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex flex-col items-center justify-center gap-1 min-w-[64px] py-1 transition-all cursor-pointer ${
            isDashboardActive
              ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
              : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
          }`}
        >
          <LayoutGrid className="w-4 h-4 shrink-0" />
          <span className="leading-none text-[11px]">Dashboard</span>
        </button>

        {/* Tab 2: POS Counter (only if entitled) */}
        {hasPos && (
          <button
            type="button"
            onClick={() => setActiveTab("pos")}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] py-1 transition-all cursor-pointer ${
              isPosActive
                ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span className="leading-none text-[11px]">POS</span>
          </button>
        )}

        {/* Tab 3: Kitchen KDS (only if entitled) */}
        {hasKitchen && (
          <button
            type="button"
            onClick={() => setActiveTab("kds")}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] py-1 transition-all cursor-pointer relative ${
              isKdsActive
                ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
            }`}
          >
            <div className="relative">
              <Flame className="w-4 h-4 shrink-0" />
              {kdsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-[var(--gold)] text-[var(--bg-deep)] text-[9px] font-mono font-bold flex items-center justify-center">
                  {kdsCount > 9 ? "9+" : kdsCount}
                </span>
              )}
            </div>
            <span className="leading-none text-[11px]">Kitchen</span>
          </button>
        )}

        {/* Tab 4: Menu Trigger Button */}
        <button
          type="button"
          onClick={onOpenMenuDrawer}
          className="flex flex-col items-center justify-center gap-1 min-w-[64px] py-1 transition-all cursor-pointer text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
        >
          <Menu className="w-4 h-4 shrink-0" />
          <span className="leading-none text-[11px]">Menu</span>
        </button>
      </div>
    </nav>
  );
}
