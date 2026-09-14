import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { TeamClient } from "./team-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Team Management — RCICMASTER",
    description: "Invite staff and manage practice workspace access.",
    canonical: "/dashboard/team",
  });
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading team…</div>}>
      <TeamClient />
    </Suspense>
  );
}
