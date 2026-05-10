"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequireRole } from "@/components/require-role";
import { poApi, rfqApi, analyticsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Loader2, Shield, ShoppingCart, TrendingUp, CheckCircle, BarChart3, XCircle } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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
      const [pos, rfqs] = await Promise.all([
        poApi.getAllList().catch(() => []),
        rfqApi.getAllList().catch(() => []),
      ]);

      const pending = pos.filter((po: any) => po.status?.toLowerCase().includes("pending"));
      const approved = pos.filter((po: any) =>
        po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending")
      );
      const totalSpend = approved.reduce((sum: number, po: any) => sum + (Number(po.totalAmount) || 0), 0);
      const openRfqs = rfqs.filter((r: any) => r.status?.toUpperCase() === "OPEN").length;

      setStats({
        pendingApprovals: pending.length,
        approvedPOs: approved.length,
        totalSpend,
        openRfqs,
      });

      setPendingPOs(
        pending.slice(0, 10).map((po: any) => ({
          id: String(po.id || po.poId),
          poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
          vendorName: po.vendorName || `Vendor #${po.vendorId}`,
          totalAmount: Number(po.totalAmount) || 0,
          status: po.status,
          createdAt: po.createdAt || po.issueDate,
        }))
      );
    } catch {
      // silently fail
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

  const statCards = [
    { label: "Pending Approvals", value: stats.pendingApprovals, icon: Shield, color: "bg-amber-50 text-amber-700" },
    { label: "Approved POs", value: stats.approvedPOs, icon: CheckCircle, color: "bg-emerald-50 text-emerald-700" },
    { label: "Total Spend", value: `$${(stats.totalSpend / 1000).toFixed(0)}K`, icon: TrendingUp, color: "bg-blue-50 text-blue-700" },
    { label: "Open RFQs", value: stats.openRfqs, icon: BarChart3, color: "bg-gray-50 text-gray-700" },
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
            <Button size="sm" className="text-xs h-8" asChild>
              <Link href="/procurement"><CheckCircle className="mr-1.5 h-3.5 w-3.5" />Review POs</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className={`p-3 ${color.split(" ")[0]}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs ${color.split(" ")[1]}`}>{label}</p>
                      <p className={`text-xl font-semibold mt-1 ${color.split(" ")[1]}`}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : value}
                      </p>
                    </div>
                    <Icon className={`h-5 w-5 opacity-60 ${color.split(" ")[1]}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pending Approvals Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-700">
                Pending Approvals
                {stats.pendingApprovals > 0 && (
                  <Badge variant="warning" className="ml-2 text-[10px]">{stats.pendingApprovals}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link href="/procurement">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-100 hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-gray-500 py-2">PO Number</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Vendor</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Amount</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Requested</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    </TableCell></TableRow>
                  ) : pendingPOs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500 text-xs">
                      No pending approvals. All caught up!
                    </TableCell></TableRow>
                  ) : pendingPOs.map(po => (
                    <TableRow key={po.id}>
                      <TableCell className="text-xs font-medium py-2">{po.poNumber}</TableCell>
                      <TableCell className="text-xs py-2 text-gray-600">{po.vendorName}</TableCell>
                      <TableCell className="text-xs font-medium py-2">${po.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-gray-500 py-2">
                        {po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "â€â€"}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={actionLoading === po.id}
                            onClick={() => handleApprove(po.id, po.poNumber)}
                          >
                            {actionLoading === po.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            disabled={actionLoading === po.id}
                            onClick={() => handleReject(po.id, po.poNumber)}
                          >
                            {actionLoading === po.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-700">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 grid grid-cols-4 gap-2">
              {[
                { label: "Approve POs", href: "/procurement", icon: CheckCircle },
                { label: "Verify Vendors", href: "/vendors", icon: Shield },
                { label: "View Reports", href: "/analytics", icon: TrendingUp },
                { label: "Review RFQs", href: "/rfq", icon: BarChart3 },
              ].map(({ label, href, icon: Icon }) => (
                <Button key={label} variant="outline" size="sm" className="justify-start text-xs h-8" asChild>
                  <Link href={href}><Icon className="mr-2 h-3.5 w-3.5" />{label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
