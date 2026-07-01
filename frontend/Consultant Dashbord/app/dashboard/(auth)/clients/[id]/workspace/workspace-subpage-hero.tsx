"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkspaceSubpageHero({
  profileId,
  stepLabel,
  title,
  description,
  illustration,
  illustrationAlt,
  backHref,
  backLabel = "Back to Intake & pathway",
  children,
  className,
}: {
  profileId: string;
  stepLabel: string;
  title: string;
  description: string;
  illustration: string;
  illustrationAlt: string;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const workspaceHref = backHref ?? `/dashboard/clients/${profileId}/workspace`;

  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm", className)}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,38%)] lg:items-stretch">
        <div className="flex min-w-0 flex-col justify-center p-5 sm:p-6 md:p-7">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4 h-8 w-fit px-2 text-muted-foreground">
            <Link href={workspaceHref}>
              <ArrowLeft className="mr-1.5 size-4" />
              {backLabel}
            </Link>
          </Button>

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{stepLabel}</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>

          {children ? <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div> : null}
        </div>

        <div className="relative hidden min-h-[200px] lg:block">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-100/90 via-primary/5 to-teal-50/80 dark:from-violet-950/40 dark:via-primary/10 dark:to-teal-950/20" />
          <Image
            src={illustration}
            alt={illustrationAlt}
            fill
            sizes="(max-width: 1024px) 0vw, 38vw"
            className="object-cover object-center"
            priority
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-card to-transparent" />
        </div>
      </div>

      <div className="relative h-40 overflow-hidden border-t border-border/40 sm:h-48 lg:hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100/80 via-primary/5 to-teal-50/70" />
        <Image src={illustration} alt={illustrationAlt} fill sizes="100vw" className="object-cover object-center" priority />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/15 to-transparent" />
      </div>
    </section>
  );
}
