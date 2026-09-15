"use client";

import {
  BookOpen, GraduationCap, Trash2, Trophy, ClipboardList, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface LmsAssignmentItem {
  id: number;
  progress_percent: number;
  status: string;
  assigned_at?: string | null;
  course?: {
    id: number;
    title: string;
    slug?: string;
    thumbnail_url?: string | null;
    description?: string | null;
  } | null;
  category?: { id: number; name: string } | null;
  quiz_attempts?: {
    id: number;
    quiz_title?: string;
    score_percent: number;
    passed: boolean;
    attempted_at?: string | null;
  }[];
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  IELTS: "from-blue-600/90 via-indigo-600/80 to-violet-700/90",
  CELPIP: "from-red-600/85 via-rose-600/75 to-orange-600/85",
  PTE: "from-emerald-600/85 via-teal-600/75 to-cyan-600/85",
  TEF: "from-blue-700/85 via-indigo-700/75 to-purple-700/85",
  NCLEX: "from-sky-600/85 via-blue-600/75 to-indigo-600/85",
};

function courseThumbnail(assignment: LmsAssignmentItem): string | null {
  return assignment.course?.thumbnail_url ?? null;
}

function categoryGradient(name?: string | null): string {
  if (!name) return "from-slate-600/80 via-slate-500/70 to-slate-700/80";
  return CATEGORY_GRADIENTS[name.toUpperCase()] ?? "from-emerald-700/85 via-teal-700/75 to-slate-800/85";
}

function statusStyles(status: string): string {
  if (status === "completed") return "bg-emerald-600 text-white";
  if (status === "in_progress") return "bg-blue-600 text-white";
  return "bg-slate-800 text-white";
}

function money(cents?: number | null, currency?: string | null) {
  if (cents == null) return null;
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: (currency || "CAD").toUpperCase(),
  }).format(cents / 100);
}

export function LmsAssignmentGridCard({
  assignment,
  onUnassign,
}: {
  assignment: LmsAssignmentItem;
  onUnassign: (id: number) => void;
}) {
  const thumb = courseThumbnail(assignment);
  const categoryName = assignment.category?.name ?? "Course";
  const title = assignment.course?.title ?? "Untitled course";
  const description = assignment.course?.description;
  const attempts = assignment.quiz_attempts ?? [];
  const passedCount = attempts.filter((q) => q.passed).length;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300/50 hover:shadow-md">
      <div className="relative h-36 w-full overflow-hidden bg-muted sm:h-40">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full flex-col items-center justify-center bg-gradient-to-br px-4 text-center text-white",
              categoryGradient(categoryName),
            )}
          >
            <GraduationCap className="mb-2 h-10 w-10 opacity-90" />
            <span className="text-sm font-bold tracking-wide">{categoryName}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <Badge
          className={cn(
            "absolute left-2.5 top-2.5 border-0 text-[10px] font-semibold capitalize shadow",
            statusStyles(assignment.status),
          )}
        >
          {assignment.status.replace(/_/g, " ")}
        </Badge>
        <Badge
          variant="secondary"
          className="absolute right-2.5 top-2.5 border-0 bg-white/90 text-[10px] font-semibold text-foreground shadow backdrop-blur-sm"
        >
          {categoryName}
        </Badge>
        <div className="absolute bottom-2.5 left-2.5 right-2.5">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white drop-shadow-sm">
            {title}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Progress</span>
            <span className="font-semibold tabular-nums">{assignment.progress_percent}%</span>
          </div>
          <Progress value={assignment.progress_percent} className="h-2" />
        </div>

        {attempts.length > 0 && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Trophy className="h-3.5 w-3.5 text-amber-600" />
              Quiz results
              <span className="font-normal text-muted-foreground">
                ({passedCount}/{attempts.length} passed)
              </span>
            </p>
            <div className="space-y-1.5">
              {attempts.slice(0, 3).map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5 text-[11px]"
                >
                  <span className="min-w-0 truncate text-muted-foreground">{q.quiz_title}</span>
                  <Badge
                    className={cn("shrink-0 text-[10px]", q.passed && "bg-emerald-600")}
                    variant={q.passed ? "default" : "secondary"}
                  >
                    {q.score_percent}%
                  </Badge>
                </div>
              ))}
              {attempts.length > 3 && (
                <p className="text-center text-[10px] text-muted-foreground">
                  +{attempts.length - 3} more attempt{attempts.length - 3 === 1 ? "" : "s"}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            Assigned course
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-lg text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => onUnassign(assignment.id)}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </Button>
        </div>
      </div>
    </article>
  );
}

export function LmsAvailableCoursePicker({
  courses,
  courseId,
  onCourseIdChange,
  onAssign,
  assignedCourseIds,
  assignBusy = false,
}: {
  courses: {
    id: number;
    title: string;
    thumbnail_url?: string | null;
    description?: string | null;
    price_cents?: number | null;
    currency?: string | null;
    category?: { name: string } | null;
  }[];
  courseId: string;
  onCourseIdChange: (id: string) => void;
  onAssign: () => void;
  assignedCourseIds: number[];
  assignBusy?: boolean;
}) {
  const available = courses.filter((c) => !assignedCourseIds.includes(c.id));

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Assign a course</h2>
            <p className="text-xs text-muted-foreground">Choose a published client exam course for this applicant.</p>
          </div>
        </div>
      </div>
      {available.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          All published courses are already assigned to this client.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((c) => {
            const selected = courseId === String(c.id);
            const cat = c.category?.name ?? "Course";
            const priceLabel = money(c.price_cents, c.currency);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCourseIdChange(String(c.id))}
                className={cn(
                  "overflow-hidden rounded-xl border text-left transition-all hover:shadow-sm",
                  selected
                    ? "border-emerald-500 ring-2 ring-emerald-500/25"
                    : "border-border hover:border-emerald-300",
                )}
              >
                <div className="relative h-24 w-full overflow-hidden bg-muted">
                  {c.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className={cn("flex h-full items-center justify-center bg-gradient-to-br text-white", categoryGradient(cat))}>
                      <GraduationCap className="h-8 w-8 opacity-90" />
                    </div>
                  )}
                  <Badge className="absolute left-2 top-2 border-0 bg-black/50 text-[9px] text-white backdrop-blur-sm">
                    {cat}
                  </Badge>
                  {priceLabel ? (
                    <Badge className="absolute right-2 top-2 border-0 bg-white/90 text-[9px] font-semibold text-slate-800">
                      {priceLabel}
                    </Badge>
                  ) : null}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug">{c.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {available.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={onAssign}
            disabled={!courseId || assignBusy}
            className="rounded-xl bg-emerald-700 hover:bg-emerald-800"
          >
            {assignBusy ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Assigning…
              </>
            ) : (
              "Assign selected course"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
