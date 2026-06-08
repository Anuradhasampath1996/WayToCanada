"use client";

import { InteractiveApplicationForms } from "@/components/interactive-application-forms";
import { ClientJourneyGate } from "@/components/client-journey-gate";
import { ClientJourneyPageChrome, FormsProgressStrip } from "@/components/client-workspace-ui";
import { useClientJourney } from "@/context/client-journey-context";

function ApplicationFormsContent() {
  const { verification } = useClientJourney();
  return (
    <ClientJourneyPageChrome
      stepId="forms"
      description="Complete the IRCC forms assigned by your consultant. Your questionnaire answers are used to pre-fill fields when possible."
    >
      {verification && verification.total_forms > 0 && (
        <FormsProgressStrip
          submitted={verification.submitted_count}
          total={verification.total_forms}
          reviewed={verification.reviewed_count}
        />
      )}
      <InteractiveApplicationForms />
    </ClientJourneyPageChrome>
  );
}

export default function ApplicationFormsPage() {
  return (
    <ClientJourneyGate stepId="forms">
      <ApplicationFormsContent />
    </ClientJourneyGate>
  );
}
