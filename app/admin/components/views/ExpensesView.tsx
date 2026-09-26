"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  DollarSign,
  Calendar,
  CreditCard,
  Building2,
  RefreshCw,
  Wallet,
  Check,
  TrendingUp,
  Tag,
  FileText,
  User,
  ChevronDown,
} from "lucide-react";
import { OperatingExpense } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface ExpensesViewProps {
  showToast: (msg: string) => void;
}

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Maintenance",
  "Marketing",
  "Misc",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "ONLINE",
  "PETTY_CASH",
] as const;

export type ExpensePaymentMethod = (typeof PAYMENT_METHODS)[number];

export default function ExpensesView({ showToast }: ExpensesViewProps) {
  const { user } = useAuth();

  // Primary State
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<OperatingExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<OperatingExpense | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<string>("Utilities");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [formAmount, setFormAmount] = useState<string>("");
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("CASH");
  const [isCustomPayment, setIsCustomPayment] = useState(false);
  const [formExpenseDate, setFormExpenseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [formNotes, setFormNotes] = useState("");

  // Fetch expenses strictly from Supabase
  const fetchExpenses = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);

      const { data, error } = await supabase
        .from("operating_expenses")
        .select("*")
        .eq("restaurant_id", restId)
        .order("expense_date", { ascending: false });

      if (error) {
        console.warn("[ExpensesView] Supabase fetch error:", error.message);
      } else if (data) {
        const mapped: OperatingExpense[] = data.map((row: any) => ({
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
        setExpenses(mapped);
      }

      if (isManual) showToast("Expenses synchronized.");
    } catch (err) {
      console.error("[ExpensesView] Load error:", err);
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [user?.id, user?.organizationId]);

  // =========================================================================
  // QUICK STATS COMPUTATIONS (3 CARDS)
  // =========================================================================
  const { totalOpexThisMonth, topCategoryString, topCategoryName, topCatAmount, cashOutflowToday } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split("T")[0];

    let monthlySum = 0;
    let todayCashSum = 0;
    const catSpendMap: Record<string, number> = {};

    expenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      const expDate = exp.expense_date ? new Date(exp.expense_date) : new Date();

      // Check current month
      if (!isNaN(expDate.getTime())) {
        if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
          monthlySum += amt;
          catSpendMap[exp.category] = (catSpendMap[exp.category] || 0) + amt;
        }
      }

      // Check today's cash outflow
      const isToday = exp.expense_date === todayStr;
      const isCash = exp.payment_method === "CASH" || exp.payment_method === "PETTY_CASH";
      if (isToday && isCash) {
        todayCashSum += amt;
      }
    });

    // Determine top category
    let topCat = "None";
    let topCatAmount = 0;
    Object.entries(catSpendMap).forEach(([cat, val]) => {
      if (val > topCatAmount) {
        topCat = cat;
        topCatAmount = val;
      }
    });

    const topCategoryDisplay =
      topCatAmount > 0 ? `${topCat}: Rs ${topCatAmount.toLocaleString()}` : "None";

    return {
      totalOpexThisMonth: monthlySum,
      topCategoryString: topCategoryDisplay,
      topCategoryName: topCat,
      topCatAmount: topCatAmount,
      cashOutflowToday: todayCashSum,
    };
  }, [expenses]);

  // =========================================================================
  // FILTERED EXPENSES LIST
  // =========================================================================
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchCategory =
        selectedCategory === "All" ||
        exp.category.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        exp.title.toLowerCase().includes(q) ||
        (exp.notes && exp.notes.toLowerCase().includes(q)) ||
        exp.category.toLowerCase().includes(q) ||
        (exp.logged_by && exp.logged_by.toLowerCase().includes(q));

      return matchCategory && matchSearch;
    });
  }, [expenses, selectedCategory, searchQuery]);

  // Dynamic Categories with live item counts for dropdown
  const expenseCategoriesList = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();

    // Seed predefined categories
    EXPENSE_CATEGORIES.forEach((cat) => {
      map.set(cat.toLowerCase(), {
        id: cat,
        label: cat,
        count: 0,
      });
    });

    // Count and discover any additional categories in expenses
    expenses.forEach((exp) => {
      const catKey = (exp.category || "other").toLowerCase();
      if (map.has(catKey)) {
        map.get(catKey)!.count += 1;
      } else {
        const label = exp.category
          ? exp.category.charAt(0).toUpperCase() + exp.category.slice(1)
          : "Other";
        map.set(catKey, {
          id: exp.category,
          label,
          count: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [expenses]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingExpense(null);
    setFormTitle("");
    setFormCategory("Utilities");
    setIsCustomCategory(false);
    setFormAmount("");
    setFormPaymentMethod("CASH");
    setIsCustomPayment(false);
    setFormExpenseDate(new Date().toISOString().split("T")[0]);
    setFormNotes("");
    setIsRecordModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (exp: OperatingExpense) => {
    setEditingExpense(exp);
    setFormTitle(exp.title);
    const cat = exp.category || "Misc";
    setFormCategory(cat);
    setIsCustomCategory(!EXPENSE_CATEGORIES.includes(cat as any));
    setFormAmount(String(exp.amount));
    const pay = exp.payment_method || "CASH";
    setFormPaymentMethod(pay);
    setIsCustomPayment(!PAYMENT_METHODS.includes(pay as any));
    setFormExpenseDate(exp.expense_date || new Date().toISOString().split("T")[0]);
    setFormNotes(exp.notes || "");
    setIsRecordModalOpen(true);
  };

  // Save Expense (Create or Update)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast("Please enter an expense title.");
      return;
    }

    const numericAmount = parseFloat(formAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast("Please enter a valid expense amount greater than 0.");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);

      if (editingExpense) {
        // Update Existing
        const updatedExpense: OperatingExpense = {
          ...editingExpense,
          title: formTitle.trim(),
          category: formCategory,
          amount: numericAmount,
          payment_method: formPaymentMethod,
          expense_date: formExpenseDate,
          notes: formNotes.trim() || undefined,
        };

        setExpenses((prev) =>
          prev.map((item) => (item.id === editingExpense.id ? updatedExpense : item))
        );
        setIsRecordModalOpen(false);
        showToast(`Updated expense "${formTitle.trim()}".`);

        const { error } = await supabase
          .from("operating_expenses")
          .update({
            title: formTitle.trim(),
            category: formCategory,
            amount: numericAmount,
            payment_method: formPaymentMethod,
            expense_date: formExpenseDate,
            notes: formNotes.trim() || null,
          })
          .eq("id", editingExpense.id);

        if (error) console.warn("[ExpensesView] Supabase update error:", error.message);
      } else {
        // Create New
        const tempId = Date.now();
        const newExpense: OperatingExpense = {
          id: tempId,
          restaurant_id: restId,
          branch_id: branchId || null,
          title: formTitle.trim(),
          category: formCategory,
          amount: numericAmount,
          payment_method: formPaymentMethod,
          expense_date: formExpenseDate,
          logged_by: user?.name || "Admin",
          notes: formNotes.trim() || undefined,
          created_at: new Date().toISOString(),
        };

        setExpenses((prev) => [newExpense, ...prev]);
        setIsRecordModalOpen(false);
        showToast(`Recorded expense "${formTitle.trim()}".`);

        const { data, error } = await supabase
          .from("operating_expenses")
          .insert([
            {
              restaurant_id: restId,
              branch_id: branchId || null,
              title: formTitle.trim(),
              category: formCategory,
              amount: numericAmount,
              payment_method: formPaymentMethod,
              expense_date: formExpenseDate,
              logged_by: user?.name || "Admin",
              notes: formNotes.trim() || null,
            },
          ])
          .select()
          .single();

        if (error) {
          console.warn("[ExpensesView] Supabase insert error:", error.message);
        } else if (data) {
          setExpenses((prev) =>
            prev.map((item) => (item.id === tempId ? { ...item, id: data.id } : item))
          );
        }
      }
    } catch (err) {
      console.error("[ExpensesView] Save error:", err);
      showToast("Error saving operating expense.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    const target = expenseToDelete;
    setExpenseToDelete(null);

    setExpenses((prev) => prev.filter((item) => item.id !== target.id));
    showToast(`Deleted "${target.title}".`);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("operating_expenses")
        .delete()
        .eq("id", target.id);

      if (error) console.warn("[ExpensesView] Supabase delete error:", error.message);
    } catch (err) {
      console.error("[ExpensesView] Delete error:", err);
    }
  };

  // Category Badge Color Resolver
  const getCategoryBadgeClass = (category: string) => {
    switch (category.toLowerCase()) {
      case "rent":
        return "bg-purple-500/15 text-purple-400 border-purple-500/30";
      case "utilities":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      case "salaries":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "maintenance":
        return "bg-orange-500/15 text-orange-400 border-orange-500/30";
      case "marketing":
        return "bg-pink-500/15 text-pink-400 border-pink-500/30";
      default:
        return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
    }
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
            <Receipt className="w-3.5 h-3.5" />
            <span>OPERATIONAL EXPENDITURE (OPEX)</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Operational Expenses{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              (OPEX)
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Log non-food overheads, utilities, salaries, and daily maintenance
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="btn-gold animate-sheen px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* B. QUICK STATS BANNER (3 CARDS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 font-mono">
        {/* Card 1: Total OPEX This Month */}
        <div className="glass-panel p-3.5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[10px] sm:text-[11px] font-bold border border-[var(--gold)]/30">
              Monthly OPEX
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-2xl sm:text-4xl text-[var(--gold)] tracking-tight">
              Rs {totalOpexThisMonth.toLocaleString()}
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1">
              Total OPEX This Month
            </p>
          </div>
          <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Non-food operational costs</span>
            <span className="text-[var(--gold)]">{expenses.length} Logged</span>
          </div>
        </div>

        {/* Card 2: Top Expense Category */}
        <div className="glass-panel p-3.5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-mono text-[10px] sm:text-[11px] font-bold border border-amber-500/30">
              Top Outflow
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-xl sm:text-2xl lg:text-3xl text-[var(--text-hi)] tracking-tight flex items-baseline gap-1.5 flex-wrap min-w-0">
              {topCatAmount > 0 ? (
                <>
                  <span className="text-[var(--text-hi)] break-words">{topCategoryName}:</span>
                  <span className="text-amber-400 whitespace-nowrap font-mono font-extrabold">
                    Rs {topCatAmount.toLocaleString()}
                  </span>
                </>
              ) : (
                <span className="text-[var(--text-faint)]">None</span>
              )}
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1">
              Top Expense Category
            </p>
          </div>
          <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Highest expenditure this month</span>
            <span className="text-amber-400">P&amp;L Weighted</span>
          </div>
        </div>

        {/* Card 3: Cash Outflow Today */}
        <div className="glass-panel p-3.5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] font-mono text-[10px] sm:text-[11px] font-bold border border-[#25d366]/30">
              Today's Cash
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-2xl sm:text-4xl text-[#25d366] tracking-tight">
              Rs {cashOutflowToday.toLocaleString()}
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1">
              Cash Outflow Today
            </p>
          </div>
          <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Logged cash today</span>
            <span className="text-[#25d366]">Drawer Safe</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* C. FILTERS & SEARCH */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        {/* Categories Dropdown Filter */}
        <div className="relative w-full sm:w-64">
          <ResponsiveSelect
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            buttonClassName="h-10 text-xs font-mono font-bold text-[var(--text-hi)]"
            menuClassName="w-full sm:w-64"
            options={[
              { id: "All", label: "All Categories", count: expenses.length },
              ...expenseCategoriesList.map((cat) => ({
                id: cat.id,
                label: cat.label,
                count: cat.count > 0 ? cat.count : undefined,
              })),
            ]}
          />
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72 min-w-0">
          <Search className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search expenses..."
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-full pl-9 pr-4 py-1.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* D. EXPENSES TABLE */}
      {/* ========================================================================= */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[10px] uppercase font-mono text-[var(--text-faint)] py-3.5 px-4 font-semibold tracking-wider">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Title / Description</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Payment Mode</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Logged By</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-white tracking-wide mb-4">No expenses logged yet</h3>
                      <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] transition-transform"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Record Expense</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-white tracking-wide">No matching operating expenses</h3>
                      <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">Try adjusting your category filter or search query.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const badgeClass = getCategoryBadgeClass(exp.category);
                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 text-[var(--text-lo)] font-mono">
                        {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString() : "Today"}
                      </td>

                      {/* Title & Notes */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="font-sans font-bold text-[var(--text-hi)] text-xs">
                          {exp.title}
                        </div>
                        {exp.notes && (
                          <div
                            className="text-[11px] text-[var(--text-faint)] truncate font-sans mt-0.5"
                            title={exp.notes}
                          >
                            {exp.notes}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>{exp.category}</span>
                        </span>
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] text-[10px] font-semibold uppercase">
                          {exp.payment_method.replace("_", " ")}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-bold text-[var(--gold)] text-sm">
                        Rs {Number(exp.amount || 0).toLocaleString()}
                      </td>

                      {/* Logged By */}
                      <td className="py-3.5 px-4 text-[var(--text-lo)] font-sans text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-[var(--text-faint)]" />
                          <span>{exp.logged_by || "Admin"}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(exp)}
                            className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] transition-colors cursor-pointer"
                            title="Edit Expense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-red-500/20 text-[var(--text-lo)] hover:text-red-400 border border-[var(--border)] transition-colors cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD / EDIT OPERATING EXPENSE */}
      {/* ========================================================================= */}
      {isRecordModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsRecordModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl font-sans overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 sm:px-6 py-4 shrink-0 bg-[var(--surface-hi)]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-hi)] tracking-tight">
                    {editingExpense ? "Edit Operating Expense" : "Record Operating Expense"}
                  </h3>
                  <p className="text-xs text-[var(--text-lo)] mt-0.5">
                    Log overheads, utilities, salaries, and daily maintenance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveExpense} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs font-sans custom-scrollbar">
                {/* Expense Title */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Expense Title / Payee <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Electricity Bill - July or Kitchen Deep Clean"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  />
                </div>

                {/* Category & Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-[var(--text-lo)]">
                        Category <span className="text-red-400">*</span>
                      </label>
                      {isCustomCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(false);
                            setFormCategory(EXPENSE_CATEGORIES[0]);
                          }}
                          className="text-[11px] text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <X className="w-3 h-3" />
                          <span>Presets</span>
                        </button>
                      )}
                    </div>
                    {isCustomCategory ? (
                      <input
                        type="text"
                        autoFocus
                        required
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="e.g. Licensing, Equipment"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={formCategory}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setIsCustomCategory(true);
                              setFormCategory("");
                            } else {
                              setFormCategory(e.target.value);
                            }
                          }}
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                        >
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                              {cat}
                            </option>
                          ))}
                          <option value="__custom__" className="bg-[var(--bg-deep)] text-[var(--gold)] font-bold">
                            + Custom Category...
                          </option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Amount (Rs) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-[var(--gold)] pointer-events-none">
                        Rs
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[var(--text-hi)] font-mono font-bold text-[var(--gold)] focus:outline-none transition-all placeholder:text-[var(--text-lo)]/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method & Expense Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-[var(--text-lo)]">
                        Payment Mode
                      </label>
                      {isCustomPayment && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomPayment(false);
                            setFormPaymentMethod("CASH");
                          }}
                          className="text-[11px] text-[var(--gold)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <X className="w-3 h-3" />
                          <span>Presets</span>
                        </button>
                      )}
                    </div>
                    {isCustomPayment ? (
                      <input
                        type="text"
                        autoFocus
                        required
                        value={formPaymentMethod}
                        onChange={(e) => setFormPaymentMethod(e.target.value)}
                        placeholder="e.g. Corporate Card, Bank Wire"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={formPaymentMethod}
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setIsCustomPayment(true);
                              setFormPaymentMethod("");
                            } else {
                              setFormPaymentMethod(e.target.value);
                            }
                          }}
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                        >
                          <option value="CASH" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">CASH (Physical Cash)</option>
                          <option value="PETTY_CASH" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">PETTY CASH (Till Float)</option>
                          <option value="BANK_TRANSFER" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">BANK TRANSFER (Online / IBFT)</option>
                          <option value="ONLINE" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">ONLINE (Card / Gateway)</option>
                          <option value="__custom__" className="bg-[var(--bg-deep)] text-[var(--gold)] font-bold">
                            + Custom Payment Mode...
                          </option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                      Expense Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formExpenseDate}
                      onChange={(e) => setFormExpenseDate(e.target.value)}
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Description / Receipt Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Invoice reference #48291, vendor payout..."
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl p-3.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans resize-none"
                  />
                </div>
              </div>

              {/* Modal Action Buttons Footer */}
              <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border)] flex items-center justify-end gap-2.5 shrink-0 bg-[var(--bg-deep)]">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform disabled:opacity-50"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{editingExpense ? "Update Expense" : "Record Expense"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {expenseToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpenseToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl sm:rounded-3xl bg-[var(--bg-deep)] border border-red-500/40 p-6 space-y-4 font-sans text-xs shadow-2xl my-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-400">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-hi)]">Delete Expense?</h3>
              </div>
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="w-7 h-7 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[var(--text-lo)] font-mono">
              Are you sure you want to delete &quot;{expenseToDelete.title}&quot; (Rs{" "}
              {Number(expenseToDelete.amount || 0).toLocaleString()})? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] text-[var(--text-lo)] hover:bg-[var(--surface)] font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteExpense}
                className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold cursor-pointer transition-all"
              >
                Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
