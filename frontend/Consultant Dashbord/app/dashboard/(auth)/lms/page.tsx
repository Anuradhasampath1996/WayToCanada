import { generateMeta } from "@/lib/utils";
import { LmsHubClient } from "./lms-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Exam Prep LMS — RCICMASTER",
    description: "Browse published exam prep courses and assign them to your clients.",
    canonical: "/dashboard/lms",
  });
}

export default function ConsultantLmsPage() {
  return <LmsHubClient />;
}
