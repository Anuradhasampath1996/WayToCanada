"use client";

import Link from "next/link";
import { Loader2, Lock, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientJourney } from "@/context/client-journey-context";
import { PathwayAssignedCard, ClientJourneyBreadcrumb } from "@/components/client-workspace-ui";

export default function MyPathwayPage() {
  const { loading, caseFile, meta } = useClientJourney();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meta.pathwayAssigned) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center space-y-4">
        <Lock className="mx-auto size-10 text-muted-foreground/50" />
        <h1 className="text-xl font-bold">Pathway not assigned yet</h1>
        <p className="text-sm text-muted-foreground">
          Your consultant is still reviewing your profile and selecting the best immigration route.
        </p>
        <Button asChild>
          <Link href="/user-dashboard">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <ClientJourneyBreadcrumb pageLabel="My pathway" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Route className="size-6" />
          My immigration pathway
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Summary confirmed by your consultant. Contact them if you have questions.
        </p>
      </div>

      <PathwayAssignedCard pathway={meta.pathwayAssigned} caseFile={caseFile} />

      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">What happens next?</p>
        <ol className="list-decimal list-inside space-y-1 leading-relaxed">
          {!caseFile?.agreement_signed_at && <li>Sign your retainer agreement</li>}
          <li>Complete assigned IRCC application forms</li>
          <li>Upload documents and track your application package</li>
        </ol>
      </div>

      <Button variant="outline" asChild>
        <Link href="/user-dashboard">← Back to home</Link>
      </Button>
    </div>
  );
}
