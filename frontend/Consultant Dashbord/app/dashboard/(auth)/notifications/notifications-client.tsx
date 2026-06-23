"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Clock,
  Loader2,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type AppNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  is_unread: boolean;
  created_at: string;
};

function authHeaders(): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtWhen(iso: string) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export function NotificationsClient() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        fetch(`${API}/notifications?per_page=50`, { headers: authHeaders() }),
        fetch(`${API}/notifications/unread-count`, { headers: authHeaders() }),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setItems(data.data ?? []);
      }
      if (countRes.ok) {
        const data = await countRes.json();
        setUnread(data.count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClick(item: AppNotification) {
    if (item.is_unread) {
      await fetch(`${API}/notifications/${item.id}/read`, { method: "POST", headers: authHeaders() });
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, is_unread: false, read_at: new Date().toISOString() } : n,
        ),
      );
    }
    if (item.action_url) {
      try {
        const url = new URL(item.action_url);
        const here = typeof window !== "undefined" ? window.location.origin : "";
        if (here && url.origin === here) {
          router.push(url.pathname + url.search + url.hash);
        } else {
          window.location.href = item.action_url;
        }
      } catch {
        router.push(item.action_url);
      }
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch(`${API}/notifications/read-all`, { method: "POST", headers: authHeaders() });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_unread: false })));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="min-w-0 w-full space-y-4 overflow-x-hidden px-3 pb-10 sm:space-y-6 sm:px-0 sm:pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0
              ? `${unread} unread notification${unread === 1 ? "" : "s"}`
              : "You're all caught up."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-full sm:w-auto"
              onClick={markAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCheck className="size-4" />
              )}
              Mark all read
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto" asChild>
            <Link href="/dashboard/account?tab=integrations#notifications">
              <Settings2 className="size-4" />
              Preferences
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Loading notifications…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Bell className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground">
                Updates about clients, cases, and billing will appear here.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleClick(item)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50 sm:gap-4 sm:px-6 sm:py-5",
                    item.is_unread && "bg-emerald-50/50 dark:bg-emerald-950/20",
                  )}
                >
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted sm:size-10">
                    <Bell className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug text-foreground break-words">
                        {item.title}
                      </p>
                      {item.is_unread && (
                        <span className="bg-destructive mt-1.5 block size-2 shrink-0 rounded-full" />
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground break-words">
                      {item.body}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      {fmtWhen(item.created_at)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
