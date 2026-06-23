"use client";

import Link from "next/link";
import {
  CheckCircle2, Lock, Clock, ChevronRight, Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JourneyStep } from "@/lib/client-journey";

function StepIcon({ status }: { status: JourneyStep["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "locked") return <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />;
  if (status === "waiting") return <Clock className="h-4 w-4 text-amber-600" />;
  return <Circle className="h-4 w-4 text-primary fill-primary/20" />;
}

export function ClientJourneyTimeline({
  steps,
  compact = false,
  highlightId,
}: {
  steps: JourneyStep[];
  compact?: boolean;
  highlightId?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card", compact ? "p-4" : "p-5")}>
      {!compact && (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Your 4-step journey
        </p>
      )}
      <div className="space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const highlighted = highlightId === step.id || step.status === "active";
          return (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 shrink-0",
                  step.status === "done" && "bg-green-50 border-green-500",
                  step.status === "active" && "bg-primary/10 border-primary",
                  step.status === "waiting" && "bg-amber-50 border-amber-400",
                  step.status === "locked" && "bg-muted border-muted-foreground/20",
                )}>
                  <StepIcon status={step.status} />
                </div>
                {!isLast && (
                  <div className={cn(
                    "w-0.5 flex-1 my-1 min-h-[24px]",
                    step.status === "done" ? "bg-green-300" : "bg-border",
                  )} />
                )}
              </div>
              <div className={cn("pb-5 flex-1 min-w-0", isLast && "pb-0")}>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <p className={cn(
                    "text-sm font-semibold",
                    step.status === "done" && "text-green-700",
                    step.status === "active" && "text-primary",
                    step.status === "waiting" && "text-amber-800",
                    step.status === "locked" && "text-muted-foreground/60",
                  )}>
                    {step.number}. {step.title}
                  </p>
                  {step.status === "active" && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      Current step
                    </Badge>
                  )}
                  {step.status === "waiting" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-800 border-amber-200">
                      Waiting on consultant
                    </Badge>
                  )}
                  {step.status === "done" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">
                      Done
                    </Badge>
                  )}
                </div>
                {!compact && (
                  <p className={cn(
                    "text-xs mt-1 leading-relaxed",
                    step.status === "locked" ? "text-muted-foreground/50" : "text-muted-foreground",
                  )}>
                    {step.description}
                  </p>
                )}
                {highlighted && step.status !== "locked" && step.status !== "done" && (
                  <Button size="sm" className="mt-3 h-9 w-full text-xs sm:w-auto" asChild>
                    <Link href={step.href}>
                      {step.actionLabel}
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
                {step.status === "locked" && step.lockedReason && !compact && (
                  <p className="text-[11px] text-muted-foreground/70 mt-2 flex items-center gap-1">
                    <Lock className="h-3 w-3 shrink-0" /> {step.lockedReason}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClientNextStepCard({ step }: { step: JourneyStep | undefined }) {
  if (!step) return null;

  const tone =
    step.status === "waiting"
      ? "border-amber-200 bg-gradient-to-br from-amber-50/80 to-background"
      : "border-primary/25 bg-gradient-to-br from-primary/5 to-background";

  return (
    <div className={cn("rounded-xl border-2 p-5 sm:p-6", tone)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {step.status === "waiting" ? "Waiting for your consultant" : "Your next step"}
      </p>
      <h2 className="text-xl font-bold tracking-tight">{step.title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-xl">{step.description}</p>
      {step.lockedReason && step.status === "locked" && (
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> {step.lockedReason}
        </p>
      )}
      {step.status !== "locked" && (
        <Button className="mt-4" asChild>
          <Link href={step.href}>
            {step.actionLabel}
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
