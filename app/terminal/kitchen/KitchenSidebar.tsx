"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Flame,
  Volume2,
  User,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/app/admin/context/AuthContext";
import { clearUserSession } from "@/lib/tenantStore";
import { recordStaffShiftLogout } from "@/lib/universalShiftLogging";
import ConfirmModal from "../pos/components/ConfirmModal";
import { useTerminalSidebar } from "../TerminalSidebarContext";

interface KitchenSidebarProps {
  currentTab: "all_active" | "queued" | "preparing" | "paused" | "ready" | "completed" | "voided" | "profile" | "stats";
  onSelectTab: (tab: "all_active" | "queued" | "preparing" | "paused" | "ready" | "completed" | "voided" | "profile" | "stats") => void;
  queuedCount?: number;
  preparingCount?: number;
  pausedCount?: number;
  readyCount?: number;
  completedCount?: number;
  voidedCount?: number;
  onTriggerBuzzer?: () => void;
  isBuzzerRinging?: boolean;
}

export default function KitchenSidebar({
  currentTab,
  onSelectTab,
  queuedCount = 0,
  preparingCount = 0,
  pausedCount = 0,
  readyCount = 0,
  completedCount = 0,
  onTriggerBuzzer,
  isBuzzerRinging = false,
}: KitchenSidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isCollapsed } = useTerminalSidebar();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
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

  const rawName = user?.name || (user as any)?.fullName || "Chef";
  const displayName = rawName.trim();
  const displayEmail = user?.email || "kitchen@restaurant.com";
  const userInitials =
    displayName
      .split(" ")
      .map((n: string) => n[0])
      .filter(Boolean)
      .join("")
      .substring(0, 2)
      .toUpperCase() || "CK";

  const roleBadge = user?.staffRole?.toUpperCase() || "CHEF";
  const assignedStation = (user?.assigned_station || (user as any)?.assignedStation || "").toLowerCase().trim();
  const stationBadge = assignedStation ? assignedStation.toUpperCase() : null;
  const totalActive = queuedCount + preparingCount + pausedCount + readyCount;

  const handleConfirmLogout = async () => {
    try {
      await recordStaffShiftLogout(user, { station: "kitchen" });
    } catch (e) {
      console.warn("Failed recording kitchen shift logout:", e);
    }
    clearUserSession();
    logout();
    router.replace("/login");
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP VIEW (>= 1024px / lg): Left Collapsible Terminal Sidebar           */}
      {/* ========================================================================= */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-full bg-[var(--bg-deep)]/95 backdrop-blur-xl border-r border-[var(--border)] transition-[width] duration-300 ease-in-out select-none z-20 ${
          isCollapsed ? "w-[72px]" : "w-[252px]"
        }`}
      >
        {/* Navigation Actions (Essential KDS Actions Only) */}
        <nav
          aria-label="Kitchen Terminal Navigation"
          className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none"
        >
          {/* 1. Live KDS Queue */}
          <button
            type="button"
            onClick={() => onSelectTab("all_active")}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentTab === "all_active"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
            }`}
          >
            {currentTab === "all_active" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <Flame
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentTab === "all_active"
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
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
              <span className="whitespace-nowrap truncate">Live KDS Queue</span>
              {totalActive > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14] font-mono text-[10px] font-bold shadow-xs ml-auto">
                  {totalActive}
                </span>
              )}
            </div>

            {/* Tooltip when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">Live KDS Queue</span>
                  {totalActive > 0 && (
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14]">
                      {totalActive}
                    </span>
                  )}
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>

          {/* 2. Chef Performance / Stats */}
          <button
            type="button"
            onClick={() => onSelectTab("stats")}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentTab === "stats"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
            }`}
          >
            {currentTab === "stats" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <BarChart3
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentTab === "stats"
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
              <span className="whitespace-nowrap truncate">My Stats</span>
            </div>

            {/* Tooltip when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">My Stats</span>
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>

          {/* 3. Interactive Chime Buzzer Quick Trigger */}
          {onTriggerBuzzer && (
            <button
              type="button"
              onClick={onTriggerBuzzer}
              className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
                isBuzzerRinging
                  ? "bg-amber-500 text-black font-black animate-pulse shadow-md"
                  : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20"
              }`}
            >
              <div className="w-[52px] shrink-0 flex items-center justify-center">
                <Volume2 className={`w-4 h-4 shrink-0 ${isBuzzerRinging ? "animate-bounce" : ""}`} />
              </div>
              <div
                className={`flex-1 flex items-center pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
                  isCollapsed
                    ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                    : "w-auto opacity-100 translate-x-0"
                }`}
              >
                <span className="whitespace-nowrap truncate">Sound Buzzer</span>
              </div>

              {/* Tooltip when collapsed */}
              {isCollapsed && (
                <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-amber-400 border border-amber-500/40 shadow-2xl shadow-black/80 backdrop-blur-xl">
                    <span className="font-bold">Sound Kitchen Buzzer</span>
                  </div>
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-amber-500/40" />
                </div>
              )}
            </button>
          )}

          {/* 3. Chef Profile Navigation */}
          <button
            type="button"
            onClick={() => onSelectTab("profile")}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentTab === "profile"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
            }`}
          >
            {currentTab === "profile" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <User
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentTab === "profile"
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
              <span className="whitespace-nowrap truncate">Chef Profile</span>
            </div>

            {/* Tooltip when collapsed */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">Chef Profile</span>
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>
        </nav>

        {/* User Card & Logout */}
        <div className="p-2 border-t border-[var(--border)] space-y-1.5 bg-[var(--bg-deep)]/95">

          {/* Close Shift / End Session Button */}
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="w-full flex items-center h-11 rounded-xl text-xs font-bold text-[#ff4d4f] hover:bg-[#ff4d4f]/15 border border-transparent hover:border-[#ff4d4f]/30 transition-all cursor-pointer group select-none relative"
            title="Auto-close active shift in database and exit"
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
              <span className="whitespace-nowrap">Close Shift / Exit</span>
            </div>

            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[#ff4d4f] border border-[#ff4d4f]/40 shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <LogOut className="w-3.5 h-3.5 text-[#ff4d4f]" />
                  <span>Close Shift / Exit</span>
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
          aria-label="Kitchen Terminal Mobile Navigation Dock"
          className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-t border-[var(--border)] px-3 py-2 flex items-center justify-between shadow-2xl select-none transition-colors duration-200"
        >
          {/* Avatar Pill - Click to view chef profile locally */}
          <div
            onClick={() => onSelectTab("profile")}
            className="flex items-center justify-center pl-1 pr-2 shrink-0 cursor-pointer"
            title="View Chef Profile"
          >
            <div
              className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs font-mono shadow-inner transition-all ${
                currentTab === "profile"
                  ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-md scale-105"
                  : "bg-orange-500/15 border-orange-500/30 text-orange-400"
              }`}
            >
              {userInitials}
            </div>
          </div>

          {/* Dock Tabs */}
          <div className="flex-1 flex items-center justify-around gap-2 max-w-sm mx-auto">
            {/* Live Queue */}
            <button
              type="button"
              onClick={() => onSelectTab("all_active")}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer relative ${
                currentTab === "all_active"
                  ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
              }`}
            >
              <div className="relative">
                <Flame className="w-4 h-4 shrink-0" />
                {totalActive > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-[var(--gold)] text-[#342c14] text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
                    {totalActive > 9 ? "9+" : totalActive}
                  </span>
                )}
              </div>
              <span className="leading-none text-[11px] truncate">Queue</span>
            </button>

            {/* Sound Buzzer */}
            {onTriggerBuzzer && (
              <button
                type="button"
                onClick={onTriggerBuzzer}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer ${
                  isBuzzerRinging
                    ? "border border-amber-500 bg-amber-500/20 text-amber-400 font-bold text-[11px] rounded-xl px-3 py-1.5 shadow-sm animate-pulse"
                    : "text-amber-400/80 hover:text-amber-400 text-[11px] font-medium px-2"
                }`}
              >
                <Volume2 className={`w-4 h-4 shrink-0 ${isBuzzerRinging ? "animate-bounce" : ""}`} />
                <span className="leading-none text-[11px] truncate">Buzzer</span>
              </button>
            )}

            {/* Chef Stats */}
            <button
              type="button"
              onClick={() => onSelectTab("stats")}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer ${
                currentTab === "stats"
                  ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="leading-none text-[11px] truncate">Stats</span>
            </button>

            {/* Chef Profile */}
            <button
              type="button"
              onClick={() => onSelectTab("profile")}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 max-w-[90px] transition-all cursor-pointer ${
                currentTab === "profile"
                  ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-[11px] rounded-xl px-3 py-1.5 shadow-sm"
                  : "text-[var(--text-lo)] hover:text-[var(--gold)] text-[11px] font-medium px-2"
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="leading-none text-[11px] truncate">Profile</span>
            </button>

            {/* Menu Drawer Button */}
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
          <div
            onClick={() => setIsMenuDrawerOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Kitchen Terminal Menu"
            className="fixed inset-x-0 bottom-0 z-[101] bg-[var(--bg-deep)] border-t border-[var(--border)] rounded-t-3xl p-5 pb-8 shadow-2xl transition-all duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-300 select-none"
          >
            <div className="w-12 h-1 bg-[var(--border-hi)] rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-[var(--text-hi)] font-display tracking-tight">
                Kitchen Operations
              </h2>
              <div className="flex items-center gap-3">
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

            {/* Grid of Kitchen Navigation Routes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  onSelectTab("all_active");
                }}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer relative select-none ${
                  currentTab === "all_active"
                    ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                    : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                }`}
              >
                <div className="relative">
                  <Flame className={`w-6 h-6 ${currentTab === "all_active" ? "text-[var(--gold)]" : "text-amber-400"}`} />
                  {totalActive > 0 && (
                    <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-[var(--gold)] text-[#342c14] text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
                      {totalActive}
                    </span>
                  )}
                </div>
                <span className="text-[11px] sm:text-xs text-center font-bold">Live KDS Queue</span>
              </button>

              {/* Chef Stats in Mobile Drawer */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  onSelectTab("stats");
                }}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer relative select-none ${
                  currentTab === "stats"
                    ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                    : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                }`}
              >
                <BarChart3 className={`w-6 h-6 ${currentTab === "stats" ? "text-[var(--gold)]" : "text-[var(--text-hi)]"}`} />
                <span className="text-[11px] sm:text-xs text-center font-bold">My Stats</span>
              </button>

              {onTriggerBuzzer && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuDrawerOpen(false);
                    onTriggerBuzzer();
                  }}
                  className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                    isBuzzerRinging
                      ? "border-amber-500 bg-amber-500 text-black font-bold animate-pulse"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  }`}
                >
                  <Volume2 className={`w-6 h-6 ${isBuzzerRinging ? "animate-bounce" : ""}`} />
                  <span className="text-[11px] sm:text-xs text-center font-bold">Sound Buzzer</span>
                </button>
              )}

              {/* Chef Profile in Mobile Drawer */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  onSelectTab("profile");
                }}
                className={`flex flex-col items-center justify-center gap-2 p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer relative select-none ${
                  currentTab === "profile"
                    ? "border border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)] font-semibold shadow-sm"
                    : "border border-transparent text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                }`}
              >
                <User className={`w-6 h-6 ${currentTab === "profile" ? "text-[var(--gold)]" : "text-[var(--text-hi)]"}`} />
                <span className="text-[11px] sm:text-xs text-center font-bold">Chef Profile</span>
              </button>
            </div>

            {/* Logout button */}
            <div className="pt-6 border-t border-[var(--border)] mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  setIsLogoutConfirmOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#ff4d4f]/10 border border-[#ff4d4f]/30 text-[#ff4d4f] font-bold text-xs cursor-pointer hover:bg-[#ff4d4f]/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out of Kitchen Terminal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Close Shift & End Kitchen Session?"
        description="Are you sure you want to end your kitchen session? Logging out will automatically close your active shift in the database (status = 'CLOSED', closed_at = NOW) and return to the sign-in screen."
        confirmLabel="Yes, Close Shift & Exit"
        cancelLabel="Stay in Kitchen"
        variant="warning"
        icon="warning"
      />
    </>
  );
}
