"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/require-role";
import Link from "next/link";
import { 
  Eye, 
  FileText, 
  BarChart3,
  ClipboardCheck,
  AlertCircle
} from "lucide-react";

export default function AuditorDashboardPage() {
  return (
    <RequireRole allowedRoles={["ADMIN", "AUDITOR"]}>
      <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Auditor Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review transactions, audit logs, and compliance reports
            </p>
          </div>
          <Button asChild>
            <Link href="/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Reports
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">View</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/orders" className="text-primary hover:underline">All orders →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Audit Trail</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Review</div>
              <p className="text-xs text-muted-foreground">
                View transaction history
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reports</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Analytics</div>
              <p className="text-xs text-muted-foreground">
                <Link href="/analytics" className="text-primary hover:underline">View reports →</Link>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Compliance</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Status</div>
              <p className="text-xs text-muted-foreground">
                View compliance reports
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>Read-only access to all procurement data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/vendors">
                  <Eye className="mr-2 h-4 w-4" />
                  View Vendors
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/rfq">
                  <Eye className="mr-2 h-4 w-4" />
                  View RFQs
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/orders">
                  <Eye className="mr-2 h-4 w-4" />
                  View Orders
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/analytics">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest procurement activities</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View transaction history in the reports section.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
    </RequireRole>
  );
}
