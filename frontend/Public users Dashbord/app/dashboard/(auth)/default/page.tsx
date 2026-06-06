import { generateMeta } from "@/lib/utils";
import { ClientDashboard } from "./client-dashboard";

export async function generateMetadata() {
  return generateMeta({
    title: "User Dashboard",
    description: "Your personal immigration journey dashboard — Way To Canada.",
    canonical: "/default",
  });
}

export default function Page() {
  return <ClientDashboard />;
}

