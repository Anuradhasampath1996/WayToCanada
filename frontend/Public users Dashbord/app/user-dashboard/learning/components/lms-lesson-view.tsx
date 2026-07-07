"use client";

import { CheckCircle2, FileText, GraduationCap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CourseContent } from "@/app/dashboard/(auth)/apps/courses/components";

export type LmsActiveLesson = {
  id: number;
  title: string;
  video_url?: string | null;
  text_content?: string | null;
  pdf_url?: string | null;
  is_completed?: boolean;
};

export function LmsCourseMetaCard({
  categoryName,
  courseTitle,
}: {
  categoryName?: string | null;
  courseTitle: string;
}) {
  const initials = categoryName?.slice(0, 2).toUpperCase() ?? "EP";

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar className="size-12 bg-emerald-600/10">
            <AvatarFallback className="bg-emerald-600/15 text-emerald-700">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold">{categoryName ?? "Exam prep"}</h3>
            <p className="text-sm text-muted-foreground">Assigned course · {courseTitle}</p>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">
            Learning
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function LmsLessonPlayer({
  lesson,
  onMarkComplete,
}: {
  lesson: LmsActiveLesson;
  onMarkComplete: (lessonId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-md">
        {lesson.video_url ? (
          <iframe
            src={lesson.video_url}
            className="h-full w-full"
            allowFullScreen
            title={lesson.title}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-600/20 via-muted to-muted text-muted-foreground">
            <GraduationCap className="mb-2 size-12 opacity-40" />
            <p className="text-sm">No video for this lesson — read the material below</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Now playing</p>
        <h2 className="text-xl font-bold tracking-tight lg:text-2xl">{lesson.title}</h2>
      </div>

      {lesson.text_content && (
        <div
          className="prose prose-sm max-w-none dark:prose-invert md:prose-base"
          dangerouslySetInnerHTML={{ __html: lesson.text_content }}
        />
      )}

      {lesson.pdf_url && (
        <Button variant="outline" size="lg" asChild>
          <a href={lesson.pdf_url} target="_blank" rel="noreferrer">
            <FileText className="mr-2 size-4" />
            Download study PDF
          </a>
        </Button>
      )}

      <div className="flex items-center gap-3 border-t pt-4">
        {!lesson.is_completed ? (
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => onMarkComplete(lesson.id)}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Mark as complete
          </Button>
        ) : (
          <Badge className="bg-emerald-600 px-3 py-1 text-sm">
            <CheckCircle2 className="mr-1 size-3.5" />
            Completed
          </Badge>
        )}
      </div>
    </div>
  );
}

export function LmsCourseWelcome({
  title,
  description,
  categoryName,
  thumbnailUrl,
  onStartFirstLesson,
  hasLessons,
}: {
  title: string;
  description?: string | null;
  categoryName?: string | null;
  thumbnailUrl?: string | null;
  onStartFirstLesson?: () => void;
  hasLessons: boolean;
}) {
  const suitFor = categoryName
    ? [
        `Prepare for your ${categoryName} exam with guided lessons and practice.`,
        "Track progress and complete quizzes assigned by your consultant.",
        "Review materials, submit assignments, and revisit past exam results.",
      ]
    : [
        "Work through lessons at your own pace.",
        "Complete quizzes and mock exams to test your readiness.",
        "Submit assignments for consultant review.",
      ];

  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted shadow-sm">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600/25 to-muted">
            <GraduationCap className="size-16 text-emerald-600/35" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          {categoryName && (
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">{categoryName}</p>
          )}
          <h2 className="mt-1 text-2xl font-bold leading-tight lg:text-3xl">{title}</h2>
        </div>
      </div>

      {hasLessons && onStartFirstLesson && (
        <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700" onClick={onStartFirstLesson}>
          Start learning
        </Button>
      )}

      <CourseContent
        data={{
          about: description ?? "Your consultant assigned this exam prep course. Use the lesson list to study, then take quizzes and submit assignments when ready.",
          suitFor,
        }}
      />
    </div>
  );
}
