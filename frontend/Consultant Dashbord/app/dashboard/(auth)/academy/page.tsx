"use client";

import { useEffect, useState } from "react";
import { academyGet } from "@/lib/academy";

type Dashboard = {
  exam_readiness_percent: number;
  course_completion_percent: number;
  independent_mcq_accuracy: number | null;
  case_based_accuracy: number | null;
  mock_exam_average: number | null;
  questions_attempted: number;
  study_streak_days: number;
  study_hours: number;
  weak_topics: { name: string; accuracy: number }[];
  today: { label: string }[];
  readiness_label: string;
};

export default function AcademyDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    academyGet<Dashboard>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading Academy…</p>;

  const cards = [
    ["Exam Readiness", `${data.exam_readiness_percent}%`],
    ["Course Completion", `${data.course_completion_percent}%`],
    ["MCQ Accuracy", data.independent_mcq_accuracy == null ? "—" : `${data.independent_mcq_accuracy}%`],
    ["Case-Based Accuracy", data.case_based_accuracy == null ? "—" : `${data.case_based_accuracy}%`],
    ["Mock Average", data.mock_exam_average == null ? "—" : `${data.mock_exam_average}%`],
    ["Questions Attempted", String(data.questions_attempted)],
    ["Study Streak", `${data.study_streak_days} days`],
    ["Study Hours", String(data.study_hours)],
  ];

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">{data.readiness_label}</p>
      <div className="grid gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Weak Areas</h2>
          {data.weak_topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough attempts yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.weak_topics.map((t) => (
                <li key={t.name}>
                  {t.name}: {t.accuracy}%
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Recommended Today</h2>
          <ul className="space-y-1 text-sm">
            {data.today.map((item) => (
              <li key={item.label}>{item.label}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
