"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { rfqApi, bidApi, poApi, deliveryApi, getVendorNameMap } from "@/lib/api";
import Link from "next/link";
import { Loader2, Truck, Gavel, Package, Building2, Receipt, Star, ClipboardList } from "lucide-react";
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
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {[
              { label: "Open RFQs", value: stats.openRfqs, href: "/rfq", icon: Gavel, sub: "available to bid" },
              { label: "My Bids", value: stats.myBids, href: "/rfq", icon: ClipboardList, sub: "submitted bids" },
              { label: "Purchase Orders", value: stats.myOrders, href: "/orders", icon: Package, sub: "awarded orders" },
              { label: "Deliveries", value: stats.deliveries, href: "/deliveries", icon: Truck, sub: "total deliveries" },
            ].map(({ label, value, href, icon: Icon, sub }) => (
              <div key={label} className="px-4 py-3 flex items-center gap-3">
                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                  {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                  {!loading && <Link href={href} className="text-[10px] text-gray-400 hover:underline mt-0.5 block">{sub}</Link>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Recent Bids */}
            <div className="col-span-2 border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">My Recent Bids</p>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Bid #</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">RFQ</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Delivery</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
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
                        <TableCell colSpan={5} className="text-center py-8">
                          <Gavel className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">No bids submitted yet</p>
                          <Link href="/rfq" className="text-[10px] text-primary hover:underline mt-1 block">
                            Browse open RFQs to get started
                          </Link>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentBids.map((bid) => (
                        <TableRow key={bid.id} className="hover:bg-gray-50 transition-colors">
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
                            {(() => {
                              const s = bid.status?.toUpperCase();
                              const cls = s === "AWARDED" ? "bg-emerald-100 text-emerald-700" : s === "SUBMITTED" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600";
                              return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{bid.status}</span>;
                            })()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">Quick Actions</p>
              </div>
              <div className="p-3 space-y-2">
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
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
