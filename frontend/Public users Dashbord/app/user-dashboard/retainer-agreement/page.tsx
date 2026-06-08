"use client";

import { RetainerAgreementClient } from "./retainer-agreement-client";
import { ClientJourneyGate } from "@/components/client-journey-gate";

export default function Page() {
  return (
    <ClientJourneyGate stepId="retainer">
      <RetainerAgreementClient />
    </ClientJourneyGate>
  );
}
