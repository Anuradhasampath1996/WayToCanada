import { Suspense } from "react";
import { MarketingReturnClient } from "./return-client";

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function MarketingReturnPage({ searchParams }: Props) {
  const { session_id: sessionId = "" } = await searchParams;
  return (
    <Suspense fallback={null}>
      <MarketingReturnClient sessionId={sessionId} />
    </Suspense>
  );
}
