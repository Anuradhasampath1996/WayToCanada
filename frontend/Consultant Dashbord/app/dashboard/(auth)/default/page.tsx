import { generateMeta } from "@/lib/utils";
import { DashboardBanner } from "./components/dashboard-banner";
import { IrccNewsFeed } from "./components/ircc-news-feed";

export async function generateMetadata() {
  return generateMeta({
    title: "Consultant Dashboard — WayToCanada",
    description: "Manage your immigration consulting practice with real-time IRCC updates.",
    canonical: "/consultantdashboard",
  });
}

export default function Page() {
  return (
    <div className="space-y-6 pb-8">
      {/* Banner slider */}
      <DashboardBanner />

      {/* IRCC News Feed */}
      <IrccNewsFeed />
    </div>
  );
}
