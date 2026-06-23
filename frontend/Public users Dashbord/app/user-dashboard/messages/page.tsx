"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Lock, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";
import { useClientJourney } from "@/context/client-journey-context";
import { canAccessClientMessages, caseManagementUnlocked } from "@/lib/client-journey";
import { ClientJourneyBreadcrumb } from "@/components/client-workspace-ui";

type CaseMessage = {
  id: number;
  sender_name: string;
  sender_type: "client" | "consultant";
  message: string;
  read_at: string | null;
  created_at: string;
};

export default function ClientMessagesPage() {
  const { caseFile, verification, loading: journeyLoading } = useClientJourney();
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const canRead = canAccessClientMessages(caseFile);
  const canSend = caseManagementUnlocked(caseFile, verification);

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${CLIENT_API}/client/messages`, { headers: clientAuthHeaders(false) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not load messages.");
      setMessages(json.messages ?? []);
      await fetch(`${CLIENT_API}/client/messages/mark-read`, {
        method: "PATCH",
        headers: clientAuthHeaders(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    if (!journeyLoading) load();
  }, [journeyLoading, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!draft.trim() || !canSend) return;
    setSending(true);
    try {
      const res = await fetch(`${CLIENT_API}/client/messages`, {
        method: "POST",
        headers: clientAuthHeaders(),
        body: JSON.stringify({ message: draft.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not send.");
      setMessages((prev) => [...prev, json.message]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  if (journeyLoading || loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center space-y-4">
        <Lock className="mx-auto size-10 text-muted-foreground/50" />
        <h1 className="text-xl font-bold">Messages locked</h1>
        <p className="text-sm text-muted-foreground">
          You can message your consultant after signing your retainer agreement.
        </p>
        <Button asChild>
          <Link href="/user-dashboard">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-4 overflow-x-hidden pb-10 sm:space-y-6">
      <ClientJourneyBreadcrumb pageLabel="Messages" />
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <MessageSquare className="size-6" />
          Messages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with your consultant about your case.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex min-h-[360px] flex-col rounded-xl border bg-card">
        <div className="max-h-[min(60vh,400px)] flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
          {messages.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.sender_type === "client" ? "justify-end" : "justify-start")}
              >
                <div className="max-w-[85%]">
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                  {msg.sender_name}
                </p>
                <div
                  className={
                    msg.sender_type === "client"
                      ? "inline-block rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground text-left break-words"
                      : "inline-block rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm text-left break-words"
                  }
                >
                  {msg.message}
                </div>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t p-3">
          {canSend ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              You can read messages now. Replying unlocks after your case documents hub opens.
            </p>
          )}
        </div>
      </div>

      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/user-dashboard">← Back to home</Link>
      </Button>
    </div>
  );
}
