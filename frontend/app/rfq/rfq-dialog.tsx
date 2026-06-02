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
import { Loader2, CheckCircle2 } from "lucide-react";

interface RFQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pre-select an approved requisition when opening from Requisitions. */
  initialRequisitionId?: string;
  initialData?: {
    id: string | number;
    title?: string;
    description?: string;
    deadline?: string;
    estimatedValue?: number;
    categoryId?: string | number;
    expectedQuantity?: number;
  } | null;
}

export function RFQDialog({ open, onOpenChange, onSuccess, initialRequisitionId, initialData }: RFQDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline: "",
    estimatedValue: "",
    categoryId: "",
    expectedQuantity: "",
  });

  const isEditing = !!initialData?.id;

  useEffect(() => {
    if (!open) return;
    setCategoriesLoading(true);
    vendorApi.getCategories().then((cats: any[]) => {
      setCategories(cats.map((c: any) => ({ id: c.categoryId, name: c.categoryName })));
    }).catch(() => {}).finally(() => setCategoriesLoading(false));

    if (initialData) {
      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        deadline: initialData.deadline
          ? new Date(initialData.deadline).toISOString().slice(0, 16)
          : "",
        estimatedValue: String(initialData.estimatedValue || ""),
        categoryId: String(initialData.categoryId || ""),
        expectedQuantity: String(initialData.expectedQuantity || ""),
      });
      setSelectedReqId("");
      return;
    }

    setFormData({ title: "", description: "", deadline: "", estimatedValue: "", categoryId: "", expectedQuantity: "" });
    setSelectedReqId("");
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("auth-storage") : null;
    const role: string = stored ? (JSON.parse(stored)?.state?.user?.role ?? "") : "";
    if (role === "VENDOR" || role === "VENDOR_ADMIN" || role === "VENDOR_SALES" || role === "VENDOR_FINANCE") return;
    requisitionApi.getAll({ page: 0, size: 100 }).then((res) => {
      setRequisitions((res.content ?? []).filter((r: any) => r.status === "APPROVED"));
    }).catch(() => {});
  }, [open, initialData]);

  useEffect(() => {
    if (!open || initialData || !initialRequisitionId || requisitions.length === 0) return;
    const reqId = String(initialRequisitionId);
    if (!requisitions.some((r: any) => String(r.requisitionId) === reqId)) return;
    handleRequisitionSelect(reqId, requisitions);
  }, [open, initialRequisitionId, initialData, requisitions, categories]);

  function handleRequisitionSelect(reqId: string, reqList = requisitions) {
    if (reqId === "__none__") { setSelectedReqId(""); return; }
    setSelectedReqId(reqId);
    if (!reqId) return;
    const req = reqList.find((r: any) => String(r.requisitionId) === reqId);
    if (!req) return;

    // Match item category string → categoryId from loaded categories
    const itemCategory: string | undefined = req.items?.[0]?.category;
    const matchedCat = itemCategory
      ? categories.find((c) => c.name.toLowerCase() === itemCategory.toLowerCase())
      : null;

    // Sum quantities across all items
    const totalQty: number = (req.items ?? []).reduce(
      (sum: number, item: any) => sum + (item.quantity || 0), 0
    );

    setFormData((prev) => ({
      ...prev,
      title: req.requisitionNumber
        ? `${req.requisitionNumber} — ${req.justification || req.department}`
        : (req.justification || `Requisition ${req.requisitionNumber}`),
      description: req.justification || "",
      estimatedValue: String(req.estimatedBudget || ""),
      categoryId: matchedCat ? String(matchedCat.id) : prev.categoryId,
      expectedQuantity: totalQty > 0 ? String(totalQty) : prev.expectedQuantity,
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        estimatedValue: parseFloat(formData.estimatedValue) || 0,
        categoryId: parseInt(formData.categoryId) || undefined,
        expectedQuantity: parseInt(formData.expectedQuantity) || undefined,
        deadline: new Date(formData.deadline).toISOString(),
        requisitionId: selectedReqId ? parseInt(selectedReqId) : undefined,
      };
      if (isEditing) {
        await rfqApi.update(initialData!.id, payload);
        toast({ title: "RFQ updated", description: "Request for quotation has been updated." });
      } else {
        await rfqApi.create(payload);
        toast({ title: "RFQ created", description: "Request for quotation sent to vendors." });
      }
      onSuccess();
      onOpenChange(false);
      setFormData({ title: "", description: "", deadline: "", estimatedValue: "", categoryId: "", expectedQuantity: "" });
      setSelectedReqId("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "create"} RFQ`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] rounded">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{isEditing ? "Edit RFQ" : "Create RFQ"}</DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing ? "Update the request for quotation details." : "Create a request for quotation and invite vendors to submit bids."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isEditing && requisitions.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500">Pre-fill from Requisition (optional)</Label>
              <Select value={selectedReqId} onValueChange={handleRequisitionSelect}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select an approved requisition…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {requisitions.map((req: any) => (
                    <SelectItem key={req.requisitionId} value={String(req.requisitionId)}>
                      {req.requisitionNumber} — {req.department} (${req.estimatedBudget?.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedReqId && (
                <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Form pre-filled from requisition
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter RFQ title"
              required
              className="h-8 text-xs border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the goods or services needed"
              rows={2}
              className="text-xs border-gray-200 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deadline" className="text-xs font-medium">Deadline *</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                required
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimatedValue" className="text-xs font-medium">Estimated Value ($)</Label>
              <Input
                id="estimatedValue"
                type="number"
                value={formData.estimatedValue}
                onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                placeholder="0.00"
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="categoryId" className="text-xs font-medium">Category *</Label>
              <Select value={formData.categoryId} onValueChange={(v) => setFormData({ ...formData, categoryId: v })}>
                <SelectTrigger id="categoryId" className="h-8 text-xs">
                  <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <div className="py-2 text-center text-[10px] text-gray-400">Loading categories…</div>
                  ) : categories.length === 0 ? (
                    <div className="py-2 text-center text-[10px] text-gray-400">No categories found</div>
                  ) : categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expectedQuantity" className="text-xs font-medium">Expected Quantity</Label>
              <Input
                id="expectedQuantity"
                type="number"
                value={formData.expectedQuantity}
                onChange={(e) => setFormData({ ...formData, expectedQuantity: e.target.value })}
                placeholder="e.g. 100"
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs rounded" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {isEditing ? "Save Changes" : "Create RFQ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
