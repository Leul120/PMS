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
import { poApi, rfqApi, vendorApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface PODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Pass an existing PO to edit it instead of creating a new one */
  initialData?: {
    id: string | number;
    rfqId?: string | number;
    vendorId?: string | number;
    totalAmount?: number;
    deliveryDate?: string;
  } | null;
}

const EMPTY_FORM = {
  rfqId: "",
  vendorId: "",
  totalAmount: "",
  expectedDeliveryDate: "",
  bidId: "",
};

export function PODialog({ open, onOpenChange, onSuccess, initialData }: PODialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const isEditing = !!initialData?.id;

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setFormData({
        rfqId: String(initialData.rfqId || ""),
        vendorId: String(initialData.vendorId || ""),
        totalAmount: String(initialData.totalAmount || ""),
        expectedDeliveryDate: initialData.deliveryDate
          ? new Date(initialData.deliveryDate).toISOString().split("T")[0]
          : "",
        bidId: "",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    loadDropdownData();
  }, [open]);

  async function loadDropdownData() {
    try {
      setLoadingData(true);
      const [rfqData, vendorData] = await Promise.all([
        rfqApi.getAllList().catch(() => []),
        vendorApi.getAllList().catch(() => []),
      ]);
      // Only show open RFQs for new POs
      setRfqs(rfqData.filter((r: any) => r.status?.toUpperCase() === "OPEN"));
      // Only show active/verified vendors
      setVendors(vendorData.filter((v: any) =>
        v.status === "ACTIVE" || v.verified === true || v.complianceStatus === "Verified"
      ));
    } catch {
      // silently fall back — user can type IDs manually
    } finally {
      setLoadingData(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isEditing) {
        if (!formData.rfqId || !formData.vendorId || !formData.totalAmount) {
          toast({ title: "Validation error", description: "RFQ, Vendor and Amount are required.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        await poApi.update(initialData!.id, {
          rfqId: parseInt(formData.rfqId),
          vendorId: parseInt(formData.vendorId),
          totalAmount: parseFloat(formData.totalAmount),
          expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
        });
        toast({ title: "Purchase Order updated", description: "The purchase order has been updated." });
      } else {
        if (!formData.rfqId || !formData.vendorId || !formData.totalAmount) {
          toast({ title: "Validation error", description: "RFQ, Vendor and Amount are required.", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        await poApi.create({
          rfqId: parseInt(formData.rfqId),
          vendorId: parseInt(formData.vendorId),
          totalAmount: parseFloat(formData.totalAmount),
          expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
          bidId: formData.bidId ? parseInt(formData.bidId) : undefined,
        });
        toast({ title: "Purchase Order created", description: "The purchase order has been created successfully." });
      }

      onSuccess();
      onOpenChange(false);
      setFormData(EMPTY_FORM);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "create"} purchase order`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Purchase Order" : "Create Purchase Order"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details of this purchase order."
              : "Create a new purchase order linked to an RFQ and vendor."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rfqId">RFQ *</Label>
            {isEditing ? (
              <Input
                id="rfqId"
                type="number"
                value={formData.rfqId}
                readOnly
                disabled
                className="bg-muted"
              />
            ) : rfqs.length > 0 ? (
              <Select
                value={formData.rfqId}
                onValueChange={(v) => setFormData({ ...formData, rfqId: v })}
              >
                <SelectTrigger id="rfqId">
                  <SelectValue placeholder={loadingData ? "Loading..." : "Select an open RFQ"} />
                </SelectTrigger>
                <SelectContent>
                  {rfqs.map((rfq: any) => (
                    <SelectItem key={rfq.rfqId || rfq.id} value={String(rfq.rfqId || rfq.id)}>
                      {rfq.rfqNumber || `RFQ-${rfq.rfqId || rfq.id}`} — {rfq.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="rfqId"
                type="number"
                value={formData.rfqId}
                onChange={(e) => setFormData({ ...formData, rfqId: e.target.value })}
                placeholder={loadingData ? "Loading..." : "Enter RFQ ID"}
                required
                disabled={loadingData}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendorId">Vendor *</Label>
              {vendors.length > 0 ? (
                <Select
                  value={formData.vendorId}
                  onValueChange={(v) => setFormData({ ...formData, vendorId: v })}
                >
                  <SelectTrigger id="vendorId">
                    <SelectValue placeholder={loadingData ? "Loading..." : "Select a vendor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: any) => (
                      <SelectItem key={v.vendorId || v.id} value={String(v.vendorId || v.id)}>
                        {v.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="vendorId"
                  type="number"
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                  placeholder={loadingData ? "Loading..." : "Enter vendor ID"}
                  required={!isEditing}
                  disabled={loadingData}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount ($) *</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                placeholder="0.00"
                required={!isEditing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
            <Input
              id="expectedDeliveryDate"
              type="date"
              value={formData.expectedDeliveryDate}
              onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
            />
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="bidId">Linked Bid ID (optional)</Label>
              <Input
                id="bidId"
                type="number"
                value={formData.bidId}
                onChange={(e) => setFormData({ ...formData, bidId: e.target.value })}
                placeholder="Leave blank if not from a bid"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Purchase Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
