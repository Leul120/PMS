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
import { useToast } from "@/hooks/use-toast";
import { PODialog } from "./po-dialog";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  async function loadPurchaseOrders() {
    try {
      setLoading(true);
      const data = await poApi.getAll();
      setPurchaseOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
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
    switch (status) {
      case 'APPROVED': return 'success';
      case 'PENDING': return 'warning';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Procurement Management</h1>
            <p className="text-xs text-gray-500 mt-0.5">Create and approve purchase orders</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toast({ title: "Export", description: "Export feature coming soon!" })}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create PO
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-red-600 text-xs">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadPurchaseOrders} className="mt-2 text-xs h-7">
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
              <p className="text-xl font-semibold text-amber-700 mt-1">{loading ? "-" : purchaseOrders.filter(po => po.status === 'PENDING').length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Approved</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "-" : purchaseOrders.filter(po => po.status === 'APPROVED').length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3">
              <p className="text-xs text-red-600">Rejected</p>
              <p className="text-xl font-semibold text-red-700 mt-1">{loading ? "-" : purchaseOrders.filter(po => po.status === 'REJECTED').length}</p>
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
                      className="pl-8 w-full sm:w-[300px]"
                    />
                  </div>
                  <Button variant="outline" onClick={() => toast({ title: "Filter", description: "Advanced filtering coming soon!" })}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
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
                      {purchaseOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No purchase orders found. Create your first PO to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchaseOrders.map((po) => (
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
                                  <DropdownMenuItem onClick={() => toast({ title: "PO Details", description: `Viewing ${po.poNumber}` })}>View Details</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toast({ title: "Edit Order", description: `Editing ${po.poNumber} coming soon!` })}>Edit Order</DropdownMenuItem>
                                  {po.status === "PENDING" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleApprove(po.id)}>
                                        Approve
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleReject(po.id)} className="text-destructive">
                                        Reject
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
              </CardContent>
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
                    {purchaseOrders.filter(po => po.status === "PENDING").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No pending orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.filter(po => po.status === "PENDING").map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.poNumber}</TableCell>
                          <TableCell>{po.description || po.title || "N/A"}</TableCell>
                          <TableCell>{po.vendorName || "N/A"}</TableCell>
                          <TableCell className="font-medium">${po.totalAmount?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="mr-2" onClick={() => handleReject(po.id)}>Reject</Button>
                            <Button size="sm" onClick={() => handleApprove(po.id)}>Approve</Button>
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
                    {purchaseOrders.filter(po => po.status === "APPROVED").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No approved orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.filter(po => po.status === "APPROVED").map((po) => (
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
                    {purchaseOrders.filter(po => po.status === "REJECTED").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No rejected orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      purchaseOrders.filter(po => po.status === "REJECTED").map((po) => (
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
        onOpenChange={setDialogOpen} 
        onSuccess={loadPurchaseOrders} 
      />
    </DashboardLayout>
  );
}
