"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Landmark, Plus, CheckCircle2, FileText, ArrowRight,
  Wallet, RefreshCw, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type TrustAccount = {
  balance_held: number;
  total_deposited: number;
  total_released: number;
  total_refunded: number;
  currency: string;
};

type Milestone = {
  id: number;
  milestone_key: string;
  label: string;
  percentage: number;
  amount: number;
  currency: string;
  status: string;
};

type LedgerEntry = {
  id: number;
  entry_type: string;
  direction: string;
  amount: number;
  currency: string;
  balance_after: number;
  title: string;
  description: string | null;
  occurred_at: string;
};

type Invoice = {
  id: number;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  milestone_label: string | null;
};

type TrustData = {
  trust_account: TrustAccount | null;
  milestones: Milestone[];
  ledger: LedgerEntry[];
  pending_invoices: Invoice[];
  compliance_note: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-amber-100 text-amber-800",
  invoiced: "bg-violet-100 text-violet-800",
  released: "bg-emerald-100 text-emerald-800",
  pending_client_approval: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtMoney(n: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(n);
}

export function ClientTrustLedgerPanel({ clientId }: { clientId: number }) {
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositForm, setDepositForm] = useState({ amount: "", method: "interac", reference: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API}/consultant/clients/${clientId}/trust`, { headers: authHeaders() });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  async function post(path: string, body?: object) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${clientId}/trust/${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Request failed.");
      setData(json.data ?? null);
      await load();
      return json;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed.");
      throw e;
    } finally {
      setActionLoading(false);
    }
  }

  async function recordDeposit() {
    await post("deposit", {
      amount: parseFloat(depositForm.amount),
      method: depositForm.method,
      reference: depositForm.reference || null,
      notes: depositForm.notes || null,
    });
    setDepositOpen(false);
    setDepositForm({ amount: "", method: "interac", reference: "", notes: "" });
  }

  if (loading) {
    return (
      <Card className="border-border/70">
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Loading trust ledger…
        </CardContent>
      </Card>
    );
  }

  const trust = data?.trust_account;
  const currency = trust?.currency ?? "CAD";

  return (
    <Card className="border-emerald-200/60 shadow-sm" id="client-trust-ledger">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Landmark className="size-5 text-emerald-600" />
              Client Trust Account Ledger
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              CICC-aligned trust fund tracking. Client advance fees are held separately until milestones are
              completed, invoiced, and released to your operating account.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={load} disabled={actionLoading}>
              <RefreshCw className={cn("size-3.5", actionLoading && "animate-spin")} />
            </Button>
            <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setDepositOpen(true)}>
              <Plus className="size-3.5" /> Record deposit
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </div>
        )}

        {trust ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Held in trust", value: trust.balance_held, icon: Wallet, highlight: true },
              { label: "Total deposited", value: trust.total_deposited, icon: Plus },
              { label: "Released (earned)", value: trust.total_released, icon: ArrowRight },
              { label: "Refunded", value: trust.total_refunded, icon: FileText },
            ].map((s) => (
              <div
                key={s.label}
                className={cn(
                  "rounded-xl border p-4",
                  s.highlight ? "border-emerald-200 bg-emerald-50/50" : "border-border/50 bg-muted/10",
                )}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className={cn("mt-1 text-xl font-bold", s.highlight && "text-emerald-700")}>
                  {fmtMoney(s.value, currency)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Trust account opens when the client signs the retainer agreement.
          </p>
        )}

        {data?.milestones && data.milestones.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Fee milestones (retainer agreement)</h3>
            <ul className="space-y-2">
              {data.milestones.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.percentage}% · {fmtMoney(m.amount, m.currency)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[m.status] ?? "")}>
                    {m.status.replace(/_/g, " ")}
                  </Badge>
                  {m.status === "pending" || m.status === "in_progress" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={actionLoading}
                      onClick={() => post(`milestones/${m.id}/complete`)}
                    >
                      <CheckCircle2 className="mr-1 size-3" /> Mark complete
                    </Button>
                  ) : null}
                  {m.status === "completed" ? (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
                      disabled={actionLoading}
                      onClick={() => post(`milestones/${m.id}/invoice`)}
                    >
                      Issue invoice
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data?.pending_invoices && data.pending_invoices.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Pending invoices</h3>
            <ul className="space-y-2">
              {data.pending_invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200/60 bg-violet-50/30 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.milestone_label} · {fmtMoney(inv.amount, inv.currency)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[inv.status] ?? "")}>
                    {inv.status.replace(/_/g, " ")}
                  </Badge>
                  {inv.status === "approved" ? (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                      disabled={actionLoading}
                      onClick={() => post(`invoices/${inv.id}/release`)}
                    >
                      Release to operating
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data?.ledger && data.ledger.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Ledger entries</h3>
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border/50">
              {data.ledger.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-2 border-b border-border/30 px-3 py-2 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium">{e.title}</p>
                    {e.description && <p className="text-xs text-muted-foreground truncate">{e.description}</p>}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(e.occurred_at).toLocaleString("en-CA")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("font-semibold", e.direction === "credit" ? "text-emerald-700" : "text-red-600")}>
                      {e.direction === "credit" ? "+" : "−"}{fmtMoney(e.amount, e.currency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Bal {fmtMoney(e.balance_after, e.currency)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data?.compliance_note && (
          <p className="rounded-lg border border-emerald-200/50 bg-emerald-50/40 p-3 text-xs text-emerald-900">
            {data.compliance_note}
          </p>
        )}
      </CardContent>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record trust deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Amount ({currency})</Label>
              <Input type="number" min="0.01" step="0.01" value={depositForm.amount}
                onChange={(e) => setDepositForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Payment method</Label>
              <Select value={depositForm.method} onValueChange={(v) => setDepositForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interac">Interac e-Transfer</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="stripe">Stripe (online)</SelectItem>
                  <SelectItem value="cash">Cash / other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reference (optional)</Label>
              <Input value={depositForm.reference}
                onChange={(e) => setDepositForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Transaction ID" />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={depositForm.notes}
                onChange={(e) => setDepositForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={actionLoading || !depositForm.amount}
              onClick={recordDeposit}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : "Record deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
