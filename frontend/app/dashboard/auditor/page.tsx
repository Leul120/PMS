"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequireRole } from "@/components/require-role";
import { poApi, vendorApi, rfqApi, analyticsApi, auditApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import { Loader2, Eye, FileText, BarChart3, ClipboardCheck, AlertCircle, CheckCircle, Clock, Download, Search } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export default function AuditorDashboardPage() {
  const user = useAuthStore((state) => state.user);
  const hasRole = useAuthStore((state) => state.hasRole);
  const [stats, setStats] = useState({
    totalPOs: 0, totalVendors: 0, verifiedVendors: 0, complianceRate: 0,
    openRfqs: 0, disputedInvoices: 0,
  });
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [nonCompliantVendors, setNonCompliantVendors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasRole(["ADMIN", "AUDITOR"])) return;
    async function load() {
      try {
        setLoading(true);
        const [pos, vendors, rfqs] = await Promise.all([
          poApi.getAllList().catch(() => []),
          vendorApi.getAllList().catch(() => []),
          rfqApi.getAllList().catch(() => []),
        ]);

        const verified = vendors.filter((v: any) => v.verified || v.complianceStatus === "Verified");
        const complianceRate = vendors.length > 0
          ? Math.round((verified.length / vendors.length) * 100)
          : 0;
        const openRfqs = rfqs.filter((r: any) => r.status?.toUpperCase() === "OPEN").length;

        setStats({
          totalPOs: pos.length,
          totalVendors: vendors.length,
          verifiedVendors: verified.length,
          complianceRate,
          openRfqs,
          disputedInvoices: 0, // would come from invoiceApi when available
        });

        // Most recent 8 POs for audit trail
        setRecentPOs(
          [...pos]
            .sort((a: any, b: any) => new Date(b.createdAt || b.issueDate || 0).getTime() - new Date(a.createdAt || a.issueDate || 0).getTime())
            .slice(0, 8)
            .map((po: any) => ({
              id: String(po.id || po.poId),
              poNumber: po.poNumber || `PO-${String(po.poId || po.id).padStart(6, "0")}`,
              vendorName: po.vendorName || `Vendor #${po.vendorId}`,
              totalAmount: Number(po.totalAmount) || 0,
              status: po.status,
              createdAt: po.createdAt || po.issueDate,
            }))
        );

        // Vendors not yet verified
        setNonCompliantVendors(
          vendors
            .filter((v: any) => !v.verified && v.complianceStatus !== "Verified")
            .slice(0, 5)
            .map((v: any) => ({
              id: String(v.id || v.vendorId),
              companyName: v.companyName,
              email: v.email,
              complianceStatus: v.complianceStatus || "Pending",
            }))
        );

        // Audit logs
        const logs = await auditApi.getAll().catch(() => []);
        const normalisedLogs = (logs as any[]).slice(0, 100).map((l: any) => ({
          id: String(l.id || l.logId),
          actionType: l.actionType || l.action || "UNKNOWN",
          entityAffected: l.entityAffected || l.entityType || "â€â€",
          userId: String(l.userId || "â€â€"),
          timestamp: l.timestamp || l.createdAt,
          oldValue: l.oldValue,
          newValue: l.newValue,
        }));
        setAuditLogs(normalisedLogs);
        setFilteredLogs(normalisedLogs);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hasRole]);

  const statCards = [
    { label: "Total POs", value: stats.totalPOs, icon: Eye, color: "bg-gray-50 text-gray-700" },
    { label: "Compliance Rate", value: `${stats.complianceRate}%`, icon: ClipboardCheck, color: stats.complianceRate >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" },
    { label: "Verified Vendors", value: `${stats.verifiedVendors}/${stats.totalVendors}`, icon: CheckCircle, color: "bg-blue-50 text-blue-700" },
    { label: "Open RFQs", value: stats.openRfqs, icon: FileText, color: "bg-violet-50 text-violet-700" },
  ];

  const poStatusVariant = (s: string) => {
    const l = s?.toLowerCase() || "";
    if (l.includes("approved") && !l.includes("pending")) return "success";
    if (l.includes("pending")) return "warning";
    if (l.includes("rejected")) return "destructive";
    return "secondary";
  };

  // Filter audit logs by search
  useEffect(() => {
    if (!auditSearch.trim()) {
      setFilteredLogs(auditLogs);
    } else {
      const q = auditSearch.toLowerCase();
      setFilteredLogs(
        auditLogs.filter(
          (l) =>
            l.actionType?.toLowerCase().includes(q) ||
            l.entityAffected?.toLowerCase().includes(q) ||
            l.userId?.toLowerCase().includes(q)
        )
      );
    }
  }, [auditSearch, auditLogs]);

  function exportAuditLogs() {
    const headers = ["ID", "Action", "Entity", "User ID", "Timestamp", "Old Value", "New Value"];
    const rows = filteredLogs.map((l) => [
      l.id, l.actionType, l.entityAffected, l.userId,
      l.timestamp ? new Date(l.timestamp).toLocaleString() : "â€â€",
      l.oldValue || "", l.newValue || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "AUDITOR"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Auditor Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Review transactions, compliance, and audit logs</p>
            </div>
            <Button size="sm" className="text-xs h-8" asChild>
              <Link href="/analytics"><BarChart3 className="mr-1.5 h-3.5 w-3.5" />View Reports</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className={`p-3 ${color.split(" ")[0]}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs ${color.split(" ")[1]}`}>{label}</p>
                      <p className={`text-xl font-semibold mt-1 ${color.split(" ")[1]}`}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : value}
                      </p>
                    </div>
                    <Icon className={`h-5 w-5 opacity-60 ${color.split(" ")[1]}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Recent Transactions */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-700">Recent Transactions</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                  <Link href="/orders">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-gray-500 py-2">PO</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Vendor</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Amount</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : recentPOs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-500 text-xs">
                        No transactions found.
                      </TableCell></TableRow>
                    ) : recentPOs.map(po => (
                      <TableRow key={po.id}>
                        <TableCell className="py-2">
                          <p className="text-xs font-medium">{po.poNumber}</p>
                          <p className="text-[10px] text-gray-500">
                            {po.createdAt ? new Date(po.createdAt).toLocaleDateString() : "â€â€"}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-gray-600 truncate max-w-[100px]">{po.vendorName}</TableCell>
                        <TableCell className="text-xs font-medium py-2">${po.totalAmount.toLocaleString()}</TableCell>
                        <TableCell className="py-2">
                          <Badge variant={poStatusVariant(po.status)} className="text-[10px]">
                            {po.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Compliance Issues */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Compliance Issues
                  {nonCompliantVendors.length > 0 && (
                    <Badge variant="warning" className="ml-2 text-[10px]">{nonCompliantVendors.length}</Badge>
                  )}
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                  <Link href="/vendors">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Vendor</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={2} className="text-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                      </TableCell></TableRow>
                    ) : nonCompliantVendors.length === 0 ? (
                      <TableRow><TableCell colSpan={2} className="text-center py-6 text-gray-500 text-xs">
                        <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                        All vendors are compliant.
                      </TableCell></TableRow>
                    ) : nonCompliantVendors.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="py-2">
                          <p className="text-xs font-medium">{v.companyName}</p>
                          <p className="text-[10px] text-gray-500">{v.email}</p>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="warning" className="text-[10px]">
                            <AlertCircle className="h-2.5 w-2.5 mr-1" />
                            {v.complianceStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Quick Access */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100">
              <CardTitle className="text-sm font-medium text-gray-700">Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="p-3 grid grid-cols-4 gap-2">
              {[
                { label: "View Vendors", href: "/vendors", icon: Eye },
                { label: "View RFQs", href: "/rfq", icon: Eye },
                { label: "View Orders", href: "/orders", icon: Eye },
                { label: "View Analytics", href: "/analytics", icon: BarChart3 },
              ].map(({ label, href, icon: Icon }) => (
                <Button key={label} variant="outline" size="sm" className="justify-start text-xs h-8" asChild>
                  <Link href={href}><Icon className="mr-2 h-3.5 w-3.5" />{label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="py-3 px-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-700">
                Audit Trail
                <span className="ml-2 text-[10px] font-normal text-gray-400">
                  ({filteredLogs.length} entries)
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    type="search"
                    placeholder="Search logs..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="pl-8 w-[180px] h-7 text-xs border-gray-200"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={exportAuditLogs}
                  disabled={filteredLogs.length === 0}
                >
                  <Download className="mr-1.5 h-3 w-3" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  {auditSearch ? "No logs match your search." : "No audit logs available."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Action</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Entity</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">User ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Timestamp</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500 py-2">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.slice(0, 50).map((log) => (
                      <TableRow key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <TableCell className="py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            log.actionType?.includes("CREATE") ? "bg-emerald-100 text-emerald-700" :
                            log.actionType?.includes("UPDATE") ? "bg-blue-100 text-blue-700" :
                            log.actionType?.includes("DELETE") ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {log.actionType}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-gray-600">{log.entityAffected}</TableCell>
                        <TableCell className="text-xs py-2 text-gray-500 font-mono">{log.userId}</TableCell>
                        <TableCell className="text-xs py-2 text-gray-500">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : "â€â€"}
                        </TableCell>
                        <TableCell className="text-xs py-2 max-w-[200px]">
                          {log.newValue ? (
                            <span className="text-[10px] text-gray-500 truncate block" title={log.newValue}>
                              {String(log.newValue).substring(0, 40)}{String(log.newValue).length > 40 ? "â€¦" : ""}
                            </span>
                          ) : "â€â€"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
