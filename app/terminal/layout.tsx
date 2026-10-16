"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  User,
  Clock,
  ShieldCheck,
  Sun,
  Moon,
} from "lucide-react";
import { AuthProvider, useAuth } from "../admin/context/AuthContext";
import { clearUserSession } from "../../lib/tenantStore";
import { recordStaffShiftLogout } from "../../lib/universalShiftLogging";
import ConfirmModal from "./pos/components/ConfirmModal";
import { TerminalSidebarProvider, useTerminalSidebar } from "./TerminalSidebarContext";

function TerminalShell({ children }: { children: React.ReactNode }) {
  const { user, logout, shiftValidation } = useAuth();
  const { isCollapsed, toggleSidebar, hideHeader } = useTerminalSidebar();
  const router = useRouter();
  const pathname = usePathname();

  const [currentTime, setCurrentTime] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Initialize Theme matching Admin Dashboard
    try {
      const savedTheme = (localStorage.getItem("theme") || (localStorage as any).theme) as "dark" | "light" | null;
      const active = savedTheme === "light" ? "light" : "dark";
      setTheme(active);
      if (active === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch { }

    const handleThemeSync = () => {
      try {
        const savedTheme = (localStorage.getItem("theme") || (localStorage as any).theme) as "dark" | "light" | null;
        if (savedTheme) {
          setTheme(savedTheme);
        }
      } catch { }
    };
    window.addEventListener("storage", handleThemeSync);

    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => {
      window.removeEventListener("storage", handleThemeSync);
      clearInterval(interval);
    };
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

  // Authentication & Route Protection Guard
  useEffect(() => {
    if (!isMounted) return;
    if (!user) {
      const redirectUrl = `/login?redirect=${encodeURIComponent(pathname || "/terminal")}`;
      router.replace(redirectUrl);
      return;
    }

    // Strict Role-Based Financial Isolation Guard:
    // Ensure Waiters, Chefs, and Riders cannot access POS registers or financial Z-Report views
    const staffRoleClean = (user.staffRole || "").toLowerCase().trim();
    const roleClean = (user.role || "").toLowerCase().trim();
    const terminalAccessClean = String(user.terminalAccess || "").toUpperCase().trim();

    const isWaiter =
      staffRoleClean === "waiter" ||
      staffRoleClean === "server" ||
      roleClean === "waiter" ||
      roleClean === "server" ||
      terminalAccessClean === "WAITER_ONLY" ||
      terminalAccessClean === "WAITER";

    const isChef =
      staffRoleClean === "chef" ||
      staffRoleClean === "kitchen" ||
      staffRoleClean === "cook" ||
      staffRoleClean === "kds" ||
      roleClean === "chef" ||
      roleClean === "kitchen" ||
      roleClean === "cook" ||
      roleClean === "kds" ||
      terminalAccessClean === "KDS_ONLY" ||
      terminalAccessClean === "KITCHEN_ONLY";

    const isRider =
      staffRoleClean === "rider" ||
      roleClean === "rider" ||
      terminalAccessClean === "RIDER_ONLY";

    const isFinancialPath =
      pathname.startsWith("/terminal/pos") ||
      pathname.startsWith("/terminal/z-report");

    if (isFinancialPath) {
      if (isWaiter) {
        router.replace("/terminal/waiter");
        return;
      }
      if (isChef) {
        router.replace("/terminal/kitchen");
        return;
      }
      if (isRider) {
        router.replace("/terminal/rider");
        return;
      }
    }
  }, [user, isMounted, pathname, router]);

  const handleLogout = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleConfirmLogout = async () => {
    try {
      await recordStaffShiftLogout(user);
    } catch (e) {
      console.warn("Failed recording staff shift logout:", e);
    }
    clearUserSession();
    logout();
    router.replace("/login");
  };

  if (!isMounted || !user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-deep)] text-[var(--text-hi)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center animate-pulse">
            <ShieldCheck className="w-6 h-6 text-[var(--gold)]" />
          </div>
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-[var(--text-lo)]">
            Loading Staff Terminal...
          </span>
        </div>
      </div>
    );
  }

  const roleLabel =
    user.staffRole?.toUpperCase() ||
    (user.role === "STAFF_MEMBER" ? "STAFF" : user.role || "OPERATOR");

  // Dynamic Restaurant POS Identity - strictly sanitize any accidental 'franchise' or 'frenchise'
  const rawRestaurantName = (user.restaurantName || "").replace(/frenchis\w*|franchis\w*/gi, "").trim();
  const restaurantPosSubtitle = rawRestaurantName
    ? `${rawRestaurantName} POS`
    : "Restora POS";

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--bg)] text-[var(--text-hi)] select-none transition-colors duration-300">
      {/* ========================================================================= */}
      {/* UNIFIED TOP OPERATIONAL STATUS BAR (MATCHING ADMIN HEADER)                */}
      {/* ========================================================================= */}
      {!hideHeader && (
        <header className="h-16 sm:h-20 shrink-0 bg-[var(--bg-deep)]/90 backdrop-blur-xl border-b border-[var(--border)] flex items-stretch select-none z-30 transition-colors">
        {/* Left: Omnibites Brand & Sidebar Collapse Toggle (Strictly Desktop >= lg where sidebar is present; Hidden on Mobile & Tab views where bottom dock is active) */}
        <div
          onClick={toggleSidebar}
          className={`hidden lg:flex shrink-0 items-center border-r border-[var(--border)] cursor-pointer select-none overflow-hidden transition-[width] duration-300 ease-in-out group ${
            isCollapsed ? "w-[72px]" : "w-[252px]"
          }`}
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

          {/* Clean Brand & POS Subtitle */}
          <div
            className={`flex flex-col justify-center min-w-0 pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
              isCollapsed
                ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                : "w-[172px] opacity-100 translate-x-0"
            }`}
          >
            <span className="font-display font-extrabold text-xl tracking-tight leading-tight whitespace-nowrap">
              <span className="text-[var(--text-hi)]">Omni</span>
              <span className="text-[#f5a623]">bites</span>
            </span>
            <p className="text-xs font-semibold text-[var(--text-lo)] truncate leading-tight mt-0.5">
              {restaurantPosSubtitle}
            </p>
          </div>
        </div>

        {/* Right: Operational Status Bar for the Rest of the Page (Expands full-width on mobile/tablet from 300px+) */}
        <div className="flex-1 flex items-center justify-between px-4 sm:px-6 md:px-8 relative min-w-0 w-full gap-2">
          {/* Center/Left: Operational Live Shift & Digital Clock */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[var(--surface-hi)]/80 border border-[var(--border)] shadow-xs backdrop-blur-md select-none shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" title="Active operational shift">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                LIVE
              </span>
            </div>
            <div className="h-3 w-px bg-[var(--border)] shrink-0" />
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 text-[11px] sm:text-xs md:text-[13px] font-mono font-bold text-[var(--text-hi)]">
              <Clock className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[var(--gold)]" />
              <span>{currentTime}</span>
            </div>
          </div>

          {/* Right: Cashier Profile & Theme Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
            {/* Operator Profile Interactive Pill - Routes to dedicated profile page */}
            <button
              type="button"
              onClick={() => {
                const rawRole = (user.staffRole || "").toLowerCase().trim();
                const isChef =
                  rawRole === "chef" ||
                  rawRole === "kitchen" ||
                  rawRole === "cook" ||
                  rawRole === "kds" ||
                  user.terminalAccess === "KDS_ONLY" ||
                  (user.terminalAccess as string) === "KITCHEN_ONLY";
                if (pathname?.startsWith("/terminal/kitchen") || isChef) {
                  router.push("/terminal/kitchen?tab=profile");
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("kitchen-tab-change", { detail: "profile" }));
                  }
                } else {
                  router.push("/terminal/profile");
                }
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-[var(--surface-hi)]/80 hover:bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-xs font-mono shadow-xs cursor-pointer transition-all active:scale-95 group text-left shrink-0"
              title="Open Staff Profile & Shift Schedule"
            >
              <div className="w-5 h-5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0 group-hover:scale-110 transition-transform">
                <User className="w-3 h-3" />
              </div>
              <span className="font-bold text-[var(--text-hi)] max-w-[120px] truncate hidden md:inline-block">
                {user.name}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 uppercase tracking-wide">
                {roleLabel}
              </span>
            </button>

            {/* Theme Switcher Toggle (Dark / Light) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl bg-[var(--surface-hi)]/80 hover:bg-[var(--surface-mid)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors cursor-pointer shrink-0"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--gold)]" />
              ) : (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-lo)]" />
              )}
            </button>
          </div>
        </div>
      </header>
      )}

      {/* Main Terminal Viewport */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        {children}
      </main>

      {/* Custom Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        title="End Terminal Session?"
        description="Are you sure you want to end your terminal session and return to the login screen?"
        confirmLabel="Yes, Log Out"
        cancelLabel="Stay in Terminal"
        variant="warning"
        icon="warning"
      />
    </div>
  );
}

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TerminalSidebarProvider>
        <TerminalShell>{children}</TerminalShell>
      </TerminalSidebarProvider>
    </AuthProvider>
  );
}
