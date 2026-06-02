"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { authApi } from "@/lib/api";
import { RequireRole } from "@/components/require-role";
import { Building2, UserPlus, Loader2, Mail, Phone, Shield, Briefcase } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  VENDOR_ADMIN: "Admin",
  VENDOR_SALES: "Sales Rep",
  VENDOR_LOGISTICS: "Logistics",
  VENDOR_FINANCE: "Finance",
  MANAGER: "Manager",
  OFFICER: "Officer",
  ADMIN: "Administrator",
};

const ROLE_COLORS: Record<string, string> = {
  VENDOR_ADMIN: "bg-orange-100 text-orange-800",
  VENDOR_SALES: "bg-amber-100 text-amber-800",
  VENDOR_LOGISTICS: "bg-teal-100 text-teal-800",
  VENDOR_FINANCE: "bg-yellow-100 text-yellow-800",
  MANAGER: "bg-blue-100 text-blue-800",
  OFFICER: "bg-indigo-100 text-indigo-800",
  ADMIN: "bg-purple-100 text-purple-800",
};

const EMPTY_INVITE = { fullName: "", email: "", roleName: "VENDOR_SALES", phoneNumber: "" };

export default function CompanyPage() {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const tenantName = useAuthStore((state) => state.tenantName);
  const tenantDomain = useAuthStore((state) => state.tenantDomain);

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_INVITE });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);
      const all = await authApi.getUsers();
      setMembers(all ?? []);
    } catch (err) {
      toast({
        title: "Could not load team",
        description: err instanceof Error ? err.message : "Failed to load team members",
        variant: "destructive",
      });
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authApi.inviteTeamMember({
        fullName: form.fullName,
        email: form.email,
        roleName: form.roleName,
        phoneNumber: form.phoneNumber || undefined,
      });
      toast({
        title: "Invitation sent",
        description: `${form.fullName} will receive an email with login instructions.`,
      });
      setInviteOpen(false);
      setForm({ ...EMPTY_INVITE });
      loadMembers();
    } catch (err) {
      toast({
        title: "Failed to invite",
        description: err instanceof Error ? err.message : "Could not send invitation",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const set = (field: keyof typeof EMPTY_INVITE) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <RequireRole allowedRoles={["VENDOR_ADMIN", "SUPER_ADMIN"]}>
      <DashboardLayout>
        <div className="p-6 max-w-3xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">My Company</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage your team and company profile</p>
            </div>
            <Button size="sm" className="text-xs h-8" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Invite member
            </Button>
          </div>

          {/* Company card */}
          <div className="border border-gray-200 rounded bg-white px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {tenantName || "—"}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                Domain: <span className="font-medium text-gray-600">{tenantDomain || "—"}</span>
              </p>
            </div>
          </div>

          {/* Team members */}
          <div className="border border-gray-200 rounded bg-white">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">Team members</p>
              {!loading && (
                <span className="text-[10px] text-gray-400">{members.length} member{members.length !== 1 ? "s" : ""}</span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : members.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-gray-500">No team members yet.</p>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Invite your first team member
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {members.map((m: any) => {
                  const role = m.roleName || m.role;
                  const initials = (m.fullName || m.email || "?")
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();
                  return (
                    <div key={m.userId} className="flex items-center gap-3 px-5 py-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 truncate">{m.fullName || "—"}</p>
                        <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[role] || "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[role] || role}
                      </span>
                      {m.accountLocked && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                          Locked
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Invite dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">Invite team member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="inv-name" className="text-xs">Full name</Label>
                <Input id="inv-name" value={form.fullName} onChange={set("fullName")} required className="h-8 text-xs" placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-email" className="text-xs">Work email</Label>
                <Input id="inv-email" type="email" value={form.email} onChange={set("email")} required className="h-8 text-xs" placeholder="jane@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-role" className="text-xs">Role</Label>
                <Select value={form.roleName} onValueChange={(v) => setForm((p) => ({ ...p, roleName: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VENDOR_SALES">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 text-amber-500" />
                        <div>
                          <p className="text-xs font-medium">Sales Representative</p>
                          <p className="text-[10px] text-gray-400">View RFQs, submit bids</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="VENDOR_FINANCE">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-yellow-500" />
                        <div>
                          <p className="text-xs font-medium">Finance / Invoicing</p>
                          <p className="text-[10px] text-gray-400">Submit invoices, record deliveries</p>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-phone" className="text-xs">Phone <span className="text-gray-400">(optional)</span></Label>
                <Input id="inv-phone" type="tel" value={form.phoneNumber} onChange={set("phoneNumber")} className="h-8 text-xs" placeholder="+1 234 567 890" />
              </div>
              <p className="text-[10px] text-gray-400">
                A temporary password will be emailed to the invitee. They will be prompted to change it on first login.
              </p>
              <DialogFooter className="pt-1">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={submitting}>
                  {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Send invite
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}
