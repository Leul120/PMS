"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { getDashboardByRole } from "@/components/require-role";
import { Loader2 } from "lucide-react";

const publicRoutes = ["/login", "/register", "/forgot-password"];
const authRoutes = ["/login", "/register", "/forgot-password"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authStore = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const isPublicRoute = publicRoutes.includes(pathname);
  
  // Read auth state after hydration
  const isAuthenticated = isHydrated ? authStore.isAuthenticated : false;
  const user = isHydrated ? authStore.user : null;

  // Wait for Zustand hydration from localStorage
  useEffect(() => {
    // Check if already hydrated
    if (useAuthStore.persist?.hasHydrated?.()) {
      setIsHydrated(true);
      return;
    }
    
    // Subscribe to hydration finish
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setIsHydrated(true);
    });
    
    // Fallback: check hydration status periodically (max 2 seconds)
    let attempts = 0;
    const maxAttempts = 20; // 20 * 100ms = 2 seconds
    const interval = setInterval(() => {
      attempts++;
      if (useAuthStore.persist?.hasHydrated?.()) {
        setIsHydrated(true);
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        // Force hydration after timeout
        setIsHydrated(true);
        clearInterval(interval);
      }
    }, 100);

    return () => {
      unsub?.();
      clearInterval(interval);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isHydrated) return;

      // If not authenticated and trying to access protected route, redirect to login
    if (!isAuthenticated && !isPublicRoute) {
      router.push("/login");
      return;
    }
    
    // If authenticated and trying to access login page, redirect to appropriate dashboard
    if (isAuthenticated && isPublicRoute) {
      const userRole = user?.role || user?.roleName;
      const dashboardPath = userRole ? getDashboardByRole(userRole) : "/dashboard";
      router.push(dashboardPath);
      return;
    }
  }, [isHydrated, isAuthenticated, isPublicRoute, router, user, pathname]);

  // Show loading state while hydrating or checking auth
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

  // Don't render protected content for public routes (login/register will render themselves)
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
