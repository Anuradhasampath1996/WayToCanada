import { Suspense } from "react";
import { PayTokenClient } from "./pay-token-client";

export default async function PayTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">Loading…</div>}>
      <PayTokenClient token={token} />
    </Suspense>
  );
}
