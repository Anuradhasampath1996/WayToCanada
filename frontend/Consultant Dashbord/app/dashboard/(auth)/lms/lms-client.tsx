"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Filter,
  GraduationCap,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function authHeaders(): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ??
    (typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null) ??
    "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type LmsCourseCard = {
  id: number;
  title: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  short_description?: string | null;
  thumbnail_url?: string | null;
  price_cents?: number | null;
  currency?: string | null;
  access_months?: number | null;
  estimated_hours?: number | null;
  difficulty?: string | null;
  regulator?: string | null;
  modules_count?: number;
  quizzes_count?: number;
  question_bank_count?: number;
  owned?: boolean;
  assignment_id?: number | null;
  progress_percent?: number | null;
  category?: { id: number; name: string; slug?: string } | null;
};

function money(cents?: number | null, currency?: string | null) {
  if (cents == null) return "Price TBA";
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: (currency || "CAD").toUpperCase(),
  }).format(cents / 100);
}

function CourseThumb({
  src,
  title,
  category,
}: {
  src?: string | null;
  title: string;
  category?: string | null;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.35),_transparent_45%),linear-gradient(145deg,#0f766e,#064e3b)] px-4 text-center text-white">
      <GraduationCap className="mb-2 size-10 opacity-90" />
      <span className="text-xs font-semibold tracking-[0.16em] uppercase opacity-90">
        {category || "Exam Prep"}
      </span>
    </div>
  );
}

export function LmsHubClient() {
  const router = useRouter();
  const [courses, setCourses] = React.useState<LmsCourseCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("all");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API}/consultant/lms/courses`, { headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? `Failed to load courses (HTTP ${res.status})`);
        if (!cancelled) setCourses(json.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load LMS courses.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = React.useMemo(() => {
    const names = new Set<string>();
    courses.forEach((c) => {
      if (c.category?.name) names.add(c.category.name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [courses]);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return courses.filter((c) => {
      if (category !== "all" && (c.category?.name ?? "") !== category) return false;
      if (!query) return true;
      const hay = `${c.title} ${c.subtitle ?? ""} ${c.description ?? ""} ${c.category?.name ?? ""} ${c.regulator ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [courses, q, category]);

  const pricedCount = courses.filter((c) => (c.price_cents ?? 0) > 0).length;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_42%,#f0fdf4_100%)] p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-10 size-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <Badge className="gap-1.5 rounded-full border-0 bg-emerald-700 text-white hover:bg-emerald-700">
              <Sparkles className="size-3.5" />
              Exam Prep LMS
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Courses for consultant licensing exams
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              Buy and study RCIC and other professional exam prep for your own practice.
              Client courses stay in each client workspace and are not mixed here.
            </p>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Published</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{courses.length}</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Priced (CAD)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{pricedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Categories</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{categories.length}</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card/80 p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses, exams, or regulators…"
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <div className="flex items-center gap-2 sm:w-56">
          <Filter className="hidden size-4 text-muted-foreground sm:block" />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading exam courses…
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
              <GraduationCap className="size-7" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-semibold">No courses match your filters</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Try another search, or clear the category filter. Published courses from AI Course Factory appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => {
            const blurb = course.short_description || course.subtitle || course.description;
            return (
              <article
                key={course.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300/60 hover:shadow-md"
              >
                <div className="relative h-44 overflow-hidden bg-muted">
                  <CourseThumb
                    src={course.thumbnail_url}
                    title={course.title}
                    category={course.category?.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <Badge className="absolute left-3 top-3 border-0 bg-white/90 text-[10px] font-semibold text-slate-800 shadow backdrop-blur">
                    {course.category?.name ?? "Exam Prep"}
                  </Badge>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="line-clamp-2 text-base font-semibold leading-snug text-white drop-shadow">
                      {course.title}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-4">
                  {blurb ? (
                    <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Published exam preparation course.</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1">
                      <BookOpen className="size-3" />
                      {course.modules_count ?? 0} modules
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1">
                      <GraduationCap className="size-3" />
                      {course.quizzes_count ?? 0} quizzes
                    </span>
                    {course.estimated_hours ? (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1">
                        <Clock3 className="size-3" />
                        {course.estimated_hours}h
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/60 pt-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Price
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-slate-900">
                        {money(course.price_cents, course.currency)}
                      </p>
                      {course.owned ? (
                        <p className="text-xs text-emerald-700">Owned · {course.progress_percent ?? 0}% complete</p>
                      ) : course.access_months ? (
                        <p className="text-xs text-muted-foreground">{course.access_months} months access</p>
                      ) : null}
                    </div>
                    <Button
                      className="rounded-xl bg-emerald-700 hover:bg-emerald-800"
                      onClick={() =>
                        router.push(
                          course.owned && course.assignment_id
                            ? `/dashboard/lms/learn/${course.assignment_id}`
                            : `/dashboard/lms/${course.id}`,
                        )
                      }
                    >
                      {course.owned ? "Continue" : "View / Buy"}
                      <ArrowRight className="ml-1 size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
