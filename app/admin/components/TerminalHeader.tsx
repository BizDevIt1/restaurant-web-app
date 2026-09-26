"use client";

import React from "react";
import { LogOut, Receipt, Flame, Bike, MapPin, Store, ShieldCheck } from "lucide-react";
import { AuthenticatedUser } from "../types";

interface TerminalHeaderProps {
  user: AuthenticatedUser;
  onLogout: () => void;
}

export default function TerminalHeader({ user, onLogout }: TerminalHeaderProps) {
  const brandName = user.restaurantName || "Restaurant";
  const branchName = user.branchName || user.city || "Main Counter";
  const brandInitials = brandName.substring(0, 2).toUpperCase();
  const terminalAccess = user.terminalAccess || "POS_ONLY";
  const staffRole = (user.staffRole || user.role || "staff").toUpperCase();

  return (
    <header className="w-full bg-[#0c0806] border-b border-[var(--border)] px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between gap-4 select-none z-30 shadow-md">
      {/* Left: Brand Emblem & Outlet Identification */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1c140d] to-[#2d2015] border border-[var(--gold)]/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
          {user.logoUrl ? (
            <img src={user.logoUrl} alt={brandName} className="w-full h-full object-contain p-1" />
          ) : (
            <span className="font-display font-black text-xs text-[var(--gold)]">
              {brandInitials}
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-sm sm:text-base text-[var(--text-hi)] truncate leading-tight">
              {brandName}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 font-semibold shrink-0">
              <ShieldCheck className="w-3 h-3" />
              Staff Kiosk
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-faint)] truncate mt-0.5">
            <MapPin className="w-3 h-3 text-[var(--gold)] shrink-0" />
            <span className="truncate">{branchName}</span>
          </div>
        </div>
      </div>

      {/* Center: Locked Terminal Status Badge */}
      <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#140e0a] border border-[var(--border)] shadow-inner">
        {terminalAccess === "POS_ONLY" && (
          <>
            <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
            <Receipt className="w-4 h-4 text-[#25d366]" />
            <span className="text-xs font-mono font-bold text-[#25d366] tracking-wide">
              POS BILLING TERMINAL • LOCKED
            </span>
          </>
        )}
        {terminalAccess === "KDS_ONLY" && (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-amber-400 tracking-wide">
              KITCHEN PREP (KDS) • LOCKED
            </span>
          </>
        )}
        {terminalAccess === "RIDER_ONLY" && (
          <>
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <Bike className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-mono font-bold text-blue-400 tracking-wide">
              RIDER DISPATCH • LOCKED
            </span>
          </>
        )}
      </div>

      {/* Right: Staff Identity & Direct Log Out Button */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Staff Identity Pill */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[var(--surface-hi)]/60 border border-[var(--border)]">
          <div className="w-7 h-7 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 font-display font-bold text-xs flex items-center justify-center shrink-0">
            {user.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold text-[var(--text-hi)] leading-tight truncate max-w-[130px]">
              {user.name}
            </p>
            <p className="text-[9.5px] font-mono font-bold text-[var(--gold)] uppercase tracking-wider">
              {staffRole}
            </p>
          </div>
        </div>

        {/* Direct Log Out Button */}
        <button
          type="button"
          onClick={onLogout}
          title="Sign out of staff terminal"
          className="py-1.5 px-3 sm:px-3.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-bold font-sans flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
}
