"use client";

import React, { useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard,
  Building2,
  ShoppingBag,
  BookOpen,
  ChefHat,
  Armchair,
  Boxes,
  Truck,
  Bike,
  Users,
  Receipt,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  Sun,
  Moon,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdminTab } from "../types";

interface AdminDrawerItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  badge?: string | number | null;
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
  permittedNavItems,
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

  const isPermitted = useCallback(
    (id: string) => {
      if (!permittedNavItems || !Array.isArray(permittedNavItems) || permittedNavItems.length === 0) {
        return true;
      }
      return permittedNavItems.some(
        (p: any) =>
          p &&
          (p.id === id ||
            (id === "kds" && p.id === "kitchen") ||
            (id === "analytics" && p.id === "reports") ||
            (id === "riders" && p.id === "dispatch"))
      );
    },
    [permittedNavItems]
  );

  // Flat 4-column menu items matching Super Admin style
  const visibleMenuItems: AdminDrawerItem[] = useMemo(() => {
    const list: AdminDrawerItem[] = [];

    // 1. Overview
    if (isPermitted("overview")) {
      list.push({ id: "overview", label: "Overview", icon: LayoutDashboard });
    }

    // 2. Branches
    if (isPermitted("branches")) {
      list.push({ id: "branches", label: "Branches", icon: Building2 });
    }

    // 3. POS Counter
    if (isPermitted("pos")) {
      list.push({ id: "pos", label: "POS", icon: ShoppingBag });
    }

    // 4. Menu Management
    if (isPermitted("menu")) {
      list.push({ id: "menu", label: "Menu", icon: BookOpen, badge: counts?.menuAlerts });
    }

    // 5. Kitchen (KDS)
    if (isPermitted("kds") || isPermitted("kitchen")) {
      list.push({ id: "kds", label: "Kitchen", icon: ChefHat, badge: counts?.kdsTickets });
    }

    // 6. Floor & Tables
    if (isPermitted("tables")) {
      list.push({ id: "tables", label: "Tables", icon: Armchair });
    }

    // 7. Inventory & Stock
    if (isPermitted("inventory")) {
      list.push({ id: "inventory", label: "Inventory", icon: Boxes });
    }

    // 8. Procurement & POs
    if (isPermitted("procurement")) {
      list.push({ id: "procurement", label: "Procure", icon: Truck });
    }

    // 9. Rider Dispatch
    if (isPermitted("riders") || isPermitted("dispatch")) {
      list.push({ id: "riders", label: "Riders", icon: Bike, badge: counts?.activeRiders });
    }

    // 10. Staff
    if (isPermitted("staff")) {
      list.push({ id: "staff", label: "Staff", icon: Users, badge: counts?.staffTotal });
    }

    // 11. Expenses
    if (isPermitted("expenses")) {
      list.push({ id: "expenses", label: "Expenses", icon: Receipt });
    }

    // 12. Analytics
    if (isPermitted("analytics") || isPermitted("reports")) {
      list.push({ id: "analytics", label: "Analytics", icon: BarChart3 });
    }

    // 13. Settings
    if (isPermitted("settings")) {
      list.push({ id: "settings", label: "Settings", icon: Settings });
    }

    // 14. Subscription
    if (isPermitted("subscription")) {
      list.push({ id: "subscription", label: "Subscription", icon: CreditCard });
    }

    return list;
  }, [isPermitted, counts]);

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
    <div className="fixed inset-0 z-[100] lg:hidden">
      {/* Dark Backdrop with blur */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Slide-Up Bottom Sheet using theme CSS variables */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className="fixed inset-x-0 bottom-0 z-[101] bg-[var(--bg-deep)] border-t border-[var(--border)] rounded-t-3xl p-5 pb-8 shadow-2xl transition-all duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-300 select-none"
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

        {/* 4-Column Icon Grid matching Super Admin style */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3 pt-4">
          {visibleMenuItems.map((item) => {
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
