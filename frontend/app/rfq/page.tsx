"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rfqApi, bidApi, poApi, vendorApi, getVendorNameMap, getCategoryNameMap } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { RFQDialog } from "./rfq-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import {
  Plus,
  Search,
  MoreHorizontal,
  Gavel,
  Clock,
  Users,
  Loader2,
  AlertCircle,
  TrendingUp,
  Award,
} from "lucide-react";

// ── Status chip ──────────────────────────────────────────────────────────────
const STATUS: Record<string, { dot: string; pill: string }> = {
  OPEN:       { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" },
  CLOSED:     { dot: "bg-gray-400",    pill: "bg-gray-100 text-gray-600"      },
  AWARDED:    { dot: "bg-blue-500",    pill: "bg-blue-50 text-blue-700"       },
  EVALUATING: { dot: "bg-amber-400",   pill: "bg-amber-50 text-amber-700"     },
  SUBMITTED:  { dot: "bg-violet-500",  pill: "bg-violet-50 text-violet-700"   },
  REJECTED:   { dot: "bg-red-500",     pill: "bg-red-50 text-red-700"         },
  PENDING:    { dot: "bg-gray-400",    pill: "bg-gray-50 text-gray-500"       },
};

function Chip({ status }: { status: string }) {
  const c = STATUS[status?.toUpperCase()] ?? STATUS.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${c.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {status}
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysRemaining(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return { label: "Overdue", urgent: true };
  if (days === 0) return { label: "Due today", urgent: true };
  if (days === 1) return { label: "1 day left", urgent: true };
  if (days <= 3) return { label: `${days} days left`, urgent: true };
  return { label: `${days} days left`, urgent: false };
}

// ── Types ────────────────────────────────────────────────────────────────────
interface RFQ {
  id: string;
  rfqNumber: string;
  title: string;
  description: string;
  category?: string;
  categoryName?: string;
  categoryId?: string | number;
  status: string;
  bidCount: number;
  maxBudget: number;
  deadline: string;
  createdAt: string;
}

interface Bid {
  id: string;
  vendorName: string;
  bidAmount: number;
  deliveryTime: string;
  validityDays: number;
  status: string;
  score?: number;
  rfqId?: string;
  rfqTitle?: string;
  proposalText?: string;
  vendorId?: string | number;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RFQPage() {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [filteredRfqs, setFilteredRfqs] = useState<RFQ[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("rfqs");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [rfqToAward, setRfqToAward] = useState<RFQ | null>(null);
  const [bidsToAward, setBidsToAward] = useState<Bid[]>([]);
  const [selectedBidId, setSelectedBidId] = useState<string>("");
  // Detail dialogs
  const [detailRfq, setDetailRfq] = useState<RFQ | null>(null);
  const [detailBid, setDetailBid] = useState<Bid | null>(null);
  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  const { toast } = useToast();
  const router = useRouter();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const canCreateRfq = hasPermission("rfq:create");
  const canUpdateRfq = hasPermission("rfq:update");
  const canCloseRfq = hasPermission("rfq:close");
  const canEvaluateBids = hasPermission("bids:evaluate");
  const canSubmitBid = hasPermission("bids:submit");
  const canCreatePO = hasPermission("po:create");

  // Generate PO after award
  const [generatePoOpen, setGeneratePoOpen] = useState(false);
  const [generatePoData, setGeneratePoData] = useState<{ rfqId: string; bidId: string; bid: Bid; rfq: RFQ } | null>(null);
  const [generatePoDeliveryDate, setGeneratePoDeliveryDate] = useState("");
  const [generatePoLoading, setGeneratePoLoading] = useState(false);

  // Vendor bid submission
  const [submitBidOpen, setSubmitBidOpen] = useState(false);
  const [submitBidRfq, setSubmitBidRfq] = useState<RFQ | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidDeliveryDays, setBidDeliveryDays] = useState("");
  const [bidProposal, setBidProposal] = useState("");
  const [submitBidLoading, setSubmitBidLoading] = useState(false);
  const user = useAuthStore((state) => state.user);

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleCloseRfq(rfqId: string) {
    try {
      await rfqApi.close(rfqId);
      toast({ title: "RFQ Closed", description: "The RFQ has been closed successfully." });
      loadRFQs();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to close RFQ",
        variant: "destructive",
      });
    }
  }

  async function handleGeneratePO() {
    if (!generatePoData) return;
    setGeneratePoLoading(true);
    try {
      const vendorList = await vendorApi.getAllList().catch(() => []);
      const bid = generatePoData.bid as any;
      const vendorId =
        bid.vendorId ||
        (vendorList as any[]).find((v: any) => v.companyName === bid.vendorName)?.vendorId ||
        0;
      await poApi.create({
        rfqId: parseInt(generatePoData.rfqId),
        vendorId: parseInt(String(vendorId)),
        totalAmount: bid.bidAmount,
        expectedDeliveryDate: generatePoDeliveryDate || undefined,
        bidId: parseInt(generatePoData.bidId),
      });
      toast({ title: "Purchase Order Created", description: "PO has been generated from the awarded bid." });
      setGeneratePoOpen(false);
      setGeneratePoData(null);
      setGeneratePoDeliveryDate("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate PO",
        variant: "destructive",
      });
    } finally {
      setGeneratePoLoading(false);
    }
  }

  async function handleSubmitBid() {
    if (!submitBidRfq || !bidAmount) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitBidLoading(true);
    try {
      const userId = user?.id || user?.userId;
      let vendorId: string | number = userId || "0";
      if ((user?.role === "VENDOR" || user?.roleName === "VENDOR") && userId) {
        try {
          const vendorProfile = await vendorApi.getByUserId(userId);
          vendorId = vendorProfile?.vendorId || vendorProfile?.id || userId;
        } catch {
          // fall back to userId
        }
      }
      await bidApi.submit({
        rfqId: parseInt(submitBidRfq.id),
        vendorId: parseInt(String(vendorId)),
        bidAmount: parseFloat(bidAmount),
        proposalText: bidProposal || undefined,
        deliveryDays: bidDeliveryDays ? parseInt(bidDeliveryDays) : undefined,
      });
      toast({
        title: "Bid Submitted",
        description: `Your bid of $${parseFloat(bidAmount).toLocaleString()} has been submitted.`,
      });
      setSubmitBidOpen(false);
      setSubmitBidRfq(null);
      setBidAmount("");
      setBidDeliveryDays("");
      setBidProposal("");
      loadRFQs();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit bid",
        variant: "destructive",
      });
    } finally {
      setSubmitBidLoading(false);
    }
  }

  async function openAwardDialog(rfq: RFQ) {
    try {
      const [bidsData, vendorMap] = await Promise.all([
        bidApi.getByRfq(rfq.id),
        getVendorNameMap(),
      ]);
      const normalised = (bidsData as any[]).map((b: any) => ({
        ...b,
        id: String(b.id || b.bidId),
        vendorName:
          b.vendorName ||
          vendorMap.get(String(b.vendorId || "")) ||
          (b.vendorId ? `Vendor #${b.vendorId}` : "Unknown Vendor"),
        deliveryTime: b.deliveryTime || (b.deliveryDays ? `${b.deliveryDays} days` : "--"),
        score: b.score ?? (b.totalScore ? Math.round(Number(b.totalScore)) : 0),
      }));
      const eligible = normalised.filter(
        (b: any) => !["REJECTED", "Rejected", "AWARDED", "Awarded"].includes(b.status)
      );
      setBidsToAward(eligible);
      setRfqToAward(rfq);
      setSelectedBidId("");
      setAwardDialogOpen(true);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load bids",
        variant: "destructive",
      });
    }
  }

  async function handleAward() {
    if (!selectedBidId) {
      toast({ title: "Error", description: "Please select a bid to award", variant: "destructive" });
      return;
    }
    try {
      await bidApi.award(selectedBidId);
      toast({ title: "Contract Awarded", description: "The bid has been awarded successfully." });
      setAwardDialogOpen(false);
      const bid = bidsToAward.find((b) => b.id === selectedBidId);
      if (bid && rfqToAward) {
        setGeneratePoData({ rfqId: rfqToAward.id, bidId: selectedBidId, bid, rfq: rfqToAward });
        setGeneratePoOpen(true);
      }
      setRfqToAward(null);
      setSelectedBidId("");
      loadRFQs();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to award contract",
        variant: "destructive",
      });
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"])) return;
    loadRFQs(currentPage);
  }, [currentPage]);

  async function loadRFQs(page = 0) {
    try {
      setLoading(true);
      const [response, categoryMap] = await Promise.all([
        rfqApi.getAll(page, PAGE_SIZE),
        getCategoryNameMap(),
      ]);
      const items = response.content ?? [];

      const normalised = items.map((r: any) => {
        // Bug fix: handle numeric categoryId safely
        const raw = r.category || r.categoryName || r.categoryId;
        const str = raw != null ? String(raw) : "";
        const category = /^\d+$/.test(str) && str
          ? (categoryMap.get(str) || `Category #${str}`)
          : (str || "Uncategorized");

        return {
          ...r,
          id: String(r.id || r.rfqId),
          rfqNumber: r.rfqNumber || `RFQ-${String(r.rfqId || r.id).padStart(6, "0")}`,
          category,
          maxBudget: r.maxBudget ?? r.estimatedValue ?? 0,
          bidCount: r.bidCount ?? 0,
          deadline: r.deadline,
          createdAt: r.createdAt,
        };
      });
      setRfqs(normalised);
      setFilteredRfqs(normalised);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load RFQs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let filtered = rfqs;
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((r) => r.status?.toUpperCase() === statusFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.rfqNumber?.toLowerCase().includes(query) ||
          r.title?.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.category?.toLowerCase().includes(query) ||
          r.status?.toLowerCase().includes(query)
      );
    }
    setFilteredRfqs(filtered);
  }, [searchQuery, rfqs, statusFilter]);

  async function loadBids(rfqId: string) {
    try {
      const [data, vendorMap] = await Promise.all([bidApi.getByRfq(rfqId), getVendorNameMap()]);
      const normalised = (data as any[]).map((b: any) => ({
        ...b,
        id: String(b.id || b.bidId),
        vendorName:
          b.vendorName ||
          vendorMap.get(String(b.vendorId || "")) ||
          (b.vendorId ? `Vendor #${b.vendorId}` : "Unknown Vendor"),
        deliveryTime: b.deliveryTime || (b.deliveryDays ? `${b.deliveryDays} days` : "--"),
        score: b.score ?? (b.totalScore ? Math.round(Number(b.totalScore)) : 0),
      }));
      setBids(normalised);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bids");
    }
  }

  async function loadAllBids() {
    if (rfqs.length === 0) return;
    try {
      setBidsLoading(true);
      const [results, vendorMap] = await Promise.all([
        Promise.allSettled(rfqs.map((r) => bidApi.getByRfq(r.id))),
        getVendorNameMap(),
      ]);
      const merged: Bid[] = [];
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          (result.value as any[]).forEach((bid: any) => {
            merged.push({
              ...bid,
              id: String(bid.id || bid.bidId),
              vendorName:
                bid.vendorName ||
                vendorMap.get(String(bid.vendorId || "")) ||
                (bid.vendorId ? `Vendor #${bid.vendorId}` : "Unknown Vendor"),
              deliveryTime: bid.deliveryTime || (bid.deliveryDays ? `${bid.deliveryDays} days` : "--"),
              score: bid.score ?? (bid.totalScore ? Math.round(Number(bid.totalScore)) : 0),
              rfqId: rfqs[idx].id,
              rfqTitle: rfqs[idx].title,
            });
          });
        }
      });
      setAllBids(merged);
    } catch {
      // silently fail
    } finally {
      setBidsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "bids" && rfqs.length > 0 && allBids.length === 0) {
      loadAllBids();
    }
  }, [activeTab, rfqs]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const openCount = rfqs.filter((r) => r.status?.toUpperCase() === "OPEN").length;
  const totalBids = rfqs.reduce((s, r) => s + (r.bidCount || 0), 0);
  const closingSoon = rfqs.filter((r) => {
    if (r.status?.toUpperCase() !== "OPEN" || !r.deadline) return false;
    const days = Math.ceil((new Date(r.deadline).getTime() - Date.now()) / 86_400_000);
    return days <= 3 && days >= 0;
  }).length;
  const awardedCount = rfqs.filter((r) => r.status?.toUpperCase() === "AWARDED").length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">RFQ &amp; Bidding</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage requests and vendor bids</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 rounded"
                onClick={() => router.push("/analytics")}
              >
                Analytics
              </Button>
              {canCreateRfq && (
                <Button
                  size="sm"
                  className="text-xs h-8 rounded"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create RFQ
                </Button>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200 border border-gray-200 rounded">
            {[
              { label: "Open RFQs",    value: openCount,    iconEl: <Gavel className="h-5 w-5 text-gray-300" />     },
              { label: "Total Bids",   value: totalBids,    iconEl: <TrendingUp className="h-5 w-5 text-gray-300" /> },
              { label: "Closing Soon", value: closingSoon,  iconEl: <Clock className="h-5 w-5 text-gray-300" />     },
              { label: "Awarded",      value: awardedCount, iconEl: <Award className="h-5 w-5 text-gray-300" />     },
            ].map(({ label, value, iconEl }) => (
              <div key={label} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  {loading ? (
                    <div className="mt-1.5 h-6 w-10 rounded bg-gray-100 animate-pulse" />
                  ) : (
                    <p className="mt-0.5 text-2xl font-semibold text-gray-900 leading-none">{value}</p>
                  )}
                </div>
                {iconEl}
              </div>
            ))}
          </div>

          {/* Alert banner — closing-soon warning */}
          {!loading && closingSoon > 0 && (
            <div className="flex items-center gap-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800">
                Some RFQs are{" "}
                <span className="font-semibold">closing within 3 days</span>. Review bids and
                award contracts before the deadline.
              </p>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="rfqs" onValueChange={setActiveTab}>
            <TabsList className="h-9 w-full justify-start rounded-none border-b border-gray-200 bg-transparent p-0 gap-0">
              {(
                [
                  { value: "rfqs",    label: "RFQs"    },
                  { value: "bids",    label: "Bids"    },
                  { value: "awarded", label: "Awarded" },
                ] as const
              ).map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-9 rounded-none border-b-2 border-transparent px-4 text-xs font-medium text-gray-500 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:!bg-transparent data-[state=active]:!shadow-none hover:text-gray-700"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── RFQs tab ─────────────────────────────────────────────── */}
            <TabsContent value="rfqs" className="mt-0">
              <div className="border border-t-0 border-gray-200 rounded-b">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-700">
                    Request for Quotations
                  </span>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        type="search"
                        placeholder="Search RFQs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-[200px] h-8 text-xs border-gray-200 rounded"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 text-xs w-[130px] rounded">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                        <SelectItem value="AWARDED">Awarded</SelectItem>
                        <SelectItem value="EVALUATING">Evaluating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">RFQ</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Category</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-center">Bids</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Budget</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Deadline</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : filteredRfqs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Gavel className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs font-medium text-gray-500">
                            {searchQuery ? "No RFQs match your search." : "No RFQs yet."}
                          </p>
                          {!searchQuery && canCreateRfq && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Click &ldquo;Create RFQ&rdquo; to invite vendors to bid.
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRfqs.map((rfq) => {
                        const deadline = rfq.deadline ? daysRemaining(rfq.deadline) : null;
                        return (
                          <TableRow
                            key={rfq.id}
                            className="border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer"
                            onClick={() => setDetailRfq(rfq)}
                          >
                            <TableCell className="py-2.5">
                              <p className="text-xs font-medium font-mono">{rfq.rfqNumber}</p>
                              {rfq.title && (
                                <p className="text-[10px] text-gray-400 truncate max-w-[160px]">
                                  {rfq.title}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600 py-2.5">
                              {rfq.category || "Uncategorized"}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Chip status={rfq.status} />
                            </TableCell>
                            <TableCell className="py-2.5 text-center">
                              {rfq.bidCount > 0 ? (
                                <span className="text-xs font-bold text-blue-600">
                                  {rfq.bidCount}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-gray-900 py-2.5">
                              {rfq.maxBudget ? `$${rfq.maxBudget.toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell className="py-2.5">
                              {deadline ? (
                                <span
                                  className={`text-[10px] font-medium ${
                                    deadline.urgent ? "text-red-600" : "text-gray-500"
                                  }`}
                                >
                                  {deadline.label}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">No deadline</span>
                              )}
                            </TableCell>
                            <TableCell
                              className="text-right py-2.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                  <DropdownMenuItem
                                    className="text-xs"
                                    onClick={() => setDetailRfq(rfq)}
                                  >
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-xs"
                                    onClick={() => {
                                      setActiveTab("bids");
                                      loadBids(rfq.id);
                                    }}
                                  >
                                    View Bids
                                  </DropdownMenuItem>
                                  {canSubmitBid && rfq.status?.toUpperCase() === "OPEN" && (
                                    <DropdownMenuItem
                                      className="text-xs"
                                      onClick={() => {
                                        setSubmitBidRfq(rfq);
                                        setSubmitBidOpen(true);
                                      }}
                                    >
                                      Submit Bid
                                    </DropdownMenuItem>
                                  )}
                                  {canCloseRfq && rfq.status?.toUpperCase() === "OPEN" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-xs"
                                        onClick={() => handleCloseRfq(rfq.id)}
                                      >
                                        Close RFQ
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {canUpdateRfq && rfq.status?.toUpperCase() === "OPEN" && (
                                    <DropdownMenuItem
                                      className="text-xs"
                                      onClick={() => {
                                        setSelectedRfq(rfq);
                                        setDialogOpen(true);
                                      }}
                                    >
                                      Edit RFQ
                                    </DropdownMenuItem>
                                  )}
                                  {canEvaluateBids &&
                                    ["EVALUATING", "CLOSED"].includes(
                                      rfq.status?.toUpperCase()
                                    ) && (
                                      <DropdownMenuItem
                                        className="text-xs"
                                        onClick={() => openAwardDialog(rfq)}
                                      >
                                        Award Contract
                                      </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                <PaginationControls
                  page={currentPage}
                  totalPages={totalPages}
                  totalElements={totalElements}
                  size={PAGE_SIZE}
                  onPageChange={(p) => setCurrentPage(p)}
                  loading={loading}
                />
              </div>
            </TabsContent>

            {/* ── Bids tab ──────────────────────────────────────────────── */}
            <TabsContent value="bids" className="mt-0">
              <div className="border border-t-0 border-gray-200 rounded-b">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-700">Vendor Bids</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Bid</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">RFQ</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Delivery</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : allBids.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Users className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs font-medium text-gray-500">No bids loaded yet.</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Bids load automatically when you switch to this tab.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      allBids.map((bid) => (
                        <TableRow
                          key={bid.id}
                          className="border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer"
                          onClick={() => setDetailBid(bid)}
                        >
                          <TableCell className="py-2.5">
                            <p className="text-xs font-medium font-mono">
                              BID-{String(bid.id).padStart(4, "0")}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 py-2.5 max-w-[120px] truncate">
                            {bid.rfqTitle || bid.rfqId || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-gray-700 py-2.5">
                            {bid.vendorName}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-gray-900 py-2.5">
                            ${bid.bidAmount?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 py-2.5">
                            {bid.deliveryTime}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Chip status={bid.status} />
                          </TableCell>
                          <TableCell
                            className="text-right py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] rounded"
                              onClick={() => setDetailBid(bid)}
                            >
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Awarded tab ───────────────────────────────────────────── */}
            <TabsContent value="awarded" className="mt-0">
              <div className="border border-t-0 border-gray-200 rounded-b">
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-700">
                    Awarded Contracts
                    {awardedCount > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        {awardedCount}
                      </span>
                    )}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">RFQ</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Title</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Category</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Budget</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rfqs.filter((r) => r.status?.toUpperCase() === "AWARDED").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <Award className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs font-medium text-gray-500">
                            No awarded contracts yet.
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Award a contract from the RFQs tab after closing bidding.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rfqs
                        .filter((r) => r.status?.toUpperCase() === "AWARDED")
                        .map((rfq) => (
                          <TableRow
                            key={rfq.id}
                            className="border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer"
                            onClick={() => setDetailRfq(rfq)}
                          >
                            <TableCell className="py-2.5">
                              <p className="text-xs font-medium font-mono">
                                {rfq.rfqNumber || rfq.id}
                              </p>
                            </TableCell>
                            <TableCell className="text-xs text-gray-700 py-2.5">
                              {rfq.title}
                            </TableCell>
                            <TableCell className="text-xs text-gray-600 py-2.5">
                              {rfq.category || "—"}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-gray-900 py-2.5">
                              {rfq.maxBudget ? `$${rfq.maxBudget.toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 py-2.5">
                              {rfq.deadline
                                ? new Date(rfq.deadline).toLocaleDateString()
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Create / Edit RFQ dialog ─────────────────────────────────────── */}
        <RFQDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={loadRFQs}
        />

        {/* ── RFQ Detail Dialog ────────────────────────────────────────────── */}
        <Dialog open={!!detailRfq} onOpenChange={(o) => !o && setDetailRfq(null)}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {detailRfq?.rfqNumber} — {detailRfq?.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Request for Quotation details
              </DialogDescription>
            </DialogHeader>
            {detailRfq && (
              <div className="py-2 space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-1">Status</p>
                    <Chip status={detailRfq.status} />
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Category</p>
                    <p className="font-medium text-gray-800">{detailRfq.category || "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Budget</p>
                    <p className="font-medium text-gray-800">
                      {detailRfq.maxBudget
                        ? `$${detailRfq.maxBudget.toLocaleString()}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Bids Received</p>
                    <p className="font-medium text-gray-800">{detailRfq.bidCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Deadline</p>
                    <p className="font-medium text-gray-800">
                      {detailRfq.deadline
                        ? new Date(detailRfq.deadline).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Created</p>
                    <p className="font-medium text-gray-800">
                      {detailRfq.createdAt
                        ? new Date(detailRfq.createdAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                {detailRfq.description && (
                  <div className="text-xs">
                    <p className="text-gray-400 mb-1">Description</p>
                    <p className="text-gray-700">{detailRfq.description}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" className="rounded" onClick={() => setDetailRfq(null)}>
                Close
              </Button>
              {canUpdateRfq && detailRfq?.status?.toUpperCase() === "OPEN" && (
                <Button
                  size="sm"
                  className="rounded"
                  onClick={() => {
                    setSelectedRfq(detailRfq);
                    setDetailRfq(null);
                    setDialogOpen(true);
                  }}
                >
                  Edit RFQ
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Bid Detail Dialog ────────────────────────────────────────────── */}
        <Dialog open={!!detailBid} onOpenChange={(o) => !o && setDetailBid(null)}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">
                Bid Review — {detailBid?.rfqTitle || "RFQ"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Vendor bid details and scoring
              </DialogDescription>
            </DialogHeader>
            {detailBid && (
              <div className="py-2 space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-1">Vendor</p>
                    <p className="font-medium text-gray-800">{detailBid.vendorName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Status</p>
                    <Chip status={detailBid.status} />
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Bid Amount</p>
                    <p className="font-medium text-gray-800 text-base">
                      ${(detailBid as any).bidAmount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Delivery Time</p>
                    <p className="font-medium text-gray-800">{detailBid.deliveryTime}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-400 mb-1">Score</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Progress value={detailBid.score || 0} className="w-24 h-2" />
                      <span className="font-medium text-gray-800">{detailBid.score || 0}%</span>
                    </div>
                  </div>
                </div>
                {(detailBid as any).proposalText && (
                  <div className="text-xs">
                    <p className="text-gray-400 mb-1">Proposal</p>
                    <p className="text-gray-700">{(detailBid as any).proposalText}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" className="rounded" onClick={() => setDetailBid(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Award Contract Dialog ────────────────────────────────────────── */}
        <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">Award Contract</DialogTitle>
              <DialogDescription className="text-xs">
                Select a bid to award for {rfqToAward?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {bidsToAward.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No submitted bids available for this RFQ.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Select Bid to Award</Label>
                    <Select value={selectedBidId} onValueChange={setSelectedBidId}>
                      <SelectTrigger className="rounded text-xs">
                        <SelectValue placeholder="Choose a bid..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bidsToAward.map((bid) => (
                          <SelectItem key={bid.id} value={bid.id} className="text-xs">
                            {bid.vendorName} — ${bid.bidAmount?.toLocaleString()} (
                            {bid.deliveryTime})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedBidId && (() => {
                    const bid = bidsToAward.find((b) => b.id === selectedBidId);
                    return bid ? (
                      <div className="border border-gray-200 rounded p-3 text-xs space-y-1.5">
                        {[
                          ["Vendor",    bid.vendorName],
                          ["Amount",    `$${bid.bidAmount?.toLocaleString()}`],
                          ["Delivery",  bid.deliveryTime],
                          ["Valid for", `${bid.validityDays} days`],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-gray-400">{k}</span>
                            <span className="font-medium text-gray-800">{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="rounded"
                onClick={() => setAwardDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded"
                onClick={handleAward}
                disabled={!selectedBidId || bidsToAward.length === 0}
              >
                Award Contract
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Generate PO Dialog ───────────────────────────────────────────── */}
        <Dialog open={generatePoOpen} onOpenChange={setGeneratePoOpen}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">Generate Purchase Order</DialogTitle>
              <DialogDescription className="text-xs">
                Create a PO from the awarded bid for {generatePoData?.rfq.title}.
              </DialogDescription>
            </DialogHeader>
            {generatePoData && (
              <div className="space-y-3 py-2">
                <div className="border border-gray-200 rounded p-3 text-xs space-y-1.5">
                  {[
                    ["Vendor",        (generatePoData.bid as any).vendorName],
                    ["Bid Amount",    `$${(generatePoData.bid as any).bidAmount?.toLocaleString()}`],
                    ["Delivery Time", generatePoData.bid.deliveryTime],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Expected Delivery Date (optional)</Label>
                  <Input
                    type="date"
                    value={generatePoDeliveryDate}
                    onChange={(e) => setGeneratePoDeliveryDate(e.target.value)}
                    className="h-8 text-xs rounded"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="rounded"
                onClick={() => setGeneratePoOpen(false)}
              >
                Skip
              </Button>
              <Button
                size="sm"
                className="rounded"
                disabled={generatePoLoading}
                onClick={handleGeneratePO}
              >
                {generatePoLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Generate PO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Submit Bid Dialog ────────────────────────────────────────────── */}
        <Dialog open={submitBidOpen} onOpenChange={setSubmitBidOpen}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">Submit Bid</DialogTitle>
              <DialogDescription className="text-xs">
                Submit your bid for:{" "}
                <span className="font-medium">{submitBidRfq?.title}</span>
              </DialogDescription>
            </DialogHeader>
            {submitBidRfq && (
              <div className="space-y-3 py-2">
                <div className="border border-gray-200 rounded p-3 text-xs space-y-1.5">
                  {[
                    ["Budget",   `$${submitBidRfq.maxBudget?.toLocaleString()}`],
                    ["Deadline", submitBidRfq.deadline
                      ? new Date(submitBidRfq.deadline).toLocaleString()
                      : "—"],
                    ["Category", submitBidRfq.category || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bid Amount ($) *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="0.00"
                      className="h-8 text-xs rounded"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Delivery Days</Label>
                    <Input
                      type="number"
                      min="1"
                      value={bidDeliveryDays}
                      onChange={(e) => setBidDeliveryDays(e.target.value)}
                      placeholder="e.g. 14"
                      className="h-8 text-xs rounded"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Technical Proposal</Label>
                  <textarea
                    value={bidProposal}
                    onChange={(e) => setBidProposal(e.target.value)}
                    placeholder="Describe your approach, qualifications, and why you're the best choice..."
                    rows={4}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="rounded"
                onClick={() => setSubmitBidOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded"
                disabled={submitBidLoading || !bidAmount}
                onClick={handleSubmitBid}
              >
                {submitBidLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Submit Bid
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}
