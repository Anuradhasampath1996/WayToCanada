"use client";

import * as React from "react";
import {
  Upload, Download, Search, ExternalLink, ChevronLeft, ChevronRight,
  X, Filter, Trash2, MoreHorizontal, Eye, Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type Rcic = {
  id: number;
  profile_id: string;
  college_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  type: string | null;
  status: string | null;
  company: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  postal_code: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  languages: string | null;
  entitled_to_practise: boolean;
  profile_url: string | null;
  licence_history: string | null;
  suspension_revocation: string | null;
  employment: string | null;
  agents: string | null;
};

type EditForm = {
  full_name: string;
  college_id: string;
  type: string;
  status: string;
  company: string;
  city: string;
  province: string;
  country: string;
  phone: string;
  email: string;
  entitled_to_practise: boolean;
};

type PaginatedResponse = {
  data: Rcic[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
};

function authBearer() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_admin_token") : "";
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">—</Badge>;
  if (status === "Active")          return <Badge variant="success">{status}</Badge>;
  if (status === "Leave of Absence") return <Badge variant="warning">{status}</Badge>;
  if (status.toLowerCase().includes("suspend")) return <Badge variant="destructive">{status}</Badge>;
  if (status.toLowerCase().includes("inactive"))  return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function RcicUsersPage() {
  const [data, setData] = React.useState<Rcic[]>([]);
  const [total, setTotal] = React.useState(0);
  const [lastPage, setLastPage] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [entitledFilter, setEntitledFilter] = React.useState("all");

  const [importing, setImporting] = React.useState(false);
  const [importMsg, setImportMsg] = React.useState<{ text: string; ok: boolean } | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  const [detail, setDetail] = React.useState<Rcic | null>(null);
  const [editRcic, setEditRcic] = React.useState<Rcic | null>(null);
  const [editForm, setEditForm] = React.useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [deleteRcic, setDeleteRcic] = React.useState<Rcic | null>(null);
  const [deletingRcic, setDeletingRcic] = React.useState(false);

  const fileRef = React.useRef<HTMLInputElement>(null);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => { setPage(1); }, [statusFilter, entitledFilter]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "20", page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (entitledFilter !== "all") params.set("active", entitledFilter);

      const res = await fetch(`${API}/admin/rcic-consultants?${params}`, {
        headers: authBearer(),
      });
      const json: PaginatedResponse = await res.json();
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
      setLastPage(json.last_page ?? 1);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, entitledFilter]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setImportMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("wtc_admin_token");
      const res = await fetch(`${API}/admin/rcic-consultants/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: form,
      });
      const json = await res.json();
      setImportMsg({ text: json.message ?? (res.ok ? "Imported." : "Import failed."), ok: res.ok });
      if (res.ok) { setPage(1); fetchData(); }
    } catch {
      setImportMsg({ text: "Network error during import.", ok: false });
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const token = localStorage.getItem("wtc_admin_token");
      const res = await fetch(`${API}/admin/rcic-consultants/clear`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const json = await res.json();
      setImportMsg({ text: json.message ?? "Cleared.", ok: res.ok });
      if (res.ok) { setPage(1); fetchData(); }
    } catch {
      setImportMsg({ text: "Network error during clear.", ok: false });
    } finally {
      setClearing(false);
      setClearConfirmOpen(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("wtc_admin_token");
      const res = await fetch(`${API}/admin/rcic-consultants/export`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rcic_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const openEdit = (r: Rcic) => {
    setEditRcic(r);
    setEditForm({
      full_name: r.full_name ?? "",
      college_id: r.college_id ?? "",
      type: r.type ?? "",
      status: r.status ?? "",
      company: r.company ?? "",
      city: r.city ?? "",
      province: r.province ?? "",
      country: r.country ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      entitled_to_practise: r.entitled_to_practise,
    });
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editRcic || !editForm) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const token = localStorage.getItem("wtc_admin_token");
      const res = await fetch(`${API}/admin/rcic-consultants/${editRcic.profile_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.errors ? Object.values(json.errors).flat().join(", ") : json?.message ?? "Failed to save.";
        setEditError(String(msg));
      } else {
        setEditRcic(null);
        fetchData();
      }
    } catch {
      setEditError("Network error.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteOne = async () => {
    if (!deleteRcic) return;
    setDeletingRcic(true);
    try {
      const token = localStorage.getItem("wtc_admin_token");
      await fetch(`${API}/admin/rcic-consultants/${deleteRcic.profile_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      setDeleteRcic(null);
      fetchData();
    } finally {
      setDeletingRcic(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RCIC Consultants</h1>
          <p className="text-muted-foreground text-sm">
            CICC public register — {total.toLocaleString()} records
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importing…" : "Import CSV"}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          <Button variant="destructive" onClick={() => setClearConfirmOpen(true)} disabled={clearing || total === 0}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Import result */}
      {importMsg && (
        <div
          className={`flex items-center justify-between rounded-md border px-4 py-2 text-sm ${
            importMsg.ok
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          <span>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 w-64"
            placeholder="Search name, email, college ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Leave of Absence">Leave of Absence</SelectItem>
            <SelectItem value="Suspended">Suspended</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entitledFilter} onValueChange={setEntitledFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Entitled" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="1">Entitled to Practise</SelectItem>
            <SelectItem value="0">Not Entitled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Profile ID</TableHead>
              <TableHead className="w-24">College ID</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Entitled</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>City / Province</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setDetail(r)}
                >
                  <TableCell className="font-mono text-xs">{r.profile_id}</TableCell>
                  <TableCell className="font-mono text-xs">{r.college_id ?? "—"}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{r.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.type ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>
                    {r.entitled_to_practise
                      ? <Badge variant="success">Entitled</Badge>
                      : <Badge variant="outline">Not Entitled</Badge>}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm">{r.company ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {[r.city, r.province].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.email ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{r.phone ?? "—"}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetail(r)}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(r)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {r.profile_url && (
                          <DropdownMenuItem asChild>
                            <a href={r.profile_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" /> CICC Profile
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteRcic(r)}
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {lastPage} — {total.toLocaleString()} total records
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" /><ChevronLeft className="h-4 w-4 -ml-2" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm font-medium">{page}</span>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(lastPage)} disabled={page >= lastPage}>
            <ChevronRight className="h-4 w-4" /><ChevronRight className="h-4 w-4 -ml-2" />
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editRcic} onOpenChange={(open) => !open && setEditRcic(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit RCIC Record</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3 py-1">
              {editError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {editError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Full Name</Label>
                  <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>College ID</Label>
                  <Input value={editForm.college_id} onChange={(e) => setEditForm({ ...editForm, college_id: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Input value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Leave of Absence">Leave of Absence</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Entitled to Practise</Label>
                  <Select
                    value={editForm.entitled_to_practise ? "1" : "0"}
                    onValueChange={(v) => setEditForm({ ...editForm, entitled_to_practise: v === "1" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Yes</SelectItem>
                      <SelectItem value="0">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Company</Label>
                  <Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Province</Label>
                  <Input value={editForm.province} onChange={(e) => setEditForm({ ...editForm, province: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Country</Label>
                  <Input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRcic(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Single Confirm Dialog */}
      <Dialog open={!!deleteRcic} onOpenChange={(open) => !open && setDeleteRcic(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-semibold text-foreground">{deleteRcic?.full_name ?? `Profile ${deleteRcic?.profile_id}`}</span>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRcic(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteOne} disabled={deletingRcic}>
              {deletingRcic ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirm Dialog */}
      <Dialog open={clearConfirmOpen} onOpenChange={(open) => !open && setClearConfirmOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear All Records</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all <span className="font-semibold text-foreground">{total.toLocaleString()} RCIC records</span> from the database. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAll} disabled={clearing}>
              {clearing ? "Clearing…" : "Yes, Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.full_name ?? "RCIC Details"}</DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Profile ID"  value={detail.profile_id} />
                <DetailRow label="College ID"  value={detail.college_id} />
                <DetailRow label="Type"        value={detail.type} />
                <DetailRow label="Status"      value={<>{statusBadge(detail.status)}</>} />
                <DetailRow label="Entitled"    value={detail.entitled_to_practise ? <Badge variant="success">Yes</Badge> : <Badge variant="outline">No</Badge>} />
                <DetailRow label="Company"     value={detail.company} />
                <DetailRow label="Email"       value={detail.email} />
                <DetailRow label="Phone"       value={detail.phone} />
                <DetailRow label="City"        value={detail.city} />
                <DetailRow label="Province"    value={detail.province} />
                <DetailRow label="Country"     value={detail.country} />
              </div>

              {detail.licence_history && (
                <LongField label="Licence History" value={detail.licence_history} />
              )}
              {detail.suspension_revocation && (
                <LongField label="Suspension / Revocation" value={detail.suspension_revocation} />
              )}
              {detail.employment && (
                <LongField label="Employment" value={detail.employment} />
              )}
            </div>
          )}

          <DialogFooter>
            {detail?.profile_url && (
              <a href={detail.profile_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" /> CICC Profile
                </Button>
              </a>
            )}
            <Button onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <div className="mt-0.5">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function LongField({ label, value }: { label: string; value: string }) {
  const entries = value.split(" § ");
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
      <ul className="space-y-1 border rounded-md p-2 bg-muted/40">
        {entries.map((e, i) => (
          <li key={i} className="text-xs font-mono leading-relaxed">{e}</li>
        ))}
      </ul>
    </div>
  );
}

