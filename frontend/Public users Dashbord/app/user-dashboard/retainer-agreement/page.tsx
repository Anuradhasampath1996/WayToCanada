import { generateMeta } from "@/lib/utils";
import { RetainerAgreementClient } from "./retainer-agreement-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Retainer Agreement",
    description: "View, sign, or upload your retainer agreement.",
    canonical: "/user-dashboard/retainer-agreement",
  });
}

export default function Page() {
  return <RetainerAgreementClient />;
}
