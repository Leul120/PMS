"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { deliveryApi, poApi } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PODialog } from "../procurement/po-dialog";
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
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Package,
  Truck,
  CheckCircle,
  Clock,
  Loader2
} from "lucide-react";

interface Order {
  id: string;
  poNumber: string;
  title?: string;
  description?: string;
  vendorName?: string;
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
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const canCreatePO = hasPermission("po:create");
  const canLogDelivery = hasPermission("deliveries:update");

  // Delivery dialog pre-filled from PO
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryPOId, setDeliveryPOId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"])) return;
    loadOrders(currentPage);
  }, [currentPage]);

  async function loadOrders(page = 0) {
    try {
      setLoading(true);
      const response = await poApi.getAll(page, PAGE_SIZE);
      const items = response.content ?? [];
      const normalised = items.map((po: any) => ({
        ...po,
        id: String(po.id || po.poId),
        poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
        vendorName: po.vendorName || (po.vendorId ? `Vendor #${po.vendorId}` : "N/A"),
        createdAt: po.createdAt || po.issueDate,
        deliveryDate: po.deliveryDate || po.expectedDeliveryDate,
        totalAmount: Number(po.totalAmount) || 0,
      }));
      setOrders(normalised);
      setFilteredOrders(normalised);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  // Filter orders based on search query and status filter
  useEffect(() => {
    let filtered = orders;
    if (statusFilter !== "ALL") {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.poNumber?.toLowerCase().includes(query) ||
          o.vendorName?.toLowerCase().includes(query) ||
          o.description?.toLowerCase().includes(query) ||
          o.status?.toLowerCase().includes(query) ||
          o.trackingNumber?.toLowerCase().includes(query)
      );
    }
    setFilteredOrders(filtered);
  }, [searchQuery, orders, statusFilter]);

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
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Order Fulfillment</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track orders, deliveries, and receipts</p>
          </div>
          {canCreatePO && (
          <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Order
          </Button>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-red-600 text-xs">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadOrders(currentPage)} className="mt-2 text-xs h-7">
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Total Orders</p>
              <p className="text-xl font-semibold text-gray-700 mt-1">{loading ? "-" : orders.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <p className="text-xs text-amber-600">Pending</p>
              <p className="text-xl font-semibold text-amber-700 mt-1">{loading ? "-" : orders.filter(o => isPending(o.status)).length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3">
              <p className="text-xs text-blue-600">Approved</p>
              <p className="text-xl font-semibold text-blue-700 mt-1">{loading ? "-" : orders.filter(o => o.status?.toLowerCase().includes("approved") && !o.status?.toLowerCase().includes("pending")).length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Delivered</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "-" : orders.filter(o => o.status?.toLowerCase() === 'delivered').length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="shipped">Shipped</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Order List</CardTitle>
                  <CardDescription>View and manage all purchase orders</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search orders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-full sm:w-[300px]"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-9">
                      <Filter className="mr-1.5 h-3.5 w-3.5" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Pending Approval">Pending</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Expected Delivery</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No orders found. Create your first order to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.poNumber}</TableCell>
                            <TableCell>{order.description || order.title || "N/A"}</TableCell>
                            <TableCell>{order.vendorName || "N/A"}</TableCell>
                            <TableCell className="font-medium">${order.totalAmount?.toLocaleString() || 0}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(order.status)}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "N/A"}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDetailOrder(order)}>View Details</DropdownMenuItem>
                                  {canLogDelivery && (order.status?.toLowerCase().includes("approved") || order.status?.toLowerCase() === "delivered") && (
                                    <DropdownMenuItem onClick={() => {
                                      setDeliveryPOId(order.id);
                                      setDeliveryDialogOpen(true);
                                    }}>
                                      Log Delivery Receipt
                                    </DropdownMenuItem>
                                  )}
                                  {order.trackingNumber && (
                                    <DropdownMenuItem onClick={() => {
                                      navigator.clipboard.writeText(order.trackingNumber!).catch(() => {});
                                      toast({ title: "Tracking Number Copied", description: order.trackingNumber });
                                    }}>
                                      Copy Tracking: {order.trackingNumber}
                                    </DropdownMenuItem>
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
              </CardContent>
              <PaginationControls
                page={currentPage}
                totalPages={totalPages}
                totalElements={totalElements}
                size={PAGE_SIZE}
                onPageChange={(p) => setCurrentPage(p)}
                loading={loading}
              />
            </Card>
          </TabsContent>

          <TabsContent value="processing">
            <Card>
              <CardHeader>
                <CardTitle>Processing Orders</CardTitle>
                <CardDescription>Orders being prepared for shipment</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.filter(o => isPending(o.status) || o.status?.toLowerCase() === 'processing').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No processing orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.filter(o => isPending(o.status) || o.status?.toLowerCase() === 'processing').map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.poNumber}</TableCell>
                          <TableCell>{order.description || order.title || "N/A"}</TableCell>
                          <TableCell>{order.vendorName || "N/A"}</TableCell>
                          <TableCell className="font-medium">${order.totalAmount?.toLocaleString() || 0}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shipped">
            <Card>
              <CardHeader>
                <CardTitle>Shipped Orders</CardTitle>
                <CardDescription>Orders in transit</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Tracking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.filter(o => o.status?.toLowerCase() === 'shipped' || o.status?.toLowerCase() === 'in_transit' || o.deliveryStatus?.toLowerCase() === 'shipped').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No shipped orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.filter(o => o.status?.toLowerCase() === 'shipped' || o.status?.toLowerCase() === 'in_transit' || o.deliveryStatus?.toLowerCase() === 'shipped').map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.poNumber}</TableCell>
                          <TableCell>{order.description || order.title || "N/A"}</TableCell>
                          <TableCell>{order.vendorName || "N/A"}</TableCell>
                          <TableCell className="font-medium">${order.totalAmount?.toLocaleString() || 0}</TableCell>
                          <TableCell>{order.trackingNumber || "N/A"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="delivered">
            <Card>
              <CardHeader>
                <CardTitle>Delivered Orders</CardTitle>
                <CardDescription>Completed deliveries</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Delivery Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.filter(o => o.status?.toLowerCase() === 'delivered' || o.deliveryStatus?.toLowerCase() === 'delivered').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No delivered orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.filter(o => o.status?.toLowerCase() === 'delivered' || o.deliveryStatus?.toLowerCase() === 'delivered').map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.poNumber}</TableCell>
                          <TableCell>{order.description || order.title || "N/A"}</TableCell>
                          <TableCell>{order.vendorName || "N/A"}</TableCell>
                          <TableCell className="font-medium">${order.totalAmount?.toLocaleString() || 0}</TableCell>
                          <TableCell>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "N/A"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <PODialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSuccess={loadOrders} 
      />

      <DeliveryDialog
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
        onSuccess={loadOrders}
        prefilledPoId={deliveryPOId}
      />

      {/* Order Detail Dialog */}
      <Dialog open={!!detailOrder} onOpenChange={(o) => !o && setDetailOrder(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{detailOrder?.poNumber}</DialogTitle>
            <DialogDescription>Purchase Order Details</DialogDescription>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-500">Status</p>
                  <Badge variant={getStatusVariant(detailOrder.status)} className="mt-0.5">{detailOrder.status}</Badge></div>
                <div><p className="text-xs text-gray-500">Vendor</p>
                  <p className="font-medium">{detailOrder.vendorName || "N/A"}</p></div>
                <div><p className="text-xs text-gray-500">Total Amount</p>
                  <p className="font-medium text-lg">${detailOrder.totalAmount?.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Order Date</p>
                  <p className="font-medium">{detailOrder.createdAt ? new Date(detailOrder.createdAt).toLocaleDateString() : "â€â€"}</p></div>
                <div><p className="text-xs text-gray-500">Expected Delivery</p>
                  <p className="font-medium">{detailOrder.deliveryDate ? new Date(detailOrder.deliveryDate).toLocaleDateString() : "â€â€"}</p></div>
                {detailOrder.trackingNumber && (
                  <div><p className="text-xs text-gray-500">Tracking</p>
                    <p className="font-medium font-mono text-xs">{detailOrder.trackingNumber}</p></div>
                )}
              </div>
              {(detailOrder.description || detailOrder.title) && (
                <div><p className="text-xs text-gray-500">Description</p>
                  <p className="mt-0.5 text-gray-700">{detailOrder.description || detailOrder.title}</p></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    </RequireRole>
  );
}

