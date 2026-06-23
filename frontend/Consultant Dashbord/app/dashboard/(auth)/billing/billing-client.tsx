"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  Shield,
  Megaphone,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(json = true, accept = "application/json"): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: accept,
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
  auto_renew_enabled?: boolean;
  can_manage_auto_renew?: boolean;
};

type MarketingOrder = {
  id: number;
  service_name: string | null;
  service_slug: string | null;
  status: string;
  billing_type: string;
  price_label: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  province: string | null;
  paid_at: string | null;
  ends_at: string | null;
  cancelled_at: string | null;
  is_recurring: boolean;
  cancel_at_period_end?: boolean;
  auto_renew_enabled?: boolean;
  can_manage_auto_renew?: boolean;
  next_billing_at?: string | null;
};

type PaymentCategory = "subscription" | "marketing" | "storage";

type Invoice = {
  id: string;
  category?: PaymentCategory;
  marketing_order_id?: number;
  payment_record_id?: number;
  number: string | null;
  description?: string | null;
  service_slug?: string | null;
  subtotal?: number;
  tax_amount?: number;
  amount: number;
  total?: number;
  currency: string;
  status: string;
  tax_label?: string | null;
  tax_type?: string | null;
  province?: string | null;
  country?: string | null;
  tax_applicable?: boolean;
  gst_amount?: number | null;
  provincial_tax?: number | null;
  total_rate_pct?: number | null;
  billing_address?: Record<string, string> | null;
  billing_cycle?: string | null;
  package_name?: string | null;
  payment_type?: string;
  subscription_status?: string | null;
  paid_at: string | null;
  created_at: string;
  invoice_pdf: string | null;
  hosted_url: string | null;
  source: string;
  can_download?: boolean;
  invoice_download?: string | null;
};

function formatBillingAddress(addr: Record<string, string> | null | undefined): string[] {
  if (!addr) return [];
  return [
    addr.line1,
    addr.line2,
    [addr.city, addr.province, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ].filter(Boolean) as string[];
}

async function downloadInvoicePdf(inv: Invoice) {
  const recordId = inv.payment_record_id ?? (/^\d+$/.test(inv.id) ? Number(inv.id) : null);
  const url =
    inv.invoice_pdf ??
    inv.invoice_download ??
    (recordId ? `${API}/consultant/billing/payments/${recordId}/invoice` : null);

  if (!url) return;

  if (inv.invoice_pdf && inv.invoice_pdf.startsWith("http") && inv.source === "stripe") {
    window.open(inv.invoice_pdf, "_blank", "noopener,noreferrer");
    return;
  }

  const res = await fetch(url, { headers: authHeaders(false, "application/pdf") });
  if (!res.ok) {
    let message = "Failed to download invoice.";
    if ((res.headers.get("Content-Type") ?? "").includes("application/json")) {
      const json = await res.json().catch(() => null);
      if (json?.message) message = String(json.message);
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^";\n]+)"?/);
  const filename = match?.[1] ?? `invoice-${inv.number ?? recordId ?? "payment"}.pdf`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtMoney(amount: number | null, currency = "CAD") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/80 bg-card">
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground break-words">{description}</p>
          )}
        </div>
        {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
      </div>
      <div className="px-4 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status, cancelAtEnd }: { status: string; cancelAtEnd?: boolean }) {
  if (cancelAtEnd && status === "active") {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 font-normal">
        Cancels at period end
      </Badge>
    );
  }

  const styles: Record<string, string> = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-800",
    trial: "border-blue-200 bg-blue-50 text-blue-800",
    cancelled: "border-slate-200 bg-slate-50 text-slate-600",
    expired: "border-slate-200 bg-slate-50 text-slate-500",
  };

  return (
    <Badge variant="outline" className={cn("font-normal capitalize", styles[status] ?? styles.expired)}>
      {status}
    </Badge>
  );
}

function CategoryBadge({ category }: { category?: PaymentCategory }) {
  if (category === "marketing") {
    return (
      <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800 font-normal">
        Marketing
      </Badge>
    );
  }

  if (category === "storage") {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 font-normal">
        Storage
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800 font-normal">
      Subscription
    </Badge>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-background border border-border/70 shadow-sm">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function BillingClient() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [marketingOrders, setMarketingOrders] = useState<MarketingOrder[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentCategory>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [cancellingMarketingId, setCancellingMarketingId] = useState<number | null>(null);
  const [togglingMarketingId, setTogglingMarketingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [billingRes, invRes] = await Promise.all([
        fetch(`${API}/consultant/billing`, { headers: authHeaders() }),
        fetch(`${API}/consultant/billing/invoices`, { headers: authHeaders() }),
      ]);
      const billing = await billingRes.json();
      const invData = await invRes.json();

      if (!billingRes.ok) {
        throw new Error(billing.message ?? "Could not load subscription details.");
      }
      if (!invRes.ok) {
        throw new Error(invData.message ?? "Could not load payment history.");
      }

      setSub(billing.subscription ?? null);
      setIsActive(billing.is_active ?? false);
      setMarketingOrders(billing.marketing_orders ?? []);
      setInvoices(invData.data ?? []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not load billing data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const canCancel =
    sub &&
    ((sub.status === "active" && !sub.cancel_at_period_end) || sub.status === "trial");

  async function openPaymentDetail(inv: Invoice) {
    const isMarketing = inv.category === "marketing";
    const recordId =
      !isMarketing && (inv.payment_record_id ?? (/^\d+$/.test(inv.id) ? Number(inv.id) : null));
    setDialogOpen(true);
    setSelectedInvoice(inv);
    setDialogError(null);

    if (!recordId) {
      return;
    }

    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/consultant/billing/payments/${recordId}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not load payment details");

      const data = json.data;
      setSelectedInvoice({
        ...inv,
        ...data,
        id: String(data.id ?? inv.id),
        payment_record_id: data.id ?? recordId,
        number: data.invoice_number ?? inv.number,
        subtotal: data.subtotal ?? inv.subtotal,
        tax_amount: data.tax_amount ?? inv.tax_amount,
        amount: data.total ?? inv.amount,
        hosted_url: data.hosted_invoice_url ?? inv.hosted_url,
      });
    } catch (e: unknown) {
      setDialogError(e instanceof Error ? e.message : "Could not load payment details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDownloadInvoice(inv: Invoice) {
    setDownloadingId(inv.id);
    setDialogError(null);
    setMessage(null);
    try {
      await downloadInvoicePdf(inv);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not download invoice PDF.";
      setDialogError(msg);
      setMessage(msg);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleAutoRenewChange(enabled: boolean) {
    if (!sub?.can_manage_auto_renew) return;
    setTogglingAutoRenew(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/billing/auto-renew`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not update automatic renewal.");
      setSub(data.subscription ?? null);
      setMessage(data.message);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not update automatic renewal.");
    } finally {
      setTogglingAutoRenew(false);
    }
  }

  async function cancelMarketingOrder(orderId: number) {
    setCancellingMarketingId(orderId);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/billing/marketing/${orderId}/cancel`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not cancel marketing service.");
      setMessage(data.message);
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not cancel marketing service.");
    } finally {
      setCancellingMarketingId(null);
    }
  }

  async function handleMarketingAutoRenewChange(orderId: number, enabled: boolean) {
    setTogglingMarketingId(orderId);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/billing/marketing/${orderId}/auto-renew`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not update marketing renewal.");
      if (data.order) {
        setMarketingOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...data.order } : o)),
        );
      }
      setMessage(data.message);
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not update marketing renewal.");
    } finally {
      setTogglingMarketingId(null);
    }
  }

  const billingStats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid");
    const subscriptionPaid = paid.filter((i) => (i.category ?? "subscription") === "subscription");
    const marketingPaid = paid.filter((i) => i.category === "marketing");
    const totalPaid = paid.reduce((sum, i) => sum + (i.amount ?? 0), 0);
    const totalTax = paid.reduce((sum, i) => sum + (i.tax_amount ?? 0), 0);
    return {
      count: paid.length,
      subscriptionCount: subscriptionPaid.length,
      marketingCount: marketingPaid.length,
      totalPaid,
      totalTax,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (paymentFilter === "all") return invoices;
    return invoices.filter((inv) => (inv.category ?? "subscription") === paymentFilter);
  }, [invoices, paymentFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading billing…
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-4 overflow-x-hidden px-3 pb-10 sm:space-y-6 sm:px-0 sm:pb-12">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Billing</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your RCICMASTER subscription and marketing service payments in one place — clearly separated so nothing is missed.
          </p>
        </div>
        {sub && isActive && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Payments processed securely via Stripe
          </div>
        )}
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 break-words sm:px-4">
          {loadError}
        </div>
      )}

      {message && (
        <div
          className={cn(
            "rounded-lg border px-3 py-3 text-sm break-words sm:px-4",
            message.includes("Could not") || message.includes("failed")
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {message}
        </div>
      )}

      {/* Summary strip — only when there is billing activity */}
      {(sub || invoices.length > 0 || marketingOrders.length > 0) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border/80 bg-card px-3 py-3 sm:px-4 sm:py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Plan status</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">
              {sub ? (sub.is_trial ? "Free trial" : sub.package_name ?? "Subscription") : "No plan"}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card px-3 py-3 sm:px-4 sm:py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Payments recorded</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{billingStats.count}</p>
            {(billingStats.subscriptionCount > 0 || billingStats.marketingCount > 0) && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {billingStats.subscriptionCount} subscription
                {billingStats.marketingCount > 0 && ` · ${billingStats.marketingCount} marketing`}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border/80 bg-card px-3 py-3 sm:px-4 sm:py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total paid</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">
              {fmtMoney(billingStats.totalPaid, sub?.currency ?? "CAD")}
            </p>
            {billingStats.totalTax > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                incl. {fmtMoney(billingStats.totalTax)} tax
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border/80 bg-card px-3 py-3 sm:px-4 sm:py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Marketing services</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{marketingOrders.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Active paid orders</p>
          </div>
        </div>
      )}

      {/* Current subscription */}
      <Section
        title="Current subscription"
        description="Your plan, renewal date, and billing cycle."
        action={
          !sub ? (
            <Button asChild size="sm" className="h-9 w-full sm:h-8 sm:w-auto">
              <Link href="/dashboard/subscribe">View plans</Link>
            </Button>
          ) : undefined
        }
      >
        {!sub ? (
          <EmptyBlock
            icon={CreditCard}
            title="No active subscription"
            description="Choose a plan to unlock the full RCICMASTER consultant workspace — client management, documents, and marketing tools."
            action={
              <Button asChild className="h-10 w-full sm:w-auto">
                <Link href="/dashboard/subscribe">Browse subscription plans</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-lg font-semibold tracking-tight break-words">
                    {sub.package_name ?? "Consultant subscription"}
                  </h3>
                  <StatusBadge status={sub.status} cancelAtEnd={sub.cancel_at_period_end} />
                </div>
                {sub.package_description && (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {sub.package_description}
                  </p>
                )}
                <div className="flex items-baseline gap-1.5 pt-1">
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">
                    {sub.is_trial ? "Free trial" : fmtMoney(sub.price, sub.currency)}
                  </span>
                  {!sub.is_trial && sub.billing_cycle && (
                    <span className="text-sm text-muted-foreground">
                      / {sub.billing_cycle === "yearly" ? "year" : "month"}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid w-full grid-cols-1 gap-3 rounded-lg border border-border/60 bg-muted/15 p-4 sm:max-w-md sm:grid-cols-2 sm:gap-4">
                {sub.is_trial && sub.trial_ends_at && (
                  <MetaItem label="Trial ends" value={fmtDate(sub.trial_ends_at)} />
                )}
                {sub.status === "active" && sub.next_billing_at && !sub.is_trial && (
                  <MetaItem
                    label={sub.cancel_at_period_end ? "Access until" : "Next renewal"}
                    value={fmtDate(sub.next_billing_at)}
                  />
                )}
                {sub.starts_at && <MetaItem label="Started" value={fmtDate(sub.starts_at)} />}
                {sub.last_payment_at && (
                  <MetaItem label="Last payment" value={fmtDate(sub.last_payment_at)} />
                )}
                {sub.billing_cycle && (
                  <MetaItem
                    label="Billing cycle"
                    value={sub.billing_cycle === "yearly" ? "Annual" : "Monthly"}
                  />
                )}
              </div>
            </div>

            {sub.can_manage_auto_renew && (
              <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-4 sm:px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="auto-renew" className="text-sm font-medium cursor-pointer">
                        Automatic renewal
                      </Label>
                    </div>
                    <p className="max-w-xl text-xs leading-relaxed text-muted-foreground break-words">
                      {sub.auto_renew_enabled
                        ? `Your plan renews automatically on ${fmtDate(sub.next_billing_at)}. Tax is calculated using your billing address.`
                        : `Renewal is off. Access continues until ${fmtDate(sub.next_billing_at ?? sub.ends_at)} — no further charges.`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-2 rounded-md border border-border/50 bg-background/50 px-3 py-2 sm:justify-start sm:border-0 sm:bg-transparent sm:p-0">
                    {togglingAutoRenew && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                      id="auto-renew"
                      checked={sub.auto_renew_enabled ?? false}
                      disabled={togglingAutoRenew}
                      onCheckedChange={handleAutoRenewChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {sub.cancel_at_period_end && (
              <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Cancellation scheduled. You keep full access until{" "}
                  <strong>{fmtDate(sub.next_billing_at ?? sub.ends_at)}</strong>.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border/60 pt-5 sm:flex-row sm:flex-wrap">
              {!isActive && sub.status !== "trial" && (
                <Button asChild size="sm" className="h-10 w-full sm:w-auto">
                  <Link href="/dashboard/subscribe">Resubscribe</Link>
                </Button>
              )}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-full text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto"
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Cancel subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription className="break-words">
                        {sub.is_trial
                          ? "Your trial ends immediately and consultant features will be disabled."
                          : "You will not be charged again. Access continues until the end of the current billing period."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                      <AlertDialogCancel className="mt-0 h-9 w-full sm:w-auto">Keep subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={cancelSubscription}
                        disabled={cancelling}
                        className="h-9 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                      >
                        {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm cancellation"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Payments & services — tabbed */}
      <Section
        title="Payments & services"
        description="Marketing purchases and full payment history — choose the tab you need."
        action={
          <Button asChild variant="outline" size="sm" className="h-9 w-full sm:h-8 sm:w-auto">
            <Link href="/dashboard/marketing">
              Manage marketing
              <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="!h-auto mb-4 grid w-full grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1 sm:mb-5 sm:inline-flex sm:w-auto sm:gap-0.5 sm:border-transparent sm:bg-muted sm:p-[3px]">
            <TabsTrigger
              value="marketing"
              className={cn(
                "h-9 min-w-0 flex-none gap-1.5 rounded-sm px-2 text-xs font-medium shadow-none after:hidden",
                "w-full sm:w-auto sm:flex-initial sm:px-4 sm:text-sm",
                "border-0 data-[state=active]:border-0 data-[state=active]:bg-background data-[state=active]:shadow-none",
                "dark:data-[state=active]:border-0 dark:data-[state=active]:bg-background",
              )}
            >
              <Megaphone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Marketing</span>
              {marketingOrders.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 shrink-0 px-1.5 text-[10px] font-normal sm:ml-1.5">
                  {marketingOrders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className={cn(
                "h-9 min-w-0 flex-none gap-1.5 rounded-sm px-2 text-xs font-medium shadow-none after:hidden",
                "w-full sm:w-auto sm:flex-initial sm:px-4 sm:text-sm",
                "border-0 data-[state=active]:border-0 data-[state=active]:bg-background data-[state=active]:shadow-none",
                "dark:data-[state=active]:border-0 dark:data-[state=active]:bg-background",
              )}
            >
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">History</span>
              {invoices.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 shrink-0 px-1.5 text-[10px] font-normal sm:ml-1.5">
                  {invoices.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="marketing" className="mt-0">
            {marketingOrders.length === 0 ? (
              <EmptyBlock
                icon={Megaphone}
                title="No marketing purchases yet"
                description="Marketing payments are billed separately from your RCICMASTER subscription. Browse services on the Marketing page — completed payments also appear under Payment history."
                action={
                  <Button asChild variant="outline" size="sm" className="h-10 w-full sm:w-auto">
                    <Link href="/dashboard/marketing">Browse marketing services</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {marketingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 rounded-lg border border-violet-100 bg-violet-50/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Megaphone className="h-4 w-4 shrink-0 text-violet-600" />
                        <p className="font-medium break-words text-foreground">{order.service_name ?? "Marketing service"}</p>
                        <Badge variant="outline" className="border-violet-200 bg-white font-normal capitalize">
                          {order.status}
                        </Badge>
                        {order.is_recurring && (
                          <Badge variant="outline" className="font-normal">
                            Monthly
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Paid {fmtDate(order.paid_at)}
                        {order.province ? ` · ${order.province}` : ""}
                        {order.price_label ? ` · ${order.price_label}` : ""}
                      </p>
                    </div>
                    <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end sm:text-right">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total paid</p>
                        <p className="text-base font-semibold tabular-nums">{fmtMoney(order.total)}</p>
                        {order.tax_amount > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            incl. {fmtMoney(order.tax_amount)} tax
                          </p>
                        )}
                      </div>
                      {order.is_recurring && order.next_billing_at && (
                        <p className="text-[11px] text-muted-foreground">
                          {order.cancel_at_period_end ? "Access until" : "Next renewal"}: {fmtDate(order.next_billing_at)}
                        </p>
                      )}
                      {order.can_manage_auto_renew && (
                        <div className="flex w-full items-center justify-between gap-2 rounded-md border bg-white/80 px-2 py-1.5 sm:w-auto sm:justify-start">
                          {togglingMarketingId === order.id && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          )}
                          <Label htmlFor={`marketing-auto-${order.id}`} className="text-xs cursor-pointer">
                            Auto-renew
                          </Label>
                          <Switch
                            id={`marketing-auto-${order.id}`}
                            checked={order.auto_renew_enabled ?? false}
                            disabled={togglingMarketingId === order.id}
                            onCheckedChange={(v) => void handleMarketingAutoRenewChange(order.id, v)}
                          />
                        </div>
                      )}
                      {order.is_recurring && !order.cancel_at_period_end && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 w-full text-xs sm:h-8 sm:w-auto">
                              Cancel service
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel marketing service?</AlertDialogTitle>
                              <AlertDialogDescription className="break-words">
                                {order.service_name ?? "This service"} will stay active until the end of the current billing period. No further monthly charges after that.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                              <AlertDialogCancel className="mt-0 h-9 w-full sm:w-auto">Keep service</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => void cancelMarketingOrder(order.id)}
                                disabled={cancellingMarketingId === order.id}
                                className="h-9 w-full sm:w-auto"
                              >
                                {cancellingMarketingId === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Confirm cancellation"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {order.cancel_at_period_end && (
                        <p className="text-[11px] text-amber-800">Cancellation scheduled</p>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Marketing charges are not part of your RCICMASTER subscription. Manage renewals and new purchases on the{" "}
                  <Link href="/dashboard/marketing" className="font-medium text-foreground underline-offset-2 hover:underline">
                    Marketing page
                  </Link>
                  .
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {invoices.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
                {(
                  [
                    { key: "all", label: "All" },
                    { key: "subscription", label: "Subscription" },
                  { key: "marketing", label: "Marketing" },
                  { key: "storage", label: "Storage" },
                ] as const
                ).map(({ key, label }) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={paymentFilter === key ? "default" : "outline"}
                    className="h-9 w-full text-xs sm:h-8 sm:w-auto"
                    onClick={() => setPaymentFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}

            {invoices.length === 0 ? (
              <EmptyBlock
                icon={Receipt}
                title="No payments yet"
                description="Subscription and marketing payments appear here after your first charge. Subscription plans are on Subscribe; marketing services are on the Marketing page."
                action={
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
                    {!sub && (
                      <Button asChild variant="outline" size="sm" className="h-10 w-full sm:w-auto">
                        <Link href="/dashboard/subscribe">View subscription plans</Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm" className="h-10 w-full sm:w-auto">
                      <Link href="/dashboard/marketing">Browse marketing</Link>
                    </Button>
                  </div>
                }
              />
            ) : filteredInvoices.length === 0 ? (
              <EmptyBlock
                icon={Receipt}
                title={`No ${paymentFilter === "subscription" ? "subscription" : paymentFilter === "marketing" ? "marketing" : "storage"} payments`}
                description="Try another filter or check the Marketing services tab for active orders."
                action={
                  <Button type="button" variant="outline" size="sm" className="h-10 w-full sm:w-auto" onClick={() => setPaymentFilter("all")}>
                    Show all payments
                  </Button>
                }
              />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredInvoices.map((inv) => (
                    <div key={inv.id} className="rounded-lg border border-border/80 bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <CategoryBadge category={inv.category ?? "subscription"} />
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 font-normal capitalize",
                            inv.status === "paid"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "text-muted-foreground",
                          )}
                        >
                          {inv.status}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium break-all">
                          {inv.number ?? inv.id.slice(0, 12).toUpperCase()}
                        </p>
                        {inv.category === "marketing" && inv.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground break-words">{inv.description}</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {fmtDate(inv.paid_at ?? inv.created_at)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
                          <p className="font-medium tabular-nums">{fmtMoney(inv.subtotal ?? inv.amount, inv.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tax</p>
                          <p className="font-medium tabular-nums">
                            {inv.tax_applicable === false ? "—" : fmtMoney(inv.tax_amount ?? 0, inv.currency)}
                          </p>
                        </div>
                        <div className="col-span-2 border-t border-border/60 pt-2">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
                          <p className="text-base font-semibold tabular-nums">{fmtMoney(inv.amount, inv.currency)}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 w-full"
                        onClick={() => openPaymentDetail(inv)}
                      >
                        View details
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block md:-mx-6">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 sm:pl-6">Type</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-5 text-right sm:pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv) => (
                      <TableRow key={inv.id} className="group">
                        <TableCell className="pl-5 sm:pl-6">
                          <CategoryBadge category={inv.category ?? "subscription"} />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{inv.number ?? inv.id.slice(0, 12).toUpperCase()}</div>
                          {inv.category === "marketing" && inv.description && (
                            <div className="text-xs font-normal text-muted-foreground">{inv.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {fmtDate(inv.paid_at ?? inv.created_at)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {fmtMoney(inv.subtotal ?? inv.amount, inv.currency)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {inv.tax_applicable === false ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="tabular-nums">
                              <span>{fmtMoney(inv.tax_amount ?? 0, inv.currency)}</span>
                              {inv.tax_label && (
                                <span className="block text-[10px] text-muted-foreground">{inv.tax_label}</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {fmtMoney(inv.amount, inv.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-normal capitalize",
                              inv.status === "paid"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "text-muted-foreground",
                            )}
                          >
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-5 text-right sm:pr-6">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => openPaymentDetail(inv)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </Section>

      {/* Payment detail popup */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedInvoice(null);
            setDialogError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              Payment details
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : selectedInvoice ? (
            <div className="space-y-4">
              {dialogError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {dialogError}
                </div>
              )}

              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice</p>
                    <p className="font-semibold">
                      {selectedInvoice.number ?? selectedInvoice.id.slice(0, 14).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <CategoryBadge category={selectedInvoice.category ?? "subscription"} />
                    {selectedInvoice.payment_type && (
                      <Badge variant="outline" className="capitalize font-normal">
                        {selectedInvoice.payment_type}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize font-normal",
                        selectedInvoice.status === "paid" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                      )}
                    >
                      {selectedInvoice.status}
                    </Badge>
                  </div>
                </div>
                {selectedInvoice.package_name && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Package: </span>
                    {selectedInvoice.package_name.trim()}
                  </p>
                )}
                <p className="text-sm">
                  <span className="text-muted-foreground">Paid: </span>
                  {fmtDate(selectedInvoice.paid_at ?? selectedInvoice.created_at)}
                  {selectedInvoice.billing_cycle && (
                    <span className="text-muted-foreground"> · {selectedInvoice.billing_cycle}</span>
                  )}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">
                    {fmtMoney(selectedInvoice.subtotal ?? selectedInvoice.amount, selectedInvoice.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Tax{selectedInvoice.tax_label ? ` · ${selectedInvoice.tax_label}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {selectedInvoice.tax_applicable === false
                      ? "No tax"
                      : fmtMoney(selectedInvoice.tax_amount ?? 0, selectedInvoice.currency)}
                  </span>
                </div>
                {(selectedInvoice.gst_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-xs pl-2">
                    <span className="text-muted-foreground">GST portion</span>
                    <span className="tabular-nums">{fmtMoney(selectedInvoice.gst_amount!, selectedInvoice.currency)}</span>
                  </div>
                )}
                {(selectedInvoice.provincial_tax ?? 0) > 0 && (
                  <div className="flex justify-between text-xs pl-2">
                    <span className="text-muted-foreground">Provincial portion</span>
                    <span className="tabular-nums">{fmtMoney(selectedInvoice.provincial_tax!, selectedInvoice.currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total paid</span>
                  <span className="tabular-nums">{fmtMoney(selectedInvoice.amount, selectedInvoice.currency)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg border px-3 py-2.5 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Country</p>
                  <p className="font-medium mt-0.5">{selectedInvoice.country ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Province</p>
                  <p className="font-medium mt-0.5">{selectedInvoice.province ?? "—"}</p>
                </div>
              </div>

              {formatBillingAddress(selectedInvoice.billing_address).length > 0 && (
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">Billing address</p>
                  <div className="rounded-lg border bg-muted/10 px-3 py-2 space-y-0.5">
                    {formatBillingAddress(selectedInvoice.billing_address).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvoice.category === "marketing" && (
                <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-xs text-violet-900">
                  This is a marketing service payment — not your RCICMASTER platform subscription. Manage this service on the{" "}
                  <Link href="/dashboard/marketing" className="font-medium underline-offset-2 hover:underline">
                    Marketing page
                  </Link>
                  .
                </div>
              )}

              {selectedInvoice.status === "paid" && (
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Payment recorded successfully
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="h-9 w-full sm:w-auto" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            {selectedInvoice?.hosted_url && selectedInvoice.source === "stripe" && (
              <Button asChild variant="secondary" className="h-9 w-full sm:w-auto">
                <a href={selectedInvoice.hosted_url} target="_blank" rel="noreferrer">
                  View online
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {selectedInvoice &&
              (selectedInvoice.can_download ||
                selectedInvoice.invoice_pdf ||
                selectedInvoice.payment_record_id ||
                /^\d+$/.test(selectedInvoice.id)) && (
              <Button
                className="h-9 w-full sm:w-auto"
                disabled={downloadingId === selectedInvoice.id || detailLoading}
                onClick={() => handleDownloadInvoice(selectedInvoice)}
              >
                {downloadingId === selectedInvoice.id ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
