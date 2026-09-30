"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthenticatedUser, BranchData, UserRole } from "../types";
import { createClient } from "../../../lib/supabase";
import {
  getActiveUserSession,
  setActiveUserSession,
  getStoredFranchiseBranches,
  saveFranchiseBranches,
  saveBranchAccount,
  clearUserSession,
  sanitizeUserSession,
  getStoredRestaurants,
  normalizeModules,
} from "../../../lib/tenantStore";

interface AuthContextType {
  user: AuthenticatedUser | null;
  setUser: React.Dispatch<React.SetStateAction<AuthenticatedUser | null>>;
  activeBranchId: string;
  setActiveBranchId: (branchId: string) => void;
  selectedBranch: BranchData | null;
  isAdmin: boolean;
  isFranchiser: boolean;
  isStandaloneAdmin: boolean;
  isFranchiseOwner: boolean;
  isBranchAdmin: boolean;
  hasFeature: (feature: string) => boolean;
  refreshEntitlements: () => Promise<void>;
  switchRolePreset: (role: UserRole) => void;
  addBranchToFranchise: (branch: BranchData, password?: string) => void;
  updateRestaurantProfile: (data: {
    brandName?: string;
    logoUrl?: string;
    phone?: string;
    cuisine?: string;
    address?: string;
    city?: string;
    email?: string;
  }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize strictly with real authenticated session - ZERO mock seeds
  const [user, setUser] = useState<AuthenticatedUser | null>(() => sanitizeUserSession(getActiveUserSession()));
  const [activeBranchId, setActiveBranchId] = useState<string>("all");

  // Real-time entitlement refresh: queries Supabase restaurants directly to get fresh enabled_modules
  const refreshEntitlements = async () => {
    try {
      const currentSession = sanitizeUserSession(getActiveUserSession()) || user;
      if (!currentSession) return;

      const trimmedEmail = (currentSession.email || "").trim().toLowerCase();
      const isUuid = (val?: any) => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      // 1. Resolve numeric restaurant primary key ID if available
      const rawRestId = currentSession.organizationId || currentSession.restaurantId || (!isUuid(currentSession.id) ? currentSession.id : null);
      const numericId = rawRestId ? parseInt(String(rawRestId).replace(/[^0-9]/g, ""), 10) : null;
      const validNumericId = numericId && !isNaN(numericId) && numericId > 0 ? numericId : null;

      // 2. Resolve owner UUID
      let ownerUuid: string | null = isUuid(currentSession.id) ? currentSession.id : (currentSession as any).owner_id || null;

      let freshModules: any[] | null = null;
      let freshBrandName: string | null = null;
      let freshBranches: any[] | null = null;

      // 1. Direct query to Supabase public.restaurants for real-time entitlement state
      try {
        const supabase = createClient();

        if (!ownerUuid) {
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser?.id && isUuid(authUser.id)) {
              ownerUuid = authUser.id;
            }
          } catch {}
        }

        // Build PostgREST OR conditions with strict type safety (NEVER pass non-numeric to id.eq!)
        const orConditions: string[] = [];
        if (validNumericId) {
          orConditions.push(`id.eq.${validNumericId}`);
        }
        if (ownerUuid) {
          orConditions.push(`owner_id.eq.${ownerUuid}`);
        }
        if (trimmedEmail) {
          orConditions.push(`owner_email.eq.${trimmedEmail}`);
        }

        let rest: any = null;

        if (orConditions.length > 0) {
          const { data, error } = await supabase
            .from("restaurants")
            .select("enabled_modules, brand_name, branches, id, owner_id, owner_email")
            .or(orConditions.join(","))
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            rest = data;
          } else if (error) {
            console.warn("[AuthContext] Supabase .or query notice:", error.message);
          }
        }

        // Targeted individual queries if .or did not match
        if (!rest && validNumericId) {
          const { data } = await supabase
            .from("restaurants")
            .select("enabled_modules, brand_name, branches, id, owner_id, owner_email")
            .eq("id", validNumericId)
            .maybeSingle();
          if (data) rest = data;
        }

        if (!rest && ownerUuid) {
          const { data } = await supabase
            .from("restaurants")
            .select("enabled_modules, brand_name, branches, id, owner_id, owner_email")
            .eq("owner_id", ownerUuid)
            .maybeSingle();
          if (data) rest = data;
        }

        if (!rest && trimmedEmail) {
          const { data } = await supabase
            .from("restaurants")
            .select("enabled_modules, brand_name, branches, id, owner_id, owner_email")
            .eq("owner_email", trimmedEmail)
            .maybeSingle();
          if (data) rest = data;
        }

        if (rest) {
          freshModules = Array.isArray(rest.enabled_modules) ? rest.enabled_modules : [];
          if (rest.brand_name) freshBrandName = rest.brand_name;
          if (Array.isArray(rest.branches)) freshBranches = rest.branches;
          console.log("[AuthContext] Live enabled_modules from Supabase:", freshModules);
        }
      } catch (err) {
        console.warn("[AuthContext] Supabase real-time module query notice:", err);
      }

      // 2. Fallback check via server API route
      if (freshModules === null) {
        try {
          const params = new URLSearchParams();
          if (validNumericId) params.set("id", String(validNumericId));
          if (ownerUuid) params.set("owner_id", ownerUuid);
          if (trimmedEmail) params.set("email", trimmedEmail);

          const res = await fetch(`/api/admin/restaurant?${params.toString()}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const json = await res.json();
            if (json.restaurant) {
              freshModules = Array.isArray(json.restaurant.enabled_modules) ? json.restaurant.enabled_modules : [];
              if (json.restaurant.brand_name) freshBrandName = json.restaurant.brand_name;
              if (Array.isArray(json.restaurant.branches)) freshBranches = json.restaurant.branches;
            }
          }
        } catch {}
      }

      // 3. Fallback check from Super Admin localStorage cache
      if (freshModules === null && typeof window !== "undefined") {
        const localList = getStoredRestaurants();
        const matched = localList.find((r: any) => {
          const rEmail = (r.email || r.owner_email || "").trim().toLowerCase();
          const rId = String(r.id || "");
          const rOwnerId = String(r.owner_id || "");
          return (
            (trimmedEmail && rEmail === trimmedEmail) ||
            (validNumericId && rId === String(validNumericId)) ||
            (ownerUuid && (rOwnerId === ownerUuid || rId === ownerUuid))
          );
        });
        if (matched) {
          freshModules = Array.isArray(matched.enabled_modules) ? matched.enabled_modules : [];
          if (matched.brand_name) freshBrandName = matched.brand_name;
          if (Array.isArray(matched.branches)) freshBranches = matched.branches;
        }
      }

      if (freshModules !== null) {
        const normalized = normalizeModules(freshModules);

        // Check if assignedFeatures changed
        const currentFeats = (user?.assignedFeatures || currentSession.assignedFeatures || []).map((f) => f.toUpperCase().trim()).sort();
        const nextFeats = [...normalized].map((f) => f.toUpperCase().trim()).sort();
        const hasChanged = JSON.stringify(currentFeats) !== JSON.stringify(nextFeats);

        if (hasChanged || !currentSession.assignedFeatures || currentSession.assignedFeatures.length === 0) {
          console.log("[AuthContext] Hydrated fresh entitlements from database:", normalized);
          const updatedUser: AuthenticatedUser = sanitizeUserSession({
            ...currentSession,
            assignedFeatures: normalized,
            restaurantName: freshBrandName || currentSession.restaurantName,
            branches: freshBranches || currentSession.branches,
          })!;

          setUser(updatedUser);
          setActiveUserSession(updatedUser);
        }
      }
    } catch (e) {
      console.warn("[AuthContext] Error in refreshEntitlements:", e);
    }
  };

  // Hydrate on mount from client-side storage + real-time database refresh
  useEffect(() => {
    const session = sanitizeUserSession(getActiveUserSession());
    if (session) {
      if (session.role === "FRANCHISE_OWNER") {
        const storedBranches = getStoredFranchiseBranches(session.organizationId || session.id);
        if (storedBranches.length > 0) {
          session.branches = storedBranches;
        }
      }
      setUser(sanitizeUserSession(session));
    }

    // Immediately trigger real-time database entitlement sync
    refreshEntitlements();

    // Re-verify entitlements whenever user returns to tab / window regains focus
    const handleFocus = () => {
      refreshEntitlements();
    };

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        refreshEntitlements();
      }
    };

    const handleStorage = () => {
      refreshEntitlements();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("sa_restaurants_updated", handleStorage);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("sa_restaurants_updated", handleStorage);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, []);

  // Update active branches when user changes
  useEffect(() => {
    if (user?.role === "FRANCHISE_OWNER" && user.branches && user.branches.length > 0) {
      if (activeBranchId !== "all" && !user.branches.some((b) => b.id === activeBranchId)) {
        setActiveBranchId("all");
      }
    }
  }, [user, activeBranchId]);

  const switchRolePreset = (role: UserRole) => {
    if (!user) return;
    if (role === "FRANCHISE_OWNER") {
      setActiveBranchId("all");
    } else if (role === "BRANCH_ADMIN") {
      if (user.branches && user.branches.length > 0) {
        setActiveBranchId(user.branches[0].id);
      }
    }
  };

  const addBranchToFranchise = (newBranch: BranchData, password: string = "Password123!") => {
    if (!user) return;
    const updatedBranches = [...(user.branches || []), newBranch];
    const updatedUser: AuthenticatedUser = sanitizeUserSession({
      ...user,
      branches: updatedBranches,
      branchesCount: updatedBranches.length,
    })!;

    setUser(updatedUser);
    saveFranchiseBranches(updatedBranches, user.organizationId || user.id);
    setActiveUserSession(updatedUser);

    // 1. Register the BRANCH_ADMIN user account locally
    saveBranchAccount({
      email: newBranch.managerEmail || `branch.${newBranch.code.toLowerCase()}@omnibites.com`,
      password: password,
      name: newBranch.managerName,
      role: "BRANCH_ADMIN",
      restaurantName: user.restaurantName,
      city: newBranch.city,
      address: newBranch.address,
      phone: newBranch.phone,
      branchId: newBranch.id,
      branchName: newBranch.name,
      assignedFeatures: newBranch.assignedFeatures || [],
      organizationId: user.organizationId || user.id,
    });

    // 2. Update cached restaurant records in omni_restaurants and sa_restaurants
    if (typeof window !== "undefined") {
      try {
        const orgId = user.organizationId || user.id;
        const storedList = JSON.parse(localStorage.getItem("omni_restaurants") || "[]");
        const updatedList = storedList.map((r: any) => {
          if (String(r.id) === String(orgId)) {
            return {
              ...r,
              branches: updatedBranches,
            };
          }
          return r;
        });
        localStorage.setItem("omni_restaurants", JSON.stringify(updatedList));
        localStorage.setItem("sa_restaurants", JSON.stringify(updatedList));
      } catch {}
    }

    // 3. Asynchronously provision into backend / Supabase if online
    if (typeof window !== "undefined") {
      fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchName: newBranch.name,
          branchCode: newBranch.code,
          city: newBranch.city,
          address: newBranch.address,
          phone: newBranch.phone,
          managerName: newBranch.managerName,
          managerEmail: newBranch.managerEmail,
          managerPassword: password,
          assignedFeatures: newBranch.assignedFeatures || [],
          organizationId: user.organizationId || user.id,
        }),
      }).catch((err) => console.warn("[Sync Branch API Exception]:", err));
    }
  };

  const hasFeature = (feature: string): boolean => {
    if (!user || !user.assignedFeatures) return false;
    return user.assignedFeatures.some(
      (f) => f.toUpperCase() === feature.toUpperCase()
    );
  };

  const selectedBranch =
    user?.role === "FRANCHISE_OWNER" && user.branches
      ? user.branches.find((b) => b.id === activeBranchId) || null
      : null;

  const updateRestaurantProfile = (data: {
    brandName?: string;
    logoUrl?: string;
    phone?: string;
    cuisine?: string;
    address?: string;
    city?: string;
    email?: string;
  }) => {
    if (!user) return;
    const updatedUser: AuthenticatedUser = sanitizeUserSession({
      ...user,
      restaurantName: data.brandName !== undefined ? data.brandName : user.restaurantName,
      logoUrl: data.logoUrl !== undefined ? data.logoUrl : user.logoUrl,
      phone: data.phone !== undefined ? data.phone : user.phone,
      cuisine: data.cuisine !== undefined ? data.cuisine : user.cuisine,
      address: data.address !== undefined ? data.address : user.address,
      city: data.city !== undefined ? data.city : user.city,
      email: data.email !== undefined ? data.email : user.email,
    })!;

    setUser(updatedUser);
    setActiveUserSession(updatedUser);

    if (typeof window !== "undefined") {
      try {
        const orgId = user.organizationId || user.id;
        ["omni_restaurants", "sa_restaurants"].forEach((key) => {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const updated = list.map((r: any) => {
                if (String(r.id) === String(orgId)) {
                  return {
                    ...r,
                    brand_name: data.brandName !== undefined ? data.brandName : r.brand_name,
                    logo_url: data.logoUrl !== undefined ? data.logoUrl : r.logo_url,
                    phone: data.phone !== undefined ? data.phone : r.phone,
                    cuisine: data.cuisine !== undefined ? data.cuisine : r.cuisine,
                    hq_address: data.address !== undefined ? data.address : r.hq_address,
                  };
                }
                return r;
              });
              localStorage.setItem(key, JSON.stringify(updated));
            }
          }
        });
      } catch {}
    }
  };

  const logout = async () => {
    clearUserSession();
    try {
      const { createClient } = await import("../../../lib/supabase");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  };

  const isStandaloneAdmin = user?.role === "STANDALONE_ADMIN";
  const isFranchiseOwner = user?.role === "FRANCHISE_OWNER";
  const isBranchAdmin = user?.role === "BRANCH_ADMIN";

  // Backwards compatibility flags
  const isAdmin = isStandaloneAdmin || isBranchAdmin;
  const isFranchiser = isFranchiseOwner;

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        activeBranchId,
        setActiveBranchId,
        selectedBranch,
        isAdmin,
        isFranchiser,
        isStandaloneAdmin,
        isFranchiseOwner,
        isBranchAdmin,
        hasFeature,
        refreshEntitlements,
        switchRolePreset,
        addBranchToFranchise,
        updateRestaurantProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
