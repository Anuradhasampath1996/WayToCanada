"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientPipelineBoard } from "@/components/clients/client-pipeline-board";

export function CasePipelineClient() {
  return (
    <div className="space-y-5 pb-10">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight md:text-2xl">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Briefcase className="size-4" />
              </span>
              Application Progress Board
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Drag client cards between stages to update progress — from retainer to submission.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/dashboard/clients">View all clients</Link>
          </Button>
        </div>
      </section>

      <ClientPipelineBoard showToolbar showStats />
    </div>
  );
}
