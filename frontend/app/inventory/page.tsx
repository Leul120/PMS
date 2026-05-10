"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { inventoryApi } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { InventoryDialog } from "./inventory-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  TrendingDown,
  Plus,
  Search,
  Filter,
  ArrowUpDown
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  unit: string;
  location: string;
  status: "normal" | "low" | "critical";
  lastUpdated: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const canUpdateInventory = hasPermission("inventory:update");

  async function handleAdjustStock() {
    if (!selectedItem || adjustQuantity === 0) {
      toast({ title: "Error", description: "Please select an item and enter a quantity", variant: "destructive" });
      return;
    }
    try {
      await inventoryApi.adjustStock(selectedItem.id, adjustQuantity);
      toast({ title: "Stock Adjusted", description: `${selectedItem.name} quantity changed by ${adjustQuantity}` });
      loadInventory();
      setAdjustDialogOpen(false);
      setSelectedItem(null);
      setAdjustQuantity(0);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to adjust stock",
        variant: "destructive"
      });
    }
  }

  async function loadInventory(page = 0) {
    try {
      setLoading(true);
      const response = await inventoryApi.getAll(page, PAGE_SIZE);
      const items = response.content ?? [];
      const mapped = items.map((item: any) => ({
        id: item.id.toString(),
        name: item.name,
        sku: item.itemCode,
        category: item.category || "Uncategorized",
        quantity: item.quantity,
        minStock: item.minStock,
        maxStock: item.maxStock,
        unit: item.unit || "pcs",
        location: item.location || "Main Warehouse",
        status: item.status || "normal",
        lastUpdated: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "â€â€",
      }));
      setInventory(mapped);
      setFilteredInventory(mapped);
      setTotalPages(response.totalPages ?? 0);
      setTotalElements(response.totalElements ?? 0);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load inventory data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR"])) return;
    loadInventory(currentPage);
  }, [currentPage]);

  // Filter inventory based on search query and category
  useEffect(() => {
    let filtered = inventory;
    if (categoryFilter !== "ALL") {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name?.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.location?.toLowerCase().includes(query)
      );
    }
    setFilteredInventory(filtered);
  }, [searchQuery, inventory, categoryFilter]);

  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const inStock = inventory.filter((item) => item.quantity > item.minStock).length;
  const lowStock = inventory.filter((item) => item.quantity <= item.minStock && item.quantity > 0).length;
  const critical = inventory.filter((item) => item.quantity === 0).length;

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage stock levels</p>
          </div>
          <div className="flex gap-2">
            {canUpdateInventory && (
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setAdjustDialogOpen(true)}>Adjust Stock</Button>
            )}
            {canUpdateInventory && (
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Item
            </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Total Items</p>
              <p className="text-xl font-semibold text-gray-700 mt-1">{loading ? "-" : totalItems.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">In Stock</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">{loading ? "-" : inStock}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <p className="text-xs text-amber-600">Low Stock</p>
              <p className="text-xl font-semibold text-amber-700 mt-1">{loading ? "-" : lowStock}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3">
              <p className="text-xs text-red-600">Critical</p>
              <p className="text-xl font-semibold text-red-700 mt-1">{loading ? "-" : critical}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-700">Inventory Items</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search inventory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px] h-8 text-xs border-gray-200"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {Array.from(new Set(inventory.map(i => i.category).filter(Boolean))).map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Item</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">SKU</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Category</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Location</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Stock Level</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-xs">
                      {searchQuery ? "No items match your search." : "No inventory items found. Add your first item."}
                    </TableCell>
                  </TableRow>
                ) : (
                filteredInventory.map((item) => {
                  const percentage = item.maxStock > 0 ? (item.quantity / item.maxStock) * 100 : 0;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={percentage} className="w-20" />
                          <span className="text-xs">{item.quantity} {item.unit}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            item.status === "normal" ? "default" : 
                            item.status === "low" ? "secondary" : "destructive"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.lastUpdated}</TableCell>
                    </TableRow>
                  );
                }))}
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
      </div>
      
      <InventoryDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSuccess={loadInventory} 
      />

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>Update the quantity of an inventory item.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Item</Label>
              <Select 
                value={selectedItem?.id || ""} 
                onValueChange={(value) => setSelectedItem(inventory.find(i => i.id === value) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an item..." />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} (Current: {item.quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Quantity Change (+/-)</Label>
              <Input
                type="number"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                placeholder="Enter quantity change"
              />
              <p className="text-xs text-gray-500">
                Use positive numbers to add stock, negative to remove.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdjustStock}>Adjust Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    </RequireRole>
  );
}


