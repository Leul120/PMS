"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deliveryApi, poApi, threeWayMatchApi, disputeApi } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DeliveryDialog } from "./delivery-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
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
  const [filteredDeliveries, setFilteredDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  // 3-way match dialog state
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchDelivery, setMatchDelivery] = useState<Delivery | null>(null);
  const [matchInvoiceId, setMatchInvoiceId] = useState("");
  const [matchAmount, setMatchAmount] = useState("");
  const [matchQuantity, setMatchQuantity] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);
  // Dispute dialog state
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeDelivery, setDisputeDelivery] = useState<Delivery | null>(null);
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);
  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const canUpdateDelivery = hasPermission("deliveries:update");
  const canValidateMatch = hasPermission("three-way-match:validate");
  const canRaiseDispute = hasPermission("invoices:dispute");

  async function loadDeliveries(page = 0) {
    try {
      setLoading(true);
      let deliveryItems: Delivery[] = [];
      let pages = 0;
      let total = 0;
      try {
        const response = await deliveryApi.getAll(page, PAGE_SIZE);
        const data = response.content ?? [];
        pages = response.totalPages ?? 0;
        total = response.totalElements ?? 0;
        if (data.length > 0) {
          deliveryItems = data.map((d: any) => ({
            id: String(d.deliveryId || d.id),
            poId: String(d.poId || d.purchaseOrderId || d.id),
            poNumber: d.poNumber,
            vendor: d.vendorName || d.vendor,
            vendorName: d.vendorName || d.vendor,
            quantity: d.quantityDelivered || d.quantity,
            status: d.deliveryStatus || d.status || "Delivered",
            trackingNumber: d.trackingNumber,
            carrier: d.carrier,
            deliveryDate: d.actualDate || d.deliveryDate,
            createdAt: d.createdAt,
            origin: d.origin || "Supplier",
            destination: d.destination || "Main Warehouse",
            eta: d.expectedDate || d.eta,
          }));
        }
      } catch {
        // Delivery endpoint not available â€â€ derive from POs
      }

      if (deliveryItems.length === 0) {
        const poResponse = await poApi.getAll(page, PAGE_SIZE);
        const pos = poResponse.content ?? [];
        pages = poResponse.totalPages ?? 0;
        total = poResponse.totalElements ?? 0;
        deliveryItems = pos
          .filter((po: any) => po.deliveryStatus || ["SHIPPED","DELIVERED","IN_TRANSIT"].includes(po.status))
          .map((po: any) => ({
            id: String(po.id),
            poId: String(po.id),
            poNumber: po.poNumber,
            vendor: po.vendorName,
            vendorName: po.vendorName,
            status: po.deliveryStatus || po.status,
            trackingNumber: po.trackingNumber,
            deliveryDate: po.deliveryDate,
            origin: "Supplier",
            destination: "Main Warehouse",
            eta: po.deliveryDate,
          }));
      }

      setDeliveries(deliveryItems);
      setFilteredDeliveries(deliveryItems);
      setTotalPages(pages);
      setTotalElements(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  // Filter deliveries based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDeliveries(deliveries);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredDeliveries(
        deliveries.filter(
          (d) =>
            d.poNumber?.toLowerCase().includes(query) ||
            d.vendor?.toLowerCase().includes(query) ||
            d.status?.toLowerCase().includes(query) ||
            d.trackingNumber?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, deliveries]);

  // Export deliveries to CSV
  function handleExport() {
    const headers = ["PO Number", "Vendor", "Status", "Tracking Number", "Delivery Date", "Origin", "Destination"];
    const rows = filteredDeliveries.map(d => [
      d.poNumber || d.poId,
      d.vendor || "N/A",
      d.status,
      d.trackingNumber || "",
      d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString() : "",
      d.origin || "Supplier",
      d.destination || "Main Warehouse"
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliveries-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Export Complete", description: `${filteredDeliveries.length} deliveries exported to CSV` });
  }

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"])) return;
    loadDeliveries(currentPage);
  }, [currentPage]);

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
      setMatchLoading(true);
      const result = await threeWayMatchApi.validate(
        parseInt(poId),
        parseInt(deliveryId),
        parseInt(invoiceId),
        poAmount,
        poQuantity
      );
      toast({
        title: result.status === 'MATCHED' ? '3-Way Match Successful' : 'Mismatch Detected',
        description: result.status === 'MATCHED' ? 'All values match correctly.' : result.mismatchReason,
        variant: result.status === 'MATCHED' ? 'default' : 'destructive',
      });
      setMatchDialogOpen(false);
      setMatchDelivery(null);
      setMatchInvoiceId("");
      setMatchAmount("");
      setMatchQuantity("");
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to perform 3-way match',
        variant: 'destructive',
      });
    } finally {
      setMatchLoading(false);
    }
  }

  async function handleRaiseDispute(poId: string, deliveryId: string, type: string, description: string) {
    try {
      setDisputeLoading(true);
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
      setDisputeDialogOpen(false);
      setDisputeDelivery(null);
      setDisputeDescription("");
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to raise dispute',
        variant: 'destructive',
      });
    } finally {
      setDisputeLoading(false);
    }
  }
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Deliveries</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track shipments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}>Export</Button>
            {canUpdateDelivery && (
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>Update Status</Button>
            )}
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                {filteredDeliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500 text-xs">
                      No deliveries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">{delivery.id}</TableCell>
                      <TableCell>{delivery.poId}</TableCell>
                      <TableCell>{delivery.vendorName || delivery.vendor || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            delivery.status?.toLowerCase() === "delivered" ? "default" : 
                            delivery.status?.toLowerCase() === "in_transit" ? "secondary" : "outline"
                          }
                        >
                          {delivery.status?.replace("_", " ") || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={delivery.progress || 0} className="w-20" />
                          <span className="text-xs">{delivery.progress || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {delivery.origin || 'Supplier'} â†â€™ {delivery.destination || 'Warehouse'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{delivery.carrier || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{delivery.eta || delivery.deliveryDate || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canValidateMatch && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => { setMatchDelivery(delivery); setMatchDialogOpen(true); }}
                            title="3-Way Match"
                          >
                            <Scale className="h-3.5 w-3.5" />
                          </Button>
                          )}
                          {canRaiseDispute && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => { setDisputeDelivery(delivery); setDisputeDialogOpen(true); }}
                            title="Raise Dispute"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
      </div>
      
      <DeliveryDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSuccess={loadDeliveries} 
      />

      {/* 3-Way Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>3-Way Match Validation</DialogTitle>
            <DialogDescription>
              Enter the invoice details to validate against PO {matchDelivery?.poNumber || matchDelivery?.poId}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice ID</Label>
              <Input
                value={matchInvoiceId}
                onChange={e => setMatchInvoiceId(e.target.value)}
                placeholder="Enter invoice ID"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">PO Amount ($)</Label>
                <Input
                  type="number"
                  value={matchAmount}
                  onChange={e => setMatchAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO Quantity</Label>
                <Input
                  type="number"
                  value={matchQuantity}
                  onChange={e => setMatchQuantity(e.target.value)}
                  placeholder="0"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMatchDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!matchInvoiceId || !matchAmount || !matchQuantity || matchLoading}
              onClick={() => matchDelivery && handleThreeWayMatch(
                matchDelivery.poId,
                matchDelivery.id,
                matchInvoiceId,
                parseFloat(matchAmount),
                parseInt(matchQuantity)
              )}
            >
              {matchLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Validate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raise Dispute Dialog */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Raise Dispute</DialogTitle>
            <DialogDescription>
              Describe the issue with delivery for PO {disputeDelivery?.poNumber || disputeDelivery?.poId}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <textarea
                value={disputeDescription}
                onChange={e => setDisputeDescription(e.target.value)}
                placeholder="Describe the delivery issue in detail..."
                rows={4}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDisputeDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!disputeDescription.trim() || disputeLoading}
              onClick={() => disputeDelivery && handleRaiseDispute(
                disputeDelivery.poId,
                disputeDelivery.id,
                'DELIVERY_ISSUE',
                disputeDescription
              )}
            >
              {disputeLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    </RequireRole>
  );
}
