import { LettersHubClient } from "./letters-hub-client";

export const metadata = {
  title: "Letters | WayToCanada",
  description: "Draft immigration letters with AI — client-aware or generic templates.",
};

export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.client ?? params.clientId;
  const initialClientId = raw ? Number(raw) : null;
  const parsed = initialClientId && Number.isFinite(initialClientId) && initialClientId > 0 ? initialClientId : null;

  return <LettersHubClient initialClientId={parsed} />;
}
