"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, GraduationCap, PlayCircle, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LocaleToggle } from "@/components/locale-toggle";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function token() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("wtc_token") ?? document.cookie.match(/wtc_token=([^;]+)/)?.[1] ?? "";
}

function headers() {
  return { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token()}` };
}

function money(cents?: number | null, currency?: string | null) {
  if (cents == null) return "—";
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: (currency || "CAD").toUpperCase() }).format(cents / 100);
}

function CourseThumbnail({ src, title, className }: { src?: string | null; title: string; className?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={title} className={cn("h-full w-full object-cover", className)} />
    );
  }
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600/20 via-emerald-500/10 to-muted", className)}>
      <GraduationCap className="h-12 w-12 text-emerald-600/40" />
    </div>
  );
}

type CatalogCard = {
  course_id: number;
  title: string;
  subtitle?: string | null;
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
  category?: string | null;
  assignment_id?: number;
};

export default function LearningPortalPage() {
  const router = useRouter();
  const [catalog, setCatalog] = React.useState<CatalogCard[]>([]);
  const [courses, setCourses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [strings, setStrings] = React.useState<Record<string, string>>({});
  const [filters, setFilters] = React.useState({ q: "", category: "", language: "", price: "", status: "" });
  const [busy, setBusy] = React.useState<number | null>(null);

  const load = React.useCallback(() => {
    const locale = localStorage.getItem("wtc_locale") || "en";
    const params = new URLSearchParams({ locale });
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.language) params.set("language", filters.language);
    if (filters.price) params.set("price", filters.price);
    if (filters.status) params.set("status", filters.status);
    setLoading(true);
    Promise.all([
      fetch(`${API}/client/lms/catalog?${params}`, { headers: headers() }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.message ?? "Could not load marketplace");
        return body.data ?? [];
      }),
      fetch(`${API}/client/lms/courses`, { headers: headers() }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (r.status === 403) return [];
        if (!r.ok) return [];
        return body.data ?? [];
      }),
      fetch(`${API}/learning/i18n?locale=${locale}`, { headers: headers() }).then((r) => r.json()),
    ])
      .then(([cards, mine, i18n]) => {
        setCatalog(cards);
        setCourses(mine);
        setStrings(i18n.strings ?? {});
        setError(null);
      })
      .catch((e) => setError(e.message ?? "Failed to load marketplace"))
      .finally(() => setLoading(false));
  }, [filters]);

  React.useEffect(() => {
    load();
    const onLocale = () => load();
    window.addEventListener("wtc-locale", onLocale);
    return () => window.removeEventListener("wtc-locale", onLocale);
  }, [load]);

  async function act(card: CatalogCard) {
    setBusy(card.course_id);
    try {
      if (card.status_cta === "continue" && card.assignment_id) {
        router.push(`/user-dashboard/learning/${card.assignment_id}`);
        return;
      }
      if (card.status_cta === "start") {
        const res = await fetch(`${API}/client/lms/catalog/${card.course_id}/start`, { method: "POST", headers: headers() });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message ?? "Could not start course");
        router.push(`/user-dashboard/learning/${body.assignment_id}`);
        return;
      }
      const res = await fetch(`${API}/learning/checkout`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ product_domain: "client_lms", course_id: card.course_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? "Checkout failed");
      if (body.url) window.location.href = body.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const categories = Array.from(new Set(catalog.map((c) => c.category || c.target_exam).filter(Boolean))) as string[];

  return (
    <div className="w-full space-y-8">
      <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/80 via-background to-background p-6 dark:from-emerald-950/30 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-600">
              <GraduationCap className="h-6 w-6" />
              <span className="text-sm font-semibold uppercase tracking-wider">{strings.catalog ?? "Learning Marketplace"}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{strings.catalog ?? "Learning Marketplace"}</h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Citizenship and language exam prep. RCIC professional courses are not listed here.
            </p>
          </div>
          <LocaleToggle />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input className="rounded-md border px-3 py-2 text-sm" placeholder={strings.search ?? "Search"} value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        <select className="rounded-md border px-3 py-2 text-sm" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
          <option value="">{strings.category ?? "Category"}</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
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

      {error && <Card className="border-red-200"><CardContent className="py-6 text-sm text-red-600">{error}</CardContent></Card>}
      {loading && <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground">Loading marketplace…</CardContent></Card>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {!loading && catalog.map((c) => (
          <Card key={c.course_id} className="overflow-hidden p-0">
            <div className="relative aspect-[16/10] bg-muted">
              <CourseThumbnail src={c.thumbnail_url} title={c.title} />
              <Badge variant="secondary" className="absolute right-3 top-3 capitalize">{(c.status ?? "").replace("_", " ")}</Badge>
            </div>
            <CardContent className="space-y-2 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{c.target_exam ?? c.category}</p>
              <h2 className="font-semibold leading-snug">{c.title}</h2>
              {c.subtitle && <p className="line-clamp-2 text-sm text-muted-foreground">{c.subtitle}</p>}
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>{(c.content_language ?? "en").toUpperCase()}</span>
                <span>{c.difficulty ?? "—"}</span>
                <span>{c.estimated_hours ? `${c.estimated_hours} h` : "—"}</span>
                <span>{c.access_months ? `${c.access_months} mo` : "—"}</span>
                <span className="col-span-2 font-medium text-foreground">{money(c.price_cents, c.currency)}</span>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={busy === c.course_id} onClick={() => act(c)}>
                {c.cta_label ?? strings.buy_now ?? "Buy Now"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">{strings.my_learning ?? "My exam prep courses"}</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.assignment_id} className="group overflow-hidden p-0">
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                <CourseThumbnail src={c.course.thumbnail_url} title={c.course.title} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/90">{c.course.category}</p>
                  <p className="mt-0.5 line-clamp-2 text-lg font-bold leading-snug">{c.course.title}</p>
                </div>
              </div>
              <CardContent className="space-y-4 p-5">
                <Progress value={c.progress_percent} className="h-2" />
                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <Link href={`/user-dashboard/learning/${c.assignment_id}`}>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Continue learning
                    <ArrowRight className="ml-auto h-4 w-4 opacity-60" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {!loading && courses.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
              <p className="font-medium">No active courses yet</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Buy or start a marketplace course above, or wait for your consultant to assign pathway-restricted prep.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
