"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { scoringApi, vendorApi, getCompanyNameMap } from "@/lib/api";
import { displayVendorName } from "@/lib/display";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts";
import {
  Star, TrendingUp, AlertTriangle, CheckCircle, Search, RefreshCw, Loader2,
  ChevronUp, ChevronDown, Trophy, Shield, Clock, DollarSign, MessageSquare,
} from "lucide-react";

interface VendorScore {
  vendorId: string;
  companyName: string;
  overallScore: number;
  timeliness: number;
  quality: number;
  cost: number;
  responsiveness: number;
  riskLevel: string;
  deliveryCount?: number;
  lastUpdated?: string;
}

const RISK_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  LOW: { label: "Low Risk", color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  MEDIUM: { label: "Medium Risk", color: "bg-amber-100 text-amber-800", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  HIGH: { label: "High Risk", color: "bg-red-100 text-red-800", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{value?.toFixed(1) ?? "—"}</span>
    </div>
  );
}

type SortKey = "overallScore" | "timeliness" | "quality" | "cost" | "responsiveness" | "companyName";

export default function PerformancePage() {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isVendor = hasRole(["VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE"]);

  const [scores, setScores] = useState<VendorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState<string | null>(null);
  const [recalculatingAll, setRecalculatingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overallScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [detailVendor, setDetailVendor] = useState<VendorScore | null>(null);
  const [myScore, setMyScore] = useState<VendorScore | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      if (isVendor) {
        // Vendor: look up own vendor profile then fetch their score
        const userId = user?.userId || user?.id;
        if (!userId) return;
        const profile = await vendorApi.getByUserId(userId).catch(() => null);
        const vid = profile?.vendorId || profile?.id;
        if (!vid) return;
        const perf = await scoringApi.getPerformance(vid).catch(() => null);
        if (perf) {
          const s = normaliseScore({ ...perf, vendorId: vid, companyName: profile?.companyName || "My Company" });
          setMyScore(s);
          setScores([s]);
        }
      } else {
        // Admin/Manager/Officer/Auditor: fetch full ranking + vendor names
        const [ranking, vendorNameMap] = await Promise.all([
          scoringApi.getRanking().catch(() => []),
          getCompanyNameMap(),
        ]);
        setScores((ranking as any[]).map((r) => normaliseScore(r, vendorNameMap)));
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to load performance data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function normaliseScore(raw: any, vendorNameMap?: Map<string, string>): VendorScore {
    const vendorId = String(raw.vendorId || raw.id || "");
    return {
      vendorId,
      companyName: displayVendorName(vendorId, { name: raw.companyName, map: vendorNameMap }),
      overallScore: Number(raw.overallScore ?? raw.weightedScore ?? raw.finalWeightedScore ?? raw.score ?? 0),
      timeliness: Number(raw.timeliness ?? raw.timelinessScore ?? 0),
      quality: Number(raw.quality ?? raw.qualityScore ?? 0),
      cost: Number(raw.cost ?? raw.costScore ?? 0),
      responsiveness: Number(raw.responsiveness ?? raw.responsivenessScore ?? 0),
      riskLevel: (raw.riskLevel || "MEDIUM").toUpperCase(),
      deliveryCount: raw.deliveryCount,
      lastUpdated: raw.lastUpdated || raw.calculatedAt,
    };
  }

  async function handleRecalculateAll() {
    setRecalculatingAll(true);
    try {
      const result = await scoringApi.recalculateAll();
      toast({
        title: "All Scores Recalculated",
        description: `${result.vendorsProcessed} vendor score(s) have been updated.`,
      });
      await load();
    } catch {
      toast({ title: "Error", description: "Failed to recalculate all scores.", variant: "destructive" });
    } finally {
      setRecalculatingAll(false);
    }
  }

  async function handleRecalculate(vendorId: string) {
    setRecalculating(vendorId);
    try {
      const result = await scoringApi.calculate(vendorId);
      toast({ title: "Score Recalculated", description: result.message || "Vendor score has been updated." });
      await load();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to recalculate score.", variant: "destructive" });
    } finally {
      setRecalculating(null);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const filtered = useMemo(() => {
    let list = [...scores];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.companyName.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const av = sortKey === "companyName" ? a.companyName : (a[sortKey] as number);
      const bv = sortKey === "companyName" ? b.companyName : (b[sortKey] as number);
      if (typeof av === "string" && typeof bv === "string")
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [scores, searchQuery, sortKey, sortAsc]);

  const top5Chart = useMemo(
    () =>
      [...scores]
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 7)
        .map((s) => ({
          name: s.companyName.length > 12 ? s.companyName.slice(0, 12) + "…" : s.companyName,
          score: Number(s.overallScore.toFixed(1)),
        })),
    [scores]
  );

  const avgScore = scores.length ? scores.reduce((s, v) => s + v.overallScore, 0) / scores.length : 0;
  const highRisk = scores.filter((s) => s.riskLevel === "HIGH").length;
  const topPerformer = scores.length ? [...scores].sort((a, b) => b.overallScore - a.overallScore)[0] : null;

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="h-3 w-3 text-gray-300" />;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  const radarData = detailVendor
    ? [
        { metric: "Timeliness", value: detailVendor.timeliness, fullMark: 100 },
        { metric: "Quality", value: detailVendor.quality, fullMark: 100 },
        { metric: "Cost", value: detailVendor.cost, fullMark: 100 },
        { metric: "Responsiveness", value: detailVendor.responsiveness, fullMark: 100 },
      ]
    : [];

  // Vendor self-view
  if (isVendor) {
    return (
      <RequireRole allowedRoles={["VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"]}>
        <DashboardLayout>
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">My Performance</h1>
              <p className="text-xs text-gray-500 mt-0.5">Your vendor performance scorecard</p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !myScore ? (
              <div className="border border-gray-200 rounded py-12 text-center text-sm text-gray-500">
                No performance data available yet. Complete some orders to receive a score.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200 border border-gray-200 rounded">
                  {[
                    { label: "Overall Score", value: myScore.overallScore.toFixed(1), icon: Star, iconClass: "text-amber-500" },
                    { label: "Timeliness", value: myScore.timeliness.toFixed(1), icon: Clock, iconClass: "text-blue-500" },
                    { label: "Quality", value: myScore.quality.toFixed(1), icon: Shield, iconClass: "text-emerald-500" },
                    { label: "Cost Score", value: myScore.cost.toFixed(1), icon: DollarSign, iconClass: "text-purple-500" },
                  ].map(({ label, value, icon: Icon, iconClass }) => (
                    <div key={label} className="px-4 py-3 flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${iconClass} shrink-0`} />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                        <p className="text-lg font-semibold text-gray-900">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="flex items-center px-4 py-3 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-700">KPI Breakdown</span>
                    </div>
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={[
                          { metric: "Timeliness", value: myScore.timeliness },
                          { metric: "Quality", value: myScore.quality },
                          { metric: "Cost", value: myScore.cost },
                          { metric: "Responsiveness", value: myScore.responsiveness },
                        ]}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={false} />
                          <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="flex items-center px-4 py-3 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-700">Score Details</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {[
                        { label: "Timeliness", value: myScore.timeliness, icon: <Clock className="h-3.5 w-3.5 text-blue-500" /> },
                        { label: "Quality", value: myScore.quality, icon: <Shield className="h-3.5 w-3.5 text-emerald-500" /> },
                        { label: "Cost Efficiency", value: myScore.cost, icon: <DollarSign className="h-3.5 w-3.5 text-purple-500" /> },
                        { label: "Responsiveness", value: myScore.responsiveness, icon: <MessageSquare className="h-3.5 w-3.5 text-amber-500" /> },
                      ].map(({ label, value, icon }) => (
                        <div key={label}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {icon}
                            <span className="text-xs text-gray-600">{label}</span>
                          </div>
                          <ScoreBar value={value} />
                        </div>
                      ))}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Risk Level</span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${RISK_CONFIG[myScore.riskLevel]?.color || "bg-gray-100 text-gray-700"}`}>
                            {RISK_CONFIG[myScore.riskLevel]?.icon}
                            {RISK_CONFIG[myScore.riskLevel]?.label || myScore.riskLevel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DashboardLayout>
      </RequireRole>
    );
  }

  // Admin / Manager / Officer / Auditor view
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Vendor Performance</h1>
              <p className="text-xs text-gray-500 mt-0.5">Rankings, KPI scores, and risk levels</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 gap-1.5"
                onClick={handleRecalculateAll}
                disabled={loading || recalculatingAll || scores.length === 0}
              >
                {recalculatingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Recalc All
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200 border border-gray-200 rounded">
            {[
              { label: "Avg. Score", value: loading ? "—" : avgScore.toFixed(1), sub: "across all vendors", icon: Star, iconClass: "text-amber-500" },
              { label: "Total Vendors", value: loading ? "—" : String(scores.length), icon: TrendingUp, iconClass: "text-blue-500" },
              { label: "High Risk", value: loading ? "—" : String(highRisk), sub: "require attention", icon: AlertTriangle, iconClass: "text-red-500" },
              { label: "Top Performer", value: loading || !topPerformer ? "—" : topPerformer.companyName.split(" ")[0], sub: topPerformer ? `Score: ${topPerformer.overallScore.toFixed(1)}` : undefined, icon: Trophy, iconClass: "text-emerald-500" },
            ].map(({ label, value, sub, icon: Icon, iconClass }) => (
              <div key={label} className="px-4 py-3 flex items-center gap-3">
                <Icon className={`h-4 w-4 ${iconClass} shrink-0`} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                  <p className="text-lg font-semibold text-gray-900">{value}</p>
                  {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Hint when all scores are zero */}
          {!loading && scores.length > 0 && scores.every((s) => s.overallScore === 0) && (
            <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              All vendors currently have a score of 0. Scores are calculated automatically when deliveries are marked as completed, or you can trigger them manually using the <strong>Recalc All</strong> button above.
            </div>
          )}

          {/* Bar chart */}
          {!loading && top5Chart.length > 0 && (
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                  <span className="text-xs font-medium text-gray-700">Top {top5Chart.length} Vendors by Score</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Overall performance score (0–100)</p>
                </div>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={top5Chart} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 6 }}
                      formatter={(v: number) => [v.toFixed(1), "Score"]}
                    />
                    <Bar dataKey="score" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Rankings table */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-medium text-gray-700">Vendor Rankings</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Click a vendor to see full KPI breakdown</p>
              </div>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  {searchQuery ? (
                    "No vendors match your search."
                  ) : (
                    <div className="space-y-1">
                      <p>No performance data available yet.</p>
                      <p className="text-xs text-gray-400">Scores are calculated after deliveries are completed. Use "Recalc All" to trigger calculations.</p>
                    </div>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-8 text-center">#</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("companyName")}>
                          Vendor <SortIcon col="companyName" />
                        </button>
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("overallScore")}>
                          Overall <SortIcon col="overallScore" />
                        </button>
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("timeliness")}>
                          Timeliness <SortIcon col="timeliness" />
                        </button>
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("quality")}>
                          Quality <SortIcon col="quality" />
                        </button>
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("cost")}>
                          Cost <SortIcon col="cost" />
                        </button>
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("responsiveness")}>
                          Responsive <SortIcon col="responsiveness" />
                        </button>
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Risk</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((vendor, idx) => {
                      const rank = sortKey === "overallScore" && !sortAsc ? idx + 1 : null;
                      const risk = RISK_CONFIG[vendor.riskLevel] || RISK_CONFIG.MEDIUM;
                      return (
                        <TableRow
                          key={vendor.vendorId}
                          className="cursor-pointer hover:bg-gray-50 text-xs"
                          onClick={() => setDetailVendor(vendor)}
                        >
                          <TableCell className="text-center text-gray-400 font-medium">
                            {rank === 1 ? <Trophy className="h-3.5 w-3.5 text-amber-500 mx-auto" /> : rank || "—"}
                          </TableCell>
                          <TableCell className="font-medium">{vendor.companyName}</TableCell>
                          <TableCell>
                            <ScoreBar value={vendor.overallScore} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <ScoreBar value={vendor.timeliness} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <ScoreBar value={vendor.quality} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <ScoreBar value={vendor.cost} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <ScoreBar value={vendor.responsiveness} />
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${risk.color}`}>
                              {risk.icon}
                              {risk.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              disabled={recalculating === vendor.vendorId}
                              onClick={() => handleRecalculate(vendor.vendorId)}
                            >
                              {recalculating === vendor.vendorId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              <span className="ml-1 hidden sm:inline">Recalc</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!detailVendor} onOpenChange={(o) => !o && setDetailVendor(null)}>
          <DialogContent className="sm:max-w-[520px] rounded">
            <DialogHeader>
              <DialogTitle className="text-base">{detailVendor?.companyName}</DialogTitle>
              <DialogDescription className="text-xs">Performance KPI breakdown</DialogDescription>
            </DialogHeader>
            {detailVendor && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-gray-500">Overall Score</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-0.5">{detailVendor.overallScore.toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-gray-500">Risk Level</p>
                    <span className={`inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full font-medium ${RISK_CONFIG[detailVendor.riskLevel]?.color || "bg-gray-100 text-gray-700"}`}>
                      {RISK_CONFIG[detailVendor.riskLevel]?.icon}
                      {RISK_CONFIG[detailVendor.riskLevel]?.label || detailVendor.riskLevel}
                    </span>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} />
                    <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>

                <div className="space-y-3">
                  {[
                    { label: "Timeliness", value: detailVendor.timeliness, icon: <Clock className="h-3.5 w-3.5 text-blue-500" />, desc: "On-time delivery rate" },
                    { label: "Quality", value: detailVendor.quality, icon: <Shield className="h-3.5 w-3.5 text-emerald-500" />, desc: "Product & service quality" },
                    { label: "Cost Efficiency", value: detailVendor.cost, icon: <DollarSign className="h-3.5 w-3.5 text-purple-500" />, desc: "Competitive pricing" },
                    { label: "Responsiveness", value: detailVendor.responsiveness, icon: <MessageSquare className="h-3.5 w-3.5 text-amber-500" />, desc: "Communication & support" },
                  ].map(({ label, value, icon, desc }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {icon}
                          <span className="text-xs font-medium text-gray-700">{label}</span>
                          <span className="text-[10px] text-gray-400">— {desc}</span>
                        </div>
                      </div>
                      <ScoreBar value={value} />
                    </div>
                  ))}
                </div>

                {detailVendor.lastUpdated && (
                  <p className="text-[10px] text-gray-400">
                    Last calculated: {new Date(detailVendor.lastUpdated).toLocaleString()}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    disabled={recalculating === detailVendor.vendorId}
                    onClick={() => handleRecalculate(detailVendor.vendorId)}
                  >
                    {recalculating === detailVendor.vendorId ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3 w-3" />
                    )}
                    Recalculate Score
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setDetailVendor(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}
