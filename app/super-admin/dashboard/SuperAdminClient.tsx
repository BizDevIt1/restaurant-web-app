"use client";

import React, { useState, useEffect } from "react";
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
  BarChart3,
  Settings,
  HelpCircle,
  ShieldCheck,
  Search,
  Sun,
  Moon,
  Bell,
  Plus,
  ArrowUpRight,
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
  Percent,
} from "lucide-react";
import SubscriptionsPlansView from "../subscriptions&plans/SubscriptionsPlansView";
import RestaurantsView from "../restaurants/RestaurantsView";

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
  initialRestaurantMode?: "new" | null;
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
    }
    return "Dashboard";
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialCollapsed);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [revenueRange, setRevenueRange] = useState<"today" | "7d" | "30d">("7d");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showWelcomeTooltip, setShowWelcomeTooltip] = useState(false);
  const [navResetKey, setNavResetKey] = useState(0);
  const [activePlanMode, setActivePlanMode] = useState<"new" | "edit" | null>(initialPlanMode || null);
  const [activeRestaurantMode, setActiveRestaurantMode] = useState<"new" | null>(initialRestaurantMode || null);

  useEffect(() => {
    // Show welcome tooltip on login / dashboard load for ~2.5 seconds
    const timer = setTimeout(() => {
      setShowWelcomeTooltip(true);
    }, 400);

    const hideTimer = setTimeout(() => {
      setShowWelcomeTooltip(false);
    }, 2800);

    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
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

  // New Vendor Approvals State
  const [pendingVendors, setPendingVendors] = useState([
    {
      id: "v-1",
      name: "Saffron Grill & Biryani",
      city: "Lahore · Gulberg III",
      category: "Desi / Dine-in",
      submitted: "12m ago",
      initials: "SG",
      color: "from-[#f5c85c] to-[#e3b13b]",
    },
    {
      id: "v-2",
      name: "Burger District 9",
      city: "Karachi · DHA Phase 6",
      category: "Fast Food / Takeaway",
      submitted: "45m ago",
      initials: "BD",
      color: "from-[#e04e17] to-[#8a300e]",
    },
    {
      id: "v-3",
      name: "Artisan Roasters & Cafe",
      city: "Islamabad · F-7 Markaz",
      category: "Cafe & Desserts",
      submitted: "2h ago",
      initials: "AR",
      color: "from-[#a3812c] to-[#e3b13b]",
    },
  ]);

  // Form State for Adding Restaurant
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    branch: "",
    city: "Lahore",
    category: "Casual Dining",
    phone: "",
  });

  // Animated stat values
  const countRestaurants = useCountUp(248);
  const countOrders = useCountUp(1842);
  const countRevenue = useCountUp(482650);
  const countRiders = useCountUp(356);

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
          localStorage.setItem("sa_active_nav", "Restaurants");
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
    { name: "Analytics", icon: BarChart3, badge: null },
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-hi)] font-sans antialiased transition-colors duration-400">
      {/* Compact Welcome Tooltip on Login */}
      {showWelcomeTooltip && (
        <div className="fixed top-[74px] right-6 sm:right-8 z-50 flex items-center px-4 py-2 rounded-full bg-[var(--surface-hi)] backdrop-blur-2xl border border-[var(--border)] text-[var(--text-hi)] shadow-xl animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none select-none">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-[var(--text-hi)]">
            Welcome to <span className="font-bold"><span className="text-[var(--text-hi)]">Omni</span><span className="text-[#f5a623]">bites</span></span>!
          </span>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[var(--bg-deep)] border border-[var(--gold)]/40 text-[var(--text-hi)] shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] animate-pulse"></span>
          <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* App Shell Layout */}
      <div className="flex min-h-screen">
        {/* ===================== 1. SIDEBAR (DESKTOP) ===================== */}
        <aside
          className={`hidden lg:flex flex-col shrink-0 bg-[var(--bg-deep)]/90 backdrop-blur-2xl border-r border-[var(--border)] sticky top-0 h-screen z-40 transition-[width] duration-300 ease-in-out ${
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
              <span className="font-display font-extrabold text-xl sm:text-[22px] tracking-tight leading-tight whitespace-nowrap">
                <span className="text-[var(--text-hi)]">Omni</span>
                <span className="text-[#f5a623]">bites</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--gold)] font-bold whitespace-nowrap mt-0.5">
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
                        className={`font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
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
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-[#342c14]">
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

        {/* ===================== MOBILE SIDEBAR DRAWER ===================== */}
        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setMobileSidebarOpen(false)}
            />

            {/* Content */}
            <div className="relative flex flex-col w-72 max-w-[85vw] bg-[var(--bg-deep)] border-r border-[var(--border)] h-full p-4 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <Link href="/" className="flex items-center gap-3">
                  <Image src="/logo.png" alt="Omnibites" width={48} height={48} className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(227,177,59,0.35)]" />
                  <span className="font-display font-extrabold text-xl">
                    <span className="text-[var(--text-hi)]">Omni</span>
                    <span className="text-[#f5a623]">bites</span>
                  </span>
                </Link>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-[var(--surface-hi)] text-[var(--text-lo)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5">
                {navOverview.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      handleNavClick(item.name);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium ${activeNav === item.name
                      ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold"
                      : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && <span className="text-[10px] font-mono">{item.badge}</span>}
                  </button>
                ))}
              </div>

              {/* Mobile Drawer Logout Button */}
              <div className="pt-3 border-t border-[var(--border)]">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#ff4d4f] hover:bg-[#ff4d4f]/15 border border-[#ff4d4f]/30 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-[#ff4d4f]" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== 2. MAIN CONTENT AREA ===================== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* ===================== TOP BAR ===================== */}
          <header className="sticky top-0 z-30 h-20 shrink-0 bg-[var(--bg-deep)]/75 backdrop-blur-xl border-b border-[var(--border)] px-4 sm:px-8 flex items-center justify-between gap-4">
            {/* Left: Mobile Toggle & Global Search */}
            <div className="flex items-center gap-3 flex-1 max-w-lg">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                aria-label="Open Navigation"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Global Search Input */}
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search restaurant, order ID, or rider..."
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-full pl-9 pr-4 py-2 text-xs sm:text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Right: Actions, Theme Switcher, Notifications, CTA, Avatar */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">

              {/* Sun/Moon Theme Toggle with Dynamic Light/Dark Tooltip */}
              <div className="relative group">
                <button
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  className="p-2.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all cursor-pointer flex items-center justify-center"
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
                  className="p-2.5 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] transition-all relative cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--orange)] shadow-[0_0_6px_var(--orange)]"></span>
                </button>

                {/* Notifications Dropdown Popover */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[var(--bg-deep)] border border-[var(--border-hi)] p-4 shadow-2xl z-50 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <span className="font-display font-bold text-xs">Recent Alerts</span>
                      <span className="font-mono text-[10px] text-[var(--gold)] cursor-pointer">Mark all read</span>
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

              {/* "Add Restaurant" Primary CTA with light sheen sweep */}
              <button
                onClick={() => {
                  setActiveNav("Restaurants");
                  if (typeof window !== "undefined") {
                    window.history.pushState(null, "", "/super-admin/restaurants/new");
                    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                  }
                }}
                className="btn-gold animate-sheen text-xs px-3.5 sm:px-4 py-2 gap-1.5 font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Restaurant</span>
              </button>

              {/* Super Admin Avatar with Custom Tooltip */}
              <div className="relative group">
                <div
                  aria-label="Super Admin Profile"
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center border border-white/40 shadow-md cursor-pointer hover:scale-105 transition-transform select-none"
                >
                  SA
                </div>

                {/* Custom Floating Profile Tooltip */}
                <div className="absolute top-[calc(100%+10px)] right-0 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 -translate-y-1.5 transition-all duration-200 z-50 whitespace-nowrap">
                  <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--bg-deep)] text-[var(--text-hi)] border border-[var(--border-hi)] shadow-2xl shadow-black/80 backdrop-blur-xl flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]"></span>
                    <span>Super Admin Profile</span>
                  </div>
                  {/* Arrow */}
                  <div className="absolute -top-1 right-3.5 w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-l border-t border-[var(--border-hi)]"></div>
                </div>
              </div>
            </div>
          </header>

          {/* ===================== DASHBOARD BODY CONTENT ===================== */}
          <main className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto">
            {activeNav === "Subscriptions & Plans" ? (
              <SubscriptionsPlansView showToast={showToast} initialMode={activePlanMode} />
            ) : activeNav === "Restaurants" ? (
              <RestaurantsView
                showToast={showToast}
                initialMode={activeRestaurantMode}
                resetTrigger={navResetKey}
              />
            ) : (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* ===================== PAGE HEADING ===================== */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot"></span>
                      Omnibites Multi-Vendor Master
                    </div>
                    <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                      Network <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Overview</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
                      Today — {currentDate || "Live Data"} · Everything running normally across 248 branches.
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
              {/* Card 1: Total Restaurants */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Store className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[11px] font-bold border border-[var(--gold)]/30">
                    <ArrowUpRight className="w-3 h-3" /> +12 this mo
                  </span>
                </div>
                <div>
                  <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                    {countRestaurants}
                  </div>
                  <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                    Total Active Restaurants
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
                  <span>211 online now</span>
                  <span className="text-[var(--gold)]">37 cloud kitchens</span>
                </div>
              </div>

              {/* Card 2: Orders In Progress */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/30 text-[var(--orange)] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--orange-dim)] text-[var(--orange)] font-mono text-[11px] font-bold border border-[var(--orange)]/30">
                    <TrendingUp className="w-3 h-3" /> +8.4% peak
                  </span>
                </div>
                <div>
                  <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                    {countOrders.toLocaleString()}
                  </div>
                  <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                    Orders In Progress
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
                  <span>Avg Prep: 14.2 min</span>
                  <span className="text-[#25d366]">98.2% on-time</span>
                </div>
              </div>

              {/* Card 3: Today's Revenue */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] font-mono text-[11px] font-bold border border-[#25d366]/30">
                    <ArrowUpRight className="w-3 h-3" /> +18.2%
                  </span>
                </div>
                <div>
                  <div className="font-mono font-extrabold text-2xl sm:text-3xl lg:text-[2.1rem] text-[var(--text-hi)] tracking-tight">
                    ${countRevenue.toLocaleString()}
                  </div>
                  <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                    Today&apos;s Gross Volume
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
                  <span>JazzCash: 48%</span>
                  <span className="text-[var(--gold)]">Easypaisa: 32%</span>
                </div>
              </div>

              {/* Card 4: Active Riders */}
              <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Bike className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] font-mono text-[11px] font-bold border border-[#25d366]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] animate-ping"></span> 94% online
                  </span>
                </div>
                <div>
                  <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                    {countRiders}
                  </div>
                  <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                    Active Delivery Fleet
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
                  <span>En Route: 284</span>
                  <span className="text-[var(--text-lo)]">Idle: 72</span>
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
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--gold)] font-mono text-[10.5px] font-bold uppercase tracking-wider mb-2">
                      <Activity className="w-3.5 h-3.5" /> Topology Telemetry
                    </div>
                    <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--text-hi)]">
                      Live Network Topology
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-lo)] leading-relaxed mt-2">
                      Real-time synchronized mesh connecting 248 branch POS terminals, kitchen display monitors, delivery fleets, and instant payment settlement rails.
                    </p>
                  </div>

                  {/* 4 Status Types Legend */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#25d366] shadow-[0_0_8px_#25d366]"></span>
                        <span className="text-xs font-semibold text-[var(--text-hi)]">Normal</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[var(--text-lo)]">211</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]"></span>
                        <span className="text-xs font-semibold text-[var(--text-hi)]">Peak Load</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[var(--text-lo)]">28</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00e8ff] shadow-[0_0_8px_#00e8ff]"></span>
                        <span className="text-xs font-semibold text-[var(--text-hi)]">Standby</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[var(--text-lo)]">6</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--orange)] shadow-[0_0_8px_var(--orange)]"></span>
                        <span className="text-xs font-semibold text-[var(--text-hi)]">Alert</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[var(--orange)]">3</span>
                    </div>
                  </div>

                  {/* Telemetry Metrics */}
                  <div className="p-4 rounded-2xl bg-[var(--bg-deep)]/80 border border-[var(--border)]/70 flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-[var(--text-faint)] block text-[10px]">SYNC LATENCY</span>
                      <span className="text-[var(--gold)] font-bold text-sm">14 ms</span>
                    </div>
                    <div className="w-px h-8 bg-[var(--border)]"></div>
                    <div>
                      <span className="text-[var(--text-faint)] block text-[10px]">PACKET LOSS</span>
                      <span className="text-[#25d366] font-bold text-sm">0.00%</span>
                    </div>
                    <div className="w-px h-8 bg-[var(--border)]"></div>
                    <div>
                      <span className="text-[var(--text-faint)] block text-[10px]">ENCRYPTION</span>
                      <span className="text-[var(--text-hi)] font-bold text-sm">AES-256</span>
                    </div>
                  </div>
                </div>

                {/* Right (7 cols): CSS 3-Ring Concentric Orbit Animation */}
                <div className="lg:col-span-7 flex items-center justify-center min-h-[380px] sm:min-h-[440px] relative select-none">
                  {/* Central Super Admin Hub */}
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#f5c85c] via-[#e3b13b] to-[#e04e17] p-0.5 shadow-[0_0_35px_var(--gold-glow)] z-20 flex items-center justify-center text-center">
                    <div className="w-full h-full rounded-full bg-[var(--bg-deep)] flex flex-col items-center justify-center p-2">
                      <span className="font-display font-extrabold text-[10px] text-[var(--gold)] uppercase tracking-wider">SUPER</span>
                      <span className="font-display font-black text-xs text-[var(--text-hi)]">ADMIN</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] mt-1 shadow-[0_0_6px_#25d366]"></span>
                    </div>
                  </div>

                  {/* Ring 1 (Inner, 170px width) */}
                  <div
                    className="absolute w-[170px] h-[170px] rounded-full border border-dashed border-[var(--gold)]/40 animate-orbit-spin pointer-events-none"
                    style={{ animationDuration: "35s" }}
                  >
                    {/* Node A: Kitchen KDS */}
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 pointer-events-auto">
                      <div className="animate-orbit-spin-reverse flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[var(--gold)] shadow-lg text-[10px] font-mono font-bold text-[var(--gold)]" style={{ animationDuration: "35s" }}>
                        <Flame className="w-3 h-3 text-[var(--orange)]" />
                        <span>KDS #12</span>
                      </div>
                    </div>

                    {/* Node B: POS Terminal */}
                    <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 pointer-events-auto">
                      <div className="animate-orbit-spin-reverse flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[#25d366] shadow-lg text-[10px] font-mono font-bold text-[#25d366]" style={{ animationDuration: "35s" }}>
                        <Store className="w-3 h-3" />
                        <span>Till #204</span>
                      </div>
                    </div>
                  </div>

                  {/* Ring 2 (Middle, 280px width - Reverse Spin) */}
                  <div
                    className="absolute w-[280px] h-[280px] rounded-full border border-dashed border-[var(--orange)]/30 animate-orbit-spin-reverse pointer-events-none"
                    style={{ animationDuration: "50s" }}
                  >
                    {/* Node C: Lahore Cloud Hub */}
                    <div className="absolute top-1/2 -left-4 -translate-y-1/2 pointer-events-auto">
                      <div className="animate-orbit-spin flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-lg text-[10px] font-mono font-bold text-[var(--text-hi)]" style={{ animationDuration: "50s" }}>
                        <MapPin className="w-3 h-3 text-[var(--gold)]" />
                        <span>LHR Cloud 01</span>
                      </div>
                    </div>

                    {/* Node D: Karachi Hub */}
                    <div className="absolute top-1/2 -right-4 -translate-y-1/2 pointer-events-auto">
                      <div className="animate-orbit-spin flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[var(--border-hi)] shadow-lg text-[10px] font-mono font-bold text-[var(--text-hi)]" style={{ animationDuration: "50s" }}>
                        <MapPin className="w-3 h-3 text-[var(--orange)]" />
                        <span>KHI Hub 04</span>
                      </div>
                    </div>
                  </div>

                  {/* Ring 3 (Outer, 380px width) */}
                  <div
                    className="absolute w-[360px] sm:w-[390px] h-[360px] sm:h-[390px] rounded-full border border-dashed border-[var(--gold)]/20 animate-orbit-spin pointer-events-none"
                    style={{ animationDuration: "75s" }}
                  >
                    {/* Node E: Rider Dispatch */}
                    <div className="absolute top-6 right-10 pointer-events-auto">
                      <div className="animate-orbit-spin-reverse flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[#25d366] shadow-lg text-[10px] font-mono font-bold text-[#25d366]" style={{ animationDuration: "75s" }}>
                        <Bike className="w-3 h-3" />
                        <span>Fleet 356</span>
                      </div>
                    </div>

                    {/* Node F: Settlement Rail */}
                    <div className="absolute bottom-6 left-10 pointer-events-auto">
                      <div className="animate-orbit-spin-reverse flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-deep)] border border-[var(--gold)] shadow-lg text-[10px] font-mono font-bold text-[var(--gold)]" style={{ animationDuration: "75s" }}>
                        <CreditCard className="w-3 h-3" />
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
                      <h3 className="font-display font-extrabold text-xl text-[var(--text-hi)]">
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
                          className={`px-3 py-1 rounded-full transition-all cursor-pointer capitalize font-mono text-xs ${revenueRange === range
                            ? "bg-[var(--gold)] text-[#342c14] font-bold shadow-md"
                            : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
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
                    <div className="absolute top-2 right-4 bg-[var(--bg-deep)] border border-[var(--gold)] px-3 py-1.5 rounded-xl shadow-xl font-mono text-xs">
                      <span className="text-[var(--text-faint)] block text-[10px]">CURRENT PEAK</span>
                      <span className="text-[var(--gold)] font-bold">$482,650</span>
                    </div>
                  </div>

                  {/* Chart Bottom Legend Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--border)]/70 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-[var(--text-faint)] uppercase block">This Week</span>
                      <span className="text-sm font-bold text-[var(--text-hi)]">$3,428,900</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-faint)] uppercase block">Last Week</span>
                      <span className="text-sm font-bold text-[var(--text-lo)]">$2,904,100</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-faint)] uppercase block">Growth</span>
                      <span className="text-sm font-bold text-[#25d366]">+18.07%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-faint)] uppercase block">Total Bills</span>
                      <span className="text-sm font-bold text-[var(--gold)]">12,894</span>
                    </div>
                  </div>
                </div>

                {/* 3B: Top Performing Restaurants Table */}
                <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-extrabold text-xl text-[var(--text-hi)]">
                        Top Performing Branches
                      </h3>
                      <p className="text-xs text-[var(--text-lo)] mt-0.5">
                        Highest order throughput and 5-star customer review scores
                      </p>
                    </div>

                    <button
                      onClick={() => showToast("Viewing full 248 restaurants catalog")}
                      className="text-xs font-mono text-[var(--gold)] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Responsive Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
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
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-bold text-xs flex items-center justify-center shadow-sm">
                                {res.initials}
                              </div>
                              <span className="font-bold text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors">
                                {res.name}
                              </span>
                            </td>

                            {/* Branch */}
                            <td className="py-3.5 text-[var(--text-lo)]">
                              {res.branch}
                            </td>

                            {/* Orders */}
                            <td className="py-3.5 text-right font-mono font-bold text-[var(--text-hi)]">
                              {res.orders}
                            </td>

                            {/* Revenue */}
                            <td className="py-3.5 text-right font-mono font-bold text-[var(--gold)]">
                              {res.revenue}
                            </td>

                            {/* Rating */}
                            <td className="py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface-hi)] text-[var(--text-hi)] font-mono text-[10.5px]">
                                <Star className="w-3 h-3 fill-[var(--gold)] text-[var(--gold)]" />
                                {res.rating}
                              </span>
                            </td>

                            {/* Status Pill */}
                            <td className="py-3.5 text-right">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold border ${res.status === "Active"
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
                      <h3 className="font-display font-extrabold text-base text-[var(--text-hi)]">
                        Pending Approvals
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                      {pendingVendors.length} New
                    </span>
                  </div>

                  {pendingVendors.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[var(--text-lo)] font-mono">
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
                              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${vendor.color} text-[#342c14] font-bold text-xs flex items-center justify-center`}>
                                {vendor.initials}
                              </div>
                              <div>
                                <h4 className="font-bold text-xs text-[var(--text-hi)]">
                                  {vendor.name}
                                </h4>
                                <p className="text-[10px] text-[var(--text-faint)]">
                                  {vendor.city}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono text-[9.5px] text-[var(--text-faint)]">
                              {vendor.submitted}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-deep)] text-[var(--gold)] border border-[var(--border)]">
                              {vendor.category}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleApproveVendor(vendor.id, vendor.name)}
                                className="px-3 py-1 rounded-lg bg-[#25d366]/20 hover:bg-[#25d366] text-[#25d366] hover:text-[#0b1f13] text-[11px] font-bold transition-all cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectVendor(vendor.id, vendor.name)}
                                className="px-2 py-1 rounded-lg bg-[var(--orange-dim)] hover:bg-[var(--orange)] text-[var(--orange)] hover:text-white text-[11px] font-bold transition-all cursor-pointer"
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
                      <h3 className="font-display font-extrabold text-base text-[var(--text-hi)]">
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
                            <span className="font-bold text-[var(--text-hi)]">{evt.title}</span>
                            <span className="font-mono text-[10px] text-[var(--text-faint)]">{evt.time}</span>
                          </div>
                          <p className="text-[11px] text-[var(--text-lo)] leading-tight">{evt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => showToast("Opening full audit event logger")}
                      className="w-full py-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--text-lo)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all text-center cursor-pointer"
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
                  <h3 className="font-display font-extrabold text-lg text-[var(--text-hi)]">
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
                <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                  <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
                <label className="font-bold text-[var(--text-hi)] uppercase font-mono text-[10.5px]">
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
