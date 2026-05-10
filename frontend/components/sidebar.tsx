"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Shield,
  ShoppingCart,
  FileText,
  Gavel,
  BarChart3,
  Settings,
  Menu,
  Package,
  Truck,
  Building2,
  Sparkles,
  LogOut,
  Bell,
  ClipboardList,
  Receipt,
  Star,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore, UserRole } from "@/lib/auth-store";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  allowedRoles: UserRole[];
}

const navigation: NavItem[] = [
  // All authenticated roles see their own dashboard via redirect; "/" is the shared dashboard for internal roles
  { name: "Dashboard", href: "/", icon: LayoutDashboard, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"] },
  // Vendor-specific dashboard
  { name: "Dashboard", href: "/dashboard/vendor", icon: LayoutDashboard, allowedRoles: ["VENDOR"] },
  // Vendor directory: internal roles only (vendors can only view their own via /vendors/{id})
  { name: "Vendors", href: "/vendors", icon: Building2, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"] },
  // Requisitions: Based on procurement service patterns
  { name: "Requisitions", href: "/requisitions", icon: ClipboardList, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"] },
  // Procurement (PO management): All roles can view POs
  { name: "Procurement", href: "/procurement", icon: ShoppingCart, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"] },
  // RFQ & Bidding: All roles can view RFQs
  { name: "RFQ & Bidding", href: "/rfq", icon: Gavel, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"] },
  // Purchase Orders: All roles can view POs
  { name: "Purchase Orders", href: "/orders", icon: FileText, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"] },
  // Deliveries: All roles can view deliveries
  { name: "Deliveries", href: "/deliveries", icon: Truck, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"] },
  // Inventory: Internal roles only
  { name: "Inventory", href: "/inventory", icon: Package, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"] },
  // Analytics: Internal roles only
  { name: "Analytics", href: "/analytics", icon: BarChart3, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"] },
  // Admin panel: ADMIN only
  { name: "Admin", href: "/dashboard/admin", icon: Shield, allowedRoles: ["ADMIN"] },
  // Team/Users: all internal roles can view the team directory; only ADMIN can manage users
  { name: "Team", href: "/users", icon: UserCog, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"] },
  // Notifications: All roles can view their own notifications
  { name: "Notifications", href: "/notifications", icon: Bell, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"] },
  // Invoices: All roles can view invoices
  { name: "Invoices", href: "/invoices", icon: Receipt, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"] },
  // Vendor Performance / Scoring: All roles can view performance data
  { name: "Performance", href: "/vendors/performance", icon: Star, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"] },
  // Settings: All roles can access their own settings
  { name: "Settings", href: "/settings", icon: Settings, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"] },
];
export function Sidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const userRole = (user?.role || user?.roleName) as UserRole;

  // Filter navigation based on user role (deduplicate by name – vendor has its own Dashboard entry)
  const allowedNavigation = navigation.filter(item =>
    item.allowedRoles.includes(userRole)
  );

  return (
    <div className="hidden border-r bg-white lg:flex lg:w-[260px] flex-col">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-foreground font-medium">
            ProcurePro
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-2 px-3">
        <nav className="grid gap-0.5">
          {allowedNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-gray-200 p-3 space-y-0.5">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            pathname === "/profile"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <UserCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {user ? `${user.firstName || user.fullName?.split(" ")[0] || "Profile"}` : "Profile"}
          </span>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-600 hover:text-red-600 hover:bg-red-50 text-xs font-medium"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const userRole = (user?.role || user?.roleName) as UserRole;

  // Filter navigation based on user role (deduplicate by name – vendor has its own Dashboard entry)
  const allowedNavigation = navigation.filter(item =>
    item.allowedRoles.includes(userRole)
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] p-0 bg-white">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center border-b border-gray-200 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-foreground font-medium">ProcurePro</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2 px-3">
            <nav className="grid gap-0.5">
              {allowedNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="border-t border-gray-200 p-3 space-y-0.5">
            <Link
              href="/profile"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                pathname === "/profile"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <UserCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {user ? `${user.firstName || user.fullName?.split(" ")[0] || "Profile"}` : "Profile"}
              </span>
            </Link>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-600 hover:text-red-600 hover:bg-red-50 text-xs font-medium"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
