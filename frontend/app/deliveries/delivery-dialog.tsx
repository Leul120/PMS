"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { poApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  title: string;
  status: string;
}

interface DeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeliveryDialog({ open, onOpenChange, onSuccess }: DeliveryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [formData, setFormData] = useState({
    poId: "",
    status: "",
    trackingNumber: "",
    notes: "",
  });

  // Load purchase orders when dialog opens
  useEffect(() => {
    if (open) {
      loadPurchaseOrders();
    }
  }, [open]);

  async function loadPurchaseOrders() {
    try {
      setLoadingPOs(true);
      const data = await poApi.getAll();
      // Filter for POs that can have deliveries (not cancelled/rejected)
      const validPOs = data.filter((po: any) => 
        ['PENDING', 'APPROVED', 'PROCESSING', 'SHIPPED'].includes(po.status)
      );
      setPurchaseOrders(validPOs);
    } catch (err) {
      toast({
        title: "Warning",
        description: "Could not load purchase orders. You can still enter the ID manually.",
        variant: "destructive",
      });
    } finally {
      setLoadingPOs(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await poApi.updateStatus(formData.poId, formData.status);
      
      toast({
        title: "Status updated",
        description: `Delivery status updated to ${formData.status}.`,
      });
      
      onSuccess();
      onOpenChange(false);
      setFormData({
        poId: "",
        status: "",
        trackingNumber: "",
        notes: "",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Delivery Status</DialogTitle>
          <DialogDescription>
            Update the delivery status for a purchase order.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="poId">Purchase Order *</Label>
            {purchaseOrders.length > 0 ? (
              <Select
                value={formData.poId}
                onValueChange={(value) => setFormData({ ...formData, poId: value })}
              >
                <SelectTrigger id="poId">
                  <SelectValue placeholder={loadingPOs ? "Loading..." : "Select a purchase order"} />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.poNumber || `PO-${po.id}`} - {po.title} ({po.status})
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
            <Label htmlFor="status">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="DELAYED">Delayed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trackingNumber">Tracking Number</Label>
            <Input
              id="trackingNumber"
              value={formData.trackingNumber}
              onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
              placeholder="Enter tracking number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
