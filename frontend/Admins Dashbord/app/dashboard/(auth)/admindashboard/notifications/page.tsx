"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell, Loader2, Mail, MessageCircle, Megaphone, Send, Users, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type Consultant = { id: number; name: string; email: string };
type Broadcast = {
  id: number;
  title: string;
  body: string;
  channels: string[];
  target_type: string;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
};

export default function AdminNotificationsPage() {
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    action_url: "",
    target_type: "all_consultants" as "all_consultants" | "selected",
    channels: { in_app: true, email: true, whatsapp: false },
    selectedIds: [] as number[],
  });

  const load = useCallback(async () => {
    try {
      const [histRes, usersRes] = await Promise.all([
        fetch(`${API}/admin/notifications/broadcasts`, { headers: adminAuthHeaders() }),
        fetch(`${API}/admin/users?role=rcic&per_page=100`, { headers: adminAuthHeaders() }),
      ]);
      const histData = await histRes.json();
      const usersData = await usersRes.json();
      setHistory(histData.data ?? []);
      setConsultants(
        (usersData.data ?? []).map((u: { id: number; name: string; email: string }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleConsultant(id: number) {
    setForm((f) => ({
      ...f,
      selectedIds: f.selectedIds.includes(id)
        ? f.selectedIds.filter((x) => x !== id)
        : [...f.selectedIds, id],
    }));
  }

  async function sendBroadcast() {
    if (!form.title.trim() || !form.body.trim()) return;
    const channels = (["in_app", "email", "whatsapp"] as const).filter((c) => form.channels[c]);
    if (channels.length === 0) {
      setMessage("Select at least one channel.");
      return;
    }
    if (form.target_type === "selected" && form.selectedIds.length === 0) {
      setMessage("Select at least one consultant.");
      return;
    }

    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/notifications/broadcasts`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          action_url: form.action_url || null,
          channels,
          target_type: form.target_type,
          target_user_ids: form.target_type === "selected" ? form.selectedIds : null,
          send_now: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Send failed");
      setMessage(`Broadcast sent to ${data.recipient_count ?? 0} consultant(s).`);
      setForm({ title: "", body: "", action_url: "", target_type: "all_consultants", channels: { in_app: true, email: true, whatsapp: false }, selectedIds: [] });
      await load();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-emerald-600" />
          Consultant notifications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send platform announcements to immigration consultants via in-app, email, or WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New broadcast</CardTitle>
          <CardDescription>Delivered immediately to selected consultants.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. IRCC form update" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} placeholder="Write your announcement…" />
          </div>
          <div className="space-y-2">
            <Label>Link (optional)</Label>
            <Input value={form.action_url} onChange={(e) => setForm({ ...form, action_url: e.target.value })} placeholder="https://…" />
          </div>

          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-4">
              {([
                { key: "in_app" as const, label: "In-app", icon: Bell },
                { key: "email" as const, label: "Email", icon: Mail },
                { key: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
              ]).map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.channels[key]}
                    onCheckedChange={(v) => setForm({ ...form, channels: { ...form.channels, [key]: !!v } })}
                  />
                  <Icon className="h-4 w-4" /> {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={form.target_type} onValueChange={(v: "all_consultants" | "selected") => setForm({ ...form, target_type: v })}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_consultants">All consultants</SelectItem>
                <SelectItem value="selected">Selected consultants</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.target_type === "selected" && (
            <div className="rounded-lg border max-h-48 overflow-y-auto p-3 space-y-2">
              {consultants.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={form.selectedIds.includes(c.id)} onCheckedChange={() => toggleConsultant(c.id)} />
                  <span>{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.email}</span>
                </label>
              ))}
            </div>
          )}

          {message && (
            <p className={cn("text-sm rounded-lg px-3 py-2", message.includes("failed") || message.includes("Select") ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50")}>
              {message}
            </p>
          )}

          <Button onClick={sendBroadcast} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send broadcast
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Broadcast history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(b.channels ?? []).map((c) => (
                          <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{b.recipient_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.sent_at ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          {new Date(b.sent_at).toLocaleString("en-CA")}
                        </span>
                      ) : "Draft"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
