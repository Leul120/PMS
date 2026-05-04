"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requisitionApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { RequisitionDialog } from "./requisition-dialog";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle,
  Search,
  Plus
} from "lucide-react";

interface Requisition {
  requisitionId: string;
  requisitionNumber: string;
  department: string;
  justification: string;
  estimatedBudget: number;
  status: string;
  currentApprovalLevel: number;
  createdAt: string;
}

export default function RequisitionsPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  async function loadRequisitions() {
    try {
      setLoading(true);
      const data = await requisitionApi.getAll();
      setRequisitions(data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load requisitions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequisitions();
  }, []);

  async function handleApprove(requisitionId: string) {
    try {
      await requisitionApi.approve(requisitionId, { decision: "APPROVED", comments: "Approved" });
      toast({ title: "Success", description: "Requisition approved successfully" });
      loadRequisitions();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to approve requisition",
        variant: "destructive",
      });
    }
  }

  async function handleReject(requisitionId: string) {
    try {
      await requisitionApi.approve(requisitionId, { decision: "REJECTED", comments: "Rejected" });
      toast({ title: "Success", description: "Requisition rejected" });
      loadRequisitions();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reject requisition",
        variant: "destructive",
      });
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'success';
      case 'PENDING_APPROVAL': return 'warning';
      case 'REJECTED': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Purchase Requisitions</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage requisitions</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Requisition
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-semibold text-gray-700 mt-1">{requisitions.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <p className="text-xs text-amber-600">Pending</p>
              <p className="text-xl font-semibold text-amber-700 mt-1">
                {requisitions.filter(r => r.status === 'PENDING_APPROVAL').length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Approved</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">
                {requisitions.filter(r => r.status === 'APPROVED').length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3">
              <p className="text-xs text-red-600">Rejected</p>
              <p className="text-xl font-semibold text-red-700 mt-1">
                {requisitions.filter(r => r.status === 'REJECTED').length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-700">Requisitions</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input type="search" placeholder="Search requisitions..." className="pl-8 w-[200px] h-8 text-xs border-gray-200" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Req. Number</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Department</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Budget</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Level</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Created</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.map((req) => (
                  <TableRow key={req.requisitionId}>
                    <TableCell className="font-medium">{req.requisitionNumber}</TableCell>
                    <TableCell>{req.department}</TableCell>
                    <TableCell>${req.estimatedBudget?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(req.status)}>
                        {req.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>Level {req.currentApprovalLevel}</TableCell>
                    <TableCell>{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {req.status === 'PENDING_APPROVAL' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApprove(req.requisitionId)}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(req.requisitionId)}>Reject</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <RequisitionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={loadRequisitions} />
    </DashboardLayout>
  );
}
