"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore, UserRole } from "@/lib/auth-store";
import type { OperatingContext } from "@/lib/operating-context";
import { CONTEXT_LABELS } from "@/lib/operating-context";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  allowedRoles: UserRole[];
  group: string;
  /** Which operating context shows this link */
  contexts: OperatingContext[];
}

const ALL_VENDOR: UserRole[] = ["VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "VENDOR_LOGISTICS"];

const BUYER_ROLES: UserRole[] = ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "REQUESTER", "SUPER_ADMIN"];

const navigation: NavItem[] = [
  // ── Procurement context ──
  { name: "Dashboard", href: "/", icon: LayoutDashboard, allowedRoles: ["ADMIN", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Dashboard", href: "/dashboard/officer", icon: LayoutDashboard, allowedRoles: ["OFFICER"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Dashboard", href: "/requisitions", icon: LayoutDashboard, allowedRoles: ["REQUESTER"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Dashboard", href: "/dashboard/manager", icon: LayoutDashboard, allowedRoles: ["MANAGER"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Dashboard", href: "/dashboard/director", icon: LayoutDashboard, allowedRoles: ["DIRECTOR"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Dashboard", href: "/dashboard/auditor", icon: LayoutDashboard, allowedRoles: ["AUDITOR"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Vendors", href: "/vendors", icon: Building2, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Requisitions", href: "/requisitions", icon: ClipboardList, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "REQUESTER", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "RFQ & Bids", href: "/rfq", icon: Gavel, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "PO Approval", href: "/procurement", icon: ShoppingCart, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Order Tracking", href: "/orders", icon: FileText, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Deliveries", href: "/deliveries", icon: Truck, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Invoices", href: "/invoices", icon: Receipt, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Inventory", href: "/inventory", icon: Package, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Analytics", href: "/analytics", icon: BarChart3, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Vendor Performance", href: "/vendors/performance", icon: Star, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Procurement" },
  { name: "Tenants", href: "/tenants", icon: Building2, allowedRoles: ["SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Admin" },
  { name: "Admin Panel", href: "/dashboard/admin", icon: Shield, allowedRoles: ["ADMIN", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Admin" },
  { name: "Team", href: "/users", icon: UserCog, allowedRoles: ["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"], contexts: ["PROCUREMENT"], group: "Admin" },

  // ── Sales (supplier) context ──
  { name: "Sales Dashboard", href: "/dashboard/vendor", icon: LayoutDashboard, allowedRoles: ALL_VENDOR, contexts: ["SALES"], group: "Sales Portal" },
  { name: "Opportunities", href: "/rfq", icon: Gavel, allowedRoles: ALL_VENDOR, contexts: ["SALES"], group: "Sales Portal" },
  { name: "Customer Orders", href: "/orders", icon: FileText, allowedRoles: ALL_VENDOR, contexts: ["SALES"], group: "Sales Portal" },
  { name: "Shipments", href: "/deliveries", icon: Truck, allowedRoles: ALL_VENDOR, contexts: ["SALES"], group: "Sales Portal" },
  { name: "Invoicing", href: "/invoices", icon: Receipt, allowedRoles: ALL_VENDOR, contexts: ["SALES"], group: "Sales Portal" },
  { name: "My Performance", href: "/vendors/performance", icon: Star, allowedRoles: ALL_VENDOR, contexts: ["SALES"], group: "Sales Portal" },
  { name: "My Company", href: "/company", icon: Building2, allowedRoles: ["VENDOR_ADMIN"], contexts: ["SALES"], group: "Sales Portal" },
  { name: "Sales Team", href: "/users", icon: UserCog, allowedRoles: ["VENDOR_ADMIN"], contexts: ["SALES"], group: "Sales Portal" },

  // ── Shared account ──
  { name: "Notifications", href: "/notifications", icon: Bell, allowedRoles: [...BUYER_ROLES, ...ALL_VENDOR], contexts: ["PROCUREMENT", "SALES"], group: "Account" },
  { name: "Settings", href: "/settings", icon: Settings, allowedRoles: [...BUYER_ROLES, ...ALL_VENDOR], contexts: ["PROCUREMENT", "SALES"], group: "Account" },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  OFFICER: "Procurement Officer",
  MANAGER: "Manager",
  AUDITOR: "Auditor",
  VENDOR: "Vendor",
  VENDOR_ADMIN: "Supplier Admin",
  VENDOR_SALES: "Sales",
  VENDOR_FINANCE: "Finance",
  VENDOR_LOGISTICS: "Logistics",
  REQUESTER: "Requester",
  DIRECTOR: "Director",
  SUPER_ADMIN: "Super Administrator",
};

const GROUP_ORDER = ["Procurement", "Sales Portal", "Admin", "Account"];

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const grouped = GROUP_ORDER.reduce<Record<string, NavItem[]>>((acc, g) => {
    const groupItems = items.filter((i) => i.group === g);
    if (groupItems.length > 0) acc[g] = groupItems;
    return acc;
  }, {});

  return (
    <nav className="space-y-4">
      {Object.entries(grouped).map(([group, groupItems]) => (
        <div key={group}>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            {group}
          </p>
          <div className="grid gap-0.5">
            {groupItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={`${item.group}-${item.href}-${item.name}`}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ pathname }: { pathname: string }) {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const operatingContext = useAuthStore((state) => state.operatingContext);
  const role = user?.role || user?.roleName || "";
  const initials = (
    (user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")
  ).toUpperCase() || "U";

  return (
    <div className="border-t border-gray-100 p-3 space-y-0.5">
      <div className="px-3 py-1 text-[10px] text-gray-400">
        {CONTEXT_LABELS[operatingContext]} · {ROLE_LABELS[role] || role}
      </div>
      <Link
        href="/profile"
        className={cn(
          "flex items-center gap-3 rounded px-3 py-1.5 text-xs font-medium transition-colors",
          pathname === "/profile"
            ? "bg-primary/10 text-primary"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
        )}
      >
        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate leading-none">
            {user?.firstName || user?.fullName?.split(" ")[0] || "Profile"}
          </p>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-3 text-gray-500 hover:text-red-600 hover:bg-red-50 text-xs font-medium h-8"
        onClick={logout}
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </Button>
    </div>
  );
}

function useFilteredNav() {
  const user = useAuthStore((state) => state.user);
  const operatingContext = useAuthStore((state) => state.operatingContext);
  const userRole = (user?.role || user?.roleName) as UserRole;

  return navigation.filter(
    (item) =>
      item.contexts.includes(operatingContext) &&
      item.allowedRoles.includes(userRole),
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const allowedNavigation = useFilteredNav();

  return (
    <div className="hidden border-r border-gray-100 bg-white lg:flex lg:w-[220px] flex-col">
      <div className="flex h-14 items-center px-4 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-1.5 rounded">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-gray-900">ProcurePro</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-3 px-2">
        <NavLinks items={allowedNavigation} pathname={pathname} />
      </div>
      <SidebarFooter pathname={pathname} />
    </div>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();
  const allowedNavigation = useFilteredNav();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[220px] p-0 flex flex-col">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 items-center px-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">ProcurePro</span>
        </div>
        <div className="flex-1 overflow-auto py-3 px-2">
          <NavLinks items={allowedNavigation} pathname={pathname} />
        </div>
        <SidebarFooter pathname={pathname} />
      </SheetContent>
    </Sheet>
  );
}
