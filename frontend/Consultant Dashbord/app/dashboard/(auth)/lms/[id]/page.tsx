import { Suspense } from "react";
import { generateMeta } from "@/lib/utils";
import { LmsCourseDetailClient } from "./lms-course-detail-client";

export async function generateMetadata() {
  return generateMeta({
    title: "Course details — Exam Prep LMS",
    description: "Buy and start exam prep courses for your practice.",
    canonical: "/dashboard/lms",
  });
}

export default async function ConsultantLmsCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading course…</div>}>
      <LmsCourseDetailClient courseId={id} />
    </Suspense>
  );
}
