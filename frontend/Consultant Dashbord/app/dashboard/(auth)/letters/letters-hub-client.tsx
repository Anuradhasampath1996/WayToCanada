"use client";

import * as React from "react";
import {
  Copy,
  FileDown,
  FileText,
  Loader2,
  Mail,
  Clock,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  User,
  UserX,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditorDemo } from "@/components/ui/custom/tiptap/rich-text-editor";
import {
  LetterDocumentPreview,
  type ConsultantBranding,
} from "@/components/letters/letter-document-preview";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type LetterType = { slug: string; label: string };

type LetterTemplate = {
  id: number;
  name: string;
  letter_type: string;
  letter_type_label: string;
  subject_template: string | null;
  body_html: string | null;
  applies_to_client: boolean;
};

type LetterDraft = {
  id: number;
  title: string;
  letter_type: string;
  letter_type_label?: string;
  subject: string | null;
  body_html: string | null;
  status: string;
  client_profile_id: number | null;
  client_name?: string | null;
  updated_at?: string;
  generation_prompt?: string | null;
  template_id?: number | null;
};

type ClientRow = {
  id: number;
  user: { name: string; email: string };
  immigration_pathway: string | null;
};

type ClientContext = {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  immigration_pathway?: string;
  case_status?: string;
  pathway_assessment_crs_score?: number | null;
  questionnaire_prefill?: Record<string, string>;
  passport_number?: string;
};

function authHeaders(contentType?: string): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("wtc_consultant_token") ??
        document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
        ""
      : "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

function formatDraftDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000) return "Today";
  if (diff < 172_800_000) return "Yesterday";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function buildEditorSnapshot(input: {
  title: string;
  subject: string;
  bodyHtml: string;
  letterType: string;
  clientMode: "none" | "client";
  selectedClientId: number | null;
}): string {
  return JSON.stringify(input);
}

export function LettersHubClient({ initialClientId = null }: { initialClientId?: number | null }) {
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [openAiAvailable, setOpenAiAvailable] = React.useState(false);
  const [letterTypes, setLetterTypes] = React.useState<LetterType[]>([]);
  const [templates, setTemplates] = React.useState<LetterTemplate[]>([]);
  const [drafts, setDrafts] = React.useState<LetterDraft[]>([]);

  const [clientMode, setClientMode] = React.useState<"none" | "client">("none");
  const [clientSearch, setClientSearch] = React.useState("");
  const [clients, setClients] = React.useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = React.useState(false);
  const [selectedClientId, setSelectedClientId] = React.useState<number | null>(null);
  const [clientContext, setClientContext] = React.useState<ClientContext | null>(null);

  const [letterId, setLetterId] = React.useState<number | null>(null);
  const [title, setTitle] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [letterType, setLetterType] = React.useState("other");
  const [customInstructions, setCustomInstructions] = React.useState("");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<number | null>(null);

  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [templateName, setTemplateName] = React.useState("");
  const [branding, setBranding] = React.useState<ConsultantBranding | null>(null);
  const [brandingWarnings, setBrandingWarnings] = React.useState<string[]>([]);
  const [showPreview, setShowPreview] = React.useState(true);
  const [savedSnapshot, setSavedSnapshot] = React.useState("");
  const previewRef = React.useRef<HTMLDivElement>(null);

  const currentSnapshot = buildEditorSnapshot({
    title,
    subject,
    bodyHtml,
    letterType,
    clientMode,
    selectedClientId,
  });
  const isDirty = savedSnapshot !== "" && currentSnapshot !== savedSnapshot;

  const markSaved = React.useCallback(
    (snapshot = currentSnapshot) => setSavedSnapshot(snapshot),
    [currentSnapshot],
  );

  const loadMeta = React.useCallback(async () => {
    const [metaRes, templatesRes, draftsRes] = await Promise.all([
      fetch(`${API}/consultant/letters/meta`, { headers: authHeaders() }),
      fetch(`${API}/consultant/letters/templates`, { headers: authHeaders() }),
      fetch(`${API}/consultant/letters`, { headers: authHeaders() }),
    ]);
    const meta = await metaRes.json();
    const templatesJson = await templatesRes.json();
    const draftsJson = await draftsRes.json();
    setLetterTypes(meta.letter_types ?? []);
    setOpenAiAvailable(Boolean(meta.openai_available));
    setBranding(meta.branding ?? null);
    setBrandingWarnings(meta.branding_warnings ?? []);
    setTemplates(templatesJson.data ?? []);
    setDrafts(draftsJson.data ?? []);
  }, []);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadMeta();
      } catch {
        setMessage("Could not load Letters workspace.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMeta]);

  const searchClients = React.useCallback(async (q: string) => {
    setClientsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "20" });
      if (q.trim()) params.set("search", q.trim());
      const res = await fetch(`${API}/consultant/clients?${params}`, { headers: authHeaders() });
      const json = await res.json();
      setClients(json.data ?? []);
    } catch {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (clientMode !== "client") return;
    const t = setTimeout(() => void searchClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientMode, clientSearch, searchClients]);

  const loadClientContext = React.useCallback(async (profileId: number) => {
    try {
      const res = await fetch(`${API}/consultant/letters/context/${profileId}`, { headers: authHeaders() });
      const json = await res.json();
      setClientContext(json.data ?? null);
    } catch {
      setClientContext(null);
    }
  }, []);

  const selectClient = React.useCallback(
    async (profileId: number) => {
      setClientMode("client");
      setSelectedClientId(profileId);
      void loadClientContext(profileId);

      try {
        const res = await fetch(`${API}/consultant/clients/${profileId}`, { headers: authHeaders() });
        const json = await res.json();
        if (res.ok && json.client) {
          const profile = json.client as ClientRow;
          setClients((prev) => {
            if (prev.some((c) => c.id === profile.id)) return prev;
            return [profile, ...prev];
          });
        }
      } catch {
        // Context panel still works without list row
      }
    },
    [loadClientContext],
  );

  const initialClientApplied = React.useRef(false);
  React.useEffect(() => {
    if (!initialClientId || initialClientApplied.current) return;
    initialClientApplied.current = true;
    void selectClient(initialClientId);
  }, [initialClientId, selectClient]);

  const applyEditorState = (state: {
    letterId: number | null;
    title: string;
    subject: string;
    bodyHtml: string;
    letterType: string;
    customInstructions?: string;
    selectedTemplateId?: number | null;
    clientMode: "none" | "client";
    selectedClientId: number | null;
  }) => {
    setLetterId(state.letterId);
    setTitle(state.title);
    setSubject(state.subject);
    setBodyHtml(state.bodyHtml);
    setLetterType(state.letterType);
    if (state.customInstructions !== undefined) setCustomInstructions(state.customInstructions);
    if (state.selectedTemplateId !== undefined) setSelectedTemplateId(state.selectedTemplateId);
    setClientMode(state.clientMode);
    setSelectedClientId(state.selectedClientId);
    markSaved(
      buildEditorSnapshot({
        title: state.title,
        subject: state.subject,
        bodyHtml: state.bodyHtml,
        letterType: state.letterType,
        clientMode: state.clientMode,
        selectedClientId: state.selectedClientId,
      }),
    );
  };

  const confirmDiscard = () => {
    if (!isDirty) return true;
    return confirm("You have unsaved changes. Discard them?");
  };

  const resetDraft = () => {
    if (!confirmDiscard()) return;
    applyEditorState({
      letterId: null,
      title: "",
      subject: "",
      bodyHtml: "",
      letterType: "other",
      customInstructions: "",
      selectedTemplateId: null,
      clientMode: "none",
      selectedClientId: null,
    });
    setClientContext(null);
    setTemplateName("");
    setSavedSnapshot("");
    toast.message("Started a new blank letter.");
  };

  const applyTemplate = (template: LetterTemplate) => {
    if (!confirmDiscard()) return;
    applyEditorState({
      letterId: null,
      title: template.name,
      subject: template.subject_template ?? "",
      bodyHtml: template.body_html ?? "",
      letterType: template.letter_type,
      selectedTemplateId: template.id,
      clientMode,
      selectedClientId,
    });
    toast.success(`Template "${template.name}" applied.`);
  };

  const loadDraft = async (draft: LetterDraft) => {
    if (!confirmDiscard()) return;
    try {
      const res = await fetch(`${API}/consultant/letters/${draft.id}`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not load draft");
      const data = json.data as LetterDraft;
      const mode = data.client_profile_id ? "client" : "none";
      applyEditorState({
        letterId: data.id,
        title: data.title,
        subject: data.subject ?? "",
        bodyHtml: data.body_html ?? "",
        letterType: data.letter_type,
        customInstructions: data.generation_prompt ?? "",
        selectedTemplateId: data.template_id ?? null,
        clientMode: mode,
        selectedClientId: data.client_profile_id,
      });
      if (data.client_profile_id) {
        void loadClientContext(data.client_profile_id);
      } else {
        setClientContext(null);
      }
      toast.success(`Loaded "${data.title}".`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load draft");
    }
  };

  const handleGenerate = async () => {
    if (bodyHtml.trim() && !confirm("Generate a new AI draft? This will replace the current letter body.")) {
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/letters/generate`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({
          letter_type: letterType,
          custom_instructions: customInstructions || null,
          client_profile_id: clientMode === "client" ? selectedClientId : null,
          template_id: selectedTemplateId,
          letter_id: letterId,
          save_draft: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Generation failed");
      const data = json.data as LetterDraft;
      applyEditorState({
        letterId: data.id,
        title: data.title,
        subject: data.subject ?? "",
        bodyHtml: data.body_html ?? "",
        letterType: data.letter_type,
        clientMode,
        selectedClientId,
        selectedTemplateId,
      });
      if (json.notes) toast.message(json.notes);
      toast.success(json.message ?? "Letter generated.");
      await loadMeta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveLetter = async (status: "draft" | "final" = "draft"): Promise<number | null> => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return null;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        title: title.trim(),
        subject: subject.trim() || null,
        body_html: bodyHtml,
        letter_type: letterType,
        status,
        client_profile_id: clientMode === "client" ? selectedClientId : null,
        template_id: selectedTemplateId,
        generation_mode: letterId ? undefined : "blank",
      };
      const url = letterId
        ? `${API}/consultant/letters/${letterId}`
        : `${API}/consultant/letters`;
      const method = letterId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders("application/json"),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Save failed");
      const id = json.data.id as number;
      setLetterId(id);
      markSaved();
      toast.success(json.message ?? "Saved.");
      await loadMeta();
      return id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (status: "draft" | "final" = "draft") => void saveLetter(status);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Enter a template name.");
      return;
    }
    if (letterId) {
      try {
        const res = await fetch(`${API}/consultant/letters/${letterId}/save-as-template`, {
          method: "POST",
          headers: authHeaders("application/json"),
          body: JSON.stringify({ name: templateName.trim() }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed");
        toast.success(json.message);
        setTemplateName("");
        await loadMeta();
        return;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save template");
        return;
      }
    }
    try {
      const res = await fetch(`${API}/consultant/letters/templates`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({
          name: templateName.trim(),
          letter_type: letterType,
          subject_template: subject,
          body_html: bodyHtml,
          applies_to_client: clientMode === "client",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed");
      toast.success(json.message);
      setTemplateName("");
      await loadMeta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save template");
    }
  };

  const handleDuplicateTemplate = async (template: LetterTemplate) => {
    try {
      const res = await fetch(`${API}/consultant/letters/templates`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({
          name: `${template.name} (copy)`,
          letter_type: template.letter_type,
          subject_template: template.subject_template,
          body_html: template.body_html,
          applies_to_client: template.applies_to_client,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed");
      toast.success("Template duplicated.");
      await loadMeta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate template");
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    try {
      await fetch(`${API}/consultant/letters/templates/${id}`, { method: "DELETE", headers: authHeaders() });
      if (selectedTemplateId === id) setSelectedTemplateId(null);
      await loadMeta();
      toast.success("Template deleted.");
    } catch {
      toast.error("Could not delete template.");
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const id = await saveLetter("draft");
      if (!id) return;

      const res = await fetch(`${API}/consultant/letters/${id}/export-pdf`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "letter"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    const html = previewRef.current?.outerHTML;
    if (!html) {
      toast.error("Nothing to print yet.");
      return;
    }
    const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!win) {
      toast.error("Pop-up blocked. Allow pop-ups to print.");
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>${title || "Letter"}</title>
      <style>body{margin:0;background:#fff;font-family:Georgia,Times New Roman,serif;}</style>
      </head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleDeleteDraft = async (id: number) => {
    if (!confirm("Delete this draft?")) return;
    try {
      await fetch(`${API}/consultant/letters/${id}`, { method: "DELETE", headers: authHeaders() });
      if (letterId === id) {
        applyEditorState({
          letterId: null,
          title: "",
          subject: "",
          bodyHtml: "",
          letterType: "other",
          customInstructions: "",
          selectedTemplateId: null,
          clientMode: "none",
          selectedClientId: null,
        });
        setClientContext(null);
        setSavedSnapshot("");
      }
      await loadMeta();
      toast.success("Draft deleted.");
    } catch {
      toast.error("Could not delete draft.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground sm:p-8">
        <Loader2 className="size-5 animate-spin" />
        Loading Letters…
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden pb-20 sm:space-y-6 sm:pb-10">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-primary/5 p-4 shadow-sm sm:p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <Mail className="size-6 shrink-0 text-primary sm:size-7" />
          Letters
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Draft immigration letters with AI — with or without a client. Use templates, edit, and export PDF.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
        {openAiAvailable ? (
          <Badge variant="secondary">
            <Sparkles className="mr-1 size-3" />
            AI drafting enabled
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-700">
            AI unavailable — blank/template editing only
          </Badge>
        )}
        {isDirty && (
          <Badge variant="outline" className="border-amber-500 text-amber-700">
            Unsaved changes
          </Badge>
        )}
        </div>
      </section>

      {brandingWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 sm:px-4">
          <p className="font-medium">Complete your letterhead</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {brandingWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <Link href="/dashboard/account" className="mt-2 inline-block text-xs font-medium underline">
            Go to Account settings →
          </Link>
        </div>
      )}

      {initialClientId && clientMode === "client" && selectedClientId === initialClientId && clientContext && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 text-sm sm:px-4">
          <p className="font-medium text-primary">
            Drafting for {clientContext.client_name ?? "this client"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Opened from client workspace — case data will be used for AI generation.
          </p>
        </div>
      )}

      {message && (
        <div className="rounded-lg border px-4 py-2 text-sm">{message}</div>
      )}

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
        {/* Main editor */}
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Who is this letter for?</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button
                variant={clientMode === "none" ? "default" : "outline"}
                size="sm"
                className="h-9 w-full justify-center sm:w-auto"
                onClick={() => {
                  setClientMode("none");
                  setSelectedClientId(null);
                  setClientContext(null);
                }}
              >
                <UserX className="mr-1 size-4" />
                No client
              </Button>
              <Button
                variant={clientMode === "client" ? "default" : "outline"}
                size="sm"
                className="h-9 w-full justify-center sm:w-auto"
                onClick={() => setClientMode("client")}
              >
                <User className="mr-1 size-4" />
                Select client
              </Button>
              <Button variant="ghost" size="sm" className="col-span-2 h-9 w-full justify-center sm:col-span-1 sm:w-auto" onClick={resetDraft}>
                <Plus className="mr-1 size-4" />
                New blank
              </Button>
            </CardContent>
          </Card>

          {clientMode === "client" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search client name or email…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                {clientsLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void selectClient(c.id)}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-xs hover:bg-muted/50",
                        selectedClientId === c.id && "border-primary bg-primary/5",
                      )}
                    >
                      <p className="font-medium">{c.user.name}</p>
                      <p className="text-muted-foreground">{c.user.email}</p>
                    </button>
                  ))}
                </div>
                {clientContext && selectedClientId && (
                  <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs break-words">
                    <p className="font-medium text-primary">Using client data</p>
                    <p>{clientContext.client_name} · {clientContext.client_email}</p>
                    {clientContext.immigration_pathway && (
                      <p>Pathway: {clientContext.immigration_pathway}</p>
                    )}
                    {clientContext.case_status && <p>Case: {clientContext.case_status}</p>}
                    {clientContext.pathway_assessment_crs_score != null && (
                      <p>CRS: {clientContext.pathway_assessment_crs_score}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4" />
                Letter setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Letter type</Label>
                  <Select value={letterType} onValueChange={setLetterType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {letterTypes.map((t) => (
                        <SelectItem key={t.slug} value={t.slug}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Title (internal)</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. IRCC refusal response — Jan 2026" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Subject line</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Letter subject" />
              </div>
              <div className="space-y-1.5">
                <Label>Instructions for AI (optional)</Label>
                <Textarea
                  rows={3}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. Write a respectful appeal letter regarding study permit refusal citing genuine student intent…"
                />
              </div>
              <Button
                className="h-10 w-full sm:w-auto"
                onClick={() => void handleGenerate()}
                disabled={generating || (clientMode === "client" && !selectedClientId)}
              >
                {generating ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 size-4" />
                )}
                Generate with AI
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base">Document preview</CardTitle>
                  <CardDescription>
                    Professional letter layout with your logo, company details, and signature
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full shrink-0 sm:w-auto"
                  onClick={() => setShowPreview((v) => !v)}
                >
                  {showPreview ? "Hide preview" : "Show preview"}
                </Button>
              </div>
            </CardHeader>
            {showPreview && (
              <CardContent className="overflow-x-auto bg-white px-2 py-2 sm:px-4">
                <LetterDocumentPreview
                  ref={previewRef}
                  branding={branding}
                  subject={subject}
                  bodyHtml={bodyHtml}
                  client={
                    clientMode === "client" && clientContext
                      ? {
                          client_name: clientContext.client_name,
                          client_email: clientContext.client_email,
                          client_phone: clientContext.client_phone,
                          immigration_pathway: clientContext.immigration_pathway,
                          passport_number: clientContext.passport_number,
                        }
                      : null
                  }
                />
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Letter body</CardTitle>
              <CardDescription>
                Edit the letter content only — header and signature are added automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <RichTextEditorDemo
                value={bodyHtml}
                onChange={(v) => setBodyHtml(typeof v === "string" ? v : "")}
                output="html"
                placeholder="Letter content will appear here after generation, or start typing…"
                className="min-h-[280px] sm:min-h-[320px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button variant="outline" className="h-9 w-full justify-center sm:w-auto" onClick={() => void handleSave("draft")} disabled={saving}>
                {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
                Save draft
              </Button>
              <Button variant="outline" className="h-9 w-full justify-center sm:w-auto" onClick={() => void handleSave("final")} disabled={saving}>
                Mark final
              </Button>
              <Button variant="outline" className="h-9 w-full justify-center sm:w-auto" onClick={() => void handleExportPdf()} disabled={exporting}>
                {exporting ? <Loader2 className="mr-1 size-4 animate-spin" /> : <FileDown className="mr-1 size-4" />}
                Export PDF
              </Button>
              <Button variant="outline" className="col-span-2 h-9 w-full justify-center sm:col-span-1 sm:w-auto" onClick={handlePrint}>
                <Printer className="mr-1 size-4" />
                Print
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Save as template</CardTitle>
              <CardDescription>Reuse this letter structure later</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="w-full sm:max-w-xs"
              />
              <Button variant="secondary" className="h-9 w-full shrink-0 sm:w-auto" onClick={() => void handleSaveTemplate()}>
                Save template
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar — templates & drafts (shown first on mobile) */}
        <div className="order-1 min-w-0 space-y-4 lg:order-2 lg:sticky lg:top-4 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Templates</CardTitle>
              <CardDescription>Reusable letter layouts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">No templates yet — save one from your draft.</p>
              )}
              {templates.map((t) => (
                <div key={t.id} className="flex min-w-0 items-start gap-1">
                  <button
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className={cn(
                      "min-w-0 flex-1 overflow-hidden rounded-lg border p-2 text-left text-xs hover:bg-muted/50 transition-colors",
                      selectedTemplateId === t.id && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="truncate text-muted-foreground">{t.letter_type_label}</p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title="Duplicate template"
                    onClick={() => void handleDuplicateTemplate(t)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title="Delete template"
                    onClick={() => void handleDeleteTemplate(t.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden py-0">
            <CardHeader className="border-b border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">Recent drafts</CardTitle>
                  <CardDescription className="text-xs">
                    {drafts.length === 0 ? "No saved letters yet" : `${Math.min(drafts.length, 8)} of ${drafts.length} shown`}
                  </CardDescription>
                </div>
                {drafts.length > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {drafts.filter((d) => d.status === "draft").length} draft
                    {drafts.filter((d) => d.status === "draft").length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted/60">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground/80">No drafts yet</p>
                  <p className="max-w-[200px] text-xs text-muted-foreground">
                    Generate or save a letter to see it here.
                  </p>
                </div>
              ) : (
                <ul className="max-h-[480px] divide-y divide-border/50 overflow-y-auto">
                  {drafts.slice(0, 8).map((d) => {
                    const isActive = letterId === d.id;
                    const isFinal = d.status === "final";
                    return (
                      <li key={d.id} className="group relative">
                        {isActive && (
                          <span className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-primary" aria-hidden />
                        )}
                        <button
                          type="button"
                          onClick={() => void loadDraft(d)}
                          className={cn(
                            "w-full px-4 py-3 pr-10 text-left transition-colors",
                            isActive ? "bg-primary/5" : "hover:bg-muted/40",
                          )}
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium leading-snug text-foreground">
                                {d.title}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                {d.letter_type_label ?? d.letter_type}
                              </p>
                              {d.client_name && (
                                <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/90">
                                  <User className="size-3 shrink-0 opacity-70" />
                                  <span className="truncate">{d.client_name}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize leading-none",
                                  isFinal
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
                                )}
                              >
                                {d.status}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                                <Clock className="size-3" />
                                {formatDraftDate(d.updated_at)}
                              </span>
                            </div>
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1.5 top-1/2 size-7 -translate-y-1/2 opacity-100 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                          title="Delete draft"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteDraft(d.id);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
