"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore, validateAndCleanAuth } from "@/lib/auth-store";
import { getDashboardByRole } from "@/components/require-role";
import { Loader2 } from "lucide-react";

const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated?.()) {
      validateAndCleanAuth();
      setIsHydrated(true);
      return;
    }

    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      validateAndCleanAuth();
      setIsHydrated(true);
    });

    const timeout = setTimeout(() => setIsHydrated(true), 3000);

    return () => {
      unsub?.();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated && !isPublicRoute) {
      router.push("/login");
      return;
    }

    if (isAuthenticated && isPublicRoute) {
      const userRole = user?.role || user?.roleName;
      router.push(userRole ? getDashboardByRole(userRole) : "/dashboard");
    }
  }, [isHydrated, isAuthenticated, isPublicRoute, router, user, pathname]);

  if (!isHydrated || (!isAuthenticated && !isPublicRoute)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
