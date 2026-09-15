"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Clock3,
  FileQuestion,
  GraduationCap,
  Loader2,
  Lock,
  MapPin,
  PlayCircle,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function authHeaders(json = false): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ??
    (typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null) ??
    "";
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type CourseDetail = {
  id: number;
  title: string;
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
  homework_count?: number;
  category?: { id: number; name: string } | null;
  modules?: Array<{
    id: number;
    title: string;
    lessons_count: number;
    lessons: Array<{ id: number; title: string; lesson_type?: string }>;
  }>;
  access?: {
    owned: boolean;
    assignment_id?: number | null;
    progress_percent?: number;
    status?: string | null;
    is_free: boolean;
    can_buy: boolean;
    can_start: boolean;
    can_continue: boolean;
  };
};

type TaxQuote = {
  subtotal: number;
  total_tax: number;
  total: number;
  tax_label?: string | null;
  tax_applicable?: boolean;
  disclaimer?: string | null;
};

type ProvinceOpt = { code: string; name: string; label: string };

function money(cents?: number | null, currency?: string | null) {
  if (cents == null || cents < 1) return "Free";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: (currency || "CAD").toUpperCase(),
  }).format(cents / 100);
}

function moneyCad(amount?: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);
}

function resolveCountryCode(raw?: string | null) {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v || v === "CA" || v === "CANADA") return "CA";
  if (v === "US" || v === "USA" || v === "UNITED STATES") return "US";
  if (v === "GB" || v === "UK" || v === "UNITED KINGDOM") return "GB";
  if (v === "IN" || v === "INDIA") return "IN";
  return "OTHER";
}

export function LmsCourseDetailClient({ courseId }: { courseId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [course, setCourse] = React.useState<CourseDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const verifyingRef = React.useRef(false);

  const [billingCountry, setBillingCountry] = React.useState("CA");
  const [addressLine1, setAddressLine1] = React.useState("");
  const [addressLine2, setAddressLine2] = React.useState("");
  const [city, setCity] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [provinces, setProvinces] = React.useState<ProvinceOpt[]>([]);
  const [tax, setTax] = React.useState<TaxQuote | null>(null);
  const [taxLoading, setTaxLoading] = React.useState(false);

  const isCanada = billingCountry === "CA";

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/lms/courses/${courseId}`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? `Failed to load course (HTTP ${res.status})`);
      setCourse(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load course.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ratesRes, profileRes] = await Promise.all([
          fetch(`${API}/tax/gst-hst/rates`, { headers: { Accept: "application/json" } }),
          fetch(`${API}/consultant/profile`, { headers: authHeaders() }),
        ]);
        const ratesJson = ratesRes.ok ? await ratesRes.json() : null;
        const profileJson = profileRes.ok ? await profileRes.json() : null;
        if (cancelled) return;

        const opts: ProvinceOpt[] = ratesJson?.provinces ?? [];
        setProvinces(opts);

        const fromProfile = profileJson?.company_province ?? "";
        if (fromProfile) {
          const match = opts.find(
            (p) =>
              p.code === String(fromProfile).toUpperCase() ||
              p.name.toLowerCase() === String(fromProfile).toLowerCase()
          );
          setProvince(match?.code ?? String(fromProfile).toUpperCase());
        } else if (opts.length > 0) {
          setProvince(opts.find((p) => p.code === "ON")?.code ?? opts[0].code);
        }

        if (profileJson) {
          setBillingCountry(resolveCountryCode(profileJson.company_country));
          setAddressLine1(profileJson.company_address_line1 ?? "");
          setAddressLine2(profileJson.company_address_line2 ?? "");
          setCity(profileJson.company_city ?? "");
          setPostalCode(profileJson.company_postal_code ?? "");
        }
      } catch {
        /* optional profile/tax preload */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const billingPayload = React.useCallback(() => {
    if (!course) return null;
    return {
      product_domain: "consultant_lms",
      course_id: course.id,
      billing_country: billingCountry,
      billing_address_line1: addressLine1.trim(),
      billing_address_line2: addressLine2.trim() || undefined,
      billing_city: city.trim(),
      billing_postal_code: postalCode.trim() || undefined,
      billing_province: isCanada ? province : undefined,
      province: isCanada ? province : undefined,
    };
  }, [course, billingCountry, addressLine1, addressLine2, city, postalCode, province, isCanada]);

  const fetchTaxQuote = React.useCallback(async () => {
    const payload = billingPayload();
    if (!payload || !addressLine1.trim() || !city.trim()) {
      setTax(null);
      return;
    }
    if (isCanada && !province) {
      setTax(null);
      return;
    }
    setTaxLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
      });
      const res = await fetch(`${API}/learning/checkout/tax-quote?${params}`, {
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.tax) setTax(json.tax);
      else setTax(null);
    } catch {
      setTax(null);
    } finally {
      setTaxLoading(false);
    }
  }, [billingPayload, addressLine1, city, isCanada, province]);

  React.useEffect(() => {
    if (course?.access?.can_buy) void fetchTaxQuote();
  }, [course?.access?.can_buy, fetchTaxQuote]);

  React.useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkout === "cancelled") {
      setNotice("Checkout was cancelled. You can buy the course when you are ready.");
      return;
    }
    if (checkout !== "return" || !sessionId || verifyingRef.current) return;
    verifyingRef.current = true;
    setBusy(true);
    setNotice("Confirming your purchase…");
    (async () => {
      try {
        const res = await fetch(`${API}/learning/checkout/verify`, {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ session_id: sessionId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? "Could not verify payment.");
        const assignmentId = json.data?.assignment_id;
        await load();
        if (assignmentId) {
          router.replace(`/dashboard/lms/learn/${assignmentId}`);
          return;
        }
        setNotice("Purchase confirmed. You can start the course now.");
        router.replace(`/dashboard/lms/${courseId}`);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Payment verification failed.");
      } finally {
        setBusy(false);
      }
    })();
  }, [searchParams, courseId, load, router]);

  async function buyCourse() {
    if (!course || busy) return;
    const payload = billingPayload();
    if (!payload) return;
    if (!addressLine1.trim() || !city.trim() || (isCanada && !province)) {
      setError("Enter your billing address so we can calculate GST/HST before checkout.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/learning/checkout`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Checkout failed.");
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      throw new Error("Checkout URL missing.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
      setBusy(false);
    }
  }

  async function startFree() {
    if (!course || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/lms/courses/${course.id}/start`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? "Could not start course.");
      router.push(`/dashboard/lms/learn/${json.data.assignment_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start course.");
      setBusy(false);
    }
  }

  function continueLearning() {
    if (!course?.access?.assignment_id) return;
    router.push(`/dashboard/lms/learn/${course.access.assignment_id}`);
  }

  if (loading && !course) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading course…
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="space-y-4 py-10">
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/dashboard/lms">
            <ArrowLeft className="mr-1.5 size-4" />
            Back to LMS
          </Link>
        </Button>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!course) return null;

  const access = course.access;
  const owned = Boolean(access?.owned || access?.can_continue);
  const canBuy =
    !owned &&
    Boolean(access?.can_buy) &&
    Boolean(addressLine1.trim()) &&
    Boolean(city.trim()) &&
    (!isCanada || Boolean(province)) &&
    !taxLoading &&
    !busy;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" className="rounded-xl px-2.5">
          <Link href="/dashboard/lms">
            <ArrowLeft className="mr-1.5 size-4" />
            All courses
          </Link>
        </Button>
      </div>

      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative min-h-56 overflow-hidden bg-muted lg:min-h-full">
            {course.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-56 items-center justify-center bg-[linear-gradient(145deg,#0f766e,#064e3b)] text-white">
                <GraduationCap className="size-16 opacity-90" />
              </div>
            )}
            {!owned ? (
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/55 via-transparent to-transparent p-5 lg:hidden">
                <Badge className="gap-1 border-0 bg-black/50 text-white">
                  <Lock className="size-3" />
                  Locked until purchase
                </Badge>
              </div>
            ) : null}
          </div>

          <div className="space-y-5 p-5 sm:p-7">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full">
                  {course.category?.name ?? "Exam Prep"}
                </Badge>
                {owned ? (
                  <Badge className="rounded-full border-0 bg-emerald-700 text-white hover:bg-emerald-700">
                    Unlocked
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full gap-1">
                    <Lock className="size-3" />
                    Purchase required
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{course.title}</h1>
              {course.subtitle || course.short_description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {course.subtitle || course.short_description}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border bg-emerald-50/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
                Course price (CAD)
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-emerald-950">
                {money(course.price_cents, course.currency)}
              </p>
              {course.access_months ? (
                <p className="mt-1 text-sm text-emerald-900/70">{course.access_months} months access after purchase</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Stat icon={BookOpen} label="Modules" value={course.modules_count ?? 0} />
              <Stat icon={GraduationCap} label="Quizzes" value={course.quizzes_count ?? 0} />
              <Stat icon={FileQuestion} label="Bank Qs" value={course.question_bank_count ?? 0} />
              <Stat icon={ClipboardList} label="Homework" value={course.homework_count ?? 0} />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {owned ? (
                <Button
                  className="h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800"
                  disabled={busy}
                  onClick={continueLearning}
                >
                  <PlayCircle className="mr-1.5 size-4" />
                  {(access?.progress_percent ?? 0) > 0 ? "Continue learning" : "Start course"}
                </Button>
              ) : access?.can_start ? (
                <Button
                  className="h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800"
                  disabled={busy}
                  onClick={() => void startFree()}
                >
                  {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <PlayCircle className="mr-1.5 size-4" />}
                  Start free course
                </Button>
              ) : (
                <>
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-3.5">
                    <p className="text-sm font-medium">Billing address</p>
                    <p className="text-[11px] text-muted-foreground">
                      Same GST/HST place-of-supply calculation as subscription checkout — enter address before Stripe.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="lms-country">Country</Label>
                      <Select value={billingCountry} onValueChange={setBillingCountry}>
                        <SelectTrigger id="lms-country" className="h-10 w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                          <SelectItem value="IN">India</SelectItem>
                          <SelectItem value="OTHER">Outside Canada (other)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="h-10 rounded-xl"
                      placeholder="Street address"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                    />
                    <Input
                      className="h-10 rounded-xl"
                      placeholder="Apartment, suite (optional)"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        className="h-10 rounded-xl"
                        placeholder="City"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                      <Input
                        className="h-10 rounded-xl"
                        placeholder="Postal / ZIP"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                      />
                    </div>
                    {isCanada ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="lms-province" className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-muted-foreground" />
                          Province (place of supply)
                        </Label>
                        <Select value={province} onValueChange={setProvince} disabled={provinces.length === 0}>
                          <SelectTrigger id="lms-province" className="h-10 w-full rounded-xl">
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                          <SelectContent>
                            {provinces.map((p) => (
                              <SelectItem key={p.code} value={p.code}>
                                {p.name} — {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>

                  {taxLoading ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Calculating tax…
                    </p>
                  ) : tax ? (
                    <div className="space-y-1 rounded-2xl bg-muted/40 p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span>Subtotal</span>
                        <span className="tabular-nums">{moneyCad(tax.subtotal)}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span className="min-w-0 break-words">
                          Tax{tax.tax_label ? ` (${tax.tax_label})` : ""}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {tax.tax_applicable === false ? "—" : moneyCad(tax.total_tax)}
                        </span>
                      </div>
                      {tax.disclaimer ? (
                        <p className="pt-1 text-[11px] text-muted-foreground">{tax.disclaimer}</p>
                      ) : null}
                      <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
                        <span>Total</span>
                        <span className="tabular-nums">{moneyCad(tax.total)}</span>
                      </div>
                    </div>
                  ) : null}

                  <Button
                    className="h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800"
                    disabled={!canBuy}
                    onClick={() => void buyCourse()}
                  >
                    {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <ShoppingCart className="mr-1.5 size-4" />}
                    {busy
                      ? "Redirecting to Stripe…"
                      : `Continue to Stripe — ${tax ? moneyCad(tax.total) : money(course.price_cents, course.currency)}`}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Payments secured by Stripe · GST/HST calculated from your billing address
                  </p>
                </>
              )}

              {course.estimated_hours ? (
                <Badge variant="outline" className="h-10 w-fit gap-1.5 rounded-xl px-3">
                  <Clock3 className="size-3.5" />
                  ~{course.estimated_hours} hours
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {course.description ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">About this course</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {course.description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Curriculum preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(course.modules ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules published yet.</p>
          ) : (
            (course.modules ?? []).map((module, index) => (
              <div key={module.id} className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      Module {index + 1}
                    </p>
                    <p className="mt-1 font-medium">{module.title}</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {module.lessons_count} lessons
                  </Badge>
                </div>
                {module.lessons?.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                    {module.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-emerald-600/70" />
                        <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                        {!owned ? <Lock className="size-3.5 opacity-50" /> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
          {!owned ? (
            <p className="pt-1 text-xs text-muted-foreground">
              Lesson content, quizzes, and homework unlock after you buy the course.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
