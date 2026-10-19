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
  Sun,
  Sunset,
  Moon,
  CalendarCheck,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { AuthenticatedUser } from "../../types";
import { createClient } from "../../../../lib/supabase";
import { getValidTenantContext } from "../../../../lib/tenantResolver";
import { saveStoredBranchSettings } from "../../../../lib/tenantStore";
import {
  saveRestaurantShiftConfig,
  getRestaurantShiftConfig,
  format24HourTo12Hour,
  format12HourTo24Hour,
  validateShiftWithinOperatingHours,
  parseRestaurantShiftConfig,
  getEffectiveShiftsList,
  DynamicShiftItem,
} from "../../../../lib/shiftSchedule";

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
  const [openingTime, setOpeningTime] = useState("10:00 AM");
  const [closingTime, setClosingTime] = useState("02:00 AM");
  const [taxRatePercent, setTaxRatePercent] = useState(16.0);
  const [currencySymbol, setCurrencySymbol] = useState("Rs");

  // Dynamic Shift Timing States (Configurable 1 to 4 shifts)
  const [shifts, setShifts] = useState<DynamicShiftItem[]>([
    { name: "Morning Shift", start: "10:00", end: "16:00", order: 1, isActive: true },
    { name: "Evening Shift", start: "16:00", end: "00:00", order: 2, isActive: true },
  ]);

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

        // 2. Fetch live outlet identification & shift timings from public.restaurants
        const { data: restData } = await supabase
          .from("restaurants")
          .select("brand_name, hq_address, phone, branches")
          .eq("id", restId)
          .maybeSingle();

        if (restData && isMounted) {
          if (restData.brand_name) setDisplayName(restData.brand_name);
          if (restData.hq_address) setAddress(restData.hq_address);
          if (restData.phone) setPhone(restData.phone);

          // 2. Fetch live multi-shift configuration from public.restaurant_shifts or branches
          try {
            const { data: dbShifts } = await supabase
              .from("restaurant_shifts")
              .select("*")
              .eq("restaurant_id", restId)
              .eq("is_active", true)
              .order("sort_order", { ascending: true });

            if (dbShifts && dbShifts.length > 0) {
              setShifts(
                dbShifts.map((s: any, idx: number) => ({
                  id: s.id,
                  name: s.shift_name,
                  start: format12HourTo24Hour(s.start_time),
                  end: format12HourTo24Hour(s.end_time),
                  order: s.sort_order || idx + 1,
                  isActive: s.is_active,
                }))
              );
            } else {
              const branchShiftTimings = restData.branches?.[0]?.shift_timings;
              if (branchShiftTimings) {
                const parsed = parseRestaurantShiftConfig(branchShiftTimings);
                if (parsed) {
                  setShifts(getEffectiveShiftsList(parsed));
                }
              }
            }
          } catch {}
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

  // Dynamic Shift Management Handlers
  const handleAddShift = () => {
    if (shifts.length >= 4) {
      showToast("Maximum 4 operational shifts can be configured.");
      return;
    }
    const nextOrder = shifts.length + 1;
    const defaultNames = ["Morning Shift", "Evening Shift", "Night Shift", "Closing Shift"];
    const name = defaultNames[shifts.length] || `Shift ${nextOrder}`;
    setShifts((prev) => [
      ...prev,
      {
        name,
        start: "16:00",
        end: "00:00",
        order: nextOrder,
        isActive: true,
      },
    ]);
  };

  const handleRemoveShift = (indexToRemove: number) => {
    if (shifts.length <= 1) {
      showToast("At least 1 shift must be configured.");
      return;
    }
    setShifts((prev) =>
      prev
        .filter((_, idx) => idx !== indexToRemove)
        .map((s, idx) => ({ ...s, order: idx + 1 }))
    );
  };

  const handleUpdateShift = (index: number, field: keyof DynamicShiftItem, value: any) => {
    setShifts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Real-time validations for each shift within operational hours
  const shiftValidations = React.useMemo(() => {
    return shifts.map((s) =>
      validateShiftWithinOperatingHours(s.start, s.end, openingTime, closingTime, s.name || `Shift ${s.order}`)
    );
  }, [shifts, openingTime, closingTime]);

  // Save Handler: Direct Atomic Upsert to Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict validation: All shifts must fall strictly within restaurant operating hours
    const invalidShift = shiftValidations.find((v) => !v.isValid);
    if (invalidShift) {
      showToast(invalidShift.reason || "One or more shifts fall outside restaurant operational hours.");
      return;
    }

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

      // Sync outlet contact details, tax rate, and custom shift timings to public.restaurants
      try {
        // 1. Persist to public.restaurant_shifts table if available
        try {
          await supabase.from("restaurant_shifts").delete().eq("restaurant_id", restId);
          const rowsToInsert = shifts.map((s, idx) => ({
            restaurant_id: restId,
            branch_id: targetBranchId,
            shift_name: s.name.trim(),
            start_time: s.start,
            end_time: s.end,
            sort_order: idx + 1,
            is_active: true,
          }));
          await supabase.from("restaurant_shifts").insert(rowsToInsert);
        } catch (dbShiftErr) {
          console.warn("[SettingsView] restaurant_shifts table sync notice:", dbShiftErr);
        }

        const { data: currentRest } = await supabase
          .from("restaurants")
          .select("branches")
          .eq("id", restId)
          .maybeSingle();

        let updatedBranches: any[] = [];
        if (Array.isArray(currentRest?.branches) && currentRest.branches.length > 0) {
          updatedBranches = [...currentRest.branches];
        } else if (Array.isArray(user.branches) && user.branches.length > 0) {
          updatedBranches = [...user.branches];
        } else {
          updatedBranches = [{ name: displayName, city: user.city || "Main", type: "standalone" }];
        }

        const newShiftTimings = {
          shifts: shifts.map((s, idx) => ({ ...s, order: idx + 1 })),
          first_shift: { name: shifts[0]?.name || "First Shift", start: shifts[0]?.start || "08:00", end: shifts[0]?.end || "16:00" },
          second_shift: { name: shifts[1]?.name || "Second Shift", start: shifts[1]?.start || "16:00", end: shifts[1]?.end || "00:00" },
          third_shift: { name: shifts[2]?.name || "Third Shift", start: shifts[2]?.start || "00:00", end: shifts[2]?.end || "08:00" },
          operating_hours: {
            opening_time: openingTime.trim(),
            closing_time: closingTime.trim(),
          },
        };

        updatedBranches[0] = {
          ...updatedBranches[0],
          shift_timings: newShiftTimings,
        };

        await supabase
          .from("restaurants")
          .update({
            tax_rate: Number(taxRatePercent),
            tax_rate_percent: Number(taxRatePercent),
            brand_name: displayName.trim() || undefined,
            hq_address: address.trim() || undefined,
            phone: phone.trim() || undefined,
            branches: updatedBranches,
          })
          .eq("id", restId);

        // Also persist to local cache and broadcast
        saveRestaurantShiftConfig(restId, {
          firstShift: newShiftTimings.first_shift,
          secondShift: newShiftTimings.second_shift,
          thirdShift: newShiftTimings.third_shift,
          shifts: shifts.map((s, idx) => ({ ...s, order: idx + 1 })),
          operatingHours: {
            openingTime: openingTime.trim(),
            closingTime: closingTime.trim(),
          },
        });
      } catch (restErr) {
        console.warn("[SettingsView] Restaurant sync warning:", restErr);
      }

      // Save to local tenant cache for immediate zero-latency hydration
      const taxNum = Number(taxRatePercent);
      saveStoredBranchSettings(String(restId), targetBranchId, {
        taxRatePercent: taxNum,
        printerIp: printerIp.trim(),
        printerPaperWidth,
        kitchenBuzzerEnabled,
        openingTime: openingTime.trim(),
        closingTime: closingTime.trim(),
        currencySymbol: currencySymbol.trim() || "Rs",
      });

      // Broadcast update across windows & tabs
      if (typeof window !== "undefined") {
        localStorage.setItem(`pos_tax_rate_${restId}`, String(taxNum));
        window.dispatchEvent(
          new CustomEvent("pos_tax_rate_changed", {
            detail: { taxRate: taxNum, restaurantId: String(restId) },
          })
        );
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
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6 sm:space-y-8 max-w-[1400px] w-full mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-4xl text-[var(--text-hi)] tracking-tight">
          Branch Profile &amp;{" "}
          <span className="bg-gradient-to-r from-[#fcebc0] via-[#e3b13b] to-[#e04e17] bg-clip-text text-transparent">
            Hardware Setup
          </span>
        </h1>
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

        {/* Section 4: Operational Shifts & Dynamic Work Windows */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[var(--border)] space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-[var(--gold)]" />
              <h3 className="font-display font-black text-sm text-[var(--text-hi)]">
                Operational Shifts &amp; Dynamic Work Windows
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-medium text-[var(--text-lo)] bg-[var(--surface-hi)] px-3 py-1 rounded-full border border-[var(--border)]">
                {shifts.length} {shifts.length === 1 ? "Shift" : "Shifts"} Configured
              </span>
              <button
                type="button"
                onClick={handleAddShift}
                disabled={shifts.length >= 4 || isLoading}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-mono font-bold bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30 hover:bg-[var(--gold)]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                <Plus className="w-3 h-3" />
                <span>Add Shift ({shifts.length}/4)</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-lo)] leading-relaxed">
            Configure custom operational start and end hours for each shift (1 to 4 shifts). Terminal logins, active duty validations, 10-minute warning prompts, and shift expiry cutoff countdowns will dynamically adjust according to these hours.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--gold-dim)]/20 border border-[var(--gold)]/20 text-[var(--gold)] text-xs">
            <span className="flex items-center gap-1.5 font-bold font-mono">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Operational Window: {format24HourTo12Hour(openingTime)} – {format24HourTo12Hour(closingTime)}
            </span>
            <span className="text-[10px] text-[var(--text-lo)]">
              All shifts must be scheduled strictly within these operational hours.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {shifts.map((shift, idx) => {
              const validation = shiftValidations[idx] || { isValid: true };
              const shiftIcons = [
                { icon: Sun, color: "text-amber-500", bg: "bg-amber-500/15", border: "border-amber-500/30", badgeText: "text-amber-500" },
                { icon: Sunset, color: "text-orange-500", bg: "bg-orange-500/15", border: "border-orange-500/30", badgeText: "text-orange-500" },
                { icon: Moon, color: "text-indigo-400", bg: "bg-indigo-500/15", border: "border-indigo-500/30", badgeText: "text-indigo-400" },
                { icon: Clock, color: "text-cyan-400", bg: "bg-cyan-500/15", border: "border-cyan-500/30", badgeText: "text-cyan-400" },
              ];
              const theme = shiftIcons[idx % shiftIcons.length];
              const IconComp = theme.icon;

              return (
                <div
                  key={shift.id || idx}
                  className={`p-4 sm:p-5 rounded-2xl bg-[var(--surface-hi)]/60 border ${
                    !validation.isValid
                      ? "border-red-500/50 bg-red-950/10"
                      : "border-[var(--border)] hover:border-[var(--gold)]/40"
                  } transition-all space-y-4 relative flex flex-col justify-between`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl ${theme.bg} ${theme.border} border flex items-center justify-center ${theme.color}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-[var(--text-hi)]">
                            {shift.name || `Shift ${idx + 1}`}
                          </h4>
                          <span className="text-[10px] font-mono text-[var(--text-faint)]">
                            Shift #{idx + 1}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(idx)}
                          disabled={shifts.length <= 1 || isLoading}
                          title={shifts.length <= 1 ? "Minimum 1 shift required" : "Delete Shift"}
                          className="p-1.5 rounded-lg text-[var(--text-lo)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[10px] font-mono">
                      <span className="text-[var(--text-lo)]">Active Timing:</span>
                      <span className={`font-bold ${theme.badgeText}`}>
                        {format24HourTo12Hour(shift.start)} – {format24HourTo12Hour(shift.end)}
                      </span>
                    </div>

                    {!validation.isValid && (
                      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[10.5px] leading-tight">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{validation.reason}</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[var(--text-hi)] font-mono uppercase">
                        Shift Title / Name *
                      </label>
                      <input
                        type="text"
                        value={shift.name}
                        onChange={(e) => handleUpdateShift(idx, "name", e.target.value)}
                        placeholder={`e.g. Shift ${idx + 1}`}
                        disabled={isLoading}
                        required
                        className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] font-mono focus:outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[var(--text-hi)] font-mono uppercase">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={shift.start}
                          onChange={(e) => handleUpdateShift(idx, "start", e.target.value)}
                          disabled={isLoading}
                          required
                          className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] font-mono focus:outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[var(--text-hi)] font-mono uppercase">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={shift.end}
                          onChange={(e) => handleUpdateShift(idx, "end", e.target.value)}
                          disabled={isLoading}
                          required
                          className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--gold)] rounded-xl px-3 py-2 text-xs text-[var(--text-hi)] font-mono focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
