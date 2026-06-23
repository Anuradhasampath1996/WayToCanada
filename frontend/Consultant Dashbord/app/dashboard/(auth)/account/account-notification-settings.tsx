"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

type Prefs = {
  in_app_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_phone: string | null;
};

export function AccountNotificationSettings() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notification-preferences`, { headers: authHeaders() });
      const data: Prefs = await res.json();
      setPrefs(data);
      setPhone(data.whatsapp_phone ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(updates: Partial<Prefs>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/notification-preferences`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ ...updates, whatsapp_phone: phone || null }),
      });
      const data = await res.json();
      setPrefs(data);
      setMessage("Notification preferences saved.");
    } catch {
      setMessage("Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !prefs) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Choose how you receive updates about client workspace activity, meetings, and payments.
      </p>
      {message && (
        <p className={cn("break-words rounded-lg px-3 py-2 text-sm", message.includes("Could") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
          {message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border bg-muted/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4 shrink-0 text-emerald-600" /> In-app
            </div>
            <Switch
              checked={prefs.in_app_enabled}
              onCheckedChange={(v) => { setPrefs({ ...prefs, in_app_enabled: v }); save({ in_app_enabled: v }); }}
              disabled={saving}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Bell icon alerts in your dashboard header.</p>
        </div>
        <div className="space-y-3 rounded-xl border bg-muted/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <Mail className="h-4 w-4 shrink-0 text-blue-600" /> Email
            </div>
            <Switch
              checked={prefs.email_enabled}
              onCheckedChange={(v) => { setPrefs({ ...prefs, email_enabled: v }); save({ email_enabled: v }); }}
              disabled={saving}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Transactional emails for important updates.</p>
        </div>
        <div className="space-y-3 rounded-xl border bg-muted/15 p-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <MessageCircle className="h-4 w-4 shrink-0 text-green-600" /> WhatsApp
            </div>
            <Switch
              checked={prefs.whatsapp_enabled}
              onCheckedChange={(v) => { setPrefs({ ...prefs, whatsapp_enabled: v }); save({ whatsapp_enabled: v }); }}
              disabled={saving}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Client reminders and workspace alerts on WhatsApp. Turn off here if you prefer email only.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/15 p-4 sm:p-5">
        <Label htmlFor="wa-phone" className="text-sm font-semibold">WhatsApp phone number</Label>
        <p className="text-xs text-muted-foreground">Include country code, e.g. +14165551234</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="wa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." className="h-10" />
          <Button size="sm" className="h-10 w-full shrink-0 sm:w-auto" onClick={() => save({ whatsapp_enabled: prefs.whatsapp_enabled })} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
