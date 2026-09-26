"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import {
  Store,
  Plus,
  Search,
  Download,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Layers,
  Sliders,
  Filter,
  Users,
  CreditCard,
  Building2,
  TrendingUp,
  Star,
  ExternalLink,
  MoreVertical,
  Trash2,
  X,
  ArrowLeft,
  Mail,
  FileCheck,
  ChevronDown,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  Edit2,
  Power,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

export type RestaurantStatus = "Active" | "Deactivated" | "Suspended" | "Pending";

export interface BranchItem {
  name: string;
  address?: string;
  type?: "standalone" | "franchise" | string;
}

export interface RestaurantItem {
  id: string;
  name: string;
  branch: string;
  city: string;
  category: string;
  outlets: number;
  outletType?: "standalone" | "multi";
  outlet_type?: "standalone" | "multi";
  isMultiBranch?: boolean;
  is_multi_branch?: boolean;
  revenue: string;
  pendingPayout?: string;
  ordersMonthly: number;
  rating: string;
  status: RestaurantStatus;
  planTier: string;
  ownerName: string;
  phone: string;
  email?: string;
  joinedDate: string;
  branches?: BranchItem[];
  enabledModules?: string[];
  hqAddress?: string;
  logoUrl?: string;
}

const ALL_CITIES = [
  "Lahore",
  "Karachi",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Peshawar",
  "Multan",
  "Gujranwala",
  "Sialkot",
  "Quetta",
  "Abbottabad",
  "Bahawalpur",
  "Sargodha",
  "Sukkur",
  "Hyderabad",
  "Larkana",
  "Sheikhupura",
  "Jhang",
  "Rahim Yar Khan",
  "Gujrat",
  "Mardan",
  "Kasur",
  "Sahiwal",
  "Okara",
  "Wah Cantt",
  "Dera Ghazi Khan",
  "Mirpur",
  "Muzaffarabad",
  "Gwadar",
  "Gilgit",
  "Skardu",
  "Jhelum",
  "Attock",
  "Chiniot",
  "Kamoke",
  "Hafizabad",
  "Kohat",
  "Khanewal",
  "Dera Ismail Khan",
  "Turbat",
  "Mandi Bahauddin",
  "Nawabshah",
  "Khuzdar",
  "Pakpattan",
  "Vihari",
  "Hub",
];

const CATEGORIES = [
  "Fine Dining",
  "Traditional & Buffet",
  "Desi BBQ & Karahi",
  "Burgers & Fast Casual",
  "Seafood & BBQ",
  "Cafe & Beverages",
  "Cloud Kitchen",
  "Desserts & Bakery",
  "Pizza & Italian",
];

const DEFAULT_PLAN_TIERS = ["Enterprise Plus", "Fresher Plan", "Free Tier"];

const ADD_ON_ENTITLEMENTS = [
  {
    id: "pos_terminal",
    title: "POS Terminal Access",
    subtitle: "In-store billing aur cash drawer management",
  },
  {
    id: "kds_system",
    title: "Kitchen Display System (KDS)",
    subtitle: "Chef routing aur live kitchen order screens",
  },
  {
    id: "rider_app",
    title: "Rider & Delivery App",
    subtitle: "Live delivery dispatch aur rider tracking",
  },
  {
    id: "inventory_stock",
    title: "Inventory & Stock Management",
    subtitle: "Recipe-linked automated deduction",
  },
];

const mapSupabaseRestaurant = (row: any): RestaurantItem => {
  let branchCount = 1;
  let primaryBranch = "Main Branch";
  let branchesArray: BranchItem[] = [];

  let rawBranches = row.branches;
  if (typeof rawBranches === "string") {
    try {
      const parsed = JSON.parse(rawBranches);
      if (Array.isArray(parsed) || typeof parsed === "object") {
        rawBranches = parsed;
      }
    } catch {
      // not JSON string
    }
  }

  let hasFranchiseFlag = false;
  let hasStandaloneFlag = false;

  if (Array.isArray(rawBranches)) {
    branchesArray = rawBranches
      .map((b: any, idx: number) => {
        if (typeof b === "object" && b !== null) {
          if (b.type === "franchise" || b.is_franchise || b.outlet_type === "multi") {
            hasFranchiseFlag = true;
          }
          if (b.type === "standalone" || b.outlet_type === "standalone") {
            hasStandaloneFlag = true;
          }
          let bName = b.name || b.branch_name || b.branch || "";
          let bAddress = b.address || b.location || "";
          if (idx === 0) {
            bName = `${row.brand_name || "Main"} (Main Branch)`;
          } else if (!bName || bName === bAddress || bName === row.hq_address) {
            bName = `${row.brand_name || "Main"} Branch ${idx + 1}`;
          }
          return {
            name: bName,
            address: bAddress || row.hq_address || "",
          };
        }
        return {
          name: idx === 0 ? `${row.brand_name || "Main"} (Main Branch)` : String(b || "").trim() || `${row.brand_name || "Main"} Branch`,
          address: row.hq_address || "",
        };
      })
      .filter((b: BranchItem) => Boolean(b.name));
    branchCount = branchesArray.length > 0 ? branchesArray.length : 1;
    primaryBranch = branchesArray[0]?.name || "Main Branch";
  } else if (typeof rawBranches === "string" && rawBranches.trim()) {
    const parts = rawBranches.split(",").map((s) => s.trim()).filter(Boolean);
    branchesArray = parts.map((p, idx) => ({ name: idx === 0 ? `${row.brand_name || "Main"} (Main Branch)` : p, address: row.hq_address || "" }));
    branchCount = parts.length > 0 ? parts.length : 1;
    primaryBranch = branchesArray[0]?.name || "Main Branch";
  }

  const isMulti =
    hasFranchiseFlag ||
    branchCount > 1 ||
    row.is_multi_branch === true ||
    row.outlet_type === "multi" ||
    row.franchise === true ||
    String(row.brand_name || "").toLowerCase().includes("franchise") ||
    String(row.brand_name || "").toLowerCase().includes("frenchise");

  const modulesArray: string[] = Array.isArray(row.enabled_modules)
    ? row.enabled_modules
    : row.enabled_modules
      ? [row.enabled_modules]
      : [];

  return {
    id: String(row.id),
    name: row.brand_name || "Untitled Restaurant",
    branch: row.hq_address || primaryBranch,
    city: row.city || "Lahore",
    category: row.cuisine || "Fine Dining",
    outlets: branchesArray.length > 0 ? branchesArray.length : 1,
    outletType: isMulti ? "multi" : "standalone",
    outlet_type: isMulti ? "multi" : "standalone",
    isMultiBranch: isMulti,
    revenue:
      row.revenue !== undefined && row.revenue !== null
        ? typeof row.revenue === "number"
          ? `$${row.revenue.toLocaleString()}`
          : String(row.revenue).startsWith("$")
            ? String(row.revenue)
            : `$${row.revenue}`
        : "$0",
    pendingPayout:
      row.pending_payout !== undefined && row.pending_payout !== null
        ? typeof row.pending_payout === "number"
          ? `$${row.pending_payout.toLocaleString()}`
          : String(row.pending_payout).startsWith("$")
            ? String(row.pending_payout)
            : `$${row.pending_payout}`
        : "$0",
    ordersMonthly: typeof row.orders_monthly === "number" ? row.orders_monthly : 0,
    rating: String(row.rating || "5.0"),
    status: (row.initial_status as RestaurantStatus) || "Active",
    planTier: row.assigned_plan || "Enterprise Plus",
    ownerName: row.contact_person || "Owner",
    phone: row.phone || "+92 300 0000000",
    email: row.owner_email || "",
    branches: branchesArray.length > 0 ? branchesArray : [{ name: row.hq_address || primaryBranch, address: row.hq_address || "" }],
    enabledModules: modulesArray,
    hqAddress: row.hq_address || primaryBranch,
    logoUrl: row.logo_url || row.brand_logo || row.logo || "",
    joinedDate: row.created_at
      ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
};

const CACHE_KEY = "sa_restaurants";

const getCachedRestaurants = (): RestaurantItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) =>
          item && typeof item === "object" && typeof item.name === "string" && item.name
            ? item
            : mapSupabaseRestaurant(item)
        );
      }
    }
  } catch {
    // ignore
  }
  return [];
};

export default function RestaurantsView({
  showToast,
  initialMode,
  resetTrigger,
  onAddClick,
  globalSearchQuery = "",
  globalSearchType = "name",
}: {
  showToast: (msg: string) => void;
  initialMode?: "new" | "edit" | null;
  resetTrigger?: number;
  onAddClick?: () => void;
  globalSearchQuery?: string;
  globalSearchType?: "name" | "location";
}) {
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RestaurantStatus>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantItem | null>(null);

  // Fetch real-time restaurants from Supabase database API
  const fetchRestaurants = async () => {
    try {
      const res = await fetch("/api/super-admin/restaurants", {
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (data.restaurants && Array.isArray(data.restaurants)) {
          const mapped = data.restaurants.map(mapSupabaseRestaurant);
          setRestaurants(mapped);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
            } catch { }
          }
        }
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    // Instant hydration if state was empty during SSR
    const cached = getCachedRestaurants();
    if (cached.length > 0 && restaurants.length === 0) {
      setRestaurants(cached);
    }

    fetchRestaurants();

    // Supabase Real-time listener for live sync across tabs & devices
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("realtime-restaurants")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "restaurants" },
          () => {
            fetchRestaurants();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn("Realtime restaurant subscription setup failed:", e);
    }
  }, [resetTrigger]);

  useEffect(() => {
    const handleGlobalSearch = (e?: any) => {
      try {
        if (e && e.detail && typeof e.detail.query === "string") {
          setSearch(e.detail.query);
          return;
        }
        const val = localStorage.getItem("sa_global_search_filter");
        if (val) {
          setSearch(val);
        } else {
          setSearch("");
        }
      } catch { }
    };
    window.addEventListener("sa_global_search_event", handleGlobalSearch);
    handleGlobalSearch();
    return () => window.removeEventListener("sa_global_search_event", handleGlobalSearch);
  }, []);

  // Real-time Plans fetched from Subscriptions & Plans
  const [realtimePlans, setRealtimePlans] = useState<string[]>(DEFAULT_PLAN_TIERS);

  // Load cached plans from sessionStorage on mount (hydration safe)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("subscription_plans");
      if (cached && cached.trim()) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const names = parsed.map((p: any) => p.name || p.title).filter(Boolean);
          if (names.length > 0) setRealtimePlans(names);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch real-time plans from backend API & listen for live changes
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const cached = localStorage.getItem("omni_published_plans");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const names = parsed.map((p: any) => p.name).filter(Boolean);
            if (names.length > 0) setRealtimePlans(names);
          }
        }

        const res = await fetch("/api/super-admin/plans");
        if (res.ok) {
          const text = await res.text();
          const data = text ? JSON.parse(text) : {};
          if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
            const names = data.plans.map((p: any) => p.name).filter(Boolean);
            if (names.length > 0) {
              setRealtimePlans(names);
            }
          }
        }
      } catch {
        // fallback
      }
    };
    fetchPlans();

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("omni_plans_sync");
        bc.onmessage = (event) => {
          if (event.data?.type === "PLANS_UPDATED") {
            if (event.data.plans && Array.isArray(event.data.plans)) {
              const names = event.data.plans.map((p: any) => p.name).filter(Boolean);
              if (names.length > 0) setRealtimePlans(names);
            } else {
              fetchPlans();
            }
          }
        };
      } catch { }
    }

    const handleCustom = (e: Event) => {
      const ce = e as CustomEvent<{ plans?: any[] }>;
      if (ce.detail?.plans && Array.isArray(ce.detail.plans)) {
        const names = ce.detail.plans.map((p: any) => p.name).filter(Boolean);
        if (names.length > 0) setRealtimePlans(names);
      } else {
        fetchPlans();
      }
    };

    window.addEventListener("omni_plans_updated", handleCustom);
    return () => {
      if (bc) bc.close();
      window.removeEventListener("omni_plans_updated", handleCustom);
    };
  }, []);

  // Is "Add / Edit Restaurant" full page active
  const [isAddingRestaurant, setIsAddingRestaurant] = useState(initialMode === "new" || initialMode === "edit");
  const [editingRestaurantId, setEditingRestaurantId] = useState<string | null>(null);

  // Delete Confirmation Popup State
  const [restaurantToDelete, setRestaurantToDelete] = useState<RestaurantItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Custom Dropdown Open States
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");

  // Table City Filter Custom Dropdown State
  const [isFilterCityDropdownOpen, setIsFilterCityDropdownOpen] = useState(false);
  const [filterCitySearch, setFilterCitySearch] = useState("");

  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const planDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const filterCityDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (planDropdownRef.current && !planDropdownRef.current.contains(event.target as Node)) {
        setIsPlanDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (filterCityDropdownRef.current && !filterCityDropdownRef.current.contains(event.target as Node)) {
        setIsFilterCityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // New / Edit Restaurant Form State
  const [formState, setFormState] = useState({
    name: "",
    branch: "",
    city: "",
    category: "",
    outlets: "",
    planTier: "",
    ownerName: "",
    phone: "",
    email: "",
    currentPassword: "",
    password: "",
    confirmPassword: "",
    status: "" as RestaurantStatus | "",
    logoUrl: "",
    businessType: "standalone" as "franchise" | "standalone",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);
  const [hasAttemptedPasswordSubmit, setHasAttemptedPasswordSubmit] = useState(false);

  // Restaurant Admin Password Validation Rules
  const restRuleLength = formState.password.length >= 8;
  const restRuleUpper = /[A-Z]/.test(formState.password);
  const restRuleLower = /[a-z]/.test(formState.password);
  const restRuleNumber = /[0-9]/.test(formState.password);
  const restRuleSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(formState.password);
  const restRuleMatch = Boolean(
    formState.password.length > 0 &&
    formState.confirmPassword.length > 0 &&
    formState.password === formState.confirmPassword
  );
  const allRestPasswordRulesValid =
    restRuleLength &&
    restRuleUpper &&
    restRuleLower &&
    restRuleNumber &&
    restRuleSpecial &&
    restRuleMatch;

  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [outletMode, setOutletMode] = useState<"standalone" | "multi">("standalone");
  const [branchesList, setBranchesList] = useState<BranchItem[]>([]);
  const [branchNameInput, setBranchNameInput] = useState("");
  const [branchAddressInput, setBranchAddressInput] = useState("");
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Logo Upload State
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Logo file size must be under 5MB.");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to upload logo.");
      }

      if (data.url) {
        setFormState((prev) => ({ ...prev, logoUrl: data.url }));
        showToast("Brand logo uploaded successfully!");
      }
    } catch (err: any) {
      showToast(err.message || "Logo upload failed. Please try again.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormState((prev) => ({ ...prev, logoUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    showToast("Brand logo removed.");
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddBranch = () => {
    let nameTrimmed = branchNameInput.trim();
    const addressTrimmed = branchAddressInput.trim();
    if (!nameTrimmed) {
      if (branchesList.length === 0 && formState.name.trim()) {
        nameTrimmed = `${formState.name.trim()} (Main Branch)`;
      } else {
        showToast("Branch name is required.");
        return;
      }
    }
    if (branchesList.length === 0) {
      if (!nameTrimmed.toLowerCase().includes("main branch")) {
        const cleanName = nameTrimmed.replace(/\s*branch$/i, "").trim();
        nameTrimmed = `${cleanName || formState.name.trim() || "Main"} (Main Branch)`;
      }
    }
    if (branchesList.some((b) => b.name.toLowerCase() === nameTrimmed.toLowerCase())) {
      showToast(`Branch "${nameTrimmed}" is already added.`);
      return;
    }
    const updated = [...branchesList, { name: nameTrimmed, address: addressTrimmed }];
    setBranchesList(updated);
    setFormState((prev) => ({ ...prev, outlets: String(updated.length) }));
    setBranchNameInput("");
    setBranchAddressInput("");
    setIsAddingBranch(false);
  };

  const handleRemoveBranch = (indexToRemove: number) => {
    const updated = branchesList.filter((_, i) => i !== indexToRemove);
    setBranchesList(updated);
    setFormState((prev) => ({ ...prev, outlets: String(updated.length || "") }));
  };

  // Open Edit Mode with existing restaurant data preloaded
  const handleEditRestaurant = (item: RestaurantItem, updateUrl: boolean = true) => {
    setEditingRestaurantId(item.id);
    setHasAttemptedPasswordSubmit(false);
    setShowCurrentPassword(false);
    setShowAdminPassword(false);
    setShowAdminConfirmPassword(false);
    setFormState({
      name: item.name || "",
      branch: item.branch || item.hqAddress || "",
      city: item.city || "Lahore",
      category: item.category || "Fine Dining",
      outlets: String(item.outlets || 1),
      planTier: item.planTier || (realtimePlans[0] || "Enterprise Plus"),
      ownerName: item.ownerName || "",
      phone: item.phone || "",
      email: item.email || "",
      currentPassword: "",
      password: "",
      confirmPassword: "",
      status: item.status || "Active",
      logoUrl: item.logoUrl || "",
      businessType: item.outletType === "multi" || item.isMultiBranch ? "franchise" : "standalone",
    });

    const branches: BranchItem[] = item.branches && item.branches.length > 0
      ? item.branches.map((b: any, idx: number) => {
        if (typeof b === "string") {
          return { name: idx === 0 ? `${item.name} (Main Branch)` : b, address: "" };
        }
        let bName = b.name || "";
        let bAddress = b.address || "";
        if (idx === 0) {
          bName = `${item.name} (Main Branch)`;
        } else if (!bName || bName === bAddress || bName === item.branch || bName === item.hqAddress) {
          bName = `${item.name} Branch ${idx + 1}`;
        }
        return { name: bName, address: bAddress || item.hqAddress || item.branch || "" };
      })
      : [{ name: `${item.name} (Main Branch)`, address: item.hqAddress || item.branch || "" }];
    setBranchesList(branches);
    setOutletMode(branches.length > 1 || item.outlets > 1 ? "multi" : "standalone");
    setSelectedAddOns(item.enabledModules || []);
    setIsAddingRestaurant(true);
    setSelectedRestaurant(null);

    if (updateUrl && typeof window !== "undefined") {
      window.history.pushState(null, "", `/super-admin/restaurants/edit?id=${item.id}`);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  };

  // Sync mode with current URL and navigation reset
  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const search = window.location.search;
      const params = new URLSearchParams(search);

      if (path.endsWith("/new") || initialMode === "new") {
        setIsAddingRestaurant(true);
        setEditingRestaurantId(null);
      } else if (path.includes("/restaurants/edit") || initialMode === "edit") {
        setIsAddingRestaurant(true);
        const idParam = params.get("id");
        if (idParam) {
          setEditingRestaurantId(idParam);
          const source = restaurants.length > 0 ? restaurants : getCachedRestaurants();
          const found = source.find((r) => String(r.id) === String(idParam));
          if (found) {
            handleEditRestaurant(found, false);
          }
        }
      } else {
        setIsAddingRestaurant(false);
        setEditingRestaurantId(null);
      }
    } else {
      setIsAddingRestaurant(initialMode === "new" || initialMode === "edit");
    }
  }, [initialMode, resetTrigger]);

  // When restaurants list is loaded/updated, prefill edit form if ID is present in URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path.includes("/restaurants/edit") || initialMode === "edit") {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get("id");
      if (idParam && restaurants.length > 0) {
        const found = restaurants.find((r) => String(r.id) === String(idParam));
        if (found) {
          handleEditRestaurant(found, false);
        }
      }
    }
  }, [restaurants]);

  // Sync mode with URL popstate (Back/Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const search = window.location.search;
        const params = new URLSearchParams(search);

        if (path.endsWith("/new")) {
          setIsAddingRestaurant(true);
          setEditingRestaurantId(null);
        } else if (path.includes("/restaurants/edit")) {
          setIsAddingRestaurant(true);
          const idParam = params.get("id");
          if (idParam) {
            setEditingRestaurantId(idParam);
            const source = restaurants.length > 0 ? restaurants : getCachedRestaurants();
            const found = source.find((r) => String(r.id) === String(idParam));
            if (found) {
              handleEditRestaurant(found, false);
            }
          }
        } else {
          setIsAddingRestaurant(false);
          setEditingRestaurantId(null);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [restaurants]);

  const handleOpenAddForm = () => {
    setEditingRestaurantId(null);
    setHasAttemptedPasswordSubmit(false);
    setShowCurrentPassword(false);
    setShowAdminPassword(false);
    setShowAdminConfirmPassword(false);
    setFormState({
      name: "",
      branch: "",
      city: "",
      category: "",
      outlets: "",
      planTier: "",
      ownerName: "",
      phone: "",
      email: "",
      currentPassword: "",
      password: "",
      confirmPassword: "",
      status: "",
      logoUrl: "",
      businessType: "standalone",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedAddOns([]);
    setOutletMode("standalone");
    setBranchesList([]);
    setBranchNameInput("");
    setBranchAddressInput("");
    setIsAddingBranch(false);
    setIsAddingRestaurant(true);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/super-admin/restaurants/new");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  };

  const handleCloseAddForm = () => {
    setIsAddingRestaurant(false);
    setEditingRestaurantId(null);
    setHasAttemptedPasswordSubmit(false);
    setIsAddingBranch(false);
    setBranchNameInput("");
    setBranchAddressInput("");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/super-admin/restaurants");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  };

  const handleDeployRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();

    const brandName = formState.name.trim();
    const ownerEmail = formState.email.trim();
    const contactPerson = formState.ownerName.trim();
    const ownerPassword = formState.password.trim();

    // 1. Mandatory Validations
    if (!brandName) {
      showToast("Restaurant brand name is required.");
      return;
    }

    if (!contactPerson) {
      showToast("Contact person full name is required.");
      return;
    }

    if (!ownerEmail) {
      showToast("Owner email is mandatory.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      showToast("Please provide a valid owner email address.");
      return;
    }

    if (!editingRestaurantId) {
      if (!ownerPassword) {
        setHasAttemptedPasswordSubmit(true);
        showToast("Admin login password is required.");
        return;
      }
      if (!formState.confirmPassword) {
        setHasAttemptedPasswordSubmit(true);
        showToast("Please confirm the admin password.");
        return;
      }
      if (ownerPassword !== formState.confirmPassword) {
        setHasAttemptedPasswordSubmit(true);
        showToast("Admin password and confirm password do not match.");
        return;
      }
      if (!allRestPasswordRulesValid) {
        setHasAttemptedPasswordSubmit(true);
        showToast("Please satisfy all password security requirements highlighted in red.");
        return;
      }
    } else {
      if (ownerPassword || formState.confirmPassword || formState.currentPassword) {
        if (!ownerPassword) {
          setHasAttemptedPasswordSubmit(true);
          showToast("Please enter new admin password.");
          return;
        }
        if (!formState.confirmPassword) {
          setHasAttemptedPasswordSubmit(true);
          showToast("Please confirm the new admin password.");
          return;
        }
        if (ownerPassword !== formState.confirmPassword) {
          setHasAttemptedPasswordSubmit(true);
          showToast("New password and confirm password do not match.");
          return;
        }
        if (!allRestPasswordRulesValid) {
          setHasAttemptedPasswordSubmit(true);
          showToast("Please satisfy all password security requirements highlighted in red.");
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      let effectiveBranches = [...branchesList];
      if (outletMode === "multi") {
        if (branchNameInput.trim()) {
          const nameTrimmed = branchNameInput.trim();
          const addressTrimmed = branchAddressInput.trim();
          if (!effectiveBranches.some((b) => b.name.toLowerCase() === nameTrimmed.toLowerCase())) {
            effectiveBranches.push({ name: nameTrimmed, address: addressTrimmed });
          }
        }
        if (effectiveBranches.length === 0) {
          effectiveBranches = [
            {
              name: `${brandName} (Main Branch)`,
              address: formState.branch.trim() || formState.city.trim() || "",
              type: "franchise",
            },
          ];
        } else {
          effectiveBranches = effectiveBranches.map((b, idx) => {
            let bName = b.name;
            if (idx === 0) {
              bName = `${brandName} (Main Branch)`;
            } else if (bName === formState.branch.trim() || bName === b.address) {
              bName = `${brandName} Branch ${idx + 1}`;
            }
            return {
              ...b,
              name: bName,
              type: "franchise",
            };
          });
        }
      } else {
        effectiveBranches = [
          {
            name: `${brandName} (Main Branch)`,
            address: formState.branch.trim() || formState.city.trim() || "",
            type: "standalone",
          },
        ];
      }

      const branchesPayload = effectiveBranches;

      if (editingRestaurantId) {
        // UPDATE EXISTING RESTAURANT (PUT)
        const updatePayload: Record<string, any> = {
          id: editingRestaurantId,
          brand_name: brandName,
          city: formState.city.trim() || "Lahore",
          cuisine: formState.category || "Fine Dining",
          hq_address: formState.branch.trim() || (branchesList[0]?.address || "Main Branch"),
          contact_person: contactPerson,
          phone: formState.phone.trim() || "+92 300 0000000",
          owner_email: ownerEmail,
          assigned_plan: formState.planTier || (realtimePlans[0] || "Enterprise Plus"),
          initial_status: formState.status || "Active",
          branches: branchesPayload,
          enabled_modules: selectedAddOns,
          logo_url: formState.logoUrl || null,
        };
        if (ownerPassword) {
          updatePayload.owner_password = ownerPassword;
        }

        const res = await fetch("/api/super-admin/restaurants", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });

        const result = await res.json();
        if (!res.ok || result.error) {
          throw new Error(result.error || "Failed to update restaurant.");
        }

        if (result.restaurant) {
          const mappedUpdated = mapSupabaseRestaurant(result.restaurant);
          setRestaurants((prev) => prev.map((r) => (r.id === mappedUpdated.id ? mappedUpdated : r)));
          setTimeout(() => {
            if (typeof window !== "undefined") {
              try {
                const current = getCachedRestaurants();
                const next = current.map((r) => (r.id === mappedUpdated.id ? mappedUpdated : r));
                localStorage.setItem(CACHE_KEY, JSON.stringify(next.length > 0 ? next : [mappedUpdated]));
                window.dispatchEvent(new Event("storage"));
                window.dispatchEvent(new CustomEvent("sa_restaurants_updated"));
              } catch { }
            }
          }, 0);
        }

        if (outletMode === "multi") {
          showToast(`🎉 "${brandName}" updated as Franchise Owner (${effectiveBranches.length} Outlets)!`);
        } else {
          showToast(`🎉 "${brandName}" updated as Standalone Outlet!`);
        }
      } else {
        // CREATE NEW RESTAURANT (POST)
        const res = await fetch("/api/super-admin/restaurants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_name: brandName,
            city: formState.city.trim() || "Lahore",
            cuisine: formState.category || "Fine Dining",
            hq_address: formState.branch.trim() || (branchesList[0]?.address || "Main Branch"),
            contact_person: contactPerson,
            phone: formState.phone.trim() || "+92 300 0000000",
            owner_email: ownerEmail,
            owner_password: ownerPassword,
            assigned_plan: formState.planTier || (realtimePlans[0] || "Enterprise Plus"),
            initial_status: formState.status || "Active",
            branches: branchesPayload,
            enabled_modules: selectedAddOns,
            logo_url: formState.logoUrl || null,
          }),
        });

        const result = await res.json();

        if (!res.ok || result.error) {
          throw new Error(result.error || "Failed to deploy restaurant.");
        }

        if (result.restaurant) {
          const mappedNew = mapSupabaseRestaurant(result.restaurant);
          setRestaurants((prev) => [mappedNew, ...prev.filter((r) => r.id !== mappedNew.id)]);
          setTimeout(() => {
            if (typeof window !== "undefined") {
              try {
                const current = getCachedRestaurants();
                const next = [mappedNew, ...current.filter((r) => r.id !== mappedNew.id)];
                localStorage.setItem(CACHE_KEY, JSON.stringify(next));
                window.dispatchEvent(new Event("storage"));
                window.dispatchEvent(new CustomEvent("sa_restaurants_updated"));
              } catch { }
            }
          }, 0);
        }

        if (outletMode === "multi") {
          showToast(`🎉 "${brandName}" deployed as Franchise Owner (${effectiveBranches.length} Outlets)!`);
        } else {
          showToast(`🎉 "${brandName}" deployed as Standalone Outlet!`);
        }
      }

      setIsSubmitting(false);
      handleCloseAddForm();

      // Reset form to empty placeholders
      setFormState({
        name: "",
        branch: "",
        city: "",
        category: "",
        outlets: "",
        planTier: "",
        ownerName: "",
        phone: "",
        email: "",
        currentPassword: "",
        password: "",
        confirmPassword: "",
        status: "",
        logoUrl: "",
        businessType: "standalone",
      });
      setShowCurrentPassword(false);
      setShowAdminPassword(false);
      setShowAdminConfirmPassword(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSelectedAddOns([]);
      setBranchesList([]);
      setBranchNameInput("");
      setBranchAddressInput("");
      setIsAddingBranch(false);
      setEditingRestaurantId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save restaurant";
      console.error("[Save Restaurant Error]:", err);
      showToast(`Error: ${msg}`);
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = handleDeployRestaurant;

  const handleUpdateStatus = async (id: string, nextStatus: RestaurantStatus) => {
    const target = restaurants.find((r) => r.id === id);
    if (!target) return;

    const updated = restaurants.map((r) =>
      r.id === id ? { ...r, status: nextStatus } : r
    );

    setRestaurants(updated);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event("storage"));
          window.dispatchEvent(new CustomEvent("sa_restaurants_updated"));
        } catch { }
      }
    }, 0);
    showToast(`Restaurant "${target.name}" status updated to ${nextStatus}`);

    try {
      await fetch("/api/super-admin/restaurants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, initial_status: nextStatus }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestDelete = (item: RestaurantItem) => {
    setRestaurantToDelete(item);
  };

  const handleConfirmDelete = async () => {
    if (!restaurantToDelete) return;
    const target = restaurantToDelete;
    setIsDeleting(true);

    const updated = restaurants.filter((r) => r.id !== target.id);
    setRestaurants(updated);
    setTimeout(() => {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
          window.dispatchEvent(new Event("storage"));
          window.dispatchEvent(new CustomEvent("sa_restaurants_updated"));
        } catch { }
      }
    }, 0);
    if (selectedRestaurant?.id === target.id) {
      setSelectedRestaurant(null);
    }
    showToast(`Restaurant "${target?.name || "Partner"}" deleted from database.`);

    try {
      await fetch(`/api/super-admin/restaurants?id=${target.id}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
      setRestaurantToDelete(null);
    }
  };

  const handleExportCSV = () => {
    showToast("Exporting registered restaurant directory CSV...");
    const headers = "ID,Name,Branch,City,Category,Outlets,Monthly Revenue,Orders,Rating,Status,Plan,Owner,Phone\n";
    const rows = filtered
      .map(
        (r) =>
          `"${r.id}","${r.name}","${r.branch}","${r.city}","${r.category}",${r.outlets},"${r.revenue}",${r.ordersMonthly},"${r.rating}","${r.status}","${r.planTier}","${r.ownerName}","${r.phone}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `omnibites_restaurants_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered restaurants list
  const filtered = restaurants.filter((r) => {
    if (!r) return false;
    const name = String(r.name || (r as any).brand_name || "").toLowerCase();
    const branch = String(r.branch || (r as any).hq_address || "").toLowerCase();
    const city = String(r.city || "").toLowerCase();
    const ownerName = String(r.ownerName || (r as any).contact_person || "").toLowerCase();
    const category = String(r.category || (r as any).cuisine || "").toLowerCase();

    // Effective search query from header search
    const s = (globalSearchQuery !== undefined ? globalSearchQuery : search).toLowerCase().trim();

    let matchesSearch = true;
    if (s) {
      if (globalSearchType === "location") {
        let branchMatch = false;
        if (Array.isArray(r.branches)) {
          branchMatch = r.branches.some((b: any) => {
            const bName = typeof b === "string" ? b : b?.name || "";
            const bAddr = typeof b === "object" ? b?.address || "" : "";
            return bName.toLowerCase().includes(s) || bAddr.toLowerCase().includes(s);
          });
        }
        matchesSearch = city.includes(s) || branch.includes(s) || branchMatch;
      } else {
        matchesSearch =
          name.includes(s) ||
          branch.includes(s) ||
          city.includes(s) ||
          ownerName.includes(s) ||
          category.includes(s);
      }
    }

    const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;
    const matchesCity = cityFilter === "all" ? true : r.city === cityFilter;

    return matchesSearch && matchesStatus && matchesCity;
  });

  // Cities filtered by search input in dropdown
  const filteredCities = ALL_CITIES.filter((c) =>
    c.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  const filteredCitiesForTable = ALL_CITIES.filter((c) =>
    c.toLowerCase().includes(filterCitySearch.toLowerCase())
  );

  // ===================== 1. FULL PAGE: ADD NEW RESTAURANT VIEW =====================
  if (isAddingRestaurant) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 pb-12 md:pb-6 w-full max-w-full min-w-0">
        {/* Top Header with Back Arrow */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <button
              type="button"
              onClick={handleCloseAddForm}
              className="p-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer group shrink-0"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider">
              <Store className="w-3.5 h-3.5" />
              <span>Omnibites Vendor Ecosystem</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold text-[var(--text-hi)] tracking-tight">
            {editingRestaurantId ? (
              <>
                Manage &amp; Edit <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">{formState.name || "Restaurant"}</span>
              </>
            ) : (
              <>
                Register New <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Restaurant</span>
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            {editingRestaurantId
              ? "Update franchise branch locations, brand info, owner credentials, and active subscription modules."
              : "Deploy POS & kitchen instance, configure franchise outlets, and grant owner management credentials."}
          </p>
        </div>

        {/* Full Width Form Container */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-8 border border-[var(--gold)]/40 shadow-2xl">
          <form onSubmit={handleFormSubmit} className="space-y-8 text-xs">
            {/* Section 1: Brand & Regional Identity */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
                <Building2 className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="font-bold text-sm sm:text-base text-[var(--text-hi)]">
                  Brand Identity &amp; Location
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Restaurant Scale & Hierarchy Type (Franchise vs Standalone) */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Restaurant Hierarchy &amp; Business Model <span className="text-[var(--gold)]">*</span></span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, businessType: "franchise" })}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 ${formState.businessType === "franchise"
                          ? "bg-[var(--gold-dim)] border-[var(--gold)] shadow-md shadow-[var(--gold-glow)]/15"
                          : "bg-[var(--surface-hi)] border-[var(--border)] hover:border-[var(--gold)]/40 text-[var(--text-lo)]"
                        }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 ${formState.businessType === "franchise" ? "bg-[var(--gold)] text-black" : "bg-[var(--surface)] text-[var(--gold)]"}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-hi)]">
                            Franchise (Multi-Branch HQ)
                          </span>
                          {formState.businessType === "franchise" && (
                            <span className="px-1.5 py-0.2 rounded bg-[var(--gold)] text-black text-[9px] font-mono font-black uppercase">Active</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-lo)] mt-0.5 leading-relaxed">
                          Multi-branch network with central HQ controls, dynamic branch provisioning, and delegatable outlets.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormState({ ...formState, businessType: "standalone" })}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 ${formState.businessType === "standalone"
                          ? "bg-[var(--gold-dim)] border-[var(--gold)] shadow-md shadow-[var(--gold-glow)]/15"
                          : "bg-[var(--surface-hi)] border-[var(--border)] hover:border-[var(--gold)]/40 text-[var(--text-lo)]"
                        }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 ${formState.businessType === "standalone" ? "bg-[var(--gold)] text-black" : "bg-[var(--surface)] text-[var(--gold)]"}`}>
                        <Store className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-hi)]">
                            Standalone (Single Outlet)
                          </span>
                          {formState.businessType === "standalone" && (
                            <span className="px-1.5 py-0.2 rounded bg-[var(--gold)] text-black text-[9px] font-mono font-black uppercase">Active</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-lo)] mt-0.5 leading-relaxed">
                          Independent single-outlet restaurant with dedicated POS counter, KDS, and direct billing.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Brand Name */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                    Restaurant Brand Name <span className="text-[var(--gold)]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. Royal Taj Continental / Bundu Khan Traditional"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                  />
                </div>

                {/* City / Metro Hub - Custom Searchable Dropdown with placeholder */}
                <div className="space-y-1.5 relative" ref={cityDropdownRef}>
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                    City / Metro Hub
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCityDropdownOpen(!isCityDropdownOpen);
                        setCitySearchQuery("");
                      }}
                      className="w-full flex items-center justify-between bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-sm text-[var(--text-hi)] cursor-pointer text-left transition-all"
                    >
                      <span className="truncate font-medium flex items-center gap-2">
                        <MapPin className={`w-3.5 h-3.5 ${formState.city ? "text-[var(--gold)]" : "text-[var(--text-faint)]"}`} />
                        {formState.city ? (
                          <span className="text-[var(--text-hi)]">{formState.city}</span>
                        ) : (
                          <span className="text-[var(--text-faint)]">Select or type city name...</span>
                        )}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${isCityDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
                          }`}
                      />
                    </button>

                    {isCityDropdownOpen && (
                      <div className="absolute left-0 top-[calc(100%+6px)] w-full bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl p-2 shadow-2xl z-50 space-y-2 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                        {/* Search / Type Custom City input inside dropdown */}
                        <div className="relative p-1">
                          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                          <input
                            type="text"
                            value={citySearchQuery}
                            onChange={(e) => {
                              setCitySearchQuery(e.target.value);
                              setFormState({ ...formState, city: e.target.value });
                            }}
                            placeholder="Type or search city (e.g. Lahore, Dubai, London...)"
                            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-8 pr-3 py-2 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none"
                            autoFocus
                          />
                        </div>

                        {/* Scrollable list of all cities */}
                        <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                          {filteredCities.length === 0 ? (
                            <div
                              onClick={() => {
                                if (citySearchQuery.trim()) {
                                  setFormState({ ...formState, city: citySearchQuery.trim() });
                                }
                                setIsCityDropdownOpen(false);
                              }}
                              className="p-2.5 rounded-xl bg-[var(--surface-hi)] text-[var(--gold)] text-xs font-semibold cursor-pointer text-center"
                            >
                              Use custom city: &ldquo;{citySearchQuery}&rdquo;
                            </div>
                          ) : (
                            filteredCities.map((cityName) => (
                              <button
                                key={cityName}
                                type="button"
                                onClick={() => {
                                  setFormState({ ...formState, city: cityName });
                                  setIsCityDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${formState.city === cityName
                                  ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                                  : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                                  }`}
                              >
                                <span>{cityName}</span>
                                {formState.city === cityName && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cuisine / Category Format - Custom Dropdown with placeholder */}
                <div className="space-y-1.5 relative" ref={categoryDropdownRef}>
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                    Cuisine / Category Format
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full flex items-center justify-between bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-sm text-[var(--text-hi)] cursor-pointer text-left transition-all"
                    >
                      <span className="truncate font-medium">
                        {formState.category ? (
                          <span className="text-[var(--text-hi)]">{formState.category}</span>
                        ) : (
                          <span className="text-[var(--text-faint)]">Select cuisine / category format...</span>
                        )}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${isCategoryDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
                          }`}
                      />
                    </button>

                    {isCategoryDropdownOpen && (
                      <div className="absolute left-0 top-[calc(100%+6px)] w-full bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl p-1.5 shadow-2xl z-50 space-y-1 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 max-h-56 overflow-y-auto">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setFormState({ ...formState, category: cat });
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${formState.category === cat
                              ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                              : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                              }`}
                          >
                            <span>{cat}</span>
                            {formState.category === cat && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Branch Location */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                    Headquarters / Primary Branch Address
                  </label>
                  <input
                    type="text"
                    value={formState.branch}
                    onChange={(e) => setFormState({ ...formState, branch: e.target.value })}
                    placeholder="e.g. MM Alam Road, Gulberg III / F-7 Markaz, Main Boulevard"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                  />
                </div>

                {/* Restaurant Brand Logo / Icon Upload & White-labeling */}
                <div className="space-y-2 md:col-span-2 pt-2 border-t border-[var(--border)]/60">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-[var(--text-hi)] uppercase text-xs flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Restaurant Brand Logo / Icon</span>
                      <span className="text-[10px] lowercase text-[var(--text-faint)] font-normal hidden sm:inline">(for white-labeled tenant dashboards)</span>
                    </label>
                  </div>

                  {/* Persistent Hidden File Input (Always in DOM) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleLogoFileUpload(e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                    className="hidden"
                  />

                  {/* If logo is already selected/uploaded: Show rich Live Preview & Action Box */}
                  {formState.logoUrl ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--gold)]/40 shadow-lg shadow-[var(--gold-glow)] gap-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Logo Preview Avatar - Clickable to change logo */}
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          title="Click to change logo"
                          className="relative w-16 h-16 rounded-2xl bg-[var(--bg-deep)] border-2 border-[var(--gold)]/60 overflow-hidden flex items-center justify-center shrink-0 shadow-md cursor-pointer group"
                        >
                          <img
                            src={formState.logoUrl}
                            alt="Brand Logo Preview"
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[var(--gold)]">
                            <RefreshCw className={`w-5 h-5 ${isUploadingLogo ? "animate-spin" : ""}`} />
                          </div>
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[var(--text-hi)] truncate">
                              {formState.name || "Brand Logo"}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#25d366]/20 text-[#25d366] text-[10px] font-mono font-bold uppercase border border-[#25d366]/30">
                              Active Logo
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--gold)] font-medium">
                            ✓ Ready to display on tenant sidebar &amp; POS header
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isUploadingLogo ? "animate-spin text-[var(--gold)]" : ""}`} />
                          <span>{isUploadingLogo ? "Uploading..." : "Change Logo"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          disabled={isUploadingLogo}
                          className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* If no logo uploaded yet: Clean Drag-and-Drop file picker */
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleLogoFileUpload(e.dataTransfer.files[0]);
                        }
                      }}
                      className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group ${isUploadingLogo
                        ? "border-[var(--gold)] bg-[var(--gold-dim)]/40 animate-pulse pointer-events-none"
                        : "border-[var(--border-hi)] hover:border-[var(--gold)]/70 bg-[var(--surface-hi)]/40 hover:bg-[var(--surface-hi)]"
                        }`}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/30 group-hover:scale-110 transition-transform">
                        {isUploadingLogo ? (
                          <RefreshCw className="w-5 h-5 animate-spin text-[var(--gold)]" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-[var(--text-hi)]">
                          {isUploadingLogo ? (
                            "Uploading Brand Logo..."
                          ) : (
                            <>
                              <span className="text-[var(--gold)] underline cursor-pointer">Click to upload</span> or drag and drop
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-[var(--text-faint)]">
                          PNG, SVG, JPG, or WebP (Recommended 512x512px, max 5MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Owner & Primary Contact */}
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
                <Users className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="font-bold text-sm sm:text-base text-[var(--text-hi)]">
                  Franchise Owner / Primary Contact
                </h3>
              </div>

              <div className="space-y-4">
                {/* Row 1: Contact Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Owner Name */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                      Contact Person Full Name <span className="text-[var(--gold)]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.ownerName}
                      onChange={(e) => setFormState({ ...formState, ownerName: e.target.value })}
                      placeholder="e.g. Tariq Mehmood"
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                      Phone / WhatsApp Contact
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formState.phone}
                        onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                        placeholder="+92 300 1234567"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Email - Mandatory for Supabase Auth */}
                  <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                    <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                      Owner Email (Login Email) <span className="text-[var(--gold)]">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={formState.email}
                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                        placeholder="owner@restaurant.pk"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Passwords */}
                {editingRestaurantId ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Current Admin Password */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                        Current Admin Password
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={formState.currentPassword}
                          onChange={(e) => setFormState({ ...formState, currentPassword: e.target.value })}
                          placeholder="Enter current password"
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1 cursor-pointer"
                        >
                          {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* New Admin Password */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                        New Admin Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showAdminPassword ? "text" : "password"}
                          value={formState.password}
                          onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                          placeholder="Enter new login password"
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1 cursor-pointer"
                        >
                          {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Admin Password */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                        Confirm Admin Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showAdminConfirmPassword ? "text" : "password"}
                          value={formState.confirmPassword}
                          onChange={(e) => setFormState({ ...formState, confirmPassword: e.target.value })}
                          placeholder="Confirm new password"
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminConfirmPassword(!showAdminConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1 cursor-pointer"
                        >
                          {showAdminConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Admin Password */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                        Admin Login Password <span className="text-[var(--gold)]">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showAdminPassword ? "text" : "password"}
                          required
                          value={formState.password}
                          onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                          placeholder="Set login password"
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1 cursor-pointer"
                        >
                          {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Admin Password */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                        Confirm Admin Password <span className="text-[var(--gold)]">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showAdminConfirmPassword ? "text" : "password"}
                          required
                          value={formState.confirmPassword}
                          onChange={(e) => setFormState({ ...formState, confirmPassword: e.target.value })}
                          placeholder="Confirm login password"
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminConfirmPassword(!showAdminConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1 cursor-pointer"
                        >
                          {showAdminConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Password Requirements Checklist for Restaurant Admin */}
                {(() => {
                  const isPasswordTouched = Boolean(
                    formState.password.length > 0 ||
                    formState.confirmPassword.length > 0 ||
                    formState.currentPassword.length > 0 ||
                    hasAttemptedPasswordSubmit
                  );
                  const validCount = [restRuleLength, restRuleUpper, restRuleLower, restRuleNumber, restRuleSpecial, restRuleMatch].filter(Boolean).length;

                  return (
                    <div className="p-3.5 sm:p-4 rounded-2xl border border-[var(--border)] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck
                            className={`w-4 h-4 ${isPasswordTouched && !allRestPasswordRulesValid
                                ? "text-[#ef4444] [data-theme=light]_&:text-[#dc2626]"
                                : allRestPasswordRulesValid
                                  ? "text-[#25d366] [data-theme=light]_&:text-[#15803d]"
                                  : "text-[var(--gold)]"
                              }`}
                          />
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)]">
                            Password Requirements
                          </span>
                        </div>
                        {isPasswordTouched && !allRestPasswordRulesValid ? (
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] border border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40">
                            {validCount} / 6 - Action Required
                          </span>
                        ) : allRestPasswordRulesValid ? (
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 text-[#25d366] [data-theme=light]_&:text-[#15803d] border border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40">
                            6 / 6 Completed
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                            0 / 6 Completed
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                        {/* Rule 1: Minimum 8 characters */}
                        {(() => {
                          const isValid = restRuleLength;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                    ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                    : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                                }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                      ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                      : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                  }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Minimum 8 characters</span>
                            </div>
                          );
                        })()}

                        {/* Rule 2: Uppercase letter (A-Z) */}
                        {(() => {
                          const isValid = restRuleUpper;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                    ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                    : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                                }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                      ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                      : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                  }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Uppercase letter (A-Z)</span>
                            </div>
                          );
                        })()}

                        {/* Rule 3: Lowercase letter (a-z) */}
                        {(() => {
                          const isValid = restRuleLower;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                    ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                    : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                                }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                      ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                      : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                  }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Lowercase letter (a-z)</span>
                            </div>
                          );
                        })()}

                        {/* Rule 4: Numeric digit (0-9) */}
                        {(() => {
                          const isValid = restRuleNumber;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                    ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                    : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                                }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                      ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                      : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                  }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Number digit (0-9)</span>
                            </div>
                          );
                        })()}

                        {/* Rule 5: Special sign / character (!@#$%) */}
                        {(() => {
                          const isValid = restRuleSpecial;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                    ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                    : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                                }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                      ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                      : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                  }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Special sign / symbol (!@#$%)</span>
                            </div>
                          );
                        })()}

                        {/* Rule 6: Passwords match */}
                        {(() => {
                          const isValid = restRuleMatch;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                    ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                    : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                                }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                      ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                      : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                  }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Confirm password matches</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Section 3: Licensing Tier & Branch Scale */}
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
                <Layers className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="font-bold text-sm sm:text-base text-[var(--text-hi)]">
                  Licensing &amp; Scale Setup
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* SaaS Plan Tier - Real-time fetched from Subscriptions & Plans with placeholder */}
                <div className="space-y-1.5 relative" ref={planDropdownRef}>
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                    Assigned Plan Tier
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                      className="w-full flex items-center justify-between bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-sm text-[var(--text-hi)] cursor-pointer text-left transition-all"
                    >
                      <span className="truncate font-medium">
                        {formState.planTier ? (
                          <span className="text-[var(--gold)] font-semibold">{formState.planTier}</span>
                        ) : (
                          <span className="text-[var(--text-faint)]">Select subscription plan tier...</span>
                        )}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${isPlanDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
                          }`}
                      />
                    </button>

                    {isPlanDropdownOpen && (
                      <div className="absolute left-0 top-[calc(100%+6px)] w-full bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl p-1.5 shadow-2xl z-50 space-y-1 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 max-h-56 overflow-y-auto">
                        {realtimePlans.map((tier) => (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => {
                              setFormState({ ...formState, planTier: tier });
                              setIsPlanDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${formState.planTier === tier
                              ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                              : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                              }`}
                          >
                            <span className="font-semibold">{tier}</span>
                            {formState.planTier === tier && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Status - Custom Dropdown with placeholder */}
                <div className="space-y-1.5 relative" ref={statusDropdownRef}>
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                    Initial Status
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                      className="w-full flex items-center justify-between bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-sm text-[var(--text-hi)] cursor-pointer text-left transition-all"
                    >
                      <span className="truncate font-medium flex items-center gap-1.5">
                        {formState.status === "Active" ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />
                            <span className="text-[#25d366]">Active &amp; Operational</span>
                          </>
                        ) : formState.status === "Deactivated" ? (
                          <>
                            <Power className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-amber-400">Deactivated / Paused</span>
                          </>
                        ) : formState.status === "Suspended" ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-red-400">Suspended / Frozen</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                            <span className="text-[var(--gold)]">Pending Review</span>
                          </>
                        )}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${isStatusDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
                          }`}
                      />
                    </button>

                    {isStatusDropdownOpen && (
                      <div className="absolute left-0 top-[calc(100%+6px)] w-full bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl p-1.5 shadow-2xl z-50 space-y-1 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={() => {
                            setFormState({ ...formState, status: "Active" });
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${formState.status === "Active"
                            ? "bg-[#25d366]/15 text-[#25d366] font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />
                            <span>Active &amp; Operational</span>
                          </div>
                          {formState.status === "Active" && <Check className="w-3.5 h-3.5 text-[#25d366]" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormState({ ...formState, status: "Deactivated" });
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${formState.status === "Deactivated"
                            ? "bg-amber-500/15 text-amber-400 font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <Power className="w-3.5 h-3.5 text-amber-400" />
                            <span>Deactivated / Paused</span>
                          </div>
                          {formState.status === "Deactivated" && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormState({ ...formState, status: "Suspended" });
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${formState.status === "Suspended"
                            ? "bg-red-500/15 text-red-400 font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                            <span>Suspended / Frozen</span>
                          </div>
                          {formState.status === "Suspended" && <Check className="w-3.5 h-3.5 text-red-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormState({ ...formState, status: "Pending" });
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${formState.status === "Pending"
                            ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                            : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                            <span>Pending Review</span>
                          </div>
                          {formState.status === "Pending" && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive Branches Addition Feature / Outlet Structure */}
              <div className="space-y-4 pt-2">
                {/* Header & Mode Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                  <div>
                    <label className="font-semibold text-[var(--text-hi)] uppercase text-xs flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Restaurant Branches / Outlets Setup</span>
                    </label>
                    <p className="text-xs text-[var(--text-faint)] mt-0.5">
                      Configure establishment structure and operational outlet scope
                    </p>
                  </div>

                  {/* Outlet Mode Toggle Switcher */}
                  <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] self-start sm:self-auto shadow-inner gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOutletMode("standalone");
                        setFormState((prev) => ({ ...prev, outlets: "1" }));
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center gap-1.5 ${outletMode === "standalone"
                        ? "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-sm font-bold"
                        : "text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-transparent"
                        }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Standalone Outlet</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOutletMode("multi");
                        setFormState((prev) => ({
                          ...prev,
                          outlets: String(branchesList.length || "1"),
                        }));
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 flex items-center gap-1.5 ${outletMode === "multi"
                        ? "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-sm font-bold"
                        : "text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-transparent"
                        }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Multi-Branch Network</span>
                      {branchesList.length > 0 && (
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${outletMode === "multi"
                            ? "bg-[var(--gold)] text-[#342c14]"
                            : "bg-[var(--gold-dim)] text-[var(--gold)]"
                            }`}
                        >
                          {branchesList.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Mode 1: Standalone Outlet Mode Preview Box */}
                {outletMode === "standalone" ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-hi)]/30 border border-[var(--border)] flex items-start sm:items-center gap-3.5 animate-in fade-in duration-200">
                    <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="text-xs font-bold text-[var(--text-hi)] flex items-center gap-2">
                        <span>Single Standalone Outlet</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#25d366]/15 text-[#25d366] text-xs font-semibold">
                          1 Branch
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-lo)]">
                        Configured as a single standalone establishment using headquarters address (
                        <span className="text-[var(--gold)] font-medium">
                          {formState.branch || "Primary Location specified in Brand Identity"}
                        </span>
                        ).
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Mode 2: Multi-Branch Network Dynamic Management */
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Add Branch Trigger or Input Form */}
                    {isAddingBranch ? (
                      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-hi)]/40 border border-[var(--gold)]/40 shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                          <span className="text-xs font-bold text-[var(--text-hi)] flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5 text-[var(--gold)]" />
                            <span>Add New Franchise Branch</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingBranch(false);
                              setBranchNameInput("");
                              setBranchAddressInput("");
                            }}
                            className="text-[var(--text-lo)] hover:text-[var(--text-hi)] p-1 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Branch Name Input */}
                          <div className="space-y-1.5">
                            <label className="font-semibold text-[var(--text-hi)] uppercase text-xs flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-[var(--gold)]" />
                              <span>
                                Branch Name <span className="text-[var(--gold)]">*</span>
                              </span>
                            </label>
                            <div className="relative">
                              <Store className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                autoFocus
                                value={branchNameInput}
                                onChange={(e) => setBranchNameInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddBranch();
                                  }
                                }}
                                placeholder={
                                  branchesList.length === 0
                                    ? `e.g. ${formState.name.trim() || "Royal City"} (Main Branch)`
                                    : "e.g. Gulberg Branch, DHA Phase 6..."
                                }
                                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                              />
                            </div>
                          </div>

                          {/* Branch Address Input */}
                          <div className="space-y-1.5">
                            <label className="font-semibold text-[var(--text-hi)] uppercase text-xs flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[var(--gold)]" />
                              <span>Branch Address / Location</span>
                            </label>
                            <div className="relative">
                              <MapPin className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={branchAddressInput}
                                onChange={(e) => setBranchAddressInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddBranch();
                                  }
                                }}
                                placeholder="e.g. MM Alam Road, Block C-2, Sector 12..."
                                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingBranch(false);
                              setBranchNameInput("");
                              setBranchAddressInput("");
                            }}
                            className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddBranch}
                            className="btn-gold px-5 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 rounded-xl shadow-md"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Save Branch</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-hi)]/30 border border-[var(--border)]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[var(--text-hi)] block">
                              Multi-Branch Franchise Setup
                            </span>
                            <span className="text-xs text-[var(--text-lo)]">
                              {branchesList.length === 0
                                ? "Click Add Branch button to list and configure franchise outlets."
                                : `${branchesList.length} franchise ${branchesList.length === 1 ? "branch" : "branches"} configured.`}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (branchesList.length === 0 && !branchNameInput) {
                              setBranchNameInput(
                                formState.name.trim() ? `${formState.name.trim()} (Main Branch)` : ""
                              );
                              if (!branchAddressInput && formState.branch.trim()) {
                                setBranchAddressInput(formState.branch.trim());
                              }
                            }
                            setIsAddingBranch(true);
                          }}
                          className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 rounded-xl shadow-md"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Branch</span>
                        </button>
                      </div>
                    )}

                    {/* Branches List Display */}
                    {branchesList.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs text-[var(--text-faint)] uppercase font-semibold">
                            Configured Outlets ({branchesList.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {branchesList.map((br, index) => (
                            <div
                              key={index}
                              className="flex items-start justify-between gap-2.5 p-3.5 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] group hover:border-[var(--gold)]/40 transition-all animate-in fade-in zoom-in-95 duration-150"
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <span className="w-6 h-6 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                  #{index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-[var(--text-hi)] truncate" title={br.name}>
                                    {br.name}
                                  </div>
                                  {br.address && (
                                    <div
                                      className="text-xs text-[var(--text-faint)] truncate flex items-center gap-1 mt-0.5"
                                      title={br.address}
                                    >
                                      <MapPin className="w-2.5 h-2.5 text-[var(--gold)] shrink-0" />
                                      <span className="truncate">{br.address}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveBranch(index)}
                                className="p-1 rounded-lg text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0 mt-0.5"
                                title="Remove branch"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Add-on Entitlements */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
                <Sparkles className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="font-bold text-sm sm:text-base text-[var(--text-hi)]">
                  Add-on Entitlements
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {ADD_ON_ENTITLEMENTS.map((addon) => {
                  const isChecked = selectedAddOns.includes(addon.id);
                  return (
                    <label
                      key={addon.id}
                      onClick={() => toggleAddOn(addon.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${isChecked
                        ? "bg-[var(--gold-dim)] border-[var(--gold)]/60 text-[var(--text-hi)] shadow-sm"
                        : "bg-[var(--surface-hi)]/60 border-[var(--border)] text-[var(--text-lo)] hover:border-[var(--gold)]/40 hover:text-[var(--text-hi)]"
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center border transition-all shrink-0 ${isChecked
                          ? "bg-[var(--gold)] border-[var(--gold)] text-[#342c14]"
                          : "border-[var(--border-hi)] bg-[var(--bg-deep)]"
                          }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="text-xs leading-relaxed">
                        <span className="font-bold text-[var(--text-hi)]">
                          {addon.title}
                        </span>{" "}
                        <span className="text-[var(--text-faint)] font-normal">
                          ({addon.subtitle})
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleCloseAddForm}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] font-semibold text-xs cursor-pointer transition-colors text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto btn-gold px-6 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? editingRestaurantId ? "Saving Changes..." : "Deploying..."
                    : editingRestaurantId ? "Update & Save Changes" : "Deploy Restaurant Instance"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ===================== 2. MAIN DIRECTORY VIEW =====================
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 w-full max-w-full min-w-0">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full min-w-0">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider mb-2 max-w-full">
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Omnibites Vendor Ecosystem</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-[var(--text-hi)] tracking-tight">
            Restaurant <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Partners</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Manage registered restaurant brands, franchise branch networks, licensing scopes, and live statuses.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenAddForm}
            className="btn-gold text-xs px-3.5 sm:px-4 py-2 gap-1.5 font-bold cursor-pointer inline-flex items-center shadow-lg shadow-[var(--gold-glow)] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Restaurant</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Directory</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
        <div className="glass-panel p-3 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs uppercase text-[var(--text-faint)] font-semibold truncate">Total Brands</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center shrink-0">
              <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-bold text-[var(--text-hi)] truncate">
            {restaurants.length}
          </div>
          <span className="text-[10px] sm:text-xs text-[var(--gold)] block font-medium truncate">
            {restaurants.length > 0 ? `${restaurants.length} registered` : "0 brands registered"}
          </span>
        </div>

        <div className="glass-panel p-3 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs uppercase text-[var(--text-faint)] font-semibold truncate">Active Outlets</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#25d366]/15 text-[#25d366] flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-bold text-[var(--text-hi)] truncate">
            {restaurants.filter((r) => r.status === "Active").reduce((acc, r) => acc + (r.outlets || 1), 0)}
          </div>
          <span className="text-[10px] sm:text-xs text-[#25d366] block font-medium truncate">
            {restaurants.filter((r) => r.status === "Active").length > 0 ? "Live franchise outlets" : "0 outlets live"}
          </span>
        </div>

        <div className="glass-panel p-3 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs uppercase text-[var(--text-faint)] font-semibold truncate">Deactivated</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-bold text-amber-400 truncate">
            {restaurants.filter((r) => r.status === "Deactivated").length}
          </div>
          <span className="text-[10px] sm:text-xs text-[var(--text-lo)] block font-medium truncate">
            {restaurants.filter((r) => r.status === "Deactivated").length > 0 ? "Deactivated partners" : "0 deactivated"}
          </span>
        </div>

        <div className="glass-panel p-3 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs uppercase text-[var(--text-faint)] font-semibold truncate">Monthly GMV</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-bold text-[var(--gold)] truncate">
            ${restaurants
              .filter((r) => r.status === "Active")
              .reduce((acc, r) => acc + (parseFloat(String(r.revenue || "").replace(/[^0-9.]/g, "")) || 0), 0)
              .toLocaleString()}
          </div>
          <span className="text-[10px] sm:text-xs text-[#25d366] block font-medium truncate">
            {restaurants.length > 0 ? "Live volume" : "0.0% MoM"}
          </span>
        </div>
      </div>

      {/* 3. Filtering and Table Container */}
      <div className="glass-panel rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 space-y-4 border border-[var(--border)] w-full max-w-full min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-[var(--text-hi)]">Restaurant Directory</span>
            <span className="text-xs text-[var(--text-lo)] font-medium">({filtered.length} {filtered.length === 1 ? "vendor" : "vendors"})</span>
          </div>

          {/* Filters: Status and City */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
            {/* Status Segmented Control */}
            <div className="w-full sm:w-auto overflow-x-auto custom-scrollbar pb-0.5">
              <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-medium gap-0.5 shrink-0">
                {(["all", "Active", "Deactivated", "Suspended"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer text-xs font-bold shrink-0 ${statusFilter === st
                      ? "btn-gold shadow-md shadow-[var(--gold-glow)]"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)] font-medium"
                      }`}
                  >
                    {st === "all" ? `All (${restaurants.length})` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom City Dropdown Filter with search and all cities */}
            <div className="relative shrink-0" ref={filterCityDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsFilterCityDropdownOpen(!isFilterCityDropdownOpen);
                  setFilterCitySearch("");
                }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-medium text-[var(--text-hi)] transition-all cursor-pointer shadow-sm"
              >
                <MapPin className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span>{cityFilter === "all" ? "All Cities" : cityFilter}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[var(--text-lo)] transition-transform duration-200 ${isFilterCityDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
                    }`}
                />
              </button>

              {isFilterCityDropdownOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] w-60 bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl p-2 shadow-2xl z-50 space-y-2 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                  {/* Search city inside dropdown */}
                  <div className="relative p-1">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input
                      type="text"
                      value={filterCitySearch}
                      onChange={(e) => setFilterCitySearch(e.target.value)}
                      placeholder="Search city..."
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none"
                      autoFocus
                    />
                  </div>

                  {/* Scrollable list with All Cities + All Pakistani Cities */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setCityFilter("all");
                        setIsFilterCityDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${cityFilter === "all"
                        ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                        : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-[var(--gold)]" />
                        <span>All Cities</span>
                      </div>
                      {cityFilter === "all" && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                    </button>

                    {filteredCitiesForTable.map((cityName) => (
                      <button
                        key={cityName}
                        type="button"
                        onClick={() => {
                          setCityFilter(cityName);
                          setIsFilterCityDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${cityFilter === cityName
                          ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                          : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                          }`}
                      >
                        <span>{cityName}</span>
                        {cityFilter === cityName && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter helper when status or city is active */}
        {(statusFilter !== "all" || cityFilter !== "all") && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/60 text-xs animate-in fade-in duration-150">
            <span className="text-[var(--text-lo)]">
              Showing <strong>{filtered.length}</strong> of {restaurants.length} restaurants
            </span>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setCityFilter("all");
              }}
              className="text-xs text-[var(--gold)] hover:underline font-semibold cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        {/* 4. Restaurants Directory - Mobile Cards (< 768px) */}
        <div className="block md:hidden space-y-3 w-full min-w-0 pt-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[var(--text-lo)] bg-[var(--surface-hi)]/30 rounded-2xl p-4">
              <Store className="w-8 h-8 text-[var(--text-faint)] mx-auto mb-2" />
              <p className="font-semibold text-sm">
                {search || statusFilter !== "all" || cityFilter !== "all"
                  ? "No restaurants match your filters."
                  : "No registered restaurants yet."}
              </p>
              <p className="text-xs text-[var(--text-faint)] mt-1">
                {search || statusFilter !== "all" || cityFilter !== "all"
                  ? "Try clearing filters or search terms."
                  : "Click \"+ Add Restaurant\" to register your first franchise brand."}
              </p>
            </div>
          ) : (
            filtered.map((rest) => (
              <div
                key={rest.id}
                className="p-3.5 rounded-2xl bg-[var(--surface-hi)]/50 border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all space-y-3 shadow-sm"
              >
                {/* Header: Logo, Name, Location & Details CTA */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {rest.logoUrl ? (
                      <div className="w-10 h-10 rounded-xl bg-[var(--surface-hi)] border border-white/40 overflow-hidden flex items-center justify-center shadow-md shrink-0">
                        <img
                          src={rest.logoUrl}
                          alt={rest.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center border border-white/40 shadow-md shrink-0 select-none">
                        {String(rest.name || (rest as any).brand_name || "OM").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-[var(--text-hi)] truncate">
                        {rest.name || (rest as any).brand_name || "Untitled"}
                      </h4>
                      <p className="text-xs text-[var(--text-faint)] flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 text-[var(--gold)] shrink-0" />
                        <span className="truncate">{rest.category} · {rest.city}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedRestaurant(rest)}
                    className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-lo)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-xs font-semibold shrink-0 flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>
                </div>

                {/* Key Metrics / Badges Row */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)]/40 text-xs">
                  {rest.outlet_type === "multi" ||
                    rest.outletType === "multi" ||
                    rest.is_multi_branch ||
                    rest.isMultiBranch ||
                    rest.outlets > 1 ||
                    (rest.branches && rest.branches.length > 1) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--gold-dim)] border border-[var(--gold)]/40 text-[var(--gold)]">
                      <Building2 className="w-3 h-3 text-[var(--gold)]" />
                      <span>{rest.branches && rest.branches.length > 1 ? `${rest.branches.length} Outlets` : `${rest.outlets || 1} Outlets`}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)]">
                      <Store className="w-3 h-3 text-[var(--gold)]" />
                      <span>Standalone</span>
                    </span>
                  )}

                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--gold)]">
                    {rest.planTier}
                  </span>

                  <span className="ml-auto font-bold text-xs text-[var(--gold)]">
                    {rest.revenue || "$0"}
                  </span>
                </div>

                {/* Action Buttons: Status Toggles (Full Width 2 columns) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateStatus(rest.id, rest.status === "Deactivated" ? "Active" : "Deactivated")
                    }
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border select-none cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${rest.status === "Deactivated"
                        ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-[#25d366]/10 hover:bg-[#25d366]/20 text-[#25d366] border-[#25d366]/30"
                      }`}
                  >
                    {rest.status === "Deactivated" ? (
                      <>
                        <Power className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Deactivated</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366] shrink-0" />
                        <span className="truncate">Active</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateStatus(rest.id, rest.status === "Suspended" ? "Active" : "Suspended")
                    }
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border select-none cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${rest.status === "Suspended"
                        ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/35 font-semibold"
                        : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/25"
                      }`}
                  >
                    {rest.status === "Suspended" ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">Un-suspend</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="truncate">Suspend</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 5. Restaurants Directory - Desktop Table (>= 768px) */}
        <div className="hidden md:block w-full pt-2 overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[760px] text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--text-faint)]">
                <th className="pb-3 font-semibold">Restaurant Brand</th>
                <th className="pb-3 font-semibold">Category &amp; City</th>
                <th className="pb-3 font-semibold text-center">Outlets</th>
                <th className="pb-3 font-semibold text-center">Active Plan</th>
                <th className="pb-3 font-semibold text-center">Revenue</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--text-lo)]">
                    <Store className="w-8 h-8 text-[var(--text-faint)] mx-auto mb-2" />
                    <p className="font-semibold text-sm">
                      {search || statusFilter !== "all" || cityFilter !== "all"
                        ? "No restaurants match your filters."
                        : "No registered restaurants yet."}
                    </p>
                    <p className="text-xs text-[var(--text-faint)] mt-1">
                      {search || statusFilter !== "all" || cityFilter !== "all"
                        ? "Try clearing filters or search terms."
                        : "Click \"+ Add Restaurant\" to register your first franchise brand."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((rest) => (
                  <tr key={rest.id} className="group transition-colors border-b border-[var(--border)]/40">
                    {/* Brand & Location */}
                    <td className="py-4 align-middle">
                      <div className="flex items-center gap-3">
                        {rest.logoUrl ? (
                          <div className="w-9 h-9 rounded-xl bg-[var(--surface-hi)] border border-white/40 overflow-hidden flex items-center justify-center shadow-md shrink-0">
                            <img
                              src={rest.logoUrl}
                              alt={rest.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center border border-white/40 shadow-md shrink-0 select-none">
                            {String(rest.name || (rest as any).brand_name || "OM").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-semibold text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors truncate block">
                            {rest.name || (rest as any).brand_name || "Untitled"}
                          </span>
                          <span className="text-xs text-[var(--text-faint)] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {rest.branch || (rest as any).hq_address || "Main Branch"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category & City */}
                    <td className="py-4 align-middle">
                      <span className="text-xs text-[var(--text-hi)] block font-medium">
                        {rest.category}
                      </span>
                      <span className="text-xs text-[var(--text-faint)]">
                        {rest.city}, Pakistan
                      </span>
                    </td>

                    {/* Outlets Count */}
                    <td className="py-4 align-middle text-center">
                      {rest.outlet_type === "multi" ||
                        rest.outletType === "multi" ||
                        rest.is_multi_branch ||
                        rest.isMultiBranch ||
                        rest.outlets > 1 ||
                        (rest.branches && rest.branches.length > 1) ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--gold-dim)] border border-[var(--gold)]/40 text-[var(--gold)] select-none whitespace-nowrap shadow-sm">
                          <Building2 className="w-3.5 h-3.5 text-[var(--gold)]" />
                          <span>
                            {rest.branches && rest.branches.length > 1
                              ? `Franchise Owner (${rest.branches.length} Outlets)`
                              : rest.branches && rest.branches.length === 1
                                ? `Franchise Owner (1 Outlet)`
                                : rest.outlets > 1
                                  ? `Franchise Owner (${rest.outlets} Outlets)`
                                  : "Franchise Owner"}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-hi)] select-none whitespace-nowrap">
                          <Store className="w-3.5 h-3.5 text-[var(--gold)]" />
                          <span>Standalone Outlet</span>
                        </span>
                      )}
                    </td>

                    {/* Plan Tier */}
                    <td className="py-4 align-middle text-center">
                      <span className="text-xs font-semibold text-[var(--gold)]">
                        {rest.planTier}
                      </span>
                    </td>

                    {/* Revenue */}
                    <td className="py-4 align-middle text-center font-semibold text-[var(--gold)] text-sm">
                      {rest.revenue}
                    </td>

                    {/* Status Actions (Top: Active/Deactivate, Bottom: Suspend/Un-suspend) */}
                    <td className="py-4 align-middle text-center">
                      <div className="inline-flex flex-col items-center gap-1.5">
                        {/* 1. Active / Deactivate Toggle Button */}
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateStatus(rest.id, rest.status === "Deactivated" ? "Active" : "Deactivated")
                          }
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border select-none cursor-pointer transition-all hover:scale-105 active:scale-95 w-28 ${rest.status === "Deactivated"
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30 hover:border-amber-500/60"
                            : "bg-[#25d366]/10 hover:bg-[#25d366]/20 text-[#25d366] border-[#25d366]/30 hover:border-[#25d366]/60"
                            }`}
                        >
                          {rest.status === "Deactivated" ? (
                            <>
                              <Power className="w-3.5 h-3.5 text-amber-400" />
                              <span>Deactivated</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />
                              <span>Active</span>
                            </>
                          )}
                        </button>

                        {/* 2. Suspend / Un-suspend Toggle Button */}
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateStatus(rest.id, rest.status === "Suspended" ? "Active" : "Suspended")
                          }
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border select-none cursor-pointer transition-all hover:scale-105 active:scale-95 w-28 ${rest.status === "Suspended"
                            ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/35 hover:border-emerald-500/60 font-semibold"
                            : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/25 hover:border-red-500/50"
                            }`}
                        >
                          {rest.status === "Suspended" ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Un-suspend</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              <span>Suspend</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Actions - Only Details Button */}
                    <td className="py-4 align-middle text-center">
                      <div className="inline-flex items-center justify-center">
                        <button
                          onClick={() => setSelectedRestaurant(rest)}
                          className="px-3.5 py-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] text-[var(--text-lo)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all cursor-pointer text-xs font-semibold select-none flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Restaurant Details Drawer / Modal */}
      {selectedRestaurant && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setSelectedRestaurant(null)}
          />

          <div className="relative w-full max-w-lg bg-[var(--bg-deep)] border border-[var(--gold)]/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                {selectedRestaurant.logoUrl ? (
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-hi)] border border-white/40 overflow-hidden flex items-center justify-center shadow-md shrink-0">
                    <img
                      src={selectedRestaurant.logoUrl}
                      alt={selectedRestaurant.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-sm flex items-center justify-center border border-white/40 shadow-md shrink-0">
                    {String(selectedRestaurant.name || (selectedRestaurant as any).brand_name || "OM").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-lg text-[var(--text-hi)]">
                    {selectedRestaurant.name || (selectedRestaurant as any).brand_name || "Untitled Restaurant"}
                  </h4>
                  <p className="text-xs text-[var(--text-lo)]">
                    {selectedRestaurant.category || (selectedRestaurant as any).cuisine || "Dining"} · {selectedRestaurant.city || "Pakistan"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRestaurant(null)}
                className="p-1 text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
                <span className="text-xs uppercase text-[var(--text-faint)] font-medium">Branch Locations</span>
                <span className="text-sm font-semibold text-[var(--text-hi)] block">
                  {selectedRestaurant.outletType === "multi" ||
                    selectedRestaurant.outlet_type === "multi" ||
                    selectedRestaurant.isMultiBranch ||
                    selectedRestaurant.outlets > 1 ||
                    (selectedRestaurant.branches && selectedRestaurant.branches.length > 1)
                    ? `Franchise Owner (${selectedRestaurant.branches?.length || selectedRestaurant.outlets} Outlets)`
                    : "Standalone Outlet"}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
                <span className="text-xs uppercase text-[var(--text-faint)] font-medium">Monthly Revenue</span>
                <span className="text-sm font-semibold text-[var(--gold)] block">{selectedRestaurant.revenue}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
                <span className="text-xs uppercase text-[var(--text-faint)] font-medium">Owner / Primary Contact</span>
                <span className="text-xs font-semibold text-[var(--text-hi)] block">{selectedRestaurant.ownerName}</span>
                <span className="text-xs text-[var(--text-faint)]">{selectedRestaurant.phone}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
                <span className="text-xs uppercase text-[var(--text-faint)] font-medium">Active SaaS Tier</span>
                <span className="text-xs font-semibold text-[var(--gold)] block">{selectedRestaurant.planTier}</span>
                <span className="text-xs text-[var(--text-faint)]">Joined {selectedRestaurant.joinedDate}</span>
              </div>
            </div>

            {/* Registered Branches List in Details Modal */}
            {selectedRestaurant.branches && selectedRestaurant.branches.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-[var(--border)]">
                <span className="text-xs uppercase font-semibold text-[var(--text-faint)] flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Configured Branches ({selectedRestaurant.branches.length})</span>
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                  {selectedRestaurant.branches.map((b, idx) => {
                    let name = typeof b === "string" ? b : b.name;
                    const address = typeof b === "object" ? b.address : "";
                    if (idx === 0 && !name.toLowerCase().includes("main branch")) {
                      const clean = name.replace(/\s*branch$/i, "").trim();
                      name = `${clean || selectedRestaurant.name || "Main"} (Main Branch)`;
                    }
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--text-hi)] truncate">
                            #{idx + 1} {name}
                          </div>
                          {address && (
                            <div className="text-xs text-[var(--text-faint)] flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="w-2.5 h-2.5 text-[var(--gold)] shrink-0" />
                              <span className="truncate">{address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-2.5 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => handleRequestDelete(selectedRestaurant)}
                className="px-3.5 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRestaurant(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleEditRestaurant(selectedRestaurant);
                  }}
                  className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-transform"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Manage Branches</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Delete Restaurant Confirmation Modal (Theme-Aware) */}
      {restaurantToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => !isDeleting && setRestaurantToDelete(null)}
          />

          <div className="relative w-full max-w-md bg-[var(--bg-deep)] border border-red-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-red-950/50 space-y-6 z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Header with Danger Warning Badge */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle className="w-6 h-6 text-red-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg sm:text-xl text-[var(--text-hi)]">
                  Delete Restaurant?
                </h3>
                <p className="text-xs text-[var(--text-lo)] leading-relaxed">
                  Are you sure you want to permanently delete this restaurant partner and its franchise branch setup?
                </p>
              </div>
            </div>

            {/* Restaurant Preview Card */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center gap-3">
              {restaurantToDelete.logoUrl ? (
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-hi)] border border-white/40 overflow-hidden flex items-center justify-center shadow-md shrink-0">
                  <img
                    src={restaurantToDelete.logoUrl}
                    alt={restaurantToDelete.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-sm flex items-center justify-center border border-white/40 shadow-md shrink-0">
                  {String(restaurantToDelete.name || (restaurantToDelete as any).brand_name || "OM").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-[var(--text-hi)] truncate">
                  {restaurantToDelete.name || (restaurantToDelete as any).brand_name || "Untitled Restaurant"}
                </h4>
                <p className="text-xs text-[var(--text-lo)] truncate">
                  {restaurantToDelete.category || (restaurantToDelete as any).cuisine || "Dining"} · {restaurantToDelete.city || "Pakistan"} ({restaurantToDelete.outletType === "multi" || restaurantToDelete.outlet_type === "multi" || restaurantToDelete.outlets > 1 ? `Franchise Owner (${restaurantToDelete.outlets} branches)` : "Standalone Outlet"})
                </p>
              </div>
            </div>

            {/* Warning Alert Banner */}
            <div className="text-xs text-red-400 font-medium bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
              <span>This action cannot be undone. All linked branch records will be removed.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setRestaurantToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface-hi)]/80 text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Deleting..." : "Yes, Delete Restaurant"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
