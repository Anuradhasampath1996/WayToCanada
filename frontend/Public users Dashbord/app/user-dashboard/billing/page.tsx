"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Clock, CreditCard, ExternalLink, Landmark, Loader2, Receipt, Wallet, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";

type PaymentRequest = {
  id: number;
  title: string;
  description?: string | null;
  amount: number;
  currency: string;
  provider: string;
  payment_purpose: string;
  status: string;
  pay_url: string;
  is_payable: boolean;
  paid_at?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
};

type TrustInvoice = {
  id: number;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  milestone_label: string | null;
  consultant_notes: string | null;
  client_approved_at?: string | null;
  released_at?: string | null;
  created_at?: string | null;
};

type TrustData = {
  trust_account: { balance_held: number; currency: string; total_deposited: number } | null;
  pending_invoices: TrustInvoice[];
  compliance_note?: string;
};

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function statusMeta(status: string) {
  switch (status) {
    case "paid":
      return { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 };
    case "pending":
      return { label: "Payment due", className: "bg-amber-100 text-amber-900 border-amber-200", icon: Clock };
    case "awaiting_confirmation":
      return { label: "Awaiting confirmation", className: "bg-blue-100 text-blue-900 border-blue-200", icon: Clock };
    case "cancelled":
      return { label: "Cancelled", className: "bg-muted text-muted-foreground border-border", icon: XCircle };
    default:
      return { label: status, className: "bg-muted text-muted-foreground", icon: Receipt };
  }
}

function payPath(payUrl: string) {
  try {
    const url = new URL(payUrl);
    return url.pathname;
  } catch {
    return payUrl;
  }
}

function invoiceStatusMeta(status: string) {
  switch (status) {
    case "pending_client_approval":
      return { label: "Awaiting your approval", className: "bg-amber-100 text-amber-900 border-amber-200", icon: Clock };
    case "approved":
      return { label: "Approved", className: "bg-blue-100 text-blue-900 border-blue-200", icon: CheckCircle2 };
    case "released":
      return { label: "Released", className: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 };
    default:
      return { label: status.replace(/_/g, " "), className: "bg-muted text-muted-foreground", icon: Receipt };
  }
}

export default function BillingPage() {
  const [items, setItems] = useState<PaymentRequest[]>([]);
  const [trust, setTrust] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [payRes, trustRes] = await Promise.all([
        fetch(`${CLIENT_API}/client/payment-requests`, { headers: clientAuthHeaders(false) }),
        fetch(`${CLIENT_API}/client/trust`, { headers: clientAuthHeaders(false) }),
      ]);
      const payJson = await payRes.json();
      if (!payRes.ok) throw new Error(payJson?.message ?? "Could not load payments.");
      setItems(payJson.data ?? []);
      if (trustRes.ok) setTrust(await trustRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function approveInvoice(invoiceId: number) {
    setApproving(invoiceId);
    try {
      const res = await fetch(`${CLIENT_API}/client/trust/invoices/${invoiceId}/approve`, {
        method: "POST",
        headers: clientAuthHeaders(false),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.message ?? "Could not approve invoice.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve invoice.");
    } finally {
      setApproving(null);
    }
  }

  useEffect(() => { load(); }, [load]);

  const pending = useMemo(() => items.filter((i) => i.is_payable), [items]);
  const paid = useMemo(() => items.filter((i) => i.status === "paid"), [items]);
  const trustInvoices = trust?.pending_invoices ?? [];
  const hasTrust = !!trust?.trust_account || trustInvoices.length > 0;

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-4 overflow-x-hidden sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Billing & payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payment requests and milestone invoices from your consultant.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          <Button variant="outline" size="sm" className="mt-2" onClick={load}>Try again</Button>
        </div>
      )}

      {!loading && hasTrust && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Trust account & invoices
          </h2>

          {trust?.trust_account && (
            <Card className="border-emerald-200/80 bg-emerald-50/30">
              <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                <Wallet className="size-8 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Funds held in trust for your case</p>
                  <p className="text-xl font-bold text-emerald-700 tabular-nums">
                    {fmtMoney(trust.trust_account.balance_held, trust.trust_account.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total deposited: {fmtMoney(trust.trust_account.total_deposited, trust.trust_account.currency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {trustInvoices.length > 0 ? (
            <div className="space-y-3">
              {trustInvoices.map((inv) => (
                <TrustInvoiceCard
                  key={inv.id}
                  invoice={inv}
                  approving={approving === inv.id}
                  onApprove={() => approveInvoice(inv.id)}
                />
              ))}
            </div>
          ) : trust?.trust_account ? (
            <p className="text-sm text-muted-foreground">No milestone invoices yet.</p>
          ) : null}

          {trust?.compliance_note && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">{trust.compliance_note}</p>
          )}
        </section>
      )}

      {!loading && !error && items.length === 0 && !hasTrust && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CreditCard className="size-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">No payment requests yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                When your consultant sends a fee or retainer payment link, it will appear here.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/user-dashboard">Back to your journey</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Payment due ({pending.length})
          </h2>
          {pending.map((item) => (
            <PaymentCard key={item.id} item={item} highlight />
          ))}
        </section>
      )}

      {!loading && items.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Payment requests
          </h2>
          {items.map((item) => (
            <PaymentCard key={item.id} item={item} />
          ))}
        </section>
      )}

      {!loading && paid.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {paid.length} completed payment{paid.length === 1 ? "" : "s"} on record.
        </p>
      )}
    </div>
  );
}

function PaymentCard({ item, highlight }: { item: PaymentRequest; highlight?: boolean }) {
  const meta = statusMeta(item.status);
  const Icon = meta.icon;

  return (
    <Card className={cn(highlight && "border-amber-300/80 shadow-sm")}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{item.title}</CardTitle>
            {item.description && (
              <CardDescription className="line-clamp-2">{item.description}</CardDescription>
            )}
          </div>
          <Badge variant="outline" className={cn("shrink-0 gap-1", meta.className)}>
            <Icon className="size-3" />
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
        <div className="space-y-1 text-sm">
          <p className="text-lg font-semibold tabular-nums">{fmtMoney(item.amount, item.currency)}</p>
          <p className="text-xs text-muted-foreground capitalize">
            via {item.provider.replace("_", " ")}
            {item.payment_purpose === "trust_deposit" ? " · Trust deposit" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.status === "paid"
              ? `Paid ${fmtDate(item.paid_at)}`
              : `Sent ${fmtDate(item.sent_at ?? item.created_at)}`}
          </p>
        </div>
        {item.is_payable && (
          <Button className="h-10 w-full rounded-lg sm:w-auto" asChild>
            <Link href={payPath(item.pay_url)}>
              Pay now
              <ExternalLink className="ml-1.5 size-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TrustInvoiceCard({
  invoice,
  approving,
  onApprove,
}: {
  invoice: TrustInvoice;
  approving: boolean;
  onApprove: () => void;
}) {
  const meta = invoiceStatusMeta(invoice.status);
  const Icon = meta.icon;
  const needsApproval = invoice.status === "pending_client_approval";

  return (
    <Card className={cn(needsApproval && "border-amber-300/80 shadow-sm")}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="size-4 shrink-0 text-emerald-600" />
              {invoice.milestone_label ?? "Milestone invoice"}
            </CardTitle>
            <CardDescription>{invoice.invoice_number}</CardDescription>
          </div>
          <Badge variant="outline" className={cn("shrink-0 gap-1", meta.className)}>
            <Icon className="size-3" />
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          <p className="text-lg font-semibold tabular-nums">{fmtMoney(invoice.amount, invoice.currency)}</p>
          {invoice.consultant_notes && (
            <p className="text-xs text-muted-foreground">{invoice.consultant_notes}</p>
          )}
          {invoice.client_approved_at && (
            <p className="text-xs text-muted-foreground">Approved {fmtDate(invoice.client_approved_at)}</p>
          )}
          {invoice.released_at && (
            <p className="text-xs text-muted-foreground">Released {fmtDate(invoice.released_at)}</p>
          )}
        </div>
        {needsApproval && (
          <Button
            className="h-10 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
            disabled={approving}
            onClick={onApprove}
          >
            {approving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-4" />}
            Approve invoice
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
