import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { MarketingServiceClient } from "./marketing-service-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const titles: Record<string, string> = {
    "website-builder": "Website Builder",
    "social-media": "Social Media Management",
    "google-ads": "Google Ads Campaigns",
  };
  return generateMeta({
    title: `${titles[slug] ?? "Marketing Service"} — WayToCanada`,
    description: "Marketing services for RCIC consultants.",
    canonical: `/dashboard/marketing/${slug}`,
  });
}

export default async function MarketingServicePage({ params }: Props) {
  const { slug } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <MarketingServiceClient slug={slug} />
    </Suspense>
  );
}
