"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import { poApi, vendorApi, rfqApi, auditApi, authApi, getVendorNameMap } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import Link from "next/link";
import {
  Loader2, Eye, FileText, BarChart3, ClipboardCheck,
  AlertCircle, CheckCircle, Download, Search,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

function poStatusChip(s: string) {
  const l = s?.toLowerCase() || "";
  const cls = (l.includes("approved") && !l.includes("pending")) ? "bg-emerald-100 text-emerald-700"
    : l.includes("pending") ? "bg-amber-100 text-amber-700"
    : l.includes("rejected") ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-600";
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{s}</span>;
}

export default function AuditorDashboardPage() {
  const hasRole = useAuthStore((state) => state.hasRole);

  const [stats, setStats] = useState({
    totalPOs: 0, totalVendors: 0, verifiedVendors: 0,
    complianceRate: 0, openRfqs: 0,
  });
  const [recentPOs, setRecentPOs] = useState<any[]>([]);
  const [nonCompliantVendors, setNonCompliantVendors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasRole(["ADMIN", "AUDITOR"])) return;

    async function load() {
      try {
        setLoading(true);

        const [poList, vendorMap, rfqs, logs] = await Promise.all([
          poApi.getAllList().catch(() => []),
          getVendorNameMap(),
          rfqApi.getAllList().catch(() => []),
          auditApi.getAll().catch(() => []),
        ]);

        // ── Stats ──────────────────────────────────────────────────────────
        const vendors = await vendorApi.getAllList().catch(() => []);
        const verified = vendors.filter(
          (v: any) => v.verified || v.complianceStatus === "Verified"
        );
        const complianceRate =
          vendors.length > 0
            ? Math.round((verified.length / vendors.length) * 100)
            : 0;
        const openRfqs = rfqs.filter(
          (r: any) => r.status?.toUpperCase() === "OPEN"
        ).length;

        setStats({
          totalPOs: poList.length,
          totalVendors: vendors.length,
          verifiedVendors: verified.length,
          complianceRate,
          openRfqs,
        });

        // ── Recent POs ─────────────────────────────────────────────────────
        // PurchaseOrderResponse fields: poId, poNumber, vendorId, vendorName, totalAmount, status, issueDate
        setRecentPOs(
          [...poList]
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt || b.issueDate || 0).getTime() -
                new Date(a.createdAt || a.issueDate || 0).getTime()
            )
            .slice(0, 8)
            .map((po: any) => ({
              id: String(po.poId || po.id),
              poNumber:
                po.poNumber ||
                `PO-${String(po.poId || po.id).padStart(6, "0")}`,
              // vendorName is already resolved by PurchaseOrderService via VendorClient
              // Fall back to vendorMap (Map<vendorId, companyName>) if missing
              vendorName:
                po.vendorName ||
                vendorMap?.get(String(po.vendorId || "")) ||
                (po.vendorId ? `Vendor #${po.vendorId}` : "N/A"),
              totalAmount: Number(po.totalAmount) || 0,
              status: po.status,
              createdAt: po.createdAt || po.issueDate,
            }))
        );

        // ── Non-compliant vendors ──────────────────────────────────────────
        // VendorResponse fields: vendorId, companyName, email, complianceStatus
        setNonCompliantVendors(
          vendors
            .filter(
              (v: any) => !v.verified && v.complianceStatus !== "Verified"
            )
            .slice(0, 5)
            .map((v: any) => ({
              id: String(v.vendorId || v.id),
              companyName: v.companyName,
              email: v.email,
              complianceStatus: v.complianceStatus || "Pending",
            }))
        );

        // ── User name map for audit log display ────────────────────────────
        // UserResponse fields: userId (Long), fullName (String), email (String)
        const users = await authApi.getAllUsers().catch(() => []);
        const uMap = new Map<string, string>();
        (users as any[]).forEach((u: any) => {
          const id = String(u.userId || u.id || "");
          // fullName is the primary display field; fall back to email
          const name = u.fullName || u.email || `User #${id}`;
          if (id) uMap.set(id, name);
        });

        // ── Audit logs ─────────────────────────────────────────────────────
        // AuditLogResponse fields: logId, actionType, entityAffected, timestamp,
        //                          oldValue, newValue, userId (Long)
        // 'logs' was already fetched in the Promise.all above — reuse it.
        const normalised = (logs as any[]).slice(0, 100).map((l: any) => {
          const uid = l.userId != null ? String(l.userId) : null;
          return {
            id: String(l.logId || l.id),
            actionType: l.actionType || "UNKNOWN",
            entityAffected: l.entityAffected || "--",
            // Show fullName resolved from UserResponse.userId; "System" for null userId
            performedBy: uid
              ? uMap.get(uid) || `User #${uid}`
              : "System",
            timestamp: l.timestamp || l.createdAt,
            newValue: l.newValue || null,
          };
        });
        setAuditLogs(normalised);
        setFilteredLogs(normalised);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [hasRole]);

  // ── Filter audit logs ────────────────────────────────────────────────────
  useEffect(() => {
    if (!auditSearch.trim()) {
      setFilteredLogs(auditLogs);
      return;
    }
    const q = auditSearch.toLowerCase();
    setFilteredLogs(
      auditLogs.filter(
        (l) =>
          l.actionType?.toLowerCase().includes(q) ||
          l.entityAffected?.toLowerCase().includes(q) ||
          l.performedBy?.toLowerCase().includes(q)
      )
    );
  }, [auditSearch, auditLogs]);

  // ── Export ───────────────────────────────────────────────────────────────
  function exportAuditLogs() {
    const headers = ["ID", "Action", "Entity", "Performed By", "Timestamp", "Change"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.actionType,
      l.entityAffected,
      l.performedBy,
      l.timestamp ? new Date(l.timestamp).toLocaleString() : "--",
      l.newValue ? String(l.newValue).substring(0, 100) : "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statCards = [
    { label: "Total POs", value: stats.totalPOs, icon: Eye },
    {
      label: "Compliance Rate",
      value: `${stats.complianceRate}%`,
      icon: ClipboardCheck,
    },
    {
      label: "Verified Vendors",
      value: `${stats.verifiedVendors}/${stats.totalVendors}`,
      icon: CheckCircle,
    },
    { label: "Open RFQs", value: stats.openRfqs, icon: FileText },
  ];

  return (
    <RequireRole allowedRoles={["ADMIN", "AUDITOR"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Auditor Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Review transactions, compliance, and audit logs
              </p>
            </div>
            <Button size="sm" className="text-xs h-8" asChild>
              <Link href="/analytics">
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                View Reports
              </Link>
            </Button>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
            {statCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-4 py-3 flex items-center gap-3">
                <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                  {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Recent Transactions */}
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">
                  Recent Transactions
                </p>
                <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                  <Link href="/orders">View all</Link>
                </Button>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">PO</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : recentPOs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-gray-500 text-xs">
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentPOs.map((po) => (
                        <TableRow key={po.id} className="hover:bg-transparent">
                          <TableCell className="py-2">
                            <p className="text-xs font-medium">{po.poNumber}</p>
                            <p className="text-[10px] text-gray-500">
                              {po.createdAt
                                ? new Date(po.createdAt).toLocaleDateString()
                                : "--"}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs py-2 text-gray-600 truncate max-w-[100px]">
                            {po.vendorName}
                          </TableCell>
                          <TableCell className="text-xs font-medium py-2">
                            ${po.totalAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2">
                            {poStatusChip(po.status)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Compliance Issues */}
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700">
                  Compliance Issues
                  {nonCompliantVendors.length > 0 && (
                    <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">{nonCompliantVendors.length}</span>
                  )}
                </p>
                <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                  <Link href="/vendors">View all</Link>
                </Button>
              </div>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : nonCompliantVendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-6 text-gray-500 text-xs">
                          <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                          All vendors are compliant.
                        </TableCell>
                      </TableRow>
                    ) : (
                      nonCompliantVendors.map((v) => (
                        <TableRow key={v.id} className="hover:bg-transparent">
                          <TableCell className="py-2">
                            <p className="text-xs font-medium">{v.companyName}</p>
                            <p className="text-[10px] text-gray-500">{v.email}</p>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700"><AlertCircle className="h-2.5 w-2.5" />{v.complianceStatus}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Quick Access */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Quick Access</p>
            </div>
            <div className="p-3 grid grid-cols-4 gap-2">
              {[
                { label: "View Vendors", href: "/vendors", icon: Eye },
                { label: "View RFQs", href: "/rfq", icon: Eye },
                { label: "View Orders", href: "/orders", icon: Eye },
                { label: "View Analytics", href: "/analytics", icon: BarChart3 },
              ].map(({ label, href, icon: Icon }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  className="justify-start text-xs h-8"
                  asChild
                >
                  <Link href={href}>
                    <Icon className="mr-2 h-3.5 w-3.5" />
                    {label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">
                Audit Trail
                <span className="ml-2 text-[10px] font-normal text-gray-400">
                  ({filteredLogs.length} entries)
                </span>
              </p>
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
            </div>
            <div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  {auditSearch
                    ? "No logs match your search."
                    : "No audit logs available."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Action</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Entity</TableHead>
                      {/* "Performed By" resolves AuditLog.userId → UserResponse.fullName */}
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Performed By</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Timestamp</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.slice(0, 50).map((log) => (
                      <TableRow
                        key={log.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50"
                      >
                        <TableCell className="py-2">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              log.actionType?.includes("CREATE") ||
                              log.actionType?.includes("REGISTER")
                                ? "bg-emerald-100 text-emerald-700"
                                : log.actionType?.includes("UPDATE") ||
                                  log.actionType?.includes("ASSIGN") ||
                                  log.actionType?.includes("APPROVE")
                                ? "bg-blue-100 text-blue-700"
                                : log.actionType?.includes("DELETE") ||
                                  log.actionType?.includes("LOCK") ||
                                  log.actionType?.includes("REJECT")
                                ? "bg-red-100 text-red-700"
                                : log.actionType?.includes("LOGIN")
                                ? "bg-gray-100 text-gray-600"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {log.actionType}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-gray-600">
                          {log.entityAffected}
                        </TableCell>
                        {/* Resolved from AuditLog.userId via UserResponse.fullName */}
                        <TableCell className="text-xs py-2 text-gray-700 font-medium">
                          {log.performedBy}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-gray-500">
                          {log.timestamp
                            ? new Date(log.timestamp).toLocaleString()
                            : "--"}
                        </TableCell>
                        <TableCell className="text-xs py-2 max-w-[200px]">
                          {log.newValue ? (
                            <span
                              className="text-[10px] text-gray-500 truncate block"
                              title={log.newValue}
                            >
                              {String(log.newValue).substring(0, 40)}
                              {String(log.newValue).length > 40 ? "..." : ""}
                            </span>
                          ) : (
                            "--"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
