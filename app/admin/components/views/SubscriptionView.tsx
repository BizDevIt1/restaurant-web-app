"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Users,
  Receipt,
  Building2,
  Clock,
  Printer,
  Download,
  ExternalLink,
  X,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
  PhoneCall,
  Mail,
  HelpCircle,
  Zap,
} from "lucide-react";
import { AuthenticatedUser, Branch, StaffMember, OrderRecord, BillingInvoice } from "../../types";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface SubscriptionViewProps {
  user?: AuthenticatedUser | null;
  branches?: Branch[];
  staffList?: StaffMember[];
  orders?: OrderRecord[];
  showToast: (msg: string) => void;
}

interface LiveUsageMetrics {
  monthlyOrders: number;
  tablesCount: number;
  staffCount: number;
  branchesCount: number;
}

interface QuotaLimits {
  monthlyOrders: number | null; // null represents Unlimited
  tables: number | null;
  staffMembers: number | null;
  branches: number | null;
  monthlyFeePKR: number;
}

export default function SubscriptionView({
  user,
  branches = [],
  staffList = [],
  orders = [],
  showToast,
}: SubscriptionViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);

  const [liveUsage, setLiveUsage] = useState<LiveUsageMetrics>({
    monthlyOrders: 0,
    tablesCount: 0,
    staffCount: 0,
    branchesCount: 1,
  });

  // Calculate renewal date based on created_at and cycle
  const calculateRenewalDate = (createdAtStr?: string, billingCycle: string = "Monthly"): Date => {
    const created = createdAtStr ? new Date(createdAtStr) : new Date();
    const now = new Date();
    const renewal = new Date(created);

    if (billingCycle.toLowerCase() === "annual") {
      while (renewal <= now) {
        renewal.setFullYear(renewal.getFullYear() + 1);
      }
    } else {
      while (renewal <= now) {
        renewal.setMonth(renewal.getMonth() + 1);
      }
    }
    return renewal;
  };

  const lastLoadedRef = useRef<number>(0);
  const isLoadingRef = useRef<boolean>(false);

  // Fetch verified tenant data, live usage metrics, and subscription quotas
  const loadSubscriptionData = useCallback(async (force = false) => {
    const nowTime = Date.now();
    if (isLoadingRef.current) return;
    if (!force && nowTime - lastLoadedRef.current < 15000) return;

    isLoadingRef.current = true;
    lastLoadedRef.current = nowTime;

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      setTenantId(restId);

      // 1. Fetch Restaurant Record
      const { data: restData, error: restErr } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restId)
        .maybeSingle();

      if (restErr) {
        console.warn("[SubscriptionView] Supabase restaurant fetch error:", restErr);
      }
      if (restData) {
        setRestaurantData(restData);
      }

      // 2. Query Live Monthly Orders Count (Current Calendar Month)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: ordCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", restId)
        .gte("created_at", startOfMonth);

      // 3. Query Live Configured Tables Count
      const { count: tblCount } = await supabase
        .from("restaurant_tables")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", restId);

      // 4. Query Live Staff Members Count
      let stfCount = 0;
      const { count: smCount, error: smErr } = await supabase
        .from("staff_members")
        .select("*", { count: "exact", head: true })
        .eq("restaurant_id", restId);

      if (!smErr && smCount !== null) {
        stfCount = smCount;
      } else {
        stfCount = staffList?.length || 0;
      }

      // 5. Query Active Branches Count (from restaurant branches JSONB, prop, or branch_settings)
      let brCount = 1;
      if (Array.isArray(restData?.branches) && restData.branches.length > 0) {
        brCount = restData.branches.length;
      } else if (branches && branches.length > 0) {
        brCount = branches.length;
      } else {
        try {
          const { count: bCount } = await supabase
            .from("branch_settings")
            .select("*", { count: "exact", head: true })
            .eq("restaurant_id", restId);
          if (bCount && bCount > 0) {
            brCount = bCount;
          }
        } catch {}
      }

      setLiveUsage({
        monthlyOrders: ordCount ?? (orders.length > 0 ? orders.length : 0),
        tablesCount: tblCount ?? 0,
        staffCount: stfCount ?? (staffList.length > 0 ? staffList.length : 0),
        branchesCount: brCount,
      });

      // 6. Invoices Ledger initialized cleanly without hitting non-existent table
      setInvoices([]);
    } catch (err) {
      console.error("[SubscriptionView] Failed to load telemetry:", err);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.organizationId, branches, staffList?.length, orders?.length]);

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadSubscriptionData(true);
    showToast("Subscription metrics refreshed.");
  };

  // Derive Normalized Plan Tier
  const rawPlanString = (
    restaurantData?.assigned_plan ||
    user?.restaurantType ||
    ""
  ).toLowerCase();

  let planTier = "Free / Trial Tier";
  let isTrial = false;

  if (rawPlanString.includes("enterprise") || rawPlanString.includes("enterpries")) {
    planTier = "Enterprise Tier";
  } else if (rawPlanString.includes("pro") || rawPlanString.includes("growth")) {
    planTier = "Professional Growth";
  } else if (rawPlanString.includes("starter") || rawPlanString.includes("basic")) {
    planTier = "Starter Tier";
  } else if (rawPlanString.includes("free") || rawPlanString.includes("trial") || !rawPlanString) {
    planTier = "Free Trial Tier";
    isTrial = true;
  } else {
    planTier = restaurantData?.assigned_plan || "Standard Tier";
  }

  // Derive Normalized Subscription Status: ACTIVE | TRIAL | EXPIRED
  const rawStatus = (restaurantData?.initial_status || "").toUpperCase();
  let subscriptionStatus: "ACTIVE" | "TRIAL" | "EXPIRED" = "ACTIVE";

  if (rawStatus.includes("EXPIRED") || rawStatus.includes("SUSPENDED")) {
    subscriptionStatus = "EXPIRED";
  } else if (rawStatus.includes("TRIAL") || isTrial) {
    subscriptionStatus = "TRIAL";
  } else if (rawStatus.includes("ACTIVE") || !rawStatus) {
    subscriptionStatus = "ACTIVE";
  }

  const cleanBrandName =
    user?.restaurantName ||
    restaurantData?.brand_name ||
    "OmniBites Partner";

  const billingCycle = (restaurantData?.billing_cycle as "Monthly" | "Annual") || "Monthly";

  // Dynamic Term Start Date and Next Renewal Date
  const termStartDate = restaurantData?.created_at
    ? new Date(restaurantData.created_at)
    : new Date();

  const nextRenewalDate = calculateRenewalDate(restaurantData?.created_at, billingCycle);
  const diffTime = nextRenewalDate.getTime() - Date.now();
  const daysUntilRenewal = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const isExpiringSoon = subscriptionStatus === "ACTIVE" && daysUntilRenewal <= 7;

  // Quota Limits & Pricing Model based on Verified Database Plan
  const quotaLimits: QuotaLimits = {
    monthlyOrders:
      restaurantData?.max_orders ??
      (planTier.includes("Enterprise")
        ? 15000
        : planTier.includes("Professional")
        ? 6000
        : planTier.includes("Starter")
        ? 1000
        : 200),
    tables:
      restaurantData?.max_tables ??
      (planTier.includes("Enterprise")
        ? 50
        : planTier.includes("Professional")
        ? 25
        : planTier.includes("Starter")
        ? 10
        : 5),
    staffMembers:
      restaurantData?.max_staff ??
      (planTier.includes("Enterprise")
        ? 40
        : planTier.includes("Professional")
        ? 15
        : planTier.includes("Starter")
        ? 5
        : 3),
    branches:
      restaurantData?.max_branches ??
      (planTier.includes("Enterprise")
        ? 10
        : planTier.includes("Professional")
        ? 3
        : 1),
    monthlyFeePKR:
      restaurantData?.monthly_fee ??
      (subscriptionStatus === "TRIAL"
        ? 0
        : planTier.includes("Enterprise")
        ? 35000
        : planTier.includes("Professional")
        ? 22500
        : planTier.includes("Starter")
        ? 12000
        : 0),
  };

  // Helper for dynamic % usage calculation: (Current Live Count / Allowed Limit) * 100
  const calcPercent = (current: number, limit: number | null): number => {
    if (!limit || limit <= 0) return 0;
    return Math.min(100, Math.round((current / limit) * 100));
  };

  const orderUsagePercent = calcPercent(liveUsage.monthlyOrders, quotaLimits.monthlyOrders);
  const tableUsagePercent = calcPercent(liveUsage.tablesCount, quotaLimits.tables);
  const staffUsagePercent = calcPercent(liveUsage.staffCount, quotaLimits.staffMembers);
  const branchUsagePercent = calcPercent(liveUsage.branchesCount, quotaLimits.branches);

  const handlePrintModal = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* A. TOP HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            <CreditCard className="w-3.5 h-3.5" />
            <span>SAAS SUBSCRIPTION &amp; QUOTAS</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Subscription{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              &amp; Quotas
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Active subscription plan, license quotas, and operational limits
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="https://wa.me/923008492000?text=Hello%20OmniBites%2C%20I%20would%20like%20to%20inquire%20about%20upgrading%20our%20restaurant%20SaaS%20quotas."
            target="_blank"
            rel="noreferrer"
            className="btn-gold animate-sheen px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
          >
            <Zap className="w-4 h-4" />
            <span>Upgrade Quotas</span>
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. RENEWAL / EXPIRY WARNING BANNER */}
      {/* ========================================================================= */}
      {(isExpiringSoon || subscriptionStatus === "EXPIRED") && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-amber-300">
                {subscriptionStatus === "EXPIRED"
                  ? "Subscription Term Expired"
                  : `Subscription Term Due for Renewal (${daysUntilRenewal} Days Remaining)`}
              </h4>
              <p className="text-xs font-mono text-amber-200/80 mt-0.5">
                {subscriptionStatus === "EXPIRED"
                  ? "Your SaaS license cycle has ended. Please renew to avoid POS terminal or KDS restrictions."
                  : `Next billing cycle renewal scheduled for ${nextRenewalDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/923008492000?text=Hello%20OmniBites%20Billing%2C%20we%20would%20like%20to%20coordinate%20our%20subscription%20renewal."
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs flex items-center gap-2 hover:bg-amber-400 transition-all shadow-md shrink-0 cursor-pointer"
          >
            <span>Coordinate Renewal</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ACTIVE LICENSE & PLAN OVERVIEW CARD */}
      {/* ========================================================================= */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl relative overflow-hidden space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shadow-md shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display font-black text-xl sm:text-2xl text-[var(--text-hi)] tracking-tight">
                    {planTier}
                  </h2>
                  <span
                    className={`px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      subscriptionStatus === "ACTIVE"
                        ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                        : subscriptionStatus === "TRIAL"
                        ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                        : "bg-red-500/15 text-red-400 border border-red-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        subscriptionStatus === "ACTIVE"
                          ? "bg-[#25d366] animate-pulse"
                          : subscriptionStatus === "TRIAL"
                          ? "bg-blue-400"
                          : "bg-red-400"
                      }`}
                    />
                    {subscriptionStatus} License
                  </span>
                </div>
                <p className="text-xs font-mono text-[var(--text-faint)] mt-1">
                  Tenant Organization ID:{" "}
                  <span className="text-[var(--text-hi)] font-bold">
                    #{tenantId ?? "..."}
                  </span>{" "}
                  • Restaurant Brand:{" "}
                  <span className="text-[var(--gold)] font-bold">
                    {cleanBrandName}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Pricing & Cycle Summary Card */}
          <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] font-mono">
            <div>
              <p className="text-[10px] uppercase text-[var(--text-faint)] font-bold tracking-wider">
                Recurring SaaS Fee
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-display font-black text-xl sm:text-2xl text-[var(--gold)]">
                  {quotaLimits.monthlyFeePKR > 0
                    ? `Rs ${quotaLimits.monthlyFeePKR.toLocaleString()}`
                    : "Free Tier"}
                </span>
                {quotaLimits.monthlyFeePKR > 0 && (
                  <span className="text-xs text-[var(--text-lo)]">/ {billingCycle.toLowerCase()}</span>
                )}
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--border)]" />
            <div>
              <p className="text-[10px] uppercase text-[var(--text-faint)] font-bold tracking-wider">
                Cycle Interval
              </p>
              <p className="text-xs font-bold text-[var(--text-hi)] mt-1">{billingCycle} Billing</p>
            </div>
          </div>
        </div>

        {/* Term Dates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]/60 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
            <span className="text-[10px] text-[var(--text-faint)] uppercase flex items-center gap-1.5 font-semibold">
              <Clock className="w-3.5 h-3.5 text-[var(--gold)]" /> Account Created
            </span>
            <p className="font-bold text-[var(--text-hi)] text-xs sm:text-sm">
              {termStartDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
            <span className="text-[10px] text-[var(--text-faint)] uppercase flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#25d366]" /> Next Billing Scheduled
            </span>
            <p className="font-bold text-[#25d366] text-xs sm:text-sm">
              {nextRenewalDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
            <span className="text-[10px] text-[var(--text-faint)] uppercase flex items-center gap-1.5 font-semibold">
              <RefreshCw className="w-3.5 h-3.5 text-[var(--gold)]" /> Payment Terms
            </span>
            <p className="font-bold text-[var(--text-hi)] text-xs sm:text-sm">
              {subscriptionStatus === "TRIAL" ? "Complimentary Trial" : "Auto-Invoiced • Net 5 Days"}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. LIVE QUOTA & RESOURCE ALLOCATION CARDS (PROGRESS BARS) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--gold)]" />
            <h3 className="font-display font-bold text-sm text-[var(--text-hi)]">
              Live Quotas & Resource Telemetry
            </h3>
          </div>
          <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
            Real-time operational usage
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 font-mono">
          {/* Card 1: Monthly Order Processing Capacity */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/30 text-[var(--orange)] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--orange-dim)] text-[var(--orange)] font-mono text-[11px] font-bold border border-[var(--orange)]/30">
                Monthly Orders
              </span>
            </div>
            <div>
              <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                {liveUsage.monthlyOrders.toLocaleString()}
                <span className="text-xs sm:text-sm font-normal text-[var(--text-faint)] ml-1">
                  / {quotaLimits.monthlyOrders !== null ? quotaLimits.monthlyOrders.toLocaleString() : "Unlimited"}
                </span>
              </div>
              <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                Live orders processed this month
              </p>
            </div>
            {/* Visual Progress Bar */}
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 space-y-1.5">
              <div className="w-full bg-[var(--surface-hi)] border border-[var(--border)] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    orderUsagePercent >= 90
                      ? "bg-red-400"
                      : orderUsagePercent >= 70
                      ? "bg-amber-400"
                      : "bg-[#25d366]"
                  }`}
                  style={{
                    width: quotaLimits.monthlyOrders ? `${orderUsagePercent}%` : "100%",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                <span>{quotaLimits.monthlyOrders ? `${orderUsagePercent}% utilized` : "No limit"}</span>
                <span className={orderUsagePercent >= 90 ? "text-red-400 font-bold" : "text-[var(--gold)] font-bold"}>
                  {quotaLimits.monthlyOrders !== null
                    ? `${Math.max(0, quotaLimits.monthlyOrders - liveUsage.monthlyOrders).toLocaleString()} remaining`
                    : "Unlimited"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Configured Dining Tables */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[11px] font-bold border border-[var(--gold)]/30">
                Dining Tables
              </span>
            </div>
            <div>
              <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                {liveUsage.tablesCount}
                <span className="text-xs sm:text-sm font-normal text-[var(--text-faint)] ml-1">
                  / {quotaLimits.tables !== null ? quotaLimits.tables.toLocaleString() : "Unlimited"}
                </span>
              </div>
              <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                Floor tables configured in system
              </p>
            </div>
            {/* Visual Progress Bar */}
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 space-y-1.5">
              <div className="w-full bg-[var(--surface-hi)] border border-[var(--border)] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    tableUsagePercent >= 90
                      ? "bg-red-400"
                      : tableUsagePercent >= 70
                      ? "bg-amber-400"
                      : "bg-[#25d366]"
                  }`}
                  style={{
                    width: quotaLimits.tables ? `${tableUsagePercent}%` : "100%",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                <span>{quotaLimits.tables ? `${tableUsagePercent}% utilized` : "No limit"}</span>
                <span className={tableUsagePercent >= 90 ? "text-red-400 font-bold" : "text-[#25d366] font-bold"}>
                  {quotaLimits.tables !== null
                    ? `${Math.max(0, quotaLimits.tables - liveUsage.tablesCount)} open`
                    : "Unlimited"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Staff Members Limit */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-mono text-[11px] font-bold border border-blue-500/30">
                Staff Seats
              </span>
            </div>
            <div>
              <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                {liveUsage.staffCount}
                <span className="text-xs sm:text-sm font-normal text-[var(--text-faint)] ml-1">
                  / {quotaLimits.staffMembers !== null ? quotaLimits.staffMembers.toLocaleString() : "Unlimited"}
                </span>
              </div>
              <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                Active staff &amp; POS terminals
              </p>
            </div>
            {/* Visual Progress Bar */}
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 space-y-1.5">
              <div className="w-full bg-[var(--surface-hi)] border border-[var(--border)] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    staffUsagePercent >= 90
                      ? "bg-red-400"
                      : staffUsagePercent >= 70
                      ? "bg-amber-400"
                      : "bg-[#25d366]"
                  }`}
                  style={{
                    width: quotaLimits.staffMembers ? `${staffUsagePercent}%` : "100%",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                <span>{quotaLimits.staffMembers ? `${staffUsagePercent}% utilized` : "No limit"}</span>
                <span className={staffUsagePercent >= 90 ? "text-red-400 font-bold" : "text-blue-400 font-bold"}>
                  {quotaLimits.staffMembers !== null
                    ? `${Math.max(0, quotaLimits.staffMembers - liveUsage.staffCount)} available`
                    : "Unlimited"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Connected Branch Outlets */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-mono text-[11px] font-bold border border-purple-500/30">
                Branch Outlets
              </span>
            </div>
            <div>
              <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                {liveUsage.branchesCount}
                <span className="text-xs sm:text-sm font-normal text-[var(--text-faint)] ml-1">
                  / {quotaLimits.branches !== null ? quotaLimits.branches.toLocaleString() : "Unlimited"}
                </span>
              </div>
              <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                Configured restaurant branches
              </p>
            </div>
            {/* Visual Progress Bar */}
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 space-y-1.5">
              <div className="w-full bg-[var(--surface-hi)] border border-[var(--border)] rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    branchUsagePercent >= 90
                      ? "bg-red-400"
                      : branchUsagePercent >= 70
                      ? "bg-amber-400"
                      : "bg-[#25d366]"
                  }`}
                  style={{
                    width: quotaLimits.branches ? `${branchUsagePercent}%` : "100%",
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                <span>{quotaLimits.branches ? `${branchUsagePercent}% utilized` : "No limit"}</span>
                <span className={branchUsagePercent >= 90 ? "text-red-400 font-bold" : "text-purple-400 font-bold"}>
                  {quotaLimits.branches !== null
                    ? `${Math.max(0, quotaLimits.branches - liveUsage.branchesCount)} open`
                    : "Unlimited"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. INVOICING & BILLING HISTORY LEDGER */}
      {/* ========================================================================= */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-base text-[var(--text-hi)] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[var(--gold)]" />
              Invoicing &amp; Billing History Ledger
            </h3>
            <p className="text-xs font-mono text-[var(--text-faint)] mt-0.5">
              Official sales tax receipts and billing statements recorded for this tenant
            </p>
          </div>
          {invoices.length > 0 && (
            <button
              type="button"
              onClick={() => showToast("Downloading complete billing statement...")}
              className="px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-white/5 text-[var(--text-hi)] border border-[var(--border)] text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>Export Statement</span>
            </button>
          )}
        </div>

        {/* Ledger Content: Clean Empty State or Real Invoices Table */}
        {invoices.length === 0 ? (
          <div className="p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-center text-[var(--gold)]">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-[var(--text-hi)]">
                No Billing Invoices Found
              </h4>
              <p className="text-xs font-mono text-[var(--text-lo)] max-w-md mt-1 leading-relaxed">
                Official sales tax invoices and cycle settlement receipts will appear here once generated by platform billing.
              </p>
            </div>
            <a
              href="https://wa.me/923008492000?text=Hello%20OmniBites%20Billing%2C%20please%20send%20our%20latest%20tax%20invoice."
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-white/5 border border-[var(--border)] text-xs font-mono font-bold text-[var(--gold)] flex items-center gap-2 cursor-pointer transition-all mt-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Request Statement from Billing</span>
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[var(--text-faint)] uppercase text-[10px] tracking-wider font-semibold font-mono">
                  <th className="py-3.5 px-5">Invoice Ref</th>
                  <th className="py-3.5 px-5">Billing Period</th>
                  <th className="py-3.5 px-5">Issue Date</th>
                  <th className="py-3.5 px-5">Amount (PKR)</th>
                  <th className="py-3.5 px-5">Payment Method</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40 font-medium">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-3.5 px-5 font-bold text-[var(--gold)]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-5 text-[var(--text-hi)]">{inv.period}</td>
                    <td className="py-3.5 px-5 text-[var(--text-lo)]">{inv.issueDate}</td>
                    <td className="py-3.5 px-5 font-bold text-[var(--text-hi)]">
                      Rs {inv.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-[var(--text-lo)]">{inv.paymentMethod}</td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-3 py-1 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-hi)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-[11px] font-bold cursor-pointer transition-all shadow-xs"
                      >
                        View Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. SUPPORT & QUOTA UPGRADE CARD */}
      {/* ========================================================================= */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
              <Zap className="w-4 h-4" />
            </span>
            <h4 className="font-display font-black text-base sm:text-lg text-[var(--text-hi)]">
              Need to Expand Quotas or Deploy More Outlets?
            </h4>
          </div>
          <p className="text-xs font-mono text-[var(--text-lo)] leading-relaxed">
            Our Enterprise Team assists with custom POS hardware provisioning, multi-outlet billing, multi-city commissaries, and high-throughput order scaling.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--text-faint)] pt-1">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[var(--gold)]" /> billing@omnibites.com
            </span>
            <span className="flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-[var(--gold)]" /> +92 300 8492000
            </span>
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#25d366]" /> 24/7 SLA Priority
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
          <a
            href="https://wa.me/923008492000?text=Hello%20OmniBites%2C%20I%20would%20like%20to%20upgrade%20our%20restaurant%20SaaS%20plan%20quotas."
            target="_blank"
            rel="noreferrer"
            className="btn-gold animate-sheen px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer w-full sm:w-auto"
          >
            <span>Request Quota Upgrade</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. PRINTABLE INVOICE MODAL DIALOG */}
      {/* ========================================================================= */}
      {selectedInvoice && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedInvoice(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar p-5 sm:p-8 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-150">
            {/* Modal Top Actions */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--gold)] shrink-0" />
                <span className="font-display font-black text-sm sm:text-base text-[var(--text-hi)]">
                  Sales Tax Receipt • {selectedInvoice.invoiceNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintModal}
                  className="px-3 py-1.5 rounded-xl bg-[var(--gold)] text-[#342c14] font-bold text-xs flex items-center gap-1.5 hover:bg-[var(--gold)]/90 cursor-pointer transition-all shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Body */}
            <div className="space-y-5 font-mono text-xs">
              {/* Invoice Corporate Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[var(--gold)] text-[#342c14] font-black flex items-center justify-center text-sm">
                      O
                    </div>
                    <span className="font-display font-black text-lg text-[var(--text-hi)]">
                      OmniBites Technologies Inc.
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-faint)] mt-1">
                    Cloud Restaurant Operating System & Multi-Branch Kiosk POS
                  </p>
                  <p className="text-[10.5px] text-[var(--text-lo)]">
                    NTN: 8291047-3 • PRA Sales Tax Registration: 36-00-8291-047
                  </p>
                </div>

                <div className="sm:text-right">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30">
                    Official Tax Invoice
                  </span>
                  <p className="font-display font-black text-sm text-[var(--text-hi)] mt-1.5">
                    {selectedInvoice.invoiceNumber}
                  </p>
                  <p className="text-[11px] text-[var(--text-faint)]">Issued: {selectedInvoice.issueDate}</p>
                </div>
              </div>

              {/* Billed To & Payment Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)]">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-[var(--text-faint)] font-bold">Billed To Customer:</span>
                  <p className="font-bold text-[var(--text-hi)] text-sm">
                    {cleanBrandName}
                  </p>
                  <p className="text-[11px] text-[var(--text-lo)]">
                    City: {user?.city || restaurantData?.city || "Lahore"}, Pakistan
                  </p>
                  <p className="text-[11px] text-[var(--text-lo)]">
                    Account Email: {user?.email || restaurantData?.owner_email}
                  </p>
                </div>

                <div className="space-y-1 sm:text-right">
                  <span className="text-[10px] uppercase text-[var(--text-faint)] font-bold">Payment Details:</span>
                  <p className="font-bold text-[#25d366]">{selectedInvoice.paymentMethod}</p>
                  <p className="text-[11px] text-[var(--text-lo)]">Coverage: {selectedInvoice.period}</p>
                  <p className="text-[11px] text-[var(--text-lo)]">Status: Settlement Confirmed (Paid)</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[var(--surface-hi)] text-[var(--text-faint)] uppercase text-[10px] border-b border-[var(--border)]">
                      <th className="py-2.5 px-4">Item & Description</th>
                      <th className="py-2.5 px-4 text-center">Period</th>
                      <th className="py-2.5 px-4 text-right">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/40">
                    <tr>
                      <td className="py-3 px-4">
                        <p className="font-bold text-[var(--text-hi)]">{selectedInvoice.planName} Base License</p>
                        <p className="text-[10.5px] text-[var(--text-faint)]">
                          Includes {quotaLimits.branches} Outlets & {quotaLimits.staffMembers} Staff Logins
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center text-[var(--text-lo)]">1 Month</td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--text-hi)]">
                        Rs {(selectedInvoice.subtotal || selectedInvoice.amount * 0.84).toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-[var(--text-lo)]">Sales Tax (PRA 16%)</td>
                      <td className="py-2.5 px-4 text-center text-[var(--text-faint)]">16%</td>
                      <td className="py-2.5 px-4 text-right font-bold text-[var(--text-lo)]">
                        Rs {(selectedInvoice.taxAmount || selectedInvoice.amount * 0.16).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Final Totals Breakdown */}
              <div className="flex flex-col items-end gap-1.5 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between w-64 text-[var(--text-lo)]">
                  <span>Subtotal:</span>
                  <span>Rs {(selectedInvoice.subtotal || selectedInvoice.amount * 0.84).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between w-64 text-[var(--text-lo)]">
                  <span>Provincial Tax (16%):</span>
                  <span>Rs {(selectedInvoice.taxAmount || selectedInvoice.amount * 0.16).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between w-64 font-bold text-sm text-[var(--gold)] pt-1 border-t border-[var(--border)]">
                  <span>Total Settled:</span>
                  <span>Rs {selectedInvoice.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Footer Stamp & Disclaimer */}
              <div className="p-3.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[10px] text-[var(--text-faint)] space-y-1">
                <p className="font-bold text-[var(--text-lo)]">Electronic Tax Invoice Certification:</p>
                <p>
                  This is a computer-generated tax receipt generated by the OmniBites Core Platform. No physical signature is required. For inquiries, contact billing@omnibites.com.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
