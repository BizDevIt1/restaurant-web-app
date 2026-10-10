"use client";

import React, { useEffect } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "warning" | "danger";
  icon?: "warning" | "trash";
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Clear Active Ticket?",
  description = "All items currently in the cart will be discarded. This cannot be undone.",
  confirmLabel = "Yes, Clear Ticket",
  cancelLabel = "Cancel / Keep Items",
  variant = "warning",
  icon = "trash",
}: ConfirmModalProps) {
  // Listen for Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const IconComponent = icon === "trash" ? Trash2 : AlertTriangle;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    >
      <div className="w-full max-w-md bg-[var(--bg-deep)] border border-amber-900/40 rounded-3xl p-6 shadow-2xl shadow-black/80 text-[var(--text-hi)] relative overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Subtle Top Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-amber-500/10 blur-2xl pointer-events-none rounded-full" />

        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge & Icon */}
        <div className="text-center pt-2">
          <div
            className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 border ${
              variant === "danger"
                ? "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_20px_-5px_rgba(239,68,68,0.3)]"
                : "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]"
            }`}
          >
            <IconComponent className="w-7 h-7 animate-pulse" />
          </div>

          <h3 className="text-xl font-display font-black text-[var(--text-hi)] tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] leading-relaxed mt-2 max-w-xs mx-auto">
            {description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-6 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-semibold text-xs sm:text-sm transition-all cursor-pointer text-center"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer text-center ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20"
                : "btn-gold text-[#342c14] shadow-md shadow-amber-500/20"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
