import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CasePipelineClient } from "./case-pipeline-client";

export default function CasePipelinePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CasePipelineClient />
    </Suspense>
  );
}
