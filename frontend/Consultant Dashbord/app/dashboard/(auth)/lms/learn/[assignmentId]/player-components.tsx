"use client";

import * as React from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  Pause,
  Play,
  RotateCcw,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type BreakdownItem = {
  question_id?: number;
  question_text: string;
  topic?: string;
  selected_text?: string;
  correct_text?: string;
  is_correct: boolean | number;
  explanation?: string;
};

export type ExamResult = {
  attempt_id?: number;
  score_percent: number;
  passed: boolean;
  correct: number;
  total: number;
  breakdown?: BreakdownItem[];
  time_taken_seconds?: number | null;
};

const EXAM_LABEL: Record<string, string> = {
  quiz: "Quiz",
  exam: "Exam",
  mock_exam: "Mock exam",
};

export function fmtClock(sec: number) {
  const safe = Math.max(0, Math.floor(sec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

export function CourseRail({
  modules,
  quizzes,
  homework,
  progressPercent,
  activeLessonId,
  activeHomeworkId,
  onSelectLesson,
  onStartQuiz,
  onSelectHomework,
}: {
  modules: Array<{ id: number; title: string; lessons?: Array<{ id: number; title: string; is_completed?: boolean; duration_minutes?: number | null }> }>;
  quizzes: Array<{
    id: number;
    title: string;
    content_type?: string;
    time_limit_minutes?: number | null;
    question_count?: number;
    best_score?: number | null;
    last_passed?: boolean | null;
    attempts_count?: number;
  }>;
  homework: Array<{ id: number; title: string; submitted?: boolean }>;
  progressPercent: number;
  activeLessonId?: number | null;
  activeHomeworkId?: number | null;
  onSelectLesson: (lesson: any) => void;
  onStartQuiz: (quiz: any) => void;
  onSelectHomework: (hw: any) => void;
}) {
  const lessonStats = React.useMemo(() => {
    let total = 0;
    let done = 0;
    modules.forEach((m) =>
      m.lessons?.forEach((l) => {
        total += 1;
        if (l.is_completed) done += 1;
      }),
    );
    return { total, done };
  }, [modules]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-emerald-200/60 bg-[linear-gradient(160deg,#ecfdf5,#ffffff_55%)] shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800/70">Your progress</p>
            <span className="text-sm font-semibold tabular-nums">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2.5" />
          <p className="text-xs text-muted-foreground">
            {lessonStats.done}/{lessonStats.total} lessons complete
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="size-4 text-emerald-700" />
            Lessons
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {modules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No lessons yet</p>
          ) : (
            modules.map((mod, idx) => (
              <div key={mod.id} className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Module {idx + 1} · {mod.title}
                </p>
                <div className="space-y-1.5">
                  {(mod.lessons ?? []).map((lesson) => {
                    const active = activeLessonId === lesson.id;
                    const done = Boolean(lesson.is_completed);
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => onSelectLesson(lesson)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                          active
                            ? "border-emerald-500 bg-emerald-700 text-white shadow-sm"
                            : "border-border/70 hover:border-emerald-300 hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full",
                            active
                              ? "bg-white/15"
                              : done
                                ? "bg-emerald-600 text-white"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {done ? <Check className="size-4" /> : active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{lesson.title}</span>
                          {lesson.duration_minutes ? (
                            <span className={cn("text-[11px]", active ? "text-white/70" : "text-muted-foreground")}>
                              {lesson.duration_minutes} min
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {quizzes.length > 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <GraduationCap className="size-4 text-emerald-700" />
              Quizzes & mock exams
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quizzes.map((q) => {
              const label = EXAM_LABEL[q.content_type ?? ""] ?? "Quiz";
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onStartQuiz(q)}
                  className="flex w-full flex-col gap-2 rounded-xl border border-border/70 px-3 py-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{q.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {label}
                        {q.question_count ? ` · ${q.question_count} questions` : ""}
                        {q.time_limit_minutes ? ` · ${q.time_limit_minutes} min` : ""}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0 rounded-full",
                        q.last_passed
                          ? "border-0 bg-emerald-600 text-white"
                          : q.best_score != null
                            ? "bg-amber-100 text-amber-800"
                            : "",
                      )}
                      variant={q.best_score == null ? "secondary" : "outline"}
                    >
                      {q.best_score != null ? `${q.best_score}%` : "Start"}
                    </Badge>
                  </div>
                  {q.attempts_count ? (
                    <p className="text-[11px] text-muted-foreground">{q.attempts_count} attempt{q.attempts_count === 1 ? "" : "s"}</p>
                  ) : null}
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {homework.length > 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="size-4 text-emerald-700" />
              Homework
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {homework.map((hw) => (
              <button
                key={hw.id}
                type="button"
                onClick={() => onSelectHomework(hw)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                  activeHomeworkId === hw.id
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border/70 hover:border-emerald-300",
                )}
              >
                <span className="truncate font-medium">{hw.title}</span>
                <Badge variant={hw.submitted ? "default" : "secondary"} className="rounded-full">
                  {hw.submitted ? "Done" : "Open"}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function LessonStage({
  lesson,
  busy,
  onComplete,
}: {
  lesson: {
    id: number;
    title: string;
    video_url?: string | null;
    text_content?: string | null;
    pdf_url?: string | null;
    is_completed?: boolean;
  };
  busy?: boolean;
  onComplete: (id: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="relative aspect-video overflow-hidden rounded-3xl border bg-black shadow-sm">
        {lesson.video_url ? (
          <iframe src={lesson.video_url} className="h-full w-full" allowFullScreen title={lesson.title} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_50%),linear-gradient(160deg,#064e3b,#0f172a)] text-white">
            <GraduationCap className="size-14 opacity-90" />
            <p className="text-sm text-white/80">No video for this lesson — study the notes below</p>
          </div>
        )}
      </div>

      <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Now learning</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{lesson.title}</h2>
          </div>
          {lesson.is_completed ? (
            <Badge className="gap-1 rounded-full border-0 bg-emerald-600 text-white">
              <CheckCircle2 className="size-3.5" /> Completed
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full">In progress</Badge>
          )}
        </div>

        {lesson.text_content ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert md:prose-base"
            dangerouslySetInnerHTML={{ __html: lesson.text_content }}
          />
        ) : (
          <p className="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No written content for this lesson yet.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {lesson.pdf_url ? (
            <Button asChild variant="outline" className="rounded-xl">
              <a href={lesson.pdf_url} target="_blank" rel="noreferrer">
                <FileText className="mr-1.5 size-4" />
                Open PDF
              </a>
            </Button>
          ) : null}
          <Button
            className="rounded-xl bg-emerald-700 hover:bg-emerald-800"
            disabled={busy || lesson.is_completed}
            onClick={() => onComplete(lesson.id)}
          >
            {lesson.is_completed ? "Lesson completed" : "Mark lesson complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ExamQuestionPlayer({
  quiz,
  answers,
  setAnswers,
  currentIndex,
  setCurrentIndex,
  timeLeft,
  elapsedSeconds,
  onSubmit,
  onExit,
  submitting,
}: {
  quiz: any;
  answers: Record<number, number>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  timeLeft: number | null;
  elapsedSeconds: number;
  onSubmit: () => void;
  onExit: () => void;
  submitting?: boolean;
}) {
  const questions: any[] = quiz.questions ?? [];
  const total = questions.length;
  const q = questions[currentIndex];
  const answeredCount = questions.filter((qq) => answers[qq.id] != null).length;
  const allAnswered = answeredCount === total && total > 0;
  const isLast = currentIndex >= total - 1;
  const urgent = timeLeft != null && timeLeft < 60;

  if (!q) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="mb-2 rounded-full border-0 bg-emerald-700 text-white">
              {EXAM_LABEL[quiz.content_type] ?? "Exam"}
            </Badge>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{quiz.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Question {currentIndex + 1} of {total} · {answeredCount} answered
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Elapsed</p>
              <p className="font-mono font-semibold tabular-nums">{fmtClock(elapsedSeconds)}</p>
            </div>
            {timeLeft !== null ? (
              <div
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm",
                  urgent ? "border-red-300 bg-red-50 text-red-700" : "bg-muted/40",
                )}
              >
                <p className="text-[10px] uppercase tracking-wider opacity-70">Time left</p>
                <p className="flex items-center gap-1.5 font-mono font-semibold tabular-nums">
                  <Clock3 className="size-3.5" />
                  {fmtClock(timeLeft)}
                </p>
              </div>
            ) : null}
            <Button variant="outline" className="rounded-xl" onClick={onExit}>
              <ArrowLeft className="mr-1.5 size-4" />
              Exit
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <Progress value={total ? (answeredCount / total) * 100 : 0} className="h-2" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                {currentIndex + 1}
              </span>
              {q.topic ? <Badge variant="outline">{q.topic}</Badge> : null}
            </div>
            <CardTitle className="text-lg leading-relaxed">{q.question_text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 p-5">
            {(q.options ?? []).map((o: any) => {
              const selected = answers[q.id] === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all",
                    selected
                      ? "border-emerald-500 bg-emerald-50 shadow-sm"
                      : "border-transparent bg-muted/40 hover:border-border hover:bg-muted/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/30",
                    )}
                  >
                    {selected ? <Check className="size-3" /> : null}
                  </span>
                  <span className="text-sm sm:text-base">{o.option_text}</span>
                </button>
              );
            })}

            <div className="flex flex-wrap gap-2 pt-3">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => i - 1)}
              >
                <ChevronLeft className="mr-1 size-4" />
                Previous
              </Button>
              {!isLast ? (
                <Button className="rounded-xl bg-emerald-700 hover:bg-emerald-800" onClick={() => setCurrentIndex((i) => i + 1)}>
                  Next
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              ) : (
                <Button
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800"
                  disabled={!allAnswered || submitting}
                  onClick={onSubmit}
                >
                  Submit {EXAM_LABEL[quiz.content_type] ?? "exam"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Question map</CardTitle>
            </CardHeader>
            <CardContent>
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
                        current && "border-emerald-500 ring-2 ring-emerald-500/40",
                        answered && !current && "border-emerald-600 bg-emerald-600 text-white",
                        !answered && !current && "bg-muted/50 text-muted-foreground hover:bg-muted",
                        answered && current && "bg-emerald-600 text-white",
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-2"><Circle className="size-3 fill-emerald-600 text-emerald-600" /> Answered</p>
                <p className="flex items-center gap-2"><Circle className="size-3" /> Remaining</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function ExamResultsPanel({
  title,
  result,
  elapsedSeconds,
  onRetake,
  onBack,
}: {
  title: string;
  result: ExamResult;
  elapsedSeconds?: number | null;
  onRetake?: () => void;
  onBack: () => void;
}) {
  const wrong = result.total - result.correct;
  const timeUsed = result.time_taken_seconds ?? elapsedSeconds;

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "overflow-hidden rounded-3xl border p-6 sm:p-8",
          result.passed
            ? "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#ffffff_55%)]"
            : "border-amber-200 bg-[linear-gradient(135deg,#fffbeb,#ffffff_55%)]",
        )}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div
            className={cn(
              "mx-auto flex size-36 items-center justify-center rounded-full border-8 md:mx-0",
              result.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
            )}
          >
            <div className="text-center">
              <p className="text-4xl font-bold tabular-nums">{result.score_percent}%</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Score</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {result.passed ? (
                <Badge className="gap-1.5 rounded-full border-0 bg-emerald-700 px-3 py-1 text-white">
                  <Trophy className="size-3.5" /> Passed
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                  <Target className="size-3.5" /> Keep practicing
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full">{title}</Badge>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {result.passed ? "Great work!" : "Review your answers"}
            </h2>
            <div className="flex flex-wrap justify-center gap-3 md:justify-start">
              <StatBox label="Correct" value={result.correct} tone="good" />
              <StatBox label="Incorrect" value={wrong} tone="bad" />
              <StatBox label="Total" value={result.total} />
              <StatBox label="Time" value={fmtDuration(timeUsed)} />
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1 md:justify-start">
              {onRetake ? (
                <Button variant="outline" className="rounded-xl" onClick={onRetake}>
                  <RotateCcw className="mr-1.5 size-4" />
                  Try again
                </Button>
              ) : null}
              <Button className="rounded-xl bg-emerald-700 hover:bg-emerald-800" onClick={onBack}>
                <BookOpen className="mr-1.5 size-4" />
                Back to course
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Answer review</h3>
        {(result.breakdown?.length ?? 0) === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No answer breakdown available for this attempt.
          </p>
        ) : (
          <div className="space-y-3">
            {result.breakdown!.map((item, i) => (
              <div
                key={item.question_id ?? i}
                className={cn(
                  "rounded-2xl border p-4 sm:p-5",
                  Boolean(item.is_correct)
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-red-200 bg-red-50/40",
                )}
              >
                <div className="flex gap-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      Boolean(item.is_correct) ? "bg-emerald-600/15 text-emerald-700" : "bg-red-500/15 text-red-600",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <p className="font-medium leading-snug">{item.question_text}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border bg-white/70 px-3 py-2 text-sm">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your answer</p>
                        <p className={cn("font-medium", Boolean(item.is_correct) ? "text-emerald-700" : "text-red-600")}>
                          {item.selected_text ?? "No answer"}
                        </p>
                      </div>
                      {!Boolean(item.is_correct) ? (
                        <div className="rounded-xl border bg-white/70 px-3 py-2 text-sm">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Correct answer</p>
                          <p className="font-medium text-emerald-700">{item.correct_text ?? "—"}</p>
                        </div>
                      ) : null}
                    </div>
                    {item.explanation ? (
                      <p className="rounded-xl border-l-2 border-emerald-500/40 bg-white/60 px-3 py-2 text-sm text-muted-foreground">
                        {item.explanation}
                      </p>
                    ) : null}
                  </div>
                  {Boolean(item.is_correct) ? (
                    <CheckCircle2 className="hidden size-5 shrink-0 text-emerald-600 sm:block" />
                  ) : (
                    <XCircle className="hidden size-5 shrink-0 text-red-500 sm:block" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "good" | "bad";
}) {
  return (
    <div className="min-w-[88px] rounded-2xl border bg-white/80 px-4 py-2 text-center">
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-500",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
