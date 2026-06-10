import { ReturnClient } from "./return-client";

interface SearchParams {
  session_id?: string;
}

export default async function SubscribeReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const sessionId = params.session_id ?? "";

  return <ReturnClient sessionId={sessionId} />;
}
