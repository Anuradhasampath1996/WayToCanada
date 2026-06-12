"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, XCircle, FileText, PlayCircle, Clock,
  GraduationCap, ClipboardList, ChevronLeft, ChevronRight, RotateCcw, Trophy,
  Target, BookOpen, Circle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("wtc_token") ?? document.cookie.match(/wtc_token=([^;]+)/)?.[1] ?? "";
}

type BreakdownItem = {
  question_text: string;
  topic?: string;
  selected_text?: string;
  correct_text?: string;
  is_correct: boolean;
  explanation?: string;
};

type ExamResult = {
  attempt_id?: number;
  score_percent: number;
  passed: boolean;
  correct: number;
  total: number;
  breakdown: BreakdownItem[];
};

const EXAM_LABEL: Record<string, string> = { quiz: "Quiz", exam: "Exam", mock_exam: "Mock exam" };

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ExamQuestionPlayer({
  quiz,
  answers,
  setAnswers,
  currentIndex,
  setCurrentIndex,
  timeLeft,
  onSubmit,
  onExit,
}: {
  quiz: any;
  answers: Record<number, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  timeLeft: number | null;
  onSubmit: () => void;
  onExit: () => void;
}) {
  const questions: any[] = quiz.questions ?? [];
  const total = questions.length;
  const q = questions[currentIndex];
  const answeredCount = questions.filter((qq) => answers[qq.id] != null).length;
  const allAnswered = answeredCount === total && total > 0;
  const isLast = currentIndex >= total - 1;

  if (!q) return null;

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border bg-card p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="mb-2 bg-emerald-600">{EXAM_LABEL[quiz.content_type] ?? "Exam"}</Badge>
            <h2 className="text-xl md:text-2xl font-bold">{quiz.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Question {currentIndex + 1} of {total} · {answeredCount} answered
            </p>
          </div>
          <div className="flex items-center gap-2">
            {timeLeft !== null && (
              <div className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-base font-bold tabular-nums",
                timeLeft < 60 ? "border-red-500/50 bg-red-50 text-red-600" : "bg-muted/50",
              )}>
                <Clock className="h-4 w-4" />
                {fmtTime(timeLeft)}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={onExit} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to course
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
        {/* Left — question + navigation */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          <Card className="overflow-hidden shadow-md border-2 border-border/80">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">
                  {currentIndex + 1}
                </span>
                {q.topic && <Badge variant="outline" className="text-[10px]">{q.topic}</Badge>}
              </div>
              <CardTitle className="text-lg font-semibold leading-relaxed">{q.question_text}</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-2.5">
              {q.options.map((o: any) => (
                <label
                  key={o.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 cursor-pointer transition-all",
                    answers[q.id] === o.id
                      ? "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/30 shadow-sm"
                      : "border-transparent bg-muted/40 hover:bg-muted/70 hover:border-border",
                  )}
                >
                  <input
                    type="radio"
                    className="h-4 w-4 accent-emerald-600"
                    name={`q-${q.id}`}
                    checked={answers[q.id] === o.id}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                  />
                  <span className="text-sm md:text-base">{o.option_text}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => i - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            {!isLast ? (
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 gap-1 min-w-[120px]"
                onClick={() => setCurrentIndex((i) => i + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 min-w-[140px]"
                onClick={onSubmit}
                disabled={!allAnswered}
              >
                Submit exam
              </Button>
            )}
          </div>
        </div>

        {/* Right — jump to question */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <p className="text-sm font-semibold">Jump to question</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {answeredCount} of {total} answered
              </p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((qq, i) => {
                  const answered = answers[qq.id] != null;
                  const current = i === currentIndex;
                  return (
                    <button
                      key={qq.id}
                      type="button"
                      onClick={() => setCurrentIndex(i)}
                      className={cn(
                        "h-9 rounded-lg border text-xs font-semibold transition-all",
                        current && "ring-2 ring-emerald-500 ring-offset-1 border-emerald-500",
                        answered && !current && "bg-emerald-600 text-white border-emerald-600",
                        !answered && !current && "bg-muted/50 hover:bg-muted text-muted-foreground",
                        answered && current && "bg-emerald-600 text-white",
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground border-t pt-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border bg-emerald-600" />
                  Answered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border bg-muted/50" />
                  Unanswered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded ring-2 ring-emerald-500 ring-offset-1" />
                  Current
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ExamResultsPanel({
  title,
  subtitle,
  result,
  onRetake,
  onBack,
}: {
  title: string;
  subtitle?: string;
  result: { score_percent: number; passed: boolean; correct: number; total: number; breakdown: BreakdownItem[] };
  onRetake?: () => void;
  onBack: () => void;
}) {
  const wrong = result.total - result.correct;

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-8 md:p-10",
          result.passed
            ? "border-emerald-500/30 bg-gradient-to-br from-emerald-50 via-background to-emerald-50/30 dark:from-emerald-950/40 dark:to-background"
            : "border-amber-500/30 bg-gradient-to-br from-amber-50 via-background to-orange-50/20 dark:from-amber-950/30 dark:to-background",
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          <div
            className={cn(
              "relative mx-auto md:mx-0 flex h-36 w-36 shrink-0 items-center justify-center rounded-full border-8",
              result.passed ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10",
            )}
          >
            <div className="text-center">
              <p className="text-4xl font-bold tabular-nums">{result.score_percent}%</p>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1">Score</p>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              {result.passed ? (
                <Badge className="bg-emerald-600 text-base px-3 py-1 gap-1.5"><Trophy className="h-4 w-4" /> Passed</Badge>
              ) : (
                <Badge variant="secondary" className="text-base px-3 py-1 gap-1.5"><Target className="h-4 w-4" /> Keep practicing</Badge>
              )}
              <Badge variant="outline">{title}</Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {result.passed ? "Great work!" : "Review your answers below"}
            </h2>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-1">
              <div className="rounded-xl border bg-background/80 px-4 py-2 text-center min-w-[88px]">
                <p className="text-2xl font-bold text-emerald-600">{result.correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="rounded-xl border bg-background/80 px-4 py-2 text-center min-w-[88px]">
                <p className="text-2xl font-bold text-red-500">{wrong}</p>
                <p className="text-xs text-muted-foreground">Incorrect</p>
              </div>
              <div className="rounded-xl border bg-background/80 px-4 py-2 text-center min-w-[88px]">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 justify-center md:justify-start">
              {onRetake && (
                <Button variant="outline" onClick={onRetake} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Try again
                </Button>
              )}
              <Button onClick={onBack} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <BookOpen className="h-4 w-4" /> Back to course
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Answer review</h3>
        <div className="grid gap-3">
          {result.breakdown?.map((item, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-4 md:p-5 transition-colors",
                item.is_correct
                  ? "border-emerald-200/80 bg-emerald-50/40 dark:bg-emerald-950/15"
                  : "border-red-200/80 bg-red-50/40 dark:bg-red-950/15",
              )}
            >
              <div className="flex gap-3">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  item.is_correct ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-600",
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <p className="font-medium leading-snug">{item.question_text}</p>
                  {item.topic && <Badge variant="outline" className="text-[10px]">{item.topic}</Badge>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={cn("rounded-lg border px-3 py-2 text-sm", item.is_correct ? "border-emerald-300/50" : "border-red-300/50")}>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Your answer</p>
                      <p className={cn("font-medium", item.is_correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-600")}>
                        {item.selected_text ?? "No answer"}
                      </p>
                    </div>
                    {!item.is_correct && (
                      <div className="rounded-lg border border-emerald-300/50 px-3 py-2 text-sm">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Correct answer</p>
                        <p className="font-medium text-emerald-700 dark:text-emerald-400">{item.correct_text}</p>
                      </div>
                    )}
                  </div>
                  {item.explanation && (
                    <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 px-3 py-2 border-l-2 border-primary/40">
                      {item.explanation}
                    </p>
                  )}
                </div>
                {item.is_correct
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 hidden sm:block" />
                  : <XCircle className="h-5 w-5 text-red-500 shrink-0 hidden sm:block" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CoursePlayerPage() {
  const router = useRouter();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [course, setCourse] = React.useState<any>(null);
  const [activeLesson, setActiveLesson] = React.useState<any>(null);
  const [activeHomework, setActiveHomework] = React.useState<any>(null);
  const [hwContent, setHwContent] = React.useState("");
  const [quiz, setQuiz] = React.useState<any>(null);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [result, setResult] = React.useState<ExamResult | null>(null);
  const [resultTitle, setResultTitle] = React.useState("");
  const [retakeQuizId, setRetakeQuizId] = React.useState<number | null>(null);
  const [attemptSeed, setAttemptSeed] = React.useState<number | null>(null);
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [viewAttempt, setViewAttempt] = React.useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [examLoading, setExamLoading] = React.useState(false);
  const load = React.useCallback(() => {
    fetch(`${API}/client/lms/assignments/${assignmentId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then(setCourse);
  }, [assignmentId]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || !quiz) return;
    const t = setInterval(() => setTimeLeft((s) => (s !== null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [timeLeft, quiz]);

  const inResultsMode = Boolean(result || viewAttempt);
  const inExamMode = Boolean(quiz);
  const inNestedView = Boolean(activeLesson || activeHomework || quiz || result || viewAttempt);

  function goBack() {
    if (inNestedView) {
      clearContent();
      setHwContent("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/user-dashboard/learning");
  }

  function clearContent() {
    setActiveLesson(null);
    setActiveHomework(null);
    setQuiz(null);
    setResult(null);
    setViewAttempt(null);
    setAnswers({});
    setTimeLeft(null);
    setCurrentQuestionIndex(0);
  }

  async function markComplete(lessonId: number) {
    await fetch(`${API}/client/lms/assignments/${assignmentId}/lessons/${lessonId}/complete`, {
      method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
    });
    load();
  }

  async function startQuiz(quizId: number, meta?: { title?: string; content_type?: string }) {
    setExamLoading(true);
    try {
      const res = await fetch(`${API}/client/lms/assignments/${assignmentId}/quizzes/${quizId}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      clearContent();
      setQuiz(data);
      setResultTitle(meta?.title ?? data.title ?? "Exam");
      setRetakeQuizId(quizId);
      setAttemptSeed(data.attempt_seed ?? null);
      setStartedAt(Date.now());
      setTimeLeft(data.time_limit_minutes ? data.time_limit_minutes * 60 : null);
      setCurrentQuestionIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setExamLoading(false);
    }
  }

  async function submitQuiz(quizId: number) {
    const timeTaken = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;
    const res = await fetch(`${API}/client/lms/assignments/${assignmentId}/quizzes/${quizId}/submit`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ answers, attempt_seed: attemptSeed, time_taken_seconds: timeTaken }),
    });
    const data = await res.json();
    setQuiz(null);
    setTimeLeft(null);
    setResult(data);
    setViewAttempt(null);
    load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function viewExamResult(attemptId: number) {
    const res = await fetch(`${API}/client/lms/assignments/${assignmentId}/exam-attempts/${attemptId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();
    clearContent();
    setViewAttempt(data);
    setResultTitle(data.quiz_title ?? "Exam result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitHomework(homeworkId: number) {
    await fetch(`${API}/client/lms/assignments/${assignmentId}/homework/${homeworkId}/submit`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ content: hwContent }),
    });
    setActiveHomework(null);
    setHwContent("");
    load();
  }

  if (!course) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Circle className="h-5 w-5 animate-pulse" /> Loading course…
        </div>
      </div>
    );
  }

  const progress = course.assignment?.progress_percent ?? 0;
  const quizzes: any[] = course.quizzes ?? [];

  return (
    <div className="flex w-full min-h-[calc(100vh-var(--header-height)-2rem)] flex-col">
      {/* Top bar — full width */}
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 mt-0.5 gap-1.5"
              onClick={goBack}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{inNestedView ? "Back to course" : "All courses"}</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Learning portal</p>
              <h1 className="text-xl md:text-2xl font-bold truncate">{course.title}</h1>
              {course.category?.name && (
                <p className="text-sm text-muted-foreground">{course.category.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 lg:min-w-[280px]">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Course progress</span>
                <span className="font-semibold text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 w-full flex-col lg:flex-row gap-0 lg:gap-6 pt-6 -mx-4 md:-mx-6">
        {/* Sidebar — lessons first, quizzes & assignments at bottom */}
        {!inResultsMode && !inExamMode && (
          <aside className="shrink-0 border-b lg:border-b-0 lg:border-r bg-muted/20 w-full lg:w-80">
            <ScrollArea className="h-auto max-h-[45vh] lg:max-h-[calc(100vh-var(--header-height)-8rem)] px-3 lg:px-4">
              <div className="space-y-4 pb-6 pt-1">
                <div className="px-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lessons</p>
                </div>

                {course.modules?.map((m: any) => (
                  <div key={m.id} className="rounded-xl border bg-card overflow-hidden">
                    <div className="px-3 py-2.5 border-b bg-muted/30">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module</p>
                      <p className="text-sm font-semibold leading-tight">{m.title}</p>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      {m.lessons?.map((l: any) => (
                        <button
                          key={l.id}
                          type="button"
                          className={cn(
                            "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                            activeLesson?.id === l.id ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/20" : "hover:bg-muted",
                          )}
                          onClick={() => { clearContent(); setActiveLesson(l); }}
                        >
                          {l.is_completed
                            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            : <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <span className="line-clamp-2">{l.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {course.exam_attempts?.length > 0 && (
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="px-3 py-2.5 border-b bg-muted/30">
                      <p className="text-sm font-semibold">Past results</p>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      {course.exam_attempts.map((a: any) => (
                        <button
                          key={a.id}
                          type="button"
                          className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
                          onClick={() => viewExamResult(a.id)}
                        >
                          <span className="truncate text-left">{a.quiz_title}</span>
                          <Badge className={cn("shrink-0", a.passed && "bg-emerald-600")} variant={a.passed ? "default" : "secondary"}>
                            {a.score_percent}%
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-3 py-2.5 border-b bg-emerald-500/10 flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold">Quizzes &amp; mock exams</p>
                  </div>
                  <div className="p-1.5 space-y-1">
                    {quizzes.length === 0 ? (
                      <p className="px-3 py-4 text-xs text-muted-foreground text-center">No exams added yet</p>
                    ) : quizzes.map((q: any) => (
                      <div
                        key={q.id}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/80 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium line-clamp-2 leading-snug">{q.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {EXAM_LABEL[q.content_type] ?? "Quiz"}
                            {q.time_limit_minutes ? ` · ${q.time_limit_minutes}m` : ""}
                            {q.best_score != null ? ` · ${q.best_score}%` : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0 h-8 bg-emerald-600 hover:bg-emerald-700 text-xs px-2.5"
                          disabled={examLoading}
                          onClick={() => startQuiz(q.id, { title: q.title, content_type: q.content_type })}
                        >
                          {examLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Start"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-3 py-2.5 border-b bg-muted/30 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold">Assignments</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {(course.homework?.length ?? 0) === 0 ? (
                      <p className="px-3 py-4 text-xs text-muted-foreground text-center">No assignments yet</p>
                    ) : course.homework.map((h: any) => (
                      <button
                        key={h.id}
                        type="button"
                        className={cn(
                          "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          activeHomework?.id === h.id
                            ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                            : "hover:bg-muted",
                        )}
                        onClick={() => { clearContent(); setActiveHomework(h); setHwContent(""); }}
                      >
                        <span className="line-clamp-2">{h.title}</span>
                        {h.submitted && <Badge variant="outline" className="text-[10px] shrink-0">Done</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>
        )}

        {/* Main content — full remaining width */}
        <main className={cn("flex-1 min-w-0 px-4 md:px-6 pb-10", inResultsMode && "max-w-5xl mx-auto")}>
          {result && (
            <ExamResultsPanel
              title={resultTitle}
              result={result}
              onRetake={retakeQuizId ? () => startQuiz(retakeQuizId) : undefined}
              onBack={() => { setResult(null); setRetakeQuizId(null); }}
            />
          )}

          {viewAttempt && !result && (
            <ExamResultsPanel
              title={resultTitle}
              subtitle={viewAttempt.attempted_at ? new Date(viewAttempt.attempted_at).toLocaleString() : undefined}
              result={{
                score_percent: viewAttempt.score_percent,
                passed: viewAttempt.passed,
                correct: viewAttempt.breakdown?.filter((b: BreakdownItem) => b.is_correct).length ?? 0,
                total: viewAttempt.breakdown?.length ?? 0,
                breakdown: viewAttempt.breakdown ?? [],
              }}
              onBack={() => setViewAttempt(null)}
            />
          )}

          {quiz && (
            <ExamQuestionPlayer
              quiz={quiz}
              answers={answers}
              setAnswers={setAnswers}
              currentIndex={currentQuestionIndex}
              setCurrentIndex={setCurrentQuestionIndex}
              timeLeft={timeLeft}
              onSubmit={() => submitQuiz(quiz.id)}
              onExit={() => { setQuiz(null); setAnswers({}); setTimeLeft(null); setCurrentQuestionIndex(0); }}
            />
          )}

          {activeLesson && !inExamMode && !inResultsMode && (
            <div className="space-y-6 w-full max-w-5xl">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setActiveLesson(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to course
              </Button>
              <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="border-b px-6 py-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Lesson</p>
                  <h2 className="text-xl font-bold mt-0.5">{activeLesson.title}</h2>
                </div>
                <div className="p-6 space-y-6">
                  {activeLesson.video_url && (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-md">
                      <iframe src={activeLesson.video_url} className="w-full h-full" allowFullScreen title={activeLesson.title} />
                    </div>
                  )}
                  {activeLesson.text_content && (
                    <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: activeLesson.text_content }} />
                  )}
                  {activeLesson.pdf_url && (
                    <Button variant="outline" size="lg" asChild>
                      <a href={activeLesson.pdf_url} target="_blank" rel="noreferrer">
                        <FileText className="h-4 w-4 mr-2" />Download study PDF
                      </a>
                    </Button>
                  )}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    {!activeLesson.is_completed ? (
                      <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => markComplete(activeLesson.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />Mark as complete
                      </Button>
                    ) : (
                      <Badge className="bg-emerald-600 text-sm px-3 py-1"><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Completed</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeHomework && !inExamMode && !inResultsMode && (
            <div className="space-y-4 w-full max-w-3xl">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => { setActiveHomework(null); setHwContent(""); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to course
              </Button>
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>{activeHomework.title}</CardTitle>
                <CardDescription className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: activeHomework.instructions ?? "" }} />
              </CardHeader>
              <CardContent className="space-y-4">
                {activeHomework.submitted ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-emerald-800">
                    Submitted successfully — your consultant will review your work.
                  </div>
                ) : (
                  <>
                    <Textarea rows={12} className="text-base" placeholder="Write your answer here…" value={hwContent} onChange={(e) => setHwContent(e.target.value)} />
                    <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => submitHomework(activeHomework.id)} disabled={!hwContent.trim()}>
                      Submit assignment
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            </div>
          )}

          {!activeLesson && !quiz && !result && !viewAttempt && !activeHomework && (
            <div className="w-full max-w-4xl mx-auto space-y-6">
              <div className="rounded-2xl border overflow-hidden bg-card shadow-sm">
                <div className="relative aspect-[21/9] sm:aspect-[2.4/1] min-h-[180px] max-h-[320px] bg-muted">
                  {course.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-emerald-600/25 via-emerald-500/10 to-muted flex items-center justify-center">
                      <GraduationCap className="h-16 w-16 text-emerald-600/35" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                    {course.category?.name && (
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">{course.category.name}</p>
                    )}
                    <h2 className="text-2xl md:text-3xl font-bold mt-1 leading-tight">{course.title}</h2>
                    {course.description && (
                      <p className="text-sm md:text-base text-white/85 mt-2 max-w-2xl line-clamp-3">{course.description}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-6 md:p-8 text-center">
                <BookOpen className="h-10 w-10 text-emerald-600/50 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">Welcome to your course</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                  Use the sidebar to <strong>Start</strong> a quiz or mock exam, open an assignment, or select a lesson to begin.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
