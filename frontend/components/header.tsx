"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Search, Settings, LogOut, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileSidebar } from "@/components/sidebar";
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

  useEffect(() => {
    const userId = user?.userId || user?.id;
    if (!userId || String(userId).trim() === "" || String(userId) === "undefined" || String(userId) === "null") return;

    const fetchUnreadCount = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const notifications = await notificationApi.getUnread(userId);
        setUnreadCount(Array.isArray(notifications) ? notifications.length : 0);
      } catch {
        // silently ignore
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchUnreadCount();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.userId, user?.id]);

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();
    if (q.includes("vendor") || q.includes("supplier")) router.push("/vendors");
    else if (q.includes("rfq") || q.includes("bid") || q.includes("quotation")) router.push("/rfq");
    else if (q.includes("po") || q.includes("order") || q.includes("purchase")) router.push("/orders");
    else if (q.includes("delivery") || q.includes("shipment")) router.push("/deliveries");
    else if (q.includes("inventory") || q.includes("stock")) router.push("/inventory");
    else if (q.includes("invoice") || q.includes("payment")) router.push("/invoices");
    else if (q.includes("report") || q.includes("analytic")) router.push("/analytics");
    else if (q.includes("user") || q.includes("admin")) router.push("/users");
    else router.push("/orders");
    setSearchQuery("");
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center border-b border-gray-200 bg-white px-4 sm:px-6 gap-4">
      <MobileSidebar />

      <div className="flex flex-1 items-center">
        <div className="relative hidden sm:block w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKey}
            className="pl-8 h-8 text-xs border-gray-200 bg-white focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="relative h-8 w-8" asChild>
          <Link href="/notifications">
            <Bell className="h-4 w-4 text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-semibold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 px-2 gap-2 hover:bg-gray-50">
              <Avatar className="h-6 w-6">
                <AvatarImage src="" alt={user?.firstName || "User"} />
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-xs font-medium text-gray-700 leading-none">
                {user?.firstName} {user?.lastName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal py-2.5">
              <p className="text-xs font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center cursor-pointer text-xs">
                <UserCircle className="mr-2 h-3.5 w-3.5" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center cursor-pointer text-xs">
                <Settings className="mr-2 h-3.5 w-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer text-xs">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
