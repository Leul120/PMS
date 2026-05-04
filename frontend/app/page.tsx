"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Package, MoreHorizontal, ArrowUpRight, Clock, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { analyticsApi, poApi, rfqApi, vendorApi } from "@/lib/api";
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
  pendingApprovals: number[];
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

function StatCard({ title, value, icon: Icon, loading, color = "gray" }: any) {
  const colors: Record<string, string> = {
    gray: "bg-gray-50",
    emerald: "bg-emerald-50",
    blue: "bg-blue-50",
    amber: "bg-amber-50",
  };
  
  return (
    <Card className={`border-0 shadow-sm ${colors[color]}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{title}</p>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400 mt-1" />
            ) : (
              <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
            )}
          </div>
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [overview, vendorList, poList, rfqList] = await Promise.all([
        analyticsApi.getDashboard() as Promise<DashboardData>,
        vendorApi.getAll() as Promise<any[]>,
        poApi.getAll() as Promise<any[]>,
        rfqApi.getAll() as Promise<any[]>
      ]);
      setDashboardData(overview);
      setVendors(vendorList);
      setPurchaseOrders(poList);
      setRfqs(rfqList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-xs text-gray-500">Overview of procurement activities</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8">Download Report</Button>
            <Button size="sm" className="text-xs h-8">New Purchase Order</Button>
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

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            title="Total RFQs"
            value={dashboardData?.totalRFQs || rfqs.length}
            loading={loading}
            icon={TrendingUp}
            color="blue"
          />
          <StatCard
            title="Active Vendors"
            value={dashboardData?.vendorCount || vendors.length}
            loading={loading}
            icon={Users}
            color="emerald"
          />
          <StatCard
            title="Purchase Orders"
            value={dashboardData?.totalPOs || purchaseOrders.length}
            loading={loading}
            icon={ShoppingCart}
            color="gray"
          />
          <StatCard
            title="Pending Approvals"
            value={dashboardData?.pendingApprovals || purchaseOrders.filter(po => po.status === 'PENDING').length}
            loading={loading}
            icon={Package}
            color="amber"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-700">Spend Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={generateMonthlyData(purchaseOrders)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{fontSize: 11}} />
                  <YAxis tick={{fontSize: 11}} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1a73e8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-700">Spend by Category</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
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
            </CardContent>
          </Card>
        </div>

        {/* Activity and Approvals */}
        <div className="grid grid-cols-2 gap-3">
          {/* Recent Activity */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-700">Recent Activity</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {[].map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-1.5 ${
                      activity.status === "approved" ? "bg-emerald-100" :
                      activity.status === "delivered" ? "bg-blue-100" :
                      activity.status === "paid" ? "bg-emerald-100" :
                      "bg-amber-100"
                    }`}>
                      {activity.status === "approved" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> :
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
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-700">Pending Approvals</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {purchaseOrders.filter(po => po.status === "PENDING").length === 0 ? (
                  <p className="text-gray-500 text-xs">No pending approvals.</p>
                ) : (
                  purchaseOrders.filter(po => po.status === "PENDING").slice(0, 5).map((po) => (
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
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">Reject</Button>
                          <Button size="sm" className="h-6 text-[10px] px-2">Approve</Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href="/procurement">View All Pending</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Frequently used operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="justify-start">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Create Purchase Order
              </Button>
              <Button variant="outline" className="justify-start">
                <Users className="mr-2 h-4 w-4" />
                Add New Vendor
              </Button>
              <Button variant="outline" className="justify-start">
                <Package className="mr-2 h-4 w-4" />
                Update Inventory
              </Button>
              <Button variant="outline" className="justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Reports
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
