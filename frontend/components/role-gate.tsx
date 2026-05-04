"use client";

import { ReactNode } from "react";
import { useAuthStore, UserRole, Permission } from "@/lib/auth-store";

interface RoleGateProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
  const hasRole = useAuthStore((state) => state.hasRole);
  
  if (!hasRole(allowedRoles)) {
    return fallback;
  }
  
  return <>{children}</>;
}

interface PermissionGateProps {
  children: ReactNode;
  permission: Permission;
  fallback?: ReactNode;
}

export function PermissionGate({ children, permission, fallback = null }: PermissionGateProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  
  if (!hasPermission(permission)) {
    return fallback;
  }
  
  return <>{children}</>;
}

interface HideForRolesProps {
  children: ReactNode;
  roles: UserRole[];
}

export function HideForRoles({ children, roles }: HideForRolesProps) {
  const hasRole = useAuthStore((state) => state.hasRole);
  
  if (hasRole(roles)) {
    return null;
  }
  
  return <>{children}</>;
}
