"use client";

import Link from "next/link";
import { Calculator, ChevronRight, ClipboardList, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuestionnaireWorkspaceStats } from "@/lib/questionnaire-workspace-stats";

interface CaseFileSnapshot {
  immigration_pathway: string | null;
  pathway_assessment_notes?: string | null;
  pathway_assessment_crs_score?: number | null;
  pathway_assessment_ircc_crs_score?: number | null;
  pathway_assessment_at?: string | null;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export function PathwayAssessmentEntry({
  profileId,
  caseFile,
  qStats,
}: {
  profileId: string;
  caseFile: CaseFileSnapshot;
  qStats: QuestionnaireWorkspaceStats;
}) {
  const calcHref = `/dashboard/clients/${profileId}/workspace/pathway-calculator`;
  const reviewHref = `/dashboard/clients/${profileId}/workspace/questionnaire-review`;

  if (!qStats.hasSubmission) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm">
        <p className="font-medium text-foreground">Client questionnaire not started</p>
        <p className="mt-1 text-muted-foreground">
          Pathway scoring unlocks after the client submits their profile questionnaire.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
          <Link href={reviewHref}>
            <ClipboardList className="mr-1.5 size-4" />
            Open questionnaire review
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 shrink-0 text-primary" />
            Pathway calculator
          </p>
          <p className="max-w-xl text-sm text-muted-foreground">
            {caseFile.immigration_pathway
              ? `Review CRS scoring, compare options, or change the assigned pathway.`
              : "Score CRS, compare immigration routes, and assign the best pathway for this client."}
          </p>
          {caseFile.pathway_assessment_at && (
            <p className="text-xs text-muted-foreground">
              Last assessment {fmtDate(caseFile.pathway_assessment_at)}
              {caseFile.pathway_assessment_crs_score != null && ` · CRS ${caseFile.pathway_assessment_crs_score}`}
              {caseFile.pathway_assessment_ircc_crs_score != null &&
                caseFile.pathway_assessment_ircc_crs_score !== caseFile.pathway_assessment_crs_score &&
                ` · IRCC ${caseFile.pathway_assessment_ircc_crs_score}`}
            </p>
          )}
          {caseFile.pathway_assessment_notes && (
            <p className="line-clamp-2 text-xs italic text-muted-foreground">
              {caseFile.pathway_assessment_notes}
            </p>
          )}
          {!qStats.isSubmitted && (
            <p className="text-[11px] font-medium text-amber-700">Questionnaire draft in progress</p>
          )}
        </div>
        <Button className="shrink-0 gap-2 rounded-xl" asChild>
          <Link href={calcHref}>
            <Calculator className="size-4" />
            {caseFile.immigration_pathway ? "Open calculator" : "Open pathway calculator"}
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
