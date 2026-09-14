"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { academyGet, academySend } from "@/lib/academy";

type Course = { id: number; title: string; description?: string; difficulty?: string; estimated_hours?: number };

export default function AcademyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    academyGet<{ data: Course[] }>("/courses")
      .then((r) => setCourses(r.data))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Courses</h2>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {courses.map((course) => (
          <button
            key={course.id}
            className="rounded-lg border p-4 text-left"
            onClick={() => academyGet(`/courses/${course.id}`).then(setOpen)}
          >
            <div className="font-medium">{course.title}</div>
            <p className="text-sm text-muted-foreground">{course.description}</p>
          </button>
        ))}
      </div>
      {open && (
        <div className="rounded-lg border p-4 text-sm">
          <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(open, null, 2)}</pre>
          {(open as { can_switch_to_latest?: boolean }).can_switch_to_latest && (
            <button
              className="mt-3 rounded border px-3 py-1"
              onClick={() => academySend(`/courses/${(open as { course: { id: number } }).course.id}/switch-latest`, "POST")}
            >
              Switch to latest version
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Open a course, complete lessons from the payload, then use Practice and Mock Exams.{" "}
        <Link className="underline" href="/dashboard/academy/practice">
          Go to Practice
        </Link>
      </p>
    </div>
  );
}
