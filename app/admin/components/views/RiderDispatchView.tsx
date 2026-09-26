"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Bike,
  Navigation,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Flame,
  Check,
  UserCheck,
  ChevronDown,
  User,
  Lock,
  X,
  AlertCircle,
  ChefHat,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { RiderDelivery, PersonaRole, OrderRecord, KitchenTicket, StaffMember } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import { saveStoredOrders, getStoredOrders } from "../../../../lib/tenantStore";

interface RiderStaffRecord {
  id: string;
  restaurant_id: number;
  branch_id?: string;
  branch_name?: string;
  full_name: string;
  phone?: string;
  email: string;
  role: string;
  terminal_access: string;
  shift?: string;
  status: string;
  assigned_zones?: string[];
  created_at?: string;
}

interface RiderDispatchViewProps {
  deliveries?: RiderDelivery[];
  setDeliveries?: React.Dispatch<React.SetStateAction<RiderDelivery[]>>;
  persona?: PersonaRole;
  selectedBranchId?: string;
  orders?: OrderRecord[];
  setOrders?: React.Dispatch<React.SetStateAction<OrderRecord[]>>;
  kdsTickets?: KitchenTicket[];
  setKdsTickets?: React.Dispatch<React.SetStateAction<KitchenTicket[]>>;
  staffList?: StaffMember[];
  showToast: (msg: string) => void;
}

export default function RiderDispatchView({
  deliveries,
  setDeliveries,
  persona,
  selectedBranchId,
  orders: externalOrders,
  setOrders,
  kdsTickets = [],
  staffList = [],
  showToast,
}: RiderDispatchViewProps) {
  const { user, isBranchAdmin } = useAuth();
  const currentOrgId = String(user?.organizationId || "default");

  // Roster Filter State
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [riders, setRiders] = useState<RiderStaffRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Delivery Orders Queue Filter & Search State
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "ready" | "preparing" | "out_for_delivery">("ready");
  const [deliverySearchQuery, setDeliverySearchQuery] = useState<string>("");

  // Assign Courier Modal State
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<any | null>(null);
  const [selectedRiderIdForDispatch, setSelectedRiderIdForDispatch] = useState<string>("");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  // Local sync of orders if not provided by parent
  const [internalOrders, setInternalOrders] = useState<OrderRecord[]>(() => {
    if (externalOrders && externalOrders.length > 0) return externalOrders;
    if (typeof window !== "undefined") {
      return getStoredOrders(currentOrgId);
    }
    return [];
  });

  useEffect(() => {
    if (externalOrders && externalOrders.length > 0) {
      setInternalOrders(externalOrders);
    }
  }, [externalOrders]);

  // Fetch real delivery orders directly from Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchDeliveryOrders = async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const resolvedRestId = Number(user?.organizationId || restId || 27);

        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("restaurant_id", resolvedRestId)
          .eq("order_channel", "delivery")
          .neq("order_status", "cancelled")
          .order("created_at", { ascending: false });

        if (!error && data && isMounted && (!externalOrders || externalOrders.length === 0)) {
          const mapped: OrderRecord[] = data.map((o: any) => ({
            id: o.order_number || String(o.id),
            orderChannel: "delivery",
            customerName: o.customer_name || "Delivery Customer",
            customerPhone: o.customer_phone || "",
            delivery_zone: o.delivery_zone || "",
            rider_id: o.rider_id || null,
            assignedRiderId: o.rider_id || undefined,
            assignedRiderName: o.assigned_rider_name || undefined,
            items: o.items || [],
            subtotal: Number(o.subtotal || 0),
            taxAmount: Number(o.tax_amount || 0),
            discountPercent: 0,
            discountAmount: Number(o.discount_amount || 0),
            total: Number(o.total_amount || 0),
            paymentMethod: o.payment_method || "cash",
            cashierName: o.cashier_name || "Cashier",
            timestamp: o.created_at || new Date().toISOString(),
            status: o.order_status || "queued",
          }));
          setInternalOrders(mapped);
        }
      } catch (err) {
        console.warn("[RiderDispatchView] Error fetching orders:", err);
      }
    };

    fetchDeliveryOrders();
    return () => {
      isMounted = false;
    };
  }, [user, externalOrders]);

  // Fetch active riders directly from Supabase staff_members
  useEffect(() => {
    let isMounted = true;
    const fetchRiders = async () => {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        const orgId = Number(user?.organizationId || restId || 27);

        const { data, error } = await supabase
          .from("staff_members")
          .select("*")
          .eq("restaurant_id", orgId)
          .eq("role", "rider")
          .order("created_at", { ascending: false });

        if (!error && data && isMounted) {
          setRiders(data as RiderStaffRecord[]);
        }
      } catch (err) {
        console.warn("[RidersView] Error fetching riders from Supabase:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchRiders();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Derived list of delivery orders linked to KDS kitchen progress
  const activeDeliveryOrders = useMemo(() => {
    const list = externalOrders && externalOrders.length > 0 ? externalOrders : internalOrders;
    return list
      .filter((o) => o.orderChannel === "delivery" && o.status !== "cancelled")
      .map((o) => {
        // Link to kitchen ticket status
        const oDigits = o.id.replace(/[^0-9]/g, "");
        const linkedTicket = kdsTickets.find((t) => {
          if (o.kotId && t.id === o.kotId) return true;
          if (t.id === o.id) return true;
          const tDigits = t.id.replace(/[^0-9]/g, "");
          if (oDigits && tDigits && oDigits === tDigits) return true;
          if (t.tableOrChannel?.includes(o.id)) return true;
          return false;
        });

        let effectiveStatus: "queued" | "preparing" | "ready" | "out_for_delivery" | "completed" = "queued";
        if (o.status === "completed") {
          effectiveStatus = "completed";
        } else if (o.status === "out_for_delivery") {
          effectiveStatus = "out_for_delivery";
        } else if (o.status === "ready" || linkedTicket?.status === "ready") {
          effectiveStatus = "ready";
        } else if (o.status === "preparing" || linkedTicket?.status === "preparing") {
          effectiveStatus = "preparing";
        } else {
          effectiveStatus = "queued";
        }

        return {
          ...o,
          effectiveStatus,
          linkedTicket,
        };
      });
  }, [externalOrders, internalOrders, kdsTickets]);

  // Delivery Counts
  const readyOrdersCount = activeDeliveryOrders.filter((o) => o.effectiveStatus === "ready").length;
  const preparingOrdersCount = activeDeliveryOrders.filter(
    (o) => o.effectiveStatus === "queued" || o.effectiveStatus === "preparing"
  ).length;
  const outForDeliveryCount = activeDeliveryOrders.filter((o) => o.effectiveStatus === "out_for_delivery").length;
  const totalDeliveryOrdersCount = activeDeliveryOrders.length;

  // Filtered Delivery Orders for Display
  const filteredDeliveryOrders = useMemo(() => {
    return activeDeliveryOrders.filter((o) => {
      if (deliveryFilter === "ready" && o.effectiveStatus !== "ready") return false;
      if (deliveryFilter === "preparing" && o.effectiveStatus !== "queued" && o.effectiveStatus !== "preparing")
        return false;
      if (deliveryFilter === "out_for_delivery" && o.effectiveStatus !== "out_for_delivery") return false;

      if (deliverySearchQuery.trim()) {
        const q = deliverySearchQuery.toLowerCase();
        const matchId = o.id.toLowerCase().includes(q);
        const matchCust = (o.customerName || "").toLowerCase().includes(q);
        const matchPhone = (o.customerPhone || "").toLowerCase().includes(q);
        const matchZone = (o.delivery_zone || "").toLowerCase().includes(q);
        return matchId || matchCust || matchPhone || matchZone;
      }
      return true;
    });
  }, [activeDeliveryOrders, deliveryFilter, deliverySearchQuery]);

  // Zone Matching Helper for an Order
  const getZoneMatchedRiders = (destinationArea?: string) => {
    if (!destinationArea || !destinationArea.trim()) return [];
    const query = destinationArea.trim().toLowerCase();
    return riders.filter((r) =>
      r.assigned_zones?.some((z) => {
        const zoneLower = z.toLowerCase();
        return zoneLower.includes(query) || query.includes(zoneLower);
      })
    );
  };

  // Open Dispatch Modal
  const handleOpenAssignModal = (order: any) => {
    setSelectedOrderForDispatch(order);
    const matched = getZoneMatchedRiders(order.delivery_zone);
    // Prioritize matched rider who is active, else first active rider, else first available
    const activeMatched = matched.find((r) => r.status === "active");
    const activeRider = riders.find((r) => r.status === "active");
    setSelectedRiderIdForDispatch(activeMatched?.id || matched[0]?.id || activeRider?.id || riders[0]?.id || "");
    setIsAssignModalOpen(true);
  };

  // Confirm Dispatch of Rider
  const handleConfirmDispatch = async () => {
    if (!selectedOrderForDispatch || !selectedRiderIdForDispatch) {
      showToast("Please select a courier to dispatch.");
      return;
    }

    const assignedRider = riders.find((r) => r.id === selectedRiderIdForDispatch);
    if (!assignedRider) {
      showToast("Selected rider could not be found.");
      return;
    }

    setIsDispatching(true);

    const updatedOrder: OrderRecord = {
      ...selectedOrderForDispatch,
      status: "out_for_delivery",
      rider_id: assignedRider.id,
      assignedRiderId: assignedRider.id,
      assignedRiderName: assignedRider.full_name,
    };

    // 1. Update State & Local Store
    if (setOrders) {
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrderForDispatch.id ? updatedOrder : o))
      );
    }
    setInternalOrders((prev) => {
      const updated = prev.map((o) => (o.id === selectedOrderForDispatch.id ? updatedOrder : o));
      saveStoredOrders(currentOrgId, updated);
      return updated;
    });

    // 2. Direct Supabase write
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);

      await supabase
        .from("orders")
        .update({
          order_status: "active",
          rider_id: assignedRider.id,
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${selectedOrderForDispatch.id},order_number.eq.${selectedOrderForDispatch.id}`)
        .eq("restaurant_id", restId);

      showToast(`Order ${selectedOrderForDispatch.id} dispatched to ${assignedRider.full_name}! (Out for Delivery)`);
    } catch (err) {
      console.warn("[RiderDispatchView] Supabase order dispatch error:", err);
      showToast(`Order ${selectedOrderForDispatch.id} dispatched locally.`);
    } finally {
      setIsDispatching(false);
      setIsAssignModalOpen(false);
      setSelectedOrderForDispatch(null);
    }
  };

  // Mark Delivery Order Completed
  const handleMarkDelivered = async (orderId: string) => {
    if (setOrders) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "completed" } : o))
      );
    }
    setInternalOrders((prev) => {
      const updated = prev.map((o) => (o.id === orderId ? { ...o, status: "completed" } : o));
      saveStoredOrders(currentOrgId, updated);
      return updated;
    });

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      await supabase
        .from("orders")
        .update({
          order_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${orderId},order_number.eq.${orderId}`)
        .eq("restaurant_id", restId);
    } catch (e) {
      console.warn("[RiderDispatchView] Mark delivered error:", e);
    }

    showToast(`Order ${orderId} marked as DELIVERED.`);
  };

  const filteredRiders = riders.filter((r) => {
    if (isBranchAdmin && user?.branchId) {
      if (r.branch_id && r.branch_id !== user.branchId) {
        return false;
      }
    }
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (
      searchQuery &&
      !r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(r.phone || "").toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(r.shift || "").toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const activeRidersCount = riders.filter((r) => r.status === "active").length;
  const onBreakRidersCount = riders.filter((r) => r.status === "on_break").length;
  const offlineRidersCount = riders.filter(
    (r) => r.status === "offline" || r.status === "inactive" || r.status === "suspended"
  ).length;
  const totalRidersCount = riders.length;

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            • LOGISTICS &amp; FLEET TELEMETRY
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Rider Dispatch &amp;{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Delivery Fleet
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] font-medium mt-1">
            Real-time delivery routing, rider telemetry, customer ETA tracking, and digital COD settlement.
          </p>
        </div>

        <Link
          href="/admin/fleet-console"
          className="btn-gold animate-sheen px-4 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-2 shrink-0 self-start sm:self-auto rounded-xl shadow-md no-underline text-neutral-950 hover:brightness-110 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Fleet Console</span>
        </Link>
      </div>

      {/* Fleet KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Active Fleet */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bike className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[11px] font-bold border border-[var(--gold)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" /> Active
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--gold)] tracking-tight">
              {activeRidersCount} Riders
            </div>
            <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
              Active On Fleet Duty
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Live status</span>
            <span className="text-[#25d366]">Available</span>
          </div>
        </div>

        {/* Card 2: On Break */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/30 text-[var(--orange)] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Flame className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--orange-dim)] text-[var(--orange)] font-mono text-[11px] font-bold border border-[var(--orange)]/30">
              Standby
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
              {onBreakRidersCount} Riders
            </div>
            <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
              On Break / Rest Period
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Temporary break</span>
            <span className="text-[var(--orange)]">Standby</span>
          </div>
        </div>

        {/* Card 3: Offline */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-faint)] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--surface-hi)] text-[var(--text-faint)] font-mono text-[11px] font-bold border border-[var(--border)]">
              Offline
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
              {offlineRidersCount} Riders
            </div>
            <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
              Shift Ended / Offline
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Roster status</span>
            <span className="text-[var(--text-faint)]">Inactive</span>
          </div>
        </div>

        {/* Card 4: Total Registered Fleet */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-mono text-[11px] font-bold border border-blue-500/30">
              Registered
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
              {totalRidersCount}
            </div>
            <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
              Total Registered Couriers
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>Roster pool</span>
            <span className="text-blue-400">Verified</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION: LIVE DELIVERY DISPATCH QUEUE (Order Routing & Rider Assignment) */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                <Package className="w-4 h-4" />
              </div>
              <h2 className="font-display font-black text-xl text-[var(--text-hi)]">
                Active Delivery Dispatch Queue
              </h2>
              {readyOrdersCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366] font-mono text-[10.5px] font-bold animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25d366]" />
                  {readyOrdersCount} Ready to Dispatch
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-lo)] font-mono mt-1">
              Food prepared by kitchen is dispatched here. Orders in kitchen preparation are awaiting handoff.
            </p>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-hi)] p-1 rounded-xl border border-[var(--border)] self-start sm:self-auto overflow-x-auto">
            {[
              { id: "ready", label: "Ready for Dispatch", count: readyOrdersCount, color: "text-[#25d366]" },
              { id: "preparing", label: "Kitchen Cooking", count: preparingOrdersCount, color: "text-amber-400" },
              { id: "out_for_delivery", label: "Out for Delivery", count: outForDeliveryCount, color: "text-blue-400" },
              { id: "all", label: "All Active", count: totalDeliveryOrdersCount, color: "text-[var(--text-hi)]" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDeliveryFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  deliveryFilter === tab.id
                    ? "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/40 shadow-sm"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 ${tab.color}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Search Input Bar for Delivery Orders */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search delivery orders by Order #, customer name, phone, or destination area..."
            value={deliverySearchQuery}
            onChange={(e) => setDeliverySearchQuery(e.target.value)}
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-2.5 h-10 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none transition-all shadow-inner font-sans"
          />
        </div>

        {/* Delivery Orders Grid */}
        {filteredDeliveryOrders.length === 0 ? (
          <div className="glass-panel p-10 rounded-2xl border border-[var(--border)] text-center space-y-2">
            <Package className="w-10 h-10 text-[var(--text-faint)] mx-auto opacity-50" />
            <p className="text-xs font-mono text-[var(--text-lo)]">
              No delivery orders matching current filter ({deliveryFilter}).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredDeliveryOrders.map((ord) => {
              const isReady = ord.effectiveStatus === "ready";
              const isOut = ord.effectiveStatus === "out_for_delivery";
              const matchedZoneCouriers = getZoneMatchedRiders(ord.delivery_zone);

              return (
                <div
                  key={ord.id}
                  className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-4 ${
                    isReady
                      ? "bg-emerald-500/5 border-emerald-500/30 shadow-lg shadow-emerald-950/20"
                      : isOut
                      ? "bg-blue-500/5 border-blue-500/25"
                      : "bg-[var(--surface-hi)]/60 border-[var(--border)] opacity-90"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Order ID & Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-sm text-[var(--gold)]">
                        {ord.id}
                      </span>

                      {isReady ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#25d366]/15 border border-[#25d366]/40 text-[#25d366] font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ready for Handoff
                        </span>
                      ) : isOut ? (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-300 font-mono text-[10px] font-bold flex items-center gap-1.5">
                          <Bike className="w-3.5 h-3.5" />
                          Out for Delivery
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 font-mono text-[10px] font-bold flex items-center gap-1.5">
                          <ChefHat className="w-3.5 h-3.5" />
                          Cooking in Kitchen
                        </span>
                      )}
                    </div>

                    {/* Customer & Destination Details */}
                    <div className="p-3 rounded-xl bg-[var(--bg-deep)]/80 border border-[var(--border)]/60 text-xs font-mono space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-faint)] flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[var(--gold)]" />
                          Customer:
                        </span>
                        <span className="font-bold text-[var(--text-hi)] truncate max-w-[160px]">
                          {ord.customerName || "Delivery Customer"}
                        </span>
                      </div>

                      {ord.customerPhone && (
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-faint)] flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            Phone:
                          </span>
                          <span className="font-bold text-[var(--text-hi)]">
                            {ord.customerPhone}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-faint)] flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-red-400" />
                          Destination:
                        </span>
                        <span className="font-bold text-blue-300 truncate max-w-[160px]">
                          {ord.delivery_zone || "General Delivery Zone"}
                        </span>
                      </div>

                      <div className="pt-1.5 border-t border-[var(--border)]/40 flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-faint)]">
                          Total: <strong className="text-[var(--gold)]">Rs {ord.total.toLocaleString()}</strong>
                        </span>
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-hi)] text-[var(--text-lo)] border border-[var(--border)]">
                          {ord.paymentMethod}
                        </span>
                      </div>
                    </div>

                    {/* Zone Match Courier Insight */}
                    {ord.delivery_zone && matchedZoneCouriers.length > 0 && (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[10.5px] font-mono text-emerald-300">
                        <span className="flex items-center gap-1 truncate">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">Zone Match: <strong>{matchedZoneCouriers[0].full_name}</strong></span>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[9.5px] font-bold">
                          {matchedZoneCouriers.length} in area
                        </span>
                      </div>
                    )}

                    {/* If assigned to courier */}
                    {ord.assignedRiderName && (
                      <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-[11px] font-mono text-blue-300">
                        <span className="flex items-center gap-1.5">
                          <Bike className="w-3.5 h-3.5 text-blue-400" />
                          Courier Assigned:
                        </span>
                        <span className="font-bold text-white">{ord.assignedRiderName}</span>
                      </div>
                    )}
                  </div>

                  {/* Dispatch Action Button */}
                  <div className="pt-2">
                    {isReady ? (
                      <button
                        type="button"
                        onClick={() => handleOpenAssignModal(ord)}
                        className="btn-gold animate-sheen w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Assign Courier &amp; Dispatch</span>
                      </button>
                    ) : isOut ? (
                      <button
                        type="button"
                        onClick={() => handleMarkDelivered(ord.id)}
                        className="w-full py-2 px-3 rounded-xl bg-[#25d366]/20 hover:bg-[#25d366]/30 border border-[#25d366]/40 text-[#25d366] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Delivered</span>
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <button
                          type="button"
                          disabled
                          className="w-full py-2 px-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-[var(--text-faint)] font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Awaiting Kitchen Ready</span>
                        </button>
                        <p className="text-[9.5px] font-mono text-[var(--text-faint)] text-center italic">
                          Courier allocation unlocked once marked Ready by kitchen
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* Courier Roster Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-black text-lg text-[var(--text-hi)] flex items-center gap-2">
            <Bike className="w-4 h-4 text-[var(--gold)]" />
            Courier Fleet Roster ({totalRidersCount})
          </h3>
          <p className="text-xs text-[var(--text-lo)] font-mono">
            Active couriers on duty, shifts, and assigned delivery territories.
          </p>
        </div>
      </div>

      {/* Unified Courier Filter Dropdown & Live Search in a Single Horizontal Row */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
        {/* Courier Status Filter Dropdown (styled identically to search bar & other pages) */}
        <div className="relative w-[44%] sm:w-64 shrink-0">
          <ResponsiveSelect
            value={filterStatus}
            onChange={(val) => setFilterStatus(val)}
            buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
            menuClassName="w-56 sm:w-64"
            options={[
              { id: "all", label: "All Couriers", count: totalRidersCount },
              { id: "active", label: "Active", count: activeRidersCount },
              { id: "on_break", label: "On Break", count: onBreakRidersCount },
              { id: "offline", label: "Offline", count: offlineRidersCount },
            ]}
          />
        </div>

        {/* Live Search Input Bar */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search riders by name, phone, or shift..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-2.5 h-10 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-faint)] focus:outline-none transition-all shadow-inner font-sans"
          />
        </div>
      </div>

      {/* Delivery Couriers Board */}
      {isLoading ? (
        <div className="glass-panel p-12 rounded-2xl border border-[var(--border)] text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--gold)] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-mono text-[var(--text-faint)]">Loading fleet couriers...</p>
        </div>
      ) : filteredRiders.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-[var(--border)] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-faint)]">
            <Bike className="w-6 h-6" />
          </div>
          <p className="text-sm font-mono text-[var(--text-lo)]">
            No riders registered. Add riders from Staff Management.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredRiders.map((item) => {
            const isActive = item.status === "active";
            return (
              <div
                key={item.id}
                className="glass-panel p-5 sm:p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-5 relative group hover:border-[var(--gold)]/40 overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Header: Name & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center font-bold">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-display font-black text-base text-[var(--text-hi)] block">
                          {item.full_name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--surface-hi)] text-[var(--text-faint)] border border-[var(--border)]">
                          {item.branch_name || "Main Outlet"}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isActive
                          ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                          : item.status === "on_break"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {item.status || "active"}
                    </span>
                  </div>

                  {/* Rider Details: Phone, Shift, Status */}
                  <div className="p-3.5 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)]/60 space-y-2.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-faint)] flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[var(--gold)]" />
                        Phone:
                      </span>
                      <span className="font-bold text-[var(--text-hi)]">
                        {item.phone || "No phone registered"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-faint)] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Shift:
                      </span>
                      <span className="font-bold text-[var(--gold)]">
                        {item.shift || "Evening"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-faint)] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#25d366]" />
                        Status:
                      </span>
                      <span className="font-bold uppercase tracking-wider text-[11px] text-[var(--text-hi)]">
                        {item.status || "Active"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)]/40 space-y-1.5 text-blue-400">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          Assigned Zones:
                        </span>
                        <span className="text-[10px] font-mono opacity-80">
                          {item.assigned_zones?.length || 0} {item.assigned_zones?.length === 1 ? "area" : "areas"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.assigned_zones && item.assigned_zones.length > 0 ? (
                          item.assigned_zones.map((zone, zIdx) => (
                            <span
                              key={zIdx}
                              className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/25 text-blue-300 font-mono text-[10px] font-bold"
                            >
                              {zone}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-mono text-blue-400/60 italic">
                            No locations assigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer status pill */}
                <div className="pt-2.5 border-t border-[var(--border)]/40 flex items-center justify-between text-xs font-mono">
                  <span className="text-[10px] text-[var(--text-faint)]">
                    ROLE: {item.role ? item.role.toUpperCase() : "RIDER"}
                  </span>
                  <span className="text-[11px] text-[#25d366] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Courier
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK ASSIGN DISPATCH MODAL */}
      {/* ========================================================================= */}
      {isAssignModalOpen && selectedOrderForDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsAssignModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-[var(--bg-deep)] border border-[var(--border)] rounded-3xl p-6 shadow-2xl z-10 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="font-bold text-base text-[var(--text-hi)] font-display flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[var(--gold)]" />
                  Dispatch Order to Delivery Courier
                </h3>
                <p className="text-xs font-mono text-[var(--gold)] mt-0.5">
                  Order {selectedOrderForDispatch.id} • Rs {Number(selectedOrderForDispatch.total || 0).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Destination Info Box */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-faint)]">Customer Destination:</span>
                <span className="text-[10.5px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold border border-blue-500/30">
                  Target Zone
                </span>
              </div>
              <div className="font-bold text-[var(--text-hi)]">
                {selectedOrderForDispatch.customerName} {selectedOrderForDispatch.customerPhone ? `(${selectedOrderForDispatch.customerPhone})` : ""}
              </div>
              <div className="text-[var(--gold)] font-bold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                <span>{selectedOrderForDispatch.delivery_zone || "General Delivery Zone"}</span>
              </div>
            </div>

            {/* Couriers Selection with Zone Highlighting */}
            <div className="space-y-2">
              <label className="text-xs font-bold font-mono text-[var(--text-hi)] uppercase flex items-center justify-between">
                <span>Choose Fleet Courier *</span>
                <span className="text-[10px] text-emerald-400 font-normal">
                  ⭐ Highlighted = Zone Matched
                </span>
              </label>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {riders.map((r) => {
                  const targetArea = (selectedOrderForDispatch.delivery_zone || "").trim().toLowerCase();
                  const isZoneMatch = targetArea && r.assigned_zones?.some((z) => {
                    const zLower = z.toLowerCase();
                    return targetArea.includes(zLower) || zLower.includes(targetArea);
                  });
                  const isSelected = selectedRiderIdForDispatch === r.id;

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRiderIdForDispatch(r.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-[var(--gold-dim)] border-[var(--gold)] shadow-md"
                          : isZoneMatch
                          ? "bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500"
                          : "bg-[var(--surface-hi)] border-[var(--border)] hover:border-[var(--text-faint)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isZoneMatch ? "bg-emerald-500/20 text-emerald-300" : "bg-[var(--bg-deep)] text-[var(--text-lo)]"
                          }`}
                        >
                          <Bike className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold font-mono text-[var(--text-hi)] flex items-center gap-1.5">
                            <span>{r.full_name}</span>
                            {isZoneMatch && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/30">
                                ⭐ ZONE MATCH
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-lo)]">
                            {r.phone || "No phone"} • Shift: {r.shift || "Active"}
                            {r.assigned_zones && r.assigned_zones.length > 0 && (
                              <span className="text-[var(--text-faint)]"> • [{r.assigned_zones.join(", ")}]</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <input
                        type="radio"
                        name="dispatch_rider_choice"
                        checked={isSelected}
                        onChange={() => setSelectedRiderIdForDispatch(r.id)}
                        className="accent-[var(--gold)] cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] text-[var(--text-lo)] font-bold text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedRiderIdForDispatch || isDispatching}
                onClick={handleConfirmDispatch}
                className="btn-gold animate-sheen px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{isDispatching ? "Dispatching..." : "Confirm & Dispatch"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
