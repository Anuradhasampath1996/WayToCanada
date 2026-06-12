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
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Choose how you receive updates about client workspace activity, meetings, and payments.
      </p>
      {message && (
        <p className={cn("text-sm rounded-lg px-3 py-2", message.includes("Could") ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50")}>
          {message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-muted/15 p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Bell className="h-4 w-4 text-emerald-600" /> In-app
          </div>
          <p className="text-xs text-muted-foreground">Bell icon alerts in your dashboard header.</p>
          <Switch
            checked={prefs.in_app_enabled}
            onCheckedChange={(v) => { setPrefs({ ...prefs, in_app_enabled: v }); save({ in_app_enabled: v }); }}
            disabled={saving}
          />
        </div>
        <div className="rounded-xl border bg-muted/15 p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Mail className="h-4 w-4 text-blue-600" /> Email
          </div>
          <p className="text-xs text-muted-foreground">Transactional emails for important updates.</p>
          <Switch
            checked={prefs.email_enabled}
            onCheckedChange={(v) => { setPrefs({ ...prefs, email_enabled: v }); save({ email_enabled: v }); }}
            disabled={saving}
          />
        </div>
        <div className="rounded-xl border bg-muted/15 p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
          </div>
          <p className="text-xs text-muted-foreground">High-priority reminders via WhatsApp (Twilio).</p>
          <Switch
            checked={prefs.whatsapp_enabled}
            onCheckedChange={(v) => { setPrefs({ ...prefs, whatsapp_enabled: v }); save({ whatsapp_enabled: v }); }}
            disabled={saving}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-muted/15 p-5 space-y-3 max-w-md">
        <Label htmlFor="wa-phone" className="text-sm font-semibold">WhatsApp phone number</Label>
        <p className="text-xs text-muted-foreground">Include country code, e.g. +14165551234</p>
        <div className="flex gap-2">
          <Input id="wa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." className="h-9" />
          <Button size="sm" onClick={() => save({ whatsapp_enabled: prefs.whatsapp_enabled })} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
