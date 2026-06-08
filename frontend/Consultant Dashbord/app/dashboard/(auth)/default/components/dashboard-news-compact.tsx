"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Newspaper, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const LIMIT = 5;

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

export function DashboardNewsCompact() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/ircc-news`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load news.");
      setItems((json.data ?? []).slice(0, LIMIT));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load IRCC news.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card className="h-full border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
              <Newspaper className="size-4" />
            </span>
            IRCC Updates
          </CardTitle>
          <CardDescription>Latest official immigration news</CardDescription>
        </div>
        <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-0">
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No news available.</p>
        )}

        {!loading && !error && items.map((item) => (
          <a
            key={item.id}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40"
          >
            <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {item.category && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                    {item.category}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">{timeSince(item.published_at)}</span>
              </div>
              <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
                {item.title}
              </p>
              {item.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
            <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        ))}

        {!loading && !error && items.length > 0 && (
          <div className="border-t pt-3">
            <Link
              href="https://www.canada.ca/en/immigration-refugees-citizenship/news.html"
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all on Canada.ca
              <ExternalLink className="size-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
