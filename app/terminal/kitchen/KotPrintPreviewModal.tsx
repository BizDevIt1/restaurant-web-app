"use client";

import React, { useState } from "react";
import {
  X,
  Printer,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  ChefHat,
  Wifi,
  WifiOff,
  Copy,
} from "lucide-react";
import { KitchenTicket } from "@/app/admin/types";
import { printerService } from "@/utils/printing/printerService";
import { formatTicketToPlainText } from "@/utils/printing/escposFormatter";

interface KotPrintPreviewModalProps {
  ticket: KitchenTicket | null;
  isOpen: boolean;
  onClose: () => void;
  restaurantName?: string;
  branchName?: string;
  onPrintSuccess?: (ticketId: string, printedAt: string, reprintCount: number) => void;
  onPrintFailed?: (ticketId: string, error: string) => void;
}

export default function KotPrintPreviewModal({
  ticket,
  isOpen,
  onClose,
  restaurantName = "RESTAURANT KITCHEN",
  branchName = "Main Station",
  onPrintSuccess,
  onPrintFailed,
}: KotPrintPreviewModalProps) {
  const [printerIp, setPrinterIp] = useState<string>(() => printerService.getPrinterIp());
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  if (!isOpen || !ticket) return null;

  const reprintCount = ticket.reprint_count ?? (ticket.printed_at ? 1 : 0);
  const isRush =
    (ticket.priority || "").toLowerCase() === "rush" ||
    (ticket.priority || "").toLowerCase() === "urgent";

  const handleSaveIp = (newIp: string) => {
    const trimmed = newIp.trim();
    setPrinterIp(trimmed);
    printerService.setPrinterIp(trimmed);
    setTestResult(null);
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await printerService.testPrint(printerIp);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || "Diagnostic test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDirectEscPosPrint = async () => {
    setIsPrinting(true);
    setPrintError(null);

    try {
      const res = await printerService.printKOT(
        ticket,
        {
          restaurantName,
          branchName,
          reprintCount: ticket.printed_at ? reprintCount + 1 : 0,
        },
        printerIp
      );

      if (res.success) {
        const nowIso = new Date().toISOString();
        const nextReprint = ticket.printed_at ? reprintCount + 1 : 0;
        onPrintSuccess?.(ticket.id, nowIso, nextReprint);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        const errMsg = res.error || `Printer offline at ${printerIp} after 3 attempts`;
        setPrintError(errMsg);
        onPrintFailed?.(ticket.id, errMsg);
      }
    } catch (err: any) {
      const errMsg = err?.message || "Physical print communication exception";
      setPrintError(errMsg);
      onPrintFailed?.(ticket.id, errMsg);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBrowserPrintFallback = () => {
    const nowIso = new Date().toISOString();
    const nextReprint = ticket.printed_at ? reprintCount + 1 : 0;
    onPrintSuccess?.(ticket.id, nowIso, nextReprint);
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Scoped CSS for 80mm Thermal Kitchen Order Ticket */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #kot-thermal-paper-slip,
          #kot-thermal-paper-slip * {
            visibility: visible !important;
          }
          #kot-thermal-paper-slip {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 13px !important;
            line-height: 1.3 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative max-w-lg w-full flex flex-col items-center my-auto space-y-4 animate-in zoom-in-95 duration-150">
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between no-print px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-[var(--gold)]" />
              <span>80mm Thermal KOT Print Preview</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              title="Configure Network Printer IP"
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                showConfig
                  ? "bg-[var(--gold)] text-black border-[var(--gold)]"
                  : "bg-white/10 hover:bg-white/20 text-white/80 border-white/20"
              }`}
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printer Network Configuration Panel (Collapsible) */}
        {showConfig && (
          <div className="w-full max-w-[340px] bg-neutral-900 border border-[var(--gold)]/40 p-3.5 rounded-2xl space-y-2.5 text-xs font-mono shadow-xl no-print animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[var(--gold)] font-bold flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" />
                <span>Thermal Printer Setup</span>
              </span>
              <span className="text-[10px] text-neutral-400">Port 9100 RAW</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={printerIp}
                onChange={(e) => handleSaveIp(e.target.value)}
                placeholder="192.168.1.180"
                className="flex-1 bg-black/60 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-[var(--gold)]"
              />
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={isTesting}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-200 font-bold text-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
              >
                {isTesting ? "Testing..." : "Test Slip"}
              </button>
            </div>

            {testResult && (
              <p
                className={`text-[11px] font-mono p-2 rounded-lg border ${
                  testResult.success
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                    : "bg-red-950/40 text-red-300 border-red-500/30"
                }`}
              >
                {testResult.message}
              </p>
            )}
          </div>
        )}

        {/* Offline / Error Alert Notice with Retry Queue */}
        {printError && (
          <div className="w-full max-w-[340px] bg-red-950/40 border border-red-500/50 p-3 rounded-2xl text-xs font-mono text-red-300 space-y-2 shadow-lg no-print animate-in shake duration-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1 space-y-1">
                <p className="font-bold">Hardware Dispatch Failed (3 Attempts):</p>
                <p className="text-[11px] text-red-400/90 leading-tight">{printError}</p>
                <p className="text-[10px] text-neutral-400">
                  Ticket has been placed in the offline retry queue. You can use Browser Print below without interrupting kitchen flow.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDirectEscPosPrint}
                disabled={isPrinting}
                className="flex-1 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Hardware (3x)</span>
              </button>
              <button
                type="button"
                onClick={handleBrowserPrintFallback}
                className="flex-1 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>Use Browser</span>
              </button>
            </div>
          </div>
        )}

        {/* 80mm Physical Thermal Paper Slip Preview */}
        <div
          id="kot-thermal-paper-slip"
          className="w-full max-w-[340px] bg-white text-black p-5 rounded-lg shadow-2xl font-mono text-xs leading-snug select-text border border-neutral-300 mx-auto relative overflow-hidden"
          style={{
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          {/* Jagged / Perforated Paper Receipt Border Along Top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 border-b border-dashed border-neutral-300" />

          {/* Restaurant Header */}
          <div className="text-center pb-2 border-b-2 border-dashed border-black space-y-1">
            <div className="text-lg font-black tracking-wider uppercase leading-tight">
              {restaurantName}
            </div>
            {branchName && (
              <div className="text-[11px] font-bold uppercase text-neutral-700">
                {branchName}
              </div>
            )}
            <div className="text-xs font-black tracking-widest uppercase pt-0.5">
              *** KITCHEN ORDER TICKET (KOT) ***
            </div>
            <div className="text-base font-black text-black py-0.5 bg-neutral-200 uppercase rounded tracking-wide">
              TICKET #{ticket.id}
            </div>
          </div>

          {/* Order Metadata Context */}
          <div className="py-2 border-b border-dashed border-black space-y-1 text-xs">
            <div className="flex justify-between font-black text-sm">
              <span>DESTINATION:</span>
              <span className="uppercase text-right">
                {ticket.tableOrChannel || "Counter Takeaway"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>CHANNEL:</span>
              <span className="uppercase font-bold">{ticket.orderType || "DINE_IN"}</span>
            </div>
            <div className="flex justify-between">
              <span>SERVER:</span>
              <span>{ticket.serverName || "POS Cashier"}</span>
            </div>
            <div className="flex justify-between">
              <span>DATE/TIME:</span>
              <span>
                {new Date().toLocaleDateString([], { month: "2-digit", day: "2-digit" })}{" "}
                {ticket.createdAt || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {ticket.station_assigned && (
              <div className="flex justify-between font-bold">
                <span>STATION:</span>
                <span className="uppercase">{ticket.station_assigned}</span>
              </div>
            )}

            {/* Rush Priority Callout */}
            {isRush && (
              <div className="text-center font-black text-xs py-1 bg-black text-white uppercase mt-1 tracking-wider">
                *** URGENT / RUSH PRIORITY ***
              </div>
            )}
          </div>

          {/* Dish Items Header */}
          <div className="py-1.5 border-b-2 border-black flex justify-between font-black text-xs">
            <span className="w-12">QTY</span>
            <span className="flex-1">ITEM SPECIFICATION</span>
            <span className="w-12 text-right">PREP</span>
          </div>

          {/* Dish Items List */}
          <div className="py-2 space-y-2.5 border-b-2 border-dashed border-black">
            {(ticket.items || []).map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex items-start text-sm">
                  <span className="w-12 font-black text-base leading-none">
                    [{item.qty || (item as any).quantity || 1}x]
                  </span>
                  <span className="flex-1 font-bold leading-tight">
                    {item.name}
                  </span>
                  <span className="w-12 text-right text-xs font-mono font-bold text-neutral-600">
                    {item.prepTime || `${item.preparation_time || 15}m`}
                  </span>
                </div>

                {/* Indented Special Instructions */}
                {item.notes && item.notes.trim() && (
                  <div className="pl-12 text-xs font-bold italic text-neutral-900">
                    &gt;&gt; INSTRUCTION: {item.notes.trim()}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chef Notes / Kitchen Remarks */}
          <div className="py-2 border-b border-dashed border-black space-y-1 text-xs">
            <div className="font-black uppercase tracking-wider">
              CHEF NOTES / REMARKS:
            </div>
            <div className="text-neutral-800 italic pl-2">
              {ticket.items?.some((it) => it.notes)
                ? ticket.items
                    .map((it) => it.notes)
                    .filter(Boolean)
                    .join(" • ")
                : "Standard line prep guidelines. Expedite when ready."}
            </div>
            <div className="text-[11px] font-bold text-neutral-600 pt-0.5">
              Target Prep Time: ~{ticket.estimatedPrepTime || ticket.estimated_prep_time || 15} mins
            </div>
          </div>

          {/* Footer Receipt Notice */}
          <div className="pt-2 text-center text-[10px] text-neutral-700 font-bold uppercase space-y-0.5">
            {reprintCount > 0 && (
              <div className="font-black text-neutral-900 bg-neutral-200 py-0.5 rounded">
                *** REPRINT #{reprintCount} ***
              </div>
            )}
            <div>*** KITCHEN USE ONLY • NO FINANCIAL VALUE ***</div>
          </div>

          {/* Jagged Bottom Paper Edge */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 border-t border-dashed border-neutral-300" />
        </div>

        {/* Modal Action Buttons (Screen Only) */}
        <div className="flex items-center gap-2.5 no-print w-full max-w-[340px]">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-colors cursor-pointer text-center shadow-xs"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleBrowserPrintFallback}
            title="Open browser system print dialog"
            className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-xs font-bold text-neutral-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-neutral-400" />
            <span>Browser</span>
          </button>

          <button
            type="button"
            onClick={handleDirectEscPosPrint}
            disabled={isPrinting}
            className="flex-1 btn-gold py-2.5 rounded-xl text-xs font-bold text-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isPrinting ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Sending ESC/POS...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Print to 80mm</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
