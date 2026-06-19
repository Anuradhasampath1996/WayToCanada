import { Suspense } from "react";
import AdminRcicCommunityClient from "./rcic-community-client";

export default function AdminRcicCommunityPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12 text-muted-foreground">Loading…</div>}>
      <AdminRcicCommunityClient />
    </Suspense>
  );
}
