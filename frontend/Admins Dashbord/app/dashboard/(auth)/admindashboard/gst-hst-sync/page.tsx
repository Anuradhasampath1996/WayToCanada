"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  ExternalLink,
  Percent,
  RefreshCw,
  Clock,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const CRA_SOURCE =
  "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html";

type RateRow = {
  code: string;
  name: string;
  tax_type: string;
  gst_pct: number;
  prov_pct: number;
  total_pct: number;
  label: string;
  notes: string | null;
};

type SyncStatus = {
  meta: {
    version: string;
    effective_date: string;
    last_synced_at: string | null;
    changelog: string | null;
  };
  rates_table: RateRow[];
  province_count: number;
  auto_sync: { command: string; schedule: string; description: string };
  sample_calculation: {
    subtotal: number;
    total_tax: number;
    total: number;
    tax_label: string;
    province_name: string;
  };
};

type CalcResult = {
  province_name: string;
  tax_label: string;
  subtotal: number;
  gst_amount: number;
  provincial_tax: number;
  total_tax: number;
  total: number;
  total_rate_pct: number;
  disclaimer: string;
};

function authHeaders() {
  return adminAuthHeaders("application/json");
}

function fmtCAD(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
}

function taxTypeBadge(type: string) {
  const map: Record<string, string> = {
    hst: "HST",
    gst_pst: "GST + PST",
    gst_qst: "GST + QST",
    gst_only: "GST only",
  };
  return map[type] ?? type;
}

export default function GstHstSyncPage() {
  const [status, setStatus] = React.useState<SyncStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [syncMessage, setSyncMessage] = React.useState("");

  const [subtotal, setSubtotal] = React.useState("100");
  const [province, setProvince] = React.useState("ON");
  const [calcResult, setCalcResult] = React.useState<CalcResult | null>(null);
  const [calculating, setCalculating] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/gst-hst/sync-status`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load.");
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

  async function runSync() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch(`${API}/admin/gst-hst/sync`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Sync failed.");
      setSyncMessage(json.message ?? "Done.");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function runCalculate() {
    setCalculating(true);
    try {
      const res = await fetch(`${API}/admin/gst-hst/calculate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ subtotal: Number(subtotal), province }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed.");
      setCalcResult(json.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calculation failed.");
    } finally {
      setCalculating(false);
    }
  }

  const meta = status?.meta;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
            <Percent className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GST/HST Tax Sync</h1>
            <p className="text-sm text-muted-foreground">
              Sales tax rates for payments — synced from{" "}
              <a href={CRA_SOURCE} target="_blank" rel="noreferrer" className="text-violet-700 underline inline-flex items-center gap-0.5">
                CRA charge &amp; collect <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={runSync} disabled={syncing || loading}>
            <CloudDownload className={`mr-2 h-4 w-4 ${syncing ? "animate-pulse" : ""}`} />
            {syncing ? "Syncing…" : "Sync Now"}
          </Button>
          <Button variant="outline" onClick={loadStatus} disabled={loading}>
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

      <div className="rounded-xl border bg-violet-50/50 border-violet-200 p-4 space-y-2 text-sm">
        <p className="font-semibold text-violet-900">Auto sync · Payment tax</p>
        <p className="text-xs text-violet-800">{status?.auto_sync.description}</p>
        <div className="flex flex-wrap gap-2 text-xs text-violet-800">
          <span className="inline-flex items-center gap-1 rounded-md bg-violet-100/80 px-2 py-1">
            <Clock className="h-3 w-3" />
            {status?.auto_sync.schedule}
          </span>
          <code className="rounded-md bg-violet-100/80 px-2 py-1">{status?.auto_sync.command}</code>
        </div>
        <p className="text-xs text-violet-700">
          Public API for checkout: <code>GET /api/v1/tax/gst-hst/rates</code> ·{" "}
          <code>POST /api/v1/tax/gst-hst/calculate</code>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Version</CardDescription>
            <CardTitle>{meta?.version ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Effective {meta?.effective_date ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Provinces</CardDescription>
            <CardTitle>{status?.province_count ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Place-of-supply rates
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sample ON $100</CardDescription>
            <CardTitle className="text-base">
              {status?.sample_calculation
                ? `${status.sample_calculation.tax_label} → ${fmtCAD(status.sample_calculation.total)}`
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main rates table — all provinces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All provinces &amp; territories — sales tax rates</CardTitle>
          <CardDescription>
            Rate to charge based on place of supply (where the customer receives the service).
            Source:{" "}
            <a href={CRA_SOURCE} target="_blank" rel="noreferrer" className="underline">
              CRA — Which rate to charge
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="pl-6">Province</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">PST/QST</TableHead>
                <TableHead className="text-right pr-6">Total rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status?.rates_table.map((row) => (
                <TableRow key={row.code}>
                  <TableCell className="pl-6 font-medium">
                    {row.name}
                    {row.notes && (
                      <p className="text-xs text-amber-700 font-normal mt-0.5">{row.notes}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{row.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{taxTypeBadge(row.tax_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.gst_pct > 0 ? `${row.gst_pct}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.prov_pct > 0 ? `${row.prov_pct}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right pr-6 font-semibold tabular-nums text-violet-700">
                    {row.total_pct}%
                    <p className="text-xs font-normal text-muted-foreground">{row.label}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Payment tax calculator
            </CardTitle>
            <CardDescription>Test tax on a payment subtotal by province.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Subtotal (CAD)</Label>
                <Input type="number" min={0} value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Place of supply</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {status?.rates_table.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.name} ({r.total_pct}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={runCalculate} disabled={calculating}>
              {calculating ? "Calculating…" : "Calculate tax"}
            </Button>
            {calcResult && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                <p className="font-semibold">{calcResult.province_name} — {calcResult.tax_label}</p>
                <div className="grid grid-cols-2 gap-x-3 text-xs pt-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmtCAD(calcResult.subtotal)}</span>
                  {calcResult.gst_amount > 0 && (
                    <>
                      <span className="text-muted-foreground">GST</span>
                      <span>{fmtCAD(calcResult.gst_amount)}</span>
                    </>
                  )}
                  {calcResult.provincial_tax > 0 && (
                    <>
                      <span className="text-muted-foreground">PST/QST</span>
                      <span>{fmtCAD(calcResult.provincial_tax)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Total tax</span>
                  <span>{fmtCAD(calcResult.total_tax)}</span>
                  <span className="font-medium">Total charged</span>
                  <span className="font-medium">{fmtCAD(calcResult.total)}</span>
                </div>
              </div>
            )}
          </CardContent>
      </Card>

      {meta?.changelog && (
        <p className="text-xs text-muted-foreground">{meta.changelog}</p>
      )}
    </div>
  );
}
