"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requisitionApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

const ITEM_CATEGORIES = [
  "IT Equipment", "Office Supplies", "Furniture", "Software",
  "Services", "Raw Materials", "Marketing", "Maintenance", "Other",
];

interface RequisitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RequisitionDialog({ open, onOpenChange, onSuccess }: RequisitionDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    department: "",
    justification: "",
    estimatedBudget: "",
    items: [{ itemName: "", description: "", quantity: "", unit: "", estimatedUnitPrice: "", category: "" }],
  });

  function updateItem(index: number, key: string, value: string) {
    const newItems = [...formData.items];
    (newItems[index] as any)[key] = value;
    setFormData({ ...formData, items: newItems });
  }

  function addItem() {
    setFormData({
      ...formData,
      items: [...formData.items, { itemName: "", description: "", quantity: "", unit: "", estimatedUnitPrice: "", category: "" }],
    });
  }

  function removeItem(index: number) {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      await requisitionApi.create({
        department: formData.department,
        justification: formData.justification,
        estimatedBudget: parseFloat(formData.estimatedBudget),
        items: formData.items.map((item) => ({
          itemName: item.itemName,
          description: item.description,
          quantity: parseInt(item.quantity),
          unit: item.unit,
          estimatedUnitPrice: parseFloat(item.estimatedUnitPrice),
          category: item.category,
        })),
      });
      toast({ title: "Requisition created", description: "Submitted for approval." });
      onSuccess();
      onOpenChange(false);
      setFormData({
        department: "", justification: "", estimatedBudget: "",
        items: [{ itemName: "", description: "", quantity: "", unit: "", estimatedUnitPrice: "", category: "" }],
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create requisition",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">New Purchase Requisition</DialogTitle>
          <DialogDescription className="text-xs">Request a purchase — it will be sent for manager approval.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs font-medium">Department *</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g. IT, Finance, Operations"
                required
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget" className="text-xs font-medium">Estimated Budget ($) *</Label>
              <Input
                id="budget"
                type="number"
                value={formData.estimatedBudget}
                onChange={(e) => setFormData({ ...formData, estimatedBudget: e.target.value })}
                placeholder="0.00"
                required
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="justification" className="text-xs font-medium">Justification *</Label>
            <Textarea
              id="justification"
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              placeholder="Explain why this purchase is needed"
              required
              rows={2}
              className="text-xs border-gray-200 resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Items *</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary" onClick={addItem}>
                <Plus className="h-3 w-3" /> Add item
              </Button>
            </div>

            {formData.items.map((item, index) => (
              <div key={index} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-gray-500">Item {index + 1}</span>
                  {formData.items.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-gray-400 hover:text-red-500" onClick={() => removeItem(index)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Item name *"
                    value={item.itemName}
                    onChange={(e) => updateItem(index, "itemName", e.target.value)}
                    required
                    className="h-7 text-xs border-gray-200"
                  />
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    className="h-7 text-xs border-gray-200"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Input
                    placeholder="Qty *"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    required
                    className="h-7 text-xs border-gray-200"
                  />
                  <Input
                    placeholder="Unit"
                    value={item.unit}
                    onChange={(e) => updateItem(index, "unit", e.target.value)}
                    className="h-7 text-xs border-gray-200"
                  />
                  <Input
                    placeholder="Unit price ($)"
                    type="number"
                    value={item.estimatedUnitPrice}
                    onChange={(e) => updateItem(index, "estimatedUnitPrice", e.target.value)}
                    required
                    className="h-7 text-xs border-gray-200"
                  />
                  <Select value={item.category} onValueChange={(v) => updateItem(index, "category", v)}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={loading}>
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submit Requisition
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
