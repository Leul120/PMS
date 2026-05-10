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
  | "vendors:read" | "vendors:create" | "vendors:update" | "vendors:verify" | "vendors:delete"
  | "rfq:read" | "rfq:create" | "rfq:update" | "rfq:close" | "rfq:cancel"
  | "bids:read" | "bids:submit" | "bids:evaluate"
  | "po:read" | "po:create" | "po:approve" | "po:reject"
  | "requisitions:create" | "requisitions:approve"
  | "deliveries:read" | "deliveries:update"
  | "invoices:read" | "invoices:create" | "invoices:dispute" | "three-way-match:validate"
  | "scoring:read" | "scoring:calculate"
  | "inventory:read" | "inventory:update"
  | "users:read" | "users:create" | "users:update" | "users:delete"
  | "analytics:read" | "reports:view"
  | "audit:read" | "compliance:view"
  | "settings:read" | "settings:update";

const rolePermissions: Record<UserRole, Permission[]> = {
  ADMIN: [
    "vendors:read", "vendors:create", "vendors:update", "vendors:verify", "vendors:delete",
    "rfq:read", "rfq:create", "rfq:update", "rfq:close", "rfq:cancel",
    "bids:read", "bids:submit", "bids:evaluate",
    "po:read", "po:create", "po:approve", "po:reject",
    "requisitions:create", "requisitions:approve",
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute", "three-way-match:validate",
    "scoring:read", "scoring:calculate",
    "inventory:read", "inventory:update",
    "users:read", "users:create", "users:update", "users:delete",
    "analytics:read", "reports:view",
    "audit:read", "compliance:view",
    "settings:read", "settings:update",
  ],
  OFFICER: [
    "vendors:read", "vendors:create", "vendors:update", "vendors:verify",
    "rfq:read", "rfq:create", "rfq:update", "rfq:close", "rfq:cancel",
    "bids:read", "bids:evaluate",
    "po:read", "po:create",
    "requisitions:create",
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute", "three-way-match:validate",
    "scoring:read", "scoring:calculate",
    "inventory:read", "inventory:update",
    "analytics:read", "reports:view",
    "users:read",
  ],
  MANAGER: [
    "vendors:read",
    "rfq:read",
    "bids:read",
    "po:read", "po:approve", "po:reject",
    "requisitions:create", "requisitions:approve",
    "deliveries:read", "invoices:read",
    "scoring:read",
    "inventory:read",
    "analytics:read", "reports:view",
    "users:read",
  ],
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

function isValidJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      hasRole: (roles) => {
        const { user } = get();
        if (!user) return false;
        const userRole = user.role || user.roleName;
        return !!userRole && roles.includes(userRole);
      },
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        const userRole = user.role || user.roleName;
        if (!userRole) return false;
        return (rolePermissions[userRole] || []).includes(permission);
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.token && !isValidJwt(state.token)) {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            return;
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

export function validateAndCleanAuth() {
  if (typeof window === "undefined") return;
  try {
    const { token } = getStoredAuth();
    if (token && !isValidJwt(token)) {
      localStorage.removeItem("auth-storage");
      sessionStorage.removeItem("sessionActive");
      window.location.href = "/login";
    }
  } catch {
    localStorage.removeItem("auth-storage");
    sessionStorage.removeItem("sessionActive");
    window.location.href = "/login";
  }
}
