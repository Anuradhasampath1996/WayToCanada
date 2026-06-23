"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminAuthHeaders, getAdminToken } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PaymentRecord = {
  id: number;
  payment_type: string;
  billing_cycle: string | null;
  invoice_number: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  tax_label: string | null;
  tax_type?: string | null;
  province: string | null;
  country: string;
  tax_applicable: boolean;
  gst_amount?: number | null;
  provincial_tax?: number | null;
  total_rate_pct?: number | null;
  billing_address?: Record<string, string> | null;
  paid_at: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  invoice_download?: string | null;
  can_download?: boolean;
  stripe_invoice_id?: string | null;
  subscription_status?: string | null;
  user: { id: number; name: string; email: string } | null;
  package_name: string | null;
};

type Meta = { current_page: number; last_page: number; per_page: number; total: number };
type Stats = { total_payments: number; total_collected_cad: number; total_tax_cad: number; active_subscriptions: number };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtCAD(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(n);
}

async function downloadInvoicePdf(record: PaymentRecord) {
  const url =
    record.invoice_download ??
    `${API}/admin/subscription-payments/${record.id}/invoice`;

  if (record.invoice_pdf?.startsWith("http")) {
    window.open(record.invoice_pdf, "_blank", "noopener,noreferrer");
    return;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getAdminToken()}`,
      Accept: "application/pdf",
    },
  });

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
  const filename = match?.[1] ?? `invoice-${record.invoice_number ?? record.id}.pdf`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function formatBillingAddress(addr: Record<string, string> | null | undefined): string[] {
  if (!addr) return [];
  return [
    addr.line1,
    addr.line2,
    [addr.city, addr.province, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ].filter(Boolean) as string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card (reusable)
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, iconClass }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconClass?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted ${iconClass ?? ""}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function SubscriptionPaymentsPage() {
  const [rows,    setRows]    = useState<PaymentRecord[]>([]);
  const [meta,    setMeta]    = useState<Meta | null>(null);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<PaymentRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [search,       setSearch]       = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page,         setPage]         = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search) params.set("search", search);
      if (typeFilter !== "all") params.set("payment_type", typeFilter);
      if (categoryFilter !== "all") params.set("payment_category", categoryFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`${API}/admin/subscription-payments?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load payments");
      setRows(json.data ?? []);
      setMeta(json.meta ?? null);
      setStats(json.stats ?? null);
    } catch (e: unknown) {
      setRows([]);
      setMeta(null);
      setStats(null);
      setError(e instanceof Error ? e.message : "Could not load subscription payments.");
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, categoryFilter, dateFrom, dateTo]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search, typeFilter, categoryFilter, dateFrom, dateTo]);

  async function exportCsv() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter !== "all") params.set("payment_type", typeFilter);
    if (categoryFilter !== "all") params.set("payment_category", categoryFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);

    const res = await fetch(`${API}/admin/subscription-payments/export?${params}`, {
      headers: { Authorization: `Bearer ${getAdminToken()}`, Accept: "text/csv" },
    });
    if (!res.ok) {
      setError("Export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscription-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openPaymentDetail(row: PaymentRecord) {
    setDialogOpen(true);
    setSelected(row);
    setDialogError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/admin/subscription-payments/${row.id}`, {
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not load payment details");
      setSelected(json.data);
    } catch (e: unknown) {
      setDialogError(e instanceof Error ? e.message : "Could not load payment details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!selected) return;
    setDownloading(true);
    setDialogError(null);
    try {
      await downloadInvoicePdf(selected);
    } catch (e: unknown) {
      setDialogError(e instanceof Error ? e.message : "Invoice download failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All consultant subscription payments with Canadian tax breakdown.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={loading}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users} label="Total payments" value={stats.total_payments} iconClass="text-blue-600" />
          <StatCard icon={CheckCircle2} label="Active subscriptions" value={stats.active_subscriptions} iconClass="text-emerald-600" />
          <StatCard icon={BadgeDollarSign} label="Collected" value={fmtCAD(stats.total_collected_cad)} iconClass="text-purple-600" />
          <StatCard icon={ShieldCheck} label="Tax collected" value={fmtCAD(stats.total_tax_cad)} iconClass="text-amber-600" />
        </div>
      )}

      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Payment type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="initial">Initial</SelectItem>
              <SelectItem value="renewal">Auto-renewal</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="subscription">Subscription</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="storage">Storage</SelectItem>
            </SelectContent>
          </Select>

          <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Payments
            {meta && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({meta.total} total)
              </span>
            )}
          </CardTitle>
          <CardDescription>Each row is a subscription payment with tax details. Click View for full breakdown.</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <CreditCard className="h-10 w-10 opacity-30" />
              <p className="text-sm">No payments found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Consultant</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Province</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6">
                      <div>
                        <p className="font-medium">{row.user?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{row.user?.email ?? ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>{row.package_name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{row.payment_type}</TableCell>
                    <TableCell>{fmtCAD(row.subtotal)}</TableCell>
                    <TableCell>
                      {row.tax_applicable ? (
                        <div>
                          <span>{fmtCAD(row.tax_amount)}</span>
                          {row.tax_label && <p className="text-[10px] text-muted-foreground">{row.tax_label}</p>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No tax</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{fmtCAD(row.total)}</TableCell>
                    <TableCell>{row.province ?? (row.country !== "CA" ? row.country : "—")}</TableCell>
                    <TableCell>{fmtDate(row.paid_at)}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button size="sm" variant="outline" onClick={() => openPaymentDetail(row)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* ── Pagination ── */}
        {meta && meta.last_page > 1 && (
          <>
            <Separator />
            <div className="flex items-center justify-between px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Page {meta.current_page} of {meta.last_page}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.current_page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.current_page >= meta.last_page || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setSelected(null);
          setDialogError(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Payment details
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : selected ? (
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
                    <p className="font-semibold">{selected.invoice_number ?? `#${selected.id}`}</p>
                  </div>
                  <Badge variant="outline" className="capitalize shrink-0">
                    {selected.payment_type}
                  </Badge>
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">Consultant: </span>
                  {selected.user?.name ?? "—"}
                  {selected.user?.email && (
                    <span className="block text-xs text-muted-foreground mt-0.5">{selected.user.email}</span>
                  )}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Package: </span>
                  {selected.package_name?.trim() ?? "—"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Paid: </span>
                  {fmtDate(selected.paid_at)}
                  {selected.billing_cycle && (
                    <span className="text-muted-foreground"> · {selected.billing_cycle}</span>
                  )}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmtCAD(selected.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Tax{selected.tax_label ? ` · ${selected.tax_label}` : ""}
                  </span>
                  <span>
                    {selected.tax_applicable ? fmtCAD(selected.tax_amount) : "No tax"}
                  </span>
                </div>
                {(selected.gst_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-xs pl-2">
                    <span className="text-muted-foreground">GST portion</span>
                    <span>{fmtCAD(selected.gst_amount!)}</span>
                  </div>
                )}
                {(selected.provincial_tax ?? 0) > 0 && (
                  <div className="flex justify-between text-xs pl-2">
                    <span className="text-muted-foreground">Provincial portion</span>
                    <span>{fmtCAD(selected.provincial_tax!)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total paid</span>
                  <span>{fmtCAD(selected.total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg border px-3 py-2.5 text-xs">
                <div>
                  <p className="text-muted-foreground">Country</p>
                  <p className="font-medium mt-0.5">{selected.country}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Province</p>
                  <p className="font-medium mt-0.5">{selected.province ?? "—"}</p>
                </div>
              </div>

              {formatBillingAddress(selected.billing_address).length > 0 && (
                <div className="text-xs">
                  <p className="text-muted-foreground mb-1">Billing address</p>
                  <div className="rounded-lg border bg-muted/10 px-3 py-2 space-y-0.5">
                    {formatBillingAddress(selected.billing_address).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              )}

              {selected.subscription_status && (
                <p className="text-xs text-muted-foreground">
                  Subscription status:{" "}
                  <Badge variant="outline" className={cn("ml-1 capitalize font-normal")}>
                    {selected.subscription_status}
                  </Badge>
                </p>
              )}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            {selected?.hosted_invoice_url && (
              <Button variant="secondary" asChild>
                <a href={selected.hosted_invoice_url} target="_blank" rel="noreferrer">
                  Stripe invoice
                </a>
              </Button>
            )}
            {selected && (
              <Button onClick={handleDownloadInvoice} disabled={downloading || detailLoading}>
                {downloading ? (
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
