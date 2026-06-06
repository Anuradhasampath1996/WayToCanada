import { RetainerAgreementClient } from "./retainer-agreement-client";

export default function RetainerAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  return <RetainerAgreementClient paramsPromise={params} />;
}
