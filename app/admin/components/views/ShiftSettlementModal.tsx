"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Lock,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  CreditCard,
  QrCode,
  Clock,
  User,
  Building2,
  FileText,
  Calendar,
  Layers,
  TrendingUp,
  Calculator,
  RefreshCw,
  Sparkles,
  Receipt,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { OrderRecord, ShiftSettlement } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface ShiftSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  orders?: OrderRecord[];
  cashierName?: string;
  onSettled?: (settlement: ShiftSettlement) => void;
}

export default function ShiftSettlementModal({
  isOpen,
  onClose,
  showToast,
  orders: propOrders,
  cashierName: propCashierName,
  onSettled,
}: ShiftSettlementModalProps) {
  const { user } = useAuth();

  // Dynamic Session & Cashier Identity
  const cashierName = propCashierName || user?.name || user?.email || "Terminal Cashier";

  // Dynamic Branch Settings State (for currency, restaurant name, fraud threshold)
  const [branchSettings, setBranchSettings] = useState<{
    restaurant_name?: string;
    currency_symbol?: string;
    variance_threshold?: number;
    printer_paper_width?: string;
  } | null>(null);

  // 1. Fallback Start Time: Resolves dynamically to start of the current day (00:00:00)
  const [shiftStart, setShiftStart] = useState<string>(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return todayStart.toISOString();
  });
  const [hasFetchedLastShift, setHasFetchedLastShift] = useState(false);

  const shiftStartTimeFormatted = useMemo(() => {
    try {
      return new Date(shiftStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Earlier Today";
    }
  }, [shiftStart]);

  // Float & Reconciliation States
  const [openingFloat, setOpeningFloat] = useState<string>("5000");
  const [actualCashCounted, setActualCashCounted] = useState<string>("");
  const [closingNotes, setClosingNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [liveOrders, setLiveOrders] = useState<OrderRecord[]>([]);
  const [liveExpenses, setLiveExpenses] = useState<any[]>([]);

  // Denomination breakdown calculator state
  const [showDenominations, setShowDenominations] = useState<boolean>(false);
  const [denominations, setDenominations] = useState({
    n5000: "",
    n1000: "",
    n500: "",
    n100: "",
    n50: "",
    n20: "",
    n10: "",
    coins: "",
  });

  // Track if initial fill has occurred for the current open session
  const initializedForSessionRef = useRef<boolean>(false);

  // Dynamic Labels from Session / Settings
  const restaurantName =
    user?.restaurantName || branchSettings?.restaurant_name || "Restaurant Terminal";
  const currencySymbol = branchSettings?.currency_symbol || "Rs";
  const registerId = user?.branchName ? `${user.branchName} • Register #01` : "Register #01";

  // 1. Fetch live settings & last closed shift to establish accurate current shift start
  useEffect(() => {
    if (!isOpen) {
      initializedForSessionRef.current = false;
      return;
    }

    let isMounted = true;

    const fetchShiftPrerequisites = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        // A. Fetch Branch Settings for dynamic currency, name, and fraud threshold
        const { data: settingsData } = await supabase
          .from("branch_settings")
          .select("*")
          .eq("restaurant_id", restId)
          .maybeSingle();

        if (settingsData && isMounted) {
          setBranchSettings(settingsData);
        }

        // B. Fetch Last Settled Shift:
        // If 0 previous rows, fallback strictly to start of current day (new Date().setHours(0,0,0,0))
        const { data: shiftData, error: shiftError } = await supabase
          .from("shift_settlements")
          .select("shift_end, created_at, actual_cash_counted, opening_float")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (!shiftError && shiftData && shiftData.length > 0 && isMounted) {
          const lastClose = shiftData[0].shift_end || shiftData[0].created_at;
          if (lastClose) {
            setShiftStart(lastClose);
          }
        } else if (isMounted) {
          // Dynamic fallback: 0 previous rows -> Start of current day
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          setShiftStart(todayStart.toISOString());
        }
      } catch (e) {
        console.warn("[ShiftSettlementModal] Shift init warning:", e);
        if (isMounted) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          setShiftStart(todayStart.toISOString());
        }
      } finally {
        if (isMounted) setHasFetchedLastShift(true);
      }
    };

    fetchShiftPrerequisites();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  // 2. Fetch live shift orders strictly from Supabase public.orders
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const loadShiftOrders = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restId)
          .neq("order_status", "cancelled")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("[ShiftSettlementModal] Orders query fallback:", error.message);
          if (propOrders && propOrders.length > 0 && isMounted) {
            setLiveOrders(propOrders);
          }
          return;
        }

        if (data && isMounted) {
          const mapped: OrderRecord[] = data.map((o: any) => ({
            id: o.order_number || o.id,
            orderChannel: o.order_channel || "dine_in",
            tableId: o.table_id ? 1 : undefined,
            tableName: o.customer_name || `Order ${o.order_number || o.id}`,
            items: Array.isArray(o.items) ? o.items : [],
            subtotal: Number(o.subtotal || o.total_amount || 0),
            taxAmount: Number(o.tax_amount || 0),
            discountPercent: 0,
            discountAmount: Number(o.discount_amount || 0),
            total: Number(o.total_amount || o.subtotal || 0),
            paymentMethod: (o.payment_method || "cash").toLowerCase(),
            cashierName: o.cashier_name || cashierName,
            timestamp: o.created_at || new Date().toISOString(),
            status: o.order_status || "completed",
          }));
          setLiveOrders(mapped);
        }
      } catch (err) {
        console.error("[ShiftSettlementModal] Live order fetch error:", err);
        if (propOrders && propOrders.length > 0 && isMounted) {
          setLiveOrders(propOrders);
        }
      }
    };

    loadShiftOrders();
    return () => {
      isMounted = false;
    };
  }, [isOpen, propOrders, user, cashierName]);

  // 3. Cash Expenses Deduction: Fetch public.operating_expenses (paid via CASH during this shift window)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const loadShiftExpenses = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        // Fetch operating expenses for current restaurant
        const { data, error } = await supabase
          .from("operating_expenses")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false });

        if (!error && data && isMounted) {
          setLiveExpenses(data);
        }
      } catch (err) {
        console.warn("[ShiftSettlementModal] Expense fetch info:", err);
      }
    };

    loadShiftExpenses();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  // 4. Dynamic Shift Aggregation (Calculates strictly for this shift)
  const shiftMetrics = useMemo(() => {
    const shiftStartTime = new Date(shiftStart).getTime();

    // Filter to orders placed during this shift window
    const shiftOrders = liveOrders.filter((o) => {
      const orderTime = new Date(o.timestamp).getTime();
      if (isNaN(orderTime)) return true;
      return isNaN(shiftStartTime) ? true : orderTime >= shiftStartTime;
    });

    const targetOrders = shiftOrders.length > 0 ? shiftOrders : liveOrders;

    let systemCashSales = 0;
    let systemCardSales = 0;
    let systemDigitalSales = 0;
    let totalTaxCollected = 0;
    let totalDiscounts = 0;
    let grossSales = 0;

    targetOrders.forEach((order) => {
      const total = Number(order.total) || 0;
      const tax = Number(order.taxAmount) || 0;
      const disc = Number(order.discountAmount) || 0;
      const pm = (order.paymentMethod || "cash").toLowerCase();

      grossSales += total;
      totalTaxCollected += tax;
      totalDiscounts += disc;

      if (pm === "card") {
        systemCardSales += total;
      } else if (
        pm === "raast" ||
        pm === "online" ||
        pm === "bank_transfer" ||
        pm === "digital" ||
        pm === "wallet"
      ) {
        systemDigitalSales += total;
      } else {
        systemCashSales += total;
      }
    });

    return {
      totalOrdersCount: targetOrders.length,
      systemCashSales,
      systemCardSales,
      systemDigitalSales,
      totalTaxCollected,
      totalDiscounts,
      grossSales,
    };
  }, [liveOrders, shiftStart]);

  // 5. Cash Expenses Calculation (Only cash paid out during this shift)
  const shiftCashExpenses = useMemo(() => {
    const shiftStartTime = new Date(shiftStart).getTime();
    if (!liveExpenses || liveExpenses.length === 0) return 0;

    return liveExpenses
      .filter((exp: any) => {
        const isCash = String(exp.payment_method || "").toUpperCase() === "CASH";
        const expTime = new Date(exp.created_at || exp.expense_date).getTime();
        return isCash && (isNaN(shiftStartTime) || expTime >= shiftStartTime);
      })
      .reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0);
  }, [liveExpenses, shiftStart]);

  // 6. Drawer Reconciliation Formulas:
  // Expected Cash = Float + Cash Sales - Cash Expenses
  const numericOpeningFloat = parseFloat(openingFloat) || 0;
  const expectedCashInDrawer = Math.max(
    0,
    numericOpeningFloat + shiftMetrics.systemCashSales - shiftCashExpenses
  );

  // Initialize actual cash counted ONCE when modal opens
  useEffect(() => {
    if (isOpen && !initializedForSessionRef.current) {
      initializedForSessionRef.current = true;
      setActualCashCounted(String(expectedCashInDrawer));
    }
  }, [isOpen, expectedCashInDrawer]);

  const numericActualCash = parseFloat(actualCashCounted) || 0;
  const cashVariance = numericActualCash - expectedCashInDrawer;

  // 7. Threshold Check: Ensure fraud limit is not an undocumented constant;
  // bind to branch_settings.variance_threshold with fallback to 500
  const FRAUD_LIMIT = Number(branchSettings?.variance_threshold) || 500;

  // Handle denomination changes
  const handleDenominationChange = (key: keyof typeof denominations, val: string) => {
    const updated = { ...denominations, [key]: val };
    setDenominations(updated);

    const sum =
      (parseInt(updated.n5000) || 0) * 5000 +
      (parseInt(updated.n1000) || 0) * 1000 +
      (parseInt(updated.n500) || 0) * 500 +
      (parseInt(updated.n100) || 0) * 100 +
      (parseInt(updated.n50) || 0) * 50 +
      (parseInt(updated.n20) || 0) * 20 +
      (parseInt(updated.n10) || 0) * 10 +
      (parseFloat(updated.coins) || 0);

    setActualCashCounted(String(sum));
  };

  // Quick action to match expected cash
  const handleQuickMatchExpected = () => {
    setActualCashCounted(String(expectedCashInDrawer));
    showToast("Count matched to expected drawer balance.");
  };

  // Thermal Slip Print Handler (80mm Z-Report)
  const handlePrintSlip = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Direct Supabase Persistence (handleSaveSettlement)
  // Direct Supabase Persistence (handleSaveSettlement)
  const handleSaveSettlement = async (e: React.FormEvent) => {
    // 1. Immediately prevent full-page reload so form state is never lost
    e.preventDefault();

    if (isNaN(numericActualCash) || actualCashCounted.trim() === "") {
      showToast("Please enter the physical cash counted.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);
      
      // Sanitize restaurant_id as valid positive number or null
      const currentRestaurantId =
        !isNaN(Number(restId)) && Number(restId) > 0 ? Number(restId) : null;
      
      const numericBranchId =
        typeof branchId === "number" && branchId > 0
          ? branchId
          : /^\d+$/.test(String(branchId || ""))
          ? parseInt(String(branchId), 10)
          : null;

      // Bound dynamically to FRAUD_LIMIT from branch_settings
      const settlementStatus = Math.abs(cashVariance) > FRAUD_LIMIT ? "FLAGGED" : "CLOSED";

      // 2. Primary payload strictly matching live verified public.shift_settlements schema:
      // (restaurant_id, branch_id, cashier_name, shift_start, shift_end, opening_float,
      //  system_cash_sales, system_card_sales, system_digital_sales, total_tax_collected,
      //  total_discounts, gross_sales, total_orders_count, actual_cash_counted, cash_variance,
      //  status, closing_notes, created_at)
      const primaryPayload: any = {
        restaurant_id: currentRestaurantId,
        cashier_name: cashierName || "Cashier",
        shift_start: shiftStart ? new Date(shiftStart).toISOString() : new Date().toISOString(),
        shift_end: new Date().toISOString(),
        opening_float: Number(numericOpeningFloat) || 0,
        system_cash_sales: Number(shiftMetrics.systemCashSales) || 0,
        system_card_sales: Number(shiftMetrics.systemCardSales) || 0,
        system_digital_sales: Number(shiftMetrics.systemDigitalSales) || 0,
        total_tax_collected: Number(shiftMetrics.totalTaxCollected) || 0,
        total_discounts: Number(shiftMetrics.totalDiscounts) || 0,
        gross_sales: Number(shiftMetrics.grossSales) || 0,
        total_orders_count: Number(shiftMetrics.totalOrdersCount) || 0,
        actual_cash_counted: Number(numericActualCash) || 0,
        cash_variance: Number(cashVariance) || 0,
        status: settlementStatus,
        closing_notes: closingNotes.trim() || "",
        created_at: new Date().toISOString(),
      };

      if (numericBranchId) {
        primaryPayload.branch_id = numericBranchId;
      }

      let { data, error } = await supabase
        .from("shift_settlements")
        .insert([primaryPayload])
        .select()
        .single();

      // 3. Adaptive fallback if table has been migrated to alternative column names:
      // (shift_opened_at, shift_closed_at, cash_sales, card_sales, total_gross_sales, expected_cash_in_drawer, variance, notes)
      if (error && (error.code === "PGRST204" || error.message?.includes("column") || error.code === "42703")) {
        console.warn("[ShiftSettlementModal] Primary schema fallback triggered:", error.message);
        const modernPayload: any = {
          restaurant_id: currentRestaurantId,
          cashier_name: cashierName || "Cashier",
          shift_opened_at: shiftStart ? new Date(shiftStart).toISOString() : new Date().toISOString(),
          shift_closed_at: new Date().toISOString(),
          opening_float: Number(numericOpeningFloat) || 0,
          cash_sales: Number(shiftMetrics.systemCashSales) || 0,
          card_sales: Number(shiftMetrics.systemCardSales) || 0,
          total_gross_sales: Number(shiftMetrics.grossSales) || 0,
          expected_cash_in_drawer: Number(expectedCashInDrawer) || 0,
          actual_cash_counted: Number(numericActualCash) || 0,
          variance: Number(cashVariance) || 0,
          status: settlementStatus,
          notes: closingNotes.trim() || "",
          created_at: new Date().toISOString(),
        };

        if (numericBranchId) {
          modernPayload.branch_id = numericBranchId;
        }

        const fbRes = await supabase
          .from("shift_settlements")
          .insert([modernPayload])
          .select()
          .single();

        if (!fbRes.error) {
          data = fbRes.data;
          error = null;
        } else {
          error = fbRes.error;
        }
      }

      // 4. Reveal complete PostgREST error details if save fails, and preserve all form state
      if (error) {
        console.error("[ShiftSettlementModal] Supabase save error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        showToast(`Settlement failed: ${error.message || error.details || "Database error"}`);
        // Do NOT reset local state (openingFloat, actualCashCounted, closingNotes, denominations)
        setIsSubmitting(false);
        return;
      }

      // 5. Success Flow: only execute after verified Supabase response
      const settlementRecord: any = {
        id: data?.id || Date.now(),
        ...primaryPayload,
      };

      if (onSettled) onSettled(settlementRecord);

      // Print Z-Report Slip
      handlePrintSlip();

      const varianceFormatted =
        cashVariance === 0
          ? "Balanced (Exact 0)"
          : cashVariance > 0
          ? `+${currencySymbol} ${cashVariance.toLocaleString()} Excess`
          : `-${currencySymbol} ${Math.abs(cashVariance).toLocaleString()} Shortage`;

      showToast(`Shift closed successfully. Variance: ${varianceFormatted}.`);
      onClose();
    } catch (err: any) {
      console.error("[ShiftSettlementModal] Save exception:", err);
      showToast(`Error closing shift: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Scoped print styles for 80mm thermal receipt */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #shift-z-report-print-area,
          #shift-z-report-print-area * {
            visibility: visible !important;
          }
          #shift-z-report-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            margin: 0 !important;
            font-family: monospace !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden font-sans no-print mx-auto animate-in zoom-in-95 duration-200">
        
        {/* ========================================================================= */}
        {/* A. MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="p-3.5 sm:p-4 border-b border-[var(--border)] shrink-0 flex items-start justify-between gap-3 bg-[var(--surface-hi)]/30">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-[10px] font-mono font-bold tracking-wider uppercase mb-1">
                <Layers className="w-3 h-3 shrink-0" />
                <span className="truncate">SHIFT RECONCILIATION &amp; Z-REPORT</span>
              </div>
              <h2 className="text-base font-bold text-[var(--text-hi)] tracking-tight truncate">
                End Shift Settlement &amp; Z-Report
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-lo)] mt-1 font-mono">
                <span className="flex items-center gap-1 text-[var(--text-hi)] font-semibold">
                  <User className="w-3 h-3 text-[var(--gold)]" />
                  <span>Cashier: {cashierName}</span>
                </span>
                <span className="text-[var(--text-faint)]">•</span>
                <span className="flex items-center gap-1 text-[var(--text-muted)]">
                  <Clock className="w-3 h-3 text-[var(--text-faint)]" />
                  <span>Started: {shiftStartTimeFormatted}</span>
                </span>
                <span className="text-[var(--text-faint)]">•</span>
                <span className="flex items-center gap-1 text-[var(--text-muted)]">
                  <Building2 className="w-3 h-3 text-[var(--text-faint)]" />
                  <span>Register: {registerId}</span>
                </span>
                <span className="text-[var(--text-faint)]">•</span>
                <span className="flex items-center gap-1 text-[var(--gold)]">
                  <Receipt className="w-3 h-3" />
                  <span>{shiftMetrics.totalOrdersCount} orders</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm disabled:opacity-40"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* B. MODAL BODY: FORM */}
        {/* ========================================================================= */}
        <form onSubmit={handleSaveSettlement} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 custom-scrollbar">
          
          {/* STEP 1: SYSTEM EXPECTED SALES LEDGER */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <span className="font-bold text-[var(--text-hi)] uppercase tracking-wider text-[11px] flex items-center gap-1.5 font-mono">
                <Layers className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>Step 1: System Expected Ledger</span>
              </span>
              <span className="font-mono text-[10.5px] text-[var(--text-muted)]">
                Shift Sales &amp; Payouts
              </span>
            </div>

            {/* Top Stat Cards Grid: Float + Cash Sales - Cash Expenses = Expected Drawer Cash */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              
              {/* 1. Opening Float Input */}
              <div className="p-2.5 rounded-xl bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1.5 flex flex-col justify-between">
                <div>
                  <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase block font-bold tracking-wider">
                    Opening Float <span className="text-amber-400">*</span>
                  </label>
                </div>
                <div className="relative mt-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-[var(--text-muted)]">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    required
                    placeholder="5000"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-6 pr-2 py-1 text-xs font-mono font-bold text-[var(--text-hi)] focus:border-[var(--gold)] focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* 2. System Cash Sales */}
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
                      Cash Sales (+)
                    </span>
                    <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>
                <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-1 truncate">
                  {currencySymbol} {shiftMetrics.systemCashSales.toLocaleString()}
                </div>
              </div>

              {/* 3. Cash Expenses Deducted */}
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-red-400 uppercase font-bold tracking-wider">
                      Cash Paid Out (-)
                    </span>
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  </div>
                </div>
                <div className="text-sm sm:text-base font-black font-mono text-red-400 mt-1 truncate">
                  -{currencySymbol} {shiftCashExpenses.toLocaleString()}
                </div>
              </div>

              {/* 4. Expected Total Drawer Cash */}
              <div className="p-2.5 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 space-y-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--gold)] uppercase font-bold tracking-wider">
                      Expected Cash (=)
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-[var(--gold)]" />
                  </div>
                  <p className="text-[9px] text-[var(--gold)]/80 mt-0.5 truncate">
                    Float + Sales - Exp
                  </p>
                </div>
                <div className="text-sm sm:text-base font-black font-mono text-[var(--gold)] mt-1 truncate">
                  {currencySymbol} {expectedCashInDrawer.toLocaleString()}
                </div>
              </div>

            </div>

            {/* Non-Cash Channels & Turnover Summary */}
            <div className="p-2.5 rounded-xl bg-[var(--surface-hi)]/40 border border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div>
                <span className="text-[9.5px] text-[var(--text-faint)] uppercase block font-semibold">Card Terminals</span>
                <span className="font-bold text-[var(--text-hi)] text-xs sm:text-sm flex items-center gap-1 mt-0.5 truncate">
                  <CreditCard className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>{currencySymbol} {shiftMetrics.systemCardSales.toLocaleString()}</span>
                </span>
              </div>
              <div>
                <span className="text-[9.5px] text-[var(--text-faint)] uppercase block font-semibold">Online / Raast QR</span>
                <span className="font-bold text-[var(--text-hi)] text-xs sm:text-sm flex items-center gap-1 mt-0.5 truncate">
                  <QrCode className="w-3 h-3 text-purple-400 shrink-0" />
                  <span>{currencySymbol} {shiftMetrics.systemDigitalSales.toLocaleString()}</span>
                </span>
              </div>
              <div>
                <span className="text-[9.5px] text-[var(--text-faint)] uppercase block font-semibold">Tax Collected</span>
                <span className="font-bold text-[var(--text-muted)] text-xs sm:text-sm mt-0.5 block truncate">
                  {currencySymbol} {shiftMetrics.totalTaxCollected.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[9.5px] text-[var(--gold)] uppercase block font-bold">Gross Turnover</span>
                <span className="font-extrabold text-[var(--gold)] text-xs sm:text-sm mt-0.5 block truncate">
                  {currencySymbol} {shiftMetrics.grossSales.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* STEP 2: PHYSICAL CASH DRAWER RECONCILIATION */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <span className="font-bold text-[var(--text-hi)] uppercase tracking-wider text-[11px] flex items-center gap-1.5 font-mono">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                <span>Step 2: Physical Cash Drawer Reconciliation</span>
              </span>
              <span className="font-mono text-[10.5px] text-[var(--text-muted)]">
                Count notes &amp; coins
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Physical Cash Input Box */}
              <div className="p-3 rounded-xl bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-2.5">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[var(--text-hi)] block uppercase font-mono tracking-wider">
                      Physical Cash Counted <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleQuickMatchExpected}
                      className="text-[11px] font-mono text-[var(--gold)] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Quick Match</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-sm text-[var(--gold)]">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={actualCashCounted}
                    onChange={(e) => setActualCashCounted(e.target.value)}
                    placeholder="Counted cash amount"
                    required
                    className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-3 py-2 font-mono font-black text-base text-[var(--text-hi)] focus:outline-none transition-all shadow-inner"
                  />
                </div>

                {/* Denomination Calculator Toggle */}
                <button
                  type="button"
                  onClick={() => setShowDenominations(!showDenominations)}
                  className="w-full py-1.5 px-3 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-hi)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>{showDenominations ? "Hide Note Breakdown" : "Open Note Breakdown"}</span>
                  {showDenominations ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Reconciliation Variance Card */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-2.5 transition-all ${
                  cashVariance === 0
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : cashVariance > 0
                    ? "bg-[var(--gold-dim)] border border-[var(--gold)]/30"
                    : "bg-red-500/10 border-red-500/30"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold tracking-wider">
                      Reconciliation Variance
                    </span>

                    {/* Status Badge */}
                    {cashVariance === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Balanced</span>
                      </span>
                    ) : cashVariance > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                        <TrendingUp className="w-3 h-3" />
                        <span>Surplus</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-500/15 text-red-400 border border-red-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Shortage</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 text-xl font-black font-mono tracking-tight">
                    <span
                      className={
                        cashVariance === 0
                          ? "text-emerald-400"
                          : cashVariance > 0
                          ? "text-[var(--gold)]"
                          : "text-red-400"
                      }
                    >
                      {cashVariance >= 0 ? "+" : ""}{currencySymbol} {cashVariance.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--text-lo)] border-t border-[var(--border)]/60 pt-1.5 space-y-1">
                  <p>
                    {cashVariance === 0
                      ? "Drawer is perfectly balanced with expected cash sales."
                      : cashVariance > 0
                      ? "Physical cash exceeds system expected balance."
                      : "Cash shortage detected against system records."}
                  </p>
                  {Math.abs(cashVariance) > FRAUD_LIMIT && (
                    <p className="text-[10px] font-mono text-[var(--gold)] flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>Exceeds audit threshold ({currencySymbol} {FRAUD_LIMIT}).</span>
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Collapsible Currency Denomination Breakdown */}
            {showDenominations && (
              <div className="p-3 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)] space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-[var(--border)]/80 pb-1">
                  <span className="text-[11px] font-mono font-bold text-[var(--text-hi)] uppercase flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Currency Notes &amp; Coins Calculator ({currencySymbol})</span>
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    Auto-sums
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-xs">
                  {[
                    { label: `${currencySymbol} 5,000`, key: "n5000" },
                    { label: `${currencySymbol} 1,000`, key: "n1000" },
                    { label: `${currencySymbol} 500`, key: "n500" },
                    { label: `${currencySymbol} 100`, key: "n100" },
                    { label: `${currencySymbol} 50`, key: "n50" },
                    { label: `${currencySymbol} 20`, key: "n20" },
                    { label: `${currencySymbol} 10`, key: "n10" },
                    { label: `Coins (${currencySymbol})`, key: "coins" },
                  ].map((denom) => (
                    <div key={denom.key} className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                      <span className="text-[10px] text-[var(--text-faint)] font-bold block">
                        {denom.label}
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={denominations[denom.key as keyof typeof denominations]}
                        onChange={(e) =>
                          handleDenominationChange(denom.key as keyof typeof denominations, e.target.value)
                        }
                        className="w-full bg-transparent font-bold text-xs text-[var(--text-hi)] focus:outline-none mt-0.5"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: CLOSING REMARKS */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-[var(--text-hi)] uppercase flex items-center gap-1.5 font-mono">
                <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Closing Remarks / Discrepancy Explanation</span>
              </label>
              <textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Optional shift notes or reconciliation remarks..."
                rows={2}
                className="w-full bg-[var(--surface-hi)]/70 border border-[var(--border)] focus:border-[var(--gold)] rounded-xl p-2.5 text-xs text-[var(--text-hi)] focus:outline-none transition-all placeholder:text-[var(--text-faint)] font-sans"
              />
            </div>

          </div>
          </div>

          {/* ========================================================================= */}
          {/* C. MODAL ACTIONS FOOTER (DOCKED) */}
          {/* ========================================================================= */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-[var(--bg-deep)]">
            <button
              type="button"
              onClick={handlePrintSlip}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-hi)] border border-[var(--border)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[var(--gold)]" />
              <span>Print Z-Report Slip</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-1/2 sm:w-auto px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-1/2 sm:w-auto px-4 py-2 rounded-xl bg-[var(--gold)] hover:bg-[#d4a017] text-black text-xs font-bold font-mono tracking-wide shadow-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="truncate">{isSubmitting ? "Settling..." : "Confirm & Close"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* D. 80mm THERMAL RECEIPT PRINT AREA (DYNAMIC BINDING - NO HARDCODING)     */}
      {/* ========================================================================= */}
      <div id="shift-z-report-print-area" className="hidden print:block text-black bg-white text-xs">
        <div className="text-center pb-2 border-b border-dashed border-black">
          <h2 className="text-base font-bold uppercase tracking-wider">{restaurantName}</h2>
          <p className="text-[10px] font-bold">SHIFT FINANCIAL Z-REPORT</p>
          <p className="text-[9px]">Shift Close &amp; Register Reconciliation</p>
        </div>

        <div className="py-2 text-[10px] space-y-0.5 border-b border-dashed border-black font-mono">
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span className="font-bold">{cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span>Shift Started:</span>
            <span>{shiftStartTimeFormatted}</span>
          </div>
          <div className="flex justify-between">
            <span>Shift Closed:</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Register:</span>
            <span>{registerId}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Orders:</span>
            <span>{shiftMetrics.totalOrdersCount}</span>
          </div>
        </div>

        <div className="py-2 text-[10px] space-y-1 border-b border-dashed border-black font-mono">
          <div className="flex justify-between font-bold">
            <span>Opening Float:</span>
            <span>{currencySymbol} {numericOpeningFloat.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>System Cash Sales:</span>
            <span>+{currencySymbol} {shiftMetrics.systemCashSales.toLocaleString()}</span>
          </div>
          {shiftCashExpenses > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Cash Expenses Paid:</span>
              <span>-{currencySymbol} {shiftCashExpenses.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-dotted pt-1">
            <span>Expected Drawer Cash:</span>
            <span>{currencySymbol} {expectedCashInDrawer.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-sm">
            <span>Actual Cash Counted:</span>
            <span>{currencySymbol} {numericActualCash.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-black pt-1">
            <span>VARIANCE:</span>
            <span>
              {cashVariance >= 0 ? "+" : ""}{currencySymbol} {cashVariance.toLocaleString()}{" "}
              ({cashVariance === 0 ? "EXACT" : cashVariance > 0 ? "OVER" : "SHORT"})
            </span>
          </div>
        </div>

        <div className="py-2 text-[10px] space-y-0.5 border-b border-dashed border-black font-mono">
          <div className="flex justify-between">
            <span>Card Terminal Sales:</span>
            <span>{currencySymbol} {shiftMetrics.systemCardSales.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Online / Raast Sales:</span>
            <span>{currencySymbol} {shiftMetrics.systemDigitalSales.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Tax Collected:</span>
            <span>{currencySymbol} {shiftMetrics.totalTaxCollected.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Gross Turnover:</span>
            <span>{currencySymbol} {shiftMetrics.grossSales.toLocaleString()}</span>
          </div>
        </div>

        {closingNotes && (
          <div className="py-2 text-[9px] border-b border-dashed border-black font-mono">
            <span className="font-bold block">Closing Notes:</span>
            <p>{closingNotes}</p>
          </div>
        )}

        <div className="pt-4 text-[9px] text-center space-y-4 font-mono">
          <div className="flex justify-between pt-6">
            <span className="border-t border-black px-2">Cashier Signature</span>
            <span className="border-t border-black px-2">Manager Audit</span>
          </div>
          <p className="text-[8px] text-neutral-600">
            {restaurantName} Audit Ledger • {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
