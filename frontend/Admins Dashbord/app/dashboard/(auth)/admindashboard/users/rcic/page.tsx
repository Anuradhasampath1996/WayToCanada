"use client";

import * as React from "react";
import {
  Upload, Download, Search, ExternalLink, ChevronLeft, ChevronRight,
  X, Filter, Trash2, MoreHorizontal, Eye, Pencil, PlusCircle,
  RefreshCw, CloudDownload, Clock, CheckCircle2, AlertCircle, Square,
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
import { getAdminToken, adminAuthHeaders } from "@/lib/admin-auth";

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type SyncRun = {
  id: number;
  status: string;
  trigger: string;
  total_steps: number;
  completed_steps: number;
  progress_percent: number;
  current_step: string | null;
  stats: {
    updated?: number;
    created?: number;
    errors?: number;
    not_found?: number;
    skipped?: number;
  } | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
};

type SyncStatus = {
  total_records: number;
  entitled_count: number;
  last_scraped_at: string | null;
  scrape_error_count: number;
  is_running: boolean;
  latest_run: SyncRun | null;
  running_run: SyncRun | null;
  last_successful_run: SyncRun | null;
  auto_sync: {
    command: string;
    schedule: string;
    description: string;
  };
  config?: {
    delay_ms: number;
    look_ahead: number;
    enrich_via_search: boolean;
    profile_url: string;
  };
};

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

const EMPTY_ADD_FORM = {
  profile_id: "",
  college_id: "",
  full_name: "",
  first_name: "",
  last_name: "",
  type: "RCIC",
  status: "Active",
  company: "",
  address_line_1: "",
  city: "",
  province: "",
  country: "Canada",
  postal_code: "",
  phone: "",
  email: "",
  website: "",
  languages: "",
  entitled_to_practise: true,
};

type PaginatedResponse = {
  data: Rcic[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
};

function authBearer() { return adminAuthHeaders(); }

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

  const [addOpen, setAddOpen] = React.useState(false);
  const [addForm, setAddForm] = React.useState({ ...EMPTY_ADD_FORM });
  const [addError, setAddError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null);
  const [syncLoading, setSyncLoading] = React.useState(false);
  const [syncStarting, setSyncStarting] = React.useState(false);
  const [syncStopping, setSyncStopping] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState<{ text: string; ok: boolean } | null>(null);

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

  const fetchSyncStatus = React.useCallback(async () => {
    setSyncLoading(true);
    try {
      const res = await fetch(`${API}/admin/rcic-consultants/sync-status`, {
        headers: authBearer(),
      });
      const json = await res.json();
      if (res.ok) setSyncStatus(json);
    } catch {
      /* ignore — list still usable */
    } finally {
      setSyncLoading(false);
    }
  }, []);

  React.useEffect(() => { void fetchSyncStatus(); }, [fetchSyncStatus]);

  React.useEffect(() => {
    if (!syncStatus?.is_running) return;
    const t = setInterval(() => { void fetchSyncStatus(); }, 4000);
    return () => clearInterval(t);
  }, [syncStatus?.is_running, fetchSyncStatus]);

  const handleSyncNow = async () => {
    setSyncStarting(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${API}/admin/rcic-consultants/sync`, {
        method: "POST",
        headers: authBearer(),
      });
      const json = await res.json();
      setSyncMsg({
        text: json.message ?? (res.ok || res.status === 202 ? "Sync started." : "Sync failed."),
        ok: res.ok || res.status === 202,
      });
      if (json.status) setSyncStatus(json.status);
      else await fetchSyncStatus();
    } catch {
      setSyncMsg({ text: "Network error starting sync.", ok: false });
    } finally {
      setSyncStarting(false);
    }
  };

  const handleStopSync = async () => {
    setSyncStopping(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${API}/admin/rcic-consultants/sync-stop`, {
        method: "POST",
        headers: authBearer(),
      });
      const json = await res.json();
      setSyncMsg({
        text: json.message ?? (res.ok ? "Stop requested." : "Failed to stop sync."),
        ok: res.ok,
      });
      if (json.status) setSyncStatus(json.status);
      else await fetchSyncStatus();
    } catch {
      setSyncMsg({ text: "Network error stopping sync.", ok: false });
    } finally {
      setSyncStopping(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setImportMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = getAdminToken();
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
      const token = getAdminToken();
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
      const token = getAdminToken();
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
      const token = getAdminToken();
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
      const token = getAdminToken();
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

  const handleCreate = async () => {
    setAddError(null);
    setSaving(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API}/admin/rcic-consultants`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          profile_id: Number(addForm.profile_id),
          entitled_to_practise: addForm.entitled_to_practise,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.errors ? Object.values(json.errors).flat().join(", ") : json?.message ?? "Failed to create.";
        setAddError(String(msg));
      } else {
        setAddOpen(false);
        setAddForm({ ...EMPTY_ADD_FORM });
        fetchData();
      }
    } catch {
      setAddError("Network error.");
    } finally {
      setSaving(false);
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
        <div className="flex flex-wrap gap-2">
          {syncStatus?.is_running ? (
            <Button
              variant="destructive"
              onClick={() => void handleStopSync()}
              disabled={syncStopping}
            >
              <Square className={`mr-2 h-4 w-4 ${syncStopping ? "animate-pulse" : ""}`} />
              {syncStopping ? "Stopping…" : "Stop Sync"}
            </Button>
          ) : (
            <Button
              onClick={handleSyncNow}
              disabled={syncStarting}
            >
              <CloudDownload className={`mr-2 h-4 w-4 ${syncStarting ? "animate-pulse" : ""}`} />
              {syncStarting ? "Starting…" : "Sync Now"}
            </Button>
          )}
          <Button variant="outline" onClick={() => void fetchSyncStatus()} disabled={syncLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncLoading ? "animate-spin" : ""}`} />
            Refresh status
          </Button>
          <Button onClick={() => { setAddForm({ ...EMPTY_ADD_FORM }); setAddError(null); setAddOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New RCIC Consultant
          </Button>
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

      <div className="rounded-xl border bg-blue-50/50 border-blue-200 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm text-blue-900">CICC register auto-sync</p>
            <p className="text-xs text-blue-800 mt-1">
              {syncStatus?.auto_sync.description
                ?? "Scrapes the CICC public register and upserts consultant records by profile ID."}
            </p>
          </div>
          {syncStatus?.is_running ? (
            <Badge variant="warning">Running</Badge>
          ) : syncStatus?.latest_run?.status === "failed" ? (
            <Badge variant="destructive">Last run failed</Badge>
          ) : syncStatus?.last_successful_run ? (
            <Badge variant="success">Up to date</Badge>
          ) : (
            <Badge variant="outline">No sync yet</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-blue-800">
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-1">
            <Clock className="h-3 w-3" />
            {syncStatus?.auto_sync.schedule ?? "Weekly on Sunday at 2:00 AM (America/Toronto)"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-1">
            Command: <code className="font-mono">{syncStatus?.auto_sync.command ?? "rcic:sync-register"}</code>
          </span>
          {syncStatus?.last_scraped_at && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-1">
              Last scraped: {new Date(syncStatus.last_scraped_at).toLocaleString()}
            </span>
          )}
          {typeof syncStatus?.scrape_error_count === "number" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-1">
              Scrape errors: {syncStatus.scrape_error_count.toLocaleString()}
            </span>
          )}
        </div>
        {(syncStatus?.running_run || syncStatus?.latest_run) && (
          <div className="space-y-1.5 text-xs text-blue-900">
            <p>
              {(syncStatus.running_run ?? syncStatus.latest_run)?.current_step
                ?? "Waiting…"}
            </p>
            {syncStatus.is_running && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width: `${Math.min(100, syncStatus.running_run?.progress_percent ?? 0)}%`,
                  }}
                />
              </div>
            )}
            {(syncStatus.running_run ?? syncStatus.latest_run)?.stats && (
              <p className="text-blue-800">
                Created {(syncStatus.running_run ?? syncStatus.latest_run)?.stats?.created ?? 0}
                {" · "}Updated {(syncStatus.running_run ?? syncStatus.latest_run)?.stats?.updated ?? 0}
                {" · "}Errors {(syncStatus.running_run ?? syncStatus.latest_run)?.stats?.errors ?? 0}
                {" · "}Not found {(syncStatus.running_run ?? syncStatus.latest_run)?.stats?.not_found ?? 0}
              </p>
            )}
            {(syncStatus.running_run ?? syncStatus.latest_run)?.error_message && (
              <p className="text-red-700">
                {(syncStatus.running_run ?? syncStatus.latest_run)?.error_message}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-blue-700">
          Full sync controls live under{" "}
          <a href="/admindashboard/cicc-register-sync" className="underline font-medium">
            Platform → CICC Register Sync
          </a>
          . Requires server cron (<code className="font-mono">schedule:run</code>) and a queue worker
          (<code className="font-mono">queue:work</code>). CSV Import remains available as a manual fallback.
        </p>
      </div>

      {syncMsg && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            syncMsg.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {syncMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{syncMsg.text}</span>
          <button type="button" className="ml-auto" onClick={() => setSyncMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

      {/* Add New RCIC Consultant Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => !open && setAddOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New RCIC Consultant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {addError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {addError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Profile ID <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  placeholder="e.g. 123456"
                  value={addForm.profile_id}
                  onChange={(e) => setAddForm({ ...addForm, profile_id: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>College ID (RCIC #)</Label>
                <Input
                  placeholder="e.g. R711248"
                  value={addForm.college_id}
                  onChange={(e) => setAddForm({ ...addForm, college_id: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Full Name</Label>
                <Input
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input value={addForm.first_name} onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input value={addForm.last_name} onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Input value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={addForm.status} onValueChange={(v) => setAddForm({ ...addForm, status: v })}>
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
                  value={addForm.entitled_to_practise ? "1" : "0"}
                  onValueChange={(v) => setAddForm({ ...addForm, entitled_to_practise: v === "1" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Yes</SelectItem>
                    <SelectItem value="0">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Company / Firm</Label>
                <Input value={addForm.company} onChange={(e) => setAddForm({ ...addForm, company: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Address</Label>
                <Input value={addForm.address_line_1} onChange={(e) => setAddForm({ ...addForm, address_line_1: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={addForm.city} onChange={(e) => setAddForm({ ...addForm, city: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Province</Label>
                <Input value={addForm.province} onChange={(e) => setAddForm({ ...addForm, province: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input value={addForm.country} onChange={(e) => setAddForm({ ...addForm, country: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Postal Code</Label>
                <Input value={addForm.postal_code} onChange={(e) => setAddForm({ ...addForm, postal_code: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Email</Label>
                <Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Website</Label>
                <Input type="url" placeholder="https://" value={addForm.website} onChange={(e) => setAddForm({ ...addForm, website: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Languages</Label>
                <Input placeholder="e.g. English, French" value={addForm.languages} onChange={(e) => setAddForm({ ...addForm, languages: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !addForm.profile_id}>
              {saving ? "Creating…" : "Create Consultant"}
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

