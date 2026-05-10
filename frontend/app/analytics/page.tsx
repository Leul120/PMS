"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { Download, TrendingUp, DollarSign, Users, ShoppingCart } from "lucide-react";
import { poApi, vendorApi } from "@/lib/api";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";

// Helper functions to generate chart data from API responses
function generateMonthlySpendData(pos: any[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyData = months.map(month => ({ month, value: 0 }));
  
  pos.forEach((po) => {
    if (po.createdAt) {
      const date = new Date(po.createdAt);
      const monthIndex = date.getMonth();
      monthlyData[monthIndex].value += po.totalAmount || 0;
    }
  });
  
  // Only return months with data or up to current month
  const currentMonth = new Date().getMonth();
  return monthlyData.slice(0, Math.max(currentMonth + 1, monthlyData.findIndex(m => m.value > 0) + 1));
}

function generateVendorSpendData(pos: any[]) {
  const vendorSpend: Record<string, number> = {};
  let totalSpend = 0;
  
  pos.forEach((po) => {
    const vendorName = po.vendorName || "Unknown";
    vendorSpend[vendorName] = (vendorSpend[vendorName] || 0) + (po.totalAmount || 0);
    totalSpend += po.totalAmount || 0;
  });
  
  if (totalSpend === 0) return [];
  
  const sorted = Object.entries(vendorSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
  return sorted.map(([name, spend]) => ({
    name,
    value: Math.round((spend / totalSpend) * 100),
    spend
  }));
}

function generateCategoryData(pos: any[]) {
  const categories: Record<string, { spend: number; orders: number }> = {};
  
  pos.forEach((po) => {
    const category = po.category || "Uncategorized";
    if (!categories[category]) {
      categories[category] = { spend: 0, orders: 0 };
    }
    categories[category].spend += po.totalAmount || 0;
    categories[category].orders += 1;
  });
  
  return Object.entries(categories).map(([name, data]) => ({
    name,
    spend: data.spend,
    orders: data.orders
  }));
}

const CHART_COLORS = ["#67C090", "#4A9A6D", "#8FD9B6", "#2D6A4F", "#95D5B2"];

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalSpend: 0,
    totalOrders: 0,
    activeVendors: 0,
    yoyGrowth: 0,
  });
  const [spendData, setSpendData] = useState<any[]>([]);
  const [vendorData, setVendorData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const hasRole = useAuthStore((state) => state.hasRole);

  useEffect(() => {
    // Only fetch if user has access -- avoids 400/403 errors for unauthorized roles
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR"])) {
      setLoading(false);
      return;
    }
    async function loadStats() {
      try {
        const [pos, vendors] = await Promise.all([
          poApi.getAllList().catch(() => []),
          vendorApi.getAllList().catch(() => []),
        ]);
        const totalSpend = pos.reduce((sum: number, po: any) => sum + (po.totalAmount || 0), 0);
        
        // Calculate YoY growth (compare last 6 months to same period previous year)
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        const lastYearSamePeriod = new Date(now.getFullYear() - 1, now.getMonth() - 6, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        
        const currentPeriodSpend = pos
          .filter(po => po.createdAt && new Date(po.createdAt) >= sixMonthsAgo)
          .reduce((sum, po) => sum + (po.totalAmount || 0), 0);
          
        const previousPeriodSpend = pos
          .filter(po => {
            if (!po.createdAt) return false;
            const d = new Date(po.createdAt);
            return d >= lastYearSamePeriod && d < lastYearEnd;
          })
          .reduce((sum, po) => sum + (po.totalAmount || 0), 0);
          
        const yoyGrowth = previousPeriodSpend > 0 
          ? ((currentPeriodSpend - previousPeriodSpend) / previousPeriodSpend) * 100 
          : 0;
        
        setStats({
          totalSpend,
          totalOrders: pos.length,
          activeVendors: vendors.filter((v) => v.status === "ACTIVE").length,
          yoyGrowth: Math.round(yoyGrowth * 10) / 10,
        });
        
        // Generate chart data from real data
        setSpendData(generateMonthlySpendData(pos));
        setVendorData(generateVendorSpendData(pos));
        setCategoryData(generateCategoryData(pos));
      } catch (err) {
        // Silently handle errors - show empty state
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [hasRole]);

  const formatCurrency = (val: number) =>
    val >= 1000000
      ? `$${(val / 1000000).toFixed(1)}M`
      : val >= 1000
      ? `$${(val / 1000).toFixed(0)}K`
      : `$${val}`;

  function handleExport() {
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Total Spend YTD", "$" + stats.totalSpend.toLocaleString()],
      ["YoY Growth", stats.yoyGrowth + "%"],
      ["Total Orders", String(stats.totalOrders)],
      ["Active Vendors", String(stats.activeVendors)],
      [],
      ["Month", "Actual Spend"],
      ...spendData.map((d: any) => [String(d.month), String(d.value)]),
      [],
      ["Vendor", "Spend %"],
      ...vendorData.map((d: any) => [String(d.name), d.value + "%"]),
      [],
      ["Category", "Spend", "Orders"],
      ...categoryData.map((d: any) => [String(d.name), "$" + (d.spend ?? 0).toLocaleString(), String(d.orders)]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics-" + new Date().toISOString().split("T")[0] + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
            <p className="text-xs text-gray-500 mt-0.5">Procurement insights</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Total Spend YTD</p>
              <p className="text-xl font-semibold text-gray-700 mt-1">{loading ? "-" : formatCurrency(stats.totalSpend)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">YoY Growth</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">
                {loading ? "-" : stats.yoyGrowth > 0 ? `+${stats.yoyGrowth}%` : `${stats.yoyGrowth}%`}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3">
              <p className="text-xs text-blue-600">Total Orders</p>
              <p className="text-xl font-semibold text-blue-700 mt-1">{loading ? "-" : stats.totalOrders}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-violet-50">
            <CardContent className="p-3">
              <p className="text-xs text-violet-600">Active Vendors</p>
              <p className="text-xl font-semibold text-violet-700 mt-1">{loading ? "-" : stats.activeVendors}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="spend" className="space-y-3">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="spend" className="text-xs">Spend Analysis</TabsTrigger>
            <TabsTrigger value="vendors" className="text-xs">Vendor Performance</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="spend" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700">Monthly Spend</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={spendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{fontSize: 11}} />
                    <YAxis tick={{fontSize: 11}} />
                    <Tooltip />
                    <Legend fontSize={11} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      name="Actual Spend" 
                      stroke="#1a73e8" 
                      fill="#1a73e8" 
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 px-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-medium text-gray-700">Spend by Vendor</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={vendorData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {vendorData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 px-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-medium text-gray-700">Top Vendors</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {vendorData.slice(0, 5).map((vendor, index) => (
                      <div key={vendor.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          >
                            {index + 1}
                          </div>
                          <span className="font-medium">{vendor.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{vendor.value}%</span>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full"
                              style={{ 
                                width: `${vendor.value}%`, 
                                backgroundColor: CHART_COLORS[index % CHART_COLORS.length] 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Spend by Category</CardTitle>
                <CardDescription>Breakdown of procurement by category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="spend" name="Spend ($)" fill="hsl(221, 83%, 53%)" />
                    <Bar dataKey="orders" name="Order Count" fill="hsl(142, 76%, 36%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
    </RequireRole>
  );
}
