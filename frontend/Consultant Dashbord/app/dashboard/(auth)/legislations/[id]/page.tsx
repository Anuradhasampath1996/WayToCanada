import { Suspense } from "react";
import LegislationDocumentClient from "./legislation-document-client";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 p-6 text-muted-foreground text-sm">Loading document…</div>
      }
    >
      <LegislationDocumentClient id={id} />
    </Suspense>
  );
}
