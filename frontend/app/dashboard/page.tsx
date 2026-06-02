"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { getDashboardByRole } from "@/components/require-role";

export default function DashboardRedirect() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    const role = user?.role || user?.roleName;
    router.replace(role ? getDashboardByRole(role) : "/");
  }, [isAuthenticated, user, router]);

  return null;
}
