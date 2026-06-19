import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { RcicCommunityClient } from "./rcic-community-client";

export async function generateMetadata() {
  return generateMeta({
    title: "RCIC Community — RCICMASTER",
    description: "Peer forum for registered immigration consultants.",
    canonical: "/dashboard/rcic-community",
  });
}

export default function RcicCommunityPage() {
  return (
    <Suspense fallback={null}>
      <RcicCommunityClient />
    </Suspense>
  );
}
