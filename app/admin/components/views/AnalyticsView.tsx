"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  UtensilsCrossed,
  RefreshCw,
  Calendar,
  AlertCircle,
  Printer,
  ChefHat,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Percent,
  Receipt,
  Tag,
  Wallet,
  CheckCircle2,
  Lock,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { AuthenticatedUser, OrderRecord, OperatingExpense, ShiftSettlement } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import ShiftSettlementModal from "./ShiftSettlementModal";

interface AnalyticsViewProps {
  user?: AuthenticatedUser;
  showToast: (msg: string) => void;
}

type DatePreset = "today" | "week" | "month" | "all";

interface DishProfitItem {
  id: string;
  name: string;
  category?: string;
  unitsSold: number;
  sellingPrice: number;
  unitCogs: number;
  hasRecipe: boolean;
  totalRevenue: number;
  totalCogs: number;
  grossProfit: number;
  marginPct: number;
}

export default function AnalyticsView({
  user: propUser,
  showToast,
}: AnalyticsViewProps) {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;

  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [recipeCostMap, setRecipeCostMap] = useState<Record<string, number>>({});
  const [dishNameCostMap, setDishNameCostMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [settlements, setSettlements] = useState<ShiftSettlement[]>([]);
  const isFetchingRef = useRef(false);
  const lastFetchedRef = useRef(0);

  // Fetch orders, recipe costs, and items from Supabase
  const fetchFinancialData = async (isManualRefresh = false) => {
    const now = Date.now();
    if (isFetchingRef.current) return;
    if (!isManualRefresh && now - lastFetchedRef.current < 15000) return;
    isFetchingRef.current = true;
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const currentOrgId = user?.organizationId || user?.id || "default";

      // 1. Fetch live Recipe Items joined with raw materials for true COGS
      try {
        const { data: recipeRows, error: recipeErr } = await supabase
          .from("recipe_items")
          .select("menu_item_id, quantity_required, raw_materials(id, name, cost_per_unit)")
          .eq("restaurant_id", restId);

        if (!recipeErr && recipeRows && recipeRows.length > 0) {
          const byId: Record<string, number> = {};
          const byName: Record<string, number> = {};

          recipeRows.forEach((r: any) => {
            const mId = String(r.menu_item_id);
            const qtyReq = Number(r.quantity_required) || 0;
            const unitCost = Number(r.raw_materials?.cost_per_unit) || 0;
            const cost = qtyReq * unitCost;

            byId[mId] = (byId[mId] || 0) + cost;
          });

          // Fetch menu item names to correlate with item names in orders
          const { data: menuItems } = await supabase
            .from("menu_items")
            .select("id, name")
            .eq("restaurant_id", restId);

          if (menuItems) {
            menuItems.forEach((m) => {
              const mId = String(m.id);
              if (byId[mId] !== undefined) {
                byName[m.name.toLowerCase().trim()] = byId[mId];
              }
            });
          }

          setRecipeCostMap(byId);
          setDishNameCostMap(byName);
        }
      } catch (recEx) {
        console.warn("[AnalyticsView] Recipe fetch exception:", recEx);
      }

      // 2. Fetch completed Orders from Supabase
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restId)
        .order("created_at", { ascending: false });

      if (!ordersErr && ordersData) {
        const mappedOrders: OrderRecord[] = ordersData
          .filter((o: any) => o.order_status !== "cancelled")
          .map((o: any) => ({
            id: o.order_number || o.id,
            orderChannel: o.order_channel || "dine_in",
            tableId: o.table_id ? 1 : undefined,
            tableName: o.customer_name || `Order ${o.order_number}`,
            items: Array.isArray(o.items) ? o.items : [],
            subtotal: Number(o.subtotal || o.total_amount || 0),
            taxAmount: Number(o.tax_amount || 0),
            discountPercent: 0,
            discountAmount: Number(o.discount_amount || 0),
            total: Number(o.total_amount || o.subtotal || 0),
            paymentMethod: (o.payment_method || "cash").toLowerCase(),
            cashierName: o.cashier_name || "Cashier",
            timestamp: o.created_at || new Date().toISOString(),
            status: o.order_status || "completed",
          }));

        setOrders(mappedOrders);
      }

      // 3. Fetch Operating Expenses strictly from Supabase
      try {
        const { data: expData, error: expErr } = await supabase
          .from("operating_expenses")
          .select("*")
          .eq("restaurant_id", restId)
          .order("expense_date", { ascending: false });

        if (!expErr && expData) {
          const mappedExpenses: OperatingExpense[] = expData.map((row: any) => ({
            id: row.id,
            restaurant_id: Number(row.restaurant_id),
            branch_id: row.branch_id,
            category: row.category || "Misc",
            title: row.title || "Untitled Expense",
            amount: Number(row.amount) || 0,
            payment_method: row.payment_method || "CASH",
            expense_date: row.expense_date || new Date().toISOString().split("T")[0],
            receipt_url: row.receipt_url,
            logged_by: row.logged_by || "Admin",
            notes: row.notes || "",
            created_at: row.created_at,
          }));
          setExpenses(mappedExpenses);
        }
      } catch (expEx) {
        console.warn("[AnalyticsView] Operating expenses fetch error:", expEx);
      }

      // 4. Fetch recent Shift Settlements (Z-Reports) strictly from Supabase
      try {
        const { data: shiftData, error: shiftErr } = await supabase
          .from("shift_settlements")
          .select("*")
          .eq("restaurant_id", restId)
          .order("created_at", { ascending: false })
          .limit(8);

        if (!shiftErr && shiftData) {
          setSettlements(shiftData);
        }
      } catch (shErr) {
        console.warn("[AnalyticsView] Shift settlements fetch error:", shErr);
      }

      if (isManualRefresh) showToast("Financial dataset synchronized.");
    } catch (err) {
      console.error("[AnalyticsView] Fetch error:", err);
    } finally {
      isFetchingRef.current = false;
      lastFetchedRef.current = Date.now();
      setIsLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [user?.id, user?.organizationId]);

  // Filter orders by selected Date Preset
  const filteredOrders = useMemo(() => {
    if (orders.length === 0) return [];
    if (datePreset === "all") return orders;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((order) => {
      const orderTime = new Date(order.timestamp).getTime();
      if (isNaN(orderTime)) return true;

      if (datePreset === "today") {
        return orderTime >= startOfToday;
      } else if (datePreset === "week") {
        return orderTime >= sevenDaysAgo;
      } else if (datePreset === "month") {
        return orderTime >= thirtyDaysAgo;
      }
      return true;
    });
  }, [orders, datePreset]);

  // Filter expenses by selected Date Preset
  const filteredExpenses = useMemo(() => {
    if (expenses.length === 0) return [];
    if (datePreset === "all") return expenses;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return expenses.filter((exp) => {
      const expTime = exp.expense_date
        ? new Date(exp.expense_date).getTime()
        : new Date(exp.created_at || "").getTime();
      if (isNaN(expTime)) return true;

      if (datePreset === "today") {
        return expTime >= startOfToday;
      } else if (datePreset === "week") {
        return expTime >= sevenDaysAgo;
      } else if (datePreset === "month") {
        return expTime >= thirtyDaysAgo;
      }
      return true;
    });
  }, [expenses, datePreset]);

  // Aggregated Financial Metrics & Top Profitable Dishes
  const analyticsData = useMemo(() => {
    const totalOrdersCount = filteredOrders.length;
    let totalGrossRevenue = 0;
    let totalTaxCollected = 0;
    let totalDiscountsGiven = 0;
    let totalNetFoodSales = 0;
    let totalCOGS = 0;
    let uncostedItemsFound = false;

    // Payment method counters
    let cashSales = 0;
    let cashCount = 0;
    let cardSales = 0;
    let cardCount = 0;
    let digitalSales = 0;
    let digitalCount = 0;

    // Order channel counters
    let dineInSales = 0;
    let dineInCount = 0;
    let takeawaySales = 0;
    let takeawayCount = 0;
    let deliverySales = 0;
    let deliveryCount = 0;

    // Per-dish aggregation
    const dishMap: Record<string, DishProfitItem> = {};

    filteredOrders.forEach((order) => {
      const gross = Number(order.total) || 0;
      const tax = Number(order.taxAmount) || 0;
      const disc = Number(order.discountAmount) || 0;
      const sub = Number(order.subtotal) || (gross - tax);

      totalGrossRevenue += gross;
      totalTaxCollected += tax;
      totalDiscountsGiven += disc;
      totalNetFoodSales += sub;

      // Payment method split
      const pm = (order.paymentMethod || "cash").toLowerCase();
      if (pm === "card") {
        cardSales += gross;
        cardCount += 1;
      } else if (pm === "raast" || pm === "online" || pm === "bank_transfer" || pm === "digital") {
        digitalSales += gross;
        digitalCount += 1;
      } else {
        cashSales += gross;
        cashCount += 1;
      }

      // Channel split
      const ch = (order.orderChannel || "dine_in").toLowerCase();
      if (ch === "takeaway") {
        takeawaySales += gross;
        takeawayCount += 1;
      } else if (ch === "delivery") {
        deliverySales += gross;
        deliveryCount += 1;
      } else {
        dineInSales += gross;
        dineInCount += 1;
      }

      // Line items COGS computation
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const qty = Number(item.quantity) || 1;
          const price = Number(item.price) || 0;
          const itemId = String(item.id || "");
          const cleanName = (item.name || "Special Item").trim();
          const cleanKey = cleanName.toLowerCase();

          // Resolve unit recipe cost
          const unitCost =
            recipeCostMap[itemId] !== undefined
              ? recipeCostMap[itemId]
              : dishNameCostMap[cleanKey] !== undefined
              ? dishNameCostMap[cleanKey]
              : 0;

          if (unitCost === 0) {
            uncostedItemsFound = true;
          }

          const lineCogs = unitCost * qty;
          totalCOGS += lineCogs;

          // Aggregate per dish
          if (!dishMap[cleanKey]) {
            dishMap[cleanKey] = {
              id: itemId,
              name: cleanName,
              unitsSold: 0,
              sellingPrice: price,
              unitCogs: unitCost,
              hasRecipe: unitCost > 0,
              totalRevenue: 0,
              totalCogs: 0,
              grossProfit: 0,
              marginPct: 0,
            };
          }

          dishMap[cleanKey].unitsSold += qty;
          dishMap[cleanKey].totalRevenue += price * qty;
          dishMap[cleanKey].totalCogs += lineCogs;
        });
      }
    });

    // Finalize dish profits & margins
    const dishList = Object.values(dishMap).map((d) => {
      const grossProfit = d.totalRevenue - d.totalCogs;
      const marginPct = d.totalRevenue > 0 ? (grossProfit / d.totalRevenue) * 100 : 0;
      return {
        ...d,
        grossProfit,
        marginPct,
      };
    });

    // Sort dishes by gross profit contribution descending
    dishList.sort((a, b) => b.grossProfit - a.grossProfit);

    // Compute OPEX and Category Breakdown
    let totalOperatingExpenses = 0;
    const categoryExpenseMap: Record<string, { total: number; count: number }> = {};

    filteredExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalOperatingExpenses += amt;
      const cat = exp.category || "Misc";
      if (!categoryExpenseMap[cat]) {
        categoryExpenseMap[cat] = { total: 0, count: 0 };
      }
      categoryExpenseMap[cat].total += amt;
      categoryExpenseMap[cat].count += 1;
    });

    const categoryExpenseList = Object.entries(categoryExpenseMap)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percent: totalOperatingExpenses > 0 ? (data.total / totalOperatingExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Compute gross profit & margin
    const grossProfit = totalNetFoodSales - totalCOGS;
    const grossMarginPct =
      totalNetFoodSales > 0 ? (grossProfit / totalNetFoodSales) * 100 : 0;

    // Compute Net Pure Profit and Net Margin %
    const netPureProfit = grossProfit - totalOperatingExpenses;
    const netMarginPct =
      totalNetFoodSales > 0 ? (netPureProfit / totalNetFoodSales) * 100 : 0;

    const cogsPercentOfRevenue =
      totalNetFoodSales > 0 ? (totalCOGS / totalNetFoodSales) * 100 : 0;
    const aov = totalOrdersCount > 0 ? totalGrossRevenue / totalOrdersCount : 0;

    return {
      totalOrdersCount,
      totalGrossRevenue,
      totalNetFoodSales,
      totalTaxCollected,
      totalDiscountsGiven,
      totalCOGS,
      grossProfit,
      grossMarginPct,
      totalOperatingExpenses,
      netPureProfit,
      netMarginPct,
      categoryExpenseList,
      cogsPercentOfRevenue,
      aov,
      cashSales,
      cashCount,
      cardSales,
      cardCount,
      digitalSales,
      digitalCount,
      dineInSales,
      dineInCount,
      takeawaySales,
      takeawayCount,
      deliverySales,
      deliveryCount,
      topDishes: dishList.slice(0, 8),
      uncostedItemsFound,
    };
  }, [filteredOrders, filteredExpenses, recipeCostMap, dishNameCostMap]);

  // Thermal Z-Report Print Handler
  const handlePrintZReport = () => {
    if (typeof window !== "undefined") {
      showToast("Printing Shift Financial Z-Report...");
      window.print();
    }
  };

  // Tax Authority Name based on user city
  const city = user?.city || "";
  const taxAuthorityName = /karachi|hyderabad|sukkur|larkana/i.test(city)
    ? "SRB (13%)"
    : /islamabad|rawalpindi|peshawar|quetta/i.test(city)
    ? "FBR (15%)"
    : "PRA (16%)";

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* Tier 1: Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            <DollarSign className="w-3.5 h-3.5" />
            FINANCIAL LEDGER &amp; P&amp;L PERFORMANCE
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Financials &amp;{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Analytics
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Live gross turnover, recipe-based COGS, and operational net profit margins.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Universal Date Preset Dropdown */}
          <div className="relative w-full sm:w-48">
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--text-hi)] text-xs font-mono rounded-xl pl-3 pr-8 py-2.5 h-10 focus:outline-none transition-all shadow-inner cursor-pointer"
            >
              {[
                { id: "today", label: "Today" },
                { id: "week", label: "7 Days" },
                { id: "month", label: "30 Days" },
                { id: "all", label: "All Time" },
              ].map((p) => (
                <option key={p.id} value={p.id} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            onClick={() => setIsShiftModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 h-10 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer shrink-0"
            title="Print Shift Z-Report & Reconcile Register"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span>Z-Report</span>
          </button>
        </div>
      </div>

      {/* Tier 2: Core KPI Metrics (5 Clean Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 w-full">
        {/* Card 1: Net Revenue */}
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:border-[var(--gold)]/30 min-w-0 w-full border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2.5 min-w-0">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase whitespace-normal leading-tight break-words">
                Net Revenue
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-[var(--text-lo)] shrink-0 select-none">
                Rs
              </span>
              <span className="text-2xl font-bold text-[var(--text-hi)] tracking-tight tabular-nums truncate">
                {analyticsData.totalNetFoodSales.toLocaleString()}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[11px] text-[var(--text-faint)] flex items-center justify-between gap-2 min-w-0">
              <span className="truncate">{analyticsData.totalOrdersCount} Orders</span>
              <span className="text-[var(--gold)] font-semibold shrink-0">
                Gross: Rs {analyticsData.totalGrossRevenue.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Inventory Used */}
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:border-amber-500/40 min-w-0 w-full border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2.5 min-w-0">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase whitespace-normal leading-tight break-words">
                Inventory Used
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-amber-400/70 shrink-0 select-none">
                Rs
              </span>
              <span className="text-2xl font-bold text-amber-400 tracking-tight tabular-nums truncate">
                {Math.round(analyticsData.totalCOGS).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[11px] text-[var(--text-faint)] flex items-center justify-between gap-2 min-w-0">
              <span className="truncate">Ingredients</span>
              <span className="font-semibold text-amber-400 shrink-0">
                {analyticsData.cogsPercentOfRevenue.toFixed(1)}% of sales
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Kitchen Profit */}
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:border-[#25d366]/40 min-w-0 w-full border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2.5 min-w-0">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase whitespace-normal leading-tight break-words">
                Kitchen Profit
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-[#25d366]/70 shrink-0 select-none">
                Rs
              </span>
              <span className="text-2xl font-bold text-[#25d366] tracking-tight tabular-nums truncate">
                {Math.round(analyticsData.grossProfit).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[11px] text-[var(--text-faint)] flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-semibold text-[#25d366] truncate">
                {analyticsData.grossMarginPct.toFixed(1)}% Margin
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Loss / Net Profit */}
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:border-emerald-500/40 min-w-0 w-full border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2.5 min-w-0">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase whitespace-normal leading-tight break-words">
                {analyticsData.netPureProfit >= 0 ? "Net Profit" : "Total Loss"}
              </span>
            </div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shrink-0 ${
                analyticsData.netPureProfit >= 0
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/15 border border-rose-500/30 text-rose-400"
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span
                className={`text-xs sm:text-sm font-semibold shrink-0 select-none ${
                  analyticsData.netPureProfit >= 0 ? "text-emerald-400/70" : "text-rose-400/70"
                }`}
              >
                Rs
              </span>
              <span
                className={`text-2xl font-bold tracking-tight tabular-nums truncate ${
                  analyticsData.netPureProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {Math.round(analyticsData.netPureProfit).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[11px] text-[var(--text-faint)] flex items-center justify-between gap-2 min-w-0">
              <span
                className={`text-xs font-semibold truncate ${
                  analyticsData.netPureProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {analyticsData.netPureProfit >= 0
                  ? `${analyticsData.netMarginPct.toFixed(1)}% Margin`
                  : "Net Loss"}
              </span>
              <span className="text-[var(--text-lo)] font-medium shrink-0 text-xs">
                OPEX: Rs {Math.round(analyticsData.totalOperatingExpenses).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Average Ticket Size */}
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:border-blue-500/40 min-w-0 w-full border border-[var(--border)] col-span-2 sm:col-span-2 lg:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between mb-2.5 min-w-0">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase whitespace-normal leading-tight break-words">
                Avg Ticket / Bill
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-[var(--text-lo)] shrink-0 select-none">
                Rs
              </span>
              <span className="text-2xl font-bold text-[var(--text-hi)] tracking-tight tabular-nums truncate">
                {Math.round(analyticsData.aov).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[11px] text-[var(--text-faint)] flex items-center justify-between gap-2 min-w-0">
              <span className="truncate">Per Order</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tier 3: Visual Breakdown Tables (Two-Column Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Tender & Channels Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tender Methods Split */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-hi)] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[var(--gold)]" />
                <span>Payment &amp; Tender Settlement</span>
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-lo)]">
                Rs {analyticsData.totalGrossRevenue.toLocaleString()} Total
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Cash Drawer */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-[var(--text-lo)]">
                    <Banknote className="w-3.5 h-3.5 text-[#25d366]" />
                    <span>Cash Drawer</span>
                  </span>
                  <div className="text-right font-mono">
                    <span className="font-bold text-[var(--text-hi)]">
                      Rs {analyticsData.cashSales.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)] ml-1.5">
                      ({analyticsData.cashCount} txns)
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#25d366] rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        analyticsData.totalGrossRevenue > 0
                          ? (analyticsData.cashSales / analyticsData.totalGrossRevenue) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Card / POS Terminals */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-[var(--text-lo)]">
                    <CreditCard className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Card / POS Terminals</span>
                  </span>
                  <div className="text-right font-mono">
                    <span className="font-bold text-[var(--text-hi)]">
                      Rs {analyticsData.cardSales.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)] ml-1.5">
                      ({analyticsData.cardCount} txns)
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--gold)] rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        analyticsData.totalGrossRevenue > 0
                          ? (analyticsData.cardSales / analyticsData.totalGrossRevenue) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Raast QR / Online */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 font-medium text-[var(--text-lo)]">
                    <QrCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>Online &amp; Raast QR</span>
                  </span>
                  <div className="text-right font-mono">
                    <span className="font-bold text-[var(--text-hi)]">
                      Rs {analyticsData.digitalSales.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)] ml-1.5">
                      ({analyticsData.digitalCount} txns)
                    </span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        analyticsData.totalGrossRevenue > 0
                          ? (analyticsData.digitalSales / analyticsData.totalGrossRevenue) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fulfillment Channels Split */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-hi)] flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-[var(--gold)]" />
                <span>Fulfillment Channels</span>
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-lo)]">
                {analyticsData.totalOrdersCount} Orders
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)]">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)] block">
                  Dine-In
                </span>
                <span className="text-base font-bold font-mono text-[var(--text-hi)] block mt-0.5">
                  {analyticsData.dineInCount}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-faint)]">
                  Rs {analyticsData.dineInSales.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)]">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)] block">
                  Takeaway
                </span>
                <span className="text-base font-bold font-mono text-[var(--text-hi)] block mt-0.5">
                  {analyticsData.takeawayCount}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-faint)]">
                  Rs {analyticsData.takeawaySales.toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)]">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)] block">
                  Delivery
                </span>
                <span className="text-base font-bold font-mono text-[var(--text-hi)] block mt-0.5">
                  {analyticsData.deliveryCount}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-faint)]">
                  Rs {analyticsData.deliverySales.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Overhead Expenses Split (OPEX) */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-hi)] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[var(--gold)]" />
                <span>Overhead Expenses Split (OPEX)</span>
              </h3>
              <span className="text-[11px] font-mono text-[var(--gold)] font-bold">
                Rs {Math.round(analyticsData.totalOperatingExpenses).toLocaleString()} Total
              </span>
            </div>

            {analyticsData.categoryExpenseList.length === 0 ? (
              <p className="text-xs text-[var(--text-lo)] font-mono py-2 text-center">
                No operating expenses logged for this period.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                {analyticsData.categoryExpenseList.map((item) => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 font-medium text-[var(--text-lo)]">
                        <Tag className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                        <span>{item.category}</span>
                        <span className="text-[10px] text-[var(--text-faint)] font-mono">
                          ({item.count} entries)
                        </span>
                      </span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-[var(--text-hi)]">
                          Rs {item.total.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[var(--text-faint)] ml-1.5 font-bold text-[var(--gold)]">
                          {item.percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#e3b13b] to-[#e04e17] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(2, item.percent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-lo)]">
              <span>Net Operating Profit</span>
              <span
                className={`font-bold ${
                  analyticsData.netPureProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {analyticsData.netPureProfit >= 0 ? "+" : ""}Rs{" "}
                {Math.round(analyticsData.netPureProfit).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Tax & Reconciliation Summary */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <h3 className="text-sm font-bold text-[var(--text-hi)] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#25d366]" />
                <span>Tax &amp; Legal Reconciliation</span>
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#25d366] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />
                <span>Register Balanced</span>
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[var(--text-lo)]">
                <span>Gross Revenue</span>
                <span>Rs {analyticsData.totalGrossRevenue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-lo)]">
                <span>Sales Tax ({taxAuthorityName})</span>
                <span className="text-[var(--gold)]">
                  Rs {analyticsData.totalTaxCollected.toLocaleString()}
                </span>
              </div>
              {analyticsData.totalDiscountsGiven > 0 && (
                <div className="flex items-center justify-between text-[#25d366]">
                  <span>Discounts Given</span>
                  <span>- Rs {analyticsData.totalDiscountsGiven.toLocaleString()}</span>
                </div>
              )}
              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between font-bold text-[var(--text-hi)]">
                <span>Net Food Sales</span>
                <span>Rs {analyticsData.totalNetFoodSales.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 Cols): Top Profitable Dishes */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-hi)] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#25d366]" />
                  <span>Top Profitable Dishes (Recipe-Linked COGS)</span>
                </h3>
                <p className="text-[11px] text-[var(--text-lo)] mt-0.5">
                  Gross profit contribution and recipe-costed net margins per dish
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--text-faint)]">
                {analyticsData.topDishes.length} items sold
              </span>
            </div>

            {/* Dishes Table */}
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-[var(--text-lo)]">
                <RefreshCw className="w-6 h-6 animate-spin text-[var(--gold)] mb-2" />
                <span className="text-xs font-mono">Computing recipe margins...</span>
              </div>
            ) : analyticsData.topDishes.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-[var(--text-lo)]">
                <UtensilsCrossed className="w-8 h-8 opacity-40 mb-2" />
                <span className="text-xs font-mono">No dish sales recorded for this period.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[10px] font-mono text-[var(--text-faint)] uppercase">
                      <th className="py-3 px-3 font-semibold">Dish</th>
                      <th className="py-3 px-2 font-semibold text-center">Qty</th>
                      <th className="py-3 px-2 font-semibold text-right">Price</th>
                      <th className="py-3 px-2 font-semibold text-right">Unit COGS</th>
                      <th className="py-3 px-2 font-semibold text-center">Margin</th>
                      <th className="py-3 px-3 font-semibold text-right">Total Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/40 font-mono">
                    {analyticsData.topDishes.map((dish, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 font-sans">
                          <span className="font-bold text-[var(--text-hi)] block text-xs">
                            {dish.name}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-[var(--text-hi)]">
                          {dish.unitsSold}
                        </td>
                        <td className="py-3 px-2 text-right text-[var(--text-lo)]">
                          Rs {dish.sellingPrice.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {dish.hasRecipe ? (
                            <span className="text-amber-400 font-semibold">
                              Rs {Math.round(dish.unitCogs).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--text-faint)] italic">
                              Uncosted
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {dish.hasRecipe ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                dish.marginPct >= 50
                                  ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {dish.marginPct.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-[var(--text-faint)]">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#25d366]">
                          Rs {Math.round(dish.grossProfit).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Helper Footnote for uncosted dishes */}
          {analyticsData.uncostedItemsFound && (
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-2 text-[11px] text-[var(--text-lo)]">
              <AlertCircle className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
              <span>Some dishes do not have recipes linked. COGS reflects costed items only.</span>
            </div>
          )}
        </div>
      </div>

      {/* Tier 4: Shift Settlements & Z-Report Audit Trail */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[var(--border)] space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-hi)]">
                Cash Drawer Settlements &amp; Z-Report Audit Trail
              </h3>
              <p className="text-[11px] font-mono text-[var(--text-lo)]">
                Shift reconciliation history and cashier end-of-day reports
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsShiftModalOpen(true)}
            className="btn-gold animate-sheen px-4 py-2 rounded-xl text-xs font-bold font-mono inline-flex items-center gap-2 cursor-pointer shadow-md self-start sm:self-auto"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>End Shift / Z-Report</span>
          </button>
        </div>

        {settlements.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-[var(--text-faint)] space-y-2">
            <Lock className="w-6 h-6 mx-auto opacity-40 text-[var(--gold)]" />
            <p>No shift settlements logged yet for this restaurant.</p>
            <p className="text-[10px]">Close a cashier register from POS to record the first Z-report.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10.5px] uppercase tracking-wider text-[var(--text-faint)]">
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Cashier</th>
                  <th className="py-2.5 px-3 text-right">Opening Float</th>
                  <th className="py-2.5 px-3 text-right">Cash Sales</th>
                  <th className="py-2.5 px-3 text-right">Expected Cash</th>
                  <th className="py-2.5 px-3 text-right">Actual Counted</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/40">
                {settlements.map((s, idx) => {
                  const floatAmt = Number(s.opening_float) || 0;
                  const cashSalesAmt = Number(s.system_cash_sales) || 0;
                  const expCash = floatAmt + cashSalesAmt;
                  const actCash = Number(s.actual_cash_counted) || 0;
                  const varAmt = Number(s.cash_variance) || 0;
                  const isBalanced = varAmt === 0;
                  const isSurplus = varAmt > 0;
                  const dateStr = s.shift_end || s.created_at;
                  const formattedDate = dateStr
                    ? new Date(dateStr).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Recent";

                  return (
                    <tr key={s.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3 font-semibold text-[var(--text-hi)]">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-lo)] font-sans font-medium">
                        {s.cashier_name || "Cashier"}
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--text-lo)]">
                        Rs {floatAmt.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-[#25d366] font-bold">
                        Rs {cashSalesAmt.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--gold)] font-bold">
                        Rs {expCash.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--text-hi)] font-black">
                        Rs {actCash.toLocaleString()}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-bold ${
                          isBalanced
                            ? "text-[#25d366]"
                            : isSurplus
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {varAmt >= 0 ? "+" : ""}Rs {varAmt.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === "FLAGGED"
                              ? "bg-red-500/15 text-red-400 border border-red-500/30"
                              : "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                          }`}
                        >
                          {s.status || "CLOSED"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shift Settlement & Z-Report Modal */}
      <ShiftSettlementModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        showToast={showToast}
        orders={orders}
        cashierName={user?.name || "Terminal Cashier"}
        onSettled={(newSettlement) => {
          setSettlements((prev) => [newSettlement, ...prev]);
        }}
      />
    </div>
  );
}
