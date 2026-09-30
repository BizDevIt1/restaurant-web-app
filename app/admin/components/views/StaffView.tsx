"use client";

import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { StaffMember, PersonaRole } from "../../types";
import ResponsiveSelect from "../ResponsiveSelect";
import { useAuth } from "../../context/AuthContext";
import { saveStoredStaff } from "../../../../lib/tenantStore";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import { useRouter } from "next/navigation";
import StaffProvisioningView from "./StaffProvisioningView";

interface StaffViewProps {
  staffList: StaffMember[];
  setStaffList?: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  onAddStaff?: (newMember: StaffMember) => void;
  onUpdateStaff?: (updatedMember: StaffMember) => void;
  onDeleteStaff?: (staffId: string) => void;
  persona: PersonaRole;
  selectedBranchId: string;
  showToast: (msg: string) => void;
  routeAction?: { action: "new" | "edit"; id?: string } | null;
}

// Helper to strictly eliminate duplicate staff records by ID
const deduplicateStaff = (list: StaffMember[]): StaffMember[] => {
  const seen = new Set<string>();
  return (list || []).filter((item) => {
    if (!item?.id) return false;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
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

  useEffect(() => {
    if (staffList) {
      setRoster(deduplicateStaff(staffList));
    }
  }, [staffList]);

  // Load staff records directly from Supabase public.staff_members
  useEffect(() => {
    let isMounted = true;
    const fetchStaffFromSupabase = async () => {
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
          return;
        }

        if (data && isMounted) {
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
            terminalAccess: s.terminal_access,
            assignedScreen:
              s.terminal_access === "POS_ONLY"
                ? "POS Counter"
                : s.terminal_access === "KDS_ONLY"
                ? "Kitchen (KDS)"
                : s.terminal_access === "RIDER_ONLY"
                ? "Rider Dispatch"
                : "Full Admin",
            avatar: (s.full_name || "ST").substring(0, 2).toUpperCase(),
            joinedDate: "Active",
            assigned_zones: Array.isArray(s.assigned_zones) ? s.assigned_zones : [],
          }));

          const cleanList = deduplicateStaff(mapped);
          setRoster(cleanList);
          if (setStaffList) {
            setStaffList(cleanList);
            saveStoredStaff(currentOrgId, cleanList);
          }
        }
      } catch (err) {
        console.error("[StaffView] Supabase fetch exception:", err);
      }
    };

    fetchStaffFromSupabase();
    return () => {
      isMounted = false;
    };
  }, [user?.organizationId, user?.restaurantId, user?.id]);

  // Filtering & Search
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dedicated Full-Page Staff Provisioning Mode (No Popup Modals)
  const [provisioningMode, setProvisioningMode] = useState<"add" | "edit" | null>(null);
  const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Synchronize routeAction with provisioningMode (support bookmarking & direct URLs)
  useEffect(() => {
    if (!routeAction) {
      if (provisioningMode !== null) {
        setProvisioningMode(null);
        setStaffToEdit(null);
      }
      return;
    }

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
                terminalAccess: data.terminal_access,
                assignedScreen:
                  data.terminal_access === "POS_ONLY"
                    ? "POS Counter"
                    : data.terminal_access === "KDS_ONLY"
                    ? "Kitchen (KDS)"
                    : data.terminal_access === "RIDER_ONLY"
                    ? "Rider Dispatch"
                    : "Full Admin",
                avatar: (data.full_name || "ST").substring(0, 2).toUpperCase(),
                joinedDate: "Active",
                assigned_zones: Array.isArray(data.assigned_zones) ? data.assigned_zones : [],
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
    setStaffToEdit(null);
    setProvisioningMode("add");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/admin/staff/new");
    }
  };

  const handleStartEditStaff = (staff: StaffMember) => {
    setStaffToEdit(staff);
    setProvisioningMode("edit");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/admin/staff/${staff.id}`);
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

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
            <Users className="w-3.5 h-3.5" />
            <span>WORKFORCE &amp; TERMINAL ROLES</span>
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Staff Delegation &amp;{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Terminal Access
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] font-medium mt-1">
            Assign staff to dedicated terminal screens (Cashier -&gt; POS only, Chef -&gt; KDS only, Rider -&gt; Dispatch).
          </p>
        </div>

        <button
          type="button"
          onClick={handleStartAddStaff}
          className="btn-gold animate-sheen px-5 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-2 shrink-0 self-start sm:self-auto rounded-xl shadow-md hover:scale-[1.02] transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
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
            <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] font-mono text-[var(--text-faint)] uppercase">
              <span>Chefs</span>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-lg sm:text-2xl font-display font-black text-amber-400">{chefsCount}</p>
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
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--surface-hi)] border border-white/10 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white tracking-wide mb-4">No staff members added yet</h3>
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
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[var(--surface-hi)] border border-white/10 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--gold)] mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white tracking-wide">No team members match the search</h3>
          <p className="text-xs text-white/50 max-w-sm mt-1 mb-4">Try adjusting your search query or role filter tab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-5">
          {uniqueFilteredStaff.map((staff) => (
            <div
              key={staff.id}
              className="glass-panel p-4 sm:p-6 rounded-2xl border border-[var(--border)] transition-all duration-300 flex flex-col justify-between relative group hover:border-[var(--gold)]/50 hover:shadow-xl hover:shadow-black/20 overflow-hidden"
            >
              {/* Top Accent Color Line by Role */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  staff.role === "cashier"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : staff.role === "chef"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                    : staff.role === "rider"
                    ? "bg-gradient-to-r from-blue-500 to-cyan-400"
                    : staff.role === "waiter"
                    ? "bg-gradient-to-r from-teal-400 to-emerald-500"
                    : "bg-gradient-to-r from-[var(--gold)] to-amber-600"
                }`}
              />

              <div className="space-y-4">
                {/* Header: Avatar, Name, Role Badge, Status Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] flex items-center justify-center font-display font-black text-base shadow-md border border-white/40">
                        {staff.avatar || (staff.name || "ST").substring(0, 2).toUpperCase()}
                      </div>
                      {/* Presence status ring */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-hi)] ${
                          staff.status === "active"
                            ? "bg-emerald-500 ring-2 ring-emerald-500/30"
                            : staff.status === "on_break"
                            ? "bg-amber-500 ring-2 ring-amber-500/30"
                            : "bg-rose-500 ring-2 ring-rose-500/30"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-display font-bold text-base text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors truncate">
                        {staff.name}
                      </h4>
                      <p className="text-[11px] font-mono text-[var(--text-lo)] truncate flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-[var(--gold)] shrink-0" />
                        <span className="truncate">{staff.email || "No email"}</span>
                      </p>
                    </div>
                  </div>

                  {/* Role Pill & Status Toggle */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        staff.role === "cashier"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : staff.role === "chef"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : staff.role === "rider"
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : staff.role === "waiter"
                          ? "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                          : "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30"
                      }`}
                    >
                      {staff.role}
                    </span>

                    {/* Interactive Status Chip */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(staff)}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-105 flex items-center gap-1 ${
                        staff.status === "active"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25"
                          : staff.status === "on_break"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/25 hover:bg-rose-500/25"
                      }`}
                      title="Cycle status"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          staff.status === "active"
                            ? "bg-emerald-400 animate-pulse"
                            : staff.status === "on_break"
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        }`}
                      />
                      <span>{staff.status === "on_break" ? "On Break" : staff.status}</span>
                    </button>
                  </div>
                </div>

                {/* Metadata Grid: Branch, Shift, Phone */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-hi)]/40 border border-[var(--border)]/50 text-[var(--text-lo)] truncate">
                    <Building2 className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                    <span className="truncate">{staff.branchName || "Main Outlet"}</span>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-hi)]/40 border border-[var(--border)]/50 text-[var(--text-lo)] truncate">
                    <Clock className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                    <span className="truncate">{staff.shift || "Evening"}</span>
                  </div>

                  <div className="col-span-2 flex items-center justify-between p-2 rounded-xl bg-[var(--surface-hi)]/40 border border-[var(--border)]/50 text-[var(--text-lo)]">
                    <div className="flex items-center gap-2 truncate">
                      <Phone className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                      <span className="truncate">{staff.phone || "No phone registered"}</span>
                    </div>
                    {staff.password && (
                      <span className="text-[10px] text-[var(--text-faint)] flex items-center gap-1 shrink-0">
                        <Lock className="w-3 h-3 text-[var(--text-faint)]" />
                        ••••••
                      </span>
                    )}
                  </div>

                  {staff.role === "rider" && (
                    <div className="col-span-2 space-y-1.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>Assigned Locations</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-80">
                          {staff.assigned_zones?.length || 0} {staff.assigned_zones?.length === 1 ? "area" : "areas"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {staff.assigned_zones && staff.assigned_zones.length > 0 ? (
                          staff.assigned_zones.map((zone, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 font-mono text-[11px] font-semibold"
                            >
                              {zone}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] font-mono text-blue-400/60 italic">
                            No locations assigned
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Terminal Screen Routing Access Panel */}
                <div className="p-3 rounded-xl bg-[var(--surface-hi)]/60 border border-[var(--border)]/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                    <span className="tracking-wider uppercase">TERMINAL ROUTING ACCESS</span>
                    <span className="font-bold text-[var(--gold)]">
                      {staff.terminalAccess || "FULL_ADMIN"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-hi)]">
                    {staff.assignedScreen === "POS Counter" && (
                      <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    {staff.assignedScreen === "Kitchen (KDS)" && (
                      <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    {staff.assignedScreen === "Rider Dispatch" && (
                      <Bike className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    {staff.assignedScreen === "Full Admin" && (
                      <ShieldCheck className="w-4 h-4 text-[var(--gold)] shrink-0" />
                    )}
                    <span>{staff.assignedScreen || "Full Admin"}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Card Actions: Prominent [Edit Details] & [Delete] Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-4 mt-3 border-t border-[var(--border)]/60">
                <button
                  type="button"
                  onClick={() => handleStartEditStaff(staff)}
                  className="py-2.5 px-3 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-hi)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-all cursor-pointer font-sans text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStaffToDelete(staff)}
                  className="py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 transition-all cursor-pointer font-sans text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}

