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
      const validPOs = data.filter((po: any) =>
        ["APPROVED", "Approved"].includes(po.status)
      );
      setPurchaseOrders(validPOs);
    } catch {
      // silently fall back to manual entry
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
      // Find vendorId from the selected PO if not manually entered
      let vendorId = formData.vendorId ? parseInt(formData.vendorId) : undefined;
      if (!vendorId) {
        const selectedPO = purchaseOrders.find(
          (po: any) => String(po.poId || po.id) === formData.poId
        );
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

      toast({ title: "Delivery recorded", description: "Delivery has been recorded successfully." });
      onSuccess();
      onOpenChange(false);
      setFormData({
        poId: "", vendorId: "", expectedDate: "", actualDate: "",
        quantityDelivered: "", issueNotes: "", qualityRemarks: "",
      });
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Record Delivery</DialogTitle>
          <DialogDescription>
            Record a delivery against an approved purchase order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="poId">Purchase Order *</Label>
            {purchaseOrders.length > 0 ? (
              <Select
                value={formData.poId}
                onValueChange={(v) => setFormData({ ...formData, poId: v })}
              >
                <SelectTrigger id="poId">
                  <SelectValue placeholder={loadingPOs ? "Loading..." : "Select an approved PO"} />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po: any) => (
                    <SelectItem key={po.poId || po.id} value={String(po.poId || po.id)}>
                      {po.poNumber || `PO-${po.poId || po.id}`} ({po.status})
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
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantityDelivered">Quantity Delivered *</Label>
            <Input
              id="quantityDelivered"
              type="number"
              value={formData.quantityDelivered}
              onChange={(e) => setFormData({ ...formData, quantityDelivered: e.target.value })}
              placeholder="e.g. 100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expectedDate">Expected Date</Label>
              <Input
                id="expectedDate"
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actualDate">Actual Date</Label>
              <Input
                id="actualDate"
                type="date"
                value={formData.actualDate}
                onChange={(e) => setFormData({ ...formData, actualDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issueNotes">Issue Notes</Label>
            <Input
              id="issueNotes"
              value={formData.issueNotes}
              onChange={(e) => setFormData({ ...formData, issueNotes: e.target.value })}
              placeholder="Any delivery issues (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qualityRemarks">Quality Remarks</Label>
            <Input
              id="qualityRemarks"
              value={formData.qualityRemarks}
              onChange={(e) => setFormData({ ...formData, qualityRemarks: e.target.value })}
              placeholder="Quality observations (optional)"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Delivery
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
