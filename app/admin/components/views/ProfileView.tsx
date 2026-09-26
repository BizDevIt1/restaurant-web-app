"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Upload,
  Link as LinkIcon,
  Phone,
  Mail,
  MapPin,
  Utensils,
  DollarSign,
  Save,
  CheckCircle2,
  Loader2,
  Eye,
  Store,
  Receipt,
  Flame,
  Bike,
  Trash2,
  Check,
} from "lucide-react";
import { AuthenticatedUser } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import { ALL_PAKISTAN_CITIES } from "../../../../lib/tenantStore";

interface ProfileViewProps {
  user: AuthenticatedUser;
  showToast: (msg: string) => void;
}

const CUISINE_OPTIONS = [
  "Desi / Traditional Karahi & Handi",
  "Fast Food, Burgers & Fried Chicken",
  "Fine Dining & Continental",
  "BBQ, Kebabs & Charcoal Grills",
  "Pizza, Pasta & Italian",
  "Cafe, Bakery & Desserts",
  "Chinese & Pan-Asian",
  "Seafood & Grills",
  "Mughlai & Biryani Specialists",
];

// Helper to reliably parse comma-separated or string cuisine classifications
const parseCuisines = (val?: string | null): string[] => {
  if (!val) return ["Fine Dining & Continental"];
  const list = val.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : ["Fine Dining & Continental"];
};

export default function ProfileView({ user, showToast }: ProfileViewProps) {
  const { updateRestaurantProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state initialized from user session
  const [brandName, setBrandName] = useState(user.restaurantName || "Restaurant");
  const [logoUrl, setLogoUrl] = useState(user.logoUrl || "");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(() => parseCuisines(user.cuisine));

  const toggleCuisine = (option: string) => {
    if (selectedCuisines.includes(option)) {
      if (selectedCuisines.length <= 1) {
        showToast("At least 1 cuisine category must be selected.");
        return;
      }
      setSelectedCuisines(selectedCuisines.filter((c) => c !== option));
    } else {
      setSelectedCuisines([...selectedCuisines, option]);
    }
  };
  const [city, setCity] = useState(user.city || "Lahore");
  const [phone, setPhone] = useState(user.phone || "+92 300 0000000");
  const [email, setEmail] = useState(user.email || "admin@restaurant.pk");
  const [address, setAddress] = useState(user.address || "Main Commercial Avenue, DHA Phase 5");

  // Telemetry & UI status
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvedTenantId, setResolvedTenantId] = useState<number>(27);
  const [previewTab, setPreviewTab] = useState<"pos" | "kds" | "dispatch">("pos");
  const [imageError, setImageError] = useState(false);

  // Fetch live restaurant record from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    const fetchLiveRestaurant = async () => {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);
        setResolvedTenantId(restId);

        const { data, error } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", restId)
          .single();

        if (!error && data && isMounted) {
          if (data.brand_name) setBrandName(data.brand_name);
          if (data.logo_url) setLogoUrl(data.logo_url);
          if (data.cuisine) setSelectedCuisines(parseCuisines(data.cuisine));
          if (data.city) setCity(data.city);
          if (data.phone) setPhone(data.phone);
          if (data.owner_email) setEmail(data.owner_email);
          if (data.hq_address) setAddress(data.hq_address);
        }
      } catch (err) {
        console.warn("[ProfileView] Error fetching live restaurant profile:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLiveRestaurant();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handle local file upload via FileReader (converted to high-res data URL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Please choose an image smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoUrl(reader.result);
        setImageError(false);
        showToast("Brand logo uploaded successfully.");
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit profile changes to Supabase public.restaurants
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedBrandName = brandName.trim();
    if (!trimmedBrandName) {
      showToast("Restaurant brand name cannot be empty.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { restId } = await getValidTenantContext(user);

      const cuisineString = selectedCuisines.join(", ");

      const updatePayload: Record<string, any> = {
        brand_name: trimmedBrandName,
        phone: phone.trim(),
        cuisine: cuisineString,
        hq_address: address.trim(),
        owner_email: email.trim(),
        city: city.trim(),
      };

      // Attempt update with logo_url
      let { data, error } = await supabase
        .from("restaurants")
        .update({
          ...updatePayload,
          logo_url: logoUrl.trim(),
        })
        .eq("id", restId)
        .select()
        .single();

      // Graceful fallback if logo_url column hasn't been added to Postgres yet
      if (error && error.message?.includes("logo_url")) {
        const fallback = await supabase
          .from("restaurants")
          .update(updatePayload)
          .eq("id", restId)
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error("[ProfileView] Supabase update error:", error);
        showToast(`Failed to update profile: ${error.message}`);
        setIsSubmitting(false);
        return;
      }

      // Synchronize AuthContext and local storage session
      updateRestaurantProfile({
        brandName: trimmedBrandName,
        logoUrl: logoUrl.trim(),
        phone: phone.trim(),
        cuisine: cuisineString,
        address: address.trim(),
        city: city.trim(),
        email: email.trim(),
      });

      showToast("Restaurant profile & branding updated successfully.");
    } catch (err: any) {
      console.error("[ProfileView] Profile update exception:", err);
      showToast(`Network error: ${err?.message || "Failed to save profile"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanBrandName = brandName.trim() || "Restaurant";
  const brandInitials = cleanBrandName.substring(0, 2).toUpperCase() || "OM";

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-live-dot" />
            • RESTAURANT PROFILE &amp; WHITE-LABEL BRANDING
          </div>
          <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
            Restaurant Identity &amp;{" "}
            <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
              Branding Studio
            </span>
          </h1>
        </div>

        {/* Tenant ID Badge */}
        <div className="p-3 rounded-2xl bg-[var(--surface-hi)] border border-[var(--border)] flex items-center gap-3 shrink-0">
          <Store className="w-5 h-5 text-[var(--gold)]" />
          <div>
            <span className="text-[10px] font-mono text-[var(--text-faint)] uppercase block">Verified Tenant ID</span>
            <span className="font-display font-bold text-sm text-[var(--text-hi)]">
              #{resolvedTenantId} • {user.restaurantType || "Enterprise"}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: BRANDING & WHITE-LABEL CONFIG (7 Cols)                       */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-6">
            {/* Card 1: Brand Name & Custom Logo */}
            <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[var(--border)] space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-[var(--text-hi)]">
                      Restaurant Visual Brand
                    </h3>
                  </div>
                </div>
              </div>

              {/* Brand Name Input */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-[var(--text-hi)] uppercase tracking-wider">
                  Brand / Restaurant Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <input
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Spice Lounge, Royal Palace"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Brand Logo Section */}
              <div className="space-y-4 pt-2 border-t border-[var(--border)]/40">
                <label className="block text-xs font-mono font-bold text-[var(--text-hi)] uppercase tracking-wider">
                  Restaurant Brand Logo (White-Label)
                </label>

                <div className="flex flex-col sm:flex-row items-start gap-5">
                  {/* Live Logo Preview Box */}
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#1a140f] to-[#2b2118] border-2 border-[var(--gold)]/40 shadow-xl flex items-center justify-center overflow-hidden relative group p-2">
                      {logoUrl && !imageError ? (
                        <img
                          src={logoUrl}
                          alt={brandName}
                          onError={() => setImageError(true)}
                          className="w-full h-full object-contain drop-shadow-md"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center">
                          <span className="font-display font-black text-2xl bg-gradient-to-br from-[#fcebc0] to-[#e3b13b] bg-clip-text text-transparent">
                            {brandInitials}
                          </span>
                          <span className="text-[9px] font-mono text-[var(--text-faint)] mt-1">No Logo</span>
                        </div>
                      )}
                    </div>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl("");
                          setImageError(false);
                        }}
                        className="text-[10.5px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {/* Input and Upload Controls */}
                  <div className="flex-1 space-y-3 w-full">
                    <div className="space-y-1.5">
                      <div className="relative">
                        <LinkIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                        <input
                          type="url"
                          value={logoUrl}
                          onChange={(e) => {
                            setLogoUrl(e.target.value);
                            setImageError(false);
                          }}
                          placeholder="Paste image URL (e.g. https://.../logo.png)"
                          className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-2 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png, image/jpeg, image/svg+xml, image/webp"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2 px-3.5 rounded-xl bg-[var(--surface-hi)] hover:bg-[var(--gold-dim)] text-[var(--text-hi)] hover:text-[var(--gold)] border border-[var(--border)] hover:border-[var(--gold)]/40 text-xs font-bold font-sans flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo File</span>
                      </button>
                      <span className="text-[11px] font-mono text-[var(--text-faint)] block">
                        PNG, SVG, or JPG (Max 2MB)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Business Classification & Cuisine */}
            <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[var(--border)] space-y-5">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)]/60 pb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[var(--text-hi)]">
                    Operating Category &amp; Currency
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Operating Currency */}
                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold text-[var(--text-hi)] uppercase tracking-wider">
                    Operating Currency
                  </label>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-hi)]/80 border border-[var(--border)] text-sm font-mono font-bold text-[var(--text-hi)]">
                    <span className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#25d366]" />
                      PKR (Pakistani Rupee - Rs)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30">
                      Active
                    </span>
                  </div>
                </div>

                {/* Operating City */}
                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold text-[var(--text-hi)] uppercase tracking-wider">
                    Operating City
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-hi)] focus:outline-none cursor-pointer"
                  >
                    {ALL_PAKISTAN_CITIES.map((c) => (
                      <option key={c} value={c} className="bg-[var(--bg-deep)] text-[var(--text-hi)]">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cuisine Category Multi-Selection */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-1.5">
                  <label className="block text-xs font-mono font-bold text-[var(--text-hi)] uppercase tracking-wider">
                    Cuisine / Restaurant Classification
                  </label>
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30 font-bold shrink-0">
                    {selectedCuisines.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {CUISINE_OPTIONS.map((c) => {
                    const isSelected = selectedCuisines.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCuisine(c)}
                        className={`text-left p-3 rounded-xl border text-xs font-sans transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? "bg-gradient-to-r from-[var(--gold-dim)] to-[var(--gold-dim)]/40 text-[var(--gold)] border-[var(--gold)]/60 font-bold shadow-sm"
                            : "bg-[var(--surface-hi)]/40 text-[var(--text-lo)] border-[var(--border)] hover:bg-[var(--surface-hi)] hover:text-[var(--text-hi)]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div
                            className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                              isSelected
                                ? "bg-[var(--gold)] border-[var(--gold)] text-black"
                                : "border-[var(--border)] bg-[var(--surface-hi)] group-hover:border-[var(--gold)]/50"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="truncate">{c}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--gold)]/20 text-[var(--gold)] shrink-0 ml-1">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: CONTACT, ADDRESS & TERMINAL PREVIEW (5 Cols)                */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-6">
            {/* Card 3: Contact & Address Information */}
            <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-[var(--border)] space-y-5">
              <div className="flex items-center gap-2.5 border-b border-[var(--border)]/60 pb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[var(--text-hi)]">
                    Outlet Contact &amp; HQ
                  </h3>
                </div>
              </div>

              {/* Support Phone */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-[var(--text-hi)] uppercase tracking-wider">
                  Primary Support Phone
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 0000000"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Billing / Notification Email */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-[var(--text-hi)] uppercase tracking-wider">
                  Billing &amp; Notification Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@restaurant.pk"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Physical Headquarter Address */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold text-[var(--text-hi)] uppercase tracking-wider">
                  Physical Headquarter / Main Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-[var(--text-faint)]" />
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Plot 14-C, Main Commercial Boulevard, Phase 5 DHA, Lahore"
                    className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Card 4: Live White-Label Terminal Preview */}
            <div className="glass-panel p-6 rounded-2xl border border-[var(--border)] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/60">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[var(--gold)]" />
                  <span className="font-display font-bold text-xs text-[var(--text-hi)]">
                    Live Operational Terminal Preview
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-[var(--surface-hi)] p-0.5 rounded-lg border border-[var(--border)] text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("pos")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      previewTab === "pos" ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold" : "text-[var(--text-lo)]"
                    }`}
                  >
                    POS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("kds")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      previewTab === "kds" ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold" : "text-[var(--text-lo)]"
                    }`}
                  >
                    KDS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("dispatch")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      previewTab === "dispatch" ? "bg-[var(--gold-dim)] text-[var(--gold)] font-bold" : "text-[var(--text-lo)]"
                    }`}
                  >
                    Rider
                  </button>
                </div>
              </div>

              {/* Mockup Terminal Top Bar */}
              <div className="p-3.5 rounded-xl bg-[#0e0a07] border border-[var(--gold)]/30 shadow-inner space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                  <span>TERMINAL BAR PREVIEW</span>
                  <span className="text-[#25d366]">LIVE SYNC</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-black/60 border border-[var(--gold)]/40 flex items-center justify-center overflow-hidden shrink-0">
                      {logoUrl && !imageError ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[11px] font-black text-[var(--gold)]">{brandInitials}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-display font-black text-sm text-[var(--text-hi)] truncate max-w-[160px]">
                        {cleanBrandName}
                      </p>
                      <p className="text-[10px] font-mono text-[var(--text-faint)]">
                        {previewTab === "pos" && "POS Billing Station"}
                        {previewTab === "kds" && "Kitchen Prep Station (KDS)"}
                        {previewTab === "dispatch" && "Delivery Fleet Dispatch"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--gold)]">
                    {previewTab === "pos" && <Receipt className="w-3.5 h-3.5 text-[#25d366]" />}
                    {previewTab === "kds" && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                    {previewTab === "dispatch" && <Bike className="w-3.5 h-3.5 text-blue-400" />}
                    <span>ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2 pb-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-gold animate-sheen py-3 px-7 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[var(--gold)]/20 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile &amp; Branding</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
