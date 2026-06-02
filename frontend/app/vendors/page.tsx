"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { vendorApi, scoringApi, poApi, getCategoryNameMap, authApi } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { VendorDocumentDialog } from "./vendor-document-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { VendorDialog } from "./vendor-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequireRole } from "@/components/require-role";
import { useListDeepLink } from "@/hooks/use-list-deep-link";
import { useAuthStore } from "@/lib/auth-store";
import {
  Search,
  MoreHorizontal,
  Filter,
  Download,
  Loader2,
  FileText,
  Eye,
  ShoppingCart,
  Ban,
  Users,
  CheckCircle2,
  Star,
  Building2,
  Clock,
  XCircle,
} from "lucide-react";

interface Vendor {
  // Backend returns vendorId; the enriched response also sets id = vendorId
  id: string;
  vendorId?: number;
  companyName: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  category?: string;
  categoryName?: string;
  status: string;
  verified: boolean;
  complianceStatus?: string;
  // Optional enriched fields
  rating?: number;
  totalOrders?: number;
  compliance?: string;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [vendorToDeactivate, setVendorToDeactivate] = useState<Vendor | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [openPOCount, setOpenPOCount] = useState<number | null>(null);
  const [openPOCheckLoading, setOpenPOCheckLoading] = useState(false);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  // Status filter
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isSuperAdmin = hasRole(["SUPER_ADMIN"]);
  const canVerify = hasPermission("vendors:verify") || isSuperAdmin;
  const canUpdate = hasPermission("vendors:update");
  const canDelete = hasPermission("vendors:delete");

  const loadVendors = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      const [response, categoryMap] = await Promise.all([
        vendorApi.getAll({
          page,
          size: PAGE_SIZE,
          search: debouncedSearch,
          status: statusFilter,
          sort: "name-asc",
        }),
        getCategoryNameMap().catch(() => new Map<string, string>()),
      ]);
      const items = response.content ?? [];
      const normalised = items.map((v: any) => {
        const rawCategory = v.category || v.categoryName || "";
        const category = /^\d+$/.test(String(rawCategory))
          ? (categoryMap.get(String(rawCategory)) || rawCategory)
          : (rawCategory || "Uncategorized");
        return {
          ...v,
          id: String(v.id || v.vendorId),
          category,
          status: v.status || (v.complianceStatus === "Verified" ? "ACTIVE" : "PENDING"),
          verified: v.verified ?? (v.complianceStatus === "Verified"),
          phone: v.phone || v.phoneNumber,
        };
      });
      setVendors(normalised);
      setFilteredVendors(normalised);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"])) return;
    setCurrentPage(0);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"])) return;
    loadVendors(currentPage);
  }, [currentPage, loadVendors]);

  useListDeepLink(vendors, loading, (vendor) => setDetailVendor(vendor), { paramNames: ["id"] });

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadPendingApprovals();
  }, [isSuperAdmin]);

  async function loadPendingApprovals() {
    try {
      setApprovalsLoading(true);
      const data = await authApi.getPendingVendorApprovals();
      setPendingApprovals(data ?? []);
    } catch {
      // silently ignore — not critical
    } finally {
      setApprovalsLoading(false);
    }
  }

  async function handleApproveVendor(userId: number, companyName: string) {
    try {
      setApprovingId(userId);
      await authApi.approveVendor(userId);
      toast({ title: "Vendor approved", description: `${companyName || "Vendor"} can now log in.` });
      loadPendingApprovals();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to approve vendor", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectVendor(userId: number, companyName: string) {
    try {
      setRejectingId(userId);
      await authApi.rejectVendor(userId);
      toast({ title: "Vendor rejected", description: `${companyName || "Vendor"} registration has been rejected.` });
      loadPendingApprovals();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reject vendor", variant: "destructive" });
    } finally {
      setRejectingId(null);
    }
  }

  // Export vendors to CSV
  function handleExport() {    const headers = ["Company Name", "Email", "Phone", "Category", "Status", "Verified", "Rating", "Total Orders", "Compliance"];
    const rows = filteredVendors.map(v => [
      v.companyName,
      v.email,
      v.phone || "",
      v.category || "",
      v.status,
      v.verified ? "Yes" : "No",
      v.rating || "",
      v.totalOrders || "",
      v.compliance || ""
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendors-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: `${filteredVendors.length} vendors exported to CSV` });
  }

  async function openDeactivateDialog(vendor: Vendor) {
    setVendorToDeactivate(vendor);
    setOpenPOCount(null);
    setOpenPOCheckLoading(true);
    setDeactivateDialogOpen(true);
    try {
      const pos = await poApi.getAllList().catch(() => []);
      const openPOs = (pos as any[]).filter((po: any) => {
        const sameVendor = String(po.vendorId) === String(vendor.id) || String(po.vendorId) === String(vendor.vendorId);
        const isOpen = po.status?.toLowerCase().includes("pending") || po.status?.toLowerCase() === "approved" || po.status?.toLowerCase() === "processing";
        return sameVendor && isOpen;
      });
      setOpenPOCount(openPOs.length);
    } catch {
      setOpenPOCount(0);
    } finally {
      setOpenPOCheckLoading(false);
    }
  }

  async function confirmDeactivate() {
    if (!vendorToDeactivate) return;
    try {
      setDeactivateLoading(true);
      await vendorApi.updateStatus(vendorToDeactivate.id, "INACTIVE");
      toast({ title: "Vendor deactivated", description: `${vendorToDeactivate.companyName} has been deactivated.` });
      setDeactivateDialogOpen(false);
      setVendorToDeactivate(null);
      loadVendors(currentPage);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to deactivate vendor", variant: "destructive" });
    } finally {
      setDeactivateLoading(false);
    }
  }
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage supplier relationships and track performance</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        </div>

        {error && (
          <div className="border-l-4 border-red-400 bg-red-50 px-4 py-3 text-xs text-red-700">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadVendors(currentPage)} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {/* Pending Vendor Approvals — Super Admin only */}
        {isSuperAdmin && (
          <div className="border border-amber-200 rounded bg-amber-50">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
              <Clock className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">Pending Vendor Approvals</p>
              {pendingApprovals.length > 0 && (
                <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-200 text-amber-800">
                  {pendingApprovals.length}
                </span>
              )}
            </div>
            {approvalsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              </div>
            ) : pendingApprovals.length === 0 ? (
              <p className="text-xs text-amber-600 px-4 py-3">No pending vendor registrations.</p>
            ) : (
              <div className="divide-y divide-amber-100">
                {pendingApprovals.map((v: any) => (
                  <div key={v.userId} className="flex items-center gap-3 px-4 py-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-amber-200 text-amber-800 text-xs">
                        {(v.companyName || v.fullName || "V").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{v.companyName || "—"}</p>
                      <p className="text-[10px] text-gray-500 truncate">{v.fullName} · {v.email}</p>
                      <p className="text-[10px] text-gray-400">{v.tenantName} · Registered {v.registrationDate ? new Date(v.registrationDate).toLocaleDateString() : "—"}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        disabled={approvingId === v.userId || rejectingId === v.userId}
                        onClick={() => handleApproveVendor(v.userId, v.companyName || v.fullName)}
                      >
                        {approvingId === v.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        disabled={approvingId === v.userId || rejectingId === v.userId}
                        onClick={() => handleRejectVendor(v.userId, v.companyName || v.fullName)}
                      >
                        {rejectingId === v.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        {(() => {
          const activeCount = vendors.filter(v => v.status === "ACTIVE").length;
          const verifiedCount = vendors.filter(v => v.verified).length;
          const pendingCount = vendors.filter(v => !v.verified).length;
          const avgRating = vendors.length > 0 ? (vendors.reduce((acc, v) => acc + (v.rating || 0), 0) / vendors.length) : 0;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
              {[
                { label: "Total Vendors", value: vendors.length, sub: `${activeCount} active`, icon: Building2 },
                { label: "Verified", value: verifiedCount, sub: "Approved suppliers", icon: CheckCircle2 },
                { label: "Pending Verification", value: pendingCount, sub: pendingCount > 0 ? "Needs review" : "All verified", icon: Users },
                { label: "Avg Rating", value: avgRating.toFixed(1), sub: "Across all vendors", icon: Star },
              ].map(({ label, value, sub, icon: Icon }) => (
                <div key={label} className="px-4 py-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                    {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                    {!loading && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Vendors Table */}
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">Vendor Directory</p>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs w-[200px] border-gray-200"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Category</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Verification</TableHead>
                    <TableHead className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <Building2 className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs font-medium text-gray-500">
                          {vendors.length === 0 ? "No vendors yet." : "No vendors match your search."}
                        </p>
                        {vendors.length === 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">Vendors register themselves via the vendor registration page.</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <TableRow key={vendor.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetailVendor(vendor)}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                {(vendor.companyName || "V").substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{vendor.companyName || "Unknown"}</p>
                              <p className="text-[10px] text-gray-500 truncate">{vendor.email}</p>
                              {vendor.phone && <p className="text-[10px] text-gray-400">{vendor.phone}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-gray-600">{vendor.category || "Uncategorized"}</TableCell>
                        <TableCell className="py-2.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${vendor.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : vendor.status === "INACTIVE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{vendor.status}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${vendor.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{vendor.verified ? "Verified" : "Pending"}</span>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs" onClick={() => { setSelectedVendor(vendor); setDialogOpen(true); }}>
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                {canUpdate ? "View / Edit" : "View"}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-xs" onClick={() => router.push(`/orders?vendor=${vendor.id}`)}>
                                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                                View Orders
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs"
                                onClick={() => {
                                  setSelectedVendor(vendor);
                                  setDocumentDialogOpen(true);
                                }}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1.5" />
                                Documents
                              </DropdownMenuItem>
                              {canVerify && !vendor.verified && (
                                <DropdownMenuItem className="text-xs" onClick={async () => {
                                  try {
                                    await vendorApi.verify(vendor.id);
                                    toast({ title: "Vendor verified", description: `${vendor.companyName} has been verified.` });
                                    loadVendors(currentPage);
                                  } catch (error) {
                                    toast({
                                      title: "Error",
                                      description: error instanceof Error ? error.message : "Failed to verify vendor",
                                      variant: "destructive"
                                    });
                                  }
                                }}>
                                  Verify Vendor
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-xs text-red-600"
                                onClick={() => openDeactivateDialog(vendor)}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1.5" />
                                Deactivate
                              </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
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

      <VendorDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setSelectedVendor(null); }}
        onSuccess={() => loadVendors(currentPage)}
        initialData={selectedVendor}
      />
      <VendorDocumentDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        vendor={selectedVendor}
        onSuccess={() => loadVendors(currentPage)}
      />

      {/* Vendor Detail Dialog */}
      <Dialog open={!!detailVendor} onOpenChange={(o) => !o && setDetailVendor(null)}>
        <DialogContent className="sm:max-w-[480px] rounded">
          <DialogHeader>
            <DialogTitle className="text-sm">{detailVendor?.companyName}</DialogTitle>
            <DialogDescription className="text-xs">Vendor details</DialogDescription>
          </DialogHeader>
          {detailVendor && (
            <div className="space-y-3 py-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-gray-500">Email</p><p className="font-medium mt-0.5">{detailVendor.email}</p></div>
                <div><p className="text-gray-500">Phone</p><p className="font-medium mt-0.5">{detailVendor.phone || "—"}</p></div>
                <div><p className="text-gray-500">Category</p><p className="font-medium mt-0.5">{detailVendor.category || "Uncategorized"}</p></div>
                <div><p className="text-gray-500">Status</p>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${detailVendor.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : detailVendor.status === "INACTIVE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{detailVendor.status}</span>
                </div>
                <div><p className="text-gray-500">Verification</p>
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${detailVendor.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{detailVendor.verified ? "Verified" : "Pending"}</span>
                </div>
                {detailVendor.rating !== undefined && (
                  <div><p className="text-gray-500">Rating</p><p className="font-medium mt-0.5">{detailVendor.rating?.toFixed(1)} / 5.0</p></div>
                )}
                {detailVendor.totalOrders !== undefined && (
                  <div><p className="text-gray-500">Total Orders</p><p className="font-medium mt-0.5">{detailVendor.totalOrders}</p></div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailVendor(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded">
          <DialogHeader>
            <DialogTitle>Deactivate Vendor</DialogTitle>
            <DialogDescription className="text-xs">
              You are about to deactivate <strong>{vendorToDeactivate?.companyName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Open PO check */}
          {openPOCheckLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking for active purchase orders…
            </div>
          ) : openPOCount != null && openPOCount > 0 ? (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold mb-0.5">Warning: {openPOCount} active purchase order{openPOCount > 1 ? "s" : ""}</p>
              <p>This vendor has open or pending POs. Deactivating them will not cancel these orders. Review and close all orders before deactivating.</p>
            </div>
          ) : openPOCount === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              No active purchase orders found. Safe to deactivate.
            </div>
          ) : null}

          <p className="text-xs text-gray-600">Once deactivated, this vendor will not be able to receive new purchase orders or submit bids.</p>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeactivateDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={deactivateLoading || openPOCheckLoading} onClick={confirmDeactivate}>
              {deactivateLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {openPOCount != null && openPOCount > 0 ? "Deactivate Anyway" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    </RequireRole>
  );
}
