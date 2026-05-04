"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { settingsApi } from "@/lib/api";
import { Loader2, Save, Bell, Shield, Building2, Users, CreditCard, Globe } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // General settings
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [poApprovals, setPoApprovals] = useState(true);
  const [deliveryAlerts, setDeliveryAlerts] = useState(true);
  const [vendorUpdates, setVendorUpdates] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);

  // Security settings
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [passwordExpiry, setPasswordExpiry] = useState("90");
  const [loginNotifications, setLoginNotifications] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await settingsApi.getSettings().catch(() => null);
      const notifications = await settingsApi.getNotifications().catch(() => null);
      const security = await settingsApi.getSecurity().catch(() => null);

      if (settings) {
        setCompanyName(settings.companyName || "");
        setTaxId(settings.taxId || "");
        setCurrency(settings.currency || "USD");
        setTimezone(settings.timezone || "UTC");
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
        setSessionTimeout(String(security.sessionTimeout || 30));
        setPasswordExpiry(String(security.passwordExpiry || 90));
        setLoginNotifications(security.loginNotifications ?? true);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Promise.all([
        settingsApi.updateSettings({ companyName, taxId, currency, timezone }),
        settingsApi.updateNotifications({ email: emailNotifications, poApprovals, deliveryAlerts, vendorUpdates, lowStockAlerts, dailyDigest }),
        settingsApi.updateSecurity({ twoFactor, sessionTimeout: parseInt(sessionTimeout), passwordExpiry: parseInt(passwordExpiry), loginNotifications }),
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
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage system preferences</p>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-3">
          <TabsList className="grid w-full grid-cols-5 lg:w-[500px] h-8 text-xs">
            <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">Notifications</TabsTrigger>
            <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
            <TabsTrigger value="integrations" className="text-xs">Integrations</TabsTrigger>
            <TabsTrigger value="billing" className="text-xs">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
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
                  <Input id="address" defaultValue="123 Business Ave, Suite 100" className="h-8 text-xs border-gray-200" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs">City</Label>
                    <Input id="city" defaultValue="New York" className="h-8 text-xs border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs">State</Label>
                    <Input id="state" defaultValue="NY" className="h-8 text-xs border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="zip" className="text-xs">ZIP</Label>
                    <Input id="zip" defaultValue="10001" className="h-8 text-xs border-gray-200" />
                  </div>
                </div>
                <Button size="sm" className="h-8 text-xs">
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Regional Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="language" className="text-xs">Language</Label>
                    <Input id="language" defaultValue="English (US)" className="h-8 text-xs border-gray-200" />
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
                    <Input id="date-format" defaultValue="MM/DD/YYYY" className="h-8 text-xs border-gray-200" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
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
                      <Checkbox id="po-approved" defaultChecked className="h-3.5 w-3.5" />
                      <Label htmlFor="po-approved" className="font-normal text-xs">Purchase Order Approved</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="delivery" defaultChecked className="h-3.5 w-3.5" />
                      <Label htmlFor="delivery" className="font-normal text-xs">Delivery Updates</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="rfq" className="h-3.5 w-3.5" />
                      <Label htmlFor="rfq" className="font-normal text-xs">New RFQ Submissions</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="vendor" defaultChecked className="h-3.5 w-3.5" />
                      <Label htmlFor="vendor" className="font-normal text-xs">Vendor Updates</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
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
                  <Switch defaultChecked className="scale-90" />
                </div>
                <Separator className="bg-gray-100" />
                <div className="space-y-1.5">
                  <Label htmlFor="session" className="text-xs">Session Timeout (minutes)</Label>
                  <Input id="session" type="number" defaultValue="30" className="h-8 text-xs border-gray-200 w-[120px]" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700">System Integrations</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500">No integrations configured yet.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-3">
            <Card className="border-0 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-gray-100">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-xs text-gray-500">Billing information will be available here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
