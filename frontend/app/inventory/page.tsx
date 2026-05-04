"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { inventoryApi } from "@/lib/api";
import { InventoryDialog } from "./inventory-dialog";
import { Badge } from "@/components/ui/badge";
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
  const { toast } = useToast();

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
      // API may not be available yet
      console.log("Inventory API not available yet");
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
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toast({ title: "Adjust Stock", description: "Stock adjustment form coming soon!" })}>Adjust Stock</Button>
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
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Stock</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => {
                  const percentage = (item.quantity / item.maxStock) * 100;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={percentage} 
                            className="w-20"
                          />
                          <span className="text-xs">{percentage.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            item.status === "normal" ? "success" : 
                            item.status === "low" ? "warning" : "destructive"
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
    </DashboardLayout>
  );
}
