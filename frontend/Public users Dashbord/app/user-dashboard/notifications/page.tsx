import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import NotificationsClient from "./notifications-client";

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-40">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NotificationsClient />
    </Suspense>
  );
}
