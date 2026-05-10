"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { authApi, adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { UserDialog } from "./user-dialog";
import { RequireRole } from "@/components/require-role";
import { useAuthStore } from "@/lib/auth-store";
import { Plus, Search, MoreHorizontal, Mail, Loader2, AlertTriangle } from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  // Deactivate confirm dialog
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState<User | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const { toast } = useToast();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const hasRole = useAuthStore((state) => state.hasRole);
  const canManageUsers = hasPermission("users:create") && hasPermission("users:update") && hasPermission("users:delete");

  useEffect(() => {
    if (!hasRole(["ADMIN", "OFFICER", "MANAGER", "AUDITOR"])) return;
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      // Only ADMIN can list all users â€â€ other roles get an empty list gracefully
      const data = await authApi.getAllUsers().catch((err) => {
        // 403 means the role can't list users â€â€ show empty state, not an error
        if (err?.message?.includes("permission") || err?.message?.includes("403")) {
          return [];
        }
        throw err;
      });
      const mappedUsers = data.map((user: any) => ({
        id: user.userId || user.id,
        firstName: user.fullName?.split(" ")[0] || user.firstName || "",
        lastName: user.fullName?.split(" ").slice(1).join(" ") || user.lastName || "",
        email: user.email,
        role: user.roleName || user.role,
        active: user.active !== false,
        createdAt: user.registrationDate || user.createdAt,
      }));
      setUsers(mappedUsers);
      setFilteredUsers(mappedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredUsers(users.filter(u =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      ));
    }
  }, [searchQuery, users]);

  function handleExport() {
    const headers = ["First Name", "Last Name", "Email", "Role", "Status", "Created At"];
    const rows = filteredUsers.map(u => [
      u.firstName, u.lastName, u.email, u.role,
      u.active ? "Active" : "Inactive",
      u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `users-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export Complete", description: `${filteredUsers.length} users exported` });
  }

  function openEditDialog(user: User) {
    setEditUser(user);
    setEditRole(user.role);
    setEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editUser) return;
    try {
      setEditSaving(true);
      await adminApi.assignRole(editUser.id, editRole);
      toast({ title: "Updated", description: `${editUser.firstName}'s role updated to ${editRole}` });
      setEditDialogOpen(false);
      loadUsers();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update user", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmToggleActive() {
    if (!userToToggle) return;
    try {
      setToggleLoading(true);
      if (userToToggle.active) {
        await adminApi.lockAccount(userToToggle.id);
        toast({ title: "Deactivated", description: `${userToToggle.firstName} has been deactivated` });
      } else {
        await adminApi.unlockAccount(userToToggle.id);
        toast({ title: "Activated", description: `${userToToggle.firstName} has been activated` });
      }
      setDeactivateDialogOpen(false);
      loadUsers();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update user", variant: "destructive" });
    } finally {
      setToggleLoading(false);
    }
  }

  return (
    <RequireRole allowedRoles={["ADMIN", "OFFICER", "MANAGER", "AUDITOR"]}>
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Users</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage system users</p>
          </div>
          <div className="flex gap-2">
            {canManageUsers && (
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}>Export</Button>
            )}
            {canManageUsers && (
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Add User
            </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Users", value: users.length, color: "bg-gray-50 text-gray-700" },
            { label: "Active", value: users.filter(u => u.active).length, color: "bg-emerald-50 text-emerald-700" },
            { label: "Admins", value: users.filter(u => u.role?.toUpperCase() === "ADMIN").length, color: "bg-amber-50 text-amber-700" },
            { label: "Inactive", value: users.filter(u => !u.active).length, color: "bg-red-50 text-red-700" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className={`p-3 ${color.split(" ")[0]}`}>
                <p className={`text-xs ${color.split(" ")[1]}`}>{label}</p>
                <p className={`text-xl font-semibold mt-1 ${color.split(" ")[1]}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-700">User Directory</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input type="search" placeholder="Search users..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px] h-8 text-xs border-gray-200" />
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={loadUsers}>
                <Loader2 className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading users...</span>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center py-8 text-red-500">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <span className="text-sm">{error}</span>
                <Button variant="outline" size="sm" className="ml-3 h-7 text-xs" onClick={loadUsers}>Retry</Button>
              </div>
            )}
            {!loading && !error && (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-100 hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-gray-500 py-2">User</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Role</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                    <TableHead className="text-xs font-medium text-gray-500 py-2">Joined</TableHead>
                    <TableHead className="text-right text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-xs">
                        {searchQuery ? "No users match your search." : "No users found."}
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.map((user) => {
                    const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
                    const initials = ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || "U";
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-medium">{fullName}</p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Mail className="h-3 w-3" />{user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{user.role}</TableCell>
                        <TableCell>
                          <Badge variant={user.active ? "success" : "secondary"} className="text-[10px]">
                            {user.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "â€â€"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {canManageUsers ? (
                                <>
                                  <DropdownMenuItem className="text-xs" onClick={() => openEditDialog(user)}>
                                    Edit Role
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className={`text-xs ${user.active ? "text-destructive" : ""}`}
                                    onClick={() => { setUserToToggle(user); setDeactivateDialogOpen(true); }}
                                  >
                                    {user.active ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem className="text-xs" disabled>
                                  View only
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={loadUsers} />

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {editUser?.firstName} {editUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="OFFICER">Procurement Officer</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="AUDITOR">Auditor</SelectItem>
                  <SelectItem value="VENDOR">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={editSaving} onClick={handleSaveEdit}>
              {editSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Activate Confirm Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{userToToggle?.active ? "Deactivate" : "Activate"} User</DialogTitle>
            <DialogDescription>
              {userToToggle?.active
                ? `This will lock ${userToToggle?.firstName}'s account. They won't be able to log in.`
                : `This will unlock ${userToToggle?.firstName}'s account and restore access.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeactivateDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              variant={userToToggle?.active ? "destructive" : "default"}
              disabled={toggleLoading}
              onClick={confirmToggleActive}
            >
              {toggleLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {userToToggle?.active ? "Deactivate" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
    </RequireRole>
  );
}

