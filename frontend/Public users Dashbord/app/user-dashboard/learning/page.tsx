"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, PlayCircle, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("wtc_token") ?? document.cookie.match(/wtc_token=([^;]+)/)?.[1] ?? "";
}

function CourseThumbnail({
  src,
  title,
  className,
}: {
  src?: string | null;
  title: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={title} className={cn("h-full w-full object-cover", className)} />
    );
  }

  return (
    <div className={cn("h-full w-full bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-muted flex items-center justify-center", className)}>
      <GraduationCap className="h-12 w-12 text-emerald-600/40" />
    </div>
  );
}

export default function LearningPortalPage() {
  const [courses, setCourses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pathwayLocked, setPathwayLocked] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API}/client/lms/courses`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token()}` },
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.status === 403) {
          setPathwayLocked(true);
          setError(typeof body.message === "string" ? body.message : "Learning unlocks after your pathway is assigned.");
          return null;
        }
        if (!r.ok) {
          throw new Error(body.message ?? `Could not load courses (${r.status})`);
        }
        return body;
      })
      .then((d) => {
        if (d) setCourses(d.data ?? []);
      })
      .catch((e) => setError(e.message ?? "Failed to load courses"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full space-y-8">
      <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/80 via-background to-background dark:from-emerald-950/30 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <GraduationCap className="h-6 w-6" />
              <span className="text-sm font-semibold uppercase tracking-wider">Learning portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My exam prep courses</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Courses assigned by your immigration consultant — lessons, mock exams, and assignments in one place.
            </p>
          </div>
          {!loading && courses.length > 0 && (
            <Badge variant="outline" className="w-fit text-sm px-3 py-1">{courses.length} active course{courses.length === 1 ? "" : "s"}</Badge>
          )}
        </div>
      </div>

      {loading && (
        <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground">Loading your courses…</CardContent></Card>
      )}
      {error && pathwayLocked && (
        <Card className="border-amber-200/70 bg-amber-500/[0.04]">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
              <Lock className="size-7" />
            </span>
            <div className="max-w-md space-y-2">
              <p className="text-lg font-semibold">Not available yet</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}
      {error && !pathwayLocked && (
        <Card className="border-red-200"><CardContent className="py-10 text-center text-red-600 text-sm">{error}</CardContent></Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {!loading && !error && courses.map((c) => (
          <Card key={c.assignment_id} className="group overflow-hidden hover:shadow-xl transition-all border-border/80 p-0 gap-0">
            <div className="relative aspect-[16/10] overflow-hidden bg-muted">
              <CourseThumbnail src={c.course.thumbnail_url} title={c.course.title} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/90">{c.course.category}</p>
                <p className="font-bold text-lg leading-snug mt-0.5 line-clamp-2">{c.course.title}</p>
              </div>
              <Badge variant="secondary" className="absolute top-3 right-3 capitalize bg-background/90 backdrop-blur">
                {c.status.replace("_", " ")}
              </Badge>
            </div>
            <CardContent className="p-5 space-y-4">
              {c.course.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{c.course.description}</p>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">{c.progress_percent}%</span>
                </div>
                <Progress value={c.progress_percent} className="h-2" />
              </div>
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 group-hover:shadow-md">
                <Link href={`/user-dashboard/learning/${c.assignment_id}`}>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Continue learning
                  <ArrowRight className="h-4 w-4 ml-auto opacity-60" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && !error && courses.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-medium">No courses assigned yet</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Your consultant will assign IELTS, PTE, or other exam prep courses here when ready.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
