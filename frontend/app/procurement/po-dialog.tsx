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
import { poApi, rfqApi, bidApi, vendorApi, getVendorNameMap } from "@/lib/api";
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
  const [vendorMap, setVendorMap] = useState<Map<string, string> | null>(null);
  const [bids, setBids] = useState<any[]>([]);
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
      const [rfqData, vendorData, vendorNameMap] = await Promise.all([
        rfqApi.getAllList().catch(() => []),
        vendorApi.getAllList().catch(() => []),
        getVendorNameMap(),
      ]);
      // Only show open RFQs for new POs
      setRfqs(rfqData.filter((r: any) => r.status?.toUpperCase() === "OPEN"));
      // Only show active/verified vendors
      setVendors(vendorData.filter((v: any) =>
        v.status === "ACTIVE" || v.verified === true || v.complianceStatus === "Verified"
      ));
      setVendorMap(vendorNameMap);
    } catch {
      // silently fall back — user can type IDs manually
    } finally {
      setLoadingData(false);
    }
  }

  // When RFQ selection changes, load its bids so user can pick one by vendor name
  async function handleRfqChange(rfqId: string) {
    setFormData((prev) => ({ ...prev, rfqId, bidId: "" }));
    setBids([]);
    if (!rfqId) return;
    try {
      const bidData = await bidApi.getByRfq(rfqId).catch(() => []);
      setBids((bidData as any[]).filter((b: any) =>
        !["REJECTED", "Rejected", "AWARDED", "Awarded"].includes(b.status)
      ));
    } catch { /* no bids */ }
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
      <DialogContent className="sm:max-w-[560px] rounded">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{isEditing ? "Edit Purchase Order" : "Create Purchase Order"}</DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Update the details of this purchase order."
              : "Create a new purchase order linked to an RFQ and vendor."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rfqId" className="text-xs font-medium">RFQ *</Label>
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
                onValueChange={handleRfqChange}
              >
                <SelectTrigger id="rfqId" className="h-8 text-xs">
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
                className="h-8 text-xs border-gray-200"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vendorId" className="text-xs font-medium">Vendor *</Label>
              {vendors.length > 0 ? (
                <Select
                  value={formData.vendorId}
                  onValueChange={(v) => setFormData({ ...formData, vendorId: v })}
                >
                  <SelectTrigger id="vendorId" className="h-8 text-xs">
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
                  className="h-8 text-xs border-gray-200"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="totalAmount" className="text-xs font-medium">Total Amount ($) *</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                placeholder="0.00"
                required={!isEditing}
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expectedDeliveryDate" className="text-xs font-medium">Expected Delivery Date</Label>
            <Input
              id="expectedDeliveryDate"
              type="date"
              value={formData.expectedDeliveryDate}
              onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
              className="h-8 text-xs border-gray-200"
            />
          </div>

          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="bidId" className="text-xs font-medium">Linked Bid (optional)</Label>
              {bids.length > 0 ? (
                <Select
                  value={formData.bidId}
                  onValueChange={(v) => setFormData({ ...formData, bidId: v })}
                >
                  <SelectTrigger id="bidId" className="h-8 text-xs">
                    <SelectValue placeholder="Select a bid (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {bids.map((b: any) => (
                      <SelectItem key={b.bidId || b.id} value={String(b.bidId || b.id)}>
                        {b.vendorName || vendorMap?.get(String(b.vendorId || "")) || `Vendor #${b.vendorId}`} — {Number(b.bidAmount).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-gray-400 py-1">
                  {formData.rfqId ? "No eligible bids for this RFQ." : "Select an RFQ first to see available bids."}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Purchase Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
