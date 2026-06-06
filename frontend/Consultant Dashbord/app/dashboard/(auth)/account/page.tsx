import { generateMeta } from "@/lib/utils";
import { AccountClient } from "./account-client";

export async function generateMetadata() {
  return generateMeta({
    title: "My Account — WayToCanada",
    description: "View and update your consultant profile.",
    canonical: "/dashboard/account",
  });
}

export default function AccountPage() {
  return <AccountClient />;
}
