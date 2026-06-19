import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { BillingClient } from "./billing-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Billing — RCICMASTER",
    description: "Manage your subscription, invoices, and billing.",
    canonical: "/dashboard/billing",
  });
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading billing…</div>}>
      <BillingClient />
    </Suspense>
  );
}
