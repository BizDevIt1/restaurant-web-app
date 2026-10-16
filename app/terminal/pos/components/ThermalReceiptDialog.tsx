"use client";

import React from "react";
import { X, Printer, CheckCircle2 } from "lucide-react";
import { OrderRecord } from "@/app/admin/types";

interface ThermalReceiptDialogProps {
  order: OrderRecord | null;
  onClose: () => void;
  taxRatePercent?: number;
  restaurantName?: string;
  branchName?: string;
  address?: string;
  phone?: string;
  autoPrint?: boolean;
  enableKitchenKds?: boolean;
}

export default function ThermalReceiptDialog({
  order,
  onClose,
  taxRatePercent = 16,
  restaurantName,
  branchName,
  address,
  phone,
  autoPrint = false,
}: ThermalReceiptDialogProps) {

  // Auto-invoke browser print dialog when autoPrint is enabled (Pure POS / Direct Thermal mode)
  React.useEffect(() => {
    if (autoPrint && order) {
      const timer = setTimeout(() => {
        if (typeof window !== "undefined") {
          window.print();
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, order]);

  if (!order) return null;

  const handlePrintSlip = () => {
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
      {/* Scoped CSS for 80mm Thermal Receipt Slip */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-print-area,
          #thermal-receipt-print-area * {
            visibility: visible !important;
          }
          #thermal-receipt-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 6mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-wide drop-shadow-xs">
              Thermal Slip Ready • 80mm Roll
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-xs"
            aria-label="Close receipt dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Authentic 80mm Thermal Paper Slip */}
        <div
          id="thermal-receipt-print-area"
          className="w-full max-w-[320px] bg-white text-black p-4 sm:p-6 rounded-lg shadow-2xl font-mono text-[11px] leading-tight select-text border border-neutral-300 mx-auto"
          style={{
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          {/* Receipt Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-neutral-400">
            <h2 className="font-black text-base tracking-wider uppercase text-neutral-900">
              {restaurantName || "THE ROYAL HAVELI"}
            </h2>
            <p className="text-[10px] text-neutral-600">
              {branchName || address || "Main Boulevard, Gulberg III, Lahore"}
            </p>
            <p className="text-[9px] text-neutral-500">
              Phone: {phone || "+92 300 8472910"}
            </p>
            <p className="text-[9px] text-neutral-500">
              STRN: 32778761-0 • NTN: 8492018-4
            </p>
            <div className="pt-1 font-bold text-[10px] tracking-wide text-neutral-800 uppercase">
              *** TAX INVOICE ***
            </div>
          </div>

          {/* Order Metadata */}
          <div className="py-2.5 space-y-0.5 text-[10px] text-neutral-700 border-b border-dashed border-neutral-400">
            <div className="flex justify-between">
              <span>INVOICE NO:</span>
              <span className="font-bold text-neutral-900">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span>DATE/TIME:</span>
              <span>{order.timestamp}</span>
            </div>
            <div className="flex justify-between">
              <span>CHANNEL:</span>
              <span className="uppercase font-bold">
                {order.orderChannel === "dine_in"
                  ? order.tableName || `Table ${order.tableId}`
                  : order.orderChannel === "takeaway"
                    ? "TAKEAWAY COUNTER"
                    : "DELIVERY RIDER"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>CASHIER:</span>
              <span>{order.cashierName || "Terminal Cashier"}</span>
            </div>
            <div className="flex justify-between">
              <span>PAYMENT MODE:</span>
              <span className="uppercase font-bold">{order.paymentMethod}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between text-neutral-900">
                <span>CUSTOMER:</span>
                <span className="font-bold truncate max-w-[150px]">{order.customerName}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex justify-between text-neutral-900">
                <span>PHONE:</span>
                <span className="font-bold">{order.customerPhone}</span>
              </div>
            )}
            {order.delivery_zone && (
              <div className="flex justify-between text-neutral-900">
                <span>DELIVERY AREA:</span>
                <span className="font-bold truncate max-w-[150px]">{order.delivery_zone}</span>
              </div>
            )}
          </div>

          {/* Itemized Table Header */}
          <div className="py-2 border-b border-dashed border-neutral-400">
            <div className="flex justify-between text-[10px] font-bold text-neutral-900 pb-1">
              <span className="w-1/2">ITEM</span>
              <span className="w-1/6 text-center">QTY</span>
              <span className="w-1/3 text-right">PRICE (PKR)</span>
            </div>

            {/* Items */}
            <div className="space-y-1 pt-1">
              {order.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-[10.5px]">
                  <span className="w-1/2 truncate font-semibold text-neutral-800">
                    {it.name}
                    {it.notes ? <span className="block text-[9px] text-neutral-500 font-normal">({it.notes})</span> : null}
                  </span>
                  <span className="w-1/6 text-center text-neutral-700 font-bold">{it.quantity}</span>
                  <span className="w-1/3 text-right font-bold text-neutral-900">
                    {(it.price * it.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Tax Calculation */}
          <div className="py-2.5 space-y-1 text-[10px] border-b border-dashed border-neutral-400">
            <div className="flex justify-between text-neutral-700">
              <span>SUBTOTAL:</span>
              <span>Rs {order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-neutral-700">
              <span>SALES TAX ({taxRatePercent}%):</span>
              <span>Rs {order.taxAmount.toLocaleString()}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-neutral-700">
                <span>DISCOUNT ({order.discountPercent}%):</span>
                <span>- Rs {order.discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-neutral-950 pt-1.5 border-t border-neutral-800">
              <span>NET TOTAL:</span>
              <span>Rs {order.total.toLocaleString()}</span>
            </div>
          </div>

          {/* Footer Notice & Signature */}
          <div className="text-center pt-3 space-y-2 text-[9.5px] text-neutral-600">
            <p>Thank you for dining with us!</p>
            <p>Please present this invoice for customer support or feedback.</p>

            <div className="pt-2 pb-1 border-t border-dotted border-neutral-400 flex justify-between items-end text-[8.5px]">
              <span>Customer Stamp</span>
              <span>Cashier Signature</span>
            </div>

            <p className="text-[8px] text-neutral-400 pt-1 font-mono">
              Powered by OmniPOS Enterprise Engine v2.0
            </p>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="w-full grid grid-cols-2 gap-2.5 no-print pt-2">
          <button
            type="button"
            onClick={handlePrintSlip}
            className="btn-gold font-bold py-3 px-3 rounded-xl text-xs text-black cursor-pointer flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Slip</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold cursor-pointer transition-colors text-center shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
