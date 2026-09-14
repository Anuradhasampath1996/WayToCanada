"use client";

import { useEffect, useState } from "react";
import { academyGet, academySend } from "@/lib/academy";

type Template = { id: number; name: string; duration_minutes: number; total_questions: number };
type ExamView = {
  attempt: { id: number; status: string; expires_at: string; score_percent?: number; readiness_label?: string };
  questions: { id: number; number: number; question_text: string; options: { id: number; option_text: string }[]; explanation?: string }[];
};

export default function AcademyExamsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [exam, setExam] = useState<ExamView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    academyGet<{ data: Template[] }>("/exams")
      .then((r) => setTemplates(r.data))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Mock Exams</h2>
      <p className="text-sm text-muted-foreground">
        The timer is enforced by the server. Explanations appear only after submit. This is a readiness mock, not an
        official exam.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!exam &&
        templates.map((t) => (
          <button
            key={t.id}
            className="block rounded-lg border p-4 text-left"
            onClick={() => academySend<ExamView>(`/exams/${t.id}/attempts`, "POST").then(setExam).catch((e) => setError(e.message))}
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-muted-foreground">
              {t.total_questions} questions · {t.duration_minutes} minutes
            </div>
          </button>
        ))}
      {exam && (
        <div className="space-y-4">
          <div className="text-sm">
            Status: {exam.attempt.status}. Expires: {exam.attempt.expires_at}
            {exam.attempt.score_percent != null && ` · Score ${exam.attempt.score_percent}%`}
          </div>
          {exam.questions.map((q) => (
            <div key={q.id} className="rounded-lg border p-4">
              <div className="mb-2 font-medium">
                {q.number}. {q.question_text}
              </div>
              {q.options.map((o) => (
                <button
                  key={o.id}
                  className="mb-2 block w-full rounded border px-3 py-2 text-left"
                  onClick={() =>
                    academySend<ExamView>(`/exams/attempts/${exam.attempt.id}/answers`, "PUT", {
                      question_id: q.id,
                      selected_option_id: o.id,
                    }).then(setExam)
                  }
                >
                  {o.option_text}
                </button>
              ))}
              {q.explanation && <p className="text-sm">{q.explanation}</p>}
            </div>
          ))}
          {exam.attempt.status === "in_progress" && (
            <button
              className="rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => academySend<ExamView>(`/exams/attempts/${exam.attempt.id}/submit`, "POST").then(setExam)}
            >
              Submit mock
            </button>
          )}
        </div>
      )}
    </div>
  );
}
