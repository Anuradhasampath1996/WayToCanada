import { AgreementTokenClient } from "./agreement-token-client";

export default async function AgreementTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AgreementTokenClient token={token} />;
}
