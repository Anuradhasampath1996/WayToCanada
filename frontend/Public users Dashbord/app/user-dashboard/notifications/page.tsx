"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_token") ?? "";
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

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notification-preferences`, { headers: authHeaders() });
      if (!res.ok) return;
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
      setMessage("Preferences saved.");
    } catch {
      setMessage("Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notification settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control how we notify you about messages, meetings, payments, and case updates.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {prefs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery channels</CardTitle>
            <CardDescription>Changes apply immediately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {message && (
              <p className={cn("text-sm rounded-lg px-3 py-2", message.includes("Could") ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50")}>
                {message}
              </p>
            )}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-sm">In-app notifications</p>
                    <p className="text-xs text-muted-foreground">Header bell icon</p>
                  </div>
                </div>
                <Switch checked={prefs.in_app_enabled} onCheckedChange={(v) => { setPrefs({ ...prefs, in_app_enabled: v }); save({ in_app_enabled: v }); }} disabled={saving} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-sm">Email</p>
                    <p className="text-xs text-muted-foreground">Meeting invites, payments, messages</p>
                  </div>
                </div>
                <Switch checked={prefs.email_enabled} onCheckedChange={(v) => { setPrefs({ ...prefs, email_enabled: v }); save({ email_enabled: v }); }} disabled={saving} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      Updates from your consultant on WhatsApp. Enabled by default — turn off if you prefer email only.
                    </p>
                  </div>
                </div>
                <Switch checked={prefs.whatsapp_enabled} onCheckedChange={(v) => { setPrefs({ ...prefs, whatsapp_enabled: v }); save({ whatsapp_enabled: v }); }} disabled={saving} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp number</Label>
              <div className="flex gap-2">
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
                <Button onClick={() => save({})} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
