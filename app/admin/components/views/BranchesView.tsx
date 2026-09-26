"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Flame,
  Bike,
  Package,
  Users,
  Sliders,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  X,
  Search,
  ArrowUpRight,
  Mail,
  Lock,
  ChevronDown,
} from "lucide-react";
import { Branch, BranchData, ModuleFeature, PersonaRole } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { ALL_PAKISTAN_CITIES } from "../../../../lib/tenantStore";

interface BranchesViewProps {
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  persona?: PersonaRole;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  showToast: (msg: string) => void;
}

const DELEGATABLE_MODULES_DEF = [
  { id: "POS", label: "POS Counter & Billing", icon: Receipt },
  { id: "KITCHEN", label: "Kitchen Display (KDS)", icon: Flame },
  { id: "RIDER", label: "Rider & Courier Dispatch", icon: Bike },
  { id: "MENU", label: "Menu & Stock Inventory", icon: Package },
  { id: "STAFF", label: "Staff & Terminal Roles", icon: Users },
  { id: "ANALYTICS", label: "Sales Settlement & Audit", icon: TrendingUp },
];

export default function BranchesView({
  branches,
  setBranches,
  selectedBranchId,
  setSelectedBranchId,
  showToast,
}: BranchesViewProps) {
  const { user, isFranchiseOwner, addBranchToFranchise } = useAuth();
  if (!user) return null;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // New Branch Form state - default city to user's city
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchCity, setNewBranchCity] = useState(user.city || ALL_PAKISTAN_CITIES[0] || "Islamabad");
  const [newBranchAddress, setNewBranchAddress] = useState("");

  useEffect(() => {
    if (user.city) {
      setNewBranchCity(user.city);
    }
  }, [user.city]);
  const [newBranchManager, setNewBranchManager] = useState("");
  const [newBranchEmail, setNewBranchEmail] = useState("");
  const [newBranchPassword, setNewBranchPassword] = useState("");
  const [newBranchPhone, setNewBranchPhone] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(["POS", "KITCHEN"]);

  // RULE: Only show checkboxes for features that Super Admin enabled for this Franchise!
  const normalizedUserFeatures = (user.assignedFeatures || []).map((f) => f.toUpperCase());
  const delegatableModules = DELEGATABLE_MODULES_DEF.filter((m) =>
    normalizedUserFeatures.includes(m.id)
  );

  const toggleFeature = (modId: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(modId) ? prev.filter((m) => m !== modId) : [...prev, modId]
    );
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newBranchName.trim();
    const trimmedAddress = newBranchAddress.trim();
    const trimmedEmail = newBranchEmail.trim();
    const trimmedPassword = newBranchPassword.trim();
    const trimmedManager = newBranchManager.trim();

    if (!trimmedName || !trimmedAddress) {
      showToast("Please enter both branch name and physical address.");
      return;
    }

    if (!trimmedEmail) {
      showToast("Branch Manager email is required to create Branch Admin user.");
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      showToast("Branch Manager password must be at least 6 characters long.");
      return;
    }

    const cityCode = newBranchCity.substring(0, 3).toUpperCase();
    const branchCode = `${cityCode}-${Math.floor(10 + Math.random() * 90)}`;

    const newBranch: Branch = {
      id: `branch_${Date.now()}`,
      name: trimmedName,
      code: branchCode,
      city: newBranchCity,
      address: trimmedAddress,
      status: "ACTIVE",
      todaySales: 0,
      activeOrders: 0,
      rating: 5.0,
      phone: newBranchPhone.trim() || user.phone || "+92 300 0000000",
      managerName: trimmedManager || "Branch Manager",
      managerEmail: trimmedEmail,
      assignedFeatures: selectedFeatures,
      assignedModules: selectedFeatures.map((f) => f.toLowerCase() as ModuleFeature),
      organizationId: user.organizationId || user.id,
    };

    // Register via AuthContext (saves to franchise branches + generates BRANCH_ADMIN account)
    addBranchToFranchise(newBranch, trimmedPassword);

    // Update local state in view
    setBranches((prev) => [...prev, newBranch]);

    setIsAddModalOpen(false);
    setNewBranchName("");
    setNewBranchAddress("");
    setNewBranchManager("");
    setNewBranchEmail("");
    setNewBranchPassword("");
    setNewBranchPhone("");
    setSelectedFeatures(["POS", "KITCHEN"]);

    showToast(
      `Outlet "${newBranch.name}" created. Branch Admin account activated for ${trimmedEmail}.`
    );
  };

  // Filter branches based on search
  const displayedBranches = branches.filter((b) => {
    if (b.id === "all") return false;
    if (
      searchQuery &&
      !b.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !b.city.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !b.code.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !b.managerEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const totalNetworkSales = branches
    .filter((b) => b.id !== "all")
    .reduce((acc, b) => acc + (b.todaySales || 0), 0);

  const totalActiveOrders = branches
    .filter((b) => b.id !== "all")
    .reduce((acc, b) => acc + (b.activeOrders || 0), 0);

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            {isFranchiseOwner ? "• BRANCH NETWORK MANAGEMENT" : "• OUTLET OPERATIONAL HUB"}
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            {isFranchiseOwner ? (
              <>
                Restaurant Outlets &amp;{" "}
                <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                  Branch Network
                </span>
              </>
            ) : (
              <>
                Branch Operational{" "}
                <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
                  Hub
                </span>
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] font-medium mt-1">
            {isFranchiseOwner
              ? "Provision new branches and selectively allocate features (POS, Kitchen, Rider, Inventory)."
              : "View your branch credentials, active features, and local operational health."}
          </p>
        </div>

        {/* Action Button: Add Branch (for Franchiser) */}
        {isFranchiseOwner && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-gold animate-sheen px-4 py-2.5 text-xs font-bold cursor-pointer inline-flex items-center gap-2 shrink-0 self-start sm:self-auto rounded-xl shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Provision New Branch</span>
          </button>
        )}
      </div>

      {/* KPI Overview for Franchiser */}
      {isFranchiseOwner && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Card 1: Network Sales */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] font-mono text-[11px] font-bold border border-[var(--gold)]/30">
                <ArrowUpRight className="w-3 h-3" /> +14.8% mo
              </span>
            </div>
            <div>
              <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--gold)] tracking-tight">
                Rs {totalNetworkSales.toLocaleString()}
              </div>
              <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                Consolidated Network Sales
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
              <span>Across {displayedBranches.length} active branches</span>
              <span className="text-[#25d366]">All branches reporting</span>
            </div>
          </div>

          {/* Card 2: Active Orders */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/30 text-[var(--orange)] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--orange-dim)] text-[var(--orange)] font-mono text-[11px] font-bold border border-[var(--orange)]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] animate-pulse" /> Live Orders
              </span>
            </div>
            <div>
              <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                {totalActiveOrders}
              </div>
              <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                Active Network Tickets
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
              <span>POS &amp; Kitchens real-time</span>
              <span className="text-[var(--orange)]">Peak hours active</span>
            </div>
          </div>

          {/* Card 3: Staff & Outlets */}
          <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#25d366]/15 border border-[#25d366]/30 text-[#25d366] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] font-mono text-[11px] font-bold border border-[#25d366]/30">
                28 Staff
              </span>
            </div>
            <div>
              <div className="font-mono font-extrabold text-3xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
                {displayedBranches.length} Outlets
              </div>
              <p className="font-sans text-xs font-medium text-[var(--text-lo)] mt-1">
                Active Operating Terminals
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 text-[10px] font-mono text-[var(--text-faint)] flex items-center justify-between">
              <span>12 Cashiers • 10 Chefs • 6 Riders</span>
              <span className="text-[var(--gold)]">Full delegation</span>
            </div>
          </div>
        </section>
      )}

      {/* Search & Filter Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text"
          placeholder="Search branches by name, city, or outlet code"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-full pl-10 pr-4 py-2 text-xs sm:text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner"
        />
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {displayedBranches.map((branch) => {
          const isSelected = branch.id === selectedBranchId;
          return (
            <div
              key={branch.id}
              className={`glass-panel p-5 sm:p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between gap-5 group ${
                isSelected
                  ? "border-[var(--gold)] shadow-xl shadow-[var(--gold-glow)]/10"
                  : "border-[var(--border)] hover:border-[var(--gold)]/40 hover:bg-[var(--surface)]"
              }`}
            >
              <div className="space-y-4">
                {/* Branch Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center font-mono font-black text-xs border border-[var(--gold)]/30 shrink-0 group-hover:scale-105 transition-transform">
                      {branch.code.substring(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display font-black text-base text-[var(--text-hi)] group-hover:text-[var(--gold)] transition-colors">
                          {branch.name.replace(/frenchis\w*|franchis\w*/gi, "").trim() || "Branch Outlet"}
                        </h3>
                        {branch.isHq && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--gold)] text-[#342c14] font-black uppercase">
                            HQ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[var(--text-faint)] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-[var(--gold)]" />
                        {branch.address}, {branch.city}
                      </p>
                    </div>
                  </div>

                  {/* Status indicator */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                      branch.status === "open"
                        ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30"
                        : branch.status === "rush"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-red-500/15 text-red-400 border border-red-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        branch.status === "open"
                          ? "bg-[#25d366] animate-pulse"
                          : branch.status === "rush"
                          ? "bg-amber-400"
                          : "bg-red-400"
                      }`}
                    />
                    {branch.status}
                  </span>
                </div>

                {/* Sales & Orders Stats */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--surface-hi)]/40 border border-[var(--border)]/60 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[var(--text-faint)] uppercase block">
                      TODAY'S REVENUE
                    </span>
                    <span className="text-sm font-bold text-[var(--gold)]">
                      Rs {(branch.todaySales || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-faint)] uppercase block">
                      ACTIVE TICKETS
                    </span>
                    <span className="text-sm font-bold text-[var(--text-hi)]">
                      {branch.activeOrders} in Kitchen
                    </span>
                  </div>
                </div>

                {/* Manager, Email & Phone */}
                <div className="text-xs space-y-1 text-[var(--text-lo)] font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] text-[var(--text-faint)]">Branch Manager:</span>
                    <span className="font-semibold text-[var(--text-hi)]">{branch.managerName}</span>
                  </div>
                  {branch.managerEmail && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] text-[var(--text-faint)]">Manager Email:</span>
                      <span className="text-[var(--gold)] truncate max-w-[180px]">{branch.managerEmail}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] text-[var(--text-faint)]">Direct Phone:</span>
                    <span>{branch.phone}</span>
                  </div>
                </div>

                {/* Allocated Modular Features */}
                <div className="space-y-1.5 pt-2 border-t border-[var(--border)]/60">
                  <span className="text-[10px] font-mono text-[var(--text-faint)] uppercase font-bold tracking-wider block">
                    DELEGATED MODULES:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {((branch.assignedFeatures && branch.assignedFeatures.length > 0)
                      ? branch.assignedFeatures
                      : (branch.assignedModules || [])
                    ).map((mod) => (
                      <span
                        key={mod}
                        className="px-2 py-0.5 rounded-lg bg-[var(--surface-hi)] border border-[var(--border)] text-[10px] font-mono font-bold text-[var(--gold)] flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>{mod.toUpperCase()}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Action */}
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]/40">
                <button
                  onClick={() => {
                    setSelectedBranchId(branch.id);
                    showToast(`Switched active context to ${branch.name.replace(/frenchis\w*|franchis\w*/gi, "").trim() || "Branch"}`);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? "btn-gold text-[#342c14] shadow-md"
                      : "bg-[var(--surface-hi)] text-[var(--text-hi)] hover:border-[var(--gold)]/40 border border-[var(--border)]"
                  }`}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Currently Active</span>
                    </>
                  ) : (
                    <span>Manage Branch Scope</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Provision New Branch Modal */}
      {isAddModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl sm:rounded-3xl w-full max-w-lg p-5 sm:p-7 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-[var(--text-hi)]">
                    Provision New Branch Outlet
                  </h3>
                  <p className="text-[11px] font-mono text-[var(--text-faint)]">
                    Configure outlet profile and assign operational permissions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-lo)] hover:text-[var(--text-hi)] flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                  Branch Outlet Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gulberg III Flagship"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    City
                  </label>
                  <div className="relative">
                    <select
                      value={newBranchCity}
                      onChange={(e) => setNewBranchCity(e.target.value)}
                      className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-[var(--text-hi)] appearance-none cursor-pointer focus:outline-none transition-all font-sans"
                    >
                      {ALL_PAKISTAN_CITIES.map((c) => (
                        <option key={c} value={c} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[var(--text-faint)] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Manager Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter manager full name"
                    value={newBranchManager}
                    onChange={(e) => setNewBranchManager(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    required
                  />
                </div>
              </div>

              {/* Branch Admin Credentials (Email & Password) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--surface-hi)]/40 border border-[var(--border)]">
                <div>
                  <label className="block text-xs font-medium text-[var(--gold)] mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3 h-3" />
                    <span>Manager Login Email <span className="text-red-400">*</span></span>
                  </label>
                  <input
                    type="email"
                    placeholder="manager@restaurant.com"
                    value={newBranchEmail}
                    onChange={(e) => setNewBranchEmail(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--gold)] mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    <span>Manager Password <span className="text-red-400">*</span></span>
                  </label>
                  <input
                    type="password"
                    placeholder="Min. 6 characters"
                    value={newBranchPassword}
                    onChange={(e) => setNewBranchPassword(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Physical Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Street, Block, Area"
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-lo)] mb-1.5">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+92 300 1234567"
                    value={newBranchPhone}
                    onChange={(e) => setNewBranchPhone(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)]/60 focus:ring-1 focus:ring-[var(--gold)]/30 rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)]/40 focus:outline-none transition-all font-sans"
                  />
                </div>
              </div>

              {/* Strict Modular Feature Allocation Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[var(--text-hi)] text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Delegate Features to this Branch</span>
                  </label>
                  <span className="text-[11px] text-[var(--text-faint)] font-mono">
                    {selectedFeatures.length} selected
                  </span>
                </div>

                {delegatableModules.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {delegatableModules.map((m) => {
                      const isChecked = selectedFeatures.includes(m.id);
                      const Icon = m.icon;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => toggleFeature(m.id)}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            isChecked
                              ? "bg-[var(--gold-dim)] border-[var(--gold)]/40 text-[var(--gold)] font-bold shadow-xs"
                              : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-lo)] hover:bg-[var(--surface-hi)]"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isChecked
                                ? "bg-[var(--gold)] border-[var(--gold)] text-[#342c14]"
                                : "border-[var(--border-hi)]"
                            }`}
                          >
                            {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate text-xs">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>No modular features assigned by Super Admin. Contact Super Admin to enable modules for this restaurant.</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--surface)] text-[var(--text-lo)] hover:text-[var(--text-hi)] border border-[var(--border)] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-md inline-flex items-center gap-2 hover:scale-[1.02] transition-transform"
                >
                  <span>Create &amp; Provision</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
