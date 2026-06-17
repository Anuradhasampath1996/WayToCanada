import { Suspense } from "react";
import { ReturnClient } from "./return-client";

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function StorageReturnPage({ searchParams }: Props) {
  const params = await searchParams;
  const sessionId = params.session_id ?? "";

  return (
    <Suspense>
      <ReturnClient sessionId={sessionId} />
    </Suspense>
  );
}
