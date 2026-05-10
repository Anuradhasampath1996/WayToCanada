import { SubscribeClient } from "./subscribe-client";

// ── Server Component: reads searchParams and passes them to the client ────
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  return (
    <SubscribeClient
      packageId={Number(params.packageId ?? "0")}
      packageName={decodeURIComponent(params.packageName ?? "")}
      price={Number(params.price ?? "0")}
      billingCycle={(params.billingCycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"}
      lang={(params.lang === "fr" ? "fr" : "en") as "en" | "fr"}
    />
  );
}
