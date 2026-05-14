"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import { rfqApi, vendorApi, poApi, getVendorNameMap } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Loader2, ShoppingCart, TrendingUp, CheckCircle2, BarChart3,
  XCircle, AlertCircle, ArrowRight, Clock, DollarSign,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function ManagerDashboardPage() {
  const [stats, setStats] = useState({
    pendingApprovals: 0, approvedPOs: 0, totalSpend: 0, openRfqs: 0,
  });
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const hasRole = useAuthStore((state) => state.hasRole);

  async function loadData() {
    if (!hasRole(["ADMIN", "MANAGER"])) return;
    try {
      setLoading(true);
      const [rfqs, pos, vendorMap] = await Promise.all([
        rfqApi.getAllList().catch(() => []),
        poApi.getAllList().catch(() => []),
        getVendorNameMap(),
      ]);

      const pending = pos.filter((po: any) => po.status?.toLowerCase().includes("pending"));
      const approved = pos.filter(
        (po: any) => po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending")
      );
      const totalSpend = approved.reduce((sum: number, po: any) => sum + (Number(po.totalAmount) || 0), 0);
      const openRfqs = rfqs.filter((r: any) => r.status?.toUpperCase() === "OPEN").length;

      setStats({ pendingApprovals: pending.length, approvedPOs: approved.length, totalSpend, openRfqs });

      setPendingPOs(
        pending.slice(0, 10).map((po: any) => ({
          id: String(po.id || po.poId),
          poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
          vendorName: po.vendorName || vendorMap?.get(String(po.vendorId || "")) || (po.vendorId ? `Vendor #${po.vendorId}` : "N/A"),
          totalAmount: Number(po.totalAmount) || 0,
          status: po.status,
          createdAt: po.createdAt || po.issueDate,
        }))
      );
    } catch {
      // silently fail — show zeros
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [hasRole]);

  async function handleApprove(poId: string, poNumber: string) {
    try {
      setActionLoading(poId);
      await poApi.approve(poId);
      toast({ title: "Approved", description: `${poNumber} has been approved.` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to approve", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(poId: string, poNumber: string) {
    try {
      setActionLoading(poId);
      await poApi.reject(poId);
      toast({ title: "Rejected", description: `${poNumber} has been rejected.` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to reject", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  const pendingBudget = pendingPOs.reduce((s, po) => s + po.totalAmount, 0);

  const statCards = [
    {
      label: "Awaiting Approval",
      value: stats.pendingApprovals,
      sub: stats.pendingApprovals > 0 ? `$${pendingBudget.toLocaleString()} total value` : "All caught up",
      icon: Clock,
      href: "/procurement",
    },
    {
      label: "Approved Orders",
      value: stats.approvedPOs,
      sub: "This period",
      icon: CheckCircle2,
      href: "/procurement",
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
    <RequireRole allowedRoles={["ADMIN", "MANAGER"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Manager Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Approve purchase orders and review procurement reports</p>
            </div>
            <Button size="sm" className="text-xs h-8 gap-1.5" asChild>
              <Link href="/procurement"><CheckCircle2 className="h-3.5 w-3.5" />Review Orders</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {statCards.map(({ label, value, sub, icon: Icon, href }) => (
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

          {/* Attention banner */}
          {!loading && stats.pendingApprovals > 0 && (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="text-xs text-amber-800 flex-1">
                <span className="font-semibold">{stats.pendingApprovals} order{stats.pendingApprovals > 1 ? "s" : ""}</span> worth{" "}
                <span className="font-semibold">${pendingBudget.toLocaleString()}</span> need your approval.
              </div>
              <Button size="sm" variant="outline" className="ml-auto h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
                <Link href="/procurement">Review Now</Link>
              </Button>
            </div>
          )}

          {/* Pending Approvals table */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">
                Orders Awaiting Approval
                {stats.pendingApprovals > 0 && (
                  <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">{stats.pendingApprovals}</span>
                )}
              </p>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-gray-500" asChild>
                <Link href="/procurement">View all <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </div>
            <div>
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
                      <p className="text-xs text-gray-500 font-medium">You're all caught up!</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">No orders waiting for approval</p>
                    </TableCell></TableRow>
                  ) : pendingPOs.map((po) => (
                    <TableRow key={po.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="py-2.5">
                        <p className="text-xs font-medium font-mono">{po.poNumber}</p>
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 mt-0.5">Pending</span>
                      </TableCell>
                      <TableCell className="text-xs py-2.5 text-gray-700">{po.vendorName}</TableCell>
                      <TableCell className="text-xs font-semibold py-2.5 text-gray-900">
                        ${po.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[10px] text-gray-500 py-2.5">
                        {po.createdAt ? daysAgo(po.createdAt) : "—"}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                            disabled={actionLoading === po.id}
                            onClick={() => handleReject(po.id, po.poNumber)}
                          >
                            {actionLoading === po.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                            disabled={actionLoading === po.id}
                            onClick={() => handleApprove(po.id, po.poNumber)}
                          >
                            {actionLoading === po.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

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
      </DashboardLayout>
    </RequireRole>
  );
}
