"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { rfqApi, bidApi, poApi, deliveryApi, getVendorNameMap } from "@/lib/api";
import Link from "next/link";
import { Loader2, Truck, Gavel, Package, Building2, Receipt, Star } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function VendorDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const hasRole = useAuthStore((state) => state.hasRole);
  const [stats, setStats] = useState({ openRfqs: 0, myBids: 0, myOrders: 0, deliveries: 0 });
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasRole(["ADMIN", "VENDOR"])) return;

    async function load() {
      try {
        setLoading(true);
        const vendorId = user?.id || user?.userId;

        const [rfqs, orders, vendorMap] = await Promise.all([
          rfqApi.getAllList().catch(() => []),
          poApi.getAllList().catch(() => []),
          getVendorNameMap(),
        ]);

        // Build rfqId → title map so the bids table shows the RFQ title, not a raw ID.
        // RFQ entity: rfqId (Long), title (String)
        const rfqTitleMap = new Map<string, string>();
        (rfqs as any[]).forEach((r: any) => {
          const id = String(r.rfqId || r.id || "");
          if (id && r.title) rfqTitleMap.set(id, r.title);
        });

        const openRfqs = rfqs.filter(
          (r: any) => r.status?.toUpperCase() === "OPEN"
        ).length;

        let myBids: any[] = [];
        if (vendorId) {
          myBids = (await bidApi.getByVendor(vendorId).catch(() => [])) as any[];
        }

        let deliveries: any[] = [];
        try {
          deliveries = await deliveryApi.getAllList().catch(() => []);
        } catch { /* ignore */ }

        setStats({
          openRfqs,
          myBids: myBids.length,
          myOrders: orders.length,
          deliveries: deliveries.length,
        });

        setRecentBids(
          myBids.slice(0, 5).map((bid: any) => ({
            ...bid,
            id: String(bid.bidId || bid.id),
            vendorName: bid.vendorName || vendorMap?.get(String(bid.vendorId || "")) || (bid.vendorId ? `Vendor #${bid.vendorId}` : "Unknown Vendor"),
            // Resolve Bid.rfqId (Long) -> RFQ.title (String)
            rfqTitle:
              rfqTitleMap.get(String(bid.rfqId || "")) ||
              (bid.rfqId
                ? `RFQ-${String(bid.rfqId).padStart(6, "0")}`
                : "--"),
            deliveryTime:
              bid.deliveryTime ||
              (bid.deliveryDays ? `${bid.deliveryDays} days` : "--"),
          }))
        );
      } catch {
        // silently fail — show zeros
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, hasRole]);

  return (
    <RequireRole allowedRoles={["ADMIN", "VENDOR"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Vendor Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Submit bids, track orders, and manage your profile
              </p>
            </div>
            <Button size="sm" className="text-xs h-8" asChild>
              <Link href="/rfq">
                <Gavel className="mr-1.5 h-3.5 w-3.5" />
                Browse RFQs
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm bg-blue-50">
              <CardContent className="p-3">
                <p className="text-xs text-blue-600">Open RFQs</p>
                <p className="text-xl font-semibold text-blue-700 mt-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.openRfqs}
                </p>
                <Link href="/rfq" className="text-[10px] text-blue-500 hover:underline">
                  View all
                </Link>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-emerald-50">
              <CardContent className="p-3">
                <p className="text-xs text-emerald-600">My Bids</p>
                <p className="text-xl font-semibold text-emerald-700 mt-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.myBids}
                </p>
                <Link href="/rfq" className="text-[10px] text-emerald-500 hover:underline">
                  View bids
                </Link>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-amber-50">
              <CardContent className="p-3">
                <p className="text-xs text-amber-600">Purchase Orders</p>
                <p className="text-xl font-semibold text-amber-700 mt-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.myOrders}
                </p>
                <Link href="/orders" className="text-[10px] text-amber-500 hover:underline">
                  View orders
                </Link>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gray-50">
              <CardContent className="p-3">
                <p className="text-xs text-gray-500">Deliveries</p>
                <p className="text-xl font-semibold text-gray-700 mt-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : stats.deliveries}
                </p>
                <Link href="/deliveries" className="text-[10px] text-gray-500 hover:underline">
                  Track
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Recent Bids */}
            <Card className="col-span-2 border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700">My Recent Bids</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Bid #</TableHead>
                      {/* RFQ title resolved from Bid.rfqId via rfqTitleMap */}
                      <TableHead className="text-xs font-medium text-gray-500 py-2">RFQ</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Amount</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Delivery</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : recentBids.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-gray-500 text-xs">
                          No bids yet.{" "}
                          <Link href="/rfq" className="text-primary hover:underline">
                            Browse open RFQs
                          </Link>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentBids.map((bid) => (
                        <TableRow key={bid.id}>
                          <TableCell className="text-xs font-medium py-2">
                            BID-{String(bid.id).padStart(4, "0")}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-gray-600 max-w-[160px] truncate">
                            {bid.rfqTitle}
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            ${bid.bidAmount?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-xs py-2">{bid.deliveryTime}</TableCell>
                          <TableCell className="py-2">
                            <Badge
                              variant={
                                bid.status?.toUpperCase() === "AWARDED"
                                  ? "success"
                                  : bid.status?.toUpperCase() === "SUBMITTED"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {bid.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                  <Link href="/rfq">
                    <Gavel className="mr-2 h-3.5 w-3.5" />Browse &amp; Bid on RFQs
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                  <Link href="/orders">
                    <Package className="mr-2 h-3.5 w-3.5" />View Purchase Orders
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                  <Link href="/invoices">
                    <Receipt className="mr-2 h-3.5 w-3.5" />Submit Invoice
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                  <Link href="/deliveries">
                    <Truck className="mr-2 h-3.5 w-3.5" />Update Deliveries
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                  <Link href="/vendors/performance">
                    <Star className="mr-2 h-3.5 w-3.5" />My Performance Score
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" asChild>
                  <Link href="/settings">
                    <Building2 className="mr-2 h-3.5 w-3.5" />Update Profile
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
