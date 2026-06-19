import { generateMeta } from "@/lib/utils";
import { MarketingClient } from "./marketing-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Marketing Services — WayToCanada",
    description: "Website builder, social media management, and Google Ads for RCIC consultants.",
    canonical: "/dashboard/marketing",
  });
}

export default function MarketingPage() {
  return <MarketingClient />;
}
