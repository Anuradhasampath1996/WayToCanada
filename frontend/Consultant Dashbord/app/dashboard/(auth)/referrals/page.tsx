import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { ReferralsClient } from "./referrals-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Referrals & Wallet — RCICMASTER",
    description: "Share your referral link and manage your consultant wallet.",
    canonical: "/dashboard/referrals",
  });
}

export default function ReferralsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading referrals…</div>}>
      <ReferralsClient />
    </Suspense>
  );
}
