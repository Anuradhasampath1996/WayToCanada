"use client";

import { Loader2 } from "lucide-react";
import { useClientJourney } from "@/context/client-journey-context";
import type { JourneyStepId } from "@/lib/client-journey";
import { ClientLockedPage } from "@/components/client-workspace-ui";

export function ClientJourneyGate({
  stepId,
  children,
}: {
  stepId: JourneyStepId;
  children: React.ReactNode;
}) {
  const journey = useClientJourney();

  if (journey.loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!journey.canAccess(stepId)) {
    const step = journey.steps.find((s) => s.id === stepId);
    return <ClientLockedPage step={step} />;
  }

  return <>{children}</>;
}
