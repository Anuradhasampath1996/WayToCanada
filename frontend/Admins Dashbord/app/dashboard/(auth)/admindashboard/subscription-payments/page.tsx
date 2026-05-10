"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  XCircle,
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

// ─────────────────────────────────────────────────────────────────────────────
const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Subscription = {
  id: number;
  status: "trial" | "active" | "expired" | "payment_declined" | "cancelled";
  is_trial: boolean;
  billing_cycle: "monthly" | "yearly" | null;
  starts_at: string | null;
  ends_at: string | null;
  trial_ends_at: string | null;
  last_payment_at: string | null;
  paypal_order_id: string | null;
  user: { id: number; name: string; email: string } | null;
  package: { id: number; name: string; monthly_price: number | null; yearly_price: number | null } | null;
};

type Meta = { current_page: number; last_page: number; per_page: number; total: number };
type Stats = { total_subscriptions: number; active: number; trials: number; total_revenue_cad: number };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<Subscription["status"], string> = {
  trial:            "Trial",
  active:           "Active",
  expired:          "Expired",
  payment_declined: "Declined",
  cancelled:        "Cancelled",
};

const STATUS_VARIANT: Record<Subscription["status"], "default" | "secondary" | "destructive" | "outline"> = {
  trial:            "secondary",
  active:           "default",
  expired:          "outline",
  payment_declined: "destructive",
  cancelled:        "outline",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtCAD(n: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 }).format(n);
}

function getPrice(sub: Subscription): string {
  if (!sub.package) return "—";
  const p = sub.billing_cycle === "yearly" ? sub.package.yearly_price : sub.package.monthly_price;
  return p != null ? fmtCAD(p) : "—";
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
  const [rows,    setRows]    = useState<Subscription[]>([]);
  const [meta,    setMeta]    = useState<Meta | null>(null);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cycleFilter,  setCycleFilter]  = useState("all");
  const [page,         setPage]         = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("wtc_admin_token");
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search)                       params.set("search", search);
      if (statusFilter !== "all")       params.set("status", statusFilter);
      if (cycleFilter  !== "all")       params.set("billing_cycle", cycleFilter);

      const res = await fetch(`${API}/admin/subscription-payments?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });

      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setRows(json.data ?? []);
      setMeta(json.meta ?? null);
      setStats(json.stats ?? null);
    } catch {
      // silent — could add toast here
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, cycleFilter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, cycleFilter]);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All consultant subscription records and PayPal payment history.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Users}           label="Total Subscriptions" value={stats.total_subscriptions} iconClass="text-blue-600" />
          <StatCard icon={CheckCircle2}    label="Active"              value={stats.active}              iconClass="text-emerald-600" />
          <StatCard icon={ShieldCheck}     label="On Trial"            value={stats.trials}              iconClass="text-amber-600" />
          <StatCard icon={BadgeDollarSign} label="Revenue (active)"    value={fmtCAD(stats.total_revenue_cad)} iconClass="text-purple-600" />
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="payment_declined">Declined</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={cycleFilter} onValueChange={setCycleFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Billing Cycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cycles</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Subscriptions
            {meta && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({meta.total} total)
              </span>
            )}
          </CardTitle>
          <CardDescription>One row per subscription record. Most recent first.</CardDescription>
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
              <p className="text-sm">No subscriptions found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Consultant</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="pr-6">PayPal Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="pl-6">
                      <div>
                        <p className="font-medium">{sub.user?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{sub.user?.email ?? ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>{sub.package?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{sub.billing_cycle ?? "—"}</TableCell>
                    <TableCell>{getPrice(sub)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[sub.status]}>
                        {STATUS_LABELS[sub.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{fmtDate(sub.starts_at)}</TableCell>
                    <TableCell>
                      {sub.is_trial ? fmtDate(sub.trial_ends_at) : fmtDate(sub.ends_at)}
                    </TableCell>
                    <TableCell className="pr-6">
                      {sub.paypal_order_id ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {sub.paypal_order_id.slice(0, 18)}…
                        </span>
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
    </div>
  );
}
