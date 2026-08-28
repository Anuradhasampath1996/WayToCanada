"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  CloudUpload,
  FilePenLine,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JourneyStep, JourneyStepId } from "@/lib/client-journey";

const STEP_ILLUSTRATIONS: Record<JourneyStepId, { src: string; alt: string }> = {
  questionnaire: {
    src: "/images/journey/step-1-profile.webp",
    alt: "Complete your profile illustration",
  },
  retainer: {
    src: "/images/journey/step-2-agreement.webp",
    alt: "Sign agreement illustration",
  },
  forms: {
    src: "/images/journey/step-3-forms.webp",
    alt: "Documents and messages illustration",
  },
  documents: {
    src: "/images/journey/step-4-documents.webp",
    alt: "Case review illustration",
  },
};

const HOW_IT_WORKS: Array<{
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}> = [
  {
    icon: ClipboardList,
    title: "Complete your profile",
    description: "Share your personal and case details.",
  },
  {
    icon: FilePenLine,
    title: "Sign agreement",
    description: "Review and e-sign your consultant agreement.",
  },
  {
    icon: CloudUpload,
    title: "Upload documents",
    description: "Securely upload your supporting documents and messages.",
  },
  {
    icon: BadgeCheck,
    title: "Case review & next steps",
    description: "We review your file and provide clear next steps.",
  },
];

function JourneyStepperStrip({
  steps,
  highlightId,
}: {
  steps: JourneyStep[];
  highlightId?: string;
}) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {steps.map((step, i) => {
        const highlighted = highlightId === step.id || step.status === "active";
        const art = STEP_ILLUSTRATIONS[step.id];
        return (
          <li key={step.id} className="relative flex flex-col items-center text-center">
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "pointer-events-none absolute left-[calc(50%+2.25rem)] top-[2.75rem] hidden h-0 w-[calc(100%-2rem)] border-t-2 border-dashed sm:block",
                  step.status === "done" || highlighted ? "border-primary/35" : "border-border",
                )}
                aria-hidden
              />
            )}

            <div
              className={cn(
                "relative z-[1] w-full max-w-[9.5rem] overflow-hidden rounded-2xl border bg-white p-2 transition-all duration-300",
                highlighted && "border-primary/40 shadow-md shadow-primary/10 ring-2 ring-primary/20 scale-[1.02]",
                step.status === "done" && !highlighted && "border-primary/25",
                step.status === "locked" && "border-border/70 opacity-60",
                step.status === "waiting" && !highlighted && "border-amber-200",
                !highlighted && step.status !== "locked" && step.status !== "done" && "border-border/80",
              )}
            >
              <div className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted/30">
                <Image
                  src={art.src}
                  alt={art.alt}
                  fill
                  className={cn(
                    "object-contain p-1 transition-all duration-300",
                    step.status === "locked" && "grayscale-[40%]",
                  )}
                  sizes="150px"
                  unoptimized
                />
                {(step.status === "done" || step.status === "locked") && (
                  <div className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-border/60">
                    {step.status === "done" ? (
                      <CheckCircle2 className="size-3.5 text-primary" />
                    ) : (
                      <Lock className="size-3 text-muted-foreground/70" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <p
              className={cn(
                "mt-3 text-sm font-semibold leading-snug",
                highlighted ? "text-primary" : "text-foreground",
                step.status === "locked" && "text-muted-foreground",
              )}
            >
              <span className="mr-1 tabular-nums">{step.number}</span>
              {step.navLabel}
            </p>
            <p
              className={cn(
                "mt-1 max-w-[11.5rem] text-[12px] leading-snug text-muted-foreground",
                step.status === "locked" && "text-muted-foreground/50",
              )}
            >
              {step.shortBlurb}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Nested current-step card — shows the illustration for the active step. */
export function ClientCurrentStepHero({ step }: { step: JourneyStep | undefined }) {
  if (!step) return null;

  const art = STEP_ILLUSTRATIONS[step.id];
  const isWaiting = step.status === "waiting";
  const isLocked = step.status === "locked";
  const canAct = !isLocked && !isWaiting;

  return (
    <div
      key={step.id}
      className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm"
    >
      <div className="grid items-center gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="relative order-2 flex min-h-[220px] items-center justify-center bg-gradient-to-br from-primary/[0.04] via-white to-muted/30 p-4 sm:min-h-[280px] sm:p-6 lg:order-1 lg:min-h-[300px]">
          <Image
            src={art.src}
            alt={art.alt}
            width={640}
            height={480}
            priority
            className="relative z-[1] h-auto w-full max-w-[400px] object-contain animate-in fade-in zoom-in-95 duration-500"
            unoptimized
          />
        </div>

        <div className="order-1 flex flex-col justify-center space-y-4 p-5 sm:p-7 lg:order-2">
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
              isWaiting
                ? "bg-amber-100 text-amber-900"
                : isLocked
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/15 text-primary",
            )}
          >
            {isWaiting ? "Waiting" : isLocked ? "Up next" : "Current step"}
          </span>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
              {step.number}. {step.title}
            </h3>
            <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>

          {isLocked && step.lockedReason && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {step.lockedReason}
            </p>
          )}

          {isWaiting && (
            <p className="flex items-start gap-2 text-xs text-amber-800/90">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Your consultant is working on this step. You&apos;ll be notified when it&apos;s your turn again.
            </p>
          )}

          {canAct && (
            <Button
              size="lg"
              className="mt-1 h-11 w-full rounded-lg text-sm font-semibold sm:w-auto sm:min-w-[200px]"
              asChild
            >
              <Link href={step.href}>
                {step.actionLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function HowItWorksSection() {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold tracking-tight sm:text-lg">How it works</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {HOW_IT_WORKS.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-border/70 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {i + 1}. {item.title}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecurityFooter() {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-primary/[0.07] px-4 py-3.5 text-sm sm:items-center">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:mt-0" />
      <p className="leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Your information is secure and confidential.</span>{" "}
        We use industry-standard security to protect your data.
      </p>
    </div>
  );
}

/**
 * Single outer box containing:
 * 1) Your 4-Step Journey stepper (with per-step illustrations)
 * 2) Nested Current step card (active step illustration)
 * 3) How it works
 * 4) Security footer
 */
export function ClientJourneyOverviewPanel({
  steps,
  currentStep,
  highlightId,
}: {
  steps: JourneyStep[];
  currentStep: JourneyStep | undefined;
  highlightId?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-muted/20 shadow-sm">
      <div className="space-y-6 p-5 sm:space-y-8 sm:p-7">
        <div className="space-y-6">
          <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            Your 4-Step Journey
          </h2>
          <JourneyStepperStrip steps={steps} highlightId={highlightId} />
        </div>

        <ClientCurrentStepHero step={currentStep} />

        <HowItWorksSection />

        <SecurityFooter />
      </div>
    </section>
  );
}

export function ClientJourneyStepper({
  steps,
  highlightId,
}: {
  steps: JourneyStep[];
  highlightId?: string;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="mb-6 text-base font-bold tracking-tight text-foreground sm:text-lg">
        Your 4-Step Journey
      </h2>
      <JourneyStepperStrip steps={steps} highlightId={highlightId} />
    </section>
  );
}

export function ClientHowItWorks() {
  return <HowItWorksSection />;
}

export function ClientSecurityBanner() {
  return <SecurityFooter />;
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
  const current =
    steps.find((s) => s.id === highlightId) ?? steps.find((s) => s.status === "active");
  if (compact) {
    return <ClientJourneyStepper steps={steps} highlightId={highlightId} />;
  }
  return (
    <ClientJourneyOverviewPanel
      steps={steps}
      currentStep={current}
      highlightId={highlightId}
    />
  );
}

export function ClientNextStepCard({ step }: { step: JourneyStep | undefined }) {
  return <ClientCurrentStepHero step={step} />;
}
