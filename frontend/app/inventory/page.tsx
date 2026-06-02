"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { inventoryApi, requisitionApi } from "@/lib/api";
import type { InventorySortOption, InventoryStats, InventoryStockStatusFilter } from "@/lib/api";
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
import { useListDeepLink } from "@/hooks/use-list-deep-link";
import { useAuthStore } from "@/lib/auth-store";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Plus,
  Search,
  Loader2,
  PackageX,
  ClipboardList,
  Filter,
  X,
  ArrowUpDown,
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
  updatedAt?: string;
}

type StockStatusFilter = InventoryStockStatusFilter;
type SortOption = InventorySortOption;

function mapInventoryItem(item: any): InventoryItem {
  return {
    id: String(item.id),
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
    updatedAt: item.updatedAt,
  };
}

function getStockLevel(item: Pick<InventoryItem, "quantity" | "minStock" | "maxStock">) {
  if (item.quantity === 0) return "out" as const;
  if (item.quantity <= item.minStock) return "low" as const;
  if (item.maxStock > 0 && item.quantity > item.maxStock) return "over" as const;
  return "normal" as const;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const PAGE_SIZE = 50;
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [reorderItem, setReorderItem] = useState<InventoryItem | null>(null);
  const [reorderQty, setReorderQty] = useState("");
  const [reorderJustification, setReorderJustification] = useState("");
  const [reorderLoading, setReorderLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [adjustItems, setAdjustItems] = useState<InventoryItem[]>([]);

  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const canAccess = hasRole(["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"]);
  const canUpdateInventory = hasPermission("inventory:update");
  const canReorder = hasPermission("requisitions:create");

  const hasActiveFilters =
    categoryFilter !== "ALL" ||
    locationFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    debouncedSearch.trim().length > 0 ||
    sortBy !== "name-asc";

  const loadInventory = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const response = await inventoryApi.getAll({
        page,
        size: PAGE_SIZE,
        search: debouncedSearch,
        category: categoryFilter,
        location: locationFilter,
        stockStatus: statusFilter,
        sort: sortBy,
      });
      setInventory((response.content ?? []).map(mapInventoryItem));
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
  }, [debouncedSearch, categoryFilter, locationFilter, statusFilter, sortBy, toast]);

  const loadStats = useCallback(async () => {
    try {
      const data = await inventoryApi.getStats();
      setStats(data);
    } catch {
      setStats(null);
    }
  }, []);

  const loadFilterOptions = useCallback(async () => {
    try {
      const data = await inventoryApi.getFilterOptions();
      setCategoryOptions(data.categories ?? []);
      setLocationOptions(data.locations ?? []);
    } catch {
      setCategoryOptions([]);
      setLocationOptions([]);
    }
  }, []);

  const refreshAll = useCallback(async (page: number) => {
    await Promise.all([loadInventory(page), loadStats(), loadFilterOptions()]);
  }, [loadInventory, loadStats, loadFilterOptions]);

  function clearFilters() {
    setSearchQuery("");
    setDebouncedSearch("");
    setCategoryFilter("ALL");
    setLocationFilter("ALL");
    setStatusFilter("ALL");
    setSortBy("name-asc");
    setCurrentPage(0);
  }

  async function handleAdjustStock() {
    if (!selectedItem || adjustQuantity === 0) {
      toast({ title: "Error", description: "Please select an item and enter a quantity", variant: "destructive" });
      return;
    }
    try {
      await inventoryApi.adjustStock(selectedItem.id, adjustQuantity);
      toast({ title: "Stock Adjusted", description: `${selectedItem.name} quantity changed by ${adjustQuantity}` });
      await refreshAll(currentPage);
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

  async function handleReorder() {
    if (!reorderItem || !reorderQty) {
      toast({ title: "Error", description: "Please enter reorder quantity", variant: "destructive" });
      return;
    }
    try {
      setReorderLoading(true);
      const qty = parseInt(reorderQty);
      const estimatedBudget = qty * 10; // fallback estimate — user should adjust
      await requisitionApi.create({
        department: "Inventory",
        justification: reorderJustification || `Reorder request for ${reorderItem.name} — current stock: ${reorderItem.quantity} ${reorderItem.unit} (minimum: ${reorderItem.minStock})`,
        estimatedBudget,
        items: [{
          itemName: reorderItem.name,
          description: `SKU: ${reorderItem.sku || "N/A"} | Category: ${reorderItem.category}`,
          quantity: qty,
          unit: reorderItem.unit,
          estimatedUnitPrice: 10,
          category: reorderItem.category,
        }],
      });
      toast({ title: "Reorder Requisition Created", description: `Requisition submitted for ${qty} units of ${reorderItem.name}.` });
      setReorderDialogOpen(false);
      setReorderItem(null);
      setReorderQty("");
      setReorderJustification("");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create requisition", variant: "destructive" });
    } finally {
      setReorderLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!canAccess) return;
    loadInventory(currentPage);
  }, [canAccess, currentPage, loadInventory]);

  useListDeepLink(inventory, loading, (item) => setDetailItem(item), { paramNames: ["id"] });

  useEffect(() => {
    if (!canAccess) return;
    loadStats();
    loadFilterOptions();
  }, [canAccess, loadStats, loadFilterOptions]);

  useEffect(() => {
    if (!adjustDialogOpen) return;
    inventoryApi.getAllList()
      .then((items) => setAdjustItems((items as any[]).map(mapInventoryItem)))
      .catch(() => setAdjustItems([]));
  }, [adjustDialogOpen]);

  const totalItems = stats?.totalUnits ?? 0;
  const productCount = stats?.productCount ?? 0;
  const inStock = stats?.inStock ?? 0;
  const lowStock = stats?.lowStock ?? 0;
  const critical = stats?.outOfStock ?? 0;
  const overMax = stats?.overMax ?? 0;

  const tableColSpan = canReorder ? 7 : 6;

  const statCards: {
    label: string;
    value: string | number;
    sub: string;
    icon: typeof Package;
    filter: StockStatusFilter;
  }[] = [
    { label: "Total Units", value: totalItems.toLocaleString(), sub: `${productCount} product${productCount !== 1 ? "s" : ""}`, icon: Package, filter: "ALL" as StockStatusFilter },
    { label: "In Stock", value: inStock, sub: "Above minimum level", icon: CheckCircle2, filter: "IN_STOCK" },
    { label: "Low Stock", value: lowStock, sub: lowStock > 0 ? "Needs reorder soon" : "All levels healthy", icon: TrendingDown, filter: "LOW" },
    { label: "Out of Stock", value: critical, sub: critical > 0 ? "Needs immediate action" : "None depleted", icon: PackageX, filter: "OUT" },
  ];

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "SUPER_ADMIN"]}>
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
          {statCards.map(({ label, value, sub, icon: Icon, filter }) => {
            const isActive = statusFilter === filter;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setStatusFilter(isActive && filter !== "ALL" ? "ALL" : filter);
                  setCurrentPage(0);
                }}
                className={`px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-gray-50/80 ${isActive ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`}
                title={filter === "ALL" ? "Show all items" : `Filter: ${label}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-gray-400"}`} />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                  {loading ? <div className="h-5 w-10 bg-gray-100 rounded animate-pulse mt-0.5" /> : <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>}
                  {!loading && sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
              </button>
            );
          })}
        </div>

        {!loading && (critical > 0 || lowStock > 0) && statusFilter === "ALL" && (
          <div className={`border-l-4 ${critical > 0 ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50"} px-4 py-3 flex items-center gap-3`}>
            <AlertTriangle className={`h-4 w-4 shrink-0 ${critical > 0 ? "text-red-600" : "text-amber-600"}`} />
            <p className={`text-xs flex-1 ${critical > 0 ? "text-red-800" : "text-amber-800"}`}>
              {critical > 0 && <><span className="font-semibold">{critical} item{critical > 1 ? "s" : ""}</span> {critical > 1 ? "are" : "is"} out of stock. </>}
              {lowStock > 0 && <><span className="font-semibold">{lowStock} item{lowStock > 1 ? "s" : ""}</span> {lowStock > 1 ? "are" : "is"} running low.</>}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={() => {
                setStatusFilter("NEEDS_ATTENTION");
                setCurrentPage(0);
              }}
            >
              Show items needing attention
            </Button>
          </div>
        )}

        {!loading && overMax > 0 && statusFilter !== "OVER_MAX" && (
          <div className="border-l-4 border-blue-400 bg-blue-50 px-4 py-3 flex items-center gap-3">
            <Package className="h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-xs flex-1 text-blue-800">
              <span className="font-semibold">{overMax} item{overMax > 1 ? "s" : ""}</span> {overMax > 1 ? "exceed" : "exceeds"} maximum stock level.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] shrink-0 border-blue-300 text-blue-800 hover:bg-blue-100"
              onClick={() => {
                setStatusFilter("OVER_MAX");
                setCurrentPage(0);
              }}
            >
              Show overstocked
            </Button>
          </div>
        )}

        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="py-3 px-4 border-b border-gray-100 space-y-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Inventory Items</p>
                {!loading && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Showing {inventory.length} of {totalElements.toLocaleString()} matching items
                    {hasActiveFilters ? " (filtered)" : ""}
                  </p>
                )}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-gray-500 hover:text-gray-800"
                  onClick={clearFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear filters
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search name, SKU, location…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px] h-8 text-xs border-gray-200"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StockStatusFilter); setCurrentPage(0); }}>
                <SelectTrigger className="h-8 text-xs w-[150px]">
                  <Filter className="h-3 w-3 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="Stock status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All stock levels</SelectItem>
                  <SelectItem value="IN_STOCK">In stock</SelectItem>
                  <SelectItem value="LOW">Low stock</SelectItem>
                  <SelectItem value="OUT">Out of stock</SelectItem>
                  <SelectItem value="OVER_MAX">Over maximum</SelectItem>
                  <SelectItem value="NEEDS_ATTENTION">Needs attention</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(0); }}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {locationOptions.length > 0 && (
                <Select value={locationFilter} onValueChange={(v) => { setLocationFilter(v); setCurrentPage(0); }}>
                  <SelectTrigger className="h-8 text-xs w-[150px]">
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All locations</SelectItem>
                    {locationOptions.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortOption); setCurrentPage(0); }}>
                <SelectTrigger className="h-8 text-xs w-[160px]">
                  <ArrowUpDown className="h-3 w-3 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A → Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z → A)</SelectItem>
                  <SelectItem value="qty-asc">Quantity (low → high)</SelectItem>
                  <SelectItem value="qty-desc">Quantity (high → low)</SelectItem>
                  <SelectItem value="sku-asc">SKU (A → Z)</SelectItem>
                  <SelectItem value="updated-desc">Recently updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                  {canReorder && <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={tableColSpan} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : inventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableColSpan} className="text-center py-12">
                      <Package className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-gray-500">
                        {hasActiveFilters ? "No items match your filters." : "No inventory items yet."}
                      </p>
                      {hasActiveFilters ? (
                        <Button variant="link" size="sm" className="text-[11px] h-7 mt-1" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      ) : canUpdateInventory ? (
                        <p className="text-[10px] text-gray-400 mt-0.5">Click &quot;Add Item&quot; to create your first inventory record.</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ) : (
                inventory.map((item) => {
                  const level = getStockLevel(item);
                  const isCritical = level === "out";
                  const isLow = level === "low";
                  const isOver = level === "over";
                  return (
                    <TableRow key={item.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${isCritical ? "bg-red-50/40" : isLow ? "bg-amber-50/40" : isOver ? "bg-blue-50/40" : ""}`} onClick={() => setDetailItem(item)}>
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
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${isCritical ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : isOver ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {isCritical ? "Out of Stock" : isLow ? "Low Stock" : isOver ? "Over Max" : "In Stock"}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-gray-500 py-2.5">{item.lastUpdated}</TableCell>
                      {canReorder && (
                        <TableCell className="text-right py-2.5" onClick={(e) => e.stopPropagation()}>
                          {(isCritical || isLow) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] border-amber-200 text-amber-700 hover:bg-amber-50"
                              onClick={() => {
                                setReorderItem(item);
                                setReorderQty(String(Math.max(item.maxStock - item.quantity, item.minStock)));
                                setReorderJustification("");
                                setReorderDialogOpen(true);
                              }}
                            >
                              <ClipboardList className="h-3 w-3 mr-1" />Reorder
                            </Button>
                          ) : (
                            <span className="text-[10px] text-gray-400">—</span>
                          )}
                        </TableCell>
                      )}
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
        onSuccess={() => refreshAll(currentPage)}
      />

      {/* Item Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <DialogContent className="sm:max-w-[460px] rounded">
          <DialogHeader>
            <DialogTitle className="text-sm">{detailItem?.name}</DialogTitle>
            <DialogDescription className="text-xs">Inventory item details</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 py-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-gray-500">SKU</p><p className="font-mono font-medium mt-0.5">{detailItem.sku}</p></div>
                <div><p className="text-gray-500">Category</p><p className="font-medium mt-0.5">{detailItem.category}</p></div>
                <div><p className="text-gray-500">Quantity</p>
                  <p className={`font-semibold text-base mt-0.5 ${detailItem.quantity === 0 ? "text-red-600" : detailItem.quantity <= detailItem.minStock ? "text-amber-600" : "text-gray-900"}`}>
                    {detailItem.quantity} {detailItem.unit}
                  </p>
                </div>
                <div><p className="text-gray-500">Status</p>
                  {(() => {
                    const level = getStockLevel(detailItem);
                    const isCritical = level === "out";
                    const isLow = level === "low";
                    const isOver = level === "over";
                    return (
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${isCritical ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : isOver ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {isCritical ? "Out of Stock" : isLow ? "Low Stock" : isOver ? "Over Max" : "In Stock"}
                      </span>
                    );
                  })()}
                </div>
                <div><p className="text-gray-500">Min Stock</p><p className="font-medium mt-0.5">{detailItem.minStock} {detailItem.unit}</p></div>
                <div><p className="text-gray-500">Max Stock</p><p className="font-medium mt-0.5">{detailItem.maxStock} {detailItem.unit}</p></div>
                <div><p className="text-gray-500">Location</p><p className="font-medium mt-0.5">{detailItem.location}</p></div>
                <div><p className="text-gray-500">Last Updated</p><p className="font-medium mt-0.5">{detailItem.lastUpdated}</p></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDetailItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                onValueChange={(value) => setSelectedItem(adjustItems.find(i => i.id === value) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an item..." />
                </SelectTrigger>
                <SelectContent>
                  {adjustItems.map((item) => (
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
      {/* Reorder Requisition Dialog */}
      <Dialog open={reorderDialogOpen} onOpenChange={setReorderDialogOpen}>
        <DialogContent className="sm:max-w-[440px] rounded">
          <DialogHeader>
            <DialogTitle className="text-sm">Create Reorder Requisition</DialogTitle>
            <DialogDescription className="text-xs">
              Submit a purchase requisition for {reorderItem?.name}. Current stock: <strong>{reorderItem?.quantity} {reorderItem?.unit}</strong> (min: {reorderItem?.minStock}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Quantity to Order *</Label>
                <Input
                  type="number"
                  min="1"
                  value={reorderQty}
                  onChange={(e) => setReorderQty(e.target.value)}
                  placeholder="Quantity"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Unit</Label>
                <Input value={reorderItem?.unit || "pcs"} readOnly disabled className="h-8 text-xs bg-gray-50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Additional Notes</Label>
              <textarea
                value={reorderJustification}
                onChange={(e) => setReorderJustification(e.target.value)}
                placeholder={`Reorder request for ${reorderItem?.name} — stock running low`}
                rows={3}
                className="w-full rounded border border-gray-200 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <p className="text-[10px] text-gray-400">A purchase requisition will be submitted and routed for manager approval before an order is placed.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setReorderDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="text-xs" disabled={reorderLoading || !reorderQty} onClick={handleReorder}>
              {reorderLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submit Requisition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    </RequireRole>
  );
}


