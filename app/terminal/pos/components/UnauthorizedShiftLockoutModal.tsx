"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Clock, LogOut, Lock } from "lucide-react";

interface UnauthorizedShiftLockoutModalProps {
  isOpen: boolean;
  shiftShortName: string;
  windowLabel: string;
  assignedShiftName: string;
  cashierName: string;
  onLogOut: () => void;
}

export default function UnauthorizedShiftLockoutModal({
  isOpen,
  shiftShortName,
  windowLabel,
  assignedShiftName,
  cashierName,
  onLogOut,
}: UnauthorizedShiftLockoutModalProps) {
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeFormatted(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lockout-title"
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto pointer-events-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-[#170F0D] border border-red-500/40 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/90 text-center space-y-4 my-auto relative overflow-hidden pointer-events-auto select-none">
        {/* Glow ambient accent */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-[#e04e17]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Lockout Icon */}
        <div className="relative mx-auto w-14 h-14 rounded-2xl bg-[#2a1410] border border-red-500/30 text-red-500 flex items-center justify-center shadow-inner shadow-red-500/20">
          <ShieldAlert className="w-7 h-7 text-red-400" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-sm">
            <Lock className="w-2.5 h-2.5 stroke-[2.5]" />
          </div>
        </div>

        {/* Header & Badges */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              Terminal Register Locked
            </span>
          </div>
          <h2 id="lockout-title" className="text-xl sm:text-2xl font-display font-black text-white tracking-tight pt-1">
            Unauthorized Shift Access
          </h2>
        </div>

        {/* Warning Statement Card */}
        <div className="p-3.5 rounded-xl bg-[#261310] border border-red-500/35 text-left space-y-1 shadow-inner">
          <p className="text-xs sm:text-[13px] text-red-200 font-medium leading-relaxed">
            Access Denied: Your assigned shift is{" "}
            <span className="text-white font-bold">{shiftShortName || assignedShiftName}</span> (
            <span className="text-amber-300 font-mono font-bold">{windowLabel}</span>). You cannot log in during this shift window.
          </p>
        </div>

        {/* Session Metadata Chips */}
        <div className="grid grid-cols-2 gap-2 text-left">
          <div className="p-2.5 rounded-xl bg-[#211512] border border-[#3d241f] space-y-0.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 block">
              Staff Member
            </span>
            <p className="text-xs font-bold text-white truncate">{cashierName}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#211512] border border-[#3d241f] space-y-0.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 block">
              Current System Time
            </span>
            <p className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{currentTimeFormatted || "Checking..."}</span>
            </p>
          </div>
        </div>

        {/* Security Statement */}
        <p className="text-[10.5px] text-neutral-400 leading-normal">
          All register actions (order creation, ticket management, catalog modifications, and shift settlement) are strictly locked to protect financial audit integrity.
        </p>

        {/* Prominent Action Button: Only Log Out */}
        <div className="pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLogOut();
            }}
            className="w-full py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-mono font-bold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-red-900/50 cursor-pointer border border-red-400/40 transition-all pointer-events-auto"
          >
            <LogOut className="w-4 h-4 stroke-[2.5]" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
