import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ClientRequestsClient } from "./client-requests-client";

export default function ClientRequestsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ClientRequestsClient />
    </Suspense>
  );
}
