"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import Navbar from "../components/Navbar";
import WhatsAppFloat from "../components/WhatsAppFloat";
import { useSplash } from "../components/SplashScreen";

import { authenticateLocalAccount, setActiveUserSession, clearUserSession, normalizeModules } from "../../lib/tenantStore";
import { AuthenticatedUser, UserRole } from "../admin/types";
import StartShiftModal, { ShiftTypeOption } from "../terminal/pos/components/StartShiftModal";
import {
  validateCashierShiftWindow,
  validateStaffShiftWindow,
  isShiftFromPreviousDate,
  isShiftForCurrentDayAndValid,
  clearStaleShiftStorage,
  parseShiftOption,
} from "../../lib/shiftSchedule";
import { dispatchShiftOpenedAlert } from "../../lib/shiftAuditNotifications";
import { AlertTriangle, ShieldAlert, LogOut, Clock, User as UserIcon } from "lucide-react";
import { recordStaffShiftLogin, checkActiveStaffSession, forceCloseStaffSession, UniversalShiftRecord } from "../../lib/universalShiftLogging";

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

  // Single-Session / Concurrent Login Prevention State
  const [activeSessionDetected, setActiveSessionDetected] = useState<UniversalShiftRecord | null>(null);
  const [pendingConcurrentAuthUser, setPendingConcurrentAuthUser] = useState<AuthenticatedUser | null>(null);

  // Shift initialization & float declaration strictly at login sequence
  const [pendingShiftStaffUser, setPendingShiftStaffUser] = useState<AuthenticatedUser | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [previousHandover, setPreviousHandover] = useState<{
    amount: number;
    cashierName: string;
    shiftType: string;
  } | null>(null);

  // Handle staff login with strict login-time shift initialization
  const proceedWithStaffLogin = async (authUser: AuthenticatedUser) => {
    const rawRole = (
      authUser.staffRole ||
      (authUser.role !== "STAFF_MEMBER" ? authUser.role : "") ||
      ""
    ).toLowerCase().trim();

    const isWaiter =
      rawRole === "waiter" ||
      rawRole === "server" ||
      (authUser.terminalAccess as string) === "WAITER_ONLY" ||
      (authUser.terminalAccess as string) === "WAITER";

    // Dedicated Independent Waiter Terminal Redirect for Waiters / Servers
    if (isWaiter) {
      authUser.staffRole = "waiter";
      authUser.terminalAccess = "WAITER_ONLY";

      // Strict Shift Window Validation for Waiters
      if (authUser.assignedShift) {
        const shiftValidation = validateStaffShiftWindow(authUser.assignedShift, new Date(), authUser);
        if (!shiftValidation.isValid) {
          hideSplash();
          setErrorMessage(
            shiftValidation.errorMessage ||
            `Access Denied: Your assigned shift is ${shiftValidation.shiftShortName} (${shiftValidation.windowLabel}). You cannot log in during this shift window.`
          );
          setTimeout(() => setErrorMessage(null), 5000);
          return;
        }
      }

      setActiveUserSession(authUser);
      try {
        await recordStaffShiftLogin(authUser, { station: "waiter" });
      } catch (shiftErr) {
        console.warn("[LoginPage] Waiter shift telemetry warning:", shiftErr);
      }
      router.push("/terminal/waiter");
      router.refresh();
      return;
    }

    const isChef =
      rawRole === "chef" ||
      rawRole === "kitchen" ||
      rawRole === "cook" ||
      rawRole === "kds" ||
      authUser.terminalAccess === "KDS_ONLY" ||
      (authUser.terminalAccess as string) === "KITCHEN_ONLY";

    // Dedicated Independent Kitchen Terminal Redirect for Chefs / Kitchen Staff
    if (isChef) {
      authUser.staffRole = "chef";
      authUser.terminalAccess = "KDS_ONLY";

      // Strict Shift Window Validation for Chefs
      if (authUser.assignedShift) {
        const shiftValidation = validateStaffShiftWindow(authUser.assignedShift, new Date(), authUser);
        if (!shiftValidation.isValid) {
          hideSplash();
          setErrorMessage(
            shiftValidation.errorMessage ||
            `Access Denied: Your assigned shift is ${shiftValidation.shiftShortName} (${shiftValidation.windowLabel}). You cannot log in during this shift window.`
          );
          setTimeout(() => setErrorMessage(null), 5000);
          return;
        }
      }

      setActiveUserSession(authUser);
      try {
        await recordStaffShiftLogin(authUser, { station: "kitchen" });
      } catch (shiftErr) {
        console.warn("[LoginPage] Chef shift telemetry warning:", shiftErr);
      }
      router.push("/terminal/kitchen");
      router.refresh();
      return;
    }

    const isCashier = !isWaiter && !isChef && (rawRole === "cashier" || authUser.terminalAccess === "POS_ONLY");

    if (isCashier) {
      try {
        const supabase = createClient();
        const restId = authUser.restaurantId || authUser.organizationId || "40";
        const staffKey = String(authUser.id || authUser.email || authUser.name || "cashier")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");

        // Query if an active OPEN shift already exists for this restaurant
        const { data: openShift } = await supabase
          .from("shift_settlements")
          .select("*")
          .eq("restaurant_id", restId)
          .eq("status", "OPEN")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const isStaleShift = openShift ? isShiftFromPreviousDate(openShift) : false;

        // If open shift belongs to a prior calendar date, cleanly close it so it never blocks or bypasses today's float
        if (openShift && isStaleShift) {
          try {
            await supabase
              .from("shift_settlements")
              .update({
                status: "CLOSED",
                shift_end: new Date().toISOString(),
                closing_notes: `System rollover: unclosed prior-day shift auto-closed on ${new Date().toLocaleDateString()} login.`,
              })
              .eq("id", openShift.id);
          } catch (closeErr) {
            console.warn("[LoginPage] Auto-close stale shift note:", closeErr);
          }
          clearStaleShiftStorage(restId, staffKey);
        }

        const isCurrentDayShift = openShift && !isStaleShift;
        const isStaffActiveOnOpenShift = Boolean(
          isCurrentDayShift && (
            openShift.cashier_id === authUser.id ||
            openShift.cashier_name?.toLowerCase() === (authUser.name || "").toLowerCase() ||
            openShift.cashier_name?.toLowerCase() === (authUser.email || "").toLowerCase()
          )
        );

        if (isCurrentDayShift && isStaffActiveOnOpenShift) {
          // Valid open shift started TODAY for this specific cashier: persist session state and resume
          sessionStorage.setItem(`pos_session_float_confirmed_${staffKey}`, "true");
          localStorage.setItem(`pos_session_float_confirmed_${staffKey}`, "true");
          sessionStorage.setItem("pos_session_float_confirmed_global", "true");
          localStorage.setItem("pos_session_float_confirmed_global", "true");
          sessionStorage.setItem(`pos_active_shift_${restId}`, JSON.stringify(openShift));
          localStorage.setItem(`pos_active_shift_${restId}`, JSON.stringify(openShift));
          sessionStorage.setItem(`pos_active_shift_${authUser.organizationId || restId}`, JSON.stringify(openShift));
          localStorage.setItem(`pos_active_shift_${authUser.organizationId || restId}`, JSON.stringify(openShift));
          sessionStorage.removeItem(`pos_require_opening_float_${staffKey}`);
          localStorage.removeItem(`pos_require_opening_float_${staffKey}`);

          // Mandatory Real-Time Shift Sign-In Alert Dispatch
          const targetTenantIds = Array.from(
            new Set(
              [
                String(restId || ""),
                authUser.organizationId ? String(authUser.organizationId) : "",
                authUser.restaurantId ? String(authUser.restaurantId) : "",
                "default",
              ].filter(Boolean)
            )
          );
          targetTenantIds.forEach((tId) => {
            dispatchShiftOpenedAlert(tId, {
              cashierName: authUser.name || openShift.cashier_name || "Cashier",
              shiftType: openShift.shift_type || "Active Shift",
              openingFloat: Number(openShift.opening_float) || 0,
              branchName: authUser.branchName || "Counter POS",
            });
          });

          setActiveUserSession(authUser);
          router.push("/terminal/pos");
          router.refresh();
          return;
        }

        // Fresh sign-in without a current-day active shift: MUST NOT bypass opening float modal
        clearStaleShiftStorage(restId, staffKey);

        // Strict Time Window Enforcement: Block staff members attempting to log in outside their assigned shift window
        if (!isStaffActiveOnOpenShift && authUser.assignedShift) {
          const shiftValidation = validateStaffShiftWindow(authUser.assignedShift, new Date(), authUser);
          if (!shiftValidation.isValid) {
            hideSplash();
            setErrorMessage(
              shiftValidation.errorMessage ||
              `Access Denied: Your assigned shift is ${shiftValidation.shiftShortName} (${shiftValidation.windowLabel}). You cannot log in during this shift window.`
            );
            setTimeout(() => setErrorMessage(null), 5000);
            return;
          }
        }

        // Query previous shift handover to display in the start shift modal
        const { data: lastShift } = await supabase
          .from("shift_settlements")
          .select("*")
          .eq("restaurant_id", restId)
          .neq("status", "OPEN")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const handoverSource = (!isStaleShift && openShift) ? openShift : lastShift;
        if (handoverSource) {
          setPreviousHandover({
            amount: Number(
              handoverSource.cash_handover_to_next_shift ??
              handoverSource.actual_cash_counted ??
              handoverSource.opening_float ??
              0
            ),
            cashierName: handoverSource.cashier_name || "Previous Cashier",
            shiftType: handoverSource.shift_type || "Previous Shift",
          });
        }

        // Trigger shift start modal strictly at login
        setPendingShiftStaffUser(authUser);
        setIsShiftModalOpen(true);
        return;
      } catch (err) {
        console.warn("[LoginPage] Shift check warning:", err);
        if (authUser.assignedShift) {
          const shiftValidation = validateStaffShiftWindow(authUser.assignedShift, new Date(), authUser);
          if (!shiftValidation.isValid) {
            hideSplash();
            setErrorMessage(
              shiftValidation.errorMessage ||
              `Access Denied: Your assigned shift is ${shiftValidation.shiftShortName} (${shiftValidation.windowLabel}). You cannot log in during this shift window.`
            );
            setTimeout(() => setErrorMessage(null), 5000);
            return;
          }
        }
        setPendingShiftStaffUser(authUser);
        setIsShiftModalOpen(true);
        return;
      }
    }

    // Non-cashier roles (KDS, Waiter, Rider, Manager, etc.)
    setActiveUserSession(authUser);

    // Universal Shift Logging telemetry for all non-cashier staff sessions
    try {
      await recordStaffShiftLogin(authUser, { station: rawRole });
    } catch (shiftErr) {
      console.warn("[LoginPage] Universal shift telemetry warning:", shiftErr);
    }

    if (rawRole === "chef" || rawRole === "kitchen") {
      router.push("/terminal/kitchen");
    } else if (rawRole === "waiter" || rawRole === "server" || isWaiter) {
      router.push("/terminal/waiter");
    } else if (rawRole === "rider") {
      router.push("/terminal/rider");
    } else {
      router.push("/terminal");
    }
    router.refresh();
  };

  const handleConfirmStartShiftOnLogin = async (payload: {
    shiftType: ShiftTypeOption;
    openingFloat: number;
    notes?: string;
  }) => {
    if (!pendingShiftStaffUser) return;
    const authUser = pendingShiftStaffUser;
    const supabase = createClient();
    const restId = authUser.restaurantId || authUser.organizationId || "40";
    const numericRestId = !isNaN(Number(restId)) ? Number(restId) : null;
    const branchId = authUser.branchId;
    const numericBranchId =
      typeof branchId === "number" && branchId > 0
        ? branchId
        : /^\d+$/.test(String(branchId || ""))
          ? parseInt(String(branchId), 10)
          : null;

    const cashierName = authUser.name || authUser.email || "Terminal Cashier";

    const shiftPayload: any = {
      restaurant_id: numericRestId,
      cashier_name: cashierName,
      shift_start: new Date().toISOString(),
      opening_float: payload.openingFloat,
      actual_cash_counted: 0,
      status: "OPEN",
      closing_notes: `[ROLE: CASHIER] Shift: ${payload.shiftType}${payload.notes ? " | " + payload.notes : ""}`,
      created_at: new Date().toISOString(),
    };

    if (numericBranchId) {
      shiftPayload.branch_id = numericBranchId;
    }

    let { data, error } = await supabase
      .from("shift_settlements")
      .insert([{ ...shiftPayload, shift_type: payload.shiftType }])
      .select()
      .single();

    if (error && (error.code === "PGRST204" || error.message?.includes("shift_type"))) {
      const retry = await supabase
        .from("shift_settlements")
        .insert([shiftPayload])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    const shiftRecord = data || {
      id: "shift_" + Date.now(),
      ...shiftPayload,
      shift_type: payload.shiftType,
    };

    // Store in both sessionStorage and localStorage for permanent session immunity
    const staffKey = String(authUser.id || authUser.email || authUser.name || "cashier")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
    sessionStorage.setItem(`pos_session_float_confirmed_${staffKey}`, "true");
    localStorage.setItem(`pos_session_float_confirmed_${staffKey}`, "true");
    sessionStorage.setItem("pos_session_float_confirmed_global", "true");
    localStorage.setItem("pos_session_float_confirmed_global", "true");
    sessionStorage.setItem(`pos_active_shift_${restId}`, JSON.stringify(shiftRecord));
    localStorage.setItem(`pos_active_shift_${restId}`, JSON.stringify(shiftRecord));
    sessionStorage.setItem(`pos_active_shift_${authUser.organizationId || restId}`, JSON.stringify(shiftRecord));
    localStorage.setItem(`pos_active_shift_${authUser.organizationId || restId}`, JSON.stringify(shiftRecord));
    sessionStorage.removeItem(`pos_require_opening_float_${staffKey}`);
    localStorage.removeItem(`pos_require_opening_float_${staffKey}`);

    // Mandatory Real-Time Shift Started Alert Dispatch
    const targetTenantIds = Array.from(
      new Set(
        [
          String(numericRestId || restId || ""),
          authUser.organizationId ? String(authUser.organizationId) : "",
          authUser.restaurantId ? String(authUser.restaurantId) : "",
          "default",
        ].filter(Boolean)
      )
    );
    targetTenantIds.forEach((tId) => {
      dispatchShiftOpenedAlert(tId, {
        cashierName: cashierName,
        shiftType: payload.shiftType,
        openingFloat: Number(payload.openingFloat) || 0,
        branchName: authUser.branchName || "Counter POS",
      });
    });

    setActiveUserSession(authUser);
    setIsShiftModalOpen(false);
    setPendingShiftStaffUser(null);

    router.push("/terminal/pos");
    router.refresh();
  };

  const handleTerminatePriorSessionAndLogin = async () => {
    if (!pendingConcurrentAuthUser) return;
    const authUser = pendingConcurrentAuthUser;
    const restId = authUser.restaurantId || authUser.organizationId || "40";
    try {
      await forceCloseStaffSession(restId, authUser);
    } catch (e) {
      console.warn("[LoginPage] Failed to force close prior session:", e);
    }
    setActiveSessionDetected(null);
    setPendingConcurrentAuthUser(null);
    await proceedWithStaffLogin(authUser);
  };

  const handleCancelConcurrentLogin = () => {
    setActiveSessionDetected(null);
    setPendingConcurrentAuthUser(null);
    setPassword("");
    setErrorMessage("Login blocked: An active session is currently running for this staff account. Please log out first.");
    setTimeout(() => setErrorMessage(null), 6000);
  };

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
      let staffQuery = supabase
        .from("staff_members")
        .select("*, restaurants(*)");

      if (trimmedEmail.includes("@")) {
        staffQuery = staffQuery.eq("email", trimmedEmail);
      } else {
        staffQuery = staffQuery.or(`email.eq.${trimmedEmail},phone.eq.${trimmedEmail}`);
      }

      const { data: staffData } = await staffQuery.maybeSingle();

      if (staffData) {
        if (staffData.password_hash === trimmedPassword || staffData.password_hash === password) {
          hideSplash();
          if (staffData.status !== "active") {
            setErrorMessage("This staff account is currently suspended or inactive. Contact branch manager.");
            setTimeout(() => setErrorMessage(null), 4000);
            return;
          }

          // Check if parent restaurant is deactivated
          const rest = staffData.restaurants || {};
          const restStatus = String(rest.status || "").toLowerCase().trim();
          const restInitStatus = String(rest.initial_status || "").toLowerCase().trim();
          if (restStatus === "inactive" || restStatus === "deactivated" || restInitStatus === "deactivated") {
            setErrorMessage("Your restaurant account has been deactivated by the Super Administrator. Please contact support.");
            setTimeout(() => setErrorMessage(null), 5000);
            return;
          }
          const rawRole = (staffData.role || "cashier").toLowerCase().trim();
          const authUser: AuthenticatedUser = {
            id: String(staffData.id),
            email: staffData.email || trimmedEmail,
            name: staffData.full_name || "Staff Member",
            role: "STAFF_MEMBER",
            userType: "STAFF",
            staffRole: rawRole as any,
            terminalAccess:
              rawRole === "waiter" || rawRole === "server" || staffData.terminal_access === "WAITER_ONLY"
                ? "WAITER_ONLY"
                : staffData.terminal_access ||
                  (rawRole === "cashier"
                    ? "POS_ONLY"
                    : rawRole === "chef"
                    ? "KDS_ONLY"
                    : rawRole === "rider"
                    ? "RIDER_ONLY"
                    : "FULL_ADMIN"),
            restaurantName: rest.brand_name || staffData.branch_name || "Restaurant",
            branchId: staffData.branch_id ? String(staffData.branch_id) : undefined,
            branchName: staffData.branch_name || undefined,
            city: rest.city || "",
            address: rest.hq_address || "",
            phone: staffData.phone || rest.phone || "",
            assignedFeatures: normalizeModules(rest.enabled_modules || ["pos_terminal", "kds_system", "rider_app"]),
            organizationId: String(staffData.restaurant_id || rest.id || "40"),
            restaurantId: String(staffData.restaurant_id || rest.id || "40"),
            assignedShift: parseShiftOption(staffData.shift) || staffData.shift || undefined,
            assigned_station: staffData.assigned_station || staffData.station || undefined,
            assignedStation: staffData.assigned_station || staffData.station || undefined,
            enableKitchenKds: rest.enable_kitchen_kds !== undefined ? Boolean(rest.enable_kitchen_kds) : (Array.isArray(rest.enabled_modules) ? rest.enabled_modules.includes("kds_system") : true),
            enableTableService: rest.enable_table_service !== undefined ? Boolean(rest.enable_table_service) : true,
            enableDirectThermalPrint: rest.enable_direct_thermal_print !== undefined ? Boolean(rest.enable_direct_thermal_print) : true,
            enableOfflineSync: rest.enable_offline_sync !== undefined ? Boolean(rest.enable_offline_sync) : true,
          };

          // Single-Session / Concurrent Login Prevention Check
          const restId = authUser.restaurantId || authUser.organizationId || "40";
          const activeSession = await checkActiveStaffSession(restId, authUser);
          if (activeSession) {
            hideSplash();
            setActiveSessionDetected(activeSession);
            setPendingConcurrentAuthUser(authUser);
            return;
          }

          await proceedWithStaffLogin(authUser);
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
      const localStaffList = getStoredStaff("40", []);
      const matchedLocalStaff = localStaffList.find(
        (s: any) => s.email && s.email.toLowerCase().trim() === trimmedEmail
      );
      if (matchedLocalStaff) {
        if (matchedLocalStaff.password === trimmedPassword || matchedLocalStaff.password === password) {
          hideSplash();
          const rawRole = (matchedLocalStaff.role || "cashier").toLowerCase().trim();
          const authUser: AuthenticatedUser = {
            id: String(matchedLocalStaff.id),
            email: matchedLocalStaff.email || trimmedEmail,
            name: matchedLocalStaff.name || "Staff Member",
            role: "STAFF_MEMBER",
            userType: "STAFF",
            staffRole: rawRole as any,
            terminalAccess:
              rawRole === "waiter" || rawRole === "server"
                ? "WAITER_ONLY"
                : matchedLocalStaff.terminalAccess ||
                  (rawRole === "cashier" ? "POS_ONLY" : rawRole === "chef" ? "KDS_ONLY" : "FULL_ADMIN"),
            restaurantName: matchedLocalStaff.branchName || "Restaurant",
            branchId: matchedLocalStaff.branchId ? String(matchedLocalStaff.branchId) : undefined,
            branchName: matchedLocalStaff.branchName,
            phone: matchedLocalStaff.phone || "",
            assignedFeatures: ["POS", "KITCHEN", "INVENTORY"],
            organizationId: "40",
            restaurantId: "40",
            assignedShift: parseShiftOption((matchedLocalStaff as any).shift) || (matchedLocalStaff as any).shift || undefined,
            assigned_station: (matchedLocalStaff as any).assigned_station || (matchedLocalStaff as any).assignedStation || undefined,
            assignedStation: (matchedLocalStaff as any).assigned_station || (matchedLocalStaff as any).assignedStation || undefined,
          };

          // Single-Session / Concurrent Login Prevention Check
          const activeSession = await checkActiveStaffSession("40", authUser);
          if (activeSession) {
            hideSplash();
            setActiveSessionDetected(activeSession);
            setPendingConcurrentAuthUser(authUser);
            return;
          }

          await proceedWithStaffLogin(authUser);
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
          const superAdminUser: AuthenticatedUser = {
            id: String(data.user.id),
            email: trimmedEmail,
            name: (data.user?.user_metadata?.full_name as string) || "Super Administrator",
            role: "SUPER_ADMIN",
            userType: "ADMIN",
            terminalAccess: "FULL_ADMIN",
            restaurantName: "Omnibites Platform",
            organizationId: "platform",
            restaurantId: "platform",
            assignedFeatures: ["OVERVIEW", "RESTAURANTS", "SUBSCRIPTIONS", "PAYMENTS", "SETTINGS"],
          };
          setActiveUserSession(superAdminUser);
          router.push("/super-admin/dashboard");
          router.refresh();
          return;
        }

        // -------------------------------------------------------------------------
        // B. BRANCH ADMIN CHECK (Staff / Manager assigned to a specific branch)
        // -------------------------------------------------------------------------
        if (rawUserMetaRole === "branch_admin") {
          const branchName = data.user?.user_metadata?.branch_name || "Branch Outlet";
          const orgId = data.user?.user_metadata?.organization_id || "40";
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
            assignedFeatures:
              Array.isArray(data.user?.user_metadata?.assigned_features) && data.user.user_metadata.assigned_features.length > 0
                ? data.user.user_metadata.assigned_features
                : ["OVERVIEW", "EXPENSES", "ANALYTICS", "STAFF", "SETTINGS", "SUBSCRIPTION"],
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
                  assignedFeatures: ["OVERVIEW", "EXPENSES", "ANALYTICS", "STAFF", "SETTINGS", "SUBSCRIPTION"],
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
                  assignedFeatures: ["OVERVIEW", "EXPENSES", "ANALYTICS", "STAFF", "SETTINGS", "SUBSCRIPTION"],
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

          // Validate restaurant operational status
          if (targetRest) {
            const restStatus = String(targetRest.status || "").toLowerCase().trim();
            const restInitStatus = String(targetRest.initial_status || "").toLowerCase().trim();
            if (restStatus === "inactive" || restStatus === "deactivated" || restInitStatus === "deactivated") {
              hideSplash();
              try {
                await supabase.auth.signOut();
              } catch {}
              setErrorMessage("Your restaurant account has been deactivated by the Super Administrator. Please contact support.");
              setTimeout(() => setErrorMessage(null), 5000);
              return;
            }
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
            enableKitchenKds: targetRest.enable_kitchen_kds !== undefined ? Boolean(targetRest.enable_kitchen_kds) : (Array.isArray(targetRest.enabled_modules) ? targetRest.enabled_modules.includes("kds_system") : true),
            enableTableService: targetRest.enable_table_service !== undefined ? Boolean(targetRest.enable_table_service) : true,
            enableDirectThermalPrint: targetRest.enable_direct_thermal_print !== undefined ? Boolean(targetRest.enable_direct_thermal_print) : true,
            enableOfflineSync: targetRest.enable_offline_sync !== undefined ? Boolean(targetRest.enable_offline_sync) : true,
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
                  Email
                </label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
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

        {/* Strict Login-Time Shift Start & Opening Float Modal */}
        {pendingShiftStaffUser && (
          <StartShiftModal
            isOpen={isShiftModalOpen}
            user={pendingShiftStaffUser}
            cashierName={pendingShiftStaffUser.name || "Terminal Cashier"}
            branchName={
              pendingShiftStaffUser.restaurantName ||
              pendingShiftStaffUser.branchName ||
              "Main Branch • Register #01"
            }
            currencySymbol="Rs"
            assignedShift={pendingShiftStaffUser.assignedShift as any}
            previousHandoverAmount={previousHandover?.amount}
            previousCashierName={previousHandover?.cashierName}
            previousShiftType={previousHandover?.shiftType}
            onConfirmStartShift={handleConfirmStartShiftOnLogin}
            onLogOut={() => {
              setIsShiftModalOpen(false);
              setPendingShiftStaffUser(null);
              clearUserSession();
            }}
          />
        )}

        {/* Active Session Lock & Concurrent Login Prevention Modal */}
        {activeSessionDetected && pendingConcurrentAuthUser && (
          <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1a140a]/98 border border-zinc-200 dark:border-[var(--border-hi)] shadow-2xl dark:shadow-[0_24px_60px_rgba(0,0,0,0.85),0_0_24px_rgba(227,177,59,0.08)] p-6 space-y-5 animate-in fade-in zoom-in-95 text-left font-sans">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs dark:shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[9px] font-bold uppercase tracking-wider mb-1">
                    Concurrency Guard Active
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-hi)]">
                    Active Session Detected
                  </h3>
                  <p className="text-xs text-[var(--text-lo)] mt-0.5 leading-relaxed">
                    This staff account is already logged in with an active shift open. Concurrent duplicate logins under the same staff credentials are not permitted.
                  </p>
                </div>
              </div>

              {/* Active Session Ledger Summary */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[var(--surface-hi)]/60 border border-zinc-200 dark:border-[var(--border)] space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-lo)]">Staff Member:</span>
                  <span className="font-bold text-[var(--text-hi)]">{activeSessionDetected.cashier_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-lo)]">Active Shift:</span>
                  <span className="font-bold text-[var(--gold)]">{activeSessionDetected.shift_type || "Day Shift"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-lo)]">Session Started:</span>
                  <span className="text-[var(--text-hi)]">
                    {activeSessionDetected.shift_start
                      ? new Date(activeSessionDetected.shift_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "Earlier today"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-lo)]">Terminal Role:</span>
                  <span className="uppercase text-amber-500 font-bold">{activeSessionDetected.staff_role}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleTerminatePriorSessionAndLogin}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl btn-gold text-xs font-bold text-[#342c14] flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all font-mono"
                >
                  <LogOut className="w-4 h-4 text-[#342c14]" />
                  <span>Terminate Prior &amp; Continue</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelConcurrentLogin}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[var(--surface-hi)] dark:hover:bg-[var(--surface)] text-zinc-700 dark:text-[var(--text-lo)] border border-zinc-200 dark:border-[var(--border)] text-xs font-bold font-mono cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* WhatsApp Floating Action Button */}
      <WhatsAppFloat />
    </div>
  );
}
