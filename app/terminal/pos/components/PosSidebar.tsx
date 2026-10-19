"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  FileSpreadsheet,
  LogOut,
  Layers,
  AlertTriangle,
  Lock,
  User,
  Menu,
  X,
  Receipt,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/app/admin/context/AuthContext";
import { clearUserSession } from "@/lib/tenantStore";
import { recordStaffShiftLogout } from "@/lib/universalShiftLogging";
import ConfirmModal from "./ConfirmModal";
import { useTerminalSidebar } from "../../TerminalSidebarContext";

interface PosSidebarProps {
  currentView: "register" | "z-report" | "orders" | "profile";
  heldOrdersCount?: number;
  activeOrdersCount?: number;
  activeShift?: any;
  onOpenHeldOrders?: () => void;
  onOpenRecentOrders?: () => void;
  onOpenOrdersHub?: (initialTab?: "all" | "kot" | "held" | "pending" | "settled" | "voided") => void;
  onOpenCashDrawer?: () => void;
  onSelectView?: (view: "register" | "orders") => void;
}

export default function PosSidebar({
  currentView,
  heldOrdersCount = 0,
  activeOrdersCount = 0,
  activeShift,
  onOpenHeldOrders,
  onOpenRecentOrders,
  onOpenOrdersHub,
  onOpenCashDrawer,
  onSelectView,
}: PosSidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useTerminalSidebar();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isBlockedLogoutModalOpen, setIsBlockedLogoutModalOpen] = useState(false);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const savedTheme = (localStorage.getItem("theme") || (localStorage as any).theme) as "dark" | "light" | null;
      const active = savedTheme === "light" ? "light" : "dark";
      setTheme(active);
    } catch { }

    const handleThemeChange = () => {
      try {
        const savedTheme = (localStorage.getItem("theme") || (localStorage as any).theme) as "dark" | "light" | null;
        if (savedTheme) {
          setTheme(savedTheme);
        }
      } catch { }
    };
    window.addEventListener("storage", handleThemeChange);
    return () => window.removeEventListener("storage", handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
    try {
      localStorage.setItem("theme", next);
      (localStorage as any).theme = next;
      window.dispatchEvent(new Event("storage"));
    } catch { }
  };

  // Lock body scroll when mobile menu drawer is open
  useEffect(() => {
    if (isMenuDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuDrawerOpen]);

  const rawName = user?.name || (user as any)?.fullName || "Cashier";
  const displayName = rawName.trim();
  const displayEmail = user?.email || "cashier@restaurant.com";
  const userInitials =
    displayName
      .split(" ")
      .map((n: string) => n[0])
      .filter(Boolean)
      .join("")
      .substring(0, 2)
      .toUpperCase() || "OP";

  const roleBadge =
    user?.staffRole?.toUpperCase() ||
    (user?.role === "ADMIN" || user?.role === "BRANCH_ADMIN" || user?.role === "STANDALONE_ADMIN" || user?.role === "FRANCHISE_OWNER"
      ? "Admin"
      : "Cashier");

  // Fallback hydration from local storage so badge persists across page navigation (POS, Orders Hub, Z-Report)
  const [cachedBadge, setCachedBadge] = useState(0);

  useEffect(() => {
    const updateBadge = () => {
      if (typeof window === "undefined") return;
      const currentOrgId = user?.organizationId || user?.id || "default";
      let count = 0;
      try {
        const rawParked = localStorage.getItem(`omni_terminal_parked_orders_${currentOrgId}`);
        if (rawParked) {
          const parsed = JSON.parse(rawParked);
          if (Array.isArray(parsed)) count += parsed.length;
        }
      } catch { }

      try {
        const rawRunning = localStorage.getItem(`pos_running_kot_orders_${currentOrgId}`);
        if (rawRunning) {
          const parsed = JSON.parse(rawRunning);
          if (Array.isArray(parsed)) count += parsed.length;
        }
      } catch { }

      setCachedBadge(count);
    };

    updateBadge();
    window.addEventListener("storage", updateBadge);
    const interval = setInterval(updateBadge, 1500);
    return () => {
      window.removeEventListener("storage", updateBadge);
      clearInterval(interval);
    };
  }, [user]);

  const propsTotal = (heldOrdersCount || 0) + (activeOrdersCount || 0);
  const totalOrdersBadge = propsTotal > 0 ? propsTotal : cachedBadge;

  const handleInitiateLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleConfirmLogout = async () => {
    try {
      await recordStaffShiftLogout(user, { station: "cashier" });
    } catch (e) {
      console.warn("Failed recording cashier shift logout:", e);
    }
    clearUserSession();
    logout();
    router.replace("/login");
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP VIEW (>= 1024px / lg): Sleek Vertical Sidebar                      */}
      {/* ========================================================================= */}
      <aside
        className={`hidden lg:flex shrink-0 h-full bg-[var(--bg-deep)]/90 backdrop-blur-2xl border-r border-[var(--border)] flex-col justify-between select-none transition-[width] duration-300 ease-in-out z-20 ${
          isCollapsed ? "w-[72px]" : "w-[252px]"
        }`}
      >
        {/* 1. MAIN NAVIGATION LINKS (ICONS + LABELS) */}
        <nav
          className={`flex-1 px-2.5 py-3 space-y-1 scrollbar-thin ${
            isCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
          }`}
        >
          {/* 1. POS Register (Billing) */}
          <button
            type="button"
            onClick={() => {
              if (onSelectView) {
                onSelectView("register");
              } else if (currentView !== "register") {
                router.push("/terminal/pos");
              }
            }}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentView === "register"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
            }`}
          >
            {currentView === "register" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <LayoutGrid
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentView === "register"
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
                }`}
              />
            </div>
            <div
              className={`flex-1 flex items-center pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                  : "w-auto opacity-100 translate-x-0"
              }`}
            >
              <span className="whitespace-nowrap truncate">POS Register</span>
            </div>

            {/* Custom Tooltip when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">POS Register</span>
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>

          {/* 2. Unified Orders Hub (KOT, Held, Pending, Settled) */}
          <button
            type="button"
            onClick={() => {
              if (onSelectView) {
                onSelectView("orders");
              } else if (onOpenOrdersHub) {
                onOpenOrdersHub("all");
              } else if (currentView !== "orders") {
                router.push("/terminal/pos/orders");
              }
            }}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentView === "orders"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
            }`}
          >
            {currentView === "orders" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <Layers
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentView === "orders"
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-lo)] group-hover:text-[var(--gold)]"
                }`}
              />
            </div>
            <div
              className={`flex-1 flex items-center justify-between pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                  : "w-auto opacity-100 translate-x-0"
              }`}
            >
              <span className="whitespace-nowrap truncate">Orders Hub</span>
              {totalOrdersBadge > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14] font-mono text-[10px] font-bold shadow-xs ml-auto">
                  {totalOrdersBadge}
                </span>
              )}
            </div>

            {/* Custom Tooltip when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">Orders Hub</span>
                  {totalOrdersBadge > 0 && (
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14]">
                      {totalOrdersBadge}
                    </span>
                  )}
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>

          {/* 3. Z-Report & End Shift (Dedicated Full Page Route) */}
          <button
            type="button"
            onClick={() => {
              if (currentView !== "z-report") {
                router.push("/terminal/pos/z-report");
              }
            }}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentView === "z-report"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
            }`}
          >
            {currentView === "z-report" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <FileSpreadsheet
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentView === "z-report"
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
                }`}
              />
            </div>
            <div
              className={`flex-1 flex items-center pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                  : "w-auto opacity-100 translate-x-0"
              }`}
            >
              <span className="whitespace-nowrap truncate">Close Shift</span>
            </div>

            {/* Custom Tooltip when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">Close Shift</span>
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>

          {/* 4. Staff Profile & Shift Roster (Dedicated Full Page Route) */}
          <button
            type="button"
            onClick={() => {
              if (currentView !== "profile") {
                router.push("/terminal/profile");
              }
            }}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentView === "profile"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
            }`}
          >
            {currentView === "profile" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <User
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentView === "profile"
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
                }`}
              />
            </div>
            <div
              className={`flex-1 flex items-center pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                  : "w-auto opacity-100 translate-x-0"
              }`}
            >
              <span className="whitespace-nowrap truncate">Staff Profile</span>
            </div>

            {/* Custom Tooltip when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">Staff Profile</span>
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>
        </nav>

        {/* 3. BOTTOM SECTION: LOGOUT */}
        <div className="p-2 border-t border-[var(--border)] space-y-1.5 bg-[var(--bg-deep)]/95">
          {/* Logout Button (styled matching admin sidebar) */}
          <button
            type="button"
            onClick={handleInitiateLogout}
            className="w-full flex items-center h-11 rounded-xl text-xs font-bold text-[#ff4d4f] hover:bg-[#ff4d4f]/15 border border-transparent hover:border-[#ff4d4f]/30 transition-all cursor-pointer group select-none relative"
          >
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <LogOut className="w-4 h-4 shrink-0 text-[#ff4d4f] transition-transform group-hover:scale-110" />
            </div>
            <div
              className={`flex-1 flex items-center pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                  : "w-auto opacity-100 translate-x-0"
              }`}
            >
              <span className="whitespace-nowrap">Log Out</span>
            </div>

            {/* Tooltip for logout when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
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

      {/* ========================================================================= */}
      {/* MOBILE & TABLET VIEW (< 1024px / lg): Fixed Bottom Navigation Dock         */}
      {/* ========================================================================= */}
      {!isMenuDrawerOpen && (
        <nav
          aria-label="Staff Terminal Mobile Navigation Dock"
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-t border-[var(--border)] px-3 py-2 flex items-center justify-between shadow-2xl select-none transition-colors duration-200"
        >
          {/* Brand / Staff Initials Avatar Pill */}
          <div className="flex items-center justify-center pl-1 pr-2 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[var(--surface-hi)] border border-[var(--border-hi)] flex items-center justify-center font-bold text-xs text-[var(--gold)] font-mono shadow-inner">
              {userInitials}
            </div>
          </div>

          {/* Dock Navigation Items */}
          <div className="flex-1 flex items-center justify-around gap-2 max-w-sm mx-auto">
            {/* Core Tab 1: POS Register */}
            <button
              type="button"
              onClick={() => {
                if (onSelectView) {
                  onSelectView("register");
                } else if (currentView !== "register") {
                  router.push("/terminal/pos");
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer ${
                currentView === "register"
                  ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span className="leading-none text-[11px] truncate">Register</span>
            </button>

            {/* Core Tab 2: Orders Hub */}
            <button
              type="button"
              onClick={() => {
                if (onSelectView) {
                  onSelectView("orders");
                } else if (onOpenOrdersHub) {
                  onOpenOrdersHub("all");
                } else if (currentView !== "orders") {
                  router.push("/terminal/pos/orders");
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer relative ${
                currentView === "orders"
                  ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
              }`}
            >
              <div className="relative">
                <Layers className="w-4 h-4 shrink-0" />
                {totalOrdersBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-[var(--gold)] text-[#342c14] text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
                    {totalOrdersBadge > 9 ? "9+" : totalOrdersBadge}
                  </span>
                )}
              </div>
              <span className="leading-none text-[11px] truncate">Orders Hub</span>
            </button>

            {/* Dedicated Menu Trigger Button */}
            <button
              type="button"
              onClick={() => setIsMenuDrawerOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
            >
              <Menu className="w-4 h-4 shrink-0" />
              <span className="leading-none text-[11px] truncate">Menu</span>
            </button>
          </div>
        </nav>
      )}

      {/* ========================================================================= */}
      {/* MOBILE & TABLET POPUP MENU SHEET (< 1024px / lg)                          */}
      {/* ========================================================================= */}
      {isMenuDrawerOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Dark Backdrop with blur */}
          <div
            onClick={() => setIsMenuDrawerOpen(false)}
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
            aria-hidden="true"
          />

          {/* Slide-Up Bottom Sheet in Dark Olive Aesthetics */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Terminal Navigation Menu"
            className="fixed inset-x-0 bottom-0 z-[101] bg-[var(--bg-deep)] border-t border-[var(--border)] rounded-t-3xl p-5 pb-8 shadow-2xl transition-all duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-300 select-none"
          >
            {/* Pull Handle Pill */}
            <div className="w-12 h-1 bg-[var(--border-hi)] rounded-full mx-auto mb-4" />

            {/* Top Header Row with Clear Close Button & Theme Switcher */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-[var(--text-hi)] font-display tracking-tight">
                Menu
              </h2>
              <div className="flex items-center gap-3">
                {/* Theme Toggle Button */}
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

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsMenuDrawerOpen(false)}
                  className="p-1.5 text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors cursor-pointer rounded-xl hover:bg-[var(--surface-hi)]"
                  aria-label="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Clean Grid of POS Terminal Navigation Routes */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-4">
              {/* Route 1: POS Register */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  if (onSelectView) {
                    onSelectView("register");
                  } else if (currentView !== "register") {
                    router.push("/terminal/pos");
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer relative select-none ${
                  currentView === "register"
                    ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                    : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                }`}
              >
                <div className="relative">
                  <LayoutGrid
                    className={`w-6 h-6 transition-transform group-hover:scale-110 ${
                      currentView === "register" ? "text-[var(--gold)]" : "text-[var(--text-hi)]"
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] sm:text-xs text-center leading-tight line-clamp-2 ${
                    currentView === "register" ? "text-[var(--gold)] font-bold" : "text-[var(--text-lo)] font-medium"
                  }`}
                >
                  POS Register
                </span>
              </button>

              {/* Route 2: Orders Hub */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  if (onSelectView) {
                    onSelectView("orders");
                  } else if (onOpenOrdersHub) {
                    onOpenOrdersHub("all");
                  } else if (currentView !== "orders") {
                    router.push("/terminal/pos/orders");
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer relative select-none ${
                  currentView === "orders"
                    ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                    : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                }`}
              >
                <div className="relative">
                  <Layers
                    className={`w-6 h-6 transition-transform group-hover:scale-110 ${
                      currentView === "orders" ? "text-[var(--gold)]" : "text-[var(--text-hi)]"
                    }`}
                  />
                  {totalOrdersBadge > 0 && (
                    <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-[var(--gold)] text-[#342c14] text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
                      {totalOrdersBadge > 9 ? "9+" : totalOrdersBadge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] sm:text-xs text-center leading-tight line-clamp-2 ${
                    currentView === "orders" ? "text-[var(--gold)] font-bold" : "text-[var(--text-lo)] font-medium"
                  }`}
                >
                  Orders Hub
                </span>
              </button>

              {/* Route 3: Z-Report */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  if (currentView !== "z-report") {
                    router.push("/terminal/pos/z-report");
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer relative select-none ${
                  currentView === "z-report"
                    ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                    : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                }`}
              >
                <div className="relative">
                  <FileSpreadsheet
                    className={`w-6 h-6 transition-transform group-hover:scale-110 ${
                      currentView === "z-report" ? "text-[var(--gold)]" : "text-[var(--text-hi)]"
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] sm:text-xs text-center leading-tight line-clamp-2 ${
                    currentView === "z-report" ? "text-[var(--gold)] font-bold" : "text-[var(--text-lo)] font-medium"
                  }`}
                >
                  Z-Report
                </span>
              </button>

              {/* Route 4: Staff Profile */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  if (currentView !== "profile") {
                    router.push("/terminal/profile");
                  }
                }}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer relative select-none ${
                  currentView === "profile"
                    ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                    : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                }`}
              >
                <div className="relative">
                  <User
                    className={`w-6 h-6 transition-transform group-hover:scale-110 ${
                      currentView === "profile" ? "text-[var(--gold)]" : "text-[var(--text-hi)]"
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] sm:text-xs text-center leading-tight line-clamp-2 ${
                    currentView === "profile" ? "text-[var(--gold)] font-bold" : "text-[var(--text-lo)] font-medium"
                  }`}
                >
                  Staff Profile
                </span>
              </button>

              {/* Route 5: Cash Drawer */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  if (onOpenCashDrawer) {
                    onOpenCashDrawer();
                  } else {
                    router.push("/terminal/pos");
                  }
                }}
                className="flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)] transition-all cursor-pointer relative select-none"
              >
                <div className="relative">
                  <Receipt className="w-6 h-6 transition-transform group-hover:scale-110 text-[var(--text-hi)]" />
                </div>
                <span className="text-[11px] sm:text-xs text-center leading-tight line-clamp-2 text-[var(--text-lo)] font-medium">
                  Cash Drawer
                </span>
              </button>

              {/* Route 6: Log Out */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  handleInitiateLogout();
                }}
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
      )}

      {/* Logout Confirmation Dialog (Visible for both Desktop & Mobile Dock) */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Close Shift & End POS Session?"
        description="Are you sure you want to log out? Logging out will automatically close your active shift in the database (status = 'CLOSED', closed_at = NOW) and return to the sign-in screen."
        confirmLabel="Yes, Close Shift & Exit"
        cancelLabel="Stay in Terminal"
        variant="warning"
        icon="warning"
      />

      {/* Anti-Fraud Lockout Modal: Blocks Logout if Shift Not Settled */}
      {isBlockedLogoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
        >
          <div className="w-full max-w-md bg-[var(--bg-deep)] border border-amber-500/50 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7 text-amber-400" />
            </div>

            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs dark:bg-amber-950/60 dark:border-amber-800/60 dark:text-amber-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                Shift Status Options
              </span>
              <h3 className="text-xl font-display font-black text-[var(--text-hi)]">
                Close Shift &amp; Exit POS
              </h3>
              <p className="text-xs text-[var(--text-lo)] leading-relaxed">
                You can proceed to the Z-Report to declare physical cash count or auto-close your shift directly to return to the sign-in screen.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsBlockedLogoutModalOpen(false);
                  router.push("/terminal/pos/z-report");
                }}
                className="w-full py-3.5 px-4 rounded-xl btn-gold active:scale-95 text-[#342c14] font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Reconcile &amp; Generate Z-Report</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsBlockedLogoutModalOpen(false);
                  handleConfirmLogout();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-bold font-mono transition-colors cursor-pointer"
              >
                Auto-Close Shift &amp; Exit Now
              </button>

              <button
                type="button"
                onClick={() => setIsBlockedLogoutModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] text-xs font-semibold transition-colors cursor-pointer"
              >
                Stay in Terminal &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
