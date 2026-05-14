"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { vendorApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EMPTY_FORM = {
  companyName: "",
  contactPerson: "",
  email: "",
  phoneNumber: "",
  address: "",
  taxId: "",
  categoryId: "",
};

export function VendorDialog({ open, onOpenChange, onSuccess }: VendorDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<{ categoryId: number; categoryName: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      loadCategories();
      setFormData(EMPTY_FORM);
      setErrors({});
    }
  }, [open]);

  async function loadCategories() {
    try {
      setLoadingCategories(true);
      const data = await vendorApi.getCategories();
      setCategories(data as any[]);
    } catch {
      // fall back to empty list
    } finally {
      setLoadingCategories(false);
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) newErrors.companyName = "Required";
    if (!formData.email.trim()) newErrors.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Invalid email";
    if (!formData.contactPerson.trim()) newErrors.contactPerson = "Required";
    if (!formData.categoryId) newErrors.categoryId = "Required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      await vendorApi.register({
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        categoryId: parseInt(formData.categoryId),
        phoneNumber: formData.phoneNumber || undefined,
        address: formData.address || undefined,
        taxId: formData.taxId || undefined,
      });
      toast({ title: "Vendor created", description: `${formData.companyName} has been added.` });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create vendor",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (id: string, label: string, required = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}{required ? " *" : ""}</Label>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Add New Vendor</DialogTitle>
          <DialogDescription className="text-xs">Register a new vendor to your supplier network.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="companyName" className="text-xs font-medium">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => { setFormData({ ...formData, companyName: e.target.value }); if (errors.companyName) setErrors({ ...errors, companyName: "" }); }}
              placeholder="Acme Corp"
              className={`h-8 text-xs border-gray-200 ${errors.companyName ? "border-red-400" : ""}`}
            />
            {errors.companyName && <p className="text-[10px] text-red-500">{errors.companyName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactPerson" className="text-xs font-medium">Contact Person *</Label>
            <Input
              id="contactPerson"
              value={formData.contactPerson}
              onChange={(e) => { setFormData({ ...formData, contactPerson: e.target.value }); if (errors.contactPerson) setErrors({ ...errors, contactPerson: "" }); }}
              placeholder="Jane Smith"
              className={`h-8 text-xs border-gray-200 ${errors.contactPerson ? "border-red-400" : ""}`}
            />
            {errors.contactPerson && <p className="text-[10px] text-red-500">{errors.contactPerson}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: "" }); }}
                placeholder="vendor@company.com"
                className={`h-8 text-xs border-gray-200 ${errors.email ? "border-red-400" : ""}`}
              />
              {errors.email && <p className="text-[10px] text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber" className="text-xs font-medium">Phone</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+1 234 567 890"
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs font-medium">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Business St, City"
              className="h-8 text-xs border-gray-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="taxId" className="text-xs font-medium">Tax ID</Label>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="Tax ID number"
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoryId" className="text-xs font-medium">Category *</Label>
              {categories.length > 0 ? (
                <Select
                  value={formData.categoryId}
                  onValueChange={(v) => { setFormData({ ...formData, categoryId: v }); if (errors.categoryId) setErrors({ ...errors, categoryId: "" }); }}
                >
                  <SelectTrigger id="categoryId" className={`h-8 text-xs ${errors.categoryId ? "border-red-400" : ""}`}>
                    <SelectValue placeholder={loadingCategories ? "Loading..." : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.categoryId} value={String(cat.categoryId)}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="categoryId"
                  type="number"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  placeholder={loadingCategories ? "Loading..." : "Category ID"}
                  disabled={loadingCategories}
                  className="h-8 text-xs border-gray-200"
                />
              )}
              {errors.categoryId && <p className="text-[10px] text-red-500">{errors.categoryId}</p>}
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Add Vendor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
