"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard, Loader2, FileText, ExternalLink, AlertTriangle,
  CheckCircle2, Calendar, Sparkles, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: "application/json",
  };
}

type Subscription = {
  id: number;
  status: string;
  is_trial: boolean;
  billing_cycle: string | null;
  package_name: string | null;
  package_description: string | null;
  price: number | null;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
  trial_ends_at: string | null;
  last_payment_at: string | null;
  cancelled_at: string | null;
  cancel_at_period_end: boolean;
  next_billing_at: string | null;
  has_stripe: boolean;
};

type Invoice = {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  invoice_pdf: string | null;
  hosted_url: string | null;
  source: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtMoney(amount: number | null, currency = "CAD") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
}

function statusBadge(status: string, cancelAtEnd?: boolean) {
  if (cancelAtEnd && status === "active") {
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Cancels soon</Badge>;
  }
  const map: Record<string, string> = {
    active: "bg-emerald-600",
    trial: "bg-blue-600",
    cancelled: "bg-slate-500",
    expired: "bg-slate-400",
  };
  return (
    <Badge className={cn("capitalize", map[status] ?? "bg-slate-500")}>
      {status}
    </Badge>
  );
}

export function BillingClient() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [billingRes, invRes] = await Promise.all([
        fetch(`${API}/consultant/billing`, { headers: authHeaders() }),
        fetch(`${API}/consultant/billing/invoices`, { headers: authHeaders() }),
      ]);
      const billing = await billingRes.json();
      const invData = await invRes.json();
      setSub(billing.subscription ?? null);
      setIsActive(billing.is_active ?? false);
      setInvoices(invData.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function cancelSubscription() {
    setCancelling(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/billing/cancel`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Cancel failed");
      setMessage(data.message);
      setSub(data.subscription ?? null);
      setIsActive(data.subscription?.status === "trial" ? false : isActive);
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not cancel subscription");
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = sub && (
    (sub.status === "active" && !sub.cancel_at_period_end) ||
    sub.status === "trial"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading billing…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 md:px-8">
      {/* Hero */}
      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-8 shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-emerald-300/90 text-xs font-medium uppercase tracking-wider mb-1">Billing & subscription</p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Manage your plan</h1>
            <p className="text-white/70 text-sm mt-2 max-w-lg">
              View invoices, track payments, and manage your RCICMASTER consultant subscription.
            </p>
          </div>
          <CreditCard className="h-12 w-12 text-emerald-400/80 hidden md:block" />
        </div>
      </div>

      {message && (
        <div className={cn(
          "rounded-xl px-4 py-3 text-sm",
          message.includes("Could not") || message.includes("failed")
            ? "bg-red-50 text-red-800 border border-red-200"
            : "bg-emerald-50 text-emerald-800 border border-emerald-200",
        )}>
          {message}
        </div>
      )}

      {/* Current plan */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Current plan
          </CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {!sub ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground text-sm">You don&apos;t have a subscription yet.</p>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link href="/dashboard">Choose a plan</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-semibold">{sub.package_name ?? "Subscription"}</h3>
                  {statusBadge(sub.status, sub.cancel_at_period_end)}
                </div>
                {sub.package_description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{sub.package_description}</p>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight">
                    {sub.is_trial ? "Free trial" : fmtMoney(sub.price, sub.currency)}
                  </span>
                  {!sub.is_trial && sub.billing_cycle && (
                    <span className="text-muted-foreground text-sm">
                      / {sub.billing_cycle === "yearly" ? "year" : "month"}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-muted/15 p-4 space-y-3 text-sm">
                {sub.is_trial && sub.trial_ends_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Trial ends <strong>{fmtDate(sub.trial_ends_at)}</strong></span>
                  </div>
                )}
                {sub.status === "active" && sub.next_billing_at && !sub.is_trial && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      {sub.cancel_at_period_end ? "Access until" : "Next billing"}
                      {" "}<strong>{fmtDate(sub.next_billing_at)}</strong>
                    </span>
                  </div>
                )}
                {sub.last_payment_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Last payment <strong>{fmtDate(sub.last_payment_at)}</strong></span>
                  </div>
                )}
                {sub.cancel_at_period_end && (
                  <div className="flex items-start gap-2 text-amber-800 bg-amber-50 rounded-lg p-3 -mx-1">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="text-xs leading-relaxed">
                      Your subscription is set to cancel. You&apos;ll keep access until {fmtDate(sub.next_billing_at ?? sub.ends_at)}.
                    </span>
                  </div>
                )}
                {sub.has_stripe && (
                  <p className="text-xs text-muted-foreground pt-1">Payments secured by Stripe</p>
                )}
              </div>
            </div>
          )}

          {sub && (
            <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t">
              {!isActive && sub.status !== "trial" && (
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                  <Link href="/dashboard">Subscribe again</Link>
                </Button>
              )}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {sub.is_trial
                          ? "Your free trial will end immediately and you will lose access to consultant features."
                          : "Your subscription will remain active until the end of the current billing period. You won't be charged again."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={cancelSubscription}
                        disabled={cancelling}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, cancel"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Invoices & payment history
          </CardTitle>
          <CardDescription>Download receipts for your subscription payments</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 px-0">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-6">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number ?? inv.id.slice(0, 12)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fmtDate(inv.paid_at ?? inv.created_at)}
                    </TableCell>
                    <TableCell>{fmtMoney(inv.amount, inv.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "paid" ? "default" : "secondary"} className={cn("text-[10px] capitalize", inv.status === "paid" && "bg-emerald-600")}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(inv.invoice_pdf || inv.hosted_url) ? (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                          <a href={inv.invoice_pdf ?? inv.hosted_url ?? "#"} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            PDF
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
