"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  completeConsultation,
  consultantAuthToken,
  fetchAssessment,
  generateMapleRecommendation,
  reviewProfile,
  skipConsultation,
  type AssessmentReadiness,
  type CalculatorRouting,
} from "@/lib/case-assessment-api";

const FAMILIES = [
  "Express Entry",
  "PNP",
  "Study Permit",
  "Work Permit",
  "Family Sponsorship",
  "Visitor",
  "Citizenship",
];

export function AssessmentGatesPanel({
  profileId,
  selectionReason,
  onSelectionReason,
  alternatives,
  onAlternatives,
  risks,
  onRisks,
  onCanSelectChange,
  onRoutingChange,
}: {
  profileId: string;
  selectionReason: string;
  onSelectionReason: (value: string) => void;
  alternatives: string;
  onAlternatives: (value: string) => void;
  risks: string;
  onRisks: (value: string) => void;
  onCanSelectChange: (canSelect: boolean) => void;
  onRoutingChange: (routing: CalculatorRouting) => void;
}) {
  const [assessment, setAssessment] = useState<AssessmentReadiness | null>(null);
  const [routing, setRouting] = useState<CalculatorRouting | null>(null);
  const [family, setFamily] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload(nextFamily?: string) {
    const token = consultantAuthToken();
    const data = await fetchAssessment(profileId, token, nextFamily || family || undefined);
    setAssessment(data.assessment);
    setRouting(data.calculator);
    onCanSelectChange(data.assessment.can_select_pathway);
    onRoutingChange(data.calculator);
  }

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load assessment."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  const rec = assessment?.maple_recommendation as
    | { rationale?: string; recommended_pathways?: string[]; risks?: string[]; assessment_points?: string[] }
    | null
    | undefined;

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Eligibility assessment gates</p>
          <p className="text-xs text-muted-foreground">
            Intake can continue anytime. Select Pathway needs consultation (or skip with reason) and a profile review.
          </p>
        </div>
        <Badge variant="outline" className={assessment?.can_select_pathway ? "border-emerald-300 text-emerald-800" : ""}>
          {assessment?.can_select_pathway ? "Select Pathway ready" : "Select Pathway locked"}
        </Badge>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-semibold">1. Initial consultation</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {assessment?.consultation.satisfied
              ? assessment.consultation.completed_at
                ? "Completed"
                : `Skipped: ${assessment.consultation.skip_reason}`
              : "Not recorded yet"}
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Consult notes (optional)"
            className="mt-2 w-full rounded-lg border border-input/80 bg-muted/20 px-2 py-1.5 text-xs"
            rows={2}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" className="h-7 rounded-lg text-xs" disabled={!!busy} onClick={() => run("consult", async () => {
              await completeConsultation(profileId, consultantAuthToken(), notes);
            })}>
              {busy === "consult" && <Loader2 className="mr-1 size-3 animate-spin" />}
              Mark consult done
            </Button>
          </div>
          <input
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Skip reason (required if skipping)"
            className="mt-2 w-full rounded-lg border border-input/80 bg-muted/20 px-2 py-1.5 text-xs"
          />
          <Button size="sm" variant="outline" className="mt-2 h-7 rounded-lg text-xs" disabled={!!busy} onClick={() => run("skip", async () => {
            await skipConsultation(profileId, consultantAuthToken(), skipReason);
          })}>
            Skip with reason
          </Button>
        </div>

        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs font-semibold">2. Profile review</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {assessment?.profile_review.reviewed_at ? "Reviewed" : "Required identity/core fields must be present first."}
          </p>
          <ul className="mt-2 space-y-1">
            {(assessment?.profile_review.required_fields ?? []).map((field) => (
              <li key={field.key} className="flex items-center gap-1.5 text-[11px]">
                {field.present ? (
                  <CheckCircle2 className="size-3 text-emerald-600" />
                ) : (
                  <AlertCircle className="size-3 text-amber-600" />
                )}
                {field.label}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" className="h-7 rounded-lg text-xs" disabled={!!busy || !assessment?.profile_review.can_review} onClick={() => run("review", async () => {
              await reviewProfile(profileId, consultantAuthToken());
            })}>
              Mark profile reviewed
            </Button>
            <Button asChild size="sm" variant="outline" className="h-7 rounded-lg text-xs">
              <Link href={`/dashboard/clients/${profileId}/workspace/questionnaire-review`}>Open questionnaire</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 p-3">
        <p className="text-xs font-semibold">Calculator routing</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {routing?.mode === "express_entry"
            ? "Express Entry family — full CRS / FSW / CEC / FST tools."
            : "Non-EE family — checklist + existing heuristics. CRS stays optional."}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FAMILIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setFamily(item);
                void reload(item).catch((e) => setError(e instanceof Error ? e.message : "Routing failed."));
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                (family || routing?.family) === item
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        {routing?.mode === "checklist" && (
          <ul className="mt-3 space-y-1">
            {routing.checklist.map((item) => (
              <li key={item.id} className="text-[11px] text-muted-foreground">• {item.label}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5 text-primary" />
            Maple recommendation
          </p>
          <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" disabled={!!busy} onClick={() => run("maple", async () => {
            await generateMapleRecommendation(profileId, consultantAuthToken());
          })}>
            Ask Maple
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Decision support only. Maple never selects the pathway, approves information, or submits.
        </p>
        {rec && (
          <div className="mt-2 space-y-1 text-[11px]">
            {rec.rationale && <p>{rec.rationale}</p>}
            {(rec.recommended_pathways ?? []).length > 0 && (
              <p>Suggested: {(rec.recommended_pathways ?? []).join(", ")}</p>
            )}
            {(rec.risks ?? []).length > 0 && <p>Risks: {(rec.risks ?? []).join(" ")}</p>}
          </div>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-[11px] text-muted-foreground">
          Selection reason
          <textarea
            value={selectionReason}
            onChange={(e) => onSelectionReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input/80 bg-muted/20 px-2 py-1.5 text-xs text-foreground"
            rows={2}
            placeholder="Why this pathway?"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Alternatives considered
          <textarea
            value={alternatives}
            onChange={(e) => onAlternatives(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input/80 bg-muted/20 px-2 py-1.5 text-xs text-foreground"
            rows={2}
            placeholder="One per line"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Risks
          <textarea
            value={risks}
            onChange={(e) => onRisks(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input/80 bg-muted/20 px-2 py-1.5 text-xs text-foreground"
            rows={2}
            placeholder="One per line"
          />
        </label>
      </div>
    </div>
  );
}
