"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, UserRole } from "@/lib/auth-store";

interface RequireRoleProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

export function RequireRole({ children, allowedRoles, fallback = null }: RequireRoleProps) {
  const router = useRouter();
  const { user, hasRole, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user && !hasRole(allowedRoles)) {
      // Redirect to appropriate dashboard if user doesn't have permission
      const dashboard = getDashboardByRole(user.role);
      router.push(dashboard);
    }
  }, [isAuthenticated, user, allowedRoles, hasRole, router]);

  if (!isAuthenticated || !user) {
    return null;
  }

  if (!hasRole(allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RequirePermissionProps {
  children: ReactNode;
  permission: string;
  fallback?: ReactNode;
}

export function RequirePermission({ children, permission, fallback = null }: RequirePermissionProps) {
  const router = useRouter();
  const { user, hasPermission, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) {
    return null;
  }

  if (!hasPermission(permission as any)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Get dashboard URL based on user role
export function getDashboardByRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/dashboard/admin";
    case "OFFICER":
      return "/dashboard/officer";
    case "MANAGER":
      return "/dashboard/manager";
    case "AUDITOR":
      return "/dashboard/auditor";
    case "VENDOR":
      return "/dashboard/vendor";
    default:
      return "/dashboard";
  }
}

// Hook for role-based redirect after login
export function useRoleRedirect() {
  const router = useRouter();
  const { user } = useAuthStore();

  const redirectToDashboard = () => {
    if (user) {
      const dashboard = getDashboardByRole(user.role);
      router.push(dashboard);
    }
  };

  return { redirectToDashboard, getDashboardByRole };
}
