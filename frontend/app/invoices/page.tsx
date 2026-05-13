"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { invoiceApi, poApi, threeWayMatchApi, deliveryApi, getVendorNameMap } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { RequireRole } from "@/components/require-role";
import {
  FileText, Plus, Search, Scale, AlertTriangle, CheckCircle,
  Loader2, XCircle, MessageSquare,
} from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber?: string;
  poId: string;
  poNumber?: string;
  vendorId?: string;
  vendorName?: string;
  invoiceAmount: number;
  status: string;
  discrepancyFlag?: boolean;
  createdAt?: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Submit invoice dialog (VENDOR)
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitPoId, setSubmitPoId] = useState("");
  const [submitAmount, setSubmitAmount] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [availablePOs, setAvailablePOs] = useState<any[]>([]);

  // 3-way match dialog (OFFICER)
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchInvoice, setMatchInvoice] = useState<Invoice | null>(null);
  const [matchDeliveryId, setMatchDeliveryId] = useState("");
  const [matchPoAmount, setMatchPoAmount] = useState("");
  const [matchPoQuantity, setMatchPoQuantity] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<{ status: string; mismatchReason?: string } | null>(null);
  // Deliveries for the selected invoice's PO
  const [poDeliveries, setPoDeliveries] = useState<any[]>([]);

  // Dispute dialog
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeInvoice, setDisputeInvoice] = useState<Invoice | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);

  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isVendor = user?.role === "VENDOR" || user?.roleName === "VENDOR";
  const canValidate = hasPermission("three-way-match:validate");
  const canDispute = hasPermission("invoices:dispute");
  const canSubmitInvoice = hasPermission("invoices:create");

  async function loadInvoices() {
    try {
      setLoading(true);
      let data: any[] = [];

      if (isVendor) {
        // VENDOR -- fetch invoices per PO instead of GET /invoices
        const pos = await poApi.getAllList().catch(() => []);
        const results = await Promise.allSettled(
          (pos as any[]).slice(0, 50).map((po: any) =>
            invoiceApi.getByPO(po.id || po.poId).catch(() => [])
          )
        );
        results.forEach((r) => {
          if (r.status === "fulfilled") data.push(...(r.value as any[]));
        });
      } else {
        const [data, vendorMap] = await Promise.all([
          invoiceApi.getAll().catch(() => []),
          getVendorNameMap(),
        ]);
        const normalised = (data as any[]).map((inv: any) => {
          const vendorId = String(inv.vendorId || "");
          const vendorName = inv.vendorName || vendorMap?.get(vendorId) || (vendorId ? `Vendor #${vendorId}` : "Unknown Vendor");
          return {
            id: String(inv.id || inv.invoiceId),
            invoiceNumber: inv.invoiceNumber || `INV-${String(inv.id || inv.invoiceId).padStart(6, "0")}`,
            poId: String(inv.poId || inv.purchaseOrderId || ""),
            poNumber: inv.poNumber || (inv.poId ? `PO-${String(inv.poId).padStart(6, "0")}` : "--"),
            vendorId,
            vendorName,
            invoiceAmount: Number(inv.invoiceAmount || inv.amount || 0),
            status: inv.status || "PENDING",
            discrepancyFlag: inv.discrepancyFlag ?? false,
            createdAt: inv.createdAt,
          };
        });
        setInvoices(normalised);
        setFilteredInvoices(normalised);
      }
    } catch {
      setInvoices([]);
      setFilteredInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPOs() {
    try {
      const pos = await poApi.getAllList().catch(() => []);
      // Only approved POs can have invoices submitted
      setAvailablePOs(
        (pos as any[])
          .filter((po: any) =>
            po.status?.toLowerCase().includes("approved") ||
            po.status?.toLowerCase() === "delivered"
          )
          .map((po: any) => ({
            id: String(po.id || po.poId),
            poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
            totalAmount: Number(po.totalAmount) || 0,
            vendorId: String(po.vendorId || ""),
          }))
      );
    } catch {
      setAvailablePOs([]);
    }
  }

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"])) return;
    loadInvoices();
    loadPOs();
  }, [user]);

  useEffect(() => {
    let filtered = invoices;
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((inv) => inv.status?.toUpperCase() === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.poNumber?.toLowerCase().includes(q) ||
          inv.vendorName?.toLowerCase().includes(q) ||
          inv.status?.toLowerCase().includes(q)
      );
    }
    setFilteredInvoices(filtered);
  }, [searchQuery, statusFilter, invoices]);

  async function handleSubmitInvoice() {
    if (!submitPoId || !submitAmount) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    try {
      setSubmitLoading(true);
      const po = availablePOs.find((p) => p.id === submitPoId);
      await invoiceApi.create({
        poId: parseInt(submitPoId),
        invoiceAmount: parseFloat(submitAmount),
        vendorId: po?.vendorId ? parseInt(po.vendorId) : parseInt(user?.id || user?.userId || "0"),
      });
      toast({ title: "Invoice Submitted", description: "Your invoice has been submitted for review." });
      setSubmitOpen(false);
      setSubmitPoId("");
      setSubmitAmount("");
      loadInvoices();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit invoice",
        variant: "destructive",
      });
    } finally {
      setSubmitLoading(false);
    }
  }

  async function openMatchDialog(invoice: Invoice) {
    setMatchInvoice(invoice);
    setMatchDeliveryId("");
    setMatchPoAmount(String(invoice.invoiceAmount));
    setMatchPoQuantity("");
    setMatchResult(null);
    setPoDeliveries([]);
    setMatchOpen(true);
    // Pre-load deliveries for this PO so user picks by name, not raw ID
    try {
      const delivs = await deliveryApi.getByPO(invoice.poId).catch(() => []);
      setPoDeliveries(delivs as any[]);
    } catch { setPoDeliveries([]); }
  }

  async function handleThreeWayMatch() {
    if (!matchInvoice || !matchDeliveryId || !matchPoAmount || !matchPoQuantity) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    try {
      setMatchLoading(true);
      const result = await threeWayMatchApi.validate(
        parseInt(matchInvoice.poId),
        parseInt(matchDeliveryId),
        parseInt(matchInvoice.id),
        parseFloat(matchPoAmount),
        parseInt(matchPoQuantity)
      );
      setMatchResult(result);
      if (result.status === "MATCHED") {
        toast({ title: "3-Way Match Passed", description: "All values match. Invoice approved." });
        loadInvoices();
      } else {
        toast({
          title: "Mismatch Detected",
          description: result.mismatchReason || "Values do not match.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Validation failed",
        variant: "destructive",
      });
    } finally {
      setMatchLoading(false);
    }
  }

  async function handleDispute() {
    if (!disputeInvoice || !disputeReason.trim()) {
      toast({ title: "Error", description: "Please provide a reason", variant: "destructive" });
      return;
    }
    try {
      setDisputeLoading(true);
      await invoiceApi.dispute(disputeInvoice.id, disputeReason);
      toast({ title: "Dispute Raised", description: "The invoice has been flagged for dispute." });
      setDisputeOpen(false);
      setDisputeReason("");
      loadInvoices();
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

  const statusVariant = (status: string, flag?: boolean) => {
    if (flag) return "destructive";
    switch (status?.toUpperCase()) {
      case "APPROVED": return "success";
      case "PENDING": return "warning";
      case "DISPUTED": return "destructive";
      case "VALIDATED": return "success";
      default: return "secondary";
    }
  };

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status?.toUpperCase() === "PENDING").length,
    approved: invoices.filter((i) => ["APPROVED", "VALIDATED"].includes(i.status?.toUpperCase())).length,
    disputed: invoices.filter((i) => i.status?.toUpperCase() === "DISPUTED" || i.discrepancyFlag).length,
  };

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {isVendor ? "Submit and track your invoices" : "Review, validate, and manage invoices"}
              </p>
            </div>
            {canSubmitInvoice && (
              <Button size="sm" className="text-xs h-8" onClick={() => setSubmitOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Submit Invoice
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm bg-gray-50">
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-semibold text-gray-700 mt-1">{loading ? "â€â€" : stats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-amber-50">
              <CardContent className="p-3">
                <p className="text-xs text-amber-600">Pending Review</p>
                <p className="text-xl font-semibold text-amber-700 mt-1">{loading ? "â€â€" : stats.pending}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-emerald-50">
              <CardContent className="p-3">
                <p className="text-xs text-emerald-600">Approved</p>
                <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "â€â€" : stats.approved}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-red-50">
              <CardContent className="p-3">
                <p className="text-xs text-red-600">Disputed</p>
                <p className="text-xl font-semibold text-red-700 mt-1">{loading ? "â€â€" : stats.disputed}</p>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-700">Invoice List</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    type="search"
                    placeholder="Search invoices..."
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
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="VALIDATED">Validated</SelectItem>
                    <SelectItem value="DISPUTED">Disputed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Invoice #</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">PO Reference</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Vendor</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Amount</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Date</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-gray-500 text-xs">
                          {searchQuery ? "No invoices match your search." : "No invoices found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <TableRow key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <TableCell className="text-xs font-medium py-2.5">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-gray-400" />
                              {inv.invoiceNumber}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs py-2.5 text-gray-600">{inv.poNumber}</TableCell>
                          <TableCell className="text-xs py-2.5 text-gray-600">{inv.vendorName}</TableCell>
                          <TableCell className="text-xs font-medium py-2.5">
                            ${inv.invoiceAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Badge variant={statusVariant(inv.status, inv.discrepancyFlag)} className="text-[10px]">
                                {inv.discrepancyFlag ? "DISCREPANCY" : inv.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 py-2.5">
                            {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "â€â€"}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex gap-1.5">
                              {canValidate && inv.status?.toUpperCase() === "PENDING" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => openMatchDialog(inv)}
                                  title="Run 3-Way Match"
                                >
                                  <Scale className="h-3 w-3 mr-1" />
                                  Validate
                                </Button>
                              )}
                              {canDispute && (inv.discrepancyFlag || inv.status?.toUpperCase() === "DISPUTED") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => { setDisputeInvoice(inv); setDisputeOpen(true); }}
                                  title="Raise Dispute"
                                >
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Dispute
                                </Button>
                              )}
                              {inv.status?.toUpperCase() === "APPROVED" && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                                  <CheckCircle className="h-3 w-3" /> Cleared
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ââ€€ââ€€ Submit Invoice Dialog (Vendor) ââ€€ââ€€ */}
        <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Submit Invoice</DialogTitle>
              <DialogDescription>
                Submit an invoice against an approved purchase order.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Purchase Order *</Label>
                <Select value={submitPoId} onValueChange={setSubmitPoId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select a PO..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePOs.length === 0 ? (
                      <SelectItem value="none" disabled>No approved POs available</SelectItem>
                    ) : (
                      availablePOs.map((po) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.poNumber} â€â€ ${po.totalAmount.toLocaleString()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Amount ($) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={submitAmount}
                  onChange={(e) => setSubmitAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs"
                />
                {submitPoId && availablePOs.find((p) => p.id === submitPoId) && (
                  <p className="text-[10px] text-gray-500">
                    PO amount: ${availablePOs.find((p) => p.id === submitPoId)?.totalAmount.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSubmitOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={submitLoading || !submitPoId || !submitAmount} onClick={handleSubmitInvoice}>
                {submitLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Submit Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ââ€€ââ€€ 3-Way Match Validation Dialog (Officer) ââ€€ââ€€ */}
        <Dialog open={matchOpen} onOpenChange={(o) => { setMatchOpen(o); if (!o) setMatchResult(null); }}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>3-Way Match Validation</DialogTitle>
              <DialogDescription>
                Validate invoice {matchInvoice?.invoiceNumber} against PO {matchInvoice?.poNumber} and delivery receipt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-md bg-gray-50 p-3 text-xs space-y-1">
                <p><span className="text-gray-500">Invoice:</span> <span className="font-medium">{matchInvoice?.invoiceNumber}</span></p>
                <p><span className="text-gray-500">Invoice Amount:</span> <span className="font-medium">${matchInvoice?.invoiceAmount.toLocaleString()}</span></p>
                <p><span className="text-gray-500">PO Reference:</span> <span className="font-medium">{matchInvoice?.poNumber}</span></p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Delivery Receipt *</Label>
                {poDeliveries.length > 0 ? (
                  <Select value={matchDeliveryId} onValueChange={setMatchDeliveryId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select a delivery receipt..." />
                    </SelectTrigger>
                    <SelectContent>
                      {poDeliveries.map((d: any) => {
                        const id = String(d.deliveryId || d.id);
                        const qty = d.quantityDelivered ?? d.quantity ?? "?";
                        const status = d.deliveryStatus || d.status || "";
                        return (
                          <SelectItem key={id} value={id}>
                            DEL-{id.padStart(6, "0")} — {qty} units ({status})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={matchDeliveryId}
                    onChange={(e) => setMatchDeliveryId(e.target.value)}
                    placeholder="Enter delivery ID"
                    className="h-8 text-xs"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">PO Amount ($) *</Label>
                  <Input
                    type="number"
                    value={matchPoAmount}
                    onChange={(e) => setMatchPoAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">PO Quantity *</Label>
                  <Input
                    type="number"
                    value={matchPoQuantity}
                    onChange={(e) => setMatchPoQuantity(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Match result */}
              {matchResult && (
                <div className={`rounded-md p-3 text-xs flex items-start gap-2 ${
                  matchResult.status === "MATCHED"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {matchResult.status === "MATCHED"
                    ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-medium">{matchResult.status === "MATCHED" ? "Match Successful" : "Mismatch Detected"}</p>
                    {matchResult.mismatchReason && <p className="mt-0.5">{matchResult.mismatchReason}</p>}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setMatchOpen(false); setMatchResult(null); }}>
                {matchResult ? "Close" : "Cancel"}
              </Button>
              {!matchResult && (
                <Button
                  size="sm"
                  disabled={matchLoading || !matchDeliveryId || !matchPoAmount || !matchPoQuantity}
                  onClick={handleThreeWayMatch}
                >
                  {matchLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  <Scale className="mr-1.5 h-3.5 w-3.5" />
                  Run Validation
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ââ€€ââ€€ Dispute Dialog ââ€€ââ€€ */}
        <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Raise Invoice Dispute</DialogTitle>
              <DialogDescription>
                Flag invoice {disputeInvoice?.invoiceNumber} for dispute resolution.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="text-xs">Reason for Dispute *</Label>
              <Textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe the discrepancy or issue..."
                rows={4}
                className="text-xs resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDisputeOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={disputeLoading || !disputeReason.trim()}
                onClick={handleDispute}
              >
                {disputeLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Raise Dispute
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}
