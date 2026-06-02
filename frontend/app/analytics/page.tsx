"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";
import { Download, Loader2, DollarSign, TrendingUp, ShoppingCart, Users } from "lucide-react";
import { poApi, vendorApi, getVendorNameMap, rfqApi, analyticsApi } from "@/lib/api";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";

const CHART_COLORS = ["#67C090", "#4A9A6D", "#8FD9B6", "#2D6A4F", "#95D5B2"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type DateRange = "3m" | "6m" | "12m" | "all";

function filterByRange(items: any[], range: DateRange): any[] {
  if (range === "all") return items;
  const now = new Date();
  const months = range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return items.filter((po) => po.createdAt && new Date(po.createdAt) >= cutoff);
}

function generateMonthlySpendData(pos: any[]) {
  const monthlyData: Record<string, number> = {};
  pos.forEach((po) => {
    if (po.createdAt) {
      const d = new Date(po.createdAt);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      monthlyData[key] = (monthlyData[key] || 0) + (po.totalAmount || 0);
    }
  });
  // Sort chronologically
  return Object.entries(monthlyData)
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => {
      const [ma, ya] = a.month.split(" ");
      const [mb, yb] = b.month.split(" ");
      return new Date(`${ma} 1 ${ya}`).getTime() - new Date(`${mb} 1 ${yb}`).getTime();
    });
}

function generateVendorSpendData(pos: any[], vendorMap: Map<string, string>) {
  const vendorSpend: Record<string, number> = {};
  let totalSpend = 0;
  pos.forEach((po) => {
    const name = po.vendorName || vendorMap.get(String(po.vendorId || "")) || "Unknown";
    vendorSpend[name] = (vendorSpend[name] || 0) + (po.totalAmount || 0);
    totalSpend += po.totalAmount || 0;
  });
  if (totalSpend === 0) return [];
  return Object.entries(vendorSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, spend]) => ({
      name,
      spend,
      pct: Math.round((spend / totalSpend) * 100),
    }));
}

function generateCategoryData(pos: any[], rfqCategoryMap: Map<number, string>) {
  const cats: Record<string, { spend: number; orders: number }> = {};
  pos.forEach((po) => {
    const cat = rfqCategoryMap.get(Number(po.rfqId)) || po.category || "Uncategorized";
    if (!cats[cat]) cats[cat] = { spend: 0, orders: 0 };
    cats[cat].spend += po.totalAmount || 0;
    cats[cat].orders += 1;
  });
  return Object.entries(cats).map(([name, d]) => ({ name, spend: d.spend, orders: d.orders }));
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
      {message}
    </div>
  );
}

export default function AnalyticsPage() {
  const [allPos, setAllPos] = useState<any[]>([]);
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [vendorMap, setVendorMap] = useState<Map<string, string>>(new Map());
  const [rfqCategoryMap, setRfqCategoryMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("6m");
  const [serverStats, setServerStats] = useState<any>(null);
  const hasRole = useAuthStore((state) => state.hasRole);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"])) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        // Load server-aggregated stats and raw data in parallel
        const [pos, vendors, vMap, rfqs, overview, spendReport] = await Promise.all([
          poApi.getAllList().catch(() => []),
          vendorApi.getAllList().catch(() => []),
          getVendorNameMap(),
          rfqApi.getAllList().catch(() => []),
          analyticsApi.getDashboard().catch(() => null),
          analyticsApi.getSpendReport().catch(() => null),
        ]);
        setAllPos(pos as any[]);
        setAllVendors(vendors as any[]);
        setVendorMap(vMap);
        if (overview || spendReport) {
          setServerStats({ ...overview, ...spendReport });
        }

        const rfqMap = new Map<number, string>();
        (rfqs as any[]).forEach((rfq: any) => {
          const id = Number(rfq.rfqId || rfq.id);
          const name = rfq.categoryName || rfq.category;
          if (id && name) rfqMap.set(id, name);
        });
        setRfqCategoryMap(rfqMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hasRole]);

  const filteredPos = useMemo(() => filterByRange(allPos, dateRange), [allPos, dateRange]);

  const stats = useMemo(() => {
    const totalSpend = filteredPos.reduce((s, po) => s + (po.totalAmount || 0), 0);
    const activeVendors = serverStats?.activeVendors
      ?? allVendors.filter((v) => v.status === "ACTIVE").length;

    // YoY growth: compare filtered period to same-length period prior
    const now = new Date();
    const months = dateRange === "3m" ? 3 : dateRange === "6m" ? 6 : 12;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
    const prevCutoff = new Date(now.getFullYear(), now.getMonth() - months * 2, 1);
    const currentSpend = allPos
      .filter((po) => po.createdAt && new Date(po.createdAt) >= cutoff)
      .reduce((s, po) => s + (po.totalAmount || 0), 0);
    const prevSpend = allPos
      .filter((po) => {
        if (!po.createdAt) return false;
        const d = new Date(po.createdAt);
        return d >= prevCutoff && d < cutoff;
      })
      .reduce((s, po) => s + (po.totalAmount || 0), 0);
    const yoy = prevSpend > 0 ? Math.round(((currentSpend - prevSpend) / prevSpend) * 1000) / 10 : 0;

    // For "all time" view, prefer server-aggregated totals (cached, accurate even beyond 200-item page)
    const resolvedSpend = dateRange === "all" && serverStats?.totalApprovedSpend != null
      ? serverStats.totalApprovedSpend
      : totalSpend;
    const resolvedOrders = dateRange === "all" && serverStats?.totalPOs != null
      ? serverStats.totalPOs
      : filteredPos.length;

    return { totalSpend: resolvedSpend, totalOrders: resolvedOrders, activeVendors, yoy };
  }, [filteredPos, allPos, allVendors, dateRange, serverStats]);

  const spendData = useMemo(() => generateMonthlySpendData(filteredPos), [filteredPos]);
  const vendorData = useMemo(() => generateVendorSpendData(filteredPos, vendorMap), [filteredPos, vendorMap]);
  const categoryData = useMemo(() => generateCategoryData(filteredPos, rfqCategoryMap), [filteredPos, rfqCategoryMap]);

  const formatCurrency = (val: number) =>
    val >= 1_000_000 ? `$${(val / 1_000_000).toFixed(1)}M`
    : val >= 1_000 ? `$${(val / 1_000).toFixed(0)}K`
    : `$${val}`;

  function handleExport() {
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Total Spend", "$" + stats.totalSpend.toLocaleString()],
      ["Total Orders", String(stats.totalOrders)],
      ["Active Vendors", String(stats.activeVendors)],
      ["Period Growth", stats.yoy + "%"],
      [],
      ["Month", "Spend ($)"],
      ...spendData.map((d) => [d.month, String(d.value)]),
      [],
      ["Vendor", "Spend ($)", "Share %"],
      ...vendorData.map((d) => [d.name, String(d.spend), d.pct + "%"]),
      [],
      ["Category", "Spend ($)", "Orders"],
      ...categoryData.map((d) => [d.name, "$" + d.spend.toLocaleString(), String(d.orders)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
              <p className="text-xs text-gray-500 mt-0.5">Procurement insights and spend analysis</p>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3m">Last 3 months</SelectItem>
                  <SelectItem value="6m">Last 6 months</SelectItem>
                  <SelectItem value="12m">Last 12 months</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport} disabled={loading}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          </div>

          {error && (
            <div className="border-l-4 border-red-400 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Flat Metric Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {[
              { label: "Total Spend", value: formatCurrency(stats.totalSpend), sub: "Approved orders", icon: DollarSign },
              { label: "Period Growth", value: stats.yoy > 0 ? `+${stats.yoy}%` : `${stats.yoy}%`, sub: "vs. prior period", icon: TrendingUp },
              { label: "Total Orders", value: String(stats.totalOrders), sub: "In selected range", icon: ShoppingCart },
              { label: "Active Vendors", value: String(stats.activeVendors), sub: "Approved suppliers", icon: Users },
            ].map(({ label, value, sub, icon: Icon }) => (
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

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Tabs defaultValue="spend">
              <TabsList>
                <TabsTrigger value="spend">Spend Over Time</TabsTrigger>
                <TabsTrigger value="vendors">By Vendor</TabsTrigger>
                <TabsTrigger value="categories">By Category</TabsTrigger>
              </TabsList>

              {/* Spend Over Time */}
              <TabsContent value="spend">
                <div className="border border-gray-200 rounded overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-700">Monthly Spend</p>
                    <p className="text-xs text-gray-400 mt-0.5">Total procurement spend per month</p>
                  </div>
                  <div className="p-4">
                    {spendData.length === 0 ? (
                      <EmptyChart message="No spend data for the selected period." />
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={spendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                          <Tooltip formatter={(v: number) => ["$" + v.toLocaleString(), "Spend"]} />
                          <Area
                            type="monotone"
                            dataKey="value"
                            name="Spend"
                            stroke="#1a73e8"
                            fill="#1a73e8"
                            fillOpacity={0.15}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* By Vendor */}
              <TabsContent value="vendors">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-700">Spend Share by Vendor</p>
                    </div>
                    <div className="p-4">
                      {vendorData.length === 0 ? (
                        <EmptyChart message="No vendor data for selected period." />
                      ) : (
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={vendorData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="pct"
                              label={({ name, pct }) => `${name} ${pct}%`}
                              labelLine={false}
                            >
                              {vendorData.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => [`${v}%`, "Share"]} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-700">Top Vendors by Spend</p>
                    </div>
                    <div className="p-4">
                      {vendorData.length === 0 ? (
                        <p className="text-xs text-gray-400 py-4 text-center">No data for selected period.</p>
                      ) : (
                        <div className="space-y-3">
                          {vendorData.map((v, i) => (
                            <div key={v.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                >
                                  {i + 1}
                                </div>
                                <span className="text-xs font-medium truncate">{v.name}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-gray-500">{formatCurrency(v.spend)}</span>
                                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${v.pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400 w-8 text-right">{v.pct}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* By Category */}
              <TabsContent value="categories">
                <div className="border border-gray-200 rounded overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-700">Spend & Orders by Category</p>
                    <p className="text-xs text-gray-400 mt-0.5">Procurement breakdown by category</p>
                  </div>
                  <div className="p-4">
                    {categoryData.length === 0 ? (
                      <EmptyChart message="No category data for selected period." />
                    ) : (
                      <ResponsiveContainer width="100%" height={360}>
                        <BarChart data={categoryData} margin={{ bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(v: number, name: string) =>
                              name === "spend" ? ["$" + v.toLocaleString(), "Spend"] : [v, "Orders"]
                            }
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar yAxisId="left" dataKey="spend" name="Spend ($)" fill="#1a73e8" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#67C090" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
