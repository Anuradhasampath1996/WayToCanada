import { generateMeta } from "@/lib/utils";
import { AddClientPageClient } from "./add-client-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Add New Client — WayToCanada",
    description: "Add a new immigration client to your practice.",
    canonical: "/dashboard/clients/new",
  });
}

export default function AddClientPage() {
  return <AddClientPageClient />;
}
