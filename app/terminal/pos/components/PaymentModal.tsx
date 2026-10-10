"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Banknote,
  CreditCard,
  QrCode,
  Split,
  X,
  Check,
  Receipt,
  Percent,
  Calculator,
  ArrowRight,
} from "lucide-react";
import { playPosSound } from "@/utils/posAudio";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  taxAmount: number;
  taxRatePercent: number;
  discountPercent: number;
  setDiscountPercent: (pct: number) => void;
  flatDiscount?: number;
  setFlatDiscount?: (amt: number) => void;
  discountMode?: "percent" | "flat";
  setDiscountMode?: (mode: "percent" | "flat") => void;
  cartTotal: number;
  selectedMethod: "cash" | "card" | "raast" | "split";
  setSelectedMethod: (m: "cash" | "card" | "raast" | "split") => void;
  onConfirmSettlement: (paymentDetails: {
    method: "cash" | "card" | "raast" | "split";
    tenderedAmount: number;
    changeAmount: number;
    splitBreakdown?: { cash: number; card: number };
  }) => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  subtotal,
  taxAmount,
  taxRatePercent,
  discountPercent,
  setDiscountPercent,
  flatDiscount = 0,
  setFlatDiscount,
  discountMode = "percent",
  setDiscountMode,
  cartTotal,
  selectedMethod,
  setSelectedMethod,
  onConfirmSettlement,
}: PaymentModalProps) {
  const [tenderedInput, setTenderedInput] = useState<string>("");
  const [splitCashInput, setSplitCashInput] = useState<string>("");
  const [splitCardInput, setSplitCardInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setTenderedInput("");
      const half = Math.ceil(cartTotal / 2);
      setSplitCashInput(String(half));
      setSplitCardInput(String(cartTotal - half));
    }
  }, [isOpen, cartTotal]);

  if (!isOpen) return null;

  const tenderedAmount = parseFloat(tenderedInput) || 0;
  const changeAmount = Math.max(0, tenderedAmount - cartTotal);
  const isCashUnderpaid = selectedMethod === "cash" && tenderedAmount < cartTotal;

  const splitCash = parseFloat(splitCashInput) || 0;
  const splitCard = parseFloat(splitCardInput) || 0;
  const splitSum = splitCash + splitCard;
  const isSplitBalanced = Math.abs(splitSum - cartTotal) < 0.01;

  const handleSettle = async () => {
    if (isSubmitting) return;
    if (selectedMethod === "cash" && isCashUnderpaid) {
      playPosSound("buzz");
      return;
    }
    if (selectedMethod === "split" && !isSplitBalanced) {
      playPosSound("buzz");
      return;
    }

    setIsSubmitting(true);
    playPosSound("tender");
    try {
      await onConfirmSettlement({
        method: selectedMethod,
        tenderedAmount: selectedMethod === "cash" ? tenderedAmount : cartTotal,
        changeAmount: selectedMethod === "cash" ? changeAmount : 0,
        splitBreakdown:
          selectedMethod === "split" ? { cash: splitCash, card: splitCard } : undefined,
      });
    } catch (err) {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="w-[94vw] max-w-[440px] max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--bg-deep)] border border-[var(--border)] shadow-2xl p-3.5 sm:p-4 space-y-3 flex flex-col mx-auto animate-in zoom-in-95 duration-150 text-[var(--text-hi)] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/25 text-[var(--gold)] flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-hi)] leading-tight">
                Tender Payment &amp; Settle
              </h3>
              <p className="text-[11px] font-mono text-[var(--text-lo)] leading-tight">
                Select tender channel, apply discounts and record invoice.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bill Summary Banner */}
        <div className="p-2.5 rounded-xl glass-panel flex items-center justify-between font-mono">
          <div>
            <span className="text-[10px] text-[var(--text-lo)] block uppercase font-medium">Net Amount Payable</span>
            <span className="text-xl font-black text-[var(--gold)]">
              Rs {cartTotal.toLocaleString()}
            </span>
          </div>
          <div className="text-right text-[10px] text-[var(--text-lo)] space-y-0.5">
            <div>Subtotal: Rs {subtotal.toLocaleString()}</div>
            <div>Tax ({taxRatePercent}%): Rs {taxAmount.toLocaleString()}</div>
          </div>
        </div>

        {/* Discount Selector: Percentage vs Flat Rs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <Percent className="w-3 h-3 text-[var(--gold)]" />
              <span className="text-[var(--text-lo)] font-semibold uppercase text-[10px]">Discount:</span>
              {setDiscountMode && (
                <div className="inline-flex rounded-md p-0.5 bg-[var(--surface-hi)] border border-[var(--border)] ml-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountMode("percent");
                      if (setFlatDiscount) setFlatDiscount(0);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                      discountMode === "percent"
                        ? "btn-gold text-[#342c14] shadow-xs"
                        : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                    }`}
                  >
                    % Pct
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountMode("flat");
                      setDiscountPercent(0);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                      discountMode === "flat"
                        ? "btn-gold text-[#342c14] shadow-xs"
                        : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                    }`}
                  >
                    Flat Rs
                  </button>
                </div>
              )}
            </div>
            {discountMode === "percent" && discountPercent > 0 && (
              <span className="text-emerald-500 font-bold text-[10px]">{discountPercent}% Applied</span>
            )}
            {discountMode === "flat" && flatDiscount > 0 && (
              <span className="text-emerald-500 font-bold text-[10px]">Rs {flatDiscount.toLocaleString()} Off</span>
            )}
          </div>

          {discountMode === "percent" ? (
            <div className="grid grid-cols-5 gap-1 font-mono text-[11px]">
              {[0, 5, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDiscountPercent(pct)}
                  className={`py-1 rounded-lg border text-center transition-all cursor-pointer font-medium ${
                    discountPercent === pct
                      ? "btn-gold text-[#342c14] border-transparent font-bold shadow-sm"
                      : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-lo)] hover:border-[var(--gold)]/50"
                  }`}
                >
                  {pct === 0 ? "None" : `${pct}%`}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1 font-mono">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-lo)] font-bold">Rs</span>
                <input
                  type="number"
                  placeholder="Enter custom discount amount..."
                  value={flatDiscount || ""}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    if (setFlatDiscount) setFlatDiscount(val);
                  }}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 text-[11px] font-bold text-[var(--text-hi)] pl-7 pr-2.5 py-1 rounded-lg focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                {[0, 50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      if (setFlatDiscount) setFlatDiscount(amt);
                    }}
                    className={`flex-1 py-0.5 rounded border text-center text-[9px] transition-all cursor-pointer font-medium ${
                      flatDiscount === amt
                        ? "btn-gold text-[#342c14] border-transparent font-bold shadow-xs"
                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-lo)] hover:border-[var(--gold)]/50"
                    }`}
                  >
                    {amt === 0 ? "None" : `Rs ${amt}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tender Method Selector */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-lo)] uppercase font-semibold">
            Tender Method:
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: "cash", label: "Cash", icon: Banknote },
              { id: "card", label: "Card", icon: CreditCard },
              { id: "raast", label: "Raast QR", icon: QrCode },
              { id: "split", label: "Split", icon: Split },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMethod(m.id as any)}
                className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${selectedMethod === m.id
                    ? "btn-gold text-[#342c14] border-transparent font-bold shadow-sm"
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-lo)] hover:border-[var(--gold)]/50"
                  }`}
              >
                <m.icon className="w-3.5 h-3.5" />
                <span className="text-[10.5px] font-mono font-medium">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cash Tender Details & Change Calculation */}
        {selectedMethod === "cash" && (
          <div className="p-2.5 rounded-xl glass-panel space-y-2 font-mono">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--text-lo)] font-medium">Cash Tendered by Customer (PKR):</span>
                <span className="text-[var(--gold)] font-bold">Total Due: Rs {cartTotal.toLocaleString()}</span>
              </div>
              <input
                type="number"
                value={tenderedInput}
                onChange={(e) => setTenderedInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCashUnderpaid) {
                    handleSettle();
                  }
                }}
                placeholder={`Type cash given (e.g. ${cartTotal})`}
                autoFocus
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-lg py-1.5 px-3 text-base font-bold text-[var(--text-hi)] focus:outline-none transition-colors"
              />
            </div>

            {/* Change Result */}
            <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border)] text-[11px]">
              <span className="text-[var(--text-lo)] font-medium">Change to Return:</span>
              <span
                className={`text-sm font-black ${
                  !tenderedInput || tenderedAmount === 0
                    ? "text-[var(--text-lo)] text-xs font-normal"
                    : isCashUnderpaid
                    ? "text-red-500"
                    : "text-emerald-500"
                }`}
              >
                {!tenderedInput || tenderedAmount === 0
                  ? `Enter cash given (Total: Rs ${cartTotal.toLocaleString()})`
                  : isCashUnderpaid
                  ? `Short: Rs ${(cartTotal - tenderedAmount).toLocaleString()}`
                  : `Rs ${changeAmount.toLocaleString()}`}
              </span>
            </div>
          </div>
        )}

        {/* Split Tender Details */}
        {selectedMethod === "split" && (
          <div className="p-2.5 rounded-xl glass-panel space-y-2 font-mono">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <span className="text-[10px] text-[var(--text-lo)] font-medium">Cash Portion (PKR):</span>
                <input
                  type="number"
                  value={splitCashInput}
                  onChange={(e) => {
                    const c = parseFloat(e.target.value) || 0;
                    setSplitCashInput(e.target.value);
                    setSplitCardInput(String(Math.max(0, cartTotal - c)));
                  }}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-lg py-1 px-2 text-xs font-bold text-[var(--text-hi)] focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-[var(--text-lo)] font-medium">Card Portion (PKR):</span>
                <input
                  type="number"
                  value={splitCardInput}
                  onChange={(e) => {
                    const cd = parseFloat(e.target.value) || 0;
                    setSplitCardInput(e.target.value);
                    setSplitCashInput(String(Math.max(0, cartTotal - cd)));
                  }}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-lg py-1 px-2 text-xs font-bold text-[var(--text-hi)] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-[11px]">
              <span className="text-[var(--text-lo)] font-medium">Total Allocated:</span>
              <span
                className={`font-bold ${isSplitBalanced ? "text-emerald-500" : "text-[var(--gold)]"
                  }`}
              >
                Rs {splitSum.toLocaleString()} / Rs {cartTotal.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Card or Raast instructions */}
        {(selectedMethod === "card" || selectedMethod === "raast") && (
          <div className="p-2.5 rounded-xl glass-panel text-center text-[11px] font-mono text-[var(--text-lo)]">
            {selectedMethod === "card"
              ? "Swipe/Insert card into POS merchant terminal and verify approval."
              : "Scan customer Raast QR code or display terminal static QR."}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-1.5 flex items-center justify-end gap-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-xs text-[var(--text-lo)] font-medium border border-[var(--border)] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              isSubmitting ||
              (selectedMethod === "cash" && isCashUnderpaid) ||
              (selectedMethod === "split" && !isSplitBalanced)
            }
            onClick={handleSettle}
            className={`btn-gold font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${
              isSubmitting ||
              (selectedMethod === "cash" && isCashUnderpaid) ||
              (selectedMethod === "split" && !isSplitBalanced)
                ? "opacity-50 cursor-not-allowed pointer-events-none"
                : ""
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Processing..." : "Complete & Print Slip"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
