"use client";

import Link from "next/link";
import {
  ArrowRight, Briefcase, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Lock, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClientNextAction, JourneyStep, JourneyStepId } from "@/lib/client-journey";
import { JOURNEY_STEP_PAGES } from "@/lib/client-journey";

export function ClientJourneyBreadcrumb({
  stepId,
  pageLabel,
}: {
  stepId?: JourneyStepId;
  pageLabel?: string;
}) {
  const meta = stepId ? JOURNEY_STEP_PAGES[stepId] : null;
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/user-dashboard" className="font-medium transition-colors hover:text-foreground">
        Your journey
      </Link>
      {meta && (
        <>
          <ChevronRight className="size-3.5 shrink-0 opacity-50" />
          <span>Step {meta.step}</span>
        </>
      )}
      {(pageLabel ?? meta?.label) && (
        <>
          <ChevronRight className="size-3.5 shrink-0 opacity-50" />
          <span className="font-medium text-foreground">{pageLabel ?? meta?.label}</span>
        </>
      )}
    </nav>
  );
}

export function ClientJourneyPageChrome({
  stepId,
  title,
  description,
  children,
  extra,
}: {
  stepId: JourneyStepId;
  title?: string;
  description?: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const meta = JOURNEY_STEP_PAGES[stepId];
  return (
    <div className="w-full space-y-6 pb-10">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 h-8 rounded-lg text-muted-foreground" asChild>
          <Link href="/user-dashboard">
            <ChevronLeft className="mr-1 size-4" />
            Back to home
          </Link>
        </Button>
      </div>
      <ClientJourneyBreadcrumb stepId={stepId} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Step {meta.step} of 4
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{title ?? meta.title}</h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}

export function ClientNextActionCard({ action }: { action: ClientNextAction }) {
  const tones = {
    primary: "border-primary/25 bg-gradient-to-r from-primary/8 to-background",
    warning: "border-amber-200/70 bg-gradient-to-r from-amber-500/[0.08] to-background",
    info: "border-blue-200/70 bg-gradient-to-r from-blue-500/[0.06] to-background",
    success: "border-emerald-200/70 bg-gradient-to-r from-emerald-500/[0.08] to-background",
  };

  return (
    <div className={cn("rounded-2xl border p-5 shadow-sm", tones[action.tone])}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ArrowRight className="size-4 text-primary" />
            Your next step
          </p>
          <p className="text-base font-semibold tracking-tight">{action.title}</p>
          <p className="max-w-2xl text-sm text-muted-foreground">{action.description}</p>
        </div>
        {action.href && action.buttonLabel && (
          <Button asChild className="shrink-0 rounded-xl">
            <Link href={action.href}>{action.buttonLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function AssessmentWaitingCard() {
  return (
    <div className="rounded-xl border border-blue-200/70 bg-blue-500/[0.06] p-5">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 size-5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Consultant assessment in progress</p>
          <p className="mt-1 text-sm text-blue-800/90">
            Your questionnaire was submitted. Your consultant is reviewing your profile, calculating CRS scores,
            and selecting the best immigration pathway for you.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PathwayAssignedCard({
  pathway,
  caseFile,
}: {
  pathway: string;
  caseFile?: {
    pathway_assessment_at?: string | null;
    pathway_assessment_notes?: string | null;
    pathway_assessment_crs_score?: number | null;
    pathway_assessment_ircc_crs_score?: number | null;
    pathway_assessment_snapshot?: {
      principal_applicant?: "main" | "spouse";
      has_spouse?: boolean;
      comparison?: { recommendation?: string };
    } | null;
    agreement_sent_at?: string | null;
    agreement_signed_at?: string | null;
  } | null;
}) {
  const crs = caseFile?.pathway_assessment_crs_score;
  const irccCrs = caseFile?.pathway_assessment_ircc_crs_score;
  const notes = caseFile?.pathway_assessment_notes?.trim();
  const assessedAt = caseFile?.pathway_assessment_at;
  const principal = caseFile?.pathway_assessment_snapshot?.principal_applicant;
  const recommendation = caseFile?.pathway_assessment_snapshot?.comparison?.recommendation;

  const nextHint = caseFile?.agreement_signed_at
    ? "Continue with your application forms and document uploads."
    : caseFile?.agreement_sent_at
      ? "Your retainer agreement is ready — review and sign it to unlock the next steps."
      : "Your consultant is preparing your retainer agreement.";

  return (
    <div className="rounded-xl border border-emerald-200/70 bg-emerald-500/[0.06] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Briefcase className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-900">Your immigration pathway</p>
          <p className="mt-1 text-lg font-bold text-emerald-950">{pathway}</p>
          {assessedAt && (
            <p className="mt-1 text-xs text-emerald-800/80">
              Confirmed {new Date(assessedAt).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          )}
        </div>
        <Badge className="shrink-0 bg-emerald-600 text-white">Confirmed</Badge>
      </div>

      {(crs != null || irccCrs != null) && (
        <div className="flex flex-wrap gap-2">
          {crs != null && (
            <Badge variant="outline" className="border-emerald-300/60 bg-background/80 text-emerald-900">
              CRS score: {crs}
            </Badge>
          )}
          {irccCrs != null && irccCrs !== crs && (
            <Badge variant="outline" className="border-emerald-300/60 bg-background/80 text-emerald-900">
              IRCC CRS: {irccCrs}
            </Badge>
          )}
          {principal === "spouse" && (
            <Badge variant="outline" className="border-emerald-300/60 bg-background/80 text-emerald-900">
              Principal applicant: Spouse
            </Badge>
          )}
        </div>
      )}

      {recommendation && (
        <p className="text-sm text-emerald-900/90 rounded-lg border border-emerald-200/50 bg-background/60 px-3 py-2">
          {recommendation}
        </p>
      )}

      {notes && (
        <div className="rounded-lg border border-emerald-200/40 bg-background/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/70">Consultant notes</p>
          <p className="mt-1 text-sm text-emerald-950/90 whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      <p className="text-sm text-emerald-800/90">{nextHint}</p>

      <p className="text-[10px] leading-relaxed text-emerald-800/60">
        Scores and pathway details are for planning only — not legal advice or a guarantee of selection.
      </p>
    </div>
  );
}

export function ClientLockedPage({ step }: { step: JourneyStep | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center max-w-md mx-auto">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Lock className="size-7 text-muted-foreground/50" />
      </div>
      {step && (
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Step {step.number} of 4
        </p>
      )}
      <h2 className="text-xl font-bold">{step?.title ?? "Not available yet"}</h2>
      <p className="text-sm text-muted-foreground">
        {step?.lockedReason ?? "Complete the previous steps in your journey first."}
      </p>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <Button asChild>
          <Link href="/user-dashboard">Back to home</Link>
        </Button>
        {step?.id === "questionnaire" && (
          <Button variant="outline" asChild>
            <Link href="/user-dashboard/questionnaire">Go to questionnaire</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function FormsProgressStrip({
  submitted,
  total,
  reviewed,
}: {
  submitted: number;
  total: number;
  reviewed: number;
}) {
  if (total === 0) return null;
  const pct = Math.round((submitted / total) * 100);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">Application forms</span>
        <span className="text-muted-foreground tabular-nums">{submitted}/{total} submitted</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      {submitted === total && reviewed < total && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
          <Clock className="size-3.5" />
          Consultant reviewing {reviewed}/{total} forms
        </p>
      )}
      {reviewed === total && total > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          All forms verified
        </p>
      )}
    </div>
  );
}

export function ClientActivityTimeline({
  events,
}: {
  events: { id: string; label: string; at: string | null; done: boolean }[];
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Your milestones
      </p>
      <ul className="space-y-0">
        {events.map((ev, i) => (
          <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < events.length - 1 && (
              <span className={cn("absolute left-[15px] top-8 bottom-0 w-px", ev.done ? "bg-emerald-200" : "bg-border")} />
            )}
            <div
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg",
                ev.done ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground",
              )}
            >
              {ev.done ? <CheckCircle2 className="size-4" /> : <Clock className="size-3.5" />}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn("text-sm font-medium", ev.done ? "text-foreground" : "text-muted-foreground")}>
                {ev.label}
              </p>
              {ev.at && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(ev.at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
