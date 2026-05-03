"use client";

import * as React from "react";
import {
  ArrowUpDown, MoreHorizontal, PlusCircle, Pencil, Trash2,
  ShieldCheck, ShieldOff, Eye, EyeOff,
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type Consultant = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  specialization: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type ConsultantForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  province: string;
  country: string;
  specialization: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: ConsultantForm = {
  name: "", email: "", phone: "", company: "",
  city: "", province: "", country: "",
  specialization: "", notes: "", is_active: true,
};

function authHeaders(json = true) {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_admin_token") : "";
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
    Accept: "application/json",
  };
}

export default function ImmigrationConsultPage() {
  // List
  const [data, setData] = React.useState<Consultant[]>([]);
  const [total, setTotal] = React.useState(0);
  const [lastPage, setLastPage] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [sortField, setSortField] = React.useState<keyof Consultant>("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  // View
  const [viewItem, setViewItem] = React.useState<Consultant | null>(null);

  // Create / Edit
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<Consultant | null>(null);
  const [form, setForm] = React.useState<ConsultantForm>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Delete
  const [deleteItem, setDeleteItem] = React.useState<Consultant | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Debounce
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "20", page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`${API}/admin/immigration-consultants?${params}`, {
        headers: authHeaders(false),
      });
      const json = await res.json();
      setData(json.data ?? []);
      setTotal(json.meta?.total ?? json.total ?? 0);
      setLastPage(json.meta?.last_page ?? json.last_page ?? 1);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Client-side sort
  const sorted = React.useMemo(() => {
    return [...data].sort((a, b) => {
      const va = String(a[sortField] ?? "");
      const vb = String(b[sortField] ?? "");
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [data, sortField, sortDir]);

  const toggleSort = (field: keyof Consultant) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (c: Consultant) => {
    setEditItem(c);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      city: c.city ?? "",
      province: c.province ?? "",
      country: c.country ?? "",
      specialization: c.specialization ?? "",
      notes: c.notes ?? "",
      is_active: c.is_active,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const url = editItem
        ? `${API}/admin/immigration-consultants/${editItem.id}`
        : `${API}/admin/immigration-consultants`;
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        const msg = err?.errors
          ? Object.values(err.errors).flat().join(", ")
          : err?.message ?? "Failed to save.";
        setFormError(msg);
        return;
      }
      setDialogOpen(false);
      fetchData();
    } catch {
      setFormError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: Consultant) => {
    await fetch(`${API}/admin/immigration-consultants/${c.id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ ...c, email: c.email ?? "", phone: c.phone ?? "", company: c.company ?? "", city: c.city ?? "", province: c.province ?? "", country: c.country ?? "", specialization: c.specialization ?? "", notes: c.notes ?? "", is_active: !c.is_active }),
    });
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    await fetch(`${API}/admin/immigration-consultants/${deleteItem.id}`, {
      method: "DELETE",
      headers: authHeaders(false),
    });
    setDeleting(false);
    setDeleteItem(null);
    fetchData();
  };

  const f = (field: keyof ConsultantForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Immigration Consultants</h1>
          <p className="text-muted-foreground text-sm">
            Manage immigration consultant records
            {!loading && <span className="ml-2 text-xs">({total} total)</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Consultant
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by name, email, company, or city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
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
              <TableHead>Phone</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead>City / Province</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No consultants found. Click <strong>Add Consultant</strong> to get started.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.company ?? "—"}</TableCell>
                  <TableCell>{c.specialization ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[c.city, c.province].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "success" : "destructive"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewItem(c)}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggle(c)}>
                          {c.is_active
                            ? <><ShieldOff className="mr-2 h-4 w-4" /> Deactivate</>
                            : <><ShieldCheck className="mr-2 h-4 w-4" /> Activate</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteItem(c)}
                        >
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

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page} of {lastPage} &bull; {total} records</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1}>
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page === lastPage}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(lastPage)} disabled={page === lastPage}>
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── View Dialog ── */}
      <Dialog open={!!viewItem} onOpenChange={(o) => { if (!o) setViewItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Consultant Details</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium">{viewItem.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={viewItem.is_active ? "success" : "destructive"}>{viewItem.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                <div><p className="text-xs text-muted-foreground">Email</p><p>{viewItem.email ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Phone</p><p>{viewItem.phone ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Company</p><p>{viewItem.company ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Specialization</p><p>{viewItem.specialization ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">City</p><p>{viewItem.city ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Province</p><p>{viewItem.province ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Country</p><p>{viewItem.country ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Added</p><p>{new Date(viewItem.created_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</p></div>
              </div>
              {viewItem.notes && (
                <div><p className="text-xs text-muted-foreground">Notes</p><p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">{viewItem.notes}</p></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Consultant" : "Add Immigration Consultant"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={f("name")} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={f("email")} placeholder="Email address" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={f("phone")} placeholder="+1 xxx-xxx-xxxx" />
              </div>
              <div className="space-y-1.5">
                <Label>Company / Firm</Label>
                <Input value={form.company} onChange={f("company")} placeholder="Company name" />
              </div>
              <div className="space-y-1.5">
                <Label>Specialization</Label>
                <Input value={form.specialization} onChange={f("specialization")} placeholder="e.g. Work Permit, PR, Study Permit" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={f("city")} placeholder="City" />
              </div>
              <div className="space-y-1.5">
                <Label>Province / State</Label>
                <Input value={form.province} onChange={f("province")} placeholder="Province" />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={form.country} onChange={f("country")} placeholder="Country" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.is_active ? "active" : "inactive"}
                  onValueChange={(v) => setForm((p) => ({ ...p, is_active: v === "active" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={f("notes")}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editItem ? "Save Changes" : "Create Consultant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteItem} onOpenChange={(o) => { if (!o) setDeleteItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Consultant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{deleteItem?.name}</span>?
            <br />This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
