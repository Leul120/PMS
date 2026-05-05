"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { UserDialog } from "./user-dialog";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Users,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Loader2,
  AlertTriangle
} from "lucide-react";

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
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const data = await authApi.getAllUsers();
      const mappedUsers = data.map((user: any) => ({
        id: user.userId || user.id,
        firstName: user.fullName?.split(' ')[0] || user.firstName || '',
        lastName: user.fullName?.split(' ').slice(1).join(' ') || user.lastName || '',
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

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.firstName?.toLowerCase().includes(query) ||
            u.lastName?.toLowerCase().includes(query) ||
            u.email?.toLowerCase().includes(query) ||
            u.role?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  // Export users to CSV
  function handleExport() {
    const headers = ["First Name", "Last Name", "Email", "Role", "Status", "Created At"];
    const rows = filteredUsers.map(u => [
      u.firstName,
      u.lastName,
      u.email,
      u.role,
      u.active ? "Active" : "Inactive",
      u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ""
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Export Complete", description: `${filteredUsers.length} users exported to CSV` });
  }
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Users</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage system users</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleExport}>Export</Button>
            <Button size="sm" className="text-xs h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add User
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-3">
              <p className="text-xs text-gray-500">Total Users</p>
              <p className="text-xl font-semibold text-gray-700 mt-1">{users.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600">Active</p>
              <p className="text-xl font-semibold text-emerald-700 mt-1">{users.filter(u => u.active).length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <p className="text-xs text-amber-600">Admins</p>
              <p className="text-xl font-semibold text-amber-700 mt-1">{users.filter(u => u.role?.toUpperCase() === 'ADMIN').length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="p-3">
              <p className="text-xs text-red-600">Inactive</p>
              <p className="text-xl font-semibold text-red-700 mt-1">{users.filter(u => !u.active).length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-gray-100">
            <CardTitle className="text-sm font-medium text-gray-700">User Directory</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px] h-8 text-xs border-gray-200"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => loadUsers()}>
                <Loader2 className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
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
              </div>
            )}
            {!loading && !error && (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-gray-500 py-2">User</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Role</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Department</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Status</TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 py-2">Last Active</TableHead>
                  <TableHead className="text-right text-xs font-medium text-gray-500 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const fullName = `${user.firstName} ${user.lastName}`;
                  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{fullName}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{(user as any).department || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.active ? "success" : "secondary"}>
                          {user.active ? "active" : "inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{(user as any).lastActive || '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                            <DropdownMenuItem>Edit User</DropdownMenuItem>
                            <DropdownMenuItem>Manage Permissions</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.active ? (
                              <DropdownMenuItem className="text-destructive">
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem>Activate</DropdownMenuItem>
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
      
      <UserDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onSuccess={loadUsers} 
      />
    </DashboardLayout>
  );
}
