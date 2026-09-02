"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

export interface RestaurantItem {
  id: string;
  name: string;
  branch: string;
  city: string;
  category: string;
  outlets: number;
  revenue: string;
  ordersMonthly: number;
  rating: string;
  status: "Active" | "Pending" | "Suspended";
  planTier: string;
  ownerName: string;
  phone: string;
  email?: string;
  joinedDate: string;
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

  if (Array.isArray(row.branches)) {
    branchCount = row.branches.length > 0 ? row.branches.length : 1;
    primaryBranch = row.branches[0] || "Main Branch";
  } else if (row.branches) {
    const parts = String(row.branches).split(",").map((s) => s.trim()).filter(Boolean);
    branchCount = parts.length > 0 ? parts.length : 1;
    primaryBranch = parts[0] || "Main Branch";
  }

  return {
    id: String(row.id),
    name: row.brand_name || "Untitled Restaurant",
    branch: row.hq_address || primaryBranch,
    city: row.city || "Lahore",
    category: row.cuisine || "Fine Dining",
    outlets: branchCount,
    revenue: "$0",
    ordersMonthly: 0,
    rating: "5.0",
    status: (row.initial_status as "Active" | "Pending" | "Suspended") || "Active",
    planTier: row.assigned_plan || "Enterprise Plus",
    ownerName: row.contact_person || "Owner",
    phone: row.phone || "+92 300 0000000",
    email: row.owner_email || "",
    joinedDate: row.created_at
      ? new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
};

const INITIAL_RESTAURANTS: RestaurantItem[] = [];

export default function RestaurantsView({
  showToast,
  initialMode,
  resetTrigger,
  onAddClick,
}: {
  showToast: (msg: string) => void;
  initialMode?: "new" | null;
  resetTrigger?: number;
  onAddClick?: () => void;
}) {
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>(INITIAL_RESTAURANTS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Pending" | "Suspended">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantItem | null>(null);

  // Fetch real-time restaurants from Supabase database API
  const fetchRestaurants = async () => {
    try {
      const res = await fetch("/api/super-admin/restaurants");
      if (res.ok) {
        const data = await res.json();
        if (data.restaurants && Array.isArray(data.restaurants)) {
          const mapped = data.restaurants.map(mapSupabaseRestaurant);
          setRestaurants(mapped);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("sa_restaurants", JSON.stringify(mapped));
            } catch {}
          }
        }
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, [resetTrigger]);

  // Real-time Plans fetched from Subscriptions & Plans
  const [realtimePlans, setRealtimePlans] = useState<string[]>(DEFAULT_PLAN_TIERS);

  // Load cached plans from sessionStorage on mount (hydration safe)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("subscription_plans");
      if (cached) {
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

  // Fetch real-time plans from backend API
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch("/api/super-admin/plans");
        if (res.ok) {
          const data = await res.json();
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
  }, []);

  // Is "Add Restaurant" full page active
  const [isAddingRestaurant, setIsAddingRestaurant] = useState(initialMode === "new");

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

  // New Restaurant Form State - ALL fields start EMPTY with placeholders
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
    password: "",
    status: "" as "Active" | "Pending" | "",
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [branchesList, setBranchesList] = useState<string[]>([]);
  const [branchInput, setBranchInput] = useState("");
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAddOn = (id: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddBranch = () => {
    const trimmed = branchInput.trim();
    if (!trimmed) return;
    if (branchesList.includes(trimmed)) {
      showToast(`Branch "${trimmed}" is already added.`);
      return;
    }
    const updated = [...branchesList, trimmed];
    setBranchesList(updated);
    setFormState((prev) => ({ ...prev, outlets: String(updated.length) }));
    setBranchInput("");
  };

  const handleRemoveBranch = (indexToRemove: number) => {
    const updated = branchesList.filter((_, i) => i !== indexToRemove);
    setBranchesList(updated);
    setFormState((prev) => ({ ...prev, outlets: String(updated.length || "") }));
  };

  // Sync mode with current URL and navigation reset
  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.endsWith("/new")) {
        setIsAddingRestaurant(true);
      } else {
        setIsAddingRestaurant(false);
      }
    } else {
      setIsAddingRestaurant(initialMode === "new");
    }
  }, [initialMode, resetTrigger]);

  // Sync mode with URL popstate (Back/Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path.endsWith("/new")) {
          setIsAddingRestaurant(true);
        } else {
          setIsAddingRestaurant(false);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleOpenAddForm = () => {
    setIsAddingRestaurant(true);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/super-admin/restaurants/new");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  };

  const handleCloseAddForm = () => {
    setIsAddingRestaurant(false);
    setIsAddingBranch(false);
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
      showToast("Owner email is mandatory to create admin user account.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      showToast("Please provide a valid owner email address.");
      return;
    }

    if (!ownerPassword) {
      showToast("Admin login password is required.");
      return;
    }

    if (ownerPassword.length < 6) {
      showToast("Admin password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const branchesPayload = branchesList.length > 0 ? branchesList : [formState.branch.trim() || "Main Branch"];

      const res = await fetch("/api/super-admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName,
          city: formState.city.trim() || "Lahore",
          cuisine: formState.category || "Fine Dining",
          hq_address: formState.branch.trim() || (branchesList[0] || "Main Branch"),
          contact_person: contactPerson,
          phone: formState.phone.trim() || "+92 300 0000000",
          owner_email: ownerEmail,
          owner_password: ownerPassword,
          assigned_plan: formState.planTier || (realtimePlans[0] || "Enterprise Plus"),
          initial_status: formState.status || "Active",
          branches: branchesPayload,
          enabled_modules: selectedAddOns,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to deploy restaurant.");
      }

      if (result.restaurant) {
        const mappedNew = mapSupabaseRestaurant(result.restaurant);
        setRestaurants((prev) => {
          const next = [mappedNew, ...prev.filter((r) => r.id !== mappedNew.id)];
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("sa_restaurants", JSON.stringify(next));
            } catch {}
          }
          return next;
        });
      }

      if (result.isExistingUser) {
        showToast(`🎉 "${brandName}" deployed and linked to existing admin account (${ownerEmail})!`);
      } else {
        showToast(`🎉 "${brandName}" deployed! Admin user created with login email (${ownerEmail}).`);
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
        password: "",
        status: "",
      });
      setSelectedAddOns([]);
      setBranchesList([]);
      setBranchInput("");
      setIsAddingBranch(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to deploy restaurant";
      console.error("[Deploy Restaurant Error]:", err);
      showToast(`Error: ${msg}`);
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = handleDeployRestaurant;

  const handleToggleStatus = async (id: string) => {
    const target = restaurants.find((r) => r.id === id);
    if (!target) return;
    const nextStatus = target.status === "Active" ? "Suspended" : "Active";

    const updated = restaurants.map((r) =>
      r.id === id ? { ...r, status: nextStatus as "Active" | "Suspended" } : r
    );

    setRestaurants(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sa_restaurants", JSON.stringify(updated));
      } catch {}
    }
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

  const handleDeleteRestaurant = async (id: string) => {
    const target = restaurants.find((r) => r.id === id);
    const updated = restaurants.filter((r) => r.id !== id);
    setRestaurants(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sa_restaurants", JSON.stringify(updated));
      } catch {}
    }
    if (selectedRestaurant?.id === id) {
      setSelectedRestaurant(null);
    }
    showToast(`Restaurant "${target?.name || "Partner"}" deleted from database.`);

    try {
      await fetch(`/api/super-admin/restaurants?id=${id}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error(err);
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
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.branch.toLowerCase().includes(search.toLowerCase()) ||
      r.city.toLowerCase().includes(search.toLowerCase()) ||
      r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase());

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
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Top Header with Back Arrow */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <button
              type="button"
              onClick={handleCloseAddForm}
              className="w-8 h-8 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] hover:text-[var(--gold)] text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shadow-sm group shrink-0"
              title="Back to Restaurants Directory"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider">
              <Store className="w-3.5 h-3.5" />
              <span>Omnibites Vendor Ecosystem</span>
            </div>
          </div>

          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Register New <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Restaurant</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Deploy POS &amp; kitchen instance, configure franchise outlets, and grant owner management credentials.
          </p>
        </div>

        {/* Full Width Form Container */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-8 border border-[var(--gold)]/40 shadow-2xl">
          <form onSubmit={handleFormSubmit} className="space-y-8 text-xs">
            {/* Section 1: Brand & Regional Identity */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
                <Building2 className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="font-display font-bold text-sm sm:text-base text-[var(--text-hi)]">
                  Brand Identity &amp; Location
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Brand Name */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${
                          isCityDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
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
                                className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                                  formState.city === cityName
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${
                          isCategoryDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
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
                            className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                              formState.category === cat
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
              </div>
            </div>

            {/* Section 2: Owner & Primary Contact */}
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
                <Users className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="font-display font-bold text-sm sm:text-base text-[var(--text-hi)]">
                  Franchise Owner / Primary Contact
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Owner Name */}
                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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

                {/* Admin Password */}
                <div className="space-y-1.5">
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-10 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono"
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
              </div>
            </div>

            {/* Section 3: Licensing Tier & Branch Scale */}
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
                <Layers className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="font-display font-bold text-sm sm:text-base text-[var(--text-hi)]">
                  Licensing &amp; Scale Setup
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* SaaS Plan Tier - Real-time fetched from Subscriptions & Plans with placeholder */}
                <div className="space-y-1.5 relative" ref={planDropdownRef}>
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${
                          isPlanDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
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
                            className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                              formState.planTier === tier
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                            <span className="text-[var(--text-hi)]">Active &amp; Live</span>
                          </>
                        ) : formState.status === "Pending" ? (
                          <>
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[var(--text-hi)]">Pending Review</span>
                          </>
                        ) : (
                          <span className="text-[var(--text-faint)]">Select initial status...</span>
                        )}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${
                          isStatusDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
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
                          className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                            formState.status === "Active"
                              ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                              : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />
                            <span>Active &amp; Live</span>
                          </div>
                          {formState.status === "Active" && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormState({ ...formState, status: "Pending" });
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                            formState.status === "Pending"
                              ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                              : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            <span>Pending Review</span>
                          </div>
                          {formState.status === "Pending" && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive Branches Addition Feature */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px] flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Restaurant Branches / Outlets Setup</span>
                  </label>
                  <span className="text-[10.5px] font-mono text-[var(--text-faint)]">
                    {branchesList.length} {branchesList.length === 1 ? "branch" : "branches"} added
                  </span>
                </div>

                {/* Input & + Add Branch Button - Only shown when + Add Branch is clicked */}
                {isAddingBranch && (
                  <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
                    <div className="relative flex-1">
                      <MapPin className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={branchInput}
                        onChange={(e) => setBranchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddBranch();
                          } else if (e.key === "Escape") {
                            setIsAddingBranch(false);
                            setBranchInput("");
                          }
                        }}
                        placeholder="Type branch location or name (e.g. Gulberg Main Branch, DHA Phase 6, F-7 Markaz...)"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddBranch}
                      className="btn-gold px-4 sm:px-5 py-3 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shrink-0 rounded-xl"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingBranch(false);
                        setBranchInput("");
                      }}
                      className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] hover:bg-red-500/10 hover:text-red-400 text-[var(--text-faint)] transition-all cursor-pointer shrink-0"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Branches List Display */}
                {branchesList.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                    {branchesList.map((br, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] group hover:border-[var(--gold)]/40 transition-all animate-in fade-in zoom-in-95 duration-150"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-semibold text-[var(--text-hi)] truncate" title={br}>
                            {br}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveBranch(index)}
                          className="p-1 rounded-lg text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                          title="Remove branch"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Full Width Gold Button to Add Branch when form is closed */}
                {!isAddingBranch && (
                  <button
                    type="button"
                    onClick={() => setIsAddingBranch(true)}
                    className="w-full btn-gold py-3 px-4 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Branch</span>
                  </button>
                )}
              </div>
            </div>

            {/* Section 4: Add-on Entitlements */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
                <Sparkles className="w-4 h-4 text-[var(--gold)]" />
                <h3 className="font-display font-bold text-sm sm:text-base text-[var(--text-hi)]">
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
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                        isChecked
                          ? "bg-[var(--gold-dim)] border-[var(--gold)]/60 text-[var(--text-hi)] shadow-sm"
                          : "bg-[var(--surface-hi)]/60 border-[var(--border)] text-[var(--text-lo)] hover:border-[var(--gold)]/40 hover:text-[var(--text-hi)]"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center border transition-all shrink-0 ${
                          isChecked
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
            <div className="pt-6 flex items-center justify-end gap-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={handleCloseAddForm}
                className="px-5 py-2.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] font-semibold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-gold px-6 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>{isSubmitting ? "Deploying..." : "Deploy Restaurant Instance"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ===================== 2. MAIN DIRECTORY VIEW =====================
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <Store className="w-3.5 h-3.5" />
            Omnibites Vendor Ecosystem
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Restaurant <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Partners</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Manage registered restaurant brands, franchise branch networks, licensing scopes, and live statuses.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddForm}
            className="btn-gold text-xs px-4 py-2 gap-1.5 font-bold cursor-pointer inline-flex items-center shadow-lg shadow-[var(--gold-glow)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Restaurant</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Directory</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[var(--text-faint)] font-bold">Total Brands</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--text-hi)]">
            {restaurants.length}
          </div>
          <span className="text-[10px] font-mono text-[var(--gold)] block font-semibold">
            {restaurants.length > 0 ? `${restaurants.length} registered` : "0 brands registered"}
          </span>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[var(--text-faint)] font-bold">Active Outlets</span>
            <div className="w-8 h-8 rounded-xl bg-[#25d366]/15 text-[#25d366] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--text-hi)]">
            {restaurants.reduce((acc, r) => acc + (r.outlets || 1), 0)}
          </div>
          <span className="text-[10px] font-mono text-[#25d366] block font-semibold">
            {restaurants.length > 0 ? "Total franchise outlets" : "0 outlets live"}
          </span>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[var(--text-faint)] font-bold">Pending Review</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--orange-dim)] text-[var(--orange)] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--orange)]">
            {restaurants.filter((r) => r.status === "Pending").length}
          </div>
          <span className="text-[10px] font-mono text-[var(--text-lo)] block">
            {restaurants.filter((r) => r.status === "Pending").length > 0 ? "Awaiting license check" : "No pending reviews"}
          </span>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[var(--text-faint)] font-bold">Monthly GMV</span>
            <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-[var(--gold)]">
            $0
          </div>
          <span className="text-[10px] font-mono text-[#25d366] block font-semibold">
            {restaurants.length > 0 ? "Live volume" : "0.0% MoM"}
          </span>
        </div>
      </div>

      {/* 3. Search and Filtering Bar */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 space-y-4 border border-[var(--border)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by restaurant name, owner, branch, city..."
              className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-full pl-9 pr-4 py-2 text-xs sm:text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
            />
          </div>

          {/* Filters: Status and City */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Status Segmented Control */}
            <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-medium">
              {(["all", "Active", "Pending", "Suspended"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer font-mono text-xs ${
                    statusFilter === st
                      ? "bg-[var(--gold)] text-[#342c14] font-bold shadow-md"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                  }`}
                >
                  {st === "all" ? `All (${restaurants.length})` : st}
                </button>
              ))}
            </div>

            {/* Custom City Dropdown Filter with search and all cities */}
            <div className="relative" ref={filterCityDropdownRef}>
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
                  className={`w-3.5 h-3.5 text-[var(--text-lo)] transition-transform duration-200 ${
                    isFilterCityDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
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
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                        cityFilter === "all"
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
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                          cityFilter === cityName
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

        {/* 4. Restaurants Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="pb-3 font-semibold">Restaurant Brand</th>
                <th className="pb-3 font-semibold">Category &amp; City</th>
                <th className="pb-3 font-semibold text-center">Outlets</th>
                <th className="pb-3 font-semibold">Active Plan</th>
                <th className="pb-3 font-semibold text-right">Revenue</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
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
                  <tr key={rest.id} className="group transition-colors">
                    {/* Brand & Location */}
                    <td className="py-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                        {rest.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors truncate">
                            {rest.name}
                          </span>
                          <span className="flex items-center text-[10px] text-[var(--gold)] font-bold">
                            <Star className="w-3 h-3 fill-[var(--gold)] inline" /> {rest.rating}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-faint)] font-mono flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {rest.branch}
                        </span>
                      </div>
                    </td>

                    {/* Category & City */}
                    <td className="py-4">
                      <span className="text-xs text-[var(--text-hi)] block font-medium">
                        {rest.category}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)] font-mono">
                        {rest.city}, Pakistan
                      </span>
                    </td>

                    {/* Outlets Count */}
                    <td className="py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-hi)] select-none">
                        <Store className="w-3.5 h-3.5 text-[var(--gold)]" />
                        <span>{rest.outlets} {rest.outlets === 1 ? "branch" : "branches"}</span>
                      </span>
                    </td>

                    {/* Plan Tier */}
                    <td className="py-4 font-mono">
                      <span className="text-xs font-semibold text-[var(--gold)]">
                        {rest.planTier}
                      </span>
                    </td>

                    {/* Revenue */}
                    <td className="py-4 text-right font-mono font-bold text-[var(--gold)] text-sm">
                      {rest.revenue}
                    </td>

                    {/* Status */}
                    <td className="py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border select-none ${
                          rest.status === "Active"
                            ? "bg-[#25d366]/10 text-[#25d366] border-[#25d366]/30"
                            : rest.status === "Pending"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-red-500/10 text-red-400 border-red-500/30"
                        }`}
                      >
                        {rest.status === "Active" && <CheckCircle2 className="w-3.5 h-3.5 text-[#25d366]" />}
                        {rest.status === "Pending" && <Clock className="w-3.5 h-3.5 text-blue-400" />}
                        {rest.status === "Suspended" && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                        <span>{rest.status}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {/* Details Button with Custom Floating UI Tooltip */}
                        <div className="relative group/tip">
                          <button
                            onClick={() => {
                              setSelectedRestaurant(rest);
                              showToast(`Inspecting ${rest.name}`);
                            }}
                            className="px-3 py-1 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] text-[var(--text-lo)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all cursor-pointer text-xs font-semibold select-none flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>
                          {/* Custom Floating UI Tooltip */}
                          <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 translate-y-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                              <Eye className="w-3 h-3 text-[var(--gold)]" />
                              <span>View Profile &amp; Stats</span>
                            </div>
                            {/* Arrow */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-r border-b border-[var(--border-hi)]"></div>
                          </div>
                        </div>

                        {/* Suspend / Activate Button with Custom Floating UI Tooltip */}
                        <div className="relative group/tip">
                          <button
                            onClick={() => handleToggleStatus(rest.id)}
                            className={`px-3 py-1 rounded-xl border text-xs font-semibold cursor-pointer transition-all select-none flex items-center gap-1.5 ${
                              rest.status === "Active"
                                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 hover:border-red-500/50"
                                : "bg-[#25d366]/10 hover:bg-[#25d366]/20 text-[#25d366] border-[#25d366]/30 hover:border-[#25d366]/50"
                            }`}
                          >
                            {rest.status === "Active" ? (
                              <>
                                <AlertTriangle className="w-3 h-3" />
                                <span>Suspend</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                          {/* Custom Floating UI Tooltip */}
                          <div className="absolute bottom-[calc(100%+8px)] right-0 pointer-events-none opacity-0 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 translate-y-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                              {rest.status === "Active" ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-red-400" />
                                  <span>Suspend Restaurant Access</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-[#25d366]" />
                                  <span>Activate &amp; Go Live</span>
                                </>
                              )}
                            </div>
                            {/* Arrow */}
                            <div className="absolute -bottom-1 right-4 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-r border-b border-[var(--border-hi)]"></div>
                          </div>
                        </div>

                        {/* Delete Restaurant Button with Custom Floating UI Tooltip */}
                        <div className="relative group/tip">
                          <button
                            onClick={() => handleDeleteRestaurant(rest.id)}
                            className="px-2.5 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 transition-all cursor-pointer select-none flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Custom Floating UI Tooltip */}
                          <div className="absolute bottom-[calc(100%+8px)] right-0 pointer-events-none opacity-0 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 translate-y-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-red-400 border border-red-500/40 shadow-2xl shadow-black/80 backdrop-blur-xl">
                              <Trash2 className="w-3 h-3 text-red-400" />
                              <span>Delete Restaurant</span>
                            </div>
                            {/* Arrow */}
                            <div className="absolute -bottom-1 right-2.5 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-r border-b border-red-500/40"></div>
                          </div>
                        </div>
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
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-extrabold text-sm flex items-center justify-center shadow-md">
                  {selectedRestaurant.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-display font-extrabold text-lg text-[var(--text-hi)]">
                    {selectedRestaurant.name}
                  </h4>
                  <p className="text-xs text-[var(--text-lo)] font-mono">
                    {selectedRestaurant.category} · {selectedRestaurant.city}
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
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)]">Branch Locations</span>
                <span className="text-sm font-bold text-[var(--text-hi)] block">{selectedRestaurant.outlets} Outlets</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)]">Monthly Revenue</span>
                <span className="text-sm font-bold text-[var(--gold)] font-mono block">{selectedRestaurant.revenue}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)]">Owner / Primary Contact</span>
                <span className="text-xs font-bold text-[var(--text-hi)] block">{selectedRestaurant.ownerName}</span>
                <span className="text-[10px] text-[var(--text-faint)] font-mono">{selectedRestaurant.phone}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-faint)]">Active SaaS Tier</span>
                <span className="text-xs font-bold text-[var(--gold)] font-mono block">{selectedRestaurant.planTier}</span>
                <span className="text-[10px] text-[var(--text-faint)] font-mono">Joined {selectedRestaurant.joinedDate}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2.5 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => handleDeleteRestaurant(selectedRestaurant.id)}
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
                    showToast(`Managing branches for ${selectedRestaurant.name}`);
                    setSelectedRestaurant(null);
                  }}
                  className="btn-gold px-4 py-2 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Manage Branches</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
