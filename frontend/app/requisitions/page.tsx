"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { requisitionApi } from "@/lib/api";
import { ProcurementPipelineBanner } from "@/components/procurement-pipeline-banner";
import { useToast } from "@/hooks/use-toast";
import { RequisitionDialog } from "./requisition-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RequireRole } from "@/components/require-role";
import { useListDeepLink } from "@/hooks/use-list-deep-link";
import { useAuthStore } from "@/lib/auth-store";
import {
  Search, Plus, Loader2, ClipboardList, Clock, CheckCircle2, XCircle, AlertCircle, Gavel,
} from "lucide-react";

interface Requisition {
  requisitionId: string;
  requisitionNumber: string;
  department: string;
  justification: string;
  estimatedBudget: number;
  status: string;
  currentApprovalLevel: number;
  createdAt: string;
  requesterId?: number;
  items?: Array<{
    itemName: string;
    description?: string;
    quantity: number;
    unit?: string;
    estimatedUnitPrice: number;
    category?: string;
  }>;
}

function requiredRoleForLevel(level: number): string {
  if (level >= 3) return "ADMIN";
  if (level === 2) return "DIRECTOR";
  return "MANAGER";
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function formatStatus(status: string) {
  switch (status) {
    case "DRAFT": return "Draft";
    case "PENDING_APPROVAL": return "Pending Approval";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Rejected";
    default: return status?.replace(/_/g, " ") || "Unknown";
  }
}

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [filteredRequisitions, setFilteredRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [actionReq, setActionReq] = useState<Requisition | null>(null);
  const [actionComments, setActionComments] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [detailReq, setDetailReq] = useState<Requisition | null>(null);
  const [submitLoading, setSubmitLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const user = useAuthStore((state) => state.user);
  const canCreate = hasPermission("requisitions:create");
  const canApprove = hasPermission("requisitions:approve");
  const canCreateRfq = hasPermission("rfq:create");
  const userRole = user?.role || user?.roleName;

  const loadRequisitions = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      const response = await requisitionApi.getAll({
        page,
        size: PAGE_SIZE,
        search: debouncedSearch,
        sort: "date-desc",
      });
      const items = response.content ?? [];
      setRequisitions(items);
      setFilteredRequisitions(items);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load requisitions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, toast]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "REQUESTER", "SUPER_ADMIN"])) return;
    setCurrentPage(0);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "REQUESTER", "SUPER_ADMIN"])) return;
    loadRequisitions(currentPage);
  }, [currentPage, loadRequisitions]);

  useListDeepLink(requisitions, loading, (req) => { openDetail(req); }, { paramNames: ["id"] });

  function openActionDialog(req: Requisition, type: "APPROVED" | "REJECTED") {
    setActionReq(req);
    setActionType(type);
    setActionComments("");
    setActionDialogOpen(true);
  }

  async function confirmAction() {
    if (!actionReq) return;
    try {
      setActionLoading(true);
      await requisitionApi.approve(actionReq.requisitionId, {
        decision: actionType,
        comments: actionComments || (actionType === "APPROVED" ? "Approved" : "Rejected"),
      });
      toast({
        title: actionType === "APPROVED" ? "Requisition Approved" : "Requisition Rejected",
        description: `${actionReq.requisitionNumber} has been ${actionType === "APPROVED" ? "approved" : "rejected"}.`,
      });
      setActionDialogOpen(false);
      loadRequisitions(currentPage);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to process requisition",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function openDetail(req: Requisition) {
    try {
      const full = await requisitionApi.getById(req.requisitionId);
      setDetailReq(full);
    } catch {
      setDetailReq(req);
    }
  }

  async function handleSubmitDraft(req: Requisition) {
    try {
      setSubmitLoading(req.requisitionId);
      await requisitionApi.submit(req.requisitionId);
      toast({ title: "Submitted", description: `${req.requisitionNumber} sent for approval.` });
      loadRequisitions(currentPage);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit requisition",
        variant: "destructive",
      });
    } finally {
      setSubmitLoading(null);
    }
  }

  const pendingReqs = requisitions.filter((r) => r.status === "PENDING_APPROVAL");
  const draftReqs = requisitions.filter((r) => r.status === "DRAFT");
  const approvedReqs = requisitions.filter((r) => r.status === "APPROVED");
  const rejectedReqs = requisitions.filter((r) => r.status === "REJECTED");
  const totalBudget = approvedReqs.reduce((s, r) => s + (r.estimatedBudget || 0), 0);

  const statCards = [
    {
      label: "Total Requisitions",
      value: requisitions.length,
      sub: `$${totalBudget.toLocaleString()} approved`,
      icon: ClipboardList,
    },
    {
      label: "Awaiting Approval",
      value: pendingReqs.length,
      sub: pendingReqs.length > 0 ? "Needs review" : "All caught up",
      icon: Clock,
    },
    {
      label: "Approved",
      value: approvedReqs.length,
      sub: approvedReqs.length > 0 ? `$${totalBudget.toLocaleString()} total` : undefined,
      icon: CheckCircle2,
    },
    {
      label: "Rejected",
      value: rejectedReqs.length,
      sub: rejectedReqs.length > 0 ? "May need revision" : undefined,
      icon: XCircle,
    },
  ];

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "REQUESTER", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <ProcurementPipelineBanner activeStep="requisition" />
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Purchase Requisitions</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Request and approve purchases before they become orders
              </p>
            </div>
            {canCreate && (
              <Button size="sm" className="text-xs h-8 gap-1.5" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New Requisition
              </Button>
            )}
          </div>

          {/* Flat metric strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {statCards.map(({ label, value, sub, icon: Icon }) => (
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

          {/* Pending attention banner */}
          {!loading && pendingReqs.filter((r) =>
            userRole === requiredRoleForLevel(r.currentApprovalLevel) || userRole === "SUPER_ADMIN"
          ).length > 0 && canApprove && (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              {(() => {
                const actionable = pendingReqs.filter((r) =>
                  userRole === requiredRoleForLevel(r.currentApprovalLevel) || userRole === "SUPER_ADMIN"
                );
                return (
                  <p className="text-xs text-amber-800">
                    <span className="font-semibold">{actionable.length} requisition{actionable.length > 1 ? "s" : ""}</span> waiting for your approval — totalling{" "}
                    <span className="font-semibold">${actionable.reduce((s, r) => s + (r.estimatedBudget || 0), 0).toLocaleString()}</span>.
                  </p>
                );
              })()}
            </div>
          )}

          {/* Table container */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">All Requisitions</p>
                <p className="text-xs text-gray-400">{totalElements} total</p>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search by number, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-60 h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Requisition #</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Department</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Justification</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Budget</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</TableHead>
                    <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Submitted</TableHead>
                    {(canApprove || canCreateRfq) && <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={(canApprove || canCreateRfq) ? 7 : 6} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ) : filteredRequisitions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(canApprove || canCreateRfq) ? 7 : 6} className="text-center py-12">
                        <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-600">
                          {searchQuery ? "No requisitions match your search" : "No requisitions yet"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {searchQuery
                            ? "Try a different keyword"
                            : canCreate
                            ? "Submit a requisition to request a purchase"
                            : "Requisitions submitted by your team will appear here"}
                        </p>
                        {!searchQuery && canCreate && (
                          <Button size="sm" className="mt-3 text-xs h-8 gap-1.5" onClick={() => setDialogOpen(true)}>
                            <Plus className="h-3.5 w-3.5" /> New Requisition
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequisitions.map((req) => (
                      <TableRow key={req.requisitionId} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetail(req)}>
                        <TableCell className="text-xs font-medium font-mono">{req.requisitionNumber}</TableCell>
                        <TableCell className="text-xs text-gray-700">{req.department || "—"}</TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-[220px]">
                          <span className="truncate block" title={req.justification}>
                            {req.justification || <span className="text-gray-400 italic">No justification provided</span>}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-gray-900">
                          ${req.estimatedBudget?.toLocaleString() || "0"}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const cls = req.status === "APPROVED" ? "bg-emerald-100 text-emerald-700"
                              : req.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700"
                              : req.status === "DRAFT" ? "bg-blue-100 text-blue-700"
                              : req.status === "REJECTED" ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600";
                            return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{formatStatus(req.status)}</span>;
                          })()}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          <span title={new Date(req.createdAt).toLocaleString()}>{daysAgo(req.createdAt)}</span>
                        </TableCell>
                        {(canApprove || canCreateRfq) && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {req.status === "PENDING_APPROVAL" &&
                            canApprove &&
                            (userRole === requiredRoleForLevel(req.currentApprovalLevel) || userRole === "SUPER_ADMIN") ? (
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => openActionDialog(req, "REJECTED")}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => openActionDialog(req, "APPROVED")}
                                >
                                  Approve
                                </Button>
                              </div>
                            ) : req.status === "DRAFT" && canCreate ? (
                              <Button
                                size="sm"
                                className="h-7 text-[11px]"
                                disabled={submitLoading === req.requisitionId}
                                onClick={() => handleSubmitDraft(req)}
                              >
                                {submitLoading === req.requisitionId && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                Submit for Approval
                              </Button>
                            ) : req.status === "APPROVED" && canCreateRfq ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] border-blue-200 text-blue-600 hover:bg-blue-50"
                                asChild
                              >
                                <Link href={`/rfq?requisitionId=${req.requisitionId}`}>
                                  <Gavel className="h-3 w-3 mr-1" />Create RFQ
                                </Link>
                              </Button>
                            ) : (
                              <span className="text-[10px] text-gray-400">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
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
        </div>

        <RequisitionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => loadRequisitions(currentPage)}
        />

        {/* Requisition Detail Dialog */}
        <Dialog open={!!detailReq} onOpenChange={(o) => !o && setDetailReq(null)}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">{detailReq?.requisitionNumber}</DialogTitle>
              <DialogDescription className="text-xs">Purchase Requisition Details</DialogDescription>
            </DialogHeader>
            {detailReq && (
              <div className="space-y-3 py-1 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-gray-500">Department</p><p className="font-medium mt-0.5">{detailReq.department || "—"}</p></div>
                  <div><p className="text-gray-500">Status</p>
                    {(() => {
                      const cls = detailReq.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : detailReq.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700" : detailReq.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";
                      return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${cls}`}>{formatStatus(detailReq.status)}</span>;
                    })()}
                  </div>
                  <div><p className="text-gray-500">Estimated Budget</p><p className="font-semibold text-base mt-0.5">${detailReq.estimatedBudget?.toLocaleString()}</p></div>
                  <div><p className="text-gray-500">Submitted</p><p className="font-medium mt-0.5">{daysAgo(detailReq.createdAt)}</p></div>
                  <div><p className="text-gray-500">Date</p><p className="font-medium mt-0.5">{new Date(detailReq.createdAt).toLocaleDateString()}</p></div>
                  <div><p className="text-gray-500">Approval Level</p><p className="font-medium mt-0.5">{detailReq.currentApprovalLevel}</p></div>
                </div>
                {detailReq.justification && (
                  <div><p className="text-gray-500 mb-0.5">Justification</p><p className="text-gray-700">{detailReq.justification}</p></div>
                )}
                {detailReq.items && detailReq.items.length > 0 && (
                  <div>
                    <p className="text-gray-500 mb-1">Line Items</p>
                    <div className="border rounded divide-y">
                      {detailReq.items.map((item, idx) => (
                        <div key={idx} className="px-2 py-1.5 flex justify-between gap-2">
                          <span>{item.itemName} × {item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>
                          <span className="font-medium">${((item.estimatedUnitPrice || 0) * (item.quantity || 0)).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              {detailReq?.status === "APPROVED" && canCreateRfq && (
                <Button size="sm" className="text-xs" asChild>
                  <Link href={`/rfq?requisitionId=${detailReq.requisitionId}`} onClick={() => setDetailReq(null)}>
                    Create RFQ
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setDetailReq(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve / Reject confirmation dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent className="sm:max-w-[440px] rounded">
            <DialogHeader>
              <DialogTitle className={actionType === "APPROVED" ? "text-emerald-700" : "text-red-700"}>
                {actionType === "APPROVED" ? "Approve Requisition" : "Reject Requisition"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {actionType === "APPROVED"
                  ? `You are approving ${actionReq?.requisitionNumber} for $${actionReq?.estimatedBudget?.toLocaleString()}. Procurement can then issue an RFQ and award a vendor.`
                  : `You are rejecting ${actionReq?.requisitionNumber}. The requester will be notified.`}
              </DialogDescription>
            </DialogHeader>

            {/* Requisition summary */}
            {actionReq && (
              <div className="rounded-md bg-gray-50 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Department</span>
                  <span className="font-medium">{actionReq.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Budget requested</span>
                  <span className="font-semibold">${actionReq.estimatedBudget?.toLocaleString()}</span>
                </div>
                {actionReq.justification && (
                  <div className="pt-1 border-t border-gray-200">
                    <p className="text-gray-500 mb-0.5">Justification</p>
                    <p className="text-gray-700">{actionReq.justification}</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {actionType === "APPROVED" ? "Approval notes" : "Reason for rejection"}{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                value={actionComments}
                onChange={(e) => setActionComments(e.target.value)}
                placeholder={
                  actionType === "APPROVED"
                    ? "Any notes for the procurement team..."
                    : "Explain why this is being rejected..."
                }
                rows={3}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setActionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className={`text-xs ${actionType === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                disabled={actionLoading}
                onClick={confirmAction}
              >
                {actionLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {actionType === "APPROVED" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}
