"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import {
  Sliders,
  ShieldCheck,
  Bell,
  Globe,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Save,
  Sparkles,
  RefreshCw,
  Building2,
  Database,
  SlidersHorizontal,
  KeyRound,
  ShieldAlert,
  Clock,
  Eye,
  EyeOff,
  Camera,
  Upload,
  ChevronDown,
  Check,
  X,
  DollarSign,
} from "lucide-react";
import { broadcastCurrencyUpdate, getPlatformCurrency, fetchLiveExchangeRate } from "@/lib/currency";

interface SettingsViewProps {
  showToast: (msg: string) => void;
}

const ADMIN_CACHE_KEY = "sa_admin_profile";

function getCachedAdmin(): { name?: string; email?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SettingsView({ showToast }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"general" | "notifications" | "platform">("general");

  // Hydration-safe State Initialization
  const [adminName, setAdminName] = useState("Super Admin");
  const [adminEmail, setAdminEmail] = useState("bizdevit.dm@gmail.com");
  const [currency, setCurrency] = useState<"USD" | "PKR">("USD");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [liveExchangeRate, setLiveExchangeRate] = useState(277.35);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  // Avatar Logo Upload State
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image file size must be under 5MB.");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setAdminAvatar(localUrl);

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      const finalUrl = data.url || localUrl;

      setAdminAvatar(finalUrl);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("sa_admin_avatar", finalUrl);
          window.dispatchEvent(new CustomEvent("sa_admin_avatar_updated", { detail: { avatarUrl: finalUrl } }));
          window.dispatchEvent(new Event("storage"));
        } catch {}
      }
      showToast("Profile logo updated in real-time!");
    } catch {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("sa_admin_avatar", localUrl);
          window.dispatchEvent(new CustomEvent("sa_admin_avatar_updated", { detail: { avatarUrl: localUrl } }));
          window.dispatchEvent(new Event("storage"));
        } catch {}
      }
      showToast("Profile logo updated!");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Password Management States
  const [currentPassword, setCurrentPassword] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sa_admin_current_password");
      if (saved && saved !== "admin123") return saved;
      try {
        localStorage.removeItem("sa_admin_current_password");
      } catch {}
    }
    return "";
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [hasAttemptedPasswordSubmit, setHasAttemptedPasswordSubmit] = useState(false);

  // Password Rules Checklist Validation
  const ruleLength = newPassword.length >= 8;
  const ruleUpper = /[A-Z]/.test(newPassword);
  const ruleLower = /[a-z]/.test(newPassword);
  const ruleNumber = /[0-9]/.test(newPassword);
  const ruleSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword);
  const ruleMatch = Boolean(newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword);
  const allPasswordRulesValid = ruleLength && ruleUpper && ruleLower && ruleNumber && ruleSpecial && ruleMatch;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allPasswordRulesValid) {
      setHasAttemptedPasswordSubmit(true);
      if (!newPassword.trim()) {
        showToast("Please enter a new password meeting all requirements.");
      } else if (!ruleMatch) {
        showToast("New password and confirm password do not match.");
      } else {
        showToast("Please satisfy all required password criteria highlighted in red.");
      }
      return;
    }

    setIsUpdatingPassword(true);

    try {
      // 1. Update password in backend API
      await fetch("/api/super-admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          password: newPassword,
        }),
      });

      // 2. Also update via Supabase Client
      try {
        const supabase = createClient();
        await supabase.auth.updateUser({
          password: newPassword,
          data: { current_password: newPassword },
        });
      } catch {}

      // 3. Update current password in state & localStorage
      setCurrentPassword(newPassword);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("sa_admin_current_password", newPassword);
        } catch {}
      }

      setNewPassword("");
      setConfirmPassword("");
      setHasAttemptedPasswordSubmit(false);
      showToast("Password updated successfully!");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to update password";
      showToast(`Error: ${errMsg}`);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Notification Toggles
  const [emailAlerts, setEmailAlerts] = useState({
    newVendors: true,
    franchiseBilling: true,
    systemOutages: true,
    dailyDigest: false,
  });

  // Background sync with Supabase Auth & Settings API (caches immediately for zero delay on tab switch)
  useEffect(() => {
    try {
      const savedAvatar = localStorage.getItem("sa_admin_avatar");
      if (savedAvatar) setAdminAvatar(savedAvatar);
      const savedCurrency = localStorage.getItem("sa_platform_currency");
      if (savedCurrency === "PKR" || savedCurrency === "USD") {
        setCurrency(savedCurrency);
      }
      const savedSymbol = localStorage.getItem("sa_platform_currency_symbol");
      if (savedSymbol) {
        setCurrencySymbol(savedSymbol);
      }
      const savedPassword = localStorage.getItem("sa_admin_current_password");
      if (savedPassword && savedPassword !== "admin123") {
        setCurrentPassword(savedPassword);
      } else {
        try {
          localStorage.removeItem("sa_admin_current_password");
        } catch {}
        setCurrentPassword("");
      }
    } catch {}

    // Fetch live rate on mount to keep display fresh
    fetchLiveExchangeRate().then((rate) => {
      setLiveExchangeRate(rate);
    });

    async function loadAdminUser() {
      try {
        const cached = getCachedAdmin();
        if (cached?.name) setAdminName(cached.name);
        if (cached?.email) setAdminEmail(cached.email);

        // Fetch from API route
        try {
          const res = await fetch("/api/super-admin/settings");
          if (res.ok) {
            const data = await res.json();
            if (data.name) setAdminName(data.name);
            if (data.email) setAdminEmail(data.email);
            if (data.avatar_url) setAdminAvatar(data.avatar_url);
            if (data.current_password && data.current_password !== "admin123") {
              setCurrentPassword(data.current_password);
              try {
                localStorage.setItem("sa_admin_current_password", data.current_password);
              } catch {}
            }
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ name: data.name || "Super Admin", email: data.email || "bizdevit.dm@gmail.com" }));
              } catch {}
            }
          }
        } catch {}

        // Fetch from Supabase client
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
          const email = user.email;
          const name = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;
          const userPass = user.user_metadata?.current_password || user.user_metadata?.password || user.user_metadata?.plain_password || user.user_metadata?.admin_password;
          setAdminEmail(email);
          if (name) {
            setAdminName(name);
          }
          if (userPass && userPass !== "admin123") {
            setCurrentPassword(userPass);
            try {
              localStorage.setItem("sa_admin_current_password", userPass);
            } catch {}
          }
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ name: name || adminName, email }));
            } catch {}
          }
        }
      } catch (err) {
        console.error("Error fetching super admin user:", err);
      }
    }
    loadAdminUser();
  }, []);

  // Close currency dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(event.target as Node)) {
        setIsCurrencyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Save Super Admin Name in Real-Time to Database
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = adminName.trim();
    if (!trimmedName) {
      showToast("Super admin name cannot be empty.");
      return;
    }

    setIsSavingProfile(true);
    try {
      // 1. Direct Supabase Auth user metadata update
      try {
        const supabase = createClient();
        await supabase.auth.updateUser({
          data: {
            full_name: trimmedName,
            name: trimmedName,
            display_name: trimmedName,
          },
        });
      } catch (authErr) {
        console.warn("Supabase Auth user update warning:", authErr);
      }

      // 2. Server API Route update
      try {
        await fetch("/api/super-admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            email: adminEmail,
            avatar_url: adminAvatar,
          }),
        });
      } catch (apiErr) {
        console.warn("Settings API update warning:", apiErr);
      }

      // 3. Update localStorage & broadcast events for instant reactivity across all tabs
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ name: trimmedName, email: adminEmail }));
          window.dispatchEvent(new CustomEvent("sa_admin_profile_updated", { detail: { name: trimmedName } }));
          window.dispatchEvent(new Event("storage"));
        } catch {}
      }

      showToast("Super Admin name updated in real-time!");
    } catch (err: any) {
      showToast(err.message || "Failed to update super admin name.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveCurrency = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingCurrency(true);
    try {
      let liveRate = 1;
      if (currency === "PKR") {
        liveRate = await fetchLiveExchangeRate();
        setLiveExchangeRate(liveRate);
      }

      // 1. Broadcast immediately in real-time across current tab and all open windows/tabs
      broadcastCurrencyUpdate(currency, currencySymbol, liveRate);

      // 2. Persist to Supabase backend API
      try {
        await fetch("/api/super-admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currency,
            currency_symbol: currencySymbol,
            currency_rate: liveRate,
          }),
        });
      } catch (apiErr) {
        console.warn("Settings API currency update warning:", apiErr);
      }

      showToast(
        currency === "PKR"
          ? `Platform currency saved to PKR (${currencySymbol}) at live rate 1 USD ≈ ${liveRate.toFixed(2)} PKR!`
          : `Platform currency saved to USD (${currencySymbol}) in real-time!`
      );
    } catch {
      showToast("Currency settings saved!");
    } finally {
      setIsSavingCurrency(false);
    }
  };

  const tabs = [
    { id: "general", label: "General Settings", icon: SlidersHorizontal },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "platform", label: "Platform Defaults", icon: Globe },
  ] as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ===================== PAGE HEADING & TAB NAVIGATION ===================== */}
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot"></span>
            Super Admin Control Center
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-[var(--text-hi)] tracking-tight">
            System & Account <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">Settings</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
            Manage your master administrator profile, core system defaults, and global platform configurations.
          </p>
        </div>

        {/* Tab Buttons Row (Placed directly below description, no horizontal scroll, clean distinct button UI) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-1.5 rounded-2xl bg-[var(--surface-hi)]/80 border border-[var(--border)] w-fit max-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none ${
                  isActive
                    ? "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-sm shadow-[var(--gold-glow)]"
                    : "text-[var(--text-lo)] hover:text-[var(--text-hi)] hover:bg-[var(--bg-deep)]/70 border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[var(--gold)]" : "text-[var(--text-faint)]"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== MAIN TAB CONTENT ===================== */}
      {activeTab === "general" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="space-y-6">
            {/* Card 1: Master Profile & Uneditable Email Section */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 border border-[var(--border-hi)] relative overflow-hidden">
              {/* Centered Profile Header with Enlarged Clickable Avatar for Logo Upload */}
              <div className="flex flex-col items-center justify-center text-center pb-6 border-b border-[var(--border)] space-y-3">
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  className="hidden"
                />

                {/* Enlarged Avatar styled same as header with squircle rounded-2xl + Click to Upload */}
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  title="Click to upload profile photo / logo in real-time"
                  className="relative group cursor-pointer"
                >
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[var(--surface-hi)] border-2 border-white/40 shadow-xl overflow-hidden flex items-center justify-center relative transition-transform duration-200 group-hover:scale-105 select-none">
                    {adminAvatar ? (
                      <img
                        src={adminAvatar}
                        alt="Super Admin Profile"
                        className="w-full h-full object-cover"
                        onError={() => setAdminAvatar(null)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#f5c85c] to-[#e04e17] text-[#342c14] font-black text-3xl sm:text-4xl flex items-center justify-center">
                        SA
                      </div>
                    )}

                    {/* Hover Camera Overlay */}
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1">
                      <Camera className="w-6 h-6 text-[var(--gold)]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">Upload Logo</span>
                    </div>

                    {/* Uploading Spinner */}
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-[var(--gold)] gap-1">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span className="text-[9px] font-bold">Uploading...</span>
                      </div>
                    )}
                  </div>

                  {/* Camera Badge Icon on bottom-right */}
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--gold)] text-[#342c14] flex items-center justify-center shadow-lg border-2 border-[var(--bg-deep)] group-hover:scale-110 transition-transform">
                    <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                </div>

                {/* Super Admin Label placed directly underneath SA avatar */}
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[var(--surface-hi)] border border-[var(--border)] text-xs font-semibold text-[var(--text-hi)] select-none">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#25d366]" />
                  <span>Super Admin</span>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Super Admin Name (Editable & Real-Time DB Synced) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Super Admin Name</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Super Admin"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-sm text-[var(--text-hi)] font-medium focus:outline-none transition-all placeholder-[var(--text-faint)]"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-faint)] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                    <span>Real-time database updated administrator name.</span>
                  </p>
                </div>

                {/* 2. Super Admin Email - NON-EDITABLE AS REQUESTED */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Super Admin Email Address</span>
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md select-none">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Non-Editable</span>
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="email"
                      value={adminEmail}
                      readOnly
                      disabled
                      title="This primary email is bound to the root Super Admin account and cannot be modified."
                      className="w-full pl-10 pr-24 py-3 rounded-xl bg-[var(--bg-deep)]/80 border border-[var(--border)] text-sm text-[var(--text-hi)] font-mono opacity-80 cursor-not-allowed select-none focus:outline-none shadow-inner"
                    />
                    <Lock className="w-4 h-4 text-[var(--gold)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--text-faint)] select-none">
                      Locked
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--text-faint)] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
                    <span>Primary account email is permanently bound to your master administrator identity.</span>
                  </p>
                </div>
              </div>

              {/* Small Save Button directly below both inputs */}
              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="btn-gold px-4 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-[var(--gold-glow)] hover:scale-105 active:scale-95 transition-all disabled:opacity-60"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card 2: Platform Localization */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 border border-[var(--border-hi)]">
              <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/30">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--text-hi)]">Platform Localization</h3>
                  <p className="text-xs text-[var(--text-lo)]">Configure default system currency and display symbols.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                {/* 1. Custom Currency Dropdown (USD & PKR) */}
                <div className="space-y-1.5 relative flex-1" ref={currencyDropdownRef}>
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Default Currency</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                      className="w-full flex items-center justify-between bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-sm text-[var(--text-hi)] cursor-pointer text-left transition-all hover:border-[var(--border-hi)]"
                    >
                      <span className="truncate font-semibold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--gold)]"></span>
                        {currency === "USD" ? "USD ($) — US Dollar" : "PKR (Rs.) — Pakistani Rupee"}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--text-lo)] transition-transform duration-200 ${
                          isCurrencyDropdownOpen ? "rotate-180 text-[var(--gold)]" : ""
                        }`}
                      />
                    </button>

                    {isCurrencyDropdownOpen && (
                      <div className="absolute left-0 top-[calc(100%+6px)] w-full bg-[var(--bg-deep)] border border-[var(--border-hi)] rounded-2xl p-1.5 shadow-2xl z-50 space-y-1 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                        {[
                          { code: "USD", label: "USD ($) — US Dollar", symbol: "$" },
                          { code: "PKR", label: "PKR (Rs.) — Pakistani Rupee", symbol: "Rs." },
                        ].map((item) => {
                          const isSelected = currency === item.code;
                          return (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => {
                                setCurrency(item.code as "USD" | "PKR");
                                setCurrencySymbol(item.symbol);
                                setIsCurrencyDropdownOpen(false);
                              }}
                              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${
                                isSelected
                                  ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold border border-[var(--gold)]/30"
                                  : "text-[var(--text-hi)] hover:bg-[var(--surface-hi)] hover:text-[var(--gold)]"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{item.code}</span>
                                <span className="text-[var(--text-lo)] text-[11px]">({item.symbol})</span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[var(--gold)]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Currency Sign / Symbol Input */}
                <div className="space-y-1.5 w-full sm:w-48">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)] flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Currency Sign</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      placeholder="e.g. $ or Rs."
                      className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-sm text-[var(--text-hi)] font-bold focus:outline-none transition-all placeholder-[var(--text-faint)]"
                    />
                  </div>
                </div>

                {/* 3. Save Currency Action Button */}
                <div className="w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleSaveCurrency}
                    disabled={isSavingCurrency}
                    className="btn-gold w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold-glow)] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 whitespace-nowrap"
                  >
                    {isSavingCurrency ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Currency</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Real-time Exchange Rate Info Banner */}
              {currency === "PKR" && (
                <div className="p-3.5 rounded-2xl bg-[var(--gold-dim)]/20 border border-[var(--gold)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse"></div>
                    <span className="text-xs font-bold text-[var(--gold)]">
                      Real-Time Rate: 1 USD ≈ {liveExchangeRate.toFixed(2)} PKR
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-lo)] font-medium">
                    All subscription tiers, calculators & invoices auto-convert in real time.
                  </span>
                </div>
              )}
            </div>

            {/* Card 3: Password Management */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 border border-[var(--border-hi)]">
              <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/30">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--text-hi)]">Password Management</h3>
                  <p className="text-xs text-[var(--text-lo)]">Update your Super Admin master login password to keep your account secure.</p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Current Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Current Password</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1 cursor-pointer"
                        aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 2. New Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)] flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>New Password</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1 cursor-pointer"
                        aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 3. Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--gold)]" />
                      <span>Confirm Password</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1 cursor-pointer"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Real-time Password Strength Criteria Badges with Live Tick Boxes */}
                {(() => {
                  const isPasswordTouched = Boolean(
                    newPassword.length > 0 ||
                    confirmPassword.length > 0 ||
                    hasAttemptedPasswordSubmit
                  );
                  const validCount = [ruleLength, ruleUpper, ruleLower, ruleNumber, ruleSpecial, ruleMatch].filter(Boolean).length;

                  return (
                    <div className="p-4 rounded-2xl border border-[var(--border)] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck
                            className={`w-4 h-4 ${
                              isPasswordTouched && !allPasswordRulesValid
                                ? "text-[#ef4444] [data-theme=light]_&:text-[#dc2626]"
                                : allPasswordRulesValid
                                ? "text-[#25d366] [data-theme=light]_&:text-[#15803d]"
                                : "text-[var(--gold)]"
                            }`}
                          />
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-hi)]">
                            Password Requirements
                          </span>
                        </div>
                        {isPasswordTouched && !allPasswordRulesValid ? (
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] border border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40">
                            {validCount} / 6 - Action Required
                          </span>
                        ) : allPasswordRulesValid ? (
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 text-[#25d366] [data-theme=light]_&:text-[#15803d] border border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40">
                            6 / 6 Completed
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                            0 / 6 Completed
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                        {/* Rule 1: Minimum 8 characters */}
                        {(() => {
                          const isValid = ruleLength;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
                                isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                  ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                  : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                  isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                    ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                    : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Minimum 8 characters</span>
                            </div>
                          );
                        })()}

                        {/* Rule 2: Uppercase letter (A-Z) */}
                        {(() => {
                          const isValid = ruleUpper;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
                                isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                  ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                  : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                  isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                    ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                    : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Uppercase letter (A-Z)</span>
                            </div>
                          );
                        })()}

                        {/* Rule 3: Lowercase letter (a-z) */}
                        {(() => {
                          const isValid = ruleLower;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
                                isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                  ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                  : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                  isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                    ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                    : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Lowercase letter (a-z)</span>
                            </div>
                          );
                        })()}

                        {/* Rule 4: Numeric digit (0-9) */}
                        {(() => {
                          const isValid = ruleNumber;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
                                isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                  ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                  : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                  isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                    ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                    : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Number digit (0-9)</span>
                            </div>
                          );
                        })()}

                        {/* Rule 5: Special sign / character (!@#$%) */}
                        {(() => {
                          const isValid = ruleSpecial;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
                                isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                  ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                  : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                  isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                    ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                    : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Special sign / symbol (!@#$%)</span>
                            </div>
                          );
                        })()}

                        {/* Rule 6: Passwords match */}
                        {(() => {
                          const isValid = ruleMatch;
                          const isError = isPasswordTouched && !isValid;
                          return (
                            <div
                              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-200 ${
                                isValid
                                  ? "bg-[#25d366]/15 [data-theme=light]_&:bg-[#16a34a]/10 border-[#25d366]/40 [data-theme=light]_&:border-[#16a34a]/40 text-[#25d366] [data-theme=light]_&:text-[#15803d] font-semibold"
                                  : isError
                                  ? "bg-[#ef4444]/15 [data-theme=light]_&:bg-[#ef4444]/10 border-[#ef4444]/40 [data-theme=light]_&:border-[#ef4444]/40 text-[#ef4444] [data-theme=light]_&:text-[#dc2626] font-semibold"
                                  : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                  isValid
                                    ? "bg-[#25d366] [data-theme=light]_&:bg-[#16a34a] border-[#25d366] [data-theme=light]_&:border-[#16a34a] text-[#0a0806] [data-theme=light]_&:text-white shadow-sm"
                                    : isError
                                    ? "bg-[#ef4444] border-[#ef4444] text-white shadow-sm"
                                    : "border-[var(--border-hi)] bg-[var(--bg-deep)]/40"
                                }`}
                              >
                                {isValid ? <Check className="w-3 h-3 stroke-[3]" /> : isError ? <X className="w-3 h-3 stroke-[3]" /> : null}
                              </div>
                              <span className="truncate">Confirm password matches</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {/* Save / Update Button */}
                <div className="flex items-center justify-end pt-3 border-t border-[var(--border)]/60">
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="btn-gold px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-[var(--gold-glow)] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================== NOTIFICATIONS TAB ===================== */}
      {activeTab === "notifications" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 border border-[var(--border-hi)]">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
              <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/30">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--text-hi)]">Super Admin Notification Preferences</h3>
                <p className="text-xs text-[var(--text-lo)]">Control high-priority push events and email notifications dispatched to {adminEmail}.</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: "newVendors", title: "New Restaurant Registration Requests", desc: "Instant alert when a restaurant partner submits onboard docs." },
                { key: "franchiseBilling", title: "SaaS Subscription Renewals & Payments", desc: "Alerts when franchise invoices are collected or failed." },
                { key: "systemOutages", title: "POS Offline & Kitchen Latency Alerts", desc: "Immediate broadcast if branch latency exceeds 20 minutes." },
                { key: "dailyDigest", title: "Daily Network GMV Digest", desc: "Morning summary report of revenue, top dishes, and active outlets." },
              ].map((item) => {
                const isChecked = emailAlerts[item.key as keyof typeof emailAlerts];
                return (
                  <div
                    key={item.key}
                    onClick={() => {
                      setEmailAlerts((prev) => ({
                        ...prev,
                        [item.key]: !prev[item.key as keyof typeof emailAlerts],
                      }));
                      showToast("Notification preferences updated");
                    }}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] hover:border-[var(--gold)]/40 transition-colors cursor-pointer select-none"
                  >
                    <div>
                      <div className="font-semibold text-sm text-[var(--text-hi)]">{item.title}</div>
                      <div className="text-xs text-[var(--text-lo)] mt-0.5">{item.desc}</div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                        isChecked
                          ? "bg-[var(--gold)] border-[var(--gold)] text-[#342c14]"
                          : "border-[var(--border-hi)] bg-[var(--bg-deep)]"
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================== PLATFORM DEFAULTS TAB ===================== */}
      {activeTab === "platform" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 border border-[var(--border-hi)]">
            <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
              <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/30">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--text-hi)]">Database Telemetry & Cache Settings</h3>
                <p className="text-xs text-[var(--text-lo)]">Manage edge cache synchronization, offline POS buffers, and data retention.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-[var(--text-hi)]">Clear Local Storage Cache</div>
                <div className="text-xs text-[var(--text-lo)]">Purge cached franchise metrics and force fresh database sync.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("sa_restaurants");
                    localStorage.removeItem("sa_plans");
                    showToast("Super admin cache purged successfully!");
                  } catch {}
                }}
                className="btn-gold px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Purge Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
