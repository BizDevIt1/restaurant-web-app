"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  Eye,
  X,
  Building2,
  Store,
  Layers,
  ChevronDown,
  ChevronRight,
  MapPin,
  GitFork,
  Check,
} from "lucide-react";
import { usePlatformCurrency } from "@/lib/currency";
import { createClient } from "@/lib/supabase";

export interface SubBranchRecord {
  id: string;
  branchIndex: number;
  name: string;
  address: string;
  city: string;
  phone?: string;
  status: "Completed" | "Processing" | "Expiring" | "Failed";
  shareAmount: number;
  invoiceRef: string;
  isMainHq?: boolean;
}

export interface PaymentRecord {
  id: string;
  refId: string;
  restaurantId?: string;
  restaurant: string;
  branch: string;
  city: string;
  merchantCategory: "standalone" | "franchise";
  outlets: number;
  planTier: string;
  billingCycle: "Monthly" | "Annual";
  gateway: "JazzCash" | "EasyPaisa" | "Stripe" | "Bank Transfer";
  rawAmount: number;
  rawFee: number;
  rawNet: number;
  date: string;
  nextInvoice: string;
  status: "Completed" | "Processing" | "Expiring" | "Failed";
  accountRef?: string;
  invoiceNumber: string;
  branches: SubBranchRecord[];
}

interface PaymentsViewProps {
  showToast: (msg: string) => void;
}

// Fallback seed payments for zero-flicker UI
const FALLBACK_SEED_PAYMENTS: PaymentRecord[] = [
  {
    id: "pay-1",
    refId: "JC-98421039",
    restaurantId: "1",
    restaurant: "Salt'n Pepper Village",
    branch: "Main Boulevard, Gulberg III",
    city: "Lahore",
    merchantCategory: "franchise",
    outlets: 3,
    planTier: "Enterprise Plus",
    billingCycle: "Monthly",
    gateway: "JazzCash",
    rawAmount: 89,
    rawFee: 2.2,
    rawNet: 86.8,
    date: "Sep 16, 2026",
    nextInvoice: "Oct 16, 2026",
    status: "Completed",
    accountRef: "0300-4829104",
    invoiceNumber: "INV-2026-0901",
    branches: [
      {
        id: "pay-1-b1",
        branchIndex: 1,
        name: "Salt'n Pepper Gulberg (Main)",
        address: "Main Boulevard, Gulberg III, Lahore",
        city: "Lahore",
        status: "Completed",
        shareAmount: 29.67,
        invoiceRef: "INV-BR-9011",
        isMainHq: true,
      },
      {
        id: "pay-1-b2",
        branchIndex: 2,
        name: "Salt'n Pepper Mall Road",
        address: "Shahrah-e-Quaid-e-Azam, Lahore",
        city: "Lahore",
        status: "Completed",
        shareAmount: 29.67,
        invoiceRef: "INV-BR-9012",
      },
      {
        id: "pay-1-b3",
        branchIndex: 3,
        name: "Salt'n Pepper DHA Phase 5",
        address: "Sector CCA, Phase 5 DHA, Lahore",
        city: "Lahore",
        status: "Completed",
        shareAmount: 29.66,
        invoiceRef: "INV-BR-9013",
      },
    ],
  },
  {
    id: "pay-2",
    refId: "EP-44102911",
    restaurantId: "2",
    restaurant: "Kolachi Oceanfront",
    branch: "Do Darya, Phase 8 DHA",
    city: "Karachi",
    merchantCategory: "franchise",
    outlets: 4,
    planTier: "Enterprise Plus",
    billingCycle: "Annual",
    gateway: "EasyPaisa",
    rawAmount: 899,
    rawFee: 18.5,
    rawNet: 880.5,
    date: "Sep 15, 2026",
    nextInvoice: "Sep 15, 2027",
    status: "Completed",
    accountRef: "0345-9921043",
    invoiceNumber: "INV-2026-0899",
    branches: [
      {
        id: "pay-2-b1",
        branchIndex: 1,
        name: "Kolachi Do Darya (Main)",
        address: "Do Darya Waterfront, Karachi",
        city: "Karachi",
        status: "Completed",
        shareAmount: 224.75,
        invoiceRef: "INV-BR-8991",
        isMainHq: true,
      },
      {
        id: "pay-2-b2",
        branchIndex: 2,
        name: "Kolachi Port Grand",
        address: "Port Grand Promenade, Karachi",
        city: "Karachi",
        status: "Completed",
        shareAmount: 224.75,
        invoiceRef: "INV-BR-8992",
      },
      {
        id: "pay-2-b3",
        branchIndex: 3,
        name: "Kolachi North Nazimabad",
        address: "Block B, North Nazimabad, Karachi",
        city: "Karachi",
        status: "Completed",
        shareAmount: 224.75,
        invoiceRef: "INV-BR-8993",
      },
      {
        id: "pay-2-b4",
        branchIndex: 4,
        name: "Kolachi Clifton Ocean Mall",
        address: "Clifton Block 9, Karachi",
        city: "Karachi",
        status: "Completed",
        shareAmount: 224.75,
        invoiceRef: "INV-BR-8994",
      },
    ],
  },
  {
    id: "pay-3",
    refId: "STR-8831002",
    restaurantId: "3",
    restaurant: "Howdy Gourmet Burgers",
    branch: "F-7 Markaz, Jinnah Super",
    city: "Islamabad",
    merchantCategory: "standalone",
    outlets: 1,
    planTier: "Fresher Plan",
    billingCycle: "Monthly",
    gateway: "Stripe",
    rawAmount: 39,
    rawFee: 1.45,
    rawNet: 37.55,
    date: "Sep 14, 2026",
    nextInvoice: "Oct 14, 2026",
    status: "Completed",
    accountRef: "VISA ···· 4821",
    invoiceNumber: "INV-2026-0874",
    branches: [
      {
        id: "pay-3-b1",
        branchIndex: 1,
        name: "Howdy Gourmet Burgers (Main Outlet)",
        address: "F-7 Markaz, Jinnah Super, Islamabad",
        city: "Islamabad",
        status: "Completed",
        shareAmount: 39,
        invoiceRef: "INV-BR-8741",
        isMainHq: true,
      },
    ],
  },
  {
    id: "pay-4",
    refId: "BNK-6671029",
    restaurantId: "4",
    restaurant: "Bundu Khan Traditional",
    branch: "Liberty Market, Gulberg",
    city: "Lahore",
    merchantCategory: "franchise",
    outlets: 3,
    planTier: "Enterprise Plus",
    billingCycle: "Monthly",
    gateway: "Bank Transfer",
    rawAmount: 89,
    rawFee: 2.5,
    rawNet: 86.5,
    date: "Sep 13, 2026",
    nextInvoice: "Sep 20, 2026",
    status: "Expiring",
    accountRef: "HBL - 00421098412",
    invoiceNumber: "INV-2026-0862",
    branches: [
      {
        id: "pay-4-b1",
        branchIndex: 1,
        name: "Bundu Khan Liberty (Main)",
        address: "Liberty Market, Gulberg III, Lahore",
        city: "Lahore",
        status: "Expiring",
        shareAmount: 29.67,
        invoiceRef: "INV-BR-8621",
        isMainHq: true,
      },
      {
        id: "pay-4-b2",
        branchIndex: 2,
        name: "Bundu Khan Fortress Stadium",
        address: "Fortress Stadium, Cantt, Lahore",
        city: "Lahore",
        status: "Expiring",
        shareAmount: 29.67,
        invoiceRef: "INV-BR-8622",
      },
      {
        id: "pay-4-b3",
        branchIndex: 3,
        name: "Bundu Khan Johar Town",
        address: "Main Boulevard, Johar Town, Lahore",
        city: "Lahore",
        status: "Expiring",
        shareAmount: 29.66,
        invoiceRef: "INV-BR-8623",
      },
    ],
  },
  {
    id: "pay-5",
    refId: "JC-98421088",
    restaurantId: "5",
    restaurant: "Espresso Coffee Lounge",
    branch: "Clifton Block 4",
    city: "Karachi",
    merchantCategory: "standalone",
    outlets: 1,
    planTier: "Free Tier",
    billingCycle: "Monthly",
    gateway: "JazzCash",
    rawAmount: 0,
    rawFee: 0,
    rawNet: 0,
    date: "Sep 12, 2026",
    nextInvoice: "Oct 12, 2026",
    status: "Completed",
    accountRef: "0301-8745211",
    invoiceNumber: "INV-2026-0850",
    branches: [
      {
        id: "pay-5-b1",
        branchIndex: 1,
        name: "Espresso Coffee Lounge (Main)",
        address: "Clifton Block 4, Karachi",
        city: "Karachi",
        status: "Completed",
        shareAmount: 0,
        invoiceRef: "INV-BR-8501",
        isMainHq: true,
      },
    ],
  },
  {
    id: "pay-6",
    refId: "STR-9910023",
    restaurantId: "6",
    restaurant: "Monal Heights Restaurant",
    branch: "Pir Sohawa, Margalla Hills",
    city: "Islamabad",
    merchantCategory: "franchise",
    outlets: 2,
    planTier: "Enterprise Plus",
    billingCycle: "Annual",
    gateway: "Stripe",
    rawAmount: 899,
    rawFee: 19.2,
    rawNet: 879.8,
    date: "Sep 10, 2026",
    nextInvoice: "Sep 10, 2027",
    status: "Completed",
    accountRef: "MasterCard ···· 1109",
    invoiceNumber: "INV-2026-0839",
    branches: [
      {
        id: "pay-6-b1",
        branchIndex: 1,
        name: "Monal Pir Sohawa (HQ)",
        address: "Pir Sohawa Margalla Hills, Islamabad",
        city: "Islamabad",
        status: "Completed",
        shareAmount: 449.5,
        invoiceRef: "INV-BR-8391",
        isMainHq: true,
      },
      {
        id: "pay-6-b2",
        branchIndex: 2,
        name: "Monal Downtown Rawalpindi",
        address: "Murree Road, Saddar, Rawalpindi",
        city: "Rawalpindi",
        status: "Completed",
        shareAmount: 449.5,
        invoiceRef: "INV-BR-8392",
      },
    ],
  },
  {
    id: "pay-7",
    refId: "EP-55091234",
    restaurantId: "7",
    restaurant: "Burger O'Clock Hub",
    branch: "Gulshan-e-Iqbal Block 13D",
    city: "Karachi",
    merchantCategory: "standalone",
    outlets: 1,
    planTier: "Free Tier",
    billingCycle: "Monthly",
    gateway: "EasyPaisa",
    rawAmount: 0,
    rawFee: 0,
    rawNet: 0,
    date: "Sep 08, 2026",
    nextInvoice: "Sep 08, 2026",
    status: "Failed",
    accountRef: "0342-1109844",
    invoiceNumber: "INV-2026-0812",
    branches: [
      {
        id: "pay-7-b1",
        branchIndex: 1,
        name: "Burger O'Clock Gulshan",
        address: "Gulshan-e-Iqbal Block 13D, Karachi",
        city: "Karachi",
        status: "Failed",
        shareAmount: 0,
        invoiceRef: "INV-BR-8121",
        isMainHq: true,
      },
    ],
  },
  {
    id: "pay-8",
    refId: "BNK-7719201",
    restaurantId: "8",
    restaurant: "Tehzeeb Bakers & Cafe",
    branch: "Blue Area, Jinnah Avenue",
    city: "Islamabad",
    merchantCategory: "standalone",
    outlets: 1,
    planTier: "Fresher Plan",
    billingCycle: "Monthly",
    gateway: "Bank Transfer",
    rawAmount: 39,
    rawFee: 1.2,
    rawNet: 37.8,
    date: "Sep 05, 2026",
    nextInvoice: "Oct 05, 2026",
    status: "Completed",
    accountRef: "Meezan - 0109482910",
    invoiceNumber: "INV-2026-0790",
    branches: [
      {
        id: "pay-8-b1",
        branchIndex: 1,
        name: "Tehzeeb Bakers Blue Area",
        address: "Blue Area, Jinnah Avenue, Islamabad",
        city: "Islamabad",
        status: "Completed",
        shareAmount: 39,
        invoiceRef: "INV-BR-7901",
        isMainHq: true,
      },
    ],
  },
];

export interface PlanPricingMeta {
  price: number;
  pricingModel: "flat" | "per_branch";
  interval: string;
}

function resolvePlanMeta(
  planTier: string,
  plansMap: Record<string, PlanPricingMeta>,
  isFranchise: boolean
): PlanPricingMeta {
  const normalized = planTier.trim().toLowerCase();

  if (plansMap[normalized]) {
    return plansMap[normalized];
  }

  // Check fuzzy / partial matching in plansMap
  for (const [key, meta] of Object.entries(plansMap)) {
    if (key && (normalized.includes(key) || key.includes(normalized))) {
      return meta;
    }
  }

  // Explicit Free tier check
  if (normalized.includes("free")) {
    return {
      price: 0,
      pricingModel: "flat",
      interval: "Monthly",
    };
  }

  // Standard fallback defaults
  if (normalized.includes("enterprise") || normalized.includes("franchise")) {
    return {
      price: isFranchise ? 89 : 49,
      pricingModel: isFranchise ? "per_branch" : "flat",
      interval: "Monthly",
    };
  }
  if (normalized.includes("fresher") || normalized.includes("growth") || normalized.includes("pro")) {
    return {
      price: 39,
      pricingModel: "flat",
      interval: "Monthly",
    };
  }
  if (normalized.includes("starter") || normalized.includes("basic")) {
    return {
      price: 29,
      pricingModel: "flat",
      interval: "Monthly",
    };
  }

  return {
    price: 0,
    pricingModel: "flat",
    interval: "Monthly",
  };
}

/**
 * Convert raw DB restaurant row into clean structured PaymentRecord
 * Strictly preserves only the real branches present in the database!
 */
function convertRestaurantToPaymentRecord(row: any, plansMap: Record<string, PlanPricingMeta>): PaymentRecord {
  const brandName = String(row.brand_name || "Untitled Restaurant").trim();
  const city = String(row.city || "Lahore").trim();
  const hqAddress = String(row.hq_address || "Main Branch").trim();
  const planTier = String(row.assigned_plan || "Fresher Plan").trim();
  const rawStatus = String(row.initial_status || "Active").toLowerCase();

  // Parse branches strictly from row data
  let rawBranches = row.branches;
  if (typeof rawBranches === "string") {
    try {
      const parsed = JSON.parse(rawBranches);
      if (Array.isArray(parsed) || typeof parsed === "object") {
        rawBranches = parsed;
      }
    } catch {
      if (rawBranches.includes(",")) {
        rawBranches = rawBranches.split(",").map((s: string) => s.trim()).filter(Boolean);
      } else if (rawBranches.trim()) {
        rawBranches = [{ name: rawBranches.trim() }];
      }
    }
  }

  let hasFranchiseFlag = Boolean(
    row.is_multi_branch === true ||
    row.outlet_type === "multi" ||
    row.franchise === true ||
    brandName.toLowerCase().includes("franchise") ||
    brandName.toLowerCase().includes("frenchise")
  );

  const parsedBranches: SubBranchRecord[] = [];

  if (Array.isArray(rawBranches) && rawBranches.length > 0) {
    rawBranches.forEach((b: any, idx: number) => {
      let bName = "";
      let bAddress = "";
      let bCity = city;

      if (typeof b === "object" && b !== null) {
        if (b.type === "franchise" || b.is_franchise || b.outlet_type === "multi") {
          hasFranchiseFlag = true;
        }
        bName = b.name || b.branch_name || b.branch || "";
        bAddress = b.address || b.location || hqAddress;
        bCity = b.city || city;
      } else if (typeof b === "string" && b.trim()) {
        bName = b.trim();
        bAddress = hqAddress;
      }

      if (!bName) {
        bName = idx === 0 ? `${brandName} (Main Branch)` : `${brandName} Branch ${idx + 1}`;
      } else if (idx === 0 && !bName.includes("Main") && !bName.includes("HQ") && !bName.includes("Flagship") && rawBranches.length > 1) {
        bName = `${bName} (Main Branch)`;
      }

      const branchIndex = idx + 1;
      const hash = Math.abs(
        (String(row.id || brandName) + bName).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + idx * 43
      );

      parsedBranches.push({
        id: `${row.id || "rest"}-branch-${branchIndex}`,
        branchIndex,
        name: bName,
        address: bAddress || `${brandName} Location ${branchIndex}`,
        city: bCity,
        status: rawStatus === "suspended" ? "Failed" : rawStatus === "pending" ? "Processing" : "Completed",
        shareAmount: 0,
        invoiceRef: `INV-BR-${(hash % 9000) + 1000}`,
        isMainHq: idx === 0,
      });
    });
  }

  // If no branches were explicitly added in branches array, default to the 1 main branch
  if (parsedBranches.length === 0) {
    parsedBranches.push({
      id: `${row.id || "rest"}-branch-1`,
      branchIndex: 1,
      name: `${brandName} (Main Branch)`,
      address: hqAddress || `${brandName}, ${city}`,
      city: city,
      status: rawStatus === "suspended" ? "Failed" : "Completed",
      shareAmount: 0,
      invoiceRef: `INV-BR-${(Math.abs(Number(row.id) || 1) * 211) % 9000 + 1000}`,
      isMainHq: true,
    });
  }

  // A merchant is a Franchise Owner if marked as multi/franchise OR if it has multiple branches
  const isFranchise = hasFranchiseFlag || parsedBranches.length > 1;
  const merchantCategory: "standalone" | "franchise" = isFranchise ? "franchise" : "standalone";
  const outlets = parsedBranches.length;

  // Determine pricing based on live subscription plans or restaurant row values
  const planMeta = resolvePlanMeta(planTier, plansMap, isFranchise);

  let unitRate = planMeta.price;
  if (row.subscription_fee !== undefined && row.subscription_fee !== null && !isNaN(Number(row.subscription_fee))) {
    unitRate = Number(row.subscription_fee);
  } else if (row.plan_price !== undefined && row.plan_price !== null && !isNaN(Number(row.plan_price))) {
    unitRate = Number(row.plan_price);
  } else if (row.price !== undefined && row.price !== null && !isNaN(Number(row.price))) {
    unitRate = Number(row.price);
  } else if (row.raw_price !== undefined && row.raw_price !== null && !isNaN(Number(row.raw_price))) {
    unitRate = Number(row.raw_price);
  }

  const isPerBranch = planMeta.pricingModel === "per_branch" || row.pricing_model === "per_branch" || row.pricingModel === "per_branch";
  const rawAmount = isPerBranch ? unitRate * Math.max(1, outlets) : unitRate;
  const rawFee = Number((rawAmount * 0.025).toFixed(2));
  const rawNet = Number((rawAmount - rawFee).toFixed(2));

  // Distribute share amount across sub-branches
  const splitShare = outlets > 0 ? Number((rawAmount / outlets).toFixed(2)) : rawAmount;
  parsedBranches.forEach((b) => {
    b.shareAmount = splitShare;
  });

  const isAnnual = String(row.billing_cycle || row.interval || planMeta.interval || "").toLowerCase().includes("annual") || (isFranchise && rawAmount > 100);
  const billingCycle: "Monthly" | "Annual" = isAnnual ? "Annual" : "Monthly";

  const gateways: ("JazzCash" | "EasyPaisa" | "Stripe" | "Bank Transfer")[] = [
    "JazzCash",
    "EasyPaisa",
    "Stripe",
    "Bank Transfer",
  ];
  const gatewayIdx = Math.abs((String(row.id || "0") + brandName).length) % gateways.length;
  const gateway = gateways[gatewayIdx];

  const hashNum = Math.abs(
    (String(row.id || "0") + brandName).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17
  );
  const refPrefix = gateway === "JazzCash" ? "JC" : gateway === "EasyPaisa" ? "EP" : gateway === "Stripe" ? "STR" : "BNK";
  const refId = `${refPrefix}-${(hashNum % 90000000) + 10000000}`;
  const invoiceNumber = `INV-2026-${(hashNum % 9000) + 1000}`;

  const createdDate = row.created_at
    ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Sep 16, 2026";

  let status: PaymentRecord["status"] = "Completed";
  if (rawStatus === "suspended" || rawStatus === "deactivated") {
    status = "Failed";
  } else if (rawStatus === "pending") {
    status = "Processing";
  }

  return {
    id: `pay-${row.id || Math.random().toString().slice(2, 8)}`,
    refId,
    restaurantId: String(row.id),
    restaurant: brandName,
    branch: hqAddress || parsedBranches[0]?.name || "Main Branch",
    city,
    merchantCategory,
    outlets,
    planTier,
    billingCycle,
    gateway,
    rawAmount,
    rawFee,
    rawNet,
    date: createdDate,
    nextInvoice: isAnnual ? "Sep 16, 2027" : "Oct 16, 2026",
    status,
    invoiceNumber,
    branches: parsedBranches,
  };
}

const STORAGE_CACHE_KEY = "omni_published_payments_data";
const RESTAURANTS_CACHE_KEY = "sa_restaurants";

export default function PaymentsView({ showToast }: PaymentsViewProps) {
  const { formatPrice, symbol } = usePlatformCurrency();
  const [payments, setPayments] = useState<PaymentRecord[]>(FALLBACK_SEED_PAYMENTS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tabs: "all" | "standalone" | "franchise"
  const [activeTab, setActiveTab] = useState<"all" | "standalone" | "franchise">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Accordion state: Set of Franchise Payment IDs that are expanded (empty by default so sub-branches are collapsed on load)
  const [expandedFranchises, setExpandedFranchises] = useState<Set<string>>(new Set());

  // Selected payment or sub-branch for invoice details modal
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [selectedSubBranch, setSelectedSubBranch] = useState<{
    parent: PaymentRecord;
    branch: SubBranchRecord;
  } | null>(null);

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // New manual payment record state
  const [newPayment, setNewPayment] = useState({
    restaurant: "",
    branch: "",
    merchantCategory: "standalone" as "standalone" | "franchise",
    outlets: "1",
    planTier: "Fresher Plan",
    billingCycle: "Monthly" as "Monthly" | "Annual",
    gateway: "JazzCash" as const,
    amount: "",
  });

  // Close status dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleFranchise = (id: string) => {
    setExpandedFranchises((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllFranchises = () => {
    const franchiseIds = payments.filter((p) => p.merchantCategory === "franchise").map((p) => p.id);
    const allExpanded = franchiseIds.length > 0 && franchiseIds.every((id) => expandedFranchises.has(id));
    if (allExpanded) {
      setExpandedFranchises(new Set());
    } else {
      setExpandedFranchises(new Set(franchiseIds));
    }
  };

  // Fetch real-time restaurants and plans from APIs & local sync
  const fetchLivePaymentData = useCallback(async () => {
    try {
      const plansMap: Record<string, PlanPricingMeta> = {
        "free": { price: 0, pricingModel: "flat", interval: "Monthly" },
        "free tier": { price: 0, pricingModel: "flat", interval: "Monthly" },
        "free tair": { price: 0, pricingModel: "flat", interval: "Monthly" },
        "starter pos": { price: 29, pricingModel: "flat", interval: "Monthly" },
        "starter tier": { price: 19, pricingModel: "flat", interval: "Monthly" },
        "growth pro": { price: 49, pricingModel: "flat", interval: "Annual" },
        "growth tier": { price: 39, pricingModel: "flat", interval: "Monthly" },
        "fresher plan": { price: 39, pricingModel: "flat", interval: "Monthly" },
        "enterprise plus": { price: 89, pricingModel: "per_branch", interval: "Monthly" },
        "enterprise multi-branch": { price: 29, pricingModel: "per_branch", interval: "Monthly" },
        "franchise enterprise": { price: 89, pricingModel: "per_branch", interval: "Monthly" },
      };

      // 1. Read locally cached plans first for zero-latency
      try {
        const localPlansRaw = localStorage.getItem("omni_published_plans") || sessionStorage.getItem("subscription_plans");
        if (localPlansRaw) {
          const parsed = JSON.parse(localPlansRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((p: any) => {
              const name = String(p.name || p.title || "").trim().toLowerCase();
              if (name) {
                let priceNum = 0;
                if (typeof p.rawPrice === "number") priceNum = p.rawPrice;
                else if (typeof p.price === "number") priceNum = p.price;
                else if (p.price) {
                  const val = parseFloat(String(p.price).replace(/[^0-9.]/g, ""));
                  priceNum = isNaN(val) ? 0 : val;
                }
                const pModel = String(p.pricing_model || p.pricingModel || "").toLowerCase().includes("branch") ? "per_branch" : "flat";
                const pInterval = String(p.interval || p.billingCycle || "Monthly");
                plansMap[name] = { price: priceNum, pricingModel: pModel, interval: pInterval };
              }
            });
          }
        }
      } catch {}

      // 2. Fetch fresh plans from server API
      try {
        const plansRes = await fetch(`/api/super-admin/plans?t=${Date.now()}`, { cache: "no-store" });
        if (plansRes.ok) {
          const plansData = await plansRes.json();
          if (plansData.plans && Array.isArray(plansData.plans)) {
            plansData.plans.forEach((p: any) => {
              const name = String(p.name || p.title || "").trim().toLowerCase();
              if (name) {
                let priceNum = 0;
                if (typeof p.rawPrice === "number") priceNum = p.rawPrice;
                else if (typeof p.price === "number") priceNum = p.price;
                else if (p.price) {
                  const val = parseFloat(String(p.price).replace(/[^0-9.]/g, ""));
                  priceNum = isNaN(val) ? 0 : val;
                }
                const pModel = String(p.pricing_model || p.pricingModel || "").toLowerCase().includes("branch") ? "per_branch" : "flat";
                const pInterval = String(p.interval || p.billingCycle || "Monthly");
                plansMap[name] = { price: priceNum, pricingModel: pModel, interval: pInterval };
              }
            });
          }
        }
      } catch {}

      // 3. Fetch live restaurants
      const res = await fetch(`/api/super-admin/restaurants?t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.restaurants && Array.isArray(data.restaurants) && data.restaurants.length > 0) {
          const dynamicRecords = data.restaurants.map((row: any) =>
            convertRestaurantToPaymentRecord(row, plansMap)
          );

          try {
            const customSaved = localStorage.getItem("omni_custom_manual_payments");
            if (customSaved) {
              const parsedCustom = JSON.parse(customSaved);
              if (Array.isArray(parsedCustom)) {
                dynamicRecords.unshift(...parsedCustom);
              }
            }
          } catch {}

          setPayments(dynamicRecords);

          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(dynamicRecords));
            } catch {}
          }
          return;
        }
      }

      // Fallback to local restaurants cache if server is offline
      const localRests = localStorage.getItem(RESTAURANTS_CACHE_KEY);
      if (localRests) {
        const parsed = JSON.parse(localRests);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const converted = parsed.map((r: any) => convertRestaurantToPaymentRecord(r, plansMap));
          setPayments(converted);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch live payments from restaurants API:", err);
    }
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPayments(parsed);
        }
      }
    } catch {}

    fetchLivePaymentData();

    try {
      const supabase = createClient();
      const channel = supabase
        .channel("realtime-payments-restaurants")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "restaurants" },
          () => {
            fetchLivePaymentData();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscription_plans" },
          () => {
            fetchLivePaymentData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn("Supabase realtime subscription failed for payments:", e);
    }
  }, [fetchLivePaymentData]);

  useEffect(() => {
    let bcRest: BroadcastChannel | null = null;
    let bcPlans: BroadcastChannel | null = null;

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bcRest = new BroadcastChannel("omni_restaurants_sync");
        bcRest.onmessage = () => {
          fetchLivePaymentData();
        };

        bcPlans = new BroadcastChannel("omni_plans_sync");
        bcPlans.onmessage = () => {
          fetchLivePaymentData();
        };
      } catch {}
    }

    const handleCustomSync = () => {
      fetchLivePaymentData();
    };

    window.addEventListener("sa_restaurants_updated", handleCustomSync);
    window.addEventListener("omni_restaurants_updated", handleCustomSync);
    window.addEventListener("omni_plans_updated", handleCustomSync);
    window.addEventListener("storage", handleCustomSync);

    return () => {
      if (bcRest) bcRest.close();
      if (bcPlans) bcPlans.close();
      window.removeEventListener("sa_restaurants_updated", handleCustomSync);
      window.removeEventListener("omni_restaurants_updated", handleCustomSync);
      window.removeEventListener("omni_plans_updated", handleCustomSync);
      window.removeEventListener("storage", handleCustomSync);
    };
  }, [fetchLivePaymentData]);

  const counts = useMemo(() => {
    const all = payments.length;
    const standalone = payments.filter((p) => p.merchantCategory === "standalone").length;
    const franchise = payments.filter((p) => p.merchantCategory === "franchise").length;
    const totalSubBranches = payments
      .filter((p) => p.merchantCategory === "franchise")
      .reduce((sum, p) => sum + (p.branches?.length || 0), 0);

    return { all, standalone, franchise, totalSubBranches };
  }, [payments]);

  const metrics = useMemo(() => {
    const totalVolume = payments
      .filter((p) => p.status === "Completed")
      .reduce((acc, p) => acc + p.rawAmount, 0);

    const standaloneTotal = payments
      .filter((p) => p.merchantCategory === "standalone" && p.status === "Completed")
      .reduce((acc, p) => acc + p.rawAmount, 0);

    const franchiseTotal = payments
      .filter((p) => p.merchantCategory === "franchise" && p.status === "Completed")
      .reduce((acc, p) => acc + p.rawAmount, 0);

    return { totalVolume, standaloneTotal, franchiseTotal };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      if (activeTab === "standalone" && item.merchantCategory !== "standalone") return false;
      if (activeTab === "franchise" && item.merchantCategory !== "franchise") return false;

      if (statusFilter !== "all" && item.status.toLowerCase() !== statusFilter.toLowerCase()) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.restaurant.toLowerCase().includes(q);
        const matchesBranch = item.branch.toLowerCase().includes(q);
        const matchesRef = item.refId.toLowerCase().includes(q);
        const matchesInv = item.invoiceNumber.toLowerCase().includes(q);
        const matchesPlan = item.planTier.toLowerCase().includes(q);
        const matchesCity = item.city.toLowerCase().includes(q);

        const matchesSubBranch = item.branches?.some(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.address.toLowerCase().includes(q) ||
            b.invoiceRef.toLowerCase().includes(q)
        );

        if (!matchesName && !matchesBranch && !matchesRef && !matchesInv && !matchesPlan && !matchesCity && !matchesSubBranch) {
          return false;
        }
      }

      return true;
    });
  }, [payments, activeTab, statusFilter, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLivePaymentData();
    setTimeout(() => {
      setIsRefreshing(false);
      showToast("Live restaurant billing & sub-branches refreshed!");
    }, 400);
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Invoice Number", "Restaurant", "Merchant Type", "Sub-Branches Count", "Plan Tier", "Amount", "Status", "Date"];
      const rows = filteredPayments.map((p) => [
        p.invoiceNumber,
        `"${p.restaurant.replace(/"/g, '""')}"`,
        p.merchantCategory === "franchise" ? "Franchise Owner" : "Standalone Outlet",
        p.outlets,
        `"${p.planTier}"`,
        p.rawAmount,
        p.status,
        `"${p.date}"`,
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Omnibites_Billing_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Invoices ledger exported successfully!");
    } catch {
      showToast("Exporting ledger CSV...");
    }
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.restaurant.trim() || !newPayment.amount) return;

    const numAmount = parseFloat(newPayment.amount) || 0;
    const numOutlets = parseInt(newPayment.outlets, 10) || 1;
    const fee = Number((numAmount * 0.025).toFixed(2));
    const net = Number((numAmount - fee).toFixed(2));

    const branchesList: SubBranchRecord[] = [];
    const splitAmount = Number((numAmount / numOutlets).toFixed(2));

    for (let i = 1; i <= numOutlets; i++) {
      branchesList.push({
        id: `manual-sub-${Date.now()}-${i}`,
        branchIndex: i,
        name: i === 1 ? `${newPayment.restaurant} (Main Branch)` : `${newPayment.restaurant} Branch ${i}`,
        address: newPayment.branch || `${newPayment.restaurant} Location ${i}`,
        city: "Pakistan",
        status: "Completed",
        shareAmount: splitAmount,
        invoiceRef: `INV-BR-${Math.floor(1000 + Math.random() * 9000)}`,
        isMainHq: i === 1,
      });
    }

    const record: PaymentRecord = {
      id: `pay-manual-${Date.now()}`,
      refId: `PAY-${Math.floor(1000000 + Math.random() * 9000000)}`,
      restaurant: newPayment.restaurant,
      branch: newPayment.branch || (newPayment.merchantCategory === "standalone" ? "Main Outlet" : "Headquarters"),
      city: "Pakistan",
      merchantCategory: newPayment.merchantCategory,
      outlets: numOutlets,
      planTier: newPayment.planTier,
      billingCycle: newPayment.billingCycle,
      gateway: newPayment.gateway,
      rawAmount: numAmount,
      rawFee: fee,
      rawNet: net,
      date: "Just now",
      nextInvoice: newPayment.billingCycle === "Annual" ? "In 1 year" : "In 30 days",
      status: "Completed",
      invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      branches: branchesList,
    };

    const updated = [record, ...payments];
    setPayments(updated);

    try {
      const customSaved = localStorage.getItem("omni_custom_manual_payments");
      const existing = customSaved ? JSON.parse(customSaved) : [];
      localStorage.setItem("omni_custom_manual_payments", JSON.stringify([record, ...existing]));
    } catch {}

    setIsRecordModalOpen(false);
    setNewPayment({
      restaurant: "",
      branch: "",
      merchantCategory: "standalone",
      outlets: "1",
      planTier: "Fresher Plan",
      billingCycle: "Monthly",
      gateway: "JazzCash",
      amount: "",
    });
    showToast(`Payment of ${formatPrice(numAmount)} logged for "${record.restaurant}"`);
  };

  const getStatusBadge = (status: PaymentRecord["status"]) => {
    switch (status) {
      case "Completed":
        return "bg-[#25d366]/15 text-[#25d366] border-[#25d366]/30";
      case "Processing":
        return "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/30";
      case "Expiring":
        return "bg-[var(--orange-dim)] text-[var(--orange)] border-[var(--orange)]/30";
      case "Failed":
        return "bg-red-500/15 text-red-400 border-red-500/30";
      default:
        return "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)]";
    }
  };

  const getGatewayBadge = (gateway: PaymentRecord["gateway"]) => {
    switch (gateway) {
      case "JazzCash":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "EasyPaisa":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Stripe":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      case "Bank Transfer":
        return "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/20";
      default:
        return "bg-[var(--surface-hi)] text-[var(--text-lo)] border-[var(--border)]";
    }
  };

  const allFranchisesExpanded =
    counts.franchise > 0 &&
    payments
      .filter((p) => p.merchantCategory === "franchise")
      .every((p) => expandedFranchises.has(p.id));

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 w-full max-w-full min-w-0">
      {/* ===================== 1. PAGE HEADING & TOP ACTIONS ===================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full min-w-0">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-[11px] font-semibold uppercase tracking-wider mb-2 max-w-full">
            <CreditCard className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
            <span className="truncate">Restaurant Billing &amp; Franchise Hierarchy</span>
          </div>
          <h1 className="font-bold text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Payments &amp; <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Invoices</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Monitor restaurant billing, standalone outlet subscriptions, franchise revenues, and invoice receipts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsRecordModalOpen(true)}
            className="btn-gold text-xs px-3.5 sm:px-4 py-2 gap-1.5 font-bold cursor-pointer inline-flex items-center shadow-lg shadow-[var(--gold-glow)] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Ledger</span>
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-[var(--text-lo)] hover:text-[var(--gold)] transition-all cursor-pointer shrink-0"
            title="Refresh payments and restaurant data"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[var(--gold)]" : ""}`} />
          </button>
        </div>
      </div>

      {/* ===================== 2. STATS KPI OVERVIEW CARDS ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Card 1: Total Volume */}
        <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-2 relative overflow-hidden border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-lo)]">Total Subscriptions Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--text-hi)]">
              {formatPrice(metrics.totalVolume)}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-[#25d366] font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Across {counts.all} registered restaurant brands</span>
            </div>
          </div>
        </div>

        {/* Card 2: Standalone Outlets */}
        <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-2 relative overflow-hidden border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-lo)]">Standalone Outlets</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--text-hi)]">
              {formatPrice(metrics.standaloneTotal)}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-semibold">
              <span>{counts.standalone} single standalone merchant outlets</span>
            </div>
          </div>
        </div>

        {/* Card 3: Franchise Owners & Sub-Branches */}
        <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-2 relative overflow-hidden border border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-lo)]">Franchise Networks</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--text-hi)]">
              {formatPrice(metrics.franchiseTotal)}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--gold)] font-semibold">
              <GitFork className="w-3.5 h-3.5" />
              <span>
                {counts.franchise} franchise owners ({counts.totalSubBranches} sub-branches)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== 3. MAIN PAYMENTS TABLE ===================== */}
      <div className="glass-panel rounded-3xl p-4 sm:p-6 space-y-5 border border-[var(--border)] w-full overflow-hidden">
        {/* Top Filter Bar: Tabs, Expand All, Search & Status Dropdown */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] w-fit overflow-x-auto custom-scrollbar">
            {[
              { id: "all", label: `All (${counts.all})`, icon: CreditCard },
              { id: "standalone", label: `Standalone (${counts.standalone})`, icon: Store },
              { id: "franchise", label: `Franchise Owner (${counts.franchise})`, icon: Building2 },
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? "btn-gold shadow-md shadow-[var(--gold-glow)] font-bold"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab !== "standalone" && counts.franchise > 0 && (
              <button
                type="button"
                onClick={toggleAllFranchises}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-lo)] hover:text-[var(--gold)] transition-all cursor-pointer"
                title="Expand or collapse all franchise sub-branches"
              >
                <Layers className="w-3 h-3 text-[var(--gold)]" />
                <span>{allFranchisesExpanded ? "Collapse Branches" : "Expand Branches"}</span>
              </button>
            )}

            <div className="relative min-w-[180px] sm:min-w-[220px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search restaurant, ref #..."
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-full pl-9 pr-4 py-1.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
              />
            </div>

            {/* Custom Glassmorphism Status Dropdown matching other super admin dropdowns */}
            <div className="relative shrink-0" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-medium text-[var(--text-hi)] transition-all cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span className="capitalize">
                  {statusFilter === "all"
                    ? "All Statuses"
                    : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[var(--text-lo)] transition-transform duration-200 ${
                    isStatusDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
                  }`}
                />
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] w-44 bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl p-1.5 shadow-2xl z-50 space-y-1 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                  {[
                    { id: "all", label: "All Statuses" },
                    { id: "completed", label: "Completed" },
                    { id: "processing", label: "Processing" },
                    { id: "expiring", label: "Expiring" },
                    { id: "failed", label: "Failed" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setStatusFilter(st.id);
                        setIsStatusDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                        statusFilter === st.id
                          ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                          : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                      }`}
                    >
                      <span>{st.label}</span>
                      {statusFilter === st.id && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block w-full overflow-x-auto custom-scrollbar pt-1">
          <table className="w-full min-w-[920px] text-left text-xs font-sans table-auto">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="pb-3.5 font-semibold px-3 w-[28%]">Restaurant / Branch Structure</th>
                <th className="pb-3.5 font-semibold px-3 w-[15%]">Merchant Category</th>
                <th className="pb-3.5 font-semibold px-3 w-[15%]">Subscribed Plan Tier</th>
                <th className="pb-3.5 font-semibold px-3 w-[10%]">Billing Cycle</th>
                <th className="pb-3.5 font-semibold px-3 w-[11%] text-center">Fee / Amount</th>
                <th className="pb-3.5 font-semibold px-3 w-[10%] text-center">Next Invoice</th>
                <th className="pb-3.5 font-semibold px-3 w-[11%] text-center">Status</th>
                <th className="pb-3.5 font-semibold px-3 w-[8%] text-right pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/30 font-medium">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-lo)]">
                    <CreditCard className="w-8 h-8 text-[var(--text-faint)] mx-auto mb-2" />
                    <p className="font-semibold text-sm">No payment records found in this view.</p>
                    <p className="text-xs text-[var(--text-faint)] mt-1">Try switching tabs or resetting your search filter.</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((item) => {
                  const isFranchise = item.merchantCategory === "franchise";
                  const isExpanded = expandedFranchises.has(item.id);
                  const hasSubBranches = isFranchise && item.branches && item.branches.length > 0;

                  return (
                    <React.Fragment key={item.id}>
                      {/* ================= PARENT ROW ================= */}
                      <tr className="transition-none">
                        {/* Restaurant Info & Expand Toggle */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            {isFranchise ? (
                              <button
                                type="button"
                                onClick={() => toggleFranchise(item.id)}
                                className="p-1 rounded-md text-[var(--gold)] cursor-pointer shrink-0 hover:opacity-80"
                                title={isExpanded ? "Collapse sub-branches" : "Expand sub-branches"}
                                aria-label="Toggle Branches"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-[var(--gold)]" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-[var(--text-lo)]" />
                                )}
                              </button>
                            ) : (
                              <div className="w-4 shrink-0" />
                            )}

                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                              {item.restaurant.slice(0, 2).toUpperCase()}
                            </div>

                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-[var(--text-hi)] truncate block text-xs">
                                {item.restaurant}
                              </span>
                              <span className="text-[10.5px] text-[var(--text-faint)] block truncate mt-0.5">
                                {item.branch} · {item.city}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Category: Standalone vs Franchise Owner */}
                        <td className="py-3.5 px-3">
                          {isFranchise ? (
                            <button
                              type="button"
                              onClick={() => toggleFranchise(item.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 cursor-pointer"
                            >
                              <Building2 className="w-3 h-3 text-[var(--gold)]" />
                              <span>
                                Franchise ({item.outlets} {item.outlets === 1 ? "branch" : "branches"})
                              </span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Store className="w-3 h-3" />
                              <span>Standalone</span>
                            </span>
                          )}
                        </td>

                        {/* Subscribed Tier */}
                        <td className="py-3.5 px-3">
                          <span className="text-xs font-semibold text-[var(--text-hi)] block truncate">
                            {item.planTier}
                          </span>
                        </td>

                        {/* Billing Cycle */}
                        <td className="py-3.5 px-3 text-[var(--text-lo)] whitespace-nowrap">
                          {item.billingCycle}
                        </td>

                        {/* Fee */}
                        <td className="py-3.5 px-3 text-center font-bold text-[var(--gold)] font-mono whitespace-nowrap">
                          {formatPrice(item.rawAmount)}
                        </td>

                        {/* Next Invoice */}
                        <td className="py-3.5 px-3 text-center text-[var(--text-lo)] text-[11px] whitespace-nowrap">
                          {item.nextInvoice}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${getStatusBadge(item.status)}`}>
                            {item.status === "Completed" && <CheckCircle2 className="w-3 h-3 text-[#25d366]" />}
                            {item.status === "Processing" && <Clock className="w-3 h-3 text-[var(--gold)]" />}
                            {item.status === "Expiring" && <AlertTriangle className="w-3 h-3 text-[var(--orange)]" />}
                            {item.status === "Failed" && <AlertTriangle className="w-3 h-3 text-red-400" />}
                            <span>{item.status}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-right pr-3">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedPayment(item)}
                              className="p-1.5 rounded-lg bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)] cursor-pointer hover:text-[var(--gold)]"
                              title="View Invoice Details"
                              aria-label="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ================= EXPANDED SUB-BRANCHES ROWS ================= */}
                      {hasSubBranches &&
                        isExpanded &&
                        item.branches.map((sub) => (
                          <tr
                            key={sub.id}
                            className="bg-black/20 border-b border-[var(--border)]/20"
                          >
                            {/* Sub-Branch Name & Branch Indicator */}
                            <td className="py-2.5 px-3 pl-8">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-[var(--gold)] select-none">↳</span>
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-xs text-[var(--text-hi)] truncate block">
                                    {sub.name}
                                  </span>
                                  <span className="text-[10px] text-[var(--text-faint)] block truncate mt-0.5">
                                    {sub.address}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Sub-Branch Badge */}
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]">
                                Branch #{sub.branchIndex}
                              </span>
                            </td>

                            {/* Plan Tier */}
                            <td className="py-2.5 px-3">
                              <span className="text-[11px] text-[var(--text-lo)] font-medium block truncate">
                                {item.planTier}
                              </span>
                            </td>

                            {/* Billing Cycle */}
                            <td className="py-2.5 px-3 text-[11px] text-[var(--text-faint)] whitespace-nowrap">
                              {item.billingCycle}
                            </td>

                            {/* Sub-Branch Share Allocation */}
                            <td className="py-2.5 px-3 text-center font-mono text-xs text-[var(--text-lo)] whitespace-nowrap">
                              {formatPrice(sub.shareAmount)}
                              {item.outlets > 1 && (
                                <span className="text-[9.5px] text-[var(--text-faint)] block">
                                  (1/{item.outlets} share)
                                </span>
                              )}
                            </td>

                            {/* Next Invoice */}
                            <td className="py-2.5 px-3 text-center text-[10.5px] text-[var(--text-faint)] whitespace-nowrap">
                              {item.nextInvoice}
                            </td>

                            {/* Sub-Branch Status */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#25d366]/10 text-[#25d366] border border-[#25d366]/20">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Operational</span>
                              </span>
                            </td>

                            {/* Sub-Branch Actions */}
                            <td className="py-2.5 px-3 text-right pr-3">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedSubBranch({ parent: item, branch: sub })}
                                  className="p-1 rounded bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)] cursor-pointer hover:text-[var(--gold)]"
                                  title={`View Receipt for ${sub.name}`}
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (< 768px) */}
        <div className="block md:hidden space-y-3 pt-1">
          {filteredPayments.length === 0 ? (
            <div className="py-10 text-center text-[var(--text-lo)] bg-[var(--surface-hi)]/30 rounded-2xl p-4">
              <CreditCard className="w-8 h-8 text-[var(--text-faint)] mx-auto mb-2" />
              <p className="font-semibold text-sm">No payment records found.</p>
            </div>
          ) : (
            filteredPayments.map((item) => {
              const isFranchise = item.merchantCategory === "franchise";
              const isExpanded = expandedFranchises.has(item.id);
              const hasSubBranches = isFranchise && item.branches && item.branches.length > 0;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[var(--surface-hi)]/40 border border-[var(--border)] space-y-3.5 shadow-sm transition-none"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                        {item.restaurant.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-sm text-[var(--text-hi)] truncate block">
                          {item.restaurant}
                        </span>
                        <span className="text-xs text-[var(--text-faint)] truncate block mt-0.5">
                          {item.branch} · {item.city}
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold border shrink-0 ${getStatusBadge(item.status)}`}>
                      <span>{item.status}</span>
                    </span>
                  </div>

                  {/* Subscribed Tier & Category */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]/30 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isFranchise ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                          <Building2 className="w-3 h-3" />
                          <span>
                            Franchise ({item.outlets} {item.outlets === 1 ? "branch" : "branches"})
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Store className="w-3 h-3" />
                          <span>Standalone</span>
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-lo)] font-medium">
                        · {item.planTier} ({item.billingCycle})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-[var(--gold)]">
                        {formatPrice(item.rawAmount)}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)] block">
                        Next: {item.nextInvoice}
                      </span>
                    </div>
                  </div>

                  {/* If Franchise: Sub-Branches Accordion */}
                  {hasSubBranches && (
                    <div className="pt-2 border-t border-[var(--border)]/30 space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleFranchise(item.id)}
                        className="w-full py-1.5 px-3 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] text-xs font-bold flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <GitFork className="w-3.5 h-3.5" />
                          <span>
                            {isExpanded ? "Hide" : "View"} {item.branches.length}{" "}
                            {item.branches.length === 1 ? "Sub-Branch" : "Sub-Branches"}
                          </span>
                        </span>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="space-y-2 pl-2 border-l-2 border-[var(--gold)]/30 pt-1">
                          {item.branches.map((sub) => (
                            <div
                              key={sub.id}
                              className="p-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1.5 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[var(--text-hi)] flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 text-[var(--gold)] shrink-0" />
                                  <span className="truncate">{sub.name}</span>
                                </span>
                                <span className="font-mono text-[11px] font-bold text-[var(--gold)] shrink-0">
                                  {formatPrice(sub.shareAmount)}
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--text-faint)] truncate">{sub.address}</p>
                              <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/30 text-[10px]">
                                <span className="font-mono text-[var(--text-lo)]">{sub.invoiceRef}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    showToast(`Branch receipt ${sub.invoiceRef} downloaded for ${sub.name}`)
                                  }
                                  className="text-[var(--gold)] hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Receipt</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Action buttons */}
                  <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]/30">
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(item)}
                      className="flex-1 py-1.5 rounded-xl bg-[var(--surface-hi)] text-xs font-semibold text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>View Details</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast(`Invoice downloaded for ${item.restaurant}`)}
                      className="flex-1 py-1.5 rounded-xl bg-[var(--surface-hi)] text-xs font-semibold text-[var(--text-hi)] border border-[var(--border)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Master Invoice</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ===================== INVOICE DETAIL BREAKDOWN MODAL ===================== */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedPayment(null)}
          />

          <div className="relative w-full max-w-lg bg-[var(--bg-deep)] border border-[var(--gold)]/50 rounded-3xl p-6 shadow-2xl space-y-5 z-10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--text-hi)]">Invoice Details</h3>
                  <p className="text-[11px] text-[var(--text-lo)] font-mono">{selectedPayment.invoiceNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="p-1.5 rounded-xl text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Merchant Details Card */}
            <div className="p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-lo)]">Restaurant Brand</span>
                <span className="font-bold text-xs text-[var(--text-hi)]">{selectedPayment.restaurant}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-lo)]">Category</span>
                <span className="text-xs font-semibold text-[var(--gold)] capitalize">
                  {selectedPayment.merchantCategory === "franchise"
                    ? `Franchise Owner (${selectedPayment.outlets} ${selectedPayment.outlets === 1 ? "branch" : "branches"})`
                    : "Standalone Outlet"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-lo)]">Subscribed Tier</span>
                <span className="text-xs text-[var(--text-hi)] font-semibold">{selectedPayment.planTier}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-lo)]">Billing Cycle</span>
                <span className="text-xs text-[var(--text-hi)]">{selectedPayment.billingCycle}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-lo)]">Payment Gateway</span>
                <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${getGatewayBadge(selectedPayment.gateway)}`}>
                  {selectedPayment.gateway}
                </span>
              </div>
            </div>

            {/* If Franchise: Sub-branches Breakdown */}
            {selectedPayment.merchantCategory === "franchise" && selectedPayment.branches?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-[var(--text-hi)] flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Sub-Branches Allocation ({selectedPayment.branches.length} {selectedPayment.branches.length === 1 ? "Outlet" : "Outlets"})</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {selectedPayment.branches.map((b) => (
                    <div
                      key={b.id}
                      className="p-2 rounded-xl bg-[var(--surface-hi)]/60 border border-[var(--border)] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-semibold text-[var(--text-hi)] truncate block">{b.name}</span>
                        <span className="text-[10.5px] text-[var(--text-faint)] truncate block">{b.address}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-[var(--gold)]">{formatPrice(b.shareAmount)}</span>
                        <span className="text-[10px] text-[var(--text-faint)] block">{b.invoiceRef}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--border)]/40">
                <span className="text-[var(--text-lo)]">Plan Subscription Amount</span>
                <span className="font-bold text-[var(--text-hi)] font-mono">{formatPrice(selectedPayment.rawAmount)}</span>
              </div>
              <div className="flex items-center justify-between py-2 bg-[var(--gold-dim)]/30 px-3 rounded-xl">
                <span className="font-bold text-[var(--text-hi)]">Total Invoice Paid</span>
                <span className="font-mono text-base font-extrabold text-[var(--gold)]">
                  {formatPrice(selectedPayment.rawAmount)}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] text-xs font-semibold hover:text-[var(--text-hi)] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(`Invoice ${selectedPayment.invoiceNumber} downloaded for ${selectedPayment.restaurant}`);
                  setSelectedPayment(null);
                }}
                className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Master Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SUB-BRANCH RECEIPT MODAL ===================== */}
      {selectedSubBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedSubBranch(null)}
          />

          <div className="relative w-full max-w-md bg-[var(--bg-deep)] border border-[var(--gold)]/50 rounded-3xl p-6 shadow-2xl space-y-5 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--text-hi)]">Branch Receipt</h3>
                  <p className="text-[11px] text-[var(--text-lo)] font-mono">{selectedSubBranch.branch.invoiceRef}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubBranch(null)}
                className="p-1.5 rounded-xl text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-lo)]">Parent Franchise</span>
                <span className="font-bold text-[var(--text-hi)]">{selectedSubBranch.parent.restaurant}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-lo)]">Sub-Branch Name</span>
                <span className="font-bold text-[var(--gold)]">{selectedSubBranch.branch.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-lo)]">Branch Location</span>
                <span className="text-[var(--text-hi)] text-right">{selectedSubBranch.branch.address}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-lo)]">Plan Tier Allocation</span>
                <span className="text-[var(--text-hi)]">{selectedSubBranch.parent.planTier}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-lo)]">Branch Share</span>
                <span className="font-mono font-bold text-[var(--gold)]">
                  {formatPrice(selectedSubBranch.branch.shareAmount)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSelectedSubBranch(null)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] text-xs font-semibold hover:text-[var(--text-hi)] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(`Branch receipt ${selectedSubBranch.branch.invoiceRef} downloaded`);
                  setSelectedSubBranch(null);
                }}
                className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Branch Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== RECORD MANUAL PAYMENT MODAL ===================== */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsRecordModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-[var(--bg-deep)] border border-[var(--gold)]/50 rounded-3xl p-6 shadow-2xl space-y-5 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--text-hi)]">Record Restaurant Payment</h3>
                  <p className="text-[11px] text-[var(--text-lo)]">Log subscription invoice or settlement</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="p-1.5 rounded-xl text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  required
                  value={newPayment.restaurant}
                  onChange={(e) => setNewPayment({ ...newPayment, restaurant: e.target.value })}
                  placeholder="e.g. Salt'n Pepper Village"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                    Merchant Type
                  </label>
                  <select
                    value={newPayment.merchantCategory}
                    onChange={(e) =>
                      setNewPayment({
                        ...newPayment,
                        merchantCategory: e.target.value as any,
                        outlets: e.target.value === "franchise" ? "2" : "1",
                      })
                    }
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none cursor-pointer"
                  >
                    <option value="standalone">Standalone Outlet</option>
                    <option value="franchise">Franchise Owner</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                    Branches Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newPayment.outlets}
                    onChange={(e) => setNewPayment({ ...newPayment, outlets: e.target.value })}
                    disabled={newPayment.merchantCategory === "standalone"}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                    Subscribed Tier
                  </label>
                  <select
                    value={newPayment.planTier}
                    onChange={(e) => setNewPayment({ ...newPayment, planTier: e.target.value })}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none cursor-pointer"
                  >
                    <option value="Enterprise Plus">Enterprise Plus</option>
                    <option value="Fresher Plan">Fresher Plan</option>
                    <option value="Free Tier">Free Tier</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                    Billing Cycle
                  </label>
                  <select
                    value={newPayment.billingCycle}
                    onChange={(e) => setNewPayment({ ...newPayment, billingCycle: e.target.value as any })}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none cursor-pointer"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                    Payment Gateway
                  </label>
                  <select
                    value={newPayment.gateway}
                    onChange={(e) => setNewPayment({ ...newPayment, gateway: e.target.value as any })}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none cursor-pointer"
                  >
                    <option value="JazzCash">JazzCash</option>
                    <option value="EasyPaisa">EasyPaisa</option>
                    <option value="Stripe">Stripe</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-[10.5px] tracking-wider">
                    Amount ({symbol}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--gold)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] text-xs font-semibold hover:text-[var(--text-hi)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
