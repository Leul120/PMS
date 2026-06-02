"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { settingsApi, authApi } from "@/lib/api";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { Loader2, Save, Bell, Shield, Building2, Users, CreditCard, Globe, TrendingUp, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const forcePwdChange = searchParams.get("changePassword") === "1";
  const [activeTab, setActiveTab] = useState(forcePwdChange ? "security" : "general");
  const changePwdRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canUpdateSettings = hasPermission("settings:update");
  const hasRole = useAuthStore((state) => state.hasRole);
  const isVendor = hasRole(["VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE"]);

  // Org settings
  const [orgName, setOrgName] = useState("");
  const [orgDomain, setOrgDomain] = useState("");
  const [orgPlan, setOrgPlan] = useState("");
  const [orgUserCount, setOrgUserCount] = useState(0);
  const [orgSaving, setOrgSaving] = useState(false);

  useEffect(() => {
    if (forcePwdChange) {
      setTimeout(() => changePwdRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, [forcePwdChange]);

  useEffect(() => {
    authApi.getMyTenant().then((t: any) => {
      setOrgName(t.name || "");
      setOrgDomain(t.domain || "");
      setOrgPlan(t.subscriptionPlan || "");
      setOrgUserCount(t.userCount || 0);
    }).catch(() => {});
  }, []);

  // General settings
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [language, setLanguage] = useState("English (US)");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [poApprovals, setPoApprovals] = useState(true);
  const [deliveryAlerts, setDeliveryAlerts] = useState(true);
  const [vendorUpdates, setVendorUpdates] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);

  // Security settings
  const [twoFactor, setTwoFactor] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [passwordExpiry, setPasswordExpiry] = useState("90");
  const [loginNotifications, setLoginNotifications] = useState(true);

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    setOrgSaving(true);
    try {
      await authApi.updateMyTenant(orgName);
      toast({ title: "Organisation name updated" });
    } catch (err) {
      toast({ title: "Failed to update", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setOrgSaving(false);
    }
  }

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({ title: "Failed to change password", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  }

  // Scoring weights (Admin only)
  const [weightTimeliness, setWeightTimeliness] = useState("35");
  const [weightQuality, setWeightQuality] = useState("35");
  const [weightCost, setWeightCost] = useState("20");
  const [weightResponsiveness, setWeightResponsiveness] = useState("10");
  const [savingWeights, setSavingWeights] = useState(false);

  const totalWeight = (
    (parseFloat(weightTimeliness) || 0) +
    (parseFloat(weightQuality) || 0) +
    (parseFloat(weightCost) || 0) +
    (parseFloat(weightResponsiveness) || 0)
  );

  async function handleSaveWeights(e: React.FormEvent) {
    e.preventDefault();
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast({ title: "Invalid weights", description: "Weights must sum to exactly 100%.", variant: "destructive" });
      return;
    }
    setSavingWeights(true);
    try {
      await settingsApi.updateSettings({
        scoringWeights: {
          timeliness: parseFloat(weightTimeliness) / 100,
          quality: parseFloat(weightQuality) / 100,
          cost: parseFloat(weightCost) / 100,
          responsiveness: parseFloat(weightResponsiveness) / 100,
        },
      });
      toast({ title: "Weights saved", description: "Scoring weights have been updated." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save weights", variant: "destructive" });
    } finally {
      setSavingWeights(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await settingsApi.getSettings().catch(() => null) as any || {};
      const notifications = await settingsApi.getNotifications().catch(() => null) as any || {};
      const security = await settingsApi.getSecurity().catch(() => null) as any || {};

      if (settings) {
        setCompanyName(settings.companyName || "");
        setTaxId(settings.taxId || "");
        setCurrency(settings.currency || "USD");
        setTimezone(settings.timezone || "UTC");
        setAddress(settings.address || "");
        setCity(settings.city || "");
        setState(settings.state || "");
        setZip(settings.zip || "");
        setLanguage(settings.language || "English (US)");
        setDateFormat(settings.dateFormat || "MM/DD/YYYY");
      }
      if (notifications) {
        setEmailNotifications(notifications.email ?? true);
        setPoApprovals(notifications.poApprovals ?? true);
        setDeliveryAlerts(notifications.deliveryAlerts ?? true);
        setVendorUpdates(notifications.vendorUpdates ?? false);
        setLowStockAlerts(notifications.lowStockAlerts ?? true);
        setDailyDigest(notifications.dailyDigest ?? false);
      }
      if (security) {
        setTwoFactor(security.twoFactor ?? false);
        setPasswordPolicy(security.passwordPolicy ?? true);
        setSessionTimeout(String(security.sessionTimeout || 30));
        setPasswordExpiry(String(security.passwordExpiry || 90));
        setLoginNotifications(security.loginNotifications ?? true);
      }
    } catch (err) {
      // Silently handle errors - use default values
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Promise.all([
        settingsApi.updateSettings({ companyName, taxId, currency, timezone, address, city, state, zip, language, dateFormat }),
        settingsApi.updateNotifications({ email: emailNotifications, poApprovals, deliveryAlerts, vendorUpdates, lowStockAlerts, dailyDigest }),
        settingsApi.updateSecurity({ twoFactor, passwordPolicy, sessionTimeout: parseInt(sessionTimeout), passwordExpiry: parseInt(passwordExpiry), loginNotifications }),
      ]);
      toast({ title: "Success", description: "Settings saved successfully" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "DIRECTOR", "AUDITOR", "VENDOR_ADMIN", "VENDOR_SALES", "VENDOR_FINANCE", "SUPER_ADMIN"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage system preferences</p>
          </div>
          {canUpdateSettings && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className={`grid w-full ${canUpdateSettings ? "grid-cols-7 lg:w-[700px]" : "grid-cols-6 lg:w-[600px]"}`}>
            {!isVendor && <TabsTrigger value="general">General</TabsTrigger>}
            {!isVendor && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="organisation">Organisation</TabsTrigger>
            {!isVendor && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
            {!isVendor && <TabsTrigger value="billing">Billing</TabsTrigger>}
            {canUpdateSettings && <TabsTrigger value="scoring">Scoring</TabsTrigger>}
          </TabsList>
          <TabsContent value="general" className="space-y-3">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Information
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="company" className="text-xs">Company Name</Label>
                    <Input id="company" value={companyName} onChange={e => setCompanyName(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tax" className="text-xs">Tax ID</Label>
                    <Input id="tax" value={taxId} onChange={e => setTaxId(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs">Address</Label>
                  <Input id="address" value={address} onChange={e => setAddress(e.target.value)} className="h-8 text-xs border-gray-200" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs">City</Label>
                    <Input id="city" value={city} onChange={e => setCity(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs">State</Label>
                    <Input id="state" value={state} onChange={e => setState(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="zip" className="text-xs">ZIP</Label>
                    <Input id="zip" value={zip} onChange={e => setZip(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                </div>
                {canUpdateSettings && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </Button>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Regional Settings
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="language" className="text-xs">Language</Label>
                    <Input id="language" value={language} onChange={e => setLanguage(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="timezone" className="text-xs">Timezone</Label>
                    <Input id="timezone" value={timezone} onChange={e => setTimezone(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="currency" className="text-xs">Currency</Label>
                    <Input id="currency" value={currency} onChange={e => setCurrency(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="date-format" className="text-xs">Date Format</Label>
                    <Input id="date-format" value={dateFormat} onChange={e => setDateFormat(e.target.value)} className="h-8 text-xs border-gray-200" />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-3">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notification Preferences
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Email Notifications</Label>
                    <p className="text-[11px] text-gray-500">Receive email updates about orders and approvals</p>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} className="scale-90" />
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Purchase Order Approvals</Label>
                    <p className="text-[11px] text-gray-500">Get notified when POs are approved/rejected</p>
                  </div>
                  <Switch checked={poApprovals} onCheckedChange={setPoApprovals} className="scale-90" />
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Delivery Alerts</Label>
                    <p className="text-[11px] text-gray-500">Get notified about delivery status changes</p>
                  </div>
                  <Switch checked={deliveryAlerts} onCheckedChange={setDeliveryAlerts} className="scale-90" />
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Low Stock Alerts</Label>
                    <p className="text-[11px] text-gray-500">Get notified when inventory is running low</p>
                  </div>
                  <Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} className="scale-90" />
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Daily Digest</Label>
                    <p className="text-[11px] text-gray-500">Receive daily summary of all activities</p>
                  </div>
                  <Switch checked={dailyDigest} onCheckedChange={setDailyDigest} className="scale-90" />
                </div>
                <Separator className="bg-gray-100" />
                <div className="space-y-2">
                  <Label className="text-xs">Notification Events</Label>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="po-approved" checked={poApprovals} onCheckedChange={(v) => setPoApprovals(!!v)} className="h-3.5 w-3.5" />
                      <Label htmlFor="po-approved" className="font-normal text-xs">Purchase Order Approved</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="delivery" checked={deliveryAlerts} onCheckedChange={(v) => setDeliveryAlerts(!!v)} className="h-3.5 w-3.5" />
                      <Label htmlFor="delivery" className="font-normal text-xs">Delivery Updates</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="rfq" checked={vendorUpdates} onCheckedChange={(v) => setVendorUpdates(!!v)} className="h-3.5 w-3.5" />
                      <Label htmlFor="rfq" className="font-normal text-xs">New RFQ Submissions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="vendor" checked={lowStockAlerts} onCheckedChange={(v) => setLowStockAlerts(!!v)} className="h-3.5 w-3.5" />
                      <Label htmlFor="vendor" className="font-normal text-xs">Low Stock Alerts</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-3">
            {forcePwdChange && (
              <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Your administrator requires you to change your password before you can use the system.</span>
              </div>
            )}
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security Settings
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Two-Factor Authentication</Label>
                    <p className="text-[11px] text-gray-500">Require 2FA for all admin users</p>
                  </div>
                  <Switch checked={twoFactor} onCheckedChange={setTwoFactor} className="scale-90" />
                </div>
                <Separator className="bg-gray-100" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Password Policy</Label>
                    <p className="text-[11px] text-gray-500">Enforce strong password requirements</p>
                  </div>
                  <Switch checked={passwordPolicy} onCheckedChange={setPasswordPolicy} className="scale-90" />
                </div>
                <Separator className="bg-gray-100" />
                <div className="space-y-1.5">
                  <Label htmlFor="session" className="text-xs">Session Timeout (minutes)</Label>
                  <Input id="session" type="number" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} className="h-8 text-xs border-gray-200 w-[120px]" />
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div ref={changePwdRef} className={`border rounded overflow-hidden ${forcePwdChange ? "border-amber-300 ring-2 ring-amber-200" : "border-gray-200"}`}>
              <div className="flex items-center px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Change Password
                </span>
              </div>
              <form onSubmit={handleChangePassword} className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPwd" className="text-xs">Current password</Label>
                  <Input
                    id="currentPwd"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="h-8 text-xs border-gray-200 max-w-xs"
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPwd" className="text-xs">New password</Label>
                  <Input
                    id="newPwd"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-8 text-xs border-gray-200 max-w-xs"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPwd" className="text-xs">Confirm new password</Label>
                  <Input
                    id="confirmPwd"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-8 text-xs border-gray-200 max-w-xs"
                    placeholder="Repeat new password"
                  />
                </div>
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}>
                  {changingPassword ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  Update Password
                </Button>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="organisation" className="space-y-3">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Organisation Details
                </span>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-gray-500">Domain</p><p className="font-medium mt-0.5 font-mono">{orgDomain}</p></div>
                  <div><p className="text-gray-500">Subscription</p><p className="font-medium mt-0.5">{orgPlan || "—"}</p></div>
                  <div><p className="text-gray-500">Total Users</p><p className="font-medium mt-0.5">{orgUserCount}</p></div>
                </div>
                <Separator className="bg-gray-100" />
                <form onSubmit={handleSaveOrg} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="orgName" className="text-xs">Organisation name</Label>
                    <Input
                      id="orgName"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="h-8 text-xs border-gray-200 max-w-xs"
                      placeholder="Your company name"
                      required
                    />
                    <p className="text-[10px] text-gray-400">Only the display name can be changed. Contact support to change your domain.</p>
                  </div>
                  <Button type="submit" size="sm" className="h-8 text-xs" disabled={orgSaving || !orgName.trim()}>
                    {orgSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                    Save Name
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-3">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700">System Integrations</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: "Email (SMTP)", status: "Configured", desc: "Outbound email for notifications and password resets", color: "bg-emerald-100 text-emerald-700" },
                  { name: "Apache Kafka", status: "Active", desc: "Event streaming for real-time notifications", color: "bg-emerald-100 text-emerald-700" },
                  { name: "Redis Cache", status: "Active", desc: "Distributed caching and session management", color: "bg-emerald-100 text-emerald-700" },
                  { name: "ERP System", status: "Not configured", desc: "Connect to your ERP for inventory sync", color: "bg-gray-100 text-gray-600" },
                  { name: "Payment Gateway", status: "Not configured", desc: "Enable automated invoice payments", color: "bg-gray-100 text-gray-600" },
                ].map(({ name, status, desc, color }) => (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-gray-900">{name}</p>
                      <p className="text-[11px] text-gray-500">{desc}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${color}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-3">
            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="flex items-center px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing Information
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="rounded-md bg-blue-50 border border-blue-100 p-3">
                  <p className="text-xs font-medium text-blue-800">Enterprise Plan</p>
                  <p className="text-[11px] text-blue-600 mt-0.5">Unlimited users · All features · Priority support</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-gray-500">Billing Cycle</p><p className="font-medium mt-0.5">Annual</p></div>
                  <div><p className="text-gray-500">Next Renewal</p><p className="font-medium mt-0.5">Contact admin</p></div>
                  <div><p className="text-gray-500">Payment Method</p><p className="font-medium mt-0.5">Invoice</p></div>
                  <div><p className="text-gray-500">Currency</p><p className="font-medium mt-0.5">{currency}</p></div>
                </div>
                <p className="text-[11px] text-gray-400">To update billing details, contact your account manager.</p>
              </div>
            </div>
          </TabsContent>

          {/* Scoring Weights — Admin only */}
          {canUpdateSettings && (
            <TabsContent value="scoring" className="space-y-3">
              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-700">Vendor Scoring Weights</span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Configure how each KPI contributes to the overall vendor score. Weights must sum to 100%.
                  </p>
                </div>
                <div className="p-4">
                  <form onSubmit={handleSaveWeights} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Timeliness (%)", value: weightTimeliness, setter: setWeightTimeliness, desc: "On-time delivery performance" },
                        { label: "Quality (%)", value: weightQuality, setter: setWeightQuality, desc: "Accepted quantity vs delivered" },
                        { label: "Cost Competitiveness (%)", value: weightCost, setter: setWeightCost, desc: "Bid price vs lowest bid" },
                        { label: "Responsiveness (%)", value: weightResponsiveness, setter: setWeightResponsiveness, desc: "On-time RFQ responses" },
                      ].map(({ label, value, setter, desc }) => (
                        <div key={label} className="space-y-1.5">
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={value}
                            onChange={(e) => setter(e.target.value)}
                            className="h-8 text-xs border-gray-200 w-[100px]"
                          />
                          <p className="text-[10px] text-gray-400">{desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className={`rounded-md p-3 text-xs flex items-center gap-2 ${
                      Math.abs(totalWeight - 100) < 0.01
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      <span className="font-medium">Total: {totalWeight.toFixed(0)}%</span>
                      {Math.abs(totalWeight - 100) < 0.01
                        ? " ✓ Valid"
                        : ` — must equal 100% (${totalWeight > 100 ? "reduce" : "increase"} by ${Math.abs(100 - totalWeight).toFixed(0)}%)`}
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={savingWeights || Math.abs(totalWeight - 100) > 0.01}
                    >
                      {savingWeights ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                      Save Weights
                    </Button>
                  </form>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
    </RequireRole>
  );
}
