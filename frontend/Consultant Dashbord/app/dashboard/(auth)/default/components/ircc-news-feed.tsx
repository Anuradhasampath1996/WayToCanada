"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, AlertCircle, Newspaper, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

interface NewsItem {
  id: number;
  guid: string;
  title: string;
  link: string;
  description: string | null;
  category: string | null;
  published_at: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return "";
  }
}

function timeSince(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return formatDate(iso);
}

export function IrccNewsFeed() {
  const [items,   setItems]   = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [query,   setQuery]   = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API}/ircc-news`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load news.");
      setItems(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load IRCC news.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = items.filter((n) =>
    !query ||
    n.title.toLowerCase().includes(query.toLowerCase()) ||
    (n.description ?? "").toLowerCase().includes(query.toLowerCase()) ||
    (n.category ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
            <Newspaper className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight leading-tight">Latest IRCC News</h2>
            <p className="text-xs text-muted-foreground">Official Government of Canada immigration updates</p>
          </div>
          {/* Canada flag */}
          <span className="text-lg ml-1" aria-hidden>🍁</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search news…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-44 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={load}
            disabled={loading}
            className="h-8 px-2"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl border bg-muted/40 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 py-10 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>Try Again</Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-sm">
          <Newspaper className="h-8 w-8 opacity-30" />
          {query ? "No results match your search." : "No news items found."}
        </div>
      )}

      {/* Cards grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <a
              key={item.id}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200"
            >
              {/* Top row: category + date */}
              <div className="flex items-center justify-between gap-2">
                {item.category ? (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 max-w-[140px] truncate"
                  >
                    <Tag className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{item.category}</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">IRCC</Badge>
                )}
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {timeSince(item.published_at)}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {item.title}
              </h3>

              {/* Description */}
              {item.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              )}

              {/* Footer */}
              <div className="mt-auto flex items-center gap-1 text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Read full article
                <ExternalLink className="h-3 w-3" />
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Footer note */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground pt-1">
          Source: Government of Canada · IRCC · Updated daily &nbsp;
          <a
            href="https://www.canada.ca/en/immigration-refugees-citizenship/news.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            View all on Canada.ca
          </a>
        </p>
      )}
    </div>
  );
}
