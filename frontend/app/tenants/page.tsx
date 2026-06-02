"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RequireRole } from "@/components/require-role";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { superAdminApi, TenantResponse, TenantRequest, SuperAdminUser, TenantStats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, MoreHorizontal, Building2, Users, Loader2,
  CheckCircle, AlertCircle, Pause, Play, Trash2, Pencil,
  Globe, CreditCard, Mail, Lock, Shield,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  ACTIVE:    { label: "Active",    cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  SUSPENDED: { label: "Suspended", cls: "bg-amber-100 text-amber-700",    icon: Pause },
  INACTIVE:  { label: "Inactive",  cls: "bg-gray-100 text-gray-500",      icon: AlertCircle },
};

const PLAN_META: Record<string, { label: string; cls: string }> = {
  BASIC:        { label: "Basic",        cls: "bg-gray-100 text-gray-600" },
  PROFESSIONAL: { label: "Professional", cls: "bg-blue-100 text-blue-700" },
  ENTERPRISE:   { label: "Enterprise",   cls: "bg-purple-100 text-purple-700" },
};

const EMPTY_FORM: TenantRequest = {
  name: "",
  domain: "",
  status: "ACTIVE",
  subscriptionPlan: "ENTERPRISE",
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  const [stats, setStats] = useState<TenantStats>({ totalTenants: 0, activeTenants: 0, suspendedTenants: 0, totalUsers: 0 });
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TenantResponse | null>(null);
  const [form, setForm] = useState<TenantRequest>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TenantResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailTenant, setDetailTenant] = useState<TenantResponse | null>(null);
  const [tenantUsers, setTenantUsers] = useState<SuperAdminUser[]>([]);
  const [tenantUsersLoading, setTenantUsersLoading] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      const [response, tenantStats] = await Promise.all([
        superAdminApi.getAllTenants({
          page,
          size: PAGE_SIZE,
          search: debouncedSearch,
          status: statusFilter,
          sort: "name-asc",
        }),
        superAdminApi.getTenantStats(),
      ]);
      setTenants(response.content ?? []);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
      setStats(tenantStats);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load tenants", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    load(currentPage);
  }, [currentPage, load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(t: TenantResponse) {
    setEditing(t);
    setForm({ name: t.name, domain: t.domain, status: t.status, subscriptionPlan: t.subscriptionPlan });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.domain.trim()) {
      toast({ title: "Validation", description: "Name and domain are required.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await superAdminApi.updateTenant(editing.tenantId, form);
        toast({ title: "Updated", description: `${form.name} updated.` });
      } else {
        await superAdminApi.createTenant(form);
        toast({ title: "Created", description: `Tenant "${form.name}" created.` });
      }
      setFormOpen(false);
      load(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save tenant", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(t: TenantResponse) {
    try {
      setActionLoading(t.tenantId);
      if (t.status === "ACTIVE") {
        await superAdminApi.suspendTenant(t.tenantId);
        toast({ title: "Suspended", description: `${t.name} suspended.` });
      } else {
        await superAdminApi.activateTenant(t.tenantId);
        toast({ title: "Activated", description: `${t.name} activated.` });
      }
      load(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update status", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function openDetail(t: TenantResponse) {
    setDetailTenant(t);
    setTenantUsers([]);
    setTenantUsersLoading(true);
    try {
      const response = await superAdminApi.getAllUsers({
        page: 0,
        size: 100,
        tenantId: t.tenantId,
        sort: "name-asc",
      });
      setTenantUsers(response.content ?? []);
    } catch {
      setTenantUsers([]);
    } finally {
      setTenantUsersLoading(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await superAdminApi.deleteTenant(toDelete.tenantId);
      toast({ title: "Deleted", description: `${toDelete.name} deleted.` });
      setDeleteOpen(false);
      setToDelete(null);
      load(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete tenant", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const statsDisplay = {
    total: stats.totalTenants,
    active: stats.activeTenants,
    suspended: stats.suspendedTenants,
    totalUsers: stats.totalUsers,
  };

  return (
    <RequireRole allowedRoles={["SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Tenant Management</h1>
              <p className="text-xs text-gray-500 mt-0.5">Create and manage all organisations on the platform</p>
            </div>
            <Button size="sm" className="text-xs h-8" onClick={openCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Tenant
            </Button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {[
              { label: "Total Tenants",  value: statsDisplay.total,      icon: Building2 },
              { label: "Active",         value: statsDisplay.active,     icon: CheckCircle },
              { label: "Suspended",      value: statsDisplay.suspended,  icon: Pause },
              { label: "Total Users",    value: statsDisplay.totalUsers, icon: Users },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-4 py-3 flex items-center gap-3">
                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                  {loading
                    ? <div className="h-5 w-8 bg-gray-100 rounded animate-pulse mt-0.5" />
                    : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
                  }
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">
                All Tenants
                {!loading && (
                  <span className="ml-2 text-[10px] font-normal text-gray-400">({totalElements} matching)</span>
                )}
              </p>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search tenants..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-[200px] h-8 text-xs border-gray-200"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="TRIAL">Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-14">
                <Building2 className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-500">No tenants found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Organisation</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Domain</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Plan</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-center">Users</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Created</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => {
                    const statusMeta = STATUS_META[t.status] ?? STATUS_META.INACTIVE;
                    const planMeta = PLAN_META[t.subscriptionPlan] ?? PLAN_META.BASIC;
                    const StatusIcon = statusMeta.icon;
                    const isProtected = t.domain === "default" || t.domain === "system";
                    return (
                      <TableRow key={t.tenantId} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetail(t)}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-900">{t.name}</p>
                              {isProtected && (
                                <p className="text-[10px] text-gray-400">System tenant</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Globe className="h-3 w-3 text-gray-400 shrink-0" />
                            {t.domain}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusMeta.cls}`}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {statusMeta.label}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${planMeta.cls}`}>
                            <CreditCard className="h-2.5 w-2.5" />
                            {planMeta.label}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-center text-xs font-medium text-gray-700">
                          {t.userCount}
                        </TableCell>
                        <TableCell className="py-2.5 text-[11px] text-gray-500">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={actionLoading === t.tenantId}
                              >
                                {actionLoading === t.tenantId
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <MoreHorizontal className="h-3.5 w-3.5" />
                                }
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuLabel className="text-xs">Manage Tenant</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs" onClick={() => openEdit(t)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                              </DropdownMenuItem>
                              {!isProtected && (
                                <DropdownMenuItem
                                  className="text-xs"
                                  onClick={() => handleToggleStatus(t)}
                                  disabled={actionLoading === t.tenantId}
                                >
                                  {t.status === "ACTIVE"
                                    ? <><Pause className="mr-2 h-3.5 w-3.5" />Suspend</>
                                    : <><Play className="mr-2 h-3.5 w-3.5" />Activate</>
                                  }
                                </DropdownMenuItem>
                              )}
                              {!isProtected && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-xs text-red-600"
                                    onClick={() => { setToDelete(t); setDeleteOpen(true); }}
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <PaginationControls
              page={currentPage}
              totalPages={totalPages}
              totalElements={totalElements}
              size={PAGE_SIZE}
              onPageChange={(p) => setCurrentPage(p)}
              loading={loading}
            />
          </div>
        </div>

        {/* Create / Edit dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[460px] rounded">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Tenant" : "New Tenant"}</DialogTitle>
              <DialogDescription>
                {editing ? "Update the tenant details below." : "Fill in the details to create a new tenant organisation."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Organisation Name *</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Acme Corp"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Domain *</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="acme"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  disabled={!!editing}
                />
                {!editing && (
                  <p className="text-[10px] text-gray-400">Lowercase letters, numbers and hyphens only. Cannot be changed after creation.</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status *</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TenantRequest["status"] })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Subscription Plan *</Label>
                <Select value={form.subscriptionPlan} onValueChange={(v) => setForm({ ...form, subscriptionPlan: v as TenantRequest["subscriptionPlan"] })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Basic</SelectItem>
                    <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {editing ? "Save Changes" : "Create Tenant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tenant Detail Dialog */}
        <Dialog open={!!detailTenant} onOpenChange={(o) => !o && setDetailTenant(null)}>
          <DialogContent className="sm:max-w-[660px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {detailTenant?.name.charAt(0).toUpperCase()}
                </div>
                {detailTenant?.name}
              </DialogTitle>
              <DialogDescription className="text-xs">Tenant overview and user roster</DialogDescription>
            </DialogHeader>

            {detailTenant && (() => {
              const statusMeta = STATUS_META[detailTenant.status] ?? STATUS_META.INACTIVE;
              const planMeta = PLAN_META[detailTenant.subscriptionPlan] ?? PLAN_META.BASIC;
              const StatusIcon = statusMeta.icon;
              return (
                <div className="space-y-4 text-xs">
                  {/* Info grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div><p className="text-gray-500">Domain</p><p className="font-mono font-medium mt-0.5">{detailTenant.domain}</p></div>
                    <div><p className="text-gray-500">Status</p>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${statusMeta.cls}`}>
                        <StatusIcon className="h-2.5 w-2.5" />{statusMeta.label}
                      </span>
                    </div>
                    <div><p className="text-gray-500">Plan</p>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${planMeta.cls}`}>
                        <CreditCard className="h-2.5 w-2.5" />{planMeta.label}
                      </span>
                    </div>
                    <div><p className="text-gray-500">Created</p><p className="font-medium mt-0.5">{detailTenant.createdAt ? new Date(detailTenant.createdAt).toLocaleDateString() : "—"}</p></div>
                    <div><p className="text-gray-500">Total Users</p><p className="font-medium mt-0.5">{detailTenant.userCount}</p></div>
                  </div>

                  {/* Users section */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Users className="h-3 w-3" />Users in this organisation
                    </p>
                    {tenantUsersLoading ? (
                      <div className="flex items-center justify-center py-6 border border-gray-100 rounded">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    ) : tenantUsers.length === 0 ? (
                      <div className="text-center py-6 border border-gray-100 rounded text-gray-400">
                        <Users className="h-5 w-5 mx-auto mb-1.5 text-gray-300" />
                        No users in this organisation yet.
                      </div>
                    ) : (
                      <div className="border border-gray-100 rounded overflow-hidden max-h-[280px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">User</TableHead>
                              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Role</TableHead>
                              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                              <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Joined</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tenantUsers.map((u) => {
                              const initials = u.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
                              return (
                                <TableRow key={u.userId} className="hover:bg-gray-50/50">
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6 shrink-0">
                                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="text-xs font-medium text-gray-900 leading-tight">{u.fullName}</p>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                          <Mail className="h-2.5 w-2.5" />{u.email}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-1 text-[10px] text-gray-600">
                                      <Shield className="h-2.5 w-2.5 text-gray-400" />
                                      {u.roleName}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    {u.accountLocked
                                      ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700"><Lock className="h-2 w-2" />Locked</span>
                                      : <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${u.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{u.active ? "Active" : "Inactive"}</span>
                                    }
                                  </TableCell>
                                  <TableCell className="py-2 text-[10px] text-gray-400">
                                    {u.registrationDate ? new Date(u.registrationDate).toLocaleDateString() : "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setDetailTenant(null)}>Close</Button>
              <Button size="sm" className="text-xs" onClick={() => { setDetailTenant(null); openEdit(detailTenant!); }}>Edit Tenant</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-[400px] rounded">
            <DialogHeader>
              <DialogTitle>Delete Tenant</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{toDelete?.name}</strong>? All users under this tenant will lose access. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" className="text-xs" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}
