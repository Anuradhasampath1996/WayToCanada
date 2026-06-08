"use client";

import * as React from "react";
import {
  Calculator,
  CloudDownload,
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
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

type CrsMeta = {
  version: string;
  effective_date: string;
  source_url: string;
  official_tool: string;
  changelog?: string | null;
  last_synced_at?: string | null;
  policies?: Record<string, unknown>;
};

type DrawRow = {
  draw_number: number;
  draw_date: string;
  minimum_crs_score: number | null;
  invitations_issued: number | null;
  round_type: string | null;
  draw_name: string | null;
};

type VersionRow = {
  id: number;
  version: string;
  effective_date: string;
  is_active: boolean;
  changelog: string | null;
  last_synced_at: string | null;
};

type SyncStatus = {
  meta: CrsMeta;
  config_version: string;
  draw_count: number;
  latest_draw: DrawRow | null;
  draws_updated_at: string | null;
  auto_sync: {
    command: string;
    schedule: string;
    description: string;
  };
  draw_sources: string[];
  source_urls: { crs_criteria: string; official_tool: string };
  policies: Record<string, unknown>;
  version_history: VersionRow[];
  recent_draws: DrawRow[];
};

type SyncResult = {
  rules_updated: boolean;
  version: string;
  draws_synced: number;
  ircc_probe: { status?: string; note?: string; content_hash?: string; message?: string } | null;
};

function authHeaders() {
  return adminAuthHeaders("application/json");
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export default function CrsCalculatorSyncPage() {
  const [status, setStatus] = React.useState<SyncStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [syncMessage, setSyncMessage] = React.useState("");
  const [lastResult, setLastResult] = React.useState<SyncResult | null>(null);

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/crs-calculator/sync-status`, { headers: authHeaders() });
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

  async function runManualSync() {
    setSyncing(true);
    setSyncMessage("");
    setError("");
    try {
      const res = await fetch(`${API}/admin/crs-calculator/sync`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Sync failed.");
      setLastResult(json.result ?? null);
      setSyncMessage(json.message ?? "Sync completed.");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const meta = status?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CRS Calculator Sync</h1>
            <p className="text-sm text-muted-foreground">
              Pathway calculator scoring rules and Express Entry draw cut-offs synced from IRCC sources.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runManualSync} disabled={syncing || loading}>
            <CloudDownload className={`mr-2 h-4 w-4 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "Syncing…" : "Manual Sync Now"}
          </Button>
          <Button variant="outline" onClick={loadStatus} disabled={loading || syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
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

      <div className="rounded-xl border bg-blue-50/50 border-blue-200 p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm text-blue-900">Automatic sync (scheduled)</p>
          <p className="text-xs text-blue-800 mt-1">
            {status?.auto_sync.description ?? "CRS rules and draw data are synced automatically on the server."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-blue-800">
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-1">
            <Clock className="h-3 w-3" />
            {status?.auto_sync.schedule ?? "Daily at 4:00 AM (America/Toronto)"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 px-2 py-1">
            Command: <code className="font-mono">{status?.auto_sync.command ?? "crs:sync"}</code>
          </span>
        </div>
        <p className="text-xs text-blue-700">
          Official CRS criteria:{" "}
          <a
            href={status?.source_urls.crs_criteria ?? "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html"}
            target="_blank"
            rel="noreferrer"
            className="underline inline-flex items-center gap-1"
          >
            IRCC CRS page <ExternalLink className="h-3 w-3" />
          </a>
          {" · "}
          <a
            href={status?.source_urls.official_tool ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="underline inline-flex items-center gap-1"
          >
            Official CRS tool <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>

      {lastResult?.ircc_probe && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs space-y-1">
          <p className="font-semibold">Last IRCC page probe</p>
          <p className="text-muted-foreground">
            Status: {lastResult.ircc_probe.status}
            {lastResult.ircc_probe.note ? ` — ${lastResult.ircc_probe.note}` : ""}
            {lastResult.ircc_probe.message ? ` — ${lastResult.ircc_probe.message}` : ""}
          </p>
          {lastResult.rules_updated && (
            <p className="text-green-700 font-medium">Rules version updated to {lastResult.version}.</p>
          )}
          {lastResult.draws_synced > 0 && (
            <p className="text-green-700">Draw records synced: {lastResult.draws_synced}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active rules version</CardDescription>
            <CardTitle className="text-xl">{meta?.version ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Effective {meta?.effective_date ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last sync</CardDescription>
            <CardTitle className="text-base font-semibold">{fmtDate(meta?.last_synced_at)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Config file: {status?.config_version ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Express Entry draws</CardDescription>
            <CardTitle className="text-xl">{status?.draw_count ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Updated {fmtDate(status?.draws_updated_at)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Latest draw cut-off</CardDescription>
            <CardTitle className="text-xl flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              {status?.latest_draw?.minimum_crs_score ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Draw #{status?.latest_draw?.draw_number ?? "—"} · {status?.latest_draw?.draw_date ?? "—"}
          </CardContent>
        </Card>
      </div>

      {status?.policies && Object.keys(status.policies).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active scoring policies</CardTitle>
            <CardDescription>Applied in consultant pathway calculator after sync.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(status.policies).map(([key, val]) => (
                <Badge key={key} variant="outline" className="text-xs font-normal">
                  {key.replace(/_/g, " ")}: {String(val)}
                </Badge>
              ))}
            </div>
            {meta?.changelog && (
              <p className="text-xs text-muted-foreground mt-3">{meta.changelog}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules version history</CardTitle>
            <CardDescription>Stored in database after each sync.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(status?.version_history ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {loading ? "Loading…" : "No version history yet. Run manual sync."}
                    </TableCell>
                  </TableRow>
                ) : (
                  status!.version_history.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.version}</TableCell>
                      <TableCell>{v.effective_date}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(v.last_synced_at)}</TableCell>
                      <TableCell>
                        {v.is_active && <Badge className="text-[10px]">Active</Badge>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Express Entry draws</CardTitle>
            <CardDescription>
              Open data sources: {status?.draw_sources?.length ?? 0} configured
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>CRS</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(status?.recent_draws ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {loading ? "Loading…" : "No draws in database. Run manual sync."}
                    </TableCell>
                  </TableRow>
                ) : (
                  status!.recent_draws.map((d) => (
                    <TableRow key={d.draw_number}>
                      <TableCell>{d.draw_number}</TableCell>
                      <TableCell>{d.draw_date}</TableCell>
                      <TableCell className="font-semibold">{d.minimum_crs_score ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {d.round_type ?? d.draw_name ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {status?.draw_sources && status.draw_sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Draw data sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {status.draw_sources.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline break-all"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {url}
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
