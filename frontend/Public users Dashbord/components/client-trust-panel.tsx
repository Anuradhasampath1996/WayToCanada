"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Landmark, CheckCircle2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

type Invoice = {
  id: number;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  milestone_label: string | null;
  consultant_notes: string | null;
};

type TrustData = {
  trust_account: { balance_held: number; currency: string; total_deposited: number } | null;
  pending_invoices: Invoice[];
  compliance_note: string;
};

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("wtc_token") ?? document.cookie.match(/wtc_token=([^;]+)/)?.[1] ?? "";
}

function fmt(n: number, c: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: c }).format(n);
}

export function ClientTrustPanel() {
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`${API}/client/trust`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
    });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(invoiceId: number) {
    setApproving(invoiceId);
    await fetch(`${API}/client/trust/invoices/${invoiceId}/approve`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
    });
    await load();
    setApproving(null);
  }

  if (loading) return null;
  if (!data?.trust_account && (!data?.pending_invoices || data.pending_invoices.length === 0)) return null;

  const currency = data.trust_account?.currency ?? "CAD";
  const pending = data.pending_invoices?.filter((i) => i.status === "pending_client_approval") ?? [];

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/20 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-emerald-600" />
        <p className="font-semibold">Client trust funds</p>
      </div>

      {data.trust_account && (
        <div className="flex items-center gap-3 rounded-lg border bg-background/80 px-4 py-3">
          <Wallet className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Funds held in trust for your case</p>
            <p className="text-xl font-bold text-emerald-700">{fmt(data.trust_account.balance_held, currency)}</p>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Milestone invoices awaiting your approval</p>
          {pending.map((inv) => (
            <div key={inv.id} className="rounded-lg border bg-background px-4 py-3 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{inv.milestone_label ?? inv.invoice_number}</p>
                <p className="text-xs text-muted-foreground">{inv.invoice_number} · {fmt(inv.amount, inv.currency)}</p>
                {inv.consultant_notes && <p className="text-xs text-muted-foreground mt-1">{inv.consultant_notes}</p>}
              </div>
              <Badge variant="outline" className="text-amber-700 border-amber-200">Awaiting approval</Badge>
              <Button
                size="sm"
                className="h-9 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
                disabled={approving === inv.id}
                onClick={() => approve(inv.id)}
              >
                {approving === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Approve invoice
              </Button>
            </div>
          ))}
        </div>
      )}

      {data.compliance_note && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{data.compliance_note}</p>
      )}
    </div>
  );
}
