"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { inventoryApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface InventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InventoryDialog({ open, onOpenChange, onSuccess }: InventoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    itemCode: "",
    name: "",
    description: "",
    quantity: "",
    minStock: "",
    maxStock: "",
    unit: "",
    location: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await inventoryApi.create({
        itemCode: formData.itemCode,
        name: formData.name,
        description: formData.description,
        quantity: parseInt(formData.quantity) || 0,
        minStock: parseInt(formData.minStock) || 0,
        maxStock: parseInt(formData.maxStock) || 0,
        unit: formData.unit,
        location: formData.location,
      });
      toast({ title: "Item added", description: `${formData.name} has been added to inventory.` });
      onSuccess();
      onOpenChange(false);
      setFormData({ itemCode: "", name: "", description: "", quantity: "", minStock: "", maxStock: "", unit: "", location: "" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add item",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Add Inventory Item</DialogTitle>
          <DialogDescription className="text-xs">
            Add a new item and set stock thresholds to trigger alerts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="itemCode" className="text-xs font-medium">Item Code *</Label>
              <Input
                id="itemCode"
                value={formData.itemCode}
                onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                placeholder="INV-001"
                required
                className="h-8 text-xs border-gray-200 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">Item Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter item name"
                required
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description (optional)"
              className="h-8 text-xs border-gray-200"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-medium">Qty *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="0"
                required
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minStock" className="text-xs font-medium">Min Stock</Label>
              <Input
                id="minStock"
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                placeholder="0"
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxStock" className="text-xs font-medium">Max Stock</Label>
              <Input
                id="maxStock"
                type="number"
                value={formData.maxStock}
                onChange={(e) => setFormData({ ...formData, maxStock: e.target.value })}
                placeholder="0"
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 -mt-1">Items below Min Stock will trigger a low-stock alert.</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit" className="text-xs font-medium">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="pcs, kg, boxes…"
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs font-medium">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Warehouse A, Shelf 3…"
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
