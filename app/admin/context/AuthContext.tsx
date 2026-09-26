"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthenticatedUser, BranchData, UserRole } from "../types";
import {
  getActiveUserSession,
  setActiveUserSession,
  getStoredFranchiseBranches,
  saveFranchiseBranches,
  saveBranchAccount,
  clearUserSession,
  sanitizeUserSession,
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

  // Hydrate on mount from client-side storage
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
