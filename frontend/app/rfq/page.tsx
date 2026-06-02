"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { rfqApi, bidApi, poApi, vendorApi, getVendorNameMap, getCategoryNameMap } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { displayCategoryName, displayVendorName, formatRfqRef } from "@/lib/display";
import { cn } from "@/lib/utils";
import { BidComparisonPanel } from "@/components/bid-comparison-panel";
import { ProcurementPipelineBanner } from "@/components/procurement-pipeline-banner";
import {
  loadVendorKpis,
  normaliseBid,
  collectRfqIdsWithPo,
  buildRfqPoMap,
  hasPoForRfq,
  riskBadgeClass,
  type NormalisedBid,
  type VendorKpi,
  type RfqPoLink,
} from "@/lib/bid-scoring";
import { useToast } from "@/hooks/use-toast";
import { useListDeepLink } from "@/hooks/use-list-deep-link";
import { RFQDialog } from "./rfq-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import {
  Plus, Search, MoreHorizontal, Gavel, Clock, Users, Loader2,
  AlertCircle, TrendingUp, Award, Tag, CheckCircle2, Download,
} from "lucide-react";

function exportRFQsToCSV(rfqs: any[]) {
  const headers = ["RFQ Number", "Title", "Category", "Status", "Budget", "Bid Count", "Deadline", "Created"];
  const rows = rfqs.map((r) => [
    r.rfqNumber || "",
    r.title || "",
    r.category || "",
    r.status || "",
    r.maxBudget ?? "",
    r.bidCount ?? 0,
    r.deadline ? new Date(r.deadline).toLocaleDateString() : "",
    r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rfqs-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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

function daysRemaining(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return { label: "Overdue", urgent: true };
  if (days === 0) return { label: "Due today", urgent: true };
  if (days === 1) return { label: "1 day left", urgent: true };
  if (days <= 3) return { label: `${days} days left`, urgent: true };
  return { label: `${days} days left`, urgent: false };
}

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

export default function RFQPage() {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [filteredRfqs, setFilteredRfqs] = useState<RFQ[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);           // vendor's own bids only
  const [bidsLoading, setBidsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("rfqs");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [rfqToAward, setRfqToAward] = useState<RFQ | null>(null);
  const [bidsToAward, setBidsToAward] = useState<NormalisedBid[]>([]);
  const [awardVendorKpis, setAwardVendorKpis] = useState<Record<string, VendorKpi>>({});
  const [evaluatingAll, setEvaluatingAll] = useState(false);
  const [selectedBidId, setSelectedBidId] = useState<string>("");
  const [detailRfq, setDetailRfq] = useState<RFQ | null>(null);
  const [detailBid, setDetailBid] = useState<Bid | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryMatchOnly, setCategoryMatchOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;

  // Vendor-specific state
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [vendorCategoryId, setVendorCategoryId] = useState<string | null>(null);
  const [myBidRfqIds, setMyBidRfqIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prefillRequisitionId, setPrefillRequisitionId] = useState<string | undefined>();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const user = useAuthStore((state) => state.user);
  const isVendor = hasRole(["VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE"]);
  const canCreateRfq = hasPermission("rfq:create");
  const canCreatePO = hasPermission("po:create");
  const canUpdateRfq = hasPermission("rfq:update");
  const canCloseRfq = hasPermission("rfq:close");
  const canCancelRfq = hasPermission("rfq:cancel");
  const canEvaluateBids = hasPermission("bids:evaluate");
  const canSubmitBid = hasPermission("bids:submit");
  const canExport = hasPermission("reports:view");
  const [rfqIdsWithPo, setRfqIdsWithPo] = useState<Record<string, boolean>>({});
  const [rfqPoLinks, setRfqPoLinks] = useState<Record<string, RfqPoLink>>({});
  const [bidsCompareRfqId, setBidsCompareRfqId] = useState("");
  const [bidsCompareBids, setBidsCompareBids] = useState<NormalisedBid[]>([]);
  const [bidsCompareKpis, setBidsCompareKpis] = useState<Record<string, VendorKpi>>({});
  const [bidsCompareLoading, setBidsCompareLoading] = useState(false);
  const [bidsCompareSelectedId, setBidsCompareSelectedId] = useState("");
  const [bidsEvaluating, setBidsEvaluating] = useState(false);

  const [submitBidOpen, setSubmitBidOpen] = useState(false);
  const [submitBidRfq, setSubmitBidRfq] = useState<RFQ | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidDeliveryDays, setBidDeliveryDays] = useState("");
  const [bidProposal, setBidProposal] = useState("");
  const [submitBidLoading, setSubmitBidLoading] = useState(false);

  // ── Load vendor profile + own bids (vendor only) ───────────────────────────
  useEffect(() => {
    if (!isVendor || !user?.userId) return;

    async function loadVendorData() {
      try {
        const profile = await vendorApi.getByUserId(user!.userId).catch(async () => {
          return vendorApi.initProfile({ email: user!.email, companyName: user!.fullName || user!.email });
        });
        setVendorProfile(profile);
        const catId = profile?.categoryId != null ? String(profile.categoryId) : null;
        setVendorCategoryId(catId);

        const vendorEntityId = profile?.vendorId || profile?.id;
        if (vendorEntityId) {
          const ownBids = (await bidApi.getByVendor(vendorEntityId).catch(() => [])) as any[];
          const rfqTitleMap = new Map<string, string>();
          // We'll fill rfqTitles after RFQs load; for now just store
          const normalized = ownBids.map((b: any) => ({
            ...b,
            id: String(b.bidId || b.id),
            rfqId: String(b.rfqId || ""),
            deliveryTime: b.deliveryTime || (b.deliveryDays ? `${b.deliveryDays} days` : "--"),
          }));
          setMyBids(normalized);
          setMyBidRfqIds(new Set(normalized.map((b: any) => b.rfqId).filter(Boolean)));
        }
      } catch { /* swallow */ }
    }

    loadVendorData();
  }, [isVendor, user?.userId]);

  // After RFQs load, enrich myBids with rfqTitle
  useEffect(() => {
    if (!isVendor || rfqs.length === 0 || myBids.length === 0) return;
    const rfqTitleMap = new Map(rfqs.map((r) => [r.id, r.title]));
    setMyBids((prev) =>
      prev.map((b) => ({
        ...b,
        rfqTitle: rfqTitleMap.get(b.rfqId || "") || b.rfqTitle || (b.rfqId ? `RFQ-${String(b.rfqId).padStart(6, "0")}` : "--"),
      }))
    );
  }, [rfqs, isVendor]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openSubmitBid(rfq: RFQ, e?: React.MouseEvent) {
    e?.stopPropagation();
    setSubmitBidRfq(rfq);
    setBidAmount("");
    setBidDeliveryDays("");
    setBidProposal("");
    setSubmitBidOpen(true);
  }

  async function handleCloseRfq(rfqId: string) {
    try {
      await rfqApi.close(rfqId);
      toast({ title: "RFQ Closed", description: "The RFQ has been closed successfully." });
      loadRFQs(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to close RFQ", variant: "destructive" });
    }
  }

  async function handleCancelRfq(rfqId: string) {
    try {
      await rfqApi.cancel(rfqId);
      toast({ title: "RFQ Cancelled", description: "The RFQ has been cancelled." });
      loadRFQs(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to cancel RFQ", variant: "destructive" });
    }
  }

  async function handleSubmitBid() {
    if (!submitBidRfq || !bidAmount) {
      toast({ title: "Error", description: "Please enter a bid amount", variant: "destructive" });
      return;
    }
    setSubmitBidLoading(true);
    try {
      const userId = user?.id || user?.userId;
      let vendorId: string | number = vendorProfile?.vendorId || vendorProfile?.id || userId || "0";
      if (!vendorProfile && userId) {
        try {
          const p = await vendorApi.getByUserId(userId);
          vendorId = p?.vendorId || p?.id || vendorId;
        } catch { /* keep fallback */ }
      }
      await bidApi.submit({
        rfqId: parseInt(submitBidRfq.id),
        vendorId: parseInt(String(vendorId)),
        bidAmount: parseFloat(bidAmount),
        proposalText: bidProposal || undefined,
        deliveryDays: bidDeliveryDays ? parseInt(bidDeliveryDays) : undefined,
      });
      toast({ title: "Bid Submitted!", description: `Your bid of $${parseFloat(bidAmount).toLocaleString()} has been submitted.` });

      // Update local state so the row badge shows immediately
      setMyBidRfqIds((prev) => new Set(Array.from(prev).concat(submitBidRfq.id)));
      setMyBids((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          rfqId: submitBidRfq.id,
          rfqTitle: submitBidRfq.title,
          vendorName: vendorProfile?.companyName || user?.fullName || "",
          bidAmount: parseFloat(bidAmount),
          deliveryTime: bidDeliveryDays ? `${bidDeliveryDays} days` : "--",
          validityDays: 30,
          status: "SUBMITTED",
        },
      ]);

      setSubmitBidOpen(false);
      setSubmitBidRfq(null);
      loadRFQs(currentPage);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit bid", variant: "destructive" });
    } finally {
      setSubmitBidLoading(false);
    }
  }

  async function openAwardDialog(rfq: RFQ) {
    try {
      const [rankedData, vendorMap] = await Promise.all([
        bidApi.getRanked(rfq.id).catch(() => bidApi.getByRfq(rfq.id)),
        getVendorNameMap(),
      ]);
      const normalised = (rankedData as any[])
        .map((b: any) =>
          normaliseBid(
            {
              ...b,
              vendorName: displayVendorName(b.vendorId, { name: b.vendorName, map: vendorMap }),
            },
            displayVendorName(b.vendorId, { name: b.vendorName, map: vendorMap }),
          ),
        )
        .filter((b) => !["REJECTED", "AWARDED"].includes(b.status?.toUpperCase() ?? ""));
      const kpis = await loadVendorKpis(normalised.map((b) => b.vendorId));
      setAwardVendorKpis(kpis);
      setBidsToAward(normalised);
      setRfqToAward(rfq);
      const topBid = normalised.find((b) => b.score > 0) ?? normalised[0];
      setSelectedBidId(topBid?.id ?? "");
      setAwardDialogOpen(true);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load bids", variant: "destructive" });
    }
  }

  async function handleAward() {
    if (!selectedBidId) {
      toast({ title: "Error", description: "Please select a bid to award", variant: "destructive" });
      return;
    }
    try {
      // Auto-evaluate any unevaluated bids before awarding so the backend guard never fires
      const hasUnevaluated = bidsToAward.some((b: any) => !b.score || b.score === 0);
      if (hasUnevaluated && rfqToAward) {
        await bidApi.evaluateAll(rfqToAward.id);
      }
      await bidApi.award(selectedBidId);
      toast({
        title: "Contract Awarded",
        description: "Opening PO Approval to create the purchase order.",
      });
      setAwardDialogOpen(false);
      const rfqId = rfqToAward?.id;
      setRfqToAward(null);
      setSelectedBidId("");
      loadRFQs(currentPage);
      if (rfqId) router.push(`/procurement?rfqId=${rfqId}`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to award contract", variant: "destructive" });
    }
  }

  const loadRFQs = useCallback(async (page = 0) => {
    try {
      setLoading(true);
      const statusParam =
        statusFilter !== "ALL"
          ? statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()
          : undefined;
      const [response, categoryMap, poList] = await Promise.all([
        rfqApi.getAll({
          page,
          size: PAGE_SIZE,
          search: debouncedSearch,
          status: statusParam,
          categoryId:
            categoryMatchOnly && vendorCategoryId ? Number(vendorCategoryId) : undefined,
          sort: "created-desc",
        }),
        getCategoryNameMap(),
        poApi.getAllList().catch(() => []),
      ]);
      const items = response.content ?? [];
      const normalised = items.map((r: any) => {
        const raw = r.category || r.categoryName || r.categoryId;
        const str = raw != null ? String(raw) : "";
        const category = displayCategoryName(str, { map: categoryMap });
        return {
          ...r,
          id: String(r.id || r.rfqId),
          rfqNumber: r.rfqNumber || `RFQ-${String(r.rfqId || r.id).padStart(6, "0")}`,
          category,
          categoryId: r.categoryId != null ? String(r.categoryId) : undefined,
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
      setRfqIdsWithPo(collectRfqIdsWithPo(poList as any[]));
      setRfqPoLinks(buildRfqPoMap(poList as any[]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load RFQs");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, categoryMatchOnly, vendorCategoryId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearch, statusFilter, categoryMatchOnly]);

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"])) return;
    loadRFQs(currentPage);
  }, [currentPage, loadRFQs]);

  useListDeepLink(rfqs, loading, (rfq) => setDetailRfq(rfq), { paramNames: ["id"] });

  useEffect(() => {
    const requisitionId = searchParams.get("requisitionId");
    if (!requisitionId || !canCreateRfq) return;
    setPrefillRequisitionId(requisitionId);
    setDialogOpen(true);
    router.replace("/rfq", { scroll: false });
  }, [searchParams, canCreateRfq, router]);

  async function loadBidsComparison(rfqId: string) {
    setBidsCompareLoading(true);
    setBidsCompareRfqId(rfqId);
    try {
      const [rankedData, vendorMap] = await Promise.all([
        bidApi.getRanked(rfqId).catch(() => bidApi.getByRfq(rfqId)),
        getVendorNameMap(),
      ]);
      const normalised = (rankedData as any[]).map((b: any) =>
        normaliseBid(
          {
            ...b,
            vendorName: displayVendorName(b.vendorId, { name: b.vendorName, map: vendorMap }),
          },
          displayVendorName(b.vendorId, { name: b.vendorName, map: vendorMap }),
        ),
      );
      const kpis = await loadVendorKpis(normalised.map((b) => b.vendorId));
      setBidsCompareBids(normalised);
      setBidsCompareKpis(kpis);
      const top = normalised.find((b) => b.score > 0) ?? normalised[0];
      setBidsCompareSelectedId(top?.id ?? "");
    } catch {
      setBidsCompareBids([]);
      setBidsCompareKpis({});
    } finally {
      setBidsCompareLoading(false);
    }
  }

  async function loadBids(rfqId: string) {
    try {
      const [data, vendorMap] = await Promise.all([bidApi.getByRfq(rfqId), getVendorNameMap()]);
      const normalised = (data as any[]).map((b: any) => ({
        ...b,
        id: String(b.id || b.bidId),
        vendorName: displayVendorName(b.vendorId, { name: b.vendorName, map: vendorMap }),
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
              vendorId: bid.vendorId,
              vendorName: displayVendorName(bid.vendorId, { name: bid.vendorName, map: vendorMap }),
              deliveryTime: bid.deliveryTime || (bid.deliveryDays ? `${bid.deliveryDays} days` : "--"),
              score: bid.score ?? (bid.totalScore ? Math.round(Number(bid.totalScore)) : 0),
              rfqId: rfqs[idx].id,
              rfqTitle: rfqs[idx].title,
            });
          });
        }
      });
      setAllBids(merged);
      if (bidsCompareRfqId) {
        const kpis = await loadVendorKpis(
          merged.filter((b) => b.rfqId === bidsCompareRfqId).map((b) => String(b.vendorId ?? "")),
        );
        setBidsCompareKpis((prev) => ({ ...prev, ...kpis }));
      }
    } catch { /* silently fail */ } finally {
      setBidsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "bids" && !isVendor && rfqs.length > 0 && allBids.length === 0) {
      loadAllBids();
    }
  }, [activeTab, rfqs, isVendor]);

  useEffect(() => {
    if (activeTab !== "bids" || isVendor || rfqs.length === 0) return;
    const candidates = rfqs.filter(
      (r) =>
        (r.bidCount ?? 0) > 0 &&
        !["AWARDED", "CANCELLED"].includes(r.status?.toUpperCase() ?? ""),
    );
    if (candidates.length === 0) return;
    const preferred =
      candidates.find((r) => r.status?.toUpperCase() === "CLOSED") ?? candidates[0];
    if (!bidsCompareRfqId || !candidates.some((r) => r.id === bidsCompareRfqId)) {
      loadBidsComparison(preferred.id);
    }
  }, [activeTab, rfqs, isVendor, bidsCompareRfqId]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const openCount = rfqs.filter((r) => r.status?.toUpperCase() === "OPEN").length;
  const matchingCount = vendorCategoryId
    ? rfqs.filter((r) => r.status?.toUpperCase() === "OPEN" && String(r.categoryId) === vendorCategoryId).length
    : 0;
  const totalBids = rfqs.reduce((s, r) => s + (r.bidCount || 0), 0);
  const closingSoon = rfqs.filter((r) => {
    if (r.status?.toUpperCase() !== "OPEN" || !r.deadline) return false;
    const days = Math.ceil((new Date(r.deadline).getTime() - Date.now()) / 86_400_000);
    return days <= 3 && days >= 0;
  }).length;
  const awardedCount = rfqs.filter((r) => r.status?.toUpperCase() === "AWARDED").length;
  const awardedNeedsPo = rfqs.filter(
    (r) => r.status?.toUpperCase() === "AWARDED" && !hasPoForRfq(rfqIdsWithPo, r.id),
  );
  const rfqsForBidCompare = rfqs.filter(
    (r) =>
      (r.bidCount ?? 0) > 0 &&
      !["AWARDED", "CANCELLED"].includes(r.status?.toUpperCase() ?? ""),
  );
  const bidsCompareRfq = rfqs.find((r) => r.id === bidsCompareRfqId);
  const displayedBids = isVendor
    ? myBids
    : bidsCompareRfqId
    ? allBids.filter((b) => b.rfqId === bidsCompareRfqId)
    : allBids;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-4">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isVendor ? "Open RFQs" : "RFQ & Bidding"}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {isVendor
                  ? "Browse opportunities and submit bids"
                  : "Manage requests and vendor bids"}
              </p>
            </div>
            <div className="flex gap-2">
              {!isVendor && (
                <Button variant="outline" size="sm" className="text-xs h-8 rounded" onClick={() => router.push("/analytics")}>
                  Analytics
                </Button>
              )}
              {canExport && filteredRfqs.length > 0 && (
                <Button variant="outline" size="sm" className="text-xs h-8 rounded gap-1.5" onClick={() => exportRFQsToCSV(filteredRfqs)}>
                  <Download className="h-3.5 w-3.5" />Export CSV
                </Button>
              )}
              {canCreateRfq && (
                <Button size="sm" className="text-xs h-8 rounded" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Create RFQ
                </Button>
              )}
            </div>
          </div>

          {!isVendor && <ProcurementPipelineBanner activeStep="award" />}

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200 border border-gray-200 rounded">
            {(isVendor ? [
              { label: "Open RFQs",       value: openCount,    iconEl: <Gavel className="h-5 w-5 text-gray-300" /> },
              { label: "Matching My Categories", value: matchingCount, iconEl: <Tag className="h-5 w-5 text-gray-300" /> },
              { label: "My Bids",         value: myBids.length, iconEl: <TrendingUp className="h-5 w-5 text-gray-300" /> },
              { label: "Closing Soon",    value: closingSoon,   iconEl: <Clock className="h-5 w-5 text-gray-300" /> },
            ] : [
              { label: "Open RFQs",    value: openCount,    iconEl: <Gavel className="h-5 w-5 text-gray-300" /> },
              { label: "Total Bids",   value: totalBids,    iconEl: <TrendingUp className="h-5 w-5 text-gray-300" /> },
              { label: "Closing Soon", value: closingSoon,  iconEl: <Clock className="h-5 w-5 text-gray-300" /> },
              { label: "Awarded",      value: awardedCount, iconEl: <Award className="h-5 w-5 text-gray-300" /> },
            ]).map(({ label, value, iconEl }) => (
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

          {/* Closing-soon warning */}
          {!loading && closingSoon > 0 && (
            <div className="flex items-center gap-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800">
                {isVendor
                  ? <><span className="font-semibold">{closingSoon} RFQ{closingSoon > 1 ? "s" : ""}</span> closing within 3 days. Submit your bid before the deadline.</>
                  : <>Some RFQs are <span className="font-semibold">closing within 3 days</span>. Review bids and award contracts before the deadline.</>
                }
              </p>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 w-full justify-start rounded-none border-b border-gray-200 bg-transparent p-0 gap-0">
              {(isVendor
                ? [{ value: "rfqs", label: "Available RFQs" }, { value: "bids", label: `My Bids (${myBids.length})` }]
                : [{ value: "rfqs", label: "RFQs" }, { value: "bids", label: "Bids" }, { value: "awarded", label: "Awarded" }]
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
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-700">
                    {isVendor ? "Requests for Quotation" : "Request for Quotations"}
                  </span>
                  <div className="flex gap-2 flex-wrap items-center">
                    {/* Category match toggle — vendor only */}
                    {isVendor && vendorCategoryId && (
                      <button
                        onClick={() => setCategoryMatchOnly((v) => !v)}
                        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded text-[11px] font-medium border transition-colors ${
                          categoryMatchOnly
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        <Tag className="h-3 w-3" />
                        My categories
                      </button>
                    )}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        type="search"
                        placeholder="Search RFQs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-[180px] h-8 text-xs border-gray-200 rounded"
                      />
                    </div>
                    {!isVendor && (
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
                    )}
                    {isVendor && (
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 text-xs w-[130px] rounded">
                          <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Open only</SelectItem>
                          <SelectItem value="AWARDED">Awarded</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                          <SelectItem value="EVALUATING">Evaluating</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">RFQ</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Category</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      {!isVendor && <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-center">Bids</TableHead>}
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Budget</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Deadline</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-right">
                        {isVendor ? "Action" : "Actions"}
                      </TableHead>
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
                            {searchQuery
                              ? "No RFQs match your search."
                              : categoryMatchOnly
                              ? "No open RFQs match your registered categories."
                              : isVendor
                              ? "No open RFQs at this time. Check back soon."
                              : "No RFQs yet."}
                          </p>
                          {categoryMatchOnly && (
                            <button
                              onClick={() => setCategoryMatchOnly(false)}
                              className="text-[10px] text-primary hover:underline mt-1"
                            >
                              Show all open RFQs
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRfqs.map((rfq) => {
                        const deadline = rfq.deadline ? daysRemaining(rfq.deadline) : null;
                        const alreadyBid = myBidRfqIds.has(rfq.id);
                        const isMatching = vendorCategoryId && String(rfq.categoryId) === vendorCategoryId;
                        const isOpen = rfq.status?.toUpperCase() === "OPEN";
                        return (
                          <TableRow
                            key={rfq.id}
                            className={`border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer ${isMatching && isVendor ? "bg-blue-50/30" : ""}`}
                            onClick={() => setDetailRfq(rfq)}
                          >
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-1.5">
                                <div>
                                  <p className="text-xs font-medium font-mono">{rfq.rfqNumber}</p>
                                  {rfq.title && (
                                    <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{rfq.title}</p>
                                  )}
                                </div>
                                {isVendor && isMatching && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                                    <Tag className="h-2.5 w-2.5" />match
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-gray-600 py-2.5">{rfq.category || "—"}</TableCell>
                            <TableCell className="py-2.5"><Chip status={rfq.status} /></TableCell>
                            {!isVendor && (
                              <TableCell className="py-2.5 text-center">
                                {rfq.bidCount > 0 ? (
                                  <span className="text-xs font-bold text-blue-600">{rfq.bidCount}</span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">—</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="text-xs font-semibold text-gray-900 py-2.5">
                              {rfq.maxBudget ? `$${rfq.maxBudget.toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell className="py-2.5">
                              {deadline ? (
                                <span className={`text-[10px] font-medium ${deadline.urgent ? "text-red-600" : "text-gray-500"}`}>
                                  {deadline.label}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">No deadline</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5" onClick={(e) => e.stopPropagation()}>
                              {isVendor ? (
                                alreadyBid ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                                    <CheckCircle2 className="h-3 w-3" />Bid submitted
                                  </span>
                                ) : isOpen ? (
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px] rounded"
                                    onClick={(e) => openSubmitBid(rfq, e)}
                                  >
                                    Submit Bid
                                  </Button>
                                ) : (
                                  <span className="text-[10px] text-gray-400">Closed</span>
                                )
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="text-xs">
                                    <DropdownMenuItem className="text-xs" onClick={() => setDetailRfq(rfq)}>
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-xs" onClick={() => { setActiveTab("bids"); loadBidsComparison(rfq.id); }}>
                                      View Bids &amp; Scores
                                    </DropdownMenuItem>
                                    {canSubmitBid && isOpen && (
                                      <DropdownMenuItem className="text-xs" onClick={() => openSubmitBid(rfq)}>
                                        Submit Bid
                                      </DropdownMenuItem>
                                    )}
                                    {canCloseRfq && isOpen && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-xs" onClick={() => handleCloseRfq(rfq.id)}>
                                          Close RFQ
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {canCancelRfq && isOpen && (
                                      <DropdownMenuItem className="text-xs text-red-600" onClick={() => handleCancelRfq(rfq.id)}>
                                        Cancel RFQ
                                      </DropdownMenuItem>
                                    )}
                                    {canUpdateRfq && isOpen && (
                                      <DropdownMenuItem className="text-xs" onClick={() => { setSelectedRfq(rfq); setDialogOpen(true); }}>
                                        Edit RFQ
                                      </DropdownMenuItem>
                                    )}
                                    {canEvaluateBids && ["EVALUATING", "CLOSED"].includes(rfq.status?.toUpperCase()) && (
                                      <DropdownMenuItem className="text-xs" onClick={() => openAwardDialog(rfq)}>
                                        Award Contract
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
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

            {/* ── Bids tab (admin: all bids | vendor: my bids) ───────── */}
            <TabsContent value="bids" className="mt-0">
              <div className="border border-t-0 border-gray-200 rounded-b">
                {!isVendor && (
                  <div className="px-4 py-3 border-b border-gray-100 space-y-3 bg-gray-50/50">
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1 min-w-[200px] flex-1">
                        <Label className="text-[10px] text-gray-500">Compare bids for RFQ</Label>
                        <Select
                          value={bidsCompareRfqId || "__none__"}
                          onValueChange={(v) => v !== "__none__" && loadBidsComparison(v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select an RFQ with bids…" />
                          </SelectTrigger>
                          <SelectContent>
                            {rfqsForBidCompare.length === 0 ? (
                              <SelectItem value="__none__" disabled>No RFQs with bids to compare</SelectItem>
                            ) : (
                              rfqsForBidCompare.map((r) => (
                                <SelectItem key={r.id} value={r.id} className="text-xs">
                                  {r.title} ({r.status}) · {r.bidCount} bid{r.bidCount !== 1 ? "s" : ""}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {bidsCompareRfq && ["CLOSED", "EVALUATING"].includes(bidsCompareRfq.status?.toUpperCase()) && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={bidsEvaluating || bidsCompareBids.length === 0}
                            onClick={async () => {
                              if (!bidsCompareRfqId) return;
                              setBidsEvaluating(true);
                              try {
                                await bidApi.evaluateAll(bidsCompareRfqId);
                                await loadBidsComparison(bidsCompareRfqId);
                                toast({ title: "Bids evaluated", description: "Scores and KPIs updated." });
                              } catch (err) {
                                toast({
                                  title: "Error",
                                  description: err instanceof Error ? err.message : "Evaluate failed — close the RFQ first.",
                                  variant: "destructive",
                                });
                              } finally {
                                setBidsEvaluating(false);
                              }
                            }}
                          >
                            {bidsEvaluating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Evaluate All
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs"
                            disabled={bidsCompareBids.length === 0}
                            onClick={() => bidsCompareRfq && openAwardDialog(bidsCompareRfq)}
                          >
                            <Award className="h-3 w-3 mr-1" />
                            Award Contract
                          </Button>
                        </>
                      )}
                    </div>
                    {bidsCompareLoading ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading bid scores and vendor KPIs…
                      </p>
                    ) : bidsCompareBids.length > 0 ? (
                      <BidComparisonPanel
                        bids={bidsCompareBids}
                        vendorKpis={bidsCompareKpis}
                        selectedBidId={bidsCompareSelectedId}
                        onSelectBid={setBidsCompareSelectedId}
                      />
                    ) : bidsCompareRfqId ? (
                      <p className="text-xs text-gray-500">No bids submitted for this RFQ yet.</p>
                    ) : null}
                  </div>
                )}
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-700">
                    {isVendor ? "My Submitted Bids" : "All bids" + (bidsCompareRfqId ? ` · ${bidsCompareRfq?.title ?? ""}` : "")}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Bid #</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">RFQ</TableHead>
                      {!isVendor && <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Vendor</TableHead>}
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Amount</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Delivery</TableHead>
                      {!isVendor && (
                        <>
                          <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Score</TableHead>
                          <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Risk</TableHead>
                        </>
                      )}
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidsLoading ? (
                      <TableRow>
                        <TableCell colSpan={isVendor ? 7 : 9} className="text-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                        </TableCell>
                      </TableRow>
                    ) : displayedBids.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isVendor ? 7 : 9} className="text-center py-12">
                          <Users className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                          <p className="text-xs font-medium text-gray-500">
                            {isVendor ? "You haven't submitted any bids yet." : "No bids loaded yet."}
                          </p>
                          {isVendor && (
                            <button className="text-[10px] text-primary hover:underline mt-1" onClick={() => setActiveTab("rfqs")}>
                              Browse open RFQs
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedBids.map((bid) => {
                        const kpi = bid.vendorId ? bidsCompareKpis[String(bid.vendorId)] : undefined;
                        return (
                        <TableRow
                          key={bid.id}
                          className="border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer"
                          onClick={() => setDetailBid(bid)}
                        >
                          <TableCell className="py-2.5">
                            <p className="text-xs font-medium font-mono">BID-{String(bid.id).padStart(4, "0")}</p>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 py-2.5 max-w-[140px] truncate">
                            {bid.rfqTitle || formatRfqRef(bid.rfqId)}
                          </TableCell>
                          {!isVendor && (
                            <TableCell className="text-xs text-gray-700 py-2.5">{bid.vendorName}</TableCell>
                          )}
                          <TableCell className="text-xs font-semibold text-gray-900 py-2.5">
                            ${bid.bidAmount?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 py-2.5">{bid.deliveryTime}</TableCell>
                          {!isVendor && (
                            <>
                              <TableCell className="text-xs font-semibold py-2.5">
                                {(bid as any).score > 0 ? (bid as any).score : "—"}
                              </TableCell>
                              <TableCell className="py-2.5">
                                {kpi ? (
                                  <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium", riskBadgeClass(kpi.riskLevel))}>
                                    {kpi.riskLevel}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">—</span>
                                )}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="py-2.5"><Chip status={bid.status} /></TableCell>
                          <TableCell className="text-right py-2.5" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] rounded" onClick={() => setDetailBid(bid)}>
                              {isVendor ? "View bid" : "Review"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── Awarded tab (admin only) ──────────────────────────────── */}
            {!isVendor && (
              <TabsContent value="awarded" className="mt-0">
                <div className="border border-t-0 border-gray-200 rounded-b">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-700">
                      Awarded Contracts
                      {awardedNeedsPo.length > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                          {awardedNeedsPo.length} need PO
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
                        <TableHead className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {awardedNeedsPo.length === 0 && awardedCount === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <Award className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs font-medium text-gray-500">No awarded contracts yet.</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rfqs
                          .filter((r) => r.status?.toUpperCase() === "AWARDED" && !hasPoForRfq(rfqIdsWithPo, r.id))
                          .map((rfq) => (
                          <TableRow
                            key={rfq.id}
                            className="border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer"
                            onClick={() => setDetailRfq(rfq)}
                          >
                            <TableCell className="py-2.5">
                              <p className="text-xs font-medium font-mono">{rfq.rfqNumber || rfq.id}</p>
                            </TableCell>
                            <TableCell className="text-xs text-gray-700 py-2.5">{rfq.title}</TableCell>
                            <TableCell className="text-xs text-gray-600 py-2.5">{rfq.category || "—"}</TableCell>
                            <TableCell className="text-xs font-semibold text-gray-900 py-2.5">
                              {rfq.maxBudget ? `$${rfq.maxBudget.toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 py-2.5">
                              {rfq.deadline ? new Date(rfq.deadline).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                              {canCreatePO && (
                                <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                                  <Link href={`/procurement?rfqId=${rfq.id}`}>Create PO</Link>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      {awardedCount > awardedNeedsPo.length && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-3 bg-gray-50/80">
                            <p className="text-[10px] text-gray-500 px-2">
                              {awardedCount - awardedNeedsPo.length} awarded RFQ(s) already have a PO —{" "}
                              <Link href="/procurement" className="text-emerald-700 hover:underline">view in PO Approval</Link>
                            </p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* ── Create / Edit RFQ dialog ───────────────────────────────────────── */}
        <RFQDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) {
              setSelectedRfq(null);
              setPrefillRequisitionId(undefined);
            }
          }}
          onSuccess={loadRFQs}
          initialData={selectedRfq}
          initialRequisitionId={prefillRequisitionId}
        />

        {/* ── RFQ Detail Dialog ──────────────────────────────────────────────── */}
        <Dialog open={!!detailRfq} onOpenChange={(o) => !o && setDetailRfq(null)}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">{detailRfq?.rfqNumber} — {detailRfq?.title}</DialogTitle>
              <DialogDescription className="text-xs">Request for Quotation details</DialogDescription>
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
                    <p className="font-medium text-gray-800">{detailRfq.maxBudget ? `$${detailRfq.maxBudget.toLocaleString()}` : "—"}</p>
                  </div>
                  {!isVendor && (
                    <div>
                      <p className="text-gray-400 mb-1">Bids Received</p>
                      <p className="font-medium text-gray-800">{detailRfq.bidCount}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 mb-1">Deadline</p>
                    <p className="font-medium text-gray-800">
                      {detailRfq.deadline ? new Date(detailRfq.deadline).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Created</p>
                    <p className="font-medium text-gray-800">
                      {detailRfq.createdAt ? new Date(detailRfq.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                {detailRfq.description && (
                  <div className="text-xs">
                    <p className="text-gray-400 mb-1">Description</p>
                    <p className="text-gray-700">{detailRfq.description}</p>
                  </div>
                )}
                {isVendor && myBidRfqIds.has(detailRfq.id) && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded px-3 py-2 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    You have already submitted a bid for this RFQ.
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="rounded" onClick={() => setDetailRfq(null)}>Close</Button>
              {!isVendor && detailRfq && (detailRfq.bidCount ?? 0) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded"
                  onClick={() => {
                    const rfq = detailRfq;
                    setDetailRfq(null);
                    setActiveTab("bids");
                    loadBidsComparison(rfq.id);
                  }}
                >
                  View Scores
                </Button>
              )}
              {canEvaluateBids && detailRfq && ["EVALUATING", "CLOSED"].includes(detailRfq.status?.toUpperCase()) && (
                <Button size="sm" className="rounded" onClick={() => { const rfq = detailRfq; setDetailRfq(null); openAwardDialog(rfq); }}>
                  <Award className="mr-1.5 h-3.5 w-3.5" />Award
                </Button>
              )}
              {canCreatePO && detailRfq?.status?.toUpperCase() === "AWARDED" && !hasPoForRfq(rfqIdsWithPo, detailRfq.id) && (
                <Button size="sm" className="rounded" asChild>
                  <Link href={`/procurement?rfqId=${detailRfq.id}`} onClick={() => setDetailRfq(null)}>Create PO</Link>
                </Button>
              )}
              {detailRfq && hasPoForRfq(rfqIdsWithPo, detailRfq.id) && rfqPoLinks[detailRfq.id] && (
                <Button size="sm" variant="outline" className="rounded" asChild>
                  <Link href={`/procurement?id=${rfqPoLinks[detailRfq.id].poId}`} onClick={() => setDetailRfq(null)}>
                    View PO ({rfqPoLinks[detailRfq.id].poNumber})
                  </Link>
                </Button>
              )}
              {canUpdateRfq && detailRfq?.status?.toUpperCase() === "OPEN" && (
                <Button size="sm" className="rounded" onClick={() => { setSelectedRfq(detailRfq); setDetailRfq(null); setDialogOpen(true); }}>
                  Edit RFQ
                </Button>
              )}
              {isVendor && detailRfq?.status?.toUpperCase() === "OPEN" && !myBidRfqIds.has(detailRfq.id) && (
                <Button
                  size="sm"
                  className="rounded"
                  onClick={() => { const rfq = detailRfq; setDetailRfq(null); openSubmitBid(rfq); }}
                >
                  <Gavel className="mr-1.5 h-3.5 w-3.5" />Submit Bid
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Bid Detail Dialog ─────────────────────────────────────────────── */}
        <Dialog open={!!detailBid} onOpenChange={(o) => !o && setDetailBid(null)}>
          <DialogContent className="sm:max-w-[480px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {isVendor ? "Your Bid" : "Bid Review"} — {detailBid?.rfqTitle || (detailBid?.rfqId ? `RFQ-${String(detailBid.rfqId).padStart(6, "0")}` : "RFQ")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isVendor ? "Your submitted bid details" : "Vendor bid details and scoring"}
              </DialogDescription>
            </DialogHeader>
            {detailBid && (
              <div className="py-2 space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                  {!isVendor && (
                    <div>
                      <p className="text-gray-400 mb-1">Vendor</p>
                      <p className="font-medium text-gray-800">{detailBid.vendorName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400 mb-1">Status</p>
                    <Chip status={detailBid.status} />
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Bid Amount</p>
                    <p className="font-medium text-gray-800 text-base">${(detailBid as any).bidAmount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Delivery Time</p>
                    <p className="font-medium text-gray-800">{detailBid.deliveryTime}</p>
                  </div>
                  {!isVendor && (
                    <div className="col-span-2">
                      <p className="text-gray-400 mb-1">Score</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Progress value={detailBid.score || 0} className="w-24 h-2" />
                        <span className="font-medium text-gray-800">{detailBid.score || 0}%</span>
                      </div>
                    </div>
                  )}
                </div>
                {(detailBid as any).proposalText && (
                  <div className="text-xs">
                    <p className="text-gray-400 mb-1">Proposal</p>
                    <p className="text-gray-700">{(detailBid as any).proposalText}</p>
                  </div>
                )}
                {isVendor && detailBid.status?.toUpperCase() === "AWARDED" && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded px-3 py-2 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Congratulations! Your bid has been awarded the contract.
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" className="rounded" onClick={() => setDetailBid(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Award Contract Dialog ──────────────────────────────────────────── */}
        <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
          <DialogContent className="sm:max-w-[720px] rounded max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">Award Contract</DialogTitle>
              <DialogDescription className="text-xs">
                Compare bid scores and vendor history KPIs for {rfqToAward?.title}. Confirm the recommended winner or select another row.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {bidsToAward.length === 0 ? (
                <p className="text-xs text-gray-500">No submitted bids available for this RFQ.</p>
              ) : (
                <div className="space-y-3">
                  {bidsToAward.some((b) => !b.score || b.score === 0) && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded px-3 py-2">
                      <p className="text-[11px] text-amber-700">Bids must be scored before awarding.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px]"
                        disabled={evaluatingAll}
                        onClick={async () => {
                          if (!rfqToAward) return;
                          setEvaluatingAll(true);
                          try {
                            await bidApi.evaluateAll(rfqToAward.id);
                            const [updated, vendorMap] = await Promise.all([
                              bidApi.getRanked(rfqToAward.id).catch(() => bidApi.getByRfq(rfqToAward.id)),
                              getVendorNameMap(),
                            ]);
                            const refreshed = (updated as any[])
                              .map((b: any) =>
                                normaliseBid(
                                  {
                                    ...b,
                                    vendorName: displayVendorName(b.vendorId, { name: b.vendorName, map: vendorMap }),
                                  },
                                  displayVendorName(b.vendorId, { name: b.vendorName, map: vendorMap }),
                                ),
                              )
                              .filter((b) => !["REJECTED", "AWARDED"].includes(b.status?.toUpperCase() ?? ""));
                            const kpis = await loadVendorKpis(refreshed.map((b) => b.vendorId));
                            setAwardVendorKpis(kpis);
                            setBidsToAward(refreshed);
                            const top = refreshed.find((b) => b.score > 0) ?? refreshed[0];
                            if (top) setSelectedBidId(top.id);
                            toast({ title: "Bids evaluated", description: "Scores and KPIs updated." });
                          } catch (err) {
                            toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to evaluate bids. RFQ may still be open.", variant: "destructive" });
                          } finally {
                            setEvaluatingAll(false);
                          }
                        }}
                      >
                        {evaluatingAll ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Evaluate All Bids
                      </Button>
                    </div>
                  )}
                  <BidComparisonPanel
                    bids={bidsToAward}
                    vendorKpis={awardVendorKpis}
                    selectedBidId={selectedBidId}
                    onSelectBid={setSelectedBidId}
                  />
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" className="rounded" onClick={() => setAwardDialogOpen(false)}>Cancel</Button>
              <Button size="sm" className="rounded" onClick={handleAward} disabled={!selectedBidId || bidsToAward.length === 0}>
                Award Contract
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Submit Bid Dialog ─────────────────────────────────────────────── */}
        <Dialog open={submitBidOpen} onOpenChange={(o) => { if (!o) { setSubmitBidOpen(false); setSubmitBidRfq(null); } }}>
          <DialogContent className="sm:max-w-[500px] rounded">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <Gavel className="h-4 w-4 text-primary" />
                Submit Your Bid
              </DialogTitle>
              <DialogDescription className="text-xs">
                {submitBidRfq?.title} &mdash; Budget: {submitBidRfq?.maxBudget ? `$${submitBidRfq.maxBudget.toLocaleString()}` : "Not specified"}
              </DialogDescription>
            </DialogHeader>
            {submitBidRfq && (
              <div className="space-y-3 py-2">
                {/* RFQ summary strip */}
                <div className="rounded border border-gray-100 bg-gray-50 p-3 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-gray-400 mb-0.5">Category</p>
                    <p className="font-medium text-gray-700">{submitBidRfq.category || "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Budget</p>
                    <p className="font-medium text-gray-700">{submitBidRfq.maxBudget ? `$${submitBidRfq.maxBudget.toLocaleString()}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5">Deadline</p>
                    <p className={`font-medium ${submitBidRfq.deadline && daysRemaining(submitBidRfq.deadline).urgent ? "text-red-600" : "text-gray-700"}`}>
                      {submitBidRfq.deadline ? daysRemaining(submitBidRfq.deadline).label : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Bid Amount ($) *</Label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="0.00" className="h-8 text-xs rounded"
                    />
                    {submitBidRfq.maxBudget && bidAmount && parseFloat(bidAmount) > submitBidRfq.maxBudget && (
                      <p className="text-[10px] text-amber-600">Exceeds budget of ${submitBidRfq.maxBudget.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Delivery Days</Label>
                    <Input
                      type="number" min="1"
                      value={bidDeliveryDays} onChange={(e) => setBidDeliveryDays(e.target.value)}
                      placeholder="e.g. 14" className="h-8 text-xs rounded"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Technical Proposal</Label>
                  <textarea
                    value={bidProposal} onChange={(e) => setBidProposal(e.target.value)}
                    placeholder="Describe your approach, qualifications, past experience with similar work, and why you're the best choice for this RFQ..."
                    rows={5}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" className="rounded" onClick={() => setSubmitBidOpen(false)}>Cancel</Button>
              <Button size="sm" className="rounded" disabled={submitBidLoading || !bidAmount} onClick={handleSubmitBid}>
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
