"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { poApi, deliveryApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface DeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  prefilledPoId?: string | null;
}

export function DeliveryDialog({ open, onOpenChange, onSuccess, prefilledPoId }: DeliveryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [formData, setFormData] = useState({
    poId: "",
    vendorId: "",
    expectedDate: "",
    actualDate: "",
    quantityDelivered: "",
    issueNotes: "",
    qualityRemarks: "",
  });

  useEffect(() => {
    if (open) {
      loadPurchaseOrders();
      if (prefilledPoId) {
        setFormData((prev) => ({ ...prev, poId: prefilledPoId }));
      }
    }
  }, [open, prefilledPoId]);

  async function loadPurchaseOrders() {
    try {
      setLoadingPOs(true);
      const data = await poApi.getAllList();
      setPurchaseOrders(data.filter((po: any) => ["APPROVED", "Approved"].includes(po.status)));
    } catch {
      // fall back to manual entry
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
    setIsSubmitting(true);
    try {
      let vendorId = formData.vendorId ? parseInt(formData.vendorId) : undefined;
      if (!vendorId) {
        const selectedPO = purchaseOrders.find((po: any) => String(po.poId || po.id) === formData.poId);
        vendorId = selectedPO?.vendorId;
      }
      await deliveryApi.create({
        poId: parseInt(formData.poId),
        vendorId: vendorId || 0,
        expectedDate: formData.expectedDate || undefined,
        actualDate: formData.actualDate || new Date().toISOString().split("T")[0],
        quantityDelivered: parseInt(formData.quantityDelivered),
        issueNotes: formData.issueNotes || undefined,
        qualityRemarks: formData.qualityRemarks || undefined,
      });
      toast({ title: "Delivery recorded", description: "Delivery has been logged successfully." });
      onSuccess();
      onOpenChange(false);
      setFormData({ poId: "", vendorId: "", expectedDate: "", actualDate: "", quantityDelivered: "", issueNotes: "", qualityRemarks: "" });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Record Delivery</DialogTitle>
          <DialogDescription className="text-xs">
            Log a delivery against an approved purchase order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="poId" className="text-xs font-medium">Purchase Order *</Label>
            {purchaseOrders.length > 0 ? (
              <Select value={formData.poId} onValueChange={(v) => setFormData({ ...formData, poId: v })}>
                <SelectTrigger id="poId" className="h-8 text-xs">
                  <SelectValue placeholder={loadingPOs ? "Loading..." : "Select an approved PO"} />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po: any) => (
                    <SelectItem key={po.poId || po.id} value={String(po.poId || po.id)}>
                      {po.poNumber || `PO-${po.poId || po.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="poId"
                type="number"
                value={formData.poId}
                onChange={(e) => setFormData({ ...formData, poId: e.target.value })}
                placeholder={loadingPOs ? "Loading..." : "Enter PO ID"}
                required
                disabled={loadingPOs}
                className="h-8 text-xs border-gray-200"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantityDelivered" className="text-xs font-medium">Quantity Delivered *</Label>
            <Input
              id="quantityDelivered"
              type="number"
              value={formData.quantityDelivered}
              onChange={(e) => setFormData({ ...formData, quantityDelivered: e.target.value })}
              placeholder="e.g. 100"
              required
              className="h-8 text-xs border-gray-200"
            />
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

          <div className="space-y-1.5">
            <Label htmlFor="issueNotes" className="text-xs font-medium">Issue Notes</Label>
            <Input
              id="issueNotes"
              value={formData.issueNotes}
              onChange={(e) => setFormData({ ...formData, issueNotes: e.target.value })}
              placeholder="Any delivery problems (optional)"
              className="h-8 text-xs border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qualityRemarks" className="text-xs font-medium">Quality Remarks</Label>
            <Input
              id="qualityRemarks"
              value={formData.qualityRemarks}
              onChange={(e) => setFormData({ ...formData, qualityRemarks: e.target.value })}
              placeholder="Quality observations (optional)"
              className="h-8 text-xs border-gray-200"
            />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Record Delivery
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
