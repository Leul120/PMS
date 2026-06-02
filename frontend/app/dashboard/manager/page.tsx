"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RequireRole } from "@/components/require-role";
import { rfqApi, vendorApi, poApi, requisitionApi, getVendorNameMap } from "@/lib/api";
import { displayVendorName } from "@/lib/display";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Loader2, ShoppingCart, TrendingUp, CheckCircle2, BarChart3,
  XCircle, AlertCircle, ArrowRight, Clock, DollarSign, ClipboardList,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function ManagerDashboardPage() {
  const [stats, setStats] = useState({
    pendingPOs: 0, approvedPOs: 0, totalSpend: 0, openRfqs: 0, pendingReqs: 0,
  });
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [pendingReqs, setPendingReqs] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Requisition approve/reject dialog
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [reqAction, setReqAction] = useState<{ req: any; type: "APPROVED" | "REJECTED" } | null>(null);
  const [reqComments, setReqComments] = useState("");
  const { toast } = useToast();
  const hasRole = useAuthStore((state) => state.hasRole);

  async function loadData() {
    if (!hasRole(["ADMIN", "MANAGER", "SUPER_ADMIN"])) return;
    try {
      setLoading(true);
      const [rfqs, pos, reqs, vendorMap] = await Promise.all([
        rfqApi.getAllList().catch(() => []),
        poApi.getAllList().catch(() => []),
        requisitionApi.getAllList().catch(() => []),
        getVendorNameMap(),
      ]);

      const pending = pos.filter((po: any) => po.status?.toLowerCase().includes("pending"));
      const approved = pos.filter(
        (po: any) => po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending")
      );
      const totalSpend = approved.reduce((sum: number, po: any) => sum + (Number(po.totalAmount) || 0), 0);
      const openRfqs = rfqs.filter((r: any) => r.status?.toUpperCase() === "OPEN").length;
      const pendingReqList = reqs.filter((r: any) =>
        r.status === "PENDING_APPROVAL" && (r.currentApprovalLevel === 1 || !r.currentApprovalLevel)
      );

      setStats({
        pendingPOs: pending.length,
        approvedPOs: approved.length,
        totalSpend,
        openRfqs,
        pendingReqs: pendingReqList.length,
      });

      setPendingPOs(
        pending.slice(0, 10).map((po: any) => ({
          id: String(po.id || po.poId),
          poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
          vendorName: displayVendorName(po.vendorId, { name: po.vendorName, map: vendorMap, empty: "N/A" }),
          totalAmount: Number(po.totalAmount) || 0,
          status: po.status,
          createdAt: po.createdAt || po.issueDate,
        }))
      );

      setPendingReqs(
        pendingReqList.slice(0, 10).map((r: any) => ({
          id: String(r.requisitionId || r.id),
          requisitionNumber: r.requisitionNumber || `REQ-${String(r.requisitionId || r.id).padStart(6, "0")}`,
          department: r.department || "—",
          estimatedBudget: Number(r.estimatedBudget) || 0,
          justification: r.justification || "",
          status: r.status,
          createdAt: r.createdAt,
        }))
      );
    } catch {
      // silently fail — show zeros
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [hasRole]);

  async function handleApprovePO(poId: string, poNumber: string) {
    try {
      setActionLoading(`po-${poId}`);
      await poApi.approve(poId);
      toast({ title: "Approved", description: `${poNumber} has been approved.` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to approve", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectPO(poId: string, poNumber: string) {
    try {
      setActionLoading(`po-${poId}`);
      await poApi.reject(poId);
      toast({ title: "Rejected", description: `${poNumber} has been rejected.` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reject", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  function openReqDialog(req: any, type: "APPROVED" | "REJECTED") {
    setReqAction({ req, type });
    setReqComments("");
    setReqDialogOpen(true);
  }

  async function confirmReqAction() {
    if (!reqAction) return;
    const { req, type } = reqAction;
    try {
      setActionLoading(`req-${req.id}`);
      await requisitionApi.approve(req.id, {
        decision: type,
        comments: reqComments || (type === "APPROVED" ? "Approved by Manager" : "Rejected by Manager"),
      });
      toast({
        title: type === "APPROVED" ? "Requisition Approved" : "Requisition Rejected",
        description: `${req.requisitionNumber} has been ${type === "APPROVED" ? "approved" : "rejected"}.`,
      });
      setReqDialogOpen(false);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to process", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  const pendingBudget = pendingPOs.reduce((s, po) => s + po.totalAmount, 0);
  const pendingReqBudget = pendingReqs.reduce((s, r) => s + r.estimatedBudget, 0);
  const totalPending = stats.pendingPOs + stats.pendingReqs;

  const statCards = [
    {
      label: "Pending Orders",
      value: stats.pendingPOs,
      sub: stats.pendingPOs > 0 ? `$${pendingBudget.toLocaleString()} value` : "All caught up",
      icon: Clock,
      href: "/procurement",
    },
    {
      label: "Pending Requisitions",
      value: stats.pendingReqs,
      sub: stats.pendingReqs > 0 ? `$${pendingReqBudget.toLocaleString()} requested` : "All caught up",
      icon: ClipboardList,
      href: "/requisitions",
    },
    {
      label: "Total Spend",
      value: stats.totalSpend >= 1_000_000
        ? `$${(stats.totalSpend / 1_000_000).toFixed(1)}M`
        : `$${(stats.totalSpend / 1000).toFixed(0)}K`,
      sub: "Approved orders",
      icon: DollarSign,
      href: "/analytics",
    },
    {
      label: "Open RFQs",
      value: stats.openRfqs,
      sub: "Accepting bids",
      icon: BarChart3,
      href: "/rfq",
    },
  ];

  return (
    <RequireRole allowedRoles={["ADMIN", "MANAGER", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Manager Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Approve purchase orders and requisitions</p>
            </div>
            <Button size="sm" className="text-xs h-8 gap-1.5" asChild>
              <Link href="/procurement"><CheckCircle2 className="h-3.5 w-3.5" />Review Orders</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {statCards.map(({ label, value, sub, icon: Icon, href }) => (
              <Link key={label} href={href} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                  {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                  {!loading && sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
              </Link>
            ))}
          </div>

          {/* Attention banner */}
          {!loading && totalPending > 0 && (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="text-xs text-amber-800 flex-1">
                <span className="font-semibold">{totalPending} item{totalPending > 1 ? "s" : ""}</span> need your approval —{" "}
                {stats.pendingPOs > 0 && <>{stats.pendingPOs} order{stats.pendingPOs > 1 ? "s" : ""}</>}
                {stats.pendingPOs > 0 && stats.pendingReqs > 0 && " and "}
                {stats.pendingReqs > 0 && <>{stats.pendingReqs} requisition{stats.pendingReqs > 1 ? "s" : ""}</>}.
              </div>
            </div>
          )}

          {/* Approval tabs */}
          <Tabs defaultValue="orders">
            <TabsList>
              <TabsTrigger value="orders" className="text-xs">
                Orders
                {stats.pendingPOs > 0 && (
                  <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">{stats.pendingPOs}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="requisitions" className="text-xs">
                Requisitions
                {stats.pendingReqs > 0 && (
                  <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">{stats.pendingReqs}</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Orders tab */}
            <TabsContent value="orders">
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700">Orders Awaiting Approval</p>
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-gray-500" asChild>
                    <Link href="/procurement">View all <ArrowRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">PO Number</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Waiting</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : pendingPOs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10">
                        <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 font-medium">No orders pending approval</p>
                      </TableCell></TableRow>
                    ) : pendingPOs.map((po) => (
                      <TableRow key={po.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium font-mono">{po.poNumber}</p>
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 mt-0.5">Pending</span>
                        </TableCell>
                        <TableCell className="text-xs py-2.5 text-gray-700">{po.vendorName}</TableCell>
                        <TableCell className="text-xs font-semibold py-2.5 text-gray-900">${po.totalAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-[10px] text-gray-500 py-2.5">{po.createdAt ? daysAgo(po.createdAt) : "—"}</TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                              disabled={actionLoading === `po-${po.id}`}
                              onClick={() => handleRejectPO(po.id, po.poNumber)}
                            >
                              {actionLoading === `po-${po.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                              disabled={actionLoading === `po-${po.id}`}
                              onClick={() => handleApprovePO(po.id, po.poNumber)}
                            >
                              {actionLoading === `po-${po.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Requisitions tab */}
            <TabsContent value="requisitions">
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700">Requisitions Awaiting Approval</p>
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-gray-500" asChild>
                    <Link href="/requisitions">View all <ArrowRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Requisition #</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Department</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Budget</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Submitted</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : pendingReqs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10">
                        <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 font-medium">No requisitions pending approval</p>
                      </TableCell></TableRow>
                    ) : pendingReqs.map((req) => (
                      <TableRow key={req.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-2.5">
                          <p className="text-xs font-medium font-mono">{req.requisitionNumber}</p>
                          {req.justification && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[140px]" title={req.justification}>{req.justification}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs py-2.5 text-gray-700">{req.department}</TableCell>
                        <TableCell className="text-xs font-semibold py-2.5 text-gray-900">${req.estimatedBudget.toLocaleString()}</TableCell>
                        <TableCell className="text-[10px] text-gray-500 py-2.5">{req.createdAt ? daysAgo(req.createdAt) : "—"}</TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                              disabled={actionLoading === `req-${req.id}`}
                              onClick={() => openReqDialog(req, "REJECTED")}
                            >
                              <XCircle className="h-3 w-3 mr-1" />Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                              disabled={actionLoading === `req-${req.id}`}
                              onClick={() => openReqDialog(req, "APPROVED")}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick Actions */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Quick Actions</p>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Approve Orders", href: "/procurement", icon: CheckCircle2 },
                { label: "View Reports", href: "/analytics", icon: TrendingUp },
                { label: "Review RFQs", href: "/rfq", icon: BarChart3 },
                { label: "Vendor List", href: "/vendors", icon: ShoppingCart },
              ].map(({ label, href, icon: Icon }) => (
                <Button key={label} variant="outline" size="sm" className="justify-start text-xs h-9 gap-2" asChild>
                  <Link href={href}><Icon className="h-3.5 w-3.5" />{label}</Link>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Requisition approve/reject dialog */}
        <Dialog open={reqDialogOpen} onOpenChange={setReqDialogOpen}>
          <DialogContent className="sm:max-w-[440px] rounded">
            <DialogHeader>
              <DialogTitle className={reqAction?.type === "APPROVED" ? "text-emerald-700" : "text-red-700"}>
                {reqAction?.type === "APPROVED" ? "Approve Requisition" : "Reject Requisition"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {reqAction?.type === "APPROVED"
                  ? `Approving ${reqAction?.req.requisitionNumber} for $${reqAction?.req.estimatedBudget?.toLocaleString()}.`
                  : `Rejecting ${reqAction?.req.requisitionNumber}. The requester will be notified.`}
              </DialogDescription>
            </DialogHeader>
            {reqAction?.req && (
              <div className="rounded-md bg-gray-50 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Department</span>
                  <span className="font-medium">{reqAction.req.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Budget requested</span>
                  <span className="font-semibold">${reqAction.req.estimatedBudget?.toLocaleString()}</span>
                </div>
                {reqAction.req.justification && (
                  <div className="pt-1 border-t border-gray-200">
                    <p className="text-gray-500 mb-0.5">Justification</p>
                    <p className="text-gray-700">{reqAction.req.justification}</p>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {reqAction?.type === "APPROVED" ? "Approval notes" : "Reason for rejection"}{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                value={reqComments}
                onChange={(e) => setReqComments(e.target.value)}
                placeholder={reqAction?.type === "APPROVED" ? "Notes for the team..." : "Reason for rejection..."}
                rows={3}
                className="text-xs resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setReqDialogOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className={`text-xs ${reqAction?.type === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                disabled={actionLoading?.startsWith("req-")}
                onClick={confirmReqAction}
              >
                {actionLoading?.startsWith("req-") && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {reqAction?.type === "APPROVED" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}
