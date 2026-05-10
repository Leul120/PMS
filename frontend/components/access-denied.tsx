"use client";

import { ShieldOff } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

interface AccessDeniedProps {
  /** Optional message override */
  message?: string;
}

/**
 * Shown when a user navigates to a page they don't have permission to view.
 * Wraps in DashboardLayout so the sidebar/header remain visible.
 */
export function AccessDenied({ message = "You don't have permission to view this page." }: AccessDeniedProps) {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="rounded-full bg-gray-100 p-4">
          <ShieldOff className="h-8 w-8 text-gray-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Access Restricted</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">{message}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
