"use client";

import * as React from "react";
import {
  ArrowUpDown, MoreHorizontal, Pencil, Trash2,
  ShieldCheck, ShieldOff, Eye,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
} from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { generateAvatarFallback } from "@/lib/utils";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type RcicUser = {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  locale: string | null;
  is_verified: boolean;
  rcic_number: string | null;
  is_license_verified: boolean;
  roles: string[];
  created_at: string;
};

function authHeaders(contentType = true) { return adminAuthHeaders(contentType ? "application/json" : undefined); }

export default function ImmigrationConsultPage() {
  const [users, setUsers] = React.useState<RcicUser[]>([]);
  const [total, setTotal] = React.useState(0);
  const [lastPage, setLastPage] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [sortField, setSortField] = React.useState<"name" | "email" | "created_at">("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const [viewUser, setViewUser] = React.useState<RcicUser | null>(null);
  const [editUser, setEditUser] = React.useState<RcicUser | null>(null);
  const [editForm, setEditForm] = React.useState({ name: "", email: "" });
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [deleteUser, setDeleteUser] = React.useState<RcicUser | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role: "rcic", per_page: "20", page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`${API}/admin/users?${params}`, { headers: authHeaders(false) });
      const json = await res.json();
      setUsers(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
      setLastPage(json.meta?.last_page ?? 1);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  React.useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const sorted = React.useMemo(() => {
    return [...users].sort((a, b) => {
      const va = a[sortField] ?? "";
      const vb = b[sortField] ?? "";
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [users, sortField, sortDir]);

  const toggleSort = (field: "name" | "email" | "created_at") => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const openEdit = (u: RcicUser) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email });
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`${API}/admin/users/${editUser.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ ...editForm, role: "rcic" }),
      });
      if (!res.ok) {
        const err = await res.json();
        const msg = err?.errors ? Object.values(err.errors).flat().join(", ") : err?.message ?? "Failed to update.";
        setEditError(msg);
        return;
      }
      setEditUser(null);
      fetchUsers();
    } catch {
      setEditError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u: RcicUser) => {
    await fetch(`${API}/admin/users/${u.id}/toggle`, { method: "PATCH", headers: authHeaders(false) });
    fetchUsers();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    await fetch(`${API}/admin/users/${deleteUser.id}`, { method: "DELETE", headers: authHeaders(false) });
    setDeleting(false);
    setDeleteUser(null);
    fetchUsers();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RCIC Consultant Accounts</h1>
          <p className="text-muted-foreground text-sm">
            All registered RCIC consultant accounts with email and licence verification status
            {!loading && <span className="ml-2 text-xs">({total} total)</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3" onClick={() => toggleSort("name")}>
                  Name <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3" onClick={() => toggleSort("email")}>
                  Email <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead>RCIC Number</TableHead>
              <TableHead>Email Verified</TableHead>
              <TableHead>Licence Verified</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3" onClick={() => toggleSort("created_at")}>
                  Registered <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No RCIC consultant accounts found.</TableCell>
              </TableRow>
            ) : (
              sorted.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {u.avatar && <AvatarImage src={u.avatar} alt={u.name} />}
                        <AvatarFallback>{generateAvatarFallback(u.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-none">{u.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">ID #{u.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{u.email}</span>
                  </TableCell>
                  <TableCell>
                    {u.rcic_number
                      ? <span className="font-mono text-sm">{u.rcic_number}</span>
                      : <span className="text-xs text-muted-foreground">Not submitted</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_verified ? "success" : "destructive"}>
                      {u.is_verified ? "Verified" : "Unverified"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!u.rcic_number ? (
                      <Badge variant="secondary">No RCIC</Badge>
                    ) : u.is_license_verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-400">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewUser(u)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(u)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggle(u)}>
                          {u.is_verified
                            ? <><ShieldOff className="mr-2 h-4 w-4" /> Deactivate Email</>
                            : <><ShieldCheck className="mr-2 h-4 w-4" /> Activate Email</>
                          }
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteUser(u)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {lastPage} &bull; {total} consultants</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1}><ChevronFirst className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page === lastPage}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setPage(lastPage)} disabled={page === lastPage}><ChevronLast className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* View Detail Dialog */}
      <Dialog open={!!viewUser} onOpenChange={(o) => { if (!o) setViewUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Consultant Details</DialogTitle></DialogHeader>
          {viewUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  {viewUser.avatar && <AvatarImage src={viewUser.avatar} alt={viewUser.name} />}
                  <AvatarFallback className="text-lg">{generateAvatarFallback(viewUser.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold">{viewUser.name}</p>
                  <p className="text-sm text-muted-foreground">{viewUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">User ID</p>
                  <p className="font-medium">#{viewUser.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Locale</p>
                  <p className="font-medium">{viewUser.locale ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RCIC Number</p>
                  <p className="font-mono font-medium">{viewUser.rcic_number ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email Verified</p>
                  <Badge variant={viewUser.is_verified ? "success" : "destructive"} className="mt-0.5">
                    {viewUser.is_verified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Licence Verified</p>
                  <div className="mt-0.5">
                    {!viewUser.rcic_number ? (
                      <Badge variant="secondary">No RCIC</Badge>
                    ) : viewUser.is_license_verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-400">Pending</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="font-medium">
                    {new Date(viewUser.created_at).toLocaleString("en-CA", {
                      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Consultant</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {editError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{editError}</p>}
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email address" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Consultant</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{deleteUser?.name}</span>?
            <br />This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
