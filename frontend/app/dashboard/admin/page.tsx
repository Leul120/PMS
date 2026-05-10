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
import { useRouter } from "next/navigation";

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
  // Reset password dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTempPassword, setResetTempPassword] = useState("");
  const [resetUserName, setResetUserName] = useState("");
  // Delete confirm dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const hasRole = useAuthStore((state) => state.hasRole);

  const loadUsers = async () => {
    if (!hasRole(["ADMIN"])) return;
    try {
      setLoading(true);
      const data = await adminApi.getAllUsers();
      // Normalise: backend enriched UserResponse now includes active and accountLocked
      const normalised = (data as any[]).map((u: any) => ({
        ...u,
        accountLocked: u.accountLocked ?? !u.active,
      }));
      setUsers(normalised);
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
  }, [hasRole]);

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
      // Generate a temporary password and send to backend â€â€ do NOT display in toast
      const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(10)))
        .map(b => b.toString(36))
        .join('')
        .slice(0, 10);
      await adminApi.resetPassword(userId.toString(), tempPassword);
      // Show in a dialog so admin can copy it securely (not in a dismissible toast)
      setResetTempPassword(tempPassword);
      setResetUserName(userName);
      setResetDialogOpen(true);
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
    setUserToDelete(users.find(u => u.userId === userId) || null);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setActionLoading(userToDelete.userId);
      await adminApi.deleteUser(userToDelete.userId.toString());
      toast({ title: "Success", description: `Deleted ${userToDelete.fullName}` });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
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
            <Button onClick={() => router.push('/users')}><Plus className="mr-2 h-4 w-4" /> Create User</Button>
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

        {/* Reset Password Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Password Reset</DialogTitle>
              <DialogDescription>
                Temporary password for <strong>{resetUserName}</strong>. Share this securely â€â€ it will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <code className="flex-1 text-sm font-mono select-all">{resetTempPassword}</code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(resetTempPassword);
                    toast({ title: "Copied", description: "Password copied to clipboard" });
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500">The user must change this password on next login.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setResetDialogOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{userToDelete?.fullName}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={actionLoading === userToDelete?.userId}
                onClick={confirmDeleteUser}
              >
                {actionLoading === userToDelete?.userId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </RequireRole>
  );
}