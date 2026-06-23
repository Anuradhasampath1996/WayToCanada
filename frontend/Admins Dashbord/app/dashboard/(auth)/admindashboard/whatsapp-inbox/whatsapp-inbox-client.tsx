"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, Clock, Loader2, MessageCircle, RefreshCw, Search, Send, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type ConversationRow = {
  id: number;
  wa_id: string;
  display_phone: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  session_open: boolean;
  session_expires_at: string | null;
  user: { id: number; name: string; email: string; role: string } | null;
};

type ChatMessage = {
  id: number;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  status: string;
  created_at: string;
  sent_by: { id: number; name: string; email: string } | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
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

type SetupStatus = {
  webhook_url: string;
  verify_token_configured: boolean;
  app_secret_configured: boolean;
  meta_api_configured: boolean;
  last_webhook_at: string | null;
  conversation_count: number;
  is_localhost: boolean;
};

export default function AdminWhatsAppInboxClient() {
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [active, setActive] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSetup = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/whatsapp/setup-status`, { headers: adminAuthHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      setSetup(json.data ?? null);
    } catch {
      // ignore
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ per_page: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (unreadOnly) params.set("unread_only", "1");
      const res = await fetch(`${API}/admin/whatsapp/conversations?${params}`, {
        headers: adminAuthHeaders(),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to load conversations."));
      const json = await res.json();
      setConversations(json.data ?? []);
      setTotalUnread(json.meta?.total_unread ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [search, unreadOnly]);

  const openConversation = useCallback(async (conversation: ConversationRow) => {
    setActive(conversation);
    setDetailLoading(true);
    setReplyBody("");
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/whatsapp/conversations/${conversation.id}`, {
        headers: adminAuthHeaders(),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to load messages."));
      const json = await res.json();
      setMessages(json.data?.messages ?? []);
      if (json.data?.conversation) {
        setActive(json.data.conversation);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversation.id ? { ...c, ...json.data.conversation, unread_count: 0 } : c)),
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load messages.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSetup();
    loadConversations();
  }, [loadSetup, loadConversations]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      openConversation(active);
      loadConversations();
    }, 12000);
    return () => clearInterval(timer);
  }, [active, openConversation, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, detailLoading]);

  async function sendReply() {
    if (!active || !replyBody.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/whatsapp/conversations/${active.id}/messages`, {
        method: "POST",
        headers: adminAuthHeaders(),
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      if (!res.ok) throw new Error(await parseApiError(res, "Failed to send message."));
      const json = await res.json();
      setMessages((prev) => [...prev, json.data]);
      setReplyBody("");
      setMessage("Message sent via WhatsApp.");
      await loadConversations();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to send message.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageCircle className="h-7 w-7 text-primary" />
          WhatsApp Inbox
        </h1>
        <p className="mt-1 text-muted-foreground">
          Send and receive WhatsApp messages through your Business API number. Normal WhatsApp app chat is not available on this number.
        </p>
      </div>

      {setup && (!setup.last_webhook_at || !setup.verify_token_configured || setup.is_localhost) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Incoming messages need a public webhook — localhost alone will not work
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {!setup.verify_token_configured && (
              <li>Admin → <strong>Integrations</strong> → Meta WhatsApp → set <strong>Webhook verify token</strong> and Save.</li>
            )}
            <li>Expose your API with <strong>ngrok</strong>: <code className="text-xs">ngrok http 8000</code></li>
            <li>Meta Developer → WhatsApp → Configuration → Callback URL:</li>
          </ul>
          <p className="mt-2 font-mono text-xs break-all rounded bg-white/70 px-2 py-1">
            https://YOUR-NGROK-URL.ngrok-free.app/api/v1/webhooks/whatsapp
          </p>
          <p className="mt-2 text-xs">
            Use the same verify token in Meta. Subscribe to the <strong>messages</strong> field. Then send a test message from your phone.
            {setup.last_webhook_at
              ? ` Last webhook received: ${fmtDate(setup.last_webhook_at)}`
              : " No webhook received yet."}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <Card className="h-[calc(100vh-220px)] min-h-[480px]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Conversations</CardTitle>
                <CardDescription>
                  {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
                </CardDescription>
              </div>
              <Button variant="outline" size="icon" onClick={loadConversations} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                variant={unreadOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setUnreadOnly((v) => !v)}
              >
                Unread only
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto px-3 pb-4" style={{ maxHeight: "calc(100% - 180px)" }}>
            {error && (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No conversations yet. Configure the webhook in Integrations, then ask someone to message your WhatsApp Business number.
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50",
                      active?.id === c.id && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {c.contact_name || c.user?.name || c.display_phone}
                        </span>
                        {c.unread_count > 0 && (
                          <Badge className="h-5 min-w-5 justify-center px-1 text-[10px]">{c.unread_count}</Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{c.display_phone}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {c.last_message_preview || "No messages"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(c.last_message_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col">
          {!active ? (
            <CardContent className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a conversation to view messages.
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base">
                  {active.contact_name || active.user?.name || active.display_phone}
                </CardTitle>
                <CardDescription className="space-y-1">
                  <span>{active.display_phone}</span>
                  {active.user && (
                    <span className="block">
                      Linked account: {active.user.name} ({active.user.role}) · {active.user.email}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-2 pt-1">
                    {active.session_open ? (
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                        <Clock className="mr-1 h-3 w-3" />
                        Reply window open until {fmtDate(active.session_expires_at)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-300 text-amber-800">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        24h window closed — free-text replies unavailable
                      </Badge>
                    )}
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
                {message && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                    {message}
                  </div>
                )}

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border p-3">
                  {detailLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No messages in this thread.</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                          m.direction === "outbound"
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "mr-auto bg-muted",
                        )}
                      >
                        <p className="mb-1 text-[11px] opacity-80">
                          {m.direction === "outbound"
                            ? `You${m.sent_by?.name ? ` (${m.sent_by.name})` : ""}`
                            : "Contact"}{" "}
                          · {fmtDate(m.created_at)}
                          {m.direction === "outbound" && m.status !== "sent" ? ` · ${m.status}` : ""}
                        </p>
                        <p className="whitespace-pre-wrap">{m.body ?? `[${m.message_type}]`}</p>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="wa-reply">Reply</Label>
                  <Textarea
                    id="wa-reply"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={
                      active.session_open
                        ? "Type a WhatsApp message..."
                        : "Ask the contact to message your number first to reopen the 24-hour window."
                    }
                    rows={3}
                    disabled={!active.session_open}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={sendReply}
                      disabled={submitting || !replyBody.trim() || !active.session_open}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send via WhatsApp
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
