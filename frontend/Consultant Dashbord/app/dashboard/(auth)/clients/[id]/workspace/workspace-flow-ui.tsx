"use client";

import Link from "next/link";
import {
  ArrowRight, Briefcase, Calculator, CheckCircle2, ChevronRight,
  ClipboardList, Clock, FileText, FormInput, MessageSquare, RotateCcw, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { QuestionnaireWorkspaceStats } from "@/lib/questionnaire-workspace-stats";

// ── Breadcrumb ────────────────────────────────────────────────────────────────

export function WorkspaceBreadcrumb({
  profileId,
  workspaceStep,
  pageLabel,
}: {
  profileId: string;
  workspaceStep?: number;
  pageLabel: string;
}) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:mb-4 sm:text-sm">
      <Link
        href={`/dashboard/clients/${profileId}/workspace`}
        className="font-medium transition-colors hover:text-foreground"
      >
        Case workspace
      </Link>
      {workspaceStep != null && (
        <>
          <ChevronRight className="size-3.5 shrink-0 opacity-50" />
          <span>Step {workspaceStep}</span>
        </>
      )}
      <ChevronRight className="size-3.5 shrink-0 opacity-50" />
      <span className="font-medium text-foreground">{pageLabel}</span>
    </nav>
  );
}

// ── Next action ───────────────────────────────────────────────────────────────

export interface NextAction {
  tone: "primary" | "warning" | "info" | "success";
  title: string;
  description: string;
  href?: string;
  buttonLabel?: string;
}

export function resolveNextAction(
  profileId: string,
  caseFile: {
    immigration_pathway: string | null;
    agreement_sent_at: string | null;
    agreement_signed_at: string | null;
    pathway_assessment_at?: string | null;
  },
  qStats: QuestionnaireWorkspaceStats,
  verification: {
    total_forms: number;
    submitted_count: number;
    reviewed_count: number;
    all_submitted: boolean;
    all_reviewed: boolean;
    case_management_unlocked: boolean;
  } | null,
): NextAction {
  const base = `/dashboard/clients/${profileId}/workspace`;

  if (qStats.pendingRefills > 0) {
    return {
      tone: "warning",
      title: `${qStats.pendingRefills} refill request${qStats.pendingRefills === 1 ? "" : "s"} pending`,
      description: "The client needs to correct questionnaire fields you flagged. Review their updates when ready.",
      href: `${base}/questionnaire-review`,
      buttonLabel: "Open questionnaire review",
    };
  }

  if (!qStats.hasSubmission || !qStats.isSubmitted) {
    return {
      tone: "warning",
      title: "Waiting for client questionnaire",
      description: qStats.hasMainProfile
        ? "The client started their profile but has not submitted it yet. You can review partial answers or fill gaps on their behalf."
        : "Ask the client to complete and submit their immigration questionnaire before pathway assessment.",
      href: `${base}/questionnaire-review`,
      buttonLabel: "Open questionnaire review",
    };
  }

  if (qStats.verifiedCount < 5) {
    return {
      tone: "info",
      title: "Review client questionnaire",
      description: `Only ${qStats.verifiedCount} field${qStats.verifiedCount === 1 ? "" : "s"} verified so far. Verify identity documents and key answers before assigning a pathway.`,
      href: `${base}/questionnaire-review`,
      buttonLabel: "Verify questionnaire",
    };
  }

  if (!caseFile.immigration_pathway) {
    return {
      tone: "primary",
      title: "Assign immigration pathway",
      description: "Questionnaire is in good shape. Score the profile, compare routes, and assign the best pathway for this client.",
      href: `${base}/pathway-calculator`,
      buttonLabel: "Open pathway calculator",
    };
  }

  if (!caseFile.agreement_sent_at) {
    return {
      tone: "primary",
      title: "Create retainer agreement",
      description: `${caseFile.immigration_pathway} is assigned. Build and send the retainer agreement for the client to sign.`,
      href: `${base}/retainer-agreement`,
      buttonLabel: "Create agreement",
    };
  }

  if (!caseFile.agreement_signed_at) {
    return {
      tone: "warning",
      title: "Awaiting client signature",
      description: `Agreement sent on ${caseFile.agreement_sent_at ? new Date(caseFile.agreement_sent_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "—"}. Follow up if the client has not signed yet.`,
      href: `${base}/retainer-agreement`,
      buttonLabel: "Manage agreement",
    };
  }

  if (verification && verification.total_forms > 0) {
    if (!verification.all_submitted) {
      return {
        tone: "warning",
        title: "Waiting for application forms",
        description: `${verification.submitted_count}/${verification.total_forms} forms submitted by the client. They can complete these in their portal.`,
      };
    }
    if (!verification.all_reviewed) {
      return {
        tone: "info",
        title: "Review client application forms",
        description: "All forms are submitted. Mark each form as reviewed to unlock full case management.",
        href: base,
        buttonLabel: "Review forms on workspace",
      };
    }
  }

  if (verification?.case_management_unlocked) {
    return {
      tone: "success",
      title: "Case hub is ready",
      description: "Assessment, agreement, and form review are complete. Manage documents, pipeline, and client communication in the case hub.",
      href: `${base}/case-management`,
      buttonLabel: "Open case hub",
    };
  }

  return {
    tone: "info",
    title: "Continue case workflow",
    description: "Work through the steps below to move this client toward submission.",
    href: base,
    buttonLabel: "View workspace",
  };
}

export function NextActionCard({ action }: { action: NextAction }) {
  const tones = {
    primary: "border-violet-200/70 bg-gradient-to-r from-violet-500/[0.08] to-background",
    warning: "border-amber-200/70 bg-gradient-to-r from-amber-500/[0.08] to-background",
    info: "border-blue-200/70 bg-gradient-to-r from-blue-500/[0.06] to-background",
    success: "border-emerald-200/70 bg-gradient-to-r from-emerald-500/[0.08] to-background",
  };

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm sm:p-5", tones[action.tone])}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ArrowRight className="size-4 shrink-0 text-primary" />
            Next action
          </p>
          <p className="text-base font-semibold tracking-tight break-words">{action.title}</p>
          <p className="max-w-2xl text-sm text-muted-foreground">{action.description}</p>
        </div>
        {action.href && action.buttonLabel && (
          <Button asChild className="h-10 w-full shrink-0 rounded-xl sm:w-auto">
            <Link href={action.href}>{action.buttonLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Assessment sub-progress (Step 1) ──────────────────────────────────────────

export function AssessmentSubProgress({
  profileId,
  qStats,
  pathwayAssigned,
  crsScore,
}: {
  profileId: string;
  qStats: QuestionnaireWorkspaceStats;
  pathwayAssigned: string | null;
  crsScore?: number | null;
}) {
  const base = `/dashboard/clients/${profileId}/workspace`;

  const steps = [
    {
      id: "questionnaire",
      label: "Client questionnaire",
      done: qStats.isSubmitted,
      detail: !qStats.hasSubmission
        ? "Not started"
        : qStats.isSubmitted
          ? `Submitted${qStats.submittedAt ? ` · ${new Date(qStats.submittedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}` : ""}`
          : "Draft in progress",
      href: `${base}/questionnaire-review`,
      warn: qStats.pendingRefills > 0,
      warnText: `${qStats.pendingRefills} refill pending`,
    },
    {
      id: "review",
      label: "Consultant verification",
      done: qStats.verifiedCount >= 8,
      detail: qStats.verifiedCount > 0 ? `${qStats.verifiedCount} fields verified` : "Not started",
      href: `${base}/questionnaire-review`,
    },
    {
      id: "score",
      label: "CRS & pathway scoring",
      done: crsScore != null || Boolean(pathwayAssigned),
      detail: crsScore != null ? `CRS ${crsScore}` : "Open calculator",
      href: `${base}/pathway-calculator`,
    },
    {
      id: "assign",
      label: "Pathway assigned",
      done: Boolean(pathwayAssigned),
      detail: pathwayAssigned ?? "Pending",
      href: `${base}/pathway-calculator`,
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-border/70 bg-muted/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assessment checklist
        </p>
        <Badge variant="outline" className="h-6 rounded-md text-[10px]">
          {completed}/{steps.length} complete
        </Badge>
      </div>
          <div className="grid gap-px bg-border/40 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={cn(
              "flex flex-col gap-1 bg-card px-4 py-3 transition-colors hover:bg-muted/20",
              s.done && "bg-emerald-500/[0.04]",
            )}
          >
            <div className="flex items-center gap-2">
              {s.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-[9px] font-bold text-muted-foreground">
                  ·
                </span>
              )}
              <span className="text-xs font-semibold">{s.label}</span>
            </div>
            <p className="pl-6 text-[11px] text-muted-foreground">{s.detail}</p>
            {s.warn && s.warnText && (
              <p className="pl-6 text-[11px] font-medium text-amber-700">{s.warnText}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Client activity timeline ───────────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  label: string;
  at: string | null;
  done: boolean;
  icon: React.ElementType;
}

export function buildClientActivity(
  qStats: QuestionnaireWorkspaceStats,
  caseFile: {
    immigration_pathway: string | null;
    agreement_sent_at: string | null;
    agreement_signed_at: string | null;
    pathway_assessment_at?: string | null;
    application_forms_verified_at?: string | null;
  },
  verification: { case_management_unlocked: boolean; reviewed_count: number; total_forms: number } | null,
): ActivityEvent[] {
  return [
    {
      id: "questionnaire",
      label: qStats.isSubmitted ? "Questionnaire submitted" : "Questionnaire in progress",
      at: qStats.submittedAt,
      done: qStats.isSubmitted,
      icon: ClipboardList,
    },
    {
      id: "verified",
      label: qStats.verifiedCount > 0 ? `${qStats.verifiedCount} fields verified` : "Consultant review pending",
      at: null,
      done: qStats.verifiedCount >= 8,
      icon: UserCheck,
    },
    {
      id: "pathway",
      label: caseFile.immigration_pathway ? `Pathway: ${caseFile.immigration_pathway}` : "Pathway not assigned",
      at: caseFile.pathway_assessment_at ?? null,
      done: Boolean(caseFile.immigration_pathway),
      icon: Briefcase,
    },
    {
      id: "agreement-sent",
      label: "Retainer agreement sent",
      at: caseFile.agreement_sent_at,
      done: Boolean(caseFile.agreement_sent_at),
      icon: FileText,
    },
    {
      id: "agreement-signed",
      label: "Agreement signed by client",
      at: caseFile.agreement_signed_at,
      done: Boolean(caseFile.agreement_signed_at),
      icon: CheckCircle2,
    },
    {
      id: "forms",
      label:
        verification && verification.total_forms > 0
          ? `Forms reviewed ${verification.reviewed_count}/${verification.total_forms}`
          : "Application forms",
      at: caseFile.application_forms_verified_at ?? null,
      done: Boolean(caseFile.application_forms_verified_at),
      icon: FormInput,
    },
    {
      id: "hub",
      label: "Case management hub active",
      at: caseFile.application_forms_verified_at ?? null,
      done: Boolean(verification?.case_management_unlocked),
      icon: Calculator,
    },
  ];
}

function fmtActivityDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export function ClientActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-base">Client journey</CardTitle>
        <CardDescription>Key milestones for this case</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ul className="space-y-0">
          {events.map((ev, i) => {
            const Icon = ev.icon;
            const date = fmtActivityDate(ev.at);
            return (
              <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < events.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-[15px] top-8 bottom-0 w-px",
                      ev.done ? "bg-emerald-200" : "bg-border",
                    )}
                  />
                )}
                <div
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    ev.done ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className={cn("text-sm font-medium leading-tight", ev.done ? "text-foreground" : "text-muted-foreground")}>
                    {ev.label}
                  </p>
                  {date && <p className="mt-0.5 text-[11px] text-muted-foreground">{date}</p>}
                  {ev.id === "questionnaire" && !ev.done && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700">
                      <Clock className="size-3" />
                      Awaiting client
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// Soft gate banner when questionnaire under-reviewed
export function QuestionnaireGateBanner({
  qStats,
  profileId,
}: {
  qStats: QuestionnaireWorkspaceStats;
  profileId: string;
}) {
  if (!qStats.isSubmitted) return null;
  if (qStats.pendingRefills > 0) {
    return (
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-amber-500/[0.06] px-3 py-3 sm:flex-row sm:items-start sm:px-4 sm:py-3">
        <RotateCcw className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-amber-900">Refill requests outstanding</p>
          <p className="text-xs text-amber-800">
            Confirm corrections in questionnaire review before final pathway sign-off.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="h-9 w-full shrink-0 rounded-lg border-amber-200 text-xs sm:w-auto">
          <Link href={`/dashboard/clients/${profileId}/workspace/questionnaire-review`}>Review</Link>
        </Button>
      </div>
    );
  }
  if (qStats.verifiedCount < 8 && !qStats.pendingRefills) {
    return (
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-blue-200/70 bg-blue-500/[0.05] px-3 py-3 sm:flex-row sm:items-start sm:px-4 sm:py-3">
        <MessageSquare className="mt-0.5 size-4 shrink-0 text-blue-700" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-blue-900">Questionnaire review recommended</p>
          <p className="text-xs text-blue-800">
            {qStats.verifiedCount} fields verified — review identity documents and key answers before assigning a pathway.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="h-9 w-full shrink-0 rounded-lg text-xs sm:w-auto">
          <Link href={`/dashboard/clients/${profileId}/workspace/questionnaire-review`}>Verify now</Link>
        </Button>
      </div>
    );
  }
  return null;
}
