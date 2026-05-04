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
import { useToast } from "@/hooks/use-toast";
import { PODialog } from "../procurement/po-dialog";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const data = await poApi.getAll();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'success';
      case 'SHIPPED': return 'default';
      case 'APPROVED': return 'success';
      case 'PENDING': return 'warning';
      default: return 'secondary';
    }
  };
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Order Fulfillment</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track orders, deliveries, and receipts</p>
          </div>
          <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Order
          </Button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-red-600 text-xs">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadOrders} className="mt-2 text-xs h-7">
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
              <p className="text-xl font-semibold text-amber-700 mt-1">{loading ? "-" : orders.filter(o => o.status === 'PENDING').length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3">
              <p className="text-xs text-blue-600">Approved</p>
              <p className="text-xl font-semibold text-blue-700 mt-1">{loading ? "-" : orders.filter(o => o.status === 'APPROVED').length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Delivered</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "-" : orders.filter(o => o.status === 'DELIVERED').length}</p>
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
                      {orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No orders found. Create your first order to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order) => (
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
                                  <DropdownMenuItem onClick={() => toast({ title: "Order Details", description: `Viewing order ${order.poNumber}` })}>View Details</DropdownMenuItem>
                                  {order.trackingNumber && (
                                    <DropdownMenuItem onClick={() => toast({ title: "Tracking", description: `Tracking: ${order.trackingNumber}` })}>Track: {order.trackingNumber}</DropdownMenuItem>
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
                    {orders.filter(o => o.status === 'PROCESSING' || o.status === 'PENDING').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No processing orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.filter(o => o.status === 'PROCESSING' || o.status === 'PENDING').map((order) => (
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
                    {orders.filter(o => o.status === 'SHIPPED' || o.deliveryStatus === 'SHIPPED').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No shipped orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.filter(o => o.status === 'SHIPPED' || o.deliveryStatus === 'SHIPPED').map((order) => (
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
                    {orders.filter(o => o.status === 'DELIVERED' || o.deliveryStatus === 'DELIVERED').length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No delivered orders found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.filter(o => o.status === 'DELIVERED' || o.deliveryStatus === 'DELIVERED').map((order) => (
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
    </DashboardLayout>
  );
}
