"use client";

import React, { useEffect } from "react";
import {
  LayoutGrid,
  Receipt,
  Flame,
  Armchair,
  Users,
  BookOpen,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  X,
  Building2,
  Bike,
  Truck,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { AdminTab } from "../types";

interface MenuGridItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

interface AdminMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  theme?: "dark" | "light";
  toggleTheme?: () => void;
  onLogout?: () => void;
  permittedNavItems?: any[];
  counts?: {
    kdsTickets?: number;
    activeRiders?: number;
    staffTotal?: number;
    menuAlerts?: number;
  };
}

export default function AdminMenuDrawer({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  theme = "dark",
  toggleTheme,
  onLogout,
  counts,
}: AdminMenuDrawerProps) {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Standard menu catalog items ordered as requested
  const menuItems: MenuGridItem[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "pos", label: "POS Counter", icon: Receipt },
    { id: "kds", label: "Kitchen (KDS)", icon: Flame, badge: counts?.kdsTickets },
    { id: "tables", label: "Floor & Tables", icon: Armchair },
    { id: "staff", label: "Staff", icon: Users, badge: counts?.staffTotal },
    { id: "menu", label: "Menu Catalog", icon: BookOpen, badge: counts?.menuAlerts },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "branches", label: "Branches", icon: Building2 },
    { id: "riders", label: "Dispatch", icon: Bike, badge: counts?.activeRiders },
    { id: "procurement", label: "Procurement", icon: Truck },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (!isOpen) return null;

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    onClose();
  };

  const handleLogoutClick = () => {
    onClose();
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      {/* Dark Backdrop with blur */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Slide-Up Bottom Sheet using theme CSS variables */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className="fixed inset-x-0 bottom-0 z-50 bg-[var(--bg-deep)] border-t border-[var(--border)] rounded-t-3xl p-5 pb-8 shadow-2xl transition-all duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-300 select-none"
      >
        {/* Pull Handle Pill */}
        <div className="w-12 h-1 bg-[var(--border-hi)] rounded-full mx-auto mb-4" />

        {/* Top Header Row */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <h2 className="text-xl font-bold text-[var(--text-hi)] font-display tracking-tight">
            Menu
          </h2>
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            {toggleTheme && (
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 text-[var(--gold)] hover:opacity-80 transition-opacity cursor-pointer"
                aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5 text-[var(--text-hi)]" />
                )}
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors cursor-pointer"
              aria-label="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4-Column Icon Grid adapting dynamically to theme */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3 pt-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer relative select-none ${
                  isActive
                    ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                    : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-transform group-hover:scale-110 ${
                      isActive ? "text-[var(--gold)]" : "text-[var(--text-hi)]"
                    }`}
                  />
                  {Boolean(item.badge && Number(item.badge) > 0) && (
                    <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-[var(--gold)] text-[var(--bg-deep)] text-[10px] font-mono font-bold flex items-center justify-center shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] sm:text-xs text-center leading-tight line-clamp-2 ${
                    isActive ? "text-[var(--gold)] font-bold" : "text-[var(--text-lo)] font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Log Out Special Card with theme-adaptive red */}
          <button
            type="button"
            onClick={handleLogoutClick}
            className="flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl border border-[var(--red)]/40 bg-[var(--red-dim)] text-[var(--red)] hover:bg-[var(--red-dim)]/80 transition-all cursor-pointer select-none"
          >
            <LogOut className="w-6 h-6 text-[var(--red)]" />
            <span className="text-[11px] sm:text-xs font-bold text-center leading-tight text-[var(--red)]">
              Log Out
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
