"use client";

import { Suspense } from "react";
import { SupportTicketWidget } from "@/components/support/support-ticket-widget";

export function SupportTicketFab() {
  return (
    <Suspense fallback={null}>
      <SupportTicketWidget />
    </Suspense>
  );
}
