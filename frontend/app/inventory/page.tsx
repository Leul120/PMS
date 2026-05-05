"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { inventoryApi } from "@/lib/api";
import { InventoryDialog } from "./inventory-dialog";
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const { toast } = useToast();

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

  async function loadInventory() {
    try {
      setLoading(true);
      const data = await inventoryApi.getAll();
      setInventory(data.map((item: any) => ({
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
        lastUpdated: new Date(item.updatedAt).toLocaleDateString(),
      })));
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
    loadInventory();
  }, []);

  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const inStock = inventory.filter((item) => item.quantity > item.minStock).length;
  const lowStock = inventory.filter((item) => item.quantity <= item.minStock && item.quantity > 0).length;
  const critical = inventory.filter((item) => item.quantity === 0).length;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage stock levels</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setAdjustDialogOpen(true)}>Adjust Stock</Button>
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Item
            </Button>
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
                  className="pl-8 w-[200px] h-8 text-xs border-gray-200"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast({ title: "Filter", description: "Advanced filtering coming soon!" })}>
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Filter
              </Button>
            </div>
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
                {inventory.map((item) => {
                  const percentage = (item.quantity / item.maxStock) * 100;
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
                })}
              </TableBody>
            </Table>
          </CardContent>
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
  );
}
