"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bike,
  ArrowLeft,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Car,
  Truck,
  UserPlus,
  DollarSign,
  Package,
  Navigation,
  RefreshCw,
  X,
  ChevronRight,
  Sparkles,
  IdCard,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { getValidTenantContext } from "@/lib/tenantResolver";
import { getStoredOrders, getStoredStaff, saveStoredStaff } from "@/lib/tenantStore";
import AdminSidebar from "../components/AdminSidebar";
import AdminBottomDock from "../components/AdminBottomDock";
import AdminMenuDrawer from "../components/AdminMenuDrawer";
import { getPermittedNavigation } from "../navigationConfig";
import { TAB_TO_PATH } from "../AdminDashboardClient";
import { AdminTab } from "../types";
import ModuleLockedView from "../components/ModuleLockedView";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export interface FleetRider {
  id: string;
  fullName: string;
  phone: string;
  cnic: string;
  email: string;
  vehicleType: "Motorcycle" | "Car" | "Cargo Van" | "Bicycle / E-Bike";
  vehicleRegNumber: string;
  assignedZones: string[];
  status: "available" | "in_transit" | "offline";
  codBalance: number;
  shift: string;
  joinedAt: string;
  currentOrderId?: string;
  currentDestination?: string;
}

export interface PendingDeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  zone: string;
  totalAmount: number;
  paymentMethod: "cash" | "card" | "raast";
  status: "ready" | "preparing" | "queued" | "assigned" | "on_route" | "out_for_delivery";
  prepTimeAgo: string;
}

function FleetConsoleContent({
  initialCollapsed = false,
}: {
  initialCollapsed?: boolean;
}) {
  const router = useRouter();
  const { user, logout, hasFeature } = useAuth();

  const [consoleTab, setConsoleTab] = useState<"register" | "dispatch">("dispatch");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "in_transit" | "offline">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<PendingDeliveryOrder | null>(null);
  const [selectedRiderIdForDispatch, setSelectedRiderIdForDispatch] = useState<string>("");

  // Layout & Navigation State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialCollapsed);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
      }
      return next;
    });
  };

  const handleTabChange = (tab: AdminTab) => {
    const target = TAB_TO_PATH[tab] || (tab === "overview" ? "/admin" : `/admin/${tab}`);
    router.push(target);
  };

  // ==========================================
  // Form State: Register New Rider
  // ==========================================
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleType, setVehicleType] = useState<"Motorcycle" | "Car" | "Cargo Van" | "Bicycle / E-Bike">("Motorcycle");
  const [vehicleRegNumber, setVehicleRegNumber] = useState("");
  const [shift, setShift] = useState("Evening");
  const [zoneInput, setZoneInput] = useState("");
  const [assignedZones, setAssignedZones] = useState<string[]>([]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ==========================================
  // Fleet & Orders State (Zero Dummy Mock Data)
  // ==========================================
  const [riders, setRiders] = useState<FleetRider[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("fleet_riders_data");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Strictly exclude any legacy dummy test accounts
            return parsed.filter(
              (r: any) =>
                r &&
                r.id !== "r-1" &&
                r.id !== "r-2" &&
                r.id !== "r-3" &&
                r.fullName !== "Ali Raza Khan" &&
                r.fullName !== "Hamza Shafiq" &&
                r.fullName !== "Bilal Tariq"
            );
          }
        }
      } catch {}
    }
    return [];
  });

  // Pending delivery orders awaiting dispatch (Zero Dummy Mock Data)
  const [pendingOrders, setPendingOrders] = useState<PendingDeliveryOrder[]>([]);

  // Navigation counts for sidebar badges
  const counts = useMemo(() => {
    const orgId = user?.organizationId || user?.id || "default";
    let storedStaff: any[] = [];
    try {
      storedStaff = getStoredStaff(orgId, []);
    } catch {}
    return {
      kdsTickets: 0,
      activeRiders: riders.filter((r) => r.status === "in_transit" || r.status === "available").length,
      staffTotal: storedStaff.length || riders.length,
      branchesTotal: user?.branches?.length || 0,
      menuAlerts: 0,
    };
  }, [user, riders]);

  // Persist cleaned fleet to local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cleaned = riders.filter(
          (r) =>
            r.id !== "r-1" &&
            r.id !== "r-2" &&
            r.id !== "r-3" &&
            r.fullName !== "Ali Raza Khan" &&
            r.fullName !== "Hamza Shafiq" &&
            r.fullName !== "Bilal Tariq"
        );
        localStorage.setItem("fleet_riders_data", JSON.stringify(cleaned));
      } catch {}
    }
  }, [riders]);

  // Sync actual riders & orders from Supabase & Tenant Store
  useEffect(() => {
    let isMounted = true;
    const fetchFleetAndOrders = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const resolvedRestId = Number(user?.organizationId || restId || 27);
        const orgId = String(user?.organizationId || restId || 27);

        // 1. Fetch Real Riders from Supabase
        const { data: staffData, error: staffError } = await supabase
          .from("staff_members")
          .select("*")
          .eq("restaurant_id", resolvedRestId)
          .eq("role", "rider")
          .order("created_at", { ascending: false });

        // 2. Fetch Real Riders from local tenant store
        const localStaffRiders = getStoredStaff(orgId).filter(
          (s: any) =>
            s.role === "rider" &&
            s.id !== "r-1" &&
            s.id !== "r-2" &&
            s.id !== "r-3" &&
            s.full_name !== "Ali Raza Khan" &&
            s.name !== "Ali Raza Khan"
        );

        const mergedRidersMap = new Map<string, FleetRider>();

        if (!staffError && staffData && Array.isArray(staffData)) {
          staffData.forEach((s: any) => {
            if (s.id === "r-1" || s.id === "r-2" || s.id === "r-3") return;
            if (
              s.full_name === "Ali Raza Khan" ||
              s.full_name === "Hamza Shafiq" ||
              s.full_name === "Bilal Tariq"
            )
              return;
            mergedRidersMap.set(s.id, {
              id: s.id,
              fullName: s.full_name || s.name || "Rider",
              phone: s.phone || "+92 300 0000000",
              cnic: s.cnic || "35201-0000000-0",
              email: s.email || "rider@omnibites.com",
              vehicleType: s.vehicle_type || "Motorcycle",
              vehicleRegNumber: s.vehicle_reg_number || "LE-2024",
              assignedZones:
                Array.isArray(s.assigned_zones) && s.assigned_zones.length > 0
                  ? s.assigned_zones
                  : ["Main City"],
              status: (s.status === "active" ? "available" : s.status || "available") as any,
              codBalance: Number(s.cod_balance || 0),
              shift: s.shift || "Evening",
              joinedAt: s.created_at ? new Date(s.created_at).toLocaleDateString() : "Active",
            });
          });
        }

        localStaffRiders.forEach((ls: any) => {
          if (!mergedRidersMap.has(ls.id)) {
            mergedRidersMap.set(ls.id, {
              id: ls.id,
              fullName: ls.full_name || ls.name || "Rider",
              phone: ls.phone || "+92 300 0000000",
              cnic: ls.cnic || "35201-0000000-0",
              email: ls.email || "rider@omnibites.com",
              vehicleType: ls.vehicle_type || "Motorcycle",
              vehicleRegNumber: ls.vehicle_reg_number || "LE-2024",
              assignedZones:
                Array.isArray(ls.assigned_zones) && ls.assigned_zones.length > 0
                  ? ls.assigned_zones
                  : ["Main City"],
              status: (ls.status === "active" ? "available" : ls.status || "available") as any,
              codBalance: Number(ls.cod_balance || 0),
              shift: ls.shift || "Evening",
              joinedAt: ls.created_at ? new Date(ls.created_at).toLocaleDateString() : "Active",
            });
          }
        });

        if (isMounted) {
          setRiders(Array.from(mergedRidersMap.values()));
        }

        // 3. Fetch Real Delivery Orders from Supabase
        const { data: ordersData, error: ordersErr } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", resolvedRestId)
          .eq("order_channel", "delivery")
          .neq("order_status", "cancelled")
          .order("created_at", { ascending: false });

        const { data: ticketsData } = await supabase
          .from("kitchen_tickets")
          .select("id, ticket_number, order_id, status")
          .eq("restaurant_id", resolvedRestId);

        // 4. Fetch Real Orders from local tenant store
        const localDeliveryOrders = getStoredOrders(orgId).filter(
          (o: any) =>
            o.orderChannel === "delivery" &&
            o.status !== "completed" &&
            o.status !== "cancelled" &&
            o.id !== "ord-101" &&
            o.id !== "ord-102" &&
            o.id !== "ord-103"
        );

        const realOrdersMap = new Map<string, PendingDeliveryOrder>();

        if (!ordersErr && ordersData && Array.isArray(ordersData)) {
          ordersData.forEach((o: any) => {
            if (o.id === "ord-101" || o.id === "ord-102" || o.id === "ord-103") return;
            const orderNum = o.order_number || `ORD-${String(o.id).slice(-4).toUpperCase()}`;

            const linkedTicket = (ticketsData || []).find((t: any) => {
              if (t.order_id === o.id) return true;
              if (t.ticket_number === o.kot_id || t.id === o.kot_id) return true;
              return false;
            });

            let ordStatus: "ready" | "preparing" | "queued" = "queued";
            if (o.order_status === "ready" || linkedTicket?.status === "ready") {
              ordStatus = "ready";
            } else if (o.order_status === "preparing" || linkedTicket?.status === "preparing") {
              ordStatus = "preparing";
            }

            realOrdersMap.set(String(o.id), {
              id: String(o.id),
              orderNumber: orderNum,
              customerName: o.customer_name || "Guest Customer",
              customerPhone: o.customer_phone || "+92 300 0000000",
              deliveryAddress:
                o.delivery_address || (o.delivery_zone ? `Zone: ${o.delivery_zone}` : "Delivery Address"),
              zone: o.delivery_zone || "General Delivery Area",
              totalAmount: Number(o.total_amount || 0),
              paymentMethod:
                o.payment_method === "card" || o.payment_method === "raast"
                  ? o.payment_method
                  : "cash",
              status: ordStatus,
              prepTimeAgo: o.created_at ? formatTimeAgo(new Date(o.created_at)) : "Just now",
            });
          });
        }

        localDeliveryOrders.forEach((lo: any) => {
          const loId = String(lo.id);
          if (!realOrdersMap.has(loId)) {
            let localStatus: "ready" | "preparing" | "queued" = "queued";
            if (lo.status === "ready") localStatus = "ready";
            else if (lo.status === "preparing") localStatus = "preparing";

            realOrdersMap.set(loId, {
              id: loId,
              orderNumber: lo.id,
              customerName: lo.tableName || lo.customerName || "Online Customer",
              customerPhone: lo.phone || "+92 300 0000000",
              deliveryAddress: lo.deliveryAddress || "Customer Delivery Address",
              zone: lo.deliveryZone || "Assigned Zone",
              totalAmount: Number(lo.total || 0),
              paymentMethod:
                lo.paymentMethod === "card" || lo.paymentMethod === "raast"
                  ? lo.paymentMethod
                  : "cash",
              status: localStatus,
              prepTimeAgo: lo.createdAt ? formatTimeAgo(new Date(lo.createdAt)) : "Recent",
            });
          }
        });

        if (isMounted) {
          setPendingOrders(Array.from(realOrdersMap.values()));
        }
      } catch (err) {
        console.warn("[FleetConsole] Sync error:", err);
      }
    };

    fetchFleetAndOrders();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // ==========================================
  // Zone Tag Adder
  // ==========================================
  const handleAddZone = () => {
    const trimmed = zoneInput.trim();
    if (!trimmed) return;
    if (assignedZones.includes(trimmed)) {
      showToast("Zone already added.");
      return;
    }
    setAssignedZones((prev) => [...prev, trimmed]);
    setZoneInput("");
  };

  const handleRemoveZone = (z: string) => {
    setAssignedZones((prev) => prev.filter((item) => item !== z));
  };

  // ==========================================
  // Form Submit: Register New Rider
  // ==========================================
  const handleRegisterRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      showToast("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    const newId = `rider-${Date.now()}`;
    const cleanZones = assignedZones.length > 0 ? assignedZones : ["City Central"];

    const newRider: FleetRider = {
      id: newId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      cnic: cnic.trim() || "35201-0000000-0",
      email: email.trim().toLowerCase(),
      vehicleType,
      vehicleRegNumber: vehicleRegNumber.trim() || "LE-24-PENDING",
      assignedZones: cleanZones,
      status: "available",
      codBalance: 0,
      shift,
      joinedAt: "Just now",
    };

    // Optimistically update fleet
    setRiders((prev) => [newRider, ...prev]);

    // Persist to Supabase staff_members & local tenant store
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const resolvedRestId = Number(user?.organizationId || restId || 27);
      const orgId = String(user?.organizationId || restId || 27);

      await supabase.from("staff_members").insert([
        {
          restaurant_id: resolvedRestId,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          role: "rider",
          terminal_access: "RIDER_ONLY",
          status: "active",
          shift,
          assigned_zones: cleanZones,
          password_hash: "rider123",
        },
      ]);

      // Save to local tenant store
      const currentStored = getStoredStaff(orgId);
      const staffMemberObj: any = {
        id: newId,
        restaurant_id: resolvedRestId,
        full_name: fullName.trim(),
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: "rider",
        terminal_access: "RIDER_ONLY",
        status: "active",
        shift,
        assigned_zones: cleanZones,
        vehicle_type: vehicleType,
        vehicle_reg_number: vehicleRegNumber.trim() || "LE-24-PENDING",
      };
      saveStoredStaff(orgId, [staffMemberObj, ...currentStored]);
    } catch (err) {
      console.warn("[FleetConsole] Supabase write note:", err);
    }

    setIsSubmitting(false);
    showToast(`Rider "${fullName.trim()}" registered to active fleet!`);

    // Reset Form
    setFullName("");
    setPhone("");
    setCnic("");
    setEmail("");
    setVehicleRegNumber("");
    setAssignedZones([]);
    setConsoleTab("dispatch");
  };

  // ==========================================
  // Quick Dispatch Order Handler
  // ==========================================
  const handleOpenAssignModal = (order: PendingDeliveryOrder) => {
    setSelectedOrderForDispatch(order);
    const targetZone = (order.zone || "").trim().toLowerCase();
    const matchedRider = riders.find((r) =>
      r.status === "available" &&
      r.assignedZones.some((z) => {
        const zLower = z.toLowerCase();
        return targetZone.includes(zLower) || zLower.includes(targetZone);
      })
    );
    const firstAvailable = riders.find((r) => r.status === "available");
    setSelectedRiderIdForDispatch(matchedRider?.id || firstAvailable?.id || "");
    setIsAssignModalOpen(true);
  };

  const handleConfirmDispatch = () => {
    if (!selectedOrderForDispatch || !selectedRiderIdForDispatch) {
      showToast("Please select an available rider.");
      return;
    }

    const rider = riders.find((r) => r.id === selectedRiderIdForDispatch);
    if (!rider) return;

    // Update rider state to in_transit
    setRiders((prev) =>
      prev.map((r) => {
        if (r.id === selectedRiderIdForDispatch) {
          return {
            ...r,
            status: "in_transit",
            currentOrderId: selectedOrderForDispatch.orderNumber,
            currentDestination: selectedOrderForDispatch.deliveryAddress,
            codBalance:
              selectedOrderForDispatch.paymentMethod === "cash"
                ? r.codBalance + selectedOrderForDispatch.totalAmount
                : r.codBalance,
          };
        }
        return r;
      })
    );

    // Remove order from pending dispatch queue
    setPendingOrders((prev) => prev.filter((o) => o.id !== selectedOrderForDispatch.id));

    // Direct Supabase DB write
    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        await supabase
          .from("orders")
          .update({
            order_status: "active",
            rider_id: rider.id,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${selectedOrderForDispatch.id},order_number.eq.${selectedOrderForDispatch.orderNumber}`)
          .eq("restaurant_id", restId);
      } catch (e) {
        console.warn("[FleetConsole] Dispatch sync error:", e);
      }
    })();

    setIsAssignModalOpen(false);
    showToast(
      `Dispatched ${selectedOrderForDispatch.orderNumber} to rider ${rider.fullName}! (Out for Delivery)`
    );
  };

  // Mark Delivery Completed & Settle COD
  const handleCompleteDelivery = (riderId: string) => {
    setRiders((prev) =>
      prev.map((r) => {
        if (r.id === riderId) {
          return {
            ...r,
            status: "available",
            currentOrderId: undefined,
            currentDestination: undefined,
          };
        }
        return r;
      })
    );
    showToast("Delivery marked completed. Rider is now Available.");
  };

  // ==========================================
  // KPI Aggregations
  // ==========================================
  const totalFleetCount = riders.length;
  const activeRidersCount = riders.filter((r) => r.status === "available").length;
  const busyDeliveringCount = riders.filter((r) => r.status === "in_transit").length;
  const totalCodPending = riders.reduce((acc, r) => acc + (r.codBalance || 0), 0);

  // Filtered riders
  const filteredRiders = useMemo(() => {
    return riders.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = r.fullName.toLowerCase().includes(q);
        const matchPhone = r.phone.toLowerCase().includes(q);
        const matchVehicle = r.vehicleRegNumber.toLowerCase().includes(q);
        const matchZone = r.assignedZones.some((z) => z.toLowerCase().includes(q));
        return matchName || matchPhone || matchVehicle || matchZone;
      }
      return true;
    });
  }, [riders, filterStatus, searchQuery]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-hi)] flex transition-colors duration-300 antialiased font-sans selection:bg-[var(--gold)]/20 selection:text-[var(--gold)] select-none">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--gold)]/40 text-[var(--gold)] shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
          <Sparkles className="w-4 h-4 text-[var(--gold)]" />
          <span className="text-xs font-bold font-mono">{toastMessage}</span>
        </div>
      )}

      {/* ===================== SIDEBAR ===================== */}
      <AdminSidebar
        activeTab="riders"
        setActiveTab={handleTabChange}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        counts={counts}
        theme={theme}
        toggleTheme={toggleTheme}
        permittedNavItems={
          user
            ? getPermittedNavigation(user.role, user.assignedFeatures || [], user.terminalAccess)
            : undefined
        }
      />

      {/* ===================== MAIN CONTENT AREA ===================== */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {!hasFeature("RIDER") ? (
          <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
            <ModuleLockedView
              moduleName="Fleet Console & Rider Dispatch"
              requiredFeature="RIDER"
              onNavigate={handleTabChange}
            />
          </div>
        ) : (
          <>
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-20 bg-[var(--bg-deep)]/90 backdrop-blur-xl border-b border-[var(--border)] px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/dispatch"
              className="p-2.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 transition-all cursor-pointer flex items-center justify-center group"
              title="Return to Rider Dispatch"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
                <h1 className="font-display font-black text-lg sm:text-2xl text-[var(--text-hi)] tracking-tight">
                  Fleet Console &amp;{" "}
                  <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                    Driver Command
                  </span>
                </h1>
              </div>
              <p className="text-xs text-[var(--text-lo)] font-medium mt-0.5 hidden sm:block">
                Dedicated hub for rider registration, vehicle allocations, zone mapping, and live dispatch control.
              </p>
            </div>
          </div>

          {/* Tab Pill Switcher */}
          <div className="flex items-center gap-1 bg-[var(--surface-hi)] border border-[var(--border)] p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setConsoleTab("dispatch")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                consoleTab === "dispatch"
                  ? "bg-[var(--gold)] text-[#1a1400] shadow-md"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Dispatch</span>
            </button>
            <button
              type="button"
              onClick={() => setConsoleTab("register")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                consoleTab === "register"
                  ? "bg-[var(--gold)] text-[#1a1400] shadow-md"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Rider</span>
            </button>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-6 sm:pt-8 space-y-6 sm:space-y-8 pb-24">
          {/* ========================================================================= */}
          {/* TAB 2: LIVE DISPATCH & ACTIVE FLEET */}
          {/* ========================================================================= */}
          {consoleTab === "dispatch" && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
            {/* 4 Summary KPI Cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 font-mono">
              {/* KPI 1: Total Fleet */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-semibold text-[var(--text-lo)] uppercase tracking-wider">
                    Total Fleet
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                    <Bike className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-hi)]">
                    {totalFleetCount}
                  </div>
                  <div className="text-[10px] text-[var(--text-faint)] mt-1">
                    Onboarded delivery drivers
                  </div>
                </div>
              </div>

              {/* KPI 2: Active Riders */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-semibold text-emerald-400 uppercase tracking-wider">
                    Available
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                    {activeRidersCount}
                  </div>
                  <div className="text-[10px] text-[var(--text-faint)] mt-1">
                    Ready for delivery dispatch
                  </div>
                </div>
              </div>

              {/* KPI 3: Busy Delivering */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-semibold text-amber-400 uppercase tracking-wider">
                    In Transit
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <Navigation className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                    {busyDeliveringCount}
                  </div>
                  <div className="text-[10px] text-[var(--text-faint)] mt-1">
                    En route with customer orders
                  </div>
                </div>
              </div>

              {/* KPI 4: Total COD Pending */}
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[var(--border)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10.5px] font-semibold text-[var(--gold)] uppercase tracking-wider">
                    COD Pending
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-[var(--gold)] whitespace-nowrap">
                    Rs {totalCodPending.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--text-faint)] mt-1">
                    Awaiting cashier settlement
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Action: Pending Delivery Orders Queue */}
            {pendingOrders.length > 0 ? (
              <section className="glass-panel p-5 sm:p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[var(--text-hi)] font-display">
                        Pending Delivery Orders ({pendingOrders.length})
                      </h2>
                      <p className="text-xs text-[var(--text-lo)] font-mono">
                        Kitchen orders ready for rider assignment &amp; dispatch
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    Action Required
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                  {pendingOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-extrabold text-sm text-[var(--gold)]">
                          {ord.orderNumber}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                          {ord.prepTimeAgo}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs font-mono">
                        <div className="font-bold text-[var(--text-hi)] truncate">
                          {ord.customerName}
                        </div>
                        <div className="text-[11px] text-[var(--text-lo)] flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-[var(--gold)] shrink-0" />
                          <span className="truncate">{ord.deliveryAddress}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-faint)]">
                          Zone: <span className="text-[var(--text-hi)]">{ord.zone}</span> •{" "}
                          <span className="text-[var(--gold)] font-bold">
                            Rs {ord.totalAmount.toLocaleString()}
                          </span>{" "}
                          ({ord.paymentMethod.toUpperCase()})
                        </div>
                      </div>

                      {ord.status === "ready" ? (
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(ord)}
                          className="btn-gold animate-sheen w-full py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Bike className="w-3.5 h-3.5" />
                          <span>Assign Available Rider</span>
                        </button>
                      ) : (
                        <div className="space-y-1">
                          <button
                            type="button"
                            disabled
                            className="w-full py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-faint)] cursor-not-allowed opacity-60"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Awaiting Kitchen Ready</span>
                          </button>
                          <p className="text-[9.5px] font-mono text-[var(--text-faint)] text-center italic">
                            Rider allocation unlocked once marked Ready
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-hi)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--gold)] flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-hi)]">
                      No Pending Delivery Orders
                    </div>
                    <div className="text-[11px] text-[var(--text-lo)] font-mono">
                      Proper delivery orders placed by customers or cashiers will appear here for rider assignment.
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-zinc-500/15 text-zinc-400 border border-zinc-500/30 font-bold shrink-0 self-start sm:self-auto">
                  0 Orders in Queue
                </span>
              </div>
            )}

            {/* Active Fleet Directory */}
            <section className="glass-panel p-5 sm:p-6 rounded-2xl border border-[var(--border)] space-y-5">
              {/* Directory Filter & Search Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[var(--text-hi)] font-display">
                    Active Fleet Telemetry &amp; Directory
                  </h2>
                  <span className="text-xs font-mono text-[var(--text-faint)]">
                    ({filteredRiders.length} showing)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Status Filter */}
                  <div className="flex items-center gap-1 bg-[var(--surface-hi)] border border-[var(--border)] p-1 rounded-xl text-xs font-mono">
                    {(["all", "available", "in_transit", "offline"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFilterStatus(st)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          filterStatus === st
                            ? "bg-[var(--gold)] text-[#1a1400]"
                            : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                        }`}
                      >
                        {st === "all"
                          ? "All"
                          : st === "available"
                          ? "Available"
                          : st === "in_transit"
                          ? "In Transit"
                          : "Offline"}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search rider, phone, zone..."
                      className="bg-[var(--surface-hi)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] w-48 sm:w-56"
                    />
                  </div>
                </div>
              </div>

              {/* Riders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {riders.length === 0 ? (
                  <div className="col-span-full py-16 px-6 text-center rounded-2xl border border-dashed border-[var(--border-hi)] bg-[var(--surface-hi)]/30 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center">
                      <Bike className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-[var(--text-hi)] font-display">
                        No Registered Riders Found
                      </h3>
                      <p className="text-xs text-[var(--text-lo)] max-w-sm">
                        No riders have been added to your delivery fleet yet. Click below to onboard your first delivery rider.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConsoleTab("register")}
                      className="btn-gold animate-sheen px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 mt-2 cursor-pointer shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register New Rider</span>
                    </button>
                  </div>
                ) : filteredRiders.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-xs font-mono text-[var(--text-faint)]">
                    No riders matching the current search query or filter.
                  </div>
                ) : (
                  filteredRiders.map((rider) => {
                    const isAvailable = rider.status === "available";
                    const isInTransit = rider.status === "in_transit";
                    return (
                      <div
                        key={rider.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                          isAvailable
                            ? "bg-[var(--surface-hi)]/60 border-[var(--border)] hover:border-emerald-500/40"
                            : isInTransit
                            ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50"
                            : "bg-[var(--surface-hi)]/30 border-[var(--border)] opacity-75"
                        }`}
                      >
                        {/* Rider Card Top */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border-hi)] flex items-center justify-center font-bold text-sm text-[var(--gold)] font-mono">
                                {rider.fullName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <h3 className="font-bold text-sm text-[var(--text-hi)] tracking-tight">
                                  {rider.fullName}
                                </h3>
                                <div className="text-[11px] font-mono text-[var(--text-lo)] flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-[var(--gold)]" />
                                  <span>{rider.phone}</span>
                                </div>
                              </div>
                            </div>

                            {/* Status Pill */}
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                isAvailable
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : isInTransit
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                  : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isAvailable
                                    ? "bg-emerald-400 animate-pulse"
                                    : isInTransit
                                    ? "bg-amber-400 animate-pulse"
                                    : "bg-zinc-400"
                                }`}
                              />
                              {isAvailable
                                ? "Available"
                                : isInTransit
                                ? "In Transit"
                                : "Offline"}
                            </span>
                          </div>

                          {/* Vehicle Specs & CNIC */}
                          <div className="mt-3 pt-3 border-t border-[var(--border)]/60 grid grid-cols-2 gap-2 text-xs font-mono">
                            <div>
                              <span className="text-[10px] text-[var(--text-faint)] block">
                                Vehicle Specs
                              </span>
                              <span className="font-semibold text-[var(--text-hi)] flex items-center gap-1">
                                {rider.vehicleType === "Car" ? (
                                  <Car className="w-3 h-3 text-[var(--gold)]" />
                                ) : rider.vehicleType === "Cargo Van" ? (
                                  <Truck className="w-3 h-3 text-[var(--gold)]" />
                                ) : (
                                  <Bike className="w-3 h-3 text-[var(--gold)]" />
                                )}
                                {rider.vehicleRegNumber}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--text-faint)] block">
                                COD Wallet
                              </span>
                              <span className="font-extrabold text-[var(--gold)]">
                                Rs {rider.codBalance.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Assigned Coverage Zones */}
                          <div className="mt-2.5">
                            <span className="text-[10px] font-mono text-[var(--text-faint)] block mb-1">
                              Covered Delivery Zones
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {rider.assignedZones.map((z, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-lo)]"
                                >
                                  {z}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* In-Transit Active Order Telemetry */}
                          {isInTransit && rider.currentOrderId && (
                            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono space-y-1">
                              <div className="flex items-center justify-between text-amber-400 font-bold">
                                <span>Active Order: {rider.currentOrderId}</span>
                                <span className="text-[10px]">Delivering</span>
                              </div>
                              <div className="text-[11px] text-[var(--text-lo)] truncate">
                                Dest: {rider.currentDestination}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Quick Rider Action Button */}
                        <div className="pt-3 border-t border-[var(--border)]/60">
                          {isInTransit ? (
                            <button
                              type="button"
                              onClick={() => handleCompleteDelivery(rider.id)}
                              className="w-full py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold font-mono transition-colors cursor-pointer"
                            >
                              Mark Delivered (Release Rider)
                            </button>
                          ) : isAvailable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setRiders((prev) =>
                                  prev.map((r) =>
                                    r.id === rider.id ? { ...r, status: "offline" } : r
                                  )
                                );
                                showToast(`${rider.fullName} set to Offline.`);
                              }}
                              className="w-full py-1.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold font-mono transition-colors cursor-pointer"
                            >
                              Set to Offline / On Break
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRiders((prev) =>
                                  prev.map((r) =>
                                    r.id === rider.id ? { ...r, status: "available" } : r
                                  )
                                );
                                showToast(`${rider.fullName} is now Available.`);
                              }}
                              className="w-full py-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold font-mono transition-colors cursor-pointer"
                            >
                              Set to Available
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: REGISTER NEW RIDER FORM */}
        {/* ========================================================================= */}
        {consoleTab === "register" && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[var(--border)] shadow-2xl space-y-6">
              <div className="border-b border-[var(--border)] pb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[11px] font-bold border border-[var(--gold)]/30 mb-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>FLEET ONBOARDING PORTAL</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[var(--text-hi)] font-display tracking-tight">
                  Register New Fleet Rider
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-lo)] font-medium mt-1">
                  Onboard a delivery driver with vehicle registration credentials, CNIC verification, and assigned delivery sectors.
                </p>
              </div>

              <form onSubmit={handleRegisterRider} className="space-y-5">
                {/* 1. Personal & Contact Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--gold)]">
                    1. Rider Personal &amp; Identification Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Muhammad Hamza"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +92 300 1234567"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase">
                        CNIC / National ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={cnic}
                        onChange={(e) => setCnic(e.target.value)}
                        placeholder="e.g. 35201-1234567-1"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. hamza.rider@omnibites.com"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Vehicle & Shift Details */}
                <div className="space-y-4 pt-2 border-t border-[var(--border)]/60">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--gold)]">
                    2. Vehicle Specifications &amp; Work Shift
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase">
                        Vehicle Type *
                      </label>
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value as any)}
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] focus:outline-none transition-colors"
                      >
                        <option value="Motorcycle">Motorcycle</option>
                        <option value="Car">Car</option>
                        <option value="Cargo Van">Cargo Van</option>
                        <option value="Bicycle / E-Bike">Bicycle / E-Bike</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase">
                        Vehicle Reg Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={vehicleRegNumber}
                        onChange={(e) => setVehicleRegNumber(e.target.value)}
                        placeholder="e.g. LE-2024-8842"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase">
                        Duty Shift *
                      </label>
                      <select
                        value={shift}
                        onChange={(e) => setShift(e.target.value)}
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] focus:outline-none transition-colors"
                      >
                        <option value="Morning">Morning (8 AM - 4 PM)</option>
                        <option value="Evening">Evening (4 PM - 12 AM)</option>
                        <option value="Night">Night (12 AM - 8 AM)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Assigned Service Areas / Zones */}
                <div className="space-y-3 pt-2 border-t border-[var(--border)]/60">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--gold)]">
                      3. Assigned Service Areas &amp; Delivery Sectors
                    </h3>
                    <span className="text-[10px] font-mono text-[var(--text-faint)]">
                      Press Enter or Add
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={zoneInput}
                      onChange={(e) => setZoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddZone();
                        }
                      }}
                      placeholder="e.g. DHA Phase 5, Gulberg II, F-7 Markaz..."
                      className="flex-1 bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddZone}
                      className="px-4 py-2.5 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/40 font-bold text-xs font-mono hover:bg-[var(--gold)] hover:text-[#1a1400] transition-colors cursor-pointer"
                    >
                      Add Sector
                    </button>
                  </div>

                  {/* Active Zone Badges */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {assignedZones.map((z, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--surface-hi)] border border-[var(--border-hi)] text-xs font-mono text-[var(--text-hi)]"
                      >
                        <MapPin className="w-3 h-3 text-[var(--gold)]" />
                        <span>{z}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveZone(z)}
                          className="hover:text-red-400 cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConsoleTab("dispatch")}
                    className="px-5 py-2.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] font-bold text-xs font-mono transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-gold animate-sheen px-6 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>Deploy Rider to Fleet</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* QUICK ASSIGN DISPATCH MODAL */}
      {/* ========================================================================= */}
      {hasFeature("RIDER") && isAssignModalOpen && selectedOrderForDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsAssignModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-[var(--bg-deep)] border border-[var(--border)] rounded-3xl p-6 shadow-2xl z-10 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="font-bold text-base text-[var(--text-hi)] font-display">
                  Assign Order to Delivery Driver
                </h3>
                <p className="text-xs font-mono text-[var(--gold)]">
                  {selectedOrderForDispatch.orderNumber} • Rs{" "}
                  {selectedOrderForDispatch.totalAmount.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order Destination Info */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono space-y-1">
              <div className="text-[var(--text-faint)]">Customer Destination:</div>
              <div className="font-bold text-[var(--text-hi)]">
                {selectedOrderForDispatch.customerName} ({selectedOrderForDispatch.customerPhone})
              </div>
              <div className="text-[var(--text-lo)]">
                {selectedOrderForDispatch.deliveryAddress}
              </div>
            </div>

            {/* Select Available Driver */}
            <div className="space-y-2">
              <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase">
                Choose Available Fleet Driver *
              </label>
              <select
                value={selectedRiderIdForDispatch}
                onChange={(e) => setSelectedRiderIdForDispatch(e.target.value)}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-hi)] focus:outline-none font-mono"
              >
                <option value="" disabled>
                  -- Select Available Rider --
                </option>
                {riders
                  .filter((r) => r.status === "available")
                  .map((r) => {
                    const targetZone = (selectedOrderForDispatch.zone || "").trim().toLowerCase();
                    const isZoneMatch =
                      targetZone &&
                      r.assignedZones?.some((z) => {
                        const zLower = z.toLowerCase();
                        return targetZone.includes(zLower) || zLower.includes(targetZone);
                      });
                    return (
                      <option key={r.id} value={r.id}>
                        {isZoneMatch ? "⭐ [ZONE MATCH] " : ""}{r.fullName} ({r.vehicleType} • {r.vehicleRegNumber}){r.assignedZones.length > 0 ? ` • [${r.assignedZones.join(", ")}]` : ""}
                      </option>
                    );
                  })}
              </select>

              {riders.filter((r) => r.status === "available").length === 0 && (
                <p className="text-xs text-red-400 font-mono">
                  No riders are currently Available. Set an offline rider to Available or complete an active delivery.
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] font-bold text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedRiderIdForDispatch}
                onClick={handleConfirmDispatch}
                className="btn-gold animate-sheen px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Confirm &amp; Dispatch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile & Tablet Bottom Navigation Dock (< 1024px) */}
      <AdminBottomDock
        activeTab="riders"
        setActiveTab={handleTabChange}
        onOpenMenuDrawer={() => setIsMenuDrawerOpen(true)}
        kdsCount={counts.kdsTickets}
        userInitials={
          (user?.restaurantName || user?.name || "N")
            .trim()
            .substring(0, 1)
            .toUpperCase()
        }
        restaurantName={user?.restaurantName}
        isHidden={isMenuDrawerOpen}
      />

      {/* Mobile & Tablet Bottom Sheet Grid Drawer (< 1024px) */}
      <AdminMenuDrawer
        isOpen={isMenuDrawerOpen}
        onClose={() => setIsMenuDrawerOpen(false)}
        activeTab="riders"
        setActiveTab={handleTabChange}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={() => {
          logout();
          router.push("/login");
        }}
        permittedNavItems={
          user
            ? getPermittedNavigation(user.role, user.assignedFeatures || [], user.terminalAccess)
            : undefined
        }
        counts={counts}
      />
    </div>
  );
}

export default function FleetConsoleClient({
  initialCollapsed = false,
}: {
  initialCollapsed?: boolean;
}) {
  return (
    <AuthProvider>
      <FleetConsoleContent initialCollapsed={initialCollapsed} />
    </AuthProvider>
  );
}

