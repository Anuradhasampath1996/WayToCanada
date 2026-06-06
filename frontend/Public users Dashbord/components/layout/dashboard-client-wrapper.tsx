"use client";

import { IAQNavProvider } from "@/context/questionnaire-nav-context";
import { ClientJourneyProvider } from "@/context/client-journey-context";

export function DashboardClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClientJourneyProvider>
      <IAQNavProvider>{children}</IAQNavProvider>
    </ClientJourneyProvider>
  );
}
