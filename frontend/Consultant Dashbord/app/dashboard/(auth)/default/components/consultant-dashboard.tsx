"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Scale,
  SquareKanban,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardNewsCompact } from "./dashboard-news-compact";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PipelineEntry = {
  profile_id: number;
  client_name: string;
  client_email: string;
  status: string;
  immigration_pathway: string | null;
  agreement_signed_at: string | null;
  pending_docs: number;
};

type ClientRow = {
  id: number;
  created_at: string;
  immigration_pathway: string | null;
  user: { name: string; email: string };
};

const PIPELINE_LABELS: Record<string, string> = {
  AGREEMENT_SIGNED: "Retainer signed",
  DOCUMENTS_UPLOADING: "Docs uploading",
  UNDER_REVIEW: "Under review",
  READY_FOR_SUBMISSION: "Ready to submit",
  APPLICATION_SUBMITTED: "Submitted",
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function ConsultantDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consultantName, setConsultantName] = useState("Consultant");
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [recentClients, setRecentClients] = useState<ClientRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pipelineRes, clientsRes] = await Promise.all([
        fetch(`${API}/consultant/case-pipeline`, { headers: authHeaders() }),
        fetch(`${API}/consultant/clients?per_page=5`, { headers: authHeaders() }),
      ]);

      const pipelineJson = await pipelineRes.json();
      const clientsJson = await clientsRes.json();

      if (!pipelineRes.ok) throw new Error(pipelineJson.message ?? "Failed to load pipeline.");
      if (!clientsRes.ok) throw new Error(clientsJson.message ?? "Failed to load clients.");

      setPipeline(pipelineJson.pipeline ?? []);
      setClientsTotal(clientsJson.total ?? clientsJson.data?.length ?? 0);
      setRecentClients(clientsJson.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wtc_consultant_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) setConsultantName(parsed.name);
      }
    } catch {}
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const pendingDocs = pipeline.reduce((sum, p) => sum + (p.pending_docs ?? 0), 0);
    const activeCases = pipeline.length;
    const ready = pipeline.filter((p) => p.status === "READY_FOR_SUBMISSION").length;
    const review = pipeline.filter((p) => p.status === "UNDER_REVIEW").length;
    return { pendingDocs, activeCases, ready, review };
  }, [pipeline]);

  const eventDates = useMemo(
    () =>
      pipeline
        .filter((p) => p.agreement_signed_at)
        .map((p) => new Date(p.agreement_signed_at!)),
    [pipeline],
  );

  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return [];
    return pipeline.filter((p) => p.agreement_signed_at && sameDay(new Date(p.agreement_signed_at), selectedDate));
  }, [pipeline, selectedDate]);

  const actionItems = useMemo(
    () => pipeline.filter((p) => p.pending_docs > 0).slice(0, 5),
    [pipeline],
  );

  const todayLabel = new Date().toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {todayLabel}
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Welcome back, {consultantName.split(" ")[0]}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Your practice at a glance — clients, case progress, deadlines, and IRCC updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/clients/new">
              <UserPlus className="mr-1.5 size-4" />
              Add client
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/case-pipeline">
              <SquareKanban className="mr-1.5 size-4" />
              Application progress
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total clients", value: clientsTotal, icon: Users, href: "/dashboard/clients" },
          { label: "Active cases", value: stats.activeCases, icon: FileText, href: "/dashboard/case-pipeline" },
          { label: "Pending documents", value: stats.pendingDocs, icon: Clock3, href: "/dashboard/case-pipeline" },
          { label: "Ready to submit", value: stats.ready, icon: CheckCircle2, href: "/dashboard/case-pipeline" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="group">
            <Card className="border-border/70 shadow-sm transition-all hover:border-primary/25 hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <stat.icon className="size-4" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {/* Main grid */}
      <section className="grid gap-4 xl:grid-cols-12">
        {/* Calendar */}
        <Card className="border-border/70 shadow-sm xl:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" />
              Calendar
            </CardTitle>
            <CardDescription>Retainer sign dates and daily case activity</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[auto_1fr]">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-xl border bg-muted/20 p-2"
              modifiers={{ event: eventDates }}
              modifiersClassNames={{ event: "bg-primary/15 font-semibold text-primary" }}
            />
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {selectedDate
                    ? selectedDate.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })
                    : "Selected day"}
                </p>
                {selectedDayItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No retainer signings on this date.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedDayItems.map((item) => (
                      <li key={item.profile_id}>
                        <Link
                          href={`/dashboard/clients/${item.profile_id}/workspace`}
                          className="block rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className="font-medium">{item.client_name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Retainer signed · {PIPELINE_LABELS[item.status] ?? item.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Needs attention
                </p>
                {actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending document reviews.</p>
                ) : (
                  <ul className="space-y-2">
                    {actionItems.map((item) => (
                      <li key={item.profile_id}>
                        <Link
                          href={`/dashboard/clients/${item.profile_id}/workspace/case-management`}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
                        >
                          <span className="truncate font-medium">{item.client_name}</span>
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {item.pending_docs} docs
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions + pipeline */}
        <div className="space-y-4 xl:col-span-3">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                { title: "All clients", href: "/dashboard/clients", icon: Users },
                { title: "Add new client", href: "/dashboard/clients/new", icon: UserPlus },
                { title: "Legislations hub", href: "/dashboard/legislations", icon: Scale },
                { title: "Application progress board", href: "/dashboard/case-pipeline", icon: SquareKanban },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-colors hover:border-primary/25 hover:bg-primary/5"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <action.icon className="size-4 text-primary" />
                    {action.title}
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pipeline snapshot</CardTitle>
              <CardDescription>Cases by current stage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {Object.entries(PIPELINE_LABELS).map(([status, label]) => {
                const count = pipeline.filter((p) => p.status === status).length;
                const pct = pipeline.length ? Math.round((count / pipeline.length) * 100) : 0;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* News compact */}
        <div className="xl:col-span-4">
          <DashboardNewsCompact />
        </div>
      </section>

      {/* Recent clients */}
      <section>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">Recent clients</CardTitle>
              <CardDescription>Latest profiles added to your practice</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/clients">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentClients.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
                <Users className="size-8 opacity-30" />
                <p>No clients yet. Add your first client to get started.</p>
                <Button asChild size="sm">
                  <Link href="/dashboard/clients/new">Add client</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {recentClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/dashboard/clients/${client.id}`}
                    className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{client.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{client.user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {client.immigration_pathway && (
                        <Badge variant="outline" className="text-[10px]">
                          {client.immigration_pathway}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{fmtDate(client.created_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
