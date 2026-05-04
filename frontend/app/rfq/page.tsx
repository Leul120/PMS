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
import { rfqApi, bidApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { RFQDialog } from "./rfq-dialog";
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
  Loader2
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
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRFQs();
  }, []);

  async function loadRFQs() {
    try {
      setLoading(true);
      const data = await rfqApi.getAll();
      setRfqs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load RFQs");
    } finally {
      setLoading(false);
    }
  }

  async function loadBids(rfqId: string) {
    try {
      const data = await bidApi.getByRfq(rfqId) as Bid[];
      setBids(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bids");
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OPEN': return 'success';
      case 'CLOSED': return 'secondary';
      case 'AWARDED': return 'default';
      default: return 'outline';
    }
  };
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">RFQ & Bidding</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage requests and vendor bids</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toast({ title: "Analytics", description: "RFQ analytics coming soon!" })}>Analytics</Button>
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create RFQ
            </Button>
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

        <Tabs defaultValue="rfqs" className="space-y-4">
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
                      className="pl-8 w-full sm:w-[300px]"
                    />
                  </div>
                  <Button variant="outline" onClick={() => toast({ title: "Filter", description: "Advanced filtering coming soon!" })}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                </div>
              </CardHeader>
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
                    {rfqs.map((rfq) => (
                      <TableRow key={rfq.id}>
                        <TableCell className="font-medium">{rfq.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rfq.title}</p>
                            <p className="text-xs text-muted-foreground">{rfq.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{rfq.category}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              rfq.status === "open" ? "success" : 
                              rfq.status === "evaluating" ? "warning" : 
                              rfq.status === "awarded" ? "default" : 
                              rfq.status === "closed" ? "secondary" : "outline"
                            }
                          >
                            {rfq.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {rfq.bidCount}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{rfq.maxBudget}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {rfq.deadline}
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
                              <DropdownMenuItem onClick={() => toast({ title: "RFQ Details", description: `Viewing ${rfq.title}` })}>View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => loadBids(rfq.id)}>View Bids</DropdownMenuItem>
                              {rfq.status === "open" && (
                                <>
                                  <DropdownMenuItem onClick={() => toast({ title: "Close RFQ", description: `Closing ${rfq.title} coming soon!` })}>Close RFQ</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toast({ title: "Edit RFQ", description: `Editing ${rfq.title} coming soon!` })}>Edit RFQ</DropdownMenuItem>
                                </>
                              )}
                              {rfq.status === "evaluating" && (
                                <DropdownMenuItem onClick={() => toast({ title: "Award Contract", description: `Awarding ${rfq.title} coming soon!` })}>Award Contract</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bids" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Bids</CardTitle>
                <CardDescription>Review and evaluate vendor proposals</CardDescription>
              </CardHeader>
              <CardContent>
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
                    {bids.map((bid) => (
                      <TableRow key={bid.id}>
                        <TableCell className="font-medium">BID-{String(bid.id).padStart(4, '0')}</TableCell>
                        <TableCell>{(bid as any).rfqId || '-'}</TableCell>
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
                          <Badge variant={bid.status === "accepted" ? "success" : "warning"}>
                            {bid.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline">Review</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <p className="text-muted-foreground">No awarded contracts to display.</p>
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
    </DashboardLayout>
  );
}
