"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2 } from "lucide-react";

const publicRoutes = ["/login", "/register", "/forgot-password"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    // If not authenticated and trying to access protected route, redirect to login
    if (!isAuthenticated && !isPublicRoute) {
      router.push("/login");
    }
    
    // If authenticated and trying to access login page, redirect to dashboard
    if (isAuthenticated && isPublicRoute) {
      router.push("/");
    }
  }, [isAuthenticated, isPublicRoute, router]);

  // Show loading state while checking auth
  if (!isAuthenticated && !isPublicRoute) {
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
