"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ShoppingBag,
  ChefHat,
  Armchair,
  Boxes,
  BookOpen,
  Truck,
  Receipt,
  Users,
  Bike,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdminTab } from "../types";
import { useAuth } from "../context/AuthContext";
import { getPermittedNavigation } from "../navigationConfig";
import { TAB_TO_PATH } from "../AdminDashboardClient";

export interface SubNavItemConfig {
  id: AdminTab | string;
  label: string;
  icon: LucideIcon;
  path: string;
  badgeKey?: string;
}

export interface NavItemConfig {
  id: AdminTab | string;
  label: string;
  icon: LucideIcon;
  path: string;
  badgeKey?: string;
  subItems?: SubNavItemConfig[];
}

// Ensure standard fallback nav items array is present
export const allNavItems: NavItemConfig[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/admin" },
  { id: "pos", label: "POS Counter", icon: ShoppingBag, path: "/admin/pos", badgeKey: "pos" },
  {
    id: "kds",
    label: "Kitchen (KDS)",
    icon: ChefHat,
    path: "/admin/kitchen",
    badgeKey: "kds",
    subItems: [
      { id: "tables", label: "Floor & Tables", icon: Armchair, path: "/admin/tables" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory & Stock",
    icon: Boxes,
    path: "/admin/inventory",
    subItems: [
      { id: "menu", label: "Menu Management", icon: BookOpen, path: "/admin/menu", badgeKey: "menu" },
      { id: "procurement", label: "Procurement & POs", icon: Truck, path: "/admin/procurement" },
    ],
  },
  { id: "expenses", label: "Expenses", icon: Receipt, path: "/admin/expenses" },
  { id: "staff", label: "Staff Management", icon: Users, path: "/admin/staff", badgeKey: "staff" },
  { id: "riders", label: "Rider Dispatch", icon: Bike, path: "/admin/dispatch", badgeKey: "riders" },
  { id: "analytics", label: "Analytics", icon: BarChart3, path: "/admin/reports" },
  { id: "settings", label: "Settings", icon: Settings, path: "/admin/settings" },
  { id: "subscription", label: "Subscription", icon: CreditCard, path: "/admin/subscription" },
];

export interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  counts: {
    kdsTickets: number;
    activeRiders: number;
    staffTotal: number;
    branchesTotal: number;
    menuAlerts: number;
  };
  theme?: "dark" | "light";
  toggleTheme?: () => void;
  permittedNavItems?: any[];
}

// Preferred vertical order for flat sidebar navigation
const PREFERRED_TAB_ORDER: string[] = [
  "overview",
  "branches",
  "pos",
  "kds",
  "kitchen",
  "tables",
  "inventory",
  "procurement",
  "menu",
  "riders",
  "dispatch",
  "staff",
  "expenses",
  "analytics",
  "reports",
  "settings",
  "subscription",
];

export function AdminSidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen = false,
  setIsMobileOpen,
  counts,
  permittedNavItems: propPermittedNavItems,
}: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Robustly derive permitted navigation items strictly according to active entitlements
  const permittedNavItems: any[] = React.useMemo(() => {
    if (propPermittedNavItems !== undefined && Array.isArray(propPermittedNavItems)) {
      return propPermittedNavItems;
    }
    if (user && typeof getPermittedNavigation === "function") {
      return getPermittedNavigation(user.role, user.assignedFeatures || [], user.terminalAccess);
    }
    return [];
  }, [propPermittedNavItems, user?.role, user?.assignedFeatures, user?.terminalAccess]);

  const isPermitted = React.useCallback(
    (id: string) => {
      if (!permittedNavItems || permittedNavItems.length === 0) return true;
      return permittedNavItems.some(
        (item: any) => item && (item.id === id || (id === "kds" && item.id === "kitchen"))
      );
    },
    [permittedNavItems]
  );

  const [openAccordions, setOpenAccordions] = React.useState<Record<string, boolean>>({
    kds: true,
    inventory: true,
  });

  const isKitchenActive = activeTab === "kds" || activeTab === "tables";
  const isInventoryActive =
    activeTab === "inventory" || activeTab === "menu" || activeTab === "procurement";

  // Automatically expand accordion when parent or child is active
  React.useEffect(() => {
    if (isKitchenActive) {
      setOpenAccordions((prev) => ({ ...prev, kds: true }));
    }
  }, [isKitchenActive]);

  React.useEffect(() => {
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

  // Hierarchical navigation items:
  // Kitchen Operations (kds) has sub-item Floor & Tables (tables)
  // Inventory Suite (inventory) has sub-items Menu Management (menu) and Procurement & POs (procurement)
  const navList: NavItemConfig[] = React.useMemo(() => {
    const list: NavItemConfig[] = [];

    // 1. Overview
    if (isPermitted("overview")) {
      list.push({ id: "overview", label: "Overview", icon: LayoutDashboard, path: "/admin" });
    }

    // 2. Branches (Franchise Owner only)
    if (user?.role === "FRANCHISE_OWNER" && isPermitted("branches")) {
      list.push({ id: "branches", label: "Branches", icon: Building2, path: "/admin/branches", badgeKey: "branches" });
    }

    // 3. POS Counter
    if (isPermitted("pos")) {
      list.push({ id: "pos", label: "POS Counter", icon: ShoppingBag, path: "/admin/pos", badgeKey: "pos" });
    }

    // 4. Kitchen Operations (Parent: kds)
    if (isPermitted("kds")) {
      const kdsSubItems: SubNavItemConfig[] = [];
      if (isPermitted("tables")) {
        kdsSubItems.push({
          id: "tables",
          label: "Floor & Tables",
          icon: Armchair,
          path: "/admin/tables",
        });
      }
      list.push({
        id: "kds",
        label: "Kitchen (KDS)",
        icon: ChefHat,
        path: "/admin/kitchen",
        badgeKey: "kds",
        subItems: kdsSubItems,
      });
    }

    // 5. Inventory Suite (Parent: inventory)
    if (isPermitted("inventory")) {
      const invSubItems: SubNavItemConfig[] = [];
      if (isPermitted("menu")) {
        invSubItems.push({
          id: "menu",
          label: "Menu Management",
          icon: BookOpen,
          path: "/admin/menu",
          badgeKey: "menu",
        });
      }
      if (isPermitted("procurement")) {
        invSubItems.push({
          id: "procurement",
          label: "Procurement & POs",
          icon: Truck,
          path: "/admin/procurement",
        });
      }
      list.push({
        id: "inventory",
        label: "Inventory & Stock",
        icon: Boxes,
        path: "/admin/inventory",
        subItems: invSubItems,
      });
    }

    // 6. Rider Dispatch
    if (isPermitted("riders")) {
      list.push({ id: "riders", label: "Rider Dispatch", icon: Bike, path: "/admin/dispatch", badgeKey: "riders" });
    }

    // 7. Staff Management
    if (isPermitted("staff")) {
      list.push({ id: "staff", label: "Staff Management", icon: Users, path: "/admin/staff", badgeKey: "staff" });
    }

    // 8. Expenses
    if (isPermitted("expenses")) {
      list.push({ id: "expenses", label: "Expenses", icon: Receipt, path: "/admin/expenses" });
    }

    // 9. Analytics
    if (isPermitted("analytics")) {
      list.push({ id: "analytics", label: "Analytics", icon: BarChart3, path: "/admin/reports" });
    }

    // 10. Settings
    if (isPermitted("settings")) {
      list.push({ id: "settings", label: "Settings", icon: Settings, path: "/admin/settings" });
    }

    // 11. Subscription
    if (isPermitted("subscription")) {
      list.push({ id: "subscription", label: "Subscription", icon: CreditCard, path: "/admin/subscription" });
    }

    return list;
  }, [isPermitted, user?.role]);

  const isNavActive = (itemId: AdminTab | string) => {
    if (activeTab === itemId) return true;
    if ((itemId === "kds" || itemId === "kitchen") && activeTab === "kds") return true;
    if ((itemId === "riders" || itemId === "dispatch") && activeTab === "riders") return true;
    if ((itemId === "analytics" || itemId === "reports" || itemId === "orders") && (activeTab === "analytics" || activeTab === "orders")) return true;
    return false;
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("admin_sidebar_collapsed", String(next));
        document.cookie = `admin_sidebar_collapsed=${next}; path=/; max-age=31536000; SameSite=Lax`;
      } catch { }
      return next;
    });
  };

  const handleTabClick = (tabId: AdminTab | string) => {
    const resolvedTab = (tabId === "reports" ? "analytics" : tabId) as AdminTab;
    setActiveTab(resolvedTab);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const handleLogoutClick = () => {
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
    logout();
  };

  const getBadgeForNav = (badgeKey?: string) => {
    if (!badgeKey) return null;
    switch (badgeKey) {
      case "staff":
        return `${counts.staffTotal}`;
      case "menu":
        return null;
      case "pos":
        return "Live";
      case "kds":
        return counts.kdsTickets > 0 ? `${counts.kdsTickets} KOT` : null;
      case "riders":
        return counts.activeRiders > 0 ? `${counts.activeRiders}` : null;
      default:
        return null;
    }
  };

  // User details - strictly sanitize any accidental 'franchise' or 'frenchise' from mock/session
  const rawName = (user?.name || (user as any)?.fullName || "").replace(/frenchis\w*|franchis\w*/gi, "").trim();
  const displayName = rawName || "Admin";

  const rawEmail = (user?.email || "").replace(/frenchis\w*|franchis\w*/gi, "admin").trim();
  const displayEmail = rawEmail || "admin@restaurant.com";

  const userInitials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase() || "AD";

  // Dynamic Restaurant Admin Identity - strictly sanitize any accidental 'franchise' or 'frenchise'
  const rawRestaurantName = (user?.restaurantName || "").replace(/frenchis\w*|franchis\w*/gi, "").trim();
  const restaurantAdminSubtitle = rawRestaurantName
    ? `${rawRestaurantName} Admin`
    : "Restaurant Admin";

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP / LAPTOP SIDEBAR (Screens >= lg) */}
      {/* ========================================================================= */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[var(--bg-deep)]/90 backdrop-blur-2xl border-r border-[var(--border)] sticky top-0 h-screen z-40 transition-[width] duration-300 ease-in-out select-none ${isCollapsed ? "w-[72px]" : "w-[252px]"
          }`}
      >
        {/* Clean Header: Omnibites Logo + Title + "{restaurantName} Admin" */}
        <div
          onClick={handleToggleCollapse}
          className="h-20 shrink-0 flex items-center border-b border-[var(--border)] cursor-pointer select-none overflow-hidden"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {/* Fixed 72px width logo container - ALWAYS centered */}
          <div className="w-[72px] shrink-0 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Omnibites"
              width={52}
              height={52}
              priority
              className="w-[48px] h-[48px] object-contain shrink-0 transition-transform group-hover:scale-105 drop-shadow-[0_0_10px_rgba(227,177,59,0.4)]"
            />
          </div>

          {/* Clean Brand & Restaurant Admin Subtitle */}
          <div
            className={`flex flex-col justify-center min-w-0 pr-3 overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed
                ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                : "w-[172px] opacity-100 translate-x-0"
              }`}
          >
            <span className="font-display font-extrabold text-xl tracking-tight leading-tight whitespace-nowrap">
              <span className="text-[var(--text-hi)]">Omni</span>
              <span className="text-[#f5a623]">bites</span>
            </span>
            <p className="text-xs font-semibold text-[var(--text-lo)] truncate leading-tight mt-0.5">
              {restaurantAdminSubtitle}
            </p>
          </div>
        </div>

        {/* Navigation List with Accordion Hierarchy */}
        <div className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {navList.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(item.id);
            const badgeText = getBadgeForNav(item.badgeKey);
            const resolvedHref =
              item.path ||
              TAB_TO_PATH[item.id as AdminTab] ||
              (item.id === "overview" ? "/admin" : `/admin/${item.id}`);
            const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
            const isAccordionOpen = Boolean(openAccordions[item.id]);

            return (
              <div key={item.id} className="w-full">
                <Link
                  href={resolvedHref}
                  prefetch={true}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTabClick(item.id);
                    if (hasSubItems && !isAccordionOpen) {
                      setOpenAccordions((prev) => ({ ...prev, [item.id]: true }));
                    }
                  }}
                  className={`w-full flex items-center h-11 rounded-xl text-[13.5px] font-medium transition-all duration-200 relative group cursor-pointer ${
                    isActive
                      ? "bg-[var(--gold-dim)] text-[var(--gold)] shadow-sm font-semibold"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                  }`}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
                  )}

                  {/* Fixed Icon container (always centered relative to the 72px sidebar) */}
                  <div className="w-[52px] shrink-0 flex items-center justify-center">
                    <Icon
                      className={`w-[19px] h-[19px] transition-transform group-hover:scale-110 shrink-0 ${
                        isActive
                          ? "text-[var(--gold)]"
                          : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
                      }`}
                    />
                  </div>

                  {/* Text, Badge and Chevron smoothly expanding/collapsing */}
                  <div
                    className={`flex-1 flex items-center justify-between pr-2 overflow-hidden transition-all duration-300 ease-in-out ${
                      isCollapsed
                        ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                        : "w-auto opacity-100 translate-x-0"
                    }`}
                  >
                    <span className="whitespace-nowrap truncate">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      {badgeText && (
                        <span
                          className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            isActive
                              ? "bg-[var(--gold)] text-[#342c14] border-transparent"
                              : item.badgeKey === "pos"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-[var(--surface-hi)] text-[var(--text-faint)] border-[var(--border)]"
                          }`}
                        >
                          {badgeText}
                        </span>
                      )}

                      {hasSubItems && !isCollapsed && (
                        <button
                          type="button"
                          onClick={(e) => toggleAccordion(item.id, e)}
                          className="p-1 rounded-md hover:bg-[var(--surface)] text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors cursor-pointer"
                          aria-label={isAccordionOpen ? "Collapse sub-menu" : "Expand sub-menu"}
                        >
                          {isAccordionOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Floating UI Tooltip when sidebar collapsed */}
                  {isCollapsed && (
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--gold)]">{item.label}</span>
                          {badgeText && (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14]">
                              {badgeText}
                            </span>
                          )}
                        </div>
                        {hasSubItems && (
                          <div className="flex flex-col gap-1 pt-1.5 mt-0.5 border-t border-zinc-800 text-[11px]">
                            {item.subItems!.map((sub) => (
                              <div
                                key={sub.id}
                                className={`flex items-center gap-1.5 ${
                                  activeTab === sub.id ? "text-[var(--gold)] font-bold" : "text-[var(--text-lo)]"
                                }`}
                              >
                                <span className="text-[var(--text-faint)]">↳</span>
                                <span>{sub.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Tooltip Arrow */}
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
                    </div>
                  )}
                </Link>

                {/* Sub-items accordion container */}
                {hasSubItems && isAccordionOpen && !isCollapsed && (
                  <div className="ml-6 pl-3 border-l border-zinc-800 dark:border-zinc-800/80 my-1 space-y-1">
                    {item.subItems!.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      const subBadge = getBadgeForNav(sub.badgeKey);
                      const subHref =
                        sub.path ||
                        TAB_TO_PATH[sub.id as AdminTab] ||
                        `/admin/${sub.id}`;
                      return (
                        <Link
                          key={sub.id}
                          href={subHref}
                          prefetch={true}
                          onClick={(e) => {
                            e.preventDefault();
                            handleTabClick(sub.id);
                          }}
                          className={`w-full flex items-center h-8.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-200 relative group cursor-pointer ${
                            isSubActive
                              ? "bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                              : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                          }`}
                        >
                          {isSubActive && (
                            <span className="absolute -left-[14px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--gold)] shadow-[0_0_6px_var(--gold)]" />
                          )}
                          <SubIcon
                            className={`w-3.5 h-3.5 mr-2 shrink-0 transition-transform group-hover:scale-110 ${
                              isSubActive
                                ? "text-[var(--gold)]"
                                : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
                            }`}
                          />
                          <span className="truncate flex-1">{sub.label}</span>
                          {subBadge && (
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[var(--surface-hi)] text-[var(--text-faint)] border border-[var(--border)] ml-1 shrink-0">
                              {subBadge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Sidebar: Clean Profile Card & Logout Button */}
        <div className="border-t border-[var(--border)] p-2.5 shrink-0 bg-[var(--bg-deep)]/95 space-y-2">
          {/* User Profile Card (when expanded) */}
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] select-none">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center font-mono font-bold text-xs text-[var(--gold)] shrink-0">
                  {userInitials}
                </div>
                <span className="w-2 h-2 rounded-full bg-[#25d366] absolute -top-0.5 -right-0.5 ring-2 ring-[var(--bg-deep)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--text-hi)] truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-[var(--text-faint)] font-mono truncate">
                  {displayEmail}
                </p>
              </div>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)] shrink-0">
                Admin
              </span>
            </div>
          ) : (
            /* Collapsed User Avatar with Tooltip */
            <div className="w-full flex justify-center py-1 group relative cursor-pointer" onClick={handleToggleCollapse}>
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center font-mono font-bold text-xs text-[var(--gold)]">
                  {userInitials}
                </div>
                <span className="w-2 h-2 rounded-full bg-[#25d366] absolute -top-0.5 -right-0.5 ring-2 ring-[var(--bg-deep)]" />
              </div>

              {/* Tooltip for user avatar */}
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <div className="font-bold">{displayName}</div>
                  <div className="text-[10px] text-[var(--text-faint)] font-mono">Admin</div>
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogoutClick}
            className="w-full flex items-center h-11 rounded-xl text-[13.5px] font-semibold text-[#ff4d4f] hover:bg-[#ff4d4f]/15 border border-transparent hover:border-[#ff4d4f]/30 transition-all duration-200 relative group cursor-pointer select-none"
          >
            {/* Centered Red Icon container */}
            <div className="w-[52px] shrink-0 flex items-center justify-center text-[#ff4d4f]">
              <LogOut className="w-[19px] h-[19px] text-[#ff4d4f] transition-transform group-hover:scale-110 shrink-0" />
            </div>

            {/* Text smoothly expanding/collapsing */}
            <div
              className={`flex-1 flex items-center justify-between pr-3 overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                  : "w-auto opacity-100 translate-x-0"
                }`}
            >
              <span className="whitespace-nowrap font-bold text-[#ff4d4f]">Log Out</span>
            </div>

            {/* Tooltip for logout when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[#ff4d4f] border border-[#ff4d4f]/40 shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <LogOut className="w-3.5 h-3.5 text-[#ff4d4f]" />
                  <span>Log Out</span>
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[#ff4d4f]/40" />
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

export default AdminSidebar;

