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
import { adminApi, superAdminApi } from "@/lib/api";
import { useAuthStore, isBuyerRole } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, KeyRound, Mail } from "lucide-react";

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phoneNumber: "",
  roleName: "OFFICER",
  supplierRoleName: "",
  tenantId: "",
};

interface CreatedCreds {
  fullName: string;
  email: string;
  password: string;
  tenantName: string;
  tenantDomain: string;
}

export function UserDialog({ open, onOpenChange, onSuccess }: UserDialogProps) {
  const { toast } = useToast();
  const hasRole = useAuthStore((s) => s.hasRole);
  const tenantName = useAuthStore((s) => s.tenantName);
  const tenantDomain = useAuthStore((s) => s.tenantDomain);
  const isSuperAdmin = hasRole(["SUPER_ADMIN"]);
  const organizationType = useAuthStore((s) => s.organizationType);

  const [form, setForm] = useState(EMPTY_FORM);
  const showSupplierRoleField =
    organizationType === "BOTH" && isBuyerRole(form.roleName);
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<{ tenantId: number; name: string; domain: string }[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<CreatedCreds | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !isSuperAdmin) return;
    setLoadingTenants(true);
    superAdminApi.getAllTenantsList()
      .then((data) => setTenants(data.filter((t: any) => t.status === "ACTIVE")))
      .catch(() => setTenants([]))
      .finally(() => setLoadingTenants(false));
  }, [open, isSuperAdmin]);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setCreatedCreds(null);
      setCopied(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSuperAdmin && !form.tenantId) {
      toast({ title: "Validation", description: "Please select a tenant.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      let selectedTenant = { name: tenantName || "", domain: tenantDomain || "" };

      if (isSuperAdmin) {
        const t = tenants.find((x) => String(x.tenantId) === form.tenantId);
        if (t) selectedTenant = { name: t.name, domain: t.domain };
        await superAdminApi.createUser({
          fullName,
          email: form.email,
          password: form.password,
          phoneNumber: form.phoneNumber || undefined,
          roleName: form.roleName,
          supplierRoleName: form.supplierRoleName || undefined,
          tenantId: Number(form.tenantId),
        });
      } else {
        await adminApi.createUser({
          fullName,
          email: form.email,
          password: form.password,
          phoneNumber: form.phoneNumber || undefined,
          roleName: form.roleName,
          supplierRoleName: form.supplierRoleName || undefined,
        });
      }

      // Show credentials instead of immediately closing
      setCreatedCreds({
        fullName,
        email: form.email,
        password: form.password,
        tenantName: selectedTenant.name,
        tenantDomain: selectedTenant.domain,
      });
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function copyCredentials() {
    if (!createdCreds) return;
    const text = [
      `Name: ${createdCreds.fullName}`,
      `Email: ${createdCreds.email}`,
      `Password: ${createdCreds.password}`,
      `Organisation domain: ${createdCreds.tenantDomain}`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const set = (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value });

  // — Credentials screen —
  if (createdCreds) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px] rounded">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              User Created — Share Credentials
            </DialogTitle>
            <DialogDescription className="text-xs">
              Send these credentials to <span className="font-medium">{createdCreds.fullName}</span>.
              They will be prompted to change their password on first login.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded border border-gray-200 bg-gray-50 p-4 space-y-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 font-sans mb-0.5">Email</p>
                <p className="font-semibold truncate">{createdCreds.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 font-sans mb-0.5">Temporary password</p>
                <p className="font-semibold">{createdCreds.password}</p>
              </div>
            </div>
            {createdCreds.tenantDomain && (
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 text-[10px] font-sans">@</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500 font-sans mb-0.5">Organisation domain (required to log in)</p>
                  <p className="font-semibold">{createdCreds.tenantDomain}</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
            Store this password securely — it will not be shown again.
          </p>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={copyCredentials}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy credentials"}
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // — Creation form —
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Add New User</DialogTitle>
          <DialogDescription className="text-xs">
            {isSuperAdmin
              ? "Create a user account in any active tenant organisation."
              : "Create a new user account and assign their role."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tenant *</Label>
              {loadingTenants ? (
                <div className="flex items-center gap-2 h-8 text-xs text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading tenants…
                </div>
              ) : (
                <Select value={form.tenantId} onValueChange={(v) => setForm({ ...form, tenantId: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.tenantId} value={String(t.tenantId)} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs font-medium">First Name *</Label>
              <Input id="firstName" value={form.firstName} onChange={set("firstName")}
                placeholder="John" required className="h-8 text-xs border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-xs font-medium">Last Name *</Label>
              <Input id="lastName" value={form.lastName} onChange={set("lastName")}
                placeholder="Doe" required className="h-8 text-xs border-gray-200" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium">Email *</Label>
            <Input id="email" type="email" value={form.email} onChange={set("email")}
              placeholder="user@company.com" required className="h-8 text-xs border-gray-200" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium">Temporary Password *</Label>
            <Input id="password" type="text" value={form.password} onChange={set("password")}
              placeholder="Min 6 characters" required className="h-8 text-xs border-gray-200" />
            <p className="text-[10px] text-gray-400">User will be asked to change this on first login.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber" className="text-xs font-medium">Phone</Label>
              <Input id="phoneNumber" value={form.phoneNumber} onChange={set("phoneNumber")}
                placeholder="+1 234 567 890" className="h-8 text-xs border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roleName" className="text-xs font-medium">Role *</Label>
              <Select value={form.roleName} onValueChange={(v) => setForm({ ...form, roleName: v })}>
                <SelectTrigger id="roleName" className="h-8 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="OFFICER">Procurement Officer</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="AUDITOR">Auditor</SelectItem>
                  <SelectItem value="DIRECTOR">Director</SelectItem>
                  <SelectItem value="VENDOR_ADMIN">Vendor Admin</SelectItem>
                  <SelectItem value="VENDOR_SALES">Vendor — Sales Rep</SelectItem>
                  <SelectItem value="VENDOR_FINANCE">Vendor — Finance</SelectItem>
                  <SelectItem value="VENDOR_LOGISTICS">Vendor — Logistics</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showSupplierRoleField && (
            <div className="space-y-1.5 rounded-md border border-blue-100 bg-blue-50/50 p-3">
              <Label className="text-xs font-medium text-blue-900">Sales role (optional)</Label>
              <p className="text-[10px] text-blue-700/80 mb-1.5">
                Assign a supplier-side role so this user can switch to Sales mode (bids, shipments, invoicing).
              </p>
              <Select
                value={form.supplierRoleName || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, supplierRoleName: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="No sales access" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No sales access</SelectItem>
                  <SelectItem value="VENDOR_ADMIN">Supplier Admin</SelectItem>
                  <SelectItem value="VENDOR_SALES">Sales</SelectItem>
                  <SelectItem value="VENDOR_LOGISTICS">Logistics</SelectItem>
                  <SelectItem value="VENDOR_FINANCE">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
