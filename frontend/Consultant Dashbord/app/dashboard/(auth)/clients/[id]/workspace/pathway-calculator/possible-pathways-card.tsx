"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, MessageSquare,
  Sparkles, TrendingUp, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MapleAvatar } from "@/components/workspace/maple-avatar";
import { MAPLE_ASSISTANT } from "@/lib/workspace-ai-character";
import type { PathwayInsight } from "@/lib/crs-calculator";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PathwayGuidance = {
  title?: string;
  headline?: string;
  verdict?: "reasonable" | "review_needed" | "consider_alternatives";
  assessment_points?: string[];
  recommended_pathways?: string[];
  crs_notes?: string;
  risks?: string[];
  rcic_next_step?: string;
};

type AiAdvisory = {
  generated_at: string;
  openai_used: boolean;
  intelligence_mode?: string;
  summary: string;
  pathway_guidance?: PathwayGuidance | null;
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function pathwayShortName(pathway: string): string {
  if (pathway.includes("Federal Skilled Worker")) return "FSW · Express Entry";
  if (pathway.includes("Canadian Experience")) return "CEC · Express Entry";
  if (pathway.includes("Skilled Trades")) return "FST · Express Entry";
  if (pathway.includes("Provincial Nominee")) return "PNP";
  if (pathway.includes("Study Permit")) return "Study → PR";
  if (pathway.includes("Work Permit")) return "Work → PR";
  if (pathway.includes("Family")) return "Family sponsorship";
  return pathway;
}

function statusMeta(status: PathwayInsight["status"]) {
  switch (status) {
    case "eligible":
      return { label: "Ready now", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
    case "achievable":
      return { label: "Later", icon: TrendingUp, className: "border-amber-200 bg-amber-50 text-amber-900" };
    default:
      return { label: "Needs work", icon: Clock, className: "border-border bg-muted/40 text-muted-foreground" };
  }
}

function MaplePathwayAdviceDialog({
  open, onOpenChange, clientId, crsTotal, insights,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  crsTotal: number;
  insights: PathwayInsight[];
}) {
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");
  const [advisory, setAdvisory] = useState<AiAdvisory | null>(null);
  const [chatReply, setChatReply] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [openAiAvailable, setOpenAiAvailable] = useState(true);

  const readyNames = useMemo(
    () => insights.filter((i) => i.status === "eligible").map((i) => pathwayShortName(i.pathway)),
    [insights],
  );
  const laterNames = useMemo(
    () => insights.filter((i) => i.status !== "eligible").map((i) => pathwayShortName(i.pathway)),
    [insights],
  );

  const loadState = useCallback(async () => {
    try {
      const res = await fetch(`${API}/consultant/clients/${clientId}/ai-advisor/state`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.latest_advisory) setAdvisory(json.data.latest_advisory as AiAdvisory);
      setOpenAiAvailable(Boolean(json.data?.openai_available ?? true));
    } catch {
      // ignore
    }
  }, [clientId]);

  useEffect(() => {
    if (open) void loadState();
  }, [open, loadState]);

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

  async function askFollowUp() {
    const message = followUp.trim();
    if (!message) return;
    setChatLoading(true);
    setError("");
    try {
      const context = [
        `Pathway calculator context: CRS ${crsTotal}.`,
        readyNames.length ? `Ready now: ${readyNames.join(", ")}.` : "No pathways ready yet.",
        laterNames.length ? `Possible later: ${laterNames.join(", ")}.` : "",
        `Consultant question: ${message}`,
      ].filter(Boolean).join(" ");

      const res = await fetch(`${API}/consultant/clients/${clientId}/ai-advisor/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Maple could not reply.");
      setChatReply(String(json.data?.reply ?? ""));
      setFollowUp("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Chat failed.");
    } finally {
      setChatLoading(false);
    }
  }

  const guidance = advisory?.pathway_guidance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-5 py-4">
          <div className="flex items-start gap-3">
            <MapleAvatar size="sm" className="h-10 w-10 rounded-xl" />
            <div className="min-w-0 text-left">
              <DialogTitle className="text-base">{MAPLE_ASSISTANT.name} · pathway advice</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                Maple reviews this client&apos;s case and CRS profile to suggest which immigration routes fit best.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!openAiAvailable && (
            <p className="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              OpenAI is off — Maple will use the rules engine until Admin → Integrations is configured.
            </p>
          )}

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
            Current calculator: <strong className="text-foreground">CRS {crsTotal}</strong>
            {readyNames.length > 0 && (
              <> · Ready: <span className="text-emerald-700">{readyNames.join(", ")}</span></>
            )}
          </div>

          <Button
            className="w-full gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            onClick={analyze}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {MAPLE_ASSISTANT.analyzingLabel}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {advisory ? "Refresh Maple analysis" : "Ask Maple to analyze pathways"}
              </>
            )}
          </Button>

          {error && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          {advisory && (
            <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <p className="text-sm leading-relaxed text-foreground">{advisory.summary}</p>

              {guidance?.headline && (
                <p className="text-sm font-medium text-emerald-900">{guidance.headline}</p>
              )}

              {guidance?.crs_notes && (
                <p className="rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs leading-relaxed">
                  {guidance.crs_notes}
                </p>
              )}

              {(guidance?.assessment_points ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {guidance!.assessment_points!.map((point) => (
                    <li key={point} className="flex gap-2 text-xs leading-relaxed">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                      {point}
                    </li>
                  ))}
                </ul>
              )}

              {(guidance?.recommended_pathways ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {guidance!.recommended_pathways!.map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
              )}

              {guidance?.rcic_next_step && (
                <p className="text-xs font-medium text-foreground">
                  Your next step: {guidance.rcic_next_step}
                </p>
              )}
            </div>
          )}

          {chatReply && (
            <div className="flex gap-2 rounded-xl border border-border/60 bg-card p-3">
              <MapleAvatar size="sm" className="h-7 w-7 shrink-0 rounded-lg" />
              <p className="text-sm leading-relaxed text-foreground">{chatReply}</p>
            </div>
          )}

          <div className="space-y-2 border-t border-border/50 pt-3">
            <p className="text-xs font-medium text-muted-foreground">Follow-up question</p>
            <Textarea
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              rows={2}
              placeholder="e.g. Is PNP better than Express Entry for this client?"
              className="resize-none text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 rounded-xl"
              onClick={askFollowUp}
              disabled={chatLoading || !followUp.trim()}
            >
              {chatLoading ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquare className="size-3.5" />}
              Ask Maple
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PossiblePathwaysCard({
  clientId,
  insights,
  assignedPathway,
  crsTotal,
}: {
  clientId: number;
  insights: PathwayInsight[];
  assignedPathway: string | null;
  crsTotal: number;
}) {
  const [showLater, setShowLater] = useState(false);
  const [mapleOpen, setMapleOpen] = useState(false);

  const ready = useMemo(() => insights.filter((i) => i.status === "eligible"), [insights]);
  const later = useMemo(() => insights.filter((i) => i.status !== "eligible"), [insights]);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Possible pathways</p>
            <p className="text-[11px] text-muted-foreground">Based on CRS score and profile</p>
          </div>
          <Badge variant="outline" className="rounded-lg text-[10px]">
            {ready.length} ready
          </Badge>
        </div>

        <div className="space-y-2 p-3">
          {ready.length === 0 && later.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No pathways match yet — update client details or CRS inputs.
            </p>
          )}

          {ready.map((row) => {
            const meta = statusMeta(row.status);
            const Icon = meta.icon;
            const isAssigned = assignedPathway === row.backendValue;
            return (
              <div
                key={row.backendValue}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                  isAssigned ? "border-emerald-300 bg-emerald-50/80" : "border-emerald-100 bg-emerald-50/50",
                )}
              >
                <Icon className="size-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-emerald-950">{pathwayShortName(row.pathway)}</p>
                  {row.notes && (
                    <p className="truncate text-[11px] text-emerald-800/80">{row.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className="h-5 rounded-md bg-emerald-600 text-[9px] hover:bg-emerald-600">Ready</Badge>
                  {isAssigned && (
                    <span className="text-[9px] font-semibold text-emerald-700">Assigned</span>
                  )}
                </div>
              </div>
            );
          })}

          {later.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/30"
                onClick={() => setShowLater((v) => !v)}
              >
                <span className="font-medium text-muted-foreground">
                  {later.length} pathway{later.length !== 1 ? "s" : ""} possible later
                </span>
                {showLater ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>

              {showLater && (
                <div className="mt-2 space-y-1.5">
                  {later.map((row) => {
                    const meta = statusMeta(row.status);
                    const Icon = meta.icon;
                    return (
                      <div
                        key={row.backendValue}
                        className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2", meta.className)}
                      >
                        <Icon className="mt-0.5 size-3.5 shrink-0 opacity-80" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{pathwayShortName(row.pathway)}</p>
                          {row.improvement?.headline && (
                            <p className="mt-0.5 text-[10px] leading-snug opacity-90">{row.improvement.headline}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="h-5 shrink-0 rounded-md text-[9px]">
                          {meta.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border/50 bg-gradient-to-r from-emerald-500/[0.04] to-violet-500/[0.04] p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 rounded-xl border-emerald-300/60 bg-background/80 hover:bg-emerald-50"
            onClick={() => setMapleOpen(true)}
          >
            <MapleAvatar size="sm" className="h-5 w-5 rounded-md text-[10px] shadow-none ring-0" />
            Ask Maple for pathway advice
          </Button>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Maple reviews the case and suggests the best route — only when you ask.
          </p>
        </div>
      </div>

      <MaplePathwayAdviceDialog
        open={mapleOpen}
        onOpenChange={setMapleOpen}
        clientId={clientId}
        crsTotal={crsTotal}
        insights={insights}
      />
    </>
  );
}
