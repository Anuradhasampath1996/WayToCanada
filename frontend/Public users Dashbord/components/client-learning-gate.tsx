"use client";

import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientJourney } from "@/context/client-journey-context";
import { LEARNING_LOCKED_REASON } from "@/lib/client-journey";

export function ClientLearningGate({ children }: { children: React.ReactNode }) {
  const journey = useClientJourney();

  if (journey.loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!journey.canAccessLearning) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center max-w-md mx-auto">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Lock className="size-7 text-muted-foreground/50" />
        </div>
        <h2 className="text-xl font-bold">Learning courses locked</h2>
        <p className="text-sm text-muted-foreground">{LEARNING_LOCKED_REASON}</p>
        <Button variant="outline" className="rounded-xl" asChild>
          <Link href="/user-dashboard">Back to your journey</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
