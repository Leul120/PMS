"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      // Generate a temporary password and send to backend — do NOT display in toast
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage user accounts and role assignments</p>
            </div>
            <Button size="sm" className="text-xs h-8" onClick={() => router.push('/users')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create User
            </Button>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-5 divide-x divide-gray-200 border border-gray-200 rounded">
            {ROLES.map(r => {
              const count = users.filter(u => u.roleName === r.value).length;
              return (
                <div key={r.value} className="px-4 py-3">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{r.label}</p>
                  {loading ? <div className="h-5 w-8 bg-gray-100 rounded animate-pulse mt-1" /> : <p className="text-xl font-semibold text-gray-900 mt-1">{count}</p>}
                </div>
              );
            })}
          </div>

          <div className="border border-gray-200 rounded overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">
                System Users
                {!loading && <span className="ml-2 text-[10px] font-normal text-gray-400">({filtered.length} shown)</span>}
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 w-[200px] h-8 text-xs border-gray-200"
                />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-500">No users found.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">User</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Role</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2">Status</TableHead>
                      <TableHead className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => (
                      <TableRow key={u.userId} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {u.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium text-gray-900">{u.fullName}</p>
                              <p className="text-[10px] text-gray-500">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${ROLES.find(r => r.value === u.roleName)?.color}`}>
                            {ROLES.find(r => r.value === u.roleName)?.label || u.roleName}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {u.accountLocked ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                              <Lock className="h-2.5 w-2.5" />Locked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                              <Unlock className="h-2.5 w-2.5" />Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={actionLoading === u.userId}>
                                {actionLoading === u.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuLabel className="text-xs">Manage User</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {ROLES.filter(r => r.value !== u.roleName).map(r => (
                                <DropdownMenuItem key={r.value} className="text-xs" onClick={() => handleAssignRole(u.userId, r.value, u.fullName)} disabled={actionLoading === u.userId}>
                                  <Shield className="mr-2 h-3.5 w-3.5" />Make {r.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs" onClick={() => handleToggleLock(u.userId, u.accountLocked, u.fullName)} disabled={actionLoading === u.userId}>
                                {u.accountLocked ? <><Unlock className="mr-2 h-3.5 w-3.5" />Unlock Account</> : <><Lock className="mr-2 h-3.5 w-3.5" />Lock Account</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-xs" onClick={() => handleResetPassword(u.userId, u.fullName)} disabled={actionLoading === u.userId}>
                                <Key className="mr-2 h-3.5 w-3.5" />Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-xs text-red-600" onClick={() => handleDeleteUser(u.userId, u.fullName)} disabled={actionLoading === u.userId}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" />Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        {/* Reset Password Dialog */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="sm:max-w-[400px] rounded">
            <DialogHeader>
              <DialogTitle>Password Reset</DialogTitle>
              <DialogDescription>
                Temporary password for <strong>{resetUserName}</strong>. Share this securely — it will not be shown again.
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
          <DialogContent className="sm:max-w-[400px] rounded">
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
