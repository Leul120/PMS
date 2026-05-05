"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requisitionApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// Common item categories
const ITEM_CATEGORIES = [
  { value: "IT Equipment", label: "IT Equipment" },
  { value: "Office Supplies", label: "Office Supplies" },
  { value: "Furniture", label: "Furniture" },
  { value: "Software", label: "Software" },
  { value: "Services", label: "Services" },
  { value: "Raw Materials", label: "Raw Materials" },
  { value: "Marketing", label: "Marketing" },
  { value: "Maintenance", label: "Maintenance" },
  { value: "Other", label: "Other" },
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      await requisitionApi.create({
        department: formData.department,
        justification: formData.justification,
        estimatedBudget: parseFloat(formData.estimatedBudget),
        items: formData.items.map(item => ({
          itemName: item.itemName,
          description: item.description,
          quantity: parseInt(item.quantity),
          unit: item.unit,
          estimatedUnitPrice: parseFloat(item.estimatedUnitPrice),
          category: item.category,
        })),
      });
      toast({ title: "Success", description: "Requisition created successfully" });
      onSuccess();
      onOpenChange(false);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Purchase Requisition</DialogTitle>
          <DialogDescription>Create a new purchase requisition for approval</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Estimated Budget ($)</Label>
              <Input
                id="budget"
                type="number"
                value={formData.estimatedBudget}
                onChange={(e) => setFormData({ ...formData, estimatedBudget: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="justification">Justification</Label>
            <Textarea
              id="justification"
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Items</Label>
            {formData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-6 gap-2 p-4 border rounded-lg">
                <Input
                  placeholder="Item Name"
                  value={item.itemName}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index].itemName = e.target.value;
                    setFormData({ ...formData, items: newItems });
                  }}
                  required
                />
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index].description = e.target.value;
                    setFormData({ ...formData, items: newItems });
                  }}
                />
                <Input
                  placeholder="Qty"
                  type="number"
                  value={item.quantity}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index].quantity = e.target.value;
                    setFormData({ ...formData, items: newItems });
                  }}
                  required
                />
                <Input
                  placeholder="Unit"
                  value={item.unit}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index].unit = e.target.value;
                    setFormData({ ...formData, items: newItems });
                  }}
                />
                <Input
                  placeholder="Unit Price ($)"
                  type="number"
                  value={item.estimatedUnitPrice}
                  onChange={(e) => {
                    const newItems = [...formData.items];
                    newItems[index].estimatedUnitPrice = e.target.value;
                    setFormData({ ...formData, items: newItems });
                  }}
                  required
                />
                <Select
                  value={item.category}
                  onValueChange={(value) => {
                    const newItems = [...formData.items];
                    newItems[index].category = value;
                    setFormData({ ...formData, items: newItems });
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Requisition"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
