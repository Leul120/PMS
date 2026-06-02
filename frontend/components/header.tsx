"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Search, Settings, LogOut, UserCircle, Building2, Check } from "lucide-react";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/auth-store";
import { notificationApi, authApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { mapLoginToUser, sessionMetaFromLogin, type LoginPayload } from "@/lib/login-response";
import { canSwitchContext, CONTEXT_LABELS, type OperatingContext } from "@/lib/operating-context";
import { cn } from "@/lib/utils";

export function Header() {
  const {
    user, logout, tenantName, tenantDomain, setAuth,
    organizationType, operatingContext, availableContexts,
  } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [myTenants, setMyTenants] = useState<{ tenantId: number; name: string; domain: string; status: string }[]>([]);
  const [switchingTenant, setSwitchingTenant] = useState(false);
  const [switchingContext, setSwitchingContext] = useState(false);
  const showContextSwitcher = canSwitchContext(organizationType, availableContexts);
  const router = useRouter();
  const { toast } = useToast();

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

  useEffect(() => {
    if (!user) return;
    authApi.getMyTenants()
      .then(setMyTenants)
      .catch(() => {/* silently ignore — single-tenant users won't see the switcher */});
  }, [user?.userId, user?.id]);

  function applySession(response: LoginPayload) {
    const mappedUser = mapLoginToUser(response);
    const meta = sessionMetaFromLogin(response);
    setAuth(mappedUser, response.accessToken, meta.tenant, {
      organizationType: meta.organizationType,
      operatingContext: meta.operatingContext,
      availableContexts: meta.availableContexts,
      supplierRole: meta.supplierRole,
    });
  }

  async function handleSwitchTenant(domain: string) {
    if (domain === tenantDomain || switchingTenant) return;
    setSwitchingTenant(true);
    try {
      const response = await authApi.switchTenant(domain);
      applySession(response);
      toast({ title: `Switched to ${response.tenantName}` });
      router.refresh();
    } catch {
      toast({ title: "Failed to switch organization", variant: "destructive" });
    } finally {
      setSwitchingTenant(false);
    }
  }

  async function handleSwitchContext(context: OperatingContext) {
    if (context === operatingContext || switchingContext) return;
    setSwitchingContext(true);
    try {
      const response = await authApi.switchContext(context);
      applySession(response);
      toast({ title: `Now in ${CONTEXT_LABELS[context]} mode` });
      router.push(context === "SALES" ? "/dashboard/vendor" : "/");
      router.refresh();
    } catch (err) {
      toast({
        title: "Could not switch mode",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSwitchingContext(false);
    }
  }

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

      {showContextSwitcher && (
        <div className="flex items-center rounded-md border border-gray-200 p-0.5 bg-gray-50">
          {(["PROCUREMENT", "SALES"] as OperatingContext[]).map((ctx) => {
            if (!availableContexts.includes(ctx)) return null;
            return (
              <button
                key={ctx}
                type="button"
                disabled={switchingContext}
                onClick={() => handleSwitchContext(ctx)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded transition-colors",
                  operatingContext === ctx
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-800",
                )}
              >
                {CONTEXT_LABELS[ctx]}
              </button>
            );
          })}
        </div>
      )}

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
              {tenantName && (
                <p className="text-[10px] text-primary/70 mt-1 font-medium">{tenantName}</p>
              )}
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

            {myTenants.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                    <Building2 className="mr-2 h-3.5 w-3.5" />
                    Switch Organization
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {myTenants.map((t) => (
                      <DropdownMenuItem
                        key={t.tenantId}
                        onClick={() => handleSwitchTenant(t.domain)}
                        disabled={switchingTenant}
                        className="text-xs cursor-pointer"
                      >
                        <Check
                          className={`mr-2 h-3.5 w-3.5 ${t.domain === tenantDomain ? "opacity-100" : "opacity-0"}`}
                        />
                        <div className="flex flex-col">
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-400">{t.domain}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                try { await authApi.logout(); } catch { /* ignore network errors */ }
                logout();
              }}
              className="text-destructive cursor-pointer text-xs"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
