import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { WorkspacePageClient } from "./workspace-client";

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WorkspacePageClient paramsPromise={params} />
    </Suspense>
  );
}
