"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import { rfqApi, vendorApi, poApi, bidApi, getVendorNameMap, getCategoryNameMap } from "@/lib/api";
import { displayVendorName } from "@/lib/display";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import {
  Loader2, ClipboardList, Users, ShoppingCart, Gavel,
  TrendingUp, CheckCircle2, Clock, AlertCircle, ArrowRight,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function daysRemaining(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return { label: "Overdue", urgent: true };
  if (days === 0) return { label: "Due today", urgent: true };
  if (days === 1) return { label: "1 day left", urgent: true };
  if (days <= 3) return { label: `${days} days left`, urgent: true };
  return { label: `${days} days left`, urgent: false };
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function rfqStatusChip(s: string) {
  const u = s?.toUpperCase();
  const cls = u === "OPEN" ? "bg-emerald-100 text-emerald-700"
    : u === "CLOSED" ? "bg-gray-100 text-gray-600"
    : u === "AWARDED" ? "bg-blue-100 text-blue-700"
    : "bg-gray-100 text-gray-600";
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{s}</span>;
}

export default function OfficerDashboardPage() {
  const [stats, setStats] = useState({
    openRfqs: 0, totalVendors: 0, pendingPOs: 0, totalBids: 0,
  });
  const [recentRfqs, setRecentRfqs] = useState<any[]>([]);
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const hasRole = useAuthStore((state) => state.hasRole);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "SUPER_ADMIN"])) return;
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
        const pending = pos.filter((po: any) => po.status?.toLowerCase().includes("pending"));
        let totalBids = 0;
        openRfqs.forEach((r: any) => { totalBids += r.bidCount || 0; });

        setStats({
          openRfqs: openRfqs.length,
          totalVendors: vendors.filter((v: any) => v.verified || v.status === "ACTIVE").length,
          pendingPOs: pending.length,
          totalBids,
        });

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
            vendorName: displayVendorName(po.vendorId, { name: po.vendorName, map: vendorMap, empty: "N/A" }),
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
    load();
  }, [hasRole]);

  const statCards = [
    { label: "Open RFQs", value: stats.openRfqs, icon: Gavel, href: "/rfq" },
    { label: "Active Vendors", value: stats.totalVendors, icon: Users, href: "/vendors" },
    { label: "Pending POs", value: stats.pendingPOs, icon: ShoppingCart, href: "/procurement" },
    { label: "Total Bids", value: stats.totalBids, icon: TrendingUp, href: "/rfq" },
  ];

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Procurement Officer Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage RFQs, vendors, and purchase orders</p>
            </div>
            <Button size="sm" className="text-xs h-8 gap-1.5" asChild>
              <Link href="/rfq"><ClipboardList className="h-3.5 w-3.5" />Create RFQ</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {statCards.map(({ label, value, icon: Icon, href }) => (
              <Link key={label} href={href} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                  {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                </div>
              </Link>
            ))}
          </div>

          {/* Alerts */}
          {!loading && stats.pendingPOs > 0 && (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">{stats.pendingPOs} purchase order{stats.pendingPOs > 1 ? "s" : ""}</span> awaiting manager approval.
              </p>
              <Button size="sm" variant="outline" className="ml-auto h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
                <Link href="/procurement">View Orders</Link>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent RFQs */}
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">Recent RFQs</p>
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-gray-500" asChild>
                  <Link href="/rfq">View all <ArrowRight className="h-3 w-3" /></Link>
                </Button>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">RFQ</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-center">Bids</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : recentRfqs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500 text-xs">
                        No RFQs yet.{" "}
                        <Link href="/rfq" className="text-primary hover:underline">Create one</Link>
                      </TableCell></TableRow>
                    ) : recentRfqs.map((rfq) => {
                      const deadline = rfq.deadline ? daysRemaining(rfq.deadline) : null;
                      return (
                        <TableRow key={rfq.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="py-2">
                            <p className="text-xs font-medium font-mono">{rfq.rfqNumber}</p>
                            {rfq.title && <p className="text-[10px] text-gray-500 truncate max-w-[110px]">{rfq.title}</p>}
                          </TableCell>
                          <TableCell className="py-2">
                            {rfqStatusChip(rfq.status)}
                          </TableCell>
                          <TableCell className="text-xs py-2 text-center font-medium">
                            {rfq.bidCount > 0 ? (
                              <span className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 text-[10px] font-medium">{rfq.bidCount}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            {deadline ? (
                              <span className={`text-[10px] font-medium ${deadline.urgent ? "text-red-600" : "text-gray-500"}`}>
                                {deadline.label}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">No deadline</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pending POs */}
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">
                  Pending Purchase Orders
                  {stats.pendingPOs > 0 && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 ml-2">{stats.pendingPOs}</span>
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
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">PO</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Waiting</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : pendingPOs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-500 mt-1">All purchase orders are reviewed</p>
                      </TableCell></TableRow>
                    ) : pendingPOs.map((po) => (
                      <TableRow key={po.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-2">
                          <p className="text-xs font-medium font-mono">{po.poNumber}</p>
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 mt-0.5">Pending</span>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-gray-600">{po.vendorName}</TableCell>
                        <TableCell className="text-xs font-semibold py-2 text-gray-900">
                          ${po.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[10px] text-gray-500 py-2">
                          {po.createdAt ? daysAgo(po.createdAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Quick Actions</p>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Add Vendor", href: "/vendors", icon: Users },
                { label: "Create RFQ", href: "/rfq", icon: Gavel },
                { label: "Create PO", href: "/procurement", icon: ShoppingCart },
                { label: "Update Inventory", href: "/inventory", icon: ClipboardList },
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
