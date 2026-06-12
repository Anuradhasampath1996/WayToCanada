"use client";

import { useCallback, useEffect, useState } from "react";
import { Video, Loader2, CheckCircle2, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: "application/json",
  };
}

type MeetingAccount = {
  preferred_provider: "google_meet" | "zoom" | "teams";
  google_meet_ready: boolean;
  zoom_ready: boolean;
  teams_ready: boolean;
  google_connected: boolean;
  zoom_connected: boolean;
  teams_connected: boolean;
  google_account_email: string | null;
  zoom_account_email: string | null;
  teams_account_email: string | null;
  google_configured: boolean;
  zoom_configured: boolean;
  teams_configured: boolean;
};

const PROVIDERS = [
  {
    id: "google_meet" as const,
    connectKey: "google" as const,
    label: "Google Meet",
    hint: "Connect your Google account. We create a Calendar event with a unique Meet link for each client meeting.",
    color: "text-green-600",
    ring: "ring-green-500/30 border-green-200/50",
    btn: "bg-green-600 hover:bg-green-700",
  },
  {
    id: "zoom" as const,
    connectKey: "zoom" as const,
    label: "Zoom",
    hint: "Connect your Zoom account. Scheduled meetings appear in your Zoom dashboard with join links for clients.",
    color: "text-blue-600",
    ring: "ring-blue-500/30 border-blue-200/50",
    btn: "bg-blue-600 hover:bg-blue-700",
  },
  {
    id: "teams" as const,
    connectKey: "teams" as const,
    label: "Microsoft Teams",
    hint: "Connect your Microsoft work or school account. Online meetings are created via Teams with calendar invites.",
    color: "text-violet-600",
    ring: "ring-violet-500/30 border-violet-200/50",
    btn: "bg-violet-600 hover:bg-violet-700",
  },
];

export function AccountMeetingSettings({
  onOAuthReturn,
  oauthProvider,
  oauthStatus,
  oauthMessage,
}: {
  onOAuthReturn?: boolean;
  oauthProvider?: string | null;
  oauthStatus?: string | null;
  oauthMessage?: string | null;
}) {
  const [account, setAccount] = useState<MeetingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<"google_meet" | "zoom" | "teams">("google_meet");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/consultant/meeting-account`, { headers: authHeaders() });
      const data: MeetingAccount = await res.json();
      setAccount(data);
      setPreferred(data.preferred_provider ?? "google_meet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!onOAuthReturn) return;
    (async () => {
      await load();
      if (oauthStatus === "success") {
        const label = PROVIDERS.find((p) => p.connectKey === oauthProvider)?.label ?? "Account";
        setMessage(`${label} connected successfully.`);
      } else if (oauthStatus === "error") {
        setMessage(oauthMessage ?? "Connection failed. Please try again.");
      }
    })();
  }, [onOAuthReturn, oauthProvider, oauthStatus, oauthMessage, load]);

  async function savePreferred(next: "google_meet" | "zoom" | "teams") {
    setPreferred(next);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/meeting-account`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ preferred_provider: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Save failed");
      setAccount(data);
      setMessage("Default platform updated.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function connect(connectKey: "google" | "zoom" | "teams") {
    setConnecting(connectKey);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/meeting-account/${connectKey}/connect`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.message ?? "Could not start connection.");
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(connectKey: "google" | "zoom" | "teams") {
    setDisconnecting(connectKey);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/meeting-account/${connectKey}/disconnect`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Disconnect failed");
      setAccount(data);
      setMessage("Account disconnected.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setDisconnecting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const connectedMap = {
    google_meet: account?.google_connected,
    zoom: account?.zoom_connected,
    teams: account?.teams_connected,
  };
  const readyMap = {
    google_meet: account?.google_meet_ready,
    zoom: account?.zoom_ready,
    teams: account?.teams_ready,
  };
  const emailMap = {
    google_meet: account?.google_account_email,
    zoom: account?.zoom_account_email,
    teams: account?.teams_account_email,
  };
  const configuredMap = {
    google_meet: account?.google_configured,
    zoom: account?.zoom_configured,
    teams: account?.teams_configured,
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Link your Google, Zoom, or Microsoft account once. When you schedule a client meeting, we create a real video call on that platform and email a professional invite with the join link.
      </p>

      {message && (
        <p className={cn(
          "text-sm rounded-lg px-3 py-2",
          message.includes("failed") || message.includes("Could not") || message.includes("not configured")
            ? "text-red-700 bg-red-50 dark:bg-red-950/30"
            : "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
        )}>
          {message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROVIDERS.map((p) => {
          const connected = connectedMap[p.id];
          const ready = readyMap[p.id];
          const configured = configuredMap[p.id];

          return (
            <div
              key={p.id}
              className={cn(
                "rounded-xl border bg-muted/15 p-4 space-y-3 flex flex-col",
                preferred === p.id && `ring-2 ${p.ring}`,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Video className={cn("h-4 w-4", p.color)} />
                  {p.label}
                </div>
                {ready
                  ? <Badge className="bg-emerald-600 gap-1 text-[10px] shrink-0"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>
                  : <Badge variant="secondary" className="text-[10px] shrink-0">Not connected</Badge>}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">{p.hint}</p>

              {connected && emailMap[p.id] && (
                <p className="text-xs font-medium truncate" title={emailMap[p.id] ?? undefined}>
                  {emailMap[p.id]}
                </p>
              )}

              <div className="pt-1">
                {connected ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full h-9 text-xs"
                    disabled={disconnecting === p.connectKey}
                    onClick={() => disconnect(p.connectKey)}
                  >
                    {disconnecting === p.connectKey
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      : <Unlink className="h-3.5 w-3.5 mr-1" />}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className={cn("w-full h-9 text-xs text-white", p.btn)}
                    disabled={!configured || connecting === p.connectKey}
                    onClick={() => connect(p.connectKey)}
                  >
                    {connecting === p.connectKey
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      : <Link2 className="h-3.5 w-3.5 mr-1" />}
                    {!configured ? "Not configured on server" : `Connect ${p.label}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-muted/15 p-5 space-y-3">
        <p className="text-sm font-semibold">Default platform for new meetings</p>
        <p className="text-xs text-muted-foreground">Only connected platforms can be selected.</p>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={preferred === p.id ? "default" : "outline"}
              disabled={!readyMap[p.id] || saving}
              onClick={() => savePreferred(p.id)}
              className={preferred === p.id ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {saving && preferred === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {p.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
