"use client";

import { Suspense, use } from "react";
import { Loader2 } from "lucide-react";
import { DocumentWorkshopClient } from "./document-workshop-client";

export default function DocumentWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DocumentWorkshopPageInner paramsPromise={params} />
    </Suspense>
  );
}

function DocumentWorkshopPageInner({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  return <DocumentWorkshopClient profileId={id} />;
}
