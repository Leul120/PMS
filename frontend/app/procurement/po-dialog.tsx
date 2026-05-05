"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { poApi, vendorApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Vendor {
  id: string;
  companyName: string;
  email: string;
}

interface PODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PODialog({ open, onOpenChange, onSuccess }: PODialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    vendorId: "",
    totalAmount: "",
    deliveryDate: "",
  });

  // Load vendors when dialog opens
  useEffect(() => {
    if (open) {
      loadVendors();
    }
  }, [open]);

  async function loadVendors() {
    try {
      setLoadingVendors(true);
      const data = await vendorApi.getAll();
      // Filter for verified/active vendors
      const activeVendors = data.filter((v: any) => v.status === 'VERIFIED' || v.status === 'ACTIVE');
      setVendors(activeVendors);
    } catch (err) {
      toast({
        title: "Warning",
        description: "Could not load vendors. You can still enter the vendor ID manually.",
        variant: "destructive",
      });
    } finally {
      setLoadingVendors(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await poApi.create({
        ...formData,
        vendorId: parseInt(formData.vendorId),
        totalAmount: parseFloat(formData.totalAmount) || 0,
        deliveryDate: formData.deliveryDate ? new Date(formData.deliveryDate).toISOString() : null,
      });
      
      toast({
        title: "Purchase Order created",
        description: "The purchase order has been created successfully.",
      });
      
      onSuccess();
      onOpenChange(false);
      setFormData({
        title: "",
        description: "",
        vendorId: "",
        totalAmount: "",
        deliveryDate: "",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create purchase order",
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
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Create a new purchase order for a vendor.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title/Description *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter PO title or description"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional Details</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional order details"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendorId">Vendor *</Label>
              {vendors.length > 0 ? (
                <Select
                  value={formData.vendorId}
                  onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                >
                  <SelectTrigger id="vendorId">
                    <SelectValue placeholder={loadingVendors ? "Loading..." : "Select a vendor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.companyName}
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
                  placeholder={loadingVendors ? "Loading..." : "Enter vendor ID"}
                  required
                  disabled={loadingVendors}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount ($) *</Label>
              <Input
                id="totalAmount"
                type="number"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
            <Input
              id="deliveryDate"
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Purchase Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
