import { Suspense } from "react";
import AdminWhatsAppInboxClient from "./whatsapp-inbox-client";

export default function AdminWhatsAppInboxPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading WhatsApp inbox…</div>}>
      <AdminWhatsAppInboxClient />
    </Suspense>
  );
}
