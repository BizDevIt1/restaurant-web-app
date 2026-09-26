"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useSplash } from "@/components/SplashScreen";
import {
  LayoutDashboard,
  ShoppingBag,
  Flame,
  Bike,
  CreditCard,
  Settings,
  HelpCircle,
  ShieldCheck,
  Search,
  Sun,
  Moon,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  TrendingUp,
  Store,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Menu,
  X,
  Star,
  Activity,
  MapPin,
  Download,
  LogOut,
  Layers,
  Check,
  Sparkles,
  Calendar,
  Zap,
  Sliders,
  Edit2,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Wallet,
  Server,
  Database,
  Globe,
  Cloud,
} from "lucide-react";
import SubscriptionsPlansView from "../subscriptions&plans/SubscriptionsPlansView";
import RestaurantsView from "../restaurants/RestaurantsView";
import PaymentsView from "../payments/PaymentsView";
import SettingsView from "../settings/SettingsView";

// Count-up animation hook
function useCountUp(target: number, duration: number = 1400) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * target));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  return count;
}

export default function SuperAdminClient({
  initialNav,
  initialPlanMode,
  initialRestaurantMode,
  initialCollapsed = false,
}: {
  initialNav?: string;
  initialPlanMode?: "new" | "edit" | null;
  initialRestaurantMode?: "new" | "edit" | null;
  initialCollapsed?: boolean;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { triggerSplash } = useSplash();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeNav, setActiveNav] = useState(() => {
    if (initialNav) return initialNav;
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.startsWith("/super-admin/subscriptions&plans")) {
        return "Subscriptions & Plans";
      }
      if (path.startsWith("/super-admin/restaurants")) {
        return "Restaurants";
      }
      if (path.startsWith("/super-admin/payments")) {
        return "Payments";
      }
      if (path.startsWith("/super-admin/settings")) {
        return "Settings";
      }
    }
    return "Dashboard";
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialCollapsed);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilterType, setSearchFilterType] = useState<"name" | "location">("name");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [allRestaurants, setAllRestaurants] = useState<any[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [revenueRange, setRevenueRange] = useState<"today" | "7d" | "30d">("7d");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [navResetKey, setNavResetKey] = useState(0);
  const [activePlanMode, setActivePlanMode] = useState<"new" | "edit" | null>(initialPlanMode || null);
  const [activeRestaurantMode, setActiveRestaurantMode] = useState<"new" | "edit" | null>(() => {
    if (initialRestaurantMode) return initialRestaurantMode;
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.endsWith("/new") && path.includes("/restaurants")) {
        return "new";
      }
      if (path.includes("/restaurants/edit")) {
        return "edit";
      }
    }
    return null;
  });

  // Real-time Super Admin Avatar State synced with Settings (hydration safe)
  const [adminAvatarUrl, setAdminAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sa_admin_avatar");
      if (saved) setAdminAvatarUrl(saved);
    } catch {}

    const handleAvatarUpdate = (e: any) => {
      if (e.type === "storage" && e.key && e.key !== "sa_admin_avatar") return;
      const url = e.detail?.avatarUrl || localStorage.getItem("sa_admin_avatar");
      setAdminAvatarUrl(url || null);
    };
    window.addEventListener("sa_admin_avatar_updated", handleAvatarUpdate);
    window.addEventListener("storage", handleAvatarUpdate);
    return () => {
      window.removeEventListener("sa_admin_avatar_updated", handleAvatarUpdate);
      window.removeEventListener("storage", handleAvatarUpdate);
    };
  }, []);

  const handleLogout = async () => {
    // Trigger splash screen to cover logout transition
    triggerSplash(1500);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/");
    router.refresh();
  };

  // New Vendor Approvals State (Real-time live queue)
  const [pendingVendors, setPendingVendors] = useState<any[]>([]);

  // Form State for Adding Restaurant
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    branch: "",
    city: "Lahore",
    category: "Casual Dining",
    phone: "",
  });

  // Helper for dynamic plan tier MRR
  const getPlanPrice = (planName?: string) => {
    const name = String(planName || "").toLowerCase();
    if (name.includes("free")) return 0;
    if (name.includes("enterprise") || name.includes("franchise")) return 499;
    if (name.includes("growth") || name.includes("pro")) return 249;
    if (name.includes("starter") || name.includes("basic")) return 99;
    return 199;
  };

  interface NetworkTelemetryMetrics {
    totalBrands: number;
    activeBrands: number;
    deactivatedBrands: number;
    suspendedBrands: number;
    pendingBrands: number;
    totalOutlets: number;
    standaloneOutlets: number;
    franchiseOutlets: number;
    liveGMV: number;
    liveMRR: number;
    pendingPayouts: number;
    pendingTransfersCount: number;
  }

  const computeNetworkMetrics = (list: any[]): NetworkTelemetryMetrics => {
    if (!Array.isArray(list) || list.length === 0) {
      return {
        totalBrands: 0,
        activeBrands: 0,
        deactivatedBrands: 0,
        suspendedBrands: 0,
        pendingBrands: 0,
        totalOutlets: 0,
        standaloneOutlets: 0,
        franchiseOutlets: 0,
        liveGMV: 0,
        liveMRR: 0,
        pendingPayouts: 0,
        pendingTransfersCount: 0,
      };
    }

    let totalBrands = list.length;
    let activeBrands = 0;
    let deactivatedBrands = 0;
    let suspendedBrands = 0;
    let pendingBrands = 0;
    let totalOutlets = 0;
    let standaloneOutlets = 0;
    let franchiseOutlets = 0;
    let liveGMV = 0;
    let liveMRR = 0;
    let pendingPayouts = 0;
    let pendingTransfersCount = 0;

    for (const r of list) {
      if (!r || typeof r !== "object") continue;

      const rawStatus = String(r.status || r.initial_status || "Active").trim().toLowerCase();
      const isActive = rawStatus === "active";

      if (isActive) {
        activeBrands++;
      } else if (rawStatus === "deactivated" || rawStatus === "deactive") {
        deactivatedBrands++;
      } else if (rawStatus === "suspended" || rawStatus === "suspend") {
        suspendedBrands++;
      } else if (rawStatus === "pending") {
        pendingBrands++;
      }

      // Calculate outlets and detect franchise vs standalone for this brand
      let parsedBranches: any[] = [];
      let hasFranchiseFlag = false;

      if (Array.isArray(r.branches)) {
        parsedBranches = r.branches;
      } else if (typeof r.branches === "string" && r.branches.trim()) {
        try {
          const parsed = JSON.parse(r.branches);
          if (Array.isArray(parsed)) parsedBranches = parsed;
          else if (parsed && typeof parsed === "object") parsedBranches = [parsed];
        } catch {
          parsedBranches = r.branches.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      }

      for (const b of parsedBranches) {
        if (b && typeof b === "object") {
          if (b.type === "franchise" || b.is_franchise || b.outlet_type === "multi" || b.is_multi) {
            hasFranchiseFlag = true;
          }
        }
      }

      let brandOutlets = 1;
      if (parsedBranches.length > 0) {
        brandOutlets = parsedBranches.length;
      } else if (typeof r.outlets === "number" && r.outlets > 0) {
        brandOutlets = r.outlets;
      }

      totalOutlets += brandOutlets;

      const isMulti =
        hasFranchiseFlag ||
        brandOutlets > 1 ||
        r.outlet_type === "multi" ||
        r.outletType === "multi" ||
        r.is_multi_branch === true ||
        r.isMultiBranch === true ||
        r.franchise === true ||
        String(r.brand_name || r.name || "").toLowerCase().includes("franchise") ||
        String(r.brand_name || r.name || "").toLowerCase().includes("frenchise");

      if (isMulti) {
        franchiseOutlets += brandOutlets;
      } else {
        standaloneOutlets += brandOutlets;
      }

      if (isActive) {
        const rev = parseFloat(String(r.revenue || "").replace(/[^0-9.]/g, "")) || 0;
        liveGMV += rev;
        liveMRR += getPlanPrice(r.assigned_plan || r.planTier);

        // Aggregate dynamic pending vendor payouts directly from real-time restaurant page data
        const rawPayout = parseFloat(String(r.pending_payout || r.pendingPayout || r.payout || "").replace(/[^0-9.]/g, "")) || 0;
        if (rawPayout > 0) {
          pendingPayouts += rawPayout;
          pendingTransfersCount++;
        } else if (rev > 0) {
          const calcPayout = Math.round(rev * 0.355);
          pendingPayouts += calcPayout;
          if (calcPayout > 0) pendingTransfersCount++;
        }
      }
    }

    return {
      totalBrands,
      activeBrands,
      deactivatedBrands,
      suspendedBrands,
      pendingBrands,
      totalOutlets,
      standaloneOutlets,
      franchiseOutlets,
      liveGMV,
      liveMRR,
      pendingPayouts,
      pendingTransfersCount,
    };
  };

  // Real-time network telemetry state (hydrated cleanly on client mount)
  const [networkMetrics, setNetworkMetrics] = useState<NetworkTelemetryMetrics>({
    totalBrands: 0,
    activeBrands: 0,
    deactivatedBrands: 0,
    suspendedBrands: 0,
    pendingBrands: 0,
    totalOutlets: 0,
    standaloneOutlets: 0,
    franchiseOutlets: 0,
    liveGMV: 0,
    liveMRR: 0,
    pendingPayouts: 0,
    pendingTransfersCount: 0,
  });

  const mapRestaurantsForSearch = (list: any[]) => {
    if (!Array.isArray(list)) return [];
    return list.map((r: any) => ({
      id: r.id || r.restaurant_id || String(Math.random()),
      name: r.brand_name || r.name || "Restaurant",
      brand_name: r.brand_name || r.name || "Restaurant",
      city: r.city || "Lahore",
      branch: r.branch || (Array.isArray(r.branches) ? r.branches[0]?.name : "") || "Main Branch",
      branches: Array.isArray(r.branches) ? r.branches : [],
      status: r.initial_status || r.status || "Active",
      category: r.category || "Casual Dining",
      ownerName: r.contact_person || r.ownerName || r.owner_name || "",
      hqAddress: r.hq_address || r.hqAddress || "",
    }));
  };

  const fetchNetworkTelemetry = async () => {
    try {
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("sa_restaurants");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setNetworkMetrics(computeNetworkMetrics(parsed));
              setAllRestaurants(mapRestaurantsForSearch(parsed));
            }
          }
        } catch {}
      }

      // Primary: Secure internal API route (safe against CORS & extensions)
      try {
        const res = await fetch(`/api/super-admin/restaurants?t=${Date.now()}`, {
          headers: { "Cache-Control": "no-store, no-cache" },
        });

        if (res && res.ok) {
          const data = await res.json();
          if (data && data.restaurants && Array.isArray(data.restaurants)) {
            const computed = computeNetworkMetrics(data.restaurants);
            setNetworkMetrics(computed);
            setAllRestaurants(mapRestaurantsForSearch(data.restaurants));
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("sa_restaurants", JSON.stringify(data.restaurants));
              } catch {}
            }
            return;
          }
        }
      } catch (apiErr) {
        // Safe fallback
      }

      // Secondary fallback: Direct Supabase query with safe error swallowing
      try {
        const supabase = createClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("restaurants")
            .select("*")
            .order("id", { ascending: false });

          if (!error && data && Array.isArray(data)) {
            const computed = computeNetworkMetrics(data);
            setNetworkMetrics(computed);
            setAllRestaurants(mapRestaurantsForSearch(data));
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("sa_restaurants", JSON.stringify(data));
              } catch {}
            }
          }
        }
      } catch (dbErr) {
        // Safe fallback
      }
    } catch {}
  };

  // Filtered restaurants for global search dropdown (By Name or By Location)
  const filteredSearchRestaurants = allRestaurants.filter((r) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase().trim();

    if (searchFilterType === "name") {
      const name = String(r.name || r.brand_name || "").toLowerCase();
      const owner = String(r.ownerName || "").toLowerCase();
      const category = String(r.category || "").toLowerCase();
      return name.includes(q) || owner.includes(q) || category.includes(q);
    } else {
      // By Location
      const city = String(r.city || "").toLowerCase();
      const branch = String(r.branch || "").toLowerCase();
      const address = String(r.hqAddress || "").toLowerCase();
      let branchMatch = false;
      if (Array.isArray(r.branches)) {
        branchMatch = r.branches.some((b: any) => {
          const bName = typeof b === "string" ? b : b?.name || "";
          const bAddr = typeof b === "object" ? b?.address || "" : "";
          return bName.toLowerCase().includes(q) || bAddr.toLowerCase().includes(q);
        });
      }
      return city.includes(q) || branch.includes(q) || address.includes(q) || branchMatch;
    }
  });

  // Click outside listener to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchNetworkTelemetry();

    const handleStorage = () => {
      setTimeout(() => {
        fetchNetworkTelemetry();
      }, 0);
    };
    const handleFocus = () => {
      setTimeout(() => {
        fetchNetworkTelemetry();
      }, 0);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("sa_restaurants_updated", handleStorage);
    window.addEventListener("focus", handleFocus);

    try {
      const supabase = createClient();
      const channel = supabase
        .channel("sa-dashboard-telemetry")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "restaurants" },
          () => {
            setTimeout(() => {
              fetchNetworkTelemetry();
            }, 0);
          }
        )
        .subscribe();

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("sa_restaurants_updated", handleStorage);
        window.removeEventListener("focus", handleFocus);
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("sa_restaurants_updated", handleStorage);
        window.removeEventListener("focus", handleFocus);
      };
    }
  }, []);

  useEffect(() => {
    if (activeNav === "Dashboard") {
      fetchNetworkTelemetry();
    }
  }, [activeNav]);

  // Animated stat values calculated in real-time
  const countBrands = useCountUp(networkMetrics.totalBrands);
  const countOutlets = useCountUp(networkMetrics.totalOutlets);
  const countGMV = useCountUp(networkMetrics.liveGMV);
  const countPayouts = useCountUp(networkMetrics.pendingPayouts);

  // Live formatted current date
  const [currentDate, setCurrentDate] = useState("");
  useEffect(() => {
    const now = new Date();
    setCurrentDate(
      now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
  }, []);

  // Listen to browser Back / Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path.startsWith("/super-admin/subscriptions&plans")) {
          setActiveNav("Subscriptions & Plans");
        } else if (path.startsWith("/super-admin/restaurants")) {
          setActiveNav("Restaurants");
          if (path.endsWith("/new")) {
            setActiveRestaurantMode("new");
            setNavResetKey((k) => k + 1);
          } else if (path.includes("/restaurants/edit")) {
            setActiveRestaurantMode("edit");
            setNavResetKey((k) => k + 1);
          } else {
            setActiveRestaurantMode(null);
          }
        } else if (path.startsWith("/super-admin/payments")) {
          setActiveNav("Payments");
        } else if (path.startsWith("/super-admin/settings")) {
          setActiveNav("Settings");
        } else if (path === "/super-admin/dashboard" || path === "/super-admin") {
          setActiveNav("Dashboard");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    // 0. Always reset scroll to top on reload
    if (typeof window !== "undefined") {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
      window.scrollTo(0, 0);
    }

    // 1. Restore saved theme
    try {
      const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {
      // ignore
    }

    // 2. Restore saved sidebar collapsed state
    try {
      const savedCollapsed = localStorage.getItem("sa_sidebar_collapsed");
      if (savedCollapsed !== null) {
        const val = savedCollapsed === "true";
        setIsSidebarCollapsed(val);
        document.cookie = `sa_sidebar_collapsed=${val}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // ignore
    }

    // 3. Restore saved active navigation tab & ensure correct URL
    try {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path.startsWith("/super-admin/subscriptions&plans")) {
          setActiveNav("Subscriptions & Plans");
          localStorage.setItem("sa_active_nav", "Subscriptions & Plans");
        } else if (path.startsWith("/super-admin/restaurants")) {
          setActiveNav("Restaurants");
          if (path.endsWith("/new")) {
            setActiveRestaurantMode("new");
          } else if (path.includes("/restaurants/edit")) {
            setActiveRestaurantMode("edit");
          }
          localStorage.setItem("sa_active_nav", "Restaurants");
        } else if (path.startsWith("/super-admin/payments")) {
          setActiveNav("Payments");
          localStorage.setItem("sa_active_nav", "Payments");
        } else if (path.startsWith("/super-admin/settings")) {
          setActiveNav("Settings");
          localStorage.setItem("sa_active_nav", "Settings");
        } else if (path === "/super-admin/dashboard") {
          setActiveNav("Dashboard");
          localStorage.setItem("sa_active_nav", "Dashboard");
        } else if (path === "/super-admin") {
          const savedNav = localStorage.getItem("sa_active_nav");
          if (savedNav === "Subscriptions & Plans") {
            setActiveNav("Subscriptions & Plans");
            window.history.replaceState(null, "", "/super-admin/subscriptions&plans");
          } else if (savedNav === "Restaurants") {
            setActiveNav("Restaurants");
            window.history.replaceState(null, "", "/super-admin/restaurants");
          } else if (savedNav === "Payments") {
            setActiveNav("Payments");
            window.history.replaceState(null, "", "/super-admin/payments");
          } else if (savedNav === "Settings") {
            setActiveNav("Settings");
            window.history.replaceState(null, "", "/super-admin/settings");
          } else {
            setActiveNav("Dashboard");
            window.history.replaceState(null, "", "/super-admin/dashboard");
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Scroll to top whenever active navigation tab changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [activeNav]);

  // Navigation tab switcher with persistence, URL update & top scroll
  const handleNavClick = (name: string) => {
    setActiveNav(name);
    setActivePlanMode(null);
    setActiveRestaurantMode(null);
    setNavResetKey((k) => k + 1);
    try {
      localStorage.setItem("sa_active_nav", name);
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      if (name === "Subscriptions & Plans") {
        if (window.location.pathname !== "/super-admin/subscriptions&plans") {
          window.history.pushState(null, "", "/super-admin/subscriptions&plans");
        }
      } else if (name === "Restaurants") {
        if (window.location.pathname !== "/super-admin/restaurants") {
          window.history.pushState(null, "", "/super-admin/restaurants");
        }
      } else if (name === "Payments") {
        if (window.location.pathname !== "/super-admin/payments") {
          window.history.pushState(null, "", "/super-admin/payments");
        }
      } else if (name === "Settings") {
        if (window.location.pathname !== "/super-admin/settings") {
          window.history.pushState(null, "", "/super-admin/settings");
        }
      } else if (name === "Dashboard") {
        if (window.location.pathname !== "/super-admin/dashboard") {
          window.history.pushState(null, "", "/super-admin/dashboard");
        }
      }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  };

  // Theme switcher handler
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("theme", nextTheme);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  // Sidebar toggle handler with persistence in both localStorage and cookie
  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sa_sidebar_collapsed", String(next));
        document.cookie = `sa_sidebar_collapsed=${next}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {
        // ignore
      }
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApproveVendor = (id: string, name: string) => {
    setPendingVendors((prev) => prev.filter((v) => v.id !== id));
    showToast(`Approved "${name}" — Credentials sent to owner`);
  };

  const handleRejectVendor = (id: string, name: string) => {
    setPendingVendors((prev) => prev.filter((v) => v.id !== id));
    showToast(`Rejected request for "${name}"`);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNetworkTelemetry();
    setTimeout(() => {
      setIsRefreshing(false);
      showToast("Live telemetry & sync refreshed");
    }, 750);
  };

  const handleCreateRestaurant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRestaurant.name.trim()) return;
    setIsAddModalOpen(false);
    showToast(`Added restaurant "${newRestaurant.name}" successfully!`);
    setNewRestaurant({ name: "", branch: "", city: "Lahore", category: "Casual Dining", phone: "" });
  };

  // Nav Items Configuration
  const navOverview = [
    { name: "Dashboard", icon: LayoutDashboard, badge: null },
    { name: "Restaurants", icon: Store, badge: null },
    { name: "Subscriptions & Plans", icon: Layers, badge: null },
    { name: "Payments", icon: CreditCard, badge: null },
    { name: "Settings", icon: Settings, badge: null },
  ];

  // Top Performing Restaurants Data
  const topRestaurants = [
    {
      name: "Salt'n Pepper Village",
      branch: "Main Boulevard, Lahore",
      city: "Lahore",
      initials: "SP",
      orders: "342",
      revenue: "$112,400",
      rating: "4.9",
      status: "Active",
      growth: "+14.2%",
    },
    {
      name: "Kolachi Oceanfront",
      branch: "Do Darya, Karachi",
      city: "Karachi",
      initials: "KO",
      orders: "298",
      revenue: "$98,650",
      rating: "4.8",
      status: "Active",
      growth: "+9.8%",
    },
    {
      name: "Howdy Gourmet Burgers",
      branch: "F-7 Markaz, Islamabad",
      city: "Islamabad",
      initials: "HB",
      orders: "245",
      revenue: "$64,200",
      rating: "4.7",
      status: "Active",
      growth: "+18.1%",
    },
    {
      name: "Bundu Khan Traditional",
      branch: "Liberty Market, Lahore",
      city: "Lahore",
      initials: "BK",
      orders: "219",
      revenue: "$58,900",
      rating: "4.8",
      status: "Active",
      growth: "+6.4%",
    },
    {
      name: "Espresso Coffee Lounge",
      branch: "Clifton Block 4, Karachi",
      city: "Karachi",
      initials: "EC",
      orders: "186",
      revenue: "$46,200",
      rating: "4.6",
      status: "Paused",
      growth: "-2.1%",
    },
  ];

  // Live Activity Events
  const liveEvents = [
    {
      id: "e-1",
      title: "Order #4892 Dispatched",
      desc: "Rider Ali assigned · Salt'n Pepper Lahore",
      time: "Just now",
      color: "bg-[var(--gold)]",
    },
    {
      id: "e-2",
      title: "JazzCash Settlement Settled",
      desc: "$14,800 transferred to Kolachi Karachi",
      time: "2m ago",
      color: "bg-[#25d366]",
    },
    {
      id: "e-3",
      title: "POS Offline Cache Synced",
      desc: "16 bills synced from Howdy Islamabad",
      time: "6m ago",
      color: "bg-[var(--olive)]",
    },
    {
      id: "e-4",
      title: "Kitchen SLA Delay Warning",
      desc: "Order #4881 > 18 min at Bundu Khan",
      time: "11m ago",
      color: "bg-[var(--orange)]",
    },
    {
      id: "e-5",
      title: "New Menu Item Approved",
      desc: "Smoked Brisket Special · Burger District",
      time: "24m ago",
      color: "bg-[var(--text-lo)]",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-hi)] font-sans antialiased">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[var(--bg-deep)] border border-[var(--gold)]/40 text-[var(--text-hi)] shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] animate-pulse"></span>
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* App Shell Layout */}
      <div className="flex min-h-screen w-full max-w-full">
        {/* ===================== 1. SIDEBAR (DESKTOP & TABLET >= 768px) ===================== */}
        <aside
          className={`hidden md:flex flex-col shrink-0 bg-[var(--bg-deep)]/90 backdrop-blur-2xl border-r border-[var(--border)] sticky top-0 h-screen z-40 transition-[width] duration-300 ease-in-out ${
            isSidebarCollapsed ? "w-[72px]" : "w-[252px]"
          }`}
        >
          {/* Brand Logo & Title with Toggle Action (Logo stays 100% fixed at x=36px) */}
          <div
            onClick={toggleSidebar}
            className="h-20 shrink-0 flex items-center border-b border-[var(--border)] cursor-pointer select-none overflow-hidden"
          >
            {/* Fixed 72px width logo container - ALWAYS centered in both states */}
            <div className="w-[72px] shrink-0 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Omnibites"
                width={52}
                height={52}
                priority
                className="w-[50px] h-[50px] object-contain shrink-0 transition-transform group-hover:scale-105 drop-shadow-[0_0_10px_rgba(227,177,59,0.4)]"
              />
            </div>

            {/* Brand Text - smoothly slides in and out without moving the logo */}
            <div
              className={`flex flex-col justify-center min-w-0 pr-4 overflow-hidden transition-all duration-300 ease-in-out ${
                isSidebarCollapsed
                  ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                  : "w-[170px] opacity-100 translate-x-0"
              }`}
            >
              <span className="font-bold text-xl sm:text-[22px] tracking-tight leading-tight whitespace-nowrap">
                <span className="text-[var(--text-hi)]">Omni</span>
                <span className="text-[#f5a623]">bites</span>
              </span>
              <span className="text-xs uppercase tracking-wider text-[var(--gold)] font-semibold whitespace-nowrap mt-0.5">
                Control Center
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 px-2.5 py-4 space-y-1.5 overflow-visible">
            {navOverview.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item.name)}
                  className={`w-full flex items-center h-11 rounded-xl text-[13.5px] font-medium transition-all duration-200 relative group cursor-pointer ${
                    isActive
                      ? "bg-[var(--gold-dim)] text-[var(--gold)] shadow-sm font-semibold"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)]"
                  }`}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]"></span>
                  )}

                  {/* Fixed Icon container (always centered relative to the 72px sidebar) */}
                  <div className="w-[52px] shrink-0 flex items-center justify-center">
                    <Icon className={`w-[19px] h-[19px] transition-transform group-hover:scale-110 shrink-0 ${isActive ? "text-[var(--gold)]" : "text-[var(--text-lo)]"}`} />
                  </div>

                  {/* Text and Badge smoothly expanding/collapsing */}
                  <div
                    className={`flex-1 flex items-center justify-between pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
                      isSidebarCollapsed
                        ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                        : "w-auto opacity-100 translate-x-0"
                    }`}
                  >
                    <span className="whitespace-nowrap">{item.name}</span>
                    {item.badge && (
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                          isActive
                            ? "bg-[var(--gold)] text-[#342c14] border-transparent"
                            : "bg-[var(--surface-hi)] text-[var(--text-faint)] border-[var(--border)]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>

                  {/* Custom Floating UI Tooltip (when sidebar collapsed) */}
                  {isSidebarCollapsed && (
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl">
                        <span>{item.name}</span>
                        {item.badge && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {/* Arrow */}
                      <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[var(--border-hi)]"></div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Sidebar: Logout Button */}
          <div className="border-t border-[var(--border)] p-2.5 shrink-0">
            <button
              onClick={handleLogout}
              className="w-full flex items-center h-11 rounded-xl text-[13.5px] font-semibold text-[#ff4d4f] hover:bg-[#ff4d4f]/15 border border-transparent hover:border-[#ff4d4f]/30 transition-all duration-200 relative group cursor-pointer select-none"
            >
              {/* Fixed Red Icon container (always centered relative to the 72px sidebar) */}
              <div className="w-[52px] shrink-0 flex items-center justify-center text-[#ff4d4f]">
                <LogOut className="w-[19px] h-[19px] text-[#ff4d4f] transition-transform group-hover:scale-110 shrink-0" />
              </div>

              {/* Text smoothly expanding/collapsing */}
              <div
                className={`flex-1 flex items-center justify-between pr-3 overflow-hidden transition-all duration-300 ease-in-out ${
                  isSidebarCollapsed
                    ? "w-0 opacity-0 -translate-x-3 pointer-events-none"
                    : "w-auto opacity-100 translate-x-0"
                }`}
              >
                <span className="whitespace-nowrap font-bold text-[#ff4d4f]">Log Out</span>
              </div>

              {/* Custom Floating UI Tooltip (when sidebar collapsed) */}
              {isSidebarCollapsed && (
                <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[#ff4d4f] border border-[#ff4d4f]/40 shadow-2xl shadow-black/80 backdrop-blur-xl">
                    <LogOut className="w-3.5 h-3.5 text-[#ff4d4f]" />
                    <span>Log Out</span>
                  </div>
                  {/* Arrow */}
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-b border-[#ff4d4f]/40"></div>
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* ===================== MOBILE BOTTOM MENU MODAL (< 768px: 300px-767px) ===================== */}
        {mobileSidebarOpen && (
          <div
            style={{ zIndex: 100000 }}
            className="md:hidden fixed inset-0 flex flex-col justify-end"
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setMobileSidebarOpen(false)}
            />

            {/* Bottom Sheet Modal Popup (Full Width on 300px-767px) */}
            <div className="relative w-full bg-[var(--bg-deep)] border-t border-[var(--border)] rounded-t-[24px] sm:rounded-t-[28px] p-3.5 min-[360px]:p-5 pb-8 sm:p-6 sm:pb-10 shadow-[0_-12px_50px_rgba(0,0,0,0.8)] z-10 animate-in slide-in-from-bottom duration-200 select-none max-h-[85vh] overflow-y-auto">
              {/* Top Drag Indicator / Handle */}
              <div className="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-2.5 min-[360px]:mb-3 sm:mb-4 shrink-0" />

              {/* Sheet Header: "Menu" on left, Theme switch & Close on right */}
              <div className="flex items-center justify-between pb-2.5 min-[360px]:pb-3 border-b border-[var(--border)] shrink-0">
                <h3
                  style={{ fontSize: "clamp(16px, 4.5vw, 20px)" }}
                  className="font-bold text-[var(--text-hi)] tracking-tight"
                >
                  Menu
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="p-1.5 min-[360px]:p-2 rounded-xl text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] transition-colors"
                    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {theme === "dark" ? (
                      <Sun className="w-5 h-5 text-[var(--gold)]" />
                    ) : (
                      <Moon className="w-5 h-5 text-indigo-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 min-[360px]:p-2 rounded-xl text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Grid of Navigation items */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 min-[360px]:gap-2 sm:gap-3.5 pt-2.5 min-[360px]:pt-3">
                {navOverview.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        handleNavClick(item.name);
                        setMobileSidebarOpen(false);
                      }}
                      className={`group flex flex-col items-center justify-center p-2 min-[360px]:p-2.5 sm:p-3.5 min-h-[78px] min-[360px]:min-h-[86px] sm:min-h-[96px] rounded-2xl transition-all cursor-pointer select-none text-center ${
                        isActive
                          ? "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/40 shadow-sm shadow-[var(--gold-glow)] scale-[1.02]"
                          : "bg-[var(--surface-lo)]/40 hover:bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)]/40 hover:border-[var(--border)]"
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl transition-all ${isActive ? "text-[var(--gold)]" : "text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"}`}>
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      </div>
                      <div className="w-full flex items-center justify-center min-h-[28px] px-0.5 text-center">
                        <span
                          style={{ fontSize: "clamp(10px, 2.7vw, 12.5px)" }}
                          className={`leading-[1.15] line-clamp-2 text-center max-w-full tracking-tight ${
                            isActive
                              ? "font-bold text-[var(--gold)]"
                              : "font-medium text-[var(--text-lo)] group-hover:text-[var(--text-hi)]"
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Log Out Tile */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    handleLogout();
                  }}
                  className="group flex flex-col items-center justify-center p-2 min-[360px]:p-2.5 sm:p-3.5 min-h-[78px] min-[360px]:min-h-[86px] sm:min-h-[96px] rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-[#ff4d4f] border border-red-500/25 transition-all cursor-pointer select-none text-center"
                >
                  <div className="p-1.5 rounded-xl text-[#ff4d4f]">
                    <LogOut className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  </div>
                  <div className="w-full flex items-center justify-center min-h-[28px] px-0.5 text-center">
                    <span
                      style={{ fontSize: "clamp(10px, 2.7vw, 12.5px)" }}
                      className="font-bold leading-[1.15] text-center max-w-full text-[#ff4d4f] tracking-tight"
                    >
                      Log Out
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== 2. MAIN CONTENT AREA ===================== */}
        <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
          {/* ===================== TOP BAR ===================== */}
          <header className="sticky top-0 z-40 h-16 sm:h-20 shrink-0 bg-[var(--bg-deep)]/95 backdrop-blur-xl border-b border-[var(--border)] px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2.5 sm:gap-4 shadow-sm">
            {/* Left: Global Search Container (Single input, seamlessly expands on mobile when isSearchOpen is true) */}
            <div
              ref={searchContainerRef}
              className="relative flex items-center gap-2 flex-1 max-w-xl min-w-0"
            >
              {/* Global Search Input with Dynamic Placeholder */}
              <div className="relative flex-1 w-full min-w-[110px] sm:min-w-[160px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setIsSearchOpen(true)}
                  onClick={() => setIsSearchOpen(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    setIsSearchOpen(true);
                    if (!val.trim()) {
                      if (typeof window !== "undefined") {
                        localStorage.removeItem("sa_global_search_filter");
                        window.dispatchEvent(new CustomEvent("sa_global_search_event", { detail: { query: "" } }));
                      }
                    }
                  }}
                  placeholder={
                    searchFilterType === "name"
                      ? "Search restaurant..."
                      : "Search by location..."
                  }
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-full pl-9 pr-9 py-2.5 text-xs sm:text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-colors shadow-inner"
                />
                {isSearchOpen && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery("");
                      setIsSearchOpen(false);
                      if (typeof window !== "undefined") {
                        localStorage.removeItem("sa_global_search_filter");
                        window.dispatchEvent(new CustomEvent("sa_global_search_event", { detail: { query: "" } }));
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-faint)] hover:text-[var(--text-hi)] hover:bg-[var(--surface-hi)] cursor-pointer transition-colors"
                    title="Close search"
                  >
                    <X className="w-4 h-4 text-[var(--text-lo)] hover:text-[var(--text-hi)]" />
                  </button>
                )}
              </div>

              {/* Toggle Buttons: By Name & By Location (Always visible on >= 768px) */}
              <div className="hidden md:inline-flex items-center p-0.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] shrink-0 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilterType("name");
                    setIsSearchOpen(true);
                  }}
                  title="Filter by Name"
                  className={`px-2.5 lg:px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    searchFilterType === "name"
                      ? "btn-gold shadow-md shadow-[var(--gold-glow)]"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">By Name</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSearchFilterType("location");
                    setIsSearchOpen(true);
                  }}
                  title="Filter by Location"
                  className={`px-2.5 lg:px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    searchFilterType === "location"
                      ? "btn-gold shadow-md shadow-[var(--gold-glow)]"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">By Location</span>
                </button>
              </div>

              {/* Live Dropdown Results Popover (Desktop & Mobile) */}
              {isSearchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full rounded-2xl bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-2xl shadow-black/90 backdrop-blur-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 max-h-80 overflow-y-auto space-y-1.5">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--border)]/60 pb-1.5 mb-1">
                    <span>
                      {searchFilterType === "name" ? "Restaurants Matching Name" : "Restaurants by Location"}
                    </span>
                    <span className="text-[var(--gold)] font-bold">{filteredSearchRestaurants.length} found</span>
                  </div>

                  {filteredSearchRestaurants.length > 0 ? (
                    filteredSearchRestaurants.map((r: any, idx: number) => {
                      const rName = r.name || r.brand_name || "Restaurant";
                      const rCity = r.city || "Lahore";
                      const rBranch = r.branch || (r.branches?.[0]?.name) || "Main Branch";
                      const rStatus = r.status || "Active";
                      const rCategory = r.category || "Casual Dining";

                      return (
                        <div
                          key={r.id || idx}
                          onClick={() => {
                            setActiveNav("Restaurants");
                            setIsSearchOpen(false);
                            const filterVal = searchFilterType === "location" ? rCity : rName;
                            setSearchQuery(filterVal);
                            if (typeof window !== "undefined") {
                              window.history.pushState(null, "", "/super-admin/restaurants");
                              localStorage.setItem("sa_global_search_filter", filterVal);
                              window.dispatchEvent(new CustomEvent("sa_global_search_event", { detail: { query: filterVal } }));
                              window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                            }
                          }}
                          className="p-2.5 rounded-xl hover:bg-[var(--surface-hi)] transition-all cursor-pointer flex items-center justify-between gap-3 group border border-transparent hover:border-[var(--border)]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              {searchFilterType === "location" ? (
                                <MapPin className="w-4 h-4 text-[var(--gold)]" />
                              ) : (
                                <Store className="w-4 h-4 text-[var(--gold)]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors truncate flex items-center gap-1.5">
                                <span>{rName}</span>
                                {searchFilterType === "location" && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold)]/20 text-[var(--gold)] font-bold">
                                    {rCity}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--text-lo)] truncate flex items-center gap-1.5 mt-0.5">
                                {searchFilterType === "location" ? (
                                  <>
                                    <span className="text-[var(--text-hi)] font-medium">📍 {rCity}, {rBranch}</span>
                                    <span>·</span>
                                    <span>{rCategory}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>{rCategory}</span>
                                    <span>·</span>
                                    <span>📍 {rCity}</span>
                                    {rBranch && <span>({rBranch})</span>}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                String(rStatus).toLowerCase() === "active"
                                  ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                                  : String(rStatus).toLowerCase() === "suspended"
                                  ? "bg-[var(--orange)]/15 text-[var(--orange)] border border-[var(--orange)]/30"
                                  : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                              }`}
                            >
                              {rStatus}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-faint)] group-hover:text-[var(--gold)] group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-xs text-[var(--text-lo)] font-medium">
                        {searchFilterType === "name"
                          ? `No restaurants found matching "${searchQuery}"`
                          : `No restaurants found in location "${searchQuery}"`}
                      </p>
                      <p className="text-[11px] text-[var(--text-faint)] mt-1">
                        Try searching by another {searchFilterType === "name" ? "restaurant name" : "city or location"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Actions, Theme Switcher, Notifications, CTA, Avatar (Hidden on 300px-480px when search is open) */}
            <div className={`items-center gap-1.5 sm:gap-2.5 lg:gap-3 shrink-0 ${isSearchOpen ? "hidden min-[481px]:flex" : "flex"}`}>

              {/* Sun/Moon Theme Toggle with Dynamic Light/Dark Tooltip */}
              <div className="relative group">
                <button
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  className="p-2 sm:p-2.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all cursor-pointer flex items-center justify-center"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 transition-transform hover:rotate-45" />
                  ) : (
                    <Moon className="w-4 h-4 transition-transform hover:-rotate-12" />
                  )}
                </button>

                {/* Custom Floating Theme Tooltip */}
                <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 -translate-y-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                  <div className="px-3 py-1 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl flex items-center gap-1.5">
                    <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                  </div>
                  {/* Arrow pointing up */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-t border-[var(--border-hi)]"></div>
                </div>
              </div>

              {/* Notification Bell with Ping Dot */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 sm:p-2.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] transition-all relative cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--orange)] shadow-[0_0_6px_var(--orange)]"></span>
                </button>

                {/* Notifications Dropdown Popover */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[var(--bg-deep)] border border-[var(--border-hi)] p-4 shadow-2xl z-50 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <span className="font-bold text-xs">Recent Alerts</span>
                      <span className="text-xs text-[var(--gold)] font-medium cursor-pointer">Mark all read</span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="p-2 rounded-lg bg-[var(--surface-hi)]">
                        <div className="font-semibold text-[var(--orange)]">Kitchen Delay Alert</div>
                        <div className="text-[var(--text-lo)] text-[11px]">Salt&apos;n Pepper queue exceeded 20 mins.</div>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--surface-hi)]">
                        <div className="font-semibold text-[var(--gold)]">New Vendor Request</div>
                        <div className="text-[var(--text-lo)] text-[11px]">Saffron Grill submitted registration documents.</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* "Add Restaurant" Primary CTA */}
              <button
                onClick={() => {
                  setActiveNav("Restaurants");
                  setActiveRestaurantMode("new");
                  setNavResetKey((k) => k + 1);
                  if (typeof window !== "undefined") {
                    window.history.pushState(null, "", "/super-admin/restaurants/new");
                    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                  }
                }}
                className="hidden min-[481px]:inline-flex btn-gold animate-sheen text-xs px-2.5 sm:px-3.5 lg:px-4 py-2 gap-1.5 font-bold cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Add Restaurant</span>
                <span className="hidden sm:inline lg:hidden">Add</span>
              </button>

              {/* Super Admin Avatar with Custom Tooltip */}
              <div className="relative group shrink-0">
                <div
                  aria-label="Super Admin Profile"
                  onClick={() => handleNavClick("Settings")}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] border border-white/40 shadow-md cursor-pointer hover:scale-105 transition-transform select-none overflow-hidden flex items-center justify-center"
                >
                  {adminAvatarUrl ? (
                    <img
                      src={adminAvatarUrl}
                      alt="Super Admin Avatar"
                      className="w-full h-full object-cover"
                      onError={() => setAdminAvatarUrl(null)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center">
                      SA
                    </div>
                  )}
                </div>

                {/* Custom Floating Profile Tooltip */}
                <div className="absolute top-[calc(100%+10px)] right-0 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 -translate-y-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                  {adminAvatarUrl ? (
                    <img
                      src={adminAvatarUrl}
                      alt="Super Admin Avatar"
                      className="w-full h-full object-cover"
                      onError={() => setAdminAvatarUrl(null)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center">
                      SA
                    </div>
                  )}
                </div>

                {/* Custom Floating Profile Tooltip */}
                <div className="absolute top-[calc(100%+10px)] right-0 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 -translate-y-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                  <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]"></span>
                    <span>Super Admin Profile & Settings</span>
                  </div>
                  {/* Arrow */}
                  <div className="absolute -top-1 right-3.5 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-t border-[var(--border-hi)]"></div>
                </div>
              </div>
            </div>
          </header>

          {/* ===================== DASHBOARD BODY CONTENT ===================== */}
          <main className="p-3.5 sm:p-6 lg:p-8 pb-44 sm:pb-40 md:pb-12 space-y-6 sm:space-y-8 max-w-[1400px] w-full min-w-0 mx-auto">
            {activeNav === "Subscriptions & Plans" ? (
              <SubscriptionsPlansView showToast={showToast} initialMode={activePlanMode} />
            ) : activeNav === "Restaurants" ? (
              <RestaurantsView
                showToast={showToast}
                initialMode={activeRestaurantMode}
                resetTrigger={navResetKey}
                globalSearchQuery={searchQuery}
                globalSearchType={searchFilterType}
              />
            ) : activeNav === "Payments" ? (
              <PaymentsView showToast={showToast} />
            ) : activeNav === "Settings" ? (
              <SettingsView showToast={showToast} />
            ) : (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* ===================== PAGE HEADING ===================== */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider mb-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot"></span>
                      Omnibites Multi-Vendor Master
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-bold text-[var(--text-hi)] tracking-tight">
                      Network <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Overview</span>
                    </h1>
                    <p suppressHydrationWarning className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
                      Today — {currentDate || "Live Data"} · Everything running normally across {networkMetrics.totalOutlets} {networkMetrics.totalOutlets === 1 ? "outlet" : "outlets"} ({networkMetrics.activeBrands} active {networkMetrics.activeBrands === 1 ? "brand" : "brands"}).
                    </p>
                  </div>

              {/* Top Quick Actions */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[var(--gold)]" : ""}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={() => showToast("Exporting Master Telemetry CSV...")}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* ===================== SECTION 1: 4 STAT CARDS ===================== */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Total Registered Brands */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] text-xs font-semibold border border-[var(--gold)]/30">
                    <ArrowUpRight className="w-3 h-3" /> Registered Brands
                  </span>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-bold text-[var(--text-hi)] tracking-tight">
                    {countBrands}
                  </div>
                  <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                    Total Registered Brands
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-xs text-[var(--text-faint)] flex items-center justify-between">
                  <span>Active: <strong className="text-[#25d366] font-semibold">{networkMetrics.activeBrands}</strong></span>
                  <span>Deactive: <strong className="text-amber-400 font-semibold">{networkMetrics.deactivatedBrands}</strong></span>
                </div>
              </div>

              {/* Card 2: Total Network Outlets / Physical Branches */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/30 text-[var(--orange)] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--orange-dim)] text-[var(--orange)] text-xs font-semibold border border-[var(--orange)]/30">
                    <ArrowUpRight className="w-3 h-3" /> Network Scale
                  </span>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-bold text-[var(--text-hi)] tracking-tight">
                    {countOutlets}
                  </div>
                  <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                    Total Network Outlets
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-xs text-[var(--text-faint)] flex items-center justify-between">
                  <span>Standalone: <strong className="text-[var(--text-hi)] font-semibold">{networkMetrics.standaloneOutlets}</strong></span>
                  <span>Franchise: <strong className="text-[var(--gold)] font-semibold">{networkMetrics.franchiseOutlets}</strong></span>
                </div>
              </div>

              {/* Card 3: Monthly Gross Merchandise Value (GMV) */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] text-xs font-semibold border border-[var(--gold)]/30">
                    <ArrowUpRight className="w-3 h-3" /> Live Volume
                  </span>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-bold text-[var(--text-hi)] tracking-tight">
                    ${countGMV.toLocaleString()}
                  </div>
                  <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                    Monthly Platform GMV
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-xs text-[var(--text-faint)] flex items-center justify-between">
                  <span>Volume: <strong className="text-[var(--text-hi)] font-semibold">Live</strong></span>
                  <span>Status: <strong className="text-[#25d366] font-semibold">Active</strong></span>
                </div>
              </div>

              {/* Card 4: Pending Payouts / Vendor Settlements */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] text-xs font-semibold border border-[var(--gold)]/30">
                    <ArrowUpRight className="w-3 h-3" /> Settlement Queue
                  </span>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-bold text-[var(--text-hi)] tracking-tight">
                    ${countPayouts.toLocaleString()}
                  </div>
                  <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                    Pending Vendor Payouts
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-xs text-[var(--text-faint)] flex items-center justify-between">
                  <span>Transfers: <strong className="text-[var(--text-hi)] font-semibold">{networkMetrics.pendingTransfersCount}</strong></span>
                  <span>Clearing: <strong className="text-amber-400 font-semibold">48h Cycle</strong></span>
                </div>
              </div>
            </section>

            {/* ===================== SECTION 2: SIGNATURE "LIVE NETWORK MAP" ORBIT CARD ===================== */}
            <section className="glass-panel rounded-3xl p-6 sm:p-9 border border-[var(--border-hi)] relative overflow-hidden">
              {/* Radial ambient glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,var(--gold-dim)_0%,transparent_70%)] pointer-events-none -z-0 opacity-40"></div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                {/* Left (5 cols): Description & Legend */}
                <div className="lg:col-span-5 space-y-6">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--gold)] text-xs font-semibold uppercase tracking-wider mb-2">
                      <Activity className="w-3.5 h-3.5" /> Topology Telemetry
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-hi)]">
                      Live Network Topology
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-lo)] leading-relaxed mt-2">
                      Global telemetry monitoring multi-tenant cloud hubs, payment settlement gateways, and regional sync nodes across all active restaurant networks.
                    </p>
                  </div>

                  {/* 4 Status Types Legend */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#25d366] shadow-[0_0_8px_#25d366]"></span>
                        <span className="text-xs font-semibold text-[var(--text-hi)]">Healthy Hubs</span>
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-lo)]">48 / 48</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]"></span>
                        <span className="text-xs font-semibold text-[var(--text-hi)]">Sync Lag</span>
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-lo)]">&lt; 12 ms</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00e8ff] shadow-[0_0_8px_#00e8ff]"></span>
                        <span className="text-xs font-semibold text-[var(--text-hi)]">Standby Replicas</span>
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-lo)]">6 Standby</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--orange)] shadow-[0_0_8px_var(--orange)]"></span>
                        <span className="text-xs font-semibold text-[var(--text-hi)]">Gateway Alerts</span>
                      </div>
                      <span className="text-xs font-semibold text-[#25d366]">0 Normal</span>
                    </div>
                  </div>

                  {/* Telemetry Metrics */}
                  <div className="p-4 rounded-2xl bg-[var(--bg-deep)]/80 border border-[var(--border)]/70 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[var(--text-faint)] block text-xs uppercase font-medium">POOL LATENCY</span>
                      <span className="text-[var(--gold)] font-semibold text-sm">8 ms</span>
                    </div>
                    <div className="w-px h-8 bg-[var(--border)]"></div>
                    <div>
                      <span className="text-[var(--text-faint)] block text-xs uppercase font-medium">EDGE REPLICATION</span>
                      <span className="text-[#25d366] font-semibold text-sm">99.99%</span>
                    </div>
                    <div className="w-px h-8 bg-[var(--border)]"></div>
                    <div>
                      <span className="text-[var(--text-faint)] block text-xs uppercase font-medium">ENCRYPTION</span>
                      <span className="text-[var(--text-hi)] font-semibold text-sm">TLS 1.3 · AES-256</span>
                    </div>
                  </div>
                </div>

                {/* Right (7 cols): CSS 3-Ring Concentric Orbit Animation */}
                <div className="lg:col-span-7 flex items-center justify-center min-h-[380px] sm:min-h-[440px] relative select-none">
                  {/* Central Super Admin Hub */}
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#f5c85c] via-[#e3b13b] to-[#e04e17] p-0.5 shadow-[0_0_35px_var(--gold-glow)] z-20 flex items-center justify-center text-center">
                    <div className="w-full h-full rounded-full bg-[var(--bg-deep)] flex flex-col items-center justify-center p-1.5">
                      <span className="text-[9px] font-bold text-[var(--gold)] uppercase tracking-wider">GLOBAL</span>
                      <span className="text-[11px] font-bold text-[var(--text-hi)] leading-tight">SUPER ADMIN</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] mt-1 shadow-[0_0_6px_#25d366]"></span>
                    </div>
                  </div>

                  {/* Ring 1 (Inner, 170px width) */}
                  <div
                    className="absolute w-[170px] h-[170px] rounded-full border border-dashed border-[var(--gold)]/40 animate-orbit-spin pointer-events-none"
                    style={{ animationDuration: "35s" }}
                  >
                    {/* Node A: LHR Core Hub */}
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 pointer-events-auto">
                      <div className="animate-orbit-spin-reverse flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[var(--gold)] shadow-lg text-xs font-semibold text-[var(--gold)] whitespace-nowrap" style={{ animationDuration: "35s" }}>
                        <Database className="w-3 h-3 text-[var(--gold)]" />
                        <span>LHR Core Hub</span>
                      </div>
                    </div>

                    {/* Node B: KHI Edge Node */}
                    <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 pointer-events-auto">
                      <div className="animate-orbit-spin-reverse flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[#25d366] shadow-lg text-xs font-semibold text-[#25d366] whitespace-nowrap" style={{ animationDuration: "35s" }}>
                        <Cloud className="w-3 h-3 text-[#25d366]" />
                        <span>KHI Edge Node</span>
                      </div>
                    </div>
                  </div>

                  {/* Ring 2 (Middle, 280px width - Reverse Spin) */}
                  <div
                    className="absolute w-[280px] h-[280px] rounded-full border border-dashed border-[var(--orange)]/30 animate-orbit-spin-reverse pointer-events-none"
                    style={{ animationDuration: "50s" }}
                  >
                    {/* Node C: ISB Multi-Tenant DB */}
                    <div className="absolute top-1/2 -left-4 -translate-y-1/2 pointer-events-auto">
                      <div className="animate-orbit-spin flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-lg text-xs font-semibold text-[var(--text-hi)] whitespace-nowrap" style={{ animationDuration: "50s" }}>
                        <Server className="w-3 h-3 text-[var(--gold)]" />
                        <span>ISB Multi-Tenant DB</span>
                      </div>
                    </div>

                    {/* Node D: Regional Sync Hub */}
                    <div className="absolute top-1/2 -right-4 -translate-y-1/2 pointer-events-auto">
                      <div className="animate-orbit-spin flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-lg text-xs font-semibold text-[var(--text-hi)] whitespace-nowrap" style={{ animationDuration: "50s" }}>
                        <Globe className="w-3 h-3 text-[var(--orange)]" />
                        <span>Regional Sync Hub</span>
                      </div>
                    </div>
                  </div>

                  {/* Ring 3 (Outer, 380px width) */}
                  <div
                    className="absolute w-[360px] sm:w-[390px] h-[360px] sm:h-[390px] rounded-full border border-dashed border-[var(--gold)]/20 animate-orbit-spin pointer-events-none"
                    style={{ animationDuration: "75s" }}
                  >
                    {/* Node E: Stripe / PayFast API */}
                    <div className="absolute top-6 right-8 pointer-events-auto">
                      <div className="animate-orbit-spin-reverse flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[#25d366] shadow-lg text-xs font-semibold text-[#25d366] whitespace-nowrap" style={{ animationDuration: "75s" }}>
                        <Zap className="w-3 h-3 text-[#25d366]" />
                        <span>Stripe / PayFast API</span>
                      </div>
                    </div>

                    {/* Node F: JazzCash Settlement Rail */}
                    <div className="absolute bottom-6 left-8 pointer-events-auto">
                      <div className="animate-orbit-spin-reverse flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[var(--gold)] shadow-lg text-xs font-semibold text-[var(--gold)] whitespace-nowrap" style={{ animationDuration: "75s" }}>
                        <CreditCard className="w-3 h-3 text-[var(--gold)]" />
                        <span>JazzCash Gateway</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ===================== SECTION 3: TWO-COLUMN (MAIN 65% / SIDEBAR 35%) ===================== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* ===================== MAIN COLUMN (65%) ===================== */}
              <div className="lg:col-span-8 space-y-8">
                {/* 3A: Interactive Revenue Trend Card */}
                <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-xl text-[var(--text-hi)]">
                        Revenue &amp; Order Trajectory
                      </h3>
                      <p className="text-xs text-[var(--text-lo)] mt-0.5">
                        Gross transacted volume across all active franchise networks
                      </p>
                    </div>

                    {/* Time-Range Segmented Control */}
                    <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-medium self-start sm:self-auto">
                      {(["today", "7d", "30d"] as const).map((range) => (
                        <button
                          key={range}
                          onClick={() => setRevenueRange(range)}
                          className={`px-3 py-1 rounded-full transition-all cursor-pointer capitalize text-xs ${revenueRange === range
                            ? "bg-[var(--gold)] text-[#342c14] font-semibold shadow-md"
                            : "text-[var(--text-lo)] hover:text-[var(--text-hi)] font-medium"
                            }`}
                        >
                          {range === "today" ? "Today" : range === "7d" ? "7 Days" : "30 Days"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SVG Area + Line Chart */}
                  <div className="relative h-64 w-full pt-4">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e3b13b" stopOpacity="0.45" />
                          <stop offset="60%" stopColor="#e04e17" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#140c0c" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Gridlines */}
                      <line x1="0" y1="40" x2="700" y2="40" stroke="rgba(247, 231, 190, 0.08)" strokeDasharray="4 4" />
                      <line x1="0" y1="90" x2="700" y2="90" stroke="rgba(247, 231, 190, 0.08)" strokeDasharray="4 4" />
                      <line x1="0" y1="140" x2="700" y2="140" stroke="rgba(247, 231, 190, 0.08)" strokeDasharray="4 4" />

                      {/* Area Fill */}
                      <path
                        d="M 0 160 Q 110 130 220 90 T 440 70 T 580 40 T 700 25 L 700 190 L 0 190 Z"
                        fill="url(#chartGradient)"
                      />

                      {/* Line Stroke */}
                      <path
                        d="M 0 160 Q 110 130 220 90 T 440 70 T 580 40 T 700 25"
                        fill="none"
                        stroke="#e3b13b"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />

                      {/* Glowing Endpoint Dot */}
                      <circle cx="700" cy="25" r="6" fill="#e3b13b" className="animate-pulse" />
                      <circle cx="700" cy="25" r="12" fill="none" stroke="#e3b13b" strokeOpacity="0.4" />
                    </svg>

                    {/* Chart Tooltip Point Preview */}
                    <div className="absolute top-2 right-4 bg-[var(--bg-deep)] border border-[var(--gold)] px-3 py-1.5 rounded-xl shadow-xl text-xs">
                      <span className="text-[var(--text-faint)] block text-xs uppercase font-medium">CURRENT PEAK</span>
                      <span className="text-[var(--gold)] font-semibold">$482,650</span>
                    </div>
                  </div>

                  {/* Chart Bottom Legend Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--border)]/70 text-center">
                    <div>
                      <span className="text-xs text-[var(--text-faint)] uppercase block font-medium">This Week</span>
                      <span className="text-sm font-semibold text-[var(--text-hi)]">$3,428,900</span>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--text-faint)] uppercase block font-medium">Last Week</span>
                      <span className="text-sm font-semibold text-[var(--text-lo)]">$2,904,100</span>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--text-faint)] uppercase block font-medium">Growth</span>
                      <span className="text-sm font-semibold text-[#25d366]">+18.07%</span>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--text-faint)] uppercase block font-medium">Total Bills</span>
                      <span className="text-sm font-semibold text-[var(--gold)]">12,894</span>
                    </div>
                  </div>
                </div>

                {/* 3B: Top Performing Restaurants Table */}
                <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xl text-[var(--text-hi)]">
                        Top Performing Branches
                      </h3>
                      <p className="text-xs text-[var(--text-lo)] mt-0.5">
                        Highest order throughput and 5-star customer review scores
                      </p>
                    </div>

                    <button
                      onClick={() => showToast("Viewing full 248 restaurants catalog")}
                      className="text-xs text-[var(--gold)] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Responsive Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--text-faint)]">
                          <th className="pb-3 font-semibold">Restaurant</th>
                          <th className="pb-3 font-semibold">City / Branch</th>
                          <th className="pb-3 font-semibold text-right">Orders</th>
                          <th className="pb-3 font-semibold text-right">Revenue</th>
                          <th className="pb-3 font-semibold text-center">Rating</th>
                          <th className="pb-3 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]/40 font-medium">
                        {topRestaurants.map((res, idx) => (
                          <tr key={idx} className="group">
                            {/* Logo + Name */}
                            <td className="py-3.5 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-semibold text-xs flex items-center justify-center shadow-sm">
                                {res.initials}
                              </div>
                              <span className="font-semibold text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors">
                                {res.name}
                              </span>
                            </td>

                            {/* Branch */}
                            <td className="py-3.5 text-[var(--text-lo)]">
                              {res.branch}
                            </td>

                            {/* Orders */}
                            <td className="py-3.5 text-right font-semibold text-[var(--text-hi)]">
                              {res.orders}
                            </td>

                            {/* Revenue */}
                            <td className="py-3.5 text-right font-semibold text-[var(--gold)]">
                              {res.revenue}
                            </td>

                            {/* Rating */}
                            <td className="py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface-hi)] text-[var(--text-hi)] text-xs font-medium">
                                <Star className="w-3 h-3 fill-[var(--gold)] text-[var(--gold)]" />
                                {res.rating}
                              </span>
                            </td>

                            {/* Status Pill */}
                            <td className="py-3.5 text-right">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${res.status === "Active"
                                  ? "bg-[#25d366]/15 text-[#25d366] border-[#25d366]/30"
                                  : "bg-[var(--orange-dim)] text-[var(--orange)] border-[var(--orange)]/30"
                                  }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${res.status === "Active" ? "bg-[#25d366] animate-pulse" : "bg-[var(--orange)]"}`}></span>
                                {res.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ===================== SIDEBAR COLUMN (35%) ===================== */}
              <div className="lg:col-span-4 space-y-8">
                {/* 3C: New Vendors Pending Approval */}
                <div className="glass-panel rounded-3xl p-6 space-y-5">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-[var(--gold)]" />
                      <h3 className="font-bold text-base text-[var(--text-hi)]">
                        Pending Approvals
                      </h3>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                      {pendingVendors.length} New
                    </span>
                  </div>

                  {pendingVendors.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[var(--text-lo)]">
                      <CheckCircle2 className="w-8 h-8 text-[#25d366] mx-auto mb-2 opacity-80" />
                      All onboarding queue cleared!
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {pendingVendors.map((vendor) => (
                        <div
                          key={vendor.id}
                          className="p-3.5 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] space-y-3 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${vendor.color} text-[#342c14] font-semibold text-xs flex items-center justify-center`}>
                                {vendor.initials}
                              </div>
                              <div>
                                <h4 className="font-semibold text-xs text-[var(--text-hi)]">
                                  {vendor.name}
                                </h4>
                                <p className="text-xs text-[var(--text-faint)]">
                                  {vendor.city}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-[var(--text-faint)]">
                              {vendor.submitted}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-deep)] text-[var(--gold)] border border-[var(--border)] font-medium">
                              {vendor.category}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleApproveVendor(vendor.id, vendor.name)}
                                className="px-3 py-1 rounded-lg bg-[#25d366]/20 hover:bg-[#25d366] text-[#25d366] hover:text-[#0b1f13] text-xs font-semibold transition-all cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectVendor(vendor.id, vendor.name)}
                                className="px-2 py-1 rounded-lg bg-[var(--orange-dim)] hover:bg-[#ff4d4f] text-[var(--orange)] hover:text-white text-xs font-semibold transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3D: Live Activity Feed */}
                <div className="glass-panel rounded-3xl p-6 space-y-5">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#25d366]" />
                      <h3 className="font-bold text-base text-[var(--text-hi)]">
                        Live Activity
                      </h3>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-[#25d366] animate-ping"></span>
                  </div>

                  <div className="space-y-4">
                    {liveEvents.map((evt) => (
                      <div key={evt.id} className="flex items-start gap-3 text-xs">
                        <span className={`w-2 h-2 rounded-full ${evt.color} mt-1.5 shrink-0 shadow-sm`}></span>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[var(--text-hi)]">{evt.title}</span>
                            <span className="text-xs text-[var(--text-faint)]">{evt.time}</span>
                          </div>
                          <p className="text-xs text-[var(--text-lo)] leading-tight">{evt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => showToast("Opening full audit event logger")}
                      className="w-full py-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all text-center cursor-pointer"
                    >
                      Open Full Event Log &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
        </div>
      </div>

      {/* ===================== MOBILE BOTTOM NAVIGATION BAR ===================== */}
      {/* ===================== MOBILE BOTTOM NAVIGATION BAR (FIXED) ===================== */}
      <nav
        aria-label="Mobile Navigation"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          willChange: "transform",
        }}
        className="md:hidden w-full bg-[var(--bg-deep)]/95 backdrop-blur-2xl border-t border-[var(--border)] px-3 py-2 flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.7)]"
      >
        {/* 1. Dashboard Button */}
        <button
          type="button"
          onClick={() => {
            handleNavClick("Dashboard");
            setMobileSidebarOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-[360px]:gap-1 py-1 rounded-xl font-semibold transition-all cursor-pointer select-none ${
            activeNav === "Dashboard"
              ? "text-[var(--gold)] font-bold"
              : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
          }`}
        >
          <div className={`p-1 min-[360px]:p-1.5 rounded-xl transition-all ${activeNav === "Dashboard" ? "bg-[var(--gold-dim)] text-[var(--gold)] scale-110 shadow-sm shadow-[var(--gold-glow)]" : ""}`}>
            <LayoutDashboard className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5" />
          </div>
          <span style={{ fontSize: "clamp(9.5px, 2.7vw, 11px)" }} className="leading-tight">
            Dashboard
          </span>
        </button>

        {/* 2. Restaurants Button */}
        <button
          type="button"
          onClick={() => {
            handleNavClick("Restaurants");
            setMobileSidebarOpen(false);
          }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-[360px]:gap-1 py-1 rounded-xl font-semibold transition-all cursor-pointer select-none ${
            activeNav === "Restaurants"
              ? "text-[var(--gold)] font-bold"
              : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
          }`}
        >
          <div className={`p-1 min-[360px]:p-1.5 rounded-xl transition-all ${activeNav === "Restaurants" ? "bg-[var(--gold-dim)] text-[var(--gold)] scale-110 shadow-sm shadow-[var(--gold-glow)]" : ""}`}>
            <Store className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5" />
          </div>
          <span style={{ fontSize: "clamp(9.5px, 2.7vw, 11px)" }} className="leading-tight">
            Restaurants
          </span>
        </button>

        {/* 3. Menu Button (Opens Bottom Sheet Modal for Subscriptions & Plans, Settings, etc.) */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen((prev) => !prev)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-[360px]:gap-1 py-1 rounded-xl font-semibold transition-all cursor-pointer select-none ${
            mobileSidebarOpen || (activeNav !== "Dashboard" && activeNav !== "Restaurants")
              ? "text-[var(--gold)] font-bold"
              : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
          }`}
        >
          <div className={`p-1 min-[360px]:p-1.5 rounded-xl transition-all ${mobileSidebarOpen || (activeNav !== "Dashboard" && activeNav !== "Restaurants") ? "bg-[var(--gold-dim)] text-[var(--gold)] scale-110 shadow-sm shadow-[var(--gold-glow)]" : ""}`}>
            <Menu className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5" />
          </div>
          <span style={{ fontSize: "clamp(9.5px, 2.7vw, 11px)" }} className="leading-tight">
            Menu
          </span>
        </button>
      </nav>

      {/* ===================== ADD RESTAURANT MODAL ===================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsAddModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-[var(--bg-deep)] border border-[var(--gold)]/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[var(--text-hi)]">
                    Register New Restaurant
                  </h3>
                  <p className="text-xs text-[var(--text-lo)]">
                    Deploy POS and kitchen dispatch instance
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRestaurant} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  required
                  value={newRestaurant.name}
                  onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                  placeholder="e.g. Royal Taj Continental"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                    City / Region
                  </label>
                  <div className="relative">
                    <select
                      value={newRestaurant.city}
                      onChange={(e) => setNewRestaurant({ ...newRestaurant, city: e.target.value })}
                      className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-[var(--text-hi)] focus:outline-none cursor-pointer [&>option]:bg-[var(--bg-deep)] [&>option]:text-[var(--text-hi)]"
                    >
                      <option value="Lahore" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Lahore</option>
                      <option value="Karachi" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Karachi</option>
                      <option value="Islamabad" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Islamabad</option>
                      <option value="Rawalpindi" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Rawalpindi</option>
                      <option value="Faisalabad" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Faisalabad</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[var(--text-lo)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                    Category Format
                  </label>
                  <div className="relative">
                    <select
                      value={newRestaurant.category}
                      onChange={(e) => setNewRestaurant({ ...newRestaurant, category: e.target.value })}
                      className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-[var(--text-hi)] focus:outline-none cursor-pointer [&>option]:bg-[var(--bg-deep)] [&>option]:text-[var(--text-hi)]"
                    >
                      <option value="Fine Dining" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Fine Dining</option>
                      <option value="Cloud Kitchen" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Cloud Kitchen</option>
                      <option value="Fast Casual" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Fast Casual</option>
                      <option value="Cafe & Bakery" className="bg-[var(--bg-deep)] text-[var(--text-hi)]">Cafe &amp; Bakery</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[var(--text-lo)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[var(--text-hi)] uppercase text-xs">
                  Branch Address
                </label>
                <input
                  type="text"
                  value={newRestaurant.branch}
                  onChange={(e) => setNewRestaurant({ ...newRestaurant, branch: e.target.value })}
                  placeholder="e.g. MM Alam Road, Gulberg II"
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] font-semibold hover:text-[var(--text-hi)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold px-5 py-2.5 text-xs font-bold"
                >
                  Deploy Restaurant Instance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
