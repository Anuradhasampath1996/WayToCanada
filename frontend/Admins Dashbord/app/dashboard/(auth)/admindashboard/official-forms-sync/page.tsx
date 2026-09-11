"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  ExternalLink,
  FileStack,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type VersionInfo = {
  id: number;
  form_code: string;
  version_label: string;
  status: string | null;
  mapping_status: string | null;
  template_sha256: string | null;
  official_url?: string | null;
};

type FormRow = {
  form_code: string;
  name: string;
  official_page_url: string | null;
  hash_status: string;
  last_checked_at: string | null;
  last_error: string | null;
  official_version_label: string | null;
  official_sha256: string | null;
  active_version: VersionInfo | null;
  pending_version: VersionInfo | null;
  can_activate_pending: boolean;
};

type SyncStatus = {
  last_checked_at: string | null;
  last_result: { summary?: Record<string, number>; checked_count?: number } | null;
  forms: FormRow[];
  counts: {
    up_to_date: number;
    needs_remap: number;
    errors: number;
    missing_active: number;
  };
  auto_sync: {
    command: string;
    schedule: string;
    description: string;
  };
};

function authHeaders() {
  return adminAuthHeaders("application/json");
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

function shortSha(sha: string | null | undefined) {
  if (!sha) return "—";
  return sha.slice(0, 12) + "…";
}

function statusBadge(status: string) {
  switch (status) {
    case "up_to_date":
      return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200">Up to date</Badge>;
    case "needs_remap":
    case "new_draft":
      return <Badge className="bg-amber-100 text-amber-900 border-amber-200">Needs remap</Badge>;
    case "missing_active":
      return <Badge className="bg-slate-100 text-slate-800 border-slate-200">No active version</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    case "no_page_url":
      return <Badge variant="outline">No page URL</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function OfficialFormsSyncPage() {
  const [status, setStatus] = React.useState<SyncStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [busyForm, setBusyForm] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/official-forms/status`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load official forms status.");
      setStatus(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function ensureTemplates() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`${API}/admin/official-forms/ensure-templates`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Ensure templates failed.");
      setMessage(json.message ?? "Templates restored.");
      if (json.status?.forms) setStatus(json.status);
      else await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ensure templates failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function runSync(formCode?: string) {
    if (formCode) setBusyForm(formCode);
    else setSyncing(true);
    setMessage("");
    setError("");
    try {
      const url = formCode
        ? `${API}/admin/official-forms/${encodeURIComponent(formCode)}/sync`
        : `${API}/admin/official-forms/sync`;
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body: formCode ? undefined : JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Sync failed.");
      setMessage(json.message ?? "Check completed.");
      if (json.status?.forms) setStatus(json.status);
      else await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
      setBusyForm(null);
    }
  }

  async function markVerified(versionId: number) {
    setMessage("");
    setError("");
    try {
      const res = await fetch(`${API}/admin/official-forms/versions/${versionId}/mark-verified`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Mark verified failed.");
      setMessage(json.message ?? "Marked verified.");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark verified failed.");
    }
  }

  async function activate(versionId: number) {
    setMessage("");
    setError("");
    try {
      const res = await fetch(`${API}/admin/official-forms/versions/${versionId}/activate`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Activate failed.");
      setMessage(json.message ?? "Activated.");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activate failed.");
    }
  }

  const counts = status?.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileStack className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Official Forms Sync</h1>
            <p className="text-sm text-muted-foreground">
              Detect Canada.ca PDF updates for autofill templates. New hashes create drafts — remap before activate.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runSync()} disabled={syncing || loading}>
            <CloudDownload className={`mr-2 h-4 w-4 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "Checking…" : "Check & download updates"}
          </Button>
          <Button variant="secondary" onClick={() => ensureTemplates()} disabled={syncing || loading}>
            Restore missing templates
          </Button>
          <Button variant="outline" onClick={() => loadStatus()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-amber-50/60 border-amber-200 p-4 space-y-2">
        <p className="font-semibold text-sm text-amber-950">Package PDFs ≠ autofill-ready</p>
        <p className="text-xs text-amber-900 max-w-3xl">
          Application Packages sync stores reference PDFs for clients. This page manages{" "}
          <strong>government_form_versions</strong> used by consultant Official forms (autofill). When IRCC
          changes a PDF, we download a draft and flag remap — we never auto-activate a new hash as fillable.
        </p>
        <p className="text-xs">
          <Link href="/admindashboard/application-packages" className="underline text-amber-950">
            Open Application Packages
          </Link>
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Up to date</CardDescription>
            <CardTitle className="text-2xl">{counts?.up_to_date ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Needs remap</CardDescription>
            <CardTitle className="text-2xl">{counts?.needs_remap ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Errors</CardDescription>
            <CardTitle className="text-2xl">{counts?.errors ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last checked</CardDescription>
            <CardTitle className="text-base font-medium">{fmtDate(status?.last_checked_at)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-0">
            {status?.auto_sync?.schedule ?? "Weekly schedule"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supported autofill forms</CardTitle>
          <CardDescription>
            Active version is what consultants generate. Pending drafts appear when Canada.ca hash differs.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Hash status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Official / pending</TableHead>
                <TableHead>Last checked</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(status?.forms ?? []).map((row) => (
                <TableRow key={row.form_code}>
                  <TableCell>
                    <div className="font-medium">{row.form_code}</div>
                    <div className="text-xs text-muted-foreground">{row.name}</div>
                    {row.official_page_url && (
                      <a
                        href={row.official_page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-primary inline-flex items-center gap-1 mt-1"
                      >
                        Canada.ca <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    {statusBadge(row.hash_status)}
                    {row.last_error && (
                      <p className="text-[11px] text-red-700 mt-1 max-w-[180px]">{row.last_error}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.active_version ? (
                      <>
                        <div>{row.active_version.version_label}</div>
                        <div className="text-muted-foreground">{shortSha(row.active_version.template_sha256)}</div>
                        <div className="text-muted-foreground">
                          {row.active_version.mapping_status}/{row.active_version.status}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.official_version_label && (
                      <div>Detected: {row.official_version_label}</div>
                    )}
                    {row.official_sha256 && (
                      <div className="text-muted-foreground">{shortSha(row.official_sha256)}</div>
                    )}
                    {row.pending_version ? (
                      <div className="mt-1">
                        Pending #{row.pending_version.id} · {row.pending_version.version_label}
                        <div className="text-muted-foreground">
                          {row.pending_version.mapping_status}/{row.pending_version.status}
                        </div>
                      </div>
                    ) : (
                      !row.official_version_label && <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(row.last_checked_at)}</TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyForm === row.form_code || syncing}
                      onClick={() => runSync(row.form_code)}
                    >
                      {busyForm === row.form_code ? "…" : "Check"}
                    </Button>
                    {row.pending_version && row.pending_version.mapping_status !== "VERIFIED" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => markVerified(row.pending_version!.id)}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                        Mark verified
                      </Button>
                    )}
                    {row.pending_version && row.can_activate_pending && (
                      <Button size="sm" onClick={() => activate(row.pending_version!.id)}>
                        Activate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && (status?.forms?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No supported forms configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
