import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { NotificationsClient } from "./notifications-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Notifications — RCICMASTER",
    description: "View and manage your consultant notifications.",
    canonical: "/dashboard/notifications",
  });
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading notifications…</div>}>
      <NotificationsClient />
    </Suspense>
  );
}
