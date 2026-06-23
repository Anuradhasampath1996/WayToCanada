"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Video, Loader2, Plus, Copy, CheckCircle2, XCircle, ExternalLink, Calendar, AlertCircle, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ScheduleMeetingDialog } from "./schedule-meeting-dialog";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type ClientMeeting = {
  id: number;
  title: string;
  description: string | null;
  scheduled_at: string;
  scheduled_local: string;
  duration_minutes: number;
  timezone: string;
  provider: string;
  meeting_url: string;
  invite_url: string;
  status: string;
  sent_at: string | null;
};

type MeetingAccount = {
  preferred_provider: "google_meet" | "zoom" | "teams";
  google_meet_ready: boolean;
  zoom_ready: boolean;
  teams_ready: boolean;
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
};

export function ClientMeetingsPanel({
  clientId,
  embedded = false,
}: {
  clientId: number;
  embedded?: boolean;
}) {
  const [meetings, setMeetings] = useState<ClientMeeting[]>([]);
  const [account, setAccount] = useState<MeetingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [meetingsRes, accountRes] = await Promise.all([
      fetch(`${API}/consultant/clients/${clientId}/meetings`, { headers: authHeaders() }),
      fetch(`${API}/consultant/meeting-account`, { headers: authHeaders() }),
    ]);
    const meetingsData = await meetingsRes.json();
    const accountData: MeetingAccount = await accountRes.json();
    setMeetings(meetingsData.data ?? []);
    setAccount(accountData);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const readyProviders = account
    ? (["google_meet", "zoom", "teams"] as const).filter((p) => {
        if (p === "google_meet") return account.google_meet_ready;
        if (p === "zoom") return account.zoom_ready;
        return account.teams_ready;
      })
    : [];

  const anyReady = readyProviders.length > 0;

  async function copyLink(url: string, id: number) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function resendInvite(meetingId: number) {
    setResendingId(meetingId);
    setActionMsg(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${clientId}/meetings/${meetingId}/resend`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to resend invite.");
      setActionMsg(json.message ?? "Meeting invite sent.");
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Failed to resend invite.");
    } finally {
      setResendingId(null);
      setTimeout(() => setActionMsg(null), 3500);
    }
  }

  const scheduleButton = (
    <Button
      size="sm"
      className="bg-blue-600 hover:bg-blue-700 shrink-0 h-8"
      onClick={() => setOpen(true)}
      disabled={!anyReady}
    >
      <Plus className="h-3.5 w-3.5 mr-1" /> Schedule
    </Button>
  );

  const list = (
    <>
        {actionMsg && (
          <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            {actionMsg}
          </p>
        )}
        {!loading && !anyReady && (
          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200/60">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Connect Google Meet, Zoom, or Teams in{" "}
              <Link href="/dashboard/account#meetings" className="font-medium underline">Account settings</Link>
              {" "}before scheduling.
            </p>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </div>
        )}
        {!loading && meetings.length === 0 && anyReady && (
          <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
            No meetings scheduled yet.
          </p>
        )}
        {(embedded ? meetings : meetings.slice(0, 4)).map((m) => (
          <div key={m.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium line-clamp-1">{m.title}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3" />
                  {fmtWhen(m.scheduled_local || m.scheduled_at)}
                  {m.provider && (
                    <span className="ml-1">· {PROVIDER_LABELS[m.provider] ?? m.provider}</span>
                  )}
                </p>
              </div>
              <Badge
                variant={m.status === "scheduled" ? "default" : "secondary"}
                className={cn("text-[10px] shrink-0", m.status === "scheduled" && "bg-blue-600")}
              >
                {m.status}
              </Badge>
            </div>
            {m.status === "scheduled" && (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => copyLink(m.invite_url, m.id)}>
                  {copiedId === m.id ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" asChild>
                  <a href={m.meeting_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 px-2"
                  disabled={resendingId === m.id}
                  onClick={() => void resendInvite(m.id)}
                  title="Resend invite email"
                >
                  {resendingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 px-2" onClick={async () => {
                  await fetch(`${API}/consultant/clients/${clientId}/meetings/${m.id}/cancel`, { method: "POST", headers: authHeaders() });
                  load();
                }}>
                  <XCircle className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}
    </>
  );

  const dialog = (
    <ScheduleMeetingDialog
      open={open}
      onOpenChange={setOpen}
      clientId={clientId}
      account={account}
      onScheduled={load}
    />
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">{scheduleButton}</div>
        <div className="space-y-2">{list}</div>
        {dialog}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4 text-blue-600" />
            Video meetings
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            Schedule Google Meet, Zoom, or Teams calls — a join link is created on your connected account.
          </CardDescription>
        </div>
        {scheduleButton}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">{list}</CardContent>
      {dialog}
    </Card>
  );
}
