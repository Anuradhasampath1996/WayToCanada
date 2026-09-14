"use client";

import { useState } from "react";
import { academySend } from "@/lib/academy";

type Question = {
  id: number;
  question_text: string;
  options: { id: number; option_key: string; option_text: string }[];
  explanation?: string;
  is_correct?: boolean;
};

export default function AcademyPracticePage() {
  const [session, setSession] = useState<{ session: { id: number }; questions: Question[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    try {
      setSession(await academySend("/practice/sessions", "POST", { count: 10, explain_mode: "explain_immediately" }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function answer(question: Question, optionId: number) {
    if (!session) return;
    const next = await academySend<typeof session>(`/practice/sessions/${session.session.id}/answers`, "POST", {
      question_id: question.id,
      selected_option_id: optionId,
    });
    setSession({
      ...session,
      questions: session.questions.map((q) => (q.id === question.id ? { ...q, ...next.question } : q)),
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Practice</h2>
      <p className="text-sm text-muted-foreground">Filterable MCQ practice. Explanations appear after you answer.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!session && (
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={start}>
          Start 10-question set
        </button>
      )}
      {session?.questions.map((q, i) => (
        <div key={q.id} className="rounded-lg border p-4">
          <div className="mb-2 font-medium">
            {i + 1}. {q.question_text}
          </div>
          <div className="space-y-2">
            {q.options.map((o) => (
              <button key={o.id} className="block w-full rounded border px-3 py-2 text-left" onClick={() => answer(q, o.id)}>
                {o.option_key}. {o.option_text}
              </button>
            ))}
          </div>
          {q.explanation && (
            <p className="mt-3 text-sm">
              {q.is_correct ? "Correct. " : "Review. "}
              {q.explanation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
