"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { deliveryApi, poApi, threeWayMatchApi, disputeApi, getCompanyNameMap, invoiceApi, deliveryStatusQuery } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { displayVendorName } from "@/lib/display";
import { formatQualityIssues, formatQualityRating } from "@/lib/delivery-quality";
import { useToast } from "@/hooks/use-toast";
import { DeliveryDialog } from "./delivery-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RequireRole } from "@/components/require-role";
import { useListDeepLink } from "@/hooks/use-list-deep-link";
import { useAuthStore } from "@/lib/auth-store";
import { ProcurementPipelineBanner } from "@/components/procurement-pipeline-banner";
import { WorkflowNextStep } from "@/components/workflow-next-step";
import {
  Search, Loader2, MapPin, Scale, MessageSquare, Filter,
  Truck, CheckCircle2, Clock, AlertTriangle, Download, Plus,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Delivery {
  id: string;
  poId: string;
  poNumber?: string;
  vendor?: string;
  vendorName?: string;
  companyName?: string;
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
  qualityRating?: string;
  qualityIssueTypes?: string;
  qualityRemarks?: string;
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
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
  const [detailDelivery, setDetailDelivery] = useState<Delivery | null>(null);

  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const canUpdateDelivery = hasPermission("deliveries:update");
  const canValidateMatch = hasPermission("three-way-match:validate");
  const canRaiseDispute = hasPermission("invoices:dispute");

  const [updatingDelivery, setUpdatingDelivery] = useState<string | null>(null);

  // Invoices for the selected delivery's PO (used in 3-way match dropdown)
  const [poInvoices, setPoInvoices] = useState<any[]>([]);

  const loadDeliveries = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      let deliveryItems: Delivery[] = [];
      let pages = 0;
      let total = 0;

      const vendorMap = await getCompanyNameMap().catch(() => new Map<string, string>());

      try {
        const data = await deliveryApi.getAll({
          page,
          size: PAGE_SIZE,
          search: debouncedSearch,
          ...deliveryStatusQuery(statusFilter),
          sort: "id-desc",
        });

        const dataContent = data.content ?? [];
        pages = data.totalPages ?? 0;
        total = data.totalElements ?? 0;
        if (dataContent.length > 0) {
          deliveryItems = dataContent.map((d: any) => {
            const vendorId = String(d.vendorId || "");
            const companyName =
              d.vendorName || d.vendor || displayVendorName(vendorId, { map: vendorMap, empty: "N/A" });
            const deliveryId = String(d.deliveryId || d.id);
            const poId = String(d.poId || d.purchaseOrderId || d.id);
            const poNumber = d.poNumber || `PO-${poId.padStart(6, "0")}`;
            return {
              id: deliveryId,
              poId,
              poNumber,
              vendor: companyName,
              companyName,
              quantity: d.quantityDelivered || d.quantity,
              status: d.deliveryStatus || d.status || "Delivered",
              trackingNumber: d.trackingNumber,
              carrier: d.carrier,
              deliveryDate: d.actualDate || d.deliveryDate,
              createdAt: d.createdAt,
              origin: d.origin || "Supplier",
              destination: d.destination || "Main Warehouse",
              eta: d.expectedDate || d.eta,
              qualityRating: d.qualityRating,
              qualityIssueTypes: d.qualityIssueTypes,
              qualityRemarks: d.qualityRemarks,
            };
          });
        }
      } catch {
        // Delivery endpoint not available — derive from POs
      }

      if (deliveryItems.length === 0 && !debouncedSearch && statusFilter === "ALL") {
        const poResponse = await poApi.getAll({ page, size: PAGE_SIZE });
        const pos = poResponse.content ?? [];
        pages = poResponse.totalPages ?? 0;
        total = poResponse.totalElements ?? 0;
        deliveryItems = pos
          .filter((po: any) => po.deliveryStatus || ["SHIPPED", "DELIVERED", "IN_TRANSIT"].includes(po.status))
          .map((po: any) => {
            const vendorId = String(po.vendorId || "");
            const companyName =
              po.vendorName || displayVendorName(vendorId, { map: vendorMap, empty: "N/A" });
            const poId = String(po.id || po.poId);
            const poNumber = po.poNumber || `PO-${poId.padStart(6, "0")}`;
            return {
              id: poId,
              poId,
              poNumber,
              vendor: companyName,
              companyName,
              status: po.deliveryStatus || po.status,
              trackingNumber: po.trackingNumber,
              deliveryDate: po.deliveryDate,
              origin: "Supplier",
              destination: "Main Warehouse",
              eta: po.deliveryDate,
            };
          });
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
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearch, statusFilter]);

  // Export deliveries to CSV
  function handleExport() {
    const headers = ["Delivery ID", "PO Number", "Vendor", "Status", "Tracking Number", "Delivery Date", "Origin", "Destination"];
    const rows = filteredDeliveries.map((d) => [
      `DEL-${d.id.padStart(6, "0")}`,
      d.poNumber || d.poId,
      d.vendorName || d.vendor || "N/A",
      d.status,
      d.trackingNumber || "",
      d.deliveryDate ? new Date(d.deliveryDate).toLocaleDateString() : "",
      d.origin || "Supplier",
      d.destination || "Main Warehouse",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
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
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"])) return;
    loadDeliveries(currentPage);
  }, [currentPage, loadDeliveries]);

  useListDeepLink(deliveries, loading, (delivery) => setDetailDelivery(delivery), {
    paramNames: ["id", "poId"],
    match: (item, value, paramName) =>
      paramName === "poId"
        ? String((item as Delivery).poId ?? "") === value
        : String(item.id) === value,
  });

  async function handleThreeWayMatch(
    poId: string,
    deliveryId: string,
    invoiceId: string,
    poAmount: number,
    poQuantity: number
  ) {
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
        title: result.status === "MATCHED" ? "3-Way Match Successful" : "Mismatch Detected",
        description: result.status === "MATCHED" ? "All values match correctly." : result.mismatchReason,
        variant: result.status === "MATCHED" ? "default" : "destructive",
      });
      setMatchDialogOpen(false);
      setMatchDelivery(null);
      setMatchInvoiceId("");
      setMatchAmount("");
      setMatchQuantity("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to perform 3-way match",
        variant: "destructive",
      });
    } finally {
      setMatchLoading(false);
    }
  }

  async function handleMarkDelivered(delivery: Delivery) {
    setUpdatingDelivery(delivery.id);
    try {
      await deliveryApi.updateStatus(delivery.id, "Delivered");
      toast({ title: "Delivery Confirmed", description: `Delivery DEL-${delivery.id.padStart(6, "0")} marked as delivered. PO status updated.` });
      loadDeliveries(currentPage);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update delivery status",
        variant: "destructive",
      });
    } finally {
      setUpdatingDelivery(null);
    }
  }

  async function handleRaiseDispute(poId: string, deliveryId: string, type: string, description: string) {
    try {
      setDisputeLoading(true);
      await disputeApi.raise({
        poId: parseInt(poId),
        deliveryId: parseInt(deliveryId),
        disputeType: type,
        description,
      });
      toast({ title: "Dispute Raised", description: "Your dispute has been submitted for review." });
      setDisputeDialogOpen(false);
      setDisputeDelivery(null);
      setDisputeDescription("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to raise dispute",
        variant: "destructive",
      });
    } finally {
      setDisputeLoading(false);
    }
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <ProcurementPipelineBanner activeStep="delivery" />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Deliveries</h1>
              <p className="text-xs text-gray-500 mt-0.5">Track shipments from dispatch to receipt</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              {canUpdateDelivery && (
                <Button size="sm" className="text-xs h-8 gap-1.5" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Log Delivery
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          {(() => {
            const inTransit = deliveries.filter(d => ["SHIPPED","IN_TRANSIT"].includes(d.status?.toUpperCase())).length;
            const delivered = deliveries.filter(d => d.status?.toUpperCase() === "DELIVERED").length;
            const pending = deliveries.filter(d => ["PENDING","SCHEDULED"].includes(d.status?.toUpperCase())).length;
            const delayed = deliveries.filter(d => d.status?.toUpperCase() === "DELAYED").length;
            const overdue = deliveries.filter(d => { const eta = d.eta || d.deliveryDate; return eta && new Date(eta) < new Date() && d.status?.toUpperCase() !== "DELIVERED"; }).length;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
                {[
                  { label: "In Transit", value: inTransit, icon: Truck },
                  { label: "Delivered", value: delivered, icon: CheckCircle2 },
                  { label: "Pending / Scheduled", value: pending, icon: Clock },
                  { label: delayed > 0 ? `Delayed${overdue > 0 ? ` (${overdue} overdue)` : ""}` : "Delayed", value: delayed, icon: AlertTriangle },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="px-4 py-3 flex items-center gap-3">
                    <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                      {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">Delivery Tracking</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{filteredDeliveries.length} shipment{filteredDeliveries.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex gap-2">
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-[140px]">
                    <Filter className="mr-1.5 h-3.5 w-3.5" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                    <SelectItem value="SHIPPED">Shipped</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="DELAYED">Delayed</SelectItem>
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
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Delivery #</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Purchase Order</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Route</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Carrier</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Expected Date</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliveries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <Truck className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm font-medium text-gray-600">
                            {searchQuery || statusFilter !== "ALL" ? "No deliveries match your filter" : "No deliveries yet"}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {searchQuery || statusFilter !== "ALL" ? "Try adjusting your search or filter" : "Deliveries will appear here once orders are shipped"}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDeliveries.map((delivery) => {
                        const etaDate = delivery.eta ? new Date(delivery.eta) : delivery.deliveryDate ? new Date(delivery.deliveryDate) : null;
                        const isOverdue = etaDate && etaDate < new Date() && delivery.status?.toUpperCase() !== "DELIVERED";

                        return (
                        <TableRow key={delivery.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${isOverdue ? "bg-red-50/30" : ""}`} onClick={() => setDetailDelivery(delivery)}>
                          <TableCell className="font-medium text-xs font-mono">
                            DEL-{delivery.id.padStart(6, "0")}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{delivery.poNumber}</TableCell>
                          <TableCell className="text-xs text-gray-700">{delivery.vendorName || delivery.vendor || "—"}</TableCell>
                          <TableCell>
                            {(() => {
                              const statusUp = delivery.status?.toUpperCase();
                              const cls = statusUp === "DELIVERED" ? "bg-emerald-100 text-emerald-700"
                                : statusUp === "DELAYED" ? "bg-red-100 text-red-700"
                                : ["IN_TRANSIT","SHIPPED"].includes(statusUp || "") ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600";
                              return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{delivery.status?.replace(/_/g, " ") || "Unknown"}</span>;
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                              <span className="truncate max-w-[120px]">{delivery.origin || "Supplier"} → {delivery.destination || "Warehouse"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">{delivery.carrier || <span className="text-gray-400">—</span>}</TableCell>
                          <TableCell className="text-xs">
                            {etaDate ? (
                              <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-600"}>
                                {isOverdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                {etaDate.toLocaleDateString()}
                                {isOverdue && <span className="text-[10px] block text-red-500">Overdue</span>}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              {canUpdateDelivery && ["IN_TRANSIT", "SHIPPED", "PENDING", "SCHEDULED"].includes(delivery.status?.toUpperCase()) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                  onClick={() => handleMarkDelivered(delivery)}
                                  disabled={updatingDelivery === delivery.id}
                                  title="Mark as Delivered"
                                >
                                  {updatingDelivery === delivery.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                  {updatingDelivery !== delivery.id && "Deliver"}
                                </Button>
                              )}
                              {canValidateMatch && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={async () => {
                                    setMatchDelivery(delivery);
                                    setMatchInvoiceId("");
                                    setMatchAmount("");
                                    setMatchQuantity(
                                      delivery.quantity != null ? String(delivery.quantity) : ""
                                    );
                                    setMatchDialogOpen(true);
                                    try {
                                      const [invs, po] = await Promise.all([
                                        invoiceApi.getByPO(delivery.poId).catch(() => []),
                                        poApi.getById(delivery.poId).catch(() => null),
                                      ]);
                                      setPoInvoices(invs as any[]);
                                      if (po?.totalAmount != null) {
                                        setMatchAmount(String(po.totalAmount));
                                      }
                                      const qtyFromPo = po?.expectedQuantity ?? po?.quantity;
                                      if (qtyFromPo != null && !delivery.quantity) {
                                        setMatchQuantity(String(qtyFromPo));
                                      }
                                    } catch {
                                      setPoInvoices([]);
                                    }
                                  }}
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
                                  onClick={() => {
                                    setDisputeDelivery(delivery);
                                    setDisputeDialogOpen(true);
                                  }}
                                  title="Raise Dispute"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })
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

        <DeliveryDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={loadDeliveries} />

        {/* Delivery Detail Dialog */}
        <Dialog open={!!detailDelivery} onOpenChange={(o) => !o && setDetailDelivery(null)}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">DEL-{detailDelivery?.id.padStart(6, "0")}</DialogTitle>
              <DialogDescription className="text-xs">Delivery details</DialogDescription>
            </DialogHeader>
            {detailDelivery && (
              <div className="space-y-3 py-1 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-gray-500">Purchase Order</p><p className="font-medium mt-0.5">{detailDelivery.poNumber}</p></div>
                  <div><p className="text-gray-500">Vendor</p><p className="font-medium mt-0.5">{detailDelivery.vendorName || detailDelivery.vendor || "—"}</p></div>
                  <div><p className="text-gray-500">Status</p>
                    {(() => {
                      const s = detailDelivery.status?.toUpperCase();
                      const cls = s === "DELIVERED" ? "bg-emerald-100 text-emerald-700" : s === "DELAYED" ? "bg-red-100 text-red-700" : ["IN_TRANSIT","SHIPPED"].includes(s || "") ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600";
                      return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${cls}`}>{detailDelivery.status?.replace(/_/g, " ")}</span>;
                    })()}
                  </div>
                  <div><p className="text-gray-500">Carrier</p><p className="font-medium mt-0.5">{detailDelivery.carrier || "—"}</p></div>
                  <div><p className="text-gray-500">Tracking #</p><p className="font-mono font-medium mt-0.5">{detailDelivery.trackingNumber || "—"}</p></div>
                  <div><p className="text-gray-500">Quantity</p><p className="font-medium mt-0.5">{detailDelivery.quantity ?? "—"}</p></div>
                  <div><p className="text-gray-500">Origin</p><p className="font-medium mt-0.5">{detailDelivery.origin || "Supplier"}</p></div>
                  <div><p className="text-gray-500">Destination</p><p className="font-medium mt-0.5">{detailDelivery.destination || "Warehouse"}</p></div>
                  <div><p className="text-gray-500">Expected Date</p><p className="font-medium mt-0.5">{detailDelivery.eta ? new Date(detailDelivery.eta).toLocaleDateString() : "—"}</p></div>
                  <div><p className="text-gray-500">Delivery Date</p><p className="font-medium mt-0.5">{detailDelivery.deliveryDate ? new Date(detailDelivery.deliveryDate).toLocaleDateString() : "—"}</p></div>
                  <div className="col-span-2"><p className="text-gray-500">Quality inspection</p><p className="font-medium mt-0.5">{formatQualityRating(detailDelivery.qualityRating)}</p></div>
                  {detailDelivery.qualityIssueTypes && (
                    <div className="col-span-2"><p className="text-gray-500">Issues</p><p className="font-medium mt-0.5">{formatQualityIssues(detailDelivery.qualityIssueTypes)}</p></div>
                  )}
                  {detailDelivery.qualityRemarks && (
                    <div className="col-span-2"><p className="text-gray-500">Remarks (audit)</p><p className="text-gray-600 mt-0.5">{detailDelivery.qualityRemarks}</p></div>
                  )}
                </div>
                {detailDelivery.status?.toUpperCase() === "DELIVERED" && (
                  <WorkflowNextStep
                    message="Goods received — review vendor invoice and run 3-way match."
                    href={`/invoices?poId=${detailDelivery.poId}`}
                    linkLabel="Invoices"
                  />
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDetailDelivery(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 3-Way Match Dialog */}
        <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
          <DialogContent className="sm:max-w-[440px] rounded">
            <DialogHeader>
              <DialogTitle>3-Way Match Validation</DialogTitle>
              <DialogDescription>
                Select the invoice to validate against {matchDelivery?.poNumber || "this delivery"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice *</Label>
                {poInvoices.length > 0 ? (
                  <Select
                    value={matchInvoiceId}
                    onValueChange={(id) => {
                      setMatchInvoiceId(id);
                      const inv = poInvoices.find((i: any) => String(i.invoiceId || i.id) === id);
                      if (inv?.invoiceAmount != null) {
                        setMatchAmount(String(inv.invoiceAmount));
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select an invoice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {poInvoices.map((inv: any) => {
                        const id = String(inv.invoiceId || inv.id);
                        const label = `${inv.invoiceNumber || `INV-${id.padStart(6, "0")}`} — $${Number(inv.invoiceAmount || 0).toLocaleString()} (${inv.status || "PENDING"})`;
                        return <SelectItem key={id} value={id}>{label}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                    No invoices found for {matchDelivery?.poNumber || "this PO"}. Ask the vendor to submit an invoice first.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">PO Amount ($)</Label>
                  <Input
                    type="number"
                    value={matchAmount}
                    onChange={(e) => setMatchAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">PO Quantity</Label>
                  <Input
                    type="number"
                    value={matchQuantity}
                    onChange={(e) => setMatchQuantity(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setMatchDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!matchInvoiceId || !matchAmount || !matchQuantity || matchLoading}
                onClick={() =>
                  matchDelivery &&
                  handleThreeWayMatch(
                    matchDelivery.poId,
                    matchDelivery.id,
                    matchInvoiceId,
                    parseFloat(matchAmount),
                    parseInt(matchQuantity)
                  )
                }
              >
                {matchLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Validate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Raise Dispute Dialog */}
        <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
          <DialogContent className="sm:max-w-[440px] rounded">
            <DialogHeader>
              <DialogTitle>Raise Dispute</DialogTitle>
              <DialogDescription>
                Describe the issue with delivery for {disputeDelivery?.poNumber || "this purchase order"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Describe the delivery issue in detail..."
                  rows={4}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDisputeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!disputeDescription.trim() || disputeLoading}
                onClick={() =>
                  disputeDelivery &&
                  handleRaiseDispute(disputeDelivery.poId, disputeDelivery.id, "DELIVERY_ISSUE", disputeDescription)
                }
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
