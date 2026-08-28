"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Clock3,
  Inbox,
  Loader2,
  Mail,
  MessageSquareQuote,
  Phone,
  RefreshCw,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import "./client-requests.css";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const TOKEN_KEY = "wtc_consultant_token";
const COOKIE_NAME = "wtc_consultant_token";

type ClientRequest = {
  id: number;
  status: string;
  message?: string | null;
  created_at?: string;
  client?: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    created_at?: string;
  } | null;
};

function authHeaders(): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1]
      : undefined) ?? (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null) ?? "";
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function avatarTone(name: string) {
  const tones = [
    "bg-primary/15 text-primary",
    "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  ];
  const idx = name.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0) % tones.length;
  return tones[idx];
}

export function ClientRequestsClient() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("request");

  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);
  const [declineTarget, setDeclineTarget] = useState<ClientRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/client-requests?status=pending&per_page=50`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to load requests.");
      setRequests(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withMessage = useMemo(
    () => requests.filter((r) => r.message?.trim()).length,
    [requests],
  );

  async function handleAccept(id: number) {
    setActingId(id);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/client-requests/${id}/accept`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Accept failed.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Accept failed.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDecline(id: number) {
    setActingId(id);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/client-requests/${id}/decline`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Decline failed.");
      setDeclineTarget(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Decline failed.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden pb-10">
      <section className="client-requests-shell overflow-hidden rounded-2xl border border-border/50 shadow-sm">
        <header className="client-requests-header relative border-b border-border/50 px-4 py-5 sm:px-6">
          <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                  <Inbox className="size-3" />
                  Inbound leads
                </span>
                {!loading && requests.length > 0 ? (
                  <Badge variant="secondary" className="rounded-lg font-normal">
                    {requests.length} pending
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  <UserPlus className="size-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Client requests</h1>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Applicants who chose you on the public site — review, accept, and open their workspace.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!loading && requests.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
                  <MessageSquareQuote className="size-3.5 text-primary" />
                  {withMessage} with a note
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl bg-background/80"
                onClick={load}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-5 lg:p-6">
          {error && (
            <div className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[118px] animate-pulse rounded-2xl bg-muted/45" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 py-16 text-center">
              <Sparkles className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-4 text-base font-semibold text-foreground/85">No pending requests</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                When applicants choose you as their consultant, they will appear here for review.
              </p>
              <Button variant="outline" size="sm" className="mt-5 rounded-xl" onClick={load}>
                <RefreshCw className="mr-1.5 size-3.5" />
                Check again
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
              {requests.map((req) => {
                const client = req.client;
                const name = client?.name ?? "Unknown client";
                const highlighted = highlightId === String(req.id);

                return (
                  <li
                    key={req.id}
                    className={cn(
                      "client-request-row px-4 py-4 transition-colors sm:px-5 sm:py-4.5",
                      "hover:bg-muted/25",
                      highlighted && "bg-primary/[0.04] ring-inset ring-2 ring-primary/20",
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                      <div className="flex min-w-0 flex-1 gap-3.5">
                        <span
                          className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            avatarTone(name),
                          )}
                        >
                          {initials(name)}
                        </span>

                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold tracking-tight">{name}</h3>
                            <Badge className="rounded-md border-amber-300/50 bg-amber-500/10 text-[10px] font-semibold uppercase tracking-wide text-amber-800 hover:bg-amber-500/10 dark:text-amber-300">
                              Pending
                            </Badge>
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock3 className="size-3" />
                              {timeAgo(req.created_at)}
                            </span>
                            <span className="hidden text-[11px] text-muted-foreground sm:inline">
                              · {formatDate(req.created_at)}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
                            {client?.email ? (
                              <a
                                href={`mailto:${client.email}`}
                                className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                              >
                                <Mail className="size-3.5 shrink-0" />
                                <span className="truncate">{client.email}</span>
                              </a>
                            ) : null}
                            {client?.phone ? (
                              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground sm:before:mx-1 sm:before:text-border sm:before:content-['·']">
                                <Phone className="size-3.5 shrink-0" />
                                {client.phone}
                              </span>
                            ) : null}
                          </div>

                          {req.message ? (
                            <div className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5">
                              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                <MessageSquareQuote className="size-3" />
                                Their message
                              </p>
                              <p className="text-sm leading-relaxed text-foreground/90">
                                {req.message}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs italic text-muted-foreground">
                              No message included with this request.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch xl:flex-row">
                        <Button
                          onClick={() => handleAccept(req.id)}
                          disabled={actingId === req.id}
                          className="h-9 rounded-xl px-4"
                        >
                          {actingId === req.id ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1.5 size-3.5" />
                          )}
                          Accept client
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setDeclineTarget(req)}
                          disabled={actingId === req.id}
                          className="h-9 rounded-xl border-primary/25 text-primary hover:bg-primary/5 hover:text-primary"
                        >
                          <X className="mr-1.5 size-3.5" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <AlertDialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <AlertDialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this request?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {declineTarget?.client?.name} will be notified and can choose another consultant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => declineTarget && handleDecline(declineTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Decline request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
