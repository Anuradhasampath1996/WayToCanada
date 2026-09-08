"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  Clock,
  ExternalLink,
  RefreshCw,
  Users,
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

const CICC_REGISTER =
  "https://register.college-ic.ca/Public-Register-EN/Public-Register-EN/RCIC_Search.aspx";

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
    search_terms?: string[];
    include_risia?: boolean;
    enrich_via_search: boolean;
    search_url?: string;
    risia_search_url?: string;
    profile_url?: string;
    look_ahead?: number;
  };
};

function authHeaders() {
  return adminAuthHeaders("application/json");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusBadge(status: string | null | undefined) {
  if (!status) return <Badge variant="outline">—</Badge>;
  if (status === "running" || status === "pending") {
    return <Badge variant="warning">{status}</Badge>;
  }
  if (status === "completed") return <Badge variant="success">{status}</Badge>;
  if (status === "failed") return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function CiccRegisterSyncPage() {
  const [status, setStatus] = React.useState<SyncStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [syncMessage, setSyncMessage] = React.useState("");

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/rcic-consultants/sync-status`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load sync status.");
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

  React.useEffect(() => {
    if (!status?.is_running) return;
    const t = setInterval(() => {
      void loadStatus();
    }, 4000);
    return () => clearInterval(t);
  }, [status?.is_running, loadStatus]);

  async function runManualSync() {
    setSyncing(true);
    setSyncMessage("");
    setError("");
    try {
      const res = await fetch(`${API}/admin/rcic-consultants/sync`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 202) {
        throw new Error(json.message ?? "Sync failed.");
      }
      setSyncMessage(json.message ?? "Sync started.");
      if (json.status) setStatus(json.status);
      else await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const activeRun = status?.running_run ?? status?.latest_run ?? null;
  const stats = activeRun?.stats;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CICC Register Sync</h1>
            <p className="text-sm text-muted-foreground">
              Keep the RCIC consultants list updated from the{" "}
              <a
                href={CICC_REGISTER}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                CICC public RCIC search <ExternalLink className="h-3 w-3" />
              </a>
              {" "}(full register pagination + RISIA).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void runManualSync()} disabled={syncing || loading || !!status?.is_running}>
            <CloudDownload
              className={`mr-2 h-4 w-4 ${syncing || status?.is_running ? "animate-pulse" : ""}`}
            />
            {status?.is_running ? "Sync running…" : syncing ? "Starting…" : "Manual Sync Now"}
          </Button>
          <Button variant="outline" onClick={() => void loadStatus()} disabled={loading || syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admindashboard/users/rcic">
              <Users className="mr-2 h-4 w-4" />
              View RCIC list
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {syncMessage}
        </div>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm text-blue-900">Automatic sync (scheduled)</p>
          <p className="text-xs text-blue-800 mt-1">
            {status?.auto_sync.description
              ?? "Scrapes CICC public register profiles and upserts by profile ID."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-blue-800">
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-1">
            <Clock className="h-3 w-3" />
            {status?.auto_sync.schedule ?? "Weekly on Sunday at 2:00 AM (America/Toronto)"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-1">
            Command:{" "}
            <code className="font-mono">{status?.auto_sync.command ?? "rcic:sync-register"}</code>
          </span>
        </div>
        <p className="text-xs text-blue-700">
          Production needs cron (<code className="font-mono">schedule:run</code>) and a queue worker
          (<code className="font-mono">queue:work</code>). Full scrapes can take several hours.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total records</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {(status?.total_records ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Entitled to practise</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {(status?.entitled_count ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Scrape errors</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {(status?.scrape_error_count ?? 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last scraped</CardDescription>
            <CardTitle className="text-base font-medium">
              {fmtDate(status?.last_scraped_at)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Current / latest sync run</CardTitle>
              <CardDescription>
                Progress, stats, and errors for the most recent CICC register sync.
              </CardDescription>
            </div>
            {status?.is_running
              ? statusBadge("running")
              : statusBadge(activeRun?.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeRun ? (
            <p className="text-sm text-muted-foreground">
              No sync has been run yet. Use Manual Sync Now or wait for the weekly schedule.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Run ID</p>
                  <p className="font-medium tabular-nums">#{activeRun.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Trigger</p>
                  <p className="font-medium">{activeRun.trigger}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Started</p>
                  <p className="font-medium">{fmtDate(activeRun.started_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Finished</p>
                  <p className="font-medium">{fmtDate(activeRun.finished_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm mb-2">{activeRun.current_step ?? "Waiting…"}</p>
                {status?.is_running && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, activeRun.progress_percent ?? 0)}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {activeRun.completed_steps.toLocaleString()} / {activeRun.total_steps.toLocaleString()}
                  {" · "}
                  {activeRun.progress_percent}%
                </p>
              </div>

              {activeRun.error_message && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {activeRun.error_message}
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Not found</TableHead>
                    <TableHead>Skipped</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="tabular-nums">{stats?.created ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{stats?.updated ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{stats?.errors ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{stats?.not_found ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{stats?.skipped ?? 0}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync configuration</CardTitle>
          <CardDescription>Runtime settings used by the scraper.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium w-48">Delay between requests</TableCell>
                <TableCell className="tabular-nums">{status?.config?.delay_ms ?? 500} ms</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Include RISIA search</TableCell>
                <TableCell>{status?.config?.include_risia ? "Yes" : "No"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Search terms</TableCell>
                <TableCell className="font-mono text-xs">
                  {(status?.config?.search_terms?.length ?? 0) === 1 && status?.config?.search_terms?.[0] === ""
                    ? "(blank = full register)"
                    : (status?.config?.search_terms ?? []).join(", ") || "—"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Search URL</TableCell>
                <TableCell className="font-mono text-xs break-all">
                  {status?.config?.search_url
                    ?? "https://register.college-ic.ca/Public-Register-EN/Public-Register-EN/RCIC_Search.aspx"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {status?.last_successful_run && status.last_successful_run.id !== activeRun?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last successful sync</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Run #{status.last_successful_run.id} · trigger {status.last_successful_run.trigger}</p>
            <p className="text-muted-foreground">
              Finished {fmtDate(status.last_successful_run.finished_at)}
            </p>
            <p>
              Created {status.last_successful_run.stats?.created ?? 0}
              {" · "}Updated {status.last_successful_run.stats?.updated ?? 0}
              {" · "}Errors {status.last_successful_run.stats?.errors ?? 0}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
