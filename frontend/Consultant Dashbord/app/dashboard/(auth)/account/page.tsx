import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { AccountClient } from "./account-client";

export async function generateMetadata() {
  return generateMeta({
    title: "My Account — WayToCanada",
    description: "View and update your consultant profile.",
    canonical: "/dashboard/account",
  });
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading account…</div>}>
      <AccountClient />
    </Suspense>
  );
}
