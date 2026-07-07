"use client";

import * as React from "react";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
  RotateCcw, Trophy, Target, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  breakdown: BreakdownItem[];
};

const EXAM_LABEL: Record<string, string> = { quiz: "Quiz", exam: "Exam", mock_exam: "Mock exam" };

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ExamQuestionPlayer({
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
      <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="mb-2 bg-emerald-600">{EXAM_LABEL[quiz.content_type] ?? "Exam"}</Badge>
            <h2 className="text-xl font-bold md:text-2xl">{quiz.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Question {currentIndex + 1} of {total} · {answeredCount} answered
            </p>
          </div>
          <div className="flex items-center gap-2">
            {timeLeft !== null && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-base font-bold tabular-nums",
                  timeLeft < 60 ? "border-red-500/50 bg-red-50 text-red-600" : "bg-muted/50",
                )}
              >
                <Clock className="size-4" />
                {fmtTime(timeLeft)}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={onExit} className="gap-1.5">
              <ArrowLeft className="size-4" /> Back to course
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start gap-5 lg:flex-row lg:gap-6">
        <div className="w-full min-w-0 flex-1 space-y-4">
          <Card className="overflow-hidden border-2 border-border/80 shadow-md">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {currentIndex + 1}
                </span>
                {q.topic && <Badge variant="outline" className="text-[10px]">{q.topic}</Badge>}
              </div>
              <CardTitle className="text-lg font-semibold leading-relaxed">{q.question_text}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-5">
              {q.options.map((o: any) => (
                <label
                  key={o.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-all",
                    answers[q.id] === o.id
                      ? "border-emerald-500 bg-emerald-50/90 shadow-sm dark:bg-emerald-950/30"
                      : "border-transparent bg-muted/40 hover:border-border hover:bg-muted/70",
                  )}
                >
                  <input
                    type="radio"
                    className="size-4 accent-emerald-600"
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
              <ChevronLeft className="size-4" /> Previous
            </Button>
            {!isLast ? (
              <Button
                size="lg"
                className="min-w-[120px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setCurrentIndex((i) => i + 1)}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="min-w-[140px] bg-emerald-600 hover:bg-emerald-700"
                onClick={onSubmit}
                disabled={!allAnswered}
              >
                Submit exam
              </Button>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:w-72 xl:w-80">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b bg-muted/30 px-4 py-3">
              <p className="text-sm font-semibold">Jump to question</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {answeredCount} of {total} answered
              </p>
            </div>
            <div className="space-y-4 p-4">
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
                        current && "border-emerald-500 ring-2 ring-emerald-500 ring-offset-1",
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
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ExamResultsPanel({
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
    <div className="w-full animate-in space-y-6 duration-500 fade-in slide-in-from-bottom-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-8 md:p-10",
          result.passed
            ? "border-emerald-500/30 bg-gradient-to-br from-emerald-50 via-background to-emerald-50/30 dark:from-emerald-950/40 dark:to-background"
            : "border-amber-500/30 bg-gradient-to-br from-amber-50 via-background to-orange-50/20 dark:from-amber-950/30 dark:to-background",
        )}
      >
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          <div
            className={cn(
              "relative mx-auto flex size-36 shrink-0 items-center justify-center rounded-full border-8 md:mx-0",
              result.passed ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10",
            )}
          >
            <div className="text-center">
              <p className="text-4xl font-bold tabular-nums">{result.score_percent}%</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Score</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {result.passed ? (
                <Badge className="gap-1.5 bg-emerald-600 px-3 py-1 text-base">
                  <Trophy className="size-4" /> Passed
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-base">
                  <Target className="size-4" /> Keep practicing
                </Badge>
              )}
              <Badge variant="outline">{title}</Badge>
            </div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {result.passed ? "Great work!" : "Review your answers below"}
            </h2>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            <div className="flex flex-wrap justify-center gap-4 pt-1 md:justify-start">
              <div className="min-w-[88px] rounded-xl border bg-background/80 px-4 py-2 text-center">
                <p className="text-2xl font-bold text-emerald-600">{result.correct}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="min-w-[88px] rounded-xl border bg-background/80 px-4 py-2 text-center">
                <p className="text-2xl font-bold text-red-500">{wrong}</p>
                <p className="text-xs text-muted-foreground">Incorrect</p>
              </div>
              <div className="min-w-[88px] rounded-xl border bg-background/80 px-4 py-2 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2 md:justify-start">
              {onRetake && (
                <Button variant="outline" onClick={onRetake} className="gap-2">
                  <RotateCcw className="size-4" /> Try again
                </Button>
              )}
              <Button onClick={onBack} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <BookOpen className="size-4" /> Back to course
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Answer review</h3>
        <div className="grid gap-3">
          {(result.breakdown?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No answer breakdown available for this attempt.
            </p>
          ) : (
            result.breakdown.map((item, i) => (
            <div
              key={item.question_id ?? i}
              className={cn(
                "rounded-xl border p-4 transition-colors md:p-5",
                Boolean(item.is_correct)
                  ? "border-emerald-200/80 bg-emerald-50/40 dark:bg-emerald-950/15"
                  : "border-red-200/80 bg-red-50/40 dark:bg-red-950/15",
              )}
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    Boolean(item.is_correct) ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-600",
                  )}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="font-medium leading-snug">{item.question_text}</p>
                  {item.topic && <Badge variant="outline" className="text-[10px]">{item.topic}</Badge>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        Boolean(item.is_correct) ? "border-emerald-300/50" : "border-red-300/50",
                      )}
                    >
                      <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Your answer</p>
                      <p
                        className={cn(
                          "font-medium",
                          Boolean(item.is_correct) ? "text-emerald-700 dark:text-emerald-400" : "text-red-600",
                        )}
                      >
                        {item.selected_text ?? "No answer"}
                      </p>
                    </div>
                    {!Boolean(item.is_correct) && (
                      <div className="rounded-lg border border-emerald-300/50 px-3 py-2 text-sm">
                        <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          Correct answer
                        </p>
                        <p className="font-medium text-emerald-700 dark:text-emerald-400">
                          {item.correct_text ?? "—"}
                        </p>
                      </div>
                    )}
                  </div>
                  {item.explanation && (
                    <p className="rounded-lg border-l-2 border-primary/40 bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                      {item.explanation}
                    </p>
                  )}
                </div>
                {Boolean(item.is_correct) ? (
                  <CheckCircle2 className="hidden size-5 shrink-0 text-emerald-600 sm:block" />
                ) : (
                  <XCircle className="hidden size-5 shrink-0 text-red-500 sm:block" />
                )}
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}
