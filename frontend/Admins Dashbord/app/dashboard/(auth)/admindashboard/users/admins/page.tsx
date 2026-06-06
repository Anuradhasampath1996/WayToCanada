"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, PlusCircle, Pencil, Trash2, ShieldCheck, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { generateAvatarFallback } from "@/lib/utils";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  is_verified: boolean;
  roles: string[];
  created_at: string;
};

type FormData = {
  name: string;
  email: string;
  password: string;
  role: string;
};

function authHeaders() { return adminAuthHeaders("application/json"); }

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<AdminUser | null>(null);
  const [form, setForm] = React.useState<FormData>({ name: "", email: "", password: "", role: "admin" });
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Delete confirm
  const [deleteUser, setDeleteUser] = React.useState<AdminUser | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users?per_page=100`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      const adminRoles = ["super-admin", "admin"];
      const filtered = (json.data ?? []).filter((u: AdminUser) =>
        u.roles.some((r) => adminRoles.includes(r))
      );
      setUsers(filtered);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: "", email: "", password: "", role: "admin" });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: "", role: user.roles[0] ?? "admin" });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      if (editUser) {
        // Full update: name, email, password (optional), role
        const res = await fetch(`${API}/admin/users/${editUser.id}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            ...(form.password ? { password: form.password } : {}),
            role: form.role,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          const msg = err?.errors
            ? Object.values(err.errors).flat().join(", ")
            : err?.message ?? "Failed to update user.";
          setFormError(msg);
          setSaving(false);
          return;
        }
      } else {
        // Create new admin
        const res = await fetch(`${API}/admin/users`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          const msg = err?.errors
            ? Object.values(err.errors).flat().join(", ")
            : err?.message ?? "Failed to create user.";
          setFormError(msg);
          setSaving(false);
          return;
        }
      }
      setDialogOpen(false);
      fetchUsers();
    } catch {
      setFormError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (user: AdminUser) => {
    await fetch(`${API}/admin/users/${user.id}/toggle`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    await fetch(`${API}/admin/users/${deleteUser.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    setDeleting(false);
    setDeleteUser(null);
    fetchUsers();
  };

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button className="-ml-3" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Name <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            {row.original.avatar && <AvatarImage src={row.original.avatar} alt={row.original.name} />}
            <AvatarFallback>{generateAvatarFallback(row.original.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button className="-ml-3" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Email <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
    },
    {
      accessorKey: "roles",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.roles[0] ?? "—"}
        </Badge>
      ),
    },
    {
      accessorKey: "is_verified",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_verified ? "success" : "destructive"}>
          {row.original.is_verified ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(user)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggle(user)}>
                {user.is_verified
                  ? <><ShieldOff className="mr-2 h-4 w-4" /> Deactivate</>
                  : <><ShieldCheck className="mr-2 h-4 w-4" /> Activate</>}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteUser(user)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: users,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, columnFilters },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
          <p className="text-muted-foreground text-sm">Manage administrator accounts</p>
        </div>
        <Button onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Admin
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by name or email..."
        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
        onChange={(e) => table.getColumn("name")?.setFilterValue(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-10 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-10 text-muted-foreground">
                  No admin users found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {table.getFilteredRowModel().rows.length} admin(s) total
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit Admin" : "Add New Admin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}
            {!editUser && (
              <>
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="admin@waytocanada.ca"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 8 characters"
                  />
                </div>
              </>
            )}
            {editUser && (
              <>
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="admin@waytocanada.ca"
                  />
                </div>
                <div className="space-y-1">
                  <Label>New Password <span className="text-muted-foreground text-xs">(leave blank to keep current)</span></Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Leave blank to keep unchanged"
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super-admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="rcic">RCIC</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Admin</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteUser?.name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
