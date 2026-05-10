"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts";
import { scoringApi, vendorApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { RequireRole } from "@/components/require-role";
import {
  TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Search, Loader2, Star,
} from "lucide-react";

interface VendorScore {
  vendorId: string;
  vendorName?: string;
  companyName?: string;
  overallScore: number;
  timelinessScore?: number;
  qualityScore?: number;
  costScore?: number;
  responsivenessScore?: number;
  riskLevel?: string;
  calculatedAt?: string;
}

function riskVariant(level?: string) {
  switch (level?.toUpperCase()) {
    case "LOW": return "success";
    case "MEDIUM": return "warning";
    case "HIGH": return "destructive";
    default: return "secondary";
  }
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

export default function VendorPerformancePage() {
  const [scores, setScores] = useState<VendorScore[]>([]);
  const [filteredScores, setFilteredScores] = useState<VendorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [recalcLoading, setRecalcLoading] = useState<string | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailScore, setDetailScore] = useState<VendorScore | null>(null);

  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isVendor = user?.role === "VENDOR" || user?.roleName === "VENDOR";
  const canRecalculate = hasPermission("vendors:verify"); // officer/admin can trigger

  async function loadScores() {
    try {
      setLoading(true);
      let data: any[] = [];

      if (isVendor) {
        // Vendor sees only their own score
        const vendorId = user?.id || user?.userId;
        if (vendorId) {
          const vendorScores = await scoringApi.getByVendor(vendorId).catch(() => []);
          data = vendorScores;
        }
      } else {
        // Internal roles see the full ranking
        data = await scoringApi.getRanking().catch(() => []);
      }

      // Enrich with vendor names if missing
      const normalised: VendorScore[] = (data as any[]).map((s: any) => ({
        vendorId: String(s.vendorId || s.id),
        vendorName: s.vendorName || s.companyName || `Vendor #${s.vendorId}`,
        companyName: s.companyName || s.vendorName,
        overallScore: Math.round(Number(s.overallScore ?? s.finalScore ?? s.score ?? 0)),
        timelinessScore: Math.round(Number(s.timelinessScore ?? 0)),
        qualityScore: Math.round(Number(s.qualityScore ?? 0)),
        costScore: Math.round(Number(s.costScore ?? 0)),
        responsivenessScore: Math.round(Number(s.responsivenessScore ?? 0)),
        riskLevel: s.riskLevel || (
          (s.overallScore ?? s.finalScore ?? 0) >= 80 ? "LOW" :
          (s.overallScore ?? s.finalScore ?? 0) >= 60 ? "MEDIUM" : "HIGH"
        ),
        calculatedAt: s.calculatedAt || s.updatedAt,
      }));

      setScores(normalised);
      setFilteredScores(normalised);
    } catch {
      setScores([]);
      setFilteredScores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"])) return;
    loadScores();
  }, [user, hasRole]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredScores(scores);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredScores(
        scores.filter(
          (s) =>
            s.vendorName?.toLowerCase().includes(q) ||
            s.riskLevel?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, scores]);

  async function handleRecalculate(vendorId: string, vendorName: string) {
    try {
      setRecalcLoading(vendorId);
      await scoringApi.calculate(vendorId);
      toast({ title: "Score Recalculated", description: `${vendorName}'s score has been updated.` });
      loadScores();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to recalculate score",
        variant: "destructive",
      });
    } finally {
      setRecalcLoading(null);
    }
  }

  const avgScore = scores.length
    ? Math.round(scores.reduce((s, v) => s + v.overallScore, 0) / scores.length)
    : 0;
  const highRisk = scores.filter((s) => s.riskLevel?.toUpperCase() === "HIGH").length;
  const lowRisk = scores.filter((s) => s.riskLevel?.toUpperCase() === "LOW").length;

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Vendor Performance</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {isVendor ? "Your performance scores and risk classification" : "Vendor scoring, risk levels, and KPI breakdown"}
              </p>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={loadScores}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {/* Stats (internal roles only) */}
          {!isVendor && (
            <div className="grid grid-cols-4 gap-3">
              <Card className="border-0 shadow-sm bg-gray-50">
                <CardContent className="p-3">
                  <p className="text-xs text-gray-500">Vendors Scored</p>
                  <p className="text-xl font-semibold text-gray-700 mt-1">{loading ? "â€â€" : scores.length}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-blue-50">
                <CardContent className="p-3">
                  <p className="text-xs text-blue-600">Avg Score</p>
                  <p className={`text-xl font-semibold mt-1 ${scoreColor(avgScore)}`}>{loading ? "â€â€" : `${avgScore}%`}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-emerald-50">
                <CardContent className="p-3">
                  <p className="text-xs text-emerald-600">Low Risk</p>
                  <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "â€â€" : lowRisk}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-red-50">
                <CardContent className="p-3">
                  <p className="text-xs text-red-600">High Risk</p>
                  <p className="text-xl font-semibold text-red-700 mt-1">{loading ? "â€â€" : highRisk}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Vendor's own scorecard */}
          {isVendor && scores.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {/* Score breakdown */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 px-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-medium text-gray-700">Your Score Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {[
                    { label: "Overall Score", value: scores[0].overallScore, weight: null },
                    { label: "Timeliness (35%)", value: scores[0].timelinessScore ?? 0, weight: 35 },
                    { label: "Quality (35%)", value: scores[0].qualityScore ?? 0, weight: 35 },
                    { label: "Cost Competitiveness (20%)", value: scores[0].costScore ?? 0, weight: 20 },
                    { label: "Responsiveness (10%)", value: scores[0].responsivenessScore ?? 0, weight: 10 },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-600">{label}</span>
                        <span className={`text-xs font-semibold ${scoreColor(value)}`}>{value}%</span>
                      </div>
                      <Progress value={value} className="h-1.5" />
                    </div>
                  ))}
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Risk Level:</span>
                    <Badge variant={riskVariant(scores[0].riskLevel)} className="text-[10px]">
                      {scores[0].riskLevel || "N/A"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Radar chart */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="py-3 px-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-medium text-gray-700">KPI Radar</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={[
                      { metric: "Timeliness", score: scores[0].timelinessScore ?? 0 },
                      { metric: "Quality", score: scores[0].qualityScore ?? 0 },
                      { metric: "Cost", score: scores[0].costScore ?? 0 },
                      { metric: "Responsiveness", score: scores[0].responsivenessScore ?? 0 },
                    ]}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="Score" dataKey="score" stroke="#1a73e8" fill="#1a73e8" fillOpacity={0.25} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Ranking table (internal roles) */}
          {!isVendor && (
            <>
              {/* Bar chart */}
              {scores.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="py-3 px-4 border-b border-gray-100">
                    <CardTitle className="text-sm font-medium text-gray-700">Score Ranking</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={scores.slice(0, 10).map((s) => ({
                        name: (s.vendorName || "").substring(0, 12),
                        score: s.overallScore,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="score" name="Score" fill="#1a73e8" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card className="border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-medium text-gray-700">Vendor Scoreboard</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Search vendors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-[200px] h-8 text-xs border-gray-200"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-gray-100 hover:bg-transparent">
                          <TableHead className="text-xs font-medium text-gray-500 py-2 w-8">#</TableHead>
                          <TableHead className="text-xs font-medium text-gray-500 py-2">Vendor</TableHead>
                          <TableHead className="text-xs font-medium text-gray-500 py-2">Overall</TableHead>
                          <TableHead className="text-xs font-medium text-gray-500 py-2">Timeliness</TableHead>
                          <TableHead className="text-xs font-medium text-gray-500 py-2">Quality</TableHead>
                          <TableHead className="text-xs font-medium text-gray-500 py-2">Cost</TableHead>
                          <TableHead className="text-xs font-medium text-gray-500 py-2">Responsiveness</TableHead>
                          <TableHead className="text-xs font-medium text-gray-500 py-2">Risk</TableHead>
                          <TableHead className="text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredScores.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-10 text-gray-500 text-xs">
                              No vendor scores found. Scores are calculated automatically after each delivery.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredScores.map((s, idx) => (
                            <TableRow key={s.vendorId} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <TableCell className="text-xs text-gray-400 py-2.5 font-medium">{idx + 1}</TableCell>
                              <TableCell className="py-2.5">
                                <p className="text-xs font-medium text-gray-900">{s.vendorName}</p>
                                {s.calculatedAt && (
                                  <p className="text-[10px] text-gray-400">
                                    Updated {new Date(s.calculatedAt).toLocaleDateString()}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <Progress value={s.overallScore} className="w-16 h-1.5" />
                                  <span className={`text-xs font-semibold ${scoreColor(s.overallScore)}`}>
                                    {s.overallScore}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className={`text-xs py-2.5 ${scoreColor(s.timelinessScore ?? 0)}`}>
                                {s.timelinessScore ?? "â€â€"}%
                              </TableCell>
                              <TableCell className={`text-xs py-2.5 ${scoreColor(s.qualityScore ?? 0)}`}>
                                {s.qualityScore ?? "â€â€"}%
                              </TableCell>
                              <TableCell className={`text-xs py-2.5 ${scoreColor(s.costScore ?? 0)}`}>
                                {s.costScore ?? "â€â€"}%
                              </TableCell>
                              <TableCell className={`text-xs py-2.5 ${scoreColor(s.responsivenessScore ?? 0)}`}>
                                {s.responsivenessScore ?? "â€â€"}%
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge variant={riskVariant(s.riskLevel)} className="text-[10px]">
                                  {s.riskLevel?.toUpperCase() === "HIGH" && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
                                  {s.riskLevel?.toUpperCase() === "LOW" && <CheckCircle className="h-2.5 w-2.5 mr-1" />}
                                  {s.riskLevel || "N/A"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs px-2"
                                    onClick={() => { setDetailScore(s); setDetailOpen(true); }}
                                  >
                                    Details
                                  </Button>
                                  {canRecalculate && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs px-2"
                                      disabled={recalcLoading === s.vendorId}
                                      onClick={() => handleRecalculate(s.vendorId, s.vendorName || "")}
                                      title="Recalculate score"
                                    >
                                      {recalcLoading === s.vendorId
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <RefreshCw className="h-3 w-3" />}
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* ââ€€ââ€€ Vendor Detail Dialog ââ€€ââ€€ */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{detailScore?.vendorName} â€â€ Performance Detail</DialogTitle>
              <DialogDescription>Full KPI breakdown and risk classification</DialogDescription>
            </DialogHeader>
            {detailScore && (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">Overall Score</p>
                    <p className={`text-3xl font-bold ${scoreColor(detailScore.overallScore)}`}>
                      {detailScore.overallScore}%
                    </p>
                  </div>
                  <Badge variant={riskVariant(detailScore.riskLevel)} className="text-sm px-3 py-1">
                    {detailScore.riskLevel?.toUpperCase() === "HIGH" && <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
                    {detailScore.riskLevel?.toUpperCase() === "LOW" && <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                    {detailScore.riskLevel || "N/A"} RISK
                  </Badge>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Timeliness", value: detailScore.timelinessScore ?? 0, weight: "35%", desc: "On-time delivery performance" },
                    { label: "Quality", value: detailScore.qualityScore ?? 0, weight: "35%", desc: "Accepted quantity vs total delivered" },
                    { label: "Cost Competitiveness", value: detailScore.costScore ?? 0, weight: "20%", desc: "Bid price vs lowest bid" },
                    { label: "Responsiveness", value: detailScore.responsivenessScore ?? 0, weight: "10%", desc: "On-time responses to RFQs" },
                  ].map(({ label, value, weight, desc }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <div>
                          <span className="text-xs font-medium text-gray-700">{label}</span>
                          <span className="text-[10px] text-gray-400 ml-1.5">weight {weight}</span>
                        </div>
                        <span className={`text-xs font-semibold ${scoreColor(value)}`}>{value}%</span>
                      </div>
                      <Progress value={value} className="h-2" />
                      <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={[
                    { metric: "Timeliness", score: detailScore.timelinessScore ?? 0 },
                    { metric: "Quality", score: detailScore.qualityScore ?? 0 },
                    { metric: "Cost", score: detailScore.costScore ?? 0 },
                    { metric: "Responsiveness", score: detailScore.responsivenessScore ?? 0 },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="Score" dataKey="score" stroke="#1a73e8" fill="#1a73e8" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>

                {detailScore.calculatedAt && (
                  <p className="text-[10px] text-gray-400 text-right">
                    Last calculated: {new Date(detailScore.calculatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Close</Button>
              {canRecalculate && detailScore && (
                <Button
                  size="sm"
                  disabled={recalcLoading === detailScore.vendorId}
                  onClick={() => {
                    handleRecalculate(detailScore.vendorId, detailScore.vendorName || "");
                    setDetailOpen(false);
                  }}
                >
                  {recalcLoading === detailScore.vendorId
                    ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                  Recalculate Score
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}
