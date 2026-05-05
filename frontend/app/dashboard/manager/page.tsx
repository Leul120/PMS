"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import Link from "next/link";
import { 
  Shield, 
  ShoppingCart, 
  TrendingUp,
  CheckCircle,
  BarChart3
} from "lucide-react";

export default function ManagerDashboardPage() {
  return (
    <RequireRole allowedRoles={["ADMIN", "MANAGER"]}>
      <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Approve purchase orders and view procurement reports
            </p>
          </div>
          <Button asChild>
            <Link href="/procurement">
              <CheckCircle className="mr-2 h-4 w-4" />
              Review POs
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Review</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/procurement" className="text-primary hover:underline">Approve POs →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">View All</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/orders" className="text-primary hover:underline">Order history →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Analytics</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Reports</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/analytics" className="text-primary hover:underline">View analytics →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Spend Analysis</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Track</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/analytics" className="text-primary hover:underline">View spend →</Link>
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for managers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/procurement">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Purchase Orders
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/vendors">
                  <Shield className="mr-2 h-4 w-4" />
                  Verify Vendors
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/analytics">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  View Reports
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/rfq">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Review RFQs
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>Purchase orders awaiting your approval</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No pending approvals. <Link href="/procurement" className="text-primary hover:underline">View all orders</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
    </RequireRole>
  );
}
