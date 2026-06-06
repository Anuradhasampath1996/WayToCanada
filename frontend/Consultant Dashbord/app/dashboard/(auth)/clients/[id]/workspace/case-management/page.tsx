import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CaseManagementClient } from "./case-management-client";

export default function CaseManagementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CaseManagementClient paramsPromise={params} />
    </Suspense>
  );
}
