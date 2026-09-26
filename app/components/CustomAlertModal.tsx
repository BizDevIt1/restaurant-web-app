"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

export type ModalType = "success" | "info" | "warning";

export interface AlertModalOptions {
  title?: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  onConfirm?: () => void;
}

interface CustomAlertContextType {
  showAlert: (options: AlertModalOptions | string) => void;
  closeAlert: () => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | undefined>(undefined);

// Global dispatcher to allow calling from outside React components if needed
let globalAlertDispatcher: ((options: AlertModalOptions | string) => void) | null = null;

export function triggerCustomAlert(options: AlertModalOptions | string) {
  if (globalAlertDispatcher) {
    globalAlertDispatcher(options);
  } else if (typeof window !== "undefined") {
    console.log("[CustomAlertModal fallback]:", options);
  }
}

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    confirmText: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "Notification",
    message: "",
    type: "info",
    confirmText: "Acknowledge",
  });

  const showAlert = useCallback((options: AlertModalOptions | string) => {
    if (typeof options === "string") {
      setModalState({
        isOpen: true,
        title: "Notification",
        message: options,
        type: "info",
        confirmText: "OK",
      });
    } else {
      setModalState({
        isOpen: true,
        title: options.title || (options.type === "success" ? "Verification Successful" : options.type === "warning" ? "Attention" : "Notification"),
        message: options.message,
        type: options.type || "info",
        confirmText: options.confirmText || "OK",
        onConfirm: options.onConfirm,
      });
    }
  }, []);

  const closeAlert = useCallback(() => {
    if (modalState.onConfirm) {
      modalState.onConfirm();
    }
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, [modalState]);

  useEffect(() => {
    globalAlertDispatcher = showAlert;

    // Intercept native browser alert to guarantee zero default browser popups
    if (typeof window !== "undefined") {
      window.alert = (msg?: any) => {
        showAlert({
          title: "System Notification",
          message: String(msg ?? ""),
          type: "info",
        });
      };
    }

    return () => {
      globalAlertDispatcher = null;
    };
  }, [showAlert]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalState.isOpen) {
        closeAlert();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState.isOpen, closeAlert]);

  return (
    <CustomAlertContext.Provider value={{ showAlert, closeAlert }}>
      {children}

      {/* Universal Solid Dark-Grey Custom Modal (Zero Purple Glow/Borders) */}
      {modalState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAlert();
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-[#18181b] border border-[#2e2e33] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-left"
            style={{
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            }}
          >
            {/* Header with Icon & Close */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    modalState.type === "success"
                      ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                      : modalState.type === "warning"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "bg-[#27272a] text-zinc-300 border border-[#3f3f46]"
                  }`}
                >
                  {modalState.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : modalState.type === "warning" ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-zinc-100 tracking-tight">
                    {modalState.title}
                  </h3>
                  <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                    OmniBites Admin Security
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={closeAlert}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans bg-[#202024] p-4 rounded-xl border border-[#2e2e33]/70">
              {modalState.message}
            </div>

            {/* Action Buttons - Solid dark grey / neutral with ZERO purple glow */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
              <button
                type="button"
                autoFocus
                onClick={closeAlert}
                className="px-5 py-2.5 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white font-medium text-xs font-mono tracking-wide border border-[#3f3f46] transition-all cursor-pointer shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                {modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomAlertContext.Provider>
  );
}

export function useCustomAlert() {
  const context = useContext(CustomAlertContext);
  if (!context) {
    return {
      showAlert: triggerCustomAlert,
      closeAlert: () => {},
    };
  }
  return context;
}
