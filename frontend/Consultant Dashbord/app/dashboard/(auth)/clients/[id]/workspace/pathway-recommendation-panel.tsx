"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, CheckCircle2, Calculator, ChevronRight, Loader2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  calcCRS, calcFSW, DEF_PERSON, DEF_SPOUSE, getPathwayInsights,
  OFFICIAL_CRS_TOOL_URL,
} from "@/lib/crs-calculator";
import {
  mapQuestionnaireToCalculator, mergePersonInput, mergeSpouseInput,
} from "@/lib/questionnaire-crs-prefill";
import {
  calculateCrs, fetchCrsDraws, toApiPayload,
  apiToBreakdown, apiToFsw,
  type ExtendedPersonInput, type CrsDraw, type CrsApiResult,
} from "@/lib/crs-api";
import {
  getInadmissibilityFlags, getQuestionnaireGaps, pathwayShortName,
} from "@/lib/workspace-pathway-analysis";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const EXT_DEF: ExtendedPersonInput = {
  ...DEF_PERSON,
  englishTestType: "ielts",
  frenchTestType: "none",
  frenchScores: { speaking: 0, listening: 0, reading: 0, writing: 0 },
  nocCode: "", nocTeer: "", nocTitle: "",
};

export interface PathwayCaseFile {
  id: number;
  immigration_pathway: string | null;
  pathway_assessment_notes?: string | null;
  pathway_assessment_crs_score?: number | null;
  pathway_assessment_ircc_crs_score?: number | null;
  pathway_assessment_at?: string | null;
  pathway_assessment_rules_version?: string | null;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export function PathwayRecommendationPanel({
  profileId,
  caseFile,
  clientName,
  consultantName,
  onPathwaySelected,
  onPathwayCleared,
  onAssessmentSaved,
}: {
  profileId: string;
  caseFile: PathwayCaseFile;
  clientName: string;
  consultantName: string;
  onPathwaySelected: (pathway: string) => void;
  onPathwayCleared?: () => void;
  onAssessmentSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draws, setDraws] = useState<CrsDraw[]>([]);
  const [apiResult, setApiResult] = useState<CrsApiResult | null>(null);
  const [hasSpouse, setHasSpouse] = useState(false);
  const [main, setMain] = useState<ExtendedPersonInput>(EXT_DEF);
  const [spouse, setSpouse] = useState(DEF_SPOUSE);
  const [step1, setStep1] = useState<Record<string, unknown>>({});
  const [step3, setStep3] = useState<Record<string, unknown>>({});
  const [mainRaw, setMainRaw] = useState<Record<string, unknown>>({});
  const [spouseRaw, setSpouseRaw] = useState<Record<string, unknown>>({});
  const [hasQuestionnaire, setHasQuestionnaire] = useState(false);

  const [assigning, setAssigning] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [qRes, drawsList] = await Promise.all([
        fetch(`${API}/consultant/clients/${profileId}/questionnaire`, { headers: authHeaders() }),
        fetchCrsDraws(10).catch(() => [] as CrsDraw[]),
      ]);
      setDraws(drawsList);

      if (!qRes.ok) {
        setHasQuestionnaire(false);
        setLoading(false);
        return;
      }

      const qJson = await qRes.json();
      const sub = qJson.submission;
      if (!sub) {
        setHasQuestionnaire(false);
        setLoading(false);
        return;
      }

      setHasQuestionnaire(true);
      setStep1(sub.step1_data ?? {});
      setStep3(sub.step3_data ?? {});
      setMainRaw(sub.main_data ?? {});
      setSpouseRaw(sub.spouse_data ?? {});

      const mapped = mapQuestionnaireToCalculator({
        step1_data: sub.step1_data,
        main_data: sub.main_data,
        spouse_data: sub.spouse_data,
        step3_data: sub.step3_data,
      });

      const mergedMain = mergePersonInput(EXT_DEF, mapped.main);
      const mergedSpouse = mergeSpouseInput(DEF_SPOUSE, mapped.spouse);
      setMain(mergedMain);
      setSpouse(mergedSpouse);
      setHasSpouse(mapped.hasSpouse);

      const result = await calculateCrs(toApiPayload(mergedMain, mergedSpouse, mapped.hasSpouse));
      setApiResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load assessment data.");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  const mainCRS = apiResult ? apiToBreakdown(apiResult.crs) : calcCRS(main, hasSpouse, hasSpouse ? spouse : undefined);
  const mainFSW = apiResult ? apiToFsw(apiResult.fsw) : calcFSW(main);
  const insights = useMemo(
    () => getPathwayInsights(mainCRS, mainFSW, main, hasSpouse, hasSpouse ? spouse : undefined),
    [mainCRS, mainFSW, main, hasSpouse, spouse],
  );

  const ready = insights.filter((i) => i.status === "eligible");
  const achievable = insights.filter((i) => i.status === "achievable");
  const latestDraw = draws[0];
  const drawCutoff = latestDraw?.minimum_crs_score ?? null;
  const vsDraw = drawCutoff != null ? mainCRS.total - drawCutoff : null;

  const { gaps } = getQuestionnaireGaps(step1, mainRaw, spouseRaw);
  const flags = getInadmissibilityFlags(step3);
  const alertCount = gaps.length + flags.length;
  const canClearPathway = Boolean(caseFile.immigration_pathway) && !caseFile.agreement_sent_at;

  async function clearPathwaySelection() {
    setAssigning("__clear__");
    setSaveMsg(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/select-pathway`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ immigration_pathway: null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.message === "string" ? json.message : "Could not clear pathway");
      onPathwayCleared?.();
      setSaveMsg("Pathway selection cleared.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setAssigning(null);
    }
  }

  async function assignPathway(backendValue: string) {
    setAssigning(backendValue);
    try {
      const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/select-pathway`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ immigration_pathway: backendValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to assign pathway");
      onPathwaySelected(backendValue);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setAssigning(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading pathway assessment…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        {error}
      </div>
    );
  }

  if (!hasQuestionnaire) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground flex items-start gap-3">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p>No questionnaire submitted yet. Ask the client to complete their profile first.</p>
          <Link href={`/dashboard/clients/${profileId}/workspace/questionnaire-review`} className="text-primary underline text-xs mt-2 inline-block">
            Open questionnaire review →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SnapshotCard
          label="Estimated CRS"
          value={String(mainCRS.total)}
          sub={vsDraw != null ? (vsDraw >= 0 ? `${vsDraw} above latest draw` : `${Math.abs(vsDraw)} below latest draw`) : "Draw data unavailable"}
          tone={vsDraw != null && vsDraw >= 0 ? "green" : mainCRS.total >= 400 ? "blue" : "amber"}
        />
        <SnapshotCard
          label="Latest draw cutoff"
          value={drawCutoff != null ? String(drawCutoff) : "—"}
          sub={latestDraw ? `Draw #${latestDraw.draw_number}` : undefined}
          tone={vsDraw != null && vsDraw >= 0 ? "green" : "amber"}
        />
        <SnapshotCard
          label="Ready pathways"
          value={String(ready.length)}
          sub={achievable.length > 0 ? `+${achievable.length} with improvements` : "Assign one below"}
          tone="blue"
        />
      </div>

      {caseFile.pathway_assessment_at && (
        <p className="text-xs text-muted-foreground">
          Last assessment saved {fmtDate(caseFile.pathway_assessment_at)}
          {caseFile.pathway_assessment_crs_score != null && ` · CRS ${caseFile.pathway_assessment_crs_score}`}
        </p>
      )}

      {alertCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/70 bg-amber-500/[0.06] px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              {alertCount} item{alertCount !== 1 ? "s" : ""} need review before final sign-off.
              Open the full calculator for questionnaire gaps, flags, and detailed notes.
            </span>
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border/70 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            Pathways ready to assign
          </p>
          <Badge variant="outline" className="text-xs">
            {ready.length} ready now
          </Badge>
        </div>

        {ready.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No pathways are ready yet. Use the full calculator to compare options and see what improvements are needed.
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {ready.map((row) => {
              const isAssigned = caseFile.immigration_pathway === row.backendValue;
              return (
                <li
                  key={row.backendValue}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
                    isAssigned && "bg-emerald-500/[0.05]",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{pathwayShortName(row.pathway)}</p>
                    <p className="text-xs text-muted-foreground">Eligible based on current profile</p>
                  </div>
                  {isAssigned ? (
                    canClearPathway ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={assigning === "__clear__"}
                        onClick={clearPathwaySelection}
                      >
                        {assigning === "__clear__" ? "Clearing…" : "Clear selection"}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="size-3.5" />
                        Assigned
                      </span>
                    )
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={assigning === row.backendValue}
                      onClick={() => assignPathway(row.backendValue)}
                    >
                      {assigning === row.backendValue ? "Assigning…" : "Assign pathway"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {saveMsg && <p className="text-xs text-muted-foreground">{saveMsg}</p>}

      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Need the full picture?</p>
          <p className="text-xs text-muted-foreground">
            FSW scoring, spouse comparison, improvement roadmap, IRCC verification, and consultant sign-off live in the
            full calculator.
          </p>
        </div>
        <Button className="shrink-0 gap-2 rounded-xl" asChild>
          <Link href={`/dashboard/clients/${profileId}/workspace/pathway-calculator`}>
            <Calculator className="size-4" />
            Open full calculator
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SnapshotCard({ label, value, sub, tone }: {
  label: string; value: string; sub?: string;
  tone: "green" | "blue" | "amber" | "rose";
}) {
  const ring = {
    green: "border-green-200 bg-green-50",
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
  }[tone];
  const val = {
    green: "text-green-700",
    blue: "text-blue-700",
    amber: "text-amber-800",
    rose: "text-rose-700",
  }[tone];
  return (
    <div className={cn("rounded-lg border p-3", ring)}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("text-2xl font-black mt-0.5", val)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

