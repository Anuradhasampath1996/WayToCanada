"use client";

import {
  Calculator, CheckCircle2, ChevronRight, ClipboardCheck, ExternalLink,
  FileText, Loader2, Package, AlertCircle, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OFFICIAL_CRS_TOOL_URL } from "@/lib/crs-calculator";

export const WORKFLOW_STEPS = [
  {
    num: 1 as const,
    title: "Enter details",
    subtitle: "Load or type client info",
    help: "Start by loading the client questionnaire — or enter age, education, English scores, and work experience manually. Then calculate the CRS score.",
    icon: Calculator,
  },
  {
    num: 2 as const,
    title: "Choose pathway",
    subtitle: "Pick immigration route",
    help: "Review the simulated CRS score and eligible pathways. Assign the route that best fits this client and save your notes.",
    icon: ClipboardCheck,
  },
  {
    num: 3 as const,
    title: "IRCC forms",
    subtitle: "Government forms",
    help: "Open the correct IRCC forms and guides for the pathway you assigned. Share next steps with your client.",
    icon: Package,
  },
];

export function SimulationStatusBanner({
  mode,
  crsTotal,
  source,
  fswTotal,
  fswEligible,
  drawCutoff,
  vsDraw,
}: {
  mode: "empty" | "stale" | "active";
  crsTotal?: number;
  source?: "questionnaire" | "manual";
  fswTotal?: number;
  fswEligible?: boolean;
  drawCutoff?: number | null;
  vsDraw?: number | null;
}) {
  if (mode === "empty") {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-center">
        <p className="text-sm font-medium text-foreground">No score calculated yet</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Load the questionnaire or tap <strong>Calculate score</strong> to see results here.
        </p>
      </div>
    );
  }
  if (mode === "stale") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div>
          <p className="text-sm font-semibold text-amber-950">Details changed</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">
            You edited the form after the last calculation. Run <strong>Calculate score</strong> again to refresh.
          </p>
        </div>
      </div>
    );
  }

  const scoreTone =
    (crsTotal ?? 0) >= 470 ? "text-green-700" :
    (crsTotal ?? 0) >= 400 ? "text-blue-700" :
    (crsTotal ?? 0) >= 300 ? "text-amber-700" : "text-rose-600";

  return (
    <div className="rounded-xl border border-violet-200/70 bg-violet-500/[0.06] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800/80">Calculated CRS score</p>
      <div className="mt-2 flex items-end gap-2">
        <p className={cn("text-4xl font-black tabular-nums leading-none", scoreTone)}>{crsTotal ?? "—"}</p>
        <p className="pb-1 text-xs text-muted-foreground">/ 1,200 points</p>
      </div>

      <dl className="mt-4 space-y-2 border-t border-violet-200/50 pt-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Data source</dt>
          <dd className="text-right font-medium text-foreground">
            {source === "questionnaire" ? "Loaded from questionnaire" : "Entered manually"}
          </dd>
        </div>
        {fswTotal != null && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">FSW minimum (67 pts)</dt>
            <dd className={cn("text-right font-medium", fswEligible ? "text-green-700" : "text-amber-800")}>
              {fswTotal}/100 — {fswEligible ? "Passes" : "Below minimum"}
            </dd>
          </div>
        )}
        {drawCutoff != null && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Latest Express Entry draw</dt>
            <dd className="text-right font-medium text-foreground">
              {drawCutoff} pts
              {vsDraw != null && (
                <span className={cn("ml-1", vsDraw >= 0 ? "text-green-700" : "text-amber-800")}>
                  ({vsDraw >= 0 ? "+" : ""}{vsDraw})
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-3 rounded-lg border border-violet-200/60 bg-white/50 px-3 py-2 text-[11px] leading-relaxed text-violet-950/90">
        Preview only — not saved to the case file until you assign a pathway or save notes.
      </p>
    </div>
  );
}

export function HowItWorksCard({
  onLoad, onSimulate, loadLoading, simulateLoading, prefillMessage, hasActiveSimulation,
}: {
  onLoad: () => void;
  onSimulate: () => void;
  loadLoading: boolean;
  simulateLoading: boolean;
  prefillMessage: string | null;
  hasActiveSimulation: boolean;
}) {
  const busy = loadLoading || simulateLoading;
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-card to-violet-500/[0.03] shadow-sm">
      <div className="border-b border-border/50 px-5 py-4">
        <p className="text-sm font-semibold">How this page works</p>
        <p className="mt-1 text-xs text-muted-foreground">Three simple steps — load data, calculate score, choose pathway.</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {[
          { n: "1", title: "Load client data", body: "Pull answers from the questionnaire automatically." },
          { n: "2", title: "Calculate score", body: "See CRS points and which pathways are possible." },
          { n: "3", title: "Assign pathway", body: "Pick the route and open IRCC forms." },
        ].map((item) => (
          <div key={item.n} className="rounded-xl border border-border/60 bg-background/80 p-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {item.n}
            </span>
            <p className="mt-2 text-sm font-semibold">{item.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border/50 bg-muted/10 px-5 py-4">
        <Button size="sm" className="gap-1.5 rounded-xl" onClick={onLoad} disabled={busy}>
          {loadLoading ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
          Load from questionnaire
        </Button>
        <Button
          size="sm"
          variant={hasActiveSimulation ? "outline" : "default"}
          className="gap-1.5 rounded-xl"
          onClick={onSimulate}
          disabled={busy}
        >
          {simulateLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Calculator className="size-3.5" />}
          {hasActiveSimulation ? "Calculate again" : "Calculate score"}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" asChild>
          <a href={OFFICIAL_CRS_TOOL_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
            Verify on IRCC
          </a>
        </Button>
      </div>
      {prefillMessage && (
        <p className="mx-5 mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">{prefillMessage}</p>
      )}
    </div>
  );
}

export function WorkflowGuideCard({
  step,
  onStep,
  hasActiveSimulation,
  assignedPathway,
  children,
}: {
  step: 1 | 2 | 3;
  onStep: (s: 1 | 2 | 3) => void;
  hasActiveSimulation: boolean;
  assignedPathway: string | null;
  children?: React.ReactNode;
}) {
  const current = WORKFLOW_STEPS[step - 1];
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/50 bg-muted/10 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3 sm:gap-4">
          {WORKFLOW_STEPS.map((s, idx) => {
            const done = s.num < step;
            const active = s.num === step;
            const Icon = s.icon;
            const canClick = done || active;
            return (
              <div key={s.num} className="flex min-w-0 flex-1 items-start">
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => canClick && onStep(s.num)}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg py-1 transition-colors sm:gap-2",
                    canClick && !active && "hover:bg-muted/40",
                    !canClick && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border-2 sm:size-10",
                      done && "border-violet-600 bg-violet-600 text-white",
                      active && "border-violet-500 bg-violet-500/15 text-violet-700",
                      !done && !active && "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <p className={cn("text-[11px] font-bold sm:text-xs", active ? "text-violet-700" : "text-muted-foreground")}>
                    {s.title}
                  </p>
                </button>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className={cn("mt-4 h-0.5 min-w-[12px] flex-1 sm:mt-5", s.num < step ? "bg-violet-500" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm font-semibold text-foreground">
          Step {step}: {current.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{current.help}</p>
        {step === 2 && !hasActiveSimulation && (
          <p className="mt-2 text-xs font-medium text-amber-800">
            Go back to Step 1 and calculate the score before choosing a pathway.
          </p>
        )}
        {step === 3 && !assignedPathway && (
          <p className="mt-2 text-xs font-medium text-amber-800">
            Assign a pathway in Step 2 first to see the right IRCC forms.
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-muted/5 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function StepNavButtons({
  step,
  hasActiveSimulation,
  assignedPathway,
  onStep,
}: {
  step: 1 | 2 | 3;
  hasActiveSimulation: boolean;
  assignedPathway: string | null;
  onStep: (s: 1 | 2 | 3) => void;
}) {
  if (step === 1) {
    return (
      <Button onClick={() => onStep(2)} className="ml-auto gap-2 rounded-xl" disabled={!hasActiveSimulation}>
        Continue to choose pathway
        <ChevronRight className="size-4" />
      </Button>
    );
  }
  if (step === 2) {
    return (
      <>
        <Button variant="outline" onClick={() => onStep(1)} className="gap-2 rounded-xl">
          <ArrowLeft className="size-4" />
          Back to details
        </Button>
        <Button onClick={() => onStep(3)} className="gap-2 rounded-xl" disabled={!assignedPathway}>
          {assignedPathway ? "Open IRCC forms" : "Select a pathway first"}
          <ChevronRight className="size-4" />
        </Button>
      </>
    );
  }
  return (
  <>
    <Button variant="outline" onClick={() => onStep(2)} className="gap-2 rounded-xl">
      <ArrowLeft className="size-4" />
      Back to pathway
    </Button>
  </>
  );
}
