"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bug, ChevronLeft, Headphones, Lightbulb, Loader2, MessageSquare, RefreshCw, Route, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type TicketSummary = {
  id: number;
  category: string;
  subject: string;
  body: string;
  status: string;
  unread_admin_messages_count: number;
  last_reply_at: string | null;
  created_at: string;
};

type TicketMessage = {
  id: number;
  body: string;
  sender_role: string;
  is_mine: boolean;
  created_at: string;
  author: { id: number; name: string };
};

const CATEGORIES = [
  { value: "bug", label: "Bug / Error", icon: Bug },
  { value: "wrong_flow", label: "Wrong flow / Issue", icon: Route },
  { value: "feature_request", label: "New feature request", icon: Lightbulb },
  { value: "other", label: "Other", icon: MessageSquare },
] as const;

function authHeaders(json = true): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

async function parseApiError(res: Response, fallback: string) {
  try {
    const json = await res.json();
    return (json?.message as string) ?? fallback;
  } catch {
    return fallback;
  }
}

export function SupportTicketWidget() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [category, setCategory] = useState<string>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");

  const loadUnread = useCallback(async () => {
    try {
      const res = await fetch(`${API}/consultant/support-tickets/unread-count`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.count ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/support-tickets?per_page=30`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to load requests."));
      const json = await res.json();
      setTickets(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTicketDetail = useCallback(async (ticketId: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/support-tickets/${ticketId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to load request."));
      const json = await res.json();
      setSelectedTicket(json.data?.ticket ?? null);
      setMessages(json.data?.messages ?? []);
      setSelectedId(ticketId);
      setView("detail");
      await loadUnread();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load request.");
    } finally {
      setLoading(false);
    }
  }, [loadUnread]);

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, [loadUnread]);

  useEffect(() => {
    const support = searchParams.get("support");
    if (support && support !== "0") {
      const id = parseInt(support, 10);
      if (!Number.isNaN(id) && id > 0) {
        setOpen(true);
        loadTicketDetail(id);
      } else if (support === "1") {
        setOpen(true);
        setView("list");
      }
    }
  }, [searchParams, loadTicketDetail]);

  useEffect(() => {
    if (open && view === "list") {
      loadTickets();
    }
  }, [open, view, loadTickets]);

  function resetForm() {
    setCategory("bug");
    setSubject("");
    setBody("");
    setReplyBody("");
    setError("");
    setSuccess("");
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError("Subject and description are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API}/consultant/support-tickets`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ category, subject: subject.trim(), body: body.trim() }),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to submit request."));
      const json = await res.json();
      setSuccess("Your request was sent to our support team.");
      resetForm();
      if (json.data?.id) {
        await loadTicketDetail(json.data.id);
      } else {
        setView("list");
        await loadTickets();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !replyBody.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/consultant/support-tickets/${selectedId}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to send reply."));
      const json = await res.json();
      setMessages((prev) => [...prev, json.data]);
      setReplyBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reply.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setView("list");
      setSelectedId(null);
      setSelectedTicket(null);
      setMessages([]);
      resetForm();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setView("list");
        }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3",
          "bg-primary text-primary-foreground shadow-lg shadow-primary/25",
          "transition-transform hover:scale-105 hover:shadow-xl",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
        aria-label="Support and feedback"
      >
        <Headphones className="h-5 w-5" />
        <span className="text-sm font-semibold">Support</span>
        {unreadCount > 0 && (
          <Badge className="ml-1 h-5 min-w-5 rounded-full bg-red-600 px-1.5 text-[10px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              {view === "detail" && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={() => { setView("list"); setSelectedId(null); loadTickets(); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Headphones className="h-5 w-5 text-primary" />
              {view === "new" ? "Report an issue" : view === "detail" ? "Support request" : "Support & feedback"}
            </DialogTitle>
            <DialogDescription>
              Report bugs, wrong flows, or request new features. Our team will reply here.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                {success}
              </div>
            )}

            {view === "list" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => { setView("new"); resetForm(); }}>
                    New request
                  </Button>
                  <Button variant="outline" size="icon" onClick={loadTickets} disabled={loading}>
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </div>

                {loading && tickets.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tickets.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No support requests yet. Tap &quot;New request&quot; to report a bug or ask for a feature.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => loadTicketDetail(t.id)}
                        className="w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{t.subject}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {categoryLabel(t.category)} · {fmtDate(t.created_at)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge variant={t.status === "open" ? "default" : "secondary"} className="text-[10px]">
                              {t.status === "open" ? "Open" : "Closed"}
                            </Badge>
                            {t.unread_admin_messages_count > 0 && (
                              <Badge className="bg-red-600 text-[10px] text-white">
                                {t.unread_admin_messages_count} new
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === "new" && (
              <form onSubmit={submitNew} className="space-y-4">
                <div className="space-y-2">
                  <Label>Type of request</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-subject">Subject</Label>
                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary of the issue"
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-body">Description</Label>
                  <Textarea
                    id="support-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Describe the bug, wrong flow, or feature you need..."
                    rows={6}
                    maxLength={10000}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setView("list")}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit
                  </Button>
                </div>
              </form>
            )}

            {view === "detail" && selectedTicket && (
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selectedTicket.status === "open" ? "default" : "secondary"}>
                      {selectedTicket.status === "open" ? "Open" : "Closed"}
                    </Badge>
                    <Badge variant="outline">{categoryLabel(selectedTicket.category)}</Badge>
                  </div>
                  <h3 className="mt-2 font-semibold">{selectedTicket.subject}</h3>
                </div>

                <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border p-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm",
                        m.sender_role === "admin"
                          ? "ml-4 bg-primary/10 border border-primary/20"
                          : "mr-4 bg-muted",
                      )}
                    >
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {m.sender_role === "admin" ? "Support team" : "You"} · {fmtDate(m.created_at)}
                      </p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>

                {selectedTicket.status === "open" ? (
                  <form onSubmit={submitReply} className="space-y-2">
                    <Label htmlFor="support-reply">Add a follow-up</Label>
                    <Textarea
                      id="support-reply"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Add more details..."
                      rows={3}
                    />
                    <Button type="submit" className="w-full" disabled={submitting || !replyBody.trim()}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reply"}
                    </Button>
                  </form>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    This request is closed. Open a new request if you need more help.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
