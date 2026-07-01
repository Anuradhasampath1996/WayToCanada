"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Landmark,
  Loader2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { NextActionCard, resolveNextAction, CASE_WORKFLOW_STEPS } from "./workspace/workspace-flow-ui";
import type { QuestionnaireWorkspaceStats } from "@/lib/questionnaire-workspace-stats";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const STATUS_LABELS: Record<string, string> = {
  PENDING_ASSESSMENT: "Pending assessment",
  PATHWAY_SELECTED: "Pathway selected",
  AGREEMENT_SENT: "Agreement sent",
  AGREEMENT_SIGNED: "Agreement signed",
  DOCUMENTS_UPLOADING: "Collecting documents",
  UNDER_REVIEW: "Under review",
  READY_FOR_SUBMISSION: "Ready to submit",
  APPLICATION_SUBMITTED: "Application submitted",
};

const WORKFLOW_STEPS = CASE_WORKFLOW_STEPS.map((step) => ({
  label: step.label,
  icon: step.icon,
}));

type CommandCenterData = {
  case_file: {
    id: number;
    status: string;
    immigration_pathway: string | null;
    agreement_sent_at: string | null;
    agreement_signed_at: string | null;
    pathway_assessment_crs_score?: number | null;
    pathway_assessment_at?: string | null;
  } | null;
  case_summary: {
    case_status_label: string;
    next_action: { title: string; tone: string; href: string | null };
  };
  questionnaire: {
    has_submission: boolean;
    is_submitted: boolean;
    submitted_at: string | null;
    verified_count: number;
    pending_refills: number;
    has_main_profile: boolean;
  };
  verification: {
    total_forms: number;
    submitted_count: number;
    reviewed_count: number;
    all_submitted: boolean;
    all_reviewed: boolean;
    case_management_unlocked: boolean;
  };
  pipeline: {
    status: string;
    status_label: string;
    pending_docs: number;
  } | null;
  workflow: {
    active_step: number;
    case_management_unlocked: boolean;
  };
  trust: { balance_held: number; currency: string } | null;
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function mapQuestionnaire(q: CommandCenterData["questionnaire"]): QuestionnaireWorkspaceStats {
  return {
    hasSubmission: q.has_submission,
    isSubmitted: q.is_submitted,
    submittedAt: q.submitted_at,
    verifiedCount: q.verified_count,
    pendingRefills: q.pending_refills,
    hasMainProfile: q.has_main_profile,
  };
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
}

function WorkflowStepStrip({ activeStep }: { activeStep: number }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Step {Math.min(activeStep + 1, WORKFLOW_STEPS.length)} of {WORKFLOW_STEPS.length}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WORKFLOW_STEPS.map((step, i) => {
          const done = i < activeStep;
          const current = i === activeStep;
          const locked = i > activeStep;
          const Icon = step.icon;
          return (
            <div
              key={step.label}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs",
                done && "border-emerald-200/60 bg-emerald-500/[0.06]",
                current && "border-primary/30 bg-primary/[0.05] ring-1 ring-primary/20",
                locked && "border-border/60 bg-muted/15 opacity-75",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg",
                  done && "bg-emerald-500/15 text-emerald-700",
                  current && "bg-primary/15 text-primary",
                  locked && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="size-3.5" /> : locked ? <Lock className="size-3" /> : <Icon className="size-3.5" />}
              </span>
              <span className={cn("font-semibold", current && "text-primary")}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClientCommandCenter({
  clientId,
  onNavigateTab,
}: {
  clientId: number;
  onNavigateTab?: (tab: string) => void;
}) {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/clients/${clientId}/command-center`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load case overview.");
      setData(json as CommandCenterData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ws = `/dashboard/clients/${clientId}/workspace`;

  if (loading) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading case status…
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/30 shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-destructive">{error || "Could not load case overview."}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const qStats = mapQuestionnaire(data.questionnaire);
  const caseFile = data.case_file ?? {
    immigration_pathway: null,
    agreement_sent_at: null,
    agreement_signed_at: null,
    pathway_assessment_at: null,
  };
  const nextAction = resolveNextAction(String(clientId), caseFile, qStats, data.verification);
  const statusLabel =
    data.pipeline?.status_label ??
    data.case_summary.case_status_label ??
    (data.case_file ? STATUS_LABELS[data.case_file.status] : "Not started");

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Where is this case?</CardTitle>
            <CardDescription className="mt-1">
              Complete one step at a time. Open the workspace for the current task.
            </CardDescription>
          </div>
          <Badge variant="outline" className="h-7 rounded-lg text-xs font-medium">
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <WorkflowStepStrip activeStep={data.workflow.active_step} />

        <NextActionCard action={nextAction} />

        {data.trust && data.trust.balance_held > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/60 bg-emerald-500/[0.05] px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Landmark className="size-4 text-emerald-700" />
              <span>
                <span className="font-semibold text-emerald-900">
                  {fmtMoney(data.trust.balance_held, data.trust.currency)}
                </span>
                <span className="text-muted-foreground"> in trust</span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-full rounded-lg text-xs sm:w-auto"
              onClick={() => onNavigateTab?.("money")}
            >
              View trust ledger
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Only the current step is shown in the workspace. Full timeline is on the right in Client journey.
          </p>
          <Button asChild className="h-10 w-full shrink-0 rounded-xl sm:w-auto">
            <Link href={ws}>
              Open case workspace
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
