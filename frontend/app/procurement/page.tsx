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
import { poApi } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PODialog } from "./po-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Loader2
} from "lucide-react";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  title?: string;
  description?: string;
  vendorName?: string;
  totalAmount: number;
  status: string;
  priority?: string;
  createdAt: string;
  deliveryDate?: string;
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

  // Filter orders based on search query and status
  useEffect(() => {
    let filtered = purchaseOrders;
    if (statusFilter !== "ALL") {
      filtered = filtered.filter(po => po.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (po) =>
          po.poNumber?.toLowerCase().includes(query) ||
          po.vendorName?.toLowerCase().includes(query) ||
          po.description?.toLowerCase().includes(query) ||
          po.status?.toLowerCase().includes(query)
      );
    }
    setFilteredOrders(filtered);
  }, [searchQuery, purchaseOrders, statusFilter]);

  // Export purchase orders to CSV
  function handleExport() {
    const headers = ["PO Number", "Description", "Vendor", "Status", "Priority", "Total Amount", "Created At", "Delivery Date"];
    const rows = filteredOrders.map(po => [
      po.poNumber,
      po.description || po.title || "",
      po.vendorName || "",
      po.status,
      po.priority || "",
      po.totalAmount?.toString() || "0",
      po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "",
      po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString() : ""
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${cell}"`).join(","))].join("\n");
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
      loadPurchaseOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve order");
    }
  }

  async function handleReject(id: string) {
    try {
      await poApi.reject(id);
      loadPurchaseOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject order");
    }
  }

  const getStatusVariant = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (s.includes("approved") && !s.includes("pending")) return "success";
    if (s.includes("pending") || s === "draft") return "warning";
    if (s.includes("rejected")) return "destructive";
    return "secondary";
  };

  const isPending = (status: string) =>
    status?.toLowerCase().includes("pending") || status?.toLowerCase() === "draft";

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Procurement Management</h1>
            <p className="text-xs text-gray-500 mt-0.5">Create and approve purchase orders</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            {canCreatePO && (
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create PO
            </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-red-600 text-xs">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadPurchaseOrders(currentPage)} className="mt-2 text-xs h-7">
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Total POs</p>
              <p className="text-xl font-semibold text-gray-700 mt-1">{loading ? "-" : purchaseOrders.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <p className="text-xs text-amber-600">Pending</p>
              <p className="text-xl font-semibold text-amber-700 mt-1">{loading ? "-" : purchaseOrders.filter(po => isPending(po.status)).length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Approved</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "-" : purchaseOrders.filter(po => po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending")).length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3">
              <p className="text-xs text-red-600">Rejected</p>
              <p className="text-xl font-semibold text-red-700 mt-1">{loading ? "-" : purchaseOrders.filter(po => po.status?.toLowerCase().includes("rejected")).length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Purchase Orders</CardTitle>
                  <CardDescription>Manage your purchase orders and track status</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search POs..."
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
                      <SelectItem value="Draft">Draft</SelectItem>
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
                        <TableHead>PO Number</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No purchase orders found. Create your first PO to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((po) => (
                          <TableRow key={po.id}>
                            <TableCell className="font-medium">{po.poNumber}</TableCell>
                            <TableCell>{po.description || po.title || "N/A"}</TableCell>
                            <TableCell>{po.vendorName || "N/A"}</TableCell>
                            <TableCell className="font-medium">${po.totalAmount?.toLocaleString() || 0}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(po.status)}>
                                {po.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
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
                                  {canCreatePO && (
                                  <DropdownMenuItem onClick={() => { setSelectedPO(po); setDialogOpen(true); }}>Edit Order</DropdownMenuItem>
                                  )}
                                  {isPending(po.status) && (canApprovePO || canRejectPO) && (
                                    <>
                                      <DropdownMenuSeparator />
                                      {canApprovePO && (
                                      <DropdownMenuItem onClick={() => handleApprove(po.id)}>
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

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Orders</CardTitle>
                <CardDescription>Orders awaiting approval</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.filter(po => isPending(po.status)).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No pending orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.filter(po => isPending(po.status)).map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.poNumber}</TableCell>
                          <TableCell>{po.description || po.title || "N/A"}</TableCell>
                          <TableCell>{po.vendorName || "N/A"}</TableCell>
                          <TableCell className="font-medium">${po.totalAmount?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-right">
                            {canRejectPO && <Button size="sm" variant="outline" className="mr-2" onClick={() => handleReject(po.id)}>Reject</Button>}
                            {canApprovePO && <Button size="sm" onClick={() => handleApprove(po.id)}>Approve</Button>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <CardTitle>Approved Orders</CardTitle>
                <CardDescription>Approved purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.filter(po => po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending")).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No approved orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.filter(po => po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending")).map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.poNumber}</TableCell>
                          <TableCell>{po.description || po.title || "N/A"}</TableCell>
                          <TableCell>{po.vendorName || "N/A"}</TableCell>
                          <TableCell className="font-medium">${po.totalAmount?.toLocaleString() || 0}</TableCell>
                          <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected">
            <Card>
              <CardHeader>
                <CardTitle>Rejected Orders</CardTitle>
                <CardDescription>Rejected purchase orders</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.filter(po => po.status?.toLowerCase().includes("rejected")).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No rejected orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.filter(po => po.status?.toLowerCase().includes("rejected")).map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.poNumber}</TableCell>
                          <TableCell>{po.description || po.title || "N/A"}</TableCell>
                          <TableCell>{po.vendorName || "N/A"}</TableCell>
                          <TableCell className="font-medium">${po.totalAmount?.toLocaleString() || 0}</TableCell>
                          <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
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
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedPO(null); }}
        onSuccess={loadPurchaseOrders}
        initialData={selectedPO}
      />
    </DashboardLayout>
    </RequireRole>
  );
}


