"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { rfqApi, bidApi, poApi, deliveryApi, vendorApi } from "@/lib/api";
import Link from "next/link";
import {
  Loader2, Truck, Gavel, Package, Building2, Receipt, Star,
  ClipboardList, AlertCircle, CheckCircle2, FileText,
} from "lucide-react";
import { VendorDocumentDialog } from "@/app/vendors/vendor-document-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function VendorDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const hasRole = useAuthStore((state) => state.hasRole);
  const [stats, setStats] = useState({ openRfqs: 0, myBids: 0, myOrders: 0, deliveries: 0 });
  const [recentBids, setRecentBids] = useState<any[]>([]);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [docsOpen, setDocsOpen] = useState(false);

  // Step 1: resolve or create the vendor profile
  useEffect(() => {
    if (!user?.userId) return;

    async function resolveProfile() {
      setProfileLoading(true);
      try {
        const profile = await vendorApi.getByUserId(user!.userId);
        setVendorProfile(profile);
        // "Vendor " + id is the backend's auto-generated stub name; "Vendor-" prefix is the legacy check
        const isIncomplete = !profile.companyName ||
          profile.companyName.startsWith("Vendor ") ||
          profile.companyName.startsWith("Vendor-");
        setProfileIncomplete(isIncomplete);
      } catch {
        // No profile yet — initialize one using the company name the vendor provided at registration
        try {
          const created = await vendorApi.initProfile({
            companyName: user!.tenantName || undefined,
            email: user!.email,
          });
          setVendorProfile(created);
          setProfileIncomplete(true);
        } catch {
          // swallow — dashboard still usable
        }
      } finally {
        setProfileLoading(false);
      }
    }

    resolveProfile();
  }, [user?.userId]);

  // Step 2: load dashboard data once we have the vendor profile
  useEffect(() => {
    if (!hasRole(["ADMIN", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"])) return;
    if (profileLoading) return;

    async function load() {
      try {
        setLoading(true);
        const vendorEntityId = vendorProfile?.vendorId || vendorProfile?.id;

        const [rfqs, orders] = await Promise.all([
          rfqApi.getAllList().catch((err: unknown) => {
            console.error("[VendorDashboard] Failed to load RFQs:", err);
            return [];
          }),
          poApi.getAllList().catch((err: unknown) => {
            console.error("[VendorDashboard] Failed to load purchase orders:", err);
            return [];
          }),
        ]);

        console.debug("[VendorDashboard] RFQs loaded:", (rfqs as any[]).length, "| statuses:", Array.from(new Set((rfqs as any[]).map((r: any) => r.status))));

        const rfqTitleMap = new Map<string, string>();
        (rfqs as any[]).forEach((r: any) => {
          const id = String(r.rfqId || r.id || "");
          if (id && r.title) rfqTitleMap.set(id, r.title);
        });

        const openRfqs = (rfqs as any[]).filter(
          (r: any) => ["OPEN", "Open"].includes(r.status)
        ).length;

        let myBids: any[] = [];
        if (vendorEntityId) {
          myBids = (await bidApi.getByVendor(vendorEntityId).catch(() => [])) as any[];
        }

        // Filter purchase orders to those belonging to this vendor
        const myOrders = vendorEntityId
          ? (orders as any[]).filter((o: any) => String(o.vendorId) === String(vendorEntityId))
          : [];

        let deliveries: any[] = [];
        try {
          const allDeliveries = await deliveryApi.getAllList().catch(() => []);
          deliveries = vendorEntityId
            ? (allDeliveries as any[]).filter((d: any) => String(d.vendorId) === String(vendorEntityId))
            : [];
        } catch { /* ignore */ }

        setStats({
          openRfqs,
          myBids: myBids.length,
          myOrders: myOrders.length,
          deliveries: deliveries.length,
        });

        setRecentBids(
          myBids.slice(0, 5).map((bid: any) => ({
            ...bid,
            id: String(bid.bidId || bid.id),
            rfqTitle:
              rfqTitleMap.get(String(bid.rfqId || "")) ||
              (bid.rfqId ? `RFQ-${String(bid.rfqId).padStart(6, "0")}` : "--"),
            deliveryTime:
              bid.deliveryTime || (bid.deliveryDays ? `${bid.deliveryDays} days` : "--"),
          }))
        );
      } catch {
        // silently fail — show zeros
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, hasRole, profileLoading, vendorProfile]);

  return (
    <RequireRole allowedRoles={["ADMIN", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Vendor Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {vendorProfile?.companyName && !profileIncomplete
                  ? vendorProfile.companyName
                  : "Submit bids, track orders, and manage your profile"}
              </p>
            </div>
            <Button size="sm" className="text-xs h-8" asChild>
              <Link href="/rfq">
                <Gavel className="mr-1.5 h-3.5 w-3.5" />
                Browse RFQs
              </Link>
            </Button>
          </div>

          {/* Profile setup banner */}
          {!profileLoading && profileIncomplete && (
            <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 rounded p-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-800">Complete your vendor profile</p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Your profile is incomplete. Add your company details and categories to start receiving RFQ invitations.
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0" asChild>
                <Link href="/settings?tab=profile">Complete profile</Link>
              </Button>
            </div>
          )}

          {/* Compliance document nudge — shown when vendor is not yet Verified */}
          {!profileLoading && vendorProfile && vendorProfile.complianceStatus !== "Verified" && (
            <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 rounded p-3">
              <FileText className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-800">Upload your compliance documents</p>
                <p className="text-[10px] text-blue-700 mt-0.5">
                  Upload your business license, ISO certificates, and other compliance documents to get verified and unlock bidding.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] border-blue-300 text-blue-800 hover:bg-blue-100 shrink-0"
                onClick={() => setDocsOpen(true)}
              >
                Upload now
              </Button>
            </div>
          )}

          {/* Profile confirmed banner (only shown briefly after init) */}
          {!profileLoading && vendorProfile && !profileIncomplete && (
            <div className="flex items-center gap-2 border border-green-100 bg-green-50 rounded p-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              <p className="text-[10px] text-green-700">
                Verified vendor: <span className="font-medium">{vendorProfile.companyName}</span>
                {vendorProfile.complianceStatus && (
                  <span className="ml-2 text-green-600">· {vendorProfile.complianceStatus}</span>
                )}
              </p>
            </div>
          )}

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
                  {loading ? (
                    <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" />
                  ) : (
                    <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
                  )}
                  {!loading && (
                    <Link href={href} className="text-[10px] text-gray-400 hover:underline mt-0.5 block">
                      {sub}
                    </Link>
                  )}
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
                              const cls =
                                s === "AWARDED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : s === "SUBMITTED"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600";
                              return (
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
                                  {bid.status}
                                </span>
                              );
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => setDocsOpen(true)}
                  disabled={!vendorProfile}
                >
                  <FileText className="mr-2 h-3.5 w-3.5" />My Compliance Documents
                </Button>
              </div>
            </div>
          </div>
        </div>
        <VendorDocumentDialog
          open={docsOpen}
          onOpenChange={setDocsOpen}
          vendor={vendorProfile ? {
            id: String(vendorProfile.vendorId || vendorProfile.id || ""),
            companyName: vendorProfile.companyName || "My Company",
          } : null}
          onSuccess={() => {}}
        />
      </DashboardLayout>
    </RequireRole>
  );
}
