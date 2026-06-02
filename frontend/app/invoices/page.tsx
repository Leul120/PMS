"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { invoiceApi, disputeApi, poApi, threeWayMatchApi, deliveryApi, getCompanyNameMap, invoiceStatusQuery } from "@/lib/api";
import { displayVendorName } from "@/lib/display";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RequireRole } from "@/components/require-role";
import { useListDeepLink } from "@/hooks/use-list-deep-link";
import { ProcurementPipelineBanner } from "@/components/procurement-pipeline-banner";
import { WorkflowNextStep } from "@/components/workflow-next-step";

import {
  FileText, Plus, Search, Scale, AlertTriangle, CheckCircle,
  Loader2, XCircle, MessageSquare, Receipt, Clock, Filter, ShieldCheck,
} from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber?: string;
  poId: string;
  poNumber?: string;
  vendorId?: string;
  companyName?: string;
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;

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
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  // Resolve dispute dialog
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveInvoice, setResolveInvoice] = useState<Invoice | null>(null);
  const [resolveResolution, setResolveResolution] = useState("");
  const [resolveOutcome, setResolveOutcome] = useState<"APPROVE_INVOICE" | "REJECT_INVOICE">("APPROVE_INVOICE");
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveDisputeId, setResolveDisputeId] = useState<string | null>(null);
  const [resolveDisputeDesc, setResolveDisputeDesc] = useState<string>("");

  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isVendor = hasRole(["VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE"]);
  const canValidate = hasPermission("three-way-match:validate");
  const canDispute = hasPermission("invoices:dispute");
  const canResolveDispute = hasPermission("disputes:resolve");
  const canMarkPaid = hasPermission("invoices:mark-paid");
  const canSubmitInvoice = hasPermission("invoices:create");

  const loadInvoices = useCallback(async (page = 0) => {
    try {
      setLoading(true);

      if (isVendor) {
        const vendorId = user?.id || user?.userId;
        if (!vendorId) { setInvoices([]); setFilteredInvoices([]); return; }

        const raw = await invoiceApi.getByVendor(vendorId).catch(() => []);
        const vendorMap = await getCompanyNameMap();
        let normalised = (raw as any[]).map((inv: any) => ({
          id: String(inv.id || inv.invoiceId),
          invoiceNumber: inv.invoiceNumber || `INV-${String(inv.id || inv.invoiceId).padStart(6, "0")}`,
          poId: String(inv.poId || inv.purchaseOrderId || ""),
          poNumber: inv.poNumber || (inv.poId ? `PO-${String(inv.poId).padStart(6, "0")}` : "--"),
          vendorId: String(inv.vendorId || vendorId),
          companyName: inv.companyName || vendorMap?.get(String(inv.vendorId || vendorId)) || "My Company",
          invoiceAmount: Number(inv.invoiceAmount || inv.amount || 0),
          status: inv.status || "PENDING",
          discrepancyFlag: inv.discrepancyFlag ?? false,
          createdAt: inv.createdAt || inv.invoiceDate,
        }));
        if (statusFilter !== "ALL") {
          normalised = normalised.filter((inv) => inv.status?.toUpperCase() === statusFilter);
        }
        if (debouncedSearch.trim()) {
          const q = debouncedSearch.toLowerCase();
          normalised = normalised.filter(
            (inv) =>
              inv.invoiceNumber?.toLowerCase().includes(q) ||
              inv.poNumber?.toLowerCase().includes(q) ||
              inv.status?.toLowerCase().includes(q)
          );
        }
        setInvoices(normalised);
        setFilteredInvoices(normalised);
        setTotalPages(1);
        setTotalElements(normalised.length);
      } else {
        const [response, vendorMap] = await Promise.all([
          invoiceApi.getAll({
            page,
            size: PAGE_SIZE,
            search: debouncedSearch,
            ...invoiceStatusQuery(statusFilter),
            sort: "id-desc",
          }),
          getCompanyNameMap(),
        ]);
        const normalised = (response.content ?? []).map((inv: any) => {
          const vendorId = String(inv.vendorId || "");
          const companyName = displayVendorName(vendorId, { name: inv.companyName, map: vendorMap });
          return {
            id: String(inv.id || inv.invoiceId),
            invoiceNumber: inv.invoiceNumber || `INV-${String(inv.id || inv.invoiceId).padStart(6, "0")}`,
            poId: String(inv.poId || inv.purchaseOrderId || ""),
            poNumber: inv.poNumber || (inv.poId ? `PO-${String(inv.poId).padStart(6, "0")}` : "--"),
            vendorId,
            companyName,
            invoiceAmount: Number(inv.invoiceAmount || inv.amount || 0),
            status: inv.status || "PENDING",
            discrepancyFlag: inv.discrepancyFlag ?? false,
            createdAt: inv.createdAt || inv.invoiceDate,
          };
        });
        setInvoices(normalised);
        setFilteredInvoices(normalised);
        setTotalPages(response.totalPages ?? 0);
        setTotalElements(response.totalElements ?? 0);
      }
    } catch {
      setInvoices([]);
      setFilteredInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, isVendor, user]);

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
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"])) return;
    if (!isVendor) setCurrentPage(0);
  }, [debouncedSearch, statusFilter, isVendor]);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"])) return;
    loadInvoices(currentPage);
    loadPOs();
  }, [user, currentPage, loadInvoices]);

  useListDeepLink(invoices, loading, (inv) => setDetailInvoice(inv), {
    paramNames: ["id", "poId", "disputeId"],
  });

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
      loadInvoices(currentPage);
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
    try {
      const [delivs, po] = await Promise.all([
        deliveryApi.getByPO(invoice.poId).catch(() => []),
        poApi.getById(invoice.poId).catch(() => null),
      ]);
      const deliveries = delivs as any[];
      setPoDeliveries(deliveries);
      if (po?.totalAmount != null) {
        setMatchPoAmount(String(po.totalAmount));
      }
      const qtyFromPo = po?.expectedQuantity ?? po?.quantity;
      if (qtyFromPo != null) {
        setMatchPoQuantity(String(qtyFromPo));
      } else if (deliveries.length === 1) {
        const d = deliveries[0];
        setMatchDeliveryId(String(d.deliveryId || d.id));
        const qty = d.quantityDelivered ?? d.quantity;
        if (qty != null) setMatchPoQuantity(String(qty));
      }
    } catch {
      setPoDeliveries([]);
    }
  }

  function handleMatchDeliverySelect(deliveryId: string) {
    setMatchDeliveryId(deliveryId);
    const delivery = poDeliveries.find((d: any) => String(d.deliveryId || d.id) === deliveryId);
    const qty = delivery?.quantityDelivered ?? delivery?.quantity;
    if (qty != null) setMatchPoQuantity(String(qty));
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
      loadInvoices(currentPage);
      if (result.status === "MATCHED") {
        toast({ title: "3-Way Match Passed", description: "All values match. Invoice approved." });
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
      loadInvoices(currentPage);
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

  async function openResolveDialog(invoice: Invoice) {
    setResolveInvoice(invoice);
    setResolveResolution("");
    setResolveDisputeId(null);
    setResolveDisputeDesc("");
    setResolveOpen(true);
    try {
      const all = await disputeApi.getAll().catch(() => []);
      const match = (all as any[]).find(
        (d: any) =>
          String(d.invoiceId) === String(invoice.id) &&
          d.status?.toUpperCase() !== "RESOLVED"
      );
      if (match) {
        setResolveDisputeId(String(match.disputeId || match.id));
        setResolveDisputeDesc(match.description || "");
      }
    } catch { /* dispute record not critical to open dialog */ }
  }

  async function handleResolveDispute() {
    if (!resolveInvoice || !resolveResolution.trim()) {
      toast({ title: "Error", description: "Please provide a resolution", variant: "destructive" });
      return;
    }
    if (!resolveDisputeId) {
      toast({ title: "Error", description: "Dispute record not found for this invoice", variant: "destructive" });
      return;
    }
    try {
      setResolveLoading(true);
      await disputeApi.resolve(resolveDisputeId, { resolution: resolveResolution, outcome: resolveOutcome });
      toast({ title: "Dispute Resolved", description: "The dispute has been marked as resolved." });
      setResolveOpen(false);
      setResolveResolution("");
      loadInvoices(currentPage);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to resolve dispute",
        variant: "destructive",
      });
    } finally {
      setResolveLoading(false);
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    try {
      await invoiceApi.markPaid(invoice.id);
      toast({ title: "Payment Recorded", description: `${invoice.invoiceNumber} marked as paid.` });
      loadInvoices(currentPage);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to mark invoice as paid",
        variant: "destructive",
      });
    }
  }

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status?.toUpperCase() === "PENDING").length,
    approved: invoices.filter((i) => ["APPROVED", "VALIDATED"].includes(i.status?.toUpperCase())).length,
    paid: invoices.filter((i) => i.status?.toUpperCase() === "PAID").length,
    disputed: invoices.filter((i) => i.status?.toUpperCase() === "DISPUTED" || i.discrepancyFlag).length,
  };

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <ProcurementPipelineBanner activeStep="invoice" />
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
          {(() => {
            const totalValue = invoices.reduce((s,i) => s + i.invoiceAmount, 0);
            const pendingValue = invoices.filter(i => i.status?.toUpperCase() === "PENDING").reduce((s,i) => s + i.invoiceAmount, 0);
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
                {[
                  { label: "Total Invoices", value: stats.total, sub: `$${totalValue.toLocaleString()} total`, icon: Receipt },
                  { label: "Awaiting Review", value: stats.pending, sub: pendingValue > 0 ? `$${pendingValue.toLocaleString()} pending` : "None pending", icon: Clock },
                  { label: "Approved", value: stats.approved, sub: "Cleared for payment", icon: CheckCircle },
                  { label: "Disputed", value: stats.disputed, sub: stats.disputed > 0 ? "Needs resolution" : "No disputes", icon: AlertTriangle },
                ].map(({ label, value, sub, icon: Icon }) => (
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
            );
          })()}

          {/* Table */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Invoice List</p>
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
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="VALIDATED">Validated</SelectItem>
                    <SelectItem value="DISPUTED">Disputed</SelectItem>
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
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Invoice #</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">PO Reference</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Date</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
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
                        <TableRow key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => setDetailInvoice(inv)}>
                          <TableCell className="text-xs font-medium py-2.5">
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-gray-400" />
                              {inv.invoiceNumber}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs py-2.5 text-gray-600">{inv.poNumber}</TableCell>
                          <TableCell className="text-xs py-2.5 text-gray-600">{inv.companyName}</TableCell>
                          <TableCell className="text-xs font-medium py-2.5">
                            ${inv.invoiceAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const label = inv.discrepancyFlag ? "DISCREPANCY" : inv.status;
                                const cls = inv.discrepancyFlag ? "bg-red-100 text-red-700"
                                  : inv.status?.toUpperCase() === "APPROVED" || inv.status?.toUpperCase() === "VALIDATED" ? "bg-emerald-100 text-emerald-700"
                                  : inv.status?.toUpperCase() === "PENDING" ? "bg-amber-100 text-amber-700"
                                  : inv.status?.toUpperCase() === "DISPUTED" ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600";
                                return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{label}</span>;
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 py-2.5">
                            {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="py-2.5" onClick={(e) => e.stopPropagation()}>
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
                              {canDispute && !["APPROVED", "VALIDATED", "DISPUTED"].includes(inv.status?.toUpperCase()) && (
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
                              {canResolveDispute && inv.status?.toUpperCase() === "DISPUTED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                  onClick={() => openResolveDialog(inv)}
                                  title="Resolve Dispute"
                                >
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  Resolve
                                </Button>
                              )}
                              {canMarkPaid && inv.status?.toUpperCase() === "APPROVED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                  onClick={() => handleMarkPaid(inv)}
                                  title="Record manual payment"
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Mark Paid
                                </Button>
                              )}
                              {inv.status?.toUpperCase() === "PAID" && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-blue-600">
                                  <CheckCircle className="h-3 w-3" /> Paid
                                </span>
                              )}
                              {inv.status?.toUpperCase() === "APPROVED" && !canMarkPaid && (
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
              {!isVendor && (
                <PaginationControls
                  page={currentPage}
                  totalPages={totalPages}
                  totalElements={totalElements}
                  size={PAGE_SIZE}
                  onPageChange={(p) => setCurrentPage(p)}
                  loading={loading}
                />
              )}
            </div>
          </div>
        </div>

        {/* Invoice Detail Dialog */}
        <Dialog open={!!detailInvoice} onOpenChange={(o) => !o && setDetailInvoice(null)}>
          <DialogContent className="sm:max-w-[460px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">{detailInvoice?.invoiceNumber}</DialogTitle>
              <DialogDescription className="text-xs">Invoice details</DialogDescription>
            </DialogHeader>
            {detailInvoice && (
              <div className="space-y-3 py-1 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-gray-500">PO Reference</p><p className="font-medium mt-0.5">{detailInvoice.poNumber}</p></div>
                  <div><p className="text-gray-500">Vendor</p><p className="font-medium mt-0.5">{detailInvoice.companyName}</p></div>
                  <div><p className="text-gray-500">Amount</p><p className="font-semibold text-base mt-0.5">${detailInvoice.invoiceAmount.toLocaleString()}</p></div>
                  <div><p className="text-gray-500">Status</p>
                    {(() => {
                      const label = detailInvoice.discrepancyFlag ? "DISCREPANCY" : detailInvoice.status;
                      const cls = detailInvoice.discrepancyFlag ? "bg-red-100 text-red-700"
                        : detailInvoice.status?.toUpperCase() === "APPROVED" || detailInvoice.status?.toUpperCase() === "VALIDATED" ? "bg-emerald-100 text-emerald-700"
                        : detailInvoice.status?.toUpperCase() === "PENDING" ? "bg-amber-100 text-amber-700"
                        : detailInvoice.status?.toUpperCase() === "DISPUTED" ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600";
                      return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${cls}`}>{label}</span>;
                    })()}
                  </div>
                  <div><p className="text-gray-500">Date</p><p className="font-medium mt-0.5">{detailInvoice.createdAt ? new Date(detailInvoice.createdAt).toLocaleDateString() : "—"}</p></div>
                  {detailInvoice.discrepancyFlag && (
                    <div className="col-span-2"><span className="inline-flex items-center gap-1 text-[10px] text-red-600"><AlertTriangle className="h-3 w-3" />Discrepancy flagged on this invoice</span></div>
                  )}
                </div>
                {detailInvoice.status?.toUpperCase() === "PENDING" && canValidate && (
                  <p className="text-[11px] text-blue-800 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                    Run 3-way match against the PO and delivery receipt from the list, or use Validate on this row.
                  </p>
                )}
                {detailInvoice.status?.toUpperCase() === "APPROVED" && canMarkPaid && (
                  <WorkflowNextStep
                    message="Invoice cleared — record payment to close the cycle."
                    href="/invoices"
                    linkLabel="Mark paid in list"
                    variant="amber"
                  />
                )}
                {detailInvoice.status?.toUpperCase() === "PAID" && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                    Payment recorded — this procurement cycle is complete.
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDetailInvoice(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Submit Invoice Dialog (Vendor) */}
        <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
          <DialogContent className="sm:max-w-[440px] rounded">
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
                          {po.poNumber} — ${po.totalAmount.toLocaleString()}
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

        {/* 3-Way Match Validation Dialog (Officer) */}
        <Dialog open={matchOpen} onOpenChange={(o) => { setMatchOpen(o); if (!o) setMatchResult(null); }}>
          <DialogContent className="sm:max-w-[480px] rounded">
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
                  <Select value={matchDeliveryId} onValueChange={handleMatchDeliverySelect}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select a delivery receipt..." />
                    </SelectTrigger>
                    <SelectContent>
                      {poDeliveries.map((d: any) => {
                        const id = String(d.deliveryId || d.id);
                        const qty = d.quantityDelivered ?? d.quantity ?? "?";
                        const status = d.deliveryStatus || d.status || "";
                        const date = d.actualDate || d.deliveryDate;
                        const dateLabel = date ? new Date(date).toLocaleDateString() : "";
                        return (
                          <SelectItem key={id} value={id}>
                            DEL-{id.padStart(6, "0")} — {qty} units{dateLabel ? ` · ${dateLabel}` : ""}{status ? ` (${status})` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                    No delivery receipts found for {matchInvoice?.poNumber}. Record a delivery for this PO first.
                  </p>
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

        {/* Resolve Dispute Dialog */}
        <Dialog open={resolveOpen} onOpenChange={(o) => { setResolveOpen(o); if (!o) { setResolveResolution(""); setResolveDisputeId(null); } }}>
          <DialogContent className="sm:max-w-[440px] rounded">
            <DialogHeader>
              <DialogTitle>Resolve Invoice Dispute</DialogTitle>
              <DialogDescription>
                Provide a resolution for the dispute on {resolveInvoice?.invoiceNumber}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {resolveDisputeId === null && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Looking up dispute record…
                </div>
              )}
              {resolveDisputeId === null ? null : resolveDisputeDesc ? (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <p className="font-medium mb-0.5">Dispute reason:</p>
                  <p>{resolveDisputeDesc}</p>
                </div>
              ) : null}
              {resolveDisputeId !== null && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Outcome *</Label>
                    <Select value={resolveOutcome} onValueChange={(v) => setResolveOutcome(v as "APPROVE_INVOICE" | "REJECT_INVOICE")}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVE_INVOICE">Approve invoice for payment</SelectItem>
                        <SelectItem value="REJECT_INVOICE">Reject invoice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Label className="text-xs">Resolution notes *</Label>
                  <Textarea
                    value={resolveResolution}
                    onChange={(e) => setResolveResolution(e.target.value)}
                    placeholder="Describe how the dispute was resolved..."
                    rows={4}
                    className="text-xs resize-none"
                  />
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setResolveOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={resolveLoading || !resolveResolution.trim() || !resolveDisputeId}
                onClick={handleResolveDispute}
              >
                {resolveLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Mark Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dispute Dialog */}
        <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
          <DialogContent className="sm:max-w-[420px] rounded">
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
