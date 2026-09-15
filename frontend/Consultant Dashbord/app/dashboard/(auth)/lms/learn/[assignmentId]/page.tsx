import { generateMeta } from "@/lib/utils";
import { LmsLearnClient } from "./lms-learn-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Learning — Exam Prep LMS",
    description: "Continue your purchased exam prep course.",
    canonical: "/dashboard/lms",
  });
}

export default async function ConsultantLmsLearnPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  return <LmsLearnClient assignmentId={assignmentId} />;
}
