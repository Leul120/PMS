"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { inventoryApi } from "@/lib/api";
import type { PagedResponse } from "@/lib/api";
import { InventoryDialog } from "./inventory-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
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
  CheckCircle2,
  TrendingDown,
  Plus,
  Search,
  Loader2,
  ArrowRight,
  PackageX,
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
        lastUpdated: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—",
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

  const statCards = [
    { label: "Total Units", value: totalItems.toLocaleString(), sub: `${inventory.length} product${inventory.length !== 1 ? "s" : ""}`, icon: Package },
    { label: "In Stock", value: inStock, sub: "Above minimum level", icon: CheckCircle2 },
    { label: "Low Stock", value: lowStock, sub: lowStock > 0 ? "Needs reorder soon" : "All levels healthy", icon: TrendingDown },
    { label: "Out of Stock", value: critical, sub: critical > 0 ? "Needs immediate action" : "None depleted", icon: PackageX },
  ];

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track and manage stock levels across all locations</p>
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

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 border border-gray-200 rounded">
          {statCards.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="px-4 py-3 flex items-center gap-3">
              <Icon className="h-4 w-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                {!loading && sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {!loading && (critical > 0 || lowStock > 0) && (
          <div className={`border-l-4 ${critical > 0 ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50"} px-4 py-3 flex items-center gap-3`}>
            <AlertTriangle className={`h-4 w-4 shrink-0 ${critical > 0 ? "text-red-600" : "text-amber-600"}`} />
            <p className={`text-xs flex-1 ${critical > 0 ? "text-red-800" : "text-amber-800"}`}>
              {critical > 0 && <><span className="font-semibold">{critical} item{critical > 1 ? "s" : ""}</span> {critical > 1 ? "are" : "is"} out of stock. </>}
              {lowStock > 0 && <><span className="font-semibold">{lowStock} item{lowStock > 1 ? "s" : ""}</span> {lowStock > 1 ? "are" : "is"} running low.</>}
            </p>
          </div>
        )}

        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">Inventory Items</p>
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
          </div>
          <div>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Item</TableHead>
                  <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">SKU</TableHead>
                  <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Category</TableHead>
                  <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Quantity</TableHead>
                  <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                  <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Package className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-gray-500">
                        {searchQuery ? "No items match your search." : "No inventory items yet."}
                      </p>
                      {!searchQuery && canUpdateInventory && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Click "Add Item" to create your first inventory record.</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                filteredInventory.map((item) => {
                  const isCritical = item.quantity === 0;
                  const isLow = !isCritical && item.quantity <= item.minStock;
                  return (
                    <TableRow key={item.id} className={`hover:bg-gray-50 transition-colors ${isCritical ? "bg-red-50/40" : isLow ? "bg-amber-50/40" : ""}`}>
                      <TableCell className="py-2.5">
                        <p className="text-xs font-medium text-gray-900">{item.name}</p>
                        {item.location && <p className="text-[10px] text-gray-400">{item.location}</p>}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500 py-2.5">{item.sku}</TableCell>
                      <TableCell className="text-xs text-gray-600 py-2.5">{item.category}</TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-semibold ${isCritical ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"}`}>
                            {item.quantity}
                          </span>
                          <span className="text-[10px] text-gray-400">{item.unit}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">min {item.minStock} / max {item.maxStock}</p>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${isCritical ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {isCritical ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-gray-500 py-2.5">{item.lastUpdated}</TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            page={currentPage}
            totalPages={totalPages}
            totalElements={totalElements}
            size={PAGE_SIZE}
            onPageChange={(p) => setCurrentPage(p)}
            loading={loading}
          />
        </div>
      </div>

      <InventoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={loadInventory}
      />

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded">
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


