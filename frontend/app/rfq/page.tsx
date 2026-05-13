"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  DropdownMenuLabel,
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
  Filter, 
  MoreHorizontal, 
  Gavel,
  Clock,
  CheckCircle,
  Users,
  Calendar,
  Loader2,
  X,
  DollarSign,
  FileText
} from "lucide-react";

interface RFQ {
  id: string;
  rfqNumber: string;
  title: string;
  description: string;
  category?: string;
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
}

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

  async function handleCloseRfq(rfqId: string) {
    try {
      await rfqApi.close(rfqId);
      toast({ title: "RFQ Closed", description: "The RFQ has been closed successfully." });
      loadRFQs();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to close RFQ",
        variant: "destructive"
      });
    }
  }

  async function handleGeneratePO() {
    if (!generatePoData) return;
    setGeneratePoLoading(true);
    try {
      const vendorList = await vendorApi.getAllList().catch(() => []);
      const bid = generatePoData.bid as any;
      const vendorId = bid.vendorId || (vendorList as any[]).find((v: any) => v.companyName === bid.vendorName)?.vendorId || 0;
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
      const vendorId = user?.id || user?.userId;
      await bidApi.submit({
        rfqId: parseInt(submitBidRfq.id),
        vendorId: parseInt(String(vendorId || "0")),
        bidAmount: parseFloat(bidAmount),
        proposalText: bidProposal || undefined,
        deliveryDays: bidDeliveryDays ? parseInt(bidDeliveryDays) : undefined,
      });
      toast({ title: "Bid Submitted", description: `Your bid of $${parseFloat(bidAmount).toLocaleString()} has been submitted.` });
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
        vendorName: b.vendorName || vendorMap.get(String(b.vendorId || "")) || (b.vendorId ? `Vendor #${b.vendorId}` : "Unknown Vendor"),
        deliveryTime: b.deliveryTime || (b.deliveryDays ? `${b.deliveryDays} days` : "--"),
        score: b.score ?? (b.totalScore ? Math.round(Number(b.totalScore)) : 0),
      }));
      // Accept any non-rejected, non-awarded bid
      const eligible = normalised.filter((b: any) =>
        !["REJECTED", "Rejected", "AWARDED", "Awarded"].includes(b.status)
      );
      setBidsToAward(eligible);
      setRfqToAward(rfq);
      setSelectedBidId("");
      setAwardDialogOpen(true);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load bids",
        variant: "destructive"
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
      // Offer to generate PO immediately
      const bid = bidsToAward.find(b => b.id === selectedBidId);
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
        variant: "destructive"
      });
    }
  }

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
      
      // Debug: Log category map contents
      console.log('Category map loaded:', Array.from(categoryMap.entries()));
      console.log('Sample RFQ data:', items.slice(0, 2));
      const normalised = items.map((r: any) => {
        // Resolve category: backend may return categoryName already, or just categoryId
        const rawCategory = r.category || r.categoryName || "";
        let category = rawCategory;
        
        // If backend already returned a resolved name (not starting with "Category #"), use it
        if (rawCategory && !rawCategory.startsWith("Category #")) {
          category = rawCategory;
        }
        // If it looks like a number (raw ID), resolve it from the map
        else if (/^\d+$/.test(String(rawCategory))) {
          const resolvedName = categoryMap.get(String(rawCategory));
          if (resolvedName) {
            category = resolvedName;
          } else {
            // Try to get category name from backend if map is empty
            console.log(`Category map missing ID ${rawCategory}, map size: ${categoryMap.size}`);
            category = `Category #${rawCategory}`;
          }
        } else if (!rawCategory) {
          // Handle empty or null category
          category = "Uncategorized";
        }
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

  // Filter RFQs based on search query and status filter
  useEffect(() => {
    let filtered = rfqs;
    if (statusFilter !== "ALL") {
      filtered = filtered.filter(r => r.status?.toUpperCase() === statusFilter);
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
      const [data, vendorMap] = await Promise.all([
        bidApi.getByRfq(rfqId),
        getVendorNameMap(),
      ]);
      const normalised = (data as any[]).map((b: any) => ({
        ...b,
        id: String(b.id || b.bidId),
        vendorName: b.vendorName || vendorMap.get(String(b.vendorId || "")) || (b.vendorId ? `Vendor #${b.vendorId}` : "Unknown Vendor"),
        deliveryTime: b.deliveryTime || (b.deliveryDays ? `${b.deliveryDays} days` : "--"),
        score: b.score ?? (b.totalScore ? Math.round(Number(b.totalScore)) : 0),
      }));
      setBids(normalised);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bids");
    }
  }

  // Load all bids across all RFQs for the Bids tab
  async function loadAllBids() {
    if (rfqs.length === 0) return;
    try {
      setBidsLoading(true);
      const [results, vendorMap] = await Promise.all([
        Promise.allSettled(rfqs.map(r => bidApi.getByRfq(r.id))),
        getVendorNameMap(),
      ]);
      const merged: Bid[] = [];
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          (result.value as any[]).forEach((bid: any) => {
            merged.push({
              ...bid,
              id: String(bid.id || bid.bidId),
              vendorName: bid.vendorName || vendorMap.get(String(bid.vendorId || "")) || (bid.vendorId ? `Vendor #${bid.vendorId}` : "Unknown Vendor"),
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

  // When switching to bids tab, load all bids
  useEffect(() => {
    if (activeTab === "bids" && rfqs.length > 0 && allBids.length === 0) {
      loadAllBids();
    }
  }, [activeTab, rfqs]);

  const getStatusVariant = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'OPEN': return 'success';
      case 'CLOSED': return 'secondary';
      case 'AWARDED': return 'default';
      case 'EVALUATING': return 'warning';
      default: return 'outline';
    }
  };
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">RFQ & Bidding</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage requests and vendor bids</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => router.push('/analytics')}>Analytics</Button>
            {canCreateRfq && (
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create RFQ
            </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3">
              <p className="text-xs text-blue-600">Active RFQs</p>
              <p className="text-xl font-semibold text-blue-700 mt-1">{loading ? "-" : rfqs.filter(r => r.status === "OPEN").length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Total RFQs</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "-" : rfqs.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <p className="text-xs text-amber-600">Closing Soon</p>
              <p className="text-xl font-semibold text-amber-700 mt-1">
                {loading ? "-" : rfqs.filter(r => {
                  if (r.status !== "OPEN" || !r.deadline) return false;
                  const deadline = new Date(r.deadline);
                  const now = new Date();
                  const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return diffDays <= 3 && diffDays >= 0;
                }).length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Closed RFQs</p>
              <p className="text-xl font-semibold text-gray-700 mt-1">{loading ? "-" : rfqs.filter(r => r.status === "CLOSED").length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="rfqs" className="space-y-4" onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rfqs">RFQs</TabsTrigger>
            <TabsTrigger value="bids">Bids</TabsTrigger>
            <TabsTrigger value="awarded">Awarded</TabsTrigger>
          </TabsList>

          <TabsContent value="rfqs" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Request for Quotations</CardTitle>
                  <CardDescription>Manage all RFQs and their status</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search RFQs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-full sm:w-[300px]"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-9">
                      <Filter className="mr-1.5 h-3.5 w-3.5" />
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                      <SelectItem value="AWARDED">Awarded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RFQ ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Bids</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRfqs.map((rfq) => (
                      <TableRow key={rfq.id}>
                        <TableCell className="font-medium">{rfq.rfqNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rfq.title}</p>
                            <p className="text-xs text-muted-foreground">{rfq.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{rfq.category}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(rfq.status)}>
                            {rfq.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {rfq.bidCount}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">${rfq.maxBudget?.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {rfq.deadline ? new Date(rfq.deadline).toLocaleDateString() : "--"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDetailRfq(rfq)}>View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setActiveTab("bids"); loadBids(rfq.id); }}>View Bids</DropdownMenuItem>
                              {canSubmitBid && rfq.status?.toUpperCase() === "OPEN" && (
                                <DropdownMenuItem onClick={() => { setSubmitBidRfq(rfq); setSubmitBidOpen(true); }}>
                                  Submit Bid
                                </DropdownMenuItem>
                              )}
                              {canCloseRfq && rfq.status?.toUpperCase() === "OPEN" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleCloseRfq(rfq.id)}>Close RFQ</DropdownMenuItem>
                                </>
                              )}
                              {canUpdateRfq && rfq.status?.toUpperCase() === "OPEN" && (
                                <DropdownMenuItem onClick={() => { setSelectedRfq(rfq); setDialogOpen(true); }}>Edit RFQ</DropdownMenuItem>
                              )}
                              {canEvaluateBids && rfq.status?.toUpperCase() === "EVALUATING" && (
                                <DropdownMenuItem onClick={() => openAwardDialog(rfq)}>Award Contract</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <PaginationControls
                page={currentPage}
                totalPages={totalPages}
                totalElements={totalElements}
                size={PAGE_SIZE}
                onPageChange={(p) => setCurrentPage(p)}
                loading={loading}
              />
            </Card>
          </TabsContent>

          <TabsContent value="bids" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Bids</CardTitle>
                <CardDescription>Review and evaluate vendor proposals</CardDescription>
              </CardHeader>
              <CardContent>
                {bidsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bid ID</TableHead>
                      <TableHead>RFQ</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allBids.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No bids found. Select an RFQ and click "View Bids" to load bids.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allBids.map((bid) => (
                        <TableRow key={bid.id}>
                          <TableCell className="font-medium">BID-{String(bid.id).padStart(4, '0')}</TableCell>
                          <TableCell>{(bid as any).rfqTitle || (bid as any).rfqId || '-'}</TableCell>
                          <TableCell>{bid.vendorName}</TableCell>
                          <TableCell className="font-medium">${bid.bidAmount?.toLocaleString() || 0}</TableCell>
                          <TableCell>{bid.deliveryTime}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={bid.score || 0} className="w-16" />
                              <span className="text-sm">{bid.score || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={bid.status?.toUpperCase() === "AWARDED" ? "success" : "warning"}>
                              {bid.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setDetailBid(bid as any)}>Review</Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="awarded">
            <Card>
              <CardHeader>
                <CardTitle>Awarded Contracts</CardTitle>
                <CardDescription>Successfully awarded RFQs</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>RFQ</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rfqs.filter(r => r.status?.toUpperCase() === "AWARDED").length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No awarded contracts yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rfqs.filter(r => r.status?.toUpperCase() === "AWARDED").map(rfq => (
                        <TableRow key={rfq.id}>
                          <TableCell className="font-medium">{rfq.rfqNumber || rfq.id}</TableCell>
                          <TableCell>{rfq.title}</TableCell>
                          <TableCell>{rfq.category || "â€â€"}</TableCell>
                          <TableCell>${rfq.maxBudget?.toLocaleString()}</TableCell>
                          <TableCell>{rfq.deadline ? new Date(rfq.deadline).toLocaleDateString() : "â€â€"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <RFQDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSuccess={loadRFQs} 
      />

      {/* RFQ Detail Dialog */}
      <Dialog open={!!detailRfq} onOpenChange={(o) => !o && setDetailRfq(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{detailRfq?.rfqNumber} â€â€ {detailRfq?.title}</DialogTitle>
            <DialogDescription>Request for Quotation details</DialogDescription>
          </DialogHeader>
          {detailRfq && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-500">Status</p>
                  <Badge variant={getStatusVariant(detailRfq.status)} className="mt-0.5">{detailRfq.status}</Badge></div>
                <div><p className="text-xs text-gray-500">Category</p>
                  <p className="font-medium">{detailRfq.category || "â€â€"}</p></div>
                <div><p className="text-xs text-gray-500">Budget</p>
                  <p className="font-medium">${detailRfq.maxBudget?.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Bids Received</p>
                  <p className="font-medium">{detailRfq.bidCount}</p></div>
                <div><p className="text-xs text-gray-500">Deadline</p>
                  <p className="font-medium">{detailRfq.deadline ? new Date(detailRfq.deadline).toLocaleString() : "â€â€"}</p></div>
                <div><p className="text-xs text-gray-500">Created</p>
                  <p className="font-medium">{detailRfq.createdAt ? new Date(detailRfq.createdAt).toLocaleDateString() : "â€â€"}</p></div>
              </div>
              {detailRfq.description && (
                <div><p className="text-xs text-gray-500">Description</p>
                  <p className="mt-0.5 text-gray-700">{detailRfq.description}</p></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailRfq(null)}>Close</Button>
            {canUpdateRfq && detailRfq?.status?.toUpperCase() === "OPEN" && (
              <Button onClick={() => { setSelectedRfq(detailRfq); setDetailRfq(null); setDialogOpen(true); }}>Edit RFQ</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bid Detail Dialog */}
      <Dialog open={!!detailBid} onOpenChange={(o) => !o && setDetailBid(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Bid Review â€â€ {(detailBid as any)?.rfqTitle || "RFQ"}</DialogTitle>
            <DialogDescription>Vendor bid details and scoring</DialogDescription>
          </DialogHeader>
          {detailBid && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-500">Vendor</p>
                  <p className="font-medium">{detailBid.vendorName}</p></div>
                <div><p className="text-xs text-gray-500">Status</p>
                  <Badge variant={detailBid.status?.toUpperCase() === "AWARDED" ? "success" : "warning"} className="mt-0.5">{detailBid.status}</Badge></div>
                <div><p className="text-xs text-gray-500">Bid Amount</p>
                  <p className="font-medium text-lg">${(detailBid as any).bidAmount?.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-500">Delivery Time</p>
                  <p className="font-medium">{detailBid.deliveryTime}</p></div>
                <div><p className="text-xs text-gray-500">Score</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Progress value={detailBid.score || 0} className="w-20 h-2" />
                    <span className="font-medium">{detailBid.score || 0}%</span>
                  </div>
                </div>
              </div>
              {(detailBid as any).proposalText && (
                <div><p className="text-xs text-gray-500">Proposal</p>
                  <p className="mt-0.5 text-gray-700 text-xs">{(detailBid as any).proposalText}</p></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailBid(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award Contract Dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Award Contract</DialogTitle>
            <DialogDescription>
              Select a bid to award for {rfqToAward?.title}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {bidsToAward.length === 0 ? (
              <p className="text-muted-foreground">No submitted bids available for this RFQ.</p>
            ) : (
              <div className="space-y-2">
                <Label>Select Bid to Award</Label>
                <Select value={selectedBidId} onValueChange={setSelectedBidId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a bid..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bidsToAward.map((bid) => (
                      <SelectItem key={bid.id} value={bid.id}>
                        {bid.vendorName} - ${bid.bidAmount?.toLocaleString()} ({bid.deliveryTime} days)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedBidId && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium">Selected Bid Details:</p>
                    {(() => {
                      const bid = bidsToAward.find(b => b.id === selectedBidId);
                      return bid ? (
                        <div className="mt-2 space-y-1 text-sm">
                          <p><span className="text-gray-500">Vendor:</span> {bid.vendorName}</p>
                          <p><span className="text-gray-500">Amount:</span> ${bid.bidAmount?.toLocaleString()}</p>
                          <p><span className="text-gray-500">Delivery:</span> {bid.deliveryTime}</p>
                          <p><span className="text-gray-500">Valid for:</span> {bid.validityDays} days</p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAward} disabled={!selectedBidId || bidsToAward.length === 0}>
              Award Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>

      {/* ââ€€ââ€€ Generate PO after Award ââ€€ââ€€ */}
      <Dialog open={generatePoOpen} onOpenChange={setGeneratePoOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Generate Purchase Order</DialogTitle>
            <DialogDescription>
              Create a PO from the awarded bid for {generatePoData?.rfq.title}.
            </DialogDescription>
          </DialogHeader>
          {generatePoData && (
            <div className="space-y-3 py-2">
              <div className="rounded-md bg-gray-50 p-3 text-xs space-y-1">
                <p><span className="text-gray-500">Vendor:</span> <span className="font-medium">{(generatePoData.bid as any).vendorName}</span></p>
                <p><span className="text-gray-500">Bid Amount:</span> <span className="font-medium">${(generatePoData.bid as any).bidAmount?.toLocaleString()}</span></p>
                <p><span className="text-gray-500">Delivery Time:</span> <span className="font-medium">{generatePoData.bid.deliveryTime}</span></p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expected Delivery Date (optional)</Label>
                <Input
                  type="date"
                  value={generatePoDeliveryDate}
                  onChange={(e) => setGeneratePoDeliveryDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGeneratePoOpen(false)}>Skip</Button>
            <Button size="sm" disabled={generatePoLoading} onClick={handleGeneratePO}>
              {generatePoLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Generate PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ââ€€ââ€€ Vendor Submit Bid Dialog ââ€€ââ€€ */}
      <Dialog open={submitBidOpen} onOpenChange={setSubmitBidOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Submit Bid</DialogTitle>
            <DialogDescription>
              Submit your bid for: <span className="font-medium">{submitBidRfq?.title}</span>
            </DialogDescription>
          </DialogHeader>
          {submitBidRfq && (
            <div className="space-y-3 py-2">
              <div className="rounded-md bg-blue-50 p-3 text-xs space-y-1">
                <p><span className="text-gray-500">Budget:</span> <span className="font-medium">${submitBidRfq.maxBudget?.toLocaleString()}</span></p>
                <p><span className="text-gray-500">Deadline:</span> <span className="font-medium">{submitBidRfq.deadline ? new Date(submitBidRfq.deadline).toLocaleString() : "â€â€"}</span></p>
                <p><span className="text-gray-500">Category:</span> <span className="font-medium">{submitBidRfq.category || "â€â€"}</span></p>
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
                    className="h-8 text-xs"
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
                    className="h-8 text-xs"
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
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSubmitBidOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={submitBidLoading || !bidAmount} onClick={handleSubmitBid}>
              {submitBidLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Submit Bid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireRole>
  );
}
