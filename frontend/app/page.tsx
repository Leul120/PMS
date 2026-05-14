"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, DollarSign, Users, ShoppingCart, Package, MoreHorizontal, ArrowUpRight, Clock, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { analyticsApi, poApi, rfqApi, vendorApi, bidApi, getVendorNameMap } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getDashboardByRole } from "@/components/require-role";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const CHART_COLORS = ["#67C090", "#4A9A6D", "#8FD9B6", "#2D6A4F", "#95D5B2"];

interface DashboardData {
  totalRFQs: number;
  openRFQs: number;
  totalPOs: number;
  pendingApprovals: number; // backend returns a long, not an array
  vendorCount: number;
}

// Helper to generate monthly spend data from POs
function generateMonthlyData(pos: any[]) {
  if (pos.length === 0) return [];

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlySpend = new Array(12).fill(0);

  pos.forEach((po) => {
    if (po.createdAt) {
      const date = new Date(po.createdAt);
      const month = date.getMonth();
      monthlySpend[month] += po.totalAmount || 0;
    }
  });

  // Only show months with data + current month
  const lastMonthWithData = monthlySpend.reduce((last, val, idx) => val > 0 ? idx : last, 0);
  const result = [];
  for (let i = 0; i <= Math.max(lastMonthWithData, new Date().getMonth()); i++) {
    if (monthlySpend[i] > 0) {
      result.push({ name: months[i], value: monthlySpend[i] });
    }
  }

  return result.length > 0 ? result : [{ name: months[new Date().getMonth()], value: 0 }];
}

// Helper to generate category data from POs
function generateCategoryData(pos: any[]) {
  if (pos.length === 0) return [];

  const categories: Record<string, number> = {};
  pos.forEach((po) => {
    const cat = po.category || "Other";
    categories[cat] = (categories[cat] || 0) + (po.totalAmount || 0);
  });

  return Object.entries(categories).map(([name, value]) => ({ name, value }));
}

interface Activity {
  id: string;
  title: string;
  vendor: string;
  status: string;
  time: string;
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const router = useRouter();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreatePO = hasPermission("po:create");
  const canApprovePO = hasPermission("po:approve");
  const canRejectPO = hasPermission("po:reject");

  // Redirect role-specific users away from the generic dashboard
  useEffect(() => {
    if (!user) return;
    const role = user.role || user.roleName;
    if (role === "VENDOR" || role === "AUDITOR") {
      router.replace(getDashboardByRole(role));
    }
  }, [user, router]);

  useEffect(() => {
    // Don't fetch if user is being redirected away
    if (!user) return;
    const role = user.role || user.roleName;
    if (role === "VENDOR" || role === "AUDITOR") return;
    loadDashboardData();
  }, [user]);

  // Generate activity feed from POs, RFQs and vendors
  function generateActivities(pos: any[], rfqList: any[], vendorList: any[]): Activity[] {
    const activities: Activity[] = [];

    // Add recent PO activities
    pos.slice(0, 5).forEach((po, idx) => {
      activities.push({
        id: `po-${po.id}-${idx}`,
        title: `PO ${po.poNumber || po.id} ${po.status?.toLowerCase()}`,
        vendor: po.vendorName || "Unknown Vendor",
        status: po.status?.toLowerCase().includes("approved") && !po.status?.toLowerCase().includes("pending") ? "approved" : po.status?.toLowerCase() === "delivered" ? "delivered" : "pending",
        time: po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "Recently"
      });
    });

    // Add recent RFQ activities
    rfqList.slice(0, 3).forEach((rfq, idx) => {
      activities.push({
        id: `rfq-${rfq.id}-${idx}`,
        title: `RFQ ${rfq.rfqNumber || rfq.id} created`,
        vendor: "Procurement Team",
        status: "pending",
        time: rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString() : "Recently"
      });
    });

    // Add vendor activities
    vendorList.filter(v => v.verified).slice(0, 2).forEach((vendor, idx) => {
      activities.push({
        id: `vendor-${vendor.id}-${idx}`,
        title: `Vendor ${vendor.companyName} verified`,
        vendor: vendor.companyName,
        status: "approved",
        time: "Recently"
      });
    });

    return activities.slice(0, 10);
  }

  async function loadDashboardData() {
    try {
      setLoading(true);
      const role = user?.role || user?.roleName;
      // VENDOR and AUDITOR are redirected away from this page; skip their API calls
      const canReadVendors = role && ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"].includes(role);
      const canReadAnalytics = role && ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"].includes(role);
      const canReadPOs = role && ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"].includes(role);
      const canReadRFQs = role && ["ADMIN", "OFFICER", "MANAGER", "AUDITOR"].includes(role);

      const [overview, vendorList, poList, rfqList, vendorMap] = await Promise.all([
        canReadAnalytics ? analyticsApi.getDashboard().catch(() => null) : Promise.resolve(null),
        canReadVendors ? vendorApi.getAllList().catch(() => []) : Promise.resolve([]),
        canReadPOs ? poApi.getAllList().catch(() => []) : Promise.resolve([]),
        canReadRFQs ? rfqApi.getAllList().catch(() => []) : Promise.resolve([]),
        getVendorNameMap(),
      ]) as [DashboardData | null, any[], any[], any[], Map<string, string>];

      // Normalise POs
      const normalisedPOs = poList.map((po: any) => ({
        ...po,
        id: String(po.id || po.poId),
        poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
        vendorName: po.vendorName || vendorMap?.get(String(po.vendorId || "")) || (po.vendorId ? `Vendor #${po.vendorId}` : "N/A"),
        createdAt: po.createdAt || po.issueDate,
        deliveryDate: po.deliveryDate || po.expectedDeliveryDate,
        totalAmount: Number(po.totalAmount) || 0,
      }));

      // Normalise RFQs
      const normalisedRFQs = rfqList.map((r: any) => ({
        ...r,
        id: String(r.id || r.rfqId),
        rfqNumber: r.rfqNumber || `RFQ-${String(r.rfqId || r.id).padStart(6, "0")}`,
      }));

      // Normalise vendors
      const normalisedVendors = vendorList.map((v: any) => ({
        ...v,
        id: String(v.id || v.vendorId),
        verified: v.verified ?? (v.complianceStatus === "Verified"),
      }));

      if (overview) setDashboardData(overview);
      setVendors(normalisedVendors);
      setPurchaseOrders(normalisedPOs);
      setRfqs(normalisedRFQs);
      setActivities(generateActivities(normalisedPOs, normalisedRFQs, normalisedVendors));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprovePO(poId: string) {
    try {
      await poApi.approve(poId);
      toast({ title: "Success", description: "Purchase order approved" });
      loadDashboardData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to approve PO",
        variant: "destructive"
      });
    }
  }

  async function handleRejectPO(poId: string) {
    try {
      await poApi.reject(poId);
      toast({ title: "Success", description: "Purchase order rejected" });
      loadDashboardData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reject PO",
        variant: "destructive"
      });
    }
  }

  const metrics = [
    { label: "Total RFQs", value: dashboardData?.totalRFQs ?? rfqs.length, sub: "requests for quotation", icon: TrendingUp, loading },
    { label: "Active Vendors", value: dashboardData?.vendorCount ?? vendors.length, sub: "registered suppliers", icon: Users, loading },
    { label: "Purchase Orders", value: dashboardData?.totalPOs ?? purchaseOrders.length, sub: "all time", icon: ShoppingCart, loading },
    { label: "Pending Approvals", value: dashboardData?.pendingApprovals ?? purchaseOrders.filter(po => po.status?.toLowerCase().includes("pending")).length, sub: "awaiting action", icon: Clock, loading },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">Overview of procurement activities</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => router.push('/analytics')}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Reports
            </Button>
            {canCreatePO && (
              <Button size="sm" className="text-xs h-8" onClick={() => router.push('/procurement')}>
                <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                New PO
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-red-600 text-xs">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadDashboardData} className="mt-2 text-xs h-7">
              Retry
            </Button>
          </div>
        )}

        {/* Flat Metric Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
          {metrics.map(({ label, value, sub, icon: Icon, loading }) => (
            <div key={label} className="px-4 py-3 flex items-center gap-3">
              <Icon className="h-4 w-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                {loading ? (
                  <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" />
                ) : (
                  <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
                )}
                {!loading && sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Spend Analysis</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={generateMonthlyData(purchaseOrders)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{fontSize: 11}} />
                  <YAxis tick={{fontSize: 11}} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1a73e8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Spend by Category</p>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={generateCategoryData(purchaseOrders)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(generateCategoryData(purchaseOrders)).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend fontSize={11} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Activity and Approvals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Recent Activity */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Recent Activity</p>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-xs">No recent activity.</p>
                ) : (
                  activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-1.5 ${
                      activity.status === "approved" ? "bg-emerald-100" :
                      activity.status === "delivered" ? "bg-blue-100" :
                      activity.status === "paid" ? "bg-emerald-100" :
                      "bg-amber-100"
                    }`}>
                      {activity.status === "approved" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
                       activity.status === "delivered" ? <Package className="h-3.5 w-3.5 text-blue-600" /> :
                       activity.status === "paid" ? <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> :
                       <Clock className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">{activity.title}</p>
                      <p className="text-[10px] text-gray-500">{activity.vendor} • {activity.time}</p>
                    </div>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      activity.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      activity.status === "delivered" ? "bg-blue-100 text-blue-700" :
                      activity.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                ))
                )}
              </div>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Pending Approvals</p>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {purchaseOrders.filter(po => po.status?.toLowerCase().includes("pending")).length === 0 ? (
                  <p className="text-gray-500 text-xs">No pending approvals.</p>
                ) : (
                  purchaseOrders.filter(po => po.status?.toLowerCase().includes("pending")).slice(0, 5).map((po) => (
                    <div key={po.id} className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-gray-900">{po.description || po.title || "PO #" + po.poNumber}</p>
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">PENDING</span>
                        </div>
                        <p className="text-[10px] text-gray-500">Purchase Order • {po.vendorName || "Unknown Vendor"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-900">${po.totalAmount?.toLocaleString() || 0}</p>
                        <div className="flex gap-1 mt-1">
                          {canRejectPO && <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleRejectPO(po.id)}>Reject</Button>}
                          {canApprovePO && <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => handleApprovePO(po.id)}>Approve</Button>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-8" asChild>
                <Link href="/procurement">View All Pending</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">Quick Actions</p>
          </div>
          <div className="p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {canCreatePO && (
                <Button variant="outline" size="sm" className="justify-start text-xs h-8" onClick={() => router.push('/procurement')}>
                  <ShoppingCart className="mr-2 h-3.5 w-3.5" />
                  Create Purchase Order
                </Button>
              )}
              {hasPermission("vendors:create") && (
                <Button variant="outline" size="sm" className="justify-start text-xs h-8" onClick={() => router.push('/vendors')}>
                  <Users className="mr-2 h-3.5 w-3.5" />
                  Add New Vendor
                </Button>
              )}
              {hasPermission("inventory:update") && (
                <Button variant="outline" size="sm" className="justify-start text-xs h-8" onClick={() => router.push('/inventory')}>
                  <Package className="mr-2 h-3.5 w-3.5" />
                  Update Inventory
                </Button>
              )}
              {hasPermission("analytics:read") && (
                <Button variant="outline" size="sm" className="justify-start text-xs h-8" onClick={() => router.push('/analytics')}>
                  <TrendingUp className="mr-2 h-3.5 w-3.5" />
                  View Reports
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
