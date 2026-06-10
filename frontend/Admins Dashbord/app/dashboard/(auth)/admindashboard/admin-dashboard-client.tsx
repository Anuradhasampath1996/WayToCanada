"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Calculator,
  CreditCard,
  FolderDot,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type AdminStats = {
  users: {
    total: number;
    verified: number;
    unverified: number;
    by_role: {
      super_admin: number;
      admin: number;
      rcic: number;
      client: number;
    };
  };
  rcic_register: {
    total: number;
    active: number;
    inactive: number;
  };
};

type PaymentStats = {
  total_subscriptions: number;
  active: number;
  trials: number;
  total_revenue_cad: number;
};

const QUICK_LINKS = [
  {
    title: "Admin Users",
    description: "Manage portal administrators",
    href: "/admindashboard/users/admins",
    icon: Shield,
  },
  {
    title: "RCIC Users",
    description: "Licensed consultant accounts",
    href: "/admindashboard/users/rcic",
    icon: UserCheck,
  },
  {
    title: "Public Users",
    description: "Client accounts on the platform",
    href: "/admindashboard/users/public",
    icon: Users,
  },
  {
    title: "Payment Gateway",
    description: "Stripe and billing settings",
    href: "/admindashboard/payment-gateway",
    icon: CreditCard,
  },
  {
    title: "Subscription Packages",
    description: "Plans and pricing tiers",
    href: "/admindashboard/subscription-packages",
    icon: BadgeDollarSign,
  },
  {
    title: "Legislation Hub",
    description: "Acts, regulations, and sync",
    href: "/admindashboard/legislations-hub",
    icon: Scale,
  },
  {
    title: "Application Packages",
    description: "IRCC forms and document sets",
    href: "/admindashboard/application-packages",
    icon: FolderDot,
  },
  {
    title: "CRS Calculator Sync",
    description: "Express Entry score data",
    href: "/admindashboard/crs-calculator-sync",
    icon: Calculator,
  },
] as const;

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  const tones = {
    default: "border-border/60 bg-card",
    primary: "border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card",
    success: "border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 via-card to-card",
    warning: "border-amber-200/70 bg-gradient-to-br from-amber-500/10 via-card to-card",
  };
  const iconTones = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    success: "bg-emerald-500/15 text-emerald-700",
    warning: "bg-amber-500/15 text-amber-800",
  };

  return (
    <Card className={cn("shadow-sm", tones[tone])}>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", iconTones[tone])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function RoleRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AdminDashboardClient() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [payments, setPayments] = React.useState<PaymentStats | null>(null);
  const [adminName, setAdminName] = React.useState("Admin");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = adminAuthHeaders();
      const [statsRes, payRes] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers }),
        fetch(`${API}/admin/subscription-payments?per_page=1`, { headers }),
      ]);

      if (!statsRes.ok) {
        const j = await statsRes.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message ?? "Failed to load dashboard stats.");
      }

      setStats(await statsRes.json());
      if (payRes.ok) {
        const payJson = await payRes.json();
        setPayments(payJson.stats ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    try {
      const raw = localStorage.getItem("wtc_admin_user");
      if (raw) {
        const u = JSON.parse(raw) as { name?: string };
        if (u.name) setAdminName(u.name.split(" ")[0] ?? u.name);
      }
    } catch {
      /* ignore */
    }
  }, [load]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-destructive">{error || "Could not load dashboard."}</p>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="mr-2 size-4" />
          Try again
        </Button>
      </div>
    );
  }

  const roles = stats.users.by_role;
  const consultants = roles.rcic;
  const clients = roles.client;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm md:p-8">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <LayoutDashboard className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Admin Portal</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Welcome back, {adminName}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Platform overview for Way To Canada — users, consultants, subscriptions, and compliance tools.
            </p>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 rounded-xl bg-background/80" onClick={load}>
            <RefreshCw className="mr-2 size-4" />
            Refresh data
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={stats.users.total}
          hint={`${stats.users.verified} verified · ${stats.users.unverified} pending`}
          icon={Users}
          tone="primary"
        />
        <StatCard
          label="RCIC consultants"
          value={consultants}
          hint={`${clients} public client accounts`}
          icon={UserCheck}
        />
        <StatCard
          label="Active subscriptions"
          value={payments?.active ?? "—"}
          hint={
            payments
              ? `${payments.trials} on trial · ${payments.total_subscriptions} total`
              : "Subscription data unavailable"
          }
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="CICC register"
          value={stats.rcic_register.total}
          hint={`${stats.rcic_register.active} active · ${stats.rcic_register.inactive} inactive`}
          icon={Scale}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* User breakdown */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Users by role</CardTitle>
            <CardDescription>How accounts are distributed across the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RoleRow label="Public clients" count={clients} total={stats.users.total} />
            <RoleRow label="RCIC consultants" count={consultants} total={stats.users.total} />
            <RoleRow label="Admins" count={roles.admin + roles.super_admin} total={stats.users.total} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">Super admins: {roles.super_admin}</Badge>
              <Badge variant="outline">Admins: {roles.admin}</Badge>
              <Badge variant="outline">Unverified: {stats.users.unverified}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions & revenue */}
        <Card className="shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Subscriptions & revenue</CardTitle>
              <CardDescription>Consultant billing at a glance</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 rounded-lg" asChild>
              <Link href="/admindashboard/subscription-payments">
                View payments
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {payments ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Monthly revenue (est.)</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    ${payments.total_revenue_cad.toLocaleString(undefined, { maximumFractionDigits: 0 })} CAD
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Active plans</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{payments.active}</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Trial accounts</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{payments.trials}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Subscription statistics could not be loaded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Quick actions</h2>
          <p className="text-sm text-muted-foreground">Jump to common admin tasks</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <item.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
