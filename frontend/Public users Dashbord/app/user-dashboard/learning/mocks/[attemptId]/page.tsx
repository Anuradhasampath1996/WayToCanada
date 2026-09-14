"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("wtc_token") ?? document.cookie.match(/wtc_token=([^;]+)/)?.[1] ?? "";
}

function headers() {
  return { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token()}` };
}

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`);
  return data as T;
}

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
  submission_reason?: string | null;
  template?: { name?: string; allow_navigation?: boolean };
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

export default function LmsExamMasterPlayerPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<ExamView | null>(null);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    api<ExamView>(`/client/lms/exam-attempts/${attemptId}`)
      .then((view) => {
        setExam(view);
        setLeft(remainingSeconds(view.attempt));
      })
      .catch((e) => setError(e.message));
  }, [attemptId]);

  useEffect(() => {
    if (!exam || exam.attempt.status !== "in_progress") return;
    const t = window.setInterval(() => {
      setLeft((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) {
          api<ExamView>(`/client/lms/exam-attempts/${exam.attempt.id}/submit`, "POST").then(setExam).catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [exam?.attempt.id, exam?.attempt.status]);

  const q = exam?.questions[index];
  const answered = useMemo(() => exam?.questions.filter((item) => item.selected_option_id != null).length ?? 0, [exam]);
  const submitted = exam && exam.attempt.status !== "in_progress";

  async function save(partial: { selected_option_id?: number | null; flagged?: boolean }) {
    if (!exam || !q) return;
    const view = await api<ExamView>(`/client/lms/exam-attempts/${exam.attempt.id}/answers`, "PUT", {
      question_id: q.id,
      selected_option_id: partial.selected_option_id ?? q.selected_option_id,
      flagged: partial.flagged ?? q.flagged,
    });
    setExam(view);
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!exam || !q) return <p className="text-sm text-muted-foreground">Loading mock…</p>;

  if (submitted) {
    const a = exam.attempt;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Mock results</h1>
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
        {a.performance_label && <p className="font-medium">{a.performance_label}</p>}
        {a.topic_scores && Object.keys(a.topic_scores).length > 0 && (
          <pre className="rounded border p-3 text-xs">{JSON.stringify(a.topic_scores, null, 2)}</pre>
        )}
        {exam.questions.some((item) => item.explanation) &&
          exam.questions.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="font-medium">{item.number}. {item.question_text}</div>
              {item.explanation && <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>}
            </div>
          ))}
        <Button variant="outline" onClick={() => router.push("/user-dashboard/learning")}>Back to marketplace</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div>
          <div className="font-medium">{exam.attempt.template?.name ?? "Mock"}</div>
          <div className="text-sm text-muted-foreground">Question {q.number} of {exam.questions.length} · {answered} answered</div>
        </div>
        <div className="text-lg font-semibold tabular-nums">{left != null ? fmt(left) : "—"}</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {exam.questions.map((item, i) => (
          <button
            key={item.id}
            className={`h-8 w-8 rounded border text-xs ${i === index ? "bg-emerald-600 text-white" : item.selected_option_id ? "bg-muted" : ""} ${item.flagged ? "ring-2 ring-amber-500" : ""}`}
            onClick={() => exam.attempt.template?.allow_navigation !== false && setIndex(i)}
          >
            {item.number}
          </button>
        ))}
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-4 font-medium">{q.number}. {q.question_text}</div>
        <div className="space-y-2">
          {q.options.map((o) => (
            <button
              key={o.id}
              className={`block w-full rounded border px-3 py-2 text-left ${q.selected_option_id === o.id ? "border-emerald-600 bg-emerald-50" : ""}`}
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
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>Previous</Button>
        {index < exam.questions.length - 1 ? (
          <Button variant="outline" onClick={() => setIndex((i) => i + 1)}>Next</Button>
        ) : (
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirmSubmit(true)}>Submit mock</Button>
        )}
      </div>
      {confirmSubmit && (
        <div className="rounded-lg border p-4 text-sm">
          Submit now? Unanswered questions stay unanswered.
          <div className="mt-3 flex gap-2">
            <Button onClick={() => api<ExamView>(`/client/lms/exam-attempts/${exam.attempt.id}/submit`, "POST").then(setExam)}>Confirm</Button>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>Stay</Button>
          </div>
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
