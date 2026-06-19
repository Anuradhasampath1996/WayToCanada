"use client";

import { useClientJourney } from "@/context/client-journey-context";
import { ConsultantPicker } from "@/components/consultant-picker";
import { Loader2 } from "lucide-react";

export function ChooseConsultantPage() {
  const { loading, consultant, pendingRequest, client, refresh } = useClientJourney();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (consultant) {
    return (
      <div className="rounded-xl border p-8 text-center max-w-lg mx-auto">
        <p className="font-semibold">You are already connected with {consultant.name}.</p>
        <p className="text-sm text-muted-foreground mt-2">Return to your dashboard to continue your journey.</p>
      </div>
    );
  }

  const firstName = (client?.name ?? "there").split(" ")[0];

  return (
    <ConsultantPicker
      clientName={firstName}
      pendingRequest={pendingRequest}
      onUpdated={refresh}
    />
  );
}
