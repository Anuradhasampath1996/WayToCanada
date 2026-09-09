"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MapleVoiceChat } from "@/components/workspace/maple-voice-chat";
import { WorkspaceRelevantLegislation } from "@/components/workspace/workspace-relevant-legislation";
import { LegislationLinkChips, type LegislationLink } from "@/components/legislation/legislation-link-chips";
import { LegislationProvisionDialog } from "@/components/legislation/legislation-provision-dialog";
import { useLegislationProvisionPopup } from "@/components/legislation/use-legislation-provision-popup";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type ConsultantAction = {
  priority?: number;
  action: string;
  why?: string;
  href?: string;
};

type ClientAction = {
  action: string;
};

type PathwayGuidance = {
  focus?: boolean;
  title?: string;
  headline?: string;
  verdict?: "reasonable" | "review_needed" | "consider_alternatives";
  steps?: string[];
  case_facts?: string[];
  assessment_points?: string[];
  recommended_pathways?: string[];
  crs_notes?: string;
  risks?: string[];
  rcic_next_step?: string;
  questionnaire_gaps_to_resolve?: string[];
  optional_questionnaire_cleanup?: string[];
  snapshot_insights?: { pathway?: string; eligible?: string; note?: string }[];
  assigned_pathway?: string | null;
  legislation_refs?: LegislationLink[];
};

export type AiAdvisory = {
  generated_at: string;
  openai_used: boolean;
  intelligence_mode?: "ai_enhanced" | "rules_engine";
  workflow_phase?: string | null;
  pathway_review_mode?: boolean;
  greeting?: string;
  assistant?: {
    name: string;
    role: string;
    tagline: string;
    availability: string;
  };
  current_stage: string | null;
  summary: string;
  next_action?: {
    tone?: string;
    title?: string;
    description?: string;
    href?: string;
    button_label?: string;
  };
  consultant_actions: ConsultantAction[];
  client_actions: ClientAction[];
  blockers: string[];
  pathway_guidance?: PathwayGuidance | null;
  inadmissibility_notes?: { level?: string; text?: string }[] | string[];
  disclaimer: string;
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanizeLabel(value: string | null | undefined) {
  if (!value) return "Case";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function CollapsibleDetails({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/70 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="space-y-3 border-t border-border/60 px-4 py-3">{children}</div>}
    </div>
  );
}

export function WorkspaceAiAdvisorPanel({ clientId }: { clientId: number }) {
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState("");
  const [advisory, setAdvisory] = useState<AiAdvisory | null>(null);
  const [openAiAvailable, setOpenAiAvailable] = useState(true);
  const [relevantLegislation, setRelevantLegislation] = useState<LegislationLink[]>([]);
  const { openLink, dialogState } = useLegislationProvisionPopup();

  const loadState = useCallback(async () => {
    setBootLoading(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${clientId}/ai-advisor/state`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.latest_advisory) {
        setAdvisory(json.data.latest_advisory as AiAdvisory);
      }
      setOpenAiAvailable(Boolean(json.data?.openai_available ?? true));
      setRelevantLegislation((json.data?.relevant_legislation ?? []) as LegislationLink[]);
    } finally {
      setBootLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/clients/${clientId}/ai-advisor/analyze`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Analysis failed.");
      setAdvisory(json.data as AiAdvisory);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  const showPathwaySection = Boolean(
    advisory?.pathway_guidance?.focus
      || advisory?.pathway_review_mode
      || (advisory?.pathway_guidance?.assessment_points?.length ?? 0) > 0,
  );

  const pathway = advisory?.pathway_guidance;
  const topActions = (advisory?.consultant_actions ?? []).slice(0, 3);
  const aiEnhanced =
    (advisory?.intelligence_mode ?? (advisory?.openai_used ? "ai_enhanced" : "rules_engine")) ===
    "ai_enhanced";

  return (
    <div className="space-y-4">
      {/* Analyze — compact CTA, brand accent */}
      <section className="overflow-hidden rounded-2xl border border-red-200/70 bg-gradient-to-br from-red-50 via-white to-white p-4 shadow-sm shadow-red-950/5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Case analysis</p>
            <p className="text-[11px] text-muted-foreground">
              {advisory?.generated_at
                ? `Updated ${fmtDate(advisory.generated_at)}`
                : "Only when you ask"}
            </p>
          </div>
          {advisory && (
            <Badge
              className={cn(
                "shrink-0 border-0 text-[10px]",
                aiEnhanced ? "bg-red-600 text-white hover:bg-red-600" : "bg-muted text-muted-foreground",
              )}
            >
              {aiEnhanced ? "AI on" : "Rules"}
            </Badge>
          )}
        </div>

        {!openAiAvailable && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            OpenAI is not configured. Maple still works with the rules engine.
          </p>
        )}

        <Button
          className="mt-3 h-11 w-full rounded-xl bg-red-600 text-white shadow-md shadow-red-600/25 hover:bg-red-700"
          onClick={analyze}
          disabled={loading || bootLoading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reviewing this case…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {advisory ? "Refresh analysis" : "Analyze this case"}
            </>
          )}
        </Button>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      {/* Ask — primary daily use */}
      <MapleVoiceChat
        clientId={clientId}
        openAiAvailable={openAiAvailable}
        onLegislationLinkClick={openLink}
      />

      {bootLoading && !advisory && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}

      {advisory && (
        <div className="space-y-3">
          {/* 1. Blockers first */}
          {advisory.blockers.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-950">
                <AlertTriangle className="h-4 w-4" />
                Fix these first
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {advisory.blockers.map((b) => (
                  <li key={b} className="text-sm leading-snug text-amber-950/80">
                    {b}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 2. Primary next step */}
          {advisory.next_action?.title && (
            <section className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/80 to-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700/80">
                Do this next
              </p>
              <p className="mt-1.5 text-base font-semibold text-foreground">
                {advisory.next_action.title}
              </p>
              {advisory.next_action.description && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {advisory.next_action.description}
                </p>
              )}
              {advisory.next_action.href && (
                <Button
                  size="sm"
                  className="mt-3 rounded-xl bg-red-600 text-white hover:bg-red-700"
                  asChild
                >
                  <Link href={advisory.next_action.href}>
                    {advisory.next_action.button_label ?? "Open"}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </section>
          )}

          {/* 3. Short snapshot */}
          <section className="rounded-2xl border border-border/70 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 text-red-800">
                {humanizeLabel(advisory.current_stage)}
              </Badge>
              {advisory.workflow_phase && (
                <Badge variant="outline" className="rounded-full text-xs">
                  {humanizeLabel(advisory.workflow_phase)}
                </Badge>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/90">
              {advisory.summary}
            </p>
          </section>

          {/* 4. Pathway — compact + details on demand */}
          {showPathwaySection && pathway && (
            <section className="rounded-2xl border border-border/70 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {pathway.title ?? "Pathway check"}
                </p>
                {pathway.verdict === "review_needed" && (
                  <Badge variant="outline" className="border-amber-300 text-amber-800">
                    Confirm route
                  </Badge>
                )}
                {pathway.verdict === "consider_alternatives" && (
                  <Badge variant="outline" className="border-sky-300 text-sky-800">
                    Compare options
                  </Badge>
                )}
              </div>
              {pathway.headline && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pathway.headline}
                </p>
              )}
              {pathway.rcic_next_step && (
                <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                  {pathway.rcic_next_step}
                </p>
              )}
              <Button size="sm" variant="outline" className="mt-3 rounded-xl" asChild>
                <Link href={`/dashboard/clients/${clientId}/workspace/pathway-calculator`}>
                  Pathway calculator
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>

              <div className="mt-3">
                <CollapsibleDetails title="Pathway details">
                  {(pathway.case_facts ?? []).length > 0 && (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {pathway.case_facts!.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                  )}
                  {pathway.crs_notes && (
                    <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm">{pathway.crs_notes}</p>
                  )}
                  {(pathway.assessment_points ?? []).length > 0 && (
                    <ul className="space-y-2">
                      {pathway.assessment_points!.map((step) => (
                        <li key={step} className="flex gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(pathway.steps ?? []).length > 0 && (
                    <ul className="space-y-2">
                      {pathway.steps!.map((step) => (
                        <li key={step} className="flex gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(pathway.risks ?? []).length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-2.5">
                      <p className="text-xs font-semibold text-amber-900">Risks</p>
                      <ul className="mt-1 space-y-1 text-xs text-amber-950/80">
                        {pathway.risks!.map((risk) => (
                          <li key={risk}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(pathway.recommended_pathways ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {pathway.recommended_pathways!.map((p) => (
                        <Badge key={p} variant="outline">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {(pathway.questionnaire_gaps_to_resolve ?? []).length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
                      <p className="text-xs font-semibold text-amber-900">Before filing</p>
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {pathway.questionnaire_gaps_to_resolve!.map((g) => (
                          <li key={g}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(pathway.legislation_refs ?? []).length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">
                        Related law
                      </p>
                      <LegislationLinkChips
                        links={pathway.legislation_refs!}
                        onLinkClick={openLink}
                      />
                    </div>
                  )}
                </CollapsibleDetails>
              </div>
            </section>
          )}

          {/* 5. More actions — capped */}
          {topActions.length > 0 && (
            <CollapsibleDetails title="More for you">
              <ul className="space-y-2">
                {topActions.map((a, i) => (
                  <li key={`${a.action}-${i}`} className="rounded-xl bg-muted/40 px-3 py-2.5 text-sm">
                    <p className="font-medium text-foreground">{a.action}</p>
                    {a.why && <p className="mt-1 text-muted-foreground">{a.why}</p>}
                  </li>
                ))}
              </ul>
              {(advisory.client_actions ?? []).length > 0 && (
                <div className="rounded-xl border border-border/60 px-3 py-2.5">
                  <p className="text-xs font-semibold text-muted-foreground">Ask your client</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                    {advisory.client_actions.slice(0, 2).map((a, i) => (
                      <li key={`${a.action}-${i}`}>{a.action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleDetails>
          )}

          <p className="px-1 text-[10px] leading-relaxed text-muted-foreground/90">
            Maple guides your workflow. Confirm facts and IRCC rules before advising — your judgment is final.
          </p>
        </div>
      )}

      {relevantLegislation.length > 0 && (
        <CollapsibleDetails title="Relevant legislation">
          <WorkspaceRelevantLegislation sections={relevantLegislation} onLinkClick={openLink} />
        </CollapsibleDetails>
      )}

      <LegislationProvisionDialog {...dialogState} />
    </div>
  );
}
