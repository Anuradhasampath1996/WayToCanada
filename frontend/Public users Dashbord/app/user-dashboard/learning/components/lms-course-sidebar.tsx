"use client";

import { Check, Play, Pause, GraduationCap, ClipboardList, Trophy } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StudyProgress } from "@/app/dashboard/(auth)/apps/courses/components";

const EXAM_LABEL: Record<string, string> = { quiz: "Quiz", exam: "Exam", mock_exam: "Mock exam" };

export type LmsLesson = {
  id: number;
  title: string;
  duration_minutes?: number | null;
  is_completed?: boolean;
};

export type LmsModule = {
  id: number;
  title: string;
  lessons?: LmsLesson[];
};

export type LmsQuizItem = {
  id: number;
  title: string;
  content_type?: string;
  time_limit_minutes?: number | null;
  best_score?: number | null;
};

export type LmsHomeworkItem = {
  id: number;
  title: string;
  submitted?: boolean;
};

export type LmsExamAttempt = {
  id: number;
  quiz_title?: string;
  score_percent: number;
  passed: boolean;
};

function fmtDuration(minutes?: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function progressMessage(percent: number, title: string): string {
  if (percent >= 100) return `Congratulations! You completed ${title}. Keep reviewing before your exam.`;
  if (percent >= 75) return `Almost there! You're ${percent}% through ${title}. Finish the remaining lessons and try a mock exam.`;
  if (percent >= 50) return `Great progress — ${percent}% done. Stay consistent and you'll be exam-ready soon.`;
  if (percent > 0) return `You've started strong at ${percent}%. Pick the next lesson and keep going!`;
  return `Welcome! Select a lesson below to begin ${title}.`;
}

function flattenLessons(modules: LmsModule[], activeLessonId?: number | null) {
  const rows: {
    lesson: LmsLesson;
    moduleTitle: string;
    showModuleHeader: boolean;
  }[] = [];

  modules.forEach((mod) => {
    mod.lessons?.forEach((lesson, idx) => {
      rows.push({
        lesson,
        moduleTitle: mod.title,
        showModuleHeader: idx === 0,
      });
    });
  });

  return rows.map((row) => ({
    ...row,
    completed: Boolean(row.lesson.is_completed),
    current: row.lesson.id === activeLessonId,
  }));
}

function countLessons(modules: LmsModule[]) {
  let total = 0;
  let completed = 0;
  modules.forEach((m) =>
    m.lessons?.forEach((l) => {
      total += 1;
      if (l.is_completed) completed += 1;
    }),
  );
  return { total, completed };
}

export function LmsLessonModules({
  modules,
  activeLessonId,
  onSelectLesson,
}: {
  modules: LmsModule[];
  activeLessonId?: number | null;
  onSelectLesson: (lesson: LmsLesson) => void;
}) {
  const rows = flattenLessons(modules, activeLessonId);
  const { total, completed } = countLessons(modules);

  return (
    <Card className="gap-4 border-transparent lg:gap-6 lg:border-border">
      <CardHeader>
        <CardTitle>Course lessons</CardTitle>
        <CardAction>
          <span className="text-sm text-muted-foreground">
            {completed}/{total}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No lessons yet</p>
          )}
          {rows.map(({ lesson, moduleTitle, showModuleHeader, completed: done, current }) => (
            <div key={lesson.id} className="space-y-2">
              {showModuleHeader && (
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {moduleTitle}
                </p>
              )}
              <button
                type="button"
                onClick={() => onSelectLesson(lesson)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  current && "border-primary bg-primary/5",
                  !current && "border-border hover:bg-muted/50",
                )}
              >
                {done ? (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                    <Check className="size-4" />
                  </div>
                ) : current ? (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Pause className="size-4" />
                  </div>
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Play className="size-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{lesson.title}</p>
                  <p className="text-sm text-muted-foreground">{fmtDuration(lesson.duration_minutes)}</p>
                </div>
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function LmsQuizzesCard({
  quizzes,
  examLoading,
  onStartQuiz,
}: {
  quizzes: LmsQuizItem[];
  examLoading: boolean;
  onStartQuiz: (quiz: LmsQuizItem) => void;
}) {
  return (
    <Card className="gap-4 border-transparent lg:gap-6 lg:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="size-4 text-emerald-600" />
          Quizzes &amp; exams
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quizzes.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">No exams added yet</p>
        ) : (
          quizzes.map((q) => (
            <div
              key={q.id}
              className="flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{q.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {EXAM_LABEL[q.content_type ?? "quiz"] ?? "Quiz"}
                  {q.time_limit_minutes ? ` · ${q.time_limit_minutes}m` : ""}
                  {q.best_score != null ? ` · Best ${q.best_score}%` : ""}
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                disabled={examLoading}
                onClick={() => onStartQuiz(q)}
              >
                Start
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function LmsHomeworkCard({
  homework,
  activeHomeworkId,
  onSelectHomework,
}: {
  homework: LmsHomeworkItem[];
  activeHomeworkId?: number | null;
  onSelectHomework: (item: LmsHomeworkItem) => void;
}) {
  return (
    <Card className="gap-4 border-transparent lg:gap-6 lg:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4 text-emerald-600" />
          Assignments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {homework.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">No assignments yet</p>
        ) : (
          homework.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelectHomework(h)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                activeHomeworkId === h.id ? "border-primary bg-primary/5" : "hover:bg-muted/40",
              )}
            >
              <span className="line-clamp-2 font-medium">{h.title}</span>
              {h.submitted && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  Done
                </Badge>
              )}
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function LmsPastResultsCard({
  attempts,
  onViewResult,
}: {
  attempts: LmsExamAttempt[];
  onViewResult: (attemptId: number) => void;
}) {
  if (attempts.length === 0) return null;

  return (
    <Card className="gap-4 border-transparent lg:gap-6 lg:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-amber-500" />
          Past results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {attempts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onViewResult(a.id)}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-sm hover:bg-muted"
          >
            <span className="truncate text-left">{a.quiz_title}</span>
            <Badge className={cn("shrink-0", a.passed && "bg-emerald-600")} variant={a.passed ? "default" : "secondary"}>
              {a.score_percent}%
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export function LmsStudyProgressCard({
  percent,
  courseTitle,
}: {
  percent: number;
  courseTitle: string;
}) {
  return (
    <StudyProgress
      progress={{
        percentage: percent,
        points: [
          { value: 25, reached: percent >= 25 },
          { value: 50, reached: percent >= 50 },
          { value: 75, reached: percent >= 75 },
          { value: 100, reached: percent >= 100 },
        ],
        message: progressMessage(percent, courseTitle),
      }}
    />
  );
}

export function LmsCourseSidebar({
  modules,
  quizzes,
  homework,
  examAttempts,
  progressPercent,
  courseTitle,
  activeLessonId,
  activeHomeworkId,
  examLoading,
  onSelectLesson,
  onStartQuiz,
  onSelectHomework,
  onViewResult,
}: {
  modules: LmsModule[];
  quizzes: LmsQuizItem[];
  homework: LmsHomeworkItem[];
  examAttempts: LmsExamAttempt[];
  progressPercent: number;
  courseTitle: string;
  activeLessonId?: number | null;
  activeHomeworkId?: number | null;
  examLoading: boolean;
  onSelectLesson: (lesson: LmsLesson) => void;
  onStartQuiz: (quiz: LmsQuizItem) => void;
  onSelectHomework: (item: LmsHomeworkItem) => void;
  onViewResult: (attemptId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <LmsStudyProgressCard percent={progressPercent} courseTitle={courseTitle} />
      <LmsLessonModules
        modules={modules}
        activeLessonId={activeLessonId}
        onSelectLesson={onSelectLesson}
      />
      <LmsPastResultsCard attempts={examAttempts} onViewResult={onViewResult} />
      <LmsQuizzesCard quizzes={quizzes} examLoading={examLoading} onStartQuiz={onStartQuiz} />
      <LmsHomeworkCard
        homework={homework}
        activeHomeworkId={activeHomeworkId}
        onSelectHomework={onSelectHomework}
      />
    </div>
  );
}
