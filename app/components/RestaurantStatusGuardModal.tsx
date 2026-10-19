"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, Power, Lock, LogOut } from "lucide-react";
import { RestaurantEvictionType } from "@/lib/restaurantStatusEvents";

interface RestaurantStatusGuardModalProps {
  isOpen: boolean;
  evictionType: RestaurantEvictionType | null;
  onConfirmRedirect?: () => void;
}

export default function RestaurantStatusGuardModal({
  isOpen,
  evictionType,
  onConfirmRedirect,
}: RestaurantStatusGuardModalProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(4);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onConfirmRedirect) {
            onConfirmRedirect();
          } else {
            router.push("/login");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onConfirmRedirect, router]);

  if (!isOpen) return null;

  const isDeleted = evictionType === "RESTAURANT_DELETED";

  const handleManualRedirect = () => {
    if (onConfirmRedirect) {
      onConfirmRedirect();
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-md bg-[var(--bg-deep)] border ${
          isDeleted ? "border-red-500/50 shadow-red-950/50" : "border-amber-500/50 shadow-amber-950/50"
        } rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center select-none`}
      >
        {/* Header Icon */}
        <div className="flex justify-center">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-lg ${
              isDeleted
                ? "bg-red-500/15 border-red-500/30 text-red-500"
                : "bg-amber-500/15 border-amber-500/30 text-amber-500"
            }`}
          >
            {isDeleted ? <Trash2 className="w-8 h-8" /> : <Power className="w-8 h-8" />}
          </div>
        </div>

        {/* Title & Message */}
        <div className="space-y-2">
          <h2 className="font-display font-black text-xl text-[var(--text-hi)]">
            {isDeleted ? "Restaurant Permanently Deleted" : "Restaurant Account Deactivated"}
          </h2>
          <p className="text-xs text-[var(--text-lo)] leading-relaxed px-2">
            {isDeleted
              ? "Your restaurant has been permanently deleted by the Super Administrator."
              : "Your restaurant account has been deactivated by the Super Administrator. Please contact support."}
          </p>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-faint)]">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Active session terminated for platform security.</span>
        </div>

        {/* Action button & countdown */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleManualRedirect}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${
              isDeleted
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-amber-600 hover:bg-amber-500 text-white"
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Return to Login ({countdown}s)</span>
          </button>

          <p className="text-[10px] font-mono text-[var(--text-faint)]">
            Auto-forwarding to login screen...
          </p>
        </div>
      </div>
    </div>
  );
}
