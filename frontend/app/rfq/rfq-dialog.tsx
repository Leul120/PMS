"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rfqApi, requisitionApi, vendorApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";



interface RFQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RFQDialog({ open, onOpenChange, onSuccess }: RFQDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedReqId, setSelectedReqId] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline: "",
    estimatedValue: "",
    categoryId: "",
    expectedQuantity: "",
  });

  // Load approved requisitions when dialog opens — only for non-vendor roles
  useEffect(() => {
    if (!open) return;
    // Load categories from vendor-service
    vendorApi.getCategories().then((cats: any[]) => {
      setCategories(cats.map((c: any) => ({ id: c.categoryId, name: c.categoryName })));
    }).catch(() => {});
    // VENDORs don't have permission to read requisitions (403) — skip the call
    const stored = typeof window !== "undefined" ? localStorage.getItem("auth-storage") : null;
    const role: string = stored ? (JSON.parse(stored)?.state?.user?.role ?? "") : "";
    if (role === "VENDOR") return;
    requisitionApi.getAll(0, 100).then((res) => {
      const items = (res.content ?? []).filter((r: any) => r.status === "APPROVED");
      setRequisitions(items);
    }).catch(() => {});
  }, [open]);

  // Pre-fill form from selected requisition
  function handleRequisitionSelect(reqId: string) {
    setSelectedReqId(reqId);
    if (!reqId) return;
    const req = requisitions.find((r: any) => String(r.requisitionId) === reqId);
    if (!req) return;
    setFormData((prev) => ({
      ...prev,
      title: req.justification || `Requisition ${req.requisitionNumber}`,
      description: req.justification || "",
      estimatedValue: String(req.estimatedBudget || ""),
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await rfqApi.create({
        ...formData,
        estimatedValue: parseFloat(formData.estimatedValue) || 0,
        categoryId: parseInt(formData.categoryId) || undefined,
        expectedQuantity: parseInt(formData.expectedQuantity) || undefined,
        deadline: new Date(formData.deadline).toISOString(),
      });
      
      toast({
        title: "RFQ created",
        description: "Request for quotation has been created successfully.",
      });
      
      onSuccess();
      onOpenChange(false);
      setFormData({
        title: "",
        description: "",
        deadline: "",
        estimatedValue: "",
        categoryId: "",
        expectedQuantity: "",
      });
      setSelectedReqId("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create RFQ",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create RFQ</DialogTitle>
          <DialogDescription>
            Create a new request for quotation to send to vendors.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Optional: pre-fill from approved requisition */}
          {requisitions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="requisitionId" className="text-xs text-gray-500">
                Pre-fill from Approved Requisition (optional)
              </Label>
              <Select value={selectedReqId} onValueChange={handleRequisitionSelect}>
                <SelectTrigger id="requisitionId" className="h-8 text-xs">
                  <SelectValue placeholder="Select a requisition to pre-fill..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {requisitions.map((req: any) => (
                    <SelectItem key={req.requisitionId} value={String(req.requisitionId)}>
                      {req.requisitionNumber} — {req.department} (${req.estimatedBudget?.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedReqId && (
                <p className="text-[10px] text-emerald-600">✓ Form pre-filled from requisition</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter RFQ title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the goods or services needed"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline *</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
              <Input
                id="estimatedValue"
                type="number"
                value={formData.estimatedValue}
                onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category *</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
              >
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.length > 0 ? categories : [
                    { id: 1, name: "IT" },
                    { id: 2, name: "Construction" },
                    { id: 3, name: "Stationery" },
                    { id: 4, name: "Electronics" },
                    { id: 5, name: "Furniture" },
                  ]).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedQuantity">Expected Quantity</Label>
              <Input
                id="expectedQuantity"
                type="number"
                value={formData.expectedQuantity}
                onChange={(e) => setFormData({ ...formData, expectedQuantity: e.target.value })}
                placeholder="e.g., 100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create RFQ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
