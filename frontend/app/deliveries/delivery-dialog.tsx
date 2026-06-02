"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { poApi, deliveryApi } from "@/lib/api";
import {
  QUALITY_RATINGS,
  QUALITY_ISSUE_TYPES,
  type QualityIssueType,
  type QualityRating,
} from "@/lib/delivery-quality";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface DeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  prefilledPoId?: string | null;
}

const EMPTY_FORM = {
  poId: "",
  expectedDate: "",
  actualDate: "",
  quantityDelivered: "",
  quantityOrdered: "",
  qualityRating: "ACCEPTED" as QualityRating,
  issueTypes: [] as QualityIssueType[],
  issueNotes: "",
  qualityRemarks: "",
};

export function DeliveryDialog({ open, onOpenChange, onSuccess, prefilledPoId }: DeliveryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      loadPurchaseOrders();
      if (prefilledPoId) {
        setFormData((prev) => ({ ...prev, poId: prefilledPoId }));
      }
    }
  }, [open, prefilledPoId]);

  function toggleIssueType(code: QualityIssueType, checked: boolean) {
    setFormData((prev) => ({
      ...prev,
      issueTypes: checked
        ? [...prev.issueTypes, code]
        : prev.issueTypes.filter((t) => t !== code),
    }));
  }

  async function loadPurchaseOrders() {
    try {
      setLoadingPOs(true);
      setLoadError(false);
      const data = await poApi.getAllList();
      setPurchaseOrders(
        (data as any[]).filter((po: any) =>
          ["APPROVED", "Approved"].includes(po.status),
        ),
      );
    } catch {
      setPurchaseOrders([]);
      setLoadError(true);
    } finally {
      setLoadingPOs(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.poId || !formData.quantityDelivered) {
      toast({ title: "Validation error", description: "PO and quantity are required.", variant: "destructive" });
      return;
    }
    if (
      formData.qualityRating === "ACCEPTED_WITH_ISSUES" &&
      formData.issueTypes.length === 0
    ) {
      toast({
        title: "Validation error",
        description: "Select at least one issue type when accepting with issues.",
        variant: "destructive",
      });
      return;
    }
    if (formData.qualityRating === "REJECTED" && formData.issueTypes.length === 0) {
      toast({
        title: "Validation error",
        description: "Select why the delivery was rejected.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedPO = purchaseOrders.find((po: any) => String(po.poId || po.id) === formData.poId);
      const vendorId = selectedPO?.vendorId;
      if (!vendorId) {
        toast({ title: "Validation error", description: "Could not determine vendor for the selected PO.", variant: "destructive" });
        return;
      }
      const qtyOrdered = formData.quantityOrdered
        ? parseInt(formData.quantityOrdered, 10)
        : undefined;

      await deliveryApi.create({
        poId: parseInt(formData.poId, 10),
        vendorId: parseInt(String(vendorId), 10),
        expectedDate: formData.expectedDate || undefined,
        actualDate: formData.actualDate || new Date().toISOString().split("T")[0],
        quantityDelivered: parseInt(formData.quantityDelivered, 10),
        quantityOrdered: qtyOrdered && !Number.isNaN(qtyOrdered) ? qtyOrdered : undefined,
        qualityRating: formData.qualityRating,
        qualityIssueTypes: formData.issueTypes.length ? formData.issueTypes.join(",") : undefined,
        issueNotes: formData.issueNotes || undefined,
        qualityRemarks: formData.qualityRemarks || undefined,
      });
      toast({ title: "Delivery recorded", description: "Inspection recorded and vendor score will update." });
      onSuccess();
      onOpenChange(false);
      setFormData(EMPTY_FORM);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to record delivery",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showIssueTypes =
    formData.qualityRating === "ACCEPTED_WITH_ISSUES" || formData.qualityRating === "REJECTED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Record Delivery</DialogTitle>
          <DialogDescription className="text-xs">
            Log receipt against an approved PO. Quality inspection drives vendor scoring (structured fields, not free text).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="poId" className="text-xs font-medium">Purchase Order *</Label>
            <Select
              value={formData.poId}
              onValueChange={(v) => setFormData({ ...formData, poId: v })}
              disabled={loadingPOs || purchaseOrders.length === 0}
            >
              <SelectTrigger id="poId" className="h-8 text-xs">
                <SelectValue
                  placeholder={
                    loadingPOs
                      ? "Loading purchase orders…"
                      : purchaseOrders.length === 0
                        ? "No approved POs available"
                        : "Select an approved PO"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {purchaseOrders.map((po: any) => {
                  const id = String(po.poId || po.id);
                  const label = po.poNumber || `PO-${id.padStart(6, "0")}`;
                  const amount = po.totalAmount != null ? ` — $${Number(po.totalAmount).toLocaleString()}` : "";
                  return (
                    <SelectItem key={id} value={id}>
                      {label}{amount}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {loadError && (
              <div className="flex items-center gap-2 text-[10px] text-red-600">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>Could not load purchase orders.</span>
                <button type="button" onClick={loadPurchaseOrders} className="font-medium underline hover:no-underline">
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantityDelivered" className="text-xs font-medium">Quantity Delivered *</Label>
              <Input
                id="quantityDelivered"
                type="number"
                min={0}
                value={formData.quantityDelivered}
                onChange={(e) => setFormData({ ...formData, quantityDelivered: e.target.value })}
                placeholder="e.g. 50"
                required
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantityOrdered" className="text-xs font-medium">Quantity Ordered</Label>
              <Input
                id="quantityOrdered"
                type="number"
                min={0}
                value={formData.quantityOrdered}
                onChange={(e) => setFormData({ ...formData, quantityOrdered: e.target.value })}
                placeholder="For short-ship check"
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expectedDate" className="text-xs font-medium">Expected Date</Label>
              <Input
                id="expectedDate"
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actualDate" className="text-xs font-medium">Actual Date</Label>
              <Input
                id="actualDate"
                type="date"
                value={formData.actualDate}
                onChange={(e) => setFormData({ ...formData, actualDate: e.target.value })}
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <div className="space-y-1.5 rounded-md border border-gray-200 bg-gray-50/80 p-3">
            <Label className="text-xs font-medium">Quality inspection *</Label>
            <Select
              value={formData.qualityRating}
              onValueChange={(v) =>
                setFormData({
                  ...formData,
                  qualityRating: v as QualityRating,
                  issueTypes: v === "ACCEPTED" ? [] : formData.issueTypes,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_RATINGS.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-xs">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showIssueTypes && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[10px] text-gray-500">Issue types *</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {QUALITY_ISSUE_TYPES.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
                    >
                      <Checkbox
                        checked={formData.issueTypes.includes(value)}
                        onCheckedChange={(c) => toggleIssueType(value, c === true)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issueNotes" className="text-xs font-medium">Issue notes</Label>
            <Input
              id="issueNotes"
              value={formData.issueNotes}
              onChange={(e) => setFormData({ ...formData, issueNotes: e.target.value })}
              placeholder="Operational notes (optional)"
              className="h-8 text-xs border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qualityRemarks" className="text-xs font-medium">Additional remarks</Label>
            <Textarea
              id="qualityRemarks"
              value={formData.qualityRemarks}
              onChange={(e) => setFormData({ ...formData, qualityRemarks: e.target.value })}
              placeholder="Audit trail only — not used for scoring"
              rows={2}
              className="text-xs border-gray-200 resize-none"
            />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={isSubmitting || !formData.poId || loadingPOs || purchaseOrders.length === 0}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Record Delivery
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
