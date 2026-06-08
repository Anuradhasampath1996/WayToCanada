"use client";

import * as React from "react";
import {
  BookOpen,
  CloudDownload,
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Link2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import Link from "next/link";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type SyncRun = {
  id: number;
  status: string;
  progress_percent: number;
  current_step: string | null;
  stats: { created?: number; updated?: number; errors?: string[]; synced_entries?: number } | null;
  error_message: string | null;
};

type DocRow = {
  id: number;
  title: string;
  source_slug: string;
  act_code: string | null;
  language: string;
  format: string;
  provisions_count: number;
  last_synced_at: string | null;
  has_viewer: boolean;
  ai_analyzed: boolean;
};

type CatalogStats = {
  acts: number;
  regulations: number;
  synced: number;
  pending: number;
};

type SyncStatus = {
  document_count: number;
  provision_count: number;
  xml_documents: number;
  catalog?: CatalogStats;
  catalog_act_count?: number;
  configured_sources: string[];
  openai_enabled: boolean;
  latest_run: SyncRun | null;
  recent_documents: DocRow[];
};

type CatalogEntry = {
  id: number;
  act_code: string;
  fr_act_code?: string | null;
  title: string;
  category: "act" | "regulation";
  last_synced_at: string | null;
  documents_synced?: number;
};

type RefRow = {
  id: number;
  document_id: number;
  label: string;
  target_act_code: string | null;
  target_provision_key: string | null;
  source_type: string;
  custom_popup_html: string | null;
  admin_notes: string | null;
  is_active: boolean;
};

const emptyRefForm = {
  label: "",
  target_act_code: "",
  target_provision_key: "",
  custom_popup_html: "",
  admin_notes: "",
};

export default function LegislationsHubPage() {
  const [status, setStatus] = React.useState<SyncStatus | null>(null);
  const [documents, setDocuments] = React.useState<DocRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [activeRun, setActiveRun] = React.useState<SyncRun | null>(null);
  const [discovering, setDiscovering] = React.useState<"acts" | "regulations" | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  // Catalog tab
  const [catalogRows, setCatalogRows] = React.useState<CatalogEntry[]>([]);
  const [catalogMeta, setCatalogMeta] = React.useState({ current_page: 1, last_page: 1, total: 0 });
  const [catalogStats, setCatalogStats] = React.useState<CatalogStats | null>(null);
  const [catalogSearch, setCatalogSearch] = React.useState("");
  const [catalogCategory, setCatalogCategory] = React.useState<string>("all");
  const [catalogPage, setCatalogPage] = React.useState(1);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [syncingEntryId, setSyncingEntryId] = React.useState<number | null>(null);

  // References tab
  const [refDocId, setRefDocId] = React.useState<string>("");
  const [references, setReferences] = React.useState<RefRow[]>([]);
  const [refsLoading, setRefsLoading] = React.useState(false);
  const [refForm, setRefForm] = React.useState(emptyRefForm);
  const [editingRefId, setEditingRefId] = React.useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [savingRef, setSavingRef] = React.useState(false);

  const catalogCounts = status?.catalog ?? {
    acts: status?.catalog_act_count ?? 0,
    regulations: 0,
    synced: 0,
    pending: status?.catalog_act_count ?? 0,
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [st, docs] = await Promise.all([
        fetch(`${API}/admin/legislation/sync-status`, { headers: adminAuthHeaders() }).then((r) => r.json()),
        fetch(`${API}/admin/legislation/documents`, { headers: adminAuthHeaders() }).then((r) => r.json()),
      ]);
      setStatus(st);
      setDocuments(docs.data ?? []);
      if (st.latest_run && ["pending", "running"].includes(st.latest_run.status)) {
        setActiveRun(st.latest_run);
        setSyncing(true);
      }
    } catch {
      setMessage("Could not load legislation sync status.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = React.useCallback(async (page = catalogPage) => {
    setCatalogLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "25",
      });
      if (catalogSearch.trim()) params.set("search", catalogSearch.trim());
      if (catalogCategory !== "all") params.set("category", catalogCategory);

      const res = await fetch(`${API}/admin/legislation/catalog?${params}`, { headers: adminAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load catalog");
      setCatalogRows(json.data ?? []);
      setCatalogMeta(json.meta ?? { current_page: 1, last_page: 1, total: 0 });
      if (json.stats) setCatalogStats(json.stats);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Catalog load failed");
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogPage, catalogSearch, catalogCategory]);

  const loadReferences = React.useCallback(async (docId: string) => {
    if (!docId) {
      setReferences([]);
      return;
    }
    setRefsLoading(true);
    try {
      const res = await fetch(`${API}/admin/legislation/documents/${docId}/references`, { headers: adminAuthHeaders() });
      const json = await res.json();
      setReferences(json.data ?? []);
    } catch {
      setMessage("Could not load references.");
    } finally {
      setRefsLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { loadCatalog(catalogPage); }, [catalogPage, catalogCategory, loadCatalog]);

  React.useEffect(() => {
    if (!activeRun || !syncing) return;
    const id = setInterval(async () => {
      const res = await fetch(`${API}/admin/legislation/sync-runs/${activeRun.id}`, { headers: adminAuthHeaders() });
      const json = await res.json();
      const run = json.data as SyncRun;
      setActiveRun(run);
      if (["completed", "failed"].includes(run.status)) {
        setSyncing(false);
        setMessage(run.status === "completed" ? "Sync completed." : run.error_message ?? "Sync failed.");
        load();
        loadCatalog(catalogPage);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [activeRun, syncing, load, loadCatalog, catalogPage]);

  React.useEffect(() => {
    if (refDocId) loadReferences(refDocId);
  }, [refDocId, loadReferences]);

  const xmlDocuments = documents.filter((d) => d.format === "xml");

  const xmlViewIdByKey = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) {
      if (d.format === "xml" && d.has_viewer) {
        map.set(`${d.act_code ?? d.source_slug}:${d.language}`, d.id);
      }
    }
    return map;
  }, [documents]);

  const viewDocumentId = (d: DocRow) => {
    if (d.format === "xml" && d.has_viewer) return d.id;
    const xmlId = xmlViewIdByKey.get(`${d.act_code ?? d.source_slug}:${d.language}`);
    return xmlId ?? d.id;
  };

  const startSync = async (opts?: {
    source?: string;
    scope?: string;
    category?: string;
    batchSize?: number;
    runAi?: boolean;
  }) => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/sync`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({
          source: opts?.source,
          scope: opts?.scope ?? (opts?.source ? "source" : "all"),
          category: opts?.category,
          batch_size: opts?.batchSize ?? 5,
          only_unsynced: true,
          async: true,
          run_ai: opts?.runAi ?? false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Sync failed");
      setActiveRun(json.run);
      setMessage(json.message);
    } catch (e) {
      setSyncing(false);
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  };

  const discoverCatalog = async (type: "acts" | "regulations" | "both") => {
    setDiscovering(type === "both" ? "acts" : type);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/discover-catalog`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Discovery failed");
      setMessage(json.message ?? `Discovered ${type}.`);
      if (json.stats) setCatalogStats(json.stats);
      load();
      loadCatalog(1);
      setCatalogPage(1);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Discovery failed");
    } finally {
      setDiscovering(null);
    }
  };

  const syncCatalogEntry = async (entry: CatalogEntry) => {
    setSyncingEntryId(entry.id);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/catalog/${entry.id}/sync`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({ async: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Sync failed");
      setMessage(`Synced ${entry.act_code}.`);
      load();
      loadCatalog(catalogPage);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Entry sync failed");
    } finally {
      setSyncingEntryId(null);
    }
  };

  const downloadDocument = async (doc: DocRow) => {
    try {
      const res = await fetch(`${API}/admin/legislation/documents/${doc.id}/download`, { headers: adminAuthHeaders() });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.act_code ?? doc.source_slug}-${doc.language}.${doc.format === "pdf" ? "pdf" : doc.format === "xml" ? "xml" : "html"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Download failed");
    }
  };

  const analyzeDocument = async (doc: DocRow) => {
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/documents/${doc.id}/analyze`, {
        method: "POST",
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Analysis failed");
      setMessage(`Analysis complete: ${json.data?.detected ?? 0} references detected.`);
      load();
      if (refDocId === String(doc.id)) loadReferences(refDocId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Analysis failed");
    }
  };

  const applyReferences = async (docId: number) => {
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/documents/${docId}/apply-references`, {
        method: "POST",
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Apply failed");
      setMessage("Manual references applied to document HTML.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Apply failed");
    }
  };

  const saveReference = async () => {
    if (!refDocId || !refForm.label.trim()) return;
    setSavingRef(true);
    setMessage(null);
    try {
      const payload = {
        label: refForm.label.trim(),
        target_act_code: refForm.target_act_code.trim() || null,
        target_provision_key: refForm.target_provision_key.trim() || null,
        custom_popup_html: refForm.custom_popup_html.trim() || null,
        admin_notes: refForm.admin_notes.trim() || null,
        apply_now: true,
      };

      const url = editingRefId
        ? `${API}/admin/legislation/references/${editingRefId}`
        : `${API}/admin/legislation/documents/${refDocId}/references`;
      const method = editingRefId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Save failed");

      setRefForm(emptyRefForm);
      setEditingRefId(null);
      setMessage(editingRefId ? "Reference updated." : "Reference created.");
      loadReferences(refDocId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingRef(false);
    }
  };

  const deleteReference = async (ref: RefRow) => {
    if (!confirm(`Delete reference "${ref.label}"?`)) return;
    try {
      const res = await fetch(`${API}/admin/legislation/references/${ref.id}`, {
        method: "DELETE",
        headers: adminAuthHeaders(),
      });
      if (!res.ok) throw new Error("Delete failed");
      setMessage("Reference deleted.");
      loadReferences(refDocId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const editReference = (ref: RefRow) => {
    setEditingRefId(ref.id);
    setRefForm({
      label: ref.label,
      target_act_code: ref.target_act_code ?? "",
      target_provision_key: ref.target_provision_key ?? "",
      custom_popup_html: ref.custom_popup_html ?? "",
      admin_notes: ref.admin_notes ?? "",
    });
  };

  const previewReference = async (act?: string, key?: string) => {
    const actCode = act ?? refForm.target_act_code.trim();
    const provKey = key ?? refForm.target_provision_key.trim();
    if (!actCode || !provKey) {
      setMessage("Enter target act code and provision key to preview.");
      return;
    }
    setPreviewLoading(true);
    setPreviewOpen(true);
    setPreviewHtml(null);
    try {
      const params = new URLSearchParams({ act: actCode, key: provKey, language: "en" });
      const res = await fetch(`${API}/admin/legislation/references/preview?${params}`, { headers: adminAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Preview not found");
      setPreviewHtml(json.data?.popup_html ?? json.data?.html_fragment ?? "No content");
    } catch (e) {
      setPreviewHtml(`<p class="text-destructive">${e instanceof Error ? e.message : "Preview failed"}</p>`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCatalogSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogPage(1);
    loadCatalog(1);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            Legislation Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Sync Canadian Acts &amp; Regulations from{" "}
            <a href="https://laws.justice.gc.ca/eng/acts/" target="_blank" rel="noopener noreferrer" className="underline">
              laws.justice.gc.ca
            </a>
            . Priority: IRPA + IRPR. Full catalog via batch sync (requires queue worker).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => discoverCatalog("acts")} disabled={!!discovering || syncing}>
            {discovering === "acts" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookOpen className="h-4 w-4 mr-1" />}
            Discover Acts ({catalogCounts.acts})
          </Button>
          <Button variant="outline" size="sm" onClick={() => discoverCatalog("regulations")} disabled={!!discovering || syncing}>
            {discovering === "regulations" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Discover Regs ({catalogCounts.regulations})
          </Button>
          <Button size="sm" onClick={() => startSync()} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CloudDownload className="h-4 w-4 mr-1" />}
            Sync Priority
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => startSync({ scope: "catalog_batch", category: "act", batchSize: 5 })}
            disabled={syncing || !catalogCounts.acts}
          >
            <CloudDownload className="h-4 w-4 mr-1" />
            Batch Sync Acts
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => startSync({ scope: "catalog_batch", category: "regulation", batchSize: 5 })}
            disabled={syncing || !catalogCounts.regulations}
          >
            <CloudDownload className="h-4 w-4 mr-1" />
            Batch Sync Regs
          </Button>
          <Button variant="secondary" size="sm" onClick={() => startSync({ runAi: true })} disabled={syncing}>
            <Sparkles className="h-4 w-4 mr-1" />
            Sync + AI
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border px-4 py-2 text-sm flex items-center gap-2">
          {message.toLowerCase().includes("fail") ? (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          )}
          {message}
        </div>
      )}

      {syncing && activeRun && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sync in progress</CardTitle>
            <CardDescription>{activeRun.current_step ?? "Running…"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={activeRun.progress_percent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {activeRun.progress_percent}% complete
              {activeRun.stats?.synced_entries != null && ` · ${activeRun.stats.synced_entries} catalog entries processed`}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardDescription>Acts</CardDescription><CardTitle>{catalogStats?.acts ?? catalogCounts.acts}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Regulations</CardDescription><CardTitle>{catalogStats?.regulations ?? catalogCounts.regulations}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Catalog synced</CardDescription><CardTitle>{catalogStats?.synced ?? catalogCounts.synced}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Documents</CardDescription><CardTitle>{status?.document_count ?? "—"}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Provisions</CardDescription><CardTitle>{status?.provision_count ?? "—"}</CardTitle></CardHeader></Card>
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        {/* ── Documents ── */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Synced documents</CardTitle>
              <CardDescription>EN + FR · XML + HTML + PDF · download, analyze, apply manual refs</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Lang</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Provisions</TableHead>
                    <TableHead>AI</TableHead>
                    <TableHead>Last synced</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{d.title}</TableCell>
                      <TableCell><Badge variant="outline">{d.act_code ?? d.source_slug}</Badge></TableCell>
                      <TableCell>{d.language.toUpperCase()}</TableCell>
                      <TableCell>{d.format.toUpperCase()}</TableCell>
                      <TableCell>{d.provisions_count || "—"}</TableCell>
                      <TableCell>
                        {d.format === "xml" ? (
                          d.ai_analyzed ? <Badge variant="secondary">Done</Badge> : <Badge variant="outline">—</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {d.last_synced_at ? new Date(d.last_synced_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(d.has_viewer || d.format === "pdf") && (
                            <Button variant="ghost" size="icon" title="View document (interactive XML)" asChild>
                              <Link href={`/admindashboard/legislations-hub/documents/${viewDocumentId(d)}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Download" onClick={() => downloadDocument(d)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {d.format === "xml" && (
                            <>
                              <Button variant="ghost" size="icon" title="Analyze references" onClick={() => analyzeDocument(d)}>
                                <Sparkles className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Apply manual refs" onClick={() => applyReferences(d.id)}>
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!documents.length && !loading && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No documents synced yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Catalog ── */}
        <TabsContent value="catalog" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acts &amp; Regulations catalog</CardTitle>
              <CardDescription>
                {catalogMeta.total.toLocaleString()} entries · {catalogStats?.pending ?? catalogCounts.pending} pending sync
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCatalogSearch} className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search by title or act code…"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>
                <Select value={catalogCategory} onValueChange={(v) => { setCatalogCategory(v); setCatalogPage(1); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="act">Acts</SelectItem>
                    <SelectItem value="regulation">Regulations</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" variant="secondary">Search</Button>
              </form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Docs</TableHead>
                      <TableHead>Last synced</TableHead>
                      <TableHead className="text-right">Sync</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : catalogRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{row.act_code}</TableCell>
                        <TableCell className="max-w-[280px] truncate" title={row.title}>{row.title}</TableCell>
                        <TableCell>
                          <Badge variant={row.category === "act" ? "default" : "secondary"}>
                            {row.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.documents_synced ?? (row.last_synced_at ? "✓" : "—")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {row.last_synced_at ? new Date(row.last_synced_at).toLocaleString() : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={syncingEntryId === row.id || syncing}
                            onClick={() => syncCatalogEntry(row)}
                          >
                            {syncingEntryId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudDownload className="h-3 w-3" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!catalogLoading && !catalogRows.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No catalog entries. Run Discover Acts or Discover Regs.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {catalogMeta.last_page > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (catalogPage > 1) setCatalogPage(catalogPage - 1); }}
                        className={catalogPage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, catalogMeta.last_page) }, (_, i) => {
                      const start = Math.max(1, Math.min(catalogPage - 2, catalogMeta.last_page - 4));
                      const page = start + i;
                      if (page > catalogMeta.last_page) return null;
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={page === catalogPage}
                            onClick={(e) => { e.preventDefault(); setCatalogPage(page); }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); if (catalogPage < catalogMeta.last_page) setCatalogPage(catalogPage + 1); }}
                        className={catalogPage >= catalogMeta.last_page ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── References ── */}
        <TabsContent value="references" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manual cross-references</CardTitle>
              <CardDescription>
                Add clickable legal references with custom popup HTML. Select an XML document first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1.5 flex-1 min-w-[240px]">
                  <Label>XML document</Label>
                  <Select value={refDocId} onValueChange={(v) => { setRefDocId(v); setEditingRefId(null); setRefForm(emptyRefForm); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select document…" />
                    </SelectTrigger>
                    <SelectContent>
                      {xmlDocuments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.act_code} · {d.language.toUpperCase()} · {d.title.slice(0, 40)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {refDocId && (
                  <Button variant="outline" size="sm" onClick={() => applyReferences(Number(refDocId))}>
                    <Link2 className="h-4 w-4 mr-1" />
                    Apply to HTML
                  </Button>
                )}
              </div>

              {refDocId && (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {refsLoading ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                        ) : references.map((ref) => (
                          <TableRow key={ref.id}>
                            <TableCell className="font-medium">{ref.label}</TableCell>
                            <TableCell className="text-xs font-mono">
                              {ref.target_act_code ?? "—"}{ref.target_provision_key ? `:${ref.target_provision_key}` : ""}
                            </TableCell>
                            <TableCell><Badge variant="outline">{ref.source_type}</Badge></TableCell>
                            <TableCell>{ref.is_active ? "Yes" : "No"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {ref.target_act_code && ref.target_provision_key && (
                                  <Button variant="ghost" size="icon" onClick={() => previewReference(ref.target_act_code!, ref.target_provision_key!)}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => editReference(ref)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteReference(ref)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!refsLoading && !references.length && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No references yet.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {editingRefId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {editingRefId ? "Edit reference" : "Add reference"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Label (text in document)</Label>
                          <Input
                            value={refForm.label}
                            onChange={(e) => setRefForm({ ...refForm, label: e.target.value })}
                            placeholder="subsection 14.1(1)"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Target act code</Label>
                          <Input
                            value={refForm.target_act_code}
                            onChange={(e) => setRefForm({ ...refForm, target_act_code: e.target.value })}
                            placeholder="I-2.5"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Target provision key</Label>
                          <Input
                            value={refForm.target_provision_key}
                            onChange={(e) => setRefForm({ ...refForm, target_provision_key: e.target.value })}
                            placeholder="14.1(1)"
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Custom popup HTML (optional override)</Label>
                          <Textarea
                            rows={3}
                            value={refForm.custom_popup_html}
                            onChange={(e) => setRefForm({ ...refForm, custom_popup_html: e.target.value })}
                            placeholder="<div>Custom popup content…</div>"
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Admin notes</Label>
                          <Input
                            value={refForm.admin_notes}
                            onChange={(e) => setRefForm({ ...refForm, admin_notes: e.target.value })}
                            placeholder="Internal notes"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={saveReference} disabled={savingRef || !refForm.label.trim()}>
                          {savingRef ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                          {editingRefId ? "Update" : "Create"}
                        </Button>
                        <Button variant="outline" onClick={() => previewReference()}>
                          <Eye className="h-4 w-4 mr-1" />
                          Preview popup
                        </Button>
                        {editingRefId && (
                          <Button variant="ghost" onClick={() => { setEditingRefId(null); setRefForm(emptyRefForm); }}>
                            Cancel edit
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {!refDocId && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sync XML documents first, then select one to manage references.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sources ── */}
        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configured priority sources</CardTitle>
              <CardDescription>IRPA and IRPR — always available without catalog discovery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(status?.configured_sources ?? ["irpa", "irpr"]).map((slug) => (
                <div key={slug} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium uppercase">{slug}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startSync({ source: slug })} disabled={syncing}>
                    Sync {slug.toUpperCase()}
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                OpenAI analysis: {status?.openai_enabled ? "enabled" : "disabled"} · Batch sync requires{" "}
                <code className="text-xs">php artisan queue:work</code>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reference preview</DialogTitle>
            <DialogDescription>Popup content as consultants will see it.</DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div
              className="prose prose-sm max-w-none leg-popup-preview border rounded-md p-4"
              dangerouslySetInnerHTML={{ __html: previewHtml ?? "" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
