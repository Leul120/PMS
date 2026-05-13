"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequireRole } from "@/components/require-role";
import { rfqApi, vendorApi, poApi, bidApi, getVendorNameMap, getCategoryNameMap } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { Loader2, ClipboardList, Users, ShoppingCart, Gavel, TrendingUp, CheckCircle, Clock } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function OfficerDashboardPage() {
  const [stats, setStats] = useState({
    openRfqs: 0, totalVendors: 0, pendingPOs: 0, totalBids: 0,
  });
  const [recentRfqs, setRecentRfqs] = useState<any[]>([]);
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const hasRole = useAuthStore((state) => state.hasRole);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER"])) return;
    async function load() {
      try {
        setLoading(true);
        const [rfqs, vendors, pos, vendorMap, categoryMap] = await Promise.all([
          rfqApi.getAllList().catch(() => []),
          vendorApi.getAllList().catch(() => []),
          poApi.getAllList().catch(() => []),
          getVendorNameMap(),
          getCategoryNameMap(),
        ]);

        const openRfqs = rfqs.filter((r: any) => r.status?.toUpperCase() === "OPEN");
        const pending = pos.filter((po: any) =>
          po.status?.toLowerCase().includes("pending")
        );

        // Count total bids across open RFQs
        let totalBids = 0;
        openRfqs.forEach((r: any) => { totalBids += r.bidCount || 0; });

        setStats({
          openRfqs: openRfqs.length,
          totalVendors: vendors.filter((v: any) => v.verified || v.status === "ACTIVE").length,
          pendingPOs: pending.length,
          totalBids,
        });

        // Most recent 5 RFQs
        setRecentRfqs(
          [...rfqs]
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 5)
            .map((r: any) => {
              const rawCategory = r.category || r.categoryName || "";
              const category = /^\d+$/.test(String(rawCategory))
                ? (categoryMap?.get(String(rawCategory)) || rawCategory)
                : rawCategory;
              return {
                id: String(r.id || r.rfqId),
                rfqNumber: r.rfqNumber || `RFQ-${String(r.rfqId || r.id).padStart(6, "0")}`,
                title: r.title,
                status: r.status,
                bidCount: r.bidCount || 0,
                deadline: r.deadline,
                category,
              };
            })
        );

        setPendingPOs(
          pending.slice(0, 5).map((po: any) => ({
            id: String(po.id || po.poId),
            poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
            vendorName: po.vendorName || vendorMap?.get(String(po.vendorId || "")) || (po.vendorId ? `Vendor #${po.vendorId}` : "N/A"),
            totalAmount: Number(po.totalAmount) || 0,
            status: po.status,
          }))
        );
      } catch {
        // silently fail â€â€ show zeros
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hasRole]);

  const statCards = [
    { label: "Open RFQs", value: stats.openRfqs, icon: Gavel, color: "bg-blue-50 text-blue-700", href: "/rfq" },
    { label: "Active Vendors", value: stats.totalVendors, icon: Users, color: "bg-emerald-50 text-emerald-700", href: "/vendors" },
    { label: "Pending POs", value: stats.pendingPOs, icon: ShoppingCart, color: "bg-amber-50 text-amber-700", href: "/procurement" },
    { label: "Total Bids", value: stats.totalBids, icon: TrendingUp, color: "bg-gray-50 text-gray-700", href: "/rfq" },
  ];

  const rfqStatusVariant = (s: string) => {
    const u = s?.toUpperCase();
    if (u === "OPEN") return "success";
    if (u === "CLOSED") return "secondary";
    if (u === "AWARDED") return "default";
    return "outline";
  };

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Procurement Officer Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage RFQs, vendors, and purchase orders</p>
            </div>
            <Button size="sm" className="text-xs h-8" asChild>
              <Link href="/rfq"><ClipboardList className="mr-1.5 h-3.5 w-3.5" />Create RFQ</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {statCards.map(({ label, value, icon: Icon, color, href }) => (
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
                  <Link href={href} className={`text-[10px] hover:underline opacity-70 ${color.split(" ")[1]}`}>
                    View all â†â€™
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Recent RFQs */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-700">Recent RFQs</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                  <Link href="/rfq">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-gray-500 py-2">RFQ</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Bids</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : recentRfqs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-500 text-xs">
                        No RFQs yet. <Link href="/rfq" className="text-primary hover:underline">Create one</Link>
                      </TableCell></TableRow>
                    ) : recentRfqs.map(rfq => (
                      <TableRow key={rfq.id}>
                        <TableCell className="py-2">
                          <p className="text-xs font-medium">{rfq.rfqNumber}</p>
                          <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{rfq.title}</p>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant={rfqStatusVariant(rfq.status)} className="text-[10px]">{rfq.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2">{rfq.bidCount}</TableCell>
                        <TableCell className="text-xs text-gray-500 py-2">
                          {rfq.deadline ? new Date(rfq.deadline).toLocaleDateString() : "â€â€"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pending POs */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-700">Pending Purchase Orders</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                  <Link href="/procurement">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-gray-500 py-2">PO</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Vendor</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : pendingPOs.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-gray-500 text-xs">
                        No pending POs.
                      </TableCell></TableRow>
                    ) : pendingPOs.map(po => (
                      <TableRow key={po.id}>
                        <TableCell className="py-2">
                          <p className="text-xs font-medium">{po.poNumber}</p>
                          <Badge variant="warning" className="text-[10px] mt-0.5">Pending</Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-gray-600">{po.vendorName}</TableCell>
                        <TableCell className="text-xs font-medium py-2">${po.totalAmount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-700">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-3 grid grid-cols-4 gap-2">
              {[
                { label: "Add Vendor", href: "/vendors", icon: Users },
                { label: "Create RFQ", href: "/rfq", icon: Gavel },
                { label: "Create PO", href: "/procurement", icon: ShoppingCart },
                { label: "Update Inventory", href: "/inventory", icon: ClipboardList },
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
