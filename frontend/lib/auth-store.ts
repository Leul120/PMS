"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OperatingContext, OrganizationType } from "@/lib/operating-context";

export type UserRole = "ADMIN" | "OFFICER" | "MANAGER" | "AUDITOR" | "VENDOR" | "VENDOR_ADMIN" | "VENDOR_SALES" | "VENDOR_FINANCE" | "VENDOR_LOGISTICS" | "DIRECTOR" | "SUPER_ADMIN" | "REQUESTER";

export function isVendorRole(role: string | undefined | null): boolean {
  return role === "VENDOR" || role === "VENDOR_ADMIN" || role === "VENDOR_SALES" || role === "VENDOR_FINANCE" || role === "VENDOR_LOGISTICS";
}

export const VENDOR_ROLES: UserRole[] = ["VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "VENDOR_LOGISTICS"];

export function isBuyerRole(role: string | undefined | null): boolean {
  return !!role && ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "REQUESTER", "SUPER_ADMIN"].includes(role);
}

export interface TenantInfo {
  tenantId: number;
  tenantName: string;
  tenantDomain: string;
}

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
  tenantId?: number;
  tenantName?: string;
  tenantDomain?: string;
  /** Primary procurement role (unchanged when switching to Sales context). */
  procurementRole?: UserRole;
}

interface AuthState {
  user: User | null;
  token: string | null;
  tenantId: number | null;
  tenantName: string | null;
  tenantDomain: string | null;
  organizationType: OrganizationType | null;
  operatingContext: OperatingContext;
  availableContexts: string[];
  supplierRoleName: string | null;
  isAuthenticated: boolean;
  setAuth: (
    user: User,
    token: string,
    tenant?: TenantInfo,
    session?: {
      organizationType?: OrganizationType;
      operatingContext?: OperatingContext;
      availableContexts?: string[];
      supplierRole?: string | null;
    },
  ) => void;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  isSalesContext: () => boolean;
}

export type Permission =
  | "vendors:read" | "vendors:create" | "vendors:update" | "vendors:verify" | "vendors:delete"
  | "rfq:read" | "rfq:create" | "rfq:update" | "rfq:close" | "rfq:cancel"
  | "bids:read" | "bids:submit" | "bids:evaluate"
  | "po:read" | "po:create" | "po:approve" | "po:reject"
  | "requisitions:create" | "requisitions:approve"
  | "deliveries:read" | "deliveries:update"
  | "invoices:read" | "invoices:create" | "invoices:dispute" | "invoices:mark-paid" | "disputes:resolve" | "three-way-match:validate"
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
    "bids:read", "bids:evaluate",
    "po:read", "po:create", "po:approve", "po:reject",
    "requisitions:create", "requisitions:approve",
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute", "invoices:mark-paid", "disputes:resolve", "three-way-match:validate",
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
    "invoices:read", "invoices:create", "invoices:dispute", "invoices:mark-paid", "disputes:resolve", "three-way-match:validate",
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
    "deliveries:read", "invoices:read", "invoices:mark-paid",
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
  VENDOR_ADMIN: [
    "vendors:read",
    "rfq:read",
    "bids:read", "bids:submit",
    "po:read",
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute",
    "scoring:read",
    "users:read", "users:create",
  ],
  VENDOR_SALES: [
    "vendors:read",
    "rfq:read",
    "bids:read", "bids:submit",
    "po:read",
    "deliveries:read",
    "invoices:read",
    "scoring:read",
  ],
  VENDOR_FINANCE: [
    "vendors:read",
    "rfq:read",
    "bids:read",
    "po:read",
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute",
    "scoring:read",
  ],
  VENDOR_LOGISTICS: [
    "vendors:read",
    "rfq:read",
    "bids:read",
    "po:read",
    "deliveries:read", "deliveries:update",
    "scoring:read",
  ],
  REQUESTER: [
    "requisitions:create",
    "rfq:read",
    "po:read",
    "deliveries:read",
    "invoices:read",
  ],
  DIRECTOR: [
    "vendors:read",
    "rfq:read",
    "bids:read",
    "po:read", "po:approve", "po:reject",
    "requisitions:approve",
    "deliveries:read", "invoices:read",
    "scoring:read",
    "inventory:read",
    "users:read",
    "analytics:read", "reports:view",
    "settings:read", "settings:update",
  ],
  SUPER_ADMIN: [
    "vendors:read", "vendors:create", "vendors:update", "vendors:verify", "vendors:delete",
    "rfq:read", "rfq:create", "rfq:update", "rfq:close", "rfq:cancel",
    "bids:read", "bids:evaluate",
    "po:read", "po:create", "po:approve", "po:reject",
    "requisitions:create", "requisitions:approve",
    "deliveries:read", "deliveries:update",
    "invoices:read", "invoices:create", "invoices:dispute", "invoices:mark-paid", "disputes:resolve", "three-way-match:validate",
    "scoring:read", "scoring:calculate",
    "inventory:read", "inventory:update",
    "users:read", "users:create", "users:update", "users:delete",
    "analytics:read", "reports:view",
    "audit:read", "compliance:view",
    "settings:read", "settings:update",
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
      tenantId: null,
      tenantName: null,
      tenantDomain: null,
      organizationType: null,
      operatingContext: "PROCUREMENT",
      availableContexts: [],
      supplierRoleName: null,
      isAuthenticated: false,
      setAuth: (user, token, tenant?, session?) => set({
        user,
        token,
        tenantId: tenant?.tenantId ?? user.tenantId ?? null,
        tenantName: tenant?.tenantName ?? user.tenantName ?? null,
        tenantDomain: tenant?.tenantDomain ?? user.tenantDomain ?? null,
        organizationType: session?.organizationType ?? null,
        operatingContext: session?.operatingContext ?? "PROCUREMENT",
        availableContexts: session?.availableContexts ?? [],
        supplierRoleName: session?.supplierRole ?? null,
        isAuthenticated: true,
      }),
      logout: () => set({
        user: null, token: null, tenantId: null, tenantName: null, tenantDomain: null,
        organizationType: null, operatingContext: "PROCUREMENT", availableContexts: [], supplierRoleName: null,
        isAuthenticated: false,
      }),
      isSalesContext: () => get().operatingContext === "SALES",
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
      storage: typeof window !== "undefined"
        ? createJSONStorage(() => sessionStorage)
        : undefined,
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.token && !isValidJwt(state.token)) {
            state.user = null;
            state.token = null;
            state.tenantId = null;
            state.tenantName = null;
            state.tenantDomain = null;
            state.isAuthenticated = false;
            return;
          }
          state.isAuthenticated = !!(state.user && state.token);
        }
      },
    }
  )
);

export function getStoredAuth(): { user: User | null; token: string | null; tenantId: number | null; tenantName: string | null; tenantDomain: string | null } {
  if (typeof window === "undefined") return { user: null, token: null, tenantId: null, tenantName: null, tenantDomain: null };
  try {
    const stored = sessionStorage.getItem("auth-storage");
    if (!stored) return { user: null, token: null, tenantId: null, tenantName: null, tenantDomain: null };
    const parsed = JSON.parse(stored);
    return {
      user: parsed?.state?.user ?? null,
      token: parsed?.state?.token ?? null,
      tenantId: parsed?.state?.tenantId ?? null,
      tenantName: parsed?.state?.tenantName ?? null,
      tenantDomain: parsed?.state?.tenantDomain ?? null,
    };
  } catch {
    return { user: null, token: null, tenantId: null, tenantName: null, tenantDomain: null };
  }
}

export function validateAndCleanAuth() {
  if (typeof window === "undefined") return;
  try {
    const { token } = getStoredAuth();
    if (token && !isValidJwt(token)) {
      sessionStorage.removeItem("auth-storage");
      sessionStorage.removeItem("sessionActive");
      window.location.href = "/login";
    }
  } catch {
    sessionStorage.removeItem("auth-storage");
    sessionStorage.removeItem("sessionActive");
    window.location.href = "/login";
  }
}
