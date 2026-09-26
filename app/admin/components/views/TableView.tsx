"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Users,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  Check,
  ChevronDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { RestaurantTable } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { useAdminCache, mapRowToRestaurantTable } from "../../context/AdminCacheContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface TableViewProps {
  showToast: (msg: string) => void;
  routeAction?: { action: "new" | "edit"; id?: string } | null;
}

const PRESET_SECTIONS = [
  "Main Dining",
  "Ground Floor",
  "Family Hall",
  "Outdoor Terrace",
  "VIP Lounge",
  "Rooftop",
] as const;

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    pillClass: string;
    dotClass: string;
    borderHover: string;
    bgGlow: string;
  }
> = {
  AVAILABLE: {
    label: "Available",
    pillClass: "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30",
    dotClass: "bg-[#25d366]",
    borderHover: "hover:border-[#25d366]/40",
    bgGlow: "bg-[#25d366]/5",
  },
  OCCUPIED: {
    label: "Occupied",
    pillClass: "bg-red-500/15 text-red-400 border border-red-500/30",
    dotClass: "bg-red-500 animate-pulse",
    borderHover: "hover:border-red-500/40",
    bgGlow: "bg-red-500/5",
  },
  BILLED: {
    label: "Billed",
    pillClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dotClass: "bg-amber-500",
    borderHover: "hover:border-amber-500/40",
    bgGlow: "bg-amber-500/5",
  },
  RESERVED: {
    label: "Reserved",
    pillClass: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    dotClass: "bg-blue-500",
    borderHover: "hover:border-blue-500/40",
    bgGlow: "bg-blue-500/5",
  },
};

export default function TableView({ showToast, routeAction }: TableViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { restaurantTables: cachedTables, updateTableRow, insertTableRow, deleteTableRow } = useAdminCache();

  const [tables, setTables] = useState<RestaurantTable[]>(() => (cachedTables && cachedTables.length > 0 ? cachedTables : []));
  const [isLoading, setIsLoading] = useState<boolean>(() => !(cachedTables && cachedTables.length > 0));
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync with SWR cache if updated elsewhere
  useEffect(() => {
    if (cachedTables && cachedTables.length > 0) {
      setTables(cachedTables);
      setIsLoading(false);
    }
  }, [cachedTables]);

  // Filter & Search State
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTable | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formTableNumber, setFormTableNumber] = useState("");
  const [formSection, setFormSection] = useState<string>("Main Dining");
  const [isCustomSection, setIsCustomSection] = useState(false);
  const [customSectionName, setCustomSectionName] = useState("");
  const [formCapacity, setFormCapacity] = useState<string>("4");
  const [formStatus, setFormStatus] = useState<string>("AVAILABLE");

  // Fetch Tables strictly from Supabase
  const fetchTables = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);

      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restId)
        .order("table_number", { ascending: true });

      if (error) {
        console.warn("[TableView] Supabase load error:", error.message);
        if (isManualRefresh) {
          showToast("Failed to fetch tables from server.");
        }
      } else if (data) {
        // Map data safely accommodating column variations
        const mapped: RestaurantTable[] = data.map((row: any) => ({
          id: row.id,
          restaurant_id: row.restaurant_id,
          branch_id: row.branch_id,
          table_number: row.table_number || row.name || `Table ${row.id}`,
          section_name: row.section_name || row.floor_name || "Main Dining",
          seating_capacity: Number(row.seating_capacity ?? row.capacity ?? 4),
          status: (row.status ? String(row.status).toUpperCase() : "AVAILABLE") as any,
          qr_code_url: row.qr_code_url || undefined,
          is_active: row.is_active !== undefined ? row.is_active : true,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        setTables(mapped);
        try {
          localStorage.setItem(`tables_list_${restId}`, JSON.stringify(mapped));
        } catch {}
        if (isManualRefresh) {
          showToast("Floor tables synchronized.");
        }
      }
    } catch (err) {
      console.error("[TableView] Unexpected error fetching tables:", err);
    } finally {
      setIsLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTables();

    let channel: any = null;
    let isSubscribed = true;

    (async () => {
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        if (!isSubscribed) return;

        channel = supabase
          .channel(`realtime:restaurant_tables_${restId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "restaurant_tables",
              filter: `restaurant_id=eq.${restId}`,
            },
            (payload: any) => {
              if (payload.eventType === "UPDATE") {
                const updatedRow = payload.new;
                const mapped = mapRowToRestaurantTable(updatedRow);
                setTables((prev) => prev.map((t) => (String(t.id) === String(updatedRow.id) ? mapped : t)));
                updateTableRow(updatedRow);
              } else if (payload.eventType === "INSERT") {
                const newRow = payload.new;
                const mapped = mapRowToRestaurantTable(newRow);
                setTables((prev) => [...prev.filter((t) => String(t.id) !== String(newRow.id)), mapped]);
                insertTableRow(newRow);
              } else if (payload.eventType === "DELETE") {
                const oldId = payload.old?.id;
                setTables((prev) => prev.filter((t) => String(t.id) !== String(oldId)));
                deleteTableRow(oldId);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("[TableView] Supabase Realtime subscription error:", err);
      }
    })();

    return () => {
      isSubscribed = false;
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [user?.id, user?.organizationId]);

  // Distinct sections list
  const availableSections = useMemo(() => {
    const fromTables = tables.map((t) => t.section_name || "Main Dining");
    const combined = Array.from(new Set([...PRESET_SECTIONS, ...fromTables]));
    return combined.filter(Boolean);
  }, [tables]);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tables.filter((table) => {
      const matchesSearch =
        table.table_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (table.section_name || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSection =
        selectedSection === "all" ||
        (table.section_name || "Main Dining").toLowerCase() === selectedSection.toLowerCase();

      return matchesSearch && matchesSection;
    });
  }, [tables, searchQuery, selectedSection]);

  // Quick Stats
  const stats = useMemo(() => {
    const totalTables = tables.length;
    const totalCapacity = tables.reduce((acc, t) => acc + (Number(t.seating_capacity) || 0), 0);
    const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
    const availableTables = tables.filter((t) => t.status === "AVAILABLE").length;
    const reservedTables = tables.filter((t) => t.status === "RESERVED").length;
    const billedTables = tables.filter((t) => t.status === "BILLED").length;

    const occupancyRate = totalTables > 0 ? ((occupiedTables / totalTables) * 100).toFixed(1) : "0.0";

    return {
      totalTables,
      totalCapacity,
      occupiedTables,
      availableTables,
      reservedTables,
      billedTables,
      occupancyRate,
    };
  }, [tables]);

  // Open Modal for Create or Edit
  const openModal = (table?: RestaurantTable, syncRoute = true) => {
    if (table) {
      setEditingTable(table);
      setFormTableNumber(table.table_number);
      const isPreset = PRESET_SECTIONS.includes(table.section_name as any);
      if (isPreset) {
        setFormSection(table.section_name || "Main Dining");
        setIsCustomSection(false);
        setCustomSectionName("");
      } else {
        setFormSection("CUSTOM");
        setIsCustomSection(true);
        setCustomSectionName(table.section_name || "");
      }
      setFormCapacity(String(table.seating_capacity || 4));
      setFormStatus((table.status as any) || "AVAILABLE");
      if (syncRoute && typeof window !== "undefined") {
        window.history.pushState(null, "", `/admin/tables/${table.id}`);
      }
    } else {
      setEditingTable(null);
      // Auto-suggest next table number
      const nextNum = tables.length + 1;
      setFormTableNumber(`Table ${nextNum < 10 ? "0" + nextNum : nextNum}`);
      setFormSection("Main Dining");
      setIsCustomSection(false);
      setCustomSectionName("");
      setFormCapacity("4");
      setFormStatus("AVAILABLE");
      if (syncRoute && typeof window !== "undefined") {
        window.history.pushState(null, "", "/admin/tables/new");
      }
    }
    setIsModalOpen(true);
  };

  const closeModal = (syncRoute = true) => {
    setIsModalOpen(false);
    setEditingTable(null);
    if (syncRoute && typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/tables");
    }
  };

  // Sync nested route action (/admin/tables/new or /admin/tables/[id])
  useEffect(() => {
    if (!routeAction) {
      setIsModalOpen(false);
      setEditingTable(null);
      return;
    }

    if (routeAction.action === "new") {
      openModal(undefined, false);
    } else if (routeAction.action === "edit" && routeAction.id) {
      const match = tables.find((t) => String(t.id) === String(routeAction.id));
      if (match) {
        openModal(match, false);
      } else {
        (async () => {
          try {
            const supabase = createClient();
            const { data } = await supabase
              .from("restaurant_tables")
              .select("*")
              .eq("id", routeAction.id)
              .maybeSingle();

            if (data) {
              const mapped: RestaurantTable = {
                id: data.id,
                restaurant_id: data.restaurant_id,
                branch_id: data.branch_id,
                table_number: data.table_number || data.name || `Table ${data.id}`,
                section_name: data.section_name || data.floor_name || "Main Dining",
                seating_capacity: Number(data.seating_capacity ?? data.capacity ?? 4),
                status: (data.status ? String(data.status).toUpperCase() : "AVAILABLE") as any,
                qr_code_url: data.qr_code_url || undefined,
                is_active: data.is_active !== undefined ? data.is_active : true,
                created_at: data.created_at,
                updated_at: data.updated_at,
              };
              openModal(mapped, false);
            }
          } catch (err) {
            console.error("[TableView] Error fetching table for routeAction:", err);
          }
        })();
      }
    }
  }, [routeAction, tables]);

  // Quick Status Transition Handler
  const handleQuickStatusChange = async (
    table: RestaurantTable,
    newStatus: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLED"
  ) => {
    const updatedTables = tables.map((t) =>
      t.id === table.id ? { ...t, status: newStatus } : t
    );
    setTables(updatedTables);

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      localStorage.setItem(`tables_list_${restId}`, JSON.stringify(updatedTables));

      const updatePayload: Record<string, any> = {
        status: newStatus.toLowerCase(),
        updated_at: new Date().toISOString(),
      };
      if (newStatus === "AVAILABLE") {
        updatePayload.current_order_id = null;
        updatePayload.active_order_id = null;
      }

      const { error } = await supabase
        .from("restaurant_tables")
        .update(updatePayload)
        .eq("id", table.id)
        .eq("restaurant_id", restId);

      if (error) {
        console.warn("[TableView] Supabase status update warning:", error.message);
        showToast(`Failed to update status: ${error.message}`);
      } else {
        showToast(`${table.table_number} marked as ${newStatus.toLowerCase()}.`);
      }
    } catch (err) {
      console.error("[TableView] Error updating status:", err);
    }
  };

  // Save Table (Create or Update)
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTableNumber.trim()) {
      showToast("Table number is required.");
      return;
    }

    const resolvedSection = isCustomSection
      ? customSectionName.trim() || "Main Dining"
      : formSection;

    const capacityNum = parseInt(formCapacity, 10) || 4;
    const dbStatus = (formStatus || "AVAILABLE").toLowerCase();

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { restId, branchId } = await getValidTenantContext(user);

      if (editingTable) {
        // Optimistic update
        const updated = tables.map((t) =>
          t.id === editingTable.id
            ? {
                ...t,
                table_number: formTableNumber.trim(),
                section_name: resolvedSection,
                seating_capacity: capacityNum,
                status: formStatus as any,
              }
            : t
        );
        setTables(updated);
        localStorage.setItem(`tables_list_${restId}`, JSON.stringify(updated));

        // Supabase update
        const { error } = await supabase
          .from("restaurant_tables")
          .update({
            table_number: formTableNumber.trim(),
            section_name: resolvedSection,
            floor_name: resolvedSection,
            seating_capacity: capacityNum,
            capacity: capacityNum,
            status: dbStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTable.id)
          .eq("restaurant_id", restId);

        if (error) {
          console.error("[TableView] Supabase update error:", error);
          showToast(`Failed to update table: ${error.message}`);
          return;
        }
        showToast(`Table "${formTableNumber.trim()}" updated.`);
      } else {
        // Create new table directly in Supabase
        const payload: any = {
          restaurant_id: restId,
          table_number: formTableNumber.trim(),
          section_name: resolvedSection,
          floor_name: resolvedSection,
          seating_capacity: capacityNum,
          capacity: capacityNum,
          status: dbStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (branchId) payload.branch_id = branchId;

        const { data, error } = await supabase
          .from("restaurant_tables")
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error("[TableView] Supabase insert error:", error);
          showToast(`Failed to save table: ${error.message}`);
          return;
        }

        if (data) {
          const newRecord: RestaurantTable = {
            id: data.id,
            restaurant_id: data.restaurant_id,
            branch_id: data.branch_id,
            table_number: data.table_number || formTableNumber.trim(),
            section_name: data.section_name || data.floor_name || resolvedSection,
            seating_capacity: Number(data.seating_capacity ?? data.capacity ?? capacityNum),
            status: (data.status ? String(data.status).toUpperCase() : "AVAILABLE") as any,
            qr_code_url: data.qr_code_url || undefined,
            is_active: data.is_active !== undefined ? data.is_active : true,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };

          setTables((prev) => [...prev.filter((t) => t.id !== newRecord.id), newRecord]);
          try {
            localStorage.setItem(`tables_list_${restId}`, JSON.stringify([...tables, newRecord]));
          } catch {}
          showToast(`Table "${formTableNumber.trim()}" added to floor successfully.`);
        }
      }

      closeModal();
    } catch (err: any) {
      console.error("[TableView] Save error:", err);
      showToast(`Error saving table: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Table
  const handleDeleteTable = async () => {
    if (!tableToDelete) return;

    const id = tableToDelete.id;
    const num = tableToDelete.table_number;

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);

      // Optimistic delete
      const updated = tables.filter((t) => t.id !== id);
      setTables(updated);
      localStorage.setItem(`tables_list_${restId}`, JSON.stringify(updated));

      const { error } = await supabase
        .from("restaurant_tables")
        .delete()
        .eq("id", id)
        .eq("restaurant_id", restId);

      if (error) {
        console.error("[TableView] Supabase delete error:", error);
        showToast(`Failed to delete table: ${error.message}`);
        return;
      }
      showToast(`Table "${num}" removed permanently.`);
    } catch (err) {
      console.error("[TableView] Delete error:", err);
      showToast("Error deleting table.");
    } finally {
      setTableToDelete(null);
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
            <span>FLOOR &amp; SEATING MATRIX</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Floor &amp; Tables{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Layout
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Live dining room layout, table statuses &amp; reservations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openModal()}
            className="btn-gold animate-sheen px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* B. QUICK STATS BANNER (3 CARDS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 font-mono">
        {/* Stat 1: Total Tables & Capacity */}
        <div className="glass-panel p-3.5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[10px] sm:text-[11px] font-bold border border-[var(--gold)]/30">
              Floor Matrix
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
              {stats.totalTables}
              <span className="text-xs sm:text-sm font-normal text-[var(--text-faint)] ml-1.5">Tables</span>
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1">
              Total Tables &amp; Floor Capacity
            </p>
          </div>
          <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>{stats.totalCapacity} Dining Seats</span>
            <span className="text-[var(--gold)]">{availableSections.length} Active Zones</span>
          </div>
        </div>

        {/* Stat 2: Occupancy Rate */}
        <div className="glass-panel p-3.5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-mono text-[10px] sm:text-[11px] font-bold border border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span> Live Seating
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-2xl sm:text-4xl text-red-400 tracking-tight">
              {stats.occupancyRate}%
              <span className="text-xs sm:text-sm font-normal text-red-400/80 ml-1.5">Occupancy</span>
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1">
              Active Dining Floor Load
            </p>
          </div>
          <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>{stats.occupiedTables} Occupied</span>
            <span className="text-amber-400">{stats.billedTables} Billed Out</span>
          </div>
        </div>

        {/* Stat 3: Available Tables */}
        <div className="glass-panel p-3.5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] font-mono text-[10px] sm:text-[11px] font-bold border border-[#25d366]/30">
              Ready to Seat
            </span>
          </div>
          <div>
            <div className="font-mono font-extrabold text-2xl sm:text-4xl text-[#25d366] tracking-tight">
              {stats.availableTables}
              <span className="text-xs sm:text-sm font-normal text-[#25d366]/80 ml-1.5">/ {stats.totalTables} Ready</span>
            </div>
            <p className="font-sans text-[11px] sm:text-xs font-medium text-[var(--text-lo)] mt-0.5 sm:mt-1">
              Available &amp; Clean Tables
            </p>
          </div>
          <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
            <span>{stats.reservedTables} Reserved</span>
            <span className="text-[#25d366]">Immediate Walk-in</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* C. FILTER & SEARCH BAR */}
      {/* ========================================================================= */}
      {/* Unified Section Dropdown & Search Bar in a Single Horizontal Row */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
        {/* Section Dropdown (styled identically to search bar) */}
        <div className="relative w-[44%] sm:w-60 shrink-0">
          <ResponsiveSelect
            value={selectedSection}
            onChange={(val) => setSelectedSection(val)}
            buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
            menuClassName="w-56 sm:w-60"
            options={[
              { id: "all", label: "All Sections", count: tables.length },
              ...availableSections.map((sec) => ({
                id: sec,
                label: sec,
                count: tables.filter(
                  (t) => (t.section_name || "Main Dining").toLowerCase() === sec.toLowerCase()
                ).length,
              })),
            ]}
          />
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tables..."
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-3 py-2.5 h-10 text-xs font-mono text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* D. TABLES GRID DISPLAY */}
      {/* ========================================================================= */}
      {isLoading ? (
        <div className="min-h-[260px] flex items-center justify-center glass-panel border border-[var(--border)] rounded-2xl">
          <div className="flex flex-col items-center gap-2.5 text-[var(--text-faint)]">
            <RefreshCw className="w-6 h-6 animate-spin text-[var(--gold)]" />
            <p className="text-xs font-mono">Loading floor layout...</p>
          </div>
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide mb-4">No tables configured yet</h3>
          <button
            type="button"
            onClick={() => openModal()}
            className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Add Table</span>
          </button>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center glass-panel border border-[var(--border)] rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-[var(--surface-hi)] flex items-center justify-center text-[var(--gold)] mb-3 border border-[var(--border)]">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No tables match your filter</h3>
          <p className="text-xs text-[var(--text-lo)] max-w-sm mt-1 mb-4">
            {searchQuery
              ? `No tables found matching "${searchQuery}".`
              : "No tables found in this section."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedSection("all");
            }}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hi)] text-xs font-mono text-[var(--text-hi)] transition-colors border border-[var(--border)]"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 font-mono">
          {filteredTables.map((table) => {
            const statusKey = (table.status || "AVAILABLE").toUpperCase();
            const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.AVAILABLE;

            return (
              <div
                key={table.id}
                className="glass-panel p-4 sm:p-4.5 rounded-2xl hover:border-[var(--gold)]/40 transition-all duration-200 flex flex-col justify-between relative group overflow-hidden"
              >
                {/* Header Row: Table Number & Status Pill */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[var(--text-hi)] tracking-tight truncate">
                        {table.table_number}
                      </h3>
                      <span className="inline-block text-[10px] text-[var(--text-faint)] bg-[var(--surface-hi)] border border-[var(--border)] px-2 py-0.5 rounded mt-1 truncate max-w-full">
                        {table.section_name || "Main Dining"}
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide shrink-0 ${statusCfg.pillClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`} />
                      <span>{statusCfg.label}</span>
                    </div>
                  </div>

                  {/* Seating Capacity & Visual Indicator */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-lo)]">
                      <Users className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                      <span className="font-medium">{table.seating_capacity} Seats</span>
                    </div>

                    {/* Subtle dot representation of capacity */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(table.seating_capacity, 8) }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            statusKey === "OCCUPIED"
                              ? "bg-red-400/60"
                              : statusKey === "RESERVED"
                              ? "bg-blue-400/60"
                              : "bg-white/10"
                          }`}
                        />
                      ))}
                      {table.seating_capacity > 8 && (
                        <span className="text-[10px] text-[var(--text-faint)]">
                          +{table.seating_capacity - 8}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="mt-3.5 pt-2.5 border-t border-[var(--border)]/60 flex items-center justify-between gap-1.5 min-w-0">
                  {/* Quick Status Action Button */}
                  <div className="flex-1 min-w-0">
                    {statusKey === "AVAILABLE" && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(table, "RESERVED")}
                        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/25 text-[10px] font-bold transition-colors cursor-pointer truncate"
                        title="Mark as Reserved"
                      >
                        <span className="truncate">Reserve</span>
                      </button>
                    )}

                    {statusKey === "RESERVED" && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(table, "AVAILABLE")}
                        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#25d366]/10 hover:bg-[#25d366]/20 text-[#25d366] border border-[#25d366]/25 text-[10px] font-bold transition-colors cursor-pointer truncate"
                        title="Release reservation"
                      >
                        <span className="truncate">Ready</span>
                      </button>
                    )}

                    {statusKey === "OCCUPIED" && (
                      <div className="flex items-center gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(table, "BILLED")}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 text-[10px] font-bold transition-colors cursor-pointer truncate"
                          title="Mark as Billed"
                        >
                          <span className="truncate">Bill Out</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(table, "AVAILABLE")}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#25d366]/10 hover:bg-[#25d366]/20 text-[#25d366] border border-[#25d366]/25 text-[10px] font-bold transition-colors cursor-pointer truncate"
                          title="Clear & Release Table"
                        >
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">Release</span>
                        </button>
                      </div>
                    )}

                    {statusKey === "BILLED" && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(table, "AVAILABLE")}
                        className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#25d366]/10 hover:bg-[#25d366]/20 text-[#25d366] border border-[#25d366]/25 text-[10px] font-bold transition-colors cursor-pointer truncate"
                        title="Reset to Available"
                      >
                        <span className="truncate">Clear</span>
                      </button>
                    )}
                  </div>

                  {/* Status Dropdown Menu */}
                  <div className="relative group/menu shrink-0">
                    <select
                      value={statusKey}
                      onChange={(e) =>
                        handleQuickStatusChange(table, e.target.value as any)
                      }
                      className="appearance-none bg-[var(--surface-hi)] hover:bg-white/5 text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] rounded-lg pl-2 pr-4.5 py-1.5 text-[10px] font-bold focus:outline-none cursor-pointer transition-colors"
                      title="Change status"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="OCCUPIED">Occupied</option>
                      <option value="BILLED">Billed</option>
                      <option value="RESERVED">Reserved</option>
                    </select>
                    <ChevronDown className="w-2.5 h-2.5 text-[var(--text-faint)] pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
                  </div>

                  {/* Edit & Delete Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openModal(table)}
                      className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--gold)] hover:bg-[var(--gold-dim)] border border-[var(--border)]/40 transition-colors cursor-pointer"
                      title="Edit table"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setTableToDelete(table)}
                      className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-red-400 hover:bg-red-500/10 border border-[var(--border)]/40 transition-colors cursor-pointer"
                      title="Delete table"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* E. ADD / EDIT TABLE MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg max-h-[90vh] bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto font-sans animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--border)] shrink-0 bg-[var(--surface-hi)]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-hi)] tracking-tight font-display">
                    {editingTable ? `Edit ${editingTable.table_number}` : "Add New Dining Table"}
                  </h3>
                  <p className="text-xs text-[var(--text-lo)] mt-0.5">
                    Configure dining table identifier, floor zone, and capacity
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeModal()}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTable} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
                {/* Table Identifier */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Table Identifier / Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTableNumber}
                    onChange={(e) => setFormTableNumber(e.target.value)}
                    placeholder="e.g., Table 09, T-14, VIP-1"
                    required
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
                  />
                </div>

                {/* Floor Section Selection */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Floor Section
                  </label>
                  <div className="space-y-2">
                    <select
                      value={isCustomSection ? "CUSTOM" : formSection}
                      onChange={(e) => {
                        if (e.target.value === "CUSTOM") {
                          setIsCustomSection(true);
                        } else {
                          setIsCustomSection(false);
                          setFormSection(e.target.value);
                        }
                      }}
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[var(--text-hi)] focus:outline-none focus:border-[var(--gold)]/50 transition-colors cursor-pointer"
                    >
                      {PRESET_SECTIONS.map((sec) => (
                        <option key={sec} value={sec} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                          {sec}
                        </option>
                      ))}
                      <option value="CUSTOM" className="bg-[var(--bg-deep)] text-[var(--gold)] font-bold">
                        + Custom Floor Area...
                      </option>
                    </select>

                    {isCustomSection && (
                      <input
                        type="text"
                        value={customSectionName}
                        onChange={(e) => setCustomSectionName(e.target.value)}
                        placeholder="Type custom section name (e.g. Garden Lounge)"
                        className="w-full bg-[var(--surface-hi)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
                      />
                    )}
                  </div>
                </div>

                {/* Seating Capacity */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-[var(--text-lo)]">
                      Seating Capacity (Guests)
                    </label>
                    <span className="text-xs font-mono text-[var(--gold)] font-bold">
                      {formCapacity} Seats
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[var(--text-hi)] focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
                  />
                  {/* Quick select capacity buttons */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {[2, 4, 6, 8, 10, 12].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setFormCapacity(String(num))}
                        className={`flex-1 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                          formCapacity === String(num)
                            ? "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/40 font-bold"
                            : "bg-[var(--surface-hi)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)]"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Initial / Target Status */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Table Status
                  </label>
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    {(["AVAILABLE", "RESERVED", "OCCUPIED", "BILLED"] as const).map((st) => {
                      const cfg = STATUS_CONFIG[st];
                      const isSelected = formStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFormStatus(st)}
                          className={`flex items-center justify-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? `${cfg.pillClass} font-semibold shadow-sm`
                              : "border-[var(--border)] bg-[var(--surface-hi)] text-[var(--text-faint)] hover:text-[var(--text-hi)]"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border)] flex items-center justify-end gap-2.5 shrink-0 bg-[var(--bg-deep)]">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  disabled={isSaving}
                  className="px-3.5 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-xs font-mono text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-gold animate-sheen px-5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingTable ? "Save Changes" : "Create Table"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {tableToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setTableToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm bg-[var(--bg-deep)] border border-red-500/40 rounded-2xl sm:rounded-3xl shadow-2xl p-6 space-y-4 font-sans text-xs my-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-400">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[var(--text-hi)] tracking-wide">
                  Delete Table?
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setTableToDelete(null)}
                className="w-7 h-7 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-faint)]">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-[var(--text-hi)]">
                "{tableToDelete.table_number}"
              </span>{" "}
              ({tableToDelete.section_name || "Main Dining"}) from the floor?
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)] font-mono">
              <button
                type="button"
                onClick={() => setTableToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-xs text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTable}
                className="px-3.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Delete Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
