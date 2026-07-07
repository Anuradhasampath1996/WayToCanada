"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Circle, List, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { LmsCourseSidebar, LmsStudyProgressCard } from "../components/lms-course-sidebar";
import {
  LmsCourseMetaCard,
  LmsCourseWelcome,
  LmsLessonPlayer,
  type LmsActiveLesson,
} from "../components/lms-lesson-view";
import { ExamQuestionPlayer, ExamResultsPanel, type ExamResult } from "../components/lms-exam-player";
import type { LmsLesson } from "../components/lms-course-sidebar";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("wtc_token") ?? document.cookie.match(/wtc_token=([^;]+)/)?.[1] ?? "";
}

function firstIncompleteLesson(course: any): LmsLesson | null {
  for (const mod of course.modules ?? []) {
    for (const lesson of mod.lessons ?? []) {
      if (!lesson.is_completed) return lesson;
    }
  }
  const firstMod = course.modules?.[0];
  return firstMod?.lessons?.[0] ?? null;
}

function allLessons(course: any): LmsLesson[] {
  const list: LmsLesson[] = [];
  for (const mod of course.modules ?? []) {
    for (const lesson of mod.lessons ?? []) list.push(lesson);
  }
  return list;
}

export default function CoursePlayerPage() {
  const router = useRouter();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [course, setCourse] = React.useState<any>(null);
  const [activeLesson, setActiveLesson] = React.useState<LmsActiveLesson | null>(null);
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
      .then((data) => {
        setCourse(data);
        setActiveLesson((prev) => {
          if (!prev) return prev;
          for (const mod of data.modules ?? []) {
            const found = mod.lessons?.find((l: LmsActiveLesson) => l.id === prev.id);
            if (found) return found;
          }
          return prev;
        });
      });
  }, [assignmentId]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || !quiz) return;
    const t = setInterval(() => setTimeLeft((s) => (s !== null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [timeLeft, quiz]);

  const inResultsMode = Boolean(result || viewAttempt);
  const inExamMode = Boolean(quiz);
  const showCourseLayout = !inResultsMode && !inExamMode;

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

  function goBack() {
    if (inExamMode || inResultsMode || activeLesson || activeHomework) {
      clearContent();
      setHwContent("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/user-dashboard/learning");
  }

  function openLesson(lesson: LmsLesson) {
    clearContent();
    setActiveLesson(lesson as LmsActiveLesson);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function markComplete(lessonId: number) {
    await fetch(`${API}/client/lms/assignments/${assignmentId}/lessons/${lessonId}/complete`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
    });
    load();
  }

  async function startQuiz(quizId: number, meta?: { title?: string }) {
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
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
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
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
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
          <Circle className="size-5 animate-pulse" /> Loading course…
        </div>
      </div>
    );
  }

  const progress = course.assignment?.progress_percent ?? 0;
  const lessons = allLessons(course);
  const sidebarProps = {
    modules: course.modules ?? [],
    quizzes: course.quizzes ?? [],
    homework: course.homework ?? [],
    examAttempts: course.exam_attempts ?? [],
    progressPercent: progress,
    courseTitle: course.title,
    activeLessonId: activeLesson?.id,
    activeHomeworkId: activeHomework?.id,
    examLoading,
    onSelectLesson: openLesson,
    onStartQuiz: (q: { id: number; title: string }) => startQuiz(q.id, { title: q.title }),
    onSelectHomework: (h: { id: number }) => {
      clearContent();
      setActiveHomework(h);
      setHwContent("");
    },
    onViewResult: viewExamResult,
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={goBack}>
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">
              {inExamMode || inResultsMode || activeLesson || activeHomework ? "Back to course" : "All courses"}
            </span>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight lg:text-2xl">{course.title}</h1>
            {course.category?.name && (
              <p className="truncate text-sm text-muted-foreground">{course.category.name}</p>
            )}
          </div>
        </div>

        {showCourseLayout && (
          <div className="flex shrink-0 gap-2 lg:hidden">
            <Drawer direction="bottom">
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Study progress">
                  <BarChart3 className="size-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="p-4">
                <LmsStudyProgressCard percent={progress} courseTitle={course.title} />
              </DrawerContent>
            </Drawer>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Course menu">
                  <List className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
                <LmsCourseSidebar {...sidebarProps} />
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>

      {inResultsMode && (
        <div className="max-w-5xl">
          {result && (
            <ExamResultsPanel
              title={resultTitle}
              result={result}
              onRetake={retakeQuizId ? () => startQuiz(retakeQuizId) : undefined}
              onBack={() => {
                setResult(null);
                setRetakeQuizId(null);
              }}
            />
          )}
          {viewAttempt && !result && (
            <ExamResultsPanel
              title={resultTitle}
              subtitle={
                viewAttempt.attempted_at ? new Date(viewAttempt.attempted_at).toLocaleString() : undefined
              }
              result={{
                score_percent: viewAttempt.score_percent,
                passed: viewAttempt.passed,
                correct: viewAttempt.correct ?? viewAttempt.breakdown?.filter((b: { is_correct: boolean | number }) => Boolean(b.is_correct)).length ?? 0,
                total: viewAttempt.total ?? viewAttempt.breakdown?.length ?? 0,
                breakdown: viewAttempt.breakdown ?? [],
              }}
              onBack={() => setViewAttempt(null)}
            />
          )}
        </div>
      )}

      {inExamMode && (
        <ExamQuestionPlayer
          quiz={quiz}
          answers={answers}
          setAnswers={setAnswers}
          currentIndex={currentQuestionIndex}
          setCurrentIndex={setCurrentQuestionIndex}
          timeLeft={timeLeft}
          onSubmit={() => submitQuiz(quiz.id)}
          onExit={() => {
            setQuiz(null);
            setAnswers({});
            setTimeLeft(null);
            setCurrentQuestionIndex(0);
          }}
        />
      )}

      {showCourseLayout && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {activeLesson ? (
              <LmsLessonPlayer lesson={activeLesson} onMarkComplete={markComplete} />
            ) : activeHomework ? (
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>{activeHomework.title}</CardTitle>
                  <CardDescription
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: activeHomework.instructions ?? "" }}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeHomework.submitted ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-emerald-800">
                      Submitted successfully — your consultant will review your work.
                    </div>
                  ) : (
                    <>
                      <Textarea
                        rows={12}
                        className="text-base"
                        placeholder="Write your answer here…"
                        value={hwContent}
                        onChange={(e) => setHwContent(e.target.value)}
                      />
                      <Button
                        size="lg"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => submitHomework(activeHomework.id)}
                        disabled={!hwContent.trim()}
                      >
                        Submit assignment
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <LmsCourseWelcome
                title={course.title}
                description={course.description}
                categoryName={course.category?.name}
                thumbnailUrl={course.thumbnail_url}
                hasLessons={lessons.length > 0}
                onStartFirstLesson={() => {
                  const next = firstIncompleteLesson(course);
                  if (next) openLesson(next);
                }}
              />
            )}

            <LmsCourseMetaCard categoryName={course.category?.name} courseTitle={course.title} />
          </div>

          <div className="hidden space-y-4 lg:col-span-1 lg:block">
            <LmsCourseSidebar {...sidebarProps} />
          </div>
        </div>
      )}
    </div>
  );
}
