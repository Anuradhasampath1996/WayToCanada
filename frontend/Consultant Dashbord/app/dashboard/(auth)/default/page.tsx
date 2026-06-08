import { generateMeta } from "@/lib/utils";
import { ConsultantDashboard } from "./components/consultant-dashboard";

export async function generateMetadata() {
  return generateMeta({
    title: "Consultant Dashboard — WayToCanada",
    description: "Manage your immigration consulting practice with clients, cases, calendar, and IRCC updates.",
    canonical: "/consultantdashboard",
  });
}

export default function Page() {
  return <ConsultantDashboard />;
}
