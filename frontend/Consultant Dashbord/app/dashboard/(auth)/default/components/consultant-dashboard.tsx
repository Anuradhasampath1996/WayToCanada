"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  SquareKanban,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsultantCalendarPanel } from "./consultant-calendar-panel";
import { DashboardNewsCompact } from "./dashboard-news-compact";
import { cn } from "@/lib/utils";
import { useThemeConfig } from "@/components/active-theme";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PipelineEntry = {
  profile_id: number;
  client_name: string;
  client_email: string;
  client_avatar?: string | null;
  status: string;
  immigration_pathway: string | null;
  agreement_signed_at: string | null;
  pending_docs: number;
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function MapleLeaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.2c.35 1.4.95 2.55 1.7 3.35.55-.7 1.15-1.25 1.75-1.55-.05 1.15.15 2.2.55 3.05 1.05-.35 1.9-.35 2.55 0-.55.85-1.05 1.85-1.35 2.9 1.2.15 2.15.55 2.8 1.15-.85.7-1.85 1.2-2.9 1.45.45 1.05.65 2.15.55 3.2-.7-.3-1.4-.4-2.05-.3.1 1.25.05 2.35-.2 3.25-.85-.55-1.55-1.35-2.05-2.3-.5.95-1.2 1.75-2.05 2.3-.25-.9-.3-2-.2-3.25-.65-.1-1.35 0-2.05.3-.1-1.05.1-2.15.55-3.2-1.05-.25-2.05-.75-2.9-1.45.65-.6 1.6-1 2.8-1.15-.3-1.05-.8-2.05-1.35-2.9.65-.35 1.5-.35 2.55 0 .4-.85.6-1.9.55-3.05.6.3 1.2.85 1.75 1.55.75-.8 1.35-1.95 1.7-3.35Z" />
    </svg>
  );
}

type ConsultantIdentity = {
  name: string;
  rcic_number: string | null;
  company_name: string | null;
  is_license_verified: boolean;
};

export function ConsultantDashboard() {
  const { theme } = useThemeConfig();
  const tintArtToTheme = theme.preset !== "default";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consultantName, setConsultantName] = useState("Consultant");
  const [identity, setIdentity] = useState<ConsultantIdentity | null>(null);
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [clientsTotal, setClientsTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pipelineRes, clientsRes, profileRes] = await Promise.all([
        fetch(`${API}/consultant/case-pipeline`, { headers: authHeaders() }),
        fetch(`${API}/consultant/clients?per_page=5`, { headers: authHeaders() }),
        fetch(`${API}/consultant/profile`, { headers: authHeaders() }),
      ]);

      const pipelineJson = await pipelineRes.json();
      const clientsJson = await clientsRes.json();
      const profileJson = await profileRes.json();

      if (!pipelineRes.ok) throw new Error(pipelineJson.message ?? "Failed to load pipeline.");
      if (!clientsRes.ok) throw new Error(clientsJson.message ?? "Failed to load clients.");
      if (!profileRes.ok) throw new Error(profileJson.message ?? "Failed to load profile.");

      setPipeline(pipelineJson.pipeline ?? []);
      setClientsTotal(clientsJson.total ?? clientsJson.data?.length ?? 0);
      setIdentity({
        name: profileJson.name ?? "Consultant",
        rcic_number: profileJson.rcic_number ?? null,
        company_name: profileJson.company_name ?? null,
        is_license_verified: Boolean(profileJson.is_license_verified),
      });
      if (profileJson.name) setConsultantName(profileJson.name);
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
    } catch {
      /* ignore */
    }
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const pendingDocs = pipeline.reduce((sum, p) => sum + (p.pending_docs ?? 0), 0);
    const activeCases = pipeline.length;
    const ready = pipeline.filter((p) => p.status === "READY_FOR_SUBMISSION").length;
    return { pendingDocs, activeCases, ready };
  }, [pipeline]);

  const retainerSignings = useMemo(
    () =>
      pipeline
        .filter((p) => p.agreement_signed_at)
        .map((p) => ({
          profile_id: p.profile_id,
          client_name: p.client_name,
          client_avatar: p.client_avatar ?? null,
          status: p.status,
          agreement_signed_at: p.agreement_signed_at!,
        })),
    [pipeline],
  );

  const firstName = consultantName.split(" ")[0] || "Consultant";

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-CA", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

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

  const kpiCards = [
    {
      label: "Total Clients",
      value: clientsTotal,
      hint: "In your practice",
      href: "/dashboard/clients",
      icon: Users,
      tone: "bg-primary/10 text-primary",
      image: "/kpi-clients.png",
      imagePos: "object-[72%_40%]",
    },
    {
      label: "Active Cases",
      value: stats.activeCases,
      hint: "In pipeline",
      href: "/dashboard/case-pipeline",
      icon: FileText,
      tone: "bg-primary/10 text-primary",
      image: "/kpi-cases.png",
      imagePos: "object-[70%_50%]",
    },
    {
      label: "Pending Documents",
      value: stats.pendingDocs,
      hint: "Awaiting review",
      href: "/dashboard/case-pipeline",
      icon: Clock3,
      tone: "bg-primary/10 text-primary",
      image: "/kpi-documents.png",
      imagePos: "object-[62%_48%]",
    },
    {
      label: "Ready to Submit",
      value: stats.ready,
      hint: "Package ready",
      href: "/dashboard/case-pipeline",
      icon: CheckCircle2,
      tone: "bg-primary/10 text-primary",
      image: "/kpi-submit.png",
      imagePos: "object-[75%_42%]",
    },
  ];

  return (
    <div className="space-y-6 pb-10">
      <section className="relative isolate overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[72%] sm:w-[65%]" aria-hidden>
          <img
            src="/canada-welcome-banner.png?v=3"
            alt=""
            className="h-full w-full object-cover object-[78%_45%] opacity-[0.97] sm:object-[82%_42%] dark:opacity-90"
          />
          {tintArtToTheme ? (
            <div className="absolute inset-0 bg-primary/20 mix-blend-soft-light opacity-80" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-l from-primary/10 via-transparent to-transparent" />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card from-[0%] via-card/94 via-[34%] to-transparent to-[72%]" />

        <div className="pointer-events-none absolute -right-3 -top-5 opacity-[0.12]">
          <MapleLeaf className="size-32 text-primary sm:size-40" />
        </div>

        <div className="relative z-10 flex flex-col gap-5 p-5 sm:gap-6 sm:p-6 md:flex-row md:items-start md:justify-between md:p-7">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-card/90 px-2.5 py-1 text-[11px] font-medium text-primary shadow-sm backdrop-blur-sm">
              <MapleLeaf className="size-3.5" />
              RCIC practice · Canada
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Welcome back, {firstName}!
              </h1>
              <p className="text-sm text-muted-foreground sm:text-[15px]">
                Your clients trust your guidance — lead every case with clarity today.
              </p>
            </div>

            <div className="space-y-1">
              {identity?.company_name?.trim() ? (
                <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {identity.company_name.trim()}
                </p>
              ) : null}

              {identity?.rcic_number ? (
                <p className="text-sm font-medium text-foreground/90 sm:text-[15px]">
                  {identity.is_license_verified ? "Verified RCIC" : "Licensed RCIC"}
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  <span className="font-semibold tracking-wide text-primary">
                    {identity.rcic_number}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Link href="/dashboard/account" className="font-medium text-primary hover:underline">
                    Add your RCIC license number
                  </Link>
                </p>
              )}

              <p className="text-xs font-medium text-muted-foreground/90 sm:text-[13px]">
                {todayLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:pt-1">
            <Button asChild>
              <Link href="/dashboard/clients/new">
                <UserPlus className="mr-1.5 size-4" />
                Add Client
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-primary/25 bg-card/90 backdrop-blur-sm hover:bg-primary/5">
              <Link href="/dashboard/case-pipeline">
                <SquareKanban className="mr-1.5 size-4" />
                Application Progress
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group">
            <Card className="relative h-full min-h-[148px] overflow-hidden border-border/60 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:min-h-[160px]">
              <div className="pointer-events-none absolute inset-y-0 right-0 w-[62%] sm:w-[64%]" aria-hidden>
                <img
                  src={`${stat.image}?v=5`}
                  alt=""
                  className={cn(
                    "h-full w-full object-cover object-right opacity-[0.96] transition-transform duration-500 group-hover:scale-[1.03] dark:opacity-90",
                    stat.imagePos,
                  )}
                />
                {tintArtToTheme ? (
                  <div className="absolute inset-0 bg-primary/25 mix-blend-soft-light opacity-80" />
                ) : null}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card from-[0%] via-card/94 via-[42%] to-transparent to-[78%]" />

              <CardContent className="relative z-10 flex h-full min-h-[148px] items-start gap-3 p-4 sm:min-h-[160px] sm:p-5">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm backdrop-blur-sm", stat.tone)}>
                  <stat.icon className="size-4" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{stat.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{stat.hint}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <ConsultantCalendarPanel retainerSignings={retainerSignings} />

      <DashboardNewsCompact />
    </div>
  );
}
