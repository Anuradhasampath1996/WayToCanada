"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MAPLE_ASSISTANT } from "@/lib/workspace-ai-character";
import { MapleAvatar, MapleIntroCard } from "@/components/workspace/maple-avatar";
import { MapleVoiceChat } from "@/components/workspace/maple-voice-chat";

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
  steps?: string[];
  recommended_pathways?: string[];
  crs_notes?: string;
  risks?: string[];
  questionnaire_gaps_to_resolve?: string[];
  snapshot_insights?: { pathway?: string; eligible?: string; note?: string }[];
};

export type AiAdvisory = {
  generated_at: string;
  openai_used: boolean;
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

export function WorkspaceAiAdvisorPanel({ clientId }: { clientId: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [advisory, setAdvisory] = useState<AiAdvisory | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 via-violet-500/5 to-background p-4">
        <MapleIntroCard />
        <Button
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
          onClick={analyze}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {MAPLE_ASSISTANT.analyzingLabel}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {MAPLE_ASSISTANT.analyzeButton}
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {MAPLE_ASSISTANT.availability}
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      <MapleVoiceChat clientId={clientId} />

      {advisory && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <MapleAvatar size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {advisory.greeting ?? MAPLE_ASSISTANT.greeting}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-xs">
                  {advisory.current_stage ?? "Case"}
                </Badge>
                {advisory.openai_used ? (
                  <Badge className="bg-emerald-600 text-xs hover:bg-emerald-600">
                    {MAPLE_ASSISTANT.name} · AI enhanced
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {MAPLE_ASSISTANT.name} · rules engine
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed">{advisory.summary}</p>

          {advisory.next_action?.title && (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {MAPLE_ASSISTANT.name} suggests
              </p>
              <p className="mt-1 font-medium">{advisory.next_action.title}</p>
              {advisory.next_action.description && (
                <p className="mt-1 text-sm text-muted-foreground">{advisory.next_action.description}</p>
              )}
              {advisory.next_action.href && (
                <Button size="sm" variant="outline" className="mt-3 rounded-lg" asChild>
                  <Link href={advisory.next_action.href}>
                    {advisory.next_action.button_label ?? "Open"}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          )}

          {advisory.pathway_guidance?.focus && (
            <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <p className="flex items-center gap-2 font-semibold text-emerald-800">
                <Sparkles className="h-4 w-4" />
                {advisory.pathway_guidance.title ?? `${MAPLE_ASSISTANT.name}'s pathway tips`}
              </p>
              {advisory.pathway_guidance.crs_notes && (
                <p className="mt-2 text-sm text-muted-foreground">{advisory.pathway_guidance.crs_notes}</p>
              )}
              {(advisory.pathway_guidance.steps ?? []).length > 0 && (
                <ul className="mt-3 space-y-2">
                  {advisory.pathway_guidance.steps!.map((step) => (
                    <li key={step} className="flex gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {step}
                    </li>
                  ))}
                </ul>
              )}
              {(advisory.pathway_guidance.recommended_pathways ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {advisory.pathway_guidance.recommended_pathways!.map((p) => (
                    <Badge key={p} variant="outline">{p}</Badge>
                  ))}
                </div>
              )}
              {(advisory.pathway_guidance.questionnaire_gaps_to_resolve ?? []).length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                  <p className="text-xs font-semibold text-amber-800">Fix questionnaire gaps first</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {advisory.pathway_guidance.questionnaire_gaps_to_resolve!.map((g) => (
                      <li key={g}>• {g}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button size="sm" className="mt-3 rounded-lg bg-emerald-600 hover:bg-emerald-700" asChild>
                <Link href={`/dashboard/clients/${clientId}/workspace/pathway-calculator`}>
                  Open pathway calculator
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </section>
          )}

          {advisory.consultant_actions.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                For you
              </p>
              <ul className="space-y-2">
                {advisory.consultant_actions.map((a, i) => (
                  <li key={`${a.action}-${i}`} className="rounded-lg border border-border/60 p-3 text-sm">
                    <p className="font-medium">{a.action}</p>
                    {a.why && <p className="mt-1 text-muted-foreground">{a.why}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {advisory.client_actions.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                For your client
              </p>
              <ul className="space-y-2">
                {advisory.client_actions.map((a, i) => (
                  <li key={`${a.action}-${i}`} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="text-foreground">→</span>
                    {a.action}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {advisory.blockers.length > 0 && (
            <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Blockers / gaps
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {advisory.blockers.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </section>
          )}

          <p className={cn("text-[11px] leading-relaxed text-muted-foreground")}>
            {advisory.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
