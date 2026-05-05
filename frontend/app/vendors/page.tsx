"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { vendorApi, scoringApi } from "@/lib/api";
import { VendorDocumentDialog } from "./vendor-document-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { VendorDialog } from "./vendor-dialog";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Mail, 
  Star,
  Filter,
  Download,
  Building2,
  Loader2,
  FileText,
  Eye,
  Edit,
  ShoppingCart,
  Ban
} from "lucide-react";

interface Vendor {
  id: string;
  companyName: string;
  email: string;
  phone?: string;
  category?: string;
  status: string;
  verified: boolean;
  rating?: number;
  totalOrders?: number;
  totalSpend?: string;
  compliance?: string;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    try {
      setLoading(true);
      const data = await vendorApi.getAll();
      setVendors(data);
      setFilteredVendors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  // Filter vendors based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredVendors(vendors);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredVendors(
        vendors.filter(
          (v) =>
            v.companyName?.toLowerCase().includes(query) ||
            v.email?.toLowerCase().includes(query) ||
            v.category?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, vendors]);

  // Export vendors to CSV
  function handleExport() {
    const headers = ["Company Name", "Email", "Phone", "Category", "Status", "Verified", "Rating", "Total Orders", "Compliance"];
    const rows = filteredVendors.map(v => [
      v.companyName,
      v.email,
      v.phone || "",
      v.category || "",
      v.status,
      v.verified ? "Yes" : "No",
      v.rating || "",
      v.totalOrders || "",
      v.compliance || ""
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendors-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Export Complete", description: `${filteredVendors.length} vendors exported to CSV` });
  }
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage vendor relationships</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Vendor
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 p-4 text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadVendors} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Total Vendors</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{loading ? "-" : vendors.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Verified</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">
                {loading ? "-" : vendors.filter((v) => v.verified).length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3">
              <p className="text-xs text-blue-600">Active</p>
              <p className="text-xl font-semibold text-blue-700 mt-1">
                {loading ? "-" : vendors.filter((v) => v.status === "ACTIVE").length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <p className="text-xs text-amber-600">Avg Rating</p>
              <p className="text-xl font-semibold text-amber-700 mt-1">
                {loading ? "-" : (vendors.reduce((acc, v) => acc + (v.rating || 0), 0) / (vendors.length || 1)).toFixed(1)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Vendors Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-700">Vendor Directory</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs w-[200px] border-gray-200"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast({ title: "Filter", description: "Advanced filtering coming soon!" })}>
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Filter
              </Button>
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
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Vendor</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Category</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Verified</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-xs">
                        No vendors found. Add your first vendor to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <TableRow key={vendor.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                {(vendor.companyName || "V").substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{vendor.companyName || "Unknown"}</p>
                              <p className="text-[10px] text-gray-500 truncate">{vendor.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-gray-600">{vendor.category || "Uncategorized"}</TableCell>
                        <TableCell className="py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                            vendor.status === "ACTIVE" 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {vendor.status}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                            vendor.verified 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {vendor.verified ? "Verified" : "Pending"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs" onClick={() => { setSelectedVendor(vendor); setDialogOpen(true); }}>
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                View / Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-xs" onClick={() => router.push(`/orders?vendor=${vendor.id}`)}>
                                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                                View Orders
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-xs"
                                onClick={() => {
                                  setSelectedVendor(vendor);
                                  setDocumentDialogOpen(true);
                                }}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1.5" />
                                Documents
                              </DropdownMenuItem>
                              {!vendor.verified && (
                                <DropdownMenuItem className="text-xs" onClick={async () => {
                                  try {
                                    await vendorApi.verify(vendor.id);
                                    toast({ title: "Vendor verified", description: `${vendor.companyName} has been verified.` });
                                    loadVendors();
                                  } catch (error) {
                                    toast({ 
                                      title: "Error", 
                                      description: error instanceof Error ? error.message : "Failed to verify vendor",
                                      variant: "destructive"
                                    });
                                  }
                                }}>
                                  Verify Vendor
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-xs text-red-600" 
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to deactivate ${vendor.companyName}?`)) {
                                    try {
                                      await vendorApi.updateStatus(vendor.id, "INACTIVE");
                                      toast({ title: "Vendor deactivated", description: `${vendor.companyName} has been deactivated.` });
                                      loadVendors();
                                    } catch (error) {
                                      toast({ 
                                        title: "Error", 
                                        description: error instanceof Error ? error.message : "Failed to deactivate vendor",
                                        variant: "destructive"
                                      });
                                    }
                                  }
                                }}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1.5" />
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
      <VendorDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSuccess={loadVendors} 
      />
      <VendorDocumentDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        vendor={selectedVendor}
        onSuccess={loadVendors}
      />
    </DashboardLayout>
  );
}
