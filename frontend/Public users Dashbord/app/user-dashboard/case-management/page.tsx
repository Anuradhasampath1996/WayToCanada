"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CaseManagementClient } from "./case-management-client";
import { ClientJourneyGate } from "@/components/client-journey-gate";

export default function UserCaseManagementPage() {
  return (
    <ClientJourneyGate stepId="documents">
      <Suspense fallback={
        <div className="flex items-center justify-center py-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <CaseManagementClient />
      </Suspense>
    </ClientJourneyGate>
  );
}
