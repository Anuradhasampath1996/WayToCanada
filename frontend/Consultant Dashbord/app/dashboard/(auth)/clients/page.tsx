import { generateMeta } from "@/lib/utils";
import { ClientsPageClient } from "./clients-client";

export async function generateMetadata() {
  return generateMeta({
    title: "My Clients — RCICMASTER",
    description: "Manage your immigration clients.",
    canonical: "/dashboard/clients",
  });
}

export default function ClientsPage() {
  return <ClientsPageClient />;
}
