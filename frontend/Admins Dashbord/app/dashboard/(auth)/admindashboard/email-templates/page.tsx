"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Mail, MessageCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type EmailTemplate = {
  key: string;
  name: string;
  description: string;
  kind: "notification" | "transactional";
  audience: "admin" | "consultant" | "client";
  category: string;
  channels: string[];
  subject_example: string;
  notification_type: string | null;
  variables: { name: string; description: string }[];
};

type Stats = {
  total: number;
  notification: number;
  transactional: number;
  admin: number;
  consultant: number;
  client: number;
};

type PreviewBundle = {
  email_html: string;
  whatsapp_text: string | null;
  has_whatsapp: boolean;
};

function audienceBadge(audience: string) {
  const map: Record<string, string> = {
    admin: "bg-violet-100 text-violet-800",
    consultant: "bg-emerald-100 text-emerald-800",
    client: "bg-sky-100 text-sky-800",
  };
  return map[audience] ?? "bg-muted text-muted-foreground";
}

export default function EmailTemplatesPage() {
  const [rows, setRows] = useState<EmailTemplate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewWhatsApp, setPreviewWhatsApp] = useState<string | null>(null);
  const [previewHasWhatsApp, setPreviewHasWhatsApp] = useState(false);
  const [previewTab, setPreviewTab] = useState<"email" | "whatsapp">("email");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/email-templates`, { headers: adminAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load email templates.");
      setRows(json.data ?? []);
      setStats(json.stats ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (audienceFilter !== "all" && row.audience !== audienceFilter) return false;
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.subject_example.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q)
      );
    });
  }, [rows, search, audienceFilter, kindFilter]);

  async function openPreview(template: EmailTemplate) {
    setSelected(template);
    setPreviewKey(template.key);
    setPreviewTab("email");
    setPreviewLoading(true);
    setPreviewHtml("");
    setPreviewWhatsApp(null);
    setPreviewHasWhatsApp(false);
    try {
      const res = await fetch(`${API}/admin/email-templates/${encodeURIComponent(template.key)}/preview-bundle`, {
        headers: adminAuthHeaders(),
      });
      const json: PreviewBundle = await res.json();
      if (!res.ok) throw new Error("Preview failed.");
      setPreviewHtml(json.email_html ?? "");
      setPreviewWhatsApp(json.whatsapp_text);
      setPreviewHasWhatsApp(Boolean(json.has_whatsapp));
    } catch {
      setPreviewHtml("<p style='padding:24px;font-family:sans-serif;color:#b91c1c;'>Could not load preview.</p>");
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-emerald-700" />
          <h1 className="text-2xl font-semibold">Email Templates</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          System emails and WhatsApp alerts sent to admins, consultants, and clients. Preview both channels before delivery.
        </p>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border px-3 py-2"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-semibold">{stats.total}</p></div>
          <div className="rounded-xl border px-3 py-2"><p className="text-xs text-muted-foreground">Notifications</p><p className="text-lg font-semibold">{stats.notification}</p></div>
          <div className="rounded-xl border px-3 py-2"><p className="text-xs text-muted-foreground">Transactional</p><p className="text-lg font-semibold">{stats.transactional}</p></div>
          <div className="rounded-xl border px-3 py-2"><p className="text-xs text-muted-foreground">Admin</p><p className="text-lg font-semibold">{stats.admin}</p></div>
          <div className="rounded-xl border px-3 py-2"><p className="text-xs text-muted-foreground">Consultant</p><p className="text-lg font-semibold">{stats.consultant}</p></div>
          <div className="rounded-xl border px-3 py-2"><p className="text-xs text-muted-foreground">Client</p><p className="text-lg font-semibold">{stats.client}</p></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={audienceFilter} onValueChange={setAudienceFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Audience" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All audiences</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="consultant">Consultant</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="notification">Notification</SelectItem>
            <SelectItem value="transactional">Transactional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading templates…</div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject example</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead className="text-right">Preview</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No templates match your filters.</TableCell></TableRow>
              ) : filtered.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-md">{row.description}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize font-normal border-0 ${audienceBadge(row.audience)}`}>
                      {row.audience}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{row.category.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{row.subject_example}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.channels.map((ch) => (
                        <Badge key={ch} variant="secondary" className="text-[10px] font-normal capitalize">{ch.replace(/_/g, " ")}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => void openPreview(row)}>
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!previewKey} onOpenChange={(open) => { if (!open) { setPreviewKey(null); setSelected(null); setPreviewTab("email"); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Template preview"}</DialogTitle>
            {selected && (
              <p className="text-sm text-muted-foreground">{selected.description}</p>
            )}
          </DialogHeader>
          {selected && (
            <div className="text-xs text-muted-foreground space-y-1 shrink-0">
              <p><strong>Subject:</strong> {selected.subject_example}</p>
              <p><strong>Variables:</strong> {selected.variables.map((v) => v.name).join(", ")}</p>
            </div>
          )}
          {previewLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading preview…
            </div>
          ) : (
            <Tabs
              value={previewHasWhatsApp ? previewTab : "email"}
              onValueChange={(v) => setPreviewTab(v as "email" | "whatsapp")}
              className="flex-1 min-h-0 flex flex-col"
            >
              <TabsList className="w-fit shrink-0">
                <TabsTrigger value="email" className="gap-1.5">
                  <Mail className="h-4 w-4" /> Email
                </TabsTrigger>
                {previewHasWhatsApp && (
                  <TabsTrigger value="whatsapp" className="gap-1.5">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="email" className="flex-1 min-h-0 mt-3">
                <div className="h-full min-h-[520px] rounded-lg border bg-white overflow-auto">
                  <iframe
                    title="Email preview"
                    srcDoc={previewHtml}
                    className="w-full min-h-[520px] border-0"
                    sandbox=""
                  />
                </div>
              </TabsContent>

              {previewHasWhatsApp && (
                <TabsContent value="whatsapp" className="flex-1 min-h-0 mt-3">
                  <div className="h-full min-h-[520px] rounded-lg border overflow-hidden bg-[#e5ddd5]">
                    <div className="bg-[#075e54] text-white px-4 py-3 text-sm font-medium flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp preview
                    </div>
                    <div className="p-4 min-h-[480px]">
                      <div className="max-w-md ml-auto">
                        <div className="rounded-lg rounded-tr-none bg-[#dcf8c6] shadow-sm px-3 py-2 text-sm text-[#111b21] whitespace-pre-wrap break-words leading-relaxed">
                          {previewWhatsApp}
                        </div>
                        <p className="text-[10px] text-[#667781] text-right mt-1 pr-1">
                          Sample preview · do not reply
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
