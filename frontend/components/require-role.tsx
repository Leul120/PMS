"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, UserRole } from "@/lib/auth-store";

interface RequireRoleProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

/**
 * Page-level role guard.
 * - Not authenticated → redirect to /login
 * - Authenticated but wrong role → redirect to the user's own dashboard (silent, no "Access Denied")
 * - Correct role → render children immediately (synchronous check, no flash)
 *
 * The synchronous null-return prevents any child useEffect from firing before
 * the redirect completes, which stops unauthorized API calls entirely.
 */
export function RequireRole({ children, allowedRoles }: RequireRoleProps) {
  const router = useRouter();
  const { user, hasRole, isAuthenticated } = useAuthStore();

  const userRole = user?.role || user?.roleName;
  const allowed = isAuthenticated && !!user && hasRole(allowedRoles);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && !hasRole(allowedRoles)) {
      router.replace(userRole ? getDashboardByRole(userRole) : "/login");
    }
  }, [isAuthenticated, user, allowedRoles, hasRole, router, userRole]);

  // Synchronous guard — render nothing until role is confirmed.
  // This prevents child components from mounting and firing API calls.
  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}

interface RequirePermissionProps {
  children: ReactNode;
  permission: string;
  /** Optional fallback — defaults to null (hidden). Use for inline elements only. */
  fallback?: ReactNode;
}

/**
 * Inline permission guard — hides children when the user lacks the permission.
 * Not for full pages; use RequireRole for pages.
 */
export function RequirePermission({ children, permission, fallback = null }: RequirePermissionProps) {
  const { user, hasPermission, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) return null;
  if (!hasPermission(permission as any)) return <>{fallback}</>;
  return <>{children}</>;
}

// Get dashboard URL based on user role
export function getDashboardByRole(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN": return "/";
    case "ADMIN":       return "/dashboard/admin";
    case "OFFICER":     return "/dashboard/officer";
    case "MANAGER":     return "/dashboard/manager";
    case "DIRECTOR":    return "/dashboard/director";
    case "AUDITOR":     return "/dashboard/auditor";
    case "VENDOR":
    case "VENDOR_ADMIN":
    case "VENDOR_SALES":
    case "VENDOR_FINANCE":
    case "VENDOR_LOGISTICS": return "/dashboard/vendor";
    case "REQUESTER":     return "/requisitions";
    default:            return "/";
  }
}

// Hook for role-based redirect after login
export function useRoleRedirect() {
  const router = useRouter();
  const { user } = useAuthStore();

  const redirectToDashboard = () => {
    if (user) {
      const userRole = user.role || user.roleName;
      if (userRole) router.push(getDashboardByRole(userRole));
    }
  };

  return { redirectToDashboard, getDashboardByRole };
}
