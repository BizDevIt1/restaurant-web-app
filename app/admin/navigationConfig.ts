import {
  LayoutDashboard,
  Building2,
  Users,
  UtensilsCrossed,
  Boxes,
  LayoutGrid,
  Receipt,
  Flame,
  Bike,
  SlidersHorizontal,
  CreditCard,
  Truck,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { AdminTab, UserRole } from "./types";

export interface NavigationItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  path: string;
  allowedRoles: UserRole[];
  requiredFeature?: string;
  badgeKey?: "branches" | "staff" | "menu" | "pos" | "kds" | "riders";
  tooltip: string;
}

export const NAVIGATION_REGISTRY: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    path: "/admin",
    allowedRoles: ["STANDALONE_ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    tooltip: "Revenue KPIs & live operations overview",
  },
  {
    id: "branches",
    label: "Branches",
    icon: Building2,
    path: "/admin/branches",
    allowedRoles: ["FRANCHISE_OWNER"], // Strictly Franchise Owner only - Never shown to Standalone or Branch Admin
    badgeKey: "branches",
    tooltip: "Multi-branch Network & Outlets Provisioning",
  },
  {
    id: "staff",
    label: "Staff Management",
    icon: Users,
    path: "/admin/staff",
    allowedRoles: ["STANDALONE_ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    badgeKey: "staff",
    tooltip: "Staff Roster & Terminal Screen Delegation",
  },
  {
    id: "menu",
    label: "Menu Management",
    icon: UtensilsCrossed,
    path: "/admin/menu",
    allowedRoles: ["STANDALONE_ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    requiredFeature: "MENU",
    badgeKey: "menu",
    tooltip: "Catalog, Pricing & 86'd Stock Control",
  },
  {
    id: "inventory",
    label: "Inventory & Stock",
    icon: Boxes,
    path: "/admin/inventory",
    allowedRoles: ["STANDALONE_ADMIN", "ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    tooltip: "Raw material balances and stock thresholds",
  },
  {
    id: "procurement",
    label: "Procurement & POs",
    icon: Truck,
    path: "/admin/procurement",
    allowedRoles: ["STANDALONE_ADMIN", "ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    tooltip: "Suppliers Directory & Purchase Orders",
  },
  {
    id: "expenses",
    label: "Expenses & OPEX",
    icon: Receipt,
    path: "/admin/expenses",
    allowedRoles: ["STANDALONE_ADMIN", "ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    tooltip: "Operating expenses and overheads",
  },
  {
    id: "tables",
    label: "Floor & Tables",
    icon: LayoutGrid,
    path: "/admin/tables",
    allowedRoles: ["STANDALONE_ADMIN", "ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    tooltip: "Real-time table occupancy & floor sections",
  },
  {
    id: "pos",
    label: "POS Counter",
    icon: Receipt,
    path: "/admin/pos",
    allowedRoles: ["STANDALONE_ADMIN", "BRANCH_ADMIN"], // Strictly Branch/Standalone Admin - Hidden for Franchise Owner
    requiredFeature: "POS",
    badgeKey: "pos",
    tooltip: "Point of Sale & Instant Thermal Billing",
  },
  {
    id: "kds",
    label: "Kitchen (KDS)",
    icon: Flame,
    path: "/admin/kitchen",
    allowedRoles: ["STANDALONE_ADMIN", "BRANCH_ADMIN"], // Strictly Branch/Standalone Admin - Hidden for Franchise Owner
    requiredFeature: "KITCHEN",
    badgeKey: "kds",
    tooltip: "Kitchen Display System & Chef Tickets",
  },
  {
    id: "riders",
    label: "Rider Dispatch",
    icon: Bike,
    path: "/admin/dispatch",
    allowedRoles: ["STANDALONE_ADMIN", "BRANCH_ADMIN"], // Strictly Branch/Standalone Admin - Hidden for Franchise Owner
    requiredFeature: "RIDER",
    badgeKey: "riders",
    tooltip: "Live Delivery Courier Dispatch & Fleet",
  },
  {
    id: "analytics",
    label: "Analytics & Reports",
    icon: BarChart3,
    path: "/admin/reports",
    allowedRoles: ["STANDALONE_ADMIN", "ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    tooltip: "Revenue Trends, Sales Insights & Order History",
  },
  {
    id: "settings",
    label: "Settings",
    icon: SlidersHorizontal,
    path: "/admin/settings",
    allowedRoles: ["STANDALONE_ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    tooltip: "Branch Config & Hardware Terminals",
  },
  {
    id: "subscription",
    label: "Subscription & Quota",
    icon: CreditCard,
    path: "/admin/subscription",
    allowedRoles: ["STANDALONE_ADMIN", "FRANCHISE_OWNER", "BRANCH_ADMIN"],
    tooltip: "SaaS License, Quotas & Invoicing",
  },
];

/**
 * Filter navigation items strictly according to user.role and user.assignedFeatures.
 * No disabled or 'locked' tabs are returned.
 */
export function getPermittedNavigation(
  role: UserRole,
  assignedFeatures: string[],
  terminalAccess?: "FULL_ADMIN" | "POS_ONLY" | "KDS_ONLY" | "RIDER_ONLY"
): NavigationItem[] {
  const roleStr = String(role || "").toUpperCase();
  const isAnyAdmin =
    roleStr === "ADMIN" ||
    roleStr === "STANDALONE_ADMIN" ||
    roleStr === "FRANCHISE_OWNER" ||
    roleStr === "BRANCH_ADMIN";

  // Terminal restrictions ONLY apply to kiosk staff, NEVER to Admins
  if (!isAnyAdmin && terminalAccess && terminalAccess !== "FULL_ADMIN") {
    if (terminalAccess === "POS_ONLY") {
      return NAVIGATION_REGISTRY.filter((item) => item.id === "pos");
    }
    if (terminalAccess === "KDS_ONLY") {
      return NAVIGATION_REGISTRY.filter((item) => item.id === "kds");
    }
    if (terminalAccess === "RIDER_ONLY") {
      return NAVIGATION_REGISTRY.filter((item) => item.id === "riders");
    }
  }

  const normalizedFeatures = assignedFeatures.map((f) => f.toUpperCase());
  return NAVIGATION_REGISTRY.filter((item) => {
    if (role === "STAFF_MEMBER") {
      if (item.id === "branches") return false;
      return true;
    }
    const roleStr = String(role || "").toUpperCase();
    const isAnyAdmin =
      roleStr === "ADMIN" ||
      roleStr === "STANDALONE_ADMIN" ||
      roleStr === "FRANCHISE_OWNER" ||
      roleStr === "BRANCH_ADMIN";

    if (item.id === "staff" && isAnyAdmin) {
      return true;
    }

    // 1. Role must be in allowedRoles
    if (!item.allowedRoles.includes(role) && !(roleStr === "ADMIN" && item.allowedRoles.includes("STANDALONE_ADMIN"))) {
      return false;
    }
    // 2. If a specific feature is required, verify user has it
    if (
      item.requiredFeature &&
      !normalizedFeatures.includes(item.requiredFeature.toUpperCase())
    ) {
      return false;
    }
    return true;
  });
}
