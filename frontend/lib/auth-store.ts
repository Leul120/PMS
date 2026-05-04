"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "ADMIN" | "OFFICER" | "MANAGER" | "AUDITOR" | "VENDOR";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  active: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
}

export type Permission =
  // Vendor Management
  | "vendors:read"
  | "vendors:create"
  | "vendors:update"
  | "vendors:verify"
  | "vendors:delete"
  // RFQ & Bidding
  | "rfq:read"
  | "rfq:create"
  | "rfq:update"
  | "rfq:close"
  | "rfq:cancel"
  | "bids:read"
  | "bids:submit"
  | "bids:evaluate"
  // Purchase Orders
  | "po:read"
  | "po:create"
  | "po:approve"
  | "po:reject"
  // Deliveries & Invoices
  | "deliveries:read"
  | "deliveries:update"
  | "invoices:read"
  | "invoices:create"
  | "three-way-match:validate"
  // Inventory
  | "inventory:read"
  | "inventory:update"
  // User Management
  | "users:read"
  | "users:create"
  | "users:update"
  | "users:delete"
  // Analytics & Reports
  | "analytics:read"
  | "reports:view"
  // Audit & Compliance
  | "audit:read"
  | "compliance:view"
  // Settings
  | "settings:read"
  | "settings:update";

const rolePermissions: Record<UserRole, Permission[]> = {
  // ADMIN: Full system access
  ADMIN: [
    "vendors:read", "vendors:create", "vendors:update", "vendors:verify", "vendors:delete",
    "rfq:read", "rfq:create", "rfq:update", "rfq:close", "rfq:cancel",
    "bids:read", "bids:submit", "bids:evaluate",
    "po:read", "po:create", "po:approve", "po:reject",
    "deliveries:read", "deliveries:update", "invoices:read", "invoices:create", "three-way-match:validate",
    "inventory:read", "inventory:update",
    "users:read", "users:create", "users:update", "users:delete",
    "analytics:read", "reports:view",
    "audit:read", "compliance:view",
    "settings:read", "settings:update",
  ],
  // OFFICER (Procurement Officer): Create RFQ, evaluate bids, manage vendors, view data
  OFFICER: [
    "vendors:read", "vendors:create", "vendors:update", "vendors:verify",
    "rfq:read", "rfq:create", "rfq:update", "rfq:close",
    "bids:read", "bids:evaluate",
    "po:read", "po:create",
    "deliveries:read", "deliveries:update", "invoices:read", "three-way-match:validate",
    "inventory:read", "inventory:update",
    "analytics:read", "reports:view",
  ],
  // MANAGER: Approve high-value POs, view reports, view vendor scores
  MANAGER: [
    "vendors:read", "vendors:verify",
    "rfq:read",
    "bids:read",
    "po:read", "po:approve", "po:reject",
    "deliveries:read",
    "inventory:read",
    "analytics:read", "reports:view",
  ],
  // AUDITOR: Read-only access to all transactions, audit logs, compliance reports
  AUDITOR: [
    "vendors:read",
    "rfq:read",
    "bids:read",
    "po:read",
    "deliveries:read", "invoices:read",
    "inventory:read",
    "audit:read", "compliance:view",
    "analytics:read", "reports:view",
  ],
  // VENDOR: Register, update own profile, submit bids, view own data
  VENDOR: [
    "vendors:read",
    "rfq:read",
    "bids:read", "bids:submit",
    "po:read",
    "deliveries:read",
    "inventory:read",
  ],
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        set({ user, token, isAuthenticated: true });
        if (typeof window !== "undefined") {
          localStorage.setItem("token", token);
          localStorage.setItem("user", JSON.stringify(user));
        }
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      },
      hasRole: (roles) => {
        const { user } = get();
        if (!user) return false;
        return roles.includes(user.role);
      },
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        const permissions = rolePermissions[user.role] || [];
        return permissions.includes(permission);
      },
    }),
    {
      name: "auth-storage",
    }
  )
);

export function getStoredAuth(): { user: User | null; token: string | null } {
  if (typeof window === "undefined") return { user: null, token: null };
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) as User : null;
  return { user, token };
}
