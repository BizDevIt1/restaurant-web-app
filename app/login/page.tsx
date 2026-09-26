"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Navbar from "../components/Navbar";
import WhatsAppFloat from "../components/WhatsAppFloat";
import { useSplash } from "../components/SplashScreen";

import { authenticateLocalAccount, setActiveUserSession } from "../../lib/tenantStore";
import { AuthenticatedUser, UserRole } from "../admin/types";

export default function LoginPage() {
  const router = useRouter();
  const { triggerSplash, hideSplash, isVisible: isSplashVisible } = useSplash();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    // Trigger splash screen to cover authentication process
    triggerSplash(2500);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;
    const redirectTarget =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirect") || "/admin"
        : "/admin";

    // 1. Check if user is an operational staff member in Supabase (Cashier, Chef, Rider, Branch Manager)
    try {
      const supabase = createClient();
      const { data: staffData } = await supabase
        .from("staff_members")
        .select("*, restaurants(*)")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (staffData) {
        if (staffData.password_hash === trimmedPassword || staffData.password_hash === password) {
          hideSplash();
          if (staffData.status !== "active") {
            setErrorMessage("This staff account is currently suspended or inactive. Contact branch manager.");
          } else {
            // Staff members are strictly restricted from the Web Admin Dashboard.
            // Stay right on login page and show message without redirecting or wiping admin session.
            setErrorMessage("Staff member accounts cannot log in to the web admin portal. Please access via your dedicated terminal.");
          }
          setTimeout(() => setErrorMessage(null), 4000);
          return;
        } else {
          hideSplash();
          setErrorMessage("Incorrect password for staff account. Please try again.");
          setTimeout(() => setErrorMessage(null), 3200);
          return;
        }
      }
    } catch (staffErr) {
      console.warn("[Staff Auth Lookup Exception]:", staffErr);
    }

    // 1b. Check local staff storage in case of offline/locally added staff
    try {
      const { getStoredStaff } = await import("../../lib/tenantStore");
      const localStaffList = getStoredStaff("27", []);
      const matchedLocalStaff = localStaffList.find(
        (s: any) => s.email && s.email.toLowerCase().trim() === trimmedEmail
      );
      if (matchedLocalStaff) {
        if (matchedLocalStaff.password === trimmedPassword || matchedLocalStaff.password === password) {
          hideSplash();
          setErrorMessage("Staff member accounts cannot log in to the web admin portal. Please access via your dedicated terminal.");
          setTimeout(() => setErrorMessage(null), 4000);
          return;
        } else {
          hideSplash();
          setErrorMessage("Incorrect password for staff account. Please try again.");
          setTimeout(() => setErrorMessage(null), 3200);
          return;
        }
      }
    } catch { }

    // 2. Check local tenant store (Branch Admins created by Franchiser or seeded personas)
    const localUser = authenticateLocalAccount(trimmedEmail, trimmedPassword);
    if (localUser) {
      localUser.userType = "ADMIN";
      localUser.terminalAccess = "FULL_ADMIN";
      setActiveUserSession(localUser);
      router.push(redirectTarget);
      router.refresh();
      return;
    }

    // 3. Supabase Auth for Super Admin or Restaurants registered in DB
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        // If Supabase sign-in failed, check if account was provisioned in local storage
        const fallbackLocal = authenticateLocalAccount(trimmedEmail, trimmedPassword);
        if (fallbackLocal) {
          fallbackLocal.userType = "ADMIN";
          fallbackLocal.terminalAccess = "FULL_ADMIN";
          setActiveUserSession(fallbackLocal);
          router.push(redirectTarget);
          router.refresh();
          return;
        }

        hideSplash();
        const displayMsg =
          error.message.toLowerCase().includes("invalid login credentials") ||
            error.message.toLowerCase().includes("invalid credentials")
            ? "Incorrect email or password. Please try again."
            : error.message;
        setErrorMessage(displayMsg);
        setTimeout(() => {
          setErrorMessage(null);
        }, 3200);
        return;
      }

      if (data?.session || data?.user) {
        // -------------------------------------------------------------------------
        // A. STRICT DATABASE & METADATA ROLE CHECK: IS THIS A SUPER ADMIN?
        // -------------------------------------------------------------------------
        let isSuperAdmin = false;

        // 1. Check profiles table in Supabase (Primary Source of Truth for Super Admin)
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("role, email")
            .or(`id.eq.${data.user.id},email.eq.${trimmedEmail}`)
            .maybeSingle();

          if (
            profileData?.role?.toLowerCase() === "super_admin" ||
            profileData?.role?.toLowerCase() === "superadmin"
          ) {
            isSuperAdmin = true;
          }
        } catch (profileErr) {
          console.warn("[Profiles Role Check Notice]:", profileErr);
        }

        // 2. Check Supabase Auth User Metadata & App Metadata
        const rawUserMetaRole = String(data.user?.user_metadata?.role || "").toLowerCase().trim();
        const rawAppMetaRole = String(data.user?.app_metadata?.role || "").toLowerCase().trim();
        if (
          rawUserMetaRole === "super_admin" ||
          rawUserMetaRole === "superadmin" ||
          rawAppMetaRole === "super_admin" ||
          rawAppMetaRole === "superadmin" ||
          data.user?.user_metadata?.is_super_admin === true
        ) {
          isSuperAdmin = true;
        }

        // 3. Fallback check for platform master account
        if (trimmedEmail === "bizdevit.dm@gmail.com") {
          isSuperAdmin = true;
        }

        if (isSuperAdmin) {
          // Open Super Admin Dashboard
          router.push("/super-admin/dashboard");
          router.refresh();
          return;
        }

        // -------------------------------------------------------------------------
        // B. BRANCH ADMIN CHECK (Staff / Manager assigned to a specific branch)
        // -------------------------------------------------------------------------
        if (rawUserMetaRole === "branch_admin") {
          const branchName = data.user?.user_metadata?.branch_name || "Branch Outlet";
          const orgId = data.user?.user_metadata?.organization_id || "27";
          const fullName = data.user?.user_metadata?.full_name || "Branch Manager";

          const authUser: AuthenticatedUser = {
            id: String(data.user.id),
            email: trimmedEmail,
            name: fullName,
            role: "BRANCH_ADMIN",
            userType: "ADMIN",
            terminalAccess: "FULL_ADMIN",
            restaurantName: branchName,
            branchName: branchName,
            branchId: `br_${data.user.id}`,
            assignedFeatures: ["POS", "KITCHEN", "MENU", "STAFF", "RIDER", "ANALYTICS"],
            organizationId: String(orgId),
            restaurantId: String(orgId),
          };

          setActiveUserSession(authUser);
          router.push(redirectTarget);
          router.refresh();
          return;
        }

        // -------------------------------------------------------------------------
        // C. RESTAURANT ADMIN OR FRANCHISER (FRANCHISE OWNER) CHECK
        // -------------------------------------------------------------------------
        try {
          // Check if explicit franchiser intent from metadata, role, or email
          const isExplicitFranchise =
            rawUserMetaRole === "franchise_owner" ||
            rawUserMetaRole === "franchiser" ||
            rawUserMetaRole === "frenchiser" ||
            data.user?.user_metadata?.restaurant_type === "FRANCHISE" ||
            trimmedEmail.includes("frenchise") ||
            trimmedEmail.includes("franchise") ||
            String(data.user?.user_metadata?.brand_name || "").toLowerCase().includes("frenchise") ||
            String(data.user?.user_metadata?.brand_name || "").toLowerCase().includes("franchise");

          // 1. Query Supabase restaurants table (by owner_email OR owner_id)
          const { data: restData } = await supabase
            .from("restaurants")
            .select("*")
            .or(`owner_email.eq.${trimmedEmail},owner_id.eq.${data.user.id}`)
            .limit(1)
            .maybeSingle();

          // 2. If not found in Supabase table directly, search local storage
          const {
            getStoredRestaurants,
            saveStoredRestaurant,
            getStoredFranchiseBranches,
            saveFranchiseBranches,
          } = await import("../../lib/tenantStore");

          let targetRest = restData;
          if (!targetRest && typeof window !== "undefined") {
            const localList = getStoredRestaurants();
            targetRest = localList.find(
              (r: any) =>
                (r.owner_email && r.owner_email.toLowerCase() === trimmedEmail) ||
                (r.email && r.email.toLowerCase() === trimmedEmail) ||
                (r.owner_id && String(r.owner_id) === String(data.user.id))
            );
          }

          // 3. Resilient Provisioning: If no restaurant record exists yet for this authenticated user,
          // dynamically initialize their profile using their auth metadata so they can access their dashboard!
          if (!targetRest) {
            const userBrand =
              data.user?.user_metadata?.brand_name ||
              data.user?.user_metadata?.restaurant_name ||
              (isExplicitFranchise ? "Omnibites Franchise" : "My Restaurant");
            const userContact =
              data.user?.user_metadata?.full_name ||
              data.user?.user_metadata?.contact_person ||
              (isExplicitFranchise ? "Franchise Owner" : "Restaurant Admin");
            const userCity = data.user?.user_metadata?.city || "Lahore";
            const userCuisine = data.user?.user_metadata?.cuisine || "Fine Dining";
            const userPhone = data.user?.user_metadata?.phone || "+92 300 0000000";

            const defaultBranches = isExplicitFranchise
              ? [
                {
                  id: `br_${data.user.id}_1`,
                  name: `${userBrand} (Main Branch)`,
                  code: "BR-01",
                  city: userCity,
                  address: "Main Commercial Area",
                  phone: userPhone,
                  managerName: userContact,
                  managerEmail: trimmedEmail,
                  assignedFeatures: ["POS", "KITCHEN", "MENU", "STAFF", "RIDER", "ANALYTICS"],
                  status: "ACTIVE",
                  todaySales: 0,
                  activeOrders: 0,
                  organizationId: String(data.user.id),
                },
                {
                  id: `br_${data.user.id}_2`,
                  name: `${userBrand} (Outlet 2)`,
                  code: "BR-02",
                  city: userCity,
                  address: "Commercial Center",
                  phone: userPhone,
                  managerName: "Branch Manager",
                  managerEmail: `branch2.${trimmedEmail}`,
                  assignedFeatures: ["POS", "KITCHEN", "MENU", "STAFF", "RIDER", "ANALYTICS"],
                  status: "ACTIVE",
                  todaySales: 0,
                  activeOrders: 0,
                  organizationId: String(data.user.id),
                },
              ]
              : [`${userBrand} (Main Branch)`];

            targetRest = {
              id: data.user.id,
              owner_id: data.user.id,
              brand_name: userBrand,
              contact_person: userContact,
              owner_email: trimmedEmail,
              city: userCity,
              cuisine: userCuisine,
              phone: userPhone,
              hq_address: "Main Commercial Facility",
              assigned_plan: "Enterprise Plus",
              initial_status: "Active",
              branches: defaultBranches,
              enabled_modules: [
                "pos_terminal",
                "kds_system",
                "rider_app",
                "inventory_stock",
                "menu",
                "staff",
                "analytics",
                "settings",
                "branches",
              ],
            };

            // Save to localStorage
            saveStoredRestaurant(targetRest);

            // Attempt to insert to Supabase restaurants table in the background
            supabase
              .from("restaurants")
              .insert([{
                brand_name: userBrand,
                contact_person: userContact,
                owner_email: trimmedEmail,
                city: userCity,
                cuisine: userCuisine,
                phone: userPhone,
                hq_address: "Main Commercial Facility",
                assigned_plan: "Enterprise Plus",
                initial_status: "Active",
                branches: defaultBranches,
                enabled_modules: [
                  "pos_terminal",
                  "kds_system",
                  "rider_app",
                  "inventory_stock",
                ],
                owner_id: data.user.id,
              }])
              .then(
                ({ error: insertErr }) => {
                  if (insertErr) console.warn("[Auto-provision restaurant notice]:", insertErr.message);
                },
                () => { }
              );
          }

          // 4. Determine if franchise based on database record & metadata
          const branchesRaw = Array.isArray(targetRest.branches)
            ? targetRest.branches
            : targetRest.branches
              ? [targetRest.branches]
              : [];

          const hasFranchiseBranch = branchesRaw.some(
            (b: any) =>
              typeof b === "object" && (b.type === "franchise" || b.type === "FRANCHISE")
          );

          const isFranchise =
            isExplicitFranchise ||
            hasFranchiseBranch ||
            targetRest.restaurant_type === "FRANCHISE" ||
            targetRest.business_type === "franchise" ||
            targetRest.restaurantType === "FRANCHISE" ||
            branchesRaw.length > 1;

          const mappedRole: UserRole = isFranchise ? "FRANCHISE_OWNER" : "STANDALONE_ADMIN";

          // Normalize feature modules helper
          const normalizeModules = (modules: any): string[] => {
            if (!Array.isArray(modules) || modules.length === 0) {
              return ["POS", "KITCHEN", "MENU", "STAFF", "RIDER", "ANALYTICS"];
            }
            const mapping: Record<string, string> = {
              pos_terminal: "POS",
              kds_system: "KITCHEN",
              rider_app: "RIDER",
              inventory_stock: "MENU",
              menu: "MENU",
              staff: "STAFF",
              analytics: "ANALYTICS",
              settings: "SETTINGS",
              branches: "BRANCHES",
            };
            return modules.map((m: string) => {
              const lower = String(m).toLowerCase().trim();
              return mapping[lower] || m.toUpperCase();
            });
          };

          let parsedBranches: any[] = [];
          if (isFranchise) {
            const storedDynamic = getStoredFranchiseBranches(String(targetRest.id));
            const sourceBranches =
              storedDynamic.length > 0
                ? storedDynamic
                : branchesRaw.length > 0
                  ? branchesRaw
                  : [targetRest.hq_address || targetRest.city || "Main Outlet"];

            parsedBranches = sourceBranches.map((bName: any, idx: number) => {
              const bTitle = typeof bName === "string" ? bName : bName.name || `Outlet ${idx + 1}`;
              const bCity = typeof bName === "object" && bName.city ? bName.city : targetRest.city || "";
              const bAddress =
                typeof bName === "object" && bName.address
                  ? bName.address
                  : targetRest.hq_address || targetRest.city || "";
              const bPhone = typeof bName === "object" && bName.phone ? bName.phone : targetRest.phone || "";

              return {
                id: typeof bName === "object" && bName.id ? bName.id : `branch_${targetRest.id}_${idx}`,
                name: bTitle,
                code:
                  typeof bName === "object" && bName.code
                    ? bName.code
                    : `${(bCity || "BR").substring(0, 3).toUpperCase()}-${String(idx + 1).padStart(2, "0")}`,
                city: bCity,
                address: bAddress,
                phone: bPhone,
                managerName:
                  typeof bName === "object" && bName.managerName
                    ? bName.managerName
                    : targetRest.contact_person || "Branch Manager",
                managerEmail:
                  typeof bName === "object" && bName.managerEmail
                    ? bName.managerEmail
                    : targetRest.owner_email || trimmedEmail,
                assignedFeatures:
                  typeof bName === "object" && bName.assignedFeatures
                    ? bName.assignedFeatures
                    : normalizeModules(targetRest.enabled_modules),
                status: "ACTIVE",
                todaySales: 0,
                activeOrders: 0,
                organizationId: String(targetRest.id),
              };
            });
          }

          const authUser: AuthenticatedUser = {
            id: String(data.user.id || targetRest.id),
            email: targetRest.owner_email || trimmedEmail,
            name:
              targetRest.contact_person ||
              targetRest.brand_name ||
              (isFranchise ? "Franchise Owner" : "Restaurant Admin"),
            role: mappedRole,
            userType: "ADMIN",
            terminalAccess: "FULL_ADMIN",
            restaurantName:
              targetRest.brand_name || (isFranchise ? "Omnibites Franchise" : "Restaurant"),
            city: targetRest.city || "",
            address: targetRest.hq_address || "",
            phone: targetRest.phone || "",
            cuisine: targetRest.cuisine || "Fine Dining",
            branchId: !isFranchise ? `br_${targetRest.id}` : undefined,
            branchName: !isFranchise ? (targetRest.hq_address || targetRest.brand_name) : undefined,
            branches: isFranchise ? parsedBranches : undefined,
            assignedFeatures: normalizeModules(targetRest.enabled_modules),
            restaurantType: isFranchise ? "FRANCHISE" : "STANDALONE",
            branchesCount: isFranchise ? parsedBranches.length : 1,
            organizationId: String(targetRest.id),
            restaurantId: String(targetRest.id),
          };

          setActiveUserSession(authUser);
          if (isFranchise && parsedBranches.length > 0) {
            saveFranchiseBranches(parsedBranches, String(targetRest.id));
          }

          // Route to the dashboard
          router.push(redirectTarget);
          router.refresh();
          return;
        } catch (fetchErr) {
          console.error("[Login Hydration Error]:", fetchErr);
          hideSplash();
          setErrorMessage("Failed to load restaurant profile. Please try again.");
          setTimeout(() => {
            setErrorMessage(null);
          }, 3500);
          return;
        }
      } else {
        hideSplash();
      }
    } catch (err: unknown) {
      hideSplash();
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setErrorMessage(message);
      setTimeout(() => {
        setErrorMessage(null);
      }, 4000);
    }
  };

  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    triggerSplash(1200);
    setShowForgotModal(true);
    setForgotSuccess(null);
    setForgotError(null);
    if (email) setForgotEmail(email);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    // Trigger splash screen
    triggerSplash(1200);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setForgotError(error.message);
      } else {
        setForgotSuccess("Password reset instructions sent to your email.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && (err.message.includes("Failed to fetch") || err.name === "TypeError")
          ? "Unable to reach the server. Please check your connection."
          : err instanceof Error
            ? err.message
            : "Failed to send reset link.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 1. Header Navbar */}
      <Navbar />

      {/* Floating Error Tooltip on Invalid Login */}
      {errorMessage && (
        <div className="fixed top-[88px] right-6 sm:right-8 z-50 flex items-center px-4 py-2 rounded-full bg-[#ef4444]/15 backdrop-blur-2xl border border-[#ef4444]/40 text-[#ef4444] shadow-xl shadow-black/40 animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none select-none">
          <span className="text-xs sm:text-sm font-semibold tracking-tight">
            {errorMessage}
          </span>
        </div>
      )}

      {/* Floating Info Tooltip on Staff Kiosk Redirection */}
      {infoMessage && (
        <div className="fixed top-[88px] right-6 sm:right-8 z-50 flex items-center px-4 py-2.5 rounded-full bg-[var(--gold)]/15 backdrop-blur-2xl border border-[var(--gold)]/40 text-[var(--gold)] shadow-xl shadow-black/40 animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none select-none">
          <span className="text-xs sm:text-sm font-semibold tracking-tight">
            {infoMessage}
          </span>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-start sm:justify-center pt-24 sm:pt-32 md:pt-36 pb-12 sm:pb-16 px-4 sm:px-6">
        {/* Ambient Glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[radial-gradient(circle_at_center,var(--gold-dim)_0%,transparent_70%)] pointer-events-none -z-10 opacity-70"
          aria-hidden="true"
        />

        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="bg-[var(--bg-deep)]/85 backdrop-blur-2xl border border-[var(--border)] rounded-2xl sm:rounded-3xl p-7 sm:p-9 shadow-2xl space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <Image
                src="/logo.png"
                alt="Omnibites"
                width={52}
                height={52}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain mx-auto mb-2"
              />
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--text-hi)]">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-lo)]">
                Sign in to manage your restaurant
              </p>
            </div>

            {/* Simple Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@restaurant.pk"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPasswordClick}
                    className="text-xs text-[var(--gold)] hover:underline cursor-pointer focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-hi)] transition-colors p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[var(--surface-hi)] border-[var(--border)] text-[var(--gold)] focus:ring-[var(--gold)]"
                />
                <label htmlFor="rememberMe" className="text-xs text-[var(--text-lo)] select-none cursor-pointer">
                  Remember this device
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSplashVisible}
                className="w-full btn-gold py-3 text-sm font-bold shadow-lg shadow-[var(--gold-glow)] mt-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Sign In</span>
              </button>
            </form>

            {/* Switch to Sign Up */}
            <div className="pt-2 text-center text-xs text-[var(--text-lo)] border-t border-[var(--border)]/60">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                onClick={(e) => {
                  e.preventDefault();
                  triggerSplash(1200);
                  router.push("/signup");
                }}
                className="text-[var(--gold)] font-semibold hover:underline"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[var(--bg-deep)] border border-[var(--border)] rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 relative">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 p-2 text-[var(--text-faint)] hover:text-[var(--text-hi)] rounded-lg hover:bg-[var(--surface-hi)] transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="space-y-2">
                <h2 className="font-display font-bold text-xl sm:text-2xl text-[var(--text-hi)]">
                  Reset Password
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-lo)]">
                  Enter your email address and we will send you instructions to reset your password.
                </p>
              </div>

              {forgotError && (
                <div className="p-3 rounded-xl bg-[var(--orange-dim)] border border-[var(--orange)]/40 text-[var(--text-hi)] text-xs">
                  {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div className="p-3 rounded-xl bg-[#25d366]/15 border border-[#25d366]/40 text-[var(--text-hi)] text-xs">
                  {forgotSuccess}
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-hi)] uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="owner@restaurant.pk"
                    className="w-full px-4 py-3 rounded-xl bg-[var(--surface-hi)] border border-[var(--border)] text-sm text-[var(--text-hi)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-[var(--text-lo)] hover:text-[var(--text-hi)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-gold px-5 py-2.5 text-xs font-bold shadow-md shadow-[var(--gold-glow)] cursor-pointer disabled:opacity-60"
                  >
                    {forgotLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
