"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Phone,
  Printer,
  Percent,
  Clock,
  Volume2,
  VolumeX,
  Save,
  CheckCircle2,
  Sliders,
  DollarSign,
  FileText,
} from "lucide-react";
import { AuthenticatedUser } from "../../types";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";

interface SettingsViewProps {
  user: AuthenticatedUser;
  showToast: (msg: string) => void;
}

export default function SettingsView({ user, showToast }: SettingsViewProps) {
  const defaultDisplayName = `${user.restaurantName || "Restaurant"} • ${
    user.branchName || user.city || "Main Outlet"
  }`;
  const defaultAddress =
    user.address || (user.city ? `${user.city}, Pakistan` : "Commercial Area");
  const defaultPhone = user.phone || "+92 300 0000000";

  // Form states
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState(defaultPhone);
  const [printerIp, setPrinterIp] = useState("192.168.1.180");
  const [printerPaperWidth, setPrinterPaperWidth] = useState("80mm");
  const [kitchenBuzzerEnabled, setKitchenBuzzerEnabled] = useState(true);
  const [openingTime, setOpeningTime] = useState("11:00 AM");
  const [closingTime, setClosingTime] = useState("02:00 AM");
  const [taxRatePercent, setTaxRatePercent] = useState(16.0);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 100% Live Supabase Fetch on Mount (No localStorage, No static fallback overwrites)
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { restId } = await getValidTenantContext(user);

        // 1. Fetch live operational & hardware settings from public.branch_settings
        const { data, error } = await supabase
          .from("branch_settings")
          .select("*")
          .eq("restaurant_id", restId)
          .maybeSingle();

        if (error) {
          console.warn("[SettingsView] Error fetching live branch_settings:", error.message);
        }

        if (data && isMounted) {
          // Hydrate directly from database row
          const resolvedTax = data.tax_rate ?? data.tax_rate_percent;
          if (resolvedTax !== null && resolvedTax !== undefined) {
            setTaxRatePercent(Number(resolvedTax));
          }

          const resolvedPrinterIp = data.printer_ip || data.thermal_printer_ip;
          if (resolvedPrinterIp) {
            setPrinterIp(String(resolvedPrinterIp));
          }

          if (data.printer_paper_width) {
            setPrinterPaperWidth(String(data.printer_paper_width));
          }

          const resolvedBuzzer = data.buzzer_enabled ?? data.kitchen_buzzer_enabled;
          if (typeof resolvedBuzzer === "boolean") {
            setKitchenBuzzerEnabled(resolvedBuzzer);
          }

          if (data.opening_time) setOpeningTime(String(data.opening_time));
          if (data.closing_time) setClosingTime(String(data.closing_time));
          if (data.currency_symbol) setCurrencySymbol(String(data.currency_symbol));
        } else if (isMounted) {
          // Clean default initial values ready for first insert
          setTaxRatePercent(16.0);
          setPrinterIp("192.168.1.180");
          setPrinterPaperWidth("80mm");
          setKitchenBuzzerEnabled(true);
          setOpeningTime("11:00 AM");
          setClosingTime("02:00 AM");
          setCurrencySymbol("Rs");
        }

        // 2. Fetch live outlet identification from public.restaurants
        const { data: restData } = await supabase
          .from("restaurants")
          .select("brand_name, hq_address, phone")
          .eq("id", restId)
          .maybeSingle();

        if (restData && isMounted) {
          if (restData.brand_name) setDisplayName(restData.brand_name);
          if (restData.hq_address) setAddress(restData.hq_address);
          if (restData.phone) setPhone(restData.phone);
        }
      } catch (err) {
        console.error("[SettingsView] Exception loading settings from database:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.organizationId]);

  // Save Handler: Direct Atomic Upsert to Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const supabase = createClient();
      const { restId, branchId: resolvedBranch } = await getValidTenantContext(user);
      const targetBranchId = String(resolvedBranch || user.branchId || "1");

      const taxAuthName =
        user.city && /karachi|hyderabad/i.test(user.city)
          ? "Sindh Revenue Board (SRB)"
          : user.city && /islamabad/i.test(user.city)
          ? "Federal Board of Revenue (FBR)"
          : "Punjab Revenue Authority (PRA)";

      // Primary atomic upsert with target branch_settings schema
      let { data, error } = await supabase
        .from("branch_settings")
        .upsert(
          {
            restaurant_id: restId,
            tax_rate: Number(taxRatePercent),
            printer_ip: printerIp.trim(),
            printer_paper_width: printerPaperWidth,
            buzzer_enabled: kitchenBuzzerEnabled,
            opening_time: openingTime.trim(),
            closing_time: closingTime.trim(),
            currency_symbol: currencySymbol.trim() || "Rs",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "restaurant_id" }
        )
        .select()
        .maybeSingle();

      // Adaptive fallback if PostgreSQL schema uses legacy column aliases
      if (error && (error.code === "PGRST204" || error.code === "42703" || error.message?.includes("column") || error.message?.includes("conflict"))) {
        const fallbackRes = await supabase
          .from("branch_settings")
          .upsert(
            {
              restaurant_id: restId,
              branch_id: targetBranchId,
              thermal_printer_ip: printerIp.trim() || "192.168.1.180",
              kitchen_buzzer_enabled: kitchenBuzzerEnabled,
              tax_rate_percent: Number(taxRatePercent) || 16.0,
              tax_authority_name: taxAuthName,
              opening_time: openingTime.trim() || "11:00 AM",
              closing_time: closingTime.trim() || "02:00 AM",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "restaurant_id,branch_id" }
          )
          .select()
          .maybeSingle();

        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) {
        showToast(`Failed to save settings: ${error.message}`);
        return;
      }

      // Sync outlet contact details directly to public.restaurants
      if (address.trim() || phone.trim() || displayName.trim()) {
        await supabase
          .from("restaurants")
          .update({
            brand_name: displayName.trim() || undefined,
            hq_address: address.trim() || undefined,
            phone: phone.trim() || undefined,
          })
          .eq("id", restId);
      }

      setIsSaved(true);
      showToast("Settings saved successfully.");
      setTimeout(() => setIsSaved(false), 3000);
    } catch (dbErr: any) {
      console.error("[SettingsView] Save exception:", dbErr);
      showToast(`Failed to save settings: ${dbErr.message || dbErr}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-4xl w-full mx-auto animate-in fade-in duration-200">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-[11px] font-semibold uppercase tracking-wider mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />
          <Sliders className="w-3.5 h-3.5" />
          <span>OUTLET CONFIGURATION &amp; HARDWARE</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
          Branch Profile &amp;{" "}
          <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
            Hardware Setup
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-lo)] mt-1 font-medium">
          Thermal receipt printer IP, paper width, tax compliance, audio alerts, and operating hours.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Section 1: Branch Identification */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[var(--border)] space-y-5 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
            <Building2 className="w-4 h-4 text-[var(--gold)]" />
            <h3 className="font-display font-black text-sm text-[var(--text-hi)]">
              Outlet Identification
            </h3>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px]">
              Branch Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter branch display name"
              required
              disabled={isLoading}
              className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none transition-all shadow-inner disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[var(--gold)]" />
                Physical Address *
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter physical branch address"
                required
                disabled={isLoading}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px] flex items-center gap-1">
                <Phone className="w-3 h-3 text-[var(--gold)]" />
                Official Contact Phone *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter branch contact phone number"
                required
                disabled={isLoading}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Hardware & Kitchen Audio */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[var(--border)] space-y-5 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
            <Printer className="w-4 h-4 text-[var(--gold)]" />
            <h3 className="font-display font-black text-sm text-[var(--text-hi)]">
              Hardware &amp; Kitchen Alerts
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px]">
                KOT Printer IP Address *
              </label>
              <input
                type="text"
                value={printerIp}
                onChange={(e) => setPrinterIp(e.target.value)}
                placeholder="192.168.1.180"
                required
                disabled={isLoading}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px] flex items-center gap-1">
                <FileText className="w-3 h-3 text-[var(--gold)]" />
                Receipt Paper Width
              </label>
              <select
                value={printerPaperWidth}
                onChange={(e) => setPrinterPaperWidth(e.target.value)}
                disabled={isLoading}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] font-mono focus:outline-none transition-all shadow-inner disabled:opacity-50"
              >
                <option value="80mm">80mm (Standard Desktop KOT)</option>
                <option value="58mm">58mm (Compact Mobile Printer)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px]">
                Kitchen Audio Alert Buzzer
              </label>
              <div
                onClick={() => !isLoading && setKitchenBuzzerEnabled(!kitchenBuzzerEnabled)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  kitchenBuzzerEnabled
                    ? "bg-[var(--gold-dim)]/50 border-[var(--gold)]/40 text-[var(--gold)]"
                    : "bg-[var(--surface-hi)] border-[var(--border)] text-[var(--text-lo)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {kitchenBuzzerEnabled ? (
                    <Volume2 className="w-4 h-4 text-[var(--gold)]" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-[var(--text-faint)]" />
                  )}
                  <span className="font-bold text-xs">
                    {kitchenBuzzerEnabled ? "Buzzer ON" : "Buzzer OFF"}
                  </span>
                </div>
                <div
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors ${
                    kitchenBuzzerEnabled ? "bg-[var(--gold)]" : "bg-[var(--surface)]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-black transition-transform ${
                      kitchenBuzzerEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Operating Hours & Tax Rates */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[var(--border)] space-y-5 shadow-xl">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">
            <Clock className="w-4 h-4 text-[var(--gold)]" />
            <h3 className="font-display font-black text-sm text-[var(--text-hi)]">
              Operational Hours &amp; Tax Compliance
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px]">
                Opening Time *
              </label>
              <input
                type="text"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                placeholder="11:00 AM"
                required
                disabled={isLoading}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px]">
                Closing Time *
              </label>
              <input
                type="text"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                placeholder="02:00 AM"
                required
                disabled={isLoading}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px] flex items-center gap-1">
                <Percent className="w-3 h-3 text-[var(--gold)]" />
                Sales Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(parseFloat(e.target.value) || 0)}
                placeholder="16.0"
                disabled={isLoading}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[var(--text-hi)] font-mono uppercase text-[10.5px] flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-[var(--gold)]" />
                Currency Symbol
              </label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="Rs"
                disabled={isLoading}
                className="w-full bg-[var(--surface-hi)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-4 py-3 text-xs text-[var(--text-hi)] placeholder-[var(--text-faint)] font-mono focus:outline-none transition-all shadow-inner disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-2">
          {isSaved ? (
            <div className="flex items-center gap-1.5 text-xs text-[#25d366] font-mono font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Settings saved.</span>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-[var(--text-faint)]">
              Branch operational parameters &amp; hardware configuration.
            </span>
          )}

          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="btn-gold animate-sheen px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-md inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
