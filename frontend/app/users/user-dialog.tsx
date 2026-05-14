"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UserDialog({ open, onOpenChange, onSuccess }: UserDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phoneNumber: "",
    roleName: "VENDOR",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await adminApi.createUser({
        fullName: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        roleName: formData.roleName,
      });
      toast({
        title: "User created",
        description: `${formData.firstName} ${formData.lastName} has been added successfully.`,
      });
      onSuccess();
      onOpenChange(false);
      setFormData({ firstName: "", lastName: "", email: "", password: "", phoneNumber: "", roleName: "VENDOR" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user",
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
          <DialogTitle className="text-sm font-semibold">Add New User</DialogTitle>
          <DialogDescription className="text-xs">
            Create a new user account and assign their role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs font-medium">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
                required
                className="h-8 text-xs border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-xs font-medium">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
                required
                className="h-8 text-xs border-gray-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@company.com"
              required
              className="h-8 text-xs border-gray-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium">Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min 8 characters"
              required
              className="h-8 text-xs border-gray-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label htmlFor="roleName" className="text-xs font-medium">Role *</Label>
              <Select value={formData.roleName} onValueChange={(v) => setFormData({ ...formData, roleName: v })}>
                <SelectTrigger id="roleName" className="h-8 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="OFFICER">Procurement Officer</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="AUDITOR">Auditor</SelectItem>
                  <SelectItem value="VENDOR">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
