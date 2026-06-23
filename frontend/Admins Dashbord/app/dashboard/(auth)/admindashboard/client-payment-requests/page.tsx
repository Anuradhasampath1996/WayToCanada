"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { adminAuthHeaders, getAdminToken } from "@/lib/admin-auth";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PaymentRow = {
  id: number;
  title: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  paid_at: string | null;
  consultant: { name: string; email: string } | null;
  client: { name: string; email: string } | null;
};

type Stats = {
  total_paid: number;
  total_pending: number;
  total_revenue: number;
};

export default function ClientPaymentRequestsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`${API}/admin/client-payment-requests?${params}`, { headers: adminAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load client payment requests.");
      setRows(json.data ?? []);
      setStats(json.stats ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const res = await fetch(`${API}/admin/client-payment-requests/export?${params}`, {
      headers: { Authorization: `Bearer ${getAdminToken()}`, Accept: "text/csv" },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `client-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Client Payment Requests</h1>
          <p className="text-sm text-muted-foreground">
            Payments collected by consultants from clients via Stripe Connect, PayPal, or Interac.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border px-4 py-3">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-xl font-semibold tabular-nums">{stats.total_paid}</p>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-semibold tabular-nums">{stats.total_pending}</p>
          </div>
          <div className="rounded-xl border px-4 py-3">
            <p className="text-xs text-muted-foreground">Total collected</p>
            <p className="text-xl font-semibold tabular-nums">${stats.total_revenue.toFixed(2)}</p>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultant</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payment requests yet.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.consultant?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.consultant?.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.client?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.client?.email}</div>
                  </TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell className="capitalize">{row.provider}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize font-normal">{row.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">${row.amount.toFixed(2)} {row.currency}</TableCell>
                  <TableCell>{row.paid_at ? new Date(row.paid_at).toLocaleDateString("en-CA") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
