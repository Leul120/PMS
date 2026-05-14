"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { authApi } from "@/lib/api";
import { RequireRole } from "@/components/require-role";
import { Eye, EyeOff, Save, Loader2, User, Mail, Phone, Shield } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  OFFICER: "Procurement Officer",
  MANAGER: "Manager",
  AUDITOR: "Auditor",
  VENDOR: "Vendor",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800",
  OFFICER: "bg-green-100 text-green-800",
  MANAGER: "bg-blue-100 text-blue-800",
  AUDITOR: "bg-purple-100 text-purple-800",
  VENDOR: "bg-orange-100 text-orange-800",
};

export default function ProfilePage() {
  const { user, setAuth, token } = useAuthStore();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const role = user?.role || user?.roleName || "VENDOR";
  const initials = ((firstName?.[0] || "") + (lastName?.[0] || "")).toUpperCase() || "U";

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const updated = await authApi.updateUser(user.userId || user.id, {
        fullName: `${firstName} ${lastName}`.trim(),
        phoneNumber: phone || undefined,
      });
      // Update local auth store with new name
      if (token) {
        setAuth(
          {
            ...user,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
          },
          token
        );
      }
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      // Use the update user endpoint with new password
      await authApi.updateUser(user?.userId || user?.id || "", {
        currentPassword,
        newPassword,
      });
      toast({ title: "Password changed", description: "Your password has been updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR", "VENDOR"]}>
      <DashboardLayout>
        <div className="space-y-4 max-w-2xl">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your account information and password</p>
          </div>

          {/* Profile Card */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                <User className="h-4 w-4" />
                Account Information
              </span>
            </div>
            <div className="p-4">
              {/* Avatar + role */}
              <div className="flex items-center gap-4 mb-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {firstName} {lastName}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[role] || "bg-gray-100 text-gray-700"}`}>
                    <Shield className="h-2.5 w-2.5" />
                    {ROLE_LABELS[role] || role}
                  </span>
                </div>
              </div>

              <Separator className="mb-4" />

              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-8 text-xs border-gray-200"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-8 text-xs border-gray-200"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      id="email"
                      value={user?.email || ""}
                      disabled
                      className="h-8 text-xs border-gray-200 pl-8 bg-gray-50 text-gray-500"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">Email cannot be changed. Contact an admin if needed.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Optional"
                      className="h-8 text-xs border-gray-200 pl-8"
                    />
                  </div>
                </div>

                <Button type="submit" size="sm" className="h-8 text-xs" disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                  Save Profile
                </Button>
              </form>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center px-4 py-3 border-b border-gray-100">
              <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Change Password
              </span>
            </div>
            <div className="p-4">
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="text-xs">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      required
                      className="h-8 text-xs border-gray-200 pr-10"
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent" onClick={() => setShowCurrent(!showCurrent)}>
                      {showCurrent ? <EyeOff className="h-3.5 w-3.5 text-gray-400" /> : <Eye className="h-3.5 w-3.5 text-gray-400" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      className="h-8 text-xs border-gray-200 pr-10"
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent" onClick={() => setShowNew(!showNew)}>
                      {showNew ? <EyeOff className="h-3.5 w-3.5 text-gray-400" /> : <Eye className="h-3.5 w-3.5 text-gray-400" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className={`h-8 text-xs border-gray-200 ${confirmPassword && newPassword !== confirmPassword ? "border-red-300" : ""}`}
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[10px] text-red-500">Passwords do not match</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={savingPassword || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                >
                  {savingPassword ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Shield className="mr-2 h-3.5 w-3.5" />}
                  Change Password
                </Button>
              </form>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
