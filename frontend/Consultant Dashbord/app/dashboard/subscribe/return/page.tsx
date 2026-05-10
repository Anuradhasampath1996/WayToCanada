import { ReturnClient } from "./return-client";

interface SearchParams {
  subscription_id?: string;
  ba_token?:        string;
  token?:           string;
}

export default async function SubscribeReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // PayPal passes `subscription_id` in the query string on return
  const subscriptionId = params.subscription_id ?? params.ba_token ?? params.token ?? "";

  return <ReturnClient subscriptionId={subscriptionId} />;
}
