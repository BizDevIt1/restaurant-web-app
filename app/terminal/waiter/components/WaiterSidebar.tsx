"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  Bell,
  Clock,
  LogOut,
  User,
  Menu,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Sun,
  Moon,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/app/admin/context/AuthContext";
import { clearUserSession } from "@/lib/tenantStore";
import { recordStaffShiftLogout } from "@/lib/universalShiftLogging";
import ConfirmModal from "../../pos/components/ConfirmModal";
import { useTerminalSidebar } from "../../TerminalSidebarContext";

export type WaiterViewMode = "ordering" | "ready_pass" | "floor_queue";

interface WaiterSidebarProps {
  currentView: WaiterViewMode;
  onSelectView: (view: WaiterViewMode) => void;
  readyTicketsCount: number;
  activeTicketsCount: number;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onTestSound?: () => void;
}

export default function WaiterSidebar({
  currentView,
  onSelectView,
  readyTicketsCount = 0,
  activeTicketsCount = 0,
  soundEnabled,
  onToggleSound,
  onTestSound,
}: WaiterSidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useTerminalSidebar();
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

  const handleConfirmLogout = async () => {
    try {
      await recordStaffShiftLogout(user, { station: "waiter" });
    } catch (e) {
      console.warn("Failed recording waiter shift logout:", e);
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
        {/* Top Operational Navigation */}
        <nav
          className={`flex-1 px-2.5 py-3 space-y-1.5 scrollbar-thin ${
            isCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
          }`}
        >
          {/* 1. Table Ordering View */}
          <button
            type="button"
            onClick={() => onSelectView("ordering")}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentView === "ordering"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold border border-[var(--gold)]/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] border border-transparent"
            }`}
          >
            {currentView === "ordering" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <UtensilsCrossed
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentView === "ordering"
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
              <span className="whitespace-nowrap truncate">Table Ordering</span>
            </div>

            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">Table Ordering</span>
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>

          {/* 2. Ready for Pickup Pass */}
          <button
            type="button"
            onClick={() => onSelectView("ready_pass")}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentView === "ready_pass"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold border border-[var(--gold)]/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] border border-transparent"
            }`}
          >
            {currentView === "ready_pass" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <Bell
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  readyTicketsCount > 0
                    ? "text-amber-400 animate-pulse"
                    : currentView === "ready_pass"
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
                }`}
              />
            </div>
            <div
              className={`flex-1 flex items-center justify-between pr-3 transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none overflow-hidden"
                  : "w-auto opacity-100 translate-x-0"
              }`}
            >
              <span className="whitespace-nowrap truncate mr-2">Ready for Pickup</span>
              {readyTicketsCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-black font-mono text-[10px] font-black shadow-xs shrink-0 animate-pulse">
                  {readyTicketsCount}
                </span>
              )}
            </div>

            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">Ready for Pickup</span>
                  {readyTicketsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-mono text-[9px] font-black">
                      {readyTicketsCount}
                    </span>
                  )}
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>

          {/* 3. Floor Queue / Active Tickets */}
          <button
            type="button"
            onClick={() => onSelectView("floor_queue")}
            className={`w-full flex items-center h-11 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
              currentView === "floor_queue"
                ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold border border-[var(--gold)]/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] border border-transparent"
            }`}
          >
            {currentView === "floor_queue" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            )}
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <Clock
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                  currentView === "floor_queue"
                    ? "text-[var(--gold)]"
                    : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
                }`}
              />
            </div>
            <div
              className={`flex-1 flex items-center justify-between pr-3 transition-all duration-300 ease-in-out ${
                isCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none overflow-hidden"
                  : "w-auto opacity-100 translate-x-0"
              }`}
            >
              <span className="whitespace-nowrap truncate mr-2">Floor Queue</span>
              {activeTicketsCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] font-mono text-[10px] font-bold shrink-0">
                  {activeTicketsCount}
                </span>
              )}
            </div>

            {isCollapsed && (
              <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-[100] whitespace-nowrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <span className="font-bold text-[var(--gold)]">Floor Queue</span>
                  {activeTicketsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[var(--surface)] text-[var(--text-lo)] font-mono text-[9px]">
                      {activeTicketsCount}
                    </span>
                  )}
                </div>
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]" />
              </div>
            )}
          </button>
        </nav>

        {/* Bottom Section: Staff Logout */}
        <div className="p-2.5 border-t border-[var(--border)] space-y-2">

          {/* Close Shift / End Session Button */}
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className="w-full flex items-center h-9 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer group"
            title="Auto-close active shift and exit session"
          >
            <div className="w-[52px] shrink-0 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-rose-400 transition-transform group-hover:-translate-x-0.5" />
            </div>
            {!isCollapsed && <span>Close Shift / Exit</span>}
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE / TABLET BOTTOM DOCK (< 1024px)                                    */}
      {/* ========================================================================= */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-t border-[var(--border)] z-40 px-3 flex items-center justify-around shadow-2xl">
        <button
          type="button"
          onClick={() => onSelectView("ordering")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl cursor-pointer ${
            currentView === "ordering" ? "text-[var(--gold)]" : "text-[var(--text-lo)]"
          }`}
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span className="text-[10px] font-mono font-bold">Order</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView("ready_pass")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl cursor-pointer relative ${
            currentView === "ready_pass" ? "text-[var(--gold)]" : "text-[var(--text-lo)]"
          }`}
        >
          <Bell className="w-5 h-5" />
          {readyTicketsCount > 0 && (
            <span className="absolute -top-0.5 right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-black text-[9px] font-black shadow-xs animate-pulse">
              {readyTicketsCount}
            </span>
          )}
          <span className="text-[10px] font-mono font-bold">Ready</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView("floor_queue")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl cursor-pointer relative ${
            currentView === "floor_queue" ? "text-[var(--gold)]" : "text-[var(--text-lo)]"
          }`}
        >
          <Clock className="w-5 h-5" />
          {activeTicketsCount > 0 && (
            <span className="absolute top-0 right-2 px-1.5 py-0.2 rounded-full bg-[var(--surface-hi)] text-[var(--text-lo)] text-[9px] font-bold border border-[var(--border)]">
              {activeTicketsCount}
            </span>
          )}
          <span className="text-[10px] font-mono font-bold">Queue</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMenuDrawerOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-[var(--text-lo)] cursor-pointer"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-mono font-bold">More</span>
        </button>
      </div>

      {/* Mobile Drawer Modal */}
      {isMenuDrawerOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMenuDrawerOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in lg:hidden"
        >
          <div className="w-72 bg-[var(--bg-deep)] h-full p-5 border-l border-[var(--border)] flex flex-col justify-between shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-[var(--text-hi)] font-display">
                    Waiter Station
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text-lo)] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Staff Details */}
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-xs font-bold text-[var(--text-hi)] block">
                  {user?.name || "Floor Server"}
                </span>
                <span className="text-[10px] font-mono text-[var(--gold)] block">
                  {user?.staffRole || "WAITER"} • {user?.assignedShift || "Active Shift"}
                </span>
              </div>

              {/* Sound alert setting */}
              <button
                type="button"
                onClick={onToggleSound}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                  soundEnabled
                    ? "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/40"
                    : "bg-[var(--surface)] text-[var(--text-lo)] border-[var(--border)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  <span>{soundEnabled ? "Chime Audio On" : "Chime Muted"}</span>
                </div>
              </button>

              {onTestSound && (
                <button
                  type="button"
                  onClick={onTestSound}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface)] text-xs font-mono text-[var(--text-lo)] border border-[var(--border)]"
                >
                  <Sparkles className="w-4 h-4 text-[var(--gold)]" />
                  <span>Test Chime Sound</span>
                </button>
              )}

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text-lo)]"
              >
                <div className="flex items-center gap-2">
                  {theme === "dark" ? <Sun className="w-4 h-4 text-[var(--gold)]" /> : <Moon className="w-4 h-4" />}
                  <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMenuDrawerOpen(false);
                setIsLogoutConfirmOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-bold font-mono"
            >
              <LogOut className="w-4 h-4" />
              <span>End Session</span>
            </button>
          </div>
        </div>
      )}

      {/* Custom Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Close Shift & End Floor Session?"
        description="Logging out will automatically close your active shift in the database (status = 'CLOSED', closed_at = NOW) and return to the sign-in screen."
        confirmLabel="Yes, Close Shift & Exit"
        cancelLabel="Stay in Terminal"
        variant="warning"
        icon="warning"
      />
    </>
  );
}
