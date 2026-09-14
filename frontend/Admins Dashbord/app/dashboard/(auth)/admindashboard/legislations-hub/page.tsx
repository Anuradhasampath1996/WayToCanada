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
  Pause,
  Play,
  Square,
  Link2,
  Pencil,
  ChevronDown,
  ChevronRight,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  scope?: string;
  progress_percent: number;
  completed_steps?: number;
  total_steps?: number;
  current_step: string | null;
  stats: {
    created?: number;
    updated?: number;
    errors?: string[];
    synced_entries?: number;
    pending_total?: number;
    only_unsynced?: boolean;
    coverage?: LinkCoverage;
  } | null;
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
  catalog_pending?: { acts: number; regulations: number; total: number };
  catalog_act_count?: number;
  configured_sources: string[];
  openai_enabled: boolean;
  immigration_tier_count?: number;
  batch?: { default_size: number; max_size: number; request_delay_ms: number };
  queue_health?: QueueHealth;
  link_coverage?: LinkCoverage;
  amendment_alerts?: AmendmentAlert[];
  latest_run: SyncRun | null;
  recent_documents: DocRow[];
};

type QueueHealth = {
  driver: string;
  pending_jobs: number;
  worker_likely_active: boolean;
  worker_warning: string | null;
  setup_steps?: string[];
  last_failed: { at: string; job: string; message: string } | null;
};

type LinkCoverage = {
  documents: number;
  linked: number;
  gaps: number;
  coverage_percent: number;
};

type AmendmentAlert = {
  id: number;
  act_code: string;
  language: string;
  format: string;
  title?: string | null;
  detected_at: string;
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

const SYNC_STEPS = [
  "Discover the federal Acts & Regulations catalog from Justice Canada",
  "Download IRPA + IRPR (English and French, XML / HTML / PDF) and build the viewer",
  "Download the immigration-tier set (Citizenship Act, RPD/RAD rules, and related regs)",
  "Linkify cross-references so consultants can click between provisions",
  "Queue the remaining catalog downloads in the background (skip already downloaded)",
];

export default function LegislationsHubPage() {
  const [status, setStatus] = React.useState<SyncStatus | null>(null);
  const [documents, setDocuments] = React.useState<DocRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [activeRun, setActiveRun] = React.useState<SyncRun | null>(null);
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
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [batchSize, setBatchSize] = React.useState(10);
  const [syncWithAi, setSyncWithAi] = React.useState(false);
  const [skipAlreadyDownloaded, setSkipAlreadyDownloaded] = React.useState(true);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearConfirm, setClearConfirm] = React.useState("");
  const [clearDocuments, setClearDocuments] = React.useState(true);
  const [clearCatalog, setClearCatalog] = React.useState(false);
  const [clearSyncHistory, setClearSyncHistory] = React.useState(true);
  const [clearForce, setClearForce] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [controllingDownload, setControllingDownload] = React.useState(false);

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
      if (st.batch?.default_size) {
        setBatchSize(st.batch.default_size);
      }
      if (st.latest_run && ["pending", "running"].includes(st.latest_run.status)) {
        setActiveRun(st.latest_run);
        setSyncing(true);
      } else if (st.latest_run?.status === "paused") {
        setActiveRun(st.latest_run);
        setSyncing(false);
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
    if (!activeRun?.id) return;
    if (!["pending", "running"].includes(activeRun.status)) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API}/admin/legislation/sync-runs/${activeRun.id}`, { headers: adminAuthHeaders() });
        const json = await res.json();
        const run = json.data as SyncRun;
        setActiveRun(run);
        if (["completed", "failed", "cancelled", "paused"].includes(run.status)) {
          setSyncing(false);
          if (run.status === "completed") {
            const coverage = run.stats?.coverage;
            const coverageNote = coverage ? ` Link coverage: ${coverage.coverage_percent}%` : "";
            setMessage(`${run.current_step ?? "Sync completed."}${coverageNote}`);
          } else if (run.status === "cancelled") {
            setMessage(run.current_step ?? "Download stopped.");
          } else if (run.status === "paused") {
            setMessage(run.current_step ?? "Download paused.");
          } else {
            setMessage(run.error_message ?? "Sync failed.");
          }
          load();
          loadCatalog(catalogPage);
        }
      } catch {
        // keep polling on transient errors
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 1000);
    return () => clearInterval(id);
  }, [activeRun?.id, activeRun?.status, load, loadCatalog, catalogPage]);

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
    runLinkify?: boolean;
    onlyUnsynced?: boolean;
  }) => {
    setSyncing(true);
    setMessage(null);
    const onlyUnsynced = opts?.onlyUnsynced ?? skipAlreadyDownloaded;
    try {
      const res = await fetch(`${API}/admin/legislation/sync`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({
          source: opts?.source,
          scope: opts?.scope ?? (opts?.source ? "source" : "all"),
          category: opts?.category,
          batch_size: opts?.batchSize ?? batchSize,
          only_unsynced: onlyUnsynced,
          async: true,
          run_ai: opts?.runAi ?? false,
          run_linkify: opts?.runLinkify ?? false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Sync failed");
      setActiveRun(json.run);
      const warning = json.warning as string | undefined;
      setMessage(warning ? `${json.message} — ${warning}` : json.message);
      if (json.run?.status === "completed") {
        setSyncing(false);
      }
    } catch (e) {
      setSyncing(false);
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  };

  const pendingActs = status?.catalog_pending?.acts ?? catalogCounts.pending;
  const pendingRegs = status?.catalog_pending?.regulations ?? 0;
  const pendingTotal = status?.catalog_pending?.total ?? catalogCounts.pending;

  const catalogSyncedCount = (run: SyncRun) =>
    Math.max(run.stats?.synced_entries ?? 0, run.completed_steps ?? 0);

  const catalogProgressLabel = (run: SyncRun) => {
    const total = run.stats?.pending_total ?? run.total_steps ?? 0;
    const synced = catalogSyncedCount(run);
    if (total > 0) {
      return `${synced} / ${total} documents (${run.progress_percent}%)`;
    }
    return `${run.progress_percent}% complete`;
  };

  const controlDownload = async (action: "pause" | "resume" | "cancel") => {
    if (!activeRun) return;
    setControllingDownload(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/sync-runs/${activeRun.id}/${action}`, {
        method: "POST",
        headers: adminAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Request failed");
      setActiveRun(json.run as SyncRun);
      if (action === "resume") {
        setSyncing(true);
      } else {
        setSyncing(false);
      }
      setMessage(json.message ?? (action === "cancel" ? "Download stopped." : "Download paused."));
      if (action === "cancel") {
        load();
        loadCatalog(catalogPage);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update download.");
    } finally {
      setControllingDownload(false);
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

  const acknowledgeAmendment = async (id: number) => {
    try {
      await fetch(`${API}/admin/legislation/amendments/${id}/acknowledge`, {
        method: "POST",
        headers: adminAuthHeaders(),
      });
      load();
    } catch {
      setMessage("Could not acknowledge alert.");
    }
  };

  const clearLegislationData = async () => {
    if (clearConfirm !== "CLEAR") return;
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/admin/legislation/clear`, {
        method: "POST",
        headers: adminAuthHeaders("application/json"),
        body: JSON.stringify({
          confirm: "CLEAR",
          clear_documents: clearDocuments,
          clear_catalog: clearCatalog,
          clear_sync_history: clearSyncHistory,
          force: clearForce,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Clear failed");
      setClearOpen(false);
      setClearConfirm("");
      setClearForce(false);
      setActiveRun(null);
      setSyncing(false);
      setMessage(json.message ?? "Legislation data cleared.");
      load();
      loadCatalog(1);
      setCatalogPage(1);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  };

  const handleCatalogSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogPage(1);
    loadCatalog(1);
  };

  return (
    <TooltipProvider>
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            Legislation Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            One click syncs Canadian Acts &amp; Regulations from{" "}
            <a href="https://laws.justice.gc.ca/eng/acts/" target="_blank" rel="noopener noreferrer" className="underline">
              laws.justice.gc.ca
            </a>
            {" "}into the consultant library. IRPA + IRPR first, then the rest in the background.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => startSync({ scope: "full", batchSize, runAi: syncWithAi, runLinkify: true })}
            disabled={syncing}
          >
            {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CloudDownload className="h-4 w-4 mr-1" />}
            Sync legislation
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClearOpen(true)}
                disabled={syncing || clearing}
                className="text-destructive hover:text-destructive"
              >
                {clearing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Clear library
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-left leading-relaxed">
              <p className="font-semibold">Clear library</p>
              <p className="mt-1 opacity-90">Deletes downloaded files and sync history. Type CLEAR to confirm. Does not run as part of Sync legislation.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Collapsible className="w-full" open={guideOpen} onOpenChange={setGuideOpen}>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Catalog: {catalogCounts.acts} acts · {catalogCounts.regulations} regs · {pendingTotal} pending
            </span>
            <CollapsibleTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1 hover:text-foreground">
                Options
                {guideOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Batch size
                <Input
                  type="number"
                  min={1}
                  max={status?.batch?.max_size ?? 30}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.min(30, Math.max(1, Number(e.target.value) || 10)))}
                  className="h-8 w-16"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipAlreadyDownloaded}
                  onChange={(e) => setSkipAlreadyDownloaded(e.target.checked)}
                  className="rounded border-input"
                />
                Skip already downloaded
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncWithAi}
                  onChange={(e) => setSyncWithAi(e.target.checked)}
                  className="rounded border-input"
                />
                Optional AI pass
              </label>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              {SYNC_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
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

      {(syncing || activeRun?.status === "paused") && activeRun && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
              <span>
                {activeRun.status === "paused" ? "Download paused" : "Download in progress"}
              </span>
              <Badge variant="secondary">{catalogProgressLabel(activeRun)}</Badge>
            </CardTitle>
            <CardDescription>{activeRun.current_step ?? "Running…"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={activeRun.progress_percent} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {activeRun.stats?.pending_total != null && activeRun.stats.pending_total > 0
                ? `${catalogSyncedCount(activeRun)} of ${activeRun.stats.pending_total} catalog entries downloaded`
                : `${activeRun.progress_percent}% complete`}
              {activeRun.stats?.only_unsynced === false && " · re-downloading all entries"}
              {(activeRun.stats as { coverage?: LinkCoverage })?.coverage && (
                <> · Link coverage {(activeRun.stats as { coverage: LinkCoverage }).coverage.coverage_percent}%</>
              )}
            </p>
            {(activeRun.scope === "catalog_batch" || activeRun.scope === "catalog" || activeRun.scope === "full") && (
              <div className="flex flex-wrap gap-2">
                {activeRun.status === "paused" ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => controlDownload("resume")}
                    disabled={controllingDownload}
                  >
                    {controllingDownload ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                    Resume
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => controlDownload("pause")}
                    disabled={controllingDownload || !["pending", "running"].includes(activeRun.status)}
                  >
                    {controllingDownload ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Pause className="h-4 w-4 mr-1" />}
                    Pause
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => controlDownload("cancel")}
                  disabled={controllingDownload || activeRun.status === "cancelled"}
                >
                  {controllingDownload ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Square className="h-4 w-4 mr-1" />}
                  Stop
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Pending download</CardDescription><CardTitle className="text-amber-700 dark:text-amber-300">{pendingTotal}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Acts pending</CardDescription><CardTitle>{pendingActs}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Regs pending</CardDescription><CardTitle>{pendingRegs}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Catalog synced</CardDescription><CardTitle>{catalogStats?.synced ?? catalogCounts.synced}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Documents</CardDescription><CardTitle>{status?.document_count ?? "—"}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Provisions</CardDescription><CardTitle>{status?.provision_count ?? "—"}</CardTitle></CardHeader></Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardDescription>Link coverage</CardDescription>
            <CardTitle>
              {status?.link_coverage?.coverage_percent != null
                ? `${status.link_coverage.coverage_percent}%`
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {(status?.queue_health || (status?.amendment_alerts?.length ?? 0) > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {status?.queue_health && (
            <Card className={status.queue_health.worker_likely_active ? "border-green-500/30" : "border-amber-500/40"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Queue health
                  <Badge variant={status.queue_health.worker_likely_active ? "secondary" : "destructive"}>
                    {status.queue_health.worker_likely_active ? "OK" : "Check worker"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Driver: {status.queue_health.driver} · Pending jobs: {status.queue_health.pending_jobs}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                {status.queue_health.worker_warning && (
                  <p className="text-amber-700 dark:text-amber-300">{status.queue_health.worker_warning}</p>
                )}
                {(status.queue_health.setup_steps?.length ?? 0) > 0 && (
                  <ol className="list-decimal list-inside space-y-1 font-mono text-[10px]">
                    {status.queue_health.setup_steps?.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
                {status.queue_health.last_failed && (
                  <p>
                    Last failed: {status.queue_health.last_failed.job} — {status.queue_health.last_failed.message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {(status?.amendment_alerts?.length ?? 0) > 0 && (
            <Card className="border-amber-500/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Amendment alerts</CardTitle>
                <CardDescription>IRPA/IRPR content changed on Justice Canada — re-run Sync + Linkify</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {status?.amendment_alerts?.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between gap-2 rounded-lg border p-2 text-xs">
                    <div>
                      <p className="font-medium">{alert.act_code} · {alert.language}/{alert.format}</p>
                      <p className="text-muted-foreground truncate">{alert.title}</p>
                      <p className="text-muted-foreground">{new Date(alert.detected_at).toLocaleString()}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => acknowledgeAmendment(alert.id)}>
                      Dismiss
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No catalog entries yet. Click Sync legislation to build the catalog.</TableCell></TableRow>
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

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear legislation data?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>This permanently deletes selected data. You cannot undo this action.</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearDocuments}
                    onChange={(e) => setClearDocuments(e.target.checked)}
                    className="rounded border-input"
                  />
                  Downloaded documents, provisions, references &amp; files
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearCatalog}
                    onChange={(e) => setClearCatalog(e.target.checked)}
                    className="rounded border-input"
                  />
                  Catalog index (acts/regs list — run Discover again)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearSyncHistory}
                    onChange={(e) => setClearSyncHistory(e.target.checked)}
                    className="rounded border-input"
                  />
                  Sync run history &amp; amendment alerts
                </label>
                {syncing && (
                  <label className="flex items-center gap-2 cursor-pointer text-amber-700 dark:text-amber-300">
                    <input
                      type="checkbox"
                      checked={clearForce}
                      onChange={(e) => setClearForce(e.target.checked)}
                      className="rounded border-input"
                    />
                    Force clear while sync is running (cancels active job)
                  </label>
                )}
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="clear-confirm">Type CLEAR to confirm</Label>
                  <Input
                    id="clear-confirm"
                    value={clearConfirm}
                    onChange={(e) => setClearConfirm(e.target.value)}
                    placeholder="CLEAR"
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void clearLegislationData();
              }}
              disabled={clearing || clearConfirm !== "CLEAR" || (!clearDocuments && !clearCatalog && !clearSyncHistory)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Clear data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
