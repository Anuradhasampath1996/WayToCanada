"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  CourseRail,
  ExamQuestionPlayer,
  ExamResultsPanel,
  LessonStage,
  type ExamResult,
} from "./player-components";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function authHeaders(json = false): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ??
    (typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null) ??
    "";
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type Lesson = {
  id: number;
  title: string;
  lesson_type?: string;
  video_url?: string | null;
  text_content?: string | null;
  pdf_url?: string | null;
  duration_minutes?: number | null;
  is_completed?: boolean;
};

type QuizItem = {
  id: number;
  title: string;
  content_type?: string;
  passing_score?: number;
  time_limit_minutes?: number | null;
  question_count?: number;
  best_score?: number | null;
  last_passed?: boolean | null;
  attempts_count?: number;
};

type CoursePayload = {
  id: number;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  category?: { name?: string } | null;
  modules?: Array<{ id: number; title: string; lessons: Lesson[] }>;
  quizzes?: QuizItem[];
  homework?: Array<{
    id: number;
    title: string;
    instructions?: string | null;
    submitted?: boolean;
  }>;
  assignment?: { id: number; progress_percent: number; status: string } | null;
};

export function LmsLearnClient({ assignmentId }: { assignmentId: string }) {
  const [course, setCourse] = React.useState<CoursePayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [activeLesson, setActiveLesson] = React.useState<Lesson | null>(null);
  const [activeHomework, setActiveHomework] = React.useState<{
    id: number;
    title: string;
    instructions?: string | null;
    submitted?: boolean;
  } | null>(null);
  const [hwContent, setHwContent] = React.useState("");
  const [quiz, setQuiz] = React.useState<any>(null);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [result, setResult] = React.useState<ExamResult | null>(null);
  const [resultTitle, setResultTitle] = React.useState("");
  const [retakeQuizId, setRetakeQuizId] = React.useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const autoSubmitRef = React.useRef(false);
  const submitQuizRef = React.useRef<() => Promise<void>>(async () => undefined);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/lms/assignments/${assignmentId}`, {
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? `Failed to load course (HTTP ${res.status})`);
      setCourse(json);
      setActiveLesson((prev) => {
        if (!prev) return prev;
        for (const mod of json.modules ?? []) {
          const found = mod.lessons?.find((l: Lesson) => l.id === prev.id);
          if (found) return found;
        }
        return prev;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load course.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!quiz || !startedAt) return;
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [quiz, startedAt]);

  React.useEffect(() => {
    if (!quiz || timeLeft === null) return;
    const id = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s === null) return null;
        return s <= 1 ? 0 : s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [quiz, timeLeft === null]);

  React.useEffect(() => {
    if (timeLeft !== 0 || !quiz || autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    void submitQuizRef.current();
  }, [timeLeft, quiz]);

  function clearPanels() {
    setActiveLesson(null);
    setActiveHomework(null);
    setQuiz(null);
    setResult(null);
    setAnswers({});
    setHwContent("");
    setTimeLeft(null);
    setStartedAt(null);
    setElapsedSeconds(0);
    setCurrentQuestionIndex(0);
    setRetakeQuizId(null);
    autoSubmitRef.current = false;
  }

  async function markComplete(lessonId: number) {
    setBusy(true);
    try {
      await fetch(`${API}/consultant/lms/assignments/${assignmentId}/lessons/${lessonId}/complete`, {
        method: "POST",
        headers: authHeaders(),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function startQuiz(quizMeta: QuizItem) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/lms/assignments/${assignmentId}/quizzes/${quizMeta.id}`, {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Could not start quiz");
      clearPanels();
      setQuiz(data);
      setResultTitle(data.title ?? quizMeta.title);
      setRetakeQuizId(quizMeta.id);
      setStartedAt(Date.now());
      setElapsedSeconds(0);
      setTimeLeft(data.time_limit_minutes ? Number(data.time_limit_minutes) * 60 : null);
      setCurrentQuestionIndex(0);
      autoSubmitRef.current = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start quiz");
    } finally {
      setBusy(false);
    }
  }

  async function submitQuiz() {
    if (!quiz || busy) return;
    setBusy(true);
    setError("");
    try {
      const timeTaken = startedAt ? Math.round((Date.now() - startedAt) / 1000) : elapsedSeconds;
      const res = await fetch(
        `${API}/consultant/lms/assignments/${assignmentId}/quizzes/${quiz.id}/submit`,
        {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({
            answers,
            attempt_seed: quiz.attempt_seed ?? null,
            time_taken_seconds: timeTaken,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Submit failed");
      setQuiz(null);
      setTimeLeft(null);
      setResult({
        ...data,
        time_taken_seconds: data.time_taken_seconds ?? timeTaken,
      });
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      autoSubmitRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  submitQuizRef.current = submitQuiz;

  async function submitHomework(homeworkId: number) {
    if (!hwContent.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/consultant/lms/assignments/${assignmentId}/homework/${homeworkId}/submit`,
        {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ content: hwContent }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Homework submit failed");
      clearPanels();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Homework submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !course) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Opening your course…
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="space-y-4 p-6">
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/dashboard/lms">Back to LMS</Link>
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!course) return null;

  const progress = course.assignment?.progress_percent ?? 0;
  const inExam = Boolean(quiz);
  const inResults = Boolean(result);
  const showRail = !inExam && !inResults;

  return (
    <div className="min-w-0 space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-xl px-2.5"
            onClick={() => {
              if (inExam || inResults || activeLesson || activeHomework) {
                clearPanels();
                return;
              }
              window.location.href = `/dashboard/lms/${course.id}`;
            }}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            {inExam || inResults || activeLesson || activeHomework ? "Back to course" : "Course details"}
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{course.title}</h1>
            {course.category?.name ? (
              <p className="truncate text-xs text-muted-foreground">{course.category.name}</p>
            ) : null}
          </div>
        </div>
        <Badge variant="outline" className="rounded-full">
          {progress}% complete
        </Badge>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {inResults && result ? (
        <ExamResultsPanel
          title={resultTitle}
          result={result}
          elapsedSeconds={result.time_taken_seconds ?? elapsedSeconds}
          onRetake={
            retakeQuizId
              ? () => {
                  const meta = (course.quizzes ?? []).find((q) => q.id === retakeQuizId);
                  if (meta) void startQuiz(meta);
                }
              : undefined
          }
          onBack={() => clearPanels()}
        />
      ) : inExam ? (
        <ExamQuestionPlayer
          quiz={quiz}
          answers={answers}
          setAnswers={setAnswers}
          currentIndex={currentQuestionIndex}
          setCurrentIndex={setCurrentQuestionIndex}
          timeLeft={timeLeft}
          elapsedSeconds={elapsedSeconds}
          submitting={busy}
          onSubmit={() => void submitQuiz()}
          onExit={() => clearPanels()}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          {showRail ? (
            <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
              <CourseRail
                modules={course.modules ?? []}
                quizzes={course.quizzes ?? []}
                homework={course.homework ?? []}
                progressPercent={progress}
                activeLessonId={activeLesson?.id}
                activeHomeworkId={activeHomework?.id}
                onSelectLesson={(lesson) => {
                  clearPanels();
                  setActiveLesson(lesson);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onStartQuiz={(q) => void startQuiz(q)}
                onSelectHomework={(hw) => {
                  clearPanels();
                  setActiveHomework(hw);
                  setHwContent("");
                }}
              />
            </aside>
          ) : null}

          <main className="min-w-0">
            {activeLesson ? (
              <LessonStage lesson={activeLesson} busy={busy} onComplete={(id) => void markComplete(id)} />
            ) : activeHomework ? (
              <Card className="border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>{activeHomework.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeHomework.instructions ? (
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: activeHomework.instructions }}
                    />
                  ) : null}
                  {activeHomework.submitted ? (
                    <p className="text-sm text-emerald-700">Already submitted.</p>
                  ) : (
                    <>
                      <Textarea
                        value={hwContent}
                        onChange={(e) => setHwContent(e.target.value)}
                        placeholder="Write your homework response…"
                        className="min-h-40 rounded-xl"
                      />
                      <Button
                        className="rounded-xl bg-emerald-700 hover:bg-emerald-800"
                        disabled={busy || !hwContent.trim()}
                        onClick={() => void submitHomework(activeHomework.id)}
                      >
                        Submit homework
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden border-dashed shadow-sm">
                <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                  <span className="flex size-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-700">
                    <BookOpen className="size-8" />
                  </span>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold tracking-tight">Start learning</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Open a lesson from the left, or start a quiz / mock exam when you are ready.
                      Timed exams show countdown and elapsed time, then full results after submit.
                    </p>
                  </div>
                  {(course.modules?.[0]?.lessons?.[0] || course.quizzes?.[0]) && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {course.modules?.[0]?.lessons?.[0] ? (
                        <Button
                          className="rounded-xl bg-emerald-700 hover:bg-emerald-800"
                          onClick={() => {
                            clearPanels();
                            setActiveLesson(course.modules![0].lessons[0]);
                          }}
                        >
                          Open first lesson
                        </Button>
                      ) : null}
                      {course.quizzes?.[0] ? (
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={busy}
                          onClick={() => void startQuiz(course.quizzes![0])}
                        >
                          Start first quiz
                        </Button>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
