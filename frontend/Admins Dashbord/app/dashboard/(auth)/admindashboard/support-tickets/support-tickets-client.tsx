"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bug, CheckCircle2, Headphones, Loader2, MessageSquare, RefreshCw, Route, Send, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type TicketRow = {
  id: number;
  category: string;
  subject: string;
  body: string;
  status: string;
  messages_count: number;
  created_at: string;
  last_reply_at: string | null;
  consultant: { id: number; name: string; email: string; rcic_number: string | null };
};

type TicketMessage = {
  id: number;
  body: string;
  sender_role: string;
  created_at: string;
  author: { id: number; name: string; email: string };
};

const CATEGORY_META: Record<string, { label: string; icon: typeof Bug }> = {
  bug: { label: "Bug", icon: Bug },
  wrong_flow: { label: "Wrong flow", icon: Route },
  feature_request: { label: "Feature", icon: Lightbulb },
  other: { label: "Other", icon: MessageSquare },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

async function parseApiError(res: Response, fallback: string) {
  try {
    const json = await res.json();
    return (json?.message as string) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function AdminSupportTicketsClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(() => {
    const s = searchParams.get("status");
    return s === "closed" || s === "all" ? s : "open";
  });
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeTicket, setActiveTicket] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status, per_page: "50" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${API}/admin/support-tickets?${params}`, {
        headers: adminAuthHeaders(),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to load tickets."));
      const json = await res.json();
      setTickets(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  const openTicket = useCallback(async (ticket: TicketRow) => {
    setActiveTicket(ticket);
    setDetailLoading(true);
    setReplyBody("");
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/support-tickets/${ticket.id}`, {
        headers: adminAuthHeaders(),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to load ticket."));
      const json = await res.json();
      setMessages(json.data?.messages ?? []);
      if (json.data?.ticket) {
        setActiveTicket((prev) => ({ ...prev!, ...json.data.ticket }));
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load ticket.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (ticketId && tickets.length > 0) {
      const found = tickets.find((t) => String(t.id) === ticketId);
      if (found) openTicket(found);
    }
  }, [searchParams, tickets, openTicket]);

  async function sendReply() {
    if (!activeTicket || !replyBody.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/support-tickets/${activeTicket.id}/messages`, {
        method: "POST",
        headers: adminAuthHeaders(),
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to send reply."));
      const json = await res.json();
      setMessages((prev) => [...prev, json.data]);
      setReplyBody("");
      setMessage("Reply sent to consultant.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to send reply.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(nextStatus: "open" | "closed") {
    if (!activeTicket) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/support-tickets/${activeTicket.id}`, {
        method: "PATCH",
        headers: adminAuthHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to update ticket."));
      const json = await res.json();
      setActiveTicket((prev) => (prev ? { ...prev, status: json.data?.status ?? nextStatus } : prev));
      setMessage(nextStatus === "closed" ? "Ticket marked as resolved." : "Ticket reopened.");
      await loadTickets();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to update ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Headphones className="h-7 w-7 text-primary" />
          Consultant Support
        </h1>
        <p className="mt-1 text-muted-foreground">
          Review bug reports, flow issues, and feature requests from consultants.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Support tickets</CardTitle>
              <CardDescription>Click a ticket to view the thread and reply.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={status} onValueChange={setStatus}>
                <TabsList>
                  <TabsTrigger value="open">Open</TabsTrigger>
                  <TabsTrigger value="closed">Closed</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="icon" onClick={loadTickets} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
          <Input
            placeholder="Search subject, consultant name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-3 max-w-md"
          />
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No support tickets found.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => {
                const meta = CATEGORY_META[t.category] ?? CATEGORY_META.other;
                const Icon = meta.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openTicket(t)}
                    className="flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.subject}</span>
                        <Badge variant={t.status === "open" ? "default" : "secondary"} className="text-[10px]">
                          {t.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t.consultant?.name} · {t.consultant?.email} · {fmtDate(t.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!activeTicket} onOpenChange={(o) => !o && setActiveTicket(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {activeTicket && (
            <>
              <DialogHeader className="border-b px-6 py-4">
                <DialogTitle>{activeTicket.subject}</DialogTitle>
                <DialogDescription>
                  {activeTicket.consultant?.name} · {activeTicket.consultant?.email}
                  {activeTicket.consultant?.rcic_number ? ` · RCIC ${activeTicket.consultant.rcic_number}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {message && (
                  <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                    {message}
                  </div>
                )}

                {detailLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border p-3">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm",
                          m.sender_role === "admin"
                            ? "ml-6 bg-primary/10 border border-primary/20"
                            : "mr-6 bg-muted",
                        )}
                      >
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          {m.sender_role === "admin" ? "You (Support)" : m.author?.name ?? "Consultant"} · {fmtDate(m.created_at)}
                        </p>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTicket.status === "open" && (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="admin-reply">Reply to consultant</Label>
                    <Textarea
                      id="admin-reply"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Type your response..."
                      rows={4}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 border-t px-6 py-4 sm:flex-row">
                {activeTicket.status === "open" ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => updateStatus("closed")}
                      disabled={submitting}
                      className="sm:mr-auto"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark resolved
                    </Button>
                    <Button onClick={sendReply} disabled={submitting || !replyBody.trim()}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send reply
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => updateStatus("open")} disabled={submitting}>
                    Reopen ticket
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
