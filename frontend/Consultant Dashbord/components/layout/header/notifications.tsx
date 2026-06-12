"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, ClockIcon, Loader2, CheckCheck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const TOKEN_KEY = "wtc_consultant_token";
const COOKIE_NAME = "wtc_consultant_token";

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
      ? document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1]
      : undefined) ?? (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null) ?? "";
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
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const Notifications = () => {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notifications/unread-count`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.count ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/notifications?per_page=20`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCount();
    const id = setInterval(loadCount, 30000);
    return () => clearInterval(id);
  }, [loadCount]);

  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  async function handleClick(item: AppNotification) {
    if (item.is_unread) {
      await fetch(`${API}/notifications/${item.id}/read`, { method: "POST", headers: authHeaders() });
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_unread: false, read_at: new Date().toISOString() } : n)));
    }
    setOpen(false);
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
    await fetch(`${API}/notifications/read-all`, { method: "POST", headers: authHeaders() });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, is_unread: false })));
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" className="relative" aria-label="Notifications">
          <BellIcon />
          {unread > 0 && (
            <span className="bg-destructive absolute end-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={isMobile ? "center" : "end"} className="ms-4 w-80 p-0">
        <DropdownMenuLabel className="bg-background dark:bg-muted sticky top-0 z-10 p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="font-medium text-sm">Notifications</div>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </DropdownMenuLabel>

        <ScrollArea className="h-[350px]">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10 px-4">No notifications yet</p>
          )}
          {!loading &&
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={cn(
                  "group flex cursor-pointer items-start gap-2 rounded-none border-b px-4 py-3 focus:bg-muted/50",
                  item.is_unread && "bg-emerald-50/50 dark:bg-emerald-950/20",
                )}
                onClick={() => handleClick(item)}
              >
                <div className="flex flex-1 flex-col gap-1 min-w-0">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="text-muted-foreground line-clamp-2 text-xs">{item.body}</div>
                  <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                    <ClockIcon className="size-3" />
                    {fmtWhen(item.created_at)}
                  </div>
                </div>
                {item.is_unread && <span className="bg-destructive mt-1 block size-2 shrink-0 rounded-full" />}
              </DropdownMenuItem>
            ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Notifications;
