import { Suspense } from "react";
import AdminSupportTicketsClient from "./support-tickets-client";

export default function AdminSupportTicketsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading support tickets…</div>}>
      <AdminSupportTicketsClient />
    </Suspense>
  );
}
