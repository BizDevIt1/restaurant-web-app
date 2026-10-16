"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Plus,
  Search,
  Receipt,
  Flame,
  Bike,
  ShieldCheck,
  Phone,
  Clock,
  Building2,
  Edit2,
  Trash2,
  AlertTriangle,
  Mail,
  Lock,
  Loader2,
  UtensilsCrossed,
  ChevronDown,
  X,
  Navigation,
  MapPin,
  Eye,
} from "lucide-react";
import { StaffMember, PersonaRole } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { saveStoredStaff } from "../../../../lib/tenantStore";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import { useRouter } from "next/navigation";
import StaffProvisioningView from "./StaffProvisioningView";
import StaffReconciliationView from "./StaffReconciliationView";
import { analyzeStaffMultiShifts } from "../../../../lib/shiftAuditNotifications";
import { fetchUniversalStaffShifts } from "../../../../lib/universalShiftLogging";

interface StaffViewProps {
  staffList: StaffMember[];
  setStaffList?: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  onAddStaff?: (newMember: StaffMember) => void;
  onUpdateStaff?: (updatedMember: StaffMember) => void;
  onDeleteStaff?: (staffId: string) => void;
  persona: PersonaRole;
  selectedBranchId: string;
  showToast: (msg: string) => void;
  routeAction?: { action: "new" | "edit" | "reconciliation"; id?: string } | null;
}

// Helper to strictly eliminate duplicate staff records by ID and normalize terminal access
const deduplicateStaff = (list: StaffMember[]): StaffMember[] => {
  const seen = new Set<string>();
  return (list || []).map((item) => {
    const isWaiter =
      (item.role || "").toLowerCase() === "waiter" ||
      (item.role || "").toLowerCase() === "server" ||
      item.terminalAccess === "WAITER_ONLY";
    if (isWaiter) {
      return {
        ...item,
        assignedScreen: "Waiter Station" as const,
        terminalAccess: "WAITER_ONLY" as const,
      };
    }
    return item;
  }).filter((item) => {
    if (!item?.id) return false;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

// Helper to strictly display only the clean shift label (e.g. "Morning", "Evening", "Night") without time ranges
export const getCleanShiftLabel = (rawShift?: string): string => {
  if (!rawShift) return "Evening";
  const lower = rawShift.toLowerCase().trim();
  if (lower.includes("morning")) return "Morning";
  if (lower.includes("evening")) return "Evening";
  if (lower.includes("night") || lower.includes("closing")) return "Night";
  const cleaned = rawShift.replace(/\s*\([^)]*\)/g, "").replace(/\s*-\s*\d+.*$/, "").trim();
  return cleaned || "Evening";
};

export default function StaffView({
  staffList,
  setStaffList,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  persona,
  selectedBranchId,
  showToast,
  routeAction,
}: StaffViewProps) {
  const router = useRouter();
  const { user, isBranchAdmin, hasFeature } = useAuth();
  const currentOrgId = user?.organizationId || user?.id || "default";

  // Local roster synchronized with Supabase & deduplicated
  const [roster, setRoster] = useState<StaffMember[]>(() => deduplicateStaff(staffList));
  const [shiftSettlements, setShiftSettlements] = useState<any[]>([]);
  const [isFetchingShifts, setIsFetchingShifts] = useState(false);

  const staffShiftStats = useMemo(() => {
    return analyzeStaffMultiShifts(shiftSettlements);
  }, [shiftSettlements]);

  useEffect(() => {
    if (staffList) {
      setRoster(deduplicateStaff(staffList));
    }
  }, [staffList]);

  // Load staff records and shift logs directly from Supabase
  const fetchStaffFromSupabase = useCallback(async () => {
    setIsFetchingShifts(true);
    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);
      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .eq("restaurant_id", restId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[StaffView] Supabase load error:", error);
      } else if (data) {
        const mapped: StaffMember[] = data.map((s: any) => ({
          id: s.id,
          name: s.full_name,
          email: s.email,
          password: s.password_hash,
          role: s.role,
          branchId: s.branch_id || "main",
          branchName: s.branch_name || "Main Outlet",
          phone: s.phone || "",
          shift: s.shift || "Evening",
          status: s.status || "active",
          terminalAccess: (s.role === "waiter" || s.role === "server" || s.terminal_access === "WAITER_ONLY") ? "WAITER_ONLY" : s.terminal_access,
          assignedScreen:
            (s.role === "waiter" || s.role === "server" || s.terminal_access === "WAITER_ONLY")
              ? "Waiter Station"
              : s.terminal_access === "POS_ONLY"
              ? "POS Counter"
              : s.terminal_access === "KDS_ONLY"
              ? "Kitchen (KDS)"
              : s.terminal_access === "RIDER_ONLY"
              ? "Rider Dispatch"
              : "Full Admin",
          avatar: (s.full_name || "ST").substring(0, 2).toUpperCase(),
          joinedDate: "Active",
          assigned_zones: Array.isArray(s.assigned_zones) ? s.assigned_zones : [],
          assigned_station: s.assigned_station || (s as any).assignedStation || undefined,
          assignedStation: s.assigned_station || (s as any).assignedStation || undefined,
        }));

        const cleanList = deduplicateStaff(mapped);
        setRoster(cleanList);
        if (setStaffList) {
          setStaffList(cleanList);
          saveStoredStaff(currentOrgId, cleanList);
        }
      }

      // Fetch shift settlements strictly for authenticated restaurant_id
      const shifts = await fetchUniversalStaffShifts(restId);

      const staffOnlyShifts = (shifts || []).filter((s: any) => {
        const name = (s.cashier_name || "").toLowerCase().trim();
        const role = (s.staff_role || s.cashier_role || s.role || "").toLowerCase().trim();
        const notes = (s.closing_notes || "").toLowerCase();
        return !(
          name === "admin" ||
          role === "admin" ||
          name.startsWith("admin ") ||
          name.endsWith(" admin") ||
          notes.includes("admin pos session")
        );
      });

      // Strict 100% Realtime Database Sourcing: zero mock fallback data
      setShiftSettlements(staffOnlyShifts);
    } catch (err) {
      console.error("[StaffView] Supabase fetch exception:", err);
    } finally {
      setIsFetchingShifts(false);
    }
  }, [user, currentOrgId, setStaffList]);

  useEffect(() => {
    fetchStaffFromSupabase();
  }, [fetchStaffFromSupabase]);

  // Filtering & Search
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dedicated Full-Page Staff Provisioning & Reconciliation Modes (No Popup Modals)
  const [provisioningMode, setProvisioningMode] = useState<"add" | "edit" | null>(null);
  const [isReconciliationMode, setIsReconciliationMode] = useState<boolean>(
    () => routeAction?.action === "reconciliation"
  );
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Synchronize routeAction with provisioningMode & reconciliationMode
  useEffect(() => {
    if (!routeAction) {
      if (provisioningMode !== null) {
        setProvisioningMode(null);
        setStaffToEdit(null);
      }
      if (isReconciliationMode) {
        setIsReconciliationMode(false);
      }
      return;
    }

    if (routeAction.action === "reconciliation") {
      setProvisioningMode(null);
      setStaffToEdit(null);
      setIsReconciliationMode(true);
      return;
    }

    setIsReconciliationMode(false);

    if (routeAction.action === "new") {
      setStaffToEdit(null);
      setProvisioningMode("add");
    } else if (routeAction.action === "edit" && routeAction.id) {
      const found = roster.find((s) => String(s.id) === String(routeAction.id));
      if (found) {
        setStaffToEdit(found);
        setProvisioningMode("edit");
      } else {
        // Direct query Supabase if navigated or refreshed directly on /admin/staff/:id
        (async () => {
          try {
            const supabase = createClient();
            const { data } = await supabase
              .from("staff_members")
              .select("*")
              .eq("id", routeAction.id)
              .maybeSingle();

            if (data) {
              const mapped: StaffMember = {
                id: data.id,
                name: data.full_name,
                email: data.email,
                password: data.password_hash,
                role: data.role,
                branchId: data.branch_id || "main",
                branchName: data.branch_name || "Main Outlet",
                phone: data.phone || "",
                shift: data.shift || "Evening",
                status: data.status || "active",
                terminalAccess: (data.role === "waiter" || data.role === "server" || data.terminal_access === "WAITER_ONLY") ? "WAITER_ONLY" : data.terminal_access,
                assignedScreen:
                  (data.role === "waiter" || data.role === "server" || data.terminal_access === "WAITER_ONLY")
                    ? "Waiter Station"
                    : data.terminal_access === "POS_ONLY"
                    ? "POS Counter"
                    : data.terminal_access === "KDS_ONLY"
                    ? "Kitchen (KDS)"
                    : data.terminal_access === "RIDER_ONLY"
                    ? "Rider Dispatch"
                    : "Full Admin",
                avatar: (data.full_name || "ST").substring(0, 2).toUpperCase(),
                joinedDate: "Active",
                assigned_zones: Array.isArray(data.assigned_zones) ? data.assigned_zones : [],
                assigned_station: data.assigned_station || (data as any).assignedStation || undefined,
                assignedStation: data.assigned_station || (data as any).assignedStation || undefined,
              };
              setStaffToEdit(mapped);
              setProvisioningMode("edit");
            }
          } catch (e) {
            console.warn("[StaffView] Error loading staff for edit route:", e);
          }
        })();
      }
    }
  }, [routeAction, roster]);

  const handleStartAddStaff = () => {
    setIsReconciliationMode(false);
    setStaffToEdit(null);
    setProvisioningMode("add");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/staff/new");
    }
  };

  const handleStartEditStaff = (staff: StaffMember) => {
    setIsReconciliationMode(false);
    setStaffToEdit(staff);
    setProvisioningMode("edit");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/admin/staff/${staff.id}`);
    }
  };

  const handleOpenReconciliation = () => {
    setProvisioningMode(null);
    setStaffToEdit(null);
    setIsReconciliationMode(true);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/staff/reconciliation");
    }
  };

  const handleCloseReconciliation = () => {
    setIsReconciliationMode(false);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/staff");
    }
  };

  // Handle Delete Confirmation from Supabase
  const confirmDelete = async () => {
    if (!staffToDelete) return;
    setIsDeleting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("staff_members")
        .delete()
        .eq("id", staffToDelete.id);

      if (error) {
        console.error("[StaffView] Supabase delete error:", error);
        showToast(`Failed to remove staff member: ${error.message}`);
        setIsDeleting(false);
        return;
      }
    } catch (err: any) {
      console.error("[StaffView] Delete exception:", err);
      showToast(`Network error: ${err?.message || "Failed to remove staff"}`);
      setIsDeleting(false);
      return;
    }

    const updated = roster.filter((s) => s.id !== staffToDelete.id);
    const cleanUpdated = deduplicateStaff(updated);
    setRoster(cleanUpdated);

    if (onDeleteStaff) {
      onDeleteStaff(staffToDelete.id);
    } else if (setStaffList) {
      setStaffList(cleanUpdated);
      saveStoredStaff(currentOrgId, cleanUpdated);
    }

    showToast(`Staff member "${staffToDelete.name}" removed.`);
    setIsDeleting(false);
    setStaffToDelete(null);
  };

  // Direct Supabase status toggle (active -> on_break -> inactive -> active)
  const handleToggleStatus = async (staff: StaffMember) => {
    const nextStatus: StaffMember["status"] =
      staff.status === "active"
        ? "on_break"
        : staff.status === "on_break"
        ? "inactive"
        : "active";

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("staff_members")
        .update({ status: nextStatus })
        .eq("id", staff.id);

      if (error) {
        console.error("[StaffView] Status toggle error:", error);
      }
    } catch (err) {
      console.error("[StaffView] Status toggle exception:", err);
    }

    const updated = { ...staff, status: nextStatus };
    const updatedRoster = roster.map((s) => (s.id === staff.id ? updated : s));
    const cleanRoster = deduplicateStaff(updatedRoster);
    setRoster(cleanRoster);

    if (onUpdateStaff) {
      onUpdateStaff(updated);
    } else if (setStaffList) {
      setStaffList(cleanRoster);
      saveStoredStaff(currentOrgId, cleanRoster);
    }

    showToast(`${staff.name} status updated to: ${nextStatus.toUpperCase()}`);
  };

  // Filter staff roster
  const filteredStaff = roster.filter((s) => {
    if (isBranchAdmin) {
      const targetBranchId = user?.branchId;
      const targetBranchName = user?.branchName;
      if (targetBranchId && s.branchId && s.branchId !== targetBranchId) {
        if (!targetBranchName || s.branchName !== targetBranchName) return false;
      }
    }
    if (roleFilter !== "all" && s.role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchPhone = s.phone.toLowerCase().includes(q);
      const matchBranch = s.branchName.toLowerCase().includes(q);
      const matchRole = s.role.toLowerCase().includes(q);
      const matchScreen = s.assignedScreen.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchBranch && !matchRole && !matchScreen) {
        return false;
      }
    }
    return true;
  });

  // Strict deduplication of filtered staff for 100% key uniqueness
  const uniqueFilteredStaff = useMemo(() => {
    return deduplicateStaff(filteredStaff);
  }, [filteredStaff]);

  // Telemetry counts
  const totalStaffCount = uniqueFilteredStaff.length;
  const cashiersCount = uniqueFilteredStaff.filter((s) => s.role === "cashier").length;
  const chefsCount = uniqueFilteredStaff.filter((s) => s.role === "chef").length;
  const ridersCount = uniqueFilteredStaff.filter((s) => s.role === "rider").length;
  const managersCount = uniqueFilteredStaff.filter((s) => s.role === "manager").length;

  // Dynamic role filter options based on active features
  const roleFilterOptions = useMemo(() => {
    const opts = [
      { id: "all", label: "All Roles", count: totalStaffCount },
      { id: "manager", label: "Managers", count: managersCount },
    ];
    if (hasFeature("POS")) {
      opts.push({ id: "cashier", label: "Cashiers", count: cashiersCount });
    }
    if (hasFeature("KITCHEN")) {
      opts.push({ id: "chef", label: "Chefs", count: chefsCount });
    }
    if (hasFeature("RIDER")) {
      opts.push({ id: "rider", label: "Riders", count: ridersCount });
    }
    return opts;
  }, [hasFeature, totalStaffCount, managersCount, cashiersCount, chefsCount, ridersCount]);

  useEffect(() => {
    if (roleFilter !== "all" && !roleFilterOptions.some((o) => o.id === roleFilter)) {
      setRoleFilter("all");
    }
  }, [roleFilter, roleFilterOptions]);

  // Render Dedicated Full-Page Staff Provisioning Mode (No Popup Modals)
  if (provisioningMode) {
    return (
      <StaffProvisioningView
        key={staffToEdit ? `edit_${staffToEdit.id}` : "add_new_staff"}
        initialData={staffToEdit}
        mode={provisioningMode}
        onCancel={() => {
          setProvisioningMode(null);
          setStaffToEdit(null);
          if (typeof window !== "undefined") {
            window.history.pushState(null, "", "/admin/staff");
          }
        }}
        onSuccess={(savedStaff) => {
          if (provisioningMode === "add") {
            const updated = deduplicateStaff([savedStaff, ...roster]);
            setRoster(updated);
            if (onAddStaff) {
              onAddStaff(savedStaff);
            } else if (setStaffList) {
              setStaffList(updated);
              saveStoredStaff(currentOrgId, updated);
            }
          } else {
            const updated = roster.map((s) => (s.id === savedStaff.id ? savedStaff : s));
            const cleanUpdated = deduplicateStaff(updated);
            setRoster(cleanUpdated);
            if (onUpdateStaff) {
              onUpdateStaff(savedStaff);
            } else if (setStaffList) {
              setStaffList(cleanUpdated);
              saveStoredStaff(currentOrgId, cleanUpdated);
            }
          }
          setProvisioningMode(null);
          setStaffToEdit(null);
          if (typeof window !== "undefined") {
            window.history.pushState(null, "", "/admin/staff");
          }
        }}
        showToast={showToast}
      />
    );
  }

  // Render Dedicated Full-Page Staff Reconciliation View
  if (isReconciliationMode) {
    return (
      <StaffReconciliationView
        settlements={shiftSettlements}
        currencySymbol="Rs"
        onBack={handleCloseReconciliation}
        onRefresh={fetchStaffFromSupabase}
        isRefreshing={isFetchingShifts}
      />
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Staff Delegation &amp;{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Terminal Access
            </span>
          </h1>
          <p className="text-xs font-mono text-[var(--text-lo)] mt-1">
            Manage roles, terminal provisioning, stations, and shift assignments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handleOpenReconciliation}
            id="staff-reconciliation-btn"
            className="px-4 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-2 shrink-0 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--gold)]/50 text-[var(--text-hi)] hover:text-[var(--gold)] transition-all shadow-sm group font-mono"
          >
            <Clock className="w-4 h-4 text-[var(--gold)] group-hover:scale-110 transition-transform" />
            <span>Staff Reconciliation</span>
          </button>

          <button
            type="button"
            onClick={handleStartAddStaff}
            id="add-staff-member-btn"
            className="btn-gold animate-sheen px-5 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-2 shrink-0 rounded-xl shadow-md hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Roster Telemetry Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Total Staff</span>
            <Users className="w-3.5 h-3.5 text-[var(--gold)]" />
          </div>
          <p className="text-lg sm:text-2xl font-display font-black text-[var(--text-hi)]">{totalStaffCount}</p>
        </div>

        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-[var(--text-faint)] uppercase">
            <span>Managers</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--gold)]" />
          </div>
          <p className="text-lg sm:text-2xl font-display font-black text-[var(--gold)]">{managersCount}</p>
        </div>

        {hasFeature("POS") && (
          <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[var(--border)] space-y-1">
            <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-[var(--text-faint)] uppercase">
              <span>Cashiers</span>
              <Receipt className="w-3.5 h-3.5 text-[#25d366]" />
            </div>
            <p className="text-lg sm:text-2xl font-display font-black text-[#25d366]">{cashiersCount}</p>
          </div>
        )}

        {hasFeature("KITCHEN") && (
          <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[var(--border)] space-y-1">
            <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-[var(--text-lo)] dark:text-[var(--text-faint)] uppercase">
              <span>Chefs</span>
              <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-lg sm:text-2xl font-display font-black text-amber-800 dark:text-amber-400">{chefsCount}</p>
          </div>
        )}

        {hasFeature("RIDER") && (
          <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[var(--border)] space-y-1">
            <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-[var(--text-faint)] uppercase">
              <span>Riders</span>
              <Bike className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-lg sm:text-2xl font-display font-black text-blue-400">{ridersCount}</p>
          </div>
        )}
      </div>

      {/* Unified Role Filter Dropdown & Live Search in a Single Horizontal Row */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 w-full">
        {/* Role Filter Dropdown (styled identically to search bar) */}
        <div className="relative w-[44%] sm:w-60 shrink-0">
          <ResponsiveSelect
            value={roleFilter}
            onChange={(val) => setRoleFilter(val)}
            buttonClassName="h-10 text-xs font-mono text-[var(--text-hi)]"
            menuClassName="w-56 sm:w-60"
            options={roleFilterOptions}
          />
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-[var(--text-faint)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff roster by name, phone, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-3 py-2.5 h-10 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner font-mono"
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

      {/* Staff Roster Grid */}
      {roster.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--surface-hi)] border border-[var(--border)] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-[var(--surface-base)] border border-[var(--border)] flex items-center justify-center text-[var(--gold)] mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide mb-4">No staff members added yet</h3>
          <button
            type="button"
            onClick={handleStartAddStaff}
            className="btn-gold px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      ) : uniqueFilteredStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--surface-hi)] border border-[var(--border)] rounded-xl">
          <div className="w-12 h-12 rounded-full bg-[var(--surface-base)] border border-[var(--border)] flex items-center justify-center text-[var(--gold)] mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-hi)] tracking-wide">No team members match the search</h3>
          <p className="text-xs text-[var(--text-lo)] max-w-sm mt-1 mb-4">Try adjusting your search query or role filter tab.</p>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {/* Column Header for Desktop: Strictly Staff Member, Role, and Actions */}
          <div className="hidden md:flex items-center justify-between px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
            <div className="flex items-center gap-4 flex-1 min-w-0 pl-1.5 sm:pl-2">
              <span className="w-56 lg:w-72 shrink-0">Staff Member</span>
              <span className="flex-1 min-w-0">Role</span>
            </div>
            <span className="shrink-0 text-right pr-2">Actions</span>
          </div>

          {uniqueFilteredStaff.map((staff) => {
            const cleanShift = getCleanShiftLabel(staff.shift);
            return (
              <div
                key={staff.id}
                className="glass-panel px-2.5 py-2 sm:px-3 sm:py-2.5 md:px-4 md:py-3.5 rounded-xl sm:rounded-2xl border border-[var(--border)] hover:border-[var(--gold)]/40 hover:bg-[var(--surface-hi)]/30 transition-all duration-200 flex flex-row items-center justify-between gap-2 sm:gap-3 md:gap-4 relative group overflow-hidden"
              >
                {/* Left vertical role accent line */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    staff.role === "cashier"
                      ? "bg-gradient-to-b from-emerald-500 to-teal-400"
                      : staff.role === "chef"
                      ? "bg-gradient-to-b from-amber-500 to-orange-500"
                      : staff.role === "rider"
                      ? "bg-gradient-to-b from-blue-500 to-cyan-400"
                      : staff.role === "waiter"
                      ? "bg-gradient-to-b from-teal-400 to-emerald-500"
                      : "bg-gradient-to-b from-[var(--gold)] to-amber-600"
                  }`}
                />

                {/* Left Core Columns - Staff Member (with Shift subtext) & Role */}
                <div className="flex flex-row items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0 pl-1 sm:pl-1.5 md:pl-2">
                  {/* 1. Staff Member Name, Avatar & Shift Subtext (Consistent fixed width across all rows for vertical column alignment) */}
                  <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 w-36 xs:w-40 sm:w-52 md:w-56 lg:w-72 shrink-0">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] flex items-center justify-center font-display font-black text-xs sm:text-sm shadow-sm border border-white/40">
                        {staff.avatar || (staff.name || "ST").substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <h4 className="font-display font-bold text-xs sm:text-sm md:text-base text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors truncate">
                        {staff.name}
                      </h4>
                      <span
                        className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-mono text-[var(--text-lo)] mt-0.5"
                        title={`Duty Shift: ${cleanShift}`}
                      >
                        <Clock className="w-2.5 h-2.5 text-[var(--gold)] shrink-0" />
                        <span className="truncate">{cleanShift}</span>
                      </span>
                    </div>
                  </div>

                  {/* 2. Role Column - Clean, perfectly aligned vertically */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="uppercase text-xs sm:text-sm font-semibold tracking-wide text-[var(--text-hi)] truncate">
                      {staff.role}
                    </span>
                    {staff.role === "chef" && (staff.assigned_station || (staff as any).assignedStation) && (
                      <span className="hidden sm:inline-flex text-[11px] font-mono text-[var(--text-lo)] font-medium truncate">
                        ({String(staff.assigned_station || (staff as any).assignedStation).replace(/_/g, " ")})
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Actions Column: Clean Transparent Borderless Icon Buttons */}
                <div className="flex flex-row items-center gap-2 sm:gap-3 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => setViewingStaff(staff)}
                    className="p-1 text-[var(--text-lo)] hover:text-[var(--gold)] hover:scale-115 transition-all cursor-pointer bg-transparent border-0 flex items-center justify-center focus:outline-none"
                    title="View Details"
                    aria-label="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartEditStaff(staff)}
                    className="p-1 text-[var(--text-lo)] hover:text-[var(--gold)] hover:scale-115 transition-all cursor-pointer bg-transparent border-0 flex items-center justify-center focus:outline-none"
                    title="Edit Staff"
                    aria-label="Edit staff"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStaffToDelete(staff)}
                    className="p-1 text-[var(--text-lo)] hover:text-rose-400 hover:scale-115 transition-all cursor-pointer bg-transparent border-0 flex items-center justify-center focus:outline-none"
                    title="Delete Staff"
                    aria-label="Delete staff"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pure staff list view without heavy audit table */}

      {/* ========================================================================= */}
      {/* DELETE STAFF CONFIRMATION DIALOG (Pure Supabase DB Delete)                 */}
      {/* ========================================================================= */}
      {staffToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setStaffToDelete(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl sm:rounded-3xl w-full max-w-sm p-5 sm:p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="font-display font-black text-lg text-[var(--text-hi)]">
                Delete Team Member?
              </h3>
              <p className="text-xs text-[var(--text-lo)] leading-relaxed">
                Are you sure you want to permanently delete{" "}
                <span className="text-[var(--gold)] font-bold">{staffToDelete.name}</span> from{" "}
                <span className="font-mono text-[var(--text-hi)]">{staffToDelete.branchName}</span>?
              </p>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] font-mono text-rose-300 text-left space-y-1">
                <p>• Permanently removes staff profile</p>
                <p>• Revokes login credentials ({staffToDelete.email})</p>
                <p>• Immediately closes {staffToDelete.assignedScreen} terminal access</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setStaffToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 text-xs font-bold cursor-pointer transition-colors shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW STAFF DETAILS MODAL (Eye Button)                                     */}
      {/* ========================================================================= */}
      {viewingStaff && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingStaff(null);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl sm:rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] flex items-center justify-center font-display font-black text-lg shadow-md border border-white/40">
                  {viewingStaff.avatar || (viewingStaff.name || "ST").substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-[var(--text-hi)]">
                    {viewingStaff.name}
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-lo)] flex items-center gap-1 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-[var(--gold)]" />
                    {viewingStaff.email || "No email"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="p-1.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)]/60 space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-faint)] tracking-wider">Role</span>
                <div className="font-bold text-[var(--text-hi)] uppercase">
                  {viewingStaff.role}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)]/60 space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-faint)] tracking-wider">Duty Shift</span>
                <div className="font-bold text-[var(--gold)] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                  {getCleanShiftLabel(viewingStaff.shift)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)]/60 space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-faint)] tracking-wider">Assigned Outlet</span>
                <div className="font-bold text-[var(--text-hi)] flex items-center gap-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                  <span className="truncate">{viewingStaff.branchName || "Main Outlet"}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)]/60 space-y-1">
                <span className="text-[10px] uppercase text-[var(--text-faint)] tracking-wider">Presence Status</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      viewingStaff.status === "active"
                        ? "bg-emerald-500 ring-2 ring-emerald-500/30"
                        : viewingStaff.status === "on_break"
                        ? "bg-amber-500 ring-2 ring-amber-500/30"
                        : "bg-rose-500 ring-2 ring-rose-500/30"
                    }`}
                  />
                  <span className="capitalize text-[var(--text-hi)]">
                    {viewingStaff.status === "on_break" ? "On Break" : viewingStaff.status}
                  </span>
                </div>
              </div>

              <div className="col-span-2 p-3 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)]/60 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                  <span className="tracking-wider uppercase">TERMINAL ACCESS ROUTING</span>
                  <span className="font-bold text-[var(--gold)]">
                    {viewingStaff.terminalAccess || "FULL_ADMIN"}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-hi)]">
                  {(viewingStaff.assignedScreen === "Waiter Station" || (viewingStaff.role || "").toLowerCase() === "waiter" || (viewingStaff.role || "").toLowerCase() === "server") ? (
                    <>
                      <UtensilsCrossed className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-violet-300 font-mono">Waiter Portal</span>
                    </>
                  ) : (
                    <>
                      {viewingStaff.assignedScreen === "POS Counter" && (
                        <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {viewingStaff.assignedScreen === "Kitchen (KDS)" && (
                        <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                      )}
                      {viewingStaff.assignedScreen === "Rider Dispatch" && (
                        <Bike className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      {viewingStaff.assignedScreen === "Full Admin" && (
                        <ShieldCheck className="w-4 h-4 text-[var(--gold)] shrink-0" />
                      )}
                      <span>{viewingStaff.assignedScreen || "Full Admin"}</span>
                    </>
                  )}
                </div>
              </div>

              {viewingStaff.phone && (
                <div className="col-span-2 p-3 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)]/60 space-y-1">
                  <span className="text-[10px] uppercase text-[var(--text-faint)] tracking-wider">Contact Phone</span>
                  <div className="font-bold text-[var(--text-hi)] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>{viewingStaff.phone}</span>
                  </div>
                </div>
              )}

              {viewingStaff.role === "rider" && viewingStaff.assigned_zones && viewingStaff.assigned_zones.length > 0 && (
                <div className="col-span-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Assigned Delivery Areas ({viewingStaff.assigned_zones.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {viewingStaff.assigned_zones.map((zone, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-200 text-[11px]"
                      >
                        {zone}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {staffShiftStats[viewingStaff.name] && (
                <div className="col-span-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold">
                      {staffShiftStats[viewingStaff.name].totalShiftsCount > 1
                        ? `Consecutive (${staffShiftStats[viewingStaff.name].totalShiftsCount} Shifts)`
                        : "1 Shift Logged"}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-400">
                    {staffShiftStats[viewingStaff.name].totalHoursWorked.toFixed(1)} hrs worked
                  </span>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  const target = viewingStaff;
                  setViewingStaff(null);
                  handleStartEditStaff(target);
                }}
                className="px-4 py-2 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold-hi)] text-[#2a2415] text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Staff Member</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-hi)] border border-[var(--border)] text-xs font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

