"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { authApi, adminApi, superAdminApi } from "@/lib/api";
import { isBuyerRole } from "@/lib/auth-store";
import { displayTenantName } from "@/lib/display";
import { useToast } from "@/hooks/use-toast";
import { UserDialog } from "./user-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import {
  Plus, Search, MoreHorizontal, Mail, Loader2, AlertTriangle,
  Users, UserCheck, Shield, UserX, Download, ChevronDown, ChevronRight,
  Building2, Lock, Unlock, Key, Trash2,
} from "lucide-react";

// ── Shared flat user type used in both views ──────────────────────────────────
interface FlatUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  supplierRoleName?: string | null;
  active: boolean;
  accountLocked: boolean;
  createdAt?: string;
  tenantId?: number;
  tenantName?: string;
}

// ── Role options ──────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: "ADMIN",    label: "Administrator" },
  { value: "OFFICER",  label: "Procurement Officer" },
  { value: "MANAGER",  label: "Manager" },
  { value: "AUDITOR",  label: "Auditor" },
  { value: "VENDOR_ADMIN",   label: "Vendor Admin" },
  { value: "VENDOR_SALES",  label: "Vendor Sales" },
  { value: "VENDOR_FINANCE", label: "Vendor Finance" },
  { value: "VENDOR_LOGISTICS", label: "Vendor Logistics" },
  { value: "DIRECTOR", label: "Director" },
];

const SUPPLIER_ROLE_OPTIONS = [
  { value: "", label: "No sales access" },
  { value: "VENDOR_ADMIN", label: "Supplier Admin" },
  { value: "VENDOR_SALES", label: "Sales" },
  { value: "VENDOR_LOGISTICS", label: "Logistics" },
  { value: "VENDOR_FINANCE", label: "Finance" },
];

// ── Tenant section (super admin grouped view) ─────────────────────────────────
function TenantSection({
  tenantName,
  users,
  expanded,
  onToggle,
  onAction,
  onRowClick,
  actionLoading,
}: {
  tenantName: string;
  users: FlatUser[];
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: string, user: FlatUser) => void;
  onRowClick: (user: FlatUser) => void;
  actionLoading: string | null;
}) {
  const active = users.filter((u) => u.active && !u.accountLocked).length;
  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">{tenantName}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-medium">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
            {active} active
          </span>
        </div>
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        }
      </button>

      {expanded && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">User</TableHead>
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Role</TableHead>
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Joined</TableHead>
              <TableHead className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-xs text-gray-400">No users in this tenant.</TableCell>
              </TableRow>
            ) : users.map((user) => {
              const initials = user.fullName
                .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
              const isLoading = actionLoading === user.id;
              return (
                <TableRow key={user.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onRowClick(user)}>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium text-gray-900">{user.fullName}</p>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Mail className="h-2.5 w-2.5" />{user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-gray-600">
                    <div>{user.role}</div>
                    {user.supplierRoleName && (
                      <div className="text-[10px] text-blue-700 mt-0.5">Sales: {user.supplierRoleName}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {user.accountLocked ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                        <Lock className="h-2.5 w-2.5" />Locked
                      </span>
                    ) : user.active ? (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] text-gray-500 py-2.5">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={isLoading}>
                          {isLoading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <MoreHorizontal className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuLabel className="text-xs">Manage User</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs" onClick={() => onAction("edit-role", user)}>
                          <Shield className="mr-2 h-3.5 w-3.5" />Change Role
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs" onClick={() => onAction("reset-password", user)}>
                          <Key className="mr-2 h-3.5 w-3.5" />Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs" onClick={() => onAction("toggle-lock", user)}>
                          {user.accountLocked
                            ? <><Unlock className="mr-2 h-3.5 w-3.5" />Unlock Account</>
                            : <><Lock className="mr-2 h-3.5 w-3.5" />Lock Account</>
                          }
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-xs text-red-600" onClick={() => onAction("delete", user)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { toast } = useToast();
  const hasRole    = useAuthStore((s) => s.hasRole);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const organizationType = useAuthStore((s) => s.organizationType);
  const isDualHatOrg = organizationType === "BOTH";
  const isSuperAdmin = hasRole(["SUPER_ADMIN"]);
  const canManage    = isSuperAdmin || (hasPermission("users:create") && hasPermission("users:update") && hasPermission("users:delete"));

  const [users, setUsers] = useState<FlatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("ALL");
  const isGroupedView = isSuperAdmin && tenantFilter === "ALL";
  const GROUPED_FETCH_SIZE = 500;
  const [tenantOptions, setTenantOptions] = useState<{ id: number; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  const [stats, setStats] = useState({ total: 0, active: 0, locked: 0, tenants: 0 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedTenants, setExpandedTenants] = useState<Set<number>>(new Set());

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<FlatUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editSupplierRole, setEditSupplierRole] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [resetUser, setResetUser] = useState<FlatUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [deleteUser, setDeleteUser] = useState<FlatUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<FlatUser | null>(null);
  const [toggling, setToggling] = useState(false);
  const [detailUser, setDetailUser] = useState<FlatUser | null>(null);

  const mapUser = useCallback((u: any): FlatUser => ({
    id: String(u.userId || u.id),
    fullName: u.fullName || u.email,
    email: u.email,
    role: u.roleName || u.role,
    supplierRoleName: u.supplierRoleName ?? null,
    active: u.active !== false,
    accountLocked: u.accountLocked ?? false,
    createdAt: u.registrationDate || u.createdAt,
    tenantId: u.tenantId,
    tenantName: displayTenantName(u.tenantId, { name: u.tenantName, domain: (u as any).tenantDomain }),
  }), []);

  const load = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      setError(null);
      const tenantId = tenantFilter !== "ALL" ? Number(tenantFilter) : undefined;
      const params = {
        page: isGroupedView ? 0 : page,
        size: isGroupedView ? GROUPED_FETCH_SIZE : PAGE_SIZE,
        search: debouncedSearch,
        tenantId: tenantId && !Number.isNaN(tenantId) ? tenantId : undefined,
        sort: "name-asc" as const,
      };

      if (isSuperAdmin) {
        const [response, userStats] = await Promise.all([
          superAdminApi.getAllUsers(params),
          superAdminApi.getUserStats(),
        ]);
        setUsers((response.content ?? []).map(mapUser));
        setTotalPages(response.totalPages ?? 0);
        setTotalElements(response.totalElements ?? 0);
        setStats({
          total: userStats.totalUsers,
          active: userStats.activeUsers,
          locked: userStats.lockedUsers,
          tenants: userStats.tenantCount,
        });
      } else {
        const [response, userStats] = await Promise.all([
          authApi.getAllUsers(params).catch((err) => {
            if (err?.message?.includes("permission") || err?.message?.includes("403")) {
              return { content: [], totalPages: 0, totalElements: 0 };
            }
            throw err;
          }),
          authApi.getUserStats().catch(() => null),
        ]);
        setUsers((response.content ?? []).map(mapUser));
        setTotalPages(response.totalPages ?? 0);
        setTotalElements(response.totalElements ?? 0);
        if (userStats) {
          setStats({
            total: userStats.totalUsers,
            active: userStats.activeUsers,
            locked: userStats.lockedUsers,
            tenants: 1,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, tenantFilter, isSuperAdmin, isGroupedView, mapUser]);

  const usersByTenant = useMemo(() => {
    const groups = new Map<number, FlatUser[]>();
    users.forEach((u) => {
      const tid = u.tenantId ?? 0;
      if (!groups.has(tid)) groups.set(tid, []);
      groups.get(tid)!.push(u);
    });

    const ordered: { tenantId: number; tenantName: string; users: FlatUser[] }[] = [];
    tenantOptions.forEach((t) => {
      const tenantUsers = groups.get(t.id);
      if (tenantUsers?.length) {
        ordered.push({ tenantId: t.id, tenantName: t.name, users: tenantUsers });
        groups.delete(t.id);
      }
    });
    groups.forEach((tenantUsers, tid) => {
      ordered.push({
        tenantId: tid,
        tenantName: tenantUsers[0]?.tenantName || `Tenant ${tid}`,
        users: tenantUsers,
      });
    });
    return ordered;
  }, [users, tenantOptions]);

  useEffect(() => {
    if (!isGroupedView || usersByTenant.length === 0) return;
    setExpandedTenants(new Set(usersByTenant.map((g) => g.tenantId)));
  }, [debouncedSearch, tenantFilter, isGroupedView, usersByTenant]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearch, tenantFilter]);

  useEffect(() => {
    if (isSuperAdmin) {
      superAdminApi.getAllTenantsList()
        .then((items) => setTenantOptions(items.map((t) => ({ id: t.tenantId, name: t.name }))))
        .catch(() => setTenantOptions([]));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    load(currentPage);
  }, [currentPage, load]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  function handleAction(action: string, user: FlatUser) {
    if (action === "edit-role") {
      setEditUser(user);
      setEditRole(user.role);
      setEditSupplierRole(user.supplierRoleName || "");
    }
    else if (action === "reset-password") { setResetUser(user); setResetPassword(""); }
    else if (action === "toggle-lock") { setConfirmToggle(user); }
    else if (action === "delete") { setDeleteUser(user); }
  }

  async function saveRole() {
    if (!editUser) return;
    try {
      setEditSaving(true);
      const payload: { roleName: string; supplierRoleName?: string } = { roleName: editRole };
      if (isDualHatOrg && isBuyerRole(editRole)) {
        payload.supplierRoleName = editSupplierRole;
      }
      if (isSuperAdmin) {
        await authApi.updateUser(editUser.id, payload);
      } else {
        await adminApi.updateUser(editUser.id, payload);
      }
      toast({ title: "Updated", description: `${editUser.fullName}'s roles were updated` });
      setEditUser(null);
      load(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  async function saveResetPassword() {
    if (!resetUser || !resetPassword) return;
    try {
      setResetSaving(true);
      if (isSuperAdmin) {
        await superAdminApi.resetPassword(Number(resetUser.id), resetPassword);
      } else {
        await adminApi.resetPassword(resetUser.id, resetPassword);
      }
      toast({ title: "Password Reset", description: `Password updated for ${resetUser.fullName}` });
      setResetUser(null);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setResetSaving(false);
    }
  }

  async function doToggleLock() {
    if (!confirmToggle) return;
    try {
      setToggling(true);
      const id = Number(confirmToggle.id);
      if (isSuperAdmin) {
        if (confirmToggle.accountLocked) await superAdminApi.unlockUser(id);
        else await superAdminApi.lockUser(id);
      } else {
        if (confirmToggle.accountLocked) await adminApi.unlockAccount(confirmToggle.id);
        else await adminApi.lockAccount(confirmToggle.id);
      }
      toast({ title: confirmToggle.accountLocked ? "Unlocked" : "Locked", description: `${confirmToggle.fullName}'s account updated.` });
      setConfirmToggle(null);
      load(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setToggling(false);
    }
  }

  async function doDelete() {
    if (!deleteUser) return;
    try {
      setDeleting(true);
      if (isSuperAdmin) await superAdminApi.deleteUser(Number(deleteUser.id));
      else await adminApi.deleteUser(deleteUser.id);
      toast({ title: "Deleted", description: `${deleteUser.fullName} removed.` });
      setDeleteUser(null);
      load(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  function handleExport() {
    const headers = isSuperAdmin
      ? ["Name", "Email", "Role", "Status", "Tenant", "Joined"]
      : ["Name", "Email", "Role", "Status", "Joined"];
    const rows = users.map((u) => {
      const base = [u.fullName, u.email, u.role, u.accountLocked ? "Locked" : u.active ? "Active" : "Inactive"];
      if (isSuperAdmin) base.push(u.tenantName ?? "");
      base.push(u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "");
      return base;
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  function FlatTable({ showTenant = false }: { showTenant?: boolean }) {
    return (
      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-700">
            User Directory
            <span className="ml-2 text-[10px] font-normal text-gray-400">({totalElements} matching)</span>
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">User</TableHead>
              {showTenant && (
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Organisation</TableHead>
              )}
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Procurement role</TableHead>
              {isDualHatOrg && (
                <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Sales role</TableHead>
              )}
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Joined</TableHead>
              <TableHead className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(showTenant ? 6 : 5) + (isDualHatOrg ? 1 : 0)} className="text-center py-12">
                  <Users className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-500">{search ? "No users match your search." : "No users found."}</p>
                </TableCell>
              </TableRow>
            ) : users.map((user) => {
              const initials = user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
              return (
                <TableRow key={user.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetailUser(user)}>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium text-gray-900">{user.fullName}</p>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Mail className="h-2.5 w-2.5" />{user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {showTenant && (
                    <TableCell className="text-xs py-2.5 text-gray-600">{user.tenantName || "—"}</TableCell>
                  )}
                  <TableCell className="text-xs py-2.5 text-gray-600">{user.role}</TableCell>
                  {isDualHatOrg && (
                    <TableCell className="text-xs py-2.5 text-gray-500">
                      {user.supplierRoleName || "—"}
                    </TableCell>
                  )}
                  <TableCell className="py-2.5">
                    {user.accountLocked
                      ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700"><Lock className="h-2.5 w-2.5" />Locked</span>
                      : <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${user.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {user.active ? "Active" : "Inactive"}
                        </span>
                    }
                  </TableCell>
                  <TableCell className="text-[11px] text-gray-500 py-2.5">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="text-xs">
                        <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {canManage ? (
                          <>
                            <DropdownMenuItem className="text-xs" onClick={() => handleAction("edit-role", user)}>
                              <Shield className="mr-2 h-3.5 w-3.5" />Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-xs" onClick={() => handleAction("toggle-lock", user)}>
                              {user.accountLocked
                                ? <><Unlock className="mr-2 h-3.5 w-3.5" />Unlock</>
                                : <><Lock className="mr-2 h-3.5 w-3.5" />Lock</>
                              }
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem className="text-xs" disabled>View only</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <PaginationControls
          page={currentPage}
          totalPages={totalPages}
          totalElements={totalElements}
          size={PAGE_SIZE}
          onPageChange={(p) => setCurrentPage(p)}
          loading={loading}
        />
      </div>
    );
  }

  function GroupedByTenantView() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-gray-700">
            Users by Organisation
            <span className="ml-2 text-[10px] font-normal text-gray-400">({totalElements} matching)</span>
          </span>
        </div>
        {usersByTenant.length === 0 ? (
          <div className="border border-gray-200 rounded py-12 text-center">
            <Users className="h-6 w-6 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-gray-500">{search ? "No users match your search." : "No users found."}</p>
          </div>
        ) : (
          usersByTenant.map(({ tenantId, tenantName, users: tenantUsers }) => (
            <TenantSection
              key={tenantId}
              tenantName={tenantName}
              users={tenantUsers}
              expanded={expandedTenants.has(tenantId)}
              onToggle={() => setExpandedTenants((prev) => {
                const next = new Set(prev);
                if (next.has(tenantId)) next.delete(tenantId);
                else next.add(tenantId);
                return next;
              })}
              onAction={handleAction}
              onRowClick={setDetailUser}
              actionLoading={actionLoading}
            />
          ))
        )}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{isSuperAdmin ? "All Users" : "Team"}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {isSuperAdmin
                  ? "Manage users across all tenant organisations"
                  : "View and manage user accounts in your organisation"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport} disabled={loading}>
                <Download className="mr-1.5 h-3.5 w-3.5" />Export
              </Button>
              {canManage && (
                <Button size="sm" className="text-xs h-8" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Add User
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {(isSuperAdmin
              ? [
                  { label: "Total Users",  value: stats.total,   icon: Users },
                  { label: "Active",       value: stats.active,  icon: UserCheck },
                  { label: "Locked",       value: stats.locked,  icon: Shield },
                  { label: "Tenants",      value: stats.tenants, icon: Building2 },
                ]
              : [
                  { label: "Total Users", value: stats.total, icon: Users },
                  { label: "Active", value: stats.active, icon: UserCheck },
                  { label: "Locked", value: stats.locked, icon: Shield },
                  { label: "Inactive", value: Math.max(0, stats.total - stats.active - stats.locked), icon: UserX },
                ]
            ).map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-4 py-3 flex items-center gap-3">
                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                  {loading
                    ? <div className="h-5 w-8 bg-gray-100 rounded animate-pulse mt-0.5" />
                    : <p className="text-lg font-semibold text-gray-900">{value}</p>
                  }
                </div>
              </div>
            ))}
          </div>

          {/* Search + tenant filter (super admin only) */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input type="search" placeholder="Search users..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs border-gray-200" />
            </div>
            {isSuperAdmin && (
              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="h-8 text-xs w-[200px]">
                  <Building2 className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="All Tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Tenants</SelectItem>
                  {tenantOptions.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />{error}
              <Button variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => load(currentPage)}>Retry</Button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}

          {!loading && !error && (
            isGroupedView
              ? <GroupedByTenantView />
              : <FlatTable showTenant={false} />
          )}
        </div>

        {/* User Detail Dialog */}
        <Dialog open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
          <DialogContent className="sm:max-w-[440px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">{detailUser?.fullName}</DialogTitle>
              <DialogDescription className="text-xs">User account details</DialogDescription>
            </DialogHeader>
            {detailUser && (
              <div className="space-y-3 py-1 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-gray-500">Email</p><p className="font-medium mt-0.5">{detailUser.email}</p></div>
                  <div><p className="text-gray-500">Procurement role</p><p className="font-medium mt-0.5">{detailUser.role}</p></div>
                  {detailUser.supplierRoleName && (
                    <div><p className="text-gray-500">Sales role</p><p className="font-medium mt-0.5">{detailUser.supplierRoleName}</p></div>
                  )}
                  <div><p className="text-gray-500">Status</p>
                    {detailUser.accountLocked
                      ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 mt-0.5"><Lock className="h-2.5 w-2.5" />Locked</span>
                      : <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${detailUser.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{detailUser.active ? "Active" : "Inactive"}</span>
                    }
                  </div>
                  <div><p className="text-gray-500">Joined</p><p className="font-medium mt-0.5">{detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleDateString() : "—"}</p></div>
                  {detailUser.tenantName && (
                    <div className="col-span-2"><p className="text-gray-500">Organisation</p><p className="font-medium mt-0.5">{detailUser.tenantName}</p></div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDetailUser(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create user dialog */}
        <UserDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={() => load(currentPage)} />

        {/* Edit Role dialog */}
        <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
          <DialogContent className="sm:max-w-[380px] rounded">
            <DialogHeader>
              <DialogTitle>Change Role</DialogTitle>
              <DialogDescription>Update role for {editUser?.fullName}{editUser?.tenantName ? ` (${editUser.tenantName})` : ""}.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Procurement role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isDualHatOrg && isBuyerRole(editRole) && (
                <div className="space-y-1.5 rounded-md border border-blue-100 bg-blue-50/50 p-3">
                  <Label className="text-xs text-blue-900">Sales role (optional)</Label>
                  <Select value={editSupplierRole || "__none__"} onValueChange={(v) => setEditSupplierRole(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value || "__none__"} value={r.value || "__none__"} className="text-xs">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button size="sm" className="text-xs" disabled={editSaving} onClick={saveRole}>
                {editSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password dialog */}
        <Dialog open={!!resetUser} onOpenChange={(o) => { if (!o) setResetUser(null); }}>
          <DialogContent className="sm:max-w-[380px] rounded">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>Set a new password for {resetUser?.fullName}.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-1.5">
              <Label className="text-xs">New Password</Label>
              <Input
                type="text"
                className="h-8 text-xs font-mono"
                placeholder="Enter new password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
              <p className="text-[10px] text-gray-400">Share this securely — the user should change it on next login.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setResetUser(null)}>Cancel</Button>
              <Button size="sm" className="text-xs" disabled={resetSaving || !resetPassword} onClick={saveResetPassword}>
                {resetSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Reset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lock / Unlock confirm */}
        <Dialog open={!!confirmToggle} onOpenChange={(o) => { if (!o) setConfirmToggle(null); }}>
          <DialogContent className="sm:max-w-[380px] rounded">
            <DialogHeader>
              <DialogTitle>{confirmToggle?.accountLocked ? "Unlock Account" : "Lock Account"}</DialogTitle>
              <DialogDescription>
                {confirmToggle?.accountLocked
                  ? `This will restore login access for ${confirmToggle?.fullName}.`
                  : `This will prevent ${confirmToggle?.fullName} from logging in.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setConfirmToggle(null)}>Cancel</Button>
              <Button
                size="sm" className="text-xs"
                variant={confirmToggle?.accountLocked ? "default" : "destructive"}
                disabled={toggling} onClick={doToggleLock}
              >
                {toggling && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {confirmToggle?.accountLocked ? "Unlock" : "Lock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null); }}>
          <DialogContent className="sm:max-w-[380px] rounded">
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Permanently delete <strong>{deleteUser?.fullName}</strong>
                {deleteUser?.tenantName ? ` from ${deleteUser.tenantName}` : ""}? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setDeleteUser(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" className="text-xs" disabled={deleting} onClick={doDelete}>
                {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </DashboardLayout>
    </RequireRole>
  );
}
