"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  LayoutGrid,
  Receipt,
  ChefHat,
  Armchair,
  Users,
  Boxes,
  BookOpen,
  Truck,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  X,
  Building2,
  Bike,
  CreditCard,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { AdminTab } from "../types";

interface SubMenuItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

interface MenuItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  subItems?: SubMenuItem[];
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
        (p: any) => p && (p.id === id || (id === "kds" && p.id === "kitchen"))
      );
    },
    [permittedNavItems]
  );

  const isKitchenActive = activeTab === "kds" || activeTab === "tables";
  const isInventoryActive =
    activeTab === "inventory" || activeTab === "menu" || activeTab === "procurement";

  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    kds: true,
    inventory: true,
  });

  useEffect(() => {
    if (isKitchenActive) {
      setOpenAccordions((prev) => ({ ...prev, kds: true }));
    }
  }, [isKitchenActive]);

  useEffect(() => {
    if (isInventoryActive) {
      setOpenAccordions((prev) => ({ ...prev, inventory: true }));
    }
  }, [isInventoryActive]);

  const toggleAccordion = (groupId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpenAccordions((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Structured menu catalog with nested subcategories
  const visibleMenuItems: MenuItem[] = useMemo(() => {
    const list: MenuItem[] = [];

    // 1. Overview
    if (isPermitted("overview")) {
      list.push({ id: "overview", label: "Overview", icon: LayoutGrid });
    }

    // 2. Branches
    if (isPermitted("branches")) {
      list.push({ id: "branches", label: "Branches", icon: Building2 });
    }

    // 3. POS Counter
    if (isPermitted("pos")) {
      list.push({ id: "pos", label: "POS Counter", icon: Receipt });
    }

    // 4. Kitchen Operations (Parent: kds)
    if (isPermitted("kds")) {
      const kdsSubItems: SubMenuItem[] = [];
      if (isPermitted("tables")) {
        kdsSubItems.push({
          id: "tables",
          label: "Floor & Tables",
          icon: Armchair,
        });
      }
      list.push({
        id: "kds",
        label: "Kitchen (KDS)",
        icon: ChefHat,
        badge: counts?.kdsTickets,
        subItems: kdsSubItems,
      });
    }

    // 5. Inventory Suite (Parent: inventory)
    if (isPermitted("inventory")) {
      const invSubItems: SubMenuItem[] = [];
      if (isPermitted("menu")) {
        invSubItems.push({
          id: "menu",
          label: "Menu Management",
          icon: BookOpen,
          badge: counts?.menuAlerts,
        });
      }
      if (isPermitted("procurement")) {
        invSubItems.push({
          id: "procurement",
          label: "Procurement & POs",
          icon: Truck,
        });
      }
      list.push({
        id: "inventory",
        label: "Inventory & Stock",
        icon: Boxes,
        subItems: invSubItems,
      });
    }

    // 6. Rider Dispatch
    if (isPermitted("riders")) {
      list.push({ id: "riders", label: "Rider Dispatch", icon: Bike, badge: counts?.activeRiders });
    }

    // 7. Staff
    if (isPermitted("staff")) {
      list.push({ id: "staff", label: "Staff", icon: Users, badge: counts?.staffTotal });
    }

    // 8. Expenses
    if (isPermitted("expenses")) {
      list.push({ id: "expenses", label: "Expenses", icon: Receipt });
    }

    // 9. Analytics
    if (isPermitted("analytics")) {
      list.push({ id: "analytics", label: "Analytics", icon: BarChart3 });
    }

    // 10. Settings
    if (isPermitted("settings")) {
      list.push({ id: "settings", label: "Settings", icon: Settings });
    }

    // 11. Subscription
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
    <div className="fixed inset-0 z-50 lg:hidden">
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

        {/* Navigation List with Nested Accordion Hierarchy */}
        <div className="space-y-1.5 pt-3">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
            const isAccordionOpen = Boolean(openAccordions[item.id]);

            return (
              <div key={item.id} className="w-full">
                <div
                  onClick={() => {
                    handleSelectTab(item.id);
                    if (hasSubItems && !isAccordionOpen) {
                      setOpenAccordions((prev) => ({ ...prev, [item.id]: true }));
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer select-none ${
                    isActive
                      ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                      : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-5 h-5 shrink-0 ${
                        isActive ? "text-[var(--gold)]" : "text-[var(--text-lo)]"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {Boolean(item.badge && Number(item.badge) > 0) && (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14] text-[10px] font-mono font-bold">
                        {item.badge}
                      </span>
                    )}
                    {hasSubItems && (
                      <button
                        type="button"
                        onClick={(e) => toggleAccordion(item.id, e)}
                        className="p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors cursor-pointer"
                        aria-label={isAccordionOpen ? "Collapse sub-menu" : "Expand sub-menu"}
                      >
                        {isAccordionOpen ? (
                          <ChevronDown className="w-4 h-4 text-[var(--gold)]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--text-lo)]" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-items accordion container */}
                {hasSubItems && isAccordionOpen && (
                  <div className="ml-5 pl-3.5 border-l border-zinc-800 dark:border-zinc-800 space-y-1 my-1.5 transition-all">
                    {item.subItems!.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <div
                          key={sub.id}
                          onClick={() => handleSelectTab(sub.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer select-none ${
                            isSubActive
                              ? "border border-[var(--gold)]/40 bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                              : "border border-transparent text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SubIcon
                              className={`w-4 h-4 shrink-0 ${
                                isSubActive ? "text-[var(--gold)]" : "text-[var(--text-lo)]"
                              }`}
                            />
                            <span className="truncate">{sub.label}</span>
                          </div>
                          {Boolean(sub.badge && Number(sub.badge) > 0) && (
                            <span className="px-1.5 py-0.2 rounded-full bg-[var(--gold)] text-[#342c14] text-[9.5px] font-mono font-bold">
                              {sub.badge}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Log Out Special Card */}
        <div className="pt-4 mt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-[var(--red)]/40 bg-[var(--red-dim)] text-[var(--red)] hover:bg-[var(--red-dim)]/80 transition-all cursor-pointer font-bold text-xs select-none"
          >
            <LogOut className="w-4 h-4 text-[var(--red)]" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
