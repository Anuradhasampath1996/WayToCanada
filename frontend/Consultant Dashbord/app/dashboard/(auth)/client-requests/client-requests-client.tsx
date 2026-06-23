"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const TOKEN_KEY = "wtc_consultant_token";
const COOKIE_NAME = "wtc_consultant_token";

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
    load();
  }, [load]);

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
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-8 sm:space-y-6">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-primary/5 p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <UserPlus className="size-6 shrink-0 text-primary sm:h-6 sm:w-6" />
              Client requests
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Applicants from the public site who chose you as their consultant.
            </p>
          </div>
          <Button variant="outline" size="icon" className="size-9 shrink-0" onClick={load} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive break-words sm:px-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            No pending client requests right now.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {requests.map((req) => {
            const client = req.client;
            const highlighted = highlightId === String(req.id);
            return (
              <Card
                key={req.id}
                className={highlighted ? "border-primary ring-2 ring-primary/20" : undefined}
              >
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold break-words sm:text-lg">{client?.name ?? "Unknown client"}</h3>
                        <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-900">
                          Pending
                        </Badge>
                      </div>
                      {client?.email && (
                        <a href={`mailto:${client.email}`} className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground break-all hover:text-foreground">
                          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0">{client.email}</span>
                        </a>
                      )}
                      {client?.phone && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground break-all">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {client.phone}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {req.created_at ? new Date(req.created_at).toLocaleDateString() : ""}
                    </p>
                  </div>

                  {req.message && (
                    <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm leading-relaxed break-words sm:px-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</p>
                      {req.message}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      onClick={() => handleAccept(req.id)}
                      disabled={actingId === req.id}
                      className="h-10 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
                    >
                      {actingId === req.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Accept client
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDeclineTarget(req)}
                      disabled={actingId === req.id}
                      className="h-10 w-full sm:w-auto"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
