"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { academyGet, academyHeaders, academySend } from "@/lib/academy";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type CatalogCard = {
  id: number;
  course_id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  target_exam?: string | null;
  content_language?: string | null;
  difficulty?: string | null;
  estimated_hours?: number | null;
  price_cents?: number | null;
  currency?: string | null;
  access_months?: number | null;
  status?: string;
  cta_label?: string;
  status_cta?: string;
  entitled_until?: string | null;
};

type Strings = Record<string, string>;

function money(cents?: number | null, currency?: string | null) {
  if (cents == null) return "—";
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: (currency || "CAD").toUpperCase() }).format(cents / 100);
}

export default function AcademyCoursesPage() {
  const [courses, setCourses] = useState<CatalogCard[]>([]);
  const [open, setOpen] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [strings, setStrings] = useState<Strings>({});
  const [filters, setFilters] = useState({ q: "", exam: "", language: "", price: "", status: "" });

  const load = useCallback(() => {
    const locale = localStorage.getItem("wtc_locale") || "en";
    const params = new URLSearchParams();
    params.set("locale", locale);
    if (filters.q) params.set("q", filters.q);
    if (filters.language) params.set("language", filters.language);
    if (filters.price) params.set("price", filters.price);
    if (filters.status) params.set("status", filters.status);
    academyGet<{ data: CatalogCard[] }>(`/courses?${params.toString()}`)
      .then((r) => setCourses(r.data))
      .catch((e) => setError(e.message));
    fetch(`${API}/learning/i18n?locale=${locale}`, { headers: academyHeaders() })
      .then((r) => r.json())
      .then((d) => setStrings(d.strings ?? {}))
      .catch(() => {});
  }, [filters]);

  useEffect(() => {
    load();
    const onLocale = () => load();
    window.addEventListener("wtc-locale", onLocale);
    return () => window.removeEventListener("wtc-locale", onLocale);
  }, [load]);

  const exams = useMemo(() => Array.from(new Set(courses.map((c) => c.target_exam).filter(Boolean))) as string[], [courses]);
  const visible = courses.filter((c) => !filters.exam || c.target_exam === filters.exam);

  async function checkout(courseId: number) {
    setBusy(courseId);
    setError(null);
    try {
      const res = await fetch(`${API}/learning/checkout`, {
        method: "POST",
        headers: academyHeaders(),
        body: JSON.stringify({ product_domain: "rcic_academy", course_id: courseId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "Checkout failed");
      if (body.url) window.location.href = body.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  function cta(card: CatalogCard) {
    const action = card.status_cta;
    if (action === "buy_now" || action === "renew") return checkout(card.course_id ?? card.id);
    academyGet<Record<string, unknown>>(`/courses/${card.course_id ?? card.id}`).then(setOpen);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-medium">{strings.catalog ?? "RCIC Academy"}</h2>
        <p className="text-sm text-muted-foreground">
          Independent professional learning. Not official CICC exam material. No ratings are shown unless they are real.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="rounded-md border px-3 py-2 text-sm"
          placeholder={strings.search ?? "Search"}
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select className="rounded-md border px-3 py-2 text-sm" value={filters.exam} onChange={(e) => setFilters((f) => ({ ...f, exam: e.target.value }))}>
          <option value="">{strings.target_exam ?? "Target exam"}</option>
          {exams.map((exam) => (
            <option key={exam} value={exam}>
              {exam}
            </option>
          ))}
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={filters.language} onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))}>
          <option value="">{strings.language ?? "Language"}</option>
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={filters.price} onChange={(e) => setFilters((f) => ({ ...f, price: e.target.value }))}>
          <option value="">{strings.price ?? "Price"}</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">{strings.status ?? "Status"}</option>
          <option value="not_purchased">Not purchased</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {visible.map((course) => (
          <article key={course.course_id ?? course.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
            <div className="aspect-[16/10] bg-muted">
              {course.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <GraduationCap className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{course.target_exam ?? "RCIC"}</div>
              <h3 className="font-semibold leading-snug">{course.title}</h3>
              {course.subtitle && <p className="text-sm text-muted-foreground line-clamp-2">{course.subtitle}</p>}
              <dl className="mt-auto grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <div>Lang: {(course.content_language ?? "en").toUpperCase()}</div>
                <div className="capitalize">{course.difficulty ?? "—"}</div>
                <div>{course.estimated_hours ? `${course.estimated_hours} h` : "—"}</div>
                <div>{course.access_months ? `${course.access_months} mo` : "—"}</div>
                <div className="col-span-2 font-medium text-foreground">{money(course.price_cents, course.currency)}</div>
                <div className="col-span-2 capitalize">{course.status?.replace("_", " ")}</div>
              </dl>
              <button
                className="mt-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
                disabled={busy === (course.course_id ?? course.id)}
                onClick={() => cta(course)}
              >
                {course.cta_label ?? strings.buy_now ?? "View"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && <p className="text-sm text-muted-foreground">No published Academy courses match these filters.</p>}
      {open && (
        <div className="rounded-lg border p-4 text-sm">
          <div className="mb-2 font-medium">{String((open.course as { title?: string } | undefined)?.title ?? "Course")}</div>
          {(open as { entitled?: boolean }).entitled === false && <p className="text-muted-foreground">Purchase or entitlement is required before lessons unlock.</p>}
          {(open as { can_switch_to_latest?: boolean }).can_switch_to_latest && (
            <button className="mt-3 rounded border px-3 py-1" onClick={() => academySend(`/courses/${(open as { course: { id: number } }).course.id}/switch-latest`, "POST")}>
              Switch to latest version
            </button>
          )}
          {(open as { entitled?: boolean }).entitled && (
            <Link className="mt-3 inline-block underline" href="/dashboard/academy/learning">
              {strings.continue_learning ?? "Continue Learning"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
