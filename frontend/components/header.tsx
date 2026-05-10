"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Search, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileSidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth-store";
import { notificationApi } from "@/lib/api";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, logout } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Fetch unread notification count — only poll when tab is visible and user is authenticated
  useEffect(() => {
    const userId = user?.userId || user?.id;
    // Guard: only poll if we have a valid numeric-looking userId
    if (!userId || String(userId).trim() === '' || String(userId) === 'undefined' || String(userId) === 'null') return;

    const fetchUnreadCount = async () => {
      // Skip fetch if tab is hidden to avoid unnecessary requests
      if (document.visibilityState === "hidden") return;
      try {
        const notifications = await notificationApi.getUnread(userId);
        setUnreadCount(Array.isArray(notifications) ? notifications.length : 0);
      } catch {
        // silently ignore — badge just won't update
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);

    // Pause polling when tab is hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchUnreadCount();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.userId, user?.id]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 sm:px-6">
      <MobileSidebar />
      <div className="flex flex-1 items-center gap-4">
        <div className="relative hidden sm:block max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search vendors, orders, RFQs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                // Route to the most relevant page based on keywords
                if (q.includes("vendor") || q.includes("supplier")) {
                  router.push(`/vendors`);
                } else if (q.includes("rfq") || q.includes("bid") || q.includes("quotation")) {
                  router.push(`/rfq`);
                } else if (q.includes("po") || q.includes("order") || q.includes("purchase")) {
                  router.push(`/orders`);
                } else if (q.includes("delivery") || q.includes("shipment")) {
                  router.push(`/deliveries`);
                } else if (q.includes("inventory") || q.includes("stock")) {
                  router.push(`/inventory`);
                } else if (q.includes("invoice") || q.includes("payment")) {
                  router.push(`/deliveries`);
                } else if (q.includes("report") || q.includes("analytic")) {
                  router.push(`/analytics`);
                } else if (q.includes("user") || q.includes("admin")) {
                  router.push(`/users`);
                } else {
                  // Default: go to orders with search pre-filled via URL
                  router.push(`/orders`);
                }
                setSearchQuery("");
              }
            }}
            className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/50"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl" asChild>
          <Link href="/notifications">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive p-0 text-[10px] flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 pl-2 pr-3 gap-2 rounded-xl hover:bg-accent">
              <Avatar className="h-8 w-8 border-2 border-primary/20">
                <AvatarImage src="" alt={user?.firstName || "User"} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</span>
                <span className="text-xs text-muted-foreground leading-none mt-0.5">{user?.role?.replace("_", " ")}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
