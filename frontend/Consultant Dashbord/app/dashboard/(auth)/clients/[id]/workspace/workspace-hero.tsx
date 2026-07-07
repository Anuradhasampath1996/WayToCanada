"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Mail, RefreshCw, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CASE_WORKFLOW_STEPS } from "./workspace-flow-ui";

const STATUS_LABELS: Record<string, string> = {
  PENDING_ASSESSMENT: "Pending Assessment",
  PATHWAY_SELECTED: "Pathway Selected",
  AGREEMENT_SENT: "Agreement Sent",
  AGREEMENT_SIGNED: "Agreement Signed",
};

export function WorkspaceHero({
  profileId,
  clientName,
  clientEmail,
  activeStep,
  status,
  statusTone,
  pathway,
  loading,
  onRefresh,
}: {
  profileId: string;
  clientName: string;
  clientEmail: string;
  activeStep: number;
  status: string;
  statusTone: "amber" | "blue" | "emerald";
  pathway: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const step = CASE_WORKFLOW_STEPS[activeStep] ?? CASE_WORKFLOW_STEPS[0];
  const illustration = step.illustration;
  const toneStyles = {
    amber: "border-amber-200/60 bg-amber-500/10 text-amber-700",
    blue: "border-blue-200/60 bg-blue-500/10 text-blue-700",
    emerald: "border-emerald-200/60 bg-emerald-500/10 text-emerald-700",
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,40%)] lg:items-stretch">
        {/* Left — copy & actions */}
        <div className="relative z-10 flex min-w-0 flex-col justify-center p-5 sm:p-6 md:p-7">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4 h-8 w-fit px-2 text-muted-foreground">
            <Link href={`/dashboard/clients/${profileId}`}>
              <ArrowLeft className="mr-1.5 size-4" />
              Back to profile
            </Link>
          </Button>

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              Step {activeStep + 1} of {CASE_WORKFLOW_STEPS.length}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-[2rem] md:leading-tight">
              {step.fullLabel}
            </h1>
            <p className="text-sm text-muted-foreground break-words">
              <span className="font-semibold text-foreground">{clientName}</span>
              <span className="mx-1.5 text-border">·</span>
              <span className="text-muted-foreground">{clientEmail}</span>
            </p>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("h-7 rounded-lg px-2.5 text-xs font-medium", toneStyles[statusTone])}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
            {pathway && (
              <Badge variant="outline" className="h-7 rounded-lg px-2.5 text-xs font-medium">
                {pathway}
              </Badge>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" asChild>
              <Link href={`/dashboard/letters?client=${profileId}`}>
                <Mail className="size-3.5" />
                Draft letter
              </Link>
            </Button>
            {pathway && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" asChild>
                <Link href={`/dashboard/clients/${profileId}/workspace/lms`}>
                  <GraduationCap className="size-3.5" />
                  Exam prep courses
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh workspace"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Right — full-height illustration */}
        <div className="relative hidden min-h-0 lg:block">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-100/90 via-primary/5 to-teal-50/80 dark:from-violet-950/40 dark:via-primary/10 dark:to-teal-950/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(139,92,246,0.12),transparent_55%)]" />
          <Image
            key={illustration}
            src={illustration}
            alt={step.illustrationAlt}
            fill
            sizes="(max-width: 1024px) 0vw, 40vw"
            className="object-cover object-center transition-opacity duration-500 ease-out"
            priority
          />
          {/* Blend edge into left column */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-card to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/10 via-transparent to-transparent" />
        </div>
      </div>

      {/* Mobile — wide banner strip */}
      <div className="relative h-44 overflow-hidden border-t border-border/40 sm:h-52 lg:hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100/80 via-primary/5 to-teal-50/70 dark:from-violet-950/30 dark:to-teal-950/20" />
        <Image
          key={`${illustration}-mobile`}
          src={illustration}
          alt={step.illustrationAlt}
          fill
          sizes="100vw"
          className="object-cover object-[center_35%]"
          priority
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
      </div>
    </section>
  );
}
