"use client";

import { useEffect, useMemo, useState } from "react";
import { academyGet, academySend } from "@/lib/academy";

type Template = { id: number; name: string; duration_minutes: number; total_questions: number };
type Option = { id: number; option_text: string };
type Question = {
  id: number;
  number: number;
  question_text: string;
  options: Option[];
  flagged?: boolean;
  selected_option_id?: number | null;
  explanation?: string;
  is_correct?: boolean | null;
};
type Attempt = {
  id: number;
  status: string;
  expires_at: string;
  server_now?: string;
  score?: number | null;
  score_percent?: number | null;
  percentage?: number | null;
  correct?: number | null;
  incorrect?: number | null;
  unanswered?: number | null;
  time_used_seconds?: number | null;
  total_duration_seconds?: number | null;
  attempt_number?: number | null;
  submitted_at?: string | null;
  readiness_label?: string;
  performance_label?: string | null;
  topic_scores?: Record<string, number> | null;
  competency_scores?: Record<string, number> | null;
  difficulty_scores?: Record<string, number> | null;
  independent_score_percent?: number | null;
  case_score_percent?: number | null;
  submission_reason?: string | null;
  template?: { allow_navigation?: boolean; duration_minutes?: number; name?: string; total_questions?: number };
};
type ExamView = { attempt: Attempt; questions: Question[] };

function remainingSeconds(attempt: Attempt) {
  const end = new Date(attempt.expires_at).getTime();
  const now = attempt.server_now ? new Date(attempt.server_now).getTime() : Date.now();
  return Math.max(0, Math.floor((end - now) / 1000));
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ScoreBars({ title, data }: { title: string; data?: Record<string, number> | null }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ul className="space-y-2">
        {Object.entries(data).map(([key, value]) => (
          <li key={key}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{key}</span>
              <span>{value}%</span>
            </div>
            <div className="h-2 rounded bg-muted">
              <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AcademyExamsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [exam, setExam] = useState<ExamView | null>(null);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    academyGet<{ data: Template[] }>("/exams")
      .then((r) => setTemplates(r.data))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!exam || exam.attempt.status !== "in_progress") return;
    setLeft(remainingSeconds(exam.attempt));
    const t = window.setInterval(() => {
      setLeft((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          academySend<ExamView>(`/exams/attempts/${exam.attempt.id}/submit`, "POST").then(setExam).catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [exam?.attempt.id, exam?.attempt.status, exam?.attempt.expires_at]);

  useEffect(() => {
    const onFocus = () => {
      if (!exam || exam.attempt.status !== "in_progress") return;
      academyGet<ExamView>(`/exams/attempts/${exam.attempt.id}`).then((view) => {
        setExam(view);
        setLeft(remainingSeconds(view.attempt));
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [exam?.attempt.id, exam?.attempt.status]);

  const q = exam?.questions[index];
  const answered = useMemo(() => exam?.questions.filter((item) => item.selected_option_id != null).length ?? 0, [exam]);
  const submitted = exam && exam.attempt.status !== "in_progress";

  async function save(partial: { selected_option_id?: number | null; flagged?: boolean }) {
    if (!exam || !q) return;
    const view = await academySend<ExamView>(`/exams/attempts/${exam.attempt.id}/answers`, "PUT", {
      question_id: q.id,
      selected_option_id: partial.selected_option_id ?? q.selected_option_id,
      flagged: partial.flagged ?? q.flagged,
    });
    setExam(view);
  }

  if (submitted && exam) {
    const a = exam.attempt;
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Mock results</h2>
        <p className="text-sm text-muted-foreground">{a.readiness_label}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Score" value={`${a.score_percent ?? a.percentage ?? 0}%`} />
          <Stat label="Correct" value={String(a.correct ?? 0)} />
          <Stat label="Incorrect" value={String(a.incorrect ?? 0)} />
          <Stat label="Unanswered" value={String(a.unanswered ?? 0)} />
          <Stat label="Time used" value={fmt(a.time_used_seconds ?? 0)} />
          <Stat label="Duration" value={fmt(a.total_duration_seconds ?? 0)} />
          <Stat label="Attempt" value={String(a.attempt_number ?? 1)} />
          <Stat label="Submitted" value={a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "—"} />
        </div>
        {a.performance_label && <p className="text-sm font-medium">{a.performance_label}</p>}
        <ScoreBars title="Topic performance" data={a.topic_scores} />
        <ScoreBars title="Competency performance" data={a.competency_scores} />
        <ScoreBars title="Difficulty performance" data={a.difficulty_scores} />
        {(a.independent_score_percent != null || a.case_score_percent != null) && (
          <div className="rounded-lg border p-4 text-sm">
            Independent: {a.independent_score_percent ?? "—"}% · Case: {a.case_score_percent ?? "—"}%
          </div>
        )}
        {exam.questions.some((item) => item.explanation) && (
          <div className="space-y-3">
            {exam.questions.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="font-medium">
                  {item.number}. {item.question_text}
                </div>
                <p className="mt-1 text-sm">{item.is_correct ? "Correct" : "Incorrect / unanswered"}</p>
                {item.explanation && <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>}
              </div>
            ))}
          </div>
        )}
        <button className="rounded border px-3 py-2 text-sm" onClick={() => setExam(null)}>
          Back to mocks
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Mock Exams</h2>
      <p className="text-sm text-muted-foreground">
        Server-timed readiness mock. The browser clock cannot extend time. This is not an official exam.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!exam &&
        templates.map((t) => (
          <button
            key={t.id}
            className="block w-full rounded-lg border p-4 text-left"
            onClick={() =>
              academySend<ExamView>(`/exams/${t.id}/attempts`, "POST")
                .then((view) => {
                  setExam(view);
                  setIndex(0);
                  setLeft(remainingSeconds(view.attempt));
                })
                .catch((e) => setError(e.message))
            }
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-muted-foreground">
              {t.total_questions} questions · {t.duration_minutes} minutes
            </div>
          </button>
        ))}
      {exam && q && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <div className="font-medium">{exam.attempt.template?.name ?? "Mock"}</div>
              <div className="text-sm text-muted-foreground">
                Question {q.number} of {exam.questions.length} · {answered} answered
              </div>
            </div>
            <div className="text-lg font-semibold tabular-nums">{left != null ? fmt(left) : "—"}</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {exam.questions.map((item, i) => (
              <button
                key={item.id}
                className={`h-8 w-8 rounded border text-xs ${i === index ? "bg-primary text-primary-foreground" : item.selected_option_id ? "bg-muted" : ""} ${item.flagged ? "ring-2 ring-amber-500" : ""}`}
                onClick={() => exam.attempt.template?.allow_navigation !== false && setIndex(i)}
              >
                {item.number}
              </button>
            ))}
          </div>
          <div className="rounded-xl border p-4">
            <div className="mb-4 font-medium">
              {q.number}. {q.question_text}
            </div>
            <div className="space-y-2">
              {q.options.map((o) => (
                <button
                  key={o.id}
                  className={`block w-full rounded border px-3 py-2 text-left ${q.selected_option_id === o.id ? "border-primary bg-primary/5" : ""}`}
                  onClick={() => save({ selected_option_id: o.id })}
                >
                  {o.option_text}
                </button>
              ))}
            </div>
            <button className="mt-3 text-sm underline" onClick={() => save({ flagged: !q.flagged })}>
              {q.flagged ? "Unflag" : "Flag for review"}
            </button>
          </div>
          <div className="flex justify-between">
            <button className="rounded border px-3 py-2 text-sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Previous
            </button>
            {index < exam.questions.length - 1 ? (
              <button className="rounded border px-3 py-2 text-sm" onClick={() => setIndex((i) => i + 1)}>
                Next
              </button>
            ) : (
              <button className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => setConfirmSubmit(true)}>
                Submit mock
              </button>
            )}
          </div>
          {confirmSubmit && (
            <div className="rounded-lg border p-4 text-sm">
              Submit now? Unanswered questions are preserved as unanswered.
              <div className="mt-3 flex gap-2">
                <button className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => academySend<ExamView>(`/exams/attempts/${exam.attempt.id}/submit`, "POST").then(setExam)}>
                  Confirm submit
                </button>
                <button className="rounded border px-3 py-1" onClick={() => setConfirmSubmit(false)}>
                  Stay
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
