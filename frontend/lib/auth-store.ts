"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "ADMIN" | "OFFICER" | "MANAGER" | "AUDITOR" | "VENDOR";

export interface User {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  role: UserRole;
  roleName?: UserRole;
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
  | "invoices:dispute"
  | "three-way-match:validate"
  // Vendor Scoring
  | "scoring:read"
  | "scoring:calculate"
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
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute", "three-way-match:validate",
    "scoring:read", "scoring:calculate",
    "inventory:read", "inventory:update",
    "users:read", "users:create", "users:update", "users:delete",
    "analytics:read", "reports:view",
    "audit:read", "compliance:view",
    "settings:read", "settings:update",
  ],
  // OFFICER: Create RFQ, evaluate bids, manage vendors, create POs, validate invoices, trigger scoring
  OFFICER: [
    "vendors:read", "vendors:create", "vendors:update", "vendors:verify",
    "rfq:read", "rfq:create", "rfq:update", "rfq:close", "rfq:cancel",
    "bids:read", "bids:evaluate",
    "po:read", "po:create",
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute", "three-way-match:validate",
    "scoring:read", "scoring:calculate",
    "inventory:read", "inventory:update",
    "analytics:read", "reports:view",
    "users:read",
  ],
  // MANAGER: Approve high-value POs, view reports, view vendor scores
  MANAGER: [
    "vendors:read", "vendors:verify",
    "rfq:read",
    "bids:read",
    "po:read", "po:create", "po:approve", "po:reject",
    "deliveries:read", "invoices:read",
    "scoring:read",
    "inventory:read",
    "analytics:read", "reports:view",
    "users:read",
  ],
  // AUDITOR: Read-only access to all transactions, audit logs, compliance reports
  AUDITOR: [
    "vendors:read",
    "rfq:read",
    "bids:read",
    "po:read",
    "deliveries:read", "invoices:read",
    "scoring:read",
    "inventory:read",
    "users:read",
    "audit:read", "compliance:view",
    "analytics:read", "reports:view",
  ],
  // VENDOR: Submit bids, submit invoices, record deliveries, view own score
  VENDOR: [
    "vendors:read",
    "rfq:read",
    "bids:read", "bids:submit",
    "po:read",
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute",
    "scoring:read",
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
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
      hasRole: (roles) => {
        const { user } = get();
        if (!user) return false;
        const userRole = user.role || user.roleName;
        if (!userRole) return false;
        return roles.includes(userRole);
      },
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        const userRole = user.role || user.roleName;
        if (!userRole) return false;
        const permissions = rolePermissions[userRole] || [];
        return permissions.includes(permission);
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Validate JWT token format
          if (state.token) {
            const parts = state.token.split('.');
            if (parts.length !== 3) {
              console.error('Invalid JWT token format in storage - clearing auth');
              state.user = null;
              state.token = null;
              state.isAuthenticated = false;
              return;
            }
            
            // Check each part is not empty
            for (const part of parts) {
              if (!part || part.length === 0) {
                console.error('Invalid JWT token structure in storage - clearing auth');
                state.user = null;
                state.token = null;
                state.isAuthenticated = false;
                return;
              }
            }
          }
          
          state.isAuthenticated = !!(state.user && state.token);
        }
      },
    }
  )
);

export function getStoredAuth(): { user: User | null; token: string | null } {
  if (typeof window === "undefined") return { user: null, token: null };
  try {
    const stored = localStorage.getItem("auth-storage");
    if (!stored) return { user: null, token: null };
    const parsed = JSON.parse(stored);
    return {
      user: parsed?.state?.user ?? null,
      token: parsed?.state?.token ?? null,
    };
  } catch {
    return { user: null, token: null };
  }
}

// Function to validate and clean up authentication state
export function validateAndCleanAuth() {
  if (typeof window === "undefined") return;
  
  try {
    const stored = localStorage.getItem("auth-storage");
    if (!stored) return;
    
    const parsed = JSON.parse(stored);
    const state = parsed?.state;
    
    if (state?.token) {
      const parts = state.token.split('.');
      if (parts.length !== 3 || parts.some((part: string) => !part || part.length === 0)) {
        console.error('Invalid JWT token found - clearing authentication');
        localStorage.removeItem("auth-storage");
        sessionStorage.removeItem("sessionActive");
        window.location.href = "/login";
        return;
      }
    }
  } catch (error) {
    console.error('Error validating auth state:', error);
    localStorage.removeItem("auth-storage");
    sessionStorage.removeItem("sessionActive");
    window.location.href = "/login";
  }
}
