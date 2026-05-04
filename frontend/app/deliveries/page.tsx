"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deliveryApi, poApi, threeWayMatchApi, disputeApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DeliveryDialog } from "./delivery-dialog";
import { 
  Truck, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Search,
  Loader2,
  MapPin,
  Scale,
  MessageSquare
} from "lucide-react";

interface Delivery {
  id: string;
  poId: string;
  poNumber?: string;
  vendor?: string;
  vendorName?: string;
  quantity?: number;
  status: string;
  trackingNumber?: string;
  carrier?: string;
  deliveryDate?: string;
  createdAt?: string;
  progress?: number;
  origin?: string;
  destination?: string;
  eta?: string;
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  async function loadDeliveries() {
    try {
      setLoading(true);
      const pos = await poApi.getAll() as any[];
      // Extract deliveries from POs
      const deliveryItems: Delivery[] = pos
        .filter((po) => po.deliveryStatus || po.status === "SHIPPED" || po.status === "DELIVERED")
        .map((po) => ({
          id: po.id,
          poId: po.id,
          poNumber: po.poNumber,
          vendor: po.vendorName,
          status: po.deliveryStatus || po.status,
          trackingNumber: po.trackingNumber,
          deliveryDate: po.deliveryDate,
          origin: "Supplier",
          destination: "Main Warehouse",
          eta: po.deliveryDate,
        }));
      setDeliveries(deliveryItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeliveries();
  }, []);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'success';
      case 'IN_TRANSIT': return 'default';
      case 'PENDING': return 'warning';
      default: return 'secondary';
    }
  };

  async function handleThreeWayMatch(poId: string, deliveryId: string, invoiceId: string, poAmount: number, poQuantity: number) {
    try {
      const result = await threeWayMatchApi.validate(poId, deliveryId, invoiceId, poAmount, poQuantity);
      toast({
        title: result.status === 'MATCHED' ? '3-Way Match Successful' : 'Mismatch Detected',
        description: result.status === 'MATCHED' ? 'All values match correctly.' : result.mismatchReason,
        variant: result.status === 'MATCHED' ? 'default' : 'destructive',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to perform 3-way match',
        variant: 'destructive',
      });
    }
  }

  async function handleRaiseDispute(poId: string, deliveryId: string, type: string, description: string) {
    try {
      await disputeApi.raise({
        poId: parseInt(poId),
        deliveryId: parseInt(deliveryId),
        disputeType: type,
        description
      });
      toast({
        title: 'Dispute Raised',
        description: 'Your dispute has been submitted for review.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to raise dispute',
        variant: 'destructive',
      });
    }
  }
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Deliveries</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track shipments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toast({ title: "Export Report", description: "Report export coming soon!" })}>Export</Button>
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>Update Status</Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3">
              <p className="text-xs text-blue-600">In Transit</p>
              <p className="text-xl font-semibold text-blue-700 mt-1">{loading ? "-" : deliveries.filter(d => d.status === "SHIPPED" || d.status === "IN_TRANSIT").length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Delivered</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "-" : deliveries.filter(d => d.status === "DELIVERED").length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <p className="text-xs text-amber-600">Pending</p>
              <p className="text-xl font-semibold text-amber-700 mt-1">{loading ? "-" : deliveries.filter(d => d.status === "PENDING").length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3">
              <p className="text-xs text-red-600">Delayed</p>
              <p className="text-xl font-semibold text-red-700 mt-1">{loading ? "-" : deliveries.filter(d => d.status === "DELAYED").length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-700">Delivery Tracking</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="search"
                placeholder="Search deliveries..."
                className="pl-8 w-[200px] h-8 text-xs border-gray-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Delivery ID</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">PO Reference</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Vendor</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Progress</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Route</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Carrier</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">ETA</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-medium">{delivery.id}</TableCell>
                    <TableCell>{delivery.poId}</TableCell>
                    <TableCell>{delivery.vendorName || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          delivery.status === "delivered" ? "success" : 
                          delivery.status === "in_transit" ? "warning" : "secondary"
                        }
                      >
                        {delivery.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={delivery.progress} className="w-20" />
                        <span className="text-sm">{delivery.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {delivery.origin} → {delivery.destination}
                      </div>
                    </TableCell>
                    <TableCell>{delivery.carrier}</TableCell>
                    <TableCell>{delivery.eta}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleThreeWayMatch(delivery.poId, delivery.id, delivery.id, delivery.quantity || 0, delivery.quantity || 0)}
                          title="3-Way Match"
                        >
                          <Scale className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRaiseDispute(delivery.poId, delivery.id, 'DELIVERY_ISSUE', 'Delivery issue reported')}
                          title="Raise Dispute"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      <DeliveryDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSuccess={loadDeliveries} 
      />
    </DashboardLayout>
  );
}
