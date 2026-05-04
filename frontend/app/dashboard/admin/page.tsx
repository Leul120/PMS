"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, UserRole } from "@/lib/auth-store";
import { RequireRole } from "@/components/require-role";
import { adminApi } from "@/lib/api";
import {
  Plus,
  Search,
  MoreHorizontal,
  Users,
  Shield,
  Lock,
  Unlock,
  Key,
  Trash2,
  Loader2,
  Crown,
  Briefcase,
  Eye,
  Truck
} from "lucide-react";

interface User {
  userId: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  roleName: UserRole;
  accountLocked: boolean;
  lastLogin?: string;
  registrationDate: string;
}

const ROLES: { value: UserRole; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "ADMIN", label: "Administrator", icon: <Crown className="h-4 w-4" />, color: "bg-red-100 text-red-800" },
  { value: "OFFICER", label: "Procurement Officer", icon: <Briefcase className="h-4 w-4" />, color: "bg-green-100 text-green-800" },
  { value: "MANAGER", label: "Manager", icon: <Shield className="h-4 w-4" />, color: "bg-blue-100 text-blue-800" },
  { value: "AUDITOR", label: "Auditor", icon: <Eye className="h-4 w-4" />, color: "bg-purple-100 text-purple-800" },
  { value: "VENDOR", label: "Vendor", icon: <Truck className="h-4 w-4" />, color: "bg-orange-100 text-orange-800" },
];

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const { toast } = useToast();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAllUsers();
      setUsers(data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAssignRole = async (userId: number, roleName: string, userName: string) => {
    try {
      setActionLoading(userId);
      await adminApi.assignRole(userId.toString(), roleName);
      toast({ title: "Success", description: `Changed ${userName}'s role to ${roleName}` });
      loadUsers();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to change role",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleLock = async (userId: number, isLocked: boolean, userName: string) => {
    try {
      setActionLoading(userId);
      if (isLocked) {
        await adminApi.unlockAccount(userId.toString());
        toast({ title: "Success", description: `Unlocked ${userName}'s account` });
      } else {
        await adminApi.lockAccount(userId.toString());
        toast({ title: "Success", description: `Locked ${userName}'s account` });
      }
      loadUsers();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update account",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId: number, userName: string) => {
    try {
      setActionLoading(userId);
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      await adminApi.resetPassword(userId.toString(), tempPassword);
      toast({
        title: "Password Reset",
        description: `Temporary password for ${userName}: ${tempPassword}`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reset password",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }
    try {
      setActionLoading(userId);
      await adminApi.deleteUser(userId.toString());
      toast({ title: "Success", description: `Deleted ${userName}` });
      loadUsers();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete user",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = users.filter(u => u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <RequireRole allowedRoles={["ADMIN"]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage users and assign roles</p>
            </div>
            <Button onClick={() => toast({ title: "Info", description: "Create user dialog - use Users page for now" })}><Plus className="mr-2 h-4 w-4" /> Create User</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {ROLES.map(r => (
              <Card key={r.value}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{r.label}</CardTitle>{r.icon}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{users.filter(u => u.roleName === r.value).length}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Users</CardTitle>
              <div className="flex items-center gap-2 pt-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => (
                      <TableRow key={u.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8"><AvatarFallback>{u.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}</AvatarFallback></Avatar>
                            <div><div className="font-medium">{u.fullName}</div><div className="text-sm text-muted-foreground">{u.email}</div></div>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={ROLES.find(r => r.value === u.roleName)?.color}>{ROLES.find(r => r.value === u.roleName)?.label || u.roleName}</Badge></TableCell>
                        <TableCell>{u.accountLocked ? <Badge variant="destructive"><Lock className="mr-1 h-3 w-3" /> Locked</Badge> : <Badge variant="default"><Unlock className="mr-1 h-3 w-3" /> Active</Badge>}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={actionLoading === u.userId}>
                                {actionLoading === u.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Manage User</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {ROLES.filter(r => r.value !== u.roleName).map(r => (
                                <DropdownMenuItem
                                  key={r.value}
                                  onClick={() => handleAssignRole(u.userId, r.value, u.fullName)}
                                  disabled={actionLoading === u.userId}
                                >
                                  <Shield className="mr-2 h-4 w-4" /> Make {r.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleLock(u.userId, u.accountLocked, u.fullName)}
                                disabled={actionLoading === u.userId}
                              >
                                {u.accountLocked ? <><Unlock className="mr-2 h-4 w-4" /> Unlock Account</> : <><Lock className="mr-2 h-4 w-4" /> Lock Account</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResetPassword(u.userId, u.fullName)}
                                disabled={actionLoading === u.userId}
                              >
                                <Key className="mr-2 h-4 w-4" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteUser(u.userId, u.fullName)}
                                disabled={actionLoading === u.userId}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
