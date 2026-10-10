"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  CreditCard,
  QrCode,
  Clock,
  User,
  Building2,
  FileText,
  Layers,
  TrendingUp,
  Calculator,
  RefreshCw,
  Sparkles,
  Receipt,
  ChevronDown,
  ChevronUp,
  TrendingDown,
} from "lucide-react";
import { OrderRecord } from "@/app/admin/types";
import { useAuth } from "@/app/admin/context/AuthContext";
import { getActiveUserSession, sanitizeUserSession } from "@/lib/tenantStore";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import PosSidebar from "../components/PosSidebar";
import {
  validateCashierShiftWindow,
  ShiftWindowValidation,
  evaluateActiveShiftDetails,
  getCurrentOperatingShift,
  ShiftTypeOption,
  isShiftWindowConcluded,
} from "@/lib/shiftSchedule";
import { dispatchShiftSettlementAlert } from "@/lib/shiftAuditNotifications";

export default function ZReportClient() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Active Session Context - guarantees immediate availability even before hydration
  const activeSessionUser = useMemo(() => {
    return sanitizeUserSession(getActiveUserSession()) || user;
  }, [user]);

  // Strict Shift Window Lockout for Cashiers
  const isCashier = Boolean(
    (user && (user.staffRole === "cashier" || (user.role as string) === "cashier" || user.terminalAccess === "POS_ONLY")) ||
    (activeSessionUser && (activeSessionUser.staffRole === "cashier" || (activeSessionUser.role as string) === "cashier" || activeSessionUser.terminalAccess === "POS_ONLY"))
  );

  // Active Shift & Reconciliation States (Recovered from active session storage)
  const [activeShiftRecord, setActiveShiftRecord] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const uId = user?.id || activeSessionUser?.id;
        const uName = (user?.name || activeSessionUser?.name || "").toLowerCase();

        // 1. Try finding a shift specifically matching current authenticated user
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith("pos_active_shift_")) {
            const raw = sessionStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && (parsed.status === "OPEN" || parsed.status === "active")) {
                if (
                  (uId && String(parsed.cashier_id) === String(uId)) ||
                  (uName && parsed.cashier_name && String(parsed.cashier_name).toLowerCase().includes(uName))
                ) {
                  return parsed;
                }
              }
            }
          }
        }
        // 2. Generic fallback if only 1 open shift in session
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith("pos_active_shift_")) {
            const raw = sessionStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && (parsed.status === "OPEN" || parsed.status === "active")) {
                return parsed;
              }
            }
          }
        }
      } catch { }
    }
    return null;
  });

  const [shiftValidation, setShiftValidation] = useState<ShiftWindowValidation | null>(() => {
    const shift = activeShiftRecord?.shift_type || user?.assignedShift || activeSessionUser?.assignedShift;
    if (!shift) return null;
    return validateCashierShiftWindow(shift, new Date(), activeShiftRecord);
  });

  useEffect(() => {
    const shift = activeShiftRecord?.shift_type || user?.assignedShift || activeSessionUser?.assignedShift;
    if (!shift || !isCashier) {
      setShiftValidation(null);
      return;
    }
    const verify = () => {
      setShiftValidation(validateCashierShiftWindow(shift, new Date(), activeShiftRecord));
    };
    verify();
    const timer = setInterval(verify, 10000);
    return () => clearInterval(timer);
  }, [user, activeSessionUser, isCashier, activeShiftRecord]);

  // Dynamic Session & Cashier Identity (Strictly binds to authenticated context e.g. 'Bilal')
  const cashierName = useMemo(() => {
    const uName = user?.name?.trim();
    if (uName && uName.toLowerCase() !== "user" && uName.toLowerCase() !== "terminal cashier") {
      return uName;
    }
    const sName = activeSessionUser?.name?.trim();
    if (sName && sName.toLowerCase() !== "user" && sName.toLowerCase() !== "terminal cashier") {
      return sName;
    }
    const rawEmail = user?.email || activeSessionUser?.email;
    if (rawEmail && rawEmail.includes("@")) {
      const prefix = rawEmail.split("@")[0].replace(/[._-]/g, " ").trim();
      if (prefix) {
        return prefix
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      }
    }
    const rName = activeShiftRecord?.cashier_name?.trim();
    if (rName && rName.toLowerCase() !== "cashier" && rName.toLowerCase() !== "terminal cashier") {
      return rName;
    }
    return user?.name || "Bilal";
  }, [user, activeSessionUser, activeShiftRecord]);

  // Dynamically evaluate active shift details based on user's assigned shift, shift record, and current time
  const activeShiftDetails = useMemo(() => {
    return evaluateActiveShiftDetails(
      user?.assignedShift || activeSessionUser?.assignedShift,
      activeShiftRecord,
      new Date()
    );
  }, [user?.assignedShift, activeSessionUser?.assignedShift, activeShiftRecord]);

  const [shiftType, setShiftType] = useState<string>(() => activeShiftDetails.shiftType);

  useEffect(() => {
    if (activeShiftDetails.shiftType) {
      setShiftType(activeShiftDetails.shiftType);
    }
  }, [activeShiftDetails.shiftType]);

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

  const shiftStartTimeFormatted = useMemo(() => {
    try {
      return new Date(shiftStart).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Earlier Today";
    }
  }, [shiftStart]);

  const hasOpenActiveShift = Boolean(
    activeShiftRecord &&
    (activeShiftRecord.status === "OPEN" ||
      activeShiftRecord.status === "active" ||
      (!activeShiftRecord.status && !activeShiftRecord.closed_at))
  );

  // Cashiers with an active open shift are granted Grace Period to complete their physical cash audit
  const isShiftLocked = Boolean(isShiftWindowConcluded(shiftValidation, activeShiftRecord) && !hasOpenActiveShift);
  const [openingFloat, setOpeningFloat] = useState<string>("");
  const [actualCashCounted, setActualCashCounted] = useState<string>("");
  const [closingNotes, setClosingNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [liveOrders, setLiveOrders] = useState<OrderRecord[]>([]);
  const [liveExpenses, setLiveExpenses] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const initializedForSessionRef = useRef<boolean>(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3500);
  };

  // Dynamic Labels from Session / Settings
  const restaurantName =
    user?.restaurantName || branchSettings?.restaurant_name || "Restaurant Terminal";
  const currencySymbol = branchSettings?.currency_symbol || "Rs";
  const registerId = user?.branchName ? `${user.branchName} • Register #01` : "Register #01";

  // 1. Fetch live settings & active open shift (or last closed shift) to establish accurate current shift start & float
  useEffect(() => {
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

        // B. Fetch Current Active Open Shift (prioritizing current cashier session):
        let openShift: any = null;
        const currentCashier = user?.name || activeSessionUser?.name;
        if (currentCashier && currentCashier.toLowerCase() !== "user") {
          const { data: userShift } = await supabase
            .from("shift_settlements")
            .select("*")
            .eq("restaurant_id", restId)
            .eq("status", "OPEN")
            .ilike("cashier_name", `%${currentCashier}%`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (userShift) openShift = userShift;
        }

        if (!openShift) {
          const { data: generalShift } = await supabase
            .from("shift_settlements")
            .select("*")
            .eq("restaurant_id", restId)
            .eq("status", "OPEN")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (generalShift) openShift = generalShift;
        }

        if (openShift && isMounted) {
          setActiveShiftRecord(openShift);
          if (openShift.opening_float !== undefined && openShift.opening_float !== null) {
            setOpeningFloat(String(openShift.opening_float));
          }
          if (openShift.shift_start || openShift.created_at) {
            setShiftStart(openShift.shift_start || openShift.created_at);
          }
          if (openShift.shift_type) {
            setShiftType(openShift.shift_type);
          } else if (openShift.closing_notes?.includes("Shift:")) {
            const extracted = openShift.closing_notes.split("|")[0].replace("Shift:", "").trim();
            setShiftType(extracted);
          }
        } else {
          // Fallback: Fetch Last Settled Shift if no open shift was found
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
            if (shiftData[0].opening_float !== undefined && shiftData[0].opening_float !== null) {
              setOpeningFloat(String(shiftData[0].opening_float));
            }
          } else if (isMounted) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            setShiftStart(todayStart.toISOString());
          }
        }
      } catch (e) {
        console.warn("[ZReportClient] Shift init warning:", e);
        if (isMounted) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          setShiftStart(todayStart.toISOString());
        }
      }
    };

    fetchShiftPrerequisites();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // 2. Fetch live shift orders strictly from Supabase public.orders
  useEffect(() => {
    let isMounted = true;

    const loadShiftOrders = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restId)
          .eq("payment_status", "paid")
          .neq("order_status", "cancelled")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("[ZReportClient] Orders query fallback:", error.message);
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
        console.error("[ZReportClient] Live order fetch error:", err);
      }
    };

    loadShiftOrders();
    return () => {
      isMounted = false;
    };
  }, [user, cashierName]);

  // 3. Cash Expenses Deduction: Fetch public.operating_expenses (paid via CASH during this shift window)
  useEffect(() => {
    let isMounted = true;

    const loadShiftExpenses = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        const { data, error } = await supabase
          .from("operating_expenses")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false });

        if (!error && data && isMounted) {
          setLiveExpenses(data);
        }
      } catch (err) {
        console.warn("[ZReportClient] Expense fetch info:", err);
      }
    };

    loadShiftExpenses();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // 4. Dynamic Shift Aggregation (Calculates strictly for this shift)
  const shiftMetrics = useMemo(() => {
    const shiftStartTime = new Date(shiftStart).getTime();

    // Filter to orders placed during this shift window
    const shiftOrders = liveOrders.filter((o) => {
      const orderTime = new Date(o.timestamp).getTime();
      if (isNaN(orderTime)) return false;
      return isNaN(shiftStartTime) ? false : orderTime >= shiftStartTime;
    });

    const targetOrders = shiftOrders;

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

  const numericActualCash = parseFloat(actualCashCounted) || 0;
  const cashVariance = numericActualCash - expectedCashInDrawer;

  // 7. Threshold Check: Bind to branch_settings.variance_threshold with fallback to 500
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
  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isNaN(numericActualCash) || actualCashCounted.trim() === "") {
      showToast("Please enter the physical cash counted.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);

      const currentRestaurantId =
        !isNaN(Number(restId)) && Number(restId) > 0 ? Number(restId) : null;

      const numericBranchId =
        typeof branchId === "number" && branchId > 0
          ? branchId
          : /^\d+$/.test(String(branchId || ""))
            ? parseInt(String(branchId), 10)
            : null;

      const settlementStatus = "CLOSED";
      const notesWithAudit = Math.abs(cashVariance) > FRAUD_LIMIT
        ? `[FLAGGED AUDIT: Variance ${cashVariance > 0 ? "+" : ""}${currencySymbol} ${cashVariance.toLocaleString()}] ${closingNotes.trim()}`.trim()
        : closingNotes.trim();

      const primaryPayload: any = {
        restaurant_id: currentRestaurantId,
        cashier_name: cashierName,
        shift_type: shiftType,
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
        cash_handover_to_next_shift: Number(numericActualCash) || 0,
        cash_variance: Number(cashVariance) || 0,
        status: settlementStatus,
        closing_notes: notesWithAudit,
        created_at: new Date().toISOString(),
        closed_at: new Date().toISOString(),
      };

      if (numericBranchId) {
        primaryPayload.branch_id = numericBranchId;
      }

      let saveError: any = null;

      if (activeShiftRecord?.id) {
        const updatePayload: any = {
          cashier_name: cashierName,
          shift_type: shiftType,
          shift_end: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          opening_float: Number(numericOpeningFloat) || 0,
          system_cash_sales: Number(shiftMetrics.systemCashSales) || 0,
          system_card_sales: Number(shiftMetrics.systemCardSales) || 0,
          system_digital_sales: Number(shiftMetrics.systemDigitalSales) || 0,
          total_tax_collected: Number(shiftMetrics.totalTaxCollected) || 0,
          total_discounts: Number(shiftMetrics.totalDiscounts) || 0,
          gross_sales: Number(shiftMetrics.grossSales) || 0,
          total_orders_count: Number(shiftMetrics.totalOrdersCount) || 0,
          actual_cash_counted: Number(numericActualCash) || 0,
          cash_handover_to_next_shift: Number(numericActualCash) || 0,
          cash_variance: Number(cashVariance) || 0,
          status: settlementStatus,
          closing_notes: (notesWithAudit ? `${notesWithAudit} | ` : "") + (activeShiftRecord.closing_notes || ""),
        };

        const { error: updErr } = await supabase
          .from("shift_settlements")
          .update(updatePayload)
          .eq("id", activeShiftRecord.id);

        if (updErr) {
          console.warn("[ZReportClient] Update active shift failed, attempting insert fallback:", updErr.message);
          const { error: insErr } = await supabase.from("shift_settlements").insert([primaryPayload]);
          saveError = insErr;
        }
      } else {
        const { error: insErr } = await supabase.from("shift_settlements").insert([primaryPayload]);
        saveError = insErr;
      }

      if (saveError) {
        console.error("[ZReportClient] Supabase save error:", saveError);
        showToast(`Settlement failed: ${saveError.message || "Database error"}`);
        setIsSubmitting(false);
        return;
      }

      // Print Z-Report Slip to thermal printer
      try {
        handlePrintSlip();
      } catch (printErr) {
        console.warn("[ZReportClient] Print exception:", printErr);
      }

      // Clear active shift and cached order data from storage
      try {
        sessionStorage.clear();
        localStorage.removeItem(`pos_active_shift_${restId}`);
        localStorage.removeItem(`omni_terminal_parked_orders_${restId}`);
        localStorage.removeItem(`omni_orders_${restId}`);
      } catch { }

      const varianceFormatted =
        cashVariance === 0
          ? "Balanced (Exact 0)"
          : cashVariance > 0
            ? `+${currencySymbol} ${cashVariance.toLocaleString()} Excess`
            : `-${currencySymbol} ${Math.abs(cashVariance).toLocaleString()} Shortage`;

      // Dispatch Automated Z-Report & Financial Audit Alert to Admin
      dispatchShiftSettlementAlert(String(restId || "default"), {
        cashierName: cashierName,
        shiftType: shiftType,
        grossSales: Number(shiftMetrics.grossSales) || 0,
        actualCash: Number(numericActualCash) || 0,
        expectedCash: Number(expectedCashInDrawer) || 0,
        cashVariance: Number(cashVariance) || 0,
        branchName: user?.branchName || "Main Counter",
        threshold: FRAUD_LIMIT,
      });

      showToast(`Shift closed & handover saved (${currencySymbol} ${numericActualCash.toLocaleString()}). Redirecting to login...`);

      // Clean direct exit: force session destruction and redirect to /login without redundant secondary popup
      setTimeout(async () => {
        try {
          await logout();
        } catch {}
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }, 500);
    } catch (err: any) {
      console.error("[ZReportClient] Save exception:", err);
      showToast(`Error closing shift: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex-1 w-full flex h-full min-h-0 relative overflow-hidden bg-[var(--bg)] text-[var(--text-hi)] font-sans select-none transition-colors duration-150">
      {/* Sleek Dedicated POS Left Sidebar */}
      <PosSidebar currentView="z-report" activeShift={activeShiftRecord} />

      {/* Z-Report Workspace Area */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto pb-24 lg:pb-12">
        {/* ========================================================================= */}
        {/* 80mm THERMAL RECEIPT PRINT STYLES                                         */}
        {/* ========================================================================= */}
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

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-[var(--bg-deep)] border border-[var(--gold)]/40 text-[var(--gold)] font-mono text-xs shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
            <CheckCircle2 className="w-4 h-4 text-[var(--gold)] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Container */}
        <main className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 md:px-8 py-6 space-y-6">
          {/* Top Page Title & Print Slip Action (Directly on Page - No Bar Background or Back Button) */}
          <div className="flex items-center justify-between gap-3 pt-1 pb-1">
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-[var(--text-hi)] tracking-tight truncate">
                Z-Report &amp; Settlement
              </h1>
            </div>

            <button
              type="button"
              onClick={handlePrintSlip}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 text-[var(--text-hi)] border border-[var(--border)] font-semibold text-xs transition-colors cursor-pointer active:scale-95 shadow-xs shrink-0"
              title="Print Z-Report Slip"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
              <span>Print Slip</span>
            </button>
          </div>
          {/* Banner Details Card */}
          <div className="p-3.5 sm:p-5 rounded-2xl glass-panel border border-[var(--border)] shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-lg font-bold text-[var(--text-hi)] tracking-tight truncate">
                  Active Shift Settlement
                </h2>
                <p className="text-[11px] text-[var(--text-lo)] font-mono truncate">
                  Review register totals and verify cash drawer float
                </p>
              </div>
            </div>

            {/* Clean, readable metadata badges */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2 border-t border-[var(--border)] text-[11px] font-mono">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-hi)] font-semibold">
                <User className="w-3 h-3 text-[var(--gold)]" />
                <span>{cashierName}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-bold">
                <Sparkles className="w-3 h-3" />
                <span>{shiftType}</span>
                <span className="text-[10px] text-[var(--gold)]/80 font-normal font-mono">({activeShiftDetails.windowLabel})</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)]">
                <Clock className="w-3 h-3 text-[var(--text-faint)]" />
                <span>Started {shiftStartTimeFormatted}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)]">
                <Building2 className="w-3 h-3 text-[var(--text-faint)]" />
                <span>{registerId}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-bold ml-auto sm:ml-0">
                <Receipt className="w-3 h-3" />
                <span>{shiftMetrics.totalOrdersCount} orders</span>
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* B. MAIN FORM CONTAINER                                                    */}
          {/* ========================================================================= */}
          <form onSubmit={handleSaveSettlement} className="space-y-5">
            {/* STEP 1: SYSTEM EXPECTED SALES LEDGER */}
            <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-[var(--border)] shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <span className="font-bold text-[var(--text-hi)] uppercase tracking-wider text-xs flex items-center gap-1.5 font-mono">
                  <Layers className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Step 1: System Expected Ledger</span>
                </span>
                <span className="font-mono text-[11px] text-[var(--gold)]/80">
                  Shift Sales &amp; Payouts
                </span>
              </div>

              {/* Top Stat Cards Grid: Float + Cash Sales - Cash Expenses = Expected Drawer Cash */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Opening Float Input */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-1.5 flex flex-col justify-between shadow-xs">
                  <div>
                    <label className="text-[10px] font-mono text-amber-800 dark:text-[var(--gold)] uppercase block font-bold tracking-wider">
                      Opening Float <span className="text-amber-700 dark:text-[var(--gold)]">*</span>
                    </label>
                  </div>
                  <div className="relative mt-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-amber-800 dark:text-[var(--gold)]">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                      required
                      placeholder="0.00"
                      className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hi)]/50 focus:bg-[var(--surface-hi)]/80 border border-[var(--border)] rounded-lg pl-7 pr-2.5 py-2 text-xs font-mono font-bold text-[var(--text-hi)] focus:border-[var(--gold)] focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50"
                    />
                  </div>
                </div>

                {/* 2. System Cash Sales */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/[0.08] dark:bg-emerald-950/20 border border-emerald-600/25 dark:border-emerald-800/40 space-y-1 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-400 uppercase font-bold tracking-wider">
                        Cash Sales (+)
                      </span>
                      <Banknote className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    </div>
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1 truncate">
                    {currencySymbol} {shiftMetrics.systemCashSales.toLocaleString()}
                  </div>
                </div>

                {/* 3. Cash Expenses Deducted */}
                <div className="p-3.5 rounded-2xl bg-rose-500/[0.08] dark:bg-rose-950/20 border border-rose-600/25 dark:border-rose-800/40 space-y-1 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-rose-800 dark:text-rose-400 uppercase font-bold tracking-wider">
                        Cash Paid Out (-)
                      </span>
                      <TrendingDown className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
                    </div>
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-rose-700 dark:text-rose-400 mt-1 truncate">
                    -{currencySymbol} {shiftCashExpenses.toLocaleString()}
                  </div>
                </div>

                {/* 4. Expected Total Drawer Cash */}
                <div className="p-3.5 rounded-2xl bg-amber-500/[0.08] dark:bg-amber-950/20 border border-amber-600/25 dark:border-amber-800/40 space-y-1 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-800 dark:text-[var(--gold)] uppercase font-bold tracking-wider">
                        Expected Cash (=)
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-[var(--gold)]" />
                    </div>
                    <p className="text-[9.5px] text-amber-800/80 dark:text-[var(--gold)]/80 mt-0.5 truncate font-semibold">
                      Float + Sales - Exp
                    </p>
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-amber-800 dark:text-[var(--gold)] mt-1 truncate">
                    {currencySymbol} {expectedCashInDrawer.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Non-Cash Channels & Turnover Summary */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/50 dark:bg-[var(--surface-hi)]/40 border border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs shadow-xs">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] dark:text-[var(--text-faint)] uppercase block font-semibold">
                    Card Terminals
                  </span>
                  <span className="font-bold text-[var(--text-hi)] text-xs sm:text-sm flex items-center gap-1.5 mt-0.5 truncate">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{currencySymbol} {shiftMetrics.systemCardSales.toLocaleString()}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] dark:text-[var(--text-faint)] uppercase block font-semibold">
                    Online / Raast QR
                  </span>
                  <span className="font-bold text-[var(--text-hi)] text-xs sm:text-sm flex items-center gap-1.5 mt-0.5 truncate">
                    <QrCode className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400 shrink-0" />
                    <span>{currencySymbol} {shiftMetrics.systemDigitalSales.toLocaleString()}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] dark:text-[var(--text-faint)] uppercase block font-semibold">
                    Tax Collected
                  </span>
                  <span className="font-bold text-[var(--text-hi)] text-xs sm:text-sm mt-0.5 block truncate">
                    {currencySymbol} {shiftMetrics.totalTaxCollected.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800 dark:text-[var(--gold)] uppercase block font-bold">
                    Gross Turnover
                  </span>
                  <span className="font-extrabold text-amber-800 dark:text-[var(--gold)] text-xs sm:text-sm mt-0.5 block truncate">
                    {currencySymbol} {shiftMetrics.grossSales.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 2: PHYSICAL CASH DRAWER RECONCILIATION */}
            <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-[var(--border)] shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <span className="font-bold text-[var(--text-hi)] uppercase tracking-wider text-xs flex items-center gap-1.5 font-mono">
                  <Banknote className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>Step 2: Physical Cash Drawer Reconciliation</span>
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)] font-medium">
                  Count notes &amp; coins
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Physical Cash Input Box */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/60 dark:bg-[var(--surface-hi)]/70 border border-[var(--border)] space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-800 dark:text-[var(--gold)] block uppercase font-mono tracking-wider">
                      Physical Cash Counted <span className="text-rose-600 dark:text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleQuickMatchExpected}
                      className="text-xs font-mono text-amber-800 hover:text-amber-700 dark:text-[var(--gold)] dark:hover:text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Quick Match</span>
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-sm text-amber-800 dark:text-[var(--gold)]">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={actualCashCounted}
                      onChange={(e) => setActualCashCounted(e.target.value)}
                      placeholder="Counted cash amount"
                      required
                      className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hi)]/50 focus:bg-[var(--surface-hi)]/80 border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-3 py-2.5 font-mono font-black text-base text-[var(--text-hi)] focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50"
                    />
                  </div>

                  {/* Denomination Calculator Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowDenominations(!showDenominations)}
                    className="w-full py-2 px-3 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--text-hi)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Calculator className="w-3.5 h-3.5 text-amber-800 dark:text-[var(--gold)]" />
                    <span>{showDenominations ? "Hide Note Breakdown" : "Open Note Breakdown"}</span>
                    {showDenominations ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Reconciliation Variance Card */}
                <div
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-2.5 transition-all shadow-xs ${
                    cashVariance === 0
                      ? "bg-emerald-500/[0.08] dark:bg-emerald-950/20 border-emerald-600/25 dark:border-emerald-800/40"
                      : cashVariance > 0
                        ? "bg-amber-500/[0.08] dark:bg-amber-950/20 border-amber-600/25 dark:border-amber-800/40"
                        : "bg-rose-500/[0.08] dark:bg-rose-950/20 border-rose-600/25 dark:border-rose-800/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] dark:text-zinc-400 uppercase font-bold tracking-wider">
                        Reconciliation Variance
                      </span>

                      {/* Status Badge */}
                      {cashVariance === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-600/30 dark:border-emerald-800 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Balanced</span>
                        </span>
                      ) : cashVariance > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/15 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-600/30 dark:border-amber-800 shadow-xs">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Surplus</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/15 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-600/30 dark:border-rose-800 shadow-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Shortage</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-2xl font-black font-mono tracking-tight">
                      <span
                        className={
                          cashVariance === 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : cashVariance > 0
                              ? "text-amber-800 dark:text-amber-400"
                              : "text-rose-700 dark:text-rose-400"
                        }
                      >
                        {cashVariance >= 0 ? "+" : ""}
                        {currencySymbol} {cashVariance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs border-t border-[var(--border)] pt-2 space-y-1">
                    <p
                      className={
                        cashVariance === 0
                          ? "text-emerald-800 dark:text-emerald-300 font-medium"
                          : cashVariance > 0
                            ? "text-amber-900 dark:text-amber-300 font-medium"
                            : "text-rose-850 dark:text-rose-300 font-medium"
                      }
                    >
                      {cashVariance === 0
                        ? "Drawer is perfectly balanced with expected cash sales."
                        : cashVariance > 0
                          ? "Physical cash exceeds system expected balance."
                          : "Cash shortage detected against system records."}
                    </p>
                    {Math.abs(cashVariance) > FRAUD_LIMIT && (
                      <p className="text-[11px] font-mono text-rose-700 dark:text-rose-400 flex items-center gap-1 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Exceeds audit threshold ({currencySymbol} {FRAUD_LIMIT}).</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible Currency Denomination Breakdown */}
              {showDenominations && (
                <div className="p-3.5 rounded-xl glass-panel border border-[var(--border)] space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
                    <span className="text-xs font-mono font-bold text-[var(--text-hi)] uppercase flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-[var(--gold)]" />
                      <span>Currency Notes &amp; Coins Calculator ({currencySymbol})</span>
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-faint)]">
                      Auto-sums into physical cash counted
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
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
                      <div
                        key={denom.key}
                        className="p-2 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)]"
                      >
                        <span className="text-[10px] text-[var(--text-faint)] font-bold block">
                          {denom.label}
                        </span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={denominations[denom.key as keyof typeof denominations]}
                          onChange={(e) =>
                            handleDenominationChange(
                              denom.key as keyof typeof denominations,
                              e.target.value
                            )
                          }
                          className="w-full bg-transparent font-bold text-xs text-[var(--text-hi)] focus:outline-none mt-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: CLOSING REMARKS */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-[var(--text-hi)] uppercase flex items-center gap-1.5 font-mono">
                  <FileText className="w-3.5 h-3.5 text-amber-800 dark:text-[var(--gold)]" />
                  <span>Closing Remarks / Discrepancy Explanation</span>
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Optional shift notes or reconciliation remarks..."
                  rows={2}
                  className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hi)]/50 focus:bg-[var(--surface-hi)]/80 border border-[var(--border)] focus:border-[var(--gold)] rounded-xl p-3 text-xs text-[var(--text-hi)] focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-sans shadow-xs"
                />
              </div>
            </div>

            {/* C. ACTIONS FOOTER */}
            <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <button
                type="button"
                onClick={handlePrintSlip}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 text-[var(--text-hi)] border border-[var(--border)] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[var(--gold)]" />
                <span>Print Z-Report Slip</span>
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => router.push("/terminal/pos")}
                  disabled={isSubmitting}
                  className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 sm:w-auto btn-gold text-[#342c14] font-bold px-6 py-2.5 rounded-xl text-xs font-mono tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isSubmitting ? "Settling..." : "Confirm & Close Shift"}</span>
                </button>
              </div>
            </div>
          </form>
        </main>

        {/* ========================================================================= */}
        {/* D. 80mm THERMAL RECEIPT PRINT AREA (EXACT PARITY WITH ORIGINAL MODAL)    */}
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
              <span>Shift Window:</span>
              <span className="font-bold">{shiftType} ({activeShiftDetails.windowLabel})</span>
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
              {restaurantName} Audit Ledger • {new Date().toLocaleDateString()}{" "}
              {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  </>
  );
}
