"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { requisitionApi } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { RequisitionDialog } from "./requisition-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { Search, Plus, Loader2 } from "lucide-react";

interface Requisition {
  requisitionId: string;
  requisitionNumber: string;
  department: string;
  justification: string;
  estimatedBudget: number;
  status: string;
  currentApprovalLevel: number;
  createdAt: string;
}

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [filteredRequisitions, setFilteredRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [actionReq, setActionReq] = useState<Requisition | null>(null);
  const [actionComments, setActionComments] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  // OFFICER and ADMIN can create requisitions; MANAGER/ADMIN can approve
  const canCreate = hasPermission("po:create"); // reuse po:create as proxy for requisition creation
  const canApprove = hasPermission("po:approve");

  async function loadRequisitions(page = 0) {
    try {
      setLoading(true);
      const response = await requisitionApi.getAll(page, PAGE_SIZE);
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
  }

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER"])) return;
    loadRequisitions(currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRequisitions(requisitions);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredRequisitions(requisitions.filter(r =>
        r.requisitionNumber?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.justification?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
      ));
    }
  }, [searchQuery, requisitions]);

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
        description: `${actionReq.requisitionNumber} has been ${actionType.toLowerCase()}.`,
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "APPROVED": return "success";
      case "PENDING_APPROVAL": return "warning";
      case "REJECTED": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Purchase Requisitions</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage requisitions</p>
          </div>
          {canCreate && (
          <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />New Requisition
          </Button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: requisitions.length, color: "bg-gray-50 text-gray-700" },
            { label: "Pending", value: requisitions.filter(r => r.status === "PENDING_APPROVAL").length, color: "bg-amber-50 text-amber-700" },
            { label: "Approved", value: requisitions.filter(r => r.status === "APPROVED").length, color: "bg-emerald-50 text-emerald-700" },
            { label: "Rejected", value: requisitions.filter(r => r.status === "REJECTED").length, color: "bg-red-50 text-red-700" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className={`p-3 ${color.split(" ")[0]}`}>
                <p className={`text-xs ${color.split(" ")[1]}`}>{label}</p>
                <p className={`text-xl font-semibold mt-1 ${color.split(" ")[1]}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-700">Requisitions</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="search"
                placeholder="Search requisitions..."
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
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Req. Number</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Department</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Budget</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Level</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Created</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : filteredRequisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-xs">
                      {searchQuery ? "No requisitions match your search." : "No requisitions found."}
                    </TableCell>
                  </TableRow>
                ) : filteredRequisitions.map((req) => (
                  <TableRow key={req.requisitionId}>
                    <TableCell className="text-xs font-medium">{req.requisitionNumber}</TableCell>
                    <TableCell className="text-xs">{req.department}</TableCell>
                    <TableCell className="text-xs">${req.estimatedBudget?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(req.status)} className="text-[10px]">
                        {req.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">Level {req.currentApprovalLevel}</TableCell>
                    <TableCell className="text-xs">{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {canApprove && req.status === "PENDING_APPROVAL" && (
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-xs" onClick={() => openActionDialog(req, "APPROVED")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => openActionDialog(req, "REJECTED")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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

      <RequisitionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => loadRequisitions(currentPage)} />

      {/* Approve / Reject Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{actionType === "APPROVED" ? "Approve" : "Reject"} Requisition</DialogTitle>
            <DialogDescription>
              {actionType === "APPROVED"
                ? `Approve requisition ${actionReq?.requisitionNumber} for $${actionReq?.estimatedBudget?.toLocaleString()}?`
                : `Reject requisition ${actionReq?.requisitionNumber}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Comments (optional)</Label>
            <Textarea
              value={actionComments}
              onChange={(e) => setActionComments(e.target.value)}
              placeholder={actionType === "APPROVED" ? "Approval notes..." : "Reason for rejection..."}
              rows={3}
              className="text-xs resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              variant={actionType === "APPROVED" ? "default" : "destructive"}
              disabled={actionLoading}
              onClick={confirmAction}
            >
              {actionLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {actionType === "APPROVED" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    </RequireRole>
  );
}
