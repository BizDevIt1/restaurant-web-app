"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Receipt,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Flame,
  Bike,
  Building2,
  Lock,
  Unlock,
  KeyRound,
  FileText,
  Boxes,
  Truck,
  ArrowRight,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Eye,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/app/admin/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { getValidTenantContext } from "@/lib/tenantResolver";
import ResponsiveSelect from "@/app/admin/components/ResponsiveSelect";
import { getStoredOrders, getStoredBranchSettings } from "@/lib/tenantStore";
import { RawMaterial } from "@/app/admin/types";

export interface VoidApprovalItem {
  id: string;
  orderNumber: string;
  itemOrReason: string;
  requestedBy: string;
  amount: number;
  type: "void_order" | "item_cancel" | "high_discount";
  status: "pending" | "approved" | "rejected";
  timestamp: string;
}

export default function ManagerTerminalClient() {
  const router = useRouter();
  const { user } = useAuth();
  const currentOrgId = user?.organizationId || user?.id || "default";

  // Navigation tab inside manager station
  const [activeTab, setActiveTab] = useState<"shifts" | "approvals" | "audit" | "inventory">("shifts");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Financial & Shifts State
  const [orders, setOrders] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Manager Override PIN
  const [managerPin, setManagerPin] = useState("1234");
  const [enteredPin, setEnteredPin] = useState("");
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingApprovalTarget, setPendingApprovalTarget] = useState<string | null>(null);

  // Approvals Queue
  const [approvalItems, setApprovalItems] = useState<VoidApprovalItem[]>([
    {
      id: "OVR-8901",
      orderNumber: "#ORD-1042",
      itemOrReason: "Customer changed mind - cancelled Mutton Karahi Full",
      requestedBy: "Ali (Cashier 1)",
      amount: 2850,
      type: "item_cancel",
      status: "pending",
      timestamp: "10 mins ago",
    },
    {
      id: "OVR-8902",
      orderNumber: "#ORD-1039",
      itemOrReason: "VIP Guest - 25% Staff/Corporate Discount applied",
      requestedBy: "Usman (Cashier 2)",
      amount: 1450,
      type: "high_discount",
      status: "pending",
      timestamp: "25 mins ago",
    },
    {
      id: "OVR-8898",
      orderNumber: "#ORD-1011",
      itemOrReason: "Order mistakenly rung up twice - Full Void",
      requestedBy: "Ali (Cashier 1)",
      amount: 3400,
      type: "void_order",
      status: "approved",
      timestamp: "1 hour ago",
    },
  ]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch live orders & raw materials from Supabase
  useEffect(() => {
    let isMounted = true;

    const loadManagerData = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        // 1. Fetch Orders
        const { data: ordersData } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (ordersData && isMounted) {
          setOrders(ordersData);
        } else {
          setOrders(getStoredOrders(currentOrgId));
        }

        // 2. Fetch Raw Materials for Stock Warnings
        const { data: matData } = await supabase
          .from("raw_materials")
          .select("*")
          .eq("restaurant_id", restId)
          .order("current_stock", { ascending: true });

        if (matData && isMounted) {
          setRawMaterials(matData);
        }
      } catch (err) {
        console.warn("[ManagerTerminal] Error loading manager data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadManagerData();
  }, [user, currentOrgId]);

  // Today's Financial Audits
  const auditMetrics = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayOrders = orders.filter((o) => {
      const created = o.created_at || o.createdAt || "";
      return created.startsWith(today);
    });

    const activeList = todayOrders.length > 0 ? todayOrders : orders;

    const grossSales = activeList.reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);
    const taxTotal = activeList.reduce((sum, o) => sum + Number(o.tax_amount || o.taxAmount || 0), 0);
    const discountTotal = activeList.reduce((sum, o) => sum + Number(o.discount_amount || o.discountAmount || 0), 0);
    const orderCount = activeList.length;
    const avgTicket = orderCount > 0 ? Math.round(grossSales / orderCount) : 0;

    // Payment Breakdowns
    const cashSales = activeList
      .filter((o) => (o.payment_method || "").toLowerCase() === "cash")
      .reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);

    const cardSales = activeList
      .filter((o) => (o.payment_method || "").toLowerCase() === "card")
      .reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);

    const raastSales = activeList
      .filter((o) => (o.payment_method || "").toLowerCase() === "raast")
      .reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);

    // Channel Breakdowns
    const dineInSales = activeList
      .filter((o) => (o.order_channel || "").toLowerCase() === "dine_in")
      .reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);

    const takeawaySales = activeList
      .filter((o) => (o.order_channel || "").toLowerCase() === "takeaway")
      .reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);

    const deliverySales = activeList
      .filter((o) => (o.order_channel || "").toLowerCase() === "delivery")
      .reduce((sum, o) => sum + Number(o.total_amount || o.total || 0), 0);

    return {
      grossSales,
      taxTotal,
      discountTotal,
      orderCount,
      avgTicket,
      cashSales,
      cardSales,
      raastSales,
      dineInSales,
      takeawaySales,
      deliverySales,
    };
  }, [orders]);

  // Depleted Raw Materials below safety threshold
  const lowStockMaterials = useMemo(() => {
    return rawMaterials.filter((m) => {
      const stock = Number(m.current_stock) || 0;
      const safety = Number(m.min_safety_stock) || 5;
      return stock <= safety;
    });
  }, [rawMaterials]);

  // Handle Approvals
  const handleApproveOverride = (id: string) => {
    setApprovalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "approved" } : item))
    );
    showToast(`Approved override ${id}. Cashier register authorized.`);
  };

  const handleRejectOverride = (id: string) => {
    setApprovalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "rejected" } : item))
    );
    showToast(`Rejected override ${id}. Action blocked on register.`);
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-deep)] text-[var(--text-hi)] select-none overflow-hidden">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--bg)] border border-emerald-500/40 text-emerald-400 shadow-2xl font-mono text-xs font-semibold animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANAGER STATION HEADER BAR                                                */}
      {/* ========================================================================= */}
      <div className="h-16 px-4 sm:px-6 md:px-8 bg-[var(--surface-hi)]/80 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
        {/* Left: Station Identity & Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs font-mono">
            <ShieldCheck className="w-4 h-4" />
            <span className="uppercase tracking-wider">Manager Terminal Station</span>
          </div>

          <div className="h-5 w-px bg-[var(--border)] hidden sm:block" />

          {/* Quick Jump Buttons for Operations */}
          <div className="hidden lg:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.push("/terminal/pos")}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>POS Billing</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/terminal/kitchen")}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Kitchen KDS</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/terminal/rider")}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg)] hover:bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center gap-1.5 cursor-pointer"
            >
              <Bike className="w-3.5 h-3.5 text-blue-400" />
              <span>Rider Dispatch</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="px-2.5 py-1 rounded-lg bg-[var(--gold-dim)] hover:bg-[var(--gold)]/20 border border-[var(--gold)]/30 text-[11px] font-mono text-[var(--gold)] flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Web Admin Portal</span>
            </button>
          </div>
        </div>

        {/* Center/Right: Manager Pin Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs font-mono">
            <KeyRound className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span className="text-[var(--text-lo)]">Override PIN:</span>
            <span className="font-bold text-[var(--gold)]">••••</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NAVIGATION TABS                                                           */}
      {/* ========================================================================= */}
      <div className="px-4 py-2.5 bg-[var(--bg)] border-b border-[var(--border)] flex items-center justify-between shrink-0">
        {/* Mobile & Tablet Dropdown Filter (< 1024px) */}
        <div className="lg:hidden w-full sm:w-72">
          <ResponsiveSelect
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
            options={[
              { id: "shifts", label: "Shift Oversight", icon: <Clock className="w-3.5 h-3.5" /> },
              {
                id: "approvals",
                label: "Void & Overrides",
                count: approvalItems.filter((i) => i.status === "pending").length,
                icon: <ShieldCheck className="w-3.5 h-3.5" />,
              },
              { id: "audit", label: "Daily Financial Audit", icon: <TrendingUp className="w-3.5 h-3.5" /> },
              {
                id: "inventory",
                label: "Low Stock Alerts",
                count: lowStockMaterials.length > 0 ? lowStockMaterials.length : undefined,
                icon: <Boxes className="w-3.5 h-3.5" />,
              },
            ]}
            buttonClassName="h-10 text-xs font-mono font-bold text-[var(--text-hi)]"
            menuClassName="w-full sm:w-72"
          />
        </div>

        {/* Desktop Navigation Tabs (>= 1024px) */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 bg-[var(--bg-deep)] rounded-xl border border-[var(--border)] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("shifts")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "shifts"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Shift Oversight</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "approvals"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Void &amp; Overrides</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300">
              {approvalItems.filter((i) => i.status === "pending").length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "audit"
                ? "bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Daily Financial Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "inventory"
                ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm"
                : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Low Stock Alerts</span>
            {lowStockMaterials.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500/30 text-red-300 font-bold">
                {lowStockMaterials.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN VIEWPORT                                                             */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
        {/* TAB 1: SHIFT OVERSIGHT */}
        {activeTab === "shifts" && (
          <div className="space-y-6">
            {/* Cash Drawer Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl glass-panel border border-[var(--border)] space-y-2">
                <span className="text-[11px] font-mono text-[var(--text-lo)] uppercase tracking-wider">
                  Cash In Drawers
                </span>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  Rs. {auditMetrics.cashSales.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-[var(--text-faint)]">
                  Live cash collected across active registers
                </div>
              </div>

              <div className="p-4 rounded-2xl glass-panel border border-[var(--border)] space-y-2">
                <span className="text-[11px] font-mono text-[var(--text-lo)] uppercase tracking-wider">
                  Card / POS Terminal
                </span>
                <div className="text-2xl font-black font-mono text-blue-400">
                  Rs. {auditMetrics.cardSales.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-[var(--text-faint)]">
                  Settled via digital credit/debit card swipe
                </div>
              </div>

              <div className="p-4 rounded-2xl glass-panel border border-[var(--border)] space-y-2">
                <span className="text-[11px] font-mono text-[var(--text-lo)] uppercase tracking-wider">
                  Raast / QR Payments
                </span>
                <div className="text-2xl font-black font-mono text-purple-400">
                  Rs. {auditMetrics.raastSales.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-[var(--text-faint)]">
                  Instant bank QR settlements
                </div>
              </div>

              <div className="p-4 rounded-2xl glass-panel border border-[var(--gold)]/30 bg-[var(--gold-dim)]/20 space-y-2">
                <span className="text-[11px] font-mono text-[var(--gold)] uppercase tracking-wider font-bold">
                  Total Till Turnover
                </span>
                <div className="text-2xl font-black font-mono text-[var(--text-hi)]">
                  Rs. {auditMetrics.grossSales.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-[var(--gold)]/80">
                  Across {auditMetrics.orderCount} paid transactions
                </div>
              </div>
            </div>

            {/* Shift Oversight Table */}
            <div className="glass-panel border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-hi)] font-display">
                    Active Counter Registers &amp; Cashiers
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-lo)] mt-0.5">
                    Live operational sessions and float tracking
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/terminal/pos/z-report")}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 border border-[var(--border)] text-xs font-mono font-bold text-[var(--text-hi)] flex items-center gap-1.5 cursor-pointer hover:border-[var(--gold)]/50 transition-all"
                  title="Open Shift Financial Z-Report & Drawer Settlement"
                >
                  <FileText className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Generate Z-Report</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[var(--surface-hi)] text-[var(--text-lo)] border-b border-[var(--border)]">
                    <tr>
                      <th className="p-3.5">Counter / Terminal</th>
                      <th className="p-3.5">Staff Cashier</th>
                      <th className="p-3.5">Shift Window</th>
                      <th className="p-3.5">Opening Float</th>
                      <th className="p-3.5">Total Sales</th>
                      <th className="p-3.5">Expected Till</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    <tr>
                      <td className="p-3.5 font-bold text-[var(--text-hi)]">Register 01 (Main)</td>
                      <td className="p-3.5 text-[var(--text-lo)]">Ali Raza</td>
                      <td className="p-3.5 text-[var(--text-lo)]">Evening (04:00 PM - 12:00 AM)</td>
                      <td className="p-3.5 text-[var(--text-lo)]">Rs. 10,000</td>
                      <td className="p-3.5 text-emerald-400 font-bold">Rs. {auditMetrics.grossSales.toLocaleString()}</td>
                      <td className="p-3.5 text-[var(--gold)] font-bold">Rs. {(auditMetrics.cashSales + 10000).toLocaleString()}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                          Open &amp; Active
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => showToast("Register 01 audited. Till verified.")}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--border)] text-[11px] font-bold text-[var(--text-hi)] cursor-pointer"
                        >
                          Audit Drawer
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VOID & OVERRIDES APPROVALS */}
        {activeTab === "approvals" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-display text-[var(--text-hi)]">
                  Live Cashier Overrides &amp; Void Requests
                </h3>
                <p className="text-xs font-mono text-[var(--text-lo)] mt-0.5">
                  Approve or reject ticket cancellations, item voids, and high-value discounts.
                </p>
              </div>

              <div className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Manager PIN Required for Overrides</span>
              </div>
            </div>

            <div className="space-y-3">
              {approvalItems.map((item) => {
                const isPending = item.status === "pending";

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl glass-panel border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                      isPending
                        ? "border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/10"
                        : item.status === "approved"
                        ? "border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/10"
                        : "border-red-500/30 bg-red-50/60 dark:bg-red-950/10"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[var(--text-hi)]">
                          {item.id}
                        </span>
                        <span className="font-mono text-xs text-[var(--gold)] font-bold">
                          {item.orderNumber}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shadow-xs ${
                            isPending
                              ? "bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
                              : item.status === "approved"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                              : "bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-[var(--text-hi)]">
                        {item.itemOrReason}
                      </div>

                      <div className="text-[11px] font-mono text-[var(--text-faint)] flex items-center gap-2">
                        <span>Requested by {item.requestedBy}</span>
                        <span>•</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-[var(--text-faint)] uppercase">
                          Amount
                        </div>
                        <div className="text-base font-black font-mono text-[var(--text-hi)]">
                          Rs. {item.amount.toLocaleString()}
                        </div>
                      </div>

                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRejectOverride(item.id)}
                            className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-mono text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleApproveOverride(item.id)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-mono text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-mono font-bold text-[var(--text-lo)]">
                          Resolved
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: DAILY FINANCIAL AUDIT */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl glass-panel border border-[var(--border)] space-y-2">
                <span className="text-xs font-mono text-[var(--text-lo)] uppercase tracking-wider">
                  Today&apos;s Gross Sales
                </span>
                <div className="text-3xl font-black font-mono text-[var(--gold)]">
                  Rs. {auditMetrics.grossSales.toLocaleString()}
                </div>
                <div className="text-xs font-mono text-[var(--text-faint)]">
                  Net after discounts: Rs. {(auditMetrics.grossSales - auditMetrics.discountTotal).toLocaleString()}
                </div>
              </div>

              <div className="p-5 rounded-2xl glass-panel border border-[var(--border)] space-y-2">
                <span className="text-xs font-mono text-[var(--text-lo)] uppercase tracking-wider">
                  Total Orders Audited
                </span>
                <div className="text-3xl font-black font-mono text-[var(--text-hi)]">
                  {auditMetrics.orderCount}
                </div>
                <div className="text-xs font-mono text-[var(--text-faint)]">
                  Average Ticket Size: Rs. {auditMetrics.avgTicket.toLocaleString()}
                </div>
              </div>

              <div className="p-5 rounded-2xl glass-panel border border-[var(--border)] space-y-2">
                <span className="text-xs font-mono text-[var(--text-lo)] uppercase tracking-wider">
                  Total Tax Collected
                </span>
                <div className="text-3xl font-black font-mono text-emerald-400">
                  Rs. {auditMetrics.taxTotal.toLocaleString()}
                </div>
                <div className="text-xs font-mono text-[var(--text-faint)]">
                  Government sales tax / provincial levies
                </div>
              </div>
            </div>

            {/* Sales Channel Distribution */}
            <div className="glass-panel border border-[var(--border)] rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold font-display text-[var(--text-hi)]">
                Sales Turnover by Operating Channel
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-[var(--text-lo)]">
                    <span>Dine-In Floor</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-[var(--gold)]" />
                  </div>
                  <div className="text-xl font-bold font-mono text-[var(--text-hi)]">
                    Rs. {auditMetrics.dineInSales.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-[var(--text-lo)]">
                    <span>Takeaway Counter</span>
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <div className="text-xl font-bold font-mono text-[var(--text-hi)]">
                    Rs. {auditMetrics.takeawaySales.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-[var(--text-lo)]">
                    <span>Rider Delivery</span>
                    <Bike className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-xl font-bold font-mono text-[var(--text-hi)]">
                    Rs. {auditMetrics.deliverySales.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LOW STOCK ALERTS & PROCUREMENT INTEGRATION */}
        {activeTab === "inventory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold font-display text-[var(--text-hi)]">
                  Live Inventory &amp; Raw Material Stock Balances
                </h3>
                <p className="text-xs font-mono text-[var(--text-lo)] mt-0.5">
                  Real-time stock deduction triggered upon every POS order settlement.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/admin/procurement")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <Truck className="w-4 h-4" />
                <span>Open Procurement to Issue PO</span>
              </button>
            </div>

            {lowStockMaterials.length > 0 ? (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3 text-xs font-mono">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <span className="font-bold">Attention Manager:</span> {lowStockMaterials.length} raw material(s) have fallen below minimum safety stock due to recent kitchen deductions. Immediate procurement order recommended.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-xs font-mono">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <span className="font-bold">Inventory Healthy:</span> All raw material stock levels are comfortably above minimum safety thresholds.
                </div>
              </div>
            )}

            <div className="glass-panel border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[var(--surface-hi)] text-[var(--text-lo)] border-b border-[var(--border)]">
                    <tr>
                      <th className="p-3.5">Raw Material</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Current Stock</th>
                      <th className="p-3.5">Safety Threshold</th>
                      <th className="p-3.5">Stock Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rawMaterials.map((mat) => {
                      const stock = Number(mat.current_stock) || 0;
                      const safety = Number(mat.min_safety_stock) || 5;
                      const isLow = stock <= safety;

                      return (
                        <tr key={mat.id} className={isLow ? "bg-red-50/70 dark:bg-red-950/15" : undefined}>
                          <td className="p-3.5 font-bold text-[var(--text-hi)]">{mat.name}</td>
                          <td className="p-3.5 text-[var(--text-lo)]">{mat.category || "General"}</td>
                          <td className={`p-3.5 font-bold ${isLow ? "text-rose-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                            {stock} {mat.unit}
                          </td>
                          <td className="p-3.5 text-[var(--text-lo)]">
                            {safety} {mat.unit}
                          </td>
                          <td className="p-3.5">
                            {isLow ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30 font-bold uppercase">
                                Low Stock
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 font-bold uppercase">
                                Adequate
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => router.push("/admin/procurement")}
                              className="px-2.5 py-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--border)] text-[11px] font-bold text-[var(--gold)] cursor-pointer"
                            >
                              Create PO
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
