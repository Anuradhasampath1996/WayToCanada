import { generateMeta } from "@/lib/utils";
import { ClientDashboard } from "../dashboard/(auth)/default/client-dashboard";

export async function generateMetadata() {
  return generateMeta({
    title: "Your Journey",
    description: "Track your immigration case step by step — Way To Canada.",
    canonical: "/user-dashboard",
  });
}

export default function Page() {
  return <ClientDashboard />;
}
