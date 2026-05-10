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
      // fall back to empty list — user can type ID manually
    } finally {
      setLoadingCategories(false);
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) newErrors.companyName = "Company name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email format";
    if (!formData.contactPerson.trim()) newErrors.contactPerson = "Contact person is required";
    if (!formData.categoryId) newErrors.categoryId = "Category is required";
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

      toast({
        title: "Vendor created",
        description: `${formData.companyName} has been added successfully.`,
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Vendor</DialogTitle>
          <DialogDescription>Register a new vendor to your supplier network.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => {
                setFormData({ ...formData, companyName: e.target.value });
                if (errors.companyName) setErrors({ ...errors, companyName: "" });
              }}
              placeholder="Enter company name"
              className={errors.companyName ? "border-red-500" : ""}
            />
            {errors.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPerson">Contact Person *</Label>
            <Input
              id="contactPerson"
              value={formData.contactPerson}
              onChange={(e) => {
                setFormData({ ...formData, contactPerson: e.target.value });
                if (errors.contactPerson) setErrors({ ...errors, contactPerson: "" });
              }}
              placeholder="Enter contact person name"
              className={errors.contactPerson ? "border-red-500" : ""}
            />
            {errors.contactPerson && <p className="text-xs text-red-500">{errors.contactPerson}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
                placeholder="vendor@company.com"
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+1 234 567 890"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter company address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID</Label>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="Tax identification number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category *</Label>
              {categories.length > 0 ? (
                <Select
                  value={formData.categoryId}
                  onValueChange={(v) => {
                    setFormData({ ...formData, categoryId: v });
                    if (errors.categoryId) setErrors({ ...errors, categoryId: "" });
                  }}
                >
                  <SelectTrigger id="categoryId" className={errors.categoryId ? "border-red-500" : ""}>
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
                />
              )}
              {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Vendor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
