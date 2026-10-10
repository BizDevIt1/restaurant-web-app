"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  Building2,
  ChevronDown,
  Check,
  X,
  ShieldCheck,
  Menu,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { OperationalNotification } from "../types";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

interface AdminHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  notifications: OperationalNotification[];
  markNotificationsAsRead: () => void;
  onNewOrderClick: () => void;
  onLogout?: () => void;
  onNavigateProfile?: () => void;
  onOpenMobileMenu?: () => void;
  todaySales?: number;
  todayOrdersCount?: number;
}

export default function AdminHeader({
  searchQuery,
  setSearchQuery,
  theme,
  toggleTheme,
  notifications,
  markNotificationsAsRead,
  onNewOrderClick: _onNewOrderClick,
  onLogout,
  onNavigateProfile,
  onOpenMobileMenu,
  todaySales = 0,
  todayOrdersCount = 0,
}: AdminHeaderProps) {
  const router = useRouter();
  const {
    user,
    activeBranchId,
    setActiveBranchId,
    isFranchiseOwner,
    isStandaloneAdmin,
    isBranchAdmin,
    logout,
  } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setShowProfileDropdown(false);
      }
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBranchDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const cleanRestaurantName = (user?.restaurantName || "Restaurant")
    .replace(/frenchis\w*|franchis\w*/gi, "")
    .replace(/\s+/g, " ")
    .trim() || "Restaurant";

  const cleanUserName = (user?.name || "Admin")
    .replace(/frenchis\w*|franchis\w*/gi, "")
    .replace(/\s+/g, " ")
    .trim() || "Admin";

  const cleanUserEmail = (user?.email || "")
    .replace(/frenchis\w*|franchis\w*/gi, "admin")
    .trim();

  const cleanBranchName = (user?.branchName || "")
    .replace(/frenchis\w*|franchis\w*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Extract initials from user name
  const initials = cleanUserName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "AD";

  const currentOrgId = user?.organizationId || user?.id || "default";

  const activeBranchName =
    activeBranchId === "all"
      ? `All Outlets (${user?.branches?.length || 0})`
      : (user?.branches?.find((b) => b.id === activeBranchId)?.name || "All Outlets")
          .replace(/frenchis\w*|franchis\w*/gi, "")
          .trim() || "Main Outlet";

  return (
    <header className="w-full max-w-full sticky top-0 z-40 h-16 sm:h-20 shrink-0 bg-[var(--bg-deep)]/80 backdrop-blur-xl border-b border-[var(--border)] px-4 sm:px-6 md:px-8 flex items-center justify-between gap-1 sm:gap-4 select-none whitespace-nowrap">
      {/* ===================== LEFT: LIVE DAILY SALES & ORDERS TICKER ===================== */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0 whitespace-nowrap">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="hidden p-1.5 sm:p-2 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] cursor-pointer mr-0.5"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* Daily Ticker Capsule (Strictly single horizontal line) */}
        <div className="flex items-center gap-1 sm:gap-3 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[var(--surface-hi)]/80 border border-[var(--border)] shadow-xs backdrop-blur-md select-none transition-all hover:border-[var(--gold)]/30 shrink-0 whitespace-nowrap">
          {/* Today's Sales */}
          <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--gold)] shrink-0" />
            <div className="flex items-baseline gap-0.5 sm:gap-1 whitespace-nowrap">
              <span className="text-[10px] sm:text-[11px] font-medium text-[var(--text-lo)] hidden min-[360px]:inline">
                Sales:
              </span>
              <span className="font-mono text-[11px] sm:text-[13px] font-bold text-[var(--text-hi)] whitespace-nowrap">
                Rs {Number(todaySales || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="h-3 w-px bg-[var(--border)] shrink-0" />

          {/* Today's Orders */}
          <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
            <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--orange)] shrink-0" />
            <div className="flex items-baseline gap-0.5 sm:gap-1 whitespace-nowrap">
              <span className="text-[10px] sm:text-[11px] font-medium text-[var(--text-lo)] hidden min-[360px]:inline">
                Orders:
              </span>
              <span className="font-mono text-[11px] sm:text-[13px] font-bold text-[var(--text-hi)] whitespace-nowrap">
                {todayOrdersCount || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== RIGHT SECTION: MINIMAL & CLEAN ===================== */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0 whitespace-nowrap">
        {/* Theme Toggle Button */}
        <div className="relative group">
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all cursor-pointer flex items-center justify-center shrink-0"
          >
            {theme === "dark" ? (
              <Sun className="w-3 h-3 sm:w-4 sm:h-4 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-3 h-3 sm:w-4 sm:h-4 transition-transform hover:-rotate-12" />
            )}
          </button>
        </div>

        {/* Notification Bell */}
        <div className="relative shrink-0" ref={notifDropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-center text-[var(--text-lo)] hover:text-[var(--text-hi)] relative cursor-pointer"
            title="Recent Alerts"
            aria-label="Toggle notifications menu"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--orange)] shadow-[0_0_6px_var(--orange)]"></span>
            )}
          </button>

          {/* Notifications Dropdown Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-[var(--bg-deep)] border border-[var(--border-hi)] p-4 shadow-2xl z-50 space-y-3 animate-in fade-in slide-in-from-top-2 text-left font-sans whitespace-normal">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <span className="font-bold text-xs text-[var(--text-hi)]">Alerts &amp; Audits</span>
                <span
                  onClick={markNotificationsAsRead}
                  className="text-xs text-[var(--gold)] font-medium cursor-pointer hover:underline"
                >
                  Mark all read
                </span>
              </div>
              <div className="space-y-2.5 text-xs max-h-[320px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--text-lo)] whitespace-normal">
                    No recent alerts
                  </div>
                ) : (
                  notifications.map((n) => {
                    const isUrgent = n.type === "urgent";
                    const isWarning = n.type === "warning";
                    const isSuccess = n.type === "success";

                    return (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl bg-[var(--surface-hi)] w-full max-w-full overflow-hidden border transition-all ${
                          isUrgent
                            ? "border-rose-500/35 bg-rose-500/5 shadow-xs shadow-rose-950/20"
                            : isWarning
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-[var(--border)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span
                            className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                              isUrgent
                                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                : isWarning
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : isSuccess
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25"
                            }`}
                          >
                            {isUrgent ? "CRITICAL / DEPLETED" : isWarning ? "LOW STOCK" : "SHIFT AUDIT"}
                          </span>
                          {n.timestamp && (
                            <span className="text-[9.5px] text-[var(--text-faint)] font-mono shrink-0">
                              {n.timestamp}
                            </span>
                          )}
                        </div>
                        <div
                          className={`font-semibold text-xs break-words whitespace-normal max-w-full ${
                            isUrgent
                              ? "text-rose-400"
                              : isWarning
                              ? "text-amber-400"
                              : "text-[var(--gold)]"
                          }`}
                        >
                          {n.title}
                        </div>
                        <div className="text-[var(--text-lo)] text-[11px] leading-relaxed mt-0.5 break-words whitespace-normal max-w-full">
                          {n.message}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar Badge with Clean Dropdown */}
        <div className="relative shrink-0 pr-0.5 sm:pr-0" ref={profileDropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            aria-label="User Profile"
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-[11px] sm:text-xs flex items-center justify-center border border-white/40 shadow-md cursor-pointer hover:scale-105 transition-transform select-none shrink-0"
          >
            {initials}
          </button>

          {/* Profile Dropdown */}
          {showProfileDropdown && (
            <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-2xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 backdrop-blur-2xl">
              <div className="p-3 border-b border-[var(--border)] mb-1">
                <p className="font-bold text-xs text-[var(--text-hi)]">{cleanUserName}</p>
                <p className="text-[10px] font-mono text-[var(--text-faint)] truncate">
                  {cleanUserEmail}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-bold border border-[var(--gold)]/30 flex items-center gap-1 truncate">
                    <Building2 className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {isBranchAdmin && cleanBranchName
                        ? cleanBranchName
                        : cleanRestaurantName}
                    </span>
                  </span>
                </div>
              </div>

              <div className="px-3 py-2 text-xs text-[var(--text-lo)] space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span className="font-semibold text-[var(--text-hi)]">
                    {isStandaloneAdmin
                      ? "Standalone Administrator"
                      : isFranchiseOwner
                      ? "Enterprise Administrator"
                      : "Branch Outlet Manager"}
                  </span>
                </div>
              </div>

              {/* Dedicated Restaurant Profile & Branding Navigation Item */}
              <div className="pt-2 border-t border-[var(--border)] px-1 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileDropdown(false);
                    if (onNavigateProfile) {
                      onNavigateProfile();
                    } else {
                      router.push("/admin/profile");
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)] transition-colors cursor-pointer group"
                >
                  <Building2 className="w-4 h-4 text-[var(--gold)] group-hover:scale-110 transition-transform shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold truncate">Restaurant Profile &amp; Branding</span>
                    <span className="text-[10px] text-[var(--text-faint)] font-mono truncate">
                      Brand logo, cuisine &amp; contact info
                    </span>
                  </div>
                </button>
              </div>

              {/* Clean Log Out Action */}
              <div className="pt-2 mt-1 border-t border-[var(--border)] px-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileDropdown(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer font-semibold text-xs"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================== LOGOUT CONFIRMATION DIALOG ===================== */}
      {showLogoutConfirm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogoutConfirm(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl sm:rounded-3xl w-full max-w-sm p-5 sm:p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-display font-black text-lg text-[var(--text-hi)]">
                Log Out from Console?
              </h3>
              <p className="text-xs text-[var(--text-lo)] leading-relaxed">
                Are you sure you want to end your active administrative session for{" "}
                <span className="text-[var(--gold)] font-bold">{cleanRestaurantName}</span>?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  if (onLogout) {
                    onLogout();
                  } else {
                    logout();
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-rose-600/30"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
