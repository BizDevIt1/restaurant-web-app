"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  UserCheck,
  ShieldCheck,
  Receipt,
  Flame,
  Bike,
  UtensilsCrossed,
  Building2,
  Clock,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  ChevronDown,
  MapPin,
  X,
} from "lucide-react";
import { StaffMember } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface StaffProvisioningViewProps {
  initialData?: StaffMember | null;
  mode?: "add" | "edit";
  onCancel: () => void;
  onSuccess: (member: StaffMember) => void;
  showToast: (msg: string) => void;
}

export default function StaffProvisioningView({
  initialData,
  mode = "add",
  onCancel,
  onSuccess,
  showToast,
}: StaffProvisioningViewProps) {
  const { user } = useAuth();

  // Helper to extract numeric restaurant ID for PostgreSQL BIGINT
  const parseNumericId = (id?: string | number): number => {
    if (!id) return 27;
    if (typeof id === "number") return id;
    const digits = String(id).replace(/[^0-9]/g, "");
    return digits ? parseInt(digits, 10) : 27;
  };

  const availableBranches =
    user?.branches && user.branches.length > 0
      ? user.branches
      : [
          {
            id: user?.branchId || "main",
            name: user?.branchName || user?.restaurantName || "Main Outlet",
            city: user?.city || "",
          },
        ];

  // Form State
  const [role, setRole] = useState<"manager" | "cashier" | "chef" | "rider" | "waiter">(
    initialData?.role || "cashier"
  );
  const [fullName, setFullName] = useState(initialData?.name || "");
  const [phone, setPhone] = useState(initialData?.phone || "+92 ");
  const [selectedBranchName, setSelectedBranchName] = useState(
    initialData?.branchName || availableBranches[0]?.name || "Main Outlet"
  );

  // Section 2: Shift and Role-Specific Metadata
  const [shift, setShift] = useState<string>(initialData?.shift || "Evening Rush");
  const [cashDrawer, setCashDrawer] = useState("Counter 01");
  const [kitchenStation, setKitchenStation] = useState("Hot Kitchen / Grills");
  const [vehiclePlate, setVehiclePlate] = useState("Bike - LEA 4920");
  const [assignedZones, setAssignedZones] = useState<string[]>(
    Array.isArray(initialData?.assigned_zones) ? initialData.assigned_zones : []
  );
  const [zoneInput, setZoneInput] = useState<string>("");

  const handleAddZone = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = zoneInput.trim().replace(/^,+|,+$/g, "");
    if (!trimmed) return;
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    const updated = [...assignedZones];
    parts.forEach((p) => {
      if (!updated.some((z) => z.toLowerCase() === p.toLowerCase())) {
        updated.push(p);
      }
    });
    setAssignedZones(updated);
    setZoneInput("");
  };

  const handleRemoveZone = (indexToRemove: number) => {
    setAssignedZones(assignedZones.filter((_, idx) => idx !== indexToRemove));
  };
  const [departmentScope, setDepartmentScope] = useState("Full Operations");
  const [tableStation, setTableStation] = useState("Main Dining Hall");

  // Section 3: Credentials
  const [email, setEmail] = useState(initialData?.email || "");
  const [password, setPassword] = useState(initialData?.password || "");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-derived Terminal Routing & Screen details
  const getTerminalDetails = (selectedRole: "manager" | "cashier" | "chef" | "rider" | "waiter") => {
    switch (selectedRole) {
      case "chef":
        return {
          terminalAccess: "KDS_ONLY" as const,
          screenName: "Kitchen (KDS)" as const,
          displayLabel: "Kitchen Display Terminal (KDS)",
          description: "Staff is automatically routed to the kitchen queue terminal with dedicated prep ticket controls.",
          badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: Flame,
          path: "/kitchen",
        };
      case "rider":
        return {
          terminalAccess: "RIDER_ONLY" as const,
          screenName: "Rider Dispatch" as const,
          displayLabel: "Rider Delivery Fleet Terminal",
          description: "Staff is automatically routed to delivery dispatch console for live parcel assignments.",
          badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          icon: Bike,
          path: "/dispatch",
        };
      case "manager":
        return {
          terminalAccess: "FULL_ADMIN" as const,
          screenName: "Full Admin" as const,
          displayLabel: "Full Management Portal",
          description: "Staff receives complete administration dashboard access including analytics, billing, and settings.",
          badgeColor: "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30",
          icon: ShieldCheck,
          path: "/admin",
        };
      case "waiter":
        return {
          terminalAccess: "POS_ONLY" as const,
          screenName: "POS Counter" as const,
          displayLabel: "POS Floor / Table Ordering Station",
          description: "Staff is automatically routed to POS table-side ordering terminal.",
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: UtensilsCrossed,
          path: "/pos",
        };
      case "cashier":
      default:
        return {
          terminalAccess: "POS_ONLY" as const,
          screenName: "POS Counter" as const,
          displayLabel: "POS Billing Counter",
          description: "Staff is automatically routed to dedicated checkout register with locked management settings.",
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: Receipt,
          path: "/pos",
        };
    }
  };

  const activeTerminal = getTerminalDetails(role);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedName) {
      showToast("Please enter staff member full name.");
      return;
    }
    if (!trimmedPhone || trimmedPhone.length < 8) {
      showToast("Please enter a valid phone number.");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      showToast("Please enter a valid login email address.");
      return;
    }
    if (mode === "add" && (!trimmedPassword || trimmedPassword.length < 4)) {
      showToast("Password must be at least 4 characters.");
      return;
    }

    setIsSubmitting(true);
    const matchedBranch = availableBranches.find((b) => b.name === selectedBranchName);
    const localBranchId = matchedBranch?.id || user?.branchId || null;

    try {
      const supabase = createClient();
      const { restId, branchId: resolvedBranchId } = await getValidTenantContext(user);
      const targetBranchId = resolvedBranchId || localBranchId || null;

      if (mode === "add") {
        let createdStaffId = `staff_${Date.now()}`;

        const insertPayload: any = {
          restaurant_id: restId,
          branch_id: targetBranchId ? String(targetBranchId) : null,
          branch_name: selectedBranchName || "Main Branch",
          full_name: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          password_hash: trimmedPassword,
          role: role,
          terminal_access: activeTerminal.terminalAccess,
          shift: shift,
          status: "active",
          assigned_zones: role === "rider" ? assignedZones : [],
        };

        let { data, error } = await supabase
          .from("staff_members")
          .insert([insertPayload])
          .select()
          .single();

        if (error && (error.message?.includes("assigned_zones") || error.message?.includes("max_delivery_radius_km"))) {
          delete insertPayload.assigned_zones;
          delete insertPayload.max_delivery_radius_km;
          const retry = await supabase
            .from("staff_members")
            .insert([insertPayload])
            .select()
            .single();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error("[StaffProvisioning] Supabase insert error:", error);
          if (error.code === "23505" || error.message?.includes("unique")) {
            showToast("A staff member with this email already exists.");
            setIsSubmitting(false);
            return;
          }
          showToast(`Error creating staff: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        if (data) {
          createdStaffId = data.id;
        }

        const newStaff: StaffMember = {
          id: createdStaffId,
          name: trimmedName,
          email: trimmedEmail,
          password: trimmedPassword,
          role: role,
          branchId: targetBranchId ? String(targetBranchId) : "main",
          branchName: selectedBranchName,
          phone: trimmedPhone,
          shift: shift as any,
          status: "active",
          terminalAccess: activeTerminal.terminalAccess,
          assignedScreen: activeTerminal.screenName,
          avatar: trimmedName.substring(0, 2).toUpperCase(),
          joinedDate: "Today",
          assigned_zones: role === "rider" ? assignedZones : [],
        };

        showToast(`Staff member "${newStaff.name}" registered successfully with ${activeTerminal.displayLabel}.`);
        onSuccess(newStaff);
      } else if (mode === "edit" && initialData) {
        const updatePayload: any = {
          full_name: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          role: role,
          terminal_access: activeTerminal.terminalAccess,
          branch_name: selectedBranchName,
          branch_id: targetBranchId ? String(targetBranchId) : null,
          shift: shift,
          assigned_zones: role === "rider" ? assignedZones : [],
        };

        if (trimmedPassword) {
          updatePayload.password_hash = trimmedPassword;
        }

        let { error } = await supabase
          .from("staff_members")
          .update(updatePayload)
          .eq("id", initialData.id);

        if (error && (error.message?.includes("assigned_zones") || error.message?.includes("max_delivery_radius_km"))) {
          delete updatePayload.assigned_zones;
          delete updatePayload.max_delivery_radius_km;
          const retry = await supabase
            .from("staff_members")
            .update(updatePayload)
            .eq("id", initialData.id);
          error = retry.error;
        }

        if (error) {
          console.error("[StaffProvisioning] Supabase update error:", error);
          showToast(`Error updating profile: ${error.message}`);
          setIsSubmitting(false);
          return;
        }

        const updatedStaff: StaffMember = {
          ...initialData,
          name: trimmedName,
          email: trimmedEmail,
          password: trimmedPassword || initialData.password,
          role: role,
          branchId: targetBranchId ? String(targetBranchId) : "main",
          branchName: selectedBranchName,
          phone: trimmedPhone,
          shift: shift as any,
          terminalAccess: activeTerminal.terminalAccess,
          assignedScreen: activeTerminal.screenName,
          assigned_zones: role === "rider" ? assignedZones : [],
        };

        showToast(`Staff profile for "${updatedStaff.name}" updated successfully.`);
        onSuccess(updatedStaff);
      }
    } catch (err: any) {
      console.error("[StaffProvisioning] Exception:", err);
      showToast("An unexpected error occurred while saving staff details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ROLES_LIST: Array<{
    id: "cashier" | "chef" | "rider" | "waiter" | "manager";
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: "cashier",
      label: "Cashier",
      sublabel: "POS Checkout & Bills",
      icon: Receipt,
    },
    {
      id: "chef",
      label: "Chef / Cook",
      sublabel: "Kitchen KDS Queue",
      icon: Flame,
    },
    {
      id: "rider",
      label: "Delivery Rider",
      sublabel: "Dispatch & Fleet",
      icon: Bike,
    },
    {
      id: "waiter",
      label: "Waiter / Server",
      sublabel: "Table-side Orders",
      icon: UtensilsCrossed,
    },
    {
      id: "manager",
      label: "Manager",
      sublabel: "Full Operations",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto p-3.5 sm:p-6 lg:p-8 space-y-6 pb-12 animate-in fade-in duration-200 select-none">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Navigation Breadcrumb / Back Action */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--gold)] text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-all cursor-pointer shadow-sm font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Staff Roster</span>
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-faint)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span>Role-Based Automated Terminal Routing</span>
          </div>
        </div>

        {/* Page Title Header */}
        <div className="border-b border-[var(--border)] pb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
            <UserCheck className="w-3.5 h-3.5" />
            <span>STAFF PROVISIONING &amp; ACCESS</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black font-display tracking-tight text-[var(--text-hi)]">
            {mode === "add" ? (
              <>
                Staff Provisioning &amp;{" "}
                <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                  Onboarding
                </span>
              </>
            ) : (
              <>
                Edit Staff{" "}
                <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                  Profile
                </span>
              </>
            )}
          </h1>
          <p className="text-xs text-[var(--text-lo)] font-mono mt-1">
            Register operational restaurant personnel. The system automatically provisions secure terminal screens and permissions based on operational roles.
          </p>
        </div>

        {/* Main Provisioning Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ========================================================================= */}
          {/* SECTION 1: CORE IDENTITY & PRIMARY ROLE */}
          {/* ========================================================================= */}
          <div className="glass-panel rounded-2xl border border-[var(--border)] p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 border-b border-[var(--border)]/70 pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center font-bold font-mono text-xs">
                01
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-hi)] uppercase font-mono tracking-wide">
                  Core Identity &amp; Operational Role
                </h2>
              </div>
            </div>

            {/* Role Selector: Mobile & Tablet Dropdown (< 1024px) / Desktop Grid (>= 1024px) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                  Primary Operational Role *
                </label>
                <span className="lg:hidden text-[10.5px] font-mono text-[var(--gold)]">
                  {ROLES_LIST.find((r) => r.id === role)?.sublabel}
                </span>
              </div>

              {/* Mobile & Tablet Dropdown (< 1024px) */}
              <div className="lg:hidden w-full relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full appearance-none bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-[var(--gold)] text-xs rounded-xl pl-3.5 pr-10 py-2.5 font-bold cursor-pointer shadow-sm font-mono"
                >
                  {ROLES_LIST.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[var(--bg-deep)] text-[var(--text-hi)] font-sans">
                      {r.label} — {r.sublabel}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[var(--gold)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Desktop Role Pill Grid (>= 1024px) */}
              <div className="hidden lg:grid lg:grid-cols-5 gap-3">
                {ROLES_LIST.map((r) => {
                  const Icon = r.icon;
                  const isSelected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`flex flex-col items-center text-center p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[var(--gold-dim)] border-[var(--gold)] text-[var(--gold)] shadow-md shadow-black/20"
                          : "bg-[var(--surface-hi)]/60 hover:bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-colors ${
                          isSelected
                            ? "bg-[var(--gold)] text-black"
                            : "bg-[var(--surface)] text-[var(--text-lo)] border border-[var(--border)]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold font-sans">{r.label}</span>
                      <span className="text-[10px] font-mono text-[var(--text-faint)] mt-0.5">
                        {r.sublabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Identity Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tariq Mehmood"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                  Contact Phone / WhatsApp *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <input
                    type="text"
                    placeholder="+92 300 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono shadow-inner"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                  Assigned Branch *
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <select
                    value={selectedBranchName}
                    onChange={(e) => setSelectedBranchName(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none transition-all cursor-pointer font-sans"
                  >
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name} {b.city ? `(${b.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: ROLE-SPECIFIC OPERATIONAL DETAILS */}
          {/* ========================================================================= */}
          <div className="glass-panel rounded-2xl border border-[var(--border)] p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 border-b border-[var(--border)]/70 pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center font-bold font-mono text-xs">
                02
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-hi)] uppercase font-mono tracking-wide">
                  Operational Schedule &amp; Station Assignment
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Shift Timing Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                  Operating Work Shift *
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none transition-all cursor-pointer font-sans"
                  >
                    <option value="Morning">Morning Shift (08:00 AM - 04:00 PM)</option>
                    <option value="Evening Rush">Evening Rush (04:00 PM - 12:00 AM)</option>
                    <option value="Night Owl">Night Owl (12:00 AM - 08:00 AM)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Meta Field According to Role */}
              {role === "cashier" && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                    Cash Drawer / Register Counter *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Counter 01 (Front Register)"
                    value={cashDrawer}
                    onChange={(e) => setCashDrawer(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono"
                  />
                </div>
              )}

              {role === "chef" && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                    Primary Kitchen Station *
                  </label>
                  <select
                    value={kitchenStation}
                    onChange={(e) => setKitchenStation(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none transition-all cursor-pointer font-sans"
                  >
                    <option value="Hot Kitchen / Grills">Hot Kitchen / Grills & Karahi</option>
                    <option value="Fryers & Fast Food">Fryers, Burgers & Fast Food</option>
                    <option value="Salad & Assembly">Salad, Appetizers & Assembly</option>
                    <option value="Beverages">Beverages, Shakes & Desserts</option>
                  </select>
                </div>
              )}

              {role === "rider" && (
                <>
                  <div className="space-y-1.5 animate-in fade-in duration-150">
                    <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                      Vehicle Type &amp; Registration Plate *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Honda 125 - LEA 4920"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-2 animate-in fade-in duration-150 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                        Assigned Delivery Locations / Areas
                      </label>
                      <span className="text-[10px] font-mono text-blue-400 font-semibold">
                        {assignedZones.length} {assignedZones.length === 1 ? "area" : "areas"} assigned
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MapPin className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                        <input
                          type="text"
                          placeholder="Type area/location name and press Enter..."
                          value={zoneInput}
                          onChange={(e) => setZoneInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              handleAddZone();
                            }
                          }}
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddZone()}
                        disabled={!zoneInput.trim()}
                        className="btn-gold px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 shrink-0 shadow-sm"
                      >
                        Add
                      </button>
                    </div>

                    {/* Chips rendering */}
                    <div className="pt-1">
                      {assignedZones.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-[var(--surface-hi)]/50 border border-[var(--border)]">
                          {assignedZones.map((zone, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono text-xs font-semibold"
                            >
                              <span>{zone}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveZone(idx)}
                                className="p-0.5 rounded hover:bg-blue-500/30 text-blue-300 hover:text-white cursor-pointer transition-colors"
                                aria-label={`Remove ${zone}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] font-mono text-[var(--text-faint)] italic px-1">
                          No locations assigned yet. Type custom area names above and press Enter.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {role === "manager" && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                    Management Scope *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Full Operations & Staff Oversight"
                    value={departmentScope}
                    onChange={(e) => setDepartmentScope(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono"
                  />
                </div>
              )}

              {role === "waiter" && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                    Assigned Dining Station *
                  </label>
                  <select
                    value={tableStation}
                    onChange={(e) => setTableStation(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none transition-all cursor-pointer font-sans"
                  >
                    <option value="Main Dining Hall">Main Dining Hall (Section A)</option>
                    <option value="Family Section">Family Section (Private Booths)</option>
                    <option value="Outdoor Patio">Outdoor Patio / Terrace</option>
                    <option value="VIP Executive Lounge">VIP Executive Lounge</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: SYSTEM ACCESS & LOGIN CREDENTIALS */}
          {/* ========================================================================= */}
          <div className="glass-panel rounded-2xl border border-[var(--border)] p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 border-b border-[var(--border)]/70 pb-3.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 flex items-center justify-center font-bold font-mono text-xs">
                03
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-hi)] uppercase font-mono tracking-wide">
                  System Access &amp; Terminal Credentials
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                  Staff Login Email *
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <input
                    type="email"
                    placeholder="staff.name@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono shadow-inner"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-hi)] font-mono uppercase tracking-wider block">
                  {mode === "add" ? "Temporary Login Password *" : "Login Password (Leave blank to keep unchanged)"}
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "add" ? "Minimum 4 characters" : "Unchanged"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-9 pr-10 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono shadow-inner"
                    required={mode === "add"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: ACTIONS */}
          {/* ========================================================================= */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold font-mono cursor-pointer transition-colors text-center"
            >
              Cancel / Back to Roster
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto btn-gold animate-sheen px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-lg inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] transition-transform"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isSubmitting ? "Saving..." : mode === "add" ? "Create Staff Account" : "Update Profile"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
