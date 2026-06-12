import { Suspense } from "react";
import { MeetTokenClient } from "./meet-token-client";

export default async function MeetTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">Loading…</div>}>
      <MeetTokenClient token={token} />
    </Suspense>
  );
}
