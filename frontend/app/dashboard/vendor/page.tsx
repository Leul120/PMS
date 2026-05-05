"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import Link from "next/link";
import { 
  Truck, 
  Gavel, 
  Package,
  FileText,
  Building2
} from "lucide-react";

export default function VendorDashboardPage() {
  return (
    <RequireRole allowedRoles={["ADMIN", "VENDOR"]}>
      <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vendor Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Submit bids, track orders, and manage your profile
            </p>
          </div>
          <Button asChild>
            <Link href="/rfq">
              <Gavel className="mr-2 h-4 w-4" />
              Browse RFQs
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open RFQs</CardTitle>
              <Gavel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Browse</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/rfq" className="text-primary hover:underline">View open RFQs →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Bids</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Track</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/rfq" className="text-primary hover:underline">View bids →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">View</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/orders" className="text-primary hover:underline">Your orders →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Deliveries</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Track</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/deliveries" className="text-primary hover:underline">Shipments →</Link>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for vendors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/rfq">
                  <Gavel className="mr-2 h-4 w-4" />
                  Browse RFQs & Submit Bids
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/orders">
                  <Package className="mr-2 h-4 w-4" />
                  View Purchase Orders
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/deliveries">
                  <Truck className="mr-2 h-4 w-4" />
                  Update Deliveries
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/settings">
                  <Building2 className="mr-2 h-4 w-4" />
                  Update Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Bids</CardTitle>
            <CardDescription>Your submitted bids and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No active bids. <Link href="/rfq" className="text-primary hover:underline">Browse open RFQs</Link> to submit a bid.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
    </RequireRole>
  );
}
