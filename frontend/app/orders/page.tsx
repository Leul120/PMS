"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { poApi, getCompanyNameMap, poStatusQuery, resolveVendorIdsFromSearch } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { displayVendorName } from "@/lib/display";
import { useToast } from "@/hooks/use-toast";
import { DeliveryDialog } from "../deliveries/delivery-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { useListDeepLink } from "@/hooks/use-list-deep-link";
import { ProcurementPipelineBanner } from "@/components/procurement-pipeline-banner";
import { WorkflowNextStep } from "@/components/workflow-next-step";
import {
  Search,
  MoreHorizontal,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Loader2,
  ShoppingCart,
  Download,
} from "lucide-react";

function exportOrdersToCSV(orders: any[]) {
  const headers = ["PO Number", "Vendor", "Amount", "Status", "Order Date", "Expected Delivery", "Tracking Number"];
  const rows = orders.map((o) => [
    o.poNumber || "",
    o.companyName || "",
    o.totalAmount ?? "",
    o.status || "",
    o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "",
    o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : "",
    o.trackingNumber || "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `purchase-orders-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

interface Order {
  id: string;
  poNumber: string;
  title?: string;
  description?: string;
  companyName?: string;
  totalAmount: number;
  status: string;
  deliveryStatus?: string;
  createdAt: string;
  deliveryDate?: string;
  trackingNumber?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  // Detail dialog + status filter
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const canLogDelivery = hasPermission("deliveries:update");
  const canExport = hasPermission("reports:view");

  // Delivery dialog pre-filled from PO
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryPOId, setDeliveryPOId] = useState<string | null>(null);

  const loadOrders = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      const vendorMap = await getCompanyNameMap();
      const vendorIds = resolveVendorIdsFromSearch(debouncedSearch, Object.fromEntries(vendorMap));
      const [response] = await Promise.all([
        poApi.getAll({
          page,
          size: PAGE_SIZE,
          search: debouncedSearch,
          vendorIds: vendorIds.length ? vendorIds : undefined,
          ...poStatusQuery(statusFilter),
          sort: "id-desc",
        }),
      ]);
      const items = response.content ?? [];
      const normalised = items.map((po: any) => {
        const vendorId = String(po.vendorId || '');
        const companyName = displayVendorName(vendorId, {
          name: po.vendorName || po.companyName,
          map: vendorMap,
          empty: "N/A",
        });
        return {
          ...po,
          id: String(po.id || po.poId),
          poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
          companyName,
          createdAt: po.createdAt || po.issueDate,
          deliveryDate: po.deliveryDate || po.expectedDeliveryDate,
          totalAmount: Number(po.totalAmount) || 0,
        };
      });
      setOrders(normalised);
      setFilteredOrders(normalised);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"])) return;
    loadOrders(currentPage);
  }, [currentPage, loadOrders]);

  useListDeepLink(orders, loading, (order) => setDetailOrder(order), { paramNames: ["id"] });

  const getStatusVariant = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (s === "delivered") return "success";
    if (s === "shipped" || s === "in_transit") return "default";
    if (s.includes("approved") && !s.includes("pending")) return "success";
    if (s.includes("pending") || s === "draft") return "warning";
    if (s.includes("rejected")) return "destructive";
    return "secondary";
  };

  const isPending = (s: string) => s?.toLowerCase().includes("pending") || s?.toLowerCase() === "draft";
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <ProcurementPipelineBanner activeStep="fulfillment" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Order Fulfillment</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track orders, deliveries, and receipts</p>
          </div>
          <div className="flex gap-2">
            {canExport && filteredOrders.length > 0 && (
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={() => exportOrdersToCSV(filteredOrders)}>
                <Download className="h-3.5 w-3.5" />Export CSV
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-red-600 text-xs">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadOrders(currentPage)} className="mt-2 text-xs h-7">
              Retry
            </Button>
          </div>
        )}

        {(() => {
          const pendingCount = orders.filter(o => isPending(o.status)).length;
          const approvedCount = orders.filter(o => o.status?.toLowerCase().includes("approved") && !o.status?.toLowerCase().includes("pending")).length;
          const deliveredCount = orders.filter(o => o.status?.toLowerCase() === "delivered").length;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
              {[
                { label: "Total Orders", value: orders.length, sub: "All purchase orders", icon: ShoppingCart },
                { label: "Awaiting Approval", value: pendingCount, sub: pendingCount > 0 ? "Needs manager review" : "All reviewed", icon: Clock },
                { label: "Approved", value: approvedCount, sub: "Ready to fulfill", icon: Package },
                { label: "Delivered", value: deliveredCount, sub: "Completed orders", icon: CheckCircle2 },
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

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="shipped">Shipped</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">All Orders</p>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Search orders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-[200px] h-8 text-xs border-gray-200"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 text-xs w-[130px]">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Pending Approval">Pending</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Shipped">Shipped / In Transit</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Order</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Date</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Delivery</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : filteredOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12">
                        <Package className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs font-medium text-gray-500">No orders found.</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Approved purchase orders from Procurement appear here for fulfillment tracking.</p>
                      </TableCell></TableRow>
                    ) : filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetailOrder(order)}>
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium font-mono">{order.poNumber}</p>
                          {order.description && <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{order.description}</p>}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 py-2.5">{order.companyName || "N/A"}</TableCell>
                        <TableCell className="text-xs font-semibold text-gray-900 py-2.5">${order.totalAmount?.toLocaleString() || 0}</TableCell>
                        <TableCell className="py-2.5">
                          {(() => {
                            const s = order.status?.toLowerCase() || "";
                            const cls = s === "delivered" ? "bg-emerald-100 text-emerald-700"
                              : (s.includes("approved") && !s.includes("pending")) ? "bg-emerald-100 text-emerald-700"
                              : (s.includes("pending") || s === "draft") ? "bg-amber-100 text-amber-700"
                              : s.includes("rejected") ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600";
                            return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{order.status}</span>;
                          })()}
                        </TableCell>
                        <TableCell className="text-[10px] text-gray-500 py-2.5">
                          {order.createdAt ? daysAgo(order.createdAt) : "—"}
                        </TableCell>
                        <TableCell className="text-[10px] text-gray-500 py-2.5">
                          {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}
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
                              <DropdownMenuItem className="text-xs" onClick={() => setDetailOrder(order)}>View Details</DropdownMenuItem>
                              {canLogDelivery && (order.status?.toLowerCase().includes("approved") || order.status?.toLowerCase() === "delivered") && (
                                <DropdownMenuItem className="text-xs" onClick={() => { setDeliveryPOId(order.id); setDeliveryDialogOpen(true); }}>
                                  Log Delivery Receipt
                                </DropdownMenuItem>
                              )}
                              {order.trackingNumber && (
                                <DropdownMenuItem className="text-xs" onClick={() => {
                                  navigator.clipboard.writeText(order.trackingNumber!).catch(() => {});
                                  toast({ title: "Tracking Number Copied", description: order.trackingNumber });
                                }}>
                                  Copy Tracking
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

          <TabsContent value="processing">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">Processing Orders</p>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Order</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.filter(o => isPending(o.status) || o.status?.toLowerCase() === "processing").length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10">
                        <Clock className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">No orders currently processing.</p>
                      </TableCell></TableRow>
                    ) : orders.filter(o => isPending(o.status) || o.status?.toLowerCase() === "processing").map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetailOrder(order)}>
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium font-mono">{order.poNumber}</p>
                          {order.createdAt && <p className="text-[10px] text-gray-400">{daysAgo(order.createdAt)}</p>}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 py-2.5">{order.companyName || "N/A"}</TableCell>
                        <TableCell className="text-xs font-semibold text-gray-900 py-2.5">${order.totalAmount?.toLocaleString() || 0}</TableCell>
                        <TableCell className="py-2.5">
                          {(() => {
                            const s = order.status?.toLowerCase() || "";
                            const cls = s === "delivered" ? "bg-emerald-100 text-emerald-700"
                              : (s.includes("approved") && !s.includes("pending")) ? "bg-emerald-100 text-emerald-700"
                              : (s.includes("pending") || s === "draft") ? "bg-amber-100 text-amber-700"
                              : s.includes("rejected") ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600";
                            return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{order.status}</span>;
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shipped">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">Shipped Orders</p>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Order</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Tracking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.filter(o => o.status?.toLowerCase() === "shipped" || o.status?.toLowerCase() === "in_transit" || o.deliveryStatus?.toLowerCase() === "shipped").length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10">
                        <Truck className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">No orders currently in transit.</p>
                      </TableCell></TableRow>
                    ) : orders.filter(o => o.status?.toLowerCase() === "shipped" || o.status?.toLowerCase() === "in_transit" || o.deliveryStatus?.toLowerCase() === "shipped").map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetailOrder(order)}>
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium font-mono">{order.poNumber}</p>
                          {order.createdAt && <p className="text-[10px] text-gray-400">{daysAgo(order.createdAt)}</p>}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 py-2.5">{order.companyName || "N/A"}</TableCell>
                        <TableCell className="text-xs font-semibold text-gray-900 py-2.5">${order.totalAmount?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-xs text-gray-500 py-2.5 font-mono">
                          {order.trackingNumber || <span className="text-gray-400">No tracking</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="delivered">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">Delivered Orders</p>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Order</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Delivered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.filter(o => o.status?.toLowerCase() === "delivered" || o.deliveryStatus?.toLowerCase() === "delivered").length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-10">
                        <CheckCircle2 className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">No deliveries completed yet.</p>
                      </TableCell></TableRow>
                    ) : orders.filter(o => o.status?.toLowerCase() === "delivered" || o.deliveryStatus?.toLowerCase() === "delivered").map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetailOrder(order)}>
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium font-mono">{order.poNumber}</p>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 py-2.5">{order.companyName || "N/A"}</TableCell>
                        <TableCell className="text-xs font-semibold text-gray-900 py-2.5">${order.totalAmount?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-[10px] text-gray-500 py-2.5">
                          {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DeliveryDialog
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
        onSuccess={loadOrders}
        prefilledPoId={deliveryPOId}
      />

      {/* Order Detail Dialog */}
      <Dialog open={!!detailOrder} onOpenChange={(o) => !o && setDetailOrder(null)}>
        <DialogContent className="sm:max-w-[500px] rounded">
          <DialogHeader>
            <DialogTitle>{detailOrder?.poNumber}</DialogTitle>
            <DialogDescription>Purchase Order Details</DialogDescription>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-500">Status</p>
                  {(() => {
                    const s = detailOrder.status?.toLowerCase() || "";
                    const cls = s === "delivered" ? "bg-emerald-100 text-emerald-700"
                      : (s.includes("approved") && !s.includes("pending")) ? "bg-emerald-100 text-emerald-700"
                      : (s.includes("pending") || s === "draft") ? "bg-amber-100 text-amber-700"
                      : s.includes("rejected") ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600";
                    return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${cls}`}>{detailOrder.status}</span>;
                  })()}
                </div>
                <div><p className="text-xs text-gray-500">Vendor</p>
                  <p className="font-medium">{detailOrder.companyName || "N/A"}</p></div>
                <div><p className="text-xs text-gray-500">Total Amount</p>
                  <p className="font-medium text-lg">${detailOrder.totalAmount?.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Order Date</p>
                  <p className="font-medium">{detailOrder.createdAt ? new Date(detailOrder.createdAt).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-gray-500">Expected Delivery</p>
                  <p className="font-medium">{detailOrder.deliveryDate ? new Date(detailOrder.deliveryDate).toLocaleDateString() : "—"}</p></div>
                {detailOrder.trackingNumber && (
                  <div><p className="text-xs text-gray-500">Tracking</p>
                    <p className="font-medium font-mono text-xs">{detailOrder.trackingNumber}</p></div>
                )}
              </div>
              {(detailOrder.description || detailOrder.title) && (
                <div><p className="text-xs text-gray-500">Description</p>
                  <p className="mt-0.5 text-gray-700">{detailOrder.description || detailOrder.title}</p></div>
              )}
              {canLogDelivery &&
                (detailOrder.status?.toLowerCase().includes("approved") ||
                  detailOrder.status?.toLowerCase() === "delivered") && (
                <WorkflowNextStep
                  message="Record goods received against this purchase order."
                  href={`/deliveries?poId=${detailOrder.id}`}
                  linkLabel="Log Delivery"
                  variant="blue"
                />
              )}
              {(detailOrder.status?.toLowerCase() === "delivered" ||
                detailOrder.deliveryStatus?.toLowerCase() === "delivered") && (
                <WorkflowNextStep
                  message="Delivery complete — validate vendor invoice (3-way match)."
                  href={`/invoices?poId=${detailOrder.id}`}
                  linkLabel="Invoices"
                />
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {canLogDelivery && detailOrder && (
              <Button
                size="sm"
                className="text-xs"
                onClick={() => {
                  setDeliveryPOId(detailOrder.id);
                  setDeliveryDialogOpen(true);
                  setDetailOrder(null);
                }}
              >
                Log Delivery Here
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    </RequireRole>
  );
}
