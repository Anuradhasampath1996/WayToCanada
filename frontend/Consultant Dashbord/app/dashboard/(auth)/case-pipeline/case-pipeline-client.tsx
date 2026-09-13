"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientPipelineBoard } from "@/components/clients/client-pipeline-board";

const VIEWS = ["all", "in_preparation", "needs_attention", "government_processing"] as const;

export function CasePipelineClient() {
  const params = useSearchParams();
  const raw = params.get("view") ?? "all";
  const view = (VIEWS.includes(raw as (typeof VIEWS)[number]) ? raw : "all") as (typeof VIEWS)[number];
  const titles: Record<(typeof VIEWS)[number], string> = {
    all: "All cases in three groups",
    in_preparation: "In preparation",
    needs_attention: "Needs attention",
    government_processing: "Government processing",
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-8 sm:space-y-5 sm:pb-10">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Briefcase className="size-4" />
              </span>
              Application Progress Board
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              {titles[view]}. Cases stay in Assessment, Active preparation, and Post-submission. Drag does not change Phase 1–5 gates.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant={view === "all" ? "default" : "outline"} size="sm" asChild className="h-10 w-full sm:w-auto">
              <Link href="/dashboard/case-pipeline">All</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="h-10 w-full shrink-0 sm:w-auto">
              <Link href="/dashboard/clients">View all clients</Link>
            </Button>
          </div>
        </div>
      </section>

      <ClientPipelineBoard showToolbar showStats view={view} />
    </div>
  );
}
