"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, LogOut, LayoutDashboard, Terminal } from "lucide-react";
import { getActiveAuthSession, clearAllAuthSessions } from "../../lib/auth";

export default function UnauthorizedPage() {
  const router = useRouter();
  const [returnPath, setReturnPath] = useState<string>("/login");
  const [returnLabel, setReturnLabel] = useState<string>("Return to Login");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const session = getActiveAuthSession();
    if (!session) {
      setReturnPath("/login");
      setReturnLabel("Go to Login Screen");
      return;
    }

    const role = (session.staffRole || session.role || "").toLowerCase().trim();
    setUserRole(role || session.userType);

    if (session.userType === "ADMIN") {
      if (role === "super_admin" || role === "superadmin") {
        setReturnPath("/super-admin/dashboard");
        setReturnLabel("Return to Super Admin Console");
      } else {
        setReturnPath("/admin");
        setReturnLabel("Return to Admin Dashboard");
      }
    } else {
      // Terminal staff roles
      if (role === "waiter" || role === "server") {
        setReturnPath("/terminal/waiter");
        setReturnLabel("Return to Waiter Terminal");
      } else if (role === "chef" || role === "kitchen" || role === "cook") {
        setReturnPath("/terminal/kitchen");
        setReturnLabel("Return to Kitchen Display (KDS)");
      } else if (role === "rider") {
        setReturnPath("/terminal/rider");
        setReturnLabel("Return to Rider Terminal");
      } else {
        setReturnPath("/terminal/pos");
        setReturnLabel("Return to POS Terminal");
      }
    }
  }, []);

  const handleLogout = () => {
    clearAllAuthSessions();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen w-screen bg-[#08090c] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-[#111318]/90 border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10 flex flex-col items-center text-center">
        {/* Shield Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5 shadow-[0_0_24px_rgba(245,166,35,0.2)]">
          <ShieldAlert className="w-8 h-8 text-amber-400" />
        </div>

        <span className="text-[11px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 mb-3">
          403 · Access Restricted
        </span>

        <h1 className="text-2xl font-black tracking-tight text-white mb-2">
          Unauthorized Route
        </h1>

        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          Your current session and security privileges do not permit direct access to this section.
          {userRole && (
            <span className="block mt-1 font-mono text-xs text-zinc-300">
              Active Role: <span className="text-amber-400 font-bold uppercase">{userRole}</span>
            </span>
          )}
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.replace(returnPath)}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{returnLabel}</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-zinc-400" />
            <span>Sign Out & Switch Account</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-white/5 w-full flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>Omnibites Security Guard</span>
          <span className="text-emerald-400 font-semibold">Protected</span>
        </div>
      </div>
    </div>
  );
}
