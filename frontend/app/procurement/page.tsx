"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { poApi, getVendorNameMap } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PODialog } from "./po-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import {
  Plus, Search, Filter, MoreHorizontal, Download, Loader2,
  ShoppingCart, CheckCircle2, XCircle, AlertCircle, Clock,
} from "lucide-react";

interface PurchaseOrder {
  id: string;
  rfqId?: string;
  poNumber: string;
  title?: string;
  description?: string;
  companyName?: string;
  vendorId?: string;
  totalAmount: number;
  status: string;
  priority?: string;
  createdAt: string;
  deliveryDate?: string;
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function formatStatus(status: string) {
  return status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Unknown";
}

function statusChip(status: string) {
  const s = status?.toLowerCase() || "";
  const cls = (s.includes("approved") && !s.includes("pending"))
    ? "bg-emerald-100 text-emerald-700"
    : (s.includes("pending") || s === "draft")
    ? "bg-amber-100 text-amber-700"
    : s.includes("rejected")
    ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {formatStatus(status)}
    </span>
  );
}

export default function ProcurementPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const canCreatePO = hasPermission("po:create");
  const canApprovePO = hasPermission("po:approve");
  const canRejectPO = hasPermission("po:reject");

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR"])) return;
    loadPurchaseOrders(currentPage);
  }, [currentPage]);

  async function loadPurchaseOrders(page = 0) {
    try {
      setLoading(true);
      const [response, vendorMap] = await Promise.all([
        poApi.getAll(page, PAGE_SIZE),
        getVendorNameMap(),
      ]);
      const items = response.content ?? [];
      const normalised = items.map((po: any) => {
        const vendorId = String(po.vendorId || "");
        const companyName = po.companyName || vendorMap.get(vendorId) || (vendorId ? `Vendor #${vendorId}` : "N/A");
        return {
          ...po,
          id: String(po.id || po.poId),
          rfqId: po.rfqId ? String(po.rfqId) : undefined,
          vendorId: vendorId || undefined,
          poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
          companyName,
          createdAt: po.createdAt || po.issueDate,
          deliveryDate: po.deliveryDate || po.expectedDeliveryDate,
          totalAmount: Number(po.totalAmount) || 0,
        };
      });
      setPurchaseOrders(normalised);
      setFilteredOrders(normalised);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let filtered = purchaseOrders;
    if (statusFilter !== "ALL") filtered = filtered.filter((po) => po.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (po) =>
          po.poNumber?.toLowerCase().includes(q) ||
          po.companyName?.toLowerCase().includes(q) ||
          po.description?.toLowerCase().includes(q) ||
          po.status?.toLowerCase().includes(q)
      );
    }
    setFilteredOrders(filtered);
  }, [searchQuery, purchaseOrders, statusFilter]);

  function handleExport() {
    const headers = ["PO Number", "Description", "Vendor", "Status", "Priority", "Total Amount", "Created At", "Delivery Date"];
    const rows = filteredOrders.map((po) => [
      po.poNumber,
      po.description || po.title || "",
      po.companyName || "",
      po.status,
      po.priority || "",
      po.totalAmount?.toString() || "0",
      po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "",
      po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString() : "",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-orders-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: "Export Complete", description: `${filteredOrders.length} orders exported to CSV` });
  }

  async function handleApprove(id: string) {
    try {
      await poApi.approve(id);
      toast({ title: "Order Approved", description: "Purchase order has been approved." });
      loadPurchaseOrders(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to approve order", variant: "destructive" });
    }
  }

  async function handleReject(id: string) {
    try {
      await poApi.reject(id);
      toast({ title: "Order Rejected", description: "Purchase order has been rejected." });
      loadPurchaseOrders(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reject order", variant: "destructive" });
    }
  }

  const isPending = (status: string) =>
    status?.toLowerCase().includes("pending") || status?.toLowerCase() === "draft";

  const pendingOrders = purchaseOrders.filter((po) => isPending(po.status));
  const approvedOrders = purchaseOrders.filter(
    (po) => po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending")
  );
  const rejectedOrders = purchaseOrders.filter((po) => po.status?.toLowerCase().includes("rejected"));
  const totalSpend = approvedOrders.reduce((s, po) => s + po.totalAmount, 0);

  const statCards = [
    {
      label: "Total Orders",
      value: purchaseOrders.length,
      sub: totalSpend > 0 ? `$${totalSpend.toLocaleString()} approved` : undefined,
      icon: ShoppingCart,
    },
    {
      label: "Awaiting Approval",
      value: pendingOrders.length,
      sub: pendingOrders.length > 0 ? "Requires your attention" : "All caught up",
      icon: Clock,
    },
    {
      label: "Approved",
      value: approvedOrders.length,
      sub: approvedOrders.length > 0 ? `$${approvedOrders.reduce((s, p) => s + p.totalAmount, 0).toLocaleString()} total` : undefined,
      icon: CheckCircle2,
    },
    {
      label: "Rejected",
      value: rejectedOrders.length,
      sub: rejectedOrders.length > 0 ? "Review needed" : undefined,
      icon: XCircle,
    },
  ];

  function POTable({ orders, showActions = false, showDate = true }: {
    orders: PurchaseOrder[];
    showActions?: boolean;
    showDate?: boolean;
  }) {
    if (orders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingCart className="h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">No orders here</p>
          <p className="text-xs text-gray-400 mt-1">
            {canCreatePO ? "Create a new purchase order to get started." : "No purchase orders in this category."}
          </p>
          {canCreatePO && (
            <Button size="sm" className="mt-3 text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create PO
            </Button>
          )}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">PO Number</TableHead>
            <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Description</TableHead>
            <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Vendor</TableHead>
            <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Amount</TableHead>
            <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</TableHead>
            {showDate && <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Submitted</TableHead>}
            <TableHead className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((po) => (
            <TableRow key={po.id} className="hover:bg-gray-50 transition-colors">
              <TableCell className="font-medium text-xs">
                <span className="font-mono">{po.poNumber}</span>
              </TableCell>
              <TableCell className="text-xs max-w-[180px]">
                <span className="truncate block">{po.description || po.title || <span className="text-gray-400 italic">No description</span>}</span>
              </TableCell>
              <TableCell className="text-xs text-gray-700">{po.companyName || "—"}</TableCell>
              <TableCell className="text-xs font-semibold text-gray-900">
                ${po.totalAmount?.toLocaleString() || "0"}
              </TableCell>
              <TableCell>
                {statusChip(po.status)}
              </TableCell>
              {showDate && (
                <TableCell className="text-xs text-gray-500">
                  <span title={new Date(po.createdAt).toLocaleString()}>{daysAgo(po.createdAt)}</span>
                </TableCell>
              )}
              <TableCell className="text-right">
                {showActions && isPending(po.status) && (canApprovePO || canRejectPO) ? (
                  <div className="flex items-center justify-end gap-1.5">
                    {canRejectPO && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                        onClick={() => handleReject(po.id)}
                      >
                        Reject
                      </Button>
                    )}
                    {canApprovePO && (
                      <Button
                        size="sm"
                        className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleApprove(po.id)}
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {canCreatePO && (
                        <DropdownMenuItem onClick={() => { setSelectedPO(po); setDialogOpen(true); }}>
                          Edit Order
                        </DropdownMenuItem>
                      )}
                      {isPending(po.status) && (
                        <>
                          <DropdownMenuSeparator />
                          {canApprovePO && (
                            <DropdownMenuItem onClick={() => handleApprove(po.id)} className="text-emerald-700">
                              Approve
                            </DropdownMenuItem>
                          )}
                          {canRejectPO && (
                            <DropdownMenuItem onClick={() => handleReject(po.id)} className="text-destructive">
                              Reject
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Procurement</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage purchase orders from creation to approval</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              {canCreatePO && (
                <Button size="sm" className="text-xs h-8 gap-1.5" onClick={() => { setSelectedPO(null); setDialogOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" /> New Purchase Order
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Failed to load orders</p>
                <p className="text-red-500 mt-0.5">{error}</p>
                <Button variant="outline" size="sm" className="mt-2 text-xs h-7 border-red-200" onClick={() => loadPurchaseOrders(currentPage)}>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Flat metric strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {statCards.map(({ label, value, sub, icon: Icon }) => (
              <div key={label} className="px-4 py-3 flex items-center gap-3">
                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                  {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                  {!loading && sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Pending banner */}
          {!loading && pendingOrders.length > 0 && (canApprovePO || canRejectPO) && (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">{pendingOrders.length} order{pendingOrders.length > 1 ? "s" : ""}</span> awaiting your approval.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => document.querySelector('[data-value="pending"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }))}
              >
                Review Now
              </Button>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all" data-value="all">
                All Orders
                {!loading && <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">{purchaseOrders.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="pending" data-value="pending">
                Pending
                {!loading && pendingOrders.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-amber-500 text-white rounded-full px-1.5 py-0.5">{pendingOrders.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" data-value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected" data-value="rejected">Rejected</TabsTrigger>
            </TabsList>

            {/* ALL tab */}
            <TabsContent value="all" className="mt-4">
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">All Purchase Orders</p>
                    <p className="text-xs text-gray-400">{totalElements} total orders</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search by PO#, vendor, description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs w-60"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <Filter className="mr-1.5 h-3.5 w-3.5" />
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <POTable orders={filteredOrders} showDate />
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
            </TabsContent>

            {/* PENDING tab */}
            <TabsContent value="pending" className="mt-4">
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Orders Awaiting Approval</p>
                    <p className="text-xs text-gray-400">
                      {pendingOrders.length > 0
                        ? `${pendingOrders.length} order${pendingOrders.length > 1 ? "s" : ""} need${pendingOrders.length === 1 ? "s" : ""} review`
                        : "Nothing to review — you're all caught up!"}
                    </p>
                  </div>
                </div>
                <div>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <POTable orders={pendingOrders} showActions showDate />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* APPROVED tab */}
            <TabsContent value="approved" className="mt-4">
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Approved Orders</p>
                    <p className="text-xs text-gray-400">
                      {approvedOrders.length > 0
                        ? `${approvedOrders.length} orders — $${approvedOrders.reduce((s, p) => s + p.totalAmount, 0).toLocaleString()} total value`
                        : "No approved orders yet"}
                    </p>
                  </div>
                </div>
                <div>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <POTable orders={approvedOrders} showDate />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* REJECTED tab */}
            <TabsContent value="rejected" className="mt-4">
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Rejected Orders</p>
                    <p className="text-xs text-gray-400">
                      {rejectedOrders.length > 0
                        ? `${rejectedOrders.length} rejected order${rejectedOrders.length > 1 ? "s" : ""}`
                        : "No rejected orders"}
                    </p>
                  </div>
                </div>
                <div>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <POTable orders={rejectedOrders} showDate />
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <PODialog
          open={dialogOpen}
          onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedPO(null); }}
          onSuccess={loadPurchaseOrders}
          initialData={selectedPO}
        />
      </DashboardLayout>
    </RequireRole>
  );
}
