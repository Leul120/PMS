"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import Link from "next/link";
import { 
  ClipboardList, 
  Users, 
  ShoppingCart, 
  Gavel,
  TrendingUp,
  ArrowRight
} from "lucide-react";

export default function OfficerDashboardPage() {
  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER"]}>
      <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Procurement Officer Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage RFQs, vendors, and purchase orders
            </p>
          </div>
          <Button asChild>
            <Link href="/rfq">
              <ClipboardList className="mr-2 h-4 w-4" />
              Create RFQ
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active RFQs</CardTitle>
              <Gavel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Manage</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/rfq" className="text-primary hover:underline">View all RFQs →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vendors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Directory</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/vendors" className="text-primary hover:underline">Manage vendors →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Create</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/procurement" className="text-primary hover:underline">Create PO →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reports</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Analytics</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/analytics" className="text-primary hover:underline">View reports →</Link>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for procurement officers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/vendors">
                  <Users className="mr-2 h-4 w-4" />
                  Add New Vendor
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/rfq">
                  <Gavel className="mr-2 h-4 w-4" />
                  Create RFQ
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/procurement">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create Purchase Order
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/inventory">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Update Inventory
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent procurement activities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Loading recent activity...</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
    </RequireRole>
  );
}
