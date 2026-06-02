"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import { rfqApi, poApi, requisitionApi, vendorApi, getVendorNameMap } from "@/lib/api";
import { displayVendorName } from "@/lib/display";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Loader2, CheckCircle2, XCircle, AlertCircle, ArrowRight,
  DollarSign, BarChart3, Clock, TrendingUp, ShoppingCart,
  ClipboardList, Users,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function StatusChip({ status }: { status: string }) {
  const l = status?.toLowerCase() || "";
  const cls = l.includes("approved") && !l.includes("pending")
    ? "bg-emerald-100 text-emerald-700"
    : l.includes("pending")
    ? "bg-amber-100 text-amber-700"
    : l.includes("rejected")
    ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-600";
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{status}</span>;
}

export default function DirectorDashboardPage() {
  const { toast } = useToast();
  const hasRole = useAuthStore((state) => state.hasRole);

  const [stats, setStats] = useState({
    pendingPOs: 0,
    pendingReqs: 0,
    totalSpend: 0,
    openRfqs: 0,
    totalVendors: 0,
    approvedPOs: 0,
  });
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [pendingReqs, setPendingReqs] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    if (!hasRole(["DIRECTOR", "ADMIN", "SUPER_ADMIN"])) return;
    try {
      setLoading(true);
      const [rfqs, pos, reqs, vendorMap, vendors] = await Promise.all([
        rfqApi.getAllList().catch(() => []),
        poApi.getAllList().catch(() => []),
        requisitionApi.getAllList().catch(() => []),
        getVendorNameMap(),
        vendorApi.getAllList().catch(() => []),
      ]);

      const pending = (pos as any[]).filter((po: any) => po.status?.toLowerCase().includes("pending"));
      const approved = (pos as any[]).filter(
        (po: any) => po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending")
      );
      const pendingR = (reqs as any[]).filter((r: any) =>
        r.status === "PENDING_APPROVAL" && r.currentApprovalLevel === 2
      );
      const totalSpend = approved.reduce((s: number, po: any) => s + (Number(po.totalAmount) || 0), 0);
      const openRfqs = (rfqs as any[]).filter((r: any) => r.status?.toUpperCase() === "OPEN").length;

      setStats({
        pendingPOs: pending.length,
        pendingReqs: pendingR.length,
        totalSpend,
        openRfqs,
        totalVendors: (vendors as any[]).length,
        approvedPOs: approved.length,
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
        pendingR.slice(0, 10).map((r: any) => ({
          id: String(r.id || r.requisitionId),
          reqNumber: r.requisitionNumber || `REQ-${String(r.requisitionId || r.id).padStart(6, "0")}`,
          department: r.department || "—",
          estimatedBudget: Number(r.estimatedBudget) || 0,
          status: r.status,
          justification: r.justification || "",
          createdAt: r.createdAt || r.requestDate,
        }))
      );
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [hasRole]);

  async function handleApprovePO(poId: string, poNumber: string) {
    setActionLoading(`po-${poId}`);
    try {
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
    setActionLoading(`po-${poId}`);
    try {
      await poApi.reject(poId);
      toast({ title: "Rejected", description: `${poNumber} has been rejected.` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reject", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApproveReq(reqId: string, reqNumber: string) {
    setActionLoading(`req-${reqId}`);
    try {
      await requisitionApi.approve(reqId, { decision: "APPROVED", comments: "Approved by Director" });
      toast({ title: "Approved", description: `${reqNumber} has been approved.` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to approve", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectReq(reqId: string, reqNumber: string) {
    setActionLoading(`req-${reqId}`);
    try {
      await requisitionApi.approve(reqId, { decision: "REJECTED", comments: "Rejected by Director" });
      toast({ title: "Rejected", description: `${reqNumber} has been rejected.` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reject", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  const pendingBudget = pendingPOs.reduce((s, po) => s + po.totalAmount, 0);
  const pendingReqBudget = pendingReqs.reduce((s, r) => s + r.estimatedBudget, 0);
  const totalPending = stats.pendingPOs + stats.pendingReqs;

  return (
    <RequireRole allowedRoles={["DIRECTOR", "ADMIN", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Director Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Strategic oversight and procurement approvals
              </p>
            </div>
            <Button size="sm" className="text-xs h-8 gap-1.5" asChild>
              <Link href="/analytics">
                <BarChart3 className="h-3.5 w-3.5" />View Reports
              </Link>
            </Button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-200 border border-gray-200 rounded">
            {[
              {
                label: "Awaiting Approval",
                value: totalPending,
                sub: totalPending > 0 ? "action needed" : "all clear",
                icon: Clock,
                urgent: totalPending > 0,
              },
              {
                label: "Pending POs",
                value: stats.pendingPOs,
                sub: stats.pendingPOs > 0 ? `$${pendingBudget.toLocaleString()}` : "none",
                icon: ShoppingCart,
                urgent: stats.pendingPOs > 0,
              },
              {
                label: "Pending Requisitions",
                value: stats.pendingReqs,
                sub: stats.pendingReqs > 0 ? `$${pendingReqBudget.toLocaleString()}` : "none",
                icon: ClipboardList,
                urgent: stats.pendingReqs > 0,
              },
              {
                label: "Total Spend",
                value: stats.totalSpend >= 1_000_000
                  ? `$${(stats.totalSpend / 1_000_000).toFixed(1)}M`
                  : `$${(stats.totalSpend / 1000).toFixed(0)}K`,
                sub: "approved orders",
                icon: DollarSign,
                urgent: false,
              },
              {
                label: "Open RFQs",
                value: stats.openRfqs,
                sub: "accepting bids",
                icon: TrendingUp,
                urgent: false,
              },
              {
                label: "Vendors",
                value: stats.totalVendors,
                sub: "registered",
                icon: Users,
                urgent: false,
              },
            ].map(({ label, value, sub, icon: Icon, urgent }) => (
              <div key={label} className="px-3 py-3 flex items-center gap-2.5">
                <Icon className={`h-4 w-4 shrink-0 ${urgent ? "text-amber-500" : "text-gray-400"}`} />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
                  {loading ? (
                    <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" />
                  ) : (
                    <p className={`text-lg font-semibold mt-0.5 leading-none ${urgent ? "text-amber-700" : "text-gray-900"}`}>
                      {value}
                    </p>
                  )}
                  {!loading && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Attention banner */}
          {!loading && totalPending > 0 && (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 flex-1">
                <span className="font-semibold">{totalPending} item{totalPending > 1 ? "s" : ""}</span> need your approval
                {" "}({stats.pendingPOs > 0 && `${stats.pendingPOs} purchase order${stats.pendingPOs > 1 ? "s" : ""}`}
                {stats.pendingPOs > 0 && stats.pendingReqs > 0 && " · "}
                {stats.pendingReqs > 0 && `${stats.pendingReqs} requisition${stats.pendingReqs > 1 ? "s" : ""}`}).
              </p>
            </div>
          )}

          {/* Approval tabs */}
          <Tabs defaultValue="pos">
            <TabsList className="h-9 w-full justify-start rounded-none border-b border-gray-200 bg-transparent p-0 gap-0">
              {[
                {
                  value: "pos",
                  label: `Purchase Orders${stats.pendingPOs > 0 ? ` (${stats.pendingPOs})` : ""}`,
                },
                {
                  value: "reqs",
                  label: `Requisitions${stats.pendingReqs > 0 ? ` (${stats.pendingReqs})` : ""}`,
                },
              ].map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-9 rounded-none border-b-2 border-transparent px-4 text-xs font-medium text-gray-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:!bg-transparent data-[state=active]:!shadow-none hover:text-gray-700"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Purchase Orders ──────────────────────────────────────── */}
            <TabsContent value="pos" className="mt-0">
              <div className="border border-t-0 border-gray-200 rounded-b overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-700">
                    Purchase Orders Awaiting Approval
                  </span>
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
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : pendingPOs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 font-medium">No purchase orders pending approval</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingPOs.map((po) => {
                        const key = `po-${po.id}`;
                        const busy = actionLoading === key;
                        return (
                          <TableRow key={po.id} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="py-2.5">
                              <p className="text-xs font-medium font-mono">{po.poNumber}</p>
                            </TableCell>
                            <TableCell className="text-xs py-2.5 text-gray-700">{po.vendorName}</TableCell>
                            <TableCell className="text-xs font-semibold py-2.5 text-gray-900">
                              ${po.totalAmount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-[10px] text-gray-500 py-2.5">
                              {po.createdAt ? daysAgo(po.createdAt) : "—"}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <StatusChip status={po.status} />
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50"
                                  disabled={busy}
                                  onClick={() => handleRejectPO(po.id, po.poNumber)}
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                                  disabled={busy}
                                  onClick={() => handleApprovePO(po.id, po.poNumber)}
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                  Approve
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Requisitions ──────────────────────────────────────────── */}
            <TabsContent value="reqs" className="mt-0">
              <div className="border border-t-0 border-gray-200 rounded-b overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-700">
                    Requisitions Awaiting Approval
                  </span>
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-gray-500" asChild>
                    <Link href="/requisitions">View all <ArrowRight className="h-3 w-3" /></Link>
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Requisition</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Department</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Est. Budget</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Justification</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Waiting</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : pendingReqs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 font-medium">No requisitions pending approval</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingReqs.map((req) => {
                        const key = `req-${req.id}`;
                        const busy = actionLoading === key;
                        return (
                          <TableRow key={req.id} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="py-2.5">
                              <p className="text-xs font-medium font-mono">{req.reqNumber}</p>
                              <StatusChip status={req.status} />
                            </TableCell>
                            <TableCell className="text-xs py-2.5 text-gray-700">{req.department}</TableCell>
                            <TableCell className="text-xs font-semibold py-2.5 text-gray-900">
                              ${req.estimatedBudget.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-[10px] py-2.5 text-gray-500 max-w-[160px] truncate">
                              {req.justification || "—"}
                            </TableCell>
                            <TableCell className="text-[10px] text-gray-500 py-2.5">
                              {req.createdAt ? daysAgo(req.createdAt) : "—"}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50"
                                  disabled={busy}
                                  onClick={() => handleRejectReq(req.id, req.reqNumber)}
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                                  disabled={busy}
                                  onClick={() => handleApproveReq(req.id, req.reqNumber)}
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                  Approve
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick actions */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Quick Access</p>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "View Analytics",    href: "/analytics",    icon: BarChart3    },
                { label: "Purchase Orders",   href: "/procurement",  icon: ShoppingCart },
                { label: "All Requisitions",  href: "/requisitions", icon: ClipboardList },
                { label: "Vendor Performance",href: "/vendors/performance", icon: TrendingUp },
              ].map(({ label, href, icon: Icon }) => (
                <Button key={label} variant="outline" size="sm" className="justify-start text-xs h-9 gap-2" asChild>
                  <Link href={href}><Icon className="h-3.5 w-3.5" />{label}</Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
