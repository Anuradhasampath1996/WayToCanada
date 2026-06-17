import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { StorageClient } from "./storage-client";

export async function generateMetadata() {
  return generateMeta({
    title: "My Document Storage — WayToCanada",
    description: "Personal folders and files for your practice.",
    canonical: "/dashboard/storage",
  });
}

export default function StoragePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading storage…</div>}>
      <StorageClient />
    </Suspense>
  );
}
