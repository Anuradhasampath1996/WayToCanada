import Link from "next/link";

export default function AcademyExamPrepPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Exam Preparation</h2>
      <p className="text-sm text-muted-foreground">
        Independent RCIC Exam Preparation Program. Use courses, Practice, and configurable mock exams. The seeded IRB
        mock is one template — not a hardcoded engine format.
      </p>
      <div className="flex gap-3 text-sm">
        <Link className="underline" href="/dashboard/academy/practice">
          Practice
        </Link>
        <Link className="underline" href="/dashboard/academy/exams">
          Mock Exams
        </Link>
        <Link className="underline" href="/dashboard/academy/planner">
          Study Planner
        </Link>
      </div>
    </div>
  );
}
