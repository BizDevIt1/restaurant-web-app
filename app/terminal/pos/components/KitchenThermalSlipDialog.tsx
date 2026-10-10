"use client";

import React from "react";
import { X, Printer, ChefHat, Clock } from "lucide-react";
import { KitchenTicket } from "@/app/admin/types";

interface KitchenThermalSlipDialogProps {
  ticket: KitchenTicket | null;
  onClose: () => void;
  restaurantName?: string;
  branchName?: string;
}

export default function KitchenThermalSlipDialog({
  ticket,
  onClose,
  restaurantName,
  branchName,
}: KitchenThermalSlipDialogProps) {
  if (!ticket) return null;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Scoped CSS for 80mm Thermal Kitchen Order Ticket */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #kot-thermal-print-area,
          #kot-thermal-print-area * {
            visibility: visible !important;
          }
          #kot-thermal-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 5mm !important;
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

      <div className="relative max-w-md w-full flex flex-col items-center my-auto space-y-4 animate-in zoom-in-95 duration-150">
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between no-print px-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-wide drop-shadow-xs flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-amber-400" />
              Kitchen Order Slip (KOT) • 80mm
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-xs"
            aria-label="Close KOT dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 80mm Kitchen Thermal Paper Slip */}
        <div
          id="kot-thermal-print-area"
          className="w-full max-w-[320px] bg-white text-black p-4 sm:p-5 rounded-lg shadow-2xl font-mono text-xs leading-snug select-text border border-neutral-300 mx-auto"
          style={{
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          {/* Header */}
          <div className="text-center pb-2 border-b-2 border-dashed border-black space-y-1">
            <div className="text-lg font-black tracking-wider uppercase">
              *** KITCHEN TICKET ***
            </div>
            <div className="text-xs font-bold uppercase text-neutral-800">
              {restaurantName || "RESTAURANT KITCHEN"}
              {branchName ? ` • ${branchName}` : ""}
            </div>
            <div className="text-base font-black text-neutral-950 py-0.5 bg-neutral-200 uppercase rounded">
              TICKET #{ticket.id}
            </div>
          </div>

          {/* Ticket Context */}
          <div className="py-2 border-b border-dashed border-black space-y-1 text-xs">
            <div className="flex justify-between font-black text-sm">
              <span>DESTINATION:</span>
              <span className="uppercase text-right">{ticket.tableOrChannel}</span>
            </div>
            <div className="flex justify-between">
              <span>CHANNEL:</span>
              <span className="uppercase font-bold">{ticket.orderType}</span>
            </div>
            <div className="flex justify-between">
              <span>SERVER/CASHIER:</span>
              <span>{ticket.serverName || "Terminal"}</span>
            </div>
            <div className="flex justify-between">
              <span>ORDER TIME:</span>
              <span>{ticket.createdAt || new Date().toLocaleTimeString()}</span>
            </div>
            {ticket.priority === "urgent" && (
              <div className="text-center font-black text-xs py-0.5 bg-black text-white uppercase mt-1">
                *** URGENT EXPEDITE ***
              </div>
            )}
          </div>

          {/* Items Header */}
          <div className="py-1.5 border-b-2 border-black flex justify-between font-black text-xs">
            <span className="w-12">QTY</span>
            <span className="flex-1">ITEM SPECIFICATION</span>
          </div>

          {/* Items List */}
          <div className="py-2 space-y-2 border-b-2 border-dashed border-black">
            {ticket.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex items-start text-sm">
                  <span className="w-12 font-black text-base leading-none">
                    [{item.qty || (item as any).quantity || 1}x]
                  </span>
                  <span className="flex-1 font-bold leading-tight">
                    {item.name}
                  </span>
                </div>
                {item.notes && (
                  <div className="pl-12 text-xs font-bold italic text-neutral-800">
                    &gt;&gt; NOTE: {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Estimated Prep Time */}
          <div className="py-2 text-center text-xs border-b border-dashed border-neutral-400">
            ESTIMATED PREP TIME: ~{ticket.estimatedPrepTime || 15} MINS
          </div>

          {/* Footer Notice */}
          <div className="pt-2 text-center text-[10px] text-neutral-600 font-bold uppercase">
            *** NO FINANCIAL DATA • KITCHEN USE ONLY ***
          </div>
        </div>

        {/* Action Buttons (Screen Only) */}
        <div className="flex items-center gap-2.5 no-print w-full max-w-[320px]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-colors cursor-pointer text-center shadow-xs"
          >
            Done
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 btn-gold py-2.5 rounded-xl text-xs font-bold text-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print KOT Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
