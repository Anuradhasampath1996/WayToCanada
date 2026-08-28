"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  ExternalLink,
  Landmark,
  Loader2,
  Newspaper,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import "./dashboard-ircc-updates.css";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const LIMIT = 8;

interface NewsItem {
  id: number;
  title: string;
  link: string;
  description: string | null;
  category: string | null;
  published_at: string | null;
}

function timeSince(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "Date unavailable";
  return new Date(iso).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cleanDescription(text: string | null): string | null {
  if (!text?.trim()) return null;
  return text.replace(/\s+/g, " ").trim();
}

export function DashboardNewsCompact() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/ircc-news`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load news.");
      setItems((json.data ?? []).slice(0, LIMIT));
      setSyncedAt(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load IRCC news.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const { featured, secondary, rest } = useMemo(() => {
    const [lead, ...others] = items;
    return {
      featured: lead ?? null,
      secondary: others.slice(0, 3),
      rest: others.slice(3),
    };
  }, [items]);

  return (
    <section className="ircc-brief overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <header className="ircc-brief__header relative border-b border-border/50 px-4 py-5 sm:px-6 sm:py-6">
        <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                <Shield className="size-3" />
                RCIC briefing desk
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <BadgeCheck className="size-3 text-emerald-600" />
                Official Canada.ca feed
              </span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Landmark className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">IRCC Updates</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Policy releases, media advisories, and program changes that matter to your
                  practice — loaded live into RCIC Master for your daily brief.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {syncedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/70 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <Clock3 className="size-3" />
                Synced {syncedAt.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
              </span>
            ) : null}
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-9 rounded-xl bg-background/80"
            >
              <Link
                href="https://www.canada.ca/en/immigration-refugees-citizenship/news.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Canada.ca
                <ExternalLink className="ml-1.5 size-3.5 opacity-70" />
              </Link>
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-9 rounded-xl"
              onClick={load}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 size-3.5" />
              )}
              Refresh feed
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-5 lg:p-6">
        {loading && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="min-h-[240px] animate-pulse rounded-2xl bg-muted/45" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-muted/40" />
              ))}
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-5 py-8 text-center">
            <Newspaper className="mx-auto size-8 text-destructive/70" />
            <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={load}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-dashed py-14 text-center">
            <Landmark className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground/85">No IRCC updates in cache yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Refresh the feed to pull the latest Canada.ca releases.</p>
            <Button size="sm" className="mt-4" onClick={load}>
              Load updates
            </Button>
          </div>
        )}

        {!loading && !error && featured && (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)] lg:items-stretch">
              <a
                href={featured.link}
                target="_blank"
                rel="noopener noreferrer"
                className="ircc-brief__featured group relative flex min-h-[250px] flex-col justify-between overflow-hidden rounded-2xl border border-primary/15 p-5 sm:p-6"
              >
                <div className="relative z-[1]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:bg-primary">
                      Lead update
                    </Badge>
                    <Badge variant="secondary" className="rounded-md text-[10px] font-medium">
                      {featured.category || "IRCC"}
                    </Badge>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {formatDate(featured.published_at)}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl group-hover:text-primary">
                    {featured.title}
                  </h3>
                  {cleanDescription(featured.description) ? (
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground line-clamp-3 sm:line-clamp-4">
                      {cleanDescription(featured.description)}
                    </p>
                  ) : null}
                </div>
                <div className="relative z-[1] mt-6 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
                  <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Priority for client advising
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    Open release
                    <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </a>

              <aside className="flex flex-col rounded-2xl border border-border/60 bg-muted/20 p-3 sm:p-3.5">
                <div className="mb-2.5 flex items-center justify-between px-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Also in this brief
                  </p>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {secondary.length} items
                  </span>
                </div>
                <ul className="flex flex-1 flex-col gap-2">
                  {secondary.map((item, index) => (
                    <li key={item.id} className="flex-1">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ircc-brief__side-item group flex h-full gap-3 rounded-xl border border-transparent bg-background/70 px-3 py-3 transition-all hover:border-primary/25 hover:bg-primary/[0.04]"
                      >
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold tabular-nums text-primary">
                          {String(index + 2).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                              {item.category || "IRCC"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {timeSince(item.published_at)}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm font-semibold leading-snug tracking-tight group-hover:text-primary line-clamp-2">
                            {item.title}
                          </span>
                        </span>
                        <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            {rest.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border/60">
                <div className="flex items-center justify-between border-b border-border/50 bg-muted/25 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    More releases in feed
                  </p>
                  <span className="text-[11px] text-muted-foreground">{rest.length} additional</span>
                </div>
                <ul className="divide-y divide-border/50">
                  {rest.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-primary/[0.03] sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="flex w-full shrink-0 items-center gap-2 sm:w-40">
                          <Badge variant="outline" className="rounded-md text-[10px] font-medium">
                            {item.category || "IRCC"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {timeSince(item.published_at)}
                          </span>
                        </div>
                        <p className="min-w-0 flex-1 text-sm font-medium leading-snug tracking-tight group-hover:text-primary">
                          {item.title}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary opacity-70 group-hover:opacity-100">
                          Read
                          <ArrowUpRight className="size-3.5" />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <footer className="flex flex-col gap-2 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sourced from Immigration, Refugees and Citizenship Canada. Always confirm details on
                the official release before advising clients.
              </p>
              <Link
                href="https://www.canada.ca/en/immigration-refugees-citizenship/news.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Browse full IRCC newsroom
                <ExternalLink className="size-3" />
              </Link>
            </footer>
          </div>
        )}
      </div>
    </section>
  );
}
